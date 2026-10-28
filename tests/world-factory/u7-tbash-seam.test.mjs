/**
 * u7-tbash-seam.test.mjs — C1 (offline, zero boots) for the ARC-B C2 runner's
 * lane-independent seam (u7-tbash-seam-20261028).
 *
 *   node --test tests/world-factory/u7-tbash-seam.test.mjs
 *
 * The closed #415 lane committed a FULL boot ledger (7/7) beside
 * dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs, so no new
 * lane can run the governed-bash C2 without a seam. Pins (all through the
 * pure resolveRunConfig/parseBootLedger/assertBootBudget/evidencePathOf
 * exports — no filesystem, no boot):
 *   (a) NO flags → byte-for-byte the #415 defaults (budget 7, the committed
 *       boot-budget.jsonl beside the runner, the old evidence prefix);
 *   (b) WITH flags → the given budget/ledger/dir win, and every record
 *       evidence path starts with the given dir (never the old-lane literal);
 *   (c) --evidence without --budget-ledger/--budget is REFUSED (the full
 *       closed-lane ledger is never an implicit fallback);
 *   (d) evidence/ledger paths outside the repo or inside the closed lane dir
 *       are REFUSED;
 *   (e) a ledger already at budget is REFUSED before the next boot (fail
 *       closed), including the committed closed-lane ledger itself.
 * Review round 1 (PR #428 补充内容) added legs:
 *   (f) F1 — flagged --budget above the committed cap MAX_FLAGGED_BUDGET is
 *       REFUSED; a deliberate override is possible only through the named env
 *       var and returns the marker+reason the record must carry;
 *   (g) F2 — --budget-ledger must live in the SAME lane as --evidence
 *       (inside it or sharing its lane root); another lane's ledger is REFUSED;
 *   (h) F3 — a flagged run refuses a non-empty --evidence dir without
 *       --allow-reused-dir; flagged output names carry the runId, so a record
 *       can cite only files this run wrote (no-flag names stay historical);
 *   (i) F4 — --dry-run without --fixtures fails closed naming the flag (the
 *       old argv[indexOf+1] trap yielded argv[0] = the node ELF binary).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const RUNNER = new URL('../../dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs', import.meta.url)
const { resolveRunConfig, parseBootLedger, assertBootBudget, evidencePathOf, MAX_FLAGGED_BUDGET, BUDGET_OVERRIDE_ENV, assertFreshEvidenceDir, outputTagOf, recordEvidencePaths, recordBudgetStamp, resolveFixturesArg } = await import(RUNNER)
const REPO = resolve(dirname(fileURLToPath(RUNNER)), '../../../..', '..')
const OLD_LANE = 'dev/agent-workflow/evidence/u7-tbash-l4-20261027'
// The byte-for-byte #415 constants, spelled out HERE so a mutation of the
// runner default (pointing the no-flag path elsewhere) turns this file RED.
const OLD_BUDGET = 7
const OLD_BUDGET_REL = `${OLD_LANE}/c2/boot-budget.jsonl`
const OLD_PREFIX = `${OLD_LANE}/c2`

test('u7-tbash seam (a): no flags resolve byte-for-byte to the #415 defaults', () => {
  const cfg = resolveRunConfig([])
  assert.equal(cfg.flagged, false)
  assert.equal(cfg.budget, OLD_BUDGET)
  assert.equal(cfg.budgetPath, join(REPO, OLD_BUDGET_REL))
  assert.equal(cfg.evidenceDir, join(REPO, OLD_PREFIX))
  assert.equal(cfg.evidenceRel, OLD_PREFIX)
  // record evidence paths keep the old literal prefix byte-for-byte
  assert.equal(evidencePathOf(cfg, 'host-boot1.log'), `${OLD_PREFIX}/host-boot1.log`)
  assert.equal(evidencePathOf(cfg, 'mock-excerpt-boot7.json'), `${OLD_PREFIX}/mock-excerpt-boot7.json`)
  assert.equal(evidencePathOf(cfg, 'c2-verdicts-boot7.json'), `${OLD_PREFIX}/c2-verdicts-boot7.json`)
  // unrelated flags (dry-run, fixtures) never flip the seam
  const dry = resolveRunConfig(['--dry-run', '--fixtures', 'x.json'])
  assert.deepEqual(dry, cfg)
})

test('u7-tbash seam (b): flags override budget, ledger and evidence dir', () => {
  const dir = 'dev/agent-workflow/evidence/u7-tbash-seam-20261028/fixture-next-lane/arc-b'
  const ledger = `${dir}/boot-budget.jsonl`
  const cfg = resolveRunConfig(['--evidence', dir, '--budget-ledger', ledger, '--budget', '1'])
  assert.equal(cfg.flagged, true)
  assert.equal(cfg.budget, 1)
  assert.equal(cfg.budgetPath, join(REPO, ledger))
  assert.equal(cfg.evidenceDir, join(REPO, dir))
  assert.equal(cfg.evidenceRel, dir)
  // every evidence path the record would carry starts with the GIVEN dir, never the closed lane
  const files = ['host-boot1.log', 'mock-excerpt-boot1.json', 'c2-verdicts-boot1.json']
  for (const f of files) {
    const p = evidencePathOf(cfg, f)
    assert.ok(p.startsWith(`${dir}/`), `${p} must start with ${dir}/`)
    assert.ok(!p.startsWith(OLD_LANE), `${p} must not leak the closed lane path`)
  }
  // absolute in-repo paths are accepted and normalized to the same result
  const abs = resolveRunConfig(['--evidence', join(REPO, dir), '--budget-ledger', join(REPO, ledger), '--budget', '1'])
  assert.deepEqual(abs, cfg)
  // flag order and surrounding runner flags do not matter
  assert.deepEqual(resolveRunConfig(['--dry-run', '--budget', '2', '--evidence', dir, '--budget-ledger', ledger]), { ...cfg, budget: 2 })
})

test('u7-tbash seam (c): --evidence without the other two flags is refused', () => {
  const dir = 'dev/agent-workflow/evidence/u7-tbash-seam-20261028/fixture-next-lane/arc-b'
  const ledger = `${dir}/boot-budget.jsonl`
  assert.throws(() => resolveRunConfig(['--evidence', dir]), /must be given together/)
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget-ledger', ledger]), /must be given together/)
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget', '1']), /must be given together/)
  assert.throws(() => resolveRunConfig(['--budget', '1']), /must be given together/)
  assert.throws(() => resolveRunConfig(['--budget-ledger', ledger]), /must be given together/)
  // values must be real: missing argument and non-positive/non-integer budgets refused
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget-ledger', ledger, '--budget']), /--budget requires/)
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget-ledger', ledger, '--budget', '0']), /bad --budget/)
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget-ledger', ledger, '--budget', '-2']), /bad --budget/)
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget-ledger', ledger, '--budget', '1.5']), /bad --budget/)
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget-ledger', ledger, '--budget', 'x']), /bad --budget/)
})

test('u7-tbash seam (d): paths outside the repo or inside the closed lane are refused', () => {
  const ledger = 'dev/agent-workflow/evidence/u7-tbash-seam-20261028/fixture-next-lane/arc-b/boot-budget.jsonl'
  for (const bad of [OLD_LANE, `${OLD_LANE}/`, `${OLD_LANE}/c2`, `${OLD_LANE}/c2/boot-budget.jsonl`, join(REPO, OLD_LANE, 'c2')]) {
    assert.throws(() => resolveRunConfig(['--evidence', bad, '--budget-ledger', ledger, '--budget', '1']), /closed lane/)
  }
  for (const bad of ['../../etc/passwd', '/tmp/u7tbseam-evil', join(REPO, '..', 'outside'), REPO, '.']) {
    assert.throws(() => resolveRunConfig(['--evidence', bad, '--budget-ledger', ledger, '--budget', '1']), /inside the repo/)
  }
  // same law for the ledger itself
  const dir = 'dev/agent-workflow/evidence/u7-tbash-seam-20261028/fixture-next-lane/arc-b'
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget-ledger', `${OLD_LANE}/c2/boot-budget.jsonl`, '--budget', '1']), /closed lane/)
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget-ledger', '/tmp/ledger.jsonl', '--budget', '1']), /inside the repo/)
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget-ledger', ledger, '--budget', '1', '--evidence', dir]), /duplicate --evidence/)
})

test('u7-tbash seam (e): a ledger already at budget is refused before the next boot', () => {
  const at1 = JSON.stringify({ boot: 1, budget: 1 }) + '\n'
  assert.equal(assertBootBudget({ declared: parseBootLedger('').length, budget: 1, ledgerPath: 'x.jsonl' }), 1)
  assert.equal(assertBootBudget({ declared: parseBootLedger(at1 + 'not json\n').length, budget: 2, ledgerPath: 'x.jsonl' }), 2)
  assert.throws(() => assertBootBudget({ declared: parseBootLedger(at1).length, budget: 1, ledgerPath: 'x.jsonl' }), /boot budget exhausted: 1\/1 declared in x\.jsonl/)
  // the committed closed-lane ledger, read as-is, is at 7/7 and refuses an 8th
  const committed = readFileSync(join(REPO, OLD_BUDGET_REL), 'utf8')
  const declared = parseBootLedger(committed).length
  assert.equal(declared, 7)
  assert.throws(() => assertBootBudget({ declared, budget: OLD_BUDGET, ledgerPath: OLD_BUDGET_REL }), /boot budget exhausted: 7\/7/)
  // disclosure lines (no integer boot field) never count as declarations
  assert.equal(parseBootLedger('{"disclosure":"extension"}\n').length, 0)
  // a flagged lane pointing at its OWN empty ledger declares boot 1 and would be allowed.
  // The fixture dir is COMMITTED (with a zero-entry boot-budget.jsonl = the exact state a
  // new lane starts in) because docs:probe requires every dev/agent-workflow/evidence/…
  // path cited from tests/world-factory to exist in a cold clone.
  const fixture = 'dev/agent-workflow/evidence/u7-tbash-seam-20261028/fixture-next-lane/arc-b'
  const cfg = resolveRunConfig(['--evidence', fixture, '--budget-ledger', `${fixture}/boot-budget.jsonl`, '--budget', '1'])
  assert.ok(isAbsolute(cfg.budgetPath) && !cfg.budgetPath.startsWith(join(REPO, OLD_LANE)))
  const fresh = parseBootLedger(readFileSync(cfg.budgetPath, 'utf8')).length
  assert.equal(fresh, 0)
  assert.equal(assertBootBudget({ declared: fresh, budget: cfg.budget, ledgerPath: cfg.budgetPath }), 1)
  assert.throws(() => assertBootBudget({ declared: 1, budget: cfg.budget, ledgerPath: cfg.budgetPath }), /boot budget exhausted: 1\/1/)
})

// ── review round 1 (PR #428 补充内容): F1–F4 legs ─────────────────────────────
test('u7-tbash seam (f): F1 flagged --budget above the committed cap is refused; the override is env-named and self-disclosing', () => {
  assert.equal(MAX_FLAGGED_BUDGET, 3, 'this lane historically needed 1 boot per acceptance run; 3 is the committed ceiling')
  assert.equal(BUDGET_OVERRIDE_ENV, 'U7TB_BUDGET_OVERRIDE_REASON')
  const dir = 'dev/agent-workflow/evidence/u7-tbash-seam-20261028/fixture-next-lane/arc-b'
  const ledger = `${dir}/boot-budget.jsonl`
  const base = ['--evidence', dir, '--budget-ledger', ledger]
  // at or below the cap: allowed, and NO marker (the record stays plain)
  for (const n of ['1', '3']) assert.equal(resolveRunConfig([...base, '--budget', n], {}).budgetOverride, null)
  // above the cap: typed refusal — a fresh empty ledger is NOT self-authorising
  assert.throws(() => resolveRunConfig([...base, '--budget', '4'], {}), /--budget 4 exceeds the committed cap 3 \(MAX_FLAGGED_BUDGET\)/)
  assert.throws(() => resolveRunConfig([...base, '--budget', '999'], {}), /U7TB_BUDGET_OVERRIDE_REASON/)
  // an empty/whitespace reason is not a reason; a long reason is refused (it must be SHORT)
  assert.throws(() => resolveRunConfig([...base, '--budget', '4'], { [BUDGET_OVERRIDE_ENV]: '   ' }), /U7TB_BUDGET_OVERRIDE_REASON/)
  assert.throws(() => resolveRunConfig([...base, '--budget', '4'], { [BUDGET_OVERRIDE_ENV]: 'x'.repeat(201) }), /short reason/)
  // the deliberate override: budget wins, and the SELF-DISCLOSING marker+reason is
  // returned for main() to stamp into the produced record (an over-budget run then
  // cannot hide — both the ledger entry and the record carry it).
  const reason = 'one re-run after host OOM; authorized by the lane owner 20261029'
  const cfg = resolveRunConfig([...base, '--budget', '999'], { [BUDGET_OVERRIDE_ENV]: reason })
  assert.equal(cfg.budget, 999)
  assert.deepEqual(cfg.budgetOverride, { budget: 999, cap: MAX_FLAGGED_BUDGET, env: BUDGET_OVERRIDE_ENV, reason })
  assert.deepEqual(recordBudgetStamp(cfg), { bootBudgetOverride: cfg.budgetOverride })
  // an unused override env leaves records plain (no marker within cap, none ever for no-flag)
  assert.deepEqual(recordBudgetStamp({ ...cfg, budget: 3, budgetOverride: null }), {})
  assert.deepEqual(recordBudgetStamp({ ...cfg, flagged: false, budget: 7, budgetOverride: null }), {})
  // the NO-FLAG default stays exactly 7, never capped, never stamped, even with the env set
  const d = resolveRunConfig([], { [BUDGET_OVERRIDE_ENV]: reason })
  assert.equal(d.budget, 7)
  assert.equal(d.budgetOverride, null)
  assert.deepEqual(recordBudgetStamp(d), {})
})

test('u7-tbash seam (g): F2 the budget ledger must live in the SAME lane as --evidence', () => {
  const dir = 'dev/agent-workflow/evidence/u7-tbash-seam-20261028/fixture-next-lane/arc-b'
  // inside the evidence dir itself: accepted
  assert.equal(resolveRunConfig(['--evidence', dir, '--budget-ledger', `${dir}/boot-budget.jsonl`, '--budget', '1'], {}).budgetPath, join(REPO, `${dir}/boot-budget.jsonl`))
  // shares the lane root dev/agent-workflow/evidence/u7-tbash-seam-20261028 (another dir of the SAME lane): accepted
  const sibling = 'dev/agent-workflow/evidence/u7-tbash-seam-20261028/arc-b/boot-budget.jsonl'
  assert.equal(resolveRunConfig(['--evidence', dir, '--budget-ledger', sibling, '--budget', '1'], {}).budgetPath, join(REPO, sibling))
  // ANOTHER lane's committed ledger: refused with a typed message (no cross-lane exhaustion / inheritance)
  const foreign = 'dev/agent-workflow/evidence/u7-inspect-c2-20261027/c2/boot-budget.jsonl'
  assert.throws(() => resolveRunConfig(['--evidence', dir, '--budget-ledger', foreign, '--budget', '1'], {}), /--budget-ledger must live inside the --evidence dir or share its lane root/)
  // outside the evidence tree: same parent dir accepted, different parent refused
  assert.doesNotThrow(() => resolveRunConfig(['--evidence', '.artifacts/tmp/u7tb-seam-fixture/out', '--budget-ledger', '.artifacts/tmp/u7tb-seam-fixture/boot-budget.jsonl', '--budget', '1'], {}))
  assert.throws(() => resolveRunConfig(['--evidence', '.artifacts/tmp/u7tb-seam-fixture/out', '--budget-ledger', '.artifacts/tmp/u7tb-seam-elsewhere/boot-budget.jsonl', '--budget', '1'], {}), /lane root/)
})

test('u7-tbash seam (h): F3 flagged runs refuse a reused --evidence dir and cite only runId-stamped files they wrote', () => {
  const dir = 'dev/agent-workflow/evidence/u7-tbash-seam-20261028/fixture-next-lane/arc-b'
  const ledger = `${dir}/boot-budget.jsonl`
  // --allow-reused-dir: default false, parses as a bare flag, useless without the seam trio
  const base = ['--evidence', dir, '--budget-ledger', ledger, '--budget', '1']
  assert.equal(resolveRunConfig(base, {}).allowReusedDir, false)
  assert.equal(resolveRunConfig([...base, '--allow-reused-dir'], {}).allowReusedDir, true)
  assert.throws(() => resolveRunConfig(['--allow-reused-dir'], {}), /--allow-reused-dir applies only to a flagged run/)
  // the fresh-dir law (entries passed in, so this stays pure): flagged+non-empty is
  // refused without the opt-in; the no-flag closed lane never checks (its dir is populated)
  assert.throws(() => assertFreshEvidenceDir({ flagged: true, dir, entries: ['host-boot1.log'], allowReusedDir: false }), /not empty/)
  assert.doesNotThrow(() => assertFreshEvidenceDir({ flagged: true, dir, entries: ['host-boot1.log'], allowReusedDir: true }))
  assert.doesNotThrow(() => assertFreshEvidenceDir({ flagged: true, dir, entries: [], allowReusedDir: false }))
  assert.doesNotThrow(() => assertFreshEvidenceDir({ flagged: false, dir, entries: ['a', 'b'], allowReusedDir: false }))
  // output stamping: flagged tags carry THIS run's id (two runs in one dir can never
  // collide or mis-cite); no-flag tags stay byte-for-byte the #415 history.
  assert.equal(outputTagOf({ flagged: true, runId: 'u7tb-c2-abc123', boot: 1 }), 'boot1-u7tb-c2-abc123')
  assert.equal(outputTagOf({ flagged: false, runId: 'u7tb-c2-abc123', boot: 7 }), 'boot7')
  assert.notEqual(outputTagOf({ flagged: true, runId: 'u7tb-c2-aaa', boot: 1 }), outputTagOf({ flagged: true, runId: 'u7tb-c2-bbb', boot: 1 }))
  // the record's evidence list = EXACTLY the files this run successfully wrote
  const cfg = resolveRunConfig(base, {})
  assert.deepEqual(recordEvidencePaths(cfg, []), [])
  assert.deepEqual(
    recordEvidencePaths(cfg, ['host-boot1-u7tb-c2-abc.log', 'mock-excerpt-boot1-u7tb-c2-abc.json']),
    [`${dir}/host-boot1-u7tb-c2-abc.log`, `${dir}/mock-excerpt-boot1-u7tb-c2-abc.json`],
  )
  // end-to-end (offline, no boot): a real flagged --dry-run refuses a NON-EMPTY
  // evidence dir, and writes only with the opt-in.
  const tmp = mkdtempSync(join(REPO, '.artifacts', 'tmp', 'u7tb-seam-e2e-'))
  try {
    const relDir = relative(REPO, tmp).split(sep).join('/')
    writeFileSync(join(tmp, 'stale-host-boot1.log'), 'written by an earlier run\n')
    const common = ['--dry-run', '--fixtures', join(REPO, 'dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/dry-run-fixtures.json'), '--evidence', relDir, '--budget-ledger', `${relDir}/boot-budget.jsonl`, '--budget', '1']
    const refused = spawnSync(process.execPath, [fileURLToPath(RUNNER), ...common], { encoding: 'utf8', cwd: REPO, timeout: 180_000 })
    assert.notEqual(refused.status, 0)
    assert.match(refused.stderr, /--evidence dir is not empty/)
    assert.match(refused.stderr, /--allow-reused-dir/)
    assert.equal(existsSync(join(tmp, 'dry-run-GREEN.json')), false, 'the refused run must have written nothing')
    const opted = spawnSync(process.execPath, [fileURLToPath(RUNNER), ...common, '--allow-reused-dir'], { encoding: 'utf8', cwd: REPO, timeout: 180_000 })
    assert.equal(opted.status, 0, `opted-in dry-run failed: ${String(opted.stderr).slice(0, 500)}`)
    assert.equal(existsSync(join(tmp, 'dry-run-GREEN.json')), true)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('u7-tbash seam (i): F4 --dry-run without --fixtures is refused by name, never reading argv[0]', () => {
  assert.throws(() => resolveFixturesArg([]), /--dry-run requires --fixtures/)
  assert.throws(() => resolveFixturesArg(['--dry-run']), /--dry-run requires --fixtures <json>: the --fixtures flag is missing/)
  assert.throws(() => resolveFixturesArg(['--dry-run', '--fixtures']), /--fixtures was given without a value/)
  assert.throws(() => resolveFixturesArg(['--dry-run', '--fixtures', '--evidence', 'x']), /--fixtures was given without a value/)
  assert.equal(resolveFixturesArg(['--fixtures', 'a/b.json', '--dry-run']), 'a/b.json')
  // the original trap: absent flag yielded argv[0] (the node ELF), so the guard never
  // fired and the run died in JSON.parse on ELF bytes without ever naming the flag.
  const r = spawnSync(process.execPath, [fileURLToPath(RUNNER), '--dry-run'], { encoding: 'utf8', cwd: REPO, timeout: 180_000 })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /--dry-run requires --fixtures/)
  assert.doesNotMatch(r.stderr, /SyntaxError|JSON\.parse|Unexpected/)
})
