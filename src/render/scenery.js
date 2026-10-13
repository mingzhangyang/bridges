// Island art: quay outlines, houses and the landmark each island is named after.
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

export function building(x, y, i, palette) {
  const w = 17 + (i % 4) * 4,
    h = 18 + (i % 3) * 6,
    roof = i % 2 ? palette[2] : '#667e88';
  return `<g transform="translate(${x},${y})"><path d="M0 0l${w} 0 8 -6 -${w} 0Z" fill="${roof}"/><path class="wall" d="M0 0v${h}h${w}V0Z" fill="${i % 2 ? '#ede2c7' : '#dfd7bd'}"/><path class="wall-side" d="M${w} 0l8 -6v${h}l-8 6Z" fill="#a89f87"/><path class="window" d="M5 6h5v7H5Zm${w - 8} 0h4v6h-4Z" fill="#69858b"/><path class="door" d="M${w / 2 - 2} ${h}v-7h5v7" fill="#8b7c65"/></g>`;
}
export const footprint = (i) => ({ w: 25 + (i % 4) * 4, h: 18 + (i % 3) * 6 });
const tree = (x, y, palette) =>
  `<g class="tree" fill="${palette[1]}"><circle cx="${x + 4}" cy="${y - 4}" r="11"/><circle cx="${x - 5}" cy="${y - 16}" r="8"/></g>`;
const stall = (dx, palette) =>
  `<path class="wall" d="M${dx - 9} 0v-7h18v7Z" fill="#d9c7a1"/><path d="M${dx - 8} -7v-9M${dx + 8} -7v-9" stroke="#6f6a55" stroke-width="1.5"/><path d="M${dx - 11} -15h22l-3 -6h-16Z" fill="#f3ecd8"/><path d="M${dx - 11} -15h5.5l1 -6h-3.5ZM${dx} -15h5.5l-.8 -6h-4.7Z" fill="${palette[2]}"/><path d="M${dx - 5} -9q3 -2 6 0l2 -1v2l-2 -1q-3 2 -6 0Z" fill="#7d9aa3"/>`;
// Landmarks are drawn from the middle of their base, rising upward.
const landmarks = {
  // Lighthouse
  A: () =>
    `<ellipse rx="11" ry="3.5" fill="#8b8371"/><path class="wall" d="M-7 0L-5 -38H5L7 0Z" fill="#f3eee0"/><path d="M-6.6 -10h13.2l-.4 -6h-12.4ZM-5.7 -27h11.4l-.3 -6h-10.8Z" fill="#c4634a"/><path class="beacon" d="M-5 -46h10v8h-10Z" fill="#ffe7a3"/><path d="M-7 -38h14v2h-14ZM-7 -46L0 -53L7 -46Z" fill="#4c5d66"/><path class="door" d="M-2 0v-6h4v6" fill="#8b7c65"/>`,
  // North quay: a warehouse and its bollards
  B: (p) =>
    `<path class="wall" d="M-16 0V-16H10V0Z" fill="#e4d8bb"/><path class="wall-side" d="M10 0V-16l8 -6V-6Z" fill="#a89f87"/><path d="M-18 -15L-3 -29L12 -15Z" fill="${p[2]}"/><path d="M12 -15L-3 -29l8 -6L20 -21Z" fill="#7d6450"/><path class="door" d="M-7 0v-10h8v10Z" fill="#7d6a52"/><path class="window" d="M-4.5 -22h3v3h-3Z" fill="#69858b"/><g fill="#4c5d66"><rect x="22" y="-4" width="3" height="5" rx="1"/><rect x="28" y="-1" width="3" height="5" rx="1"/></g>`,
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
  // Fish market: two awninged stalls
  H: (p) => stall(-11, p) + stall(12, p),
  // Library: a portico of columns
  I: (p) =>
    `<path d="M-18 0h36v-3h-36Z" fill="#cfc4a8"/><path class="wall" d="M-15 -3V-20H15V-3Z" fill="#ece3cb"/><path class="window" d="M-9 -16h3v8h-3ZM6 -16h3v8h-3Z" fill="#69858b"/><path class="door" d="M-2 -3v-9h4v9Z" fill="#8b7c65"/><g fill="#f7f1e2" stroke="#b5aa8f" stroke-width=".6"><rect x="-13" y="-20" width="3" height="17"/><rect x="-5.5" y="-20" width="3" height="17"/><rect x="2.5" y="-20" width="3" height="17"/><rect x="10" y="-20" width="3" height="17"/></g><path d="M-17 -20L0 -30L17 -20Z" fill="${p[2]}"/>`,
  // Outer harbour: a beacon mast
  J: (p) =>
    `<path d="M-8 0h16l-3 -5h-10Z" fill="#7e776a"/><path d="M0 -5V-42" stroke="#5f6f74" stroke-width="2"/><path d="M1 -42l14 4l-14 4Z" fill="${p[2]}"/><circle class="beacon" cy="-44" r="3" fill="#ffe7a3"/>`,
};
// Directions on the island, in terrain-normalised space, that a street already uses.
function streetAngles(nodeId, geo) {
  const o = geo.nodes[nodeId],
    angles = [];
  for (const curve of Object.values(geo.curves)) {
    const end = curve.canonical.indexOf(nodeId);
    if (end < 0) continue;
    for (let k = 0; k <= 12; k++) {
      const t = (curve.ends[end].t * k) / 12,
        p = curve.point(end ? 1 - t : t),
        dx = (p.x - o.x) / 72,
        dy = (p.y - o.y) / 47;
      if (Math.hypot(dx, dy) > 0.25) angles.push(Math.atan2(dy, dx));
    }
  }
  return angles;
}
const turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// The island's landmark, a house and a tree stand in the quarters between streets, never on
// them. Coordinates are relative to the island's square.
export function islandProps(nodeId, i, geo, palette) {
  const streets = streetAngles(nodeId, geo);
  const slots = Array.from({ length: 8 }, (_, k) => {
    const angle = (k * Math.PI) / 4,
      clear = streets.length ? Math.min(...streets.map((s) => turn(s, angle))) : Math.PI;
    // The square sits in front of anything south of it; keep that quarter for open quay.
    return { angle, score: clear - (Math.sin(angle) > 0.5 ? 0.5 : 0) };
  }).sort((a, b) => b.score - a.score);
  const picked = [];
  for (const minGap of [Math.PI / 2, Math.PI / 4])
    for (const slot of slots)
      if (picked.length < 3 && picked.every((p) => turn(p.angle, slot.angle) >= minGap))
        picked.push(slot);
  // Tall things stand behind the square (north); the low tree takes the southernmost spot.
  return picked
    .map((slot) => ({ x: Math.cos(slot.angle) * 0.6 * 72, y: Math.sin(slot.angle) * 0.6 * 47 }))
    .sort((a, b) => a.y - b.y)
    .map(({ x, y }, k) => {
      if (k === 0 && landmarks[nodeId])
        return `<g class="landmark" transform="translate(${x.toFixed(1)},${(y + 10).toFixed(1)}) scale(1.2)">${landmarks[nodeId](palette)}</g>`;
      if (k === 2) return tree(x, y, palette);
      const seed = i + k * 7,
        { w, h } = footprint(seed);
      return building(x - w / 2, y - h / 2 - 3, seed, palette);
    })
    .join('');
}
