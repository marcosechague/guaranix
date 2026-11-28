import { boxStatusChangeSchema, type PlatformBoxSummary, t } from '@guaranix/shared';
import { Button, FormMessage, Sheet, TextAreaField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useBoxMutations } from '../../api/queries';
import { ADMIN_URL } from '../../config';

export type ReasonAction = 'suspend' | 'remove' | 'impersonate';

export interface BoxActionSheetProps {
  box: Pick<PlatformBoxSummary, 'id' | 'name'>;
  action: ReasonAction | null;
  onClose: () => void;
}

/** Suspending, removing or entering a box all need a reason that lands in its history. */
export function BoxActionSheet({ box, action, onClose }: BoxActionSheetProps) {
  const toast = useToast();
  const { changeStatus, impersonate } = useBoxMutations(box.id);
  const [reason, setReason] = useState('');
  const [invalid, setInvalid] = useState(false);
  const mutation = action === 'impersonate' ? impersonate : changeStatus;
  const copy = action ? `platform.statusChange.${action}` : null;

  function close() {
    setReason('');
    setInvalid(false);
    mutation.reset();
    onClose();
  }

  async function confirm() {
    if (!action) return;
    const parsed = boxStatusChangeSchema.safeParse({ reason });
    if (!parsed.success) return setInvalid(true);
    if (action === 'impersonate') {
      await impersonate.mutateAsync(parsed.data.reason);
      toast.show(t('platform.statusChange.impersonate.done', { name: box.name }), 'success');
      window.location.assign(ADMIN_URL);
      return;
    }
    await changeStatus.mutateAsync({ action, reason: parsed.data.reason });
    toast.show(t(`platform.statusChange.${action}.done`, { name: box.name }), 'success');
    close();
  }

  if (!copy || !action) return null;
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && close()}
      title={t(`platform.statusChange.${action}.title`, { name: box.name })}
      description={t(`platform.statusChange.${action}.description`)}
      closeLabel={t('platform.box.close')}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={close}>
            {t('platform.statusChange.cancel')}
          </Button>
          <Button
            className="flex-1"
            disabled={mutation.isPending}
            onClick={() => void confirm().catch(() => undefined)}
          >
            {t(`platform.statusChange.${action}.confirm`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextAreaField
          label={t('platform.statusChange.reason')}
          placeholder={t(`platform.statusChange.${action}.reasonHint`)}
          error={invalid ? t('platform.newBox.required') : undefined}
          value={reason}
          maxLength={240}
          rows={3}
          autoFocus
          onChange={(event) => {
            setReason(event.target.value);
            setInvalid(false);
          }}
        />
        {mutation.error ? (
          <FormMessage tone="error">{errorText(mutation.error)}</FormMessage>
        ) : null}
      </div>
    </Sheet>
  );
}
