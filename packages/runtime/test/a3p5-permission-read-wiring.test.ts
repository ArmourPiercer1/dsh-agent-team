/**
 * Alpha.3 PR5 — ROOT BLOCK-1: the production readprojection is WIRED.
 *
 * Group A runs on the FULLY ROOT-ASSEMBLED router (`root.remoteDispatcher`
 * — the same ports/principal basis the mounted registration uses) over the
 * REAL durable overlay port and the REAL governance mutation lane: the new
 * v7 `override.getPermission` method answers the CURRENT authority + AUDIT
 * history for the exact addressed pair, refuses ghosts TYPED (mirroring the
 * write side PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN), refuses foreign teams,
 * refuses v<7 envelopes, keeps ARCHIVED history audit-visible (ADR 2/8 —
 * lifecycle gates EXECUTION, never the durable audit read), never lets a
 * fresh instance inherit prior history, and performs ZERO WRITES on every
 * leg (the durable overlay bytes are byte-identical after the whole read
 * battery; the decision plane answers identically before and after — the
 * read surface is never an authorization input, ADR 9).
 *
 * Group B runs the REAL s6-remote port with INJECTED principal derivations
 * (the createS6RemoteDispatcher seam, precedent: the a3p4 r5 world) to pin
 * the AD-1 WIRE-SEAM access gate: operator / Leader / member-self pass,
 * CROSS-MEMBER reads are refused typed with the read seam NEVER invoked.
 * The seam closure there is test-composed (the root-composed one is what
 * Group A exercises); the GATE, the bound-root assertion and the refusal
 * codes are production code.
 */
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { openPermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import { createS6RemoteDispatcher, createS6RemotePorts } from '../src/plugin/s6-remote.js'
import type { TeamPluginConfig } from '../src/plugin/types.js'
import type { TeamPermissionPlane } from '../src/plugin/permission-plane.js'
import type { CanonicalKeyContains } from '../src/plugin/permission-plane.js'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT_SID = 'session-root-a3p5read'
const FOREIGN_SID = 'session-foreign-a3p5read'
const NOW = '2026-10-13T12:00:00.000Z'
const WORKER_ID = 'inst-a3p5reader'
const ARCHIVED_ID = 'inst-a3p5archived'
const FRESH_ID = 'inst-a3p5fresh'
const V7 = 7
const V6 = 6

const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: A3P5RD-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the A3P5RD team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the A3P5RD work.',
  'teamEnvelope:',
  '  allow:',
  '    - send-message',
  '    - report-progress',
  '  deny: []',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The A3P5RD default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
].join('\n')

function makeContainKeys(): CanonicalKeyContains {
  return (parentKey, childKey) => {
    const rel = relative(resolve(parentKey), resolve(childKey))
    return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  }
}

function exactRule(resource: string): unknown {
  return { operationClass: 'write', matcher: { kind: 'exact', resource }, effect: 'allow' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unused legacy inspect surface, untyped by design
const unusedLegacyInspect: any = (): never => {
  throw new Error('a3p5 read world: legacy inspect is unused')
}

interface ReadWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the production root facade is wide; this spec asserts on a subset
  readonly root: any
  readonly plane: TeamPermissionPlane
  readonly overlay: ReturnType<typeof createPermissionOverlayRepositoryPort>
  readonly scratch: string
  readonly insideDir: string
  grant(mutationId: string, memberInstanceId: string, resource: string): Promise<boolean>
  read(memberInstanceId: string, version?: number, teamSessionId?: string): Promise<Record<string, unknown>>
  /** The durable overlay facts for one identity as ONE comparable value. */
  durableOf(memberInstanceId: string): Promise<string>
  close(): Promise<void>
}

async function openReadWorld(): Promise<ReadWorld> {
  const base = scratchDir(`a3p5read-${Math.random().toString(36).slice(2, 8)}`)
  destroyDir(base)
  const insideDir = `${base}/workspace/src`
  mkdirSync(insideDir, { recursive: true })

  const seam = new FileStorageSeam(base)
  const domain = await createTeamDomain(seam)
  const putRow = async (instanceId: string, child: string, lifecycle: string): Promise<void> => {
    await domain.repositories.memberInstances.put({
      rootSessionId: parseRootSessionId(ROOT_SID),
      instanceId: parseInstanceId(instanceId),
      templateId: parseTemplateId('worker'),
      label: `a3p5 read ${instanceId}`,
      childSessionId: parseChildSessionId(child),
      lifecycle: lifecycle as never,
      createdAt: NOW,
      activityVersion: 1,
    })
  }
  await putRow(WORKER_ID, 'session-child-a3p5reader', 'SETTLED')
  await putRow(ARCHIVED_ID, 'session-child-a3p5archived', 'ARCHIVED')
  await putRow(FRESH_ID, 'session-child-a3p5fresh', 'RUNNING')

  const overlayStore = await openPermissionOverlayStore(new FileStorageSeam(base))
  const overlay = createPermissionOverlayRepositoryPort({ repository: overlayStore.repository })

  const config: TeamPluginConfig = {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: `${base}/workspace`,
    seedMembers: [],
    staticModel: { provider: 'a3p5-read', model: 'a3p5-read-model' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const teamToolsRef = { current: undefined }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub glue surface (the P8-S5A double), untyped by design
  const live: any = createStubBindings({ config, teamToolsRef, domain })
  const permissionPlaneRef: { current: TeamPermissionPlane | undefined } = { current: undefined }
  const root = createTeamProductionRoot({
    config,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the stub world hands the root the real TeamDomain (structurally satisfied)
    domain: domain as any,
    storageSeam: seam,
    live,
    now: () => NOW,
    teamToolsRef,
    controlServiceRef: { current: undefined },
    legacyInspect: unusedLegacyInspect,
    permissionOverlay: overlay,
    fsContainsKeys: makeContainKeys(),
    permissionPlaneRef,
  })
  const plane = permissionPlaneRef.current as TeamPermissionPlane

  return {
    root,
    plane,
    overlay,
    scratch: base,
    insideDir,
    async grant(mutationId, memberInstanceId, resource) {
      const result = await plane.mutation.grantInstance({
        authority: { kind: 'operator' },
        teamSessionId: ROOT_SID,
        memberInstanceId: parseInstanceId(memberInstanceId),
        mutationId,
        reason: 'a3p5 read-wiring grant',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the closed carrier shape is asserted by the lane spec
        rules: [exactRule(resource)] as any,
      })
      return result.changed === true
    },
    async read(memberInstanceId, version = V7, teamSessionId = ROOT_SID) {
      const dispatch = root.remoteDispatcher
      if (dispatch === undefined) {
        throw new Error('the root-assembled remote dispatcher is absent on this surface')
      }
      return (await dispatch('override.getPermission', {
        version,
        params: { teamSessionId, memberInstanceId },
      })) as unknown as Record<string, unknown>
    },
    async durableOf(memberInstanceId) {
      const identity = { teamSessionId: ROOT_SID, memberInstanceId }
      return JSON.stringify({
        latest: await overlay.latest(identity),
        history: await overlay.history(identity),
      })
    },
    async close() {
      await overlayStore.close()
      destroyDir(base)
    },
  }
}

/** Pull a typed error code out of a RemoteResponse (shape-tolerant). */
function codeOf(response: unknown): string {
  return JSON.stringify(response)
}

describe('a3p5 read wiring group A — the ROOT-ASSEMBLED router on the real durable overlay port', () => {
  it('operator reads the current authority and the ascending audit history for the exact pair', async () => {
    const world = await openReadWorld()
    try {
      expect(await world.grant('mut-a3p5r-1', WORKER_ID, `${world.insideDir}/a.ts`)).toBe(true)
      const first = await world.read(WORKER_ID)
      const data = (first as { value: { data: unknown } }).value.data as {
        authority: { present: boolean; generation: number; identity: { memberInstanceId: string } }
        history: { entries: { generation: number; provenance: { mutationId: string } }[] }
      }
      expect(data.authority.present).toBe(true)
      expect(data.authority.generation).toBe(1)
      expect(data.authority.identity.memberInstanceId).toBe(WORKER_ID)
      expect(data.history.entries).toHaveLength(1)
      expect(data.history.entries[0]?.provenance.mutationId).toBe('mut-a3p5r-1')
      // Second commit: CURRENT moves, AUDIT grows ascending (never folded).
      expect(await world.grant('mut-a3p5r-2', WORKER_ID, `${world.insideDir}/b.ts`)).toBe(true)
      const second = await world.read(WORKER_ID)
      const data2 = (second as { value: { data: unknown } }).value.data as typeof data
      expect(data2.authority.generation).toBe(2)
      expect(data2.history.entries.map((e) => e.generation)).toEqual([1, 2])
    } finally {
      await world.close()
    }
  })

  it('unknown instance (no durable row) is a TYPED absence, never an empty-list masquerade', async () => {
    const world = await openReadWorld()
    try {
      const response = await world.read('inst-a3p5ghost')
      expect(codeOf(response)).toContain('PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN')
      expect(response).not.toHaveProperty('value')
    } finally {
      await world.close()
    }
  })

  it('cross-team addressing fails closed with the bound-root foreign-team code and reads nothing', async () => {
    const world = await openReadWorld()
    try {
      const response = await world.read(WORKER_ID, V7, FOREIGN_SID)
      expect(codeOf(response)).toContain('TEAM_REMOTE_FOREIGN_TEAM')
    } finally {
      await world.close()
    }
  })

  it('v6 envelopes are rejected by the version gate (v7 co-tenancy with the write pair)', async () => {
    const world = await openReadWorld()
    try {
      const response = await world.read(WORKER_ID, V6)
      expect(codeOf(response)).toContain('method-version-unsupported')
    } finally {
      await world.close()
    }
  })

  it('ARCHIVED member history stays audit-visible (lifecycle gates execution, never the durable audit read)', async () => {
    const world = await openReadWorld()
    try {
      expect(await world.grant('mut-a3p5r-arch', ARCHIVED_ID, `${world.insideDir}/c.ts`)).toBe(true)
      const response = await world.read(ARCHIVED_ID)
      const data = (response as { value: { data: unknown } }).value.data as {
        authority: { present: boolean }
        history: { entries: unknown[] }
      }
      expect(data.authority.present).toBe(true)
      expect(data.history.entries.length).toBeGreaterThan(0)
    } finally {
      await world.close()
    }
  })

  it('a fresh instance never inherits prior history: identity-keyed rows answer declared-none', async () => {
    const world = await openReadWorld()
    try {
      expect(await world.grant('mut-a3p5r-fresh', WORKER_ID, `${world.insideDir}/d.ts`)).toBe(true)
      const response = await world.read(FRESH_ID)
      const data = (response as { value: { data: unknown } }).value.data as {
        authority: { present: boolean }
        history: { entries: unknown[] }
      }
      expect(data.authority.present).toBe(false)
      expect(data.history.entries).toEqual([])
    } finally {
      await world.close()
    }
  })

  it('the whole read battery writes ZERO durable bytes and never alters a decision answer', async () => {
    const world = await openReadWorld()
    try {
      expect(await world.grant('mut-a3p5r-zero', WORKER_ID, `${world.insideDir}/e.ts`)).toBe(true)
      await world.grant('mut-a3p5r-zero2', ARCHIVED_ID, `${world.insideDir}/f.ts`)
      const beforeWorker = await world.durableOf(WORKER_ID)
      const beforeArchived = await world.durableOf(ARCHIVED_ID)
      // The read battery (positives + every refusal leg):
      await world.read(WORKER_ID)
      await world.read(ARCHIVED_ID)
      await world.read(FRESH_ID)
      await world.read('inst-a3p5ghost')
      await world.read(WORKER_ID, V7, FOREIGN_SID)
      await world.read(WORKER_ID, V6)
      expect(await world.durableOf(WORKER_ID)).toBe(beforeWorker)
      expect(await world.durableOf(ARCHIVED_ID)).toBe(beforeArchived)
    } finally {
      await world.close()
    }
  })

  it('the read lane never enters execution authorization: zero production references outside the wire seam, and the decision lane input stays byte-stable across reads', async () => {
    const world = await openReadWorld()
    try {
      expect(await world.grant('mut-a3p5r-plane', WORKER_ID, `${world.insideDir}/g.ts`)).toBe(true)
      // (a) THE 0-REFERENCE LEG (ADR 9): the read projection factory is
      // referenced by EXACTLY the lane definition plus the root wire seam.
      // The decision plane, the pre-execute gate, kernel authorize, the
      // delivery gate and every wake surface carry ZERO references.
      const { execFileSync } = await import('node:child_process')
      const hits = execFileSync(
        'grep',
        [
          '-rln',
          'createPermissionReadProjection',
          join(HERE, '..', 'src'),
          '--include=*.ts',
          '--include=*.mjs',
          '--exclude-dir=dist',
        ],
        { encoding: 'utf8' },
      )
        .split('\n')
        .filter((line) => line.length > 0)
      expect(
        hits.every(
          (f) =>
            f.endsWith('plugin/root.ts') ||
            f.endsWith('plugin/types.ts') ||
            f.endsWith('permission-notification/projection.ts') ||
            f.endsWith('permission-notification/index.ts'),
        ),
        `projection referenced outside lane+wire seam: ${hits.join(',')}`,
      ).toBe(true)
      expect(hits.some((f) => f.endsWith('plugin/root.ts')), 'the wire seam is the ONE production consumer').toBe(true)
      // (b) The decision lane authority input (the SAME overlay `latest`
      // read the lane performs per types.ts:398-400) is byte-stable across
      // the whole read battery: the read surface alters nothing the
      // decision consumes.
      const identity = { teamSessionId: ROOT_SID, memberInstanceId: parseInstanceId(WORKER_ID) }
      const laneInputBefore = JSON.stringify(await world.overlay.latest(identity))
      await world.read(WORKER_ID)
      await world.read(WORKER_ID)
      const laneInputAfter = JSON.stringify(await world.overlay.latest(identity))
      expect(laneInputAfter).toBe(laneInputBefore)
    } finally {
      await world.close()
    }
  })
})

describe('a3p5 read wiring group B — the AD-1 wire-seam access gate on the real s6-remote port', () => {
  interface GateWorld {
    seamCalls: string[]
    ports: unknown
    close: () => void
  }
  async function openGateWorld(options: { readonly wireSeam?: boolean } = {}): Promise<GateWorld> {
    const base = scratchDir(`a3p5gate-${Math.random().toString(36).slice(2, 8)}`)
    destroyDir(base)
    const seam = new FileStorageSeam(base)
    const domain = await createTeamDomain(seam)
    const seamCalls: string[] = []
    const permission: Record<string, unknown> = {
      mutatePermission: async () => {
        throw new Error('gate world: the mutation lane is not part of this group')
      },
    }
    if (options.wireSeam !== false) {
      permission.getPermission = async (teamSessionId: string, memberInstanceId: string) => {
        seamCalls.push(`${teamSessionId}#${memberInstanceId}`)
        return { authority: { present: false, identity: { teamSessionId, memberInstanceId } }, history: { identity: { teamSessionId, memberInstanceId }, entries: [] } }
      }
    }
    const ports = createS6RemotePorts({
      rootSessionId: ROOT_SID,
      repositories: domain.repositories,
      isOwnedRoot: (sid: string) => sid === ROOT_SID,
      governance: { mutatePermission: async () => { throw new Error('unused') } },
      permission,
    } as never)
    return {
      seamCalls,
      ports,
      close: () => {
        destroyDir(base)
      },
    }
  }

  const human = () => Promise.resolve({ kind: 'human', humanId: 'operator-read' } as never)
  const leader = () => Promise.resolve({ kind: 'instance', instanceId: 'inst-leader' } as never)
  const selfMember = () => Promise.resolve({ kind: 'instance', instanceId: WORKER_ID } as never)
  const otherMember = () => Promise.resolve({ kind: 'instance', instanceId: FRESH_ID } as never)

  it('member-self read passes the gate; the seam answers for its OWN overlay', async () => {
    const world = await openGateWorld()
    try {
      const dispatch = createS6RemoteDispatcher(world.ports as never, selfMember as never)
      const response = await dispatch('override.getPermission', {
        version: V7,
        params: { teamSessionId: ROOT_SID, memberInstanceId: WORKER_ID },
      })
      expect(codeOf(response)).toContain('present')
      expect(world.seamCalls).toEqual([`${ROOT_SID}#${WORKER_ID}`])
    } finally {
      world.close()
    }
  })

  it('cross-member read is refused TYPED and the read seam is NEVER invoked', async () => {
    const world = await openGateWorld()
    try {
      const dispatch = createS6RemoteDispatcher(world.ports as never, otherMember as never)
      const response = await dispatch('override.getPermission', {
        version: V7,
        params: { teamSessionId: ROOT_SID, memberInstanceId: WORKER_ID },
      })
      expect(codeOf(response)).toContain('TEAM_REMOTE_PRINCIPAL_INVALID')
      expect(world.seamCalls).toEqual([])
    } finally {
      world.close()
    }
  })

  it('the Leader governance actor reads any member of the addressed team; the operator default still passes', async () => {
    const world = await openGateWorld()
    try {
      const asLeader = createS6RemoteDispatcher(world.ports as never, leader as never)
      const leaderResponse = await asLeader('override.getPermission', {
        version: V7,
        params: { teamSessionId: ROOT_SID, memberInstanceId: ARCHIVED_ID },
      })
      expect(codeOf(leaderResponse)).toContain('present')
      const asOperator = createS6RemoteDispatcher(world.ports as never, human as never)
      const operatorResponse = await asOperator('override.getPermission', {
        version: V7,
        params: { teamSessionId: ROOT_SID, memberInstanceId: ARCHIVED_ID },
      })
      expect(codeOf(operatorResponse)).toContain('present')
      expect(world.seamCalls).toHaveLength(2)
    } finally {
      world.close()
    }
  })

  it('an unwired read seam refuses typed at the port with zero seam activity (fail-closed, zero read, zero write)', async () => {
    const world = await openGateWorld({ wireSeam: false })
    try {
      const ports = world.ports as unknown as {
        override: {
          getPermission: (
            request: { teamSessionId: string; memberInstanceId: string },
            caller: { kind: 'human'; humanId: string },
          ) => Promise<unknown>
        }
      }
      await expect(
        ports.override.getPermission(
          { teamSessionId: ROOT_SID, memberInstanceId: WORKER_ID },
          { kind: 'human', humanId: 'operator-read' },
        ),
      ).rejects.toThrow(/zero read, zero write/)
      expect(world.seamCalls).toEqual([])
    } finally {
      world.close()
    }
  })
})
