import { CircleCheck, CircleX, Loader, type LucideIcon, QrCode } from 'lucide-react';
import { motion } from 'motion/react';
import { classNames } from '../lib/class-names';

export type StatusTone = 'neutral' | 'success' | 'warning';

const toneClasses: Record<StatusTone, string> = {
  neutral: 'border-border bg-surface',
  success: 'border-success bg-success-soft',
  warning: 'border-warning bg-warning-soft',
};

const iconClasses: Record<StatusTone, string> = {
  neutral: 'text-text-secondary',
  success: 'text-success',
  warning: 'text-warning',
};

const defaultIcons: Record<StatusTone, LucideIcon> = {
  neutral: QrCode,
  success: CircleCheck,
  warning: CircleX,
};

export interface StatusPanelProps {
  tone: StatusTone;
  title: string;
  detail?: string;
  /** Changes when the answer changes, so it appears again and readers announce it. */
  stateKey: string;
  busy?: boolean;
  icon?: LucideIcon | undefined;
}

/** A big answer readable from a step away: green to go ahead, orange to stop and fix something. */
export function StatusPanel({
  tone,
  title,
  detail,
  stateKey,
  busy = false,
  icon,
}: StatusPanelProps) {
  const Icon = busy ? Loader : (icon ?? defaultIcons[tone]);
  return (
    // The live region stays mounted; only its content is swapped, so readers announce each result.
    <div aria-live="assertive">
      <motion.section
        key={stateKey}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={classNames(
          'flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center',
          toneClasses[tone],
        )}
      >
        <Icon
          aria-hidden="true"
          size={56}
          className={classNames(iconClasses[tone], busy && 'motion-safe:animate-spin')}
        />
        <p className="font-display text-3xl font-bold md:text-4xl">{title}</p>
        {detail ? <p className="text-lg text-text-soft md:text-xl">{detail}</p> : null}
      </motion.section>
    </div>
  );
}
