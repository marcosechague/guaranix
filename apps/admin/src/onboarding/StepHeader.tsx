import { t } from '@guaranix/shared';
import { Brodi, ProgressBar } from '@guaranix/ui';
import { ONBOARDING_STEPS, type OnboardingStep } from './steps';

/** Where the owner is in the sign-up: Brodi, "Paso 2 de 5" and the step titles. */
export function StepHeader({ step }: { step: OnboardingStep }) {
  const current = ONBOARDING_STEPS.indexOf(step) + 1;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-accent">
          <Brodi alt="" size={32} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{t('onboarding.eyebrow')}</span>
          <span className="text-sm text-text-secondary">
            {t('onboarding.stepCount', { current, total: ONBOARDING_STEPS.length })}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <ProgressBar
          value={current}
          max={ONBOARDING_STEPS.length}
          label={t('onboarding.stepCount', { current, total: ONBOARDING_STEPS.length })}
        />
        <ol className="hidden grid-cols-5 gap-2 text-micro font-semibold uppercase sm:grid">
          {ONBOARDING_STEPS.map((item, index) => (
            <li
              key={item}
              aria-current={item === step ? 'step' : undefined}
              className={index < current ? 'text-text' : 'text-text-secondary'}
            >
              {t(`onboarding.steps.${item}`)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
