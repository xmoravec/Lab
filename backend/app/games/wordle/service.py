from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, NoReturn

from app.games.wordle.evaluator import evaluate_guess
from app.games.wordle.repository import wordle_repository
from app.games.wordle.schemas import (
    GuessEvaluation,
    GuessRecord,
    GuessWordleRequest,
    GuessWordleResponse,
    StartWordleRequest,
    StartWordleResponse,
    TileState,
    WordleDifficulty,
    WordleGameState,
    WordleGameStatus,
    WordleMenuResponse,
)
from app.games.wordle.word_bank import WORD_LENGTH, choose_target_word, is_allowed_guess

MAX_ATTEMPTS = 6
logger = logging.getLogger("uvicorn.error")


class WordleServiceError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(message)


def _rejected_guess_response(
    *,
    game_document: dict[str, Any],
    message: str,
    guess: str,
) -> GuessWordleResponse:
    logger.warning(
        "Wordle guess rejected game_id=%s guess=%s reason=%s",
        game_document["game_id"],
        guess,
        message,
    )
    return GuessWordleResponse(
        accepted=False,
        message=message,
        game=_to_game_state(game_document, include_answer=False),
    )


def _raise_service_error(
    *,
    status_code: int,
    message: str,
    game_id: str | None = None,
    guess: str | None = None,
) -> NoReturn:
    logger.warning(
        "Wordle validation error status=%s message=%s game_id=%s guess=%s",
        status_code,
        message,
        game_id,
        guess,
    )
    raise WordleServiceError(status_code=status_code, message=message)


def _to_game_state(game_document: dict[str, Any], include_answer: bool) -> WordleGameState:
    board = [
        GuessRecord(
            guess=attempt["guess"],
            submitted_at=attempt["submitted_at"],
            evaluations=[
                GuessEvaluation(letter=evaluation["letter"], state=TileState(evaluation["state"]))
                for evaluation in attempt["evaluations"]
            ],
        )
        for attempt in game_document["attempts"]
    ]

    return WordleGameState(
        game_id=game_document["game_id"],
        difficulty=WordleDifficulty(game_document["difficulty"]),
        status=WordleGameStatus(game_document["status"]),
        max_attempts=game_document["max_attempts"],
        attempts_used=game_document["attempts_used"],
        word_length=game_document["word_length"],
        board=board,
        started_at=game_document["started_at"],
        completed_at=game_document["completed_at"],
        answer=game_document["target_word"] if include_answer else None,
    )


class WordleService:
    async def get_menu(self, user_id: str) -> WordleMenuResponse:
        try:
            active_game_document = await wordle_repository.get_latest_in_progress(user_id=user_id)
            history_documents = await wordle_repository.list_recent_finished_games(user_id=user_id)
        except Exception:  # noqa: BLE001
            logger.exception("Wordle menu query failed user_id=%s", user_id)
            _raise_service_error(status_code=500, message="Failed to load Wordle menu")

        active_game = (
            _to_game_state(active_game_document, include_answer=False)
            if active_game_document is not None
            else None
        )

        previous_games = [
            _to_game_state(
                game_document,
                include_answer=game_document["status"] != WordleGameStatus.IN_PROGRESS.value,
            )
            for game_document in history_documents
        ]

        return WordleMenuResponse(
            available_difficulties=[WordleDifficulty.COMMON, WordleDifficulty.EXTENDED],
            active_game=active_game,
            previous_games=previous_games,
        )

    async def start_game(self, user_id: str, request: StartWordleRequest) -> StartWordleResponse:
        try:
            if not request.force_new:
                in_progress = await wordle_repository.get_latest_in_progress(user_id=user_id)
                if in_progress is not None:
                    return StartWordleResponse(
                        resumed_existing=True,
                        game=_to_game_state(in_progress, include_answer=False),
                    )

            target_word = choose_target_word(request.difficulty)
            game_document = await wordle_repository.create_game(
                user_id=user_id,
                difficulty=request.difficulty,
                target_word=target_word,
                max_attempts=MAX_ATTEMPTS,
                word_length=WORD_LENGTH,
            )
        except Exception:  # noqa: BLE001
            logger.exception(
                "Wordle start failed user_id=%s difficulty=%s",
                user_id,
                request.difficulty.value,
            )
            _raise_service_error(status_code=500, message="Failed to start Wordle game")

        return StartWordleResponse(
            resumed_existing=False,
            game=_to_game_state(game_document, include_answer=False),
        )

    async def submit_guess(self, user_id: str, request: GuessWordleRequest) -> GuessWordleResponse:
        try:
            game_document = await wordle_repository.get_game(request.game_id, user_id=user_id)
            if game_document is None:
                _raise_service_error(
                    status_code=404,
                    message="Game not found",
                    game_id=request.game_id,
                )

            status = WordleGameStatus(game_document["status"])
            if status != WordleGameStatus.IN_PROGRESS:
                return GuessWordleResponse(
                    accepted=False,
                    message="This game is already finished",
                    game=_to_game_state(game_document, include_answer=True),
                )

            guess = request.guess.strip().lower()
            if len(guess) != WORD_LENGTH or not guess.isalpha():
                return _rejected_guess_response(
                    game_document=game_document,
                    message="Guess must be a five-letter word",
                    guess=guess,
                )

            difficulty = WordleDifficulty(game_document["difficulty"])
            if not is_allowed_guess(guess, difficulty):
                return _rejected_guess_response(
                    game_document=game_document,
                    message="Word not found in allowed word list",
                    guess=guess,
                )

            evaluations = evaluate_guess(guess, game_document["target_word"])
            attempt = {
                "guess": guess,
                "submitted_at": datetime.now(timezone.utc),
                "evaluations": [
                    {"letter": letter, "state": state.value}
                    for letter, state in zip(guess, evaluations, strict=True)
                ],
            }

            game_document["attempts"].append(attempt)
            game_document["attempts_used"] = len(game_document["attempts"])

            message = "Keep going"
            if guess == game_document["target_word"]:
                game_document["status"] = WordleGameStatus.WON.value
                game_document["completed_at"] = datetime.now(timezone.utc)
                message = "You solved it"
            elif game_document["attempts_used"] >= game_document["max_attempts"]:
                game_document["status"] = WordleGameStatus.LOST.value
                game_document["completed_at"] = datetime.now(timezone.utc)
                message = "No attempts left"

            await wordle_repository.save_game(game_document)

            solved_or_done = game_document["status"] != WordleGameStatus.IN_PROGRESS.value
            return GuessWordleResponse(
                accepted=True,
                message=message,
                game=_to_game_state(game_document, include_answer=solved_or_done),
            )
        except WordleServiceError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception(
                "Wordle guess processing failed user_id=%s game_id=%s guess=%s",
                user_id,
                request.game_id,
                request.guess,
            )
            _raise_service_error(status_code=500, message="Unexpected error while evaluating guess")


wordle_service = WordleService()
