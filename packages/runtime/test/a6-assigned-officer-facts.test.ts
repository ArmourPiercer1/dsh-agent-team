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
import { createAssignedOfficerFactsPort, createAlpha6ControlPorts } from '../alpha6/assigned-officer-facts.js'
import type {
  Alpha6ControlPorts,
  AssignedOfficerFactsPort,
  AssignedOfficerMemberLookup,
  AssignedOfficerParsedRouting,
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
    readonly generation?: number
    readonly classify?: () => boolean | null
  } = {},
): AssignedOfficerFactsPort {
  const repository = world.domain.repositories.memberInstances
  return createAssignedOfficerFactsPort({
    rootSessionId: P6T4_ROOT,
    routing: options.routing ?? BASE_ROUTING,
    members: {
      get: (root, instanceId) => repository.get(root, instanceId),
      list: (root) => repository.list(root),
    },
    leg: mirror.leg,
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
    readonly ownerTemplate?: string
    readonly blueprint?: AssignedOfficerParsedRouting
  } = {},
): Promise<ControlRequestRecord> {
  const requester = options.requester ?? WORKER
  const ownerTemplate = options.ownerTemplate ?? 'worker'
  const blueprint = options.blueprint ?? BASE_ROUTING
  const outcome = await service.requestApprovalLeg({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(requester),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    reviewAuthority: 'leader',
    requiredAuthorityAtCreation: 'leader',
    identity: {
      subject: { kind: 'instance', instanceId: requester },
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
    authorityGeneration: GENERATION,
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
  return createP6T4World(name, ['leader', 'worker'], {
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
      authorityGeneration: GENERATION,
      fixedLeaderOrHumanCategory: () => false,
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
