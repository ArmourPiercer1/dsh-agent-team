# §7.6 scenario traceability map — Alpha.4 acceptance scenarios → asserting legs

**Lane:** A4-PR7 §7.6 evidence (`7-6-closure`) · **tree:** `.worktrees/a4-76-closure`, branch
`feat/a4-76-closure`, base `master @ 0e7004b6` · **written:** 2026-10-08.

**What this document is.** §7.6 bullet 6 requires "the targeted Alpha.4 acceptance suite
(`a4p7-v3-cutover-acceptance.test.ts`) green" and then names the scenarios that suite is supposed to
stand for. This map checks that claim leg by leg. It does **not** map scenarios to file names: every
identity below is a **registered** `describe > test` identity taken from the vitest JSON report of this
tree — `scratch/registered-legs-before.tsv`, 502 files / **6277** legs across the nine
`packages/*/test` roots as the root config loads them — and every mapped leg was **read in the body**,
not matched by title.

## 0. Two findings before the rows

**(a) The plan's own list is eighteen items, not seventeen.** §7.6 names the scenarios in one sentence,
semicolon-separated. Counted as written it is **18** items; counted the way the sentence is actually
meant — "expansion-plane no-match zero authority" and "its approval-plane counterpart" are two
obligations with *opposite* no-match semantics (ADR X7-R5), as are "self-tighten" and "self-expand" —
the map below carries **19 rows**. Nothing here turns on the number, but a claim of "seventeen"
cannot be checked against the plan text, so the discrepancy is recorded rather than smoothed over.

**(b) `a4p7-v3-cutover-acceptance.test.ts` does not contain the Alpha.4 acceptance suite.** It is green
and it is real — **70 legs, all passing** at this base, in 15 describe groups — but its content is the
**version cutover**: groups A/B/C/C2 (identity-before-version, the derived retired set, the discovery
surface, frozen-row classification), D1–D9 (degraded boot, the non-acknowledgeable refusal, the
degraded anchor, the start ports, the resume entrance), and GROUPS E/F (the shell-class ceiling gap).
Reading every one of its 70 registered titles, the only §7.6 scenario rows it discharges are **row 1**
(v3-only migration, in full) and **part of row 4** (the ceiling meet over a candidate set). The other
seventeen rows live in `a4p1-*`, `a4p2-*`, `a4p3-*`, `a4p4-*`, `a4p5-*`, `a4p6-*`, `a4p7-a1-14-*`,
`a3p3-*`, `a3p4-*`, `a2c7-*`, `a4a-*`, `a4pr0-*`, `tools/c1-*` and `storage/p4t2-*`. §7.6's wording
("the targeted acceptance suite … green: <seventeen scenarios>") therefore **overstates one file** and
is only true of the union of suites this map enumerates. That is the gap this document exists to close;
the scenarios themselves turn out to be largely covered (16 COVERED / 3 PARTIAL / 0 ABSENT), and the
three PARTIALs name exactly which sub-obligation has no leg.

## 1. Verdict summary

| # | §7.6 scenario row | Verdict | Primary holding suite(s) |
| --- | --- | --- | --- |
| 1 | v3-only migration | **COVERED** | `a4p7-v3-cutover-acceptance`, `a4p7-v8-catalog-migration-state`, `a4p6-start-gate-entrances` |
| 2 | expansion-plane no-match ⇒ zero authority | **COVERED** | `a4p2-ceiling-reachability`, `a4p1-authority-envelope` |
| 3 | …and its approval-plane counterpart | **COVERED** | `a4p2-ceiling-reachability`, `a4p1-authority-envelope`, `a4p2-dual-envelope-mutation` |
| 4 | monotonic overlapping ceilings | **COVERED** | `a4p1-authority-envelope`, `a4p2-dual-envelope-mutation` |
| 5 | live descendant creation | **PARTIAL** | `a3p4-permission-lifecycle-e2e`, `a2c7-subtree-matcher` |
| 6 | root identity drift | **PARTIAL** | `a4p5-permission-mutation-inline-commit`, `a4p5-permission-mutation-proposal` |
| 7 | Member/Leader/Human routing | **COVERED** | `a4p4-operation-approval-authority`, `a4p2-authority-ceiling` |
| 8 | voluntary escalation | **COVERED** | `a4p3-approval-escalation` |
| 9 | Human Admin terminal routing + unavailability | **COVERED** | `a4p3-approval-escalation`, `a4p4-operation-approval-authority`, `a4p3-intervention-projection` |
| 10 | Member mutation rejection | **COVERED** | `a4p5-permission-mutation-proposal`, `a4p1-authority-envelope` |
| 11 | Leader self-tighten / self-expand | **COVERED** | `a4p5-self-mutation` |
| 12 | revoke / reveal | **COVERED** | `a3p3-revoke-reveal-semantics`, `a4p5-self-mutation` |
| 13 | batch atomicity | **COVERED** (disclosed limit) | `a4p5-self-mutation`, `a4p2-dual-envelope-mutation` |
| 14 | single-shot preflight / last-mile + the §7.0 re-check | **COVERED** | `a4p4-operation-single-shot`, `a4p4-capability-vs-permission`, `a4p7-a1-14-consumption-revalidation` |
| 15 | mutation CAS / lifecycle / identity drift | **COVERED** | `a4p5-permission-mutation-inline-commit` |
| 16 | warning dedup and ack | **COVERED** | `a4p6-governance-warning-service`, `a4p6-governance-warning` |
| 17 | restart reconstruction | **PARTIAL** | `a4p3-approval-case`, `a4p3-approval-escalation`, `a4pr0-proposal-store`, `a4a-control-exact-scope`, `permission-overlay-restart-persistence` |
| 18 | cross-Team isolation | **COVERED** | `tools/c1-caller-root-binding`, `storage/p4t2-*`, `permission-overlay-restart-persistence` |
| 19 | Intervention non-authority | **COVERED** | `a4p3-intervention-lane-hygiene`, `a4p6-intervention-aggregation` |

---

## 2. The rows

Leg identities are printed exactly as registered. Where a suite holds more legs of the same shape, the
extra ones are counted, not relisted.

### 1. v3-only migration — **COVERED**

Normative meaning used: spec §21.1 + plan §7.1/§7.2/§7.3 + ADR A5-10 (v3 accepted; a retired-version
document stays **listed** with identity and `migration-required`, is refused typed on resolve/start
with zero agent creation, and acknowledgement never clears it; a host anchored on a retired version
still **boots degraded**; the retired set is derived; catalog carries migration state).

Asserting legs:
- `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts > a4p7 7.1 C: an unmigrated Blueprint stays on the discovery surface and is refused typed > it is LISTED, with its identity and its version, under a build that runs v3 only` — body asserts the listed identity object literally: `schemaVersion: 1`, `migrationState: 'migration-required'`, origin/revision/sourceFile present.
- `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts > a4p7 7.1 C: an unmigrated Blueprint stays on the discovery surface and is refused typed > resolve refuses it with BLUEPRINT_MIGRATION_REQUIRED — not not-found, not the parser` — typed code plus a `detail` carrying the document identity, plus the operator-facing message containing "schema v1" and "migrate".
- `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts > a4p7 7.1 C: an unmigrated Blueprint stays on the discovery surface and is refused typed > the refusal asks for no source read: a retired document is never parsed on the way to no` — read-call counter is asserted empty.
- `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts > D2 — a host anchored on a version it does not run boots, and its Team does not start > ZERO durable writes: no TeamSession row, no binding, no compatibility state` — the zero-agent-creation half, measured on the durable medium.
- `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts > D3 — the refusal is not an acknowledgement path > the governance leg is never consulted for the refused create start` — acknowledgement cannot clear it, asserted by never consulting the warning plane.
- `packages/runtime/test/a4p7-v8-catalog-migration-state.test.ts > a4p7 R1 A: the version state is derived from the domain sets, never from a threshold > a retired version is migration-required exactly when the domain set says so` — the state is derived from `DEFINED \ SUPPORTED`, not a hand-declared list.
- Plus the same-shape families: `a4p7 7.1 A` (6 legs: identity judged before version), `a4p7 7.1 B` (4 legs: derived retired set + the two refusal names stay distinct), `a4p7 7.1 C2` (3 legs), `D1`/`D4`–`D9` (degraded anchor refuses every read, start ports refuse before the glue, resume gated on its row, gate does not refuse a document this build runs), `a4p6-start-gate-entrances > … > W1: handoff.create under a governance refusal refuses typed`, and `packages/runtime/test/a4p6-governance-warning-service.test.ts > 6.A fail-closed arms + bridge window > migration-required is ack-IMMUNE: no acknowledgement clears it, ever`.

Verdict reason: every clause of the cutover contract has a leg on the production surface (inspector,
authority resolve, catalog facade, host construction, start ports), and they pass.

### 2. Expansion-plane no-match ⇒ zero authority — **COVERED**

Normative meaning: spec §21.2 "no match -> no authority"; ADR X7-R5 / A1-4 — on the **expansion** plane
"no rule matches" is the absence of a grant, never the meet identity.

- `packages/runtime/test/a4p2-ceiling-reachability.test.ts > EXPANSION plane: what each position may commit, by reviewer position (A5-1) > EXPANSION: a Leader whose hard ceiling declares no rule for the scope has NO authority` — `{rules: []}` → `{status:'no-authority'}`; also both-empty, and an **absent** slot, read the same way.
- `packages/runtime/test/a4p2-ceiling-reachability.test.ts > EXPANSION plane: what each position may commit, by reviewer position (A5-1) > EXPANSION: a matcher that matches nothing is a decisive no-authority, not an undetermined` — the contrast pair (inside the subtree = allow, outside = no-authority, unnameable operation class = no-authority).
- `packages/runtime/test/a4p1-authority-envelope.test.ts > A4-PR1 lane B — the two lookups, and the meet that must never fuse them > X5-E3a the EXPANSION lookup reads an empty document as NO-AUTHORITY, never as identity` — plus `no-authority` is pinned as a real bottom element (`not.toEqual(DECIDED('deny'))`, `meet(NO_AUTHORITY, allow) = NO_AUTHORITY`).

Verdict reason: pinned at the algebra the service composes (`expansionCeiling` /
`effectiveAuthorityCeiling`) **and** at the service gate by row 13's legs in
`a4p2-dual-envelope-mutation`. Disclosed: the reachability legs are algebra-level — they hand
`expansionCeiling` documents and a containment predicate; the wired composition of that answer into the
mutation gate is the `a4p2-dual-envelope-mutation > the service places the gate where ADR X7-R5 puts it`
group (3 legs, read).

### 3. …and its approval-plane counterpart — **COVERED**

Normative meaning: ADR X7-R5/X5-E3 — on the **approval** plane a no-match is the meet **identity**; a
`{rules: []}` hard ceiling must never dead-lock approvals; the two lookups may never be fused.

- `packages/runtime/test/a4p2-ceiling-reachability.test.ts > the two planes for the SAME documents: X7-R5, in both directions > the same documents answer DIFFERENTLY per plane, and that difference is the whole point` — one world, both planes: expansion `no-authority`, approval `decided/allow`, plus the explicit `expect(expansion).not.toEqual(approval)` so a shared lookup cannot pass.
- ``packages/runtime/test/a4p2-ceiling-reachability.test.ts > the two planes for the SAME documents: X7-R5, in both directions > APPROVAL: an absent rule imposes NO narrowing, so a `{ rules: [] }` hard ceiling never dead-locks approvals`` — looped over every non-Member position.
- `packages/runtime/test/a4p1-authority-envelope.test.ts > A4-PR1 lane B — the two lookups, and the meet that must never fuse them > X5-E3 (BLOCKING) an EMPTY hard envelope plus a matching allow mutation ceiling yields grantCeiling = allow, not no-authority` — the BLOCKING cell at the PR1 level.
- `packages/runtime/test/a4p1-authority-envelope.test.ts > A4-PR1 lane B — the two lookups, and the meet that must never fuse them > X5-E3b the two lookups are never composed: grantCeiling meets ONLY narrowingForApproval` — and pins the identity is literally `CEILING_IDENTITY`.
- `packages/runtime/test/a4p2-dual-envelope-mutation.test.ts > C7: the approval plane cannot bind BELOW the expansion plane — proved, then pinned > for every document pair and scope, the approval plane is at or above the expansion plane` — plus its non-vacuity arm `the property is not vacuous: inverting the approval lookup reddens it`.

Verdict reason: the hazard X7-R5 was written for is pinned in both directions and with a non-vacuity
arm; the divergence legs pass.

### 4. Monotonic overlapping ceilings — **COVERED**

Normative meaning: ADR §7.2 / spec §21.2 — overlapping rules meet; adding a matching rule never
increases effective authority; broad-allow+narrow-ask→ask, broad-allow+narrow-deny→deny,
broad-deny+narrow-allow→deny.

- `packages/runtime/test/a4p1-authority-envelope.test.ts > A4-PR1 lane B — the two lookups, and the meet that must never fuse them > §5.3 monotonic restriction — adding a rule never raises a ceiling on either plane` — read: one document grows `allow(broad)` → `+ask(exact)` → `+deny(exact)`; both planes yield `['allow','ask','deny']`; a rank-monotonicity loop asserts no step ever raises; order-independence is checked on the reversed rule set.
- `packages/runtime/test/a4p1-authority-envelope.test.ts > A4-PR1 lane B — the two lookups, and the meet that must never fuse them > §24.2 meet table — every pairing, including undetermined absorbing` — the full 5×5 meet table, whose `deny ∧ allow = deny` row is where "broad deny + narrow allow → deny" actually lives.
- `packages/runtime/test/a4p1-authority-envelope.test.ts > A4-PR1 lane B — the two lookups, and the meet that must never fuse them > grantCeiling never exceeds either binding document (meet over the approval plane only)` and `> A1-5 the lattice is total and ordered no-authority < deny < ask < allow`.
- `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts > GROUP F - the candidate set the ceiling meets (RULING 4 closure) > THE MEET ANSWERS AT THE FINGERPRINT RUNG: one input goes leader -> human-admin` and `> NEVER WIDER: the meet is exactly the highest rung any candidate requires, over a matrix of documents` — the meet over a *candidate set* (the shell-class case), which is the monotonicity law at the wire.

Disclosed sub-case: "broad deny + narrow allow" is **not** pinned as a single-document pair of
overlapping rules; it is pinned as the meet of two documents (`WRITE_A_DENY` hard ∧ `WRITE_A_ALLOW`
mutation → `deny`, line 437 of the suite) and as the `deny ∧ allow` cell of the §24.2 meet table. The
within-document version of that one pairing has no leg. Verdict reason: the *law* (never increases) and
every meet pairing are asserted; the gap is a fixture shape, not an untested obligation.

### 5. Live descendant creation — **PARTIAL**

Normative meaning: spec §21.3 + ADR §8 / §7.3 — a subtree matcher applies to descendants created after
Team startup, a narrowing applies after descendant creation, and **no implementation may materialize a
startup-time descendant set and use it as authority**.

Asserting legs (the mechanism):
- `packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts > PR4 leg C — the subtree grant rides the injected containment predicate > a subtree grant answers for a DESCENDANT key through the per-decision verdict` — read: grants a subtree, then asks about a descendant key at `decisions.decide(...)` with the containment predicate passed **per decision**; inside → `allow` from the overlay layer, outside → the static default. Authority is computed per call, so nothing could have been enumerated.
- `packages/runtime/test/a2c7-subtree-matcher.test.ts > A2C-7 G13/A3 — the PURE resolver: the containment boolean is the whole matcher input (rootKey is provenance only) > containsOperation=true matches; false never matches; rootKey is NEVER consulted` — the matcher input is a boolean, structurally excluding a descendant list.
- `packages/runtime/test/a2c7-subtree-matcher.test.ts > A2C-7 G1-G4 — root itself / child / deep descendant / sibling (fake backend) > a child and a deep descendant match (the subtree the exact lane could not express)` and the `G5-G10 — the REAL pinned backend` group (6 legs, incl. `G10 junction retarget`): deep-descendant coverage against the real `FileSystem.contains()`.
- The envelope-side counterpart: `packages/runtime/test/a4p2-ceiling-reachability.test.ts > EXPANSION plane: what each position may commit, by reviewer position (A5-1) > EXPANSION: an undetermined subtree match absorbs instead of guessing` (no predicate ⇒ `undetermined`, never a guessed allow/no-authority).

Searched for, and not found:
- a leg that **creates a descendant after startup and then asks** — `grep -rIn "created after|after Team startup|after startup|created later|new file"` over all nine roots returns only `a3p4-permission-lifecycle-e2e > PR4 leg J — no inheritance > a MemberInstance created AFTER the grants has zero permissions`, which is the *Team-member* inverse (no implicit inheritance), not the filesystem obligation;
- a leg asserting the **prohibition** itself — `grep -rIn "enumerat"` over the registry returns four legs, none about descendant enumeration (`a4p6-remote-v8` principal routing, `t6-1` import closure, `a2c2` schema enumeration, `a4p7-v3-cutover-acceptance > D4 > enumerating or serialising it refuses too`).

Verdict reason: the live-recompute mechanism is pinned hard (per-decision containment, boolean-only
input, real backend), but the two literal §21.3 rows — "applies to a descendant created **after**
startup" and "**no** startup-time descendant enumeration" — have no leg that performs the creation or
asserts the absence.

### 6. Root identity drift — **PARTIAL**

Normative meaning: spec §6.2/§6.3 + §21.6 — a frozen proposal/case binds the matcher's **canonical root
identity**, never the descendant set; root retarget ⇒ `stale` / `mutation-stale`; **same root + changed
descendants ⇒ the proposal remains valid**.

Asserting legs:
- `packages/runtime/test/a4p5-permission-mutation-inline-commit.test.ts > drift after approval -> mutation-stale with ZERO writes > matcher ROOT drift (containment retarget under the same canonical key) -> stale` — read in the drift group: retarget the containment under the same canonical key, the approved mutation answers `mutation-stale` with zero writes.
- `packages/runtime/test/a4p5-permission-mutation-proposal.test.ts > the permission-mutation proposal fingerprint (spec 8.4, 24.5) > binds the matcher root — changing it changes the fingerprint` and its sibling `> binds the matcher kind (root identity class) — changing it changes the fingerprint` — the freeze itself: the proposal fingerprint carries the root identity.
- `packages/runtime/test/a4p5-permission-mutation-proposal.test.ts > a rise beyond the initiator ceiling inside approval reach -> durable proposal > the requester is the DERIVED principal…` — the frozen record the drift is later checked against.
- The Alpha.3 filesystem-side neighbour, cited only as adjacent (different obligation): ``packages/runtime/test/a2c7-subtree-matcher.test.ts > A2C-7 G5-G10 — the REAL pinned backend (the authority is the real `FileSystem.contains()`) > G10 junction retarget — the H4 fresh-decision proof: one install, the authority FOLLOWS the new target on the next decision (no install-time freeze)`` and `packages/runtime/test/h4-rule-identity.test.ts > H4-A2: ALLOW retarget — stale authority must not outlive the retarget (P1-A) > phase 2 (after the retarget): reading the ORIGINAL target is DENIED by the default — the …`.

Searched for, and not found: the "**same root + changed descendants → still valid**" half —
`grep -rn "descendant" packages/runtime/test/a4p5-*.test.ts` returns **nothing**; the nearest leg,
`a4p5-permission-mutation-inline-commit > allowed proposal -> inline commit, fully revalidated > an
unrelated lower-layer change that moves NO approved rise still commits`, moves a *layer*, not the
descendant set, so it does not discharge the clause.

Verdict reason: drift-invalidates is pinned on both the freeze (fingerprint) and the commit
(`mutation-stale`, zero writes); the complementary non-invalidation (descendants move, root stable,
proposal survives) has no leg.

### 7. Member/Leader/Human routing — **COVERED**

Normative meaning: spec §21.4 — Member ask → Leader by ladder default; rises to Human User **only when
the desired effect exceeds the Leader's `grantCeiling`** (both documents), to Human Admin only when it
also exceeds the Human User's; no self/same-level allow.

- `packages/runtime/test/a4p4-operation-approval-authority.test.ts > a4p4 lane A — an ask routes to the minimum authority the documents require > A1: a Member ask answers at Leader, and an absent document never causes a rise`.
- `… > A2: the rise to Human User happens because the LEADER ceiling is exceeded, not because a rule is missing` — the exact §21.4 trigger, and it names the wrong trigger in the assertion.
- `… > A3: a hard ceiling below the effect rises past Human User (bound by the SAME document) to Human Admin`.
- `… > A4: a Leader ask starts at Human User (the rung above the beneficiary)` — no self-review rung.
- `packages/runtime/test/a4p5-self-mutation.test.ts > the Leader mutating its OWN overlay > self-EXPANSION asks the rung above the LEADER (never a self-review rung), whatever the context labels` — read: the opened case's `beneficiaryAuthority` is `leader` while the leg asks `human-user`, and the overlay is still `undefined`.
- `packages/runtime/test/a4p1-authority-envelope.test.ts > A4-PR1 lane B — the two lookups, and the meet that must never fuse them > bindingDocs — Member is not a reviewer of its own expansion` and `> §7.4 bindingDocs is positional: Leader both documents, Hum…` (positional binding: Human User = hard only, Human Admin = none — see also `a4p2-ceiling-reachability > EXPANSION: a Human User is capped by the hard ceiling ONLY…`).
- `packages/runtime/test/a4p2-authority-ceiling.test.ts > evaluateAuthorityCeiling: two planes, and it never fuses them (X7-R5) > a Member ask whose effect the Leader may reach stops at Leader (ladder default)`.

Verdict reason: default routing, both rise triggers, and the no-self-review rule each have a leg on the
wired routing adapter (`a4p4` lane A drives the real ask→case path and reads back the durable leg).

### 8. Voluntary escalation — **COVERED**

Normative meaning: spec §21.5 — insufficient reviewer may deny/escalate only; escalation preserves the
case id, mints a new request id, the old leg can never later allow, and escalation grants zero
execution authority.

- `packages/runtime/test/a4p3-approval-escalation.test.ts > an escalation closes the current leg and raises the next one (A5-5, A1-10) > raises a NEW leg: same case, next ordinal, risen authority, never the parent id (A1-10)` — read: `nextLeg.approvalCaseId` **equals** the parent's, `legOrdinal + 1`, `requestId` **differs**, `previousRequestId` = parent's, exactly two durable request rows.
- `… > an escalated case authorizes nothing while its current leg is the closed one` — guard answer is `request-pending` (reason asserted, not just the boolean) and `consumptions` is empty.
- `… > the closed leg can never be decided again (terminal legs stay terminal)` — `CONTROL_REQUEST_DECIDED`.
- `… > the escalated-away reviewer cannot take the risen leg, with zero side effects (spec 11.4)` — `CONTROL_RESOLVER_NOT_AUTHORIZED` and the ledger is byte-identical.
- ``packages/runtime/test/a4p3-approval-escalation.test.ts > an escalation closes the current leg and raises the next one (A5-5, A1-10) > closes the escalating leg with a deny carrying reason …`` (the reason value is the literal `escalated`) and `> the risen leg decided by the risen reviewer authorizes the operation exactly once`.
- Legal-action half: `packages/runtime/test/a4p3-intervention-projection.test.ts > the legal-action law (spec §11.5, ADR A5-2) > a top-of-ladder reviewer may allow or deny only (no rung above)` and `> insufficient reach at the top of the ladder leaves DENY alone`.
- `packages/runtime/test/a4p3-approval-escalation.test.ts > every decision entrance refuses the escalated-away reviewer (spec 21.5, 24.5; ADR A1-10) > the refusals do not wedge the case — the risen rung stil…`.

Verdict reason: all five §21.5 clauses have legs, on a real control service with a reopened-store read.

### 9. Human Admin terminal routing and unavailability — **COVERED**

Normative meaning: spec §21.4/§21.5 (Admin allow/deny only) + ADR ("whether a Human Admin resolver
exists is orchestration state, not authority algebra") — routing to Admin must not invent authority and
must not strand a pending item when no resolver exists.

- `packages/runtime/test/a4p3-approval-escalation.test.ts > escalation refuses what it must and terminates what cannot be reviewed > a leg whose reviewer cannot exist terminates synchronously, durably and never pending (A1-12)` — read: outcome `authority-unavailable`, one case row, and `CONTROL_UNRESOLVABLE_AUTHORITIES` is exactly `['human-admin']`.
- `packages/runtime/test/a4p3-approval-escalation.test.ts > escalation refuses what it must and terminates what cannot be reviewed > a rise to Human Admin writes the closing leg only and reports authority-unavailable (spec 11.6)` — no next leg, zero pending, zero consumptions, and the guard still answers `DECISION_DENY`.
- `packages/runtime/test/a4p4-operation-approval-authority.test.ts > a4p4 lane A — an ask routes to the minimum authority the documents require > A12: a required rung with no resolver closes the case AT CREATION (never a pending leg)` and `> A5: an ask with no rung above it refuses to name a reviewer`.
- `packages/runtime/test/a4p2-ceiling-reachability.test.ts > EXPANSION plane: what each position may commit, by reviewer position (A5-1) > EXPANSION: a Human Admin binds NO document, so nothing narrows it — not even a faulted read` and `packages/runtime/test/a4p2-authority-ceiling.test.ts > evaluateAuthorityCeiling: two planes, and it never fuses them (X7-R5) > a Human Admin ask refuses instead of inventing a fifth rung` — Admin is terminal in the algebra, and no fifth rung exists.
- Truth-on-the-surface: `packages/runtime/test/a4-surface-authority-unavailable.test.ts > a4-surface: an A1-12 escalate-terminate close is TOLD as a terminal authority-unavailable item (spec 11.6; plan 6.D:651; the PR #118 recorded-half gets its rendered half) > THE TELLING: after the escalate terminates the case, intervention.list carries the case as a TERMINAL authority-unavailable item — informational, zero legal actions, nothing held, no-resolver named` (11 legs in the group) and `packages/runtime/test/a4-escalate-act-truth.test.ts > a4 escalate-act truth: escalate at a human-user leg closes the case and must be recorded as closing it > the case is CLOSED, not destroyed: th…`.

Verdict reason: terminal-by-construction and unavailable-resolver behaviour are both pinned, including
the closed unresolvable-authority set, and the wire tells the truth about the close.

### 10. Member mutation rejection — **COVERED**

Normative meaning: spec §21.6 "Member mutation initiation rejected".

- `packages/runtime/test/a4p5-permission-mutation-proposal.test.ts > the refusals that must never propose > member initiation refuses BEFORE any proposal machinery (zero rows, zero cases)` — read: the refusal happens before the proposal store is touched; the assertion counts proposal rows and open cases, both zero.
- `packages/runtime/test/a4p1-authority-envelope.test.ts > A4-PR1 lane B — the two lookups, and the meet that must never fuse them > bindingDocs — Member is not a reviewer of its own expansion`.
- `packages/runtime/test/a4p2-ceiling-reachability.test.ts > EXPANSION plane: what each position may commit, by reviewer position (A5-1) > EXPANSION: a Member is not a position with zero reach, it is a position with no row` — the algebra's own statement of why there is no Member row to consult.

Verdict reason: rejected at the entry, and the algebra refuses to answer the question at all for a
Member; both halves pass.

### 11. Leader self-tighten and self-expand — **COVERED**

Normative meaning: spec §21.6 "Leader self-tightening direct; Leader self-expansion reviewed".

- `packages/runtime/test/a4p5-self-mutation.test.ts > the Leader mutating its OWN overlay > a self-TIGHTENING needs no proposal at all (no rise -> gate silent)` — read: `changed: true`, zero proposal rows, zero open approval cases.
- `packages/runtime/test/a4p5-self-mutation.test.ts > the Leader mutating its OWN overlay > self-EXPANSION asks the rung above the LEADER (never a self-review rung), whatever the context labels` — `requiredAuthority: 'human-user'`, beneficiary `leader`, overlay still absent.
- `packages/runtime/test/a4p5-self-mutation.test.ts > the Leader mutating its OWN overlay > a self-EXPANSION allowed by the Human User commits inline into the Leader overlay` — re-drive after the allow commits generation 1 to the Leader's own overlay port.

Verdict reason: both halves run through the real mutation lane against the overlay/proposal/control
stores, not a double.

### 12. Revoke / reveal — **COVERED**

Normative meaning: spec §21.6 "revoke/reveal rise requires authority"; PR #81 addendum "a revoke can be
an expansion and is gated the same way".

- `packages/runtime/test/a4p5-self-mutation.test.ts > the revoke that reveals a lower allow is an expansion > proposes (deny -> revealed allow), then commits ONE rule-free snapshot on allow` — read: the case's `requestedEffect` is the **revealed** `allow`, not the revoked `deny`; after the allow the committed snapshot has zero rules at generation 2.
- `packages/runtime/test/a3p3-revoke-reveal-semantics.test.ts > reveals are expansions (ladder-strict) — static reveal channel > S1: revoke revealing a STATIC allow refuses under an empty envelope, with ZERO write` and `> S1b: the same revoke passes ONLY with allow-ceiling coverage of the WHOLE matc…`, `> S3: deny->ASK reveal is expansion VERBATIM (ADR §6): refused without ceiling,`, `> S5: revoking an ALLOW rule can never raise anything — legal WITHOUT any fact` (7 legs in the group, plus the `unknown subtree relation refuses typed` group).
- `packages/runtime/test/a4p2-dual-envelope-mutation.test.ts > the model-facing description tells the truth about what v3 does (PR #81 addendum) > the revoke description says a revoke can be an expansion and is gated the same way` — the model-facing text is pinned to the same law.

Verdict reason: gated at the ceiling, refused with zero writes when uncovered, and the equal-effect
non-rise case is pinned as legal so the rule is not over-applied.

### 13. Batch atomicity — **COVERED** (with a disclosed limit)

Normative meaning: spec §21.6 "one illegal region rejects entire batch".

- `packages/runtime/test/a4p5-self-mutation.test.ts > the batch is all-or-nothing > ONE region the ladder cannot approve dooms the WHOLE batch: no rows, no commit` — read: a two-rule batch (one approvable, one hard-capped) returns `changed: false` + terminal `authority-unavailable`, **zero** proposal rows, and the overlay port is still `undefined`.
- `packages/runtime/test/a4p5-self-mutation.test.ts > the batch is all-or-nothing > TWO approvable regions open ONE case with one proposal row per rule` — the positive shape: two rows, exactly one case, one open case.
- `packages/runtime/test/a4p2-dual-envelope-mutation.test.ts > the dual-ceiling gate: which refusal, in which order > unavailable beats undetermined beats insufficient, across the whole batch` and `> a batch with NO rising region is not gated at all — a ceiling caps expansion, not contraction`.

Disclosed limit (plan-level, not a test gap): the plan's own post-Alpha.4 backlog keeps
**proposal-record atomicity** open — "collapsing a proposal's authority-bearing writes into one durable
append", with an incomplete set required to render corrupt/incomplete until then (plan line 944). So
"all-or-nothing" is asserted at the **gate** (nothing opens, nothing commits), which is what §21.6
demands; it is not an assertion that the durable append itself is indivisible.

Verdict reason: the illegal-region case is refused with zero durable effect on the real lane; the
residual is a disclosed backlog item, recorded here rather than hidden behind the word "atomic".

### 14. Single-shot preflight / last-mile semantics, including the §7.0 re-check — **COVERED**

Normative meaning: spec §21.7 (no case when the capability is unavailable up front; ask + authority ⇒
case; drift after allow ⇒ stale; last-mile failure ⇒ execution-unavailable; a failed invocation
approval is not reusable; a successful exact operation consumes exactly once) + plan §7.0 (inside the
per-team lock, before writing `control-allow-consumed`, re-read the bound v3 documents and re-run the
ceiling for the **persisted** `authorityScope`; a rise ⇒ refusal with **zero** consumption).

Preflight / last-mile:
- `packages/runtime/test/a4p4-capability-vs-permission.test.ts > a4p4 lane B — capability/environment outcomes are not permission outcomes > B1: a capability unavailable at preflight writes NO control request and answers in the capability family`, ``> B4: with the capability available an `ask` still opens the durable approval case (permission is not swallowed)``, ``> B5: a faulting external facts probe fails closed through the capability family with zero rows``, `> B7: the preflight is ADDITIVE — the last-mile external recheck is retained (two probes per allowed call)`.
- `packages/runtime/test/a4p4-operation-single-shot.test.ts > a4p4 lane C — one approval, one invocation, and an honest terminal state > C1: authority drift after the allow — no execution, no consumption, no rewritten verdict`, `> C2: the capability vanishing after the allow is execution-unavailable, not a permission loss` (last-mile), `> C3: the exact invocation consumes the allow exactly once, and a replay is refused`, `> C4: a failed tool body does not refund the allow — the retry needs its own approval` (no reuse), `> C5: every terminal state the adapter reports is a member of the frozen vocabulary`, `> C6: the recheck comparison — equal is covered, a rise is stale, unknown is not confirmed`.

The §7.0 re-check:
- `packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts > A1-14 — the consumption point re-runs the ceiling for the persisted scope > A1: an authority rise after the allow refuses with ZERO consumption, and the unspent allow still authorizes once`, `> A2: an undetermined fresh ceiling refuses and consumes nothing`, `> A3: the persisted authority point is the authorized point` (the persisted exact scope, not "same toolName"), `> A4: an operation case with no authority point is refused at the write AND un consumable from disk`, `> A5/A6: a re-confirmed allow runs the recheck once and consumes exactly once`.
- ``packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts > A4-PR7 7.0 P group — the production revalidation port over documents > P1: fresh documents that no longer narrow the point permit the consumption``, `> P2: a narrowing that moved UP the ladder strands the allow, and costs nothing`, ``> P3: no v3 documents is `undetermined`, never "covered"``, `> P4: a reader that throws refuses by name; no fault escapes as a generic failure`, `> P5: the port asks the durable row's question and refuses unanswerable ones`.
- ``packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts > A4-PR7 7.0 S group — the shell class at the production seam (RULING 4, threaded) > S1: a shell command narrowed AFTER the allow refuses as `authority-risen` and consumes nothing``, ``> S2: the same shell row with no narrowing on ITS command consumes once (`still-sufficient`)``, ``> S3: the seam itself — THREADED answers `authority-risen`; a row that does not travel with its command is a NAMED REFUSAL, never coverage``, `> S4: the guard hands the port the ROW's command fingerprint, not a re-derived one` — the fingerprint-drift half of §7.0.
- Wired-in reality: `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts > GROUP E - why a shell narrowing was invisible to the ASK: three laws, one gap (RULING 4; closed at the ASK by GROUP F, at consumption by the a1-14 S group) > a fingerprint rule against an exact target is a DECISIVE non-coverage, never undetermined` names the gap the §7.0 re-check closes, and `packages/runtime/test/a4p7-approved-retry-ceiling-at-commit.test.ts` holds the ceiling-at-commit companion.

Verdict reason: both halves are asserted at their named production points — the adapter's consumption
path and the revalidation port over real documents — including the zero-consumption consequence.

### 15. Mutation CAS, lifecycle and identity drift — **COVERED**

Normative meaning: spec §21.6 — CAS drift after approval ⇒ `mutation-stale`; lifecycle drift ⇒
`mutation-stale`; root identity drift ⇒ `mutation-stale`; no-change after approval ⇒
`mutation-no-change`.

- CAS / base drift: `packages/runtime/test/a4p5-permission-mutation-inline-commit.test.ts > base movement after approval -> the approved mutation never commits > the SAME mutation at a moved base is a FRESH ask (A1-9 recovery); the allowed-at-old-base case never commits` and `> an explicit expectedGeneration pinned at the approved b…`; storage-level counterpart `packages/storage/test/p4t2-conflicts.test.ts > p4t2 conflicts: generation CAS (mandatory) > a stale expectedGeneration on the committed operation fails with stale-generation`.
- Lifecycle drift: `packages/runtime/test/a4p5-permission-mutation-inline-commit.test.ts > drift after approval -> mutation-stale with ZERO writes > lifecycle drift: an archived target answers mutation-stale (never a lifecycle throw, never a commit)` (plus `> proposal creation on an archived target still refuses typed BEFORE …`).
- Identity drift: `… > matcher ROOT drift (containment retarget under the same canonical key) -> stale` (row 6).
- No-change: `packages/runtime/test/a4p5-permission-mutation-inline-commit.test.ts > the other terminals on the retry path > desired state reached after approval -> plain no-change, the case untouched`.
- Ceiling drift (the fifth arm §21.6 implies): `packages/runtime/test/a4p5-permission-mutation-inline-commit.test.ts > drift after approval -> mutation-stale with ZERO writes > the ceiling NARROWS after approval (required now above approved) -> stale`.

Verdict reason: each of the four named outcomes has its own leg on the real commit lane, each asserting
the zero-write consequence.

### 16. Warning dedup and ack — **COVERED**

Normative meaning: spec §21.9 — a duplicate fingerprint updates count/time rather than adding an item;
acknowledgement does not alter authority; runtime `undetermined` fails closed.

- `packages/runtime/test/a4p6-governance-warning-service.test.ts > 6.A consistency diagnostic: consistent | mismatch | undetermined > fingerprint dedup: a repeat observation folds count/time, never a second warning` — the dedup clause, literally.
- `… > fingerprint drift (envelope edit) mints a NEW unacknowledged warn…` — the dedup key is the fingerprint, not the subject.
- `packages/runtime/test/a4p6-governance-warning-service.test.ts > 6.A acknowledgement plane > acknowledging binds the fingerprint and re-opens the SAME gate (ensureRootLive re-entry)`, `> a re-observation AFTER acknowledgement on the SAME fingerprint does not re-block (reminder-only)`, `> drift after acknowledgement produces an UNACKNOWLEDGED warning and blocks again`, `> acknowledging a warning-id that does not exist is a typed not-found, never a write`.
- Acknowledgement ≠ authority: `packages/runtime/test/a4p6-governance-warning-service.test.ts > 6.A a warning is not an approval case > a minted warning produces no ControlRequest row and no approval-case entry (the lane split)` and `> 6.A acknowledgement plane > the ack action vocabulary is the WARNING plane only`; `packages/runtime/test/a4p6-governance-warning.test.ts > A4-PR6 vocabulary freeze: three distinct action planes > the reviewer plane is exactly allow|deny|escalate and NEVER contains acknowled…`.
- Fail-closed arms: `packages/runtime/test/a4p6-governance-warning-service.test.ts > 6.A fail-closed arms + bridge window > corrupt authority document: blocked, NOT acknowledgeable` / `> unreadable authority document: blocked, NOT acknowledgeable`, and the undetermined-absorb leg `> undetermined ABSORBS: an undecidable containment compares as…` with the adapter's ``packages/runtime/test/a4p6-governance-warning-host-adapter.test.ts > A4-PR6 review round 1 (fix 3/6) — production `contains` reaches `undefined` > composition: an undeterminable containment…``.

Verdict reason: dedup, ack binding, reminder-only re-observation, drift re-blocking, and the
authority-disjointness of the ack plane are all asserted on the service and on the wire.

### 17. Restart reconstruction — **PARTIAL**

Normative meaning: §7.6's row plus the Alpha.4 invariant that durable governance state is reconstructed
from durable facts, never cached in process.

Asserting legs, by artifact:
- Approval cases / escalation chain: `packages/runtime/test/a4p3-approval-case.test.ts > the approval case reads (A1-11, A2-9) > reconstructs the whole chain from the durable rows after a restart`; `packages/runtime/test/a4p3-approval-escalation.test.ts > an escalation closes the current leg and raises the next one (A5-5, A1-10) > the case state reads the whole chain, and a restart reconstructs it` (read: a fresh service over the reopened store reports legs `[1,2]`, one escalation row, same case identity).
- Proposals: `packages/runtime/test/a4pr0-proposal-store.test.ts > A4-PR0 governance proposal store (durable append / read / reopen) > S7 reopen: the record survives from the durable medium, byte-identical…`; `packages/runtime/test/a4pr0-proposal-generation.test.ts > A4-PR0 the proposal record against the three generations (A4-2, A4-3) > G6 the appended pair still identifies the overlay head after …`.
- Permission overlays: `packages/runtime/test/permission-overlay-restart-persistence.test.ts > permission-overlay restart persistence (PR1 plan test 3) > reopens over the same durable store and reports the same auth…`, `> resumes the chain after a restart (generation and previous li…`, `> still refuses a stale generation after a restart (the head is…`, `> restarts with per-identity isolation intact`.
- Control rows / consumption: `packages/runtime/test/a4a-control-exact-scope.test.ts > A4a (C5): pending / decided / consumed state survives a fresh ControlService instance > after the restart (fresh service over the re-op…`; `packages/runtime/test/control-inline-abandon.test.ts > pre-alpha3 PR-D D.4 — the inline abandon (the terminal mark) > S6: the abandon fact survives a restart (durable authority — the guar…`; `packages/runtime/test/control-legacy-row-compat.test.ts > pre-alpha3 PR-D D.2 — legacy row compatibility > S3: a restart re-parses the legacy row — the derived subject and the decided sta…`.
- Effective-policy read plane: `packages/runtime/test/a3p4-production-permission-plane.test.ts > P2 / P3 / P4 — the configured exact / subtree / exec paths are live > an exact grant answers allow and survives a reopen of …`; ledger projection: `packages/runtime/test/a4pr0a-abandon-projection-closure.test.ts > A4-PR0a: an abandoned inline request must not break the ledger projection > C5: the fixed read is stable across a reopen (app…`.

Searched for, and not found — **the governance-warning family has no restart leg**:
`grep -rn "reopen|restart|fresh service" packages/runtime/test/a4p6-governance-warning-service.test.ts
packages/runtime/test/a4p6-governance-warning.test.ts packages/runtime/test/a4p6-intervention-aggregation.test.ts`
returns **nothing**, and the three files that reference the `governance-warning-observed` fact type are
exactly those suites plus a client spec — none reopens a store. So "a warning observed before a restart
reconstructs with its count/time and acknowledgement state" is unasserted.

Verdict reason: every other durable governance artifact has a reopen leg; the newest family (PR6
warnings) does not, so the row is PARTIAL rather than COVERED.

### 18. Cross-Team isolation — **COVERED**

Normative meaning: §7.6's row (and invariant 16) — one Team's authority, control rows, approvals and
governance state are neither readable nor consumable from another Team's root.

- `packages/tools/test/c1-caller-root-binding.test.ts > P0 caller-root binding (R1–R6) > R1: Leader A listing Team B pending is rejected with the P0 code and returns NO pending data`.
- `… > R2: Leader A resolving Team B request is rejected; Team B stays pending with 0 decisions/consumptions; Team B own lead…` — cross-root **consumption** is refused and leaves the victim Team's ledger untouched.
- `… > R3: member A reading Team B members is rejected at the gate (before any runtime effect)`, `> R4: Leader A listing Team A pending returns the empty list (root-scoped read works; Team B pending is not visible)`, `> R6: ledger invariants — Team A control state untouched (0/0/0); Team B holds exactly its one request + its own leade…`.
- Durable scoping: `packages/storage/test/p4t2-journal.test.ts > p4t2 journal: effects-less journal and team scoping > reading a foreign fact through the second team fails with idempotency-conflict` and `packages/storage/test/p4t2-conflicts.test.ts > p4t2 conflicts: cross-team fact conflict > team B re-submitting the same request fails with idempotency-conflict (foreign fact)`.
- Overlay/governance state scoping: `packages/runtime/test/permission-overlay-restart-persistence.test.ts > permission-overlay restart persistence (PR1 plan test 3) > restarts with per-identity isolation intact`; `packages/testkit/test/t6-4-policy-precedence.test.ts > P3-T6 G3-4: policy precedence exhaustive > identity scope: a foreign-root identity is rejected (policy family, single class)`.
- Contract level: `packages/contracts/test/negative.test.ts > contracts v1 — uniqueness and scoping (invariants 8/18/23) > a second TeamSession on the same root is DUPLICATE_TEAM_SESSION (invariant 8)`; projection plane: `packages/remote/test/p8t4-engine.test.ts > P8-T4 engine: whole-projection generation rule (G8) > rejects a frame of another teamSessionId as foreign`.

Disclosed: the neighbouring member-identity leg
``packages/runtime/test/d3-member-identity-context.test.ts > D3 the member identity context block (Team D1-D6 repair v2, B2) > D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected at the closed tool layer; a foreign-root setup rejects without installing a block`` is **RED at this base** — it is one of
the 19 disclosed baseline reds — so it is cited as disclosed debt, **not** counted as coverage. **[2026-10-08 round 41 — this disclosure was too generous, and the correction makes it worse]** the baseline-classification census found that D3-4 is not merely red: **its only check never executes** (the assertion at `d3-member-identity-context.test.ts:452` is unreachable at runtime — see `evidence/a4-pr7/baseline-classes/BASELINE-CLASSES.md` §5). So this obligation has **no live assertion anywhere**, and its closure condition is the test-only repair, not the exemption: a leg that is red is visible, a leg whose assertions cannot run is not even a witness to its own failure. The
`a4p6-intervention-aggregation` leg `> warnings are TEAM-scoped: a subject-filtered projection stil…`
does cover the warning plane's scoping within a Team.

Verdict reason: read, consume, durable write and projection each have a passing leg that names the other
Team explicitly; the one red neighbour is reported as such.

### 19. Intervention non-authority — **COVERED**

Normative meaning: spec §21.9 last row + ADR A1-16/A1-17 + invariant 16 — intervention is
projection/router only; a projection failure cannot mint authority; escalation grants zero execution
authority; no authority-bearing surface derives its principal from payload data.

- `packages/runtime/test/a4p3-intervention-lane-hygiene.test.ts > the intervention lane reaches no authority plane of its own (A1-17, A1-16) > no ceiling-lane name and no RuntimeAuthority anywhe…`, `> no repository, team lock, or ledger write anywhere …`, `> the lane's only governance edge is the TYPE-ONLY la…`, `> the lane directory is walked, and the four modules …` — source-law legs over the whole lane directory, plus `> the intervention lane imports nothing backwards (A1-17, audit F11) > no source outside intervention/** imports the intervention lane`.
- `packages/runtime/test/a4p6-intervention-aggregation.test.ts > A4-PR6 aggregation — one list, two planes, zero vocabulary bleed > plane isolation: a reader failure silences the CONTROL actio…` — the projection-failure arm: a failed read removes actions, it never manufactures them; and `> the warning item is informational forever and speaks ONLY {a…`.
- `packages/runtime/test/a4p6-intervention-aggregation.test.ts > A4-PR6 §6.B the v8 plane on the production wire (real dispatcher, real planes) > act routes by the ITEM class: an approval actio…`, `> allow drives the EXISTING control entry with th…` (the act entry delegates to the control service, it does not decide), `> an UNWIRED v8 surface refuses its four methods …`.
- Principal derivation is driven, not claimed: `packages/runtime/test/a4p6-driven-principal-act.test.ts > A4-PR6 review round 1 (fix 5/6) — the act caller is DRIVEN through the real derivation > the warning plane receives the D…` and `packages/runtime/test/a4p5-permission-mutation-proposal.test.ts > a rise beyond the initiator ceiling inside approval reach -> durable proposal > the requester is the DERIVED princi…`.
- Zero execution authority through escalation is pinned in row 8's legs (`a4p3-approval-escalation > … > an escalated case authorizes nothing while its current leg is the closed one`).

Verdict reason: the prohibition is asserted structurally (imports, writes, authority names), behaviourally
(failure ⇒ fewer actions, never more), and on the wire (the v8 dispatcher delegates).

---

## 3. How to re-check this map

```bash
cd .worktrees/a4-76-closure
node dev/agent-workflow/evidence/a4-pr7/7-6-closure/scratch/check-scenarios.mjs   # every cited identity must exist verbatim in the registry
python3 dev/agent-workflow/evidence/a4-pr7/7-6-closure/scratch/q.py "<regex>"     # search the 6277-leg registry by path/title
```

The registry (`scratch/registered-legs-before.tsv`, columns
`file / describe-path / title / status / full-name`) is the `--reporter=json` product of
`pnpm exec vitest run` on this tree — see `transcripts/root-census-before.txt`. Client-lane legs
(`*.client.spec.*`, 880 of them) are in `scratch/client-names-before.txt`; no scenario above depends on
one.

Last run of the checker on this document (2026-10-08):

```
citations checked: 95 full-path + 12 shorthand
resolved: 107 (full-path 95, shorthand 12)
resolved full-path legs that are NOT passing at this base: 1
  NOT-PASSED [failed] packages/runtime/test/d3-member-identity-context.test.ts :: D3-4 FAIL CLOSED: …
Every cited identity resolves to a registered leg.
```

The single `NOT-PASSED` line is **intended**: row 18 cites that leg as disclosed red debt, not as
coverage. If it ever turns green, that row's disclosure paragraph is stale and must be rewritten.

Index caveat, recorded so a future reader does not chase a phantom: the index writer emitted **49 of
the 6277** `full-name` fields as CSV-quoted cells (titles containing commas or quotes), so the raw TSV
carries the quotes (`"P3: no v3 documents is `undetermined`, never ""covered"""`). The checker unquotes
before matching, and this document quotes the **restored** title. A truncated citation is always marked
with a trailing `…`, and the checker treats only such marked spans as prefixes; anything without the
marker must match byte-for-byte.

## 4. Errata (dated) — what this map could not see when it was written

This map discharges rows by **citing legs**. That is the right instrument for "does an obligation have a leg", and it is structurally blind to whether the cited leg can *assert anything* — so the three findings in `evidence/a4-pr7/baseline-classes/BASELINE-CLASSES.md` (merged 2026-10-08) bear on it directly, and the rule below is now part of how this map must be re-checked.

1. **A baseline exemption on a red leg exempts every assertion in that leg, not just the one that fails.** Vitest stops a red leg at its first failing `expect(`, so of the **129** assertions written inside the 19 exempted legs, **93 (72 %) never execute**. Consequence for this document: **no row may be scored COVERED by a citation to an exempted red leg, and a re-check of this map must intersect its citations with the dead-assertion ledger (§5 of that file), not just confirm the cited title exists.** When this map was written I checked that cited legs existed and were green-or-disclosed; I did not check that their assertions ran. Nothing in the row table below relied on an exempted red leg for coverage, and the only citation into one is the D3-4 disclosure above — but the check itself was missing, which is how a green-looking artifact can carry an unexamined premise.
2. **A negative leg that passes because its fixture never reached the code under test is a leg that observed nothing.** Five green legs in `packages/domain/test/t1-capability-schema.test.ts` (`:194 :204 :217 :230 :241`) assert `expect(() => parseBlueprint(source)).toThrow()` and pass on a **YAML syntax error emitted by the test-local fixture serializer**, never reaching `validateBlueprintDocument`. I reproduced this independently with the repository parser: the serializer renders an array inline after its key (`items:         - skill-a`) and the parser throws `Unexpected block-seq-ind on same line with key`; the same content with correct indentation parses fine. `validateAllowDenyEntry` has **zero test references** and no test builds a blueprint from string YAML, so **the closed-vocabulary rejection of a malformed capability block has no working assertion anywhere**. This map never cited that file — which means the gap was invisible to it in both directions: no row claimed it, and no row flagged it missing.
3. **Row 17 (restart reconstruction) carries a citation into a leg that is being re-pinned.** `a4p3-approval-case.test.ts` is cited above, and the corrupt-leg work of this round has established that its assertion at `:693` — `expect(verdict.reason).toBe('no-request')`, with the comment "the guard does not see the row at all" — was a **false green at the seam that matters**, because `no-request` is exactly what `consultGuard` proceeds on. Row 17's own cited leg (whole-case reconstruction) is a different leg and is unaffected, so the row keeps its **PARTIAL** verdict; but any future re-score of approval-case coverage must read the post-re-pin file, not this citation.

**Doctrine taken from this:** a citation proves a leg *exists*; it does not prove the leg *runs*, and for a red leg it does not even prove the assertions behind the first failure are reachable. Where coverage is the claim, the instrument must measure execution, not registration.
