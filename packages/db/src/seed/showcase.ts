import { asc, eq, gte, inArray } from 'drizzle-orm';
import {
  boxUsers,
  bookings,
  classes,
  memberPlans,
  members,
  movements,
  personalRecords,
  plans,
  programs,
  resultFistBumps,
  users,
  workoutComponents,
  workoutResults,
  workouts,
} from '../schema';
import {
  withBoxScope,
  withSystemScope,
  type SchemaDatabase,
  type ScopedTransaction,
} from '../scope';
import { localDate } from './calendar';

/**
 * Extra demo data so every screen looks like a real box: two dozen members on
 * different plans, busy classes, a full whiteboard and a member account
 * (`alumno@<slug>.local`) with bookings and PRs. Only `pnpm db:seed` runs it;
 * tests keep the small demo box.
 */
const SHOWCASE_MEMBERS = [
  ['Camila', 'Duarte', 'Ilimitado'],
  ['Sebastián', 'Cáceres', 'Ilimitado'],
  ['Valentina', 'Ríos', '3 veces por semana'],
  ['Joaquín', 'Martínez', 'Ilimitado'],
  ['Sofía', 'Aquino', 'Pack 10 clases'],
  ['Nicolás', 'Ferreira', '3 veces por semana'],
  ['Paula', 'Insfrán', 'Ilimitado'],
  ['Tomás', 'Leguizamón', '2 veces por semana'],
  ['Micaela', 'Núñez', 'Ilimitado'],
  ['Gustavo', 'Sanabria', 'Solo Open Box'],
  ['Andrea', 'Báez', '3 veces por semana'],
  ['Hugo', 'Riquelme', 'Ilimitado'],
  ['Florencia', 'Cabrera', 'Pack 10 clases'],
  ['Lautaro', 'Vera', 'Ilimitado'],
  ['Romina', 'Escobar', '2 veces por semana'],
  ['Iván', 'Galeano', 'Ilimitado'],
  ['Natalia', 'Paredes', 'Ilimitado'],
  ['Federico', 'Zárate', '3 veces por semana'],
] as const;

// [time in seconds, scaling] for the metcon whiteboard, in the order members logged it.
const METCON_SCORES: [number, 'rx' | 'scaled'][] = [
  [298, 'rx'],
  [356, 'rx'],
  [412, 'scaled'],
  [331, 'rx'],
  [389, 'scaled'],
  [365, 'rx'],
  [447, 'scaled'],
  [402, 'rx'],
  [276, 'rx'],
];

export async function seedShowcase(
  database: SchemaDatabase,
  demo: { boxId: string; ownerId: string; slug: string },
) {
  const { boxId, ownerId, slug } = demo;
  const memberUserId = await withSystemScope(database, async (transaction) => {
    const [user] = await transaction
      .insert(users)
      .values({ email: `alumno@${slug}.local`, fullName: 'Daniel Rojas' })
      .returning({ id: users.id });
    if (!user) throw new Error('Showcase member user was not created');
    await transaction.insert(boxUsers).values({ boxId, userId: user.id, role: 'member' });
    return user.id;
  });

  await withBoxScope(database, { boxId, userId: ownerId }, async (transaction) => {
    const planByName = new Map(
      (await transaction.select().from(plans)).map((plan) => [plan.name, plan]),
    );
    const planFor = (name: string) => {
      const plan = planByName.get(name);
      if (!plan) throw new Error(`Template plan "${name}" missing`);
      return plan;
    };

    const [daniel] = await transaction
      .insert(members)
      .values({
        boxId,
        userId: memberUserId,
        firstName: 'Daniel',
        lastName: 'Rojas',
        documentNumber: '4789012',
        email: `alumno@${slug}.local`,
        phone: '+595981478901',
        joinedOn: localDate(-240),
      })
      .returning({ id: members.id });
    if (!daniel) throw new Error('Showcase member was not created');

    const created = await transaction
      .insert(members)
      .values(
        SHOWCASE_MEMBERS.map(([firstName, lastName], index) => ({
          boxId,
          firstName,
          lastName,
          documentNumber: String(3_100_000 + index * 73_421),
          phone: `+5959${String(81_200_000 + index * 31_337)}`,
          joinedOn: localDate(-30 - index * 17),
          status: index === 9 || index === 14 ? ('inactive' as const) : ('active' as const),
        })),
      )
      .returning({ id: members.id });

    await transaction.insert(memberPlans).values([
      planRow(boxId, daniel.id, planFor('Ilimitado'), localDate(-12), localDate(18)),
      ...created.map(({ id }, index) => {
        const plan = planFor(SHOWCASE_MEMBERS[index]?.[2] ?? 'Ilimitado');
        const start = localDate(-((index * 5) % 26));
        return planRow(boxId, id, plan, start, localDate(plan.durationDays - ((index * 5) % 26)));
      }),
    ]);

    const everyone = [daniel.id, ...created.map(({ id }) => id)];
    await seedBookings(transaction, boxId, daniel.id, everyone);
    await seedWhiteboard(
      transaction,
      boxId,
      daniel.id,
      created.map(({ id }) => id),
    );
    await seedRecords(transaction, boxId, daniel.id);
    await seedTomorrowDraft(transaction, boxId, ownerId);
  });
}

function planRow(
  boxId: string,
  memberId: string,
  plan: { id: string; priceGs: number; classCount: number | null; classesPerWeek: number | null },
  startsOn: string,
  endsOn: string,
) {
  return {
    boxId,
    memberId,
    planId: plan.id,
    startsOn,
    endsOn,
    priceGs: plan.priceGs,
    classesPerWeek: plan.classesPerWeek,
    classesRemaining: plan.classCount === null ? null : Math.max(plan.classCount - 3, 1),
  };
}

/** Busy evenings, quieter mornings, one full class with a waitlist. */
async function seedBookings(
  transaction: ScopedTransaction,
  boxId: string,
  danielId: string,
  memberIds: string[],
) {
  const upcoming = await transaction
    .select()
    .from(classes)
    .where(gte(classes.startsAt, new Date()))
    .orderBy(asc(classes.startsAt));
  const existing = await transaction.select().from(bookings);
  const rows: (typeof bookings.$inferInsert)[] = [];
  // A later small class gets filled up, so the waitlist shows somewhere.
  const full = upcoming.filter((classRow) => classRow.capacity <= memberIds.length - 3)[2];
  upcoming.forEach((classRow, classIndex) => {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Asuncion',
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(classRow.startsAt),
    );
    const isEvening = hour >= 18;
    const target = Math.min(
      classIndex === 1
        ? classRow.capacity + 2
        : isEvening
          ? 10 + (classIndex % 6)
          : 3 + (classIndex % 5),
      memberIds.length,
    );
    const taken = new Set(
      existing.filter((booking) => booking.classId === classRow.id).map((b) => b.memberId),
    );
    let spots = taken.size;
    let waitlistPosition = 1;
    for (const memberId of memberIds.slice(1)) {
      if (rows.filter((row) => row.classId === classRow.id).length + taken.size >= target) break;
      if (taken.has(memberId)) continue;
      const waiting = spots >= classRow.capacity;
      rows.push({
        boxId,
        classId: classRow.id,
        memberId,
        status: waiting ? 'waitlisted' : 'booked',
        waitlistPosition: waiting ? waitlistPosition++ : null,
      });
      if (!waiting) spots += 1;
    }
  });
  // Daniel: the next class, an evening one later on, and the waitlist of the full one.
  const evening = upcoming.filter((classRow) => {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Asuncion',
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(classRow.startsAt),
    );
    return hour === 19;
  });
  for (const classRow of [upcoming[0], evening[2]]) {
    if (classRow) rows.push({ boxId, classId: classRow.id, memberId: danielId, status: 'booked' });
  }
  if (full && full.id !== upcoming[0]?.id) {
    const waiting = rows.filter((row) => row.classId === full.id && row.status === 'waitlisted');
    rows.push({
      boxId,
      classId: full.id,
      memberId: danielId,
      status: 'waitlisted',
      waitlistPosition: waiting.length + 1,
    });
  }
  if (rows.length > 0) await transaction.insert(bookings).values(rows);
}

async function seedWhiteboard(
  transaction: ScopedTransaction,
  boxId: string,
  danielId: string,
  memberIds: string[],
) {
  const [today] = await transaction
    .select()
    .from(workouts)
    .where(eq(workouts.workoutDate, localDate()));
  if (!today) return;
  await transaction
    .update(workouts)
    .set({
      title: 'Asunción Heat',
      coachNotes: 'Thrusters a ritmo constante. Si las dominadas se cortan, sets de 3.',
    })
    .where(eq(workouts.id, today.id));
  const components = await transaction
    .select()
    .from(workoutComponents)
    .where(eq(workoutComponents.workoutId, today.id))
    .orderBy(asc(workoutComponents.position));
  const [strength, metcon] = components;
  if (!strength || !metcon) return;
  await transaction
    .update(workoutComponents)
    .set({
      title: 'Back Squat',
      description:
        '5 series de 5 reps, subiendo hasta un 5RM pesado.\nDescanso 2 min entre series.',
    })
    .where(eq(workoutComponents.id, strength.id));
  await transaction
    .update(workoutComponents)
    .set({
      title: 'Asunción Heat',
      description:
        '21-15-9\nThrusters 43/30 kg\nPull-ups\n\nCierre: 400 m run\n\nEscalado: thrusters 30/20 kg y ring rows.',
      timeCapSeconds: 900,
    })
    .where(eq(workoutComponents.id, metcon.id));

  const scored = memberIds.slice(0, METCON_SCORES.length);
  const results = await transaction
    .insert(workoutResults)
    .values(
      scored.map((memberId, index) => {
        const [timeSeconds, scaling] = METCON_SCORES[index] ?? [600, 'scaled'];
        return { boxId, componentId: metcon.id, memberId, scaling, timeSeconds };
      }),
    )
    .returning({ id: workoutResults.id, memberId: workoutResults.memberId });
  const bumps = results.flatMap((result, index) =>
    [...memberIds, danielId]
      .filter((memberId) => memberId !== result.memberId)
      .slice(0, (index * 3) % 7)
      .map((memberId) => ({ boxId, resultId: result.id, memberId })),
  );
  if (bumps.length > 0) await transaction.insert(resultFistBumps).values(bumps);
  await transaction.insert(workoutResults).values(
    memberIds.slice(0, 6).map((memberId, index) => ({
      boxId,
      componentId: strength.id,
      memberId,
      scaling: 'rx' as const,
      loadGrams: 60_000 + index * 12_500,
    })),
  );
}

async function seedRecords(transaction: ScopedTransaction, boxId: string, danielId: string) {
  const library = await transaction
    .select()
    .from(movements)
    .where(inArray(movements.name, ['Back Squat', 'Deadlift', 'Clean', 'Snatch', 'Strict Press']));
  const idOf = (name: string) => library.find((movement) => movement.name === name)?.id;
  const records = [
    ['Back Squat', 1, 125_000, -3],
    ['Deadlift', 1, 160_000, -9],
    ['Clean', 1, 92_500, -16],
    ['Snatch', 1, 70_000, -41],
    ['Strict Press', 3, 52_500, -64],
  ] as const;
  await transaction.insert(personalRecords).values(
    records.flatMap(([name, repMax, loadGrams, daysAgo]) => {
      const movementId = idOf(name);
      return movementId
        ? [
            {
              boxId,
              memberId: danielId,
              movementId,
              repMax,
              loadGrams,
              achievedOn: localDate(daysAgo),
            },
          ]
        : [];
    }),
  );
}

/** Tomorrow's CrossFit WOD saved as a draft, so the panel shows both states. */
async function seedTomorrowDraft(transaction: ScopedTransaction, boxId: string, ownerId: string) {
  const [crossfit] = await transaction.select().from(programs).where(eq(programs.name, 'CrossFit'));
  if (!crossfit) return;
  const [draft] = await transaction
    .insert(workouts)
    .values({
      boxId,
      programId: crossfit.id,
      workoutDate: localDate(1),
      title: 'Chipper del sábado',
      createdByUserId: ownerId,
    })
    .returning({ id: workouts.id });
  if (!draft) return;
  await transaction.insert(workoutComponents).values([
    {
      boxId,
      workoutId: draft.id,
      position: 0,
      kind: 'warm_up',
      description: '3 rondas\n200 m run\n10 air squats\n10 PVC pass-through',
    },
    {
      boxId,
      workoutId: draft.id,
      position: 1,
      kind: 'metcon',
      title: 'Chipper',
      description:
        '50 wall balls\n40 box jumps\n30 kettlebell swings 24/16 kg\n20 burpees\n10 muscle-ups',
      scoreType: 'time',
      timerType: 'for_time',
      timeCapSeconds: 1500,
    },
  ]);
}
