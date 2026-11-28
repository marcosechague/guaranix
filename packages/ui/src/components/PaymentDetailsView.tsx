import { t } from '@guaranix/shared';
import type { BoxPaymentDetails } from '@guaranix/shared/schemas';
import { Download } from 'lucide-react';
import { CopyValue } from './CopyValue';

export interface PaymentDetailsViewProps {
  details: BoxPaymentDetails;
  /** Object URL of the QR image, or null while it loads or when there is none. */
  qrUrl: string | null;
  /** Transfer shows the account; QR shows the image to scan or save. */
  method: 'bank_transfer' | 'qr';
}

const TRANSFER_FIELDS = [
  'bankName',
  'accountNumber',
  'alias',
  'holderName',
  'holderDocument',
] as const satisfies readonly (keyof BoxPaymentDetails)[];

function TransferDetails({ details }: { details: BoxPaymentDetails }) {
  const rows = TRANSFER_FIELDS.flatMap((field) => {
    const value = details[field];
    return value ? [{ field, value }] : [];
  });
  if (rows.length === 0) return <Missing text={t('payments.details.noTransfer')} />;
  return (
    <div className="flex flex-col divide-y divide-divider">
      {rows.map(({ field, value }) => (
        <CopyValue key={field} label={t(`payments.details.${field}`)} value={value} />
      ))}
    </div>
  );
}

function QrDetails({ details, qrUrl }: { details: BoxPaymentDetails; qrUrl: string | null }) {
  if (!details.hasQr) return <Missing text={t('payments.details.noQr')} />;
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="size-56 rounded-lg bg-qr-backdrop p-2">
        {qrUrl ? (
          <img src={qrUrl} alt={t('payments.details.qrAlt')} className="size-full object-contain" />
        ) : null}
      </div>
      {details.holderName ? (
        <span className="text-sm text-text-secondary">{details.holderName}</span>
      ) : null}
      {qrUrl ? (
        <a
          href={qrUrl}
          download="qr-pago"
          className="inline-flex min-h-touch items-center gap-2 rounded-pill px-4 text-sm font-semibold text-accent-text hover:bg-surface"
        >
          <Download aria-hidden="true" size={18} strokeWidth={1.75} />
          {t('payments.details.saveQr')}
        </a>
      ) : null}
    </div>
  );
}

function Missing({ text }: { text: string }) {
  return <p className="py-2 text-sm text-text-secondary">{text}</p>;
}

/** Where to send the money, right where the member reports the payment. */
export function PaymentDetailsView({ details, qrUrl, method }: PaymentDetailsViewProps) {
  return (
    <section
      aria-label={t('payments.details.title')}
      className="flex flex-col rounded-lg border border-border bg-surface-sunken px-4 py-2"
    >
      {method === 'qr' ? (
        <QrDetails details={details} qrUrl={qrUrl} />
      ) : (
        <TransferDetails details={details} />
      )}
      {details.note ? (
        <p className="border-t border-divider py-2 text-sm text-text-secondary">{details.note}</p>
      ) : null}
    </section>
  );
}
