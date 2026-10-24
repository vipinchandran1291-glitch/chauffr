import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Chauffr Driver',
        short_name: 'Chauffr Driver',
        description: 'Accept and manage Chauffr driving jobs',
        theme_color: '#0b1b3f',
        background_color: '#0b1b3f',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
    }),
  ],
  server: { port: 5174, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000' } },
});
