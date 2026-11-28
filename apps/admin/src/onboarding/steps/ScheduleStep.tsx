import { type SetupIssue, t } from '@guaranix/shared';
import { Button, Card, ColorDot } from '@guaranix/ui';
import { Plus } from 'lucide-react';
import { IssueNotes } from '../IssueNotes';
import { issuesAt } from '../issue-text';
import { type DraftSlot, rowId, type SignupDraft, weeklyClassCount } from '../signup-draft';
import { SlotRow } from './SlotRow';

export interface ScheduleStepProps {
  draft: SignupDraft;
  issues: readonly SetupIssue[];
  onSlotsChange: (slots: DraftSlot[]) => void;
}

/** The timetable grouped by program, the way it hangs on the box's wall. */
export function ScheduleStep({ draft, issues, onSlotsChange }: ScheduleStepProps) {
  const update = (id: string, changes: Partial<DraftSlot>) =>
    onSlotsChange(draft.slots.map((slot) => (slot.id === id ? { ...slot, ...changes } : slot)));
  const remove = (id: string) => onSlotsChange(draft.slots.filter((slot) => slot.id !== id));
  const add = (programKey: string) => {
    const last = draft.slots.findLast((slot) => slot.programKey === programKey);
    onSlotsChange([
      ...draft.slots,
      {
        id: rowId(),
        programKey,
        startTime: last ? nextHour(last.startTime) : '07:00',
        weekdays: last ? [...last.weekdays] : [1, 2, 3, 4, 5],
        durationMinutes: last?.durationMinutes ?? 60,
        capacity: last?.capacity ?? 12,
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-4">
      <IssueNotes issues={issuesAt(issues, 'slots')} />
      {draft.programs.map((program) => {
        const rows = draft.slots
          .map((slot, index) => ({ slot, index }))
          .filter(({ slot }) => slot.programKey === program.key);
        return (
          <Card key={program.key} as="section" spacing="compact">
            <header className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <ColorDot color={program.color} />
                {program.name}
              </h2>
              <span className="text-sm text-text-secondary">
                {t('onboarding.schedule.perWeek', {
                  count: weeklyClassCount(rows.map(({ slot }) => slot)),
                })}
              </span>
            </header>
            {rows.length === 0 ? (
              <p className="py-2 text-sm text-text-secondary">{t('onboarding.schedule.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-divider">
                {rows.map(({ slot, index }, position) => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    first={position === 0}
                    issues={issuesAt(issues, `slots.${index}`)}
                    onChange={(changes) => update(slot.id, changes)}
                    onRemove={() => remove(slot.id)}
                  />
                ))}
              </ul>
            )}
            <Button variant="secondary" className="self-start" onClick={() => add(program.key)}>
              <Plus aria-hidden="true" className="size-4" />
              {t('onboarding.schedule.add')}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}

function nextHour(time: string): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const next = Math.min(hours + 1, 22);
  return `${String(next).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
