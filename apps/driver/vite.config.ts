import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served at /driver/ on the same domain as the customer app.
export default defineConfig({
  base: '/driver/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Chauffr Driver',
        short_name: 'Chauffr Driver',
        description: 'Trips and earnings for Chauffr drivers',
        theme_color: '#0f766e',
        background_color: '#f5f7fb',
        display: 'standalone',
        start_url: '/driver/',
        scope: '/driver/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
