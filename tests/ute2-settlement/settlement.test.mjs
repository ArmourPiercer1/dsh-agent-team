/**
 * settlement.test.mjs — UTE-2 / UTE G1-S3 ("Execution Settlement S1").
 *
 * One canonical fact per physical execution; idempotency; Stop before / during /
 * after the effect; SIGKILL recovery to UNKNOWN; no second Grant authority; and
 * crash safety of the record itself.
 *
 * HOST-FREE BY CONSTRUCTION. No Host boot, no DSH_HOME, no port, no pinned tree:
 * the module under test is TypeScript loaded directly by Node's type stripping
 * (Node >= 22.18 / 24, the repo's engines floor), and the only subprocess is the
 * ONE real SIGKILL child that proves hard death. Every other test is in-process.
 *
 * The negative controls are mutation controls: `lib/mutations.mjs` removes one
 * behaviour at a time and the same public-surface scenario must turn RED. This
 * file prints both halves of every control as `UTE2-CONTROL` / `UTE2-MUTANT`
 * lines, so the evidence transcript is the run's own output.
 *
 * Run:  node --test --test-reporter=spec tests/ute2-settlement/settlement.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test, { after } from 'node:test'

import {
  MUTANTS,
  SCENARIOS,
  T,
  admission,
  admittedObservation,
  codeOf,
  completedObservation,
  effectObservation,
  identity,
  openRunning,
  runMutant,
  runScenarioOnReal,
  runningObservation,
} from './lib/mutations.mjs'

const HERE = new URL('.', import.meta.url).pathname
const REPO_ROOT = resolve(HERE, '..', '..')
const MODULE_PATH = join(REPO_ROOT, 'packages', 'runtime', 'settlement', 'execution-settlement.ts')
const ADAPTER_PATH = join(REPO_ROOT, 'packages', 'runtime', 'settlement', 'writer-adapter.ts')
const TMP_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'ute2-settlement', `${process.pid}-${Date.now()}`)
mkdirSync(TMP_ROOT, { recursive: true })
after(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true })
})

/** The real module, loaded once. */
const settlement = await import(pathToFileURL(MODULE_PATH).href)
const adapter = await import(pathToFileURL(ADAPTER_PATH).href)
const MODULE_URL = pathToFileURL(MODULE_PATH).href
const ADAPTER_URL = pathToFileURL(ADAPTER_PATH).href

let dirCounter = 0
/** A fresh scratch directory under the workspace (never /tmp). */
function freshDir(name) {
  dirCounter += 1
  const dir = join(TMP_ROOT, `${String(dirCounter).padStart(2, '0')}-${name}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function storeAt(name) {
  return settlement.createExecutionSettlementStore({ dir: freshDir(name) })
}

/** A store + the contract writer over it (one writer per root). */
function writerAt(name, options = {}) {
  const dir = freshDir(name)
  const store = settlement.createExecutionSettlementStore({ dir, ...options })
  return { dir, store, writer: adapter.createExecutionSettlementWriter(store) }
}

/** A minimal contract fact (terminal by default). */
function contractFact(executionId, overrides = {}) {
  return {
    executionId,
    rootSessionId: 'world-ute2',
    agentInstanceId: 'member-1',
    hostCallId: 'call-ute2-1',
    controlRequestIds: ['req-ute2-1'],
    dispatch: 'started',
    bodyOutcome: 'completed',
    effectEvidence: 'observed',
    recordedAt: T(2),
    ...overrides,
  }
}

/** Spawn a real child that imports the settlement modules from the real URLs. */
function runChild(script) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, UTE2_MODULE_URL: MODULE_URL, UTE2_ADAPTER_URL: ADAPTER_URL },
    encoding: 'utf8',
  })
}

/** A record that has been admitted, run, and completed (the common fixture). */
function completedRecord(store, executionId, at = T(2)) {
  store.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })
  store.enterRunning({ executionId, observation: runningObservation(executionId), at: T(1) })
  return store.settle({
    executionId,
    state: 'COMPLETED',
    at,
    reason: 'body-returned',
    observation: completedObservation(executionId),
  })
}

// --------------------------------------------------------------- S1: one fact

test('one canonical record per physical execution, and the same facts twice is a named duplicate', () => {
  const store = storeAt('canonical')
  const executionId = 'exec-ute2-canonical'

  const admitted = store.recordAdmission({
    identity: identity(executionId),
    admission: admission(executionId),
    at: T(0),
  })
  assert.equal(admitted.outcome, 'created')
  assert.equal(admitted.record.state, 'ADMITTED')
  assert.equal(admitted.record.transitions.length, 1)

  const running = store.enterRunning({
    executionId,
    observation: runningObservation(executionId),
    at: T(1),
  })
  assert.equal(running.outcome, 'transitioned')
  assert.equal(running.record.state, 'RUNNING')

  const doneInput = {
    executionId,
    state: 'COMPLETED',
    at: T(2),
    reason: 'body-returned',
    observation: effectObservation(executionId),
  }
  const done = store.settle(doneInput)
  assert.equal(done.outcome, 'transitioned')
  assert.equal(done.record.state, 'COMPLETED')
  assert.equal(done.record.observation.observedEffects.length, 1, 'the observed effect is carried on the fact')

  const record = store.read(executionId)
  assert.deepEqual(record.transitions.map((transition) => transition.seq), [1, 2, 3], 'the transition log is monotonic')
  assert.deepEqual(record.transitions.map((transition) => transition.to), ['ADMITTED', 'RUNNING', 'COMPLETED'])
  assert.deepEqual(record.transitions.map((transition) => transition.from), [null, 'ADMITTED', 'RUNNING'])
  assert.equal(record.state, record.transitions.at(-1).to)
  assert.equal(record.updatedAt, record.transitions.at(-1).at)
  assert.equal(record.createdAt, T(0))
  assert.equal(record.identity.executionId, executionId)
  assert.equal(record.admission.decision, 'allow')
  assert.equal(record.admission.decisionDigest.length, 64)
  assert.equal(store.list().length, 1, 'one physical execution owns exactly one canonical record')

  const path = settlement.settlementRecordPath(store.dir, executionId)
  const bytesBefore = readFileSync(path, 'utf8')

  const duplicate = store.settle(doneInput)
  assert.equal(duplicate.outcome, 'duplicate')
  assert.equal(duplicate.code, 'DUPLICATE_SETTLEMENT')
  assert.deepEqual(duplicate.record, record, 'the duplicate returns the SAME record, not a new revision')
  assert.equal(readFileSync(path, 'utf8'), bytesBefore, 'a duplicate no-op does not rewrite the record')
  assert.equal(store.list().length, 1)

  const admissionDuplicate = store.recordAdmission({
    identity: identity(executionId),
    admission: admission(executionId),
    at: T(0),
  })
  assert.equal(admissionDuplicate.outcome, 'duplicate')
  assert.equal(admissionDuplicate.code, 'DUPLICATE_SETTLEMENT')

  console.log(`UTE2-FACT executionId=${executionId} transitions=${record.transitions.length} state=${record.state} duplicate=DUPLICATE_SETTLEMENT`)
})

test('writing twice with CONFLICTING facts is a named refusal, never last-writer-wins', () => {
  const store = storeAt('conflict')
  const executionId = 'exec-ute2-conflict'
  const original = completedRecord(store, executionId)
  const path = settlement.settlementRecordPath(store.dir, executionId)
  const bytesBefore = readFileSync(path, 'utf8')

  const code = codeOf(() =>
    store.settle({
      executionId,
      state: 'FAILED',
      at: T(3),
      reason: 'a-different-answer',
      observation: completedObservation(executionId, { bodyOutcome: 'failed' }),
    }),
  )
  assert.equal(code, 'SETTLEMENT_CONFLICT')
  assert.equal(readFileSync(path, 'utf8'), bytesBefore, 'the refused write leaves the canonical fact byte-identical')
  assert.deepEqual(store.read(executionId), original.record)

  // The same applies to the admission half: a second, different reference for
  // the same ExecutionId is a conflict, not a re-decision.
  const other = storeAt('conflict-admission')
  const id = 'exec-ute2-conflict-admission'
  other.recordAdmission({ identity: identity(id), admission: admission(id), at: T(0) })
  const admissionCode = codeOf(() =>
    other.recordAdmission({
      identity: identity(id),
      admission: admission(id, { decisionId: 'decision-other', decisionDigest: 'cd'.repeat(32) }),
      at: T(0),
    }),
  )
  assert.equal(admissionCode, 'SETTLEMENT_CONFLICT')
  assert.equal(other.read(id).admission.decisionId, `decision-${id}`, 'the first admission reference stays authoritative')

  console.log('UTE2-CONFLICT conflicting-terminal=SETTLEMENT_CONFLICT conflicting-admission=SETTLEMENT_CONFLICT last-writer-wins=absent')
})

// ------------------------------------------------------- state machine refuse

test('illegal transitions are refused by NAME, never silently rewritten', () => {
  const store = storeAt('illegal')
  const executionId = 'exec-ute2-illegal'
  store.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })

  // ADMITTED -> COMPLETED skips the dispatch fact.
  const skip = codeOf(() =>
    store.settle({
      executionId,
      state: 'COMPLETED',
      at: T(1),
      reason: 'skipped-dispatch',
      observation: completedObservation(executionId),
    }),
  )
  assert.equal(skip, 'ILLEGAL_TRANSITION')
  assert.equal(store.read(executionId).state, 'ADMITTED', 'the refused transition did not advance the record')

  // `settle` is a terminal writer only.
  const nonTerminal = codeOf(() =>
    store.settle({
      executionId,
      state: 'RUNNING',
      at: T(1),
      reason: 'not-terminal',
      observation: runningObservation(executionId),
    }),
  )
  assert.equal(nonTerminal, 'SETTLEMENT_INPUT_INVALID')

  const completed = storeAt('illegal-terminal')
  const id = 'exec-ute2-terminal'
  completedRecord(completed, id)
  const reopen = codeOf(() => completed.enterRunning({ executionId: id, observation: runningObservation(id), at: T(9) }))
  assert.equal(reopen, 'ILLEGAL_TRANSITION')
  assert.equal(completed.read(id).state, 'COMPLETED')

  // The transition log's timestamps are monotonic too.
  const regression = storeAt('illegal-time')
  const rid = 'exec-ute2-time'
  regression.recordAdmission({ identity: identity(rid), admission: admission(rid), at: T(5) })
  regression.enterRunning({ executionId: rid, observation: runningObservation(rid), at: T(6) })
  const backwards = codeOf(() =>
    regression.settle({
      executionId: rid,
      state: 'COMPLETED',
      at: T(4),
      reason: 'time-travel',
      observation: completedObservation(rid),
    }),
  )
  assert.equal(backwards, 'SETTLEMENT_TIMESTAMP_REGRESSION')

  console.log('UTE2-TRANSITION ADMITTED->COMPLETED=ILLEGAL_TRANSITION terminal->RUNNING=ILLEGAL_TRANSITION settle(RUNNING)=SETTLEMENT_INPUT_INVALID backwards-time=SETTLEMENT_TIMESTAMP_REGRESSION')
})

// ------------------------------------------------------------------- Stop

test('Stop BEFORE the effect: recorded pre-dispatch, settles CANCELLED with zero effect', () => {
  const store = storeAt('stop-before')
  const executionId = 'exec-ute2-stop-before'
  store.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })
  const stopped = store.recordStop({ executionId, stopId: 'stop-1', at: T(1), phase: 'pre-dispatch' })
  assert.equal(stopped.outcome, 'recorded')
  assert.equal(stopped.record.state, 'ADMITTED', 'recording a Stop does not itself change the state')

  const settled = store.settle({
    executionId,
    state: 'CANCELLED',
    at: T(2),
    reason: 'stopped-before-dispatch',
    observation: admittedObservation(executionId),
  })
  assert.equal(settled.record.state, 'CANCELLED')
  assert.equal(settled.record.stops.length, 1)
  assert.equal(settled.record.stops[0].phase, 'pre-dispatch')
  assert.equal(settled.record.observation.effectEvidence, 'none-confirmed')
  assert.deepEqual(settled.record.observation.observedEffects, [])

  // A CANCELLED record with no Stop evidence is refused: the fact cannot explain
  // why it was cancelled.
  const noStop = storeAt('stop-before-missing')
  const id = 'exec-ute2-stop-missing'
  noStop.recordAdmission({ identity: identity(id), admission: admission(id), at: T(0) })
  const missing = codeOf(() =>
    noStop.settle({ executionId: id, state: 'CANCELLED', at: T(1), reason: 'no-stop', observation: admittedObservation(id) }),
  )
  assert.equal(missing, 'STOP_EVIDENCE_MISSING')

  // A Stop's phase is tied to the state it arrived in.
  const wrongPhase = storeAt('stop-before-phase')
  const pid = 'exec-ute2-stop-phase'
  wrongPhase.recordAdmission({ identity: identity(pid), admission: admission(pid), at: T(0) })
  const illegal = codeOf(() => wrongPhase.recordStop({ executionId: pid, stopId: 'stop-x', at: T(1), phase: 'in-flight' }))
  assert.equal(illegal, 'ILLEGAL_STOP_TIMING')

  console.log('UTE2-STOP before state=CANCELLED effect=none-confirmed stopPhase=pre-dispatch')
})

test('Stop DURING the effect: settles CANCELLED and carries only effects an observation supports', () => {
  const store = storeAt('stop-during')
  const executionId = 'exec-ute2-stop-during'
  store.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })
  store.enterRunning({ executionId, observation: runningObservation(executionId), at: T(1) })
  store.recordStop({ executionId, stopId: 'stop-2', at: T(2), phase: 'in-flight' })

  const observed = {
    executionId,
    dispatch: 'quiesced',
    bodyOutcome: 'unknown',
    effectEvidence: 'observed',
    observedEffects: [
      { kind: 'file-content', target: 'workspace/partial.txt', evidenceId: 'witness-ute2-partial' },
    ],
  }
  const settled = store.settle({
    executionId,
    state: 'CANCELLED',
    at: T(3),
    reason: 'stop-in-flight',
    observation: observed,
  })
  assert.equal(settled.record.state, 'CANCELLED')
  assert.equal(settled.record.stops[0].phase, 'in-flight')
  assert.equal(settled.record.observation.effectEvidence, 'observed')
  assert.equal(settled.record.observation.observedEffects[0].evidenceId, 'witness-ute2-partial')

  // "Observed" with nothing observed is refused, even for a cancellation.
  const unbacked = storeAt('stop-during-unbacked')
  const id = 'exec-ute2-stop-unbacked'
  unbacked.recordAdmission({ identity: identity(id), admission: admission(id), at: T(0) })
  unbacked.enterRunning({ executionId: id, observation: runningObservation(id), at: T(1) })
  unbacked.recordStop({ executionId: id, stopId: 'stop-3', at: T(2), phase: 'in-flight' })
  const code = codeOf(() =>
    unbacked.settle({
      executionId: id,
      state: 'CANCELLED',
      at: T(3),
      reason: 'stop-in-flight',
      observation: {
        executionId: id,
        dispatch: 'quiesced',
        bodyOutcome: 'unknown',
        effectEvidence: 'observed',
        observedEffects: [],
      },
    }),
  )
  assert.equal(code, 'EFFECT_CLAIM_WITHOUT_OBSERVATION')

  // A CANCELLED record from RUNNING without an in-flight Stop is refused.
  const noStop = storeAt('stop-during-missing')
  const nid = 'exec-ute2-stop-during-missing'
  noStop.recordAdmission({ identity: identity(nid), admission: admission(nid), at: T(0) })
  noStop.enterRunning({ executionId: nid, observation: runningObservation(nid), at: T(1) })
  const missing = codeOf(() =>
    noStop.settle({ executionId: nid, state: 'CANCELLED', at: T(2), reason: 'no-stop', observation: runningObservation(nid) }),
  )
  assert.equal(missing, 'STOP_EVIDENCE_MISSING')

  console.log('UTE2-STOP during state=CANCELLED observedEffects=1 unbacked-claim=EFFECT_CLAIM_WITHOUT_OBSERVATION')
})

test('Stop AFTER completion: recorded additively; the achieved outcome is never rewritten', () => {
  const store = storeAt('stop-after')
  const executionId = 'exec-ute2-stop-after'
  const original = completedRecord(store, executionId)
  assert.equal(original.record.terminalReason, 'body-returned')

  const stopped = store.recordStop({ executionId, stopId: 'stop-late', at: T(3), phase: 'post-completion' })
  assert.equal(stopped.outcome, 'recorded')
  assert.equal(stopped.record.state, 'COMPLETED', 'a late Stop cannot downgrade a completed fact')
  assert.equal(stopped.record.terminalReason, 'body-returned')
  assert.deepEqual(stopped.record.observation, original.record.observation)
  assert.equal(stopped.record.stops.length, 1)
  assert.equal(stopped.record.stops[0].phase, 'post-completion')

  const duplicate = store.settle({
    executionId,
    state: 'COMPLETED',
    at: T(2),
    reason: 'body-returned',
    observation: completedObservation(executionId),
  })
  assert.equal(duplicate.code, 'DUPLICATE_SETTLEMENT')
  assert.equal(duplicate.record.stops.length, 1, 'the late Stop stays in the record')

  // A "post-completion" Stop while the execution is still RUNNING is impossible.
  const running = storeAt('stop-after-illegal')
  const rid = 'exec-ute2-stop-after-illegal'
  running.recordAdmission({ identity: identity(rid), admission: admission(rid), at: T(0) })
  running.enterRunning({ executionId: rid, observation: runningObservation(rid), at: T(1) })
  const illegal = codeOf(() =>
    running.recordStop({ executionId: rid, stopId: 'stop-y', at: T(2), phase: 'post-completion' }),
  )
  assert.equal(illegal, 'ILLEGAL_STOP_TIMING')

  console.log('UTE2-STOP after state=COMPLETED terminalReason=unchanged stopPhase=post-completion')
})

// --------------------------------------------------- SIGKILL / unknown recovery

test('SIGKILL hard death: recovery yields UNKNOWN (never COMPLETED, never REFUSED), naming what is missing', () => {
  const dir = freshDir('sigkill-records')
  const executionId = 'exec-ute2-sigkill'
  const childScript = `
const { pathToFileURL } = await import('node:url')
const module = await import(pathToFileURL(${JSON.stringify(MODULE_PATH)}).href)
const store = module.createExecutionSettlementStore({ dir: ${JSON.stringify(dir)} })
store.recordAdmission({
  identity: ${JSON.stringify(identity(executionId))},
  admission: ${JSON.stringify(admission(executionId))},
  at: ${JSON.stringify(T(0))},
})
store.enterRunning({
  executionId: ${JSON.stringify(executionId)},
  observation: ${JSON.stringify(runningObservation(executionId))},
  at: ${JSON.stringify(T(1))},
})
process.kill(process.pid, 'SIGKILL')
`
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', childScript], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  })
  assert.equal(child.error, undefined, `the SIGKILL child could not start: ${String(child.error)}`)
  assert.equal(child.signal, 'SIGKILL', `expected a hard SIGKILL death, got signal=${String(child.signal)} status=${String(child.status)} stderr=${child.stderr}`)
  assert.equal(child.status, null)

  // A cold store: the writer process is gone, only its durable record remains.
  const cold = settlement.createExecutionSettlementStore({ dir })
  const before = cold.read(executionId)
  assert.equal(before.state, 'RUNNING', 'the durable record survived the hard death in RUNNING')

  const recovered = cold.recoverUnsettled(T(5))
  assert.equal(recovered.length, 1)
  assert.equal(recovered[0].before, 'RUNNING')
  assert.equal(recovered[0].after, 'UNKNOWN')

  const after = cold.read(executionId)
  assert.equal(after.state, 'UNKNOWN')
  assert.notEqual(after.state, 'COMPLETED')
  assert.notEqual(after.state, 'REFUSED')
  assert.equal(after.terminalReason, 'PROCESS_TERMINATED_WITHOUT_OUTCOME')
  assert.ok(after.missingEvidence.length > 0, 'UNKNOWN must name the evidence that is missing')
  assert.ok(after.missingEvidence.includes('host-result'), `missingEvidence must name host-result: ${after.missingEvidence.join(',')}`)
  assert.ok(after.missingEvidence.includes('terminal-observation'))
  assert.equal(after.observation.effectEvidence, 'unknown', 'unknown is not "no effect"')
  assert.equal(after.transitions.at(-1).to, 'UNKNOWN')

  const again = cold.recoverUnsettled(T(6))
  assert.deepEqual(again, [], 'a second recovery finds nothing unsettled — UNKNOWN is terminal')
  assert.deepEqual(cold.read(executionId), after, 'recovery is idempotent and never rewrites the fact')

  console.log(`UTE2-SIGKILL signal=SIGKILL durable=ADMITTED,RUNNING recovered=${after.state} reason=${after.terminalReason} missing=${after.missingEvidence.join('|')}`)
})

// ------------------------------------------------------- effect / admissions

test('a settlement claiming an effect with no observation is refused', () => {
  const store = storeAt('effects')
  const executionId = 'exec-ute2-effects'
  store.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })
  store.enterRunning({ executionId, observation: runningObservation(executionId), at: T(1) })

  const unobserved = codeOf(() =>
    store.settle({
      executionId,
      state: 'COMPLETED',
      at: T(2),
      reason: 'body-returned',
      observation: completedObservation(executionId, { effectEvidence: 'observed', observedEffects: [] }),
    }),
  )
  assert.equal(unobserved, 'EFFECT_CLAIM_WITHOUT_OBSERVATION')

  const hidden = codeOf(() =>
    store.settle({
      executionId,
      state: 'COMPLETED',
      at: T(2),
      reason: 'body-returned',
      observation: completedObservation(executionId, {
        effectEvidence: 'none-confirmed',
        observedEffects: [{ kind: 'file-content', target: 'x', evidenceId: 'e1' }],
      }),
    }),
  )
  assert.equal(hidden, 'EFFECT_CLAIM_WITHOUT_OBSERVATION')

  const noEvidenceId = codeOf(() =>
    store.settle({
      executionId,
      state: 'COMPLETED',
      at: T(2),
      reason: 'body-returned',
      observation: completedObservation(executionId, {
        effectEvidence: 'observed',
        observedEffects: [{ kind: 'file-content', target: 'x', evidenceId: '' }],
      }),
    }),
  )
  assert.equal(noEvidenceId, 'SETTLEMENT_INPUT_INVALID')

  assert.equal(store.read(executionId).state, 'RUNNING', 'every refusal left the record untouched')

  // UNKNOWN may not claim "none-confirmed" (that is proof of absence) and must
  // name what is missing.
  const unknownNone = codeOf(() =>
    store.settle({
      executionId,
      state: 'UNKNOWN',
      at: T(2),
      reason: 'unprovable',
      missingEvidence: ['host-result'],
      observation: { ...runningObservation(executionId), effectEvidence: 'none-confirmed' },
    }),
  )
  assert.equal(unknownNone, 'UNCONFIRMED_WITHOUT_UNCERTAINTY')

  const unknownNoMissing = codeOf(() =>
    store.settle({
      executionId,
      state: 'UNKNOWN',
      at: T(2),
      reason: 'unprovable',
      observation: { ...runningObservation(executionId), effectEvidence: 'unknown' },
    }),
  )
  assert.equal(unknownNoMissing, 'UNCONFIRMED_WITHOUT_UNCERTAINTY')

  console.log('UTE2-EFFECT observed-without-observation=EFFECT_CLAIM_WITHOUT_OBSERVATION unknown-without-missing=UNCONFIRMED_WITHOUT_UNCERTAINTY')
})

test('two settlements cross-wired between executions are refused', () => {
  const store = storeAt('cross-wire')
  const a = 'exec-ute2-a'
  const b = 'exec-ute2-b'

  // An admission reference belonging to B cannot open A.
  const mixedAdmission = codeOf(() =>
    store.recordAdmission({ identity: identity(a), admission: admission(b), at: T(0) }),
  )
  assert.equal(mixedAdmission, 'SETTLEMENT_CROSS_WIRED')
  assert.equal(store.read(a), null, 'the cross-wired write created nothing')

  // Two legitimate records; then each is handed the other's observation.
  completedRecord(store, a)
  store.recordAdmission({ identity: identity(b), admission: admission(b), at: T(0) })
  store.enterRunning({ executionId: b, observation: runningObservation(b), at: T(1) })

  const crossedRunning = codeOf(() =>
    store.enterRunning({ executionId: a, observation: runningObservation(b), at: T(3) }),
  )
  assert.equal(crossedRunning, 'SETTLEMENT_CROSS_WIRED')

  const crossedSettle = codeOf(() =>
    store.settle({
      executionId: b,
      state: 'COMPLETED',
      at: T(2),
      reason: 'body-returned',
      observation: completedObservation(a),
    }),
  )
  assert.equal(crossedSettle, 'SETTLEMENT_CROSS_WIRED')
  assert.equal(store.read(b).state, 'RUNNING', 'B was not settled by A\'s facts')
  assert.equal(store.read(a).state, 'COMPLETED')

  console.log('UTE2-CROSSWIRE admission=SETTLEMENT_CROSS_WIRED running=SETTLEMENT_CROSS_WIRED settle=SETTLEMENT_CROSS_WIRED')
})

test('admission coherence is recorded, never re-decided: REFUSED needs a deny reference', () => {
  const store = storeAt('admission-coherence')
  const executionId = 'exec-ute2-refused'
  store.recordAdmission({
    identity: identity(executionId),
    admission: admission(executionId, { decision: 'allow' }),
    at: T(0),
  })
  const incoherent = codeOf(() =>
    store.settle({
      executionId,
      state: 'REFUSED',
      at: T(1),
      reason: 'should-not-be-possible',
      observation: admittedObservation(executionId),
    }),
  )
  assert.equal(incoherent, 'SETTLEMENT_ADMISSION_MISMATCH')
  assert.equal(store.read(executionId).state, 'ADMITTED')

  const denied = storeAt('admission-coherence-deny')
  const did = 'exec-ute2-denied'
  denied.recordAdmission({
    identity: identity(did),
    admission: admission(did, { decision: 'deny' }),
    at: T(0),
  })
  const refused = denied.settle({
    executionId: did,
    state: 'REFUSED',
    at: T(1),
    reason: 'final-guard-denied',
    observation: admittedObservation(did),
  })
  assert.equal(refused.record.state, 'REFUSED')
  assert.equal(refused.record.observation.effectEvidence, 'none-confirmed')

  // A denied reference can never be recorded as having run.
  const runDenied = storeAt('admission-coherence-run')
  const rid = 'exec-ute2-denied-run'
  runDenied.recordAdmission({ identity: identity(rid), admission: admission(rid, { decision: 'deny' }), at: T(0) })
  const code = codeOf(() => runDenied.enterRunning({ executionId: rid, observation: runningObservation(rid), at: T(1) }))
  assert.equal(code, 'SETTLEMENT_ADMISSION_MISMATCH')

  console.log('UTE2-ADMISSION allow+REFUSED=SETTLEMENT_ADMISSION_MISMATCH deny+REFUSED=recorded deny+RUNNING=SETTLEMENT_ADMISSION_MISMATCH')
})

// -------------------------------------------------------- no second authority

test('NO SECOND AUTHORITY: the module surface cannot grant, deny, or mint an admission reference', () => {
  const forbidden = /^(admit|allow|deny|grant|authorize|approve|permit|revoke|decide)/i
  const exportedFunctions = Object.entries(settlement)
    .filter(([, value]) => typeof value === 'function')
    .map(([name]) => name)
  const offenders = exportedFunctions.filter((name) => forbidden.test(name))
  assert.deepEqual(offenders, [], `the public module surface must expose no grant-shaped function, found: ${offenders.join(', ')}`)
  assert.equal(
    Object.prototype.hasOwnProperty.call(settlement, 'createAdmissionReference'),
    false,
    'there must be no exported factory that mints an admission reference',
  )
  // The only admission-named exports are pure READ accessors over an existing
  // reference; neither can mint or alter one.
  assert.deepEqual(
    exportedFunctions.filter((name) => /decision|admission/i.test(name)).sort(),
    ['admissionDecision', 'admissionRequestIds'],
    'the only admission-named exports are the read-only accessors',
  )
  const frozenAdmission = Object.freeze(admission('exec-ute2-accessor'))
  assert.equal(settlement.admissionDecision(frozenAdmission), 'allow')
  assert.deepEqual(settlement.admissionRequestIds(frozenAdmission), [])
  assert.equal(settlement.admissionDecision(Object.freeze({ ...frozenAdmission, decision: undefined })), null)

  // The writer adapter exposes exactly one factory, and no runtime import of
  // the control plane (it has NO runtime import at all: type-only + node:crypto).
  const adapterFunctions = Object.entries(adapter)
    .filter(([, value]) => typeof value === 'function')
    .map(([name]) => name)
  assert.deepEqual(adapterFunctions, ['createExecutionSettlementWriter'])
  assert.deepEqual(adapterFunctions.filter((name) => forbidden.test(name)), [])
  const adapterSource = readFileSync(ADAPTER_PATH, 'utf8')
  const adapterRuntimeImports = adapterSource
    .split('\n')
    .filter((line) => /^\s*import\s/.test(line) && !/^\s*import\s+type\b/.test(line))
    .join('\n')
  assert.equal(/control|settlement/i.test(adapterRuntimeImports), false, `the adapter has no runtime settlement/control import:\n${adapterRuntimeImports}`)

  // The store is the writer; its methods are recorders/readers only.
  const store = storeAt('authority-surface')
  const methods = Object.getOwnPropertyNames(store).filter((name) => typeof store[name] === 'function')
  assert.deepEqual(methods.filter((name) => forbidden.test(name)), [], `store methods must not decide: ${methods.join(', ')}`)
  // RE-POINTED (round 80) — the set gained ONE RECORDER, and that is the whole
  // change: `recordRecheckDecision` (commit 710edb87f, round 73 settlement
  // Option A; contract change request + arms ADM-119…ADM-124 in
  // `dev/agent-workflow/evidence/ute-a1/CONTRACT-CHANGE-REQUEST-settlement-recheck.md`)
  // appends the durable recheck deny BESIDE the untouched allow, so the record
  // can settle REFUSED/not-started citing it. It cannot grant, deny, or mint an
  // admission reference — it writes a fact about a decision made elsewhere — so
  // the forbidden-grant assertion above still covers it, and the list stays an
  // exact set: a new DECIDER still turns this arm RED.
  assert.deepEqual([...methods].sort(), [
    'enterRunning',
    'list',
    'read',
    'recordAdmission',
    'recordRecheckDecision',
    'recordStop',
    'recoverUnsettled',
    'settle',
  ])

  // The module source imports no ControlService / control module.
  const source = readFileSync(MODULE_PATH, 'utf8')
  const importLines = source
    .split('\n')
    .filter((line) => /^\s*import\b/.test(line))
    .join('\n')
  assert.equal(/control/i.test(importLines), false, `the module must not import the control plane:\n${importLines}`)
  assert.equal(/createControlService|requestControl|resolveControl/.test(source), false)

  // The reference is immutable once accepted.
  const executionId = 'exec-ute2-authority'
  store.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })
  const record = store.read(executionId)
  assert.ok(Object.isFrozen(record.admission), 'the admission reference is frozen')
  assert.ok(Object.isFrozen(record.identity))
  assert.throws(() => {
    record.admission.decision = 'deny'
  }, TypeError)
  assert.equal(store.read(executionId).admission.decision, 'allow')

  // A reference that is not a reference (no digest / bad digest) is refused.
  const invalid = codeOf(() =>
    store.recordAdmission({
      identity: identity('exec-ute2-bad-ref'),
      admission: { ...admission('exec-ute2-bad-ref'), decisionDigest: 'not-a-digest' },
      at: T(0),
    }),
  )
  assert.equal(invalid, 'SETTLEMENT_ADMISSION_REFERENCE_INVALID')

  console.log(`UTE2-AUTHORITY exports=${exportedFunctions.length} grant-shaped=0 store-methods=${methods.join(',')} control-imports=0 ref-frozen=true`)
})

// ------------------------------------------------------- crash safety

test('an interrupted write never reads as a complete record: temp files are invisible, corrupt bytes refuse', () => {
  // (a) A temp file left by an interrupted write is not a record.
  const tempDir = freshDir('crash-temp')
  const tempId = 'exec-ute2-temp'
  writeFileSync(join(tempDir, `${tempId}.settlement.json.1234.1.tmp`), '{"half":')
  const tempStore = settlement.createExecutionSettlementStore({ dir: tempDir })
  assert.equal(tempStore.read(tempId), null, 'a half-written temp file is not a record')
  assert.deepEqual(tempStore.list(), [], 'list ignores in-progress writes')
  assert.deepEqual(readdirSync(tempDir).filter((n) => n.endsWith('.tmp')).length, 1)

  // (b) A truncated FINAL file is a named refusal, never "absent" and never
  // "complete".
  const truncatedDir = freshDir('crash-truncated')
  writeFileSync(join(truncatedDir, `exec-ute2-truncated.settlement.json`), '{"schema":"execution-set')
  const truncatedStore = settlement.createExecutionSettlementStore({ dir: truncatedDir })
  assert.throws(
    () => truncatedStore.read('exec-ute2-truncated'),
    (error) => error?.code === 'SETTLEMENT_CORRUPT',
    'a truncated record must refuse with SETTLEMENT_CORRUPT',
  )

  // (c) A tampered payload fails the checksum.
  const tamperedDir = freshDir('crash-tampered')
  const tamperedStore = settlement.createExecutionSettlementStore({ dir: tamperedDir })
  const tamperedId = 'exec-ute2-tampered'
  completedRecord(tamperedStore, tamperedId)
  const tamperedPath = settlement.settlementRecordPath(tamperedDir, tamperedId)
  const envelope = JSON.parse(readFileSync(tamperedPath, 'utf8'))
  envelope.payload.observation.bodyOutcome = 'failed'
  writeFileSync(tamperedPath, JSON.stringify(envelope))
  const code = codeOf(() => tamperedStore.read(tamperedId))
  assert.equal(code, 'SETTLEMENT_CORRUPT')
  assert.equal(codeOf(() => tamperedStore.list()), 'SETTLEMENT_CORRUPT', 'list must not silently skip a corrupt record')

  // (d) Atomic publish: a stale temp beside a valid record does not disturb it.
  const atomicDir = freshDir('crash-atomic')
  const atomicStore = settlement.createExecutionSettlementStore({ dir: atomicDir })
  const atomicId = 'exec-ute2-atomic'
  const settled = completedRecord(atomicStore, atomicId)
  writeFileSync(join(atomicDir, `${atomicId}.settlement.json.999.9.tmp`), 'garbage')
  assert.deepEqual(atomicStore.read(atomicId), settled.record)
  assert.equal(atomicStore.list().length, 1)

  console.log('UTE2-CRASH temp-invisible=true truncated=SETTLEMENT_CORRUPT tampered=SETTLEMENT_CORRUPT stale-temp-does-not-disturb=true')
})

// ------------------------------------------------------- writer adapter (UTE-1)

test('adapter: ONE fact per physical execution, the S1 completeness surface, and a cold read', async () => {
  const { dir, store, writer } = writerAt('adapter-canonical')
  const executionId = 'exec-ute2-adapter-canonical'
  const open = contractFact(executionId, {
    controlRequestIds: [],
    dispatch: 'not-started',
    bodyOutcome: 'unknown',
    effectEvidence: 'none-confirmed',
  })

  const admitted = await writer.record(open)
  assert.deepEqual(admitted, { recorded: true })
  assert.deepEqual(await writer.listUnsettled('world-ute2'), [executionId])
  assert.deepEqual(await writer.listUnsettled('world-someone-else'), [], 'the surface is root-scoped')

  const stored = store.read(executionId)
  assert.equal(stored.state, 'ADMITTED')
  assert.equal(stored.admission.admissionKind, 'no-control-request', 'a fact with no request leg mints no decision')
  assert.equal(stored.admission.decision, undefined)

  const settled = await writer.record(contractFact(executionId))
  assert.deepEqual(settled, { recorded: true })
  assert.deepEqual(await writer.listUnsettled('world-ute2'), [], 'a settled execution is not a gap')
  assert.deepEqual(await writer.record(contractFact(executionId)), {
    recorded: false,
    reason: 'DUPLICATE_SETTLEMENT',
  })

  const cold = adapter.createExecutionSettlementWriter(
    settlement.createExecutionSettlementStore({ dir }),
  )
  const coldFact = await cold.read(executionId)
  assert.equal(coldFact.bodyOutcome, 'completed')
  assert.equal(coldFact.dispatch, 'started')
  assert.equal(coldFact.effectEvidence, 'observed')
  assert.deepEqual(coldFact.controlRequestIds, ['req-ute2-1'])
  assert.equal(await cold.read('exec-ute2-never-existed'), undefined)

  // The adapter records a REFERENCE admission when the fact names a request.
  const linked = 'exec-ute2-adapter-linked'
  await writer.record(
    contractFact(linked, { dispatch: 'not-started', bodyOutcome: 'unknown', effectEvidence: 'none-confirmed' }),
  )
  const linkedRecord = store.read(linked)
  assert.equal(linkedRecord.admission.admissionKind, 'control-request-reference')
  assert.deepEqual([...linkedRecord.admission.requestIds], ['req-ute2-1'])
  assert.equal(linkedRecord.admission.decision, undefined)
  console.log('UTE2-ADAPTER canonical=true unsettled-gap=true cold-read=true reference-admission=true')
})

test('adapter: duplicate and conflicting terminal facts are NAMED refusals, never overwrites', async () => {
  const { store, writer } = writerAt('adapter-duplicate')
  const executionId = 'exec-ute2-adapter-dup'
  const fact = contractFact(executionId)
  const first = await writer.record(fact)
  assert.deepEqual(first, { recorded: true })
  const path = settlement.settlementRecordPath(store.dir, executionId)
  const before = readFileSync(path, 'utf8')

  const duplicate = await writer.record({ ...fact, recordedAt: T(9), recovery: { reconciledFrom: 'ADMITTED', at: T(9), detail: 'a-later-retry' } })
  assert.equal(duplicate.recorded, false)
  assert.equal(duplicate.reason, 'DUPLICATE_SETTLEMENT')
  assert.equal(readFileSync(path, 'utf8'), before, 'a duplicate leaves the canonical bytes untouched')

  const conflict = await writer.record({ ...fact, bodyOutcome: 'failed', recordedAt: T(10) })
  assert.equal(conflict.recorded, false)
  assert.equal(conflict.reason, 'SETTLEMENT_CONFLICT')
  assert.equal(readFileSync(path, 'utf8'), before, 'a conflict never rewrites the achieved outcome')
  assert.equal((await writer.read(executionId)).bodyOutcome, 'completed')

  // A foreign root/agent for an existing ExecutionId is the existing cross-wire
  // refusal and it leaves no second record behind.
  const crossId = 'exec-ute2-adapter-cross'
  await writer.record(
    contractFact(crossId, { dispatch: 'not-started', bodyOutcome: 'unknown', effectEvidence: 'none-confirmed' }),
  )
  const cross = await writer.record(
    contractFact(crossId, {
      rootSessionId: 'world-other',
      agentInstanceId: 'member-other',
      dispatch: 'not-started',
      bodyOutcome: 'unknown',
      effectEvidence: 'none-confirmed',
    }),
  )
  assert.deepEqual(cross, { recorded: false, reason: 'SETTLEMENT_CROSS_WIRED' })
  assert.equal(store.read(crossId).identity.worldId, 'world-ute2')
  console.log('UTE2-ADAPTER-DUP duplicate=DUPLICATE_SETTLEMENT conflict=SETTLEMENT_CONFLICT bytes-unchanged=true')
})

test('adapter: projectControlResult is a read-compatible projection that never fabricates a requestId', async () => {
  const { writer } = writerAt('adapter-projection')
  const executionId = 'exec-ute2-projected'
  await writer.record(contractFact(executionId, { hostCallId: 'call-ute2-projected' }))

  const matched = await writer.projectControlResult({
    rootSessionId: 'world-ute2',
    callId: 'call-ute2-projected',
    instanceId: 'member-1',
    outcome: 'succeeded',
  })
  assert.deepEqual(matched, { recorded: true, requestId: 'req-ute2-1' })

  const unmatched = await writer.projectControlResult({
    rootSessionId: 'world-ute2',
    callId: 'call-ute2-unknown',
    outcome: 'succeeded',
  })
  assert.deepEqual(unmatched, { recorded: false, reason: 'PROJECTION_UNMATCHED' })
  assert.equal(unmatched.requestId, undefined)

  const mismatched = await writer.projectControlResult({
    rootSessionId: 'world-ute2',
    callId: 'call-ute2-projected',
    outcome: 'failed',
  })
  assert.deepEqual(mismatched, { recorded: false, reason: 'PROJECTION_OUTCOME_MISMATCH' })
  assert.equal(mismatched.requestId, undefined)

  // Ambiguous triple (two executions for one call+root) is refused, not guessed.
  await writer.record(
    contractFact('exec-ute2-projected-b', {
      hostCallId: 'call-ute2-projected',
      controlRequestIds: ['req-ute2-2'],
    }),
  )
  const ambiguous = await writer.projectControlResult({
    rootSessionId: 'world-ute2',
    callId: 'call-ute2-projected',
    outcome: 'succeeded',
  })
  assert.deepEqual(ambiguous, { recorded: false, reason: 'PROJECTION_AMBIGUOUS' })
  assert.equal(ambiguous.requestId, undefined)

  // Two request legs are not a single requestId.
  await writer.record(contractFact('exec-ute2-projected-multi', {
    hostCallId: 'call-ute2-multi',
    controlRequestIds: ['req-a', 'req-b'],
  }))
  const multi = await writer.projectControlResult({
    rootSessionId: 'world-ute2',
    callId: 'call-ute2-multi',
    outcome: 'succeeded',
  })
  assert.deepEqual(multi, { recorded: false, reason: 'PROJECTION_AMBIGUOUS_REQUEST_LINK' })
  assert.equal(multi.requestId, undefined)

  // No control request leg: no requestId is invented.
  await writer.record(contractFact('exec-ute2-projected-free', {
    hostCallId: 'call-ute2-free',
    controlRequestIds: [],
  }))
  const free = await writer.projectControlResult({
    rootSessionId: 'world-ute2',
    callId: 'call-ute2-free',
    outcome: 'succeeded',
  })
  assert.deepEqual(free, { recorded: false, reason: 'PROJECTION_NO_CONTROL_REQUEST_LINK' })
  assert.equal(free.requestId, undefined)

  // An admitted-but-unsettled execution is not projected as a result.
  await writer.record(contractFact('exec-ute2-projected-open', {
    hostCallId: 'call-ute2-open',
    dispatch: 'not-started',
    bodyOutcome: 'unknown',
    effectEvidence: 'none-confirmed',
  }))
  const open = await writer.projectControlResult({
    rootSessionId: 'world-ute2',
    callId: 'call-ute2-open',
    outcome: 'unknown',
  })
  assert.deepEqual(open, { recorded: false, reason: 'PROJECTION_UNSETTLED' })
  assert.equal(open.requestId, undefined)
  console.log('UTE2-PROJECTION matched=true unmatched=PROJECTION_UNMATCHED mismatch=PROJECTION_OUTCOME_MISMATCH ambiguous=PROJECTION_AMBIGUOUS requestId-never-fabricated=true')
})

// ------------------------------------------------ durability: crash window

test('durable admission BEFORE dispatch: SIGKILL after recordAdmission returns still yields UNKNOWN, never absent/COMPLETED', async () => {
  const dir = freshDir('durable-admission')
  const executionId = 'exec-ute2-durable-admission'
  const script = `
const fs = await import('node:fs')
const s = await import(process.env.UTE2_MODULE_URL)
const a = await import(process.env.UTE2_ADAPTER_URL)
const store = s.createExecutionSettlementStore({ dir: process.env.UTE2_DATA_DIR })
const writer = a.createExecutionSettlementWriter(store)
const result = await writer.record({
  executionId: ${JSON.stringify(executionId)},
  rootSessionId: 'world-ute2',
  agentInstanceId: 'member-1',
  hostCallId: 'call-ute2-durable',
  controlRequestIds: [],
  dispatch: 'not-started',
  bodyOutcome: 'unknown',
  effectEvidence: 'none-confirmed',
  recordedAt: '2026-11-20T00:00:01.000Z',
})
fs.writeSync(1, 'ADMISSION-RETURNED recorded=' + String(result.recorded) + '\\n')
// The caller would dispatch here. Hard death BEFORE anything is dispatched.
process.kill(process.pid, 'SIGKILL')
`
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: {
      ...process.env,
      UTE2_MODULE_URL: MODULE_URL,
      UTE2_ADAPTER_URL: ADAPTER_URL,
      UTE2_DATA_DIR: dir,
    },
    encoding: 'utf8',
  })
  assert.equal(child.signal, 'SIGKILL', `the child must die by SIGKILL, saw signal=${String(child.signal)}`)
  assert.match(child.stdout, /ADMISSION-RETURNED recorded=true/, 'recordAdmission must have returned before the kill')

  // Cold reader: a fresh store over the same root (it reclaims the dead writer's
  // lock, which is the same evidence a restarting Host has).
  const cold = settlement.createExecutionSettlementStore({ dir })
  assert.equal(cold.writerLock.state, 'reclaimed')
  const coldWriter = adapter.createExecutionSettlementWriter(cold)
  const before = await coldWriter.read(executionId)
  assert.ok(before, 'the admission fact must not be absent after a hard kill')
  assert.equal(before.dispatch, 'not-started')
  assert.equal(before.bodyOutcome, 'unknown')
  assert.deepEqual(await coldWriter.listUnsettled('world-ute2'), [executionId], 'S1 completeness sees the gap')

  const recovered = cold.recoverUnsettled(T(5))
  assert.equal(recovered.length, 1)
  assert.equal(recovered[0].after, 'UNKNOWN')
  assert.equal(recovered[0].before, 'ADMITTED')
  const after = await coldWriter.read(executionId)
  assert.equal(after.bodyOutcome, 'unknown')
  assert.equal(after.dispatch, 'not-started')
  assert.ok(after.recovery, 'the recovered fact names how it was reconciled')
  assert.deepEqual(await coldWriter.listUnsettled('world-ute2'), [], 'after recovery the gap is closed by a fact')
  assert.deepEqual(await coldWriter.record(contractFact(executionId)), {
    recorded: false,
    reason: 'SETTLEMENT_CONFLICT',
  }, 'a recovered UNKNOWN is terminal and is never overwritten by a late success')
  console.log('UTE2-CRASH-WINDOW admission-returned=true sigkill=SIGKILL recovered=UNKNOWN never-absent=true never-completed=true')
})

// ------------------------------------------------------ fsync + writer lock

test('durability: the parent directory is fsync\'d AFTER the rename and BEFORE the call returns', () => {
  const dir = freshDir('fsync-order')
  const order = []
  const executionId = 'exec-ute2-fsync-order'
  const store = settlement.createExecutionSettlementStore({
    dir,
    durability: {
      fsyncDirectory(syncedDir) {
        assert.equal(syncedDir, dir)
        // The witness observes the ordering itself: by the time the directory is
        // fsync'd, the record is already published under its final name. (The
        // lock acquisition also fsyncs this directory, before any record exists.)
        const path = settlement.settlementRecordPath(dir, executionId)
        if (existsSync(path)) {
          const envelope = JSON.parse(readFileSync(path, 'utf8'))
          assert.equal(envelope.payload.identity.executionId, executionId)
          order.push(`fsync:${envelope.payload.state}`)
        }
      },
    },
  })
  order.length = 0 // the lock acquisition fsync'd the same directory

  store.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })
  assert.deepEqual(order, ['fsync:ADMITTED'])
  store.enterRunning({ executionId, observation: runningObservation(executionId), at: T(1) })
  store.settle({
    executionId,
    state: 'COMPLETED',
    observation: completedObservation(executionId),
    at: T(2),
    reason: 'body-returned',
  })
  assert.deepEqual(order, ['fsync:ADMITTED', 'fsync:RUNNING', 'fsync:COMPLETED'])

  // A directory-fsync failure is a NAMED refusal, never a silent success.
  const failingDir = freshDir('fsync-failure')
  let failDirectoryFsync = false
  const failing = settlement.createExecutionSettlementStore({
    dir: failingDir,
    durability: {
      fsyncDirectory() {
        // The lock acquisition also fsyncs; only the record writes must fail.
        if (failDirectoryFsync) throw new Error('injected directory fsync failure')
      },
    },
  })
  failDirectoryFsync = true
  const code = codeOf(() =>
    failing.recordAdmission({
      identity: identity('exec-ute2-fsync-failure'),
      admission: admission('exec-ute2-fsync-failure'),
      at: T(0),
    }),
  )
  assert.equal(code, 'SETTLEMENT_DIRECTORY_FSYNC_FAILED')
  console.log('UTE2-FSYNC order=rename,fsync,return states=ADMITTED,RUNNING,COMPLETED failure=SETTLEMENT_DIRECTORY_FSYNC_FAILED')
})

test('writer lock: one writer per root, a live foreign writer is refused, and an evicted lock stops writes', () => {
  const dir = freshDir('writer-lock')
  const holder = settlement.createExecutionSettlementStore({ dir })
  assert.equal(holder.writerLock.state, 'acquired')
  assert.equal(holder.writerLock.pid, process.pid)
  const lockText = JSON.parse(readFileSync(holder.writerLock.path, 'utf8'))
  assert.equal(lockText.pid, process.pid)
  assert.equal(typeof lockText.bootId, 'string')

  // A REAL second process must be refused by NAME (an in-process second store is
  // re-entrant by design; only another pid can prove exclusion).
  const child = runChild(`
const s = await import(process.env.UTE2_MODULE_URL)
try {
  s.createExecutionSettlementStore({ dir: process.env.UTE2_DATA_DIR })
  console.log('LOCK=acquired')
} catch (error) {
  console.log('LOCK=' + String(error && error.code ? error.code : error))
}
`.replace('process.env.UTE2_DATA_DIR', JSON.stringify(dir)))
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /LOCK=SETTLEMENT_WRITER_CONFLICT/, `a live foreign writer must be refused: ${child.stdout}`)

  // The holder can still write after the refused attempt.
  const executionId = 'exec-ute2-lock-holder'
  holder.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })
  assert.equal(holder.read(executionId).state, 'ADMITTED')

  // An evicted lock (someone removed the file) stops the writer instead of
  // letting it race a new owner.
  rmSync(holder.writerLock.path)
  const evicted = codeOf(() =>
    holder.enterRunning({ executionId, observation: runningObservation(executionId), at: T(1) }),
  )
  assert.equal(evicted, 'SETTLEMENT_WRITER_CONFLICT')
  console.log('UTE2-LOCK live-foreign=SETTLEMENT_WRITER_CONFLICT holder-still-writes=true evicted=SETTLEMENT_WRITER_CONFLICT')
})

test('writer lock: a demonstrably dead owner is reclaimed, with named evidence', () => {
  const dir = freshDir('writer-lock-reclaim')
  const child = runChild(`
const s = await import(process.env.UTE2_MODULE_URL)
s.createExecutionSettlementStore({ dir: process.env.UTE2_DATA_DIR })
console.log('LOCK=acquired')
`.replace('process.env.UTE2_DATA_DIR', JSON.stringify(dir)))
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /LOCK=acquired/)
  const deadPid = child.pid

  const store = settlement.createExecutionSettlementStore({ dir })
  assert.equal(store.writerLock.state, 'reclaimed')
  assert.equal(store.writerLock.previousPid, deadPid)
  assert.equal(typeof store.writerLock.previousBootId, 'string')

  // The reclaimed root is immediately writable (the restart path).
  const executionId = 'exec-ute2-reclaimed'
  store.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })
  assert.equal(store.read(executionId).state, 'ADMITTED')
  console.log(`UTE2-LOCK-RECLAIMED previousPid=${deadPid} state=reclaimed writable=true`)
})

// --------------------------------------------------------- negative controls

test('negative controls: every mutated behaviour turns its public-surface scenario RED', async () => {
  const workRoot = freshDir('mutants')

  // Positive half first: the scenarios are green on the real module, so a red
  // mutant cannot be explained by a scenario that fails for an unrelated reason.
  const scenarios = [...new Set(MUTANTS.map((mutant) => mutant.scenario))]
  for (const scenario of scenarios) {
    const result = await runScenarioOnReal(REPO_ROOT, scenario)
    console.log(`UTE2-CONTROL ${scenario} ${result.red ? 'UNEXPECTED-RED' : 'GREEN'} ${result.detail}`)
    assert.equal(result.red, false, `control scenario ${scenario} must be GREEN on the real module: ${result.detail}`)
  }
  assert.deepEqual(scenarios.sort(), Object.keys(SCENARIOS).sort(), 'every declared scenario is exercised')

  // Negative half: one mutation at a time.
  for (const mutant of MUTANTS) {
    const result = await runMutant(REPO_ROOT, mutant, workRoot)
    console.log(`UTE2-MUTANT ${result.id} ${result.red ? 'RED' : 'UNEXPECTED-GREEN'} ${result.detail}`)
    assert.equal(result.red, true, `mutant ${result.id} must turn its control RED (${result.description}): ${result.detail}`)
  }

  // The harness refuses a vacuous mutation (byte-identical source).
  await assert.rejects(
    () =>
      runMutant(
        REPO_ROOT,
        { id: 'noop-mutation', scenario: 'duplicate-conflict', description: 'no change', apply: (source) => source, expect: undefined },
        workRoot,
      ),
    /byte-identical|did not find its anchor/,
    'a mutation that changes nothing must not be accepted as a control',
  )

  console.log(`UTE2-MUTANTS total=${MUTANTS.length} red=${MUTANTS.length} scenarios=${scenarios.length}`)
})
