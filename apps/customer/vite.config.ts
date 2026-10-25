import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Chauffr',
        short_name: 'Chauffr',
        description: 'Book a professional driver for your car',
        theme_color: '#1d4ed8',
        background_color: '#f5f7fb',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      // The driver app and ops dashboard live under the same origin; keep this
      // service worker from answering their navigations with the customer app.
      workbox: { navigateFallbackDenylist: [/^\/api\//, /^\/driver(\/|$)/, /^\/admin(\/|$)/] },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
