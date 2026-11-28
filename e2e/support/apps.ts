/** Where `pnpm dev` serves each app (see apps/api/wrangler.jsonc and each vite config). */
export const APPS = {
  member: 'http://localhost:5173',
  admin: 'http://localhost:5174',
  platform: 'http://localhost:5175',
  api: 'http://localhost:8787',
} as const;

/** Accounts created by `pnpm db:seed` (see README). */
export const DEMO = {
  password: 'guaranix-demo-2026', // secret-scan-ignore: public local demo password (README)
  owner: 'owner@box-demo-asuncion.local',
  reception: 'recepcion@box-demo-asuncion.local',
  member: 'alumno@box-demo-asuncion.local',
  memberName: 'Daniel Rojas',
  platformAdmin: 'admin@guaranix.local',
  boxName: 'Box Demo Asunción',
} as const;
