/**
 * A3P4 ROUND 7 — the production-entry + exec-contract regressions (parent
 * GO batch, items 1-4 + R-A/R-B requirements).
 *
 * What is REAL here (the round-7 bar, R-B: "wire the real handler → closure →
 * router paths from scratch, NO direct-to-GMS legs count as entry coverage"):
 *  - grants/revokes ride the ACTUAL registered `team_grant_permission` /
 *    `team_revoke_permission` handlers of the root-filled tool set, or the
 *    ROOT-ASSEMBLED remote dispatcher (`root.remoteDispatcher` — the same
 *    ports/principal basis the mounted registration carries);
 *  - the ALLOW/DENY evidence comes from the REAL pre-execute boundary:
 *    `installParameterPermissionListener` (the frozen adapter the live glue
 *    installs) with the EXACT glue-shaped `resolveDynamicDecision` closure
 *    (agent-bindings.mjs), driving the production decision lane — NO
 *    hand-rolled plane.decide substitute is used for the required
 *    grant→ALLOW / revoke→DENY legs;
 *  - exec scope is expressed ONLY as the CLOSED structured intent; the leg
 *    proves the fingerprint the ENTRY canonicalized is BYTE-IDENTICAL to the
 *    fingerprint the execution plane computes for the identical live call
 *    (same carrier rule, same overlay row, same ALLOW).
 *
 * Pinned contracts (round-7):
 *  1. lifecycle law in the SHARED path: unknown/DISPOSED targets refuse
 *     typed at BOTH entries (zero write, typed remote codes), ARCHIVED
 *     stays legally mutable but NEVER executes (parent tri-state);
 *  2. ONE trusted addressed-root/target context (Team-B facts canonicalize
 *     under B when the call addresses B);
 *  3. no client-supplied fingerprint strings (self-labeled canonical keys
 *     refused at both entries);
 *  4. `reason` REQUIRED at the wire; kernel label split reason-missing vs
 *     reason-over-bound; mutationId is provenance, not dedupe.
 *
 * @module @dsh-agent-team/runtime/test/a3p4-pr7-entry-exec-contract-regression
 */

import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve, relative, sep, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import {
  LEADER_INSTANCE_ID,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
} from '../../contracts/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { openPermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import {
  createAuthorityCeilingReader,
  createPermissionAuthorityFacts,
  type CanonicalKeyContains,
  type TeamPermissionPlane,
} from '../src/plugin/permission-plane.js'
import { PERMISSION_MUTATION_ERROR_CODES } from '../governance/permission-mutation.js'
import { canonicalizeShellOperation } from '../operation-permission/canonical-operation.js'
import { installParameterPermissionListener } from '../operation-permission/pre-execute-adapter.js'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import { REMOTE_CONTRACT_VERSION_V7 } from '../../remote/src/index.js'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
void HERE // (kept for scratch parity with the sibling files)

const NOW = '2026-10-06T12:00:00.000Z'
const R7_ROOT = 'session-a3p4r7root'
const R7_TEAM_B = 'session-a3p4r7teamb'
const R7_WORKER = 'inst-a3p4r7worker'
const R7_ARCH = 'inst-a3p4r7arch'
const R7_DISP = 'inst-a3p4r7disp'
const R7_BMEM = 'inst-a3p4r7bmem'
const EXEC_COMMAND = 'echo a3p4r7-exec'

const openScratch: string[] = []
afterAll(() => {
  for (const base of openScratch) {
    try {
      rmSync(base, { recursive: true, force: true })
    } catch {
      /* best effort */
    }
  }
})

function makeContainKeys(): CanonicalKeyContains {
  return (parentKey, childKey) => {
    const rel = relative(resolve(parentKey), resolve(childKey))
    return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  }
}

/** The production canonicalizer seam shape (host.ts permissionCanonicalize). */
const plainCanonicalize = async (path: string, cwd: string): Promise<string> =>
  path.startsWith('/') ? path : resolve(cwd, path)

/** The blueprint: the worker lane is default-DENY on everything; the carrier
 *  covers EXACTLY three identities — the open file, a second file (replay
 *  leg), and the ONE canonical exec fingerprint (the author can only pin
 *  identities it can compute — exactly like a real author pinning one
 *  approved exec). */
function r7BlueprintSource(opts: {
  readonly openKey: string
  readonly secondKey: string
  readonly bKey: string
  readonly execFingerprint: string
}): string {
  return [
    '---',
    'schemaVersion: 3',
    'blueprintId: A3P4R7-BP',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: You lead the A3P4R7 team.',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items: [team_send_message, team_list_members]',
    '    builtinToolDeny: []',
    '    skills: { kind: allow, items: [] }',
    '    mcp: { kind: allow, items: [] }',
    '    permissions:',
    '      default: deny',
    '      allow: []',
    '      ask: []',
    '      deny: []',
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    '    persona: You do the A3P4R7 work.',
    '    capabilities:',
    '      teamTools:',
    '        kind: allow',
    '        items: [team_send_message]',
    '      builtinToolDeny: []',
    '      skills: { kind: allow, items: [] }',
    '      mcp: { kind: allow, items: [] }',
    '      permissions:',
    '        default: deny',
    '        allow: []',
    '        ask: []',
    '        deny: []',
    'permissionMutationEnvelope:',
    '  rules:',
    '    - operationClass: write',
    '      matcher:',
    '        kind: exact',
    `        path: "${opts.openKey}"`,
    '      maximumEffect: allow',
    '    - operationClass: write',
    '      matcher:',
    '        kind: exact',
    `        path: "${opts.secondKey}"`,
    '      maximumEffect: allow',
    '    - operationClass: write',
    '      matcher:',
    '        kind: exact',
    `        path: "${opts.bKey}"`,
    '      maximumEffect: allow',
    '    - operationClass: bash',
    '      matcher:',
    '        kind: fingerprint',
    `        fingerprint: "${opts.execFingerprint}"`,
    '      maximumEffect: allow',
    'teamHardEnvelope:',
    '  # A4-PR7 §7.5 prerequisite 3 — this ceiling is READ now, so the fixture',
    '  # declares it. This suite\'s law is the ENTRY/EXEC contract (which canonical',
    '  # identity an exec grant addresses, what the entry echoes back); the Team',
    '  # ceiling must never be what decides it. `{ rules: [] }` was a default written',
    '  # while nothing in the lane could read this field — with the reader wired it',
    '  # means "this Team may expand NOTHING", which contradicts every leg here. The',
    '  # declaration is over the SAME four cells the carrier above already covers, so',
    '  # the meet of the two documents equals the carrier: no leg gains authority it',
    '  # did not already claim, and no refusal a leg relied on disappears.',
    '  rules:',
    '    - operationClass: write',
    '      matcher:',
    '        kind: exact',
    `        path: "${opts.openKey}"`,
    '      maximumEffect: allow',
    '    - operationClass: write',
    '      matcher:',
    '        kind: exact',
    `        path: "${opts.secondKey}"`,
    '      maximumEffect: allow',
    '    - operationClass: write',
    '      matcher:',
    '        kind: exact',
    `        path: "${opts.bKey}"`,
    '      maximumEffect: allow',
    '    - operationClass: bash',
    '      matcher:',
    '        kind: fingerprint',
    `        fingerprint: "${opts.execFingerprint}"`,
    '      maximumEffect: allow',
    'teamEnvelope:',
    '  allow: [send-message, report-progress, request-control, resolve-control, archive-member, restore-member]',
    '  deny: []',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow: [send-message, report-progress]',
    '      deny: []',
    'policyStates:',
    '  - id: default',
    '    description: The A3P4R7 default state.',
    'quotas:',
    '  team: { maxInstances: 4, maxConcurrent: 4 }',
    '  members: { maxInstances: 2, maxConcurrent: 2 }',
    'metadata: {}',
    '---',
  ].join('\n')
}

interface R7World {
  readonly root: any // eslint-disable-line @typescript-eslint/no-explicit-any -- production root surface is structurally duck-typed here
  readonly plane: TeamPermissionPlane
  readonly overlay: ReturnType<typeof createPermissionOverlayRepositoryPort>
  readonly grant: any // eslint-disable-line @typescript-eslint/no-explicit-any
  readonly revoke: any // eslint-disable-line @typescript-eslint/no-explicit-any
  readonly callerState: { value: { caller: Record<string, unknown>; rootSessionId: string } }
  readonly base: string
  readonly wsA: string
  readonly wsB: string
  readonly openKey: string
  readonly secondKey: string
  readonly bKey: string
  readonly execFingerprint: string
  close(): Promise<void>
}

async function openR7World(): Promise<R7World> {
  const base = scratchDir(`a3p4r7-${Math.random().toString(36).slice(2, 8)}`)
  openScratch.push(base)
  destroyDir(base)
  const wsA = `${base}/workspace`
  const wsB = `${base}/team-b/workspace`
  mkdirSync(wsA, { recursive: true })
  mkdirSync(wsB, { recursive: true })
  const openKey = `${wsA}/open.txt`
  const secondKey = `${wsA}/second.txt`
  const bKey = `${wsB}/b.txt`
  // The ONE canonical exec identity (computed with the REAL canonicalizer at
  // the member's durable workspace basis — what an author would pin).
  const execOperation = await canonicalizeShellOperation(
    'bash',
    { command: EXEC_COMMAND },
    async (pathInput: string) => {
      const key = await plainCanonicalize(pathInput, wsA)
      return { key, display: pathInput, handle: { targetKey: key } }
    },
  )
  const execFingerprint = execOperation.fingerprint

  const seam = new FileStorageSeam(base)
  const domain = await createTeamDomain(seam)
  const overlayStore = await openPermissionOverlayStore(new FileStorageSeam(base))
  const overlay = createPermissionOverlayRepositoryPort({ repository: overlayStore.repository })
  const config = {
    bootPhase: 'create' as const,
    rootSessionId: R7_ROOT,
    blueprintSource: r7BlueprintSource({ openKey, secondKey, bKey, execFingerprint }),
    generation: 1,
    defaultWorkspace: wsA,
    seedMembers: [],
    staticModel: { provider: 'a3p4r7', model: 'a3p4r7-model' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  await domain.repositories.teamSessions.put({
    rootSessionId: parseRootSessionId(R7_ROOT),
    blueprint: createBlueprintSnapshotRef({
      blueprintId: parseBlueprintId('team.a3p4r7'),
      revision: parseBlueprintRevision('1'),
      contentHash: parseBlueprintContentHash(`sha256:${'a'.repeat(64)}`),
    }),
    defaultWorkspace: wsA,
    createdAt: NOW,
    generation: 1,
  })
  // Team B: a NON-BOOT durable team with its OWN default workspace (BLOCK-2
  // fixture: facts addressed under B must canonicalize under B).
  await domain.repositories.teamSessions.put({
    rootSessionId: parseRootSessionId(R7_TEAM_B),
    blueprint: createBlueprintSnapshotRef({
      blueprintId: parseBlueprintId('team.a3p4r7'),
      revision: parseBlueprintRevision('1'),
      contentHash: parseBlueprintContentHash(`sha256:${'a'.repeat(64)}`),
    }),
    defaultWorkspace: wsB,
    createdAt: NOW,
    generation: 1,
  })
  const putMember = async (
    team: string,
    instance: string,
    lifecycle: string,
    child: string,
  ): Promise<void> => {
    await domain.repositories.memberInstances.put({
      rootSessionId: parseRootSessionId(team),
      instanceId: parseInstanceId(instance),
      templateId: parseTemplateId('worker'),
      label: `a3p4r7 ${lifecycle.toLowerCase()} member`,
      childSessionId: parseChildSessionId(child),
      lifecycle: lifecycle as never,
      createdAt: NOW,
      activityVersion: 1,
    })
  }
  // The durable LEADER row, exactly as the production boot creates it
  // (root.ts:3190-3204). R8's leader-claim leg requires it: deriveMutationActor
  // resolves a leader claim ONLY against a durable leader row.
  await domain.repositories.memberInstances.put({
    rootSessionId: parseRootSessionId(R7_ROOT),
    instanceId: LEADER_INSTANCE_ID,
    templateId: parseTemplateId('leader'),
    label: 'leader',
    childSessionId: parseChildSessionId(R7_ROOT),
    lifecycle: 'RUNNING',
    createdAt: NOW,
    activityVersion: 1,
  })
  await putMember(R7_ROOT, R7_WORKER, 'RUNNING', 'child-r7-worker')
  await putMember(R7_ROOT, R7_ARCH, 'ARCHIVED', 'child-r7-arch')
  await putMember(R7_ROOT, R7_DISP, 'DISPOSED', 'child-r7-disp')
  await putMember(R7_TEAM_B, R7_BMEM, 'RUNNING', 'child-r7-bmem')

  const teamToolsRef: { current: any } = { current: undefined } // eslint-disable-line @typescript-eslint/no-explicit-any
  const callerState = {
    value: { caller: { kind: 'instance', instanceId: LEADER_INSTANCE_ID }, rootSessionId: R7_ROOT },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub glue surface
  const live: any = createStubBindings({ config, teamToolsRef, domain })
  live.resolveCaller = async () => callerState.value
  const facts = createPermissionAuthorityFacts({
    resolveBlueprint: () => parseBlueprint(config.blueprintSource),
    memberTemplateId: (teamSessionId: string, memberInstanceId: string) =>
      domain.repositories.memberInstances.get(teamSessionId, memberInstanceId)?.templateId as string | undefined,
    memberWorkspace: (teamSessionId: string, memberInstanceId: string) => {
      const ws = domain.repositories.memberInstances.get(teamSessionId, memberInstanceId)
        ?.workspace as string | undefined
      if (typeof ws === 'string' && ws !== '') return ws
      const teamDefault = domain.repositories.teamSessions.get(teamSessionId)
        ?.defaultWorkspace as string | undefined
      return typeof teamDefault === 'string' && teamDefault !== '' ? teamDefault : undefined
    },
    canonicalize: plainCanonicalize,
  })
  const permissionPlaneRef: { current: TeamPermissionPlane | undefined } = { current: undefined }
  const root = createTeamProductionRoot({
    config,
    domain: domain as never,
    storageSeam: seam,
    live,
    now: () => NOW,
    teamToolsRef,
    controlServiceRef: { current: undefined },
    legacyInspect: (() => {
      throw new Error('a3p4r7 world: legacy inspect is unused')
    }) as never,
    permissionOverlay: overlay,
    fsContainsKeys: makeContainKeys(),
    permissionPlaneRef,
    permissionCanonicalize: plainCanonicalize,
    permissionEnvelope: facts.permissionEnvelope,
    permissionStaticLayers: facts.staticLayers,    // A4-PR7 §7.5 prerequisite 3 — THE LINE THIS SUITE WAS MISSING, and it is the line
    // production wires: host.ts:2703 passes exactly
    // createAuthorityCeilingReader({ facts: permissionFacts }). This world already
    // built createPermissionAuthorityFacts and handed the root two of its readers;
    // the ceiling reader was the one left out, so the root's conditional spread at
    // src/plugin/root.ts:2899 produced a lane with NO ceiling gate at all and the
    // blueprint's own teamHardEnvelope was consulted by nothing.
    permissionAuthorityCeiling: createAuthorityCeilingReader({ facts }),
  })
  const plane = permissionPlaneRef.current
  if (plane === undefined) throw new Error('the a3p4r7 root did not fill the plane reference')
  const tools = (teamToolsRef.current?.tools ?? []) as {
    name: string
    execute(a: unknown, e: unknown): Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  }[]
  const grant = tools.find((t) => t.name === 'team_grant_permission')
  const revoke = tools.find((t) => t.name === 'team_revoke_permission')
  if (grant === undefined || revoke === undefined) {
    throw new Error('the a3p4r7 root did not register the permission tools')
  }
  if (typeof (root as { remoteDispatcher?: unknown }).remoteDispatcher !== 'function') {
    throw new Error('the a3p4r7 root did not expose the root-assembled remote dispatcher')
  }
  return {
    root,
    plane,
    overlay,
    grant,
    revoke,
    callerState,
    base,
    wsA,
    wsB,
    openKey,
    secondKey,
    bKey,
    execFingerprint,
    close: async () => {
      await domain.close()
      destroyDir(base)
    },
  }
}

/** The static template lane: everything denies (the overlay must WIN). */
const DENY_ALL_POLICY: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }

interface PreExecuteHandle {
  disposer: () => void
  run: (
    name: string,
    args: unknown,
  ) => Promise<{ kind: string; code?: string; reason?: string }>
}

/**
 * Install the REAL pre-execute adapter the way the live glue does, with the
 * EXACT glue closure shape (agent-bindings.mjs `resolveDynamicDecision` →
 * `permissionPlane.decisions.decide` with the addressed team/member and the
 * adapter-canonicalized static facts), for one member instance whose session
 * cwd is its durable effective workspace.
 */
function installPreExecute(
  world: R7World,
  teamSessionId: string,
  instanceId: string,
  memberCwd: string,
): PreExecuteHandle {
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
  const disposer = installParameterPermissionListener(ctx, {
    policy: DENY_ALL_POLICY,
    resolveTarget: async (path: string) => {
      const key = await plainCanonicalize(path, memberCwd)
      return { key, display: path, handle: { targetKey: key } }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the root's own control authority
    controlService: world.root.control as any,
    rootSessionId: teamSessionId,
    caller: { kind: 'instance', instanceId },
    targetInstanceId: instanceId,
    isLeader: false,
    resolveDynamicDecision: (async (input: {
      operation: unknown
      staticRules: unknown
      staticDefault: 'ask' | 'deny'
    }) => {
      const outcome = (await world.plane.decisions.decide({
        teamSessionId,
        memberInstanceId: instanceId,
        operation: input.operation as never,
        ...(input.staticRules === undefined
          ? {}
          : {
              staticFacts: {
                template: {
                  label: 'worker',
                  default: input.staticDefault,
                  rules: input.staticRules as never,
                },
              },
            }),
        containment: (rootKey: string, target: { key: string }) =>
          makeContainKeys()(rootKey, target.key),
      })) as Record<string, unknown>
      if (outcome['kind'] === 'refused') {
        return {
          kind: 'refused',
          code: String(outcome['code'] ?? ''),
          reason: String(outcome['reason'] ?? ''),
        }
      }
      return {
        effect: outcome['effect'],
        plane: outcome['plane'],
        winningLayer: outcome['winningLayer'],
        overlayGeneration: outcome['overlayGeneration'],
        explanation: outcome['explanation'],
        source: outcome['source'],
      }
    }) as never,
  })
  const run = async (
    name: string,
    args: unknown,
  ): Promise<{ kind: string; code?: string; reason?: string }> => {
    const listener = listeners[0]
    if (listener === undefined) throw new Error('no pre-execute listener installed')
    return (await listener(
      {
        callId: `a3p4r7-${Math.random().toString(36).slice(2, 8)}`,
        name,
        arguments: args,
        signal: new AbortController().signal,
      },
      async () => ({ kind: 'allow' }),
    )) as { kind: string; code?: string; reason?: string }
  }
  return { disposer, run }
}

const leaderCtx = { agent: { id: 'agent-of-the-leader' } }

// ══════════════════════════════════════════════════════════════════════════
// R7-EXEC — item 3 + the mandatory pre-execute boundary legs (tool entry)
// ══════════════════════════════════════════════════════════════════════════

describe('R7-exec — the structured exec intent through the real tool reaches the REAL pre-execute plane', () => {
  it('exec intent → server canonicalization → durable exact-fingerprint row → pre-execute ALLOW for the identical call; deny for another command; revoke → deny', async () => {
    const world = await openR7World()
    const pre = installPreExecute(world, R7_ROOT, R7_WORKER, world.wsA)
    try {
      const granted = await world.grant.execute(
        {
          rootSessionId: R7_ROOT,
          requestToken: 'r7-exec-grant-1',
          targetInstanceId: R7_WORKER,
          rules: [
            {
              operationClass: 'bash',
              matcher: { kind: 'exec', intent: { tool: 'bash', command: EXEC_COMMAND } },
              effect: 'allow',
            },
          ],
        },
        leaderCtx,
      )
      expect(granted.status, `grant failed: ${JSON.stringify(granted)}`).toBe('permission-mutated')
      // The GMS-internal key is the EXACT fingerprint the canonicalizer
      // produced (byte-identical to what the execution plane computes).
      const row = await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_WORKER })
      expect(row).toBeDefined()
      // The durable row carries the canonical resource identity (the PR1
      // carrier format embeds the matcher prefix in the resource string).
      const carried = row!.state.rules as unknown as { resource: string }[]
      expect(carried.some((r) => r.resource === `fingerprint:${world.execFingerprint}`)).toBe(true)
      // THE REAL PRE-EXECUTE BOUNDARY: the identical live call ALLOWs …
      const allowed = await pre.run('bash', { command: EXEC_COMMAND })
      expect(allowed.kind, `expected allow, got ${JSON.stringify(allowed)}`).toBe('allow')
      // … a DIFFERENT command (different fingerprint) stays denied …
      const other = await pre.run('bash', { command: 'echo a3p4r7-other' })
      expect(other.kind).not.toBe('allow')
      // … and after a REVOKE through the same real entry, even the identical
      // call is denied again (absent → floor).
      const revoked = await world.revoke.execute(
        {
          rootSessionId: R7_ROOT,
          requestToken: 'r7-exec-revoke-1',
          targetInstanceId: R7_WORKER,
          rules: [
            {
              operationClass: 'bash',
              matcher: { kind: 'exec', intent: { tool: 'bash', command: EXEC_COMMAND } },
              effect: 'allow',
            },
          ],
        },
        leaderCtx,
      )
      expect(revoked.status).toBe('permission-mutated')
      expect(revoked.changed).toBe(true)
      const denied = await pre.run('bash', { command: EXEC_COMMAND })
      expect(denied.kind).not.toBe('allow')
    } finally {
      pre.disposer()
      await world.close()
    }
  })

  it('a client-supplied fingerprint string is refused at the tool (no self-labeled canonical authority); unknown intent fields too', async () => {
    const world = await openR7World()
    try {
      const smuggled = await world.grant.execute(
        {
          rootSessionId: R7_ROOT,
          requestToken: 'r7-exec-smuggle-1',
          targetInstanceId: R7_WORKER,
          rules: [
            {
              operationClass: 'bash',
              matcher: { kind: 'fingerprint', value: world.execFingerprint },
              effect: 'allow',
            },
          ],
        },
        leaderCtx,
      )
      expect(smuggled.status).toBe('rejected')
      const stray = await world.grant.execute(
        {
          rootSessionId: R7_ROOT,
          requestToken: 'r7-exec-stray-1',
          targetInstanceId: R7_WORKER,
          rules: [
            {
              operationClass: 'bash',
              matcher: {
                kind: 'exec',
                intent: { tool: 'bash', command: EXEC_COMMAND, env: 'anything' },
              },
              effect: 'allow',
            },
          ],
        },
        leaderCtx,
      )
      expect(stray.status).toBe('rejected')
      const row = await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_WORKER })
      expect(row).toBeUndefined()
    } finally {
      await world.close()
    }
  })

  it('file class through the real tool: grant → REAL pre-execute ALLOW on write; revoke → DENY', async () => {
    const world = await openR7World()
    const pre = installPreExecute(world, R7_ROOT, R7_WORKER, world.wsA)
    try {
      const granted = await world.grant.execute(
        {
          rootSessionId: R7_ROOT,
          requestToken: 'r7-file-grant-1',
          targetInstanceId: R7_WORKER,
          // RAW RELATIVE path — canonicalized server-side at the member's
          // durable basis (no workspace row → the team default).
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
        },
        leaderCtx,
      )
      expect(granted.status, `grant failed: ${JSON.stringify(granted)}`).toBe('permission-mutated')
      const allowed = await pre.run('write', { file_path: world.openKey, content: 'x' })
      expect(allowed.kind, `expected allow, got ${JSON.stringify(allowed)}`).toBe('allow')
      await world.revoke.execute(
        {
          rootSessionId: R7_ROOT,
          requestToken: 'r7-file-revoke-1',
          targetInstanceId: R7_WORKER,
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
        },
        leaderCtx,
      )
      const denied = await pre.run('write', { file_path: world.openKey, content: 'x' })
      expect(denied.kind).not.toBe('allow')
    } finally {
      pre.disposer()
      await world.close()
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════
// R7-RPC — the ROOT-ASSEMBLED router (R-B: the real s6 router entry, the
// real root closures — no hand-built options object)
// ══════════════════════════════════════════════════════════════════════════

describe('R7-rpc — override.mutatePermission through the ROOT-ASSEMBLED dispatcher to the REAL pre-execute plane', () => {
  const call = (
    world: R7World,
    params: Record<string, unknown>,
): Promise<{ ok: boolean; value?: { data?: Record<string, unknown> }; error?: { code?: string; message?: string; details?: Record<string, unknown> } }> =>
    world.root.remoteDispatcher('override.mutatePermission', {
      version: REMOTE_CONTRACT_VERSION_V7,
      params,
    })

  it('operator exec-intent grant through the real router → pre-execute ALLOW; router revoke → DENY', async () => {
    const world = await openR7World()
    const pre = installPreExecute(world, R7_ROOT, R7_WORKER, world.wsA)
    try {
      const granted = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'grant_instance',
        mutationId: 'r7-rpc-exec-grant',
        reason: 'r7 rpc exec leg',
        actor: { kind: 'human' },
        rules: [
          {
            operationClass: 'bash',
            matcher: { kind: 'exec', intent: { tool: 'bash', command: EXEC_COMMAND } },
            effect: 'allow',
          },
        ],
      })
      expect(granted.ok, `router grant failed: ${JSON.stringify(granted.error ?? {})}`).toBe(true)
      const allowed = await pre.run('bash', { command: EXEC_COMMAND })
      expect(allowed.kind, `expected allow, got ${JSON.stringify(allowed)}`).toBe('allow')
      const revoked = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'revoke_permission',
        mutationId: 'r7-rpc-exec-revoke',
        reason: 'r7 rpc exec revoke',
        actor: { kind: 'human' },
        rules: [
          {
            operationClass: 'bash',
            matcher: { kind: 'exec', intent: { tool: 'bash', command: EXEC_COMMAND } },
            effect: 'allow',
          },
        ],
      })
      expect(revoked.ok).toBe(true)
      expect((revoked.value?.data as Record<string, unknown> | undefined)?.['changed']).toBe(true)
      const denied = await pre.run('bash', { command: EXEC_COMMAND })
      expect(denied.kind).not.toBe('allow')
    } finally {
      pre.disposer()
      await world.close()
    }
  })

  it('file class through the real router → pre-execute ALLOW; absent/revoke → DENY', async () => {
    const world = await openR7World()
    const pre = installPreExecute(world, R7_ROOT, R7_WORKER, world.wsA)
    try {
      const before = await pre.run('write', { file_path: world.openKey, content: 'x' })
      expect(before.kind).not.toBe('allow')
      const granted = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'grant_instance',
        mutationId: 'r7-rpc-file-grant',
        reason: 'r7 rpc file leg',
        actor: { kind: 'human' },
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
      })
      expect(granted.ok, `router file grant failed: ${JSON.stringify(granted.error ?? {})}`).toBe(true)
      const allowed = await pre.run('write', { file_path: world.openKey, content: 'x' })
      expect(allowed.kind).toBe('allow')
    } finally {
      pre.disposer()
      await world.close()
    }
  })

  it('a raw fingerprint string is refused at the router params (closed matcher grammar), zero write', async () => {
    const world = await openR7World()
    try {
      const smuggled = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'grant_instance',
        mutationId: 'r7-rpc-smuggle',
        reason: 'self-labeled canonical',
        actor: { kind: 'human' },
        rules: [
          {
            operationClass: 'bash',
            matcher: { kind: 'fingerprint', value: world.execFingerprint },
            effect: 'allow',
          },
        ],
      })
      expect(smuggled.ok).toBe(false)
      expect(JSON.stringify(smuggled.error ?? {})).toContain('matcher.kind')
      const row = await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_WORKER })
      expect(row).toBeUndefined()
    } finally {
      await world.close()
    }
  })

  it('lifecycle law through the REAL router: ghost → PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN, DISPOSED → PERMISSION_LIFECYCLE_TARGET_TERMINAL (typed codes, NOT internal-error; zero write)', async () => {
    const world = await openR7World()
    try {
      const ghost = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: 'inst-a3p4r7ghost',
        kind: 'grant_instance',
        mutationId: 'r7-rpc-ghost',
        reason: 'no such member',
        actor: { kind: 'human' },
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
      })
      expect(ghost.ok).toBe(false)
      expect(ghost.error?.code).toBe('PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN')
      const disposed = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_DISP,
        kind: 'grant_instance',
        mutationId: 'r7-rpc-disposed',
        reason: 'terminal member',
        actor: { kind: 'human' },
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
      })
      expect(disposed.ok).toBe(false)
      expect(disposed.error?.code).toBe('PERMISSION_LIFECYCLE_TARGET_TERMINAL')
      expect(await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: 'inst-a3p4r7ghost' })).toBeUndefined()
      expect(await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_DISP })).toBeUndefined()
    } finally {
      await world.close()
    }
  })

  it('reason is REQUIRED at the wire (item 4): absent → typed malformed on field reason; the committed provenance carries the human reason verbatim', async () => {
    const world = await openR7World()
    try {
      const absent = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'grant_instance',
        mutationId: 'r7-rpc-no-reason',
        actor: { kind: 'human' },
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
      })
      expect(absent.ok, 'the optional-reason path is DEAD: the contract now requires it').toBe(false)
      expect(JSON.stringify(absent.error ?? {})).toContain('reason')
      expect(await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_WORKER })).toBeUndefined()
      const granted = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'grant_instance',
        mutationId: 'r7-rpc-with-reason',
        reason: 'human audit reason r7',
        actor: { kind: 'human' },
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
      })
      expect(granted.ok).toBe(true)
      const row = await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_WORKER })
      const rendered = JSON.stringify(row ?? {}) as string
      expect(rendered).toContain('human audit reason r7')
    } finally {
      await world.close()
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════
// R7-LAW — the lifecycle tri-state at the tool entry + ARCHIVED never
// executes (the parent-pinned mutation-legal / execution-illegal split)
// ══════════════════════════════════════════════════════════════════════════

describe('R7-law — ARCHIVED mutates legally but never executes; DISPOSED/unknown never mutate (both positions)', () => {
  it('tool: ghost → INSTANCE_UNKNOWN rejected zero-write; DISPOSED → TARGET_TERMINAL; ARCHIVED commits AND the pre-execute plane still refuses the overlay allow', async () => {
    const world = await openR7World()
    const preArch = installPreExecute(world, R7_ROOT, R7_ARCH, world.wsA)
    try {
      const ghost = await world.grant.execute(
        {
          rootSessionId: R7_ROOT,
          requestToken: 'r7-law-ghost',
          targetInstanceId: 'inst-a3p4r7ghost',
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
        },
        leaderCtx,
      )
      expect(ghost.status).toBe('rejected')
      expect(String(ghost.code)).toContain('INSTANCE_UNKNOWN')
      const disposed = await world.revoke.execute(
        {
          rootSessionId: R7_ROOT,
          requestToken: 'r7-law-disposed',
          targetInstanceId: R7_DISP,
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
        },
        leaderCtx,
      )
      expect(disposed.status).toBe('rejected')
      expect(String(disposed.code)).toContain('TARGET_TERMINAL')
      // ARCHIVED: LEGAL mutation (parent tri-state).
      const archivedGrant = await world.grant.execute(
        {
          rootSessionId: R7_ROOT,
          requestToken: 'r7-law-archived',
          targetInstanceId: R7_ARCH,
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
        },
        leaderCtx,
      )
      expect(archivedGrant.status, `archived grant failed: ${JSON.stringify(archivedGrant)}`).toBe('permission-mutated')
      expect(archivedGrant.changed).toBe(true)
      // … but the EXECUTION plane refuses the ARCHIVED instance regardless
      // of the durable allow it now carries (the gate precedes the facts).
      const attempted = await preArch.run('write', { file_path: world.openKey, content: 'x' })
      expect(attempted.kind).not.toBe('allow')
      expect(await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_ARCH })).toBeDefined()
      // Zero writes for the refused targets.
      expect(await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: 'inst-a3p4r7ghost' })).toBeUndefined()
      expect(await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_DISP })).toBeUndefined()
    } finally {
      preArch.disposer()
      await world.close()
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════
// R7-ADDR — BLOCK-2: one trusted addressed context (Team-B facts under B)
// ══════════════════════════════════════════════════════════════════════════

describe('R7-addr — canonicalization and mutation share the per-call addressed team (Team B under B)', () => {
  it('a tool call addressed to Team B canonicalizes at B’s durable default workspace — never the boot-A tail', async () => {
    const world = await openR7World()
    const preB = installPreExecute(world, R7_TEAM_B, R7_BMEM, world.wsB)
    try {
      world.callerState.value = {
        caller: { kind: 'instance', instanceId: LEADER_INSTANCE_ID },
        rootSessionId: R7_TEAM_B,
      }
      const granted = await world.grant.execute(
        {
          rootSessionId: R7_TEAM_B,
          requestToken: 'r7-addr-grant-1',
          targetInstanceId: R7_BMEM,
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'b.txt' }, effect: 'allow' }],
        },
        leaderCtx,
      )
      expect(granted.status, `team-B grant failed: ${JSON.stringify(granted)}`).toBe('permission-mutated')
      const row = await world.overlay.latest({ teamSessionId: R7_TEAM_B, memberInstanceId: R7_BMEM })
      expect(row).toBeDefined()
      const rules = row!.state.rules as unknown as { resource: string }[]
      const bBased = rules.some((r) => r.resource === `exact:${world.wsB}/b.txt`)
      const aBased = rules.some((r) => r.resource === `exact:${world.wsA}/b.txt`)
      expect(bBased, 'the rule key must be B-based').toBe(true)
      expect(aBased, 'the boot-A tail must never be the basis').toBe(false)
      // And the addressed team's OWN execution basis flips to ALLOW.
      const allowed = await preB.run('write', { file_path: `${world.wsB}/b.txt`, content: 'x' })
      expect(allowed.kind, `expected allow under B, got ${JSON.stringify(allowed)}`).toBe('allow')
      // The mutation row lives under TEAM B, not under the boot team.
      expect(await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_BMEM })).toBeUndefined()
    } finally {
      preB.disposer()
      await world.close()
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════
// R7-SEM — kernel label split + mutationId-provenance replay semantics
// ══════════════════════════════════════════════════════════════════════════

describe('R7-sem — reason label split (missing vs over-bound) and replay semantics (snapshot equality, not mutationId dedupe)', () => {
  it('reason ABSENT refuses with problem reason-missing; >512 refuses reason-over-bound (labels are honest)', async () => {
    const world = await openR7World()
    try {
      const missing = await world.root.mutation.governance
        .mutatePermission({
          authority: { kind: 'leader' },
          teamSessionId: R7_ROOT,
          memberInstanceId: R7_WORKER,
          kind: 'grant_instance',
          mutationId: 'r7-sem-missing',
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: world.openKey }, effect: 'allow' }],
        })
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      const renderedMissing = JSON.stringify(missing ?? {})
      expect(renderedMissing).toContain('reason-missing')
      expect(renderedMissing).not.toContain('reason-over-bound')
      const over = await world.root.mutation.governance
        .mutatePermission({
          authority: { kind: 'leader' },
          teamSessionId: R7_ROOT,
          memberInstanceId: R7_WORKER,
          kind: 'grant_instance',
          mutationId: 'r7-sem-over',
          reason: 'x'.repeat(513),
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: world.openKey }, effect: 'allow' }],
        })
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      expect(JSON.stringify(over ?? {})).toContain('reason-over-bound')
      expect(JSON.stringify(over ?? {})).not.toContain('reason-missing')
    } finally {
      await world.close()
    }
  })

  it('replay: a rule-set-equal re-grant no-ops (changed:false); the SAME mutationId with DIFFERENT rules still commits — mutationId is provenance, not dedupe', async () => {
    const world = await openR7World()
    try {
      const rules = (value: string): unknown[] => [
        { operationClass: 'write', matcher: { kind: 'exact', value }, effect: 'allow' },
      ]
      const first = await world.grant.execute(
        { rootSessionId: R7_ROOT, requestToken: 'r7-sem-replay', targetInstanceId: R7_WORKER, rules: rules('open.txt') },
        leaderCtx,
      )
      expect(first.status).toBe('permission-mutated')
      expect(first.changed).toBe(true)
      const replay = await world.grant.execute(
        { rootSessionId: R7_ROOT, requestToken: 'r7-sem-replay', targetInstanceId: R7_WORKER, rules: rules('open.txt') },
        leaderCtx,
      )
      expect(replay.status).toBe('permission-mutated')
      expect(replay.changed, 'a rule-set-equal mutation no-ops (snapshot equality)').toBe(false)
      const sameTokenDifferentRules = await world.grant.execute(
        { rootSessionId: R7_ROOT, requestToken: 'r7-sem-replay', targetInstanceId: R7_WORKER, rules: rules('second.txt') },
        leaderCtx,
      )
      expect(sameTokenDifferentRules.status).toBe('permission-mutated')
      expect(sameTokenDifferentRules.changed, 'mutationId does NOT dedupe distinct rule sets').toBe(true)
    } finally {
      await world.close()
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════
// R8-PRINCIPAL — BLOCK-5 role matrix AT THE ROOT-ASSEMBLED ROUTER.
// The trust doctrine pinned here (A32 model, recorded honestly): the remote
// CHANNEL is the operator-class connection gate (ServerPrincipalContext is the
// authority basis; a member SESSION has no separate remote connection in this
// product — members act through the tool path). The payload `actor` claim is
// therefore a ROLE SELECTION inside the trusted channel, validated by
// deriveMutationActor against the DURABLE domain — it is not connection
// binding, and this leg set pins exactly what that machinery guarantees:
// a human claim answers the host operator via the ADDRESSED (owned) team id,
// never a client string; a leader claim requires the durable leader row and
// then runs UNDER THE CARRIER ENVELOPE (§6 — the §7 exemption does NOT leak);
// a member claim is refused TYPED (never upgraded to operator); forged or
// absent claims are typed refusals with zero write.
// ══════════════════════════════════════════════════════════════════════════

type R8Response = {
  ok: boolean
  value?: { data?: Record<string, unknown> }
  error?: { code?: string; message?: string; details?: Record<string, unknown> }
}

describe('R8-principal — actor role matrix through the ROOT-ASSEMBLED router (BLOCK-5 fix)', () => {
  const call = (
    world: R7World,
    params: Record<string, unknown>,
  ): Promise<R8Response> =>
    world.root.remoteDispatcher('override.mutatePermission', {
      version: REMOTE_CONTRACT_VERSION_V7,
      params,
    }) as Promise<R8Response>

  it('legitimate Human claim → legal mutation; the durable row records the human provenance verbatim; pre-execute ALLOW', async () => {
    const world = await openR7World()
    const pre = installPreExecute(world, R7_ROOT, R7_WORKER, world.wsA)
    try {
      const granted = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'grant_instance',
        mutationId: 'r8-human-grant',
        reason: 'r8 human claim provenance',
        actor: { kind: 'human' },
        rules: [
          {
            operationClass: 'write',
            matcher: { kind: 'exact', value: world.openKey },
            effect: 'allow',
          },
        ],
      })
      expect(granted.ok, JSON.stringify(granted.error ?? {})).toBe(true)
      expect(granted.value?.data?.['changed']).toBe(true)
      const row = (await world.overlay.latest({
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
      })) as unknown as {
        provenance?: { actor?: string; reason?: string; mutationId?: string }
      }
      // The §7 human surface: actor 'human'; the identity CHANNEL of the
      // humanId is the ADDRESSED, ownership-validated teamSessionId — the
      // durable row IS that record (teamSessionId R7_ROOT, never a client
      // string); the reason lands verbatim.
      expect(row.provenance?.actor).toBe('human')
      expect(row.provenance?.reason).toBe('r8 human claim provenance')
      expect(row.provenance?.mutationId).toBe('r8-human-grant')
      const allowed = await pre.run('write', { file_path: world.openKey, content: 'x' })
      expect(allowed.kind, JSON.stringify(allowed)).toBe('allow')
    } finally {
      pre.disposer()
      await world.close()
    }
  })

  it('Leader claim → NOT the §7 exemption: the row records leader provenance, and expansion runs under the carrier envelope (in-ceiling commits; out-of-ceiling refuses TYPED, zero write)', async () => {
    const world = await openR7World()
    const pre = installPreExecute(world, R7_ROOT, R7_WORKER, world.wsA)
    try {
      const leaderGrant = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'grant_instance',
        mutationId: 'r8-leader-grant',
        reason: 'r8 leader claim within carrier ceiling',
        actor: { kind: 'leader' },
        rules: [
          {
            operationClass: 'write',
            matcher: { kind: 'exact', value: world.secondKey },
            effect: 'allow',
          },
        ],
      })
      expect(leaderGrant.ok, JSON.stringify(leaderGrant.error ?? {})).toBe(true)
      const row = (await world.overlay.latest({
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
      })) as unknown as { provenance?: { actor?: string } }
      expect(row.provenance?.actor, 'leader provenance — NOT a fabricated human one').toBe('leader')
      const allowed = await pre.run('write', { file_path: world.secondKey, content: 'x' })
      expect(allowed.kind, JSON.stringify(allowed)).toBe('allow')
      // OUT of the carrier ceiling: the envelope carries only the three
      // EXACT write rules (+ the exec fingerprint) — a SUBTREE expansion
      // must die at the §6 envelope gate. If the old default-to-operator
      // were still in play this would COMMIT (the §7 surface is exempt).
      const overCeiling = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'grant_instance',
        mutationId: 'r8-leader-over-ceiling',
        reason: 'r8 leader claim beyond carrier ceiling',
        actor: { kind: 'leader' },
        rules: [
          {
            operationClass: 'write',
            matcher: { kind: 'subtree', value: world.wsA },
            effect: 'allow',
          },
        ],
      })
      expect(overCeiling.ok).toBe(false)
      expect(overCeiling.error?.code).toBe('PERMISSION_ENVELOPE_EXPANSION_DENIED')
      const after = (await world.overlay.latest({
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
      })) as unknown as { provenance?: { mutationId?: string } }
      expect(after.provenance?.mutationId, 'the denied expansion wrote NOTHING').toBe('r8-leader-grant')
    } finally {
      pre.disposer()
      await world.close()
    }
  })

  it('member claim (durable real member) → PERMISSION_MUTATION_UNAUTHORIZED_ACTOR typed, zero write — NEVER operator', async () => {
    const world = await openR7World()
    try {
      const denied = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'grant_instance',
        mutationId: 'r8-member-grant',
        reason: 'r8 member claim must never mutate',
        actor: { kind: 'member', member: { rootSessionId: R7_ROOT, instanceId: R7_WORKER } },
        rules: [
          {
            operationClass: 'write',
            matcher: { kind: 'exact', value: world.openKey },
            effect: 'allow',
          },
        ],
      })
      expect(denied.ok).toBe(false)
      expect(denied.error?.code).toBe('PERMISSION_MUTATION_UNAUTHORIZED_ACTOR')
      expect(await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_WORKER })).toBeUndefined()
    } finally {
      await world.close()
    }
  })

  it('forged/absent claims → typed principal refusals AT THE ROUTER (specific code each), zero write', async () => {
    const world = await openR7World()
    try {
      const base = {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_WORKER,
        kind: 'grant_instance',
        mutationId: 'r8-forged',
        reason: 'r8 forged claim',
        rules: [
          {
            operationClass: 'write',
            matcher: { kind: 'exact', value: world.openKey },
            effect: 'allow',
          },
        ],
      }
      // 'operator' is NOT a claimable kind anywhere in the vocabulary: it
      // dies at the contract's closed actor set (typed, zero write) and
      // NEVER reaches derivation as an authority — never upgraded.
      const forged = await call(world, { ...base, actor: { kind: 'operator' } })
      expect(forged.ok).toBe(false)
      expect(forged.error?.code, 'unclaimable actor kind is a typed contract refusal').toBe('malformed-params')
      expect(String(forged.error?.details?.['field'] ?? forged.error?.message ?? '')).toContain('actor')
      const ghostMember = await call(world, {
        ...base,
        actor: { kind: 'member', member: { rootSessionId: R7_ROOT, instanceId: 'inst-a3p4r8ghost' } },
      })
      expect(ghostMember.error?.code).toBe('TEAM_REMOTE_PRINCIPAL_INVALID')
      const foreignMember = await call(world, {
        ...base,
        actor: { kind: 'member', member: { rootSessionId: 'session-a3p4r8foreign', instanceId: 'whatever' } },
      })
      expect(foreignMember.error?.code).toBe('TEAM_REMOTE_PRINCIPAL_INVALID')
      const leaderAsMember = await call(world, {
        ...base,
        actor: { kind: 'member', member: { rootSessionId: R7_ROOT, instanceId: LEADER_INSTANCE_ID } },
      })
      expect(leaderAsMember.error?.code).toBe('TEAM_REMOTE_PRINCIPAL_INVALID')
      const absent = await call(world, { ...base })
      expect(absent.ok, 'absent actor stays a typed malformed refusal (contract layer)').toBe(false)
      expect(absent.error?.code).toBe('malformed-params')
      expect(await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_WORKER })).toBeUndefined()
    } finally {
      await world.close()
    }
  })

  it('RPC-position symmetry of the ARCHIVED law: human claim over an ARCHIVED target commits (row exists) yet the REAL pre-execute plane still refuses', async () => {
    const world = await openR7World()
    const pre = installPreExecute(world, R7_ROOT, R7_ARCH, world.wsA)
    try {
      const archivedGrant = await call(world, {
        teamSessionId: R7_ROOT,
        memberInstanceId: R7_ARCH,
        kind: 'grant_instance',
        mutationId: 'r8-archived-grant',
        reason: 'r8 archived target mutates legally (RPC position)',
        actor: { kind: 'human' },
        rules: [
          {
            operationClass: 'write',
            matcher: { kind: 'exact', value: world.openKey },
            effect: 'allow',
          },
        ],
      })
      expect(archivedGrant.ok, JSON.stringify(archivedGrant.error ?? {})).toBe(true)
      expect(archivedGrant.value?.data?.['changed']).toBe(true)
      expect(await world.overlay.latest({ teamSessionId: R7_ROOT, memberInstanceId: R7_ARCH })).toBeDefined()
      const attempted = await pre.run('write', { file_path: world.openKey, content: 'x' })
      expect(attempted.kind, 'ARCHIVED never executes, whichever entry mutated the overlay').not.toBe('allow')
    } finally {
      pre.disposer()
      await world.close()
    }
  })
})
