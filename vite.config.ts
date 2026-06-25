import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/fhir-proxy': {
        target: 'https://google-fhir.fhir-aggregator.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fhir-proxy/, ''),
      },
      '/schema-proxy': {
        target: 'https://hl7.org/fhir',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/schema-proxy/, ''),
      },
      '/tx-proxy': {
        target: 'https://tx.fhir.org/r4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tx-proxy/, ''),
      },
    },
  },
});
