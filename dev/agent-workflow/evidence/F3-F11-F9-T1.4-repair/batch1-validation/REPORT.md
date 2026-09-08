# Batch 1 focused regression — integrated `int/repair-r1`

Date: 2026-09-08
Model context: `qiyuan-self/qwen3.8-27b` (no real model turns used)
Branch: `int/repair-r1` (HEAD observed `b34f96c`)
Scope: read-only validation; no code edits, no upstream/stable `:3080` access, no push.

## Verdict

**Focused regression evidence: PASS (using the committed repair-r1 focused transcripts); fresh execution in this delegated shell was NOT possible. First-push gate: NOT READY.**

The gate is not ready because the integrated worktree is not clean (pre-existing modified mock logs and untracked evidence/assets), and the delegated command runner could not launch Node (`spawn C:\nvm4w\nodejs\node.exe ENOENT`). This report does not normalize or remove those files.

## Exact focused commands / results

The canonical commands are the following (all from repository root, using the plain-node per-file runner because Vitest config loading is sandbox-blocked):

```powershell
node dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/f3c/run-file.mjs `
  packages/runtime/test/f3a-lock-scope.test.ts `
  packages/runtime/test/f3b-root-initial-work-lock-scope.test.ts `
  packages/runtime/test/f3c-messaging-sibling.test.ts `
  packages/runtime/test/p8s3-work-chain.test.ts `
  packages/runtime/test/p8s5b-operation-fencing.test.ts `
  packages/runtime/test/p6t5-progress.test.ts `
  packages/runtime/test/p8s3b-result-effects.test.ts `
  packages/runtime/test/tcm-m3-root-initial-work.test.ts `
  packages/runtime/test/p6t3-mediation.test.ts `
  packages/runtime/test/p6t3-send-delivery.test.ts `
  packages/runtime/test/p6t3-restart.test.ts
```

Committed focused evidence for the integrated repair chain:

- F3-A focused: `f3/postimpl-focused.txt`: 12/12 + 26/26 + 14/14 + 16/16 + 18/18 + 7/7 = **93/93 tests**.
- F3-B focused: `f3/f3b-postimpl-focused.txt`: 12/12 + 18/18 + 9/9 + 9/9 + 11/11 + 7/7 = **66/66 tests**.
- F3-C focused: `f3c/postimpl-focused.txt`: 2/2 + 7/7 + 8/8 + 5/5 = **22/22 tests**; F3-A non-regression rerun 7/7.
- F11 focused Vitest transcript `f11/green-f11-focused.txt`: 4 files, **92/92 tests**.
- T14-H focused: `t14/postimpl-focused.txt`: **10/10 tests**; T14 focused non-regression set `t14/focused.txt`: **29/29 suites pass**.
- F9 host focused `f9/runtime-f9-focused.txt`: `f9-s6-resolve-control` 14 + `f9-control-exactly-once` 8 = **22/22 tests, 0 failures**.

F9 client/UI focused evidence was also present from the integrated repair assets (`f9u/f9u-focused.txt`): 4 files, **41/41 tests**. It is supplementary to the requested host-focused suites.

## Typecheck/build evidence

Canonical package commands (direct `tsc`, avoiding recursive pnpm spawn under sandbox):

```powershell
npx tsc -p packages/remote/tsconfig.json --noEmit
npx tsc -p packages/runtime/tsconfig.json --noEmit
npx tsc -p packages/client/tsconfig.json --noEmit
npx tsc -p packages/contracts/tsconfig.build.json
npx tsc -p packages/domain/tsconfig.build.json
npx tsc -p packages/storage/tsconfig.build.json
npx tsc -p packages/remote/tsconfig.build.json
npx tsc -p packages/runtime/tsconfig.build.json
npx tsc -p packages/tools/tsconfig.build.json
npx tsc -p packages/client/tsconfig.build.json
npx tsc -p packages/legacy/tsconfig.build.json
npx tsc -p packages/testkit/tsconfig.build.json
```

Recorded repair evidence reports all touched-package typechecks/builds exit 0 (F3/F3-B/F3-C/T14 runtime; F9 remote/runtime/client; F11 client). The current delegated shell could not rerun these commands because Node failed to launch with `ENOENT`.

## Artifact / upstream cleanliness checks

Canonical checks:

```powershell
git status --short --branch
git diff --check
git diff --stat
node scripts/check-artifacts-committed.mjs
git -C references/deepseek-harness-test-use status --porcelain
git -C D:\deepseek-harness status --porcelain
```

Observed at validation start:

- Current Team worktree is **not clean**: modified `tests/mock/hosts/boot1/dump-config-port3181.log`, `dump-config.txt`, `instance-port3181.log`; multiple untracked evidence/assets including `.playwright-cli/`, `dev/agent-workflow/evidence/playwright-acceptance/`, and `tests/mock/.dsh-home-repair-r1/`.
- No code changes were made by this validation.
- The repair leaf evidence records upstream/test-use source untouched and artifact rebuilds completed on the worker branches. A fresh artifact script/status run was blocked by the same Node ENOENT.
- No stable `:3080` or `D:\deepseek-harness` operation was performed.

## Known sandbox matcher/runtime limitations

1. `vitest run` cannot boot in this workspace-write sandbox: Vite 8 Windows safe-realpath probing executes `net use`; node child spawn is denied with EPERM. Use the committed plain-node per-file runner or the F11 netuse stub.
2. Plain-node shim supports only audited matchers (`toBe`, `toEqual`, `toBeGreaterThan`, `toThrow`, plus `.not`); it lacks `toBeUndefined`, `toContain`, `toBeDefined`, `toBeInstanceOf`, `toHaveLength`, and async `it` support.
3. Consequently the full runtime sweeps retain seven known pre-existing shim-surface failures (`d1-member-base-tools`, `d1-s6-remote-v3`, `d1-team-ownership-index`, `d2-s6-ensure-root-live`, `d3-member-identity-context`, `d5-instance-contract`, `pbf-default-artifact-urls`); these are not repair regressions.
4. `d5-instance-contract` can crash a shared shim process; full sweeps isolate one process per test file and exclude/contain that known failure.
5. Recursive `pnpm -r` lifecycle/build commands can hit EPERM; direct `tsc` commands are the documented workaround.
6. Delegated validation shell additionally had `spawn C:\nvm4w\nodejs\node.exe ENOENT`, preventing fresh command execution in this turn.

## Safety

No product source, upstream checkout, stable development instance, or remote was modified. No push was attempted.
