#!/usr/bin/env node
/**
 * dead-tail.mjs — for every failing identity, what does the exemption actually delete?
 *
 * A baseline-exempt red leg is NOT a neutral unknown: vitest stops the body at the first failed
 * assertion, so every assertion written AFTER it never runs. This script locates each red leg's
 * body in the source, counts its `expect(` sites, and splits them into RUN (before the failing
 * line) and DEAD (at/after the failing line). The failing line comes from the stack frame in the
 * vitest JSON failure message.
 *
 * Usage: node dead-tail.mjs <vitest-json>
 */
import { readFileSync } from 'node:fs';

const rep = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const rows = [];
for (const f of rep.testResults ?? []) {
  const file = String(f.name ?? '');
  const failed = (f.assertionResults ?? []).filter((a) => a.status === 'failed');
  if (failed.length === 0) {
    if (f.status === 'failed') rows.push({ file: rel(file), kind: 'COLLECTION' });
    continue;
  }
  const src = readFileSync(file, 'utf8').split('\n');
  for (const a of failed) {
    const name = (a.fullName ?? '').trim() || [...(a.ancestorTitles ?? []), a.title].filter(Boolean).join(' ');
    const msgs = (a.failureMessages ?? []).join('\n');
    // first stack frame that points into the test file itself
    const m = msgs.match(new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+):(\\d+)`));
    const failLine = m ? Number(m[1]) : null;
    // locate the it(' body whose header line is the greatest one <= failLine
    let start = -1;
    for (let i = 0; i < src.length; i += 1) {
      if (/^\s*(it|test)(\.\w+)?\(/.test(src[i]) && (failLine === null || i + 1 <= failLine)) start = i;
    }
    // body extent: until a line that closes the it at the header indent (`  })`)
    let end = src.length - 1;
    if (start >= 0) {
      const indent = src[start].match(/^\s*/)[0].length;
      for (let i = start + 1; i < src.length; i += 1) {
        if (new RegExp(`^\\s{${indent}}}\\)`).test(src[i])) { end = i; break; }
      }
    }
    const body = src.slice(start < 0 ? 0 : start, end + 1);
    let run = 0, dead = 0;
    const deadLines = [];
    body.forEach((line, idx) => {
      const n = (line.match(/\bexpect\(/g) ?? []).length;
      if (n === 0) return;
      const lineNo = (start < 0 ? idx : start + idx) + 1;
      if (failLine !== null && lineNo >= failLine) { dead += n; deadLines.push(lineNo); }
      else run += n;
    });
    rows.push({
      file: rel(file),
      name,
      failLine,
      bodyStart: start + 1,
      bodyEnd: end + 1,
      expects: run + dead,
      run,
      dead,
      deadLines: deadLines.slice(0, 12).join(','),
    });
  }
}
function rel(p) {
  const i = p.lastIndexOf('dsh-agent-team/');
  return i >= 0 ? p.slice(i + 'dsh-agent-team/'.length).replace(/^\.worktrees\/[^/]+\//, '') : p;
}
let tr = 0, td = 0;
for (const r of rows) {
  if (r.kind === 'COLLECTION') { console.log(`COLLECTION ${r.file}`); continue; }
  tr += r.run; td += r.dead;
  console.log(`${r.file}:${r.failLine}  expects=${r.expects} run=${r.run} DEAD=${r.dead}  dead@lines[${r.deadLines}]  :: ${r.name.slice(0, 70)}`);
}
console.log(`\nTOTAL across the ${rows.filter((r) => !r.kind).length} titled reds: assertions that RUN=${tr}  DEAD=${td}`);
