import { getLevel, levels } from '../content/levels.js';
import { manifest } from '../content/daily-manifest.js';
import { newRun, graphFor, move } from '../model/commands.js';
import { discoveryComplete } from '../model/rules.js';
import { applyEdits } from '../model/repair.js';
export function resolveSaveKey(key) {
  if (typeof key !== 'string') return null;
  if (!key.startsWith('daily:')) return getLevel(key);
  const parts = key.split(':'),
    entry = manifest.find((e) => e.date === parts[1] && String(e.revision) === parts[2]);
  return parts.length === 4 && entry && ['walk', 'repair'].includes(parts[3])
    ? getLevel(entry[parts[3]])
    : null;
}
function validRecord(level, record, assisted) {
  try {
    if (
      record.revision !== level.revision ||
      typeof record.runId !== 'string' ||
      !Array.isArray(record.edges) ||
      !Array.isArray(record.edits)
    )
      return false;
    const cost = level.kind === 'repair' ? applyEdits(level, record.edits).cost : 0;
    if (record.cost !== cost || (level.kind !== 'repair' && record.edits.length)) return false;
    const saved = {
      ...newRun(level, assisted),
      runId: record.runId,
      finalEditSet: record.edits,
      draftEdits: record.edits,
      startNode: record.start,
      currentNode: record.start,
      history: record.start ? [record.start] : [],
      discoveryNodes: record.discoveryNodes,
      explained: record.explained,
      phase: 'walking',
    };
    if (level.fixedStart && record.start !== level.fixedStart) return false;
    if (level.kind === 'discovery') return discoveryComplete(level, saved);
    const graph = graphFor(level, saved);
    let run = saved;
    for (const id of record.edges) {
      const result = move(graph, run, id);
      if (result.error) return false;
      run = result.run;
    }
    return run.phase === 'complete';
  } catch {
    return false;
  }
}
export function sanitizeProgress(snapshot) {
  const result = { ...snapshot, completions: {}, discoveries: {}, assistance: {} };
  for (const bucket of ['completions', 'discoveries'])
    for (const [key, record] of Object.entries(snapshot[bucket])) {
      const level = resolveSaveKey(key);
      if (!level || (level.kind === 'discovery') !== (bucket === 'discoveries')) continue;
      const clean = {};
      for (const category of ['independent', 'assisted'])
        if (record?.[category] && validRecord(level, record[category], category === 'assisted'))
          clean[category] = record[category];
      if (Object.keys(clean).length) result[bucket][key] = clean;
    }
  for (const [key, value] of Object.entries(snapshot.assistance))
    if (key.startsWith('daily:') && resolveSaveKey(key) && value === true)
      result.assistance[key] = true;
  return result;
}
export function chapterUnlocked(snapshot, id) {
  if (id === 1) return true;
  return (
    levels.filter(
      (level) =>
        level.chapter === id - 1 &&
        (snapshot.completions[level.id]?.independent ||
          snapshot.completions[level.id]?.assisted ||
          snapshot.discoveries[level.id]?.independent ||
          snapshot.discoveries[level.id]?.assisted),
    ).length >= 4
  );
}
