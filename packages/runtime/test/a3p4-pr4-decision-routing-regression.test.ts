/**
 * a3p4-pr4-decision-routing-regression — the PR4 round-3 regression spec for
 * the pre-execute DECISION ROUTING (parent brief regressions (ii) and (iii),
 * plus MINOR-1 and INFO-3 and the refused-class pins).
 *
 * Every leg drives the REAL `installParameterPermissionListener` (the frozen
 * A5 adapter) with the REAL PR4 decision lane behind the EXACT closure shape
 * the live glue installs (the P6 precedent), over a real durable world (real
 * TeamDomain, real `permission_overlays` store, the root's OWN governance
 * authority and control service). Pure-lane assertions do NOT count for the
 * blocks — these legs count the ROUTING the adapter performs on top of the
 * merged answer.
 *
 * Pinned here:
 *
 *  R2  (BLOCK-2) an overlay ASK over a static deny enters APPROVAL through the
 *      real adapter — a durable control row appears and the exec waits — for
 *      the exact, subtree and exec classes (member install: `leader-approval`
 *      routing; the adapter denies outright on the unfixed build, which is the
 *      approval-bypass defect). The exact leg completes the approval: a human
 *      allow runs the tool through the guard path.
 *  R3+ (BLOCK-3) a MERGED DEFAULT deny still flows the artifact-grant floor
 *      (no overlay + template default deny + valid spill grant ⇒ EXECUTES —
 *      the strict-read/core-spill positive); an EXPLICIT overlay RULE deny
 *      keeps blocking with a valid grant present (negative); an overlay ASK +
 *      valid grant authorizes WITHOUT a control row (the frozen lane,
 *      non-regression).
 *  M1  (MINOR-1) the exec (fingerprint) plane reports the WINNING LAYER
 *      honestly: a blueprint-lane answer is reported `'blueprint'` (the
 *      unfixed map hard-codes `'template'`), a template answer `'template'`,
 *      the overlay `'overlay'`, a default fallback `null` — the same
 *      layer/default/provenance semantics as the file plane, with the kernel's
 *      `permissionEffectiveAnswer` as the only algebra.
 *  I3  (INFO-3) the seam receives THIS decision's freshly canonicalized rules
 *      VERBATIM (same identity, canonical keys — never a fabricated
 *      declared-none object); a source-text pin keeps the removed
 *      `canonicalRules ?? { allow: [], ask: [], deny: [] }` fallback out of
 *      the routing (UNKNOWN must never arrive as DECLARED-NONE).
 *  RC  (locked ruling) every refused seam answer is a typed HARD deny with
 *      the distinct refusal code preserved in the reason + a loud observation
 *      row — for a lifecycle refusal, an authority-read failure, and a
 *      context/fact refusal; NO static fallback anywhere (a static ALLOW does
 *      not rescue any refusal class).
 *
 * @module @dsh-agent-team/runtime/test/a3p4-pr4-decision-routing-regression
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, relative, sep, isAbsolute } from 'node:path'
import { mkdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import {
  createBlueprintSnapshotRef,
} from '../../contracts/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { openPermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import type { TeamPluginConfig } from '../src/plugin/types.js'
import type { CanonicalKeyContains, TeamPermissionPlane } from '../src/plugin/permission-plane.js'
import { installParameterPermissionListener } from '../operation-permission/pre-execute-adapter.js'
import { canonicalizeOperation } from '../operation-permission/canonical-operation.js'
import type { CanonicalOperation } from '../operation-permission/types.js'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import type { CanonicalRules } from '../operation-permission/permission-resolver.js'
import { PERMISSION_LIFECYCLE_ERROR_CODES } from '../permission-lifecycle/types.js'
import type { EffectivePermissionStaticLayer as EffectivePermissionStaticLayerFacts } from '../effective-policy/permission-assembler.js'
import { LIFECYCLE_OPERATIONS } from '../../domain/lifecycle/src/index.js'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT_SID = 'session-a3p4r3root'
const NOW = '2026-10-06T12:00:00.000Z'
const WORKER_ID = parseInstanceId('inst-a3p4r3worker')
const HUMAN = { kind: 'human', humanId: 'a3p4r3-operator' } as const

const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: A3P4R3-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the A3P4R3 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the A3P4R3 work.',
  'teamEnvelope:',
  '  allow:',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '  deny: []',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - request-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The A3P4R3 default state.',
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

/** The static template lane of the routing world: everything statically
 *  defaults to DENY (the ask-over-deny and floor legs need a static world
 *  that refuses by default). */
const STATIC_DENY_ALL: EffectiveStaticLayer = {
  label: 'worker',
  default: 'deny',
  rules: { allow: [], ask: [], deny: [] },
}
type EffectiveStaticLayer = {
  label: string
  default: 'deny'
  rules: { allow: []; ask: []; deny: [] }
}

function fileOperation(tool: string, key: string): CanonicalOperation {
  return {
    tool: tool as CanonicalOperation['tool'],
    resource: { kind: 'file', key, display: key },
    fingerprint: `sha256:${'f'.repeat(64)}`,
  }
}

function execOperation(fingerprint: string): CanonicalOperation {
  return {
    tool: 'bash',
    resource: { kind: 'tool', key: 'bash', display: 'bash' },
    fingerprint,
  }
}

function makeContainKeys(): CanonicalKeyContains {
  return (parentKey, childKey) => {
    const rel = relative(resolve(parentKey), resolve(childKey))
    return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  }
}

interface RoutingWorld {
  readonly plane: TeamPermissionPlane
  readonly overlay: PermissionOverlayRepositoryPort
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the real TeamDomain facade
  readonly domain: any
  readonly scratch: string
  readonly insideDir: string
  readonly outsideFile: string
  readonly containKeys: CanonicalKeyContains
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wide production facade, asserted on a subset
  readonly root: any
  grant(rules: readonly unknown[]): Promise<void>
  close(): Promise<void>
}

async function openRoutingWorld(): Promise<RoutingWorld> {
  const base = scratchDir(`a3p4r3-${Math.random().toString(36).slice(2, 8)}`)
  destroyDir(base)
  const insideDir = `${base}/workspace/src`
  mkdirSync(`${insideDir}/nested`, { recursive: true })
  mkdirSync(`${base}/elsewhere`, { recursive: true })
  const outsideFile = `${base}/elsewhere/c.ts`

  const seam = new FileStorageSeam(base)
  const domain = await createTeamDomain(seam)
  // The durable TeamSession (the control service and the leader authority
  // both address it — the real host row always carries one).
  // The REAL bound snapshot of this world's blueprint source (the control
  // service's admission resolves the bound blueprint from the root's own
  // catalog — the row ref must carry the PARSED identity: id + revision +
  // content hash, or the durable approval path refuses BLUEPRINT_HASH_MISMATCH).
  const parsedBp = parseBlueprint(BLUEPRINT_SOURCE)
  await domain.repositories.teamSessions.put({
    rootSessionId: parseRootSessionId(ROOT_SID),
    blueprint: createBlueprintSnapshotRef({
      blueprintId: parsedBp.blueprintId,
      revision: parsedBp.revision,
      contentHash: parsedBp.contentHash,
    }),
    defaultWorkspace: `${base}/workspace`,
    createdAt: NOW,
    generation: 1,
  })
  // The team-root session binding (TeamRuntime admission step 1: a TeamSession
  // WITHOUT its binding is not an actionable team — the durable approval row
  // writes run through this admission, exactly like the production host row).
  await domain.repositories.sessionBindings.put({
    kind: 'team-root',
    schemaVersion: 1,
    sessionId: ROOT_SID,
  })
  await domain.repositories.memberInstances.put({
    rootSessionId: parseRootSessionId(ROOT_SID),
    instanceId: WORKER_ID,
    templateId: parseTemplateId('worker'),
    label: 'a3p4r3 worker',
    childSessionId: parseChildSessionId('session-child-a3p4r3worker'),
    lifecycle: 'SETTLED',
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
    staticModel: { provider: 'a3p4r3', model: 'a3p4r3-model' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const teamToolsRef = { current: undefined }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub glue surface (the P8-S5A double)
  const live: any = createStubBindings({ config, teamToolsRef, domain })
  const permissionPlaneRef: { current: TeamPermissionPlane | undefined } = { current: undefined }
  const containKeys = makeContainKeys()

  const root = createTeamProductionRoot({
    config,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the stub-glue world hands the root the real TeamDomain
    domain: domain as any,
    storageSeam: seam,
    live,
    now: () => NOW,
    teamToolsRef,
    controlServiceRef: { current: undefined },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unused legacy reader
    legacyInspect: (() => {
      throw new Error('a3p4r3 world: legacy inspect is unused')
    }) as any,
    permissionOverlay: overlay,
    fsContainsKeys: containKeys,
    permissionPlaneRef,
  })

  const plane = permissionPlaneRef.current
  if (plane === undefined) throw new Error('the production root did not fill the permission plane reference')

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see RoutingWorld.root
    root,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the real TeamDomain facade
    domain,
    plane,
    overlay,
    scratch: base,
    insideDir,
    outsideFile,
    containKeys,
    async grant(rules) {
      const result = await plane.mutation.grantInstance({
        authority: { kind: 'operator' },
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        mutationId: `mut-${Math.random().toString(36).slice(2, 10)}`,
        reason: 'a3p4r3 routing world grant',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- carrier shape varies per leg
        rules: rules as any,
      })
      if (result.changed !== true) {
        throw new Error(`the routing-world grant must commit (reason: ${result.reason})`)
      }
    },
    async close() {
      await overlayStore.close().catch(() => undefined)
      await domain.close()
      destroyDir(base)
    },
  }
}

/** The EXACT closure shape the live glue installs (agent-bindings.mjs),
 *  driving the production decision lane. Passes `source` through — the
 *  round-3 merged-routing contract (the decision outcome always carried it;
 *  the seam type gained it so the adapter can route on it). */
function glueShapeSeam(
  world: RoutingWorld,
  instanceId: string,
  observations: Array<Record<string, unknown>> = [],
) {
  return async (input: {
    operation: CanonicalOperation
    staticRules: CanonicalRules | undefined
    staticDefault: 'ask' | 'deny'
  }) => {
    const outcome = (await world.plane.decisions.decide({
      teamSessionId: ROOT_SID,
      memberInstanceId: instanceId,
      operation: input.operation,
      ...(input.staticRules === undefined
        ? {}
        : {
            staticFacts: {
              template: {
                label: 'worker',
                default: input.staticDefault,
                rules: input.staticRules,
              },
            },
          }),
      containment: (rootKey: string, target: { key: string }) =>
        world.containKeys(rootKey, target.key),
    })) as Record<string, unknown>
    observations.push({ seamOutcome: outcome })
    if (outcome['kind'] === 'refused') {
      return { refused: true, code: String(outcome['code']), reason: String(outcome['reason']) }
    }
    return {
      effect: outcome['effect'],
      plane: outcome['plane'],
      winningLayer: outcome['winningLayer'],
      overlayGeneration: outcome['overlayGeneration'],
      explanation: outcome['explanation'],
      source: outcome['source'],
    } as never
  }
}

interface InstallHandle {
  disposer: () => void
  run: (
    name: string,
    args: unknown,
    opts?: { signal?: AbortSignal },
  ) => Promise<{ kind: string; reason?: string }>
  nextCalls: () => number
}

/** Install the REAL adapter the way the glue does (member install) and hand
 *  back a driver for the registered listener. */
function installRealAdapter(
  world: RoutingWorld,
  policy: TemplatePermissionPolicy,
  options: {
    resolveDynamicDecision?: (input: never) => Promise<unknown>
    authorizeArtifactRead?: (args: {
      instanceId: string
      rawPath: string
      canonicalResourceKey: string
      targetHandle: unknown
    }) => Promise<boolean>
    instanceId?: string
  } = {},
): InstallHandle {
  const listeners: Array<
    (exec: Record<string, unknown>, next: () => Promise<unknown>) => Promise<unknown>
  > = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake agent ctx (A5 spec family)
  const ctx: any = {
    on: (_event: string, listener: (exec: Record<string, unknown>, next: () => Promise<unknown>) => Promise<unknown>) => {
      listeners.push(listener)
      return () => undefined
    },
    tools: { guard: () => () => undefined },
  }
  let nextCalls = 0
  const disposer = installParameterPermissionListener(ctx, {
    policy,
    resolveTarget: async (path: string) => ({ key: path, display: path, handle: { targetKey: path } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the root's own control authority
    controlService: world.root.control as any,
    rootSessionId: ROOT_SID,
    caller: { kind: 'instance', instanceId: options.instanceId ?? WORKER_ID },
    targetInstanceId: options.instanceId ?? WORKER_ID,
    isLeader: false,
    ...(options.resolveDynamicDecision === undefined
      ? {}
      : { resolveDynamicDecision: options.resolveDynamicDecision as never }),
    ...(options.authorizeArtifactRead === undefined
      ? {}
      : { authorizeArtifactRead: options.authorizeArtifactRead as never }),
  })
  const run = async (
    name: string,
    args: unknown,
    opts: { signal?: AbortSignal } = {},
  ): Promise<{ kind: string; reason?: string }> => {
    const listener = listeners[0]
    if (listener === undefined) throw new Error('no pre-execute listener installed')
    nextCalls = 0
    return (await listener(
      {
        callId: `a3p4r3-${Math.random().toString(36).slice(2, 8)}`,
        name,
        arguments: args,
        signal: opts.signal ?? new AbortController().signal,
      },
      async () => {
        nextCalls += 1
        return { kind: 'allow' }
      },
    )) as { kind: string; reason?: string }
  }
  return { disposer, run, nextCalls: () => nextCalls }
}

describe('R2 — an overlay ASK over a static deny enters APPROVAL through the real adapter (BLOCK-2)', () => {
  it('exact: the member install creates the durable approval row (leader-approval), waits, and a human allow executes', async () => {
    const world = await openRoutingWorld()
    const seamObs: Array<Record<string, unknown>> = []
    try {
      const key = `${world.insideDir}/a.ts`
      const policy: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }
      await world.grant([
        { operationClass: 'write', matcher: { kind: 'exact', resource: key }, effect: 'ask' },
      ])
      const install = installRealAdapter(world, policy, {
        resolveDynamicDecision: glueShapeSeam(world, WORKER_ID, seamObs) as (input: never) => Promise<unknown>,
      })
      const controller = new AbortController()
      const pending = install.run('write', { file_path: key, content: 'x' }, { signal: controller.signal })

      // The approval request must exist as a durable pending row (the
      // unfixed build denies outright and never creates it).
      let requests: ReadonlyArray<{ status: string; kind: string; toolName?: string }> = []
      for (let i = 0; i < 50; i += 1) {
        const state = await world.root.control.listControlState(ROOT_SID)
        requests = state.requests as typeof requests
        if (requests.length > 0) break
        await new Promise((done) => setTimeout(done, 10))
      }
      expect(requests.length, 'the ask-over-static-deny must create a durable control row').toBeGreaterThan(0)
      expect(requests[0]?.kind).toBe('leader-approval')
      expect(requests[0]?.status).toBe('pending')
      const requestId = (requests[0] as unknown as { requestId: string }).requestId

      // The human allows: the approval completes and the tool executes.
      await world.root.control.resolveControl({
        rootSessionId: ROOT_SID,
        caller: HUMAN,
        requestId,
        decision: 'allow',
      })
      const result = await pending
      expect(result.kind).toBe('allow')
      expect(install.nextCalls()).toBe(1)
      install.disposer()
    } finally {
      await world.close()
    }
  })

  it('subtree: an overlay ASK subtree rule over the static default deny reaches approval (containment judged per decision)', async () => {
    const world = await openRoutingWorld()
    try {
      const policy: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }
      await world.grant([
        { operationClass: 'read', matcher: { kind: 'subtree', resource: world.insideDir }, effect: 'ask' },
      ])
      const install = installRealAdapter(world, policy, {
        resolveDynamicDecision: glueShapeSeam(world, WORKER_ID) as (input: never) => Promise<unknown>,
      })
      const controller = new AbortController()
      const pending = install.run(
        'read',
        { file_path: `${world.insideDir}/nested/b.ts` },
        { signal: controller.signal },
      )
      let rows: ReadonlyArray<{ status: string }> = []
      for (let i = 0; i < 50; i += 1) {
        const state = await world.root.control.listControlState(ROOT_SID)
        rows = state.requests as typeof rows
        if (rows.length > 0) break
        await new Promise((done) => setTimeout(done, 10))
      }
      expect(rows.length, 'the subtree ask must create a durable control row').toBeGreaterThan(0)
      controller.abort()
      const result = await pending
      expect(result.kind).toBe('deny')
      expect(String(result.reason)).toContain('cancelled')
      install.disposer()
    } finally {
      await world.close()
    }
  })

  it('exec: an overlay ASK on the EXACT canonical fingerprint of THIS command reaches approval on the member install (leader-approval)', async () => {
    const world = await openRoutingWorld()
    try {
      const policy: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }
      // The fingerprint the adapter WILL compute for this exact payload —
      // canonicalized by the SAME frozen canonicalizer, so the overlay ask
      // rule addresses the operation for real (exec is EXACT fingerprint only).
      const op = await canonicalizeOperation({
        name: 'bash',
        arguments: { command: 'echo a3p4r3-ask' },
        resolveTarget: async (p: string) => ({ key: p, display: p, handle: { targetKey: p } }),
      })
      await world.grant([
        { operationClass: 'bash', matcher: { kind: 'fingerprint', resource: op.fingerprint }, effect: 'ask' },
      ])
      const install = installRealAdapter(world, policy, {
        resolveDynamicDecision: glueShapeSeam(world, WORKER_ID) as (input: never) => Promise<unknown>,
      })
      const controller = new AbortController()
      const pending = install.run('bash', { command: 'echo a3p4r3-ask' }, { signal: controller.signal })
      let rows: ReadonlyArray<{ status: string; kind: string; toolName?: string }> = []
      for (let i = 0; i < 50; i += 1) {
        const state = await world.root.control.listControlState(ROOT_SID)
        rows = state.requests as typeof rows
        if (rows.length > 0) break
        await new Promise((done) => setTimeout(done, 10))
      }
      expect(rows.length, 'the exec overlay ASK over the static deny must create a durable approval row').toBeGreaterThan(0)
      expect(rows[0]?.kind).toBe('leader-approval')
      expect(rows[0]?.toolName).toBe('bash')
      controller.abort()
      const result = await pending
      expect(result.kind).toBe('deny')
      expect(String(result.reason)).toContain('cancelled')
      install.disposer()
    } finally {
      await world.close()
    }
  })

  it('exec (merged ask): the adapter routes a seam-answered EXEC ASK to approval — one durable row, never an outright deny', async () => {
    const world = await openRoutingWorld()
    try {
      const policy: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }
      const install = installRealAdapter(world, policy, {
        resolveDynamicDecision: (async () => ({
          effect: 'ask',
          plane: 'exec',
          winningLayer: 'overlay',
          overlayGeneration: 1,
          explanation: 'exec fingerprint answered ask from the overlay (merged)',
          source: 'rule',
        })) as never,
      })
      const controller = new AbortController()
      const pending = install.run('bash', { command: 'echo merged-ask' }, { signal: controller.signal })
      let rows: ReadonlyArray<{ status: string; kind: string; toolName?: string }> = []
      for (let i = 0; i < 50; i += 1) {
        const state = await world.root.control.listControlState(ROOT_SID)
        rows = state.requests as typeof rows
        if (rows.length > 0) break
        await new Promise((done) => setTimeout(done, 10))
      }
      expect(rows.length, 'a merged exec ASK must create a durable approval row').toBeGreaterThan(0)
      expect(rows[0]?.kind).toBe('leader-approval')
      expect(rows[0]?.toolName).toBe('bash')
      controller.abort()
      const result = await pending
      expect(result.kind).toBe('deny')
      expect(String(result.reason)).toContain('cancelled')
      install.disposer()
    } finally {
      await world.close()
    }
  })
})

describe('R3 — the artifact-grant floor keeps its frozen position under the merged answer (BLOCK-3)', () => {
  it('POSITIVE: no overlay + template DEFAULT deny + valid spill grant ⇒ the read EXECUTES through the floor', async () => {
    const world = await openRoutingWorld()
    try {
      const key = world.outsideFile
      const policy: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }
      const install = installRealAdapter(world, policy, {
        resolveDynamicDecision: glueShapeSeam(world, WORKER_ID) as (input: never) => Promise<unknown>,
        authorizeArtifactRead: async () => true,
      })
      const result = await install.run('read', { file_path: key })
      expect(result.kind, 'the default-deny read with a valid grant must execute').toBe('allow')
      expect(install.nextCalls()).toBe(1)
      install.disposer()
    } finally {
      await world.close()
    }
  })

  it('NEGATIVE: an EXPLICIT overlay RULE deny + a valid grant still blocks (a grant is a floor, never a ceiling override)', async () => {
    const world = await openRoutingWorld()
    try {
      const key = world.outsideFile
      const policy: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }
      await world.grant([
        { operationClass: 'read', matcher: { kind: 'exact', resource: key }, effect: 'deny' },
      ])
      const install = installRealAdapter(world, policy, {
        resolveDynamicDecision: glueShapeSeam(world, WORKER_ID) as (input: never) => Promise<unknown>,
        authorizeArtifactRead: async () => true,
      })
      const result = await install.run('read', { file_path: key })
      expect(result.kind).toBe('deny')
      expect(install.nextCalls()).toBe(0)
      install.disposer()
    } finally {
      await world.close()
    }
  })

  it('NON-REGRESSION: an overlay ASK + valid grant authorizes the read WITHOUT any control row', async () => {
    const world = await openRoutingWorld()
    try {
      const key = world.outsideFile
      const policy: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }
      await world.grant([
        { operationClass: 'read', matcher: { kind: 'exact', resource: key }, effect: 'ask' },
      ])
      const install = installRealAdapter(world, policy, {
        resolveDynamicDecision: glueShapeSeam(world, WORKER_ID) as (input: never) => Promise<unknown>,
        authorizeArtifactRead: async () => true,
      })
      const result = await install.run('read', { file_path: key })
      expect(result.kind).toBe('allow')
      const state = await world.root.control.listControlState(ROOT_SID)
      expect(state.requests).toHaveLength(0)
      install.disposer()
    } finally {
      await world.close()
    }
  })
})

describe('M1 — the exec plane reports the winning layer honestly (MINOR-1)', () => {
  it('a blueprint-lane exec answer reports winningLayer "blueprint" (never a hard-coded "template"), a template answer "template", the overlay "overlay", the default fallback null', async () => {
    const world = await openRoutingWorld()
    try {
      const grantedFp = `sha256:${'1'.repeat(64)}`
      const blueprintLayer: EffectivePermissionStaticLayerFacts = {
        label: 'blueprint',
        default: 'deny',
        rules: {
          allow: [{ tool: 'bash', resource: { kind: 'any' } }],
          ask: [],
          deny: [],
        },
      }
      // (a) blueprint answers (the template carries no bash rule): the
      //     unfixed map mislabels this 'template'.
      const fromBlueprint = (await world.plane.decisions.decide({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        operation: execOperation(grantedFp),
        staticFacts: { blueprint: blueprintLayer, template: STATIC_DENY_ALL },
      })) as { kind: string; effect: string; winningLayer: string | null; source: string }
      expect(fromBlueprint.kind).toBe('effective')
      expect(fromBlueprint.effect).toBe('allow')
      expect(fromBlueprint.source).toBe('rule')
      expect(fromBlueprint.winningLayer).toBe('blueprint')

      // (b) the template wins when its own lane answers.
      const templateLayer: EffectivePermissionStaticLayerFacts = {
        label: 'worker',
        default: 'deny',
        rules: {
          allow: [{ tool: 'bash', resource: { kind: 'any' } }],
          ask: [],
          deny: [],
        },
      }
      const fromTemplate = (await world.plane.decisions.decide({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        operation: execOperation(grantedFp),
        staticFacts: { blueprint: STATIC_DENY_ALL as never, template: templateLayer },
      })) as { kind: string; winningLayer: string | null }
      expect(fromTemplate.winningLayer).toBe('template')

      // (c) the overlay wins over both static lanes.
      await world.grant([
        { operationClass: 'bash', matcher: { kind: 'fingerprint', resource: grantedFp }, effect: 'allow' },
      ])
      const fromOverlay = (await world.plane.decisions.decide({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        operation: execOperation(grantedFp),
        staticFacts: { blueprint: blueprintLayer, template: STATIC_DENY_ALL },
      })) as { kind: string; winningLayer: string | null }
      expect(fromOverlay.winningLayer).toBe('overlay')

      // (d) no lane answers: the DEFAULT fallback names no layer.
      const fallback = (await world.plane.decisions.decide({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        operation: execOperation(`sha256:${'2'.repeat(64)}`),
        staticFacts: { template: STATIC_DENY_ALL },
      })) as { kind: string; effect: string; winningLayer: string | null; source: string }
      expect(fallback.kind).toBe('effective')
      expect(fallback.effect).toBe('deny')
      expect(fallback.source).toBe('default')
      expect(fallback.winningLayer).toBeNull()
    } finally {
      await world.close()
    }
  })
})

describe('I3 — the seam receives this decision\'s canonical rules verbatim (INFO-3)', () => {
  it('the seam input.staticRules carries the canonicalized allow rule (same identity), never a fabricated empty declared-none', async () => {
    const world = await openRoutingWorld()
    const seen: Array<{ rules: CanonicalRules | undefined }> = []
    try {
      const key = `${world.insideDir}/a.ts`
      const policy: TemplatePermissionPolicy = {
        default: 'deny',
        allow: [{ tool: 'write', resource: { kind: 'exact', path: key } }],
        ask: [],
        deny: [],
      }
      const install = installRealAdapter(world, policy, {
        resolveDynamicDecision: (async (input: {
          operation: CanonicalOperation
          staticRules: CanonicalRules | undefined
          staticDefault: 'ask' | 'deny'
        }) => {
          seen.push({ rules: input.staticRules })
          return undefined
        }) as never,
      })
      const result = await install.run('write', { file_path: key, content: 'x' })
      // Static allow stands (the seam abstains): the frozen pipeline path.
      expect(result.kind).toBe('allow')
      expect(seen).toHaveLength(1)
      const rules = seen[0]?.rules
      expect(rules, 'the seam must receive the canonical rules (undefined would be UNKNOWN, never a fabricated declared-none)').toBeDefined()
      const allowKeys = (rules?.allow ?? []).map((rule) =>
        rule.resource.kind === 'exact' ? rule.resource.key : '<other>',
      )
      expect(allowKeys).toContain(key)
      install.disposer()
    } finally {
      await world.close()
    }
  })

  it('source pin: the removed `canonicalRules ?? { allow: [], ask: [], deny: [] }` fallback does not survive into the routing', () => {
    const adapterSource = readFileSync(join(HERE, '..', 'operation-permission', 'pre-execute-adapter.ts'), 'utf8')
    expect(adapterSource).not.toMatch(/canonicalRules\s*\?\?\s*\{\s*allow:\s*\[\],\s*ask:\s*\[\],\s*deny:\s*\[\]\s*\}/)
    const glueSource = readFileSync(join(HERE, '..', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
    // The glue must not fabricate a declared-none template layer either.
    expect(glueSource).not.toMatch(/rules:\s*staticRules\s*\?\?\s*\{\s*allow:\s*\[\],\s*ask:\s*\[\],\s*deny:\s*\[\]\s*\}/)
  })
})

describe('RC — refused seam answers are typed hard denials for EVERY class, no static fallback (locked ruling)', () => {
  const staticAllowPolicy: TemplatePermissionPolicy = {
    default: 'deny',
    allow: [{ tool: 'write', resource: { kind: 'exact', path: 'anything' } }],
    ask: [],
    deny: [],
  }

  it('lifecycle class: an ARCHIVED instance is hard-denied with the code preserved, although the static lane ALLOWS', async () => {
    const world = await openRoutingWorld()
    try {
      // The durable lifecycle fact moves through the root's OWN commit port
      // (the CAS commit the lifecycle FSM itself drives; the full FSM paths
      // are pinned by the lane e2e spec — this world has no live agent to
      // quiesce, which is what the service's interrupt step requires).
      const row = world.domain.repositories.memberInstances.get(ROOT_SID, WORKER_ID)
      expect(row).toBeDefined()
      await world.root.lifecycle.commit.commitTransition({
        rootSessionId: ROOT_SID,
        instanceId: WORKER_ID,
        expectedActivityVersion: row.activityVersion,
        from: row.lifecycle,
        operation: LIFECYCLE_OPERATIONS.ARCHIVE,
        to: 'ARCHIVED',
      })
      const install = installRealAdapter(world, staticAllowPolicy, {
        resolveDynamicDecision: glueShapeSeam(world, WORKER_ID) as (input: never) => Promise<unknown>,
      })
      const result = await install.run('write', { file_path: 'anything', content: 'x' })
      expect(result.kind).toBe('deny')
      expect(String(result.reason)).toContain(PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_ARCHIVED)
      expect(install.nextCalls()).toBe(0)
      install.disposer()
    } finally {
      await world.close()
    }
  })

  it('authority-read class: a static ALLOW + a seam refusal (undecodable overlay) denies with the code and the loud observation row — no static fallback', async () => {
    const world = await openRoutingWorld()
    try {
      const install = installRealAdapter(world, staticAllowPolicy, {
        resolveDynamicDecision: (async () => ({
          refused: true,
          code: PERMISSION_LIFECYCLE_ERROR_CODES.OVERLAY_VIEW_UNDECODABLE,
          reason: 'overlay rule 0 carries a resource the carrier grammar cannot decode',
        })) as never,
      })
      const result = await install.run('write', { file_path: 'anything', content: 'x' })
      expect(result.kind).toBe('deny')
      expect(String(result.reason)).toContain(PERMISSION_LIFECYCLE_ERROR_CODES.OVERLAY_VIEW_UNDECODABLE)
      expect(install.nextCalls()).toBe(0)
      install.disposer()
    } finally {
      await world.close()
    }
  })

  it('context/fact class: a seam STATIC_FACTS_UNKNOWN refusal hard-denies the static allow (UNKNOWN never degrades to the static answer)', async () => {
    const world = await openRoutingWorld()
    try {
      const install = installRealAdapter(world, staticAllowPolicy, {
        resolveDynamicDecision: (async () => ({
          refused: true,
          code: PERMISSION_LIFECYCLE_ERROR_CODES.STATIC_FACTS_UNKNOWN,
          reason: 'the decision site supplied NO static permission facts',
        })) as never,
      })
      const result = await install.run('write', { file_path: 'anything', content: 'x' })
      expect(result.kind).toBe('deny')
      expect(String(result.reason)).toContain(PERMISSION_LIFECYCLE_ERROR_CODES.STATIC_FACTS_UNKNOWN)
      install.disposer()
    } finally {
      await world.close()
    }
  })
})
