# A4-PR7 Task 7.3 — the v3-only cutover: measured blast radius, and why the flip is not in this branch

Written by the A4-PR7 writer at `55482e4d` (branch `feat/a4-pr7-v3-cutover`).
**The flip is NOT executed here.** Everything below is measured on this tree, not
carried from the pre-flight; where the plan's numbers differ, the measurement wins
(plan X10: a count in a document is not the contract).

## 1. Status against the plan's own 7.3 checklist

| item | status |
| --- | --- |
| `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]` + narrow `types.ts:416` to `3` | **NOT DONE** — dry-run measured, see §2; the tree it produces is 77 files red and the fixture work that pays for it is Task 7.4, which this lane could not complete. |
| record the blast radius honestly, by path | **DONE** — §3, sets written to `.scratch/gates/7-3-set*.txt` (promote at 7.6). |
| compatibility-by-subject tests deleted or inverted, never retargeted | **NOT DONE** — depends on the flip; the canonical sites are named in §4 so the next writer starts from evidence, and §4.1 records that two of the plan's four "re-pin" sites are actually *delete-or-invert* sites. |
| delete the transitional v1/v2 authorization branches + the A1-18 aliases | **NOT DONE** — the alias deletion needs 7 test files and the lane-hygiene pin, and the branch deletions are outside Task 7's `Files:` rows. Sites in §5. |
| re-pin the golden contentHash literals | **NOT DONE** — sites confirmed in §4.1. |

## 2. The dry run (measured, then reverted)

Both constants were flipped (`schema.ts:75` → `[3]`, `types.ts:416` → `3`), the repo
typechecked, and the files restored. **`pnpm -r run typecheck` produced exactly 5
errors, all in `packages/runtime`, all of the same kind** — the narrowing proves
these comparisons dead:

```
packages/runtime/activation/provider.ts:821            TS2367 '3' vs '2'
packages/runtime/admission/requirement-gate.ts:460     TS2367 '3' vs '2'
packages/runtime/compatibility/blueprint.ts:81         TS2367 '3' vs '2'
packages/runtime/requirements/creation-preflight.ts:217 TS2367 '3' vs '2'
packages/runtime/requirements/scope-requirements.ts:108 TS2367 '3' vs '2'
```

Receipt: `.scratch/gates/7-3-dryrun-typecheck.txt`. Restore proof: `git status
--porcelain` empty afterwards (the first attempt at restoring used `git checkout`
against an in-flight tree — recorded in `7-2-START-ENTRANCE-ENUMERATION.md` §5; this
time the reverse edit was applied from the recorded strings and verified against
HEAD).

The five files are **not in Task 7's `Files:` rows**. Whoever flips needs them, plus
whatever the compiler cannot see (the fixtures, below). That is a `Files:`-list gap
to resolve before the flip, not after.

## 3. The blast radius, by path (re-derivable in one command)

Predicate: a tracked file (excluding `dev/agent-workflow/evidence/`) that keys
`blueprintId` **and** carries a `schemaVersion: <digit>` literal.

```
git ls-files -z | xargs -0 grep -ln "schemaVersion: [12]" | xargs grep -l blueprintId
```

| measure | value | the plan's pre-flight |
| --- | --- | --- |
| files carrying a v1/v2 Blueprint-shaped literal | **217** | 110 at `11e1609c` |
| of those, files that call `parseBlueprint` / `validateBlueprintDocument` / `inspectBlueprintSource` (turn **red**) | **77** | 39 |
| of those, files that only carry typed/inline literals (stay **green while lying**) | **140** | 71 |

By area (red count / total): `packages/runtime` 44/111, `packages/domain` 11/14,
`packages/testkit` 4/5, `packages/contracts` 3/5, `packages/storage` 3/3,
`tests/kits` 3/14, `docs/plans` 3/4, `packages/client` 1/14, `packages/legacy` 1/2,
`packages/tools` 1/5, `scripts/blueprint-authoring.mjs` 1/1, plus `docs/INSTALL.md`
and `dev/agent-workflow` (prose). Full lists: `.scratch/gates/7-3-setA-refined.txt`,
`7-3-setB-red-refined.txt`, `7-3-setB2-noparse-refined.txt`.

The fence's own narrower scope (Task 7.5's predicate) is **20 files / 49 sites**, and
each is on the deferral list in
`packages/testkit/test/a4p7-blueprint-version-clean.test.ts` with its owning lane —
that list is the machine-checked version of this section's tail, and it fails in both
directions.

Not measured here: the number of failing *tests* under the flip (a full-repo run with
the flip live was started and killed by the sandbox once; the cheap version is to
flip the two constants and run `npx vitest run packages/domain packages/runtime`).
Stated as unmeasured rather than estimated.

## 4. What the 77 red files are, and what the plan demands of them

Two kinds, and the plan treats them differently:

1. **Compatibility-by-subject** — the test's subject *is* "a v1 document parses" or
   "a v2 document parses". Canonical: `packages/domain/test/blueprint-v1-frozen-resume
   .test.ts:52-60`, `packages/domain/test/t2-blueprint-v2-hash.test.ts`,
   `t2-blueprint-v2-requirements.test.ts`, `packages/runtime/test/persona-requirement
   -v2.test.ts`. Rule: **become a migration-required contract test, or be deleted**.
   Retargeting them at a v3 fixture under the same name is forbidden — it converts a
   retired contract into a false green.
2. **Live fixtures** — the document is incidental, the behaviour is the subject. Rule:
   migrate to v3 **with an explicit `teamHardEnvelope`** whose Team Hard rules preserve
   that fixture's intended pre-Alpha.4 permissions ("choosing Team Hard rules that
   preserve each fixture's intended permissions rather than an unbounded
   approximation" — Task 7.4). This is the bulk of the cost, it is per-fixture
   judgement, and it does not compress.

### 4.1 The golden contentHash sites, confirmed at this base

| site | what it is | the right verb |
| --- | --- | --- |
| `packages/domain/test/a4p1-blueprint-v3-governance.test.ts:265` (`V1_GOLDEN_HASH`, asserted `:425-426`) | the hash of a **v1 document** | **not re-pin** — the arm parses a v1 document, which cannot exist post-flip: delete or invert (§4 kind 1). |
| same file `:267` (`V2_GOLDEN_HASH`, asserted `:427-428`) | the hash of a **v2 document** | same. |
| `tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs:460` (`V1_ANCHOR_HASH_PRE_PR_E`, used `:2254-2257`) | the anchor hash of a v1 kit fixture | **re-pin** when the kit fixture migrates (it is on the fence's deferral list). |
| `tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs:389` | the same literal, second copy | **re-pin**, in the same edit as the first (two copies of one anchor). |
| `packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts:2114-2115` | golden hash of the bytes a **builder** emits (self-comparing against emitted bytes) | **re-pin only if that builder's fixture bytes move**; it is not a v1-document hash, so the plan's grouping here is looser than the site. |

## 5. A1-18 aliases and the transitional branches (measured sites, not done)

The two alias declarations: `packages/runtime/governance/permission-mutation.ts:605`
(`PermissionEnvelopeRule = AuthorityEnvelopeRuleDocument`) and `:613`
(`PermissionMutationEnvelope = AuthorityEnvelopeDocument`). Source files referencing
them (9): the same file, `governance/{index,service,types}.ts`,
`src/plugin/permission-plane.ts`, `packages/domain/blueprint/src/{types,index,validate
}.ts`, `packages/domain/authority-envelope/src/index.ts`. Test files referencing them
(7): `a3p3-governance-lane-hygiene`, `a3p3-permission-mutation-authority`,
`a3p3-revoke-reveal-semantics`, `a3p4-permission-lifecycle-e2e`,
`a3p4-r4-authority-binding`, `a3p5-permission-notification-lane-hygiene`,
`a4p1-authority-envelope`. (`packages/runtime/dist/**` also matches: build output,
regenerate, never edit. The plan's "16 files" is a pre-cutover count and the plan says
so.)

Two scoping findings the flip-lane needs:

- `packages/domain/blueprint/src/types.ts` `BlueprintPermissionMutationEnvelope{,Rule,
  Matcher}` are **not** bridge aliases: they type the live `permissionMutationEnvelope`
  document field (the Leader ceiling), which survives v3 alongside `teamHardEnvelope`.
  The aliases *there* are the other way round (`BlueprintAuthorityEnvelope*` at
  `:348-352` are the new names). Deleting the `Blueprint…` family would delete the
  name of a live concept.
- The transitional *behaviour* branches the compiler proves dead are the five `=== 2`
  comparisons in §2; `pre-execute-adapter.ts` and the two "pre-v3 means covered"
  branches in `approval-routing.ts` are additionally unreachable once the type
  narrows, and both files are outside Task 7's `Files:` rows.

## 6. `leaderEnvelopeCoverage` (Task 7.5's one deletion) — measured, not done

Defined at `packages/runtime/governance/permission-mutation.ts:1368`, called at
`:1339` (inside `authorizeLeaderPermissionMutation`). **No production caller**: the
only references outside that file are `packages/runtime/test/a3p3-revoke-reveal
-semantics.test.ts` (its import and five calls), `packages/runtime/test/a3p4-r4
-authority-binding.test.ts:44,472` (a whole describe block), and
`packages/runtime/test/a4p2-dual-envelope-mutation.test.ts:334` (a source-shape pin
that locates the symbol by text). So the aggregate is already unwired — which is what
makes the deletion cheap — but it is a **test-surface** change in three files outside
Task 7's `Files:` rows, and `effectiveAuthorityCeiling()` / `narrowingForApproval`
must stay (Task 7.5 names them explicitly).

## 7. Carried-open items this lane owes the coordinator

1. **Remote v8 catalog gap** (from Task 7.1): `s6-remote.ts:2398-2415` builds the
   catalog payload as `{blueprintId, revisions}` with no `migrationRequired`, and
   `packages/remote/src/handlers/ports.ts:51-56` receives no protocol version, while
   `p8t3-version.test.ts:62-90` pins byte-identity. Migration discoverability is real
   in-process and unavailable over the wire until this is adjudicated. Needs a
   ruling, not a workaround.
2. **`TEAM_START_GOVERNANCE_*` vs the document codes** (from Task 7.2):
   `BLUEPRINT_MIGRATION_REQUIRED` is not wire-representable today; the designed wire
   arm is PR6's closed fourth governance arm, wired by flipping `bridge` in
   `host.ts`'s `createGovernanceWarningService` call at the same time as §2's flip.
3. **`Files:`-list gaps** to widen before the flip: the five `=== 2` files (§2),
   `activation`/`admission`/`compatibility`/`requirements` as a set, the A1-18 test
   files (§5), and the three `leaderEnvelopeCoverage` test files (§6).
4. **`clsx`** (Task 7.5's composition leg): `pnpm add clsx --filter
   @dsh-agent-team/client` cannot run in this sandbox (pnpm cannot open its store
   index outside the writable workspace; approval prompts are disabled). The
   manifest and lockfile were deliberately left untouched — a hand-edited
   `pnpm-lock.yaml` would look done and break `--frozen-lockfile`. Consequence:
   `pnpm smoke:composition` was NOT run, so nothing here claims the A1.2.7 leg is
   passable.
