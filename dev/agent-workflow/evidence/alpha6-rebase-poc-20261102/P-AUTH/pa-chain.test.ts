/**
 * P-AUTH-L2 — the FULL PA tool-approval chain over a real ControlService.
 *
 * Purpose: answer the review's P0 question, not to re-test the control row.
 * A real `leader-approval` row is minted by `createPaControlLeg` from a real
 * admission plan (real strict PA manifest, real effect-set fingerprint), the
 * real PA effects verifier is injected into the real service at BOTH gates,
 * and the leg's landing edge mints the grant and consumes the durable allow.
 *
 * Three modes (selected by A6_PAUTH_CHAIN_MODE):
 *   base       no patch: leader approve works; officer is refused by the ROLE
 *              CLOSURE before the verifier (not evidence about PA).
 *   role-only  role seam only: officer reaches the PA verifier and the durable
 *              decision is a DENY (`pa-authority-drift`) — the cross-layer
 *              blocker the review named.
 *   delegation role seam + throwaway reviewer-authority mapping: the SAME
 *              officer (durable decider role = member) completes the full
 *              chain. This proves where a real delegation contract must land;
 *              the mapping itself is PoC-only and never mergeable.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseTemplateId,
} from '../../../../../packages/contracts/src/index.js'
import { createBlueprintCatalog, parseBlueprint } from '../../../../../packages/domain/blueprint/src/index.js'
import {
  canonicalJsonFingerprint,
  parseRequestedEffectSet,
  parseToolBinding,
} from '../../../../../packages/domain/tool-governance/src/index.js'
import type { AdmissionRequest, RequestedEffectSet } from '../../../../../packages/domain/tool-governance/src/index.js'
import { createTeamDomain } from '../../../../../packages/storage/repositories/index.js'
import { FileStorageSeam } from '../../../../../packages/testkit/fault-injection/file-seam.mjs'
import { createControlService } from '../../../../../packages/runtime/control/index.js'
import type { ControlDecisionRecord, ControlRequestRecord, ControlService } from '../../../../../packages/runtime/control/index.js'
import { PA_CONTROL_MANIFEST_SCHEMA, parsePaControlManifest } from '../../../../../packages/runtime/control/types.js'
import type { ActionCaller } from '../../../../../packages/runtime/admission/index.js'
import type { AuthorityDocumentSlot, AuthorityEnvelopeDocuments } from '../../../../../packages/runtime/governance/authority-ceiling.js'
import type { ControlCallerRef, PaCallFactsCeilingSlot } from '../../../../../packages/runtime/control/types.js'
import { untestedAssurance } from '../../../../../packages/runtime/tool-dispatch/index.js'
import { createProductionAdmissionAssembly } from '../../../../../packages/runtime/tool-admission/index.js'
import type { ProductionAdmissionAssembly } from '../../../../../packages/runtime/tool-admission/index.js'
import type { EffectSetApprovalPlan } from '../../../../../packages/runtime/tool-admission/approval-case.js'
import {
  PA_CONTROL_ACTION_NAME,
  createPaControlLeg,
  createPaEffectsVerifier,
  paCorrelation,
} from '../../../../../packages/runtime/operation-permission/pa-control-bridge.js'
import type {
  PaControlLegInput,
  PaControlLegResult,
  PaEffectsVerifierDeps,
} from '../../../../../packages/runtime/operation-permission/pa-control-bridge.js'
import { P6T1_FIXTURE, makeExternalPolicyFacts } from '../../../../../packages/runtime/test/p6t1-helpers.js'
import {
  P6T4_BLUEPRINT_SOURCE,
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  humanCaller,
  leaderCaller,
  memberCaller,
  p6t4Seed,
} from '../../../../../packages/runtime/test/p6t4-helpers.js'

const MODE = process.env['A6_PAUTH_CHAIN_MODE'] ?? 'base'
const REPO = fileURLToPath(new URL('../../../../../', import.meta.url).href)
const WORLD = join(REPO, 'tests/homes', `a6-pa-chain-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
mkdirSync(ROOT_DIR, { recursive: true })

const seam = new FileStorageSeam(WORLD)
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
await repos.sessionBindings.put({
  kind: 'team-root',
  schemaVersion: 1,
  sessionId: P6T1_FIXTURE.rootSessionId,
})
for (const name of ['leader', 'worker', 'worker2', 'scribe'] as const) {
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

const WORKER = P6T4_SEEDS.worker.instanceId
const OFFICER = P6T4_SEEDS.worker2.instanceId

interface RealmTruth {
  readonly assembly: ProductionAdmissionAssembly
  readonly documents: () => AuthorityEnvelopeDocuments
  generation: number
}
const realmTruths = new Map<string, RealmTruth>()

function factSlot(slot: AuthorityDocumentSlot): PaCallFactsCeilingSlot | undefined {
  if (typeof slot !== 'object') return undefined
  if (!('status' in slot)) return slot
  if (slot.status === 'unavailable') return undefined
  return slot
}
const EMPTY_DOCS: AuthorityEnvelopeDocuments = Object.freeze({
  teamHardEnvelope: Object.freeze({ rules: [] }),
  permissionMutationEnvelope: Object.freeze({ status: 'absent' as const }),
})
const fakeReadCallFacts: PaEffectsVerifierDeps['readCallFacts'] = async (input) => {
  const truth = realmTruths.get(input.manifest.realmId)
  if (truth === undefined) return undefined
  const manifest = input.manifest
  if (input.rootSessionId !== P6T4_ROOT) return undefined
  const durable = repos.memberInstances.get(P6T4_ROOT, manifest.member.instanceId)
  if (durable === undefined) return undefined
  const binding = parseToolBinding({ ...manifest.binding })
  if (!binding.ok) return undefined
  const effects = parseRequestedEffectSet(manifest.effects)
  if (!effects.ok) return undefined
  const request: AdmissionRequest = Object.freeze({
    binding: binding.value,
    member: Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) }),
    callId: manifest.callId,
    realmId: manifest.realmId,
    parametersFingerprint: manifest.parametersFingerprint,
    requestedEffects: effects.value,
  })
  const livePlan = truth.assembly.planApproval(request)
  if (!livePlan.ok) return undefined
  const ceiling = truth.documents()
  const hard = factSlot(ceiling.teamHardEnvelope)
  const mutation = factSlot(ceiling.permissionMutationEnvelope)
  if (hard === undefined || mutation === undefined) return undefined
  return {
    policySource: { staticLayerRefs: ['a6-pa-chain-tpl'], overlayGeneration: 0 },
    realmId: manifest.realmId,
    ceiling: { teamHardEnvelope: hard, permissionMutationEnvelope: mutation },
    policyDocument: truth.assembly.policyDocument(),
    denySources: truth.assembly.denySources(),
    effects: effects.value,
    member: { teamSessionId: P6T4_ROOT, instanceId: String(durable.instanceId) },
    beneficiaryAuthority: 'member',
    binding: binding.value,
    blueprint: {
      revision: String(blueprint.revision),
      contentHash: String(blueprint.contentHash),
      templateId: String(durable.templateId),
      cwd: ROOT_DIR,
      providerVersion: 'a6-pa-chain',
    },
    planSnapshot: {
      approvalCaseId: livePlan.value.approvalCaseId,
      effectSetFingerprint: livePlan.value.effectSetFingerprint,
      perEffectRequired: livePlan.value.perEffectRequired,
    },
    authorityGeneration: truth.generation,
  }
}
const paVerifier = createPaEffectsVerifier({ readCallFacts: fakeReadCallFacts })
const service: ControlService = createControlService({
  teamDomain: domain,
  blueprintCatalog: catalog,
  externalPolicyFacts: async () => makeExternalPolicyFacts(),
  now: () => P6T4_NOW,
  waitPollIntervalMs: 5,
  paEffectsVerifier: paVerifier,
})

afterAll(async () => {
  await domain.close()
  rmSync(WORLD, { recursive: true, force: true })
})

const DIRECT_POLICY = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
let realmSeq = 0
function directAssembly(): { assembly: ProductionAdmissionAssembly; realm: string } {
  const realmId = `a6-pa-chain-r-${String(realmSeq++)}`
  const built = createProductionAdmissionAssembly({
    permissionPolicy: DIRECT_POLICY,
    realmId,
    templateId: 'a6-pa-chain-tpl',
    definitionOwnerAuthority: 'human-user',
    role: 'member',
    clock: () => Date.now(),
    authorityGeneration: () => 0,
    beneficiaryAuthority: 'member',
    documents: () => EMPTY_DOCS,
    onObserve: () => {},
  })
  if (!built.ok) throw new Error(`assembly refused: ${built.error.message}`)
  realmTruths.set(realmId, { assembly: built.value, documents: () => EMPTY_DOCS, generation: 0 })
  return { assembly: built.value, realm: realmId }
}

interface Fixture {
  readonly input: PaControlLegInput
  readonly plan: EffectSetApprovalPlan
  readonly correlation: string
}
function directFixture(ctx: { assembly: ProductionAdmissionAssembly; realm: string }, callId: string): Fixture {
  const bindingParsed = parseToolBinding({
    bindingId: `a6-pa-chain:${callId}`,
    agentScopeKey: `a6:${callId}`,
    toolName: 'team_bash',
    definitionIdentity: `a6:${callId}:team_bash`,
    providerId: 'a6-pa-chain-plane',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'confined-subprocess',
    assurance: untestedAssurance('team-trusted-extension', 'confined-subprocess', ctx.realm),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  })
  if (!bindingParsed.ok) throw new Error(`binding refused: ${JSON.stringify(bindingParsed.problems)}`)
  const effectsParsed = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: 'team_bash', resource: null }])
  if (!effectsParsed.ok) throw new Error(`effects refused: ${JSON.stringify(effectsParsed.problems)}`)
  const member = Object.freeze({ teamSessionId: P6T4_ROOT, instanceId: WORKER })
  const request: AdmissionRequest = Object.freeze({
    binding: bindingParsed.value,
    member,
    callId,
    realmId: ctx.realm,
    parametersFingerprint: canonicalJsonFingerprint({ command: `a6-${callId}` }),
    requestedEffects: effectsParsed.value as RequestedEffectSet,
  })
  const planned = ctx.assembly.planApproval(request)
  if (!planned.ok) throw new Error(`plan refused: ${planned.error.message}`)
  return {
    input: Object.freeze({ realmId: ctx.realm, member, callId, request, plan: planned.value, assembly: ctx.assembly }),
    plan: planned.value,
    correlation: paCorrelation(planned.value.approvalCaseId, callId),
  }
}

async function listState() {
  return service.listControlState(P6T4_ROOT)
}
async function waitRow(correlation: string): Promise<ControlRequestRecord> {
  const deadline = Date.now() + 10_000
  for (;;) {
    const found = (await listState()).requests.find((r) => r.correlation === correlation)
    if (found !== undefined) return found
    if (Date.now() > deadline) throw new Error('the durable control row never appeared')
    await new Promise((r) => setTimeout(r, 20))
  }
}
async function resolve(caller: ActionCaller, requestId: string): Promise<ControlDecisionRecord> {
  return service.resolveControl({ rootSessionId: P6T4_ROOT, caller, requestId, decision: 'allow' })
}
function makeLeg(fixture: Fixture) {
  return createPaControlLeg({
    controlService: service,
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER),
    beneficiaryAuthority: 'member',
    waitTimeoutMs: 8_000,
  })(fixture.input)
}

async function startCase(callId: string): Promise<{ fixture: Fixture; row: ControlRequestRecord; pending: Promise<PaControlLegResult> }> {
  const fixture = directFixture(directAssembly(), callId)
  const pending = makeLeg(fixture)
  const row = await waitRow(fixture.correlation)
  return { fixture, row, pending }
}

it('the PA manifest is strict and the row is a real leader-approval leg', async () => {
  const { row, pending } = await startCase('shape')
  expect(row.kind).toBe('leader-approval')
  expect(parsePaControlManifest(row.reviewPayload)).not.toBeUndefined()
  expect(parsePaControlManifest(row.reviewPayload)?.requiredAuthority).toBe('leader')
  await resolve(leaderCaller(), row.requestId)
  expect((await pending).decision).toBe('approve')
})

it('leader completes the full chain: grant minted and the durable allow consumed exactly once', async () => {
  const { row, pending } = await startCase('leader')
  await resolve(leaderCaller(), row.requestId)
  const result = await pending
  expect(result.decision).toBe('approve')
  if (result.decision !== 'approve') return
  expect(result.grant).toBeDefined()
  const state = await listState()
  expect(state.decisions.find((d) => d.requestId === row.requestId)?.decision).toBe('allow')
  expect(state.consumptions.filter((c) => c.requestId === row.requestId)).toHaveLength(1)
})

const itRoleOnly = MODE === 'role-only' ? it : it.skip
itRoleOnly('role seam only: the officer reaches the PA verifier and the durable decision is DENIED (pa-authority-drift)', async () => {
  const { row, pending } = await startCase('role-only')
  const decision = await resolve(memberCaller(OFFICER), row.requestId)
  expect(decision.decision).toBe('deny')
  expect(decision.reason).toBe('pa-authority-drift')
  const result = await pending
  expect(result.decision).toBe('deny')
  const state = await listState()
  expect(state.consumptions.filter((c) => c.requestId === row.requestId)).toHaveLength(0)
})

const itDelegation = MODE === 'delegation' ? it : it.skip
itDelegation('delegation prototype: the SAME member decider completes the full chain (identity stays member in the ledger)', async () => {
  const { row, pending } = await startCase('delegation')
  const decision = await resolve(memberCaller(OFFICER), row.requestId)
  expect(decision.decision).toBe('allow')
  expect(decision.decider).toEqual({ kind: 'instance', instanceId: OFFICER, role: 'member' })
  const result = await pending
  expect(result.decision).toBe('approve')
  if (result.decision !== 'approve') return
  expect(result.grant).toBeDefined()
  const state = await listState()
  expect(state.consumptions.filter((c) => c.requestId === row.requestId)).toHaveLength(1)
})

it('baseline: the officer is refused by role closure before any PA evaluation', async () => {
  if (MODE !== 'base') return
  const { row, pending } = await startCase('role-closure')
  await expect(resolve(memberCaller(OFFICER), row.requestId)).rejects.toMatchObject({
    code: 'CONTROL_RESOLVER_NOT_AUTHORIZED',
  })
  await pending.catch(() => undefined)
})
