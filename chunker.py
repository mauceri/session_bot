"""
Shared JSON chunking utilities for session_bot Python side.
"""

"""
Shared JSON chunking utilities for session_bot Python side with limits.
"""
import json
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

# Limits to prevent resource exhaustion
MAX_CHUNKS = 1000            # Max number of chunks per message
MAX_CHUNK_SIZE = 256 * 1024  # Max size per chunk (256 KB)
MAX_PENDING_MESSAGES = 100   # Max number of messages in progress

async def handle_message_in_chunks(websocket):
    """
    Receive JSON in chunked fragments from a WebSocket and reassemble into a full object.
    """
    partial_messages = defaultdict(lambda: {"chunks": {}, "received": 0, "total": 0})
    try:
        while True:
            raw_data = await websocket.recv()
            # Parse chunk
            try:
                chunk_obj = json.loads(raw_data)
            except json.JSONDecodeError:
                logger.error("Received non-JSON fragment, skipping.")
                continue
            # Validate chunk count
            total = chunk_obj.get("total")
            if not isinstance(total, int) or total < 1 or total > MAX_CHUNKS:
                logger.error(f"Chunk total {total} out of allowed range, rejecting message.")
                return None
            # Validate chunk size
            data_part = chunk_obj.get("data", "")
            if not isinstance(data_part, str) or len(data_part) > MAX_CHUNK_SIZE:
                logger.error(f"Chunk size {len(data_part)} exceeds limit, skipping fragment.")
                continue
            msg_id = chunk_obj.get("messageId")
            index = chunk_obj.get("index")
            # Enforce max pending
            if msg_id not in partial_messages and len(partial_messages) >= MAX_PENDING_MESSAGES:
                logger.error("Too many pending messages, rejecting new message.")
                return None
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
                try:
                    full_str = "".join(partial["chunks"][i] for i in range(total))
                    final_message = json.loads(full_str)
                except Exception as e:
                    logger.error(f"Error reassembling chunks: {e}")
                    del partial_messages[msg_id]
                    return None
                # Cleanup
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