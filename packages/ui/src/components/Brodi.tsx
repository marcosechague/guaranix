import brodiPng from '../assets/brodi.png';
import brodiWebp from '../assets/brodi.webp';

export interface BrodiProps {
  /** Translated description; pass an empty string when Brodi is purely decorative. */
  alt: string;
  size?: number;
  className?: string;
}

export function Brodi({ alt, size = 96, className }: BrodiProps) {
  return (
    <picture className={className}>
      <source srcSet={brodiWebp} type="image/webp" />
      <img src={brodiPng} alt={alt} width={size} height={size} loading="lazy" decoding="async" />
    </picture>
  );
}
