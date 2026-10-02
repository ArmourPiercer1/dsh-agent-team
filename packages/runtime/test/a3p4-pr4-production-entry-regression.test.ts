/**
 * a3p4-pr4-production-entry-regression — the PR4 round-3 regression spec for
 * the PRODUCTION ENTRY (parent brief regressions (i), (iv), (v), (vi)).
 *
 * Pure-lane tests do NOT count for these blocks: every leg drives the REAL
 * assembled surface — the production root factory with the permission lane
 * wired, the REAL plugin host `apply()` bootstrap, and the REAL live glue
 * through the t12a bridge with a FILLED permission-plane ref.
 *
 * Pinned here:
 *
 *  E1  (i-root, BLOCK-1) the ROOT-ASSEMBLED governance lane consumes the
 *      injected identity-bound static-fact readers and the Leader's
 *      expansion envelope: an exact grant authored by the LEADER authority
 *      COMMITS and the decision plane then answers the overlay allow; an
 *      envelope region WITHOUT coverage refuses typed and writes NOTHING;
 *      UNKNOWN static facts refuse `EFFECT_CONTEXT_UNAVAILABLE` (never a
 *      guessed baseline).
 *  E1l (iv, BLOCK-4) the LEADER resolves LIVE for permission decisions over
 *      the real TeamSession row — v2 has NO leader member row by design, so
 *      the reader reuses the control service's authority semantics (leader
 *      live ⇔ TeamSession exists; member-row checks exclude the leader id).
 *      Member semantics stay byte-identical (ghosts still refuse
 *      `INSTANCE_UNKNOWN`).
 *  E2  (i-host, BLOCK-1 at the host entry) a real `apply()` boot of a row
 *      whose bound templates declare `capabilities.permissions` resolves the
 *      Leader's expansion ceiling from the bound Blueprint's EXPLICIT
 *      `permissionMutationEnvelope` carrier (round 4 — the round-3
 *      static-lane DERIVATION was the over-grant defect and is removed): the
 *      carrier authorizes exactly the covered region, the commit lands
 *      durably, and the assembled plane answers allow.
 *  E2f (vi, BLOCK-5) the durable permission authority is MANDATORY at the
 *      production entry: an injected failure of the durable overlay store
 *      turns the boot into a typed startup failure
 *      (`TEAM_PLUGIN_PERMISSION_AUTHORITY_UNAVAILABLE`) — never a warn-only
 *      posture that executes on static allow with the authority absent. The
 *      NEGATIVE control: a healthy world whose templates declare NO
 *      `capabilities.permissions` gains ZERO new startup failures and logs
 *      no permission-authority warning.
 *  E3  (v, BLOCK-5 decision side) the REAL `createAgentBindings` glue with a
 *      FILLED plane ref consumes the plane end-to-end: a persisted overlay
 *      DENY beats the template ALLOW through the real pre-execute pipeline
 *      (with the ref unfilled today the glue installs NO seam — this is the
 *      t12a blind spot the round-1 review caught).
 *
 * @module @dsh-agent-team/runtime/test/a3p4-pr4-production-entry-regression
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
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'
import * as hostEntry from '../src/plugin/host.js'
import { TEAM_PLUGIN_ERROR_CODES } from '../src/plugin/types.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import { createPermissionAuthorityFacts, type CanonicalKeyContains, type TeamPermissionPlane } from '../src/plugin/permission-plane.js'
import { PERMISSION_MUTATION_ERROR_CODES } from '../governance/permission-mutation.js'
import { PERMISSION_LIFECYCLE_ERROR_CODES } from '../permission-lifecycle/types.js'
import { createS6RemotePorts, createS6RemoteDispatcher } from '../src/plugin/s6-remote.js'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import { REMOTE_CONTRACT_VERSION_V7 } from '../../remote/src/index.js'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'
import { agentPresetsStandardDouble } from './agent-presets-double.mjs'
import { createAgentPresetsDouble, createLiveWorld } from './t12a-live-bridge.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const NOW = '2026-10-06T12:00:00.000Z'

/** Scratch worlds this file must leave no trace of. */
const openScratch: string[] = []

afterAll(() => {
  for (const dir of openScratch.splice(0)) {
    try {
      destroyDir(dir)
      rmSync(dir, { recursive: true, force: true })
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

// ══════════════════════════════════════════════════════════════════════════
// E1 — the root-assembled lane with the fact readers injected (BLOCK-1 + 4)
// ══════════════════════════════════════════════════════════════════════════

const ENTRY_ROOT = 'session-a3p4e1root'
const E1_WORKER = 'inst-a3p4e1worker'

const E1_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: A3P4E1-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the A3P4E1 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the A3P4E1 work.',
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
  '    description: The A3P4E1 default state.',
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

interface EntryWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wide production facade
  readonly root: any
  readonly plane: TeamPermissionPlane
  readonly overlay: PermissionOverlayRepositoryPort
  readonly scratch: string
  readonly targetKey: string
  close(): Promise<void>
}

/**
 * The root-assembled entry world: real TeamDomain + real overlay store +
 * the production root WITH the round-3 fact-reader deps:
 * `permissionStaticLayers` (worker template facts) and `permissionEnvelope`
 * (the Leader's expansion ceiling). These stand in for the SAME documents
 * the host resolves from the ADDRESSED team's bound snapshot (E2 pins that
 * resolution end-to-end; here the documents are hand-authored).
 */
async function openEntryWorld(): Promise<EntryWorld> {
  const base = scratchDir(`a3p4e1-${Math.random().toString(36).slice(2, 8)}`)
  openScratch.push(base)
  destroyDir(base)
  const targetKey = `${base}/workspace/src/a.ts`
  mkdirSync(`${base}/workspace/src`, { recursive: true })

  const seam = new FileStorageSeam(base)
  const domain = await createTeamDomain(seam)
  await domain.repositories.teamSessions.put({
    rootSessionId: parseRootSessionId(ENTRY_ROOT),
    blueprint: createBlueprintSnapshotRef({
      blueprintId: parseBlueprintId('A3P4E1-BP'),
      revision: parseBlueprintRevision('1'),
      contentHash: parseBlueprintContentHash(`sha256:${'9'.repeat(64)}`),
    }),
    defaultWorkspace: `${base}/workspace`,
    createdAt: NOW,
    generation: 1,
  })
  await domain.repositories.memberInstances.put({
    rootSessionId: parseRootSessionId(ENTRY_ROOT),
    instanceId: parseInstanceId(E1_WORKER),
    templateId: parseTemplateId('worker'),
    label: 'a3p4e1 worker',
    childSessionId: parseChildSessionId('session-child-a3p4e1worker'),
    lifecycle: 'SETTLED',
    createdAt: NOW,
    activityVersion: 1,
  })

  const overlayStore = await openPermissionOverlayStore(new FileStorageSeam(base))
  const overlay = createPermissionOverlayRepositoryPort({ repository: overlayStore.repository })

  const config = {
    bootPhase: 'create' as const,
    rootSessionId: ENTRY_ROOT,
    blueprintSource: E1_BLUEPRINT,
    generation: 1,
    defaultWorkspace: `${base}/workspace`,
    seedMembers: [],
    staticModel: { provider: 'a3p4e1', model: 'a3p4e1-model' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const teamToolsRef = { current: undefined }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub glue surface
  const live: any = createStubBindings({ config, teamToolsRef, domain })
  const permissionPlaneRef: { current: TeamPermissionPlane | undefined } = { current: undefined }

  const root = createTeamProductionRoot({
    config,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- real TeamDomain facade
    domain: domain as any,
    storageSeam: seam,
    live,
    now: () => NOW,
    teamToolsRef,
    controlServiceRef: { current: undefined },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unused legacy reader
    legacyInspect: (() => {
      throw new Error('a3p4e1 world: legacy inspect is unused')
    }) as any,
    permissionOverlay: overlay,
    fsContainsKeys: makeContainKeys(),
    permissionPlaneRef,
    // ── production-injection shape (the host resolves the SAME documents from
    // the addressed team's bound snapshot; here they are hand-authored) ──
    permissionEnvelope: () => ({
      rules: [
        {
          operationClass: 'write',
          matcher: { kind: 'exact', resource: targetKey },
          maximumEffect: 'allow',
        },
      ],
    }),
    permissionStaticLayers: (_teamSessionId: string, memberInstanceId: string) =>
      memberInstanceId === E1_WORKER
        ? {
            layers: [
              {
                label: 'worker',
                default: 'deny' as const,
                rules: [],
              },
            ],
          }
        : undefined,
  })

  const plane = permissionPlaneRef.current
  if (plane === undefined) throw new Error('the production root did not fill the permission plane reference')

  return {
    root,
    plane,
    overlay,
    scratch: base,
    targetKey,
    async close() {
      await overlayStore.close().catch(() => undefined)
      await domain.close()
      destroyDir(base)
      rmSync(base, { recursive: true, force: true })
      const at = openScratch.indexOf(base)
      if (at >= 0) openScratch.splice(at, 1)
    },
  }
}

describe('E1 — the root-assembled lane consumes the fact readers and the leader liveness (BLOCK-1 + BLOCK-4)', () => {
  it('the LEADER resolves LIVE for a decision over the real TeamSession (no member row exists for the leader — v2 design)', async () => {
    const world = await openEntryWorld()
    try {
      const decision = (await world.plane.decisions.decide({
        teamSessionId: ENTRY_ROOT,
        memberInstanceId: 'inst-leader',
        operation: {
          tool: 'write',
          resource: { kind: 'file', key: world.targetKey, display: world.targetKey },
          fingerprint: `sha256:${'a'.repeat(64)}`,
        },
        staticFacts: {
          template: {
            label: 'leader',
            default: 'deny',
            rules: {
              allow: [{ tool: 'write', resource: { kind: 'exact', key: world.targetKey } }],
              ask: [],
              deny: [],
            },
          },
        },
      })) as { kind: string; code?: string; effect?: string }
      // Today: refused EXECUTION_STATE_UNKNOWN (the reader reads member rows
      // blindly and v2 never seeds a leader row).
      expect(decision.kind, `leader decision refused: ${decision.code ?? 'n/a'}`).toBe('effective')
      expect(decision.effect).toBe('allow')
    } finally {
      await world.close()
    }
  })

  it('member semantics unchanged: a ghost instance still refuses INSTANCE_UNKNOWN', async () => {
    const world = await openEntryWorld()
    try {
      const decision = (await world.plane.decisions.decide({
        teamSessionId: ENTRY_ROOT,
        memberInstanceId: 'inst-a3p4e1ghost',
        operation: {
          tool: 'read',
          resource: { kind: 'file', key: world.targetKey, display: world.targetKey },
          fingerprint: `sha256:${'b'.repeat(64)}`,
        },
        staticFacts: {
          template: { label: 'worker', default: 'deny', rules: { allow: [], ask: [], deny: [] } },
        },
      })) as { kind: string; code?: string }
      expect(decision.kind).toBe('refused')
      // Member semantics are BYTE-IDENTICAL through the fix: the decision
      // gate keeps answering with its own closed code for an unknown member
      // row (`EXECUTION_STATE_UNKNOWN`); the leader reclassification below
      // must never touch member paths.
      expect(decision.code).toBe(PERMISSION_LIFECYCLE_ERROR_CODES.EXECUTION_STATE_UNKNOWN)
    } finally {
      await world.close()
    }
  })

  it('a LEADER exact grant inside the injected envelope COMMITS at the assembled root and the plane answers the overlay allow (BLOCK-1)', async () => {
    const world = await openEntryWorld()
    try {
      const result = (await world.root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: ENTRY_ROOT,
        memberInstanceId: E1_WORKER,
        kind: 'grant_instance',
        mutationId: 'mut-a3p4e1-exact',
        reason: 'leader expands the worker inside its own bound allow lane',
        rules: [
          { operationClass: 'write', matcher: { kind: 'exact', resource: world.targetKey }, effect: 'allow' },
        ],
      })) as { changed?: boolean; reason?: string; code?: string }
      expect(result.changed, `leader expansion refused: ${result.code ?? result.reason ?? 'n/a'}`).toBe(true)

      const decision = (await world.plane.decisions.decide({
        teamSessionId: ENTRY_ROOT,
        memberInstanceId: E1_WORKER,
        operation: {
          tool: 'write',
          resource: { kind: 'file', key: world.targetKey, display: world.targetKey },
          fingerprint: `sha256:${'c'.repeat(64)}`,
        },
        staticFacts: {
          template: { label: 'worker', default: 'deny', rules: { allow: [], ask: [], deny: [] } },
        },
      })) as { kind: string; effect?: string }
      expect(decision.kind).toBe('effective')
      expect(decision.effect).toBe('allow')
    } finally {
      await world.close()
    }
  })

  it('NEGATIVE: an envelope region WITHOUT coverage refuses typed EXPANSION_DENIED and writes nothing', async () => {
    const world = await openEntryWorld()
    try {
      const error = await world.root.mutation.governance
        .mutatePermission({
          authority: { kind: 'leader' },
          teamSessionId: ENTRY_ROOT,
          memberInstanceId: E1_WORKER,
          kind: 'grant_instance',
          mutationId: 'mut-a3p4e1-outside',
          reason: 'outside every envelope rule',
          rules: [
            {
              operationClass: 'write',
              matcher: { kind: 'exact', resource: `${world.scratch}/elsewhere/x.ts` },
              effect: 'allow',
            },
          ],
        })
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      const code = (error as { code?: string })?.code
      expect(typeof code === 'string' ? code : JSON.stringify(error)).toContain(
        PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE,
      )
      // Nothing was written: the target keeps NO overlay authority.
      expect(await world.overlay.latest({ teamSessionId: ENTRY_ROOT, memberInstanceId: E1_WORKER })).toBeUndefined()
    } finally {
      await world.close()
    }
  })

  it('UNKNOWN static facts refuse EFFECT_CONTEXT_UNAVAILABLE (never a guessed baseline)', async () => {
    // A world whose reader abstains on every instance (UNKNOWN, not
    // DECLARED-NONE): the leader expansion must refuse typed.
    const world = await openEntryWorld()
    try {
      const error = await world.root.mutation.governance
        .mutatePermission({
          authority: { kind: 'leader' },
          teamSessionId: ENTRY_ROOT,
          memberInstanceId: 'inst-a3p4e1ghost',
          kind: 'grant_instance',
          mutationId: 'mut-a3p4e1-unknown',
          reason: 'facts unknown for this target',
          rules: [
            { operationClass: 'write', matcher: { kind: 'exact', resource: world.targetKey }, effect: 'allow' },
          ],
        })
        .then(() => undefined)
        .catch((caught: unknown) => caught)
      const rendered = JSON.stringify(error ?? {})
      expect(rendered + String((error as { code?: string })?.code ?? '')).toContain(
        PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
      )
    } finally {
      await world.close()
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════
// E2 — the REAL host entry (apply()): addressed carrier facts + mandatory authority
// ══════════════════════════════════════════════════════════════════════════

const HOST_ROOT = 'session-a3p4e2root'
const HOST_WORKER_CHILD = 'session-child-a3p4e2worker'

/** The host blueprint: BOTH templates declare capabilities.permissions —
 *  the leader carries the ALLOW lane matching the expansion test targets,
 *  and the blueprint carries the EXPLICIT `permissionMutationEnvelope`
 *  carrier for it (round 4: the ceiling is the carrier, never a derivation
 *  of the static lane). This fixture uses ABSOLUTE paths, where the target
 *  member's canonicalization basis and any other anchor trivially agree;
 *  the round-4 relative-rule divergence legs pin that rule matchers are
 *  canonicalized at the TARGET member's effective workspace (round-3's
 *  row-anchor was BLOCK-3). `withPermissions: false` strips every
 *  permissions block AND the carrier (the legacy alpha.1/alpha.2 world —
 *  the NEGATIVE control). */
function hostBlueprintSource(leaderAllowPath: string, withPermissions: boolean): string {
  const leaderPerms = withPermissions
    ? [
        '    permissions:',
        '      default: deny',
        '      allow:',
        '        - tool: write',
        '          resource:',
        '            kind: exact',
        `            path: "${leaderAllowPath}"`,
        '      ask: []',
        '      deny: []',
      ]
    : []
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: A3P4E2-BP',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: You lead the A3P4E2 team.',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_send_message',
    '        - team_list_members',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    ...(withPermissions
      ? [
          '    permissions:',
          '      default: deny',
          '      allow:',
          '        - tool: write',
          '          resource:',
          '            kind: exact',
          `            path: "${leaderAllowPath}"`,
          '      ask: []',
          '      deny: []',
        ]
      : []),
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    '    persona: You do the A3P4E2 work.',
    ...(withPermissions
      ? [
          '    capabilities:',
          '      teamTools:',
          '        kind: allow',
          '        items:',
          '          - team_send_message',
          '      builtinToolDeny: []',
          '      skills:',
          '        kind: allow',
          '        items: []',
          '      mcp:',
          '        kind: allow',
          '        items: []',
          '      permissions:',
          '        default: deny',
          '        allow: []',
          '        ask: []',
          '        deny: []',
        ]
      : []),
    'teamEnvelope:',
    '  allow:',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '    - archive-member',
    '    - restore-member',
    '  deny: []',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '      deny: []',
    // PR4 round 4: the Leader's §6 expansion ceiling is the EXPLICIT config
    // carrier (the round-3 derivation that COPIED the leader's static ALLOW
    // lane into the envelope is removed — it swallowed deny/ask exceptions).
    // A row whose leader may expand MUST declare the carrier; withPermissions
    // = false stays carrier-free (the legacy world, byte-identical).
    ...(withPermissions
      ? [
          'permissionMutationEnvelope:',
          '  rules:',
          '    - operationClass: write',
          '      matcher:',
          '        kind: exact',
          `        path: "${leaderAllowPath}"`,
          '      maximumEffect: allow',
        ]
      : []),
    'policyStates:',
    '  - id: default',
    '    description: The A3P4E2 default state.',
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
}

interface HostWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface
  readonly provided: Record<string, any>
  readonly scratch: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface
  apply(config: Record<string, any>): Promise<{ root: any; warnings: string[] }>
  dispose(): Promise<void>
}

/** The p8s5a-proven host world: the entry's ONLY input channel is the ctx
 *  doubles + the row config. `seamFactory` lets a leg inject a FAULTY seam
 *  (the durable permission-authority store fault of E2f). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- seam factory returns the seam (possibly wrapped)
function makeHostWorld(seamFactory: (base: string) => any): HostWorld {
  const base = scratchDir(`a3p4e2-${Math.random().toString(36).slice(2, 8)}`)
  openScratch.push(base)
  destroyDir(base)
  mkdirSync(`${base}/workspace`, { recursive: true })
  const seam = seamFactory(base)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double)
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    workspaceRegistry: { list: () => [], resolveByPath: async () => undefined },
    teamStorageSeam: seam,
    agentPresets: agentPresetsStandardDouble(),
    // The fs public service double (host-authorized key convention: PLAIN
    // absolute keys — matching the row's workspace layout). A
    // permissions-bearing row consults it for the authority-facts
    // canonicalization (post-boot); a permissions-free world never calls it.
    fs: {
      resolve: async (path: string, options?: { cwd?: string }) => {
        const joined = path.startsWith('/') ? path : resolve(options?.cwd ?? base, path)
        return { targetKey: joined, displayPath: joined }
      },
      contains: (parent: unknown, child: unknown) => {
        const p = (parent as { targetKey?: string }).targetKey ?? ''
        const c = (child as { targetKey?: string }).targetKey ?? ''
        const rel = relative(resolve(p), resolve(c))
        return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
      },
    },
  }
  const effectDisposers: Array<() => void> = []
  const warnings: string[] = []
  const originalWarn = console.warn
  const originalError = console.error
  return {
    provided,
    scratch: base,
    async apply(config) {
      const ctx = {
        get: (name: string) => provided[name],
        provide: (name: string, value: unknown) => {
          provided[name] = value
        },
        effect: (factory: () => () => void, _label?: string) => {
          effectDisposers.push(factory())
        },
      }
      console.warn = (...args: unknown[]) => {
        warnings.push(args.map(String).join(' '))
      }
      console.error = (...args: unknown[]) => {
        warnings.push(args.map(String).join(' '))
      }
      try {
        await (hostEntry as unknown as { apply: (c: unknown, cfg: unknown) => Promise<void> }).apply(ctx, config)
        const teamRoot = provided['teamRoot'] as { ready: Promise<unknown> } | undefined
        if (teamRoot === undefined) throw new Error('apply resolved but never provided teamRoot')
        const root = await teamRoot.ready
        return { root, warnings }
      } finally {
        console.warn = originalWarn
        console.error = originalError
      }
    },
    async dispose() {
      for (const dispose of effectDisposers.splice(0)) {
        try {
          dispose()
        } catch {
          /* best effort */
        }
      }
      try {
        await seam.closeAll?.()
      } catch {
        /* best effort */
      }
      destroyDir(base)
      rmSync(base, { recursive: true, force: true })
      const at = openScratch.indexOf(base)
      if (at >= 0) openScratch.splice(at, 1)
    },
  }
}

function hostRowConfig(blueprintSource: string, defaultWorkspace: string) {
  return {
    bootPhase: 'create',
    rootSessionId: HOST_ROOT,
    blueprintSource,
    generation: 1,
    remoteMountWaitMs: 0,
    defaultWorkspace,
    seedMembers: [
      {
        instanceId: 'inst-a3p4e2worker',
        templateId: 'worker',
        label: 'e2 worker',
        childSessionId: HOST_WORKER_CHILD,
      },
    ],
    staticModel: { provider: 'a3p4e2', model: 'a3p4e2-model' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
  }
}

describe('E2 — the REAL host entry resolves the addressed facts and treats the authority as mandatory (BLOCK-1 host + BLOCK-5)', () => {
  it('a booted permissions row lets the LEADER expansion commit through the CONFIGURED carrier envelope and the plane answers allow (i-host)', async () => {
    const world = makeHostWorld((base) => new FileStorageSeam(base))
    try {
      const target = `${world.scratch}/workspace/ledger-out.tsv`
      const { root } = await world.apply(
        hostRowConfig(hostBlueprintSource(target, true), `${world.scratch}/workspace`),
      )
      const result = (await root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-a3p4e2-carrier',
        reason: 'leader grants inside its configured carrier ceiling',
        rules: [
          { operationClass: 'write', matcher: { kind: 'exact', resource: target }, effect: 'allow' },
        ],
      })) as { changed?: boolean; code?: string; reason?: string }
      expect(
        result.changed,
        `host carrier expansion refused: ${result.code ?? result.reason ?? 'n/a'}`,
      ).toBe(true)

      const plane = root['permissionPlane'] as TeamPermissionPlane | undefined
      expect(plane, 'the assembled root exposes the permission plane').toBeDefined()
      const decision = (await plane!.decisions.decide({
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        operation: {
          tool: 'write',
          resource: { kind: 'file', key: target, display: target },
          fingerprint: `sha256:${'7'.repeat(64)}`,
        },
        staticFacts: {
          template: { label: 'worker', default: 'deny', rules: { allow: [], ask: [], deny: [] } },
        },
      })) as { kind: string; effect?: string }
      expect(decision.kind).toBe('effective')
      expect(decision.effect).toBe('allow')
    } finally {
      await world.dispose()
    }
  })

  it('store-open failure at apply(): typed startup failure, never a warn-only boot (BLOCK-5, fail-open closed)', async () => {
    // A seam whose `permission_overlays` table FAULTS on every row access
    // (the durable permission authority cannot be read). The templates
    // declare capabilities.permissions — the authority is MANDATORY.
    const world = makeHostWorld((base) => {
      const seam = new FileStorageSeam(base)
      const realOpen = seam.open.bind(seam)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- seam wrapper
      ;(seam as any).open = async (spec: any) => {
        const handle = await realOpen(spec)
        const realTable = handle.table.bind(handle)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- seam wrapper
        ;(handle as any).table = (name: string) => {
          const table = realTable(name)
          if (name !== 'permission_overlays') return table
          const fault = (): never => {
            throw new Error('injected permission_overlays store fault')
          }
          return new Proxy(table as object, {
            get(target, prop, receiver) {
              if (prop === 'size') return Reflect.get(target, prop, receiver)
              const value = Reflect.get(target, prop, receiver)
              if (typeof value === 'function') return fault
              return value
            },
          })
        }
        return handle
      }
      return seam
    })
    try {
      const target = `${world.scratch}/workspace/must-not-run.txt`
      let rejection: unknown = null
      let booted = false
      try {
        await world.apply(hostRowConfig(hostBlueprintSource(target, true), `${world.scratch}/workspace`))
        booted = true
      } catch (caught) {
        rejection = caught
      }
      // Today (BLOCK-5): the boot RESOLVES (warn-only posture) — the row's
      // agents then execute on static allow with the authority absent.
      expect(booted, 'the boot must NOT succeed when the durable permission authority cannot be read').toBe(false)
      const code = (rejection as { code?: string } | null)?.code
      expect(String(code)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_PERMISSION_AUTHORITY_UNAVAILABLE)
    } finally {
      await world.dispose()
    }
  })

  it('NEGATIVE CONTROL: a healthy no-permissions world gains ZERO new startup failures and no permission warning', async () => {
    const world = makeHostWorld((base) => new FileStorageSeam(base))
    try {
      const { root, warnings } = await world.apply(
        hostRowConfig(hostBlueprintSource(`${world.scratch}/unused.txt`, false), `${world.scratch}/workspace`),
      )
      expect(root, 'the no-permissions world boots green').toBeTruthy()
      const permissionWarns = warnings.filter((row) => /permission/i.test(row))
      expect(permissionWarns, `unexpected permission warnings: ${JSON.stringify(permissionWarns)}`).toHaveLength(0)
    } finally {
      await world.dispose()
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════
// E3 — the REAL live glue with a FILLED plane ref (BLOCK-5 decision side)
// ══════════════════════════════════════════════════════════════════════════

const GLUE_ROOT = 'session-a3p4e3root'
const GLUE_CHILD = 'session-a3p4e3child-a'
const GLUE_INST = 'inst-a3p4e3a'

/** The E3 blueprint: tpl-a worker carries a static ALLOW (exact, ABSOLUTE
 *  target) which the persisted overlay deny must beat; without the allow
 *  lane the leg would deny for the wrong reason. */
function glueBlueprintSource(targetKey: string): string {
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: team.a3p4e3',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "You are the leader of the a3p4e3 test team."',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_send_message',
    '        - team_list_members',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: deny',
    '      allow: []',
    '      ask: []',
    '      deny: []',
    'members:',
    '  - templateId: tpl-a',
    '    persona: "You are member A of the a3p4e3 test team."',
    '    capabilities:',
    '      teamTools:',
    '        kind: allow',
    '        items:',
    '          - team_send_message',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: deny',
    '        allow:',
    '          - tool: write',
    '            resource:',
    '              kind: exact',
    `              path: "${targetKey}"`,
    '        ask: []',
    '        deny:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    'policyStates: []',
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
}

/** Drive the installed glue listener once; returns the decision + the
 *  next-call count (1 == the tool executed). */
async function driveOnce(
  listener: { listener: (exec: unknown, next: () => Promise<unknown>) => Promise<unknown> },
  callId: string,
  targetKey: string,
): Promise<{ kind: string; reason?: string; nextCalls: number }> {
  let nextCalls = 0
  const decision = (await listener.listener(
    {
      callId,
      name: 'write',
      arguments: { file_path: targetKey, content: 'probe' },
      signal: new AbortController().signal,
    },
    async () => {
      nextCalls += 1
      return { kind: 'allow' }
    },
  )) as { kind: string; reason?: string }
  return { ...decision, nextCalls }
}

describe('E3 — the REAL createAgentBindings consumes a FILLED plane ref (BLOCK-5 decision side, t12a blind spot)', () => {
  it('a persisted overlay DENY beats the template ALLOW through the real glue pipeline', async () => {
    // The durable plane world for the SAME root sid + member row: the glue
    // decisions address this REAL domain through the production plane.
    const base = scratchDir(`a3p4e3-${Math.random().toString(36).slice(2, 8)}`)
    openScratch.push(base)
    destroyDir(base)
    mkdirSync(`${base}/workspace`, { recursive: true })
    const targetKey = `${base}/workspace/notes.md`
    const seam = new FileStorageSeam(base)
    const domain = await createTeamDomain(seam)
    await domain.repositories.teamSessions.put({
      rootSessionId: parseRootSessionId(GLUE_ROOT),
      blueprint: createBlueprintSnapshotRef({
        blueprintId: parseBlueprintId('team.a3p4e3'),
        revision: parseBlueprintRevision('1'),
        contentHash: parseBlueprintContentHash(`sha256:${'8'.repeat(64)}`),
      }),
      defaultWorkspace: `${base}/workspace`,
      createdAt: NOW,
      generation: 1,
    })
    await domain.repositories.memberInstances.put({
      rootSessionId: parseRootSessionId(GLUE_ROOT),
      instanceId: parseInstanceId(GLUE_INST),
      templateId: parseTemplateId('tpl-a'),
      label: 'a3p4e3 member A',
      childSessionId: parseChildSessionId(GLUE_CHILD),
      lifecycle: 'RUNNING',
      createdAt: NOW,
      activityVersion: 1,
    })
    const overlayStore = await openPermissionOverlayStore(new FileStorageSeam(base))
    const overlay = createPermissionOverlayRepositoryPort({ repository: overlayStore.repository })
    const config = {
      bootPhase: 'create' as const,
      rootSessionId: GLUE_ROOT,
      blueprintSource: glueBlueprintSource(targetKey),
      generation: 1,
      defaultWorkspace: `${base}/workspace`,
      seedMembers: [],
      staticModel: { provider: 'a3p4e3', model: 'a3p4e3-model' },
      deniedSelection: null,
      mcpServer: null,
      environmentFacts: [],
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
    }
    const teamToolsRef = { current: undefined }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub glue surface
    const live: any = createStubBindings({ config, teamToolsRef, domain })
    const permissionPlaneRef: { current: TeamPermissionPlane | undefined } = { current: undefined }
    const planeRoot = createTeamProductionRoot({
      config,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- real TeamDomain facade
      domain: domain as any,
      storageSeam: seam,
      live,
      now: () => NOW,
      teamToolsRef,
      controlServiceRef: { current: undefined },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unused legacy reader
      legacyInspect: (() => {
        throw new Error('a3p4e3 world: legacy inspect is unused')
      }) as any,
      permissionOverlay: overlay,
      fsContainsKeys: makeContainKeys(),
      permissionPlaneRef,
    })
    void planeRoot
    const plane = permissionPlaneRef.current
    if (plane === undefined) throw new Error('the a3p4e3 root did not fill the plane reference')

    try {
      // The live-glue world (REAL agent-bindings.mjs through the t12a
      // bridge), with the bridge's NEW permissionPlaneRef passthrough and
      // the control-service ref filled (permission installs require it).
      const spyControl = {
        requestControl: async () => ({ request: { requestId: 'e3-spy' } }),
        resolveControl: async () => ({}),
        awaitControlDecision: async () => ({ status: 'decided', decision: 'deny' }),
        listControlState: async () => ({ requests: [], decisions: [], consumptions: [], abandonments: [] }),
        guardOperation: async () => ({ allowed: true }),
        checkExternalOperation: async () => ({ allowed: true }),
      }
      const glueWorld = await createLiveWorld({
        rootSessionId: GLUE_ROOT,
        teamTools: { tools: [{ name: 'team_send_message' }, { name: 'team_list_members' }] },
        agentPresets: createAgentPresetsDouble(),
        controlServiceRef: { current: spyControl },
        // The NEW bridge pass-through (round-3): the host hands the glue
        // this same ref; a test fills it with the assembled plane.
        permissionPlaneRef,
        members: [{ childSessionId: GLUE_CHILD, instanceId: GLUE_INST, templateId: 'tpl-a' }],
        configOverrides: {
          bootPhase: 'create',
          blueprintSource: glueBlueprintSource(targetKey),
          seedMembers: [
            { instanceId: GLUE_INST, templateId: 'tpl-a', label: 'Member A', childSessionId: GLUE_CHILD },
          ],
        },
      })
      await glueWorld.binding.boot()
      const ctxA = (glueWorld.agents.handles.get(GLUE_CHILD) as { agent: { ctx: any } }).agent.ctx
      const listener = ctxA.listeners.find(
        (l: { event: string; active: boolean }) => l.event === 'tools/pre-execute' && l.active,
      ) as { listener: (exec: unknown, next: () => Promise<unknown>) => Promise<unknown> }
      expect(listener, 'the glue installed the pre-execute listener on tpl-a').toBeDefined()

      // CONTROL (key identity): with NO overlay row the template ALLOW
      // executes through the real glue (proves the canonical key of the
      // fake-fs target equals the granted key — the deny below then can
      // only come from the plane).
      const control = await driveOnce(listener, 'e3-call-control', targetKey)
      expect(
        control.nextCalls,
        `the static allow must execute with no overlay present (control: ${JSON.stringify(control)})`,
      ).toBe(1)

      // Persist the overlay DENY over the worker's static allow (operator
      // mutation through the production lane).
      const granted = await plane.mutation.grantInstance({
        authority: { kind: 'operator' },
        teamSessionId: GLUE_ROOT,
        memberInstanceId: GLUE_INST,
        mutationId: `mut-e3-${Math.random().toString(36).slice(2, 8)}`,
        reason: 'e3 pins the glue consuming the plane',
        rules: [
          // Overlay rules store CANONICAL keys — the glue world's fake fs
          // canonicalizes to `file://` URIs (the a6a key convention), so the
          // granted matcher speaks the SAME canonical text the decision
          // region carries (the CONTROL drive above proved this is the key
          // the template ALLOW matches on).
          { operationClass: 'write', matcher: { kind: 'exact', resource: `file://${targetKey}` }, effect: 'deny' },
        ],
      })
      expect((granted as { changed?: boolean }).changed).toBe(true)

      // The overlay grant above stands — the glue (with the plane ref
      // FILLED) must beat the template allow with the persisted deny.
      const denied = await driveOnce(listener, 'e3-call-deny', targetKey)
      expect(
        denied.nextCalls,
        `the glue executed despite the persisted overlay deny (decision: ${JSON.stringify(denied)})`,
      ).toBe(0)
      expect(denied.kind).toBe('deny')
      expect(String(denied.reason)).toContain('permission denied')
      // The deny is the MERGED overlay answer (the explanation names the
      // plane), not the static lane answering for itself.
      expect(String(denied.reason).toLowerCase()).toContain('overlay')
      glueWorld.binding.close()
    } finally {
      await overlayStore.close().catch(() => undefined)
      await domain.close()
      destroyDir(base)
      rmSync(base, { recursive: true, force: true })
      const at = openScratch.indexOf(base)
      if (at >= 0) openScratch.splice(at, 1)
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════
// R4 — round 4 at the REAL host entry: the carrier is the ceiling (never a
// derivation), exec fingerprints reach ALLOW end-to-end (BLOCK-1), the
// leader's deny exceptions survive (BLOCK-4), file matchers canonicalize at
// the target member's workspace (BLOCK-3), and a warm-up fault recovers
// lazily without ever hard-failing unrelated reads (GAP3).
// ══════════════════════════════════════════════════════════════════════════

interface R4Blueprint {
  readonly leaderWrite?: { readonly kind: 'exact' | 'subtree'; readonly path: string; readonly effect: 'allow' | 'deny' }[]
  readonly leaderBashAnyAllow?: boolean
  readonly workerBashDenyAny?: boolean
  readonly carrier?: readonly string[]
}

function r4BlueprintSource(opts: R4Blueprint): string {
  const laneLines = (effect: 'allow' | 'deny'): string[] => {
    const lines: string[] = []
    for (const rule of opts.leaderWrite ?? []) {
      if (rule.effect !== effect) continue
      lines.push(
        '        - tool: write',
        '          resource:',
        `            kind: ${rule.kind}`,
        `            path: "${rule.path}"`,
      )
    }
    return lines
  }
  const allowRules = laneLines('allow')
  if (opts.leaderBashAnyAllow === true) {
    allowRules.push('        - tool: bash', '          resource:', '            kind: any')
  }
  const denyRules = laneLines('deny')
  const denyBash = opts.workerBashDenyAny === true
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: A3P4R4-BP',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: You lead the A3P4R4 team.',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items: [team_send_message, team_list_members]',
    '    builtinToolDeny: []',
    '    skills: { kind: allow, items: [] }',
    '    mcp: { kind: allow, items: [] }',
    '    permissions:',
    '      default: deny',
    ...(allowRules.length === 0 ? ['      allow: []'] : ['      allow:', ...allowRules]),
    '      ask: []',
    ...(denyRules.length === 0 ? ['      deny: []'] : ['      deny:', ...denyRules]),
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    '    persona: You do the A3P4R4 work.',
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
    ...(denyBash
      ? ['        deny:', '          - tool: bash', '            resource:', '              kind: any']
      : ['        deny: []']),
    ...(opts.carrier ?? []),
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
    '    description: The A3P4R4 default state.',
    'quotas:',
    '  team: { maxInstances: 4, maxConcurrent: 4 }',
    '  members: { maxInstances: 2, maxConcurrent: 2 }',
    'metadata: {}',
    '---',
  ].join('\n')
}

function carrierYaml(
  entries: readonly {
    readonly operationClass: string
    readonly kind: 'exact' | 'subtree' | 'fingerprint'
    readonly value: string
    readonly maximumEffect: 'allow' | 'ask'
  }[],
): string[] {
  const lines = ['permissionMutationEnvelope:', '  rules:']
  for (const rule of entries) {
    lines.push(
      `    - operationClass: ${rule.operationClass}`,
      '      matcher:',
      `        kind: ${rule.kind}`,
      rule.kind === 'fingerprint'
        ? `        fingerprint: "${rule.value}"`
        : `        path: "${rule.value}"`,
      `      maximumEffect: ${rule.maximumEffect}`,
    )
  }
  return lines
}

const FP_A = `sha256:${'a'.repeat(64)}`
const FP_B = `sha256:${'b'.repeat(64)}`


/** mutatePermission REFUSES by THROWING the typed PermissionMutationError
 *  (the E1 idiom: `.catch((caught) => caught)`); normalize both outcomes. */
async function settleMutation(run: Promise<unknown>): Promise<{ changed?: boolean; code?: string; reason?: string }> {
  try {
    return (await run) as { changed?: boolean }
  } catch (error) {
    const e = error as { code?: string; message?: string }
    return { changed: false, code: String(e.code ?? ''), reason: String(e.message ?? '') }
  }
}

describe('R4 — round-4 carrier semantics at the REAL host entry (BLOCK-1/3/4 + GAP3)', () => {
  it('R4-exec — a configured bash-fingerprint carrier reaches ALLOW through the real boot (BLOCK-1 unreachable no more)', async () => {
    const world = makeHostWorld((base) => new FileStorageSeam(base))
    try {
      const source = r4BlueprintSource({
        leaderBashAnyAllow: true,
        workerBashDenyAny: true,
        carrier: carrierYaml([{ operationClass: 'bash', kind: 'fingerprint', value: FP_A, maximumEffect: 'allow' }]),
      })
      const { root } = await world.apply(hostRowConfig(source, `${world.scratch}/workspace`))
      const granted = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r4-exec-allow',
        reason: 'exec expansion through the explicit fingerprint carrier',
        rules: [{ operationClass: 'bash', matcher: { kind: 'fingerprint', resource: FP_A }, effect: 'allow' }],
      }))
      expect(
        granted.changed,
        `configured exec carrier refused: ${granted.code ?? granted.reason ?? 'n/a'}`,
      ).toBe(true)
      // OVER-CEILING: a DIFFERENT fingerprint has no carrier rule — refused,
      // while the world keeps serving everything else (no hard fail).
      const over = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r4-exec-over',
        reason: 'uncarriered exec fingerprint must refuse',
        rules: [{ operationClass: 'bash', matcher: { kind: 'fingerprint', resource: FP_B }, effect: 'allow' }],
      }))
      expect(over.changed).not.toBe(true)
      expect(String(over.code)).toContain('EXPANSION_DENIED')
      // …and a TIGHTENING exec revoke-ask stays legal envelope-free (ADR §6).
      const tighten = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r4-exec-tighten',
        reason: 'tightening needs no envelope',
        rules: [{ operationClass: 'bash', matcher: { kind: 'fingerprint', resource: FP_B }, effect: 'deny' }],
      }))
      expect(tighten.changed, `tightening refused: ${tighten.code ?? 'n/a'}`).toBe(true)
    } finally {
      await world.dispose()
    }
  })

  it('R4-ceiling — an ASK carrier ceiling refuses the ALLOW grant and accepts the ASK grant (ladder-strict at host apply)', async () => {
    const world = makeHostWorld((base) => new FileStorageSeam(base))
    try {
      const target = `${world.scratch}/workspace/ask-ceiling.txt`
      const source = r4BlueprintSource({
        leaderWrite: [{ kind: 'exact', path: target, effect: 'allow' }],
        carrier: carrierYaml([{ operationClass: 'write', kind: 'exact', value: target, maximumEffect: 'ask' }]),
      })
      const { root } = await world.apply(hostRowConfig(source, `${world.scratch}/workspace`))
      const overGrant = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r4-ask-over',
        reason: 'allow over an ask ceiling',
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: target }, effect: 'allow' }],
      }))
      expect(overGrant.changed).not.toBe(true)
      expect(String(overGrant.code)).toContain('EXPANSION_DENIED')
      const legal = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r4-ask-legal',
        reason: 'deny->ask is legal under the ask ceiling',
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: target }, effect: 'ask' }],
      }))
      expect(legal.changed, `legal ask grant refused: ${legal.code ?? 'n/a'}`).toBe(true)
    } finally {
      await world.dispose()
    }
  })

  it('R5-derive — (round-5 INVERSION of R4-derive) carrier subtree covering the member grant COMMITS while the LEADER\'s own answer stays DENY (no ceiling gate; no self-widening)', async () => {
    const world = makeHostWorld((base) => new FileStorageSeam(base))
    try {
      const openPath = `${world.scratch}/workspace/open.txt`
      const secretPath = `${world.scratch}/workspace/secret.txt`
      const source = r4BlueprintSource({
        leaderWrite: [
          { kind: 'subtree', path: `${world.scratch}/workspace`, effect: 'allow' },
          { kind: 'exact', path: secretPath, effect: 'deny' },
        ],
        carrier: carrierYaml([
          { operationClass: 'write', kind: 'exact', value: openPath, maximumEffect: 'allow' },
          { operationClass: 'write', kind: 'exact', value: secretPath, maximumEffect: 'allow' },
        ]),
      })
      const { root } = await world.apply(hostRowConfig(source, `${world.scratch}/workspace`))
      // The Ruled positive regression (parent FIX-1 + R-A discriminator at
      // ENTRY level): the leader's OWN effective answer at the secret is
      // DENY (its template denies the exception), the carrier EXPLICITLY
      // permits the member expansion there — so the grant is LEGAL and
      // COMMITS. Round 4's ceiling fold refused this shape (and mislabeled
      // the refusal expansion-region-uncovered); the parent's final review
      // removed the fold: the carrier is the whole §6 expansion policy.
      const secret = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r5-derive-secret',
        reason: 'carrier permits what the leader itself denies — legal member expansion',
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: secretPath }, effect: 'allow' }],
      }))
      expect(secret.changed, `carrier-covered member grant refused: ${secret.code ?? secret.reason ?? 'n/a'}`).toBe(true)
      const open = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r5-derive-open',
        reason: 'plain covered grant',
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: openPath }, effect: 'allow' }],
      }))
      expect(open.changed, `covered grant refused: ${open.code ?? 'n/a'}`).toBe(true)
      // NO SELF-WIDENING: the grant wrote the MEMBER's overlay; the leader's
      // own effective answer at the secret path stays DENY through the
      // production decision lane (the same lane the pre-execute gate reads).
      const plane = root.permissionPlane as {
        decisions: { decide(a: Record<string, unknown>): Promise<Record<string, unknown>> }
      }
      const leaderAnswer = await plane.decisions.decide({
        teamSessionId: HOST_ROOT,
        memberInstanceId: LEADER_INSTANCE_ID,
        operation: {
          tool: 'write',
          resource: { kind: 'file', key: secretPath, display: secretPath },
          fingerprint: `sha256:${'d'.repeat(64)}`,
        },
        staticFacts: {
          layers: [
            {
              label: 'leader',
              default: 'deny',
              rules: [
                { operationClass: 'write', matcher: { kind: 'subtree', resource: `${world.scratch}/workspace` }, effect: 'allow' },
                { operationClass: 'write', matcher: { kind: 'exact', resource: secretPath }, effect: 'deny' },
              ],
            },
          ],
        },
      })
      expect(leaderAnswer['kind']).toBe('effective')
      expect(leaderAnswer['effect'], 'the member grant must not widen the LEADER\'s own authority').toBe('deny')
      // And the member NOW executes X: the same lane answers ALLOW.
      const memberAnswer = await plane.decisions.decide({
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        operation: {
          tool: 'write',
          resource: { kind: 'file', key: secretPath, display: secretPath },
          fingerprint: `sha256:${'d'.repeat(64)}`,
        },
        staticFacts: { layers: [] },
      })
      expect(memberAnswer['kind']).toBe('effective')
      expect(memberAnswer['effect']).toBe('allow')
    } finally {
      await world.dispose()
    }
  })

  it('R4-absent — NO carrier is a legal typed absence: the SAME grant round-3 DERIVED to legal now refuses, while tightening keeps working', async () => {
    const world = makeHostWorld((base) => new FileStorageSeam(base))
    try {
      const target = `${world.scratch}/workspace/no-carrier.txt`
      const source = r4BlueprintSource({ leaderWrite: [{ kind: 'exact', path: target, effect: 'allow' }] })
      const { root, warnings } = await world.apply(hostRowConfig(source, `${world.scratch}/workspace`))
      const expand = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r4-absent-expand',
        reason: 'round-3 derived an envelope from exactly this static lane',
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: target }, effect: 'allow' }],
      }))
      expect(expand.changed, 'the static lane still DERIVES an envelope — BLOCK-4 regression').not.toBe(true)
      expect(String(expand.code)).toContain('EXPANSION_DENIED')
      // Not a hard fail: the world answers every UNAFFECTED mutation — a
      // TIGHTENING grant (no envelope needed) commits normally.
      const tighten = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r4-absent-tighten',
        reason: 'tightening needs no carrier',
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: target }, effect: 'deny' }],
      }))
      expect(tighten.changed, `tightening hard-failed: ${tighten.code ?? 'n/a'}`).toBe(true)
      void warnings
    } finally {
      await world.dispose()
    }
  })

  it('R4-anchor — a RELATIVE carrier rule canonicalizes at the TARGET member workspace and grants the member key (BLOCK-3)', async () => {
    const world = makeHostWorld((base) => new FileStorageSeam(base))
    try {
      const memberWs = `${world.scratch}/workspace`
      const source = r4BlueprintSource({
        leaderWrite: [{ kind: 'exact', path: 'rel-out.txt', effect: 'allow' }],
        carrier: carrierYaml([{ operationClass: 'write', kind: 'exact', value: 'rel-out.txt', maximumEffect: 'allow' }]),
      })
      const { root } = await world.apply(hostRowConfig(source, memberWs))
      // The member runs AT memberWs (the seeded row's workspace): the honest
      // key is memberWs/rel-out.txt — the carrier must have canonicalized
      // there, so the grant against that key COMMITS.
      const honest = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r4-anchor-honest',
        reason: 'key canonicalized at the member basis',
        rules: [
          { operationClass: 'write', matcher: { kind: 'exact', resource: `${memberWs}/rel-out.txt` }, effect: 'allow' },
        ],
      }))
      expect(honest.changed, `member-basis grant refused: ${honest.code ?? 'n/a'}`).toBe(true)
      // A key at any OTHER basis is outside the envelope — refused (round 3
      // would have keyed the envelope at the row anchor and inverted these
      // two outcomes whenever member ≠ row workspace).
      const foreign = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r4-anchor-foreign',
        reason: 'key at a foreign basis',
        rules: [
          {
            operationClass: 'write',
            matcher: { kind: 'exact', resource: `${world.scratch}/elsewhere/rel-out.txt` },
            effect: 'allow',
          },
        ],
      }))
      expect(foreign.changed).not.toBe(true)
      expect(String(foreign.code)).toContain('EXPANSION_DENIED')
    } finally {
      await world.dispose()
    }
  })

  it('R4-recover — a provider fault at warm-up is LOUD-but-continue; expansions refuse typed meanwhile and the NEXT addressed read recovers (GAP3)', async () => {
    const world = makeHostWorld((base) => new FileStorageSeam(base))
    try {
      const memberWs = `${world.scratch}/workspace`
      const state = { faulty: true }
      const realJoin = (path: string, cwd: string): string => (path.startsWith('/') ? path : `${cwd}/${path}`)
      world.provided.fs = {
        resolve: async (path: string, options?: { cwd?: string }) => {
          if (state.faulty) throw new Error('injected boot fs fault')
          const joined = realJoin(path, options?.cwd ?? memberWs)
          return { targetKey: joined, displayPath: joined }
        },
        contains: (parent: unknown, child: unknown) => {
          const p = (parent as { targetKey?: string }).targetKey ?? ''
          const c = (child as { targetKey?: string }).targetKey ?? ''
          const rel = relative(resolve(p), resolve(c))
          return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
        },
      }
      const source = r4BlueprintSource({
        leaderWrite: [{ kind: 'exact', path: 'recover.txt', effect: 'allow' }],
        carrier: carrierYaml([{ operationClass: 'write', kind: 'exact', value: 'recover.txt', maximumEffect: 'allow' }]),
      })
      const { root, warnings } = await world.apply(hostRowConfig(source, memberWs))
      // The warm-up fault is LOUD at boot (round-5 R-A minor closed): the
      // host logs the failed warm explicitly; it never prints healthy:true
      // over a faulted warm.
      expect(warnings.join('\n'), 'warm-up fault must be logged LOUD at boot').toMatch(/warm-up FAULTED/)
      const mutate = (mutationId: string, effect: 'allow' | 'deny') =>
        root.mutation.governance.mutatePermission({
          authority: { kind: 'leader' },
          teamSessionId: HOST_ROOT,
          memberInstanceId: 'inst-a3p4e2worker',
          kind: 'grant_instance',
          mutationId,
          reason: 'r4 recovery probe',
          rules: [
            {
              operationClass: 'write',
              matcher: { kind: 'exact', resource: `${memberWs}/recover.txt` },
              effect,
            },
          ],
        }).then((r: unknown) => r as { changed?: boolean; code?: string; reason?: string }, (e: unknown) => {
          const err = e as { code?: string; message?: string }
          return { changed: false, code: String(err.code ?? ''), reason: String(err.message ?? '') }
        })
      // While the provider faults: the expansion refuses TYPED (zero
      // envelope / UNKNOWN facts) — never commits, never crashes.
      const during = await mutate('mut-r4-recover-during', 'allow')
      expect(during.changed, 'a faulted authority must not authorize expansion').not.toBe(true)
      // Pinned EXACTLY on the wired fail-closed label. During the fault BOTH
      // authority reads abstain: the envelope reader yields zero authority
      // (the kernel's coverage judgement therefore refuses FIRST), so this
      // fixture's route is ENVELOPE-EXPANSION_DENIED — the pure
      // facts-abstention CONTEXT route (envelope covered, target facts
      // UNKNOWN) is pinned where only the facts abstain:
      // a3p3-permission-mutation-authority.test.ts:454. What this leg pins:
      // a fault NEVER authorizes, and it refuses TYPED (not a crash, not a
      // silent false).
      expect(String(during.code), `unexpected refusal path: ${during.code ?? during.reason}`).toBe(
        'PERMISSION_ENVELOPE_EXPANSION_DENIED',
      )
      // UNAFFECTED decisions keep reading correct current facts: the
      // envelope-free tightening commits even while the fault persists.
      const unaffected = await mutate('mut-r4-recover-unaffected', 'deny')
      expect(unaffected.changed, 'tightening must not be hard-failed by the fault').toBe(true)
      // Recovery: the fault clears — the NEXT addressed read REBUILDS (no
      // cached failure), so the expansion that must succeed now does.
      state.faulty = false
      const after = await mutate('mut-r4-recover-after', 'allow')
      expect(after.changed, `bounded recovery failed: ${after.code ?? after.reason ?? 'n/a'}`).toBe(true)
    } finally {
      await world.dispose()
    }
  })
})


function r5AuthorityFacts(deps: {
  domain: any
  base: string
  blueprintSource: string
  canonicalize: (path: string, cwd: string) => Promise<string>
}) {
  const parsed = parseBlueprint(deps.blueprintSource)
  return createPermissionAuthorityFacts({
    resolveBlueprint: () => parsed,
    memberTemplateId: (teamSessionId, memberInstanceId) =>
      deps.domain.repositories.memberInstances
        .get(teamSessionId, memberInstanceId)?.templateId as string | undefined,
    memberWorkspace: (teamSessionId, memberInstanceId) => {
      const ws = deps.domain.repositories.memberInstances.get(teamSessionId, memberInstanceId)
        ?.workspace as string | undefined
      if (typeof ws === 'string' && ws !== '') return ws
      const teamDefault = deps.domain.repositories.teamSessions.get(teamSessionId)
        ?.defaultWorkspace as string | undefined
      return typeof teamDefault === 'string' && teamDefault !== '' ? teamDefault : undefined
    },
    canonicalize: deps.canonicalize,
  })
}

// ===========================================================================
// R5 — ROUND 5: the REAL production entries (FIX-2 tool + RPC), the CWD
// source-of-truth pin (FIX-3), the carrier grammar negatives + golden hash
// (R-B debt). The parent's required regressions: "real entry → governance
// mutation service → durable snapshot → the NEXT pre-execute decision shows
// a real ALLOW (granted) and a real refusal (absent/revoked), end-to-end
// through the production adapter" — for BOTH new entries.
// ===========================================================================
describe('R5 — round-5 production entries + CWD truth + carrier grammar (FIX-2/3 + R-B debt)', () => {
  it('R5-tool — the REAL team_grant_permission/team_revoke_permission surface: grant commits → decision ALLOW; revoke → decision DENY again (Leader gate + server-side canonicalization)', async () => {
    const base = scratchDir(`a3p4r5t-${Math.random().toString(36).slice(2, 8)}`)
    openScratch.push(base)
    destroyDir(base)
    mkdirSync(`${base}/workspace`, { recursive: true })
    const seam = new FileStorageSeam(base)
    const domain = await createTeamDomain(seam)
    const overlayStore = await openPermissionOverlayStore(new FileStorageSeam(base))
    const overlay = createPermissionOverlayRepositoryPort({ repository: overlayStore.repository })
    const openKey = `${base}/workspace/open.txt`
    const config = {
      bootPhase: 'create' as const,
      rootSessionId: GLUE_ROOT,
      blueprintSource: r4BlueprintSource({
        leaderWrite: [],
        carrier: carrierYaml([
          { operationClass: 'write', kind: 'exact', value: openKey, maximumEffect: 'allow' },
        ]),
      }),
      generation: 1,
      defaultWorkspace: `${base}/workspace`,
      seedMembers: [],
      staticModel: { provider: 'a3p4r5', model: 'a3p4r5-model' },
      deniedSelection: null,
      mcpServer: null,
      environmentFacts: [],
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
    }
    await domain.repositories.teamSessions.put({
      rootSessionId: parseRootSessionId(GLUE_ROOT),
      blueprint: createBlueprintSnapshotRef({
        blueprintId: parseBlueprintId('team.a3p4r5x'),
        revision: parseBlueprintRevision('1'),
        contentHash: parseBlueprintContentHash(`sha256:${'9'.repeat(64)}`),
      }),
      defaultWorkspace: `${base}/workspace`,
      createdAt: NOW,
      generation: 1,
    })
    await domain.repositories.memberInstances.put({
      rootSessionId: parseRootSessionId(GLUE_ROOT),
      instanceId: parseInstanceId(GLUE_INST),
      templateId: parseTemplateId('worker'),
      label: 'r5 tool member (NO workspace row — FIX-3 durable default applies)',
      childSessionId: parseChildSessionId('child-r5-tool'),
      lifecycle: 'RUNNING',
      createdAt: NOW,
      activityVersion: 1,
    })
    const teamToolsRef: { current: any } = { current: undefined }
    const callerState: { value: { caller: Record<string, unknown>; rootSessionId: string } } = {
      value: { caller: { kind: 'instance', instanceId: LEADER_INSTANCE_ID }, rootSessionId: GLUE_ROOT },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub glue surface
    const live: any = createStubBindings({ config, teamToolsRef, domain })
    // The IDENTITY seam (stubbed by this glue world by design — the caller-
    // root binding of the real seam is pinned in the tools package suite):
    // the holder below lets this leg flip Leader/member identity per leg.
    live.resolveCaller = async () => callerState.value
    const permissionCanonicalize = async (path: string, cwd: string) =>
      path.startsWith('/') ? path : resolve(cwd, path)
    const facts = r5AuthorityFacts({ domain, base, blueprintSource: config.blueprintSource, canonicalize: permissionCanonicalize })
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
        throw new Error('a3p4r5 world: legacy inspect is unused')
      }) as never,
      permissionOverlay: overlay,
      fsContainsKeys: makeContainKeys(),
      permissionPlaneRef,
      // THE production canonicalizer seam shape (host.ts permissionCanonicalize).
      permissionCanonicalize,
      permissionEnvelope: facts.permissionEnvelope,
      permissionStaticLayers: facts.staticLayers,
    })
    void root
    const tools = teamToolsRef.current?.tools as { name: string; execute(a: unknown, e: unknown): Promise<any> }[]
    const grant = tools.find((t) => t.name === 'team_grant_permission')
    const revoke = tools.find((t) => t.name === 'team_revoke_permission')
    expect(grant, 'team_grant_permission is on the REAL registered tool set').toBeDefined()
    expect(revoke, 'team_revoke_permission is on the REAL registered tool set').toBeDefined()
    const plane = permissionPlaneRef.current
    if (plane === undefined) throw new Error('the r5 root did not fill the plane reference')
    try {
      // (0) MEMBER callers are rejected at the tool boundary, zero write.
      callerState.value = {
        caller: { kind: 'instance', instanceId: 'inst-somebody-else' },
        rootSessionId: GLUE_ROOT,
      }
      const memberAttempt = await grant!.execute(
        {
          rootSessionId: GLUE_ROOT,
          requestToken: 'r5-member-attempt',
          targetInstanceId: GLUE_INST,
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
        },
        { agent: { id: 'agent-of-somebody-else' } },
      )
      expect(memberAttempt.status).toBe('rejected')
      expect(String(memberAttempt.code)).toContain('PERMISSION_NOT_LEADER')
      // (1) THE REAL ENTRY: the Leader executes the tool with a RAW RELATIVE
      // path — the tool canonicalizes SERVER-SIDE at the target member's
      // durable effective workspace (member row has NO workspace → the
      // durable TeamSession default, FIX-3/FIX-2a). The carrier covers the
      // canonical key ⇒ the governance mutation COMMITS durably.
      callerState.value = { caller: { kind: 'instance', instanceId: LEADER_INSTANCE_ID }, rootSessionId: GLUE_ROOT }
      const granted = await grant!.execute(
        {
          rootSessionId: GLUE_ROOT,
          requestToken: 'r5-tool-grant-1',
          targetInstanceId: GLUE_INST,
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
        },
        { agent: { id: 'agent-of-the-leader' } },
      )
      expect(granted.status, `tool grant failed: ${JSON.stringify(granted)}`).toBe('permission-mutated')
      expect(granted.changed).toBe(true)
      // The DURABLE SNAPSHOT proves the canonical key landed at the member's
      // basis (never the raw relative path, never the acting row's tail).
      const snapshot = await overlay.latest({ teamSessionId: GLUE_ROOT, memberInstanceId: GLUE_INST } as never)
      const landed = (((snapshot ?? {}) as { state?: { rules?: { resource: string }[] } }).state?.rules ?? []).map(
        (r) => r.resource,
      )
      expect(landed.join('|'), `overlay landed ${JSON.stringify(landed)}`).toContain(openKey)
      // THE NEXT PRE-EXECUTE DECISION: the production decision lane (the
      // lane the agent-bindings pre-execute gate consumes) answers ALLOW.
      const allowed = await plane.decisions.decide({
        teamSessionId: GLUE_ROOT,
        memberInstanceId: GLUE_INST,
        operation: {
          tool: 'write',
          resource: { kind: 'file', key: openKey, display: openKey },
          fingerprint: `sha256:${'a'.repeat(64)}`,
        },
        staticFacts: { layers: [] },
      } as never)
      expect((allowed as Record<string, unknown>)['kind']).toBe('effective')
      expect((allowed as Record<string, unknown>)['effect']).toBe('allow')
      // (2) The dedupe identity: the same request token re-executes nothing.
      const replay = await grant!.execute(
        {
          rootSessionId: GLUE_ROOT,
          requestToken: 'r5-tool-grant-1',
          targetInstanceId: GLUE_INST,
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
        },
        { agent: { id: 'agent-of-the-leader' } },
      )
      expect(replay.status).toBe('permission-mutated')
      expect(replay.changed, 'the request token is the durable dedupe identity').toBe(false)
      // (3) The closed grammar refuses malformed rules at the tool boundary.
      const malformed = await grant!.execute(
        {
          rootSessionId: GLUE_ROOT,
          requestToken: 'r5-tool-bad-1',
          targetInstanceId: GLUE_INST,
          rules: [{ operationClass: 'write', matcher: { kind: 'glob', value: '*' }, effect: 'allow' }],
        },
        { agent: { id: 'agent-of-the-leader' } },
      )
      expect(malformed.status).toBe('rejected')
      // (4) THE REVOKE through the tool → the next pre-execute decision
      // refuses again (the real refusal, not a wiring absence).
      const revoked = await revoke!.execute(
        {
          rootSessionId: GLUE_ROOT,
          requestToken: 'r5-tool-revoke-1',
          targetInstanceId: GLUE_INST,
          rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
        },
        { agent: { id: 'agent-of-the-leader' } },
      )
      expect(revoked.status, `tool revoke failed: ${JSON.stringify(revoked)}`).toBe('permission-mutated')
      expect(revoked.changed).toBe(true)
      const refused = await plane.decisions.decide({
        teamSessionId: GLUE_ROOT,
        memberInstanceId: GLUE_INST,
        operation: {
          tool: 'write',
          resource: { kind: 'file', key: openKey, display: openKey },
          fingerprint: `sha256:${'a'.repeat(64)}`,
        },
        staticFacts: { layers: [] },
      } as never)
      expect((refused as Record<string, unknown>)['effect'], 'after revoke the member falls back to the deny floor').toBe('deny')
    } finally {
      await seam.closeAll?.()
    }
  })

  it('R5-rpc — the REAL remote method override.mutatePermission (v7-only): operator grant → decision ALLOW; revoke → DENY; member-caller authority refuses typed', async () => {
    const base = scratchDir(`a3p4r5r-${Math.random().toString(36).slice(2, 8)}`)
    openScratch.push(base)
    destroyDir(base)
    mkdirSync(`${base}/workspace`, { recursive: true })
    const seam = new FileStorageSeam(base)
    const domain = await createTeamDomain(seam)
    const overlayStore = await openPermissionOverlayStore(new FileStorageSeam(base))
    const overlay = createPermissionOverlayRepositoryPort({ repository: overlayStore.repository })
    const openKey = `${base}/workspace/open.txt`
    await domain.repositories.teamSessions.put({
      rootSessionId: parseRootSessionId(GLUE_ROOT),
      blueprint: createBlueprintSnapshotRef({
        blueprintId: parseBlueprintId('team.a3p4r5x'),
        revision: parseBlueprintRevision('1'),
        contentHash: parseBlueprintContentHash(`sha256:${'9'.repeat(64)}`),
      }),
      defaultWorkspace: `${base}/workspace`,
      createdAt: NOW,
      generation: 1,
    })
    await domain.repositories.memberInstances.put({
      rootSessionId: parseRootSessionId(GLUE_ROOT),
      instanceId: parseInstanceId(GLUE_INST),
      templateId: parseTemplateId('worker'),
      label: 'r5 rpc member',
      childSessionId: parseChildSessionId('child-r5-rpc'),
      lifecycle: 'RUNNING',
      createdAt: NOW,
      activityVersion: 1,
    })
    // The ONE governance authority (the same service root assembles).
    const config = {
      bootPhase: 'create' as const,
      rootSessionId: GLUE_ROOT,
      blueprintSource: r4BlueprintSource({
        leaderWrite: [],
        carrier: carrierYaml([
          { operationClass: 'write', kind: 'exact', value: openKey, maximumEffect: 'allow' },
        ]),
      }),
      generation: 1,
      defaultWorkspace: `${base}/workspace`,
      seedMembers: [],
      staticModel: { provider: 'a3p4r5', model: 'a3p4r5-model' },
      deniedSelection: null,
      mcpServer: null,
      environmentFacts: [],
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
    }
    const teamToolsRef: { current: any } = { current: undefined }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub glue surface
    const live: any = createStubBindings({ config, teamToolsRef, domain })
    const permissionCanonicalize = async (path: string, cwd: string) =>
      path.startsWith('/') ? path : resolve(cwd, path)
    const facts = r5AuthorityFacts({ domain, base, blueprintSource: config.blueprintSource, canonicalize: permissionCanonicalize })
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
        throw new Error('a3p4r5 rpc world: legacy inspect is unused')
      }) as never,
      permissionOverlay: overlay,
      fsContainsKeys: makeContainKeys(),
      permissionPlaneRef,
      permissionCanonicalize: async (path: string, cwd: string) =>
        path.startsWith('/') ? path : resolve(cwd, path),
    })
    // THE PRODUCTION S6 DISPATCHER over the same authority (the root wires
    // exactly these option shapes into createS6RemoteSurfaces).
    const s6Options = {
      rootSessionId: GLUE_ROOT,
      repositories: domain.repositories,
      isOwnedRoot: (sid: string) => sid === GLUE_ROOT,
      governance: root.mutation.governance,
      permission: {
        mutatePermission: (args: Record<string, unknown>) =>
          root.mutation.governance.mutatePermission(args as never) as unknown as Promise<Record<string, unknown>>,
      },
      permissionCanonicalize: async (path: string, cwd: string) =>
        path.startsWith('/') ? path : resolve(cwd, path),
    }
    const ports = createS6RemotePorts(s6Options as never)
    const asHuman = () => Promise.resolve({ kind: 'human', humanId: 'operator-r5' } as never)
    const asMember = () => Promise.resolve({ kind: 'instance', instanceId: GLUE_INST } as never)
    const dispatchHuman = createS6RemoteDispatcher(ports, asHuman as never)
    const dispatchMember = createS6RemoteDispatcher(ports, asMember as never)
    const plane = permissionPlaneRef.current
    if (plane === undefined) throw new Error('the r5 rpc root did not fill the plane reference')
    const mutateParams = (mutationId: string) => ({
      version: REMOTE_CONTRACT_VERSION_V7,
      params: {
        teamSessionId: GLUE_ROOT,
        memberInstanceId: GLUE_INST,
        kind: 'grant_instance',
        mutationId,
        reason: 'r5 rpc leg',
        rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'open.txt' }, effect: 'allow' }],
      },
    })
    try {
      // (1) A v6 envelope is the typed version rejection (closed rollout).
      const v6 = await dispatchHuman('override.mutatePermission', {
        version: 6,
        params: mutateParams('x').params,
      })
      expect(v6.ok, 'v6 must not reach the v7-only method').toBe(false)
      // (2) THE REAL ENTRY (human RPC): operator authority, RAW RELATIVE
      // path canonicalized server-side at the member's durable basis →
      // durable commit.
      const granted = await dispatchHuman('override.mutatePermission', mutateParams('r5-rpc-grant-1'))
      expect(granted.ok, `rpc grant failed: ${JSON.stringify((granted as { error?: unknown }).error ?? {})}`).toBe(true)
      const data = (granted as { value: { data: Record<string, unknown> } }).value.data
      expect(data['changed']).toBe(true)
      const snapshot = await overlay.latest({ teamSessionId: GLUE_ROOT, memberInstanceId: GLUE_INST } as never)
      const landed = (((snapshot ?? {}) as { state?: { rules?: { resource: string }[] } }).state?.rules ?? []).map(
        (r) => r.resource,
      )
      expect(landed.join('|')).toContain(openKey)
      // THE NEXT PRE-EXECUTE DECISION: ALLOW through the production lane.
      const allowed = await plane.decisions.decide({
        teamSessionId: GLUE_ROOT,
        memberInstanceId: GLUE_INST,
        operation: {
          tool: 'write',
          resource: { kind: 'file', key: openKey, display: openKey },
          fingerprint: `sha256:${'b'.repeat(64)}`,
        },
        staticFacts: { layers: [] },
      } as never)
      expect((allowed as Record<string, unknown>)['effect']).toBe('allow')
      // (3) The closed field set refuses unknown fields (strict closed schema).
      const smuggled = await dispatchHuman('override.mutatePermission', {
        version: REMOTE_CONTRACT_VERSION_V7,
        params: { ...mutateParams('r5-rpc-smuggle').params, authority: { kind: 'leader' } },
      })
      expect(smuggled.ok, 'a client-supplied authority field is refused').toBe(false)
      // (4) The REVOKE through the same entry → the next decision refuses.
      const revoked = await dispatchHuman('override.mutatePermission', {
        version: REMOTE_CONTRACT_VERSION_V7,
        params: {
          ...mutateParams('r5-rpc-revoke-1').params,
          kind: 'revoke_permission',
          mutationId: 'r5-rpc-revoke-1',
        },
      })
      expect(revoked.ok, `rpc revoke failed: ${JSON.stringify((revoked as { error?: unknown }).error ?? {})}`).toBe(true)
      const refused = await plane.decisions.decide({
        teamSessionId: GLUE_ROOT,
        memberInstanceId: GLUE_INST,
        operation: {
          tool: 'write',
          resource: { kind: 'file', key: openKey, display: openKey },
          fingerprint: `sha256:${'b'.repeat(64)}`,
        },
        staticFacts: { layers: [] },
      } as never)
      expect((refused as Record<string, unknown>)['effect']).toBe('deny')
      // (5) A MEMBER principal never mutates: the member authority is
      // rejected by the governance service (typed, zero write).
      const memberAttempt = await dispatchMember('override.mutatePermission', mutateParams('r5-rpc-member-1'))
      expect(memberAttempt.ok, 'a member principal must not mutate the permission overlay').toBe(false)
      const afterMember = await overlay.latest({ teamSessionId: GLUE_ROOT, memberInstanceId: GLUE_INST } as never)
      const afterRules = ((((afterMember ?? {}) as { state?: { rules?: { resource: string }[] } }).state?.rules) ?? []).map(
        (r) => r.resource,
      )
      expect(afterRules.join('|'), 'the member attempt wrote nothing').not.toContain(`${openKey}`.replace(/^/, 'exact:'))
    } finally {
      await seam.closeAll?.()
    }
  })

  it('R5-ws — FIX-3 CWD source-of-truth: a NON-BOOT Team B (durable row, distinct default) canonicalizes at B\u2019s durable default \u2014 never the acting row-A tail (two teams, one host row)', async () => {
    const world = makeHostWorld((base) => new FileStorageSeam(base))
    try {
      const wsA = `${world.scratch}/workspace`
      const wsB = `${world.scratch}/wsB`
      const source = r4BlueprintSource({
        leaderWrite: [],
        carrier: carrierYaml([
          { operationClass: 'write', kind: 'exact', value: 'b-open.txt', maximumEffect: 'allow' },
          { operationClass: 'write', kind: 'exact', value: 'b-secret.txt', maximumEffect: 'allow' },
        ]),
      })
      const { root } = await world.apply(hostRowConfig(source, wsA))
      const repos = (root as unknown as { domain: { repositories: any } }).domain.repositories
      const teamA = await repos.teamSessions.get(HOST_ROOT as never)
      if (teamA === undefined) throw new Error('the boot team row is absent')
      const TEAM_B = 'session-r5teamb'
      // Team B: a DURABLE TeamSession row over the SAME host row/boot, with
      // its OWN defaultWorkspace and the SAME frozen blueprint snapshot.
      await repos.teamSessions.put({
        rootSessionId: parseRootSessionId(TEAM_B),
        blueprint: teamA.blueprint,
        defaultWorkspace: wsB,
        createdAt: NOW,
        generation: 1,
      } as never)
      // Team B's member: NO workspace row field \u2014 the durable team default
      // must supply the canonicalization basis (the FIX-3 fallback).
      await repos.memberInstances.put({
        rootSessionId: parseRootSessionId(TEAM_B),
        instanceId: parseInstanceId('inst-r5bmember'),
        templateId: parseTemplateId('worker'),
        label: 'r5 team-B member (no workspace row)',
        childSessionId: parseChildSessionId('child-r5-b'),
        lifecycle: 'RUNNING',
        createdAt: NOW,
        activityVersion: 1,
      } as never)
      // (1) POSITIVE: the B-basis key is covered \u21d2 the grant COMMITS. This
      // only holds if the carrier canonicalized 'b-open.txt' at wsB (the
      // durable Team B default) \u2014 the round-4 code used the ACTING row-A
      // tail here and inverted this outcome.
      const bMemberGrant = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: TEAM_B,
        memberInstanceId: 'inst-r5bmember',
        kind: 'grant_instance',
        mutationId: 'mut-r5-ws-bmember',
        reason: 'B-basis grant',
        rules: [
          { operationClass: 'write', matcher: { kind: 'exact', resource: `${wsB}/b-open.txt` }, effect: 'allow' },
        ],
      }))
      expect(bMemberGrant.changed, `B-basis member grant refused: ${bMemberGrant.code ?? 'n/a'}`).toBe(true)
      // (2) NEGATIVE: the row-A-basis key is NOT covered at B's basis \u21d2
      // refused (the pre-fix code would have COMMITTED this one).
      const aBasisGrant = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: TEAM_B,
        memberInstanceId: 'inst-r5bmember',
        kind: 'grant_instance',
        mutationId: 'mut-r5-ws-abasis',
        reason: 'row-A-basis key must not be the Team B envelope basis',
        rules: [
          { operationClass: 'write', matcher: { kind: 'exact', resource: `${wsA}/b-open.txt` }, effect: 'allow' },
        ],
      }))
      expect(aBasisGrant.changed, 'the acting row-A tail leaked into the Team B basis').not.toBe(true)
      expect(String(aBasisGrant.code)).toContain('EXPANSION_DENIED')
      // (3) LEADER POSITION of Team B (NO member row at all): the same
      // durable team default supplies the basis.
      const bLeaderGrant = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: TEAM_B,
        memberInstanceId: LEADER_INSTANCE_ID,
        kind: 'grant_instance',
        mutationId: 'mut-r5-ws-bsleader',
        reason: 'B-basis leader-position grant',
        rules: [
          { operationClass: 'write', matcher: { kind: 'exact', resource: `${wsB}/b-secret.txt` }, effect: 'allow' },
        ],
      }))
      expect(bLeaderGrant.changed, `B-basis leader grant refused: ${bLeaderGrant.code ?? 'n/a'}`).toBe(true)
      // (4) TWO TEAMS ONE ROW: Team A stays fully correct at ITS basis
      // (its row default wsA), concurrently with Team B.
      const aGrant = await settleMutation(root.mutation.governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: HOST_ROOT,
        memberInstanceId: 'inst-a3p4e2worker',
        kind: 'grant_instance',
        mutationId: 'mut-r5-ws-amember',
        reason: 'A-basis grant still works',
        rules: [
          { operationClass: 'write', matcher: { kind: 'exact', resource: `${wsA}/b-open.txt` }, effect: 'allow' },
        ],
      }))
      expect(aGrant.changed, `A-basis grant refused: ${aGrant.code ?? 'n/a'}`).toBe(true)
    } finally {
      await world.dispose()
    }
  })

  it('R5-grammar \u2014 the carrier grammar refuses malformed carriers typed (R-B debt: MALFORMED rejection strings existed nowhere)', () => {
    const baseLines: string = r4BlueprintSource({
      leaderWrite: [],
      carrier: carrierYaml([{ operationClass: 'write', kind: 'exact', value: 'open.txt', maximumEffect: 'allow' }]),
    })
    // Valid baseline parses (the negative control for the three below).
    expect(() => parseBlueprint(baseLines)).not.toThrow()
    const mutate = (fn: (lines: string[]) => string[]): string => fn(baseLines.split('\n')).join('\n')
    // (a) an effect OUTSIDE the closed ladder vocabulary
    const badEffect = mutate((ls) => ls.map((line) => line.replace('maximumEffect: allow', 'maximumEffect: granted')))
    expect(() => parseBlueprint(badEffect)).toThrowError(/permissionMutationEnvelope|maximumEffect|MALFORMED/i)
    // (b) an unknown rule field (closed field set)
    const unknownField = mutate((ls) => {
      const at = ls.findIndex((line) => line.includes('maximumEffect:'))
      ls.splice(at, 0, '        smuggledField: 1')
      return ls
    })
    expect(() => parseBlueprint(unknownField)).toThrowError(/permissionMutationEnvelope|smuggledField|MALFORMED/i)
    // (c) a matcher kind OUTSIDE the closed carrier vocabulary (the YAML
    // stays well-formed, so this trips the GRAMMAR, not the parser).
    const badKind = mutate((ls) =>
      ls.map((line) => (line.includes('kind: exact') ? line.replace('kind: exact', 'kind: glob') : line)),
    )
    expect(badKind).not.toBe(baseLines)
    expect(() => parseBlueprint(badKind)).toThrowError(/permissionMutationEnvelope|kind|matcher|MALFORMED/i)
  })

  it('R5-hash \u2014 golden content-hash pin: the carrier-bearing blueprint hashes BYTE-IDENTICALLY (canonicalizer drift trips this leg)', () => {
    const source = r4BlueprintSource({
      leaderWrite: [],
      carrier: carrierYaml([
        { operationClass: 'write', kind: 'exact', value: 'open.txt', maximumEffect: 'allow' },
        { operationClass: 'write', kind: 'subtree', value: 'dir', maximumEffect: 'ask' },
      ]),
    })
    const first = parseBlueprint(source)
    const again = parseBlueprint(source)
    expect(again.contentHash).toBe(first.contentHash)
    // GOLDEN: this literal is the canonical content hash of the EXACT bytes
    // this builder emits. Any drift in the blueprint canonicalization
    // (field ordering, carrier serialization, hashing) changes it.
    expect(first.contentHash).toBe(
      'sha256:f0148ab83ec03c4dcb3da4b9357b260ea446067fb335c56153b35b815c897bd6',
    )
  })
})


void HERE
