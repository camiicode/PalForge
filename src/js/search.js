/**
 * Búsqueda de Pals con Fuse.js y renderizado del listado de resultados.
 *
 * La creación del índice y la ejecución de búsquedas son independientes del
 * DOM, de modo que pueden probarse con un catálogo simulado.
 */

import Fuse from 'fuse.js';

import { escapeHtml } from './utils.js';

export const MAX_RESULTS = 10;

/** Configuración de búsqueda difusa compartida. */
export const FUSE_OPTIONS = Object.freeze({
  keys: ['name', 'elements'],
  threshold: 0.4,
  distance: 100,
  includeScore: true,
});

/**
 * Construye el índice de búsqueda.
 *
 * @param {Array<object>} pals Catálogo de Pals.
 * @returns {Fuse} Índice listo para consultar.
 */
export function createSearchIndex(pals = []) {
  return new Fuse(pals, FUSE_OPTIONS);
}

/**
 * Busca Pals por nombre o elemento.
 *
 * Con una consulta vacía devuelve los primeros Pals del catálogo, que es el
 * comportamiento del command palette al enfocar el buscador.
 *
 * @param {Fuse} fuse Índice creado con `createSearchIndex`.
 * @param {string} query Texto introducido por el usuario.
 * @param {{ pals?: Array<object>, limit?: number }} [options]
 * @returns {Array<object>} Coincidencias ordenadas por relevancia.
 */
export function searchPals(fuse, query, { pals = [], limit = MAX_RESULTS } = {}) {
  const trimmedQuery = String(query ?? '').trim();

  if (!trimmedQuery) return pals.slice(0, limit);
  if (!fuse) return [];

  return fuse
    .search(trimmedQuery)
    .slice(0, limit)
    .map((result) => result.item);
}

/**
 * Pinta los resultados y conecta el clic de cada fila.
 *
 * @param {HTMLElement} listElement Lista `<ul>` de resultados.
 * @param {Array<object>} pals Resultados a mostrar.
 * @param {(pal: object) => void} [onSelect] Callback al elegir un resultado.
 */
export function renderResults(listElement, pals, onSelect) {
  if (!listElement) return;

  if (pals.length === 0) {
    listElement.innerHTML =
      '<li class="search__empty">No se encontraron Pals.</li>';
    listElement.classList.add('search__results--active');
    return;
  }

  listElement.innerHTML = pals
    .map((pal, index) => {
      const modifier = index === 0 ? ' search__result--selected' : '';
      const tags = (pal.elements ?? [])
        .map((element) => `<span class="element-tag">${escapeHtml(element)}</span>`)
        .join('');

      return `
        <li class="search__result${modifier}" data-index="${index}">
          <span class="search__result-name">${escapeHtml(pal.name)}</span>
          <div class="search__result-elements">${tags}</div>
        </li>
      `;
    })
    .join('');

  listElement.classList.add('search__results--active');

  listElement.querySelectorAll('.search__result').forEach((item, index) => {
    item.addEventListener('click', () => onSelect?.(pals[index]));
  });
}

/**
 * Oculta el listado de resultados.
 *
 * @param {HTMLElement} listElement
 */
export function hideResults(listElement) {
  listElement?.classList.remove('search__results--active');
}
