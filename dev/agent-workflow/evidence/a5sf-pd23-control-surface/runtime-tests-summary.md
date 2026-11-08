# runtime package tests — derived result (PD-23 lane)

**Why this file and not the raw log**: the raw `vitest run` capture of
`packages/runtime` was **1,168,239 B** (1.12 MB), over the 1 MiB evidence bound of
`scripts/eb3-evidence-guard.mjs` (`EB3-EVIDENCE-GUARD`). It is NOT committed and nothing is
hidden: it is fully reproducible by the command below at this commit. This file carries the
derived numbers, the failure identities and why each is environmental, the base-vs-head
comparison, and a head/tail excerpt. Two small captures are committed alongside it:
`baseline-6files.log` (23 KB, the 6 involved files re-run on a tree WITHOUT this lane) and
`head-glob-backend-isolated.log` (5 KB, one file re-run alone at this head).

## Command

```
cd packages/runtime
npx vitest run                     # = pnpm --filter @dsh-agent-team/runtime test
```

Run at head `906076135` (branch `task/pd23-control-surface-20261114`),
worktree `.worktrees/pd23-control-surface`, 2026-11-08T10:25Z.

## Result (full package, 485 files, parallel)

```
 Test Files  6 failed | 479 passed (485)
      Tests  4 failed | 6008 passed (6012)
   Start at  10:25:44
   Duration  213.47s (transform 30.07s, setup 0ms, import 268.10s, tests 983.13s, environment 63ms)
Exit status 1
```

## The 4 failing tests / 6 failing files, and why each is environmental

| file | failure | why it is not this change |
| --- | --- | --- |
| `test/a4pr0a-fact-type-closed-set.test.ts` | suite failed to collect: `FACT_TYPE_CATEGORY block not found — the guard has no subject` (source-scan fixture over `packages/runtime/src/plugin/projection-source.ts`) | reads a product source file this lane never touches; identical on the baseline run below |
| `test/u7-f-agent-control-native-output-schema-c1.test.ts` | suite failed to collect: `native-schema C1 requires the pristine test-use checkout at tests/deepseek-harness-test-use` | path assumption relative to `packages/runtime` cwd; the checkout exists at the repo root, not at that relative path — environment |
| `test/a5-globoff-key.test.ts` → `K7 (⑤): the four-tool matrix …` | `Test timed out in 5000ms` | real subprocess/Landlock legs under 485-file parallel load; same 5 s timeout class PD-19 recorded |
| `test/a5rbn-runtime-base-narrow.test.ts` → `N3 REAL: whole-tree NAME enumeration is kernel-refused …` | `Test timed out in 5000ms` | real kernel legs on this host's Landlock; timeout-shaped, identical on the baseline run |
| `test/a5sf-os-runner.test.ts` → `P1-07 real OS leg (Landlock launcher) > refuses a network-deny policy when the backend cannot enforce it` | `expected {ok:false}` / host returned `{ok:true}` | **this kernel CAN enforce the policy**, so the "cannot enforce" leg's premise does not hold on this host — capability probe, not product |
| `test/alpha5-glob-backend.test.ts` → `X3 the timeout arm settles cancelled and spills nothing` | `expected 'completed' to be 'cancelled'` | **load-induced flake: passes 53/53 when the file runs alone at this same head** (`head-glob-backend-isolated.log`) — the 485-file parallel run starves its timeout arm |

None of the six files reads `cordis.patch.yml`, `PRODUCT-DEBT-REGISTER.md` or the governed
preset (`grep -l 'cordis.patch\|governed-member'` over all six → no match), and this lane
changes **no `packages/**` byte**.

## Baseline provenance — NOT introduced by PD-23

The same six files re-run on the **main checkout** (product sources at `235e1af8b`, i.e. no
PD-23 change at all; `baseline-6files.log`):

```
 Test Files  5 failed | 1 passed (6)
      Tests  3 failed | 74 passed (77)
   Duration  77.06s
```

Failure identity set: `a4pr0a` (collect), `u7-f` (collect), `globoff K7` (timeout),
`rbn N3` (timeout), `os-runner P1-07` (kernel) — the same five. The only difference from the
head's full-package run is `alpha5-glob-backend X3`, which **passes when run alone at the head**
(53/53) and failed only inside the 485-file parallel run: a load flake, not a regression.
PD-19's lane recorded the identical timeout/kernel/pinned-path class on its own base.

The gate line for this leg, stated honestly: **6008 passed, 4 failed in the full parallel run;
3 of those 4 fail identically without this lane, the 4th passes in isolation at this head.**

## Head excerpt (raw log, first 8 lines)

```
 RUN  v4.1.11 /home/armourpiercer/projects/dsh-agent-team/.worktrees/pd23-control-surface/packages/runtime

 ❯ test/a4pr0a-fact-type-closed-set.test.ts (0 test)
 ❯ test/u7-f-agent-control-native-output-schema-c1.test.ts (0 test)
stdout | test/alpha5-glob-backend.test.ts > A5-GLOB R — the gap as shipped (RED face, pinned verbatim; stays green forever) > R1 team_glob on the UNCONFIGURED plane row lands on the typed shut face, verbatim
[dsh-agent-team] a5-admission: event=production-admission-note
[dsh-agent-team] a5-admission: event=production-admission-note
```

## Tail excerpt (raw log, last 12 lines)

```
       |                                    ^
    989|     expect(result.outcome.files).toEqual([])
    990|     expect(sink.bytes()).toBe('')

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯


 Test Files  6 failed | 479 passed (485)
      Tests  4 failed | 6008 passed (6012)
   Start at  10:25:44
   Duration  213.47s (transform 30.07s, setup 0ms, import 268.10s, tests 983.13s, environment 63ms)
```
