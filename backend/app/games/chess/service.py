from __future__ import annotations

import importlib
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, cast

from app.core.database import mongo_manager
from app.games.chess import bot_engine
from app.games.chess.repository import chess_repository
from app.games.chess.schemas import (
    BotDifficulty,
    ChessColor,
    ChessInvitationStatus,
    ChessInvitationSummary,
    ChessMatchState,
    ChessMatchStatus,
    ChessMatchSummary,
    ChessMenuResponse,
    ChessMode,
    ChessMoveRecord,
    InvitationColorPreference,
    RespondChessInvitationResponse,
    StartBotMatchRequest,
    StartChessMatchResponse,
    SubmitChessMoveRequest,
    SubmitChessMoveResponse,
)
from app.services.auth_service import auth_service

try:
    chess: Any | None = importlib.import_module("chess")
except ModuleNotFoundError:
    chess = None


BOT_DIFFICULTY_DEPTH: dict[str, int] = {
    BotDifficulty.EASY.value: 1,
    BotDifficulty.MEDIUM.value: 2,
    BotDifficulty.HARD.value: 3,
}


class ChessServiceError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class ChessService:
    _ALLOWED_TIME_CONTROLS: set[int] = {60, 300, 600, 1500, 3600}
    _BOT_MIN_THINK_SECONDS: int = 5

    @staticmethod
    def _require_chess_engine() -> Any:
        if chess is None:
            raise ChessServiceError(
                status_code=503,
                message="Chess engine dependency is unavailable. Rebuild backend container to install python-chess.",
            )
        return chess

    async def ensure_indexes(self) -> None:
        await chess_repository.ensure_indexes()

    @staticmethod
    def _require_square(value: str) -> int:
        engine = ChessService._require_chess_engine()
        try:
            parsed = engine.parse_square(value.lower())
            return cast(int, parsed)
        except ValueError as error:
            raise ChessServiceError(status_code=400, message=f"Invalid square: {value}") from error

    @staticmethod
    def _board_matrix(board: Any) -> list[list[str]]:
        engine = ChessService._require_chess_engine()
        rows: list[list[str]] = []
        for rank in range(7, -1, -1):
            row: list[str] = []
            for file_index in range(8):
                square = engine.square(file_index, rank)
                piece = board.piece_at(square)
                if piece is None:
                    row.append("")
                    continue
                prefix = "w" if piece.color == engine.WHITE else "b"
                row.append(f"{prefix}{piece.symbol().upper()}")
            rows.append(row)
        return rows

    @staticmethod
    def _to_color_name(value: bool) -> ChessColor:
        engine = ChessService._require_chess_engine()
        return ChessColor.WHITE if value == engine.WHITE else ChessColor.BLACK

    @staticmethod
    def _current_timestamp() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _to_utc_aware(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @staticmethod
    def _normalize_result(value: str) -> Literal["1-0", "0-1", "1/2-1/2", "*"]:
        if value in {"1-0", "0-1", "1/2-1/2", "*"}:
            return cast(Literal["1-0", "0-1", "1/2-1/2", "*"], value)
        return "*"

    def _validate_time_control_seconds(self, value: int) -> int:
        if value not in self._ALLOWED_TIME_CONTROLS:
            raise ChessServiceError(status_code=400, message="Unsupported time control")
        return value

    def _sync_clock_state(self, match_document: dict[str, Any]) -> bool:
        if str(match_document.get("status")) != ChessMatchStatus.ACTIVE.value:
            return False

        turn_color = str(match_document.get("turn_color") or "white")
        time_key = "white_time_remaining_seconds" if turn_color == "white" else "black_time_remaining_seconds"
        current_remaining = int(match_document.get(time_key, 0))

        started_at_raw = match_document.get("clock_started_at")
        if isinstance(started_at_raw, datetime):
            started_at = self._to_utc_aware(started_at_raw)
        else:
            fallback_started_at = cast(datetime, match_document.get("updated_at") or self._current_timestamp())
            started_at = self._to_utc_aware(fallback_started_at)

        now = self._current_timestamp()
        elapsed_seconds = max(0, int((now - started_at).total_seconds()))
        if elapsed_seconds <= 0:
            return False

        next_remaining = max(0, current_remaining - elapsed_seconds)
        match_document[time_key] = next_remaining
        match_document["clock_started_at"] = now
        match_document["updated_at"] = now

        if next_remaining == 0:
            match_document["status"] = ChessMatchStatus.TIMEOUT.value
            if turn_color == "white":
                match_document["result"] = "0-1"
                match_document["winner_user_id"] = match_document.get("black_user_id")
            else:
                match_document["result"] = "1-0"
                match_document["winner_user_id"] = match_document.get("white_user_id")
            return True

        return True

    def _schedule_bot_turn_if_needed(self, *, match_document: dict[str, Any]) -> bool:
        if str(match_document.get("mode")) != ChessMode.BOT.value:
            return False
        if str(match_document.get("status")) != ChessMatchStatus.ACTIVE.value:
            return False

        engine = self._require_chess_engine()
        board = engine.Board(str(match_document["fen"]))
        bot_color = self._bot_color(match_document)
        if bot_color is None or board.turn != bot_color:
            return False

        existing_not_before = match_document.get("bot_move_not_before_at")
        if isinstance(existing_not_before, datetime):
            return False

        now = self._current_timestamp()
        match_document["bot_move_not_before_at"] = now + timedelta(seconds=self._BOT_MIN_THINK_SECONDS)
        match_document["updated_at"] = now
        return True

    async def _advance_bot_turn_if_due(self, *, match_document: dict[str, Any]) -> bool:
        if str(match_document.get("mode")) != ChessMode.BOT.value:
            return False
        if str(match_document.get("status")) != ChessMatchStatus.ACTIVE.value:
            return False

        engine = self._require_chess_engine()
        board = engine.Board(str(match_document["fen"]))
        bot_color = self._bot_color(match_document)
        if bot_color is None or board.turn != bot_color:
            return False

        pending_raw = match_document.get("bot_move_not_before_at")
        if isinstance(pending_raw, datetime):
            pending_until = self._to_utc_aware(pending_raw)
            if self._current_timestamp() < pending_until:
                return False
        else:
            scheduled = self._schedule_bot_turn_if_needed(match_document=match_document)
            if scheduled:
                await chess_repository.save_match(match_document)
                return True

        await self._perform_bot_turn(match_document=match_document)
        return True

    def _to_match_summary(self, match_document: dict[str, Any]) -> ChessMatchSummary:
        return ChessMatchSummary(
            match_id=str(match_document["match_id"]),
            mode=ChessMode(str(match_document["mode"])),
            status=ChessMatchStatus(str(match_document["status"])),
            white_user_id=cast(str | None, match_document.get("white_user_id")),
            white_username=str(match_document["white_username"]),
            black_user_id=cast(str | None, match_document.get("black_user_id")),
            black_username=str(match_document["black_username"]),
            turn_color=ChessColor(str(match_document["turn_color"])),
            result=self._normalize_result(str(match_document.get("result", "*"))),
            winner_user_id=cast(str | None, match_document.get("winner_user_id")),
            time_control_seconds=int(match_document.get("time_control_seconds", 600)),
            white_time_remaining_seconds=int(match_document.get("white_time_remaining_seconds", 600)),
            black_time_remaining_seconds=int(match_document.get("black_time_remaining_seconds", 600)),
            clock_started_at=cast(datetime | None, match_document.get("clock_started_at")),
            created_at=cast(datetime, match_document["created_at"]),
            updated_at=cast(datetime, match_document["updated_at"]),
        )

    @staticmethod
    def _to_invitation_summary(invitation: dict[str, Any]) -> ChessInvitationSummary:
        return ChessInvitationSummary(
            invitation_id=str(invitation["invitation_id"]),
            from_user_id=str(invitation["from_user_id"]),
            from_username=str(invitation["from_username"]),
            to_user_id=str(invitation["to_user_id"]),
            to_username=str(invitation["to_username"]),
            color_preference=InvitationColorPreference(str(invitation["color_preference"])),
            time_control_seconds=int(invitation.get("time_control_seconds", 600)),
            status=ChessInvitationStatus(str(invitation["status"])),
            created_at=cast(datetime, invitation["created_at"]),
            responded_at=cast(datetime | None, invitation.get("responded_at")),
            match_id=cast(str | None, invitation.get("match_id")),
        )

    def _build_match_state(self, *, user_id: str, match_document: dict[str, Any]) -> ChessMatchState:
        engine = self._require_chess_engine()
        fen = str(match_document["fen"])
        board = engine.Board(fen)

        white_user_id = cast(str | None, match_document.get("white_user_id"))
        black_user_id = cast(str | None, match_document.get("black_user_id"))

        my_color: ChessColor | None = None
        if white_user_id == user_id:
            my_color = ChessColor.WHITE
        elif black_user_id == user_id:
            my_color = ChessColor.BLACK

        status = ChessMatchStatus(str(match_document["status"]))
        turn_color = self._to_color_name(board.turn)
        can_submit_moves = bool(
            status == ChessMatchStatus.ACTIVE
            and (
                (turn_color == ChessColor.WHITE and white_user_id == user_id)
                or (turn_color == ChessColor.BLACK and black_user_id == user_id)
            )
        )

        history_rows = cast(list[dict[str, Any]], match_document.get("history", []))
        history = [
            ChessMoveRecord(
                move_number=int(row["move_number"]),
                uci=str(row["uci"]),
                san=str(row["san"]),
                by_color=ChessColor(str(row["by_color"])),
                played_by_user_id=cast(str | None, row.get("played_by_user_id")),
                played_at=cast(datetime, row["played_at"]),
                fen_after=str(row["fen_after"]),
            )
            for row in history_rows
        ]

        return ChessMatchState(
            summary=self._to_match_summary(match_document),
            fen=fen,
            board=self._board_matrix(board),
            legal_moves=[move.uci() for move in board.legal_moves],
            in_check=board.is_check(),
            history=history,
            my_color=my_color,
            can_submit_moves=can_submit_moves,
        )

    @staticmethod
    def _is_admin_allowed_self_invite(*, sender_user_id: str, receiver_user_id: str, is_admin: bool) -> bool:
        if sender_user_id != receiver_user_id:
            return True
        return is_admin

    async def _resolve_user_by_username(self, username: str) -> tuple[str, str]:
        if mongo_manager.db is None:
            raise ChessServiceError(status_code=500, message="Database unavailable")

        document = await mongo_manager.db["users"].find_one({"username": username.strip()})
        if document is None:
            raise ChessServiceError(status_code=404, message="Target user not found")

        user_id_value = document.get("user_id")
        username_value = document.get("username")
        if not isinstance(user_id_value, str) or not user_id_value:
            raise ChessServiceError(status_code=500, message="Target user has invalid account record")
        if not isinstance(username_value, str) or not username_value:
            raise ChessServiceError(status_code=500, message="Target user has invalid account record")

        return user_id_value, username_value

    def _require_user_in_match(self, *, user_id: str, match_document: dict[str, Any]) -> None:
        if user_id not in [match_document.get("white_user_id"), match_document.get("black_user_id")]:
            raise ChessServiceError(status_code=403, message="You are not a participant in this match")

    @staticmethod
    def _bot_color(match_document: dict[str, Any]) -> bool | None:
        engine = ChessService._require_chess_engine()
        if str(match_document.get("mode")) != ChessMode.BOT.value:
            return None

        if match_document.get("white_user_id") is None:
            return cast(bool, engine.WHITE)
        if match_document.get("black_user_id") is None:
            return cast(bool, engine.BLACK)
        return None

    @staticmethod
    def _evaluate_board(*, board: Any, bot_color: bool) -> int:
        return bot_engine.evaluate_board(board=board, bot_color=bot_color)

    @staticmethod
    def _order_moves(board: Any, legal_moves: list[Any]) -> list[Any]:
        return bot_engine.order_moves(board, legal_moves)

    @staticmethod
    def _minimax(*, board: Any, depth: int, alpha: int, beta: int, maximizing: bool, bot_color: bool) -> int:
        return bot_engine.minimax(
            board=board,
            depth=depth,
            alpha=alpha,
            beta=beta,
            maximizing=maximizing,
            bot_color=bot_color,
        )

    @staticmethod
    def _best_capture_or_random_move(board: Any) -> Any:
        try:
            return bot_engine.best_capture_or_random_move(board)
        except ValueError as error:
            raise ChessServiceError(status_code=400, message="No legal bot moves available") from error

    @staticmethod
    def _best_bot_move(board: Any, *, bot_color: bool | None = None, depth: int = 1) -> Any:
        try:
            return bot_engine.best_bot_move(board, bot_color=bot_color, depth=depth)
        except ValueError as error:
            raise ChessServiceError(status_code=400, message="No legal bot moves available") from error

    @staticmethod
    def _apply_match_outcome(*, board: Any, match_document: dict[str, Any]) -> None:
        engine = ChessService._require_chess_engine()
        if board.is_checkmate():
            match_document["status"] = ChessMatchStatus.CHECKMATE.value
            if board.turn == engine.WHITE:
                match_document["result"] = "0-1"
                match_document["winner_user_id"] = match_document.get("black_user_id")
            else:
                match_document["result"] = "1-0"
                match_document["winner_user_id"] = match_document.get("white_user_id")
            return

        if board.is_stalemate():
            match_document["status"] = ChessMatchStatus.STALEMATE.value
            match_document["result"] = "1/2-1/2"
            match_document["winner_user_id"] = None
            return

        if board.is_insufficient_material() or board.can_claim_threefold_repetition() or board.can_claim_fifty_moves():
            match_document["status"] = ChessMatchStatus.DRAW.value
            match_document["result"] = "1/2-1/2"
            match_document["winner_user_id"] = None
            return

        match_document["status"] = ChessMatchStatus.ACTIVE.value
        match_document["result"] = "*"
        match_document["winner_user_id"] = None

    async def get_menu(self, *, user_id: str) -> ChessMenuResponse:
        incoming = await chess_repository.list_incoming_invitations(user_id=user_id)
        outgoing = await chess_repository.list_outgoing_invitations(user_id=user_id)
        active_matches = await chess_repository.list_active_matches_for_user(user_id=user_id)

        synced_matches: list[dict[str, Any]] = []
        for match_document in active_matches:
            changed = self._sync_clock_state(match_document)
            if changed:
                await chess_repository.save_match(match_document)
            synced_matches.append(match_document)

        return ChessMenuResponse(
            incoming_invitations=[self._to_invitation_summary(item) for item in incoming],
            outgoing_invitations=[self._to_invitation_summary(item) for item in outgoing],
            active_matches=[self._to_match_summary(item) for item in synced_matches],
        )

    async def send_invitation(
        self,
        *,
        from_user_id: str,
        from_username: str,
        to_username: str,
        color_preference: InvitationColorPreference,
        time_control_seconds: int,
    ) -> ChessInvitationSummary:
        to_user_id, resolved_to_username = await self._resolve_user_by_username(to_username)
        normalized_time_control = self._validate_time_control_seconds(time_control_seconds)

        is_admin = await auth_service.is_user_admin(from_user_id)
        if not self._is_admin_allowed_self_invite(
            sender_user_id=from_user_id,
            receiver_user_id=to_user_id,
            is_admin=is_admin,
        ):
            raise ChessServiceError(status_code=403, message="Only admins can invite themselves")

        pending = await chess_repository.get_pending_between_users(user_a=from_user_id, user_b=to_user_id)
        if pending is not None:
            raise ChessServiceError(status_code=409, message="A pending invitation already exists")

        invitation = await chess_repository.create_invitation(
            from_user_id=from_user_id,
            from_username=from_username,
            to_user_id=to_user_id,
            to_username=resolved_to_username,
            color_preference=color_preference,
            time_control_seconds=normalized_time_control,
        )
        return self._to_invitation_summary(invitation)

    async def respond_to_invitation(
        self,
        *,
        user_id: str,
        invitation_id: str,
        action: str,
    ) -> RespondChessInvitationResponse:
        invitation = await chess_repository.get_invitation_for_user(invitation_id=invitation_id, user_id=user_id)
        if invitation is None:
            raise ChessServiceError(status_code=404, message="Invitation not found")

        if str(invitation["to_user_id"]) != user_id:
            raise ChessServiceError(status_code=403, message="Only invitation recipient can respond")

        if str(invitation["status"]) != "pending":
            raise ChessServiceError(status_code=409, message="Invitation is no longer pending")

        if action == "decline":
            updated = await chess_repository.respond_to_invitation(
                invitation_id=invitation_id,
                expected_user_id=user_id,
                accepted=False,
                match_id=None,
            )
            if not updated:
                raise ChessServiceError(status_code=409, message="Invitation was updated by another action")

            refreshed = await chess_repository.get_invitation_for_user(invitation_id=invitation_id, user_id=user_id)
            if refreshed is None:
                raise ChessServiceError(status_code=500, message="Failed to refresh invitation")

            return RespondChessInvitationResponse(invitation=self._to_invitation_summary(refreshed), match=None)

        preference = InvitationColorPreference(str(invitation["color_preference"]))
        invitation_time_control = self._validate_time_control_seconds(int(invitation.get("time_control_seconds", 600)))
        engine = self._require_chess_engine()
        assign_inviter_white = random.choice([True, False]) if preference == InvitationColorPreference.RANDOM else (
            preference == InvitationColorPreference.WHITE
        )

        inviter_id = str(invitation["from_user_id"])
        inviter_username = str(invitation["from_username"])
        invitee_username = str(invitation["to_username"])

        if assign_inviter_white:
            white_user_id = inviter_id
            white_username = inviter_username
            black_user_id = user_id
            black_username = invitee_username
        else:
            white_user_id = user_id
            white_username = invitee_username
            black_user_id = inviter_id
            black_username = inviter_username

        match = await chess_repository.create_match(
            mode=ChessMode.MULTIPLAYER.value,
            white_user_id=white_user_id,
            white_username=white_username,
            black_user_id=black_user_id,
            black_username=black_username,
            fen=engine.STARTING_FEN,
            time_control_seconds=invitation_time_control,
        )

        updated = await chess_repository.respond_to_invitation(
            invitation_id=invitation_id,
            expected_user_id=user_id,
            accepted=True,
            match_id=str(match["match_id"]),
        )
        if not updated:
            raise ChessServiceError(status_code=409, message="Invitation was updated by another action")

        refreshed = await chess_repository.get_invitation_for_user(invitation_id=invitation_id, user_id=user_id)
        if refreshed is None:
            raise ChessServiceError(status_code=500, message="Failed to refresh invitation")

        return RespondChessInvitationResponse(
            invitation=self._to_invitation_summary(refreshed),
            match=self._to_match_summary(match),
        )

    async def start_self_play(
        self,
        *,
        user_id: str,
        username: str,
        time_control_seconds: int,
    ) -> StartChessMatchResponse:
        engine = self._require_chess_engine()
        normalized_time_control = self._validate_time_control_seconds(time_control_seconds)
        match = await chess_repository.create_match(
            mode=ChessMode.SELF_PLAY.value,
            white_user_id=user_id,
            white_username=username,
            black_user_id=user_id,
            black_username=username,
            fen=engine.STARTING_FEN,
            time_control_seconds=normalized_time_control,
        )
        return StartChessMatchResponse(match=self._to_match_summary(match))

    async def start_bot_match(
        self,
        *,
        user_id: str,
        username: str,
        payload: StartBotMatchRequest,
    ) -> StartChessMatchResponse:
        engine = self._require_chess_engine()
        normalized_time_control = self._validate_time_control_seconds(payload.time_control_seconds)
        play_as = payload.play_as
        bot_difficulty = payload.bot_difficulty.value
        if play_as == "random":
            play_as = random.choice(["white", "black"])

        if play_as == "white":
            white_user_id = user_id
            white_username = username
            black_user_id = None
            black_username = "Lab Bot"
        else:
            white_user_id = None
            white_username = "Lab Bot"
            black_user_id = user_id
            black_username = username

        match = await chess_repository.create_match(
            mode=ChessMode.BOT.value,
            white_user_id=white_user_id,
            white_username=white_username,
            black_user_id=black_user_id,
            black_username=black_username,
            fen=engine.STARTING_FEN,
            time_control_seconds=normalized_time_control,
            bot_difficulty=bot_difficulty,
        )

        if white_user_id is None:
            scheduled = self._schedule_bot_turn_if_needed(match_document=match)
            if scheduled:
                await chess_repository.save_match(match)

        return StartChessMatchResponse(match=self._to_match_summary(match))

    async def get_match_state(self, *, user_id: str, match_id: str) -> ChessMatchState:
        match_document = await chess_repository.get_match(match_id=match_id)
        if match_document is None:
            raise ChessServiceError(status_code=404, message="Match not found")

        self._require_user_in_match(user_id=user_id, match_document=match_document)
        changed = self._sync_clock_state(match_document)
        bot_changed = await self._advance_bot_turn_if_due(match_document=match_document)

        if bot_changed:
            refreshed = await chess_repository.get_match(match_id=match_id)
            if refreshed is not None:
                match_document = refreshed

        if changed:
            await chess_repository.save_match(match_document)
        return self._build_match_state(user_id=user_id, match_document=match_document)

    async def _perform_bot_turn(self, *, match_document: dict[str, Any]) -> None:
        engine = self._require_chess_engine()
        board = engine.Board(str(match_document["fen"]))
        bot_color = self._bot_color(match_document)
        if bot_color is None:
            return

        if str(match_document.get("status")) != ChessMatchStatus.ACTIVE.value:
            return

        if board.turn != bot_color:
            return

        difficulty_key = str(match_document.get("bot_difficulty") or BotDifficulty.MEDIUM.value)
        bot_depth = BOT_DIFFICULTY_DEPTH.get(difficulty_key, BOT_DIFFICULTY_DEPTH[BotDifficulty.MEDIUM.value])

        bot_move = self._best_bot_move(board=board, bot_color=bot_color, depth=bot_depth)
        san = board.san(bot_move)
        board.push(bot_move)

        history = cast(list[dict[str, Any]], match_document.get("history", []))
        history.append(
            {
                "move_number": len(history) + 1,
                "uci": bot_move.uci(),
                "san": san,
                "by_color": "white" if bot_color == engine.WHITE else "black",
                "played_by_user_id": None,
                "played_at": self._current_timestamp(),
                "fen_after": board.fen(),
            },
        )

        match_document["history"] = history
        match_document["fen"] = board.fen()
        match_document["turn_color"] = "white" if board.turn == engine.WHITE else "black"
        match_document["clock_started_at"] = self._current_timestamp()
        match_document["bot_move_not_before_at"] = None
        self._apply_match_outcome(board=board, match_document=match_document)
        match_document["updated_at"] = self._current_timestamp()
        await chess_repository.save_match(match_document)

    async def submit_move(self, *, user_id: str, payload: SubmitChessMoveRequest) -> SubmitChessMoveResponse:
        engine = self._require_chess_engine()
        match_document = await chess_repository.get_match(match_id=payload.match_id)
        if match_document is None:
            raise ChessServiceError(status_code=404, message="Match not found")

        self._require_user_in_match(user_id=user_id, match_document=match_document)

        if str(match_document["status"]) != ChessMatchStatus.ACTIVE.value:
            raise ChessServiceError(status_code=409, message="Match is already finished")

        changed = self._sync_clock_state(match_document)
        if changed:
            await chess_repository.save_match(match_document)

        if str(match_document["status"]) != ChessMatchStatus.ACTIVE.value:
            raise ChessServiceError(status_code=409, message="Match ended on time")

        board = engine.Board(str(match_document["fen"]))

        mover_is_white = board.turn == engine.WHITE
        expected_user_id = cast(str | None, match_document.get("white_user_id" if mover_is_white else "black_user_id"))
        if expected_user_id is None:
            raise ChessServiceError(status_code=409, message="It is bot turn")
        if expected_user_id != user_id:
            raise ChessServiceError(status_code=403, message="It is not your turn")

        from_square = self._require_square(payload.from_square)
        to_square = self._require_square(payload.to_square)

        promotion = payload.promotion
        if promotion is None:
            piece = board.piece_at(from_square)
            if piece is not None and piece.piece_type == engine.PAWN:
                destination_rank = engine.square_rank(to_square)
                if destination_rank in (0, 7):
                    promotion = "q"

        promotion_piece: int | None = None
        if promotion is not None:
            promotion_lookup = {
                "q": engine.QUEEN,
                "r": engine.ROOK,
                "b": engine.BISHOP,
                "n": engine.KNIGHT,
            }
            promotion_piece = promotion_lookup[promotion]

        move = engine.Move(from_square, to_square, promotion=promotion_piece)
        if move not in board.legal_moves:
            raise ChessServiceError(status_code=400, message="Illegal move")

        san = board.san(move)
        board.push(move)

        history = cast(list[dict[str, Any]], match_document.get("history", []))
        history.append(
            {
                "move_number": len(history) + 1,
                "uci": move.uci(),
                "san": san,
                "by_color": "white" if mover_is_white else "black",
                "played_by_user_id": user_id,
                "played_at": self._current_timestamp(),
                "fen_after": board.fen(),
            },
        )

        match_document["history"] = history
        match_document["fen"] = board.fen()
        match_document["turn_color"] = "white" if board.turn == engine.WHITE else "black"
        match_document["clock_started_at"] = self._current_timestamp()
        self._apply_match_outcome(board=board, match_document=match_document)
        match_document["updated_at"] = self._current_timestamp()

        scheduled_bot = self._schedule_bot_turn_if_needed(match_document=match_document)
        await chess_repository.save_match(match_document)

        refreshed = await chess_repository.get_match(match_id=payload.match_id)
        if refreshed is None:
            raise ChessServiceError(status_code=500, message="Failed to refresh match")

        state = self._build_match_state(user_id=user_id, match_document=refreshed)
        return SubmitChessMoveResponse(
            accepted=True,
            message="Move accepted. Bot is thinking..." if scheduled_bot else "Move accepted.",
            match=state,
        )


chess_service = ChessService()
