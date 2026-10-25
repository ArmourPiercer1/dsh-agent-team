#!/usr/bin/env node
// S2 §7.4 first-consumer wiring — ISOLATED engineering test (pure node; NOT CI/Host/C1/C2).
// The consumer is gen-current-state.mjs derived-view build, in EXPLICIT candidate mode
// only: candidate path + expected digest, validated against the frozen schema and the
// canonical digest path. Default mode (no options) must stay on the legacy reader with
// unchanged output. A refused candidate NEVER falls back to graph or current-state.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../scripts/gen-current-state.mjs';
import { snapshotDigest } from '../../scripts/authority-snapshot.mjs';
import { loadCandidateAuthority } from '../../scripts/authority-candidate-source.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const REPO = resolve(here, '../..');
const EXAMPLE = JSON.parse(readFileSync(join(here, 'snapshot-example.json'), 'utf8'));
const CC = EXAMPLE.current_contract;

let fails = 0, ran = 0;
const t = (n, f) => { ran += 1; try { f(); console.log(`PASS ${n}`); } catch (e) { fails += 1; console.log(`FAIL ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

const mkRoot = ({ graph = true, graphOver = {}, mirror = false } = {}) => {
  const root = mkdtempSync(join(REPO, '.tmp-s2-cw-'));
  mkdirSync(join(root, 'dev', 'agent-workflow'), { recursive: true });
  if (graph) {
    const vals = { ...CC, ...graphOver };
    writeFileSync(join(root, 'dev/agent-workflow/graph.yaml'),
      `top: x\ncurrent_contract:\n${Object.entries(vals).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\nafter: y\n`);
  }
  mkdirSync(join(root, 'dev', 'engineering'), { recursive: true });
  writeFileSync(join(root, 'dev/engineering/registry.yaml'), 'schema_version: 1\nmigration_of_legacy_consumers: none\nlegacy_execution_authority: graph\nentries:\n  - id: T-001\n');
  if (mirror) writeFileSync(join(root, 'dev/engineering/current-state.json'), JSON.stringify({ legacy_authority: { phase_id: 'MIRROR-PHASE' } }));
  return root;
};
const mkCand = (obj = EXAMPLE) => {
  const d = mkdtempSync(join(REPO, '.tmp-s2-cw-'));
  const f = join(d, 'cand.json');
  writeFileSync(f, JSON.stringify(obj));
  return f;
};
const clean = (...ds) => ds.forEach((d) => rmSync(d, { recursive: true, force: true }));

t('C0 candidate source helper exists and demands expected digest (no silent use)', () => {
  assert(typeof loadCandidateAuthority === 'function', 'loadCandidateAuthority not exported');
  const f = mkCand();
  const noExp = loadCandidateAuthority({ file: f });
  assert(!noExp.ok && noExp.refused === 'CANDIDATE_EXPECTED_DIGEST_REQUIRED', JSON.stringify(noExp));
  const wrong = loadCandidateAuthority({ file: f, expectedDigest: `sha256:${'1'.repeat(64)}` });
  assert(!wrong.ok && wrong.refused === 'CANDIDATE_EXPECTED_VS_RECORDED', JSON.stringify(wrong)); // expected!=recorded is refused before any use
  clean(f.replace('/cand.json', ''));
});

t('C1 default mode unchanged: legacy reader, no source_binding, same rendered view', () => {
  const root = mkRoot();
  const a = build(root);
  const b = build(root, {});
  assert(a && !a.refused, 'default build refused: ' + JSON.stringify(a.refused));
  assert(a.authority_source_binding === undefined && a.view.authority_source_binding === undefined, 'default mode must not carry a source binding');
  assert(a.view.legacy_authority.phase_id === CC.phase_id, 'default must read the legacy graph');
  assert(JSON.stringify(a.view) === JSON.stringify(b.view), 'opts {} changed default view');
  clean(root);
});

t('C2 legal candidate + correct expected digest: view sourced from snapshot, binding recorded', () => {
  const root = mkRoot(); const f = mkCand();
  const r = build(root, { authorityCandidate: { file: f, expectedDigest: EXAMPLE.content_digest } });
  assert(!r.refused, JSON.stringify(r.refused));
  assert(r.view.legacy_authority.phase_id === CC.phase_id && r.view.legacy_authority.baseline === CC.baseline, 'six values not taken from candidate');
  const b = r.view.authority_source_binding;
  assert(b && b.kind === 'authority-snapshot-candidate', 'no structured source binding in the view');
  assert(b.content_digest === EXAMPLE.content_digest && b.snapshot_version === EXAMPLE.snapshot_version, JSON.stringify(b));
  assert(b.view_may_not_reverse_decide_authority === true, 'binding must state the view cannot be its own authority');
  clean(root, f.replace('/cand.json', ''));
});

t('C3 wrong expected digest: structured refusal, NO fallback to graph', () => {
  const root = mkRoot(); const f = mkCand();
  const r = build(root, { authorityCandidate: { file: f, expectedDigest: `sha256:${'2'.repeat(64)}` } });
  assert(r && r.refused === 'CANDIDATE_EXPECTED_VS_RECORDED', JSON.stringify(Object.keys(r || {})));
  assert(r.view === undefined, 'refusal must not carry a graph-derived view');
  clean(root, f.replace('/cand.json', ''));
});

t('C4 missing candidate file: CANDIDATE_MISSING, no fallback (mirror present but never consulted)', () => {
  const root = mkRoot({ mirror: true });
  const r = build(root, { authorityCandidate: { file: join(root, 'nowhere.json'), expectedDigest: EXAMPLE.content_digest } });
  assert(r && r.refused === 'CANDIDATE_MISSING', JSON.stringify(Object.keys(r || {})));
  assert(!JSON.stringify(r).includes('MIRROR-PHASE'), 'mirror value leaked = reverse decision!');
  clean(root);
});

t('C5 corrupt candidates (parse error / falsy value / shape error): refused, no fallback', () => {
  for (const txt of ['{oops', 'null', '{"schema_version":99}']) {
    const root = mkRoot();
    const f = mkCand(); writeFileSync(f, txt);
    const r = build(root, { authorityCandidate: { file: f, expectedDigest: EXAMPLE.content_digest } });
    assert(r && typeof r.refused === 'string' && r.refused.startsWith('CANDIDATE_'), `"${txt}": ${JSON.stringify(Object.keys(r || {}))}`);
    assert(r.view === undefined, `"${txt}": fell back to graph`);
    clean(root, f.replace('/cand.json', ''));
  }
});

t('C6 old/new divergence: explicit candidate mode keeps candidate (no auto source switch), divergence RECORDED', () => {
  const root = mkRoot({ graphOver: { phase_id: 'alpha6-divergent' } }); const f = mkCand();
  const r = build(root, { authorityCandidate: { file: f, expectedDigest: EXAMPLE.content_digest } });
  assert(!r.refused && r.view.legacy_authority.phase_id === CC.phase_id, 'source auto-switched away from the explicit candidate');
  const d = r.view.authority_source_binding.legacy_divergence;
  assert(Array.isArray(d) && d.some((x) => x.key === 'phase_id' && /alpha6-divergent/.test(x.legacy) && /alpha5-tool-io-governance/.test(x.snapshot)), JSON.stringify(d));
  clean(root, f.replace('/cand.json', ''));
});

console.log(fails === 0 ? `ALL GREEN (${ran} cases, actual count)` : `RED (${fails}/${ran} failing)`);
process.exit(fails === 0 ? 0 : 1);
