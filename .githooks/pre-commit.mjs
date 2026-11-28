import { execFileSync } from 'node:child_process';
import { checkFiles, ROOT } from '../.claude/hooks/guard-lib.mjs';

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const problems = checkFiles(staged);
if (problems.length) {
  console.error(problems.join('\n\n'));
  console.error('\npre-commit: arreglá lo de arriba (o, si es urgente, git commit --no-verify).');
  process.exit(1);
}
