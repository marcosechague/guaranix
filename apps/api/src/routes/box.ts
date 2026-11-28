import { boxes } from '@guaranix/db/schema';
import { BOX_ROLES } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { createBoxRouter } from '../middleware/box-scope';

const box = createBoxRouter();

box.get('/current', BOX_ROLES, async (context) => {
  const [profile] = await context.var.transaction
    .select({
      id: boxes.id,
      name: boxes.name,
      slug: boxes.slug,
      city: boxes.city,
      timezone: boxes.timezone,
    })
    .from(boxes)
    .where(eq(boxes.id, context.var.auth.boxId));
  return context.json({ box: profile ?? null, role: context.var.auth.role });
});

export const boxRoutes = box.router;
