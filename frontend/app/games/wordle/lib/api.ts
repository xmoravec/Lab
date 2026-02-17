import { requestAppJson } from "@/lib/app-http-client";

export type WordleDifficulty = "common" | "extended";
export type TileState = "absent" | "present" | "correct";
export type WordleStatus = "in-progress" | "won" | "lost";

export type GuessEvaluation = {
  letter: string;
  state: TileState;
};

export type GuessRecord = {
  guess: string;
  evaluations: GuessEvaluation[];
  submittedAt: string;
};

export type WordleGameState = {
  gameId: string;
  difficulty: WordleDifficulty;
  status: WordleStatus;
  maxAttempts: number;
  attemptsUsed: number;
  wordLength: number;
  board: GuessRecord[];
  startedAt: string;
  completedAt?: string | null;
  answer?: string | null;
  wordBankSource: "wordfreq" | "fallback";
  limitedWordBank: boolean;
  wordBankNotice?: string | null;
};

export type WordleMenuResponse = {
  availableDifficulties: WordleDifficulty[];
  activeGame?: WordleGameState | null;
  previousGames: WordleGameState[];
  limitedWordBank: boolean;
  wordBankNotice?: string | null;
};

export type StartWordleResponse = {
  resumedExisting: boolean;
  game: WordleGameState;
};

export type GuessWordleResponse = {
  game: WordleGameState;
  accepted: boolean;
  message: string;
};

export async function fetchWordleMenu(): Promise<WordleMenuResponse> {
  return requestAppJson<WordleMenuResponse>("/api/wordle/menu");
}

export async function startWordleGame(
  difficulty: WordleDifficulty,
  forceNew = false,
): Promise<StartWordleResponse> {
  return requestAppJson<StartWordleResponse>("/api/wordle/start", {
    method: "POST",
    body: JSON.stringify({ difficulty, forceNew }),
  });
}

export async function submitWordleGuess(
  gameId: string,
  guess: string,
): Promise<GuessWordleResponse> {
  return requestAppJson<GuessWordleResponse>("/api/wordle/guess", {
    method: "POST",
    body: JSON.stringify({ gameId, guess }),
  });
}
