"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchWordleMenu,
  startWordleGame,
  submitWordleGuess,
  type TileState,
  type WordleDifficulty,
  type WordleGameState,
} from "@/app/games/wordle/lib/api";
import { ApiRequestError } from "@/lib/http-client";

import styles from "./wordle.module.css";

const KEYBOARD_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

type KeyboardLegend = Record<string, TileState>;

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
  const [currentGame, setCurrentGame] = useState<WordleGameState | null>(null);
  const [previousGames, setPreviousGames] = useState<WordleGameState[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("Choose a difficulty and hit Play.");
  const [shakeTick, setShakeTick] = useState(0);
  const [keyPulse, setKeyPulse] = useState("");

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
        setDifficulty(menu.availableDifficulties[0] ?? "common");

        if (menu.activeGame) {
          setNotice("Resumed your latest active game.");
        } else {
          setNotice("Choose a difficulty and hit Play.");
        }
      } catch {
        console.error("Failed to bootstrap Wordle menu", {
          location: "WordlePage.bootstrap",
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

  const refreshHistory = useCallback(async () => {
    try {
      const menu = await fetchWordleMenu();
      setPreviousGames(menu.previousGames);
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
      setCurrentGuess("");
      setNotice(started.resumedExisting ? "Resumed existing game." : "New game started.");
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
    if (!currentGame || currentGame.status !== "in-progress" || isSubmitting) {
      return;
    }

    if (currentGuess.length !== wordLength) {
      setNotice(`Guess must be ${wordLength} letters.`);
      setShakeTick((value) => value + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitWordleGuess(currentGame.gameId, currentGuess.toLowerCase());
      setCurrentGame(response.game);

      if (!response.accepted) {
        if (response.message.toLowerCase().includes("word not found")) {
          setNotice("Not in word list.");
        } else {
          setNotice(response.message);
        }
        setShakeTick((value) => value + 1);
        return;
      }

      setCurrentGuess("");

      if (response.game.status === "won") {
        setNotice("Huge win. You cracked it.");
      } else if (response.game.status === "lost") {
        setNotice(`Round over. Answer: ${response.game.answer?.toUpperCase() ?? "unknown"}.`);
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
    } finally {
      setIsSubmitting(false);
    }
  }, [currentGame, currentGuess, isSubmitting, refreshHistory, wordLength]);

  const pushKey = useCallback((key: string) => {
    if (!currentGame || currentGame.status !== "in-progress") {
      return;
    }

    const normalized = key.toUpperCase();

    if (normalized === "BACKSPACE") {
      setCurrentGuess((previous) => previous.slice(0, -1));
      return;
    }

    if (normalized === "ENTER") {
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
    setKeyPulse(normalized);
    setTimeout(() => setKeyPulse(""), 140);
  }, [currentGame, submitGuess, wordLength]);

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
        </div>
        <Link href="/games" className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
          Back to games
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className={`${styles.glow} rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 md:p-7`}>
          {!currentGame ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-zinc-100">Ready to play?</h2>
                <p className="mt-2 text-zinc-400">Pick your difficulty, then smash the big button.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(["common", "extended"] as const).map((option) => (
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
                    onClick={() => void handleStart(true)}
                    className="rounded-md border border-zinc-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 hover:bg-zinc-800"
                  >
                    New game
                  </button>
                </div>
              </div>

              <div className="mx-auto max-w-md space-y-2">
                {boardRows.map((row, rowIndex) => {
                  const shouldShake = rowIndex === activeRowIndex && currentGame.status === "in-progress";

                  return (
                    <div
                      key={`${rowIndex}-${shakeTick}`}
                      className={`grid grid-cols-5 gap-2 ${shouldShake ? styles.rowShake : ""}`}
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
          <p className="mt-1 text-sm text-zinc-400">All sessions for now, no accounts yet.</p>

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
