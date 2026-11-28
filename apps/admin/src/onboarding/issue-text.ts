import { type SetupIssue, t } from '@guaranix/shared';
import type { SignupDraft } from './signup-draft';

export const issueText = (issue: SetupIssue) =>
  t(`onboarding.issues.${issue.code}`, issue.params ?? {});

/** "Clase de las 06:00", "Ilimitado": which row the review is talking about. */
export function issuePlace(issue: SetupIssue, draft: SignupDraft): string {
  const [collection, rawIndex] = issue.path.split('.');
  const index = Number(rawIndex);
  if (collection === 'slots' && draft.slots[index]) {
    return t('onboarding.where.slot', { time: draft.slots[index].startTime });
  }
  if (collection === 'plans' && draft.plans[index]) {
    return t('onboarding.where.plan', { name: draft.plans[index].name });
  }
  if (collection === 'programs' && draft.programs[index]) {
    return t('onboarding.where.program', { name: draft.programs[index].name });
  }
  return t('onboarding.where.general');
}

export const issuesAt = (issues: readonly SetupIssue[], path: string) =>
  issues.filter((issue) => issue.path === path);
