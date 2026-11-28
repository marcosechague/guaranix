import { z } from 'zod';
import { AI_PROVIDERS, FEATURE_FLAGS } from '../domain/enums';

export const featureFlagSchema = z.enum(FEATURE_FLAGS);
export const aiProviderSchema = z.enum(AI_PROVIDERS);

/** Uses per month; null means no limit. */
const monthlyLimitSchema = z.number().int().min(0).max(100_000).nullable();

/** What a GuaraniX plan includes. */
export const planFeatureInputSchema = z.object({
  enabled: z.boolean(),
  monthlyLimit: monthlyLimitSchema.default(null),
});

/** A platform decision for one box; null on both means "as its plan says". */
export const boxFeatureInputSchema = z.object({
  enabled: z.boolean().nullable(),
  monthlyLimit: monthlyLimitSchema,
});

export type PlanFeatureInput = z.input<typeof planFeatureInputSchema>;
export type BoxFeatureInput = z.input<typeof boxFeatureInputSchema>;

export interface FeatureSetting {
  enabled: boolean;
  monthlyLimit: number | null;
}

export interface PlanFeatureState extends FeatureSetting {
  feature: (typeof FEATURE_FLAGS)[number];
}

export interface BoxFeatureState {
  feature: (typeof FEATURE_FLAGS)[number];
  /** What the box's GuaraniX plan gives (off when it has no plan). */
  plan: FeatureSetting;
  override: { enabled: boolean | null; monthlyLimit: number | null } | null;
  effective: FeatureSetting;
  usedThisMonth: number;
}

/** Provider and model every AI feature uses. */
export const aiSettingsInputSchema = z.object({
  provider: aiProviderSchema,
  model: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[\w.:/@-]+$/),
});

/** Keys are long random tokens; the bounds only stop obvious paste mistakes. */
export const aiProviderKeyInputSchema = z.object({
  apiKey: z.string().trim().min(20).max(400).regex(/^\S+$/),
});

export type AiSettingsInput = z.input<typeof aiSettingsInputSchema>;
export type AiProviderKeyInput = z.input<typeof aiProviderKeyInputSchema>;

export interface AiProviderKeyState {
  provider: (typeof AI_PROVIDERS)[number];
  /** Last four characters of the loaded key; null when none is loaded. */
  hint: string | null;
  updatedAt: string | null;
}

export interface AiConfiguration {
  settings: { provider: (typeof AI_PROVIDERS)[number]; model: string } | null;
  keys: AiProviderKeyState[];
  /** False when the Worker has no `AI_SECRETS_KEY`: keys cannot be saved or read. */
  secretsKeyConfigured: boolean;
}

/** Model prefilled when the superadmin picks a provider; any model id can be typed instead. */
export const SUGGESTED_AI_MODELS: Partial<Record<(typeof AI_PROVIDERS)[number], string>> = {
  anthropic: 'claude-opus-5-5',
};
