import { describe, expect, it } from 'vitest';
import { questionsLeft, usageText } from './usage';

describe('Brodi quota line', () => {
  it('counts what is left and never goes below zero', () => {
    expect(questionsLeft({ enabled: true, monthlyLimit: null, usedThisMonth: 9 })).toBeNull();
    expect(questionsLeft({ enabled: true, monthlyLimit: 10, usedThisMonth: 4 })).toBe(6);
    expect(questionsLeft({ enabled: true, monthlyLimit: 10, usedThisMonth: 12 })).toBe(0);
  });

  it('says it plainly', () => {
    expect(usageText({ enabled: true, monthlyLimit: 10, usedThisMonth: 9 })).toBe(
      'Te queda 1 pregunta este mes.',
    );
    expect(usageText({ enabled: true, monthlyLimit: 10, usedThisMonth: 10 })).toBe(
      'Ya usaste las 10 preguntas de este mes. Se renuevan el 1.°.',
    );
  });
});
