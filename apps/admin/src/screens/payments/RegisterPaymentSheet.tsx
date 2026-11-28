import { formatGuarani, formatShortDate, recordPaymentSchema, t } from '@guaranix/shared';
import type { Charge } from '@guaranix/shared/api';
import {
  FormMessage,
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

type StaffMethod = 'cash' | 'bank_transfer';

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

export function RegisterPaymentSheet({ initialMemberId, onClose }: RegisterPaymentSheetProps) {
  const members = useMembers('', 'active');
  const [memberId, setMemberId] = useState(initialMemberId ?? '');
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<StaffMethod>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [invalid, setInvalid] = useState(false);
  const charges = useOpenCharges(memberId || null);
  const record = useRecordPayment();
  const toast = useToast();

  // The oldest open fee is the one being paid almost always, so it comes preselected.
  const openCharges = (charges.data ?? []).filter((charge) => charge.outstandingGs > 0);
  const selectedChargeId = chargeId ?? openCharges[0]?.id ?? '';
  const selectedCharge = openCharges.find((charge) => charge.id === selectedChargeId);
  const amountValue =
    amount === '' && selectedCharge ? String(selectedCharge.outstandingGs) : amount;

  const pickMember = (value: string) => {
    setMemberId(value);
    setChargeId(null);
    setAmount('');
  };
  const pickCharge = (value: string) => {
    setChargeId(value);
    setAmount('');
  };

  const submit = () => {
    const parsed = recordPaymentSchema.safeParse({
      memberId,
      chargeId: selectedChargeId || null,
      amountGs: Number(amountValue.replace(/\D/g, '')),
      method,
      paidAt: new Date().toISOString(),
      reference: method === 'bank_transfer' && reference.trim() ? reference.trim() : null,
      notes: notes.trim() || null,
    });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    record.mutate(parsed.data, {
      onSuccess: (payment) => {
        toast.show(t('admin.payments.saved', { amount: formatGuarani(payment.amountGs) }));
        onClose();
      },
    });
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('admin.payments.register')}
      description={t('admin.payments.qrNote')}
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
        <TextField
          label={t('admin.payments.amount')}
          inputMode="numeric"
          value={amountValue}
          error={invalid ? t('errors.invalid_input') : undefined}
          onChange={(event) => setAmount(event.target.value)}
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
            ]}
          />
        </div>
        {method === 'bank_transfer' ? (
          <TextField
            label={t('admin.payments.reference')}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        ) : null}
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
