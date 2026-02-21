from __future__ import annotations

import random
from typing import Any

PIECE_VALUES: dict[int, int] = {
    1: 1,
    2: 3,
    3: 3,
    4: 5,
    5: 9,
    6: 100,
}


def evaluate_board(*, board: Any, bot_color: bool) -> int:
    if board.is_checkmate():
        return -100_000 if board.turn == bot_color else 100_000
    if board.is_stalemate() or board.is_insufficient_material() or board.can_claim_draw():
        return 0

    score = 0
    piece_map = board.piece_map()
    for piece in piece_map.values():
        value = PIECE_VALUES.get(piece.piece_type, 0)
        if piece.color == bot_color:
            score += value
        else:
            score -= value
    return score


def order_moves(board: Any, legal_moves: list[Any]) -> list[Any]:
    ordered: list[tuple[int, Any]] = []
    for move in legal_moves:
        priority = 0
        if board.is_capture(move):
            priority += 100
            if board.is_en_passant(move):
                priority += PIECE_VALUES[1]
            else:
                target_piece = board.piece_at(move.to_square)
                if target_piece is not None:
                    priority += PIECE_VALUES.get(target_piece.piece_type, 0)

        board.push(move)
        if board.is_checkmate():
            priority += 10_000
        elif board.is_check():
            priority += 50
        board.pop()

        ordered.append((priority, move))

    ordered.sort(key=lambda row: row[0], reverse=True)
    return [row[1] for row in ordered]


def minimax(*, board: Any, depth: int, alpha: int, beta: int, maximizing: bool, bot_color: bool) -> int:
    if depth <= 0 or board.is_game_over(claim_draw=True):
        return evaluate_board(board=board, bot_color=bot_color)

    legal_moves = list(board.legal_moves)
    ordered_moves = order_moves(board, legal_moves)

    if maximizing:
        best_value = -1_000_000
        for move in ordered_moves:
            board.push(move)
            value = minimax(
                board=board,
                depth=depth - 1,
                alpha=alpha,
                beta=beta,
                maximizing=False,
                bot_color=bot_color,
            )
            board.pop()

            if value > best_value:
                best_value = value
            if value > alpha:
                alpha = value
            if beta <= alpha:
                break
        return best_value

    best_value = 1_000_000
    for move in ordered_moves:
        board.push(move)
        value = minimax(
            board=board,
            depth=depth - 1,
            alpha=alpha,
            beta=beta,
            maximizing=True,
            bot_color=bot_color,
        )
        board.pop()

        if value < best_value:
            best_value = value
        if value < beta:
            beta = value
        if beta <= alpha:
            break
    return best_value


def best_capture_or_random_move(board: Any) -> Any:
    legal_moves = list(board.legal_moves)
    if not legal_moves:
        raise ValueError("No legal bot moves available")

    for move in legal_moves:
        board.push(move)
        is_mate = board.is_checkmate()
        board.pop()
        if is_mate:
            return move

    best_capture_score = -1
    best_captures: list[Any] = []
    for move in legal_moves:
        capture_score = 0
        if board.is_capture(move):
            if board.is_en_passant(move):
                capture_score = PIECE_VALUES[1]
            else:
                target_piece = board.piece_at(move.to_square)
                if target_piece is not None:
                    capture_score = PIECE_VALUES.get(target_piece.piece_type, 0)

        if capture_score > best_capture_score:
            best_capture_score = capture_score
            best_captures = [move]
        elif capture_score == best_capture_score:
            best_captures.append(move)

    if best_captures:
        return random.choice(best_captures)
    return random.choice(legal_moves)


def best_bot_move(board: Any, *, bot_color: bool | None = None, depth: int = 1) -> Any:
    legal_moves = list(board.legal_moves)
    if not legal_moves:
        raise ValueError("No legal bot moves available")

    if bot_color is None:
        bot_color = board.turn

    for move in legal_moves:
        board.push(move)
        is_mate = board.is_checkmate()
        board.pop()
        if is_mate:
            return move

    if depth <= 1:
        return best_capture_or_random_move(board)

    ordered_moves = order_moves(board, legal_moves)
    best_score = -1_000_000
    best_moves: list[Any] = []

    for move in ordered_moves:
        board.push(move)
        score = minimax(
            board=board,
            depth=depth - 1,
            alpha=-1_000_000,
            beta=1_000_000,
            maximizing=False,
            bot_color=bot_color,
        )
        board.pop()

        if score > best_score:
            best_score = score
            best_moves = [move]
        elif score == best_score:
            best_moves.append(move)

    if best_moves:
        return random.choice(best_moves)
    return random.choice(legal_moves)