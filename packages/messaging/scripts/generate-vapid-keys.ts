// Run once per environment (`pnpm --filter @guaranix/messaging vapid:generate`), then:
//   wrangler secret put VAPID_PRIVATE_KEY   (paste the private key)
//   VAPID_PUBLIC_KEY goes in wrangler.jsonc `vars`: it is public by design.
// Self-contained so plain `node` can run it without a TypeScript loader.
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
console.log(`VAPID_PUBLIC_KEY=${Buffer.from(raw).toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d ?? ''}`);
