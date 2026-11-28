import {
  type GuidedPlan,
  type GuidedStep,
  intervalStep,
  t,
  type TimerSnapshot,
} from '@guaranix/shared';
import type { GuidedProgress } from './guided-progress';

export interface GuidedNowProps {
  plan: GuidedPlan;
  snapshot: TimerSnapshot;
  progress: GuidedProgress;
}

function StepHeadline({ step }: { step: GuidedStep }) {
  return (
    <>
      <span className="block font-display text-7xl leading-none font-bold tabular-nums text-accent-text md:text-8xl">
        {step.quantity}
      </span>
      <span className="block font-display text-4xl leading-tight font-bold md:text-5xl">
        {step.name}
      </span>
    </>
  );
}

const nextLabel = (step: GuidedStep | undefined) =>
  step
    ? t('member.guided.next', { step: `${step.quantity} ${step.name}`.trim() })
    : t('member.guided.lastStep');

/** What the member reads from the floor: the movement to do right now, and what comes next. */
export function GuidedNow({ plan, snapshot, progress }: GuidedNowProps) {
  if (snapshot.phase === 'countdown') {
    const first = plan.advance === 'intervals' ? intervalStep(plan, 1) : plan.sequence[0];
    return (
      <>
        <span className="text-sm font-semibold tracking-widest text-text-secondary uppercase">
          {t('member.timer.phases.countdown')}
        </span>
        <span className="font-display text-clock font-bold tabular-nums text-text-secondary">
          {snapshot.clockSeconds}
        </span>
        {first ? (
          <span className="text-lg text-text-soft">
            {t('member.guided.first', { step: `${first.quantity} ${first.name}`.trim() })}
          </span>
        ) : null}
      </>
    );
  }

  if (plan.advance === 'rounds') {
    return (
      <>
        <span className="text-sm font-semibold tracking-widest text-text-secondary uppercase">
          {t('member.timer.rounds')}
        </span>
        <span className="font-display text-clock font-bold tabular-nums">{progress.rounds}</span>
        <span className="text-lg text-text-soft">
          {plan.steps.map((step) => `${step.quantity} ${step.name}`.trim()).join(' · ')}
        </span>
      </>
    );
  }

  if (plan.advance === 'intervals') {
    const step = intervalStep(plan, snapshot.round);
    const resting = snapshot.phase === 'rest';
    return (
      <>
        <span
          className={`text-sm font-semibold tracking-widest uppercase ${resting ? 'text-success' : 'text-accent-text'}`}
        >
          {t(`member.timer.phases.${snapshot.phase}`)}
        </span>
        {resting ? (
          <span className="text-lg text-text-soft">
            {nextLabel(intervalStep(plan, snapshot.round + 1) ?? undefined)}
          </span>
        ) : step ? (
          <StepHeadline step={step} />
        ) : null}
      </>
    );
  }

  const current = plan.sequence[progress.stepIndex];
  if (!current) return null;
  return (
    <>
      <span className="text-sm font-semibold tracking-widest text-text-secondary uppercase">
        {t('member.guided.now')}
      </span>
      <StepHeadline step={current} />
      <span className="text-lg text-text-soft">
        {nextLabel(plan.sequence[progress.stepIndex + 1])}
      </span>
    </>
  );
}
