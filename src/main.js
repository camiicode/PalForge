/**
 * PalForge — Punto de entrada de la aplicación.
 *
 * Responsabilidades:
 *  - Cargar el catálogo de Pals desde `public/data.json` (servido en `/data.json`).
 *  - Construir el índice de búsqueda difusa con Fuse.js.
 *  - Gestionar el command palette, el modal de detalles y los proyectos en localStorage.
 */

import Fuse from 'fuse.js';
import './style.css';

/* ============================================================================
   Configuración
   ========================================================================== */

const DATA_URL = '/data.json';
const STORAGE_KEY = 'palforge_projects_v2';
const MAX_RESULTS = 10;
const HATCH_CHANCE_PER_EGG = 0.1;

/* ============================================================================
   Estado de la aplicación
   ========================================================================== */

let allPals = [];
let fuse = null;
let selectedIndex = -1;
let currentResults = [];

/* ============================================================================
   Referencias al DOM (clases BEM)
   ========================================================================== */

const searchInput = document.getElementById('search');
const resultsList = document.getElementById('results');
const modal = document.getElementById('modal-overlay');
const modalBody = document.getElementById('modal-body');
const projectList = document.getElementById('project-list');
const projectCount = document.getElementById('project-count');

/* ============================================================================
   Utilidades
   ========================================================================== */

/**
 * Escapa texto antes de inyectarlo con `innerHTML`.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* ============================================================================
   Carga de datos e índice de búsqueda
   ========================================================================== */

async function loadPals() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`No se pudo cargar ${DATA_URL} (${response.status})`);

    const data = await response.json();
    allPals = Array.isArray(data.pals) ? data.pals : [];
  } catch (error) {
    // Sin los datos el buscador queda inactivo, pero la UI sigue siendo usable.
    console.error('Error al cargar el catálogo de Pals:', error);
    allPals = [];
  }

  fuse = new Fuse(allPals, {
    keys: ['name', 'elements'],
    threshold: 0.4,
    distance: 100,
    includeScore: true,
  });
}

/* ============================================================================
   Búsqueda y navegación por teclado
   ========================================================================== */

/** Muestra los primeros resultados al enfocar el buscador vacío. */
searchInput.addEventListener('focus', () => {
  if (searchInput.value.trim() === '') {
    renderResults(allPals.slice(0, MAX_RESULTS));
  }
});

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  selectedIndex = -1;

  if (!query) {
    renderResults(allPals.slice(0, MAX_RESULTS));
    return;
  }

  if (fuse) {
    const matches = fuse.search(query).slice(0, MAX_RESULTS);
    renderResults(matches.map((match) => match.item));
  }
});

searchInput.addEventListener('keydown', (event) => {
  if (!resultsList.classList.contains('search__results--active')) return;

  const items = resultsList.querySelectorAll('.search__result');
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
    resultsList.classList.remove('search__results--active');
  }
});

/**
 * Resalta el resultado activo y lo mantiene visible.
 * @param {NodeListOf<Element>} items
 */
function updateSelection(items) {
  items.forEach((item, index) => {
    item.classList.toggle('search__result--selected', index === selectedIndex);
    if (index === selectedIndex) item.scrollIntoView({ block: 'nearest' });
  });
}

/**
 * Renderiza la lista de resultados del command palette.
 * @param {Array<object>} pals
 */
function renderResults(pals) {
  currentResults = pals;
  selectedIndex = pals.length > 0 ? 0 : -1;

  if (pals.length === 0) {
    resultsList.innerHTML = '<li class="search__empty">No se encontraron Pals.</li>';
    resultsList.classList.add('search__results--active');
    return;
  }

  resultsList.innerHTML = pals
    .map((pal, index) => {
      const modifier = index === 0 ? ' search__result--selected' : '';
      const tags = pal.elements
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

  resultsList.classList.add('search__results--active');

  resultsList.querySelectorAll('.search__result').forEach((item, index) => {
    item.addEventListener('click', () => openModal(pals[index]));
  });
}

// Cierra el palette al hacer clic fuera del buscador.
document.addEventListener('click', (event) => {
  if (!event.target.closest('.search')) {
    resultsList.classList.remove('search__results--active');
  }
});

/* ============================================================================
   Modal de detalles
   ========================================================================== */

/**
 * Abre el modal con la información del Pal seleccionado.
 * @param {object} pal
 */
function openModal(pal) {
  const tags = pal.elements
    .map((element) => `<span class="element-tag">${escapeHtml(element)}</span>`)
    .join('');

  modalBody.innerHTML = `
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

    <button class="button button--primary" id="btn-add-project" type="button">Añadir a Proyectos</button>
  `;

  modal.classList.remove('modal--hidden');
  searchInput.value = '';
  resultsList.classList.remove('search__results--active');

  document.getElementById('btn-add-project').addEventListener('click', () => {
    addProject(pal);
    modal.classList.add('modal--hidden');
  });
}

function closeModal() {
  modal.classList.add('modal--hidden');
}

document.getElementById('close-modal').addEventListener('click', closeModal);

// Cierra al hacer clic sobre el fondo.
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

// Cierra con Escape.
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

// Atajo Ctrl/Cmd + K para enfocar el buscador.
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
  }
});

/* ============================================================================
   Proyectos (persistidos en localStorage)
   ========================================================================== */

function getProjects() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

/**
 * Guarda los proyectos y vuelve a pintar la lista.
 * @param {Array<object>} projects
 */
function saveProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  renderProjects();
}

/**
 * Añade un Pal como objetivo de cría (sin duplicados).
 * @param {object} pal
 */
function addProject(pal) {
  const projects = getProjects();

  if (projects.some((project) => project.targetSlug === pal.slug)) {
    alert('Este Pal ya está en tus proyectos.');
    return;
  }

  projects.push({
    id: Date.now().toString(),
    targetSlug: pal.slug,
    targetName: pal.name,
    eggsHatched: 0,
  });

  saveProjects(projects);
}

/** Pinta la lista de proyectos con su probabilidad acumulada. */
function renderProjects() {
  const projects = getProjects();
  projectCount.textContent = String(projects.length);

  if (projects.length === 0) {
    projectList.innerHTML = '<li class="project-list__empty">No hay proyectos activos.</li>';
    return;
  }

  projectList.innerHTML = projects
    .map((project) => {
      const accumulated = 1 - Math.pow(1 - HATCH_CHANCE_PER_EGG, project.eggsHatched);
      const percent = Math.min(accumulated * 100, 100).toFixed(1);

      return `
        <li class="project-list__item">
          <h3 class="project-list__title">${escapeHtml(project.targetName)}</h3>
          <div class="project-list__meta">
            <span>Huevos: ${project.eggsHatched}</span>
            <span>${percent}% Prob.</span>
          </div>
          <div class="project-list__progress" role="progressbar" aria-label="Probabilidad acumulada"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
            <div class="project-list__progress-fill" style="width: ${percent}%"></div>
          </div>
          <button class="button button--add-egg" type="button" data-id="${escapeHtml(project.id)}">+ Registrar Huevo</button>
        </li>
      `;
    })
    .join('');

  projectList.querySelectorAll('.button--add-egg').forEach((button) => {
    button.addEventListener('click', () => {
      const { id } = button.dataset;
      const projects = getProjects();
      const project = projects.find((candidate) => candidate.id === id);

      if (project) {
        project.eggsHatched += 1;
        saveProjects(projects);
      }
    });
  });
}

/* ============================================================================
   Inicialización
   ========================================================================== */

async function init() {
  await loadPals();
  renderProjects();
}

init();
