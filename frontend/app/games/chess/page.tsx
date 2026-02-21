"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchChessMatch,
  fetchChessMenu,
  respondChessInvitation,
  sendChessInvitation,
  startChessBot,
  startChessSelfPlay,
  submitChessMove,
  type BotDifficulty,
  type ChessColor,
  type ChessInvitationSummary,
  type ChessMatchState,
  type ChessMatchSummary,
  type InvitationColorPreference,
} from "@/app/games/chess/lib/api";
import { ApiRequestError } from "@/lib/http-client";
import { loadSoundEnabled, saveSoundEnabled, unlockAudioContext } from "@/lib/sound/audio";
import { playChessSound } from "@/lib/sound/game-sounds";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const TIME_CONTROL_OPTIONS = [60, 300, 600, 1500, 3600] as const;
const PIECE_IMAGE_PATHS: Record<string, string> = {
  wK: "/assets/chess/pieces/wK.svg",
  wQ: "/assets/chess/pieces/wQ.svg",
  wR: "/assets/chess/pieces/wR.svg",
  wB: "/assets/chess/pieces/wB.svg",
  wN: "/assets/chess/pieces/wN.svg",
  wP: "/assets/chess/pieces/wP.svg",
  bK: "/assets/chess/pieces/bK.svg",
  bQ: "/assets/chess/pieces/bQ.svg",
  bR: "/assets/chess/pieces/bR.svg",
  bB: "/assets/chess/pieces/bB.svg",
  bN: "/assets/chess/pieces/bN.svg",
  bP: "/assets/chess/pieces/bP.svg",
};

const PIECE_CAPTURE_ORDER = ["Q", "R", "B", "N", "P"] as const;

const INITIAL_PIECE_COUNTS: Record<ChessColor, Record<string, number>> = {
  white: { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 },
  black: { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 },
};

const PIECE_MATERIAL_VALUES: Record<string, number> = {
  Q: 9,
  R: 5,
  B: 3,
  N: 3,
  P: 1,
};
const CHESS_SOUND_SETTING_KEY = "lab:chess:sounds";

type BotPlayAs = "white" | "black" | "random";
type ViewMode = "menu" | "game";
type BoardSize = "large" | "compact";

type CaptureMaterialSummary = {
  capturedByWhite: string[];
  capturedByBlack: string[];
  whiteMaterialPoints: number;
  blackMaterialPoints: number;
};

type PlayerStripProps = {
  color: ChessColor;
  username: string;
  clockSeconds: number;
  isTurn: boolean;
  capturedPieces: string[];
  materialLead: number;
};

function squareName(rankIndex: number, fileIndex: number): string {
  const file = FILES[fileIndex];
  const rank = 8 - rankIndex;
  return `${file}${rank}`;
}

function isLightSquare(rankIndex: number, fileIndex: number): boolean {
  return (rankIndex + fileIndex) % 2 === 0;
}

function colorLabel(color: ChessColor): string {
  return color === "white" ? "White" : "Black";
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getPieceColor(piece: string): ChessColor | null {
  if (piece.startsWith("w")) {
    return "white";
  }
  if (piece.startsWith("b")) {
    return "black";
  }
  return null;
}

function squareFromDisplayCoords(rankIndex: number, fileIndex: number, flipped: boolean): string {
  const sourceRank = flipped ? 7 - rankIndex : rankIndex;
  const sourceFile = flipped ? 7 - fileIndex : fileIndex;
  return squareName(sourceRank, sourceFile);
}

function parseSquare(square: string): { rankIndex: number; fileIndex: number } {
  const fileIndex = FILES.indexOf(square[0] ?? "a");
  const rank = Number(square[1] ?? "8");
  const rankIndex = 8 - rank;
  return {
    rankIndex,
    fileIndex,
  };
}

function findKingSquare(board: string[][], color: ChessColor): string | null {
  const needle = color === "white" ? "wK" : "bK";
  for (let rankIndex = 0; rankIndex < board.length; rankIndex += 1) {
    const rank = board[rankIndex];
    for (let fileIndex = 0; fileIndex < rank.length; fileIndex += 1) {
      if (rank[fileIndex] === needle) {
        return squareName(rankIndex, fileIndex);
      }
    }
  }
  return null;
}

function pieceType(piece: string): string | null {
  const value = piece[1] ?? "";
  if (["K", "Q", "R", "B", "N", "P"].includes(value)) {
    return value;
  }
  return null;
}

function toPieceName(piece: string): string {
  const color = piece.startsWith("w") ? "White" : "Black";
  const kind = pieceType(piece);
  const typeLabel =
    kind === "K"
      ? "King"
      : kind === "Q"
        ? "Queen"
        : kind === "R"
          ? "Rook"
          : kind === "B"
            ? "Bishop"
            : kind === "N"
              ? "Knight"
              : "Pawn";
  return `${color} ${typeLabel}`;
}

function getPieceAssetPath(piece: string): string | null {
  return PIECE_IMAGE_PATHS[piece] ?? null;
}

function buildCaptureMaterialSummary(board: string[][]): CaptureMaterialSummary {
  const currentCounts: Record<ChessColor, Record<string, number>> = {
    white: { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 },
    black: { K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0 },
  };

  for (const row of board) {
    for (const squarePiece of row) {
      if (!squarePiece) {
        continue;
      }
      const color = getPieceColor(squarePiece);
      const kind = pieceType(squarePiece);
      if (!color || !kind) {
        continue;
      }
      currentCounts[color][kind] += 1;
    }
  }

  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];
  let whiteMaterialPoints = 0;
  let blackMaterialPoints = 0;

  for (const type of PIECE_CAPTURE_ORDER) {
    const missingBlack = Math.max(0, INITIAL_PIECE_COUNTS.black[type] - currentCounts.black[type]);
    for (let index = 0; index < missingBlack; index += 1) {
      capturedByWhite.push(`b${type}`);
      whiteMaterialPoints += PIECE_MATERIAL_VALUES[type] ?? 0;
    }

    const missingWhite = Math.max(0, INITIAL_PIECE_COUNTS.white[type] - currentCounts.white[type]);
    for (let index = 0; index < missingWhite; index += 1) {
      capturedByBlack.push(`w${type}`);
      blackMaterialPoints += PIECE_MATERIAL_VALUES[type] ?? 0;
    }
  }

  return {
    capturedByWhite,
    capturedByBlack,
    whiteMaterialPoints,
    blackMaterialPoints,
  };
}

function PlayerStrip({
  color,
  username,
  clockSeconds,
  isTurn,
  capturedPieces,
  materialLead,
}: PlayerStripProps): ReactElement {
  return (
    <div
      className={`mx-auto flex w-full max-w-160 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
        isTurn
          ? "border-amber-400/70 bg-amber-500/15 text-amber-100"
          : "border-zinc-700 bg-zinc-950/70 text-zinc-200"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {username} · {colorLabel(color)}
        </p>
        <div className="mt-1 flex min-h-5 items-center gap-1">
          {capturedPieces.length === 0 ? (
            <span className="text-xs text-zinc-400">No captures yet</span>
          ) : (
            capturedPieces.map((piece, index) => {
              const imagePath = getPieceAssetPath(piece);
              if (!imagePath) {
                return null;
              }
              return (
                <span key={`${piece}-${index}`} className="relative h-4.5 w-4.5">
                  <Image src={imagePath} alt={toPieceName(piece)} fill sizes="18px" className="object-contain" />
                </span>
              );
            })
          )}
          {materialLead > 0 ? <span className="ml-2 text-xs font-semibold text-emerald-300">+{materialLead}</span> : null}
        </div>
      </div>
      <span className="shrink-0 font-semibold tracking-wider">{formatClock(clockSeconds)}</span>
    </div>
  );
}

function gameStatusLabel(state: ChessMatchState): string {
  const status = state.summary.status;
  if (status === "active") {
    return state.inCheck
      ? `In progress · ${colorLabel(state.summary.turnColor)} to move (check)`
      : `In progress · ${colorLabel(state.summary.turnColor)} to move`;
  }
  if (status === "checkmate") {
    return `Checkmate · Result ${state.summary.result}`;
  }
  if (status === "timeout") {
    return `Time elapsed · Result ${state.summary.result}`;
  }
  if (status === "stalemate") {
    return "Stalemate · Draw";
  }
  return `Draw · ${state.summary.result}`;
}

function movePieceLabelFromSan(san: string): string {
  if (san.startsWith("O-O")) {
    return "K";
  }

  const firstChar = san[0] ?? "";
  if (["K", "Q", "R", "B", "N"].includes(firstChar)) {
    return firstChar;
  }

  return "P";
}

function classifyChessMoveSound(san: string):
  | "move"
  | "capture"
  | "check"
  | "castle"
  | "game-end" {
  if (san.includes("#")) {
    return "game-end";
  }
  if (san.startsWith("O-O")) {
    return "castle";
  }
  if (san.includes("+")) {
    return "check";
  }
  if (san.includes("x")) {
    return "capture";
  }
  return "move";
}

export default function ChessPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("menu");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [notice, setNotice] = useState("Choose a mode and press Play.");
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [incomingInvitations, setIncomingInvitations] = useState<ChessInvitationSummary[]>([]);
  const [outgoingInvitations, setOutgoingInvitations] = useState<ChessInvitationSummary[]>([]);
  const [activeMatches, setActiveMatches] = useState<ChessMatchSummary[]>([]);

  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [match, setMatch] = useState<ChessMatchState | null>(null);

  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteColorPreference, setInviteColorPreference] =
    useState<InvitationColorPreference>("random");
  const [botPlayAs, setBotPlayAs] = useState<BotPlayAs>("random");
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const [boardSize, setBoardSize] = useState<BoardSize>("large");
  const [timeControlSeconds, setTimeControlSeconds] = useState<number>(600);

  const [isSendingInvitation, setIsSendingInvitation] = useState(false);
  const [isRespondingInvitation, setIsRespondingInvitation] = useState(false);
  const [isStartingSelfPlay, setIsStartingSelfPlay] = useState(false);
  const [isStartingBot, setIsStartingBot] = useState(false);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);

  const [selectedFromSquare, setSelectedFromSquare] = useState<string | null>(null);
  const [deniedSquare, setDeniedSquare] = useState<string | null>(null);
  const [invalidSquare, setInvalidSquare] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState<number>(Date.now());
  const [stableClock, setStableClock] = useState<{ white: number; black: number }>({
    white: 0,
    black: 0,
  });
  const moveSoundTrackerRef = useRef<{ matchId: string | null; historyLength: number }>({
    matchId: null,
    historyLength: 0,
  });
  const statusSoundTrackerRef = useRef<{ matchId: string | null; status: string | null }>({
    matchId: null,
    status: null,
  });

  useEffect(() => {
    setSoundEnabled(loadSoundEnabled(CHESS_SOUND_SETTING_KEY));
  }, []);

  const setSoundPreference = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    saveSoundEnabled(CHESS_SOUND_SETTING_KEY, enabled);
    if (enabled) {
      void unlockAudioContext();
      playChessSound("select", true);
    }
  }, []);

  const legalMovesSet = useMemo(() => new Set(match?.legalMoves ?? []), [match?.legalMoves]);
  const selectedMoveTargets = useMemo(() => {
    if (!selectedFromSquare || !match) {
      return new Set<string>();
    }

    const targets = new Set<string>();
    for (const uciMove of match.legalMoves) {
      if (!uciMove.startsWith(selectedFromSquare)) {
        continue;
      }

      const toSquare = uciMove.slice(2, 4);
      if (toSquare.length === 2) {
        targets.add(toSquare);
      }
    }
    return targets;
  }, [match, selectedFromSquare]);

  const refreshMenu = useCallback(async (): Promise<void> => {
    const menu = await fetchChessMenu();
    setIncomingInvitations(menu.incomingInvitations);
    setOutgoingInvitations(menu.outgoingInvitations);
    setActiveMatches(menu.activeMatches);
  }, []);

  const loadMatch = useCallback(async (matchId: string): Promise<void> => {
    const nextMatch = await fetchChessMatch(matchId);
    setMatch(nextMatch);
    setSelectedFromSquare(null);
    setViewMode("game");
  }, []);

  useEffect(() => {
    let disposed = false;

    async function bootstrap() {
      try {
        const menu = await fetchChessMenu();
        if (disposed) {
          return;
        }

        setIncomingInvitations(menu.incomingInvitations);
        setOutgoingInvitations(menu.outgoingInvitations);
        setActiveMatches(menu.activeMatches);
        setNotice("Choose a mode and press Play.");
      } catch (error) {
        if (!disposed) {
          if (error instanceof ApiRequestError && error.status === 401) {
            setNotice("Sign in to play Chess.");
          } else {
            setNotice("Could not load Chess menu right now.");
          }
        }
      } finally {
        if (!disposed) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrap();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    async function resolveAuthState() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok || disposed) {
          return;
        }

        const session = (await response.json()) as { user?: { id?: string | null } | null } | null;
        if (!disposed) {
          setIsAuthenticated(Boolean(session?.user?.id));
        }
      } catch {
        if (!disposed) {
          setIsAuthenticated(false);
        }
      }
    }

    void resolveAuthState();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedMatchId || viewMode !== "game") {
      return;
    }

    const matchId = selectedMatchId;

    let disposed = false;
    let refreshHandle: number | null = null;

    function scheduleRefresh(delayMs: number): void {
      if (disposed) {
        return;
      }
      if (refreshHandle !== null) {
        window.clearTimeout(refreshHandle);
      }
      refreshHandle = window.setTimeout(() => {
        void refreshSelectedMatch();
      }, delayMs);
    }

    async function refreshSelectedMatch() {
      try {
        const state = await fetchChessMatch(matchId);
        if (disposed) {
          return;
        }

        setMatch(state);

        const isWaitingForBotMove =
          state.summary.mode === "bot" &&
          state.summary.status === "active" &&
          !state.canSubmitMoves;
        scheduleRefresh(isWaitingForBotMove ? 1000 : 4000);
      } catch {
        if (!disposed) {
          setNotice("Could not refresh active match.");
          scheduleRefresh(4000);
        }
      }
    }

    void refreshSelectedMatch();

    return () => {
      disposed = true;
      if (refreshHandle !== null) {
        window.clearTimeout(refreshHandle);
      }
    };
  }, [selectedMatchId, viewMode]);

  useEffect(() => {
    const handle = window.setInterval(() => {
      setClockTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(handle);
    };
  }, []);

  useEffect(() => {
    if (!deniedSquare) {
      return;
    }
    const handle = window.setTimeout(() => {
      setDeniedSquare(null);
    }, 500);
    return () => {
      window.clearTimeout(handle);
    };
  }, [deniedSquare]);

  useEffect(() => {
    if (!invalidSquare) {
      return;
    }
    const handle = window.setTimeout(() => {
      setInvalidSquare(null);
    }, 900);
    return () => {
      window.clearTimeout(handle);
    };
  }, [invalidSquare]);

  async function handleSendInvitation(): Promise<void> {
    if (!inviteUsername.trim()) {
      setNotice("Enter a username for invitation.");
      return;
    }

    setIsSendingInvitation(true);
    try {
      await sendChessInvitation(inviteUsername.trim(), inviteColorPreference, timeControlSeconds);
      setInviteUsername("");
      setNotice("Invitation sent.");
      await refreshMenu();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send invitation";
      setNotice(message);
    } finally {
      setIsSendingInvitation(false);
    }
  }

  async function handleRespondInvitation(
    invitationId: string,
    action: "accept" | "decline",
  ): Promise<void> {
    setIsRespondingInvitation(true);
    try {
      const response = await respondChessInvitation(invitationId, action);
      setNotice(action === "accept" ? "Invitation accepted." : "Invitation declined.");
      if (response.match) {
        setSelectedMatchId(response.match.matchId);
        await loadMatch(response.match.matchId);
      }
      await refreshMenu();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to respond invitation";
      setNotice(message);
    } finally {
      setIsRespondingInvitation(false);
    }
  }

  async function handleStartSelfPlay(): Promise<void> {
    setIsStartingSelfPlay(true);
    try {
      const response = await startChessSelfPlay(timeControlSeconds);
      setSelectedMatchId(response.match.matchId);
      await loadMatch(response.match.matchId);
      await refreshMenu();
      setNotice("Self-play match started.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start self-play match";
      setNotice(message);
    } finally {
      setIsStartingSelfPlay(false);
    }
  }

  async function handleStartBot(): Promise<void> {
    setIsStartingBot(true);
    try {
      const response = await startChessBot(botPlayAs, botDifficulty, timeControlSeconds);
      setSelectedMatchId(response.match.matchId);
      await loadMatch(response.match.matchId);
      await refreshMenu();
      setNotice("Bot match started.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start bot match";
      setNotice(message);
    } finally {
      setIsStartingBot(false);
    }
  }

  function handleOpenMatch(matchId: string): void {
    setSelectedMatchId(matchId);
    void loadMatch(matchId);
  }

  function pieceAtSquare(square: string): string | null {
    if (!match) {
      return null;
    }
    const { rankIndex, fileIndex } = parseSquare(square);
    if (rankIndex < 0 || rankIndex > 7 || fileIndex < 0 || fileIndex > 7) {
      return null;
    }
    const value = match.board[rankIndex]?.[fileIndex] ?? "";
    return value || null;
  }

  async function handleSquareClick(square: string): Promise<void> {
    if (!match || isSubmittingMove) {
      return;
    }

    if (!match.canSubmitMoves) {
      setDeniedSquare(square);
      setNotice(`It is ${colorLabel(match.summary.turnColor)} to move.`);
      playChessSound("illegal", soundEnabled);
      return;
    }

    if (!selectedFromSquare) {
      const piece = pieceAtSquare(square);
      if (!piece) {
        return;
      }
      const pieceColor = getPieceColor(piece);
      if (!pieceColor || pieceColor !== match.summary.turnColor) {
        setDeniedSquare(square);
        setNotice(`Select a ${colorLabel(match.summary.turnColor)} piece.`);
        playChessSound("illegal", soundEnabled);
        return;
      }
      setSelectedFromSquare(square);
      playChessSound("select", soundEnabled);
      return;
    }

    if (selectedFromSquare === square) {
      setSelectedFromSquare(null);
      playChessSound("select", soundEnabled);
      return;
    }

    let targetSquare = square;
    const selectedPiece = pieceAtSquare(selectedFromSquare);
    const pieceOnTargetSquare = pieceAtSquare(square);
    if (pieceOnTargetSquare && getPieceColor(pieceOnTargetSquare) === match.summary.turnColor) {
      const turnColorPrefix = match.summary.turnColor === "white" ? "w" : "b";
      const selectedIsKing = selectedPiece === `${turnColorPrefix}K`;
      const targetIsRook = pieceOnTargetSquare === `${turnColorPrefix}R`;
      const sameRank = selectedFromSquare[1] === square[1];

      if (selectedIsKing && targetIsRook && sameRank) {
        const rank = selectedFromSquare[1];
        const castlingSquare =
          square[0] === "h"
            ? `g${rank}`
            : square[0] === "a"
              ? `c${rank}`
              : null;

        if (castlingSquare && legalMovesSet.has(`${selectedFromSquare}${castlingSquare}`)) {
          targetSquare = castlingSquare;
        } else {
          setSelectedFromSquare(square);
          playChessSound("select", soundEnabled);
          return;
        }
      } else {
        setSelectedFromSquare(square);
        playChessSound("select", soundEnabled);
        return;
      }
    }

    const promotion =
      (selectedFromSquare[1] === "7" && targetSquare[1] === "8") ||
      (selectedFromSquare[1] === "2" && targetSquare[1] === "1")
        ? "q"
        : undefined;

    const uciCandidate = `${selectedFromSquare}${targetSquare}${promotion ?? ""}`;
    if (!legalMovesSet.has(uciCandidate) && !legalMovesSet.has(`${selectedFromSquare}${targetSquare}`)) {
      setNotice("Illegal move.");
      setInvalidSquare(targetSquare);
      playChessSound("illegal", soundEnabled);
      return;
    }

    setIsSubmittingMove(true);
    try {
      const response = await submitChessMove({
        matchId: match.summary.matchId,
        fromSquare: selectedFromSquare,
        toSquare: targetSquare,
        promotion,
      });
      setMatch(response.match);
      await refreshMenu();
      setNotice(response.message);
      setSelectedFromSquare(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit move";
      setNotice(message);
      playChessSound("illegal", soundEnabled);
    } finally {
      setIsSubmittingMove(false);
    }
  }

  const isFlipped = match?.myColor === "black";
  const displayedBoard = useMemo(() => {
    if (!match) {
      return [] as string[][];
    }
    if (!isFlipped) {
      return match.board;
    }
    return [...match.board].reverse().map((row) => [...row].reverse());
  }, [isFlipped, match]);

  const checkedKingSquare = useMemo(() => {
    if (!match || !match.inCheck) {
      return null;
    }
    return findKingSquare(match.board, match.summary.turnColor);
  }, [match]);

  useEffect(() => {
    if (!match) {
      return;
    }

    const tracker = moveSoundTrackerRef.current;
    const currentMatchId = match.summary.matchId;
    if (tracker.matchId !== currentMatchId) {
      moveSoundTrackerRef.current = {
        matchId: currentMatchId,
        historyLength: match.history.length,
      };
      return;
    }

    if (match.history.length > tracker.historyLength) {
      const latestMove = match.history[match.history.length - 1];
      if (latestMove?.san) {
        playChessSound(classifyChessMoveSound(latestMove.san), soundEnabled);
      }
      moveSoundTrackerRef.current = {
        matchId: currentMatchId,
        historyLength: match.history.length,
      };
    }
  }, [match, soundEnabled]);

  useEffect(() => {
    if (!match) {
      return;
    }

    const tracker = statusSoundTrackerRef.current;
    const currentMatchId = match.summary.matchId;
    const currentStatus = match.summary.status;

    if (tracker.matchId !== currentMatchId) {
      statusSoundTrackerRef.current = { matchId: currentMatchId, status: currentStatus };
      return;
    }

    if (tracker.status !== currentStatus && currentStatus !== "active") {
      playChessSound("game-end", soundEnabled);
    }

    statusSoundTrackerRef.current = { matchId: currentMatchId, status: currentStatus };
  }, [match, soundEnabled]);

  useEffect(() => {
    if (!match) {
      return;
    }

    let white = match.summary.whiteTimeRemainingSeconds;
    let black = match.summary.blackTimeRemainingSeconds;

    if (match.summary.status === "active" && match.summary.clockStartedAt) {
      const startedAtMs = new Date(match.summary.clockStartedAt).getTime();
      if (Number.isFinite(startedAtMs)) {
        const elapsed = Math.max(0, Math.floor((clockTick - startedAtMs) / 1000));
        if (match.summary.turnColor === "white") {
          white = Math.max(0, white - elapsed);
        } else {
          black = Math.max(0, black - elapsed);
        }
      }
    }

    setStableClock((previous) => {
      if (match.summary.status !== "active") {
        return { white, black };
      }

      if (match.summary.turnColor === "white") {
        const shouldKeepPreviousWhite =
          white === 0 && previous.white > 0 && match.summary.whiteTimeRemainingSeconds > 0;
        return {
          white: shouldKeepPreviousWhite ? previous.white : white,
          black,
        };
      }

      const shouldKeepPreviousBlack =
        black === 0 && previous.black > 0 && match.summary.blackTimeRemainingSeconds > 0;
      return {
        white,
        black: shouldKeepPreviousBlack ? previous.black : black,
      };
    });
  }, [clockTick, match]);

  const displayClock = stableClock;

  const lastMoveSquares = useMemo(() => {
    if (!match || match.history.length === 0) {
      return null;
    }
    const lastMove = match.history[match.history.length - 1];
    const uci = lastMove?.uci ?? "";
    if (uci.length < 4) {
      return null;
    }
    return {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
    };
  }, [match]);

  const topPlayer = useMemo(() => {
    if (!match) {
      return null;
    }
    return isFlipped
      ? {
          color: "white" as ChessColor,
          username: match.summary.whiteUsername,
          clockSeconds: displayClock.white,
        }
      : {
          color: "black" as ChessColor,
          username: match.summary.blackUsername,
          clockSeconds: displayClock.black,
        };
  }, [displayClock.black, displayClock.white, isFlipped, match]);

  const bottomPlayer = useMemo(() => {
    if (!match) {
      return null;
    }
    return isFlipped
      ? {
          color: "black" as ChessColor,
          username: match.summary.blackUsername,
          clockSeconds: displayClock.black,
        }
      : {
          color: "white" as ChessColor,
          username: match.summary.whiteUsername,
          clockSeconds: displayClock.white,
        };
  }, [displayClock.black, displayClock.white, isFlipped, match]);

  const captureMaterialSummary = useMemo(() => {
    if (!match) {
      return null;
    }
    return buildCaptureMaterialSummary(match.board);
  }, [match]);

  const materialLeaderColor = useMemo(() => {
    if (!captureMaterialSummary) {
      return null;
    }
    if (captureMaterialSummary.whiteMaterialPoints === captureMaterialSummary.blackMaterialPoints) {
      return null;
    }
    return captureMaterialSummary.whiteMaterialPoints > captureMaterialSummary.blackMaterialPoints
      ? ("white" as ChessColor)
      : ("black" as ChessColor);
  }, [captureMaterialSummary]);

  const materialLeadPoints = useMemo(() => {
    if (!captureMaterialSummary) {
      return 0;
    }
    return Math.abs(captureMaterialSummary.whiteMaterialPoints - captureMaterialSummary.blackMaterialPoints);
  }, [captureMaterialSummary]);

  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-10">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/85 p-7 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Chess</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Traditional chess with account invitations, self-play, and a configurable bot mode.
            </p>
          </div>
          <Link
            href="/games"
            className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
          >
            Back to games
          </Link>
        </div>

        <p className="mt-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
          {isBootstrapping ? "Loading Chess..." : notice}
        </p>

        {!isAuthenticated ? (
          <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">Guest mode: self-play and bot are available.</p>
            <p className="mt-1 text-amber-200/90">Sign in is required for multiplayer invitations and personalized leaderboards.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href="/account/sign-in"
                className="rounded-lg border border-amber-300/50 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:bg-amber-300/20"
              >
                Sign in
              </Link>
              <Link
                href="/leaderboards"
                className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:bg-amber-300/15"
              >
                Leaderboards
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {viewMode === "menu" ? (
      <section className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-6">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-4">
            <h2 className="text-base font-semibold text-zinc-100">Play</h2>

            <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
              <label className="text-xs uppercase tracking-widest text-zinc-400">Time control</label>
              <select
                value={timeControlSeconds}
                onChange={(event) => {
                  setTimeControlSeconds(Number(event.target.value));
                }}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
              >
                {TIME_CONTROL_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds >= 3600
                      ? "1 hour"
                      : seconds >= 60
                        ? `${Math.floor(seconds / 60)} minutes`
                        : `${seconds} seconds`}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
              <label className="text-xs uppercase tracking-widest text-zinc-400">Sound</label>
              <p className="mt-1 text-xs text-zinc-500">Subtle effects for select, move, capture, check, and game-end.</p>
              <div className="mt-2 inline-flex rounded-lg border border-zinc-700 p-1">
                <button
                  type="button"
                  onClick={() => setSoundPreference(true)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    soundEnabled
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  On
                </button>
                <button
                  type="button"
                  onClick={() => setSoundPreference(false)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    !soundEnabled
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  Off
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void handleStartSelfPlay();
              }}
              disabled={isStartingSelfPlay}
              className="mt-3 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-60"
            >
              {isStartingSelfPlay ? "Starting..." : "Play self-play"}
            </button>

            <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
              <label className="text-xs uppercase tracking-widest text-zinc-400">Bot side</label>
              <select
                value={botPlayAs}
                onChange={(event) => {
                  setBotPlayAs(event.target.value as BotPlayAs);
                }}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
              >
                <option value="random">Random</option>
                <option value="white">Play as White</option>
                <option value="black">Play as Black</option>
              </select>

              <label className="mt-3 block text-xs uppercase tracking-widest text-zinc-400">Bot difficulty</label>
              <select
                value={botDifficulty}
                onChange={(event) => {
                  setBotDifficulty(event.target.value as BotDifficulty);
                }}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
              >
                <option value="easy">Easy (Depth 1)</option>
                <option value="medium">Medium (Depth 2)</option>
                <option value="hard">Hard (Depth 3)</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  void handleStartBot();
                }}
                disabled={isStartingBot}
                className="mt-3 w-full rounded-xl border border-violet-500/40 bg-violet-500/15 px-3 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-60"
              >
                {isStartingBot ? "Starting..." : "Play bot match"}
              </button>
            </div>
          </article>

          {isAuthenticated ? (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-4">
            <h2 className="text-base font-semibold text-zinc-100">Invitations</h2>

            <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
              <label className="text-xs uppercase tracking-widest text-zinc-400">Send invitation</label>
              <input
                value={inviteUsername}
                onChange={(event) => {
                  setInviteUsername(event.target.value);
                }}
                placeholder="Target username"
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              />
              <select
                value={inviteColorPreference}
                onChange={(event) => {
                  setInviteColorPreference(event.target.value as InvitationColorPreference);
                }}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
              >
                <option value="random">Color random</option>
                <option value="white">I want White</option>
                <option value="black">I want Black</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  void handleSendInvitation();
                }}
                disabled={isSendingInvitation}
                className="mt-3 w-full rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-60"
              >
                {isSendingInvitation ? "Sending..." : "Send"}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-medium text-zinc-200">Incoming</h3>
              {incomingInvitations.length === 0 ? (
                <p className="text-sm text-zinc-500">No pending incoming invitations.</p>
              ) : (
                incomingInvitations.map((invitation) => (
                  <div
                    key={invitation.invitationId}
                    className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3 text-sm text-zinc-200"
                  >
                    <p>{invitation.fromUsername} invited you.</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Preference: {invitation.colorPreference}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={isRespondingInvitation}
                        onClick={() => {
                          void handleRespondInvitation(invitation.invitationId, "accept");
                        }}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-60"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={isRespondingInvitation}
                        onClick={() => {
                          void handleRespondInvitation(invitation.invitationId, "decline");
                        }}
                        className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-medium text-zinc-200">Outgoing</h3>
              {outgoingInvitations.length === 0 ? (
                <p className="text-sm text-zinc-500">No pending outgoing invitations.</p>
              ) : (
                outgoingInvitations.map((invitation) => (
                  <div
                    key={invitation.invitationId}
                    className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3 text-sm text-zinc-200"
                  >
                    <p>To: {invitation.toUsername}</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Preference: {invitation.colorPreference} · {Math.floor(invitation.timeControlSeconds / 60)}m
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>
          ) : (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-4">
            <h2 className="text-base font-semibold text-zinc-100">Multiplayer</h2>
            <p className="mt-2 text-sm text-zinc-300">Sign in to send invitations and play account-vs-account matches.</p>
            <div className="mt-3 flex gap-2">
              <Link
                href="/account/sign-in"
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/25"
              >
                Sign in
              </Link>
              <Link
                href="/account/sign-up"
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700"
              >
                Create account
              </Link>
            </div>
          </article>
          )}

          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-4">
            <h2 className="text-base font-semibold text-zinc-100">Active matches</h2>
            <div className="mt-3 space-y-2">
              {activeMatches.length === 0 ? (
                <p className="text-sm text-zinc-500">No active matches.</p>
              ) : (
                activeMatches.map((entry) => (
                  <div
                    key={entry.matchId}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      entry.matchId === selectedMatchId
                        ? "border-amber-400/70 bg-amber-500/15 text-amber-100"
                        : "border-zinc-700 bg-zinc-950/70 text-zinc-200"
                    }`}
                  >
                    <p className="font-medium">
                      {entry.whiteUsername} vs {entry.blackUsername}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {entry.mode} · {Math.floor(entry.timeControlSeconds / 60)}m · {colorLabel(entry.turnColor)} to move
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenMatch(entry.matchId);
                      }}
                      className="mt-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/25"
                    >
                      Play
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>
        </aside>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">Ready to play</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Start a new match or pick an active one. Board view opens after you press Play.
          </p>
        </section>
      </section>
      ) : (
      <section className="mt-6">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5">
          {match ? (
            <>
              <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    {match.summary.whiteUsername} vs {match.summary.blackUsername}
                  </h2>
                  <p className="text-sm text-zinc-300">{gameStatusLabel(match)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setBoardSize("large");
                      }}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                        boardSize === "large"
                          ? "bg-cyan-500/25 text-cyan-100"
                          : "text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      Large
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBoardSize("compact");
                      }}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                        boardSize === "compact"
                          ? "bg-cyan-500/25 text-cyan-100"
                          : "text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      Compact
                    </button>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      match.canSubmitMoves
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {match.canSubmitMoves ? "Your turn" : "Waiting"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("menu");
                    }}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700"
                  >
                    Menu
                  </button>
                </div>
              </header>

              {topPlayer && captureMaterialSummary ? (
                <div className="mb-2">
                  <PlayerStrip
                    color={topPlayer.color}
                    username={topPlayer.username}
                    clockSeconds={topPlayer.clockSeconds}
                    isTurn={match.summary.turnColor === topPlayer.color}
                    capturedPieces={
                      topPlayer.color === "white"
                        ? captureMaterialSummary.capturedByWhite
                        : captureMaterialSummary.capturedByBlack
                    }
                    materialLead={materialLeaderColor === topPlayer.color ? materialLeadPoints : 0}
                  />
                </div>
              ) : null}

              <div
                className={`mx-auto w-full rounded-2xl border border-zinc-700 bg-zinc-950/70 p-3 ${
                  boardSize === "large" ? "max-w-3xl" : "max-w-140"
                }`}
              >
                <div className="grid grid-cols-8 overflow-hidden rounded-lg border border-zinc-700">
                  {displayedBoard.map((rank, rankIndex) =>
                    rank.map((piece, fileIndex) => {
                      const square = squareFromDisplayCoords(rankIndex, fileIndex, Boolean(isFlipped));
                      const selected = selectedFromSquare === square;
                      const legalTarget = selectedMoveTargets.has(square);
                      const denied = deniedSquare === square;
                      const invalid = invalidSquare === square;
                      const checked = checkedKingSquare === square;
                      const isLastMoveFrom = lastMoveSquares?.from === square;
                      const isLastMoveTo = lastMoveSquares?.to === square;
                      const hasPiece = Boolean(piece);
                      const baseTone = isLightSquare(rankIndex, fileIndex)
                        ? "bg-amber-200"
                        : "bg-amber-700";

                      return (
                        <button
                          key={square}
                          type="button"
                          onClick={() => {
                            void handleSquareClick(square);
                          }}
                          disabled={!match.canSubmitMoves}
                          className={`relative aspect-square border border-black/10 transition ${baseTone} ${selected ? "ring-4 ring-cyan-300 ring-inset" : ""} ${legalTarget ? "ring-2 ring-emerald-300/80 ring-inset" : ""} ${denied ? "ring-2 ring-amber-300 ring-inset" : ""} ${invalid ? "ring-2 ring-rose-300 ring-inset bg-rose-500/80" : ""} ${checked ? "ring-4 ring-rose-400 ring-inset" : ""} ${match.canSubmitMoves ? "hover:brightness-110" : "cursor-default opacity-95"}`}
                          aria-label={`Square ${square}`}
                        >
                          {isLastMoveTo ? (
                            <span className="pointer-events-none absolute inset-1 rounded-sm border-2 border-cyan-300/85" />
                          ) : null}
                          {isLastMoveFrom ? (
                            <span className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-800/50 bg-zinc-300/90" />
                          ) : null}
                          {legalTarget ? (
                            hasPiece ? (
                              <span className="pointer-events-none absolute inset-2 rounded-md border-3 border-emerald-200/90" />
                            ) : (
                              <span className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200/90" />
                            )
                          ) : null}
                          {piece ? (
                            <span
                              className={`relative z-10 inline-block select-none transition-transform duration-150 ease-out ${
                                boardSize === "large" ? "h-16 w-16 md:h-20 md:w-20" : "h-12 w-12 md:h-14 md:w-14"
                              } ${selected ? "-translate-y-1 scale-110" : "translate-y-0 scale-100"}`}
                            >
                              {getPieceAssetPath(piece) ? (
                                <Image
                                  src={getPieceAssetPath(piece) ?? ""}
                                  alt={toPieceName(piece)}
                                  fill
                                  sizes={boardSize === "large" ? "(min-width: 768px) 80px, 64px" : "(min-width: 768px) 56px, 48px"}
                                  className="object-contain"
                                />
                              ) : null}
                            </span>
                          ) : null}
                        </button>
                      );
                    }),
                  )}
                </div>
                <div className="mt-2 grid grid-cols-8 text-center text-xs text-zinc-400">
                  {(isFlipped ? [...FILES].reverse() : FILES).map((file) => (
                    <span key={file}>{file}</span>
                  ))}
                </div>
              </div>

              {bottomPlayer && captureMaterialSummary ? (
                <div className="mt-2">
                  <PlayerStrip
                    color={bottomPlayer.color}
                    username={bottomPlayer.username}
                    clockSeconds={bottomPlayer.clockSeconds}
                    isTurn={match.summary.turnColor === bottomPlayer.color}
                    capturedPieces={
                      bottomPlayer.color === "white"
                        ? captureMaterialSummary.capturedByWhite
                        : captureMaterialSummary.capturedByBlack
                    }
                    materialLead={materialLeaderColor === bottomPlayer.color ? materialLeadPoints : 0}
                  />
                </div>
              ) : null}

              <div className="mt-5 rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
                <h3 className="text-sm font-medium text-zinc-200">Move history</h3>
                {match.history.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-500">No moves yet.</p>
                ) : (
                  <ol className="mt-2 grid max-h-56 gap-1 overflow-auto pr-2 text-sm text-zinc-200 sm:grid-cols-2">
                    {match.history.map((move) => (
                      <li key={`${move.moveNumber}-${move.uci}`} className="rounded-lg bg-zinc-900/80 px-2 py-1">
                        <span className="text-zinc-400">{move.moveNumber}.</span>{" "}
                        <span className="font-semibold text-zinc-100">{movePieceLabelFromSan(move.san)}</span>{" "}
                        <span>{move.san}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-950/70 p-6 text-center text-zinc-300">
              Choose a match from the menu and press Play.
            </div>
          )}
        </section>
      </section>
      )}
    </main>
  );
}
