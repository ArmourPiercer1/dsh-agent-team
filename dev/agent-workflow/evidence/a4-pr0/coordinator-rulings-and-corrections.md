# Owed record-keeping — coordinator-owned, to be committed on the next branch I own

Status: **untracked scratch by design.** Written in the A4-PR0 round because the coordinator may not write
`graph.yaml` / `SESSION_ROUTER_LOG.md` / plan ticks while the PR0 writer owns that branch
(1 task = 1 branch = 1 writer). Fold these into PR1's record-keeping commit (or a docs-only PR if PR1
needs to stay clean), then delete this file.

## 1. PR #65 — MERGED into master @ `5d646bd2` (2026-10-06T20:13:44Z)

Branch `fix/a4pr0a-typecheck-clean`, 2 files (+52/-17), no production source, no dist.

- The A4-PR0a guard test merged in #64 carried **27 `noUncheckedIndexedAccess` errors** and no gate could
  see them, because **no configured gate in this repo runs a typechecker**: `build` = `pnpm -r run build`
  = `tsc -p tsconfig.build.json` with `include` = `src` (runtime additionally names 21 lane dirs,
  **not** `governance`), so a module nothing in `src/**` imports is never typechecked; the package project
  used by `typecheck` (`packages/runtime/tsconfig.json`, include `['src','test','vitest.config.ts']`)
  reaches a new lane module only transitively through its own test import, and only if someone runs it;
  vitest transpiles without typechecking. This is the shape of every Alpha.4 module until the PR that
  wires it, so the hole was about to be structural.
- Fix: `group()` narrowing instead of casts (a lost capture group means the extraction pattern drifted =
  silently lost coverage, so it throws); **new C1c** asserting every closed-registry member resolves
  (eslint caught that I harvested `unresolvedRegistries` and never asserted it); header note that the
  guard resolves tracked paths from the repo root, so a per-package invocation fails loud rather than
  passing on an empty file set.
- **Plan gate rule 10 added**: every PR0a/PR0/PR1–PR7 gate also runs `pnpm -r run typecheck` plus
  `pnpm exec eslint <changed files>`.
- Evidence: `pnpm -r run typecheck` GREEN across all packages (27 → 0 in runtime); eslint clean; the two
  `a4pr0a-*` files **14 passed**; full root suite normalized = **25 identities = the 23 citable baseline
  + exactly the two named-flake `p6t1-parallel`** entries → only-downward holds.
- Authorization note: merge authority in `user_rulings (4)` names the docs PR and A4-PR0a…PR7. #65 is a
  test/gate-hygiene follow-up to PR0a, not a row in the plan's merge-order table; it was merged under the
  standing instruction to execute the plan without stopping for step approval, and is recorded here as
  derived rather than enumerated authority.

## 2. ADR correction owed — A5-13's citation points at the wrong directory

A5-13's **rule stands**: key-omitted optionality is required for the PR0 proposal record, because
`undefined` is not a `RemoteSafeJsonValue` and the ledger validator rejects it. Its citation did not
resolve: it says `packages/storage/repositories/ledger.ts:202,206`. Verified truth (line numbers were
right, directory wrong):

- `packages/storage/schema/ledger.ts:202` — `payload: assertPlainRecord(record['payload'], 'payload')`
- `packages/storage/schema/ledger.ts:206` — `assertRemoteSafeJsonValue(result)`
- `packages/contracts/src/remote-safe.ts:70` — `export function assertRemoteSafeJsonValue(...)`; its
  header comment names `undefined` explicitly among rejected values; `RemoteSafeJsonValue` (same file,
  :26) is a closed union that excludes `undefined`, and `RemoteSafeRecord` (:23) is
  `{ [key: string]: RemoteSafeJsonValue }`.

Stronger rationale to write into A5-13 while editing: `:206` validates the **deserialized** record as
well, so a key explicitly set to `undefined` would be silently *absent* on read-back rather than loudly
rejected — silent field loss, which is a better argument for key-omitted optionality than the one on
paper. Apply in place per Global Precedence rule 3 (the implementer executes from that section).

## 3. A5-19 reconfirmation owed — a repeated false `node:` premise

An implementer asserted during PR0 that "no `node:`-builtin exception exists for `packages/**/*.ts`
(only `.mjs`)" and proposed to encode that as a code comment. Measured: non-test `.ts` importers of
`node:` builtins are `packages/runtime/artifact-read/digest.ts:25` (`createHash` from `node:crypto` —
a production lane module) plus four in `packages/client/vitest.config.ts` (build config). The eslint
config grants node *globals* to explicit `.mjs` globs, which is not a ban on explicit `node:` imports in
`.ts`. The decision (no digest helper in PR0; `caseFingerprint` caller-supplied) was kept on its correct
reason — spec §8.4 assigns fingerprint computation to PR5 and A5-13 freezes `caseFingerprint` as an input.
Add to A5-19 so the premise does not have to be re-refuted in PR5.

## 4. Facts for the PR1 brief (measured, saves the next implementer a survey)

- `pnpm-workspace.yaml` globs `packages/*` only, and `packages/domain` is **one package** whose lanes
  (`blueprint/ policy/ compatibility/ lifecycle/ member/`) are plain subdirectories. A new Alpha.4 lane
  `packages/domain/authority-envelope/` is a lane directory, not a package.
- `packages/domain/tsconfig.build.json` include = `["src"]`; `packages/domain/tsconfig.json` include =
  `['src','blueprint/src','policy/src','test','vitest.config.ts']`. So PR1 must add `authority-envelope/src`
  to **`tsconfig.json` include** or the lane is only ever typechecked transitively via a test import.
- Tests belong in `packages/<pkg>/test/` (vitest include is `packages/*/test/**/*.test.ts`); a lane-local
  `test/` directory is never collected. `packages/domain/test/` has 26 files today.
- `packages/runtime/tsconfig.build.json` include lists 21 lane dirs and **omits `governance`** — that is
  why PR0 must produce no dist drift, and why PR1's `runtime/governance/authority-ceiling.ts` likewise
  emits nothing until something in `src/**` imports it.
- A3-9's two PR1 follow-ups, verified: `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts:118`
  has `const roots = ['runtime', 'tools', 'remote', 'client']`, so a new `packages/domain` lane is
  **invisible to the test that polices lane edges** until `'domain'` is added there; and the lane dir must
  enter `packages/domain/tsconfig.json` include. A3-9 names both as PR1's, and `PermissionResourceMatcher`
  at `packages/runtime/governance/permission-mutation.ts:272-276` (`exact | subtree | fingerprint`, each
  with `resource`) is the runtime shape that becomes an adapter, not the shared grammar.

## 5. Coordinator rulings issued during PR0 (both are ordering holes in my own contract)

**Ruling 1 — `requiredAuthority` (2026-10-06/07, sent to the PR0 writer).** A5-13 and plan line 872 freeze
PR0's record with `requiredAuthority`, and the spec types that field `RuntimeAuthority` (spec:274, :281,
:619) — but `RuntimeAuthority` is **produced by PR2** (plan line 212, PR2 "Interfaces: Produces"). Measured:
`RuntimeAuthority` and `human-admin` each have **zero non-test occurrences**; no actor-role vocabulary
exists to reuse. Neither A5-13 nor plan line 872 actually states a type for the field (only
`baseGeneration: number` and `baseSnapshotId: string | null` are typed), so this is a gap, not a
contradiction. Ruling: PR0 declares `ProposalAuthorityPosition = 'member' | 'leader' | 'human-user' |
'human-admin'` in `proposal-store.ts` — exactly those four literals, a test pins the closed set, **no
ranking and no comparator in PR0** (ranking is PR2's evaluator, and PR2's lane-A ceiling matrix is the
backstop that must precede the algebra; a PR0 comparator would leave it with nothing to backstop). PR2's
`RuntimeAuthority` must be definitionally identical and must import or alias this union; a second divergent
ladder type is a plan change. Record against `tasks.a4_pr0` as a PR0 disclosure for PR2, and add one line to
A5-13 naming the durable-vocabulary split.

**Ruling 2 — `authorityEnvelopeAst`, same class, and ADR A3-9 already owns the pattern.** The shared grammar
module lands in `packages/domain` at PR1, so PR0 cannot import its AST type either. Ruling: PR0 declares the
AST **structurally** per A3-9's frozen Blueprint/config shape `{ kind, path | fingerprint }` (A3-9's rationale:
that shape is bound into the Blueprint `contentHash`, so any other shape silently rewrites every existing hash
and violates A2-11), interprets nothing, and PR1 adds a compile-time mutual-assignability test between the
domain grammar and PR0's structural twin — the identical pattern A3-9 mandates for the effect vocabulary
(structurally re-declared in `packages/domain` with mutual assignability against `PermissionOverlayEffect`,
because there must be no `domain → storage` edge).

**Canonical effect vocabulary, verified:** `packages/storage/schema/permission-overlay.ts:127-130` —
`PERMISSION_OVERLAY_EFFECT_VALUES = ['allow', 'ask', 'deny'] as const`, with `PermissionOverlayEffect`
derived from it; `packages/runtime/permission-governance/types.ts` merely re-exports it, so PR0's
`desiredEffect` imports the canonical one (runtime → storage is legal; the ban is domain → runtime/storage).

**Also true and worth keeping:** A5-13's *rule* is sound but its citation named the wrong directory (section 2 above), and an implementer re-derived the false "no `node:` builtins in `packages/**/*.ts`"
premise that A5-19 already refuted (section 3). Two of the three corrections in this file are corrections
of my own documents, which is the argument for executing RED before trusting static inference.

## 6. PR1 pre-flight (measured on `5d646bd2`, so PR1's writer does not re-survey)

**Blueprint v3 is additive-safe, with three in-repo precedents for hash-stable key omission.** The content
hash is computed over an explicit hand-built projection — `toHashableBlueprint` (`validate.ts:1509`) →
`deriveContentHash` (`blueprint/src/hash.ts:178`) — not over the raw document, so a v3-only field cannot
leak into a v1/v2 hash unless the projection is edited to pass it through:

- `toHashableCapabilities` (`validate.ts:1617`) builds a whitelist and already carries the pattern with its
  reason in a comment: *"Added only when present: absent → the key is omitted, so legacy alpha.1 blueprints
  hash byte-identically to before A1."*
- `toHashableEnvelopeMatcher` (`validate.ts:~1672`) emits exactly `{ kind, fingerprint }` or
  `{ kind, path }`, and its comment states the rule: each branch is a single object literal with **no
  shared-union `path?: undefined` members**, because the hashable record forbids `undefined` and the hash must
  bind to the *declared* identity. This is A3-9's shared AST **already shipped**, and it is the shape PR0's
  structural twin and PR1's shared grammar must match.
- `toHashableQuota` uses `stripUndefined(...)`.

**The canonical AST, verbatim from `packages/domain/blueprint/src/types.ts:330`:**

    export type BlueprintPermissionMutationEnvelopeMatcher =
      | { readonly kind: 'exact'; readonly path: string }
      | { readonly kind: 'subtree'; readonly path: string }
      | { readonly kind: 'fingerprint'; readonly fingerprint: string }

with the enclosing rule (`types.ts:314-322`) `{ operationClass: string; matcher; maximumEffect: 'allow' |
'ask' | 'deny' }`, and the documented semantics that the **operation class picks the legal variant**: FILE
class pairs with `exact`/`subtree` (a workspace `path`), SHELL class (`bash`/`pwsh`) pairs with
`fingerprint` ONLY — verbatim canonical operation identity, no subtree, no `any`, no path. So the runtime
`PermissionResourceMatcher` (`governance/permission-mutation.ts:272-276`, `{ kind, resource }`) really is the
odd one out, exactly as A3-9 says, and PR1's adapter direction is resource → canonical path.

**The validator is already version-gated, which is where v3 plugs in.** `validate.ts:333` reads
`schemaVersion === 2 ? BLUEPRINT_TEMPLATE_FIELDS_V2 : BLUEPRINT_TEMPLATE_FIELDS`, and closedness is enforced
by `assertNoUnknownFields` at **18 call sites** in that file. PR1 therefore extends the version→closed-field-set
mapping (a ternary becoming a table is the natural shape) rather than adding fields to a shared set — a v3
field must stay unknown-rejected for v2 documents, and the existing ternary is the seam. `types.ts` is where
the v3 types join; `blueprint/src/index.ts:59` shows how the v2 matcher type is exported.

**Carried from A3-9 and verified (do not skip):** the new lane dir must enter `packages/domain/tsconfig.json`
include, and `'domain'` must be added to the lane-hygiene roots at
`packages/runtime/test/a3p3-governance-lane-hygiene.test.ts:118` — without that, the new domain lane ships
with no import-edge coverage and nothing goes red.

## 7. Process lesson for the coordinator (recorded because it nearly cost a task)

In round 8 I estimated the PR0 writer had been running "~100 minutes" from the **number of goal rounds** and
stated a contingency to `interrupt_agent` it and take over. In round 9 the actual clock (`date`, plus the
branch reflog: created `04:10:57`, rebased `04:18:10`, then `now 04:22:56`) showed it had been running about
**11 minutes** and was behaving normally — heavy reading, an obedient rebase, then generating. Elapsed time
must be read from `date` / reflog / mtimes, never inferred from round count; goal rounds are not time-spaced.
A wrong time model was about to kill a healthy writer mid-flight, and the "1 task = 1 writer" rule would have
made the takeover costlier than the wait.
