/**
 * Sistema de notificaciones flotantes.
 *
 * API:
 *   toast.success('Proyecto añadido');
 *   toast.error('No se pudo completar la acción');
 *   toast.info('Proyecto eliminado', { hasUndo: true, onUndo: restore });
 *
 * Los toasts se apilan en la esquina inferior derecha y se eliminan solos.
 * Al pasar el ratón o enfocar un toast, el temporizador se pausa.
 */

const DEFAULT_DURATION = 4500;
const UNDO_DURATION = 7000;
const MAX_VISIBLE_TOASTS = 4;

/** @type {HTMLDivElement|null} */
let toastStack = null;

/**
 * Devuelve el contenedor de toasts, creándolo si hace falta.
 *
 * @returns {HTMLDivElement}
 */
function getToastStack() {
  if (toastStack?.isConnected) return toastStack;

  toastStack = document.createElement('div');
  toastStack.className = 'toast-stack';
  document.body.append(toastStack);

  return toastStack;
}

/**
 * Anima la salida y elimina el toast del DOM.
 *
 * @param {HTMLElement} element
 */
function dismissToast(element) {
  if (!element.isConnected || element.classList.contains('toast--leaving')) {
    return;
  }

  element.classList.add('toast--leaving');

  const removeElement = () => element.remove();
  element.addEventListener('animationend', removeElement, { once: true });

  // Respaldo para cuando las animaciones están desactivadas.
  window.setTimeout(removeElement, 300);
}

/**
 * Construye y muestra un toast.
 *
 * @param {'success'|'error'|'info'} type
 * @param {string} message
 * @param {{ hasUndo?: boolean, onUndo?: (() => void)|null, duration?: number }} [options]
 * @returns {HTMLElement} El toast creado.
 */
function showToast(type, message, options = {}) {
  const {
    hasUndo = false,
    onUndo = null,
    duration = hasUndo ? UNDO_DURATION : DEFAULT_DURATION,
  } = options;

  const element = document.createElement('article');
  element.className = `toast toast--${type}`;
  element.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const messageElement = document.createElement('p');
  messageElement.className = 'toast__message';
  messageElement.textContent = message;
  element.append(messageElement);

  if (hasUndo) {
    const undoButton = document.createElement('button');
    undoButton.type = 'button';
    undoButton.className = 'toast__action';
    undoButton.textContent = 'Deshacer';
    undoButton.addEventListener('click', () => {
      try {
        onUndo?.();
      } finally {
        dismissToast(element);
      }
    });
    element.append(undoButton);
  }

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'toast__close';
  closeButton.setAttribute('aria-label', 'Cerrar notificación');
  closeButton.textContent = '\u00d7';
  closeButton.addEventListener('click', () => dismissToast(element));
  element.append(closeButton);

  const stack = getToastStack();

  // Evita que una ráfaga de acciones llene la pantalla.
  while (stack.children.length >= MAX_VISIBLE_TOASTS) {
    stack.firstElementChild?.remove();
  }

  stack.append(element);

  let timerId = window.setTimeout(() => dismissToast(element), duration);

  const pauseTimer = () => window.clearTimeout(timerId);
  const resumeTimer = () => {
    pauseTimer();
    timerId = window.setTimeout(() => dismissToast(element), duration);
  };

  element.addEventListener('mouseenter', pauseTimer);
  element.addEventListener('mouseleave', resumeTimer);
  element.addEventListener('focusin', pauseTimer);
  element.addEventListener('focusout', resumeTimer);

  return element;
}

/** API pública de notificaciones. */
export const toast = {
  /**
   * @param {string} message
   * @param {object} [options]
   */
  success: (message, options = {}) => showToast('success', message, options),

  /**
   * @param {string} message
   * @param {object} [options]
   */
  error: (message, options = {}) => showToast('error', message, options),

  /**
   * @param {string} message
   * @param {object} [options]
   */
  info: (message, options = {}) => showToast('info', message, options),
};
