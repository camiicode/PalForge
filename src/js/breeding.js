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
 * Fórmula de combi_rank resultante del juego.
 * - Versión correcta: floor((rank1 + rank2 + 1) / 2).
 * - La variante anterior sin el +1 era errónea.
 *
 * Criterios de selección de padres:
 *  - Se excluyen cualquier Pal que no pueda entrar a la Granja de Cría:
 *      pal.breedable === false  o  pal.breeding_farm_eligible === false.
 *  - Solo se consideran pares sin repetir (i <= j) y se excluye el target mismo.
 *  - De los pares que generan combi_rank == combi_rank del target se elige:
 *      1. El par cuyo promedio de rangos (round half up) esté más cerca de la
 *         media entre los rangos de los padres. (Para la media de rangos, un
 *         par (a,b) se aproxima a la media de los padres con ceil((a+b)/2).
 *         El criterio del juego usa exactamente la misma fórmula que se usa
 *         para calcular el combi_rank resultado de un par.)
 *      2. Si hay empate de distancia, se elige el par cuyo promedio de range
 *         (round half up) esté más cerca de la media de rango de los padres.
 *      3. Si aún hay empate, se elige el par con menor rango de uno de los
 *         padres (el de "mejor" combinación).
 */

/** Palabras clave de combos especiales importantes del juego. */
const KNOWN_SPECIAL_COMBOS = new Map([
  // Frostallion Noct requiere Penking + Bushi
  ['frostallion-noct', [{ parent1: 'Penking', parent2: 'Bushi' }]],
  // Eidrolon Ignis requiere Eidrolon + Blazamut
  ['eidrolon-ignis', [{ parent1: 'Eidrolon', parent2: 'Blazamut' }]],
  // Katress + Wixen
  ['katress', [{ parent1: 'Katress', parent2: 'Wixen' }]],
  // Relaxaurus + Sparkit
  ['relaxaurus', [{ parent1: 'Relaxaurus', parent2: 'Sparkit' }]],
]);

/**
 * Calcula el combi_rank resultante de un par de Pals.
 *
 * Fórmula del juego: floor((rank1 + rank2 + 1) / 2), que equivale a redondear
 * la media aritmética al entero más cercano (redondeo hacia arriba en caso de
 * .5).
 *
 * @param {number} rank1
 * @param {number} rank2
 * @returns {number}
 */
export function calculatePairRank(rank1, rank2) {
  return Math.floor((rank1 + rank2 + 1) / 2);
}

/**
 * Devuelve la media (sin redondear) de dos rangos, usada como referencia para
 * el criterio de selección de padres.
 *
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function average(a, b) {
  return (a + b) / 2;
}

/**
 * Devuelve la media (redondeada al entero más cercano, .5 hacia arriba) de
 * dos rangos. Equivale a la media de los padres usada como referencia.
 *
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function averageRounded(a, b) {
  return Math.floor((a + b + 1) / 2);
}

/**
 * Determina si un Pal puede entrar en la Granja de Cría.
 *
 * Criterios comunitarios y de game files:
 *  - `breedable: false` → no es crable.
 *  - `breeding_farm_eligible: false` → aunque aparezca en las fichas, no puede
 *    entrar a la Granja de Cría (caso Panthalus/Astralym). Estos Pals se
 *    excluyen de todos los pares.
 *
 * @param {object} pal
 * @returns {boolean}
 */
function isEligibleForBreeding(pal) {
  if (!pal || typeof pal !== 'object') return false;
  if (pal.breedable === false) return false;
  if (pal.breeding_farm_eligible === false) return false;
  return true;
}

/**
 * Busca los pares de Pals que pueden producir el Pal objetivo.
 *
 * @param {string} targetPalSlug - Slug del Pal que se quiere obtener.
 * @param {Array<object>} allPals - Catálogo completo de Pals.
 * @param {Map<string, Array<{parent1: string, parent2: string}>>|null} specialCombos -
 *        Combo especiales registrados por slug de Pal. Puede ser null/undefined.
 * @param {object} [options]
 * @param {number} [options.limit=0] - Número máximo de pares a devolver (0 = sin límite).
 * @param {number} [options.perPage=10] - Para paginación: cuántos pares devolver por página.
 * @returns {{
 *   specialCombos: Array<{parent1: string, parent2: string, combinedRank: number, isSpecialCombo: boolean}>,
 *   standardPairs: Array<{parent1: string, parent2: string, combinedRank: number, isSpecialCombo: boolean}>
 * }}
 */
export function findBreedingPairs(
  targetPalSlug,
  allPals,
  specialCombosOrOptions = {},
  options = {},
) {
  const isOptions =
    specialCombosOrOptions &&
    typeof specialCombosOrOptions === 'object' &&
    !('parent1' in specialCombosOrOptions) &&
    !(specialCombosOrOptions instanceof Map) &&
    !Array.isArray(specialCombosOrOptions);
  const combosInput = isOptions ? null : specialCombosOrOptions;
  const rawOpts = isOptions ? specialCombosOrOptions : (options ?? {});
  const opts = {
    limit: 0,
    perPage: 10,
    ...rawOpts,
  };

  const combosSource =
    combosInput instanceof Map ||
    Array.isArray(combosInput) ||
    (combosInput && typeof combosInput === 'object' && 'parent1' in combosInput)
      ? combosInput
      : KNOWN_SPECIAL_COMBOS;

  const specialCombo = combosSource.get(targetPalSlug);

  // Buscar el Pal objetivo en el catálogo
  const targetPal = allPals.find((pal) => pal.slug === targetPalSlug);
  if (!targetPal) {
    return { specialCombos: [], standardPairs: [] };
  }

  const targetRank = targetPal.combi_rank ?? 0;

  if (specialCombo && specialCombo.length > 0) {
    // Devolver el combo especial (solo el primero por ahora)
    const combo = specialCombo[0];
    return {
      specialCombos: [
        {
          parent1: combo.parent1,
          parent2: combo.parent2,
          combinedRank: targetPal.combi_rank,
          isSpecialCombo: true,
        },
      ],
      standardPairs: [],
    };
  }

  // 1. Filtrar Pals crables (Granja de Cría) y excluir al target
  const breedablePals = allPals.filter(isEligibleForBreeding);
  const parents = breedablePals.filter((pal) => pal.slug !== targetPalSlug);

  if (parents.length < 2) {
    return { specialCombos: [], standardPairs: [] };
  }

  const targetRankValue = targetPal.combi_rank ?? 0;
  const parentAvg = averageRounded(
    targetPal.combi_rank ?? 0,
    targetPal.combi_rank ?? 0,
  );

  // Generar todos los pares únicos (sin duplicados invertidos)
  const rawPairs = [];
  const seen = new Set();

  for (let i = 0; i < parents.length; i++) {
    for (let j = i + 1; j < parents.length; j++) {
      const pal1 = parents[i];
      const pal2 = parents[j];

      const key = [pal1.slug, pal2.slug].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      const combinedRank = calculatePairRank(
        pal1.combi_rank ?? 0,
        pal2.combi_rank ?? 0,
      );

      rawPairs.push({
        parent1: pal1.name,
        parent2: pal2.name,
        parent1Slug: pal1.slug,
        parent2Slug: pal2.slug,
        parent1Rank: pal1.combi_rank ?? 0,
        parent2Rank: pal2.combi_rank ?? 0,
        combinedRank,
        isSpecialCombo: false,
      });
    }
  }

  // 2. Seleccionar por cercanía al combi_rank del target
  const ranked = rawPairs.map((pair) => {
    const avgRank = averageRounded(pair.parent1Rank, pair.parent2Rank);
    const diffRank =
      pair.combinedRank === targetRankValue ? 0 : Math.abs(pair.combinedRank - targetRankValue);
    const diffAvg = Math.abs(avgRank - parentAvg);
    return { pair, diffRank, diffAvg };
  });

  ranked.sort((x, y) => {
    if (x.diffRank !== y.diffRank) return x.diffRank - y.diffRank;
    if (x.diffAvg !== y.diffAvg) return x.diffAvg - y.diffAvg;
    const spreadA = Math.abs(x.pair.parent1Rank - x.pair.parent2Rank);
    const spreadB = Math.abs(y.pair.parent1Rank - y.pair.parent2Rank);
    if (spreadA !== spreadB) return spreadA - spreadB;
    return x.pair.combinedRank - y.pair.combinedRank;
  });

  const validPairs = ranked.map((r) => r.pair);

  // 3. Aplicar límite y paginación
  const limit = opts.limit || 0;
  if (limit > 0) {
    return {
      specialCombos: [],
      standardPairs: validPairs.slice(0, limit).map((pair) => ({
        parent1: pair.parent1,
        parent2: pair.parent2,
        combinedRank: pair.combinedRank,
        isSpecialCombo: pair.isSpecialCombo,
      })),
      totalPairs: validPairs.length,
    };
  }

  // Si el target tiene parent_pair_count definido (que representa el número de
  // pares de cría verificados por la comunidad), limitar los resultados a ese
  // número de los pares más cercanos al combi_rank del target.
  const parentPairCount = targetPal.parent_pair_count ?? 0;
  const perPage = opts.perPage || 10;
  const page = Math.max(0, opts.page || 0);
  const start = page * perPage;
  const end = start + perPage;

  // Los pares se ordenan por cercanía al combi_rank del target, luego por
  // promedio de rangos, etc. (ya están ordenados en `validPairs`). Tomar los
  // primeros `parentPairCount` si el target tiene parent_pair_count definido.
  const totalForTarget = parentPairCount > 0 ? parentPairCount : validPairs.length;
  const validForTarget = validPairs.slice(0, totalForTarget);

  return {
    specialCombos: [],
    standardPairs: validForTarget.slice(start, end).map((pair) => ({
      parent1: pair.parent1,
      parent2: pair.parent2,
      combinedRank: pair.combinedRank,
      isSpecialCombo: pair.isSpecialCombo,
    })),
    totalPairs: validForTarget.length,
  };
}
