// session_bot_refactored.ts
// Refactoring objet/fonctionnel du bridge Lokinet <-> WebSocket

import { generateSeedHex } from '@session.js/keypair';
import { encode } from '@session.js/mnemonic';
import { Session, ready, Poller } from '@session.js/client';
import path from 'path';
import WebSocket, { WebSocketServer } from 'ws';
import * as fs from 'fs';
import { sequelize, SessionMessage } from './db';

const ROOT_DIR = process.env.ROOT_DIR || "/app";
const client_name = process.env.CLIENT_NAME;

// --------- Utilitaires attachements ---------
export async function bufferToBase64(buffer: any): Promise<string> {
  if (buffer instanceof File) buffer = await buffer.arrayBuffer();
  if (buffer instanceof ArrayBuffer) buffer = Buffer.from(buffer);
  return buffer.toString('base64');
}

export function decodeBase64Content(base64Content: string): string {
  const buffer = Buffer.from(base64Content, 'base64');
  return buffer.toString('utf-8');
}

export function base64ToFile(base64Content: string, fileName: string, mimeType: string): File {
  const binaryString = atob(base64Content);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  const arrayBuffer = bytes.buffer;
  return new File([arrayBuffer], fileName, { type: mimeType });
}

// --------- Utilitaires chunking ---------
export function chunkString(str: string, size: number): string[] {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) chunks.push(str.slice(i, i + size));
  return chunks;
}

// --------- Gestion des fragments de messages ---------
interface PartialMessage {
  chunks: { [key: number]: string };
  received: number;
  total: number;
}

class MessageChunker {
  private partialMessages: { [messageId: string]: PartialMessage } = {};

  async handleChunks(data: string, session: any) {
    const chunkObj = JSON.parse(data);
    const { messageId, index, total, data: chunkData } = chunkObj;
    if (!this.partialMessages[messageId]) {
      this.partialMessages[messageId] = { chunks: {}, received: 0, total: 0 };
    }
    this.partialMessages[messageId].chunks[index] = chunkData;
    this.partialMessages[messageId].received += 1;
    this.partialMessages[messageId].total = total;
    if (this.partialMessages[messageId].received === total) {
      const { chunks } = this.partialMessages[messageId];
      let fullStr = "";
      for (let i = 0; i < total; i++) fullStr += chunks[i];
      const finalMessage = JSON.parse(fullStr);
      const actualMessage = typeof finalMessage === "string" ? JSON.parse(finalMessage) : finalMessage;
      delete this.partialMessages[messageId];
      const { from, text, frombobot, attachments } = actualMessage;
      if (!Array.isArray(attachments)) return;
      const fileAttachments = attachments.map((attachment: any) => base64ToFile(attachment.content, attachment.name, attachment.type));
      const { timestamp, messageHash } = await session.sendMessage({ to: from, text: text, attachments: fileAttachments });
      setTimeout(async () => {
        try {
          await session.deleteMessage({ to: from, timestamp: timestamp, hash: messageHash });
        } catch (error) {}
      }, 24 * 60 * 60 * 1000);
    }
  }
}

export async function sendJsonInChunks(socket: WebSocket, messageToSend: any, chunkSize = 256 * 1024) {
  const fullString = JSON.stringify(messageToSend);
  const chunks = chunkString(fullString, chunkSize);
  const messageId = Date.now().toString();
  chunks.forEach((chunk, index) => {
    const payload = { messageId, index, total: chunks.length, data: chunk };
    socket.send(JSON.stringify(payload));
  });
}

// --------- Gestion du mnémonique ---------
const ensureDataDir = () => {
  if (!fs.existsSync(path.join(ROOT_DIR, 'data'))) {
    fs.mkdirSync(path.join(ROOT_DIR, 'data'), { recursive: true });
  }
};
const configFilePath = path.resolve(ROOT_DIR, 'data', 'session_bot_config.sh');
const sessionIdPath = path.resolve(ROOT_DIR, 'data', 'session_id.txt');

console.log('[DEBUG] ROOT_DIR utilisé :', ROOT_DIR);
console.log('[DEBUG] Chemin complet sessionIdPath :', sessionIdPath);
console.log('[DEBUG] Chemin complet configFilePath :', configFilePath);

export function saveSessionId(sessionId: string) {
  // S'assurer que le dossier existe
  const dir = path.dirname(sessionIdPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(sessionIdPath, sessionId, 'utf8');
}
export function saveMnemonicToConfigFile(mnemonic: string) {
  const envVarEntry = `export SESSION_BOT_MNEMONIC="${mnemonic}"\n`;
  fs.writeFileSync(configFilePath, envVarEntry);
}
export function loadMnemonicFromConfigFile(): string | null {
  if (fs.existsSync(configFilePath)) {
    const content = fs.readFileSync(configFilePath, 'utf-8');
    const match = content.match(/export SESSION_BOT_MNEMONIC="(.+?)"/);
    return match ? match[1] : null;
  }
  return null;
}

// --------- Initialisation principale ---------
async function main() {
  await ready;
  await sequelize.authenticate();
  ensureDataDir();
  let mnemonic = process.env.SESSION_BOT_MNEMONIC || loadMnemonicFromConfigFile();
  if (!mnemonic) {
    mnemonic = encode(generateSeedHex());
    saveMnemonicToConfigFile(mnemonic);
  }
  const session = new Session();
  session.setMnemonic(mnemonic, client_name);
  saveSessionId(session.getSessionID());
  session.addPoller(new Poller());
  await sequelize.sync();
  const chunker = new MessageChunker();
  // WebSocket Server
  const wss = new WebSocketServer({ port: 8089, host: '0.0.0.0' });
  let bobotSocket: WebSocket | null = null;
  wss.on('connection', (ws) => {
    bobotSocket = ws;
    ws.on('message', (data) => chunker.handleChunks(data.toString(), session));
    ws.on('close', () => { bobotSocket = null; });
  });
  session.on('message', async (message) => {
    const messageId = message.id;
    const existingMessage = await SessionMessage.findByPk(messageId);
    if (existingMessage) return;
    await SessionMessage.create({ messageId, timestamp: new Date() });
    const decryptedAttachments = [];
    for (const attachment of message.attachments) {
      const decryptedAttachment = await session.getFile(attachment);
      const base64Content = await bufferToBase64(decryptedAttachment);
      decryptedAttachments.push({ name: decryptedAttachment.name, type: decryptedAttachment.type, content: base64Content });
    }
    if (bobotSocket) {
      // Envoyer le message à bobot.py via WebSocket (chunked)
      // 'to' est l'identifiant de session, 'from' est l'expéditeur
      await sendJsonInChunks(bobotSocket, {
        to: message.from,
        from: session.getSessionID(),
        text: message.text,
        attachments: decryptedAttachments
      });
    }
  });
}

main();
