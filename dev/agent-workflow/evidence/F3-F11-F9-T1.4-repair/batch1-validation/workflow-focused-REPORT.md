# Batch 1 workflow-focused validation — integrated `int/repair-r1` (fresh execution)

Date: 2026-09-08 13:00–13:10 +08:00
Model context: `qiyuan-self/qwen3.8-27b` (no real model turns used — deterministic checks only)
Branch: `int/repair-r1` @ `c46d3853771f0310142da0b5e6601d5a7442f9c6` (`fix(F9): assert frozen external-policy UI`)
Scope: focused regression validation of the integrated repair chain (F3-A/B/C, F11, F9 host, F9U, T1.4) + typecheck (client/remote/runtime) + artifact/upstream cleanliness. Read-only w.r.t. product code; no upstream/stable `:3080` operation; no push.

## Verdict

**PASS — all focused deterministic checks green on the integrated `int/repair-r1` HEAD, with fresh in-session execution.**

Every suite below was re-run (not transcribed from prior evidence) and matches the committed per-leaf evidence exactly. No regressions. The known baseline failures (documented in §6) are outside the focused sets and were not touched by any of these runs.

This report supersedes `REPORT.md` (2026-09-08, same directory) whose fresh execution was blocked by `spawn C:\nvm4w\nodejs\node.exe ENOENT` — that blocker is resolved in this session (see §2).

## 1. Checks executed (exact commands / results)

All commands run from the repository root `D:\AgentDev\dsh-plugins\dsh-agent-team` unless stated otherwise. Raw transcripts: numbered `.txt` files in this directory; drivers: `run-suite.ps1`, `run-00-env.ps1`, `run-18-typecheck.ps1`, `run-19-artifacts.ps1`.

### 1.1 F3-A / F3-B / F3-C focused suites (plain-node per-file runner — `vitest` cannot boot in this sandbox)

```powershell
# F3-A focused (6 files; expected 93 per f3/NOTES.md)
node dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/f3/run-file.mjs `
  packages/runtime/test/p8s3-work-chain.test.ts `
  packages/runtime/test/p8s5b-operation-fencing.test.ts `
  packages/runtime/test/p6t5-progress.test.ts `
  packages/runtime/test/p8s3b-result-effects.test.ts `
  packages/runtime/test/tcm-m3-root-initial-work.test.ts `
  packages/runtime/test/f3a-lock-scope.test.ts
# → PASS x6: 12+26+14+16+18+7 = 93/93 tests, "run-file: all named files pass", exit 0   [10-f3a-focused.txt]

# F3-B focused (6 files; expected 66 per f3b-NOTES.md)
node dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/f3/run-file.mjs `
  packages/runtime/test/tcm-m3-root-initial-work.test.ts `
  packages/runtime/test/tcm-m3-root-work-glue.test.ts `
  packages/runtime/test/p8s7r1-initial-work.test.ts `
  packages/runtime/test/tcm-g1-s6-integration.test.ts `
  packages/runtime/test/f3a-lock-scope.test.ts `
  packages/runtime/test/f3b-root-initial-work-lock-scope.test.ts
# → PASS x6: 18+9+9+11+7+12 = 66/66 tests, exit 0   [11-f3b-focused.txt]

# F3-C focused (4 files; expected 22 per f3c/NOTES.md)
node dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/f3c/run-file.mjs `
  packages/runtime/test/f3c-messaging-sibling.test.ts `
  packages/runtime/test/p6t3-mediation.test.ts `
  packages/runtime/test/p6t3-send-delivery.test.ts `
  packages/runtime/test/p6t3-restart.test.ts
# → PASS x4: 2+7+8+5 = 22/22 tests, exit 0   [12-f3c-focused.txt]
```

### 1.2 F9 host focused (+ supplementary F9 client v4 wrapper)

```powershell
# F9 host focused (2 files; expected 22 per f9/runtime-f9-focused.txt + f9/run-recipe.md)
node dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/f3c/run-file.mjs `
  packages/runtime/test/f9-s6-resolve-control.test.ts `
  packages/runtime/test/f9-control-exactly-once.test.ts
# → PASS x2: 14+8 = 22/22 tests, exit 0   [13-f9-host-focused.txt]
# (the F9 leaf's own scratch runner scripts/f9-targeted-run.mjs is uncommitted and absent on the
#  integrated branch; f3c/run-file.mjs is the same committed plain-node runner: same hooks
#  scripts/run-tests-hooks.mjs + shim scripts/test-vitest-shim.mjs, per-file semantics)

# F9 client v4 wrapper (supplementary; per f9/run-recipe.md acceptance row "client wrapper")
node --import ./.batch1-vitest-netuse-stub.mjs node_modules/vitest/vitest.mjs run --root packages/client test/f9-remote-client-v4.test.ts
# → 5/5 tests, 1 file passed, exit 0   [17b-f9-client-v4-vitest.txt]
```

### 1.3 T1.4 suite (t14h new suite + the 29-suite focused non-regression set, per t14/NOTES.md)

```powershell
# part 1 (14 files, S6/remote set incl. t14h-probe-merge)
node dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/t14/run-file.mjs `
  packages/runtime/test/t14h-probe-merge.test.ts `
  packages/runtime/test/tcm-g1-s6-integration.test.ts `
  packages/runtime/test/tcm-m1-s6-v2-routing.test.ts `
  packages/runtime/test/tcm-m2-workspace-attach.test.ts `
  packages/runtime/test/tcm-m3-root-initial-work.test.ts `
  packages/runtime/test/p8s7r1-initial-work.test.ts `
  packages/runtime/test/p8s7r1-create-params.test.ts `
  packages/runtime/test/p8s6-pagination.test.ts `
  packages/runtime/test/p8s6-principal.test.ts `
  packages/runtime/test/p8s6-projection.test.ts `
  packages/runtime/test/p8s6-push-reconnect.test.ts `
  packages/runtime/test/p8s6-remote-commands.test.ts `
  packages/runtime/test/t12h4-s6-fail-closed.test.ts `
  packages/runtime/test/t12b4-principal-context.test.ts
# → PASS x14: 10+11+5+14+18+9+8+9+20+14+5+7+2+8 = 140/140 tests, exit 0   [14-t14-focused-part1.txt]

# part 2 (15 files, assembly/gate/F3/compat set)
node dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/t14/run-file.mjs `
  packages/runtime/test/p8s5a-production-assembly.test.ts `
  packages/runtime/test/p8s5a-host-loadability.test.ts `
  packages/runtime/test/p8s3-work-chain.test.ts `
  packages/runtime/test/p8s3-work-request.test.ts `
  packages/runtime/test/p8s3b-result-effects.test.ts `
  packages/runtime/test/p8s5b-operation-fencing.test.ts `
  packages/runtime/test/p7t1-ack-fingerprint.test.ts `
  packages/runtime/test/p7t1-cold-resume.test.ts `
  packages/runtime/test/p7t1-inflight-drift.test.ts `
  packages/runtime/test/p7t1-probe-generation.test.ts `
  packages/runtime/test/f3a-lock-scope.test.ts `
  packages/runtime/test/f3b-root-initial-work-lock-scope.test.ts `
  packages/runtime/test/f3c-messaging-sibling.test.ts `
  packages/runtime/test/rmr-create-or-open-boot.test.ts `
  packages/runtime/test/rmr-remote-mount-race.test.ts
# → PASS x15: 7+3+12+5+16+26+16+12+14+19+7+12+2+6+7 = 168/168 tests, exit 0   [15-t14-focused-part2.txt]
# (the stderr "bootstrap FAILED" lines in the raw transcript are the EXPECTED negative-scenario
#  output of p8s5a/rmr suites — identical to the committed t14/focused-part1/2.txt)
# T1.4 total: 29/29 suites, 308/308 tests, t14h-probe-merge 10/10 (the T1.4-B new suite)
```

### 1.4 F11 focused client suite (vitest via the F11 netuse stub)

```powershell
# from the scratch worktree root (see §3.2 for why): .worktrees/batch1-validation-20260908
node --import ./.batch1-vitest-netuse-stub.mjs node_modules/vitest/vitest.mjs run --root packages/client `
  test/team-ledger-model.client.spec.ts test/ledger-adapter.test.ts test/team-ledger-store.test.ts test/team-ledger.client.spec.tsx
# → 4 files passed, 92/92 tests (21+27+24+20), vitest v4.1.11, exit 0   [16-f11-focused-vitest.txt]
```

### 1.5 F9U focused client suite (vitest via the stub)

```powershell
# from the scratch worktree root
node --import ./.batch1-vitest-netuse-stub.mjs node_modules/vitest/vitest.mjs run --root packages/client `
  test/f9u-control-surface-model.test.ts test/f9u-control-panel.client.spec.tsx `
  test/f9-resolve-control-ui.client.spec.tsx test/f9u-control-surface-probe.client.spec.tsx
# → 4 files passed, 41/41 tests (11+15+9+6), exit 0   [17-f9u-focused-vitest.txt]
```

### 1.6 Typecheck — client / remote / runtime

```powershell
# direct in-process tsc (npx/child spawn is EPERM in this sandbox — f9/run-recipe.md constraint 2)
node node_modules/typescript/lib/tsc.js -p packages/client/tsconfig.json --noEmit    # exit 0   [18-typecheck-client.txt]
node node_modules/typescript/lib/tsc.js -p packages/remote/tsconfig.json --noEmit    # exit 0   [18-typecheck-remote.txt]
node node_modules/typescript/lib/tsc.js -p packages/runtime/tsconfig.json --noEmit   # exit 0   [18-typecheck-runtime.txt]
```

### 1.7 Artifact / upstream cleanliness

```powershell
# a) committed gate script, verbatim attempt:
node scripts/check-artifacts-committed.mjs
# → spawnSync git EPERM (EXPECTED in this sandbox — documented in f9/run-recipe.md:
#    "check-artifacts-committed.mjs spawns git (EPERM here)"); exit 1   [19-artifacts-cleanliness.txt]

# b) pwsh-level three-way reproduction of that exact gate (A tracked-but-absent /
#    B produced-but-untracked / C content-drift via `git hash-object --stdin-paths`
#    against the `git ls-files -s` index) for packages/runtime/dist + packages/client/composition-shim:
git ls-files -s -- packages/runtime/dist packages/client/composition-shim
git ls-files --ignored --exclude-standard -o -- packages/runtime/dist packages/client/composition-shim
git hash-object --stdin-paths   (over the tracked ∩ on-disk file list)
# → tracked 1032 = produced 1032; A=0, B=0, C=0 → REPRO OK: committed install-surface
#    artifacts match the on-disk state exactly   [19-artifacts-cleanliness.txt]

# c) upstream + worktree statuses (all read-only):
git -C references/deepseek-harness-test-use status --porcelain   # → EMPTY (upstream pristine)
git -C D:\deepseek-harness status --porcelain                    # → EMPTY (stable deployment clean; no operation on :3080)
git status --short --branch                                      # → see §5
git diff --check                                                 # → exit 0 (only the 3 pre-existing CRLF warnings, §5)
```

## 2. Node discovery (supersedes the prior session's ENOENT blocker)

- `Get-Command node` → `C:\nvm4w\nodejs\node.exe`; `C:\nvm4w\nodejs` is a **symbolic link** to `C:\Users\user\AppData\Local\nvm\v24.20.0`, which exists and runs: `node --version` → **v24.20.0** (matches the Node used by all leaf evidence).
- The previous delegated session's `spawn C:\nvm4w\nodejs\node.exe ENOENT` no longer reproduces from this shell (the symlink now resolves; pwsh→node works).
- Confirmed sandbox boundary (TEST_METHODS.md §5): **node-initiated piped-stdio child spawn → EPERM** (verified this session: `execFileSync(node)` → EPERM). pwsh-level spawns (pwsh→node, pwsh→git) are allowed. All checks were shaped accordingly (plain-node in-process runners; direct `node …/tsc.js`; pwsh-level git for the artifact gate; vitest with `pool: 'threads'` = no child_process fork).
- PowerShell 5.1 session; the session harness wrapper corrupts bare `$`-variable assignments / bare `-p` flags in **inline** command strings (f3c/NOTES.md "Re-run notes") → all durable commands were driven through committed-to-evidence `.ps1` files (documented per-invocation in the transcripts).

## 3. Method notes (environmental findings — no product code touched)

### 3.1 Sandbox matcher/runtime limitations (unchanged from leaf evidence)

1. `vitest run` for the **runtime** package is unusable in this sandbox for the config-load spawn class; the plain-node per-file runner (`f3/`, `f3c/`, `t14/run-file.mjs`) is the documented equivalent (same hooks + shim).
2. The audited shim surface lacks `toBeUndefined`/`toContain`/`toBeDefined`/`toBeInstanceOf`/`toHaveLength`/async `it` — the 7 pre-existing runtime shim-surface red files (§6) are unaffected because none of them is in any focused set run here.
3. `d5-instance-contract.test.ts` can crash a shared shim process (pre-existing; not in any focused set run here).

### 3.2 `packages/client/vitest.config.ts` referencesRoot resolves only from worktree-depth checkouts (layout finding)

- The config computes `referencesRoot = new URL('../../../../references/deepseek-harness-test-use/', import.meta.url)`. From a **task worktree** (`.worktrees/<name>/packages/client/`) that resolves to the repo root, where `references/` lives. From the **main worktree** (`<root>/packages/client/`) it overshoots to `D:\AgentDev\references\` (verified: does not exist) → `buildSrcMap()` returns `{}` → the `@deepseek-ai/*` source-redirect plugin is a no-op.
- Consequence in the main worktree: the `.tsx` specs that import `@deepseek-ai/dsh-client-test-runtime` (→ `@deepseek-ai/dsh-client-ui-renderer/client`, a package that is NOT in `packages/client/node_modules` and is resolved ONLY via the source redirect) fail at import. Observed: 3 of the 4 F11 files (pure `.ts`, 72 tests) pass in the main worktree; `team-ledger.client.spec.tsx` fails import. This is a **main-worktree layout property, not a product regression** — every worktree-based run in this round (and the committed F11/F9/F9U evidence) ran from worktree-depth checkouts and is green.
- Disposition for this validation: the F11/F9U/F9-client focused vitest sets were executed in a **detached scratch worktree at `int/repair-r1` HEAD** (exact same layout the recipes use):
  - `git worktree add --detach .worktrees/batch1-validation-20260908 int/repair-r1` (HEAD `c46d385`, verified)
  - `pnpm install --ignore-scripts --store-dir D:\AgentDev\dsh-plugins\dsh-agent-team\.pnpm-store\v11` → **exit 0 in 60.7s, all reused from the shared store** [17-scratch-wt-install.txt]
  - F11 netuse stub copied verbatim (SHA-256 `D10869D9…` identical on both sides) as uncommitted scratch `.batch1-vitest-netuse-stub.mjs`
  - runs: §1.4 / §1.5 / §1.2 (client part)
  - teardown: `git worktree remove --force .worktrees/batch1-validation-20260908` + removal of the leftover `node_modules` tree → directory fully deleted, worktree list back to 86 entries (verified). Reversible, no durable world change.

## 4. Result matrix (fresh, integrated `int/repair-r1` @ c46d385)

| check | files/suites | result | expected (committed leaf evidence) | status |
| --- | --- | --- | --- | --- |
| F3-A focused | 6 | **93/93 PASS** | 93 (f3/postimpl-focused.txt) | ✅ |
| F3-B focused | 6 | **66/66 PASS** | 66 (f3b-postimpl-focused.txt) | ✅ |
| F3-C focused | 4 | **22/22 PASS** | 22 (f3c/postimpl-focused.txt) | ✅ |
| F9 host focused | 2 | **22/22 PASS** | 22 (f9/runtime-f9-focused.txt) | ✅ |
| F9 client v4 wrapper | 1 | **5/5 PASS** | 5 (f9/run-recipe.md) | ✅ |
| T1.4 new suite (t14h-probe-merge) | 1 | **10/10 PASS** | 10 (t14/postimpl-focused.txt) | ✅ |
| T1.4 focused non-regression set | 28 | **298/298 PASS** (29/29 suites total incl. t14h: 308/308) | 29/29 suites (t14/focused.txt) | ✅ |
| F11 focused (client vitest) | 4 | **92/92 PASS** | 92 (f11/green-f11-focused.txt) | ✅ |
| F9U focused (client vitest) | 4 | **41/41 PASS** | 41 (f9u/f9u-focused.txt) | ✅ |
| typecheck client | — | **exit 0** | exit 0 (f9u/typecheck-build.txt) | ✅ |
| typecheck remote | — | **exit 0** | exit 0 (f9/run-recipe.md) | ✅ |
| typecheck runtime | — | **exit 0** | exit 0 (t14/NOTES.md, f3*/NOTES.md) | ✅ |
| artifacts (runtime dist + composition-shim) | 1032 files | **A=0 B=0 C=0** (gate script itself EPERM-blocked in sandbox; pwsh 3-way reproduction OK) | committed state (PBA/R131 gate) | ✅ |
| upstream test-use pristine | — | **porcelain empty** | empty (CORE PATCH BUDGET = 0) | ✅ |
| stable `D:\deepseek-harness` | — | **porcelain empty** (read-only status only; :3080 untouched) | clean | ✅ |
| team worktree diff | — | no new tracked modifications (§5) | — | ✅ |

## 5. Worktree state (pre-existing dirt — NOT introduced by this validation)

`git status --short --branch` at start and at end (transcripts: `00-env-baseline.txt`, `20-git-status-after.txt`):

- Modified (pre-existing, identical before/after — 3 files, untouched by this run):
  `tests/mock/hosts/boot1/dump-config-port3181.log`, `tests/mock/hosts/boot1/dump-config.txt`, `tests/mock/hosts/boot1/instance-port3181.log`
- Untracked (pre-existing): `.g3r3-clientbundle.diff`, `.playwright-cli/`, `HANDOFF-remote-mount-405.md`, `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/playwright-r1/`, `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/playwright-workflow/`, `dev/agent-workflow/evidence/playwright-acceptance/`, `dev/agent-workflow/evidence/team-d1-d6-repair-v2/{B3,G2,G3}/*`, `docs/PLAYWRIGHT_ACCEPTANCE_PLAN.md`, `docs/local-issues/`, `tests/mock/.dsh-home-repair-r1/`
- Untracked, created by **this** validation (evidence only): `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/batch1-validation/` (this report + transcripts + drivers)
- Untracked, appeared during the session from **concurrent external activity** (not this session's commands — no command here touches `tests/mock/`): `tests/mock/.playwright-daemon/`
- `git diff --check`: exit 0 (only CRLF-normalization warnings on the 3 pre-existing modified mock logs).

## 6. Known baseline failures (recorded; outside the focused sets; not re-triggered)

1. **Client (1, pre-existing since a6d1778, byte-identical at base 9b582a1)**: `test/team-creation-panel.client.spec.tsx › TeamCreationPanel › create happy path (TCM M4 two-stage v2)` — `admitMock).toHaveBeenCalledTimes(0)` got 1. Full-client context in this round: 639 passed / 1 failed after F9U (f9u/vitest-client-full.txt), i.e. the same single pre-existing test. The F11/F9U **focused** sets (run here) do not include that file → 0 failures, as observed.
2. **Runtime plain-node shim (7, pre-existing shim-surface gaps — matchers outside the audited shim surface / async `it`)**: `d1-member-base-tools` (3/6), `d1-s6-remote-v3` (6/14), `d1-team-ownership-index` (5/16), `d2-s6-ensure-root-live` (5/10), `d3-member-identity-context` (1/5), `d5-instance-contract` (2/9 + top-level crash), `pbf-default-artifact-urls` (3/9). Identical pre/post across F3-A/B/C/T14 full sweeps (137-file sweeps: 130 ok / 7 bad). None is in any focused set run here. Full-package sweeps were **not** part of this batch (task scope = focused suites + typecheck + cleanliness); under real vitest these 7 pass (prior rounds' evidence) — the shim-surface limitation is environmental, not a product defect.
3. **`d5-instance-contract` shared-process crash** (pre-existing; documented in f9/run-recipe.md constraint 6) — not applicable to any run here (single-suite processes, d5 excluded).

## 7. Safety / reversibility ledger

- No product source, test, config, or artifact file was modified by this session (tracked-tree delta vs start: **none**; §5).
- Created & removed: scratch worktree `.worktrees/batch1-validation-20260908` (detached @ c46d385) incl. its `node_modules` (shared store, 0 downloads) and the stub copy — fully deleted, verified.
- Created: `batch1-validation/` evidence directory (transcripts + `.ps1` drivers + this report) — untracked, evidence-plane only.
- Upstream `references/deepseek-harness-test-use`: untouched, porcelain empty before and after. `references/` was READ only (never written).
- Stable deployment `D:\deepseek-harness` / `:3080`: **no operation of any kind** — a read-only `git status --porcelain` on the checkout only (clean).
- No push, no remote operation, no `:3080`/`3180` instance start/stop.
- `CORE PATCH BUDGET = 0` held.

## 8. Gate implications

1. **Focused regression on the integrated branch: PASS.** All deterministic focused checks of the F3/F11/F9/T1.4 repair chain reproduce green on `int/repair-r1` @ c46d385 with fresh execution — the integrated state carries no focused-level regression from the leaf states recorded in `f3/`, `f11/`, `f9/`, `f9u/`, `t14/`.
2. **Per the frozen contract DAG (minimum-frozen-contract.md §7), focused evidence is fail-fast evidence, NOT round acceptance.** This result clears the "no focused regression" precondition but does **not** by itself satisfy: (a) the per-task E0/H0 reviews, (b) the GATE-1/GATE-2 three-blind-reviewer cycles, (c) the D-RUN/G full live-boot matrix (3181/3491/3492 mock world) which is the round's acceptance evidence.
3. **First-push (E2) readiness**: the focused/typecheck/artifact/cleanliness gates that gate-readiness evidence depends on are all green here; the known baseline failures (§6) are documented, pre-existing, and unchanged. No new blocker surfaced.
4. **Reviewer note (layout finding §3.2)**: any gate reviewer re-running the **client** vitest suites must do so from a worktree-depth checkout (`.worktrees/<name>/`) — from the main worktree the `references/` source redirect in `packages/client/vitest.config.ts` silently no-ops and the `.tsx` specs that import `@deepseek-ai/dsh-client-test-runtime` fail at import. This predates the repair round (affects the base commit equally) and is environmental, not a product defect; it is recorded here for reviewer reproducibility. A one-line path-fix in the config (worktree-depth-independent referencesRoot) is a candidate future hardening, out of this validation's scope.
5. **Sandbox note for the gate**: `node scripts/check-artifacts-committed.mjs` cannot run in this workspace-write sandbox (node→git spawn EPERM); the three-way check was reproduced at pwsh level with identical semantics (index vs disk vs `hash-object --stdin-paths`), result OK. In an unrestricted environment the committed script should also be re-run once for completeness (obligation inherited from the leaf evidence, e.g. f3/NOTES.md blocker 1: real-vitest re-run of the runtime package in an unrestricted environment remains open as well).

## 9. Evidence index (this directory)

| file | content |
| --- | --- |
| `00-env-baseline.txt` | date, node (v24.20.0 + source), branch/head, git status BEFORE |
| `10-f3a-focused.txt` … `15-t14-focused-part2.txt` | raw suite transcripts (headers carry exact cmd/cwd/timestamps; footers carry exit + elapsed) |
| `16-f11-focused-vitest.txt`, `17-f9u-focused-vitest.txt`, `17b-f9-client-v4-vitest.txt` | raw client-vitest transcripts (scratch-worktree cwd recorded) |
| `17-scratch-wt-install.txt` | scratch worktree `pnpm install` transcript |
| `18-typecheck-{client,remote,runtime}.txt` | raw tsc transcripts |
| `19-artifacts-cleanliness.txt` | verbatim gate attempt (EPERM) + pwsh 3-way reproduction + all upstream/worktree statuses |
| `20-git-status-after.txt` | git status AFTER (delta vs `00-env-baseline.txt` in §5) |
| `run-suite.ps1`, `run-00-env.ps1`, `run-18-typecheck.ps1`, `run-19-artifacts.ps1` | reproducible drivers (the `.ps1` form is required by the session wrapper's inline-string corruption, f3c/NOTES.md "Re-run notes") |
| `REPORT.md` | prior (2026-09-08) batch1 validation — superseded for fresh-execution purposes by this report |

**Return: PASS — gate implications per §8.**
