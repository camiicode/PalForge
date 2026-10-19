/**
 * Dominio de proyectos de cría.
 *
 * Toda la persistencia vive aquí. Las funciones reciben `storage` de forma
 * opcional para poder inyectar un doble en las pruebas (por defecto usan el
 * `localStorage` del navegador).
 */

export const STORAGE_KEY = 'palforge_projects_v2';

/** Probabilidad base cuando no se seleccionan pasivas (o no aplica la tabla). */
export const HATCH_CHANCE_PER_EGG = 0.1;

/** Máximo de pasivas que se pueden perseguir en un proyecto. */
export const MAX_DESIRED_PASSIVES = 4;

/**
 * Probabilidad de obtener todas las pasivas deseadas en un solo huevo.
 *
 * La tabla es una aproximación de juego: cuantas más pasivas se persiguen,
 * menos probable es que aparezcan juntas.
 */
export const PASSIVE_HATCH_CHANCES = Object.freeze({
  0: HATCH_CHANCE_PER_EGG,
  1: 0.4,
  2: 0.25,
  3: 0.12,
  4: 0.1,
});

/** Lista temporal de pasivas disponibles para los proyectos. */
export const PASSIVE_OPTIONS = Object.freeze([
  'Musclehead',
  'Ferocious',
  'Burly Body',
  'Runner',
  'Swift',
  'Serious',
  'Work Slave',
  'Artisan',
]);

/**
 * Devuelve la probabilidad base por huevo según las pasivas deseadas.
 *
 * @param {number} numberOfDesiredPassives Cantidad de pasivas seleccionadas.
 * @returns {number} Probabilidad por huevo entre 0 y 1.
 */
export function getPassiveHatchChance(numberOfDesiredPassives) {
  return (
    PASSIVE_HATCH_CHANCES[numberOfDesiredPassives] ?? HATCH_CHANCE_PER_EGG
  );
}

/**
 * Calcula la probabilidad acumulada de eclosión tras N huevos.
 *
 * Cada huevo es un intento independiente, por lo que la probabilidad de al
 * menos una eclosión es `1 - (1 - p)^n`. El resultado se expresa en porcentaje
 * y se limita a 100.
 *
 * @param {number} eggsHatched Número de huevos eclosionados.
 * @param {number} [numberOfDesiredPassives=0] Pasivas objetivo del proyecto.
 * @returns {number} Porcentaje acumulado entre 0 y 100.
 */
export function calculateCumulativeProbability(
  eggsHatched,
  numberOfDesiredPassives = 0,
) {
  if (!Number.isFinite(eggsHatched) || eggsHatched <= 0) return 0;

  const chancePerEgg = getPassiveHatchChance(numberOfDesiredPassives);
  const probability = 1 - Math.pow(1 - chancePerEgg, eggsHatched);

  return Math.min(probability * 100, 100);
}

/**
 * Genera un identificador único para un proyecto.
 *
 * `Date.now()` solo no basta: dos proyectos añadidos en el mismo milisegundo
 * compartirían id y las acciones de borrar/deshacer afectarían al equivocado.
 *
 * @returns {string}
 */
function createProjectId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

/**
 * Lee los proyectos guardados.
 *
 * @param {Storage} [storage=globalThis.localStorage] Almacenamiento a usar.
 * @returns {Array<object>} Lista de proyectos (vacía si no hay datos válidos).
 */
export function getProjects(storage = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

/**
 * Persiste la lista completa de proyectos.
 *
 * @param {Array<object>} projects
 * @param {Storage} [storage=globalThis.localStorage]
 * @returns {Array<object>} La misma lista, para encadenar llamadas.
 */
export function saveProjects(projects, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(projects));
  return projects;
}

/**
 * Añade un Pal como objetivo de cría, evitando duplicados por slug.
 *
 * @param {{ slug: string, name: string }} pal
 * @param {Storage} [storage=globalThis.localStorage]
 * @param {Array<string>} [desiredPassives=[]] Pasivas objetivo (máx. 4).
 * @returns {{ added: boolean, project?: object, projects: Array<object>, reason?: string }}
 */
export function addProject(
  pal,
  storage = globalThis.localStorage,
  desiredPassives = [],
) {
  const projects = getProjects(storage);

  if (projects.some((project) => project.targetSlug === pal.slug)) {
    return { added: false, reason: 'duplicate', projects };
  }

  const normalizedPassives = Array.isArray(desiredPassives)
    ? [...new Set(desiredPassives)].slice(0, MAX_DESIRED_PASSIVES)
    : [];

  const project = {
    id: createProjectId(),
    targetSlug: pal.slug,
    targetName: pal.name,
    eggsHatched: 0,
    desiredPassives: normalizedPassives,
  };

  const updatedProjects = [...projects, project];
  saveProjects(updatedProjects, storage);

  return { added: true, project, projects: updatedProjects };
}

/**
 * Registra un huevo eclosionado en un proyecto.
 *
 * @param {string} projectId
 * @param {Storage} [storage=globalThis.localStorage]
 * @returns {object|null} Proyecto actualizado, o `null` si el id no existe.
 */
export function addEgg(projectId, storage = globalThis.localStorage) {
  const projects = getProjects(storage);
  const index = projects.findIndex((project) => project.id === projectId);

  if (index === -1) return null;

  const updatedProject = {
    ...projects[index],
    eggsHatched: projects[index].eggsHatched + 1,
  };

  projects[index] = updatedProject;
  saveProjects(projects, storage);

  return updatedProject;
}

/**
 * Elimina un proyecto del almacenamiento.
 *
 * Devuelve el proyecto y su índice para que la UI pueda ofrecer un «Deshacer»
 * que lo restaure exactamente donde estaba.
 *
 * @param {string} projectId
 * @param {Storage} [storage=globalThis.localStorage]
 * @returns {{ project: object, index: number }|null} Datos para deshacer, o `null`.
 */
export function deleteProject(projectId, storage = globalThis.localStorage) {
  const projects = getProjects(storage);
  const index = projects.findIndex((project) => project.id === projectId);

  if (index === -1) return null;

  const [project] = projects.splice(index, 1);
  saveProjects(projects, storage);

  return { project, index };
}

/**
 * Restaura un proyecto eliminado.
 *
 * Si el proyecto ya existe no se duplica. Si el índice ya no es válido se
 * añade al final para no perder el dato.
 *
 * @param {object} project
 * @param {Storage} [storage=globalThis.localStorage]
 * @param {number|null} [index=null] Posición original devuelta por `deleteProject`.
 * @returns {Array<object>} Lista actualizada.
 */
export function restoreProject(
  project,
  storage = globalThis.localStorage,
  index = null,
) {
  const projects = getProjects(storage);

  if (projects.some((candidate) => candidate.id === project.id)) {
    return projects;
  }

  const insertionIndex =
    Number.isInteger(index) && index >= 0 && index <= projects.length
      ? index
      : projects.length;

  projects.splice(insertionIndex, 0, project);
  saveProjects(projects, storage);

  return projects;
}
