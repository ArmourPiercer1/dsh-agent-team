#!/usr/bin/env node
// U1-B reds analysis: two vitest JSON reports -> reds.json
// Identity grammar follows scripts/fail-set.mjs (TEST <path>::<fullName> / FILE <path>::COLLECTION-OR-UNHANDLED).
// Classes: DETERMINISTIC (failed both runs), FLAKY (failed exactly one run), ENV-NOT_RUN (red whose
// error text shows it measured an environment precondition of THIS run, not product logic; reason kept).
// Usage: node analyze-reds.mjs <run1.json> <run2.json> <hist9.ids> <hist22.ids> <out.json>

import { readFileSync, writeFileSync } from 'node:fs';

const [, , r1p, r2p, h9p, h22p, outp] = process.argv;
const MAIN = '/srv/workspace/dsh-plugins/dsh-agent-team/';
const WT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u1-audit-master';

function load(p) {
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const perTest = new Map();
  const fileLevel = new Set();
  let files = 0, legs = 0, passed = 0, failed = 0, skipped = 0, todo = 0;
  const skippedList = [];
  for (const f of j.testResults ?? []) {
    files += 1;
    const rel = String(f.name ?? '').replace(/\\/g, '/').replace(/^.*?packages\//, 'packages/');
    for (const a of f.assertionResults ?? []) {
      legs += 1;
      const full = String(a.fullName ?? '').trim() ||
        [...(a.ancestorTitles ?? []), a.title].filter(Boolean).join(' ').trim();
      if (a.status === 'passed') passed += 1;
      else if (a.status === 'failed') {
        failed += 1;
        const msg = (a.failureMessages ?? []).join('\n');
        const firstLine = String(msg).split('\n').map((s) => s.trim()).find(Boolean) ?? '';
        perTest.set(`TEST ${rel}::${full || '<unnamed test>'}`, {
          file: rel, name: full || '<unnamed test>',
          firstErrorLine: firstLine.slice(0, 400), allText: msg,
        });
      } else if (a.status === 'skipped') { skipped += 1; skippedList.push(`TEST ${rel}::${full}`); }
      else if (a.status === 'todo') todo += 1;
    }
    const fileFailed = (f.assertionResults ?? []).some((a) => a.status === 'failed');
    if (!fileFailed && f.status === 'failed') {
      fileLevel.add(`FILE ${rel}::COLLECTION-OR-UNHANDLED`);
      const msg = (f.failureMessages ?? []).join('\n');
      const firstLine = String(msg).split('\n').map((s) => s.trim()).find(Boolean) ?? '';
      perTest.set(`FILE ${rel}::COLLECTION-OR-UNHANDLED`, { file: rel, name: 'COLLECTION-OR-UNHANDLED', firstErrorLine: firstLine.slice(0, 400), allText: msg });
    }
  }
  return { perTest, fileLevel, skippedList,
    totals: { files, legs, passed, failed, skipped, todo,
      reported: { numTotalTestSuites: j.numTotalTestSuites, numTotalTests: j.numTotalTests,
        numPassedTests: j.numPassedTests, numFailedTests: j.numFailedTests,
        numPendingTests: j.numPendingTests, numTodoTests: j.numTodoTests } } };
}

const r1 = load(r1p), r2 = load(r2p);
const ids = new Set([...r1.perTest.keys(), ...r2.perTest.keys(), ...r1.fileLevel, ...r2.fileLevel]);

const hist = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => /^(TEST|FILE) /.test(l.trim()));
const H9 = new Set(hist(h9p)); const H22 = new Set(hist(h22p));

// ENV evidence categories, each with the measured reason text from THIS run.
function envEvidence(info) {
  const t = info?.allText ?? '';
  if (/no repo root with tests\/deepseek-harness-test-use/.test(t) || /deepseek-harness-test-use[^\n]*ENOENT/.test(t))
    return ['ENV-HOST-ABSENT', 'leg resolves the gitignored pristine test host (tests/deepseek-harness-test-use), absent from this checkout'];
  if (/Test timed out in 5000ms/.test(t))
    return ['ENV-CLOCK-DEFAULT', 'timed out under vitest\'s default 5000 ms clock; pr-gate.yml discloses this exact class (a3p3:767 4.1-5.3 s, S13 nested --test) and CI raises the clock (--census-test-timeout 20000/90000); this run kept the suite default on purpose'];
  if (/expected \[ '@deepseek-ai\/dsh' \] to deeply equal|expected \{ '@deepseek-ai\/dsh': '0\.1\.7-rc\.1' \}/.test(t))
    return ['ENV-CHECKOUT-RESOLUTION', "findTestRepoRoot() walks UP for the tests/deepseek-harness-test-use marker; absent in this worktree, present in the MAIN checkout (HEAD 6259cf4b), so the test read the MAIN tree's manifests instead of this worktree (4aaaa7b2)"];
  if (t.includes(MAIN + 'packages') && !t.includes(WT))
    return ['ENV-CHECKOUT-RESOLUTION', 'failure text names MAIN-checkout paths (…/dsh-agent-team/packages…) instead of this worktree — same findTestRepoRoot upward-walk effect; the scanned tree is not the tree under test'];
  if (/It read "refused"/.test(t))
    return ['ENV-BUILD-NOT-RUN', 'composition-smoke arm answered refused ("this checkout was never built"); the package run policy did not execute pnpm build/build:composition'];
  return null;
}

// Identity-level overrides, each grounded in measured evidence recorded in this evidence dir
// (vitest-run{1,2}.log attribution + main-checkout state), applied on top of the text heuristics.
const OVERRIDES = {
  'TEST packages/runtime/test/a3p3-governance-lane-hygiene.test.ts::the shared authority grammar stays a DOMAIN LEAF (A4-PR1, ADR A3-9/A2-3) the ceiling adapter and the PR2 evaluator each have ONE audited consumer set per name':
    ['ENV-CLOCK-DEFAULT', 'FAIL block attributed in vitest-run{1,2}.log: "Error: Test timed out in 5000ms." (JSON reporter serialized it as STACK_TRACE_ERROR). This is the leg pr-gate.yml names (a3p3-governance-lane-hygiene.test.ts:767, 4.1-5.3 s measured) and CI runs under --census-test-timeout 20000/90000 for exactly this reason; this audit run kept the suite default clock.'],
  'TEST packages/testkit/test/rc2-sanitize-evidence.test.ts::evidence sanitizer — credential coverage and raw preservation S13 file aliases, quoted values, and capture formats pass the standalone regressions':
    ['ENV-CLOCK-DEFAULT', 'FAIL block attributed in vitest-run{1,2}.log: "Error: Test timed out in 5000ms." S13 spawns a nested `node --test` (its own spawn timeout is 60_000 but the it-level clock is vitest\'s 5000 ms default); census-runtime.yml names S13 as a leg needing a raised clock (90000).'],
  'TEST packages/testkit/test/plugin-dsh-compat.test.ts::F1 plugin DSH peer compatibility (real 0.2.0-rc.2 evaluator, test-use @ 639ed01539) mechanics: the evaluator recognizes an exact-version exemption (documented, never granted here)':
    ['ENV-CHECKOUT-RESOLUTION', 'findTestRepoRoot() (tests/paths.mjs) walks UP for the tests/deepseek-harness-test-use marker; absent in this worktree, present in the MAIN checkout (HEAD 6259cf4b), so the test read the MAIN tree\'s manifests. Against THIS worktree\'s root package.json the audited nine peers ARE declared — the failing expectation is true of the tree under test.'],
};
// File-level defaults for the same mechanism (all legs of these files resolve repoRoot the same way):
const FILE_OVERRIDES = {
  'packages/testkit/test/plugin-dsh-compat.test.ts':
    ['ENV-CHECKOUT-RESOLUTION', 'repoRoot resolved to the MAIN checkout (findTestRepoRoot up-walk for the test-use marker; MAIN @ 6259cf4b has tests/deepseek-harness-test-use, this worktree does not) — the test graded MAIN\'s manifests, not this worktree\'s.'],
  'packages/runtime/test/rc2-persona-probe.test.ts':
    ['ENV-CHECKOUT-RESOLUTION', 'repoRoot resolved to the MAIN checkout (same up-walk); PP1\'s ENOENT names /srv/workspace/dsh-plugins/dsh-agent-team/packages/runtime/root-binding/harness/persona-probe.mjs — MAIN lacks that file, THIS worktree has it.'],
};

const reds = [];
for (const id of [...ids].sort()) {
  const info = r1.perTest.get(id) ?? r2.perTest.get(id);
  const in1 = r1.perTest.has(id) || r1.fileLevel.has(id);
  const in2 = r2.perTest.has(id) || r2.fileLevel.has(id);
  const env = OVERRIDES[id] ?? envEvidence(info) ?? FILE_OVERRIDES[info?.file ?? ''] ?? null;
  let cls, envReason = null;
  if (env) { cls = 'ENV-NOT_RUN'; envReason = env[1]; }
  else cls = in1 && in2 ? 'DETERMINISTIC' : 'FLAKY';
  const pkg = /^packages\/([^/]+)/.exec(info?.file ?? '')?.[1] ?? 'root';
  const historical = [];
  if (H9.has(id)) historical.push('CENSUS9');
  if (H22.has(id)) historical.push('ROOT22');
  reds.push({ identity: id, file: info?.file, name: info?.name, firstErrorLine: info?.firstErrorLine,
    class: cls, run1: in1, run2: in2, package: pkg, envCategory: env?.[0] ?? null,
    historical: historical.length ? historical : null, envReason });
}

const byClass = {}; const byPkg = {};
for (const r of reds) {
  byClass[r.class] = (byClass[r.class] ?? 0) + 1;
  const p = byPkg[r.package] ??= { DETERMINISTIC: 0, FLAKY: 0, 'ENV-NOT_RUN': 0 };
  p[r.class] += 1;
}
const mapOf = (H) => [...H].map((id) => {
  const r = reds.find((x) => x.identity === id);
  return { identity: id, stillFailsNow: r ? (r.run1 || r.run2) : false,
    class: r?.class ?? 'NOT_FAILING', run1: r?.run1 ?? false, run2: r?.run2 ?? false,
    envReason: r?.envReason ?? null };
});
const histMap = { census9: mapOf(H9), rootSuite22: mapOf(H22) };
const newReds = reds.filter((r) => r.historical === null)
  .map((r) => ({ identity: r.identity, class: r.class, envCategory: r.envCategory, firstErrorLine: r.firstErrorLine }));

writeFileSync(outp, JSON.stringify({
  runs: { run1: r1.totals, run2: r2.totals },
  summary: { redIdentitiesUnion: reds.length, byClass, byPackage: byPkg,
    historicalCensus9StillFailing: histMap.census9.filter((h) => h.stillFailsNow).length,
    historicalRoot22StillFailing: histMap.rootSuite22.filter((h) => h.stillFailsNow).length,
    newRedsTotal: newReds.length,
    newRedsGraded: newReds.filter((r) => r.class !== 'ENV-NOT_RUN').length,
    newRedsEnv: newReds.filter((r) => r.class === 'ENV-NOT_RUN').length },
  skipped: { run1: r1.skippedList.length, run2: r2.skippedList.length,
    listRun1: r1.skippedList, listRun2: r2.skippedList },
  histMap, newReds, reds,
}, null, 2), 'utf8');
console.log(JSON.stringify({ run1: r1.totals.reported, run2: r2.totals.reported, byClass,
  census9: histMap.census9.filter((h) => h.stillFailsNow).length + '/' + H9.size,
  root22: histMap.rootSuite22.filter((h) => h.stillFailsNow).length + '/' + H22.size,
  newReds: newReds.length }, null, 1));
