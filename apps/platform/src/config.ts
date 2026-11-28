/** API origin. Locally `wrangler dev` listens on 8787; deployments set VITE_API_URL. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

/** The box panel, opened after "Entrar como". */
export const ADMIN_URL: string = import.meta.env.VITE_ADMIN_URL ?? 'http://localhost:5174';
