# Alpha.3 PR1 — PermissionOverlay Foundation: verification evidence

Tree: worktree `.worktrees/pr58-permission-overlay`, branch
`task/alpha3-pr1-permission-overlay`, base `1385f1ee060830bb0f550860d4bd81901c319063`.
Everything below ran inside this worktree, offline, with no host, no port, no
model, no key and no network. Vitest 4.1.11 via `node_modules/.bin/vitest`.

## 1. Governing-document baseline (local authoritative copies, hashes pinned in the PR body)

`docs/plans/active/` is gitignored, so these three documents are NOT inside the
worktree; they were read and hashed from the local copies in the primary
checkout of the same repository. The hashes below are those LOCAL copies — no
cross-source byte-identity with any other copy is claimed.

| document (path relative to the primary checkout) | bytes | sha256 |
| --- | --- | --- |
| `docs/plans/active/dsh-agent-team-alpha3-permission-governance-ADR-revised.md` | 4282 | `1af9899c30533a8bc4151b4bf0ab9527563c91c56f655b414f94896b88fcbf57` |
| `docs/plans/active/dsh-agent-team-alpha3-permission-governance-design-revised.md` | 3731 | `cb916ce33fb61741adbe811828e5a6ab1411e7c7604071ce9e7557e141e022e6` |
| `docs/plans/active/dsh-agent-team-alpha3-permission-governance-implementation-plan-revised.md` | 2959 | `2d4c0d44a7feca238a8e469dfb63db9897ea1fd2a618baeda2b41306a9bd4a7b` |

Re-verified after the last commit (size + sha256 unchanged); no implementation
decision was made without re-reading the relevant paragraph.

## 2. RED — `red-run-1.txt`, `red-run-2-final-specs.txt`

`red-run-2-final-specs.txt` is the authoritative RED capture: the FINAL spec
files, with the six implementation sources moved out of the tree (byte-hashes
of the moved files recorded before and after; identical on restore).

    $ node_modules/.bin/vitest run \
        packages/runtime/test/permission-overlay-append.test.ts \
        packages/runtime/test/permission-overlay-latest-generation.test.ts \
        packages/runtime/test/permission-overlay-restart-persistence.test.ts \
        packages/runtime/test/permission-overlay-history-immutability.test.ts \
        packages/runtime/test/permission-overlay-generation-conflict.test.ts \
        packages/runtime/test/permission-overlay-validation.test.ts \
        packages/runtime/test/permission-overlay-port-surface.test.ts
    [RED exit 1]
     Test Files  7 failed (7)
          Tests  no tests

Seven `Cannot find module` failures over exactly two module paths
(`../../storage/repositories/permission-overlays.js`,
`../../storage/schema/permission-overlay.js`) — the specs fail because the
capability does not exist yet, not because of a harness problem.
`red-run-1.txt` is the earlier equivalent capture.

## 3. GREEN — `green-run-1.txt`

    $ node_modules/.bin/vitest run <the same seven specs> \
        packages/testkit/test/p4t6-session-event-scan.test.ts
    [GREEN exit 0]
     Test Files  8 passed (8)
          Tests  78 passed (78)

The seven PR1 specs are 68 tests; the eighth file is the shared
`p4t6-session-event-scan` scan pin (10 tests) re-run here because this PR
bumps its file-count pin (see §6).

Plan-test coverage (one spec per plan item, plus the two structural proofs):

| plan test | spec file | tests |
| --- | --- | --- |
| 1 append snapshot | `permission-overlay-append.test.ts` | 8 |
| 2 latest generation | `permission-overlay-latest-generation.test.ts` | 6 |
| 3 restart persistence | `permission-overlay-restart-persistence.test.ts` | 5 |
| 4 immutable history | `permission-overlay-history-immutability.test.ts` | 6 |
| 5 generation conflict | `permission-overlay-generation-conflict.test.ts` | 8 |
| structural gate | `permission-overlay-validation.test.ts` | 31 |
| ADR §1 non-responsibilities | `permission-overlay-port-surface.test.ts` | 4 |

## 4. Guard effectiveness (mutation probe) — `mutation-probe.txt`

`mutation-probe.sh` weakens ONE guard in the durable append at a time, runs the
two specs that are supposed to catch it, then restores the pristine source and
verifies it byte-for-byte. Each probe was caught by exactly the intended tests:

| probe (weakened guard) | tests that went RED |
| --- | --- |
| occupied generation no longer conflicts (silent overwrite) | `serializes two concurrent appends at one generation…`, `rejects an append at an already-durable generation…` |
| predecessor durability not checked (chain gaps legal) | `rejects a previousSnapshotId naming a snapshot that was never durable…`, `keeps one MemberInstance’s CAS independent of another’s` |
| durable-head check disabled (writes below the head legal) | `refuses a late append into a HOLE below the durable head…` |

    pristine sha256: 2bf124a86e168c9e47e62db05b10878fbb88f1874fca6cfc4c337a44802b451a
    restored sha256: 2bf124a86e168c9e47e62db05b10878fbb88f1874fca6cfc4c337a44802b451a
    RESTORE: byte-identical

## 5. Full offline suite — parity against the pristine base

Capture form of the two files below: each is the trimmed stdout of one
`node_modules/.bin/vitest run --reporter=dot` invocation — every `FAIL` line
plus the final `Test Files` / `Tests` summary block, nothing else. They do not
contain the command line or the exit status; those are stated here in prose
(branch exit 1 / base exit 1, both because pre-existing failures exist).

Branch tree (`full-suite-branch.summary.txt`):

    $ node_modules/.bin/vitest run --reporter=dot
     Test Files  10 failed | 415 passed (425)
          Tests  20 failed | 4932 passed (4952)

Pristine base `1385f1ee` with this PR's files stashed out
(`full-suite-base.summary.txt`, captured via `git stash push -u` + `git stash pop`):

    $ node_modules/.bin/vitest run --reporter=dot
     Test Files  9 failed | 409 passed (418)
          Tests  19 failed | 4865 passed (4884)

`mine-fail-files.txt` / `baseline-fail-files.txt` are the sorted failing-file
sets. The delta is exactly `+7 test files` (this PR's specs) and `+68 passing
tests`, and one extra entry: `packages/runtime/test/p6t1-parallel.test.ts`,
which is FLAKY on the pristine base as well — 24 repeat runs of that single
file (12 with this PR's files present, 12 at the stashed pristine base):

    MINE (with my files): 2/12 runs failed
    BASE (pristine 1385f1ee): 4/12 runs failed

so it is pre-existing timing flake (activation quota / compatibility reprobe),
not a regression from this PR. The other nine failing files fail identically
at the base (`baseline-probe-ten.txt` shows the same ten files run in
isolation: 9 failed / 1 passed, 19 failed tests / 56 passed — identical with
and without this PR's files). None of them touches the permission-overlay
sources. Per the coordinator's baseline discipline the pre-existing failures
are recorded by identity only —
`packages/domain/test/t1-capability-schema.test.ts`,
`packages/domain/test/t2-blueprint-hash.test.ts`,
`packages/runtime/test/d3-member-identity-context.test.ts`,
`packages/runtime/test/p6t1-parallel.test.ts`,
`packages/runtime/test/p6t3-mediation.test.ts`,
`packages/runtime/test/p6t3-restart.test.ts`,
`packages/runtime/test/p8s3b-result-effects.test.ts`,
`packages/runtime/test/t12a-b2-child-identity.test.ts`,
`packages/runtime/test/t12a-glue-handoff-ports.test.ts`,
`packages/tools/test/p6t6-actions.test.ts` — they are NOT attributed or fixed
here; this PR neither causes nor touches them.

## 5b. Environment honesty: the node_modules in this worktree

`pnpm install` could not run here: the store index lives at
`/home/user/.local/share/pnpm`, outside the workspace sandbox, and the install
failed with `ERR_SQLITE_ERROR: unable to open database file` — an offline copy
workaround, NOT "install succeeded". `node_modules/` (and the
`packages/*/node_modules/` links) in this worktree were COPIED READ-ONLY from
the existing worktree `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pr56-client-panel/node_modules`
(realpath `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pr56-client-panel/node_modules`),
whose porcelain status was verified clean (0 entries) by the coordinator before
the copy and re-verified at 0 entries in this session; nothing was written into
it, no install ran, no package was added, removed or version-bumped, and no
dependency manifest changed. Every
test result in this PR was produced with that inherited tree; no new broad copy
and no cleanup sweep was performed.

## 6. Gates

    $ (cd packages/runtime && ../../node_modules/.bin/tsc -p tsconfig.json)   # exit 0
    $ (cd packages/storage  && ../../node_modules/.bin/tsc -p tsconfig.json)  # exit 0
    $ node_modules/.bin/eslint <every new source and spec>                     # exit 0

The new sources are inside the typecheck program (they are reached from
`packages/runtime/test`, which `tsconfig.json` includes); they are deliberately
NOT added to `packages/runtime/tsconfig.build.json`'s include list, so
`pnpm build` and the committed `dist`/composition artifacts are untouched —
consistent with "PR1 enables no runtime dynamic permission execution".

## 7. Touched files

New (14 scannable files):

    packages/storage/schema/permission-overlay.ts
    packages/storage/repositories/permission-overlays.ts
    packages/runtime/permission-governance/types.ts
    packages/runtime/permission-governance/port.ts
    packages/runtime/permission-governance/overlay-repository.ts
    packages/runtime/permission-governance/index.ts
    packages/runtime/test/permission-overlay-helpers.ts
    packages/runtime/test/permission-overlay-append.test.ts
    packages/runtime/test/permission-overlay-latest-generation.test.ts
    packages/runtime/test/permission-overlay-restart-persistence.test.ts
    packages/runtime/test/permission-overlay-history-immutability.test.ts
    packages/runtime/test/permission-overlay-generation-conflict.test.ts
    packages/runtime/test/permission-overlay-validation.test.ts
    packages/runtime/test/permission-overlay-port-surface.test.ts

Existing, modified (1 file, 1 assertion + its pin prose — the single
sanctioned existing-file touch):

    packages/testkit/test/p4t6-session-event-scan.test.ts   (908 -> 922)

Zero other existing file changed; `packages/storage/schema/stores.ts`,
`packages/storage/repositories/team-domain.ts`, `control/`,
`operation-permission/`, `effective-policy/`, `governance/`, `mutation/`,
notification, client projection and the recovery paths are untouched.

---

## Placement round (supersedes the "interim standalone domain" note above)

The escalation in the first round of this PR was WRONG and is retracted: the
"same-version table-set change is rejected" conclusion came from OUR two test
doubles, not from the pinned upstream, which initializes a declared-but-absent
table EMPTY (storage-json `format.ts` L77-85; storage-sqlite `index.ts`
L110-131, at `46a7f68b0922371ce7144b668b90e377d8e799f4`). The store therefore
lives where the ADR diagram says it lives: `permission_overlays` is the TENTH
declared store of the single `team_domain` domain, at the UNCHANGED schema
version 2. No version bump, no migration, no world reset, no fixture restamp.

Reading order for this round:

1. `packages/storage/schema/stores.ts` — `TEAM_DOMAIN_BASELINE_STORES` (nine)
   + `TEAM_DOMAIN_ADDITIVE_STORES` (one) = `TEAM_DOMAIN_STORES` (ten); the
   version constants do not move.
2. `packages/storage/repositories/team-domain.ts` — `verifyStamps()`: nine
   baseline stamps verified exactly as before; the additive stamp is created
   ONLY if (stamp absent) AND (table empty) AND (the nine verified). Used by
   both `openTeamDomain` and `createOrOpenTeamDomain`.
3. `packages/testkit/test/a3p1-team-domain-tenth-store.test.ts` (10 legs) and
   `packages/testkit/test/a3p1-seam-additive-tables.test.ts` (8 legs) — the
   regressions: compat open byte-identical, one-time bootstrap, corruption
   still loud, both doubles faithful to upstream.
4. `packages/testkit/fault-injection/file-seam.mjs` + `packages/storage/test/p4-helpers.ts`
   — the fidelity fix (canonical-prefix rule; retained strictness for prefix
   holes is a documented deviation, because the double stores one file per table).

Files this round touched beyond the first round's set: `schema/version-policy.ts`
(prose), the four storage count pins, the three p4t5 files, `p4t6` (922 -> 924),
six `permission-overlay-*` specs and their helper, and the two runtime
re-exports. The committed `committed-world` fixture stays NINE-store on purpose:
it is the compatibility witness, and every run now dogfoods the additive
bootstrap against it (first reopen = 1 write, second = 0 — pinned).

Evidence: `additive-red.txt` (RED against the stashed nine-store tree,
exit 1), `additive-green-target-specs.txt` (31/31, exit 0),
`additive-green-full-overlay-surface.txt` (9 files / 87 tests, exit 0),
`full-suite-branch-additive.txt` + `additive-fail-files.txt` (failing set
IDENTICAL to `baseline-fail-files.txt`),
`mutation-probe-additive.txt` (3 probes caught, source restored byte-identical).
