/**
 * JSON payload types for session_bot communication.
 */

/**
 * Represents a chunk of a JSON message.
 */
export interface ChunkPayload {
  messageId: string;
  index: number;
  total: number;
  data: string;
}

/**
 * Represents an attachment inside a full message.
 */
export interface Attachment {
  name: string;
  type: string;
  content: string; // Base64-encoded data
}

/**
 * Represents the complete message after reassembly.
 */
export interface FullMessagePayload {
  to: string;         // Recipient session ID
  from: string;       // Sender session ID
  text: string;       // Message text
  attachments: Attachment[]; // List of attachments
}