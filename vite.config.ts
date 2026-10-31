/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/card-scanner/',
  plugins: [
    react(),
    ...(process.env.VITEST
      ? []
      : [
          VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            injectRegister: 'inline',
            manifestFilename: 'manifest.json',
            includeAssets: ['favicon.svg', 'icons/*.png', 'samples/*.png'],
            manifest: {
              name: 'Card Scanner',
              short_name: 'Cards',
              description: 'Scan a business card and add it to your phone contacts.',
              id: '/card-scanner/',
              start_url: '/card-scanner/',
              scope: '/card-scanner/',
              display: 'standalone',
              background_color: '#e4ddd0',
              theme_color: '#1c1916',
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            injectManifest: {
              globPatterns: ['**/*.{js,css,html,svg,png,ico,gz,json,webmanifest}'],
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
            },
            devOptions: {
              enabled: true,
              type: 'module',
            },
          }),
        ]),
  ],
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
  },
});
