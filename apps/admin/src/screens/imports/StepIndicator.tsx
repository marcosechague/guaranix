import { t } from '@guaranix/shared';
import { classNames } from '@guaranix/ui';
import { Check } from 'lucide-react';

const FILE_STEPS = ['file', 'columns', 'review'] as const;
// An AI read has no columns to map; its middle step is checking the proposed rows.
const AI_STEPS = ['file', 'rows', 'review'] as const;

export interface StepIndicatorProps {
  current: number;
  done: boolean;
  ai?: boolean;
}

export function StepIndicator({ current, done, ai = false }: StepIndicatorProps) {
  const steps = ai ? AI_STEPS : FILE_STEPS;
  return (
    <ol
      aria-label={t('admin.imports.steps.label')}
      className="flex flex-wrap items-center gap-2 sm:gap-3"
    >
      {steps.map((step, index) => {
        const complete = done || index < current;
        const active = !done && index === current;
        return (
          <li
            key={step}
            aria-current={active ? 'step' : undefined}
            className={classNames(
              'flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm font-semibold',
              active ? 'border-accent text-text' : 'border-border text-text-secondary',
            )}
          >
            <span
              className={classNames(
                'flex size-6 items-center justify-center rounded-pill text-xs tabular-nums',
                complete || active ? 'bg-accent text-on-accent' : 'bg-surface-sunken',
              )}
            >
              {complete ? <Check aria-hidden="true" size={14} /> : index + 1}
            </span>
            {t(`admin.imports.steps.${step}`)}
          </li>
        );
      })}
    </ol>
  );
}
