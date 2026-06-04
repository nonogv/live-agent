import OpenAI from "openai";
import type { ProviderAdapter, ChatOptions, StreamChunk, ProviderMessage } from "./index.js";

export class OpenAIProvider implements ProviderAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async *chat(options: ChatOptions): AsyncIterable<StreamChunk> {
    const messages = toOpenAIMessages(options.systemPrompt, options.messages);
    const tools = options.tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages,
      tools,
      tool_choice: "auto",
      stream: true,
    });

    let pendingToolCall: { id: string; name: string; argsJson: string } | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        yield { type: "text", text: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index === 0 && tc.id) {
            if (pendingToolCall) {
              yield {
                type: "tool_call",
                id: pendingToolCall.id,
                name: pendingToolCall.name,
                args: JSON.parse(pendingToolCall.argsJson || "{}"),
              };
            }
            pendingToolCall = {
              id: tc.id,
              name: tc.function?.name ?? "",
              argsJson: tc.function?.arguments ?? "",
            };
          } else if (pendingToolCall && tc.function?.arguments) {
            pendingToolCall.argsJson += tc.function.arguments;
          }
        }
      }

      if (chunk.choices[0]?.finish_reason === "tool_calls" && pendingToolCall) {
        yield {
          type: "tool_call",
          id: pendingToolCall.id,
          name: pendingToolCall.name,
          args: JSON.parse(pendingToolCall.argsJson || "{}"),
        };
        pendingToolCall = null;
      }
    }
  }
}

function toOpenAIMessages(
  systemPrompt: string,
  messages: ProviderMessage[]
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const m of messages) {
    if (m.role === "user") {
      result.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      if (m.toolCall) {
        result.push({
          role: "assistant",
          content: m.content || null,
          tool_calls: [
            {
              id: m.toolCall.id,
              type: "function",
              function: {
                name: m.toolCall.name,
                arguments: JSON.stringify(m.toolCall.args),
              },
            },
          ],
        });
      } else {
        result.push({ role: "assistant", content: m.content });
      }
    } else if (m.role === "tool" && m.toolCallId) {
      result.push({
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content,
      });
    }
  }

  return result;
}
