import { describe, expect, it } from 'vitest';
import { ChannelError } from '../notifications/channel-error';
import { concatBytes, decodeBase64Url, encodeBase64Url } from './base64url';
import { encryptPushPayload } from './encrypt';
import { generateVapidKeys, vapidAuthorization } from './vapid';
import { createWebPushChannel } from './web-push-channel';

const encoder = new TextEncoder();

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

async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: string | Uint8Array<ArrayBuffer>,
  length: number,
) {
  const prk = await hmac(salt, ikm);
  const infoBytes = typeof info === 'string' ? encoder.encode(info) : info;
  return (await hmac(prk, concatBytes(infoBytes, new Uint8Array([1])))).slice(0, length);
}

/** A browser's side of a subscription: what the push service hands the service worker. */
async function createBrowserSubscription() {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as { publicKey: CryptoKey; privateKey: CryptoKey };
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    address: {
      channel: 'push' as const,
      endpoint: 'https://push.example.com/send/abc123',
      p256dh: encodeBase64Url(publicKey),
      auth: encodeBase64Url(auth),
    },
    /** Decrypts like a browser would (RFC 8291), independent of the sender code. */
    async decrypt(body: Uint8Array<ArrayBuffer>): Promise<string> {
      const salt = body.slice(0, 16);
      const idLength = body[20] ?? 0;
      const senderPublic = body.slice(21, 21 + idLength);
      const ciphertext = body.slice(21 + idLength);
      const senderKey = await crypto.subtle.importKey(
        'raw',
        senderPublic,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
      );
      const shared = new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, keys.privateKey, 256),
      );
      const keyInfo = concatBytes(encoder.encode('WebPush: info\0'), publicKey, senderPublic);
      const ikm = await hkdf(auth, shared, keyInfo, 32);
      const cek = await hkdf(salt, ikm, 'Content-Encoding: aes128gcm\0', 16);
      const nonce = await hkdf(salt, ikm, 'Content-Encoding: nonce\0', 12);
      const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
      const plain = new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aesKey, ciphertext),
      );
      expect(plain.at(-1)).toBe(2);
      return new TextDecoder().decode(plain.slice(0, -1));
    },
  };
}

async function vapidKeys() {
  return { ...(await generateVapidKeys()), subject: 'mailto:soporte@example.com' };
}

describe('encryptPushPayload', () => {
  it('matches the RFC 8291 example (Appendix A)', async () => {
    const senderPublic = decodeBase64Url(
      'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
    );
    const curve = { name: 'ECDH', namedCurve: 'P-256' };
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
        x: encodeBase64Url(senderPublic.slice(1, 33)),
        y: encodeBase64Url(senderPublic.slice(33)),
      },
      curve,
      true,
      ['deriveBits'],
    );
    const publicKey = await crypto.subtle.importKey('raw', senderPublic, curve, true, []);
    const body = await encryptPushPayload(
      {
        p256dh:
          'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg', // gitleaks:allow (public RFC 8291 test vector)
      },
      encoder.encode('When I grow up, I want to be a watermelon'),
      { salt: decodeBase64Url('DGv6ra1nlYgDCS1FRnbzlw'), senderKeys: { privateKey, publicKey } },
    );
    expect(encodeBase64Url(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
  });

  it('produces an aes128gcm body the subscribed browser can decrypt', async () => {
    const browser = await createBrowserSubscription();
    const body = await encryptPushPayload(browser.address, encoder.encode('{"title":"Hola"}'));
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    await expect(browser.decrypt(body)).resolves.toBe('{"title":"Hola"}');
  });

  it('uses a fresh salt and key for every message', async () => {
    const browser = await createBrowserSubscription();
    const first = await encryptPushPayload(browser.address, encoder.encode('x'));
    const second = await encryptPushPayload(browser.address, encoder.encode('x'));
    expect(encodeBase64Url(first.slice(0, 86))).not.toBe(encodeBase64Url(second.slice(0, 86)));
  });
});

describe('vapidAuthorization', () => {
  it('signs a token for the endpoint origin that verifies with the public key', async () => {
    const keys = await vapidKeys();
    const now = new Date('2026-11-28T12:00:00Z');
    const header = await vapidAuthorization(keys, 'https://fcm.googleapis.com/fcm/send/xyz', now);
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, head, claims, signature, publicKey] = match as unknown as string[];
    expect(publicKey).toBe(keys.publicKey);
    const decoded = JSON.parse(new TextDecoder().decode(decodeBase64Url(claims ?? '')));
    expect(decoded).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: Math.floor(now.getTime() / 1000) + 12 * 3600,
      sub: 'mailto:soporte@example.com',
    });
    const verifyKey = await crypto.subtle.importKey(
      'raw',
      decodeBase64Url(keys.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      decodeBase64Url(signature ?? ''),
      encoder.encode(`${head}.${claims}`),
    );
    expect(valid).toBe(true);
  });
});

describe('createWebPushChannel', () => {
  it('posts the encrypted payload with VAPID headers', async () => {
    const browser = await createBrowserSubscription();
    const requests: { url: string; init: RequestInit }[] = [];
    const channel = createWebPushChannel({
      vapid: await vapidKeys(),
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(null, { status: 201, headers: { location: 'msg-1' } });
      },
    });
    const result = await channel.send(browser.address, {
      title: 'Tenés lugar',
      body: 'Entraste a la clase',
      url: '/reservas',
      tag: 'booking-1',
    });
    expect(result.providerMessageId).toBe('msg-1');
    const [request] = requests;
    expect(request?.url).toBe(browser.address.endpoint);
    const headers = new Headers(request?.init.headers);
    expect(headers.get('content-encoding')).toBe('aes128gcm');
    expect(headers.get('ttl')).toBe('86400');
    expect(headers.get('authorization')).toMatch(/^vapid t=/);
    const payload = JSON.parse(
      await browser.decrypt(request?.init.body as Uint8Array<ArrayBuffer>),
    );
    expect(payload).toEqual({
      title: 'Tenés lugar',
      body: 'Entraste a la clase',
      url: '/reservas',
      tag: 'booking-1',
    });
  });

  it.each([
    [410, 'address_gone'],
    [404, 'address_gone'],
    [429, 'retryable'],
    [503, 'retryable'],
    [403, 'permanent'],
  ])('maps status %i to %s', async (status, kind) => {
    const browser = await createBrowserSubscription();
    const channel = createWebPushChannel({
      vapid: await vapidKeys(),
      fetch: async () => new Response(null, { status }),
    });
    const error = await channel
      .send(browser.address, { title: 't', body: 'b' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ChannelError);
    expect((error as ChannelError).kind).toBe(kind);
    expect((error as ChannelError).code).toBe(`push_${status}`);
  });

  it('treats a network failure as retryable', async () => {
    const browser = await createBrowserSubscription();
    const channel = createWebPushChannel({
      vapid: await vapidKeys(),
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(channel.send(browser.address, { title: 't', body: 'b' })).rejects.toMatchObject({
      kind: 'retryable',
      code: 'network',
    });
  });

  it('gives up on a subscription with broken keys', async () => {
    const channel = createWebPushChannel({
      vapid: await vapidKeys(),
      fetch: async () => new Response(null, { status: 201 }),
    });
    await expect(
      channel.send(
        { channel: 'push', endpoint: 'https://push.example.com/x', p256dh: 'bad', auth: 'bad' },
        { title: 't', body: 'b' },
      ),
    ).rejects.toMatchObject({ kind: 'address_gone' });
  });
});
