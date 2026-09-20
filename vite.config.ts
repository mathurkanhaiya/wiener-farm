import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app'],
    proxy: {
      '/functions/v1': {target: 'https://api.viralaitools.xyz', changeOrigin: true},
      '/api/host': {target: 'https://api.viralaitools.xyz', changeOrigin: true},
      '/api': {target: 'https://wiener-farm.vercel.app', changeOrigin: true},
    },
  },
});
