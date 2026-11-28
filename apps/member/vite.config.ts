import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'GuaraniX',
        short_name: 'GuaraniX',
        lang: 'es-PY',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0E0F11',
        theme_color: '#0E0F11',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Fonts, images and the app shell are precached so the app opens offline.
        globPatterns: ['**/*.{js,css,html,png,webp,woff2}'],
        // Push notifications: `public/push-sw.js`.
        importScripts: ['push-sw.js'],
        // On the shared production origin the panel, the platform and the API live
        // under these paths (apps/gateway); the member shell must never answer them.
        navigateFallbackDenylist: [/^\/panel(\/|$)/, /^\/plataforma(\/|$)/, /^\/api(\/|$)/],
      },
    }),
  ],
});
