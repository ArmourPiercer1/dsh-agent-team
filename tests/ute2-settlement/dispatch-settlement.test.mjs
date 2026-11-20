/**
 * dispatch-settlement.test.mjs — UTE-3 S1 dispatch wiring.
 *
 * Drives the durable execution-settlement store from a REAL definition call
 * chain (the frozen wrapper-shaped seam: `definition.execute(args, exec)`), with
 * no production mount and no host boot.
 *
 * WHAT IS PROVEN HERE (S1):
 *   - a durable admission is written and verified BEFORE the body is called
 *     (the ordering arm fails if it moves after dispatch);
 *   - the body's own result/error is returned unchanged (identity, no fields);
 *   - the observed outcome is the REAL one: allow/deny from the guard, completed/
 *     failed/unknown from the body, and an effect reference ONLY from an
 *     observer that supplies a witness id;
 *   - a hard SIGKILL mid-effect recovers to UNKNOWN with the missing-evidence
 *     list, and NO path (replay, late terminal write, projection) can report
 *     COMPLETED / PASS for it;
 *   - one wrapper is bound to one store, and the store's own lock refuses a
 *     second live writer process.
 *
 * WHAT IS NOT CLAIMED (S2): commit-before-model-visible-`tool/result`. See the
 * module header; no awaitable public seam exists, so this is not tested green
 * here.
 *
 * Run: node --test --test-reporter=spec tests/ute2-settlement/dispatch-settlement.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test, { after } from 'node:test'

import {
  DISPATCH_REL,
  MUTANTS,
  PROVENANCE,
  SCENARIOS,
  T,
  clocker,
  completedFact,
  execFor,
  optionsFor,
  runMutant,
  runScenarioOnReal,
} from './lib/dispatch-mutations.mjs'

const HERE = new URL('.', import.meta.url).pathname
const REPO_ROOT = resolve(HERE, '..', '..')
const SETTLEMENT_DIR = join(REPO_ROOT, 'packages', 'runtime', 'settlement')
const STORE_PATH = join(SETTLEMENT_DIR, 'execution-settlement.ts')
const ADAPTER_PATH = join(SETTLEMENT_DIR, 'writer-adapter.ts')
const DISPATCH_PATH = join(SETTLEMENT_DIR, 'dispatch-settlement.ts')
const TMP_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'ute3-dispatch', `${process.pid}-${Date.now()}`)
mkdirSync(TMP_ROOT, { recursive: true })
after(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true })
})

const settlement = await import(pathToFileURL(STORE_PATH).href)
const adapter = await import(pathToFileURL(ADAPTER_PATH).href)
const dispatch = await import(pathToFileURL(DISPATCH_PATH).href)
const STORE_URL = pathToFileURL(STORE_PATH).href
const ADAPTER_URL = pathToFileURL(ADAPTER_PATH).href
const DISPATCH_URL = pathToFileURL(DISPATCH_PATH).href

let dirCounter = 0
function freshDir(name) {
  dirCounter += 1
  const dir = join(TMP_ROOT, `${String(dirCounter).padStart(2, '0')}-${name}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function storeAt(name) {
  return settlement.createExecutionSettlementStore({ dir: freshDir(name) })
}

function writerAt(store) {
  return adapter.createExecutionSettlementWriter(store)
}

// ----------------------------------------------------- S1: ordering (the core)

test('durable admission is written BEFORE the body is called (the body sees ADMITTED+RUNNING), then the real terminal fact', async () => {
  const store = storeAt('ordering')
  const executionId = dispatch.dispatchExecutionId(PROVENANCE, 'call-ute3-happy')
  const calls = []
  let stateAtBody = 'body-never-ran'
  let unsettledAtBody = null
  let settlementAtBody = null
  const definition = {
    name: 'probe',
    description: 'a probe definition',
    parameters: Object.freeze({ type: 'object', properties: {} }),
    execute(args, exec) {
      calls.push({ args, callId: exec.callId })
      const record = store.read(executionId)
      stateAtBody = record?.state ?? 'absent'
      settlementAtBody = record
      const writer = writerAt(store)
      return writer.listUnsettled(PROVENANCE.rootSessionId).then((ids) => {
        unsettledAtBody = ids.slice()
        return { content: 'ok', echo: args }
      })
    },
  }
  const wrapped = dispatch.createSettlementObservingDefinition(
    definition,
    optionsFor(store, {
      observe: () => ({
        effectEvidence: 'observed',
        observedEffects: [{ kind: 'file-content', target: 'workspace/out.txt', evidenceId: 'witness-ute3-1' }],
      }),
    }),
  )
  const result = await wrapped.execute({ q: 1 }, execFor('call-ute3-happy'))
  assert.deepEqual(result, { content: 'ok', echo: { q: 1 } })
  assert.equal(stateAtBody, 'RUNNING', 'dispatch entry is durable before the body runs')
  assert.deepEqual(
    settlementAtBody.transitions.map((transition) => transition.to),
    ['ADMITTED', 'RUNNING'],
    'at the body\'s first line the admission AND the dispatch entry are durable',
  )
  assert.equal(settlementAtBody.transitions[0].to, 'ADMITTED', 'the admission is the FIRST durable transition')
  assert.deepEqual(unsettledAtBody, [executionId], 'S1 completeness sees the gap while the body runs')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].callId, 'call-ute3-happy')

  const record = store.read(executionId)
  assert.equal(record.state, 'COMPLETED')
  assert.deepEqual(record.transitions.map((transition) => transition.to), ['ADMITTED', 'RUNNING', 'COMPLETED'])
  assert.equal(record.admission.decision, 'allow')
  assert.deepEqual(record.observation.observedEffects, [
    { kind: 'file-content', target: 'workspace/out.txt', evidenceId: 'witness-ute3-1' },
  ])
  assert.equal(record.observation.effectEvidence, 'observed')
  assert.deepEqual(record.missingEvidence, [])

  // The frozen reader surface still answers over the transitions this wrapper drove.
  const writer = writerAt(store)
  const fact = await writer.read(executionId)
  assert.equal(fact.bodyOutcome, 'completed')
  assert.equal(fact.hostResult.isError, false)
  assert.deepEqual(fact.controlRequestIds, [])
  assert.deepEqual(await writer.listUnsettled(PROVENANCE.rootSessionId), [])

  console.log(
    `UTE3-ORDER stateAtBody=${stateAtBody} transitions=${record.transitions.map((t) => t.to).join(',')} observed=${record.observation.observedEffects.length} unsettledAtBody=${unsettledAtBody.length}`,
  )
})

test('the model-facing surface is the body\'s own: identity, deep equality, zero added fields, unchanged definition fields', async () => {
  const store = storeAt('byte-compatible')
  const value = Object.freeze({ content: 'the body value', meta: Object.freeze({ n: 1 }) })
  const render = () => 'rendered'
  const definition = {
    name: 'probe',
    description: 'description kept by reference',
    parameters: Object.freeze({ type: 'object' }),
    render,
    execute() {
      return value
    },
  }
  const wrapped = dispatch.createSettlementObservingDefinition(definition, optionsFor(store))
  assert.deepEqual(Object.keys(wrapped).sort(), Object.keys(definition).sort(), 'the wrapper adds no model-facing field')
  assert.equal(wrapped.name, definition.name)
  assert.equal(wrapped.description, definition.description)
  assert.ok(Object.is(wrapped.parameters, definition.parameters))
  assert.ok(Object.is(wrapped.render, render))

  const returned = await wrapped.execute({}, execFor('call-ute3-identity'))
  assert.ok(Object.is(returned, value), 'the exact body value must be returned by reference')
  assert.deepEqual(returned, { content: 'the body value', meta: { n: 1 } })
  assert.equal(returned.settlement, undefined)
  console.log('UTE3-RESULT identical=true added-fields=0 definition-fields=by-reference')
})

test('a thrown body settles FAILED (never RUNNING) and rethrows the SAME error by identity', async () => {
  const store = storeAt('thrown')
  const thrown = Object.assign(new Error('the body failed'), { code: 'PROBE_FAILED' })
  const wrapped = dispatch.createSettlementObservingDefinition(
    {
      name: 'probe',
      execute() {
        throw thrown
      },
    },
    optionsFor(store),
  )
  let caught
  try {
    await wrapped.execute({}, execFor('call-ute3-thrown'))
  } catch (error) {
    caught = error
  }
  assert.ok(Object.is(caught, thrown), 'the body error must be rethrown by identity')
  const record = store.list()[0]
  assert.equal(record.state, 'FAILED')
  assert.notEqual(record.state, 'RUNNING')
  assert.equal(record.terminalReason, 'body-threw')
  assert.equal(record.contractFact.hostResult.errorCode, 'PROBE_FAILED')
  console.log(`UTE3-FAIL state=${record.state} rethrown-identity=true errorCode=${record.contractFact.hostResult.errorCode}`)
})

test('an aborted body settles UNKNOWN with named missing evidence — never COMPLETED', async () => {
  const store = storeAt('aborted')
  const wrapped = dispatch.createSettlementObservingDefinition(
    {
      name: 'probe',
      execute() {
        const error = new Error('aborted')
        error.name = 'AbortError'
        throw error
      },
    },
    optionsFor(store),
  )
  await assert.rejects(() => wrapped.execute({}, execFor('call-ute3-aborted', { signal: { aborted: true } })))
  const record = store.list()[0]
  assert.equal(record.state, 'UNKNOWN')
  assert.notEqual(record.state, 'COMPLETED')
  assert.ok(record.missingEvidence.includes('terminal-observation'))
  assert.ok(record.missingEvidence.includes('host-result'))
  assert.equal(record.observation.effectEvidence, 'unknown')
  console.log(`UTE3-ABORT state=${record.state} reason=${record.terminalReason} missing=${record.missingEvidence.join('|')}`)
})

// ------------------------------------------------- admissions: allow and deny

test('a deny admission is durable, the body is NEVER entered, and the record settles REFUSED', async () => {
  const store = storeAt('deny')
  let bodyCalls = 0
  const wrapped = dispatch.createSettlementObservingDefinition(
    {
      name: 'probe',
      execute() {
        bodyCalls += 1
        return { content: 'must not happen' }
      },
    },
    optionsFor(store, {
      admission: () => ({
        decision: 'deny',
        decisionId: 'decision-ute3-deny',
        decisionDigest: 'cd'.repeat(32),
        decisionKind: 'team-tool-execute',
      }),
    }),
  )
  let code
  try {
    await wrapped.execute({}, execFor('call-ute3-deny'))
  } catch (error) {
    code = error.code
  }
  assert.equal(code, 'A5_SETTLEMENT_ADMISSION_DENIED')
  assert.equal(bodyCalls, 0, 'a denied call must never enter the body')
  const record = store.list()[0]
  assert.equal(record.state, 'REFUSED')
  assert.equal(record.admission.decision, 'deny')
  assert.equal(record.observation.dispatch, 'not-started')
  assert.equal(record.observation.effectEvidence, 'none-confirmed')
  assert.deepEqual(record.observation.observedEffects, [])
  console.log(`UTE3-DENY state=${record.state} decision=${record.admission.decision} body-invoked=false`)
})

test('a failed admission write fails CLOSED: the body is never called and the writer refusal is surfaced', async () => {
  const real = storeAt('admission-failure')
  let bodyCalls = 0
  const failing = {
    ...real,
    recordAdmission() {
      const error = new Error('the writer lock was lost')
      error.code = 'SETTLEMENT_WRITER_CONFLICT'
      throw error
    },
  }
  const wrapped = dispatch.createSettlementObservingDefinition(
    {
      name: 'probe',
      execute() {
        bodyCalls += 1
        return { content: 'must not happen' }
      },
    },
    optionsFor(failing),
  )
  let code
  try {
    await wrapped.execute({}, execFor('call-ute3-admission-failure'))
  } catch (error) {
    code = error.code
  }
  assert.equal(code, 'SETTLEMENT_WRITER_CONFLICT')
  assert.equal(bodyCalls, 0)
  assert.deepEqual(real.list(), [], 'no record may be written when the admission could not be made durable')
  console.log(`UTE3-FAILCLOSED code=${code} body-invoked=false records=${real.list().length}`)
})

// -------------------------------------- effect honesty / fabricated observation

test('no observer = nothing observed (never an invented effect), and a malformed observed claim is REFUSED, named, and cannot change the result', async () => {
  const store = storeAt('observation')
  const value = Object.freeze({ content: 'ok' })
  const errors = []
  const wrapped = dispatch.createSettlementObservingDefinition(
    { name: 'probe', execute: () => value },
    optionsFor(store, {
      // Claims an observed effect with NO observation list: the claim must be refused.
      observe: () => ({ effectEvidence: 'observed', observedEffects: [] }),
      onSettlementError: (error, context) => errors.push({ code: error.code, phase: context.phase }),
    }),
  )
  const returned = await wrapped.execute({}, execFor('call-ute3-observe'))
  assert.ok(Object.is(returned, value), 'a refused observation claim must not change the tool result')
  const record = store.list()[0]
  assert.equal(record.state, 'COMPLETED', 'the real body outcome is still recorded truthfully')
  assert.equal(record.observation.effectEvidence, 'none-confirmed')
  assert.deepEqual(record.observation.observedEffects, [])
  assert.equal(errors.length, 1)
  assert.equal(errors[0].code, 'EFFECT_CLAIM_WITHOUT_OBSERVATION')
  assert.equal(errors[0].phase, 'observation')

  // A blank witness id is not an observation either.
  const store2 = storeAt('observation-blank')
  const errors2 = []
  const wrapped2 = dispatch.createSettlementObservingDefinition(
    { name: 'probe', execute: () => value },
    optionsFor(store2, {
      observe: () => ({
        effectEvidence: 'observed',
        observedEffects: [{ kind: 'file-content', target: 'x', evidenceId: '' }],
      }),
      onSettlementError: (error) => errors2.push(error.code),
    }),
  )
  await wrapped2.execute({}, execFor('call-ute3-observe-blank'))
  assert.deepEqual(errors2, ['A5_SETTLEMENT_OBSERVATION_REFUSED'])
  assert.equal(store2.list()[0].observation.effectEvidence, 'none-confirmed')

  // And with no observer at all, no effect is ever claimed.
  const store3 = storeAt('observation-none')
  const wrapped3 = dispatch.createSettlementObservingDefinition(
    { name: 'probe', execute: () => value },
    optionsFor(store3),
  )
  await wrapped3.execute({}, execFor('call-ute3-observe-none'))
  assert.equal(store3.list()[0].observation.effectEvidence, 'none-confirmed')
  assert.equal(store3.list()[0].observation.observedEffects.length, 0)

  console.log(
    `UTE3-OBSERVE invented=0 refused=${errors[0].code} blank-witness=A5_SETTLEMENT_OBSERVATION_REFUSED result-identical=true`,
  )
})

// ------------------------------------------------ SIGKILL crash window (real)

test('SIGKILL mid-effect: recovery yields UNKNOWN with missing evidence, and NO path can report COMPLETED/PASS for it', async () => {
  const dir = freshDir('sigkill')
  const effectPath = join(dir, 'effect.txt')
  const callId = 'call-ute3-sigkill'
  const executionId = dispatch.dispatchExecutionId(PROVENANCE, callId)
  const childScript = `
const fs = await import('node:fs')
const s = await import(process.env.UTE3_STORE_URL)
const d = await import(process.env.UTE3_DISPATCH_URL)
const store = s.createExecutionSettlementStore({ dir: process.env.UTE3_DATA_DIR })
let n = 0
const wrapped = d.createSettlementObservingDefinition(
  {
    name: 'probe',
    async execute() {
      fs.writeFileSync(process.env.UTE3_EFFECT_PATH, 'the effect happened')
      process.kill(process.pid, 'SIGKILL')
      return 'unreachable'
    },
  },
  {
    store,
    provenance: ${JSON.stringify(PROVENANCE)},
    admission: () => ({ decision: 'allow', decisionId: 'decision-ute3-sigkill', decisionDigest: '${'ab'.repeat(32)}', decisionKind: 'team-tool-execute' }),
    clock: () => new Date(Date.parse('2026-11-20T00:00:00.000Z') + (n++) * 1000).toISOString(),
  },
)
fs.writeSync(1, 'DISPATCHING\\n')
await wrapped.execute({}, { callId: ${JSON.stringify(callId)}, signal: { aborted: false } })
`
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', childScript], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      UTE3_STORE_URL: STORE_URL,
      UTE3_DISPATCH_URL: DISPATCH_URL,
      UTE3_DATA_DIR: dir,
      UTE3_EFFECT_PATH: effectPath,
    },
  })
  assert.equal(child.error, undefined, `the SIGKILL child could not start: ${String(child.error)}`)
  assert.match(child.stdout, /DISPATCHING/, `the child must reach dispatch: stdout=${child.stdout} stderr=${child.stderr}`)
  assert.equal(child.signal, 'SIGKILL', `expected a hard SIGKILL death, saw signal=${String(child.signal)} status=${String(child.status)} stderr=${child.stderr}`)
  assert.equal(child.status, null)
  assert.equal(readFileSync(effectPath, 'utf8'), 'the effect happened', 'the body really produced its effect before the kill')

  // Cold reader over the same root: the writer process is gone.
  const cold = settlement.createExecutionSettlementStore({ dir })
  assert.equal(cold.writerLock.state, 'reclaimed')
  const before = cold.read(executionId)
  assert.ok(before, 'the durable admission/intent must not be absent after a hard kill')
  assert.equal(before.state, 'RUNNING', 'the durable record survived the hard death mid-effect')

  const recovered = cold.recoverUnsettled(T(20))
  assert.equal(recovered.length, 1)
  assert.equal(recovered[0].before, 'RUNNING')
  assert.equal(recovered[0].after, 'UNKNOWN')
  const record = cold.read(executionId)
  assert.equal(record.state, 'UNKNOWN')
  assert.notEqual(record.state, 'COMPLETED')
  assert.notEqual(record.state, 'REFUSED')
  assert.equal(record.terminalReason, 'PROCESS_TERMINATED_WITHOUT_OUTCOME')
  assert.ok(record.missingEvidence.length > 0, 'UNKNOWN must name the missing evidence')
  assert.ok(record.missingEvidence.includes('terminal-observation'))
  assert.ok(record.missingEvidence.includes('host-result'))
  assert.ok(record.missingEvidence.includes('backend-receipt'))
  assert.equal(record.observation.effectEvidence, 'unknown', 'unknown is not "no effect"')

  // NO PATH REPORTS COMPLETED/PASS FOR IT.
  const coldWriter = adapter.createExecutionSettlementWriter(cold)
  const asFact = await coldWriter.read(executionId)
  assert.equal(asFact.bodyOutcome, 'unknown')
  assert.ok(asFact.recovery, 'the recovered fact names how it was reconciled')
  assert.deepEqual(await coldWriter.record(completedFact(executionId, { hostCallId: callId })), {
    recorded: false,
    reason: 'SETTLEMENT_CONFLICT',
  })
  const projection = await coldWriter.projectControlResult({
    rootSessionId: PROVENANCE.rootSessionId,
    callId,
    outcome: 'succeeded',
  })
  assert.equal(projection.recorded, false)
  assert.equal(projection.requestId, undefined, 'a projection may never fabricate a PASS/requestId')
  assert.ok(cold.list().every((item) => item.state !== 'COMPLETED'))

  // Replay through the real wrapper: refused, body never entered a second time.
  let replayBodyCalls = 0
  const replay = dispatch.createSettlementObservingDefinition(
    {
      name: 'probe',
      execute() {
        replayBodyCalls += 1
        return { content: 'replayed' }
      },
    },
    optionsFor(cold, {
      admission: () => ({
        decision: 'allow',
        decisionId: 'decision-ute3-sigkill',
        decisionDigest: 'ab'.repeat(32),
        decisionKind: 'team-tool-execute',
      }),
    }),
  )
  let replayCode
  try {
    await replay.execute({}, execFor(callId))
  } catch (error) {
    replayCode = error.code
  }
  assert.equal(replayCode, 'A5_SETTLEMENT_REPLAY_REFUSED')
  assert.equal(replayBodyCalls, 0)
  assert.equal(cold.read(executionId).state, 'UNKNOWN')

  console.log(
    `UTE3-CRASH-WINDOW signal=SIGKILL effect-written=true durable=RUNNING recovered=${record.state} missing=${record.missingEvidence.join('|')} late-terminal=SETTLEMENT_CONFLICT projection=PASS-refused replay=A5_SETTLEMENT_REPLAY_REFUSED never-COMPLETED=true`,
  )
})

// ---------------------------------------------------- single writer / one store

test('one wrapper is bound to ONE store, and the store lock refuses a second live writer process', () => {
  const storeA = storeAt('bound-a')
  const storeB = storeAt('bound-b')
  const options = optionsFor(storeA)
  const wrapped = dispatch.createSettlementObservingDefinition(
    { name: 'probe', execute: () => ({ content: 'ok' }) },
    options,
  )
  // The caller cannot move the settlement to a second store after construction.
  options.store = storeB
  return wrapped.execute({}, execFor('call-ute3-bound')).then(() => {
    assert.equal(storeA.list().length, 1)
    assert.equal(storeB.list().length, 0)

    // A REAL second process is refused by the store's own lock (not promised away).
    const script = `
const s = await import(process.env.UTE3_STORE_URL)
try {
  s.createExecutionSettlementStore({ dir: process.env.UTE3_DATA_DIR })
  console.log('LOCK=acquired')
} catch (error) {
  console.log('LOCK=' + String(error && error.code ? error.code : error))
}
`
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, UTE3_STORE_URL: STORE_URL, UTE3_DATA_DIR: storeA.dir },
      encoding: 'utf8',
    })
    assert.equal(child.status, 0, child.stderr)
    assert.match(child.stdout, /LOCK=SETTLEMENT_WRITER_CONFLICT/)
    console.log(
      `UTE3-SINGLE-WRITER bound-store=A second-store-empty=true cross-process=SETTLEMENT_WRITER_CONFLICT reentrant-in-process=true`,
    )
  })
})

// ------------------------------------------------------------ off by default

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue
    const path = join(dir, name)
    const info = statSync(path)
    if (info.isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

test('off by default: no production path imports or registers the dispatch wrapper', () => {
  const references = []
  for (const path of walk(join(REPO_ROOT, 'packages'), [])) {
    if (!/\.(ts|mts|js|mjs|cjs)$/.test(path)) continue
    const text = readFileSync(path, 'utf8')
    if (text.includes('dispatch-settlement')) references.push(path.slice(REPO_ROOT.length + 1))
  }
  assert.deepEqual(references.sort(), [
    'packages/runtime/settlement/dispatch-settlement.ts',
    'packages/runtime/settlement/index.ts',
  ])
  // The seams that would mount it stay untouched by name.
  for (const path of [
    join(REPO_ROOT, 'packages', 'runtime', 'tool-dispatch', 'install.ts'),
    join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'mount.ts'),
    join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'),
  ]) {
    assert.equal(readFileSync(path, 'utf8').includes('createSettlementObservingDefinition'), false)
  }
  // No grant-shaped export: the wrapper records references, it never decides.
  const forbidden = /^(admit|allow|deny|grant|authorize|approve|permit|revoke|decide)/i
  const offenders = Object.entries(dispatch)
    .filter(([name, value]) => typeof value === 'function' && forbidden.test(name))
    .map(([name]) => name)
  assert.deepEqual(offenders, [])
  console.log(`UTE3-NOT-WIRED production-imports=0 references=${references.length} grant-shaped=0`)
})

// ------------------------------------------------------------ mutation controls

test('negative controls: each mutation turns exactly its public-surface scenario RED', async () => {
  const seen = []
  for (const mutant of MUTANTS) {
    const real = await runScenarioOnReal(REPO_ROOT, mutant.scenario, TMP_ROOT)
    console.log(`UTE3-CONTROL ${mutant.scenario} ${real.red ? 'UNEXPECTED-RED' : 'GREEN'} ${real.detail}`)
    assert.equal(real.red, false, `the real module must be GREEN for ${mutant.scenario}: ${real.detail}`)
    const mutated = await runMutant(REPO_ROOT, mutant, TMP_ROOT)
    console.log(`UTE3-MUTANT ${mutated.id} ${mutated.red ? 'RED' : 'UNEXPECTED-GREEN'} ${mutated.detail}`)
    assert.equal(mutated.red, true, `mutant ${mutant.id} must turn ${mutant.scenario} RED: ${mutated.detail}`)
    seen.push(mutated.id)
  }
  assert.deepEqual(seen.sort(), [
    'admission-after-dispatch',
    'change-tool-result',
    'fabricate-effect',
    're-read-store-at-call-time',
    'replay-returns-fabricated',
  ])
  console.log(`UTE3-MUTANTS total=${MUTANTS.length} red=${MUTANTS.length} scenarios=${new Set(MUTANTS.map((m) => m.scenario)).size}`)
})

// The scenario table is exported so the mutation harness and this suite cannot
// drift apart; assert every mutant names a real scenario.
test('control wiring: every mutant targets a declared scenario', () => {
  for (const mutant of MUTANTS) {
    assert.equal(typeof SCENARIOS[mutant.scenario], 'function', `missing scenario ${mutant.scenario}`)
  }
  assert.ok(DISPATCH_REL.endsWith(join('settlement', 'dispatch-settlement.ts')))
  assert.equal(typeof clocker, 'function')
})
