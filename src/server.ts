import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import type { Song } from '@ableton-extensions/sdk';
import type { Storage } from './storage.js';
import { buildSystemPrompt, type LiveState } from './agent/chat.js';
import type { ProjectSnapshot } from './storage.js';
import { getLiveState, handleToolCall } from './live/executor.js';
import { executeGeneratedTool } from './live/generated-executor.js';
import { GENERATED_TOOL_SCHEMAS } from './agent/generated-tools.js';
import { CUSTOM_TOOL_SCHEMAS } from './agent/tools.js';
import { createProvider, type ProviderMessage } from './providers/index.js';
import { DESTRUCTIVE_TOOLS } from './agent/safety.js';
import { pruneHistoryForProvider } from './history-prune.js';

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
): Promise<LiveAgentServer> {
  // History is initialised empty; handleConnection populates it once the
  // Live-state fingerprint is known. This avoids loading the wrong project's
  // history at startup before we have a chance to detect the current set.
  const historyRef: { arr: ProviderMessage[] } = { arr: [] };
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

    // Project auto-detection runs first; history is sent inside handleConnection
    // after the fingerprint resolves so the UI always receives the correct set.
    void handleConnection(ws, getSong, storage, historyRef).catch((err) => {
      console.error('[Live Agent] Failed to initialise connection:', err);
      ws.send(JSON.stringify({ type: 'error', message: String(err) }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WebViewMessage;
        handleMessage(ws, msg, getSong, storage, historyRef, confirmMode, (val) => {
          confirmMode = val;
        }).catch((err) => {
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
 * Builds a human-readable stale summary when the live session diverges from the saved snapshot.
 * Returns null when the snapshot still matches the current session.
 */
function buildStaleSummary(snapshot: ProjectSnapshot, liveState: LiveState): string | null {
  const currentTrackNames = liveState.tracks.map((track) => track.name);
  const parts: string[] = [];

  if (snapshot.trackCount !== liveState.trackCount) {
    parts.push(`Track count changed from ${snapshot.trackCount} to ${liveState.trackCount}`);
  }

  const snapshotNames = new Set(snapshot.trackNames);
  const currentNames = new Set(currentTrackNames);
  const added = currentTrackNames.filter((name) => !snapshotNames.has(name));
  const removed = snapshot.trackNames.filter((name) => !currentNames.has(name));
  if (added.length > 0) {
    parts.push(`Tracks added: ${added.join(', ')}`);
  }
  if (removed.length > 0) {
    parts.push(`Tracks removed: ${removed.join(', ')}`);
  }

  if (Math.abs(snapshot.tempo - liveState.tempo) >= 5) {
    parts.push(`Tempo changed from ${snapshot.tempo} to ${liveState.tempo} BPM`);
  }

  return parts.length > 0 ? `${parts.join('. ')}.` : null;
}

/**
 * Derives a stable 16-character hex fingerprint from the Live session's structure.
 * Track and scene names are sorted before hashing so rename order doesn't matter.
 * The fingerprint is the same across Live restarts when the set is unchanged,
 * but differs between sets with different tracks or scenes.
 */
function computeProjectFingerprint(liveState: LiveState): string {
  const parts = [
    String(liveState.trackCount),
    ...liveState.tracks.map((t) => t.name).sort(),
    ...liveState.scenes.map((s) => s.name).sort(),
  ];
  return createHash('sha256').update(parts.join('\x00')).digest('hex').slice(0, 16);
}

/**
 * Auto-detects the current project by fingerprinting Live's track and scene
 * names, then loads the matching history and sends all initial connection frames.
 *
 * History is keyed by fingerprint and restored across Live restarts as long as
 * the set's track and scene names haven't changed.  Two sets with identical
 * names will share a history bucket — an accepted limitation of the SDK not
 * exposing a stable set identifier.
 */
async function handleConnection(
  ws: WebSocket,
  getSong: () => Song<'1.0.0'>,
  storage: Storage,
  historyRef: { arr: ProviderMessage[] },
): Promise<void> {
  const liveState = await getLiveState(getSong());
  const fingerprint = computeProjectFingerprint(liveState);

  historyRef.arr = storage.loadHistory(fingerprint);

  const autoName = liveState.tracks
    .slice(0, 3)
    .map((t) => t.name)
    .join(', ');
  storage.saveCurrentProject(autoName, fingerprint);

  ws.send(JSON.stringify({ type: 'project', name: autoName, slug: fingerprint }));
  sendVisibleHistory(ws, historyRef.arr);

  const snapshot = storage.loadProjectSnapshot(fingerprint);
  if (snapshot) {
    const summary = buildStaleSummary(snapshot, liveState);
    if (summary) ws.send(JSON.stringify({ type: 'project_stale', summary }));
  }

  ws.send(JSON.stringify({ type: 'context', ...storage.loadPromptContext() }));
}

async function handleMessage(
  ws: WebSocket,
  msg: WebViewMessage,
  getSong: () => Song<'1.0.0'>,
  storage: Storage,
  historyRef: { arr: ProviderMessage[] },
  confirmMode: ConfirmMode,
  setConfirmMode: (val: ConfirmMode) => void,
): Promise<void> {
  switch (msg.type) {
    case 'chat':
      await handleChat(
        ws,
        msg.text,
        msg.provider,
        msg.model,
        getSong,
        storage,
        historyRef.arr,
        confirmMode,
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
      storage.clearHistory();
      ws.send(JSON.stringify({ type: 'history_cleared' }));
      break;

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
      await handleRefreshProjectMemories(ws, msg.provider, msg.model, getSong, storage);
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
  getSong: () => Song<'1.0.0'>,
  storage: Storage,
  history: ProviderMessage[],
  confirmMode: ConfirmMode,
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
    const song = getSong();

    // Build the system prompt once per user message. We keep it constant so that
    // Gemini thinking-model thought_signatures (which are tied to the session
    // context) remain valid across rounds. The handle registry is refreshed each
    // round separately (see below) so tool calls always resolve current handles.
    const context = storage.loadPromptContext();
    const systemPrompt = buildSystemPrompt(await getLiveState(song), ALL_TOOL_SCHEMAS, context);

    // Agentic loop: keep calling the provider until it returns a final text
    // response with no tool calls (max 10 rounds as a safety net).
    const MAX_ROUNDS = 10;
    let round = 0;

    while (round < MAX_ROUNDS) {
      round++;
      // Refresh handle registry so every round resolves the CURRENT Live objects.
      // We discard the returned state (system prompt is built only once) — the
      // important side-effect is clearRegistry() + re-registering all handles.
      if (round > 1) await getLiveState(song);
      let assistantContent = '';
      let hadToolCall = false;

      dbg(`[Live Agent] round ${round} — provider=${providerId} model=${model}`);
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
            const confirmed = await requestConfirmation(ws, chunk.id, chunk.name, chunk.args);
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

          const result = await executeGeneratedTool(song, chunk.name, chunk.args).catch(
            (err: unknown) => {
              // Only fall back to custom tools for genuinely unknown generated tools.
              // Re-throw real execution errors so the LLM gets actionable feedback.
              if (err instanceof Error && err.message.startsWith('Unknown generated tool:')) {
                return handleToolCall(song, chunk.name, chunk.args);
              }
              throw err;
            },
          );

          ws.send(JSON.stringify({ type: 'tool_result', name: chunk.name, result }));

          history.push({
            role: 'assistant',
            content: assistantContent,
            toolCall: chunk,
          });
          history.push({
            role: 'tool',
            toolCallId: chunk.id,
            toolName: chunk.name,
            content: JSON.stringify(result),
          });

          assistantContent = '';
        }
      }

      if (!hadToolCall) {
        // Final response — push and stop looping
        if (assistantContent) {
          history.push({ role: 'assistant', content: assistantContent });
        }
        break;
      }
      // Tool calls were made; loop to get the model's follow-up response
    }

    ws.send(JSON.stringify({ type: 'stream_end' }));
  } catch (err) {
    const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
    dbg('[Live Agent] Chat error:', stack);
    // Send full stack to UI so we can see exactly where the error originates.
    ws.send(JSON.stringify({ type: 'error', message: stack }));
    history.pop();
  } finally {
    storage.saveHistory(history);
  }
}

/**
 * Sends a confirmation request to the UI and waits for the user's response.
 * Resolves to `true` if the user confirms, `false` if they cancel or if the
 * 30-second timeout elapses with no response.
 */
async function requestConfirmation(
  ws: WebSocket,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  return new Promise((resolve) => {
    ws.send(JSON.stringify({ type: 'confirm_request', toolCallId, toolName, args }));

    const handler = (raw: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const msg = JSON.parse(raw.toString()) as WebViewMessage;
        if (msg.type === 'confirm_response' && msg.toolCallId === toolCallId) {
          ws.off('message', handler);
          resolve(msg.confirmed);
        }
      } catch {
        // ignore malformed messages
      }
    };
    ws.on('message', handler);

    // Auto-cancel after 30 seconds if no response
    setTimeout(() => {
      ws.off('message', handler);
      resolve(false);
    }, 30_000);
  });
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

    const slug = storage.loadCurrentProject()?.slug ?? 'default';
    storage.saveProjectSnapshot(slug, {
      trackCount: liveState.trackCount,
      trackNames: liveState.tracks.map((track) => track.name),
      tempo: liveState.tempo,
    });

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
