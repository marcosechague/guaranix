/** Where a request that is not a plain file goes. Pure, so it is unit tested. */
export type Route =
  | { kind: 'api'; path: string }
  | { kind: 'redirect'; location: string }
  | { kind: 'app'; indexPath: string }
  | { kind: 'not_found' };

/** Apps under a path prefix; anything else belongs to the member app at `/`. */
export const PREFIXED_APPS = ['/panel', '/plataforma'] as const;

const API_PREFIX = '/api';
// A path whose last segment has an extension is a file that does not exist
// (an old hashed bundle, a typo), never a client-side route.
const LOOKS_LIKE_FILE = /\/[^/]+\.[a-z0-9]+$/i;

export function routeFor(method: string, pathname: string): Route {
  if (pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)) {
    return { kind: 'api', path: pathname.slice(API_PREFIX.length) || '/' };
  }
  if (method !== 'GET' && method !== 'HEAD') return { kind: 'not_found' };
  if (LOOKS_LIKE_FILE.test(pathname)) return { kind: 'not_found' };
  for (const prefix of PREFIXED_APPS) {
    if (pathname === prefix) return { kind: 'redirect', location: `${prefix}/` };
    if (pathname.startsWith(`${prefix}/`)) return { kind: 'app', indexPath: `${prefix}/` };
  }
  return { kind: 'app', indexPath: '/' };
}
