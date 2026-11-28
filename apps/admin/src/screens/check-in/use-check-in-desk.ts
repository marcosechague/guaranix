import type { EntranceResult } from '@guaranix/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCheckIn } from '../../api/mutations';

/** How long a result stays on screen before the next person steps up. */
const RESULT_MS = 4000;
/** The same QR in front of the camera is read many times a second; send it once. */
const SAME_PASS_PAUSE_MS = 8000;
const RECENT_LIMIT = 8;

export type DeskState =
  | { kind: 'waiting' }
  | { kind: 'checking' }
  | { kind: 'result'; result: EntranceResult }
  | { kind: 'error'; error: unknown };

export interface RecentEntry {
  at: number;
  result: EntranceResult;
}

/** Turns camera reads into check-ins, one at a time, and keeps the last few on screen. */
export function useCheckInDesk() {
  const checkIn = useCheckIn();
  const [state, setState] = useState<DeskState>({ kind: 'waiting' });
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const busy = useRef(false);
  const lastPass = useRef<{ pass: string; at: number } | null>(null);

  useEffect(() => {
    if (state.kind !== 'result' && state.kind !== 'error') return;
    const timer = window.setTimeout(() => setState({ kind: 'waiting' }), RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const onCode = useCallback(
    (pass: string) => {
      const now = Date.now();
      if (busy.current) return;
      if (lastPass.current?.pass === pass && now - lastPass.current.at < SAME_PASS_PAUSE_MS) return;
      busy.current = true;
      lastPass.current = { pass, at: now };
      setState({ kind: 'checking' });
      checkIn.mutate(pass, {
        onSuccess: (result) => {
          setState({ kind: 'result', result });
          setRecent((entries) => [{ at: Date.now(), result }, ...entries].slice(0, RECENT_LIMIT));
        },
        onError: (error) => setState({ kind: 'error', error }),
        onSettled: () => {
          busy.current = false;
        },
      });
    },
    [checkIn],
  );

  return { state, recent, onCode };
}
