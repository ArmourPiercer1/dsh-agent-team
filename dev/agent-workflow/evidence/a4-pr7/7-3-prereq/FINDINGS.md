# A4-PR7 §7.3 prerequisites — findings (lane `a4-73-prereq`)

Branch `feat/a4-73-prerequisites`, worktree `.worktrees/a4-73pre`.
Base: `9dbb819374…` → fast-forwarded to `fba82095` → **rebased onto `e8dcfd7d`** (the a4-surface
lane merged underneath this work; see *Deviations* D5).
Commits: `f42e537b` (P1 + P2, amended once to co-commit its dist) and the P3 commit that follows it.

**Not done, by instruction:** `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` is byte-identical
(`packages/domain/blueprint/src/schema.ts:75` = `[1, 2, 3]`), `RETIRED_BLUEPRINT_DOCUMENT_VERSIONS`
untouched, and `leaderEnvelopeCoverage` is **not** deleted. `git diff e8dcfd7d --stat` over
`packages/domain/blueprint/src/schema.ts`, `packages/runtime/src/plugin/host.ts` and
`packages/runtime/src/plugin/blueprint-authority.ts` is **empty**.

Transcripts: `transcripts/NN-*.txt` in this directory.

---

## P1 — the ceiling is asked at the width the mutation claims (plan §7.5 (1))

**Cited site, corrected.** The brief cites `packages/runtime/control/service.ts:1294`. The ceiling
lookup is in **`packages/runtime/governance/service.ts`**, and `:1294` is the right line number in
that file (`createPermissionAuthorityCeilingJudge`, whose body is now `judgeCeilingPoint`).
`control/service.ts` contains no ceiling lookup. Reported as deviation D1.

**What was wrong.** The judge built `scope = {operationClass, matcher: region.region}` — the
rising CELL — and never asked the matcher the mutation actually claims (`region.mutationMatcher`).
A `subtree S` grant backed by documents that cover only one file inside `S` therefore reached the
append with the ceiling having been asked about a cell it did cover.

**It is a point set, not a swap.** Replacing `region.region` with `region.mutationMatcher` is one
line and LOOSENS the law: a wider question is answered by fewer rules, so
`subtree S -> allow` + `exact F -> ask` answers `allow` at the width and `ask` at the cell, and a
pure swap would let the cell's cap be escaped by claiming the subtree. The landed factory asks
**every distinct claimed point — the cell first, then the width** — returns the first refusal, and
dedupes so the common case (cell = width, the overwhelming majority of mutations) asks exactly one
question with byte-identical arithmetic. The meet over a candidate set is never wider than either
individual evaluation. This is the same shape §7.2 Ruling 4 uses, and the reasoning is in the
function's header comment (`IT IS A SET, NOT A SWAP`).

**Plan §7.5 offered an alternative** ("or write an explicit whole-matcher width clause"). The point
set was chosen because a width-only clause is the loosening above, and because a refusal detail must
be able to name the point that refused: the refusal carries `details.region` of the point that
answerred insufficient (measured: `exact:file:/srv/a4p7-width/out.txt` in one leg, the width point's
authority in another).

**Red, before the change** (`transcripts/02-p1-red.txt`), from the leg that constructs a region whose
two matchers differ:

```
AssertionError: expected { status: 'sufficient' } to deeply equal
  { status: 'insufficient', plane: 'expansion', ceiling: 'no-authority', … }
```

plus the entry-level leg, which did not refuse at all: the mutation **committed**.

**Green:** `transcripts/03-p1-green.txt` — 5/5 in
`packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts`.

**Mutants** (temporary `globalThis` property read, never `if (false)`, never `process.env` — which
is not typed in `packages/runtime`; hook removed and `grep`-verified absent):

| mutant | legs red | identity of the failure |
| --- | --- | --- |
| `cell-only` (= the pre-fix lookup) | 3, 4 | `expected { status: 'sufficient' } to deeply equal { status: 'insufficient', … }` |
| `width-only` (= the naive swap) | 5 (the never-loosen leg) | `expected { status: 'sufficient' } to deeply equal { … ceiling: 'ask' }` |
| `leaderEnvelopeCoverage` neutered (= the §7.3 deletion) | 1 | `expected 'PERMISSION_AUTHORITY_CEILING_INSUFFIC…' to be 'PERMISSION_ENVELOPE_EXPANSION_DENIED'` |

The third row is a **decision handed to the coordinator, not a defect here**: after P1 the §7.3
deletion no longer COMMITTED the wider mutation — it refuses with the ceiling's own code, so what
§7.3 deletes is a refusal identity, not a hole. `dev/agent-workflow/evidence/a4-pr7/…` plan lines
`:846-848`/`:853-854` own that retitle; the leg keeps its current identity and its comment says
which way to flip it.

`packages/runtime/governance/permission-mutation.ts` carries one **comment-only** edit: the
`PermissionRiseRegion` doc still claimed "the envelope judges the WIDTH … the ceiling judges the
CELL". That sentence is now false, and the surviving law (the envelope still asks width; the ceiling
asks every claimed point, and why width-only is worse) replaces it. No executable line changed there.

---

## P2 — the parked width pin lands (plan §7.5 (2))

**Where it actually was:** `dev/agent-workflow/evidence/a4-ceiling-coverage/a4p7-carrier-width-under-
ceiling.test.ts.inert`, not `packages/runtime/test/` (deviation D2). It named this `p4t6` entry as
the reason it could not land in its own commit.

**Why it was inerted, and the verdict.** Its inertion note said it was parked because the lane it
guarded had not landed and it had no `p4t6` path entry. **Measured at base, before anything was
touched, it was 3/3 GREEN** (`transcripts/01-parked-at-base.txt`) — so it did **not** assert something
the product had stopped doing. That is the answer the brief asked for: no finding of the
"the product moved on" kind.

One of its three legs, however, asserted **the gap itself**:

```
it('THE GAP: the ceiling gate ALONE is sufficient on that very rise', …
  expect(judge(context, region)).toEqual({ status: 'sufficient' })
  expect(() => authorizeCeilingBoundedPermissionRise(…)).not.toThrow()
```

P1 makes that a contradiction. The leg's own note said *"flip this leg when the surviving ceiling law
owns width"* — that moment is this commit, so the leg is **retitled and inverted, with its original
assertions quoted verbatim where they stood** (the §7.3 treatment for a GROUP E pin), not deleted and
not silently edited. It now asserts `{status:'insufficient', plane:'expansion',
ceiling:'no-authority', detail:{requiredAuthority:'leader'}}` and the entry-level refusal carrying
`details.region === 'exact:…'`.

**PLAN-TEXT FINDING for the coordinator:** plan §7.5 prerequisite (2) describes this pin as "the width
pin **and the gap itself asserted**". After the inversion nothing asserts a gap — it asserts the
refusal. §7.5 (2) should be restated (`docs/plans/active/…` is worker-forbidden to edit, so this is
reported, not fixed).

### The `p4t6` arithmetic, and what the rebase did to it

* Lane list added: `SCANNED_PATHS_A4P7PRE` in
  `packages/testkit/test/p4t6-session-event-scan.test.ts`, entries added **by path**, `.length`
  appended to both `983 + …` derived sums, `…SCANNED_PATHS_A4P7PRE` added to the by-path presence
  loop, and one tie `expect(SCANNED_PATHS_A4P7PRE.length).toBe(N - M)` with **this lane's own**
  endpoints. No other lane's list, sum term or endpoint was touched. `983` was never edited.
* P2's own bite (`transcripts/06-…`): emptying **this lane's** list gives
  `AssertionError: expected 1024 to be 1023` at `p4t6-session-event-scan.test.ts:1947`.
* The base moved under the branch (D5). On `e8dcfd7d` the a4-surface lane had already moved the
  derived total **1023 → 1024**; P2's landing therefore moves **1024 → 1025**, and P3's second file
  moves it to **1026**. Both numbers are measured through the derived sums, never written by hand,
  and the a4-surface lane's `toBe(1024 - 1023)` is untouched.
* **The rebase conflict was not cosmetic and the pin caught a real defect.** The first resolution
  placed both lane terms in the derived sum separated by a **comma** — the comma operator — so the
  assertion compared against `983 + … + A4SURFACE.length` and silently dropped this lane:
  `AssertionError: expected 1026 to be 1024` (`transcripts/14-p4t6-after-rebase-1026.txt`). Fixed to
  `+ … + length,`; `transcripts/16-…` and `18-…` are the clean runs. This is the scenario the derived
  sum exists for, and it is why the totals here are re-measured rather than asserted from memory.
* Final state: **10 passed**, derived total **1026**, this lane naming 2 paths.

---

## P3 — the ceiling's no-context branch is a refusal (plan §7.5 (3))

### The defect, measured

`createAuthorityCeilingReader` (`packages/runtime/src/plugin/permission-plane.ts`) answered either a
context or `undefined`, and `governance/service.ts:1158` reads `undefined` as "no v3 ceiling for this
target" and falls through to the append. But the seam declares `blueprintSchemaVersion` as
"`undefined` when the binding is UNKNOWN (no resolvable bound Blueprint)"
(`permission-plane.ts:447-455`) — a resolvable v1/v2 document answers `1` or `2` and never reaches
that branch. So the value that skipped the gate was never "this Team predates the ceiling": it was
"nobody can read this Team's binding".

Measured at the real entry with the production reader wired exactly as `host.ts` wires it
(`transcripts/13-p3-red-at-base.txt`):

* an **operator** mutation that rises, on a Team whose binding cannot be resolved → **COMMITTED**;
* a **Leader** mutation the carrier covers → also **COMMITTED**.

The second is the finding that reframes the FINDINGS note this lane was gated on: `FINDINGS.md`
cases (f)/(h) describe the abstention as caught for a Leader by `leaderEnvelopeCoverage` and open
only for the operator. It is open for a Leader whenever the carrier covers the claimed cell —
`leaderEnvelopeCoverage` speaks only where the carrier FAILS to cover, which is exactly the case §7.3's
deletion removes. So the fail-open was never Leader-safe, and the deletion would have widened it to
every case.

### What landed

The reader now has **three** answers, and the middle one refuses:

1. `schemaVersion` is 1 or 2 (a DECIDED pre-v3 document) → `undefined`, the existential branch,
   Alpha.3 behaviour byte-identical. This is the only answer allowed to skip the gate, it is a fact
   about the document, and it dies with the cutover.
2. `schemaVersion` is anything else that is not 3 (i.e. `undefined` — unknown binding — or an
   unknown future version), **or** it is 3 but the content hash no longer resolves → a context whose
   document slots are BOTH `{status: 'unavailable'}` and which carries **no anchor**.
3. `schemaVersion === 3` with a resolvable hash → the real context, unchanged.

`unavailable` is the repository's existing vocabulary for "the read FAULTED: refuse, never widen"
(`governance/authority-ceiling.ts:173-175`), and nothing new was added to the refusal law: the
existing `AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE` → `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` mapping
carries it, still AFTER the Alpha.3 Leader block, still not eligible for the A4-PR5
proposal-minting catch (which fires only on `AUTHORITY_CEILING_INSUFFICIENT`), so an unreadable
ceiling mints no durable proposal (ADR A1-7). Zero new codes, zero new refusal sites, and the other
three consumers of the port (`buildApprovalAsk`, `requiredAuthorityFacts`,
`createOperationApprovalFactsReader`) see an unavailable document set and answer "no ask / no facts"
exactly as they did before. **Why a context rather than a new typed signal** is recorded in the new
spec's header: a typed signal would have had to be mapped at all four consumers to be worth
anything, and the operation lane's pinned law ("an unknown binding is the legacy arm, and PR7 owns
that arm") is preserved unchanged precisely because that consumer's answer did not move.

Refusal is RISE-scoped: a batch with no rising region (a tightening) still commits under the same
unreadable binding — leg 4 pins that, so the law does not punish the mutations that remove authority.

### Red → green → mutants

`packages/runtime/test/a4p7-ceiling-no-context-refusal.test.ts` (9 legs, real entry: production
reader inside `createGovernanceMutationService` over the durable overlay port; every leg asserts the
durable snapshot too, so a refusal that wrote would fail).

* **Red at base:** 5 legs — `a rise under an unreadable ceiling must not commit: expected undefined
  to be defined`, `expected undefined to be 'PERMISSION_EFFECT_CONTEXT_UNAVAILABLE'`,
  `an anchorless v3 read must not commit a rise: expected undefined to be defined`,
  `an unreadable binding is not a pre-v3 Team: expected undefined to be defined`,
  `a Leader rise under an unreadable ceiling must not commit: expected undefined to be defined`.
* **Green:** 9/9, `transcripts/16-p3-green-and-p4t6-1026.txt`.
* **Mutants** (`transcripts/17-mutant-p3-*.txt`), three different failures for three different
  mistakes — which is the point of having all three:
  | mutant | legs red | identity |
  | --- | --- | --- |
  | `collapse` (unknown arm back to `undefined`) | 1, 2, 7, 8 | `expected undefined to be defined` (the commit) |
  | `blanket` (v1/v2 also refused) | 5, 7 | `expected { Object (beneficiaryAuthority, …) } to be undefined` — the existential leg is what breaks |
  | `absent` (fold `unavailable` into `absent`) | 2, 3, 7 | `expected 'PERMISSION_AUTHORITY_CEILING_INSUFFIC…' to be 'PERMISSION_EFFECT_CONTEXT_UNAVAILABLE'` |
  The `absent` row is the one that justifies the design choice by execution: `absent` still refuses,
  but with an AUTHORIZATION label on a read that faulted — the inversion A3-3 closed.

### Pins inverted elsewhere (two, both pre-existing, both quoted in place)

`grep` over the whole runtime+testkit scope found exactly two assertions of the old branch law
(`transcripts/12-p3-measure-blast.txt` measured the blast radius before any pin was retitled):

* `a4p2-dual-envelope-mutation.test.ts` — `an UNKNOWN binding takes the v1/v2 branch rather than
  inventing a v3 ceiling` → retitled to the new law; the old
  `expect(…).toBeUndefined()` is quoted in the leg. The file's `describe` title
  ("the v3 switch, BOTH branches") became "its THREE answers". **The A5-12 existential leg
  (`a v1 or v2 blueprint gets NO ceiling context at all`) was not touched** and is the leg that goes
  red if the two answers are merged again.
* `a4p5-permission-mutation-proposal.test.ts` — `a v3 binding resolving WITHOUT a content hash
  answers NO context` → retitled; the law it guards (production can never mint an anchorless
  fingerprint) is served better, because a refusal mints nothing at all.

The operation lane's rule-1 pin (`a4p4-operation-approval-authority.test.ts`) stayed green untouched:
its A14-A16 legs drive the adapter with a fake port, so they never exercised the production reader's
abstention. That is disclosed here rather than papered over — the adapter's answer for an unknown
binding is unchanged, but there is no leg that would have caught it if it had changed.

### Incidental measurement

`parsePermissionStaticLayerFacts` is called **inside** the ceiling gate
(`governance/service.ts:1163`), so entering the gate — which the abstention context now always does
for a rise — surfaces a malformed static layer as `PERMISSION_ENVELOPE_MALFORMED`
(`static-layer-fallback-closed-set`: a static layer's fallback may only be `ask | deny`) where the
skip path never parsed it. Both refuse with zero write; the identity differs when both defects are
present. Discovered by my own invalid fixture (an early draft of leg 4 used `default: 'allow'`),
recorded here because it is a real ordering fact about the gate, not a fixture note.

---

## Suite state and gates

| gate | result | transcript |
| --- | --- | --- |
| base suites | 9 files / 183 tests pass | `00-base-suites.txt` |
| base failures confirmed | `d3-member-identity-context` ×1, `p6t3-mediation` ×5, `p6t3-restart` ×2; collection errors in `p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports` | `05-base-failures-confirmed.txt` |
| runtime + testkit after P1+P2 | same failure set | `11-runtime-testkit-after-p1p2.txt` |
| runtime + testkit after P3 | **8 failed / 4224 passed (4232), 6 files failed / 365 passed (371)** — the identical base set (d3 ×1, p6t3-mediation ×5, p6t3-restart ×2) plus the same 3 collection-error files; `p6t1-parallel` passed this run and failed ×3 in the pre-P3 run (declared flake band ±1–3, reported not silenced) | `18-runtime-testkit-after-p3.txt` |
| `pnpm -r run typecheck` | exit 0, 8 × `typecheck: Done`, 0 × `error TS` | `19-typecheck-after-p3.txt` |
| `p4t6` | 10 passed, derived total **1026** | `16-p3-green-and-p4t6-1026.txt` |
| root `pnpm test` (`rm -rf packages/testkit/test/.tmp-fault/` first) | **19 failed / 6105 passed (6124), 9 files failed / 484 passed (493)**. Composition: the runtime/testkit set above (8 tests) PLUS `packages/domain/test/t1-capability-schema.test.ts` ×9, `packages/domain/test/t2-blueprint-hash.test.ts` ×1, `packages/tools/test/p6t6-actions.test.ts` ×1, and the same 3 collection-error files. Those 11 were then run **at base `e8dcfd7d`** with this branch's changes stashed: **11 failed / 38 passed, 3 files failed — identical**. **Zero new failures at the whole-repo level.** | `31-root-pnpm-test.txt`, `32-root-extra-failures-at-base.txt` |
| `pnpm build` / `build:composition` / `check:artifacts` | build 0; composition writes; `check-artifacts-committed` **OK: 1508 files** at the P1+P2 commit | `20-24`, `23-build-at-commitA.txt` |
| neighbour gates (`a4p3-approval-case`, `a4p3-approval-escalation`, `a4-escalate-act-truth`, `a4p7-v3-cutover-acceptance`, `a4p7-v8-catalog-migration-state`, `bp1-blueprint-registry`) **+ the two retitled pins (`a4p2`, `a4p5`) + `a4p4` (the operation lane whose rule-1 law I deliberately did not move)** | **9 files passed / 270 tests passed**, exit 0 | `27-neighbour-gates.txt` |
| committed tree, final confirmation | `check-artifacts-committed` **OK: 1508 files** (exit 0) and the lane's five spec files (both new specs, both retitled pins, `p4t6`) **83 passed / 5 files**; `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` re-quoted byte-identical at `schema.ts:75` and `git diff e8dcfd7d HEAD -- …/schema.ts` empty | `33-final-confirmation-committed-tree.txt` |
| identity lint (`node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt`) | exit 0: 160 identity lines, 76 distinct; baseline 76 distinct — **new 0, resolved 0** | `28-lint-identities-diff.txt` |
| `npx eslint` on every file this branch touches | exit 1, **one** error: `governance/service.ts 117:8 'PermissionStaticLayerFacts' is defined but never used`. Proven **pre-existing on master** — eslint on master's own copy of the file gives the identical error, and this branch's diff contains 0 lines mentioning that type. Not fixed here (an unrequested edit to a line I did not change); recorded for a hygiene commit. | `29-eslint-changed-files.txt`, `30-eslint-preexisting-proof.txt` |

| runtime + testkit after the review round | **8 failed / 4281 passed (4289), 6 files failed / 366 passed (372)** — the identical base set (d3 ×1, p6t3-mediation ×5, p6t3-restart ×2) plus the same 3 collection-error files. Zero new failures. `p4t6` 10/10 with the lane's total re-pinned to **1027**. | `43-runtime-testkit-after-all-followups.txt` |
| root `pnpm test` after the review round (`rm -rf packages/testkit/test/.tmp-fault/` first) | **19 failed / 6162 passed (6181), 9 files failed / 485 passed (494)**, and the failing set is **identical BY NAME** to the pre-round baseline: `t1-capability-schema` ×9, `t2-blueprint-hash` ×1, `d3-member-identity-context` ×1, `p6t3-mediation` ×5, `p6t3-restart` ×2, `p6t6-actions` ×1, plus the same 3 collection-error files (`p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports`). `p6t1-parallel` passed. **Zero new failures at the whole-repo level.** | `46-root-pnpm-test-review-round.txt` |
| committed tree, final confirmation (review round) | `check-artifacts-committed` **OK: 1508 files** (exit 0) and the lane's eight spec files — both new specs, the refusal spec, both A4-PR5 pins, `a4p2`, `a4p4`, `p4t6` — **140 passed / 8 files**; `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` still `[1, 2, 3]` at `schema.ts:75` with `git diff e8dcfd7d HEAD -- …/schema.ts` empty | `45-final-confirmation-review-round-committed-tree.txt` |
| **rebase round 2 — `origin/master` moved again mid-round (`79aeddb2` → `ff9218a3`, 5 merges)** | `git merge-tree` showed exactly ONE colliding file, `p4t6-session-event-scan.test.ts`, and the collision was in the region `0a4f5029` had just extended with `SCANNED_PATHS_A4ARTIFACTS`. Resolved keeping both lanes; the ladder is now master's `1024 - 1023` and `1025 - 1024` (untouched) plus this lane's own endpoints on the new base, and every one of the lane's three commits was made self-consistent by an interactive `edit` pass with `p4t6` measured at its own stop: **1 file → `1026 - 1025`, 2 files → `1027 - 1025`, 3 files → `1028 - 1025`, 10 passed at each.** The mechanical keep-both-sides resolution re-created the COMMA-EXPRESSION trap a third time (`…A4ARTIFACTS.length,` followed by another term inside `.toBe(...)` silently drops every later term — it failed as `expected 1028 to be 1025`); repaired at all three stops. Nothing earlier was renumbered and no total was hand-written. | `48-rebase-round2-onto-master-and-p4t6-ladder.txt` |
| runtime + testkit, rebased tip | **8 failed / 4302 passed (4310)**, 6 files failed / 367 passed (373) — the identical base set | `47-rebase-round2-onto-ff9218a3-gates.txt` |
| root `pnpm test`, rebased tip | **19 failed / 6183 passed (6202)**, 9 files failed / 486 passed (495) — the identical 19 BY NAME (`t1-capability-schema` ×9, `t2-blueprint-hash` ×1, `d3` ×1, `p6t3-mediation` ×5, `p6t3-restart` ×2, `p6t6-actions` ×1) plus the same 3 collection-error files | `47-rebase-round2-onto-ff9218a3-gates.txt` |
| identity lint + eslint + `check:artifacts`, rebased tip | lint-identities **new 0 / resolved 0**; eslint still exactly ONE error, `service.ts 118:8 'PermissionStaticLayerFacts' is defined but never used` — proven on current `origin/master` too (`git show origin/master:… | grep -n PermissionStaticLayerFacts` shows the same type import used nowhere; this branch only shifts it 117 → 118 by growing the import list); `check-artifacts-committed` **OK: 1508 files** | this round's runs |
| review-round neighbours (`a4p3-approval-case`, `a4p3-approval-escalation`, `a4-escalate-act-truth`, `a4p7-v3-cutover-acceptance`, `a4p7-v8-catalog-migration-state`, `bp1-blueprint-registry`) + the five A4-PR5/PR7 ceiling specs | **195 passed** (neighbours) and **88 passed / 5 files** (the ceiling + approval specs) | this round's runs, quoted in `44-…`, `42-…` |

The dist install surface is co-committed: P1's commit carries the rebuild output of
`governance/service.*` and `governance/permission-mutation.*`, P3's carries
`src/plugin/permission-plane.*`. The FIRST landing of P1 omitted it and `check-artifacts-committed`
said so (`22-check-artifacts.txt`); it was fixed by amending that commit, not by a follow-up commit,
because the gate is per-commit.

---

## What was NOT implemented, and why

| item | verdict |
| --- | --- |
| Flip `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` → `[3]`; retire 1/2 | **Declined — explicitly forbidden here** ("if you flip it you have broken the plan's sequencing"). Also the ordering ruling: invert-to-refusal lands AFTER the flip; P3 is not the flip, it removes a fail-open that is live today. |
| Delete / retitle `leaderEnvelopeCoverage` | **Declined.** Gated behind all three prerequisites; the prerequisites are what let §7.3 do it. What is left for §7.3 is stated above (a refusal identity, not a hole). |
| Row-format migration + `TEAM_DOMAIN_SCHEMA_VERSION` / L3 row stamps | **Declined — not prerequisite.** F1 §5 found no row/document-version confusion left on the Blueprint-document path, and Group D pins the L3 stamp says `2` at its own layer. It is migration surface that §7.4's ruling ties to the flip, not to these three. |
| The frozen-origin **booted** acceptance-world leg | **Declined — F1 §5 assigns it to 7.3's receipt**, and its observable (`a frozen v1/v2 row reports `migration-required` with the number it comes from`) cannot exist while `[1,2,3]` is supported. |
| The A1-21 split (`unknown → BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED`, never `MIGRATION_REQUIRED`) | **Already satisfied — measured, not manufactured.** `host.ts`'s pre-v3 arm and `blueprintVersionStateOf` are untouched by this branch (`git diff --stat` empty over both files); F1's table row for the `number | undefined` seam stays accurate because P3 changed what the CEILING reader answers for the unknown state, not the seam type or its `host.ts:886` `'unreadable'` rendering. |
| Making the operation lane refuse on an unreadable binding (today: the frozen legacy routing arm) | **Round-1 wording was WRONG and is corrected: the arm DID move.** The claim "the abstention flows to that consumer as *no facts I can route on*, preserving the pinned behaviour byte-for-byte" is false — `createOperationApprovalFactsReader` forwards whatever the ceiling reader answers, and P3 changed that answer from `undefined` to a context with two `unavailable` slots, so the operation lane no longer takes `legacy`/`not-authority-v3` for an unreadable binding; it takes `authority-undetermined` + `authority-document-unavailable`. Round-2 follow-up 1 measures it through the production pair and pins it (leg 11, transcript `42`-adjacent), and `approval-routing.ts`'s rule-1 docstring now says so. The authority does not widen: both arms deny, neither writes, and a v3 Team that merely lacks ceiling documents is untouched (leg 5 owns that). |
| Re-running the ceiling gate on the APPROVED-proposal commit path | **Round 1 declined it; the review made it blocking; the resolution is neither of the review's two options as written — see "Blocking 1" below.** The claim measured here was accurate (`authorizeCeilingBoundedPermissionRise` had one call site, and the rung did not under-ask in the measured case) but the decision to leave the approved path unowned was overturned: the ceiling law is now stated at the commit boundary, the point set is owned by one function, and the terminal semantics are pinned by 12 legs. |
| Anything that would make the flip land | **Not attempted.** The lane's scope is recorded in `graph.yaml` at `1b9abd8f`: "前置车道 … 只含 P1-P3". |

### A fourth prerequisite, not mine

`SESSION_ROUTER_LOG.md` @ `1b9abd8f` records that `cordis.patch.yml`'s `dsh-agent-team` insert
(enabled; `config.blueprintSource` at `:58`) declares **`schemaVersion: 1`** and is the boot source of
the `tests/homes/a4-accept-*` acceptance world. When 1/2 retire, the first thing to break is the
§7.7 human-acceptance boot. It joins `s7_3_flip` as **P4, coordinator-owned** — not implementable
from this lane (it is a composition/config change outside the three prerequisites).

---

## Adversarial-review round — 2 blocking, 4 follow-ups

The verdict was **DO-NOT-MERGE**, and the headline was accepted as stated: P3 closes a fail-open
that is live on `master` today (`host.ts:2703` → `root.ts:2899` → `service.ts:1178`, with the
`wroteSnapshot: true` commit-at-base leg as its evidence). Both blocking items are resolved and all
four follow-ups are resolved or corrected with evidence. Where the review's framing measured wrong,
this section says so with a transcript rather than implementing past it — which is what the review
itself asked for.

### Blocking 1 — the ceiling at the approved-commit boundary

The ruling was: take **(A)** "re-consult the ceiling on the approved retry", not (B) alone, with the
law written into the docstring ("the ceiling bounds committed width at commit time"): re-read
`lane.authorityCeiling`, re-parse `lane.staticLayers`, reclassify, run
`authorizeCeilingBoundedPermissionRise(...)` after the rung revalidation and before
`appendPlannedSnapshot`, refuse with `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT`, zero append, no
re-mint.

**Option (A) as literally written breaks A4-PR5, measured first.** Implementing the raw re-ask
turned 3 pinned legs red in `a4p5-permission-mutation-inline-commit.test.ts` —
`Tests 3 failed | 20 passed (23)`, the escaping error being the direct gate's own
"the expansion authority ceiling reaches only no-authority…" raised at `governance/service.ts:977`
(transcript `37-b1-literal-reask-breaks-pr5-inline-commit.txt`). The reason is structural: the
durable proposal exists *because* the unapproved gate refused that very rise — A1-8 routes a DECIDED
insufficient rise to a proposal precisely because expansion `no-authority` means "not impossible, a
PROPOSAL". Re-running the same predicate after `resolveControl(allow)` therefore refuses forever,
turning every approved inline commit into a silent no-op whose case still reports `decided`. That is
a consumable-but-no-op approval: the laundering surface the review objected to, manufactured instead
of closed.

**The hole in (B) is also not constructible on the approval plane.** A document rule matching a width
matches every cell inside it, and the approval plane reads a non-matching rule as *no narrowing*, so
the cell is always the stricter question there — a cell-priced approval can never be cheaper than a
width-priced one (`planPermissionMutationApproval` takes the max). Six document shapes priced both
ways answer with the same rung; that algebra is pinned as its own `describe` in
`test/a4p7-approved-retry-ceiling-at-commit.test.ts` (legs 6-12, including the `human-admin`
"algebra forbids a reviewer" case). The expansion plane is a different plane and P1 was a real
fail-open there: asking only the cell let a cell grant authorize a wider mutation.

**What landed** is the ruling's substance in the shape the code can honour:

- **One owner for the point set.** `permissionRiseClaimedPoints`
  (`governance/permission-mutation.ts`) is now the only place that enumerates the points a rise
  claims, consumed by the expansion judge *and* by `buildApprovalAsk`'s planner, so the two cannot
  drift into pricing different point sets. Its docstring states that the approval-plane use is
  measured behaviour-neutral — "it is NOT a second fix, and nothing here claims it is".
- **The law written where the commit happens.** `resolveDiscoveredApprovalCase` carries the
  commit-boundary doctrine: the ceiling IS re-asked at commit time — through
  `deps.permissionLane.authorityCeiling` (fresh per decision, no cache), the fresh `lane.staticLayers`
  reclassification, and the approved-rung comparison — together with why the raw direct gate is not
  re-run there, with the transcript cited in place.
- **Terminal semantics decided in code and pinned by legs**: a commit-time ceiling refusal appends
  nothing (generation stays `undefined`), consumes nothing (the case keeps `resolved(allow)` and the
  same `legs.length`, so widening the documents makes the *next* retry commit exactly once —
  generation 1, then `no-change`), mints nothing (proposal rows unchanged), and never returns
  `changed: true`. The caller gets `mutation-stale` + `problem: 'ceiling-narrowed-past-approved-rung'`
  + `approvedRung: 'leader'`, or a thrown `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` when the documents
  are unreadable at retry — which propagates by design, since a throw out of a catch is never
  re-caught by its own `try`.
- **12 new legs**, each carrying its measured identity: `authority-unavailable` +
  `no-resolver-for-required-rung` + `human-admin` with 0 proposal rows for the unapprovable width
  mint; `leader` for the cell-only ask in the same world; the tightened-documents retry; the
  two-refusals-then-widen sequence; the unreadable-at-retry throw with zero append; the control leg
  proving an unchanged world still commits `subtree:output = allow`.
- **Honest labelling.** These are **new pins, not red→green fixes**: the file passes 12/12 against
  base product code with this branch's governance files stashed
  (`38-b1-legs-against-base-product-code.txt`), because the behaviour it protects was already correct
  and unowned. The red→green evidence for this item is transcript `37` (what the literal fix did),
  not a fake red on the new file.

### Blocking 2 — a sentence about byte-identical refusals that no leg owned

Measured (`34-measure-point-order-identity.txt`): asking the width BEFORE the cell left **all 14 spec
files green** while `governance/service.ts:1395-1397` promised byte-identical refusals. The sentence
was true of the common case (dedupe ⇒ one question) and false when both points refuse, where the
reported identity moves from the cell's to the width's.

Landed: the order now lives in the shared owner with a docstring that states why it is not cosmetic,
and two legs in `a4p7-carrier-width-under-ceiling.test.ts` own it —

- *when BOTH points refuse, the refusal keeps the CELL's identity, not the width's*: the width-only
  verdict would be `{ceiling:'no-authority', detail:{requiredAuthority:'leader'}}` while the real
  region answers `{ceiling:'ask', detail:{requiredAuthority:'human-user'}}`, and the thrown
  `details.ceiling` is `'ask'` with `details.region` naming the cell
  (`exact:file:…`);
- *the dedupe*: a region whose cell IS its width asks ONE question and answers today's refusal.

The reversal mutant is now red, run on the code as it will be committed
(`44-mutant-p1-reverse-on-committed-helper.txt`): the both-points leg fails
(`expected { status: 'insufficient', …(3) } to deeply equal { status: 'insufficient', …(3) }`) with
the other **87 legs green**, so exactly the owning leg catches it. `36-mutant-p1-reverse.txt` is the
same reversal measured on the pre-extraction judge.

### Follow-up 1 — the operation lane's arm, in production clothing

`FINDINGS.md`'s "preserving the pinned behaviour byte-for-byte" claim about the operation lane was
wrong and is corrected in the table above. The arm really does flip —
`legacy` / `not-authority-v3` → `authority-undetermined` / `authority-document-unavailable` — and
`a4p4-operation-approval-authority.test.ts`'s A14-A16 pin the adapter behind a **fake** ceiling port,
so nothing in the suite could see the substitution. Leg 11 of
`a4p7-ceiling-no-context-refusal.test.ts` now drives the production triple —
`createPermissionAuthorityFacts` → `createAuthorityCeilingReader` →
`createOperationApprovalFactsReader` → `routeOperationApproval` — with an unresolvable binding, and
pins the target arm, its denial shape (no `requiredAuthority`, no `carrierKind`), and that a Leader
install still gets `undefined` and the frozen `legacy` arm (rule 2 untouched). Recorded as **intended
flip-window behaviour**: the arm moves, the authority does not widen. `approval-routing.ts`'s rule-1
docstring now tells the truth about both planes.

### Follow-up 2 — the premise measured false; the posture pinned anyway

`judgeCeilingPoint` does **not** parse `staticFacts`. Its `try` covers only
`grantCeiling`/`expansionCeiling`; the `{ requiredAuthority: null }` catch belongs to
`requiredAuthorityDetail()`, its own detail renderer. The parses are once per mutation at
`service.ts:719` (ask), `:1181` (Alpha.3 block), `:1222` (ceiling gate) — and this branch's diff adds
and removes no parse and no `staticFacts` read at all
(`41-fu2-premise-check-parse-sites.txt`). So "parse once outside the loop" describes code that
already does that; reported rather than silently "fixed".

The posture the review wanted guaranteed is pinned anyway, in the two places it can be observed: the
width spec's leg 12 (the gate PROPAGATES a fault raised at a point — no per-point catch could absorb
a parse fault into the judge's fault answer) and the refusal spec's leg 12 (at the real entry a
malformed static document refuses ONCE as `PERMISSION_ENVELOPE_MALFORMED` /
`problem: 'static-facts-layers-array'`, zero write). Incidental, disclosed and not fixed:
`classifyPermissionRise` is not defensive the way the parser is — handed `{ layers: 'not-an-array' }`
it dies on `layer.rules is not iterable` rather than naming the shape. Unreachable in this repository
(every production `lane.staticLayers` answer is built through `parsePermissionStaticLayerFacts` and
`service.ts` parses again on arrival), quoted in the leg so the next reader is not surprised.

### Follow-up 3 — a docstring broader than its code, closed in the code

`permission-plane.ts:849` did call `deps.resolveBlueprint(t)?.schemaVersion` with no `try`; the
reason production does not crash today is that `host.ts:1993-2001` wraps the resolver it injects —
which is exactly why the seam's own sentence was the liar. Fixed in the code rather than by narrowing
prose: one local owner `resolveBlueprintOf` wraps the injected resolver and is now the only way this
factory reads it (both seam fields and `currentBinding`, three sites), answering `undefined` on a
fault — the same answer host.ts gives ("UNKNOWN facts (typed refusal downstream), never a fall-back
to the row anchor"), and the answer the ceiling reader already refuses on. Leg 10 drives the
PRODUCTION factory with a throwing resolver: RED at base
(`40-fu3-leg10-red-at-base-throwing-resolver.txt`:
`expected undefined to be 'PERMISSION_EFFECT_CONTEXT_UNAVAILABLE'` — there was no code at all to
route on), green now, and it also asserts the seam's own answer is a context with both document slots
`unavailable` and no anchor, never `undefined` (the pre-v3 skip), while the `1 | 2 → undefined`
branch stays byte-identical (legs 3-4).

### Follow-up 4 — the tripwire under §7.3's actual deletion

With Alpha.3's Leader coverage branch deleted **at file level** — `authorizeLeaderPermissionMutation`
calling `classifyPermissionRise(input)` with no coverage judge, the shape §7.3's retitle takes — the
approval-wired world still refuses:

| spec under the deleted branch | result |
| --- | --- |
| `a4p7-approved-retry-ceiling-at-commit.test.ts` (approval-wired) | **12/12 pass** |
| `a4p5-permission-mutation-proposal.test.ts` | **33/33 pass** |
| `a4p5-permission-mutation-inline-commit.test.ts` | **23/23 pass** |
| `a4p2-dual-envelope-mutation.test.ts` | **26/26 pass** |
| `a4p7-ceiling-no-context-refusal.test.ts` | 11/12 — the one failure is leg 9, which pins *Alpha.3's own* refusal identity |
| `a4p7-carrier-width-under-ceiling.test.ts` | 7/8 — the one failure is the entry leg pinning Alpha.3's identity |

**Tests 2 failed | 112 passed (114)**, and both failures flip **to a denying ceiling identity**, never
to a commit: `PERMISSION_ENVELOPE_EXPANSION_DENIED` → `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT`
(the width-at-entry leg) and → `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` (the ordering leg).
`42-fu4-mutant-leader-coverage-branch-deleted.txt`; the mutant was reverted in the same session.
This is the lane's strongest input to §7.3's retitle decision: deleting `leaderEnvelopeCoverage`
moves a refusal's NAME and leaves the refusal standing, with zero writes in every case.

### Transcripts added by this round

`34` (point-order measurement) · `35` (Blocking-2 legs green) · `36` (reversal mutant, pre-extraction)
· `37` (the literal re-ask breaking A4-PR5) · `38` (the new pins against base product code) ·
`39` (runtime + testkit after B1/B2) · `40` (FU-3 leg red at base) · `41` (FU-2 premise check) ·
`42` (FU-4 tripwire) · `43` (runtime + testkit, final tree) · `44` (reversal mutant on the committed
helper).

---

## Deviations, each with its error text

1. **Cited site wrong file, right line**: brief said `packages/runtime/control/service.ts:1294`;
   the ceiling lookup is `packages/runtime/governance/service.ts:1294`. Implemented at the real site.
2. **Parked test location**: brief implied `packages/runtime/test/`; it is
   `dev/agent-workflow/evidence/a4-ceiling-coverage/a4p7-carrier-width-under-ceiling.test.ts.inert`.
3. **Plan §7.5 (2) text** now mis-describes the pin it mandates (see P2 finding).
4. **`pnpm -r run typecheck` failed once mid-flight**, on my temporary mutant hook:
   `packages/runtime typecheck: governance/service.ts(1419,25): error TS2335: Property 'env' does not
   exist on type '{ cwd(): string; }'` (paraphrased: `process` is a narrow stub in `packages/runtime`).
   The hook moved to a `globalThis` property read and was later deleted; the final typecheck is clean.
5. **Master moved under the branch** (`fba82095` → `e8dcfd7d`, the a4-surface lane). Rebased; the
   `p4t6` collision and the comma-operator defect it produced are described in the P2 section, and
   the lane's totals moved 1024 → 1025 → 1026 instead of the brief's single 1023 → 1024 step. Both
   endpoints are measured; `983` and every other lane's endpoints are untouched.
6. **P1's first landing omitted the dist install surface** (`check-artifacts-committed` →
   `C content-drift (git add): packages/runtime/dist/...`); fixed by amending that commit.
7. **A backup written to `/tmp` vanished** (each bash call gets a private `/tmp`); the one-line list
   was restored with an in-place edit and later backups were kept inside the repo.
8. **Green-attempt assertion corrected by measurement, not by preference**: the width point's
   refusal names `requiredAuthority: 'leader'`, not `'human-admin'` — across the width the hard
   document speaks of nothing, which on the approval plane is no narrowing, while absence is no grant
   on the expansion plane. The assertion follows the measurement.
9. **Not pushed.** Branch local; no push, no force, no gate history touched.
10. **BLOCKING-1 was not implemented as written, and the refusal is evidenced, not rhetorical.**
    The literal re-ask produces `Tests 3 failed | 20 passed (23)` in
    `a4p5-permission-mutation-inline-commit.test.ts` with the direct gate's own
    `…the expansion authority ceiling reaches only no-authority…` escaping
    `governance/service.ts:977` (`37`). The ruling's INTENT — the ceiling bounds committed width at
    commit time, terminal semantics decided and pinned — is implemented; the predicate call site it
    named is the one thing this lane cannot re-run without breaking PR5.
11. **A `git checkout` destroyed uncommitted work mid-round, and it briefly changed a gate result.**
    Reverting the FU-4 file-level mutant with `git checkout
    packages/runtime/governance/permission-mutation.ts` reset that file to HEAD and deleted the
    uncommitted `permissionRiseClaimedPoints`, surfacing immediately as
    `TypeError: permissionRiseClaimedPoints is not a function or its return value is not iterable`
    in five legs of `a4p7-carrier-width-under-ceiling.test.ts`. The helper was rewritten from its
    consumers' requirements and re-verified (88/88 over the five ceiling/approval specs,
    `pnpm -r run typecheck` clean, and the reversal mutant re-run against the restored code as
    `44`). Consequence for evidence: the FIRST full-suite run of this round executed inside that
    window and was discarded; transcript `43` is the re-run on the clean tree. Lesson recorded: a
    mutant is reverted by inverse patch, never by checkout, when the file carries uncommitted work.
12. **`origin/master` moved TWICE inside this one review round** (`79aeddb2` → `ff9218a3`). The
    second move collided with this lane in `p4t6` — the one file whose shape two lanes edit in the
    same place. Resolved with both lanes' lists kept, and the mechanical resolution re-created the
    comma-operator defect (`… A4ARTIFACTS.length,` + a following term is a comma expression inside
    `.toBe(...)`, so the expected value silently dropped every term after it; it surfaced as
    `AssertionError: expected 1028 to be 1025`). Every gate in the table above was then re-measured
    on the rebased tip; the pre-rebase transcripts (`43`, `45`, `46`) are kept, not rewritten.
13. **FU-2's premise was reported false instead of being implemented past.** "Parse once outside the
    loop" describes code that already parses once outside the loop
    (`41-fu2-premise-check-parse-sites.txt`); the malformed-static legs were added to pin the
    posture, and one genuine incidental (the classifier's non-defensive `layer.rules is not
    iterable`) is disclosed rather than quietly patched.
