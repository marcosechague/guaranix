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
  const box = await currentBox(context);
  const before = pickDetails(box);
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
    changes: {
      ...diff(before, after),
      // Which image members were sent to, before and after: hasQr alone hides a swap.
      ...(box.paymentQrFileKey !== updated.paymentQrFileKey && {
        qrFileKey: { from: box.paymentQrFileKey, to: updated.paymentQrFileKey },
      }),
    },
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
  return replaceQr(context, files, fileKey, 'box.payment_qr_updated');
}

export async function removePaymentQr(
  context: ServiceContext,
  files: FileStorage,
): Promise<BoxPaymentDetails> {
  assertRole(context.auth.role, MANAGER_ROLES);
  return replaceQr(context, files, null, 'box.payment_qr_removed');
}

/**
 * Points the box at a new QR (or none) and deletes the old image. The audit
 * entry keeps the old key, so the change stays traceable after the file is gone.
 */
async function replaceQr(
  context: ServiceContext,
  files: FileStorage,
  fileKey: string | null,
  action: `box.${string}`,
): Promise<BoxPaymentDetails> {
  const { paymentQrFileKey: previousKey } = await currentBox(context);
  const details = await saveBox(context, { paymentQrFileKey: fileKey }, action);
  // Last step of the request: nothing after it can roll the box update back.
  if (previousKey && previousKey !== fileKey && isOwnQrKey(context, previousKey)) {
    await files.delete(previousKey);
  }
  return details;
}

/** Only ever delete files under this box's QR folder, whatever the column holds. */
const isOwnQrKey = (context: ServiceContext, key: string) =>
  key.startsWith(`boxes/${context.auth.boxId}/payment-qr/`);

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
