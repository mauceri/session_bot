/**
 * Shared JSON chunking utilities for session_bot.
 */

import WebSocket from 'ws';
import { ChunkPayload, FullMessagePayload } from './types';

/**
 * Split a string into chunks of given size.
 */
export function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

/**
 * Send an object as JSON over WebSocket in chunked fragments.
 */
export async function sendJsonInChunks(
  socket: WebSocket,
  messageToSend: FullMessagePayload,
  chunkSize = 256 * 1024
): Promise<void> {
  const fullString = JSON.stringify(messageToSend);
  const chunks = chunkString(fullString, chunkSize);
  const messageId = Date.now().toString();
  for (let index = 0; index < chunks.length; index++) {
    const payload: ChunkPayload = {
      messageId,
      index,
      total: chunks.length,
      data: chunks[index],
    };
    socket.send(JSON.stringify(payload));
  }
}