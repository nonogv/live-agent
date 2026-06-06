import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import type { Song } from '@ableton-extensions/sdk';
import type { Storage, SessionMeta } from './storage.js';
import { buildSystemPrompt } from './agent/chat.js';
import { getLiveState } from './live/executor.js';
import type { AgentContext } from './live/agent-context.js';
import { shouldPromptToContinue } from './agent/agent-checkpoint.js';
import {
  CONTINUE_TASK_TOOL_NAME,
  MAX_AGENT_ROUNDS,
  ROUND_LIMIT_MESSAGE,
  STOPPED_BY_USER_MESSAGE,
} from './agent/constants.js';
import { executeToolWithRecovery } from './agent/tool-execution.js';
import { GENERATED_TOOL_SCHEMAS } from './agent/generated-tools.js';
import { CUSTOM_TOOL_SCHEMAS } from './agent/tools.js';
import { createProvider, type ProviderMessage } from './providers/index.js';
import { DESTRUCTIVE_TOOLS } from './agent/safety.js';
import { pruneHistoryForProvider } from './history-prune.js';
import { stringifyJson, toJsonSafe } from './json.js';

const ALL_TOOL_SCHEMAS = [...CUSTOM_TOOL_SCHEMAS, ...GENERATED_TOOL_SCHEMAS];

type ConfirmMode = 'review' | 'guard' | 'off';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_FILE = '/tmp/live-agent-debug.log';

function dbg(...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${args.map(String).join(' ')}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // intentionally swallow — log writes are best-effort
  }
  console.log(...args);
}

export interface LiveAgentServer {
  port: number;
  close(): void;
}

export async function startServer(
  getSong: () => Song<'1.0.0'>,
  storage: Storage,
  resources?: AgentContext['resources'],
): Promise<LiveAgentServer> {
  const agentContext: AgentContext = { getSong, resources };
  /** Steps since last continue approval — persists across user messages in this Live session. */
  const agentBatchRef = { stepsInBatch: 0 };
  // One UUID per extension lifetime (i.e. per Live-app session).
  const sessionId = randomUUID();
  const sessionMeta: SessionMeta = { id: sessionId, startedAt: new Date().toISOString() };
  storage.saveSessionMeta(sessionId, sessionMeta);

  const historyRef: { arr: ProviderMessage[] } = { arr: [] };
  // Tracks the session ID used for saving history. Starts as the current session
  // but switches when the user loads a previous one from the history panel.
  const activeSessionRef = { id: sessionId };
  let confirmMode: ConfirmMode = 'guard';

  const uiDir = path.join(__dirname, 'ui');

  const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
  };

  const httpServer = http.createServer((req, res) => {
    const rawUrl = req.url ?? '/';
    // Strip query string for file resolution
    const urlPath = rawUrl.split('?')[0];

    // Serve index.html for root and any path that doesn't look like a static asset
    const ext = path.extname(urlPath);
    const filePath =
      ext && urlPath !== '/' ? path.join(uiDir, urlPath) : path.join(uiDir, 'index.html');

    if (fs.existsSync(filePath)) {
      const mime = MIME[path.extname(filePath)] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws) => {
    console.log('[Live Agent] UI connected');

    ws.send(JSON.stringify({ type: 'ready' }));

    handleConnection(ws, storage, historyRef);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WebViewMessage;
        handleMessage(
          ws,
          msg,
          agentContext,
          storage,
          historyRef,
          confirmMode,
          (val) => {
            confirmMode = val;
          },
          activeSessionRef,
          agentBatchRef,
        ).catch((err) => {
          ws.send(JSON.stringify({ type: 'error', message: String(err) }));
        });
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
      }
    });

    ws.on('close', () => console.log('[Live Agent] UI disconnected'));
  });

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address() as { port: number };

  console.log(`[Live Agent] Server listening on http://127.0.0.1:${address.port}`);

  return {
    port: address.port,
    close: () => httpServer.close(),
  };
}

// ─── Message types ────────────────────────────────────────────────────────────

type WebViewMessage =
  | { type: 'chat'; text: string; provider: string; model: string }
  | { type: 'clear_history' }
  | { type: 'get_settings' }
  | { type: 'save_settings'; keys: Record<string, string> }
  | { type: 'set_active_choice'; provider: string; model: string }
  | { type: 'clear_key'; provider: string }
  | { type: 'open_url'; url: string }
  | { type: 'console_log'; level: string; message: string }
  | { type: 'debug'; provider: string; model: string }
  | { type: 'confirm_response'; confirmed: boolean; toolCallId: string }
  | { type: 'set_confirm_mode'; mode: ConfirmMode }
  | { type: 'get_sessions' }
  | { type: 'load_session'; id: string }
  | { type: 'name_session'; name: string }
  | { type: 'get_context' }
  | { type: 'save_instructions'; scope: 'global' | 'project'; content: string }
  | { type: 'save_memories'; scope: 'global' | 'project'; content: string }
  | { type: 'refresh_project_memories'; provider: string; model: string };

/** Sends the user-visible portion of the conversation history to the UI. */
/**
 * Sends the user-visible portion of the conversation history to the UI.
 * Always sends the frame so that switching to an empty project clears the chat.
 */
function sendVisibleHistory(ws: WebSocket, history: ProviderMessage[]): void {
  const visibleHistory = history
    .filter(
      (message) => message.role === 'user' || (message.role === 'assistant' && message.content),
    )
    .map((message) => ({
      role: message.role === 'assistant' ? 'agent' : 'user',
      content: message.content,
    }));
  ws.send(JSON.stringify({ type: 'history', messages: visibleHistory }));
}
/**
 * Sends the initial project, history, stale-warning, and context frames.
 *
 * Always starts with an empty conversation — the user resumes a specific session
 * explicitly via the history panel rather than through any automatic detection.
 */
function handleConnection(
  ws: WebSocket,
  storage: Storage,
  historyRef: { arr: ProviderMessage[] },
): void {
  historyRef.arr = [];
  sendVisibleHistory(ws, historyRef.arr);
  ws.send(JSON.stringify({ type: 'context', ...storage.loadPromptContext() }));
}

async function handleMessage(
  ws: WebSocket,
  msg: WebViewMessage,
  agentContext: AgentContext,
  storage: Storage,
  historyRef: { arr: ProviderMessage[] },
  confirmMode: ConfirmMode,
  setConfirmMode: (val: ConfirmMode) => void,
  activeSessionRef: { id: string },
  agentBatchRef: { stepsInBatch: number },
): Promise<void> {
  switch (msg.type) {
    case 'chat':
      await handleChat(
        ws,
        msg.text,
        msg.provider,
        msg.model,
        agentContext,
        storage,
        historyRef.arr,
        confirmMode,
        activeSessionRef.id,
        agentBatchRef,
      );
      break;

    case 'set_confirm_mode':
      setConfirmMode(msg.mode);
      break;

    case 'confirm_response':
      // Handled inside requestConfirmation via ws 'message' listener; ignore here.
      break;

    case 'clear_history':
      historyRef.arr.length = 0;
      storage.saveSessionHistory(activeSessionRef.id, []);
      ws.send(JSON.stringify({ type: 'history_cleared' }));
      break;

    case 'get_sessions': {
      const sessions = storage.listSessions();
      ws.send(JSON.stringify({ type: 'sessions', sessions }));
      break;
    }

    case 'load_session': {
      const meta = storage.loadSessionMeta(msg.id);
      if (!meta) {
        ws.send(JSON.stringify({ type: 'error', message: `Session not found: ${msg.id}` }));
        break;
      }
      activeSessionRef.id = msg.id;
      historyRef.arr = storage.loadSessionHistory(msg.id);
      ws.send(JSON.stringify({ type: 'session_loaded', session: meta }));
      sendVisibleHistory(ws, historyRef.arr);
      break;
    }

    case 'name_session': {
      const meta = storage.loadSessionMeta(activeSessionRef.id) ?? {
        id: activeSessionRef.id,
        startedAt: new Date().toISOString(),
      };
      meta.name = msg.name.trim();
      storage.saveSessionMeta(activeSessionRef.id, meta);
      ws.send(JSON.stringify({ type: 'session_named', id: activeSessionRef.id, name: meta.name }));
      break;
    }

    case 'get_context':
      ws.send(JSON.stringify({ type: 'context', ...storage.loadPromptContext() }));
      break;

    case 'save_instructions':
      storage.saveInstructions(msg.scope, msg.content);
      ws.send(JSON.stringify({ type: 'context_saved' }));
      break;

    case 'save_memories':
      storage.saveMemories(msg.scope, msg.content);
      ws.send(JSON.stringify({ type: 'context_saved' }));
      break;

    case 'refresh_project_memories':
      await handleRefreshProjectMemories(
        ws,
        msg.provider,
        msg.model,
        agentContext.getSong,
        storage,
      );
      break;

    case 'get_settings':
      ws.send(
        JSON.stringify({
          type: 'settings',
          keys: storage.getMaskedKeys(),
          lastProvider: storage.getLastProvider(),
          lastModel: storage.getLastModel(),
        }),
      );
      break;

    case 'save_settings':
      for (const [provider, key] of Object.entries(msg.keys)) {
        if (key && key !== '••••••••') {
          storage.setApiKey(provider, key);
        }
      }
      ws.send(JSON.stringify({ type: 'settings_saved' }));
      break;

    case 'set_active_choice':
      storage.saveLastChoice(msg.provider, msg.model);
      break;

    case 'clear_key':
      storage.setApiKey(msg.provider, '');
      ws.send(JSON.stringify({ type: 'key_cleared', provider: msg.provider }));
      break;

    case 'open_url': {
      const url = msg.url;
      if (url.startsWith('https://')) {
        const cmd = process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`;
        exec(cmd, (err) => {
          if (err) console.error('[Live Agent] Failed to open URL:', err);
        });
      }
      break;
    }

    case 'console_log':
      dbg(`[WebView:${msg.level}] ${msg.message}`);
      break;

    case 'debug':
      await handleDebug(ws, msg.provider, msg.model, storage);
      break;
  }
}

async function handleChat(
  ws: WebSocket,
  userText: string,
  providerId: string,
  model: string,
  agentContext: AgentContext,
  storage: Storage,
  history: ProviderMessage[],
  confirmMode: ConfirmMode,
  sessionId: string,
  agentBatchRef: { stepsInBatch: number },
): Promise<void> {
  const apiKey = storage.getApiKey(providerId);
  if (!apiKey) {
    ws.send(
      JSON.stringify({
        type: 'error',
        message: `No API key found for ${providerId}. Add it in Settings.`,
      }),
    );
    return;
  }

  history.push({ role: 'user', content: userText });
  ws.send(JSON.stringify({ type: 'stream_start' }));

  try {
    const provider = createProvider(providerId, apiKey);
    const song = agentContext.getSong();

    // Build the system prompt once per user message. We keep it constant so that
    // Gemini thinking-model thought_signatures (which are tied to the session
    // context) remain valid across rounds. The handle registry is refreshed each
    // round separately (see below) so tool calls always resolve current handles.
    const context = storage.loadPromptContext();
    const systemPrompt = buildSystemPrompt(await getLiveState(song), ALL_TOOL_SCHEMAS, context);

    // Agentic loop: keep calling the provider until it returns a final text
    // response with no tool calls. Pauses every ROUNDS_PER_BATCH steps (counted
    // across user messages) to ask the user to continue; hard-capped per message.
    let totalRounds = 0;
    let taskCompleted = false;

    while (totalRounds < MAX_AGENT_ROUNDS) {
      totalRounds++;
      agentBatchRef.stepsInBatch++;
      // Refresh handle registry so every round resolves the CURRENT Live objects.
      // We discard the returned state (system prompt is built only once) — the
      // important side-effect is clearRegistry() + re-registering all handles.
      if (totalRounds > 1) await getLiveState(song);
      let assistantContent = '';
      let hadToolCall = false;

      dbg(
        `[Live Agent] round ${totalRounds} (batch ${agentBatchRef.stepsInBatch}) — provider=${providerId} model=${model}`,
      );
      const providerMessages = pruneHistoryForProvider(history);
      for await (const chunk of provider.chat({
        model,
        systemPrompt,
        messages: providerMessages,
        tools: ALL_TOOL_SCHEMAS,
      })) {
        if (chunk.type === 'text') {
          assistantContent += chunk.text;
          ws.send(JSON.stringify({ type: 'stream_chunk', text: chunk.text }));
        } else if (chunk.type === 'tool_call') {
          hadToolCall = true;

          const needsConfirm =
            confirmMode === 'review' ||
            (confirmMode === 'guard' && DESTRUCTIVE_TOOLS.has(chunk.name));
          if (needsConfirm) {
            const confirmed = await requestUserApproval(
              ws,
              chunk.id,
              chunk.name,
              chunk.args,
              30_000,
            );
            if (!confirmed) {
              history.push({ role: 'assistant', content: assistantContent, toolCall: chunk });
              history.push({
                role: 'tool',
                toolCallId: chunk.id,
                toolName: chunk.name,
                content: JSON.stringify({ cancelled: true, reason: 'User declined.' }),
              });
              ws.send(
                JSON.stringify({
                  type: 'tool_result',
                  name: chunk.name,
                  result: { cancelled: true },
                }),
              );
              assistantContent = '';
              continue;
            }
          }

          ws.send(JSON.stringify({ type: 'tool_start', name: chunk.name, args: chunk.args }));

          const result = await executeToolWithRecovery(agentContext, chunk.name, chunk.args);

          const safeResult = toJsonSafe(result);
          ws.send(stringifyJson({ type: 'tool_result', name: chunk.name, result: safeResult }));

          history.push({
            role: 'assistant',
            content: assistantContent,
            toolCall: chunk,
          });
          history.push({
            role: 'tool',
            toolCallId: chunk.id,
            toolName: chunk.name,
            content: stringifyJson(safeResult),
          });

          assistantContent = '';
        }
      }

      if (!hadToolCall) {
        // Final response — push and stop looping
        if (assistantContent) {
          history.push({ role: 'assistant', content: assistantContent });
        }
        taskCompleted = true;
        agentBatchRef.stepsInBatch = 0;
        break;
      }

      if (
        shouldPromptToContinue(
          agentBatchRef.stepsInBatch,
          hadToolCall,
          totalRounds,
          MAX_AGENT_ROUNDS,
        )
      ) {
        if (confirmMode === 'off') {
          // Auto mode: keep going without step-approval prompts.
          agentBatchRef.stepsInBatch = 0;
        } else {
          const approved = await requestContinueApproval(ws, agentBatchRef.stepsInBatch);
          if (!approved) {
            history.push({ role: 'assistant', content: STOPPED_BY_USER_MESSAGE });
            agentBatchRef.stepsInBatch = 0;
            break;
          }

          agentBatchRef.stepsInBatch = 0;
        }
      }
      // Tool calls were made; loop to get the model's follow-up response
    }

    if (!taskCompleted && totalRounds >= MAX_AGENT_ROUNDS) {
      ws.send(JSON.stringify({ type: 'stream_chunk', text: ROUND_LIMIT_MESSAGE }));
      history.push({ role: 'assistant', content: ROUND_LIMIT_MESSAGE });
    }

    ws.send(JSON.stringify({ type: 'stream_end' }));
  } catch (err) {
    const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
    dbg('[Live Agent] Chat error:', stack);
    ws.send(JSON.stringify({ type: 'error', message: stack }));
    history.pop();
  } finally {
    storage.saveSessionHistory(sessionId, history);
    // Populate the session preview from the first user message.
    const firstUser = history.find((m) => m.role === 'user');
    if (firstUser && typeof firstUser.content === 'string') {
      const meta = storage.loadSessionMeta(sessionId);
      if (meta && !meta.preview) {
        meta.preview = firstUser.content.slice(0, 80);
        storage.saveSessionMeta(sessionId, meta);
      }
    }
  }
}

/**
 * Sends a confirmation request to the UI and waits for the user's response.
 * Resolves to `true` if the user confirms, `false` if they cancel or if the
 * timeout elapses with no response.
 */
async function requestUserApproval(
  ws: WebSocket,
  approvalId: string,
  title: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    ws.send(
      JSON.stringify({ type: 'confirm_request', toolCallId: approvalId, toolName: title, args }),
    );

    const handler = (raw: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const msg = JSON.parse(raw.toString()) as WebViewMessage;
        if (msg.type === 'confirm_response' && msg.toolCallId === approvalId) {
          ws.off('message', handler);
          resolve(msg.confirmed);
        }
      } catch {
        // ignore malformed messages
      }
    };
    ws.on('message', handler);

    setTimeout(() => {
      ws.off('message', handler);
      resolve(false);
    }, timeoutMs);
  });
}

/** Asks the user to approve another batch of agent steps after a long run. */
async function requestContinueApproval(ws: WebSocket, roundsCompleted: number): Promise<boolean> {
  return requestUserApproval(
    ws,
    `continue-${randomUUID()}`,
    CONTINUE_TASK_TOOL_NAME,
    { roundsCompleted },
    120_000,
  );
}

/** Regenerates project memories from the current Live session via a single LLM turn. */
async function handleRefreshProjectMemories(
  ws: WebSocket,
  providerId: string,
  model: string,
  getSong: () => Song<'1.0.0'>,
  storage: Storage,
): Promise<void> {
  const apiKey = storage.getApiKey(providerId);
  if (!apiKey) {
    ws.send(
      JSON.stringify({
        type: 'error',
        message: `No API key found for ${providerId}. Add it in Settings.`,
      }),
    );
    return;
  }

  const liveState = await getLiveState(getSong());
  const currentMemories = storage.loadMemories('project');
  const systemPrompt = `You are updating project memories for a music producer using Live Agent.
Given the current Ableton session state and the existing project memories,
rewrite the memories as 3-7 concise bullet points capturing the project's
structure and style. Return only the bullet points, no preamble.`;
  const userContent = `Current session:\nTempo: ${liveState.tempo} BPM\nTracks: ${liveState.tracks.map((track) => track.name).join(', ')}\n\nExisting memories:\n${currentMemories || '(none)'}`;

  ws.send(JSON.stringify({ type: 'stream_start' }));

  try {
    const provider = createProvider(providerId, apiKey);
    let fullText = '';

    for await (const chunk of provider.chat({
      model,
      systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      tools: [],
    })) {
      if (chunk.type === 'text') {
        fullText += chunk.text;
        ws.send(JSON.stringify({ type: 'stream_chunk', text: chunk.text }));
      }
    }

    ws.send(JSON.stringify({ type: 'stream_end' }));

    storage.saveMemories('project', fullText);
    ws.send(JSON.stringify({ type: 'context_saved' }));
    ws.send(JSON.stringify({ type: 'context', ...storage.loadPromptContext() }));
  } catch (err) {
    const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
    dbg('[Live Agent] Refresh project memories error:', stack);
    ws.send(JSON.stringify({ type: 'error', message: stack }));
    throw err;
  }
}

async function handleDebug(
  ws: WebSocket,
  providerId: string,
  model: string,
  storage: Storage,
): Promise<void> {
  // Stream each diagnostic line as a text chunk so it appears in chat
  // regardless of whether the debug_result message type is handled.
  const emit = (s: string) => {
    dbg('[debug]', s);
    ws.send(JSON.stringify({ type: 'stream_chunk', text: s + '\n' }));
  };

  ws.send(JSON.stringify({ type: 'stream_start' }));

  emit(`Node: ${process.version}  platform: ${process.platform}`);
  emit(`cwd: ${process.cwd()}`);

  // Probe require('url') without touching any global
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const urlMod = require('url') as typeof import('url');
    const u = new urlMod.URL('https://example.com/path?q=1');
    emit(`require("url").URL: OK  host=${u.host}`);
  } catch (e) {
    emit(`require("url").URL: FAIL – ${e}`);
  }

  // Probe https.request (does not open a connection, just checks the API)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const httpsMod = require('https') as typeof import('https');
    emit(`require("https"): OK  type=${typeof httpsMod.request}`);
  } catch (e) {
    emit(`require("https"): FAIL – ${e}`);
  }

  // Provider factory (no network call)
  const apiKey = storage.getApiKey(providerId);
  emit(`API key set: ${!!apiKey}  provider=${providerId}  model=${model}`);
  try {
    createProvider(providerId, apiKey ?? 'test');
    emit(`createProvider: OK`);
  } catch (e) {
    emit(`createProvider: FAIL – ${e}`);
  }

  // File write probe
  try {
    fs.writeFileSync('/tmp/live-agent-probe.txt', `ok ${Date.now()}\n`);
    emit(`fs.writeFileSync: OK`);
  } catch (e) {
    emit(`fs.writeFileSync: FAIL – ${e}`);
  }

  ws.send(JSON.stringify({ type: 'stream_end' }));
}
