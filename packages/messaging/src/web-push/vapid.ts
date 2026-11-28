import { decodeBase64Url, encodeBase64Url } from './base64url';

export interface VapidKeys {
  /** Uncompressed P-256 public key (65 bytes), base64url. The apps subscribe with it. */
  publicKey: string;
  /** P-256 private scalar (32 bytes), base64url. A Worker secret. */
  privateKey: string;
  /** Contact for push services, `mailto:` or `https:`. */
  subject: string;
}

const encoder = new TextEncoder();
/** Push services reject tokens valid for more than 24 h; 12 h leaves room for clock skew. */
const TOKEN_LIFETIME_SECONDS = 12 * 60 * 60;

function importSigningKey(keys: VapidKeys): Promise<CryptoKey> {
  const publicKey = decodeBase64Url(keys.publicKey);
  if (publicKey.length !== 65 || publicKey[0] !== 4) {
    throw new Error('VAPID public key must be an uncompressed P-256 point');
  }
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: keys.privateKey,
      x: encodeBase64Url(publicKey.slice(1, 33)),
      y: encodeBase64Url(publicKey.slice(33, 65)),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/**
 * `Authorization` header value for one push service (RFC 8292). The audience
 * is the endpoint's origin, so one token works for every subscription there.
 */
export async function vapidAuthorization(
  keys: VapidKeys,
  endpoint: string,
  now: Date,
): Promise<string> {
  const header = encodeBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = encodeBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now.getTime() / 1000) + TOKEN_LIFETIME_SECONDS,
        sub: keys.subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  // WebCrypto already returns the raw r||s form JWS expects for ES256.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await importSigningKey(keys),
    encoder.encode(unsigned),
  );
  return `vapid t=${unsigned}.${encodeBase64Url(new Uint8Array(signature))}, k=${keys.publicKey}`;
}

/** New VAPID key pair, for `pnpm --filter @guaranix/messaging vapid:generate`. */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  if (!jwk.d) throw new Error('Private key export failed');
  return { publicKey: encodeBase64Url(publicKey), privateKey: jwk.d };
}
