# §7.3 flip lane — BATTERY (measured on the tree this lane leaves behind)

Tree left behind = **base behaviour, narrowing withheld** (all-or-nothing; see FINDINGS §1).
`git diff --stat` after the revert: empty. Population reds are byte-identical to the base run
modulo the two declared `p6t1-parallel` flakes.

Every number below was produced by the command printed above it, on this tree, in this session.

| Check | Command | Result |
|---|---|---|
| Version-clean fence (from toplevel — it exits 2 elsewhere) | `node scripts/verify-blueprint-version-clean.mjs` | `unknown(0,0) advisory(8,10) refused(52,115) prose(5,5) adjudicated(16,24)` — **the required invariant values, unmoved** |
| Fence wrapper suite | `npx vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | **60 passed / 60** |
| Identity lint (nonzero = STOP) | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `76 distinct; new 0, resolved 0` → **clean**, exit 0 |
| Session-event scan | `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | **10 passed / 10** |
| Typecheck (bailing) | `pnpm -r run typecheck` | exit 0, **0 × `error TS`** |
| Typecheck (no-bail, reported separately) | `pnpm -r --no-bail run typecheck` | exit 0, **0 × `error TS`** |
| Population | `npx vitest run packages/{runtime,domain,legacy,storage,contracts}/test` | **18 failed / 5022 passed (5040)**, 8 files, 12.4s |
| Same population at base (`git stash`ed) | same | **20 failed** — the extra 2 are `p6t1-parallel` flakes, which fire and not fire across runs |
| Red-identity diff, mine vs base | `comm -13` on the two `FAIL` lists | **empty** → the narrowing introduced **no** new red |
| Red-identity delta from the §7.5 deletion | same | **+41 legs / 9 files** (39 real + 2 flakes) |

Base debt, reported by identity, **not absorbed**: `t1-capability-schema` (9,
`$.metadata must be a plain object, got null`), `p6t3-mediation` (5), `p6t3-restart` (2),
`d3-member-identity-context` (1), `t2-blueprint-hash` (1), `p6t1-parallel` (2, flaky), plus
file-level faults in `t12a-glue-handoff-ports`, `t12a-b2-child-identity`,
`p8s3b-result-effects`. `a4p7-merge-gate`'s 1 red is base debt needing `pnpm build` (testkit run).

## What was NOT run, because the tree that needed it does not exist any more

The §7.3-specific legs (`a4p7-blueprint-v3-governance` 20, `a4p7-v3-cutover-acceptance` 70,
`a4p7-v8-catalog-migration-state` 21, `a4f1-row-version-not-document-version` 16,
`p7t6-teammates-adapter` 22, `a3p4-r4-authority-binding` 17, `a3p4-pr4-production-entry-regression`
20, the 13 runtime grammar-carrier files, `t2-blueprint-v2-*`, `blueprint-v1-frozen-resume`) were all
run **green on the migrated tree** while it existed, per-file, and are green again only by
applying [`73-flip-full-migration.patch`](73-flip-full-migration.patch). They are red or
non-collecting on the tree I am leaving, because on this tree those fixtures are still v1 and the
tests still expect `[1, 2, 3]`. That is the expected shape of "narrowing withheld": nothing on this
tree is newer than base.

## The patch is NOT apply-as-is

`73-flip-full-migration.patch` (35 files, +1248/−469) bundles three separable things:

1. **The narrowing + its test/fixture migration + the skill example + the census fix + the fence
   comment fix** — measured to zero new reds, ready.
2. **`packages/legacy/teammates-adapter.ts`** — the one production site that *emits* a blueprint
   document (`:542`). Needs its own look: it changes the content hash of every legacy import.
3. **`packages/runtime/governance/permission-mutation.ts`** — the §7.5 deletion. **Do not apply
   without the 39-leg disposition** in FINDINGS §1; applying it alone turns ~23 documented
   refusals into commits in every root-direct test world, and leaves the shipped product's
   behaviour resting on a single line (`host.ts:2703`) that nothing in the corpus pins.

Split before merge. Items 1 and 2 can go together once §7.5's follow-up decides the ceiling wiring;
item 3 goes only with its test work, in the same commit.

---

# LANDING ROUND (the flip PR proper; item (3) excluded by ruling)

Commands run from the repo toplevel, after `git add -A` (the fence reads
`git ls-files`, so a pre-add run measures a different tree).

| gate | result |
| --- | --- |
| fence, run twice | **byte-identical** (`diff` empty). `dirty(6 files, 15 sites)` · `unknown(0, 0)` · `advisory(6 files, 8 sites)` · `refused(52, 115)` · `prose(5, 5)` · `adjudicated(16, 24)` · verdict `dirty-or-unknown` (exit 1 = the designed state while the dirty-class adjudication row is pending). `unknown` / `refused` / `adjudicated` / `prose` unmoved from the banked base values; `advisory` moved `8 files/10 sites → 6/8` exactly because two files were migrated. |
| population (`packages/{runtime,domain,legacy,storage,contracts}/test`) | 416 files, **9 failed files**; red-identity diff vs the base capture: **0 fixed, 1 "new" = `p6t1-parallel > P2`**, which passes 9/9 when run alone → the known intermittent flake, reported by identity, not absorbed. All 21 base reds still red by identity. |
| testkit (full, from toplevel) | 29 files, 28 green; the one failure is `a4p7-merge-gate > composition smoke leg` reading `refused` because `packages/client/dist` does not exist (base debt: needs `pnpm build`). After `pnpm build`: **25/26** and the composition arms PASS. |
| `pnpm build` | exit **0**. |
| `node scripts/composition-smoke.mjs` | **`PASS composition-smoke`, exit 0** — the built tree's boot-time `validateTeamPluginConfig` accepts the shipped `cordis.patch.yml` blueprint after the narrowing. |
| `check:artifacts` (the merge gate's install-surface leg) | FAILS after a build, with **20 drifted tracked `packages/runtime/dist` files** — see the staleness finding below. Surface reverted to HEAD; this PR carries no rebuilt `dist`. |
| `pnpm -r run typecheck` | exit **0**, **0 × `error TS`** |
| `pnpm -r --no-bail run typecheck` | exit **0**, **0 × `error TS`** |
| `lint-identities --diff` vs `lint-identities-0237d487.txt` | `76 distinct; new 0, resolved 0`. (One transient NEW identity appeared mid-round — an unused `TeamBlueprint` type import in `blueprint-v1-frozen-resume.test.ts` left by the migration. Removed, not baselined.) |
| `p4t6-session-event-scan` | **10/10** after re-derivation. RED with the new file on disk and the entry absent: `expected 1032 to be 1031` at `:1998:37` (`p4t6-PRE-EXTEND-RED.txt`). GREEN with `SCANNED_PATHS_A4P73FLIP` (1 path, tie asserted as `1032 - 1031`), title moved `978 → 979`. |
| wrapper `a4p7-blueprint-version-clean` | **60/60**. |
| shipped-composition instrument | **3/3** (parse at v3 + both documents; `contentHash` literal; re-stamped-to-retired refuses). |

## DEFERRALS row deletions are checked, not just performed

| row removed / changed | the leg that reddens if it is wrong | proof |
| --- | --- | --- |
| `a3p4-pr4-production-entry-regression.test.ts` (migrated by this PR) | `every deferred path is still dirty (a migrated path must leave the list)` | **mutation:** the row re-added verbatim → that leg fails by name; wrapper 59/60. Reverted. |
| `t12a-live-bridge.mjs` (deleted; the last `.mjs` emitter) | same detector | same mechanism (a clean path in the list is a stale row). |
| 3 new rows (frozen-resume, t2-v2-requirements, a3p4-r4-authority-binding) | `the dirty set is EXACTLY the recorded Task 7.4 deferral set` + `every deferred path is still dirty` | each names the path as the leg's SUBJECT; the two detectors are the pair that catches both directions. |
| `p7t6` row: line list removed, archetype re-pointed at it | the archetype leg asserts the line set **by equality** (`toEqual([119,258,285,390,408,426,468,470,472])`) | line numbers are deliberately *not* stored in the row text (the §7.3 shift within one commit is precisely the rot that stores-then-forgets). |
| `.mjs` scan-class leg (real carrier gone) | synthetic scope + verdict leg | `isScanScopePath(...)=true`, `classifyText` yields a verdict naming line 1, and the `.ts` twin of the same bytes is `advisory` not `dirty` — the extension rule pinned in the same breath. Residual priced in `intentional-retired.md`. |

## Adapter (item 2) census — reported as a census, not a test result

- **Which hashes change:** every document the legacy adapter emits. The emitted
  body changed on three axes at once (version digit, plus two newly required
  documents), so *all* legacy-import content hashes move. Measured pair for one
  representative document (`legacy.census`, members `[]`, legacy provenance
  metadata): `schemaVersion: 1` alone vs the emitted v3 draft → the hashes
  differ, as expected, and the delta is not local to the digit.
- **How many references break:** **zero.** `git grep` intersection of
  hash-bearing files (104) with legacy-bearing files (74) is 5 candidates; of
  those the only `sha256:` literals are `sha256:abc123` (a synthetic id in
  `packages/contracts/test/ids.test.ts`) and `p7t6`'s all-zero fake plus a
  `startsWith('sha256:')` check. **No pin, fixture, baseline or document
  anywhere references a legacy-import hash.** p7t6's hash legs are all
  relational (same-input-equals, changed-input-differs, snapshot-immutable),
  which is why the adapter change is invisible to them — reported as a property
  of the corpus, not as a pass.
- **Does `p7t6` leave the fence's dirty set?** **No** — 9 sites remain
  (`L119, 258, 285, 390, 408, 426, 468, 470, 472`), all on the legacy `.md`
  format's own version axis. So its `DEFERRALS` row stays, and no by-path
  control had to move with it. Verified after the adapter change, not before it.

## One finding the build surfaced (not mine to fix, mine to report)

`dist@HEAD` contains `if (blueprint.schemaVersion === 2)` in
`packages/runtime/dist/packages/runtime/admission/requirement-gate.js`
(grep count 1) while `source@HEAD` for the same module contains it **0** times —
the committed install surface is **stale against source at base**, by at least
the §7.3 Option A edit. `check:artifacts` cannot see this: it compares working
`dist` to committed `dist`, so it only ever fires for the lane that happens to
run a build. A rebuild emits 20 drifted tracked files across
`requirements/`, `compatibility/`, `admission/`, `activation/` and
`domain/blueprint/src` — 15 of them not this lane's source — so a rebuilt
surface cannot be scoped to this PR without sweeping other lanes' unbuilt
source into it. Surface reverted; the integrator has to decide who carries it.
