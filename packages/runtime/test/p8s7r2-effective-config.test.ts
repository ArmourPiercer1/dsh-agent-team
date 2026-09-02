/**
 * p8s7r2-effective-config.test.ts — R2-2 (P8-S7-R2): BQ-08 the RESOLVED
 * effective-config view (F01-F08, G01, G02, G05, G06, G09, H04, H12, L11).
 *
 * The production projection v1 emitted the honest EMPTY view for every
 * member (`EMPTY_EFFECTIVE_CONFIG`: value null / source blueprint / state
 * unavailable on all four frozen lanes). R2-2 wires the production root
 * (`root.ts` `readPortDeps.effectiveConfig`) to the four-lane resolver
 * (`src/plugin/effective-config-view.js`): the frozen P3-T4 two-stage policy
 * resolution runs over the EXISTING durable layer facts — the bound
 * blueprint envelope, the durable PolicyState transitions (the R2-1 cache),
 * the mutation-store records, the durable governance overrides, and the
 * static external facts — at the maximum step horizon, and the v2 projection
 * schema surfaces the §18.1 per-field closed shape:
 *
 *   value / source / state / [suppressed] / [unavailable] / [deniedBy] /
 *   [effectiveFrom] / [locked]
 *
 * This suite drives the PRODUCTION entry (`../src/plugin/host.js` apply)
 * over FIVE independent boot worlds (one scratch dir; distinct root session
 * ids) and carries the per-state named tests required by C2:
 *
 *   World A (baseline)    — model INHERITED (R22.1), autonomy neutral
 *   INHERITED (R22.2), workspace LOCKED (R22.3), workspace INHERITED and
 *   unlocked (R22.4), permissions closed-empty (R22.5), the v2 schema stamp
 *   (R22.5b).
 *   World B (governance)  — the leader deny overlay PENDING-NEXT-BOUNDARY
 *   (R22.6), the durable locked policy-state cell surfaced with the
 *   production suppression residual (R22.7), the human model override
 *   PENDING on model + autonomy (R22.8).
 *   World C (external deny) — the blueprint-deny MODEL denied
 *   `team:deny:blueprint:static` (R22.10), the external hard-deny ITEM
 *   denied `external:hard-deny` (R22.11).
 *   World D (capability-missing) — the model UNAVAILABLE (R22.12), the
 *   policy-state item UNAVAILABLE (R22.13).
 *   World E (hard-allow intersection) — the surviving item OVERRIDDEN
 *   (R22.14a), the removed item DENIED `external:hard-removed` (R22.14b),
 *   the policy-state model OVERRIDDEN (R22.15).
 *   Direct resolver (R22.16) — the `effectiveFrom` MATERIALIZATION under
 *   deliberately overlapping mutation-record / governance-ref ids
 *   (production-disjoint residual), and the in-envelope lock SUPPRESSION
 *   (production-unreachable residual — the production envelope is empty).
 *
 * PRODUCTION-UNREACHABLE STATES (documented residuals, not test gaps):
 * - `suppressed` requires an overlay ALLOW with items inside the Team
 *   autonomy envelope. The production readers surface no envelope (the
 *   blueprint `autonomyEnvelope` and the template `mutationEnvelope` are
 *   absent in production -> the per-capability envelope is the empty set),
 *   so any overlay allow with items fails closed at stage 1 before the
 *   lock gate. R22.16b covers the state with a synthetic in-envelope policy
 *   reader over the direct resolver.
 * - `effectiveFrom` requires the winning overlay's recordId to appear in
 *   the mutation-store records lane. The production write path (remote
 *   `override.set` / `admitGovernanceOverride`) writes ONLY the governance
 *   `overrides` repository (server-minted `ovr-*` ids), while the records
 *   lane carries mutation-service records (`mutation-*` / `ledger-*` ids) —
 *   the id spaces are disjoint in production. R22.16a materializes the
 *   field under deliberately overlapping ids.
 *
 * Runner note: the plain-node shim forbids async `it()` bodies — every
 * world drives the production entry at MODULE TOP LEVEL (the p8s5a / p8s6 /
 * R2-1 pattern) and the `it()` blocks assert the captured state
 * synchronously.
 * @module @dsh-agent-team/runtime/test/p8s7r2-effective-config
 */

import { describe, expect, it } from 'vitest'
import { parseRootSessionId } from '../../contracts/src/index.js'
import type { InstanceId } from '../../contracts/src/index.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import { createEffectiveConfigView } from '../src/plugin/effective-config-view.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'
import type {
  PolicyReader,
  PolicyStateTransitionRecord,
  StoredMutationRecord,
} from '../mutation/types.js'
import type { GovernanceOverrideRecord } from '../../storage/schema/index.js'

// --- the fixture constants ------------------------------------------------------

const ROOT_A = 'session-p8s7r2roota'
const ROOT_B = 'session-p8s7r2rootb'
const ROOT_C = 'session-p8s7r2rootc'
const ROOT_D = 'session-p8s7r2rootd'
const ROOT_E = 'session-p8s7r2roote'
/** The direct-resolver world (a valid, parseable root session id). */
const ROOT_X = 'session-p8s7r2rootx'
const X_INSTANCE = 'inst-p8s7r2xdirect'

const WORKER_A = 'inst-p8s7r2wka'
const WORKER_B = 'inst-p8s7r2wkb'
const WORKER_C = 'inst-p8s7r2wkc'
const WORKER_D = 'inst-p8s7r2wkd'
const WORKER_E = 'inst-p8s7r2wke'
/** World A's fixture member (direct repository put; NO workspace key). */
const FIXTURE_A = 'inst-p8s7r2fxa'

const WORKSPACE_A = 'C:/agent-team/work/p8s7r2e-a'
const WORKSPACE_B = 'C:/agent-team/work/p8s7r2e-b'
const WORKSPACE_C = 'C:/agent-team/work/p8s7r2e-c'
const WORKSPACE_D = 'C:/agent-team/work/p8s7r2e-d'
const WORKSPACE_E = 'C:/agent-team/work/p8s7r2e-e'
const WORKSPACE_X = 'C:/agent-team/work/p8s7r2e-x'

const BASELINE_MODEL = { provider: 'p8s7r2e-static', model: 'p8s7r2e-model-v1' }
const BASELINE_MODEL_VALUE = `${BASELINE_MODEL.provider}/${BASELINE_MODEL.model}`

/** The strict state id (declared in every world blueprint). */
const STRICT_STATE_ID = 'strict'

// --- the blueprints ---------------------------------------------------------------

/**
 * One world blueprint (the P8S5A structure with the own id, the closed
 * default+strict policy-state set, and an optional `capabilityPolicy` map).
 */
function blueprintSource(bpId: string, tag: string, capabilityPolicy: Record<string, string> | null): string {
  const lines = [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: You lead the P8S7R2 ${tag} team.`,
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    `    persona: You do the P8S7R2 ${tag} work.`,
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
    `    description: The P8S7R2 ${tag} default state.`,
    '  - id: strict',
    `    description: The P8S7R2 ${tag} strict state.`,
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

const BP_A = blueprintSource('P8S7R2A-BP', 'A', null)
const BP_B = blueprintSource('P8S7R2B-BP', 'B', null)
const BP_C = blueprintSource('P8S7R2C-BP', 'C', { model: 'deny', tools: 'allow' })
const BP_D = blueprintSource('P8S7R2D-BP', 'D', { model: 'allow', permissions: 'allow' })
const BP_E = blueprintSource('P8S7R2E-BP', 'E', { tools: 'allow' })

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
        label: 'r22-seed-worker',
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
  readonly ready: Promise<Record<string, any>>
  [key: string]: any
}

interface TestWorld {
  ctx: Record<string, any>
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

/** One plain-object Cordis context (get / provide / effect). */
function makeWorld(seam: FileStorageSeam): TestWorld {
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

let hostModulePromise: Promise<Record<string, any>> | null = null
/** Resolve the production entry (statically imported from TS source). */
function loadHost(): Promise<Record<string, any>> {
  if (hostModulePromise === null) {
    hostModulePromise = Promise.resolve(hostEntry as unknown as Record<string, any>)
  }
  return hostModulePromise
}

/** Fail the whole file (module-load failure) on a flow-critical invariant. */
function check(condition: boolean, label: string): asserts condition {
  if (!condition) throw new Error(`R2-2 scenario guard: ${label}`)
}

/** Apply the production entry over one world (the p8s5a pattern). */
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
function attachRemoteCaller(root: Record<string, any>): (
  endpoint: string,
  params: Record<string, any>,
) => Promise<Record<string, any>> {
  let captured: ((endpoint: string, payload: unknown) => Promise<Record<string, any>>) | null = null
  const registration = root.seams.remoteHandlerRegistration.current()
  check(registration !== null, 'the remote handler registration seam is empty')
  registration({
    rpc: {
      handle: (_channel: string, dispatcher: unknown) => {
        captured = dispatcher as (
          endpoint: string,
          payload: unknown,
        ) => Promise<Record<string, any>>
        return () => {}
      },
    },
  })
  const dispatcher = captured as
    | ((endpoint: string, payload: unknown) => Promise<Record<string, any>>)
    | null
  if (dispatcher === null) {
    throw new Error('the registration never installed a dispatcher')
  }
  return (endpoint, params) => dispatcher(endpoint, { version: 1, params })
}

/** Read one remote response's error code (null when ok). */
function remoteCode(response: Record<string, any>): string | null {
  if (response.ok === false) {
    const error = response['error']
    return error !== null && typeof error === 'object'
      ? String((error as Record<string, any>)['code'])
      : 'malformed-error'
  }
  return null
}

/** Read one remote response's `value.data` record. */
function remoteData(response: Record<string, any>): Record<string, any> {
  const value = response['value']
  if (value === null || typeof value !== 'object') throw new Error('R2-2: no value in response')
  const data = (value as Record<string, any>)['data']
  if (data === null || typeof data !== 'object') throw new Error('R2-2: no data in value')
  return data as Record<string, any>
}

/** The one projected member's v2 effective-config DTO (throws when absent). */
function ecOf(projection: Record<string, any>, instanceId: string): Record<string, any> {
  const members = projection['members'] as Array<Record<string, any>>
  const member = members.find((item) => item['instanceId'] === instanceId)
  if (member === undefined) throw new Error(`R2-2: no projected member ${instanceId}`)
  return member['effectiveConfig'] as Record<string, any>
}

/** Close one world root (the R2-1 flush boundary); capture any throw. */
async function closeWorld(root: Record<string, any>): Promise<string | null> {
  try {
    await root.close()
    return null
  } catch (err) {
    return String(err)
  }
}

// --- the captured state ---------------------------------------------------------------

interface R22State {
  dirs: string[]
  worlds: TestWorld[]
  // World A — the baseline
  aSchemaVersion: number
  aMemberCount: number
  aWorkerEc: Record<string, any>
  aFixtureEc: Record<string, any>
  // World B — governance deny overlay, the locked state, the human override
  bAdmitRecordId: string
  bAdmitKind: string
  bAdmitOrigin: string
  bAdmitGeneration: number
  bEc1: Record<string, any>
  bSetCode: string | null
  bSetEntryId: string
  bSetOrigin: string
  bSetRequestedAtStep: number
  bSetEffectiveFromStep: number
  bGetOk: boolean
  bGetStateId: string
  bGetToolsLocked: boolean
  bGetToolsHasValueKey: boolean
  bProjPolicyState2: string
  bEc2: Record<string, any>
  bOverrideCode: string | null
  bOverrideRecordId: string
  bOverrideKind: string
  bEc3: Record<string, any>
  // World C — the external hard deny
  cEc0: Record<string, any>
  cSetCode: string | null
  cEc1: Record<string, any>
  cPermissionsKeys: string[]
  // World D — the capability-missing lane
  dEc0: Record<string, any>
  dSetCode: string | null
  dEc1: Record<string, any>
  dPermissionsKeys: string[]
  // World E — the hard-allow intersection
  eSetCode: string | null
  eEc1: Record<string, any>
  ePermissionsKeys: string[]
  // Direct resolver — the two production-unreachable derivations
  x16aThrew: string | null
  x16aEc: Record<string, any> | null
  x16bThrew: string | null
  x16bEc: Record<string, any> | null
  // Reversibility
  closeThrewA: string | null
  closeThrewB: string | null
  closeThrewC: string | null
  closeThrewD: string | null
  closeThrewE: string | null
}

// --- the scenario (module top level — the sync shim forbids async it()) -----------------

const r22: R22State = await (async (): Promise<R22State> => {
  // One scratch dir per world: a stamped TeamDomain is per-dir and a
  // multi-root dir is not supported (create vs. open), so the five worlds
  // each boot over their own dir.
  const dirs: string[] = []
  const openSeam = (base: string): FileStorageSeam => {
    const dir = scratchDir(base)
    destroyDir(dir) // idempotent start-state: an aborted prior run may have left a stamped domain
    dirs.push(dir)
    return new FileStorageSeam(dir)
  }
  const worlds: TestWorld[] = []

  // --- World A — the baseline (inherited model, locked/inherited workspace) ----------
  const worldA = makeWorld(openSeam('p8s7r2-eca'))
  worlds.push(worldA)
  const rootA = await applyWorld(
    worldA,
    rowConfigFor(ROOT_A, BP_A, WORKER_A, WORKSPACE_A, { hard: {}, capabilityExists: {} }),
  )
  // The fixture member: the same repository the production activation
  // provider writes through — a CREATED row with NO own workspace key
  // (the remote member.create path is fail-closed in the stub-glue test
  // worlds, so the fixture goes through the durable store directly).
  await rootA.domain.repositories.memberInstances.put({
    rootSessionId: ROOT_A,
    instanceId: FIXTURE_A,
    templateId: 'worker',
    label: 'r22-fixture-a',
    childSessionId: `session-child-${FIXTURE_A}`,
    lifecycle: 'CREATED',
    createdAt: new Date(0).toISOString(),
    activityVersion: 1,
  })
  const projA = rootA.projection.project(parseRootSessionId(ROOT_A))
  const aMemberCount = (projA['members'] as unknown[]).length
  const closeThrewA = await closeWorld(rootA)

  // --- World B — the governance deny overlay, the locked state, the human override ----
  const worldB = makeWorld(openSeam('p8s7r2-ecb'))
  worlds.push(worldB)
  const rootB = await applyWorld(
    worldB,
    rowConfigFor(ROOT_B, BP_B, WORKER_B, WORKSPACE_B, { hard: {}, capabilityExists: {} }),
  )
  const callB = attachRemoteCaller(rootB)

  // Step 1: the leader governance deny overlay (the production admission
  // authority writes the durable `overrides` repository).
  const bAdmit = await rootB.mutation.admitGovernanceOverride({
    authority: { kind: 'leader' },
    rootSessionId: ROOT_B,
    recordId: 'ovr-tools-leader-r22b',
    scope: 'team',
    cells: { tools: { kind: 'deny' } },
    now: () => new Date(0).toISOString(),
  })
  check(bAdmit.recordId === 'ovr-tools-leader-r22b', 'admitted record id mismatch')
  const projB1 = rootB.projection.project(parseRootSessionId(ROOT_B))
  const bEc1 = ecOf(projB1, WORKER_B)

  // Step 2: the durable locked policy-state cell (the remote wire).
  const bSet = await callB('policyState.set', {
    teamSessionId: ROOT_B,
    target: { stateId: STRICT_STATE_ID, cells: { tools: { locked: true } } },
    actor: { kind: 'human' },
  })
  if (bSet.ok !== true) throw new Error(`R2-2 world B: policyState.set failed (${remoteCode(bSet)})`)
  const bSetData = remoteData(bSet)
  const bTransition = bSetData['transition'] as Record<string, any>
  const bGet = await callB('policyState.get', { teamSessionId: ROOT_B })
  const bGetData = remoteData(bGet)
  const bGetState = bGetData['state'] as Record<string, any>
  const bGetCells = bGetState['cells'] as Record<string, any> | undefined
  const bGetToolsCell = bGetCells !== undefined ? (bGetCells['tools'] as Record<string, any> | undefined) : undefined
  const projB2 = rootB.projection.project(parseRootSessionId(ROOT_B))
  const bEc2 = ecOf(projB2, WORKER_B)

  // Step 3: the human model override (the remote wire; no envelope check,
  // no state gate — the frozen §19.5 human lane).
  const bOverride = await callB('override.set', {
    teamSessionId: ROOT_B,
    capability: 'model',
    value: { kind: 'allow', items: ['p8s7r2e-next/model-v2'] },
    actor: { kind: 'human' },
  })
  if (bOverride.ok !== true) {
    throw new Error(`R2-2 world B: override.set failed (${remoteCode(bOverride)})`)
  }
  const bOverrideData = remoteData(bOverride)
  const projB3 = rootB.projection.project(parseRootSessionId(ROOT_B))
  const bEc3 = ecOf(projB3, WORKER_B)
  const closeThrewB = await closeWorld(rootB)

  // --- World C — the external hard deny + the blueprint team deny ---------------------
  const worldC = makeWorld(openSeam('p8s7r2-ecc'))
  worlds.push(worldC)
  const rootC = await applyWorld(
    worldC,
    rowConfigFor(ROOT_C, BP_C, WORKER_C, WORKSPACE_C, {
      hard: { tools: { kind: 'deny' } },
      capabilityExists: {},
    }),
  )
  const callC = attachRemoteCaller(rootC)
  const projC0 = rootC.projection.project(parseRootSessionId(ROOT_C))
  const cEc0 = ecOf(projC0, WORKER_C)
  const cSet = await callC('policyState.set', {
    teamSessionId: ROOT_C,
    target: {
      stateId: STRICT_STATE_ID,
      cells: { tools: { value: { kind: 'allow', items: ['send-message'] } } },
    },
    actor: { kind: 'human' },
  })
  if (cSet.ok !== true) throw new Error(`R2-2 world C: policyState.set failed (${remoteCode(cSet)})`)
  const projC1 = rootC.projection.project(parseRootSessionId(ROOT_C))
  const cEc1 = ecOf(projC1, WORKER_C)
  const closeThrewC = await closeWorld(rootC)

  // --- World D — the capability-missing lane -------------------------------------------
  const worldD = makeWorld(openSeam('p8s7r2-ecd'))
  worlds.push(worldD)
  const rootD = await applyWorld(
    worldD,
    rowConfigFor(ROOT_D, BP_D, WORKER_D, WORKSPACE_D, {
      hard: {},
      capabilityExists: { model: false, permissions: false },
    }),
  )
  const callD = attachRemoteCaller(rootD)
  const projD0 = rootD.projection.project(parseRootSessionId(ROOT_D))
  const dEc0 = ecOf(projD0, WORKER_D)
  // The model cell needs a Team-granted item for the stage-2
  // capability-missing stage to have something to remove: an unspecified
  // (or team-denied) cell short-circuits BEFORE the capabilityExists check
  // (resolve.ts stage 2), so the item comes from the policy-state layer.
  const dSet = await callD('policyState.set', {
    teamSessionId: ROOT_D,
    target: {
      stateId: STRICT_STATE_ID,
      cells: {
        permissions: { value: { kind: 'allow', items: ['web-tool'] } },
        model: { value: { kind: 'allow', items: ['p8s7r2e-d/model-d1'] } },
      },
    },
    actor: { kind: 'human' },
  })
  if (dSet.ok !== true) throw new Error(`R2-2 world D: policyState.set failed (${remoteCode(dSet)})`)
  const projD1 = rootD.projection.project(parseRootSessionId(ROOT_D))
  const dEc1 = ecOf(projD1, WORKER_D)
  const closeThrewD = await closeWorld(rootD)

  // --- World E — the hard-allow intersection (surviving vs removed items) --------------
  const worldE = makeWorld(openSeam('p8s7r2-ece'))
  worlds.push(worldE)
  const rootE = await applyWorld(
    worldE,
    rowConfigFor(ROOT_E, BP_E, WORKER_E, WORKSPACE_E, {
      hard: { tools: { kind: 'allow', items: ['keep-item'] } },
      capabilityExists: {},
    }),
  )
  const callE = attachRemoteCaller(rootE)
  const eSet = await callE('policyState.set', {
    teamSessionId: ROOT_E,
    target: {
      stateId: STRICT_STATE_ID,
      cells: {
        tools: { value: { kind: 'allow', items: ['keep-item', 'drop-item'] } },
        model: { value: { kind: 'allow', items: ['p8s7r2e-policy/model-v9'] } },
      },
    },
    actor: { kind: 'human' },
  })
  if (eSet.ok !== true) throw new Error(`R2-2 world E: policyState.set failed (${remoteCode(eSet)})`)
  const projE1 = rootE.projection.project(parseRootSessionId(ROOT_E))
  const eEc1 = ecOf(projE1, WORKER_E)
  const closeThrewE = await closeWorld(rootE)

  // --- Direct resolver — the two production-unreachable derivations ---------------------
  // The in-envelope policy reader (the production reader surfaces no
  // envelope; these stubs restore the synthetic §19.4 envelope so the
  // in-envelope overlay states become reachable).
  const policyReaderX: PolicyReader = {
    readBlueprintEnvelope: () => ({
      values: {},
      autonomyEnvelope: { tools: { kind: 'allow', items: ['direct-tool'] } },
    }),
    readTemplatePolicy: () => ({
      values: {},
      mutationEnvelope: { tools: { kind: 'allow', items: ['direct-tool'] } },
    }),
    readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
  }
  const recordsX: StoredMutationRecord[] = [
    {
      recordId: 'mut-tools-r22x',
      kind: 'instanceOverlay',
      scope: 'instance',
      member: { rootSessionId: ROOT_X, instanceId: X_INSTANCE },
      origin: 'member',
      values: { tools: { kind: 'allow', items: ['direct-tool'] } },
      requestedAtStep: 5,
      effectiveFromStep: 6,
    },
  ]
  // R22.16a — the governance ref carries the SAME recordId as the winning
  // mutation record (deliberately overlapping id spaces; in production the
  // spaces are disjoint, which is the documented residual).
  const overrides16a: GovernanceOverrideRecord[] = [
    {
      schemaVersion: 1,
      kind: 'autonomy-overlay',
      recordId: 'mut-tools-r22x',
      scope: 'instance',
      rootSessionId: parseRootSessionId(ROOT_X),
      instanceId: X_INSTANCE as InstanceId,
      origin: 'member',
      values: { tools: { kind: 'allow', items: ['direct-tool'] } },
      generation: 1,
      updatedAt: new Date(0).toISOString(),
    },
  ]
  let x16aThrew: string | null = null
  let x16aEc: Record<string, any> | null = null
  try {
    x16aEc = createEffectiveConfigView({
      teamSessionId: ROOT_X,
      instanceId: X_INSTANCE,
      lifecycle: 'RUNNING',
      memberWorkspace: undefined,
      teamDefaultWorkspace: WORKSPACE_X,
      staticModel: { ...BASELINE_MODEL },
      transitions: [],
      records: recordsX,
      overrides: overrides16a,
      policyReader: policyReaderX,
    }) as unknown as Record<string, any>
  } catch (err) {
    x16aThrew = String(err)
  }
  // R22.16b — the same in-envelope overlay allow under a LOCKED policy-state
  // cell: the overlay is stored-but-suppressed (the production-empty-
  // envelope residual makes this state unreachable in the production view).
  const transitions16b: PolicyStateTransitionRecord[] = [
    {
      entryId: 'ledger-pslock-r22x',
      origin: 'human',
      state: { stateId: STRICT_STATE_ID, cells: { tools: { locked: true } } },
      requestedAtStep: 4,
      effectiveFromStep: 5,
    },
  ]
  let x16bThrew: string | null = null
  let x16bEc: Record<string, any> | null = null
  try {
    x16bEc = createEffectiveConfigView({
      teamSessionId: ROOT_X,
      instanceId: X_INSTANCE,
      lifecycle: 'RUNNING',
      memberWorkspace: undefined,
      teamDefaultWorkspace: WORKSPACE_X,
      staticModel: { ...BASELINE_MODEL },
      transitions: transitions16b,
      records: recordsX,
      overrides: [],
      policyReader: policyReaderX,
    }) as unknown as Record<string, any>
  } catch (err) {
    x16bThrew = String(err)
  }

  return {
    dirs,
    worlds,
    aSchemaVersion: Number(projA['schemaVersion']),
    aMemberCount,
    aWorkerEc: ecOf(projA, WORKER_A),
    aFixtureEc: ecOf(projA, FIXTURE_A),
    bAdmitRecordId: bAdmit.recordId,
    bAdmitKind: String(bAdmit.kind),
    bAdmitOrigin: bAdmit.origin !== undefined ? String(bAdmit.origin) : '',
    bAdmitGeneration: bAdmit.generation,
    bEc1,
    bSetCode: remoteCode(bSet),
    bSetEntryId: String(bTransition['entryId']),
    bSetOrigin: String(bTransition['origin']),
    bSetRequestedAtStep: Number(bTransition['requestedAtStep']),
    bSetEffectiveFromStep: Number(bTransition['effectiveFromStep']),
    bGetOk: bGet.ok === true,
    bGetStateId: String(bGetState['stateId']),
    bGetToolsLocked: bGetToolsCell !== undefined && bGetToolsCell['locked'] === true,
    bGetToolsHasValueKey: bGetToolsCell !== undefined && 'value' in bGetToolsCell,
    bProjPolicyState2: String((projB2['root'] as Record<string, any>)['policyState']),
    bEc2,
    bOverrideCode: remoteCode(bOverride),
    bOverrideRecordId: String(bOverrideData['recordId']),
    bOverrideKind: String(bOverrideData['kind']),
    bEc3,
    cEc0,
    cSetCode: remoteCode(cSet),
    cEc1,
    cPermissionsKeys: Object.keys(cEc1['permissions'] as Record<string, unknown>).sort(),
    dEc0,
    dSetCode: remoteCode(dSet),
    dEc1,
    dPermissionsKeys: Object.keys(dEc1['permissions'] as Record<string, unknown>).sort(),
    eSetCode: remoteCode(eSet),
    eEc1,
    ePermissionsKeys: Object.keys(eEc1['permissions'] as Record<string, unknown>).sort(),
    x16aThrew,
    x16aEc,
    x16bThrew,
    x16bEc,
    closeThrewA,
    closeThrewB,
    closeThrewC,
    closeThrewD,
    closeThrewE,
  }
})()

// --- the assertions (sync it() bodies over the captured state) -------------------------

describe('p8s7r2-effective-config: the R2-2 resolved effective-config view (BQ-08, projection v2)', () => {
  // --- World A — the baseline ---------------------------------------------------------

  it('R22.1 F01: the baseline model lane reports the inherited world baseline (state: inherited)', () => {
    expect(r22.aWorkerEc['model']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
  })

  it('R22.2 F02: the baseline autonomy lane is the neutral inherited default (state: inherited)', () => {
    expect(r22.aWorkerEc['autonomy']).toEqual({
      value: null,
      source: 'autonomy-overlay',
      state: 'inherited',
    })
  })

  it('R22.3 F11: a RUNNING seeded worker workspace is locked at the instance-creation source (state: locked)', () => {
    expect(r22.aWorkerEc['workspace']).toEqual({
      value: WORKSPACE_A,
      source: 'instance-creation',
      state: 'locked',
      locked: true,
    })
  })

  it('R22.4 F11: a CREATED member with no own workspace inherits the team default unlocked (state: inherited, locked ABSENT)', () => {
    expect(r22.aFixtureEc['workspace']).toEqual({
      value: WORKSPACE_A,
      source: 'blueprint',
      state: 'inherited',
    })
  })

  it('R22.5 F03: blueprint-silent capability cells close the permissions map to the empty record', () => {
    expect(r22.aWorkerEc['permissions']).toEqual({})
    expect(r22.aFixtureEc['permissions']).toEqual({})
  })

  it('R22.5b L11: the production projection stamps schemaVersion 2 (the additive v2 projection family)', () => {
    expect(r22.aSchemaVersion).toBe(2)
    // Leader + the seeded worker + the fixture member.
    expect(r22.aMemberCount).toBe(3)
  })

  // --- World B — the governance overlay, the locked state, the human override ----------

  it('R22.6 H04: the leader governance deny overlay surfaces as pending-next-boundary autonomy (state: pending-next-boundary, no effectiveFrom)', () => {
    expect(r22.bAdmitKind).toBe('autonomy-overlay')
    expect(r22.bAdmitOrigin).toBe('leader')
    expect(r22.bAdmitGeneration).toBe(1)
    expect(r22.bEc1['autonomy']).toEqual({
      value: 'tools: deny',
      source: 'autonomy-overlay',
      state: 'pending-next-boundary',
    })
    // The deny floor produces no permission items; the model lane is untouched.
    expect(r22.bEc1['permissions']).toEqual({})
    expect(r22.bEc1['model']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
  })

  it('R22.7 H03: the durable locked policy-state cell is surfaced (remote + projection) and tightens nothing over a deny floor (production suppression residual)', () => {
    expect(r22.bSetCode).toBe(null)
    // The production mutation service mints ledger entry ids with its
    // default id source (no custom newRecordId is bound at the root).
    expect(r22.bSetEntryId.startsWith('p7t2-ledger-')).toBe(true)
    expect(r22.bSetOrigin).toBe('human')
    // The production step clock is pinned to 0: the future-boundary ruling.
    expect(r22.bSetRequestedAtStep).toBe(0)
    expect(r22.bSetEffectiveFromStep).toBe(1)
    // The lock is durable and surfaced on the remote state view.
    expect(r22.bGetOk).toBe(true)
    expect(r22.bGetStateId).toBe(STRICT_STATE_ID)
    expect(r22.bGetToolsLocked).toBe(true)
    expect(r22.bGetToolsHasValueKey).toBe(false)
    // The projection agrees on the active state.
    expect(r22.bProjPolicyState2).toBe(STRICT_STATE_ID)
    // Honest production semantics: a lock over a capability whose only
    // overlay is a deny floor tightens nothing — the view is byte-equal to
    // the pre-lock capture (suppressed is production-unreachable: the
    // production envelope is empty, so no overlay allow survives stage 1;
    // see the file-header residual and R22.16b).
    expect(r22.bEc2).toEqual(r22.bEc1)
  })

  it('R22.8 H04/H09: the human model override surfaces as pending-next-boundary on model AND autonomy (state: pending-next-boundary, no effectiveFrom)', () => {
    expect(r22.bOverrideCode).toBe(null)
    expect(r22.bOverrideKind).toBe('human-override')
    // The remote override.set mints the recordId server-side (s6-remote):
    // ovr-<capability>-<team|instanceId>-g<winnerGeneration>.
    expect(r22.bOverrideRecordId).toBe('ovr-model-team-g0')
    expect(r22.bEc3['model']).toEqual({
      value: 'p8s7r2e-next/model-v2',
      source: 'explicit-human-override',
      state: 'pending-next-boundary',
    })
    expect(r22.bEc3['autonomy']).toEqual({
      value: 'model: allow p8s7r2e-next/model-v2',
      source: 'explicit-human-override',
      state: 'pending-next-boundary',
    })
  })

  // --- World C — the external hard deny ---------------------------------------------------

  it('R22.10 H04: the blueprint deny surfaces as a denied model with team:deny:blueprint:static provenance (state: denied)', () => {
    expect(r22.cEc0['model']).toEqual({
      value: null,
      source: 'blueprint',
      state: 'denied',
      deniedBy: 'team:deny:blueprint:static',
    })
    expect(r22.cSetCode).toBe(null)
  })

  it('R22.11 H04/H12: the external hard deny surfaces the policy-state item as denied with external:hard-deny provenance (state: denied)', () => {
    expect(r22.cEc1['permissions']).toEqual({
      'send-message': {
        value: 'send-message',
        source: 'external-hard-policy',
        state: 'denied',
        deniedBy: 'external:hard-deny',
      },
    })
    expect(r22.cPermissionsKeys).toEqual(['send-message'])
    // The model denial is unchanged by the tools transition.
    expect(r22.cEc1['model']).toEqual(r22.cEc0['model'])
  })

  // --- World D — the capability-missing lane ------------------------------------------------

  it('R22.12 G01: the capability-missing model surfaces as unavailable from the winning team layer (state: unavailable)', () => {
    // Before the transition the Team is silent on the model cell (the
    // blueprint's itemless `model: allow` is not expressible in the frozen
    // resolver input — validation rejects an itemless allow): an
    // unspecified cell short-circuits stage 2 before the capabilityExists
    // check, so the baseline consumer rule applies.
    expect(r22.dEc0['model']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
    // After the transition the policy-state layer grants a model item; the
    // stage-2 capability-missing stage removes it and the view reports
    // unavailable with the winning team layer's source.
    expect(r22.dSetCode).toBe(null)
    expect(r22.dEc1['model']).toEqual({
      value: null,
      source: 'policy-state',
      state: 'unavailable',
      unavailable: true,
    })
  })

  it('R22.13 G01/G05: the capability-missing permissions item surfaces as unavailable from the policy-state source (state: unavailable)', () => {
    expect(r22.dEc1['permissions']).toEqual({
      'web-tool': {
        value: 'web-tool',
        source: 'policy-state',
        state: 'unavailable',
        unavailable: true,
      },
    })
    expect(r22.dPermissionsKeys).toEqual(['web-tool'])
  })

  // --- World E — the hard-allow intersection --------------------------------------------------

  it('R22.14a G06: the hard-allow surviving item surfaces as overridden from the policy-state source (state: overridden)', () => {
    expect(r22.eSetCode).toBe(null)
    expect(r22.eEc1['permissions']['keep-item']).toEqual({
      value: 'keep-item',
      source: 'policy-state',
      state: 'overridden',
    })
  })

  it('R22.14b G06: the hard-allow removed item surfaces as denied with external:hard-removed provenance (state: denied)', () => {
    expect(r22.eEc1['permissions']['drop-item']).toEqual({
      value: 'drop-item',
      source: 'external-hard-policy',
      state: 'denied',
      deniedBy: 'external:hard-removed',
    })
    expect(r22.ePermissionsKeys).toEqual(['drop-item', 'keep-item'])
  })

  it('R22.15 G02: the policy-state model selection surfaces as overridden (state: overridden)', () => {
    expect(r22.eEc1['model']).toEqual({
      value: 'p8s7r2e-policy/model-v9',
      source: 'policy-state',
      state: 'overridden',
    })
  })

  // --- Direct resolver — the production-unreachable derivations --------------------------------

  it('R22.16a H12 (direct resolver): an overlapping mutation-record / governance-ref id materializes effectiveFrom (production-disjoint residual)', () => {
    expect(r22.x16aThrew).toBe(null)
    check(r22.x16aEc !== null, 'the R22.16a view was not captured')
    const view = r22.x16aEc
    expect(view['permissions']).toEqual({
      'direct-tool': {
        value: 'direct-tool',
        source: 'autonomy-overlay',
        state: 'pending-next-boundary',
        effectiveFrom: 6,
      },
    })
    expect(view['autonomy']).toEqual({
      value: 'tools: allow direct-tool',
      source: 'autonomy-overlay',
      state: 'pending-next-boundary',
      effectiveFrom: 6,
    })
    expect(view['model']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
    expect(view['workspace']).toEqual({
      value: WORKSPACE_X,
      source: 'blueprint',
      state: 'locked',
      locked: true,
    })
  })

  it('R22.16b H03 (direct resolver): the locked cell suppresses the in-envelope overlay allow (state: suppressed; production-empty-envelope residual)', () => {
    expect(r22.x16bThrew).toBe(null)
    check(r22.x16bEc !== null, 'the R22.16b view was not captured')
    const view = r22.x16bEc
    expect(view['autonomy']).toEqual({
      value: 'tools: allow direct-tool',
      source: 'autonomy-overlay',
      state: 'suppressed',
      suppressed: true,
    })
    // The suppressed overlay yields no candidate: the cell fails closed and
    // the permissions map stays empty (the deny floor, not the allow items).
    expect(view['permissions']).toEqual({})
    expect(view['model']).toEqual({
      value: BASELINE_MODEL_VALUE,
      source: 'capability',
      state: 'inherited',
    })
  })

  // --- Reversibility -------------------------------------------------------------------------

  it('the R2-2 worlds are disposed (close + stop semantics)', () => {
    expect(r22.closeThrewA).toBe(null)
    expect(r22.closeThrewB).toBe(null)
    expect(r22.closeThrewC).toBe(null)
    expect(r22.closeThrewD).toBe(null)
    expect(r22.closeThrewE).toBe(null)
    r22.worlds.forEach((world) => {
      world.effectDisposers.forEach((dispose) => dispose())
      world.effectDisposers.length = 0
    })
    r22.dirs.forEach((d) => destroyDir(d))
    expect(true).toBe(true)
  })
})
