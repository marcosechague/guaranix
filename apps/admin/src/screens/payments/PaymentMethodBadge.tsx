import { t } from '@guaranix/shared';
import type { PaymentMethod } from '@guaranix/shared/domain';
import { Badge } from '@guaranix/ui';
import { Banknote, CreditCard, Landmark, QrCode, type LucideIcon } from 'lucide-react';

const ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  bank_transfer: Landmark,
  qr: QrCode,
  card: CreditCard,
};

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const Icon = ICONS[method];
  return (
    <Badge tone="outline">
      <Icon aria-hidden="true" size={13} />
      {t(`admin.payments.methods.${method}`)}
    </Badge>
  );
}
