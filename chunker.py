"""
Shared JSON chunking utilities for session_bot Python side.
"""

import json
from collections import defaultdict

async def handle_message_in_chunks(websocket):
    """
    Receive JSON in chunked fragments from a WebSocket and reassemble into a full object.
    """
    partial_messages = defaultdict(lambda: {"chunks": {}, "received": 0, "total": 0})
    try:
        while True:
            raw_data = await websocket.recv()
            chunk_obj = json.loads(raw_data)
            msg_id = chunk_obj["messageId"]
            index = chunk_obj["index"]
            total = chunk_obj["total"]
            data_part = chunk_obj["data"]

            partial = partial_messages[msg_id]
            partial["chunks"][index] = data_part
            partial["received"] += 1
            partial["total"] = total

            if partial["received"] == total:
                # Reassemble
                full_str = "".join(partial["chunks"][i] for i in range(total))
                final_message = json.loads(full_str)
                del partial_messages[msg_id]
                return final_message
    except Exception as e:
        # Caller can handle None or errors
        return None

async def send_json_in_chunks(websocket, message, chunk_size=1000000):
    """
    Send a JSON-serializable object over WebSocket in chunked fragments.
    """
    message_str = json.dumps(message)
    total_length = len(message_str)
    message_id = str(id(message))
    total = (total_length - 1) // chunk_size + 1
    index = 0
    while index < total_length:
        chunk = message_str[index : index + chunk_size]
        payload = {
            "messageId": message_id,
            "index": index // chunk_size,
            "total": total,
            "data": chunk,
        }
        await websocket.send(json.dumps(payload))
        index += chunk_size