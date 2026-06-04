# backend/app/schemas/channel.py
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChannelReplyResponse(BaseModel):
    id: UUID
    post_id: UUID
    author_user_id: UUID
    author_name: str
    body: str
    edited_at: datetime | None
    created_at: datetime
    is_deleted: bool

    model_config = {"from_attributes": True}


class ChannelPostResponse(BaseModel):
    id: UUID
    org_unit_id: UUID
    author_user_id: UUID
    author_name: str
    title: str
    body: str
    is_pinned: bool
    is_institutional_highlight: bool
    reply_count: int
    edited_at: datetime | None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool

    model_config = {"from_attributes": True}


class ChannelPostDetailResponse(ChannelPostResponse):
    replies: list[ChannelReplyResponse]


class ChannelPostListResponse(BaseModel):
    posts: list[ChannelPostResponse]
    total: int


class ChannelSettingsResponse(BaseModel):
    org_unit_id: UUID
    channel_post_mode: str
    can_post: bool
    can_moderate: bool


class CreatePostRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=1, max_length=5000)


class EditPostRequest(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=200)
    body: str | None = Field(None, min_length=1, max_length=5000)


class CreateReplyRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class EditReplyRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class DeleteContentRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)
