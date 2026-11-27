import { boxes, members } from '@guaranix/db/schema';
import { BOX_ROLES, type BoxRole } from '@guaranix/shared';
import { count, eq } from 'drizzle-orm';
import { createBoxRouter } from '../middleware/box-scope';

const STAFF_ROLES = ['box_owner', 'box_admin', 'coach', 'reception'] as const satisfies BoxRole[];

const box = createBoxRouter();

box.get('/current', BOX_ROLES, async (context) => {
  const [profile] = await context.var.transaction
    .select({ id: boxes.id, name: boxes.name, slug: boxes.slug, city: boxes.city })
    .from(boxes)
    .where(eq(boxes.id, context.var.auth.boxId));
  return context.json({ box: profile ?? null, role: context.var.auth.role });
});

// Row Level Security already limits the count to the session's box.
box.get('/members/count', STAFF_ROLES, async (context) => {
  const [result] = await context.var.transaction.select({ total: count() }).from(members);
  return context.json({ total: result?.total ?? 0 });
});

export const boxRoutes = box.router;
