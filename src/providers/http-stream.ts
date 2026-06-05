/**
 * Minimal streaming HTTPS client built on node:https.
 * No globals needed — uses only Node.js built-ins.
 */

import https from 'node:https';
import http from 'node:http';

/** Parse `retryDelay` seconds from a Gemini/Google 429 error body. */
function parseRetryDelay(body: string): number {
  const m = body.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  return m ? parseInt(m[1], 10) : 60;
}

export interface HttpChunk {
  type: 'text' | 'tool_call';
  text?: string;
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  /** Gemini thinking models attach this to every functionCall; must be round-tripped. */
  thoughtSignature?: string;
}

export type HttpChunkStream = AsyncGenerator<HttpChunk, void, unknown>;

interface ReqOptions {
  hostname: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Make a streaming HTTPS POST and yield raw SSE/NDJSON lines. Retries once on 429. */
async function* streamLines(opts: ReqOptions): AsyncGenerator<string> {
  try {
    yield* streamLinesRaw(opts);
  } catch (err) {
    if (err instanceof Error && 'retryAfterMs' in err) {
      const delay = (err as Error & { retryAfterMs: number }).retryAfterMs;
      await new Promise<void>((r) => setTimeout(r, delay));
      yield* streamLinesRaw(opts);
    } else {
      throw err;
    }
  }
}

async function* streamLinesRaw(opts: ReqOptions): AsyncGenerator<string> {
  const bodyStr = JSON.stringify(opts.body);

  const reqOpts: https.RequestOptions = {
    hostname: opts.hostname,
    path: opts.path,
    method: opts.method,
    headers: {
      ...opts.headers,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr).toString(),
    },
  };

  const lines: string[] = [];
  let resolve: (() => void) | null = null;
  let done = false;
  let error: Error | null = null;

  const req = https.request(reqOpts, (res: http.IncomingMessage) => {
    let buf = '';

    res.on('data', (chunk: Buffer) => {
      buf += chunk.toString();
      const parts = buf.split('\n');
      buf = parts.pop() ?? '';
      for (const line of parts) {
        lines.push(line);
      }
      resolve?.();
    });

    res.on('end', () => {
      if (buf) lines.push(buf);

      const status = res.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        // Collect everything buffered so far into a readable error message.
        const body = lines
          .join('\n')
          .replace(/^data: /gm, '')
          .trim();
        if (status === 429) {
          const delaySec = parseRetryDelay(body);
          error = Object.assign(new Error(`Rate-limited — retrying in ${delaySec}s`), {
            retryAfterMs: delaySec * 1000,
          });
        } else {
          error = new Error(`HTTP ${status}: ${body.slice(0, 500)}`);
        }
      }

      done = true;
      resolve?.();
    });

    res.on('error', (err: Error) => {
      error = err;
      done = true;
      resolve?.();
    });
  });

  req.on('error', (err: Error) => {
    error = err;
    done = true;
    resolve?.();
  });

  req.write(bodyStr);
  req.end();

  while (true) {
    while (lines.length > 0) {
      yield lines.shift()!;
    }
    if (done) break;
    await new Promise<void>((r) => {
      resolve = r;
    });
    resolve = null;
  }

  if (error) throw error;
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

interface OAIToolCallDelta {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

export async function* openaiStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ProviderMsg[],
  tools: ToolSchema[],
): HttpChunkStream {
  const oaiMessages = buildOAIMessages(systemPrompt, messages);

  const body = {
    model,
    messages: oaiMessages,
    tools: tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    stream: true,
  };

  const partialCalls: Record<number, { id: string; name: string; args: string }> = {};

  for await (const line of streamLines({
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  })) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') break;

    let chunk: {
      choices: Array<{
        delta: { content?: string; tool_calls?: OAIToolCallDelta[] };
        finish_reason?: string;
      }>;
    };
    try {
      chunk = JSON.parse(data);
    } catch {
      continue;
    }

    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.content) yield { type: 'text', text: delta.content };

    for (const tc of delta.tool_calls ?? []) {
      if (!partialCalls[tc.index]) {
        partialCalls[tc.index] = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' };
      }
      const pc = partialCalls[tc.index];
      if (tc.id) pc.id = tc.id;
      if (tc.function?.name) pc.name = tc.function.name;
      if (tc.function?.arguments) pc.args += tc.function.arguments;
    }

    if (chunk.choices?.[0]?.finish_reason === 'tool_calls') {
      for (const pc of Object.values(partialCalls)) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(pc.args);
        } catch {
          /* leave empty */
        }
        yield { type: 'tool_call', id: pc.id, name: pc.name, args };
      }
    }
  }
}

// ── Anthropic ────────────────────────────────────────────────────────────────

export async function* anthropicStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ProviderMsg[],
  tools: ToolSchema[],
): HttpChunkStream {
  const body = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: buildAnthropicMessages(messages),
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    })),
    stream: true,
  };

  let currentToolId = '';
  let currentToolName = '';
  let currentToolArgs = '';

  for await (const line of streamLines({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  })) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();

    let ev: {
      type: string;
      index?: number;
      delta?: { type: string; text?: string; partial_json?: string };
      content_block?: { type: string; id?: string; name?: string };
    };
    try {
      ev = JSON.parse(data);
    } catch {
      continue;
    }

    if (ev.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
      currentToolId = ev.content_block.id ?? '';
      currentToolName = ev.content_block.name ?? '';
      currentToolArgs = '';
    } else if (ev.type === 'content_block_delta') {
      if (ev.delta?.type === 'text_delta' && ev.delta.text) {
        yield { type: 'text', text: ev.delta.text };
      } else if (ev.delta?.type === 'input_json_delta' && ev.delta.partial_json) {
        currentToolArgs += ev.delta.partial_json;
      }
    } else if (ev.type === 'content_block_stop' && currentToolName) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(currentToolArgs);
      } catch {
        /* leave empty */
      }
      yield { type: 'tool_call', id: currentToolId, name: currentToolName, args };
      currentToolName = '';
      currentToolArgs = '';
    }
  }
}

// ── Google Gemini ────────────────────────────────────────────────────────────

export async function* geminiStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ProviderMsg[],
  tools: ToolSchema[],
): HttpChunkStream {
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: buildGeminiContents(messages),
    tools: [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ],
  };

  let jsonBuf = '';

  for await (const line of streamLines({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
    method: 'POST',
    headers: {},
    body,
  })) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    jsonBuf += data;

    let chunk: {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            thought?: boolean;
            functionCall?: {
              name: string;
              args: Record<string, unknown>;
              thought_signature?: string;
            };
          }>;
        };
      }>;
    };
    try {
      chunk = JSON.parse(jsonBuf);
      jsonBuf = '';
    } catch {
      continue;
    }

    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      // Skip internal "thought" text parts — they're reasoning traces, not output.
      if (part.thought) continue;
      if (part.text) yield { type: 'text', text: part.text };
      if (part.functionCall) {
        yield {
          type: 'tool_call',
          id: `gemini-${Date.now()}`,
          name: part.functionCall.name,
          args: part.functionCall.args,
          thoughtSignature: part.functionCall.thought_signature,
        };
      }
    }
  }
}

// ── Shared types & helpers ───────────────────────────────────────────────────

export interface ProviderMsg {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCall?: {
    id: string;
    name: string;
    args: Record<string, unknown>;
    /** Gemini thinking models attach this; must be echoed back in multi-turn requests. */
    thoughtSignature?: string;
  };
  toolCallId?: string;
  /** Name of the tool that produced this result (required by Gemini's functionResponse). */
  toolName?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

function buildOAIMessages(systemPrompt: string, messages: ProviderMsg[]): unknown[] {
  const result: unknown[] = [{ role: 'system', content: systemPrompt }];
  for (const m of messages) {
    if (m.role === 'assistant' && m.toolCall) {
      result.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: [
          {
            id: m.toolCall.id,
            type: 'function',
            function: { name: m.toolCall.name, arguments: JSON.stringify(m.toolCall.args) },
          },
        ],
      });
    } else if (m.role === 'tool') {
      result.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    } else {
      result.push({ role: m.role, content: m.content });
    }
  }
  return result;
}

function buildAnthropicMessages(messages: ProviderMsg[]): unknown[] {
  const result: unknown[] = [];
  for (const m of messages) {
    if (m.role === 'assistant' && m.toolCall) {
      result.push({
        role: 'assistant',
        content: [
          ...(m.content ? [{ type: 'text', text: m.content }] : []),
          { type: 'tool_use', id: m.toolCall.id, name: m.toolCall.name, input: m.toolCall.args },
        ],
      });
    } else if (m.role === 'tool') {
      result.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
      });
    } else {
      result.push({ role: m.role, content: m.content });
    }
  }
  return result;
}

function buildGeminiContents(messages: ProviderMsg[]): unknown[] {
  // Gemini thinking models require every functionCall to carry a thought_signature.
  // History entries from older sessions or non-thinking runs won't have it.
  // Build an allow-list of tool-call IDs that do have a signature; skip the rest
  // (both the call and its paired result) to avoid INVALID_ARGUMENT errors.
  const validIds = new Set<string>();
  for (const m of messages) {
    if (m.role === 'assistant' && m.toolCall?.id && m.toolCall.thoughtSignature) {
      validIds.add(m.toolCall.id);
    }
  }

  const result: unknown[] = [];
  for (const m of messages) {
    if (m.role === 'assistant' && m.toolCall) {
      if (!m.toolCall.thoughtSignature) {
        // No signature — keep any text the assistant said, but drop the call.
        if (m.content) result.push({ role: 'model', parts: [{ text: m.content }] });
        continue;
      }
      const fc: Record<string, unknown> = {
        name: m.toolCall.name,
        args: m.toolCall.args,
        thought_signature: m.toolCall.thoughtSignature,
      };
      result.push({ role: 'model', parts: [{ functionCall: fc }] });
      continue;
    }
    if (m.role === 'tool') {
      // Skip results whose call was dropped above.
      if (m.toolCallId && !validIds.has(m.toolCallId)) continue;
      result.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: m.toolName ?? m.toolCallId ?? '',
              response: { content: m.content },
            },
          },
        ],
      });
      continue;
    }
    result.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
  }
  return result;
}
