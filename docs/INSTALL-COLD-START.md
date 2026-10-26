# Cold-start: install, build, verify (EB4-C)

**State: `DELIVERED`.** Every command below was run in the `u7-3` worktree at `origin/master` (`f71159648`,
rebased) and the observed result is quoted inline. Commands that need a Host boot are marked `UNRUN`
with the reason; this page does not boot a Host. Companion pages: [RECOVERY.md](./RECOVERY.md) for
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
| pnpm store | in-workspace (e.g. `<repo>/.pnpm-store`) when the default store is outside the sandbox | observed: default store under `$HOME` fails with `ERR_SQLITE_ERROR` under workspace-write |

## 2. Install

```bash
pnpm install --frozen-lockfile --offline --store-dir <workspace store>
```

Observed (this worktree, `u7-3`): exit 0, 5.8 s, 10 workspace projects, all `@deepseek-ai/*@0.2.0-rc.2`
peers resolved. The `--store-dir` is needed in this environment because the default pnpm store lives
under `$HOME` (outside the workspace-write sandbox) and pnpm fails to open its index there
(`ERR_SQLITE_ERROR: unable to open database file`). On a machine without that constraint, plain
`pnpm install --frozen-lockfile` is fine; on a fresh machine without a local store, drop `--offline`.

`pnpm install` alone is enough: the repo declares no lifecycle scripts (the old `prepare` was removed
when pre-built artifacts were committed), so `pnpm` does not execute any build at install time. Build
is an explicit next step.

## 3. Build

One command, three steps:

```bash
pnpm setup
```

Observed: exit 0, 10 s. `pnpm setup` = `pnpm build && pnpm build:composition`:

| Step | What it does | Observed |
| --- | --- | --- |
| `pnpm build` | `tsc -p tsconfig.build.json` for 9 packages → `packages/*/dist` | exit 0, 15 s |
| `pnpm build:composition` | (1) place runtime glue via [scripts/place-dist-glue.mjs](../scripts/place-dist-glue.mjs); (2) build client composition shim via [scripts/build-client-composition.mjs](../scripts/build-client-composition.mjs); (3) run the install-surface freshness gate | exit 0, 1 s |

The freshness gate prints a machine-readable verdict:

```text
DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=1799 glue=28
```

**Two checks, two different things** (see [docs/INSTALL.md §3.1](./INSTALL.md) for the full discipline):

* `pnpm check:artifacts` compares the **working tree** against the **git index**. It does not build,
  so it says "the tree matches what is staged," not "a build produced these bytes."
* `pnpm check:artifacts:head` materializes **HEAD** into a one-shot scratch worktree, rebuilds there,
  and compares byte-for-byte. It is the freshness gate that is not fooled by a dirty working tree.

Run `pnpm check:artifacts:head` before merge (observed: exit 0, 16 s, `verdict=ok drift=0`).

## 4. Verify

Run the static gates. Each is one command; together they are what a reviewer runs locally and what
CI runs under `--full`:

```bash
node scripts/ci-pr-gate.mjs
```

Observed (default mode, this worktree): exit 0, 53 s, verdict:

```text
DSH-CI-VERDICT pass pass=7 fail=0 skip=1 skipped=census legs=8 refused=0 refusedlegs=none seconds=53.1
```

The default mode skips the census (the full `vitest run`); CI runs `--full` so a skip is a failure
there. The legs, cheap-first: `graph-parse`, `state-freshness`, `install`, `blueprint-fence`,
`typecheck`, `lint-identities`, `artifacts-at-head`, `census` (opt-in by default).

The authority docs checks ride the same required job:

```bash
node scripts/docs-sync.mjs --check
node scripts/docs-probe.mjs --base origin/master
```

Observed: both exit 0, `blocking=0`. `docs:probe` grades the merge-base..HEAD change scope; an
unresolvable base is REFUSED (exit 2), never treated as "nothing changed."

The lint identity diff (the gate's authority, not the lint exit code):

```bash
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
```

Observed: exit 0, `new 0, resolved 0`. `pnpm lint` itself is red at `master` by ruling
(129 errors / 32 warnings, concentrated in test code); the gate uses the **identity set** against the
recorded baseline, not the exit code.

## 5. Test

### 5.1 Plain-node runner (no vitest, no child process)

```bash
node scripts/run-tests.mjs [packages…]   # default: all packages; subset: e.g. `contracts`
```

Observed (`contracts` only): 150 passed, 0 failed, 155 ms. Runs `.test.ts` under plain Node with
native type-stripping and [scripts/test-vitest-shim.mjs](../scripts/test-vitest-shim.mjs); no
`vitest`, no child process spawn — for the spawn-restricted sandbox.

### 5.2 Full vitest suite (disclosed baseline reds)

```bash
npx vitest run
```

Observed: exit 1, 4 failed files / 622 passed, 9 failed tests / 7928 passed, 308 s. The four failing
files (`p6t3-mediation`, `p6t3-restart`, `p6t6-actions`, `t2-blueprint-hash`) are all named in
[the population baseline](../dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2b1099d7.md).
That is a file-name check only: whether these 9 identities are exactly inside the tolerated set is
what the census leg grades, and the census REFUSED in this worktree (§5.3), so the identity-set
comparison is `NOT_VERIFIED` here. Never read a red count as "same debt as before".

### 5.3 Census (identity-graded, opt-in)

```bash
node scripts/ci-pr-gate.mjs --only census --census-test-timeout 20000
```

RUN here and REFUSED (exit 1, `verdict=fail`, "undeclared refusal"): the census refuses before spawning vitest because
`tests/deepseek-harness-test-use` (the pristine test host, gitignored, pinned by
[tests/paths.mjs](../tests/paths.mjs)) is absent from this checkout. The refusal is the correct
fail-closed behavior, not a bug; on a tree with the host checkout present, the census grades the
identity set against the same baseline.

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
