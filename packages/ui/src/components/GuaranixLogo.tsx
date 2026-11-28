import { t } from '@guaranix/shared';
import markPng from '../assets/gx-mark.png';
import markWebp from '../assets/gx-mark.webp';
import wordmarkPng from '../assets/guaranix-wordmark.png';
import wordmarkWebp from '../assets/guaranix-wordmark.webp';
import { classNames } from '../lib/class-names';

export type GuaranixLogoVariant = 'tagline' | 'wordmark' | 'mark';

export interface GuaranixLogoProps {
  /**
   * `tagline` for brand moments (login, sign-up), `wordmark` for headers and
   * menus, `mark` (the GX icon) for collapsed menus and tight spots.
   */
  variant?: GuaranixLogoVariant;
  size?: 'small' | 'regular' | 'large';
  className?: string;
}

const HEIGHTS = {
  small: 'h-4',
  regular: 'h-6',
  large: 'h-10',
} as const;

/**
 * The GuaraniX logo. The artwork is steel and lime on black, so on light
 * surfaces it sits on a dark chip; on dark ones it goes on the surface itself.
 * The tagline is live text: in the artwork it is too small to read at app sizes.
 * Brodi is the assistant, never the logo.
 */
export function GuaranixLogo({
  variant = 'wordmark',
  size = 'regular',
  className,
}: GuaranixLogoProps) {
  const isMark = variant === 'mark';
  return (
    <span
      className={classNames(
        'inline-flex shrink-0 flex-col items-center gap-1 rounded-md bg-text dark:bg-transparent',
        size === 'large' ? 'px-4 py-3 dark:p-0' : 'px-2 py-1 dark:p-0',
        className,
      )}
    >
      <picture className={HEIGHTS[size]}>
        <source srcSet={isMark ? markWebp : wordmarkWebp} type="image/webp" />
        <img
          src={isMark ? markPng : wordmarkPng}
          alt={t('app.name')}
          className="h-full w-auto"
          decoding="async"
        />
      </picture>
      {variant === 'tagline' ? (
        <span
          className={classNames(
            // Light text on the light theme's dark chip.
            'font-display font-semibold tracking-widest text-surface-sunken uppercase dark:text-text-secondary',
            size === 'large' ? 'text-micro' : 'text-tiny',
          )}
        >
          {t('app.tagline')}
        </span>
      ) : null}
    </span>
  );
}
