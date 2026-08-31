# P7-T2 zero-core log — CORE PATCH BUDGET = 0 verification

Result: **pass** — zero upstream lines touched, zero private/internal
upstream APIs used, zero patch/postinstall machinery.

## 1. Commit surface

Code commit `75e32ad29511f0f3c13815b563d2471035da80a1`
("P7-T2: runtime mutation/provenance (future-boundary mutation,
policy/overlay/override provenance)") touches exactly the owned paths and
nothing else:

```
 packages/runtime/mutation/envelope.ts              | 199 +++++
 packages/runtime/mutation/errors.ts                | 129 +++
 packages/runtime/mutation/index.ts                 |  82 ++
 packages/runtime/mutation/service.ts               | 922 +++++++++++++++++++++
 packages/runtime/mutation/types.ts                 | 451 ++++++++++
 packages/runtime/policy-adapter.ts                 | 258 ++++++
 packages/runtime/test/p7t2-creation-fields.test.ts | 334 ++++++++
 packages/runtime/test/p7t2-escalation.test.ts      | 763 +++++++++++++++++
 packages/runtime/test/p7t2-future-boundary.test.ts | 457 ++++++++++
 packages/runtime/test/p7t2-helpers.ts              | 389 ++++++++++
 packages/runtime/test/p7t2-override-precedence.test.ts | 354 ++++++++
 packages/runtime/test/p7t2-policy-state.test.ts    | 463 +++++++++++
 packages/runtime/test/p7t2-provenance.test.ts      | 264 ++++++
 packages/testkit/test/p4t6-session-event-scan.test.ts | 14 +-
 14 files changed, 5075 insertions(+), 4 deletions(-)
```

All paths are owned by P7-T2 (`packages/runtime/mutation*`, the policy
adapter, its tests) plus the sanctioned p4t6 scanner-expectation update
(381 → 394). After the code commit, `git status --porcelain` shows only
the untracked evidence directory.

## 2. Upstream interaction surface

- All upstream capability is consumed through the frozen, read-only pure
  domain package `packages/domain/policy` (two-stage resolver + validators)
  and the frozen identity helpers — no upstream source file was read for
  mutation, modified, imported internally, or wrapped privately.
- Runtime behaviour hangs on three injected ports (StepClock,
  MutationStore, PolicyReader); the tests exercise them with in-process
  fakes. No real DSH instance, no ports, no network.
- Import-face scan (recorded in attempt1-post.log): all 13 new .ts files
  scanned for `node:` builtins — 0 hits. No upstream private/internal
  imports in any new source.
- No `pnpm` dependency changes, no lockfile edits, no script additions,
  no patch-package / pnpm patch / postinstall.

## 3. Untouched surfaces

- `references/` (frozen legacy fork + pristine test-use upstream) —
  untouched.
- Shipped preset install, `docs/plans/active/` frozen docs, int branches,
  master — untouched.
- Stable deployment (`:3080`, `D:\deepseek-harness\`) — untouched; all
  verification is unit/in-process in this worktree.

No `CORE_SEAM_BLOCKER` was needed: every required seam existed via the
pure domain package and injected ports.
