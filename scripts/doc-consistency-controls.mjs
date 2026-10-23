#!/usr/bin/env node
// EB1 positive/negative controls for the document-consistency tools
// (scripts/doc-checks.mjs, verify-agent-notes.mjs, gen-current-state.mjs,
// docs-probe.mjs, docs-sync.mjs).
//
// Why this exists: the Engineering Baseline plan requires every gate to be shown
// capable of failing for the right reason. A check that only ever prints green is
// worse than no check — it launders NOT_VERIFIED into "passed".
//
// Each scenario gets its OWN throwaway fixture Git repository under this
// worktree's gitignored .worktrees/eb1-controls-scratch/ path. Nothing is written
// into the real docs/, .agents/ or dev/ trees; no other worktree is touched.
//
//   node scripts/doc-consistency-controls.mjs [--keep] [--only <substring>]
//
// Exit codes: 0 every control behaved | 1 a control did not | 2 setup failure.
// A crashing scenario is reported FAILED, never as a pass (2026-10-23 lesson: a
// ReferenceError exit 1 nearly got logged as a successful negative control).

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWriteAllowed } from './docs-sync.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SCRATCH = join(ROOT, '.worktrees', 'eb1-controls-scratch');
const argv = process.argv.slice(2);
const KEEP = argv.includes('--keep');
const ONLY = (() => { const i = argv.indexOf('--only'); return i > -1 ? argv[i + 1].toLowerCase() : null; })();
const SYNC = 'scripts/docs-sync.mjs';
const PROBE = 'scripts/docs-probe.mjs';

const BASE_FILES = {
  'dev/engineering/registry.yaml': `schema_version: 1
entries:
  - id: EB1-CTL
    kind: work-package
    title: control fixture
    decision_status: accepted
    implementation_status: implemented_in_branch
    verification_status: not_verified
    release_status: not_released
    owners: [EB-CTL]
    refs: [EB-ADR-0001]
    verification_artifacts: []
`,
  'dev/agent-workflow/graph.yaml': `current_phase: CTL-PHASE
current_contract:
  phase_id: ctl-phase
  active_plan: docs/plans/active/ctl/plan.md
  baseline: 0000000000000000000000000000000000000000
`,
  'docs/glossary.md': `# Glossary

| id | concept | definition | must not be confused with | anchor |
| --- | --- | --- | --- | --- |
| C-EB-0001 | fixture concept | a concept used by the controls | nothing | docs/glossary.md |
`,
  'docs/terminology.md': `# Terminology

| concept | 中文 | English (preferred) | do not write | why |
| --- | --- | --- | --- | --- |
| C-EB-0001 | 夹具 | fixture | 测过 | bare "tested" wording is forbidden |
`,
  'docs/contracts/engineering-baseline/ids.yaml': `schema_version: 1
invariants:
  - id: INV-EB-0001
    normative_status: proposed-not-ratified
    text: a fixture invariant
    owners: [EB-CTL]
    source_anchor: docs/glossary.md
`,
  'docs/ideas/IDEA-EB-0001-fixture.md': `# IDEA-EB-0001 — a future capability

Unscheduled. It 将支持 a capability nobody has built, and no evidence is required
of it — that exemption is itself under test (POS-3).
`,
  '.agents/notes/README.md': '# Notes\n\nlifecycle: proposed | implemented | rejected | archived\n',
  '.agents/notes/proposed/EB-ADR-0001-fixture.md': `---
id: EB-ADR-0001
status: proposed
title: A fixture proposal
references:
  - docs/glossary.md
  - INV-EB-0001
---

## Context
Why we might do this.

## Decision
Not yet decided.

## Consequences
Unknown.
`,
  '.agents/notes/implemented/EB-ADR-0002-fixture.md': `---
id: EB-ADR-0002
status: implemented
decided: 2026-10-23
title: A fixture decision
references:
  - docs/glossary.md
verified_by:
  - dev/agent-workflow/evidence/CTL/artifact.txt
---

## Context
Why.

## Decision
We did it.

## Consequences
It holds.
`,
  'dev/engineering/doc-ownership.yaml': `schema_version: 1
owners:
  - glob: scripts/doc-checks.mjs
    docs:
      - docs/glossary.md
`,
  'dev/agent-workflow/evidence/CTL/artifact.txt': 'fixture evidence artifact\n',
  'README.md': '# fixture\n\nSee the [glossary](docs/glossary.md).\n',
};

const gitIn = (dir, a) => execFileSync('git', ['-C', dir, '-c', 'user.email=ctl@invalid', '-c', 'user.name=ctl', ...a], { encoding: 'utf8' });

function writeFile(root, rel, content) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function read(dir, rel) {
  return readFileSync(join(dir, rel), 'utf8');
}

function run(script, a) {
  try {
    const out = execFileSync(process.execPath, [join(ROOT, script), ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : 99, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

function makeFixture(slug) {
  const dir = join(SCRATCH, slug);
  rmSync(dir, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(BASE_FILES)) writeFile(dir, rel, content);
  gitIn(dir, ['init', '-q', '-b', 'main']);
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-q', '-m', 'base fixture']);
  const gen = run(SYNC, ['--write', '--root', dir]);
  if (gen.code !== 0) throw new Error(`fixture generation failed: ${gen.out}`);
  gitIn(dir, ['add', '-A']);
  gitIn(dir, ['commit', '-q', '-m', 'derived view']);
  return dir;
}

/** assert the observed exit code and that the named verdict appears (or, when
 *  want is null, that no crash text appears) */
function expectRun(label, res, wantCode, want) {
  const bad = [];
  if (res.code !== wantCode) bad.push(`exit ${res.code} != ${wantCode}`);
  if (want && !res.out.includes(want)) bad.push(`output lacks "${want}"`);
  if (/at .*\.mjs:\d+|ReferenceError|TypeError:/.test(res.out)) bad.push('crash text in output');
  return bad.length
    ? { ok: false, why: `${label}: ${bad.join('; ')}` }
    : { ok: true, why: want ? `${label}: ${wantCode === 0 ? 'clean, observed' : 'refused with'} ${want}` : `${label}: exit ${wantCode}` };
}

const results = [];
function control(name, fn) {
  if (ONLY && !name.toLowerCase().includes(ONLY)) return;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let dir = null;
  try {
    dir = makeFixture(slug);
    const parts = fn(dir) || [];
    const bad = parts.filter((p) => !p.ok);
    results.push({ name, ok: bad.length === 0, why: bad.length ? bad.map((b) => b.why).join(' | ') : parts.map((p) => p.why).join('; ') });
  } catch (e) {
    results.push({ name, ok: false, why: `control crashed: ${(e && e.message) || e}`.slice(0, 400) });
  } finally {
    if (dir && !KEEP) rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------ positive ------------------------------
control('POS-1 clean fixture passes the complete check', (d) => [
  expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 0, 'findings=0'),
]);

control('POS-2 probe covers untracked and committed changes', (d) => {
  writeFile(d, 'docs/ideas/IDEA-EB-0002-new.md', '# IDEA-EB-0002\n\nunscheduled and unevidenced by design.\n');
  const wt = run(PROBE, ['--worktree-only', '--root', d]);
  gitIn(d, ['add', '-A']);
  gitIn(d, ['commit', '-q', '-m', 'add an idea']);
  const pr = run(PROBE, ['--base', 'HEAD~1', '--root', d]);
  return [
    expectRun('worktree scope', wt, 0, 'LIMIT T0 only'),
    expectRun('committed scope', pr, 0, 'changed=1'),
  ];
});

control('POS-3 Idea and Proposed text needs no runtime evidence', (d) => [
  expectRun('proposal exemption', run(SYNC, ['--check', '--root', d]), 0, 'findings=0'),
]);

control('POS-4 --write regenerates the view only', (d) => {
  const before = read(d, 'dev/engineering/registry.yaml');
  writeFile(d, 'dev/engineering/registry.yaml', before.replace('title: control fixture', 'title: control fixture (retitled)'));
  const w = run(SYNC, ['--write', '--root', d]);
  const c = run(SYNC, ['--check', '--root', d]);
  const normativeIntact = read(d, 'dev/engineering/registry.yaml') === before.replace('title: control fixture', 'title: control fixture (retitled)');
  return [
    expectRun('--write', w, 0, 'regenerated'),
    expectRun('check after write', c, 0, 'findings=0'),
    normativeIntact ? { ok: true, why: 'normative file byte-identical' } : { ok: false, why: '--write modified the registry' },
  ];
});

// ------------------------------ negative ------------------------------
const note = (o) => `---\n${Object.entries(o).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n## Context\nx\n\n## Decision\ny\n\n## Consequences\nz\n`;

control('NEG-1 note status does not match its directory', (d) => {
  writeFile(d, '.agents/notes/implemented/EB-ADR-0003-mismatch.md', note({ id: 'EB-ADR-0003', status: 'proposed', title: 'mismatch' }));
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'NOTE_note-status-dir-mismatch')];
});

control('NEG-2 duplicate note id', (d) => {
  writeFile(d, '.agents/notes/proposed/EB-ADR-0001-twin.md', note({ id: 'EB-ADR-0001', status: 'proposed', title: 'twin' }));
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'NOTE_note-id-duplicate')];
});

control('NEG-3 implemented note whose evidence artifact is gone', (d) => {
  rmSync(join(d, 'dev/agent-workflow/evidence/CTL/artifact.txt'));
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'NOTE_note-verified-by-missing')];
});

control('NEG-4 proposal carrying a delivery claim', (d) => {
  writeFile(d, '.agents/notes/proposed/EB-ADR-0004-lies.md', note({ id: 'EB-ADR-0004', status: 'proposed', title: 'lies', verified_by: '[dev/agent-workflow/evidence/CTL/artifact.txt]' }));
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'NOTE_note-false-delivery-claim')];
});

control('NEG-5 duplicate stable id in the contract index', (d) => {
  writeFile(d, 'docs/contracts/engineering-baseline/ids.yaml', `${read(d, 'docs/contracts/engineering-baseline/ids.yaml')}  - id: INV-EB-0001\n    normative_status: proposed-not-ratified\n    text: dup\n    owners: [EB-CTL]\n    source_anchor: docs/glossary.md\n`);
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'ID_DUPLICATE')];
});

control('NEG-6 contract anchor pointing at a removed file', (d) => {
  writeFile(d, 'docs/contracts/engineering-baseline/ids.yaml', read(d, 'docs/contracts/engineering-baseline/ids.yaml').replace('source_anchor: docs/glossary.md', 'source_anchor: docs/gone.md'));
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'CONTRACT_ANCHOR_MISSING')];
});

control('NEG-7 registry claims verification with no artifact', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('verification_status: not_verified', 'verification_status: verified_local'));
  return [
    expectRun('check', run(SYNC, ['--check', '--root', d]), 1, 'FAKE_VERIFICATION'),
    expectRun('--write refuses', run(SYNC, ['--write', '--root', d]), 1, 'REFUSED write'),
  ];
});

control('NEG-8 registry names an artifact that does not exist', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml')
    .replace('verification_status: not_verified', 'verification_status: verified_local')
    .replace('verification_artifacts: []', 'verification_artifacts: [dev/agent-workflow/evidence/CTL/never-existed.txt]'));
  return [expectRun('check', run(SYNC, ['--check', '--root', d]), 1, 'ARTIFACT_MISSING')];
});

control('NEG-9 derived view left stale after a registry edit', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('title: control fixture', 'title: control fixture (edited)'));
  return [expectRun('check', run(SYNC, ['--check', '--root', d]), 1, 'STALE_GENERATED_VIEW')];
});

control('NEG-10 deprecated synonym in a current-state document', (d) => {
  writeFile(d, 'docs/STATUS.md', '# Status\n\nThe gate 测过 today.\n');
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'TERMINOLOGY_DEPRECATED')];
});

control('NEG-11 dangling relative link in a changed document', (d) => {
  writeFile(d, 'README.md', '# fixture\n\nSee the [glossary](docs/nope.md).\n');
  return [expectRun('probe', run(PROBE, ['--worktree-only', '--root', d]), 1, 'LINK_DANGLING')];
});

control('NEG-12 current-behaviour claim with no citable artifact', (d) => {
  writeFile(d, 'docs/STATUS.md', '# Status\n\nThe feature 已实现 and is delivered.\n');
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'CLAIM_WITHOUT_EVIDENCE')];
});

control('NEG-13 probe refuses an unresolvable base instead of going green', (d) => [
  expectRun('bogus base', run(PROBE, ['--base', 'refs/heads/nope', '--root', d]), 2, 'REFUSED BASE_UNRESOLVABLE'),
]);

control('NEG-14 probe refuses a missing base rather than assuming no changes', (d) => [
  expectRun('no base', run(PROBE, ['--root', d]), 2, 'REFUSED BASE_REQUIRED'),
]);

control('NEG-15 docs:sync requires an explicit mode', (d) => [
  expectRun('no mode', run(SYNC, ['--root', d]), 2, 'usage'),
]);

control('NEG-16 probe catches an uncommitted broken note', (d) => {
  writeFile(d, '.agents/notes/archived/EB-ADR-0005-orphan.md', note({ id: 'EB-ADR-0005', status: 'archived', decided: '2026-10-23', title: 'orphan' }));
  return [expectRun('probe', run(PROBE, ['--worktree-only', '--root', d]), 1, 'NOTE_note-archived-needs-successor')];
});


const planDoc = (phaseId, extra) => `# CTL plan\n\n\`\`\`yaml eb-plan\nphase_id: ${phaseId}\nactive_plan: docs/glossary.md\nevidence_root: dev/agent-workflow/evidence/CTL/\n${extra || ''}\`\`\`\n`;

control('POS-6 plan declaring a valid citation block passes', (d) => {
  writeFile(d, 'docs/plans/active/ctl/plan.md', planDoc('ctl-phase'));
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 0, 'findings=0')];
});

control('NEG-17 plan citation pointing at a path that is not there', (d) => {
  writeFile(d, 'docs/plans/active/ctl/plan.md', planDoc('ctl-phase', 'backlog: docs/plans/active/ctl/never-written.md\n'));
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'PLAN_CITATION_MISSING')];
});

control('NEG-18 plan phase_id contradicting the graph mirror', (d) => {
  writeFile(d, 'docs/plans/active/ctl/plan.md', planDoc('some-other-phase'));
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'PLAN_CITATION_CONFLICT')];
});

control('NEG-19 id ratified without naming a decision', (d) => {
  writeFile(d, 'docs/contracts/engineering-baseline/ids.yaml', read(d, 'docs/contracts/engineering-baseline/ids.yaml').replace('normative_status: proposed-not-ratified', 'normative_status: ratified'));
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'ID_RATIFIED_WITHOUT_DECISION')];
});

control('NEG-20 ratification citing a note that does not exist', (d) => {
  writeFile(d, 'docs/contracts/engineering-baseline/ids.yaml', read(d, 'docs/contracts/engineering-baseline/ids.yaml').replace('normative_status: proposed-not-ratified', 'normative_status: ratified\n    ratified_by: EB-ADR-9999'));
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 1, 'ID_RATIFIED_BY_UNKNOWN_NOTE')];
});

control('NEG-21 plan without a citation block is not a finding', (d) => {
  writeFile(d, 'docs/plans/active/ctl/plan.md', '# CTL plan\n\nprose only, no machine block.\n');
  return [expectRun('sync', run(SYNC, ['--check', '--root', d]), 0, 'plans=1(0 declaring) findings=0')];
});

control('NEG-22 probe survives a contract-index change without crashing', (d) => {
  writeFile(d, 'docs/contracts/engineering-baseline/ids.yaml', read(d, 'docs/contracts/engineering-baseline/ids.yaml').replace('text: a fixture invariant', 'text: a reworded invariant'));
  return [expectRun('probe', run(PROBE, ['--worktree-only', '--root', d]), 0, 'rules=')];
});

control('NEG-23 probe enforces ratification on a changed contract index', (d) => {
  writeFile(d, 'docs/contracts/engineering-baseline/ids.yaml', read(d, 'docs/contracts/engineering-baseline/ids.yaml').replace('normative_status: proposed-not-ratified', 'normative_status: ratified'));
  return [expectRun('probe', run(PROBE, ['--worktree-only', '--root', d]), 1, 'ID_RATIFIED_WITHOUT_DECISION')];
});


control('POS-7 changed source resolves to its declared owner document', (d) => {
  writeFile(d, 'scripts/doc-checks.mjs', 'export const touched = 1;\n');
  return [expectRun('probe', run(PROBE, ['--worktree-only', '--root', d]), 0, 'DOC_IMPACT_OWNED')];
});

control('NEG-24 owner map naming a document that does not exist', (d) => {
  writeFile(d, 'scripts/doc-checks.mjs', 'export const touched = 1;\n');
  writeFile(d, 'dev/engineering/doc-ownership.yaml', 'schema_version: 1\nowners:\n  - glob: scripts/doc-checks.mjs\n    docs:\n      - docs/deleted-owner.md\n');
  return [expectRun('probe', run(PROBE, ['--worktree-only', '--root', d]), 1, 'DOC_OWNER_DOC_MISSING')];
});

control('NEG-25 source with no owner rule is reported as unowned coverage', (d) => {
  writeFile(d, 'scripts/orphan-tool.mjs', 'export const orphan = 1;\n');
  return [expectRun('probe', run(PROBE, ['--worktree-only', '--root', d]), 0, 'DOC_IMPACT_UNOWNED')];
});

// ------------------------------ run ------------------------------
try {
  mkdirSync(SCRATCH, { recursive: true });
} catch (e) {
  console.log(`SETUP FAILURE cannot create scratch dir: ${e.message}`);
  process.exit(2);
}

const allowList = [
  { path: 'docs/contracts/engineering-baseline/ids.yaml', writable: false },
  { path: '.agents/notes/proposed/x.md', writable: false },
  { path: 'dev/agent-workflow/graph.yaml', writable: false },
  { path: 'docs/glossary.md', writable: false },
  { path: 'docs/plans/active/whatever.md', writable: false },
  { path: 'some/random/file.md', writable: false },
  { path: 'dev/engineering/current-state.json', writable: true },
].map(({ path, writable }) => isWriteAllowed(path) === writable
  ? { ok: true, why: `${path} ${writable ? 'writable' : 'refused'}` }
  : { ok: false, why: `${path} authority mismatch` });
const bad = allowList.filter((a) => !a.ok);
results.unshift({ name: 'POS-0 write authority allow-list', ok: bad.length === 0, why: bad.length ? bad.map((b) => b.why).join(' | ') : 'only the generated view is writable' });

console.log(`doc-consistency controls   fixture=${SCRATCH}${KEEP ? ' (kept)' : ''}`);
let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      ${r.why}`);
}
if (!KEEP) rmSync(SCRATCH, { recursive: true, force: true });
console.log(`controls=${results.length} failed=${failed}  scope: static document checks only (no C1/C2/C3, no runtime behaviour)`);
process.exit(failed ? 1 : 0);
