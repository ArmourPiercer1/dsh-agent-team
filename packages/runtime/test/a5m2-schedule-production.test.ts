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
 * law; the frozen port call; the L6 mirror). THE PORT IS THE RAW SERVICE
 * (root 19:17): the adapter is fed the REAL published ScheduleService —
 * ctx.schedule itself through a CURRENT FEED (`() => rootCtx.schedule`,
 * the spec mirror of the entry's lazy strict global-store read under
 * 'schedule') — never a wrapper of the native TOOL face: the tool output
 * is a rendered view set / tool VALUE, and mapping it a second time or
 * feeding a {code,message} VALUE through the delegate's records.map is
 * exactly the mis-layering closed here. liveScheduleService() re-reads the
 * feed at every dispatch edge exactly where the host bodies resolve
 * rootCtx.schedule, so the signed PORT_DRIFT legs are REAL service drift:
 * a service OBJECT or a service METHOD replaced underneath the mount
 * refuses BEFORE any port entry, in either direction (the replacement
 * service records nothing; the bound one is never asked again).
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
import { P6T4_BLUEPRINT_SOURCE, P6T4_NOW, P6T4_ROOT, leaderCaller, memberCaller, p6t4Seed } from './p6t4-helpers.js'
// THE production module identity: the SAME published package agent-bindings
// imports. registerScheduleTools mints the native faces; ScheduleInputError
// is the ONE class identity the native bodies throw and the arm mirrors.
import { ScheduleInputError, registerScheduleTools } from '@deepseek-ai/dsh-schedule'
import {
  createGovernedScheduleArm,
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
  throwNextListError: (e: Error | null) => void
  swapScheduleService: (next: Record<string, unknown>) => void
  rebindScheduleList: (fn: (input: unknown) => Promise<unknown>) => void
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
  // THE RAW SERVICE: the FULL published ctx.schedule shape (the adapter's
  // shape law refuses a partial port). list/delete carry the recorded fake;
  // the never-enabled methods exist and refuse loudly (the world mirrors
  // the real service's SHAPE, and this mount never dispatches them).
  const notEnabled = async () => { throw new Error('never-enabled in this world') }
  const rootCtx = {
    schedule: {
      list: async (input: unknown) => { serviceCalls.list.push(input); if (throwNextList.error !== null) throw throwNextList.error; return rows.slice() },
      delete: async (input: unknown, signal: unknown) => {
        serviceCalls.delete.push({ input, signal })
        if (throwNextDelete.error !== null) throw throwNextDelete.error
        return { deleted: true, id: (input as { id: string }).id }
      },
      create: notEnabled,
      catalog: notEnabled,
      history: notEnabled,
      update: notEnabled,
    } as Record<string, unknown>,
  }
  const throwNextList: { error: Error | null } = { error: null }
  const faces = new Map<string, Record<string, unknown>>()
  const toolCtx = { tools: { register: (def: Record<string, unknown>) => { faces.set(String(def.name), def); return () => { faces.delete(String(def.name)) } } } }
  registerScheduleTools(rootCtx as never, toolCtx as never, agent as never)
  const nativeList = faces.get(LIST)
  const nativeDelete = faces.get(DELETE)
  if (nativeList === undefined || nativeDelete === undefined) throw new Error('the published registerScheduleTools did not answer the list/delete faces')

  // THE family assembly — the PRODUCTION port law (root 19:17) mirrored
  // verbatim from the glue: the RAW ctx.schedule handle at bind time and a
  // CURRENT FEED liveScheduleService() that re-reads the store at every
  // dispatch edge (the spec mirror of the entry's lazy strict
  // ctx.get('schedule')). The native faces keep their real role: the
  // capture IDENTITY behind liveNative, never a service stand-in.
  const schedulePort = rootCtx.schedule
  const liveScheduleService = () => rootCtx.schedule
  const swapScheduleService = (next: Record<string, unknown>) => { rootCtx.schedule = next }
  const rebindScheduleList = (fn: (input: unknown) => Promise<unknown>) => { (rootCtx.schedule as { list: unknown }).list = fn }
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
    throwNextListError: (e: Error | null) => { throwNextList.error = e },
    swapScheduleService,
    rebindScheduleList,
  } as unknown as World
}

/** COMBINATION POSTURE (5a16c4aa paired): a validated B-SCHEDULE claim now
 *  MINTS its durable approval request (pre-combination it died at the
 *  unregistered-family deny BEFORE minting). The paired legs therefore
 *  await the pending request, assert the family block it carried, and the
 *  LEADER answers deny — the flight refuses through the real approval
 *  answer with the body never running. */
async function denyFirstPending(label: string): Promise<string> {
  for (let i = 0; i < 400; i++) {
    const st = await service.listControlState(P6T4_ROOT)
    const pending = st.requests.find((r) => String((r as { status?: string }).status) === 'pending') as { requestId?: string } | undefined
    if (pending?.requestId !== undefined) {
      const requestId = String(pending.requestId)
      await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId, decision: 'deny', note: `paired-leg deny ${label}` })
      return requestId
    }
    await new Promise((r) => setTimeout(r, 10))
  }
  throw new Error(`no pending Control request minted for ${label} (the paired rule must MINT, not pre-deny)`)
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

  it('SP-R1 PAIRED refresh (combination consequence @5d4fb7322): the requires-approval flight now MINTS the pending request instead of dying pre-mint; the leader deny answers it exactly, body zero, delegated zero, the ONLY durable delta is the minted request plus its deny decision (recorded field-for-field), no leaked plan fact, token SETTLED (replay refused)', async () => {
    const world = await mountWorld('r1')
    const stateBefore = await service.listControlState(P6T4_ROOT)
    const exec = execFor(world.agent)
    const flight = world.listDef.execute({}, exec)
    const requestId = await denyFirstPending('r1')
    expect(requestId.length).toBeGreaterThan(0)
    await expect(flight).rejects.toThrow(/refused-schedule_list APPROVAL_DENIED/)
    expect(world.serviceCalls.list).toHaveLength(0)
    expect(delegatedRows(world)).toHaveLength(0)
    // The COMBINATION's own diff, recorded: pre-combination this leg saw
    // ZERO durable state (the unregistered-family deny preceded minting);
    // post-combination the approved-shape flight leaves EXACTLY the minted
    // request and its deny decision — no other durable movement.
    const stateAfter = await service.listControlState(P6T4_ROOT)
    expect(stateAfter.requests).toHaveLength(stateBefore.requests.length + 1)
    expect(stateAfter.decisions).toHaveLength(stateBefore.decisions.length + 1)
    expect(stateAfter.consumptions).toHaveLength(stateBefore.consumptions.length)
    expect(stateAfter.abandonments).toHaveLength(stateBefore.abandonments.length)
    expect(stateAfter.corruptLegs).toHaveLength(stateBefore.corruptLegs.length)
    expect(world.plane.livePaPlan.size).toBe(0)
    await expect(world.listDef.execute({}, exec)).rejects.toThrow(/exec-token-replay/)
  }, 20_000)

  it('SP-R2 PAIRED (5a16c4aa): the ask-lane list claim now PASSES the signed B-SCHEDULE rule and MINTS the durable request (requestId defined — pre-combination it died unregistered before minting); the minted leg input carries the four-P-add block and the 11-leaf targetManifest with taskId null; the leader deny answer refuses the flight with the body never running', async () => {
    const world = await mountWorld('r2')
    const exec = execFor(world.agent)
    const flight = world.listDef.execute({}, exec)
    const requestId = await denyFirstPending('r2')
    expect(requestId.length).toBeGreaterThan(0)
    await expect(flight).rejects.toThrow(/APPROVAL_DENIED/)
    // the claim that PASSED the signed rule — field-for-field on the minted leg:
    expect(world.legInputs.length).toBeGreaterThanOrEqual(1)
    const family = world.legInputs[0]?.family as { familyId: string; adapterRevision: number; providerIdentity: string; targetManifest: Record<string, unknown> }
    expect(family, 'the four-P-add family block rode the REAL Control leg').toBeDefined()
    expect(String(family.familyId)).toBe('B-SCHEDULE')
    expect(family.adapterRevision).toBe(A5_B_SCHEDULE_ADAPTER_REVISION)
    expect(String(family.providerIdentity)).toBe('a5m2-wire-lane')
    const manifest = family.targetManifest
    expect(Object.keys(manifest)).toHaveLength(11)
    expect(manifest.taskId).toBeNull()
    // the answer is now the REAL approval answer: a requestId exists (the
    // request was MINTED and resolved) — the paired contrast to the old
    // pre-mint grammar deny.
    expect(world.legResults[0]?.requestId).toBeDefined()
    // body zero (deny answered before dispatch), lease law intact:
    expect(world.serviceCalls.list).toHaveLength(0)
    expect(world.plane.livePaPlan.size).toBe(0)
  }, 20_000)

  it('SP-R3 PAIRED (5a16c4aa): the delete claim mints too, and the MINTED leg carries the EXACT taskId through the same signed rule (the nullable single column, admitted side) with destinationSessionId === the owner session; the leader deny refuses the flight with zero delete entries', async () => {
    const world = await mountWorld('r3')
    const exec = execFor(world.agent)
    const flight = world.deleteDef.execute({ id: 'sch_a5m2_prod_1' }, exec)
    const requestId = await denyFirstPending('r3')
    expect(requestId.length).toBeGreaterThan(0)
    await expect(flight).rejects.toThrow(/APPROVAL_DENIED/)
    const family = world.legInputs[0]?.family as { targetManifest: Record<string, unknown> }
    const manifest = family.targetManifest
    expect(Object.keys(manifest)).toHaveLength(11)
    expect(manifest.taskId).toBe('sch_a5m2_prod_1')
    expect(String(manifest.destinationSessionId)).toBe(String(world.agent.session.id))
    expect(String(manifest.ownerSessionId)).toBe(String(world.agent.session.id))
    expect(world.legResults[0]?.requestId).toBeDefined()
    expect(world.serviceCalls.delete).toHaveLength(0)
    expect(world.plane.livePaPlan.size).toBe(0)
  }, 20_000)

  it('SP-R4 waiting-cancel lease cleanup: an aborted call refuses with zero service entry, its token stays SETTLED (replay refused, never re-armed), and the NEXT fresh call still flies the full path — no leaked lease, no poisoned mount', async () => {
    const world = await mountWorld('r4')
    const controller = new AbortController()
    controller.abort()
    const shared = { agent: world.agent, token: Symbol('exec-cancelled'), signal: controller.signal }
    await expect(world.listDef.execute({}, shared)).rejects.toThrow(/cancelled|aborted/i)
    expect(world.serviceCalls.list).toHaveLength(0)
    await expect(world.listDef.execute({}, shared)).rejects.toThrow(/exec-token-replay/)
    const legsBefore = world.legInputs.length
    // PAIRED refresh (combination consequence @5d4fb7322): the fresh call
    // MINTS its pending request now — the leader deny answers it; the
    // cancelled flight left no lease in front of it.
    const freshFlight = world.listDef.execute({}, execFor(world.agent))
    const requestId = await denyFirstPending('r4')
    expect(requestId.length).toBeGreaterThan(0)
    await expect(freshFlight).rejects.toThrow(/APPROVAL_DENIED/)
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
    // SINGLE conversion, measured: the RAW service record (status ACTIVE,
    // scheduledAt in 2026-01-01) was mapped exactly once by the delegate —
    // state derived from the raw bytes, raw fields intact (a double map of
    // an already-viewed row is the mis-layering root 19:17 closed).
    expect(String(rows[0]?.state)).toBe('overdue')
    expect(String(rows[0]?.title)).toBe('lane row')
    expect(String(rows[0]?.status)).toBe('ACTIVE')
    expect((world.serviceCalls.list[0] as { sessionId: string }).sessionId).toBe(String(world.agent.session.id))
    expect(delegatedRows(world)).toHaveLength(1)
  })

  it('SP-B2 service-OBJECT drift: the service replaced underneath the mount answers PORT_DRIFT on the object leg (detail: "not the bound port object") with zero entries on either service — the current feed observes the ACTUAL ctx.schedule (root 19:17; legs split per root 19:31: this leg proves the OBJECT identity check ALONE)', async () => {
    const world = await mountWorld('b2')
    const arm = world.arms.schedule_list
    const c1 = arm.classify({})
    const first = await arm.execute(c1.plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean; settled?: string }
    expect(first.ok).toBe(true)
    expect(first.settled).toBe('service')
    expect(world.serviceCalls.list).toHaveLength(1)
    // the service OBJECT is replaced underneath the mount.
    const replacedCalls: unknown[] = []
    world.swapScheduleService({
      list: async (input: unknown) => { replacedCalls.push(input); return [] },
      delete: async () => ({ deleted: false }),
      create: async () => { throw new Error('never') },
      catalog: async () => { throw new Error('never') },
      history: async () => { throw new Error('never') },
      update: async () => { throw new Error('never') },
    })
    const second = await arm.execute(arm.classify({}).plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean; code?: string; detail?: string }
    expect(second.ok).toBe(false)
    expect(second.code).toBe('P_B_SCHEDULE_PORT_DRIFT')
    // the EXACT signed leg that fired (per-leg precise RC, not just code):
    expect(String(second.detail)).toContain('not the bound port object')
    expect(world.serviceCalls.list).toHaveLength(1)
    expect(replacedCalls).toHaveLength(0)
    // 组合真RC: the exact typed code rides BOTH observable channels.
    expect(world.observed.filter((r) => r.includes('P_B_SCHEDULE_PORT_DRIFT') && r.startsWith('arm:b-schedule-arm:delegated'))).toHaveLength(1)
    expect(world.observed.filter((r) => r.startsWith('wire:b-schedule:refusal:P_B_SCHEDULE_PORT_DRIFT'))).toHaveLength(1)
  })

  it('SP-B2M service-METHOD drift on the ORIGINAL bound object: the object identity check PASSES and the method-identity leg alone refuses PORT_DRIFT (detail: "rebound underneath the frozen bind") with zero entries — independently proven, the object leg cannot have fired first (root 19:31)', async () => {
    const world = await mountWorld('b2m')
    const arm = world.arms.schedule_list
    const first = await arm.execute(arm.classify({}).plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean; settled?: string }
    expect(first.ok).toBe(true)
    expect(world.serviceCalls.list).toHaveLength(1)
    // the SAME service OBJECT, one method rebound underneath the frozen
    // bind — no swap happened, so only the method-identity leg CAN fire.
    let reboundHits = 0
    world.rebindScheduleList(async () => { reboundHits += 1; return [] })
    const second = await arm.execute(arm.classify({}).plan as Record<string, unknown>, execFor(world.agent)) as { ok: boolean; code?: string; detail?: string }
    expect(second.ok).toBe(false)
    expect(second.code).toBe('P_B_SCHEDULE_PORT_DRIFT')
    expect(String(second.detail)).toContain("rebound underneath the frozen bind")
    expect(reboundHits).toBe(0)
    expect(world.serviceCalls.list).toHaveLength(1)
    expect(world.observed.filter((r) => r.includes('P_B_SCHEDULE_PORT_DRIFT') && r.startsWith('arm:b-schedule-arm:delegated'))).toHaveLength(1)
    expect(world.observed.filter((r) => r.startsWith('wire:b-schedule:refusal:P_B_SCHEDULE_PORT_DRIFT'))).toHaveLength(1)
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

  it('SP-B5 同Host错误类 by MODULE IDENTITY with COMPLETE return/error fidelity: a real ScheduleInputError thrown by delete settles its own {code, message} through the L6 mirror, and one thrown by LIST settles VERBATIM as service-error-value — no TypeError, no internal_error, no second mapping (root 19:17)', async () => {
    const world = await mountWorld('b5')
    // the code is one of the PUBLIC Schedule input codes (the published
    // d.ts restricts the union — itself a proof the REAL class is in hand)
    world.throwNextDeleteError(new ScheduleInputError('invalid_selector', 'The schedule selector is not valid.'))
    const arm = world.arms.schedule_delete
    const classified = arm.classify({ id: 'sch_a5m2_prod_1' })
    const ran = await arm.execute(classified.plan as Record<string, unknown>, execFor(world.agent))
    // the service THROWS; the frozen port call rethrows; the delegate's L6
    // mirror runs `instanceof` against the assembly-injected class identity
    // — one module identity from the service to the settled tool VALUE.
    expect(ran).toEqual({ ok: true, settled: 'service-error-value', value: { code: 'invalid_selector', message: 'The schedule selector is not valid.' } })
    // the list side is the mis-layering's old failure point: a VALUE from
    // the service must settle VERBATIM, never crash records.map.
    world.throwNextListError(new ScheduleInputError('invalid_rule', 'The selector is not valid.'))
    const listArm = world.arms.schedule_list
    const listRan = await listArm.execute(listArm.classify({}).plan as Record<string, unknown>, execFor(world.agent))
    expect(listRan).toEqual({ ok: true, settled: 'service-error-value', value: { code: 'invalid_rule', message: 'The selector is not valid.' } })
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
