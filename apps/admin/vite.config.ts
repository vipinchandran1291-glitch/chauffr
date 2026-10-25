import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served at /admin/ on the same domain as the customer app.
export default defineConfig({
  base: '/admin/',
  plugins: [
    react(),
  ],
  server: {
    port: 5175,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
