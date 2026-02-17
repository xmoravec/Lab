from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from functools import lru_cache
from random import choice
from typing import Any, NoReturn, cast

from wordfreq import top_n_list

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
    WordleHintRequest,
    WordleHintResponse,
    WordleMenuResponse,
    WordleRevealAnswerRequest,
    WordleRevealAnswerResponse,
)

MAX_ATTEMPTS = 6
WORD_LENGTH = 5
COMMON_POOL_SIZE = 2000
EXTENDED_POOL_SIZE = 8000
GUESS_POOL_SIZE = 25000
WORD_PATTERN = re.compile(r"^[a-z]{5}$")

FALLBACK_WORDS = [
    "about",
    "angle",
    "apple",
    "badge",
    "beach",
    "blaze",
    "brain",
    "brick",
    "bring",
    "candy",
    "chair",
    "clear",
    "cloud",
    "crane",
    "dance",
    "dream",
    "eager",
    "earth",
    "flame",
    "fresh",
    "giant",
    "glove",
    "grape",
    "green",
    "happy",
    "house",
    "joker",
    "light",
    "magic",
    "metal",
    "music",
    "noble",
    "ocean",
    "panel",
    "party",
    "pearl",
    "plane",
    "pride",
    "quest",
    "quiet",
    "river",
    "royal",
    "shiny",
    "smile",
    "sound",
    "stone",
    "storm",
    "table",
    "tiger",
    "vivid",
    "water",
    "whale",
    "world",
    "zesty",
]

logger = logging.getLogger("uvicorn.error")


class WordleServiceError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(message)


def evaluate_guess(guess: str, target: str) -> list[TileState]:
    result: list[TileState] = [TileState.ABSENT] * len(target)
    remaining_counts: dict[str, int] = {}

    for index, letter in enumerate(target):
        if guess[index] == letter:
            result[index] = TileState.CORRECT
        else:
            remaining_counts[letter] = remaining_counts.get(letter, 0) + 1

    for index, letter in enumerate(guess):
        if result[index] == TileState.CORRECT:
            continue

        available = remaining_counts.get(letter, 0)
        if available > 0:
            result[index] = TileState.PRESENT
            remaining_counts[letter] = available - 1

    return result


def _normalize_words(words: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()

    for raw_word in words:
        normalized = raw_word.strip().lower()
        if normalized in seen:
            continue
        if WORD_PATTERN.match(normalized) is None:
            continue
        seen.add(normalized)
        cleaned.append(normalized)

    return cleaned


def _fallback_result(reason: str) -> tuple[list[str], str, bool, str]:
    fallback = _normalize_words(FALLBACK_WORDS)
    return (
        fallback,
        "fallback",
        True,
        f"Word frequency source unavailable ({reason}). Running in limited dictionary mode.",
    )


@lru_cache(maxsize=1)
def _load_ranked_words() -> tuple[list[str], str, bool, str | None]:
    try:
        ranked = top_n_list("en", EXTENDED_POOL_SIZE * 3)
    except Exception as error:  # noqa: BLE001
        logger.warning("wordfreq top_n_list failed; using fallback list error=%s", error)
        return _fallback_result(type(error).__name__)

    normalized = _normalize_words(ranked)
    if not normalized:
        logger.warning("wordfreq produced no valid 5-letter words; using fallback list")
        return _fallback_result("empty-wordfreq-result")

    return normalized, "wordfreq", False, None


@lru_cache(maxsize=1)
def _word_bank_context() -> dict[str, Any]:
    ranked_words, source, limited_word_bank, notice = _load_ranked_words()

    extended_pool = ranked_words[:EXTENDED_POOL_SIZE]
    common_pool = ranked_words[:COMMON_POOL_SIZE]

    if not common_pool:
        common_pool = ranked_words
    if not extended_pool:
        extended_pool = common_pool

    candidate_guesses = ranked_words[:GUESS_POOL_SIZE] or ranked_words

    return {
        "pools": {
            WordleDifficulty.COMMON: common_pool,
            WordleDifficulty.EXTENDED: extended_pool,
        },
        "allowed_guesses": set(candidate_guesses),
        "source": source,
        "limited_word_bank": limited_word_bank,
        "notice": notice,
    }


def choose_target_word(difficulty: WordleDifficulty) -> str:
    context = _word_bank_context()
    pool = cast(list[str], context["pools"][difficulty])
    return choice(pool)


def is_allowed_guess(guess: str, difficulty: WordleDifficulty) -> bool:
    context = _word_bank_context()
    if difficulty not in context["pools"]:
        return False
    return guess in context["allowed_guesses"]


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
    word_bank_context = _word_bank_context()
    should_include_answer = include_answer or bool(game_document.get("admin_answer_revealed", False))
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
        answer=game_document["target_word"] if should_include_answer else None,
        hint_used=bool(game_document.get("hint_used", False)),
        hint_letter_index=game_document.get("hint_letter_index"),
        hint_letter=game_document.get("hint_letter"),
        admin_answer_revealed=bool(game_document.get("admin_answer_revealed", False)),
        word_bank_source=word_bank_context["source"],
        limited_word_bank=word_bank_context["limited_word_bank"],
        word_bank_notice=word_bank_context["notice"],
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
            limited_word_bank=_word_bank_context()["limited_word_bank"],
            word_bank_notice=_word_bank_context()["notice"],
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

    async def request_hint(self, user_id: str, request: WordleHintRequest) -> WordleHintResponse:
        try:
            game_document = await wordle_repository.get_game(request.game_id, user_id=user_id)
            if game_document is None:
                _raise_service_error(status_code=404, message="Game not found", game_id=request.game_id)

            status = WordleGameStatus(game_document["status"])
            if status != WordleGameStatus.IN_PROGRESS:
                return WordleHintResponse(
                    accepted=False,
                    message="Hints are only available during active games",
                    game=_to_game_state(game_document, include_answer=True),
                )

            if bool(game_document.get("hint_used", False)):
                return WordleHintResponse(
                    accepted=False,
                    message="Hint already used for this game",
                    game=_to_game_state(game_document, include_answer=False),
                )

            revealed_index = choice(list(range(WORD_LENGTH)))
            revealed_letter = str(game_document["target_word"])[revealed_index]
            game_document["hint_used"] = True
            game_document["hint_letter_index"] = revealed_index
            game_document["hint_letter"] = revealed_letter

            await wordle_repository.save_game(game_document)

            return WordleHintResponse(
                accepted=True,
                message=f"Hint: letter {revealed_index + 1} is '{revealed_letter.upper()}'",
                game=_to_game_state(game_document, include_answer=False),
            )
        except WordleServiceError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception(
                "Wordle hint processing failed user_id=%s game_id=%s",
                user_id,
                request.game_id,
            )
            _raise_service_error(status_code=500, message="Unexpected error while generating hint")

    async def reveal_answer(self, user_id: str, request: WordleRevealAnswerRequest) -> WordleRevealAnswerResponse:
        try:
            game_document = await wordle_repository.get_game_for_admin(request.game_id)
            if game_document is None:
                _raise_service_error(status_code=404, message="Game not found", game_id=request.game_id)

            game_document["admin_answer_revealed"] = True
            await wordle_repository.save_game(game_document)

            return WordleRevealAnswerResponse(
                accepted=True,
                message="Answer revealed for admin",
                game=_to_game_state(game_document, include_answer=True),
            )
        except WordleServiceError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception(
                "Wordle admin reveal failed admin_user_id=%s game_id=%s",
                user_id,
                request.game_id,
            )
            _raise_service_error(status_code=500, message="Unexpected error while revealing answer")


wordle_service = WordleService()


async def request_wordle_hint(user_id: str, request: WordleHintRequest) -> WordleHintResponse:
    return await wordle_service.request_hint(user_id=user_id, request=request)


async def reveal_wordle_answer(
    user_id: str,
    request: WordleRevealAnswerRequest,
) -> WordleRevealAnswerResponse:
    return await wordle_service.reveal_answer(user_id=user_id, request=request)
