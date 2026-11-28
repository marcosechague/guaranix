import { blockingIssues, formatGuarani, type SetupIssue, t } from '@guaranix/shared';
import { Button, Card, FormMessage, SwitchField } from '@guaranix/ui';
import { CircleCheck } from 'lucide-react';
import { IssueNotes } from '../IssueNotes';
import { issuePlace } from '../issue-text';
import type { OnboardingStep } from '../steps';
import { bookingWindowText } from '../booking-window';
import { type SignupDraft, weeklyClassCount } from '../signup-draft';
import { planRule } from '../../screens/plans/plan-rule';

export interface ReviewStepProps {
  draft: SignupDraft;
  issues: readonly SetupIssue[];
  acceptWarnings: boolean;
  onAcceptWarningsChange: (accept: boolean) => void;
  onFix: (step: OnboardingStep) => void;
}

const stepOf = (issue: SetupIssue): OnboardingStep =>
  issue.path.startsWith('plans') ? 'plans' : 'schedule';

function IssueGroup({
  title,
  issues,
  draft,
  onFix,
}: {
  title: string;
  issues: readonly SetupIssue[];
  draft: SignupDraft;
  onFix: (step: OnboardingStep) => void;
}) {
  return (
    <Card spacing="compact">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <ul className="flex flex-col divide-y divide-divider">
        {issues.map((issue) => (
          <li
            key={`${issue.code}-${issue.path}`}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-semibold">{issuePlace(issue, draft)}</span>
              <IssueNotes issues={[issue]} />
            </div>
            <Button variant="ghost" onClick={() => onFix(stepOf(issue))}>
              {t('onboarding.review.fix')}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ReviewStep({
  draft,
  issues,
  acceptWarnings,
  onAcceptWarningsChange,
  onFix,
}: ReviewStepProps) {
  const errors = blockingIssues([...issues]);
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 ? (
        <IssueGroup
          title={t('onboarding.review.errorsTitle')}
          issues={errors}
          draft={draft}
          onFix={onFix}
        />
      ) : null}
      {warnings.length > 0 ? (
        <>
          <IssueGroup
            title={t('onboarding.review.warningsTitle')}
            issues={warnings}
            draft={draft}
            onFix={onFix}
          />
          <SwitchField
            label={t('onboarding.review.accept')}
            description={t('onboarding.review.acceptHint')}
            checked={acceptWarnings}
            onChange={onAcceptWarningsChange}
          />
        </>
      ) : null}
      <Card>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-bold">{draft.name}</h2>
          <p className="text-sm text-text-secondary">
            {[
              draft.city,
              t('onboarding.review.booking', {
                window: bookingWindowText(draft.bookingOpensHoursBefore),
              }),
              t('onboarding.review.classes', { count: weeklyClassCount(draft.slots) }),
            ].join(' · ')}
          </p>
        </div>
        <ul className="flex flex-col divide-y divide-divider">
          {draft.plans.map((plan) => (
            <li key={plan.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{plan.name}</span>
                <span className="text-sm text-text-secondary">
                  {planRule({
                    kind: plan.kind,
                    classesPerWeek: plan.classesPerWeek ?? null,
                    classCount: plan.classCount ?? null,
                  })}
                </span>
              </span>
              <span className="font-display font-bold whitespace-nowrap tabular-nums">
                {formatGuarani(plan.priceGs)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-sm text-text-secondary">{t('onboarding.review.trial')}</p>
      {issues.length === 0 ? (
        <FormMessage tone="success">
          <span className="inline-flex items-center gap-2">
            <CircleCheck aria-hidden="true" className="size-4" />
            {t('onboarding.review.allGood')}
          </span>
        </FormMessage>
      ) : null}
    </div>
  );
}
