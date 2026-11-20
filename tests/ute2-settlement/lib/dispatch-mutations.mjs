/**
 * dispatch-mutations.mjs — the negative-control half of the UTE-3 dispatch suite.
 *
 * Each MUTANT removes exactly ONE behaviour from
 * `packages/runtime/settlement/dispatch-settlement.ts` (textual replacement, so
 * the transcript names what changed). Each SCENARIO exercises the behaviour
 * through the wrapper's PUBLIC surface only. A control is honest only when it is
 * GREEN on the real module and RED on the mutant.
 *
 * The wrapper has NO runtime import from the store (only `node:crypto`), so a
 * mutant is a single copied file; the store and adapter are copied alongside it
 * unmutated so the scenario has a real durability backend.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DISPATCH_REL = join('packages', 'runtime', 'settlement', 'dispatch-settlement.ts')
export const STORE_REL = join('packages', 'runtime', 'settlement', 'execution-settlement.ts')
export const ADAPTER_REL = join('packages', 'runtime', 'settlement', 'writer-adapter.ts')

const T0 = '2026-11-20T00:00:00.000Z'

/** ISO timestamp `seconds` after the shared origin. */
export function T(seconds) {
  return new Date(Date.parse(T0) + seconds * 1000).toISOString()
}

export const PROVENANCE = Object.freeze({
  rootSessionId: 'world-ute3',
  agentInstanceId: 'member-1',
  toolName: 'probe',
})

export function execFor(callId, extra = {}) {
  return { callId, signal: { aborted: false }, agent: { id: 'member-1' }, ...extra }
}

export function allowAdmission(overrides = {}) {
  return {
    decision: 'allow',
    decisionId: 'decision-ute3-1',
    decisionDigest: 'ab'.repeat(32),
    decisionKind: 'team-tool-execute',
    ...overrides,
  }
}

/** A monotonic clock so transitions never regress. */
export function clocker() {
  let n = 0
  return () => T(n++)
}

/** Default options for a real dispatch (no observer = no effect is claimed). */
export function optionsFor(store, overrides = {}) {
  return {
    store,
    provenance: PROVENANCE,
    admission: () => allowAdmission(),
    clock: clocker(),
    ...overrides,
  }
}

/** The contract fact a fabricated "it completed" claim would carry. */
export function completedFact(executionId, overrides = {}) {
  return {
    executionId,
    rootSessionId: PROVENANCE.rootSessionId,
    agentInstanceId: PROVENANCE.agentInstanceId,
    hostCallId: 'call-ute3-control',
    controlRequestIds: [],
    dispatch: 'quiesced',
    bodyOutcome: 'completed',
    effectEvidence: 'none-confirmed',
    recordedAt: T(9),
    ...overrides,
  }
}

// ---------------------------------------------------------------- scenarios
// A scenario returns `{ red, detail }`; `red: true` means the REQUIRED
// behaviour was absent. The real module must return `red: false`.

export const SCENARIOS = {
  /**
   * (a) ADMISSION-BEFORE-DISPATCH. The body reads the record at its own first
   * line: the real wrapper must already have a durable ADMITTED record there.
   */
  ordering: async (ctx, dir) => {
    const store = ctx.settlement.createExecutionSettlementStore({ dir })
    let stateAtBody = 'body-never-ran'
    let admissionAtBody = 'body-never-ran'
    const executionId = ctx.dispatch.dispatchExecutionId(PROVENANCE, 'call-ute3-ordering')
    const definition = {
      name: 'probe',
      async execute() {
        const atBody = store.read(executionId)
        stateAtBody = atBody?.state ?? 'absent'
        admissionAtBody = atBody?.transitions?.[0]?.to ?? 'absent'
        return { content: 'ok' }
      },
    }
    const wrapped = ctx.dispatch.createSettlementObservingDefinition(
      definition,
      optionsFor(store),
    )
    try {
      await wrapped.execute({}, execFor('call-ute3-ordering'))
    } catch (error) {
      return {
        red: true,
        detail: `dispatch threw ${String(error?.code ?? error?.message ?? error)}; stateAtBody=${stateAtBody}`,
      }
    }
    const record = store.read(executionId)
    return {
      red: !(stateAtBody === 'RUNNING' && admissionAtBody === 'ADMITTED' && record?.state === 'COMPLETED'),
      detail: `stateAtBody=${stateAtBody} firstTransition=${admissionAtBody} final=${String(record?.state)}`,
    }
  },

  /**
   * (b) NO FABRICATED EFFECT. With no observer, a successful body has observed
   * NOTHING: the fact must say none-confirmed with an empty effect list.
   */
  'fabricated-effect': async (ctx, dir) => {
    const store = ctx.settlement.createExecutionSettlementStore({ dir })
    const wrapped = ctx.dispatch.createSettlementObservingDefinition(
      { name: 'probe', async execute() { return { content: 'ok' } } },
      optionsFor(store),
    )
    await wrapped.execute({}, execFor('call-ute3-fabricated'))
    const record = store.list()[0]
    const observed = record?.observation.observedEffects ?? []
    return {
      red: !(record?.observation.effectEvidence === 'none-confirmed' && observed.length === 0),
      detail: `effectEvidence=${String(record?.observation.effectEvidence)} observed=${observed.length} ids=${observed.map((e) => e.evidenceId).join('|')}`,
    }
  },

  /**
   * (c) RESULT IS THE BODY'S OWN VALUE. Identity, deep equality and zero added
   * fields on the model-facing surface.
   */
  'result-changed': async (ctx, dir) => {
    const store = ctx.settlement.createExecutionSettlementStore({ dir })
    const value = Object.freeze({ content: 'the body value', meta: Object.freeze({ n: 1 }) })
    const wrapped = ctx.dispatch.createSettlementObservingDefinition(
      { name: 'probe', async execute() { return value } },
      optionsFor(store),
    )
    const returned = await wrapped.execute({}, execFor('call-ute3-result'))
    const added = Object.keys(returned ?? {}).filter((key) => !(key in value))
    return {
      red: !(Object.is(returned, value) && added.length === 0),
      detail: `identical=${String(Object.is(returned, value))} addedFields=[${added.join(',')}]`,
    }
  },

  /**
   * (d) NO REPLAY OF A RECOVERED EXECUTION. A terminal record is never re-driven,
   * and the body is never entered a second time.
   */
  'replay-fabricated': async (ctx, dir) => {
    const store = ctx.settlement.createExecutionSettlementStore({ dir })
    const executionId = ctx.dispatch.dispatchExecutionId(PROVENANCE, 'call-ute3-replay')
    const exec = execFor('call-ute3-replay')
    // The cold state a recovery leaves behind: ADMITTED -> RUNNING, no terminal.
    store.recordAdmission({
      identity: { executionId, toolName: 'probe', actorId: PROVENANCE.agentInstanceId, worldId: PROVENANCE.rootSessionId },
      admission: {
        decisionId: 'decision-ute3-1',
        decisionDigest: 'ab'.repeat(32),
        decision: 'allow',
        decisionKind: 'team-tool-execute',
        subjectExecutionId: executionId,
      },
      at: T(0),
    })
    store.enterRunning({
      executionId,
      observation: {
        executionId,
        dispatch: 'started',
        bodyOutcome: 'unknown',
        effectEvidence: 'possible',
        observedEffects: [],
      },
      at: T(1),
    })
    // Recovery settles it UNKNOWN (what a cold boot does).
    store.recoverUnsettled(T(2))
    let bodyCalls = 0
    const wrapped = ctx.dispatch.createSettlementObservingDefinition(
      { name: 'probe', async execute() { bodyCalls += 1; return { content: 'a replay' } } },
      optionsFor(store),
    )
    let outcome
    try {
      outcome = { kind: 'returned', value: await wrapped.execute({}, exec) }
    } catch (error) {
      outcome = { kind: 'threw', code: error?.code ?? null }
    }
    const record = store.read(executionId)
    return {
      red: !(outcome.kind === 'threw' && outcome.code === 'A5_SETTLEMENT_REPLAY_REFUSED' && bodyCalls === 0 && record?.state === 'UNKNOWN'),
      detail: `outcome=${outcome.kind}/${String(outcome.code ?? outcome.value)} bodyCalls=${bodyCalls} state=${String(record?.state)}`,
    }
  },

  /**
   * (e) ONE STORE PER WRAPPER. Mutating the options object after construction
   * must not move the settlement to a second store.
   */
  'store-binding': async (ctx, dir) => {
    const storeA = ctx.settlement.createExecutionSettlementStore({ dir: join(dir, 'a') })
    const storeB = ctx.settlement.createExecutionSettlementStore({ dir: join(dir, 'b') })
    const options = optionsFor(storeA)
    const wrapped = ctx.dispatch.createSettlementObservingDefinition(
      { name: 'probe', async execute() { return { content: 'ok' } } },
      options,
    )
    // The caller mutates after construction; the captured binding must win.
    options.store = storeB
    await wrapped.execute({}, execFor('call-ute3-binding'))
    return {
      red: !(storeA.list().length === 1 && storeB.list().length === 0),
      detail: `storeA=${storeA.list().length} storeB=${storeB.list().length}`,
    }
  },
}

// ------------------------------------------------------------------ mutants
//
// `apply(source)` must produce a syntactically valid module. If an anchor is
// not found the harness fails loudly — a silently-unapplied mutation would be a
// green control that tests nothing.

export const MUTANTS = [
  {
    id: 'admission-after-dispatch',
    scenario: 'ordering',
    description: 'move the durable admission write AFTER the body call (S1 ordering broken)',
    expect: '    // ---- ORDERING ANCHOR (S1): durable intent BEFORE any body call ----------',
    apply(source) {
      const admission = '    writeAdmission(invocation)\n'
      const running = '    enterRunning(invocation)\n'
      const dispatch = '      value = await definition.execute(args, exec)\n'
      return source
        .replace('    // ---- ORDERING ANCHOR (S1): durable intent BEFORE any body call ----------\n' + admission, '')
        .replace(running, '')
        .replace(dispatch, dispatch + admission + running)
    },
  },
  {
    id: 'fabricate-effect',
    scenario: 'fabricated-effect',
    description: 'synthesise a binding-declared effect when the caller observed nothing',
    expect: '    return { effectEvidence: fallback, observedEffects: [], refusedClaim: null }',
    apply(source) {
      return source.replace(
        '    return { effectEvidence: fallback, observedEffects: [], refusedClaim: null }',
        "    return { effectEvidence: 'observed', observedEffects: Object.freeze([{ kind: 'binding-declared', target: 'assumed', evidenceId: 'assumed-by-mutant' }]), refusedClaim: null }",
      )
    },
  },
  {
    id: 'change-tool-result',
    scenario: 'result-changed',
    description: 'return a settlement-annotated copy instead of the body value',
    expect: '    return value\n',
    apply(source) {
      return source.replace(
        '    return value\n',
        '    return { ...(value as Record<string, unknown>), settlement: { executionId: invocation.executionId } }\n',
      )
    },
  },
  {
    id: 'replay-returns-fabricated',
    scenario: 'replay-fabricated',
    description: "answer a replay of a recovered execution with a fabricated success instead of refusing",
    expect: "        terminal ? 'A5_SETTLEMENT_REPLAY_REFUSED'",
    apply(source) {
      return source.replace(
        "      refuse(\n        terminal ? 'A5_SETTLEMENT_REPLAY_REFUSED'",
        "      return { content: 'replay-fabricated' }\n      refuse(\n        terminal ? 'A5_SETTLEMENT_REPLAY_REFUSED'",
      )
    },
  },
  {
    id: 're-read-store-at-call-time',
    scenario: 'store-binding',
    description: 'let the wrapper read options.store at call time instead of capturing one store',
    expect: '  const bound = Object.freeze({ store, clock })',
    apply(source) {
      return source.replace(
        '  const bound = Object.freeze({ store, clock })',
        '  const bound = Object.freeze({ get store() { return options.store }, clock })',
      )
    },
  },
]

/** Copy the three modules, mutate the dispatch one, import them. */
export async function runMutant(repoRoot, mutant, workRoot) {
  const source = readFileSync(join(repoRoot, DISPATCH_REL), 'utf8')
  if (!source.includes(mutant.expect)) {
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
  const dispatchFile = join(dir, 'dispatch-settlement.ts')
  const storeFile = join(dir, 'execution-settlement.ts')
  const adapterFile = join(dir, 'writer-adapter.ts')
  writeFileSync(dispatchFile, mutated)
  writeFileSync(storeFile, readFileSync(join(repoRoot, STORE_REL), 'utf8'))
  writeFileSync(adapterFile, readFileSync(join(repoRoot, ADAPTER_REL), 'utf8'))
  const query = `?mutant=${encodeURIComponent(mutant.id)}`
  const dispatch = await import(`${pathToFileURL(dispatchFile).href}${query}`)
  const settlement = await import(`${pathToFileURL(storeFile).href}${query}`)
  const adapter = await import(`${pathToFileURL(adapterFile).href}${query}`)
  const dataDir = join(dir, 'records')
  mkdirSync(dataDir, { recursive: true })
  const result = await SCENARIOS[mutant.scenario]({ dispatch, settlement, adapter }, dataDir)
  return {
    id: mutant.id,
    scenario: mutant.scenario,
    description: mutant.description,
    red: result.red,
    detail: result.detail,
  }
}

let realRunSeq = 0

/** Run one scenario against the REAL modules (the positive half of the control). */
export async function runScenarioOnReal(repoRoot, scenario, workRoot) {
  const query = '?real=1'
  const dispatch = await import(`${pathToFileURL(join(repoRoot, DISPATCH_REL)).href}${query}`)
  const settlement = await import(`${pathToFileURL(join(repoRoot, STORE_REL)).href}${query}`)
  const adapter = await import(`${pathToFileURL(join(repoRoot, ADAPTER_REL)).href}${query}`)
  realRunSeq += 1
  const dir = join(workRoot, `real-${scenario}-${String(realRunSeq)}`)
  mkdirSync(dir, { recursive: true })
  const result = await SCENARIOS[scenario]({ dispatch, settlement, adapter }, dir)
  return { scenario, red: result.red, detail: result.detail }
}
