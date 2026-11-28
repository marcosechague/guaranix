import { dateOfInstant, formatGuarani, t } from '@guaranix/shared';
import { Brodi, Button, Card } from '@guaranix/ui';
import { useBoxClock } from '@guaranix/ui/data';
import { Link } from 'react-router';
import type { CommitImportResult } from '../../api/imports';
import { formatCalendarDate } from './format';

export function DoneStep({
  result,
  onAnother,
}: {
  result: CommitImportResult;
  onAnother: () => void;
}) {
  const { timeZone } = useBoxClock();
  const { summary } = result.import;

  return (
    <Card className="items-start sm:flex-row sm:items-center">
      <Brodi alt="" size={96} />
      <div className="flex flex-1 flex-col gap-2">
        <h2 className="font-display text-2xl font-bold">{t('admin.imports.done.title')}</h2>
        <p className="text-text-soft">
          {result.replayed
            ? t('admin.imports.done.replayed', {
                date: formatCalendarDate(dateOfInstant(timeZone, result.import.createdAt)),
              })
            : t('admin.imports.done.body', {
                members: summary.membersCreated,
                memberPlans: summary.memberPlansCreated,
                charges: summary.chargesCreated,
                balance: formatGuarani(summary.balanceGs),
              })}
        </p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button asChild>
            <Link to="/alumnos">{t('admin.imports.done.seeMembers')}</Link>
          </Button>
          <Button variant="secondary" onClick={onAnother}>
            {t('admin.imports.done.another')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
