import { degrees, remainingGraph } from '../model/graph.js';
import { bridgeAction, candidateFor, nodeAction, visibleEdges } from '../model/interaction.js';
import { bridgeLabel, nodeLabel } from './labels.js';
const waters = [
  ['#d4e7e7', '#86b5c2'],
  ['#dae6d8', '#83b3b2'],
  ['#c7d8dd', '#779eac'],
  ['#49697d', '#243f5a'],
];
const palettes = [
  ['#bfd6cb', '#72947c', '#b98462'],
  ['#d9d0aa', '#aaa26d', '#ac6750'],
  ['#c7cfb8', '#8e9c76', '#a47755'],
  ['#819aa5', '#496777', '#bd8968'],
];
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function building(x, y, i, palette) {
  const w = 17 + (i % 4) * 4,
    h = 18 + (i % 3) * 6,
    roof = i % 2 ? palette[2] : '#667e88';
  return `<g transform="translate(${x},${y})"><path d="M0 0l${w} 0 8 -6 -${w} 0Z" fill="${roof}"/><path d="M0 0v${h}h${w}V0Z" fill="${i % 2 ? '#ede2c7' : '#dfd7bd'}"/><path d="M${w} 0l8 -6v${h}l-8 6Z" fill="#a89f87"/><path d="M5 6h5v7H5Zm${w - 8} 0h4v6h-4Z" fill="#69858b"/><path d="M${w / 2 - 2} ${h}v-7h5v7" fill="#8b7c65"/></g>`;
}
export function citySVG(
  level,
  graph,
  run,
  geo,
  { lang = 'zh', view = 'city', counts = false, hintIds = [], interactive = true } = {},
) {
  const palette = palettes[level.chapter - 1] ?? palettes[0],
    water = waters[level.chapter - 1] ?? waters[0],
    d = degrees(run.phase === 'discovery' ? graph : remainingGraph(graph, run.walkedEdgeIds)),
    used = run.walkedEdgeIds;
  const planning = run.phase === 'planning',
    visible = visibleEdges(level, graph, run),
    built = run.draftEdits;
  // Only elements whose handler can act in this phase are buttons in the tab order. The rest
  // stay announced: bridges as disabled buttons so their state is heard, islands as labels.
  let terrain = '',
    bridges = '',
    labels = '';
  for (const [i, node] of level.nodes.entries()) {
    const { x, y } = geo.nodes[node.id];
    const selected = run.discoveryNodes?.includes(node.id),
      current = node.id === run.currentNode;
    terrain += `<g class="land"><ellipse cx="${x + 5}" cy="${y + 14}" rx="77" ry="51" fill="#223f51" opacity=".19"/><ellipse cx="${x}" cy="${y + 8}" rx="72" ry="47" fill="${palette[1]}"/><ellipse cx="${x}" cy="${y}" rx="72" ry="47" fill="${palette[0]}" stroke="#f1eed4" stroke-width="3"/>${building(x - 34, y - 40, i, palette)}${building(x + 5, y - 28, i + 7, palette)}<path d="M${x - 48} ${y + 12}q48 17 94 -2" fill="none" stroke="#efe7cd" stroke-width="7"/><g fill="${palette[1]}"><circle cx="${x + 49}" cy="${y - 22}" r="11"/><circle cx="${x + 40}" cy="${y - 36}" r="8"/></g></g>`;
    const action = interactive ? nodeAction(level, run, node.id) : null,
      label = nodeLabel(level, run, node.id, lang, counts ? d[node.id] : null),
      a11y = !interactive
        ? ''
        : action
          ? ` role="button" tabindex="0"${action === 'toggle' ? ` aria-pressed="${Boolean(selected)}"` : ''} aria-label="${esc(label)}"`
          : ` role="img" aria-label="${esc(label)}"`;
    labels += `<g class="node ${current ? 'current' : ''} ${selected ? 'selected' : ''} ${action ? 'actionable' : ''}" data-node="${node.id}"${a11y}><circle class="node-dot" cx="${x}" cy="${y}" r="22"/><circle class="node-hit" cx="${x}" cy="${y}" r="43" fill="transparent"/><text x="${x}" y="${y + 6}" text-anchor="middle" class="node-letter">${node.id}</text><text x="${x}" y="${y + 74}" text-anchor="middle" class="land-name">${esc(node.name[lang === 'zh' ? 0 : 1])}</text>${counts ? `<g class="degree"><rect x="${x - 28}" y="${y - 80}" width="56" height="29" rx="14"/><text x="${x}" y="${y - 60}" text-anchor="middle">${'Ⅱ'.repeat(Math.floor(d[node.id] / 2))}${d[node.id] % 2 ? ' •' : ''} ${d[node.id]}</text></g>` : ''}</g>`;
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
    bridges += `<g class="bridge ${walked ? 'walked' : ''} ${action === 'walk' ? 'available' : ''} ${action ? 'actionable' : ''} ${ghost ? 'ghost' : ''} ${removed ? 'removed' : ''} ${hinted ? 'hinted' : ''}" data-bridge="${edge.id}"${a11y}><path class="bridge-shadow" d="${curve.path}" transform="translate(3,9)"/><path class="bridge-rail" d="${curve.path}"/><path class="bridge-deck" d="${curve.path}" stroke="${color}"/><path class="bridge-grain" d="${curve.path}"/><path class="bridge-hit" d="${curve.path}" style="stroke-width:${geo.w === 720 ? 88 : 48}"/>${walked ? `<circle cx="${curve.point(0.5).x}" cy="${curve.point(0.5).y}" r="5" fill="#ffe2a8"/>` : ''}${ghost ? `<text x="${curve.point(0.5).x}" y="${curve.point(0.5).y + 5}" class="slot-label">+</text>` : ''}</g>`;
  }
  const pos = geo.nodes[run.currentNode] ?? { x: -100, y: -100 };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geo.w} ${geo.h}" class="city-scene atmosphere-${level.chapter} ${view === 'graph' ? 'graph-view' : ''} ${planning ? 'blueprint' : ''}" aria-label="${lang === 'zh' ? '河港地图，点击相邻桥行走' : 'Harbour map. Click adjacent bridges to walk.'}" role="${interactive ? 'group' : 'img'}"><defs><linearGradient id="water" x2=".6" y2="1"><stop stop-color="${water[0]}"/><stop offset="1" stop-color="${water[1]}"/></linearGradient><pattern id="ripples" width="100" height="66" patternUnits="userSpaceOnUse"><path d="M10 22q16 -5 32 0M62 51q10 -4 20 0" stroke="#fff" opacity=".22" fill="none"/></pattern></defs><rect width="100%" height="100%" fill="url(#water)"/><rect class="water-texture" width="100%" height="100%" fill="url(#ripples)"/><g class="terrain">${terrain}</g><g class="bridges">${bridges}</g><g class="nodes">${labels}</g><g class="traveler" transform="translate(${pos.x},${pos.y})" aria-hidden="true"><ellipse cy="17" rx="14" ry="5" fill="#213b49" opacity=".2"/><path d="M-9 12l3 -23h12l5 23Z" fill="#d38a45"/><circle cy="-18" r="8" fill="#f2dbb7"/><path d="M-10 -20l4 -8h12l5 8Z" fill="#394e58"/><path d="M9 -4l8 4 -3 12 -8 -3Z" fill="#f7ecd2"/><path d="M-3 12v6M6 12v6" stroke="#435661" stroke-width="4"/></g></svg>`;
}
