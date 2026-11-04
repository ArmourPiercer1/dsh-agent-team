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
    const boot = (blueprintSource: string, withWake = true): unknown => {
      const config = { ...baseConfig, blueprintSource, alpha6ReviewRouting: true }
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
    destroyDir(base)
  })
})
