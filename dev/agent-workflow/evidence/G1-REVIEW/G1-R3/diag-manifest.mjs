// V11 manifest parser (read-only): extract classification structure from file-manifest.json
import { readFileSync } from 'node:fs';

const p = process.argv[2];
const m = JSON.parse(readFileSync(p, 'utf8'));
const out = [];
out.push('=== top-level keys: ' + Object.keys(m).join(', '));
const b = m.baseline || {};
out.push('=== baseline:');
out.push('  upstream_sha: ' + b.upstream_sha);
out.push('  legacy_sha: ' + b.legacy_sha);
out.push('  file_count: ' + b.file_count + ' status: ' + JSON.stringify(b.status_counts) + ' lines: ' + JSON.stringify(b.line_counts));
out.push('=== classification_enum: ' + JSON.stringify(b.classification_enum));

// find the per-file array
let files = null;
for (const k of Object.keys(m)) {
  if (Array.isArray(m[k])) files = { key: k, arr: m[k] };
}
if (!files) { out.push('!!! no top-level array found'); console.log(out.join('\n')); process.exit(2); }
out.push('=== file array key: ' + files.key + ' length: ' + files.arr.length);

const byClass = {};
for (const e of files.arr) {
  const c = e.classification || e.cls || '(none)';
  (byClass[c] ||= []).push(e);
}
for (const c of Object.keys(byClass).sort()) {
  out.push('--- classification ' + c + ': ' + byClass[c].length + ' files');
}
out.push('');
out.push('=== GENERIC_FORK_CAPABILITY paths:');
for (const e of byClass['GENERIC_FORK_CAPABILITY'] || []) {
  const hk = e.hunks ? (Array.isArray(e.hunks) ? e.hunks.length + ' hunks' : JSON.stringify(e.hunks)) : '(no hunks field)';
  out.push('  ' + e.path + '  [' + hk + ']  reason: ' + (e.reason || '').slice(0, 120));
}
out.push('');
out.push('=== UNRELATED_FORK_FEATURE paths:');
for (const e of byClass['UNRELATED_FORK_FEATURE'] || []) {
  const hk = e.hunks ? (Array.isArray(e.hunks) ? e.hunks.length + ' hunks' : JSON.stringify(e.hunks)) : '(no hunks field)';
  out.push('  ' + e.path + '  [' + hk + ']  reason: ' + (e.reason || '').slice(0, 120));
}
out.push('');
out.push('=== TEAM_OWNED: ' + (byClass['TEAM_OWNED'] || []).length + ' files (first 15):');
for (const e of (byClass['TEAM_OWNED'] || []).slice(0, 15)) out.push('  ' + e.path);
out.push('=== GENERATED_FROM_TEAM: ' + (byClass['GENERATED_FROM_TEAM'] || []).length + ' files (first 15):');
for (const e of (byClass['GENERATED_FROM_TEAM'] || []).slice(0, 15)) out.push('  ' + e.path);

// any other classifications?
const known = new Set(['TEAM_OWNED', 'GENERIC_FORK_CAPABILITY', 'UNRELATED_FORK_FEATURE', 'GENERATED_FROM_TEAM']);
const other = Object.keys(byClass).filter((c) => !known.has(c));
if (other.length) {
  out.push('=== OTHER classifications:');
  for (const c of other) out.push('  ' + c + ': ' + byClass[c].length + ' -> ' + byClass[c].slice(0, 5).map((e) => e.path).join(', '));
}

// sample one full UNRELATED entry to show shape
const u = (byClass['UNRELATED_FORK_FEATURE'] || [])[0];
if (u) out.push('=== sample full UNRELATED entry shape: ' + JSON.stringify(u, null, 1).slice(0, 1500));

console.log(out.join('\n'));
