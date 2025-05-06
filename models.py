"""
Pydantic models for session_bot JSON payloads.
"""
from pydantic import BaseModel, Field
from typing import List

class ChunkPayload(BaseModel):
    """Represents a fragment of a JSON message."""
    messageId: str
    index: int
    total: int
    data: str

class Attachment(BaseModel):
    """Represents a file attachment in a message."""
    name: str
    type: str
    content: str  # Base64-encoded data

class FullMessagePayload(BaseModel):
    """Represents the full reassembled message to process."""
    to: str
    from_: str = Field(..., alias='from')
    text: str
    attachments: List[Attachment]

    class Config:
        allow_population_by_field_name = True
        schema_extra = {
            "example": {
                "to": "session123",
                "from": "session456",
                "text": "Hello",
                "attachments": [
                    {"name": "file.pdf", "type": "application/pdf", "content": "...base64..."}
                ]
            }
        }