import { brodiMessages, brodiWeeklySummaries } from '@guaranix/db/schema';
import type {
  BrodiMessage,
  BrodiMessageRole,
  BrodiUsage,
  BrodiWeeklyFigures,
  BrodiWeeklySummary,
} from '@guaranix/shared';
import { desc, eq } from 'drizzle-orm';
import type { ServiceContext } from '../context';
import { boxFeatureState } from '../feature-access';

/** What the screen shows; older lines stay stored but are not loaded. */
export const VISIBLE_MESSAGES = 40;

type MessageRow = typeof brodiMessages.$inferSelect;

export const toBrodiMessage = (row: MessageRow): BrodiMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  createdAt: row.createdAt.toISOString(),
});

/** The asker's own latest lines, oldest first. Other staff of the box never see them. */
export async function ownMessages(context: ServiceContext, limit: number): Promise<MessageRow[]> {
  const rows = await context.transaction
    .select()
    .from(brodiMessages)
    .where(eq(brodiMessages.userId, context.auth.userId))
    .orderBy(desc(brodiMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function saveExchange(
  context: ServiceContext,
  lines: { role: BrodiMessageRole; content: string }[],
): Promise<MessageRow[]> {
  // The answer is stored a millisecond after the question so the order survives equal clocks.
  const values = lines.map((line, index) => ({
    boxId: context.auth.boxId,
    userId: context.auth.userId,
    role: line.role,
    content: line.content,
    createdAt: new Date(context.now.getTime() + index),
  }));
  return context.transaction.insert(brodiMessages).values(values).returning();
}

export async function brodiUsage(context: ServiceContext): Promise<BrodiUsage> {
  const state = await boxFeatureState(
    context.transaction,
    context.auth.boxId,
    'brodi',
    context.now,
  );
  return { ...state.effective, usedThisMonth: state.usedThisMonth };
}

export async function latestWeeklySummary(
  context: ServiceContext,
): Promise<BrodiWeeklySummary | null> {
  const [row] = await context.transaction
    .select()
    .from(brodiWeeklySummaries)
    .where(eq(brodiWeeklySummaries.boxId, context.auth.boxId))
    .orderBy(desc(brodiWeeklySummaries.weekStart))
    .limit(1);
  if (!row) return null;
  return {
    weekStart: row.weekStart,
    source: row.source,
    summary: row.summary,
    figures: row.figures as BrodiWeeklyFigures,
    createdAt: row.createdAt.toISOString(),
  };
}
