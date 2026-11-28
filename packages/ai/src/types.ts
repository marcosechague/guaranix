import type { AiProviderName } from '@guaranix/shared/domain';

export type AiImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/** What the model reads. Files travel inline as base64; nothing is uploaded to provider storage. */
export type AiInputPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: AiImageMediaType; data: string }
  | { type: 'pdf'; data: string; fileName: string };

/** A JSON Schema every provider accepts: all properties required, `additionalProperties: false`. */
export type PortableJsonSchema = Record<string, unknown>;

export interface AiExtractionRequest {
  /** Fixed instructions; never mixes in user data, so prompts stay cacheable and safe. */
  instructions: string;
  parts: AiInputPart[];
  /** Short identifier OpenAI requires for the schema, e.g. `member_rows`. */
  schemaName: string;
  schema: PortableJsonSchema;
  maxOutputTokens: number;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiExtractionResult {
  /** Parsed JSON as the model returned it; callers validate it with Zod. */
  output: unknown;
  usage: AiUsage;
  /** The model that actually answered (may differ from the configured one after a fallback). */
  model: string;
}

/** One adapter per provider. Swap or mock it without touching the features that use it. */
export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;
  extract(request: AiExtractionRequest): Promise<AiExtractionResult>;
}

export interface AiProviderConfig {
  provider: AiProviderName;
  model: string;
  apiKey: string;
  /** Injected in tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
}
