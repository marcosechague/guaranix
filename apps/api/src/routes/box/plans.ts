import { createPlanSchema, planPauseSchema } from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { idParam, parseBody, respond } from '../../lib/service-route';
import { cancelMemberPlan, pauseMemberPlan, removePause } from '../../services/member-plans';
import { createPlan, listPlans, updatePlan } from '../../services/plans';
import { ANY_ROLE, FRONT_DESK, MANAGERS } from './roles';

const plans = createBoxRouter();

plans.get('/', ANY_ROLE, (context) =>
  respond(context, async (service) => ({ plans: await listPlans(service) })),
);

plans.post('/', MANAGERS, (context) =>
  respond(
    context,
    async (service) => ({
      plan: await createPlan(service, await parseBody(context, createPlanSchema)),
    }),
    201,
  ),
);

// The whole plan is sent back: kind and limits are validated together.
plans.patch('/:planId', MANAGERS, (context) =>
  respond(context, async (service) => {
    const planId = idParam(context, 'planId', 'plan');
    return { plan: await updatePlan(service, planId, await parseBody(context, createPlanSchema)) };
  }),
);

export const planRoutes = plans.router;

const memberPlans = createBoxRouter();

memberPlans.post('/:memberPlanId/pauses', FRONT_DESK, (context) =>
  respond(
    context,
    async (service) => {
      const memberPlanId = idParam(context, 'memberPlanId', 'member_plan');
      const input = await parseBody(context, planPauseSchema, { memberPlanId });
      return await pauseMemberPlan(service, memberPlanId, input);
    },
    201,
  ),
);

memberPlans.delete('/pauses/:pauseId', FRONT_DESK, (context) =>
  respond(context, async (service) => ({
    memberPlan: await removePause(service, idParam(context, 'pauseId', 'pause')),
  })),
);

memberPlans.post('/:memberPlanId/cancel', FRONT_DESK, (context) =>
  respond(context, async (service) => ({
    memberPlan: await cancelMemberPlan(service, idParam(context, 'memberPlanId', 'member_plan')),
  })),
);

export const memberPlanRoutes = memberPlans.router;
