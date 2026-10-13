import { degrees, remainingGraph } from '../model/graph.js';
import { bridgeAction, candidateFor, nodeAction, visibleEdges } from '../model/interaction.js';
import { bridgeLabel, nodeLabel } from './labels.js';
import { escape as esc } from './escape.js';
import { SHORE } from './geometry.js';
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
function building(x, y, i, palette) {
  const w = 17 + (i % 4) * 4,
    h = 18 + (i % 3) * 6,
    roof = i % 2 ? palette[2] : '#667e88';
  return `<g transform="translate(${x},${y})"><path d="M0 0l${w} 0 8 -6 -${w} 0Z" fill="${roof}"/><path class="wall" d="M0 0v${h}h${w}V0Z" fill="${i % 2 ? '#ede2c7' : '#dfd7bd'}"/><path class="wall-side" d="M${w} 0l8 -6v${h}l-8 6Z" fill="#a89f87"/><path class="window" d="M5 6h5v7H5Zm${w - 8} 0h4v6h-4Z" fill="#69858b"/><path class="door" d="M${w / 2 - 2} ${h}v-7h5v7" fill="#8b7c65"/></g>`;
}
const footprint = (i) => ({ w: 25 + (i % 4) * 4, h: 18 + (i % 3) * 6 });
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
// Houses and trees stand in the quarters between streets, never on them.
function islandProps(nodeId, i, geo, palette) {
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
  const props = picked.map((slot, k) => ({
    k,
    x: Math.cos(slot.angle) * 0.6 * 72,
    y: Math.sin(slot.angle) * 0.6 * 47,
  }));
  return props
    .sort((a, b) => a.y - b.y)
    .map(({ k, x, y }) => {
      if (k === 2)
        return `<g class="tree" fill="${palette[1]}"><circle cx="${x + 4}" cy="${y - 4}" r="11"/><circle cx="${x - 5}" cy="${y - 16}" r="8"/></g>`;
      const seed = i + k * 7,
        { w, h } = footprint(seed);
      return building(x - w / 2, y - h / 2 - 3, seed, palette);
    })
    .join('');
}
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
export function placeNames(level, geo, lang, counts) {
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
      width = [...text].length * (lang === 'zh' ? 15 : 8.4);
    let best = null;
    for (const [dx, dy, anchor, cost] of LABEL_SPOTS) {
      const x = o.x + dx,
        y = o.y + dy + 4.5,
        x0 = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2,
        box = { x0, x1: x0 + width, y0: y - 13, y1: y + 4 };
      let clear = Math.min(24, ...samples.map((p) => rectDistance(p, box) - 12));
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
      const score = clear - cost * 2.5;
      if (!best || score > best.score) best = { score, clear, x, y, anchor, box };
    }
    boxes.push(best.box);
    placed[node.id] = best;
  }
  return placed;
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
    names = placeNames(level, geo, lang, counts);
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
      houses = islandProps(node.id, i, geo, palette);
    if (run.phase === 'complete')
      reflections += `<g transform="translate(${x},${y + 68}) scale(1,-.3)">${houses}</g>`;
    terrain += `<g class="land"><ellipse cx="${x + 5}" cy="${y + 14}" rx="77" ry="51" fill="#223f51" opacity=".19"/><ellipse cx="${x}" cy="${y + 8}" rx="72" ry="47" fill="${palette[1]}"/><ellipse cx="${x}" cy="${y}" rx="72" ry="47" fill="${palette[0]}" stroke="#f1eed4" stroke-width="3"/><circle class="plaza-glow" cx="${x}" cy="${y}" r="58" fill="url(#lamplight-${uid})"/></g>`;
    props += `<g class="props" transform="translate(${x},${y})">${houses}</g>`;
    quays += `<ellipse cx="${x}" cy="${y}" rx="${SHORE.rx}" ry="${SHORE.ry}" fill="#000"/>`;
    land += `<ellipse cx="${x}" cy="${y}" rx="70" ry="45"/>`;
    const action = interactive ? nodeAction(level, run, node.id) : null,
      label = nodeLabel(level, run, node.id, lang, counts ? d[node.id] : null),
      name = names[node.id],
      a11y = !interactive
        ? ''
        : action
          ? ` role="button" tabindex="0"${action === 'toggle' ? ` aria-pressed="${Boolean(selected)}"` : ''} aria-label="${esc(label)}"`
          : ` role="img" aria-label="${esc(label)}"`;
    labels += `<g class="node ${current ? 'current' : ''} ${selected ? 'selected' : ''} ${action ? 'actionable' : ''}"${interactive ? ` data-node="${node.id}"` : ''}${a11y}><circle class="node-dot" cx="${x}" cy="${y}" r="22"/><circle class="node-hit" cx="${x}" cy="${y}" r="43" fill="transparent"/><text x="${x}" y="${y + 6}" text-anchor="middle" class="node-letter">${node.id}</text><text x="${name.x}" y="${name.y}" text-anchor="${name.anchor}" class="land-name">${esc(node.name[lang === 'zh' ? 0 : 1])}</text>${counts ? `<g class="degree"><rect x="${x - 28}" y="${y - 80}" width="56" height="29" rx="14"/><text x="${x}" y="${y - 60}" text-anchor="middle">${'Ⅱ'.repeat(Math.floor(d[node.id] / 2))}${d[node.id] % 2 ? ' •' : ''} ${d[node.id]}</text></g>` : ''}</g>`;
  }
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
    bridges += `<g class="bridge ${walked ? 'walked' : ''} ${action === 'walk' ? 'available' : ''} ${action ? 'actionable' : ''} ${ghost ? 'ghost' : ''} ${removed ? 'removed' : ''} ${hinted ? 'hinted' : ''} ${riskId === edge.id ? 'risk' : ''}"${interactive ? ` data-bridge="${edge.id}"` : ''}${a11y}><g class="span" mask="url(#quay-${uid})"><path class="bridge-halo" d="${curve.path}"/><path class="bridge-shadow" d="${curve.path}" transform="translate(3,9)"/><path class="bridge-rail" d="${curve.path}"/><path class="bridge-deck" d="${curve.path}" stroke="${color}"/><path class="bridge-grain" d="${curve.path}"/></g><g class="abutments">${abutments(curve)}</g>${lamps ? `<g class="lamps">${lamps}</g>` : ''}${ghost ? `<text x="${curve.point(0.5).x}" y="${curve.point(0.5).y + 5}" class="slot-label">+</text>` : ''}<path class="bridge-hit" d="${curve.path}" style="stroke-width:${geo.w === 720 ? 88 : 48}"/></g>`;
  }
  const pos = geo.nodes[run.currentNode] ?? { x: -100, y: -100 },
    { w, h } = geo,
    bleed = `x="${-w}" y="${-h}" width="${3 * w}" height="${3 * h}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="city-scene atmosphere-${level.chapter} ${view === 'graph' ? 'graph-view' : ''} ${planning ? 'blueprint' : ''} ${run.phase === 'complete' ? 'journey-complete' : ''}" aria-label="${interactive ? (lang === 'zh' ? '河港地图，点击相邻桥行走' : 'Harbour map. Click adjacent bridges to walk.') : lang === 'zh' ? '河港路线示意图' : 'Harbour route illustration.'}" role="${interactive ? 'group' : 'img'}"><defs><linearGradient id="water-${uid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w * 0.6}" y2="${h}"><stop stop-color="${water[0]}"/><stop offset="1" stop-color="${water[1]}"/></linearGradient><radialGradient id="sky-${uid}" gradientUnits="userSpaceOnUse" cx="${w * 0.15}" cy="${-h * 0.1}" r="${w * 0.9}"><stop stop-color="${sky[0]}" stop-opacity="${sky[1]}"/><stop offset="1" stop-color="${sky[0]}" stop-opacity="0"/></radialGradient><radialGradient id="lamplight-${uid}"><stop stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient><pattern id="ripples-${uid}" width="100" height="66" patternUnits="userSpaceOnUse"><path d="M10 22q16 -5 32 0M62 51q10 -4 20 0" stroke="#fff" opacity=".22" fill="none"/></pattern><mask id="quay-${uid}" maskUnits="userSpaceOnUse" ${bleed}><rect ${bleed} fill="#fff"/>${quays}</mask><clipPath id="land-${uid}">${land}</clipPath></defs><rect class="water" ${bleed} fill="url(#water-${uid})"/><rect class="water-texture" ${bleed} fill="url(#ripples-${uid})"/><rect class="sky" ${bleed} fill="url(#sky-${uid})"/><g class="city-world"><g class="reflections" aria-hidden="true">${reflections}</g><g class="terrain">${terrain}</g><g class="streets" clip-path="url(#land-${uid})">${streets}</g><g class="terrain-props">${props}</g><g class="bridges">${bridges}</g><g class="nodes">${labels}</g><g class="traveler" transform="translate(${pos.x},${pos.y})" aria-hidden="true"><ellipse cy="17" rx="14" ry="5" fill="#213b49" opacity=".2"/><path d="M-9 12l3 -23h12l5 23Z" fill="#d38a45"/><circle cy="-18" r="8" fill="#f2dbb7"/><path d="M-10 -20l4 -8h12l5 8Z" fill="#394e58"/><path d="M9 -4l8 4 -3 12 -8 -3Z" fill="#f7ecd2"/><path d="M-3 12v6M6 12v6" stroke="#435661" stroke-width="4"/></g></g></svg>`;
}
