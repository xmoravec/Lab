"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchWordleMenu,
  requestWordleHint,
  revealWordleAnswer,
  startWordleGame,
  submitWordleGuess,
  type TileState,
  type WordleDifficulty,
  type WordleGameState,
} from "@/app/games/wordle/lib/api";
import { ApiRequestError } from "@/lib/http-client";
import { loadSoundEnabled, saveSoundEnabled, unlockAudioContext } from "@/lib/sound/audio";
import { playWordleSound } from "@/lib/sound/game-sounds";

import styles from "./wordle.module.css";

const KEYBOARD_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const WORDLE_SOUND_SETTING_KEY = "lab:wordle:sounds";

type KeyboardLegend = Record<string, TileState>;
type BoardWidthMode = "classic" | "auto";
type WordleViewMode = "menu" | "game";

const STATE_PRIORITY: Record<TileState, number> = {
  absent: 0,
  present: 1,
  correct: 2,
};

function toReadableDifficulty(value: WordleDifficulty): string {
  return value === "common" ? "Common (2k words)" : "Extended (8k words)";
}

function buildKeyboardLegend(game: WordleGameState | null): KeyboardLegend {
  if (!game) {
    return {};
  }

  const legend: KeyboardLegend = {};
  for (const attempt of game.board) {
    for (const evaluation of attempt.evaluations) {
      const key = evaluation.letter.toUpperCase();
      const current = legend[key];
      if (!current || STATE_PRIORITY[evaluation.state] > STATE_PRIORITY[current]) {
        legend[key] = evaluation.state;
      }
    }
  }

  return legend;
}

function gameStatusText(game: WordleGameState): string {
  if (game.status === "won") {
    return `Solved in ${game.attemptsUsed}/${game.maxAttempts}`;
  }

  if (game.status === "lost") {
    return `Missed in ${game.maxAttempts} turns`;
  }

  return `In progress · ${game.attemptsUsed}/${game.maxAttempts}`;
}

function gameStatusTone(game: WordleGameState): string {
  if (game.status === "won") {
    return "text-emerald-300";
  }

  if (game.status === "lost") {
    return "text-rose-300";
  }

  return "text-cyan-300";
}

function tileTone(state?: TileState): string {
  if (state === "correct") {
    return "border-emerald-400 bg-emerald-500/40 text-emerald-50";
  }

  if (state === "present") {
    return "border-amber-400 bg-amber-500/40 text-amber-50";
  }

  if (state === "absent") {
    return "border-zinc-500 bg-zinc-700 text-zinc-100";
  }

  return "border-zinc-500 bg-zinc-800 text-zinc-100";
}

function keyboardTone(state?: TileState): string {
  if (state === "correct") {
    return "border-emerald-400/60 bg-emerald-500/70 text-emerald-50";
  }

  if (state === "present") {
    return "border-amber-400/60 bg-amber-500/70 text-amber-50";
  }

  if (state === "absent") {
    return "border-zinc-500 bg-zinc-700 text-zinc-100";
  }

  return "border-zinc-500 bg-zinc-800 text-zinc-100 hover:bg-zinc-700";
}

export default function WordlePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<WordleDifficulty>("common");
  const [availableDifficulties, setAvailableDifficulties] = useState<WordleDifficulty[]>([
    "common",
    "extended",
  ]);
  const [currentGame, setCurrentGame] = useState<WordleGameState | null>(null);
  const [previousGames, setPreviousGames] = useState<WordleGameState[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHinting, setIsHinting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);
  const [boardWidthMode, setBoardWidthMode] = useState<BoardWidthMode>("classic");
  const [viewMode, setViewMode] = useState<WordleViewMode>("menu");
  const [notice, setNotice] = useState("Choose a difficulty and hit Play.");
  const [wordBankNotice, setWordBankNotice] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [shakeTick, setShakeTick] = useState(0);
  const [keyPulse, setKeyPulse] = useState("");

  useEffect(() => {
    setSoundEnabled(loadSoundEnabled(WORDLE_SOUND_SETTING_KEY));
  }, []);

  const setSoundPreference = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    saveSoundEnabled(WORDLE_SOUND_SETTING_KEY, enabled);
    if (enabled) {
      void unlockAudioContext();
      playWordleSound("start", true);
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    async function syncAdminModeState() {
      try {
        const response = await fetch("/api/auth/admin-mode", { cache: "no-store" });
        if (!response.ok || disposed) {
          return;
        }

        const payload = (await response.json()) as { isAdmin?: boolean; adminModeEnabled?: boolean };
        if (disposed) {
          return;
        }

        const nextIsAdmin = Boolean(payload.isAdmin);
        const nextAdminModeEnabled = nextIsAdmin && Boolean(payload.adminModeEnabled);

        setIsAdmin(nextIsAdmin);
        setAdminModeEnabled(nextAdminModeEnabled);
      } catch {
        if (!disposed) {
          setIsAdmin(false);
          setAdminModeEnabled(false);
        }
      }
    }

    function handleFocus() {
      void syncAdminModeState();
    }

    void syncAdminModeState();
    const intervalHandle = window.setInterval(() => {
      void syncAdminModeState();
    }, 3000);
    window.addEventListener("focus", handleFocus);

    return () => {
      disposed = true;
      window.clearInterval(intervalHandle);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    async function bootstrap() {
      try {
        const menu = await fetchWordleMenu();
        if (disposed) {
          return;
        }

        setCurrentGame(menu.activeGame ?? null);
        setPreviousGames(menu.previousGames);
        setAvailableDifficulties(menu.availableDifficulties);
        setDifficulty(menu.activeGame?.difficulty ?? menu.availableDifficulties[0] ?? "common");
        setWordBankNotice(menu.wordBankNotice ?? menu.activeGame?.wordBankNotice ?? null);

        if (menu.activeGame) {
          setNotice("Active game found. Use Resume to continue or start a new game.");
        } else {
          setNotice("Choose a difficulty and hit Play.");
        }
      } catch (error) {
        console.error("Failed to bootstrap Wordle menu", {
          location: "WordlePage.bootstrap",
          error,
        });
        if (!disposed) {
          setNotice("Could not load Wordle menu right now.");
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      disposed = true;
    };
  }, []);

  const keyboardLegend = useMemo(() => buildKeyboardLegend(currentGame), [currentGame]);

  const activeRowIndex = currentGame?.attemptsUsed ?? 0;
  const maxAttempts = currentGame?.maxAttempts ?? 6;
  const wordLength = currentGame?.wordLength ?? 5;
  const boardColumns = boardWidthMode === "auto" ? wordLength : 5;

  const refreshHistory = useCallback(async () => {
    try {
      const menu = await fetchWordleMenu();
      setPreviousGames(menu.previousGames);
      setWordBankNotice(menu.wordBankNotice ?? menu.activeGame?.wordBankNotice ?? null);
      if (menu.activeGame) {
        setCurrentGame(menu.activeGame);
      }
    } catch (error) {
      console.warn("Failed to refresh Wordle history", {
        location: "WordlePage.refreshHistory",
        error,
      });
    }
  }, []);

  async function handleStart(forceNew: boolean): Promise<void> {
    setIsLoading(true);
    try {
      const started = await startWordleGame(difficulty, forceNew);
      setCurrentGame(started.game);
      setViewMode("game");
      setWordBankNotice(started.game.wordBankNotice ?? null);
      setCurrentGuess("");
      setNotice(started.resumedExisting ? "Resumed existing game." : "New game started.");
      playWordleSound("start", soundEnabled);
      await refreshHistory();
    } catch (error) {
      console.error("Failed to start Wordle game", {
        location: "WordlePage.handleStart",
        difficulty,
        forceNew,
        error,
      });
      setNotice("Unable to start game right now.");
    } finally {
      setIsLoading(false);
    }
  }

  const submitGuess = useCallback(async () => {
    if (viewMode !== "game" || !currentGame || currentGame.status !== "in-progress" || isSubmitting) {
      return;
    }

    if (currentGuess.length !== wordLength) {
      setNotice(`Guess must be ${wordLength} letters.`);
      setShakeTick((value) => value + 1);
      playWordleSound("invalid", soundEnabled);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitWordleGuess(currentGame.gameId, currentGuess.toLowerCase());
      setCurrentGame(response.game);
      setWordBankNotice(response.game.wordBankNotice ?? null);

      if (!response.accepted) {
        if (response.message.toLowerCase().includes("word not found")) {
          setNotice("Not in word list.");
        } else {
          setNotice(response.message);
        }
        setShakeTick((value) => value + 1);
        playWordleSound("invalid", soundEnabled);
        return;
      }

      setCurrentGuess("");
      playWordleSound("submit", soundEnabled);

      if (response.game.status === "won") {
        setNotice("Huge win. You cracked it.");
        playWordleSound("win", soundEnabled);
      } else if (response.game.status === "lost") {
        setNotice(`Round over. Answer: ${response.game.answer?.toUpperCase() ?? "unknown"}.`);
        playWordleSound("lose", soundEnabled);
      } else {
        setNotice(response.message);
      }

      await refreshHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Guess failed";

      if (error instanceof ApiRequestError && error.isExpectedClientRejection) {
        if (error.status === 400 && message.toLowerCase().includes("word not found")) {
          setNotice("Not in word list.");
        } else {
          setNotice(message);
        }
      } else {
        console.error("Failed to submit Wordle guess", {
          location: "WordlePage.submitGuess",
          gameId: currentGame.gameId,
          guess: currentGuess,
          error,
        });
        setNotice(message);
      }

      setShakeTick((value) => value + 1);
      playWordleSound("invalid", soundEnabled);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentGame, currentGuess, isSubmitting, refreshHistory, soundEnabled, viewMode, wordLength]);

  const pushKey = useCallback((key: string) => {
    if (viewMode !== "game" || !currentGame || currentGame.status !== "in-progress") {
      return;
    }

    const normalized = key.toUpperCase();

    if (normalized === "BACKSPACE") {
      setCurrentGuess((previous) => previous.slice(0, -1));
      playWordleSound("delete", soundEnabled);
      return;
    }

    if (normalized === "ENTER") {
      playWordleSound("submit", soundEnabled);
      void submitGuess();
      return;
    }

    if (!/^[A-Z]$/.test(normalized)) {
      return;
    }

    setCurrentGuess((previous) => {
      if (previous.length >= wordLength) {
        return previous;
      }

      return `${previous}${normalized}`;
    });
    playWordleSound("key", soundEnabled);
    setKeyPulse(normalized);
    setTimeout(() => setKeyPulse(""), 140);
  }, [currentGame, soundEnabled, submitGuess, viewMode, wordLength]);

  const handleHint = useCallback(async () => {
    if (!currentGame || currentGame.status !== "in-progress" || isHinting) {
      return;
    }

    setIsHinting(true);
    try {
      const response = await requestWordleHint(currentGame.gameId);
      setCurrentGame(response.game);
      setNotice(response.message);
      playWordleSound(response.accepted ? "hint" : "invalid", soundEnabled);
      setWordBankNotice(response.game.wordBankNotice ?? null);
      await refreshHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to request hint";
      setNotice(message);
    } finally {
      setIsHinting(false);
    }
  }, [currentGame, isHinting, refreshHistory, soundEnabled]);

  const handleAdminReveal = useCallback(async () => {
    if (!currentGame || !isAdmin || !adminModeEnabled || isRevealing) {
      return;
    }

    setIsRevealing(true);
    try {
      const response = await revealWordleAnswer(currentGame.gameId);
      setCurrentGame(response.game);
      setNotice(response.message);
      playWordleSound("hint", soundEnabled);
      setWordBankNotice(response.game.wordBankNotice ?? null);
      await refreshHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reveal answer";
      setNotice(message);
    } finally {
      setIsRevealing(false);
    }
  }, [adminModeEnabled, currentGame, isAdmin, isRevealing, refreshHistory, soundEnabled]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key;
      if (key === "Enter") {
        event.preventDefault();
        pushKey("ENTER");
        return;
      }
      if (key === "Backspace") {
        event.preventDefault();
        pushKey("BACKSPACE");
        return;
      }
      if (/^[a-zA-Z]$/.test(key)) {
        event.preventDefault();
        pushKey(key);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pushKey]);

  const boardRows = useMemo(() => {
    const rows: Array<{ letters: string[]; states: Array<TileState | undefined>; done: boolean }> = [];

    for (let rowIndex = 0; rowIndex < maxAttempts; rowIndex += 1) {
      const submittedAttempt = currentGame?.board[rowIndex];

      if (submittedAttempt) {
        rows.push({
          letters: submittedAttempt.guess.toUpperCase().split(""),
          states: submittedAttempt.evaluations.map((item) => item.state),
          done: true,
        });
        continue;
      }

      if (rowIndex === activeRowIndex && currentGame?.status === "in-progress") {
        const letters = currentGuess.padEnd(wordLength, " ").split("");
        rows.push({
          letters,
          states: Array.from({ length: wordLength }, () => undefined),
          done: false,
        });
        continue;
      }

      rows.push({
        letters: Array.from({ length: wordLength }, () => " "),
        states: Array.from({ length: wordLength }, () => undefined),
        done: false,
      });
    }

    return rows;
  }, [activeRowIndex, currentGame, currentGuess, maxAttempts, wordLength]);

  return (
    <main className={`${styles.page} mx-auto max-w-6xl px-6 pb-16 pt-8`}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Wordle Lab</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-zinc-100">Word Duel</h1>
          <p className="mt-2 text-sm text-zinc-400">Sharper logic, cleaner animations, same five-letter adrenaline.</p>
          {wordBankNotice ? (
            <p className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {wordBankNotice}
            </p>
          ) : null}
        </div>
        <Link href="/games" className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
          Back to games
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className={`${styles.glow} rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 md:p-7`}>
          {viewMode === "menu" || !currentGame ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-zinc-100">Ready to play?</h2>
                <p className="mt-2 text-zinc-400">Pick your difficulty, then smash the big button.</p>
              </div>

              {currentGame ? (
                <div className="rounded-2xl border border-cyan-500/35 bg-cyan-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">Active game</p>
                  <p className="mt-1 text-sm text-cyan-100">
                    {toReadableDifficulty(currentGame.difficulty)} · {gameStatusText(currentGame)}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("game");
                      setNotice("Resumed your active game.");
                    }}
                    className="mt-3 rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
                  >
                    Resume active game
                  </button>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {availableDifficulties.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDifficulty(option)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      difficulty === option
                        ? "border-fuchsia-400 bg-fuchsia-500/10 text-fuchsia-100"
                        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    <p className="text-sm font-semibold uppercase tracking-wide">{option}</p>
                    <p className="mt-1 text-sm">{toReadableDifficulty(option)}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Board width</p>
                <p className="mt-1 text-xs text-zinc-500">Classic 5-letter mode is primary. Auto mode follows game word length.</p>
                <div className="mt-2 inline-flex rounded-lg border border-zinc-700 p-1">
                  <button
                    type="button"
                    onClick={() => setBoardWidthMode("classic")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      boardWidthMode === "classic"
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    Classic (5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardWidthMode("auto")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      boardWidthMode === "auto"
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    Auto
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Sound</p>
                <p className="mt-1 text-xs text-zinc-500">Subtle tones for typing, outcomes, and hint actions.</p>
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
                onClick={() => void handleStart(false)}
                disabled={isLoading}
                className="w-full rounded-2xl bg-fuchsia-500 px-6 py-5 text-lg font-black uppercase tracking-[0.2em] text-white transition hover:bg-fuchsia-400 disabled:opacity-60"
              >
                {isLoading ? "Loading..." : "Play"}
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{toReadableDifficulty(currentGame.difficulty)}</p>
                  <p className={`text-sm font-semibold ${gameStatusTone(currentGame)}`}>{gameStatusText(currentGame)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("menu");
                    }}
                    className="rounded-md border border-zinc-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 hover:bg-zinc-800"
                  >
                    Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleHint()}
                    disabled={isHinting || currentGame.hintUsed || currentGame.status !== "in-progress"}
                    className="rounded-md border border-amber-500/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isHinting ? "Hint..." : currentGame.hintUsed ? "Hint used" : "Use hint"}
                  </button>
                  {isAdmin && adminModeEnabled ? (
                    <button
                      type="button"
                      onClick={() => void handleAdminReveal()}
                      disabled={isRevealing || currentGame.status !== "in-progress"}
                      className="rounded-md border border-rose-500/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRevealing ? "Reveal..." : "Admin reveal"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleStart(true)}
                    className="rounded-md border border-zinc-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 hover:bg-zinc-800"
                  >
                    New game
                  </button>
                </div>
              </div>

              {currentGame.hintUsed && currentGame.hintLetter && typeof currentGame.hintLetterIndex === "number" ? (
                <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Hint used: letter {currentGame.hintLetterIndex + 1} is {currentGame.hintLetter.toUpperCase()}.
                  This game awards no ELO.
                </p>
              ) : null}

              {isAdmin && adminModeEnabled && currentGame.adminAnswerRevealed && currentGame.answer ? (
                <p className="mb-4 rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                  Admin reveal active: answer is <span className="font-black tracking-widest">{currentGame.answer.toUpperCase()}</span>
                </p>
              ) : null}

              <div className="mx-auto max-w-md space-y-2">
                {boardRows.map((row, rowIndex) => {
                  const shouldShake = rowIndex === activeRowIndex && currentGame.status === "in-progress";

                  return (
                    <div
                      key={`${rowIndex}-${shakeTick}`}
                      style={{ gridTemplateColumns: `repeat(${boardColumns}, minmax(0, 1fr))` }}
                      className={`grid gap-2 ${shouldShake ? styles.rowShake : ""}`}
                    >
                      {row.letters.map((letter, letterIndex) => {
                        const state = row.states[letterIndex];
                        const showPop = rowIndex === activeRowIndex && !row.done && letter.trim() !== "";

                        return (
                          <div
                            key={`${rowIndex}-${letterIndex}`}
                            style={row.done ? { animationDelay: `${letterIndex * 110}ms` } : undefined}
                            className={`
                              ${styles.tile}
                              ${row.done ? styles.tileReveal : ""}
                              ${showPop ? styles.tilePop : ""}
                              ${tileTone(state)}
                              flex aspect-square items-center justify-center rounded-xl border text-2xl font-black uppercase tracking-widest
                            `}
                          >
                            {letter}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 space-y-2">
                {KEYBOARD_ROWS.map((row) => (
                  <div key={row} className="flex justify-center gap-1.5">
                    {row.split("").map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => pushKey(key)}
                        className={`
                          ${keyPulse === key ? styles.keyPulse : ""}
                          ${keyboardTone(keyboardLegend[key])}
                          min-w-9 rounded-md border px-3 py-2 text-sm font-bold transition
                        `}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="flex justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => pushKey("ENTER")}
                    className="rounded-md border border-cyan-500/60 bg-cyan-500/20 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-500/30"
                  >
                    Enter
                  </button>
                  <button
                    type="button"
                    onClick={() => pushKey("BACKSPACE")}
                    className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="mt-5 text-center text-sm text-zinc-400">{notice}</p>
        </section>

        <aside className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5 md:p-6">
          <h2 className="text-xl font-bold text-zinc-100">Previous Games</h2>
          <p className="mt-1 text-sm text-zinc-400">Recent finished games for this player profile.</p>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-zinc-500">Loading history...</p>
            ) : previousGames.length === 0 ? (
              <p className="text-sm text-zinc-500">No games yet. Start the first one.</p>
            ) : (
              previousGames.map((game) => (
                <article key={game.gameId} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">{toReadableDifficulty(game.difficulty)}</p>
                      <p className={`text-sm font-semibold ${gameStatusTone(game)}`}>{gameStatusText(game)}</p>
                    </div>
                    <p className="text-xs text-zinc-500">{new Date(game.startedAt).toLocaleString()}</p>
                  </div>
                  {game.answer ? (
                    <p className="mt-2 text-sm text-zinc-300">
                      Answer: <span className="font-bold tracking-wide text-zinc-100">{game.answer.toUpperCase()}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">Answer hidden until game completes.</p>
                  )}
                </article>
              ))
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
