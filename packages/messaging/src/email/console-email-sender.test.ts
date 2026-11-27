import { describe, expect, it } from 'vitest';
import { createConsoleEmailSender } from './console-email-sender';

describe('createConsoleEmailSender', () => {
  it('prints the email in development', async () => {
    const lines: string[] = [];
    const sender = createConsoleEmailSender('development', (line) => lines.push(line));
    await sender.send({ to: 'ana@example.com', subject: 'Hola', text: 'Cuerpo' });
    expect(lines[0]).toContain('to=ana@example.com');
    expect(lines[0]).toContain('Cuerpo');
  });

  it.each(['staging', 'production'])('refuses to run in %s', (environment) => {
    expect(() => createConsoleEmailSender(environment)).toThrow(/only allowed in development/);
  });
});
