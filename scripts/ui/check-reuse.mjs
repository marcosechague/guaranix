#!/usr/bin/env node
/**
 * Reuse and consistency checks that a per-file linter can't see:
 *   1. Copy-pasted code across the three apps and packages/ui (jscpd).
 *   2. Elements styled with almost the same Tailwind classes in different places,
 *      which means a component is missing in packages/ui.
 *   3. Components in an app that shadow a packages/ui component.
 *   4. Emojis in the translations and raw colors in app stylesheets.
 *
 * Usage: node scripts/ui/check-reuse.mjs [files…]
 * With files, only findings that touch those files are reported (used by the hooks).
 * To accept a finding on purpose, put `ui-reuse-ignore: <reason>` in a comment on the line above.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const APPS = ['apps/member', 'apps/admin', 'apps/platform'];
const UI = 'packages/ui';
const SOURCE_DIRS = [...APPS.map((app) => `${app}/src`), `${UI}/src`];
const I18N = 'packages/shared/i18n/es-PY.json';

const MIN_CLASSES = 6;
const SIMILARITY = 0.75;
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|\u{FE0F}/u;
const RAW_COLOR =
  /(?:^|[\s:,(])(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8}))(?![\w-])|\b((?:rgba?|hsla?|oklch)\()/i;

const findings = [];
const report = (files, message) => findings.push({ files, message });

function walk(dir, extensions) {
  const absolute = join(ROOT, dir);
  let entries;
  try {
    entries = readdirSync(absolute, { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
    .filter((file) => !/\.test\.tsx?$/.test(file));
}

const lineCache = new Map();
function lines(file) {
  if (!lineCache.has(file)) lineCache.set(file, readFileSync(join(ROOT, file), 'utf8').split('\n'));
  return lineCache.get(file);
}

/** True when the comment line(s) right above `line` (1-based) say `ui-reuse-ignore`. */
function ignored(file, line) {
  const source = lines(file);
  for (let index = line - 2; index >= 0 && index >= line - 4; index -= 1) {
    if (source[index]?.includes('ui-reuse-ignore')) return true;
    if (!/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(source[index] ?? '')) return false;
  }
  return false;
}

// 1. Copy-paste -------------------------------------------------------------

const IMPORT_LINE =
  /^\s*(import\b|export\s+(type\s+)?\{|[\w$]+,?$|\}?\s*from\s|type\s+[\w$]+,?$|\}\s*from\s)/;

function checkCopyPaste() {
  const output = mkdtempSync(join(tmpdir(), 'guaranix-jscpd-'));
  try {
    execFileSync(
      join(ROOT, 'node_modules/.bin/jscpd'),
      [
        ...SOURCE_DIRS,
        '--format',
        'typescript,tsx',
        '--min-tokens',
        '60',
        '--min-lines',
        '5',
        '--ignore',
        '**/*.test.ts,**/*.test.tsx',
        '--reporters',
        'json',
        '--output',
        output,
        '--silent',
      ],
      { cwd: ROOT, stdio: 'ignore' },
    );
    const { duplicates } = JSON.parse(readFileSync(join(output, 'jscpd-report.json'), 'utf8'));
    for (const duplicate of duplicates) {
      const code = duplicate.fragment.split('\n').filter((line) => line.trim() !== '');
      // Two files importing the same things is not duplicated logic.
      const importLines = code.filter((line) => IMPORT_LINE.test(line)).length;
      if (importLines / code.length >= 0.7) continue;
      const first = duplicate.firstFile;
      const second = duplicate.secondFile;
      if (ignored(first.name, first.start) || ignored(second.name, second.start)) continue;
      report(
        [first.name, second.name],
        `Código repetido (${duplicate.lines} líneas): ${first.name}:${first.start} y ${second.name}:${second.start}. ` +
          'Extraelo a un componente o helper en packages/ui (o packages/shared si no es UI).',
      );
    }
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

// 2. Near-identical class lists ----------------------------------------------

function classStrings(node, pieces = []) {
  if (!node || typeof node !== 'object') return pieces;
  if (node.type === 'Literal' && typeof node.value === 'string') pieces.push(node.value);
  else if (node.type === 'TemplateElement') pieces.push(node.value.cooked ?? '');
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (Array.isArray(value)) value.forEach((child) => classStrings(child, pieces));
    else if (value && typeof value.type === 'string') classStrings(value, pieces);
  }
  return pieces;
}

function collectClassLists(file) {
  const source = lines(file).join('\n');
  const { ast } = tseslint.parser.parseForESLint(source, {
    ecmaFeatures: { jsx: true },
    loc: true,
    range: true,
  });
  const lists = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXAttribute' && node.name?.name === 'className' && node.value) {
      const classes = new Set(classStrings(node.value).join(' ').split(/\s+/).filter(Boolean));
      if (classes.size >= MIN_CLASSES) lists.push({ file, line: node.loc.start.line, classes });
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value.type === 'string') visit(value);
    }
  };
  visit(ast);
  return lists;
}

function similarity(first, second) {
  let shared = 0;
  for (const name of first) if (second.has(name)) shared += 1;
  return shared / (first.size + second.size - shared);
}

function checkClassLists(files) {
  const lists = files.flatMap(collectClassLists).filter((list) => !ignored(list.file, list.line));
  for (let i = 0; i < lists.length; i += 1) {
    for (let j = i + 1; j < lists.length; j += 1) {
      const first = lists[i];
      const second = lists[j];
      // Variants inside one packages/ui component are expected; everything else is a missing component.
      if (first.file === second.file && first.file.startsWith(UI)) continue;
      const score = similarity(first.classes, second.classes);
      if (score < SIMILARITY) continue;
      report(
        [first.file, second.file],
        `Estilos casi iguales (${Math.round(score * 100)}%): ${first.file}:${first.line} y ${second.file}:${second.line}. ` +
          'Es el mismo elemento visual dos veces: creá o usá un componente de packages/ui (Card, PageHeader…).',
      );
    }
  }
}

// 3. Shadowed packages/ui components ----------------------------------------

function checkShadowedComponents(files) {
  const index = readFileSync(join(ROOT, UI, 'src/index.ts'), 'utf8');
  const exported = new Set([...index.matchAll(/export \{ (\w+) \}/g)].map((match) => match[1]));
  for (const file of files.filter((name) => name.startsWith('apps/'))) {
    lines(file).forEach((text, index) => {
      const match = /^(?:export\s+)?(?:function|const)\s+([A-Z]\w*)\b/.exec(text);
      if (match && exported.has(match[1]) && !ignored(file, index + 1)) {
        report(
          [file],
          `${file}:${index + 1} define otro ${match[1]}, pero ya existe en @guaranix/ui. Usá ese (o extendelo ahí).`,
        );
      }
    });
  }
}

// 4. Translations and stylesheets ---------------------------------------------

function checkTranslations() {
  const visit = (node, path) => {
    if (typeof node === 'string') {
      const emoji = EMOJI.exec(node);
      if (emoji)
        report(
          [I18N],
          `${I18N}: "${path}" tiene un emoji (${emoji[0]}). Sin emojis en la interfaz.`,
        );
      return;
    }
    for (const [key, value] of Object.entries(node)) visit(value, path ? `${path}.${key}` : key);
  };
  visit(JSON.parse(readFileSync(join(ROOT, I18N), 'utf8')), '');
}

function checkAppStylesheets() {
  for (const file of APPS.flatMap((app) => walk(`${app}/src`, ['.css']))) {
    lines(file).forEach((text, index) => {
      const match = RAW_COLOR.exec(text);
      if (match && !ignored(file, index + 1)) {
        report(
          [file],
          `${file}:${index + 1} usa un color a mano (${match[1] ?? match[2]}). Los colores salen de @guaranix/ui/theme.css.`,
        );
      }
    });
  }
}

// ---------------------------------------------------------------------------

const only = new Set(process.argv.slice(2).map((file) => relative(ROOT, resolve(file))));
const sources = SOURCE_DIRS.flatMap((dir) => walk(dir, ['.tsx']));

checkCopyPaste();
checkClassLists(sources);
checkShadowedComponents(sources);
checkTranslations();
checkAppStylesheets();

const relevant = only.size
  ? findings.filter((finding) => finding.files.some((file) => only.has(file)))
  : findings;

if (relevant.length) {
  console.error(`check-reuse: ${relevant.length} problema(s) de reuso o consistencia de UI\n`);
  for (const finding of relevant) console.error(`  - ${finding.message}`);
  console.error(
    '\nSi uno es intencional, dejá un comentario `ui-reuse-ignore: <motivo>` en la línea de arriba.',
  );
  process.exit(1);
}
console.log('check-reuse: sin problemas');
