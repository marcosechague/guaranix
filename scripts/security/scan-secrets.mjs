#!/usr/bin/env node
/**
 * Fast secret scan for the hooks (Claude Code and pre-commit). CI also runs gitleaks,
 * which knows many more formats and checks the history.
 *
 * Usage:
 *   node scripts/security/scan-secrets.mjs            every tracked file
 *   node scripts/security/scan-secrets.mjs --staged   only what is about to be committed
 *   node scripts/security/scan-secrets.mjs <files…>   only those files
 *
 * A known false positive is silenced with `secret-scan-ignore: <reason>` on the same line.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');

const PATTERNS = [
  ['clave privada', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['access key de AWS', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['token de GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['API key de Resend', /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/],
  ['API key de Anthropic/OpenAI', /\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}\b/],
  ['clave de Stripe', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/],
  ['token de Slack', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['API key de Google', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  [
    'URL de base de datos con contraseña',
    /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/'"]+:(?!password@|postgres@|guaranix@|\$\{)[^\s@/'"]{6,}@(?!localhost|127\.0\.0\.1|postgres[:/]|db[:/])/i,
  ],
  [
    'secreto asignado en el código',
    /\b(?:secret|password|passwd|api_?key|auth_?token|private_?key|client_?secret)\b["']?\s*[:=]\s*["'`](?=[^"'`\s]*[0-9])(?=[^"'`\s]*[A-Za-z])[^"'`\s]{16,}["'`]/i,
  ],
];

// Files that must never be committed, whatever they contain.
const FORBIDDEN_FILES = [
  /^\.env(?!\.example$)/,
  /^\.dev\.vars$/,
  /\.(pem|p12|pfx|key)$/,
  /^id_(rsa|ed25519)$/,
];
const SKIP = [
  /(^|\/)pnpm-lock\.yaml$/,
  /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|pdf|zip)$/i,
  /^docs\/design\//,
];

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
}

function targetFiles() {
  const args = process.argv.slice(2);
  if (args[0] === '--staged') return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  if (args.length) return args.map((file) => relative(ROOT, resolve(file)));
  return git(['ls-files']);
}

const findings = [];
for (const file of targetFiles()) {
  if (FORBIDDEN_FILES.some((pattern) => pattern.test(basename(file)))) {
    findings.push(
      `${file}: este archivo no se commitea (secretos locales). Sacalo con git rm --cached.`,
    );
    continue;
  }
  if (SKIP.some((pattern) => pattern.test(file))) continue;
  const absolute = join(ROOT, file);
  if (!existsSync(absolute) || statSync(absolute).size > 1_000_000) continue;
  readFileSync(absolute, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (line.includes('secret-scan-ignore')) return;
      for (const [label, pattern] of PATTERNS) {
        if (pattern.test(line)) findings.push(`${file}:${index + 1}: parece un/a ${label}.`);
      }
    });
}

if (findings.length) {
  console.error(`scan-secrets: ${findings.length} posible(s) secreto(s)\n`);
  for (const finding of findings) console.error(`  - ${finding}`);
  console.error(
    '\nLos secretos van en `wrangler secret put` o en tu .env local, nunca en el repo.' +
      '\nSi es un falso positivo, agregá `secret-scan-ignore: <motivo>` en esa línea.',
  );
  process.exit(1);
}
console.log('scan-secrets: sin secretos');
