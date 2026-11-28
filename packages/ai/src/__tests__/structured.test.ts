import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createMockProvider } from '../providers/mock';
import { extractStructured, portableJsonSchema } from '../structured';

const rowsSchema = z.object({
  rows: z.array(
    z.object({ name: z.string(), phone: z.string().nullable(), credits: z.number().int() }),
  ),
});

describe('portable JSON schema', () => {
  it('closes every object and requires every key', () => {
    const schema = portableJsonSchema(rowsSchema);
    expect(schema).not.toHaveProperty('$schema');
    expect(schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['rows'],
      properties: {
        rows: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'phone', 'credits'],
          },
        },
      },
    });
  });
});

describe('structured extraction', () => {
  it('returns validated data and sends the schema', async () => {
    const provider = createMockProvider(() => ({
      rows: [{ name: 'Ana', phone: null, credits: 4 }],
    }));
    const result = await extractStructured(
      provider,
      {
        instructions: 'x',
        parts: [{ type: 'text', text: 'Ana' }],
        schemaName: 'rows',
        maxOutputTokens: 100,
      },
      rowsSchema,
    );
    expect(result.data.rows[0]?.name).toBe('Ana');
    expect(provider.calls[0]?.schema).toMatchObject({ type: 'object' });
  });

  it('rejects answers that do not match the schema', async () => {
    const provider = createMockProvider(() => ({ rows: [{ name: 'Ana', credits: 'four' }] }));
    await expect(
      extractStructured(
        provider,
        { instructions: 'x', parts: [], schemaName: 'rows', maxOutputTokens: 100 },
        rowsSchema,
      ),
    ).rejects.toMatchObject({ code: 'invalid_output' });
  });
});
