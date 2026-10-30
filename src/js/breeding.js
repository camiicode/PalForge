/**
 * Lógica de cría inversa (Reverse Breeding Lookup).
 *
 * Responde a la pregunta: "¿Qué dos Pals necesito para obtener un Pal objetivo?"
 *
 * Algoritmo:
 *  1. Verifica si el Pal objetivo tiene un combo especial registrado
 *     (proviene de data.json o de una lista hardcodeada de casos importantes).
 *  2. Si no existe combo especial, calcula el combi_rank resultante para todos
 *     los pares posibles de Pals crables y selecciona los que se aproximan más
 *     al combi_rank del objetivo.
 *
 * Fórmula de combi_rank resultante del juego:
 *   floor((rank1 + rank2 + 1) / 2)
 */

/**
 * Palabras clave de combos especiales importantes del juego.
 * En el futuro estos datos vendrán de data.json cuando la estructura lo incluya.
 */
const KNOWN_SPECIAL_COMBOS = new Map([
  // Frostallion Noct requiere Penking + Bushi
  ['frostallion-noct', [{ parent1: 'Penking', parent2: 'Bushi' }]],
  // Eidrolon Ignis requiere Eidrolon + Blazamut
  ['eidrolon-ignis', [{ parent1: 'Eidrolon', parent2: 'Blazamut' }]],
]);

/**
 * Calcula el combi_rank resultante de un par de Pals.
 *
 * @param {number} rank1
 * @param {number} rank2
 * @returns {number}
 */
export function calculatePairRank(rank1, rank2) {
  return Math.floor((rank1 + rank2 + 1) / 2);
}

/**
 * Busca los pares de Pals que pueden producir el Pal objetivo.
 *
 * @param {string} targetPalSlug - Slug del Pal que se quiere obtener.
 * @param {Array<object>} allPals - Catálogo completo de Pals.
 * @param {Map<string, Array<{parent1: string, parent2: string}>>|null} specialCombos -
 *        Combo especiales registrados por slug de Pal. Puede ser null/undefined.
 * @param {object} [options]
 * @param {number} [options.limit=10] - Número máximo de pares a devolver.
 * @returns {Array<{parent1: string, parent2: string, combinedRank: number, isSpecialCombo: boolean}>}
 */
export function findBreedingPairs(targetPalSlug, allPals, specialCombosOrOptions = {}, options = {}) {
  // El primer argumento opcional puede ser un Map/array de combos especiales o un objeto options.
  // Si es un objeto 'limpio' (solo keys de opciones como limit), lo tratamos como options.
  const looksLikeOptions = specialCombosOrOptions && typeof specialCombosOrOptions === 'object' && !('parent1' in specialCombosOrOptions) && !(specialCombosOrOptions instanceof Map);
  const combosInput = looksLikeOptions ? null : specialCombosOrOptions;
  const opts = looksLikeOptions ? specialCombosOrOptions : (options ?? {});

  const combosSource = specialCombosOrOptions instanceof Map || Array.isArray(specialCombosOrOptions) || (specialCombosOrOptions && typeof specialCombosOrOptions === 'object' && 'parent1' in specialCombosOrOptions)
    ? specialCombosOrOptions
    : null;  const limit = Math.max(1, opts.limit ?? 10);  const effectiveCombosSource = combosInput ?? combosSource ?? KNOWN_SPECIAL_COMBOS;
  const specialCombo = effectiveCombosSource.get(targetPalSlug);

  // Buscar el Pal objetivo en el catálogo
  const targetPal = allPals.find((pal) => pal.slug === targetPalSlug);
  if (!targetPal) {
    return [];
  }



  if (specialCombo && specialCombo.length > 0) {
    // Devolver el combo especial (solo el primero por ahora)
    const combo = specialCombo[0];
    return [
      {
        parent1: combo.parent1,
        parent2: combo.parent2,
        combinedRank: targetPal.combi_rank,
        isSpecialCombo: true,
      },
    ];
  }

  // 2. Calcular pares posibles usando la fórmula de combi_rank
  //    Solo considerar Pals crables y excluir al propio target
  const breedablePals = allPals.filter(
    (pal) => pal.breedable !== false && pal.slug !== targetPalSlug,
  );

  if (breedablePals.length < 2) {
    return [];
  }

  const targetRank = targetPal.combi_rank ?? 0;
  const pairs = [];

  // Generar todos los pares únicos (sin duplicados invertidos)
  const seen = new Set();

  for (let i = 0; i < breedablePals.length; i++) {
    for (let j = i; j < breedablePals.length; j++) {
      const pal1 = breedablePals[i];
      const pal2 = breedablePals[j];

      const key = [pal1.slug, pal2.slug].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      const combinedRank = calculatePairRank(
        pal1.combi_rank ?? 0,
        pal2.combi_rank ?? 0,
      );

      pairs.push({
        parent1: pal1.name,
        parent2: pal2.name,
        parent1Slug: pal1.slug,
        parent2Slug: pal2.slug,
        combinedRank,
        isSpecialCombo: false,
      });
    }
  }

  // Ordenar por proximidad al combi_rank del target
  pairs.sort((a, b) => {
    const diffA = Math.abs(a.combinedRank - targetRank);
    const diffB = Math.abs(b.combinedRank - targetRank);
    return diffA - diffB;
  });

  // Limitar y formatear el resultado
  return pairs.slice(0, limit).map((pair) => ({
    parent1: pair.parent1,
    parent2: pair.parent2,
    combinedRank: pair.combinedRank,
    isSpecialCombo: pair.isSpecialCombo,
  }));
}

