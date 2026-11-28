import { fileURLToPath } from 'node:url';

export const AUTH_DIR = fileURLToPath(new URL('../.auth', import.meta.url));

/** Saved sessions per demo account (written by `global-setup.ts`, git-ignored). */
export const SIGNED_IN = {
  owner: `${AUTH_DIR}/owner.json`,
  reception: `${AUTH_DIR}/reception.json`,
  member: `${AUTH_DIR}/member.json`,
  platformAdmin: `${AUTH_DIR}/platform-admin.json`,
} as const;
