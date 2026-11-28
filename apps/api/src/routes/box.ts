import { boxes } from '@guaranix/db/schema';
import { BOX_ROLES } from '@guaranix/shared';
import { eq } from 'drizzle-orm';
import { createBoxRouter } from '../middleware/box-scope';
import { checkInModesOf } from '../services/box-settings';

const box = createBoxRouter();

box.get('/current', BOX_ROLES, async (context) => {
  const [profile] = await context.var.transaction
    .select({
      id: boxes.id,
      name: boxes.name,
      slug: boxes.slug,
      city: boxes.city,
      timezone: boxes.timezone,
      checkInDeskEnabled: boxes.checkInDeskEnabled,
      checkInCoachEnabled: boxes.checkInCoachEnabled,
      checkInWallQrEnabled: boxes.checkInWallQrEnabled,
      checkInStaffEnabled: boxes.checkInStaffEnabled,
    })
    .from(boxes)
    .where(eq(boxes.id, context.var.auth.boxId));
  if (!profile) return context.json({ box: null, role: context.var.auth.role });
  const {
    checkInDeskEnabled,
    checkInCoachEnabled,
    checkInWallQrEnabled,
    checkInStaffEnabled,
    ...rest
  } = profile;
  const box = {
    ...rest,
    checkInModes: checkInModesOf({
      checkInDeskEnabled,
      checkInCoachEnabled,
      checkInWallQrEnabled,
      checkInStaffEnabled,
    }),
  };
  return context.json({ box, role: context.var.auth.role });
});

export const boxRoutes = box.router;
