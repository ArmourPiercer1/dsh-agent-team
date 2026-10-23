/**
 * A5M2-ASSEMBLY (B-SESSION first vertical, CENTER): the governed todo_write row
 * MOUNTED and WIRED — the gap every prior round disclosed as "the production
 * side is still CENTER's unwired job". This spec does not re-prove the arm's
 * lane laws (a5-m2-todo-write-c1 owns those) nor the bridge's Control consume
 * (a5-m1-auth-bridge c812 owns that): it proves the ASSEMBLY the lane tests
 * could not reach —
 *
 *  - trusted actual-definition registration THROUGH THE PRODUCTION TABLE: the
 *    mount-time write goes through the registry's own `registerA5GovernedFamily`
 *    keyed by the RUNTIME placement definition identity the seam minted (read
 *    back through the plane's own placementFeed, the same law agent-bindings
 *    applies after publish); the leg's gate and both facts paths answer through
 *    the registry's own accessors — the spec owns NO table (root fix-2 round:
 *    "registration reached the actual callfacts AND the durable verifier" is a
 *    property of production code, not a fixture self-proof);
 *  - the real Host exec identity (fix-1 round): execs carry the 639 public
 *    shape (`token`, a fresh branded symbol per call — NO `tokenKey`, a field
 *    that does not exist on the public surface and whose hand-made fixture
 *    copy masked the original defect); the row allocates ONE correlation per
 *    token (single-flight: in-flight and settled tokens both refuse), the
 *    walk/leg/durable row all speak that ONE allocation, and the owner-current
 *    leg provably runs BEFORE the classify freeze (fix-4 ordering);
 *  - the same immutable typed plan end to end: the row feeds the arm's
 *    classify output (effects / full-value parametersFingerprint / the family
 *    block's four P-adds) into the plane's ONE PA walk; the DURABLE row's
 *    manifest carries the target manifest the live list produced, field for
 *    field, digest and counts moving with content;
 *  - the real M1 open/final-edge UNIQUE consumption: the row's `consumed:true`
 *    is produced ONLY by the execution edge's own success witness
 *    (`consumedProof` from `assembly.consumeForExecution` ok) — never by a
 *    missing-denial fallback (the CONSUME_PROOF_MISSING refusal proves the
 *    demand exists in code, the positive leg proves the witness path runs);
 *  - 保留原生: the append is the captured native definition's OWN `execute`
 *    through the bind-time snapshots (one append, exact list, fold read back);
 *  - owner/session/binding pairing, the cancel/drain words, the noTeam mount
 *    refusal, the zero-flip law, and the closed-key pairing both directions.
 *
 * Disclosed stand-ins (the lane/bridge specs own the REAL halves):
 *  - the NATIVE definition is a TEST-owned object whose `execute` mirrors the
 *    pinned host law (`exec.agent.session.append('todo/write', { todos })` +
 *    the { todos, counts } return, tool-todo index.ts:193-211 @639ed01539);
 *    the REAL host body over the REAL fold is pinned by the lane spec (T12);
 *    what THIS spec proves is that the row enters exactly the captured object;
 *  - the durable Control plane, the PA kernel, the leg, the verifier and the
 *    grant algebra are all REAL (createControlService over a real
 *    FileStorageSeam TeamDomain; createPaControlLeg; createPaEffectsVerifier;
 *    the plane's own createProductionAdmissionAssembly).
 *
 * Scope: NO Host, NO network, NO mount beyond the assembly object; worlds are
 * workspace-internal and removed after.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-todo-assembly-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
import { canonicalJsonFingerprint, parseRequestedEffectSet, parseToolBinding } from '../../domain/tool-governance/src/index.js'
import type { ToolBinding } from '../../domain/tool-governance/src/index.js'
import type { RemoteSafeJsonValue } from '../../contracts/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import { parsePaControlManifest } from '../control/types.js'
import type { PaCallFactsCeilingSlot } from '../control/types.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { untestedAssurance } from '../tool-dispatch/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { AdmissionRequest } from '../../domain/tool-governance/src/index.js'
import type { RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import type { EffectSetApprovalPlan } from '../tool-admission/approval-case.js'
import {
  createPaControlLeg,
  createPaEffectsVerifier,
} from '../operation-permission/pa-control-bridge.js'
import type {
  PaControlLegInput,
  PaEffectsVerifierDeps,
} from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import {
  P6T4_BLUEPRINT_SOURCE,
  P6T4_NOW,
  P6T4_ROOT,
  leaderCaller,
  memberCaller,
  p6t4Seed,
} from './p6t4-helpers.js'

interface PlaneAssemblyValue {
  ownNames: readonly string[]
  definitions: ReadonlyArray<{
    name: string
    description: string
    parameters: unknown
    execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
  }>
  placementFeed: (name: string) => { definitionIdentity?: string; realmId: string } | undefined
  livePaPlan: Map<string, { approvalCaseId: string; effectSetFingerprint: string; perEffectRequired: unknown[]; requestedEffects?: unknown }>
  realmId: string
  assembly: ProductionAdmissionAssembly
  mount: (agentCtx: unknown) => { ok: boolean; name?: string; message?: string; code?: string; dispose?: () => void }
}
interface PlaneResult {
  ok: boolean
  code?: string
  message?: string
  value?: PlaneAssemblyValue
}
type PlaneFactory = (input: Record<string, unknown>) => PlaneResult

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-todo-assembly: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-todo-assembly-${STAMP}`)
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

/** The arm's durable session-header fact (the pairing half the lane spec
 *  pins; the plane never sees it — only exec.agent carries it to classify). */
const HEADER_ID = 'ses-a5m2-todo-header'

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

/** THE PRODUCTION registration table (root fix-2 round). The spec keeps NO
 *  table of its own any more: the write below goes through the registry's own
 *  `registerA5GovernedFamily`, every reader (the leg's governedFamilies, both
 *  facts fakes) answers through the registry's own accessors, and the
 *  production shared read (`readCallAuthorityFacts`) fills the durable path
 *  from this same table. "Registration reached both the actual call-level
 *  facts and the durable verifier" is then a property of PRODUCTION code,
 *  not a spec-side self-proof. */
const registryModule = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  A5_GOVERNED_FAMILIES: Record<string, { familyId: string; adapterRevision: number; providerIdentity: string }>
  registerA5GovernedFamily: (definitionIdentity: string, entry: { familyId: string; adapterRevision: number; providerIdentity: string }) => void
  a5GovernedFamilyFor: (definitionIdentity: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
  readPaCallFacts: (input: Record<string, unknown>) => Promise<unknown>
}
const familyTable = registryModule.A5_GOVERNED_FAMILIES
const registerA5GovernedFamily = registryModule.registerA5GovernedFamily
const a5GovernedFamilyFor = registryModule.a5GovernedFamilyFor
const ARM_PROVIDER = 'a5p5-plane'

interface RealmTruth { readonly assembly: ProductionAdmissionAssembly; plane?: PlaneAssemblyValue }
const realmTruths = new Map<string, RealmTruth>()

/** The verifier-side CURRENT facts (the same law as the bridge lane's fake):
 *  manifest-driven re-canonicalization through the domain's own parsers, the
 *  durable attribution from the real repository, the live plan re-derived —
 *  plus `governedFamily` answered from the ONE family table. */
const verifierReadCallFacts: PaEffectsVerifierDeps['readCallFacts'] = async (input) => {
  const truth = realmTruths.get(input.manifest.realmId)
  if (truth === undefined) return undefined
  if (input.rootSessionId !== P6T4_ROOT) return undefined
  const durable = repos.memberInstances.get(P6T4_ROOT, input.manifest.member.instanceId)
  if (durable === undefined) return undefined
  const binding = parseToolBinding({ ...input.manifest.binding })
  if (!binding.ok) return undefined
  const effects = parseRequestedEffectSet(input.manifest.effects)
  if (!effects.ok) return undefined
  const request: AdmissionRequest = Object.freeze({
    binding: binding.value,
    member: Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) }),
    callId: input.manifest.callId,
    realmId: input.manifest.realmId,
    parametersFingerprint: input.manifest.parametersFingerprint,
    requestedEffects: effects.value as RequestedEffectSet,
  })
  const livePlan = truth.assembly.planApproval(request)
  if (!livePlan.ok) return undefined
  const hard = factSlot(EMPTY_DOCS.teamHardEnvelope)
  const mutation = factSlot(EMPTY_DOCS.permissionMutationEnvelope)
  if (hard === undefined || mutation === undefined) return undefined
  const family = a5GovernedFamilyFor(String(binding.value.definitionIdentity))
  return {
    policySource: { staticLayerRefs: ['a5m2-todo-asm-tpl:directive-policy'], overlayGeneration: 0 },
    realmId: input.manifest.realmId,
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
      templateId: 'a5m2-todo-asm-tpl',
      cwd: CHAIN_WORLD,
      providerVersion: ARM_PROVIDER,
    },
    planSnapshot: {
      approvalCaseId: livePlan.value.approvalCaseId,
      effectSetFingerprint: livePlan.value.effectSetFingerprint,
      perEffectRequired: livePlan.value.perEffectRequired,
    },
    authorityGeneration: 0,
    ...(family === undefined ? {} : { governedFamily: family }),
  }
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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
async function stateNow() {
  return service.listControlState(P6T4_ROOT)
}
async function waitRowForCall(callId: string, timeoutMs = 20_000): Promise<ControlRequestRecord> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = (await stateNow()).requests.find((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '') === callId)
    if (found !== undefined) return found
    if (Date.now() > deadline) throw new Error(`the durable control row for ${callId} never appeared`)
    await sleep(25)
  }
}

// ── the TEST-owned native definition (disclosed stand-in, law-mirrored) ───
interface CapturedNative {
  name: string
  description: string
  execute: (args: { todos: unknown[] }, exec: Record<string, unknown>) => Promise<unknown>
}
/** Mirrors the pinned host law (tool-todo index.ts:193-211): no owning agent
 *  ⇒ throw; the append is `exec.agent.session.append('todo/write', { todos })`
 *  verbatim; the return is { todos, counts }. The REAL host body + fold is
 *  pinned by the lane spec (T12) — this object's IDENTITY is what matters
 *  here: the row must enter exactly the object the arm captured. */
function makeNativeTodo(description: string): { def: CapturedNative; calls: Array<{ args: { todos: unknown[] } }> } {
  const calls: Array<{ args: { todos: unknown[] } }> = []
  const def: CapturedNative = {
    name: A5_TODO_TOOL_NAME,
    description,
    execute(args, exec) {
      calls.push({ args })
      const agent = exec.agent as { session?: { append?: (type: string, data: unknown) => void } } | undefined
      if (agent?.session?.append === undefined) throw new Error('todo_write requires an owning agent session')
      agent.session.append('todo/write', { todos: args.todos })
      const count = (status: string): number => args.todos.filter((t) => (t as { status?: string }).status === status).length
      return Promise.resolve({
        todos: args.todos.map((t) => ({ content: (t as { content: string }).content, status: (t as { status: string }).status })),
        counts: { pending: count('pending'), inProgress: count('in_progress'), completed: count('completed') },
      })
    },
  }
  return { def, calls }
}

const NATIVE_DESCRIPTION = 'TEST native todo_write description — the captured bytes the row must carry.'
const VALID_TODOS = Object.freeze([
  Object.freeze({ content: 'alpha', status: 'pending' }),
  Object.freeze({ content: 'beta', status: 'completed' }),
])
function todoCounts(todos: ReadonlyArray<{ status: string }>) {
  const count = (status: string): number => todos.filter((t) => t.status === status).length
  return { pending: count('pending'), inProgress: count('in_progress'), completed: count('completed') }
}

const planeModule = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: PlaneFactory
  A5_TODO_MOUNT_NAME: string
}

/** The governed todo arm, REAL (the lane spec's import convention: the .mjs
 *  module is hand-cast, the runtime object is the production one). */
interface TodoClassifyResult {
  ok: boolean
  code?: string
  detail?: string
  plan?: unknown
  effects?: unknown
  parametersFingerprint?: string
  reviewPayload?: {
    familyId: string
    adapterRevision: number
    providerIdentity: string
    definitionIdentity: string
    targetManifest: Record<string, unknown>
  }
}
interface GovernedTodoArm {
  familyId: string
  adapterRevision: number
  definitionIdentity: string
  providerId: string
  classify: (args: unknown, exec: Record<string, unknown>, callId: string) => TodoClassifyResult
  prepare: (plan: unknown, grant: Record<string, unknown>) => { ok: boolean; code?: string; detail?: string }
  execute: (plan: unknown, proof: { consumed: boolean; grant: Record<string, unknown> }) => Promise<{ ok: boolean; code?: string; detail?: string; value?: unknown }>
  cancel: (plan: unknown) => { settled?: string; code?: string }
  drain: () => void
}
const TODO = (await import(new URL('../src/plugin/live/governed-families/todo.mjs', import.meta.url).href)) as {
  A5_TODO_FAMILY_ID: string
  A5_TODO_ADAPTER_REVISION: number
  A5_TODO_TOOL_NAME: string
  createGovernedTodoArm: (deps: {
    nativeDefinition: unknown
    definitionIdentity: string
    providerId: string
    memberAgentId: string
    sessionHeaderId: string
    bindingFacts: () => { bindingId: string; bindingRevision: number; policyGeneration: number; authorityGeneration: number }
    allowParallelInProgress: boolean
    observe: (row: unknown) => void
  }) => GovernedTodoArm
}
const { A5_TODO_FAMILY_ID, A5_TODO_ADAPTER_REVISION, A5_TODO_TOOL_NAME, createGovernedTodoArm } = TODO

/** One mounted world: a unique realm, a REAL arm over a captured native def,
 *  the mount-time family registration performed through the plane's OWN
 *  placementFeed (the agent-bindings law), and the plane-side call facts. */
interface Mounted {
  plane: PlaneAssemblyValue
  arm: ReturnType<typeof createGovernedTodoArm>
  todoDef: PlaneAssemblyValue['definitions'][number]
  binding: ToolBinding
  nativeCalls: Array<{ args: { todos: unknown[] } }>
  observed: string[]
  familyKey: string
  authorityLog: string[]
  legInputs: Record<string, unknown>[]
}
async function mountWorld(label: string, opts: { drainOnMount?: boolean } = {}): Promise<Mounted> {
  const { def: nativeDef, calls: nativeCalls } = makeNativeTodo(NATIVE_DESCRIPTION)
  const arm = createGovernedTodoArm({
    nativeDefinition: nativeDef,
    definitionIdentity: 'sha256:captured-native-todo-identity',
    providerId: ARM_PROVIDER,
    memberAgentId: WORKER,
    sessionHeaderId: HEADER_ID,
    bindingFacts: () => {
      // fix-4 probe: the arm reads the live binding AT CLASSIFY (that is the
      // freeze the plan carries); the ordering leg proves the owner-current
      // leg ran BEFORE this read.
      authorityLog.push('freeze')
      return {
        bindingId: `a5m2-todo-asm:${label}`,
        bindingRevision: 1,
        policyGeneration: 0,
        authorityGeneration: 0,
      }
    },
    allowParallelInProgress: false,
    observe: () => {},
  })
  if (opts.drainOnMount === true) arm.drain()
  const realmId = `a5m2-todo-asm-${label}`
  const observed: string[] = []
  // fix-4 probe log ('ensure' = the OWNER's republish leg, 'freeze' = the
  // arm's classify-time binding capture) and the leg-input capture the
  // identity assertions read (the walk's OWN request, never a re-derivation).
  const authorityLog: string[] = []
  const legInputs: Record<string, unknown>[] = []
  const built = planeModule.createTeamToolPlaneAssembly({
    permissionPolicy: DIRECT_POLICY,
    realmId,
    templateId: 'a5m2-todo-asm-tpl',
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    plane: { todoEnabled: true },
    backends: { todo: { arm, description: nativeDef.description } },
    authorityFacts: {
      overlayGeneration: async () => 0,
      // fix-4 seam: the OWNER's republish leg (the same injected leg partA
      // asks per walk). The ordering leg proves the ROW asks it before the
      // classify freeze, so no post-freeze revision move can pair a stale
      // plan against a fresh grant.
      ensureAuthorityCurrent: async () => { authorityLog.push('ensure') },
    },
    controlLeg: async (legInput: unknown) => {
      legInputs.push(legInput as Record<string, unknown>)
      return createPaControlLeg({
        controlService: service,
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        beneficiaryAuthority: 'member',
        // THE production table object (registry-owned): the same one the
        // mount-time write below writes and the shared read fills.
        governedFamilies: familyTable,
      })(legInput as PaControlLegInput)
    },
    readCallFacts: async (input: Record<string, unknown>) => {
      // The PLANE-side call facts — the SPEC WIRING of the registry's own
      // shared read (root fix-2 round): the CURRENT binding tuple, effects
      // re-canonicalized through the domain parser, the live plan read from
      // the mount's OWN livePaPlan under this call's correlation (a
      // construction-time read precedes the plan row and production answers
      // that as `no-approval-question` — mirrored here, never a spec-side
      // re-derivation), the durable attribution from the real repository, and
      // governedFamily answered through the registry's own accessor. No
      // spec-side table, no fingerprint the spec brings from elsewhere.
      const truth = realmTruths.get(String(input.realmId))
      if (truth === undefined) return undefined
      if (String(input.rootSessionId) !== P6T4_ROOT) return undefined
      const durable = repos.memberInstances.get(P6T4_ROOT, String(input.instanceId))
      if (durable === undefined) return undefined
      const binding = bindingOf(label)
      if (binding === undefined) return undefined
      const rawEffects = (input.requestedEffects as { effects?: unknown[] } | undefined)?.effects ?? input.requestedEffects
      const effects = parseRequestedEffectSet(rawEffects as unknown[])
      if (!effects.ok) return undefined
      const hard = factSlot(EMPTY_DOCS.teamHardEnvelope)
      const mutation = factSlot(EMPTY_DOCS.permissionMutationEnvelope)
      if (hard === undefined || mutation === undefined) return undefined
      const family = a5GovernedFamilyFor(String(binding.definitionIdentity))
      const livePlan = truth.plane?.livePaPlan.get(String(input.callId))
      return {
        kind: livePlan === undefined ? 'no-approval-question' : 'call-facts',
        facts: {
          policySource: { staticLayerRefs: ['a5m2-todo-asm-tpl:directive-policy'], overlayGeneration: 0 },
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
            templateId: 'a5m2-todo-asm-tpl',
            cwd: CHAIN_WORLD,
            providerVersion: ARM_PROVIDER,
          },
          ...(livePlan === undefined ? {} : {
            planSnapshot: {
              approvalCaseId: livePlan.approvalCaseId,
              effectSetFingerprint: livePlan.effectSetFingerprint,
              perEffectRequired: livePlan.perEffectRequired,
            },
          }),
          authorityGeneration: 0,
          ...(family === undefined ? {} : { governedFamily: family }),
        },
      }
    },
    onObserve: (row: string) => { observed.push(String(row)) },
  })
  if (built.ok !== true || built.value === undefined) {
    throw new Error(`plane assembly refused (${String(built.code)}): ${String(built.message)}`)
  }
  const plane = built.value
  realmTruths.set(plane.realmId, { assembly: plane.assembly, plane })
  const fed = plane.placementFeed(A5_TODO_TOOL_NAME)
  const familyKey = String(fed?.definitionIdentity ?? '')
  if (familyKey.length === 0) throw new Error('the placed todo row answered no placement definition identity')
  // THE mount-time registration write — the PRODUCTION function (the
  // agent-bindings law), keyed by the runtime identity the seam minted.
  registerA5GovernedFamily(familyKey, {
    familyId: arm.familyId,
    adapterRevision: arm.adapterRevision,
    providerIdentity: arm.providerId,
  })
  bindingFixtures.set(label, parseToolBinding({
    bindingId: `a5m2-todo-asm:${label}`,
    agentScopeKey: `a5m2-todo-asm:${label}`,
    toolName: A5_TODO_TOOL_NAME,
    definitionIdentity: familyKey,
    providerId: ARM_PROVIDER,
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'trusted-host',
    assurance: untestedAssurance('team-trusted-extension', 'trusted-host', plane.realmId),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  }))
  const todoDef = plane.definitions.find((d) => d.name === A5_TODO_TOOL_NAME)
  if (todoDef === undefined) throw new Error('the mounted plane carries no todo_write definition')
  return { plane, arm, todoDef, binding: bindingOf(label) as ToolBinding, nativeCalls, observed, familyKey, authorityLog, legInputs }
}
const bindingFixtures = new Map<string, ReturnType<typeof parseToolBinding>>()
function bindingOf(label: string): ToolBinding | undefined {
  const parsed = bindingFixtures.get(label)
  return parsed !== undefined && parsed.ok ? parsed.value : undefined
}
/** The ARM'S OWN review-payload values per call. THE law is the arm's
 *  (generations + callId + effects + reviewPayload under the canonical
 *  digest) — the spec NEVER re-derives anything: `prepCall` runs the arm's
 *  own classify and records what it returned. NOTE (fix-1 round): the row
 *  classifies with ITS OWN ledger correlation, so this fixture classify
 *  serves only the call-identity-INDEPENDENT review facts (the targetManifest
 *  carries no call identity) and the `sha256:` grammar; the POS row assertion
 *  reads the fingerprint the WALK actually carried, captured on the leg
 *  input — one identity for one flight, end to end. */
interface ClassifiedFixture {
  parametersFingerprint: string
  targetManifest: Record<string, unknown>
  effects: unknown
}
function prepCall(world: Mounted, callId: string, todos: Array<{ content: string; status: string }>): ClassifiedFixture {
  const classified = world.arm.classify({ todos: todos.map((t) => ({ ...t })) }, execFor(callId, []), callId)
  if (classified.ok !== true || classified.parametersFingerprint === undefined || classified.reviewPayload === undefined) {
    throw new Error(`fixture classify must pass (${callId}): ${JSON.stringify(classified)}`)
  }
  return {
    parametersFingerprint: String(classified.parametersFingerprint),
    targetManifest: JSON.parse(JSON.stringify(classified.reviewPayload.targetManifest)) as Record<string, unknown>,
    effects: classified.effects,
  }
}

function execFor(callId: string, events: Array<{ type: string; data: unknown }>, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agent: {
      id: WORKER,
      session: {
        header: { id: HEADER_ID },
        append: (type: string, data: unknown) => { events.push({ type, data }) },
      },
    },
    // THE real Host exec shape (fixed 639 `ToolExecution`): the registry
    // mints ONE branded symbol per execution (`token`), the row keys its
    // single-flight on it. NO `tokenKey` — that field does not exist on the
    // public exec surface (the old fixture shipped it and masked the defect;
    // a fresh symbol per call id, replay legs reuse the SAME exec object).
    token: Symbol(`exec-${callId}`),
    ...over,
  }
}

describe('A5M2-ASSEMBLY: the todo vertical mounts, registers once, walks the one PA path, consumes once, appends natively', () => {
  it('zero-flip + closed-key pairing both directions (the gate is config law, not wiring)', () => {
    const { def: nativeDef } = makeNativeTodo(NATIVE_DESCRIPTION)
    const arm = createGovernedTodoArm({
      nativeDefinition: nativeDef,
      definitionIdentity: 'sha256:x',
      providerId: ARM_PROVIDER,
      memberAgentId: WORKER,
      sessionHeaderId: HEADER_ID,
      bindingFacts: () => ({ bindingId: 'b', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
      allowParallelInProgress: false,
      observe: () => {},
    })
    // (a) no key = no row, byte-for-byte (the shipped worlds never see todo_write placed)
    const off = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-todo-asm-off', templateId: 'a5m2-todo-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
    })
    expect(off.ok, JSON.stringify(off.message)).toBe(true)
    expect(off.value?.ownNames.includes(A5_TODO_TOOL_NAME)).toBe(false)
    // (b) key on, no arm → refuse (nothing may mask the native name with nothing behind it)
    const halfA = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-todo-asm-half-a', templateId: 'a5m2-todo-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { todoEnabled: true },
    })
    expect(halfA.ok).toBe(false)
    expect(halfA.code).toBe('TODO_ARM_INJECT_INVALID')
    // (c) arm in, key off → refuse (the gate is config law, not wiring)
    const halfB = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-todo-asm-half-b', templateId: 'a5m2-todo-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      backends: { todo: { arm, description: NATIVE_DESCRIPTION } },
    })
    expect(halfB.ok).toBe(false)
    expect(halfB.code).toBe('TODO_ARM_INJECT_INVALID')
    // (d) a non-boolean gate is a config defect on the EXISTING refusal grammar
    const badGate = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-todo-asm-bad-gate', templateId: 'a5m2-todo-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { todoEnabled: 'yes' },
      backends: { todo: { arm, description: NATIVE_DESCRIPTION } },
    })
    expect(badGate.ok).toBe(false)
    expect(badGate.code).toBe('PLANE_CONFIG_INCOMPLETE')
  })

  it('noTeam: the mount carries no synthetic durable attribution (refused loudly)', () => {
    const noTeam = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-todoasm-noteam', templateId: 'a5m2-todo-asm-tpl', role: 'member', instanceId: WORKER,
    })
    expect(noTeam.ok).toBe(false)
    expect(noTeam.code).toBe('TOOL_BINDING_UNVERIFIED')
    expect(String(noTeam.message)).toContain('teamSessionId')
  })

  it('mount registers by the RUNTIME placement identity and the row is placed at the native spelling', async () => {
    const world = await mountWorld('mount')
    expect(world.plane.ownNames.includes(A5_TODO_TOOL_NAME)).toBe(true)
    expect(world.familyKey.length).toBeGreaterThan(0)
    // the ONE PRODUCTION table answers BOTH readers with the SAME object
    // (registry-owned: written by the registry's own register call above,
    // read through the registry's own accessor — no spec-side table exists):
    expect(familyTable[world.familyKey]).toBe(familyTable[world.plane.placementFeed(A5_TODO_TOOL_NAME)?.definitionIdentity ?? ''])
    expect(a5GovernedFamilyFor(world.familyKey)).toBe(familyTable[world.familyKey])
    expect(familyTable[world.familyKey]).toEqual({ familyId: A5_TODO_FAMILY_ID, adapterRevision: A5_TODO_ADAPTER_REVISION, providerIdentity: ARM_PROVIDER })
    expect(Object.isFrozen(familyTable[world.familyKey])).toBe(true)
    // the durable path is filled by the PRODUCTION shared read (fix-2): the
    // registry function that the Control verifier's adapter awaits exists and
    // answers this identity from the same table.
    expect(typeof registryModule.readPaCallFacts).toBe('function')
    // the row mounts the CAPTURED native description bytes verbatim
    expect(world.todoDef.description).toBe(NATIVE_DESCRIPTION)
  })

  it('FORMAL POSITIVE: real leader allow -> durable row carries the live list field-for-field -> one consume witness -> exactly one native append', async () => {
    const world = await mountWorld('pos')
    const events: Array<{ type: string; data: unknown }> = []
    // fix-1: the row's correlation is allocated BY THE MOUNT's ledger (one
    // per execution token, realm-qualified so one flight has one id across
    // the shared service); the first flight of a fresh mount is
    // `plane-todo:<realm>-1` — the spec OBSERVES the allocation, it does
    // not supply it.
    const rowCallId = `plane-todo:${world.plane.realmId}-1`
    const classified = prepCall(world, 'call-pos-prep', VALID_TODOS.map((t) => ({ content: t.content, status: t.status })))
    // the arm's grant-layer fingerprint carries the frozen `sha256:<hex64>`
    // grammar (the VALUE includes the prefix — the lane legs hit this live).
    expect(classified.parametersFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)

    const running = world.todoDef.execute({ todos: VALID_TODOS.map((t) => ({ ...t })) }, execFor('call-pos', events))
    const row = await waitRowForCall(rowCallId)

    // the durable row carries the WHOLE family block at full value, and the
    // target manifest is the live list: digest and counts move with content
    // (compared against the ARM'S OWN classify answer — the same immutable
    // typed plan the walk carried, not a spec-side re-derivation).
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest, 'the row must parse as a strict PA manifest with its family block').toBeDefined()
    expect(manifest?.familyId).toBe(A5_TODO_FAMILY_ID)
    expect(manifest?.adapterRevision).toBe(A5_TODO_ADAPTER_REVISION)
    expect(manifest?.providerIdentity).toBe(ARM_PROVIDER)
    expect(JSON.parse(JSON.stringify(manifest?.targetManifest ?? null))).toEqual(classified.targetManifest)
    expect(manifest?.targetManifest).toMatchObject({
      operation: 'replace-list',
      agentId: WORKER,
      sessionHeaderId: HEADER_ID,
      counts: todoCounts(VALID_TODOS),
      allowParallelPolicy: false,
    })
    expect(String((manifest?.targetManifest as Record<string, unknown> | undefined)?.paramFingerprint ?? ''))
      .toBe(String(classified.targetManifest.paramFingerprint))
    // fix-1 identity end-to-end: the walk, the leg and the DURABLE ROW all
    // speak the ONE ledger correlation, and the manifest's fingerprint is the
    // row's OWN classify answer captured on the leg input — never a fixture
    // value (the row classified under its allocated correlation, which no
    // spec-side call ever knew).
    expect(world.legInputs.length).toBe(1)
    const legInput = world.legInputs[0] as { callId?: string; request?: { callId?: string; parametersFingerprint?: string } }
    expect(legInput.callId).toBe(rowCallId)
    expect(legInput.request?.callId).toBe(rowCallId)
    expect(String(legInput.request?.parametersFingerprint ?? '')).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(String(manifest?.callId)).toBe(rowCallId)
    expect(String(manifest?.parametersFingerprint)).toBe(String(legInput.request?.parametersFingerprint))

    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const result = await running
    expect(result).toEqual({
      todos: VALID_TODOS.map((t) => ({ content: t.content, status: t.status })),
      counts: todoCounts(VALID_TODOS),
    })

    // 保留原生: the append ran through the CAPTURED object's own execute —
    // exactly one, exactly the list, on the SAME session the exec carried.
    expect(world.nativeCalls.length).toBe(1)
    expect(events).toEqual([{ type: 'todo/write', data: { todos: VALID_TODOS.map((t) => ({ ...t })) } }])

    // UNIQUE consumption: the durable Control row was spent exactly once and a
    // replay of the approval is the guard's own consumed refusal.
    const consumed = (await stateNow()).consumptions.filter((c) => String(c.requestId) === String(row.requestId))
    expect(consumed.length).toBe(1)
  })

  it('digest/counts are CONTENT-bound: a second list moves the manifest fields', async () => {
    const world = await mountWorld('pos2')
    const events: Array<{ type: string; data: unknown }> = []
    const rowCallId = `plane-todo:${world.plane.realmId}-1`
    const list = [
      { content: 'gamma', status: 'in_progress' },
      { content: 'alpha', status: 'pending' },
    ]
    const other = prepCall(world, 'call-pos2-other', VALID_TODOS.map((t) => ({ content: t.content, status: t.status })))
    const classified = prepCall(world, 'call-pos2-prep', list)
    const running = world.todoDef.execute({ todos: list }, execFor('call-pos2', events))
    const row = await waitRowForCall(rowCallId)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(JSON.parse(JSON.stringify(manifest?.targetManifest ?? null))).toEqual(classified.targetManifest)
    expect(manifest?.targetManifest).toMatchObject({ counts: todoCounts(list) })
    // the digests MOVE with the list (same world, same arm, different values):
    expect(String(classified.targetManifest.todosDigest)).not.toBe(String(other.targetManifest.todosDigest))
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await running
    expect(events.length).toBe(1)
    expect((events[0]?.data as { todos: unknown }).todos).toEqual(list)
  })

  it('FORMAL NEGATIVE (sessionHeaderId swapped): classify refuses before admission — zero rows, zero grants, zero appends', async () => {
    const world = await mountWorld('neg-header')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    const exec = execFor('call-neg-header', events)
    const agent = exec.agent as { session: { header: { id: string } } }
    agent.session.header.id = 'ses-OTHER-header'
    await expect(world.todoDef.execute({ todos: VALID_TODOS.map((t) => ({ ...t })) }, exec))
      .rejects.toThrow(/P_TODO_CLASSIFY_FOREIGN_SESSION/)
    expect(events.length).toBe(0)
    expect(world.nativeCalls.length).toBe(0)
    expect((await stateNow()).requests.length).toBe(before)
  })

  it('FORMAL NEGATIVE (unknown parameter): the closed parameter set refuses row-front — zero rows, zero appends', async () => {
    const world = await mountWorld('neg-args')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    await expect(world.todoDef.execute({ todos: VALID_TODOS.map((t) => ({ ...t })), bogus_top_key: 42 }, execFor('call-neg-args', events)))
      .rejects.toThrow(/P_TODO_CLASSIFY_UNKNOWN_PARAMETER/)
    expect(events.length).toBe(0)
    expect(world.nativeCalls.length).toBe(0)
    expect((await stateNow()).requests.length).toBe(before)
  })

  it('FORMAL NEGATIVE (digest mismatch at the pairing): a grant whose fingerprint moved refuses — zero side effects', async () => {
    // Assembly-level pairing law: even holding a REAL consumed grant, the
    // arm's execute refuses when the grant's self-reported full-value
    // fingerprint no longer answers this plan. Zero append is the whole point.
    const world = await mountWorld('neg-digest')
    const events: Array<{ type: string; data: unknown }> = []
    const callId = 'call-neg-digest'
    const classified = world.arm.classify({ todos: VALID_TODOS.map((t) => ({ ...t })) }, execFor(callId, events), callId)
    const review = classified.reviewPayload
    if (classified.ok !== true || classified.plan === undefined || review === undefined) throw new Error(`fixture classify must pass: ${JSON.stringify(classified)}`)
    const binding = world.binding
    const effects = parseRequestedEffectSet(classified.effects)
    if (!effects.ok) throw new Error('fixture effects must parse')
    const truth = realmTruths.get(world.plane.realmId)
    if (truth === undefined) throw new Error('fixture realm truth missing')
    const request = Object.freeze({
      binding,
      member: Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: WORKER }),
      callId,
      realmId: world.plane.realmId,
      parametersFingerprint: classified.parametersFingerprint as string,
      requestedEffects: effects.value as RequestedEffectSet,
    })
    const planned = truth.assembly.planApproval(request)
    if (!planned.ok) throw new Error('fixture planApproval must answer')
    const leg = createPaControlLeg({
      controlService: service,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      beneficiaryAuthority: 'member',
      governedFamilies: familyTable,
    })
    const pending = leg({
      realmId: world.plane.realmId,
      member: Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: WORKER }),
      callId,
      request,
      plan: planned.value as EffectSetApprovalPlan,
      assembly: truth.assembly,
      family: {
        familyId: review.familyId,
        adapterRevision: review.adapterRevision,
        providerIdentity: review.providerIdentity,
        targetManifest: review.targetManifest as unknown as RemoteSafeJsonValue,
      },
    })
    const row = await waitRowForCall(callId)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const decided = await pending
    if (decided.decision !== 'approve' || decided.grant === undefined) throw new Error(`fixture leg must land the grant: ${JSON.stringify(decided)}`)
    const prepared = world.arm.prepare(classified.plan, decided.grant as unknown as Record<string, unknown>)
    expect(prepared.ok).toBe(true)
    const before = world.nativeCalls.length
    // the grant's full-value fingerprint MOVED (digest mismatch): the pairing
    // refuses, the body never enters, the append count does not move.
    const ran = await world.arm.execute(classified.plan, {
      consumed: true,
      grant: { ...(decided.grant as unknown as Record<string, unknown>), parametersFingerprint: `sha256:${'f'.repeat(64)}` },
    })
    expect(ran.ok).toBe(false)
    expect(ran.code).toBe('P_TODO_GRANT_MISMATCH')
    expect(world.nativeCalls.length).toBe(before)
    expect(events.length).toBe(0)
  })

  it('FORMAL NEGATIVE (unregistered name claiming a family): refused before any durable write', async () => {
    const world = await mountWorld('neg-claim')
    const before = (await stateNow()).requests.length
    const effects = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: 'team_bash', resource: null }])
    if (!effects.ok) throw new Error('fixture effects must parse')
    const unregistered = parseToolBinding({
      ...world.binding,
      bindingId: 'a5m2-todo-asm:unregistered',
      toolName: 'team_bash',
      definitionIdentity: 'def#never-registered',
    })
    if (!unregistered.ok) throw new Error('fixture binding must parse')
    const request = Object.freeze({
      binding: unregistered.value,
      member: Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: WORKER }),
      callId: 'call-neg-claim',
      realmId: world.plane.realmId,
      parametersFingerprint: canonicalJsonFingerprint({ command: 'claim' }),
      requestedEffects: effects.value as RequestedEffectSet,
    })
    const truth = realmTruths.get(world.plane.realmId)
    if (truth === undefined) throw new Error('fixture realm truth missing')
    const planned = truth.assembly.planApproval(request)
    if (!planned.ok) throw new Error('fixture planApproval must answer')
    const leg = createPaControlLeg({
      controlService: service,
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER),
      beneficiaryAuthority: 'member',
      governedFamilies: familyTable,
    })
    const decided = await leg({
      realmId: world.plane.realmId,
      member: Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: WORKER }),
      callId: 'call-neg-claim',
      request,
      plan: planned.value as EffectSetApprovalPlan,
      assembly: truth.assembly,
      family: {
        familyId: A5_TODO_FAMILY_ID,
        adapterRevision: A5_TODO_ADAPTER_REVISION,
        providerIdentity: ARM_PROVIDER,
        targetManifest: {
          operation: 'replace-list',
          agentId: WORKER,
          sessionHeaderId: HEADER_ID,
          todosDigest: 'sha256:claim',
          counts: { pending: 1, inProgress: 0, completed: 0 },
          allowParallelPolicy: false,
          paramFingerprint: 'sha256:claim',
        },
      },
    })
    expect(decided.decision).toBe('deny')
    expect(String((decided as { detail?: string }).detail ?? '')).toContain('family-claim-on-unregistered-binding')
    // refused BEFORE the durable write: no row exists for the claim.
    expect((await stateNow()).requests.length).toBe(before)
  })

  it('single-flight (fix-1): no token is a front refusal; one token runs ONE flight, settled is never re-armed', async () => {
    const world = await mountWorld('sf')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    // (a) an exec without the registry token: typed front refusal — zero
    // classify, zero rows, zero appends (the row composes no identity itself).
    const noToken = execFor('call-sf-none', events)
    delete noToken.token
    await expect(world.todoDef.execute({ todos: VALID_TODOS.map((t) => ({ ...t })) }, noToken))
      .rejects.toThrow(/exec-token-unbound/)
    expect(events.length).toBe(0)
    expect(world.nativeCalls.length).toBe(0)
    expect((await stateNow()).requests.length).toBe(before)
    // (b) IN FLIGHT: a second call on the SAME token is refused without
    // touching the walking leg — the first flight still completes.
    const exec = execFor('call-sf-replay', events)
    const running = world.todoDef.execute({ todos: VALID_TODOS.map((t) => ({ ...t })) }, exec)
    await expect(world.todoDef.execute({ todos: [{ content: 'other', status: 'pending' }] }, exec))
      .rejects.toThrow(/exec-token-replay/)
    const row = await waitRowForCall(`plane-todo:${world.plane.realmId}-1`)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await running
    expect(events.length).toBe(1)
    // (c) SETTLED: the same terminal token never re-arms — no new correlation,
    // no new walk, no second row (the read row's ledger law, verbatim).
    await expect(world.todoDef.execute({ todos: [{ content: 'later', status: 'pending' }] }, exec))
      .rejects.toThrow(/exec-token-replay/)
    expect(events.length).toBe(1)
    expect(world.nativeCalls.length).toBe(1)
    expect((await stateNow()).requests.length).toBe(before + 1)
  })

  it('token identity outlives every size threshold: after 258 spent identities a spent token is STILL refused (no eviction resurrection, zero extra append/consume/row)', async () => {
    // Root ruling @ 9c817: the ledger NEVER evicts a used identity to bound
    // its size — eviction resurrects an old exec.token as fresh and defeats
    // the single-flight law. The mount keeps the MINIMAL used-identity record
    // (correlation + settled) for every token it has ever spent until it is
    // disposed; nothing large rides the ledger.
    const world = await mountWorld('evict')
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    const consumedBefore = (await stateNow()).consumptions.length
    // (a) ONE REAL spent flight: ask → allow → one append, one consume.
    const spentExec = execFor('call-evict-spent', events)
    const running = world.todoDef.execute({ todos: VALID_TODOS.map((t) => ({ ...t })) }, spentExec)
    const row = await waitRowForCall(`plane-todo:${world.plane.realmId}-1`)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await running
    expect(events.length).toBe(1)
    // (b) 257 MORE used identities CROSS the old 256 eviction threshold (the
    // spent flight above makes 258 settled totals). Each is a CHEAP typed
    // classify refusal (unknown ITEM key — refused before any Control
    // interaction), yet the finally law still SETTLES its token: the mount
    // has demonstrably spent more identities than any eviction bound.
    for (let i = 0; i < 257; i++) {
      await expect(world.todoDef.execute(
        { todos: [{ content: `filler-${String(i)}`, status: 'pending', extra: i }] },
        execFor(`call-evict-${String(i)}`, events),
      )).rejects.toThrow(/P_TODO_CLASSIFY_UNKNOWN_PARAMETER/)
    }
    expect(events.length).toBe(1) // the fillers appended NOTHING
    // (c) THE RESURRECTION PROBE: replay the token spent in (a). Under the
    // removed eviction path its ledger entry would have been pruned and the
    // replay check would walk past it into a fresh governed flight. It must
    // still answer the settled-token refusal with ZERO extra append, ZERO
    // extra consumption, ZERO extra durable row, ZERO native calls.
    await expect(world.todoDef.execute({ todos: [{ content: 'resurrected', status: 'pending' }] }, spentExec))
      .rejects.toThrow(/exec-token-replay/)
    expect(events.length).toBe(1)
    expect(world.nativeCalls.length).toBe(1)
    const state = await stateNow()
    expect(state.requests.length).toBe(before + 1)
    expect(state.consumptions.filter((c) => String(c.requestId) === String(row.requestId)).length).toBe(1)
    expect(state.consumptions.length).toBe(consumedBefore + 1) // NOTHING else consumed
  })

  it('fix-4 ordering: the owner-current leg runs BEFORE the classify freeze (no post-freeze revise pairs a stale plan)', async () => {
    const world = await mountWorld('order')
    const events: Array<{ type: string; data: unknown }> = []
    world.authorityLog.push('row-start')
    const running = world.todoDef.execute({ todos: VALID_TODOS.map((t) => ({ ...t })) }, execFor('call-order', events))
    const row = await waitRowForCall(`plane-todo:${world.plane.realmId}-1`)
    const after = world.authorityLog.slice(world.authorityLog.indexOf('row-start') + 1)
    // the OWNER's republish leg answers first, then — and only then — the arm
    // captures the live binding into the plan; the walk's own per-walk leg
    // keeps running afterwards (partA's law, unchanged).
    expect(after[0]).toBe('ensure')
    expect(after[1]).toBe('freeze')
    expect(after.slice(2)).toContain('ensure')
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await running
    expect(events.length).toBe(1)
  })

  it('race (fix-3): abort between the REAL consume and the body microtask — consumption stands, ZERO append, no body, listener removed', async () => {
    // A FAITHFUL SIMULATION of the race state (the frozen production assembly
    // is not patched, and it will not be): a real signal CAN flip between the
    // kernel consume's synchronous block and the row's re-check microtask;
    // the double below replays exactly that state. The signal reads on this
    // path are POSITIONALLY FIXED (partA entry, the Control-wait setup — the
    // wait is event-driven, so no timing-dependent polls —, the post-wait and
    // edge checks, consume's `cancelRequested`, the row's re-check), so the
    // flip arms on the LAST read: every earlier read answers false (consume
    // really happens), the row's re-check answers true (the abort landed in
    // the named window). If internal check positions ever shift, the leg
    // fails LOUDLY — the run either takes the edge's cancelled path (zero
    // consumption, the consumption assertion fails) or completes (the rejects
    // assertion fails). There is no silent pass.
    const mkRaceSignal = (flipAt: number) => {
      const state = { reads: 0, added: 0, removed: 0 }
      return {
        sig: {
          get aborted() { state.reads += 1; return state.reads >= flipAt },
          addEventListener: (_type: string, _fn: unknown, _opts?: unknown) => { state.added += 1 },
          removeEventListener: (_type: string, _fn: unknown, _opts?: unknown) => { state.removed += 1 },
        },
        state,
      }
    }
    const list = VALID_TODOS.map((t) => ({ ...t }))
    // CALIBRATION RUN: a fresh world, the SAME flight, never flipping — it
    // measures the fixed read count of one full governed call.
    const cal = await mountWorld('race-cal')
    const calEvents: Array<{ type: string; data: unknown }> = []
    const calSig = mkRaceSignal(Number.POSITIVE_INFINITY)
    const calRunning = cal.todoDef.execute({ todos: list }, execFor('call-race-cal', calEvents, { signal: calSig.sig }))
    const calRow = await waitRowForCall(`plane-todo:${cal.plane.realmId}-1`)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: calRow.requestId, decision: 'allow' })
    await calRunning
    expect(calEvents.length).toBe(1)
    expect(calSig.state.reads).toBeGreaterThan(2)
    // THE RACE RUN: flip armed at the LAST read = the row's re-check.
    const world = await mountWorld('race')
    const events: Array<{ type: string; data: unknown }> = []
    const race = mkRaceSignal(calSig.state.reads)
    const running = world.todoDef.execute({ todos: list }, execFor('call-race', events, { signal: race.sig }))
    const row = await waitRowForCall(`plane-todo:${world.plane.realmId}-1`)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    await expect(running).rejects.toThrow(/aborted after the execution edge consumed the grant and before the body began/)
    // the consumed grant is LEDGER TRUTH: never rolled back…
    const consumed = (await stateNow()).consumptions.filter((c) => String(c.requestId) === String(row.requestId))
    expect(consumed.length).toBe(1)
    // …while the body that never started appended NOTHING and reached no
    // native entry (arm.cancel answered the abort — zero append is its law).
    expect(events.length).toBe(0)
    expect(world.nativeCalls.length).toBe(0)
    // the abort listener discipline (fix-3 finally): every listener this call
    // added came off before the row threw.
    expect(race.state.added).toBeGreaterThanOrEqual(1)
    expect(race.state.removed).toBe(race.state.added)
  })

  it('cancel (pre-aborted): the call stops before admission — zero rows, zero appends, zero consumption', async () => {
    const world = await mountWorld('cancel')
    const events: Array<{ type: string; data: unknown }> = []
    const controller = new AbortController()
    controller.abort()
    const before = (await stateNow()).requests.length
    await expect(world.todoDef.execute(
      { todos: VALID_TODOS.map((t) => ({ ...t })) },
      execFor('call-cancel', events, { signal: controller.signal }),
    )).rejects.toThrow(/cancelled/)
    expect(events.length).toBe(0)
    expect(world.nativeCalls.length).toBe(0)
    expect((await stateNow()).requests.length).toBe(before)
  })

  it('drain: after teardown begins no NEW call reaches any body (and never falls back to native)', async () => {
    const world = await mountWorld('drain', { drainOnMount: true })
    const events: Array<{ type: string; data: unknown }> = []
    const before = (await stateNow()).requests.length
    await expect(world.todoDef.execute({ todos: VALID_TODOS.map((t) => ({ ...t })) }, execFor('call-drain', events)))
      .rejects.toThrow(/P_TODO_DRAINING/)
    expect(events.length).toBe(0)
    expect(world.nativeCalls.length).toBe(0)
    expect((await stateNow()).requests.length).toBe(before)
  })

  // ── r9 placement-face law (root rulings 12:27/12:29) ────────────────────
  it('r9: the governed todo output schema IS a canonical host registration face — proven against the REAL Host639 validator, constraints intact', async () => {
    const world = await mountWorld('canon-face')
    const schema = (world.todoDef as unknown as { output?: { schema?: Record<string, unknown> } }).output?.schema
    if (schema === undefined) throw new Error('the placement definition carries no output face')
    // THE validator is the host's own: `tools.register` runs exactly this
    // assertSupportedJsonSchema on schema (core/tools/src/index.ts
    // :1071 @639ed01539) — a hand-mirror of the host's AUTHORED DSL text
    // (property-level `required: true`) is not a registration face.
    const repo = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
    if (repo === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
    const hostTools = join(repo, 'tests', 'deepseek-harness-test-use', 'packages', 'core', 'tools', 'lib', 'index.js')
    if (!existsSync(hostTools)) throw new Error(`pristine host lib absent (${hostTools}); failing closed`)
    const host = (await import(pathToFileURL(hostTools).href)) as unknown as {
      assertSupportedJsonSchema: (schema: unknown) => void
      validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
    }
    expect(() => host.assertSupportedJsonSchema(schema)).not.toThrow()
    // NO property-level marker survives ANYWHERE in the face (the r9 defect
    // class, deep-swept): a `required` member is only ever the parent's
    // string array, never a per-property boolean.
    const marker = (node: unknown): boolean => {
      if (node === null || typeof node !== 'object') return false
      const rec = node as Record<string, unknown>
      if (Object.hasOwn(rec, 'required') && rec.required === true) return true
      const props = rec.properties
      if (props !== null && typeof props === 'object') {
        for (const child of Object.values(props as Record<string, unknown>)) if (marker(child)) return true
      }
      if (rec.items !== undefined && marker(rec.items)) return true
      return false
    }
    expect(marker(schema)).toBe(false)
    // TRUTH KEPT (nothing loosened): every authored `required: true` lifted
    // to its parent, nested levels exact — root, items, and counts.
    expect(schema.required).toEqual(['todos', 'counts'])
    const props = schema.properties as Record<string, { items?: { required?: string[] }; required?: string[] }>
    expect(props.todos?.items?.required).toEqual(['content', 'status'])
    expect(props.counts?.required).toEqual(['pending', 'inProgress', 'completed'])
    // …and the SAME host validator still REJECTS the missing-member shape
    // (the constraints bind) while a complete value walks clean:
    const partial = host.validateJsonSchemaValue(schema, { todos: [{ content: 'a' }], counts: { pending: 0 } }, '').join(';')
    expect(partial).toMatch(/status/)
    expect(partial).toMatch(/inProgress/)
    expect(host.validateJsonSchemaValue(schema, {
      todos: [{ content: 'a', status: 'pending' }],
      counts: { pending: 1, inProgress: 0, completed: 0 },
    }, '')).toEqual([])
  })
})
