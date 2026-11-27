import { boxes } from '@guaranix/db/schema';
import { calendarDateIn } from '@guaranix/shared';
import { notFound } from './errors';
import type { ServiceContext } from './context';

/** The box row visible in this scope (RLS only shows the box itself). */
export async function currentBox(context: ServiceContext) {
  const [box] = await context.transaction.select().from(boxes).limit(1);
  if (!box) throw notFound('box');
  return box;
}

/** Today's date where the box is, which is what plan dates are compared against. */
export async function boxToday(context: ServiceContext): Promise<string> {
  const box = await currentBox(context);
  return calendarDateIn(box.timezone, context.now);
}
