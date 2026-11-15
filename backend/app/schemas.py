from __future__ import annotations

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str = Field(pattern="^(system|user|assistant|tool)$")
    content: str = Field(min_length=1, max_length=50000)


class AgentRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    workspace_id: str = Field(default="default", pattern="^[a-zA-Z0-9_-]{1,64}$")
    model: str | None = Field(default=None, max_length=160)
    provider: str = Field(default="openrouter", pattern="^[a-zA-Z0-9_-]{1,40}$")
    mode: str = Field(default="agent", pattern="^(agent|build)$")
    skill: str = Field(default="frontend", max_length=80)
    history: list[Message] = Field(default_factory=list, max_length=40)
