import { t } from '@guaranix/shared';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { errorText } from './ApiProvider';

/** What a screen shows when its data failed to load: the reason and a retry. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Card role="alert" className="flex flex-col items-start gap-3">
      <p className="font-semibold">{t('common.loadError')}</p>
      <p className="text-sm text-text-secondary">{errorText(error)}</p>
      <Button variant="secondary" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </Card>
  );
}
