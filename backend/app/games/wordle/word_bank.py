from __future__ import annotations

import logging
import re
from functools import lru_cache
from random import choice
from typing import Any, cast

from wordfreq import top_n_list

from app.games.wordle.schemas import WordleDifficulty

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


def get_word_bank_context() -> dict[str, Any]:
    return _word_bank_context()


def get_words_for_difficulty(difficulty: WordleDifficulty) -> list[str]:
    context = _word_bank_context()
    return cast(list[str], context["pools"][difficulty])