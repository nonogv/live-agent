import Anthropic from "@anthropic-ai/sdk";
import type { ProviderAdapter, ChatOptions, StreamChunk, ProviderMessage } from "./index.js";

export class AnthropicProvider implements ProviderAdapter {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *chat(options: ChatOptions): AsyncIterable<StreamChunk> {
    const messages = toAnthropicMessages(options.messages);
    const tools: Anthropic.Tool[] = options.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const stream = this.client.messages.stream({
      model: options.model,
      max_tokens: 4096,
      system: options.systemPrompt,
      messages,
      tools,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text };
        } else if (event.delta.type === "input_json_delta") {
          // Accumulate — handled on content_block_stop
        }
      } else if (event.type === "content_block_stop") {
        const block = (event as unknown as { content_block: Anthropic.ContentBlock }).content_block;
        if (block.type === "tool_use") {
          yield {
            type: "tool_call",
            id: block.id,
            name: block.name,
            args: block.input as Record<string, unknown>,
          };
        }
      }
    }
  }
}

function toAnthropicMessages(messages: ProviderMessage[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    if (m.role === "user") {
      result.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      if (m.toolCall) {
        result.push({
          role: "assistant",
          content: [
            ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
            {
              type: "tool_use" as const,
              id: m.toolCall.id,
              name: m.toolCall.name,
              input: m.toolCall.args,
            },
          ],
        });
      } else {
        result.push({ role: "assistant", content: m.content });
      }
    } else if (m.role === "tool" && m.toolCallId) {
      result.push({
        role: "user",
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: m.toolCallId,
            content: m.content,
          },
        ],
      });
    }
  }

  return result;
}
