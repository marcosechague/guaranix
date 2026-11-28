import { RECEIPT_MAX_BYTES } from '@guaranix/shared/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMemoryFileStorage } from '../integrations/file-storage';
import { expectServiceError } from '../testing/expectations';
import { createServiceFixture, type ServiceFixture } from '../testing/service-fixture';
import { canUseReceipt, readReceipt, sniffReceiptType, storeReceipt } from './receipts';

let fixture: ServiceFixture;
const files = createMemoryFileStorage();

beforeAll(async () => {
  fixture = await createServiceFixture();
});

afterAll(async () => {
  await fixture.close();
});

const bytes = (...values: number[]) => new Uint8Array([...values, 0, 0, 0, 0, 0, 0, 0, 0]);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d);

describe('receipts', () => {
  it('knows photos and PDFs by their bytes and nothing else', () => {
    expect(sniffReceiptType(JPEG)).toBe('image/jpeg');
    expect(sniffReceiptType(PNG)).toBe('image/png');
    expect(sniffReceiptType(WEBP)).toBe('image/webp');
    expect(sniffReceiptType(PDF)).toBe('application/pdf');
    expect(sniffReceiptType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
    expect(sniffReceiptType(new Uint8Array())).toBeNull();
  });

  it('stores under the box and the uploader, and refuses empty, huge or odd files', async () => {
    const { boxA } = fixture;
    const stored = await fixture.as(boxA, 'member', (context) =>
      storeReceipt(context, files, PNG.buffer),
    );
    expect(stored.contentType).toBe('image/png');
    expect(stored.fileKey).toMatch(
      new RegExp(`^boxes/${boxA.boxId}/receipts/${boxA.userIds.member}/[0-9a-f-]+\\.png$`),
    );
    const store = (data: ArrayBuffer) =>
      fixture.as(boxA, 'reception', (context) => storeReceipt(context, files, data));
    await expectServiceError(store(new ArrayBuffer(0)), 'receipt_empty');
    await expectServiceError(store(new ArrayBuffer(RECEIPT_MAX_BYTES + 1)), 'receipt_too_large');
    await expectServiceError(store(bytes(0x68, 0x6f, 0x6c, 0x61).buffer), 'receipt_type');
    await expectServiceError(
      fixture.as(boxA, 'coach', (context) => storeReceipt(context, files, JPEG.buffer)),
      'forbidden',
    );
  });

  it("only the uploader and the box's front desk can open a receipt", async () => {
    const { boxA, boxB } = fixture;
    const { fileKey } = await fixture.as(boxA, 'member', (context) =>
      storeReceipt(context, files, JPEG.buffer),
    );
    const open = (box: typeof boxA, role: 'member' | 'reception' | 'box_owner') =>
      fixture.as(box, role, (context) => readReceipt(context, files, fileKey));
    expect((await open(boxA, 'member')).contentType).toBe('image/jpeg');
    expect((await open(boxA, 'box_owner')).contentType).toBe('image/jpeg');
    await expectServiceError(open(boxB, 'reception'), 'receipt_not_found');
    const someoneElse = { ...boxA, userIds: { ...boxA.userIds, member: boxA.userIds.box_admin } };
    await expectServiceError(open(someoneElse, 'member'), 'receipt_not_found');
    await expectServiceError(
      fixture.as(boxA, 'reception', (context) =>
        readReceipt(context, files, `boxes/${boxA.boxId}/receipts/${boxA.userIds.member}/none.jpg`),
      ),
      'receipt_not_found',
    );
  });

  it('never accepts a path that climbs out of the box', async () => {
    const { boxA, boxB } = fixture;
    await fixture.as(boxA, 'reception', async (context) => {
      expect(canUseReceipt(context, `boxes/${boxA.boxId}/receipts/x/../../${boxB.boxId}/a`)).toBe(
        false,
      );
      expect(canUseReceipt(context, `boxes/${boxA.boxId}/receipts/`)).toBe(false);
      expect(canUseReceipt(context, `boxes/${boxB.boxId}/receipts/u/a.jpg`)).toBe(false);
    });
  });
});
