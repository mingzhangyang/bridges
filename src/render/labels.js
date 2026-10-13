import { t, name } from '../i18n.js';
import { bridgeState } from '../model/interaction.js';
// Islands are drawn with their letter and named in the journal, so every accessible or
// written reference uses both.
export function placeLabel(level, id, lang) {
  const node = level.nodes.find((n) => n.id === id);
  return node ? `${id} · ${name(lang, node.name)}` : id;
}
export function bridgeName(level, edge, lang) {
  return `${t(lang, 'bridge')} ${edge.id}${t(lang, 'labelSep')}${placeLabel(level, edge.u, lang)} ↔ ${placeLabel(level, edge.v, lang)}`;
}
export function bridgeLabel(level, graph, run, edge, lang, hinted = false) {
  const state = bridgeState(level, graph, run, edge.id),
    head =
      state === 'available'
        ? `${t(lang, 'bridge')} ${edge.id}${t(lang, 'toward')}${placeLabel(level, edge.u === run.currentNode ? edge.v : edge.u, lang)}`
        : bridgeName(level, edge, lang);
  return [head, t(lang, `state_${state}`), ...(hinted ? [t(lang, 'state_hinted')] : [])].join(
    t(lang, 'stateSep'),
  );
}
export function nodeLabel(level, run, id, lang, count = null) {
  return [
    placeLabel(level, id, lang),
    ...(id === run.currentNode ? [t(lang, 'hereNow')] : []),
    ...(count === null ? [] : [`${count} ${t(lang, 'bridgeCount')}`]),
  ].join(t(lang, 'stateSep'));
}
