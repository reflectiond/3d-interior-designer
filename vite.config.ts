import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
//
// CSP NOTE: In dev mode no CSP is applied — Vite's HMR uses inline scripts
// and dynamic imports that conflict with strict CSP. For production, configure
// the following CSP at the hosting layer (e.g. nginx, Vercel, Netlify):
//
//   default-src 'self';
//   script-src 'self';
//   style-src 'self' 'unsafe-inline';
//   img-src 'self' data: blob:;
//   connect-src 'self';
//   frame-ancestors *;
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
    },
  },
});
