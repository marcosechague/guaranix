import type { Page } from '@playwright/test';

/**
 * Headless browsers have no camera. Give the entrance page a blank video
 * stream and a BarcodeDetector that "reads" whatever pass the test hands it,
 * so the real screen, request and answer are exercised end to end.
 */
// Runs in the page, so it's plain browser JavaScript (this package doesn't type the DOM).
const FAKE_CAMERA = `
  navigator.mediaDevices.getUserMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvas.getContext('2d').fillRect(0, 0, 640, 480);
    return canvas.captureStream(5);
  };
  window.BarcodeDetector = class {
    async detect() {
      const value = window.__qr;
      window.__qr = undefined;
      return value ? [{ rawValue: value }] : [];
    }
  };
`;

export async function fakeCamera(page: Page) {
  await page.addInitScript({ content: FAKE_CAMERA });
}
