# DDoD20 UI rail navigation — repair round 2 (target identity, real-tree scope, row-container identity)

Task lane: PR #62 / DoD#20 UI acceptance, kit `tests/kits/team-view-sync-complete-e2e/`.
Branch `task/dsh-020rc2-upgrade-20261003`, host pin `tests/paths.mjs` →
0.2.0-rc.2 @ `639ed015397290b3745d163aafe02ffee4aa3f84` (test-use checkout,
porcelain empty before and after this round).

**Reviewed commit this round repairs (exact parent):**
`4bd13a9a580b177151d1769da3a38142e01211b8` (its parent
`ed9e2c09b02ca0e04f4f5cdb03c51abf42d9bb29`, its tree
`07d1250b4e7d4d9dce6808e20de1e2a24a6094b3`).
**This round is a narrow descendant commit — no amend, no rebase, no history
rewrite.** A commit cannot contain its own hash: the resulting newHEAD and tree are
recorded byte-exact in the round's transfer package
(`git/commit-metadata.txt` + receipt), and the package name pins both heads.
`4bd13a9a…`, its evidence in this directory and its private read-only package are
untouched.

**No browser, host, wrapper or acceptance run was performed in this round.** The one
approved real-Chrome v4 run (`bash-2336`, stamp `2026-10-05T18-50-45Z`, exit 2,
E2 PASS, E1/E3E5 `locate-not_found`, E4 frozen `NOT_RUN`) stays the terminal live
authority. All work here is source + offline tests. See
`CORRECTION-evidence-wording-20261005T204100Z.md` in this directory for what the
previous round's wording overstated (stale compiled hash = proven; failure-time DOM
= not proven; `shot-E2-ordinary.png` = E2-only corroboration; PROVENANCE tree value).

## What the independent source review found, and what replaced it

1. **Positional traversal → carried target identity.** `navigate()` expanded
   `collapsedGroupRows(…)[0]` (up to 3) and clicked the first
   `aria-expanded="false"` overflow row anywhere. Now: the group key is derived
   **before any browser leg** from the same read-only world as the titles —
   `storages/workspace.json` (`global.workspaceIds` +
   `tables.workspaces[<id>].sessionIds`) through `readWorkspaceGroups()` +
   `deriveGroupKey()`, the driver-side mirror of the pinned product's
   `owningGroupKey()` (`tree.ts:27-32`, `UNGROUPED_KEY === ''` at `tree.ts:19`) — and
   is carried on every canonical target (`canonicalTargets(..., membership)` →
   `groupKey` / `groupKeyProven`). Only `workspace:<groupKey>` and
   `overflow:<groupKey>` are ever clicked. Unproven / duplicate / missing identity
   fails closed (`group-identity-missing`, `group-ambiguous`, `group-not_found`)
   before a single rail click; an unreadable membership store is a `Fatal`, never a
   silent "assume Ungrouped". `navPlan()` only schedules a group/overflow step for a
   proven key.
2. **Unscoped collector → real-tree scoping.** The collector treated any
   `data-row-key` prefix anywhere in the document as a rail row. The pinned product
   renders rows only inside AnimatedRows' `role="tree"` container
   (`rows/AnimatedRows.tsx:171-176`; the search panel emits a **second distinct**
   `[role=tree]`, `rows/WorkspaceBrowser.tsx:790`), with `role="treeitem"` on
   session/group rows (`rows/Rows.tsx:245-247`, `:589-597`) and a
   `<button aria-expanded>` overflow (`rows/WorkspaceBrowser.tsx:582-586`). The
   serialized collector now reports `rowKind` + `treeSeq` + `rowSeq`; keyed elements
   outside every tree (or with a role contradicting their prefix) are `unscoped`:
   never a target, always counted in diagnostics, and a **competing identity** that
   makes a locate `AMBIGUOUS` instead of letting document order pick a tree.
   *Faithful markup first:* this round's own previous fixtures had omitted the tree
   container, which is why the unscoped collector passed offline — both
   `dod20-ui-driver-fixtures.mjs` and the new `dod20-ui-rail-harness.mjs` now render
   the real container, and the pre-existing rail suite (17 tests) was verified
   **green at the unmodified 4bd driver** with the fixed markup, so the RED below is
   attributable to the driver, not to the fixture change.
3. **Leaves are not rows → row-container identity.** `locateSessionRow()` counted
   matching-title *leaves*, so two visible containers sharing one canonical
   `data-row-key` resolved `FOUND` when one title matched. It now counts **distinct
   row containers** (per-snapshot `rowSeq`): `rowContainers` / `titleRows` /
   `trees`, with `AMBIGUOUS` when the canonical key appears in >1 container, in
   another real tree, or as a visible out-of-tree keyed element — regardless of
   titles. One row still renders several leaves (slot/title/time/actions) and stays
   one row. The pre-existing policies are intact, not weakened: two real rows with
   equal titles and different ids are still `AMBIGUOUS` (now explicitly tested), and
   hover-card text without a row identity is still not a row.

## Faithful-DOM RED first, then the repair

* `RED-identity-20261005T203443Z.log` — the new
  `dod20-ui-driver-rail-identity.test.mjs` (22 tests) executed at
  `HEAD = 4bd13a9a…` with the **driver untouched** (only the new suite + the shared
  harness existed): **tests 22 / pass 0 / fail 22, exit 1**. Every failure is the
  defect, not harness noise — e.g. `Missing expected rejection` where an unproven
  group must refuse, `undefined !== 1` for the missing row-container count, `the two
  candidates are in DIFFERENT trees` for the absent `treeSeq`.
* Coverage of the review checklist: four unrelated collapsed groups before the known
  target (strangers stay shut, exactly `workspace:` clicked); a foreign group's
  overflow never clicked (its idle quota untouched); the target reached by its own
  `ws-40d5679e` key; missing expected group → `group-not_found` with the groups that
  *were* present in diagnostics; duplicate expected group → `group-ambiguous`;
  unproven group → `group-identity-missing` with **zero** rail clicks; `navPlan`
  schedules the group step only for the expected row; a keyed `role=treeitem` outside
  every tree is never the target (`locate-not_found`, `keyHits 0`,
  `rail.unscopedKeyed ≥ 1`, no click); a keyed element without `role=treeitem`
  inside the tree is not a row either; the same key in two distinct real trees stays
  `AMBIGUOUS` (no first-tree preference); a row in the *search* tree is still a real
  row and is found; one container with slot/title/time/actions leaves reports
  `rowContainers === 1` `FOUND`; two containers sharing the canonical key with
  different titles are `AMBIGUOUS` before any click; two real rows with equal titles
  and different ids are `AMBIGUOUS`; a hover-card title repeat is ignored; a
  same-id row whose title left the canonical value is `NOT_FOUND` with
  `titleMismatch: true`; plus unit tests for `deriveGroupKey` /
  `readWorkspaceGroups` / `canonicalTargets(…, membership)` (unaccounted → `''`,
  accounter → workspace id, two claimants → refuse, absent/unreadable store →
  refuse, path stays inside the world and never touches credential material).
* Both suites drive **the live seams**: the exported `railCollectorSource()` string
  executed verbatim in the repo's own jsdom, and the exported `navigate()` clicking
  by coordinates that bubble to real listeners (`dod20-ui-rail-harness.mjs`, shared
  by the 17-test and 22-test suites so one world is used).

## GREEN — offline battery and applicable checks (this round)

All raw logs in this directory, prefix `GREEN-identity-20261005T203947Z-`:

| check | result |
| --- | --- |
| `dod20-ui-driver.test.mjs` (pure core) | 82 tests / 82 pass / 0 fail, exit 0 |
| `dod20-ui-driver-orchestration.test.mjs` (leg orchestration) | 49 / 49 / 0, exit 0 |
| `dod20-ui-driver-rail-dom.test.mjs` (faithful DOM, round 1 suite kept whole) | 17 / 17 / 0, exit 0 |
| `dod20-ui-driver-rail-identity.test.mjs` (NEW, was 0/22 RED) | 22 / 22 / 0, exit 0 |
| `dod20-ui-driver-ownership.test.mjs` (server/ownership locks) | 12 / 12 / 0, exit 0 |
| `carrier-import-preflight.test.mjs` | 6 / 6 / 0, exit 0 |
| `live-token-redaction-check.mjs` | all assertions green, exit 0 |
| `vitest run packages/testkit/test/rc2-kit-pin-hygiene.test.ts` | 7 / 7 pass, exit 0 |
| root `npx vitest run` (whole repo) | see ROOT below |

Total kit battery **188 tests, 0 failures** (round 1 was 166; +22 identity tests).
Nothing was dropped to reach green: no required assertion was deleted or inverted.
The expectations that did change are recorded in the commit message and are all
"make the fixture/fake as faithful as the product", never "make the assertion
weaker": fixtures gained the real `[role=tree]` container; `navPlan` calls pass the
explicit `groupKey`/`groupKeyProven`; the orchestration fake page now reports the
same `role`/`rowKind`/`treeSeq`/`rowSeq` fields the live collector reports, and its
stub world gained the `storages/workspace.json` membership store the driver now
reads; the rail-dom "target in ANOTHER workspace" test was **strengthened** (it now
also asserts the stranger Ungrouped row stays closed and that exactly one group row
is clicked).

Preserved unchanged: E1/E2/E3/E5 thresholds and windows, the preClick boundaries,
the fresh identity-correlated `getReadState` proof, Team-tab attachment, the E2
ordinary-workspace oracle (E2 has no rail target, so `expected == null` keeps its
documented legacy rail behaviour and is never located), the E4 frozen `NOT_RUN`
disposition, sandbox/ownership/teardown source locks, the live gate
(`--confirm-live`), and the 860+30 wrapper envelope — `run-dod20-ui-persistent-runtime-v4.sh`
(sha256 `e5ed43003a28fd964bf87ad16b758e5e01b17802495cb3fc606bfa8b86dfe831`) and
`run-dod20-ui-bc1056fc.sh` are byte-identical; `:3080` was never touched.

## ROOT — whole-repo vitest

`GREEN-identity-20261005T203947Z-root-vitest.log`: **Tests 20 failed | 5398 passed
(5418); Test Files 10 failed | 446 passed (456)**, exit 1, duration 40.4s.
`GREEN-identity-20261005T203947Z-root-vitest-delta-isolation.log`: the same ten
files re-run alone.

This change touches no vitest file: the whole kit is `node --test` under
`tests/kits/`. Attribution, file by file:

| failing file | count | isolated | attribution |
| --- | --- | --- | --- |
| `packages/domain/test/t1-capability-schema.test.ts` | 9 | 9 failed / 8 passed | pre-existing (also red in round 1) |
| `packages/domain/test/t2-blueprint-hash.test.ts` | 1 | 1 / 17 | pre-existing |
| `packages/runtime/test/p6t3-mediation.test.ts` | 5 | 5 / 2 | cross-file test-world bleed (`expected 'session-root-p6t1' to be 'session-child-p6t3-leader'`), pre-existing |
| `packages/runtime/test/p6t3-restart.test.ts` | 2 | 2 / 3 | same bleed |
| `packages/runtime/test/d3-member-identity-context.test.ts` | 1 | 1 / 4 | same class |
| `packages/tools/test/p6t6-actions.test.ts` | 1 | 1 / 13 | pre-existing |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | 1 | 1 / 9 | the recorded stale-pin landmine `expected 971 to be 968` — **byte-identical number to round 1**, i.e. this change moved nothing |
| `packages/runtime/test/p8s3b-result-effects.test.ts` | 1 | "no tests" alone | collection-order-dependent (0 tests in isolation), known intermittent |
| `packages/runtime/test/t12a-b2-child-identity.test.ts` | 1 | "no tests" alone | same |
| `packages/runtime/test/t12a-glue-handoff-ports.test.ts` | 1 | "no tests" alone | same |

Round-1 comparison: 22 failures / 11 files. This round: 20 failures / **10 files, a
strict subset** — the only difference is `packages/runtime/test/p6t1-parallel.test.ts`,
which passed this time (the known flaky one). **No file became failing that was not
already failing before this change.**

The only vitest-tier file this round exercises is the kit-pin gate
`packages/testkit/test/rc2-kit-pin-hygiene.test.ts`: 7/7 pass, exit 0, run
separately (log `…-rc2-kit-pin-hygiene.log`).

## Not proven by this round (unchanged honesty boundary)

* Which candidate cause fired first in the live 18-50-45Z miss, and the exact
  failure-time DOM/locale/geometry (see the correction note).
* That the repaired driver would pass the live lane — no live lane may be run
  without explicit authorization; this round proves the seams refuse and locate
  correctly on a faithful DOM, nothing more.
