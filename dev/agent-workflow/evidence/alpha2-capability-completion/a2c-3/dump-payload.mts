#!/usr/bin/env node
/**
 * A2C-3 evidence driver — dumps the `config-inspected` payload (before and
 * after the fix) plus the deterministic-order and pure-read proof channels,
 * as plain JSON, from the SAME captured world state the test asserts on.
 *
 * How it works: the plain-node TS hooks (scripts/run-tests-hooks.mjs, the
 * same chain `run-tests.mjs` uses) resolve the test module's `.js` → `.ts`
 * siblings and the `vitest` → shim mapping. Importing the test module runs
 * its module-level drives (world build → human-override plant → four
 * `inspect-config` drives → world destroy) exactly once; the shim then
 * executes the `it` bodies (their pass/fail lines appear on stdout — on the
 * GREEN tree all 11 pass, on the base tree the 8 RED probes fail and 3
 * invariant legs pass, which is the expected pre-fix signature). The
 * exported `A2C3_CAPTURED` snapshot (plain data only — the world is already
 * destroyed) is then serialized here.
 *
 * Usage:
 *   node dev/agent-workflow/evidence/alpha2-capability-completion/a2c-3/dump-payload.mts > payload.json
 * (run from the worktree root; re-run under `git stash push` of the tracked
 * source edits to capture the PRE-fix payload into a second file)
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
// a2c-3 → alpha2-capability-completion → evidence → agent-workflow → dev → root
const root = join(here, '..', '..', '..', '..', '..')
register(join(root, 'scripts', 'run-tests-hooks.mjs'), import.meta.url)

const testModule = await import(
  pathToFileURL(join(root, 'packages', 'runtime', 'test', 'a2c3-inspect-operation-permission.test.ts')).href
)
const A2C3 = testModule.A2C3_CAPTURED

const outcomeOf = (outcome) => ({
  status: outcome.status,
  action: outcome.action,
  callerRole: outcome.callerRole,
  targetInstanceId: outcome.targetInstanceId ?? null,
  effect: outcome.effect,
})

const report = {
  generatedAt: new Date().toISOString(),
  heads: {
    note: 'git HEAD of the tree this ran on (see the sibling log header)',
  },
  payloads: {
    worker: outcomeOf(A2C3.inspectWorker),
    workerAgain: outcomeOf(A2C3.inspectWorkerAgain),
    leader: outcomeOf(A2C3.inspectLeader),
    scout: outcomeOf(A2C3.inspectScout),
  },
  deterministicOrder: {
    note: 'worker vs workerAgain — same target driven twice, effects must be byte-equal',
    byteEqual:
      JSON.stringify(A2C3.inspectWorker.effect) ===
      JSON.stringify(A2C3.inspectWorkerAgain.effect),
  },
  pureRead: {
    note: 'seam write log + every repository listing before vs after the four drives',
    writeCountBefore: A2C3.before.writeCount,
    writeCountAfter: A2C3.after.writeCount,
    writeLogBefore: A2C3.before.writeLog,
    writeLogAfter: A2C3.after.writeLog,
    memberInstancesEqual:
      JSON.stringify(A2C3.before.memberInstances) ===
      JSON.stringify(A2C3.after.memberInstances),
    overridesEqual:
      JSON.stringify(A2C3.before.overrides) === JSON.stringify(A2C3.after.overrides),
    ledgerEqual:
      JSON.stringify(A2C3.before.ledger) === JSON.stringify(A2C3.after.ledger),
    operationsEqual:
      JSON.stringify(A2C3.before.operations) === JSON.stringify(A2C3.after.operations),
  },
}

const out = process.argv[2]
if (out !== undefined) {
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n', 'utf8')
  process.stderr.write(`wrote ${out}\n`)
} else {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}
