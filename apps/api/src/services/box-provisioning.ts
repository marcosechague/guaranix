import { applyBoxTemplate, type ScopedTransaction } from '@guaranix/db';
import { boxUsers, boxes } from '@guaranix/db/schema';
import { type BusinessType, calendarDateIn, slugFromName } from '@guaranix/shared';
import { like } from 'drizzle-orm';

export const DEFAULT_TIMEZONE = 'America/Asuncion';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProvisionBoxInput {
  name: string;
  slug?: string | undefined;
  city: string | null;
  businessType: BusinessType;
  platformPlanId: string;
  ownerUserId: string;
  trialDays: number;
  applyTemplate: boolean;
}

/** The requested slug if free, otherwise the name's slug with the first free `-2`, `-3`… */
async function freeSlug(transaction: ScopedTransaction, base: string): Promise<string> {
  const taken = new Set(
    (
      await transaction
        .select({ slug: boxes.slug })
        .from(boxes)
        .where(like(boxes.slug, `${base}%`))
    ).map((row) => row.slug),
  );
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base.slice(0, 44)}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Creates a box in trial with its owner and, optionally, the Paraguayan
 * template, in the caller's transaction. Runs unscoped: the box does not
 * exist yet, so there is no `box_id` to scope to. Callers authorize and audit.
 */
export async function provisionBox(
  transaction: ScopedTransaction,
  input: ProvisionBoxInput,
  now: Date,
) {
  const slug = await freeSlug(transaction, input.slug ?? slugFromName(input.name));
  const [box] = await transaction
    .insert(boxes)
    .values({
      name: input.name,
      slug,
      city: input.city,
      businessType: input.businessType,
      platformPlanId: input.platformPlanId,
      status: 'trial',
      statusChangedAt: now,
      trialEndsAt: new Date(now.getTime() + input.trialDays * DAY_MS),
    })
    .returning();
  if (!box) throw new Error('Box insert returned no row');
  await transaction
    .insert(boxUsers)
    .values({ boxId: box.id, userId: input.ownerUserId, role: 'box_owner' });
  if (input.applyTemplate) {
    await applyBoxTemplate(transaction, box.id, {
      validFrom: calendarDateIn(DEFAULT_TIMEZONE, now),
    });
  }
  return box;
}
