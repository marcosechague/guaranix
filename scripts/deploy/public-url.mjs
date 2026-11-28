#!/usr/bin/env node
/**
 * Prints the public origin of GuaraniX, with no trailing slash.
 * PUBLIC_URL wins when set (a custom domain, later). Otherwise it is the free
 * workers.dev address of the gateway: https://guaranix.<account subdomain>.workers.dev,
 * read from the Cloudflare API.
 *
 * Usage: node scripts/deploy/public-url.mjs
 * Env: PUBLIC_URL, or CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.
 */
const GATEWAY_WORKER = 'guaranix';

function normalize(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('PUBLIC_URL tiene que empezar con https://');
  return url.origin;
}

async function workersDevOrigin() {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId } = process.env;
  if (!token || !accountId) throw new Error('Faltan CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID.');
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const body = await response.json().catch(() => ({}));
  const subdomain = body.result?.subdomain;
  if (!response.ok || !subdomain) {
    throw new Error(
      'La cuenta de Cloudflare todavía no tiene subdominio workers.dev: elegilo en Workers & Pages (docs/despliegue.md).',
    );
  }
  return `https://${GATEWAY_WORKER}.${subdomain}.workers.dev`;
}

try {
  const configured = process.env.PUBLIC_URL?.trim();
  console.log(configured ? normalize(configured) : await workersDevOrigin());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
