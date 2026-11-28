import type { ScoreType } from '../domain/enums';

/** `342` → `5:42`; hours only when needed (`1:02:05`). */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Reads `m:ss`, `h:mm:ss` or plain minutes; null when it isn't a valid time. */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length === 0 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((value) => value >= 60)) return null;
  const seconds =
    numbers.length === 1
      ? (numbers[0] ?? 0) * 60
      : numbers.reduce((total, value) => total * 60 + value, 0);
  return seconds > 0 ? seconds : null;
}

/** Loads are stored in grams so 62.5 kg stays an integer. */
export function formatKilograms(grams: number): string {
  const kilograms = grams / 1000;
  return `${Number.isInteger(kilograms) ? kilograms : kilograms.toFixed(1).replace('.', ',')} kg`;
}

export function kilogramsToGrams(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 1000) : null;
}

interface ScoreParts {
  timeSeconds: number | null;
  rounds: number | null;
  reps: number | null;
  loadGrams: number | null;
  distanceMeters: number | null;
  calories: number | null;
  points: number | null;
}

/** The headline number of a result, e.g. `5:42`, `7 + 12`, `120 kg`. */
export function formatScore(scoreType: ScoreType, score: ScoreParts): string {
  switch (scoreType) {
    case 'time':
      return score.timeSeconds === null ? '—' : formatDuration(score.timeSeconds);
    case 'rounds_reps':
      return `${score.rounds ?? 0} + ${score.reps ?? 0}`;
    case 'reps':
      return `${score.reps ?? 0}`;
    case 'load':
      return score.loadGrams === null ? '—' : formatKilograms(score.loadGrams);
    case 'distance':
      return `${score.distanceMeters ?? 0} m`;
    case 'calories':
      return `${score.calories ?? 0} cal`;
    case 'points':
      return `${score.points ?? 0}`;
    case 'none':
      return '—';
  }
}
