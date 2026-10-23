/**
 * A5M2 B-SCHEDULE PRODUCTION REACHABILITY (root 18:11 continuation).
 *
 * THE DELIVERY CLAIM (worded exactly as authorized): on the mount built here,
 * B-SCHEDULE list/delete MOUNT + REGISTRATION + CONSUMPTION are WIRED; the
 * durable Control GRAMMAR GATE IS CLOSED pending root's signed target-
 * structure delta — every requires-approval claim falls closed with the exact
 * unregistered-family refusal. Nothing here claims the family is wired end to
 * end.
 *
 * WHAT MAKES THIS PRODUCTION (and not another admit-double seat): the plane
 * is the REAL assembly over REAL durable TeamDomain rows and a REAL
 * ControlService; admission rides the REAL paAdmit.open / paAdmit.edge legs,
 * whose success branch carries the ONE consumeForExecution witness the row
 * demands as `consumedProof`; the placement moment binds the REAL
 * definitionIdentityOf of the def the plane actually placed; and (root
 * 18:52, 不绕adapter) the arm's execute IS the adapter row's own
 * `delegate(plan, { exec })` — the FULL signed same-plan execution boundary
 * (edgeIntegrity: drain / CURRENT native face + execute / CURRENT service +
 * method identities; NOT_OWN_PLAN; fresh re-classify + PLAN_STALE; the
 * ALREADY_DISPATCHED plan-object memo; the owner REFERENCE law; the abort
 * law; the frozen port call; the L6 mirror). Native fidelity (保真native)
 * rides INSIDE that boundary: the production port is the NATIVE DISPATCH
 * port — its list/delete forwards run the BOUND `registerScheduleTools`
 * faces with the owner exec, so the host closure remains the final body
 * (its per-call `rootCtx.schedule` read, its `exec.agent !== agent`
 * REFERENCE law and its operationError mirror against the SAME module
 * identity of `ScheduleInputError` all still run) BEHIND every adapter
 * check. Drift is anchored on host-visible state: the glue re-derives the
 * port from the live native pair, so a host re-registration answers a
 * DIFFERENT port object and the signed drift legs refuse with zero
 * dispatch — a dynamic replacement never executes (不绕批准).
 *
 * create/update: never mounted, never registered, never armable (the closed
 * inject key set refuses even a test that tries). The trigger gap stays open.
 *
 * DISCLOSED STAND-INS (never claimed as production): the schedule SERVICE
 * behind the fake rootCtx (the real ScheduleService's persistence order and
 * timer legs are the adapter's named gaps), the durable TeamDomain/Control
 * world itself, and the policy fixtures.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findTestRepoRoot, homeRoot } from '../../../tests/paths.mjs'
import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import { createBlueprintCatalog, parseBlueprint } from '../../domain/blueprint/src/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import { parseRequestedEffectSet, parseToolBinding } from '../../domain/tool-governance/src/index.js'
import type { ToolBinding } from '../../domain/tool-governance/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { createControlService } from '../control/index.js'
import type { ControlService } from '../control/index.js'
import type { PaCallFactsCeilingSlot } from '../control/types.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { definitionIdentityOf, untestedAssurance } from '../tool-dispatch/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { AdmissionRequest, RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { createPaControlLeg, createPaEffectsVerifier } from '../operation-permission/pa-control-bridge.js'
import type { PaControlLegInput, PaEffectsVerifierDeps } from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import { P6T4_BLUEPRINT_SOURCE, P6T4_NOW, P6T4_ROOT, memberCaller, p6t4Seed } from './p6t4-helpers.js'
// THE production module identity: the SAME published package agent-bindings
// imports. registerScheduleTools mints the native faces; ScheduleInputError
// is the ONE class identity the native bodies throw and the arm mirrors.
import { ScheduleInputError, registerScheduleTools } from '@deepseek-ai/dsh-schedule'
import {
  createGovernedScheduleArm,
  createScheduleNativeDispatchPort,
  createScheduleWiring,
} from '../src/plugin/live/governed-families/schedule-wiring.mjs'
import { A5_B_SCHEDULE_ADAPTER_REVISION } from '../src/plugin/live/governed-families/schedule-adapters.mjs'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-schedule-production: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-schedule-production-${STAMP}`)
afterAll(() => { rmSync(WORLD_ROOT, { recursive: true, force: true }) })

let worldSeq = 0
function worldDir(label: string): string {
  const dir = join(WORLD_ROOT, `${String(++worldSeq)}-${label}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

// ── the ONE durable world (real TeamDomain rows + real ControlService) ────
const CHAIN_WORLD = worldDir('chain')
const seam = new FileStorageSeam(CHAIN_WORLD)
const domain = await createTeamDomain(seam)
const blueprint = parseBlueprint(P6T4_BLUEPRINT_SOURCE)
const catalog = createBlueprintCatalog([blueprint])
const repos = domain.repositories
await repos.teamSessions.put({
  rootSessionId: P6T1_FIXTURE.rootSessionId,
  blueprint: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId(String(blueprint.blueprintId)),
    revision: parseBlueprintRevision(String(blueprint.revision)),
    contentHash: parseBlueprintContentHash(String(blueprint.contentHash)),
  }),
  defaultWorkspace: P6T1_FIXTURE.defaultWorkspace,
  createdAt: P6T1_FIXTURE.createdAt,
  generation: 1,
})
await repos.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: P6T1_FIXTURE.rootSessionId })
const WORKER = String(p6t4Seed('worker').instanceId)
for (const name of ['leader', 'worker'] as const) {
  const seed = p6t4Seed(name)
  await repos.memberInstances.put({
    rootSessionId: P6T1_FIXTURE.rootSessionId,
    instanceId: parseInstanceId(String(seed.instanceId)),
    templateId: parseTemplateId(String(seed.templateId)),
    label: String(seed.label),
    childSessionId: parseChildSessionId(String(seed.childSessionId)),
    lifecycle: 'RUNNING',
    createdAt: P6T1_FIXTURE.createdAt,
    activityVersion: 1,
  })
}

const SCHEDULE_TPL = 'a5m2-schedule-production-tpl'
const PROVIDER = 'a5m2-wire-lane'
// MEASURED GRAMMAR FACT (this round, pinned by SP-R13): the policy
// projection's rule vocabulary is the CORE tool-name set
// (`rule <lane>[i].tool must be one of read | read_image | write | edit | lsp
// | bash | pwsh`) — a per-tool `schedule_*` rule is refused at plane build.
// That is part of the same CLOSED grammar state root must sign (rule
// vocabulary + target structure), so the production legs run on DEFAULT-lane
// policies, which is also the honest current production config: default allow
// = the allow lane; default ask = every call asks (the grammar refusal then
// falls closed). The refusal itself is pinned, never hidden.
const DIRECT_POLICY: TemplatePermissionPolicy = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })

const EMPTY_DOCS: AuthorityEnvelopeDocuments = Object.freeze({
  teamHardEnvelope: Object.freeze({ rules: [] }),
  permissionMutationEnvelope: Object.freeze({ status: 'absent' as const }),
})
function factSlot(slot: unknown): PaCallFactsCeilingSlot | undefined {
  if (slot === null || typeof slot !== 'object') return undefined
  if ('status' in (slot as Record<string, unknown>) && (slot as { status?: string }).status === 'unavailable') return undefined
  return slot as PaCallFactsCeilingSlot
}

const registryModule = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  A5_GOVERNED_FAMILIES: Record<string, { familyId: string; adapterRevision: number; providerIdentity: string }>
  registerA5GovernedFamily: (definitionIdentity: string, entry: { familyId: string; adapterRevision: number; providerIdentity: string }) => void
  a5GovernedFamilyFor: (definitionIdentity: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
}
const familyTable = registryModule.A5_GOVERNED_FAMILIES
const registerA5GovernedFamily = registryModule.registerA5GovernedFamily
const a5GovernedFamilyFor = registryModule.a5GovernedFamilyFor

interface RealmTruth { readonly assembly: ProductionAdmissionAssembly; plane?: PlaneValue }
const realmTruths = new Map<string, RealmTruth>()
const bindingFixtures = new Map<string, Map<string, ToolBinding>>()

function factsFromManifest(manifest: {
  realmId: string
  rootSessionId?: string
  member: { instanceId: string }
  callId: string
  parametersFingerprint: string
  effects: unknown
  binding: unknown
}): Record<string, unknown> | undefined {
  const truth = realmTruths.get(manifest.realmId)
  if (truth === undefined) return undefined
  if ((manifest.rootSessionId ?? P6T4_ROOT) !== P6T4_ROOT) return undefined
  const durable = repos.memberInstances.get(P6T4_ROOT, manifest.member.instanceId)
  if (durable === undefined) return undefined
  const binding = parseToolBinding(manifest.binding as never)
  if (!binding.ok) return undefined
  const effects = parseRequestedEffectSet(manifest.effects as never)
  if (!effects.ok) return undefined
  const hard = factSlot(EMPTY_DOCS.teamHardEnvelope)
  const mutation = factSlot(EMPTY_DOCS.permissionMutationEnvelope)
  if (hard === undefined || mutation === undefined) return undefined
  const family = a5GovernedFamilyFor(String(binding.value.definitionIdentity))
  return {
    policySource: { staticLayerRefs: [`${SCHEDULE_TPL}:directive-policy`], overlayGeneration: 0 },
    realmId: manifest.realmId,
    ceiling: { teamHardEnvelope: hard, permissionMutationEnvelope: mutation },
    policyDocument: truth.assembly.policyDocument(),
    denySources: truth.assembly.denySources(),
    effects: effects.value as RequestedEffectSet,
    member: { teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) },
    beneficiaryAuthority: 'member',
    binding: binding.value,
    blueprint: {
      revision: String(blueprint.revision),
      contentHash: String(blueprint.contentHash),
      templateId: SCHEDULE_TPL,
      cwd: CHAIN_WORLD,
      providerVersion: PROVIDER,
    },
    authorityGeneration: 0,
    ...(family === undefined ? {} : { governedFamily: family }),
  }
}

const verifierReadCallFacts: PaEffectsVerifierDeps['readCallFacts'] = async (input) => {
  const facts = factsFromManifest(input.manifest as never)
  if (facts === undefined) return undefined
  const truth = realmTruths.get(input.manifest.realmId)
  const request: AdmissionRequest = Object.freeze({
    binding: facts.binding as ToolBinding,
    member: facts.member as AdmissionRequest['member'],
    callId: input.manifest.callId,
    realmId: input.manifest.realmId,
    parametersFingerprint: input.manifest.parametersFingerprint,
    requestedEffects: facts.effects as RequestedEffectSet,
  })
  const livePlan = truth?.assembly.planApproval(request)
  if (livePlan === undefined || !livePlan.ok) return undefined
  return {
    ...facts,
    planSnapshot: {
      approvalCaseId: livePlan.value.approvalCaseId,
      effectSetFingerprint: livePlan.value.effectSetFingerprint,
      perEffectRequired: livePlan.value.perEffectRequired,
    },
  } as never
}
const paVerifier = createPaEffectsVerifier({ readCallFacts: verifierReadCallFacts })
const service: ControlService = createControlService({
  teamDomain: domain,
  blueprintCatalog: catalog,
  externalPolicyFacts: async () => makeExternalPolicyFacts(),
  now: () => P6T4_NOW,
  waitPollIntervalMs: 5,
  paEffectsVerifier: paVerifier,
})

// ── the plane under test (dynamic import: the lane mounts it like production) ─
type RowDef = {
  name: string
  description: string
  parameters: unknown
  execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}
interface PlaneValue {
  ownNames: readonly string[]
  definitions: readonly RowDef[]
  placementFeed: (name: string) => { definitionIdentity?: string; realmId: string } | undefined
  livePaPlan: Map<string, Record<string, unknown>>
  realmId: string
  assembly: ProductionAdmissionAssembly
}
const planeModule = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => { ok: boolean; code?: string; message?: string; value?: PlaneValue }
  A5_B_SCHEDULE_LIST_MOUNT_NAME: string
  A5_B_SCHEDULE_DELETE_MOUNT_NAME: string
}
const LIST = planeModule.A5_B_SCHEDULE_LIST_MOUNT_NAME
const DELETE = planeModule.A5_B_SCHEDULE_DELETE_MOUNT_NAME

// ── the mounted production-shaped world ───────────────────────────────────
interface ScheduleRow { id: string; sessionId: string; scheduledAt: string; status: string; title: string; prompt: string }
interface World {
  plane: PlaneValue
  listDef: RowDef
  deleteDef: RowDef
  agent: { id: string; session: { id: string } }
  rootCtx: { schedule: Record<string, unknown> }
  rows: ScheduleRow[]
  serviceCalls: { list: unknown[]; delete: unknown[] }
  observed: string[]
  legInputs: Record<string, unknown>[]
  legResults: { decision?: string; detail?: string; requestId?: string }[]
  throwNextDeleteError: (e: Error | null) => void
  rereregisterNative: () => void
  arms: {
    schedule_list: { definitionIdentity: string; classify: (raw: unknown) => Record<string, unknown>; execute: (plan: Record<string, unknown>, exec: Record<string, unknown>) => Promise<Record<string, unknown>>; drain: () => void }
    schedule_delete: { definitionIdentity: string; classify: (raw: unknown) => Record<string, unknown>; execute: (plan: Record<string, unknown>, exec: Record<string, unknown>) => Promise<Record<string, unknown>>; drain: () => void }
  }
  listIdentity: string
  deleteIdentity: string
  throwNextDelete: Error | null
}

async function mountWorld(
  label: string,
  opts: {
    policy?: TemplatePermissionPolicy
    gate?: unknown
    injectOverride?: unknown
  } = {},
): Promise<World> {
  const realmId = `a5m2-schedule-production-${label}`
  const observed: string[] = []
  const legInputs: Record<string, unknown>[] = []
  const legResults: { decision?: string; detail?: string; requestId?: string }[] = []

  // THE CAPTURE (the three laws, all REAL): registerScheduleTools from the
  // published package registers the native faces bound to (rootCtx, agent);
  // rootCtx.schedule is read by the native closures AT DISPATCH TIME; agent
  // is the owner Agent OBJECT every exec must carry by REFERENCE.
  const agent = { id: WORKER, session: { id: `ses-schedule-production-${label}` } }
  const rows: ScheduleRow[] = [{
    id: 'sch_a5m2_prod_1',
    sessionId: String(agent.session.id),
    scheduledAt: '2026-01-01T00:00:00.000Z',
    status: 'ACTIVE',
    title: 'lane row',
    prompt: 'the lane row',
  }]
  const serviceCalls = { list: [] as unknown[], delete: [] as unknown[] }
  const throwNextDelete: { error: Error | null } = { error: null }
  const rootCtx = {
    schedule: {
      list: async (input: unknown) => { serviceCalls.list.push(input); return rows.slice() },
      delete: async (input: unknown, signal: unknown) => {
        serviceCalls.delete.push({ input, signal })
        if (throwNextDelete.error !== null) throw throwNextDelete.error
        return { deleted: true, id: (input as { id: string }).id }
      },
    },
  }
  const faces = new Map<string, Record<string, unknown>>()
  const toolCtx = { tools: { register: (def: Record<string, unknown>) => { faces.set(String(def.name), def); return () => { faces.delete(String(def.name)) } } } }
  registerScheduleTools(rootCtx as never, toolCtx as never, agent as never)
  const nativeList = faces.get(LIST)
  const nativeDelete = faces.get(DELETE)
  if (nativeList === undefined || nativeDelete === undefined) throw new Error('the published registerScheduleTools did not answer the list/delete faces')

  // THE family assembly — the PRODUCTION port law mirrored verbatim from
  // the glue: a native dispatch port over the BOUND faces, with a
  // liveScheduleService that RE-DERIVES from the live native pair (so the
  // signed drift check is anchored on host-visible state, never a constant
  // self-compare).
  const schedulePort = createScheduleNativeDispatchPort({ nativeList: nativeList as never, nativeDelete: nativeDelete as never, capturedAgent: agent as never })
  const derivedPort: { key: unknown[]; port: Record<string, unknown> } = { key: [nativeList, nativeDelete], port: schedulePort as unknown as Record<string, unknown> }
  const liveScheduleService = () => {
    const pair = [faces.get(LIST), faces.get(DELETE)]
    if (pair[0] === derivedPort.key[0] && pair[1] === derivedPort.key[1]) return derivedPort.port
    derivedPort.key = pair
    derivedPort.port = createScheduleNativeDispatchPort({ nativeList: pair[0] as never, nativeDelete: pair[1] as never, capturedAgent: agent as never }) as unknown as Record<string, unknown>
    return derivedPort.port
  }
  const rereregisterNative = () => { registerScheduleTools(rootCtx as never, toolCtx as never, agent as never) }
  const assemblyWiring = createScheduleWiring({
    providerId: PROVIDER,
    declaredService: Object.freeze({ present: true }),
    captured: Object.freeze({
      schedule_list: Object.freeze({ native: nativeList, definitionIdentity: `capture-side:${label}:schedule_list` }),
      schedule_delete: Object.freeze({ native: nativeDelete, definitionIdentity: `capture-side:${label}:schedule_delete` }),
    }),
    liveNative: (name: string) => faces.get(name),
    scheduleService: schedulePort as never,
    liveScheduleService,
    capturedAgent: agent,
    ScheduleInputError,
    placementFeed: () => undefined,
    admit: async () => { throw new Error('P_B_SCHEDULE_PRODUCTION_ADMIT_INERT — production admission is the plane PA edge, never this seat') },
    observe: (row: unknown) => { const r = row as { event?: string; code?: string }; observed.push(`wire:${String(r?.event ?? 'event')}${r?.code === undefined ? '' : `:${String(r.code)}`}`) },
  } as never)
  if (assemblyWiring.ok !== true) throw new Error(`the family assembly refused: ${String((assemblyWiring as { code?: string }).code)} ${(assemblyWiring as { message?: string }).message}`)

  const placedArms: Record<string, Record<string, unknown>> = {}
  const armFor = (name: string, native: Record<string, unknown>) => (placedDef: unknown) => {
    const identity = definitionIdentityOf(placedDef as never)
    if (typeof identity !== 'string' || identity.length === 0) throw new TypeError('the placed definition carries no WeakMap identity — no arm without one')
    const built = createGovernedScheduleArm({
      name,
      assembly: assemblyWiring,
      nativeDefinition: native,
      capturedAgent: agent,
      ScheduleInputError,
      definitionIdentity: identity,
      providerId: PROVIDER,
      observe: (row: unknown) => { const r = row as { event?: string; code?: string; settled?: string }; observed.push(`arm:${String(r?.event ?? 'event')}${r?.settled === undefined ? '' : `:${String(r.settled)}`}${r?.code === undefined ? '' : `:${String(r.code)}`}`) },
    } as never)
    if (built.ok !== true) throw new Error(`${String((built as { code?: string }).code)}: ${String((built as { message?: string }).message)}`)
    placedArms[name] = built.arm as unknown as Record<string, unknown>
    return built.arm
  }

  const inject = opts.injectOverride === null ? undefined : opts.injectOverride === undefined ? Object.freeze({
    list: Object.freeze({
      createArm: armFor(LIST, nativeList),
      description: String(nativeList.description),
      parameters: nativeList.parameters,
      output: nativeList.output,
    }),
    delete: Object.freeze({
      createArm: armFor(DELETE, nativeDelete),
      description: String(nativeDelete.description),
      parameters: nativeDelete.parameters,
      output: nativeDelete.output,
    }),
  }) : opts.injectOverride

  const built = planeModule.createTeamToolPlaneAssembly({
    permissionPolicy: opts.policy ?? DIRECT_POLICY,
    realmId,
    templateId: SCHEDULE_TPL,
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    plane: opts.gate === undefined ? { scheduleEnabled: true } : { scheduleEnabled: opts.gate },
    backends: inject === undefined ? {} : { schedule: inject },
    authorityFacts: { overlayGeneration: async () => 0, ensureAuthorityCurrent: async () => {} },
    controlLeg: async (legInput: unknown) => {
      legInputs.push(legInput as Record<string, unknown>)
      const answered = await createPaControlLeg({
        controlService: service,
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        beneficiaryAuthority: 'member',
        governedFamilies: familyTable,
      })(legInput as PaControlLegInput)
      legResults.push(answered as { decision?: string; detail?: string; requestId?: string })
      return answered
    },
    readCallFacts: async (input: Record<string, unknown>) => {
      const truth = realmTruths.get(String(input.realmId))
      if (truth === undefined) return undefined
      if (String(input.rootSessionId) !== P6T4_ROOT) return undefined
      const durable = repos.memberInstances.get(P6T4_ROOT, String(input.instanceId))
      if (durable === undefined) return undefined
      const rawEffects = (input.requestedEffects as { effects?: Array<{ kind: string; toolName?: string }> } | undefined)?.effects ?? []
      const toolName = String(rawEffects.find((e) => e.kind === 'tool-invoke')?.toolName ?? '')
      const binding = bindingFixtures.get(label)?.get(toolName)
      if (binding === undefined) return undefined
      const effects = parseRequestedEffectSet(input.requestedEffects as never)
      if (!effects.ok) return undefined
      const hard = factSlot(EMPTY_DOCS.teamHardEnvelope)
      const mutation = factSlot(EMPTY_DOCS.permissionMutationEnvelope)
      if (hard === undefined || mutation === undefined) return undefined
      const family = a5GovernedFamilyFor(String(binding.definitionIdentity))
      const livePlan = truth.plane?.livePaPlan.get(String(input.callId))
      return {
        kind: livePlan === undefined ? 'no-approval-question' : 'call-facts',
        facts: {
          policySource: { staticLayerRefs: [`${SCHEDULE_TPL}:directive-policy`], overlayGeneration: 0 },
          realmId: String(input.realmId),
          ceiling: { teamHardEnvelope: hard, permissionMutationEnvelope: mutation },
          policyDocument: truth.assembly.policyDocument(),
          denySources: truth.assembly.denySources(),
          effects: (livePlan?.requestedEffects as RequestedEffectSet | undefined) ?? (effects.value as RequestedEffectSet),
          member: { teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) },
          beneficiaryAuthority: 'member',
          binding,
          blueprint: {
            revision: String(blueprint.revision),
            contentHash: String(blueprint.contentHash),
            templateId: SCHEDULE_TPL,
            cwd: CHAIN_WORLD,
            providerVersion: PROVIDER,
          },
          authorityGeneration: 0,
          ...(livePlan === undefined ? {} : {
            planSnapshot: {
              approvalCaseId: livePlan.approvalCaseId,
              effectSetFingerprint: livePlan.effectSetFingerprint,
              perEffectRequired: livePlan.perEffectRequired,
            },
          }),
          ...(family === undefined ? {} : { governedFamily: family }),
        },
      }
    },
    onObserve: (row: string) => { observed.push(String(row)) },
  })
  if (built.ok !== true || built.value === undefined) {
    // refusal signalling for the negative legs: the built answer rides the
    // thrown error (a plain object is refused, never a silent fallback).
    throw Object.assign(new Error(`__REFUSAL_EXPECTED__ (${String(built.code)}): ${String(built.message)}`), { built })
  }
  const plane = built.value
  realmTruths.set(plane.realmId, { assembly: plane.assembly, plane })

  // THE PRODUCTION REGISTRATION WRITE (agent-bindings' law mirrored): the
  // placement feed's RUNTIME identity for BOTH rows, registered after mount.
  const listFed = plane.placementFeed(LIST)
  const deleteFed = plane.placementFeed(DELETE)
  const listIdentity = String(listFed?.definitionIdentity ?? '')
  const deleteIdentity = String(deleteFed?.definitionIdentity ?? '')
  if (listIdentity.length === 0 || deleteIdentity.length === 0) throw new Error('the placed schedule rows answered no placement identity')
  registerA5GovernedFamily(listIdentity, { familyId: 'B-SCHEDULE', adapterRevision: A5_B_SCHEDULE_ADAPTER_REVISION, providerIdentity: PROVIDER })
  registerA5GovernedFamily(deleteIdentity, { familyId: 'B-SCHEDULE', adapterRevision: A5_B_SCHEDULE_ADAPTER_REVISION, providerIdentity: PROVIDER })
  const bindings = new Map<string, ToolBinding>()
  for (const [toolName, definitionIdentity] of [[LIST, listIdentity], [DELETE, deleteIdentity]] as const) {
    const parsed = parseToolBinding({
      bindingId: `${SCHEDULE_TPL}:${label}:${toolName}`,
      agentScopeKey: `${SCHEDULE_TPL}:${label}`,
      toolName,
      definitionIdentity,
      providerId: PROVIDER,
      implementationOrigin: 'team-trusted-extension',
      executionBoundary: 'trusted-host',
      assurance: untestedAssurance('team-trusted-extension', 'trusted-host', plane.realmId),
      policyGeneration: 0,
      authorityGeneration: 0,
      revision: 1,
      status: 'ACTIVE',
    })
    if (!parsed.ok) throw new Error(`fixture binding refused: ${String((parsed as unknown as { code?: string }).code)}`)
    bindings.set(toolName, parsed.value)
  }
  bindingFixtures.set(label, bindings)
  const listDef = plane.definitions.find((d) => d.name === LIST)
  const deleteDef = plane.definitions.find((d) => d.name === DELETE)
  if (listDef === undefined || deleteDef === undefined) throw new Error('the mounted plane carries no governed schedule row')
  return {
    plane, listDef, deleteDef, agent,
    rootCtx: rootCtx as unknown as { schedule: Record<string, unknown> },
    rows, serviceCalls, observed, legInputs, legResults, arms: placedArms, listIdentity, deleteIdentity,
    throwNextDeleteError: (e: Error | null) => { throwNextDelete.error = e },
    rereregisterNative,
  } as unknown as World
}

function execFor(agent: Record<string, unknown>): Record<string, unknown> {
  const controller = new AbortController()
  return { agent, token: Symbol(`exec-${String(Math.random())}`), signal: controller.signal }
}
const delegatedRows = (world: World) => world.observed.filter((r) => r.startsWith('arm:b-schedule-arm:delegated'))

describe('A5M2 B-SCHEDULE production: the REAL plane flight (mount → classify → open → the durable Control leg → dispose) and the REAL captured host body (arm → native → host error law) — grammar gate CLOSED pending root', () => {
  // ── GROUP A — the real plane flight up to the SIGNED-GRAMMAR BOUNDARY ──
  // Every leg below runs the mounted plane's own row execute: the REAL
  // paAdmit.open, the REAL durable Control leg carrying the walk's four
  // P-adds, the row's plan/token lease law. Where the flight stops, it stops
  // at root's unsigned grammar (target structure + rule vocabulary) — and
  // that boundary is pinned with ZERO durable residue, never papered over.

  it('SP-R1 the full flight runs to the grammar boundary and leaves ZERO durable residue: refusal exact, no service entry, no Control row, no leaked plan fact, token SETTLED (replay refused)', async () => {
    const world = await mountWorld('r1')
    const stateBefore = JSON.stringify(await service.listControlState(P6T4_ROOT))
    const exec = execFor(world.agent)
    await expect(world.listDef.execute({}, exec)).rejects.toThrow(/refused-schedule_list APPROVAL_DENIED/)
    expect(world.serviceCalls.list).toHaveLength(0)
    expect(delegatedRows(world)).toHaveLength(0)
    expect(JSON.stringify(await service.listControlState(P6T4_ROOT)), 'the grammar refusal happens BEFORE any pending approval is minted — the call never becomes approvable').toBe(stateBefore)
    expect(world.plane.livePaPlan.size).toBe(0)
    await expect(world.listDef.execute({}, exec)).rejects.toThrow(/exec-token-replay/)
  })

  it('SP-R2 the ask-lane claim reaches the durable Control leg WITH the four-P-add family block: familyId/adapterRevision/providerIdentity + the 11-leaf targetManifest (taskId null for list, exactly measured)', async () => {
    const world = await mountWorld('r2')
    await expect(world.listDef.execute({}, execFor(world.agent))).rejects.toThrow(/APPROVAL_DENIED/)
    expect(world.legInputs.length).toBeGreaterThanOrEqual(1)
    expect(world.legResults[0]?.decision).toBe('deny')
    expect(world.legResults[0]?.requestId, 'the grammar refusal happens BEFORE any Control request is minted — there is nothing to approve').toBeUndefined()
    expect(String(world.legResults[0]?.detail)).toContain('familyId: no target structure is registered')
    expect(String(world.legResults[0]?.detail)).toContain('B-SCHEDULE')
    const family = world.legInputs[0]?.family as { familyId: string; adapterRevision: number; providerIdentity: string; targetManifest: Record<string, unknown> }
    expect(family.familyId).toBe('B-SCHEDULE')
    expect(family.adapterRevision).toBe(A5_B_SCHEDULE_ADAPTER_REVISION)
    expect(family.providerIdentity).toBe('a5m2-wire-lane')
    expect(Object.keys(family.targetManifest)).toHaveLength(11)
    expect(family.targetManifest.taskId).toBeNull()
  })

  it('SP-R3 the delete claim carries the EXACT taskId through the same real leg (the nullable single column, admitted side); the flight still falls closed on the identical grammar refusal', async () => {
    const world = await mountWorld('r3')
    await expect(world.deleteDef.execute({ id: 'sch_a5m2_prod_1' }, execFor(world.agent))).rejects.toThrow(/APPROVAL_DENIED/)
    expect(String(world.legResults[0]?.detail)).toContain('familyId: no target structure is registered')
    expect(world.serviceCalls.delete).toHaveLength(0)
    const family = world.legInputs[0]?.family as { targetManifest: Record<string, unknown> }
    expect(family.targetManifest.taskId).toBe('sch_a5m2_prod_1')
    expect(family.targetManifest.destinationSessionId).toBe(String((world.agent.session as { id: unknown }).id))
  })

  it('SP-R4 waiting-cancel lease cleanup: an aborted call refuses with zero service entry, its token stays SETTLED (replay refused, never re-armed), and the NEXT fresh call still flies the full path — no leaked lease, no poisoned mount', async () => {
    const world = await mountWorld('r4')
    const controller = new AbortController()
    controller.abort()
    const shared = { agent: world.agent, token: Symbol('exec-cancelled'), signal: controller.signal }
    await expect(world.listDef.execute({}, shared)).rejects.toThrow(/cancelled|aborted/i)
    expect(world.serviceCalls.list).toHaveLength(0)
    await expect(world.listDef.execute({}, shared)).rejects.toThrow(/exec-token-replay/)
    const legsBefore = world.legInputs.length
    await expect(world.listDef.execute({}, execFor(world.agent))).rejects.toThrow(/APPROVAL_DENIED/)
    expect(world.legInputs.length, 'the fresh call reached the Control leg — the cancelled flight left no lease in front of it').toBeGreaterThan(legsBefore)
    expect(world.plane.livePaPlan.size).toBe(0)
  })

  it('SP-R5 the rule vocabulary is part of the CLOSED grammar: a per-tool schedule_* policy rule is refused AT PLANE BUILD with the measured core-vocabulary projection refusal (never silently ignored, never half-mounted)', async () => {
    const built = await mountWorld('r5', {
      policy: { default: 'ask', allow: [{ tool: 'schedule_list', resource: { kind: 'any' } }], ask: [], deny: [] } as unknown as TemplatePermissionPolicy,
    }).then(() => undefined, (e: unknown) => (e as { built?: { ok: boolean; code?: string; message?: string } }).built)
    expect(built?.ok).toBe(false)
    expect(String(built?.code)).toBe('TOOL_BINDING_UNVERIFIED')
    expect(String(built?.message)).toContain('must be one of read | read_image | write | edit | lsp | bash | pwsh')
  })

  it('SP-R6 create/update are NOT enabled anywhere on the mount: no schedule_create/schedule_update row is placed, and an inject carrying a create key is refused the WHOLE mount (closed key set, never ignored)', async () => {
    const world = await mountWorld('r6')
    const names = world.plane.definitions.map((d) => d.name)
    expect(names).toContain(LIST)
    expect(names).toContain(DELETE)
    expect(names).not.toContain('schedule_create')
    expect(names).not.toContain('schedule_update')
    const built = await mountWorld('r6b', {
      injectOverride: { list: { createArm: () => ({}), description: 'x', parameters: {}, output: { render: () => '' } }, delete: { createArm: () => ({}), description: 'x', parameters: {}, output: { render: () => '' } }, create: { createArm: () => ({}) } },
    }).then(() => undefined, (e: unknown) => (e as { built?: { ok: boolean; code?: string; message?: string } }).built)
    expect(built?.ok).toBe(false)
    expect(String(built?.message ?? '')).toContain('schedule_create')
    expect(String(built?.code ?? '')).toBe('SCHEDULE_ARM_INJECT_INVALID')
  })

  it('SP-R7 gate law: the mount refuses an injected family with the gate OFF and a gate ON with nothing injected (pairing, both directions) — config is law, not wiring', async () => {
    const capture = async (label: string, opts: Parameters<typeof mountWorld>[1]) =>
      mountWorld(label, opts).then(() => undefined, (e: unknown) => (e as { built?: { ok: boolean; code?: string; message?: string } }).built)
    const offGate = await capture('r7a', { gate: false })
    expect(offGate?.ok).toBe(false)
    expect(String(offGate?.code)).toBe('SCHEDULE_ARM_INJECT_INVALID')
    const noInject = await capture('r7b', { gate: true, injectOverride: null })
    expect(noInject?.ok).toBe(false)
    expect(String(noInject?.code)).toBe('SCHEDULE_ARM_INJECT_INVALID')
  })

  it('SP-R8 the three-way identity tie holds AT the production mount: the placement-feed identity, the placement-moment arm identity and the family-table key are ONE string per row; the table answers B-SCHEDULE for both rows and nothing else claims them', async () => {
    const world = await mountWorld('r8')
    expect(a5GovernedFamilyFor(world.listIdentity)).toEqual({ familyId: 'B-SCHEDULE', adapterRevision: A5_B_SCHEDULE_ADAPTER_REVISION, providerIdentity: 'a5m2-wire-lane' })
    expect(a5GovernedFamilyFor(world.deleteIdentity)).toEqual({ familyId: 'B-SCHEDULE', adapterRevision: A5_B_SCHEDULE_ADAPTER_REVISION, providerIdentity: 'a5m2-wire-lane' })
    expect(world.listIdentity).not.toBe(world.deleteIdentity)
    expect(world.observed.filter((r) => r.includes('arm:created'))).toHaveLength(2)
    expect(String(world.arms.schedule_list.definitionIdentity)).toBe(world.listIdentity)
    expect(String(world.arms.schedule_delete.definitionIdentity)).toBe(world.deleteIdentity)
  })

  // ── GROUP B — the captured BODY itself, on REAL host code ──────────────
  // The arm half of production reachability, with NO stand-ins that matter:
  // the native faces are the published registerScheduleTools closures, the
  // error class is the imported module identity, the owner law is the host's
  // own REFERENCE comparison, and `rootCtx.schedule` is resolved by the host
  // closure AT DISPATCH. This is what runs the instant a grant can land —
  // and nothing dumber than the unsigned grammar stands between.

  it('SP-B1 the governed list body flies the DELEGATE boundary and settles the REAL scheduleView rows read for the BOUND owner session (frozen port call, settled "service")', async () => {
    const world = await mountWorld('b1')
    const arm = world.arms.schedule_list
    const classified = arm.classify({})
    expect(classified.ok).toBe(true)
    expect(classified.effects).toEqual([{ kind: 'tool-invoke', toolName: LIST, resource: null }])
    const manifest = classified.targetManifest as Record<string, unknown>
    expect(Object.keys(manifest)).toHaveLength(11)
    expect(manifest.taskId).toBeNull()
    const ran = await arm.execute(classified.plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean; settled?: string; value: unknown }
    expect(ran.ok).toBe(true)
    expect(ran.settled).toBe('service')
    const rows = ran.value as Array<Record<string, unknown>>
    expect(Array.isArray(rows)).toBe(true)
    expect(String(rows[0]?.id)).toBe('sch_a5m2_prod_1')
    expect(String(rows[0]?.deliveryMode)).toBe('host')
    expect((world.serviceCalls.list[0] as { sessionId: string }).sessionId).toBe(String(world.agent.session.id))
    expect(delegatedRows(world)).toHaveLength(1)
  })

  it('SP-B2 a dynamic replacement NEVER executes: a host re-registration (fresh native faces behind the same mount) answers the signed DEFINITION_DRIFT at the delegate boundary with ZERO further service entry — the drift check is anchored on host-visible state, and the combined RC is carried by BOTH the arm event and the assembly refusal event (root 18:52)', async () => {
    const world = await mountWorld('b2')
    const arm = world.arms.schedule_list
    const c1 = arm.classify({})
    const first = await arm.execute(c1.plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean; settled?: string }
    expect(first.ok).toBe(true)
    expect(first.settled).toBe('service')
    expect(world.serviceCalls.list).toHaveLength(1)
    // the host re-registers the schedule tools behind the mount: liveNative
    // and the derived port BOTH see new objects — the delegate refuses
    // BEFORE any port entry, and no replacement body ever runs.
    world.rereregisterNative()
    const c2 = arm.classify({})
    expect(c2.ok).toBe(true)
    const second = await arm.execute(c2.plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean; code?: string }
    expect(second.ok).toBe(false)
    expect(second.code).toBe('P_B_SCHEDULE_DEFINITION_DRIFT')
    expect(world.serviceCalls.list).toHaveLength(1)
    expect(world.observed.some((r) => r.startsWith('arm:b-schedule-arm:delegated') && r.includes('P_B_SCHEDULE_DEFINITION_DRIFT'))).toBe(true)
    expect(world.observed.some((r) => r.startsWith('wire:b-schedule:refusal') && r.includes('P_B_SCHEDULE_DEFINITION_DRIFT'))).toBe(true)
  })

  it('SP-B3 the admitted delete body reaches the service with the OWNER session and the EXACT branded id and settles the native value — exactly one dispatch', async () => {
    const world = await mountWorld('b3')
    const arm = world.arms.schedule_delete
    const classified = arm.classify({ id: 'sch_a5m2_prod_1' })
    expect(classified.ok).toBe(true)
    expect((classified.targetManifest as Record<string, unknown>).taskId).toBe('sch_a5m2_prod_1')
    const ran = await arm.execute(classified.plan as Record<string, unknown>, execFor(world.agent))
    expect(ran).toEqual({ ok: true, settled: 'service', value: { deleted: true, id: 'sch_a5m2_prod_1' } })
    expect((world.serviceCalls.delete[0] as { input: unknown }).input).toEqual({ sessionId: String(world.agent.session.id), id: 'sch_a5m2_prod_1' })
    expect(delegatedRows(world)).toHaveLength(1)
  })

  it('SP-B4 the id law is the CAPTURED host law at the delegate boundary: a whitespace-padded id settles the host invalid_rule VALUE (settled tool-law-value) with ZERO service entry — the refusal wording is the host\u2019s own, not a lane invention', async () => {
    const world = await mountWorld('b4')
    const arm = world.arms.schedule_delete
    const classified = arm.classify({ id: ' sch_a5m2_prod_1 ' })
    expect(classified.ok, 'the id law is a VALUE inside the admitted call, not a pre-admission refuse (measured mapping: taskId rode null)').toBe(true)
    const ran = await arm.execute(classified.plan as Record<string, unknown>, execFor(world.agent))
    expect(ran).toEqual({ ok: true, settled: 'tool-law-value', value: { code: 'invalid_rule', message: 'schedule_delete id must be non-empty without surrounding whitespace.' } })
    expect(world.serviceCalls.delete).toHaveLength(0)
  })

  it('SP-B5 同Host错误类 by MODULE IDENTITY: a real ScheduleInputError thrown by the service settles its own {code, message} through the host operationError mirror inside the captured closure — the delegate settles it as the settled service VALUE, not internal_error, not a throw', async () => {
    const world = await mountWorld('b5')
    // the code is one of the PUBLIC Schedule input codes (the published
    // d.ts restricts the union — itself a proof the REAL class is in hand)
    world.throwNextDeleteError(new ScheduleInputError('invalid_selector', 'The schedule selector is not valid.'))
    const arm = world.arms.schedule_delete
    const classified = arm.classify({ id: 'sch_a5m2_prod_1' })
    const ran = await arm.execute(classified.plan as Record<string, unknown>, execFor(world.agent))
    // the mirror ran INSIDE the host closure (its operationError caught the
    // imported class identity); the delegate settles the returned value —
    // one class, one module identity, host law end to end.
    expect(ran).toEqual({ ok: true, settled: 'service', value: { code: 'invalid_selector', message: 'The schedule selector is not valid.' } })
  })

  it('SP-B6 owner同Agent is the delegate\u2019s own REFERENCE law: an id/session-bytes LOOK-ALIKE settles the host internal_error VALUE with ZERO service entry; a FRESH plan by the bound object dispatches (the refused plan rides the same one-shot memo — no re-arm)', async () => {
    const world = await mountWorld('b6')
    const arm = world.arms.schedule_list
    const classified = arm.classify({})
    const lookAlike = { id: world.agent.id, session: { id: String(world.agent.session.id) } }
    const refusal = await arm.execute(classified.plan as Record<string, unknown>, execFor(lookAlike)) as { ok: boolean; settled?: string; value: unknown }
    expect(refusal).toMatchObject({ ok: true, settled: 'tool-law-value' })
    expect(refusal.value).toEqual({ code: 'internal_error', message: 'The schedule operation failed.' })
    expect(world.serviceCalls.list).toHaveLength(0)
    const ok = await arm.execute(arm.classify({}).plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean; settled?: string; value: unknown }
    expect(ok.settled).toBe('service')
    expect(Array.isArray(ok.value)).toBe(true)
    expect(world.serviceCalls.list).toHaveLength(1)
  })

  it('SP-B7 the drain law lands AT the delegate, not on a re-classify: a plan classified while the PA window was open meets a drain that lands before the body, and the execute refuses P_B_SCHEDULE_DRAINING with ZERO native entry — committed durable state untouched, new-call prohibition only', async () => {
    const world = await mountWorld('b7')
    const arm = world.arms.schedule_list
    const planned = arm.classify({})
    expect(planned.ok).toBe(true)
    arm.drain()
    const ran = await arm.execute(planned.plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean; code?: string }
    expect(ran.ok).toBe(false)
    expect(ran.code).toBe('P_B_SCHEDULE_DRAINING')
    expect(world.serviceCalls.list).toHaveLength(0)
    const after = arm.classify({})
    expect(after.ok).toBe(false)
    expect(String(after.code)).toBe('P_B_SCHEDULE_DRAINING')
  })

  it('SP-B8 the SAME plan OBJECT never dispatches twice: the re-presented plan answers the adapter\u2019s own ALREADY_DISPATCHED memo with exactly ONE service entry (the plan-once memo lives at the delegate, not in a lane rule)', async () => {
    const world = await mountWorld('b8')
    const arm = world.arms.schedule_list
    const planned = arm.classify({})
    const first = await arm.execute(planned.plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean }
    expect(first.ok).toBe(true)
    const twice = await arm.execute(planned.plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean; code?: string }
    expect(twice.ok).toBe(false)
    expect(twice.code).toBe('P_B_SCHEDULE_ALREADY_DISPATCHED')
    expect(world.serviceCalls.list).toHaveLength(1)
  })
})
