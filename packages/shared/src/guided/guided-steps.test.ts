import { describe, expect, it } from 'vitest';
import { guidedStepsFor, parseGuidedSteps } from './guided-steps';

describe('parseGuidedSteps', () => {
  it('reads one movement per line with its quantity', () => {
    expect(parseGuidedSteps('For time:\n21 Thrusters\n21 Pull-ups\n400 m Run\nRow 500m')).toEqual([
      { quantity: '21', name: 'Thrusters' },
      { quantity: '21', name: 'Pull-ups' },
      { quantity: '400 m', name: 'Run' },
      { quantity: '500m', name: 'Row' },
    ]);
  });

  it('expands a rep scheme over the movements below it', () => {
    expect(parseGuidedSteps('21-15-9\nThrusters\nPull-ups')).toEqual([
      { quantity: '21', name: 'Thrusters' },
      { quantity: '21', name: 'Pull-ups' },
      { quantity: '15', name: 'Thrusters' },
      { quantity: '15', name: 'Pull-ups' },
      { quantity: '9', name: 'Thrusters' },
      { quantity: '9', name: 'Pull-ups' },
    ]);
  });

  it('expands a rep scheme written on one line', () => {
    expect(parseGuidedSteps('21-15-9 Thrusters 43/29 kg, Pull-ups')).toEqual([
      { quantity: '21', name: 'Thrusters 43/29 kg' },
      { quantity: '21', name: 'Pull-ups' },
      { quantity: '15', name: 'Thrusters 43/29 kg' },
      { quantity: '15', name: 'Pull-ups' },
      { quantity: '9', name: 'Thrusters 43/29 kg' },
      { quantity: '9', name: 'Pull-ups' },
    ]);
    expect(parseGuidedSteps('10-8-6 reps de Deadlift y Box jumps')).toHaveLength(6);
  });

  it('closes a rep scheme at a blank line and drops labels before a colon', () => {
    expect(parseGuidedSteps('21-15-9\nThrusters\nRx: 43/30 kg\n\nCierre: 400 m run')).toEqual([
      { quantity: '21', name: 'Thrusters' },
      { quantity: '15', name: 'Thrusters' },
      { quantity: '9', name: 'Thrusters' },
      { quantity: '400 m', name: 'run' },
    ]);
  });

  it('keeps going after a rep scheme ends', () => {
    expect(parseGuidedSteps('21-15-9 reps:\nThrusters\n\n- 400 m Run')).toEqual([
      { quantity: '21', name: 'Thrusters' },
      { quantity: '15', name: 'Thrusters' },
      { quantity: '9', name: 'Thrusters' },
      { quantity: '400 m', name: 'Run' },
    ]);
  });

  it('skips headers, bullets and calories units', () => {
    expect(
      parseGuidedSteps('AMRAP 12 min\n5 rondas\n• 15 cal Row\n* 10x Burpees\nRx: 43/30 kg'),
    ).toEqual([
      { quantity: '15 cal', name: 'Row' },
      { quantity: '10', name: 'Burpees' },
    ]);
  });

  it('returns nothing for free text', () => {
    expect(parseGuidedSteps('Movilidad libre y técnica de arranque')).toEqual([]);
  });
});

describe('guidedStepsFor', () => {
  it("prefers the coach's steps", () => {
    const steps = [{ quantity: '50', name: 'Double unders' }];
    expect(guidedStepsFor({ description: '21 Thrusters', guidedSteps: steps })).toEqual(steps);
  });

  it('falls back to the description', () => {
    expect(guidedStepsFor({ description: '21 Thrusters', guidedSteps: null })).toEqual([
      { quantity: '21', name: 'Thrusters' },
    ]);
  });
});
