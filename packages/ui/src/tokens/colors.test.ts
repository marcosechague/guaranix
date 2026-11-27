import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  colorSchemes,
  colorTokenNames,
  colorVariableName,
  type ColorTokenName,
  type ThemeName,
} from './colors';
import { contrastRatio } from './contrast';

const themeCss = readFileSync(new URL('../styles/theme.css', import.meta.url), 'utf8');

function cssBlockFor(theme: ThemeName): string {
  const selector = theme === 'dark' ? ":root,\n[data-theme='dark']" : "[data-theme='light']";
  const start = themeCss.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Missing ${theme} block in theme.css`);
  return themeCss.slice(start, themeCss.indexOf('}', start));
}

const MIN_TEXT_CONTRAST = 4.5;

const textPairs: ReadonlyArray<[ColorTokenName, ColorTokenName]> = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textSoft', 'surface'],
  ['textSecondary', 'background'],
  ['textSecondary', 'surface'],
  ['accentText', 'background'],
  ['accentText', 'surface'],
  ['onAccent', 'accent'],
  ['success', 'surface'],
  ['success', 'successSoft'],
  ['warning', 'surface'],
  ['warning', 'warningSoft'],
];

describe.each(['dark', 'light'] as const)('%s color scheme', (theme) => {
  const scheme = colorSchemes[theme];

  it.each(colorTokenNames)('theme.css matches the %s token', (token) => {
    const declaration = `${colorVariableName(token)}: ${scheme[token].toLowerCase()};`;
    expect(cssBlockFor(theme)).toContain(declaration);
  });

  it.each(textPairs)('%s on %s meets 4.5:1', (foreground, background) => {
    expect(contrastRatio(scheme[foreground], scheme[background])).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
  });
});

describe('colorVariableName', () => {
  it('converts camelCase to a kebab-case custom property', () => {
    expect(colorVariableName('textSecondary')).toBe('--gx-color-text-secondary');
  });
});
