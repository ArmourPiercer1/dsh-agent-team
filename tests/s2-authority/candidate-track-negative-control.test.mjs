#!/usr/bin/env node
// Candidate track (owner ruling 2026-11-06) — NEGATIVE CONTROL, implemented against the
// CURRENT gate, without changing its semantics.
//
// The proposed additive scheme (docs/plans/active/alpha5-sandbox-first/
// current-implementation-plan.md section 7) lets a row carry a candidate-scoped claim
//     verifiedFor: <candidate-id>@<40-hex sha>
// alongside the unchanged V@B column. The one law the scheme must never lose is:
//
//     a candidate claim NEVER satisfies a master claim.
//
// This file pins the half of that law the current gate already enforces, and it is a
// NEGATIVE CONTROL in the strict sense: it PASSES today and FAILS if a future parser
// using `verifiedFor` starts COUNTING a candidate-annotated row as master-current (for
// example by excluding such rows from the Q7 drift set without adding a master-scope
// refusal). In that regression the Q7 finding below disappears and this file goes RED.
//
// Scope honesty: the parser does not read `verifiedFor` yet, so the red asserted here is
// produced by the EXISTING master-context law (V@B=yes + product drift since the
// Authority baseline). When the parser lands, this file must be TIGHTENED to assert the
// named refusal for `verifiedFor` + V@B=yes (a drift-independent red), not deleted.
//
// Pure Node, mocked providers, no git, no filesystem writes: run with
//     node tests/s2-authority/candidate-track-negative-control.test.mjs

import * as gate from '../../scripts/ci-pr-gate.mjs';

const PHASE = 'alpha5-sandbox-first';
const REF = 'dev/engineering/current-authority.json';
const BASELINE = '1484fa4ee0ff9326a3dafcac060bf63f8d334a1f';
const CAND_SHA = '25e106b4573cac0ab624c7e0bc5ca7d36dba3730';
const CAND_CLAIM = `verifiedFor: cand-a5sf-fs-search-1@${CAND_SHA}`;
const EVIDENCE = 'dev/agent-workflow/evidence/a5sf-candidate1/run-record.json';
const PLAN = 'docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md';
const BACKLOG = 'docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md';
const MATRIX = 'docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md';
const DRIFT = ['packages/runtime/team-services/src/subprocess.ts'];

let fails = 0;
let ran = 0;
const t = (name, fn) => {
  ran += 1;
  try { fn(); console.log(`PASS ${name}`); }
  catch (e) { fails += 1; console.log(`FAIL ${name}: ${e.message}`); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const carrier = () => `<!-- phase-baseline-ref: ${REF} -->\n<!-- phase-identity: ${PHASE} -->\n# doc\n`;
const matrixDoc = (row) => [
  '<!-- q5:main-begin -->',
  '| ①行ID | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | V@B |',
  '|---|---|---|---|---|---|---|---|---|',
  row,
  '<!-- q5:main-end -->',
  '<!-- q5:appendix-begin -->',
  '- **read** [native] → (M-01)',
  '<!-- q5:appendix-end -->',
].join('\n');

// cells: ① row id | ② | ③ | ④ | ⑤ | ⑥ verification | ⑦ | ⑧ level | V@B
const row = ({ claim = '', vab = 'yes', level = 'ENFORCE-PARTIAL' }) =>
  `| read (M-01) | #581 | service-mediated:fs | lane | ask | ${claim}${claim === '' ? '' : '；'}tested ${BASELINE}；证据=${EVIDENCE} | none | ${level} | ${vab} |`;

const files = (m) => new Map([
  ['AGENTS.md', carrier()],
  [PLAN, carrier()],
  [BACKLOG, carrier() + '\nBL-42 open\n'],
  [MATRIX, carrier() + '\n' + m],
]);

const grade = ({ rowText, drift }) => gate.checkContractValues({
  phaseId: PHASE,
  activePlan: PLAN,
  backlogPath: BACKLOG,
  matrixPath: MATRIX,
  baseline: BASELINE,
  collected: '2026-11-05T12:16:56Z',
  graphText: [
    'current_phase: "ALPHA.5 SANDBOX-FIRST PHASE — MEMBER x TOOL TWO-AXIS CEILINGS"',
    'state_convergence: "HISTORICAL"',
    'ready: [BL-42]',
    'blocked: []',
  ].join('\n'),
  phaseStatement: 'ALPHA.5 SANDBOX-FIRST PHASE — MEMBER x TOOL TWO-AXIS CEILINGS',
  readFile: (rel) => files(matrixDoc(rowText)).get(rel) ?? null,
  fileExists: (rel) => files(matrixDoc(rowText)).has(rel) || rel === EVIDENCE,
  revExists: () => true,
  baselineCurrent: () => true,
  driftProvider: () => drift,
  expectedBaselineRef: REF,
});

// ── N1 — THE NEGATIVE CONTROL ────────────────────────────────────────────────────────
// A row that carries a candidate claim AND claims to be current at the Authority baseline,
// while the product surface moved since that baseline, must be RED. If a parser ever lets
// the candidate annotation excuse the row from the master-context Q7 check, this goes green
// and the control fails.
t('N1 candidate claim + V@B=yes + master product drift => RED (Q7 names the row)', () => {
  const r = grade({ rowText: row({ claim: CAND_CLAIM, vab: 'yes' }), drift: DRIFT });
  assert(
    r.findings.some((f) => /^Q7:/.test(f) && f.includes('read (M-01)')),
    `expected a Q7 finding naming read (M-01); got ${JSON.stringify(r.findings)}`,
  );
});

// ── N1-control — the red above is the EXISTING master-context law, not the annotation ──
// Same row shape without the candidate claim must produce the same class of red, so N1
// cannot be satisfied by a gate that simply ignores ⑥ text.
t('N1-control same row without candidate claim => the same Q7 red (annotation is not what makes it pass)', () => {
  const r = grade({ rowText: row({ vab: 'yes' }), drift: DRIFT });
  assert(
    r.findings.some((f) => /^Q7:/.test(f) && f.includes('read (M-01)')),
    `expected the baseline Q7 red without any candidate claim; got ${JSON.stringify(r.findings)}`,
  );
});

// ── N2 — the candidate track itself must not infect master ───────────────────────────
// A row scoped to a candidate (V@B=no) does not claim master currentness, so master drift
// must NOT turn it red. This is the coexistence half: candidate rows and master rows can
// share one matrix file.
t('N2 candidate claim + V@B=no + master drift => master gate stays GREEN (tracks coexist)', () => {
  const r = grade({ rowText: row({ claim: CAND_CLAIM, vab: 'no' }), drift: DRIFT });
  assert(r.findings.length === 0, `candidate-scoped row must not redden the master contract; got ${JSON.stringify(r.findings)}`);
});

// ── N3 — no drift, no candidate claim: the baseline green must stay green ─────────────
t('N3 current row + no drift => GREEN (the control is not vacuous)', () => {
  const r = grade({ rowText: row({ vab: 'yes' }), drift: [] });
  assert(r.findings.length === 0, `clean master row must grade zero findings; got ${JSON.stringify(r.findings)}`);
});

console.log(fails === 0 ? `ALL GREEN (${ran} cases)` : `RED (${fails}/${ran} failing)`);
process.exit(fails === 0 ? 0 : 1);
