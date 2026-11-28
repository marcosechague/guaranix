import {
  boxStatusChangeSchema,
  createPlatformBoxSchema,
  platformBoxListQuerySchema,
  platformPlanInputSchema,
  updatePlatformBoxSchema,
  updatePlatformPlanSchema,
} from '@guaranix/shared';
import { idParam, parseBody, parseQuery } from '../lib/service-route';
import { createPlatformRouter } from '../middleware/platform-scope';
import {
  type BoxStatusAction,
  changeBoxStatus,
  createPlatformBox,
} from '../services/platform-box-lifecycle';
import { getPlatformBox, listPlatformBoxes, updatePlatformBox } from '../services/platform-boxes';
import { impersonateBox, stopImpersonating } from '../services/platform-impersonation';
import { platformMetrics } from '../services/platform-metrics';
import {
  createPlatformPlan,
  listPlatformPlans,
  updatePlatformPlan,
} from '../services/platform-plans';
import { registerPlatformAiRoutes } from './platform-ai';
import { run } from './platform-run';

const platform = createPlatformRouter();

platform.get('/metrics', (context) =>
  run(context, async (service) => ({ metrics: await platformMetrics(service) })),
);

platform.get('/plans', (context) =>
  run(context, async (service) => ({ plans: await listPlatformPlans(service) })),
);

platform.post('/plans', (context) =>
  run(
    context,
    async (service) => ({
      plan: await createPlatformPlan(service, await parseBody(context, platformPlanInputSchema)),
    }),
    201,
  ),
);

platform.patch('/plans/:planId', (context) =>
  run(context, async (service) => {
    const planId = idParam(context, 'planId', 'platform_plan');
    const input = await parseBody(context, updatePlatformPlanSchema);
    return { plan: await updatePlatformPlan(service, planId, input) };
  }),
);

platform.get('/boxes', (context) =>
  run(context, async (service) => ({
    boxes: await listPlatformBoxes(service, parseQuery(context, platformBoxListQuerySchema)),
  })),
);

platform.post('/boxes', (context) =>
  run(
    context,
    async (service) =>
      createPlatformBox(service, await parseBody(context, createPlatformBoxSchema)),
    201,
  ),
);

platform.get('/boxes/:boxId', (context) =>
  run(context, (service) => getPlatformBox(service, idParam(context, 'boxId', 'box'))),
);

platform.patch('/boxes/:boxId', (context) =>
  run(context, async (service) => {
    const boxId = idParam(context, 'boxId', 'box');
    return updatePlatformBox(service, boxId, await parseBody(context, updatePlatformBoxSchema));
  }),
);

const STATUS_ROUTES: Record<string, BoxStatusAction> = {
  suspend: 'suspend',
  reactivate: 'reactivate',
  remove: 'remove',
};

for (const [path, action] of Object.entries(STATUS_ROUTES)) {
  platform.post(`/boxes/:boxId/${path}`, (context) =>
    run(context, async (service) => {
      const boxId = idParam(context, 'boxId', 'box');
      // Reactivating needs no reason; suspending and removing do, so staff know why.
      const reason =
        action === 'reactivate' ? null : (await parseBody(context, boxStatusChangeSchema)).reason;
      return changeBoxStatus(service, boxId, action, reason);
    }),
  );
}

platform.post('/boxes/:boxId/impersonate', (context) =>
  run(context, async (service) => {
    const boxId = idParam(context, 'boxId', 'box');
    // Support sees members' personal data, so the reason goes on the box's record.
    const { reason } = await parseBody(context, boxStatusChangeSchema);
    await impersonateBox(service, boxId, reason);
    return { ok: true };
  }),
);

platform.post('/impersonation/end', (context) =>
  run(context, async (service) => {
    await stopImpersonating(service);
    return { ok: true };
  }),
);

registerPlatformAiRoutes(platform);

export const platformRoutes = platform.router;
