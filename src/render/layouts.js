// Art-space only: a bend is the signed displacement at the bridge's midpoint.
// These reviewed river corridors include construction slots, so building never moves a bridge.
const quays = {
  landscape: {
    points: [
      [180, 190],
      [180, 470],
      [390, 330],
      [710, 330],
      [920, 190],
      [920, 470],
    ],
    bends: { AD: -90, AF: 190, BE: -190 },
  },
  portrait: {
    points: [
      [180, 150],
      [510, 150],
      [345, 325],
      [345, 500],
      [180, 690],
      [510, 690],
    ],
    bends: { AD: 90, AF: -180, BE: 180, CE: 45, BD: -45 },
  },
};
const historical = {
  landscape: {
    points: [
      [470, 335],
      [365, 150],
      [365, 520],
      [850, 335],
    ],
    bends: {},
  },
  portrait: {
    points: [
      [300, 410],
      [280, 155],
      [280, 665],
      [570, 410],
    ],
    bends: { BC: 190 },
  },
};
const triangle = {
  landscape: {
    points: [
      [300, 190],
      [800, 335],
      [310, 505],
    ],
    bends: {},
  },
  portrait: {
    points: [
      [220, 200],
      [510, 420],
      [230, 650],
    ],
    bends: {},
  },
};
export function cityLayout(level, portrait) {
  const mode = portrait ? 'portrait' : 'landscape',
    n = level.nodes.length;
  if (level.layout === 'historical') return historical[mode];
  if (n === 3) return triangle[mode];
  if (n <= 6) return quays[mode];
  const w = portrait ? 720 : 1100,
    h = portrait ? 820 : 670;
  return {
    points: level.nodes.map((_, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / n;
      return [
        w / 2 + Math.cos(angle) * (portrait ? 265 : 425),
        h / 2 + Math.sin(angle) * (portrait ? 320 : 240),
      ];
    }),
    // Chords of the nine-island harbour clear the neighbouring waterfronts.
    bends: n === 9 ? { AC: 35, DF: 35 } : {},
  };
}
