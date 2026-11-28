import { describe, expect, it } from 'vitest';
import { distanceMeters } from './distance';

describe('distanceMeters', () => {
  it('is zero for the same point and symmetric', () => {
    const box = { latitude: -25.2867, longitude: -57.647 };
    expect(distanceMeters(box, box)).toBe(0);
    const corner = { latitude: -25.2876, longitude: -57.647 };
    expect(distanceMeters(box, corner)).toBeCloseTo(distanceMeters(corner, box), 6);
  });

  it('measures a block in Asunción and the trip to Encarnación', () => {
    // 0.0009° of latitude is about 100 m.
    const box = { latitude: -25.2867, longitude: -57.647 };
    expect(distanceMeters(box, { latitude: -25.2876, longitude: -57.647 })).toBeCloseTo(100, -1);
    const encarnacion = { latitude: -27.3306, longitude: -55.8667 };
    expect(distanceMeters(box, encarnacion) / 1000).toBeCloseTo(285, -1);
  });
});
