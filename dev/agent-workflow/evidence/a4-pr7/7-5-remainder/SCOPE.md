# A4-PR7 §7.5 — scope statement for the "remainder" (lane `a4-75-remainder`)

Base: `origin/master` = `e80a00da60765ae8533f417b6c4e667299c6d90b` (fetched this round;
`git rev-parse origin/master`; PR #161 merge). Every state below was **measured in this
worktree**, not read from the dispatch message. Evidence lines are quoted as
`file:line` of the tree at that SHA.

**`origin/master` moved during this session** to `340e30e3` (PR #162 = the round-22
records, a coordinator doc commit). The branch was rebased onto it and every battery leg
was re-taken there (BATTERY.md §6); the rebase moved only `graph.yaml` and
`SESSION_ROUTER_LOG.md`, and the fence output is byte-identical across both bases. The
moved commit independently confirms the deferral this lane depends on: *"FLIP STILL
DEFERRED with `cordis.patch.yml:60` v1 + `fixtures.ts` … both coordinator-owned, Phase 2,
parse-level census mandatory. STILL OPEN: §7.5 (in flight)"*.

## The five §7.5 bullets, measured

| # | §7.5 bullet (plan `:845-863`) | State | Evidence line I read it from |
| --- | --- | --- | --- |
| 1 | **Keep `effectiveAuthorityCeiling()` / `narrowingForApproval()`** — "must not be removed" | **DONE, nothing to do.** Both exported and both have a production caller. | `packages/domain/authority-envelope/src/authority-envelope.ts:409` (`export function effectiveAuthorityCeiling`), `:439` (`narrowingForApproval`); production readers `packages/runtime/governance/authority-ceiling.ts:54,423` and `:56,574` — exactly the two call sites the plan names. |
| 2 | **The one deletion**: Alpha.3 existential aggregate `leaderEnvelopeCoverage` + its refusal text + the round-5 comment, **conditional on three prerequisites** | **NOT STARTED — and it is gated on more than the three prerequisites. See "Where this disagrees with the dispatch summary" below.** | Symbol still in the tree: `packages/runtime/governance/permission-mutation.ts:1390` (the call) and `:1419` (the definition). Its refusal text is `:1400-1408` (`EXPANSION_OUTSIDE_ENVELOPE` / `'expansion-region-uncovered'`); the round-5 comment is the docstring at `:1411-1418`. |
| 2a | prerequisite (1) — ceiling evaluated at the claimed **width** as well as the cell | **LANDED** | `packages/runtime/governance/service.ts:1438-1464` (the "SET OF POINTS ASKED" law) and the loop at `:1479` over `permissionRiseClaimedPoints`, the point owner shared with the ask pricing at `:745`. |
| 2b | prerequisite (2) — the width pin committed **with its `p4t6` entry** | **LANDED** | `packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts` exists and runs **8 tests** (measured, `transcripts/01-baseline-five-guard-suites.txt`); it is in `SCANNED_PATHS_A4PR7`. |
| 2c | prerequisite (3) — the no-context branch is a **refusal** | **LANDED** | `packages/runtime/src/plugin/permission-plane.ts:879-922` (`unreadableAuthorityCeilingContext` at `:910`) + `packages/runtime/test/a4p7-ceiling-no-context-refusal.test.ts` (**12 tests**, measured). |
| 3 | **`scripts/verify-blueprint-version-clean.mjs` + the test wrapper that calls it** | **DONE** | Both files tracked; wrapper is the 60-test `packages/testkit/test/a4p7-blueprint-version-clean.test.ts` in the battery. |
| 4 | **`scripts/lint-identities.mjs` + `"lint:identities"` in the root scripts** | **DONE** | `scripts/lint-identities.mjs` tracked; `package.json:41` `"lint:identities": "node scripts/lint-identities.mjs"`. |
| 5 | **`pnpm smoke:composition`** (the `[x]` A1.2.7-disclosure bullet, re-scoped to a named SKIP, no dependency fix) | **DONE** | `package.json:44` `"smoke:composition"`; classifier spec `packages/testkit/test/a4p75-composition-smoke-classification.test.ts`; no `clsx` in `packages/client/package.json` or `pnpm-lock.yaml` (the file-list line `plan:744` striking the manifest edit is honoured). |

## Where this disagrees with the dispatch summary

The coordinator's summary was: *"an Alpha.3 existential aggregate item plus three
guard-test retitles"*.

1. **The tooling half of §7.5 is fully landed** (bullets 1, 3, 4, 5). Nothing there is
   open — the summary is right that only the aggregate remains, and I found **no**
   fourth outstanding §7.5 tooling item.
2. **The deletion is NOT executable at this base, and that is a dependency the §7.5
   bullet states only obliquely.** Its own conditional names three prerequisites and
   all three have merged (2a/2b/2c above), which is what the summary read as
   "unblocked". But the **ruling** for the same symbol at `plan:722` places it
   elsewhere: *"this removal happens **inside the 7.3 window**, where the transitional
   guard surface is inverted deliberately and its three guard tests are retitled to
   the surviving ceiling law"*. The 7.3 window has not opened: the version flip is
   deliberately deferred (`graph.yaml:s7_round21_records`: "THE FLIP ITSELF STAYS
   DEFERRED"), and the tree still supports binding a v1/v2 Blueprint
   (`packages/domain/blueprint/src/schema.ts:75`). I measured what deleting the
   aggregate does to such a Team — `FINDINGS.md` §"THE MEASUREMENT". Short version: it
   **removes the only authority law a decided v1/v2 Team has**, because the ceiling
   reader answers `undefined` for that Team (`permission-plane.ts:969-972`, the code whose own comment says the skip lasts "until the cutover retires them", pinned by
   `a4p7-ceiling-no-context-refusal.test.ts` leg 5 at `:317`), so there is no ceiling
   gate left standing to take the law over. Legs 3-5 of the width pin — the stated
   reason the deletion is safe — are **v3-wired legs**; they cannot see a v1/v2 Team.
   Measured with one instrument on both populations
   (`transcripts/10-probe-at-base.txt` → `11-probe-under-mutation.txt` →
   `12-probe-restored-green.txt`): on a **decided v2** Team the deletion turns
   `PERMISSION_ENVELOPE_EXPANSION_DENIED` + zero write into **no refusal and a durable
   snapshot written**; on a **v3**-wired Team the same rise still refuses
   (`PERMISSION_AUTHORITY_CEILING_INSUFFICIENT`) with zero write — an identity change
   only. The lane that landed the prerequisites recorded the same boundary: "Delete /
   retitle `leaderEnvelopeCoverage` — Declined … the prerequisites are what let
   **§7.3** do it" (`evidence/a4-pr7/7-3-prereq/FINDINGS.md`, "What was NOT implemented").
   So: **BLOCKED on §7.3's version flip**, dependency named, not executed. Per the
   standing instruction ("if §7.5 appears to need it, stop and report BLOCKED with the
   dependency named instead of doing it") I did not touch
   `schema.ts:75` / `types.ts:416` / `cordis.patch.yml` / `testdata/fixtures.ts`.
3. **The three retitles are the deletion's consequences, so they inherit the gate.**
   They are named in the plan at `:722`: `a3p3-revoke-reveal-semantics`,
   `a3p4-r4-authority-binding`, `a4p2-dual-envelope-mutation`. A retitle landed before
   the deletion would retitle tests to a law that is **not yet the law** — the exact
   §7.4 trap the plan spells out at `:838` ("a refusal test written before the flip is
   green because the loop is empty"). I measured the blast set anyway, so the next
   lane gets it as data rather than as a hunt: `FINDINGS.md` §"THE POPULATION".

## What this lane therefore delivered

Not a code change. A **measurement of the gate**, the population it gates, the full
§7.6-shaped battery on an unchanged merged tree, and the instrument failures that
produced both the measurement and this document.
