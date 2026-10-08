# A4-PR7 §7.6 lane 7-6-ceiling-pin — the ceiling gate's enforcement is no longer an assembly coincidence

Branch `feat/a4-76-ceiling-pin` @ base `18c2b7c3` (= origin/master, fetched and
verified). Core files (`host.ts`, `root.ts`) were **mutated only as measurement
instruments and restored by hash** — see §5; `git status --porcelain` over
`packages/runtime/src/` is empty in the final state, and CORE PATCH BUDGET spent: 0.

## §0 — Step 0 census: every assembly path that can produce a runtime composition

Measured by grep over the committed tree at `18c2b7c3` (raw call-site lists are
re-derivable with `grep -rn 'createTeamProductionRoot(\|createPermissionGovernanceLane(\|createGovernanceMutationService(\|createAuthorityCeilingReader('` over `packages/`).

**Family A — `createTeamProductionRoot(...)` (`src/plugin/root.ts:894`): 17 call sites.**
1 production caller (`src/plugin/host.ts:2675`, inside `apply`), **16 test sites in 12
files** (a3p4-pr4-decision-routing-regression, a3p4-pr4-production-entry-regression ×4,
a3p4-pr7-entry-exec-contract-regression, a3p4-production-permission-plane,
a3p5-permission-read-wiring, a3p5-permission-splice, a4f1-row-version-not-document-version,
a4p6-start-gate-entrances, a4p7-v3-cutover-acceptance ×2, a4p7-v8-catalog-migration-state,
bound-blueprint-persona-root, d2-s6-ensure-root-live; this lane added a 17th test site —
`a4p7-ceiling-port-assembly-pin.test.ts` world C, which injects overlay and NO port on
purpose).
**Test sites injecting `permissionAuthorityCeiling`: 0. Test sites injecting
`permissionOverlay` (⇒ the lane EXISTS, port absent): 9.**

**Family B — `createPermissionGovernanceLane(...)` (`src/plugin/permission-plane.ts`):**
root.ts:2878 (production wiring) + 3 test sites.

**Family C — `createGovernanceMutationService(...)`:** root.ts:2939 + ≈33 test sites.
Test files injecting a lane WITH `authorityCeiling:` — a4p5-permission-mutation-inline-commit,
a4p5-permission-mutation-proposal, a4p5-self-mutation, a4p7-approved-retry-ceiling-at-commit,
a4p7-carrier-width-under-ceiling, a4p7-ceiling-no-context-refusal. Lanes WITHOUT the port —
a3p3-governance-lane-hygiene, a3p3-permission-mutation-authority, a3p3-revoke-reveal-semantics,
a3p4-permission-lifecycle-e2e, a4pr0-proposal-generation, tools/p6t6-helpers,
rc2-team-deny-least-privilege.

**Family D — `createAuthorityCeilingReader(...)` (`src/plugin/permission-plane.ts`):**
exactly **ONE production producer — `host.ts:2703`** — plus 4 test constructions.

**One line, three consumers.** The value produced at `host.ts:2703` is spread into
three different objects by root.ts, and their absence-behaviours are NOT alike:
`root.ts:2332` control authority-revalidation — absent ⇒ `authority-undetermined`
REFUSAL (fail-CLOSED, documented); `root.ts:3675` projection `requiredAuthorityFacts`
— absent ⇒ no requiredAuthority, no offered actions, "never a substitute rung"
(fail-CLOSED, documented); `root.ts:2899` governance-lane `authorityCeiling` — absent
⇒ `service.ts:1214` `if (lane.authorityCeiling !== undefined)` skips the whole ceiling
consultation (the ONE fail-OPEN consumer). The lane's verdict, and only the lane's,
"hangs on one unpinned line".

**Verdict on the received claim.** "Held by exactly one line of composition wiring" —
CONFIRMED for production (Family D count = 1). "Nothing in the corpus pins that line" —
**CORRECTED**: `a4p2-dual-envelope-mutation.test.ts:475-479` carries a source-regex pin
of both files. It is a WEAK pin (§2 of the flip FINDINGS' classification applies):
measured below (§1.4) that a mutation leaving the pinned TEXT alive while making the
spread NEVER FIRE keeps the regex pin green and the ceiling dead.

## §1 — Step 1 instrument: `packages/runtime/test/a4p7-ceiling-port-assembly-pin.test.ts`

Construction-level, in-process, no host boot. Five sync legs over three module-level
worlds, booted by the REAL shipped entry `hostEntry.apply(ctx, config)` (worlds A/B —
the exact p8s5a/E2 double set, including the **`fs` public-service double**, see §4
instrument-5) and the root-direct factory (world C — the a3p4 pattern: real overlay
store, SETTLED member row, the fact readers the host injects, NO `permissionAuthorityCeiling`).

Drive (identical in all three worlds): a Leader `grant_instance` write/exact/allow rise
whose CARRIER covers the claimed cell (Alpha.3's coverage law has nothing to say — the
a4p7-carrier-width leg-4 precedent) and whose static facts deny everything (the drive is
a rise). The worlds differ in exactly one variable: the hard ceiling document (A: `rules: []`;
B: covering; C: host port absent altogether).

Measured verdicts at base (raws in this file's directory):
- **A (shipped, hard ceiling = zero authority):** NOT a throw — the fully-wired approval
  lane converts the DECIDED-insufficient rise into the durable proposal:
  `{ changed:false, reason:'mutation-proposal-pending', approvalCaseId, requestId,
  requiredAuthority:'leader', proposalFingerprint, detail.problem:'rise-above-actor-authority' }`.
  This shape is ceiling-OWNED: `approvalWired` (`service.ts:649-653`) requires
  `lane.authorityCeiling !== undefined`, so the proposal itself is evidence the port is
  present. PIN-1/PIN-1b pin it exactly (zero-write asserted: no `snapshot` field).
- **B (identical bytes, hard document covers):** `{ changed:true }` + generation-1 snapshot.
  The counter-control: A's non-commit is the hard DOCUMENT, not a world that refuses
  everything for an unrelated reason.
- **C (root-direct, every fact reader present, NO port):** `{ changed:true }`. THE
  PINNED HAZARD, measured: the same drive the shipped composition turns into a proposal
  COMMITS silently at the root seam. PIN-3 asserts this today and turns RED the day a
  fail-closed ruling lands — its message points here.

**1.1 — Mutation proof (the required one).** Deleted `host.ts:2703` (`sed -i '2703d'`).
Result: **PIN-1 ×** ("carrier-covered rise COMMITTED against a no-authority hard
ceiling: the ceiling gate was not consulted", with the durable snapshot embedded in the
message), **PIN-1b ×**, **PIN-4 ×** (census regex), PIN-2 ✓, PIN-3 ✓ (as designed —
their claims stay true under this mutant). Raw: `pin-MUTANT-host2703-DELETED-RED.log`.
Restore: `git show HEAD:<path>`, verified **by SHA-256 AND blob hash** —
host.ts `a9c12a9e…6c46e2a` pre == post, blob `2987013a…4d7c346` == HEAD. Exit code
never consulted for the restore claim. Re-run after restore: 5/5 green.

**1.2 — Counterfactual for the old a4p2 regex pin:** same deletion — the regex pin's
root.ts clause stays green (the deletion was in host.ts); it only reddens through its
host.ts clause, and §1.4 shows a mutant it cannot see at all.

**1.3 — What the pin does NOT claim.** It pins that THE SHIPPED ASSEMBLY consults the
ceiling and that the line is load-bearing for a verdict. It does not make root.ts's
spread unconditional — root-direct assemblies can still omit the port; that is §3's
proposal, not a test's business.

**1.4 — The regex pin's measured blind spot (why construction beats census).**
Mutated `root.ts:2899` from `permissionAuthorityCeiling === undefined ? {} : { authorityCeiling:
permissionAuthorityCeiling }` to `true ? {} : { authorityCeiling: permissionAuthorityCeiling }`
— the pinned TEXT survives verbatim, the port is semantically dead. Result: **PIN-1 × and
PIN-1b ×** (the rise commits — the gate really is gone) while **PIN-4 stays ✓** (and so
would the a4p2 pin: both regexes still match). Raw: `pin-MUTANT-root2899-NEVER-SPREAD-RED.log`.
Restore verified by SHA-256 (`5b38cd7c…c30dd91c`) and blob (`5f159dac…195b437`). Re-run
5/5 green. A spelling pin watches spelling; only a construction pin watches enforcement.

## §2 — Step 2 repair: V16/V17 of `packages/domain/test/a4p1-blueprint-v3-governance.test.ts`

**Measured before-state (a correction, §4 instrument-3):** at base `18c2b7c3` all 20
legs are green AND V15 asserts `v1.ok`/`v2.ok` true — the guards do NOT fire, so on
master the legs ASSERT. The flip lane's "green with ZERO assertions" is what they
become ON THE NARROWED TREE: the guard `if (!v1.ok || …) return` turns each leg into a
vacuous pass exactly at §7.3 landing — i.e. at the moment the golden hashes they carry
matter most. Latent here, observed there. The dispatch's phrasing (already-green vacuity
on master) is corrected accordingly.

**The repair:** the early `return` PAST every assertion became ASSERTED preconditions
(the file's own V18–V20 house idiom), each naming itself
(`V16 precondition: the v1 bridge fixture must parse — <failure>`), the remaining `if`
narrowing-only. When the cutover retires the bridge, these legs must be retired by a
commit that answers the red — the guard retired them by answering nothing.

**Bite proof 1 (precondition assertion bites, A/B against the old shape, SAME mutation):**
mutated `V1_SOURCE` to smuggle `smuggledTopLevel: 1`. Repaired file: **V15+V16+V17 ×**
(`v16v17-MUTANT-broken-fixture-REPAIRED-RED.log`). Old shape (HEAD copy + same mutation):
**V16 ✓ V17 ✓ — green with zero assertions, the lie itself, captured**
(`v16v17-MUTANT-broken-fixture-OLD-GREEN-LIE.log`; only V15 noticed).

**Bite proof 2 (the legs own their subject):** mutated the PROJECTION —
`toHashableBlueprint` spread made `teamHardEnvelope` always-present (`core.teamHardEnvelope
?? { rules: [] }`). **V16 × V17 ×**, V15 ✓
(`v16v17-MUTANT-projection-shape-RED.log`) — the goldens see shape drift that stays
"deterministic", which is their stated purpose. Restore verified: validate.ts SHA-256
`a6d6939e…ab5a176ec` == pre, blob `e27a8c3e…26ccc89` == HEAD; repaired file restored
from `a4p1-REPAIRED.snapshot.ts` verified by `sha256sum -c` (`a4p1-REPAIRED.sha256`);
20/20 green after every round-trip.

## §3 — Step 3 fail-closed proposal, MEASURED (no implementation landed)

**Smallest version (measured, not written into src):** at the gate's own site —
`service.ts:1214`, the `if (lane.authorityCeiling !== undefined)` — add the `else`-branch:
a lane that can durably commit (`lane.overlay !== undefined`) and has no ceiling reader
REFUSES exactly the rising regions (recompute `classifyPermissionRise` exactly as the
port-present branch does — the classification is pure), zero write. Tightenings/reveals-
downwards/renews are not rises and flow untouched; approval diversion untouched; the two
fail-closed root.ts consumers untouched. The measurement patch is described verbatim in
`fc-POST.json`-adjacent raws and was REVERTED (SHA-256 + blob verified: service.ts
`69ef298c…f74ccb7e`, blob `ea1df065…3929e8dc`).

**Call sites the change would touch (all in `governance/service.ts`):** the gate
`:1214`, the `approvalWired` derivation `:649-653` (already requires the port — no
change), `runApprovalAsk` `:997` (no change). Producers that would need fixtures wired:
9 overlay-injecting root-direct sites (§0) and the 7 lane-without-port test files (§0).

**Verdict change over the flip's 39 (identity-by-identity set-diff of PRE and POST
captures, raws `fc-PRE.json`/`fc-POST.json`, table `failclosed-VERDICT-TABLE.txt`):**

| class | count | direction |
| --- | --- | --- |
| of the 39, FLIPPED pass→red | **13** | 12 × "commit/accepted expectation → typed ceiling refusal" (the legs' PASS halves — inside-carrier expansions and ceiling-allow passes — were riding the fail-open); 1 × R8-principal — the refusal reaches the tool router and surfaces as `internal-error`, because a bare `AUTHORITY_CEILING_INSUFFICIENT` throw has NEVER existed on the shipped wire (host worlds always divert it to a proposal) — **the wire mapper for a no-port refusal is new work the proposal must include** |
| of the 39, UNCHANGED | **26** | typed-refusal legs whose drive still refuses at the SAME identity (Alpha.3's coverage law runs first at `service.ts:1163-1201`): 17 a3p3 refusal legs + 2 lifecycle-e2e CONTEXT legs + the 7 a3p4-pr4 host-world legs (ports present) + 2 a3p4-r4-authority-binding legs (pure-judge, no service at all) + carrier-width and no-context legs (ports present) |
| collateral currently-green legs newly refusing (NOT among the 39) | **41** | concentrated in the no-port fixture worlds: lifecycle-e2e 16, mutation-authority 7, revoke-reveal 6, a3p4-pr7 11, a3p4-pr4 root-direct 2 (R5-tool, R4-grant-commit). The blast is file-wide wherever fixtures SET UP by granting — a grant IS a rise — so fail-closed prices at ~54 legs of fixture re-wiring (wire a ceiling reader in, and per the flip's warning re-derive, not just re-green, each re-wired leg) |
| shipped product behaviour newly refusing | **0** | every host-world leg (E1/E2/R4/R5-ws, all a4p7 ceiling suites, all a4p5 suites — 120 green separately) stayed green under the patch: production injects the port, so fail-closed is invisible to it |

**A root-level variant (refuse at CONSTRUCTION in root.ts when overlay is injected and
the port is not)** was NOT measured — it is strictly more expensive: a construction
throw kills every leg of every overlay-injecting fixture FILE at setup, not just the
rise drives, and it cannot cover the service-direct suites at all (they bypass root.ts;
the service-level placement is the one that covers every lane regardless of assembler).
The type-level companion (`authorityCeiling` made required on `GovernancePermissionLaneDeps`,
with DECLARED-NONE readers injected explicitly by the 7 files) is the only shape that
makes absence a COMPILE error; it must ship with the wire mapping above or the tool
surface degrades to `internal-error` (R8's measured fate).

## §4 — Every instrument that lied to me, and how I caught it

1. **The received line refs carried the wrong directories** (`src/permission/…`,
   `src/composition/…` — both readers actually live in `src/plugin/`), and the received
   governance-test path (`packages/runtime/test/` — it is `packages/domain/test/`).
   Caught by sed's no-such-file and `git ls-files` before anything was asserted.
2. **"Nothing in the corpus pins that line" is false.** `a4p2-dual-envelope-mutation`
   :475-479 is a regex pin of the exact wiring spellings. Caught by census grep. (The
   stronger claim — no CONSTRUCTION pin — survived; §1.4 measures why the regex is weak.)
3. **"V16/V17 were green with zero assertions before the flip touched it" is only true
   on the narrowed tree.** At master the guards do not fire (V15 asserts the same
   preconditions and is green). Caught by running the file at base before editing.
4. **PIN-1's first green was false.** With the world's `fs` double missing, the carrier
   reader abstained to `NO_ENVELOPE`, the rise refused for the WRONG law
   (EXPANSION_DENIED), and "did not commit" looked like success. Caught by PIN-1b
   (the verdict must be ceiling-SHAPED, not just non-committing) — a leg that cannot
   say WHICH law spoke will green for any law. PIN-1b's first red named it:
   `code=PERMISSION_ENVELOPE_EXPANSION_DENIED problem=expansion-region-uncovered`.
5. **The E2 world double set hides a fact-reader dependency.** My first host world
   omitted the `fs` public-service double; every canonicalized fact then abstained
   (fail-closed, loudly wrong). Caught by bisecting against E2's `makeHostWorld`
   (`a3p4-pr4-production-entry-regression.test.ts:608-635`) — its comment states the
   dependency ("a permissions-bearing row consults it for the authority-facts
   canonicalization"). Recorded here because it is a DISCLOSURE-grade fact about the
   shipped assembly: the ceiling lane's authority facts silently route through the
   `fs` public service; without it the whole permission plane collapses to
   zero-authority WITHOUT any wiring line changing.
6. **The p4t6/`git ls-files` instruments are blind to untracked files.** A probe or
   instrument file that is not `git add`-ed invisibly escapes the fence, the p4t6
   total and the merge-gate tree counts. Caught while designing the probe lifecycle
   (probe deliberately never staged, then deleted; instrument deliberately staged
   BEFORE the fence/p4t6 runs so the totals move loudly and by derivation).
7. **`git add -A` once staged a scratch coordination file** (`.pnpm-install.log`).
   Caught by reading `git status --porcelain` before the first commit; unstaged and
   moved out of the tree. (Discipline: porcelain is read BEFORE every add/commit, and
   the staged set is enumerated by hand in the commit message plan.)
8. **The lint identity `(parse-fatal)` is a lie of category** — it is what ESLint's JSON
   form labels `ruleId: null` messages, which includes *unused eslint-disable
   directives* (my two dead `-- structural satisfaction` comments, not a parse error at
   all; direct eslint showed "Unused eslint-disable directive"). Caught by running
   eslint on the single file instead of believing the identity label. Fix: removed the
   dead directives; the identity disappeared — `new 0 / resolved 0` against the baseline.
9. **The mutation-exposed wire gap (R8-principal).** My fail-closed patch threw a real
   shipped error code that has never existed on the wire — the router reported
   `internal error in remote handler` (untyped-error invariant 5). An instrument that
   only watched the service layer would have called that "works". Caught by running
   WHOLE files, not the gate in isolation.

## §5 — Restore ledger (hashes are the record; exit codes never were)

| file | pre-mutation SHA-256 | verified post-restore | blob == HEAD |
| --- | --- | --- | --- |
| `src/plugin/host.ts` | `a9c12a9e…6c46e2a` | equal | `2987013a…4d7c346` |
| `src/plugin/root.ts` | `5b38cd7c…c30dd91c` | equal | `5f159dac…195b437` |
| `governance/service.ts` | `69ef298c…f74ccb7e` | equal | `ea1df065…3929e8dc` |
| `blueprint/src/validate.ts` | `a6d6939e…ab5a176ec` | equal | `e27a8c3e…26ccc89` |
| `domain/test/a4p1-…governance.test.ts` | repaired-state sha in `a4p1-REPAIRED.sha256` | `sha256sum -c` OK | n/a (lane write) |

## §6 — Battery ledger

(Filled by the committed-tree runs; every number below is copied from a saved raw in
this directory, and the raws are the record — see `git log` for this lane.)

## §7 — Requests (things this lane wants but does not own)

1. **Wire mapping for a no-port ceiling refusal** (governance): §3's R8 finding — the
   tool/router surface has never seen a bare ceiling throw; any fail-closed ruling must
   extend the closed wire table or reuse the proposal diversion deliberately.
2. **`fs`-service disclosure for §7.3's FINDINGS** (§4.5): the authority-facts chain
   depends on the `fs` public service; absence is a silent zero-authority world. One
   leg at that seam, in that lane's idiom, would close the disclosure.
3. **Re-baselining status, stated:** `lint-identities` vs
   `dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` reports
   **new 0 / resolved 0** on the final tree — no re-baseline is requested by this lane;
   the one `new 1` seen mid-lane was §4.8 and was fixed, not re-baselined. Re-baselining
   remains the user's act regardless.
4. **PIN-3 is a loaded tripwire:** when a fail-closed ruling lands,
   `a4p7-ceiling-port-assembly-pin` PIN-3 turns RED (root-direct fail-open dies). That
   red is this lane's designed gift to the ruling PR — retire PIN-3 in the commit that
   makes it red, and let §3's 13+41 set be the re-wiring checklist for that PR.
