import { describe, expect, it } from 'vitest';
import { keepOffline, queryKeys } from './keys';

describe('keepOffline', () => {
  it('keeps what offline needs', () => {
    expect(keepOffline(queryKeys.workouts('2026-11-28'))).toBe(true);
    expect(keepOffline(queryKeys.myBookings)).toBe(true);
    expect(keepOffline(queryKeys.myPlans)).toBe(true);
    expect(keepOffline(queryKeys.programs)).toBe(true);
    expect(keepOffline(['box'])).toBe(true);
  });

  it('never keeps the profile, records or the whiteboard', () => {
    expect(keepOffline(queryKeys.me)).toBe(false);
    expect(keepOffline(queryKeys.myRecords)).toBe(false);
    expect(keepOffline(queryKeys.leaderboard('c1'))).toBe(false);
  });
});
