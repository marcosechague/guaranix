#!/usr/bin/env node
/**
 * Writes `_headers` into an app's build so Cloudflare serves it with security
 * headers: a CSP that only lets the app talk to its own API, no framing
 * (clickjacking on the admin panel), and no referrer paths (reset links carry
 * a token). Hashes come from the built index.html, so the inline theme script
 * keeps working when it changes.
 *
 * Usage: node scripts/deploy/write-headers.mjs <dist dir> <api url>
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [distDirectory, apiUrl] = process.argv.slice(2);
if (!distDirectory || !apiUrl) {
  console.error('Uso: node scripts/deploy/write-headers.mjs <dist> <url de la api>');
  process.exit(2);
}

const TURNSTILE = 'https://challenges.cloudflare.com';
const html = readFileSync(join(distDirectory, 'index.html'), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1] ?? '')
  .filter((body) => body.trim() !== '');
const hashes = inlineScripts.map(
  (body) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
);

const policy = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes, TURNSTILE].join(' ')}`,
  // Radix and Motion set inline styles; style injection is not a script vector.
  "style-src 'self' 'unsafe-inline'",
  // Receipts and payment QRs are shown from blob: URLs fetched through the API.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${new URL(apiUrl).origin}`,
  `frame-src blob: ${TURNSTILE}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const headers = `/*
  Content-Security-Policy: ${policy}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000
`;

writeFileSync(join(distDirectory, '_headers'), headers);
console.log(`_headers en ${distDirectory} (${hashes.length} script(s) inline).`);
