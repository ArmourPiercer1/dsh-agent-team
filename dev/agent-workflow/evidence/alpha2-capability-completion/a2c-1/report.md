# A2C-1 — pwsh parameter permission — implementation report

Task: **A2C-1** (alpha.2 capability-completion, W1). Branch `task/a2c-1-pwsh-permission`
(base `99bc790`). Worktree `.worktrees/a2c-1` only. No push (per red lines).

## Status: DONE

`pwsh` is a first-class member of the operation-permission vocabulary: the A1 Blueprint
schema accepts `permissions` rules for `tool: pwsh` (tool-level class, same contract as
`bash`), and the runtime operation-permission layer (A2 canonicalization → A3 static
resolver → A4 control → A5 pre-execute end-cap → A6 parameter-permission listener)
authorizes/denies/asks pwsh calls by their full effect fingerprint (command + workdir +
background + timeout + sandbox), with fail-closed canonicalization and zero regressions
on the bash path (H5) and the hostile-prepend end-cap (H1).

## Commits

| short SHA | one-liner |
|---|---|
| `e5d1e00` | `A2C-1: pwsh in the operation-permission vocabulary + shell-class canonicalization (domain schema/types/validate + runtime operation-permission module)` |
| branch tip (this commit; self-referential — `git log -1` on `task/a2c-1-pwsh-permission`) | `A2C-1: tests (new 28-test probe suite + a1/a3 vocabulary pins) + evidence (RED/GREEN/gates/live)` |

## File ledger

- **new source files added = 0**
- **new test files added = 1** — `packages/runtime/test/a2c1-pwsh-permission.test.ts` (2016 lines, 28 tests: 4 RED probes P1–P4 + classification/vocabulary + §5.7 fingerprint matrix + deny/ask/allow-once + mismatch + fail-closed/bash/sibling/resume + real-pipeline legs over the full host stack)
- **modified files = 10**:
  - `packages/domain/blueprint/src/schema.ts` — `pwsh` admitted to the permission `tool` vocabulary (closed set, tool-level class)
  - `packages/domain/blueprint/src/types.ts` — `PermissionTool` union gains `'pwsh'`
  - `packages/domain/blueprint/src/validate.ts` — rule validation for the shell class (any/exact resource; exact rejected for shell tools per the closed contract)
  - `packages/runtime/operation-permission/types.ts` — `SHELL_PERMISSION_TOOL_VALUES`, `SHELL_TOOL_RESOURCE_KEYS`, canonical-operation shell fields
  - `packages/runtime/operation-permission/errors.ts` — per-tool closed `pwsh-*` canonicalization-failure reasons (mandated by the module docs)
  - `packages/runtime/operation-permission/canonical-operation.ts` — `canonicalizeShellOperation` (command raw-hash, never normalized; workdir/timeout/sandbox/background effect tokens); **4-line deviation fix**: `extractShellEffects` emitted hardcoded `bash-*` reasons for every shell tool — now `${tool}-…` (bash output byte-identical, pinned)
  - `packages/runtime/operation-permission/pre-execute-adapter.ts` — shell effect tokens in the request summary (`[cwd=…] [background] [sandbox=…] [timeout=Nms]` + 120-char preview truncation) and static-deny/ask-denied/guard-blocked reason surfaces
  - `packages/runtime/operation-permission/index.ts` — exports
  - `packages/domain/test/a1-permission-policy.test.ts` — a1 vocabulary pin 6→7 names
  - `packages/runtime/test/a3-permission-resolver.test.ts` — a3 vocabulary pin 6→7 names (discovered by the first GREEN run: the a3 pin failed post-fix; updated in the same category as the a1 pin)
- **evidence dir added** — `dev/agent-workflow/evidence/alpha2-capability-completion/a2c-1/` (this report + logs)

**expected scanner delta = 1** (p4t6: pin 690 → actual 691, exactly the new test file; the pin
file was NOT modified, per plan §2.3 — the main agent updates it at the integration tip):

```
AssertionError: expected 691 to be 690   (packages/testkit/test/p4t6-session-event-scan.test.ts)
```
`p4t6-scan.log` (dedicated run) + both full-suite logs show the same number.

## RED evidence (pre-fix facts at 99bc790)

`red-run.log` — `git stash push` (9 tracked edits) → `pnpm test` → `git stash pop`
(pre-stash/post-pop status snapshots: `pre-stash-status.txt`, diffed exact). The file
**loads** on the pre-fix tree (28 tests collected — no import errors; all imports exist at
99bc790) and fails on assertions only. 26/28 failed; the 2 pre-fix passes are the
non-discriminating bash regression pins. The 4 RED probes, each failing on the exact
pre-fix fact:

| probe | assertion | pre-fix observation (log pointer in red-run.log) |
|---|---|---|
| P1 classify | `classifyPermissionTool('pwsh')` = tool-level | `unsupported` (pwsh not in the vocabulary) |
| P2 static deny | deny policy ⇒ decision `deny`, 0 next-calls, reason frag `denies pwsh on pwsh` | `decisionKind: 'allow'` — pass-through reached the executor (nextCalls 1, body ran) |
| P3 rule contract | `ask: [{tool: pwsh, resource: any}]` parses clean | `MALFORMED_DTO` (unknown tool `pwsh` in the schema) |
| P4 live surface | static deny on the real pipeline ⇒ 0 body executions | `bodyDelta: 1` — the A2C-1 gap, observed live |

## Gate results

| gate | command | result | log |
|---|---|---|---|
| focused vitest (real) | `pnpm test a2c1 a1 a3 h5 h1a issue2` | **6/6 files, 185/185 tests pass** (new suite + both pins + bash-effects + end-cap + capability-precedence regression suites) | `gate-focused-vitest.log` |
| full root suite (real) | `pnpm test` | **21 failed / 3337 passed (3358) = baseline 20 + 1 expected p4t6 delta; ZERO new deterministic failures** (every failing file maps 1:1 to `../baseline.md`: t1-capability-schema ×9, t2-blueprint-hash ×1, p7t6-teammates-adapter ×1, d3-member-identity-context ×1, p6t3-mediation ×5, p6t3-restart ×2, p8s3b/t12a-b2/t12a-glue file-level ×3, p6t6-actions ×1, p4t6 ×1) | `green-run.log` |
| RED baseline diff | same suite at 99bc790 | 47 failed = 26 (this task's probes) + the same 21; my 28 tests flip to pass post-fix, no other test moves | `red-run.log` |
| node plain chain | `node scripts/run-tests.mjs domain runtime tools` | new file **PASS (28/28)** on the plain-node shim chain; runtime FAIL set **byte-identical to the 99bc790 baseline** (a2c4 `node-runner-baseline-at-99bc790.log` diff, modulo the domain package this run adds, whose t1/t2 failures are the same documented baseline set); the chain still aborts at the **pre-existing** `d5-instance-contract.test.ts:109` module-level `toHaveLength` shim crash (a2c4-verified at 99bc790, untouched file) | `gate-plain-node.log` |
| typecheck (runtime) | `tsc -p packages/runtime/tsconfig.json --noEmit` | **exit 0** | (run transcript in RED/GREEN phase) |
| typecheck (domain) | `pnpm --filter @dsh-agent-team/domain run typecheck` | **exit 0** | `typecheck-domain.log` |
| build | `pnpm build` | **exit 0**; 28 `packages/runtime/dist/**` regenerations **reverted** (`git checkout --`) before commit (alpha.2-round precedent, cf. a2c4 gate table: dist = local-verification only) | `build.log` |
| verify-zero-core (host C1–C3/C5) | `node scripts/verify-zero-core.mjs --host tests/deepseek-harness-test-use --status/--diff snapshots` | **pass: true, 0 findings** (2 INFO = upstream's own third-party `node-pty` patch); all four C5 snapshots **0 lines** (host byte-clean before/after) | `zero-core-host-result.json` + 4 snapshot files |
| verify-zero-core (C4, repo as plugin over the upstream host) | `… --host <upstream> --plugin .` | **49 findings — byte-matching the a2c4 precedent: 47 in `dev/agent-workflow/evidence/**` (archived snapshots) + 2 in `tests/characterization/probes` (deliberate fixtures); 0 in `packages/**`, 0 in any file this task touched** | `verify-zero-core-result.json` |
| p4t6 scanner delta | `pnpm test packages/testkit/test/p4t6-session-event-scan.test.ts` | expected red: **691 vs pin 690 (delta +1)**; pin unmodified | `p4t6-scan.log` |
| private-import surface | C4 scan + manual check | new test file imports only public upstream entries (`@deepseek-ai/cordis`, `dsh-scope`, `dsh-system-prompt`, `dsh-tools`, `dsh-llm`, `dsh-session`, `dsh-agent`); 0 C4 findings in task files | — |
| client-local suite | not run | A2C-1 touches no client/remote DTO surface (baseline.md: extra client gate required only for such tasks, expected A2C-3) | — |

## Live proof — PASS, 5/5 legs, 42/42 assertions

Real-host equivalent adaptation (plan §5.8): ephemeral instance on **127.0.0.1:3183**
(3181 GUI untouched, :3080 never touched), DSH_HOME = `tests/homes/a2c1-live-20260912T162326Z`
(retained, registered here — contains launch tokens, NEVER committed), pristine test-use
host @ `a66e470204` byte-clean before/after (`live-testuse-pre-state.txt`). The production
row pointed at an **out-of-tree** rebuild of the worktree sources
(`dist-a2c1-build/`, built via the canonical pipeline with only outDir overridden — the
committed dist is pre-A2C-1 by design, see Open risks; it is not committed as a derived
artifact, reproducible via `a2c1-live-runner.mjs` + `dist-a2c1-build/build.log`). The
worker's surface mounted a local test preset = shipped `standard` minus the one-line
`win32` gate on `tool-pwsh` (shipped install untouched; preset diff asserted). Mock-model
scripted the pwsh invocations (deterministic callIds, `a2c1-L*` nonce). Run
`2026-09-12 17:35:16→17:35:32 UTC`, runner exit 0 (`live-legs-20260912T162326Z.json`,
`live-boot-20260912T162326Z.log`, per-boot `instances/boot1..6/`). No assertion weakened
or skipped; no test/source file touched; CORE PATCH BUDGET = 0 held (profile-patch seam only).

| leg | result | key evidence (exact strings) |
|---|---|---|
| L1 static deny | PASS 6/6 | `permission denied by the static permission policy: the template's deny rule 0 denies pwsh on pwsh`; ZERO body executions; zero permission rows (a static deny never asks) |
| L2 ask→deny | PASS 7/7 | durable `leader-approval` request row mid-suspension (toolName `pwsh`, correlation = exact callId, requester = suspended worker instance, summary `pwsh [cwd=…] Get-ChildItem -Name`); `team.resolveControl` deny (human decider) → `the approval was denied`; zero consumptions |
| L3 ask→allow_once + re-ask | PASS 9/9 | the permission-vs-body leg: allow → 1 decision + **exactly one** `control-allow-consumed` row, and the body IS attempted — tool result `[stderr] bash: line 1: Get-ChildItem: command not found [exit code: 127]` (the predicted missing-binary class; body success = 0, failure strictly in the body layer, not the permission layer). Call 2 (fresh callId) → **new** request row (live re-ask) → deny → no body. Final: 2 requests / 2 decisions / 1 consumption |
| L4 builtinToolDeny:[pwsh] | PASS 6/6 | `pwsh` ABSENT from the worker's model-visible tool table (mock-captured `req.tools`); sibling `bash` present; scripted model still tried pwsh → `Error: unknown tool "pwsh"`; zero permission rows (never reaches the permission layer) |
| L5a allow-then-hard-stop | PASS 4/4 | allow + consumption durable (1/1/1) before SIGTERM |
| L5b cold resume | PASS 10/10 | fresh process reopens the SAME teamSession identity (rootSessionId + blueprintId + contentHash unchanged — adopted, not re-created); prior control rows persist; member row identical (no duplicates); all five leg roots visible; fresh call on the re-opened worker RE-ASKS → deny; final 2/2/1 |

Environment deviation (recorded, not an assertion change): the host has no
bubblewrap/Landlock sandbox backend, so under the default `workspace-write` file policy an
allowed body fails at the sandbox stage before spawn (run #8). The final run boots with the
documented process knob `DSH_PERMISSION_MODE=danger-full-access` (per
`apps/cli/reference/README.md` — "changes the process fallback"; the harness's own e2e
suite uses it exactly this way), which lets the allowed body reach spawn and produce the
brief's exact binary-missing signature (exit 127). It does not touch the A2C-1
tool-permission layer and is not asserted on. Live-semantics note: a fresh callId always
re-asks; the same-callId `allow-consumed` retry is unit-pinned (G4b) but unreachable
through the live loop (each turn mints a new callId).

## Deviations (all recorded)

1. **Test file 2016 lines vs the 500–1200 soft budget.** The brief's acceptance matrix
   (§5.7 full 13-item fingerprint matrix + 4 RED probes + classification/vocabulary +
   deny/ask/allow-once + mismatch/fail-closed/sibling/resume + real-pipeline legs over the
   full host stack) does not fit under 1200 lines while keeping every assertion explicit;
   nothing mandatory was cut. Comments were compressed as far as readability allows.
2. **4-line reason-string fix in `canonical-operation.ts`** (prior-session bug, carried in
   the stash): `extractShellEffects` hardcoded `bash-*` failure reasons for all shell
   tools; now per-tool (`${tool}-…`). The module docs + `errors.ts` closed set mandate the
   per-tool mirror; bash output is byte-identical (pinned by the regression test).
3. **a3 pin update** (11th-file deviation from the "9 modified files" ledger): the
   first GREEN run exposed `a3-permission-resolver.test.ts` pinning the old 6-name
   vocabulary; updated to 7 names, same order — same category as the already-planned a1
   pin update (the A2 handoff pin pair must not diverge).
4. **`pnpm test -- <file>` does not filter** in this repo (the `--` is passed through as a
   literal vitest arg and the full 281-file suite runs). Accepted: the full-suite RED and
   GREEN logs each deliver the complete baseline comparison in one artifact; the focused
   gate uses the plain positional form (`pnpm test <files>`), which filters correctly.
5. **Live-proof adaptation** (environment): this Linux host has no pwsh binary and the
   shipped `standard` preset gates `tool-pwsh` to win32 — plan §5.8's literal "Windows real
   standard preset" is infeasible here. Equivalent adaptation per the brief: ephemeral
   318x instance from the pristine test-use host, DSH_HOME = `tests/homes/a2c1-live-<UTC>Z`,
   a local test preset explicitly mounting `@deepseek-ai/dsh-tool-pwsh` (copy-edit of the
   shipped preset — the shipped install untouched), L3 body failure (spawn ENOENT) is the
   EXPECTED distinguisher between "permission authorized 1 dispatch" and "body succeeded".
   Outcome: **PASS 5/5 legs, 42/42 assertions, no fallback used** (see the Live proof
   section; evidence `live-proof.md` + `live-legs-20260912T162326Z.json`).

## Open risks

- **Integration-tip procedure — install-surface dist is stale on this branch by design.**
  Per the brief (「dist 只用于本地验证，不 commit」) and the a2c4 precedent (b4ab104), this
  commit ships source only; `packages/runtime/dist/**` at HEAD still carries the 6-name
  pre-A2C-1 vocabulary (no `pwsh`). At the integration tip the main agent must run
  `pnpm build:composition` (= `place-dist-glue.mjs` + client composition build +
  `scripts/check-artifacts-committed.mjs` freshness gate, R131 PBA discipline) and commit
  the regenerated `packages/runtime/dist/**` (+ `packages/client/composition-shim/**` if
  touched) in the tip commit — otherwise the committed git-install surface
  (`pnpm dsh plugin add github:...` ships it prebuilt, zero build scripts) contradicts the
  source: any live blueprint with a `pwsh` permission rule would fail domain validation
  against the stale dist (`must be one of read | read_image | write | edit | lsp | bash`).
- The a3 pin edit is a runtime-test change outside the original 9-file ledger; flagged for
  the reviewers (category: vocabulary-pin pair, same as a1).
- The p4t6 pin (690) stays red on this branch until the main agent applies the DEC-1 union
  update at the integration tip (documented expected behavior, plan §2.3).
- `builtinToolDeny` × parameter-permission interaction is pinned by the real-pipeline R-legs
  (tool absent ⇒ zero permission rows) and confirmed on a booted host by live leg L4
  (pwsh absent from the model-visible table, `unknown tool "pwsh"`, zero permission rows).
- The live legs relied on the mock-model scripted invocation; a real-LLM smoke (Windows +
  real pwsh) remains the §5.8 literal, deferred to the round-close integration host.
