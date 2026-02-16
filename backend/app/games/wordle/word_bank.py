from __future__ import annotations

import re
from importlib import import_module
from functools import lru_cache
from random import choice

from app.games.wordle.schemas import WordleDifficulty

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


@lru_cache(maxsize=1)
def _load_ranked_words() -> list[str]:
    try:
        wordfreq_module = import_module("wordfreq")
        top_n_list = getattr(wordfreq_module, "top_n_list", None)
        if not callable(top_n_list):
            return _normalize_words(FALLBACK_WORDS)

        ranked = top_n_list("en", EXTENDED_POOL_SIZE * 3)
        if not isinstance(ranked, list):
            return _normalize_words(FALLBACK_WORDS)

        ranked_words = [word for word in ranked if isinstance(word, str)]
        normalized = _normalize_words(ranked_words)
        if normalized:
            return normalized
    except Exception:
        pass

    return _normalize_words(FALLBACK_WORDS)


@lru_cache(maxsize=1)
def get_word_pools() -> dict[WordleDifficulty, list[str]]:
    ranked_words = _load_ranked_words()

    extended_pool = ranked_words[:EXTENDED_POOL_SIZE]
    common_pool = ranked_words[:COMMON_POOL_SIZE]

    if not common_pool:
        common_pool = _normalize_words(FALLBACK_WORDS)
    if not extended_pool:
        extended_pool = common_pool

    return {
        WordleDifficulty.COMMON: common_pool,
        WordleDifficulty.EXTENDED: extended_pool,
    }


@lru_cache(maxsize=1)
def get_allowed_guesses() -> set[str]:
    ranked_words = _load_ranked_words()
    candidate_guesses = ranked_words[:GUESS_POOL_SIZE]
    if not candidate_guesses:
        candidate_guesses = ranked_words

    if not candidate_guesses:
        candidate_guesses = _normalize_words(FALLBACK_WORDS)

    return set(candidate_guesses)


def choose_target_word(difficulty: WordleDifficulty) -> str:
    pool = get_word_pools()[difficulty]
    return choice(pool)


def is_allowed_guess(guess: str, difficulty: WordleDifficulty) -> bool:
    if difficulty not in get_word_pools():
        return False

    return guess in get_allowed_guesses()
