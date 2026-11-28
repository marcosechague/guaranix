import type { CheckInResult } from '@guaranix/shared';
import { PositionError, type PositionProblem, getDevicePosition } from '@guaranix/ui';
import { useApi } from '@guaranix/ui/data';
import { useCallback, useEffect, useRef, useState } from 'react';

export type WallState =
  | { kind: 'locating' }
  | { kind: 'sending' }
  | { kind: 'result'; result: CheckInResult }
  | { kind: 'position'; problem: PositionProblem }
  | { kind: 'error'; error: unknown };

/**
 * Asks the phone where it is (once, never stored) and sends it with the
 * poster's code. Starts on its own; `retry` starts over.
 */
export function useWallCheckIn(code: string) {
  const api = useApi();
  const [state, setState] = useState<WallState>({ kind: 'locating' });
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setState({ kind: 'locating' });
    try {
      const position = await getDevicePosition();
      setState({ kind: 'sending' });
      const { result } = await api.post<{ result: CheckInResult }>('/box/me/wall-check-ins', {
        code,
        ...position,
      });
      setState({ kind: 'result', result });
    } catch (error) {
      setState(
        error instanceof PositionError
          ? { kind: 'position', problem: error.problem }
          : { kind: 'error', error },
      );
    } finally {
      running.current = false;
    }
  }, [api, code]);

  useEffect(() => {
    void run();
  }, [run]);

  return { state, retry: () => void run() };
}
