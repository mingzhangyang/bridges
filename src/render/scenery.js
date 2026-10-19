// Island art: quay outlines and the landmark each island is named after.
// Everything here is decoration in art space; geometry and input never read it.

// A stable pseudo-random value in [0, 1) for an island and an index.
function grain(seed, k) {
  const s = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
// A softly irregular quay around (x, y). The outline stays between 93% and 105% of the
// ellipse, so it always contains the quay line bridges land on and clears the waterfront
// margins the layouts are checked against.
export function shorePath(x, y, rx, ry, seed) {
  const n = 10,
    points = Array.from({ length: n }, (_, k) => {
      const angle = ((k + (grain(seed, k) - 0.5) * 0.3) * Math.PI * 2) / n,
        f = 0.98 + grain(seed, k + 20) * 0.07;
      return [x + Math.cos(angle) * rx * f, y + Math.sin(angle) * ry * f];
    });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  let d = `M${f(mid(points[0], points[1]))}`;
  for (let k = 1; k <= n; k++)
    d += `Q${f(points[k % n])} ${f(mid(points[k % n], points[(k + 1) % n]))}`;
  return `${d}Z`;
}
export const islandSeed = (id) => id.charCodeAt(0) - 64;

// A market stall under a striped awning, with a fish on the counter.
const stall = (dx, palette) =>
  `<path class="wall" d="M${dx - 9} 0v-7h18v7Z" fill="#d9c7a1"/><path d="M${dx - 8} -7v-9M${dx + 8} -7v-9" stroke="#6f6a55" stroke-width="1.5"/><path d="M${dx - 11} -15h22l-3 -6h-16Z" fill="#f3ecd8"/><path d="M${dx - 11} -15h5.5l1 -6h-3.5ZM${dx} -15h5.5l-.8 -6h-4.7Z" fill="${palette[2]}"/><path d="M${dx - 5} -9q3 -2 6 0l2 -1v2l-2 -1q-3 2 -6 0Z" fill="#7d9aa3"/>`;
// Landmarks are drawn from the middle of their base, rising upward.
const landmarks = {
  // Lighthouse
  A: () =>
    `<ellipse rx="11" ry="3.5" fill="#8b8371"/><path class="wall" d="M-7 0L-5 -38H5L7 0Z" fill="#f3eee0"/><path d="M-6.6 -10h13.2l-.4 -6h-12.4ZM-5.7 -27h11.4l-.3 -6h-10.8Z" fill="#c4634a"/><path class="beacon" d="M-5 -46h10v8h-10Z" fill="#ffe7a3"/><path d="M-7 -38h14v2h-14ZM-7 -46L0 -53L7 -46Z" fill="#4c5d66"/><path class="door" d="M-2 0v-6h4v6" fill="#8b7c65"/>`,
  // North quay: a warehouse
  B: (p) =>
    `<path class="wall" d="M-16 0V-16H10V0Z" fill="#e4d8bb"/><path class="wall-side" d="M10 0V-16l8 -6V-6Z" fill="#a89f87"/><path d="M-18 -15L-3 -29L12 -15Z" fill="${p[2]}"/><path d="M12 -15L-3 -29l8 -6L20 -21Z" fill="#7d6450"/><path class="door" d="M-7 0v-10h8v10Z" fill="#7d6a52"/><path class="window" d="M-4.5 -22h3v3h-3Z" fill="#69858b"/>`,
  // South quay: a harbour crane over its crates
  C: (p) =>
    `<path d="M-6 0h12l-2 -6h-8Z" fill="#7e776a"/><path d="M-1.5 -6V-40M-1.5 -38L22 -30M-1.5 -38L-10 -34" stroke="#5f6f74" stroke-width="2.5" fill="none"/><path d="M20 -30v10" stroke="#3d4a50"/><rect x="17" y="-20" width="6" height="5" fill="${p[2]}"/><rect x="-13" y="-36" width="5" height="6" fill="#5f6f74"/><rect class="wall" x="7" y="-8" width="9" height="8" fill="#c9a77a"/><rect class="wall" x="11" y="-15" width="7" height="7" fill="#b58f62"/>`,
  // East island: a windmill
  D: (p) =>
    `<path class="wall" d="M-8 0L-5 -28H5L8 0Z" fill="#ece3cb"/><path d="M-6 -28L0 -35L6 -28Z" fill="${p[2]}"/><path class="window" d="M-1.5 -20h3v4h-3Z" fill="#69858b"/><path class="door" d="M-2.5 0v-7h5v7" fill="#8b7c65"/><g transform="translate(0,-29)"><g class="sails"><path d="M0 0L-2 -20h4ZM0 0L20 -2v4ZM0 0L2 20h-4ZM0 0L-20 2v-4Z" fill="#f6f1e1" stroke="#8b7c65" stroke-width=".8"/></g></g>`,
  // Garden: flower beds under an arbour
  E: () =>
    `<ellipse cy="-3" rx="17" ry="8" fill="#7f9a6a"/><g fill="#e7a3a0"><circle cx="-9" cy="-4" r="2"/><circle cx="-2" cy="-7" r="2"/><circle cx="6" cy="-3" r="2"/><circle cx="11" cy="-6" r="2"/></g><g fill="#f3dc8a"><circle cx="-5" cy="-1" r="1.8"/><circle cx="3" cy="-1" r="1.8"/><circle cx="12" cy="-1" r="1.6"/></g><path d="M-6 -6v-16a6 6 0 0 1 12 0v16" fill="none" stroke="#f1eed4" stroke-width="2.5"/>`,
  // Dock: a sailing boat on the slipway
  F: () =>
    `<path d="M-22 2h40l4 -4h-40Z" fill="#9b8b6d"/><path d="M-16 -11h32l-6 8h-20Z" fill="#8b5e3c"/><path d="M0 -11V-40" stroke="#5f4b37" stroke-width="2"/><path d="M1 -38L15 -14H1Z" fill="#f6efdc"/><path d="M-1 -34L-11 -14H-1Z" fill="#e9dcc0"/>`,
  // Belfry
  G: (p) =>
    `<path class="wall" d="M-8 0V-38H8V0Z" fill="#e6dcc0"/><path class="wall-side" d="M8 0V-38l5 -4V-4Z" fill="#a89f87"/><path d="M-5 -26v-6a5 5 0 0 1 10 0v6Z" fill="#4f6168"/><path class="bell" d="M-2.5 -26.5a2.5 3 0 0 1 5 0Z" fill="#d6a446"/><path d="M-10 -38L1.5 -58L13 -42L8 -38Z" fill="${p[2]}"/><path class="window" d="M-2 -15h4v5h-4Z" fill="#69858b"/><path class="door" d="M-3 0v-7h6v7" fill="#8b7c65"/>`,
  // Fish market: an awninged stall
  H: (p) => stall(0, p),
  // Library: a portico of columns
  I: (p) =>
    `<path d="M-18 0h36v-3h-36Z" fill="#cfc4a8"/><path class="wall" d="M-15 -3V-20H15V-3Z" fill="#ece3cb"/><path class="window" d="M-9 -16h3v8h-3ZM6 -16h3v8h-3Z" fill="#69858b"/><path class="door" d="M-2 -3v-9h4v9Z" fill="#8b7c65"/><g fill="#f7f1e2" stroke="#b5aa8f" stroke-width=".6"><rect x="-13" y="-20" width="3" height="17"/><rect x="-5.5" y="-20" width="3" height="17"/><rect x="2.5" y="-20" width="3" height="17"/><rect x="10" y="-20" width="3" height="17"/></g><path d="M-17 -20L0 -30L17 -20Z" fill="${p[2]}"/>`,
  // Outer harbour: a beacon mast
  J: (p) =>
    `<path d="M-8 0h16l-3 -5h-10Z" fill="#7e776a"/><path d="M0 -5V-42" stroke="#5f6f74" stroke-width="2"/><path d="M1 -42l14 4l-14 4Z" fill="${p[2]}"/><circle class="beacon" cy="-44" r="3" fill="#ffe7a3"/>`,
};
// Each landmark's drawn extent around its base, as [left, right, top, bottom], before the
// scale it is drawn at.
const landmarkBoxes = {
  A: [-11, 11, -53, 3.5],
  B: [-18, 20, -35, 0],
  C: [-13, 24, -40, 0],
  D: [-20, 20, -49, 0],
  E: [-17, 17, -28, 5],
  F: [-22, 22, -40, 2],
  G: [-10, 13, -58, 0],
  H: [-11, 11, -21, 0],
  I: [-18, 18, -30, 0],
  J: [-8, 15, -47, 0],
};
// Points along this island's own streets, from its square out to each quay, relative to the
// square.
function streetPoints(nodeId, geo) {
  const o = geo.nodes[nodeId],
    points = [];
  for (const curve of Object.values(geo.curves)) {
    const end = curve.canonical.indexOf(nodeId);
    if (end < 0) continue;
    // How far along the curve, from this island's square, the quay is.
    const reach = end ? 1 - curve.ends[1].t : curve.ends[0].t;
    for (let k = 0; k <= 24; k++) {
      const t = (reach * k) / 24,
        p = curve.point(end ? 1 - t : t);
      points.push({ x: p.x - o.x, y: p.y - o.y });
    }
  }
  return points;
}
// A prop's base, the band it stands on, may not touch a street: 4.5 px of half street plus a
// pixel of air. Taller parts may hide a street behind them, as anything upright would.
export const STREET_GAP = 5.5;
const BASE_BAND = 14;
// Full resting silhouette, including the hat, satchel and the top of the idle bob.
// Reserve it on every island, so scenery never jumps when the messenger arrives.
export const TRAVELER_SILHOUETTE = [
  { x0: -15, x1: 17, y0: -49, y1: -20 },
  { x0: -14, x1: 26, y0: -20, y1: 14 },
  { x0: -8, x1: 12, y0: 10, y1: 22 },
];
// The island's one prop: its landmark, with its base point, scale and drawn box, relative to
// the island's square. It stands as large as it can while its base keeps clear of the
// island's own streets, its square and the messenger.
export const LANDMARK_SCALES = [1.6, 1.45, 1.3, 1.15, 1, 0.85];
export function propSpots(nodeId, i, geo) {
  const streets = streetPoints(nodeId, geo).filter((p) => Math.hypot(p.x, p.y) > 20),
    [l, r, t, b] = landmarkBoxes[nodeId] ?? [-12, 12, -40, 0];
  for (const scale of LANDMARK_SCALES) {
    let pick = null;
    for (const radius of [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85])
      for (let k = 0; k < 24; k++) {
        const angle = (k * Math.PI) / 12,
          x = Math.cos(angle) * radius * 72,
          y = Math.sin(angle) * radius * 47,
          box = { x0: x + l * scale, x1: x + r * scale, y0: y + t * scale, y1: y + b * scale },
          base = { ...box, y0: Math.max(box.y0, y - BASE_BAND * scale) };
        // Both feet on the island, clear of the square (drawn above props) and the messenger.
        if ((base.x0 / 70) ** 2 + (y / 45) ** 2 > 1 || (base.x1 / 70) ** 2 + (y / 45) ** 2 > 1)
          continue;
        if (rectGap({ x: 0, y: 0 }, base) < 24) continue;
        if (TRAVELER_SILHOUETTE.some((part) => overlaps(box, part, 2))) continue;
        const clear = Math.min(30, ...streets.map((p) => rectGap(p, base)));
        if (clear < STREET_GAP) continue;
        // Landmarks lean north, behind the square.
        const score = clear - y * 0.2;
        if (!pick || score > pick.score)
          pick = { role: 'landmark', x, y, scale, box, base, score, clear };
      }
    if (pick) return [pick];
  }
  return [];
}
const rectGap = (p, r) =>
  Math.hypot(Math.max(r.x0 - p.x, 0, p.x - r.x1), Math.max(r.y0 - p.y, 0, p.y - r.y1));
const overlaps = (a, b, pad) =>
  a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
export function islandProps(nodeId, i, geo, palette) {
  return propSpots(nodeId, i, geo)
    .map(
      ({ x, y, scale }) =>
        `<g class="landmark" transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${scale})">${landmarks[nodeId]?.(palette) ?? ''}</g>`,
    )
    .join('');
}
