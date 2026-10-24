/**
 * A5-M2 EDIT/SRE PA HAND-OFF (root 2026-10-26, the SECOND existing blocker):
 * the governed EDIT and SRE rows join the pre-dispatch hand-off under the
 * audited WRITE law — the ONE durable effect-set Ask per call belongs to PA,
 * the body takes its claim ONCE under the ORIGINAL correlation, and cancel /
 * result / dispose reclaim every leg. What this spec pins (small regression,
 * root-ordered):
 *
 *  - SAME-CALL UNIQUE ASK: on the all-allow world the open leg walks the REAL
 *    PA admission with ZERO control-leg entries (the old front door is opened
 *    NOTHING); a second open on the token refuses side-effect-free (IN_FLIGHT,
 *    ownsHandoff false); on the ask world exactly ONE durable PA row exists
 *    for the call (strict manifest, EDIT family block field-for-field) and
 *    the human allow — never a second ask, never an auto-approval — releases
 *    the open leg;
 *  - SINGLE TAKE: the body redeems synchronously ONCE (a re-entrant second
 *    redemption finds no flight and refuses PA_HANDOFF_LOST), under the
 *    ORIGINAL correlation, with the fresh classify exact-match recheck
 *    (drift → PA_HANDOFF_MISMATCH, zero bytes, token never re-served);
 *  - CANCEL/RESULT/DISPOSE RECLAMATION: a close before the body (or MID-WALK)
 *    ends the leg and terminals the token (late body refuses, late answer
 *    registers nothing); the mount teardown ends every unspent claim (drain
 *    refusal, no native fallback, no plan fact survives);
 *  - the port answers ONLY for its OWN mounted name ('edit' /
 *    'str_replace_editor'), never a name guess, never a native fallback: an
 *    unbound exec on the governed name REFUSES (PA_HANDOFF_UNBOUND);
 *  - ABSENCE is field presence: a mount without the governed row does not
 *    declare `paEditHandoff` / `paSreHandoff` at all (omitted, NOT undefined).
 *
 * Scope: NO Host, NO network; worlds are workspace-internal, removed after.
 * The disclosed stand-ins are EXACTLY the ones a5m2-edit-vertical-c1 /
 * a5m2-sre-vertical-c1 declare (TEST-owned native identity/description; every
 * authority part is the production module).
 *
 * @module @dsh-agent-team/runtime/test/a5m2-edit-sre-handoff-c1
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
import type { RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { createPaControlLeg, createPaEffectsVerifier } from '../operation-permission/pa-control-bridge.js'
import type { PaControlLegInput, PaEffectsVerifierDeps } from '../operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from './p6t1-helpers.js'
import { P6T4_BLUEPRINT_SOURCE, P6T4_NOW, P6T4_ROOT, leaderCaller, memberCaller, p6t4Seed } from './p6t4-helpers.js'

interface HandoffPort {
  open: (exec: object) => Promise<{ kind: string; correlation?: string; code?: string; detail?: string; ownsHandoff?: boolean }>
  close: (exec: object) => void
}
interface PlaneAssemblyValue {
  ownNames: readonly string[]
  definitions: ReadonlyArray<{
    name: string
    description: string
    execute: (args: unknown, exec?: unknown) => Promise<unknown>
  }>
  paEditHandoff?: HandoffPort
  paSreHandoff?: HandoffPort
  placementFeed: (name: string) => { definitionIdentity?: string; realmId: string } | undefined
  mount: (agentCtx: { tools: { register: (def: unknown) => unknown } }) => { ok: boolean; dispose: () => void }
  livePaPlan: Map<string, { approvalCaseId: string; effectSetFingerprint: string; perEffectRequired: unknown[]; requestedEffects?: unknown }>
  realmId: string
  assembly: ProductionAdmissionAssembly
}
type PlaneFactory = (input: Record<string, unknown>) => { ok: boolean; code?: string; message?: string; value?: PlaneAssemblyValue }

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-edit-sre-handoff: no repo root carrying tests/paths.mjs — failing closed')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const WORLD_ROOT = join(homeRoot(REPO), `a5m2-edit-sre-handoff-${STAMP}`)
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

const HEADER_ID = 'ses-a5m2-edit-sre-handoff-header'
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
  const livePlan = truth.assembly.planApproval(Object.freeze({
    binding: binding.value,
    member: Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) }),
    callId: input.manifest.callId,
    realmId: input.manifest.realmId,
    parametersFingerprint: input.manifest.parametersFingerprint,
    requestedEffects: effects.value as RequestedEffectSet,
  }))
  if (!livePlan.ok) return undefined
  const hard = factSlot(EMPTY_DOCS.teamHardEnvelope)
  const mutation = factSlot(EMPTY_DOCS.permissionMutationEnvelope)
  if (hard === undefined || mutation === undefined) return undefined
  const family = a5GovernedFamilyFor(String(binding.value.definitionIdentity))
  return {
    policySource: { staticLayerRefs: ['a5m2-edit-sre-handoff-tpl:directive-policy'], overlayGeneration: 0 },
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
      templateId: 'a5m2-edit-sre-handoff-tpl',
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
const EDIT_MOD = (await import(new URL('../src/plugin/live/governed-families/edit.mjs', import.meta.url).href)) as {
  A5_EDIT_FAMILY_ID: string
  A5_EDIT_ADAPTER_REVISION: number
  A5_EDIT_TOOL_NAME: string
  createGovernedEditArm: (deps: Record<string, unknown>) => {
    familyId: string; adapterRevision: number; definitionIdentity: string; providerId: string
    classify: (args: unknown, exec: Record<string, unknown>, callId: string) => unknown
    prepare: (plan: unknown, grant: Record<string, unknown>) => unknown
    execute: (plan: unknown, proof: Record<string, unknown>) => Promise<unknown>
    cancel: (plan: unknown) => unknown
    drain: () => void
  }
}
const SRE_MOD = (await import(new URL('../src/plugin/live/governed-families/sre.mjs', import.meta.url).href)) as {
  A5_SRE_FAMILY_ID: string
  A5_SRE_ADAPTER_REVISION: number
  A5_SRE_TOOL_NAME: string
  createGovernedSreArm: (deps: Record<string, unknown>) => {
    familyId: string; adapterRevision: number; definitionIdentity: string; providerId: string
    classify: (args: unknown, exec: Record<string, unknown>, callId: string) => unknown
    prepare: (plan: unknown, grant: Record<string, unknown>) => unknown
    execute: (plan: unknown, proof: Record<string, unknown>) => Promise<unknown>
    cancel: (plan: unknown) => unknown
    drain: () => void
  }
}
const { A5_EDIT_FAMILY_ID, A5_EDIT_ADAPTER_REVISION, A5_EDIT_TOOL_NAME, createGovernedEditArm } = EDIT_MOD
const { A5_SRE_FAMILY_ID, A5_SRE_ADAPTER_REVISION, A5_SRE_TOOL_NAME, createGovernedSreArm } = SRE_MOD

interface Fam {
  key: 'edit' | 'sre'
  toolName: string
  prefix: string
  familyId: string
  adapterRevision: number
  drainCode: RegExp
  makeArm: (label: string, fsRoot: string, realmId: string) => ReturnType<typeof createGovernedEditArm> | ReturnType<typeof createGovernedSreArm>
  /** the model-facing native arguments; `drifted` asks a DIFFERENT question */
  args: (dir: string) => { base: Record<string, unknown>; drifted: Record<string, unknown>; landing: string }
  portOf: (plane: PlaneAssemblyValue) => HandoffPort | undefined
  otherNames: readonly string[]
}
const FAM_EDIT: Fam = {
  key: 'edit',
  toolName: A5_EDIT_TOOL_NAME,
  prefix: 'plane-edit',
  familyId: A5_EDIT_FAMILY_ID,
  adapterRevision: A5_EDIT_ADAPTER_REVISION,
  drainCode: /P_EDIT_DRAINING/,
  makeArm: (label, fsRoot, realmId) => createGovernedEditArm({
    definitionIdentity: `sha256:captured-native-edit-identity-${label}`,
    providerId: ARM_PROVIDER,
    realmId,
    memberAgentId: WORKER,
    sessionHeaderId: HEADER_ID,
    instanceRootDir: fsRoot,
    bindingFacts: () => ({ bindingId: `a5m2-edit-sre-handoff:${label}`, bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
    observe: () => {},
  }),
  args: () => ({
    base: { file_path: 'notes.txt', old_string: 'beta', new_string: 'BETA-2' },
    drifted: { file_path: 'notes.txt', old_string: 'beta', new_string: 'DIFFERENT' },
    landing: 'alpha\nBETA-2\ngamma\n',
  }),
  portOf: (plane) => plane.paEditHandoff,
  otherNames: ['write', 'read', 'todo_write', 'bash', ''],
}
const FAM_SRE: Fam = {
  key: 'sre',
  toolName: A5_SRE_TOOL_NAME,
  prefix: 'plane-sre',
  familyId: A5_SRE_FAMILY_ID,
  adapterRevision: A5_SRE_ADAPTER_REVISION,
  drainCode: /P_SRE_DRAINING/,
  makeArm: (label, fsRoot, realmId) => createGovernedSreArm({
    definitionIdentity: `sha256:captured-native-sre-identity-${label}`,
    providerId: ARM_PROVIDER,
    realmId,
    memberAgentId: WORKER,
    sessionHeaderId: HEADER_ID,
    instanceRootDir: fsRoot,
    bindingFacts: () => ({ bindingId: `a5m2-edit-sre-handoff:${label}`, bindingRevision: 1, policyGeneration: 0, authorityGeneration: 0 }),
    observe: () => {},
  }),
  args: () => ({
    base: { command: 'str_replace', path: 'notes.txt', old_str: 'beta', new_str: 'GAMMA' },
    drifted: { command: 'str_replace', path: 'notes.txt', old_str: 'beta', new_str: 'DIFFERENT' },
    landing: 'alpha\nGAMMA\ngamma\n',
  }),
  portOf: (plane) => plane.paSreHandoff,
  otherNames: ['edit', 'write', 'read', 'todo_write', ''],
}

const bindingFixtures = new Map<string, ReturnType<typeof parseToolBinding>>()
function bindingOf(label: string): ToolBinding | undefined {
  const parsed = bindingFixtures.get(label)
  return parsed !== undefined && parsed.ok ? parsed.value : undefined
}

interface Mounted {
  fam: Fam
  /** true when THIS world answers the effect-set question through the ONE
   *  durable PA row (SRE: `str_replace_editor` is not in the closed
   *  permission vocabulary, so no named rule may pre-allow its tool-invoke
   *  — the ASK lane is its only lawful zero-fallback path). */
  withRow: boolean
  plane: PlaneAssemblyValue
  port: HandoffPort
  def: PlaneAssemblyValue['definitions'][number]
  fsRoot: string
  target: string
  observed: string[]
  legInputs: unknown[]
  asked: number
}

/** One mounted world (the write-handoff round's harness, unchanged in shape):
 *  a unique realm, the REAL arm over a REAL workspace-internal root carrying
 *  ONE EXISTING target file, the mount-time family registration through the
 *  plane's OWN placementFeed, plane-side call facts on the registry's shared
 *  read law. The all-allow world (read AND write exact-allowed — the B-EDIT /
 *  B-SRE effect pair) answers Part A with NO approval question; the ask world
 *  rides the real durable Control row. */
async function mountWorld(fam: Fam, label: string, opts: { ask?: boolean } = {}): Promise<Mounted> {
  const fsRoot = worldDir(`root-${fam.key}-${label}`)
  writeFileSync(join(fsRoot, 'notes.txt'), 'alpha\nbeta\ngamma\n', 'utf8')
  const target = join(fsRoot, 'notes.txt')
  const withRow = opts.ask === true || fam.key === 'sre'
  const policy: TemplatePermissionPolicy = withRow
    ? DIRECT_POLICY
    : Object.freeze({
        default: 'deny',
        allow: [
          // B-EDIT's tool-invoke arm is named by the 'edit' rule (the closed
          // vocabulary spells the invoke matcher tool:edit); the paired READ
          // effect is named by the 'read' rule, the WRITE+meta pair by 'edit'.
          Object.freeze({ tool: 'edit', resource: Object.freeze({ kind: 'exact', path: target }) }),
          Object.freeze({ tool: 'read', resource: Object.freeze({ kind: 'exact', path: target }) }),
        ],
        ask: [],
        deny: [],
      } as unknown as TemplatePermissionPolicy)
  const realmId = `a5m2-edit-sre-handoff-${fam.key}-${label}`
  const arm = fam.makeArm(label, fsRoot, realmId)
  const observed: string[] = []
  const legInputs: unknown[] = []
  let asked = 0
  const built = planeModule.createTeamToolPlaneAssembly({
    permissionPolicy: policy,
    realmId,
    templateId: 'a5m2-edit-sre-handoff-tpl',
    role: 'member',
    instanceId: WORKER,
    teamSessionId: P6T4_ROOT,
    plane: fam.key === 'edit' ? { editEnabled: true } : { sreEnabled: true },
    fs: { subtreeContains },
    backends: fam.key === 'edit'
      ? { edit: { arm, description: 'TEST native edit description — the captured bytes the row must carry.' } }
      : { sre: { arm, description: 'TEST native str_replace_editor description — the captured bytes.' } },
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
          policySource: { staticLayerRefs: ['a5m2-edit-sre-handoff-tpl:directive-policy'], overlayGeneration: 0 },
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
            templateId: 'a5m2-edit-sre-handoff-tpl',
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
  const fed = plane.placementFeed(fam.toolName)
  const familyKey = String(fed?.definitionIdentity ?? '')
  if (familyKey.length === 0) throw new Error(`the placed ${fam.key} row answered no placement definition identity`)
  registerA5GovernedFamily(familyKey, {
    familyId: arm.familyId,
    adapterRevision: arm.adapterRevision,
    providerIdentity: arm.providerId,
  })
  bindingFixtures.set(label, parseToolBinding({
    bindingId: `a5m2-edit-sre-handoff:${label}`,
    agentScopeKey: `a5m2-edit-sre-handoff:${label}`,
    toolName: fam.toolName,
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
  const def = plane.definitions.find((d) => d.name === fam.toolName)
  if (def === undefined) throw new Error(`the mounted plane carries no ${fam.key} definition`)
  const port = fam.portOf(plane)
  if (port === undefined) throw new Error(`a governed-${fam.key} mount MUST declare pa${fam.key === 'edit' ? 'Edit' : 'Sre'}Handoff`)
  return { fam, plane, port, def, fsRoot, target, withRow, observed, legInputs, get asked() { return asked } } as Mounted
}

function execLike(fam: Fam, token: symbol, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: fam.toolName,
    token,
    arguments: fam.args('').base,
    agent: {
      id: WORKER,
      session: { header: { id: HEADER_ID }, append: () => {} },
    },
    ...over,
  }
}

const sha256Hex = (text: string) => `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`

/** Open the leg; on a row-world resolve THE row (the first open of a world
 *  always carries `...-1`) with the human allow, then return the settled
 *  hand-off. The allow rides the SAME durable row the ask lane opened —
 *  never a second ask, never an auto-approval. */
async function openAuthorized(world: Mounted, exec: Record<string, unknown>, seq = 1): Promise<{ kind: string; correlation?: string; code?: string; detail?: string; ownsHandoff?: boolean }> {
  const leg = world.port.open(exec)
  if (world.withRow) {
    const row = await waitRowForCall(`${world.fam.prefix}:${world.plane.realmId}-${String(seq)}`)
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
  }
  return await leg
}

describe('A5-M2 EDIT/SRE PA HAND-OFF — ONE durable effect-set Ask per call at PA; the body takes once under the ORIGINAL correlation; cancel/result/dispose reclaim', () => {
  for (const fam of [FAM_EDIT, FAM_SRE]) {
    const T = fam.key.toUpperCase()

    it(`${T}-H1 production A→B: the open leg authorizes on the REAL walk with ZERO front-door entries, the body re-checks fresh, consumes once and the bytes land`, async () => {
      const world = await mountWorld(fam, 'h1')
      const { base, landing } = fam.args(world.fsRoot)
      const exec = execLike(fam, Symbol(`a5m2-handoff-${fam.key}-h1`))
      const opened = await openAuthorized(world, exec)
      expect(opened.kind, JSON.stringify(opened)).toBe('authorized')
      expect(opened.correlation, 'the row mints the correlation').toMatch(new RegExp(`^${fam.prefix}:`))
      expect(world.legInputs.length, world.withRow ? 'EXACTLY ONE durable PA ask for this call — the same-call unique Ask' : 'the all-allow answer opens NO approval question — the old front door is opened NOTHING').toBe(world.withRow ? 1 : 0)
      expect(world.plane.livePaPlan.size, 'the pending ask holds ONE plan fact; an all-allow answer holds none').toBe(world.withRow ? 1 : 0)
      expect(world.asked, 'Part A read the call-level facts for THIS call').toBeGreaterThanOrEqual(1)
      expect(world.observed.some((r) => r.includes(`a5m2-${fam.key} pa-handoff OPEN`)), 'the OPEN witness rode the observation stream').toBe(true)
      const askedAfterOpen = world.asked
      const ran = await world.def.execute(base, exec)
      expect(JSON.stringify(ran), 'the reviewed receipt names the approved target').toContain('notes.txt')
      expect(readFileSync(world.target, 'utf8'), 'the redemption runs the real execution edge and lands').toBe(landing)
      expect(world.asked, 'Part B re-read the facts FRESH — the edge never trusts Part A\'s read').toBeGreaterThan(askedAfterOpen)
      expect(world.plane.livePaPlan.size, 'the redemption is the end of this call\'s plan fact').toBe(0)
      world.port.close(exec)
      expect(world.plane.livePaPlan.size, 'a terminal close after the redemption changes nothing').toBe(0)
    })

    it(`${T}-H2 the terminal close before the body: the flight dies, the token goes terminal, the late body REFUSES with zero bytes`, async () => {
      const world = await mountWorld(fam, 'h2')
      const { drifted } = fam.args(world.fsRoot)
      const exec = execLike(fam, Symbol(`a5m2-handoff-${fam.key}-h2`))
      const opened = await openAuthorized(world, exec)
      expect(opened.kind).toBe('authorized')
      world.port.close(exec)
      await expect(world.def.execute(drifted, exec)).rejects.toThrow(/exec-token-replay/)
      expect(readFileSync(world.target, 'utf8'), 'the closed hand-off wrote NOTHING').toBe('alpha\nbeta\ngamma\n')
      const again = await world.port.open(exec)
      expect(again.code, 'a terminal token is never re-armed').toBe('PA_HANDOFF_TERMINAL')
    })

    it(`${T}-H3 SAME-CALL UNIQUE ASK — a second open on the token is SIDE-EFFECT-FREE (IN_FLIGHT, ownsHandoff false, zero extra facts) and the OWNING leg still redeems`, async () => {
      const world = await mountWorld(fam, 'h3')
      const { base, landing } = fam.args(world.fsRoot)
      const exec = execLike(fam, Symbol(`a5m2-handoff-${fam.key}-h3`))
      const first = await openAuthorized(world, exec)
      expect(first.kind).toBe('authorized')
      const askedAfterFirst = world.asked
      const second = await world.port.open(exec)
      expect(second.kind, 'a duplicate open is refused, never an authorization').toBe('refused')
      expect(second.code).toBe('PA_HANDOFF_IN_FLIGHT')
      expect(second.ownsHandoff, 'the duplicate owns nothing to clean — the adapter leaves the first leg alone').toBe(false)
      expect(world.asked, 'the duplicate asked the facts entry ZERO extra times').toBe(askedAfterFirst)
      const ran = await world.def.execute(base, exec)
      expect(JSON.stringify(ran)).toContain('notes.txt')
      expect(readFileSync(world.target, 'utf8')).toBe(landing)
    })

    it(`${T}-H4 the take is SYNCHRONOUS and SINGLE: a re-entrant second redemption refuses PA_HANDOFF_LOST while the first lands`, async () => {
      const world = await mountWorld(fam, 'h4')
      const { base, landing } = fam.args(world.fsRoot)
      const exec = execLike(fam, Symbol(`a5m2-handoff-${fam.key}-h4`))
      const opened = await openAuthorized(world, exec)
      expect(opened.kind).toBe('authorized')
      const first = world.def.execute(base, exec)
      const second = world.def.execute(base, exec)
      await expect(second).rejects.toThrow(/PA_HANDOFF_LOST/)
      await first
      expect(readFileSync(world.target, 'utf8'), 'exactly one flight landed').toBe(landing)
    })

    it(`${T}-H5 a close landing MID-WALK ends the leg: the late answer registers nothing (PA_HANDOFF_CLOSED), the token is terminal, zero bytes follow`, async () => {
      const world = await mountWorld(fam, 'h5')
      const { base } = fam.args(world.fsRoot)
      const exec = execLike(fam, Symbol(`a5m2-handoff-${fam.key}-h5`))
      const leg = world.port.open(exec)
      world.port.close(exec)
      if (world.withRow) {
        // The row still PENDINGs: settle it so the LATE answer actually
        // arrives — the closed leg's after-await re-check must still drop it.
        const row = await waitRowForCall(`${fam.prefix}:${world.plane.realmId}-1`)
        await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
      }
      const late = await leg
      expect(late.kind, 'a closed leg never hands off').toBe('refused')
      expect(late.code).toBe('PA_HANDOFF_CLOSED')
      expect(world.plane.livePaPlan.size, 'the dropped answer registers nothing').toBe(0)
      const again = await world.port.open(exec)
      expect(again.code, 'a terminal token is never re-armed').toBe('PA_HANDOFF_TERMINAL')
      await expect(world.def.execute(base, exec)).rejects.toThrow(/exec-token-replay/)
      expect(readFileSync(world.target, 'utf8'), 'nothing reached the closure').toBe('alpha\nbeta\ngamma\n')
    })

    it(`${T}-H6 the mount teardown ends every flight: the unspent claim dies, a late body meets the drain refusal, no native fallback, zero bytes`, async () => {
      const world = await mountWorld(fam, 'h6')
      const { drifted } = fam.args(world.fsRoot)
      const exec = execLike(fam, Symbol(`a5m2-handoff-${fam.key}-h6`))
      const opened = await openAuthorized(world, exec)
      expect(opened.kind).toBe('authorized')
      const mounted = world.plane.mount({ tools: { register: () => () => {} } })
      expect(mounted.ok).toBe(true)
      mounted.dispose()
      await expect(world.def.execute(drifted, exec)).rejects.toThrow(fam.drainCode)
      const again = await world.port.open(exec)
      expect(again.kind, 'no hand-off survives the mount — the terminal token says so').toBe('refused')
      expect(['PA_HANDOFF_TERMINAL', 'PA_HANDOFF_MOUNT_GONE']).toContain(again.code)
      expect(readFileSync(world.target, 'utf8'), 'the teardown left the target untouched').toBe('alpha\nbeta\ngamma\n')
      expect(world.plane.livePaPlan.size, 'no plan fact survives the mount').toBe(0)
    })

    it(`${T}-H7 the body re-classifies FRESH: drifted argument bytes REFUSE the redemption (PA_HANDOFF_MISMATCH), zero bytes, the token is never re-served`, async () => {
      const world = await mountWorld(fam, 'h7')
      const { drifted } = fam.args(world.fsRoot)
      const exec = execLike(fam, Symbol(`a5m2-handoff-${fam.key}-h7`))
      const opened = await openAuthorized(world, exec)
      expect(opened.kind).toBe('authorized')
      await expect(world.def.execute(drifted, exec)).rejects.toThrow(/PA_HANDOFF_MISMATCH/)
      expect(readFileSync(world.target, 'utf8'), 'a drifted redemption runs nothing').toBe('alpha\nbeta\ngamma\n')
      expect(world.plane.livePaPlan.size).toBe(0)
      await expect(world.def.execute(drifted, exec)).rejects.toThrow(/exec-token-replay/)
      expect(readFileSync(world.target, 'utf8')).toBe('alpha\nbeta\ngamma\n')
    })

    it(`${T}-H8 the port answers ONLY for its OWN mounted name and refuses an unbound exec in place (never the pre-hand-off lane)`, async () => {
      const world = await mountWorld(fam, 'h8')
      const token = Symbol(`a5m2-handoff-${fam.key}-h8`)
      for (const name of fam.otherNames) {
        const miss = await world.port.open({ name, token, arguments: fam.args('').base })
        expect(miss.kind, `name '${name}' is not THIS port's question`).toBe('no-match')
      }
      const bad = await world.port.open(null as unknown as object)
      expect(bad.kind).toBe('no-match')
      const unbound = await world.port.open({ name: fam.toolName, arguments: fam.args('').base })
      expect(unbound.kind).toBe('refused')
      expect(unbound.code).toBe('PA_HANDOFF_UNBOUND')
      expect(unbound.ownsHandoff).toBe(false)
      const strToken = await world.port.open({ name: fam.toolName, token: 'fake', arguments: fam.args('').base })
      expect(strToken.code, 'a string token is not an identity either').toBe('PA_HANDOFF_UNBOUND')
    })
  }

  it('ABSENCE is field presence: a mount WITHOUT the governed rows declares NEITHER paEditHandoff NOR paSreHandoff (omitted, not undefined)', () => {
    const built = planeModule.createTeamToolPlaneAssembly({
      permissionPolicy: DIRECT_POLICY,
      realmId: 'a5m2-edit-sre-handoff-no-rows',
      templateId: 'a5m2-edit-sre-handoff-tpl',
      role: 'member',
      instanceId: WORKER,
      teamSessionId: P6T4_ROOT,
    })
    expect(built.ok, 'the no-row mount stays legal (zero-flip)').toBe(true)
    const plane = built.value as PlaneAssemblyValue
    expect('paEditHandoff' in plane, 'omitted, NOT set to undefined — the glue reads absence by field presence').toBe(false)
    expect('paSreHandoff' in plane, 'omitted, NOT set to undefined — the glue reads absence by field presence').toBe(false)
  })

  it('EDIT ASK lane: the pre-dispatch open waits on the REAL durable PA row (EDIT family block field-for-field), the human allow — never a second ask — releases it, and the body redeems with the ONE consume', async () => {
    const world = await mountWorld(FAM_EDIT, 'a1', { ask: true })
    const { base, landing } = FAM_EDIT.args(world.fsRoot)
    const token = Symbol('a5m2-handoff-edit-a1')
    const exec = execLike(FAM_EDIT, token)
    const correlation = `plane-edit:${world.plane.realmId}-1`
    const leg = world.port.open(exec)
    const row = await waitRowForCall(correlation)
    const manifest = parsePaControlManifest(row.reviewPayload)
    expect(manifest, 'the row is a strict PA manifest carrying the family block').toBeDefined()
    expect(manifest?.familyId).toBe(A5_EDIT_FAMILY_ID)
    expect(manifest?.adapterRevision).toBe(A5_EDIT_ADAPTER_REVISION)
    expect(manifest?.providerIdentity).toBe(ARM_PROVIDER)
    expect(manifest?.targetManifest).toMatchObject({
      operation: 'edit-file',
      canonicalTarget: world.target,
      oldFingerprint: sha256Hex('beta'),
      newFingerprint: sha256Hex('BETA-2'),
      replaceAll: false,
      creationPossible: false,
    })
    const effectJson = JSON.stringify(manifest?.effects)
    expect(effectJson, 'the approved effect set is read AND write on the ONE exact locator').toContain('"read"')
    expect(effectJson).toContain('"write"')
    expect(effectJson).toContain('notes.txt')
    expect(world.legInputs.length, 'exactly ONE durable ask for this call — the same-call unique Ask').toBe(1)
    expect(readFileSync(world.target, 'utf8'), 'while the row PENDINGs the open has written nothing').toBe('alpha\nbeta\ngamma\n')
    await service.resolveControl({ rootSessionId: P6T4_ROOT, caller: leaderCaller(), requestId: row.requestId, decision: 'allow' })
    const opened = await leg
    expect(opened.kind, 'the FULL effect-set question was answered at PA by the human allow').toBe('authorized')
    expect(opened.correlation).toBe(correlation)
    const ran = await world.def.execute(base, exec)
    expect(JSON.stringify(ran)).toContain('notes.txt')
    expect(readFileSync(world.target, 'utf8'), 'the approved bytes landed through the reviewed closure').toBe(landing)
    expect(world.plane.livePaPlan.size, 'the redemption closed the approval plan fact').toBe(0)
    expect(world.legInputs.length, 'the redemption asked NOTHING a second time').toBe(1)
    const finalState = await service.listControlState(P6T4_ROOT)
    const finalRow = finalState.requests.find((r) => String((r.reviewPayload as Record<string, unknown> | undefined)?.callId ?? '') === correlation)
    expect(finalRow, 'the approval row stands (durable fact, never erased)').toBeDefined()
    expect(String(finalRow?.status ?? ''), 'the row settled to its terminal decided state').toMatch(/decided|allow|consumed|resolved|approved|closed/i)
  })
})
