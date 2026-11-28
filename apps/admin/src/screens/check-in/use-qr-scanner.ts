import jsQR from 'jsqr';
import { type RefObject, useEffect, useRef, useState } from 'react';

export type ScannerStatus = 'starting' | 'scanning' | 'denied' | 'missing';

// Chrome and Android ship BarcodeDetector; Safari (iPads at the door) doesn't, so jsQR covers it.
interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type NativeDetectorConstructor = new (options: { formats: string[] }) => NativeDetector;

const SCAN_EVERY_MS = 200;
/** Decoding a smaller frame is enough for a phone held up to the camera, and much cheaper. */
const MAX_FRAME_WIDTH = 640;

function nativeDetector(): NativeDetector | null {
  const constructor = (globalThis as { BarcodeDetector?: NativeDetectorConstructor })
    .BarcodeDetector;
  return constructor ? new constructor({ formats: ['qr_code'] }) : null;
}

function decodeFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth);
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);
  if (width === 0 || height === 0) return null;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height);
  return jsQR(frame.data, width, height, { inversionAttempts: 'dontInvert' })?.data ?? null;
}

async function readCode(
  video: HTMLVideoElement,
  detector: NativeDetector | null,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  if (detector) {
    const [code] = await detector.detect(video);
    return code?.rawValue ?? null;
  }
  return decodeFrame(video, canvas);
}

/**
 * Streams the camera into `videoRef` and calls `onCode` with each QR it reads,
 * a few times a second. `retry` asks for the camera again after a denial.
 */
export function useQrScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  facingMode: 'user' | 'environment',
  onCode: (code: string) => void,
) {
  const [status, setStatus] = useState<ScannerStatus>('starting');
  const [attempt, setAttempt] = useState(0);
  const latestOnCode = useRef(onCode);
  useEffect(() => {
    latestOnCode.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const detector = nativeDetector();

    const scan = async () => {
      const video = videoRef.current;
      if (stopped || !video) return;
      try {
        const code = await readCode(video, detector, canvas);
        if (code && !stopped) latestOnCode.current(code);
      } catch {
        // A frame that fails to decode is just skipped.
      }
      if (!stopped) timer = window.setTimeout(() => void scan(), SCAN_EVERY_MS);
    };

    const start = async () => {
      setStatus('starting');
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('missing');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 } },
          audio: false,
        });
      } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        setStatus(
          name === 'NotFoundError' || name === 'OverconstrainedError' ? 'missing' : 'denied',
        );
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setStatus('scanning');
      void scan();
    };

    void start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [videoRef, facingMode, attempt]);

  return { status, retry: () => setAttempt((current) => current + 1) };
}
