import { kilogramsToGrams, parseDuration, formatDuration } from '@guaranix/shared';
import type { ScoreValues } from '@guaranix/shared/api';
import type { ScoreType } from '@guaranix/shared/domain';

/** What the member types, as text, before it becomes a score. */
export interface ScoreText {
  time: string;
  rounds: string;
  reps: string;
  load: string;
  value: string;
}

export const EMPTY_SCORE_TEXT: ScoreText = { time: '', rounds: '', reps: '', load: '', value: '' };

const EMPTY_SCORE: ScoreValues = {
  timeSeconds: null,
  rounds: null,
  reps: null,
  loadGrams: null,
  distanceMeters: null,
  calories: null,
  points: null,
};

function wholeNumber(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

export type ScoreParse = { ok: true; score: ScoreValues } | { ok: false; field: keyof ScoreText };

export function parseScore(scoreType: ScoreType, text: ScoreText): ScoreParse {
  switch (scoreType) {
    case 'time': {
      const timeSeconds = parseDuration(text.time);
      return timeSeconds === null
        ? { ok: false, field: 'time' }
        : { ok: true, score: { ...EMPTY_SCORE, timeSeconds } };
    }
    case 'rounds_reps': {
      const rounds = wholeNumber(text.rounds);
      const reps = wholeNumber(text.reps || '0');
      if (rounds === null) return { ok: false, field: 'rounds' };
      if (reps === null) return { ok: false, field: 'reps' };
      return { ok: true, score: { ...EMPTY_SCORE, rounds, reps } };
    }
    case 'load': {
      const loadGrams = kilogramsToGrams(text.load);
      return loadGrams === null
        ? { ok: false, field: 'load' }
        : { ok: true, score: { ...EMPTY_SCORE, loadGrams } };
    }
    case 'reps':
    case 'distance':
    case 'calories':
    case 'points': {
      const value = wholeNumber(text.value);
      if (value === null) return { ok: false, field: 'value' };
      const column = {
        reps: 'reps',
        distance: 'distanceMeters',
        calories: 'calories',
        points: 'points',
      } as const;
      return { ok: true, score: { ...EMPTY_SCORE, [column[scoreType]]: value } };
    }
    case 'none':
      return { ok: true, score: EMPTY_SCORE };
  }
}

/** What `parseResult` needs from the part being scored. */
export interface ScoredPart {
  scoreType: ScoreType;
  movementId: string | null;
}

/** Parts based on a movement (but not scored by load) can also take the load used. */
export function takesUsedLoad(part: ScoredPart): boolean {
  return part.scoreType !== 'load' && part.scoreType !== 'none' && part.movementId !== null;
}

/** The score plus, when the part takes it, the optional load used (e.g. from the guided mode). */
export function parseResult(part: ScoredPart, text: ScoreText): ScoreParse {
  const parsed = parseScore(part.scoreType, text);
  if (!parsed.ok || !takesUsedLoad(part) || text.load.trim() === '') return parsed;
  const loadGrams = kilogramsToGrams(text.load);
  return loadGrams === null
    ? { ok: false, field: 'load' }
    : { ok: true, score: { ...parsed.score, loadGrams } };
}

/** Fills the inputs back from a saved result, so editing starts from it. */
export function scoreToText(score: ScoreValues): ScoreText {
  const value = score.reps ?? score.distanceMeters ?? score.calories ?? score.points;
  return {
    time: score.timeSeconds === null ? '' : formatDuration(score.timeSeconds),
    rounds: score.rounds === null ? '' : String(score.rounds),
    reps: score.reps === null ? '' : String(score.reps),
    load: score.loadGrams === null ? '' : String(score.loadGrams / 1000).replace('.', ','),
    value: value === null ? '' : String(value),
  };
}
