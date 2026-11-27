import type { AuthErrorCode } from '@guaranix/shared';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import {
  clearOAuthCookie,
  readOAuthCookie,
  writeOAuthCookie,
  writeSessionCookie,
} from '../lib/cookies';
import {
  base64UrlDecode,
  base64UrlEncode,
  constantTimeEqual,
  hmacSha256,
  randomToken,
  sha256,
} from '../lib/crypto';
import { allowedOrigins } from '../lib/http';
import { linkGoogle, signInWithGoogle } from '../services/google-auth';
import { createSession } from '../services/sessions';

const oauthStateSchema = z.object({
  state: z.string(),
  nonce: z.string(),
  codeVerifier: z.string(),
  intent: z.enum(['login', 'link']),
  returnTo: z.url(),
});
type OAuthState = z.infer<typeof oauthStateSchema>;

const startQuerySchema = z.object({
  intent: z.enum(['login', 'link']).default('login'),
  returnTo: z.url(),
});

async function sealState(secret: string, state: OAuthState) {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(state)));
  return `${payload}.${await hmacSha256(secret, `oauth:${payload}`)}`;
}

async function openState(secret: string, sealed: string | undefined): Promise<OAuthState | null> {
  const [payload, signature] = sealed?.split('.') ?? [];
  if (!payload || !signature) return null;
  if (!constantTimeEqual(signature, await hmacSha256(secret, `oauth:${payload}`))) return null;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    return oauthStateSchema.parse(decoded);
  } catch {
    return null;
  }
}

/** Only our own apps may receive the person back, or this becomes an open redirect. */
function isAllowedReturn(context: Context<AppEnv>, returnTo: string) {
  return allowedOrigins(context).includes(new URL(returnTo).origin);
}

function backToApp(context: Context<AppEnv>, returnTo: string, error?: AuthErrorCode) {
  const target = new URL(returnTo);
  if (error) target.searchParams.set('auth_error', error);
  return context.redirect(target.toString(), 302);
}

const redirectUri = (context: Context<AppEnv>) =>
  `${context.env.PUBLIC_API_URL}/auth/google/callback`;

export const googleAuthRoutes = new Hono<AppEnv>()
  .get('/start', async (context) => {
    const query = startQuerySchema.safeParse(context.req.query());
    if (!query.success || !isAllowedReturn(context, query.data.returnTo)) {
      return context.json({ error: 'validation_failed' }, 400);
    }
    const { intent, returnTo } = query.data;
    const google = context.var.services.google;
    if (!google) return backToApp(context, returnTo, 'google_not_configured');
    if (intent === 'link' && !context.var.session) {
      return backToApp(context, returnTo, 'unauthenticated');
    }

    const state: OAuthState = {
      state: randomToken(),
      nonce: randomToken(),
      codeVerifier: randomToken(),
      intent,
      returnTo,
    };
    writeOAuthCookie(context, await sealState(context.env.AUTH_SECRET, state));
    return context.redirect(
      google.authorizationUrl({
        redirectUri: redirectUri(context),
        state: state.state,
        nonce: state.nonce,
        codeChallenge: await sha256(state.codeVerifier),
      }),
      302,
    );
  })

  .get('/callback', async (context) => {
    const saved = await openState(context.env.AUTH_SECRET, readOAuthCookie(context));
    clearOAuthCookie(context);
    // Without our own signed cookie there is nowhere safe to send the person.
    if (!saved) return context.json({ error: 'google_failed' }, 400);

    const google = context.var.services.google;
    const code = context.req.query('code');
    const state = context.req.query('state') ?? '';
    if (!google) return backToApp(context, saved.returnTo, 'google_not_configured');
    if (!code || !constantTimeEqual(state, saved.state)) {
      return backToApp(context, saved.returnTo, 'google_failed');
    }

    const identity = await google.exchangeCode({
      redirectUri: redirectUri(context),
      code,
      codeVerifier: saved.codeVerifier,
    });
    if (!identity || identity.nonce !== saved.nonce) {
      return backToApp(context, saved.returnTo, 'google_failed');
    }

    const database = context.var.services.database();
    if (saved.intent === 'link') {
      const session = context.var.session;
      if (!session) return backToApp(context, saved.returnTo, 'unauthenticated');
      const error = await linkGoogle(database, session.userId, identity);
      return backToApp(context, saved.returnTo, error ?? undefined);
    }

    const result = await signInWithGoogle(database, identity);
    if ('error' in result) return backToApp(context, saved.returnTo, result.error);
    writeSessionCookie(context, await createSession(database, result.userId));
    return backToApp(context, saved.returnTo);
  });
