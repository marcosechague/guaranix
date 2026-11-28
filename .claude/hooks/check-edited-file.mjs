#!/usr/bin/env node
/**
 * PostToolUse hook: after Claude writes or edits a file, run the design, reuse,
 * security and secret checks on it. Exit code 2 sends the problems back to Claude
 * so it fixes them right away.
 */
import { checkFiles, readHookInput, toRepoPath } from './guard-lib.mjs';

const input = await readHookInput();
const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!filePath) process.exit(0);

const file = toRepoPath(filePath);
if (file.startsWith('..') || file.startsWith('node_modules/')) process.exit(0);

const problems = checkFiles([file]);
if (problems.length) {
  console.error(
    `Los chequeos de GuaraniX encontraron problemas en ${file}. Arreglalos antes de seguir ` +
      '(las reglas salen de CLAUDE.md):\n\n' +
      problems.join('\n\n'),
  );
  process.exit(2);
}
