#!/usr/bin/env node
// S2 §7.4 step-5 docs:probe explicit-candidate read chain — ISOLATED engineering test.
// CLI-level: real `node scripts/docs-probe.mjs` invocations, real exit codes.
// Candidate mode must be EXPLICIT (path + expected digest); a bad/missing/empty
// configuration is refused with named blocking and NEVER silently falls back to the
// legacy reader. Default mode must match the fixed parent 09fd39464 byte-for-byte.
// Re-anchor 2026-10-26 (FIX-D D4): default mode additionally runs the cited-paths rule;
// P4 now pins the parent bytes modulo exactly that one added selected_rules entry.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const REPO = resolve(here, '../..');
const PARENT = '09fd39464d86e3a9d58cde2e3ec2823fbf9a5f35';
const CLOSURE = ['docs-probe', 'gen-current-state', 'authority-contract-fields', 'doc-checks', 'contracts-field-agreement', 'authority-candidate-source', 'authority-snapshot', 'generated-write', 'verify-agent-notes'];
const EXAMPLE = JSON.parse(readFileSync(join(here, 'snapshot-example.json'), 'utf8'));
const CC = EXAMPLE.current_contract;

let fails = 0, ran = 0;
const t = (n, f) => { ran += 1; try { f(); console.log(`PASS ${n}`); } catch (e) { fails += 1; console.log(`FAIL ${n}: ${e.message}`); } };
const assert = (c, m) => { if (!c) throw new Error(m); };

const gitShow = (f) => execFileSync('git', ['show', `${PARENT}:${f}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
const runCli = (script, root, extra) => {
  try {
    const out = execFileSync('node', [script, '--root', root, '--worktree-only', '--json', ...extra], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) { return { code: e.status, out: e.stdout ?? '' }; }
};
const mkFixture = ({ graphOver = {} } = {}) => {
  const root = mkdtempSync(join(REPO, '.tmp-s2-pc-'));
  mkdirSync(join(root, 'dev', 'agent-workflow'), { recursive: true });
  mkdirSync(join(root, 'dev', 'engineering'), { recursive: true });
  const vals = { ...CC, ...graphOver };
  writeFileSync(join(root, 'dev/agent-workflow/graph.yaml'), `top: x\ncurrent_contract:\n${Object.entries(vals).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\nafter: y\n`);
  writeFileSync(join(root, 'dev/engineering/registry.yaml'), 'schema_version: 1\ngenerated_view: dev/engineering/current-state.json\nlegacy_execution_authority: dev/agent-workflow/graph.yaml#current_contract\nmigration_of_legacy_consumers: not_started\n\nentries:\n  - id: T-001\n');
  const cand = join(root, 'candidate.json');
  writeFileSync(cand, JSON.stringify(EXAMPLE));
  return { root, cand };
};

t('P0 legal explicit candidate: binding recorded, dual-read compared=6, no DUAL_READ blocking', () => {
  const { root, cand } = mkFixture();
  const r = runCli('scripts/docs-probe.mjs', root, ['--authority-candidate', cand, '--authority-expected-digest', EXAMPLE.content_digest]);
  const j = JSON.parse(r.out);
  assert(j.authority_source_binding && j.authority_source_binding.kind === 'authority-snapshot-candidate', `no binding (exit ${r.code})`);
  assert(j.authority_source_binding.content_digest === EXAMPLE.content_digest, JSON.stringify(j.authority_source_binding));
  assert(!j.blocking.some((f) => f.code.startsWith('DUAL_READ_')), JSON.stringify(j.blocking.filter((f) => f.code.startsWith('DUAL_READ_'))));
  assert(j.dual_read && j.dual_read.compared === 6 && j.dual_read.ok === true, JSON.stringify(j.dual_read));
  rmSync(root, { recursive: true, force: true });
});

t('P1 old/new divergence: named DUAL_READ blocking, exit 1, candidate kept (no auto source switch)', () => {
  const { root, cand } = mkFixture({ graphOver: { phase_id: 'alpha6-divergent' } });
  const r = runCli('scripts/docs-probe.mjs', root, ['--authority-candidate', cand, '--authority-expected-digest', EXAMPLE.content_digest]);
  const j = JSON.parse(r.out);
  const hit = j.blocking.find((f) => f.code === 'DUAL_READ_SNAPSHOT_VS_LEGACY_VALUE');
  assert(hit, `exit ${r.code} blocking=${JSON.stringify(j.blocking.map((f) => f.code))}`);
  assert(/alpha6-divergent/.test(hit.detail) && /alpha5-tool-io-governance/.test(hit.detail), hit.detail);
  assert(r.code === 1, `exit=${r.code}`);
  assert(j.authority_source_binding && j.authority_source_binding.legacy_divergence.some((d) => d.key === 'phase_id'), JSON.stringify(j.authority_source_binding));
  rmSync(root, { recursive: true, force: true });
});

t('P2 missing one of path/digest and empty values: structured refusal, no legacy fallback', () => {
  for (const extra of [
    ['--authority-candidate', '/nope/none.json'], // digest missing
    ['--authority-expected-digest', EXAMPLE.content_digest], // path missing
    ['--authority-candidate', '', '--authority-expected-digest', ''], // empty values
  ]) {
    const { root } = mkFixture();
    const r = runCli('scripts/docs-probe.mjs', root, extra);
    let j = null; try { j = JSON.parse(r.out); } catch { /* non-json refusal output allowed */ }
    assert(r.code !== 0, `exit ${r.code} for ${JSON.stringify(extra)}`);
    if (!j) assert(/CANDIDATE|AUTHORITY/.test(r.out), `refusal must name the cause, got: ${r.out.slice(0, 120)}`);
    if (j) {
      assert(j.authority_source_binding === undefined, `binding present = silently served legacy for ${JSON.stringify(extra)}`);
      assert(j.blocking.some((f) => f.code.startsWith('CANDIDATE_')), JSON.stringify(j.blocking.map((f) => f.code)));
    }
    rmSync(root, { recursive: true, force: true });
  }
});

t('P3 corrupt candidate: named DUAL_READ/CANDIDATE blocking, no fallback view from graph', () => {
  const { root } = mkFixture();
  const bad = join(root, 'bad.json'); writeFileSync(bad, '{oops');
  const r = runCli('scripts/docs-probe.mjs', root, ['--authority-candidate', bad, '--authority-expected-digest', EXAMPLE.content_digest]);
  const j = JSON.parse(r.out);
  assert(r.code === 1, `exit=${r.code}`);
  assert(j.authority_source_binding === undefined, 'corrupt candidate must not produce a view/binding');
  assert(j.blocking.some((f) => f.code.startsWith('CANDIDATE_')), JSON.stringify(j.blocking.map((f) => f.code)));
  rmSync(root, { recursive: true, force: true });
});

t('P4 default mode CLI equals fixed parent 09fd39464 closure, bounded re-anchor 2026-10-26: cited-paths rule added (FIX-D D4)', () => {
  const { root } = mkFixture();
  const tmp = mkdtempSync(join(REPO, '.tmp-s2-pcp-'));
  for (const m of CLOSURE) writeFileSync(join(tmp, `${m}.mjs`), gitShow(`scripts/${m}.mjs`));
  const a = runCli(join(tmp, 'docs-probe.mjs'), root, []);
  const b = runCli('scripts/docs-probe.mjs', root, []);
  assert(a.code === b.code, `exit ${a.code} vs ${b.code}`);
  // RE-ANCHOR (2026-10-26, FIX-D): the cited-paths rule (external-audit D4) was added to
  // default mode on purpose — a code-cited design document that resolves nowhere must stop
  // the fast gate, and that promise requires the rule to run by default. The byte-identity
  // claim survives for everything else: removing exactly the added selected_rules entry
  // `"cited-paths"` must restore the parent bytes, and the entry must be the ONLY delta.
  assert(b.out.includes('"cited-paths"') && !a.out.includes('"cited-paths"'),
    'the only sanctioned delta is the cited-paths rule name entering selected_rules');
  // Compare the parsed reports with the one sanctioned entry removed: line-splicing the
  // JSON would false-diff on the trailing comma of what used to be the array's last item.
  const ja = JSON.parse(a.out), jb = JSON.parse(b.out);
  jb.selected_rules = jb.selected_rules.filter((r) => r !== 'cited-paths');
  assert(JSON.stringify(jb) === JSON.stringify(ja),
    `beyond the cited-paths entry the report must equal the parent's exactly:\n--parent--\n${JSON.stringify(ja).slice(0, 400)}\n--current--\n${JSON.stringify(jb).slice(0, 400)}`);
  rmSync(root, { recursive: true, force: true }); rmSync(tmp, { recursive: true, force: true });
});


// R8 mirror-parameter controls: the candidate view, once validated, feeds the EXISTING
// checkPlanCitationBlocks mirror parameter — a plan whose eb-plan.phase_id contradicts
// the snapshot must still get PLAN_CITATION_CONFLICT (fixture is its own git repo so
// the R8 scope trigger — changed glossary — is real, not simulated).
const mkGitFixture = ({ planPhase }) => {
  const root = mkdtempSync(join(REPO, '.tmp-s2-pc-'));
  const w = (rel, txt) => { mkdirSync(join(root, ...rel.split('/').slice(0, -1)), { recursive: true }); writeFileSync(join(root, rel), txt); };
  w('dev/agent-workflow/graph.yaml', `top: x\ncurrent_contract:\n${Object.entries(CC).map(([k, v]) => `  ${k}: ${v}`).join('\n')}\nafter: y\n`);
  w('dev/engineering/registry.yaml', 'schema_version: 1\ngenerated_view: dev/engineering/current-state.json\nlegacy_execution_authority: dev/agent-workflow/graph.yaml#current_contract\nmigration_of_legacy_consumers: not_started\n\nentries:\n  - id: T-001\n');
  w('docs/glossary.md', '# glossary\nbaseline word\n');
  w('docs/plans/active/p.md', `# plan\n\ntarget exists\n\n\`\`\`yaml eb-plan\nphase_id: ${planPhase}\nactive_plan: docs/plans/active/p.md\nbacklog: docs/plans/active/p.md\nmatrix: docs/plans/active/p.md\nevidence_root: dev/agent-workflow\n\`\`\`\n`);
  w('candidate.json', JSON.stringify(EXAMPLE));
  const g = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  g('init', '-q', '-b', 'main');
  g('add', '-A');
  g('-c', 'user.name=t', '-c', 'user.email=t@l', 'commit', '-q', '-m', 'base');
  writeFileSync(join(root, 'docs/glossary.md'), '# glossary\nbaseline word\nchanged line (R8 trigger: glossary moved)\n');
  return root;
};
const citationOf = (j) => j.blocking.concat(j.non_blocking ?? []).filter((f) => f.code === 'PLAN_CITATION_CONFLICT');

t('P5 candidate success feeds R8 mirror: plan phase_id != snapshot phase_id -> PLAN_CITATION_CONFLICT (blocking)', () => {
  const root = mkGitFixture({ planPhase: 'alpha6-other-phase' });
  const r = runCli('scripts/docs-probe.mjs', root, ['--authority-candidate', join(root, 'candidate.json'), '--authority-expected-digest', EXAMPLE.content_digest]);
  const j = JSON.parse(r.out);
  assert(j.authority_source_binding, `candidate chain did not even succeed (exit ${r.code}): ${JSON.stringify(j.blocking?.map((f) => f.code))}`);
  const c = citationOf(j);
  assert(c.length === 1 && /alpha6-other-phase/.test(c[0].detail) && /alpha5-tool-io-governance/.test(c[0].detail), `PLAN_CITATION_CONFLICT missing despite contradicting plan: blocking=${JSON.stringify(j.blocking.map((f) => f.code))}`);
  rmSync(root, { recursive: true, force: true });
});

t('P6 candidate success, plan phase_id == snapshot phase_id: no PLAN_CITATION_CONFLICT (rule wired, not inverted)', () => {
  const root = mkGitFixture({ planPhase: CC.phase_id });
  const r = runCli('scripts/docs-probe.mjs', root, ['--authority-candidate', join(root, 'candidate.json'), '--authority-expected-digest', EXAMPLE.content_digest]);
  const j = JSON.parse(r.out);
  assert(j.authority_source_binding, `candidate chain did not succeed (exit ${r.code})`);
  assert(citationOf(j).length === 0, JSON.stringify(citationOf(j)));
  rmSync(root, { recursive: true, force: true });
});

console.log(fails === 0 ? `ALL GREEN (${ran} cases, actual count)` : `RED (${fails}/${ran} failing)`);
process.exit(fails === 0 ? 0 : 1);
