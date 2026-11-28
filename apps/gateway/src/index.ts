import { routeFor } from './routing';

interface Env {
  ASSETS: Fetcher;
  API: Fetcher;
}

/**
 * Written next to the apps by scripts/deploy/write-headers.mjs. The asset store
 * applies `_headers` to the files it serves; the HTML this Worker returns for
 * client-side routes gets the same headers from this copy.
 */
const SECURITY_HEADERS_PATH = '/security-headers.json';
// Used only if that file is missing: still no framing and no sniffing.
const BASELINE_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin',
};

let securityHeaders: Promise<Record<string, string>> | undefined;

function loadSecurityHeaders(env: Env, origin: string): Promise<Record<string, string>> {
  securityHeaders ??= env.ASSETS.fetch(`${origin}${SECURITY_HEADERS_PATH}`)
    .then((response) => (response.ok ? response.json<Record<string, string>>() : BASELINE_HEADERS))
    .catch(() => BASELINE_HEADERS);
  return securityHeaders;
}

function forwardToApi(request: Request, env: Env, url: URL, path: string): Promise<Response> {
  const target = new URL(url);
  target.pathname = path;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  // Same headers (cookie, Origin, CF-Connecting-IP for rate limits) and body;
  // redirects (Google sign-in) go back to the browser untouched.
  return env.API.fetch(
    new Request(target, {
      method: request.method,
      headers: request.headers,
      body: hasBody ? request.body : null,
      redirect: 'manual',
    }),
  );
}

async function serveApp(env: Env, url: URL, indexPath: string): Promise<Response> {
  const [index, headers] = await Promise.all([
    env.ASSETS.fetch(`${url.origin}${indexPath}`),
    loadSecurityHeaders(env, url.origin),
  ]);
  const response = new Response(index.body, index);
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  // The HTML names the current bundle; never let a browser keep an old one.
  response.headers.set('Cache-Control', 'no-cache');
  return response;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const route = routeFor(request.method, url.pathname);
    switch (route.kind) {
      case 'api':
        return forwardToApi(request, env, url, route.path);
      case 'redirect':
        return Response.redirect(`${url.origin}${route.location}${url.search}`, 308);
      case 'app':
        return serveApp(env, url, route.indexPath);
      case 'not_found':
        return new Response('Not found', { status: 404 });
    }
  },
} satisfies ExportedHandler<Env>;
