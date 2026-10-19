/**
 * PalForge — Punto de entrada.
 *
 * Se encarga únicamente del arranque:
 *  1. Cargar el catálogo desde `public/data.json`.
 *  2. Construir el índice de búsqueda.
 *  3. Inicializar la interfaz.
 */

import './style.css';

import { createSearchIndex } from './js/search.js';
import { initUI } from './js/ui.js';

// `import.meta.env.BASE_URL` incluye la ruta base de Vite (`/palforge/` en
// producción para GitHub Pages, `/` en los tests), así que el catálogo se sirve
// siempre junto a la app y no desde la raíz del dominio.
const DATA_URL = `${import.meta.env.BASE_URL}data.json`;

/**
 * Carga el catálogo de Pals y su versión de datos.
 *
 * Si el archivo no está disponible se registra el error y se devuelve un
 * catálogo vacío: la interfaz sigue siendo usable sin resultados.
 *
 * @returns {Promise<{ pals: Array<object>, gameVersion: string|null }>}
 */
async function loadCatalog() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${DATA_URL} (${response.status})`);
    }

    const data = await response.json();
    const pals = Array.isArray(data.pals) ? data.pals : [];
    const gameVersion =
      typeof data.game_version === 'string' ? data.game_version : null;

    return { pals, gameVersion };
  } catch (error) {
    console.error('Error al cargar el catálogo de Pals:', error);
    return { pals: [], gameVersion: null };
  }
}

/** Arranca la aplicación. */
async function bootstrap() {
  const { pals, gameVersion } = await loadCatalog();
  const fuse = createSearchIndex(pals);

  initUI({ pals, fuse, gameVersion });
}

bootstrap();
