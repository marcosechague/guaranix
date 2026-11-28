import {
  assignMemberPlanSchema,
  createMemberSchema,
  listMembersQuerySchema,
  updateMemberSchema,
} from '@guaranix/shared';
import { createBoxRouter } from '../../middleware/box-scope';
import { idParam, parseBody, parseQuery, respond } from '../../lib/service-route';
import { assignMemberPlan, listMemberPlans } from '../../services/member-plans';
import {
  countMembers,
  createMember,
  listMembers,
  updateMember,
  viewMember,
} from '../../services/members';
import { listPersonalRecords } from '../../services/workout-results';
import { FRONT_DESK, STAFF } from './roles';

const routes = createBoxRouter();

routes.get('/', STAFF, (context) =>
  respond(context, async (service) => ({
    members: await listMembers(service, parseQuery(context, listMembersQuerySchema)),
  })),
);

routes.get('/count', STAFF, (context) =>
  respond(context, async (service) => ({ total: await countMembers(service) })),
);

routes.post('/', FRONT_DESK, (context) =>
  respond(
    context,
    async (service) => ({
      member: await createMember(service, await parseBody(context, createMemberSchema)),
    }),
    201,
  ),
);

routes.get('/:memberId', STAFF, (context) =>
  respond(context, async (service) => ({
    member: await viewMember(service, idParam(context, 'memberId', 'member')),
  })),
);

routes.patch('/:memberId', FRONT_DESK, (context) =>
  respond(context, async (service) => {
    const memberId = idParam(context, 'memberId', 'member');
    const input = await parseBody(context, updateMemberSchema);
    return { member: await updateMember(service, memberId, input) };
  }),
);

routes.get('/:memberId/plans', STAFF, (context) =>
  respond(context, async (service) => ({
    plans: await listMemberPlans(service, idParam(context, 'memberId', 'member')),
  })),
);

routes.post('/:memberId/plans', FRONT_DESK, (context) =>
  respond(
    context,
    async (service) => {
      const memberId = idParam(context, 'memberId', 'member');
      const input = await parseBody(context, assignMemberPlanSchema, { memberId });
      return { memberPlan: await assignMemberPlan(service, input) };
    },
    201,
  ),
);

routes.get('/:memberId/records', STAFF, (context) =>
  respond(context, async (service) => ({
    records: await listPersonalRecords(service, idParam(context, 'memberId', 'member')),
  })),
);

export const memberRoutes = routes.router;
