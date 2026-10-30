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
    const pairs = findBreedingPairs('frostallion-noct', MOCK_PALS, SPECIAL_COMBOS);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ parent1: 'Penking', parent2: 'Bushi', isSpecialCombo: true });
    expect(pairs[0].combinedRank).toBe(110);
  });

  it('devuelve un combo especial incluso si los padres no están en la lista', () => {
    const pairs = findBreedingPairs('eidrolon-ignis', MOCK_PALS, SPECIAL_COMBOS);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ parent1: 'Eidrolon', parent2: 'Blazamut', isSpecialCombo: true });
    expect(pairs[0].combinedRank).toBe(140);
  });

  it('ignora los Pals que no son crables al calcular pares', () => {
    const pairs = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS);
    expect(
      pairs.some((p) => p.parent1 === 'Astralym' || p.parent2 === 'Astralym'),
    ).toBe(false);
  });

  it('encuentra pares cuyo combi_rank resultante esté cerca del target', () => {
    // Frostplume (120) + Wumpo (80) = 100 ← exacto para Anubis (100)
    const pairs = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS, { limit: 5 });
    const bestPair = pairs[0];
    const parent1 = MOCK_PALS.find((p) => p.name === bestPair.parent1);
    const parent2 = MOCK_PALS.find((p) => p.name === bestPair.parent2);
    expect(bestPair.combinedRank).toBe(Math.floor((parent1.combi_rank + parent2.combi_rank + 1) / 2));
  });

  it('ordena los resultados por proximidad al combi_rank del target', () => {
    const pairs = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS, { limit: 10 });
    for (let i = 0; i < pairs.length - 1; i++) {
      const currentDiff = Math.abs(pairs[i].combinedRank - 100);
      const nextDiff = Math.abs(pairs[i + 1].combinedRank - 100);
      expect(currentDiff).toBeLessThanOrEqual(nextDiff);
    }
  });

  it('respeta el límite de resultados', () => {
    const pairs = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS, { limit: 3 });
    expect(pairs).toHaveLength(3);
  });

  it('devuelve un máximo de 10 resultados por defecto', () => {
    const manyPals = MOCK_PALS.filter((p) => p.breedable).concat(
      [
        { slug: 'a', name: 'A', combi_rank: 50, breedable: true },
        { slug: 'b', name: 'B', combi_rank: 60, breedable: true },
        { slug: 'c', name: 'C', combi_rank: 70, breedable: true },
        { slug: 'd', name: 'D', combi_rank: 150, breedable: true },
        { slug: 'e', name: 'E', combi_rank: 160, breedable: true },
        { slug: 'f', name: 'F', combi_rank: 170, breedable: true },
      ],
    );
    const pairs = findBreedingPairs('anubis', manyPals, SPECIAL_COMBOS);
    expect(pairs).toHaveLength(10);
  });

  it('devuelve una lista vacía cuando no hay Pals crables disponibles', () => {
    const nonBreedablePals = MOCK_PALS.filter((p) => p.breedable === false);
    const pairs = findBreedingPairs('anubis', nonBreedablePals, SPECIAL_COMBOS);
    expect(pairs).toEqual([]);
  });

  it('devuelve una lista vacía cuando el target no se encuentra', () => {
    const pairs = findBreedingPairs('pal-inexistente', MOCK_PALS, SPECIAL_COMBOS);
    expect(pairs).toEqual([]);
  });

  it('no incluye al propio target como uno de los padres', () => {
    const pairs = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS, { limit: 5 });
    expect(
      pairs.every((p) => p.parent1 !== 'Anubis' && p.parent2 !== 'Anubis'),
    ).toBe(true);
  });

  it('evita pares duplicados (orden invertido)', () => {
    const pairs = findBreedingPairs('anubis', MOCK_PALS, SPECIAL_COMBOS, { limit: 20 });
    const seen = new Set();
    for (const pair of pairs) {
      const key = [pair.parent1, pair.parent2].sort().join('+');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('calcula correctamente el combi_rank de un par', () => {
    // Penking (10) + Bushi (30) = 20
    const pairs = findBreedingPairs('dinossom', MOCK_PALS, SPECIAL_COMBOS, { limit: 5 });
    const penkingBushi = pairs.find(
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
    const pairs = findBreedingPairs('c', smallCatalog, SPECIAL_COMBOS, { limit: 5 });
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(pairs.some((p) => p.parent1 === 'A' && p.parent2 === 'B')).toBe(true);
  });

  it('si no se pasan combos especiales usa los conocidos por defecto', () => {
    const pairs = findBreedingPairs('frostallion-noct', MOCK_PALS, { limit: 5 });
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ parent1: 'Penking', parent2: 'Bushi', isSpecialCombo: true });
  });
});
