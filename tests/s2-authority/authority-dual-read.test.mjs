#!/usr/bin/env node
// S2 step-3 read-only dual-read diagnostic — ISOLATED engineering test (pure node; NOT
// CI/Host/C1/C2). Inputs are temp fixture roots; the real repository is never the root;
// nothing real is read as authority and nothing is ever written.
// Semantics are modelled on the B rev-2 fixture package (CONF-02/03 divergence, MIS-xx
// missing fields, DERIV backfill refusal, POS-01 six-field positive) — this does NOT
// claim the 16 cases were executed or passed.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDualRead } from '../../scripts/authority-dual-read.mjs';
import { readLegacyAuthority, checkLegacyMirror, LEGACY_MIRROR_KEYS } from '../../scripts/gen-current-state.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const REPO = resolve(here, '../..');
const EXAMPLE = JSON.parse(readFileSync(join(here, 'snapshot-example.json'), 'utf8'));
const CC = EXAMPLE.current_contract;

let fails = 0, ran = 0;
const t = (name, fn) => { ran += 1; try { fn(); console.log(`PASS ${name}`); } catch (e) { fails += 1; console.log(`FAIL ${name}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };
const has = (r, code) => r.verdicts.some((v) => v.code === code);

const graphText = (over = {}, drop = []) => {
  const vals = { ...CC, ...over };
  const lines = Object.entries(vals).filter(([k]) => !drop.includes(k)).map(([k, v]) => `  ${k}: ${v}`).join('\n');
  return `top: keep-me\ncurrent_contract:\n${lines}\nafter: yes\n`;
};
const mkRoot = ({ graph = true, graphOver = {}, drop = [], mirror = false } = {}) => {
  const root = mkdtempSync(join(REPO, '.tmp-s2-dr-'));
  mkdirSync(join(root, 'dev', 'agent-workflow'), { recursive: true });
  if (graph) writeFileSync(join(root, 'dev/agent-workflow/graph.yaml'), graphText(graphOver, drop));
  if (mirror) { mkdirSync(join(root, 'dev', 'engineering'), { recursive: true }); writeFileSync(join(root, 'dev/engineering/current-state.json'), JSON.stringify({
    'x-generated-view-mirror': true,
    legacy_authority: { phase_id: 'MIRROR-PHASE', baseline: 'f'.repeat(40) },
  })); }
  return root;
};
const mkSnap = (obj = EXAMPLE) => {
  const root = mkdtempSync(join(REPO, '.tmp-s2-dr-'));
  const f = join(root, 'cand.json');
  writeFileSync(f, JSON.stringify(obj));
  return f;
};

t('D0 legacy reader is exported with its old semantics (present:false when no graph, six keys when present)', () => {
  assert(typeof readLegacyAuthority === 'function', 'readLegacyAuthority not exported');
  assert(typeof checkLegacyMirror === 'function' && LEGACY_MIRROR_KEYS.length === 6, 'old exports lost');
  const r1 = mkRoot({ graph: false });
  assert(readLegacyAuthority(r1).present === false, 'no-graph must be present:false, never mirror-derived');
  const r2 = mkRoot();
  const got = readLegacyAuthority(r2);
  assert(got.present && got.phase_id === CC.phase_id && got.baseline === CC.baseline, 'graph block fields lost');
  rmSync(r1, { recursive: true, force: true }); rmSync(r2, { recursive: true, force: true });
});

t('D1 positive: candidate vs graph six fields agree -> exit 0, compared=6', () => {
  const root = mkRoot(); const snap = mkSnap();
  const r = runDualRead(['--snapshot', snap, '--root', root]);
  assert(r.code === 0, JSON.stringify(r));
  assert(r.compared === 6 && !r.verdicts.some((v) => v.red), JSON.stringify(r.verdicts));
  rmSync(root, { recursive: true, force: true }); rmSync(snap.replace('/cand.json', ''), { recursive: true, force: true });
});

t('D2 REAL divergence: graph phase_id differs -> SNAPSHOT_VS_LEGACY_VALUE red, both values shown', () => {
  const root = mkRoot({ graphOver: { phase_id: 'alpha6-something' } }); const snap = mkSnap();
  const r = runDualRead(['--snapshot', snap, '--root', root]);
  const v = r.verdicts.find((x) => x.code === 'SNAPSHOT_VS_LEGACY_VALUE');
  assert(r.code === 2 && v && v.red && /alpha6-something/.test(v.detail) && /alpha5-tool-io-governance/.test(v.detail), JSON.stringify(r.verdicts));
  rmSync(root, { recursive: true, force: true }); rmSync(snap.replace('/cand.json', ''), { recursive: true, force: true });
});

t('D3 legacy field missing in graph -> MISSING_LEGACY_FIELD (not filled from anywhere)', () => {
  const root = mkRoot({ drop: ['baseline_collected'] }); const snap = mkSnap();
  const r = runDualRead(['--snapshot', snap, '--root', root]);
  const v = r.verdicts.find((x) => x.code === 'MISSING_LEGACY_FIELD');
  assert(r.code === 2 && v && v.red && /baseline_collected/.test(v.detail), JSON.stringify(r.verdicts));
  rmSync(root, { recursive: true, force: true }); rmSync(snap.replace('/cand.json', ''), { recursive: true, force: true });
});

t('D4 no graph.yaml + mirror present -> MISSING_LEGACY_AUTHORITY; NO backfill from derived mirror', () => {
  const root = mkRoot({ graph: false, mirror: true }); const snap = mkSnap();
  const r = runDualRead(['--snapshot', snap, '--root', root]);
  assert(r.code === 2 && has(r, 'MISSING_LEGACY_AUTHORITY'), JSON.stringify(r.verdicts));
  assert(r.compared === 0, 'compared must be 0 when the legacy authority is absent');
  const dump = JSON.stringify(r);
  assert(!dump.includes('MIRROR-PHASE') && !dump.includes('f'.repeat(40)), 'mirror values leaked into the report = backfill!');
  assert(has(r, 'DERIVED_MIRROR_PRESENT_NOT_CONSULTED'), 'diagnostic must record that the mirror exists but was NOT consulted');
  rmSync(root, { recursive: true, force: true }); rmSync(snap.replace('/cand.json', ''), { recursive: true, force: true });
});

t('D5 invalid digest in candidate -> SNAPSHOT_INVALID_DIGEST red (fields still compared)', () => {
  const bad = JSON.parse(JSON.stringify(EXAMPLE)); bad.content_digest = `sha256:${'0'.repeat(64)}`;
  const root = mkRoot(); const snap = mkSnap(bad);
  const r = runDualRead(['--snapshot', snap, '--root', root]);
  assert(r.code === 2 && has(r, 'SNAPSHOT_INVALID_DIGEST') && r.compared === 6, JSON.stringify(r.verdicts));
  rmSync(root, { recursive: true, force: true }); rmSync(snap.replace('/cand.json', ''), { recursive: true, force: true });
});

t('D6 missing snapshot field -> SNAPSHOT_SHAPE red with field name', () => {
  const bad = JSON.parse(JSON.stringify(EXAMPLE)); delete bad.current_contract.matrix;
  bad.content_digest = 'sha256:' + createHash('sha256').update(JSON.stringify((({ content_digest, ...rest }) => rest)(bad))).digest('hex');
  const root = mkRoot(); const snap = mkSnap(bad);
  const r = runDualRead(['--snapshot', snap, '--root', root]);
  const v = r.verdicts.find((x) => x.code === 'SNAPSHOT_SHAPE');
  assert(r.code === 2 && v && /matrix/.test(v.detail), JSON.stringify(r.verdicts));
  rmSync(root, { recursive: true, force: true }); rmSync(snap.replace('/cand.json', ''), { recursive: true, force: true });
});

t('D7 read-only: zero new files, graph bytes identical after the diagnostic', () => {
  const root = mkRoot({ mirror: true }); const snap = mkSnap();
  const g0 = readFileSync(join(root, 'dev/agent-workflow/graph.yaml'));
  const tree0 = JSON.stringify(walk(root));
  runDualRead(['--snapshot', snap, '--root', root]);
  assert(JSON.stringify(walk(root)) === tree0, 'root tree changed — diagnostic wrote something!');
  assert(Buffer.compare(g0, readFileSync(join(root, 'dev/agent-workflow/graph.yaml'))) === 0, 'graph bytes changed');
  rmSync(root, { recursive: true, force: true }); rmSync(snap.replace('/cand.json', ''), { recursive: true, force: true });
});
function walk(d) { const o = {}; for (const e of readdirSync(d, { withFileTypes: true })) o[e.name] = e.isDirectory() ? walk(join(d, e.name)) : createHash('sha256').update(readFileSync(join(d, e.name))).digest('hex').slice(0, 12); return o; }

rmSync(mkSnap().replace('/cand.json', ''), { recursive: true, force: true });
console.log(fails === 0 ? `ALL GREEN (${ran} cases, actual count)` : `RED (${fails}/${ran} failing)`);
process.exit(fails === 0 ? 0 : 1);
