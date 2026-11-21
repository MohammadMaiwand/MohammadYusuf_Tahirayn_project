import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  server: {
    // Development-only: allow the temporary public tunnel host and serve the
    // API on the same origin so cookies/CSRF keep working. Production build and
    // the test preview server are unaffected by these two dev settings.
    allowedHosts: true,
    proxy: { '/api': { target: 'http://127.0.0.1:4000' } },
    fs: {
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/Acount/**',
        '**/.local/**',
      ],
    },
  },
  preview: {
    // Serves the production build through the temporary public tunnel fast:
    // same tunnel host and same-origin API proxy so cookies/CSRF keep working.
    allowedHosts: true,
    proxy: { '/api': { target: 'http://127.0.0.1:4000' } },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,webmanifest,ttf}'],
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
