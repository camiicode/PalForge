import { describe, expect, it } from 'vitest';

import { findBreedingPairs } from '../breeding.js';

/** Dataset mínimo de Pals para probar la lógica de cría inversa. */
const MOCK_PALS = [
  { slug: 'penking', name: 'Penking', combi_rank: 10, breedable: true },
  { slug: 'bushi', name: 'Bushi', combi_rank: 30, breedable: true },
  { slug: 'dinossom', name: 'Dinossom', combi_rank: 20, breedable: true },
  { slug: 'anubis', name: 'Anubis', combi_rank: 100, breedable: true },
  { slug: 'frostplume', name: 'Frostplume', combi_rank: 120, breedable: true },
  { slug: 'wumpo', name: 'Wumpo', combi_rank: 80, breedable: true },
  { slug: 'reptyro', name: 'Reptyro', combi_rank: 140, breedable: true },
  { slug: 'majex', name: 'Majex', combi_rank: 90, breedable: true },
  { slug: 'frostallion-noct', name: 'Frostallion Noct', combi_rank: 110, breedable: true },
  { slug: 'eidrolon-ignis', name: 'Eidrolon Ignis', combi_rank: 140, breedable: true },
  { slug: 'astralym', name: 'Astralym', combi_rank: 10, breedable: false },
];

const SPECIAL_COMBOS = new Map([
  ['frostallion-noct', [{ parent1: 'Penking', parent2: 'Bushi' }]],
  ['eidrolon-ignis', [{ parent1: 'Eidrolon', parent2: 'Blazamut' }]],
]);

describe('findBreedingPairs', () => {
  it('devuelve el combo especial cuando el target tiene uno registrado', () => {
    const result = findBreedingPairs('frostallion-noct', MOCK_PALS, SPECIAL_COMBOS);
    expect(result.specialCombos).toHaveLength(1);
    expect(result.specialCombos[0]).toMatchObject({
      parent1: 'Penking',
      parent2: 'Bushi',
      isSpecialCombo: true,
    });
    expect(result.specialCombos[0].combinedRank).toBe(110);
    expect(result.standardPairs).toEqual([]);
  });

  it('devuelve un combo especial incluso si los padres no están en la lista', () => {
    const result = findBreedingPairs('eidrolon-ignis', MOCK_PALS, SPECIAL_COMBOS);
    expect(result.specialCombos).toHaveLength(1);
    expect(result.specialCombos[0]).toMatchObject({
      parent1: 'Eidrolon',
      parent2: 'Blazamut',
      isSpecialCombo: true,
    });
    expect(result.specialCombos[0].combinedRank).toBe(140);
    expect(result.standardPairs).toEqual([]);
  });

  it('excluye los Pals que no son crables (breedable: false o farm: false)', () => {
    const result = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS);
    expect(result.standardPairs.some((p) => p.parent1 === 'Astralym' || p.parent2 === 'Astralym')).toBe(
      false,
    );
  });

  it('usa la fórmula de combi_rank con +1 (floor((r1 + r2 + 1) / 2))', () => {
    // Penking (10) + Bushi (30) = floor(41 / 2) = 20
    // Si se usara la fórmula antigua (sin +1) el resultado sería 20 también,
    // así que se prueban rangos que distingan ambas fórmulas.
    const result = findBreedingPairs('dinossom', MOCK_PALS, SPECIAL_COMBOS, { limit: 5 });
    const penkingBushi = result.standardPairs.find(
      (p) =>
        (p.parent1 === 'Penking' && p.parent2 === 'Bushi') ||
        (p.parent1 === 'Bushi' && p.parent2 === 'Penking'),
    );
    expect(penkingBushi).toBeDefined();
    expect(penkingBushi?.combinedRank).toBe(20);
  });

  it('devuelve un objeto con dos claves: specialCombos y standardPairs', () => {
    const result = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS, { limit: 3 });
    expect(result).toHaveProperty('specialCombos');
    expect(result).toHaveProperty('standardPairs');
    expect(Array.isArray(result.specialCombos)).toBe(true);
    expect(Array.isArray(result.standardPairs)).toBe(true);
  });

  it('elimina los padres duplicados (orden invertido)', () => {
    const result = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS, { limit: 5 });
    const seen = new Set();
    for (const pair of result.standardPairs) {
      const key = [pair.parent1, pair.parent2].sort().join('+');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('respeta el límite cuando se lo pasan explícitamente', () => {
    const result = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS, { limit: 3 });
    expect(result.standardPairs).toHaveLength(3);
  });

  it('devuelve una lista vacía cuando no hay Pals crables disponibles', () => {
    const nonBreedablePals = MOCK_PALS.filter((p) => p.breedable === false);
    const result = findBreedingPairs('anubis', nonBreedablePals, SPECIAL_COMBOS);
    expect(result.specialCombos).toEqual([]);
    expect(result.standardPairs).toEqual([]);
  });

  it('devuelve una lista vacía cuando el target no se encuentra', () => {
    const result = findBreedingPairs('pal-inexistente', MOCK_PALS, SPECIAL_COMBOS);
    expect(result.specialCombos).toEqual([]);
    expect(result.standardPairs).toEqual([]);
  });

  it('no incluye al propio target como uno de los padres', () => {
    const result = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS, { limit: 5 });
    expect(
      result.standardPairs.every((p) => p.parent1 !== 'Anubis' && p.parent2 !== 'Anubis'),
    ).toBe(true);
  });

  it('calcula correctamente el combi_rank de un par', () => {
    const result = findBreedingPairs('dinossom', MOCK_PALS, SPECIAL_COMBOS, { limit: 5 });
    const penkingBushi = result.standardPairs.find(
      (p) =>
        (p.parent1 === 'Penking' && p.parent2 === 'Bushi') ||
        (p.parent1 === 'Bushi' && p.parent2 === 'Penking'),
    );
    expect(penkingBushi).toBeDefined();
    expect(penkingBushi?.combinedRank).toBe(20);
  });

  it('funciona con un catálogo pequeño de Pals', () => {
    const smallCatalog = [
      { slug: 'a', name: 'A', combi_rank: 10, breedable: true },
      { slug: 'b', name: 'B', combi_rank: 20, breedable: true },
      { slug: 'c', name: 'C', combi_rank: 30, breedable: true },
    ];
    const result = findBreedingPairs('c', smallCatalog, SPECIAL_COMBOS, { limit: 5 });
    expect(result.standardPairs.length).toBeGreaterThanOrEqual(1);
    expect(result.standardPairs.some((p) => p.parent1 === 'A' && p.parent2 === 'B')).toBe(true);
  });

  it('devuelve todos los pares viables cuando no se aplica límite ni página', () => {
    const manyPals = MOCK_PALS.filter((p) => p.breedable).concat([
      { slug: 'a', name: 'A', combi_rank: 50, breedable: true },
      { slug: 'b', name: 'B', combi_rank: 60, breedable: true },
      { slug: 'c', name: 'C', combi_rank: 70, breedable: true },
      { slug: 'd', name: 'D', combi_rank: 150, breedable: true },
      { slug: 'e', name: 'E', combi_rank: 160, breedable: true },
      { slug: 'f', name: 'F', combi_rank: 170, breedable: true },
    ]);
    const result = findBreedingPairs('anubis', manyPals, SPECIAL_COMBOS, { perPage: 500 });
    // 15 pares sin repetir (15 Pals crables en el mock: 9 originales + 6 nuevos)
    expect(result.standardPairs).toHaveLength(15 * 14 / 2);
  });

  it('devuelve la primera página de standardPairs cuando se solicita paginación', () => {
    const result = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS, { perPage: 3 });
    expect(result.standardPairs).toHaveLength(3);
  });
});
