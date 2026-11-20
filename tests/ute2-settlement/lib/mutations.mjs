/**
 * mutations.mjs — the negative-control half of the UTE-2 settlement suite.
 *
 * Each MUTANT removes exactly ONE behaviour from
 * `packages/runtime/settlement/execution-settlement.ts` (by textual replacement,
 * so the transcript names the line that was changed). Each SCENARIO exercises
 * the behaviour through the module's PUBLIC surface only. A control is honest
 * only when it is GREEN on the real module and RED on the mutant — so the suite
 * runs every scenario BOTH ways and prints the transcript.
 *
 * The recovery mutant does not spawn a real SIGKILL child (that is done once,
 * for real, by the main suite). It reconstructs the same post-crash state
 * through the controlled seam the store already has: the store is stateless, so
 * a SECOND store instance over the same directory is exactly what a cold reader
 * sees after the writer's process died.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const MODULE_REL = join('packages', 'runtime', 'settlement', 'execution-settlement.ts')
export const ADAPTER_REL = join('packages', 'runtime', 'settlement', 'writer-adapter.ts')

const T0 = '2026-11-20T00:00:00.000Z'
/** ISO timestamp `seconds` after the shared origin. */
export function T(seconds) {
  return new Date(Date.parse(T0) + seconds * 1000).toISOString()
}

export function identity(executionId, overrides = {}) {
  return {
    executionId,
    toolName: 'bash',
    actorId: 'member-1',
    worldId: 'world-ute2',
    ...overrides,
  }
}

export function admission(executionId, overrides = {}) {
  return {
    decisionId: `decision-${executionId}`,
    decisionDigest: 'ab'.repeat(32),
    decision: 'allow',
    decisionKind: 'team-tool-execute',
    subjectExecutionId: executionId,
    decidedAt: T0,
    ...overrides,
  }
}

export function admittedObservation(executionId) {
  return {
    executionId,
    dispatch: 'not-started',
    bodyOutcome: 'not-started',
    effectEvidence: 'none-confirmed',
    observedEffects: [],
  }
}

export function runningObservation(executionId) {
  return {
    executionId,
    dispatch: 'started',
    bodyOutcome: 'unknown',
    effectEvidence: 'possible',
    observedEffects: [],
  }
}

export function completedObservation(executionId, overrides = {}) {
  return {
    executionId,
    dispatch: 'quiesced',
    bodyOutcome: 'completed',
    effectEvidence: 'none-confirmed',
    observedEffects: [],
    ...overrides,
  }
}

export function effectObservation(executionId) {
  return completedObservation(executionId, {
    effectEvidence: 'observed',
    observedEffects: [
      { kind: 'file-content', target: 'workspace/out.txt', evidenceId: 'witness-ute2-1' },
    ],
  })
}

/** The contract fact fixture the adapter scenarios drive. */
export function adapterFact(executionId, overrides = {}) {
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

/** Run `fn`, returning the refusal code it threw (or null). */
export function codeOf(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error?.code ?? `UNEXPECTED:${error?.message ?? String(error)}`
  }
}

/** Open a record and move it to RUNNING; returns the store and execution id. */
export function openRunning(module, dir, executionId = 'exec-ute2-1') {
  const store = module.createExecutionSettlementStore({ dir })
  store.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })
  store.enterRunning({ executionId, observation: runningObservation(executionId), at: T(1) })
  return { store, executionId }
}

// ---------------------------------------------------------------- scenarios
//
// A scenario returns `{ red, detail }`. `red: true` means the REQUIRED behaviour
// was absent (the mutant broke it). The real module must return `red: false`.

export const SCENARIOS = {
  'duplicate-conflict': (module, dir) => {
    const { store, executionId } = openRunning(module, dir)
    store.settle({
      executionId,
      state: 'COMPLETED',
      at: T(2),
      reason: 'body-returned',
      observation: completedObservation(executionId),
    })
    const code = codeOf(() =>
      store.settle({
        executionId,
        state: 'FAILED',
        at: T(3),
        reason: 'a-second-answer',
        observation: completedObservation(executionId, { bodyOutcome: 'failed' }),
      }),
    )
    return {
      red: code !== 'SETTLEMENT_CONFLICT',
      detail: `conflicting second settle -> ${code ?? 'accepted (last-writer-wins)'}`,
    }
  },

  'illegal-transition': (module, dir) => {
    const { store, executionId } = openRunning(module, dir)
    store.settle({
      executionId,
      state: 'COMPLETED',
      at: T(2),
      reason: 'body-returned',
      observation: completedObservation(executionId),
    })
    const code = codeOf(() =>
      store.enterRunning({ executionId, observation: runningObservation(executionId), at: T(3) }),
    )
    let state
    try {
      state = store.read(executionId).state
    } catch (error) {
      // A mutant that wrote the illegal transition also writes a record whose
      // own transition log is invalid; the read refuses it. Either way the
      // required ILLEGAL_TRANSITION refusal was absent.
      state = `CORRUPT:${error?.code ?? String(error)}`
    }
    return {
      red: code !== 'ILLEGAL_TRANSITION' || state !== 'COMPLETED',
      detail: `COMPLETED -> RUNNING -> ${code ?? 'accepted'}; state now ${state}`,
    }
  },

  'recovery-unknown': (module, dir) => {
    const { executionId } = openRunning(module, dir, 'exec-ute2-crash')
    // The controlled seam: the writer's process is gone, so a fresh store is a
    // cold reader over the same directory.
    const cold = module.createExecutionSettlementStore({ dir })
    cold.recoverUnsettled(T(4))
    const recovered = cold.read(executionId)
    return {
      red: recovered.state !== 'UNKNOWN',
      detail: `recovered state -> ${recovered.state} (must be UNKNOWN, never COMPLETED/REFUSED)`,
    }
  },

  'effect-without-observation': (module, dir) => {
    const { store, executionId } = openRunning(module, dir)
    const code = codeOf(() =>
      store.settle({
        executionId,
        state: 'COMPLETED',
        at: T(2),
        reason: 'body-returned',
        observation: completedObservation(executionId, { effectEvidence: 'observed', observedEffects: [] }),
      }),
    )
    return {
      red: code !== 'EFFECT_CLAIM_WITHOUT_OBSERVATION',
      detail: `observed-effect claim with zero observations -> ${code ?? 'accepted'}`,
    }
  },

  'cross-wired': (module, dir) => {
    const store = module.createExecutionSettlementStore({ dir })
    const code = codeOf(() =>
      store.recordAdmission({
        identity: identity('exec-ute2-a'),
        admission: admission('exec-ute2-b'),
        at: T(0),
      }),
    )
    return {
      red: code !== 'SETTLEMENT_CROSS_WIRED',
      detail: `execution A carrying execution B's admission reference -> ${code ?? 'accepted'}`,
    }
  },

  'corrupt-record': (module, dir) => {
    const { store, executionId } = openRunning(module, dir, 'exec-ute2-corrupt')
    store.settle({
      executionId,
      state: 'COMPLETED',
      at: T(2),
      reason: 'body-returned',
      observation: completedObservation(executionId),
    })
    const path = module.settlementRecordPath(dir, executionId)
    const envelope = JSON.parse(readFileSync(path, 'utf8'))
    envelope.payload.observation.bodyOutcome = 'failed'
    writeFileSync(path, JSON.stringify(envelope))
    const code = codeOf(() => store.read(executionId))
    return {
      red: code !== 'SETTLEMENT_CORRUPT',
      detail: `checksum-mismatched record read -> ${code ?? 'read as complete'}`,
    }
  },

  'adapter-unsettled': async (module, dir, ctx) => {
    const store = module.createExecutionSettlementStore({ dir })
    const writer = ctx.adapter.createExecutionSettlementWriter(store)
    const executionId = 'exec-ute2-adapter-unsettled'
    const fact = adapterFact(executionId, {
      dispatch: 'not-started',
      bodyOutcome: 'unknown',
      effectEvidence: 'none-confirmed',
    })
    const first = await writer.record(fact)
    const unsettled = await writer.listUnsettled('world-ute2')
    const foreignRoot = await writer.listUnsettled('world-someone-else')
    const second = await writer.record({ ...fact, dispatch: 'quiesced', bodyOutcome: 'completed', effectEvidence: 'observed', recordedAt: T(3) })
    const after = await writer.listUnsettled('world-ute2')
    const cold = module.createExecutionSettlementStore({ dir })
    const coldWriter = ctx.adapter.createExecutionSettlementWriter(cold)
    const coldFact = await coldWriter.read(executionId)
    const red = !(
      first.recorded === true &&
      unsettled.includes(executionId) &&
      foreignRoot.length === 0 &&
      second.recorded === true &&
      after.length === 0 &&
      coldFact?.bodyOutcome === 'completed'
    )
    return {
      red,
      detail: `record=${String(first.recorded)} unsettled=${JSON.stringify(unsettled)} otherRoot=${foreignRoot.length} settled=${String(second.recorded)} after=${after.length} cold=${String(coldFact?.bodyOutcome)}`,
    }
  },

  'adapter-duplicate': async (module, dir, ctx) => {
    const store = module.createExecutionSettlementStore({ dir })
    const writer = ctx.adapter.createExecutionSettlementWriter(store)
    const executionId = 'exec-ute2-adapter-duplicate'
    const fact = adapterFact(executionId)
    const first = await writer.record(fact)
    const second = await writer.record({ ...fact, recordedAt: T(9) })
    const conflict = await writer.record({ ...fact, bodyOutcome: 'failed', recordedAt: T(10) })
    const red = !(
      first.recorded === true &&
      second.recorded === false &&
      second.reason === 'DUPLICATE_SETTLEMENT' &&
      conflict.recorded === false &&
      conflict.reason === 'SETTLEMENT_CONFLICT'
    )
    return {
      red,
      detail: `first=${String(first.recorded)} second=${String(second.recorded)}/${String(second.reason)} conflict=${String(conflict.recorded)}/${String(conflict.reason)}`,
    }
  },

  'projection-fabricate': async (module, dir, ctx) => {
    const store = module.createExecutionSettlementStore({ dir })
    const writer = ctx.adapter.createExecutionSettlementWriter(store)
    await writer.record(adapterFact('exec-ute2-projection-a', { hostCallId: 'call-ute2-ambiguous' }))
    await writer.record(
      adapterFact('exec-ute2-projection-b', {
        hostCallId: 'call-ute2-ambiguous',
        controlRequestIds: ['req-ute2-2'],
      }),
    )
    const ambiguous = await writer.projectControlResult({
      rootSessionId: 'world-ute2',
      callId: 'call-ute2-ambiguous',
      outcome: 'succeeded',
    })
    const red = !(ambiguous.recorded === false && ambiguous.requestId === undefined)
    return {
      red,
      detail: `ambiguous projection -> recorded=${String(ambiguous.recorded)} requestId=${String(ambiguous.requestId)} reason=${String(ambiguous.reason)}`,
    }
  },

  'projection-outcome-mismatch': async (module, dir, ctx) => {
    const store = module.createExecutionSettlementStore({ dir })
    const writer = ctx.adapter.createExecutionSettlementWriter(store)
    await writer.record(adapterFact('exec-ute2-projection-c', { hostCallId: 'call-ute2-mismatch' }))
    const matched = await writer.projectControlResult({
      rootSessionId: 'world-ute2',
      callId: 'call-ute2-mismatch',
      outcome: 'succeeded',
    })
    const mismatched = await writer.projectControlResult({
      rootSessionId: 'world-ute2',
      callId: 'call-ute2-mismatch',
      outcome: 'failed',
    })
    const red = !(
      matched.recorded === true &&
      matched.requestId === 'req-ute2-1' &&
      mismatched.recorded === false &&
      mismatched.requestId === undefined
    )
    return {
      red,
      detail: `matched=${String(matched.recorded)}/${String(matched.requestId)} mismatched=${String(mismatched.recorded)}/${String(mismatched.reason)}`,
    }
  },

  'adapter-cross-wire': async (module, dir, ctx) => {
    const store = module.createExecutionSettlementStore({ dir })
    const executionId = 'exec-ute2-adapter-cross-wired'
    store.recordAdmission({
      identity: identity(executionId, { worldId: 'world-alpha', actorId: 'member-alpha' }),
      admission: admission(executionId),
      at: T(0),
    })
    const writer = ctx.adapter.createExecutionSettlementWriter(store)
    const result = await writer.record(
      adapterFact(executionId, {
        rootSessionId: 'world-beta',
        agentInstanceId: 'member-beta',
        dispatch: 'not-started',
        bodyOutcome: 'unknown',
        effectEvidence: 'none-confirmed',
      }),
    )
    const red = !(result.recorded === false && result.reason === 'SETTLEMENT_CROSS_WIRED')
    return {
      red,
      detail: `foreign-root fact -> ${String(result.recorded)}/${String(result.reason)}`,
    }
  },

  'writer-lock-conflict': (module, dir, ctx) => {
    const parent = module.createExecutionSettlementStore({ dir })
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', CHILD_ACQUIRE_SCRIPT], {
      env: { ...process.env, UTE2_MODULE_URL: ctx.settlementUrl, UTE2_DATA_DIR: dir },
      encoding: 'utf8',
    })
    const stdout = child.stdout ?? ''
    const conflict = stdout.includes('LOCK=SETTLEMENT_WRITER_CONFLICT')
    const red = !(conflict && child.status === 0)
    return {
      red,
      detail: `second process while ${parent.writerLock.state} holder alive -> ${stdout.trim() || `<no stdout, status ${child.status}>`}`,
    }
  },

  'writer-lock-reclaim': (module, dir, ctx) => {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', CHILD_ACQUIRE_SCRIPT], {
      env: { ...process.env, UTE2_MODULE_URL: ctx.settlementUrl, UTE2_DATA_DIR: join(dir, 'child-root') },
      encoding: 'utf8',
    })
    const childRoot = join(dir, 'child-root')
    const childPid = child.pid
    let parent
    try {
      parent = module.createExecutionSettlementStore({ dir: childRoot })
    } catch (error) {
      return {
        red: true,
        detail: `stale lock of dead pid ${String(childPid)} -> ${error?.code ?? error?.message ?? String(error)} (not reclaimed)`,
      }
    }
    const reclaimed = parent.writerLock.state === 'reclaimed' && parent.writerLock.previousPid === childPid
    return {
      red: !reclaimed,
      detail: `stale lock of dead pid ${String(childPid)} -> ${parent.writerLock.state} previousPid=${String(parent.writerLock.previousPid)}`,
    }
  },

  'directory-fsync': (module, dir) => {
    let calls = 0
    let sawPublishedRecord = false
    const store = module.createExecutionSettlementStore({
      dir,
      durability: {
        fsyncDirectory() {
          calls += 1
          sawPublishedRecord = true
        },
      },
    })
    calls = 0
    const executionId = 'exec-ute2-fsync'
    store.recordAdmission({ identity: identity(executionId), admission: admission(executionId), at: T(0) })
    const red = !(calls === 1 && sawPublishedRecord)
    return {
      red,
      detail: `recordAdmission durable-before-return -> directory fsync calls=${calls}`,
    }
  },

  'authority-surface': (module) => {
    const forbidden = /^(admit|allow|deny|grant|authorize|approve|permit|revoke|decide)/i
    const offenders = Object.entries(module)
      .filter(([name, value]) => typeof value === 'function' && forbidden.test(name))
      .map(([name]) => name)
    return {
      red: offenders.length > 0,
      detail: offenders.length > 0 ? `grant-shaped export(s): ${offenders.join(', ')}` : 'no grant-shaped export',
    }
  },
}

// --------------------------------------------------------------- child helpers
//
// The lock controls need a REAL second process: an in-process second store is
// re-entrant by design (cold readers), so only another pid can prove exclusion.

export const CHILD_ACQUIRE_SCRIPT = `
const url = process.env.UTE2_MODULE_URL
const dir = process.env.UTE2_DATA_DIR
const module = await import(url)
try {
  module.createExecutionSettlementStore({ dir })
  console.log('LOCK=acquired')
} catch (error) {
  console.log('LOCK=' + String(error && error.code ? error.code : error))
}
`

/** Spawn a real child that imports the module under test from `url`. */
export function runChild(script, url, dir, extraEnv = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, UTE2_MODULE_URL: url, UTE2_DATA_DIR: dir, ...extraEnv },
    encoding: 'utf8',
  })
}

// ------------------------------------------------------------------ mutants
//
// `apply(source)` must produce a syntactically valid module. If a replacement
// is not found the harness fails loudly (a silently-unapplied mutation would be
// a green control that tests nothing).

export const MUTANTS = [
  {
    id: 'conflict-becomes-last-writer-wins',
    scenario: 'duplicate-conflict',
    description: 'treat ANY second terminal write as a duplicate no-op instead of refusing conflicting facts',
    apply(source) {
      return source.replace(
        'if (lastDigest === factsDigest) {',
        'if (true) {',
      )
    },
    expect: 'if (lastDigest === factsDigest) {',
  },
  {
    id: 'illegal-transition-allowed',
    scenario: 'illegal-transition',
    description: 'drop the transition guard so a terminal record can re-enter RUNNING',
    apply(source) {
      return source.replace('if (!allowed.includes(to)) {', 'if (false) {')
    },
    expect: 'if (!allowed.includes(to)) {',
  },
  {
    id: 'fabricate-completed-on-recovery',
    scenario: 'recovery-unknown',
    description: 'let recovery write COMPLETED (the fabricated-success failure mode)',
    apply(source) {
      return source
        .replace(
          "const RECOVERY_TERMINAL_STATE: SettlementState = 'UNKNOWN'",
          "const RECOVERY_TERMINAL_STATE: SettlementState = 'COMPLETED'",
        )
        .replace(
          "const RECOVERY_BODY_OUTCOME: BodyOutcome = 'unknown'",
          "const RECOVERY_BODY_OUTCOME: BodyOutcome = 'completed'",
        )
        .replace(
          "const RECOVERY_EFFECT_EVIDENCE: EffectEvidence = 'unknown'",
          "const RECOVERY_EFFECT_EVIDENCE: EffectEvidence = 'none-confirmed'",
        )
        .replace(
          '    reason: UNKNOWN_RECOVERY_REASON,\n    missingEvidence,',
          '    reason: UNKNOWN_RECOVERY_REASON,\n    missingEvidence: [],',
        )
    },
    expect: "const RECOVERY_TERMINAL_STATE: SettlementState = 'UNKNOWN'",
  },
  {
    id: 'trust-effect-claim',
    scenario: 'effect-without-observation',
    description: 'accept effectEvidence=observed with an empty observation list',
    apply(source) {
      return source.replace(
        "if (observation.effectEvidence === 'observed' && observed.length === 0) {",
        'if (false) {',
      )
    },
    expect: "if (observation.effectEvidence === 'observed' && observed.length === 0) {",
  },
  {
    id: 'ignore-execution-identity',
    scenario: 'cross-wired',
    description: 'stop checking that an admission reference belongs to the settlement ExecutionId',
    apply(source) {
      return source.replace('if (observed !== expected) {', 'if (false) {')
    },
    expect: 'if (observed !== expected) {',
  },
  {
    id: 'accept-bad-checksum',
    scenario: 'corrupt-record',
    description: 'skip the envelope checksum so a tampered/partial record reads as complete',
    apply(source) {
      return source.replace('if (checksum !== actual) {', 'if (false) {')
    },
    expect: 'if (checksum !== actual) {',
  },
  {
    id: 'adapter-duplicate-recorded-true',
    target: 'adapter',
    scenario: 'adapter-duplicate',
    description: 'answer a duplicate terminal fact with recorded:true instead of the named duplicate',
    apply(source) {
      return source.replace(
        "return { recorded: false, reason: 'DUPLICATE_SETTLEMENT' }",
        'return { recorded: true }',
      )
    },
    expect: "return { recorded: false, reason: 'DUPLICATE_SETTLEMENT' }",
  },
  {
    id: 'adapter-list-unsettled-empty',
    target: 'adapter',
    scenario: 'adapter-unsettled',
    description: 'make listUnsettled report no gaps (the S1 completeness surface goes dark)',
    apply(source) {
      return source.replace('&& !isTerminal(record.state)', '&& false')
    },
    expect: '&& !isTerminal(record.state)',
  },
  {
    id: 'adapter-fabricate-request-id',
    target: 'adapter',
    scenario: 'projection-fabricate',
    description: 'let an ambiguous triple project the first matching requestId',
    apply(source) {
      return source.replace(
        "if (matches.length > 1) return { recorded: false, reason: 'PROJECTION_AMBIGUOUS' }",
        'if (false) return { recorded: false, reason: \'PROJECTION_AMBIGUOUS\' }',
      )
    },
    expect: "if (matches.length > 1) return { recorded: false, reason: 'PROJECTION_AMBIGUOUS' }",
  },
  {
    id: 'adapter-accept-outcome-mismatch',
    target: 'adapter',
    scenario: 'projection-outcome-mismatch',
    description: 'project a settled fact even when the requested outcome disagrees',
    apply(source) {
      return source.replace('if (fact.bodyOutcome !== expectedOutcome) {', 'if (false) {')
    },
    expect: 'if (fact.bodyOutcome !== expectedOutcome) {',
  },
  {
    id: 'adapter-ignore-identity',
    target: 'adapter',
    scenario: 'adapter-cross-wire',
    description: 'accept a fact whose root/agent differs from the existing admission',
    apply(source) {
      return source.replace(
        /if \(\s*existing\.identity\.actorId !== frozen\.agentInstanceId \|\|[\s\S]*?\) \{/,
        'if (false) {',
      )
    },
    expect: 'existing.identity.actorId !== frozen.agentInstanceId',
  },
  {
    id: 'accept-live-foreign-writer',
    scenario: 'writer-lock-conflict',
    description: 'treat a live foreign writer lock as stale and steal the root',
    apply(source) {
      return source.replace('if (alive) {', 'if (false) {')
    },
    expect: 'if (alive) {',
  },
  {
    id: 'never-reclaim-dead-writer',
    scenario: 'writer-lock-reclaim',
    description: 'refuse to reclaim a lock whose owner is demonstrably dead',
    apply(source) {
      return source.replace(
        'const alive = previous.bootId === selfBoot && isProcessAlive(previous.pid)',
        'const alive = true',
      )
    },
    expect: 'const alive = previous.bootId === selfBoot && isProcessAlive(previous.pid)',
  },
  {
    id: 'skip-directory-fsync',
    scenario: 'directory-fsync',
    description: 'drop the parent-directory fsync so a write returns before it is durable',
    apply(source) {
      return source.replace('    syncDirectory(dir)\n  } catch (error) {', '    void syncDirectory\n  } catch (error) {')
    },
    expect: 'syncDirectory(dir)',
  },
  {
    id: 'expose-a-grant',
    scenario: 'authority-surface',
    description: 'add a grant-shaped export to the public module surface',
    apply(source) {
      return `${source}\nexport function grantExecution() {\n  return { granted: true }\n}\n`
    },
    expect: undefined,
  },
]

/**
 * Copy the module(s) under test, apply ONE mutation, import them, and run the
 * scenario that mutation is supposed to break. Returns the transcript record.
 */
export async function runMutant(repoRoot, mutant, workRoot) {
  const targetRel = mutant.target === 'adapter' ? ADAPTER_REL : MODULE_REL
  const source = readFileSync(join(repoRoot, targetRel), 'utf8')
  if (mutant.expect !== undefined && !source.includes(mutant.expect)) {
    throw new Error(
      `mutation ${mutant.id} did not find its anchor ${JSON.stringify(mutant.expect)} — the module changed and this control would be vacuous`,
    )
  }
  const mutated = mutant.apply(source)
  if (mutated === source) {
    throw new Error(`mutation ${mutant.id} produced byte-identical source — the control would be vacuous`)
  }
  const dir = join(workRoot, mutant.id)
  mkdirSync(dir, { recursive: true })
  // Both modules are copied so an adapter scenario still has a store; only the
  // targeted file carries the mutation.
  const settlementFile = join(dir, 'execution-settlement.ts')
  const adapterFile = join(dir, 'writer-adapter.ts')
  writeFileSync(settlementFile, mutant.target === 'adapter' ? readFileSync(join(repoRoot, MODULE_REL), 'utf8') : mutated)
  writeFileSync(adapterFile, mutant.target === 'adapter' ? mutated : readFileSync(join(repoRoot, ADAPTER_REL), 'utf8'))
  const settlementUrl = `${pathToFileURL(settlementFile).href}?mutant=${encodeURIComponent(mutant.id)}`
  const adapterUrl = `${pathToFileURL(adapterFile).href}?mutant=${encodeURIComponent(mutant.id)}`
  const module = await import(settlementUrl)
  const adapter = await import(adapterUrl)
  const dataDir = join(dir, 'records')
  mkdirSync(dataDir, { recursive: true })
  const result = await SCENARIOS[mutant.scenario](module, dataDir, { adapter, settlementUrl, adapterUrl })
  return {
    id: mutant.id,
    scenario: mutant.scenario,
    description: mutant.description,
    red: result.red,
    detail: result.detail,
  }
}

/** Run a scenario against the REAL modules (the positive half of the control). */
export async function runScenarioOnReal(repoRoot, scenario) {
  const settlementUrl = `${pathToFileURL(join(repoRoot, MODULE_REL)).href}?real=1`
  const adapterUrl = `${pathToFileURL(join(repoRoot, ADAPTER_REL)).href}?real=1`
  const module = await import(settlementUrl)
  const adapter = await import(adapterUrl)
  const root = join(repoRoot, '.artifacts', 'tmp', 'ute2-settlement', 'scenarios')
  mkdirSync(root, { recursive: true })
  const dir = mkdtempSync(join(root, `${scenario}-`))
  return SCENARIOS[scenario](module, dir, { adapter, settlementUrl, adapterUrl })
}
