import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // `/panel/` or `/plataforma/` in production, where the gateway serves the three
  // apps on one origin (apps/gateway); `/` locally.
  base: process.env['APP_BASE_PATH'] ?? '/',
  plugins: [react(), tailwindcss()],
});
