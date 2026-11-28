export interface DevicePosition {
  latitude: number;
  longitude: number;
  /** Radius in meters the device is sure about. */
  accuracyMeters: number;
}

/** Why the phone couldn't say where it is; each one needs a different message. */
export type PositionProblem = 'unsupported' | 'denied' | 'unavailable';

export class PositionError extends Error {
  constructor(readonly problem: PositionProblem) {
    super(`Position ${problem}`);
  }
}

const TIMEOUT_MS = 15_000;

/** One fresh, high-accuracy reading of where the device is. */
export function getDevicePosition(): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new PositionError('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      (error) =>
        reject(
          new PositionError(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
        ),
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 0 },
    );
  });
}
