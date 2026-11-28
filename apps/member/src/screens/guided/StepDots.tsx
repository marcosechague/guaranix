import { t } from '@guaranix/shared';
import { ProgressBar } from '@guaranix/ui';

const MAX_DOTS = 24;

/** Done, current and pending steps; a plain bar when there are too many to count. */
export function StepDots({ done, total }: { done: number; total: number }) {
  if (total > MAX_DOTS) {
    return <ProgressBar label={t('member.guided.progress')} value={done} max={total} />;
  }
  return (
    <ol
      className="flex gap-1.5"
      aria-label={t('member.guided.stepOf', { current: Math.min(done + 1, total), total })}
    >
      {Array.from({ length: total }, (_, index) => (
        <li
          key={index}
          aria-hidden="true"
          className={`h-1.5 flex-1 rounded-pill ${
            index < done ? 'bg-accent' : index === done ? 'bg-text' : 'bg-border'
          }`}
        />
      ))}
    </ol>
  );
}
