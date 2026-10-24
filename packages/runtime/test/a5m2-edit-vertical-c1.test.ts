/**
 * A5M2 FS-EDIT card (2026-10-25) — THE edit vertical: the B-EDIT row mounts
 * behind its CLOSED gate key, registers once through the plane's own
 * placement feed, walks the ONE PA path, consumes once, and lands REAL
 * bytes through the private post-consume edit closure — with the M-02
 * pre-booked paired-read effect set (I:tool-invoke + F(read exact file) +
 * F(write exact file)) carried into the durable row, and the native
 * {path, before, after} output face registered against the REAL pinned-host
 * tools.register gate.
 *
 * Zero-flip law: with no `editEnabled` key the mount answers nothing new;
 * the pairing enforces BOTH directions (config law, not wiring).
 *
 * Scope: NO Host, NO network; worlds are workspace-internal, removed after.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-edit-vertical-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
import { parseRequestedEffectSet, parseToolBinding } from '../../domain/tool-governance/src/index.js'
import type { ToolBinding } from '../../domain/tool-governance/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { FileStorageSeam } from '../../testkit/fault-injection/file-seam.mjs'
import { createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService } from '../control/index.js'
import { parsePaControlManifest } from '../control/types.js'
import type { PaCallFactsCeilingSlot } from '../control/types.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { untestedAssurance } from '../tool-dispatch/index.js'
import type { ProductionAdmissionAssembly } from '../tool-admission/index.js'
import type { AdmissionRequest, RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { createPaControlLeg, createPaEffectsVerifier } from '../operation-permission/pa-control-bridge.js'
import type { PaControlLegInput, PaEffectsVerifierDeps } from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import { P6T4_BLUEPRINT_SOURCE, P6T4_NOW, P6T4_ROOT, leaderCaller, memberCaller, p6t4Seed } from './p6t4-helpers.js'

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
}
type PlaneFactory = (input: Record<string, unknown>) => { ok: boolean; code?: string; message?: string; value?: PlaneAssemblyValue }

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-edit-vertical: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-edit-vertical-${STAMP}`)
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

const HEADER_ID = 'ses-a5m2-edit-header'
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
const ARM_PROVIDER = 'a5p5-plane'

interface RealmTruth { readonly assembly: ProductionAdmissionAssembly; plane?: PlaneAssemblyValue }
const realmTruths = new Map<string, RealmTruth>()

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
    policySource: { staticLayerRefs: ['a5m2-edit-asm-tpl:directive-policy'], overlayGeneration: 0 },
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
      templateId: 'a5m2-edit-asm-tpl',
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

// ── the TEST-owned native definition (identity + description ONLY) ───────
function makeNativeEdit(): { def: { name: string; description: string } } {
  return { def: { name: 'edit', description: 'TEST native edit description — the captured bytes the row must carry.' } }
}

const planeModule = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: PlaneFactory
}
const EDIT_MOD = (await import(new URL('../src/plugin/live/governed-families/edit.mjs', import.meta.url).href)) as {
  A5_EDIT_FAMILY_ID: string
  A5_EDIT_ADAPTER_REVISION: number
  A5_EDIT_TOOL_NAME: string
  createGovernedEditArm: (deps: {
    definitionIdentity: string
    providerId: string
    realmId: string
    memberAgentId: string
    sessionHeaderId: string
    instanceRootDir: string
    bindingFacts: () => { bindingId: string; bindingRevision: number; policyGeneration: number; authorityGeneration: number }
    observe: (row: unknown) => void
  }) => {
    familyId: string
    adapterRevision: number
    definitionIdentity: string
    providerId: string
    classify: (args: unknown, exec: Record<string, unknown>, callId: string) => { ok: boolean; code?: string; detail?: string }
    prepare: (plan: unknown, grant: Record<string, unknown>) => { ok: boolean; code?: string; detail?: string }
    execute: (plan: unknown, proof: { consumed: boolean; grant: Record<string, unknown>; signal?: { aborted?: boolean } }) => Promise<{ ok: boolean; code?: string; detail?: string; value?: { canonicalLocator: string; before: string; after: string } }>
    cancel: (plan: unknown) => { settled?: string; editOutcome?: string; code?: string }
    drain: () => void
  }
}
const { A5_EDIT_FAMILY_ID, A5_EDIT_ADAPTER_REVISION, A5_EDIT_TOOL_NAME, createGovernedEditArm } = EDIT_MOD

const bindingFixtures = new Map<string, ReturnType<typeof parseToolBinding>>()
function bindingOf(label: string): ToolBinding | undefined {
  const parsed = bindingFixtures.get(label)
  return parsed !== undefined && parsed.ok ? parsed.value : undefined
}

interface Mounted {
  plane: PlaneAssemblyValue
  arm: ReturnType<typeof createGovernedEditArm>
  editDef: PlaneAssemblyValue['definitions'][number]
  fsRoot: string
  observed: string[]
  familyKey: string
  legInputs: Record<string, unknown>[]
}

async function mountWorld(label: string): Promise<Mounted> {
  const { def: nativeDef } = makeNativeEdit()
  const fsRoot = worldDir(`root-${label}`)
  writeFileSync(join(fsRoot, 'notes.txt'), 'alpha\nbeta\ngamma\n', 'utf8')
  const arm = createGovernedEditArm({
    definitionIdentity: `sha256:captured-native-edit-identity-${label}`,
    providerId: ARM_PROVIDER,
    realmId: `a5m2-edit-asm-${label}`,
    memberAgentId: WORKER,
    sessionHeaderId: HEADER_ID,
    instanceRootDir: fsRoot,
    bindingFacts: () => ({
      bindingId: `a5m2-edit-asm:${label}`,
      bindingRevision: 1,
      policyGeneration: 0,
      authorityGeneration: 0,
    }),
    observe: () => {},
  })
  const realmId = `a5m2-edit-asm-${label}`
  const observed: string[] = []
  const legInputs: Record<string, unknown>[] = []
  const built = planeModule.createTeamToolPlaneAssembly({
    permissionPolicy: DIRECT_POLICY,
    realmId,
    templateId: 'a5m2-edit-asm-tpl',
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    plane: { editEnabled: true },
    backends: { edit: { arm, description: nativeDef.description } },
    authorityFacts: {
      overlayGeneration: async () => 0,
      ensureAuthorityCurrent: async () => {},
    },
    controlLeg: async (legInput: unknown) => {
      legInputs.push(legInput as Record<string, unknown>)
      return createPaControlLeg({
        controlService: service,
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        beneficiaryAuthority: 'member',
        governedFamilies: familyTable,
      })(legInput as PaControlLegInput)
    },
    readCallFacts: async (input: Record<string, unknown>) => {
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
          policySource: { staticLayerRefs: ['a5m2-edit-asm-tpl:directive-policy'], overlayGeneration: 0 },
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
            templateId: 'a5m2-edit-asm-tpl',
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
  const fed = plane.placementFeed(A5_EDIT_TOOL_NAME)
  const familyKey = String(fed?.definitionIdentity ?? '')
  if (familyKey.length === 0) throw new Error('the placed edit row answered no placement definition identity')
  registerA5GovernedFamily(familyKey, {
    familyId: arm.familyId,
    adapterRevision: arm.adapterRevision,
    providerIdentity: arm.providerId,
  })
  bindingFixtures.set(label, parseToolBinding({
    bindingId: `a5m2-edit-asm:${label}`,
    agentScopeKey: `a5m2-edit-asm:${label}`,
    toolName: A5_EDIT_TOOL_NAME,
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
  const editDef = plane.definitions.find((d) => d.name === A5_EDIT_TOOL_NAME)
  if (editDef === undefined) throw new Error('the mounted plane carries no edit definition')
  return { plane, arm, editDef, fsRoot, observed, familyKey, legInputs }
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
    token: Symbol(`exec-${callId}`),
    ...over,
  }
}

const sha256Hex = (text: string) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`

describe('A5M2-EDIT-VERTICAL: the edit row mounts, registers, walks the one PA path, consumes once, lands REAL bytes through the post-consume edit closure with the M-02 paired-read effect set', () => {
  it('zero-flip + closed-key pairing both directions (the gate is config law, not wiring)', () => {
    const { def: nativeDef } = makeNativeEdit()
    const root = worldDir('gate-root')
    const arm = createGovernedEditArm({
      definitionIdentity: 'sha256:x',
      providerId: ARM_PROVIDER,
      realmId: 'a5m2-edit-asm-gate',
      memberAgentId: WORKER,
      sessionHeaderId: HEADER_ID,
      instanceRootDir: root,
      bindingFacts: () => ({ bindingId: 'b', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
      observe: () => {},
    })
    const off = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-edit-asm-off', templateId: 'a5m2-edit-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
    })
    expect(off.ok, JSON.stringify(off.message)).toBe(true)
    expect(off.value?.ownNames.includes(A5_EDIT_TOOL_NAME)).toBe(false)
    const halfA = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-edit-asm-half-a', templateId: 'a5m2-edit-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { editEnabled: true },
    })
    expect(halfA.ok).toBe(false)
    expect(halfA.code).toBe('EDIT_ARM_INJECT_INVALID')
    const halfB = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-edit-asm-half-b', templateId: 'a5m2-edit-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      backends: { edit: { arm, description: nativeDef.description } },
    })
    expect(halfB.ok).toBe(false)
    expect(halfB.code).toBe('EDIT_ARM_INJECT_INVALID')
    const badGate = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-edit-asm-bad-gate', templateId: 'a5m2-edit-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { editEnabled: 'yes' },
      backends: { edit: { arm, description: nativeDef.description } },
    })
    expect(badGate.ok).toBe(false)
    expect(badGate.code).toBe('PLANE_CONFIG_INCOMPLETE')
  })

  it('mount + registration + the CAPTURED description bytes; the public face is the COMPLETE fixed-639 edit schema', async () => {
    const world = await mountWorld('mount')
    expect(world.plane.ownNames.includes(A5_EDIT_TOOL_NAME)).toBe(true)
    expect(world.familyKey.length).toBeGreaterThan(0)
    expect(familyTable[world.familyKey]).toEqual({ familyId: A5_EDIT_FAMILY_ID, adapterRevision: A5_EDIT_ADAPTER_REVISION, providerIdentity: ARM_PROVIDER })
    expect(Object.isFrozen(familyTable[world.familyKey])).toBe(true)
    expect(world.editDef.description).toBe('TEST native edit description — the captured bytes the row must carry.')
    const params = world.editDef.parameters as { properties: Record<string, unknown>; required: string[] }
    for (const key of ['file_path', 'old_string', 'new_string', 'replace_all', 'sandbox_permissions', 'justification']) {
      expect(params.properties[key], `public schema carries ${key}`).toBeDefined()
    }
    expect(params.required).toEqual(['file_path', 'old_string', 'new_string'])
  })

  it('the REAL pinned-host tools.register gate accepts the edit row (output {schema, render} with the native {path,before,after} face required at the parent)', async () => {
    const world = await mountWorld('register')
    const hostTools = (await import(pathToFileURL(join(REPO, 'tests/deepseek-harness-test-use/packages/core/tools/lib', 'index.js')).href)) as {
      ToolRuntime: { prototype: { register(input: unknown): () => void } }
    }
    let effectCalls = 0
    const fakeThis = { ctx: {}, layers: { effect: () => { effectCalls += 1; return () => {} } } }
    const def = world.editDef as unknown as Record<string, unknown>
    const output = (def as { output?: { schema?: { required?: string[] }; render?: unknown } }).output
    expect(typeof output?.render).toBe('function')
    expect(output?.schema?.required).toEqual(['path', 'before', 'after'])
    const dispose = hostTools.ToolRuntime.prototype.register.call(fakeThis, def)
    expect(effectCalls).toBe(1)
    expect(typeof dispose).toBe('function')
  })

  it('FORMAL POSITIVE: real allow -> one consume -> REAL bytes land; the durable manifest carries the B-EDIT paired-read law; the value is the native {path,before,after} face', async () => {
    const world = await mountWorld('pos')
    const events: Array<{ type: string; data: unknown }> = []
    const rowCallId = `plane-edit:${world.plane.realmId}-1`
    const target = join(world.fsRoot, 'notes.txt')
    const running = world.editDef.execute({ file_path: 'notes.txt', old_string: 'beta', new_string: 'BETA-2' }, execFor('call-pos', events))
    const row = await waitRowForCall(rowCallId)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest, 'the row must parse as a strict PA manifest with its family block').toBeDefined()
    expect(manifest?.familyId).toBe(A5_EDIT_FAMILY_ID)
    expect(manifest?.adapterRevision).toBe(A5_EDIT_ADAPTER_REVISION)
    expect(manifest?.providerIdentity).toBe(ARM_PROVIDER)
    expect(manifest?.targetManifest).toMatchObject({
      operation: 'edit-file',
      realmId: world.plane.realmId,
      canonicalTarget: target,
      oldFingerprint: sha256Hex('beta'),
      newFingerprint: sha256Hex('BETA-2'),
      replaceAll: false,
      creationPossible: false,
    })
    // THE M-02 pre-booked law, verbatim in the APPROVED facts (the durable
    // row, not just the arm comment):
    expect(String(manifest?.targetManifest?.readEffectLaw)).toContain('另需 read effect')
    expect(String(manifest?.targetManifest?.echoLaw)).toContain('paired READ effect')
    // the effects: read AND write on the ONE exact locator
    const effectJson = JSON.stringify(manifest?.effects)
    expect(effectJson).toContain('"read"')
    expect(effectJson).toContain('"write"')
    expect(effectJson).toContain('notes.txt')
    expect(world.legInputs.length).toBe(1)

    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = await running
    // the NATIVE output face (projection of the arm receipt at the row):
    expect(value).toEqual({ path: target, before: 'alpha\nbeta\ngamma\n', after: 'alpha\nBETA-2\ngamma\n' })
    // the REAL effect, asserted by re-read, never by the receipt's word:
    expect(readFileSync(target, 'utf8')).toBe('alpha\nBETA-2\ngamma\n')
    expect(events.length).toBe(0)
    const consumed = (await stateNow()).consumptions.filter((c) => String(c.requestId) === String(row.requestId))
    expect(consumed.length).toBe(1)
  })

  it('THE EDIT NEVER CREATES, end to end: absent target refuses typed through the row with the risk facts IN-BAND and zero creation', async () => {
    const world = await mountWorld('absent')
    const rowCallId = `plane-edit:${world.plane.realmId}-1`
    const fresh = join(world.fsRoot, 'ghost.txt')
    const running = world.editDef.execute({ file_path: 'ghost.txt', old_string: 'x', new_string: 'y' }, execFor('call-absent', []))
    const row = await waitRowForCall(rowCallId)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const failure = await running.then(() => null, (error) => error)
    if (failure === null) throw new Error('the absent-target edit must refuse')
    expect(String(failure.message)).toContain('cf-class=denied · cf-reason=not-a-file')
    expect(failure.cfReason).toBe('not-a-file')
    expect(String(failure.message)).toContain('NEVER creates')
    expect(existsSync(fresh)).toBe(false)
  })

  it('NO ESCALATION LANE, end to end: a set sandbox_permissions refuses typed BEFORE any row exists', async () => {
    const world = await mountWorld('escalate')
    const failure = await world.editDef.execute(
      { file_path: 'notes.txt', old_string: 'beta', new_string: 'B', sandbox_permissions: 'danger-full-access' },
      execFor('call-esc', []),
    ).then(() => null, (error) => error)
    if (failure === null) throw new Error('the escalation field must refuse')
    expect(String(failure.message)).toContain('NO escalation lane')
    expect(world.legInputs.length).toBe(0)
    const pending = (await stateNow()).requests.filter((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '').startsWith(`plane-edit:${world.plane.realmId}-`))
    expect(pending.length).toBe(0)
    expect(readFileSync(join(world.fsRoot, 'notes.txt'), 'utf8')).toBe('alpha\nbeta\ngamma\n')
  })
})
