import {
  BOX_TEMPLATES,
  type BoxSetup,
  type BoxSignupInput,
  type BusinessType,
  DEFAULT_BOOKING_OPENS_HOURS_BEFORE,
  reviewBoxSetup,
  type SetupIssue,
  type SetupPlan,
  type SetupProgram,
  type SetupSlot,
  parsePhoneCell,
  t,
} from '@guaranix/shared';

type WithId<T> = T & { id: string };
export type DraftSlot = WithId<SetupSlot>;
export type DraftPlan = WithId<SetupPlan>;

/** What the owner is filling in. Rows carry an id so React keeps their inputs while editing. */
export interface SignupDraft {
  businessType: BusinessType | null;
  name: string;
  city: string;
  phone: string;
  bookingOpensHoursBefore: number;
  programs: SetupProgram[];
  slots: DraftSlot[];
  plans: DraftPlan[];
  movements: NonNullable<BoxSetup['movements']>;
}

export const EMPTY_DRAFT: SignupDraft = {
  businessType: null,
  name: '',
  city: 'Asunción',
  phone: '',
  bookingOpensHoursBefore: DEFAULT_BOOKING_OPENS_HOURS_BEFORE,
  programs: [],
  slots: [],
  plans: [],
  movements: [],
};

/** Same rules as the spreadsheet import: `0981 123 456` becomes `+595981123456`. */
function phoneOf(text: string): string | null {
  const parsed = parsePhoneCell(text);
  return parsed.ok ? parsed.value : null;
}

let lastId = 0;
export const rowId = () => `row-${(lastId += 1)}`;

/** Copies the template so edits never touch the shared constant. */
export function draftWithTemplate(draft: SignupDraft, businessType: BusinessType): SignupDraft {
  const template = structuredClone(BOX_TEMPLATES[businessType]);
  return {
    ...draft,
    businessType,
    programs: template.programs,
    slots: template.slots.map((slot) => ({ ...slot, id: rowId() })),
    plans: template.plans.map((plan) => ({ ...plan, id: rowId() })),
    movements: template.movements ?? [],
  };
}

export function setupOf(draft: SignupDraft): BoxSetup {
  return {
    programs: draft.programs,
    slots: draft.slots.map(
      ({ programKey, startTime, weekdays, durationMinutes, capacity }): SetupSlot => ({
        programKey,
        startTime,
        weekdays,
        durationMinutes,
        capacity,
      }),
    ),
    plans: draft.plans.map(
      ({ name, kind, priceGs, classesPerWeek, classCount, durationDays, programKeys }) => ({
        name,
        kind,
        priceGs,
        classesPerWeek: classesPerWeek ?? null,
        classCount: classCount ?? null,
        durationDays,
        programKeys: programKeys ?? [],
      }),
    ),
    movements: draft.movements,
  };
}

export interface DetailsProblems {
  name?: string;
  city?: string;
  phone?: string;
}

export function detailsProblems(draft: SignupDraft): DetailsProblems {
  const problems: DetailsProblems = {};
  if (draft.name.trim() === '') problems.name = t('onboarding.details.nameRequired');
  if (draft.city.trim() === '') problems.city = t('onboarding.details.cityRequired');
  if (draft.phone.trim() !== '' && !phoneOf(draft.phone)) {
    problems.phone = t('onboarding.details.phoneInvalid');
  }
  return problems;
}

export const reviewDraft = (draft: SignupDraft): SetupIssue[] => reviewBoxSetup(setupOf(draft));

export function signupInput(draft: SignupDraft, acceptWarnings: boolean): BoxSignupInput {
  if (!draft.businessType) throw new Error('A business type is chosen in the first step');
  return {
    name: draft.name.trim(),
    city: draft.city.trim(),
    phone: draft.phone.trim() === '' ? null : phoneOf(draft.phone),
    businessType: draft.businessType,
    bookingOpensHoursBefore: draft.bookingOpensHoursBefore,
    setup: setupOf(draft),
    acceptWarnings,
  };
}

/** Classes a week, the number owners recognize ("36 clases por semana"). */
export const weeklyClassCount = (slots: readonly SetupSlot[]) =>
  slots.reduce((total, slot) => total + slot.weekdays.length, 0);
