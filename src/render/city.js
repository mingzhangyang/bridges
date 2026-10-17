import { degrees, remainingGraph } from '../model/graph.js';
import { bridgeAction, candidateFor, nodeAction, visibleEdges } from '../model/interaction.js';
import { bridgeLabel, nodeLabel } from './labels.js';
import { escape as esc } from './escape.js';
import { SHORE } from './geometry.js';
import { bridgeSurface } from './materials.js';
import { islandProps, islandSeed, shorePath } from './scenery.js';
const waters = [
  ['#d4e7e7', '#86b5c2'],
  ['#dae6d8', '#83b3b2'],
  ['#c7d8dd', '#779eac'],
  ['#3d5d74', '#1d3550'],
];
// Chapter light: a soft wash over the water (morning haze, market afternoon, overcast, night).
const skies = [
  ['#fffdf2', 0.55],
  ['#ffe2b0', 0.35],
  ['#f2f6f4', 0.25],
  ['#ffcf7a', 0.12],
];
const palettes = [
  ['#bfd6cb', '#72947c', '#b98462'],
  ['#d9d0aa', '#aaa26d', '#ac6750'],
  ['#c7cfb8', '#8e9c76', '#a47755'],
  ['#6f8c8f', '#3f5c66', '#bd8968'],
];
// Each scene owns its paint servers and masks: several scenes (stage, replay, atlas, postcard)
// can share a document, and an id resolves to the first element that claims it.
let sceneSerial = 0;
// Candidate name positions around the quay: [dx, box-centre dy, anchor, preference cost].
// South of the island reads first; a second, wider ring is the fallback for crowded harbours.
const LABEL_SPOTS = [
  [80, 70, 0],
  [100, 86, 3],
].flatMap(([rx, ry, extra]) =>
  Array.from({ length: 16 }, (_, k) => {
    const angle = Math.PI / 2 + (k * Math.PI) / 8,
      cos = Math.cos(angle),
      sin = Math.sin(angle),
      side = Math.abs(cos) > 0.35;
    const natural = side ? (cos > 0 ? 'start' : 'end') : 'middle',
      cost = (1 - sin) * 2.5 + (side ? 1.5 : 0) + extra;
    // A name may also hang off to either side of its spot, as near the edge of the map.
    return ['middle', 'start', 'end'].map((anchor) => [
      cos * rx,
      sin * ry,
      anchor,
      cost + (anchor === natural ? 0 : 1.5),
    ]);
  }).flat(),
);
function rectDistance(p, r) {
  const dx = Math.max(r.x0 - p.x, 0, p.x - r.x1),
    dy = Math.max(r.y0 - p.y, 0, p.y - r.y1);
  return Math.hypot(dx, dy);
}
// Put each island's name on the side of its quay that no bridge, island or other name uses.
// The portrait map is drawn about half size on a phone, so its names are set larger.
export const nameSize = (geo) => (geo.w === 720 ? 22 : 14);
// An island's houses and landmark depend only on its level and layout; place them once.
const placedProps = new WeakMap();
function scenery(level, geo, nodeId, draw) {
  const known = placedProps.get(level) ?? new Map(),
    key = `${geo.w}|${nodeId}`;
  placedProps.set(level, known);
  if (!known.has(key)) known.set(key, draw());
  return known.get(key);
}
// Placement depends only on the level, the layout, the language and the count badges, and it
// is the costliest part of a scene, so each answer is kept rather than recomputed every step.
const placements = new WeakMap();
export function placeNames(level, geo, lang, counts) {
  const key = `${geo.w}|${lang}|${counts}`,
    known = placements.get(level) ?? new Map();
  placements.set(level, known);
  if (!known.has(key)) known.set(key, placeNamesFresh(level, geo, lang, counts));
  return known.get(key);
}
function placeNamesFresh(level, geo, lang, counts) {
  const size = nameSize(geo);
  const placed = {},
    // With bridge counts on, each island's count badge sits above it; names keep clear of it.
    boxes = counts
      ? level.nodes.map((n) => {
          const { x, y } = geo.nodes[n.id];
          return { x0: x - 28, x1: x + 28, y0: y - 80, y1: y - 51 };
        })
      : [],
    samples = Object.values(geo.curves).flatMap((c) => c.samples);
  for (const node of level.nodes) {
    const o = geo.nodes[node.id],
      text = node.name[lang === 'zh' ? 0 : 1],
      em = size * (lang === 'zh' ? 1.07 : 0.6),
      // A two-word name may also be set on two lines when one line has no room.
      layouts = [[text], ...(text.includes(' ') ? [text.split(' ')] : [])];
    let best = null;
    for (const [i, lines] of layouts.entries())
      for (const [dx, dy, anchor, cost] of LABEL_SPOTS) {
        const width = Math.max(...lines.map((line) => [...line].length)) * em,
          lead = size * 1.15 * (lines.length - 1),
          x = o.x + dx,
          // The first baseline; a wrapped name is centred on its spot as a block.
          y = o.y + dy + size * 0.32 - lead / 2,
          x0 = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2,
          box = { x0, x1: x0 + width, y0: y - size * 0.93, y1: y + lead + size * 0.29 };
        // Only bridge points near the box can lower its (capped) clearance.
        let clear = 24;
        for (const p of samples)
          if (p.x > box.x0 - 36 && p.x < box.x1 + 36 && p.y > box.y0 - 36 && p.y < box.y1 + 36)
            clear = Math.min(clear, rectDistance(p, box) - 12);
        if (box.x0 < 6 || box.x1 > geo.w - 6 || box.y0 < 6 || box.y1 > geo.h - 6) clear -= 100;
        for (const other of level.nodes) {
          if (other.id === node.id) continue;
          const q = geo.nodes[other.id],
            cx = Math.max(box.x0, Math.min(q.x, box.x1)),
            cy = Math.max(box.y0, Math.min(q.y, box.y1));
          if (((cx - q.x) / 80) ** 2 + ((cy - q.y) / 58) ** 2 < 1) clear -= 50;
        }
        if (boxes.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1))
          clear -= 50;
        const score = clear - (cost + i * 3) * 2.5;
        if (!best || score > best.score)
          best = { score, clear, x, y, anchor, box, lines, lead: size * 1.15 };
      }
    boxes.push(best.box);
    placed[node.id] = best;
  }
  return placed;
}
const segmentCross = (p, q, r, s) => {
  const d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x);
  if (!d) return null;
  const u = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d,
    v = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? [u, v] : null;
};
const bounds = (points) => ({
  x0: Math.min(...points.map((p) => p.x)),
  x1: Math.max(...points.map((p) => p.x)),
  y0: Math.min(...points.map((p) => p.y)),
  y1: Math.max(...points.map((p) => p.y)),
});
// Where two bridge curves cross, as [t on the first, t on the second]. Pure geometry, so each
// pair is solved once per level and layout, however many steps the walk takes.
const crossings = new WeakMap();
function pairCrossings(level, geo, first, second) {
  const byLevel = crossings.get(level) ?? new Map(),
    key = `${geo.w}|${first}|${second}`;
  crossings.set(level, byLevel);
  if (byLevel.has(key)) return byLevel.get(key);
  const s = geo.curves[first].samples,
    r = geo.curves[second].samples,
    a = bounds(s),
    b = bounds(r),
    hits = [];
  if (a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1)
    for (let k = 1; k < s.length; k++)
      for (let m = 1; m < r.length; m++) {
        const hit = segmentCross(s[k - 1], s[k], r[m - 1], r[m]);
        if (hit) hits.push([(k - 1 + hit[0]) / 64, (m - 1 + hit[1]) / 64]);
      }
  byLevel.set(key, hits);
  return hits;
}
// Where one bridge passes over another, the upper one (drawn later, and the one a click there
// reaches) casts a short, darker shadow on the deck below so the crossing reads as an
// overpass rather than a junction.
function crossingShadows(level, edges, geo, isGhost) {
  const shadows = {},
    spans = edges.map((edge) => {
      const curve = geo.curves[edge.id],
        [from, to] = curve.ends;
      return { edge, curve, from: from.t, to: to.t, ghost: isGhost(edge) };
    });
  for (const [j, upper] of spans.entries()) {
    if (upper.ghost) continue;
    const s = upper.curve.samples,
      seen = [];
    let length = 0;
    for (let k = 1; k < s.length; k++)
      length += Math.hypot(s[k].x - s[k - 1].x, s[k].y - s[k - 1].y);
    const half = 30 / length;
    for (const lower of spans.slice(0, j))
      for (const [t, tl] of pairCrossings(level, geo, upper.edge.id, lower.edge.id)) {
        // Only crossings over open water: never at the shared island of two bridges.
        if (t <= upper.from || t >= upper.to || tl <= lower.from || tl >= lower.to) continue;
        if (seen.some((prev) => Math.abs(prev - t) < half)) continue;
        seen.push(t);
        shadows[upper.edge.id] =
          (shadows[upper.edge.id] ?? '') +
          `<path class="crossing-shadow" d="${subPath(upper.curve, Math.max(upper.from, t - half), Math.min(upper.to, t + half))}" transform="translate(3,9)"/>`;
      }
  }
  return shadows;
}
// The piece of a quadratic bridge curve between t0 and t1, as a path.
function subPath({ a, b, c }, t0, t1) {
  const blossom = (u, v) => ({
      x: (1 - u) * (1 - v) * a.x + ((1 - u) * v + u * (1 - v)) * c.x + u * v * b.x,
      y: (1 - u) * (1 - v) * a.y + ((1 - u) * v + u * (1 - v)) * c.y + u * v * b.y,
    }),
    p = blossom(t0, t0),
    q = blossom(t0, t1),
    r = blossom(t1, t1),
    f = (z) => `${z.x.toFixed(1)},${z.y.toFixed(1)}`;
  return `M${f(p)} Q${f(q)} ${f(r)}`;
}
// A short stone pier across the deck where it lands on the quay.
function abutments(curve) {
  return curve.ends
    .map(({ x, y, angle }) => {
      const nx = -Math.sin(angle) * 12.5,
        ny = Math.cos(angle) * 12.5,
        d = `M${(x - nx).toFixed(1)},${(y - ny).toFixed(1)}L${(x + nx).toFixed(1)},${(y + ny).toFixed(1)}`;
      return `<path class="abutment" d="${d}"/><path class="abutment-cap" d="${d}"/>`;
    })
    .join('');
}
export function citySVG(
  level,
  graph,
  run,
  geo,
  {
    lang = 'zh',
    view = 'city',
    counts = false,
    hintIds = [],
    riskId = null,
    interactive = true,
  } = {},
) {
  const palette = palettes[level.chapter - 1] ?? palettes[0],
    water = waters[level.chapter - 1] ?? waters[0],
    sky = skies[level.chapter - 1] ?? skies[0],
    uid = ++sceneSerial,
    d = degrees(run.phase === 'discovery' ? graph : remainingGraph(graph, run.walkedEdgeIds)),
    used = run.walkedEdgeIds;
  const planning = run.phase === 'planning',
    visible = visibleEdges(level, graph, run),
    built = run.draftEdits,
    names = placeNames(level, geo, lang, counts),
    portrait = geo.w === 720;
  // Only elements whose handler can act in this phase are buttons in the tab order. The rest
  // stay announced: bridges as disabled buttons so their state is heard, islands as labels.
  let terrain = '',
    props = '',
    quays = '',
    land = '',
    streets = '',
    bridges = '',
    labels = '',
    reflections = '';
  for (const [i, node] of level.nodes.entries()) {
    const { x, y } = geo.nodes[node.id];
    const selected = run.discoveryNodes?.includes(node.id),
      current = node.id === run.currentNode,
      houses = scenery(level, geo, node.id, () => islandProps(node.id, i, geo, palette));
    if (run.phase === 'complete')
      reflections += `<g transform="translate(${x},${y + 68}) scale(1,-.3)">${houses}</g>`;
    const seed = islandSeed(node.id),
      top = shorePath(x, y, 72, 47, seed);
    terrain += `<g class="land"><path class="wake" d="M${x - 82} ${y + 22}q82 52 164 0"/><path d="${shorePath(x + 5, y + 14, 77, 51, seed)}" fill="#223f51" opacity=".19"/><path d="${shorePath(x, y + 8, 72, 47, seed)}" fill="${palette[1]}"/><path class="land-top" d="${top}" fill="${palette[0]}" stroke="#f1eed4" stroke-width="3"/><circle class="plaza-glow" cx="${x}" cy="${y}" r="58" fill="url(#lamplight-${uid})"/></g>`;
    props += `<g class="props" transform="translate(${x},${y})">${houses}</g>`;
    quays += `<ellipse cx="${x}" cy="${y}" rx="${SHORE.rx}" ry="${SHORE.ry}" fill="#000"/>`;
    land += `<path d="${top}"/>`;
    const action = interactive ? nodeAction(level, run, node.id) : null,
      label = nodeLabel(level, run, node.id, lang, counts ? d[node.id] : null),
      name = names[node.id],
      a11y = !interactive
        ? ''
        : action
          ? ` role="button" tabindex="0"${action === 'toggle' ? ` aria-pressed="${Boolean(selected)}"` : ''} aria-label="${esc(label)}"`
          : ` role="img" aria-label="${esc(label)}"`;
    labels += `<g class="node ${current ? 'current' : ''} ${selected ? 'selected' : ''} ${action ? 'actionable' : ''}"${interactive ? ` data-node="${node.id}"` : ''}${a11y}><circle class="node-dot" cx="${x}" cy="${y}" r="22"/><circle class="node-hit" cx="${x}" cy="${y}" r="43" fill="transparent"/><text x="${x}" y="${y + (portrait ? 7 : 6)}" text-anchor="middle" class="node-letter">${node.id}</text><text x="${name.x}" y="${name.y}" text-anchor="${name.anchor}" class="land-name">${name.lines.map((line, k) => (k ? `<tspan x="${name.x}" dy="${name.lead}">${esc(line)}</tspan>` : esc(line))).join('')}</text>${counts ? `<g class="degree"><rect x="${x - 28}" y="${y - 80}" width="56" height="29" rx="14"/><text x="${x}" y="${y - 60}" text-anchor="middle">${'Ⅱ'.repeat(Math.floor(d[node.id] / 2))}${d[node.id] % 2 ? ' •' : ''} ${d[node.id]}</text></g>` : ''}</g>`;
  }
  const shadows = crossingShadows(level, visible, geo, (edge) => {
    const edit = planning && candidateFor(level, edge.id);
    return edit?.kind === 'add' && !built.includes(edit.id);
  });
  for (const edge of visible) {
    const curve = geo.curves[edge.id],
      edit = candidateFor(level, edge.id);
    const removed = edit?.kind === 'remove' && built.includes(edit.id),
      ghost = planning && edit?.kind === 'add' && !built.includes(edit.id);
    const walked = used.includes(edge.id),
      action = interactive ? bridgeAction(level, graph, run, edge.id) : null,
      hinted = hintIds.includes(edge.id);
    const color = walked
      ? '#f2bd71'
      : edge.material === 'iron'
        ? '#789297'
        : edge.material === 'stone'
          ? '#d4ccb6'
          : '#b79b74';
    const a11y = !interactive
      ? ''
      : ` role="button" tabindex="${action ? 0 : -1}"${action ? '' : ' aria-disabled="true"'} aria-label="${esc(bridgeLabel(level, graph, run, edge, lang, hinted))}"`;
    const [from, to] = curve.ends,
      lamps = walked
        ? [0.25, 0.5, 0.75]
            .map((k) => curve.point(from.t + (to.t - from.t) * k))
            .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5"/>`)
            .join('')
        : '';
    if (!ghost)
      streets += `<path class="street ${walked ? 'walked' : ''} ${removed ? 'removed' : ''}" d="${curve.path}"/>`;
    bridges += `<g class="bridge ${walked ? 'walked' : ''} ${action === 'walk' ? 'available' : ''} ${action ? 'actionable' : ''} ${ghost ? 'ghost' : ''} ${removed ? 'removed' : ''} ${hinted ? 'hinted' : ''} ${riskId === edge.id ? 'risk' : ''}"${interactive ? ` data-bridge="${edge.id}"` : ''}${a11y}><g class="span" mask="url(#quay-${uid})"><path class="bridge-halo" d="${curve.path}"/><path class="bridge-shadow" d="${curve.path}" transform="translate(3,9)"/>${shadows[edge.id] ?? ''}<path class="bridge-rail" d="${curve.path}"/><path class="bridge-deck" d="${curve.path}" stroke="${color}"/>${bridgeSurface(curve, edge.material)}</g><g class="abutments">${abutments(curve)}</g>${lamps ? `<g class="lamps">${lamps}</g>` : ''}${ghost ? `<text x="${curve.point(0.5).x}" y="${curve.point(0.5).y + 5}" class="slot-label">+</text>` : ''}<path class="bridge-hit" d="${curve.path}" style="stroke-width:${geo.w === 720 ? 88 : 48}"/></g>`;
  }
  const pos = geo.nodes[run.currentNode] ?? { x: -100, y: -100 },
    { w, h } = geo,
    bleed = `x="${-w}" y="${-h}" width="${3 * w}" height="${3 * h}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="city-scene atmosphere-${level.chapter} ${portrait ? 'portrait' : ''} ${view === 'graph' ? 'graph-view' : ''} ${planning ? 'blueprint' : ''} ${run.phase === 'complete' ? 'journey-complete' : ''}" aria-label="${interactive ? (lang === 'zh' ? '河港地图，点击相邻桥行走' : 'Harbour map. Click adjacent bridges to walk.') : lang === 'zh' ? '河港路线示意图' : 'Harbour route illustration.'}" role="${interactive ? 'group' : 'img'}"><defs><linearGradient id="water-${uid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w * 0.6}" y2="${h}"><stop class="water-a" stop-color="${water[0]}"/><stop class="water-b" offset="1" stop-color="${water[1]}"/></linearGradient><radialGradient id="sky-${uid}" gradientUnits="userSpaceOnUse" cx="${w * 0.15}" cy="${-h * 0.1}" r="${w * 0.9}"><stop stop-color="${sky[0]}" stop-opacity="${sky[1]}"/><stop offset="1" stop-color="${sky[0]}" stop-opacity="0"/></radialGradient><radialGradient id="lamplight-${uid}"><stop stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient><pattern id="ripples-${uid}" width="100" height="66" patternUnits="userSpaceOnUse"><path d="M10 22q16 -5 32 0M62 51q10 -4 20 0" stroke="#fff" opacity=".22" fill="none"/></pattern><pattern id="swell-${uid}" width="164" height="106" patternUnits="userSpaceOnUse" patternTransform="translate(37,19)"><path d="M20 30q22 -7 44 0M104 78q14 -5 28 0M66 96q9 -3 18 0" stroke="#fff" stroke-width="1.3" opacity=".14" fill="none"/></pattern><mask id="quay-${uid}" maskUnits="userSpaceOnUse" ${bleed}><rect ${bleed} fill="#fff"/>${quays}</mask><clipPath id="land-${uid}">${land}</clipPath></defs><rect class="water" ${bleed} fill="url(#water-${uid})"/><rect class="water-texture" ${bleed} fill="url(#ripples-${uid})"/><rect class="water-texture" ${bleed} fill="url(#swell-${uid})"/><rect class="sky" ${bleed} fill="url(#sky-${uid})"/><g class="city-world"><g class="reflections" aria-hidden="true">${reflections}</g><g class="terrain">${terrain}</g><g class="streets" clip-path="url(#land-${uid})">${streets}</g><g class="terrain-props">${props}</g><g class="bridges">${bridges}</g><g class="nodes">${labels}</g><g class="traveler" transform="translate(${pos.x},${pos.y})" aria-hidden="true"><ellipse class="traveler-ring" cy="14" rx="27" ry="12"/><g class="traveler-bob"><g transform="translate(0,-5) scale(1.45)"><ellipse cy="17" rx="14" ry="5" fill="#213b49" opacity=".2"/><path d="M-9 12l3 -23h12l5 23Z" fill="#d38a45" stroke="#7a4a22" stroke-width=".8"/><circle cy="-18" r="8" fill="#f2dbb7" stroke="#8a6a4a" stroke-width=".6"/><path d="M-10 -20l4 -8h12l5 8Z" fill="#394e58"/><path d="M9 -4l8 4 -3 12 -8 -3Z" fill="#f7ecd2" stroke="#9b8a6a" stroke-width=".6"/><path d="M-3 12v6M6 12v6" stroke="#435661" stroke-width="4"/></g></g></g></g></svg>`;
}
