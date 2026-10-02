/** Shared PLATO/ASHA conversation bounds. Client storage and the server schema use the same numbers. */
export const ASHA_THREAD_STORAGE_LIMIT = 40;
export const ASHA_GATEWAY_HISTORY_LIMIT = 40;
export const ASHA_HISTORY_CONTENT_MAX_CHARS = 8000;
export const ASHA_USER_MESSAGE_MAX_CHARS = 2000;

export interface AshaGatewayHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/** Last N turns, each capped, so a long thread is accepted instead of rejected at the old 20/24 boundary. */
export function toAshaGatewayHistory(
  messages: readonly AshaGatewayHistoryMessage[],
): AshaGatewayHistoryMessage[] {
  return messages.slice(-ASHA_GATEWAY_HISTORY_LIMIT).map(message => ({
    role: message.role,
    content: message.content.slice(0, ASHA_HISTORY_CONTENT_MAX_CHARS),
  }));
}
