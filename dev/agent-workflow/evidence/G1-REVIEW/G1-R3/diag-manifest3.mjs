// V11 set comparison: downstream lane diffs vs manifest classifications
import { readFileSync, writeFileSync } from 'node:fs';
const base = process.argv[2];
const read = (f) => readFileSync(`${base}${f}`, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

const paths = (f) => new Set(read(f));
const generic = paths('-paths-generic.txt'); // 70
const mixed = paths('-paths-mixed.txt'); // 11
const team = paths('-paths-team.txt'); // 315
const generated = paths('-paths-generated.txt'); // 64
const unrelated = paths('-paths-unrelated.txt'); // 10

const diffFiles = (f) =>
  read(f).map((l) => {
    const i = l.indexOf('\t');
    return { status: l.slice(0, i), path: l.slice(i + 1) };
  });

const t1 = diffFiles('-diff-T1.txt');
const t3 = diffFiles('-diff-T3.txt');
const comb = diffFiles('-diff-combined.txt');

const out = [];
const rep = (label, rows, allowed, forbidden) => {
  const set = new Set(rows.map((r) => r.path));
  out.push(`=== ${label}: ${rows.length} files`);
  const bad = rows.filter((r) => forbidden.has(r.path));
  out.push(`  forbidden-class files (TEAM_OWNED/GENERATED_FROM_TEAM): ${bad.length}` + (bad.length ? ' -> ' + bad.map((b) => `${b.status} ${b.path}`).join('; ') : ''));
  const notAllowed = rows.filter((r) => !allowed.has(r.path) && !forbidden.has(r.path));
  out.push(`  not in allowed set: ${notAllowed.length}` + (notAllowed.length ? '\n    ' + notAllowed.map((r) => `${r.status} ${r.path}`).join('\n    ') : ''));
  const missing = [...allowed].filter((p) => !set.has(p));
  out.push(`  allowed-set files absent from this diff: ${missing.length}` + (missing.length ? '\n    ' + missing.join('\n    ') : ''));
  return set;
};

const allowedT1 = new Set([...generic, ...mixed]);
const forbidden = new Set([...team, ...generated]);
const setT1 = rep('T1 lane', t1, allowedT1, forbidden);
const setT3 = rep('T3 lane', t3, unrelated, forbidden);
const setComb = rep('COMBINED', comb, new Set([...allowedT1, ...unrelated]), forbidden);

// T3 exact-match vs unrelated
out.push('');
out.push(`T3 == UNRELATED_FORK_FEATURE exact: ${setT3.size === unrelated.size && [...unrelated].every((p) => setT3.has(p))}`);

// overlap T1/T3
const overlap = [...setT1].filter((p) => setT3.has(p));
out.push(`T1∩T3 overlap: ${overlap.length}` + (overlap.length ? ' -> ' + overlap.join(', ') : ''));

// combined should equal T1∪T3
const union = new Set([...setT1, ...setT3]);
out.push(`COMBINED == T1∪T3: ${setComb.size === union.size && [...union].every((p) => setComb.has(p))}`);

// status breakdown combined
const sb = {};
for (const r of comb) sb[r.status] = (sb[r.status] || 0) + 1;
out.push('combined status breakdown: ' + JSON.stringify(sb));

writeFileSync(`${base}-compare.log`, out.join('\n') + '\n');
console.log(out.join('\n'));
