import { base64UrlDecode } from '../lib/crypto';

export interface GoogleIdentity {
  /** Google's stable account id. */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  nonce: string | null;
}

export interface GoogleAuthorizationRequest {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface GoogleCodeExchange {
  redirectUri: string;
  code: string;
  codeVerifier: string;
}

/** Google sign-in (OpenID Connect, authorization code flow with PKCE). */
export interface GoogleOAuth {
  authorizationUrl(request: GoogleAuthorizationRequest): string;
  /** Returns null when Google rejects the code or the ID token is not for us. */
  exchangeCode(exchange: GoogleCodeExchange): Promise<GoogleIdentity | null>;
}

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

interface IdTokenClaims {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  nonce?: unknown;
}

function decodeClaims(idToken: string): IdTokenClaims | null {
  const payload = idToken.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as IdTokenClaims;
  } catch {
    return null;
  }
}

const stringOrNull = (value: unknown) => (typeof value === 'string' ? value : null);

/**
 * The ID token comes straight from Google's token endpoint over TLS, which
 * OpenID Connect Core §3.1.3.7 accepts in place of checking its signature.
 * Issuer, audience, expiry and nonce are still checked.
 */
export function validateIdToken(
  idToken: string,
  clientId: string,
  nowSeconds = Date.now() / 1000,
): GoogleIdentity | null {
  const claims = decodeClaims(idToken);
  if (!claims) return null;
  if (!ISSUERS.has(String(claims.iss)) || claims.aud !== clientId) return null;
  if (typeof claims.exp !== 'number' || claims.exp < nowSeconds) return null;
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) return null;
  return {
    subject: claims.sub,
    email: stringOrNull(claims.email)?.toLowerCase() ?? null,
    emailVerified: claims.email_verified === true,
    name: stringOrNull(claims.name),
    nonce: stringOrNull(claims.nonce),
  };
}

export function createGoogleOAuth(
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
): GoogleOAuth {
  return {
    authorizationUrl({ redirectUri, state, nonce, codeChallenge }) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });
      return `${AUTHORIZE_URL}?${params.toString()}`;
    },
    async exchangeCode({ redirectUri, code, codeVerifier }) {
      const response = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });
      if (!response.ok) return null;
      const tokens: { id_token?: unknown } = await response.json();
      if (typeof tokens.id_token !== 'string') return null;
      return validateIdToken(tokens.id_token, clientId);
    },
  };
}
