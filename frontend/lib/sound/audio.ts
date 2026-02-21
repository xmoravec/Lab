const DEFAULT_ENABLED = true;

type OscillatorKind = OscillatorType;

export type ToneStep = {
  frequency: number;
  durationMs: number;
  gain?: number;
  type?: OscillatorKind;
};

let audioContextRef: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContextRef) {
    audioContextRef = new AudioContextCtor();
  }

  return audioContextRef;
}

export async function unlockAudioContext(): Promise<void> {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    await context.resume();
  }
}

export function playToneSequence(steps: ToneStep[], volume = 1): void {
  const context = getAudioContext();
  if (!context || steps.length === 0) {
    return;
  }

  const startAt = context.currentTime + 0.01;
  let cursor = startAt;

  for (const step of steps) {
    const durationSeconds = Math.max(0.01, step.durationMs / 1000);
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = step.type ?? "sine";
    oscillator.frequency.setValueAtTime(step.frequency, cursor);

    const stepGain = Math.max(0, Math.min(1, (step.gain ?? 0.15) * volume));
    gainNode.gain.setValueAtTime(0.0001, cursor);
    gainNode.gain.exponentialRampToValueAtTime(stepGain, cursor + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, cursor + durationSeconds);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(cursor);
    oscillator.stop(cursor + durationSeconds + 0.01);

    cursor += durationSeconds + 0.01;
  }
}

export function playSample(url: string, volume = 0.2): void {
  if (typeof window === "undefined") {
    return;
  }

  const audio = new Audio(url);
  audio.preload = "auto";
  audio.volume = Math.max(0, Math.min(1, volume));
  void audio.play().catch(() => {
    // Ignore autoplay rejections; playback will work after first interaction.
  });
}

export function loadSoundEnabled(settingKey: string): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_ENABLED;
  }

  const rawValue = window.localStorage.getItem(settingKey);
  if (rawValue === "0") {
    return false;
  }
  if (rawValue === "1") {
    return true;
  }

  return DEFAULT_ENABLED;
}

export function saveSoundEnabled(settingKey: string, enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(settingKey, enabled ? "1" : "0");
}
