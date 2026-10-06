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
import * as domainEnvelope from '../../domain/authority-envelope/src/index.js'
import { PERMISSION_OVERLAY_MAX_RULES } from '../../storage/schema/permission-overlay.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import type { OverrideStorePort, OverrideRecordView } from '../mutation/override-admission.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'
import type { GovernanceMutationServiceDeps } from '../governance/types.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNTIME_ROOT = join(HERE, '..')
const MUTATION_SOURCE = readFileSync(join(HERE, '../governance/permission-mutation.ts'), 'utf8')
const SERVICE_SOURCE = readFileSync(join(HERE, '../governance/service.ts'), 'utf8')
const PROPOSAL_STORE_SOURCE = readFileSync(join(HERE, '../governance/proposal-store.ts'), 'utf8')
const SLOT_SOURCE = readFileSync(join(HERE, '../governance/slot.ts'), 'utf8')
// A4-PR1: the ceiling adapter and the domain grammar it consumes. Read as TEXT
// because the law is about the IMPORT GRAPH, which no runtime assertion can see.
const AUTHORITY_CEILING_SOURCE = readFileSync(join(HERE, '../governance/authority-ceiling.ts'), 'utf8')
const DOMAIN_ROOT = join(RUNTIME_ROOT, '..', 'domain')
const DOMAIN_ENVELOPE_DIR = join(DOMAIN_ROOT, 'authority-envelope', 'src')

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
    // Parent req 2 (external P1 batch): `permission-coverage.ts` is a
    // DIFFERENT tool owner's module — the region algebra uses ONLY the
    // kernel's own matcherCovers/subtreeContains whole-matcher relations.
    expect(MUTATION_SOURCE).not.toContain('permission-coverage')
    expect(SERVICE_SOURCE).not.toContain('permission-coverage')
    // Req 1 (no deny-masquerade): the unknown-context refusal is the ONLY
    // new code; the classification never invents a baseline.
    expect(MUTATION_SOURCE).toContain("EFFECT_CONTEXT_UNAVAILABLE: 'PERMISSION_EFFECT_CONTEXT_UNAVAILABLE'")
  })
})

describe('production consumers: exactly the PR4 assembly layer (PR3 landed dormant; PR4 wired it)', () => {
  it('no shipped source outside the governance lane and the PR4 permission-plane assembly imports the permission-mutation module', () => {
    // Walk every runtime directory + the other plugin packages, mirroring the
    // PR2 walk leg. PR3's scope line ("ZERO production wiring") held AT PR3;
    // pre-alpha3 PR4 SUPERSEDES it by design — the production entry now
    // consumes the SHARED PURE algebra (parse/answer helpers) through ONE
    // audited seam: `src/plugin/permission-plane.ts` (the assembly layer that
    // builds the identity-bound authority facts). The pin's MEANING survives
    // intact: no OTHER production file may import the module — the kernel
    // stays the single algebra, the lanes stay the only writers, and any new
    // importer must arrive as a reviewed amendment to this allow-list.
    // (Round-3 note: the first amendment, recorded in
    // `dev/agent-workflow/evidence/alpha3-pr4-permission-lifecycle/`.)
    const offenders: string[] = []
    // A4-PR1 (ADR A3-9/A2-3): `domain` joins the walk. The direction law —
    // runtime consumes domain, NEVER the reverse — is only real if something
    // looks. A domain module that imported this kernel would not merely be a
    // layering smell: it would put the content-hashed grammar behind a runtime
    // dependency, so a governance edit could change what a stored blueprint
    // hash MEANS. Domain files are never skipped below (no allow-list entry may
    // ever be added for them — the correct fix for a hit here is to move the
    // vocabulary DOWN, not to permit the edge).
    const roots = ['runtime', 'tools', 'remote', 'client', 'domain']
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
        // PR4 (round 3) amendment: the ONE production consumer — the plugin
        // assembly layer that derives the identity-bound authority facts
        // (pure parse/answer helpers only; zero write path, zero grammar).
        if (rel === join('src', 'plugin', 'permission-plane.ts')) continue
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

describe('the lane\'s storage edge is OWNED — one file, one module (A4-PR0)', () => {
  // WHY THIS LEG EXISTS. A4-PR0 added `governance/proposal-store.ts`, whose
  // imports a runtime value from `packages/storage` (`proposal-store.ts:88`: the
  // snapshot-key derivation, its derived length bound, and the overlay effect
  // vocabulary). Nothing above policed that: the narrow ban here forbids
  // `storage/repositories/permission-overlays.js` and the kernel's own imports,
  // so the edge would have gone forward unowned and the next PR would copy it by
  // accident. (Review-round correction: this was NOT the directory's first
  // storage value edge — `governance/slot.ts:56` has imported
  // `TEAM_DOMAIN_SCHEMA_VERSION` from the storage schema barrel since alpha3 PR-A.
  // Neither edge was policed, which is the actual finding; both are listed below
  // so the set is now closed. `slot.ts` is recorded as PRE-EXISTING, not as
  // something this round reviewed.) The decision, recorded in the commit that
  // added the PR0 edge:
  //
  //   KEEP the edge, and name it. The rule this lane follows is DERIVE AN
  //   IDENTITY THROUGH THE MODULE THAT OWNS IT, MIRROR EVERYTHING THAT IS ONLY
  //   A CONSTRAINT. A proposal record's base pair IS an overlay snapshot
  //   identity, written to be read back years later: a mirrored copy of the
  //   derivation, or of the bound derived from the same components, drifts
  //   silently and the drift is not a tightening — it is a durable row that
  //   reads `corrupt-record`. That is not hypothetical: PR0 mirrored the bound
  //   at 256 while the owner's sum is 310, and a legal max-length identity
  //   (session id 255 + separator + instance id 37 + separator + generation)
  //   could not be recorded at all (review SF-1). Constraints that are not
  //   identities stay mirrored and pinned, exactly as the kernel does them
  //   above: `GOVERNANCE_PROPOSAL_LEDGER_SCHEMA_VERSION` and
  //   `GOVERNANCE_PROPOSAL_OPERATION_ID_PATTERN`.
  //
  // The edge is also not a new KIND of edge in the runtime tree: the overlay
  // port's own lane already imports values from this same module
  // (`permission-governance/types.ts:29,38`). What is new is only that it is in
  // `governance/`, so it is now a reviewed allow-list entry rather than a
  // silence. Any further storage import from this directory must arrive as an
  // amendment to this leg, the way the consumer allow-list above does.
  const ALLOWED_LANE_STORAGE_EDGE = new Map([
    // A4-PR0, reviewed above.
    ['proposal-store.ts', ['../../storage/schema/permission-overlay.js']],
    // PRE-EXISTING since alpha3 PR-A (`governance/slot.ts:56`), listed to close
    // the set — the slot CAS needs the durable row version. Not reviewed by
    // A4-PR0; changing it must be deliberate.
    ['slot.ts', ['../../storage/schema/index.js']],
  ])

  it('no governance-lane module imports storage outside the allow-listed edge', () => {
    const offenders: string[] = []
    const laneDir = join(RUNTIME_ROOT, 'governance')
    for (const entry of readdirSync(laneDir).sort()) {
      if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry.endsWith('.d.ts')) continue
      const source = readFileSync(join(laneDir, entry), 'utf8')
      for (const match of source.matchAll(/from '(\.\.\/\.\.\/storage\/[^']+)'/g)) {
        const specifier = match[1] ?? ''
        const allowed = ALLOWED_LANE_STORAGE_EDGE.get(entry) ?? []
        if (!allowed.includes(specifier)) offenders.push(`${entry} -> ${specifier}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the allow-list is not vacuous, and no lane module reaches a repository', () => {
    // The edge is really there (a leg that passes because nothing imports
    // anything is not owning a dependency).
    expect(PROPOSAL_STORE_SOURCE).toMatch(/from '\.\.\/\.\.\/storage\/schema\/permission-overlay\.js'/)
    // Schema vocabulary only, never a REPOSITORY: a lane must not gain a
    // durable-write path by reaching past its injected ports (import-specific —
    // the modules document the ban in their own headers, so a bare text match
    // would fire on the documentation).
    for (const [name, source] of [['proposal-store.ts', PROPOSAL_STORE_SOURCE], ['slot.ts', SLOT_SOURCE], ['permission-mutation.ts', MUTATION_SOURCE], ['service.ts', SERVICE_SOURCE]]) {
      expect(source, name).not.toMatch(/from '\.\.\/\.\.\/storage\/repositories\//)
    }
    // The kernel's own rule is untouched by this amendment: it mirrors its
    // bound and keeps zero runtime edge to storage (the pin above).
    expect(MUTATION_SOURCE).not.toMatch(/from '\.\.\/\.\.\/storage\//)
  })
})

// ---------------------------------------------------------------------------
// A4-PR1 (ADR A3-9/A2-3, plan Task 1 lane B): the shared authority grammar was
// moved DOWN into `packages/domain/authority-envelope` so the Blueprint hash
// carrier and the governance algebra cannot hold two copies of one vocabulary.
// The move is only an improvement while the DIRECTION holds, and a direction is
// not visible to any runtime assertion — `import type` erases, and a value edge
// from domain back to runtime would load fine right up until the day a stored
// blueprint hash meant something else. So the import graph is policed here, in
// the file that already owns this lane\'s dependency law.
// ---------------------------------------------------------------------------

describe('the shared authority grammar stays a DOMAIN LEAF (A4-PR1, ADR A3-9/A2-3)', () => {
  it('the domain lane declares no edge but its own interior', () => {
    // The leaf law, stated as the strongest thing that is true today: every
    // module specifier inside `domain/authority-envelope` is INTERNAL to it.
    // Not "no runtime imports" — NOTHING, so the vocabulary cannot acquire a
    // dependency by accretion the way `governance/` had to amend an allow-list
    // twice above.
    const offenders: string[] = []
    const files = readdirSync(DOMAIN_ENVELOPE_DIR)
      .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.d.ts'))
      .sort()
    // Non-vacuous: the lane really has sources (a walk over an empty directory
    // is the classic green-that-means-nothing).
    expect(files.length).toBeGreaterThan(1)
    for (const entry of files) {
      const source = readFileSync(join(DOMAIN_ENVELOPE_DIR, entry), 'utf8')
      for (const match of source.matchAll(/\bfrom '([^']+)'/g)) {
        const specifier = match[1] ?? ''
        if (specifier.startsWith('./')) continue
        offenders.push(`${entry} -> ${specifier}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('PR1 ships the ceiling adapter UNWIRED: the barrel is its only importer', () => {
    // The plan's own lane-C instruction — "keep the reader unused by production
    // authorization in PR1" — is a claim about the import graph, so it is pinned
    // as one (the A4-PR0 precedent: a lane that ships unwired says so in a test,
    // because an accidental wiring in a later PR must fail something).
    const importers: string[] = []
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
        if (!readFileSync(full, 'utf8').includes("from './authority-ceiling.js'")
          && !readFileSync(full, 'utf8').includes('authority-ceiling.js')) continue
        importers.push(relative(RUNTIME_ROOT, full))
      }
    }
    visit(RUNTIME_ROOT)
    expect(importers).toEqual([`governance${sep}index.ts`])
    // …and nothing outside the governance directory names the ceiling algebra
    // at all, so PR2's wiring arrives as a reviewed edit, not a silent import.
    const outside: string[] = []
    for (const pkg of ['runtime', 'tools', 'remote', 'client', 'domain'] as const) {
      const pkgRoot = pkg === 'runtime' ? RUNTIME_ROOT : join(RUNTIME_ROOT, '..', pkg)
      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry)
          const st = statSync(full)
          if (st.isDirectory()) {
            if (entry === 'node_modules' || entry === 'dist' || entry === 'test') continue
            walk(full)
            continue
          }
          if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry.endsWith('.d.ts')) continue
          const rel = relative(RUNTIME_ROOT, full)
          if (rel.startsWith(`governance${sep}authority-ceiling.ts`)) continue
          if (rel.startsWith(`governance${sep}index.ts`)) continue
          const source = readFileSync(full, 'utf8')
          // Match the ALGEBRA, not the English: `grantCeiling`/`bindingDocs` are
          // this module's exported names, and a prose mention in a doc comment
          // is not a call site.
          if (/\b(grantCeiling|bindingDocs)\s*\(/.test(source)) outside.push(rel)
        }
      }
      try {
        statSync(pkgRoot)
      } catch {
        continue
      }
      walk(pkgRoot)
    }
    expect(outside).toEqual([])
  })

  it('the runtime consumes that grammar as ONE implementation, not a copy', () => {
    // Identity, not equality: a re-declared copy that agrees today is the drift
    // this whole lane exists to prevent (the same reason the pin above compares
    // PERMISSION_EFFECT_PRECEDENCE by `toBe`).
    expect(mutationModule.matcherCovers).toBe(domainEnvelope.matcherCovers)
    expect(lane.matcherCovers).toBe(domainEnvelope.matcherCovers)
    expect(mutationModule.PERMISSION_EFFECT_PRECEDENCE).toBe(domainEnvelope.AUTHORITY_EFFECT_PRECEDENCE)
    expect(mutationModule.PERMISSION_RESOURCE_MATCHER_KINDS).toBe(domainEnvelope.AUTHORITY_MATCHER_KINDS)
    // The ceiling adapter reaches the proposal vocabulary as a TYPE ONLY
    // (correction X5-E1): it needs the closed position union, not an edge to the
    // proposal write path. A value import here would be a storage-adjacent edge
    // this file has not reviewed.
    expect(AUTHORITY_CEILING_SOURCE).toContain("import type { ProposalAuthorityPosition } from './proposal-store.js'")
    expect(AUTHORITY_CEILING_SOURCE).not.toMatch(/^import \{[^}]*\} from '\.\/proposal-store\.js'/m)
    expect(AUTHORITY_CEILING_SOURCE).not.toMatch(/from '\.\.\/\.\.\/storage\//)
  })
})
