import { t } from '@guaranix/shared';
import { Card, ChipGroup, CitySelectField, TextField } from '@guaranix/ui';
import { BOOKING_WINDOWS, bookingWindowText, isBookingWindow } from '../booking-window';
import type { DetailsProblems, SignupDraft } from '../signup-draft';

export interface DetailsStepProps {
  draft: SignupDraft;
  /** Only shown after the owner tried to continue, so the form doesn't open full of errors. */
  problems: DetailsProblems;
  onChange: (changes: Partial<SignupDraft>) => void;
}

export function DetailsStep({ draft, problems, onChange }: DetailsStepProps) {
  const hours = String(draft.bookingOpensHoursBefore);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <TextField
          label={t('onboarding.details.name')}
          placeholder={t('onboarding.details.namePlaceholder')}
          autoComplete="organization"
          value={draft.name}
          error={problems.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CitySelectField
            label={t('onboarding.details.city')}
            value={draft.city}
            error={problems.city}
            onChange={(event) => onChange({ city: event.target.value })}
          />
          <TextField
            label={t('onboarding.details.phone')}
            hint={t('onboarding.details.phoneHint')}
            placeholder={t('onboarding.details.phonePlaceholder')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={draft.phone}
            error={problems.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
          />
        </div>
      </Card>
      <Card>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold">{t('onboarding.details.bookingTitle')}</h2>
          <p className="text-sm text-text-secondary">
            {t('onboarding.details.bookingHint', {
              window: bookingWindowText(draft.bookingOpensHoursBefore),
            })}
          </p>
        </div>
        <ChipGroup
          className="flex-wrap"
          label={t('onboarding.details.bookingTitle')}
          value={isBookingWindow(hours) ? hours : '24'}
          onChange={(value) => onChange({ bookingOpensHoursBefore: Number(value) })}
          options={BOOKING_WINDOWS.map((value) => ({
            value,
            label: t(`onboarding.details.bookingOptions.${value}`),
          }))}
        />
      </Card>
    </div>
  );
}
