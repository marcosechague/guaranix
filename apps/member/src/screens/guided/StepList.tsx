import type { GuidedStep } from '@guaranix/shared';
import { Card, Eyebrow } from '@guaranix/ui';

/** The movements of one round, as the coach wrote them: quantity big, name next to it. */
export function StepList({ title, steps }: { title: string; steps: readonly GuidedStep[] }) {
  return (
    <Card spacing="compact">
      <Eyebrow>{title}</Eyebrow>
      <ol className="flex flex-col divide-y divide-divider">
        {steps.map((step, index) => (
          <li key={`${index}-${step.name}`} className="flex items-baseline gap-3 py-2.5">
            <span className="w-16 shrink-0 font-display text-xl font-bold tabular-nums text-accent-text">
              {step.quantity}
            </span>
            <span className="text-lg">{step.name}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
