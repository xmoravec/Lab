import { requestAppJson } from "@/lib/app-http-client";

export type SolverMark = "correct" | "present" | "absent";
export type SolverDifficulty = "common" | "extended";

export type SolverClueRow = {
  greenPattern: string;
  yellowLetters: string;
  grayLetters: string;
};

export type SolverSuggestion = {
  word: string;
  score: number;
  uniqueLetters: number;
};

export type WordleSolverResponse = {
  difficulty: SolverDifficulty;
  candidateCount: number;
  suggestions: SolverSuggestion[];
  candidatesPreview: string[];
  wordBankSource: "wordfreq" | "fallback";
  limitedWordBank: boolean;
  wordBankNotice?: string | null;
};

export async function solveWordle(payload: {
  difficulty: SolverDifficulty;
  clueRows: SolverClueRow[];
  maxSuggestions?: number;
}): Promise<WordleSolverResponse> {
  return requestAppJson<WordleSolverResponse>("/api/tools/wordle-solver", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
