import { type SetupIssue, t } from '@guaranix/shared';
import { IconButton, TextField, ToggleChips } from '@guaranix/ui';
import { Trash2 } from 'lucide-react';
import { IssueNotes } from '../IssueNotes';
import type { DraftSlot } from '../signup-draft';

// Monday first, the way Paraguayan timetables are printed.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const WEEKDAY_OPTIONS = WEEK_ORDER.map((weekday) => ({
  value: weekday,
  label: t(`common.weekdaysInitial.${weekday}`),
  ariaLabel: t(`common.weekdaysLong.${weekday}`),
}));

const toNumber = (value: string) => (value === '' ? 0 : Number(value));

export interface SlotRowProps {
  slot: DraftSlot;
  issues: readonly SetupIssue[];
  onChange: (changes: Partial<DraftSlot>) => void;
  onRemove: () => void;
  /** Only the first row of a program shows the column names on wide screens. */
  first: boolean;
}

/** One class time: start, weekdays, length and capacity in a single row on wide screens. */
export function SlotRow({ slot, issues, onChange, onRemove, first }: SlotRowProps) {
  const labelClassName = first ? undefined : 'md:sr-only';
  const invalid = issues.some((issue) => issue.severity === 'error');
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-end gap-2 md:flex-nowrap md:gap-3">
        <TextField
          className="min-w-0 flex-3 md:w-36 md:flex-none"
          labelClassName={labelClassName}
          label={t('onboarding.schedule.start')}
          type="time"
          step={300}
          value={slot.startTime}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange({ startTime: event.target.value })}
        />
        <div className="order-last w-full md:order-none md:w-auto md:flex-1">
          <ToggleChips
            label={t('onboarding.schedule.weekdays', { time: slot.startTime })}
            options={WEEKDAY_OPTIONS}
            value={slot.weekdays}
            onChange={(weekdays) => onChange({ weekdays })}
          />
        </div>
        <TextField
          className="min-w-0 flex-2 md:w-24 md:flex-none"
          labelClassName={labelClassName}
          label={t('onboarding.schedule.duration')}
          inputMode="numeric"
          value={String(slot.durationMinutes || '')}
          onChange={(event) => onChange({ durationMinutes: toNumber(event.target.value) })}
        />
        <TextField
          className="min-w-0 flex-2 md:w-24 md:flex-none"
          labelClassName={labelClassName}
          label={t('onboarding.schedule.capacity')}
          inputMode="numeric"
          value={String(slot.capacity || '')}
          onChange={(event) => onChange({ capacity: toNumber(event.target.value) })}
        />
        <IconButton
          variant="ghost"
          label={t('onboarding.schedule.remove', { time: slot.startTime })}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" className="size-5" />
        </IconButton>
      </div>
      <IssueNotes issues={issues} />
    </li>
  );
}
