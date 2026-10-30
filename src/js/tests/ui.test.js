import { describe, expect, it } from 'vitest';

import { renderBreedingPairsSections } from '../ui.js';

/** Mock DOM helpers para `initUI` (solo se necesita `renderBreedingPairsSections`). */
const mockPals = [
  { slug: 'p1', name: 'P1', combi_rank: 100, breedable: true },
  { slug: 'p2', name: 'P2', combi_rank: 200, breedable: true },
  { slug: 'p3', name: 'P3', combi_rank: 300, breedable: true },
  { slug: 'p4', name: 'P4', combi_rank: 400, breedable: true },
  { slug: 'p5', name: 'P5', combi_rank: 500, breedable: true },
];

/** Pares reales de un mock de 6 Pals crables (excluyendo el target). */
const generatePairs = (targetSlug) => {
  const parents = mockPals.filter((p) => p.slug !== targetSlug);
  const pairs = [];
  for (let i = 0; i < parents.length; i++) {
    for (let j = i + 1; j < parents.length; j++) {
      pairs.push({ parent1: parents[i].name, parent2: parents[j].name });
    }
  }
  return pairs;
};

describe('renderBreedingPairsSections (UI pagination)', () => {
  it('genera el botón "Ver más" cuando hay más pares de los visibles', () => {
    const specialCombos = [];
    // 7 Pals = 21 pares sin repetir (7*6/2). Con perPage=10, sobran 11.
    const mockCatalog = [
      { slug: 'p1', name: 'P1', combi_rank: 100, breedable: true },
      { slug: 'p2', name: 'P2', combi_rank: 200, breedable: true },
      { slug: 'p3', name: 'P3', combi_rank: 300, breedable: true },
      { slug: 'p4', name: 'P4', combi_rank: 400, breedable: true },
      { slug: 'p5', name: 'P5', combi_rank: 500, breedable: true },
      { slug: 'p6', name: 'P6', combi_rank: 600, breedable: true },
      { slug: 'p7', name: 'P7', combi_rank: 700, breedable: true },
    ];
    const parents = mockCatalog.filter(p => p.slug !== 'p1');
    const standardPairs = [];
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        standardPairs.push({
          parent1: parents[i].name,
          parent2: parents[j].name,
          combinedRank: Math.floor((parents[i].combi_rank + parents[j].combi_rank + 1) / 2),
          isSpecialCombo: false,
        });
      }
    }
    // 6 padres = 15 pares => 15 > 10 => el botón debe aparecer
    expect(standardPairs.length).toBeGreaterThan(10);
    const sections = renderBreedingPairsSections(specialCombos, standardPairs, {
      perPage: 10,
      page: 0,
      totalPairs: standardPairs.length,
    });
    const html = sections.join('');
    expect(html).toMatch(/id="btn-breeding-pairs-more-1"/);
  });

  it('no genera botón cuando el total de pares <= perPage', () => {
    const specialCombos = [];
    const standardPairs = [
      { parent1: 'A', parent2: 'B' },
      { parent1: 'C', parent2: 'D' },
    ];
    const sections = renderBreedingPairsSections(specialCombos, standardPairs, {
      perPage: 10,
      page: 0,
      totalPairs: standardPairs.length,
    });
    const html = sections.join('');
    expect(html).not.toContain('btn-breeding-pairs-more');
  });

  it('oculta la sección de combos especiales cuando no hay', () => {
    const specialCombos = [];
    const standardPairs = [{ parent1: 'A', parent2: 'B' }];
    const sections = renderBreedingPairsSections(specialCombos, standardPairs, {
      perPage: 10,
      page: 0,
      totalPairs: standardPairs.length,
    });
    const html = sections.join('');
    expect(html).not.toContain('special');
  });

  it('renderiza la sección de combos especiales cuando los hay', () => {
    const specialCombos = [
      { parent1: 'Penking', parent2: 'Bushi', combinedRank: 20, isSpecialCombo: true },
    ];
    const standardPairs = [];
    const sections = renderBreedingPairsSections(specialCombos, standardPairs, {
      perPage: 10,
      page: 0,
      totalPairs: 0,
    });
    const html = sections.join('');
    expect(html).toContain('special');
  });

  it('muestra el mensaje vacío solo cuando no hay ni combos ni pares', () => {
    const specialCombos = [];
    const standardPairs = [];
    const sections = renderBreedingPairsSections(specialCombos, standardPairs, {
      perPage: 10,
      page: 0,
      totalPairs: 0,
    });
    const html = sections.join('');
    expect(html).toContain('No se encontraron pares de cría');
  });
});
