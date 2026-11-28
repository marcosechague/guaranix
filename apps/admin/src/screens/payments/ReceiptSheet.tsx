import { t } from '@guaranix/shared';
import { Button, FormMessage, Sheet, Skeleton } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { ExternalLink } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { useReceipt } from '../../api/queries';

export interface ReceiptSheetProps {
  name: string;
  fileKey: string;
  onClose: () => void;
  /** E.g. confirm and reject, so the decision is taken looking at the receipt. */
  footer?: ReactNode;
}

/** The member's photo or PDF of the transfer, fetched privately from the API. */
export function ReceiptSheet({ name, fileKey, onClose, footer }: ReceiptSheetProps) {
  const receipt = useReceipt(fileKey);
  const url = receipt.data?.url;
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);

  return (
    <Sheet
      open
      size="lg"
      onOpenChange={(open) => !open && onClose()}
      title={t('admin.payments.receiptTitle', { name })}
      closeLabel={t('common.close')}
      footer={footer}
    >
      {receipt.isPending ? (
        <Skeleton className="aspect-3/4 w-full" />
      ) : receipt.isError ? (
        <FormMessage tone="error">{errorText(receipt.error)}</FormMessage>
      ) : receipt.data.isPdf ? (
        <div className="flex flex-col gap-3">
          <iframe
            // The PDF viewer needs no scripts or forms of ours.
            sandbox=""
            title={t('admin.payments.receiptTitle', { name })}
            src={receipt.data.url}
            className="aspect-3/4 w-full rounded-md border border-border bg-surface"
          />
          <Button asChild variant="secondary">
            <a href={receipt.data.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" size={16} />
              {t('admin.payments.openPdf')}
            </a>
          </Button>
        </div>
      ) : (
        <img
          src={receipt.data.url}
          alt={t('admin.payments.receiptTitle', { name })}
          className="w-full rounded-md border border-border bg-surface object-contain"
        />
      )}
    </Sheet>
  );
}
