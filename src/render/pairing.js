import { islandPairings } from '../services/pairing.js';
import { citySVG } from './city.js';
import { placeLabel } from './labels.js';
import { escape } from './escape.js';
export function pairingDiagram(level, geo, lang) {
  const groups = islandPairings(level),
    zh = lang === 'zh';
  const endpoint = (edgeId, node) => {
    const curve = geo.curves[edgeId];
    return curve.point(curve.canonical[0] === node ? 0.2 : 0.8);
  };
  const mark = (point, className) =>
    `<circle class="${className}" cx="${point.x}" cy="${point.y}" r="9"/>`;
  const overlay = groups
    .map((group, index) => {
      const center = geo.nodes[group.node];
      const pairs = group.pairs
        .map((ids) => {
          const [a, b] = ids.map((id) => endpoint(id, group.node));
          return `<g class="endpoint-pair" data-pair-edges="${escape(ids.join(' '))}"><path d="M${a.x} ${a.y} Q${center.x} ${center.y} ${b.x} ${b.y}"/>${mark(a, 'paired-end')}${mark(b, 'paired-end')}</g>`;
        })
        .join('');
      const lone = group.unpaired ? mark(endpoint(group.unpaired, group.node), 'unpaired-end') : '';
      return `<g class="island-pairing" data-pair-node="${group.node}" style="--pair-delay:${index * 450}ms">${pairs}${lone}</g>`;
    })
    .join('');
  const run = { phase: 'discovery', walkedEdgeIds: [], draftEdits: [], discoveryNodes: [] };
  const scene = citySVG(level, level, run, geo, {
    lang,
    view: 'graph',
    interactive: false,
  }).replace('</svg>', `<g class="endpoint-pairings" aria-hidden="true">${overlay}</g></svg>`);
  const list = groups
    .map(
      (g) =>
        `<li><strong>${escape(placeLabel(level, g.node, lang))}</strong><span>${g.pairs.map((ids) => escape(ids.join(' ↔ '))).join(' · ')}<b>${zh ? '落单' : 'Unpaired'}: ${escape(g.unpaired ?? '—')}</b></span></li>`,
    )
    .join('');
  return `<div class="pairing-diagram">${scene}</div><p class="dialog-note">${zh ? '金色弧线把实际桥端两两相连；带外圈的端头仍然落单。配对只示意每块陆地的进入与离开，不是一条全城路线。' : 'Gold arcs pair the actual bridge ends. Ringed ends remain unpaired. These are local arrival/departure pairs, not a route through the city.'}</p><ul class="pairing-key">${list}</ul>`;
}
