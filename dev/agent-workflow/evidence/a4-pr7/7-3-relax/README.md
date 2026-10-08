# A4-PR7 §7.3 Option A — the grammar made version-agnostic (pre-flip)

**Branch** `feat/a4-73-grammar-version-agnostic` · **base** `27ef3afc51d60818fa7acf189407ca1e9a019da6`
(`origin/master` at fetch time; `git rev-parse --short` = `27ef3afc`) · **not pushed** (coordinator merges).
**Spec** `dev/agent-workflow/evidence/a4-pr7/7-3-decision/Dossier.md` (Option A). **CORE PATCH BUDGET 0 — no upstream file touched.**

## VERDICT

Option A landed, pre-flip, as 2 commits. 6 files / 6 lines relaxed. The version set is
**not** flipped: `schema.ts:75` is still `[1, 2, 3]` and `types.ts:416` is still `1 | 2 | 3`
(both re-read from disk, not quoted). Both §7.3 instruments the dossier had to write by
hand are now committed tests, and both go red under the mutations that define them.

## 1. The relaxation surface — 6 files, not 7

The brief asked for "the five production gates + the test mirror + whatever the dossier's
7th file is". **The dossier's 7th file is not a relaxation site.** Its Option-A row reads
"`7 files, 7 lines (2 flip + 5 gates)`": 5 gates **+ the two flip files**
(`schema.ts:75`, `types.ts:416`). Both flip files are excluded by this task's own hard
constraint. The test mirror is not inside the dossier's 7 either — §2.1 counts it among the
18 test/helper files, and §5 lists it separately as the "1 mirror" residual ("it must widen
with the gate"). So a pre-flip Option-A commit is **6 files / 6 lines**, and no 7th
relaxable site exists. The surface was re-derived, not copied: an exhaustive grep of every
numeric `schemaVersion` comparison in production finds the §E.2 grammar gated at exactly
those 5 places. The other numeric comparisons are **different `schemaVersion` namespaces**
and were left alone — `projection/service.ts:92`, `projection/fold.ts:94,106`,
`contracts/projection/*` (projection envelope), `storage/repositories/member-instances.ts:205`
+ `runtime/src/plugin/host.ts:2539` (member-instance record), `permission-plane.ts:972`
(the Alpha.3 existential ceiling branch), `legacy/session-reader/format.ts:298` (legacy).
The parse/validate plane already accepts the grammar at v3 (`validate.ts:385,:1280` are
`>= 2`; `:1211` has an explicit `=== 3` arm over `BLUEPRINT_TOP_LEVEL_FIELDS_V3`, which
*derives from* V2) and the identity plane already hashes it (`:1571`), which is the whole
reason Option A is a 5-site change rather than a redesign. Every `.templates[...]` reader
in `src/plugin/root.ts` (`:1208, :1278, :1347, :1732, :4154`) and
`admission/requirement-gate.ts:704` was already version-agnostic.

| # | site | before | after |
| --- | --- | --- | --- |
| 1 | `packages/runtime/compatibility/blueprint.ts:81` | `if (blueprint.schemaVersion === 2 && blueprint.teamRequirements !== undefined)` | `if (blueprint.teamRequirements !== undefined)` |
| 2 | `packages/runtime/requirements/scope-requirements.ts:108` | `if (blueprint.schemaVersion === 2) {` | `{` (per-template presence check inside decides) |
| 3 | `packages/runtime/requirements/creation-preflight.ts:217` | `if (blueprint.schemaVersion === 2) {` | `{` (`inputs.templates` is the shape) |
| 4 | `packages/runtime/admission/requirement-gate.ts:460` | `if (blueprint.schemaVersion === 2) {` | `{` (same) |
| 5 | `packages/runtime/activation/provider.ts:821` | `blueprint.schemaVersion === 2 ? scopeInputs.templates[createTemplateId] : undefined` | `scopeInputs.templates[createTemplateId]` |
| 6 | `packages/runtime/test/requirement-d1-d3-decision-scoping.test.ts:890` | `world.templateReadSource !== undefined && bp.schemaVersion === 2` | `world.templateReadSource !== undefined` |

Behaviour-preserving for v1/v2: a v1 document cannot carry `teamRequirements` (v1 closed
field set, `validate.ts:1211`) and declares no template requirements, so every shape test
is false there and the block stays inert exactly as the digit made it. The plain-block form
(3 sites) was chosen after measuring the lint ruleset: `no-lone-blocks` is **inactive** in
this flat config while `no-constant-condition` is **active**, so `if (true)` would have
been a new lint error.

## 2. Mutation table (the whole point)

| mutation | what it is | files red | test titles red |
| --- | --- | --- | --- |
| **M1-gate** | revert relaxed gate #2 (`scope-requirements.ts`) to `=== 2`, one line | `a4p7-v3-grammar-enforced.test.ts` **only** | `the template scopes EXIST at v3 only for templates that declare requirements`, `the template-scope inputs carry the declared requirement ids` |
| **M2-hashomit** | `toHashableBlueprint` omits `teamRequirements` when `schemaVersion === 3` (`validate.ts:1571`), the dossier's M1 | `a4p7-v3-identity-binds-grammar.test.ts` **only** | `a declared teamRequirements puts the key into the hashable projection`, `the hash changes when a requirement flips complete true -> false`, `the hash changes when a requirement subject changes`, `the hash changes when a requirement id changes` |
| **GREEN baseline** | all mutations restored from git | — | **54 files / 798 tests passed, vitest_exit=0, 0 failing titles** |

Both mutations were run against the **full 54-file universe**, not just the twins, and the
set of failing *files* was taken from `FAIL` lines: under M1 and under M2 it is **exactly one
file — a twin**. The 52 pre-existing files stay green under both. That is the finding, not a
caveat: **reverting the relaxation, or dropping the grammar from the v3 hash, is invisible to
the entire pre-existing suite**, because the corpus is empty at v3 (dossier census: 0 of 2276
parses carry the grammar at v3). Before this branch the witness count was 0; it is now 1 per
plane. Transcripts: `RUN-M1-GATEREVERT-raw.txt`, `RUN-M2-HASHOMIT-raw.txt`,
`RUN-GREEN-AFTER-MUTATION-raw.txt`, `RUN-M2-hashomit-twins.txt`.

Restore is always `git checkout HEAD -- <path>` **first**, then apply (`scripts/mutate.sh`) —
the deliberate fix for the dossier's own failure #4 (a half-applied probe that made a "B run"
silently be a second A run).

## 3. Instruments that lied here (see FINDINGS.md §"lied")

Shortest version: `git diff origin/master` reported that I had edited the two
coordinator-owned files. I had not — `origin/master` moved to `b678db5b` (PR #160) mid-session
and the diff was the inverse of the coordinator's own commit. Caught by diffing against my
real merge-base `27ef3afc` and by `git log HEAD..origin/master`.

## 4. Battery

See `FINDINGS.md` for literal outputs. Summary: version-clean twice byte-identical
(md5 `5119cbf3…`, both exit 1 — the dirty set is 7.4's, not mine) with all four gating
numbers unchanged from pristine; universe 52/777 at base → 54/798 here with per-file counts
identical for all 52 shared files; a4p7-blueprint-version-clean 60, p4t6 10, classification
54, merge-gate 26 (1 leg refuses identically at base: no `pnpm build` in the worktree);
typecheck exit 0 / `0 × error TS` under **both** invocations on both trees; lint `new 0,
resolved 0`.

**One tracked number moved**: `scanned-in-scope: 751 → 753`, and `p4t6`'s derived total
`1029 → 1031`. Cause: the two twin files are new **tracked** files inside the scan's
`packages/**/test/` scope — unavoidable when the twins land in their proper packages. The
four *gating* numbers (`dirty`, `unknown`, `advisory`, `refused`) and `prose`/`adjudicated`
did not move. `p4t6` is therefore **not blob-identical to master's**; it carries only the
derived list, the two sum terms, the by-path entry and the movement tie.
