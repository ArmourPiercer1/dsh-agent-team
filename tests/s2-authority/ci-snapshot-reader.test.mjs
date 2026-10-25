#!/usr/bin/env node
// S2 §7.4 CI reader candidate — ISOLATED pure-Node semantics test (NOT vitest, NOT CI).
// Semantics follow packages/testkit/test/a5-current-contract.test.ts (template read via
// git show; packages/ is absent from this sparse cone). All providers are mocks; the only
// filesystem touch is one small task-owned snapshot file plus one temp parent-module copy.
import { writeFileSync, readFileSync, rmSync, mkdtempSync, openSync, writeSync, closeSync, mkdirSync} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as gate from '../../scripts/ci-pr-gate.mjs';
import { snapshotDigest } from '../../scripts/authority-snapshot.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const REPO = resolve(here, '../..');
const PARENT = '3d6f6aad8b3042d4ce6ff2a844ff2778e200a5db';
const EXAMPLE = JSON.parse(readFileSync(join(here, 'snapshot-example.json'), 'utf8'));
const BASE = EXAMPLE.current_contract.baseline;
const CC = EXAMPLE.current_contract;
const PHASE = EXAMPLE.current_contract.phase_id;
const REF_LEGACY = 'dev/agent-workflow/graph.yaml#current_contract';
const REF_SNAP = 'dev/engineering/current-authority.json';

let fails = 0, ran = 0;
const pending = [];
const t = (n, f) => {
  ran += 1;
  try {
    const r = f();
    if (r && typeof r.then === 'function') pending.push(r.then(() => console.log(`PASS ${n}`), (e) => { fails += 1; console.log(`FAIL ${n}: ${e.message}`); }));
    else console.log(`PASS ${n}`);
  } catch (e) { fails += 1; console.log(`FAIL ${n}: ${e.message}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const carrier = (ref) => `<!-- phase-baseline-ref: ${ref} -->\n<!-- phase-identity: ${PHASE} -->\n# doc\n`;
const matrix = (row) => ['<!-- q5:main-begin -->', '| ①行ID | ref | plane | ok | ask | ⑥ | ⑦ | ⑧ | V@B |', '|---|---|---|---|---|---|---|---|---|', row, '<!-- q5:main-end -->', '<!-- q5:appendix-begin -->', '- **tool-x** [host] (M-01)', '<!-- q5:appendix-end -->'].join('\n');
const GOOD_ROW = '| read (M-01) | #353 | plane | ok | ask | 真实Host @' + BASE.slice(0, 9) + '；证据=' + EXAMPLE.current_contract.backlog + ' | none | LIVE-CONFIRMED(scope=x) | yes |';
const graph = (o = {}) => [
  'top: x',
  'current_phase: "ALPHA.5 TOOL-IO-GOVERNANCE PHASE — EXECUTION (authority = current_contract)"',
  'state_convergence: "HISTORICAL"',
  `ready: [${o.ready ?? 'BL-1'}]`,
  'blocked: []',
  'current_contract:',
  `  phase_id: ${o.phase_id ?? PHASE}`,
  `  active_plan: ${CC.active_plan}`,
  `  backlog: ${CC.backlog}`,
  `  matrix: ${CC.matrix}`,
  `  baseline: ${o.baseline ?? BASE}`,
  '  baseline_collected: 2026-10-25T00:00:00Z',
  'after: y',
].join('\n');
const providers = (o = {}) => ({
  readFile: (rel) => { const m = o.files ?? FILES_DEFAULT; return m.has(rel) ? m.get(rel) : null; },
  fileExists: (rel) => (o.files ?? FILES_DEFAULT).has(rel),
  revExists: (sha) => /^[0-9a-f]{40}$/.test(sha),
  baselineCurrent: o.baselineCurrent ?? (() => true),
  driftProvider: o.driftProvider ?? (() => []),
});
const FILES_DEFAULT = new Map([
  ['AGENTS.md', carrier(REF_LEGACY)],
  [CC.active_plan, carrier(REF_LEGACY)],
  [CC.backlog, carrier(REF_LEGACY) + '\nBL-1 open\n'],
  [CC.matrix, carrier(REF_LEGACY) + '\n' + matrix(GOOD_ROW)],
]);
const snapFiles = (ref = REF_SNAP, row = GOOD_ROW) => new Map([
  ['AGENTS.md', carrier(ref)],
  [CC.active_plan, carrier(ref)],
  [CC.backlog, carrier(ref) + '\nBL-1 open\n'],
  [CC.matrix, carrier(ref) + '\n' + matrix(row)],
]);
const snapProviders = (o = {}) => { const { ref, row, files, ...rest } = o; return providers({ ...rest, files: files ?? snapFiles(ref, row) }); };

t('S1 legacy default: three states first graded honestly, then byte-compared to fixed parent 3d6f', async () => {
  // incident-correction 2026-10-25: EXCLUSIVE unique creation, kept inside scripts/ so the
  // module's own './x.mjs' relative imports still resolve to their real siblings.
  const tmp = join(REPO, 'scripts', `.tmp-gate-baseline-${PARENT.slice(0, 8)}-${process.pid}-${Math.random().toString(36).slice(2, 10)}.mjs`);
  { const fd = openSync(tmp, 'wx'); try { writeSync(fd, execFileSync('git', ['show', `${PARENT}:scripts/ci-pr-gate.mjs`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' })); } finally { closeSync(fd); } }
  try {
    const P = await import(pathToFileURL(tmp).href + '?v=' + Date.now());
    const badMatrix = new Map(FILES_DEFAULT);
    badMatrix.set(CC.matrix, carrier(REF_LEGACY) + '\n' + matrix(GOOD_ROW.replace('LIVE-CONFIRMED', 'ALMOST-DONE')));
    const cases = [
      ['clean', { graphText: graph(), ...providers() }],
      ['q8-absent', { graphText: 'top: x\nno contract here\n', ...providers() }],
      ['bad-enum', { graphText: graph(), ...providers({ files: badMatrix }) }],
    ];
    const clean = gate.checkCurrentContract(cases[0][1]);
    assert(clean.findings.length === 0, `clean fixture must grade ZERO findings — got ${JSON.stringify(clean.findings)}`);
    const be = gate.checkCurrentContract(cases[2][1]);
    assert(be.findings.some((f) => f.includes('Q5') && /closed enum/.test(f)), `bad-enum fixture must carry the Q5 enum finding — got ${JSON.stringify(be.findings.map((f) => f.slice(0, 40)))}`);
    for (const [label, args] of cases) {
      const a = JSON.stringify(P.checkCurrentContract(args));
      const b = JSON.stringify(gate.checkCurrentContract(args));
      assert(a === b, `${label}: parent/current findings+info differ:\nparent ${a}\ncurrent ${b}`);
    }
  } finally { rmSync(tmp, { force: true }); }
});

const tmpDir = mkdtempSync(join(REPO, '.tmp-s2-cir-'));
const snapFile = (obj) => { const p = join(tmpDir, `s-${Math.random().toString(36).slice(2)}.json`); writeFileSync(p, JSON.stringify(obj)); return p; };
const withStmt = (extra = {}) => { const o = { ...EXAMPLE, ...extra }; o.content_digest = snapshotDigest(o); return o; };
const snapCall = (o) => gate.checkSnapshotCurrentContract({ graphText: o.graph ?? graph(), ...providers(o) , ...o.args });

t('S2 bad candidate inputs refuse with named codes and grade nothing (no skip, no fallback)', () => {
  assert(typeof gate.checkSnapshotCurrentContract === 'function', 'checkSnapshotCurrentContract not exported yet');
  let r = gate.checkSnapshotCurrentContract({ snapshotPath: join(tmpDir, 'nope.json'), expectedDigest: EXAMPLE.content_digest, graphText: graph(), ...providers() });
  assert(r.findings.length === 1 && /CANDIDATE_MISSING/.test(r.findings[0]) && r.info.contract === undefined, JSON.stringify(r));
  r = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(EXAMPLE), expectedDigest: `sha256:${'1'.repeat(64)}`, graphText: graph(), ...providers() });
  assert(r.findings.length === 1 && /CANDIDATE_(EXPECTED_VS_RECORDED|DIGEST_MISMATCH)/.test(r.findings[0]), JSON.stringify(r));
});

t('S3 snapshot without current_phase_statement: new entry refuses; nothing borrowed from graph', () => {
  assert(typeof gate.checkSnapshotCurrentContract === 'function', 'not implemented');
  const noStmt = { ...EXAMPLE }; delete noStmt.current_phase_statement; noStmt.content_digest = snapshotDigest(noStmt);
  const r = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(noStmt), expectedDigest: noStmt.content_digest, graphText: graph(), ...providers() });
  assert(r.findings.length === 1 && /statement/i.test(r.findings[0]) && /refuse/i.test(r.findings[0]), JSON.stringify(r));
  assert(r.info.contract === undefined, 'graded a view from a statement-less snapshot');
});

t('S4 legal snapshot + real graph: clean; missing target and non-ancestor baseline still graded', () => {
  assert(typeof gate.checkSnapshotCurrentContract === 'function', 'not implemented');
  const r = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(EXAMPLE), expectedDigest: EXAMPLE.content_digest, graphText: graph(), ...snapProviders() });
  assert(r.findings.length === 0, `clean snapshot path not green: ${JSON.stringify(r.findings)}`);
  assert(r.info.contract && r.info.contract.backlog === EXAMPLE.current_contract.backlog && r.info.contract.matrix === EXAMPLE.current_contract.matrix, 'info.contract must carry all six fields (no 4-field reverse-derivation): ' + JSON.stringify(r.info.contract));
  const badTarget = withStmt({ current_contract: { ...EXAMPLE.current_contract, active_plan: 'docs/plans/active/missing.md' } });
  const r2 = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(badTarget), expectedDigest: badTarget.content_digest, graphText: graph({}), ...snapProviders() });
  assert(r2.findings.some((f) => f.includes('Q2') && /target does not exist/.test(f)), JSON.stringify(r2.findings));
  const r3 = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(EXAMPLE), expectedDigest: EXAMPLE.content_digest, graphText: graph(), ...snapProviders({ baselineCurrent: () => false }) });
  assert(r3.findings.some((f) => f.includes('Q4') && /neither HEAD nor an ancestor/.test(f)), JSON.stringify(r3.findings));
});

t('S5 real graph feeds the core: phantom BL-999 in ready[] is graded, never swallowed', () => {
  assert(typeof gate.checkSnapshotCurrentContract === 'function', 'not implemented');
  const r = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(EXAMPLE), expectedDigest: EXAMPLE.content_digest, graphText: graph({ ready: 'BL-999' }), ...snapProviders() });
  assert(r.findings.some((f) => /BL-999/.test(f) && /phantom|does not exist in the backlog/.test(f)), JSON.stringify(r.findings));
});

t('S6 matrix enum red and Q6 single expected ref: snapshot mode fixes current-authority.json', () => {
  assert(typeof gate.checkSnapshotCurrentContract === 'function', 'not implemented');
  const r = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(EXAMPLE), expectedDigest: EXAMPLE.content_digest, graphText: graph(), ...snapProviders({ row: GOOD_ROW.replace('LIVE-CONFIRMED', 'ALMOST-DONE') }) });
  assert(r.findings.some((f) => f.includes('Q5') && /closed enum/.test(f)), JSON.stringify(r.findings.map((f) => f.slice(0, 40))));
  const r2 = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(EXAMPLE), expectedDigest: EXAMPLE.content_digest, graphText: graph(), ...snapProviders({ ref: REF_LEGACY }) });
  const q6 = r2.findings.filter((f) => f.includes('Q6') && f.includes(REF_SNAP));
  assert(q6.length === 4, `snapshot mode must fix expectedBaselineRef to ${REF_SNAP} for all four carriers, got ${String(q6.length)}: ${JSON.stringify(r2.findings.filter((f) => f.includes('Q6')))}`);
});

t('S7 drift=null is Q7 fail; NEEDS_REVALIDATION with V@B=yes is contradiction (via snapshot path)', () => {
  assert(typeof gate.checkSnapshotCurrentContract === 'function', 'not implemented');
  const r = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(EXAMPLE), expectedDigest: EXAMPLE.content_digest, graphText: graph(), ...snapProviders({ driftProvider: () => null }) });
  assert(r.findings.some((f) => f.includes('Q7') && /failed to run/.test(f)), JSON.stringify(r.findings.map((f) => f.slice(0, 50))));
  const r2 = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(EXAMPLE), expectedDigest: EXAMPLE.content_digest, graphText: graph(), ...snapProviders({ row: GOOD_ROW.replace('LIVE-CONFIRMED', 'NEEDS_REVALIDATION') }) });
  assert(r2.findings.some((f) => f.includes('Q7') && /NEEDS_REVALIDATION.*V@B=yes|expired/.test(f)), JSON.stringify(r2.findings.map((f) => f.slice(0, 60))));
});

t('S8 half-given CLI pair: named refusal exit 2 before any leg runs', () => {
  let out = '', code = 0;
  try { execFileSync('node', ['scripts/ci-pr-gate.mjs', '--authority-candidate', '/tmp/nonexistent.json'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = (e.stdout ?? '') + (e.stderr ?? ''); code = e.status; }
  assert(code === 2 && /AUTHORITY_CANDIDATE_ARGS_INCOMPLETE/.test(out), `exit=${code} out=${out.slice(0, 160)}`);
});

t('S9 correct-digest statement with an embedded revision: shared loader refuses CANDIDATE_STATEMENT_SEMANTICS, grades nothing', () => {
  const bad = withStmt({ current_phase_statement: 'ALPHA.5 TOOL-IO-GOVERNANCE PHASE — master=abcdef1 integration' });
  const r = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(bad), expectedDigest: bad.content_digest, graphText: graph(), ...snapProviders() });
  assert(r.findings.length === 1 && /CANDIDATE_STATEMENT_SEMANTICS/.test(r.findings[0]) && /revision/.test(r.findings[0]), JSON.stringify(r.findings));
  assert(r.info.contract === undefined, 'graded a snapshot whose statement is banned');
});

t('S10 correct-digest statement with PR census: refused the same way (a correct digest is not absolution)', () => {
  const bad = withStmt({ current_phase_statement: 'ALPHA.5 TOOL-IO-GOVERNANCE PHASE — PR #353 merged integration' });
  const r = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(bad), expectedDigest: bad.content_digest, graphText: graph(), ...snapProviders() });
  assert(r.findings.length === 1 && /CANDIDATE_STATEMENT_SEMANTICS/.test(r.findings[0]) && /PR census/.test(r.findings[0]), JSON.stringify(r.findings));
  assert(r.info.contract === undefined, 'graded a snapshot whose statement is banned');
});

t('S11 collision negative: a fixed-name second exclusive create fails; unique names + mkdtemp do not', () => {
  const d = mkdtempSync(join(REPO, '.tmp-s2-cir-'));
  const fixed = join(d, 'same.mjs');
  const fd = openSync(fixed, 'wx'); closeSync(fd);
  let threw = null;
  try { openSync(fixed, 'wx'); } catch (e) { threw = e.code; }
  assert(threw === 'EEXIST', `second wx open on a fixed name must throw EEXIST (the collision this fix exists for), got ${threw}`);
  const a = mkdtempSync(join(REPO, '.tmp-s2-cir-')); const b = mkdtempSync(join(REPO, '.tmp-s2-cir-'));
  assert(a !== b, 'mkdtemp must hand out distinct paths');
  rmSync(d, { recursive: true, force: true }); rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true });
});

t('S12 CI candidate dual-reads the graph SIX fields vs the real legacy source; divergence is its own red', () => {
  // a legacy-source root holding the REAL six-field graph block + registry (pure reads; no git needed)
  const lroot = mkdtempSync(join(REPO, '.tmp-s2-cir-'));
  const lw = (rel, txt) => { mkdirSync(join(lroot, ...rel.split('/').slice(0, -1)), { recursive: true }); writeFileSync(join(lroot, rel), txt); };
  lw('dev/agent-workflow/graph.yaml', `top: x\ncurrent_contract:\n${Object.entries(EXAMPLE.current_contract).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\nafter: y\n`);
  lw('dev/engineering/registry.yaml', 'schema_version: 1\ngenerated_view: dev/engineering/current-state.json\nlegacy_execution_authority: dev/agent-workflow/graph.yaml#current_contract\nmigration_of_legacy_consumers: not_started\n\nentries: []\n');
  const clean = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(EXAMPLE), expectedDigest: EXAMPLE.content_digest, graphText: graph(), root: lroot, ...snapProviders() });
  assert(clean.findings.length === 0, `aligned legacy source must add no dual findings: ${JSON.stringify(clean.findings.map((f) => f.slice(0, 50)))}`);
  const div = withStmt({ current_contract: { ...EXAMPLE.current_contract, phase_id: 'alpha5-divergent-slug' } });
  const r = gate.checkSnapshotCurrentContract({ snapshotPath: snapFile(div), expectedDigest: div.content_digest, graphText: graph(), root: lroot, ...snapProviders() });
  rmSync(lroot, { recursive: true, force: true });
  assert(r.refused === 'SNAPSHOT_VS_LEGACY_DIVERGENT', `refused=${r.refused} findings=${JSON.stringify(r.findings.map((f) => f.slice(0, 50)))}`);
  assert(r.findings.length === 1 && r.findings[0].startsWith('DUAL_READ_SNAPSHOT_VS_LEGACY_VALUE'), JSON.stringify(r.findings.map((f) => f.slice(0, 60))));
  assert(r.info.contract === undefined, 'divergent candidate graded anyway');
});

t('S13 state-pointers continuity: the historical current_phase requirement still fires (retirement must be a coordinated later transaction, not silent)', () => {
  const r = gate.checkStatePointers({ graphText: 'top: x\nno_phase_here: 1\n', logText: '', isAncestor: () => true });
  assert(r.findings.some((f) => /current_phase/.test(f)), JSON.stringify(r.findings));
});

await Promise.all(pending);
rmSync(tmpDir, { recursive: true, force: true });
console.log(fails === 0 ? `ALL GREEN (${ran} cases, actual count)` : `RED (${fails}/${ran} failing)`);
process.exit(fails === 0 ? 0 : 1);
