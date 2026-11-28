import {
  type AiConfiguration,
  aiSettingsInputSchema,
  SUGGESTED_AI_MODELS,
  t,
} from '@guaranix/shared';
import { AI_PROVIDERS, type AiProviderName } from '@guaranix/shared/domain';
import { Button, Card, Eyebrow, FormMessage, SelectField, TextField, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { PlugZap } from 'lucide-react';
import { useState } from 'react';
import { useAiMutations } from '../../api/ai';

const providerName = (provider: AiProviderName) => t(`platform.ai.providers.${provider}`);

/** Which provider and model every AI feature uses, and a cheap call to prove the key works. */
export function AiSettingsCard({ configuration }: { configuration: AiConfiguration }) {
  const toast = useToast();
  const { saveSettings, test } = useAiMutations();
  const current = configuration.settings;
  const [provider, setProvider] = useState<AiProviderName>(current?.provider ?? 'anthropic');
  const [model, setModel] = useState(current?.model ?? SUGGESTED_AI_MODELS.anthropic ?? '');
  const [invalid, setInvalid] = useState(false);
  const hasKey = configuration.keys.some((key) => key.provider === provider && key.hint);
  const saved = current?.provider === provider && current.model === model.trim();

  function changeProvider(next: AiProviderName) {
    // Keep a model the admin typed; replace one we suggested for the previous provider.
    if (model === '' || model === SUGGESTED_AI_MODELS[provider]) {
      setModel(SUGGESTED_AI_MODELS[next] ?? '');
    }
    setProvider(next);
  }

  async function submit() {
    const parsed = aiSettingsInputSchema.safeParse({ provider, model });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    await saveSettings.mutateAsync(parsed.data);
    toast.show(t('platform.ai.saved'), 'success');
  }

  async function runTest() {
    const result = await test.mutateAsync();
    toast.show(t('platform.ai.testOk', { model: result.model }), 'success');
  }

  const error = saveSettings.error ?? test.error;
  return (
    <Card>
      <div className="flex flex-col gap-1">
        <Eyebrow>{t('platform.ai.settings')}</Eyebrow>
        <p className="text-sm text-text-secondary">{t('platform.ai.settingsHint')}</p>
      </div>
      {current ? null : <FormMessage tone="error">{t('platform.ai.notConfigured')}</FormMessage>}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('platform.ai.provider')}
          value={provider}
          onChange={(event) => changeProvider(event.target.value as AiProviderName)}
        >
          {AI_PROVIDERS.map((option) => (
            <option key={option} value={option}>
              {providerName(option)}
            </option>
          ))}
        </SelectField>
        <TextField
          label={t('platform.ai.model')}
          hint={t('platform.ai.modelHint')}
          value={model}
          autoComplete="off"
          spellCheck={false}
          error={invalid ? t('platform.ai.modelInvalid') : undefined}
          onChange={(event) => setModel(event.target.value)}
        />
      </div>
      {hasKey ? null : <p className="text-sm text-warning">{t('platform.ai.noKeyForProvider')}</p>}
      {error ? <FormMessage tone="error">{errorText(error)}</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={saveSettings.isPending || saved}
          onClick={() => void submit().catch(() => undefined)}
        >
          {t('platform.ai.save')}
        </Button>
        <Button
          variant="secondary"
          disabled={!saved || !hasKey || test.isPending}
          onClick={() => void runTest().catch(() => undefined)}
        >
          <PlugZap aria-hidden="true" size={18} />
          {test.isPending ? t('platform.ai.testing') : t('platform.ai.test')}
        </Button>
      </div>
    </Card>
  );
}
