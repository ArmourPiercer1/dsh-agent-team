#!/usr/bin/env node
// S2 §7.4 CI reader candidate — ISOLATED pure-Node semantics test (NOT vitest, NOT CI).
// Semantics follow packages/testkit/test/a5-current-contract.test.ts (template read via
// git show; packages/ is absent from this sparse cone). All providers are mocks; the only
// filesystem touch is one small task-owned snapshot file plus one temp parent-module copy.
import { writeFileSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
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
const PHASE = EXAMPLE.current_contract.phase_id;
const REF_LEGACY = 'dev/agent-workflow/graph.yaml#current_contract';
const REF_SNAP = 'dev/engineering/current-authority.json';

let fails = 0, ran = 0;
const t = (n, f) => { ran += 1; try { f(); console.log(`PASS ${n}`); } catch (e) { fails += 1; console.log(`FAIL ${n}: ${e.message}`); } };
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
  '  active_plan: docs/plans/active/p.md',
  '  backlog: docs/backlog.md',
  '  matrix: docs/matrix.md',
  `  baseline: ${o.baseline ?? BASE}`,
  '  baseline_collected: 2026-10-25T00:00:00Z',
  'after: y',
].join('\n');
const providers = (o = {}) => ({
  readFile: (rel) => (o.files ?? FILES_DEFAULT).has(rel) ? o.files.get(rel) ?? FILES_DEFAULT.get(rel) : (FILES_DEFAULT.has(rel) ? FILES_DEFAULT.get(rel) : null),
  fileExists: (rel) => (o.files ?? FILES_DEFAULT).has(rel) || FILES_DEFAULT.has(rel),
  revExists: (sha) => /^[0-9a-f]{40}$/.test(sha),
  baselineCurrent: o.baselineCurrent ?? (() => true),
  driftProvider: o.driftProvider ?? (() => []),
});
const CC = EXAMPLE.current_contract;
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

t('S1 legacy default behavior byte-equal to fixed parent on clean / Q8-absent / bad-enum inputs', async () => {
  const tmp = join(REPO, 'scripts', '.tmp-gate-baseline.mjs');
  writeFileSync(tmp, execFileSync('git', ['show', `${PARENT}:scripts/ci-pr-gate.mjs`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }));
  try {
    const P = await import(pathToFileURL(tmp).href + '?v=' + Date.now());
    for (const g of [graph(), 'top: x\nno contract here\n', graph().replace('LIVE-CONFIRMED', 'ALMOST-DONE')]) {
      const a = JSON.stringify(P.checkCurrentContract({ graphText: g, ...providers() }));
      const b = JSON.stringify(gate.checkCurrentContract({ graphText: g, ...providers() }));
      assert(a === b, `findings/info differ:\nparent ${a}\ncurrent ${b}`);
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

rmSync(tmpDir, { recursive: true, force: true });
console.log(fails === 0 ? `ALL GREEN (${ran} cases, actual count)` : `RED (${fails}/${ran} failing)`);
process.exit(fails === 0 ? 0 : 1);
