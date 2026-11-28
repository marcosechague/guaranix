import { t } from '@guaranix/shared';
import { classNames } from '@guaranix/ui';
import { Check } from 'lucide-react';

const STEPS = ['file', 'columns', 'review'] as const;

export function StepIndicator({ current, done }: { current: number; done: boolean }) {
  return (
    <ol
      aria-label={t('admin.imports.steps.label')}
      className="flex flex-wrap items-center gap-2 sm:gap-3"
    >
      {STEPS.map((step, index) => {
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
