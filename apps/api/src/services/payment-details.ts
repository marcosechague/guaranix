import { boxes } from '@guaranix/db/schema';
import type { PAYMENT_QR_CONTENT_TYPES } from '@guaranix/shared/schemas';
import {
  PAYMENT_QR_MAX_BYTES,
  type BoxPaymentDetails,
  type BoxPaymentDetailsFields,
} from '@guaranix/shared/schemas';
import { eq } from 'drizzle-orm';
import type { FileStorage, StoredFile } from '../integrations/file-storage';
import { diff, recordAudit } from './audit';
import { currentBox } from './box-calendar';
import { MANAGER_ROLES, assertRole, type ServiceContext } from './context';
import { notFound, unprocessable } from './errors';
import { sniffReceiptType } from './receipts';

type BoxRow = typeof boxes.$inferSelect;

function pickDetails(row: BoxRow): BoxPaymentDetails {
  return {
    bankName: row.paymentBankName,
    accountNumber: row.paymentAccountNumber,
    alias: row.paymentAlias,
    holderName: row.paymentHolderName,
    holderDocument: row.paymentHolderDocument,
    note: row.paymentNote,
    hasQr: row.paymentQrFileKey !== null,
  };
}

/** Every role of the box sees them: members need them to pay. */
export async function getPaymentDetails(context: ServiceContext): Promise<BoxPaymentDetails> {
  return pickDetails(await currentBox(context));
}

async function saveBox(
  context: ServiceContext,
  values: Partial<BoxRow>,
  action: `box.${string}`,
): Promise<BoxPaymentDetails> {
  const before = pickDetails(await currentBox(context));
  const [updated] = await context.transaction
    .update(boxes)
    .set({ ...values, updatedAt: context.now })
    .where(eq(boxes.id, context.auth.boxId))
    .returning();
  if (!updated) throw notFound('box');
  const after = pickDetails(updated);
  await recordAudit(context, {
    action,
    entityType: 'box',
    entityId: context.auth.boxId,
    changes: diff(before, after),
  });
  return after;
}

/** Changing where money goes is sensitive: only owners and admins, always audited. */
export async function updatePaymentDetails(
  context: ServiceContext,
  input: BoxPaymentDetailsFields,
): Promise<BoxPaymentDetails> {
  assertRole(context.auth.role, MANAGER_ROLES);
  return saveBox(
    context,
    {
      paymentBankName: input.bankName,
      paymentAccountNumber: input.accountNumber,
      paymentAlias: input.alias,
      paymentHolderName: input.holderName,
      paymentHolderDocument: input.holderDocument,
      paymentNote: input.note,
    },
    'box.payment_details_updated',
  );
}

const QR_EXTENSIONS: Record<(typeof PAYMENT_QR_CONTENT_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Stores a new QR image under the box's own prefix and points the box at it. */
export async function storePaymentQr(
  context: ServiceContext,
  files: FileStorage,
  bytes: ArrayBuffer,
): Promise<BoxPaymentDetails> {
  assertRole(context.auth.role, MANAGER_ROLES);
  if (bytes.byteLength === 0) throw unprocessable('payment_qr_empty');
  if (bytes.byteLength > PAYMENT_QR_MAX_BYTES) throw unprocessable('payment_qr_too_large');
  // Same byte sniffing as receipts, minus PDFs: the QR has to render as an image.
  const contentType = sniffReceiptType(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16)));
  if (!contentType || contentType === 'application/pdf') throw unprocessable('payment_qr_type');
  const fileKey = `boxes/${context.auth.boxId}/payment-qr/${crypto.randomUUID()}.${QR_EXTENSIONS[contentType]}`;
  await files.put(fileKey, bytes, contentType);
  return saveBox(context, { paymentQrFileKey: fileKey }, 'box.payment_qr_updated');
}

export async function removePaymentQr(context: ServiceContext): Promise<BoxPaymentDetails> {
  assertRole(context.auth.role, MANAGER_ROLES);
  return saveBox(context, { paymentQrFileKey: null }, 'box.payment_qr_removed');
}

/** The key is never taken from the client: it is whatever the session's box points at. */
export async function readPaymentQr(
  context: ServiceContext,
  files: FileStorage,
): Promise<StoredFile> {
  const { paymentQrFileKey } = await currentBox(context);
  if (!paymentQrFileKey) throw notFound('payment_qr');
  const file = await files.get(paymentQrFileKey);
  if (!file) throw notFound('payment_qr');
  return file;
}
