/** Shared by the Claude Code hooks and the git pre-commit hook. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');

const LINTABLE = /\.(ts|tsx|js|mjs)$/;
const UI_FILE =
  /^(apps\/(member|admin|platform)\/src\/.*\.(tsx|css)|packages\/ui\/src\/.*\.(tsx|css)|packages\/shared\/i18n\/.*\.json)$/;
const SECURITY_FILE =
  /^(apps\/api\/src\/|packages\/(db|payments|messaging|ai)\/|packages\/shared\/src\/(auth|schemas)\/|\.github\/workflows\/|eslint\.config\.js$)/;

export const isUiFile = (file) => UI_FILE.test(file);
export const isSecurityFile = (file) => SECURITY_FILE.test(file) && !/\.test\.ts$/.test(file);

export function toRepoPath(file) {
  return relative(ROOT, resolve(ROOT, file)).split('\\').join('/');
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

/** Lint, reuse and secret checks on `files` (repo-relative). Returns the problems as text. */
export function checkFiles(files) {
  const present = files.filter((file) => existsSync(join(ROOT, file)));
  const problems = [];

  const secrets = run('node', ['scripts/security/scan-secrets.mjs', ...present]);
  if (!secrets.ok && present.length) problems.push(secrets.output);

  const lintable = present.filter((file) => LINTABLE.test(file));
  if (lintable.length) {
    const eslint = run(join(ROOT, 'node_modules/.bin/eslint'), [
      '--no-warn-ignored',
      '--format',
      'stylish',
      ...lintable,
    ]);
    if (!eslint.ok) problems.push(eslint.output);
  }

  const ui = present.filter(isUiFile);
  if (ui.length) {
    const reuse = run('node', ['scripts/ui/check-reuse.mjs', ...ui]);
    if (!reuse.ok) problems.push(reuse.output);
  }
  return problems;
}

/** Files changed since the last commit, including new untracked ones. */
export function changedFiles() {
  const git = (args) =>
    execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  try {
    return [
      ...new Set([
        ...git(['diff', '--name-only', 'HEAD']),
        ...git(['ls-files', '--others', '--exclude-standard']),
      ]),
    ];
  } catch {
    return [];
  }
}

/** Added plus removed lines in `files` since the last commit (new files count all their lines). */
export function changedLineCount(files) {
  if (!files.length) return 0;
  try {
    const stat = execFileSync('git', ['diff', '--numstat', 'HEAD', '--', ...files], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const tracked = stat
      .split('\n')
      .filter(Boolean)
      .reduce((total, line) => {
        const [added, removed] = line.split('\t');
        return total + (Number(added) || 0) + (Number(removed) || 0);
      }, 0);
    const untracked = execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard', '--', ...files],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    )
      .split('\n')
      .filter(Boolean);
    const newLines = untracked.reduce((total, file) => {
      const wc = spawnSync('wc', ['-l', file], { cwd: ROOT, encoding: 'utf8' });
      return total + (Number.parseInt(wc.stdout, 10) || 0);
    }, 0);
    return tracked + newLines;
  } catch {
    return 0;
  }
}

export async function readHookInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}
