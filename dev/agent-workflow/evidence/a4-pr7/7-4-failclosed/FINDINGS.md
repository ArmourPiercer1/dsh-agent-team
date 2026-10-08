# A4-PR7 §7.4 / §7.5-prerequisite-3 — the 7-4 fail-closed lane: findings

Lane: `feat/a4-74-failclosed`, worktree `.worktrees/a4-74-failclosed`, every write under
this directory (a lane of this stage put evidence into the coordinator's tree in an earlier
round; that is recorded under "instruments that lied" because it made an instrument's green
and red both untrustworthy, and it is a lane defect, not a cosmetic one).

Anchors: `anchor-after-merge.txt` (the pre-mutation `service.ts` anchor re-derived against
this tree after both base merges). Commit count is deliberately not written here — read it
with `git rev-list --no-merges --count 2162f6a7..HEAD` (currently 5 non-merge commits plus
the two base merges); a number copied into a document is a number that can go stale.

---

## 1. The law as landed

A governance lane that wired **no** `authorityCeiling` port now **refuses** a permission
mutation that raises the effective effect, instead of committing it.

| property | landed value | why |
| --- | --- | --- |
| code | `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` | A3-3: an unread ceiling wears a CONTEXT label. The remedy is "wire the ceiling", not "ask a higher rung". |
| never | `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT` | that would put an authorization verdict on a document nobody read, and would feed the A4-PR5 proposal catch — minting a durable proposal from an unread ceiling (ADR A1-7). |
| problem slot | `authority-ceiling-port-absent` | tells the operator which of the two context faults this is; the sibling is an unreadable document. |
| scope | RISE only | a tightening still commits. Refusing it would leave a mis-wired lane unable to revoke anything, and would teach operators to delete the lane rather than wire it. |
| classification's own refusal | propagates as itself | a lane that cannot establish that it is not rising (subtree relations, no predicate) has established nothing. Never relabelled. |
| pre-v3 `undefined` from the reader | **untouched** | the one existential answer A5-12 allows to skip the gate. Its post-flip reachability is a separate ruling (§5 F-5). |

The gate's shape before this commit: `root.ts:2899` injected the port through a
**conditional spread**, and the gate was entered only `if (lane.authorityCeiling !==
undefined)`. No port therefore meant no gate, and the rise appended. Its two siblings in the
same file (the control recheck at `:2332`, the projection at `:3675`) fail closed.

## 2. The bill, re-measured on the flipped corpus

Identity diffs (leg identities, not counts) over the population the repo's own vitest
config defines — `include: ['packages/*/test/**/*.test.ts']`, i.e. NINE package roots:
`runtime`(350 files at HEAD) `testkit`(29) `client`(28) `domain`(26) `storage`(23)
`remote`(15) `contracts`(13) `tools`(12) `legacy`(7) — run twice: once on the lane's
pre-merge base and once after merging `258d2b48`. The post-merge pair is the one that
must be spent, because the base moved under the lane (PR #179).

**Read the first column as five-root, and read it as a defect of mine.** That run recorded
`417 files / 5047 legs` while covering exactly `contracts legacy domain storage runtime`;
`git ls-tree` on the same commit counts **501** test files across all nine roots, so the row
silently dropped `tools remote testkit client` — `29+28+15+12 = 84` files, including this
gate's own suite. The **spent** pair is nine-root on both sides (`502` files, per-root counts
in `bill-check.txt`), and all five files of the 54 live in `packages/runtime/test/`, so the
bill itself loses nothing; the label "whole population" did not apply to the left column.
Found by the coordinator's confession of the same blind spot, not by my own diff — recorded
in `REPAIRS.md` §7.2.

| | pre-merge base `6174f1e5` | post-merge base (branch @ `751394dc` with both production edits backed out) |
| --- | --- | --- |
| files / registered legs | 417 / 5047 | 502 / 6273 |
| titled reds, base side | 18 (+3 collection-error files) | 34 (+3 collection-error files) |
| titled reds, landed side | 73 | 78 |
| **green→red (identity)** | **55** | **54** |
| **red→green (identity)** | **0** | **10** (all accounted for: 8 are this lane's own new/inverted instruments, 2 are the disclosed `p6t1-parallel` load flake) |
| collection-error set | unchanged (3 files, same names) | unchanged (3 files, same names) |
| registered-leg delta | 0 | 0 |

The 55 → 54 difference is not drift: the 55th leg was **PIN-3**, which this lane retired in
the commit that falsified it, so it is green on the landed side and red on the base side
(inside the 10). No pre-existing leg went red→green because of the law.

**The three numbers the brief asked for:**

* **(a) fixture legs whose verdict changes: 54.** All listed by identity in §3, with the
  refusal attributed per leg from the census (51 fired my refusal; 3 fired the
  classification's own `subtree-relation-unknown`, which is a consequence of this change but
  is not my fault code — §5 F-3).
* **(b) fixture legs whose answer stays green but changes REASON: 0.** The census instrument
  recorded exactly one `would-refuse|authority-ceiling-context-abstained` event
  (`a4p7-ceiling-no-context-refusal` leg 5, the pre-v3 existential) and its verdict is
  unchanged: it still commits, through the same branch it always used. Nothing else reached
  the new code without refusing.
* **(c) shipped product behaviour newly refusing: 0.** Evidence: the only red legs in the
  production-entry suite are its two **root-direct** legs; every leg of that file that boots
  the host stays green (`a3p4-pr4-production-entry-regression`), and the shipped-composition
  pins PIN-1 / PIN-1b / PIN-2 / PIN-4 / PIN-5 are green (only PIN-3 moved, by retirement).
  In production the port IS injected (`host.ts:2703` is the sole producer), so the refused
  path is a wiring fault that the shipped composition does not have. What a real deployment
  gains is the refusal existing at all, plus the wire mapping in §4.

## 3. Per-leg bill (54), with attribution

Totals in this table are computed from the census file and the identity captures in this
directory (`census.jsonl`, `postmerge-*-reds.txt`, `pm-newreds.txt`), by the script quoted in
`measurements.md`; no total below is typed by hand. "drives in body" counts the
`mutatePermission`-shaped calls inside the leg: a leg with ≥2 has a **setup/seeding drive**,
which is where most of this bill actually dies (§5 F-2).

| file | reddened legs | refused on MY law | refused on the classification's own law |
| --- | --- | --- | --- |
| `packages/runtime/test/a3p3-permission-mutation-authority.test.ts` | 13 | 13 | 0 |
| `packages/runtime/test/a3p3-revoke-reveal-semantics.test.ts` | 12 | 9 | 3 |
| `packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts` | 16 | 16 | 0 |
| `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts` | 2 | 2 | 0 |
| `packages/runtime/test/a3p4-pr7-entry-exec-contract-regression.test.ts` | 11 | 11 | 0 |

TOTAL legs: 54  (attribution total 51 on my law)


<details><summary><code>packages/runtime/test/a3p3-permission-mutation-authority.test.ts</code> — 13 legs</summary>

| leg (:line) | drives in body | attribution |
| --- | --- | --- |
| a stale expectedGeneration is a typed conflict with NO partial write (:L564) | 3 | mine |
| creates NO permanent priority: the Leader recovers by tightening without any env… (:L521) | 3 | mine |
| may exceed the Leader envelope and records Human provenance (:L502) | 1 | mine |
| a MALFORMED envelope refuses a change-mutation that rises NOTHING (parse precede… (:L469) | 2 | mine |
| a maxEffect ceiling is a CEILING: ask covers deny->ask but never ask->allow (:L387) | 2 | mine |
| exact envelope rules do not cover wider matchers; subtree roots cover what they … (:L411) | 3 | mine |
| TIGHTENINGS need NO expansion authority: all three, with an EMPTY envelope (:L317) | 4 | mine |
| a from-absence GRANT is an expansion measured from the DECLARED-NONE deny fallba… (:L294) | 2 | mine |
| an ask->allow expansion covered by maximumEffect=allow commits a new snapshot (:L258) | 2 | mine |
| a nested-subtree grant is covered only by a subtree envelope root the containmen… (:L843) | 1 | mine |
| an exec expansion is covered ONLY by the identical fingerprint (no subtree, no a… (:L732) | 3 | mine |
| every state-changing mutation appends exactly ONE FULL snapshot; the no-op write… (:L608) | 3 | mine |
| revoke_permission produces the unified snapshot WITHOUT the addressed pairs and … (:L657) | 2 | mine |

</details>

<details><summary><code>packages/runtime/test/a3p3-revoke-reveal-semantics.test.ts</code> — 12 legs</summary>

| leg (:line) | drives in body | attribution |
| --- | --- | --- |
| (f) nested exception: a non-rising child region cannot rescue the rising residua… (:L655) | 2 | mine |
| S6: subtree-deny removal revealing a STATIC allow under its root is refused at e… (:L537) | 6 | mine |
| S6d: fallback-ASK region (no rule below, declared ask fallback): subtree-deny re… (:L596) | 6 | mine |
| S1b: the same revoke passes ONLY with allow-ceiling coverage of the WHOLE matche… (:L270) | 3 | mine |
| S3: deny->ASK reveal is expansion VERBATIM (ADR §6): refused without ceiling, ac… (:L283) | 6 | mine |
| B1 (BUG2): exact ask under an overlay-matching subtree allow is a TIGHTENING — a… (:L444) | 3 | mine |
| S7b: the same revoke with envelope coverage of the removed matcher (ceiling allo… (:L424) | 5 | mine |
| X1 CANONICAL (parent fixture): subtree(R)=allow + exact(R/file)=deny; DECLARED-N… (:L755) | 5 | classification |
| X1p: the SAME revoke WITH the predicate is the decidable deny->allow reveal — EX… (:L779) | 5 | mine |
| X2 EQUAL-SUBTREE REWRITE (parent addition): subtree(R)=deny updated to ask with … (:L801) | 3 | classification |
| X3 STATIC subtree allow exposed by revoking the overlay subtree deny, NO predica… (:L845) | 3 | classification |
| X4 GATE SPECIFICITY: EXACT-ONLY context with NO predicate flows NORMALLY — decid… (:L889) | 4 | mine |

</details>

<details><summary><code>packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts</code> — 16 legs</summary>

| leg (:line) | drives in body | attribution |
| --- | --- | --- |
| grant_instance appends generation 1 through the ONE authority and `latest` reads… (:L373) | 0 | mine |
| the effective answer is `allow` from the overlay layer, and a different key is u… (:L402) | 0 | mine |
| the overlay layer overrides a static DENY of the same pair (layer precedence, ne… (:L442) | 0 | mine |
| a subtree grant answers for a DESCENDANT key through the per-decision verdict (:L477) | 0 | mine |
| an UNJUDGED subtree rule keeps the frozen lane asymmetry (a deny is never droppe… (:L602) | 0 | mine |
| the SAME Leader mutation commits once the lane supplies the containment predicat… (:L539) | 0 | mine |
| an exec grant answers its OWN fingerprint and no other (design §6 isolation) (:L629) | 0 | mine |
| renewing the same desired state is a NO-OP (no snapshot, no generation bump) (:L725) | 0 | mine |
| revoke appends generation 2, leaves generation 1 byte-identical, and the decisio… (:L674) | 0 | mine |
| a MemberInstance created AFTER the grants has zero permissions (:L952) | 0 | mine |
| no static facts from the decision site = UNKNOWN, typed, no decision (:L1054) | 0 | mine |
| ARCHIVED: execution is refused, the overlay stays the retained authority (:L740) | 0 | mine |
| DISPOSED: execution is refused, and a mutation against a terminal instance is re… (:L770) | 0 | mine |
| a GENUINE rule change at restore time is one ordinary mutation through the autho… (:L889) | 0 | mine |
| restore performs NO permission write even when a grant was already standing (the… (:L924) | 0 | mine |
| revoked during ARCHIVE stays revoked after restore (no replay, no resurrection) (:L830) | 0 | mine |

</details>

<details><summary><code>packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts</code> — 2 legs</summary>

| leg (:line) | drives in body | attribution |
| --- | --- | --- |
| a LEADER exact grant inside the injected envelope COMMITS at the assembled root … (:L364) | 1 | mine |
| R5-tool — the REAL team_grant_permission/team_revoke_permission surface: grant c… (:L1711) | 0 | mine |

</details>

<details><summary><code>packages/runtime/test/a3p4-pr7-entry-exec-contract-regression.test.ts</code> — 11 legs</summary>

| leg (:line) | drives in body | attribution |
| --- | --- | --- |
| a tool call addressed to Team B canonicalizes at B’s durable default workspace —… (:L883) | 0 | mine |
| exec intent → server canonicalization → durable exact-fingerprint row → pre-exec… (:L499) | 0 | mine |
| file class through the real tool: grant → REAL pre-execute ALLOW on write; revok… (:L605) | 0 | mine |
| tool: ghost → INSTANCE_UNKNOWN rejected zero-write; DISPOSED → TARGET_TERMINAL; … (:L825) | 0 | mine |
| file class through the real router → pre-execute ALLOW; absent/revoke → DENY (:L703) | 0 | mine |
| operator exec-intent grant through the real router → pre-execute ALLOW; router r… (:L656) | 0 | mine |
| reason is REQUIRED at the wire (item 4): absent → typed malformed on field reaso… (:L786) | 0 | mine |
| replay: a rule-set-equal re-grant no-ops (changed:false); the SAME mutationId wi… (:L961) | 0 | mine |
| Leader claim → NOT the §7 exemption: the row records leader provenance, and expa… (:L1065) | 0 | mine |
| RPC-position symmetry of the ARCHIVED law: human claim over an ARCHIVED target c… (:L1198) | 0 | mine |
| legitimate Human claim → legal mutation; the durable row records the human prove… (:L1023) | 0 | mine |

</details>

### legs whose OWN drive (a single mutation in the body) is the refused one

- a3p3-permission-mutation-authority.test.ts:L502 may exceed the Leader envelope and records Human provenance
- a3p3-permission-mutation-authority.test.ts:L843 a nested-subtree grant is covered only by a subtree envelope
- a3p4-pr4-production-entry-regression.test.ts:L364 a LEADER exact grant inside the injected envelope COMMITS at

count: 3


### Re-derivation recipe per file (what each leg should now assert)

The dominant repair is **not** an assertion edit — in every one of the 54 legs the assertion
that fails is still the law the leg was written to test. What the fixture lacked was an
authority world, so the repair is to give the world one:

| file | shape of the fix | where |
| --- | --- | --- |
| `a3p3-permission-mutation-authority` | one injection in `openServiceWorld` (:167, lane at :189): a ceiling reader answering a declared document that COVERS each leg's own drive, so the envelope/coverage law under test stays the thing that decides. | single helper |
| `a3p3-permission-lifecycle-e2e` | one injection in `openLaneWorld` (:226, lane at :264). The file is about snapshots, revoke, archive, restore, inheritance — nothing about ceilings — so a covering document is the honest world for it. | single helper |
| `a3p3-revoke-reveal-semantics` | one injection in `world` (:87, lane at :113). For the three `containment:'no'` legs the injection alone is not enough — see §5 F-3, they need the predicate's absence explained, not hidden. | single helper + 3 judgement calls |
| `a3p4-pr7-entry-exec-contract-regression` | the world is assembled by `createTeamProductionRoot` (:333), i.e. the root seam itself: inject the same port production injects (`host.ts:2703`'s reader over the test blueprint), so these legs exercise the root-assembled lane **as shipped** instead of as mis-wired. | one root call |
| `a3p4-pr4-production-entry-regression` | the two root-direct legs (E1, R5-tool) get the port at their `createTeamProductionRoot` call sites (:244/:1012/:1777/:1971 — the two the census attributes); the host-booting legs need nothing, which is the measurement in (c). | two call sites |

Three legs refused on their OWN drive (a single mutation in the body) and therefore needing a
judgement rather than a mechanical injection — each is still a coverage/envelope law, so the
world must cover the drive and let that law speak:

- `a3p3-permission-mutation-authority:L502` — "Human mutation may exceed the Leader envelope
  and records Human provenance": the rise is the point; the ceiling must be declared wide
  enough that the HUMAN law, not the wiring, is what refuses or allows.
- `a3p3-permission-mutation-authority:L843` — "a nested-subtree grant is covered only by a
  subtree envelope root the containment accepts": same shape, subtree flavour.
- `a3p4-pr4-production-entry-regression:L364` — "a LEADER exact grant inside the injected
  envelope COMMITS": its assertion is a COMMIT, so declaring an authority world that covers
  the cell restores the leg's meaning exactly; leaving it refused would silently convert a
  commit-leg into a refusal-leg, which is the forbidden repair.

And the rule that governs all of it: **an assertion is never edited to match what the new
code outputs.** If a re-deriver cannot state what the leg would assert in a correctly wired
world, that leg goes into the escalation list, not into a green run.

## 4. The wire gap (§7.4), measured before it was fixed

A bare `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT` throw had **never** reached a remote
caller as itself. Remote invariants 4a/4b pass through only members of the closed
`REMOTE_BACKING_ERROR_CODES`; this code was not a member, so invariant 5 rewrote it to
`internal-error` with `details.reason: untyped-error`. Measured on the real throw-proof
dispatcher (`createS6RemotePorts` + `createS6RemoteDispatcher`, a real governance service
behind the `override.mutatePermission` slot answering a real ceiling refusal), the literal
before-value:

    Expected: "PERMISSION_AUTHORITY_CEILING_INSUFFICIENT"
    Received: "internal-error"

(capture: `mutate-bite-prejoin-run.log`, produced by deleting the one vocabulary member and
re-running; restore verified by blob `11d0fd8d…`). The same measurement with the fail-closed
change also reverted is in `mutate-bite-prechange-run.log` (6 legs red, PIN-3's literal
before-verdict saved in `pin3-before.json`: `{\"changed\":true,\"snapshot\":…}` — a
zero-authority rise that COMMITTED a snapshot).

Fix: one member joins the closed vocabulary. The approval-PENDING outcome stays out (A4-PR5's
law: it rides `{changed:false, reason:'mutation-proposal-pending'}` on the closed
projection), pinned by leg W5. The fail-closed refusal needed **no** new member — it rides
the already-mapped context code (leg W3's census claim). Leg W2 pins that the three ceiling
answers stay told apart across the transport instead of being flattened by it.

The second, less obvious half: `packages/client/composition-shim/client-bundle.js` **inlines**
the closed vocabulary, so the shipped client copy could not have named the code either. That
surfaced only because `check:artifacts:head` refused my first artifacts commit
(`verdict=stale drift=1`): the drift was exactly those 17 lines, with the measured controls
`258d2b48 → verdict=ok drift=0` and `2162f6a7 → verdict=ok drift=0`, so the drift was mine
(`artifact-provenance.log`).

## 5. Findings

**F-1 — the fail-open was real, untested in the only direction that mattered.** 17
`createTeamProductionRoot` call sites: 1 production producer, 16 test worlds, and **zero**
test worlds injected the port. So the repository had no leg that could tell "the ceiling
refused" from "nobody asked", and the one leg that pinned the difference (PIN-3) pinned the
WRONG answer because it was measuring the shipped behaviour honestly and the shipped
behaviour was wrong.

**F-2 — most of the bill is SEEDING drives, not the legs' own drives.** The sharpest case is
`a3p3-permission-mutation-authority:L317` "TIGHTENINGS need NO expansion authority: all
three, with an EMPTY envelope": its first act is `mutationId: 'mut-seed-allow'` — a human
grant that raises authority — and that is what now refuses. The leg's own law is untouched
and still true; the fixture had been establishing its precondition through the open gate. The
same shape explains the `renewing the same direction` leg of the lifecycle file, `X1`'s two
seed grants (:758-759), and every leg in the table with `drives ≥ 2`. **This is the finding,
not the red count**: a corpus that seeds authority through a gate cannot be evidence that the
gate works.

**F-3 — on port-less AND predicate-less worlds the refusal's IDENTITY moved.** Three legs of
`a3p3-revoke-reveal-semantics` (the `unknown subtree relation refuses typed` group:
X1 CANONICAL, X2, X3) went red **without** my fault code firing. Before the change, nothing
classified the batch on those worlds (the gate was skipped, and classification lived inside
it). Now the classification runs on a port-less lane — and throws its own
`subtree-relation-unknown` on the legs' seeding drive. Both before and after the leg dies
typed and zero-write, but the law speaking changed, and the reveal law these legs exist to
test is no longer reached on those worlds. Leg N4 of the new pin suite pins the new ordering
as intended (a lane that cannot establish non-rise must not rise); what needs a decision is
the fixture: give the world a predicate and a ceiling, so the reveal law speaks again.

**F-4 — the pre-v3 `undefined` branch is untouched, and its reachability is not settled by
this lane.** `createAuthorityCeilingReader` answers `undefined` for a DECIDED `schemaVersion`
1/2 binding, and `a4p7-ceiling-no-context-refusal` leg 5 asserts such a rise still commits.
After the §7.3 flip, producing a v1/v2 binding requires the `migration-required` path in
`blueprint-authority.ts`, so the branch is plausibly unreachable in the shipped composition —
but "plausibly" is not a ruling, and widening it into the port-absent case was the tempting
wrong move (it would have silently retired A5-12's existential inside a fail-closed commit).
Variant E measured what that widening would cost: **59** new reds, the delta over the landed
law being exactly leg 5 plus the 3 flake legs. It is left for a ruling, with that number
attached.

**F-5 — the naive form of this law is a false bill AND an escalation.** Refusing *every*
mutation on a port-less lane (no rise gate) measured **94** reds and converted
`a4pr0-proposal-generation.test.ts` into a file-level collection error — its 8 legs fire at
module scope, so they did not turn red, they **stopped being registered** (5047 → 5039). A leg
that "resolves" into a collection error is an escalation, not a fix; the rise gate is not an
optimisation, it is what keeps tightenings and module-scope harnesses alive.

**F-6 — `pnpm -r run build` is not the build.** `pnpm build` emits `packages/runtime/dist`;
the other half of the install surface (`packages/client/composition-shim`) is emitted by
`pnpm build:composition`. Running the first and not the second produced an artifacts commit
that `check:artifacts:head` correctly refused. Disclosed because it is a trap for every lane
that inherits the §7.8 instrument.

**F-7 — the population's denominator moved mid-lane.** Pre-merge 417 files / 5047 legs;
post-merge 502 / 6273. A bill measured against the old denominator is not spendable, which is
why §2 reports both pairs and cites the post-merge one as the bill.
*F-7 is also the row where my own run was narrower than the config: see §2's
five-root disclosure and `REPAIRS.md` §7.2.*

**F-8 — there is no `any` ceiling.** The repair seam's first draft declared `maximumEffect:
allow` over `{ kind: 'any' }` matchers and every leg died with `authority-ceiling-insufficient
… reaches only no-authority`. `matcherCovers`
(`packages/domain/authority-envelope/src/authority-envelope.ts:213-231`) branches on
`fingerprint`, on `exact`, and by elimination on `subtree` — no `any` arm. A document-level
`any` is read down the subtree branch with an `undefined` resource, which covers nothing or
returns `undeterminable: true`, and `evaluateMatches` step 2 lets one undecidable same-class
rule undetermine the whole scope. `any` is a static-layer / mutation-matcher kind only
(`permission-mutation.ts:824`). Consequence for every lane that follows: **a declared ceiling
is a cell set**. Full write-up `REPAIRS.md` §4.1.

**F-9 — an empty context carrier is a SECOND, narrower ceiling.** Declaring only the hard
ceiling left nine legs red on the *expansion* plane. A `leader` install is bound by
`['teamHardEnvelope','permissionMutationEnvelope']` (`authority-ceiling.ts:290-310`) and the
meet runs over bound documents, so a context whose carrier is `{ rules: [] }` caps every
Leader drive — including the legs whose subject is what the carrier says. The repair mirrors
the lane's own carrier into the context, which makes the v3 meet equal Alpha.3's coverage law
instead of narrowing it.

**F-10 — in an approval-wired lane, the ASK answers before the ceiling refusal does.** Zeroing
a declared ceiling in a root-assembled world produced
`TEAM_RUNTIME_CALLER_NOT_FOUND — root session … has no team-root binding` (bite class D in
`bite/README.md`): a refused Leader rise with the port present and the proposal lane wired is
escalated into a durable ask, and the ask resolves the caller through
`admission/resolve.ts:246-266`. Production always has that binding, so this is a fixture
observation and I changed no product code for it — but the §7.5 deletion lane turns more
fixtures approval-wired, and it should expect refusals to arrive wearing the ask path's
clothes, with the durable row as a prerequisite.

## 6. Instruments that lied to me this round

1. **The §3 table `13 / 26 / 41 / 0`** — pre-flip, and it would have been a comfortable,
   wrong bill. Spending it would have understated the change by roughly 4×.
2. **My own first instrument (variants A and C)** — an ungated refusal on a port-less lane. It
   reported 94 reds and *hid* the `a4pr0` collection death inside a bigger number. It lied
   twice: the count was wrong and the category was wrong (a vanished leg is not a red one).
3. **My census matcher** — first run reported "54 unmatched" because vitest's JSON joins
   `ancestorTitles` with spaces while `__vitest_worker__.current.fullName` uses ` > `
   separators. A matcher bug that reads like "the instrument disagrees with the law".
4. **The brief's baseline "19 reds + 3 collection errors"** — measured 18 + 3 pre-merge; the
   difference is `p6t1-parallel`, which goes green and red between runs under load and is the
   only disclosed flake. Any total that includes it must say so.
5. **A parked `.inert` copy of the width pin in an evidence directory** — it made a landed,
   committed, passing instrument look unlanded for rounds. A parked copy in evidence is not a
   statement about the tree; the tree said `8 passed (8)` the whole time (re-run on this tip,
   `width-pin-rerun.log`).
6. **Evidence and scratch written into the coordinator's tree** — not a measurement error but
   an instrument-poisoning one: it made `git status --porcelain` non-zero in the tree where
   another agent's own instruments read green and red. Relocated into this worktree.
7. **`pnpm -r run typecheck --no-bail`** — the flag lands on `tsc`, which answers four real
   `error TS5023: Unknown compiler option '--no-bail'` lines over a clean tree. The count is
   literal, the cause is the invocation, and the correct form (`pnpm --no-bail -r run
   typecheck`) prints 0. Both forms are recorded in `typecheck-nobail.txt` and
   `typecheck-nobail-CORRECT-FORM.txt` so nobody has to re-discover which number means what.

8. **`check-artifacts-committed.mjs`'s own sentence — RETRACTED against current `master`, and
   the tree I measured it on is named here.** I quoted
   `OK: 1508 files … committed install-surface artifacts match the fresh build` as an `OK`
   printed over a surface no fresh build had produced. That sentence is real **on `6174f1e5`,
   this lane's pre-merge base**, where it sits at
   `scripts/check-artifacts-committed.mjs:161`. It does not exist on current `master` or on
   this tip (`git show master:scripts/check-artifacts-committed.mjs | grep -c 'match the fresh
   build'` → `0`; same at `HEAD`), because the PR #179 this branch merged at `258d2b48` rewrote
   the check into four drift classes and replaced the sentence with its own correction:
   *"This script does not build, so this says the tree matches what is staged, NOT that a build
   produced these bytes; ask `pnpm check:artifacts:head` whether the commit carries its own
   build."* The coordinator's grep caught me; the method survives the retraction — trust the
   `DSH-ARTIFACT-VERDICT … verdict=ok|stale|refused` token, never the prose.
## 7. What this lane did NOT do (the disclosure)

* **The 54-leg fixture bill is PAID, in `7f382ac7`, at the seam.** The earlier version of this
  bullet disclosed the bill instead of spending it (the brief at that point said land-and-stop);
  the stage gate bound afterwards is §7.6's — *Alpha.4 may remove baseline failures but adds
  none* — so 54 newly-red legs were a merge blocker however well disclosed. Every one of the 54
  is repaired by declaring the authority world the fixture presupposed (five worlds, three
  shapes, one injection each), none by bending an assertion; three legs (`X1`/`X2`/`X3`) needed a
  recorded re-scope because their state stopped being constructible at all. Per-file and per-leg
  record, the bite proofs, and the pre-v3 reachability measurement:
  **[`REPAIRS.md`](./REPAIRS.md)** and **[`bite/README.md`](./bite/README.md)**. Final identity
  diff against the post-merge base: `NEW 0` (`bill-check.txt`).
* **`leaderEnvelopeCoverage` is untouched**, per instruction: deleting it is the §7.5 deletion
  lane's bill (40 names / 39 legs), and this lane's job was to make that deletion testable.
  What this lane contributes to that testability: with the port-absent skip gone, a corpus
  that passes after the deletion is a corpus where the ceiling was consulted on every rise —
  and `shipped-newly-refusing = 0` means the deletion lane inherits no behaviour change it
  would have to explain.
* **No fixture assertion was edited to fit new output.** The only test-body edits in this lane
  are (i) the PIN-3 retirement, in the commit that falsifies it, with the before-verdict
  captured; (ii) PIN-5's strengthening, which adds assertions and names itself; (iii)
  `settleMutation` carrying the typed `problem` slot (additive, and the reason is stated in
  its comment); (iv) one unused-import removal in a file this lane created.
  After the repair commit the same sentence still holds, extended: (v) the five fixture worlds
  gained ceiling declarations and one line of production wiring; (vi) the three `X` legs gained
  bodies that assert the refusal their world can now only produce, with their titles changed to
  say so and their twins holding the old law (`REPAIRS.md` §3). Zero assertion edits means no
  assertion was changed to match new output — not that no body was ever rewritten, and the three
  rewrites are named with their old and new identities rather than being folded into "repaired".
