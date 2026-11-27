/** Proves a request comes from a person. Cloudflare Turnstile today; swappable. */
export interface CaptchaVerifier {
  verify(token: string, remoteIp: string | null): Promise<boolean>;
}

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Locally, use Cloudflare's test secret `1x0000000000000000000000000000000AA`
 * (always passes) with the test site key in the apps, so no account is needed.
 */
export function createTurnstileVerifier(
  secretKey: string,
  fetchImpl: typeof fetch = fetch,
): CaptchaVerifier {
  return {
    async verify(token, remoteIp) {
      const body = new FormData();
      body.append('secret', secretKey);
      body.append('response', token);
      if (remoteIp) body.append('remoteip', remoteIp);
      try {
        const response = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });
        if (!response.ok) return false;
        const result: { success?: unknown } = await response.json();
        return result.success === true;
      } catch {
        // Fail closed: if Turnstile is unreachable, nobody gets through.
        console.error('Turnstile verification request failed');
        return false;
      }
    },
  };
}
