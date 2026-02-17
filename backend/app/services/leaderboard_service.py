from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any, TypedDict, cast

from app.core.database import mongo_manager
from app.schemas.leaderboard import GameLeaderboardResponse, LeaderboardEntry


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

        pipeline: list[dict[str, Any]] = [
            {
                "$match": {
                    "$and": [
                        {"user_id": {"$type": "string", "$ne": ""}},
                        {"user_id": {"$not": {"$regex": r"^guest:"}}},
                    ],
                },
            },
            {
                "$group": {
                    "_id": "$user_id",
                    "games_played": {"$sum": 1},
                    "wins": {"$sum": {"$cond": [{"$eq": ["$status", "won"]}, 1, 0]}},
                    "losses": {"$sum": {"$cond": [{"$eq": ["$status", "lost"]}, 1, 0]}},
                    "total_attempts_on_wins": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$status", "won"]},
                                {"$ifNull": ["$attempts_used", 0]},
                                0,
                            ],
                        },
                    },
                    "elo_delta_sum": {
                        "$sum": {
                            "$switch": {
                                "branches": [
                                    {
                                        "case": {"$eq": [{"$ifNull": ["$hint_used", False]}, True]},
                                        "then": 0,
                                    },
                                    {
                                        "case": {"$eq": ["$status", "lost"]},
                                        "then": -3,
                                    },
                                    {
                                        "case": {
                                            "$and": [
                                                {"$eq": ["$status", "won"]},
                                                {"$eq": ["$attempts_used", 1]},
                                            ],
                                        },
                                        "then": 5,
                                    },
                                    {
                                        "case": {
                                            "$and": [
                                                {"$eq": ["$status", "won"]},
                                                {"$eq": ["$attempts_used", 2]},
                                            ],
                                        },
                                        "then": 3,
                                    },
                                    {
                                        "case": {
                                            "$and": [
                                                {"$eq": ["$status", "won"]},
                                                {"$eq": ["$attempts_used", 3]},
                                            ],
                                        },
                                        "then": 1,
                                    },
                                    {
                                        "case": {
                                            "$and": [
                                                {"$eq": ["$status", "won"]},
                                                {"$eq": ["$attempts_used", 4]},
                                            ],
                                        },
                                        "then": 0,
                                    },
                                    {
                                        "case": {
                                            "$and": [
                                                {"$eq": ["$status", "won"]},
                                                {"$eq": ["$attempts_used", 5]},
                                            ],
                                        },
                                        "then": -1,
                                    },
                                    {
                                        "case": {
                                            "$and": [
                                                {"$eq": ["$status", "won"]},
                                                {"$eq": ["$attempts_used", 6]},
                                            ],
                                        },
                                        "then": -2,
                                    },
                                ],
                                "default": 0,
                            },
                        },
                    },
                },
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "_id",
                    "foreignField": "user_id",
                    "as": "user",
                },
            },
            {
                "$unwind": {
                    "path": "$user",
                    "preserveNullAndEmptyArrays": True,
                },
            },
            {
                "$project": {
                    "_id": 0,
                    "user_id": "$_id",
                    "username": {"$ifNull": ["$user.username", "unknown"]},
                    "games_played": 1,
                    "wins": 1,
                    "losses": 1,
                    "total_attempts_on_wins": 1,
                    "elo_delta_sum": 1,
                },
            },
        ]

        typed_pipeline = cast(Sequence[Mapping[str, Any]], pipeline)
        aggregate_rows = await mongo_manager.db["wordle_games"].aggregate(typed_pipeline).to_list(
            length=5000,
        )

        candidates: list[_LeaderboardCandidate] = []
        for row in aggregate_rows:
            games_played = int(row.get("games_played") or 0)
            if games_played == 0:
                continue

            user_id = str(row.get("user_id") or "")
            if not user_id:
                continue

            wins = int(row.get("wins") or 0)
            losses = int(row.get("losses") or 0)
            total_attempts_on_wins = int(row.get("total_attempts_on_wins") or 0)
            elo_delta_sum = int(row.get("elo_delta_sum") or 0)

            win_rate = wins / games_played
            average_attempts = (
                total_attempts_on_wins / wins
                if wins > 0
                else 0.0
            )

            elo_score = 1000 + elo_delta_sum

            candidates.append(
                {
                    "user_id": user_id,
                    "username": str(row.get("username") or "unknown"),
                    "games_played": games_played,
                    "wins": wins,
                    "losses": losses,
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
        del games_played
        del wins
        del losses
        del average_attempts
        return 1000


leaderboard_service = LeaderboardService()
