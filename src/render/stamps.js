// Eight engraved emblems, matched to the permanent commission identity. Never use the
// achieved cost as an identity: assistance and optimality remain explicit text labels.
const emblems = {
  EC01: '<path d="M16 23h32v21H16zM16 23l16 13 16-13M32 12v6M27 15h10"/>',
  EC02: '<path d="M16 19h9v9h-9zM39 19h9v9h-9zM16 37h9v9h-9zM39 37h9v9h-9zM25 24h14M44 28v9M39 42H25"/>',
  EC03: '<path d="M22 22h26v21H22zM22 22l13 11 13-11M12 27h6M9 33h9M12 39h6M32 48h12"/>',
  EC04: '<path d="M13 39h38M16 39q16-26 32 0M21 39V28M32 39V23M43 39V28M18 48q7-5 14 0t14 0"/>',
  EC05: '<path d="M13 22h15M36 22h15M43.5 14.5v15M17 45l9-11h12l9 11M13 45h38M26 34v11M38 34v11"/>',
  EC06: '<path d="M18 18h6v6h-6zM29 18h6v6h-6zM40 18h6v6h-6zM18 29h6v6h-6zM29 29h6v6h-6zM40 29h6v6h-6zM18 40h6v6h-6zM29 40h6v6h-6zM40 40h6v6h-6z"/>',
  EC07: '<path d="M12 17v30M52 17v30M12 33h40M19 33q13-24 26 0M19 41q6-4 12 0t12 0"/>',
  EC08: '<path d="M15 25q17-22 34 0M49 25v-9M49 25h-9M49 39q-17 22-34 0M15 39v9M15 39h9M27 35v-8l5-4 5 4v8z"/>',
};
export function commissionStamp(id) {
  const emblem = emblems[id];
  if (!emblem) return '';
  return `<svg class="commission-stamp" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29"/><circle class="stamp-perforation" cx="32" cy="32" r="25.5"/><g class="stamp-emblem">${emblem}</g></svg>`;
}
