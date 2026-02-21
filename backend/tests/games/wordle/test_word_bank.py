# pyright: reportMissingImports=false

from __future__ import annotations

import pytest  # type: ignore[import-not-found]

from app.games.wordle.schemas import WordleDifficulty  # type: ignore[import-not-found]
from app.games.wordle.word_bank import get_word_bank_context, get_words_for_difficulty  # type: ignore[import-not-found]


@pytest.mark.games
def test_word_bank_provides_valid_five_letter_words() -> None:
    context = get_word_bank_context()
    common_words = get_words_for_difficulty(WordleDifficulty.COMMON)
    extended_words = get_words_for_difficulty(WordleDifficulty.EXTENDED)

    assert context["source"] in {"wordfreq", "fallback"}
    assert common_words
    assert extended_words
    assert all(len(word) == 5 and word.isalpha() and word == word.lower() for word in common_words[:100])
