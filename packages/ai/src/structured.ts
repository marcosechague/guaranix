import { z } from 'zod';
import { AiProviderError } from './errors';
import type { AiExtractionRequest, AiProvider, AiUsage, PortableJsonSchema } from './types';

type JsonNode = Record<string, unknown>;

function isNode(value: unknown): value is JsonNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every object closed and every property required: what OpenAI strict mode demands and the others accept. */
function closeObjects(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(closeObjects);
  if (!isNode(node)) return node;
  const result: JsonNode = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema') continue;
    result[key] = closeObjects(value);
  }
  if (result.type === 'object' && isNode(result.properties)) {
    result.additionalProperties = false;
    result.required = Object.keys(result.properties);
  }
  return result;
}

/**
 * JSON Schema for a Zod schema, shaped for every provider. Optional values must
 * be modelled as `.nullable()`, since strict mode makes every key required.
 */
export function portableJsonSchema(schema: z.ZodType): PortableJsonSchema {
  const converted = closeObjects(z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' }));
  if (!isNode(converted)) throw new Error('Schema must describe an object');
  return converted;
}

export interface StructuredResult<T> {
  data: T;
  usage: AiUsage;
  model: string;
}

/** Asks the provider for JSON matching `schema` and validates the answer: models can still be wrong. */
export async function extractStructured<T extends z.ZodType>(
  provider: AiProvider,
  request: Omit<AiExtractionRequest, 'schema'>,
  schema: T,
): Promise<StructuredResult<z.output<T>>> {
  const result = await provider.extract({ ...request, schema: portableJsonSchema(schema) });
  const parsed = schema.safeParse(result.output);
  if (!parsed.success) throw new AiProviderError('invalid_output');
  return { data: parsed.data, usage: result.usage, model: result.model };
}
