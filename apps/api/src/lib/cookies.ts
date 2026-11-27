import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv } from '../env';
import { SESSION_LIFETIME_SECONDS } from '../services/sessions';

/**
 * `__Host-` pins the cookie to the API host over HTTPS. Plain http://localhost
 * cannot use it (Safari drops Secure cookies there), so development uses a
 * plain name without Secure; HttpOnly and SameSite=Lax apply everywhere.
 */
function isSecure(context: Context<AppEnv>) {
  return context.env.APP_ENV !== 'development';
}

export function sessionCookieName(context: Context<AppEnv>) {
  return isSecure(context) ? '__Host-gx_session' : 'gx_session';
}

export function readSessionCookie(context: Context<AppEnv>) {
  return getCookie(context, sessionCookieName(context));
}

export function writeSessionCookie(context: Context<AppEnv>, token: string) {
  setCookie(context, sessionCookieName(context), token, {
    httpOnly: true,
    secure: isSecure(context),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_LIFETIME_SECONDS,
  });
}

export function clearSessionCookie(context: Context<AppEnv>) {
  deleteCookie(context, sessionCookieName(context), { path: '/', secure: isSecure(context) });
}

const OAUTH_COOKIE = 'gx_oauth';
const OAUTH_COOKIE_PATH = '/auth/google';

/** Short-lived cookie that carries the Google login's state and PKCE verifier. */
export function writeOAuthCookie(context: Context<AppEnv>, value: string) {
  setCookie(context, OAUTH_COOKIE, value, {
    httpOnly: true,
    secure: isSecure(context),
    // Lax, not Strict: Google sends the person back with a cross-site top-level GET.
    sameSite: 'Lax',
    path: OAUTH_COOKIE_PATH,
    maxAge: 10 * 60,
  });
}

export function readOAuthCookie(context: Context<AppEnv>) {
  return getCookie(context, OAUTH_COOKIE);
}

export function clearOAuthCookie(context: Context<AppEnv>) {
  deleteCookie(context, OAUTH_COOKIE, { path: OAUTH_COOKIE_PATH, secure: isSecure(context) });
}
