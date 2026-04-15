import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/hsk-writer/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,json}'],
        runtimeCaching: [
          {
            urlPattern: /\/hsk-writer\/stories\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'stories-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'HSK Writer · 汉字练习',
        short_name: 'HSK Writer',
        description: 'Practice reading and writing Chinese by typing HSK stories',
        theme_color: '#c0392b',
        background_color: '#faf8f5',
        display: 'standalone',
        start_url: '/hsk-writer/',
        scope: '/hsk-writer/',
        icons: [
          {
            src: '/hsk-writer/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/hsk-writer/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
