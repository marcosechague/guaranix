import {
  type AiProvider,
  type AiProviderConfig,
  AiProviderError,
  createAiProvider,
  openSecret,
} from '@guaranix/ai';
import type { ScopedTransaction } from '@guaranix/db';
import { aiProviderKeys, aiSettings } from '@guaranix/db/schema';
import { eq } from 'drizzle-orm';
import { type ServiceError, unprocessable } from './errors';

export type AiProviderFactory = (config: AiProviderConfig) => AiProvider;

/**
 * The provider the superadmin configured, with its key decrypted in memory for
 * this request only. `transaction` must be a system-scope one: the settings and
 * keys tables are closed to the box role.
 */
export async function loadConfiguredProvider(
  transaction: ScopedTransaction,
  secretsKey: string | undefined,
  factory: AiProviderFactory = createAiProvider,
): Promise<AiProvider> {
  const [settings] = await transaction
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.id, 'default'));
  if (!settings) throw unprocessable('ai_not_configured');
  const [stored] = await transaction
    .select()
    .from(aiProviderKeys)
    .where(eq(aiProviderKeys.provider, settings.provider));
  if (!stored) throw unprocessable('ai_not_configured');
  if (!secretsKey) throw unprocessable('ai_secrets_key_missing');
  const apiKey = await openSecret(secretsKey, stored.encryptedKey, settings.provider).catch(() => {
    // Wrong or rotated master key: the stored key has to be loaded again.
    throw unprocessable('ai_key_unreadable');
  });
  return factory({ provider: settings.provider, model: settings.model, apiKey });
}

/** Provider failures as stable codes the apps translate; nothing from the provider leaks. */
export function aiServiceError(error: AiProviderError): ServiceError {
  switch (error.code) {
    case 'auth':
      return unprocessable('ai_key_rejected');
    case 'rate_limited':
      return unprocessable('ai_rate_limited');
    case 'unavailable':
      return unprocessable('ai_unavailable');
    case 'bad_request':
      return unprocessable('ai_request_rejected');
    case 'refused':
      return unprocessable('ai_refused');
    case 'truncated':
      return unprocessable('ai_answer_too_long');
    case 'invalid_output':
      return unprocessable('ai_invalid_answer');
  }
}

/** Runs a provider call and converts its failures; other errors pass through. */
export async function callProvider<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AiProviderError) throw aiServiceError(error);
    throw error;
  }
}
