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
| Making the operation lane refuse on an unreadable binding (today: the frozen legacy routing arm) | **Declined — PR7/§7.3 owns that arm** (`approval-routing.ts` rule 1, pinned in `a4p4`). P3 deliberately did not move it: the abstention context flows to that consumer as "no facts I can route on", preserving the pinned behaviour byte-for-byte. Flagged as a flip-window question. |
| Re-running the ceiling gate on the APPROVED-proposal commit path | **Declined — reported.** `authorizeCeilingBoundedPermissionRise` has exactly ONE call site (`governance/service.ts:1178`, the direct path). `buildApprovalAsk` plans its regions at `region.region` (`:731`), so on an approval-wired lane the width refusal becomes a durable proposal whose rung is computed at the CELL, and the approved retry commits on identity + rung revalidation without re-consulting the ceiling. Measured (`26-measure-ask-rung-cell-vs-width.txt`): for the width fixture both the cell plan and a width plan answer `{status:'required', requiredAuthority:'leader'}`, so no rung UNDER-asks in the measured case — the structural question is that the ceiling law is absent from the approved path, not that the rung is wrong. It is PR5's ask surface, and changing it here would be over-delivery. |
| Anything that would make the flip land | **Not attempted.** The lane's scope is recorded in `graph.yaml` at `1b9abd8f`: "前置车道 … 只含 P1-P3". |

### A fourth prerequisite, not mine

`SESSION_ROUTER_LOG.md` @ `1b9abd8f` records that `cordis.patch.yml`'s `dsh-agent-team` insert
(enabled; `config.blueprintSource` at `:58`) declares **`schemaVersion: 1`** and is the boot source of
the `tests/homes/a4-accept-*` acceptance world. When 1/2 retire, the first thing to break is the
§7.7 human-acceptance boot. It joins `s7_3_flip` as **P4, coordinator-owned** — not implementable
from this lane (it is a composition/config change outside the three prerequisites).

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
