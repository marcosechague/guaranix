import { describe, expect, it } from 'vitest';
import { guidedPlanFor, intervalStep, roundsFromDescription } from './guided-plan';

const twoSteps = '10 Burpees\n15 Air squats';
const source = (description: string, rounds: number | null = null) => ({
  description,
  guidedSteps: null,
  rounds,
});

describe('guidedPlanFor', () => {
  it('cannot guide a part without timer or movements', () => {
    expect(guidedPlanFor(source(twoSteps), null)).toBeNull();
    expect(guidedPlanFor(source('Técnica'), { type: 'for_time', capSeconds: null })).toBeNull();
  });

  it('repeats the steps once per round in For time', () => {
    const plan = guidedPlanFor(source(`3 rounds for time\n${twoSteps}`), {
      type: 'for_time',
      capSeconds: 900,
    });
    expect(plan?.advance).toBe('steps');
    expect(plan?.rounds).toBe(3);
    expect(plan?.sequence).toHaveLength(6);
  });

  it("uses the coach's rounds over the description", () => {
    const plan = guidedPlanFor(source(`5 rondas\n${twoSteps}`, 2), {
      type: 'for_time',
      capSeconds: null,
    });
    expect(plan?.sequence).toHaveLength(4);
  });

  it('counts rounds by tap in AMRAP and moves with the clock in EMOM', () => {
    expect(guidedPlanFor(source(twoSteps), { type: 'amrap', durationSeconds: 600 })?.advance).toBe(
      'rounds',
    );
    const emom = guidedPlanFor(source(twoSteps), { type: 'emom', rounds: 10, intervalSeconds: 60 });
    expect(emom?.advance).toBe('intervals');
    expect(emom && intervalStep(emom, 1)?.name).toBe('Burpees');
    expect(emom && intervalStep(emom, 2)?.name).toBe('Air squats');
    expect(emom && intervalStep(emom, 3)?.name).toBe('Burpees');
  });
});

describe('roundsFromDescription', () => {
  it('reads Spanish and English round counts', () => {
    expect(roundsFromDescription('5 rondas por tiempo')).toBe(5);
    expect(roundsFromDescription('3 RFT')).toBe(3);
    expect(roundsFromDescription('21 Thrusters')).toBeNull();
  });
});
