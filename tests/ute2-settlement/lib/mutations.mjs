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
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const MODULE_REL = join('packages', 'runtime', 'settlement', 'execution-settlement.ts')

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
 * Copy the real module, apply one mutation, import it, and run the scenario that
 * mutation is supposed to break. Returns the transcript record.
 */
export async function runMutant(repoRoot, mutant, workRoot) {
  const source = readFileSync(join(repoRoot, MODULE_REL), 'utf8')
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
  const file = join(dir, 'execution-settlement.ts')
  writeFileSync(file, mutated)
  const module = await import(`${pathToFileURL(file).href}?mutant=${encodeURIComponent(mutant.id)}`)
  const dataDir = join(dir, 'records')
  mkdirSync(dataDir, { recursive: true })
  const result = SCENARIOS[mutant.scenario](module, dataDir)
  return {
    id: mutant.id,
    scenario: mutant.scenario,
    description: mutant.description,
    red: result.red,
    detail: result.detail,
  }
}

/** Run a scenario against the REAL module (the positive half of the control). */
export async function runScenarioOnReal(repoRoot, scenario) {
  const module = await import(pathToFileURL(join(repoRoot, MODULE_REL)).href + '?real=1')
  const root = join(repoRoot, '.artifacts', 'tmp', 'ute2-settlement', 'scenarios')
  mkdirSync(root, { recursive: true })
  const dir = mkdtempSync(join(root, `${scenario}-`))
  return SCENARIOS[scenario](module, dir)
}
