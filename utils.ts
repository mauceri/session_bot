import * as fs from 'fs';
import path from 'path';

const ROOT_DIR = process.env.ROOT_DIR || '/app';

/**
 * Convert ArrayBuffer or File to Base64 string.
 */
export async function bufferToBase64(buffer: any): Promise<string> {
  if (buffer instanceof File) buffer = await buffer.arrayBuffer();
  if (buffer instanceof ArrayBuffer) buffer = Buffer.from(buffer);
  return buffer.toString('base64');
}

/**
 * Decode a Base64 string to UTF-8.
 */
export function decodeBase64Content(base64Content: string): string {
  const buf = Buffer.from(base64Content, 'base64');
  return buf.toString('utf-8');
}

/**
 * Convert a Base64 string to a File object.
 */
export function base64ToFile(base64Content: string, fileName: string, mimeType: string): File {
  const binary = atob(base64Content);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  const arrayBuffer = bytes.buffer;
  return new File([arrayBuffer], fileName, { type: mimeType });
}

/**
 * Ensure that the data directory exists.
 */
export function ensureDataDir(): void {
  const dir = path.join(ROOT_DIR, 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const configFilePath = path.resolve(ROOT_DIR, 'data', 'session_bot_config.sh');
const sessionIdPath = path.resolve(ROOT_DIR, 'data', 'session_id.txt');

/**
 * Save the session ID to file.
 */
export function saveSessionId(sessionId: string): void {
  const dir = path.dirname(sessionIdPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(sessionIdPath, sessionId, 'utf8');
}

/**
 * Save the mnemonic to a config file.
 */
export function saveMnemonicToConfigFile(mnemonic: string): void {
  const entry = `export SESSION_BOT_MNEMONIC=\"${mnemonic}\"\n`;
  fs.writeFileSync(configFilePath, entry);
}

/**
 * Load the mnemonic from the config file, if present.
 */
export function loadMnemonicFromConfigFile(): string | null {
  if (!fs.existsSync(configFilePath)) return null;
  const content = fs.readFileSync(configFilePath, 'utf-8');
  const match = content.match(/export SESSION_BOT_MNEMONIC=\"(.+?)\"/);
  return match ? match[1] : null;
}