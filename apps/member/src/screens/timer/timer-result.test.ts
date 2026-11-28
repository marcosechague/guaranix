import { describe, expect, it } from 'vitest';
import { readTimerResult, timerResultState } from './timer-result';

describe('timer result hand-off', () => {
  it('round-trips a time and AMRAP rounds', () => {
    expect(readTimerResult(timerResultState('c1', { timeSeconds: 542 }))).toEqual({
      componentId: 'c1',
      score: { time: '9:02' },
    });
    expect(readTimerResult(timerResultState('c2', { rounds: 7 }))).toEqual({
      componentId: 'c2',
      score: { rounds: '7' },
    });
  });

  it('ignores anything else in router state', () => {
    expect(readTimerResult(null)).toBeNull();
    expect(readTimerResult({ timerResult: { componentId: 3, score: {} } })).toBeNull();
    expect(
      readTimerResult({ timerResult: { componentId: 'c1', score: { time: 5, notes: 'x' } } }),
    ).toEqual({ componentId: 'c1', score: {} });
  });
});
