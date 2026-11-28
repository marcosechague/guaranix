import { t } from '@guaranix/shared';
import { classNames } from '../lib/class-names';

export interface GuaranixLogoProps {
  size?: 'regular' | 'large';
  className?: string;
}

/**
 * Provisional GuaraniX logo: the name set in the display font. The real logo
 * and wordmark are being designed; when they arrive they replace this component
 * only. Brodi is the assistant, never the logo.
 */
export function GuaranixLogo({ size = 'regular', className }: GuaranixLogoProps) {
  return (
    <span
      className={classNames(
        'font-display font-bold tracking-tight',
        size === 'large' ? 'text-3xl' : 'text-lg',
        className,
      )}
    >
      {t('app.name')}
    </span>
  );
}
