import {
  formatGuarani,
  formatShortDate,
  RECEIPT_CONTENT_TYPES,
  RECEIPT_MAX_BYTES,
  recordPaymentSchema,
  t,
} from '@guaranix/shared';
import type { Charge } from '@guaranix/shared/api';
import {
  FileField,
  FormMessage,
  MoneyField,
  SegmentedControl,
  SelectField,
  Sheet,
  TextField,
  useToast,
  SheetFormActions,
} from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useRecordPayment } from '../../api/mutations';
import { useMembers, useOpenCharges } from '../../api/queries';

type StaffMethod = 'cash' | 'bank_transfer' | 'qr';

export interface RegisterPaymentSheetProps {
  /** Opens with this member chosen, e.g. from the debtors list. */
  initialMemberId: string | null;
  onClose: () => void;
}

const chargeLabel = (charge: Charge) =>
  t('admin.payments.chargeOption', {
    description: charge.description,
    date: formatShortDate(charge.dueOn),
    amount: formatGuarani(charge.outstandingGs),
  });

const PENDING_UPLOAD = 'pending-upload';

/** Same limits the API enforces, checked before uploading so the error shows at once. */
function receiptProblem(file: File | null, method: StaffMethod): string | undefined {
  if (!file) return method === 'qr' ? t('errors.receipt_required') : undefined;
  if (!(RECEIPT_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return t('errors.receipt_type');
  }
  return file.size > RECEIPT_MAX_BYTES ? t('errors.receipt_too_large') : undefined;
}

export function RegisterPaymentSheet({ initialMemberId, onClose }: RegisterPaymentSheetProps) {
  const members = useMembers('', 'active');
  const [memberId, setMemberId] = useState(initialMemberId ?? '');
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<StaffMethod>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [invalid, setInvalid] = useState(false);
  const charges = useOpenCharges(memberId || null);
  const record = useRecordPayment();
  const toast = useToast();

  // The oldest open fee is the one being paid almost always, so it comes preselected.
  const openCharges = (charges.data ?? []).filter((charge) => charge.outstandingGs > 0);
  const selectedChargeId = chargeId ?? openCharges[0]?.id ?? '';
  const selectedCharge = openCharges.find((charge) => charge.id === selectedChargeId);
  const amountValue = amount ?? selectedCharge?.outstandingGs ?? null;
  const receiptError = invalid ? receiptProblem(receipt, method) : undefined;

  const pickMember = (value: string) => {
    setMemberId(value);
    setChargeId(null);
    setAmount(null);
  };
  const pickCharge = (value: string) => {
    setChargeId(value);
    setAmount(null);
  };

  const submit = () => {
    const attached = method === 'cash' ? null : receipt;
    const parsed = recordPaymentSchema.safeParse({
      memberId,
      chargeId: selectedChargeId || null,
      amountGs: amountValue ?? 0,
      method,
      paidAt: new Date().toISOString(),
      reference: method !== 'cash' && reference.trim() ? reference.trim() : null,
      notes: notes.trim() || null,
      // The real key comes back from the upload (see useRecordPayment); this lets the QR rule pass.
      receiptFileKey: attached ? PENDING_UPLOAD : null,
    });
    const ok = parsed.success && !receiptProblem(attached, method);
    setInvalid(!ok);
    if (!ok) return;
    record.mutate(
      { input: parsed.data, receipt: attached },
      {
        onSuccess: (payment) => {
          toast.show(t('admin.payments.saved', { amount: formatGuarani(payment.amountGs) }));
          onClose();
        },
      },
    );
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('admin.payments.register')}
      closeLabel={t('common.close')}
      footer={
        <SheetFormActions
          onSubmit={submit}
          pending={record.isPending}
          disabled={!memberId}
          onCancel={onClose}
          submitLabel={t('admin.payments.register')}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField
          label={t('admin.payments.member')}
          value={memberId}
          onChange={(event) => pickMember(event.target.value)}
        >
          <option value="">{t('admin.payments.chooseMember')}</option>
          {(members.data ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.firstName} {member.lastName}
            </option>
          ))}
        </SelectField>
        {memberId ? (
          <SelectField
            label={t('admin.payments.charge')}
            value={selectedChargeId}
            onChange={(event) => pickCharge(event.target.value)}
          >
            {openCharges.map((charge) => (
              <option key={charge.id} value={charge.id}>
                {chargeLabel(charge)}
              </option>
            ))}
            <option value="">{t('admin.payments.noCharge')}</option>
          </SelectField>
        ) : null}
        <MoneyField
          label={t('admin.payments.amount')}
          value={amountValue}
          error={invalid && !amountValue ? t('errors.invalid_input') : undefined}
          onValueChange={setAmount}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-soft">{t('admin.payments.method')}</span>
          <SegmentedControl<StaffMethod>
            label={t('admin.payments.method')}
            value={method}
            onChange={setMethod}
            options={[
              { value: 'cash', label: t('admin.payments.methods.cash') },
              { value: 'bank_transfer', label: t('admin.payments.methods.bank_transfer') },
              { value: 'qr', label: t('admin.payments.methods.qr') },
            ]}
          />
        </div>
        {method === 'cash' ? null : (
          <>
            <TextField
              label={t('admin.payments.reference')}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
            <FileField
              label={
                method === 'qr' ? t('admin.payments.receipt') : t('admin.payments.receiptOptional')
              }
              prompt={t('admin.payments.receiptPrompt')}
              hint={t('admin.payments.receiptHint')}
              accept={RECEIPT_CONTENT_TYPES.join(',')}
              value={receipt}
              onChange={setReceipt}
              error={receiptError}
            />
          </>
        )}
        <TextField
          label={t('admin.payments.notes')}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        {record.isError ? <FormMessage tone="error">{errorText(record.error)}</FormMessage> : null}
      </div>
    </Sheet>
  );
}
