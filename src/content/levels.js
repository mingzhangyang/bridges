import { validateGraph } from '../model/graph.js';
export const nodeNames = {
  A: ['灯塔岛', 'Lighthouse'],
  B: ['北岸', 'North quay'],
  C: ['南岸', 'South quay'],
  D: ['东岛', 'East island'],
  E: ['花园', 'Garden'],
  F: ['船坞', 'Dock'],
  G: ['钟楼', 'Belfry'],
  H: ['鱼市', 'Fish market'],
  I: ['书屋', 'Library'],
  J: ['远港', 'Outer harbour'],
};
function make(id, title, pairs, options = {}) {
  const edges = pairs
    .split(' ')
    .filter(Boolean)
    .map((p, i) => ({
      id: `b${i + 1}`,
      u: p[0],
      v: p[1],
      material: ['wood', 'stone', 'iron'][Math.floor(i / 3) % 3],
    }));
  const ids = [...new Set(edges.flatMap((e) => [e.u, e.v]))].sort();
  return validateGraph({
    id,
    revision: 1,
    title,
    kind: 'walk',
    objective: 'open',
    nodes: ids.map((id) => ({ id, name: nodeNames[id] })),
    edges,
    requiredNodes: ids,
    chapter: Math.min(4, Math.ceil(Number(id.slice(2)) / 8)),
    ...options,
  });
}
const specs = [
  [
    ['第一封信', 'The first letter'],
    'AB BC CA',
    {
      fixedStart: 'A',
      story: [
        '每座桥走一次，陆地可以再回来。点击金色信使旁的桥。',
        'Cross each bridge once. You can revisit an island. Click a bridge beside your messenger.',
      ],
    },
  ],
  [['渡口的选择', 'A choice at the ferry'], 'AB BC CA CD DE EF FD', { fixedStart: 'C' }],
  [['木桥双影', 'Twin wooden bridges'], 'AB AB BC', { fixedStart: 'B' }],
  [['方城对角', 'Across the square'], 'AB BC CD DA AC', {}],
  [['给东岛送信', 'A letter for East island'], 'AB BC CA AD DE EF FD', { fixedEnd: 'D' }],
  [['再访灯塔', 'The lighthouse again'], 'AB BC CA AD DE EA', {}],
  [['河湾三岔', 'Three ways at the bend'], 'AB BC CD DA AE EF FA', { fixedStart: 'A' }],
  [['两座广场', 'Two squares'], 'AB BC CA DE EF FD CD', {}],
  [['回到晨港', 'Back to the harbour'], 'AB BC CA', { objective: 'return', fixedStart: 'A' }],
  [['成对的桥', 'Bridges in pairs'], 'AB AB BC BC CA CA', { objective: 'return' }],
  [['两条运河', 'Two canals'], 'AB BC CD DA AE EF FA', { objective: 'return', fixedStart: 'A' }],
  [
    ['钟楼晚信', 'The belfry letter'],
    'AB BC CA AD DE EF FD DG GH HD AD',
    { objective: 'return', fixedStart: 'A' },
  ],
  [['留一条归路', 'Leave a way home'], 'AB BC CA CD DE EF FD DG GH HD', { fixedStart: 'C' }],
  [['两环相会', 'Where two loops meet'], 'AB BC CD DA AE EF FG GA', { objective: 'return' }],
  [['三环相扣', 'Three loops'], 'AB BC CA AD DE EF FA AG GH HA', { objective: 'return' }],
  [
    ['日落前归港', 'Home before sunset'],
    'AB BC CA CD DE EF FD FG GH HI IF CD',
    { objective: 'return', fixedStart: 'A' },
  ],
  [
    ['镜片后的城市', 'The city through a lens'],
    'AB BC CA AD DE EF FA AG GH HA',
    {
      objective: 'return',
      story: [
        '试试「看关系」：城市换了模样，脚下仍是同一座桥。',
        'Try the graph lens: a different view of the very same bridges.',
      ],
    },
  ],
  [
    ['不同的桥，同一片岸', 'Different bridges, same quay'],
    'AB AB BC CD DA AE EF FA',
    { fixedStart: 'A', fixedEnd: 'B' },
  ],
  [
    ['灯塔到东岛', 'Lighthouse to East island'],
    'AB BC CA AD DE EF FD DG GH HI ID',
    { fixedStart: 'A', fixedEnd: 'D' },
  ],
  [
    ['三个小岛的约定', 'An agreement of islands'],
    'AB BC CD DA AE EF FA CG GH HI IC',
    { objective: 'return' },
  ],
  [['从哪出发', 'Where shall we begin?'], 'AB BC CA CD DE EF FD FG GH HI IF', {}],
  [
    ['书屋到远港', 'Library to outer harbour'],
    'AB BC CD DA AE EF FA CG GH HI IC IJ',
    { fixedStart: 'I', fixedEnd: 'J' },
  ],
  [
    ['七桥前夜', 'Before the seven bridges'],
    'AB AB AC AC AD BD CD BC',
    { fixedStart: 'A', fixedEnd: 'D' },
  ],
  [['原版七桥', 'The original seven bridges'], 'AB AB AC AC AD BD CD', { kind: 'discovery' }],
];
export const levels = specs.map(([title, pairs, opts], i) =>
  make(`SB${String(i + 1).padStart(2, '0')}`, title, pairs, opts),
);
// Stable historical IDs distinguish both parallel bridges and match the design witnesses.
for (const i of [22, 23]) {
  levels[i].layout = 'historical';
  ['AB1', 'AB2', 'AC1', 'AC2', 'AD', 'BD', 'CD', 'BC1'].forEach((id, k) => {
    if (levels[i].edges[k]) levels[i].edges[k].id = id;
  });
}
const add = (id, u, v) => ({ id, kind: 'add', edge: { id, u, v, material: 'iron' } });
const remove = (edgeId) => ({ id: `remove-${edgeId}`, kind: 'remove', edgeId });
function engineering(id, title, pairs, opts = {}) {
  const l = make(id, title, pairs, { kind: 'repair', chapter: 4, budget: 2, ...opts });
  l.protectedEdges = opts.protectedEdges ?? [];
  return l;
}
function historical(id, title, objective, budget) {
  const base = structuredClone(levels[23]);
  return {
    ...base,
    id,
    title,
    kind: 'repair',
    chapter: 4,
    objective,
    budget,
    fixedStart: 'A',
    fixedEnd: objective === 'open' ? 'D' : undefined,
    protectedEdges: base.edges.map((e) => e.id),
    candidateEdits: [
      add('BC1', 'B', 'C'),
      add('AD2', 'A', 'D'),
      add('AB3', 'A', 'B'),
      add('CD2', 'C', 'D'),
    ],
  };
}
levels.push(
  historical('SB25', ['一座新桥', 'One new bridge'], 'open', 1),
  engineering('SB26', ['给花园一条归路', 'A way home for the garden'], 'AB BC CA AD DE EF FD', {
    objective: 'return',
    fixedStart: 'A',
    budget: 1,
    candidateEdits: [add('AF', 'A', 'F'), add('AD2', 'A', 'D'), add('BE', 'B', 'E')],
  }),
  engineering('SB27', ['两个孤岛', 'Two distant islands'], 'AB BC CA DE EF FD', {
    objective: 'return',
    fixedStart: 'A',
    candidateEdits: [
      add('CD', 'C', 'D'),
      add('CE', 'C', 'E'),
      add('BD', 'B', 'D'),
      add('CD2', 'C', 'D'),
    ],
  }),
  engineering('SB28', ['多出来的桥', 'One bridge too many'], 'AB BC CA AB', {
    objective: 'return',
    fixedStart: 'A',
    budget: 1,
    protectedEdges: ['b1', 'b2', 'b3'],
    candidateEdits: [remove('b4'), add('AB2', 'A', 'B'), add('AC2', 'A', 'C')],
  }),
  engineering('SB29', ['三岔口的新路', 'A new way at the fork'], 'AB AC AD AE', {
    fixedStart: 'D',
    fixedEnd: 'E',
    budget: 1,
    candidateEdits: [add('BC', 'B', 'C'), add('BD', 'B', 'D'), add('CE', 'C', 'E')],
  }),
  {
    ...historical('SB30', ['旧桥与新选择', 'Old bridges, new choices'], 'open', 1),
    protectedEdges: ['AB1', 'AC1', 'AD'],
    candidateEdits: [remove('AB2'), remove('BD'), add('BC1', 'B', 'C'), add('AD2', 'A', 'D')],
  },
  engineering(
    'SB31',
    ['钟楼的归港委托', 'The belfry commission'],
    'AB BC CA CD DE EF FD DG GH HI ID',
    {
      objective: 'return',
      fixedStart: 'A',
      candidateEdits: [
        add('CD2', 'C', 'D'),
        add('CG', 'C', 'G'),
        add('DH', 'D', 'H'),
        remove('b4'),
      ],
      protectedEdges: ['b4'],
    },
  ),
  historical('SB32', ['灯火归港', 'Harbour of lights'], 'return', 2),
);
export const commissions = [
  historical('EC01', ['东岛邮路', 'East island post'], 'open', 1),
  engineering('EC02', ['四岸一线', 'Four quays, one journey'], 'AB AC AD AE', {
    fixedStart: 'D',
    fixedEnd: 'E',
    budget: 1,
    candidateEdits: [add('BC', 'B', 'C'), add('BE', 'B', 'E'), add('CD', 'C', 'D')],
  }),
  engineering('EC03', ['南岸急信', 'Express to South quay'], 'AB AB AC AC AD BD CD', {
    layout: 'historical',
    fixedStart: 'B',
    fixedEnd: 'C',
    budget: 1,
    candidateEdits: [add('AD2', 'A', 'D'), add('AB3', 'A', 'B'), add('BC1', 'B', 'C')],
  }),
  historical('EC04', ['九桥归港', 'Nine bridges home'], 'return', 2),
  engineering('EC05', ['拆与建', 'Remove or build'], 'AB BC CA AB', {
    objective: 'return',
    fixedStart: 'A',
    budget: 1,
    protectedEdges: ['b1', 'b2', 'b3'],
    candidateEdits: [remove('b4'), add('AB2', 'A', 'B'), add('BC2', 'B', 'C')],
  }),
  engineering('EC06', ['九岛归港', 'Nine islands home'], 'AB BC CA CD DE EF FD DG GH HI ID', {
    objective: 'return',
    fixedStart: 'A',
    candidateEdits: [add('CD2', 'C', 'D'), add('CG', 'C', 'G'), add('DH', 'D', 'H')],
  }),
  engineering('EC07', ['连通两岸', 'Connect the quays'], 'AB BC CA DE EF FD', {
    budget: 1,
    candidateEdits: [add('CD', 'C', 'D'), add('BE', 'B', 'E'), add('AF', 'A', 'F')],
  }),
  engineering('EC08', ['孤岛归程', 'A homeward connection'], 'AB BC CA DE EF FD', {
    objective: 'return',
    fixedStart: 'A',
    candidateEdits: [
      add('CD', 'C', 'D'),
      add('CD2', 'C', 'D'),
      add('BE', 'B', 'E'),
      add('AF', 'A', 'F'),
    ],
  }),
];
export const allLevels = [...levels, ...commissions];
export const getLevel = (id) => allLevels.find((l) => l.id === id);
