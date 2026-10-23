export interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  /** Base64-encoded image payloads for vision models (user turns). */
  images?: string[];
  thinking?: string;
  tool_calls?: Array<{
    id?: string;
    function: { name: string; arguments: Record<string, unknown> };
  }>;
  tool_name?: string;
  /** OpenAI-style id for tool result messages (llama-server / multi-turn tools). */
  tool_call_id?: string;
}

export type StreamChatChunkType =
  | "thinking"
  | "content"
  | "tool_call"
  | "tool_response";

export interface StreamChatUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface StreamChatResult {
  content: string;
  thinking: string;
  tool_calls: Array<{
    id?: string;
    function: { name: string; arguments: Record<string, unknown> };
  }>;
  /** Present when the provider reported token counts for this completion. */
  usage?: StreamChatUsage;
}

export type CliStreamMetaCallback = (meta: { model?: string }) => void;

export interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: {
      type: "object";
      properties?: Record<
        string,
        {
          type: string;
          description?: string;
          enum?: string[];
        }
      >;
      required?: string[];
    };
  };
}

