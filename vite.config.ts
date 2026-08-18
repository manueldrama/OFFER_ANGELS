import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Modern JS target so mobile ad traffic gets the smallest possible
      // payload. es2020 lets the bundler skip ES2015 shims that legacy
      // mobile Safari hasn't needed for years.
      target: 'es2020',
      minify: 'esbuild',
      reportCompressedSize: false, // speeds up build, no functional impact
      // Manual chunking removed: React 19 + framer-motion'un internal context
      // paylaşımı, statik+dinamik import karışıklarıyla birleşince Cloudflare
      // prod'da "Cannot set properties of undefined (setting 'Activity')"
      // crash'ine yol açıyordu. Rollup'ın varsayılan chunk algoritması bu
      // bağımlılık zincirini doğru çözer; bundle biraz büyür ama prod çalışır.
      chunkSizeWarningLimit: 1500,
    },
    server: {
      port: 3000,
      host: '0.0.0.0', // Listen on all network interfaces
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        }
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
