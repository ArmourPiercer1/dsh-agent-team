/**
 * Alpha.3 PR3 — governance LANE hygiene for the permission-mutation path.
 *
 * Four legs, each pinning one structural contract the PR owns:
 *
 * 1. the LOAD-ORDER leg (the PR2 lesson, cited there verbatim: re-exporting
 *    the assembler while importing the operation-permission BARREL closed an
 *    initialization cycle with `admission/types.ts` and 73 spec files failed
 *    to COLLECT — `effective-policy/permission-assembler.ts:112-119` and
 *    `test/a3p2-effective-policy-lane-import.test.ts`): the governance lane
 *    gains a new module this round, so the admission constant tables must
 *    still be initialized when the lane loads, and the new module may only
 *    touch the OPERATION-CLASS vocabulary through its LEAF module
 *    (`operation-permission/types.js`, which imports nothing).
 *
 * 2. the ZERO-CONSUMER walk leg (PR1/PR2 precedent: "nothing wires this
 *    repository to a tool, a remote method …", storage
 *    `repositories/permission-overlays.ts:33-38`): PR3 lands the authority
 *    with NO production wiring — the walk over every shipped package finds
 *    NO importer of the new module outside the governance lane itself and
 *    the test directory.
 *
 * 3. the PERSISTENCE-ONLY pin (ADR §1 four MUST-NOTs; PR1 `port.ts`): the
 *    permission path talks to the durable store EXCLUSIVELY through the
 *    three-member port (`append`/`latest`/`history`). The pin is a Proxy that
 *    throws on any other member access — if the service ever reached for a
 *    fourth verb, this spec would fail. The PR1 port-surface spec
 *    (`permission-overlay-port-surface.test.ts`) keeps pinning the port
 *    itself; this leg pins the CONSUMER side of the same contract.
 *
 * 4. the legacy-SURFACE pin (coordinator D1: EXTEND, do not fork — the
 *    existing methods are byte-unchanged): the service object is exactly the
 *    three PR-A methods plus the additive `mutatePermission`, and there is
 *    NO second mutation-authority class exporting a parallel durable write.
 *
 * Offline, host-free. The only I/O is reading this package's own source text.
 *
 * @module @dsh-agent-team/runtime/test/a3p3-governance-lane-hygiene
 */

// ORDER-SENSITIVE ON PURPOSE (the PR2 precedent): the admission constant
// table is imported FIRST, the way the 73 affected spec files reach it. If
// the governance lane re-created an initialization cycle, THIS import is what
// fails — at module evaluation, before a single test runs.
import { CALLER_ROLE_VALUES, CALLER_ROLES } from '../admission/types.js'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as lane from '../governance/index.js'
import * as mutationModule from '../governance/permission-mutation.js'
import { PERMISSION_OVERLAY_MAX_RULES } from '../../storage/schema/permission-overlay.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import type { OverrideStorePort, OverrideRecordView } from '../mutation/override-admission.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'
import type { GovernanceMutationServiceDeps } from '../governance/types.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNTIME_ROOT = join(HERE, '..')
const MUTATION_SOURCE = readFileSync(join(HERE, '../governance/permission-mutation.ts'), 'utf8')
const SERVICE_SOURCE = readFileSync(join(HERE, '../governance/service.ts'), 'utf8')

describe('the governance lane stays loadable from the admission surface', () => {
  it('the admission constant tables are initialized when this lane loads', () => {
    expect(CALLER_ROLES.LEADER).toBe('leader')
    expect(CALLER_ROLES.MEMBER).toBe('member')
    expect(CALLER_ROLE_VALUES).toEqual(['human', 'leader', 'member'])
  })

  it('the lane barrel and the permission-mutation module are ONE instantiation', () => {
    expect(lane.parsePermissionMutationEnvelope).toBe(mutationModule.parsePermissionMutationEnvelope)
    expect(lane.PermissionMutationError).toBe(mutationModule.PermissionMutationError)
    expect(lane.PERMISSION_MUTATION_ERROR_CODES).toBe(mutationModule.PERMISSION_MUTATION_ERROR_CODES)
    expect(lane.PERMISSION_MUTATION_KINDS).toBe(mutationModule.PERMISSION_MUTATION_KINDS)
    expect(lane.PERMISSION_EFFECT_PRECEDENCE).toBe(mutationModule.PERMISSION_EFFECT_PRECEDENCE)
  })

  it('the new module takes the vocabulary from LEAF modules only (no barrel edges)', () => {
    // The PR2 failure mode, applied to the new module: the operation-
    // permission barrel reaches the canonicalizer, which reaches the
    // admission surface; the governance barrel is imported by src/plugin
    // (root.ts:258). A barrel edge from this module could close the same
    // cycle. The leaf (`operation-permission/types.js`) imports nothing.
    expect(MUTATION_SOURCE).toContain("from '../operation-permission/types.js'")
    expect(MUTATION_SOURCE).not.toContain("from '../operation-permission/index.js'")
    expect(MUTATION_SOURCE).not.toMatch(/^import \{[^}]*\} from '\.\.\/permission-governance\//m)
    expect(MUTATION_SOURCE).not.toMatch(/^import \{[^}]*\} from '\.\.\/effective-policy\//m)
    expect(MUTATION_SOURCE).not.toMatch(/^import \{[^}]*\} from '\.\.\/mutation\//m)
    // The overlay vocabulary is TYPE-ONLY (the PR2 discipline: no runtime
    // edge to the PR1 lane or, through it, to storage).
    expect(MUTATION_SOURCE).toContain("import type {")
    expect(MUTATION_SOURCE).not.toMatch(/^import \{[^}]*\} from '\.\.\/\.\.\/storage\//m)
  })
})

describe('ZERO production consumers (PR3 lands dormant)', () => {
  it('no shipped source outside the governance lane imports the permission-mutation module', () => {
    // Walk every runtime directory + the other plugin packages, mirroring the
    // PR2 walk leg: a production importer of the new path would mean the
    // PR3 scope line ("ZERO production wiring: no pre-execute adapter
    // changes, no plugin-root/live bindings, no tools/remote/client imports")
    // had been crossed.
    const offenders: string[] = []
    const roots = ['runtime', 'tools', 'remote', 'client']
    const visit = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        const st = statSync(full)
        if (st.isDirectory()) {
          if (entry === 'node_modules' || entry === 'dist' || entry === 'test') continue
          visit(full)
          continue
        }
        if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry.endsWith('.d.ts')) continue
        // The governance lane itself may import the new module; this walk
        // counts PRODUCTION consumers only (the test dir is skipped above).
        const rel = relative(RUNTIME_ROOT, full)
        if (rel.startsWith(`governance${sep}permission-mutation.ts`)) continue
        if (rel.startsWith(`governance${sep}service.ts`)) continue
        if (rel.startsWith(`governance${sep}types.ts`)) continue
        if (rel.startsWith(`governance${sep}index.ts`)) continue
        const text = readFileSync(full, 'utf8')
        if (/governance\/permission-mutation\.js|permission-mutation\.js['"]/.test(text)) offenders.push(rel)
      }
    }
    const packagesRoot = join(RUNTIME_ROOT, '..')
    for (const pkg of roots) {
      const pkgRoot = pkg === 'runtime' ? RUNTIME_ROOT : join(packagesRoot, pkg)
      try {
        statSync(pkgRoot)
      } catch {
        continue
      }
      visit(pkgRoot)
    }
    expect(offenders).toEqual([])
  })

  it('nothing imports the durable overlay store or its port outside the PR1 lane and this lane/test pair', () => {
    // The PR3 authority may reach the durable overlay ONLY through the PR1
    // port type; a direct import of the storage repository from a NEW
    // production file would create the second write path ADR §1 forbids.
    const offenders: string[] = []
    const visit = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        const st = statSync(full)
        if (st.isDirectory()) {
          if (entry === 'node_modules' || entry === 'dist' || entry === 'test') continue
          visit(full)
          continue
        }
        if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) continue
        const rel = relative(RUNTIME_ROOT, full)
        if (rel.startsWith(`permission-governance${sep}`)) continue // the PR1 lane itself
        if (rel.startsWith(`governance${sep}service.ts`) && SERVICE_SOURCE.length > 0) {
          // The service imports the port TYPE only — checked below.
          const text = readFileSync(full, 'utf8')
          if (/^import \{[^}]*\} from '\.\.\/\.\.\/storage\/repositories\/permission-overlays/m.test(text)) {
            offenders.push(rel)
          }
          continue
        }
        const text = readFileSync(full, 'utf8')
        if (/from '\.\.\/\.\.\/storage\/repositories\/permission-overlays\.js'/.test(text)) offenders.push(rel)
      }
    }
    visit(RUNTIME_ROOT)
    expect(offenders).toEqual([])
    // The service holds the overlay dependency as a TYPE-ONLY import (the
    // runtime store object is INJECTED by the caller, so the lane keeps zero
    // runtime edge to storage).
    expect(SERVICE_SOURCE).not.toMatch(/^import \{[^}]*\} from '\.\.\/permission-governance\//m)
    expect(SERVICE_SOURCE).toContain("import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'")
  })
})

describe('the repository stays persistence-only from the CONSUMER side (ADR §1)', () => {
  it('the kernel mirrors the PR1 rule-set bound verbatim (a drift in either turns this red)', () => {
    // The kernel mirrors (not imports) the storage bound to keep the lane
    // free of a runtime edge to storage — the pin makes the mirror checked,
    // not aspirational.
    expect(MUTATION_SOURCE).toContain(`const MAX_RULES_BOUND = ${PERMISSION_OVERLAY_MAX_RULES}`)
  })


  it('the permission path only touches append/latest/history on the port', async () => {
    const touched = new Set<string>()
    const inner = new Map<string, string>()
    const target: Record<string, unknown> = {
      append: async (input: { metadata: { generation: number } }) => {
        touched.add('append')
        const snapshot = {
          schemaVersion: 1,
          snapshotId: `snap-${String(input.metadata.generation)}`,
          ...input,
        }
        inner.set(String(input.metadata.generation), JSON.stringify(snapshot))
        return snapshot
      },
      latest: async () => {
        touched.add('latest')
        const keys = [...inner.keys()].map(Number).sort((a, b) => b - a)
        const head = keys[0]
        return head === undefined ? undefined : (JSON.parse(inner.get(String(head)) as string) as unknown)
      },
      history: async () => {
        touched.add('history')
        return [...inner.values()].map((raw) => JSON.parse(raw) as unknown)
      },
    }
    const guarded = new Proxy(target, {
      get(obj, prop: string) {
        if (!(prop in obj)) {
          throw new Error(`the permission path reached port member "${prop}" — the PR1 port exposes ONLY append/latest/history`)
        }
        return obj[prop]
      },
    }) as unknown as PermissionOverlayRepositoryPort

    class NoopOverrides implements OverrideStorePort {
      async list(): Promise<readonly OverrideRecordView[]> {
        return []
      }
      async put(record: unknown): Promise<unknown> {
        return record
      }
    }
    const deps: GovernanceMutationServiceDeps = {
      chain: createTeamOperationCoordinator(),
      overrides: new NoopOverrides(),
      transitions: {
        appendTransition(): void {},
        listTransitions: () => [],
      },
      transitionCommit: { commit: async () => {} },
      policy: {
        readBlueprintEnvelope: () => {
          throw new Error('never consulted by the permission path')
        },
        readTemplatePolicy: () => {
          throw new Error('never consulted by the permission path')
        },
        readExternalFacts: () => {
          throw new Error('never consulted by the permission path')
        },
      },
      registeredMembers: async () => [],
      policyStates: () => ['default'],
      now: () => '2026-10-05T00:00:00.000Z',
      permissionLane: { overlay: guarded },
    }
    const service = lane.createGovernanceMutationService(deps)
    const result = await service.mutatePermission({
      authority: { kind: 'operator' },
      teamSessionId: 'session-a3p3-hygiene',
      memberInstanceId: 'inst-hygiene',
      kind: 'grant_instance',
      mutationId: 'mut-hygiene-1',
      reason: 'tightening-only grant (deny), no envelope consulted',
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', resource: 'file:/x/y.txt' }, effect: 'deny' }],
    })
    expect(result.changed).toBe(true)
    expect([...touched].sort()).toEqual(['append', 'latest'])
  })

  it('the legacy service surface is EXACTLY the PR-A three methods plus the additive mutatePermission (D1)', () => {
    // No second authority class: the durable permission write path is a
    // method on the ONE GovernanceMutationService object.
    const keys = Object.keys(
      lane.createGovernanceMutationService({
        chain: createTeamOperationCoordinator(),
        overrides: { list: async () => [], put: async (r: unknown) => r } as unknown as OverrideStorePort,
        transitions: { appendTransition(): void {}, listTransitions: () => [] },
        transitionCommit: { commit: async () => {} },
        policy: {
          readBlueprintEnvelope: () => {
            throw new Error('unused')
          },
          readTemplatePolicy: () => {
            throw new Error('unused')
          },
          readExternalFacts: () => {
            throw new Error('unused')
          },
        },
        registeredMembers: async () => [],
        policyStates: () => ['default'],
        now: () => '2026-10-05T00:00:00.000Z',
      }),
    ).sort()
    expect(keys).toEqual(['mutatePermission', 'resetOverride', 'setOverride', 'switchPolicyState'])
  })
})
