import { useMemo } from 'react';
import { encode } from 'uqr';
import { classNames } from '../lib/class-names';

export interface QrCodeProps {
  value: string;
  /** What the code is for, read by screen readers instead of the pattern. */
  label: string;
  className?: string;
}

/**
 * A QR drawn as one SVG path. Always black on white, whatever the theme:
 * scanners need the contrast and the quiet border around it.
 */
export function QrCode({ value, label, className }: QrCodeProps) {
  const { path, size } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 2 });
    let d = '';
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { path: d, size: qr.size };
  }, [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={classNames('block aspect-square rounded-lg bg-qr-backdrop', className)}
    >
      <path d={path} className="fill-qr-ink" />
    </svg>
  );
}
