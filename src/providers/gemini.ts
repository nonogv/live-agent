import { GoogleGenerativeAI, type FunctionDeclaration, type Part } from "@google/generative-ai";
import type { ProviderAdapter, ChatOptions, StreamChunk, ProviderMessage } from "./index.js";

export class GeminiProvider implements ProviderAdapter {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async *chat(options: ChatOptions): AsyncIterable<StreamChunk> {
    const tools: FunctionDeclaration[] = options.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as unknown as FunctionDeclaration["parameters"],
    }));

    const model = this.genAI.getGenerativeModel({
      model: options.model,
      systemInstruction: options.systemPrompt,
      tools: [{ functionDeclarations: tools }],
    });

    const { history, lastUserMessage } = toGeminiHistory(options.messages);

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastUserMessage);

    for await (const chunk of result.stream) {
      const candidate = chunk.candidates?.[0];
      if (!candidate) continue;

      for (const part of candidate.content.parts) {
        if ("text" in part && part.text) {
          yield { type: "text", text: part.text };
        } else if ("functionCall" in part && part.functionCall) {
          yield {
            type: "tool_call",
            id: `gemini-${Date.now()}`,
            name: part.functionCall.name,
            args: (part.functionCall.args ?? {}) as Record<string, unknown>,
          };
        }
      }
    }
  }
}

interface GeminiHistory {
  history: Array<{ role: string; parts: Part[] }>;
  lastUserMessage: string;
}

function toGeminiHistory(messages: ProviderMessage[]): GeminiHistory {
  const history: GeminiHistory["history"] = [];

  // All messages except the last user message go into history
  const allButLast = messages.slice(0, -1);
  const lastMessage = messages[messages.length - 1];

  for (const m of allButLast) {
    if (m.role === "user") {
      history.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant") {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      if (m.toolCall) {
        parts.push({
          functionCall: {
            name: m.toolCall.name,
            args: m.toolCall.args,
          },
        });
      }
      history.push({ role: "model", parts });
    } else if (m.role === "tool" && m.toolCallId) {
      history.push({
        role: "function",
        parts: [{ functionResponse: { name: m.toolCallId, response: { result: m.content } } }],
      });
    }
  }

  return {
    history,
    lastUserMessage: lastMessage?.content ?? "",
  };
}
