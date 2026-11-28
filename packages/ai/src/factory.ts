import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import { createOpenAiProvider } from './providers/openai';
import type { AiProvider, AiProviderConfig } from './types';

/** The only place that knows which adapter backs each provider name. */
export function createAiProvider(config: AiProviderConfig): AiProvider {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicProvider(config);
    case 'openai':
      return createOpenAiProvider(config);
    case 'gemini':
      return createGeminiProvider(config);
  }
}
