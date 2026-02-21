import { playSample, playToneSequence } from "@/lib/sound/audio";

type WordleSoundEvent =
  | "key"
  | "delete"
  | "invalid"
  | "submit"
  | "hint"
  | "start"
  | "win"
  | "lose";

type ChessSoundEvent =
  | "select"
  | "move"
  | "capture"
  | "check"
  | "castle"
  | "illegal"
  | "game-end";

const CHESS_SAMPLE_PATHS: Record<ChessSoundEvent, string> = {
  select: "/assets/sounds/chess/select.wav",
  move: "/assets/sounds/chess/move.wav",
  capture: "/assets/sounds/chess/capture.wav",
  check: "/assets/sounds/chess/check.wav",
  castle: "/assets/sounds/chess/castle.wav",
  illegal: "/assets/sounds/chess/illegal.wav",
  "game-end": "/assets/sounds/chess/game_end.wav",
};

export function playWordleSound(effect: WordleSoundEvent, enabled: boolean): void {
  if (!enabled) {
    return;
  }

  if (effect === "key") {
    playToneSequence([{ frequency: 620, durationMs: 30, gain: 0.1, type: "triangle" }], 1);
    return;
  }

  if (effect === "delete") {
    playToneSequence([{ frequency: 420, durationMs: 40, gain: 0.11, type: "triangle" }], 1);
    return;
  }

  if (effect === "invalid") {
    playToneSequence(
      [
        { frequency: 220, durationMs: 70, gain: 0.12, type: "square" },
        { frequency: 190, durationMs: 70, gain: 0.1, type: "square" },
      ],
      1,
    );
    return;
  }

  if (effect === "submit") {
    playToneSequence([{ frequency: 500, durationMs: 60, gain: 0.12, type: "sine" }], 1);
    return;
  }

  if (effect === "hint") {
    playToneSequence(
      [
        { frequency: 540, durationMs: 70, gain: 0.11, type: "sine" },
        { frequency: 680, durationMs: 80, gain: 0.12, type: "sine" },
      ],
      1,
    );
    return;
  }

  if (effect === "start") {
    playToneSequence(
      [
        { frequency: 460, durationMs: 60, gain: 0.1, type: "triangle" },
        { frequency: 580, durationMs: 70, gain: 0.1, type: "triangle" },
      ],
      1,
    );
    return;
  }

  if (effect === "win") {
    playToneSequence(
      [
        { frequency: 523, durationMs: 90, gain: 0.13, type: "sine" },
        { frequency: 659, durationMs: 95, gain: 0.13, type: "sine" },
        { frequency: 784, durationMs: 120, gain: 0.14, type: "sine" },
      ],
      1,
    );
    return;
  }

  playToneSequence(
    [
      { frequency: 420, durationMs: 90, gain: 0.12, type: "triangle" },
      { frequency: 320, durationMs: 95, gain: 0.11, type: "triangle" },
      { frequency: 240, durationMs: 120, gain: 0.1, type: "triangle" },
    ],
    1,
  );
}

export function playChessSound(effect: ChessSoundEvent, enabled: boolean): void {
  if (!enabled) {
    return;
  }

  const samplePath = CHESS_SAMPLE_PATHS[effect];
  const volume = effect === "illegal" ? 0.22 : effect === "check" ? 0.2 : 0.16;
  playSample(samplePath, volume);
}
