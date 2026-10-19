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
  getProjects,
} from './projects.js';
import {
  hideResults,
  MAX_RESULTS,
  renderResults,
  searchPals,
} from './search.js';
import { escapeHtml } from './utils.js';

/**
 * Inicializa todos los eventos de la aplicación.
 *
 * @param {{ pals?: Array<object>, fuse: Fuse }} options
 * @returns {object|null} API interna expuesta para depuración.
 */
export function initUI({ pals = [], fuse } = {}) {
  const dom = {
    searchInput: document.getElementById('search'),
    resultsList: document.getElementById('results'),
    modal: document.getElementById('modal-overlay'),
    modalBody: document.getElementById('modal-body'),
    closeModalButton: document.getElementById('close-modal'),
    projectList: document.getElementById('project-list'),
    projectCount: document.getElementById('project-count'),
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
        const percent = calculateCumulativeProbability(
          project.eggsHatched,
        ).toFixed(1);

        return `
          <li class="project-list__item">
            <h3 class="project-list__title">${escapeHtml(project.targetName)}</h3>
            <div class="project-list__meta">
              <span>Huevos: ${project.eggsHatched}</span>
              <span>${percent}% Prob.</span>
            </div>
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
      const result = addProject(pal);

      if (!result.added && result.reason === 'duplicate') {
        alert('Este Pal ya está en tus proyectos.');
        return;
      }

      renderProjects();
      closeModal();
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
    if (!event.target.closest('.search')) hideResults(dom.resultsList);
  });

  /* ------------------------------------------------------------------------
     Atajos globales
     ---------------------------------------------------------------------- */

  dom.closeModalButton.addEventListener('click', closeModal);

  dom.modal.addEventListener('click', (event) => {
    if (event.target === dom.modal) closeModal();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dom.searchInput.focus();
    }
  });

  /* ------------------------------------------------------------------------
     Estado inicial
     ---------------------------------------------------------------------- */

  renderProjects();

  return { openModal, closeModal, renderProjects, showResults };
}
