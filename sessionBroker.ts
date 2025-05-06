import { generateSeedHex } from '@session.js/keypair';
import { encode } from '@session.js/mnemonic';
import { Session, ready, Poller } from '@session.js/client';
import path from 'path';
import WebSocket, { WebSocketServer } from 'ws';
import * as fs from 'fs';
import { sequelize, SessionMessage } from './db';
import { chunkString, sendJsonInChunks } from './chunker';
import { validateChunkPayload } from './validator';
import { ChunkPayload, Attachment } from './types';
import {
  bufferToBase64,
  base64ToFile,
  ensureDataDir,
  saveSessionId,
  saveMnemonicToConfigFile,
  loadMnemonicFromConfigFile,
} from './utils';

interface PartialMessage {
  chunks: { [key: number]: string };
  received: number;
  total: number;
}

class MessageChunker {
  private partialMessages: { [messageId: string]: PartialMessage } = {};

  async handleChunks(data: string, session: Session) {
    // Parse and validate incoming chunk
    const chunkObj = JSON.parse(data) as ChunkPayload;
    if (!validateChunkPayload(chunkObj)) {
      console.error('Invalid chunk payload:', validateChunkPayload.errors);
      return;
    }
    const { messageId, index, total, data: chunkData } = chunkObj;
    if (!this.partialMessages[messageId]) {
      this.partialMessages[messageId] = { chunks: {}, received: 0, total: 0 };
    }
    const partial = this.partialMessages[messageId];
    partial.chunks[index] = chunkData;
    partial.received += 1;
    partial.total = total;
    if (partial.received === total) {
      // Reassemble
      let fullStr = '';
      for (let i = 0; i < total; i++) fullStr += partial.chunks[i];
      delete this.partialMessages[messageId];
      const finalMessage = JSON.parse(fullStr);
      const actualMessage = typeof finalMessage === 'string' ? JSON.parse(finalMessage) : finalMessage;
      const { from, text, attachments } = actualMessage as {
        from: string;
        text: string;
        attachments: Attachment[];
      };
      if (!Array.isArray(attachments)) return;
      const fileAttachments = attachments.map((att) => base64ToFile(att.content, att.name, att.type));
      const { timestamp, messageHash } = await session.sendMessage({ to: from, text, attachments: fileAttachments });
      setTimeout(async () => {
        try {
          await session.deleteMessage({ to: from, timestamp, hash: messageHash });
        } catch {}
      }, 24 * 60 * 60 * 1000);
    }
  }
}

/**
 * Start the session broker: Session.js client + WebSocket server + chunker.
 */
export async function startBroker(): Promise<void> {
  await ready;
  await sequelize.authenticate();
  ensureDataDir();
  let mnemonic = process.env.SESSION_BOT_MNEMONIC || loadMnemonicFromConfigFile();
  if (!mnemonic) {
    mnemonic = encode(generateSeedHex());
    saveMnemonicToConfigFile(mnemonic);
  }
  const session = new Session();
  session.setMnemonic(mnemonic, process.env.CLIENT_NAME);
  saveSessionId(session.getSessionID());
  session.addPoller(new Poller());
  await sequelize.sync();
  const chunker = new MessageChunker();
  // WebSocket server
  const wss = new WebSocketServer({ port: 8089, host: '0.0.0.0' });
  console.log('✅ WebSocket Server démarré sur', wss.address());
  let bobotSocket: WebSocket | null = null;
  wss.on('connection', (ws) => {
    console.log('Nouveau client WebSocket connecté.');
    bobotSocket = ws;
    ws.on('message', (data) => chunker.handleChunks(data.toString(), session));
    ws.on('close', (code, reason) => {
      console.log('Client WebSocket déconnecté.', code, reason);
      bobotSocket = null;
    });
    ws.on('error', (err) => console.error('Erreur WebSocket:', err));
  });
  // Handle outgoing Session messages
  session.on('message', async (message) => {
    const messageId = message.id;
    const existing = await SessionMessage.findByPk(messageId);
    if (existing) return;
    await SessionMessage.create({ messageId, timestamp: new Date() });
    const decryptedAttachments: Attachment[] = [];
    for (const att of message.attachments) {
      const decrypted = await session.getFile(att);
      const content = await bufferToBase64(decrypted);
      decryptedAttachments.push({ name: decrypted.name, type: decrypted.type, content });
    }
    if (bobotSocket) {
      await sendJsonInChunks(bobotSocket, {
        to: message.from,
        from: session.getSessionID(),
        text: message.text,
        attachments: decryptedAttachments,
      });
    }
  });
}