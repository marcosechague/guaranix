export const ONBOARDING_STEPS = ['type', 'details', 'schedule', 'plans', 'review'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
