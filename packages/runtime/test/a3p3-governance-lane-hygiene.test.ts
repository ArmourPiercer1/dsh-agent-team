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

  it('the SAME allow-list covers the governance BARREL, which the leg above cannot see (X9)', () => {
    // THE HOLE, stated precisely. The leg above matches a per-MODULE specifier —
    // `permission-mutation.js`. `governance/index.ts` re-exports 36 of the same
    // names, so any production file in this repository could write
    // `import { planPermissionMutation } from '../../governance/index.js'` and
    // satisfy that leg exactly as written, with the suite green. The allow-list is
    // only as wide as what the matcher can observe, and a matcher narrowed to
    // per-file consumers to cut false positives had silently narrowed its own
    // field of view — correction X9's exact shape (there, a comment-strip order ate
    // 279 lines of `host.ts` and blinded the leg that was supposed to watch them).
    //
    // Covered here: value imports, TYPE-only imports, and namespace imports whose
    // usage site is `lane.<name>(...)` — three windows, because a rule that only
    // closes the first is closed again by the second. The name set is DERIVED from
    // the barrel rather than written down, so a re-export added tomorrow is policed
    // on the day it lands instead of the day someone remembers.
    const barrelSource = readFileSync(join(RUNTIME_ROOT, 'governance', 'index.ts'), 'utf8')
    const mutationNames = new Set<string>()
    for (const block of barrelSource.matchAll(/export(?: type)? \{([^}]*)\} from '\.\/permission-mutation\.js'/g)) {
      for (const entry of (block[1] ?? '').split(',')) {
        const name = entry.trim().split(/\s+as\s+/).pop()?.trim()
        if (name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) mutationNames.add(name)
      }
    }
    // A vacuous name set would make every assertion below green.
    expect(mutationNames.size, 'the barrel export scan found nothing to police').toBeGreaterThan(8)

    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
    /** Does this file reach a permission-mutation name through the barrel? */
    const importsViaBarrel = (rel: string, source: string): boolean => {
      const inLane = rel.startsWith(`governance${sep}`)
      const barrelHere = inLane ? /from\s*['"]\.\/index\.js['"]/.test(source) : false
      const barrelPath = /from\s*['"][^'"]*governance\/index\.js['"]/.test(source)
      if (!barrelHere && !barrelPath) return false
      const body = strip(source)
      for (const name of mutationNames) {
        if (new RegExp(`\\b${name}\\b`).test(body)) return true
      }
      return false
    }
    /** The COMBINED predicate: the module specifier window AND the barrel window.
     *  One predicate, so "fixed in one place" cannot mean "open in the other". */
    const reachesKernel = (rel: string, source: string): boolean =>
      /governance\/permission-mutation\.js|permission-mutation\.js['"]/.test(source) || importsViaBarrel(rel, source)

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
        if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry.endsWith('.d.ts')) continue
        const rel = relative(RUNTIME_ROOT, full)
        if (rel.startsWith(`governance${sep}permission-mutation.ts`)) continue
        if (rel.startsWith(`governance${sep}service.ts`)) continue
        if (rel.startsWith(`governance${sep}types.ts`)) continue
        if (rel.startsWith(`governance${sep}index.ts`)) continue
        // PR4's audited assembly layer is the ONE production consumer, by barrel as
        // well as by module — measured, not assumed: it is the only barrel importer
        // in the tree that names a mutation symbol at all.
        if (rel === join('src', 'plugin', 'permission-plane.ts')) continue
        if (reachesKernel(rel, readFileSync(full, 'utf8'))) offenders.push(rel)
      }
    }
    for (const pkg of ['runtime', 'tools', 'remote', 'client', 'domain']) {
      const pkgRoot = pkg === 'runtime' ? RUNTIME_ROOT : join(RUNTIME_ROOT, '..', pkg)
      try {
        statSync(pkgRoot)
      } catch {
        continue
      }
      visit(pkgRoot)
    }
    expect(offenders).toEqual([])

    // NON-VACUITY, ONE CASE PER WINDOW THE TIGHTENING CREATES. `root.ts` is the
    // host for the injections because it is a REAL barrel importer that names no
    // mutation symbol, so every hit below is produced by the injected line and
    // nothing else — and the two precision cases are what stop this leg from
    // flagging every barrel consumer in the repository.
    const barrelHost = readFileSync(join(RUNTIME_ROOT, 'src', 'plugin', 'root.ts'), 'utf8')
    const cases: readonly (readonly [label: string, rel: string, source: string, expected: boolean])[] = [
      ['barrel value import', join('src', 'plugin', 'x.ts'), `${barrelHost}\nimport { planPermissionMutation } from '../../governance/index.js'\n`, true],
      ['barrel TYPE import', join('src', 'plugin', 'x.ts'), `${barrelHost}\nimport type { PermissionMutationPlan } from '../../governance/index.js'\n`, true],
      ['barrel NAMESPACE import used at a call site', join('src', 'plugin', 'x.ts'), `${barrelHost}\nimport * as lane from '../../governance/index.js'\nconst p = lane.planPermissionMutation\n`, true],
      ['per-module import (the window the leg above already covers)', join('src', 'plugin', 'x.ts'), `${barrelHost}\nimport { planPermissionMutation } from '../../governance/permission-mutation.js'\n`, true],
      ['barrel import of a NON-mutation name only', join('src', 'plugin', 'x.ts'), `${barrelHost}\nimport { createTeamRuntimeRoot } from '../../governance/index.js'\n`, false],
      // The precision window the tightening creates: a LOCAL symbol that happens
      // to share a name must not be flagged in a file that imports neither the
      // module nor the barrel. Hosted on a source with no barrel import, because
      // `root.ts` has one and the combination is exactly what the rule reads as an
      // edge — which is the case above, not this one.
      ['a same-named local with no governance import at all', join('src', 'plugin', 'x.ts'), `export const planPermissionMutation = 1\n`, false],
      ['a mention inside a comment only', join('src', 'plugin', 'x.ts'), `${barrelHost}\n// planPermissionMutation is not imported here\n`, false],
      ['a real call on a line that also carries a comment', join('src', 'plugin', 'x.ts'), `${barrelHost}\nconst p = planPermissionMutation // trailing comment\n`, true],
      ['an in-lane `./index.js` barrel import', join('governance', 'something.ts'), `import { planPermissionMutation } from './index.js'\n`, true],
    ]
    for (const [label, rel, source, expected] of cases) {
      expect(reachesKernel(rel, source), `the combined predicate is wrong about: ${label}`).toBe(expected)
    }
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
  /** Every way a TypeScript module can name another module, EACH WITH ITS OWN
   *  SAMPLE AND EXPECTED SPECIFIER. The first draft had a single `from '…'`
   *  pattern — it typechecks and lints clean while missing `await
   *  import('node:fs')`, `require('…')`, a double-quoted specifier and a
   *  side-effect import (review SF3) — and its replacement had a COLLECTIVE
   *  non-vacuity assertion, which the ordinary `from '…'` alone satisfies, so a
   *  typo in any of the other three stayed green forever (round-2 review item 3).
   *  Every pattern is therefore exercised against its own sample below, and the
   *  exercise runs through `externalSpecifiersIn` — proving not that a regex
   *  matches, but that a match REACHES THE VERDICT. */
  const SPECIFIER_PATTERNS: readonly (readonly [
    label: string,
    pattern: RegExp,
    sample: string,
    expected: string | null,
  ])[
  ] = [
    ['from (internal)', /\bfrom\s*['"]([^'"]+)['"]/g, `export * from './internal.js';`, './internal.js'],
    ['from (double-quoted, external)', /\bfrom\s*['"]([^'"]+)['"]/g, `import { join } from "node:path";`, 'node:path'],
    ['dynamic import()', /\bimport\s*\(\s*['"]([^'"]+)['"]/g, `const read = async () => await import('node:fs');`, 'node:fs'],
    ['require()', /\brequire\s*\(\s*['"]([^'"]+)['"]/g, `const legacy = require('./cjs-thing.js');`, './cjs-thing.js'],
    ['side-effect import', /\bimport\s+['"]([^'"]+)['"]/g, `import './side-effect.js';`, './side-effect.js'],
  ]

  const specifiersIn = (source: string): string[] => {
    const found = new Set<string>()
    for (const [, pattern] of SPECIFIER_PATTERNS) {
      for (const match of source.matchAll(pattern)) found.add(match[1] ?? '')
    }
    return [...found]
  }

  /** The leaf law's verdict: an internal specifier is one that starts at home. */
  const externalSpecifiersIn = (source: string): string[] =>
    specifiersIn(source).filter((specifier) => !specifier.startsWith('./'))

  /** Comments removed, so "names a symbol" means code and not prose — with the
   *  one property the first draft lacked: **stripping may eat text inside a
   *  comment, never code** (round-2 review item 1, a REGRESSION this file
   *  introduced).
   *
   *  The first draft stripped `/* … *\/` with an UNANCHORED opener BEFORE
   *  removing line comments, so a `/*` occurring only inside a `//` comment or a
   *  string literal opened a phantom block whose closer could be hundreds of
   *  lines away. Two live instances in this tree: `src/plugin/host.ts:1034` (a
   *  `//` line containing `@deepseek-ai/*`, whose next star-slash sits at :1313
   *  — **~279 lines of
   *  real async service methods deleted before the scan**) and
   *  `packages/client/src/ui/locales.ts:292` (a `'…/teammates/*.md'` string,
   *  closer at :551 — ~259 more). A PR2 wiring of `grantCeiling` /
   *  `narrowingForApproval` / `facts.teamHardEnvelope` placed inside either
   *  window reddened NOTHING — in the exact file this leg's own comment names.
   *  The parent leg read RAW source: over-strict but TOTAL, and totality is what
   *  a coverage guard owes. So: line comments FIRST (that is what removes a
   *  `//`-embedded `/*`), then block comments whose opener STARTS a line (a `/*`
   *  inside a string is mid-line, so it cannot open anything). What remains is
   *  over-stripping in the safe direction only — a prose mention counting as a
   *  use, which fails LOUDLY — and `the comment stripper cannot delete code`
   *  below is the receipt that this cannot regress quietly. */
  const codeOnly = (source: string): string =>
    source.replace(/^\s*\/\/.*$/gm, ' ').replace(/^\s*\/\*[\s\S]*?\*\//gm, ' ')

  /** Walk a directory tree, skipping only what is not source. */
  const walkTs = (dir: string, into: string[]): string[] => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === 'test') continue
        walkTs(full, into)
        continue
      }
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts') || entry.endsWith('.test.ts')) continue
      into.push(full)
    }
    return into
  }

  it('the domain lane declares no edge but its own interior', () => {
    // The leaf law, stated as the strongest thing that is true today: every
    // module specifier inside `domain/authority-envelope` is INTERNAL to it. Not
    // "no runtime imports" — NOTHING, so the vocabulary cannot acquire a
    // dependency by accretion the way `governance/` had to amend an allow-list
    // twice above. RECURSIVE, because a lane that grows a subdirectory must not
    // quietly leave it unwatched.
    const files = walkTs(join(DOMAIN_ROOT, 'authority-envelope'), []).sort()
    // Non-vacuity, twice over: the lane really has sources, and the recursive
    // walk really reaches its `src/` directory (a walk that quietly stopped at
    // the lane root would otherwise look clean)…
    expect(files.length).toBeGreaterThan(1)
    expect(files.some((file) => file.startsWith(`${DOMAIN_ENVELOPE_DIR}${sep}`)), 'the walk must cover the lane src directory').toBe(true)
    // …and the patterns really fire on them. Without this a typo in any pattern
    // above turns the leg green forever — the exact failure mode the first draft
    // of this leg had.
    let matchedSpecifiers = 0
    const offenders: string[] = []
    for (const file of files) {
      // CODE ONLY: this lane's doc comments discuss imports at length, and a
      // prose `import` two lines above a quoted word is not a module edge — the
      // first run of this leg flagged `-> undetermined`, which is a doc-comment
      // artifact. Stripping comments cannot INVENT an edge; it can only stop
      // prose from counting as one, so the guard stays strict in the direction
      // that matters.
      const source = codeOnly(readFileSync(file, 'utf8'))
      for (const specifier of specifiersIn(source)) {
        matchedSpecifiers += 1
        if (specifier.startsWith('./')) continue
        offenders.push(`${relative(DOMAIN_ROOT, file)} -> ${specifier}`)
      }
    }
    expect(matchedSpecifiers, 'the specifier patterns matched nothing — the walk is vacuous, not clean').toBeGreaterThan(0)
    expect(offenders).toEqual([])
  })

  it('every specifier pattern is exercised and reaches a verdict (round-2 item 3)', () => {
    // Per-pattern, not collective. `matchedSpecifiers > 0` is satisfied by the
    // ordinary `from '…'` alone, so a typo in the `import(` / `require(` /
    // side-effect pattern would leave the leaf law enforced by three of four
    // patterns and the gap would be invisible forever — which is exactly what the
    // comment above claims to have removed.
    for (const [label, pattern, sample, expected] of SPECIFIER_PATTERNS) {
      expect((sample.match(pattern) ?? []).length, `pattern "${label}" matched nothing in its own sample`).toBeGreaterThan(0)
      const offenders = externalSpecifiersIn(sample)
      if (expected === null || expected.startsWith('./')) {
        expect(offenders, `pattern "${label}" calls an internal sample an offender`).toEqual([])
      } else {
        // The stronger half: the match must arrive at the OFFENDER list, so the
        // pattern is wired into the verdict rather than merely clever.
        expect(offenders, `pattern "${label}" matched but never reached a verdict`).toContain(expected)
      }
    }
  })

  it('the comment stripper cannot delete code (round-2 item 1, a regression receipt)', () => {
    // The regression in miniature: a `//` line holding a block-comment OPENER,
    // real code below it, and the closer further down. Under the first draft's
    // order — block comments first, unanchored — the opener was "real", its
    // closer was found much later, and every call site in between vanished from
    // the walk, silently and green.
    const sample = [
      'const before = 1',
      '// a glob like @deepseek-ai/* inside a line comment',
      'const wiring = grantCeiling(reviewer, documents, scope, contains)',
      '/* a genuine block comment mentioning narrowingForApproval */',
      'const after = 2',
    ].join('\n')
    const stripped = codeOnly(sample)
    expect(stripped).toContain('grantCeiling(reviewer, documents, scope, contains)')
    expect(stripped).toContain('const before = 1')
    expect(stripped).toContain('const after = 2')
    expect(stripped).not.toContain('@deepseek-ai')
    expect(stripped).not.toContain('narrowingForApproval') // the genuine block comment is gone
    // And on the two files that made this real: code INSIDE each eaten window
    // must still be visible to the name walk.
    const host = codeOnly(readFileSync(join(RUNTIME_ROOT, 'src', 'plugin', 'host.ts'), 'utf8'))
    expect(host, 'host.ts around :1100 was being stripped away').toContain('composedPreset(agentCtx: unknown)')
    const locales = codeOnly(readFileSync(join(RUNTIME_ROOT, '..', 'client', 'src', 'ui', 'locales.ts'), 'utf8'))
    expect(locales, 'client/locales.ts inside the 292-551 window was being stripped away').toContain("'intent.startHere'")
  })

  it('the ceiling adapter and the PR2 evaluator each have ONE audited consumer set per name', () => {
    // The plan's lane-C instruction — "keep the reader unused by production
    // authorization in PR1" — is the PR's headline claim, and the first draft of
    // this leg checked two of the new names and none of the reader
    // (review SF2): `governance/service.ts` calling `narrowingForApproval(...)`
    // or `host.ts` calling `facts.teamHardEnvelope(...)` would have left every
    // test green. So the claim is now pinned per NAME — every export of the
    // adapter, derived from the module below, plus the domain names it composes —
    // with the consumer set stated rather than inferred. A new consumer must arrive here as an
    // amendment, the way the consumer allow-list at the top of this file does.
    const CEILING_LANE = ['governance/authority-ceiling.ts', 'governance/index.ts']
    const DOMAIN_LANE = ['../domain/authority-envelope/src/authority-envelope.ts', '../domain/authority-envelope/src/index.ts']
    // A4-PR2 lane A amendment: the evaluator module joins the audited set as the
    // adapter's FIRST consumer, and it is named per row below rather than
    // wildcarded — the whole value of this leg is that a consumer set is STATED,
    // so "the evaluator needed it" can never again be a reason not to look.
    const RUNTIME_AUTHORITY = 'governance/runtime-authority.ts'
    const CEILING_AND_EVALUATOR = [...CEILING_LANE, RUNTIME_AUTHORITY]
    // A4-PR2 lane C amendment: the v3 mutation gate. `service.ts` is the FIRST
    // consumer outside the ceiling lane itself — the row it joins is stated per
    // name below, and it joins ONLY the names the gate calls. `types.ts` joins
    // exactly the two types the lane's injected reader carries. Widening these two
    // file names into a wildcard would have been the cheap move and would have
    // destroyed the leg: the whole point is that a new consumer of the ladder has
    // to be named.
    const SERVICE = 'governance/service.ts'
    const LANE_TYPES = 'governance/types.ts'
    const CEILING_AND_GATE = [...CEILING_AND_EVALUATOR, SERVICE]
    // The list's COMPLETENESS is asserted below against the module's own export
    // scan, so this array cannot quietly fall behind the file it polices.
    const SURFACE: readonly (readonly [name: string, allowed: readonly string[]])[] = [
      // The approval-plane adapter: the barrel plus its own module, nothing else.
      // Every row below that reads `CEILING_AND_EVALUATOR` moved there in
      // A4-PR2 lane A: `runtime-authority.ts` is the adapter's first consumer, and
      // it consumes the ceiling, the document-pair type, and the refusal
      // vocabulary because an unevaluable document must reach it as a CODE (a bare
      // TypeError has `code === undefined`, which the outcome mapping would read
      // as "not one of mine" and rethrow out of the governance path).
      ['bindingDocs', CEILING_LANE],
      ['grantCeiling', CEILING_AND_GATE],
      ['AuthorityEnvelopeDocuments', [...CEILING_AND_GATE, LANE_TYPES]],
      ['AuthorityBindingError', CEILING_AND_GATE],
      ['AUTHORITY_CEILING_ERROR_CODES', CEILING_AND_GATE],
      ['AuthorityBindingProblem', CEILING_LANE],
      ['AuthorityCeilingErrorCode', CEILING_LANE],
      ['AuthorityCeilingScope', CEILING_AND_EVALUATOR],
      // The three-way document read: also the plane that PRODUCES it, as a
      // TYPE-ONLY alias (asserted type-only below — the alias is what makes
      // `unavailable → undefined` unrepresentable, review SF1).
      ['AuthorityDocumentRead', [...CEILING_LANE, join('src', 'plugin', 'permission-plane.ts')]],
      ['AuthorityDocumentSlot', CEILING_LANE],
      // ---- A4-PR2 lane A: the ladder, the expansion plane, and the evaluator.
      // The positional binding TABLE, now read by both planes (the reason it moved
      // out of `bindingDocs`'s `switch` into one exhaustive `Record`: two tables
      // drift, and A5-1 makes "which documents bind" a single fact).
      ['AuthorityDocumentName', [...CEILING_AND_EVALUATOR, join('src', 'plugin', 'permission-plane.ts')]],
      ['boundDocumentNames', CEILING_AND_EVALUATOR],
      // The ladder. `AUTHORITY_RANK` is the one ordering in the repository, so its
      // consumer set is short on purpose: anything that wants a rank calls
      // `authorityRank` and gets the closed-set refusal with it.
      ['AUTHORITY_RANK', CEILING_AND_EVALUATOR],
      ['authorityRank', CEILING_AND_EVALUATOR],
      ['isHigherAuthority', CEILING_AND_EVALUATOR],
      // WHO MAY ACT — the ladder half of "legal approval", never fused with the
      // ceiling half (ADR A3-2, spec §7.4).
      ['mayReview', CEILING_AND_EVALUATOR],
      // The EXPANSION-plane ceiling: the number `grantCeiling` must never be
      // confused with (correction X7-R5). PR2 lane C's mutation gate is its next
      // consumer and must arrive as another amendment to this row.
      ['expansionCeiling', CEILING_AND_GATE],
      // The evaluator module's own surface. Lane C wired `governance/service.ts`
      // into the rows the ceiling gate calls (this comment promised that amendment
      // in lane A) — and only those rows, so a later PR that reaches for
      // `evaluateAuthorityCeiling` from somewhere else still has to say so.
      // A4-PR2 rework: `src/plugin/permission-plane.ts` joins as the FIRST
      // production consumer — it is where the ladder position of the acting
      // surface is chosen (plan:261), which is precisely the mapping that must
      // not be re-decided at each call site.
      ['RuntimeAuthority', [RUNTIME_AUTHORITY, 'governance/index.ts', LANE_TYPES, join('src', 'plugin', 'permission-plane.ts')]],
      ['AuthorityEvaluation', [RUNTIME_AUTHORITY, 'governance/index.ts']],
      ['AuthorityEvaluationEvidence', [RUNTIME_AUTHORITY, 'governance/index.ts']],
      ['AuthorityEvaluationInput', [RUNTIME_AUTHORITY, 'governance/index.ts']],
      ['AuthorityEvaluationOutcome', [RUNTIME_AUTHORITY, 'governance/index.ts']],
      ['evaluateAuthorityCeiling', CEILING_AND_GATE],
      // The domain algebra: the domain lane, plus the ceiling adapter where it
      // composes them. NOT the permission plane and NOT any decision path.
      ['narrowingForApproval', [...DOMAIN_LANE, ...CEILING_LANE]],
      ['meetAuthorityCeilings', [...DOMAIN_LANE, ...CEILING_LANE]],
      ['meetAllAuthorityCeilings', [...DOMAIN_LANE, ...CEILING_LANE]],
      ['CEILING_IDENTITY', [...DOMAIN_LANE, ...CEILING_LANE]],
      ['CEILING_NO_AUTHORITY', [...DOMAIN_LANE, ...CEILING_LANE]],
      ['effectiveAuthorityCeiling', [...DOMAIN_LANE, ...CEILING_LANE]],
      ['parseAuthorityEnvelope', DOMAIN_LANE],
      // The AST vocabulary: the domain lane and the ONE canonicalizer.
      ['AuthorityEnvelopeAst', [...DOMAIN_LANE, join('src', 'plugin', 'permission-plane.ts')]],
      ['AuthorityEnvelopeAstMatcher', [...DOMAIN_LANE, join('src', 'plugin', 'permission-plane.ts')]],
      ['AuthorityHardCeilingRead', [join('src', 'plugin', 'permission-plane.ts')]],
    ]
    const consumersOf = (name: string): string[] => {
      const hits: string[] = []
      for (const pkg of ['runtime', 'tools', 'remote', 'client', 'domain'] as const) {
        const pkgRoot = pkg === 'runtime' ? RUNTIME_ROOT : join(RUNTIME_ROOT, '..', pkg)
        for (const file of walkTs(pkgRoot, [])) {
          const source = codeOnly(readFileSync(file, 'utf8'))
          // Call form OR import/type position — `\bname\b` on comment-stripped
          // code, so a mention in prose cannot satisfy it and a real call cannot
          // hide in a comment.
          if (!new RegExp(`\\b${name}\\b`).test(source)) continue
          // Paths are reported relative to the runtime root, so a domain-lane
          // entry reads `../domain/…` — the allow-lists above are written in
          // exactly that notation.
          hits.push(relative(RUNTIME_ROOT, file))
        }
      }
      return hits.sort()
    }
    const violations: string[] = []
    const policed = new Set(SURFACE.map(([name]) => name))
    for (const [name, allowed] of SURFACE) {
      const allowedSet = new Set(allowed)
      for (const file of consumersOf(name)) {
        if (!allowedSet.has(file)) violations.push(`${name} referenced by ${file}`)
      }
    }
    expect(violations).toEqual([])

    // NON-VACUITY, PER NAME (round-2 review item 2). A zero-consumer name is not
    // "clean", it is a name nobody is policing: either it was spelled wrong, or
    // the thing it names is no longer referenced anywhere and the allow-list is
    // describing a module that no longer exists. Both are silent.
    for (const [name] of SURFACE) {
      expect(consumersOf(name), `"${name}" is policed against nothing`).not.toEqual([])
    }

    // COMPLETENESS: every EXPORT of the adapter must be policed by name, and
    // every name policed against the adapter file must be an export of it. The
    // hand-maintained list is what let `AuthorityCeilingErrorCode` sit exported
    // and unpinned; deriving both directions makes an unpoliced export a failure
    // instead of an omission.
    // A4-PR2: the evaluator module is policed by the SAME rules as the adapter it
    // consumes. Extending the scan (rather than writing a second list) is what
    // keeps "every export is audited by name" true for a module that did not exist
    // when this leg was written.
    const RUNTIME_AUTHORITY_SOURCE = readFileSync(join(RUNTIME_ROOT, 'governance', 'runtime-authority.ts'), 'utf8')
    const exportNames = (source: string): string[] =>
      [...source.matchAll(/^export (?:const|function|class|interface|type) ([A-Za-z0-9_]+)/gm)]
        .map((match) => match[1] ?? '')
        .filter((name) => name.length > 0)
    const adapterExports = [...exportNames(AUTHORITY_CEILING_SOURCE), ...exportNames(RUNTIME_AUTHORITY_SOURCE)].sort()
    expect(adapterExports.length, 'the export scan found nothing to police').toBeGreaterThan(8)
    const unpolishedExports = adapterExports.filter((name) => !policed.has(name))
    expect(unpolishedExports, 'every export of authority-ceiling.ts or runtime-authority.ts must appear in SURFACE').toEqual([])
    // …and the other direction: every policed name must be a real export of a
    // module in this graph, so a typo in the list cannot police nothing.
    const grammarSource = readFileSync(join(DOMAIN_ENVELOPE_DIR, 'authority-envelope.ts'), 'utf8')
    const knownExports = new Set<string>([
      ...adapterExports,
      ...[...grammarSource.matchAll(/^export (?:const|function|interface|type) ([A-Za-z0-9_]+)/gm)].map((m) => m[1] ?? ''),
      // The plane's own alias, which is a name this file polices but the adapter
      // does not export.
      'AuthorityHardCeilingRead',
    ])
    const phantomNames = [...policed].filter((name) => !knownExports.has(name))
    expect(phantomNames, 'a policed name must be a real export, not a typo').toEqual([])

    // THE BARREL. The importer leg below greps `authority-ceiling.js`
    // SPECIFIERS, so a consumer that reaches these symbols THROUGH
    // `governance/index.ts` is invisible to it (round-2 review item 2). The
    // per-name walk above is barrel-agnostic — it matches the NAME, wherever it
    // was imported from — and the barrel's own exported subset is pinned here so
    // a new export through it lands in review rather than in production.
    const barrelValueNames = Object.keys(lane).filter((name) => policed.has(name)).sort()
    expect(barrelValueNames).toEqual([
      'AUTHORITY_CEILING_ERROR_CODES',
      'AUTHORITY_RANK',
      'AuthorityBindingError',
      'authorityRank',
      'bindingDocs',
      'evaluateAuthorityCeiling',
      'expansionCeiling',
      'grantCeiling',
      'isHigherAuthority',
      'mayReview',
    ])
    const barrelTypeNames = [...readFileSync(join(RUNTIME_ROOT, 'governance', 'index.ts'), 'utf8').matchAll(/^export type \{([^}]*)\}/gm)]
      .flatMap((block) => (block[1] ?? '').split(',').map((entry) => entry.trim()).filter((entry) => policed.has(entry)))
      .sort()
    expect(barrelTypeNames).toEqual([
      'AuthorityBindingProblem',
      'AuthorityCeilingScope',
      'AuthorityDocumentName',
      'AuthorityEnvelopeDocuments',
      'AuthorityEvaluation',
      'AuthorityEvaluationEvidence',
      'AuthorityEvaluationInput',
      'AuthorityEvaluationOutcome',
      'RuntimeAuthority',
    ])

    // The READER, whose consumer set is empty by design. `facts.teamHardEnvelope`
    // is the name a PR2 wiring would call; a property DEFINITION is not a call,
    // so the call form is what must be empty outside tests.
    const readerCalls: string[] = []
    for (const pkg of ['runtime', 'tools', 'remote', 'client', 'domain'] as const) {
      const pkgRoot = pkg === 'runtime' ? RUNTIME_ROOT : join(RUNTIME_ROOT, '..', pkg)
      for (const file of walkTs(pkgRoot, [])) {
        if (/\.teamHardEnvelope\s*\(/.test(codeOnly(readFileSync(file, 'utf8')))) {
          readerCalls.push(relative(RUNTIME_ROOT, file))
        }
      }
    }
    // AMENDED by A4-PR2 (plan:260): PR1 shipped this reader UNUSED by design and
    // pinned the call set EMPTY. PR2 wires it, so the pin moves from "nobody" to
    // "exactly one, and it is the module ADR A5-12 names": `permission-plane.ts`.
    // The law that survives the amendment is the important half — the governance
    // SERVICE must never call the hard-ceiling reader itself, because a service
    // that reads the document it is about to judge is a service that decides which
    // Teams are v3 (ADR A5-12 puts that switch in the plane). Anything beyond this
    // one file is still a violation.
    expect(readerCalls, 'exactly one production caller of the v3 hard-ceiling reader').toEqual([
      join('src', 'plugin', 'permission-plane.ts'),
    ])
    expect(readerCalls).not.toContain(join('governance', 'service.ts'))
    // And the plane's import of the ceiling module is TYPE-ONLY, so PR1 adds no
    // runtime governance→plugin edge: the reader's alias must not become a load
    // order dependency for a module the runtime does not otherwise use.
    const planeSource = readFileSync(join(RUNTIME_ROOT, 'src', 'plugin', 'permission-plane.ts'), 'utf8')
    expect(planeSource).toMatch(/^import type \{ AuthorityDocumentRead \} from '\.\.\/\.\.\/governance\/authority-ceiling\.js'$/m)
    expect(planeSource).not.toMatch(/^import \{[^}]*\} from '\.\.\/\.\.\/governance\/authority-ceiling\.js'$/m)
  })

  it('the ceiling module has exactly the importers PR1 + PR2 lane C gave it', () => {
    // The barrel re-exports the adapter (its declared surface) and the plane
    // imports its TYPE (asserted above). Anything else importing
    // `authority-ceiling.js` is a wiring, and a wiring in PR1 is out of scope.
    const importers = new Set<string>()
    for (const file of walkTs(RUNTIME_ROOT, [])) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\bfrom\s*['"]([^'"]*authority-ceiling\.js)['"]/g)) {
        if ((match[1] ?? '').length === 0) continue
        // A Set, because `governance/index.ts` re-exports the VALUE surface and
        // the TYPE surface in two statements — two statements, one importer.
        importers.add(relative(RUNTIME_ROOT, file))
      }
    }
    // A4-PR2 lane A: the evaluator joins the importers. It is the wiring the plan
    // scheduled for this PR ("PR2 adds mayReview + authorityRank here", lane A owns
    // the evaluator), and its direction is the reviewed one — governance →
    // governance, no plugin or storage edge.
    // A4-PR2 lane C: `governance/service.ts` and `governance/types.ts` join. This
    // is the wiring the plan scheduled for THIS PR (lane C: "v3 direct permission
    // mutation obeying both authority ceilings" — the gate lives in the service,
    // the injected reader's contract in the lane types), and both edges are
    // governance → governance: no plugin edge, no storage edge, and neither file
    // reaches `narrowingForApproval` or the domain algebra (pinned by their SURFACE
    // rows above, which list them only for the ceiling names the gate calls).
    expect([...importers].sort()).toEqual([
      join('governance', 'index.ts'),
      join('governance', 'runtime-authority.ts'),
      join('governance', 'service.ts'),
      join('governance', 'types.ts'),
      join('src', 'plugin', 'permission-plane.ts'),
    ].sort())
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
    // this file has not reviewed. This is also the pin behind
    // `BASELINE-CLOSURE.md`'s "no new governance→storage edge, the allow-list did
    // not move" paragraph.
    // THE IMPORT, not just the shape. Assignability cannot see a locally re-spelled
    // structural copy — same fields, no import at all, and both directions of the
    // `Assignable` tuple in `a4p1-authority-envelope.test.ts` stay `true` (X7-R3
    // fake-mode #1). What catches it is this: the PR0 names must be DEFINED AS the
    // imported domain names, so deleting the import deletes the alias.
    expect(MUTATION_SOURCE).toContain("from '../../domain/authority-envelope/src/index.js'")
    expect(MUTATION_SOURCE).toMatch(/export const PERMISSION_EFFECT_PRECEDENCE = AUTHORITY_EFFECT_PRECEDENCE\b/)
    expect(MUTATION_SOURCE).toMatch(/export const PERMISSION_RESOURCE_MATCHER_KINDS = AUTHORITY_MATCHER_KINDS\b/)
    expect(MUTATION_SOURCE).toMatch(/\) => CoverageVerdict = sharedMatcherCovers/)
    expect(MUTATION_SOURCE).toMatch(/matcherCovers as sharedMatcherCovers,/)
    expect(AUTHORITY_CEILING_SOURCE).toContain("import type { ProposalAuthorityPosition } from './proposal-store.js'")
    expect(AUTHORITY_CEILING_SOURCE).not.toMatch(/^import \{[^}]*\} from '\.\/proposal-store\.js'/m)
    expect(AUTHORITY_CEILING_SOURCE).not.toMatch(/from '\.\.\/\.\.\/storage\//)
  })
})
