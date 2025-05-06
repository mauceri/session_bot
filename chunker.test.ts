import { test, expect } from "bun:test";
import { chunkString, sendJsonInChunks } from "./chunker";
import WebSocket from "ws";

// Dummy WebSocket for testing sendJsonInChunks
class DummyWebSocket {
  sent: string[] = [];
  send(data: string) {
    this.sent.push(data);
  }
}

test("chunkString splits string into correct lengths", () => {
  const str = "abcdefghijklmnopqrstuvwxyz";
  const size = 5;
  const chunks = chunkString(str, size);
  expect(chunks.length).toBe(Math.ceil(str.length / size));
  expect(chunks.join('')).toBe(str);
});

test("sendJsonInChunks sends all fragments and reassembles correctly", async () => {
  const message = { to: "a", from: "b", text: "hello", attachments: [] };
  const ws = new DummyWebSocket();
  await sendJsonInChunks(ws as unknown as WebSocket, message, 4);
  // Reassemble data
  const recombined = ws.sent
    .map((s) => JSON.parse(s).data)
    .join("");
  expect(JSON.parse(recombined)).toEqual(message);
});