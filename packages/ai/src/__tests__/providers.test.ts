import { describe, expect, it } from 'vitest';
import { createAiProvider } from '../factory';
import type { AiExtractionRequest } from '../types';
import { anthropicStream, fetchDouble, jsonResponse } from './fetch-double';

const API_KEY = 'sk-test-key-0000000000001234'; // secret-scan-ignore: fake key for tests

const request: AiExtractionRequest = {
  instructions: 'Extract the members.',
  parts: [
    { type: 'pdf', data: 'JVBERi0=', fileName: 'alumnos.pdf' },
    { type: 'image', mediaType: 'image/jpeg', data: '/9j/' },
    { type: 'text', text: 'Columns: name.' },
  ],
  schemaName: 'members',
  schema: {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
    additionalProperties: false,
  },
  maxOutputTokens: 4000,
};

describe('anthropic adapter', () => {
  it('streams a structured answer with files inline and fallbacks on', async () => {
    const { fetchImpl, requests } = fetchDouble(() => anthropicStream({ text: '{"name":"Ana"}' }));
    const provider = createAiProvider({
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      apiKey: API_KEY,
      fetch: fetchImpl,
    });
    const result = await provider.extract(request);
    expect(result).toEqual({
      output: { name: 'Ana' },
      usage: { inputTokens: 1200, outputTokens: 80 },
      model: 'claude-opus-5-5',
    });
    const [sent] = requests;
    expect(sent?.url).toBe('https://api.anthropic.com/v1/messages');
    expect(sent?.headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
    expect(sent?.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(sent?.body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      system: 'Extract the members.',
      stream: true,
      fallbacks: 'default',
      output_config: { format: { type: 'json_schema', schema: request.schema } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf' } },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } },
            { type: 'text', text: 'Columns: name.' },
          ],
        },
      ],
    });
  });

  it('sends no fallbacks for models that do not take them', async () => {
    const { fetchImpl, requests } = fetchDouble(() => anthropicStream({ text: '{"name":"Ana"}' }));
    const provider = createAiProvider({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      apiKey: API_KEY,
      fetch: fetchImpl,
    });
    await provider.extract(request);
    expect(requests[0]?.body).not.toHaveProperty('fallbacks');
  });

  it.each([
    ['refusal', 'refused'],
    ['max_tokens', 'truncated'],
  ])('turns stop reason %s into %s', async (stopReason, code) => {
    const { fetchImpl } = fetchDouble(() => anthropicStream({ text: '{"na', stopReason }));
    const provider = createAiProvider({
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      apiKey: API_KEY,
      fetch: fetchImpl,
    });
    await expect(provider.extract(request)).rejects.toMatchObject({ code });
  });

  it('reports a rejected key without echoing it', async () => {
    const { fetchImpl } = fetchDouble(() =>
      jsonResponse({ type: 'error', error: { type: 'authentication_error' } }, 401),
    );
    const provider = createAiProvider({
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      apiKey: API_KEY,
      fetch: fetchImpl,
    });
    const error = await provider.extract(request).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'auth', status: 401 });
    expect(String(error)).not.toContain(API_KEY);
  });
});

describe('openai adapter', () => {
  const answer = (message: Record<string, unknown>, finishReason = 'stop') =>
    jsonResponse({
      model: 'gpt-test',
      choices: [{ finish_reason: finishReason, message }],
      usage: { prompt_tokens: 900, completion_tokens: 60 },
    });

  it('asks for strict JSON with files as data URLs', async () => {
    const { fetchImpl, requests } = fetchDouble(() => answer({ content: '{"name":"Ana"}' }));
    const provider = createAiProvider({
      provider: 'openai',
      model: 'gpt-test',
      apiKey: API_KEY,
      fetch: fetchImpl,
    });
    expect(await provider.extract(request)).toEqual({
      output: { name: 'Ana' },
      usage: { inputTokens: 900, outputTokens: 60 },
      model: 'gpt-test',
    });
    const [sent] = requests;
    expect(sent?.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(sent?.headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
    expect(sent?.body).toMatchObject({
      model: 'gpt-test',
      max_completion_tokens: 4000,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'members', strict: true, schema: request.schema },
      },
      messages: [
        { role: 'system', content: 'Extract the members.' },
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: { filename: 'alumnos.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' },
            },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/' } },
            { type: 'text', text: 'Columns: name.' },
          ],
        },
      ],
    });
  });

  it('maps refusals, truncation and rate limits', async () => {
    const run = (response: () => Response) =>
      createAiProvider({
        provider: 'openai',
        model: 'gpt-test',
        apiKey: API_KEY,
        fetch: fetchDouble(response).fetchImpl,
      }).extract(request);
    await expect(run(() => answer({ content: null, refusal: 'No.' }))).rejects.toMatchObject({
      code: 'refused',
    });
    await expect(run(() => answer({ content: '{"na' }, 'length'))).rejects.toMatchObject({
      code: 'truncated',
    });
    await expect(run(() => jsonResponse({}, 429))).rejects.toMatchObject({
      code: 'rate_limited',
    });
    await expect(run(() => answer({ content: 'not json' }))).rejects.toMatchObject({
      code: 'invalid_output',
    });
  });
});

describe('gemini adapter', () => {
  const answer = (body: Record<string, unknown>) => jsonResponse(body);

  it('sends the key in a header and the schema as JSON Schema', async () => {
    const { fetchImpl, requests } = fetchDouble(() =>
      answer({
        modelVersion: 'gemini-test-001',
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"name":"Ana"}' }] } }],
        usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 40, thoughtsTokenCount: 10 },
      }),
    );
    const provider = createAiProvider({
      provider: 'gemini',
      model: 'gemini-test',
      apiKey: API_KEY,
      fetch: fetchImpl,
    });
    expect(await provider.extract(request)).toEqual({
      output: { name: 'Ana' },
      usage: { inputTokens: 700, outputTokens: 50 },
      model: 'gemini-test-001',
    });
    const [sent] = requests;
    expect(sent?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
    );
    expect(sent?.url).not.toContain(API_KEY);
    expect(sent?.headers.get('x-goog-api-key')).toBe(API_KEY);
    expect(sent?.body).toMatchObject({
      systemInstruction: { parts: [{ text: 'Extract the members.' }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: request.schema,
        maxOutputTokens: 4000,
      },
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: 'JVBERi0=' } },
            { inlineData: { mimeType: 'image/jpeg', data: '/9j/' } },
            { text: 'Columns: name.' },
          ],
        },
      ],
    });
  });

  it('maps blocked prompts and truncated answers', async () => {
    const run = (body: Record<string, unknown>) =>
      createAiProvider({
        provider: 'gemini',
        model: 'gemini-test',
        apiKey: API_KEY,
        fetch: fetchDouble(() => answer(body)).fetchImpl,
      }).extract(request);
    await expect(run({ promptFeedback: { blockReason: 'SAFETY' } })).rejects.toMatchObject({
      code: 'refused',
    });
    await expect(
      run({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }] }),
    ).rejects.toMatchObject({ code: 'truncated' });
  });
});
