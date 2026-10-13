export const STORAGE_KEY = 'seven-bridges.snapshot.v1';
export function emptySnapshot() {
  return {
    version: 1,
    runs: {},
    completions: {},
    discoveries: {},
    assistance: {},
    settings: {},
    lastLevel: 'SB01',
  };
}
export function storageAdapter(getStorage = () => globalThis.localStorage) {
  let error = false,
    incompatible = false;
  return {
    read() {
      try {
        const raw = getStorage().getItem(STORAGE_KEY);
        if (!raw) return emptySnapshot();
        const value = JSON.parse(raw);
        const version = value?.version;
        // Only newer schema versions are incompatible; malformed data can be repaired on save.
        if (typeof version === 'number' && version > 1) {
          incompatible = true;
          throw new Error('Unsupported save version');
        }
        if (
          version !== 1 ||
          !['runs', 'completions', 'discoveries', 'assistance', 'settings'].every(
            (k) => value[k] && typeof value[k] === 'object' && !Array.isArray(value[k]),
          )
        )
          throw new Error('Invalid save');
        return {
          ...emptySnapshot(),
          ...value,
          lastLevel: typeof value.lastLevel === 'string' ? value.lastLevel : 'SB01',
        };
      } catch {
        error = true;
        return emptySnapshot();
      }
    },
    trySet(snapshot) {
      try {
        if (incompatible) throw new Error('Preserve unsupported save');
        getStorage().setItem(STORAGE_KEY, JSON.stringify(snapshot));
        error = false;
        return true;
      } catch {
        error = true;
        return false;
      }
    },
    get failed() {
      return error;
    },
  };
}
// Discovery islands are a set; routes and edits are ordered.
const sameWitness = (a, b) =>
  ['start', 'edges', 'edits'].every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k])) &&
  JSON.stringify([...(a.discoveryNodes ?? [])].sort()) ===
    JSON.stringify([...(b.discoveryNodes ?? [])].sort());
// Another tab saved: adopt its records without dropping ours, and keep this tab's open run.
export function mergeSnapshots(ours, theirs, openKey) {
  const records = (bucket) => {
    const merged = { ...theirs[bucket] };
    for (const [key, record] of Object.entries(ours[bucket]))
      merged[key] = { ...record, ...merged[key] };
    return merged;
  };
  return {
    ...ours,
    completions: records('completions'),
    discoveries: records('discoveries'),
    assistance: { ...ours.assistance, ...theirs.assistance },
    runs: { ...ours.runs, ...theirs.runs, ...(openKey ? { [openKey]: ours.runs[openKey] } : {}) },
  };
}
export function recordCompletion(snapshot, key, level, run, cost = 0) {
  if (run.phase !== 'complete') return snapshot;
  const bucket = level.kind === 'discovery' ? 'discoveries' : 'completions';
  const previous = snapshot[bucket][key] ?? {};
  const assisted = !!run.assistance || !!snapshot.assistance[key];
  const category = assisted ? 'assisted' : 'independent';
  const record = {
    runId: run.runId,
    revision: level.revision,
    start: run.startNode,
    edges: [...run.walkedEdgeIds],
    edits: [...run.finalEditSet],
    cost,
    discoveryNodes: [...(run.discoveryNodes ?? [])],
    explained: !!run.explained,
    at: new Date().toISOString(),
  };
  const existing = previous[category];
  // A strictly cheaper engineering result is kept. Otherwise the latest distinct route becomes the
  // postcard witness; recording the same witness again (for example on reload) changes nothing.
  if (existing && (existing.cost < cost || sameWitness(existing, record))) return snapshot;
  return {
    ...snapshot,
    [bucket]: { ...snapshot[bucket], [key]: { ...previous, [category]: record } },
  };
}
