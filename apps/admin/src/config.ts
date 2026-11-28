/** API origin. Locally `wrangler dev` listens on 8787; deployments set VITE_API_URL. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

/** Where a GuaraniX admin returns after leaving a box they entered as owner. */
export const PLATFORM_URL: string = import.meta.env.VITE_PLATFORM_URL ?? 'http://localhost:5175';
