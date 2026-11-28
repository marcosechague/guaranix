import { t } from '@guaranix/shared';
import { Brodi, Button, Card } from '@guaranix/ui';
import { Link } from 'react-router';
import { useBrodiOverview } from '../../api/brodi';

/** Last week's summary and a way into Brodi; hidden when the plan doesn't include it. */
export function BrodiHomeCard() {
  const overview = useBrodiOverview();
  if (!overview.data?.usage.enabled) return null;
  const summary = overview.data.latestSummary;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Brodi alt="" size={48} className="shrink-0" />
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold">{t('admin.brodi.home.title')}</h2>
          <p className="line-clamp-4 text-sm text-text-soft">
            {summary ? summary.summary : t('admin.brodi.home.body')}
          </p>
        </div>
      </div>
      <Button asChild variant="secondary">
        <Link to="/brodi">{t('admin.brodi.home.action')}</Link>
      </Button>
    </Card>
  );
}
