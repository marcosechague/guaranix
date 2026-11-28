import { t } from '@guaranix/shared';
import type { PaymentMethod } from '@guaranix/shared/domain';
import { Badge } from './Badge';
import { Banknote, CreditCard, Landmark, QrCode, type LucideIcon } from 'lucide-react';

const ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  bank_transfer: Landmark,
  qr: QrCode,
  card: CreditCard,
};

/** Cash, transfer or QR, with its icon. */
export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const Icon = ICONS[method];
  return (
    <Badge tone="outline">
      <Icon aria-hidden="true" size={13} />
      {t(`payments.methods.${method}`)}
    </Badge>
  );
}
