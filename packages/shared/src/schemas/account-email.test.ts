import { describe, expect, it } from 'vitest';
import { accountEmailSchema, canonicalAccountEmail } from './common';

describe('canonicalAccountEmail', () => {
  it('treats Gmail spellings of the same mailbox as one account', () => {
    expect(canonicalAccountEmail('Marcos.Echague@gmail.com')).toBe('marcosechague@gmail.com');
    expect(canonicalAccountEmail('marcos.echague+box@googlemail.com')).toBe(
      'marcosechague@gmail.com',
    );
  });

  it('leaves other providers alone, where dots and plus signs may matter', () => {
    expect(canonicalAccountEmail(' Ana.B+pagos@Hotmail.com ')).toBe('ana.b+pagos@hotmail.com');
  });

  it('is what account forms send', () => {
    expect(accountEmailSchema.parse(' M.E@GMAIL.com ')).toBe('me@gmail.com');
    expect(accountEmailSchema.safeParse('no-es-un-email').success).toBe(false);
  });
});
