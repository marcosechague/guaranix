import { eq } from 'drizzle-orm';
import { auditLogs, charges, memberPlans, members, plans } from '@guaranix/db/schema';
import { addDays, calendarDateIn, type DataImportInput } from '@guaranix/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { listDebtors } from './charges';
import { commitImport, getImport, listImports, previewImport } from './data-imports';

let fixture: ServiceFixture;
const today = calendarDateIn('America/Asuncion', new Date());
const iso = (days: number) => addDays(today, days);
// Day-first, the way a Paraguayan spreadsheet writes it.
const local = (days: number) => iso(days).split('-').reverse().join('/');

beforeAll(async () => {
  fixture = await createServiceFixture();
});

afterAll(async () => {
  await fixture.close();
});

function importOf(members: DataImportInput['members'], extra: Partial<DataImportInput> = {}) {
  return {
    fileName: 'alumnos.xlsx',
    source: 'spreadsheet',
    balanceDescription: 'Saldo anterior',
    plans: [],
    skipInvalidRows: false,
    members,
    ...extra,
  } satisfies DataImportInput;
}

const sheetPlans: DataImportInput['plans'] = [
  {
    name: 'Pack 12 Open',
    kind: 'Pack de clases',
    priceGs: '400.000',
    durationDays: '60',
    classCount: '12',
  },
];

const firstFile = importOf(
  [
    {
      firstName: 'Ana',
      lastName: 'Duarte',
      documentNumber: '7.700.001',
      phone: '0981 700 001',
      planName: 'Pack 12 Open',
      planEndsOn: local(30),
      classesRemaining: '5',
      balanceGs: '₲ 150.000',
      balanceDueOn: local(-3),
    },
    {
      fullName: 'Luis Benítez',
      email: 'luis@mail.com',
      planName: 'ilimitado',
      planStartsOn: local(-5),
    },
    // Already in the box (demo seed) with a live unlimited plan.
    {
      firstName: 'Rodrigo',
      lastName: 'Benítez',
      documentNumber: '4123456',
      planName: 'Ilimitado',
      planStartsOn: local(-2),
      balanceGs: '90000',
    },
  ],
  { plans: sheetPlans },
);

const rowsOfBox = <T>(
  boxId: string,
  table: typeof members | typeof memberPlans | typeof charges | typeof plans,
) =>
  fixture.system((transaction) =>
    transaction.select().from(table).where(eq(table.boxId, boxId)),
  ) as Promise<T[]>;

describe('data imports', () => {
  it('previews row by row without writing anything', async () => {
    const before = (await rowsOfBox(fixture.boxA.boxId, members)).length;
    const analysis = await fixture.as(fixture.boxA, 'box_admin', (context) =>
      previewImport(context, firstFile),
    );
    expect(analysis.rows.map((row) => row.status)).toEqual(['new', 'new', 'existing']);
    expect(analysis.rows[0]?.plan).toEqual({
      planName: 'Pack 12 Open',
      startsOn: iso(-29),
      endsOn: iso(30),
      classesRemaining: 5,
    });
    expect(analysis.rows[1]?.plan).toMatchObject({
      startsOn: iso(-5),
      endsOn: iso(24),
      classesRemaining: null,
    });
    expect(analysis.rows[2]?.warnings.map((issue) => issue.code)).toEqual([
      'member_exists',
      'plan_already_present',
    ]);
    expect(analysis.plans).toMatchObject([{ status: 'new', name: 'Pack 12 Open' }]);
    expect(analysis.summary).toEqual({
      rows: 3,
      invalidRows: 0,
      membersCreated: 2,
      membersMatched: 1,
      plansCreated: 1,
      memberPlansCreated: 2,
      chargesCreated: 2,
      balanceGs: 240_000,
    });
    expect((await rowsOfBox(fixture.boxA.boxId, members)).length).toBe(before);
  });

  it('commits members, plans, credits and balances, and audits it', async () => {
    const result = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      commitImport(context, firstFile),
    );
    expect(result.replayed).toBe(false);
    const importId = result.import.id;

    const created = (
      await rowsOfBox<typeof members.$inferSelect>(fixture.boxA.boxId, members)
    ).filter((member) => member.importId === importId);
    created.sort((first, second) => first.firstName.localeCompare(second.firstName));
    expect(
      created.map((member) => [
        member.firstName,
        member.documentNumber,
        member.phone,
        member.joinedOn,
      ]),
    ).toEqual([
      ['Ana', '7700001', '+595981700001', today],
      ['Luis', null, null, today],
    ]);

    const [pack] = (await rowsOfBox<typeof plans.$inferSelect>(fixture.boxA.boxId, plans)).filter(
      (plan) => plan.importId === importId,
    );
    expect(pack).toMatchObject({
      name: 'Pack 12 Open',
      kind: 'class_pack',
      priceGs: 400_000,
      classCount: 12,
    });

    const importedPlans = (
      await rowsOfBox<typeof memberPlans.$inferSelect>(fixture.boxA.boxId, memberPlans)
    ).filter((plan) => plan.importId === importId);
    expect(importedPlans).toHaveLength(2);
    expect(importedPlans.find((plan) => plan.planId === pack?.id)).toMatchObject({
      endsOn: iso(30),
      classesRemaining: 5,
      priceGs: 400_000,
    });

    // Only balances become charges: migrated plans were paid in the old system.
    const importedCharges = (
      await rowsOfBox<typeof charges.$inferSelect>(fixture.boxA.boxId, charges)
    ).filter((charge) => charge.importId === importId);
    expect(
      importedCharges
        .map((charge) => [charge.amountGs, charge.memberPlanId, charge.description])
        .sort(),
    ).toEqual([
      [150_000, null, 'Saldo anterior'],
      [90_000, null, 'Saldo anterior'],
    ]);

    const debtors = await fixture.as(fixture.boxA, 'reception', (context) => listDebtors(context));
    expect(debtors.find((debtor) => debtor.lastName === 'Duarte')).toMatchObject({
      owedGs: 150_000,
      daysOverdue: 3,
    });

    const [entry] = await fixture.system((transaction) =>
      transaction.select().from(auditLogs).where(eq(auditLogs.entityId, importId)),
    );
    expect(entry).toMatchObject({
      action: 'data_import.committed',
      actorUserId: fixture.boxA.userIds.box_owner,
      changes: expect.objectContaining({
        membersCreated: 2,
        chargesCreated: 2,
        balanceGs: 240_000,
      }),
    });
  });

  it('returns the first import when the same rows are sent again', async () => {
    const before = await rowsOfBox(fixture.boxA.boxId, charges);
    const again = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      commitImport(context, firstFile),
    );
    expect(again.replayed).toBe(true);
    expect(await rowsOfBox(fixture.boxA.boxId, charges)).toHaveLength(before.length);
  });

  it('matches members already imported when a corrected file is sent', async () => {
    const corrected = importOf(
      [
        ...firstFile.members,
        { firstName: 'Sofía', lastName: 'Cáceres', documentNumber: '7700003' },
      ],
      {
        plans: sheetPlans,
      },
    );
    const preview = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      previewImport(context, corrected),
    );
    expect(preview.rows.map((row) => row.status)).toEqual([
      'existing',
      'existing',
      'existing',
      'new',
    ]);
    expect(preview.rows[0]?.warnings.map((issue) => issue.code)).toEqual([
      'member_exists',
      'plan_already_present',
      'balance_already_imported',
    ]);
    expect(preview.plans[0]?.status).toBe('existing');
    const result = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      commitImport(context, corrected),
    );
    expect(result.analysis?.summary).toMatchObject({
      membersCreated: 1,
      memberPlansCreated: 0,
      chargesCreated: 0,
      plansCreated: 0,
    });
  });

  it('reports every problem and blocks the commit unless invalid rows are skipped', async () => {
    const messy = importOf([
      {
        firstName: 'Pedro',
        lastName: 'Sosa',
        documentNumber: '7700010',
        planName: 'Plan Fantasma',
        planStartsOn: local(0),
      },
      { firstName: 'Pedro', lastName: 'Sosa', documentNumber: '7700010' },
      {
        firstName: 'Clara',
        lastName: 'Ríos',
        documentNumber: '7700011',
        planName: 'Pack 12 Open',
        planStartsOn: local(0),
        classesRemaining: '13',
      },
      {
        firstName: 'Mara',
        lastName: 'Paz',
        documentNumber: '7700012',
        planName: 'Ilimitado',
        planStartsOn: local(0),
        classesRemaining: '4',
      },
      {
        firstName: 'Rodrigo',
        lastName: 'Benítez',
        email: 'rodrigo@mail.com',
        documentNumber: '9999999',
        externalRef: 'x',
      },
      {
        firstName: 'Nora',
        lastName: 'Vera',
        documentNumber: '7700013',
        planName: 'Pack 12 Open',
        planStartsOn: local(-90),
      },
    ]);
    const preview = await fixture.as(fixture.boxA, 'box_admin', (context) =>
      previewImport(context, messy),
    );
    expect(
      preview.rows.map((row) => [row.status, ...row.errors.map((issue) => issue.code)]),
    ).toEqual([
      ['invalid', 'plan_not_found'],
      ['invalid', 'duplicate_in_file'],
      ['invalid', 'credits_exceed_plan'],
      ['invalid', 'credits_not_allowed'],
      ['new'],
      ['new'],
    ]);
    expect(preview.rows[5]?.warnings.map((issue) => issue.code)).toEqual([
      'credits_defaulted',
      'plan_expired',
    ]);
    expect(preview.rows[5]?.plan?.classesRemaining).toBe(12);

    await expectServiceError(
      fixture.as(fixture.boxA, 'box_admin', (context) => commitImport(context, messy)),
      'import_has_errors',
    );
    const partial = await fixture.as(fixture.boxA, 'box_admin', (context) =>
      commitImport(context, { ...messy, skipInvalidRows: true }),
    );
    expect(partial.analysis?.summary).toMatchObject({ rows: 6, invalidRows: 4, membersCreated: 2 });
  });

  it('flags a cédula that contradicts the member it matched', async () => {
    const preview = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      previewImport(
        context,
        importOf([
          { firstName: 'Ana', lastName: 'Duarte', phone: '0981700001', documentNumber: '1234567' },
        ]),
      ),
    );
    expect(preview.rows[0]?.errors).toEqual([
      { field: 'documentNumber', code: 'identity_mismatch' },
    ]);
  });

  it('is only for owners and admins', async () => {
    for (const role of ['reception', 'coach', 'member'] as const) {
      await expectServiceError(
        fixture.as(fixture.boxA, role, (context) => previewImport(context, firstFile)),
        'forbidden',
      );
      await expectServiceError(
        fixture.as(fixture.boxA, role, (context) => commitImport(context, firstFile)),
        'forbidden',
      );
      await expectServiceError(
        fixture.as(fixture.boxA, role, (context) => listImports(context)),
        'forbidden',
      );
    }
  });

  it("never matches, reuses or shows another box's data", async () => {
    // Same file in box B: its cédulas and plan names belong to box A.
    const preview = await fixture.as(fixture.boxB, 'box_owner', (context) =>
      previewImport(
        context,
        importOf([
          {
            firstName: 'Ana',
            lastName: 'Duarte',
            documentNumber: '7700001',
            planName: 'Pack 12 Open',
            planStartsOn: local(0),
          },
        ]),
      ),
    );
    expect(preview.rows[0]).toMatchObject({ status: 'invalid', existingMemberId: null });
    expect(preview.rows[0]?.errors).toEqual([{ field: 'planName', code: 'plan_not_found' }]);

    const result = await fixture.as(fixture.boxB, 'box_owner', (context) =>
      commitImport(
        context,
        importOf([
          { firstName: 'Ana', lastName: 'Duarte', documentNumber: '7700001', balanceGs: '10000' },
        ]),
      ),
    );
    expect(result.analysis?.summary).toMatchObject({ membersCreated: 1, chargesCreated: 1 });

    const listedInB = await fixture.as(fixture.boxB, 'box_owner', (context) =>
      listImports(context),
    );
    expect(listedInB.some((record) => record.id === result.import.id)).toBe(true);
    const listedInA = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      listImports(context),
    );
    expect(listedInA.some((record) => record.id === result.import.id)).toBe(false);
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) => getImport(context, result.import.id)),
      'data_import_not_found',
    );
  });
});
