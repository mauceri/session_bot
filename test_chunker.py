#!/usr/bin/env python3
"""
Simple non-regression tests for chunker.py
"""
import asyncio
import json
import sys

from chunker import handle_message_in_chunks, send_json_in_chunks

class DummyWebSocket:
    def __init__(self, messages):
        self._messages = messages.copy()
        self.sent = []

    async def recv(self):
        return self._messages.pop(0)

    async def send(self, data):
        self.sent.append(data)

async def test_handle_message_in_chunks():
    message = {"foo": "bar", "nums": [1, 2, 3]}
    s = json.dumps(message)
    size = 4
    total = (len(s) - 1) // size + 1
    chunks = []
    for i in range(total):
        part = s[i*size:(i+1)*size]
        chunks.append(json.dumps({
            "messageId": "1",
            "index": i,
            "total": total,
            "data": part
        }))
    ws = DummyWebSocket(chunks)
    result = await handle_message_in_chunks(ws)
    assert result == message, f"Expected {message}, got {result}"
    print("handle_message_in_chunks passed")

async def test_send_json_in_chunks():
    message = {"hello": "world"}
    ws = DummyWebSocket([])
    await send_json_in_chunks(ws, message, 5)
    # Reassemble
    recomb = ''.join(json.loads(m)["data"] for m in ws.sent)
    assert json.loads(recomb) == message, f"Expected {message}, got {json.loads(recomb)}"
    print("send_json_in_chunks passed")

async def main():
    await test_handle_message_in_chunks()
    await test_send_json_in_chunks()

if __name__ == '__main__':
    asyncio.run(main())
    sys.exit(0)