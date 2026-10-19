import { defineConfig } from 'vitest/config';

/**
 * Configuración de pruebas unitarias.
 *
 * - `jsdom` provee un DOM y `localStorage` reales para las pruebas.
 * - Los tests viven junto al código que cubren (`src/js/tests`).
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/tests/**/*.test.js'],
    clearMocks: true,
  },
});
