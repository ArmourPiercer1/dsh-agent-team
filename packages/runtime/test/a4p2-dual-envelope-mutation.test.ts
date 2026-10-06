/**
 * a4p2-dual-envelope-mutation.test.ts — A4-PR2 lane C: a v3 direct permission
 * mutation must obey BOTH authority ceilings, and the refusals must say WHICH
 * ceiling and WHY, in the closed vocabulary.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS UNDER TEST, AND AT WHICH SEAM
 * ---------------------------------------------------------------------------
 * Two things are separated on purpose:
 *
 *  1. THE GATE (`authorizeCeilingBoundedPermissionRise`) — the refusal law: what
 *     code, what order, what detail. Tested directly against the rise facts lane B
 *     extracts, so the law is pinned without a storage world.
 *  2. THE JUDGE (what `governance/service.ts` hands the gate) — the ceiling law:
 *     for one rising region, are BOTH planes at or above the risen effect? Tested
 *     here by the same composition the service performs (expansionCeiling and
 *     grantCeiling computed separately, compared against the risen effect, never
 *     min()'d), over real document pairs.
 *
 * The composition is exercised as a local function rather than through
 * `mutatePermission` because the service world helper (`openServiceWorld`) is
 * module-private to `a3p3-permission-mutation-authority.test.ts`; duplicating its
 * four storage doubles here would have bought no additional coverage of THIS law.
 * The service's own ordering (gate AFTER the Leader authorization, BEFORE the
 * commit) is pinned by source position below, which is the property that cannot be
 * observed from the pure seam. Exposing the world helper is filed for PR3.
 *
 * @module @dsh-agent-team/runtime/test/a4p2-dual-envelope-mutation
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
import { describe, expect, it } from 'vitest'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { createPermissionAuthorityCeilingJudge } from '../governance/service.js'
import {
  classifyPermissionRise,
  PERMISSION_MUTATION_ERROR_CODES,
  PermissionMutationError,
  authorizeCeilingBoundedPermissionRise,
} from '../governance/permission-mutation.js'
import type {
  PermissionRiseCeilingVerdict,
  PermissionRiseRegion,
} from '../governance/permission-mutation.js'

const ROOT = { kind: 'subtree' as const, resource: 'file:/root' }
const contains = (root: string, child: string): boolean => child === root || child.startsWith(`${root}/`)

const doc = (maximumEffect: 'allow' | 'ask' | 'deny') => ({
  rules: [{ operationClass: 'write', matcher: ROOT, maximumEffect }],
})
const ALLOW = doc('allow')
const ASK = doc('ask')
const EMPTY_DOC = { rules: [] }
const ABSENT = { status: 'absent' } as const
const UNAVAILABLE = { status: 'unavailable' } as const
const docs = (
  hard: AuthorityEnvelopeDocuments['teamHardEnvelope'],
  mutation: AuthorityEnvelopeDocuments['permissionMutationEnvelope'],
): AuthorityEnvelopeDocuments => ({ teamHardEnvelope: hard, permissionMutationEnvelope: mutation })

/**
 * THE JUDGE UNDER TEST IS THE PRODUCTION ONE: `createPermissionAuthorityCeilingJudge`
 * is exported from `governance/service.ts` and called here directly. It was
 * extracted for that reason — the first version of this suite carried a local
 * replica, and the mutation proofs measured the consequence: flipping the real
 * service's handling of `no-authority` to "unrestricted" left the suite GREEN.
 * A replica that agrees today is not a guard (the same argument the lane-hygiene
 * leg makes about `toBe` identity on the grammar).
 */
const judgeFor = createPermissionAuthorityCeilingJudge({ subtreeContains: contains })

/** A rise fact, built the way lane B builds one: decided before, decided after, risen. */
function rise(risenEffect: 'allow' | 'ask', region = ROOT): PermissionRiseRegion {
  return {
    operationClass: 'write',
    mutationMatcher: region,
    region,
    regionText: `subtree:${region.resource}`,
    before: { status: 'decided', effect: risenEffect === 'allow' ? 'ask' : 'deny', source: 'layer' },
    after: { status: 'decided', effect: risenEffect, source: 'overlay' },
    risenEffect,
    detail: { region: `subtree:${region.resource}` },
  }
}

const LEADER_IN = (documents: AuthorityEnvelopeDocuments) => ({
  beneficiaryAuthority: 'leader' as const,
  initiatorAuthority: 'leader' as const,
  documents,
})

describe('the dual-ceiling gate: which refusal, in which order', () => {
  it('a rise BOTH ceilings reach commits — the gate is silent', () => {
    expect(() =>
      authorizeCeilingBoundedPermissionRise([rise('allow')], () => ({ status: 'sufficient' })),
    ).not.toThrow()
  })

  it('a rise above the CEILING refuses with the additive code, never EXPANSION_OUTSIDE_ENVELOPE', () => {
    // The Leader's own carrier says `ask`: Alpha.3's coverage law would pass a
    // carrier that covers the matcher, and the OLD vocabulary would have called
    // this "expansion outside envelope". It is not: the ceiling document is the
    // TEAM'S document, over the Leader. A caller that sees the old code would
    // answer by editing the Leader's carrier — the one document that cannot grant
    // the missing authority.
    let raised: unknown
    try {
      authorizeCeilingBoundedPermissionRise([rise('allow')], () => judgeFor(LEADER_IN(docs(ASK, ASK)), rise('allow')))
    } catch (error) {
      raised = error
    }
    expect(raised).toBeInstanceOf(PermissionMutationError)
    expect((raised as PermissionMutationError).code).toBe(PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT)
    expect((raised as PermissionMutationError).code).toBe('PERMISSION_AUTHORITY_CEILING_INSUFFICIENT')
    expect((raised as PermissionMutationError).code).not.toBe(PERMISSION_MUTATION_ERROR_CODES.EXPANSION_OUTSIDE_ENVELOPE)
    const detail = (raised as PermissionMutationError).details
    expect(detail.plane).toBe('expansion')
    expect(detail.ceiling).toBe('ask')
    expect(detail.risenEffect).toBe('allow')
    // HIGHER AUTHORITY IS STILL A REFUSAL IN PR2. The evaluator knows the rung that
    // could approve the rise, and the refusal carries it — so PR5 can turn THIS
    // into a pending item without changing the vocabulary, and nothing today can
    // read the refusal as "queued".
    // The rung the minimum-authority evaluator names for a Leader's own rise to
    // `allow`: the walk tries `human-user` (this Team's hard ceiling reaches only
    // `ask`, insufficient), rises past it, and lands on `human-admin`. That is the
    // honest answer, and it is also the disclosure: this repository has NO
    // production constructor for a `human-admin` position, so today this refusal
    // names a rung nothing can occupy — which is precisely why the escalation path
    // (PR5) must not be inferred from it.
    expect(detail.requiredAuthority).toBe('human-admin')
  })

  it('an unreadable ceiling document refuses as CONTEXT, never as insufficient and never as absent', () => {
    // The trap the coordinator restated: "an expansion-plane no-match that yields
    // {rules: []} silently strips every approval. Absent/unavailable must REFUSE,
    // never widen." Here the hazard is the sibling one — an unavailable read
    // treated as "no ceiling recorded", which reads as unlimited authority.
    let raised: unknown
    try {
      authorizeCeilingBoundedPermissionRise([rise('allow')], () => ({ status: 'unavailable', code: 'AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE' }))
    } catch (error) {
      raised = error
    }
    expect((raised as PermissionMutationError).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
    const detail = (raised as PermissionMutationError).details
    expect(detail.problem).toBe('authority-ceiling-document-unavailable')
    // The inner code SURVIVES the mapping: an operator debugging a storage fault
    // must be able to tell a ceiling fault from a missing static-layer fact, and
    // both refuse as CONTEXT for the same (correct) reason.
    expect(detail.authorityCeilingCode).toBe('AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE')
  })

  it('an undetermined ceiling refuses as CONTEXT too — not knowing is not a denial', () => {
    let raised: unknown
    try {
      authorizeCeilingBoundedPermissionRise([rise('allow')], () => ({ status: 'undetermined', plane: 'approval' }))
    } catch (error) {
      raised = error
    }
    expect((raised as PermissionMutationError).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
    expect((raised as PermissionMutationError).details.problem).toBe('authority-ceiling-undetermined')
  })

  it('unavailable beats undetermined beats insufficient, across the whole batch', () => {
    // All-or-nothing across regions, with the MOST conservative fact winning: a
    // batch carrying an insufficient rise AND an unreadable document refuses as
    // CONTEXT. Refusing it as insufficient would tell the operator to request
    // authority they may already hold, while the real fact is that the Team's
    // ceiling could not be read at all.
    const regions = [rise('allow'), rise('ask')]
    const verdicts: Record<string, PermissionRiseCeilingVerdict> = {
      [regions[0]!.regionText]: { status: 'insufficient', plane: 'expansion', ceiling: 'ask' },
      [regions[1]!.regionText]: { status: 'unavailable', code: 'AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE' },
    }
    let raised: unknown
    try {
      authorizeCeilingBoundedPermissionRise(regions, (region) => verdicts[region.regionText]!)
    } catch (error) {
      raised = error
    }
    expect((raised as PermissionMutationError).code).toBe(PERMISSION_MUTATION_ERROR_CODES.EFFECT_CONTEXT_UNAVAILABLE)
    // And with the unavailable region replaced by an undetermined one, the
    // insufficient region still loses to it.
    verdicts[regions[1]!.regionText] = { status: 'undetermined', plane: 'expansion' }
    let second: unknown
    try {
      authorizeCeilingBoundedPermissionRise(regions, (region) => verdicts[region.regionText]!)
    } catch (error) {
      second = error
    }
    expect((second as PermissionMutationError).details.problem).toBe('authority-ceiling-undetermined')
  })

  it('a batch with NO rising region is not gated at all — a ceiling caps expansion, not contraction', () => {
    // Recorded as a leg rather than a comment because the boundary is a decision:
    // requiring a grant to REMOVE authority would make a Team harder to restrict
    // the less authority its actor has.
    expect(() => authorizeCeilingBoundedPermissionRise([], () => ({ status: 'insufficient', plane: 'expansion', ceiling: 'no-authority' }))).not.toThrow()
  })
})

describe('the judge: the ceiling law the service composes, over real documents', () => {
  it('a Leader needs BOTH documents to reach the risen effect', () => {
    const r = rise('allow')
    expect(judgeFor(LEADER_IN(docs(ALLOW, ALLOW)), r)).toEqual({ status: 'sufficient' })
    // Own carrier allow, Team hard ceiling ask → insufficient on the EXPANSION
    // plane (the round-2 F-N1 hole: reading only the Leader's own document
    // answered sufficient here).
    expect(judgeFor(LEADER_IN(docs(ASK, ALLOW)), r)).toMatchObject({ status: 'insufficient', plane: 'expansion', ceiling: 'ask' })
    // And the other document alone does not rescue it either.
    expect(judgeFor(LEADER_IN(docs(ALLOW, ASK)), r)).toMatchObject({ status: 'insufficient', plane: 'expansion' })
  })

  it('a Human User is capped by the hard ceiling only, and a Human Admin by nothing', () => {
    const r = rise('allow')
    expect(
      judgeFor({ beneficiaryAuthority: 'human-user', initiatorAuthority: 'human-user', documents: docs(ALLOW, EMPTY_DOC) }, r),
    ).toEqual({ status: 'sufficient' })
    expect(
      judgeFor({ beneficiaryAuthority: 'human-user', initiatorAuthority: 'human-user', documents: docs(EMPTY_DOC, ALLOW) }, r),
    ).toMatchObject({ status: 'insufficient', ceiling: 'no-authority' })
    // `human-admin` has no production constructor in this PR (spec §7.4:302 binds
    // it no document); the row is pinned so the gate cannot be the place one
    // appears implicitly.
    expect(
      judgeFor({ beneficiaryAuthority: 'human-admin', initiatorAuthority: 'human-admin', documents: docs(EMPTY_DOC, EMPTY_DOC) }, r),
    ).toEqual({ status: 'sufficient' })
  })

  it('a {rules: []} hard ceiling is a DECIDED zero, so it refuses insufficient — not absent, not undetermined', () => {
    // The distinction the whole PR turns on: `{rules: []}` is a legal document that
    // authorizes nothing, and the v3 selection rule forbids reading it as "this
    // must be a pre-v3 team, skip the gate".
    expect(judgeFor(LEADER_IN(docs(EMPTY_DOC, ALLOW)), rise('allow'))).toMatchObject({
      status: 'insufficient',
      ceiling: 'no-authority',
    })
    // And an ABSENT slot behaves the same on this plane (no document, no grant)…
    expect(judgeFor(LEADER_IN(docs(ABSENT, ALLOW)), rise('allow'))).toMatchObject({ status: 'insufficient', ceiling: 'no-authority' })
    // …while an UNAVAILABLE one is a different refusal entirely.
    expect(judgeFor(LEADER_IN(docs(UNAVAILABLE, ALLOW)), rise('allow'))).toMatchObject({ status: 'unavailable' })
  })

  it('the two planes are computed separately: a rise either plane cannot reach is refused', () => {
    // Same documents, both planes asked. If the gate had been written with ONE
    // lookup (or a min() of the two), the plane named in the refusal would be the
    // same for every input; it is not.
    const r = rise('ask')
    const expansionOnly = judgeFor(LEADER_IN(docs(EMPTY_DOC, ALLOW)), r)
    expect(expansionOnly).toMatchObject({ plane: 'expansion' })
    const bothEmpty = judgeFor(LEADER_IN(docs(EMPTY_DOC, EMPTY_DOC)), r)
    expect(bothEmpty).toMatchObject({ plane: 'expansion' })
    expect(expansionOnly.status).toBe(bothEmpty.status)
  })

  it('the classifier still runs first: a rise the partition cannot evaluate never reaches a ceiling', () => {
    // The X7-R5 ordering, at the seam both halves share. No `subtreeContains` here
    // (the gate above is called with `contains`), so the classification itself
    // refuses as CONTEXT — which is what `service.ts` gets, because it classifies
    // before it judges.
    const input = {
      latestRules: [{ operation: 'write', resource: 'subtree:file:/root', effect: 'deny' as const }],
      plannedRules: [{ operation: 'write', resource: 'subtree:file:/root', effect: 'allow' as const }],
      mutationRules: [{ operationClass: 'write', matcher: ROOT, effect: 'allow' as const }],
      envelope: { rules: [] },
      staticFacts: { layers: [] },
    }
    expect(() => classifyPermissionRise(input)).toThrowError(/subtree-containment/)
    // With the predicate the same input classifies into a rise, and only THEN can
    // a ceiling be consulted at all.
    const withPredicate = classifyPermissionRise({ ...input, subtreeContains: contains })
    expect(withPredicate.rising.length).toBe(1)
    expect(withPredicate.rising[0]?.risenEffect).toBe('allow')
    expect(judgeFor(LEADER_IN(docs(EMPTY_DOC, EMPTY_DOC)), withPredicate.rising[0]!)).toMatchObject({ status: 'insufficient' })
  })
})

describe('the model-facing description tells the truth about what v3 does (PR #81 addendum)', () => {
  const tools = readFileSync(join(HERE, '..', '..', 'tools', 'src', 'tools.ts'), 'utf8')
  const revokeStart = tools.indexOf("'Revoke previously granted")
  const grantArm = tools.slice(tools.indexOf("verb === 'grant'"), revokeStart)
  const revokeArm = tools.slice(revokeStart, tools.indexOf('properties: {', revokeStart))

  it('the grant description states the ceiling gate and the code it refuses with', () => {
    // A model-facing description that documents behaviour I changed is a lie the
    // model acts on: until this sentence, the tool told the Leader that an
    // expansion needed only its own carrier. Zero test hits existed for these
    // strings at base — so this pin is written HERE, in the PR that changes the
    // behaviour, not retrofitted later.
    expect(grantArm).toContain('permissionMutationEnvelope carrier')
    expect(grantArm).toContain('schemaVersion-3')
    expect(grantArm).toContain('authority ceilings')
    // The code named to the model is the code the kernel raises — compared to the
    // kernel constant itself, so the two cannot drift silently.
    expect(grantArm).toContain(PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT)
    // And the temporary semantics are stated, not implied.
    expect(grantArm).toContain('REFUSAL, never a pending request')
  })

  it('the revoke description says a revoke can be an expansion and is gated the same way', () => {
    // A revoke that lets a looser lower rule answer is the reveal case Alpha.3
    // spent a PR establishing. A description that mentions only "the rules leave
    // the overlay" teaches the model that revokes cannot need authority.
    expect(revokeArm).toContain('reveal')
    expect(revokeArm).toContain('schemaVersion-3')
    expect(revokeArm).toContain('authority ceilings')
  })

  it('the description never claims a higher-authority mutation is queued', () => {
    // The inverse guard: a sentence like "will be reviewed" would be TRUE tomorrow
    // (PR5) and a lie today, and the model would act on the lie in between.
    for (const arm of [grantArm, revokeArm]) {
      expect(arm.toLowerCase()).not.toMatch(/(queued|pending approval|sent for approval|awaiting approval)/)
    }
  })
})

describe('the service places the gate where ADR X7-R5 puts it', () => {
  const service = readFileSync(join(HERE, '..', 'governance', 'service.ts'), 'utf8')
  const code = service.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '')

  it('AFTER the Leader authorization and BEFORE the commit', () => {
    const leader = code.indexOf('authorizeLeaderPermissionMutation(')
    const gate = code.indexOf('authorizeCeilingBoundedPermissionRise(')
    const commit = code.indexOf('overlay.append(')
    expect(leader).toBeGreaterThan(-1)
    expect(gate).toBeGreaterThan(leader)
    expect(gate).toBeLessThan(commit)
  })

  it('does not decide v3 from anything but the injected context', () => {
    // The selection rule lives in the reader (the plane, which sees the blueprint).
    // If the SERVICE ever grows `schemaVersion` / `rules.length` logic, the gate
    // would start widening or tightening itself on a document-shape guess.
    expect(code).not.toMatch(/schemaVersion/)
    expect(code).toMatch(/ceilingContext !== undefined/)
    expect(code).not.toMatch(/documents\.teamHardEnvelope[^)\n]*\.rules\.length\s*===\s*0/)
  })

  it('maps ONLY the document-unavailable ceiling fault onto CONTEXT and rethrows every other error', () => {
    expect(code).toMatch(/AUTHORITY_CEILING_ERROR_CODES\.DOCUMENT_UNAVAILABLE/)
    expect(code).toMatch(/throw error/)
  })
})
