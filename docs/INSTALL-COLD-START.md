# Cold-start: install, build, verify (EB4-C)

**State: `DELIVERED`.** Every command below was run in the `u7-3` worktree; its recorded output is in
the receipt [eb4c-receipts-r2.txt](../dev/agent-workflow/evidence/u7-3-20261026/eb4c-receipts-r2.txt), whose header names the pinned base SHA and time. This page states the **shape** of a
healthy result and quotes the receipt where a value helps; timings and counts move with every merge,
so re-run the command for a current value. Commands that need a Host boot are marked `UNRUN` with the
reason; this page does not boot a Host. Companion pages: [RECOVERY.md](./RECOVERY.md) for
when a step fails, [RELEASE.md](./RELEASE.md) for the master/stable discipline, and
[DIAGNOSIS-CALL-CHAIN.md](./DIAGNOSIS-CALL-CHAIN.md) for reading a refusal after the gate is green.

This page **does not duplicate** [docs/INSTALL.md](./INSTALL.md), which is the authoritative
plugin-mounting guide (profile `cordis.patch.yml`, `dsh plugin add`, MCP config, `spill-local`
migration, `teamToolPlane` config). Read that first when the target is a DSH profile. This page is
the cold-start path for a **checkout**: clone → install → build → verify → gate, with the artifact
freshness law and the test-instance red lines that cold-start touches.

## 1. Prerequisites

| Item | Requirement | Source of truth |
| --- | --- | --- |
| Node | `^22.19.0 \|\| >=24.0.0` (repo `engines`) | [package.json](../package.json) |
| pnpm | `11.7.0` (repo `packageManager` pin) | [package.json](../package.json) |
| DSH host (test runtime) | `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84` | [tests/paths.mjs](../tests/paths.mjs) |
| DSH_HOME | under `tests/homes/<world>` (workspace-write sandbox) | [docs/TEST_METHODS.md](./TEST_METHODS.md) |
| Ports | `3180`-`3186` / `3491`-`3500` only; **never 3080** | [docs/TEST_METHODS.md](./TEST_METHODS.md) |
| pnpm store | in-workspace (e.g. `<repo>/.pnpm-store`) when the default store is outside the sandbox | the default store under `$HOME` fails with `ERR_SQLITE_ERROR` under workspace-write (receipt addendum) |

## 2. Install

```bash
pnpm install --frozen-lockfile --offline --store-dir <workspace store>
```

Healthy: exit 0, all 10 workspace projects resolved against the pinned `@deepseek-ai/*` peers (receipt
`## install`). The `--store-dir` is needed in this environment because the default pnpm store lives
under `$HOME` (outside the workspace-write sandbox) and pnpm fails to open its index there
(`ERR_SQLITE_ERROR: unable to open database file`). The receipt's default-store addendum records that
failure, and also why a naive re-run can hide it: once `node_modules` is linked to the in-workspace
store, `pnpm install` answers "Already up to date" and exits 0 without opening the default store
at all. The control therefore runs in a scratch dir with no `node_modules`. On a machine without that constraint, plain
`pnpm install --frozen-lockfile` is fine; on a fresh machine without a local store, drop `--offline`.

`pnpm install` alone is enough: the repo declares no lifecycle scripts (the old `prepare` was removed
when pre-built artifacts were committed), so `pnpm` does not execute any build at install time. Build
is an explicit next step.

## 3. Build

One command, three steps:

```bash
pnpm setup
```

Healthy: exit 0 (receipt `## build`). `pnpm setup` = `pnpm build && pnpm build:composition`:

| Step | What it does | Healthy |
| --- | --- | --- |
| `pnpm build` | `tsc -p tsconfig.build.json` for 9 packages → `packages/*/dist` | exit 0 |
| `pnpm build:composition` | (1) place runtime glue via [scripts/place-dist-glue.mjs](../scripts/place-dist-glue.mjs); (2) build client composition shim via [scripts/build-client-composition.mjs](../scripts/build-client-composition.mjs); (3) run the install-surface freshness gate | exit 0 and a `verdict=ok` line |

The freshness gate prints a machine-readable verdict (file counts in the receipt):

```text
DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=<n> glue=<n>
```

**Two checks, two different things** (see [docs/INSTALL.md §3.1](./INSTALL.md) for the full discipline):

* `pnpm check:artifacts` compares the **working tree** against the **git index**. It does not build,
  so it says "the tree matches what is staged," not "a build produced these bytes."
* `pnpm check:artifacts:head` materializes **HEAD** into a one-shot scratch worktree, rebuilds there,
  and compares byte-for-byte. It is the freshness gate that is not fooled by a dirty working tree.

Run `pnpm check:artifacts:head` before merge (healthy: exit 0, `subject=commit … verdict=ok drift=0`).

## 4. Verify

Run the static gates. Each is one command; together they are what a reviewer runs locally and what
CI runs under `--full`:

```bash
node scripts/ci-pr-gate.mjs
```

Healthy (default mode): exit 0 and a single verdict line of this shape (receipt `## verify` has the
recorded one):

```text
DSH-CI-VERDICT pass pass=7 fail=0 skip=1 skipped=census legs=8 refused=0 refusedlegs=none seconds=<n>
```

The default mode skips the census (the full `vitest run`); CI runs `--full` so a skip is a failure
there. The legs, cheap-first: `graph-parse`, `state-freshness`, `install`, `blueprint-fence`,
`typecheck`, `lint-identities`, `artifacts-at-head`, `census` (opt-in by default).

The authority docs checks ride the same required job:

```bash
node scripts/docs-sync.mjs --check
node scripts/docs-probe.mjs --base origin/master
```

Healthy: both exit 0 with `blocking=0`. `docs:probe` grades the merge-base..HEAD change scope; an
unresolvable base is REFUSED (exit 2), never treated as "nothing changed."

The lint identity diff (the gate's authority, not the lint exit code):

```bash
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
```

Healthy: exit 0, `new 0`. `pnpm lint` itself is red at `master` by ruling (concentrated in test
code; the receipt records the counts); the gate uses the **identity set** against the recorded
baseline, not the exit code.

## 5. Test

### 5.1 Plain-node runner (no vitest, no child process)

```bash
node scripts/run-tests.mjs [packages…]   # default: all packages; subset: e.g. `contracts`
```

Healthy: `RESULT: PASS run-tests (0 failures)`. Runs `.test.ts` under plain Node with
native type-stripping and [scripts/test-vitest-shim.mjs](../scripts/test-vitest-shim.mjs); no
`vitest`, no child process spawn — for the spawn-restricted sandbox.

### 5.2 Full vitest suite

```bash
npx vitest run
```

At the receipt's base: 628 files, 7998 tests; the recorded run reported **one** red — `S13` in
`rc2-sanitize-evidence`, `Test timed out in 5000ms` — and a repeat run on the same tree reported
**zero** reds (628 passed / 7998 passed, exit 0). S13 is a `spawnSync(node --test …)` cold start that
sits at ~3.0–3.1 s idle against vitest's 5000 ms default, so it fails under load and passes otherwise.

This page does not call that a flake on its own word: the branch touches a dependency of that exact
suite, so it was measured both ways — S13 in isolation 3×, its payload timed 3×, an A/B against the
pristine base sanitizer (3043–3077 ms vs 3055–3079 ms, one 36 ms band), and a row-by-row equivalence
check of the moved pattern table (10/10 rows, sources, flags, replacements all equal). That control is
[s13-clock-drift-branch-proof.log](../dev/agent-workflow/evidence/u7-3-20261026/s13-clock-drift-branch-proof.log);
the same flake was already disclosed as pre-existing at pristine `origin/master 2af64ead7`
(5702 ms @ 5000 ms) by the U7-4a lane. Not fixed here: it is a product test file, and re-baselining the
census is the Contract Owner's call.

Nine other reds that used to be disclosed were **retired** by U7-1 / EB2-C (test-side observer repairs
with mutation controls), and the census gate pointer moved to
[nine-root-u7-1-old-reds.md](../dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md),
the first baseline with an **empty** tolerated set — so at this base any census red is new, not
baseline debt. The first receipt of this page
([eb4c-receipts.txt](../dev/agent-workflow/evidence/u7-3-20261026/eb4c-receipts.txt), older base) still
shows the nine; it is kept unedited as history.

### 5.3 Census (identity-graded, opt-in)

```bash
node scripts/ci-pr-gate.mjs --only census --census-test-timeout 20000
```

RUN here and REFUSED (exit 1, `verdict=fail`, "undeclared refusal" — receipt `## tests`): the census
refuses before spawning vitest because `tests/deepseek-harness-test-use` (the pristine test host,
gitignored, pinned by [tests/paths.mjs](../tests/paths.mjs)) is absent **at this checkout's own path**.
A task worktree has no host of its own: the root checkout's host is reachable as
`../../tests/deepseek-harness-test-use` (zero-core and the state table use it that way), but the census
resolves the in-tree path, so it cannot grade a worktree. The refusal is the correct fail-closed
behavior, not a bug; and because the census refused, this page makes **no** identity-set claim; on a tree with the host checkout present, the census grades the
identity set against the current baseline pointer named in `scripts/ci-pr-gate.mjs` (`BASELINES.census`).

## 6. Boot a test Host instance (UNRUN here)

The cold-start path stops at the gate. Booting a Host is a test-instance operation governed by
[docs/TEST_METHODS.md](./TEST_METHODS.md); it is **not** part of cold-start and was not run here:

```bash
# UNRUN in this worktree: test-use host checkout absent; documented for reference.
cd tests/deepseek-harness-test-use
pnpm install --ignore-scripts
DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build
DSH_HOME=<repo>/tests/homes/<world> node apps/cli/lib/bin.js web --port 3180 --no-open
```

Red lines (unchanged by this page): never 3080, never `~/.dsh`, never the stable dev instance.
