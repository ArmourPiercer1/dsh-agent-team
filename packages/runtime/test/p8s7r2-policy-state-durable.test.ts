/**
 * p8s7r2-policy-state-durable.test.ts — R2-1 (P8-S7-R2): the production
 * PolicyState lane is DURABLE (plan §21 BQ-10; repairs C07, H01, H02, H03).
 *
 * The S5A root wired a process-local MutationStore: an admitted
 * `policyState.set` (A31) died with the process, and a FRESH boot of the
 * same TeamDomain reported the constant `default` state while the remote
 * `policyState.get` and the projection disagreed about the truth. R2-1
 * wires the production root through the durable-lane wrapper
 * (`src/plugin/durable-mutation-store.js`): the transition fact is written
 * to the existing storage `ledger` repository, the boot preloads the
 * durable rows into the synchronous cache, and the close flushes the
 * scheduled writes.
 *
 * This suite drives the PRODUCTION entry (`../src/plugin/host.js` apply)
 * twice over one scratch dir — the create world admits the transition, the
 * resume world proves the durability:
 *
 *   - R2.1 — the fresh world reports `default` on the projection AND the
 *            remote surface before any transition (no invented state);
 *   - R2.2 — the admission writes the durable ledger fact (verified
 *            against the reopened storage store, the C1 store-direct check);
 *   - R2.3 — the FRESH root boot reports the active state (`strict`, not
 *            `default`) with three-way agreement: remote `policyState.get`
 *            == projection `root.policyState` == the mutation store's own
 *            transition view at the maximum horizon;
 *   - R2.4 — the BQ-10 surface: `availableTransitions` is the bound
 *            blueprint's closed state set minus the current state
 *            (declaration order; the self-transition is not advertised);
 *            no impact preview key is invented (the backend provides no
 *            preview surface — adjudication documented in S7R2-result.md);
 *   - R2.5 — the A31 rejection semantics are unchanged: an out-of-closed-set
 *            target still fails `TEAM_REMOTE_POLICY_STATE_UNKNOWN` and a
 *            member actor still fails `UNAUTHORIZED_TRANSITION` (invariant
 *            40), both before AND after the R2-1 wiring;
 *   - R2.6 — the projection's ledger summary counts the new fact under the
 *            frozen `policy` category (the `FACT_TYPE_CATEGORY` learning is
 *            proven live: an unmapped factType would fail closed with
 *            `LEDGER_CATEGORY_UNKNOWN`);
 *   - R2.7 — the resume boot does not duplicate the durable row (the
 *            preload dedupes by entryId; the boot performs no rewrite).
 *
 * Runner note: the plain-node shim forbids async `it()` bodies — every
 * scenario drives the production entry at MODULE TOP LEVEL (like P8-S5A /
 * P8-S6) and the `it()` blocks assert the captured state synchronously.
 * @module @dsh-agent-team/runtime/test/p8s7r2-policy-state-durable
 */

import { describe, expect, it } from 'vitest'
import { parseRootSessionId } from '../../contracts/src/index.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import { activePolicyState } from '../policy-adapter.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the R2-1 fixture world ---------------------------------------------------------

/** The R2-1 root session id (distinct from every other phase fixture). */
const ROOT_SID = 'session-p8s7r2root'
/** The R2-1 seeded worker (the A31 member-actor rejection target). */
const SEED_WORKER_ID = 'inst-p8s7r2seedw1'
/** The second declared state (the closed set is default + strict). */
const STRICT_STATE_ID = 'strict'

/**
 * The R2-1 blueprint: the P8S5A structure with the own id and TWO declared
 * policy states (the closed transition set the BQ-10 surface derives).
 */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P8S7R2-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P8S7R2 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P8S7R2 work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P8S7R2 team.',
  '    contextPolicy: fresh_per_delegation',
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
  '  - templateId: scout',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P8S7R2 default state.',
  '  - id: strict',
  '    description: The P8S7R2 strict state.',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

/** The R2-1 row config (the entry's ONLY input channel). */
function rowConfig(bootPhase: 'create' | 'resume') {
  return {
    bootPhase,
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/p8s7r2',
    seedMembers: [
      {
        instanceId: SEED_WORKER_ID,
        templateId: 'worker',
        label: 'r21-seed-worker',
        childSessionId: 'session-child-p8s7r2seedw1',
      },
      {
        instanceId: 'inst-p8s7r2seeds1',
        templateId: 'scout',
        label: 'r21-seed-scout',
        childSessionId: 'session-child-p8s7r2seeds1',
      },
    ],
    staticModel: { provider: 'p8s7r2-static', model: 'p8s7r2-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
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
function makeWorld(seam: FileStorageSeam): TestWorld {
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
  if (!condition) throw new Error(`R2-1 scenario guard: ${label}`)
}

/** Apply the production entry over one world (p8s5a pattern). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
async function applyWorld(world: TestWorld, config: Record<string, any>) {
  const host = await loadHost()
  await host.apply(world.ctx, config)
  const teamRoot: TeamRootFacade = world.provided.teamRoot
  check(teamRoot !== undefined, 'apply resolved but never provided teamRoot')
  const root = await teamRoot.ready
  return { host, teamRoot, root }
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
  const registration = root.seams.remoteHandlerRegistration.current()
  check(registration !== null, 'the remote handler registration seam is empty')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  let captured: ((endpoint: string, payload: unknown) => Promise<Record<string, any>>) | null =
    null
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

/** The stable `code` of a thrown typed error (null when nothing threw). */
function captureCode(fn: () => unknown): string | null {
  try {
    fn()
    return null
  } catch (err) {
    if (err !== null && typeof err === 'object' && 'code' in err) {
      const code = (err as { code?: unknown }).code
      return typeof code === 'string' ? code : `untyped:${String(err)}`
    }
    return `untyped:${String(err)}`
  }
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
  if (value === null || typeof value !== 'object') throw new Error('R2-1: no value in response')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const data = (value as Record<string, any>)['data']
  if (data === null || typeof data !== 'object') throw new Error('R2-1: no data in value')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  return data as Record<string, any>
}

/**
 * Read the `policyState.get` view record — the dispatcher nests the
 * PolicyStateView under `data.state` (s6-remote, the BQ-10 surface):
 * `{ state: { stateId, availableTransitions } }`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function remoteState(response: Record<string, any>): Record<string, any> {
  const data = remoteData(response)
  const state = data['state']
  if (state === null || typeof state !== 'object') throw new Error('R2-1: no state in data')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  return state as Record<string, any>
}

// --- the scenario (module top level — the sync shim forbids async it()) ---------------

interface R21State {
  dir: string
  createWorld: TestWorld
  resumeWorld: TestWorld
  // Phase A — the create world
  projBeforePolicyState: string
  projBeforeSchemaVersion: number
  projBeforeLedgerPolicy: number
  projBeforeTotalEntries: number
  remoteBeforeOk: boolean
  remoteBeforeStateId: string
  remoteBeforeTransitions: string[]
  remoteBeforeHasPreviewKey: boolean
  transitionEntryId: string
  transitionOrigin: string
  transitionStateId: string
  transitionRequestedAtStep: number
  transitionEffectiveFromStep: number
  projAfterPolicyState: string
  remoteAfterOk: boolean
  remoteAfterStateId: string
  remoteAfterTransitions: string[]
  unknownSetOk: boolean
  unknownSetCode: string
  memberSetOk: boolean
  memberSetCode: string
  createCloseThrew: string | null
  // Phase B — the resume world (the durability proof)
  durableRowCount: number
  durableRowFactType: string
  durableRowSchemaVersion: number
  durableRowRootSessionId: string
  durableRowPayloadEntryId: string
  durableRowPayloadOrigin: string
  durableRowPayloadStateId: string
  durableRowPayloadRequestedAtStep: number
  durableRowPayloadEffectiveFromStep: number
  durableRowCreatedAtIsString: boolean
  projFreshPolicyState: string
  projFreshLedgerPolicy: number
  projFreshTotalEntries: number
  remoteFreshOk: boolean
  remoteFreshStateId: string
  remoteFreshTransitions: string[]
  storeThreeWayStateId: string
  resumeMemberActorCode: string
  resumeCloseThrew: string | null
}

const r21: R21State = await (async (): Promise<R21State> => {
  const dir = scratchDir('p8s7r2-policystate')
  destroyDir(dir) // idempotent start-state: an aborted prior run may have left a stamped domain
  const seam = new FileStorageSeam(dir)

  // --- Phase A — the create world: default, admission, A31, flush ------------------
  const createWorld = makeWorld(seam)
  const { root: createRoot } = await applyWorld(createWorld, rowConfig('create'))
  const callA = attachRemoteCaller(createRoot)

  const projBefore = createRoot.projection.project(parseRootSessionId(ROOT_SID))
  const remoteBefore = await callA('policyState.get', { teamSessionId: ROOT_SID })

  const transition = createRoot.mutation.service.switchPolicyState({
    teamSessionId: ROOT_SID,
    target: { stateId: STRICT_STATE_ID },
    actor: { kind: 'human' },
  })

  const projAfter = createRoot.projection.project(parseRootSessionId(ROOT_SID))
  const remoteAfter = await callA('policyState.get', { teamSessionId: ROOT_SID })

  // A31 — the rejection semantics (out-of-closed-set target, member actor).
  const unknownSet = await callA('policyState.set', {
    teamSessionId: ROOT_SID,
    target: { stateId: 'nonexistent-state' },
    actor: { kind: 'human' },
  })
  const memberSet = await callA('policyState.set', {
    teamSessionId: ROOT_SID,
    target: { stateId: 'default' },
    actor: { kind: 'member', member: { rootSessionId: ROOT_SID, instanceId: SEED_WORKER_ID } },
  })

  let createCloseThrew: string | null = null
  try {
    await createRoot.close() // the R2-1 flush: the durable write completes here
  } catch (err) {
    createCloseThrew = String(err)
  }

  // --- Phase B — the resume world: the durable truth --------------------------------
  const resumeWorld = makeWorld(seam)
  const { root: resumeRoot } = await applyWorld(resumeWorld, rowConfig('resume'))
  const callB = attachRemoteCaller(resumeRoot)

  // C1 store-direct check: the reopened storage ledger carries the fact row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const entries = resumeRoot.domain.repositories.ledger.list() as Array<Record<string, any>>
  const factRows = entries.filter(
    (entry) =>
      String(entry['rootSessionId']) === ROOT_SID &&
      String(entry['factType']) === 'policy-state-transitioned',
  )
  const factRow = factRows[0]
  if (factRow === undefined) {
    throw new Error('the reopened store never received the transition fact')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const payload = factRow['payload'] as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const factState = payload['state'] as Record<string, any>

  const projFresh = resumeRoot.projection.project(parseRootSessionId(ROOT_SID))
  const remoteFresh = await callB('policyState.get', { teamSessionId: ROOT_SID })

  // Three-way agreement: remote == projection == the store's own view.
  const storeThreeWayStateId = activePolicyState(
    resumeRoot.mutation.store.listTransitions(ROOT_SID),
    Number.MAX_SAFE_INTEGER,
  ).stateId

  // A31 still enforced after the R2-1 wiring (service-level, sync throw).
  const resumeMemberActorCodeRaw = captureCode(() =>
    resumeRoot.mutation.service.switchPolicyState({
      teamSessionId: ROOT_SID,
      target: { stateId: 'default' },
      actor: { kind: 'member', member: { rootSessionId: ROOT_SID, instanceId: SEED_WORKER_ID } },
    }),
  )
  if (resumeMemberActorCodeRaw === null) {
    throw new Error('the member-actor switch did not throw a typed code')
  }
  const resumeMemberActorCode = resumeMemberActorCodeRaw

  let resumeCloseThrew: string | null = null
  try {
    await resumeRoot.close()
  } catch (err) {
    resumeCloseThrew = String(err)
  }

  return {
    dir,
    createWorld,
    resumeWorld,
    projBeforePolicyState: String(projBefore.root.policyState),
    projBeforeSchemaVersion: Number(projBefore.schemaVersion),
    projBeforeLedgerPolicy: Number(projBefore.ledger.byCategory.policy),
    projBeforeTotalEntries: Number(projBefore.ledger.totalEntries),
    remoteBeforeOk: remoteBefore.ok === true,
    remoteBeforeStateId: remoteBefore.ok === true ? String(remoteState(remoteBefore)['stateId']) : '<error>',
    remoteBeforeTransitions:
      remoteBefore.ok === true
        ? (remoteState(remoteBefore)['availableTransitions'] as unknown as string[])
        : [],
    remoteBeforeHasPreviewKey:
      remoteBefore.ok === true
        ? Object.prototype.hasOwnProperty.call(remoteState(remoteBefore), 'impactPreview')
        : false,
    transitionEntryId: String(transition.entryId),
    transitionOrigin: String(transition.origin),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    transitionStateId: String((transition.state as Record<string, any>)['stateId']),
    transitionRequestedAtStep: Number(transition.requestedAtStep),
    transitionEffectiveFromStep: Number(transition.effectiveFromStep),
    projAfterPolicyState: String(projAfter.root.policyState),
    remoteAfterOk: remoteAfter.ok === true,
    remoteAfterStateId: remoteAfter.ok === true ? String(remoteState(remoteAfter)['stateId']) : '<error>',
    remoteAfterTransitions:
      remoteAfter.ok === true
        ? (remoteState(remoteAfter)['availableTransitions'] as unknown as string[])
        : [],
    unknownSetOk: unknownSet.ok === true,
    unknownSetCode: remoteCode(unknownSet) ?? '<ok>',
    memberSetOk: memberSet.ok === true,
    memberSetCode: remoteCode(memberSet) ?? '<ok>',
    createCloseThrew,
    durableRowCount: factRows.length,
    durableRowFactType: String(factRow['factType']),
    durableRowSchemaVersion: Number(factRow['schemaVersion']),
    durableRowRootSessionId: String(factRow['rootSessionId']),
    durableRowPayloadEntryId: String(payload['entryId']),
    durableRowPayloadOrigin: String(payload['origin']),
    durableRowPayloadStateId: String(factState['stateId']),
    durableRowPayloadRequestedAtStep: Number(payload['requestedAtStep']),
    durableRowPayloadEffectiveFromStep: Number(payload['effectiveFromStep']),
    durableRowCreatedAtIsString: typeof factRow['createdAt'] === 'string',
    projFreshPolicyState: String(projFresh.root.policyState),
    projFreshLedgerPolicy: Number(projFresh.ledger.byCategory.policy),
    projFreshTotalEntries: Number(projFresh.ledger.totalEntries),
    remoteFreshOk: remoteFresh.ok === true,
    remoteFreshStateId: remoteFresh.ok === true ? String(remoteState(remoteFresh)['stateId']) : '<error>',
    remoteFreshTransitions:
      remoteFresh.ok === true
        ? (remoteState(remoteFresh)['availableTransitions'] as unknown as string[])
        : [],
    storeThreeWayStateId,
    resumeMemberActorCode,
    resumeCloseThrew,
  }
})()

// --- the assertions (sync it() over the captured state) --------------------------------

describe('R2-1 the production PolicyState lane is durable (BQ-10, C07/H01/H02/H03)', () => {
  it('R2.1 a fresh world reports the default state on every surface before any transition', () => {
    expect(r21.projBeforePolicyState).toBe('default')
    // R2-2 premise update (S7-R2, this task): the production projection is now
    // stamped schemaVersion 2 (the additive v2 projection track). The durable
    // fact row below keeps its own v1 row track.
    expect(r21.projBeforeSchemaVersion).toBe(2)
    expect(r21.projBeforeLedgerPolicy).toBe(0)
    expect(r21.projBeforeTotalEntries).toBe(0)
    expect(r21.remoteBeforeOk).toBe(true)
    expect(r21.remoteBeforeStateId).toBe('default')
    // No transition, no preview: the surface carries no invented impact data.
    expect(r21.remoteBeforeHasPreviewKey).toBe(false)
  })

  it('R2.2 the admission writes the durable ledger fact (the C1 store-direct check)', () => {
    // The admission itself (the production step clock is pinned to 0).
    expect(r21.transitionOrigin).toBe('human')
    expect(r21.transitionStateId).toBe(STRICT_STATE_ID)
    expect(r21.transitionEntryId.length).toBeGreaterThan(0)
    expect(r21.transitionRequestedAtStep).toBe(0)
    expect(r21.transitionEffectiveFromStep).toBe(1)
    // The reopened storage store carries EXACTLY ONE durable fact row,
    // stamped with this root, the lane's fact type, the v1 domain schema.
    expect(r21.durableRowCount).toBe(1)
    expect(r21.durableRowFactType).toBe('policy-state-transitioned')
    expect(r21.durableRowSchemaVersion).toBe(1)
    expect(r21.durableRowRootSessionId).toBe(ROOT_SID)
    expect(r21.durableRowCreatedAtIsString).toBe(true)
    // The payload mirrors the admitted transition record verbatim.
    expect(r21.durableRowPayloadEntryId).toBe(r21.transitionEntryId)
    expect(r21.durableRowPayloadOrigin).toBe('human')
    expect(r21.durableRowPayloadStateId).toBe(STRICT_STATE_ID)
    expect(r21.durableRowPayloadRequestedAtStep).toBe(0)
    expect(r21.durableRowPayloadEffectiveFromStep).toBe(1)
  })

  it('R2.3 a fresh root boot reports the active state with three-way agreement (not default)', () => {
    // The in-process surfaces agreed immediately after the admission...
    expect(r21.projAfterPolicyState).toBe(STRICT_STATE_ID)
    expect(r21.remoteAfterOk).toBe(true)
    expect(r21.remoteAfterStateId).toBe(STRICT_STATE_ID)
    expect(r21.createCloseThrew).toBe(null)
    // ...and the FRESH boot of the same TeamDomain still reports it: the
    // projection reads the durable rows preloaded at boot, not the constant.
    expect(r21.projFreshPolicyState).toBe(STRICT_STATE_ID)
    expect(r21.remoteFreshOk).toBe(true)
    expect(r21.remoteFreshStateId).toBe(STRICT_STATE_ID)
    // Three-way agreement: remote == projection == the mutation store view
    // at the maximum horizon (the documented shared read horizon).
    expect(r21.remoteFreshStateId).toBe(r21.projFreshPolicyState)
    expect(r21.storeThreeWayStateId).toBe(r21.projFreshPolicyState)
  })

  it('R2.4 the BQ-10 surface advertises the closed set minus the current state (no preview invented)', () => {
    // Closed set {default, strict}: before — everything but default;
    // after — everything but strict (declaration order preserved).
    expect(r21.remoteBeforeTransitions).toEqual([STRICT_STATE_ID])
    expect(r21.remoteAfterTransitions).toEqual(['default'])
    // The resumed world advertises the same closed set against its durable state.
    expect(r21.remoteFreshTransitions).toEqual(['default'])
  })

  it('R2.5 the A31 rejection semantics are unchanged (unknown state / member actor)', () => {
    expect(r21.unknownSetOk).toBe(false)
    expect(r21.unknownSetCode).toBe('TEAM_REMOTE_POLICY_STATE_UNKNOWN')
    expect(r21.memberSetOk).toBe(false)
    expect(r21.memberSetCode).toBe('UNAUTHORIZED_TRANSITION')
    // And the service-level enforcement survives the R2-1 wiring on the
    // resumed root (invariant 40, synchronous throw).
    expect(r21.resumeMemberActorCode).toBe('UNAUTHORIZED_TRANSITION')
  })

  it('R2.6 the projection ledger summary counts the fact under the frozen policy category', () => {
    // An unmapped factType would fail closed (LEDGER_CATEGORY_UNKNOWN) —
    // the projection succeeding with the count IS the learning proof.
    expect(r21.projFreshLedgerPolicy).toBe(1)
    expect(r21.projFreshTotalEntries).toBe(1)
  })

  it('R2.7 the resume boot does not duplicate the durable row and the world closes cleanly', () => {
    // Re-verified after the full resume lifecycle (preload dedupes by
    // entryId; the boot performs no rewrite).
    expect(r21.durableRowCount).toBe(1)
    expect(r21.resumeCloseThrew).toBe(null)
  })
})

// --- teardown --------------------------------------------------------------------------

describe('p8s7r2-policy-state-durable teardown', () => {
  it('the R2-1 worlds are disposed (stop semantics)', () => {
    r21.createWorld.effectDisposers.forEach((dispose) => dispose())
    r21.createWorld.effectDisposers.length = 0
    r21.resumeWorld.effectDisposers.forEach((dispose) => dispose())
    r21.resumeWorld.effectDisposers.length = 0
    destroyDir(r21.dir)
    expect(true).toBe(true)
  })
})
