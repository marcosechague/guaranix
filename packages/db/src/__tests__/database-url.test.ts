import { describe, expect, it } from 'vitest';
import { readLocalDatabaseUrl } from '../database-url';

const local = 'postgres://guaranix:guaranix@localhost:54329/guaranix';

describe('readLocalDatabaseUrl', () => {
  it('accepts a database on this machine', () => {
    expect(readLocalDatabaseUrl({ DATABASE_URL: local }, 'Seed')).toBe(local);
  });

  it('refuses a remote database, even when it came from the shell', () => {
    expect(() =>
      readLocalDatabaseUrl({ DATABASE_URL: 'postgres://user:pass@db.example.com/app' }, 'Seed'),
    ).toThrow(/only runs against a local database/);
  });

  it('refuses in production', () => {
    expect(() =>
      readLocalDatabaseUrl({ DATABASE_URL: local, NODE_ENV: 'production' }, 'Seed'),
    ).toThrow(/only runs against a local database/);
  });
});
