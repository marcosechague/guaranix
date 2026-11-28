import { concatBytes, decodeBase64Url } from './base64url';

const encoder = new TextEncoder();
const RECORD_SIZE = 4096;
/** A single record carries at most this much plaintext (record size minus tag and delimiter). */
export const MAX_PAYLOAD_BYTES = RECORD_SIZE - 16 - 1 - 86;

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  const imported = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, data));
}

/** HKDF with SHA-256 for outputs of at most 32 bytes: extract, then a single expand block. */
async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  inputKey: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  length: number,
) {
  const pseudoRandomKey = await hmac(salt, inputKey);
  const output = await hmac(pseudoRandomKey, concatBytes(info, new Uint8Array([1])));
  return output.slice(0, length);
}

interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface EncryptionSecrets {
  /** Random per message; tests pass fixed ones. */
  salt?: Uint8Array<ArrayBuffer>;
  senderKeys?: KeyPair;
}

/**
 * Encrypts a push payload for one subscription with `aes128gcm` (RFC 8291 and
 * RFC 8188): ECDH with a fresh key pair, keys derived with the subscription's
 * auth secret, a single record. Returns the request body.
 */
export async function encryptPushPayload(
  subscription: { p256dh: string; auth: string },
  payload: Uint8Array<ArrayBuffer>,
  secrets: EncryptionSecrets = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (payload.length > MAX_PAYLOAD_BYTES) throw new Error('Push payload too large');
  const receiverPublic = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  const receiverKey = await crypto.subtle.importKey(
    'raw',
    receiverPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const senderKeys =
    secrets.senderKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as KeyPair);
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey));
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: receiverKey },
      senderKeys.privateKey,
      256,
    ),
  );

  const keyInfo = concatBytes(encoder.encode('WebPush: info\0'), receiverPublic, senderPublic);
  const inputKey = await hkdf(authSecret, sharedSecret, keyInfo, 32);
  const salt = secrets.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(
    salt,
    inputKey,
    encoder.encode('Content-Encoding: aes128gcm\0'),
    16,
  );
  const nonce = await hkdf(salt, inputKey, encoder.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  // 0x02 marks the last (and only) record; no padding.
  const record = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      concatBytes(payload, new Uint8Array([2])),
    ),
  );
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, RECORD_SIZE);
  return concatBytes(salt, recordSize, new Uint8Array([senderPublic.length]), senderPublic, record);
}
