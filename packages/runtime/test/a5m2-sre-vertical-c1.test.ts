/**
 * A5M2 FS-EDIT card PART E — THE str_replace_editor vertical: the B-SRE row
 * mounts behind its CLOSED `sreEnabled` gate, registers once through the
 * plane's own placement feed, walks the ONE PA path, consumes once, and the
 * FOUR branches answer with the native text face on REAL bytes — the durable
 * row carrying the command-keyed B-SRE manifest (bound law literals, M-02
 * paired-read line on the read branches, creationPossible true only for the
 * branch whose reviewed law creates).
 *
 * Scope: NO Host, NO network; worlds are workspace-internal, removed after.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-sre-vertical-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
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
if (REPO === null) throw new Error('a5m2-sre-vertical: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-sre-vertical-${STAMP}`)
afterAll(() => { rmSync(WORLD_ROOT, { recursive: true, force: true }) })

let worldSeq = 0
function worldDir(label: string): string {
  const dir = join(WORLD_ROOT, `${String(++worldSeq)}-${label}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

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

const HEADER_ID = 'ses-a5m2-sre-header'
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
    policySource: { staticLayerRefs: ['a5m2-sre-asm-tpl:directive-policy'], overlayGeneration: 0 },
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
      templateId: 'a5m2-sre-asm-tpl',
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

function makeNativeSre(): { def: { name: string; description: string } } {
  return { def: { name: 'str_replace_editor', description: 'TEST native str_replace_editor description — the captured bytes the row must carry.' } }
}

const planeModule = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: PlaneFactory
}
const SRE_MOD = (await import(new URL('../src/plugin/live/governed-families/sre.mjs', import.meta.url).href)) as {
  A5_SRE_FAMILY_ID: string
  A5_SRE_ADAPTER_REVISION: number
  A5_SRE_TOOL_NAME: string
  createGovernedSreArm: (deps: Record<string, unknown>) => {
    familyId: string
    adapterRevision: number
    providerId: string
    classify: (args: unknown, exec: Record<string, unknown>, callId: string) => { ok: boolean; code?: string; detail?: string }
    prepare: (plan: unknown, grant: Record<string, unknown>) => { ok: boolean; code?: string }
    execute: (plan: unknown, proof: Record<string, unknown>) => Promise<{ ok: boolean; code?: string }>
    cancel: (plan: unknown) => Record<string, unknown>
    drain: () => void
  }
}
const { A5_SRE_FAMILY_ID, A5_SRE_ADAPTER_REVISION, A5_SRE_TOOL_NAME, createGovernedSreArm } = SRE_MOD

const bindingFixtures = new Map<string, ReturnType<typeof parseToolBinding>>()
function bindingOf(label: string): ToolBinding | undefined {
  const parsed = bindingFixtures.get(label)
  return parsed !== undefined && parsed.ok ? parsed.value : undefined
}

interface Mounted {
  plane: PlaneAssemblyValue
  sreDef: PlaneAssemblyValue['definitions'][number]
  fsRoot: string
  familyKey: string
  legInputs: Record<string, unknown>[]
}

async function mountWorld(label: string): Promise<Mounted> {
  const { def: nativeDef } = makeNativeSre()
  const fsRoot = worldDir(`root-${label}`)
  writeFileSync(join(fsRoot, 'notes.txt'), 'alpha\nbeta\ngamma\n', 'utf8')
  const arm = createGovernedSreArm({
    definitionIdentity: `sha256:captured-native-sre-identity-${label}`,
    providerId: ARM_PROVIDER,
    realmId: `a5m2-sre-asm-${label}`,
    memberAgentId: WORKER,
    sessionHeaderId: HEADER_ID,
    instanceRootDir: fsRoot,
    bindingFacts: () => ({ bindingId: `a5m2-sre-asm:${label}`, bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
    observe: () => {},
  })
  const realmId = `a5m2-sre-asm-${label}`
  const legInputs: Record<string, unknown>[] = []
  const built = planeModule.createTeamToolPlaneAssembly({
    permissionPolicy: DIRECT_POLICY,
    realmId,
    templateId: 'a5m2-sre-asm-tpl',
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    plane: { sreEnabled: true },
    backends: { sre: { arm, description: nativeDef.description } },
    authorityFacts: { overlayGeneration: async () => 0, ensureAuthorityCurrent: async () => {} },
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
          policySource: { staticLayerRefs: ['a5m2-sre-asm-tpl:directive-policy'], overlayGeneration: 0 },
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
            templateId: 'a5m2-sre-asm-tpl',
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
    onObserve: () => {},
  })
  if (built.ok !== true || built.value === undefined) {
    throw new Error(`plane assembly refused (${String(built.code)}): ${String(built.message)}`)
  }
  const plane = built.value
  realmTruths.set(plane.realmId, { assembly: plane.assembly, plane })
  const fed = plane.placementFeed(A5_SRE_TOOL_NAME)
  const familyKey = String(fed?.definitionIdentity ?? '')
  if (familyKey.length === 0) throw new Error('the placed editor row answered no placement definition identity')
  registerA5GovernedFamily(familyKey, {
    familyId: arm.familyId,
    adapterRevision: arm.adapterRevision,
    providerIdentity: arm.providerId,
  })
  bindingFixtures.set(label, parseToolBinding({
    bindingId: `a5m2-sre-asm:${label}`,
    agentScopeKey: `a5m2-sre-asm:${label}`,
    toolName: A5_SRE_TOOL_NAME,
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
  const sreDef = plane.definitions.find((d) => d.name === A5_SRE_TOOL_NAME)
  if (sreDef === undefined) throw new Error('the mounted plane carries no str_replace_editor definition')
  return { plane, sreDef, fsRoot, familyKey, legInputs }
}

function execFor(callId: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agent: {
      id: WORKER,
      session: {
        header: { id: HEADER_ID },
        append: () => {},
      },
    },
    token: Symbol(`exec-${callId}`),
    ...over,
  }
}

async function runBranch(world: Mounted, args: Record<string, unknown>, callId: string, seq: number): Promise<{ value?: string; error?: unknown }> {
  const rowCallId = `plane-sre:${world.plane.realmId}-${String(seq)}`
  const running = world.sreDef.execute(args, execFor(callId))
  const row = await waitRowForCall(rowCallId)
  await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
  try {
    const value = await running
    return { value: String(value) }
  } catch (error) {
    return { error }
  }
}

describe('A5M2-SRE-VERTICAL: the editor row mounts, registers, walks the one PA path; all four branches answer the native text face on REAL bytes', () => {
  it('zero-flip + closed-key pairing both directions', () => {
    const { def: nativeDef } = makeNativeSre()
    const root = worldDir('gate-root')
    const arm = createGovernedSreArm({
      definitionIdentity: 'sha256:x',
      providerId: ARM_PROVIDER,
      realmId: 'a5m2-sre-asm-gate',
      memberAgentId: WORKER,
      sessionHeaderId: HEADER_ID,
      instanceRootDir: root,
      bindingFacts: () => ({ bindingId: 'b', bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
      observe: () => {},
    })
    const off = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-sre-asm-off', templateId: 'a5m2-sre-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
    })
    expect(off.ok, JSON.stringify(off.message)).toBe(true)
    expect(off.value?.ownNames.includes(A5_SRE_TOOL_NAME)).toBe(false)
    const halfA = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-sre-asm-half-a', templateId: 'a5m2-sre-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { sreEnabled: true },
    })
    expect(halfA.ok).toBe(false)
    expect(halfA.code).toBe('SRE_ARM_INJECT_INVALID')
    const halfB = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-sre-asm-half-b', templateId: 'a5m2-sre-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      backends: { sre: { arm, description: nativeDef.description } },
    })
    expect(halfB.ok).toBe(false)
    expect(halfB.code).toBe('SRE_ARM_INJECT_INVALID')
    const badGate = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY, realmId: 'a5m2-sre-asm-bad-gate', templateId: 'a5m2-sre-asm-tpl', role: 'member', instanceId: WORKER, teamSessionId: P6T4_ROOT,
      plane: { sreEnabled: 'yes' },
      backends: { sre: { arm, description: nativeDef.description } },
    })
    expect(badGate.ok).toBe(false)
    expect(badGate.code).toBe('PLANE_CONFIG_INCOMPLETE')
  })

  it('mount + registration + CAPTURED description bytes; the public face is the COMPLETE fixed-639 editor schema; the REAL host register accepts the string-root output face', async () => {
    const world = await mountWorld('mount')
    expect(world.plane.ownNames.includes(A5_SRE_TOOL_NAME)).toBe(true)
    expect(familyTable[world.familyKey]).toEqual({ familyId: A5_SRE_FAMILY_ID, adapterRevision: A5_SRE_ADAPTER_REVISION, providerIdentity: ARM_PROVIDER })
    expect(world.sreDef.description).toBe('TEST native str_replace_editor description — the captured bytes the row must carry.')
    const params = world.sreDef.parameters as Record<string, { type?: string; enum?: string[] }>
    for (const key of ['command', 'path', 'file_text', 'insert_line', 'new_str', 'old_str', 'view_range']) {
      expect(params[key], `public schema carries ${key}`).toBeDefined()
    }
    expect(params.command?.enum).toEqual(['view', 'create', 'str_replace', 'insert'])
    const hostTools = (await import(pathToFileURL(join(REPO, 'tests/deepseek-harness-test-use/packages/core/tools/lib', 'index.js')).href)) as {
      ToolRuntime: { prototype: { register(input: unknown): () => void } }
    }
    let effectCalls = 0
    const fakeThis = { ctx: {}, layers: { effect: () => { effectCalls += 1; return () => {} } } }
    const dispose = hostTools.ToolRuntime.prototype.register.call(fakeThis, world.sreDef as unknown as Record<string, unknown>)
    expect(effectCalls).toBe(1)
    expect(typeof dispose).toBe('function')
  })

  it('FORMAL POSITIVE str_replace: allow -> one consume -> REAL bytes land; the durable B-SRE manifest carries the paired-read group; the value is the native success text', async () => {
    const world = await mountWorld('replace')
    const target = join(world.fsRoot, 'notes.txt')
    const rowCallId = `plane-sre:${world.plane.realmId}-1`
    const running = world.sreDef.execute({ command: 'str_replace', path: 'notes.txt', old_str: 'beta', new_str: 'BETA-2' }, execFor('call-r'))
    const row = await waitRowForCall(rowCallId)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest?.familyId).toBe(A5_SRE_FAMILY_ID)
    expect(manifest?.targetManifest).toMatchObject({
      operation: 'sre-str_replace',
      sreVariant: 'str_replace',
      realmId: world.plane.realmId,
      canonicalTarget: target,
      creationPossible: false,
    })
    expect(String(manifest?.targetManifest?.readEffectLaw)).toContain('另需 read effect')
    expect(String(manifest?.targetManifest?.neverCreatesLaw)).toContain('never creates')
    const effectJson = JSON.stringify(manifest?.effects)
    expect(effectJson).toContain('"read"')
    expect(effectJson).toContain('"write"')
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = await running
    expect(value).toBe(`The file ${target} has been edited successfully.`)
    expect(readFileSync(target, 'utf8')).toBe('alpha\nBETA-2\ngamma\n')
    const consumed = (await stateNow()).consumptions.filter((c) => String(c.requestId) === String(row.requestId))
    expect(consumed.length).toBe(1)
  })

  it('VIEW end-to-end: the durable manifest carries the READ-ONLY effect group (no write); the value is the native numbered view', async () => {
    const world = await mountWorld('view')
    const target = join(world.fsRoot, 'notes.txt')
    const rowCallId = `plane-sre:${world.plane.realmId}-1`
    const running = world.sreDef.execute({ command: 'view', path: 'notes.txt', view_range: [1, 2] }, execFor('call-v'))
    const row = await waitRowForCall(rowCallId)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest?.targetManifest).toMatchObject({ sreVariant: 'view', viewRange: '[1, 2]', creationPossible: false })
    expect(String(manifest?.targetManifest?.viewLaw)).toContain('numbered view')
    const effectJson = JSON.stringify(manifest?.effects)
    expect(effectJson).toContain('"read"')
    expect(effectJson).not.toContain('"write"')
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = String(await running)
    expect(value).toContain(`with view_range=[1, 2]`)
    expect(value).toContain('     2  beta')
    expect(readFileSync(target, 'utf8')).toBe('alpha\nbeta\ngamma\n')
  })

  it('CREATE end-to-end REUSES THE SHIPPED CREATE LAW: the durable manifest binds the creation law (the only creationPossible-true group); the new file lands; overwriting LOSES with the bytes intact', async () => {
    const world = await mountWorld('create')
    const fresh = join(world.fsRoot, 'fresh.txt')
    const rowCallId = `plane-sre:${world.plane.realmId}-1`
    const running = world.sreDef.execute({ command: 'create', path: 'fresh.txt', file_text: 'born governed\n' }, execFor('call-c'))
    const row = await waitRowForCall(rowCallId)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest?.targetManifest).toMatchObject({ sreVariant: 'create', creationPossible: true })
    expect(String(manifest?.targetManifest?.createFileLaw)).toContain('O_EXCL')
    const effectJson = JSON.stringify(manifest?.effects)
    expect(effectJson).toContain('"write"')
    expect(effectJson).not.toContain('"read"')
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = String(await running)
    expect(value).toBe(`New file created successfully at: ${fresh}`)
    expect(readFileSync(fresh, 'utf8')).toBe('born governed\n')
    // the second create over the now-PRESENT target loses the race, bytes intact:
    const second = await runBranch(world, { command: 'create', path: 'fresh.txt', file_text: 'overwrite attempt\n' }, 'call-c2', 2)
    expect(second.error).toBeDefined()
    expect(readFileSync(fresh, 'utf8')).toBe('born governed\n')
    expect(existsSync(join(world.fsRoot, 'never.txt'))).toBe(false)
  })

  it('INSERT end-to-end: the splice lands under the paired-read group; the value is the native success text', async () => {
    const world = await mountWorld('insert')
    const target = join(world.fsRoot, 'notes.txt')
    const rowCallId = `plane-sre:${world.plane.realmId}-1`
    const running = world.sreDef.execute({ command: 'insert', path: 'notes.txt', insert_line: 1, new_str: 'inserted' }, execFor('call-i'))
    const row = await waitRowForCall(rowCallId)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest?.targetManifest).toMatchObject({ sreVariant: 'insert', insertLine: 1, creationPossible: false })
    expect(String(manifest?.targetManifest?.insertLaw)).toContain('insert_line')
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const value = String(await running)
    expect(value).toBe(`The file ${target} has been edited successfully.`)
    expect(readFileSync(target, 'utf8')).toBe('alpha\ninserted\nbeta\ngamma\n')
  })

  it('NO undeclared-parameter lane, end to end: an unknown parameter refuses BEFORE any row exists', async () => {
    const world = await mountWorld('closed')
    const failure = await world.sreDef.execute(
      { command: 'view', path: 'notes.txt', sandbox_permissions: 'danger-full-access' },
      execFor('call-esc'),
    ).then(() => null, (error) => error)
    if (failure === null) throw new Error('the undeclared parameter must refuse')
    expect(String(failure.message)).toContain('UNKNOWN_PARAMETER')
    expect(world.legInputs.length).toBe(0)
    const pending = (await stateNow()).requests.filter((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '').startsWith(`plane-sre:${world.plane.realmId}-`))
    expect(pending.length).toBe(0)
  })
})
