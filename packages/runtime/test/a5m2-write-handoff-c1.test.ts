/**
 * A5-M2 WRITE PA HAND-OFF (root 13:38 MIN product fix, write C2 step 2-3):
 * the governed WRITE row's pre-dispatch hand-off on the REAL chain, mirroring
 * the audited M1 READ hand-off legs (a5-m1-read-c1c2 M1-M5) with the laws the
 * write row owns. What this spec pins:
 *
 *  - OPEN asks the full PA effect-set question for the ONE name THIS mount
 *    placed (never a name guess by anyone: the PORT answers 'no-match' for
 *    every other spelling), and the old operation front door therefore opens
 *    NOTHING (zero control-leg entries on the all-allow world);
 *  - the body REDEEMS through the SAME production edge: fresh classify, the
 *    exact-match recheck (call identity + full-values fingerprint), the edge's
 *    FRESH facts re-read and the ONE consume — then the reviewed closure lands
 *    the bytes (no native face anywhere on the path);
 *  - Part A is NEVER re-run: a second open on the token refuses side-effect-
 *    free (IN_FLIGHT / TERMINAL, ownsHandoff:false), a lost or double-taken
 *    flight refuses PA_HANDOFF_LOST, drift refuses PA_HANDOFF_MISMATCH — all
 *    with ZERO bytes; there is no native fallback and no fallback walk;
 *  - terminal close and the mount teardown end every leg and flight: the plan
 *    fact, the unspent grant and the token (terminal, never re-armed) all die;
 *    a late body refuses, never writes;
 *  - the ASK lane endures too: the pre-dispatch open waits on the REAL
 *    durable Control row (the PA manifest carries the write family block), the
 *    human allow releases it, and the body still redeems with the fresh
 *    recheck and the single consume;
 *  - ABSENCE is field presence: a mount without the governed write row does
 *    not declare `paWriteHandoff` at all (omitted, not `undefined`).
 *
 * Scope: NO Host, NO network; worlds are workspace-internal, removed after.
 * The disclosed stand-ins are EXACTLY the ones a5m2-write-existing-c1 declares
 * (the TEST-owned native identity/description object; every authority part is
 * the production module).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-write-handoff-c1
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
    execute: (args: unknown, exec?: unknown) => Promise<unknown>
  }>
  paWriteHandoff?: {
    open: (exec: object) => Promise<{ kind: string; correlation?: string; code?: string; detail?: string; ownsHandoff?: boolean }>
    close: (exec: object) => void
  }
  placementFeed: (name: string) => { definitionIdentity?: string; realmId: string } | undefined
  mount: (agentCtx: { tools: { register: (def: unknown) => unknown } }) => { ok: boolean; dispose: () => void }
  livePaPlan: Map<string, { approvalCaseId: string; effectSetFingerprint: string; perEffectRequired: unknown[]; requestedEffects?: unknown }>
  realmId: string
  assembly: ProductionAdmissionAssembly
}
interface PlaneResult {
  ok: boolean
  code?: string
  message?: string
  value?: PlaneAssemblyValue
}
type PlaneFactory = (input: Record<string, unknown>) => PlaneResult

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-write-handoff: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-write-handoff-${STAMP}`)
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

const HEADER_ID = 'ses-a5m2-write-handoff-header'
// The plain containment law the production factory carries (the read round's
// seam, verbatim): a subtree rule is answerable ONLY through an injected seam,
// never guessed (plane lane decide + kernel projection share this one law).
const subtreeContains = (parent: string, child: string) => child === parent || child.startsWith(parent + '/')
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

/** THE PRODUCTION registration table (the write-existing round's law, unchanged). */
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
    policySource: { staticLayerRefs: ['a5m2-write-handoff-tpl:directive-policy'], overlayGeneration: 0 },
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
      templateId: 'a5m2-write-handoff-tpl',
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
async function waitRowForCall(callId: string, timeoutMs = 20_000): Promise<ControlRequestRecord> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const state = await service.listControlState(P6T4_ROOT)
    const found = state.requests.find((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '') === callId)
    if (found !== undefined) return found
    if (Date.now() > deadline) throw new Error(`the durable control row for ${callId} never appeared`)
    await sleep(25)
  }
}

const planeModule = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  createTeamToolPlaneAssembly: PlaneFactory
}
const WRITE_MOD = (await import(new URL('../src/plugin/live/governed-families/write.mjs', import.meta.url).href)) as {
  A5_WRITE_FAMILY_ID: string
  A5_WRITE_ADAPTER_REVISION: number
  A5_WRITE_TOOL_NAME: string
  createGovernedWriteArm: (deps: Record<string, unknown>) => {
    familyId: string
    adapterRevision: number
    definitionIdentity: string
    providerId: string
    classify: (args: unknown, exec: Record<string, unknown>, callId: string) => unknown
    prepare: (plan: unknown, grant: Record<string, unknown>) => unknown
    execute: (plan: unknown, proof: Record<string, unknown>) => Promise<unknown>
    cancel: (plan: unknown) => unknown
    drain: () => void
  }
}
const { A5_WRITE_FAMILY_ID, A5_WRITE_ADAPTER_REVISION, A5_WRITE_TOOL_NAME, createGovernedWriteArm } = WRITE_MOD

const bindingFixtures = new Map<string, ReturnType<typeof parseToolBinding>>()
function bindingOf(label: string): ToolBinding | undefined {
  const parsed = bindingFixtures.get(label)
  return parsed !== undefined && parsed.ok ? parsed.value : undefined
}

interface Mounted {
  plane: PlaneAssemblyValue
  port: NonNullable<PlaneAssemblyValue['paWriteHandoff']>
  writeDef: PlaneAssemblyValue['definitions'][number]
  fsRoot: string
  observed: string[]
  legInputs: unknown[]
  asked: number
}

/** One mounted world: a unique realm, the REAL arm over a REAL
 *  workspace-internal root carrying ONE EXISTING target file ('old bytes\n'),
 *  the mount-time family registration through the plane's OWN placementFeed,
 *  and the plane-side call facts wired to the registry's shared read law
 *  (the write-existing round's harness, unchanged — the ONLY addition is the
 *  policy choice: the all-allow world answers Part A with NO approval question
 *  (zero control-leg entries = the front door opens NOTHING), the ask world
 *  rides the real durable Control row. */
async function mountWorld(label: string, opts: { ask?: boolean } = {}): Promise<Mounted> {
  const fsRoot = worldDir(`root-${label}`)
  writeFileSync(join(fsRoot, 'notes.txt'), 'old bytes\n', 'utf8')
  const policy: TemplatePermissionPolicy = opts.ask === true
    ? DIRECT_POLICY
    : Object.freeze({
        default: 'deny',
        allow: [Object.freeze({ tool: 'write', resource: Object.freeze({ kind: 'subtree', path: fsRoot }) })],
        ask: [],
        deny: [],
      } as unknown as TemplatePermissionPolicy)
  const arm = createGovernedWriteArm({
    definitionIdentity: `sha256:captured-native-write-identity-${label}`,
    providerId: ARM_PROVIDER,
    realmId: `a5m2-write-handoff-${label}`,
    memberAgentId: WORKER,
    sessionHeaderId: HEADER_ID,
    instanceRootDir: fsRoot,
    bindingFacts: () => ({
      bindingId: `a5m2-write-handoff:${label}`,
      bindingRevision: 1,
      policyGeneration: 0,
      authorityGeneration: 0,
    }),
    observe: () => {},
  })
  const realmId = `a5m2-write-handoff-${label}`
  const observed: string[] = []
  const legInputs: unknown[] = []
  let asked = 0
  const built = planeModule.createTeamToolPlaneAssembly({
    permissionPolicy: policy,
    realmId,
    templateId: 'a5m2-write-handoff-tpl',
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    plane: { writeEnabled: true },
    fs: { subtreeContains },
    backends: { write: { arm, description: 'TEST native write description — the captured bytes the row must carry.' } },
    authorityFacts: {
      overlayGeneration: async () => 0,
      ensureAuthorityCurrent: async () => {},
    },
    controlLeg: async (legInput: unknown) => {
      legInputs.push(legInput)
      return createPaControlLeg({
        controlService: service,
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        beneficiaryAuthority: 'member',
        governedFamilies: familyTable,
      })(legInput as PaControlLegInput)
    },
    readCallFacts: async (input: Record<string, unknown>) => {
      asked += 1
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
          policySource: { staticLayerRefs: ['a5m2-write-handoff-tpl:directive-policy'], overlayGeneration: 0 },
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
            templateId: 'a5m2-write-handoff-tpl',
            cwd: CHAIN_WORLD,
            providerVersion: ARM_PROVIDER,
          },
          ...(livePlan === undefined ? {} : {
            planSnapshot: {
              approvalCaseId: String((livePlan as { approvalCaseId: string }).approvalCaseId),
              effectSetFingerprint: String((livePlan as { effectSetFingerprint: string }).effectSetFingerprint),
              perEffectRequired: (livePlan as { perEffectRequired: unknown[] }).perEffectRequired,
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
  const fed = plane.placementFeed(A5_WRITE_TOOL_NAME)
  const familyKey = String(fed?.definitionIdentity ?? '')
  if (familyKey.length === 0) throw new Error('the placed write row answered no placement definition identity')
  registerA5GovernedFamily(familyKey, {
    familyId: arm.familyId,
    adapterRevision: arm.adapterRevision,
    providerIdentity: arm.providerId,
  })
  bindingFixtures.set(label, parseToolBinding({
    bindingId: `a5m2-write-handoff:${label}`,
    agentScopeKey: `a5m2-write-handoff:${label}`,
    toolName: A5_WRITE_TOOL_NAME,
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
  const writeDef = plane.definitions.find((d) => d.name === A5_WRITE_TOOL_NAME)
  if (writeDef === undefined) throw new Error('the mounted plane carries no write definition')
  if (plane.paWriteHandoff === undefined) throw new Error('a governed-write mount MUST declare paWriteHandoff')
  return { plane, port: plane.paWriteHandoff, writeDef, fsRoot, observed, legInputs, get asked() { return asked } } as Mounted & { asked: number }
}

function execLike(token: symbol, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'write',
    token,
    arguments: { file_path: 'notes.txt', content: 'handoff bytes\n' },
    agent: {
      id: WORKER,
      session: { header: { id: HEADER_ID }, append: () => {} },
    },
    ...over,
  }
}

const sha256Hex = (text: string) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`

describe('A5-M2 WRITE PA HAND-OFF — the pre-dispatch open asks the full question at PA; the body redeems through the same fresh edge; every non-redemption refuses with zero bytes', () => {
  it('WH-M1 production A→B: the open leg authorizes on the REAL walk with ZERO front-door entries, the body re-checks fresh, consumes once and the bytes land', async () => {
    const world = await mountWorld('m1')
    const target = join(world.fsRoot, 'notes.txt')
    const token = Symbol('a5m2-write-handoff-m1')
    const exec = execLike(token)
    const opened = await world.port.open(exec)
    expect(opened.kind, JSON.stringify(opened)).toBe('authorized')
    expect(opened.correlation, 'the row mints the correlation').toMatch(/^plane-write:/)
    expect(world.legInputs.length, 'the all-allow answer opens NO approval question — the old front door is opened NOTHING').toBe(0)
    expect(world.plane.livePaPlan.size, 'an all-allow answer creates no plan fact').toBe(0)
    expect(world.asked, 'Part A read the call-level facts for THIS call').toBeGreaterThanOrEqual(1)
    expect(world.observed.some((r) => r.includes('a5m2-write pa-handoff OPEN')), 'the OPEN witness rode the observation stream').toBe(true)
    const askedAfterOpen = world.asked
    const content = 'handoff bytes\n'
    const ran = await world.writeDef.execute({ file_path: 'notes.txt', content }, exec)
    const receipt = ran as { canonicalLocator?: string; writtenFingerprint?: string; existingFileOnly?: boolean }
    expect(receipt.canonicalLocator, 'the reviewed receipt names the approved target').toBe(target)
    expect(receipt.existingFileOnly, 'the HELD fact rides the receipt').toBe(true)
    expect(String(receipt.writtenFingerprint), 'the receipt carries its content digest').toMatch(/^sha256:/)
    expect(readFileSync(target, 'utf8'), 'the redemption runs the real execution edge and writes').toBe(content)
    expect(world.asked, 'Part B re-read the facts FRESH — the edge never trusts Part A\'s read').toBeGreaterThan(askedAfterOpen)
    expect(world.plane.livePaPlan.size, 'the redemption is the end of this call\'s plan fact').toBe(0)
    // the terminal close after the body is a no-op (the redeemed flight was
    // taken at the body's synchronous take; a close owns nothing more).
    world.port.close(exec)
    expect(world.plane.livePaPlan.size, 'a terminal close after the redemption changes nothing').toBe(0)
  })

  it('WH-M2 the terminal close before the body: the flight dies, the token goes terminal, the late body REFUSES with zero bytes', async () => {
    const world = await mountWorld('m2')
    const target = join(world.fsRoot, 'notes.txt')
    const exec = execLike(Symbol('a5m2-write-handoff-m2'))
    const opened = await world.port.open(exec)
    expect(opened.kind).toBe('authorized')
    world.port.close(exec)
    await expect(world.writeDef.execute({ file_path: 'notes.txt', content: 'late bytes\n' }, exec))
      .rejects.toThrow(/exec-token-replay/)
    expect(readFileSync(target, 'utf8'), 'the closed hand-off wrote NOTHING').toBe('old bytes\n')
    const again = await world.port.open(exec)
    expect(again.code, 'a terminal token is never re-armed').toBe('PA_HANDOFF_TERMINAL')
  })

  it('WH-M3 a second open on the same token is SIDE-EFFECT-FREE: refused IN_FLIGHT, ownsHandoff false, zero extra facts, and the OWNING leg still redeems', async () => {
    const world = await mountWorld('m3')
    const target = join(world.fsRoot, 'notes.txt')
    const exec = execLike(Symbol('a5m2-write-handoff-m3'))
    const first = await world.port.open(exec)
    expect(first.kind).toBe('authorized')
    const askedAfterFirst = world.asked
    const second = await world.port.open(exec)
    expect(second.kind, 'a duplicate open is refused, never an authorization').toBe('refused')
    expect(second.code).toBe('PA_HANDOFF_IN_FLIGHT')
    expect(second.ownsHandoff, 'the real port states: this entry owns nothing to clean (the adapter leaves the first leg alone)').toBe(false)
    expect(world.asked, 'the duplicate asked the facts entry ZERO extra times').toBe(askedAfterFirst)
    const ran = await world.writeDef.execute({ file_path: 'notes.txt', content: 'handoff bytes\n' }, exec)
    expect(JSON.stringify(ran), 'the owning leg still redeems after a refused duplicate').toContain('notes.txt')
    expect(readFileSync(target, 'utf8')).toBe('handoff bytes\n')
  })

  it('WH-M3b the take is SYNCHRONOUS and SINGLE: a re-entrant second redemption finds no flight and refuses PA_HANDOFF_LOST while the first lands', async () => {
    const world = await mountWorld('m3b')
    const target = join(world.fsRoot, 'notes.txt')
    const exec = execLike(Symbol('a5m2-write-handoff-m3b'))
    const opened = await world.port.open(exec)
    expect(opened.kind).toBe('authorized')
    const first = world.writeDef.execute({ file_path: 'notes.txt', content: 'handoff bytes\n' }, exec)
    const second = world.writeDef.execute({ file_path: 'notes.txt', content: 'handoff bytes\n' }, exec)
    await expect(second).rejects.toThrow(/PA_HANDOFF_LOST/)
    await first
    expect(readFileSync(target, 'utf8'), 'exactly one flight landed').toBe('handoff bytes\n')
  })

  it('WH-M4 a close landing MID-WALK ends the leg: the late answer registers nothing (PA_HANDOFF_CLOSED), the token is terminal, zero bytes follow', async () => {
    const world = await mountWorld('m4')
    const target = join(world.fsRoot, 'notes.txt')
    const exec = execLike(Symbol('a5m2-write-handoff-m4'))
    const leg = world.port.open(exec)
    // Close while the leg is still in flight: the placeholder is released and
    // the leg's own after-await re-check must drop its answer.
    world.port.close(exec)
    const late = await leg
    expect(late.kind, 'a closed leg never hands off').toBe('refused')
    expect(late.code).toBe('PA_HANDOFF_CLOSED')
    expect(late.ownsHandoff, 'the leg that dropped an ANSWERED walk states it owns the cleanup').toBe(true)
    expect(world.plane.livePaPlan.size, 'the dropped answer registers nothing').toBe(0)
    const again = await world.port.open(exec)
    expect(again.code, 'a terminal token is never re-armed').toBe('PA_HANDOFF_TERMINAL')
    await expect(world.writeDef.execute({ file_path: 'notes.txt', content: 'late bytes\n' }, exec))
      .rejects.toThrow(/exec-token-replay/)
    expect(readFileSync(target, 'utf8'), 'nothing reached the closure').toBe('old bytes\n')
  })

  it('WH-M5 the mount teardown ends every flight: the unspent claim dies, the token is terminal, a late body refuses, a late open refuses, zero bytes', async () => {
    const world = await mountWorld('m5')
    const target = join(world.fsRoot, 'notes.txt')
    const exec = execLike(Symbol('a5m2-write-handoff-m5'))
    const opened = await world.port.open(exec)
    expect(opened.kind).toBe('authorized')
    const mounted = world.plane.mount({ tools: { register: () => () => {} } })
    expect(mounted.ok).toBe(true)
    mounted.dispose()
    // The ledger's ONE release point is dispose (root ruling @ 9c817): after
    // it the token is no longer a used identity, so the late body enters as a
    // fresh call and the DRAINED arm refuses it at classify — zero writes, and
    // there is no native fallback to fall back to (the claim itself died with
    // the mount: no grant, no plan fact, no bytes).
    await expect(world.writeDef.execute({ file_path: 'notes.txt', content: 'late bytes\n' }, exec))
      .rejects.toThrow(/P_WRITE_DRAINING/)
    const again = await world.port.open(exec)
    expect(again.kind, 'no hand-off survives the mount — the terminal token says so').toBe('refused')
    expect(['PA_HANDOFF_TERMINAL', 'PA_HANDOFF_MOUNT_GONE']).toContain(again.code)
    expect(readFileSync(target, 'utf8'), 'the teardown left the target untouched').toBe('old bytes\n')
    expect(world.plane.livePaPlan.size, 'no plan fact survives the mount').toBe(0)
  })

  it('WH-M6 the body re-classifies FRESH: drifted argument bytes REFUSE the redemption (PA_HANDOFF_MISMATCH), zero bytes, the fact is closed', async () => {
    const world = await mountWorld('m6')
    const target = join(world.fsRoot, 'notes.txt')
    const exec = execLike(Symbol('a5m2-write-handoff-m6'))
    const opened = await world.port.open(exec)
    expect(opened.kind).toBe('authorized')
    await expect(world.writeDef.execute({ file_path: 'notes.txt', content: 'DIFFERENT bytes\n' }, exec))
      .rejects.toThrow(/PA_HANDOFF_MISMATCH/)
    expect(readFileSync(target, 'utf8'), 'a drifted redemption runs nothing').toBe('old bytes\n')
    expect(world.plane.livePaPlan.size, 'the refused redemption closes its plan fact (none existed here — and never leaks one either)').toBe(0)
    // The token is settled by the refused flight: a second body on it refuses
    // as a replay, and no re-walk serves it either (Part A is never re-run).
    await expect(world.writeDef.execute({ file_path: 'notes.txt', content: 'DIFFERENT bytes\n' }, exec))
      .rejects.toThrow(/exec-token-replay/)
    expect(readFileSync(target, 'utf8')).toBe('old bytes\n')
  })

  it('WH-M7 the port answers ONLY for the ONE name this mount placed: every other spelling is no-match and touches NO state', async () => {
    const world = await mountWorld('m7')
    const token = Symbol('a5m2-write-handoff-m7')
    for (const name of ['read', 'todo_write', 'bash', '']) {
      const miss = await world.port.open({ name, token, arguments: { file_path: 'notes.txt', content: 'x\n' } })
      expect(miss.kind, `name '${name}' is not THIS port's question`).toBe('no-match')
    }
    // No state was touched: the SAME token opens cleanly afterwards.
    const opened = await world.port.open(execLike(token))
    expect(opened.kind).toBe('authorized')
    // An exec object missing: no-match, not a refusal.
    const bad = await world.port.open(null as unknown as object)
    expect(bad.kind).toBe('no-match')
  })

  it('WH-M8 an unbound exec on the governed name REFUSES in place (never the pre-hand-off lane) and states it owns nothing', async () => {
    const world = await mountWorld('m8')
    const opened = await world.port.open({ name: 'write', arguments: { file_path: 'notes.txt', content: 'x\n' } })
    expect(opened.kind).toBe('refused')
    expect(opened.code).toBe('PA_HANDOFF_UNBOUND')
    expect(opened.ownsHandoff).toBe(false)
    // A string token is not an identity either.
    const strToken = await world.port.open({ name: 'write', token: 'fake', arguments: { file_path: 'notes.txt', content: 'x\n' } })
    expect(strToken.code).toBe('PA_HANDOFF_UNBOUND')
  })

  it('WH-M9 ABSENCE is field presence: a mount WITHOUT the governed write row does not declare the capability at all', async () => {
    const built = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY,
      realmId: 'a5m2-write-handoff-no-write',
      templateId: 'a5m2-write-handoff-tpl',
      role: 'member',
      instanceId: WORKER,
      teamSessionId: P6T4_ROOT,
    })
    expect(built.ok, 'the no-write mount stays legal (zero-flip)').toBe(true)
    const plane = built.value as PlaneAssemblyValue
    expect('paWriteHandoff' in plane, 'omitted, NOT set to undefined — the glue reads absence by field presence').toBe(false)
  })

  it('WH-A1 the ASK lane: the pre-dispatch open waits on the REAL durable PA row (family block field-for-field), the human allow releases it, the body redeems with the fresh recheck and the ONE consume', async () => {
    const world = await mountWorld('a1', { ask: true })
    const target = join(world.fsRoot, 'notes.txt')
    const content = 'approved handoff bytes\n'
    const token = Symbol('a5m2-write-handoff-a1')
    const exec = execLike(token, { arguments: { file_path: 'notes.txt', content } })
    const correlation = `plane-write:${world.plane.realmId}-1`
    const leg = world.port.open(exec)
    const row = await waitRowForCall(correlation)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest, 'the row is a strict PA manifest carrying the family block').toBeDefined()
    expect(manifest?.familyId).toBe(A5_WRITE_FAMILY_ID)
    expect(manifest?.adapterRevision).toBe(A5_WRITE_ADAPTER_REVISION)
    expect(manifest?.providerIdentity).toBe(ARM_PROVIDER)
    expect(manifest?.targetManifest).toMatchObject({
      canonicalTarget: target,
      contentFingerprint: sha256Hex(content),
      existingFileOnly: true,
    })
    expect(readFileSync(target, 'utf8'), 'while the row PENDINGs the open has written nothing').toBe('old bytes\n')
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const opened = await leg
    expect(opened.kind, 'the FULL effect-set question was answered at PA by the human allow').toBe('authorized')
    expect(opened.correlation).toBe(correlation)
    const ran = await world.writeDef.execute({ file_path: 'notes.txt', content }, exec)
    expect(JSON.stringify(ran)).toContain('notes.txt')
    expect(readFileSync(target, 'utf8'), 'the approved bytes landed through the reviewed closure').toBe(content)
    expect(world.plane.livePaPlan.size, 'the redemption closed the approval plan fact').toBe(0)
    const finalState = await service.listControlState(P6T4_ROOT)
    const finalRow = finalState.requests.find((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '') === correlation)
    expect(finalRow, 'the approval row stands (durable fact, never erased)').toBeDefined()
    expect(String(finalRow?.status ?? ''), 'the row settled to its terminal decided state').toMatch(/decided|allow|consumed|resolved|approved|closed/i)
  })
})
