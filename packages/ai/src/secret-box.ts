const encoder = new TextEncoder();
const decoder = new TextDecoder();
const IV_BYTES = 12;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function importMasterKey(masterKey: string): Promise<CryptoKey> {
  const raw = fromBase64(masterKey);
  if (raw.length !== 32) throw new Error('AI_SECRETS_KEY must be 32 bytes in base64');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/**
 * Encrypts a provider key with AES-256-GCM. `context` (the provider name) is
 * bound as associated data, so a ciphertext copied to another row will not open.
 */
export async function sealSecret(masterKey: string, plaintext: string, context: string) {
  const key = await importMasterKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
    key,
    encoder.encode(plaintext),
  );
  const output = new Uint8Array(IV_BYTES + sealed.byteLength);
  output.set(iv);
  output.set(new Uint8Array(sealed), IV_BYTES);
  return toBase64(output);
}

export async function openSecret(masterKey: string, sealed: string, context: string) {
  const key = await importMasterKey(masterKey);
  const bytes = fromBase64(sealed);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES), additionalData: encoder.encode(context) },
    key,
    bytes.slice(IV_BYTES),
  );
  return decoder.decode(plain);
}

/** What the superadmin sees instead of the key: its last four characters. */
export function secretHint(secret: string): string {
  return secret.trim().slice(-4);
}
