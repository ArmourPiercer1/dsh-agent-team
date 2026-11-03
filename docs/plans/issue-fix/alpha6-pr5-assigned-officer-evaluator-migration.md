# Alpha.6 PR5 — assigned-Officer capability must go through the single evaluator (P0 design + PoC)

Status: **design + proof-of-concept** (branch `alpha6/pr5eval-poc-20261104`, based on
`alpha6/int-20261103`). Not merged, not pushed, not a gate claim.

## 1. The defect

`packages/runtime/control/service.ts#assignedOfficerCapability()` built
`ReviewCapabilityCandidate.of({...})` directly instead of calling the single pure
`evaluateReviewCapability()` (`packages/runtime/review-authority/evaluator.ts`).
Consequences (all P0-class, because every consumer treats a
`ReviewCapabilityCandidate` as already-evaluated trusted evidence):

- the assigned-Officer entry skipped every PR2a law: current-leg transfer,
  `requires-human`, fixed Leader/Human category, the frozen ordinary-ask set,
  reviewer/Officer template identity, scope/generation/effect-set agreement,
  the Officer self-ask law, and the earlier-leg exclusion;
- it invented authority-bearing evidence: `scopeFingerprint: "a6-pr5:<requestId>"`
  is not a scope identity at all;
- it took the operation owner instance from the SUBJECT instead of the requester,
  and defaulted missing generation/Blueprint identity to `0`/`''`;
- it minted a `blueprint-officer` candidate even when the leg was not a delegable
  ordinary tool ask.

`memberCapabilityProblem()` (the PR2b binding gate) re-checked the candidate
against the durable row but cannot restore the policy laws the candidate never
satisfied. So the P0 is real: this was a **second authority path**.

## 2. Facts inventory — what the evaluator needs and where each fact really lives

| `ReviewCallFacts` field | Trusted source | Durable? | Decision-time? |
| --- | --- | --- | --- |
| `reviewer` | the resolved caller | — | yes |
| `reviewerMember` | durable `MemberInstance` record via `resolveCaller` | yes | yes |
| `requester` | `RequestPayload.requester` | yes | — |
| `currentOfficer` | trusted assignment port + the durable member record | — | **yes** |
| `operationOwner` | `RequestPayload.requester` + `operationOwnerTemplateId` | yes | — |
| `operationTool` | durable leg tool identity fields | yes | — |
| `currentCase.*` | durable leg: case id, request id, ordinal, kind, rung, effect, fingerprints | yes | — |
| `currentCase.status` | `pending` by construction (decision/abandonment refused under the team lock before the gate) | — | yes |
| `scopeFingerprint` | the canonical `scopeKey()` — the same identity the durable request id is derived from | derived | — |
| `operationScope` | rebuilt from the durable leg | yes | — |
| `effectSetFingerprint` | PA manifest (`reviewPayload.effects.fingerprint`) when the marker is present | yes | — |
| `paManifestPresent` | `parsePaControlManifest(reviewPayload) !== undefined` | yes | — |
| `blueprint.revision/contentHash` | durable leg fields | yes | — |
| `blueprint.reviewRouting` | **missing** — see §3 | no | yes |
| `currentLegTransfer` | durable transfer rows; the member entrance already refused any transfer | yes | — |
| `authorityGeneration` | durable leg `??` PA manifest | yes | — |
| `fixedLeaderOrHumanCategory` | **missing** — no production producer exists | no | yes |
| `requiresHuman` | derivable from the current rung (`leader` ⇒ false) | derived | — |
| `escalationSuccessor` | `controlEscalationSuccessor(rung)` (pure) | derived | — |
| `officerActedOnEarlierLeg` | control state: decisions + escalations for earlier legs of the case | yes | yes |
| `perEffectRequiredAuthorities` | **already durable** on the leg (`RequestPayload.perEffectRequiredAuthorities`) and in the PA manifest (`perEffectRequired`) | yes | — |

Two corrections to the review's premise:

1. `perEffectRequiredAuthorities` is already carried by the durable leg (and
   more strictly by the PA manifest). It does not need a new source.
2. `reviewerMember` and `currentOfficer` are **decision-time** facts. Persisting
   them on the request row would freeze an assignment that must be current
   (archival/disposal/handoff change it). They must never be persisted as
   authority.

So the genuinely missing set is only:

- `blueprint.reviewRouting` (policy),
- `fixedLeaderOrHumanCategory` (classification),
- `requiresHuman` (classification; safely derivable today),
- plus the decision-time officer identity, which the existing trusted
  assignment port already answers.

## 3. Why `reviewRouting` cannot come from the bound Blueprint today

- `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` is `[3, 4]`; the v5 grammar is dormant
  (`parseBlueprintV5` is directly callable but the catalog's `parseBlueprint`
  refuses v5).
- The v5 core is parsed by the frozen v4 bridge **with `reviewRouting` stripped
  and the version restamped to 4**, so a catalog-resident `TeamBlueprint` never
  carries `reviewRouting`.
- `resolveTeamAndTarget().bound.blueprint` is therefore a v3/v4 `TeamBlueprint`
  at the decision point: no routing.

Consequence: **whichever option is chosen, the composition must hand the
routing policy to the control plane somewhere** — at leg creation (Option A) or
at decision time (Option B). There is no third source.

## 4. Option A — persist a reviewRouting/facts snapshot on the control leg

Add to `RequestPayload` (all additive optionals, absent on every pre-Alpha.6
row):

```ts
readonly reviewRouting?: {
  readonly enabled: true
  readonly officerTemplateId: string
  readonly ordinaryToolApprovals: {
    readonly default: 'officer'
    readonly leaderExceptions: readonly { memberTemplateId: string; tool: { owner: string; name: string } }[]
  }
  readonly whenOfficerUnavailable: 'hold' | 'leader'
}
readonly fixedLeaderOrHumanCategory?: boolean
```

`requiresHuman` stays derived from the rung; persisting it would freeze a
classification the ladder already answers.

Write path: `requestApprovalLeg(args)` → `requestControl({ leg })` →
`RequestPayload` writer. Parse path: the strict payload parser gains the two
optional fields; a PRESENT but malformed snapshot is a corrupt row, never
silently dropped (dropping it would silently switch policy). ABSENT on a legacy
row ⇒ the assigned-Officer path refuses (`blueprint-routing-absent`), never
defaults.

Pros: durable; frozen together with the leg's `blueprintContentHash` /
`blueprintRevision`; survives restart and replay without a live composition;
makes the decision evidence self-contained.

Cons: (a) adds durable schema **before** the v5 catalog flip decides the
canonical form; (b) freezes a policy that the Blueprint hash already identifies,
i.e. a partial duplicate of the binding; (c) every creation caller
(tool-admission, recovery, tools) must supply the policy, so composition work is
still required; (d) it does not cover `currentOfficer`, so a port is still
needed; (e) legacy rows cannot be backfilled and stay fail-closed forever.

## 5. Option B — trusted `reviewCallFactsForAssignedOfficer` port (implemented)

Narrow overlay, supplied by composition:

```ts
interface AssignedOfficerReviewFacts {
  readonly reviewRouting: ReviewRouting
  readonly fixedLeaderOrHumanCategory: boolean
  readonly requiresHuman: boolean
}
readonly reviewCallFactsForAssignedOfficer?: (input: {
  rootSessionId; approvalCaseId; currentLegRequestId; legOrdinal;
  kind; reviewAuthority
}) => Promise<AssignedOfficerReviewFacts | null>
```

The service assembles every other fact from the durable leg, the durable member
record and control state. The port **cannot** name a different case, leg,
principal, scope, owner, tool, generation or effect set — the service derives
those, and `memberCapabilityProblem()` re-binds the resulting candidate to the
row. Assignment stays with the existing trusted
`currentReviewerForTransfer` port, extended only by reading the reviewer's
template from the durable member record.

Pros: no durable schema change, hence zero back-compat/migration work; legacy
rows simply refuse (fail closed) when the composition cannot answer; the port is
the same trust class as the existing `currentReviewerForTransfer` /
`trustedRuntimeTakeover` ports; it slots exactly where the v5 source is already
parsed (`packages/runtime/alpha6/wiring.ts`); revocable.

Cons: decision-time dependency, and the composition still does not supply
`currentReviewerForTransfer` anywhere in production (it is test-only today), so
the feature remains unreachable until the PR6 root wiring lands. The port must
parse the same v5 source as the router — two parsers could drift.

## 6. Recommendation

**Hybrid, in two steps.**

1. **Now (this PoC): Option B.** It removes the second authority path
   immediately, adds no durable schema, and is reversible. The assigned-Officer
   entry calls `evaluateReviewCapability()` with service-assembled case facts
   plus a minimal trusted overlay.
2. **Before the Alpha.6 v5 catalog flip / PR6 production wiring: promote the
   routing to Option A.** Once the catalog admits v5 (or the flip lands), read
   `reviewRouting` from the bound Blueprint directly and persist the snapshot on
   the leg for replay/restart evidence; demote the port to decision-time
   assignment only (or delete it). Do **not** keep both sources authoritative:
   persisted snapshot = the leg's policy; bound Blueprint = current policy; a
   disagreement must refuse, never pick one.

Why not A first: it still leaves `currentOfficer`/`reviewerMember` decision-time,
and it hard-codes a durable shape before the flip settles the canonical one.

## 7. Exact call sites changed by the PoC

- `packages/runtime/control/types.ts`
  - `ControlServiceOptions.reviewCallFactsForAssignedOfficer` (new, optional).
  - `AssignedOfficerReviewFactsQuery`, `AssignedOfficerReviewFacts` (new).
- `packages/runtime/control/service.ts`
  - `assignedOfficerCapability()` — **no more `ReviewCapabilityCandidate.of`**:
    require both trust ports, derive facts, call
    `evaluateReviewCapability(facts, entry)`, map a refusal to a gate problem.
  - `resolveControl()` member gate call site (was ~L3075): pass
    `reviewerMember` and `officerActedOnEarlierLeg`.
  - `escalateApprovalLeg()` member gate call site (was ~L5506): same.
  - `reviewerMemberOf()` helper (durable member record → `ReviewerMember`).
  - `earlierActBy()` extracted from `assertNoActOnEarlierLeg()` so the
    earlier-leg law has ONE home; the throwing assertion keeps its exact
    behavior and error details.
- `packages/runtime/test/a6-pr5-officer-access.test.ts`
  - third case rewritten: distinct Officer allow + escalate accepted by the
    evaluator; self-review refused with `operation-owner-is-officer`; an
    unassigned caller still refused.
  - test-local v3 Blueprint with a dedicated `officer` MemberTemplate and a
    test-local Officer seed (`inst-a6pr5officer`).

## 8. Test-world note

`createP6T4World` has no independent Officer, and its only MemberTemplate with
`resolve-control` in the member envelopes is `worker`. Reusing `worker` as the
Officer would make the OperationOwner and the Officer share a template, which
the evaluator refuses (`operation-owner-is-officer`) — so the allow case needs a
template distinct from the operator's. The PoC keeps the change test-local: a
complete v3 Blueprint source plus a seed member, passed through
`createP6T4World(..., { blueprintSource, seedMembers })`. The routing policy
comes from the facts port, not the document, because the catalog still cannot
parse v5.

## 9. Verification performed (PoC)

```text
pnpm --filter @dsh-agent-team/runtime typecheck
  -> exit 0 (tsc -p tsconfig.json, no diagnostics)

npx vitest run packages/runtime/test/a6-pr5-officer-access.test.ts
  -> 3 passed (3)

npx vitest run <a6-pr1-review-router, a6-pr2a-review-capability,
  a6-pr2b-review-chain, a6-pr2c-transfer, a6-pr6-wake-plan,
  a4p3-approval-case, a4p3-approval-escalation>
  -> 119 passed (7 files)

npx vitest run packages/runtime
  -> 4 failed | 5944 passed (488 files, 5948 tests)
  -> ALL 4 failures are the protected-center digest fences
     (u6-arc-a-fitness, u6-pr6-arc-d-adversarial); both are GREEN on the
     unmodified base, i.e. the delta is exactly the intentional center edit
     that still needs an integration-owned ledger booking.
```

Mutation check (proof the test pins the defect): restoring ONLY the old
`control/service.ts` (keeping the new spec) makes the self-review case fail
(`3 tests: 1 failed | 2 passed`) — the old path accepted the self-review that
the evaluator now refuses.

## 10. Residual risks

1. **Composition gap**: neither `currentReviewerForTransfer` nor the new facts
   port is wired in production yet. The P0 fix is structural (one evaluator
   path); end-to-end enablement remains PR6 root-wiring work.
2. **Routing provenance**: the port must use the same parsed v5 policy as the
   router. Recommend one composition helper (parse once, feed router + control
   port + wake notifier) rather than a second parser.
3. **Classification facts**: `fixedLeaderOrHumanCategory` has no production
   producer yet. Until one lands, the port answers `false`, which is only safe
   because `isDelegableOrdinaryToolAsk()` re-checks kind, fingerprints,
   authority point and the effect set; any future classifier must be the same
   frozen predicate, not a copy.
4. **Generation currency**: the evaluator compares the case generation to a
   generation derived from the same row, so a capability does not prove the
   generation is CURRENT. PA verification and the A1-14 `authorityRevalidation`
   port remain the generation authority; the capability must not be read as it.
5. **Evidence shape change**: `scopeFingerprint` moves from the placeholder
   `a6-pr5:<requestId>` to the canonical `scopeKey()`. Any `reviewCapability`
   evidence persisted by the pre-fix path has a different form; it should be
   treated as pre-fix evidence (no migration is proposed, the path was never
   gate-green).
6. **Error text**: evaluator refusals now surface through the existing
   `CONTROL_RESOLVER_NOT_AUTHORIZED` member-gate problem string, with the
   refusal code in parentheses. Tests matching exact text must be updated.
7. **Protected-center digest booking (integration-owned)**: `control/service.ts`
   and `control/types.ts` are entries in
   `dev/agent-workflow/ledgers/arc-a-protected-center.json`. Any real fix
   touching them must book the new SHA-256 with a `pr` + `reason` (the
   `PR #571 (integration: A6 control chain)` entry is the precedent). The PoC
   intentionally does **not** book a ledger change — that is an integration/gate
   act — so the only red specs in the PoC are the two digest-lock fences
   (`u6-arc-a-fitness.test.ts`, `u6-pr6-arc-d-adversarial.test.ts`);
   they pass on the unmodified base and fail only because of the deliberate
   center edit. A mergeable patch must add the booking in the same commit.
8. **Verification scope**: this PoC was verified with
   `pnpm --filter @dsh-agent-team/runtime typecheck` and targeted vitest specs
   only. It is **not** a gate-green claim.
