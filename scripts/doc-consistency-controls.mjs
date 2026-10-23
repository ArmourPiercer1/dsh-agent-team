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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWriteAllowed } from './docs-sync.mjs';
import { GENERATED_FILES } from './generated-write.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
// P1 safety fix: the fixture root used to be a FIXED path, and every scenario began
// by rmSync-ing it recursively. A second concurrent run, or a previous `--keep` run
// someone wanted to inspect, was therefore destroyed by whoever got there first, and
// `force: true` silenced the fact. Fixtures now live in a root created by mkdtemp for
// THIS invocation, and this process deletes nothing that it did not create.
const SCRATCH_PARENT = join(ROOT, '.worktrees');
mkdirSync(SCRATCH_PARENT, { recursive: true });
const RUN_ROOT = mkdtempSync(join(SCRATCH_PARENT, `eb1-controls-${process.pid}-`));
const OWNED = new Set([RUN_ROOT]);
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
  - glob: packages/*/src/**
    docs:
      - docs/glossary.md
`,
  'dev/engineering/registry.schema.json': JSON.stringify({
    schema_version: 1,
    properties: { entries: { items: {
      required: ['id', 'kind', 'title', 'decision_status', 'implementation_status', 'verification_status', 'release_status', 'owners'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', pattern: '^EB[0-9]-[A-Z0-9-]+$' },
        kind: { enum: ['work-package', 'implementation-pr', 'gate', 'migration'] },
        title: { type: 'string' },
        decision_status: { enum: ['proposed', 'accepted', 'rejected', 'superseded', 'pending_coordination'] },
        implementation_status: { enum: ['not_started', 'in_progress', 'implemented_in_branch', 'merged'] },
        verification_status: { enum: ['not_verified', 'verified_local', 'verified_ci', 'verified_host'] },
        release_status: { enum: ['not_released', 'candidate', 'released'] },
        owners: { type: 'array' },
        refs: { type: 'array' },
        verification_artifacts: { type: 'array' },
        verified_tier: { enum: ['C1', 'C2', 'C3'] },
        verification_commit: { type: 'string', pattern: '^[0-9a-f]{7,40}$' },
        merged_commit: { type: 'string', pattern: '^[0-9a-f]{7,40}$' },
      },
    } } },
  }, null, 2) + '\n',
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
  // Created exclusively: an existing directory is a collision to be reported, never
  // content to be deleted.
  const dir = mkdtempSync(join(RUN_ROOT, `${slug}-`));
  OWNED.add(dir);
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

/** Root's objection to the earlier form: rc=1 plus a substring match is satisfied by a
 *  WARN line even when rc=1 came from something else. This reads the printed
 *  classification instead — the code must appear on a FAIL line — and the reason line
 *  reports the whole blocking set, so a false pass would still be visible in the log. */
function expectBlocking(label, res, code, opts = {}) {
  const { detailIncludes = null } = opts;
  const bad = [];
  const codes = (prefix) => (res.out.match(new RegExp('^' + prefix + ' ([A-Z_]+)', 'gm')) || []).map((l) => l.slice(prefix.length + 1));
  const failCodes = codes('FAIL');
  const warnCodes = codes('WARN');
  if (res.code !== 1) bad.push('exit ' + res.code + ' != 1');
  if (!failCodes.includes(code)) {
    bad.push(code + ' not in blocking set [' + (failCodes.join(',') || 'empty') + ']' + (warnCodes.includes(code) ? ' (present only as WARN)' : ''));
  }
  if (detailIncludes && !((res.out.split('\n').find((l) => l.startsWith('FAIL ' + code)) || '').includes(detailIncludes))) {
    bad.push('detail lacks "' + detailIncludes + '"');
  }
  if (/at .*\.mjs:\d+|ReferenceError|TypeError:/.test(res.out)) bad.push('crash text in output');
  return bad.length
    ? { ok: false, why: label + ': ' + bad.join('; ') }
    : { ok: true, why: label + ': blocking=[' + failCodes.join(',') + ']' };
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
    // Only ever the directory this run created, and never when --keep asked for it.
    if (dir && !KEEP && OWNED.has(dir)) rmSync(dir, { recursive: true, force: true });
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


// ---- P1/P2 negative controls. Every one of these runs ONLY inside a fixture that
// this invocation created with mkdtemp. Nothing here touches the real repository:
// the "normative" files they attack are fake copies inside the fixture.

control('POS-8 a .log/.txt/.md artifact inside the evidence dir is accepted', (d) => {
  writeFile(d, 'dev/agent-workflow/evidence/CTL/run.log', 'run 1 ok\n');
  writeFile(d, 'dev/agent-workflow/evidence/CTL/notes.txt', 'observed\n');
  writeFile(d, 'dev/agent-workflow/evidence/CTL/report.md', '# observed\n');
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('verification_status: not_verified', 'verification_status: verified_local').replace('verification_artifacts: []', 'verification_artifacts: [dev/agent-workflow/evidence/CTL/run.log, dev/agent-workflow/evidence/CTL/notes.txt, dev/agent-workflow/evidence/CTL/report.md]'));
  return [expectRun('sync --write', run(SYNC, ['--write', '--root', d]), 0, 'regenerated'),
          expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 0, 'findings=0')];
});

control('NEG-26 generated path replaced by a symlink to a normative file', (d) => {
  // The link must resolve INSIDE this fixture, to the fake normative file written
  // just above. From <fixture>/dev/engineering the fixture root is two levels up;
  // the earlier '../../../AGENTS.md' pointed one level outside the fixture, which
  // meant this control was asserting a byte check on a file the link never touched.
  const target = join(d, 'AGENTS.md');
  writeFile(d, 'AGENTS.md', '# FAKE normative file inside the fixture only\n');
  rmSync(join(d, 'dev/engineering/current-state.json'));
  symlinkSync('../../AGENTS.md', join(d, 'dev/engineering/current-state.json'));
  const before = readFileSync(target, 'utf8');
  const res = run(SYNC, ['--write', '--root', d]);
  const resolved = realpathSync(join(d, 'dev/engineering/current-state.json'));
  return [
    expectRun('sync --write', res, 2, 'SYMLINK_TARGET'),
    { ok: resolved === target, why: `link resolves to ${relative(d, resolved)} of the fixture` },
    { ok: readFileSync(target, 'utf8') === before, why: 'fixture AGENTS.md bytes unchanged by the refused write' },
  ];
});

control('NEG-27 generated area reached through a symlinked parent directory', (d) => {
  // dev/engineering already exists in a fresh fixture, so linking over it raises
  // EEXIST and the parent-link case is never reached. The real directory is moved
  // aside first, so the link is planted in a slot that genuinely did not exist.
  mkdirSync(join(d, 'outside'), { recursive: true });
  writeFile(d, 'outside/AGENTS.md', '# FAKE normative file inside the fixture only\n');
  renameSync(join(d, 'dev/engineering'), join(d, 'outside/engineering'));
  symlinkSync('../outside/engineering', join(d, 'dev/engineering'));
  const view = join(d, 'outside/engineering/current-state.json');
  const viewBefore = existsSync(view) ? readFileSync(view, 'utf8') : null;
  const res = run(SYNC, ['--write', '--root', d]);
  return [
    expectRun('sync --write', res, 2, 'SYMLINK_ANCESTOR'),
    // A refusal must stay a refusal: nothing may be written through the link either.
    { ok: (existsSync(view) ? readFileSync(view, 'utf8') : null) === viewBefore, why: 'no bytes written through the linked parent while the write was refused' },
  ];
});

control('NEG-28 probe is not green when the derived view is missing', (d) => {
  rmSync(join(d, 'dev/engineering/current-state.json'));
  return [expectRun('probe', run(PROBE, ['--worktree-only', '--root', d]), 1, 'STALE_GENERATED_VIEW')];
});

control('NEG-29 probe is not green when the registry is missing', (d) => {
  rmSync(join(d, 'dev/engineering/registry.yaml'));
  return [expectRun('probe', run(PROBE, ['--worktree-only', '--root', d]), 1, 'STATE_BRIDGE_UNAVAILABLE')];
});

control('NEG-30 duplicate key in one registry entry is refused', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('    title: control fixture', '    title: control fixture\n    title: control fixture (duplicate key)'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'registry-duplicate-key')];
});

control('NEG-31 refs written as a bare scalar is refused', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('    refs: [EB-ADR-0001]', '    refs: REQ-EB-0001'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'REGISTRY_REF_SCALAR')];
});

control('NEG-32 owners written as a scalar is refused', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('    owners: [EB-CTL]', '    owners: EB-CTL'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'REGISTRY_OWNER_TYPE')];
});

control('NEG-33 an id-shaped ref that resolves nowhere is refused', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('    refs: [EB-ADR-0001]', '    refs: [INV-EB-9999]'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'REGISTRY_REF_UNRESOLVED')];
});

control('NEG-34 a verification artifact outside the controlled evidence tree', (d) => {
  writeFile(d, 'tmp-evidence.txt', 'claims to be evidence\n');
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('verification_status: not_verified', 'verification_status: verified_local').replace('verification_artifacts: []', 'verification_artifacts: [tmp-evidence.txt]'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'ARTIFACT_LOCATION_UNCONTROLLED')];
});

// ---- delivery-claim binding: a claim must cite metadata that exists elsewhere ----
control('NEG-35 verified_ci with no commit cited is refused', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('verification_status: not_verified', 'verification_status: verified_ci'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'CLAIM_UNBOUND')];
});

control('NEG-36 C1 evidence asserted as verified_host is refused', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml')
    .replace('verification_status: not_verified', 'verification_status: verified_host')
    .replace('    refs: [EB-ADR-0001]', '    refs: [EB-ADR-0001]\n    verified_tier: C1'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'CLAIM_TIER_MISMATCH')];
});

control('NEG-37 implementation_status merged with no corroborating commit', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('implementation_status: implemented_in_branch', 'implementation_status: merged'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'MERGED_CLAIM_UNCORROBORATED')];
});

control('NEG-38 release_status released without host verification at C3', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('release_status: not_released', 'release_status: released'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'RELEASE_CLAIM_UNCORROBORATED')];
});

control('NEG-39 a wrong (non-existent) verification commit is refused', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml')
    .replace('verification_status: not_verified', 'verification_status: verified_ci')
    .replace('    refs: [EB-ADR-0001]', '    refs: [EB-ADR-0001]\n    verification_commit: deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'is not a commit in this repository')];
});
/* ---- glob semantics: an exact-path control cannot stand in for wildcards ---- */
control('POS-9 wildcard owner rule matches a path across directories', (d) => {
  writeFile(d, 'packages/client/src/behaviour.ts', 'export const a = 1;\n');
  const res = run(PROBE, ['--worktree-only', '--root', d]);
  const unowned = (res.out.split('\n').find((l) => l.startsWith('ADVISORY DOC_IMPACT_UNOWNED')) || '');
  return [
    expectRun('probe', { code: res.code, out: res.out }, 0, 'DOC_IMPACT_OWNED'),
    { ok: !res.out.includes('DOC_IMPACT_UNOWNED') && !unowned.includes('packages/client/src/behaviour.ts'), why: res.out.includes('DOC_IMPACT_UNOWNED') ? 'wildcard missed it: ' + unowned : 'matched by the wildcard, nothing left unowned' },
  ];
});

control('NEG-40 a glob must not match across a path separator', (d) => {
  // packages/*/src/** names a source tree; a file one segment off must stay unowned
  // instead of being swept in by a wildcard that crosses separators.
  writeFile(d, 'packages/client/tools/behaviour.ts', 'export const a = 1;\n');
  const res = run(PROBE, ['--worktree-only', '--root', d]);
  const line = (res.out.split('\n').find((l) => l.startsWith('ADVISORY DOC_IMPACT_UNOWNED')) || '');
  return [{ ok: res.code === 0 && line.includes('packages/client/tools/behaviour.ts'), why: `unowned line: ${line || '(absent)'}` }];
});

/* ---- evidence records in prose: a log is evidence, a missing one is not ---- */
control('POS-10 a current-state document citing an existing run log is clean', (d) => {
  writeFile(d, 'dev/agent-workflow/evidence/CTL/controls-run-9.log', 'controls=1 failed=0\n');
  writeFile(d, 'dev/engineering/README.md', '# CTL engineering notes\n\nThe gate is verified; see dev/agent-workflow/evidence/CTL/controls-run-9.log.\n');
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 0, 'findings=0')];
});

control('NEG-41 citing an evidence log that was never produced', (d) => {
  writeFile(d, 'dev/engineering/README.md', '# CTL engineering notes\n\nThe gate is verified; see dev/agent-workflow/evidence/CTL/controls-run-9.log.\n');
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'CLAIM_WITHOUT_EVIDENCE')];
});

/* ---- a wrong claim must be refused at every entry point, not just checked ---- */
const badClaim = (d) => writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('verification_status: not_verified', 'verification_status: verified_ci'));

control('NEG-42 verified_ci without a commit: --write refuses, not warns', (d) => {
  badClaim(d);
  return [expectBlocking('sync --write', run(SYNC, ['--write', '--root', d]), 'CLAIM_UNBOUND')];
});

control('NEG-43 verified_ci without a commit: probe blocks', (d) => {
  badClaim(d);
  return [expectBlocking('probe', run(PROBE, ['--worktree-only', '--root', d]), 'CLAIM_UNBOUND')];
});

control('NEG-44 release claim without host verification: --write refuses', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('release_status: not_released', 'release_status: released'));
  return [expectBlocking('sync --write', run(SYNC, ['--write', '--root', d]), 'RELEASE_CLAIM_UNCORROBORATED')];
});

control('POS-11 schema and validator agree in a clean fixture', (d) => {
  // The point of the cross-check is that it stays quiet when the two descriptions
  // match; without this positive case the rule could simply be always-failing.
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 0, 'findings=0')];
});

control('NEG-48 schema drifting from the enforced enum is refused', (d) => {
  // Exactly the drift that happened for real: the documented verified_tier values
  // were the verification_status vocabulary, while the validator accepts C1|C2|C3.
  const p = 'dev/engineering/registry.schema.json';
  const j = JSON.parse(read(d, p));
  j.properties.entries.items.properties.verified_tier.enum = ['verified_local', 'verified_ci', 'verified_host'];
  writeFile(d, p, JSON.stringify(j, null, 2) + '\n');
  return [expectBlocking('sync --check', run(SYNC, ['--check', '--root', d]), 'SCHEMA_ENUM_MISMATCH')];
});

control('NEG-49 a documented field the validator does not accept is refused', (d) => {
  const p = 'dev/engineering/registry.schema.json';
  const j = JSON.parse(read(d, p));
  j.properties.entries.items.properties.owner_document = { type: 'string' };
  writeFile(d, p, JSON.stringify(j, null, 2) + '\n');
  return [expectBlocking('sync --check', run(SYNC, ['--check', '--root', d]), 'SCHEMA_FIELD_EXTRA')];
});

control('NEG-46 a second top-level entries: is refused and names the key', (d) => {
  // Same silent-loss class as a duplicated scalar, and it used to slip through because
  // the branch for this key continued before the duplicate check could see it.
  const reg = read(d, 'dev/engineering/registry.yaml');
  writeFile(d, 'dev/engineering/registry.yaml', reg + '\nentries:\n  - id: EB1-CTL-2\n    kind: gate\n    title: second block\n    decision_status: accepted\n    implementation_status: not_started\n    verification_status: not_verified\n    release_status: not_released\n    owners: [EB-CTL]\n    refs: [EB-ADR-0001]\n');
  return [expectBlocking('sync --check', run(SYNC, ['--check', '--root', d]), 'REGISTRY_PARSE', { detailIncludes: ':entries' })];
});

control('NEG-47 an entry field outside the closed set is refused', (d) => {
  // registry.schema.json has always claimed additionalProperties:false; this is the
  // rule that makes that claim true rather than aspirational.
  writeFile(d, 'dev/engineering/registry.yaml', read(d, 'dev/engineering/registry.yaml').replace('    owners: [EB-CTL]', '    ownerz: [EB-CTL]'));
  return [expectBlocking('sync --check', run(SYNC, ['--check', '--root', d]), 'REGISTRY_UNKNOWN_FIELD')];
});

control('NEG-45 duplicate top-level registry key is refused, not overwritten', (d) => {
  writeFile(d, 'dev/engineering/registry.yaml', `schema_version: 1\nschema_version: 2\nentries:\n` + read(d, 'dev/engineering/registry.yaml').split('\n').slice(1).join('\n'));
  return [expectRun('sync --check', run(SYNC, ['--check', '--root', d]), 1, 'registry-duplicate-key')];
});

// ------------------------------ run ------------------------------
// RUN_ROOT already exists: mkdtempSync created it at import time and owns it.

const boundary = [
  { path: 'dev/engineering/current-state.json', ok: true },
  { path: 'dev/engineering/registry.yaml', ok: false },
  { path: 'docs/STATUS.md', ok: false },
  { path: 'AGENTS.md', ok: false },
].map(({ path, ok }) => (GENERATED_FILES.includes(path) === ok)
  ? { ok: true, why: `${path} ${ok ? 'inside the generated area' : 'outside the generated area'}` }
  : { ok: false, why: `${path} boundary mismatch` });
const boundaryBad = boundary.filter((b) => !b.ok);
results.unshift({ name: 'POS-0b write boundary allow-list', ok: boundaryBad.length === 0, why: boundaryBad.length ? boundaryBad.map((b) => b.why).join(' | ') : 'generated-write.mjs names exactly the generated view' });

console.log(`doc-consistency controls   run_root=${relative(ROOT, RUN_ROOT)} (owned by pid ${process.pid})${KEEP ? '   --keep: left in place, nothing deleted' : ''}`);

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

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n      ${r.why}`);
}
// Sweep only our own run root. An older root, a --keep root, or anything a parallel
// run created is never touched: there is no fixed shared path any more.
if (!KEEP && OWNED.has(RUN_ROOT)) rmSync(RUN_ROOT, { recursive: true, force: true });
console.log(`controls=${results.length} failed=${failed}  scope: static document checks only (no C1/C2/C3, no runtime behaviour)`);
process.exit(failed ? 1 : 0);
