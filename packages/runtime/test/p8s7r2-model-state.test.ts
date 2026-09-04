/**
 * p8s7r2-model-state.test.ts — R2-3 (P8-S7-R2): BQ-11 the MODEL STATE view
 * (D09/H06/H09/H10/H12 + F09 the model part).
 *
 * The production projection v1 carried no model state at all. R2-3 wires
 * the production root (`root.ts` `readPortDeps.modelState`) to the BQ-11
 * resolver (`src/plugin/model-state-view.js`): the model cell of one member
 * is resolved TWICE through the FROZEN P3-T4 two-stage policy resolution —
 * the NOW horizon (the production step clock is pinned to 0, so the policy
 * state of the current boundary) and the NEXT horizon (the maximum step —
 * every admitted future-boundary change resolved) — over the SAME durable
 * layer facts the R2-2 effective-config view consumes, and the v2
 * projection schema surfaces the closed BQ-11 shape per member row:
 *
 *   current { value, source, state, [deniedBy], [unavailable], [effectiveFrom] }
 *   pendingNextBoundary? { same entry shape }   (ABSENT when nothing pending)
 *   provenance { layer, origin, recordId, explanation }
 *   availability 'available' | 'unavailable'
 *
 * This suite drives the PRODUCTION entry (`../src/plugin/host.js` apply)
 * over SIX independent boot worlds (one scratch dir each; distinct root
 * session ids) and carries the per-state named tests required by C3:
 *
 *   World A (baseline)     — D09/H06: every row (leader + member) reports
 *   the world baseline INHERITED from the capability default; provenance is
 *   the unspecified layer; NO pendingNextBoundary key.
 *   World B (policy state) — H09/F09: the human policy-state model change is
 *   PENDING-NEXT-BOUNDARY (value / source policy-state / effectiveFrom 1)
 *   while `current` stays the baseline at the pinned step 0.
 *   World C (blueprint)    — H12: the blueprint model deny surfaces denied
 *   with Team provenance (team:deny:blueprint:static, provenance layer
 *   blueprint) and availability unavailable.
 *   World D (capability)   — H10: the next-boundary model is unavailable
 *   (capability missing) while the current boundary stays available.
 *   World E (external)     — H10: the next-boundary model is denied by the
 *   external hard policy while the current boundary stays available.
 *   World F (human)        — H12: the human model override surfaces as
 *   pending-next-boundary with humanOverride provenance (record id
 *   ovr-model-team-g0) — the production-writable record-backed branch.
 *
 * RESIDUALS (documented, production-unreachable, no production write path):
 *  - the mutation-RECORD-lane pending branch (a winning model value backed
 *    by an admitted-but-unapplied StoredMutationRecord, incl. its
 *    record-step `effectiveFrom`) — production writes land in the
 *    governance repo (overrides) or the transitions lane (policyState);
 *    the record lane has no production writer (the R2-2 direct-resolver
 *    suite X covers the sibling lanes' record-backed derivations).
 *  - NOW-horizon winners with origin 'leader' / 'member' (record-backed) —
 *    at the pinned step 0 record-backed winning values are conservatively
 *    pending (the two-horizon ruling), so the current entry's origin is
 *    'static' or the override 'human' in every production world.
 *  - the ND-03 substrate availability facts are a DIFFERENT concern (the
 *    R1 cluster) and are out of this view by design (availability here is
 *    the Team-side availability).
 *
 * @module p8s7r2-model-state
 */

import { describe, expect, it } from 'vitest'
import {
  CONTEXT_POLICIES,
  createMemberProjection,
  parseMemberModelState,
  parseMemberProjection,
  parseModelStateEntry,
  parseModelStateProvenance,
  parseRootSessionId,
} from '../../contracts/src/index.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// The storage package exports no type under this name — the runtime class
// lives in testkit; alias the instance type from the imported class.
type FileStorageSeamType = InstanceType<typeof FileStorageSeam>

// --- the fixture constants ------------------------------------------------------

const ROOT_MA = 'session-p8s7r2msa'
const ROOT_MB = 'session-p8s7r2msb'
const ROOT_MC = 'session-p8s7r2msc'
const ROOT_MD = 'session-p8s7r2msd'
const ROOT_ME = 'session-p8s7r2mse'
const ROOT_MF = 'session-p8s7r2msf'

const WORKER_MA = 'inst-p8s7r2mswa'
const WORKER_MB = 'inst-p8s7r2mswb'
const WORKER_MC = 'inst-p8s7r2mswc'
const WORKER_MD = 'inst-p8s7r2mswd'
const WORKER_ME = 'inst-p8s7r2mswe'
const WORKER_MF = 'inst-p8s7r2mswf'

const WORKSPACE_MA = 'C:/agent-team/work/p8s7r2ms-a'
const WORKSPACE_MB = 'C:/agent-team/work/p8s7r2ms-b'
const WORKSPACE_MC = 'C:/agent-team/work/p8s7r2ms-c'
const WORKSPACE_MD = 'C:/agent-team/work/p8s7r2ms-d'
const WORKSPACE_ME = 'C:/agent-team/work/p8s7r2ms-e'
const WORKSPACE_MF = 'C:/agent-team/work/p8s7r2ms-f'

const BASELINE_MODEL = { provider: 'p8s7r2ms-static', model: 'p8s7r2ms-model-v1' }
const BASELINE_MODEL_VALUE = `${BASELINE_MODEL.provider}/${BASELINE_MODEL.model}`

const STRICT_STATE_ID = 'strict'

const LEADER_ROW = 'inst-leader'

// --- the blueprints ---------------------------------------------------------------

/**
 * One frozen blueprint (same shape discipline as the R2-2 suite). The
 * capability policy is the ONLY Team-side model input the worlds vary:
 * null (silent), model deny (World C). Every world declares the two
 * policy states `default` / `strict` (the policy-state wire target).
 */
function blueprintSource(bpId: string, tag: string, capabilityPolicy: Record<string, string> | null): string {
  const lines = [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: You lead the P8S7R2MS ${tag} team.`,
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    `    persona: You do the P8S7R2MS ${tag} work.`,
  ]
  if (capabilityPolicy !== null) {
    lines.push('capabilityPolicy:')
    for (const [capability, mode] of Object.entries(capabilityPolicy)) {
      lines.push(`  ${capability}: ${mode}`)
    }
  }
  lines.push(
    'requirements:',
    '  - domain: tool',
    '    name: web',
    '    optional: true',
    '  - domain: skill',
    '    name: base',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '    - archive-member',
    '    - restore-member',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '      deny: []',
    'policyStates:',
    '  - id: default',
    `    description: The P8S7R2MS ${tag} default state.`,
    '  - id: strict',
    `    description: The P8S7R2MS ${tag} strict state.`,
    'quotas:',
    '  team:',
    '    maxInstances: 12',
    '    maxConcurrent: 12',
    '  members:',
    '    maxInstances: 4',
    '    maxConcurrent: 4',
    'metadata: {}',
    '---',
  )
  return lines.join('\n')
}

const BP_MA = blueprintSource('P8S7R2MSA-BP', 'A', null)
const BP_MB = blueprintSource('P8S7R2MSB-BP', 'B', null)
const BP_MC = blueprintSource('P8S7R2MSC-BP', 'C', { model: 'deny' })
const BP_MD = blueprintSource('P8S7R2MSD-BP', 'D', null)
const BP_ME = blueprintSource('P8S7R2MSE-BP', 'E', null)
const BP_MF = blueprintSource('P8S7R2MSF-BP', 'F', null)

// --- the row configs ----------------------------------------------------------------

/** One world row config (the entry's ONLY input channel). */
function rowConfigFor(
  rootSessionId: string,
  blueprint: string,
  workerId: string,
  defaultWorkspace: string,
  externalPolicyFacts: Record<string, unknown>,
): Record<string, unknown> {
  return {
    bootPhase: 'create',
    rootSessionId,
    blueprintSource: blueprint,
    generation: 1,
    defaultWorkspace,
    seedMembers: [
      {
        instanceId: workerId,
        templateId: 'worker',
        label: 'r23-seed-worker',
        childSessionId: `session-child-${workerId}`,
      },
    ],
    staticModel: { ...BASELINE_MODEL },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts,
    glueUrl: stubGlueUrl(),
  }
}

// --- the test Cordis context + the built-entry loader --------------------------------

/** The production facade `teamRoot` as provided by the entry. */
interface TeamRootFacade {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly ready: Promise<Record<string, any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  [key: string]: any
}

interface TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  ctx: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

/** One plain-object Cordis context (get / provide / effect). */
function makeWorld(seam: FileStorageSeamType): TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    teamStorageSeam: seam,
  }
  const effectDisposers: Array<() => void> = []
  return {
    ctx: {
      get: (name: string) => provided[name],
      provide: (name: string, value: unknown) => {
        provided[name] = value
      },
      effect: (factory: () => () => void, _label?: string) => {
        effectDisposers.push(factory())
      },
    },
    provided,
    effectDisposers,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
let hostModulePromise: Promise<Record<string, any>> | null = null
/** Resolve the production entry (statically imported from TS source). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function loadHost(): Promise<Record<string, any>> {
  if (hostModulePromise === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    hostModulePromise = Promise.resolve(hostEntry as unknown as Record<string, any>)
  }
  return hostModulePromise
}

/** Fail the whole file (module-load failure) on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`R2-3 scenario guard: ${label}`)
}

/** Apply the production entry over one world (the p8s5a pattern). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
async function applyWorld(world: TestWorld, config: Record<string, any>): Promise<Record<string, any>> {
  const host = await loadHost()
  await host.apply(world.ctx, config)
  const teamRoot: TeamRootFacade = world.provided.teamRoot
  check(teamRoot !== undefined, 'apply resolved but never provided teamRoot')
  return await teamRoot.ready
}

/**
 * Capture the remote dispatcher the registration installs (the p8s6 fake
 * connection pattern) and return the endpoint caller.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function attachRemoteCaller(root: Record<string, any>): (
  endpoint: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  params: Record<string, any>,
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
) => Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  let captured: ((endpoint: string, payload: unknown) => Promise<Record<string, any>>) | null = null
  const registration = root.seams.remoteHandlerRegistration.current()
  check(registration !== null, 'the remote handler registration seam is empty')
  registration({
    rpc: {
      handle: (_channel: string, dispatcher: unknown) => {
        captured = dispatcher as (
          endpoint: string,
          payload: unknown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
        ) => Promise<Record<string, any>>
        return () => {}
      },
    },
  })
  const dispatcher = captured as
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    | ((endpoint: string, payload: unknown) => Promise<Record<string, any>>)
    | null
  if (dispatcher === null) {
    throw new Error('the registration never installed a dispatcher')
  }
  return (endpoint, params) => dispatcher(endpoint, { version: 1, params })
}

/** Read one remote response's error code (null when ok). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function remoteCode(response: Record<string, any>): string | null {
  if (response.ok === false) {
    const error = response['error']
    return error !== null && typeof error === 'object'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
      ? String((error as Record<string, any>)['code'])
      : 'malformed-error'
  }
  return null
}

/** Read one remote response's `value.data` record. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function remoteData(response: Record<string, any>): Record<string, any> {
  const value = response['value']
  if (value === null || typeof value !== 'object') throw new Error('R2-3: no value in response')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const data = (value as Record<string, any>)['data']
  if (data === null || typeof data !== 'object') throw new Error('R2-3: no data in value')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  return data as Record<string, any>
}

/** The one projected member's model-state DTO (throws when absent). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function msOf(projection: Record<string, any>, instanceId: string): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const members = projection['members'] as Array<Record<string, any>>
  const member = members.find((item) => item['instanceId'] === instanceId)
  if (member === undefined) throw new Error(`R2-3: no projected member ${instanceId}`)
  const ms = member['modelState']
  if (ms === null || typeof ms !== 'object') {
    throw new Error(`R2-3: no modelState on projected member ${instanceId}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  return ms as Record<string, any>
}

/** Close one world root (the flush boundary); capture any throw. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
async function closeWorld(root: Record<string, any>): Promise<string | null> {
  try {
    await root.close()
    return null
  } catch (err) {
    return String(err)
  }
}

// --- the captured state ---------------------------------------------------------------

interface R23State {
  dirs: string[]
  worlds: TestWorld[]
  // World A — the baseline (D09/H06)
  aMemberCount: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  aLeaderMs: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  aWorkerMs: Record<string, any>
  // World B — the pending policy-state model (H09/F09)
  bSetCode: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  bTransition: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  bLeaderMs0: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  bLeaderMs1: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  bWorkerMs1: Record<string, any>
  // World C — the blueprint team deny (H12)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  cLeaderMs: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  cWorkerMs: Record<string, any>
  // World D — the capability-missing pending (H10)
  dSetCode: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  dWorkerMs1: Record<string, any>
  // World E — the external hard-deny pending (H10)
  eSetCode: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  eWorkerMs1: Record<string, any>
  // World F — the human model override (H12)
  fOverrideCode: string | null
  fOverrideRecordId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  fLeaderMs: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  fWorkerMs: Record<string, any>
  // Reversibility
  closeThrewA: string | null
  closeThrewB: string | null
  closeThrewC: string | null
  closeThrewD: string | null
  closeThrewE: string | null
  closeThrewF: string | null
}

// --- the scenario (module top level — the sync shim forbids async it()) -----------------

const r23: R23State = await (async (): Promise<R23State> => {
  // One scratch dir per world: a stamped TeamDomain is per-dir and a
  // multi-root dir is not supported (create vs. open), so the six worlds
  // each boot over their own dir.
  const dirs: string[] = []
  const openSeam = (base: string): FileStorageSeamType => {
    const dir = scratchDir(base)
    destroyDir(dir) // idempotent start-state: an aborted prior run may have left a stamped domain
    dirs.push(dir)
    return new FileStorageSeam(dir)
  }
  const worlds: TestWorld[] = []

  // --- World A — the baseline (D09/H06: inherited model, no pending) ----------------
  const worldA = makeWorld(openSeam('p8s7r2-msa'))
  worlds.push(worldA)
  const rootA = await applyWorld(
    worldA,
    rowConfigFor(ROOT_MA, BP_MA, WORKER_MA, WORKSPACE_MA, { hard: {}, capabilityExists: {} }),
  )
  const projA = rootA.projection.project(parseRootSessionId(ROOT_MA))
  const aMemberCount = (projA['members'] as unknown[]).length
  const aLeaderMs = msOf(projA, LEADER_ROW)
  const aWorkerMs = msOf(projA, WORKER_MA)
  const closeThrewA = await closeWorld(rootA)

  // --- World B — the pending policy-state model (H09/F09) ------------------------------
  const worldB = makeWorld(openSeam('p8s7r2-msb'))
  worlds.push(worldB)
  const rootB = await applyWorld(
    worldB,
    rowConfigFor(ROOT_MB, BP_MB, WORKER_MB, WORKSPACE_MB, { hard: {}, capabilityExists: {} }),
  )
  const callB = attachRemoteCaller(rootB)
  const projB0 = rootB.projection.project(parseRootSessionId(ROOT_MB))
  const bLeaderMs0 = msOf(projB0, LEADER_ROW)
  const bSet = await callB('policyState.set', {
    teamSessionId: ROOT_MB,
    target: {
      stateId: STRICT_STATE_ID,
      cells: { model: { value: { kind: 'allow', items: ['p8s7r2ms-b/model-b1'] } } },
    },
    actor: { kind: 'human' },
  })
  if (bSet.ok !== true) throw new Error(`R2-3 world B: policyState.set failed (${remoteCode(bSet)})`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const bTransition = remoteData(bSet)['transition'] as Record<string, any>
  const projB1 = rootB.projection.project(parseRootSessionId(ROOT_MB))
  const bLeaderMs1 = msOf(projB1, LEADER_ROW)
  const bWorkerMs1 = msOf(projB1, WORKER_MB)
  const closeThrewB = await closeWorld(rootB)

  // --- World C — the blueprint team deny (H12) -----------------------------------------
  const worldC = makeWorld(openSeam('p8s7r2-msc'))
  worlds.push(worldC)
  const rootC = await applyWorld(
    worldC,
    rowConfigFor(ROOT_MC, BP_MC, WORKER_MC, WORKSPACE_MC, { hard: {}, capabilityExists: {} }),
  )
  const projC = rootC.projection.project(parseRootSessionId(ROOT_MC))
  const cLeaderMs = msOf(projC, LEADER_ROW)
  const cWorkerMs = msOf(projC, WORKER_MC)
  const closeThrewC = await closeWorld(rootC)

  // --- World D — the capability-missing pending (H10) ----------------------------------
  const worldD = makeWorld(openSeam('p8s7r2-msd'))
  worlds.push(worldD)
  const rootD = await applyWorld(
    worldD,
    rowConfigFor(ROOT_MD, BP_MD, WORKER_MD, WORKSPACE_MD, {
      hard: {},
      capabilityExists: { model: false },
    }),
  )
  const callD = attachRemoteCaller(rootD)
  const dSet = await callD('policyState.set', {
    teamSessionId: ROOT_MD,
    target: {
      stateId: STRICT_STATE_ID,
      cells: { model: { value: { kind: 'allow', items: ['p8s7r2ms-d/model-d1'] } } },
    },
    actor: { kind: 'human' },
  })
  if (dSet.ok !== true) throw new Error(`R2-3 world D: policyState.set failed (${remoteCode(dSet)})`)
  const projD1 = rootD.projection.project(parseRootSessionId(ROOT_MD))
  const dWorkerMs1 = msOf(projD1, WORKER_MD)
  const closeThrewD = await closeWorld(rootD)

  // --- World E — the external hard-deny pending (H10) -----------------------------------
  const worldE = makeWorld(openSeam('p8s7r2-mse'))
  worlds.push(worldE)
  const rootE = await applyWorld(
    worldE,
    rowConfigFor(ROOT_ME, BP_ME, WORKER_ME, WORKSPACE_ME, {
      hard: { model: { kind: 'deny' } },
      capabilityExists: {},
    }),
  )
  const callE = attachRemoteCaller(rootE)
  const eSet = await callE('policyState.set', {
    teamSessionId: ROOT_ME,
    target: {
      stateId: STRICT_STATE_ID,
      cells: { model: { value: { kind: 'allow', items: ['p8s7r2ms-e/model-e1'] } } },
    },
    actor: { kind: 'human' },
  })
  if (eSet.ok !== true) throw new Error(`R2-3 world E: policyState.set failed (${remoteCode(eSet)})`)
  const projE1 = rootE.projection.project(parseRootSessionId(ROOT_ME))
  const eWorkerMs1 = msOf(projE1, WORKER_ME)
  const closeThrewE = await closeWorld(rootE)

  // --- World F — the human model override (H12) ------------------------------------------
  const worldF = makeWorld(openSeam('p8s7r2-msf'))
  worlds.push(worldF)
  const rootF = await applyWorld(
    worldF,
    rowConfigFor(ROOT_MF, BP_MF, WORKER_MF, WORKSPACE_MF, { hard: {}, capabilityExists: {} }),
  )
  const callF = attachRemoteCaller(rootF)
  const fOverride = await callF('override.set', {
    teamSessionId: ROOT_MF,
    capability: 'model',
    value: { kind: 'allow', items: ['p8s7r2ms-f/model-f1'] },
    actor: { kind: 'human' },
  })
  if (fOverride.ok !== true) {
    throw new Error(`R2-3 world F: override.set failed (${remoteCode(fOverride)})`)
  }
  const fOverrideData = remoteData(fOverride)
  const projF = rootF.projection.project(parseRootSessionId(ROOT_MF))
  const fLeaderMs = msOf(projF, LEADER_ROW)
  const fWorkerMs = msOf(projF, WORKER_MF)
  const closeThrewF = await closeWorld(rootF)

  return {
    dirs,
    worlds,
    aMemberCount,
    aLeaderMs,
    aWorkerMs,
    bSetCode: remoteCode(bSet),
    bTransition,
    bLeaderMs0,
    bLeaderMs1,
    bWorkerMs1,
    cLeaderMs,
    cWorkerMs,
    dSetCode: remoteCode(dSet),
    dWorkerMs1,
    eSetCode: remoteCode(eSet),
    eWorkerMs1,
    fOverrideCode: remoteCode(fOverride),
    fOverrideRecordId: String(fOverrideData['recordId']),
    fLeaderMs,
    fWorkerMs,
    closeThrewA,
    closeThrewB,
    closeThrewC,
    closeThrewD,
    closeThrewE,
    closeThrewF,
  }
})()

// --- the named tests (C3: D09/H06/H09/H10/H12) -------------------------------------------

describe('R2-3 (P8-S7-R2): BQ-11 the model state view', () => {
  // --- World A — the baseline (D09/H06) -------------------------------------------------

  it('R23.1 D09/H06: every row (leader + member) reports the world baseline as inherited from the capability default (value p8s7r2ms-static/p8s7r2ms-model-v1, source capability, state inherited)', () => {
    expect(r23.aMemberCount).toBe(2)
    expect(r23.aLeaderMs['current']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
    expect(r23.aWorkerMs['current']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
    expect(r23.aLeaderMs['availability']).toBe('available')
    expect(r23.aWorkerMs['availability']).toBe('available')
  })

  it('R23.2 D09/H06: the baseline provenance is the unspecified layer (layer unspecified, origin static, recordId null) with a non-empty resolver explanation', () => {
    for (const ms of [r23.aLeaderMs, r23.aWorkerMs]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
      const prov = ms['provenance'] as Record<string, any>
      expect(prov['layer']).toBe('unspecified')
      expect(prov['origin']).toBe('static')
      expect(prov['recordId']).toBe(null)
      const explanation = prov['explanation']
      expect(typeof explanation).toBe('string')
      expect((explanation as string).length).toBeGreaterThan(0)
    }
  })

  it('R23.3 H06: the baseline rows carry NO pendingNextBoundary key (DURATIONAL-optional: absent, never undefined)', () => {
    expect('pendingNextBoundary' in r23.aLeaderMs).toBe(false)
    expect('pendingNextBoundary' in r23.aWorkerMs).toBe(false)
    expect(r23.aLeaderMs['pendingNextBoundary'] === undefined).toBe(true)
  })

  // --- World B — the pending policy-state model (H09/F09) ---------------------------------

  it('R23.4 H09/F09: the human policy-state model change is PENDING-NEXT-BOUNDARY (value p8s7r2ms-b/model-b1, source policy-state, state pending-next-boundary, effectiveFrom 1) on BOTH rows while current stays the baseline at the pinned step 0', () => {
    expect(r23.bSetCode).toBe(null)
    // Before the set: baseline, no pending.
    expect(r23.bLeaderMs0['current']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
    expect('pendingNextBoundary' in r23.bLeaderMs0).toBe(false)
    // After the set: current still baseline (NOW horizon at step 0), pending filled.
    expect(r23.bLeaderMs1['current']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
    expect(r23.bLeaderMs1['pendingNextBoundary']).toEqual({
      value: 'p8s7r2ms-b/model-b1',
      source: 'policy-state',
      state: 'pending-next-boundary',
      effectiveFrom: 1,
    })
    expect(r23.bWorkerMs1['pendingNextBoundary']).toEqual({
      value: 'p8s7r2ms-b/model-b1',
      source: 'policy-state',
      state: 'pending-next-boundary',
      effectiveFrom: 1,
    })
    expect(r23.bLeaderMs1['availability']).toBe('available')
    expect(r23.bWorkerMs1['availability']).toBe('available')
  })

  it('R23.5 H09/F09: the durable transition facts (requestedAtStep 0, effectiveFromStep 1, target stateId strict) are the source of the pending view', () => {
    expect(r23.bTransition['requestedAtStep']).toBe(0)
    expect(r23.bTransition['effectiveFromStep']).toBe(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const state = r23.bTransition['state'] as Record<string, any>
    expect(state['stateId']).toBe(STRICT_STATE_ID)
  })

  // --- World C — the blueprint team deny (H12) --------------------------------------------

  it('R23.6 H12: the blueprint model deny surfaces as denied on every row with Team provenance (source blueprint, state denied, deniedBy team:deny:blueprint:static, provenance layer blueprint, availability unavailable)', () => {
    expect(r23.cWorkerMs['current']).toEqual({
      value: null,
      source: 'blueprint',
      state: 'denied',
      deniedBy: 'team:deny:blueprint:static',
    })
    expect(r23.cLeaderMs['current']).toEqual({
      value: null,
      source: 'blueprint',
      state: 'denied',
      deniedBy: 'team:deny:blueprint:static',
    })
    expect(r23.cWorkerMs['provenance']['layer']).toBe('blueprint')
    expect(r23.cWorkerMs['provenance']['origin']).toBe('static')
    expect(r23.cWorkerMs['provenance']['recordId']).toBe(null)
    expect(typeof r23.cWorkerMs['provenance']['explanation']).toBe('string')
    expect((r23.cWorkerMs['provenance']['explanation'] as string).length).toBeGreaterThan(0)
    expect(r23.cWorkerMs['availability']).toBe('unavailable')
    expect(r23.cLeaderMs['availability']).toBe('unavailable')
    expect('pendingNextBoundary' in r23.cWorkerMs).toBe(false)
  })

  // --- World D — the capability-missing pending (H10) --------------------------------------

  it('R23.7 H10: the capability-missing model at the next boundary surfaces as unavailable from the winning team layer (value null, source policy-state, state unavailable, unavailable true, effectiveFrom 1) while the current boundary stays available', () => {
    expect(r23.dSetCode).toBe(null)
    expect(r23.dWorkerMs1['current']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
    expect(r23.dWorkerMs1['pendingNextBoundary']).toEqual({
      value: null,
      source: 'policy-state',
      state: 'unavailable',
      unavailable: true,
      effectiveFrom: 1,
    })
    expect(r23.dWorkerMs1['availability']).toBe('available')
  })

  // --- World E — the external hard-deny pending (H10) ----------------------------------------

  it('R23.8 H10: the external hard deny at the next boundary surfaces as denied from the external-hard-policy (value null, source external-hard-policy, state denied, deniedBy external:hard-deny, effectiveFrom 1) while the current boundary stays available', () => {
    expect(r23.eSetCode).toBe(null)
    expect(r23.eWorkerMs1['current']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
    expect(r23.eWorkerMs1['pendingNextBoundary']).toEqual({
      value: null,
      source: 'external-hard-policy',
      state: 'denied',
      deniedBy: 'external:hard-deny',
      effectiveFrom: 1,
    })
    expect(r23.eWorkerMs1['availability']).toBe('available')
  })

  // --- World F — the human model override (H12) -----------------------------------------------

  it('R23.9 H12: the human model override surfaces as pending-next-boundary on every row with humanOverride provenance (recordId ovr-model-team-g0, origin human) and NO effectiveFrom (governance records carry no step)', () => {
    expect(r23.fOverrideCode).toBe(null)
    // The remote override.set mints the recordId server-side (s6-remote):
    // ovr-<capability>-<team|instanceId>-g<winnerGeneration>.
    expect(r23.fOverrideRecordId).toBe('ovr-model-team-g0')
    expect(r23.fWorkerMs['current']).toEqual({
      value: 'p8s7r2ms-f/model-f1',
      source: 'explicit-human-override',
      state: 'pending-next-boundary',
    })
    expect(r23.fLeaderMs['current']).toEqual({
      value: 'p8s7r2ms-f/model-f1',
      source: 'explicit-human-override',
      state: 'pending-next-boundary',
    })
    expect(r23.fWorkerMs['pendingNextBoundary']).toEqual({
      value: 'p8s7r2ms-f/model-f1',
      source: 'explicit-human-override',
      state: 'pending-next-boundary',
    })
    expect(r23.fWorkerMs['provenance']).toEqual({
      layer: 'humanOverride',
      origin: 'human',
      recordId: 'ovr-model-team-g0',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
      explanation: (r23.fWorkerMs['provenance'] as Record<string, any>)['explanation'],
    })
    expect(typeof r23.fWorkerMs['provenance']['explanation']).toBe('string')
    expect((r23.fWorkerMs['provenance']['explanation'] as string).length).toBeGreaterThan(0)
    expect(r23.fWorkerMs['availability']).toBe('available')
  })

  // --- the contract: the closed model-state DTO --------------------------------------------------

  const validEntry = {
    value: 'p8s7r2ms-b/model-b1',
    source: 'policy-state',
    state: 'inherited',
  }
  const validProvenance = {
    layer: 'policyState',
    origin: 'static',
    recordId: null,
    explanation: 'team: the policy state grants model p8s7r2ms-b/model-b1',
  }
  const validView = { current: validEntry, provenance: validProvenance, availability: 'available' }

  it('R23.10: parseMemberModelState accepts the closed happy path (with pendingNextBoundary) and deep-freezes the result', () => {
    const parsed = parseMemberModelState({
      ...validView,
      pendingNextBoundary: {
        value: null,
        source: 'blueprint',
        state: 'denied',
        deniedBy: 'team:deny:blueprint:static',
        effectiveFrom: 1,
      },
    })
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(Object.isFrozen(parsed['current'])).toBe(true)
    expect(Object.isFrozen(parsed['provenance'])).toBe(true)
    expect(parsed['pendingNextBoundary'] !== undefined).toBe(true)
  })

  it('R23.11: parseMemberModelState rejects an unknown view field and an unknown entry field', () => {
    expect(() => parseMemberModelState({ ...validView, bogus: true })).toThrow()
    expect(() => parseModelStateEntry({ ...validEntry, bogus: 1 }, 'modelState.current')).toThrow()
  })

  it('R23.12: parseModelStateEntry rejects a bad source, a bad state, and a negative effectiveFrom', () => {
    expect(() => parseModelStateEntry({ ...validEntry, source: 'bogus' }, 'modelState.current')).toThrow()
    expect(() => parseModelStateEntry({ ...validEntry, state: 'bogus' }, 'modelState.current')).toThrow()
    expect(() => parseModelStateEntry({ ...validEntry, effectiveFrom: -1 }, 'modelState.current')).toThrow()
  })

  it('R23.13: parseModelStateProvenance rejects a bad layer, a bad origin, and a non-string explanation', () => {
    expect(() => parseModelStateProvenance({ ...validProvenance, layer: 'bogus' })).toThrow()
    expect(() => parseModelStateProvenance({ ...validProvenance, origin: 'bogus' })).toThrow()
    expect(() => parseModelStateProvenance({ ...validProvenance, explanation: 42 })).toThrow()
  })

  it('R23.14: the v1 member schema rejects the modelState key; the v2 schema admits it and tolerates its absence', () => {
    const v1Member = {
      instanceId: 'inst-p8s7r2mct',
      templateId: 'worker',
      label: 'r23-ct',
      workspace: 'C:/agent-team/work/p8s7r2ms-ct',
      createdAt: new Date(0).toISOString(),
      lifecycle: 'CREATED',
      contextPolicy: CONTEXT_POLICIES.persistent,
      childSessionId: 'session-child-inst-p8s7r2mct',
      effectiveConfig: {
        model: { value: null, source: 'blueprint', state: 'unavailable' },
        workspace: { value: null, source: 'blueprint', state: 'unavailable' },
        permissions: {},
        autonomy: { value: null, source: 'blueprint', state: 'unavailable' },
      },
      liveActivity: null,
    }
    // v1: the key is outside the v1 closed field set.
    expect(() => parseMemberProjection({ ...v1Member, modelState: validView }, 1)).toThrow()
    // v2: the key is admitted ...
    const withMs = parseMemberProjection({ ...v1Member, modelState: validView }, 2)
    expect(withMs['modelState'] !== undefined).toBe(true)
    // ... and its absence is tolerated (DURATIONAL-optional).
    const withoutMs = parseMemberProjection(v1Member, 2)
    expect(withoutMs['modelState'] === undefined).toBe(true)
  })

  it('R23.15: createMemberProjection (v1-stamped) fails closed on a modelState input', () => {
    const input = {
      instanceId: 'inst-p8s7r2mct2',
      templateId: 'worker',
      label: 'r23-ct2',
      workspace: 'C:/agent-team/work/p8s7r2ms-ct2',
      createdAt: new Date(0).toISOString(),
      lifecycle: 'CREATED',
      contextPolicy: CONTEXT_POLICIES.persistent,
      childSessionId: 'session-child-inst-p8s7r2mct2',
      effectiveConfig: {
        model: { value: null, source: 'blueprint', state: 'unavailable' },
        workspace: { value: null, source: 'blueprint', state: 'unavailable' },
        permissions: {},
        autonomy: { value: null, source: 'blueprint', state: 'unavailable' },
      },
      liveActivity: null,
      modelState: validView,
    } as Parameters<typeof createMemberProjection>[0]
    expect(() => createMemberProjection(input)).toThrow()
  })

  // --- reversibility ---------------------------------------------------------------------------

  it('R23.16: every world root closed cleanly and the scratch dirs are destroyed (reversible)', () => {
    expect(r23.closeThrewA).toBe(null)
    expect(r23.closeThrewB).toBe(null)
    expect(r23.closeThrewC).toBe(null)
    expect(r23.closeThrewD).toBe(null)
    expect(r23.closeThrewE).toBe(null)
    expect(r23.closeThrewF).toBe(null)
    r23.worlds.forEach((world) => {
      world.effectDisposers.forEach((dispose) => dispose())
      world.effectDisposers.length = 0
    })
    r23.dirs.forEach((d) => destroyDir(d))
    expect(true).toBe(true)
  })
})
