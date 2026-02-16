from __future__ import annotations

from app.games.wordle.schemas import TileState


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
