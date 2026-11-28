import {
  formatGuarani,
  RECEIPT_CONTENT_TYPES,
  receiptFileProblem,
  recordPaymentSchema,
  t,
} from '@guaranix/shared';
import type { OwnAccount } from '@guaranix/shared/api';
import {
  FileField,
  FormMessage,
  MoneyField,
  SegmentedControl,
  SelectField,
  Sheet,
  SheetFormActions,
  TextField,
  useToast,
} from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useReportPayment } from '../../api/mutations';
import { openCharges } from '../../lib/fees';

type MemberMethod = 'bank_transfer' | 'qr';

export interface ReportPaymentSheetProps {
  memberId: string;
  account: OwnAccount;
  onClose: () => void;
}

// The real key comes back from the upload (see recordPaymentWithReceipt); this lets the schema's QR rule pass.
const PENDING_UPLOAD = 'pending-upload';

/** Transfer or QR with its receipt; the front desk confirms it afterwards. */
export function ReportPaymentSheet({ memberId, account, onClose }: ReportPaymentSheetProps) {
  const charges = openCharges(account);
  const [chargeId, setChargeId] = useState(charges[0]?.id ?? '');
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<MemberMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [invalid, setInvalid] = useState(false);
  const report = useReportPayment();
  const toast = useToast();

  const charge = charges.find((item) => item.id === chargeId);
  const amountValue = amount ?? charge?.outstandingGs ?? null;
  const receiptProblem = receipt ? receiptFileProblem(receipt) : 'receipt_required';

  const submit = () => {
    const parsed = recordPaymentSchema.safeParse({
      memberId,
      chargeId: chargeId || null,
      amountGs: amountValue ?? 0,
      method,
      paidAt: new Date().toISOString(),
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      receiptFileKey: PENDING_UPLOAD,
    });
    const ok = parsed.success && receipt !== null && receiptProblem === null;
    setInvalid(!ok);
    if (!ok) return;
    report.mutate(
      { input: parsed.data, receipt },
      {
        onSuccess: () => {
          toast.show(t('member.fees.sent'));
          onClose();
        },
      },
    );
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('member.fees.sheetTitle')}
      description={t('member.fees.sheetDescription')}
      closeLabel={t('common.close')}
      footer={
        <SheetFormActions
          onSubmit={submit}
          pending={report.isPending}
          onCancel={onClose}
          submitLabel={t('member.fees.send')}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {charges.length > 0 ? (
          <SelectField
            label={t('member.fees.charge')}
            value={chargeId}
            onChange={(event) => {
              setChargeId(event.target.value);
              setAmount(null);
            }}
          >
            {charges.map((item) => (
              <option key={item.id} value={item.id}>
                {t('member.fees.chargeOption', {
                  description: item.description,
                  amount: formatGuarani(item.outstandingGs),
                })}
              </option>
            ))}
            <option value="">{t('member.fees.noCharge')}</option>
          </SelectField>
        ) : null}
        <MoneyField
          label={t('member.fees.amount')}
          value={amountValue}
          error={invalid && !amountValue ? t('errors.invalid_input') : undefined}
          onValueChange={setAmount}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-soft">{t('member.fees.method')}</span>
          <SegmentedControl<MemberMethod>
            label={t('member.fees.method')}
            value={method}
            onChange={setMethod}
            options={[
              { value: 'bank_transfer', label: t('payments.methods.bank_transfer') },
              { value: 'qr', label: t('payments.methods.qr') },
            ]}
          />
        </div>
        <FileField
          label={t('member.fees.receipt')}
          prompt={t('member.fees.receiptPrompt')}
          hint={t('member.fees.receiptHint')}
          accept={RECEIPT_CONTENT_TYPES.join(',')}
          value={receipt}
          onChange={setReceipt}
          error={invalid && receiptProblem ? t(`errors.${receiptProblem}`) : undefined}
        />
        <TextField
          label={t('member.fees.reference')}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <TextField
          label={t('member.fees.notes')}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        {report.isError ? <FormMessage tone="error">{errorText(report.error)}</FormMessage> : null}
      </div>
    </Sheet>
  );
}
