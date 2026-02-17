"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchChessMatch,
  fetchChessMenu,
  respondChessInvitation,
  sendChessInvitation,
  startChessBot,
  startChessSelfPlay,
  submitChessMove,
  type ChessColor,
  type ChessInvitationSummary,
  type ChessMatchState,
  type ChessMatchSummary,
  type InvitationColorPreference,
} from "@/app/games/chess/lib/api";
import { ApiRequestError } from "@/lib/http-client";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const TIME_CONTROL_OPTIONS = [60, 300, 600, 1500, 3600] as const;

const PIECE_LABELS: Record<string, string> = {
  wK: "♚",
  wQ: "♛",
  wR: "♜",
  wB: "♝",
  wN: "♞",
  wP: "♟",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

type BotPlayAs = "white" | "black" | "random";
type ViewMode = "menu" | "game";

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

export default function ChessPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("menu");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [notice, setNotice] = useState("Choose a mode and press Play.");

  const [incomingInvitations, setIncomingInvitations] = useState<ChessInvitationSummary[]>([]);
  const [outgoingInvitations, setOutgoingInvitations] = useState<ChessInvitationSummary[]>([]);
  const [activeMatches, setActiveMatches] = useState<ChessMatchSummary[]>([]);

  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [match, setMatch] = useState<ChessMatchState | null>(null);

  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteColorPreference, setInviteColorPreference] =
    useState<InvitationColorPreference>("random");
  const [botPlayAs, setBotPlayAs] = useState<BotPlayAs>("random");
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
    if (!selectedMatchId || viewMode !== "game") {
      return;
    }

    const matchId = selectedMatchId;

    let disposed = false;

    async function refreshSelectedMatch() {
      try {
        const state = await fetchChessMatch(matchId);
        if (!disposed) {
          setMatch(state);
        }
      } catch {
        if (!disposed) {
          setNotice("Could not refresh active match.");
        }
      }
    }

    void refreshSelectedMatch();

    const handle = window.setInterval(() => {
      void refreshSelectedMatch();
    }, 4000);

    return () => {
      disposed = true;
      window.clearInterval(handle);
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
      const response = await startChessBot(botPlayAs, timeControlSeconds);
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
        return;
      }
      setSelectedFromSquare(square);
      return;
    }

    if (selectedFromSquare === square) {
      setSelectedFromSquare(null);
      return;
    }

    const promotion =
      (selectedFromSquare[1] === "7" && square[1] === "8") ||
      (selectedFromSquare[1] === "2" && square[1] === "1")
        ? "q"
        : undefined;

    const uciCandidate = `${selectedFromSquare}${square}${promotion ?? ""}`;
    if (!legalMovesSet.has(uciCandidate) && !legalMovesSet.has(`${selectedFromSquare}${square}`)) {
      setNotice("Illegal move.");
      setInvalidSquare(square);
      return;
    }

    setIsSubmittingMove(true);
    try {
      const response = await submitChessMove({
        matchId: match.summary.matchId,
        fromSquare: selectedFromSquare,
        toSquare: square,
        promotion,
      });
      setMatch(response.match);
      await refreshMenu();
      setNotice(response.message);
      setSelectedFromSquare(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit move";
      setNotice(message);
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

  const displayClock = useMemo(() => {
    if (!match) {
      return { white: 0, black: 0 };
    }

    let white = match.summary.whiteTimeRemainingSeconds;
    let black = match.summary.blackTimeRemainingSeconds;

    if (match.summary.status === "active" && match.summary.clockStartedAt) {
      const elapsed = Math.max(
        0,
        Math.floor((clockTick - new Date(match.summary.clockStartedAt).getTime()) / 1000),
      );
      if (match.summary.turnColor === "white") {
        white = Math.max(0, white - elapsed);
      } else {
        black = Math.max(0, black - elapsed);
      }
    }

    return { white, black };
  }, [clockTick, match]);

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

  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-10">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/85 p-7 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Chess</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Traditional chess with account invitations, self-play, and a basic bot mode.
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

              {topPlayer ? (
                <div
                  className={`mx-auto mb-2 flex w-full max-w-160 items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                    match.summary.turnColor === topPlayer.color
                      ? "border-amber-400/70 bg-amber-500/15 text-amber-100"
                      : "border-zinc-700 bg-zinc-950/70 text-zinc-200"
                  }`}
                >
                  <span className="font-medium">
                    {topPlayer.username} · {colorLabel(topPlayer.color)}
                  </span>
                  <span className="font-semibold tracking-wider">{formatClock(topPlayer.clockSeconds)}</span>
                </div>
              ) : null}

              <div className="mx-auto w-full max-w-140 rounded-2xl border border-zinc-700 bg-zinc-950/70 p-3">
                <div className="grid grid-cols-8 overflow-hidden rounded-lg border border-zinc-700">
                  {displayedBoard.map((rank, rankIndex) =>
                    rank.map((piece, fileIndex) => {
                      const square = squareFromDisplayCoords(rankIndex, fileIndex, Boolean(isFlipped));
                      const selected = selectedFromSquare === square;
                      const legalTarget = selectedMoveTargets.has(square);
                      const denied = deniedSquare === square;
                      const invalid = invalidSquare === square;
                      const checked = checkedKingSquare === square;
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
                          {legalTarget ? (
                            hasPiece ? (
                              <span className="pointer-events-none absolute inset-2 rounded-md border-3 border-emerald-200/90" />
                            ) : (
                              <span className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200/90" />
                            )
                          ) : null}
                          {piece ? (
                            <span
                              className={`relative z-10 inline-block select-none text-5xl leading-none transition-transform duration-150 ease-out md:text-6xl ${selected ? "-translate-y-1 scale-110" : "translate-y-0 scale-100"} ${piece.startsWith("w") ? "text-white [text-shadow:0_1px_0_rgba(255,255,255,0.95),0_2px_3px_rgba(0,0,0,0.85)]" : "text-black [text-shadow:0_1px_0_rgba(0,0,0,0.85)]"}`}
                            >
                              {PIECE_LABELS[piece] ?? ""}
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

              {bottomPlayer ? (
                <div
                  className={`mx-auto mt-2 flex w-full max-w-160 items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                    match.summary.turnColor === bottomPlayer.color
                      ? "border-amber-400/70 bg-amber-500/15 text-amber-100"
                      : "border-zinc-700 bg-zinc-950/70 text-zinc-200"
                  }`}
                >
                  <span className="font-medium">
                    {bottomPlayer.username} · {colorLabel(bottomPlayer.color)}
                  </span>
                  <span className="font-semibold tracking-wider">{formatClock(bottomPlayer.clockSeconds)}</span>
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
                        {move.moveNumber}. {move.san}
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
