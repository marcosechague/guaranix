import Anthropic from '@anthropic-ai/sdk';
import { AiProviderError, errorForStatus, parseJsonOutput } from '../errors';
import type { AiInputPart, AiProvider, AiProviderConfig } from '../types';

/** Models that accept server-side fallbacks: a safety decline is retried on another model. */
const FALLBACK_MODELS = new Set([
  'claude-fable-5-2',
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

function toBlock(part: AiInputPart): Anthropic.Beta.BetaContentBlockParam {
  switch (part.type) {
    case 'text':
      return { type: 'text', text: part.text };
    case 'image':
      return {
        type: 'image',
        source: { type: 'base64', media_type: part.mediaType, data: part.data },
      };
    case 'pdf':
      return {
        type: 'document',
        title: part.fileName,
        source: { type: 'base64', media_type: 'application/pdf', data: part.data },
      };
  }
}

function toProviderError(error: unknown): unknown {
  if (error instanceof AiProviderError) return error;
  if (error instanceof Anthropic.APIConnectionError) return new AiProviderError('unavailable');
  if (error instanceof Anthropic.APIError && typeof error.status === 'number') {
    return errorForStatus(error.status);
  }
  return error;
}

export function createAnthropicProvider(config: AiProviderConfig): AiProvider {
  const client = new Anthropic({
    apiKey: config.apiKey,
    // Explicit, so an `ANTHROPIC_BASE_URL` in a developer's shell never redirects the key.
    baseURL: 'https://api.anthropic.com',
    maxRetries: 1,
    timeout: 120_000,
    ...(config.fetch ? { fetch: config.fetch } : {}),
  });
  const fallbacks: Pick<Anthropic.Beta.MessageCreateParams, 'betas' | 'fallbacks'> =
    FALLBACK_MODELS.has(config.model)
      ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }
      : {};

  return {
    name: 'anthropic',
    model: config.model,
    async extract(request) {
      try {
        // Streaming keeps long answers (hundreds of rows) clear of HTTP timeouts.
        const message = await client.beta.messages
          .stream({
            model: config.model,
            max_tokens: request.maxOutputTokens,
            system: request.instructions,
            messages: [{ role: 'user', content: request.parts.map(toBlock) }],
            output_config: { format: { type: 'json_schema', schema: request.schema } },
            ...fallbacks,
          })
          .finalMessage();
        if (message.stop_reason === 'refusal') throw new AiProviderError('refused');
        if (message.stop_reason === 'max_tokens') throw new AiProviderError('truncated');
        const text = message.content
          .flatMap((block) => (block.type === 'text' ? [block.text] : []))
          .join('');
        const usage = message.usage;
        return {
          output: parseJsonOutput(text),
          usage: {
            inputTokens:
              usage.input_tokens +
              (usage.cache_read_input_tokens ?? 0) +
              (usage.cache_creation_input_tokens ?? 0),
            outputTokens: usage.output_tokens,
          },
          model: message.model,
        };
      } catch (error) {
        throw toProviderError(error);
      }
    },
  };
}
