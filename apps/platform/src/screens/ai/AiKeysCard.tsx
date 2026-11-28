import { type AiConfiguration, t } from '@guaranix/shared';
import type { AiProviderName } from '@guaranix/shared/domain';
import { Badge, Button, Card, DividedList, Eyebrow, useToast } from '@guaranix/ui';
import { errorText } from '@guaranix/ui/data';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useAiMutations } from '../../api/ai';
import { formatInstantDate } from '../../lib/box-status';
import { AiKeySheet } from './AiKeySheet';

/** One row per provider: loaded or not, its last four characters, and load, replace or remove. */
export function AiKeysCard({ configuration }: { configuration: AiConfiguration }) {
  const toast = useToast();
  const { removeKey } = useAiMutations();
  const [editing, setEditing] = useState<AiProviderName | null>(null);
  const disabled = !configuration.secretsKeyConfigured;

  async function remove(provider: AiProviderName) {
    await removeKey.mutateAsync(provider);
    toast.show(t('platform.ai.keyRemoved'), 'success');
  }

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <Eyebrow>{t('platform.ai.keys')}</Eyebrow>
        <p className="text-sm text-text-secondary">{t('platform.ai.keysHint')}</p>
      </div>
      <DividedList>
        {configuration.keys.map((key) => {
          const name = t(`platform.ai.providers.${key.provider}`);
          return (
            <li
              key={key.provider}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold">{name}</span>
                {key.hint ? (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
                    <Badge tone="success" dot>
                      {t('platform.ai.keyLoaded', { hint: key.hint })}
                    </Badge>
                    {key.updatedAt
                      ? t('platform.ai.keyUpdated', { date: formatInstantDate(key.updatedAt) })
                      : null}
                  </span>
                ) : (
                  <span className="text-sm text-text-secondary">{t('platform.ai.keyMissing')}</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => setEditing(key.provider)}
                >
                  <KeyRound aria-hidden="true" size={16} />
                  {key.hint ? t('platform.ai.replaceKey') : t('platform.ai.loadKey')}
                </Button>
                {key.hint ? (
                  <Button
                    variant="ghost"
                    className="text-warning"
                    aria-label={t('platform.ai.removeKeyLabel', { provider: name })}
                    disabled={removeKey.isPending}
                    onClick={() =>
                      void remove(key.provider).catch((error: unknown) =>
                        toast.show(errorText(error), 'error'),
                      )
                    }
                  >
                    {t('platform.ai.removeKey')}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </DividedList>
      {editing ? <AiKeySheet provider={editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}
