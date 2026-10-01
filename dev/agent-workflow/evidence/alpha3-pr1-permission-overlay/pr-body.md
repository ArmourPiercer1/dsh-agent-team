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

**Existing files modified — exactly one:**
`packages/testkit/test/p4t6-session-event-scan.test.ts` — the shared
file-count scan pin `908 → 922` (this PR's fourteen scannable files) plus its
prose line. Zero new denylist vocabulary: the frozen quarantine hit set stays
at fifteen occurrences; the scanner `.mjs` is unchanged.

**Explicitly NOT added / NOT touched** (plan *"Do NOT add: - resolver logic;
- notification; - UI."* plus the coordinator's scope list): no resolver logic,
no notification, no UI, no `EffectivePermissionAssembler`, no
`GovernanceMutationService`, no `PermissionMutation`, no `MutationEnvelope`,
no grant/revoke/lifecycle, no inheritance. Untouched:
`operation-permission/` (the pure resolver), `effective-policy/`, `control/`,
`mutation/`, `governance/`, notification, the client projection / `TeamLedger`,
the recovery paths, `packages/storage/schema/stores.ts`,
`packages/storage/repositories/team-domain.ts`, `packages/runtime/src/**`, and
every PR54/PR55/PR56 line.

`permission-overlay-port-surface.test.ts` pins that isolation four ways: the
port surface is exactly `append`/`history`/`latest`; no owned module imports a
resolver / assembler / governance-mutation / control / notification /
projection / admission / lifecycle module; the contract docstrings naming the
`GovernanceMutationService` as the mutation authority are asserted text; and
the durable domain name is literalized in exactly one module.

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

### Full offline suite — parity against the pristine base

| tree | files | tests |
| --- | --- | --- |
| this branch | 10 failed / 415 passed (425) | 20 failed / 4932 passed (4952) |
| pristine `1385f1ee` (this PR's files stashed out) | 9 failed / 409 passed (418) | 19 failed / 4865 passed (4884) |

The delta is exactly **+7 test files / +68 passing tests**, plus one extra
entry: `packages/runtime/test/p6t1-parallel.test.ts`, which is **flaky on the
pristine base too** (24 single-file repeats: 2/12 failing with this PR's files,
4/12 failing at the stashed base — activation-quota / compatibility-reprobe
timing). The nine other pre-existing failing files fail identically with and
without this PR's files (isolated ten-file run: 9 failed / 1 passed,
19 failed tests / 56 passed in both states). They are recorded **by identity
only** and are neither attributed nor fixed here — none of them reaches the
permission-overlay sources:
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

## 7. OPEN PLAN-LEVEL DECISION — durable placement (escalated, not decided here)

The ADR §1 authority chain terminates in **`TeamDomain`**, and the plan's PR1
list says `Add: … TeamDomain schema`:

```
    Leader/Human request
            |
    GovernanceMutationService
            |
    PermissionOverlayRepository
            |
    TeamDomain
```

Placing the overlay store **inside** the `team_domain` storage domain is
**not achievable additively**, and this PR did not silently pick a resolution:

* `packages/storage/schema/stores.ts:42` pins `TEAM_DOMAIN_SCHEMA_VERSION = 2`
  and `:45` `SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS = [2]`; `:48-58` declares
  exactly **nine** stores and `:99-105` declares precisely those nine in the
  seam spec.
* Adding a tenth store at the **same** version makes every existing
  `team_domain` medium fail at **open**:
  `packages/storage/test/p4-helpers.ts:203-209` — same version + different
  table set → seam code `malformed-medium`. Bumping the version instead yields
  `version-mismatch` (`packages/storage/repositories/team-domain.ts:109-119` →
  `SCHEMA_VERSION_MISMATCH`). Both reject on the **production boot path**
  (`packages/runtime/src/plugin/host.ts:1531-1545`, create-or-open on every
  boot).
* `packages/storage/schema/version-policy.ts:23-31` closes the third door:
  *"There is NO built-in migration … the upgrade strategy is a documented
  future extension point only: a future version ships the migration as a new
  supported version plus an explicit migration operation, **never as an
  implicit in-place rewrite**."*
* The nine-store set is also pinned by existing tests and by a committed world
  fixture: `packages/storage/test/p4-01-schema-meta.test.ts:91,106`;
  `packages/storage/test/p4t4-per-stage-retry.test.ts:171,284`;
  `packages/testkit/test/p4t5-retry-restart.test.ts:447`;
  `packages/testkit/test/p4t5-crash-matrix.test.ts:289,339-343`;
  `packages/testkit/fault-injection/fixtures/committed-world/team_domain.meta.json`
  (= `{"version":2}` plus the nine table files).
* Precedent: the ninth store (`blueprint_registry`, issue #2 BP1/BP2) was added
  by a real **v1 → v2** bump + fixture restamp + runtime L3 restamp — a
  plan-level alpha decision that the three Alpha.3 revised docs **do not
  contain** an equivalent of.

**Interim taken (coordinator-approved, new files only, zero existing-file
behaviour change):** its own Team-owned durable domain
`team_permission_overlay` at schema version 1, table `permission_overlays`,
opened through the same public `StorageDomainSeam` (L1 version at open, L3 row
`schemaVersion`; no `schema_meta` stamp table, and the reason is documented in
the module header). The placement literal lives in **one** module
(`packages/storage/schema/permission-overlay.ts`), so a reversal is a
one-file flip — and `permission-overlay-port-surface.test.ts` fails if a second
literalization site appears.

**The decision left to the plan owner** (each option has a different durability
and compatibility consequence, so it is plan-level, not implementer-level):

1. move the overlay store **into `team_domain`** as the tenth store with a
   **v2 → v3** bump **plus an explicit migration operation** (and the fixture /
   committed-world restamps that implies); or
2. a **BP1-style world reset** — bump and restamp, accepting that pre-alpha3
   `team_domain` media are dropped rather than migrated; or
3. keep `team_permission_overlay` as a **permanent** separate Team-owned
   domain, and amend the ADR §1 diagram / plan wording to say so explicitly
   (the diagram currently promises a single `TeamDomain`).

Whichever way this is decided, PR1's record shape, port surface and CAS
semantics are unaffected; only the domain placement constants move.

## 8. Reviewer quick map

* record + placement constants: `packages/storage/schema/permission-overlay.ts`
* append-only store + CAS: `packages/storage/repositories/permission-overlays.ts`
  (header explains the three design non-responsibilities, the CAS problem
  table, and why appends are serialized on the instance)
* port: `packages/runtime/permission-governance/port.ts`
* adapter: `packages/runtime/permission-governance/overlay-repository.ts`
* evidence + reading order:
  `dev/agent-workflow/evidence/alpha3-pr1-permission-overlay/RECAP.md`
