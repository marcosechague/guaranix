import { BOX_TEMPLATES, boxSignupSchema } from '@guaranix/shared';
import { describe, expect, it } from 'vitest';
import {
  detailsProblems,
  draftWithTemplate,
  EMPTY_DRAFT,
  reviewDraft,
  signupInput,
  weeklyClassCount,
} from './signup-draft';

const filled = { ...draftWithTemplate(EMPTY_DRAFT, 'functional_box'), name: 'Box Mburuvicha' };

describe('signup draft', () => {
  it('loads a copy of the template, so editing it leaves the template alone', () => {
    const draft = draftWithTemplate(EMPTY_DRAFT, 'functional_box');
    const first = draft.slots[0];
    if (first) first.capacity = 99;
    expect(BOX_TEMPLATES.functional_box.slots[0]?.capacity).not.toBe(99);
    expect(draft.slots).toHaveLength(BOX_TEMPLATES.functional_box.slots.length);
  });

  it('keeps the typed details when the business type changes', () => {
    const switched = draftWithTemplate(filled, 'pilates_studio');
    expect(switched.name).toBe('Box Mburuvicha');
    expect(switched.programs).toEqual(BOX_TEMPLATES.pilates_studio.programs);
  });

  it('sends a body the API accepts, without the row ids and with an E.164 phone', () => {
    const input = signupInput({ ...filled, phone: '0981 123 456' }, false);
    const parsed = boxSignupSchema.parse(input);
    expect(parsed.phone).toBe('+595981123456');
    expect(parsed.bookingOpensHoursBefore).toBe(24);
    expect(input.setup.slots[0]).not.toHaveProperty('id');
    expect(input.setup.plans[0]).not.toHaveProperty('id');
  });

  it('templates are valid as they come', () => {
    for (const businessType of ['functional_box', 'pilates_studio', 'combat_gym'] as const) {
      const draft = draftWithTemplate(EMPTY_DRAFT, businessType);
      expect(reviewDraft(draft).filter((issue) => issue.severity === 'error')).toEqual([]);
    }
  });

  it('asks for the name and city, and rejects a phone that is not one', () => {
    expect(Object.keys(detailsProblems({ ...filled, name: ' ', city: '' }))).toEqual([
      'name',
      'city',
    ]);
    expect(detailsProblems({ ...filled, phone: '12' }).phone).toBeDefined();
    expect(detailsProblems({ ...filled, phone: '' })).toEqual({});
  });

  it('counts classes a week as slots times weekdays', () => {
    expect(
      weeklyClassCount([
        {
          programKey: 'a',
          startTime: '07:00',
          weekdays: [1, 2, 3],
          durationMinutes: 60,
          capacity: 10,
        },
        { programKey: 'a', startTime: '08:00', weekdays: [6], durationMinutes: 60, capacity: 10 },
      ]),
    ).toBe(4);
  });
});
