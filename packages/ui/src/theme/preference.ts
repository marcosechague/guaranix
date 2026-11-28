import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { colorSchemes, type ThemeName } from '../tokens';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = ThemeName;

/**
 * Same key the inline script in each app's index.html reads before the first
 * paint, so the page never flashes the wrong theme.
 */
export const THEME_STORAGE_KEY = 'gx-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const CHANGE_EVENT = 'gx-theme-change';

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    // Storage blocked (private mode): follow the system.
    return 'system';
  }
}

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): Theme {
  return preference === 'system' ? systemTheme() : preference;
}

/** Puts the theme on `<html>` and in the browser bar color. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', colorSchemes[theme].background);
}

function subscribe(notify: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', notify);
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    media.removeEventListener('change', notify);
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}

const snapshot = () => `${readPreference()}:${systemTheme()}`;

/** The stored preference, the theme it resolves to now, and a setter that remembers it. */
export function useTheme() {
  const [preference, theme] = useSyncExternalStore(subscribe, snapshot).split(':') as [
    ThemePreference,
    Theme,
  ];
  const resolved = preference === 'system' ? theme : preference;

  useEffect(() => applyTheme(resolved), [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not remembered, but still applied for this visit.
    }
    applyTheme(resolveTheme(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { preference, theme: resolved, setPreference };
}
