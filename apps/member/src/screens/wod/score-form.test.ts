import { describe, expect, it } from 'vitest';
import { EMPTY_SCORE_TEXT, parseScore, scoreToText } from './score-form';

describe('parseScore', () => {
  it('reads times, rounds and loads', () => {
    expect(parseScore('time', { ...EMPTY_SCORE_TEXT, time: '9:42' })).toMatchObject({
      ok: true,
      score: { timeSeconds: 582 },
    });
    expect(parseScore('rounds_reps', { ...EMPTY_SCORE_TEXT, rounds: '7', reps: '' })).toMatchObject(
      { ok: true, score: { rounds: 7, reps: 0 } },
    );
    expect(parseScore('load', { ...EMPTY_SCORE_TEXT, load: '62,5' })).toMatchObject({
      ok: true,
      score: { loadGrams: 62_500 },
    });
    expect(parseScore('calories', { ...EMPTY_SCORE_TEXT, value: '48' })).toMatchObject({
      ok: true,
      score: { calories: 48 },
    });
  });

  it('points at the field that is wrong', () => {
    expect(parseScore('time', { ...EMPTY_SCORE_TEXT, time: '9:99' })).toEqual({
      ok: false,
      field: 'time',
    });
    expect(parseScore('rounds_reps', EMPTY_SCORE_TEXT)).toEqual({ ok: false, field: 'rounds' });
  });

  it('round-trips a saved result into the inputs', () => {
    const parsed = parseScore('load', { ...EMPTY_SCORE_TEXT, load: '100' });
    if (!parsed.ok) throw new Error('expected a score');
    expect(scoreToText(parsed.score).load).toBe('100');
  });
});
