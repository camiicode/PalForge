import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Ruta base del sitio en GitHub Pages: `https://<usuario>.github.io/palforge/`.
 * Todas las rutas del manifest y del service worker derivan de aquí.
 */
const BASE_PATH = '/palforge/';

/**
 * Configuración de Vite.
 *
 * `vite-plugin-pwa` genera el manifest, los iconos del sistema y un service
 * worker que precachea la app (incluido `data.json`) para uso offline.
 */
export default defineConfig({
  base: BASE_PATH,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: BASE_PATH,
        name: 'PalForge - Herramienta de Cría',
        short_name: 'PalForge',
        description:
          'Planifica tus proyectos de cría en Palworld con PalForge.',
        lang: 'es',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0a0c10',
        background_color: '#0a0c10',
        categories: ['utilities', 'games'],
        icons: [
          {
            src: `${BASE_PATH}icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${BASE_PATH}icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${BASE_PATH}icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: `${BASE_PATH}favicon.png`,
            sizes: '1254x1254',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,json}'],
        navigateFallback: `${BASE_PATH}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
