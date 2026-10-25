#!/usr/bin/env node
// S2 §7.4 docs:sync explicit-candidate --check + census baseline resolver — ISOLATED test.
// Real CLI exits captured directly; async cases awaited (no fake-green counters).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as buildStateView, renderView } from '../../scripts/gen-current-state.mjs';
import { snapshotDigest } from '../../scripts/authority-snapshot.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const REPO = resolve(here, '../..');
const PARENT = '61df0b424df27d2a1d5cffaa7038da309dee7307';
const CLOSURE = ['docs-sync', 'gen-current-state', 'doc-checks', 'contracts-field-agreement', 'verify-agent-notes', 'generated-write', 'authority-candidate-source', 'authority-snapshot', 'authority-contract-fields', 'authority-dual-read'];
const EXAMPLE = JSON.parse(readFileSync(join(here, 'snapshot-example.json'), 'utf8'));
const CC = EXAMPLE.current_contract;
const carrier = `<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract -->\n<!-- phase-identity: ${CC.phase_id} -->\n# doc\n`;

let fails = 0, ran = 0;
const pending = [];
const t = (n, f) => {
  ran += 1;
  try { const r = f(); if (r && typeof r.then === 'function') pending.push(r.then(() => console.log(`PASS ${n}`), (e) => { fails += 1; console.log(`FAIL ${n}: ${e.message}`); })); else console.log(`PASS ${n}`); }
  catch (e) { fails += 1; console.log(`FAIL ${n}: ${e.message}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };
const roots = [];
const run = (script, a) => { try { const out = execFileSync('node', [script, ...a], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); return { code: 0, out, err: '' }; } catch (e) { return { code: e.status, out: e.stdout ?? '', err: e.stderr ?? '' }; } };

const mkRoot = ({ planPhase = CC.phase_id, graphOver = {}, mirrorFromCandidate = false } = {}) => {
  const root = mkdtempSync(join(REPO, '.tmp-s2-sy-')); roots.push(root);
  const w = (rel, txt) => { mkdirSync(join(root, ...rel.split('/').slice(0, -1)), { recursive: true }); writeFileSync(join(root, rel), txt); };
  const vals = { ...CC, ...graphOver };
  w('dev/agent-workflow/graph.yaml', `top: x\ncurrent_phase: "ALPHA.5 TOOL-IO-GOVERNANCE PHASE — EXECUTION"\nstate_convergence: "HISTORICAL"\nready: [BL-1]\nblocked: []\ncurrent_contract:\n${Object.entries(vals).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\nafter: y\n`);
  w('dev/engineering/registry.yaml', 'schema_version: 1\ngenerated_view: dev/engineering/current-state.json\nlegacy_execution_authority: dev/agent-workflow/graph.yaml#current_contract\nmigration_of_legacy_consumers: not_started\n\nentries:\n  - id: EB0-1\n    kind: work-package\n    title: Fixture package\n    decision_status: accepted\n    implementation_status: in_progress\n    verification_status: not_verified\n    release_status: not_released\n    owners: [Audit/Contract Reader]\n    refs: []\n    verification_artifacts: []\n');
  w('dev/engineering/registry.schema.json', readFileSync(join(REPO, 'dev/engineering/registry.schema.json'), 'utf8'));
  w('docs/contracts/engineering-baseline/ids.yaml', 'ids:\n  - id: EB0-1\n');
  w('docs/glossary.md', '# glossary\nbaseline word\n');
  w(CC.active_plan, `# plan\n\n\`\`\`yaml eb-plan\nphase_id: ${planPhase}\nactive_plan: ${CC.active_plan}\nbacklog: ${CC.backlog}\nmatrix: ${CC.matrix}\nevidence_root: dev/agent-workflow\n\`\`\`\n`);
  w(CC.backlog, carrier + 'BL-1 open\n');
  w(CC.matrix, carrier + '\n# matrix\n');
  w('AGENTS.md', carrier);
  mkdirSync(join(root, '.agents/notes'), { recursive: true });
  w('candidate.json', JSON.stringify(EXAMPLE));
  const g = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  g('init', '-q', '-b', 'main'); g('add', '-A'); g('-c', 'user.name=t', '-c', 'user.email=t@l', 'commit', '-q', '-m', 'base');
  // the view embeds git-reality probes (baseline_exists/ancestor) — render the positive
  // control only AFTER the repo exists so fixture and check observe the same git state
  if (mirrorFromCandidate) writeFileSync(join(root, 'dev/engineering/current-state.json'), renderView(buildStateView(root, { authorityCandidate: { file: join(root, 'candidate.json'), expectedDigest: EXAMPLE.content_digest } })));
  return root;
};
const walk = (d) => readdirSync(d, { recursive: true, encoding: 'utf8' }).filter((p) => statSync(join(d, p)).isFile() && !p.startsWith('.git')).sort().map((p) => `${p}:${createHash('sha256').update(readFileSync(join(d, p))).digest('hex')}`).join('\n');
const candArgs = (root, extra = []) => ['--root', root, '--check', '--authority-candidate', join(root, 'candidate.json'), '--authority-expected-digest', EXAMPLE.content_digest, ...extra];

t('T1 default --check byte-identical to fixed parent 61df closure on same fixture', async () => {
  const root = mkRoot({});
  const tmp = mkdtempSync(join(REPO, '.tmp-s2-syp-'));
  for (const m of CLOSURE) writeFileSync(join(tmp, `${m}.mjs`), execFileSync('git', ['show', `${PARENT}:scripts/${m}.mjs`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }));
  const a = run(join(tmp, 'docs-sync.mjs'), ['--root', root, '--check']);
  const b = run('scripts/docs-sync.mjs', ['--root', root, '--check']);
  assert(a.code === b.code && a.out === b.out, `exit ${a.code}/${b.code} or stdout differs:\n--parent--\n${a.out.slice(0, 300)}\n--current--\n${b.out.slice(0, 300)}`);
  rmSync(tmp, { recursive: true, force: true });
});

t('T2 candidate --check on candidate-rendered mirror: binding recorded, no STALE/DUAL_READ/PLAN conflict', () => {
  const root = mkRoot({ mirrorFromCandidate: true });
  const r = run('scripts/docs-sync.mjs', candArgs(root));
  const j = { out: r.out };
  assert(r.code === 0, `exit=${r.code}\n${r.out}`);
  assert(/authority_source_binding|AUTHORITY_SOURCE_BINDING/.test(r.out), 'no source binding in output');
  assert(!/STALE_GENERATED_VIEW|DUAL_READ_|PLAN_CITATION|CANDIDATE_/.test(r.out), `unexpected findings:\n${r.out}`);
});

t('T3 candidate mirror feeds the existing plan-citation rule: divergent phase_id gets PLAN_CITATION_CONFLICT', () => {
  const root = mkRoot({ planPhase: 'alpha6-divergent', mirrorFromCandidate: true });
  const r = run('scripts/docs-sync.mjs', candArgs(root));
  assert(r.code === 1 && /PLAN_CITATION_CONFLICT/.test(r.out) && /alpha6-divergent/.test(r.out), `exit=${r.code}\n${r.out.slice(0, 400)}`);
});

t('T4 missing digest flag and empty values: named refusal, never a silent legacy --check', () => {
  const root = mkRoot({});
  let r = run('scripts/docs-sync.mjs', ['--root', root, '--check', '--authority-candidate', join(root, 'candidate.json')]);
  assert(r.code === 2 && /AUTHORITY_CANDIDATE_ARGS_INCOMPLETE/.test(r.out + r.err), `one-sided: exit=${r.code} ${r.out.slice(0, 140)}`);
  r = run('scripts/docs-sync.mjs', ['--root', root, '--check', '--authority-candidate', '', '--authority-expected-digest', '']);
  assert(r.code !== 0 && /CANDIDATE_/.test(r.out) && !/authority_source_binding|AUTHORITY_SOURCE_BINDING/.test(r.out), `empty pair: exit=${r.code} ${r.out.slice(0, 200)}`);
});

t('T5 candidate + --write: refused exit 2 with zero filesystem side effects', () => {
  const root = mkRoot({});
  const before = walk(root);
  const r = run('scripts/docs-sync.mjs', ['--root', root, '--write', '--authority-candidate', join(root, 'candidate.json'), '--authority-expected-digest', EXAMPLE.content_digest]);
  assert(r.code === 2 && /CANDIDATE_WRITE_REFUSED/.test(r.out), `exit=${r.code} ${r.out.slice(0, 160)}`);
  assert(walk(root) === before, '--write refusal touched files');
});

t('T6 dual-read divergence blocks candidate --check (graph vs snapshot, named, no auto-pick)', () => {
  const root = mkRoot({ graphOver: { phase_id: 'alpha6-divergent' }, mirrorFromCandidate: true });
  const r = run('scripts/docs-sync.mjs', candArgs(root));
  assert(r.code === 1 && /DUAL_READ_SNAPSHOT_VS_LEGACY_VALUE/.test(r.out), `exit=${r.code} ${r.out.slice(0, 300)}`);
});

t('T7 plain --write unchanged: creates then byte no-ops on the same fixture (legacy chain)', () => {
  const root = mkRoot({});
  const a = run('scripts/docs-sync.mjs', ['--root', root, '--write']);
  const b = run('scripts/docs-sync.mjs', ['--root', root, '--write']);
  assert(a.code === 0 && b.code === 0, `exit ${a.code}/${b.code}`);
  assert(/regenerated|no-op/.test(a.out) && /no-op/.test(b.out), `${a.out}\n${b.out}`);
  assert(/normative files untouched/.test(b.out), 'write message changed');
});

t('T8 baseline resolver: exact one-line stdout on success; named stderr + empty stdout on every failure; no fallback', () => {
  const root = mkRoot({});
  const good = run('scripts/authority-baseline-resolver.mjs', ['--snapshot', join(root, 'candidate.json'), '--expected-digest', EXAMPLE.content_digest]);
  assert(good.code === 0, `exit=${good.code} err=${good.err.slice(0, 140)}`);
  assert(good.out === `${CC.baseline}\n`, `stdout not exactly the baseline line: ${JSON.stringify(good.out)}`);
  const bad = run('scripts/authority-baseline-resolver.mjs', ['--snapshot', join(root, 'candidate.json'), '--expected-digest', `sha256:${'3'.repeat(64)}`]);
  assert(bad.code !== 0 && bad.out === '' && /CANDIDATE_/.test(bad.err), `bad digest: exit=${bad.code} out=${JSON.stringify(bad.out)} err=${bad.err.slice(0, 120)}`);
  const miss = run('scripts/authority-baseline-resolver.mjs', ['--snapshot', join(root, 'nope.json'), '--expected-digest', EXAMPLE.content_digest]);
  assert(miss.code !== 0 && miss.out === '' && /CANDIDATE_MISSING/.test(miss.err), `missing: ${miss.err.slice(0, 120)}`);
  const half = run('scripts/authority-baseline-resolver.mjs', ['--snapshot', join(root, 'candidate.json')]);
  assert(half.code !== 0 && half.out === '' && half.err.length > 0, 'half args must fail with empty stdout');
});

await Promise.all(pending);
roots.forEach((r) => rmSync(r, { recursive: true, force: true }));
console.log(fails === 0 ? `ALL GREEN (${ran} cases, actual count)` : `RED (${fails}/${ran} failing)`);
process.exit(fails === 0 ? 0 : 1);
