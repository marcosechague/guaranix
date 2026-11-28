import { extractStructured, sealSecret, secretHint } from '@guaranix/ai';
import { aiProviderKeys, aiSettings } from '@guaranix/db/schema';
import {
  type AiConfiguration,
  type AiProviderKeyInput,
  aiProviderKeyInputSchema,
  type AiSettingsInput,
  aiSettingsInputSchema,
} from '@guaranix/shared';
import { AI_PROVIDERS, type AiProviderName } from '@guaranix/shared/domain';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { type AiProviderFactory, callProvider, loadConfiguredProvider } from './ai-runtime';
import { notFound, unprocessable } from './errors';
import { type PlatformContext, recordPlatformAudit } from './platform-context';

/** What the AI services need from the Worker: the master key and how to build a provider. */
export interface AiRuntime {
  secretsKey: string | undefined;
  factory: AiProviderFactory;
}

/** Settings and which keys are loaded. Keys themselves never leave the database. */
export async function getAiConfiguration(
  context: PlatformContext,
  runtime: AiRuntime,
): Promise<AiConfiguration> {
  const [settings] = await context.transaction
    .select({ provider: aiSettings.provider, model: aiSettings.model })
    .from(aiSettings)
    .where(eq(aiSettings.id, 'default'));
  const stored = await context.transaction
    .select({
      provider: aiProviderKeys.provider,
      hint: aiProviderKeys.keyHint,
      updatedAt: aiProviderKeys.updatedAt,
    })
    .from(aiProviderKeys);
  return {
    settings: settings ?? null,
    keys: AI_PROVIDERS.map((provider) => {
      const key = stored.find((row) => row.provider === provider);
      return {
        provider,
        hint: key?.hint ?? null,
        updatedAt: key?.updatedAt.toISOString() ?? null,
      };
    }),
    secretsKeyConfigured: Boolean(runtime.secretsKey),
  };
}

export async function updateAiSettings(context: PlatformContext, input: AiSettingsInput) {
  const values = aiSettingsInputSchema.parse(input);
  const [before] = await context.transaction
    .select({ provider: aiSettings.provider, model: aiSettings.model })
    .from(aiSettings)
    .where(eq(aiSettings.id, 'default'));
  await context.transaction
    .insert(aiSettings)
    .values({ id: 'default', ...values, updatedByUserId: context.actorUserId })
    .onConflictDoUpdate({
      target: aiSettings.id,
      set: { ...values, updatedByUserId: context.actorUserId, updatedAt: context.now },
    });
  await recordPlatformAudit(context, {
    action: 'ai_settings.updated',
    entityType: 'ai_settings',
    entityId: null,
    boxId: null,
    changes: { before: before ?? null, after: values },
  });
  return values;
}

export async function setAiProviderKey(
  context: PlatformContext,
  runtime: AiRuntime,
  provider: AiProviderName,
  input: AiProviderKeyInput,
) {
  if (!runtime.secretsKey) throw unprocessable('ai_secrets_key_missing');
  const { apiKey } = aiProviderKeyInputSchema.parse(input);
  const values = {
    encryptedKey: await sealSecret(runtime.secretsKey, apiKey, provider),
    keyHint: secretHint(apiKey),
    updatedByUserId: context.actorUserId,
  };
  await context.transaction
    .insert(aiProviderKeys)
    .values({ provider, ...values })
    .onConflictDoUpdate({
      target: aiProviderKeys.provider,
      set: { ...values, updatedAt: context.now },
    });
  // The audit names the provider and the hint only: never the key.
  await recordPlatformAudit(context, {
    action: 'ai_provider_key.set',
    entityType: 'ai_provider_key',
    entityId: null,
    boxId: null,
    changes: { provider, hint: values.keyHint },
  });
  return { provider, hint: values.keyHint };
}

export async function removeAiProviderKey(context: PlatformContext, provider: AiProviderName) {
  const removed = await context.transaction
    .delete(aiProviderKeys)
    .where(eq(aiProviderKeys.provider, provider))
    .returning({ provider: aiProviderKeys.provider });
  if (removed.length === 0) throw notFound('ai_provider_key');
  await recordPlatformAudit(context, {
    action: 'ai_provider_key.removed',
    entityType: 'ai_provider_key',
    entityId: null,
    boxId: null,
    changes: { provider },
  });
  return { provider };
}

const pingSchema = z.object({ ok: z.boolean() });

/** A tiny request to the configured provider, so a wrong key or model shows up before a box needs it. */
export async function testAiProvider(context: PlatformContext, runtime: AiRuntime) {
  const provider = await loadConfiguredProvider(
    context.transaction,
    runtime.secretsKey,
    runtime.factory,
  );
  const result = await callProvider(() =>
    extractStructured(
      provider,
      {
        instructions: 'Connection check. Answer with ok set to true.',
        parts: [{ type: 'text', text: 'ping' }],
        schemaName: 'connection_check',
        maxOutputTokens: 1024,
      },
      pingSchema,
    ),
  );
  return { ok: result.data.ok, provider: provider.name, model: result.model };
}
