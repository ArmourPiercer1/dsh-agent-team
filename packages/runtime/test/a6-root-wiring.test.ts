/**
 * Alpha.6 root wiring — the EXPLICIT OPT-IN assembly of the two trusted
 * review-facts ports (`createAlpha6RootWiring`).
 *
 * These legs are PURE: a fake durable member view and a fake non-locking
 * control reader are enough, because the assembly's only jobs are the flag,
 * the composition decision and the port object. No Host boots here.
 *
 * What is pinned:
 *   1. flag absent/false => `legacy`, NO ports, and the live-input thunk is
 *      never invoked (the Alpha.5 object stays byte-identical: no Blueprint
 *      field read, no member row listed);
 *   2. flag true + v5 + one live Officer => `alpha6` with BOTH trusted ports,
 *      and the ports read the LIVE control reader at query time;
 *   3. flag true + a source the composition refuses => `refused` with NO
 *      ports (the caller must fail closed at wiring time; never the Leader).
 */
import { describe, expect, it } from 'vitest'
import { createAlpha6RootWiring } from '../alpha6/root-composition.js'
import type { Alpha6RootWiringLiveInput } from '../alpha6/root-composition.js'
import type { AssignedOfficerMemberSnapshot } from '../alpha6/assigned-officer-facts.js'

const ROOT = 'session-a6-root-wiring'
const OFFICER = 'inst-a6rootwiring-officer'

/** The distinct live Officer row the fake durable view reports. */
const OFFICER_ROW: AssignedOfficerMemberSnapshot = {
  instanceId: OFFICER,
  rootSessionId: ROOT,
  templateId: 'officer',
  childSessionId: 'session-child-a6-root-wiring-officer',
  lifecycle: 'RUNNING',
}

/** The same complete v5 shape the sibling composition legs use. */
function v5Source(revision: string): string {
  return [
    '---',
    'schemaVersion: 5',
    'blueprintId: A6WIRE-BP',
    `revision: "${revision}"`,
    'leader: { templateId: leader, persona: Lead. }',
    'members:',
    '  - templateId: officer',
    '    persona: Review asks.',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope: { rules: [] }',
    'teamHardEnvelope: { rules: [] }',
    'teamEnvelope:',
    '  allow:',
    '    - request-control',
    '  deny: []',
    'metadata: {}',
    'reviewRouting:',
    '  enabled: true',
    '  officerTemplateId: officer',
    '  ordinaryToolApprovals:',
    '    default: officer',
    '    leaderExceptions: []',
    '  whenOfficerUnavailable: hold',
    '---',
    '',
  ].join('\n')
}

/** A v4 document: parses as a Blueprint, is NOT a v5 routing source. */
const V4_SOURCE = v5Source('8')
  .replace('schemaVersion: 5', 'schemaVersion: 4')
  .split('\n')
  .filter((line) => {
    const field = line.trim()
    return !(
      field === 'reviewRouting:' ||
      field === 'enabled: true' ||
      field.startsWith('officerTemplateId:') ||
      field === 'ordinaryToolApprovals:' ||
      field.startsWith('default:') ||
      field.startsWith('leaderExceptions:') ||
      field.startsWith('whenOfficerUnavailable:')
    )
  })
  .join('\n')

interface Harness {
  readonly members: {
    readonly get: (rootSessionId: string, instanceId: string) => AssignedOfficerMemberSnapshot | undefined
    readonly list: (rootSessionId: string) => readonly AssignedOfficerMemberSnapshot[]
  }
  readonly control: {
    readonly readControlState: (rootSessionId: string) => Promise<{
      readonly requests: readonly unknown[]
      readonly transfers: readonly unknown[]
    }>
  }
  readonly reads: () => number
}

function harness(): Harness {
  let reads = 0
  return {
    members: {
      get: (rootSessionId, instanceId) =>
        rootSessionId === ROOT && instanceId === OFFICER ? OFFICER_ROW : undefined,
      list: (rootSessionId) => (rootSessionId === ROOT ? [OFFICER_ROW] : []),
    },
    control: {
      readControlState: async () => {
        reads += 1
        return { requests: [], transfers: [] }
      },
    },
    reads: () => reads,
  }
}

function liveInput(source: string, h: Harness): Alpha6RootWiringLiveInput {
  return {
    blueprintSource: source,
    rootSessionId: ROOT,
    leaderTemplateId: 'leader',
    members: h.members,
    control: h.control,
  }
}

describe('A6 root wiring (explicit opt-in ports assembly)', () => {
  it('flag absent/false => legacy, NO ports, and the live input is never read', () => {
    let invoked = 0
    const wiring = createAlpha6RootWiring(false, () => {
      invoked += 1
      throw new Error('the live Alpha.6 input must not be read when the flag is off')
    })
    expect(wiring).toEqual({ mode: 'legacy' })
    expect('ports' in wiring).toBe(false)
    expect(invoked).toBe(0)
  })

  it('flag true + v5 + one live Officer => alpha6 with BOTH trusted ports', async () => {
    const h = harness()
    const wiring = createAlpha6RootWiring(true, () => liveInput(v5Source('1'), h))
    expect(wiring.mode).toBe('alpha6')
    if (wiring.mode !== 'alpha6') throw new Error('expected alpha6')
    expect(Object.keys(wiring.ports).sort()).toEqual([
      'currentReviewerForTransfer',
      'reviewCallFactsForAssignedOfficer',
    ])
    // The ports consult the LIVE non-locking reader at QUERY time (the closure
    // is late-bound in production); an unknown leg answers null, not a throw.
    expect(
      await wiring.ports.reviewCallFactsForAssignedOfficer({
        rootSessionId: ROOT,
        approvalCaseId: 'case-a6-root-wiring',
        currentLegRequestId: 'leg-a6-root-wiring',
        legOrdinal: 1,
        kind: 'leader-approval',
        reviewAuthority: 'leader',
      }),
    ).toBeNull()
    expect(h.reads()).toBe(1)
  })

  it('flag true + a refused source => refused with NO ports, no silent Leader fallback', () => {
    const h = harness()
    const wiring = createAlpha6RootWiring(true, () => liveInput(V4_SOURCE, h))
    expect(wiring).toEqual({ mode: 'refused', refused: 'blueprint-not-v5' })
    expect('ports' in wiring).toBe(false)
    // The composition refuses BEFORE reading the control plane.
    expect(h.reads()).toBe(0)
  })
})

describe('A6 root wiring — production entry opt-in', () => {
  it('boots the production root with the flag on and refuses a non-v5 source', async () => {
    const { createTeamDomain } = await import('../../storage/repositories/index.js')
    const { FileStorageSeam, scratchDir, destroyDir } = await import('../../testkit/fault-injection/file-seam.mjs')
    const { parseChildSessionId, parseInstanceId, parseRootSessionId, parseTemplateId } = await import('../../contracts/src/index.js')
    const { createAgentBindings: createStubBindings } = await import('./p8s5a-stub-glue.mjs')
    const { createTeamProductionRoot } = await import('../src/plugin/root.js')

    const base = scratchDir(`a6rootwire-${Math.random().toString(36).slice(2, 8)}`)
    const seam = new FileStorageSeam(base)
    const domain = await createTeamDomain(seam)
    await domain.repositories.memberInstances.put({
      rootSessionId: parseRootSessionId(ROOT),
      instanceId: parseInstanceId('inst-a6wireoff'),
      templateId: parseTemplateId('officer'),
      label: 'a6 root wiring officer',
      childSessionId: parseChildSessionId('session-child-a6wireoff'),
      lifecycle: 'RUNNING' as never,
      createdAt: '2026-11-04T12:00:00.000Z',
      activityVersion: 1,
    })

    const baseConfig = {
      bootPhase: 'create' as const,
      rootSessionId: ROOT,
      generation: 1,
      defaultWorkspace: `${base}/workspace`,
      seedMembers: [],
      staticModel: { provider: 'a6-root', model: 'a6-root-model' },
      deniedSelection: null,
      mcpServer: null,
      environmentFacts: [],
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
    }
    const boot = (blueprintSource: string, withWake = true, enabled = true, withStore = true): unknown => {
      const config = { ...baseConfig, blueprintSource, alpha6ReviewRouting: enabled, ...(withStore ? { alpha6WakeIntentPath: `${base}/wake-intents` } : {}) }
      const teamToolsRef = { current: undefined }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the P8-S5A stub glue double
      const live: any = createStubBindings({ config, teamToolsRef, domain })
      if (withWake) live.deliverReviewWake = async (): Promise<void> => undefined
      return createTeamProductionRoot({
        config,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the real TeamDomain satisfies the structural port
        domain: domain as any,
        storageSeam: seam,
        live,
        now: () => '2026-11-04T12:00:00.000Z',
        teamToolsRef,
        controlServiceRef: { current: undefined },
        legacyInspect: (() => { throw new Error('legacy inspect unused') }) as never,
        fsContainsKeys: () => true,
        permissionPlaneRef: { current: undefined },
      })
    }

    expect(boot(v5Source('7'))).toBeDefined()
    expect(() => boot(V4_SOURCE)).toThrow(/blueprint-not-v5/)
    // The opt-in requires a REAL wake seam; absence refuses rather than
    // silently notifying nobody or falling back to the Leader.
    expect(() => boot(v5Source('8'), false)).toThrow(/live wake seam|deliverReviewWake/)
    // An opt-in WITHOUT the durable intent store is a configuration refusal,
    // never a silent in-memory single-flight.
    expect(() => boot(v5Source('10'), true, true, false)).toThrow(/wake-intent path|crash-safe/)
    // Opt-in OFF: the SAME v5 source boots with NO wake seam and exposes NO
    // Alpha.6 turn-latch surface (the Alpha.5 path stays byte-identical).
    const legacyRoot = boot(v5Source('9'), false, false) as {
      readonly alpha6TurnLatchStart?: unknown
      readonly alpha6TurnLatchEnd?: unknown
      readonly alpha6RecoverWakeLatches?: unknown
    }
    expect(legacyRoot.alpha6TurnLatchStart).toBeUndefined()
    expect(legacyRoot.alpha6TurnLatchEnd).toBeUndefined()
    expect(legacyRoot.alpha6RecoverWakeLatches).toBeUndefined()
    destroyDir(base)
  })

  it('merges three real requestControl rows into ONE wake, then re-wakes after release', async () => {
    const { createTeamDomain } = await import('../../storage/repositories/index.js')
    const { FileStorageSeam, scratchDir, destroyDir } = await import('../../testkit/fault-injection/file-seam.mjs')
    const { parseChildSessionId, parseInstanceId, parseRootSessionId, parseTemplateId } = await import('../../contracts/src/index.js')
    const { createAgentBindings: createStubBindings } = await import('./p8s5a-stub-glue.mjs')
    const { createTeamProductionRoot } = await import('../src/plugin/root.js')

    const base = scratchDir(`a6rootwake-${Math.random().toString(36).slice(2, 8)}`)
    const seam = new FileStorageSeam(base)
    const domain = await createTeamDomain(seam)
    const row = (instanceId: string, templateId: string, child: string) => ({
      rootSessionId: parseRootSessionId(ROOT),
      instanceId: parseInstanceId(instanceId),
      templateId: parseTemplateId(templateId),
      label: instanceId,
      childSessionId: parseChildSessionId(child),
      lifecycle: 'RUNNING' as never,
      createdAt: '2026-11-04T12:00:00.000Z',
      activityVersion: 1,
    })
    await domain.repositories.memberInstances.put(row('inst-a6wakeofficer', 'officer', 'session-a6wake-officer'))
    await domain.repositories.memberInstances.put(row('inst-a6wakeworker', 'worker', 'session-a6wake-worker'))

    const wakes: Array<{ targetSessionId: string; wakeId: string; text: string }> = []
    const notificationFailures: unknown[] = []
    const config = {
      bootPhase: 'create' as const,
      rootSessionId: ROOT,
      generation: 1,
      defaultWorkspace: `${base}/workspace`,
      seedMembers: [],
      staticModel: { provider: 'a6-root', model: 'a6-root-model' },
      deniedSelection: null,
      mcpServer: null,
      environmentFacts: [],
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
      blueprintSource: v5Source('11'),
      alpha6ReviewRouting: true,
      alpha6WakeIntentPath: `${base}/wake-intents`,
    }
    const teamToolsRef = { current: undefined }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the P8-S5A stub glue double
    const live: any = createStubBindings({ config, teamToolsRef, domain })
    live.deliverReviewWake = async (input: { targetSessionId: string; wakeId: string; text: string }) => {
      wakes.push(input)
    }
    const root = createTeamProductionRoot({
      config,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the real TeamDomain satisfies the structural port
      domain: domain as any,
      storageSeam: seam,
      live,
      now: () => '2026-11-04T12:00:00.000Z',
      teamToolsRef,
      controlServiceRef: { current: undefined },
      legacyInspect: (() => { throw new Error('legacy inspect unused') }) as never,
      fsContainsKeys: () => true,
      permissionPlaneRef: { current: undefined },
      onNotificationFailure: (failure) => {
        notificationFailures.push(failure.error)
      },
    })
    await root.boot()
    const leaderRow = (await domain.repositories.memberInstances.list(parseRootSessionId(ROOT))).find(
      (member) => member.templateId === 'leader',
    )
    if (leaderRow === undefined) throw new Error('the booted root has no Leader row')
    const leaderCaller = { kind: 'instance' as const, instanceId: leaderRow.instanceId }
    const { parseBlueprintV5 } = await import('../../domain/blueprint/src/index.js')
    const parsedBlueprint = parseBlueprintV5(v5Source('11'))

    const ask = async (n: number): Promise<void> => {
      await root.control.requestApprovalLeg({
        rootSessionId: ROOT,
        caller: leaderCaller,
        kind: 'leader-approval',
        reviewAuthority: 'leader',
        requiredAuthorityAtCreation: 'leader',
        identity: {
          subject: { kind: 'instance', instanceId: 'inst-a6wakeworker' },
          beneficiaryAuthority: 'member',
          requestedEffect: 'ask',
          operationFingerprint: `fp-a6wake-${String(n)}`,
          authorityScope: {
            operationClass: 'tool-invoke',
            matcher: { kind: 'exact', resource: 'tool:team_bash' },
          },
          correlation: `corr-a6wake-${String(n)}`,
        },
        actionName: 'team_bash',
        toolName: 'team_bash',
        reviewPayload: {
          authorityScope: {
            operationClass: 'tool-invoke',
            matcher: { kind: 'exact', resource: 'tool:team_bash' },
          },
        },
        operationOwnerTemplateId: 'worker',
        operationToolDefinitionIdentity: 'tooldef-a6wake',
        operationToolOwner: 'a6-root',
        operationToolName: 'team_bash',
        perEffectRequiredAuthorities: ['leader'],
        authorityGeneration: 0,
        blueprintContentHash: parsedBlueprint.contentHash,
        blueprintRevision: parsedBlueprint.revision,
      })
    }
    for (const n of [1, 2, 3]) await ask(n)
    const until = async (predicate: () => boolean): Promise<void> => {
      const deadline = Date.now() + 5_000
      while (!predicate()) {
        if (Date.now() > deadline) {
          throw new Error(
            `wake never arrived (count=${String(wakes.length)} failures=${notificationFailures.map((error) => (error instanceof Error ? error.message : String(error))).join(' | ')})`,
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }
    await until(() => wakes.length === 1)
    expect(wakes[0]!.targetSessionId).toBe('session-a6wake-officer')

    root.alpha6TurnLatchStart?.('session-a6wake-officer')
    // A request arriving DURING the active turn is dirty, never a second
    // delivery: the latch is held and the wake would interrupt the reviewer.
    await ask(4)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(wakes.length).toBe(1)
    await root.alpha6TurnLatchEnd?.('session-a6wake-officer')
    await until(() => wakes.length === 2)
    expect(wakes[1]!.wakeId).not.toBe(wakes[0]!.wakeId)

    // The next turn claims wake 2; work arriving inside it is again dirty.
    root.alpha6TurnLatchStart?.('session-a6wake-officer')
    await ask(5)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(wakes.length).toBe(2)
    await root.alpha6TurnLatchEnd?.('session-a6wake-officer')
    await until(() => wakes.length === 3)
    destroyDir(base)
  })
})

describe('A6 root router — recipient comes from the SHARED router, never "the unique Officer"', () => {
  const root = 'session-a6-router'
  const routing = {
    enabled: true as const,
    officerTemplateId: 'officer',
    ordinaryToolApprovals: { default: 'officer' as const, leaderExceptions: [] },
    whenOfficerUnavailable: 'hold' as const,
  }
  const leader = { instanceId: 'inst-leader', templateId: 'leader', childSessionId: 'session-root', lifecycle: 'RUNNING', rootSessionId: root }
  // The REAL production Leader row (contracts-v2 LeaderInstanceRecord): no
  // lifecycle, no childSessionId. It must still be a legal Leader target.
  const productionLeader = { instanceId: 'inst-leader', templateId: 'leader', rootSessionId: root }
  const officer = { instanceId: 'inst-officer', templateId: 'officer', childSessionId: 'session-officer', lifecycle: 'RUNNING', rootSessionId: root }
  const worker = { instanceId: 'inst-worker', templateId: 'worker', childSessionId: 'session-worker', lifecycle: 'RUNNING', rootSessionId: root }
  const baseRow = {
    requestId: 'req-1',
    rootSessionId: root,
    kind: 'leader-approval' as const,
    requester: { kind: 'instance' as const, instanceId: 'inst-worker' },
    subject: { kind: 'instance' as const, instanceId: 'inst-worker' },
    actionName: 'team_bash',
    correlation: 'corr-1',
    status: 'pending' as const,
    createdAt: '2026-11-04T12:00:00.000Z',
    requestSequence: 1,
    approvalCaseId: 'case-1',
    legOrdinal: 1,
    reviewAuthority: 'leader' as const,
    requestedEffect: 'ask' as const,
    operationOwnerTemplateId: 'worker',
    operationToolOwner: 'a6-root',
    operationToolName: 'team_bash',
    operationFingerprint: 'fp-1',
    perEffectRequiredAuthorities: ['leader' as const],
    reviewPayload: { authorityScope: { operationClass: 'tool-invoke', matcher: { kind: 'exact', resource: 'tool:team_bash' } } },
  }
  const makeRouter = async (
    rows: readonly unknown[],
    members: readonly unknown[],
    overrides: { exceptions?: readonly unknown[]; transfers?: readonly unknown[]; kind?: string } = {},
  ) => {
    const { createAlpha6RootRouter } = await import('../alpha6/root-router.js')
    return createAlpha6RootRouter({
      rootSessionId: root,
      routing: { ...routing, ordinaryToolApprovals: { ...routing.ordinaryToolApprovals, leaderExceptions: overrides.exceptions ?? [] } } as never,
      leaderTemplateId: 'leader',
      control: { readControlState: async () => ({ requests: rows, transfers: overrides.transfers ?? [], corruptLegs: [] }) as never },
      members: { list: async () => members as never },
      fixedLeaderOrHumanCategory: ({ kind }) => kind === ('envelope-mutation' as never) || overrides.kind === 'fixed',
    })
  }

  it('routes an ordinary worker ask to the Officer', async () => {
    const route = await (await makeRouter([baseRow], [leader, officer, worker])).route('req-1')
    expect(route).toMatchObject({ kind: 'recipient', target: { kind: 'instance', instanceId: 'inst-officer', routeRole: 'officer' } })
  })

  it('routes the Officer self-ask to the Leader', async () => {
    const route = await (await makeRouter([{ ...baseRow, operationOwnerTemplateId: 'officer' }], [leader, officer, worker])).route('req-1')
    expect(route).toMatchObject({ kind: 'recipient', target: { instanceId: 'inst-leader', routeRole: 'leader' } })
  })

  it('routes a self-ask to the production v2 Leader row (no lifecycle/childSessionId)', async () => {
    const route = await (await makeRouter(
      [{ ...baseRow, operationOwnerTemplateId: 'officer' }],
      [productionLeader, officer, worker],
    )).route('req-1')
    expect(route).toMatchObject({ kind: 'recipient', target: { instanceId: 'inst-leader', routeRole: 'leader' } })
  })

  it('routes a declared Leader exception to the Leader', async () => {
    const route = await (await makeRouter([baseRow], [leader, officer, worker], {
      exceptions: [{ memberTemplateId: 'worker', tool: { owner: 'a6-root', name: 'team_bash' } }],
    })).route('req-1')
    expect(route).toMatchObject({ kind: 'recipient', target: { instanceId: 'inst-leader', routeRole: 'leader' } })
  })

  it('routes a transferred leg to the Leader', async () => {
    const route = await (await makeRouter([baseRow], [leader, officer, worker], {
      transfers: [{ currentLegRequestId: 'req-1', target: 'leader', actor: { kind: 'trusted-team-runtime' } }],
    })).route('req-1')
    expect(route).toMatchObject({ kind: 'recipient', target: { instanceId: 'inst-leader', routeRole: 'leader' } })
  })

  it('never invents an Officer when none is active', async () => {
    const route = await (await makeRouter([baseRow], [leader, worker])).route('req-1')
    expect(route?.kind).toBe('hold')
  })
})
