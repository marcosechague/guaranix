#!/usr/bin/env node
/**
 * Writes the security headers of the assembled site (apps/gateway/dist):
 * `_headers`, which the asset store applies to the files it serves, and
 * `security-headers.json`, which the gateway applies to the HTML it returns for
 * client-side routes. A CSP that only allows this origin (the API is under
 * `/api`) and Turnstile, no framing (clickjacking on the box panel), no
 * referrer paths (reset links carry a token). Inline scripts are allowed by
 * hash, read from each built index.html, so the theme script keeps working.
 *
 * Usage: node scripts/deploy/write-headers.mjs <site dir>
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const siteDirectory = process.argv[2];
if (!siteDirectory) {
  console.error('Uso: node scripts/deploy/write-headers.mjs <carpeta del sitio>');
  process.exit(2);
}

const TURNSTILE = 'https://challenges.cloudflare.com';
const INDEX_FILES = ['index.html', 'panel/index.html', 'plataforma/index.html'];

const hashes = new Set();
for (const file of INDEX_FILES) {
  const path = join(siteDirectory, file);
  if (!existsSync(path)) continue;
  const html = readFileSync(path, 'utf8');
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const body = match[1] ?? '';
    if (body.trim() !== '') {
      hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
    }
  }
}

const policy = [
  "default-src 'self'",
  `script-src 'self' ${[...hashes, TURNSTILE].join(' ')}`,
  // Radix and Motion set inline styles; style injection is not a script vector.
  "style-src 'self' 'unsafe-inline'",
  // Receipts and payment QRs are shown from blob: URLs fetched through the API.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  `frame-src blob: ${TURNSTILE}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const headers = {
  'Content-Security-Policy': policy,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000',
};

const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
writeFileSync(join(siteDirectory, '_headers'), `/*\n${lines.join('\n')}\n`);
writeFileSync(join(siteDirectory, 'security-headers.json'), JSON.stringify(headers));
console.log(`Encabezados de seguridad en ${siteDirectory} (${hashes.size} script(s) inline).`);
