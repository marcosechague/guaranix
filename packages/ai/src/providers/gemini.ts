import { z } from 'zod';
import { AiProviderError, parseJsonOutput } from '../errors';
import type { AiInputPart, AiProvider, AiProviderConfig } from '../types';
import { postJson } from './http';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REFUSAL_REASONS = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'RECITATION',
]);

const responseSchema = z.object({
  modelVersion: z.string().optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      thoughtsTokenCount: z.number().optional(),
    })
    .optional(),
});

function toPart(part: AiInputPart) {
  switch (part.type) {
    case 'text':
      return { text: part.text };
    case 'image':
      return { inlineData: { mimeType: part.mediaType, data: part.data } };
    case 'pdf':
      return { inlineData: { mimeType: 'application/pdf', data: part.data } };
  }
}

/** `generateContent` with a JSON response schema; the key goes in a header, never in the URL. */
export function createGeminiProvider(config: AiProviderConfig): AiProvider {
  const fetchImpl = config.fetch ?? fetch;
  return {
    name: 'gemini',
    model: config.model,
    async extract(request) {
      const raw = await postJson(
        fetchImpl,
        `${BASE_URL}/${encodeURIComponent(config.model)}:generateContent`,
        { 'x-goog-api-key': config.apiKey },
        {
          systemInstruction: { parts: [{ text: request.instructions }] },
          contents: [{ role: 'user', parts: request.parts.map(toPart) }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: request.schema,
            maxOutputTokens: request.maxOutputTokens,
          },
        },
      );
      const parsed = responseSchema.safeParse(raw);
      if (!parsed.success) throw new AiProviderError('invalid_output');
      const { promptFeedback, candidates, usageMetadata, modelVersion } = parsed.data;
      if (promptFeedback?.blockReason) throw new AiProviderError('refused');
      const [candidate] = candidates ?? [];
      if (!candidate) throw new AiProviderError('invalid_output');
      if (candidate.finishReason && REFUSAL_REASONS.has(candidate.finishReason)) {
        throw new AiProviderError('refused');
      }
      if (candidate.finishReason === 'MAX_TOKENS') throw new AiProviderError('truncated');
      const text = (candidate.content?.parts ?? []).map((part) => part.text ?? '').join('');
      return {
        output: parseJsonOutput(text),
        usage: {
          inputTokens: usageMetadata?.promptTokenCount ?? 0,
          outputTokens:
            (usageMetadata?.candidatesTokenCount ?? 0) + (usageMetadata?.thoughtsTokenCount ?? 0),
        },
        model: modelVersion ?? config.model,
      };
    },
  };
}
