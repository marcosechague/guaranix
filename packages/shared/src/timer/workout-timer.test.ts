import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_SECONDS,
  type TimerPlan,
  timerCue,
  timerPlanFor,
  timerSnapshot,
  timerTotalSeconds,
} from './workout-timer';

const at = (seconds: number) => (COUNTDOWN_SECONDS + seconds) * 1000;
const source = {
  timeCapSeconds: null,
  rounds: null,
  intervalSeconds: null,
  workSeconds: null,
  restSeconds: null,
};

describe('timerPlanFor', () => {
  it('fills Tabata and EMOM defaults', () => {
    expect(timerPlanFor({ ...source, timerType: 'tabata' })).toEqual({
      type: 'tabata',
      rounds: 8,
      workSeconds: 20,
      restSeconds: 10,
    });
    expect(timerPlanFor({ ...source, timerType: 'emom', timeCapSeconds: 600 })).toEqual({
      type: 'emom',
      rounds: 10,
      intervalSeconds: 60,
    });
  });

  it('needs a duration for an AMRAP and nothing for no timer', () => {
    expect(timerPlanFor({ ...source, timerType: 'amrap' })).toBeNull();
    expect(timerPlanFor({ ...source, timerType: 'none' })).toBeNull();
    expect(timerPlanFor({ ...source, timerType: 'for_time', timeCapSeconds: 0 })).toEqual({
      type: 'for_time',
      capSeconds: null,
    });
  });
});

describe('timerSnapshot', () => {
  const tabata: TimerPlan = { type: 'tabata', rounds: 8, workSeconds: 20, restSeconds: 10 };

  it('counts the countdown down before going', () => {
    const snapshot = timerSnapshot(tabata, 0);
    expect(snapshot.phase).toBe('countdown');
    expect(snapshot.clockSeconds).toBe(COUNTDOWN_SECONDS);
    expect(timerSnapshot(tabata, at(-0.5)).clockSeconds).toBe(1);
  });

  it('walks Tabata rounds and skips the last rest', () => {
    expect(timerTotalSeconds(tabata)).toBe(8 * 20 + 7 * 10);
    expect(timerSnapshot(tabata, at(0))).toMatchObject({
      phase: 'work',
      round: 1,
      clockSeconds: 20,
    });
    expect(timerSnapshot(tabata, at(25))).toMatchObject({
      phase: 'rest',
      round: 1,
      clockSeconds: 5,
    });
    expect(timerSnapshot(tabata, at(30))).toMatchObject({ phase: 'work', round: 2 });
    expect(timerSnapshot(tabata, at(225))).toMatchObject({
      phase: 'work',
      round: 8,
      clockSeconds: 5,
    });
    expect(timerSnapshot(tabata, at(230))).toMatchObject({ phase: 'done', progress: 1 });
  });

  it('counts EMOM minutes down and AMRAP down to zero', () => {
    const emom: TimerPlan = { type: 'emom', rounds: 10, intervalSeconds: 60 };
    expect(timerSnapshot(emom, at(61))).toMatchObject({ round: 2, clockSeconds: 59 });
    const amrap: TimerPlan = { type: 'amrap', durationSeconds: 720 };
    expect(timerSnapshot(amrap, at(120)).clockSeconds).toBe(600);
    expect(timerSnapshot(amrap, at(720)).phase).toBe('done');
  });

  it('counts For time up and stops at the cap', () => {
    const capped: TimerPlan = { type: 'for_time', capSeconds: 900 };
    expect(timerSnapshot(capped, at(542.7)).clockSeconds).toBe(542);
    expect(timerSnapshot(capped, at(901))).toMatchObject({ phase: 'done', clockSeconds: 900 });
    const open: TimerPlan = { type: 'for_time', capSeconds: null };
    const late = timerSnapshot(open, at(5000));
    expect(late).toMatchObject({ phase: 'work', progress: null, phaseRemainingSeconds: null });
  });
});

describe('timerCue', () => {
  const tabata: TimerPlan = { type: 'tabata', rounds: 2, workSeconds: 20, restSeconds: 10 };
  const cue = (from: number, to: number) =>
    timerCue(timerSnapshot(tabata, at(from)), timerSnapshot(tabata, at(to)));

  it('beeps the last three seconds of each phase', () => {
    expect(cue(-3.5, -2.5)).toBe('tick');
    expect(cue(16.5, 17.5)).toBe('tick');
    expect(cue(10, 11)).toBeNull();
  });

  it('marks work, rest and the end once', () => {
    expect(cue(-0.2, 0.1)).toBe('work');
    expect(cue(19.9, 20.1)).toBe('rest');
    expect(cue(29.9, 30.1)).toBe('work');
    expect(cue(49.9, 50.1)).toBe('done');
    expect(cue(50.1, 52)).toBeNull();
  });
});
