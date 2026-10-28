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
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RUNNER = new URL('../../dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs', import.meta.url)
const { resolveRunConfig, parseBootLedger, assertBootBudget, evidencePathOf } = await import(RUNNER)
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
