import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The admin dashboard is a desktop tool, so it skips the PWA setup.
export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000' } },
});
