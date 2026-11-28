import { useCallback, useState } from 'react';

/** A yes/no setting remembered in this browser (e.g. a collapsed menu). */
export function useStoredFlag(key: string, initial = false): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === '1';
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // Kept for this visit only.
      }
    },
    [key],
  );
  return [value, update];
}
