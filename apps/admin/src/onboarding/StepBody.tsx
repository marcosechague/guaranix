import type { BusinessType, SetupIssue } from '@guaranix/shared';
import { detailsProblems, type SignupDraft } from './signup-draft';
import type { OnboardingStep } from './steps';
import { BusinessTypeStep } from './steps/BusinessTypeStep';
import { DetailsStep } from './steps/DetailsStep';
import { PlansStep } from './steps/PlansStep';
import { ReviewStep } from './steps/ReviewStep';
import { ScheduleStep } from './steps/ScheduleStep';

export interface StepBodyProps {
  step: OnboardingStep;
  draft: SignupDraft;
  issues: readonly SetupIssue[];
  showDetailsProblems: boolean;
  acceptWarnings: boolean;
  onDraftChange: (changes: Partial<SignupDraft>) => void;
  onChooseType: (businessType: BusinessType) => void;
  onAcceptWarningsChange: (accept: boolean) => void;
  onGoTo: (step: OnboardingStep) => void;
}

export function StepBody(props: StepBodyProps) {
  const { step, draft, issues, onDraftChange } = props;
  switch (step) {
    case 'type':
      return <BusinessTypeStep value={draft.businessType} onChoose={props.onChooseType} />;
    case 'details':
      return (
        <DetailsStep
          draft={draft}
          problems={props.showDetailsProblems ? detailsProblems(draft) : {}}
          onChange={onDraftChange}
        />
      );
    case 'schedule':
      return (
        <ScheduleStep
          draft={draft}
          issues={issues}
          onSlotsChange={(slots) => onDraftChange({ slots })}
        />
      );
    case 'plans':
      return (
        <PlansStep
          plans={draft.plans}
          issues={issues}
          onPlansChange={(plans) => onDraftChange({ plans })}
        />
      );
    case 'review':
      return (
        <ReviewStep
          draft={draft}
          issues={issues}
          acceptWarnings={props.acceptWarnings}
          onAcceptWarningsChange={props.onAcceptWarningsChange}
          onFix={props.onGoTo}
        />
      );
  }
}
