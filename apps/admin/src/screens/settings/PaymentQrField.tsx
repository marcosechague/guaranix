import { PAYMENT_QR_CONTENT_TYPES, paymentQrFileProblem, t } from '@guaranix/shared';
import { Button, FileField, FormMessage, useToast } from '@guaranix/ui';
import {
  errorText,
  usePaymentQrUrl,
  useRemovePaymentQr,
  useUploadPaymentQr,
} from '@guaranix/ui/data';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface PaymentQrFieldProps {
  hasQr: boolean;
  editable: boolean;
}

/** The QR uploads as soon as it is picked: there is nothing else to fill in. */
export function PaymentQrField({ hasQr, editable }: PaymentQrFieldProps) {
  const qrUrl = usePaymentQrUrl(hasQr);
  const upload = useUploadPaymentQr();
  const remove = useRemovePaymentQr();
  const toast = useToast();
  const [problem, setProblem] = useState<ReturnType<typeof paymentQrFileProblem>>(null);

  const pick = (file: File | null) => {
    if (!file) return;
    const fileProblem = paymentQrFileProblem(file);
    setProblem(fileProblem);
    if (fileProblem) return;
    upload.mutate(file, { onSuccess: () => toast.show(t('admin.settings.qrSaved')) });
  };
  const failure = upload.error ?? remove.error;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex size-36 shrink-0 items-center justify-center rounded-lg border border-border bg-qr-backdrop p-2">
        {qrUrl ? (
          <img src={qrUrl} alt={t('payments.details.qrAlt')} className="size-full object-contain" />
        ) : (
          <span className="px-2 text-center text-xs text-text-secondary">
            {t('admin.settings.qrEmpty')}
          </span>
        )}
      </div>
      {editable ? (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <FileField
            label={t('admin.settings.qr')}
            prompt={upload.isPending ? t('common.saving') : t('admin.settings.qrPrompt')}
            hint={t('admin.settings.qrHint')}
            accept={PAYMENT_QR_CONTENT_TYPES.join(',')}
            value={null}
            onChange={pick}
            error={problem ? t(`errors.${problem}`) : undefined}
          />
          {hasQr ? (
            <Button
              variant="ghost"
              className="self-start"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => toast.show(t('admin.settings.qrRemoved')),
                })
              }
            >
              <Trash2 aria-hidden="true" size={18} strokeWidth={1.75} />
              {t('admin.settings.qrRemove')}
            </Button>
          ) : null}
          {failure ? <FormMessage tone="error">{errorText(failure)}</FormMessage> : null}
        </div>
      ) : null}
    </div>
  );
}
