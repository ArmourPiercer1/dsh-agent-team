# Alpha.3 PR1 — PermissionOverlay Foundation (DRAFT)

## 1. Purpose

Create the **durable permission overlay infrastructure** and nothing else
(implementation plan `PR1: PermissionOverlay Foundation` → *"Goal: Create
durable permission overlay infrastructure."*).

Concretely this PR adds:

* the **`PermissionOverlaySnapshot`** record with the four ADR §2 sections —
  `identity {teamSessionId, memberInstanceId}`, `state` (the overlay rule set),
  `metadata {generation, previousSnapshotId}`,
  `provenance {actor, mutationId, timestamp, reason}`;
* the **repository port** the future `GovernanceMutationService` will be wired
  against, exposing `append` / `latest` / `history` and nothing else, with the
  ADR §1 non-responsibilities enforced by construction and by pinned tests —
  it is **not** an alternative write path;
* the **durable append-only FULL-snapshot schema**: current authority = the
  **highest generation** snapshot read directly, `history` is **audit only**,
  and **no event replay** is used for execution (ADR §2);
* **generation / `previousSnapshotId` / provenance validation at the
  persistence boundary** — *structural only*; semantic authority (envelope
  coverage, lane-expansion permission, actor authorization) stays with the
  future PR3 `GovernanceMutationService`;
* **append with generation CAS-style conflict detection**: two appends racing
  on one generation produce exactly one durable snapshot, the loser gets a
  **typed conflict**, an occupied generation is **never overwritten**, and rows
  are **never deleted**.

> **Runtime dynamic permission execution is NOT enabled by this PR.**
> Nothing here is wired into a tool, a remote method, a control request, an
> admission path or a lifecycle transition, and no build/composition include
> list changed (so `pnpm build` output and the committed `dist` / composition
> artifacts are untouched). PR1 makes the durable foundation exist and be
> tested; the capability is not switched on. The single write path stays the
> single write path: when PR3 lands, the chain remains
> `Leader/Human request → GovernanceMutationService → this port → durable store`.

## 2. Governing documents (local authoritative copies; hashes pinned here)

Read in full and size + sha256 verified before any implementation was written
(and re-verified afterwards). `docs/plans/active/` is gitignored, so these
documents live in the primary checkout and are not in the diff. **The hashes
below are of those LOCAL copies — no cross-source byte-identity against any
other copy is claimed.**

| document | bytes | sha256 |
| --- | --- | --- |
| `docs/plans/active/dsh-agent-team-alpha3-permission-governance-ADR-revised.md` | 4282 | `1af9899c30533a8bc4151b4bf0ab9527563c91c56f655b414f94896b88fcbf57` |
| `docs/plans/active/dsh-agent-team-alpha3-permission-governance-design-revised.md` | 3731 | `cb916ce33fb61741adbe811828e5a6ab1411e7c7604071ce9e7557e141e022e6` |
| `docs/plans/active/dsh-agent-team-alpha3-permission-governance-implementation-plan-revised.md` | 2959 | `2d4c0d44a7feca238a8e469dfb63db9897ea1fd2a618baeda2b41306a9bd4a7b` |

Authority order used: upstream public contract → the 20260829 frozen four →
`docs/plans/active/` (the three docs above) → `docs/ROUTER_RULES.md` →
`docs/TEST_METHODS.md` → `docs/migration/` → legacy code (evidence only).

## 3. Strict scope

**Added (new files only):**

| file | role |
| --- | --- |
| `packages/storage/schema/permission-overlay.ts` | the ADR §2 record: closed section field sets, contracts grammars, derived `snapshotId`, canonical serialize/deserialize, the durable placement constants (the **only** place the domain name is literalized) |
| `packages/storage/repositories/permission-overlays.ts` | the append-only snapshot store + `openPermissionOverlayStore` |
| `packages/runtime/permission-governance/types.ts` | re-export of the durable vocabulary for runtime consumers |
| `packages/runtime/permission-governance/port.ts` | the persistence-only port interface (ADR §1 prohibitions in the contract text) |
| `packages/runtime/permission-governance/overlay-repository.ts` | the thin adapter (deliberately does **not** re-implement the structural gate) |
| `packages/runtime/permission-governance/index.ts` | the package barrel |
| `packages/runtime/test/permission-overlay-helpers.ts` | fixtures + the per-case durable-world harness (fresh scratch dir per `it`) |
| `packages/runtime/test/permission-overlay-{append,latest-generation,restart-persistence,history-immutability,generation-conflict,validation,port-surface}.test.ts` | the seven specs (§4) |
| `packages/testkit/test/a3p1-team-domain-tenth-store.test.ts` | **added in the placement round** — 10 legs pinning the additive tenth store (compat open, byte-identical nine tables, one-time stamp bootstrap + idempotence, boot-entry parity, fresh-create ten stamps in canonical order, rows-without-stamp, a pre-existing missing stamp still named, tampered L1/L2, ghost file / missing pre-existing table, append + restart) |
| `packages/testkit/test/a3p1-seam-additive-tables.test.ts` | **added in the placement round** — 8 legs pinning the seam fidelity fix on BOTH sanctioned doubles (trailing addition opens empty at zero write cost and materializes on first write; prefix hole, ghost file, removed table and foreign version all stay loud) |

**Existing files modified.** The first round touched exactly one existing file
(the shared scan pin). The placement round — moving the store from the
withdrawn standalone domain into `team_domain` — necessarily touched the
TeamDomain declaration, its open path, both test doubles, and every existing
assertion that counts stamped stores. Each of those is a count or a path
following the tenth store, and one is a deliberate fidelity fix; nothing in
them changes a version policy or a durability rule:

| file | why it moved |
| --- | --- |
| `packages/storage/schema/stores.ts` | `permission_overlays` joins the declared set as the **tenth** store (`TEAM_DOMAIN_BASELINE_STORES` + `TEAM_DOMAIN_ADDITIVE_STORES`); `TEAM_DOMAIN_SCHEMA_VERSION` and `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS` **unchanged** at `2` / `[2]` |
| `packages/storage/repositories/team-domain.ts` | `verifyStamps()` — the nine baseline stamps verified exactly as before, plus the additive store's bootstrap-only-if-empty rule; shared by `openTeamDomain` and `createOrOpenTeamDomain`. `permissionOverlays` is deliberately **not** added to `TeamDomainRepositories` (zero production-path imports stay zero) |
| `packages/storage/schema/version-policy.ts` | prose only: "a new STORE is not a new VERSION", with the two upstream citations. The no-migration-for-versions rule is untouched |
| `packages/storage/schema/permission-overlay.ts` | placement constants retargeted to the TeamDomain store (`PERMISSION_OVERLAY_STORE`, `PERMISSION_OVERLAY_SCHEMA_VERSION = TEAM_DOMAIN_SCHEMA_VERSION`); the standalone domain's constants and seam spec are deleted |
| `packages/storage/repositories/permission-overlays.ts` | `openPermissionOverlayStore` opens the **`team_domain`** handle; port surface, CAS, conflict and row encoding unchanged (prototype methods still exactly `append`/`at`/`history`/`latest`/`store`) |
| `packages/runtime/permission-governance/{types,index}.ts` | the withdrawn `PERMISSION_OVERLAY_DOMAIN_NAME` re-export removed |
| `packages/testkit/fault-injection/file-seam.mjs` | **fidelity fix**: same-version trailing table additions open empty at zero write cost (matching the pinned upstream); prefix holes, ghost files and foreign versions stay `malformed-medium` / `version-mismatch` |
| `packages/storage/test/p4-helpers.ts` | the same fidelity fix for the `InMemoryStorageSeam` mirror (`isAdditiveTableExtension` replaces the table-set equality check) |
| `packages/storage/test/{p4-01-schema-meta,p4-07-durability-crash,bp1-blueprint-registry,rmr-create-or-open}.test.ts` | stamp counts / write bases 9 → 10 |
| `packages/testkit/test/p4t5-helpers.ts`, `p4t5-retry-restart.test.ts`, `p4t5-corrupt-version.test.ts` | `STAMP_WRITE_COUNT` 9 → 10; the committed fixture is a pre-Alpha.3 nine-store world, so its first reopen pays the ONE tenth-store stamp write — and "the next reopen is 0-write" is now pinned as its own leg |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | the shared file-count pin `908 → 922 → 924` (+14 first round, +2 placement specs). Zero new denylist vocabulary: the frozen quarantine hit set stays at fifteen occurrences; the scanner `.mjs` is unchanged |
| `packages/runtime/test/permission-overlay-*.test.ts` (6 of the 7) | placement legs + raw-row paths retargeted to `team_domain/permission_overlays.json`; port surface, CAS, restart and validation legs unchanged |

**Explicitly NOT added / NOT touched** (plan *"Do NOT add: - resolver logic;
- notification; - UI."* plus the coordinator's scope list): no resolver logic,
no notification, no UI, no `EffectivePermissionAssembler`, no
`GovernanceMutationService`, no `PermissionMutation`, no `MutationEnvelope`,
no grant/revoke/lifecycle, no inheritance. Untouched:
`operation-permission/` (the pure resolver), `effective-policy/`, `control/`,
`mutation/`, `governance/`, notification, the client projection / `TeamLedger`,
the recovery paths, `packages/runtime/src/**` (including the boot call site at
`host.ts:1531-1545` — it keeps calling `createOrOpenTeamDomain`, which now
also bootstraps the tenth stamp), the committed
`fault-injection/fixtures/committed-world` fixture (deliberately still the
nine-store pre-Alpha.3 world: it is the compatibility witness), and every
PR54/PR55/PR56 line.

`permission-overlay-port-surface.test.ts` pins that isolation four ways: the
port surface is exactly `append`/`history`/`latest`; no owned module imports a
resolver / assembler / governance-mutation / control / notification /
projection / admission / lifecycle module; the contract docstrings naming the
`GovernanceMutationService` as the mutation authority are asserted text; and
the store name is literalized in exactly one module
(`packages/storage/schema/stores.ts`), and the withdrawn standalone domain's
quoted literal appears nowhere in `packages/storage` or `packages/runtime`.

## 4. TDD — RED and GREEN, verbatim

All runs are offline, in this worktree, over the real file-backed
`StorageDomainSeam` double (`packages/testkit/fault-injection/file-seam.mjs`).
**No host, no port, no model, no provider, no key, no network.** Vitest 4.1.11.

### RED (the final spec set, implementation sources removed from the tree)

```
$ node_modules/.bin/vitest run \
    packages/runtime/test/permission-overlay-append.test.ts \
    packages/runtime/test/permission-overlay-latest-generation.test.ts \
    packages/runtime/test/permission-overlay-restart-persistence.test.ts \
    packages/runtime/test/permission-overlay-history-immutability.test.ts \
    packages/runtime/test/permission-overlay-generation-conflict.test.ts \
    packages/runtime/test/permission-overlay-validation.test.ts \
    packages/runtime/test/permission-overlay-port-surface.test.ts
[exit code: 1]
 Test Files  7 failed (7)
      Tests  no tests
```

Seven `Cannot find module` failures over exactly the two new module paths —
the capability does not exist yet. Evidence:
`dev/agent-workflow/evidence/alpha3-pr1-permission-overlay/red-run-2-final-specs.txt`
(`red-run-1.txt` is the earlier equivalent capture). The moved-out sources were
restored byte-identically (sha256 verified).

### GREEN

```
$ node_modules/.bin/vitest run <the same seven specs> \
    packages/testkit/test/p4t6-session-event-scan.test.ts
[exit code: 0]
 Test Files  8 passed (8)
      Tests  78 passed (78)
```

**7 spec files / 68 tests green** (the eighth file is the shared scan-pin test,
10 tests, re-run because this PR bumps its pin). Evidence:
`…/green-run-1.txt`. One spec per plan-mandated test, plus the two structural
proofs:

| plan test (`PR1 → Tests`) | spec | tests |
| --- | --- | --- |
| `append snapshot` | `permission-overlay-append.test.ts` | 8 |
| `latest generation` | `permission-overlay-latest-generation.test.ts` | 6 |
| `restart persistence` | `permission-overlay-restart-persistence.test.ts` | 5 |
| `immutable history` | `permission-overlay-history-immutability.test.ts` | 6 |
| `generation conflict` | `permission-overlay-generation-conflict.test.ts` | 8 |
| structural gate + its limit | `permission-overlay-validation.test.ts` | 31 |
| ADR §1 non-responsibilities | `permission-overlay-port-surface.test.ts` | 4 |

Persistence is **real**: every append is an atomic file write, and a restart is
a **new seam object + new store handle over the same directory**, never a
reused handle.

### Guard effectiveness (the tests actually bite)

`…/mutation-probe.sh` weakens **one** CAS guard at a time, runs the two specs
that should catch it, then restores the pristine source (byte-identical,
sha256 `2bf124a86e168c9e…`):

| weakened guard | tests that went RED |
| --- | --- |
| occupied generation no longer conflicts (silent overwrite) | `serializes two concurrent appends at one generation…`, `rejects an append at an already-durable generation…` |
| predecessor durability not checked (gaps legal) | `rejects a previousSnapshotId naming a snapshot that was never durable…`, `keeps one MemberInstance’s CAS independent of another’s` |
| durable-head check disabled (writes below the head legal) | `refuses a late append into a HOLE below the durable head…` |

### Other gates

```
(cd packages/runtime && ../../node_modules/.bin/tsc -p tsconfig.json)   [exit code: 0]
(cd packages/storage  && ../../node_modules/.bin/tsc -p tsconfig.json)  [exit code: 0]
node_modules/.bin/eslint <every new source + spec + the pinned test>     [exit code: 0]
```

The new sources are inside the typecheck program (reached from
`packages/runtime/test`, which `tsconfig.json` includes) and are deliberately
**not** added to `packages/runtime/tsconfig.build.json`'s include list, so no
build output changes.

### A contract-bound bug the max-length regression found (`9413fd36`)

A `snapshotId` is not free-form text: `permissionOverlaySnapshotKey` **derives**
it as `teamSessionId + '#' + memberInstanceId + '#' + generation`, while
`PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH` was a hand-set **256** and is the
bound the metadata gate applies to `previousSnapshotId`. For a legal
maximum-length identity the derived key is
`255 (SESSION_ID_MAX_LENGTH) + 1 + 37 (INSTANCE_ID_MAX_LENGTH = 'inst-' + 32) + 1 + 16 (String(Number.MAX_SAFE_INTEGER).length) = 310`
characters — so the bound sat **below the length of a key the store itself
produced**. Generation 1 appended; generation 2, whose `previousSnapshotId` is
generation 1's key, was **necessarily rejected**: a legal max-identity team
could never chain a second overlay generation.

RED (`snapshot-id-bound-red.txt`) — the required regression is a max-identity
chain of **two** generations, because a single append cannot see this:

```
 FAIL  packages/runtime/test/permission-overlay-append.test.ts > … chains TWO generations on a MAX-length identity (the snapshot-id bound must be derived)
TeamDomainError: PermissionOverlaySnapshot metadata.previousSnapshotId must be null or a non-empty string of at most 256 chars
 ❯ teamDomainError packages/storage/schema/errors.ts:98:10
 Test Files  1 failed | 7 skipped (8)
      Tests  1 failed | 8 skipped (9)
[exit code: 1]
```

GREEN (`snapshot-id-bound-green.txt`): the bound is now **derived from its
component maxima** (`SESSION_ID_MAX_LENGTH + 1 + INSTANCE_ID_MAX_LENGTH + 1 +
MAX_GENERATION_DIGITS`, documented as the 255+1+37+1+16 = 310 table in the
module), the ID format and grammar are unchanged, and the whole overlay surface
passes:

```
 Test Files  8 passed (8)
      Tests  79 passed (79)
[exit code: 0]
```

### The placement round (tenth TeamDomain store) — RED and GREEN, verbatim

RED first, honestly staged: the two new specs are untracked, so
`git stash push -- packages/` puts the production tree back on the
**nine-store** code while the new specs stay. Captured in
`additive-red.txt` (the stash is popped immediately after; `git status`
verified):

```
$ git stash push -m "a3p1-additive-red-probe" -- packages/
$ node_modules/.bin/vitest run packages/testkit/test/a3p1-team-domain-tenth-store.test.ts packages/testkit/test/a3p1-seam-additive-tables.test.ts packages/runtime/test/permission-overlay-append.test.ts packages/runtime/test/permission-overlay-port-surface.test.ts --reporter=dot
 ...
 FAIL  packages/testkit/test/a3p1-team-domain-tenth-store.test.ts > … createOrOpenTeamDomain (the production boot entry) adopts a nine-store medium the same way
AssertionError: expected 9 to be 10 // Object.is equality
 ...
 Test Files  2 failed | 2 passed (4)
      Tests  9 failed | 22 passed (31)
[exit code: 1]
```

GREEN, same command (no stash):

```
$ node_modules/.bin/vitest run packages/testkit/test/a3p1-team-domain-tenth-store.test.ts packages/testkit/test/a3p1-seam-additive-tables.test.ts packages/runtime/test/permission-overlay-append.test.ts packages/runtime/test/permission-overlay-port-surface.test.ts --reporter=dot
 Test Files  4 passed (4)
      Tests  31 passed (31)
[exit code: 0]
```

The whole permission-overlay surface (7 runtime specs + the 2 new testkit
specs = 9 files, 87 tests — the CAS / append / latest / history / restart /
validation behaviour retargeted onto the tenth table, unchanged):

```
$ node_modules/.bin/vitest run packages/runtime/test/permission-overlay-append.test.ts packages/runtime/test/permission-overlay-latest-generation.test.ts packages/runtime/test/permission-overlay-restart-persistence.test.ts packages/runtime/test/permission-overlay-history-immutability.test.ts packages/runtime/test/permission-overlay-generation-conflict.test.ts packages/runtime/test/permission-overlay-validation.test.ts packages/runtime/test/permission-overlay-port-surface.test.ts packages/testkit/test/a3p1-team-domain-tenth-store.test.ts packages/testkit/test/a3p1-seam-additive-tables.test.ts --reporter=dot
 Test Files  9 passed (9)
      Tests  87 passed (87)
[exit code: 0]
```

`tsc -p tsconfig.json` → exit 0 in `packages/storage`, `packages/runtime` and
`packages/testkit`; `eslint` over every changed `.ts`/`.mjs` → exit 0;
`node scripts/check-artifacts-committed.mjs` →
`OK: 1372 files` (no composition surface changed — the store has zero
production-path imports). The CAS mutation probe was re-run on this tree: three
probes, each caught by the pinned specs, source restored byte-identical
(`mutation-probe-additive.txt`).

### Full offline suite — parity against the pristine base

| tree | files | tests |
| --- | --- | --- |
| this branch (placement round) | 9 failed / 418 passed (427) | 19 failed / 4953 passed (4972) |
| this branch (first round) | 10 failed / 415 passed (425) | 20 failed / 4932 passed (4952) |
| pristine `1385f1ee` (this PR's files stashed out) | 9 failed / 409 passed (418) | 19 failed / 4865 passed (4884) |

At the placement round the branch's failing-file set is **identical, by
identity, to the pristine base's** (`diff` of the two sorted lists: empty —
`additive-fail-files.txt` vs `baseline-fail-files.txt`), i.e. zero
regressions attributable to this PR. The first round's extra entry,
`packages/runtime/test/p6t1-parallel.test.ts`, is **flaky on the pristine base
too** (24 single-file repeats: 2/12 failing with this PR's files, 4/12 failing
at the stashed base — activation-quota / compatibility-reprobe timing); it did
not recur in this run. The nine pre-existing failing files below are recorded
**by identity only** and are neither attributed nor fixed here — none of them
reaches the permission-overlay sources:
`packages/domain/test/t1-capability-schema.test.ts`,
`packages/domain/test/t2-blueprint-hash.test.ts`,
`packages/runtime/test/d3-member-identity-context.test.ts`,
`packages/runtime/test/p6t1-parallel.test.ts`,
`packages/runtime/test/p6t3-mediation.test.ts`,
`packages/runtime/test/p6t3-restart.test.ts`,
`packages/runtime/test/p8s3b-result-effects.test.ts`,
`packages/runtime/test/t12a-b2-child-identity.test.ts`,
`packages/runtime/test/t12a-glue-handoff-ports.test.ts`,
`packages/tools/test/p6t6-actions.test.ts`.

## 5. Live items NOT run

Per the task's offline mandate and `docs/TEST_METHODS.md`, none of the
following was executed — this PR's evidence is entirely offline:

* no DSH host build, boot or restart (`tests/deepseek-harness-test-use`,
  `tests/homes/<world>`, port `3180` family) — and nothing touched `:3080` or
  its DSH_HOME;
* no live Team Session, no real Leader/Human mutation, no delegation, no
  team-tool call;
* no model, provider or API key: none installed, none configured, none read;
* no real-machine restart / crash-injection matrix;
* no UI / browser / client-composition verification; no live notification
  delivery;
* no `pnpm build` / `build:composition` / `check:artifacts` run (no build input
  changed; `dist` is untouched by construction);
* no production `StorageDomain` binding exercised — durability ran through the
  repo's file-backed seam double, which is the sanctioned offline durability
  path (the restart specs model a process restart by re-opening the same
  directory with a new seam object).

## 6. Isolation statement

* One task = one worktree = one writer: everything happened in
  `.worktrees/pr58-permission-overlay` on branch
  `task/alpha3-pr1-permission-overlay`, created off exactly
  `1385f1ee060830bb0f550860d4bd81901c319063` (the current `origin/master`).
* `.worktrees/pr54-ui-observe`, `.worktrees/pr55-dod20-driver` and
  `.worktrees/pr56-client-panel` were **never** written to, and no tracked file
  of the primary checkout was modified — the primary checkout was opened
  read-only, solely to read and hash the three gitignored governing documents.
* Forward commits only; no rebase, no force-push, no history rewrite (the two
  evidence corrections are forward commits, not amendments).
* Staging used explicit paths only (`git add <file>`), never `-A`.
* **node_modules provenance (environment honesty):** `pnpm install` **cannot
  run** in this sandbox — the store index lives at
  `/home/user/.local/share/pnpm`, outside the workspace, and the attempt failed
  with `ERR_SQLITE_ERROR: unable to open database file`. So `node_modules/` and
  `packages/*/node_modules/` in this worktree were **copied read-only** from
  `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pr56-client-panel/node_modules`
  (a real directory; its `git status --porcelain` is 0 entries — verified by the
  coordinator before the copy and re-verified here). This is an **offline copy
  workaround, not "install succeeded"**: no install ran, nothing was written
  into `pr56`, no package or manifest changed, and no broad copy or cleanup
  sweep was performed.

## 7. Durable placement — RESOLVED: the tenth `TeamDomain` store, added additively at v2

### 7.0 Retraction (one note, forward-only; nothing is being re-litigated here)

An earlier round of this PR escalated durable placement as an **open
plan-level decision** with three options (a v2 → v3 `TeamDomain` bump plus an
explicit migration operation; a BP1-style world reset; or a **permanent
separate** Team-owned domain `team_permission_overlay`), and the interim
implementation followed the third. **That escalation was wrong and is
retracted.** All three options rested on a test-double artifact, not on the
pinned upstream backend: the conclusion "a same-version change to the table set
of an existing domain is rejected as `malformed-medium`" came from **our own
stricter mirrors** — `packages/storage/test/p4-helpers.ts` (`InMemoryStorageSeam`,
the sanctioned P4 test seam) and
`packages/testkit/fault-injection/file-seam.mjs` (`FileStorageSeam`) — which
compared persisted and declared table sets for equality. The real pinned
backends at `46a7f68b0922371ce7144b668b90e377d8e799f4` do no such thing: a
declared table that the medium does not carry is initialized **empty** —

* storage-json: [`packages/storage/storage-json/src/format.ts#L77-L85`](https://github.com/deepseek-ai/deepseek-harness/blob/46a7f68b0922371ce7144b668b90e377d8e799f4/packages/storage/storage-json/src/format.ts#L77-L85)
  (`records === undefined → state.tables.set(table, new Map())`),
* storage-sqlite: [`packages/storage/storage-sqlite/src/index.ts#L110-L131`](https://github.com/deepseek-ai/deepseek-harness/blob/46a7f68b0922371ce7144b668b90e377d8e799f4/packages/storage/storage-sqlite/src/index.ts#L110-L131)
  (`CREATE TABLE IF NOT EXISTS` per declared table, inside the same version).

No table-set equality check exists anywhere in the upstream backends. There is
therefore no version conflict to escalate: **a new store is not a new
version.** The standalone-domain code from that round is **withdrawn design** —
it survives only in this branch's history and is not in the final tree (no
`team_permission_overlay` domain, no
`SUPPORTED_PERMISSION_OVERLAY_SCHEMA_VERSIONS`, no
`createPermissionOverlaySeamSpec`; `permission-overlay-port-surface.test.ts`
fails if the quoted domain literal reappears in `packages/storage` or
`packages/runtime`). Authority wiring is unchanged by this correction.

### 7.1 What shipped

`permission_overlays` is the **tenth declared store of the single public
`team_domain` domain**, appended last in `TEAM_DOMAIN_STORES`
(`packages/storage/schema/stores.ts`), at the **unchanged**
`TEAM_DOMAIN_SCHEMA_VERSION = 2` with `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS
= [2]`. No version bump, no migration operation, no world reset, no fixture
restamp: the nine existing stores keep their rows and their stamp bytes, and
the only durable write a pre-existing medium ever sees is the new store's own
single `schema_meta` stamp row.

**The stamp rule** (`verifyStamps` in
`packages/storage/repositories/team-domain.ts`, used by `openTeamDomain` *and*
by the production boot entry `createOrOpenTeamDomain`):

* the nine **baseline** stamps are verified exactly as before — missing →
  `SCHEMA_STAMP_MISSING` naming the exact store, foreign version →
  `SCHEMA_STAMP_MISMATCH`, and an L1 foreign-version medium →
  `SCHEMA_VERSION_MISMATCH`, all with the medium untouched;
* the **additive** store's stamp is bootstrapped **only** when the store is
  freshly initialized empty: stamp absent **and** the table holds zero rows
  **and** the nine baseline stamps already verified. Anything else stays loud —
  rows without a stamp is corruption (`SCHEMA_STAMP_MISSING` with
  `details.problem = 'rows-without-stamp'`, zero writes), never "fresh".

**The seam fidelity fix** (the one deliberate existing-file behaviour change,
listed explicitly): both sanctioned doubles now match the pinned upstream for
same-version table additions. The rule they implement is: *a same-version
table-set change is legal exactly when the persisted table set is a canonical
**prefix** of the declared set; the missing trailing tables are empty in memory
and cost no durable write.* Strictness that upstream cannot express is
**retained on purpose**: because `FileStorageSeam` persists one file per table,
a *hole* in the prefix (a lost middle store) is still `malformed-medium`, and so
are undeclared/ghost files, removed tables and foreign versions. Pinned by
`packages/testkit/test/a3p1-seam-additive-tables.test.ts` (8 legs, both doubles).

**Existing-file syncs this required** (each is a count or a path following the
tenth store, not a policy change): `p4-01-schema-meta` (create stamps ten),
`p4-07-durability-crash`, `bp1-blueprint-registry` (stamp-write base),
`rmr-create-or-open` (fresh/adopt stamp counts), `p4t5-helpers.STAMP_WRITE_COUNT`
(9 → 10), `p4t5-retry-restart` + `p4t5-corrupt-version` (the committed fixture is
a genuine pre-Alpha.3 nine-store world, so its **first** reopen now pays exactly
**one** write — the tenth stamp row — and a second reopen is 0-write, which is
now pinned as its own leg), `p4t6-session-event-scan` (scannable-file pin
922 → 924, +2 new specs), and the seven `permission-overlay-*` specs' placement
legs plus `permission-overlay-helpers.ts` (rows now read from
`team_domain/permission_overlays.json`). The committed
`fault-injection/fixtures/committed-world` fixture is deliberately **left
nine-store**: it is the compatibility witness, not a stale artifact — dogfooding
the additive path on every reopen is exactly what it now proves.

## 8. Reviewer quick map

* the store declaration (nine baseline + one additive, the version pinned at
  2): `packages/storage/schema/stores.ts`
* open/verify/bootstrap of the stamps: `verifyStamps` in
  `packages/storage/repositories/team-domain.ts`
* record + placement constants: `packages/storage/schema/permission-overlay.ts`
* append-only store + CAS: `packages/storage/repositories/permission-overlays.ts`
  (header explains the three design non-responsibilities, the CAS problem
  table, and why appends are serialized on the instance)
* the two test doubles' additive-table rule (the fidelity fix):
  `packages/testkit/fault-injection/file-seam.mjs` (open) and
  `packages/storage/test/p4-helpers.ts` (`isAdditiveTableExtension`)
* port: `packages/runtime/permission-governance/port.ts`
* adapter: `packages/runtime/permission-governance/overlay-repository.ts`
* evidence + reading order:
  `dev/agent-workflow/evidence/alpha3-pr1-permission-overlay/RECAP.md`
