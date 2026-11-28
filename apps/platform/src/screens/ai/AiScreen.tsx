import { t } from '@guaranix/shared';
import { FormMessage, Page, PageHeader, Skeleton } from '@guaranix/ui';
import { useAiConfiguration } from '../../api/ai';
import { AiKeysCard } from './AiKeysCard';
import { AiSettingsCard } from './AiSettingsCard';

/** Provider, model and keys for every AI feature. Which plans get them is set in each plan. */
export function AiScreen() {
  const { data: configuration } = useAiConfiguration();
  return (
    <Page layout="panel">
      <PageHeader
        size="large"
        title={t('platform.ai.title')}
        subtitle={t('platform.ai.subtitle')}
      />
      {!configuration ? (
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {configuration.secretsKeyConfigured ? null : (
            <FormMessage tone="error">{t('platform.ai.missingSecretsKey')}</FormMessage>
          )}
          <AiSettingsCard
            key={`${configuration.settings?.provider}-${configuration.settings?.model}`}
            configuration={configuration}
          />
          <AiKeysCard configuration={configuration} />
        </div>
      )}
    </Page>
  );
}
