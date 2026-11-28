import { withSystemScope } from '@guaranix/db';
import { auditLogs, boxUsers, users } from '@guaranix/db/schema';
import type { OwnerAccessLink, PlatformBoxSummary } from '@guaranix/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createBrowser,
  createHarness,
  type Harness,
  signedUpBrowser,
  uniqueEmail,
} from './harness';

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

afterAll(async () => {
  await harness.close();
});

async function platformAdmin() {
  const signed = await signedUpBrowser(harness);
  await harness.database
    .update(users)
    .set({ isPlatformAdmin: true })
    .where(eq(users.id, signed.session.user.id));
  return signed;
}

async function newBox(admin: Awaited<ReturnType<typeof platformAdmin>>, ownerEmail: string) {
  const response = await admin.browser.post('/platform/boxes', {
    name: 'Box del Dueño',
    platformPlanId: harness.platform.basePlanId,
    ownerEmail,
    ownerName: 'Lucía Benítez',
    applyTemplate: false,
  });
  return ((await response.json()) as { box: PlatformBoxSummary }).box;
}

async function auditActions(boxId: string) {
  const rows = await withSystemScope(harness.database, (transaction) =>
    transaction.select().from(auditLogs).where(eq(auditLogs.boxId, boxId)),
  );
  return rows.map((row) => row.action);
}

async function roleOf(boxId: string, userId: string) {
  const [row] = await withSystemScope(harness.database, (transaction) =>
    transaction
      .select({ role: boxUsers.role })
      .from(boxUsers)
      .where(and(eq(boxUsers.boxId, boxId), eq(boxUsers.userId, userId))),
  );
  return row?.role ?? null;
}

describe('platform box owner', () => {
  it('hands a one-time access link to an owner who never signed in', async () => {
    const admin = await platformAdmin();
    const ownerEmail = uniqueEmail('owner');
    const box = await newBox(admin, ownerEmail);
    expect(box.owner).toMatchObject({ email: ownerEmail, accessPending: true });

    const created = await admin.browser.post(`/platform/boxes/${box.id}/owner-access-link`);
    expect(created.status).toBe(201);
    const link = (await created.json()) as OwnerAccessLink;
    const hours = (Date.parse(link.expiresAt) - Date.now()) / 3_600_000;
    expect(Math.round(hours)).toBe(72);
    const actions = await auditActions(box.id);
    expect(actions).toContain('box.owner_access_link_created');
    expect(JSON.stringify(actions)).not.toContain(link.token);

    const owner = createBrowser(harness);
    const password = 'una clave larga del dueño';
    const reset = await owner.post('/auth/password/reset', { token: link.token, password });
    expect(reset.status).toBe(200);
    expect((await owner.get('/box/current')).status).toBe(200);
    const reused = await createBrowser(harness).post('/auth/password/reset', {
      token: link.token,
      password,
    });
    expect(reused.status).toBe(400);

    const detail = await admin.browser.get(`/platform/boxes/${box.id}`);
    const after = ((await detail.json()) as { box: PlatformBoxSummary }).box;
    expect(after.owner?.accessPending).toBe(false);
    const again = await admin.browser.post(`/platform/boxes/${box.id}/owner-access-link`);
    expect(await again.json()).toEqual({ error: 'box_owner_already_active' });
  });

  it('moves the owner role to another account and logs it', async () => {
    const admin = await platformAdmin();
    const box = await newBox(admin, uniqueEmail('old-owner'));
    const newEmail = uniqueEmail('new-owner');

    const changed = await admin.browser.put(`/platform/boxes/${box.id}/owner`, {
      ownerEmail: newEmail,
      ownerName: 'Diego Ramírez',
    });
    expect(changed.status).toBe(200);
    const { box: after } = (await changed.json()) as { box: PlatformBoxSummary };
    expect(after.owner).toMatchObject({ email: newEmail, fullName: 'Diego Ramírez' });
    expect(await auditActions(box.id)).toContain('box.owner_changed');

    const same = await admin.browser.put(`/platform/boxes/${box.id}/owner`, {
      ownerEmail: newEmail,
      ownerName: 'Diego Ramírez',
    });
    expect(await same.json()).toEqual({ error: 'box_owner_unchanged' });
  });

  it('raises a staff member to owner and takes the role from the old owner', async () => {
    const admin = await platformAdmin();
    const box = await newBox(admin, uniqueEmail('old-owner'));
    const [oldOwner] = await withSystemScope(harness.database, (transaction) =>
      transaction
        .select({ userId: boxUsers.userId })
        .from(boxUsers)
        .where(eq(boxUsers.boxId, box.id)),
    );
    const coach = await signedUpBrowser(harness);
    await harness.database
      .insert(boxUsers)
      .values({ boxId: box.id, userId: coach.session.user.id, role: 'coach' });

    await admin.browser.put(`/platform/boxes/${box.id}/owner`, {
      ownerEmail: coach.email,
      ownerName: 'Coach',
    });
    expect(await roleOf(box.id, coach.session.user.id)).toBe('box_owner');
    expect(await roleOf(box.id, oldOwner?.userId ?? '')).toBeNull();
  });

  it('is only for platform admins', async () => {
    const admin = await platformAdmin();
    const box = await newBox(admin, uniqueEmail('owner'));
    const { browser } = await signedUpBrowser(harness);
    expect((await browser.post(`/platform/boxes/${box.id}/owner-access-link`)).status).toBe(403);
    const takeover = await browser.put(`/platform/boxes/${box.id}/owner`, {
      ownerEmail: uniqueEmail(),
      ownerName: 'Intruso',
    });
    expect(takeover.status).toBe(403);
  });
});
