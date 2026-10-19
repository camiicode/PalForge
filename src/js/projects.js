/**
 * Dominio de proyectos de cría.
 *
 * Toda la persistencia vive aquí. Las funciones reciben `storage` de forma
 * opcional para poder inyectar un doble en las pruebas (por defecto usan el
 * `localStorage` del navegador).
 */

export const STORAGE_KEY = 'palforge_projects_v2';
export const HATCH_CHANCE_PER_EGG = 0.1;

/**
 * Calcula la probabilidad acumulada de eclosión tras N huevos.
 *
 * Cada huevo es un intento independiente, por lo que la probabilidad de al
 * menos una eclosión es `1 - (1 - p)^n`. El resultado se expresa en porcentaje
 * y se limita a 100.
 *
 * @param {number} eggsHatched Número de huevos eclosionados.
 * @param {number} [chancePerEgg=HATCH_CHANCE_PER_EGG] Probabilidad por huevo (0-1).
 * @returns {number} Porcentaje acumulado entre 0 y 100.
 */
export function calculateCumulativeProbability(
  eggsHatched,
  chancePerEgg = HATCH_CHANCE_PER_EGG,
) {
  if (!Number.isFinite(eggsHatched) || eggsHatched <= 0) return 0;

  const probability = 1 - Math.pow(1 - chancePerEgg, eggsHatched);
  return Math.min(probability * 100, 100);
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
 * @returns {{ added: boolean, project?: object, projects: Array<object>, reason?: string }}
 */
export function addProject(pal, storage = globalThis.localStorage) {
  const projects = getProjects(storage);

  if (projects.some((project) => project.targetSlug === pal.slug)) {
    return { added: false, reason: 'duplicate', projects };
  }

  const project = {
    id: Date.now().toString(),
    targetSlug: pal.slug,
    targetName: pal.name,
    eggsHatched: 0,
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
