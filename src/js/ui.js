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
import { findBreedingPairs } from './breeding.js';
import { toast } from './toast.js';
import { escapeHtml } from './utils.js';

/** Número de Pals que muestra la rejilla de exploración. */
const EXPLORE_LIMIT = 12;

/** Mensajes de ayuda para instalar manualmente cuando no hay prompt nativo. */
const INSTALL_HELP = Object.freeze({
  ios:
    "Para instalar en iOS: toca el botón Compartir y selecciona 'Añadir a pantalla de inicio'.",
  desktop: 'Usa el icono de instalar en la barra de direcciones de tu navegador.',
});

/**
 * Ruta de la imagen real de un Pal, derivada de `BASE_URL` para que funcione
 * tanto en desarrollo local como en GitHub Pages (`/PalForge/pals/...`).
 */
function palImageUrl(pal, baseUrl) {
  return `${baseUrl}pals/${pal.slug}.webp`;
}

/** Fallback de placeholder por nombre de Pal. */
function placeholderFallback(name) {
  return `https://placehold.co/150x150/181d24/f0b429?text=${encodeURIComponent(name)}`;
}

/**
 * Detecta si la app corre en iOS/iPadOS (donde no existe `beforeinstallprompt`).
 *
 * @returns {boolean}
 */
function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS moderno se identifica como Mac, pero soporta touch.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Detecta si la app ya está instalada (ejecándose como PWA standalone).
 *
 * @returns {boolean}
 */
function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    navigator.standalone === true // iOS Safari
  );
}

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
    exploreSection: document.getElementById('explore'),
    exploreGrid: document.getElementById('explore-grid'),
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

  /**
   * El botón permanece visible mientras la app no esté instalada; sin evento
   * nativo (`beforeinstallprompt`) se explica cómo instalarla manualmente.
   */
  function updateInstallVisibility() {
    dom.installAction.hidden = isStandalone();
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
    // Sin evento nativo (iOS Safari, app ya instalada, navegador sin soporte):
    // se muestra ayuda para instalar manualmente.
    if (!installPrompt) {
      toast.info(isIOS() ? INSTALL_HELP.ios : INSTALL_HELP.desktop);
      return;
    }

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    // El evento sólo puede usarse una vez: se limpia tras la elección.
    installPrompt = null;

    if (outcome === 'accepted') {
      toast.success('Instalando PalForge…');
      updateInstallVisibility();
    }
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    closeSidebar();
    updateInstallVisibility();
    toast.success('PalForge instalado.');
  });

  /* ------------------------------------------------------------------------
     Rejilla de exploración (estado vacío del buscador)
     ---------------------------------------------------------------------- */

  /**
   * Pinta la rejilla "Explorar Pals" con los primeros Pals del catálogo.
   *
   * Cada tarjeta abre el mismo modal de detalles que los resultados de
   * búsqueda. Las imágenes son placeholders hasta existir arte oficial.
   */
  function renderExploreGrid() {
    const explorePals = pals.slice(0, EXPLORE_LIMIT);
    const baseUrl = import.meta.env.BASE_URL ?? '/';

    dom.exploreGrid.innerHTML = explorePals
      .map((pal) => {
        const tags = (pal.elements ?? [])
          .map((element) => `<span class="element-tag">${escapeHtml(element)}</span>`)
          .join('');
        const imageUrl = palImageUrl(pal, baseUrl);

        return `
          <button class="explore-card" type="button" aria-label="Ver detalles de ${escapeHtml(pal.name)}">
            <img class="explore-card__img" src="${imageUrl}"
              alt="imagen de ${escapeHtml(pal.name)}"
              loading="lazy"
            />
            <span class="explore-card__title">${escapeHtml(pal.name)}</span>
            <span class="explore-card__elements">${tags}</span>
          </button>
        `;
      })
      .join('');

    dom.exploreGrid.querySelectorAll('.explore-card').forEach((card, index) => {
      card.addEventListener('click', () => openModal(explorePals[index]));
    });
  }

  /** Muestra la rejilla solo sin resultados activos y con el buscador vacío. */
  function updateExploreVisibility() {
    const resultsActive =
      dom.resultsList.classList.contains('search__results--active');
    const queryEmpty = dom.searchInput.value.trim() === '';

    dom.exploreSection.hidden = resultsActive || !queryEmpty;
  }

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

      <div class="breeding-pairs">
        <button class="breeding-pairs__toggle button button--secondary"
          id="btn-breeding-pairs" type="button">
          <svg class="breeding-pairs__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          ¿Cómo lo consigo?
        </button>
        <div class="breeding-pairs__results" id="breeding-pairs-results"></div>
      </div>

      <button class="button button--primary" id="btn-add-project" type="button">
        Añadir a Proyectos
      </button>
    `;

    dom.modal.classList.remove('modal--hidden');
    dom.searchInput.value = '';
    hideResults(dom.resultsList);
    updateExploreVisibility();

    const breedingToggle = document.getElementById('btn-breeding-pairs');
    const breedingResults = document.getElementById('breeding-pairs-results');
    let breedingPairsLoaded = false;
    let currentPage = 0;

    breedingToggle.addEventListener('click', () => {
      if (!breedingPairsLoaded) {
        const { specialCombos, standardPairs, totalPairs } = findBreedingPairs(pal.slug, pals);
        const sections = renderBreedingPairsSections(specialCombos, standardPairs, {
          perPage: 10,
          page: currentPage,
          totalPairs,
        });
        breedingResults.innerHTML = sections.join('');

        breedingToggle.textContent =
          standardPairs.length > 0 || specialCombos.length > 0
            ? 'Ocultar combinaciones'
            : '¿Cómo lo consigo?';
        breedingToggle.hidden = standardPairs.length === 0 && specialCombos.length === 0;

        breedingPairsLoaded = true;
      }

      const isHidden = breedingResults.hasAttribute('hidden');
      if (isHidden) {
        breedingResults.classList.remove('hidden');
        breedingToggle.setAttribute('aria-expanded', 'true');
      } else {
        breedingResults.classList.add('hidden');
        breedingToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Manejar el botón "Ver más" (carga la siguiente página de pares)
    breedingResults.addEventListener('click', (event) => {
      const loadMoreButton = event.target.closest('.breeding-pairs__load-more');
      if (loadMoreButton) {
        // === DEBUG ===
        console.log('[breeding-debug] LOAD-MORE CLICK', {
          buttonId: loadMoreButton.id,
          targetPageRaw: loadMoreButton.id.match(/more-(\d+)/)?.[1] ?? 'unknown',
          pageFromId: parseInt(loadMoreButton.id.match(/more-(\d+)/)?.[1] ?? '0', 10) - 1,
          currentPage,
          palSlug: pal.slug,
          totalPairsFromState: loadMoreButton.dataset.totalPairs ?? 'n/a',
        });
        // =================

        // El ID del botón lleva la página 0-indexada directamente (no +1)
        // Extraer el número de página sin restar 1.
        const pageFromId = parseInt(loadMoreButton.id.match(/more-(\d+)/)?.[1] ?? '0', 10);
        currentPage = pageFromId;

        const { specialCombos, standardPairs, totalPairs: total } = findBreedingPairs(pal.slug, pals, null, {
          perPage: 10,
          page: currentPage,
        });
        console.log('[breeding-debug] findBreedingPairs result', {
          targetPage: currentPage,
          visiblePairs: standardPairs.length,
          totalPairs: total,
        });
        const sections = renderBreedingPairsSections(specialCombos, standardPairs, {
          perPage: 10,
          page: currentPage,
          totalPairs: total,
        });
        breedingResults.innerHTML = sections.join('');

        // Actualizar el texto del botón toggle a 'Ocultar combinaciones'
        breedingToggle.textContent = 'Ocultar combinaciones';
        breedingToggle.hidden = standardPairs.length === 0 && specialCombos.length === 0;
      }
    });

    document.getElementById('btn-add-project').addEventListener('click', () => {
      showPassivePicker(pal);
    });
  }

  /**
   * Renderiza las secciones de pares de cría.
   *
   * @param {Array<{parent1: string, parent2: string, combinedRank: number, isSpecialCombo: boolean}>} specialCombos
   * @param {Array<{parent1: string, parent2: string, combinedRank: number, isSpecialCombo: boolean}>} standardPairs
   * @param {object} [controls]
   * @param {boolean} [controls.showPagination=true]
   * @returns {string[]} Marcas de cada sección.
   */
  function renderBreedingPairsSections(specialCombos, standardPairs, controls = {}) {
    const showPagination = controls.showPagination !== false;
    const perPage = controls.perPage || 10;
    const page = controls.page || 0;
    const totalPairs = controls.totalPairs || standardPairs.length;
    const start = page * perPage;
    const end = start + perPage;
    const visibleStandard = standardPairs.slice(start, end);

    const parts = [];

    // Sección de combos especiales: solo se renderiza si hay alguno
    if (specialCombos.length > 0) {
      parts.push(renderBreedingPairsList(specialCombos, 'special'));
    }

    // Listado de pares por fórmula: solo visible si hay pares
    if (standardPairs.length > 0) {
      const standardList = renderBreedingPairsList(visibleStandard);
      parts.push(standardList);

      // El botón de "Ver más" aparece cuando el total de pares > perPage, no solo con los visibles
      if (showPagination && totalPairs > perPage) {
        const totalPages = Math.ceil(totalPairs / perPage);
        const isLast = page + 1 >= totalPages;
        const label = isLast
          ? 'Mostrar más combinaciones'
          : `Mostrar más combinaciones (${perPage} más)`;

        // Usar la página 0-indexada directamente en el ID (no +1)
        const loadMoreButton = `
          <div class="breeding-pairs__load-more__wrapper">
            <button class="breeding-pairs__load-more button button--secondary"
              id="btn-breeding-pairs-more-${page}" type="button">${label}</button>
          </div>
        `;
        parts.push(loadMoreButton);
      }
    }

    // Mensaje global solo si NO hay ni combos especiales NI pares por fórmula
    if (specialCombos.length === 0 && standardPairs.length === 0) {
      parts.push('<p class="breeding-pairs__empty">No se encontraron pares de cría.</p>');
    }

    return parts;
  }

  /**
   * Renderiza una lista de pares de cría.
   *
   * @param {Array<{parent1: string, parent2: string, combinedRank: number, isSpecialCombo: boolean}>} pairs
   * @param {string} [sectionClass] Clase extra del contenedor ("special" | "standard").
   * @returns {string} Marcas HTML.
   */
  function renderBreedingPairsList(pairs, sectionClass) {
    if (!pairs || pairs.length === 0) {
      return '<p class="breeding-pairs__empty">No se encontraron pares de cría.</p>';
    }

    const containerClass = sectionClass
      ? `breeding-pairs__list--${sectionClass}`
      : 'breeding-pairs__list';

    return `
      <ul class="${containerClass}" role="list">
        ${pairs
          .map(
            (pair) => `
              <li class="breeding-pair">
                <span class="breeding-pair__parents">
                  <span class="breeding-pair__parent">${escapeHtml(pair.parent1)}</span>
                  <svg class="breeding-pair__plus" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span class="breeding-pair__parent">${escapeHtml(pair.parent2)}</span>
                </span>
                <span class="breeding-pair__rank">Rango: ${pair.combinedRank}</span>
                ${pair.isSpecialCombo ? '<span class="badge badge--special">Combo Especial</span>' : ''}
              </li>
            `,
          )
          .join('')}
      </ul>
    `;
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
    updateExploreVisibility();
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
      updateExploreVisibility();
    }
  });

  // Cerrar el palette al hacer clic fuera del buscador.
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search')) {
      hideResults(dom.resultsList);
      updateExploreVisibility();
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
  renderExploreGrid();
  updateExploreVisibility();
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
