import { describe, expect, it } from 'vitest';

import { createSearchIndex, searchPals } from '../search.js';

/** Dataset mínimo que imita la forma de public/data.json. */
const MOCK_PALS = [
  { slug: 'charmander', name: 'Charmander', elements: ['Fire'] },
  { slug: 'squirtle', name: 'Squirtle', elements: ['Water'] },
  { slug: 'charizard', name: 'Charizard', elements: ['Fire', 'Flying'] },
  { slug: 'bulbasaur', name: 'Bulbasaur', elements: ['Grass'] },
  { slug: 'jormuntide-ignis', name: 'Jormuntide Ignis', elements: ['Dragon', 'Fire'] },
];

const fuse = createSearchIndex(MOCK_PALS);

describe('createSearchIndex', () => {
  it('inicializa un índice de Fuse con capacidad de búsqueda', () => {
    expect(fuse).toBeDefined();
    expect(typeof fuse.search).toBe('function');
    expect(Array.isArray(fuse.search('charmander'))).toBe(true);
  });
});

describe('searchPals', () => {
  it('encuentra Pals por nombre', () => {
    const names = searchPals(fuse, 'squirt').map((pal) => pal.name);

    expect(names).toEqual(['Squirtle']);
  });

  it('encuentra Pals por elemento sin distinguir mayúsculas', () => {
    const names = searchPals(fuse, 'fire').map((pal) => pal.name);

    expect(names).toContain('Charmander');
    expect(names).toContain('Charizard');
    expect(names).toContain('Jormuntide Ignis');
    expect(names).not.toContain('Squirtle');
    expect(names).not.toContain('Bulbasaur');
  });

  it('tolera errores de escritura leves', () => {
    const names = searchPals(fuse, 'charizardd').map((pal) => pal.name);

    expect(names[0]).toBe('Charizard');
  });

  it('devuelve los primeros Pals cuando la consulta está vacía', () => {
    const options = { pals: MOCK_PALS };

    expect(searchPals(fuse, '', options)).toEqual(MOCK_PALS);
    expect(searchPals(fuse, '   ', options)).toEqual(MOCK_PALS);
  });

  it('respeta el límite de resultados', () => {
    expect(searchPals(fuse, '', { pals: MOCK_PALS, limit: 2 })).toHaveLength(2);
    expect(searchPals(fuse, 'fire', { limit: 1 })).toHaveLength(1);
  });

  it('devuelve una lista vacía cuando no hay coincidencias', () => {
    expect(searchPals(fuse, 'zzzzzzzz')).toEqual([]);
  });

  it('no muta el catálogo original', () => {
    const catalog = [...MOCK_PALS];
    searchPals(fuse, 'fire');

    expect(MOCK_PALS).toEqual(catalog);
  });
});
