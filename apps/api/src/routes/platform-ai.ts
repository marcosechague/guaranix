import {
  aiProviderKeyInputSchema,
  aiProviderSchema,
  aiSettingsInputSchema,
  boxFeatureInputSchema,
  featureFlagSchema,
  planFeatureInputSchema,
} from '@guaranix/shared';
import type { Context } from 'hono';
import { idParam, parseBody } from '../lib/service-route';
import type { createPlatformRouter, PlatformEnv } from '../middleware/platform-scope';
import { notFound } from '../services/errors';
import {
  type AiRuntime,
  getAiConfiguration,
  removeAiProviderKey,
  setAiProviderKey,
  testAiProvider,
  updateAiSettings,
} from '../services/platform-ai';
import {
  listBoxFeatures,
  listPlanFeatures,
  setBoxFeature,
  setPlanFeature,
} from '../services/platform-features';
import { run } from './platform-run';

type PlatformRequest = Context<PlatformEnv>;

const aiRuntime = (context: PlatformRequest): AiRuntime => ({
  secretsKey: context.env.AI_SECRETS_KEY,
  factory: context.var.services.aiProviderFactory,
});

function providerParam(context: PlatformRequest) {
  const parsed = aiProviderSchema.safeParse(context.req.param('provider'));
  if (!parsed.success) throw notFound('ai_provider');
  return parsed.data;
}

function featureParam(context: PlatformRequest) {
  const parsed = featureFlagSchema.safeParse(context.req.param('feature'));
  if (!parsed.success) throw notFound('feature');
  return parsed.data;
}

/** AI provider, keys and paid features per plan and per box (see docs/decisions/0009). */
export function registerPlatformAiRoutes(platform: ReturnType<typeof createPlatformRouter>) {
  platform.get('/ai', (context) =>
    run(context, (service) => getAiConfiguration(service, aiRuntime(context))),
  );

  platform.patch('/ai', (context) =>
    run(context, async (service) => ({
      settings: await updateAiSettings(service, await parseBody(context, aiSettingsInputSchema)),
    })),
  );

  platform.put('/ai/keys/:provider', (context) =>
    run(context, async (service) => {
      const provider = providerParam(context);
      const input = await parseBody(context, aiProviderKeyInputSchema);
      return { key: await setAiProviderKey(service, aiRuntime(context), provider, input) };
    }),
  );

  platform.delete('/ai/keys/:provider', (context) =>
    run(context, (service) => removeAiProviderKey(service, providerParam(context))),
  );

  platform.post('/ai/test', (context) =>
    run(context, (service) => testAiProvider(service, aiRuntime(context))),
  );

  platform.get('/plans/:planId/features', (context) =>
    run(context, async (service) => ({
      features: await listPlanFeatures(service, idParam(context, 'planId', 'platform_plan')),
    })),
  );

  platform.put('/plans/:planId/features/:feature', (context) =>
    run(context, async (service) => {
      const planId = idParam(context, 'planId', 'platform_plan');
      const feature = featureParam(context);
      const input = await parseBody(context, planFeatureInputSchema);
      return { feature: await setPlanFeature(service, planId, feature, input) };
    }),
  );

  platform.get('/boxes/:boxId/features', (context) =>
    run(context, async (service) => ({
      features: await listBoxFeatures(service, idParam(context, 'boxId', 'box')),
    })),
  );

  platform.put('/boxes/:boxId/features/:feature', (context) =>
    run(context, async (service) => {
      const boxId = idParam(context, 'boxId', 'box');
      const feature = featureParam(context);
      const input = await parseBody(context, boxFeatureInputSchema);
      return { feature: await setBoxFeature(service, boxId, feature, input) };
    }),
  );
}
