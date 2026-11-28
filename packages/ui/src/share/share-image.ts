export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Opens the phone's share sheet with the image (Instagram is one tap away
 * there); where files can't be shared, it downloads the image instead.
 */
export async function shareImage(blob: Blob, fileName: string): Promise<ShareOutcome> {
  const file = new File([blob], fileName, { type: blob.type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
