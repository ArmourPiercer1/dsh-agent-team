/**
 * a4p7-ceiling-no-port-refusal.test.ts — A4-PR7 §7.5 PREREQUISITE 3, PINNED:
 * a governance lane that wired NO authority-ceiling reader REFUSES a rising
 * mutation instead of committing it.
 *
 * ---------------------------------------------------------------------------
 * THE LAW, AND WHY IT IS A REFUSAL RATHER THAN A SILENT COMMIT
 * ---------------------------------------------------------------------------
 * Until this commit the v3 ceiling gate was entered only
 * `if (lane.authorityCeiling !== undefined)`. Absence of the port was therefore
 * not a fact the kernel could see: the gate simply was not there, and a batch
 * that RAISED the effective effect appended, carrying no ceiling at all. The
 * §7.6 census counts 17 `createTeamProductionRoot` call sites — 1 production
 * producer, 16 test worlds — and NOT ONE of the 16 injected the port, so every
 * "assembled lane" test in the repository was asserting behaviour through an
 * open gate. Absence of a reader is a statement about the WIRING; wiring cannot
 * widen authority, and it certainly cannot impersonate the one fact that is
 * allowed to skip the gate — a DECIDED pre-v3 (v1/v2) binding answering
 * `undefined` from the reader, which A5-12 keeps as the only existential skip
 * (leg N5 pins that this commit left it standing).
 *
 * So the refusal is typed as the CONTEXT fault it is:
 * `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` with
 * `details.problem === 'authority-ceiling-port-absent'` — never
 * `AUTHORITY_CEILING_INSUFFICIENT`, which would put an authorization verdict on
 * a ceiling nobody read (A3-3's error-identity law) and would feed the A4-PR5
 * proposal catch, minting a durable proposal out of an unread document.
 *
 * ---------------------------------------------------------------------------
 * WHY THE REFUSAL IS RISE-SCOPED
 * ---------------------------------------------------------------------------
 * A batch that REMOVES authority commits even here (leg N2). Refusing
 * tightenings would trade one unsound default for another — it would make a
 * mis-wired lane unable to revoke anything, and it would teach operators to
 * delete the lane rather than wire it. The classification is run with the same
 * pure inputs the port-present branch uses, so "is this batch rising?" is
 * answered identically on both sides of the flip; and when the classification
 * itself cannot answer (subtree relations with no predicate injected) ITS
 * refusal propagates as itself (leg N4), because a lane that cannot establish
 * that it is not rising has not established anything.
 *
 * Every leg drives the real `createGovernanceMutationService` against a stub
 * overlay port that COUNTS appends, so "zero write" is measured, not asserted
 * from the throw.
 */
import { describe, expect, it } from 'vitest'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import { PERMISSION_MUTATION_ERROR_CODES } from '../governance/permission-mutation.js'
import { createGovernanceMutationService } from '../governance/index.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type {
  GovernanceMutationServiceDeps,
  GovernancePermissionMutationArgs,
  PermissionMutationEnvelope,
} from '../governance/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type {
  GovernanceTransitionCache,
  GovernanceTransitionCommit,
  PermissionAuthorityCeilingContext,
} from '../governance/types.js'
import {
  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS,
  parseBlueprint,
  type TeamBlueprint,
} from '../../domain/blueprint/src/index.js'
import {
  createAuthorityCeilingReader,
  createPermissionAuthorityFacts,
} from '../src/plugin/permission-plane.js'
import { P6T4_BLUEPRINT_SOURCE } from './p6t4-helpers.js'
import { FIXTURE_INSTANCE_ID, FIXTURE_TEAM_SESSION_ID } from './permission-overlay-helpers.js'

const NOW = '2026-10-08T00:00:00.000Z'
/** The cell every leg mutates. A FINGERPRINT matcher is deliberate: the algebra
 *  is decidable with no workspace and no subtree predicate, so a leg that
 *  expects a refusal can only be refused by the ceiling law — never by the
 *  classification's own missing-predicate refusal (which leg N4 wants on
 *  purpose, with a subtree matcher). */
const CELL = `sha256:${'a'.repeat(64)}`
const DECLARED_NONE = { layers: [] }

class NoopOverrides implements OverrideStorePort {
  async list(_rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(record: unknown): Promise<unknown> {
    return record
  }
}
class NoopTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _transition: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}
class NoopCommit implements GovernanceTransitionCommit {
  async commit(_rootSessionId: string, _transition: PolicyStateTransitionRecord): Promise<void> {}
}
const NEVER_CONSULTED: PolicyReader = {
  readBlueprintEnvelope: (): never => {
    throw new Error('the permission lane must not read the capability envelope')
  },
  readTemplatePolicy: (): never => {
    throw new Error('the permission lane must not read template policy')
  },
  readExternalFacts: (): never => {
    throw new Error('the permission lane must not read external hard facts')
  },
}

/** The documents a FULLY wired v3 lane would answer, reused so that the only
 *  difference between a control lane and the lane under test is the PORT. */
const COVERING: PermissionMutationEnvelope = {
  rules: [{ operationClass: 'bash', matcher: { kind: 'fingerprint', resource: CELL }, maximumEffect: 'allow' }],
}

type CeilingWiring =
  /** The branch under test: no port on the lane at all. */
  | { readonly kind: 'absent-port' }
  /** The one answer allowed to skip the gate: the reader's existential NO for a
   *  DECIDED pre-v3 binding. */
  | { readonly kind: 'reader-answers-undefined' }
  /** Control: a fully wired lane whose documents cover the rise. */
  | { readonly kind: 'wired-covering' }

  /** R-LEGS ONLY: the SHIPPED reader (`createAuthorityCeilingReader` over the SHIPPED
   *  facts) rather than a stub, so a leg can ask a question about the COMPOSITION and
   *  not about a fixture's imagination. */
  | { readonly kind: 'shipped-reader'; readonly port: CeilingPort }

/** The lane's ceiling port, spelled once so the R-legs can wrap the real reader in a
 *  counter without restating the lane. */
type CeilingPort = (
  teamSessionId: string,
  memberInstanceId: string,
  actor: 'leader' | 'human',
) => Promise<PermissionAuthorityCeilingContext | undefined>

/**
 * One service, one counted overlay, three wirings.
 *
 * `appends()` is the durable-effect witness: every refusal leg must leave it
 * empty, and the commit legs must leave exactly one snapshot in it.
 */
function openLaneWorld(
  wiring: CeilingWiring,
  options: { readonly injectSubtreePredicate?: boolean } = {},
) {
  const appended: unknown[] = []
  const documents: AuthorityEnvelopeDocuments = {
    teamHardEnvelope: { status: 'declared', document: COVERING } as AuthorityEnvelopeDocuments['teamHardEnvelope'],
    permissionMutationEnvelope: {
      status: 'declared',
      document: COVERING,
    } as AuthorityEnvelopeDocuments['permissionMutationEnvelope'],
  }
  const lane: GovernanceMutationServiceDeps['permissionLane'] = {
    overlay: {
      latest: async () => undefined,
      append: async (input: unknown) => {
        appended.push(input)
        return input
      },
    } as never,
    permissionEnvelope: () => COVERING,
    staticLayers: () => DECLARED_NONE,
    ...(options.injectSubtreePredicate === false
      ? {}
      : { subtreeContains: (root: string, child: string) => child === root || child.startsWith(`${root}/`) }),
    ...(wiring.kind === 'absent-port'
      ? {}
      : wiring.kind === 'shipped-reader'
        ? { authorityCeiling: wiring.port }
        : {
            authorityCeiling: async (
            _team: string,
            _member: string,
            actor: 'leader' | 'human',
          ): Promise<PermissionAuthorityCeilingContext | undefined> =>
            wiring.kind === 'reader-answers-undefined'
              ? undefined
              : {
                  beneficiaryAuthority: 'member',
                  initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
                  documents,
                  blueprintContentHash: `sha256:${'c'.repeat(64)}`,
                },
        }),
  }
  const service = createGovernanceMutationService({
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopCommit(),
    policy: NEVER_CONSULTED,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => NOW,
    permissionLane: lane,
  })
  let counter = 0
  const mutate = (
    rules: readonly { operationClass: string; matcher: unknown; effect: 'allow' | 'ask' | 'deny' }[],
    actor: 'operator' | 'leader' = 'operator',
  ) =>
    service.mutatePermission({
      authority: actor === 'leader' ? { kind: 'leader' } : { kind: 'operator' },
      teamSessionId: FIXTURE_TEAM_SESSION_ID,
      memberInstanceId: FIXTURE_INSTANCE_ID,
      kind: 'grant_instance',
      mutationId: `mut-a474np-${String(++counter)}`,
      reason: 'a4-74 fail-closed lane: no ceiling port is not an absent ceiling',
      rules,
    } as unknown as GovernancePermissionMutationArgs)
  return {
    /** A batch that RAISES the effective effect at CELL (statics deny, grant allows). */
    rise: (actor?: 'operator' | 'leader') =>
      mutate([{ operationClass: 'bash', matcher: { kind: 'fingerprint', resource: CELL }, effect: 'allow' }], actor),
    /** A batch that REMOVES authority at the same cell (statics deny, so nothing
     *  rises: the ceiling question does not arise at all). */
    tighten: () =>
      mutate([{ operationClass: 'bash', matcher: { kind: 'fingerprint', resource: CELL }, effect: 'deny' }]),
    /** A subtree-shaped rise on a lane with NO containment predicate. The class
     *  is `write` because the exec family is fingerprint-ONLY (a subtree matcher
     *  on `bash` is malformed input, not an unknown relation — a leg that
     *  confuses the two is measuring the parser). */
    riseUndecidable: () =>
      mutate([{ operationClass: 'write', matcher: { kind: 'subtree', resource: '/srv/a474-noport' }, effect: 'allow' }]),
    appends: () => appended.length,
  }
}

async function refusalOf(run: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    const result = await run
    throw new Error(`expected a refusal, got a commit: ${JSON.stringify(result)}`)
  } catch (error) {
    const shaped = error as { code?: string; message?: string; details?: Record<string, unknown> }
    if (shaped.code === undefined) throw error
    return { code: shaped.code, message: shaped.message ?? '', ...(shaped.details ?? {}) }
  }
}

describe('A4-PR7 §7.5 prerequisite 3 — a lane with no authority-ceiling port refuses a rise (it does not commit it)', () => {
  it('N1 a rising batch on a port-less lane REFUSES with the CONTEXT code and the port-absent problem, and appends NOTHING', async () => {
    const w = openLaneWorld({ kind: 'absent-port' })
    const refusal = await refusalOf(w.rise())
    expect(refusal['code'], JSON.stringify(refusal)).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
    // The context label, never the authorization label: the remedy is "wire the
    // ceiling", not "ask a higher rung" (A3-3).
    expect(refusal['code']).not.toBe(PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT)
    expect(refusal['problem']).toBe('authority-ceiling-port-absent')
    // The refusal is LOCALISED: the operator is told which cell rose unassessed.
    expect(String(refusal['message'])).toContain('no authority-ceiling reader')
    expect(refusal['appends'] ?? w.appends()).toBe(0)
    expect(w.appends()).toBe(0)
  })

  it('N2 the same port-less lane still COMMITS a tightening (the refusal is rise-scoped, not a lane-wide ban)', async () => {
    const w = openLaneWorld({ kind: 'absent-port' })
    const committed = await w.tighten()
    expect((committed as { changed?: boolean }).changed).toBe(true)
    expect(w.appends()).toBe(1)
  })

  it('N3 the refusal is not actor-scoped: a LEADER whose carrier covers the cell is refused too (wiring cannot widen)', async () => {
    // The carrier covers the rise, so the Alpha.3 aggregate is satisfied and the
    // ONLY thing left standing is the ceiling — which this lane never asked.
    const w = openLaneWorld({ kind: 'absent-port' })
    const refusal = await refusalOf(w.rise('leader'))
    expect(refusal['code'], JSON.stringify(refusal)).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
    expect(refusal['problem']).toBe('authority-ceiling-port-absent')
    expect(w.appends()).toBe(0)
  })

  it('N4 when the classification itself cannot answer, ITS refusal propagates as itself — never relabelled as the port-absent fault', async () => {
    // A subtree matcher with no containment predicate: the lane cannot even
    // establish that it is not rising, and the refusal the operator deserves is
    // `subtree-relation-unknown` (inject the predicate), not "wire a ceiling".
    const w = openLaneWorld({ kind: 'absent-port' }, { injectSubtreePredicate: false })
    const refusal = await refusalOf(w.riseUndecidable())
    expect(refusal['code']).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
    expect(refusal['problem']).not.toBe('authority-ceiling-port-absent')
    expect(refusal['problem']).toBe('subtree-relation-unknown')
    expect(w.appends()).toBe(0)
  })

  it('N5 the ONLY answer that may still skip the gate is the reader existential NO for a pre-v3 binding, and it is untouched (A5-12)', async () => {
    // Not an endorsement of that branch — a PIN that THIS commit did not quietly
    // widen it into the port-absent case. Its production reachability after the
    // §7.3 flip is a separate ruling, recorded in 7-4-failclosed/HANDOFF.md.
    const w = openLaneWorld({ kind: 'reader-answers-undefined' })
    const committed = await w.rise()
    expect((committed as { changed?: boolean }).changed).toBe(true)
    expect(w.appends()).toBe(1)
  })

  it('N6 the control that makes N1 mean something: the SAME rise on a fully wired lane commits, so the refusal is caused by the missing port', async () => {
    const w = openLaneWorld({ kind: 'wired-covering' })
    const committed = await w.rise()
    expect((committed as { changed?: boolean }).changed).toBe(true)
    expect(w.appends()).toBe(1)
  })
})

/**
 * PRE-V3 REACHABILITY (coordinator ruling on this lane, §7.5).
 *
 * The question was NOT whether the pre-v3 skip still works (leg N5 pins that a reader
 * answer `undefined`, and the committing branch is untouched). It was: can ANY INPUT
 * REACHABLE FROM THE SHIPPED COMPOSITION make the shipped reader answer `undefined` for a
 * DECIDED pre-v3 binding, post-flip? Measured answer: NO, and the reason is one line deep.
 *
 * `facts.blueprintSchemaVersion` is `(team) => resolveBlueprint(team)?.schemaVersion`
 * (`src/plugin/permission-plane.ts:872`) and its ONLY producer is the STRONG parse
 * (`parseBlueprint` -> `validateBlueprintDocument`), which throws `SCHEMA_VERSION_MISMATCH`
 * for every version outside `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` — a list the domain
 * pins to `[3]` since the cutover (§7.3, ADR A2-11, `a4p1` leg V1). So the facts layer
 * answers exactly one number: 3. Pre-v3 is not a fact this build can OBSERVE about a bound
 * document any more, only a fact it can REFUSE; the reader's `1 || 2` arm is a branch whose
 * input no reachable parse produces, and an unresolvable binding already lands on
 * `unreadableAuthorityCeilingContext` (a refusal).
 *
 * R4 is the leg that REDDENS IF A ROUTE APPEARS: it holds the door open by hand — a cast
 * document the parser refuses to build — and shows what walks through it (the skip, and a
 * commit). Re-open the bridge (widen the version list, or teach the parse to emit a v2
 * `TeamBlueprint`) and R2's counter stops at zero no more.
 */
const PREV3_ANCHOR_WORKSPACE = '/srv/a4p7-prev3'

/** The SAME v3 source, with exactly one line changed: its version. Anything else wrong
 *  would let a leg blame the wrong fact. */
function sourceAtVersion(schemaVersion: number): string {
  return P6T4_BLUEPRINT_SOURCE.replace('schemaVersion: 3', `schemaVersion: ${String(schemaVersion)}`)
}

/** The shipped reader over the shipped facts, with a counter for the answers that skip. */
function openShippedReader(options: { readonly boundVersion?: number | 'unbound' }) {
  const spy = { undefinedAnswers: 0, calls: 0 }
  const facts = createPermissionAuthorityFacts({
    // Production's shape: resolve the bound snapshot through the STRONG parse and let a
    // refusal propagate — `resolveBlueprintOf` in the facts module is what turns a
    // refusal into UNKNOWN. A fixture that caught the throw here would be testing the
    // fixture.
    resolveBlueprint: (): TeamBlueprint | undefined =>
      options.boundVersion === 'unbound' || options.boundVersion === undefined
        ? undefined
        : parseBlueprint(sourceAtVersion(options.boundVersion)),
    memberTemplateId: () => 'worker',
    memberWorkspace: () => PREV3_ANCHOR_WORKSPACE,
    canonicalize: async (path: string) => path,
  })
  const reader = createAuthorityCeilingReader({ facts })
  const port: CeilingPort = async (team, member, actor) => {
    spy.calls += 1
    const context = await reader(team, member, actor)
    if (context === undefined) spy.undefinedAnswers += 1
    return context
  }
  return { port, spy, reader }
}

describe('A4-PR7 §7.5 — the pre-v3 `undefined` skip has no route through the shipped composition (measurement, and the pin that reddens if one appears)', () => {
  it('R1 the strong parse CANNOT hand the facts layer a pre-v3 document: the only line that makes it pre-v3 is the version line, and that line is refused', () => {
    // The list the whole argument rests on, re-pinned HERE because this is the lane whose
    // skip depends on it. If someone re-opens the bridge, this leg and R2 fail together.
    expect([...SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([3])
    // Sanity: the unedited source really does parse, so a refusal below is about the
    // version and not about the fixture.
    expect(parseBlueprint(P6T4_BLUEPRINT_SOURCE).schemaVersion).toBe(3)
    const seen: string[] = []
    for (const version of [1, 2, 4, 9]) {
      let code: string | undefined
      try {
        parseBlueprint(sourceAtVersion(version))
      } catch (error) {
        code = (error as { code?: string }).code
      }
      expect(code, `v${String(version)} was accepted by the strong parse`).toBe('SCHEMA_VERSION_MISMATCH')
      seen.push(`v${String(version)}:${code ?? 'ACCEPTED'}`)
    }
    expect(seen.join(' ')).toBe('v1:SCHEMA_VERSION_MISMATCH v2:SCHEMA_VERSION_MISMATCH v4:SCHEMA_VERSION_MISMATCH v9:SCHEMA_VERSION_MISMATCH')
  })

  it('R2 MEASUREMENT — through the shipped reader over the shipped facts, NO reachable binding answers undefined; only v3 is a context, everything else is a refusal', async () => {
    const spy = { undefinedAnswers: 0, calls: 0 }
    const answers = new Map<string, string>()
    for (const bound of [1, 2, 4, 9, 'unbound', 3] as const) {
      const world = openShippedReader({ boundVersion: bound })
      const context = await world.reader(FIXTURE_TEAM_SESSION_ID, FIXTURE_INSTANCE_ID, 'leader')
      spy.calls += 1
      if (context === undefined) {
        spy.undefinedAnswers += 1
        answers.set(String(bound), 'UNDEFINED — the skip was taken')
        continue
      }
      // A slot is EITHER the document (a declared envelope: it has `rules`) or one of the
      // two arms that say why there is no document (`absent` / `unavailable`). Naming the
      // arm is the whole observation here, so classify on the shape the type admits
      // instead of reaching for a `status` a declared document does not carry.
      const slot = context.documents.teamHardEnvelope as { status?: string; rules?: unknown }
      answers.set(
        String(bound),
        `defined/${slot.rules === undefined ? String(slot.status ?? 'unrecognised') : 'declared'}`,
      )
    }
    // THE CLAIM, as a table: a decided binding is only ever a refusal or a v3 context.
    expect([...answers.entries()].map(([k, v]) => `${k}=${v}`).join(' ')).toBe(
      '1=defined/unavailable 2=defined/unavailable 4=defined/unavailable 9=defined/unavailable unbound=defined/unavailable 3=defined/declared',
    )
    expect(spy.undefinedAnswers, JSON.stringify([...answers.entries()])).toBe(0)
    expect(spy.calls).toBe(6)
  })

  it('R3 the consequence AT THE LANE: a Team bound to a pre-v3 document is REFUSED the rise with the CONTEXT code and the ceiling-document problem, and appends NOTHING', async () => {
    const { port, spy } = openShippedReader({ boundVersion: 2 })
    const w = openLaneWorld({ kind: 'shipped-reader', port })
    const refusal = await refusalOf(w.rise())
    expect(refusal['code'], JSON.stringify(refusal)).toBe(
      PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE,
    )
    // Told apart from the port-absent arm of the same code: here the port is wired and the
    // DOCUMENT is the unread one. Same remedy family, different fact, and the wire keeps them
    // separate (W2 of the wire suite).
    expect(refusal['problem']).not.toBe('authority-ceiling-port-absent')
    expect(refusal['authorityCeilingCode']).toBe('AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE')
    expect(w.appends()).toBe(0)
    expect(spy.undefinedAnswers).toBe(0)
    expect(spy.calls).toBeGreaterThan(0)
  })

  it('R4 THE DOOR, HELD OPEN BY HAND: only a document the parser REFUSES to build still takes the skip, and what walks through it is a commit — which is why R2 is the guard', async () => {
    // This leg is deliberately NOT reachable-by-input: it casts a `TeamBlueprint` whose
    // schemaVersion is 2, which `validateBlueprintDocument` will not produce at any price
    // (R1). It exists so the record shows where the remaining door is and what it costs:
    // the reader answers `undefined`, the gate is skipped, and the rise COMMITS. If a future
    // change lets the PARSE build this object, R2 counts an undefined answer and reddens;
    // nothing here needs to be edited for that to happen, which is the whole point of
    // pinning unreachability instead of changing the committing branch.
    const fakePreV3 = {
      ...parseBlueprint(P6T4_BLUEPRINT_SOURCE),
      schemaVersion: 2,
    } as unknown as TeamBlueprint
    const facts = createPermissionAuthorityFacts({
      resolveBlueprint: () => fakePreV3,
      memberTemplateId: () => 'worker',
      memberWorkspace: () => PREV3_ANCHOR_WORKSPACE,
      canonicalize: async (path: string) => path,
    })
    const reader = createAuthorityCeilingReader({ facts })
    expect(await reader(FIXTURE_TEAM_SESSION_ID, FIXTURE_INSTANCE_ID, 'leader')).toBeUndefined()
    const port: CeilingPort = async (team, member, actor) => reader(team, member, actor)
    const w = openLaneWorld({ kind: 'shipped-reader', port })
    const committed = await w.rise()
    expect((committed as { changed?: boolean }).changed, JSON.stringify(committed)).toBe(true)
    expect(w.appends()).toBe(1)
  })
})
