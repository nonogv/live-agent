import { initialize, type ActivationContext, type LiveContext, type WebViewHandle } from "@ableton/live";
import { buildSystemPrompt } from "./agent/chat.js";
import { handleToolCall } from "./live/executor.js";
import { TOOL_SCHEMAS } from "./agent/tools.js";
import { createProvider, type ProviderMessage } from "./providers/index.js";
import { getLiveState } from "./live/executor.js";
const API_VERSION = "1.0";

let ctx: LiveContext;
let webViewHandle: WebViewHandle | null = null;

/** Conversation history, reset when the webview is closed */
const history: ProviderMessage[] = [];

export async function activate(activationContext: ActivationContext): Promise<void> {
  ctx = await initialize(activationContext, API_VERSION);

  console.log("[Live Agent] Extension activated");

  await openPanel();
}

async function openPanel(): Promise<void> {
  if (webViewHandle) {
    // Bring existing panel to front instead of opening a second one
    return;
  }

  webViewHandle = await ctx.ui.showWebView({
    title: "Live Agent",
    url: "ui/index.html",
    width: 420,
    height: 680,
    resizable: true,
  });

  webViewHandle.onMessage(async (raw) => {
    const msg = raw as WebViewMessage;
    await handleWebViewMessage(msg);
  });

  webViewHandle.send({ type: "ready" });
}

// ─── WebView ↔ Extension protocol ────────────────────────────────────────────

type WebViewMessage =
  | { type: "chat"; text: string; provider: string; model: string }
  | { type: "clear_history" }
  | { type: "get_settings" }
  | { type: "save_settings"; keys: Record<string, string>; defaultProvider: string; defaultModel: string };

async function handleWebViewMessage(msg: WebViewMessage): Promise<void> {
  switch (msg.type) {
    case "chat":
      await handleChat(msg.text, msg.provider, msg.model);
      break;

    case "clear_history":
      history.length = 0;
      webViewHandle?.send({ type: "history_cleared" });
      break;

    case "get_settings":
      await sendSettings();
      break;

    case "save_settings":
      await saveSettings(msg.keys, msg.defaultProvider, msg.defaultModel);
      break;
  }
}

async function handleChat(userText: string, providerId: string, model: string): Promise<void> {
  const apiKey = await ctx.storage.get(`apiKey:${providerId}`);
  if (!apiKey) {
    webViewHandle?.send({
      type: "error",
      message: `No API key found for ${providerId}. Add it in Settings.`,
    });
    return;
  }

  const provider = createProvider(providerId, apiKey);
  const liveState = await getLiveState(ctx);
  const systemPrompt = buildSystemPrompt(liveState);

  history.push({ role: "user", content: userText });
  webViewHandle?.send({ type: "stream_start" });

  let assistantContent = "";

  try {
    for await (const chunk of provider.chat({
      model,
      systemPrompt,
      messages: [...history],
      tools: TOOL_SCHEMAS,
    })) {
      if (chunk.type === "text") {
        assistantContent += chunk.text;
        webViewHandle?.send({ type: "stream_chunk", text: chunk.text });
      } else if (chunk.type === "tool_call") {
        webViewHandle?.send({ type: "tool_start", name: chunk.name, args: chunk.args });

        const result = await handleToolCall(ctx, chunk.name, chunk.args);

        webViewHandle?.send({ type: "tool_result", name: chunk.name, result });

        // Feed the tool result back for a follow-up response
        history.push({ role: "assistant", content: assistantContent, toolCall: chunk });
        history.push({ role: "tool", toolCallId: chunk.id, content: JSON.stringify(result) });

        assistantContent = "";
      }
    }

    if (assistantContent) {
      history.push({ role: "assistant", content: assistantContent });
    }

    webViewHandle?.send({ type: "stream_end" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    webViewHandle?.send({ type: "error", message });
    // Remove the user message from history so it can be retried
    history.pop();
  }
}

async function sendSettings(): Promise<void> {
  const [openaiKey, anthropicKey, geminiKey, defaultProvider, defaultModel] = await Promise.all([
    ctx.storage.get("apiKey:openai"),
    ctx.storage.get("apiKey:anthropic"),
    ctx.storage.get("apiKey:gemini"),
    ctx.storage.get("settings:defaultProvider"),
    ctx.storage.get("settings:defaultModel"),
  ]);

  webViewHandle?.send({
    type: "settings",
    keys: {
      openai: openaiKey ? "••••••••" : "",
      anthropic: anthropicKey ? "••••••••" : "",
      gemini: geminiKey ? "••••••••" : "",
    },
    defaultProvider: defaultProvider ?? "openai",
    defaultModel: defaultModel ?? "gpt-4o-mini",
  });
}

async function saveSettings(
  keys: Record<string, string>,
  defaultProvider: string,
  defaultModel: string
): Promise<void> {
  for (const [provider, key] of Object.entries(keys)) {
    if (key && key !== "••••••••") {
      await ctx.storage.set(`apiKey:${provider}`, key);
    }
  }
  await ctx.storage.set("settings:defaultProvider", defaultProvider);
  await ctx.storage.set("settings:defaultModel", defaultModel);

  webViewHandle?.send({ type: "settings_saved" });
}
