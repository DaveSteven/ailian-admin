import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    build: { outDir: 'dist', emptyOutDir: true },
    server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
  };
});
