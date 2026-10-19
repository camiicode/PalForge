/**
 * Capa de interfaz: eventos del DOM, modal de detalles y render de proyectos.
 *
 * Toda la lógica de datos se delega en `projects.js` y `search.js`; aquí solo
 * se traduce el estado a la vista.
 */

import {
  addEgg,
  addProject,
  calculateCumulativeProbability,
  deleteProject,
  getProjects,
  MAX_DESIRED_PASSIVES,
  PASSIVE_OPTIONS,
  restoreProject,
} from './projects.js';
import {
  hideResults,
  MAX_RESULTS,
  renderResults,
  searchPals,
} from './search.js';
import { toast } from './toast.js';
import { escapeHtml } from './utils.js';

/**
 * Pinta las pasivas objetivo de un proyecto.
 *
 * @param {Array<string>} passives
 * @returns {string} Markup de la lista, o cadena vacía si no hay pasivas.
 */
function renderPassiveTags(passives) {
  if (!Array.isArray(passives) || passives.length === 0) return '';

  return `
    <ul class="project-list__passives" aria-label="Pasivas objetivo">
      ${passives
        .map((passive) => `<li class="passive-tag">${escapeHtml(passive)}</li>`)
        .join('')}
    </ul>
  `;
}

/**
 * Inicializa todos los eventos de la aplicación.
 *
 * @param {{ pals?: Array<object>, fuse: Fuse, gameVersion?: string|null }} options
 * @returns {object} API interna expuesta para depuración.
 */
export function initUI({ pals = [], fuse, gameVersion = null } = {}) {
  const dom = {
    searchInput: document.getElementById('search'),
    resultsList: document.getElementById('results'),
    modal: document.getElementById('modal-overlay'),
    modalBody: document.getElementById('modal-body'),
    closeModalButton: document.getElementById('close-modal'),
    projectList: document.getElementById('project-list'),
    projectCount: document.getElementById('project-count'),
    gameVersion: document.getElementById('game-version'),
    menuToggle: document.getElementById('menu-toggle'),
    sidebar: document.getElementById('sidebar'),
    backdrop: document.getElementById('app-backdrop'),
    installAction: document.getElementById('install-app'),
    installButton: document.getElementById('install-app-btn'),
  };

  const missingElements = Object.entries(dom)
    .filter(([, element]) => !element)
    .map(([name]) => name);

  if (missingElements.length > 0) {
    throw new Error(
      `Faltan elementos del DOM para inicializar la interfaz: ${missingElements.join(', ')}`,
    );
  }

  let currentResults = [];
  let selectedIndex = -1;

  // Evento `beforeinstallprompt` retenido hasta que el usuario pide instalar.
  let installPrompt = null;

  /* ------------------------------------------------------------------------
     Cajón lateral (móvil)
     ---------------------------------------------------------------------- */

  function openSidebar() {
    dom.sidebar.classList.add('sidebar--open');
    dom.menuToggle.setAttribute('aria-expanded', 'true');
    dom.backdrop.hidden = false;
    dom.backdrop.classList.add('app-backdrop--visible');
  }

  function closeSidebar() {
    dom.sidebar.classList.remove('sidebar--open');
    dom.menuToggle.setAttribute('aria-expanded', 'false');
    dom.backdrop.classList.remove('app-backdrop--visible');
    dom.backdrop.hidden = true;
  }

  dom.menuToggle.addEventListener('click', () => {
    const isOpen = dom.sidebar.classList.contains('sidebar--open');

    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  dom.backdrop.addEventListener('click', closeSidebar);

  /* ------------------------------------------------------------------------
     Instalación como PWA
     ---------------------------------------------------------------------- */

  /** El botón sólo se muestra si el navegador ofreció instalar y no hay resultados. */
  function updateInstallVisibility() {
    const resultsActive =
      dom.resultsList.classList.contains('search__results--active');

    dom.installAction.hidden = !(installPrompt && !resultsActive);
  }

  /**
   * Muestra el botón de instalación con el evento retenido por `main.js`.
   *
   * @param {Event} promptEvent Evento `beforeinstallprompt`.
   */
  function showInstallButton(promptEvent) {
    installPrompt = promptEvent;
    updateInstallVisibility();
  }

  /** Oculta el botón de instalación (app ya instalada o prompt descartado). */
  function hideInstallButton() {
    installPrompt = null;
    updateInstallVisibility();
  }

  dom.installButton.addEventListener('click', async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    // El evento sólo puede usarse una vez: se limpia tras la elección.
    installPrompt = null;

    if (outcome === 'accepted') {
      toast.success('Instalando PalForge…');
    }

    updateInstallVisibility();
  });

  window.addEventListener('appinstalled', () => {
    hideInstallButton();
    closeSidebar();
    toast.success('PalForge instalado.');
  });

  /* ------------------------------------------------------------------------
     Proyectos
     ---------------------------------------------------------------------- */

  function renderProjects() {
    const projects = getProjects();
    dom.projectCount.textContent = String(projects.length);

    if (projects.length === 0) {
      dom.projectList.innerHTML =
        '<li class="project-list__empty">No hay proyectos activos.</li>';
      return;
    }

    dom.projectList.innerHTML = projects
      .map((project) => {
        const desiredPassives = Array.isArray(project.desiredPassives)
          ? project.desiredPassives
          : [];
        const percent = calculateCumulativeProbability(
          project.eggsHatched,
          desiredPassives.length,
        ).toFixed(1);

        return `
          <li class="project-list__item">
            <div class="project-list__header">
              <h3 class="project-list__title">${escapeHtml(project.targetName)}</h3>
              <button class="project-list__delete-btn" type="button"
                data-id="${escapeHtml(project.id)}"
                aria-label="Eliminar proyecto ${escapeHtml(project.targetName)}"
                title="Eliminar proyecto">🗑️</button>
            </div>
            <div class="project-list__meta">
              <span>Huevos: ${project.eggsHatched}</span>
              <span>${percent}% Prob.</span>
            </div>
            ${renderPassiveTags(desiredPassives)}
            <div class="project-list__progress" role="progressbar"
              aria-label="Probabilidad acumulada" aria-valuemin="0"
              aria-valuemax="100" aria-valuenow="${percent}">
              <div class="project-list__progress-fill" style="width: ${percent}%"></div>
            </div>
            <button class="button button--add-egg" type="button"
              data-id="${escapeHtml(project.id)}">+ Registrar Huevo</button>
          </li>
        `;
      })
      .join('');

    dom.projectList.querySelectorAll('.button--add-egg').forEach((button) => {
      button.addEventListener('click', () => {
        addEgg(button.dataset.id);
        renderProjects();
      });
    });

    dom.projectList
      .querySelectorAll('.project-list__delete-btn')
      .forEach((button) => {
        button.addEventListener('click', () =>
          deleteProjectWithUndo(button.dataset.id),
        );
      });
  }

  /**
   * Elimina un proyecto y ofrece restaurarlo desde el toast.
   *
   * @param {string} projectId
   */
  function deleteProjectWithUndo(projectId) {
    const deleted = deleteProject(projectId);

    if (!deleted) {
      toast.error('No se pudo eliminar el proyecto.');
      return;
    }

    renderProjects();

    toast.info('Proyecto eliminado', {
      hasUndo: true,
      onUndo: () => {
        restoreProject(
          deleted.project,
          globalThis.localStorage,
          deleted.index,
        );
        renderProjects();
        toast.success('Proyecto restaurado');
      },
    });
  }

  /* ------------------------------------------------------------------------
     Modal
     ---------------------------------------------------------------------- */

  function openModal(pal) {
    const tags = (pal.elements ?? [])
      .map((element) => `<span class="element-tag">${escapeHtml(element)}</span>`)
      .join('');

    dom.modalBody.innerHTML = `
      <header class="modal__header">
        <h2 id="modal-title" class="modal__title">${escapeHtml(pal.name)}</h2>
        <div class="modal__elements">${tags}</div>
      </header>

      <div class="modal__stats">
        <div class="stat">
          <div class="stat__label">Rango de Cría</div>
          <div class="stat__value">${escapeHtml(pal.combi_rank)}</div>
        </div>
        <div class="stat">
          <div class="stat__label">Apto para Granja</div>
          <div class="stat__value">${pal.breeding_farm_eligible ? 'Sí' : 'No'}</div>
        </div>
      </div>

      <button class="button button--primary" id="btn-add-project" type="button">
        Añadir a Proyectos
      </button>
    `;

    dom.modal.classList.remove('modal--hidden');
    dom.searchInput.value = '';
    hideResults(dom.resultsList);

    document.getElementById('btn-add-project').addEventListener('click', () => {
      showPassivePicker(pal);
    });
  }

  /**
   * Sustituye el detalle del modal por el selector de pasivas objetivo.
   *
   * @param {object} pal
   */
  function showPassivePicker(pal) {
    const options = PASSIVE_OPTIONS.map(
      (passive) => `
        <li class="passive-picker__item">
          <label class="passive-picker__option">
            <input class="passive-picker__checkbox" type="checkbox"
              name="passives" value="${escapeHtml(passive)}" />
            <span class="passive-picker__name">${escapeHtml(passive)}</span>
          </label>
        </li>`,
    ).join('');

    dom.modalBody.innerHTML = `
      <header class="modal__header">
        <h2 id="modal-title" class="modal__title">${escapeHtml(pal.name)}</h2>
        <p class="modal__subtitle">Elige hasta ${MAX_DESIRED_PASSIVES} pasivas objetivo.</p>
      </header>

      <form class="passive-picker" id="passive-form">
        <fieldset class="passive-picker__fieldset">
          <legend class="passive-picker__legend">Pasivas objetivo</legend>
          <ul class="passive-picker__list">${options}</ul>
        </fieldset>

        <p class="passive-picker__hint" id="passive-count" aria-live="polite">
          0 de ${MAX_DESIRED_PASSIVES} pasivas seleccionadas
        </p>

        <div class="passive-picker__actions">
          <button class="button button--secondary" id="cancel-passives" type="button">
            Volver
          </button>
          <button class="button button--primary" type="submit">Crear proyecto</button>
        </div>
      </form>
    `;

    const form = document.getElementById('passive-form');
    const checkboxes = [...form.querySelectorAll('.passive-picker__checkbox')];
    const hint = document.getElementById('passive-count');

    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const selectedCount = checkboxes.filter((item) => item.checked).length;

        checkboxes.forEach((item) => {
          item.disabled = !item.checked && selectedCount >= MAX_DESIRED_PASSIVES;
        });

        hint.textContent = `${selectedCount} de ${MAX_DESIRED_PASSIVES} pasivas seleccionadas`;
      });
    });

    document
      .getElementById('cancel-passives')
      .addEventListener('click', () => openModal(pal));

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const desiredPassives = checkboxes
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value);

      const result = addProject(pal, globalThis.localStorage, desiredPassives);

      if (!result.added) {
        toast.error(
          result.reason === 'duplicate'
            ? 'Este Pal ya está en tus proyectos.'
            : 'No se pudo añadir el proyecto.',
        );
        return;
      }

      renderProjects();
      closeModal();
      toast.success(`${pal.name} añadido a tus proyectos.`);
    });
  }

  function closeModal() {
    dom.modal.classList.add('modal--hidden');
  }

  /* ------------------------------------------------------------------------
     Resultados de búsqueda
     ---------------------------------------------------------------------- */

  function showResults(results) {
    currentResults = results;
    selectedIndex = results.length > 0 ? 0 : -1;
    renderResults(dom.resultsList, results, openModal);
    updateInstallVisibility();
  }

  function updateSelection(items) {
    items.forEach((item, index) => {
      item.classList.toggle('search__result--selected', index === selectedIndex);

      if (index === selectedIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  dom.searchInput.addEventListener('focus', () => {
    if (dom.searchInput.value.trim() === '') {
      showResults(pals.slice(0, MAX_RESULTS));
    }
  });

  dom.searchInput.addEventListener('input', () => {
    const query = dom.searchInput.value.trim();

    if (!query) {
      showResults(pals.slice(0, MAX_RESULTS));
      return;
    }

    showResults(searchPals(fuse, query, { pals, limit: MAX_RESULTS }));
  });

  dom.searchInput.addEventListener('keydown', (event) => {
    if (!dom.resultsList.classList.contains('search__results--active')) return;

    const items = dom.resultsList.querySelectorAll('.search__result');
    if (items.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateSelection(items);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateSelection(items);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const pal = currentResults[selectedIndex] ?? currentResults[0];
      if (pal) openModal(pal);
    } else if (event.key === 'Escape') {
      hideResults(dom.resultsList);
    }
  });

  // Cerrar el palette al hacer clic fuera del buscador.
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search')) {
      hideResults(dom.resultsList);
      updateInstallVisibility();
    }
  });

  /* ------------------------------------------------------------------------
     Atajos globales
     ---------------------------------------------------------------------- */

  dom.closeModalButton.addEventListener('click', closeModal);

  dom.modal.addEventListener('click', (event) => {
    if (event.target === dom.modal) closeModal();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      closeSidebar();
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dom.searchInput.focus();
    }
  });

  /* ------------------------------------------------------------------------
     Estado inicial
     ---------------------------------------------------------------------- */

  dom.gameVersion.textContent = gameVersion ? `v${gameVersion}` : '—';
  renderProjects();
  updateInstallVisibility();

  return {
    openModal,
    closeModal,
    renderProjects,
    showResults,
    openSidebar,
    closeSidebar,
    showInstallButton,
    hideInstallButton,
  };
}
