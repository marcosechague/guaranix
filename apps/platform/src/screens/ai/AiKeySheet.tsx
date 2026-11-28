import { aiProviderKeyInputSchema, t } from '@guaranix/shared';
import type { AiProviderName } from '@guaranix/shared/domain';
import { Button, FormMessage, Sheet, TextField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { useState } from 'react';
import { useAiMutations } from '../../api/ai';

export interface AiKeySheetProps {
  provider: AiProviderName;
  onClose: () => void;
}

/** Write-only: the key is sent once, encrypted by the API, and never shown again. */
export function AiKeySheet({ provider, onClose }: AiKeySheetProps) {
  const toast = useToast();
  const { saveKey } = useAiMutations();
  const [apiKey, setApiKey] = useState('');
  const [invalid, setInvalid] = useState(false);
  const providerName = t(`platform.ai.providers.${provider}`);

  async function submit() {
    const parsed = aiProviderKeyInputSchema.safeParse({ apiKey });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    await saveKey.mutateAsync({ provider, apiKey: parsed.data.apiKey });
    setApiKey('');
    toast.show(t('platform.ai.keySaved'), 'success');
    onClose();
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('platform.ai.keySheetTitle', { provider: providerName })}
      closeLabel={t('platform.box.close')}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t('platform.ai.cancel')}
          </Button>
          <Button type="submit" form="ai-key-form" className="flex-1" disabled={saveKey.isPending}>
            {t('platform.ai.keySave')}
          </Button>
        </>
      }
    >
      <form
        id="ai-key-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit().catch(() => undefined);
        }}
      >
        <TextField
          label={t('platform.ai.keyField')}
          hint={t('platform.ai.keyFieldHint')}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          error={invalid ? t('platform.ai.keyInvalid') : undefined}
          onChange={(event) => setApiKey(event.target.value)}
        />
        {saveKey.error ? <FormMessage tone="error">{errorText(saveKey.error)}</FormMessage> : null}
      </form>
    </Sheet>
  );
}
