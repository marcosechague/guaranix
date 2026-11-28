import { t } from '@guaranix/shared';
import { Brodi } from '@guaranix/ui';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';

const CONFETTI = Array.from({ length: 14 }, (_, index) => index);
const VISIBLE_MS = 2600;

/** Brief confetti with Brodi on a new PR. Never blocks: it fades on its own or on tap. */
export function PrCelebration({ show, onDone }: { show: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(onDone, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [show, onDone]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          type="button"
          onClick={onDone}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface text-center"
        >
          {CONFETTI.map((piece) => (
            <motion.span
              key={piece}
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 size-2 rounded-sm"
              style={{
                backgroundColor:
                  piece % 3 === 0 ? 'var(--gx-color-success)' : 'var(--gx-color-accent)',
              }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{
                x: Math.cos((piece / CONFETTI.length) * Math.PI * 2) * 140,
                y: Math.sin((piece / CONFETTI.length) * Math.PI * 2) * 90 - 20,
                opacity: 0,
                rotate: 180,
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
          <motion.span
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <Brodi alt="" size={72} />
          </motion.span>
          <span role="status" className="font-display text-2xl font-bold text-accent-text">
            {t('member.wod.prTitle')}
          </span>
          <span className="text-sm text-text-secondary">{t('member.wod.prBody')}</span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
