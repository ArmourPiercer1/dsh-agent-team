# runtime package tests — derived result (PD-19 lane)

**Why this file and not the raw log**: the raw `pnpm --filter @dsh-agent-team/runtime test`
capture was **1,163,042 B** (1.16 MB), over the 1 MiB evidence bound of
`scripts/eb3-evidence-guard.mjs`. It is NOT committed and nothing is hidden: it is fully
reproducible by the command below at this commit. This file carries the derived numbers, the
failure identities and a short head/tail excerpt; the 18 KB baseline comparison
(`baseline-5files.log`) is committed alongside it.

## Command

```
cd packages/runtime
pnpm --filter @dsh-agent-team/runtime test        # = vitest run
```

Run at `d7c5401e5` (PD-19 head), worktree `.worktrees/pd19-fact-attr`, 2026-11-08T06:01Z.

## Result

```
Test Files  5 failed | 478 passed (483)
     Tests  3 failed | 5993 passed (5996)
  Start at  06:01:19
  Duration  211.15s (transform 28.11s, setup 0ms, import 260.98s, tests 975.38s, environment 79ms)
Exit status 1
```

## The 3 failing tests / 5 failing files

| file | test or suite failure |
| --- | --- |
| `test/a5sf-os-runner.test.ts` | `P1-07 real OS leg (Landlock launcher) > refuses a network-deny policy when the backend cannot enforce it (no bare process)` — expected `{ok:false, code:'ENFORCEMENT_UNAVAILABLE'}`, host returned `{ok:true}` (this kernel enforces it) |
| `test/a5-globoff-key.test.ts` | `K7 (⑤): the four-tool matrix — …` — `Test timed out in 5000ms` |
| `test/a5rbn-runtime-base-narrow.test.ts` | `N3 REAL: whole-tree NAME enumeration is kernel-refused …` — `Test timed out in 5000ms` |
| `test/a4pr0a-fact-type-closed-set.test.ts` | suite failed to collect: `FACT_TYPE_CATEGORY block not found — the guard has no subject` (source-scan fixture) |
| `test/u7-f-agent-control-native-output-schema-c1.test.ts` | suite failed to collect: `native-schema C1 requires the pristine test-use checkout at tests/deepseek-harness-test-use` (path assumption under `packages/runtime` cwd) |

## Baseline provenance — NOT introduced by PD-19

The same 3 tests in the same 5 files fail on a **clean `origin/master` (`d590d58a0`) product tree**
with no PD-19 change:

```
cd packages/runtime   # main checkout, origin/master sources
npx vitest run test/a4pr0a-fact-type-closed-set.test.ts \
  test/u7-f-agent-control-native-output-schema-c1.test.ts \
  test/a5-globoff-key.test.ts test/a5rbn-runtime-base-narrow.test.ts \
  test/a5sf-os-runner.test.ts
→ Test Files  5 failed (5)
  Tests  3 failed | 21 passed (24)
```

Full baseline capture: `baseline-5files.log` (committed). The failure identity sets are identical
file-for-file/test-for-test. They are environment/latency-shaped (two 5 s timeouts on real
subprocess/Landlock work, a pinned-path assumption, and a kernel capability probe), not product
regressions from the attribution fields.

## Head excerpt (raw log, first 8 lines)

```
$ vitest run

 RUN  v4.1.11 /home/armourpiercer/projects/dsh-agent-team/.worktrees/pd19-fact-attr/packages/runtime

 ❯ test/a4pr0a-fact-type-closed-set.test.ts (0 test)
 ❯ test/u7-f-agent-control-native-output-schema-c1.test.ts (0 test)
```

## Tail excerpt (raw log, last 10 lines)

```
 ✓ test/alpha5-glob-backend-adversarial.test.ts (8 tests) 210606ms
     ✓ A1 a symlinked MIDDLE component onto the outside is refused before any child exists  3346ms
     ✓ A4 rename→symlink RACE LOOP: 5000 iterations, zero leak  13128ms
     ✓ A5 the REAL confined rg walk under the same swap race (6600 walks), zero leak  193316ms

 Test Files  5 failed | 478 passed (483)
      Tests  3 failed | 5993 passed (5996)
   Start at  06:01:19
   Duration  211.15s (transform 28.11s, setup 0ms, import 260.98s, tests 975.38s, environment 79ms)

/home/armourpiercer/projects/dsh-agent-team/.worktrees/pd19-fact-attr/packages/runtime:
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @dsh-agent-team/runtime@0.1.1-alpha.2 test: `vitest run`
Exit status 1
```
