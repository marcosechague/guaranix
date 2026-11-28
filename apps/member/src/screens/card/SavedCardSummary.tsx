import { t } from '@guaranix/shared';
import type { SavedCardView } from '@guaranix/shared/api';
import { Badge, Button, Card } from '@guaranix/ui';
import { CreditCard } from 'lucide-react';
import { useState } from 'react';

export interface SavedCardSummaryProps {
  card: SavedCardView;
  autopayEnabled: boolean;
  removing: boolean;
  onRemove: () => void;
}

export function SavedCardSummary({
  card,
  autopayEnabled,
  removing,
  onRemove,
}: SavedCardSummaryProps) {
  // Removing stops automatic charges: it takes a second tap.
  const [confirming, setConfirming] = useState(false);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <CreditCard aria-hidden="true" size={28} className="text-accent" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-lg font-bold whitespace-nowrap tabular-nums">
            {t('member.cards.masked', { brand: card.brand ?? '', last4: card.last4 ?? '····' })}
          </span>
          {card.expiresOn ? (
            <span className="text-sm text-text-secondary">
              {t('member.cards.expires', { date: card.expiresOn })}
            </span>
          ) : null}
        </div>
        <Badge tone={autopayEnabled ? 'success' : 'neutral'} dot>
          {autopayEnabled ? t('member.cards.autopayOn') : t('member.cards.autopayOff')}
        </Badge>
      </div>
      <p className="text-sm text-text-secondary">
        {autopayEnabled ? t('member.cards.autopayOnHint') : t('member.cards.autopayOffHint')}
      </p>
      {confirming ? (
        <Button type="button" variant="danger" disabled={removing} onClick={onRemove}>
          {t('member.cards.removeConfirm')}
        </Button>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
          {t('member.cards.remove')}
        </Button>
      )}
    </Card>
  );
}
