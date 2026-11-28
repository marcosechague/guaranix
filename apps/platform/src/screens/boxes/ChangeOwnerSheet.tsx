import { changeBoxOwnerSchema, type PlatformBoxSummary, t } from '@guaranix/shared';
import { Button, FormMessage, Sheet, TextField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useBoxMutations } from '../../api/queries';

export interface ChangeOwnerSheetProps {
  box: Pick<PlatformBoxSummary, 'id' | 'name' | 'owner'>;
  onClose: () => void;
}

/** Hands the box to another account; the old owner loses access to it. */
export function ChangeOwnerSheet({ box, onClose }: ChangeOwnerSheetProps) {
  const toast = useToast();
  const { changeOwner } = useBoxMutations(box.id);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [invalid, setInvalid] = useState<{ name?: boolean; email?: boolean }>({});

  async function confirm() {
    const parsed = changeBoxOwnerSchema.safeParse({ ownerName, ownerEmail });
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
      return setInvalid({ name: fields.has('ownerName'), email: fields.has('ownerEmail') });
    }
    await changeOwner.mutateAsync(parsed.data);
    toast.show(t('platform.changeOwner.done', { name: parsed.data.ownerName }), 'success');
    onClose();
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('platform.changeOwner.title', { name: box.name })}
      description={
        box.owner
          ? t('platform.changeOwner.description', { current: box.owner.fullName })
          : t('platform.changeOwner.descriptionNoOwner')
      }
      closeLabel={t('platform.box.close')}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t('platform.newBox.cancel')}
          </Button>
          <Button
            type="submit"
            form="change-owner"
            className="flex-1"
            disabled={changeOwner.isPending}
          >
            {t('platform.changeOwner.confirm')}
          </Button>
        </>
      }
    >
      <form
        id="change-owner"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void confirm().catch(() => undefined);
        }}
      >
        <TextField
          label={t('platform.newBox.ownerName')}
          autoComplete="name"
          value={ownerName}
          error={invalid.name ? t('platform.newBox.required') : undefined}
          onChange={(event) => {
            setOwnerName(event.target.value);
            setInvalid({ ...invalid, name: false });
          }}
        />
        <TextField
          label={t('platform.newBox.ownerEmail')}
          type="email"
          autoComplete="email"
          hint={t('platform.changeOwner.emailHint')}
          value={ownerEmail}
          error={invalid.email ? t('platform.newBox.invalidEmail') : undefined}
          onChange={(event) => {
            setOwnerEmail(event.target.value);
            setInvalid({ ...invalid, email: false });
          }}
        />
        {changeOwner.error ? (
          <FormMessage tone="error">{errorText(changeOwner.error)}</FormMessage>
        ) : null}
      </form>
    </Sheet>
  );
}
