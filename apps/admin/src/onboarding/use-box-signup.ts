import type { BoxSignupInput } from '@guaranix/shared';
import { useAuth } from '@guaranix/ui/auth';
import { useApi } from '@guaranix/ui/data';
import { useMutation } from '@tanstack/react-query';

/** Creates the box; the API makes it the session's active box, so reloading the session opens the panel. */
export function useBoxSignup() {
  const api = useApi();
  const { client, setSession } = useAuth();
  return useMutation({
    mutationFn: (input: BoxSignupInput) => api.post('/onboarding/box', input),
    onSuccess: async () => setSession(await client.getSession()),
  });
}
