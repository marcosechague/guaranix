import type { AiProviderName } from '@guaranix/shared/domain';
import type { AiExtractionRequest, AiProvider, AiUsage } from '../types';

export interface MockProvider extends AiProvider {
  /** Every request received, to assert what was (and was not) sent to the provider. */
  readonly calls: AiExtractionRequest[];
}

/** Test double: answers with `respond(request)`, or throws what it throws. */
export function createMockProvider(
  respond: (request: AiExtractionRequest) => unknown,
  options: { name?: AiProviderName; model?: string; usage?: AiUsage } = {},
): MockProvider {
  const calls: AiExtractionRequest[] = [];
  const model = options.model ?? 'mock-model';
  return {
    name: options.name ?? 'anthropic',
    model,
    calls,
    async extract(request) {
      calls.push(request);
      const output = await respond(request);
      return { output, usage: options.usage ?? { inputTokens: 100, outputTokens: 50 }, model };
    },
  };
}
