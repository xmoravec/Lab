import { requestAppJson } from "@/lib/app-http-client";

export type ChessMode = "multiplayer" | "self-play" | "bot";
export type ChessColor = "white" | "black";
export type BotDifficulty = "easy" | "medium" | "hard";
export type ChessInvitationStatus = "pending" | "accepted" | "declined" | "canceled";
export type InvitationColorPreference = "white" | "black" | "random";
export type ChessMatchStatus = "active" | "checkmate" | "stalemate" | "draw" | "timeout";

export type ChessMoveRecord = {
  moveNumber: number;
  uci: string;
  san: string;
  byColor: ChessColor;
  playedByUserId?: string | null;
  playedAt: string;
  fenAfter: string;
};

export type ChessMatchSummary = {
  matchId: string;
  mode: ChessMode;
  status: ChessMatchStatus;
  whiteUserId?: string | null;
  whiteUsername: string;
  blackUserId?: string | null;
  blackUsername: string;
  turnColor: ChessColor;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  winnerUserId?: string | null;
  timeControlSeconds: number;
  whiteTimeRemainingSeconds: number;
  blackTimeRemainingSeconds: number;
  clockStartedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChessMatchState = {
  summary: ChessMatchSummary;
  fen: string;
  board: string[][];
  legalMoves: string[];
  inCheck: boolean;
  history: ChessMoveRecord[];
  myColor?: ChessColor | null;
  canSubmitMoves: boolean;
};

export type ChessInvitationSummary = {
  invitationId: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  colorPreference: InvitationColorPreference;
  timeControlSeconds: number;
  status: ChessInvitationStatus;
  createdAt: string;
  respondedAt?: string | null;
  matchId?: string | null;
};

export type ChessMenuResponse = {
  incomingInvitations: ChessInvitationSummary[];
  outgoingInvitations: ChessInvitationSummary[];
  activeMatches: ChessMatchSummary[];
};

export type RespondChessInvitationResponse = {
  invitation: ChessInvitationSummary;
  match?: ChessMatchSummary | null;
};

export type StartChessMatchResponse = {
  match: ChessMatchSummary;
};

export type SubmitChessMoveResponse = {
  accepted: boolean;
  message: string;
  match: ChessMatchState;
};

export type ChessAction =
  | "bootstrap"
  | "send-invitation"
  | "respond-invitation"
  | "start-self-play"
  | "start-bot"
  | "load-match"
  | "submit-move";

export type ChessActionResponse = {
  action: ChessAction;
  menu?: ChessMenuResponse | null;
  invitation?: ChessInvitationSummary | null;
  invitationResponse?: RespondChessInvitationResponse | null;
  startedMatch?: StartChessMatchResponse | null;
  matchState?: ChessMatchState | null;
  moveResult?: SubmitChessMoveResponse | null;
};

type ChessActionPayload = {
  action: ChessAction;
  toUsername?: string;
  colorPreference?: InvitationColorPreference;
  invitationTimeControlSeconds?: number;
  invitationId?: string;
  invitationResponseAction?: "accept" | "decline";
  playAs?: "white" | "black" | "random";
  botDifficulty?: BotDifficulty;
  timeControlSeconds?: number;
  matchId?: string;
  fromSquare?: string;
  toSquare?: string;
  promotion?: "q" | "r" | "b" | "n";
};

async function chessAction(payload: ChessActionPayload): Promise<ChessActionResponse> {
  return requestAppJson<ChessActionResponse>("/api/chess", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchChessMenu(): Promise<ChessMenuResponse> {
  const response = await chessAction({ action: "bootstrap" });
  return response.menu ?? {
    incomingInvitations: [],
    outgoingInvitations: [],
    activeMatches: [],
  };
}

export async function sendChessInvitation(
  toUsername: string,
  colorPreference: InvitationColorPreference,
  timeControlSeconds: number,
): Promise<ChessInvitationSummary> {
  const response = await chessAction({
    action: "send-invitation",
    toUsername,
    colorPreference,
    invitationTimeControlSeconds: timeControlSeconds,
  });
  if (!response.invitation) {
    throw new Error("Missing invitation response");
  }
  return response.invitation;
}

export async function respondChessInvitation(
  invitationId: string,
  action: "accept" | "decline",
): Promise<RespondChessInvitationResponse> {
  const response = await chessAction({
    action: "respond-invitation",
    invitationId,
    invitationResponseAction: action,
  });
  if (!response.invitationResponse) {
    throw new Error("Missing invitation response payload");
  }
  return response.invitationResponse;
}

export async function startChessSelfPlay(timeControlSeconds: number): Promise<StartChessMatchResponse> {
  const response = await chessAction({
    action: "start-self-play",
    timeControlSeconds,
  });
  if (!response.startedMatch) {
    throw new Error("Missing started match payload");
  }
  return response.startedMatch;
}

export async function startChessBot(
  playAs: "white" | "black" | "random",
  botDifficulty: BotDifficulty,
  timeControlSeconds: number,
): Promise<StartChessMatchResponse> {
  const response = await chessAction({
    action: "start-bot",
    playAs,
    botDifficulty,
    timeControlSeconds,
  });
  if (!response.startedMatch) {
    throw new Error("Missing started match payload");
  }
  return response.startedMatch;
}

export async function fetchChessMatch(matchId: string): Promise<ChessMatchState> {
  const response = await chessAction({
    action: "load-match",
    matchId,
  });
  if (!response.matchState) {
    throw new Error("Missing match state payload");
  }
  return response.matchState;
}

export async function submitChessMove(params: {
  matchId: string;
  fromSquare: string;
  toSquare: string;
  promotion?: "q" | "r" | "b" | "n";
}): Promise<SubmitChessMoveResponse> {
  const response = await chessAction({
    action: "submit-move",
    matchId: params.matchId,
    fromSquare: params.fromSquare,
    toSquare: params.toSquare,
    promotion: params.promotion,
  });
  if (!response.moveResult) {
    throw new Error("Missing move result payload");
  }
  return response.moveResult;
}
