/** API origin. Locally `wrangler dev` listens on 8787; deployments set VITE_API_URL. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
