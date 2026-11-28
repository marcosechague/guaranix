import { blockingIssues, type BusinessType, t } from '@guaranix/shared';
import { ActionBar, Button, FormMessage, Page, PageHeader } from '@guaranix/ui';
import { useAuth } from '@guaranix/ui/auth';
import { errorText } from '@guaranix/ui/data';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import {
  detailsProblems,
  draftWithTemplate,
  EMPTY_DRAFT,
  reviewDraft,
  signupInput,
} from './signup-draft';
import { StepHeader } from './StepHeader';
import { ONBOARDING_STEPS, type OnboardingStep } from './steps';
import { StepBody } from './StepBody';
import { useBoxSignup } from './use-box-signup';

/**
 * Self-service sign-up for a new box (PRD: "registro en 3 minutos"): pick the
 * rubro, adjust the template it loads, review and create. Shown to signed-in
 * people who are not staff of any box yet.
 */
export function BoxOnboarding() {
  const { client, setSession } = useAuth();
  const [step, setStep] = useState<OnboardingStep>('type');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [showDetailsProblems, setShowDetailsProblems] = useState(false);
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const signup = useBoxSignup();
  const issues = useMemo(() => reviewDraft(draft), [draft]);
  const index = ONBOARDING_STEPS.indexOf(step);

  const goTo = (next: OnboardingStep) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };
  const chooseType = (businessType: BusinessType) => {
    // Switching rubro reloads its template; keep what was typed in the details.
    if (businessType !== draft.businessType) setDraft(draftWithTemplate(draft, businessType));
    goTo('details');
  };
  const next = () => {
    if (step === 'details' && Object.keys(detailsProblems(draft)).length > 0) {
      setShowDetailsProblems(true);
      return;
    }
    const following = ONBOARDING_STEPS[index + 1];
    if (following) goTo(following);
  };
  const hasWarnings = issues.some((issue) => issue.severity === 'warning');
  const canCreate = blockingIssues(issues).length === 0 && (!hasWarnings || acceptWarnings);
  const create = () => signup.mutate(signupInput(draft, acceptWarnings));

  return (
    <Page layout="panel" className="pb-28">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <StepHeader step={step} />
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex flex-col gap-6"
        >
          <PageHeader
            size="large"
            title={t(`onboarding.${step}.title`)}
            subtitle={t(`onboarding.${step}.subtitle`)}
          />
          <StepBody
            step={step}
            draft={draft}
            issues={issues}
            showDetailsProblems={showDetailsProblems}
            acceptWarnings={acceptWarnings}
            onDraftChange={(changes) => setDraft((current) => ({ ...current, ...changes }))}
            onChooseType={chooseType}
            onAcceptWarningsChange={setAcceptWarnings}
            onGoTo={goTo}
          />
          {signup.isError ? (
            <FormMessage tone="error">{errorText(signup.error)}</FormMessage>
          ) : null}
        </motion.div>
      </div>
      <ActionBar>
        {index > 0 ? (
          <Button variant="ghost" onClick={() => goTo(ONBOARDING_STEPS[index - 1] ?? 'type')}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t('onboarding.back')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={async () => {
              await client.logout();
              setSession(null);
            }}
          >
            {t('onboarding.logout')}
          </Button>
        )}
        {step === 'type' ? null : step === 'review' ? (
          <Button disabled={!canCreate || signup.isPending} onClick={create}>
            {signup.isPending ? t('onboarding.review.creating') : t('onboarding.review.create')}
          </Button>
        ) : (
          <Button onClick={next}>
            {t('onboarding.next')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        )}
      </ActionBar>
    </Page>
  );
}
