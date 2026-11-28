#!/usr/bin/env node
/**
 * Writes the JSON file `wrangler deploy --secrets-file` uploads to the API Worker.
 * The deploy workflow passes every secret and variable of the GitHub environment
 * as JSON (GITHUB_SECRETS, GITHUB_VARS); only the names below reach Cloudflare,
 * so CLOUDFLARE_API_TOKEN and DATABASE_URL never do.
 *
 * Usage: node scripts/deploy/write-secrets-file.mjs <output.json>
 * Prints names only, never values.
 */
import { writeFileSync } from 'node:fs';

/** Without these the API refuses to start outside development (apps/api/src/services/runtime.ts). */
const REQUIRED = [
  'AUTH_SECRET',
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
];

/** Each one turns a feature on when present (AI, card payments, push, Telegram, WhatsApp). */
const OPTIONAL = [
  'AI_SECRETS_KEY',
  'PAYMENTS_SECRETS_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_USERNAME',
  'TELEGRAM_WEBHOOK_SECRET',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
];

function parse(name) {
  const raw = process.env[name];
  if (!raw) return {};
  return JSON.parse(raw);
}

const output = process.argv[2];
if (!output) {
  console.error('Uso: node scripts/deploy/write-secrets-file.mjs <archivo.json>');
  process.exit(2);
}

// A secret wins over a variable with the same name.
const available = { ...parse('GITHUB_VARS'), ...parse('GITHUB_SECRETS') };
const secrets = {};
for (const name of [...REQUIRED, ...OPTIONAL]) {
  const value = available[name];
  if (typeof value === 'string' && value.trim() !== '') secrets[name] = value.trim();
}

const missing = REQUIRED.filter((name) => !(name in secrets));
if (missing.length > 0) {
  console.error(
    `Faltan en el environment de GitHub (o en .env.production): ${missing.join(', ')} (ver docs/despliegue.md).`,
  );
  process.exit(1);
}

writeFileSync(output, JSON.stringify(secrets), { mode: 0o600 });
const skipped = OPTIONAL.filter((name) => !(name in secrets));
console.log(`Secretos para la API: ${Object.keys(secrets).join(', ')}`);
if (skipped.length > 0)
  console.log(`Sin configurar (la función queda apagada): ${skipped.join(', ')}`);
