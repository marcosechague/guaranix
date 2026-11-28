import { z } from 'zod';
import { AiProviderError, parseJsonOutput } from '../errors';
import type { AiInputPart, AiProvider, AiProviderConfig } from '../types';
import { dataUrl, postJson } from './http';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const responseSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        message: z.object({
          content: z.string().nullable().optional(),
          refusal: z.string().nullable().optional(),
        }),
      }),
    )
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
});

function toPart(part: AiInputPart) {
  switch (part.type) {
    case 'text':
      return { type: 'text', text: part.text };
    case 'image':
      return { type: 'image_url', image_url: { url: dataUrl(part.mediaType, part.data) } };
    case 'pdf':
      return {
        type: 'file',
        file: { filename: part.fileName, file_data: dataUrl('application/pdf', part.data) },
      };
  }
}

/** Chat Completions with a strict JSON Schema response format; plain fetch keeps the Worker small. */
export function createOpenAiProvider(config: AiProviderConfig): AiProvider {
  const fetchImpl = config.fetch ?? fetch;
  return {
    name: 'openai',
    model: config.model,
    async extract(request) {
      const raw = await postJson(
        fetchImpl,
        ENDPOINT,
        { authorization: `Bearer ${config.apiKey}` },
        {
          model: config.model,
          max_completion_tokens: request.maxOutputTokens,
          messages: [
            { role: 'system', content: request.instructions },
            { role: 'user', content: request.parts.map(toPart) },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: request.schemaName, strict: true, schema: request.schema },
          },
        },
      );
      const parsed = responseSchema.safeParse(raw);
      if (!parsed.success) throw new AiProviderError('invalid_output');
      const [choice] = parsed.data.choices;
      if (!choice) throw new AiProviderError('invalid_output');
      if (choice.message.refusal || choice.finish_reason === 'content_filter') {
        throw new AiProviderError('refused');
      }
      if (choice.finish_reason === 'length') throw new AiProviderError('truncated');
      return {
        output: parseJsonOutput(choice.message.content ?? ''),
        usage: {
          inputTokens: parsed.data.usage?.prompt_tokens ?? 0,
          outputTokens: parsed.data.usage?.completion_tokens ?? 0,
        },
        model: parsed.data.model ?? config.model,
      };
    },
  };
}
