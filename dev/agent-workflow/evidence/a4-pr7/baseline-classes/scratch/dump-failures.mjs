#!/usr/bin/env node
// Dump every failing identity in a vitest JSON report with the FIRST lines of its failure
// message, plus per-root shape. Read-only over the JSON produced by the census.
// Usage: node dump-failures.mjs <vitest-json> [--full]
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const full = process.argv.includes('--full');
if (!file) {
  console.error('usage: node dump-failures.mjs <vitest-json> [--full]');
  process.exit(2);
}
const rep = JSON.parse(readFileSync(file, 'utf8'));
const files = rep.testResults ?? [];
const roots = new Map();
const rel = (n) => String(n ?? '').split('dsh-agent-team/').pop();
for (const f of files) {
  const p = rel(f.name);
  const root = p.split('/')[1] ?? '?';
  const a = f.assertionResults ?? [];
  const r = roots.get(root) ?? { files: 0, legs: 0, red: 0, collection: 0 };
  r.files += 1;
  r.legs += a.length;
  r.red += a.filter((x) => x.status === 'failed').length;
  if ((f.assertionResults ?? []).length === 0 && f.status === 'failed') r.collection += 1;
  roots.set(root, r);
}
let tf = 0, tl = 0, tr = 0, tc = 0;
console.log('=== per-root shape');
for (const [root, r] of [...roots].sort()) {
  console.log(`${root.padEnd(10)} files=${String(r.files).padStart(4)} legs=${String(r.legs).padStart(5)} red=${String(r.red).padStart(3)} collection=${r.collection}`);
  tf += r.files; tl += r.legs; tr += r.red; tc += r.collection;
}
console.log(`TOTAL      files=${tf} legs=${tl} red=${tr} collection=${tc}`);

console.log('\n=== failing identities');
for (const f of files) {
  const p = rel(f.name);
  const a = f.assertionResults ?? [];
  const failed = a.filter((x) => x.status === 'failed');
  if (failed.length === 0) {
    if (f.status === 'failed') {
      const msg = (f.failureMessages ?? []).join('\n') || '(no failureMessages recorded)';
      console.log(`\n### FILE ${p}  status=${f.status}  assertionResults=${a.length}`);
      console.log(full ? msg : msg.split('\n').slice(0, 25).join('\n'));
    }
    continue;
  }
  for (const x of failed) {
    const full_ = (x.fullName ?? '').trim() || [...(x.ancestorTitles ?? []), x.title].filter(Boolean).join(' ');
    const msgs = (x.failureMessages ?? []).join('\n');
    console.log(`\n### TEST ${p}::${full_}`);
    console.log(full ? msgs : msgs.split('\n').slice(0, 18).join('\n'));
  }
}
