import { eq } from 'drizzle-orm';
import { auditLogs } from '@guaranix/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { createMember, getMember, getOwnMember, listMembers, updateMember } from './members';

let fixture: ServiceFixture;

beforeAll(async () => {
  fixture = await createServiceFixture();
});

afterAll(async () => {
  await fixture.close();
});

describe('members', () => {
  it('creates a member and audits it', async () => {
    const member = await fixture.as(fixture.boxA, 'reception', (context) =>
      createMember(context, { firstName: 'Ana', lastName: 'Duarte', documentNumber: '7123456' }),
    );
    expect(member.boxId).toBe(fixture.boxA.boxId);
    const [entry] = await fixture.system((transaction) =>
      transaction.select().from(auditLogs).where(eq(auditLogs.entityId, member.id)),
    );
    expect(entry).toMatchObject({
      action: 'member.created',
      actorUserId: fixture.boxA.userIds.reception,
    });
  });

  it('rejects a repeated document number in the same box, but not in another box', async () => {
    await expectServiceError(
      fixture.as(fixture.boxA, 'reception', (context) =>
        createMember(context, { firstName: 'Otra', lastName: 'Ana', documentNumber: '7123456' }),
      ),
      'member_document_taken',
    );
    const elsewhere = await fixture.as(fixture.boxB, 'reception', (context) =>
      createMember(context, { firstName: 'Ana', lastName: 'Duarte', documentNumber: '7123456' }),
    );
    expect(elsewhere.boxId).toBe(fixture.boxB.boxId);
  });

  it('searches by name, full name and document', async () => {
    const search = (text: string) =>
      fixture.as(fixture.boxA, 'coach', (context) =>
        listMembers(context, { search: text, limit: 50, offset: 0 }),
      );
    expect((await search('duar')).map((member) => member.lastName)).toEqual(['Duarte']);
    expect(await search('Ana Duarte')).toHaveLength(1);
    expect(await search('7123456')).toHaveLength(1);
    // LIKE wildcards are searched literally.
    expect(await search('%')).toHaveLength(0);
  });

  it('never lists or opens members of another box', async () => {
    const listed = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      listMembers(context, { limit: 500, offset: 0 }),
    );
    expect(listed.every((member) => member.boxId === fixture.boxA.boxId)).toBe(true);
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) => getMember(context, fixture.boxB.memberId)),
      'member_not_found',
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'box_owner', (context) =>
        updateMember(context, fixture.boxB.memberId, { notes: 'hack' }),
      ),
      'member_not_found',
    );
  });

  it('lets a member see only their own profile', async () => {
    const own = await fixture.as(fixture.boxA, 'member', (context) => getOwnMember(context));
    expect(own.id).toBe(fixture.boxA.memberId);
    const [someoneElse] = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      listMembers(context, { search: 'Duarte', limit: 1, offset: 0 }),
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'member', (context) => getMember(context, someoneElse?.id ?? '')),
      'member_not_found',
    );
  });

  it('does not let members create or edit members', async () => {
    await expectServiceError(
      fixture.as(fixture.boxA, 'member', (context) =>
        createMember(context, { firstName: 'X', lastName: 'Y' }),
      ),
      'forbidden',
    );
    await expectServiceError(
      fixture.as(fixture.boxA, 'member', (context) =>
        updateMember(context, fixture.boxA.memberId, { status: 'inactive' }),
      ),
      'forbidden',
    );
  });

  it('audits only changed fields and hides medical notes', async () => {
    await fixture.as(fixture.boxA, 'reception', (context) =>
      updateMember(context, fixture.boxA.memberId, {
        firstName: 'Alumna',
        phone: '+595981000111',
        medicalNotes: 'Asma',
      }),
    );
    const [entry] = await fixture.system((transaction) =>
      transaction.select().from(auditLogs).where(eq(auditLogs.entityId, fixture.boxA.memberId)),
    );
    expect(entry?.changes).toEqual({
      phone: { from: null, to: '+595981000111' },
      medicalNotes: { from: '[redacted]', to: '[redacted]' },
    });
  });
});
