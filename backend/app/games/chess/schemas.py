from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import Field

from app.schemas.base import CamelModel


class ChessMode(str, Enum):
    MULTIPLAYER = "multiplayer"
    SELF_PLAY = "self-play"
    BOT = "bot"


class ChessColor(str, Enum):
    WHITE = "white"
    BLACK = "black"


class ChessInvitationStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELED = "canceled"


class ChessMatchStatus(str, Enum):
    ACTIVE = "active"
    CHECKMATE = "checkmate"
    STALEMATE = "stalemate"
    DRAW = "draw"
    TIMEOUT = "timeout"


class InvitationColorPreference(str, Enum):
    WHITE = "white"
    BLACK = "black"
    RANDOM = "random"


class ChessMoveRecord(CamelModel):
    move_number: int = Field(ge=1)
    uci: str = Field(min_length=4, max_length=5)
    san: str = Field(min_length=1)
    by_color: ChessColor
    played_by_user_id: str | None = None
    played_at: datetime
    fen_after: str


class ChessMatchSummary(CamelModel):
    match_id: str
    mode: ChessMode
    status: ChessMatchStatus
    white_user_id: str | None = None
    white_username: str
    black_user_id: str | None = None
    black_username: str
    turn_color: ChessColor
    result: Literal["1-0", "0-1", "1/2-1/2", "*"] = "*"
    winner_user_id: str | None = None
    time_control_seconds: int = Field(ge=1)
    white_time_remaining_seconds: int = Field(ge=0)
    black_time_remaining_seconds: int = Field(ge=0)
    clock_started_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ChessMatchState(CamelModel):
    summary: ChessMatchSummary
    fen: str
    board: list[list[str]]
    legal_moves: list[str]
    in_check: bool
    history: list[ChessMoveRecord]
    my_color: ChessColor | None = None
    can_submit_moves: bool


class ChessInvitationSummary(CamelModel):
    invitation_id: str
    from_user_id: str
    from_username: str
    to_user_id: str
    to_username: str
    color_preference: InvitationColorPreference
    time_control_seconds: int = Field(ge=1)
    status: ChessInvitationStatus
    created_at: datetime
    responded_at: datetime | None = None
    match_id: str | None = None


class ChessMenuResponse(CamelModel):
    incoming_invitations: list[ChessInvitationSummary]
    outgoing_invitations: list[ChessInvitationSummary]
    active_matches: list[ChessMatchSummary]


class SendChessInvitationRequest(CamelModel):
    to_username: str = Field(min_length=3, max_length=64)
    color_preference: InvitationColorPreference = InvitationColorPreference.RANDOM
    time_control_seconds: int = 600


class RespondChessInvitationRequest(CamelModel):
    invitation_id: str = Field(min_length=1)
    action: Literal["accept", "decline"]


class RespondChessInvitationResponse(CamelModel):
    invitation: ChessInvitationSummary
    match: ChessMatchSummary | None = None


class StartBotMatchRequest(CamelModel):
    play_as: Literal["white", "black", "random"] = "random"
    time_control_seconds: int = 600


class StartChessMatchResponse(CamelModel):
    match: ChessMatchSummary


class SubmitChessMoveRequest(CamelModel):
    match_id: str = Field(min_length=1)
    from_square: str = Field(min_length=2, max_length=2)
    to_square: str = Field(min_length=2, max_length=2)
    promotion: Literal["q", "r", "b", "n"] | None = None


class SubmitChessMoveResponse(CamelModel):
    accepted: bool
    message: str
    match: ChessMatchState


class ChessAction(str, Enum):
    BOOTSTRAP = "bootstrap"
    SEND_INVITATION = "send-invitation"
    RESPOND_INVITATION = "respond-invitation"
    START_SELF_PLAY = "start-self-play"
    START_BOT = "start-bot"
    LOAD_MATCH = "load-match"
    SUBMIT_MOVE = "submit-move"


class ChessActionRequest(CamelModel):
    action: ChessAction
    to_username: str | None = Field(default=None, min_length=3, max_length=64)
    color_preference: InvitationColorPreference = InvitationColorPreference.RANDOM
    invitation_time_control_seconds: int = 600
    invitation_id: str | None = Field(default=None, min_length=1)
    invitation_response_action: Literal["accept", "decline"] | None = None
    play_as: Literal["white", "black", "random"] = "random"
    time_control_seconds: int = 600
    match_id: str | None = Field(default=None, min_length=1)
    from_square: str | None = Field(default=None, min_length=2, max_length=2)
    to_square: str | None = Field(default=None, min_length=2, max_length=2)
    promotion: Literal["q", "r", "b", "n"] | None = None


class ChessActionResponse(CamelModel):
    action: ChessAction
    menu: ChessMenuResponse | None = None
    invitation: ChessInvitationSummary | None = None
    invitation_response: RespondChessInvitationResponse | None = None
    started_match: StartChessMatchResponse | None = None
    match_state: ChessMatchState | None = None
    move_result: SubmitChessMoveResponse | None = None
