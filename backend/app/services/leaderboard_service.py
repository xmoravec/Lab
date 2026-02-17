from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TypedDict

from app.core.database import mongo_manager
from app.schemas.leaderboard import GameLeaderboardResponse, LeaderboardEntry


@dataclass
class _WordleAggregate:
    user_id: str
    games_played: int = 0
    wins: int = 0
    losses: int = 0
    total_attempts_on_wins: int = 0


class _LeaderboardCandidate(TypedDict):
    user_id: str
    username: str
    games_played: int
    wins: int
    losses: int
    win_rate: float
    average_attempts: float
    elo_score: int


class LeaderboardServiceError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class LeaderboardService:
    async def get_game_leaderboard(self, game_slug: str, limit: int = 50) -> GameLeaderboardResponse:
        if game_slug != "wordle":
            raise LeaderboardServiceError(status_code=404, message="Leaderboard for game not found")

        if mongo_manager.db is None:
            raise LeaderboardServiceError(status_code=500, message="Database unavailable")

        wordle_games = await mongo_manager.db["wordle_games"].find({}).to_list(length=5000)
        users = await mongo_manager.db["users"].find({}, {"_id": 0, "user_id": 1, "username": 1}).to_list(
            length=5000,
        )

        user_name_map = {str(item["user_id"]): str(item.get("username") or "unknown") for item in users}

        aggregates: dict[str, _WordleAggregate] = defaultdict(lambda: _WordleAggregate(user_id=""))
        for game in wordle_games:
            user_id_value = game.get("user_id")
            if not isinstance(user_id_value, str) or not user_id_value:
                continue

            aggregate = aggregates[user_id_value]
            if not aggregate.user_id:
                aggregate.user_id = user_id_value

            aggregate.games_played += 1
            status = str(game.get("status") or "")
            attempts_used = int(game.get("attempts_used") or 0)
            if status == "won":
                aggregate.wins += 1
                aggregate.total_attempts_on_wins += attempts_used
            elif status == "lost":
                aggregate.losses += 1

        candidates: list[_LeaderboardCandidate] = []
        for user_id, aggregate in aggregates.items():
            if aggregate.games_played == 0:
                continue

            win_rate = aggregate.wins / aggregate.games_played
            average_attempts = (
                aggregate.total_attempts_on_wins / aggregate.wins
                if aggregate.wins > 0
                else 0.0
            )

            elo_score = self._calculate_elo_score(
                games_played=aggregate.games_played,
                wins=aggregate.wins,
                losses=aggregate.losses,
                average_attempts=average_attempts,
            )

            candidates.append(
                {
                    "user_id": user_id,
                    "username": user_name_map.get(user_id, "unknown"),
                    "games_played": aggregate.games_played,
                    "wins": aggregate.wins,
                    "losses": aggregate.losses,
                    "win_rate": round(win_rate, 4),
                    "average_attempts": round(average_attempts, 2),
                    "elo_score": elo_score,
                },
            )

        candidates.sort(
            key=lambda entry: (
                entry["elo_score"],
                entry["wins"],
                entry["win_rate"],
                -entry["average_attempts"],
            ),
            reverse=True,
        )

        ranked_entries = [
            LeaderboardEntry(
                rank=index + 1,
                user_id=entry["user_id"],
                username=entry["username"],
                games_played=entry["games_played"],
                wins=entry["wins"],
                losses=entry["losses"],
                win_rate=entry["win_rate"],
                average_attempts=entry["average_attempts"],
                elo_score=entry["elo_score"],
            )
            for index, entry in enumerate(candidates[:limit])
        ]

        return GameLeaderboardResponse(
            game_slug=game_slug,
            generated_at=datetime.now(timezone.utc),
            entries=ranked_entries,
        )

    @staticmethod
    def _calculate_elo_score(*, games_played: int, wins: int, losses: int, average_attempts: float) -> int:
        base_score = 1000
        win_component = wins * 32
        loss_component = losses * 10
        volume_bonus = min(games_played, 100) * 2
        attempts_penalty = int(max(average_attempts - 3.5, 0) * 18)
        return base_score + win_component + volume_bonus - loss_component - attempts_penalty


leaderboard_service = LeaderboardService()
