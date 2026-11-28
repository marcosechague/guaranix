import { RECEIPT_MAX_BYTES, type ReceiptContentType } from '@guaranix/shared/schemas';
import type { FileStorage, StoredFile } from '../integrations/file-storage';
import { FRONT_DESK_ROLES, isStaff, type ServiceContext } from './context';
import { forbidden, notFound, unprocessable } from './errors';

const EXTENSIONS: Record<ReceiptContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * The type comes from the file's first bytes, never from the client's
 * Content-Type, so an HTML or SVG file can't be stored as a "receipt" and
 * later served back to staff.
 */
export function sniffReceiptType(bytes: Uint8Array): ReceiptContentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** Exactly what `storeReceipt` writes (plus the demo seed's `seed/` folder), nothing else. */
const RECEIPT_KEY = new RegExp(
  `^boxes/${UUID}/receipts/(${UUID}|seed)/(${UUID}|demo-\\d+)\\.(jpg|png|webp|pdf)$`,
);

/** Every receipt of a box lives under its own prefix; the uploader's id is part of the key. */
const boxPrefix = (boxId: string) => `boxes/${boxId}/receipts/`;
const uploaderPrefix = (boxId: string, userId: string) => `${boxPrefix(boxId)}${userId}/`;

const isFrontDesk = (context: ServiceContext) =>
  (FRONT_DESK_ROLES as readonly string[]).includes(context.auth.role);

/** Front desk and members handle receipts; coaches handle no money. */
function assertCanHandleReceipts(context: ServiceContext): void {
  if (!isFrontDesk(context) && isStaff(context.auth.role)) throw forbidden();
}

/**
 * Whether the acting user may attach or open this receipt: front desk any
 * receipt of the box, a member only the ones they uploaded.
 */
export function canUseReceipt(context: ServiceContext, key: string): boolean {
  if (!RECEIPT_KEY.test(key)) return false;
  const prefix = isFrontDesk(context)
    ? boxPrefix(context.auth.boxId)
    : uploaderPrefix(context.auth.boxId, context.auth.userId);
  return key.startsWith(prefix) && key.length > prefix.length;
}

export async function storeReceipt(
  context: ServiceContext,
  files: FileStorage,
  bytes: ArrayBuffer,
): Promise<{ fileKey: string; contentType: ReceiptContentType }> {
  assertCanHandleReceipts(context);
  if (bytes.byteLength === 0) throw unprocessable('receipt_empty');
  if (bytes.byteLength > RECEIPT_MAX_BYTES) throw unprocessable('receipt_too_large');
  const contentType = sniffReceiptType(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 16)));
  if (!contentType) throw unprocessable('receipt_type');
  const fileKey = `${uploaderPrefix(context.auth.boxId, context.auth.userId)}${crypto.randomUUID()}.${EXTENSIONS[contentType]}`;
  await files.put(fileKey, bytes, contentType);
  return { fileKey, contentType };
}

export async function readReceipt(
  context: ServiceContext,
  files: FileStorage,
  key: string,
): Promise<StoredFile> {
  assertCanHandleReceipts(context);
  // Another box's key, or someone else's, gets the same answer as a missing file.
  if (!canUseReceipt(context, key)) throw notFound('receipt');
  const file = await files.get(key);
  if (!file) throw notFound('receipt');
  return file;
}
