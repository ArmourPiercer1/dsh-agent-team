/**
 * a3p4-production-permission-plane.test.ts — pre-alpha3 PR4: the shipped
 * production root ASSEMBLY POINT wires the permission lifecycle plane, and
 * the configured decision paths are REACHABLE AND FUNCTIONAL there.
 *
 * The lane spec (`a3p4-permission-lifecycle-e2e.test.ts`) pins what the lane
 * MEANS — grant / revoke / archive / dispose / restore / no inheritance over
 * the real durable store and the real lifecycle service. This spec pins the
 * thing a lane spec cannot: that the PRODUCTION ROOT (`createTeamProduction
 * Root`, the single assembly point the live plugin boots) really hands that
 * lane to the plugin, and that a normal configured world reaches a real
 * decision instead of a fail-closed stub. The PR's standing ruling is
 * explicit: the synchronous port shapes must never degrade production into an
 * always-`UNKNOWN` / `NOT_CONFIGURED` posture, so the configured EXACT,
 * SUBTREE (containment) and EXEC (fingerprint) paths are proven live here.
 *
 * Proven against the REAL production assembly — real TeamDomain over the
 * testkit file seam, the governance mutation service built INSIDE the root,
 * the durable `permission_overlays` store opened by the same helper the host
 * entry uses, the P8-S5A stub glue bundle as the live surface (no boot: the
 * plane is filled during construction):
 *
 *  P1 — the root FILLS the shared `permissionPlaneRef` (the `controlServiceRef
 *       ` precedent) with both planes, and its write entry appends through the
 *       ROOT's own governance authority; a root assembled without the overlay
 *       port has no plane at all and `mutatePermission` refuses
 *       `PERMISSION_MUTATION_NOT_CONFIGURED` (fail closed, zero write);
 *  P2 — a configured EXACT grant answers `allow` with the overlay as winning
 *       layer, and the row survives reopening the store (real durability);
 *  P3 — a configured SUBTREE grant is judged by the containment predicate the
 *       root was given (production injects the pinned public
 *       `FileSystem.contains`): a real descendant path answers `allow`, a real
 *       path outside the root stays on the static default;
 *  P4 — a configured EXEC grant answers its EXACT canonical fingerprint and no
 *       other (predicate-free);
 *  P5 — the durable lifecycle state of the REAL member row gates execution
 *       through the production reader: `ARCHIVED` refuses with the overlay
 *       retained, `SETTLED` executes, an unaddressable instance refuses;
 *  P6 — the EXISTING pre-execute pipeline CONSUMES the plane: an
 *       `installParameterPermissionListener` install fed by the production
 *       decision lane (exactly the closure shape the live glue passes) executes
 *       on a static allow, is DENIED when the overlay denies over that static
 *       allow, and is DENIED while the instance is archived; the same install
 *       WITHOUT the seam keeps the frozen pre-PR4 behavior.
 *
 * Offline and host-free: no DSH host, no port, no model, no network. The
 * containment predicate of this world is a test-owned provider double over
 * REAL directories created in the scratch dir; production injects the real
 * pinned provider — the assembly point cannot tell them apart, which is
 * exactly why the predicate is injected rather than derived from key text.
 *
 * @module @dsh-agent-team/runtime/test/a3p4-production-permission-plane
 */

import { describe, expect, it } from 'vitest'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { mkdirSync } from 'node:fs'
import {
  parseChildSessionId,
  parseInstanceId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import { parseRootSessionId } from '../../contracts/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { openPermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import type { TeamPluginConfig } from '../src/plugin/types.js'
import type { CanonicalKeyContains, TeamPermissionPlane } from '../src/plugin/permission-plane.js'
import { installParameterPermissionListener } from '../operation-permission/pre-execute-adapter.js'
import type { CanonicalOperation } from '../operation-permission/types.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import { LIFECYCLE_OPERATIONS } from '../../domain/lifecycle/src/index.js'
import type { CanonicalRules } from '../operation-permission/permission-resolver.js'
import { PERMISSION_MUTATION_ERROR_CODES } from '../governance/index.js'
import { PERMISSION_LIFECYCLE_ERROR_CODES } from '../permission-lifecycle/types.js'
import type { EffectivePermissionStaticLayer } from '../effective-policy/permission-assembler.js'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'

const ROOT_SID = 'session-root-a3p4prod'
const NOW = '2026-10-05T12:00:00.000Z'
const WORKER_ID = parseInstanceId('inst-a3p4worker')

const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: A3P4-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the A3P4 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the A3P4 work.',
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
  '    description: The A3P4 default state.',
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

/** The static template lane of this world: nothing is allowed statically. */
const STATIC_DENY_ALL: EffectivePermissionStaticLayer = {
  label: 'worker',
  default: 'deny',
  rules: { allow: [], ask: [], deny: [] },
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

interface ProductionWorld {
  readonly plane: TeamPermissionPlane
  readonly overlay: PermissionOverlayRepositoryPort
  readonly scratch: string
  readonly insideDir: string
  readonly outsideFile: string
  readonly containKeys: CanonicalKeyContains
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the production root surface is a wide facade; this spec asserts on a subset
  readonly root: any
  grant(rules: readonly unknown[]): Promise<void>
  decideFile(key: string, tool?: string): Promise<unknown>
  setLifecycle(lifecycle: 'SETTLED' | 'ARCHIVED'): Promise<void>
  reopenOverlay(): Promise<PermissionOverlayRepositoryPort>
  close(): Promise<void>
}

/** The containment double: the provider's whole-matcher relation over REAL
 *  directories (production injects the pinned public `FileSystem.contains`). */
function makeContainKeys(): CanonicalKeyContains {
  return (parentKey, childKey) => {
    const rel = relative(resolve(parentKey), resolve(childKey))
    return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  }
}

async function openProductionWorld(options: { wire?: boolean } = {}): Promise<ProductionWorld> {
  const base = scratchDir(`a3p4prod-${Math.random().toString(36).slice(2, 8)}`)
  destroyDir(base)
  const insideDir = `${base}/workspace/src`
  mkdirSync(`${insideDir}/nested`, { recursive: true })
  mkdirSync(`${base}/elsewhere`, { recursive: true })
  const outsideFile = `${base}/elsewhere/c.ts`

  const seam = new FileStorageSeam(base)
  const domain = await createTeamDomain(seam)
  await domain.repositories.memberInstances.put({
    rootSessionId: parseRootSessionId(ROOT_SID),
    instanceId: WORKER_ID,
    templateId: parseTemplateId('worker'),
    label: 'a3p4 production worker',
    childSessionId: parseChildSessionId('session-child-a3p4worker'),
    lifecycle: 'SETTLED',
    createdAt: NOW,
    activityVersion: 1,
  })

  // The same helper the host entry calls, over the same medium (its own
  // TeamDomain handle on the durable `permission_overlays` store).
  const overlayStore = await openPermissionOverlayStore(new FileStorageSeam(base))
  const overlay = createPermissionOverlayRepositoryPort({ repository: overlayStore.repository })

  const config: TeamPluginConfig = {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: `${base}/workspace`,
    seedMembers: [],
    staticModel: { provider: 'a3p4-prod', model: 'a3p4-model' },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the stub-glue world hands the root the real TeamDomain (structurally satisfied)
    domain: domain as any,
    storageSeam: seam,
    live,
    now: () => NOW,
    teamToolsRef,
    controlServiceRef: { current: undefined },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the A29 legacy reader is unused in this world
    legacyInspect: (() => {
      throw new Error('a3p4 production world: legacy inspect is unused')
    }) as any,
    ...(options.wire === false
      ? {}
      : { permissionOverlay: overlay, fsContainsKeys: makeContainKeys(), permissionPlaneRef }),
  })

  const plane = permissionPlaneRef.current
  const containKeys = makeContainKeys()
  const world: ProductionWorld = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see ProductionWorld.root
    root,
    plane: plane as TeamPermissionPlane,
    overlay,
    scratch: base,
    insideDir,
    outsideFile,
    containKeys,
    async grant(rules) {
      const result = await world.plane.mutation.grantInstance({
        authority: { kind: 'operator' },
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        mutationId: `mut-${Math.random().toString(36).slice(2, 10)}`,
        reason: 'a3p4 production plane leg',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the closed carrier shape is asserted by the lane spec; this spec varies it per leg
        rules: rules as any,
      })
      if (result.changed !== true) {
        throw new Error(`the production grant must commit (reason: ${result.reason})`)
      }
    },
    async decideFile(key, tool = 'write') {
      return world.plane.decisions.decide({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        operation: fileOperation(tool, key),
        staticFacts: { template: STATIC_DENY_ALL },
        containment: (rootKey, target) => containKeys(rootKey, target.key),
      })
    },
    async setLifecycle(lifecycle) {
      // The durable lifecycle fact moves through the root's OWN commit port
      // (the CAS commit the lifecycle FSM itself drives; the full FSM paths —
      // archive / restore / dispose and their typed refusals — are pinned by
      // `a3p4-permission-lifecycle-e2e.test.ts` against the real lifecycle
      // service; this world has no live agent to quiesce, which is exactly
      // what the service's interrupt step requires).
      const row = domain.repositories.memberInstances.get(ROOT_SID, WORKER_ID)
      if (row === undefined) throw new Error('the production world lost its member row')
      const from = row.lifecycle
      const to = lifecycle
      await root.lifecycle.commit.commitTransition({
        rootSessionId: ROOT_SID,
        instanceId: WORKER_ID,
        expectedActivityVersion: row.activityVersion,
        from,
        operation: to === 'ARCHIVED' ? LIFECYCLE_OPERATIONS.ARCHIVE : LIFECYCLE_OPERATIONS.RESTORE,
        to,
      })
    },
    async reopenOverlay() {
      const reopened = await openPermissionOverlayStore(new FileStorageSeam(base))
      return createPermissionOverlayRepositoryPort({ repository: reopened.repository })
    },
    async close() {
      await overlayStore.close().catch(() => undefined)
      await domain.close()
      destroyDir(base)
    },
  }
  if (plane === undefined && options.wire !== false) {
    throw new Error('the production root did not fill the permission plane reference')
  }
  return world
}

function exactRule(operationClass: string, resource: string, effect: 'allow' | 'deny'): unknown {
  return { operationClass, matcher: { kind: 'exact', resource }, effect }
}

describe('P1 — the production root wires the plane (and refuses without it)', () => {
  it('the assembled root fills the shared reference; its write entry lands in the root store', async () => {
    const world = await openProductionWorld()
    try {
      expect(Object.keys(world.plane).sort()).toEqual(['decisions', 'mutation'])
      expect(Object.keys(world.plane.mutation).sort()).toEqual(['grantInstance', 'restore', 'revoke'])
      expect(typeof world.plane.decisions.decide).toBe('function')

      await world.grant([exactRule('write', `${world.insideDir}/a.ts`, 'allow')])
      const latest = await world.overlay.latest({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
      })
      expect(latest?.metadata.generation).toBe(1)
      expect(latest?.state.rules[0]?.resource).toBe(`exact:${world.insideDir}/a.ts`)
      expect(latest?.provenance?.actor).toBe('human')
    } finally {
      await world.close()
    }
  })

  it('a root assembled WITHOUT the overlay port has no plane and refuses typed', async () => {
    const world = await openProductionWorld({ wire: false })
    try {
      expect(world.plane).toBeUndefined()
      const error = await world.root.mutation.governance
        .mutatePermission({
          authority: { kind: 'operator' },
          teamSessionId: ROOT_SID,
          memberInstanceId: WORKER_ID,
          kind: 'grant_instance',
          mutationId: 'mut-unwired',
          reason: 'no lane',
          rules: [exactRule('write', 'x', 'allow')],
        })
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      expect((error as { code?: string }).code).toBe(PERMISSION_MUTATION_ERROR_CODES.NOT_CONFIGURED)
      expect(
        await world.overlay.latest({ teamSessionId: ROOT_SID, memberInstanceId: WORKER_ID }),
      ).toBeUndefined()
    } finally {
      await world.close()
    }
  })
})

describe('P2 / P3 / P4 — the configured exact / subtree / exec paths are live', () => {
  it('an exact grant answers allow and survives a reopen of the durable store', async () => {
    const world = await openProductionWorld()
    try {
      const key = `${world.insideDir}/a.ts`
      await world.grant([exactRule('write', key, 'allow')])
      const decision = (await world.decideFile(key)) as {
        kind: string
        effect?: string
        winningLayer?: string | null
        overlayGeneration?: number | null
      }
      expect(decision.kind).toBe('effective')
      expect(decision.effect).toBe('allow')
      expect(decision.winningLayer).toBe('overlay')
      expect(decision.overlayGeneration).toBe(1)

      const reopened = await world.reopenOverlay()
      const after = await reopened.latest({ teamSessionId: ROOT_SID, memberInstanceId: WORKER_ID })
      expect(after?.metadata.generation).toBe(1)
      expect(after?.state.rules[0]?.resource).toBe(`exact:${key}`)
    } finally {
      await world.close()
    }
  })

  it('a subtree grant is judged by the injected predicate: inside allow, outside still default', async () => {
    const world = await openProductionWorld()
    try {
      await world.grant([
        { operationClass: 'read', matcher: { kind: 'subtree', resource: world.insideDir }, effect: 'allow' },
      ])
      const inside = (await world.decideFile(`${world.insideDir}/nested/b.ts`, 'read')) as {
        kind: string
        effect?: string
        winningLayer?: string | null
      }
      expect(inside.kind).toBe('effective')
      expect(inside.effect).toBe('allow')
      expect(inside.winningLayer).toBe('overlay')

      const outside = (await world.decideFile(world.outsideFile, 'read')) as {
        kind: string
        effect?: string
        source?: string
      }
      expect(outside.kind).toBe('effective')
      expect(outside.effect).toBe('deny')
      expect(outside.source).toBe('default')
    } finally {
      await world.close()
    }
  })

  it('an exec grant answers its exact fingerprint only (predicate-free)', async () => {
    const world = await openProductionWorld()
    try {
      const fingerprint = `sha256:${'a'.repeat(64)}`
      await world.grant([
        { operationClass: 'bash', matcher: { kind: 'fingerprint', resource: fingerprint }, effect: 'allow' },
      ])
      const granted = (await world.plane.decisions.decide({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        operation: execOperation(fingerprint),
        staticFacts: { template: STATIC_DENY_ALL },
      })) as { kind: string; plane?: string; effect?: string }
      expect(granted.plane).toBe('exec')
      expect(granted.effect).toBe('allow')

      const other = (await world.plane.decisions.decide({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        operation: execOperation(`sha256:${'b'.repeat(64)}`),
        staticFacts: { template: STATIC_DENY_ALL },
      })) as { kind: string; effect?: string }
      expect(other.effect).toBe('deny')
    } finally {
      await world.close()
    }
  })
})

describe('P5 — the durable lifecycle state gates execution in production', () => {
  it('ARCHIVED refuses (overlay retained), SETTLED executes, an unknown instance refuses', async () => {
    const world = await openProductionWorld()
    try {
      const key = `${world.insideDir}/a.ts`
      await world.grant([exactRule('write', key, 'allow')])
      const running = (await world.decideFile(key)) as { kind: string; effect?: string }
      expect(running.effect).toBe('allow')

      await world.setLifecycle('ARCHIVED')
      const archived = (await world.decideFile(key)) as { kind: string; code?: string }
      expect(archived.kind).toBe('refused')
      expect(archived.code).toBe(PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_ARCHIVED)
      const retained = await world.overlay.latest({
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
      })
      expect(retained?.metadata.generation).toBe(1)
      expect(retained?.state.rules).toHaveLength(1)

      await world.setLifecycle('SETTLED')
      const again = (await world.decideFile(key)) as { kind: string; effect?: string }
      expect(again.effect).toBe('allow')

      const ghost = (await world.plane.decisions.decide({
        teamSessionId: ROOT_SID,
        memberInstanceId: 'inst-a3p4ghost',
        operation: fileOperation('write', key),
        staticFacts: { template: STATIC_DENY_ALL },
      })) as { kind: string; code?: string }
      expect(ghost.kind).toBe('refused')
      expect(ghost.code).toBe(PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_STATE_UNKNOWN)
    } finally {
      await world.close()
    }
  })
})

describe('P6 — the EXISTING pre-execute pipeline consumes the plane', () => {
  it('the overlay denies over a static allow and an archived instance never executes; unwired stays frozen', async () => {
    const world = await openProductionWorld()
    try {
      const key = `${world.insideDir}/a.ts`
      const staticPolicy: TemplatePermissionPolicy = {
        default: 'deny',
        allow: [{ tool: 'write', resource: { kind: 'exact', path: key } }],
        ask: [],
        deny: [],
      }
      const observations: Record<string, unknown>[] = []

      const install = (withPlane: boolean) => {
        const listeners: Array<
          (exec: unknown, next: () => Promise<unknown>) => Promise<unknown>
        > = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake agent ctx of the A5 spec family
        const ctx: any = {
          on: (_event: string, listener: (exec: unknown, next: () => Promise<unknown>) => Promise<unknown>) => {
            listeners.push(listener)
            return () => undefined
          },
          tools: { guard: () => () => undefined },
        }
        const disposer = installParameterPermissionListener(ctx, {
          policy: staticPolicy,
          resolveTarget: async (path: string) => ({ key: path, display: path, handle: { targetKey: path } }),
          // The root's OWN control authority (the A2C-4 external recheck the
          // static-allow path performs; this config carries no hard external
          // facts, so the recheck allows).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the root facade is asserted as a subset elsewhere
          controlService: world.root.control as any,
          rootSessionId: ROOT_SID,
          caller: { kind: 'instance', instanceId: WORKER_ID },
          targetInstanceId: WORKER_ID,
          isLeader: false,
          onObserve: (observation: Record<string, unknown>) => {
            observations.push(observation)
          },
          ...(withPlane
            ? {
                // The exact closure the live glue installs at agent setup
                // (round-3 contract: `staticRules` may be undefined = the
                // adapter canonicalized NOTHING — static facts then ride
                // ABSENT, the lane's typed STATIC_FACTS_UNKNOWN posture,
                // never a fabricated declared-none; the merged answer's
                // `source` rides through for the adapter's floor routing).
                resolveDynamicDecision: async (input: {
                  operation: CanonicalOperation
                  staticRules: CanonicalRules | undefined
                  staticDefault: 'ask' | 'deny'
                }) => {
                  const outcome = (await world.plane.decisions.decide({
                    teamSessionId: ROOT_SID,
                    memberInstanceId: WORKER_ID,
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
                  })) as
                    | { kind: 'refused'; code: string; reason: string }
                    | {
                        kind: 'effective'
                        effect: 'allow' | 'ask' | 'deny'
                        source: 'rule' | 'default'
                        plane: string
                        winningLayer: string | null
                        overlayGeneration: number | null
                        explanation: string
                      }
                  return outcome.kind === 'refused'
                    ? { refused: true, code: outcome.code, reason: outcome.reason }
                    : {
                        effect: outcome.effect,
                        plane: outcome.plane,
                        winningLayer: outcome.winningLayer,
                        overlayGeneration: outcome.overlayGeneration,
                        explanation: outcome.explanation,
                        source: outcome.source,
                      }
                },
              }
            : {}),
        })
        const run = async (): Promise<{ kind: string; reason?: string }> => {
          const listener = listeners[0]
          if (listener === undefined) throw new Error('no pre-execute listener installed')
          const exec = {
            callId: 'a3p4-prod-call',
            name: 'write',
            arguments: { file_path: key, content: 'x' },
          }
          return (await listener(exec, async () => ({ kind: 'allow' }))) as {
            kind: string
            reason?: string
          }
        }
        return { disposer, run }
      }

      // (a) unwired install: the static allow executes (frozen pre-PR4 shape).
      const plain = install(false)
      expect((await plain.run()).kind).toBe('allow')
      plain.disposer()

      // (b) wired install, no overlay rows: the static decision still stands.
      const bare = install(true)
      expect((await bare.run()).kind).toBe('allow')
      bare.disposer()

      // (c) an overlay DENY overrides the static template allow.
      await world.grant([exactRule('write', key, 'deny')])
      const denied = install(true)
      const deniedResult = await denied.run()
      expect(deniedResult.kind).toBe('deny')
      denied.disposer()

      // (d) the archived instance cannot execute through the pipeline.
      await world.setLifecycle('ARCHIVED')
      const archived = install(true)
      const archivedResult = await archived.run()
      expect(archivedResult.kind).toBe('deny')
      expect(String(archivedResult.reason ?? '')).toContain(
        PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_ARCHIVED,
      )
      archived.disposer()

      const dynamicEvents = observations.filter((o) =>
        String(o['stage'] ?? '').startsWith('dynamic-decision'),
      )
      expect(dynamicEvents.length).toBeGreaterThanOrEqual(3)
    } finally {
      await world.close()
    }
  })
})
