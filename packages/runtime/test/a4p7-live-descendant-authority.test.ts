/**
 * a4p7-live-descendant-authority.test.ts — A4-PR7 §7.6 row 5, the two literal
 * spec rows `dev/agent-workflow/evidence/a4-pr7/7-6-closure/SCENARIOS.md`
 * proved have no leg: it found the live-recompute MECHANISM pinned hard
 * (`a3p4-permission-lifecycle-e2e > PR4 leg C`, `a2c7-subtree-matcher G13/A3`)
 * but no leg that PERFORMS the creation, and none asserting the absence:
 * "the two literal §21.3 rows — 'applies to a descendant created **after**
 * startup' and '**no** startup-time descendant enumeration' — have no leg that
 * performs the creation or asserts the absence."
 *
 * THE LAW, quoted from the documents this leg is derived from:
 *
 * - spec §21.3: "broad subtree applies to descendant created after Team
 *   startup" (and, as its pair, "no startup-time descendant enumeration").
 * - spec §6.1: "Authority evaluation must not materialize a static set of
 *   covered descendants. The authoritative relation is computed against current
 *   canonical identities and the injected containment seam."
 * - ADR-alpha4-hard-governance.md §7.3: "This is a logical runtime intersection,
 *   not a precomputed path/resource set. No implementation may expand the
 *   envelopes into a startup-time list of currently existing descendants and
 *   use that list as authority."
 * - ADR §8, the worked example: root `A` with `sub-A-1`; the runtime later
 *   creates `sub-A-2`; "If the root `A` retains the same canonical identity,
 *   `sub-A-2` … may become covered by `A/**`".
 * - ADR §29 invariant 4: "authority is computed from live canonical/containment
 *   context, never startup path enumeration".
 *
 * LEG 1 performs the creation for real: the Team is up on a durable medium,
 * the subtree is granted, and ONLY THEN a MemberInstance row is created and a
 * real descendant directory + file are created under the granted root. The
 * first authority question ever asked about that resource must be answered
 * `allow` by the overlay's SUBTREE rule — and the MemberInstance created after
 * the grants must still inherit NOTHING, which is what proves the allow came
 * from the live containment relation and not from the population.
 *
 * LEG 2 is the prohibition, and here is the honest statement of what a leg can
 * and cannot assert. "Must not materialize a static set" is a claim about an
 * internal representation: no leg can observe a set that is never consulted,
 * and a leg that merely re-reads the source for a variable name would pin a
 * spelling, not a law. The closest honest assertions are the behavioural
 * signature such a set CANNOT pass, and this file makes all three:
 *   (a) NOTHING containment-shaped is consulted through Team startup — the
 *       seam's call log is empty when the assembled root is handed back with
 *       zero authority questions asked, so there is no startup-time pass over
 *       anything (spec §21.3 "no startup-time descendant enumeration");
 *   (b) the relation is computed AT THE ASK, for the pair being asked: every
 *       decision logs its own `(granted root, target key)` consultation, and
 *       the number of consultations an ask costs is INDEPENDENT of how many
 *       descendants exist under the root (ask with 1 descendant, create 8
 *       more, ask again — same cost). An implementation that materializes the
 *       covered set pays for the population; this lane does not;
 *   (c) the durable authority NEVER MOVES to cover a new descendant: after
 *       descendants are created and answered `allow`, the overlay head is the
 *       same durable row, byte for byte (same snapshot id, same generation).
 *       Coverage of a resource that did not exist when the row was committed
 *       cannot have come from a descendant set stored with that row;
 *   (d) the relation is LIVE, not a snapshot: the same logical key, asked twice
 *       across an unchanged durable row, follows the canonical containment
 *       relation as the filesystem's canonical identity moves under it. A
 *       verdict materialized when a resource was first seen cannot follow it.
 * The MECHANISM is additionally pinned structurally by leg 3, which walks the
 * shipped authority lane (roots named in the leg) and asserts that no
 * directory-listing primitive is even reachable there — the tool a startup
 * enumeration would need. That is the strongest available assertion of an
 * absence, and it is scoped and derived by walking, not by a guessed path.
 *
 * Offline and host-free like the plane spec it extends: real TeamDomain and
 * real durable overlay store over the testkit file seam, the REAL production
 * assembly (`createTeamProductionRoot`), real directories created and removed
 * by the test. Only the containment predicate is the test-owned double over
 * those real directories, exactly as `a3p4-production-permission-plane.test.ts`
 * injects it — production injects the pinned public `FileSystem.contains` and
 * the assembly point cannot tell the two apart.
 *
 * @module @dsh-agent-team/runtime/test/a4p7-live-descendant-authority
 */

import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { openPermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import type { TeamPluginConfig } from '../src/plugin/types.js'
import { createPermissionGovernanceLane } from '../src/plugin/permission-plane.js'
import type { CanonicalKeyContains, TeamPermissionPlane } from '../src/plugin/permission-plane.js'
import type { LegacyInspectFn } from '../src/plugin/legacy-surface.js'
import type { CanonicalOperation } from '../operation-permission/types.js'
import type { EffectivePermissionDecision, EffectivePermissionStaticLayer } from '../effective-policy/permission-assembler.js'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'

const ROOT_SID = 'session-root-a4p7r5'
const NOW = '2026-10-08T09:00:00.000Z'
/** The MemberInstance that exists when the Team starts. */
const WORKER_ID = parseInstanceId('inst-a4p7r5worker')
/** The MemberInstance created AFTER Team startup, by this test. */
const LATE_ID = parseInstanceId('inst-a4p7r5late')

const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 3',
  'blueprintId: A4P7R5-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the A4P7 row-5 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the A4P7 row-5 work.',
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
  '    description: The A4P7 row-5 default state.',
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

/** The static template lane denies everything: every `allow` this file sees
 *  can only have come from the overlay. */
const STATIC_DENY_ALL: EffectivePermissionStaticLayer = {
  label: 'worker',
  default: 'deny',
  rules: { allow: [], ask: [], deny: [] },
}

function fileOperation(tool: string, key: string): CanonicalOperation {
  return {
    tool: tool as CanonicalOperation['tool'],
    resource: { kind: 'file', key, display: key },
    fingerprint: `sha256:${'e'.repeat(64)}`,
  }
}

/** One logged containment consultation: which pair, and when it was asked. */interface SeamCall {
  readonly parentKey: string
  readonly childKey: string
  readonly answer: boolean
  /** The label of the phase the consultation happened in. */
  readonly phase: string
}

interface LiveDescendantWorld {
  readonly plane: TeamPermissionPlane
  readonly overlay: PermissionOverlayRepositoryPort
  readonly scratch: string
  /** The directory the subtree grant names — its canonical identity never moves. */
  readonly grantedRoot: string
  /** A descendant that exists when the Team starts (ADR §8's `sub-A-1`). */
  readonly startupDescendant: string
  /** Every consultation the injected seam ever received, in order. */
  readonly seamCalls: SeamCall[]
  /** The phase the log attributes new entries to. */
  setPhase(phase: string): void
  /** Ask the authority question, as the production pre-execute lane does. */
  decide(memberInstanceId: string, key: string): Promise<Record<string, unknown>>
  /** The durable overlay head, for the byte-identical arms. */
  head(): Promise<{ snapshotId: string; generation: number; rules: string } | undefined>
  /** Create a MemberInstance row through the durable repository. */
  createMemberAfterStartup(instanceId: string): Promise<void>
  /** Create a real resource under a real directory. */
  createResource(path: string): void
  grantSubtree(root: string): Promise<void>
  close(): Promise<void>
}

/** Canonical identity of a key: symlinks resolved on the deepest EXISTING
 *  ancestor. This is what "canonical" has to mean for a containment double over
 *  real directories — and it is what makes a retargeted junction observable:
 *  the same logical key gets a different canonical path (ADR §8 "canonical
 *  root identity", §29 invariant 4 "live canonical/containment context"). */
function canonicalKey(key: string): string {
  const absolute = resolve(key)
  const missing: string[] = []
  let cursor = absolute
  while (!existsSync(cursor)) {
    missing.unshift(basename(cursor))
    const parent = dirname(cursor)
    if (parent === cursor) return absolute
    cursor = parent
  }
  const real = realpathSync(cursor)
  return missing.length === 0 ? real : join(real, ...missing)
}

/** Canonical-key containment over REAL directories (the shape production
 *  injects from the pinned public `FileSystem.contains`), instrumented so the
 *  test can say WHEN the relation was computed. */
function makeInstrumentedSeam(log: SeamCall[], phase: { current: string }): CanonicalKeyContains {
  return (parentKey, childKey) => {
    const rel = relative(canonicalKey(parentKey), canonicalKey(childKey))
    const answer = rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
    log.push({ parentKey, childKey, answer, phase: phase.current })
    return answer
  }
}

async function openLiveDescendantWorld(): Promise<LiveDescendantWorld> {
  const base = scratchDir(`a4p7r5-${Math.random().toString(36).slice(2, 8)}`)
  destroyDir(base)
  const grantedRoot = `${base}/workspace/src`
  const startupDescendant = `${grantedRoot}/nested/a.ts`
  mkdirSync(`${grantedRoot}/nested`, { recursive: true })
  writeFileSync(startupDescendant, 'exists when the Team starts\n')
  mkdirSync(`${base}/elsewhere`, { recursive: true })

  const seamCalls: SeamCall[] = []
  const phase = { current: 'team-startup' }
  const seamContains = makeInstrumentedSeam(seamCalls, phase)

  const seam = new FileStorageSeam(base)
  const domain = await createTeamDomain(seam)
  await domain.repositories.memberInstances.put({
    rootSessionId: parseRootSessionId(ROOT_SID),
    instanceId: WORKER_ID,
    templateId: parseTemplateId('worker'),
    label: 'a4p7 row-5 worker',
    childSessionId: parseChildSessionId('session-child-a4p7r5worker'),
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
    staticModel: { provider: 'a4p7-r5', model: 'a4p7-model' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const teamToolsRef = { current: undefined }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub glue surface (the P8-S5A double), untyped by design
  const live: any = createStubBindings({ config, teamToolsRef, domain })
  const permissionPlaneRef: { current: TeamPermissionPlane | undefined } = { current: undefined }

  // TEAM STARTUP: the production root assembles the plane around the injected
  // containment seam. Nothing has been asked yet.
  const root = createTeamProductionRoot({
    config,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the stub-glue world hands the root the real TeamDomain (structurally satisfied)
    domain: domain as any,
    storageSeam: seam,
    live,
    now: () => NOW,
    teamToolsRef,
    controlServiceRef: { current: undefined },
    legacyInspect: (() => {
      throw new Error('a4p7 row-5 world: legacy inspect is unused')
    }) as LegacyInspectFn,
    permissionOverlay: overlay,
    fsContainsKeys: seamContains,
    permissionPlaneRef,
  })
  const plane = permissionPlaneRef.current
  if (plane === undefined) throw new Error('the production root did not fill the permission plane reference')

  const world: LiveDescendantWorld = {
    plane,
    overlay,
    scratch: base,
    grantedRoot,
    startupDescendant,
    seamCalls,
    setPhase(next) {
      phase.current = next
    },
    async decide(memberInstanceId, key) {
      return (await plane.decisions.decide({
        teamSessionId: ROOT_SID,
        memberInstanceId,
        operation: fileOperation('read', key),
        staticFacts: { template: STATIC_DENY_ALL },
        containment: (rootKey, target) => seamContains(rootKey, target.key),
      })) as unknown as Record<string, unknown>
    },
    async head() {
      const latest = await overlay.latest({ teamSessionId: ROOT_SID, memberInstanceId: WORKER_ID })
      if (latest === undefined) return undefined
      return {
        snapshotId: latest.snapshotId,
        generation: latest.metadata.generation,
        rules: JSON.stringify(latest.state.rules),
      }
    },
    async createMemberAfterStartup(instanceId) {
      await domain.repositories.memberInstances.put({
        rootSessionId: parseRootSessionId(ROOT_SID),
        instanceId: parseInstanceId(instanceId),
        templateId: parseTemplateId('worker'),
        label: 'created after Team startup',
        childSessionId: parseChildSessionId(`session-child-${instanceId}`),
        lifecycle: 'SETTLED',
        createdAt: '2026-10-08T09:05:00.000Z',
        activityVersion: 1,
      })
    },
    createResource(path) {
      mkdirSync(resolve(path, '..'), { recursive: true })
      writeFileSync(path, 'created after Team startup\n')
    },
    async grantSubtree(resource) {
      const result = await plane.mutation.grantInstance({
        authority: { kind: 'operator' },
        teamSessionId: ROOT_SID,
        memberInstanceId: WORKER_ID,
        mutationId: `mut-${Math.random().toString(36).slice(2, 10)}`,
        reason: 'a4p7 row 5: subtree grant taken before the descendant exists',
        rules: [{ operationClass: 'read', matcher: { kind: 'subtree', resource }, effect: 'allow' }] as never,
      })
      if (result.changed !== true) {
        throw new Error(`the production subtree grant must commit (reason: ${result.reason})`)
      }
    },
    async close() {
      await overlayStore.close().catch(() => undefined)
      await domain.close()
      destroyDir(base)
    },
  }
  // The root is kept alive by the plane closures; the handle names it for the reader.
  void root
  return world
}

describe('a4p7 §7.6 row 5 — a descendant created AFTER Team startup (spec §21.3, §6.1; ADR §7.3, §8, §29.4)', () => {
  it('the subtree granted before the resource exists covers the resource created after startup at the FIRST ask, while the MemberInstance created after the grants still inherits nothing', async () => {
    // Derivation: spec §21.3 "broad subtree applies to descendant created
    // after Team startup"; ADR §8 "If the root `A` retains the same canonical
    // identity, `sub-A-2` … may become covered by `A/**`"; ADR §29 invariant 4.
    const world = await openLiveDescendantWorld()
    try {
      // The resource does not exist while the Team starts or while the subtree
      // is granted — this is the creation the row asks for, not a fixture that
      // pre-seeded the path and asked about it later.
      const lateFile = `${world.grantedRoot}/created-after-startup/b.ts`
      expect(existsSync(lateFile)).toBe(false)

      await world.grantSubtree(world.grantedRoot)
      // The startup descendant answers, as the plane spec already pins.
      const before = await world.decide(WORKER_ID, world.startupDescendant)
      expect(before['effect']).toBe('allow')
      expect(before['winningLayer']).toBe('overlay')

      // THE CREATION: the runtime makes a new MemberInstance and a new resource
      // under the granted root, after Team startup, after the grant, and after
      // the first authority question.
      world.setPhase('after-startup-creation')
      await world.createMemberAfterStartup(String(LATE_ID))
      world.createResource(lateFile)
      expect(existsSync(lateFile)).toBe(true)

      // The authority question, asked for the first time about a resource that
      // did not exist when the durable grant was committed.
      const decision = await world.decide(WORKER_ID, lateFile)
      expect(decision['kind']).toBe('effective')
      expect(decision['effect']).toBe('allow')
      expect(decision['source']).toBe('rule')
      expect(decision['winningLayer']).toBe('overlay')
      // …and it is the SUBTREE matcher over the granted root that answered,
      // read off the deciding rule's own provenance.
      const effective = decision['effective'] as EffectivePermissionDecision
      const matcher = effective.provenance?.rule.resource as unknown as Record<string, unknown>
      expect(matcher['kind']).toBe('subtree')
      expect(matcher['rootKey']).toBe(world.grantedRoot)
      expect(effective.provenance?.layer).toBe('overlay')

      // The boundary that keeps the arm above honest: a MemberInstance created
      // AFTER the grants has no authority of its own (spec §7 no-inheritance,
      // pinned as PR4 leg J). Same resource, same instant, same plane — the
      // allow above came from the live containment relation of the GRANTED
      // instance, not from anything about the population.
      const late = await world.decide(LATE_ID, lateFile)
      expect(late['kind']).toBe('effective')
      expect(late['effect']).toBe('deny')
      expect(late['source']).toBe('default')
      expect(late['winningLayer']).toBeNull()
    } finally {
      await world.close()
    }
  })

  it('the prohibition, in the form a leg CAN assert: zero containment work through Team startup, the relation computed per ask for the pair asked about at a cost that does not follow the descendant population, a durable row that never moves, and a verdict that follows the live canonical relation', async () => {
    // Derivation: spec §6.1 "Authority evaluation must not materialize a static
    // set of covered descendants. The authoritative relation is computed
    // against current canonical identities and the injected containment seam";
    // spec §21.3 "no startup-time descendant enumeration"; ADR §7.3 "No
    // implementation may expand the envelopes into a startup-time list of
    // currently existing descendants and use that list as authority".
    //
    // WHAT THIS CANNOT ASSERT, stated plainly: that no set is materialized
    // ANYWHERE. A leg cannot observe a structure that is never consulted, so it
    // asserts instead the three things a materialized-startup-set implementation
    // CANNOT do — and leg 3 pins the mechanism structurally.
    const world = await openLiveDescendantWorld()
    try {
      // (a) THROUGH TEAM STARTUP: nothing containment-shaped happened. The
      // assembly point received the seam and never called it: there was no
      // pass over any resource when the Team started.
      expect(
        world.seamCalls.map((call) => `${call.phase} ${call.parentKey} ${call.childKey}`),
      ).toEqual([])

      // The grant is the first moment the relation matters, and it is a
      // MUTATION-TIME question. Nothing that has happened so far carries the
      // startup label: the seam was received by the assembly and untouched
      // until a decision needed it.
      world.setPhase('grant')
      await world.grantSubtree(world.grantedRoot)
      expect(world.seamCalls.filter((call) => call.phase === 'team-startup')).toEqual([])

      // (b) AT THE ASK: reset the clock, ask once about one descendant, and the
      // ask logs its OWN consultation for exactly the pair being asked about.
      world.setPhase('ask-1')
      world.seamCalls.length = 0
      const first = await world.decide(WORKER_ID, world.startupDescendant)
      expect(first['effect']).toBe('allow')
      const firstAskCalls = world.seamCalls.filter((call) => call.phase === 'ask-1')
      expect(
        firstAskCalls.some((call) => call.parentKey === world.grantedRoot && call.childKey === world.startupDescendant),
      ).toBe(true)

      // The durable authority row, read BEFORE anything else happens, is the
      // one that must answer everything below: arm (c) compares against it.
      const headAfterGrant = await world.head()
      expect(headAfterGrant?.generation).toBe(1)

      // …now the population GROWS, and the ask is repeated for a fresh
      // descendant. A per-ask materialization of the covered set costs the
      // population; the shipped lane costs the same, because it computes one
      // relation per matcher, not one per existing resource.
      const grown: string[] = []
      for (let index = 0; index < 8; index += 1) {
        const path = `${world.grantedRoot}/grown/f-${String(index)}.ts`
        world.createResource(path)
        grown.push(path)
      }
      expect(grown.every((path) => existsSync(path))).toBe(true)
      world.setPhase('ask-2')
      world.seamCalls.length = 0
      const target = grown[7]!
      const second = await world.decide(WORKER_ID, target)
      expect(second['effect']).toBe('allow')
      const secondAskCalls = world.seamCalls.filter((call) => call.phase === 'ask-2')
      expect(secondAskCalls.length).toBe(firstAskCalls.length)
      expect(
        world.seamCalls.some((call) => call.parentKey === world.grantedRoot && call.childKey === target),
      ).toBe(true)

      // (c) The durable authority NEVER MOVED to cover any of it: the same row
      // that was committed before the descendants existed answers all of them,
      // byte for byte, and no second row was ever written. Coverage of a
      // resource that did not exist when that row was committed cannot have
      // come from a descendant set stored with it.
      for (const path of grown.slice(0, 3)) {
        expect((await world.decide(WORKER_ID, path))['effect']).toBe('allow')
      }
      const headAfterCreation = await world.head()
      expect(headAfterCreation).toEqual(headAfterGrant)
      expect(headAfterCreation?.generation).toBe(1)

      // (d) AND the relation is LIVE, not a snapshot: the SAME logical key,
      // asked twice with the durable row unchanged, follows the canonical
      // containment as the filesystem's canonical identity moves under it.
      // Derived from spec §6.1 ("computed against current canonical identities
      // and the injected containment seam") and §6.3's live-recompute clause; a
      // verdict materialized when the descendant was first seen — which is what
      // "expand the envelopes into a list of currently existing descendants and
      // use that list as authority" (ADR §7.3) would mean — cannot follow it.
      const junction = `${world.grantedRoot}/junction`
      const through = `${junction}/x.ts`
      mkdirSync(junction, { recursive: true })
      writeFileSync(through, 'inside the granted root\n')
      expect(canonicalKey(through)).toBe(realpathSync(junction) + '/x.ts')
      world.setPhase('ask-retarget-1')
      const before = await world.decide(WORKER_ID, through)
      expect(before['effect']).toBe('allow')

      // Move the resource's CANONICAL identity out from under the still-valid
      // subtree: the granted root's identity never moves, and nothing durable
      // is written. The logical key is byte-identical across the two asks.
      rmSync(junction, { recursive: true, force: true })
      symlinkSync(resolve(world.scratch, 'elsewhere'), junction, 'dir')
      // A real resource sits where the logical key now canonically resolves —
      // the SAME key, now outside the granted root.
      writeFileSync(resolve(world.scratch, 'elsewhere/x.ts'), 'canonically outside\n')
      expect(canonicalKey(through)).not.toBe(realpathSync(world.grantedRoot) + '/junction/x.ts')
      world.setPhase('ask-retarget-2')
      world.seamCalls.length = 0
      const after = await world.decide(WORKER_ID, through)
      expect(after['effect']).toBe('deny')
      expect(after['source']).toBe('default')
      // The pair was asked AGAIN, not replayed: the same (root, key) question
      // this ask logged for itself.
      expect(
        world.seamCalls.filter(
          (call) => call.phase === 'ask-retarget-2' && call.parentKey === world.grantedRoot && call.childKey === through,
        ).length,
      ).toBeGreaterThan(0)
      expect(await world.head()).toEqual(headAfterGrant)

      // The population really is what changed and nothing else: the very same
      // question one level OUT of the granted root still falls to the static
      // default, so the allows above are containment answers, not a lane that
      // answers `allow` to whatever is new.
      const outside = `${world.scratch}/elsewhere/outside.ts`
      world.createResource(outside)
      const outsideAnswer = await world.decide(WORKER_ID, outside)
      expect(outsideAnswer['effect']).toBe('deny')
      expect(outsideAnswer['source']).toBe('default')
    } finally {
      await world.close()
    }
  })

  it('the mechanism: the shipped authority lane reaches no directory-listing primitive at all (the tool a startup enumeration would need)', () => {
    // Derivation: spec §6.1 + ADR §7.3 + ADR §29 invariant 4. An enumeration of
    // "the currently existing descendants" needs a listing API, so the absence
    // of one in the authority path is the strongest assertion available for
    // "never startup path enumeration".
    //
    // The roots below are the modules the production assembly wires into the
    // authority path — derived by walking these directories, and the walk
    // asserts it really found each lane module, so a moved file reddens this
    // leg instead of silently narrowing it. NOTHING here guesses a path.
    // Anchored on THIS file's location, never on the ambient cwd: the walk has
    // to be walking the shipped lane whatever directory vitest was started in.
    const repoRoot = resolve(fileURLToPath(import.meta.url), '../../../..')
    const roots = [
      'packages/runtime/permission-lifecycle',
      'packages/runtime/operation-permission',
      'packages/runtime/effective-policy',
      'packages/runtime/governance',
    ]
    const listingApis = ['readdir', 'readdirSync', 'opendir', 'glob', 'scandir', 'listFiles']
    const laneModules = [
      'packages/runtime/permission-lifecycle/decision-lane.ts',
      'packages/runtime/permission-lifecycle/mutation-lane.ts',
      'packages/runtime/operation-permission/pre-execute-adapter.ts',
      'packages/runtime/operation-permission/permission-resolver.ts',
      'packages/runtime/effective-policy/permission-assembler.ts',
      'packages/runtime/governance/permission-mutation.ts',
      'packages/runtime/governance/permission-approval.ts',
    ]
    const sources: { path: string; code: string }[] = []
    for (const root of roots) {
      const walk = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const full = join(directory, entry.name)
          if (entry.isDirectory()) {
            if (entry.name !== 'dist' && entry.name !== 'node_modules') walk(full)
            continue
          }
          if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue
          if (full.split(sep).includes('test')) continue
          // Comments are stripped: a comment may NAME a forbidden API while
          // saying it is forbidden (this file included).
          const code = readFileSync(full, 'utf8')
            .split('\n')
            .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
            .join('\n')
          sources.push({ path: relative(repoRoot, full).split(sep).join('/'), code })
        }
      }
      walk(join(repoRoot, root))
    }
    const seen = sources.map((source) => source.path)
    for (const module of laneModules) {
      expect(seen, `the walk lost ${module} — the lane moved and this leg is no longer walking it`).toContain(module)
    }
    const offenders = sources
      .filter((source) => listingApis.some((api) => source.code.includes(`${api}(`)))
      .map((source) => source.path)
    expect(
      offenders,
      `the authority path reached a directory-listing API (${listingApis.join(', ')}) across the walked roots ${roots.join(', ')} — authority would then be a resource census, which ADR §7.3 forbids`,
    ).toEqual([])

    // And the seam the production mutation lane is built on is structurally
    // incapable of carrying a set: the shipped adapter hands the kernel a
    // predicate over ONE pair, which forwards exactly one question to the
    // injected authority per call. A "covered descendants" list has no channel
    // through this seam, which is why the lane cannot enumerate even if it
    // wanted to (ADR §7.3 "not a precomputed path/resource set").
    const asked: string[] = []
    const lane = createPermissionGovernanceLane({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the seam arm builds no snapshot; the port is only forwarded
      overlay: { append: async () => { throw new Error('unused') }, latest: async () => undefined, history: async () => [] } as any,
      fsContainsKeys: (parentKey, childKey) => {
        asked.push(`${parentKey} ${childKey}`)
        return true
      },
    })
    expect(lane.subtreeContains).toBeDefined()
    expect(lane.subtreeContains!.length).toBe(2)
    expect(lane.subtreeContains!('/granted/root', '/granted/root/new/descendant.ts')).toBe(true)
    expect(asked).toEqual(['/granted/root /granted/root/new/descendant.ts'])
  })
})
