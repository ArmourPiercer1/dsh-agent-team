/**
 * Alpha.6 — the composition-owned assigned-Officer facts provider.
 *
 * These legs use REAL service data: the worlds are durable P6-T1/P6-T4 worlds,
 * the member lookup reads the `memberInstances` repository, and the leg/transfer
 * lookups read `ControlRequestRecord`/`CurrentLegTransferRecord` rows the real
 * control service produced. Only the frozen v5 Blueprint source is a fixture —
 * the production catalog still refuses document version 5 (PR5 §3), so the
 * routing the composition would parse after the flip is supplied directly.
 *
 * The provider is wired into BOTH trusted control-service ports at once; that
 * is the composition contract the module exists to make possible.
 */
import { describe, expect, it } from 'vitest'
import { CONTROL_REQUEST_KINDS, createControlService } from '../control/index.js'
import type { ControlRequestRecord, ControlService, CurrentLegTransferRecord } from '../control/index.js'
import { createAlpha6AuthorityGenerationReader } from '../alpha6/authority-generation.js'
import { createAlpha6LiveRootComposition, createAlpha6RootComposition } from '../alpha6/root-composition.js'
import { createAlpha6CategoryLookup, createAssignedOfficerFactsPort, createAlpha6ControlPorts } from '../alpha6/assigned-officer-facts.js'
import type {
  Alpha6ControlPorts,
  AssignedOfficerFactsPort,
  AssignedOfficerMemberLookup,
  AssignedOfficerMemberSnapshot,
  AssignedOfficerParsedRouting,
  AuthorityGenerationSource,
} from '../alpha6/assigned-officer-facts.js'
import { parseAlpha6Routing } from '../alpha6/composition.js'
import { parseChildSessionId, parseInstanceId, parseTemplateId } from '../../contracts/src/index.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  flipLifecycle,
  memberCaller,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const WORKER = String(P6T4_SEEDS.worker.instanceId)
const WORKER2 = String(P6T4_SEEDS.worker2.instanceId)
const LEADER = String(P6T4_SEEDS.leader.instanceId)
const OFFICER = 'inst-a6factsofficer'
/** The frozen generation every leg below opens under (real, not defaulted). */
const GENERATION = 4

/**
 * Test-local v3 Blueprint with a DEDICATED `officer` MemberTemplate — the world
 * must admit the Officer instance and grant it `resolve-control`. The v5
 * policy source below is the frozen identity the legs are opened under.
 */
const OFFICER_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 3',
  'blueprintId: A6FACTS-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the A6 facts team.',
  'members:',
  '  - templateId: officer',
  '    displayName: Officer',
  '    persona: You review asks.',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the work.',
  'requirements: []',
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
  '    - dispose-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: officer',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '        - resolve-control',
  '      deny: []',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '        - resolve-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The A6 facts default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  '---',
].join('\n')

/** The distinct Officer seed (test-local). */
const OFFICER_SEED = {
  instanceId: parseInstanceId(OFFICER),
  templateId: parseTemplateId('officer'),
  label: 'a6-facts-officer',
  childSessionId: parseChildSessionId('session-child-a6-facts-officer'),
  lifecycle: 'RUNNING' as const,
}

/**
 * A complete v5 document (the same shape the PR6 wiring fixture uses). The
 * revision is part of the frozen identity the legs carry; `leaderExceptions`
 * lets one case declare a fixed Leader exception.
 */
function v5Source(revision: string, leaderExceptions: readonly string[] = []): string {
  const exceptions = leaderExceptions.length === 0
    ? ['    leaderExceptions: []']
    : ['    leaderExceptions:', ...leaderExceptions.map((line) => `      ${line}`)]
  return [
    '---',
    'schemaVersion: 5',
    'blueprintId: A6FACTS-BP',
    `revision: "${revision}"`,
    'leader: { templateId: leader, persona: Lead. }',
    'members:',
    '  - templateId: officer',
    '    persona: Review asks.',
    '  - templateId: worker',
    '    persona: Do work.',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope: { rules: [] }',
    'teamHardEnvelope: { rules: [] }',
    'metadata: {}',
    'reviewRouting:',
    '  enabled: true',
    '  officerTemplateId: officer',
    '  ordinaryToolApprovals:',
    '    default: officer',
    ...exceptions,
    '  whenOfficerUnavailable: hold',
    '---',
    '',
  ].join('\n')
}

const BASE_ROUTING: AssignedOfficerParsedRouting = (() => {
  const parsed = parseAlpha6Routing(v5Source('7'))
  if (parsed === null) throw new Error('fixture v5 source did not parse')
  return parsed
})()

/**
 * Mirror the durable control rows the provider reads. A real composition now
 * reads them through the NON-LOCKING `readControlState` (see the A6 reader
 * legs below); this mirror remains for the port-shape legs, which capture the
 * same rows between calls.
 */
class ControlRowMirror {
  private readonly legs = new Map<string, ControlRequestRecord>()
  private readonly transfers = new Map<string, CurrentLegTransferRecord>()

  async refresh(service: ControlService): Promise<void> {
    const state = await service.listControlState(P6T4_ROOT)
    this.legs.clear()
    this.transfers.clear()
    for (const row of state.requests) this.legs.set(row.requestId, row)
    for (const transfer of state.transfers) this.transfers.set(transfer.currentLegRequestId, transfer)
  }

  readonly leg = async (query: { readonly currentLegRequestId: string }): Promise<ControlRequestRecord | null> =>
    this.legs.get(query.currentLegRequestId) ?? null

  readonly transfer = async (query: { readonly currentLegRequestId: string }): Promise<CurrentLegTransferRecord | null> =>
    this.transfers.get(query.currentLegRequestId) ?? null
}

function factsPort(
  world: P6T1World,
  mirror: ControlRowMirror,
  options: {
    readonly routing?: AssignedOfficerParsedRouting
    readonly generation?: AuthorityGenerationSource
    readonly classify?: () => boolean | null
    /**
     * Rewrite the durable member row the provider reads, for identity and
     * lifecycle probes a real repository row cannot express (a foreign root,
     * a bogus lifecycle spelling, an ABSENT lifecycle). Never mutates the row.
     */
    readonly memberOverride?: (row: AssignedOfficerMemberSnapshot) => AssignedOfficerMemberSnapshot
    /** Rewrite the durable leg row the provider reads (e.g. mark it decided). */
    readonly legOverride?: (leg: ControlRequestRecord) => ControlRequestRecord
  } = {},
): AssignedOfficerFactsPort {
  const repository = world.domain.repositories.memberInstances
  const getMember = (
    root: string,
    instanceId: string,
  ): AssignedOfficerMemberSnapshot | undefined => {
    const row = repository.get(root, instanceId)
    if (row === undefined || options.memberOverride === undefined) return row
    return options.memberOverride(row)
  }
  const leg = async (query: { readonly currentLegRequestId: string }): Promise<ControlRequestRecord | null> => {
    const row = await mirror.leg(query)
    if (row === null || options.legOverride === undefined) return row
    return options.legOverride(row)
  }
  return createAssignedOfficerFactsPort({
    rootSessionId: P6T4_ROOT,
    routing: options.routing ?? BASE_ROUTING,
    members: {
      get: getMember,
      list: (root) => repository.list(root),
    },
    leg,
    transfer: mirror.transfer,
    ...(options.generation === undefined ? {} : { authorityGeneration: options.generation }),
    fixedLeaderOrHumanCategory: options.classify ?? (() => false),
  })
}

function officerService(world: P6T1World, port: AssignedOfficerFactsPort): ControlService {
  return createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    currentReviewerForTransfer: port.resolveCurrentReviewer,
    reviewCallFactsForAssignedOfficer: port,
  })
}

async function makeLeg(
  service: ControlService,
  correlation: string,
  options: {
    readonly requester?: string
    readonly subjectInstance?: string
    readonly subject?: ControlRequestRecord['subject']
    readonly ownerTemplate?: string
    readonly blueprint?: AssignedOfficerParsedRouting
    readonly generation?: number
  } = {},
): Promise<ControlRequestRecord> {
  const requester = options.requester ?? WORKER
  const subjectInstance = options.subjectInstance ?? requester
  const ownerTemplate = options.ownerTemplate ?? 'worker'
  const blueprint = options.blueprint ?? BASE_ROUTING
  const outcome = await service.requestApprovalLeg({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(requester),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    reviewAuthority: 'leader',
    requiredAuthorityAtCreation: 'leader',
    identity: {
      subject: options.subject ?? { kind: 'instance', instanceId: subjectInstance },
      beneficiaryAuthority: 'member',
      requestedEffect: 'ask',
      operationFingerprint: 'fp-a6-facts',
      authorityScope: { operationClass: 'fs.write', matcher: { kind: 'exact', resource: 'a6-facts:file' } },
      correlation,
    },
    actionName: 'write-file',
    toolName: 'fs.write',
    summary: 'a6 facts leg',
    reviewPayload: { schema: 'a6-facts-opaque', note: 'assigned-officer facts provider leg' },
    paApprovalCaseId: 'tadm:root:worker:effects:g4',
    operationOwnerTemplateId: ownerTemplate,
    operationToolDefinitionIdentity: 'tool-def-write',
    operationToolOwner: 'dsh.fs',
    operationToolName: 'write',
    authorityGeneration: options.generation ?? GENERATION,
    blueprintContentHash: blueprint.blueprint.contentHash,
    blueprintRevision: blueprint.blueprint.revision,
    perEffectRequiredAuthorities: ['leader'],
  })
  if (outcome.kind !== 'leg') throw new Error(`expected a leg, got ${outcome.kind}`)
  return outcome.leg
}

function queryOf(leg: ControlRequestRecord): {
  rootSessionId: string
  approvalCaseId: string
  currentLegRequestId: string
  legOrdinal: number
  kind: ControlRequestRecord['kind']
  reviewAuthority: NonNullable<ControlRequestRecord['reviewAuthority']>
} {
  if (leg.approvalCaseId === undefined || leg.legOrdinal === undefined || leg.reviewAuthority === undefined) {
    throw new Error('fixture leg is not an approval-case leg')
  }
  return {
    rootSessionId: P6T4_ROOT,
    approvalCaseId: leg.approvalCaseId,
    currentLegRequestId: leg.requestId,
    legOrdinal: leg.legOrdinal,
    kind: leg.kind,
    reviewAuthority: leg.reviewAuthority,
  }
}

async function makeWorld(name: string): Promise<P6T1World> {
  return createP6T4World(name, ['leader', 'worker', 'worker2'], {
    blueprintSource: OFFICER_BLUEPRINT_SOURCE,
    seedMembers: [OFFICER_SEED],
  })
}

describe('A6 assigned-Officer facts provider (composition-owned)', () => {
  it('accepts the unique live Officer through both trusted ports and records canonical evidence', async () => {
    const world = await makeWorld('a6-facts-allow')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)

      const allowLeg = await makeLeg(service, 'corr-a6-facts-allow')
      await mirror.refresh(service)

      // The two faces of the same provider agree on WHO and on WHAT POLICY.
      expect(await port.resolveCurrentReviewer(queryOf(allowLeg))).toEqual({ instanceId: OFFICER })
      expect(await port(queryOf(allowLeg))).toMatchObject({
        reviewRouting: { officerTemplateId: 'officer', enabled: true },
        fixedLeaderOrHumanCategory: false,
        requiresHuman: false,
      })

      const allowed = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: allowLeg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })
      expect(allowed.decision).toBe('allow')
      expect(allowed.reviewCapability).toMatchObject({
        source: 'blueprint-officer',
        entry: 'allow',
        effectiveReviewAuthority: 'leader',
        approvalCaseId: allowLeg.approvalCaseId,
        currentLegRequestId: allowLeg.requestId,
        legOrdinal: 1,
        authorityGeneration: GENERATION,
        operationOwnerInstanceId: WORKER,
        operationOwnerTemplateId: 'worker',
        operationToolDefinitionIdentity: 'tool-def-write',
      })
      // The canonical scope identity, not the old placeholder evidence.
      expect(allowed.reviewCapability?.scopeFingerprint).toBeTruthy()
      expect(allowed.reviewCapability?.scopeFingerprint).not.toMatch(/^a6-pr5:/)

      const escalateLeg = await makeLeg(service, 'corr-a6-facts-escalate')
      await mirror.refresh(service)
      const risen = await service.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: escalateLeg.requestId,
        assignedOfficer: true,
      })
      expect(risen.nextLeg?.reviewAuthority).toBe('human-user')
      expect(risen.terminalDecision.reviewCapability).toMatchObject({
        source: 'blueprint-officer',
        entry: 'escalate',
      })
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses the Worker: the resolved reviewer is the distinct Officer, not the caller', async () => {
    const world = await makeWorld('a6-facts-worker')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-facts-worker')
      await mirror.refresh(service)

      // The composition names the Officer; the facts themselves are available.
      expect(await port.resolveCurrentReviewer(queryOf(leg))).toEqual({ instanceId: OFFICER })
      expect(await port(queryOf(leg))).not.toBeNull()

      // The Worker is neither the assignment nor a valid delegated reviewer.
      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })).rejects.toThrow(/not the trusted current reviewer|not a resolver/)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses the Officer\'s own ask (self-review) in the single evaluator', async () => {
    const world = await makeWorld('a6-facts-self')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const selfLeg = await makeLeg(service, 'corr-a6-facts-self', {
        requester: OFFICER,
        ownerTemplate: 'officer',
      })
      await mirror.refresh(service)

      // The facts provider is willing — the operation owner EXISTS and matches
      // the frozen owner template. The evaluator is the law that refuses.
      expect(await port(queryOf(selfLeg))).not.toBeNull()
      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: selfLeg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })).rejects.toThrow(/operation-owner-is-officer/)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses a declared Leader exception even though the Officer is assigned', async () => {
    const world = await makeWorld('a6-facts-leader-exception')
    try {
      const exceptionRouting = parseAlpha6Routing(v5Source('7', [
        '- memberTemplateId: worker',
        '  tool: { owner: dsh.fs, name: write }',
      ]))
      if (exceptionRouting === null) throw new Error('exception fixture did not parse')
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { routing: exceptionRouting, generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-facts-exception', { blueprint: exceptionRouting })
      await mirror.refresh(service)

      // The facts pass; the SHARED policy predicate refuses the exception.
      expect(await port(queryOf(leg))).not.toBeNull()
      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })).rejects.toThrow(/leader-exception/)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses a transferred leg: no former-Officer signing authority', async () => {
    const world = await makeWorld('a6-facts-transfer')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-facts-transfer')
      await mirror.refresh(service)

      await service.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        cause: 'officer-handoff',
      })
      await mirror.refresh(service)

      // Both faces refuse independently of the service's own transfer gate.
      expect(await port.resolveCurrentReviewer(queryOf(leg))).toBeNull()
      expect(await port(queryOf(leg))).toBeNull()

      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })).rejects.toThrow(/has been transferred/)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses a cross-root query even with a real row from another team', async () => {
    const world = await makeWorld('a6-facts-cross-root')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-facts-cross-root')
      await mirror.refresh(service)

      const query = queryOf(leg)
      const foreign = { ...query, rootSessionId: 'session-a6-facts-other-team' }
      expect(await port(foreign)).toBeNull()
      expect(await port.resolveCurrentReviewer(foreign)).toBeNull()
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses when the authority generation is missing or does not match the leg', async () => {
    const world = await makeWorld('a6-facts-generation')
    try {
      const mirror = new ControlRowMirror()
      const service = officerService(world, factsPort(world, mirror, { generation: GENERATION }))
      const leg = await makeLeg(service, 'corr-a6-facts-generation')
      await mirror.refresh(service)
      const query = queryOf(leg)

      // Missing composition generation: the service's `0` sentinel is never a
      // generation, and there is nothing to compare the frozen row against.
      const missing = factsPort(world, mirror, {})
      expect(await missing(query)).toBeNull()

      // A different current generation is a stale policy, not a capability.
      const stale = factsPort(world, mirror, { generation: GENERATION - 1 })
      expect(await stale(query)).toBeNull()

      await expect(officerService(world, missing).resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })).rejects.toThrow(/produced no facts/)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses when the frozen Blueprint identity is not the parsed routing\'s Blueprint', async () => {
    const world = await makeWorld('a6-facts-blueprint')
    try {
      const mirror = new ControlRowMirror()
      const otherRevision = parseAlpha6Routing(v5Source('8'))
      if (otherRevision === null) throw new Error('fixture v5 source did not parse')
      const service = officerService(world, factsPort(world, mirror, { generation: GENERATION }))
      const leg = await makeLeg(service, 'corr-a6-facts-blueprint')
      await mirror.refresh(service)

      // The leg was frozen under revision 7; a revision-8 policy must not lend
      // its routing to it.
      const newer = factsPort(world, mirror, { routing: otherRevision, generation: GENERATION })
      expect(await newer.resolveCurrentReviewer(queryOf(leg))).toBeNull()
      expect(await newer(queryOf(leg))).toBeNull()
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('resolves a SETTLED Officer (the normal idle state is still a live reviewer)', async () => {
    const world = await makeWorld('a6-facts-settled')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-facts-settled')
      await mirror.refresh(service)

      await flipLifecycle(world, OFFICER, 'SETTLED')
      expect(await port.resolveCurrentReviewer(queryOf(leg))).toEqual({ instanceId: OFFICER })
      expect(await port(queryOf(leg))).not.toBeNull()
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses a stale Officer (no live RUNNING instance of the Officer template)', async () => {
    const world = await makeWorld('a6-facts-stale')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-facts-stale')
      await mirror.refresh(service)

      await flipLifecycle(world, OFFICER, 'ARCHIVED')
      expect(await port.resolveCurrentReviewer(queryOf(leg))).toBeNull()
      expect(await port(queryOf(leg))).toBeNull()
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses when the composition cannot classify the fixed Leader/Human category', async () => {
    const world = await makeWorld('a6-facts-classification')
    try {
      const mirror = new ControlRowMirror()
      const unclassified = factsPort(world, mirror, { generation: GENERATION, classify: () => null })
      const service = officerService(world, unclassified)
      const leg = await makeLeg(service, 'corr-a6-facts-classification')
      await mirror.refresh(service)

      expect(await unclassified(queryOf(leg))).toBeNull()
      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })).rejects.toThrow(/produced no facts/)
    } finally {
      await destroyP6T1World(world)
    }
  })
})

describe('A6 fixed-category classifier', () => {
  it('classifies the closed control kinds without inventing taxonomy', () => {
    const classify = createAlpha6CategoryLookup()
    const leg = (kind: 'leader-approval' | 'user-approval' | 'envelope-mutation') => ({ kind }) as never
    expect(classify({ rootSessionId: P6T4_ROOT, leg: leg('leader-approval'), routing: BASE_ROUTING.routing })).toBe(false)
    expect(classify({ rootSessionId: P6T4_ROOT, leg: leg('user-approval'), routing: BASE_ROUTING.routing })).toBe(true)
    expect(classify({ rootSessionId: P6T4_ROOT, leg: leg('envelope-mutation'), routing: BASE_ROUTING.routing })).toBe(true)
  })
})

describe('A6 root composition (offline, no root mutation)', () => {
  it('parses once, refuses non-v5, and assembles both ports for the unique live Officer', async () => {
    const world = await makeWorld(`a6-root-composition-${Math.random().toString(36).slice(2)}`)
    {
      const members = world.domain.repositories.memberInstances.list(P6T4_ROOT)
      // eslint-disable-next-line prefer-const -- the composition closure needs the binding before the factory call
      let service!: ControlService
      const composition = createAlpha6RootComposition({
        enabled: true,
        blueprintSource: v5Source('7'),
        rootSessionId: P6T4_ROOT,
        leaderTemplateId: BASE_ROUTING.blueprint.leader.templateId,
        members,
        control: { readControlState: (root) => service.readControlState(root) },
        permissionOverlay: {
          latest: async ({ memberInstanceId }) => memberInstanceId === OFFICER ? { metadata: { generation: GENERATION } } : undefined,
        },
      })
      expect(composition.mode).toBe('alpha6')
      if (composition.mode !== 'alpha6') throw new Error('expected alpha6')
      expect(composition.officerInstanceId).toBe(OFFICER)
      service = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
        ...composition.ports,
      })
      expect((await service.readControlState(P6T4_ROOT)).requests).toEqual([])
    }
  })

  it('keeps disabled legacy and refuses an invalid v5 source without inventing a fallback', () => {
    const leaderTemplateId = BASE_ROUTING.blueprint.leader.templateId
    const base = {
      rootSessionId: P6T4_ROOT,
      leaderTemplateId,
      members: [],
      control: { readControlState: async () => ({ requests: [], transfers: [] }) },
    }
    expect(createAlpha6RootComposition({ ...base, enabled: false, blueprintSource: v5Source('7') }))
      .toEqual({ mode: 'legacy', reason: 'disabled' })
    expect(createAlpha6RootComposition({ ...base, enabled: true, blueprintSource: 'not a blueprint' }))
      .toEqual({ mode: 'refused', refused: 'blueprint-not-v5' })
  })
})

describe('A6 authority generation reader', () => {
  it('answers 0 only for the legal no-port/no-row world and throws on a non-generation', async () => {
    expect(await createAlpha6AuthorityGenerationReader(undefined)({
      teamSessionId: P6T4_ROOT,
      memberInstanceId: OFFICER,
    })).toBe(0)
    expect(await createAlpha6AuthorityGenerationReader({
      latest: async () => undefined,
    })({ teamSessionId: P6T4_ROOT, memberInstanceId: OFFICER })).toBe(0)
    expect(await createAlpha6AuthorityGenerationReader({
      latest: async () => ({ metadata: { generation: 7 } }),
    })({ teamSessionId: P6T4_ROOT, memberInstanceId: OFFICER })).toBe(7)
    await expect(createAlpha6AuthorityGenerationReader({
      latest: async () => ({ metadata: { generation: 'not-a-generation' } }),
    })({ teamSessionId: P6T4_ROOT, memberInstanceId: OFFICER })).rejects.toThrow(/never read as generation 0/)
  })
})

describe('A6 control reader (non-locking) and its composed control ports', () => {
  function memberLookup(world: P6T1World): AssignedOfficerMemberLookup {
    const repository = world.domain.repositories.memberInstances
    return {
      get: (root, instanceId) => repository.get(root, instanceId),
      list: (root) => repository.list(root),
    }
  }

  /**
   * The REAL composition: both trusted ports wired to the non-locking
   * `readControlState`, over a durable P6-T4 world. The service instance is
   * captured by the reader closure, exactly as a production composition wires
   * its own service.
   */
  function composedService(world: P6T1World): { service: ControlService; ports: Alpha6ControlPorts } {
    // eslint-disable-next-line prefer-const -- the ports closure needs the binding before the factory call
    let service!: ControlService
    const ports = createAlpha6ControlPorts({
      rootSessionId: P6T4_ROOT,
      routing: BASE_ROUTING,
      control: {
        readControlState: (rootSessionId) => service.readControlState(rootSessionId),
      },
      members: memberLookup(world),
      authorityGeneration: async ({ rootSessionId, operationOwnerInstanceId }) => {
        if (rootSessionId !== P6T4_ROOT || operationOwnerInstanceId !== WORKER) return undefined
        return GENERATION
      },
      fixedLeaderOrHumanCategory: createAlpha6CategoryLookup(),
    })
    service = createControlService({
      teamDomain: world.domain,
      blueprintCatalog: world.catalog,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T4_NOW,
      ...ports,
    })
    return { service, ports }
  }

  it('resolves a CREATED team root through its own frozen routing, never the boot policy', async () => {
    const child = parseAlpha6Routing(v5Source('8'))
    if (child === null) throw new Error('child fixture did not parse')
    const childRoot = 'root-a6-created'
    const childLeg = {
      rootSessionId: childRoot,
      requestId: 'ctrl-a6-created-leg',
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      status: 'pending',
      requester: { kind: 'instance', instanceId: WORKER },
      subject: { kind: 'instance', instanceId: WORKER },
      approvalCaseId: 'case-a6-created',
      legOrdinal: 1,
      reviewAuthority: 'leader',
      requestedEffect: 'allow',
      operationOwnerTemplateId: 'worker',
      operationToolDefinitionIdentity: 'tool-def-a6',
      operationToolOwner: 'dsh-agent-team',
      operationToolName: 'bash',
      authorityGeneration: 0,
      blueprintContentHash: child.blueprint.contentHash,
      blueprintRevision: child.blueprint.revision,
    } as never
    const ports = createAlpha6ControlPorts({
      rootSessionId: P6T4_ROOT,
      routing: BASE_ROUTING,
      routingForRoot: (root) => root === childRoot ? child : null,
      control: {
        readControlState: async (root) => ({
          requests: root === childRoot ? [childLeg] : [],
          transfers: [],
        } as never),
      },
      fixedLeaderOrHumanCategory: () => false,
      members: {
        get: (root, instanceId) =>
          root === childRoot && instanceId === 'inst-a6-created-officer'
            ? ({ rootSessionId: childRoot, instanceId, templateId: 'officer', childSessionId: 'session-a6-created-officer', lifecycle: 'SETTLED' } as never)
            : undefined,
        list: (root) => root === childRoot
          ? [({ rootSessionId: childRoot, instanceId: 'inst-a6-created-officer', templateId: 'officer', childSessionId: 'session-a6-created-officer', lifecycle: 'SETTLED' } as never)]
          : [],
      },
    })
    await expect(ports.currentReviewerForTransfer({
      rootSessionId: childRoot,
      approvalCaseId: 'case-a6-created',
      currentLegRequestId: 'ctrl-a6-created-leg',
      legOrdinal: 1,
    })).resolves.toEqual({ instanceId: 'inst-a6-created-officer' })
  })

  it('refuses a root when routingForRoot explicitly answers null (even if the boot policy would resolve)', async () => {
    // A LEG-BEARING fixture: the leg is valid under BASE_ROUTING and the
    // boot root's live Officer is present. The pre-fix `?? input.routing`
    // would therefore resolve that Officer; the explicit null must refuse.
    const bootLeg = {
      rootSessionId: P6T4_ROOT,
      requestId: 'ctrl-a6-null-leg',
      kind: 'leader-approval',
      requester: { kind: 'instance', instanceId: WORKER },
      subject: { kind: 'instance', instanceId: WORKER },
      approvalCaseId: 'case-a6-null-leg',
      legOrdinal: 1,
      reviewAuthority: 'leader',
      requestedEffect: 'allow',
      operationOwnerTemplateId: 'worker',
      operationToolDefinitionIdentity: 'tool-def-a6-null',
      operationToolOwner: 'dsh-agent-team',
      operationToolName: 'bash',
      authorityGeneration: 0,
      blueprintContentHash: BASE_ROUTING.blueprint.contentHash,
      blueprintRevision: BASE_ROUTING.blueprint.revision,
    } as never
    const bootOfficer = {
      rootSessionId: P6T4_ROOT,
      instanceId: OFFICER,
      templateId: BASE_ROUTING.routing.officerTemplateId,
      childSessionId: 'session-a6-null-officer',
      lifecycle: 'SETTLED',
    } as never
    const ports = createAlpha6ControlPorts({
      rootSessionId: P6T4_ROOT,
      routing: BASE_ROUTING,
      routingForRoot: () => null,
      control: { readControlState: async () => ({ requests: [bootLeg], transfers: [] } as never) },
      members: {
        get: (root, instanceId) => root === P6T4_ROOT && instanceId === OFFICER ? bootOfficer : undefined,
        list: (root) => root === P6T4_ROOT ? [bootOfficer] : [],
      },
      fixedLeaderOrHumanCategory: () => false,
    })
    await expect(ports.currentReviewerForTransfer({
      rootSessionId: P6T4_ROOT,
      approvalCaseId: 'case-a6-null-leg',
      currentLegRequestId: 'ctrl-a6-null-leg',
      legOrdinal: 1,
    })).resolves.toBeNull()
  })

  it('live root composition pins no startup Officer and resolves the current unique one at query time', async () => {
    const world = await makeWorld('a6-live-root-composition')
    try {
      // eslint-disable-next-line prefer-const -- the composition closure needs the binding before the factory call
      let service!: ControlService
      const composition = createAlpha6LiveRootComposition({
        enabled: true,
        blueprintSource: v5Source('7'),
        rootSessionId: P6T4_ROOT,
        leaderTemplateId: BASE_ROUTING.blueprint.leader.templateId,
        members: memberLookup(world),
        control: { readControlState: (root) => service.readControlState(root) },
        permissionOverlay: {
          latest: async ({ memberInstanceId }) => memberInstanceId === OFFICER ? { metadata: { generation: GENERATION } } : undefined,
        },
      })
      expect(composition.mode).toBe('alpha6')
      if (composition.mode !== 'alpha6') throw new Error('expected alpha6')
      service = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
        ...composition.ports,
      })
      const leg = await makeLeg(service, 'corr-a6-live-root-composition')
      // Resolved from the LIVE repository after construction, not a snapshot.
      expect(await composition.ports.currentReviewerForTransfer(queryOf(leg))).toEqual({ instanceId: OFFICER })
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('readControlState reports leg AND transfer rows with listControlState parity, without taking the lock', async () => {
    const world = await makeWorld('a6-reader-snapshot')
    try {
      const { service } = composedService(world)

      const leg = await makeLeg(service, 'corr-a6-reader-snapshot')
      await service.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        cause: 'officer-handoff',
      })

      const snapshot = await service.readControlState(P6T4_ROOT)
      expect(snapshot.requests.some((row) => row.requestId === leg.requestId)).toBe(true)
      expect(snapshot.transfers).toEqual([
        expect.objectContaining({ currentLegRequestId: leg.requestId, target: 'leader' }),
      ])
      // ONE projection behind both routes: the non-locking answer is byte-for-
      // byte the locking answer for the same durable state.
      expect(snapshot).toEqual(await service.listControlState(P6T4_ROOT))

      // Same root/TeamSession validation, same typed refusal.
      await expect(service.readControlState('session-a6-reader-missing')).rejects.toThrow(/no TeamSession record/)
      await expect(service.listControlState('session-a6-reader-missing')).rejects.toThrow(/no TeamSession record/)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('createAlpha6ControlPorts resolves a real assigned-Officer allow from INSIDE the running control operation (no deadlock)', async () => {
    const world = await makeWorld('a6-reader-ports')
    try {
      // The facts port is wired to `readControlState` (the non-locking route).
      // `resolveControl` below evaluates it while holding the per-team lock, so
      // a locking read would deadlock instead of answering.
      const { service, ports } = composedService(world)
      expect(Object.keys(ports).sort()).toEqual([
        'currentReviewerForTransfer',
        'reviewCallFactsForAssignedOfficer',
      ])

      const leg = await makeLeg(service, 'corr-a6-reader-ports')
      expect(await ports.currentReviewerForTransfer(queryOf(leg))).toEqual({ instanceId: OFFICER })

      const allowed = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })
      expect(allowed.decision).toBe('allow')
      expect(allowed.reviewCapability).toMatchObject({ source: 'blueprint-officer', entry: 'allow' })
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('the composed ports refuse a transferred leg through the same snapshot (no former-Officer authority)', async () => {
    const world = await makeWorld('a6-reader-ports-transfer')
    try {
      const { service, ports } = composedService(world)

      const leg = await makeLeg(service, 'corr-a6-reader-ports-transfer')
      await service.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        cause: 'officer-handoff',
      })

      expect(await ports.currentReviewerForTransfer(queryOf(leg))).toBeNull()
      expect(await ports.reviewCallFactsForAssignedOfficer(queryOf(leg))).toBeNull()
      // The transfer row is exactly what the snapshot reports.
      const snapshot = await service.readControlState(P6T4_ROOT)
      expect(snapshot.transfers.some((row) => row.currentLegRequestId === leg.requestId)).toBe(true)
    } finally {
      await destroyP6T1World(world)
    }
  })
})

describe('A6 facts — OperationOwner identity and generation are the trusted op facts', () => {
  it('reads the generation for the subject Member, never for the Leader requester or the Officer', async () => {
    const world = await makeWorld('a6-facts-proxy-owner')
    try {
      const mirror = new ControlRowMirror()
      const seen: string[] = []
      const port = factsPort(world, mirror, {
        generation: async ({ rootSessionId, operationOwnerInstanceId }) => {
          if (rootSessionId !== P6T4_ROOT) return undefined
          seen.push(operationOwnerInstanceId)
          // The Officer's generation (7) must never be compared to the leg's 3.
          return operationOwnerInstanceId === WORKER ? 3 : 7
        },
      })
      const service = officerService(world, port)
      // The Leader is the proxy requester; the Worker is the executing Member.
      const leg = await makeLeg(service, 'corr-a6-facts-proxy', {
        requester: LEADER,
        subjectInstance: WORKER,
        generation: 3,
      })
      await mirror.refresh(service)

      expect(await port(queryOf(leg))).not.toBeNull()
      expect(seen).toContain(WORKER)
      expect(seen).not.toContain(OFFICER)

      const allowed = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })
      expect(allowed.decision).toBe('allow')
      expect(allowed.reviewCapability).toMatchObject({
        authorityGeneration: 3,
        operationOwnerInstanceId: WORKER,
      })
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('accepts the legal initial generation 0 when the frozen leg also carries 0', async () => {
    const world = await makeWorld('a6-facts-generation-zero')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: 0 })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-facts-g0', { generation: 0 })
      await mirror.refresh(service)

      expect(await port(queryOf(leg))).not.toBeNull()
      const allowed = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })
      expect(allowed.decision).toBe('allow')
      expect(allowed.reviewCapability?.authorityGeneration).toBe(0)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('binds a same-template different instance to the subject, not the requester', async () => {
    const world = await makeWorld('a6-facts-same-template')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, {
        generation: async ({ operationOwnerInstanceId }) => (operationOwnerInstanceId === WORKER2 ? 5 : 99),
      })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-facts-same-template', {
        requester: WORKER,
        subjectInstance: WORKER2,
        generation: 5,
      })
      await mirror.refresh(service)

      expect(await port(queryOf(leg))).not.toBeNull()
      const allowed = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })
      expect(allowed.decision).toBe('allow')
      expect(allowed.reviewCapability).toMatchObject({
        authorityGeneration: 5,
        operationOwnerInstanceId: WORKER2,
      })
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses a leg whose trusted identity names no instance, even when the requester is an instance', async () => {
    const world = await makeWorld('a6-facts-no-instance-subject')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-facts-no-instance', {
        requester: WORKER,
        subject: { kind: 'template', templateId: 'worker' },
      })
      await mirror.refresh(service)

      expect(await port(queryOf(leg))).toBeNull()
    } finally {
      await destroyP6T1World(world)
    }
  })
})

/**
 * THE LAW UNDER TEST — the durable PENDING APPROVAL LEG is the subject of
 * validity, not the OperationOwner's transient lifecycle.
 *
 * The two measured defects (both on real Hosts):
 *
 *  1. joint acceptance `JOINT_J10_RELAY=1`: a member whose FIRST turn is a
 *     human `member.send` relay asks for review; the durable row reads
 *     `CREATED` and the port refused (`CONTROL_RESOLVER_NOT_AUTHORIZED`).
 *  2. F-5 two-ask lane (`task/f5-two-asks-20261111`): the same member, after
 *     finishing one work unit, asks a SECOND time; the row reads `SETTLED`
 *     and the port refused again.
 *
 * The first test below is the NEGATIVE CONTROL: with the old
 * `if (owner.lifecycle !== 'RUNNING') return null` line restored, the CREATED
 * and SETTLED assertions fail (both states are not `RUNNING`); it cannot pass
 * by accident. The end-to-end tests then prove the downstream control service
 * resolves the leg, and the fail-closed tests prove the change widened
 * nothing.
 */
describe('A6 facts — the pending leg is the subject, not the owner lifecycle', () => {
  /**
   * The worker's REAL durable row, so an override changes only the probed
   * field and every identity check still reads the true fixture values.
   */
  function workerRow(world: P6T1World): AssignedOfficerMemberSnapshot {
    const row = world.domain.repositories.memberInstances.get(P6T4_ROOT, WORKER)
    if (row === undefined) throw new Error('fixture worker row missing')
    return row
  }

  /** A port whose owner row is `row` (all other members read the repository). */
  function portWithOwner(
    world: P6T1World,
    mirror: ControlRowMirror,
    row: AssignedOfficerMemberSnapshot,
  ): AssignedOfficerFactsPort {
    return factsPort(world, mirror, {
      generation: GENERATION,
      memberOverride: (current) => current.instanceId === WORKER ? row : current,
    })
  }

  it('accepts CREATED, RUNNING and SETTLED owners and refuses revoked/terminal/unknown ones — NEGATIVE CONTROL for the old RUNNING-only gate', async () => {
    const world = await makeWorld('a6-leg-owner-states')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-leg-owner-states')
      await mirror.refresh(service)
      const query = queryOf(leg)
      const row = workerRow(world)

      // With `lifecycle !== 'RUNNING'` restored, the first two assertions fail:
      // these are the two states the two measured defects own their legs in.
      expect(await portWithOwner(world, mirror, { ...row, lifecycle: 'CREATED' })(query), 'CREATED owner must own a valid pending leg')
        .not.toBeNull()
      expect(await portWithOwner(world, mirror, { ...row, lifecycle: 'RUNNING' })(query), 'RUNNING owner must own a valid pending leg')
        .not.toBeNull()
      expect(await portWithOwner(world, mirror, { ...row, lifecycle: 'SETTLED' })(query), 'SETTLED owner must own a valid pending leg')
        .not.toBeNull()

      // Revoked, terminal, unknown and absent lifecycles stay refused.
      expect(await portWithOwner(world, mirror, { ...row, lifecycle: 'ARCHIVED' })(query), 'ARCHIVED owner must be refused')
        .toBeNull()
      expect(await portWithOwner(world, mirror, { ...row, lifecycle: 'DISPOSED' })(query), 'DISPOSED owner must be refused')
        .toBeNull()
      expect(await portWithOwner(world, mirror, { ...row, lifecycle: 'REVOKED' })(query), 'unknown lifecycle must be refused')
        .toBeNull()
      const { lifecycle: _omitted, ...withoutLifecycle } = row
      expect(await portWithOwner(world, mirror, withoutLifecycle)(query), 'absent lifecycle must be refused')
        .toBeNull()
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('lets a CREATED owner own a valid leg end to end — defect 1: the first, relayed turn', async () => {
    const world = await makeWorld('a6-leg-created')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)

      // The member has not taken a turn yet when the ask is minted.
      await flipLifecycle(world, WORKER, 'CREATED')
      const leg = await makeLeg(service, 'corr-a6-leg-created')
      await mirror.refresh(service)

      expect(await port.resolveCurrentReviewer(queryOf(leg))).toEqual({ instanceId: OFFICER })
      expect(await port(queryOf(leg))).not.toBeNull()

      const allowed = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })
      expect(allowed.decision).toBe('allow')
      expect(allowed.reviewCapability).toMatchObject({
        source: 'blueprint-officer',
        operationOwnerInstanceId: WORKER,
        operationOwnerTemplateId: 'worker',
      })
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('lets a SETTLED owner own a valid leg end to end — defect 2: the second ask after a finished work unit', async () => {
    const world = await makeWorld('a6-leg-settled')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)

      // Ask #1's work unit finished; the row is idle SETTLED for ask #2.
      await flipLifecycle(world, WORKER, 'SETTLED')
      const leg = await makeLeg(service, 'corr-a6-leg-settled')
      await mirror.refresh(service)

      expect(await port(queryOf(leg))).not.toBeNull()
      const allowed = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })
      expect(allowed.decision).toBe('allow')
      expect(allowed.reviewCapability).toMatchObject({
        source: 'blueprint-officer',
        operationOwnerInstanceId: WORKER,
      })
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('still refuses an ARCHIVED owner with the typed downstream refusal, never a guess', async () => {
    const world = await makeWorld('a6-leg-archived')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-leg-archived')
      await mirror.refresh(service)
      const query = queryOf(leg)

      await flipLifecycle(world, WORKER, 'ARCHIVED')
      expect(await port(query)).toBeNull()
      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(OFFICER),
        requestId: leg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })).rejects.toThrow(/produced no facts/)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses an owner row that does not identify the leg subject (foreign root, other instance, other template)', async () => {
    const world = await makeWorld('a6-leg-identity-mismatch')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-leg-identity-mismatch')
      await mirror.refresh(service)
      const query = queryOf(leg)
      const row = workerRow(world)

      expect(await port(query), 'control: the true row passes').not.toBeNull()
      expect(await portWithOwner(world, mirror, { ...row, rootSessionId: 'session-a6-other-team' })(query), 'foreign root must be refused').toBeNull()
      expect(await portWithOwner(world, mirror, { ...row, instanceId: WORKER2 })(query), 'other instance must be refused').toBeNull()
      expect(await portWithOwner(world, mirror, { ...row, templateId: 'scout' })(query), 'other template must be refused').toBeNull()
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('refuses a missing leg, a decided leg, a wrong generation and a missing generation', async () => {
    const world = await makeWorld('a6-leg-pending-and-generation')
    try {
      const mirror = new ControlRowMirror()
      const port = factsPort(world, mirror, { generation: GENERATION })
      const service = officerService(world, port)
      const leg = await makeLeg(service, 'corr-a6-leg-pending-and-generation')
      await mirror.refresh(service)
      const query = queryOf(leg)

      expect(await port(query), 'control: the pending leg passes').not.toBeNull()

      // No durable row at all.
      expect(await factsPort(world, new ControlRowMirror(), { generation: GENERATION })(query), 'missing leg must be refused').toBeNull()
      // A row that exists but is no longer pending.
      const decided = factsPort(world, mirror, {
        generation: GENERATION,
        legOverride: (row) => ({ ...row, status: 'decided' }),
      })
      expect(await decided(query), 'decided leg must be refused').toBeNull()
      // The frozen generation must still equal the composition's CURRENT one.
      expect(await factsPort(world, mirror, { generation: GENERATION + 1 })(query), 'wrong generation must be refused').toBeNull()
      expect(await factsPort(world, mirror, {})(query), 'missing generation must be refused').toBeNull()
    } finally {
      await destroyP6T1World(world)
    }
  })
})
