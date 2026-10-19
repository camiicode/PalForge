/**
 * Utilidades compartidas entre módulos.
 *
 * Este archivo no toca el DOM: solo transforma valores para que sean seguros
 * al interpolarlos dentro de plantillas HTML.
 */

/**
 * Escapa texto antes de inyectarlo con `innerHTML`.
 *
 * @param {unknown} value Valor a escapar.
 * @returns {string} Texto seguro para HTML.
 */
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
