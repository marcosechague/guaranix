import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatKilograms,
  formatScore,
  kilogramsToGrams,
  parseDuration,
} from './scores';

const empty = {
  timeSeconds: null,
  rounds: null,
  reps: null,
  loadGrams: null,
  distanceMeters: null,
  calories: null,
  points: null,
};

describe('score formatting', () => {
  it('formats and parses durations', () => {
    expect(formatDuration(342)).toBe('5:42');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(parseDuration('5:42')).toBe(342);
    expect(parseDuration('1:02:05')).toBe(3725);
    expect(parseDuration('12')).toBe(720);
    expect(parseDuration('5:75')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('0:00')).toBeNull();
  });

  it('keeps loads in grams', () => {
    expect(formatKilograms(120_000)).toBe('120 kg');
    expect(formatKilograms(62_500)).toBe('62,5 kg');
    expect(kilogramsToGrams('62,5')).toBe(62_500);
    expect(kilogramsToGrams('-3')).toBeNull();
  });

  it('shows the headline of each score type', () => {
    expect(formatScore('time', { ...empty, timeSeconds: 342 })).toBe('5:42');
    expect(formatScore('rounds_reps', { ...empty, rounds: 7, reps: 12 })).toBe('7 + 12');
    expect(formatScore('load', { ...empty, loadGrams: 100_000 })).toBe('100 kg');
  });
});
