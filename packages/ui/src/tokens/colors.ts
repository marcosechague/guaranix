/**
 * Semantic color tokens. Every app reads them through CSS variables (see `styles/theme.css`);
 * this file is the reference for code that needs raw values (meta theme-color, Capacitor, charts).
 * `theme.css` must stay in sync: `colors.test.ts` checks it.
 */
export const colorTokenNames = [
  'background',
  'surface',
  'surfaceSunken',
  'border',
  'divider',
  'text',
  'textSoft',
  'textSecondary',
  'accent',
  'accentHover',
  'accentText',
  'accentStrong',
  'onAccent',
  'accentSoft',
  'success',
  'successSoft',
  'warning',
  'warningSoft',
] as const;

export type ColorTokenName = (typeof colorTokenNames)[number];
export type ColorScheme = Readonly<Record<ColorTokenName, string>>;
export type ThemeName = 'dark' | 'light';

/** Default for the member app and for anything shown on a phone. */
export const darkColors: ColorScheme = {
  background: '#0E0F11',
  surface: '#17181B',
  surfaceSunken: '#121316',
  border: '#2A2C30',
  divider: '#2A2C30',
  text: '#F4F5F2',
  textSoft: '#C9CCC3',
  textSecondary: '#A3A69E',
  accent: '#D9F24A',
  accentHover: '#ECFF7A',
  accentText: '#D9F24A',
  accentStrong: '#D9F24A',
  onAccent: '#0E0F11',
  accentSoft: '#24261F',
  success: '#6EE7A0',
  successSoft: '#1E3A2A',
  warning: '#FF8A5B',
  warningSoft: '#3A2418',
};

/** Desktop panels (admin, platform). Values taken from `docs/design/Plataforma.html`. */
export const lightColors: ColorScheme = {
  background: '#F4F5F2',
  surface: '#FFFFFF',
  surfaceSunken: '#E8EAE3',
  border: '#DEE0D8',
  divider: '#E8EAE3',
  text: '#141513',
  textSoft: '#44473F',
  textSecondary: '#5C5F57',
  accent: '#D9F24A',
  accentHover: '#ECFF7A',
  accentText: '#3A4A00',
  accentStrong: '#5C7300',
  onAccent: '#0E0F11',
  accentSoft: '#EEF0E0',
  success: '#2F6B3F',
  successSoft: '#E3F2DF',
  warning: '#8A2E0E',
  warningSoft: '#FBE6DC',
};

export const colorSchemes: Readonly<Record<ThemeName, ColorScheme>> = {
  dark: darkColors,
  light: lightColors,
};

/** CSS custom property that holds a token, e.g. `textSecondary` → `--gx-color-text-secondary`. */
export function colorVariableName(token: ColorTokenName): string {
  return `--gx-color-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}
