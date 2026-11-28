import type { TimerCue } from '@guaranix/shared';

interface Tone {
  frequency: number;
  durationMs: number;
}

// Generated beeps: no audio files to download, so they also work offline on 3G.
const TONES: Record<TimerCue, Tone[]> = {
  tick: [{ frequency: 660, durationMs: 120 }],
  work: [{ frequency: 990, durationMs: 450 }],
  rest: [{ frequency: 440, durationMs: 450 }],
  done: [
    { frequency: 990, durationMs: 200 },
    { frequency: 990, durationMs: 200 },
    { frequency: 1320, durationMs: 600 },
  ],
};

const VIBRATIONS: Record<TimerCue, number | number[]> = {
  tick: 60,
  work: 300,
  rest: [120, 80, 120],
  done: [250, 120, 250, 120, 500],
};

const GAP_MS = 120;

type AudioContextConstructor = typeof AudioContext;

/** Plays the timer cues. Create it from a tap: browsers only allow audio after a gesture. */
export function createTimerFeedback() {
  let context: AudioContext | null = null;

  function audio(): AudioContext | null {
    if (context) return context;
    const Constructor: AudioContextConstructor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    context = Constructor ? new Constructor() : null;
    return context;
  }

  function beep(ctx: AudioContext, tone: Tone, startAt: number) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = tone.frequency;
    const end = startAt + tone.durationMs / 1000;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(end + 0.02);
  }

  return {
    /** Call inside the tap that starts the timer. */
    unlock() {
      void audio()?.resume();
    },
    play(cue: TimerCue, { sound, vibration }: { sound: boolean; vibration: boolean }) {
      if (vibration && 'vibrate' in navigator) navigator.vibrate(VIBRATIONS[cue]);
      const ctx = sound ? audio() : null;
      if (!ctx) return;
      let startAt = ctx.currentTime;
      for (const tone of TONES[cue]) {
        beep(ctx, tone, startAt);
        startAt += (tone.durationMs + GAP_MS) / 1000;
      }
    },
  };
}
