#!/usr/bin/env node
/**
 * Stop hook. Before Claude finishes a turn:
 *   1. Re-runs the checks on every changed file (a later edit can break an earlier one).
 *   2. When the UI or security-sensitive code changed enough, asks for one pass of the
 *      ux-reviewer and/or security-reviewer agents. It asks again only when more files
 *      or a good amount of new lines changed since the last review, so it stays quiet.
 * Set GUARANIX_SKIP_REVIEW=1 to turn step 2 off.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  changedFiles,
  changedLineCount,
  checkFiles,
  isSecurityFile,
  isUiFile,
  readHookInput,
  ROOT,
} from './guard-lib.mjs';

const MIN_LINES = 15;
const NEW_LINES_FOR_ANOTHER_REVIEW = 40;
const STATE_FILE = join(ROOT, '.claude/.cache/review-state.json');

const input = await readHookInput();
// Claude is already continuing because of this hook: let it finish.
if (input.stop_hook_active) process.exit(0);

const block = (reason) => {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
};

const changed = changedFiles();
if (!changed.length) process.exit(0);

const problems = checkFiles(changed);
if (problems.length) {
  block(
    'Antes de terminar, arreglá lo que marcan los chequeos de GuaraniX en los archivos cambiados:\n\n' +
      problems.join('\n\n'),
  );
}

if (process.env.GUARANIX_SKIP_REVIEW === '1') process.exit(0);

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}
const state = readState();

const reviews = [
  {
    key: 'ux',
    agent: 'ux-reviewer',
    files: changed.filter(isUiFile),
    what:
      'diseño y UX (jerarquía, espaciado, consistencia entre las 3 apps, responsive, accesibilidad). ' +
      'Si la base local está levantada, corré antes `pnpm e2e:layout` (celular, tablet y escritorio)',
  },
  {
    key: 'security',
    agent: 'security-reviewer',
    files: changed.filter(isSecurityFile),
    what: 'seguridad (box_id, roles, validación, secretos, datos sensibles, pagos)',
  },
];

const requests = [];
for (const review of reviews) {
  if (!review.files.length) continue;
  const lines = changedLineCount(review.files);
  const previous = state[review.key] ?? { files: [], lines: 0 };
  const newFiles = review.files.filter((file) => !previous.files.includes(file));
  const grewEnough = lines - previous.lines >= NEW_LINES_FOR_ANOTHER_REVIEW;
  if (lines < MIN_LINES || (!newFiles.length && !grewEnough)) continue;
  state[review.key] = { files: [...new Set([...previous.files, ...review.files])], lines };
  requests.push(
    `- Corré el agente \`${review.agent}\` (herramienta Agent, subagent_type "${review.agent}") sobre:\n` +
      review.files.map((file) => `    ${file}`).join('\n') +
      `\n  Revisa ${review.what}. Aplicá lo que marque como bloqueante o explicá por qué no.`,
  );
}

if (requests.length) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  block('Cambios importantes sin revisar. Antes de terminar:\n' + requests.join('\n'));
}
