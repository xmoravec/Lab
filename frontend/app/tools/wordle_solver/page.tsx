"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  solveWordle,
  type SolverClueRow,
  type SolverDifficulty,
  type WordleSolverResponse,
} from "@/app/tools/lib/api";

type UiClueRow = {
  id: number;
  greenLetters: string[];
  yellowLetters: string;
  grayLetters: string;
};

const WORD_LENGTH = 5;
const MAX_ROWS = 6;

function makeRow(id: number): UiClueRow {
  return {
    id,
    greenLetters: Array.from({ length: WORD_LENGTH }, () => ""),
    yellowLetters: "",
    grayLetters: "",
  };
}

function sanitizeLetters(value: string): string {
  return value.replace(/[^a-zA-Z]/g, "").toLowerCase();
}

function greenPattern(row: UiClueRow): string {
  return row.greenLetters.map((letter) => letter || "_").join("");
}

function rowIsUsed(row: UiClueRow): boolean {
  return (
    row.greenLetters.some((letter) => letter.length > 0) ||
    row.yellowLetters.length > 0 ||
    row.grayLetters.length > 0
  );
}

function toLetterSet(value: string): Set<string> {
  return new Set(value.split("").filter((letter) => letter.length > 0));
}

function overlapLetters(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((letter) => right.has(letter)).sort();
}

function collectValidationIssues(rows: UiClueRow[]): string[] {
  const issues: string[] = [];
  const includedLetters = new Set<string>();
  const excludedLetters = new Set<string>();

  rows.forEach((row, rowIndex) => {
    const greens = new Set(row.greenLetters.filter((letter) => letter.length > 0));
    const yellows = toLetterSet(row.yellowLetters);
    const grays = toLetterSet(row.grayLetters);

    const greenYellowOverlap = overlapLetters(greens, yellows);
    if (greenYellowOverlap.length > 0) {
      issues.push(`Row ${rowIndex + 1}: letters cannot be both green and yellow (${greenYellowOverlap.join(", ")}).`);
    }

    const greenGrayOverlap = overlapLetters(greens, grays);
    if (greenGrayOverlap.length > 0) {
      issues.push(`Row ${rowIndex + 1}: letters cannot be both green and gray (${greenGrayOverlap.join(", ")}).`);
    }

    const yellowGrayOverlap = overlapLetters(yellows, grays);
    if (yellowGrayOverlap.length > 0) {
      issues.push(`Row ${rowIndex + 1}: letters cannot be both yellow and gray (${yellowGrayOverlap.join(", ")}).`);
    }

    greens.forEach((letter) => includedLetters.add(letter));
    yellows.forEach((letter) => includedLetters.add(letter));
    grays.forEach((letter) => excludedLetters.add(letter));
  });

  const globalOverlap = overlapLetters(includedLetters, excludedLetters);
  if (globalOverlap.length > 0) {
    issues.push(`Global conflict: letters cannot be both included and excluded (${globalOverlap.join(", ")}).`);
  }

  return issues;
}

export default function WordleSolverToolPage() {
  const [difficulty, setDifficulty] = useState<SolverDifficulty>("common");
  const [rows, setRows] = useState<UiClueRow[]>([makeRow(1), makeRow(2), makeRow(3)]);
  const [maxSuggestions, setMaxSuggestions] = useState(12);
  const [isSolving, setIsSolving] = useState(false);
  const [message, setMessage] = useState("Enter clue rows, then press Check.");
  const [result, setResult] = useState<WordleSolverResponse | null>(null);

  const usedCount = useMemo(() => rows.filter(rowIsUsed).length, [rows]);
  const validationIssues = useMemo(() => collectValidationIssues(rows), [rows]);

  function updateGreenLetter(rowId: number, index: number, value: string): void {
    const nextLetter = sanitizeLetters(value).slice(0, 1);
    setRows((previous) =>
      previous.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const nextGreenLetters = row.greenLetters.map((letter, letterIndex) => {
          if (letterIndex !== index) {
            return letter;
          }
          return nextLetter;
        });

        return {
          ...row,
          greenLetters: nextGreenLetters,
        };
      }),
    );
  }

  function updateRowText(rowId: number, field: "yellowLetters" | "grayLetters", value: string): void {
    const nextValue = sanitizeLetters(value);
    setRows((previous) =>
      previous.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: nextValue,
            }
          : row,
      ),
    );
  }

  function addRow(): void {
    setRows((previous) => {
      if (previous.length >= MAX_ROWS) {
        return previous;
      }
      const nextId = previous[previous.length - 1]?.id ?? 0;
      return [...previous, makeRow(nextId + 1)];
    });
  }

  function removeRow(rowId: number): void {
    setRows((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      return previous.filter((row) => row.id !== rowId);
    });
  }

  function resetRows(): void {
    setRows([makeRow(1), makeRow(2), makeRow(3)]);
    setResult(null);
    setMessage("Solver reset. Add clues and check again.");
  }

  async function runSolver(): Promise<void> {
    const clueRows: SolverClueRow[] = rows
      .filter(rowIsUsed)
      .map((row) => ({
        greenPattern: greenPattern(row),
        yellowLetters: row.yellowLetters,
        grayLetters: row.grayLetters,
      }));

    if (clueRows.length === 0) {
      setMessage("Add at least one clue row before checking.");
      return;
    }

    if (validationIssues.length > 0) {
      setMessage("Fix validation issues before checking.");
      return;
    }

    setIsSolving(true);
    try {
      const response = await solveWordle({
        difficulty,
        clueRows,
        maxSuggestions,
      });
      setResult(response);

      if (response.candidateCount === 0) {
        setMessage("No words match these clues. Try loosening gray/yellow constraints.");
      } else {
        setMessage(`Found ${response.candidateCount} matching candidates.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Solver request failed.");
    } finally {
      setIsSolving(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16 pt-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Tools · Wordle</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-zinc-100">Wordle Solver</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Enter known clues: green letters by position, yellow letters contained somewhere, and gray letters excluded.
          </p>
        </div>
        <Link href="/tools" className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
          Back to tools
        </Link>
      </div>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 md:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDifficulty("common")}
              className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                difficulty === "common"
                  ? "border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-100"
                  : "border-zinc-600 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              Common
            </button>
            <button
              type="button"
              onClick={() => setDifficulty("extended")}
              className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                difficulty === "extended"
                  ? "border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-100"
                  : "border-zinc-600 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              Extended
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.14em] text-zinc-500">Suggestions</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxSuggestions}
              onChange={(event) => setMaxSuggestions(Math.min(50, Math.max(1, Number(event.target.value) || 1)))}
              className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
            />
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {row.greenLetters.map((letter, index) => (
                    <input
                      key={`${row.id}-g-${index}`}
                      value={letter.toUpperCase()}
                      onChange={(event) => updateGreenLetter(row.id, index, event.target.value)}
                      maxLength={1}
                      placeholder="_"
                      className="h-10 w-10 rounded-md border border-emerald-500/50 bg-emerald-500/10 text-center text-sm font-black uppercase text-emerald-100"
                      title={`Green position ${index + 1}`}
                    />
                  ))}
                </div>

                <input
                  value={row.yellowLetters.toUpperCase()}
                  onChange={(event) => updateRowText(row.id, "yellowLetters", event.target.value)}
                  placeholder="Yellow letters"
                  className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm uppercase tracking-[0.08em] text-amber-100"
                />

                <input
                  value={row.grayLetters.toUpperCase()}
                  onChange={(event) => updateRowText(row.id, "grayLetters", event.target.value)}
                  placeholder="Gray letters"
                  className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm uppercase tracking-[0.08em] text-zinc-200"
                />

                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                  className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= MAX_ROWS}
            className="rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
          >
            Add row
          </button>
          <button
            type="button"
            onClick={() => void runSolver()}
            disabled={isSolving || validationIssues.length > 0}
            className="rounded-md border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
          >
            {isSolving ? "Checking..." : "Check"}
          </button>
          <button
            type="button"
            onClick={resetRows}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-200 hover:bg-zinc-700"
          >
            Reset
          </button>
        </div>

        <p className="mt-4 text-sm text-zinc-300">{message}</p>
        <p className="mt-1 text-xs text-zinc-500">{usedCount} clue row(s) active.</p>
        {validationIssues.length > 0 ? (
          <div className="mt-4 rounded-xl border border-rose-500/50 bg-rose-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-200">Validation issues</p>
            <ul className="mt-2 space-y-1 text-sm text-rose-100">
              {validationIssues.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6">
          <h2 className="text-xl font-bold text-zinc-100">Top Suggestions</h2>
          {result?.suggestions.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {result.suggestions.map((item, index) => (
                <div key={item.word} className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">#{index + 1}</p>
                  <p className="mt-1 text-2xl font-black tracking-[0.16em] text-zinc-100">{item.word.toUpperCase()}</p>
                  <p className="mt-1 text-xs text-zinc-400">Score {item.score.toFixed(3)} · Unique {item.uniqueLetters}/5</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">Run Check to see ranked suggestions.</p>
          )}
        </article>

        <article className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6">
          <h2 className="text-xl font-bold text-zinc-100">Candidate Snapshot</h2>
          {result ? (
            <>
              <p className="mt-2 text-sm text-zinc-300">
                {result.candidateCount} candidate(s) · Source {result.wordBankSource}
              </p>
              {result.wordBankNotice ? (
                <p className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {result.wordBankNotice}
                </p>
              ) : null}
              <div className="mt-4 flex max-h-72 flex-wrap gap-2 overflow-y-auto">
                {result.candidatesPreview.length > 0 ? (
                  result.candidatesPreview.map((word) => (
                    <span key={word} className="rounded-full border border-zinc-700 bg-zinc-950/80 px-2.5 py-1 text-xs text-zinc-300">
                      {word.toUpperCase()}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No preview candidates.</p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">No solver output yet.</p>
          )}
        </article>
      </section>
    </main>
  );
}
