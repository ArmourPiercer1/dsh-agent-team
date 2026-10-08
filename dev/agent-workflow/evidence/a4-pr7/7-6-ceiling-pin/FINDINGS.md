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
| of the 39, UNCHANGED | **26** | typed-refusal legs whose drive still refuses at the SAME identity (Alpha.3's coverage law runs first at `service.ts:1163-1201`): 11 revoke-reveal + 2 mutation-authority refusal legs + 2 lifecycle-e2e CONTEXT legs + the 7 a3p4-pr4 host-world legs (ports present) + 2 a3p4-r4-authority-binding legs (pure-judge, no service at all) + carrier-width and no-context legs (ports present) (per-file: 13 = 6+6+1 flips; 26 = 39−13, cross-checked against the raws) |
| collateral currently-green legs newly refusing (NOT among the 39) | **41** | concentrated in the no-port fixture worlds (per-file reds minus that file's flips): lifecycle-e2e 16, mutation-authority 7, revoke-reveal 6, a3p4-pr7 10, a3p4-pr4 root-direct 2 (R5-tool, R4-grant-commit). The blast is file-wide wherever fixtures SET UP by granting — a grant IS a rise — so fail-closed prices at 54 legs (13 + 41) of fixture re-wiring (wire a ceiling reader in, and per the flip's warning re-derive, not just re-green, each re-wired leg) |
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
 10. **Git's auto-merge is an instrument too, and it lied silently.** a4p1 merged
     with NO conflict markers yet produced a self-contradicting file (flip-V15
     asserts `v1.ok === false`; the a4-76 V16 asserts `v1.ok === true`). A clean
     auto-merge is not a semantically-clean merge. Caught by running the file the
     moment after the merge (V16/V17 RED) — §8.1. After a merge, RUN the affected
     files; do not trust "no conflicts".
 11. **A stale sed pattern is a silent lie.** The first golden-tamper capture passed
     20/20 looking exactly like the vacuous result it was meant to prove — the
     pattern did not match the actual constant form and nothing was tampered.
     Caught by grepping the constant back before believing the run; the second
     attempt (matching the `sha256:` prefix) is the one in the raw.
 12. **A merge ages a tie's prose without breaking its arithmetic.** Both p4t6 tie
     lines read `toBe(1032 - 1031)` after auto-merge — each trivially true (1==1),
     each claiming a DIFFERENT predecessor total. The test file cannot see its own
     staleness; only the mandated re-derivation caught it. See §8.2.

## §5 — Restore ledger (hashes are the record; exit codes never were)

| file | pre-mutation SHA-256 | verified post-restore | blob == HEAD |
| --- | --- | --- | --- |
| `src/plugin/host.ts` | `a9c12a9e…6c46e2a` | equal | `2987013a…4d7c346` |
| `src/plugin/root.ts` | `5b38cd7c…c30dd91c` | equal | `5f159dac…195b437` |
| `governance/service.ts` | `69ef298c…f74ccb7e` | equal | `ea1df065…3929e8dc` |
| `blueprint/src/validate.ts` | `a6d6939e…ab5a176ec` | equal | `e27a8c3e…26ccc89` |
| `domain/test/a4p1-…governance.test.ts` | repaired-state sha in `a4p1-REPAIRED.sha256` | `sha256sum -c` OK | n/a (lane write) |

## §6 — Battery ledger (PRE-FLIP tree — numbers in this table describe the pre-#172 tree; the merged-tree ledger is §8.5)

Every number below is copied from a saved raw IN THIS DIRECTORY (the raws are the
record; every suite was re-run on the COMMITTED tree — commit `b27efe12`, base
`18c2b7c3`). The base controls (base full-suite identities, base merge-gate capture)
were taken in the SAME worktree via `git switch --detach 18c2b7c3` + re-attach, so
node_modules, toolchain and scratch world are byte-identical between the compared runs.

| instrument | result | raw |
| --- | --- | --- |
| fence `verify-blueprint-version-clean.mjs`, twice, after `git add` (and again on the committed tree) | byte-identical runs; tuple UNMOVED from base: `dirty(5 files, 16 sites) unknown(0,0) advisory(8,10) refused(52,115) prose(5,5) adjudicated(16,24)`, exit 1 at base and here (the dirty verdict is base debt, disclosed) | `fence-COMMITTED-run1.log`, `fence-COMMITTED-run2.log` (+ `cmp` outputs byte-equal) |
| `a4p7-blueprint-version-clean.test.ts` | **60 passed** | `suites-COMMITTED-fast.log` |
| `p4t6-session-event-scan.test.ts` | **10 passed**; total now 1032 = 983 + Σ SCANNED_PATHS_* (this lane's entry `SCANNED_PATHS_A4P76PIN` = 1 file, tied `1032 - 1031` — both endpoints measured, RED kept, never hand-written) | `p4t6-RED-scan-increment.log` (the `expected 1032 to be 1031` pre-extend RED), `suites-COMMITTED-fast.log` |
| a4p1 governance, before | 20/20 green at base (guards latent, NOT vacuous here — §2) | `mine-full-identities.txt` filter / base capture |
| a4p1 governance, after repair | 20/20 green; **leg identity set BYTE-IDENTICAL to base** (no leg renamed, retired or added) | `suites-COMMITTED-fast.log` + the diff of both identity files |
| ceiling-pin instrument | **5/5 green**; both mutants' REDs kept (§1.1, §1.4) | `pin-BASE-GREEN.log`, `pin-MUTANT-*.log` |
| §7.6 merge-gate | **26 legs, exactly 1 red: the no-build refusal**; its diagnostic is BYTE-IDENTICAL to the same leg's base capture except the self-described tree-state clause (`base-merge-gate.log` vs `merge-gate-COMMITTED.log`) | `merge-gate-COMMITTED.log`, `base-merge-gate.log` |
| composition-smoke classifier | **54 passed** | `suites-COMMITTED-fast.log` |
| permission/ceiling battery (a4p2 dual-envelope, 3× a4p7 ceiling suites, 3× a4p5, a3p3×3, a3p4 plane + lifecycle-e2e, a3p5×2, a4pr0-generation, bound-blueprint, a4f1 — 17 files) | **283 passed** | `permission-ceiling-COMMITTED.log` |
| `pnpm -r run typecheck` | exit 0, `0 × error TS` | `typecheck-COMMITTED-parallel.log` |
| `pnpm -r --no-bail run typecheck` | exit 0, `0 × error TS` (run SEPARATELY, per dispatch) | `typecheck-COMMITTED-nobail.log` |
| `lint-identities.mjs --diff …0237d487.txt` | **new 0 / resolved 0**, exit 0 (160 lines / 76 distinct == baseline's 76) | `lint-identities-COMMITTED.txt` |
| full root suite (498 base files vs 499 mine), registered legs | **6252 → 6257 (+5, exactly this lane's instrument file)** | `base-full-identities.txt`, `mine-full-identities.txt` |
| full-suite RED SET vs base | base 21 reds; mine 22: red-set diff = **NEW 1 / RESOLVED 0**, the 1 = `p6t1-parallel` quota-race leg — declared-load-flake family (merge-gate lane's `7-6-merge-gate/p6t1-parallel-load-flake.txt` records the same suite flickering 3 identities between identical full-suite runs at identical HEAD); attribution control: the file ALONE on this tree is 9/9 green, and the failure message is an activation-order signature (`ACTIVATION_COMPATIBILITY_BLOCKED_FATAL` where a QUOTA code was expected), which nothing this lane wrote can touch. Every base-debt identity (t1×9, t2, p6t3-restart×2, p6t3-mediation×5, p6t6-actions, p6t1×1, d3-member-identity-context, merge-gate no-build) reproduced verbatim | `mine-full-reds.txt`, `base-full-reds.txt`, `mine-full-suite.log` |

Numbers-in-prose audit: §0–§3 were re-checked against these raws at authoring time;
where a §3 per-file count and a raw disagreed, the raw won and the prose moved (this
happened twice, both corrections are the current text).

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

---

## §8 — Post-merge re-verification against the flipped master (`8ab22407`, #172 landed §7.3)

The coordinator's ruling: re-verify on merged master; merge, never rebase a cited
head. `origin/master 8ab22407` merged in as `b098be1c`. The headline: the flip
touched NONE of `host.ts / root.ts / permission-plane.ts / governance/service.ts /
validate.ts` (empty `git diff`), so this lane's core-file anchors survive byte-
identical; what the flip DID do is (i) retire v1/v2 at the parser, closing §0's
fail-open way (i) (the reader's version-abstention branch is now unreachable),
(ii) invert V1/V5/V13/V14/V15 of this lane's a4p1 file, and (iii) extend p4t6.

### 8.1 a4p1 — resolved by measurement, resolved to RETIREMENT

Git auto-merged the file with no markers — producing a self-contradicting file
(flip-V15 asserts `v1.ok === false`; this lane's repaired V16 asserts
`v1.ok === true`). The flip's in-file NOTE recorded the coordinator ruling:
"the vacuous-guard finding goes to the pin lane … deliberately not repaired
here." This lane is that pin lane, and both surviving shapes were MEASURED
before choosing:

- with the repair in place, post-flip the pair goes RED naming itself —
  "V16 precondition: the v1 bridge fixture must parse — unsupported blueprint
  schema version 1; this build supports [3]" (`a4p1-POSTFLIP-REPAIR-RED.log`,
  `a4p1-POSTFLIP-RED-MESSAGES.txt`);
- with the flip's guard-return shape, the file passes **20/20 with
  V1_GOLDEN_HASH tampered to all-f** — green over a corrupted golden, zero
  assertions (`a4p1-COUNTERFACTUAL-GOLDEN-TAMPERED.log`; the first attempt of
  that capture passed the same 20/20 with an UNtampered sed — no-match sed is
  itself an instrument-that-lied, caught by grepping the constant back).

Neither shape is a leg that can survive the flip: the pair's subjects (v1/v2
golden byte-identity, key-omission over v1/v2 projections) have no reachable
input — a retired stamp yields no blueprint to hash. So the repair is DROPPED,
the redundancy DEMONSTRATED as above, and the legs are RETIRED in the merge
commit — the commit that had to answer the red, which was the repair's entire
point. The goldens stand as record in the file's comment block; the bridge-state
truth is owned by V1/V13/V14/V15; the hash-binding truth by V18–V20. File now
**18 legs**, no surviving leg renamed or renumbered (identity sets diff-clean).

### 8.2 p4t6 — total re-derived from scratch with BOTH lane sets

The merged sums carry `SCANNED_PATHS_A4P73FLIP` + `SCANNED_PATHS_A4P73GRAMMAR` +
`SCANNED_PATHS_A4P76PIN` (resolution kept both intents; the two hunks were the
same list-add on different lanes' sides). The total was NOT assumed: with the
pin file tracked on disk and this lane's entry stripped, the merged run reads
`expected 1033 to be 1032` (`p4t6-PRE-EXTEND-RED-MERGED.txt`) — 1032 is the
derived merged-master total the FLIP's tie ends on (its own capture says
1031 → 1032 on ITS base, kept unrewritten, same house rule the 7.6-GATE tie
documents), and 1033 is what the scanner counts with this lane's file. This
lane's tie now asserts `1033 - 1032`.

**New entry for §4's list (instrument-that-lied #10, merge-grade):** after the
auto-merge, BOTH tie lines read `toBe(1032 - 1031)` — each trivially true as
arithmetic (1 == 1), each green, and each claiming a DIFFERENT predecessor
total. A tie's numbers are the leg's PROSE; merges age prose without breaking
its arithmetic. Only the mandated re-derivation exposed it; the test file could
not. Nothing hand-edited: the endpoints come from the capture, never from the
neighbouring line.

### 8.3 instrument, leg by leg, post-flip

`pins-5leg-POSTFLIP-pristine.log` (before adding PIN-5) and
`pin-5-POSTFLIP-GREEN.log` (six legs):

- PIN-1 / PIN-1b — GREEN: the expected shape HOLDS post-flip, re-measured not
  inherited: the zero-ceiling rise becomes the durable
  `mutation-proposal-pending` / `requiredAuthority:'leader'` / `approvalCaseId`
  proposal, no snapshot. This matches the coordinator's round-29 prediction for
  a rising grant against a declared-empty ceiling.
- PIN-2 — GREEN: the covering hard document still commits the same drive.
- PIN-3 — **GREEN: the fail-open lever SURVIVED the flip.** The root-direct,
  port-less lane still commits the zero-ceiling rise. The flip closed the OTHER
  way (v1/v2 abstention — unreachable behind a parser that refuses v1/v2); the
  port-absent way runs on v3 documents and `root.ts:2899`'s conditional spread
  is byte-untouched (#172's diff does not contain root.ts). The calculus for
  the fail-closed lane is therefore UNCHANGED by the flip, and PIN-3 stands
  ready as that lane's hand-off seam.
- PIN-4 — GREEN: exactly one production producer, `host.ts:2703`, unchanged.
- PIN-5 — NEW (coordinator's fifth task, added here): world D = world B minus
  exactly the `fs` public-service double, COVERING ceiling intact (the world
  where the drive COMMITS). Measured (`pin5-worldD-measurement.log`): the drive
  does NOT commit — `{changed:false, code:'PERMISSION_ENVELOPE_EXPANSION_DENIED',
  problem expansion-region-uncovered}`. The two silences ARE distinguishable
  today: absent-fs speaks through the CARRIER law as a typed throw; the
  ceiling's zero is the durable-proposal shape. The leg pins the separation and
  names the drift that would erase it (the separation holds only because the
  coverage law consults the same abstaining envelope reader and runs BEFORE the
  ceiling gate — if envelope reading detaches from `fs` canonicalization, an
  fs-less world could drift toward committing with nobody consulted). Nothing
  was fixed; the hazard is recorded, as instructed.

### 8.4 what survives of §0 and §3 on the flipped tree

§0 census RE-COUNTED post-flip and holds: Family A = 17 call sites (1
production `host.ts:2675→2703`, 16 test), zero test-side port injections (the
three `permissionAuthorityCeiling:` grep hits in tests are the two spelling
regexes — a4p2's and this file's — plus one census string, zero object
literals), Family D = one production producer.

§3's verdict-change table (13 flipped / 26 unchanged / 41 collateral / 0
shipped) is **explicitly a PRE-FLIP measurement** and must not be consumed as
post-flip: §7.3 re-decided the 39 by inverting the carrier law's inputs, so the
populations moved. The STRUCTURE survives — a no-port refusal would still touch
zero shipped host worlds (production still injects the port; that is exactly
what PIN-1/PIN-4 pin) — but the fail-closed lane must re-run the PRE/POST
method (throwaway service.ts patch + identity diff, §3) against the flipped
fixture corpus before spending any count from this table. The wire-mapping
finding (a bare `AUTHORITY_CEILING_INSUFFICIENT` throw has never existed on the
tool router → `internal-error`) is unaffected by the flip: it lives in
`s6-remote.ts`'s untyped-error invariant, which #172 did not touch.

### 8.5 merged-tree battery ledger (commit `b098be1c`; base controls from the SAME worktree detached at `8ab22407`)

| instrument | result | raw |
| --- | --- | --- |
| fence ×2, committed merged tree | byte-identical; tuple = post-flip base tuple verbatim: `dirty(6,15) unknown(0,0) advisory(6,8) refused(52,115) prose(5,5) adjudicated(16,24)`, exit 1 (six dirty files = the coordinator's list; base tuple captured detached: identical) | `fence-MERGED-run1.log`, `fence-MERGED-run2.log`, `fence-BASE-8ab22407.log` |
| fast suites | p4t6 **10**, a4p1 **18**, version-clean **60**, instrument **6**, classifier **54** — 148/148 | `suites-MERGED-fast.log` |
| §7.6 merge-gate | 26 legs, exactly the 1 disclosed no-build refusal; diagnostic **byte-identical** to the post-flip base capture minus the tree-state clause | `merge-gate-MERGED.log`, `merge-gate-BASE-8ab22407.log` |
| permission/ceiling battery (18 files incl. the flip's shipped-composition spec) | **286 passed** | `permission-ceiling-MERGED.log` |
| typecheck `-r` / `-r --no-bail` (separate runs) | both exit 0, `0 × error TS` | `typecheck-MERGED-parallel.log`, `typecheck-MERGED-nobail.log` |
| lint-identities vs baseline (re-recorded by the records lane in the flip round, aaf5decd) | **new 0 / resolved 0**, exit 0; universe 1109 files | `lint-identities-MERGED.txt` |
| population `packages/{runtime,domain,legacy,storage,contracts}/test` | base (detached) **5043** registered legs — exactly the stated post-flip figure — 19 titled reds (18 + the declared p6t1 flake) + 3 collection files (`p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports`); merged tree **5047** = 5043 + 6 (instrument legs) − 2 (retirements), derived-and-measured, files 416→417; red-set diff **NEW 0**, RESOLVED only the declared `p6t1` flake (green this run); collection set UNCHANGED | `base2-pop-identities-reds.txt`, `base2-pop-collectionfails.txt`, `mine2-pop-reds.txt`, `mine2-pop-collectionfails.txt` |
