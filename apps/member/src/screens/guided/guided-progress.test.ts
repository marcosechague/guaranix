import type { GuidedPlan } from '@guaranix/shared';
import { describe, expect, it } from 'vitest';
import { NO_PROGRESS, advanceProgress, undoProgress } from './guided-progress';

const steps = [
  { quantity: '21', name: 'Thrusters' },
  { quantity: '21', name: 'Pull-ups' },
];
const forTime: GuidedPlan = { advance: 'steps', steps, sequence: steps, rounds: 1 };
const amrap: GuidedPlan = { advance: 'rounds', steps, sequence: steps, rounds: 1 };

describe('guided progress', () => {
  it('walks a For time step by step and finishes on the last tap', () => {
    const first = advanceProgress(NO_PROGRESS, forTime, 95);
    expect(first).toMatchObject({ finished: false, progress: { stepIndex: 1, splits: [95] } });
    const last = advanceProgress(first.progress, forTime, 180);
    expect(last).toMatchObject({ finished: true, progress: { stepIndex: 2, splits: [95, 180] } });
  });

  it('adds a round per tap in AMRAP and never finishes by tapping', () => {
    const tapped = advanceProgress(advanceProgress(NO_PROGRESS, amrap, 60).progress, amrap, 130);
    expect(tapped).toMatchObject({ finished: false, progress: { rounds: 2 } });
  });

  it('undoes a mis-tap without going below zero', () => {
    const { progress } = advanceProgress(NO_PROGRESS, forTime, 40);
    expect(undoProgress(progress, forTime)).toMatchObject({ stepIndex: 0, splits: [] });
    expect(undoProgress(NO_PROGRESS, amrap).rounds).toBe(0);
  });

  it('ignores taps when the clock drives the movements', () => {
    const emom: GuidedPlan = { ...amrap, advance: 'intervals' };
    expect(advanceProgress(NO_PROGRESS, emom, 10)).toEqual({
      progress: NO_PROGRESS,
      finished: false,
    });
  });
});
