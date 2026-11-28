import { t } from '@guaranix/shared';
import { classNames } from '@guaranix/ui';
import { errorText, useBoxClock } from '@guaranix/ui/data';
import { CircleCheck, CircleX, Loader, QrCode } from 'lucide-react';
import { motion } from 'motion/react';
import { checkInMessage } from './check-in-message';
import type { DeskState } from './use-check-in-desk';

interface PanelContent {
  tone: 'neutral' | 'success' | 'warning';
  title: string;
  detail: string;
}

function contentOf(state: DeskState, timeZone: string): PanelContent {
  if (state.kind === 'waiting') {
    return {
      tone: 'neutral',
      title: t('admin.checkIn.waitingTitle'),
      detail: t('admin.checkIn.waitingBody'),
    };
  }
  if (state.kind === 'checking')
    return { tone: 'neutral', title: t('admin.checkIn.checking'), detail: '' };
  if (state.kind === 'error') return { tone: 'warning', title: errorText(state.error), detail: '' };
  return checkInMessage(state.result, timeZone);
}

const toneClasses = {
  neutral: 'border-border bg-surface',
  success: 'border-success bg-success-soft',
  warning: 'border-warning bg-warning-soft',
} as const;

const icons = { neutral: QrCode, success: CircleCheck, warning: CircleX } as const;

/** The big answer at the door: green to go in, orange to stop by the front desk. */
export function CheckInStatusPanel({ state }: { state: DeskState }) {
  const { timeZone } = useBoxClock();
  const content = contentOf(state, timeZone);
  const Icon = state.kind === 'checking' ? Loader : icons[content.tone];
  return (
    // The live region stays mounted; only its content is swapped, so readers announce each result.
    <div aria-live="assertive">
      <motion.section
        key={state.kind === 'result' ? state.result.member.id + state.result.outcome : state.kind}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={classNames(
          'flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center',
          toneClasses[content.tone],
        )}
      >
        <Icon
          aria-hidden="true"
          size={56}
          className={classNames(
            content.tone === 'success' && 'text-success',
            content.tone === 'warning' && 'text-warning',
            content.tone === 'neutral' && 'text-text-secondary',
          )}
        />
        <p className="font-display text-3xl font-bold md:text-4xl">{content.title}</p>
        {content.detail ? (
          <p className="text-lg text-text-soft md:text-xl">{content.detail}</p>
        ) : null}
      </motion.section>
    </div>
  );
}
