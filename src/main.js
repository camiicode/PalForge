/**
 * PalForge — Punto de entrada.
 *
 * Se encarga únicamente del arranque:
 *  1. Cargar el catálogo desde `public/data.json` (servido en `/data.json`).
 *  2. Construir el índice de búsqueda.
 *  3. Inicializar la interfaz.
 */

import './style.css';

import { createSearchIndex } from './js/search.js';
import { initUI } from './js/ui.js';

const DATA_URL = '/data.json';

/**
 * Carga el catálogo de Pals.
 *
 * Si el archivo no está disponible se registra el error y se devuelve una
 * lista vacía: la interfaz sigue siendo usable sin resultados.
 *
 * @returns {Promise<Array<object>>}
 */
async function loadPals() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${DATA_URL} (${response.status})`);
    }

    const data = await response.json();
    return Array.isArray(data.pals) ? data.pals : [];
  } catch (error) {
    console.error('Error al cargar el catálogo de Pals:', error);
    return [];
  }
}

/** Arranca la aplicación. */
async function bootstrap() {
  const pals = await loadPals();
  const fuse = createSearchIndex(pals);

  initUI({ pals, fuse });
}

bootstrap();
