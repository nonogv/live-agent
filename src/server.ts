import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { WebSocketServer, WebSocket } from "ws";
import type { Song } from "@ableton-extensions/sdk";
import type { Storage } from "./storage.js";
import { buildSystemPrompt } from "./agent/chat.js";
import { getLiveState, handleToolCall } from "./live/executor.js";
import { executeGeneratedTool } from "./live/generated-executor.js";
import { GENERATED_TOOL_SCHEMAS } from "./agent/generated-tools.js";
import { CUSTOM_TOOL_SCHEMAS } from "./agent/tools.js";
import { createProvider, type ProviderMessage } from "./providers/index.js";

const ALL_TOOL_SCHEMAS = [...CUSTOM_TOOL_SCHEMAS, ...GENERATED_TOOL_SCHEMAS];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface LiveAgentServer {
  port: number;
  close(): void;
}

export async function startServer(getSong: () => Song<"1.0.0">, storage: Storage): Promise<LiveAgentServer> {
  const history: ProviderMessage[] = [];

  const httpServer = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      const htmlPath = path.join(__dirname, "ui", "index.html");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(htmlPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws) => {
    console.log("[Live Agent] UI connected");

    ws.send(JSON.stringify({ type: "ready" }));

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WebViewMessage;
        handleMessage(ws, msg, getSong, storage, history).catch((err) => {
          ws.send(JSON.stringify({ type: "error", message: String(err) }));
        });
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      }
    });

    ws.on("close", () => console.log("[Live Agent] UI disconnected"));
  });

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address() as { port: number };

  console.log(`[Live Agent] Server listening on http://127.0.0.1:${address.port}`);

  return {
    port: address.port,
    close: () => httpServer.close(),
  };
}

// ─── Message types ────────────────────────────────────────────────────────────

type WebViewMessage =
  | { type: "chat"; text: string; provider: string; model: string }
  | { type: "clear_history" }
  | { type: "get_settings" }
  | { type: "save_settings"; keys: Record<string, string>; defaultProvider: string; defaultModel: string }
  | { type: "clear_key"; provider: string }
  | { type: "open_url"; url: string }
  | { type: "console_log"; level: string; message: string };

async function handleMessage(
  ws: WebSocket,
  msg: WebViewMessage,
  getSong: () => Song<"1.0.0">,
  storage: Storage,
  history: ProviderMessage[]
): Promise<void> {
  switch (msg.type) {
    case "chat":
      await handleChat(ws, msg.text, msg.provider, msg.model, getSong, storage, history);
      break;

    case "clear_history":
      history.length = 0;
      ws.send(JSON.stringify({ type: "history_cleared" }));
      break;

    case "get_settings":
      ws.send(
        JSON.stringify({
          type: "settings",
          keys: storage.getMaskedKeys(),
          defaultProvider: storage.getDefaultProvider(),
          defaultModel: storage.getDefaultModel(),
        })
      );
      break;

    case "save_settings":
      for (const [provider, key] of Object.entries(msg.keys)) {
        if (key && key !== "••••••••") {
          storage.setApiKey(provider, key);
        }
      }
      storage.setDefaults(msg.defaultProvider, msg.defaultModel);
      ws.send(JSON.stringify({ type: "settings_saved" }));
      break;

    case "clear_key":
      storage.setApiKey(msg.provider, "");
      ws.send(JSON.stringify({ type: "key_cleared", provider: msg.provider }));
      break;

    case "open_url": {
      const url = msg.url;
      if (url.startsWith("https://")) {
        const cmd = process.platform === "win32" ? `start "" "${url}"` : `open "${url}"`;
        exec(cmd, (err) => { if (err) console.error("[Live Agent] Failed to open URL:", err); });
      }
      break;
    }

    case "console_log":
      console.log(`[WebView:${msg.level}] ${msg.message}`);
      break;
  }
}

async function handleChat(
  ws: WebSocket,
  userText: string,
  providerId: string,
  model: string,
  getSong: () => Song<"1.0.0">,
  storage: Storage,
  history: ProviderMessage[]
): Promise<void> {
  const apiKey = storage.getApiKey(providerId);
  if (!apiKey) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: `No API key found for ${providerId}. Add it in Settings.`,
      })
    );
    return;
  }

  const provider = createProvider(providerId, apiKey);
  const song = getSong();
  const liveState = getLiveState(song);
  const systemPrompt = buildSystemPrompt(liveState);

  history.push({ role: "user", content: userText });
  ws.send(JSON.stringify({ type: "stream_start" }));

  let assistantContent = "";

  try {
    for await (const chunk of provider.chat({
      model,
      systemPrompt,
      messages: [...history],
      tools: ALL_TOOL_SCHEMAS,
    })) {
      if (chunk.type === "text") {
        assistantContent += chunk.text;
        ws.send(JSON.stringify({ type: "stream_chunk", text: chunk.text }));
      } else if (chunk.type === "tool_call") {
        ws.send(JSON.stringify({ type: "tool_start", name: chunk.name, args: chunk.args }));

        const result = await executeGeneratedTool(song, chunk.name, chunk.args)
          .catch(() => handleToolCall(song, chunk.name, chunk.args));

        ws.send(JSON.stringify({ type: "tool_result", name: chunk.name, result }));

        history.push({
          role: "assistant",
          content: assistantContent,
          toolCall: chunk,
        });
        history.push({
          role: "tool",
          toolCallId: chunk.id,
          content: JSON.stringify(result),
        });

        assistantContent = "";
      }
    }

    if (assistantContent) {
      history.push({ role: "assistant", content: assistantContent });
    }

    ws.send(JSON.stringify({ type: "stream_end" }));
  } catch (err) {
    console.error("[Live Agent] Chat error:", err);
    const message = err instanceof Error ? err.message : String(err);
    ws.send(JSON.stringify({ type: "error", message }));
    history.pop();
  }
}
