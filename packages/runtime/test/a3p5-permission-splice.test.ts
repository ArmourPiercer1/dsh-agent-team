/**
 * Alpha.3 PR5 — THE PRODUCTION SPLICE, INTEGRATION.
 *
 * What is REAL here (no substitutes labeled as real): the assembled
 * production root (`createTeamProductionRoot`) with the REAL governance
 * mutation service, the REAL PR1 durable overlay port over the real
 * file-store medium, the REAL lifecycle reader, the REAL completion-point
 * decoration (post-COMMIT emission) and the REAL lane binding/gate modules
 * (permission-notification/binding.ts) running end to end — a committed
 * permission mutation reaches (or deliberately does not reach) the
 * inject-only receipt gate through the production wiring, not a hand-rolled
 * re-stitch.
 *
 * What is a BOUNDARY DOUBLE, labeled as such: the live AGENT itself. A real
 * running Agent needs the host runtime (out of this lane's GO: no host/kit
 * runs), so the seam boundary is the receipt point — the glue's
 * `permissionNoticeReceipt` contract (`closing()` + `liveHandle(pair)`) —
 * implemented in-test over a landmine agent exposing ONLY `status`/`inject`
 * (the binding specs pin the gate semantics on the same boundary), while a
 * source-pin leg below locks the REAL glue receipt block (agent-bindings
 * .mjs) to read-only facts with zero wake members. The host-level
 * end-to-end (real glue + real Agent) is the recorded remaining
 * host/kit-dimension acceptance, honestly out of scope here.
 *
 * Legs: (1) commit -> exactly one inject through the real wiring, plugin
 * producer, landmine-touched surface; (2) `changed:false` -> nothing;
 * (3) idle target -> nothing (never woken); (4) closing receipt -> nothing,
 * commit intact; (5) NO receipt seam -> zero delivery and a byte-identical
 * durable commit (emission never alters the ack/durable outcome);
 * (6) source pins: the real glue receipt block is read-only (no
 * ensureLiveAgent / inject / wake members) and root.ts carries exactly one
 * emission site, ordered BEFORE the plane/remote/tools consumers.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { openPermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import { PERMISSION_OVERLAY_MAX_REASON_LENGTH } from '../../storage/schema/permission-overlay.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import type { TeamPluginConfig } from '../src/plugin/types.js'
import type { TeamPermissionPlane } from '../src/plugin/permission-plane.js'
import type { CanonicalKeyContains } from '../src/plugin/permission-plane.js'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT_SID = 'session-root-a3p5splice'
const NOW = '2026-10-12T12:00:00.000Z'
const WORKER_ID = parseInstanceId('inst-a3p5worker')
const RUNTIME_ROOT = join(HERE, '..')

const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 3',
  'blueprintId: A3P5SP-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the A3P5SP team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the A3P5SP work.',
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
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'policyStates:',
  '  - id: default',
  '    description: The A3P5SP default state.',
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

function exactRule(operationClass: string, resource: string, effect: 'allow' | 'deny'): unknown {
  return { operationClass, matcher: { kind: 'exact', resource }, effect }
}

/** The A29 legacy reader is never reached in this world (no legacy lane). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unused legacy inspect surface, untyped by design
const unusedLegacyInspect: any = (): never => {
  throw new Error('a3p5 splice world: legacy inspect is unused')
}

/** The landmine live-agent boundary double: ONLY `status` + `inject` are
 *  reachable; touching any other member records the violation. (The real
 *  upstream `Agent` is far wider — the binding must never reach past the
 *  two wake members, pinned here on the production wiring.) The status is
 *  mutable so a leg can flip the live state under one stable agent
 *  identity (the same landmine arrays stay observable across the flip). */
function makeLandmineAgent(initialStatus: 'idle' | 'running'): {
  agent: unknown
  inbox: unknown[]
  touched: string[]
  setStatus: (status: 'idle' | 'running') => void
} {
  const inbox: unknown[] = []
  const touched: string[] = []
  let status = initialStatus
  const core = {
    inject: (message: unknown): void => {
      inbox.push(message)
    },
  }
  const agent = new Proxy(core as Record<string, unknown>, {
    get(target, prop) {
      if (prop === 'status') {
        return status
      }
      if (prop === 'inject' || typeof prop !== 'string') {
        return target[prop as 'inject']
      }
      touched.push(prop)
      return undefined
    },
  })
  return { agent, inbox, touched, setStatus: (next) => { status = next } }
}

interface SpliceWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the production root surface is a wide facade; this spec asserts on a subset
  readonly root: any
  readonly plane: TeamPermissionPlane
  readonly overlay: ReturnType<typeof createPermissionOverlayRepositoryPort>
  readonly scratch: string
  readonly insideDir: string
  readonly inbox: unknown[]
  readonly touched: string[]
  setAgentStatus(status: 'idle' | 'running'): void
  setClosing(closing: boolean): void
  grant(mutationId: string, resource: string): Promise<{ changed: boolean; reason?: string }>
  restore(mutationId: string, resource?: string): Promise<Record<string, unknown>>
  lifecycleRestore(): Promise<Record<string, unknown>>
  /** Drain the detached emitter: poll until settled (fire-and-forget by
   *  design, so the drain is observed, never joined). */
  settle(): Promise<void>
  close(): Promise<void>
}

async function openSpliceWorld(options: {
  readonly receipt?: 'attached' | 'absent' | 'closing'
  readonly agentStatus?: 'idle' | 'running'
  readonly memberLifecycle?: 'SETTLED' | 'ARCHIVED'
} = {}): Promise<SpliceWorld> {
  const receipt = options.receipt ?? 'attached'
  const base = scratchDir(`a3p5splice-${Math.random().toString(36).slice(2, 8)}`)
  destroyDir(base)
  const insideDir = `${base}/workspace/src`
  mkdirSync(insideDir, { recursive: true })

  const seam = new FileStorageSeam(base)
  const domain = await createTeamDomain(seam)
  await domain.repositories.teamSessions.put({
    blueprint: {
      blueprintId: parseBlueprintId('A3P5SP-BP'),
      revision: parseBlueprintRevision('1'),
      contentHash: parseBlueprintContentHash('sha256-0123456789abcdef0123456789abcdef'),
    },
    createdAt: NOW,
    defaultWorkspace: `${base}/workspace`,
    generation: 1,
    rootSessionId: parseRootSessionId(ROOT_SID),
  })
  await domain.repositories.memberInstances.put({
    rootSessionId: parseRootSessionId(ROOT_SID),
    instanceId: WORKER_ID,
    templateId: parseTemplateId('worker'),
    label: 'a3p5 splice worker',
    childSessionId: parseChildSessionId('session-child-a3p5worker'),
    lifecycle: options.memberLifecycle ?? 'SETTLED',
    createdAt: NOW,
    activityVersion: 1,
  })
  const overlayStore = await openPermissionOverlayStore(new FileStorageSeam(base))
  const overlay = createPermissionOverlayRepositoryPort({ repository: overlayStore.repository })

  const config: TeamPluginConfig = {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: `${base}/workspace`,
    seedMembers: [],
    staticModel: { provider: 'a3p5-splice', model: 'a3p5-model' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const teamToolsRef = { current: undefined }

  const landmine = makeLandmineAgent(options.agentStatus ?? 'running')
  const agent = landmine.agent
  let closing = receipt === 'closing'
  // The receipt point is the EXACT glue contract (`closing` + `liveHandle`
  // over the pair, handle carries the live agent) — the boundary double
  // for the real glue, which owns the same two reads over its own maps.
  const permissionNoticeReceipt =
    receipt === 'absent'
      ? undefined
      : Object.freeze({
          closing: (): boolean => closing,
          liveHandle: (identity: { teamSessionId: string; memberInstanceId: string }) =>
            identity.teamSessionId === ROOT_SID && identity.memberInstanceId === WORKER_ID
              ? Object.freeze({ ...identity, agent })
              : undefined,
        })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub glue surface (the P8-S5A double), untyped by design
  const stub: any = createStubBindings({ config, teamToolsRef, domain })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the live facade is widened with the receipt seam under test
  const live: any =
    permissionNoticeReceipt === undefined ? stub : { ...stub, permissionNoticeReceipt }

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
    inbox: landmine.inbox,
    touched: landmine.touched,
    setAgentStatus(status) {
      landmine.setStatus(status)
    },
    setClosing(value) {
      closing = value
    },
    async grant(mutationId, resource) {
      const result = await plane.mutation.grantInstance({
        authority: { kind: 'operator' },
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        mutationId,
        reason: 'a3p5 splice integration grant',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the closed carrier shape is asserted by the lane spec
        rules: [exactRule('write', resource, 'allow')] as any,
      })
      return result.changed === true
        ? { changed: true as const }
        : { changed: false as const, reason: result.reason }
    },
    async restore(mutationId, resource) {
      const result = await plane.mutation.restore({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        ...(resource === undefined
          ? {}
          : {
              ruleChange: {
                kind: 'grant_instance' as const,
                mutationId,
                reason: 'a3p5 restore rule change',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- closed carrier shape (lane spec pins)
                rules: [exactRule('write', resource, 'allow')] as any,
                authority: { kind: 'operator' as const },
              },
            }),
      })
      return result as unknown as Record<string, unknown>
    },
    async lifecycleRestore() {
      const result = await root.lifecycle.service.restoreMember({
        rootSessionId: ROOT_SID,
        instanceId: WORKER_ID,
      })
      return result as unknown as Record<string, unknown>
    },
    async settle() {
      // The dispatch is fire-and-forget (detached at the emission point):
      // give it a generous wall-clock drain so a NEGATIVE expectation
      // (zero notices) is a settled fact, not a too-early sample.
      for (let i = 0; i < 25; i += 1) {
        await new Promise((done) => setTimeout(done, 8))
      }
    },
    async close() {
      await overlayStore.close()
      destroyDir(base)
    },
  }
}

/** The durable overlay history for the worker identity (raw snapshots). */
async function overlayDump(world: SpliceWorld): Promise<readonly { metadata: { generation: number } }[]> {
  return (await world.overlay.history({ teamSessionId: ROOT_SID, memberInstanceId: WORKER_ID })) as unknown as readonly { metadata: { generation: number } }[]
}

describe('splice leg 1 — a committed grant delivers EXACTLY ONE inject through the real root wiring', () => {
  it('the running target receives one inject-only notice with the plugin producer source', async () => {
    const world = await openSpliceWorld()
    try {
      const result = await world.grant('mut-a3p5-1', `${world.insideDir}/a.ts`)
      expect(result).toEqual({ changed: true })
      await world.settle()
      expect(world.inbox).toHaveLength(1)
      const message = world.inbox[0] as {
        role: string
        source: { kind: string }
        content: readonly { type: string; text?: string }[]
      }
      // The carrier is the upstream user-message SHAPE (durable inbox
      // semantics AS-IS) — but the PRODUCER is plugin-owned, NEVER human
      // (upstream wake-budget refills on user-sourced claims; the
      // packages/jobs/tool-jobs wake-budget consumer cites in the binding
      // spec): kind 'user' must never appear.
      expect(message.role).toBe('user')
      expect(message.source.kind).toBe('plugin:dsh-agent-team')
      expect(message.source.kind).not.toBe('user')
      const text = message.content.map((part) => part.text ?? '').join('')
      expect(text).toContain('[team-perm-changed')
      expect(text).toContain(ROOT_SID)
      expect(text).toContain(WORKER_ID)
      // The rendered reason mirrors the durable bound, awareness-only text.
      expect(text.length).toBeLessThanOrEqual(2000)
      // Landmine: the binding touched NOTHING beyond status + inject.
      expect(world.touched).toEqual([])
      // Commit unchanged by emission: exactly one durable row.
      const history = await world.overlay.history({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
      })
      expect(history).toHaveLength(1)
    } finally {
      await world.close()
    }
  })
})

describe('splice leg 2 — a no-change mutation emits NOTHING', () => {
  it('changed:false commits no row and notifies nobody', async () => {
    const world = await openSpliceWorld()
    try {
      expect(await world.grant('mut-a3p5-2a', `${world.insideDir}/b.ts`)).toEqual({ changed: true })
      await world.settle()
      expect(world.inbox).toHaveLength(1)
      const again = await world.grant('mut-a3p5-2b', `${world.insideDir}/b.ts`)
      await world.settle()
      expect(again.changed).toBe(false)
      expect(again.reason).toBe('no-change')
      expect(world.inbox).toHaveLength(1)
    } finally {
      await world.close()
    }
  })
})

describe('splice leg 3 — an idle target receives NOTHING and is never woken', () => {
  it('status idle at receipt drops the notice before inject; the commit stands', async () => {
    const world = await openSpliceWorld({ agentStatus: 'idle' })
    try {
      expect(await world.grant('mut-a3p5-3', `${world.insideDir}/c.ts`)).toEqual({ changed: true })
      await world.settle()
      expect(world.inbox).toHaveLength(0)
      expect(world.touched).toEqual([])
      const latest = await world.overlay.latest({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
      })
      expect(latest?.metadata.generation).toBe(1)
    } finally {
      await world.close()
    }
  })
})

describe('splice leg 4 — a closing receipt drops the notice, the commit stands', () => {
  it('closing true gates the delivery; durable state is untouched', async () => {
    const world = await openSpliceWorld({ receipt: 'closing' })
    try {
      expect(await world.grant('mut-a3p5-4', `${world.insideDir}/d.ts`)).toEqual({ changed: true })
      await world.settle()
      expect(world.inbox).toHaveLength(0)
      const latest = await world.overlay.latest({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
      })
      expect(latest?.metadata.generation).toBe(1)
    } finally {
      world.setClosing(false)
      await world.close()
    }
  })
})

describe('splice leg 5 — no receipt seam: zero delivery, byte-identical durable commit', () => {
  it('the emitter is fail-closed absent the seam and cannot alter the durable outcome', async () => {
    const wired = await openSpliceWorld()
    const unwired = await openSpliceWorld({ receipt: 'absent' })
    try {
      const sameRules = [exactRule('write', '/fixed/a3p5-e.ts', 'allow')]
      // Identical inputs through both roots (same fixed NOW, same
      // mutationId): the durable commits must match ROW FOR ROW.
      const wiredResult = await wired.plane.mutation.grantInstance({
        authority: { kind: 'operator' },
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        mutationId: 'mut-a3p5-5-fixed',
        reason: 'a3p5 splice integration grant'.slice(0, PERMISSION_OVERLAY_MAX_REASON_LENGTH),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- closed carrier shape, see other legs
        rules: sameRules as any,
      })
      const unwiredResult = await unwired.plane.mutation.grantInstance({
        authority: { kind: 'operator' },
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        mutationId: 'mut-a3p5-5-fixed',
        reason: 'a3p5 splice integration grant'.slice(0, PERMISSION_OVERLAY_MAX_REASON_LENGTH),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- closed carrier shape, see other legs
        rules: sameRules as any,
      })
      await wired.settle()
      expect(wired.inbox).toHaveLength(1)
      expect(unwired.inbox).toHaveLength(0)
      expect(unwiredResult).toEqual(wiredResult)
      const wiredHistory = await wired.overlay.history({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
      })
      const unwiredHistory = await unwired.overlay.history({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
      })
      // Deep-equal proves the emission changed NOTHING durable (same NOW
      // stamp, same mutationId => byte-comparable rows).
      expect(unwiredHistory).toEqual(wiredHistory)
    } finally {
      await wired.close()
      await unwired.close()
    }
  })
})

describe('splice leg 5b — RESTORE regression: a pure restore emits ZERO, a genuine rule change at restore commits EXACTLY ONE new snapshot', () => {
  it('a pure lifecycle restore commits the lifecycle row only: zero overlay writes, zero emissions', async () => {
    const world = await openSpliceWorld({ memberLifecycle: 'ARCHIVED' })
    try {
      // Grant during ARCHIVED is LEGAL (tri-state) — one snapshot exists
      // and the emission point fires once, but the ARCHIVED lifecycle gate
      // drops DELIVERY (leg semantics owned by leg 3; inbox stays empty).
      expect((await world.grant('mut-a3p5-pure-a', `${world.insideDir}/r1.ts`)).changed).toBe(true)
      await world.settle()
      expect(world.inbox).toHaveLength(0)
      const dumpBefore = await overlayDump(world)
      expect(dumpBefore.length).toBe(1)
      // PURE restore (the EXISTING lifecycle path, no overlay contact).
      const restored = await world.lifecycleRestore()
      expect(String((restored as { lifecycle?: string }).lifecycle ?? JSON.stringify(restored))).toContain('SETTLED')
      await world.settle()
      expect(world.inbox, 'a pure restore never touches the emission point').toHaveLength(0)
      const dumpAfter = await overlayDump(world)
      expect(JSON.stringify(dumpAfter)).toBe(JSON.stringify(dumpBefore))
      expect(dumpAfter.length).toBe(1)
    } finally {
      await world.close()
    }
  })

  it('restore with a genuine rule change commits exactly one new snapshot through the decorated mutatePermission', async () => {
    // The agent stays IDLE: the delivery gate drops (leg 3 owns delivery),
    // so this leg isolates what it measures — the rule-change restore
    // commits EXACTLY ONE snapshot THROUGH the decorated mutatePermission
    // (the single completion point), never bypassing it, never writing two.
    const world = await openSpliceWorld({ agentStatus: 'idle', memberLifecycle: 'ARCHIVED' })
    try {
      const result = await world.restore('mut-a3p5-restore-change', `${world.insideDir}/r2.ts`)
      void result
      await world.settle()
      expect(world.inbox, 'idle target: delivery drops')
        .toHaveLength(0)
      const dump = await overlayDump(world)
      expect(dump.length, 'exactly one new snapshot — the rule change rides the ONE path').toBe(1)
      expect(dump[0]?.metadata.generation).toBe(1)
      expect(JSON.stringify(dump), 'the committed rule is the restore rule change').toContain('r2.ts')
    } finally {
      await world.close()
    }
  })
})

describe('splice leg 6 — source pins: the real glue receipt block is read-only; root has ONE emission site', () => {
  const glueSource = readFileSync(
    join(RUNTIME_ROOT, 'src', 'plugin', 'live', 'agent-bindings.mjs'),
    'utf8',
  )
  const rootSource = readFileSync(join(RUNTIME_ROOT, 'src', 'plugin', 'root.ts'), 'utf8')

  it('the glue exposes permissionNoticeReceipt exactly once, over pure reads', () => {
    const starts = glueSource.match(/permissionNoticeReceipt: Object\.freeze\(\{/g) ?? []
    expect(starts).toHaveLength(1)
    const blockStart = glueSource.indexOf('permissionNoticeReceipt: Object.freeze({')
    const block = glueSource.slice(blockStart, glueSource.indexOf('\n    }),', blockStart))
    expect(block.length).toBeGreaterThan(0)
    // The two facts, and the identity/ownership law is the glue OWN
    // durable lookup (ROOT BLOCK-2 fix): the exact pair's durable
    // MemberInstance row supplies the liveAgents key the registrant used
    // (boot seeds + restore both key by that durable value) — NEVER a
    // re-derivation — and the returned identity is derived FROM the
    // durable reverse mapping, never echoed from the request.
    expect(block).toContain('closing === true')
    expect(block).toContain('memberInstances.list(teamSessionId)')
    expect(block).toContain('liveAgents.get(key)')
    expect(block).toContain('String(ownerRow.instanceId)')
    // BLOCK-2 FIX LAW: the derived-id path is gone (a re-derivation would
    // miss legitimately non-derived boot/restored members AND echo the
    // request — both were the bug).
    expect(block.includes('childSessionIdFor'), 'receipt must never re-derive a child id').toBe(false)
    // ZERO wake/capacity members: nothing here can create, resume, adopt
    // or send to an Agent (the ensureLiveAgent exclusion is the leg that
    // keeps awareness from ever waking a cold member).
    for (const forbidden of ['ensureLiveAgent', 'inject', 'send(', 'wake', 'resume', 'status']) {
      expect(block.includes(forbidden), `receipt block must not reference ${forbidden}`).toBe(false)
    }
  })

  it('root.ts carries exactly one emission site, ordered BEFORE every governance consumer', () => {
    expect(rootSource.match(/permissionNoticeEmitter\(result\.snapshot\)/g) ?? []).toHaveLength(1)
    expect(rootSource.match(/detachPermissionNotice\(/g) ?? []).toHaveLength(1)
    const decoration = rootSource.indexOf('mutation.governance = Object.freeze({')
    const planeAssembly = rootSource.indexOf('createTeamPermissionLanes({')
    const remoteEntry = rootSource.indexOf('mutatePermission: permissionLaneMutate')
    expect(decoration).toBeGreaterThan(-1)
    // The decorated view is installed BEFORE the plane (and therefore
    // before the remote/tools entries that read it through the plane and
    // the mutation object): exactly ONE completion point exists.
    expect(decoration).toBeLessThan(planeAssembly)
    expect(decoration).toBeLessThan(remoteEntry)
  })
})
