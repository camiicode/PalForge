import { beforeEach, describe, expect, it } from 'vitest';

import {
  HATCH_CHANCE_PER_EGG,
  addEgg,
  addProject,
  calculateCumulativeProbability,
  deleteProject,
  getProjects,
  restoreProject,
  saveProjects,
} from '../projects.js';

/**
 * Implementación mínima de Storage en memoria.
 * Se inyecta para probar la lógica sin depender de un navegador real.
 */
function createMemoryStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

const CHARMANDER = { slug: 'charmander', name: 'Charmander' };
const SQUIRTLE = { slug: 'squirtle', name: 'Squirtle' };

describe('calculateCumulativeProbability', () => {
  it('devuelve 0 cuando no se han eclosionado huevos', () => {
    expect(calculateCumulativeProbability(0)).toBe(0);
  });

  it('aplica la probabilidad base al primer huevo', () => {
    expect(calculateCumulativeProbability(1)).toBeCloseTo(
      HATCH_CHANCE_PER_EGG * 100,
      10,
    );
  });

  it('acumula la probabilidad de forma independiente por huevo', () => {
    // 1 - 0.9^2 = 0.19 -> 19%
    expect(calculateCumulativeProbability(2)).toBeCloseTo(19, 10);
    // 1 - 0.9^10 = 0.6513215599 -> 65.132%
    expect(calculateCumulativeProbability(10)).toBeCloseTo(65.13215599, 6);
  });

  it('nunca supera el 100%', () => {
    expect(calculateCumulativeProbability(10_000)).toBeLessThanOrEqual(100);
    expect(calculateCumulativeProbability(10_000)).toBeGreaterThan(99.9);
  });

  it.each([
    [1, 40],
    [2, 25],
    [3, 12],
    [4, 10],
  ])(
    'usa %i pasiva(s) deseadas con una probabilidad base del %i%%',
    (passiveCount, expectedPercent) => {
      expect(calculateCumulativeProbability(1, passiveCount)).toBeCloseTo(
        expectedPercent,
        10,
      );
    },
  );

  it('usa el 10% por defecto cuando no hay pasivas seleccionadas', () => {
    expect(calculateCumulativeProbability(1, 0)).toBeCloseTo(10, 10);
    expect(calculateCumulativeProbability(1)).toBeCloseTo(10, 10);
  });

  it('usa el 10% para recuentos de pasivas fuera de la tabla', () => {
    expect(calculateCumulativeProbability(1, 5)).toBeCloseTo(10, 10);
    expect(calculateCumulativeProbability(1, 3.5)).toBeCloseTo(10, 10);
  });

  it('acumula la probabilidad de 2 pasivas en varios huevos', () => {
    // 1 - 0.75^2 = 0.4375 -> 43.75%
    expect(calculateCumulativeProbability(2, 2)).toBeCloseTo(43.75, 10);
  });

  it('devuelve 0 para entradas inválidas o negativas', () => {
    expect(calculateCumulativeProbability(-3)).toBe(0);
    expect(calculateCumulativeProbability(Number.NaN)).toBe(0);
    expect(calculateCumulativeProbability(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('project storage', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('devuelve una lista vacía si no hay datos guardados', () => {
    expect(getProjects(storage)).toEqual([]);
  });

  it('ignora JSON corrupto o con una forma inesperada', () => {
    storage.setItem('palforge_projects_v2', '{no-es-json');
    expect(getProjects(storage)).toEqual([]);

    storage.setItem('palforge_projects_v2', '{"not":"an-array"}');
    expect(getProjects(storage)).toEqual([]);
  });

  it('persiste y recupera proyectos', () => {
    const projects = [
      { id: '1', targetSlug: 'charmander', targetName: 'Charmander', eggsHatched: 2 },
    ];

    saveProjects(projects, storage);

    expect(getProjects(storage)).toEqual(projects);
  });
});

describe('addProject', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('añade un Pal con cero huevos y lo persiste', () => {
    const result = addProject(CHARMANDER, storage);

    expect(result.added).toBe(true);
    expect(result.project).toMatchObject({
      targetSlug: 'charmander',
      targetName: 'Charmander',
      eggsHatched: 0,
    });
    expect(result.project.id).toEqual(expect.any(String));
    expect(result.project.desiredPassives).toEqual([]);
    expect(getProjects(storage)).toHaveLength(1);
  });

  it('guarda las pasivas deseadas seleccionadas', () => {
    const desiredPassives = ['Musclehead', 'Ferocious'];

    const result = addProject(CHARMANDER, storage, desiredPassives);

    expect(result.project.desiredPassives).toEqual(desiredPassives);
    expect(getProjects(storage)[0].desiredPassives).toEqual(desiredPassives);
  });

  it('limita a 4 pasivas y elimina duplicados', () => {
    const result = addProject(CHARMANDER, storage, [
      'A',
      'A',
      'B',
      'C',
      'D',
      'E',
    ]);

    expect(result.project.desiredPassives).toEqual(['A', 'B', 'C', 'D']);
  });

  it('rechaza duplicados sin modificar el almacenamiento', () => {
    addProject(CHARMANDER, storage);
    const result = addProject(CHARMANDER, storage);

    expect(result.added).toBe(false);
    expect(result.reason).toBe('duplicate');
    expect(getProjects(storage)).toHaveLength(1);
  });

  it('permite añadir Pals distintos', () => {
    addProject(CHARMANDER, storage);
    addProject(SQUIRTLE, storage);

    expect(getProjects(storage).map((project) => project.targetSlug)).toEqual([
      'charmander',
      'squirtle',
    ]);
  });
});

describe('addEgg', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('incrementa el contador del proyecto indicado y lo persiste', () => {
    const { project } = addProject(CHARMANDER, storage);

    const updated = addEgg(project.id, storage);

    expect(updated.eggsHatched).toBe(1);
    expect(getProjects(storage)[0].eggsHatched).toBe(1);

    addEgg(project.id, storage);
    expect(getProjects(storage)[0].eggsHatched).toBe(2);
  });

  it('conserva las pasivas deseadas al registrar huevos', () => {
    const { project } = addProject(CHARMANDER, storage, ['Musclehead']);

    const updated = addEgg(project.id, storage);

    expect(updated.desiredPassives).toEqual(['Musclehead']);
    expect(getProjects(storage)[0].desiredPassives).toEqual(['Musclehead']);
  });

  it('no afecta a otros proyectos', () => {
    const first = addProject(CHARMANDER, storage).project;
    const second = addProject(SQUIRTLE, storage).project;

    addEgg(first.id, storage);

    const projects = getProjects(storage);
    expect(projects[0].eggsHatched).toBe(1);
    expect(projects[1].eggsHatched).toBe(0);
    expect(projects[1].id).toBe(second.id);
  });

  it('devuelve null y no modifica el almacenamiento si el id no existe', () => {
    addProject(CHARMANDER, storage);
    const before = getProjects(storage);

    expect(addEgg('missing-id', storage)).toBeNull();
    expect(getProjects(storage)).toEqual(before);
  });
});

describe('deleteProject and restoreProject', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('elimina un proyecto del almacenamiento y devuelve su posición', () => {
    const first = addProject(CHARMANDER, storage).project;
    const second = addProject(SQUIRTLE, storage).project;

    const deleted = deleteProject(first.id, storage);

    expect(deleted).toEqual({ project: first, index: 0 });
    expect(getProjects(storage)).toHaveLength(1);
    expect(getProjects(storage)[0].id).toBe(second.id);
  });

  it('devuelve null y no modifica el almacenamiento si el id no existe', () => {
    addProject(CHARMANDER, storage);
    const before = getProjects(storage);

    expect(deleteProject('missing-id', storage)).toBeNull();
    expect(getProjects(storage)).toEqual(before);
  });

  it('restaura un proyecto eliminado en su posición original', () => {
    const first = addProject(CHARMANDER, storage, ['Musclehead']).project;
    const second = addProject(SQUIRTLE, storage).project;

    const deleted = deleteProject(second.id, storage);
    restoreProject(deleted.project, storage, deleted.index);

    const restored = getProjects(storage);

    expect(restored.map((project) => project.targetSlug)).toEqual([
      'charmander',
      'squirtle',
    ]);
    expect(restored[1]).toEqual(second);
    expect(first.desiredPassives).toEqual(['Musclehead']);
  });

  it('no duplica un proyecto que ya está en la lista', () => {
    const project = addProject(CHARMANDER, storage).project;

    restoreProject(project, storage);

    expect(getProjects(storage)).toHaveLength(1);
  });

  it('añade al final cuando el índice guardado no es válido', () => {
    const first = addProject(CHARMANDER, storage).project;
    const deleted = deleteProject(first.id, storage);
    addProject(SQUIRTLE, storage);

    restoreProject(deleted.project, storage, 99);

    expect(getProjects(storage)).toHaveLength(2);
    expect(getProjects(storage)[1].targetSlug).toBe('charmander');
  });
});
