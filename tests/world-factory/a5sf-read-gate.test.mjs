/**
 * a5sf-read-gate.test.mjs — BL-14 / P2-01 C1 proof of the BUDGET
 * PRE-REGISTRATION GATE, host-free and bare-checkout-safe.
 *
 * ZERO Host boots, ZERO ports, ZERO network, ZERO DSH_HOME. This file is the
 * half of BL-14 that CI can run today: the C2 scenario needs a real Host and a
 * live read driver that this tree does not have (see
 * evidence/a5sf-p2-read/README.md §5), so what is proven HERE is the law that
 * stops an unbudgeted boot before it can happen.
 *
 * What each arm pins (all against the REAL gate in
 * `suites/150-a5sf-read.mjs`, the REAL shared ledger from
 * `lib/run-record.mjs`, and a recording boot stub):
 *
 *   1. an ABSENT grant refuses (`BUDGET_NOT_GRANTED reason=GRANT_ABSENT`) and
 *      leaves the ledger byte-identical: zero rows, zero starts;
 *   2. a MALFORMED grant refuses (the grant must carry grantId / maxStarts /
 *      grantedBy / boundCommit);
 *   3. an AMBIGUOUS grant ledger (two grant rows) refuses instead of picking
 *      one — two grants could differ in maxStarts;
 *   4. a grant bound to ANOTHER commit refuses (a foreign grant authorises a
 *      different artifact);
 *   5. a grant too small for the declared boots refuses (`GRANT_TOO_SMALL`);
 *   6. an EXHAUSTED shared ledger refuses and does not touch the ledger;
 *   7. a run record with no shared ledger path refuses (`LEDGER_UNAVAILABLE`):
 *      the gate has no second counter to fall back to;
 *   8. a GRANTED lease appends its pre-registration row to the SHARED ledger
 *      BEFORE the boot thunk runs, the thunk runs exactly ONCE, and a second
 *      `boot()` is refused by the same imported `used >= max` formula;
 *   9. the suite's `run()` refuses on an absent grant BEFORE it touches a
 *      World/factory and before it records any case verdict;
 *  10. the live read-driver probe refuses (`LIVE_SEAM_UNAVAILABLE`) before the
 *      grant gate, so a missing seam can never spend a reserved row.
 *
 * Run: node --test tests/world-factory/a5sf-read-gate.test.mjs
 *
 * CORE PATCH BUDGET = 0. Nothing here touches `packages/**` or
 * `tests/deepseek-harness-test-use/`.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRunRecord } from './lib/run-record.mjs'
import {
  A5SF_READ_GATE_CODES,
  A5SF_READ_GATE_REASONS,
  A5sfReadGateError,
  INTENT_ROWS_PER_LEASE,
  readBudgetGrant,
  resolveReadDriver,
  preRegisterReadBudget,
  runA5sfRead,
} from './suites/150-a5sf-read.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const HEAD = 'd58f078734a0512fb70d4f4a85be3d999c23465a' // a fully-shaped commit: the gate only compares strings
const FOREIGN = '0123456789abcdef0123456789abcdef01234567'

const dirs = []
function tmp(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-read-gate-${label}-`))
  dirs.push(dir)
  return dir
}
test.after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

/** A run record over a real ledger file (the ONE writer/counter). */
function recordFor(ledgerPath) {
  return createRunRecord({
    runId: 'a5sf-read-gate-run',
    suite: 'a5sf-read',
    selectedCases: ['read:allowed-inside-ceiling'],
    bindings: { note: 'host-free C1 proof of the budget gate' },
    ledgerPath,
  })
}

function grantFile(dir, grant = {}) {
  const path = join(dir, 'budget-grant.json')
  writeFileSync(path, `${JSON.stringify({
    grantId: 'grant-a5sf-p2-read-001',
    maxStarts: 2,
    grantedBy: 'user-ruling-fixture',
    boundCommit: HEAD,
    ...grant,
  }, null, 2)}\n`)
  return path
}

const ledgerText = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null)

async function expectRefusal(promise, reason, extra = {}) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof A5sfReadGateError, `expected A5sfReadGateError, got ${String(error)}`)
    assert.equal(error.code, 'BUDGET_NOT_GRANTED')
    assert.equal(error.reason, reason)
    assert.ok(A5SF_READ_GATE_CODES.includes(error.code))
    assert.ok(A5SF_READ_GATE_REASONS.includes(error.reason))
    for (const [key, value] of Object.entries(extra)) assert.deepEqual(error[key], value)
    return true
  })
}

// ── 1. absent grant ─────────────────────────────────────────────────────────

test('gate: an ABSENT grant refuses with zero ledger rows and zero starts', async () => {
  const dir = tmp('absent')
  const ledger = join(dir, 'host-starts.jsonl')
  const record = recordFor(ledger)
  const before = ledgerText(ledger) // null: the file does not exist yet
  await expectRefusal(preRegisterReadBudget({ grantPath: null, headCommit: HEAD, runRecord: record }), 'GRANT_ABSENT')
  assert.equal(ledgerText(ledger), before, 'a refused gate must not create or touch the shared ledger')
  assert.equal(record.ledgerStartCount(), 0, 'zero shared-ledger rows ⇒ zero starts')

  const missing = join(dir, 'does-not-exist.json')
  await expectRefusal(preRegisterReadBudget({ grantPath: missing, headCommit: HEAD, runRecord: record }), 'GRANT_ABSENT')
  assert.equal(ledgerText(ledger), before)
})

// ── 2. malformed grant ──────────────────────────────────────────────────────

test('gate: a MALFORMED grant refuses (each required field is load-bearing)', async () => {
  for (const [field, value] of [['grantedBy', ''], ['maxStarts', 0], ['maxStarts', 1.5], ['grantId', '  '], ['boundCommit', 'HEAD']]) {
    const dir = tmp(`malformed-${field}`)
    const ledger = join(dir, 'host-starts.jsonl')
    const record = recordFor(ledger)
    const path = grantFile(dir, { [field]: value })
    const read = readBudgetGrant(path)
    assert.equal(read.ok, false, `${field}=${JSON.stringify(value)} must not be accepted`)
    assert.equal(read.reason, 'GRANT_MALFORMED')
    await expectRefusal(preRegisterReadBudget({ grantPath: path, headCommit: HEAD, runRecord: record }), 'GRANT_MALFORMED')
    assert.equal(record.ledgerStartCount(), 0)
  }
})

// ── 3. ambiguous grant ledger ───────────────────────────────────────────────

test('gate: an AMBIGUOUS grant ledger refuses instead of choosing a maxStarts', async () => {
  const dir = tmp('ambiguous')
  const ledger = join(dir, 'host-starts.jsonl')
  const record = recordFor(ledger)
  const path = join(dir, 'grants.jsonl')
  writeFileSync(path, [
    JSON.stringify({ grantId: 'g-1', maxStarts: 1, grantedBy: 'a', boundCommit: HEAD }),
    JSON.stringify({ grantId: 'g-2', maxStarts: 9, grantedBy: 'b', boundCommit: HEAD }),
  ].join('\n') + '\n')
  const read = readBudgetGrant(path)
  assert.equal(read.ok, false)
  assert.equal(read.reason, 'GRANT_AMBIGUOUS')
  await expectRefusal(preRegisterReadBudget({ grantPath: path, headCommit: HEAD, runRecord: record }), 'GRANT_AMBIGUOUS')
  assert.equal(record.ledgerStartCount(), 0)
})

// ── 4. foreign commit ───────────────────────────────────────────────────────

test('gate: a grant bound to ANOTHER commit refuses (foreign artifact)', async () => {
  const dir = tmp('foreign')
  const ledger = join(dir, 'host-starts.jsonl')
  const record = recordFor(ledger)
  const path = grantFile(dir, { boundCommit: FOREIGN })
  await expectRefusal(preRegisterReadBudget({ grantPath: path, headCommit: HEAD, runRecord: record }), 'GRANT_FOREIGN_COMMIT')
  assert.equal(record.ledgerStartCount(), 0)
  await expectRefusal(preRegisterReadBudget({ grantPath: path, headCommit: null, runRecord: record }), 'GRANT_HEAD_UNKNOWN')
})

// ── 5. too small / cap override ─────────────────────────────────────────────

test('gate: a grant too small for the declared boots refuses, and a caller cannot raise its own cap', async () => {
  const dir = tmp('small')
  const ledger = join(dir, 'host-starts.jsonl')
  const record = recordFor(ledger)
  const path = grantFile(dir, { maxStarts: 1 })
  // 1 row is exactly the reservation, so it cannot also pay for a boot.
  await expectRefusal(preRegisterReadBudget({ grantPath: path, headCommit: HEAD, runRecord: record, requiredBoots: 1 }), 'GRANT_TOO_SMALL')
  // A caller may not hand itself a bigger cap than the grant records.
  const ok = grantFile(dir, { maxStarts: 2 })
  await expectRefusal(preRegisterReadBudget({ grantPath: ok, headCommit: HEAD, runRecord: record, maxHostStarts: 5 }), 'GRANT_MALFORMED')
  assert.equal(record.ledgerStartCount(), 0)
})

// ── 6. exhausted shared ledger ──────────────────────────────────────────────

test('gate: an EXHAUSTED shared ledger refuses and leaves the ledger byte-identical', async () => {
  const dir = tmp('exhausted')
  const ledger = join(dir, 'host-starts.jsonl')
  // Two rows from an earlier run already spent a 2-row grant.
  mkdirSync(dirname(ledger), { recursive: true })
  writeFileSync(ledger, [
    JSON.stringify({ at: '2026-11-03T00:00:00Z', phase: 'prior-boot', world: 'w1' }),
    JSON.stringify({ at: '2026-11-03T00:01:00Z', phase: 'prior-boot', world: 'w2' }),
  ].join('\n') + '\n')
  const record = recordFor(ledger)
  const before = ledgerText(ledger)
  const path = grantFile(dir, { maxStarts: 2 })
  await expectRefusal(preRegisterReadBudget({ grantPath: path, headCommit: HEAD, runRecord: record }), 'GRANT_EXHAUSTED')
  assert.equal(ledgerText(ledger), before, 'a refused gate must not append a reservation row')
  assert.equal(record.ledgerStartCount(), 2)
})

// ── 7. no shared ledger ⇒ no lease ──────────────────────────────────────────

test('gate: a run record with NO shared ledger path refuses (no second counter exists)', async () => {
  const dir = tmp('no-ledger')
  const record = createRunRecord({ runId: 'r', suite: 'a5sf-read', selectedCases: ['read:allowed-inside-ceiling'], bindings: {}, ledgerPath: null })
  const path = grantFile(dir)
  await expectRefusal(preRegisterReadBudget({ grantPath: path, headCommit: HEAD, runRecord: record }), 'LEDGER_UNAVAILABLE')
  assert.equal(record.ledgerStartCount(), 0)
})

// ── 8. the granted lease: reserve, then boot exactly once via a stub ────────

test('gate: a GRANTED lease appends its intent row BEFORE the boot, boots once, then refuses a second boot', async () => {
  const dir = tmp('granted')
  const ledger = join(dir, 'host-starts.jsonl')
  const record = recordFor(ledger)
  const path = grantFile(dir, { maxStarts: INTENT_ROWS_PER_LEASE + 1 })

  const lease = await preRegisterReadBudget({ grantPath: path, headCommit: HEAD, runRecord: record })
  assert.equal(lease.grant.grantId, 'grant-a5sf-p2-read-001')
  assert.equal(lease.intentRows().length, 1, 'exactly one pre-registration row on the SHARED ledger')
  assert.equal(record.ledgerStartCount(), 1, 'the reservation is a row on the one counter')

  const seen = []
  const stub = async () => {
    // INSIDE the boot thunk: the reservation must already be on the ledger, and
    // the boot row is the harness's own (simulated here as the ONE writer call).
    seen.push(record.ledgerStartCount())
    record.logHostStart({ phase: 'a5sf-read-boot1', world: 'stub-world' })
    return 'booted'
  }
  const result = await lease.boot(stub)
  assert.equal(result, 'booted')
  assert.deepEqual(seen, [1], 'the boot thunk saw the intent row BEFORE it ran (rows=1)')
  assert.equal(lease.bootsSpent(), 1)
  assert.equal(record.ledgerStartCount(), 2, 'intent row + start row = the grant\'s 2 rows')
  const rows = readFileSync(ledger, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.equal(rows[0].kind, 'budget-intent')
  assert.equal(rows[0].grantId, 'grant-a5sf-p2-read-001')
  assert.equal(rows[0].grantedBy, 'user-ruling-fixture')
  assert.equal(rows[0].boundCommit, HEAD)

  // The same imported `used >= max` formula refuses the second boot.
  await expectRefusal(lease.boot(stub), 'GRANT_EXHAUSTED')
  assert.equal(lease.bootsSpent(), 1, 'the stub ran exactly once')
  assert.equal(record.ledgerStartCount(), 2, 'a refused boot writes nothing')
})

// ── 9. the suite's run(): gate before World/factory, no verdicts on refusal ─

test('suite run: an absent grant refuses BEFORE any World/factory touch and records no case', async () => {
  const dir = tmp('run-refusal')
  const ledger = join(dir, 'host-starts.jsonl')
  const record = recordFor(ledger)
  let factoryTouched = 0
  const factorySpy = new Proxy({}, { get() { factoryTouched += 1; throw new Error('the factory must not be touched without a grant') } })
  const before = ledgerText(ledger)

  await assert.rejects(
    runA5sfRead(
      { record, evidence: dir, line: 'gate', factory: factorySpy, readDriver: { createReadDriver: () => ({ native: true, read() { throw new Error('never') } }) } },
      { REPO_ROOT },
    ),
    (error) => error instanceof A5sfReadGateError && error.reason === 'GRANT_ABSENT',
  )
  assert.equal(factoryTouched, 0, 'zero Worlds ⇒ zero startHost calls')
  assert.equal(ledgerText(ledger), before, 'zero ledger rows')
  assert.equal(record.record.cases.length, 0, 'no case verdict may be recorded by a refused run')
})

// ── 10. the live seam probe runs before the budget gate ─────────────────────

test('driver probe: no live read driver refuses LIVE_SEAM_UNAVAILABLE before reserving budget', async () => {
  const dir = tmp('no-driver')
  const ledger = join(dir, 'host-starts.jsonl')
  const record = recordFor(ledger)
  await assert.rejects(
    runA5sfRead({ record, evidence: dir, line: 'probe' }, { REPO_ROOT }),
    (error) => error instanceof A5sfReadGateError && error.code === 'LIVE_SEAM_UNAVAILABLE' && error.reason === 'NO_READ_DRIVER',
  )
  assert.equal(record.ledgerStartCount(), 0, 'a missing seam spends nothing')

  const injected = { createReadDriver: () => ({ native: true }) }
  assert.equal(await resolveReadDriver({ readDriver: injected }), injected)
})
