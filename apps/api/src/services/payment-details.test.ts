import { and, eq } from 'drizzle-orm';
import { auditLogs } from '@guaranix/db/schema';
import { boxPaymentDetailsSchema, PAYMENT_QR_MAX_BYTES } from '@guaranix/shared/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMemoryFileStorage } from '../integrations/file-storage';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import {
  getPaymentDetails,
  readPaymentQr,
  removePaymentQr,
  storePaymentQr,
  updatePaymentDetails,
} from './payment-details';

let fixture: ServiceFixture;
const files = createMemoryFileStorage();

beforeAll(async () => {
  fixture = await createServiceFixture();
});

afterAll(async () => {
  await fixture.close();
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0]);

const details = boxPaymentDetailsSchema.parse({
  bankName: 'Banco Continental',
  accountNumber: ' 1234567890 ',
  alias: '0981123456',
  holderName: 'Box Ñu Guasú S.A.',
  holderDocument: '80012345-6',
  note: '',
});

describe('box payment details', () => {
  it('trims, turns empty fields into null and accepts a RUC or a cédula', () => {
    expect(details.accountNumber).toBe('1234567890');
    expect(details.note).toBeNull();
    expect(
      boxPaymentDetailsSchema.safeParse({ ...details, holderDocument: '4567890' }).success,
    ).toBe(true);
    expect(
      boxPaymentDetailsSchema.safeParse({ ...details, holderDocument: '4.567.890' }).success,
    ).toBe(false);
  });

  it('only owners and admins change them, and every role of the box reads them', async () => {
    for (const role of ['coach', 'reception', 'member'] as const) {
      await expectServiceError(
        fixture.as(fixture.boxA, role, (context) => updatePaymentDetails(context, details)),
        'forbidden',
      );
      await expectServiceError(
        fixture.as(fixture.boxA, role, (context) => storePaymentQr(context, files, PNG.buffer)),
        'forbidden',
      );
      await expectServiceError(
        fixture.as(fixture.boxA, role, (context) => removePaymentQr(context)),
        'forbidden',
      );
    }

    const saved = await fixture.as(fixture.boxA, 'box_owner', (context) =>
      updatePaymentDetails(context, details),
    );
    expect(saved).toEqual({ ...details, hasQr: false });
    expect(
      await fixture.as(fixture.boxA, 'member', (context) => getPaymentDetails(context)),
    ).toEqual(saved);
    // Another box never sees them.
    const other = await fixture.as(fixture.boxB, 'member', (context) => getPaymentDetails(context));
    expect(other.accountNumber).toBeNull();

    const [entry] = await fixture.system((transaction) =>
      transaction
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.boxId, fixture.boxA.boxId),
            eq(auditLogs.action, 'box.payment_details_updated'),
          ),
        ),
    );
    expect(entry?.actorUserId).toBe(fixture.boxA.userIds.box_owner);
    expect(entry?.changes).toMatchObject({ accountNumber: { to: '1234567890' } });
  });

  it('keeps the QR image under its box and serves it to that box only', async () => {
    const { boxA, boxB } = fixture;
    await expectServiceError(
      fixture.as(boxA, 'member', (context) => readPaymentQr(context, files)),
      'payment_qr_not_found',
    );
    const stored = await fixture.as(boxA, 'box_admin', (context) =>
      storePaymentQr(context, files, PNG.buffer),
    );
    expect(stored.hasQr).toBe(true);
    expect(files.keys().some((key) => key.startsWith(`boxes/${boxA.boxId}/payment-qr/`))).toBe(
      true,
    );

    const file = await fixture.as(boxA, 'member', (context) => readPaymentQr(context, files));
    expect(file.contentType).toBe('image/png');
    await expectServiceError(
      fixture.as(boxB, 'member', (context) => readPaymentQr(context, files)),
      'payment_qr_not_found',
    );

    for (const [bytes, code] of [
      [PDF, 'payment_qr_type'],
      [new TextEncoder().encode('<svg onload=alert(1)>'), 'payment_qr_type'],
      [new Uint8Array(), 'payment_qr_empty'],
      [new Uint8Array(PAYMENT_QR_MAX_BYTES + 1), 'payment_qr_too_large'],
    ] as const) {
      await expectServiceError(
        fixture.as(boxA, 'box_owner', (context) =>
          storePaymentQr(context, files, bytes.buffer as ArrayBuffer),
        ),
        code,
      );
    }

    const removed = await fixture.as(boxA, 'box_owner', (context) => removePaymentQr(context));
    expect(removed.hasQr).toBe(false);
    await expectServiceError(
      fixture.as(boxA, 'member', (context) => readPaymentQr(context, files)),
      'payment_qr_not_found',
    );
  });
});
