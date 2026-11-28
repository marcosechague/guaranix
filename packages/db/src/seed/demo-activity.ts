import { eq } from 'drizzle-orm';
import {
  auditLogs,
  bookings,
  charges,
  classes,
  dataImports,
  memberPlans,
  movements,
  payments,
  personalRecords,
  planPauses,
  resultFistBumps,
  workoutComponents,
  workoutResults,
  workouts,
} from '../schema';
import type { ScopedTransaction } from '../scope';
import { localDate } from './calendar';

/** Bookings, a pause, a WOD with results and PRs, charges, a payment, an audit entry and an import. */
export async function seedActivity(
  transaction: ScopedTransaction,
  context: { boxId: string; ownerId: string; coachId: string; memberIds: string[] },
) {
  const { boxId, ownerId, coachId, memberIds } = context;
  const [firstMember, secondMember] = memberIds;
  const [firstClass] = await transaction.select().from(classes).orderBy(classes.startsAt).limit(1);
  const [firstPlan] = await transaction.select().from(memberPlans).limit(1);
  const [backSquat] = await transaction
    .select()
    .from(movements)
    .where(eq(movements.name, 'Back Squat'));
  if (!firstMember || !secondMember || !firstClass || !firstPlan || !backSquat) {
    throw new Error('Demo activity is missing its base rows');
  }

  await transaction.insert(bookings).values(
    memberIds.map((memberId) => ({
      boxId,
      classId: firstClass.id,
      memberId,
      status: 'booked' as const,
    })),
  );
  await transaction.insert(planPauses).values({
    boxId,
    memberPlanId: firstPlan.id,
    startsOn: localDate(30),
    endsOn: localDate(37),
    reason: 'Viaje',
    createdByUserId: ownerId,
  });

  const [workout] = await transaction
    .insert(workouts)
    .values({
      boxId,
      programId: firstClass.programId,
      workoutDate: localDate(),
      title: 'Fran',
      publishedAt: new Date(),
      createdByUserId: coachId,
    })
    .returning({ id: workouts.id });
  if (!workout) throw new Error('Demo workout was not created');
  const [, metcon] = await transaction
    .insert(workoutComponents)
    .values([
      {
        boxId,
        workoutId: workout.id,
        position: 0,
        kind: 'strength',
        description: 'Back Squat 5-5-5-5-5',
        scoreType: 'load',
        movementId: backSquat.id,
      },
      {
        boxId,
        workoutId: workout.id,
        position: 1,
        kind: 'metcon',
        description: '21-15-9 Thrusters 43/29 kg, Pull-ups',
        scoreType: 'time',
        timerType: 'for_time',
        timeCapSeconds: 600,
      },
    ])
    .returning({ id: workoutComponents.id });
  if (!metcon) throw new Error('Demo metcon was not created');
  const [result] = await transaction
    .insert(workoutResults)
    .values({
      boxId,
      componentId: metcon.id,
      memberId: firstMember,
      scaling: 'rx',
      timeSeconds: 342,
    })
    .returning({ id: workoutResults.id });
  if (!result) throw new Error('Demo result was not created');
  await transaction
    .insert(resultFistBumps)
    .values({ boxId, resultId: result.id, memberId: secondMember });
  await transaction.insert(personalRecords).values({
    boxId,
    memberId: firstMember,
    movementId: backSquat.id,
    repMax: 1,
    loadGrams: 120_000,
    achievedOn: localDate(),
  });

  const [charge] = await transaction
    .insert(charges)
    .values(
      memberIds.map((memberId) => ({
        boxId,
        memberId,
        memberPlanId: firstPlan.memberId === memberId ? firstPlan.id : null,
        description: 'Cuota mensual',
        amountGs: firstPlan.priceGs,
        dueOn: localDate(-5),
      })),
    )
    .returning({ id: charges.id, memberId: charges.memberId });
  if (!charge) throw new Error('Demo charge was not created');
  const [payment] = await transaction
    .insert(payments)
    .values({
      boxId,
      memberId: charge.memberId,
      chargeId: charge.id,
      amountGs: firstPlan.priceGs,
      method: 'cash',
      status: 'confirmed',
      paidAt: new Date(),
      reviewedAt: new Date(),
      recordedByUserId: ownerId,
      reviewedByUserId: ownerId,
    })
    .returning({ id: payments.id });
  await transaction.insert(auditLogs).values({
    boxId,
    actorUserId: ownerId,
    action: 'payment.recorded',
    entityType: 'payment',
    entityId: payment?.id ?? null,
    changes: { amountGs: firstPlan.priceGs, method: 'cash' },
  });
  // An empty spreadsheet import, so the box's history isn't blank.
  await transaction.insert(dataImports).values({
    boxId,
    createdByUserId: ownerId,
    fileName: 'alumnos.xlsx',
    source: 'spreadsheet',
    payloadHash: `demo-${boxId}`,
    summary: {
      rows: 0,
      invalidRows: 0,
      membersCreated: 0,
      membersMatched: 0,
      plansCreated: 0,
      memberPlansCreated: 0,
      chargesCreated: 0,
      balanceGs: 0,
    },
  });
}
