import { t } from '@guaranix/shared';
import { IconButton, TileButton } from '@guaranix/ui';
import { Minus } from 'lucide-react';

export interface RoundCounterProps {
  rounds: number;
  onChange(rounds: number): void;
  disabled?: boolean;
}

/** AMRAP rounds: one big tap target to add, a small one to undo a mis-tap. */
export function RoundCounter({ rounds, onChange, disabled = false }: RoundCounterProps) {
  return (
    <div className="flex items-stretch gap-3">
      <IconButton
        label={t('member.timer.removeRound')}
        onClick={() => onChange(Math.max(0, rounds - 1))}
        disabled={disabled || rounds === 0}
        className="size-16"
      >
        <Minus aria-hidden="true" size={22} />
      </IconButton>
      <TileButton
        onClick={() => onChange(rounds + 1)}
        disabled={disabled}
        className="min-h-16 flex-1 flex-row items-center justify-between rounded-xl px-5 active:scale-98"
      >
        <span className="text-left">
          <span className="block text-xs font-semibold tracking-widest text-text-secondary uppercase">
            {t('member.timer.rounds')}
          </span>
          <span className="block text-sm text-text-soft">{t('member.timer.addRound')}</span>
        </span>
        <span className="font-display text-4xl font-bold tabular-nums">{rounds}</span>
      </TileButton>
    </div>
  );
}
