# Gate Round 1 — Reviewer 1 裁决存档（产品 + 五闸独立复验 + 安装面消费者实验）

- **Agent ID**: 351a102a-ef44-464b-98eb-bbb681904517
- **Model**: qwen3.8-27b
- **审查范围**: `2f3f61b..a7bee2e`（7 commits，int/plugin-bundle-form）
- **Settled**: 2026-09-05（本地时间，gate round 1）
- **Verdict**: **通过 (PASS)**

---

# Blind Review #1 — `plugin-bundle-form` (int/plugin-bundle-form, a7bee2e; base 2f3f61b) — VERDICT

## 1. Verdict
**通过 (PASS)** — All five gates independently reproduced green, the git-dep install surface + export contract + artifact SHAs independently reproduced in my own consumer experiment, the end-to-end resolution mechanism (host `profiles/node_modules` fallback mirror) verified in host source + D5 world-5 artifacts, and no red-line violations; the only residual notes are a comment inaccuracy and pre-existing/documented test infra quirks, none material.

## 2. Verification table (claim → my independent check → result)

| # | Claim | My check (method) | Result |
|---|-------|-------------------|--------|
| 1 | `pnpm install` exit 0 on clean checkout | Ran in OWN worktree `D:\AgentDev\dsh-plugins\review-gate1` (on int tip): prepare chain = nested install + 9 tsc builds + composition, glue byte-identical, client-bundle 845690 B | ✅ exit 0 |
| 2 | typecheck 9/9 | Ran in my worktree | ✅ exit 0, 9/9 |
| 3 | build 9/9 | Ran in my worktree; then SHA-compared all 5 D5-claimed artifacts | ✅ exit 0, 9/9; **all 5 SHAs reproduced exactly** (client-bundle 6a8395ef…, shim index d385c065…, shim pkg b4509233…, dist glue d50d3b3f…, root pkg 3f39d558…) |
| 4 | lint 0 | Ran in my worktree | ✅ exit 0 |
| 5 | test 2404 passing | Ran full suite in in-repo detached worktree `.worktrees/gate1-inner` (implementer-equivalent layout) | ✅ **2404/2404, 220 files**, p6t1 green on first full run. Arithmetic closes: base 2353 + 9 new pbf + 42 t12a = 2404 |
| 6 | `pnpm dsh plugin --profile web add <git>` works on fresh install (DoD §0 includes one-time allowBuilds step) | MY OWN consumer experiment (`review-gate1-consumer` + bare clone of int tip): **first add** → exit 1 with `[ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED]`, printed key `dsh-agent-team@git+file:///…#a7bee2e…: true` — byte-identical to INSTALL.md §2. **Second add** after adding that allowBuilds key → exit 0 (138 s), prepare ran fully inside pnpm's store tmp checkout | ✅ reproduced end-to-end |
| 7 | Install surface materializes a coherent package | Inspected my consumer's `node_modules/dsh-agent-team` | ✅ top level = `packages`, `cordis.patch.yml`, `package.json`, `README.md` (files whitelist + README); NO nested `node_modules`, no lockfile/dev/.worktrees; `packages/client` = composition-shim only; `packages/runtime` = dist + root-binding + src. My store-built `host.js` (a0002033…) and `client-bundle.js` (6a8395ef…) SHAs **identical to D5 world-5's** — deterministic across independent store environments |
| 8 | Exports map + contract resolve in install context | Consumer-side: `import('dsh-agent-team')` → inert node half (function `apply`, exit 0); root manifest from consumer: `dsh.bundle.patch=./cordis.patch.yml`, `dsh.client={platform:web}`, `exports` all correct; installed client-bundle parses (`new Function`, 845690 B); seam.mjs + upstream-resolver.mjs present in install | ✅ (one expected exception, see §3.2) |
| 9 | Bundle auto-registration by host | Read test-use `apps/cli/src/plugin.ts` (reconcile: dep with `dsh.bundle.patch` → added to `dsh.profile.bundles`; else the exact legacy warning) + `packages/boot/app-boot/src/profile.ts` L832 | ✅ contract holds |
| 10 | Team UI renders (create/projection/handoff) in installed form | D5 world-5 evidence (read-only) + independent mechanism verification: gentry-report `failures: []` (G1 picker, G3 create+projection+wsPrefill, G4 handoff.prepare), 22 RPCs all 200, console/pageErrors empty; p6t6 row is a THIN observer (`inject: ['webServer','teamRoot']`, `packages/tools/harness/plugin.mjs:86`) — the BUNDLE row is the `teamRoot` provider, so its bootstrap (incl. glue load) genuinely ran in the installed form | ✅ |
| 11 | Unit tests pin new semantics | Read `packages/runtime/test/pbf-default-artifact-urls.test.ts` (9 tests: both layouts for glue/seam derivation, validator accepts absent / rejects empty glueUrl / explicit round-trip, withDefaultWorkspace pure + explicit-wins) + p4t6 scan pin 602→603 | ✅ all pass in my runs |
| 12 | cordis.patch.yml machine-agnostic | Read all 82 lines: host row `dsh-agent-team/host` (bootPhase/rootSessionId/blueprint/staticModel/env facts, NO glueUrl/seamUrl/defaultWorkspace) + client row `dsh-agent-team`; zero absolute paths/URLs | ✅ |
| 13 | host.ts derivations fail-closed/pure/regression-guarded | Read all 725 lines: `defaultGlueUrl` (co-located, no existence check → fail-closed at import), `resolveDefaultSeamUrl` (first-existing of 2 dist-first candidates else `TEAM_PLUGIN_GLUE_UNAVAILABLE`), `withDefaultWorkspace` pure (explicit wins, copies config), `glueUrl ?? default`, `seamUrl ?? resolve`, `rowConfig = withDefaultWorkspace(validatedConfig, process.cwd())`; explicit config always wins via `??` | ✅ |
| 14 | Composition dual registration + parse gate | Verified dual `window.__ModuleLoader__.load({id: "dsh-agent-team"/"@dsh-agent-team/client", factory})` tail in MY build output AND in consumer's installed bundle; parse-only gate `new Function(bundleText)` before write; client module system (test-use `system.ts` L114-120/L173+): register throws only on duplicate id, unclaimed ids inert, lazy materialization | ✅ |
| 15 | No `references/` in diff | `git diff --name-only 2f3f61b..int/plugin-bundle-form` | ✅ zero matches |
| 16 | Linear history on base, cherry-pick-applied | `git log --merges` empty; base is ancestor; 7 commits all carry `(cherry picked from commit …)`; int tip tree == task tip `0a50242` tree (empty diff) | ✅ |
| 17 | Evidence redacted per R125 precedent | Scanned all evidence files: every `token=`/`cookie` value `***REDACTED***`; 0 unredacted auth-header candidates; 859 alnum candidates audited (Windows paths/error codes/comments) | ✅ (nit in §4) |

## 3. Material findings (non-blocking)

**3.1 Load-bearing resolution dependency is real but sound (design note, verified).** The dist closure's only third-party import-time dependency is `yaml` (`packages/domain/blueprint/src/parse.js` via dist), and the ONLY file importing `@deepseek-ai/*` is the glue (`live/agent-bindings.mjs:138-141`, loaded after the resolver hook is registered). The git-dep install has NO nested `node_modules` (pnpm prunes by `files` — confirmed in both my consumer install and D5 world-5). Both requirements are answered by the HOST's `healProfilesModuleFallback` (`references/deepseek-harness-test-use/packages/boot/app-boot/src/profile.ts:557-605`): on EVERY profile launch it mirrors the running DSH install's dependency closure into `$DSH_HOME/profiles/node_modules` as **junctions into the host's own `apps/cli/node_modules`** (verified in world-5: `dsh-agent`/`dsh-llm` junction targets = the running checkout). That directory is exactly one walk-up level above any installed plugin (`profiles/<name>/node_modules/<pkg>/…`), so normal-first resolution is machine-agnostic, version-correct, and module-identity-shared with the host. This is the established mechanism all upstream profile bundles already use — not new to this task. Failure mode is fail-loud (setup-failure evidence path), never silent. No defect.

**3.2 My consumer's `import('dsh-agent-team/host')` stops at `yaml`** (`ERR_MODULE_NOT_FOUND`) — EXPECTED: my consumer is not a DSH profile, so the fallback mirror provider doesn't exist there. This actually confirms the closure has exactly one import-time external dep and that it is covered on any real host (D5 world-5 booted green, proving `yaml` + the 4 glue imports resolve under the host). Not a defect; recorded so the gate isn't misread as one.

## 4. Non-material observations

1. **Comment inaccuracy (new file):** `packages/runtime/src/plugin/upstream-resolver.mjs` header claims the fallback re-parents to "the install's own node_modules (prepare pins registry @deepseek-ai/* set)" — but the nested node_modules is PRUNED from the final install surface (verified). In the git-install world the live provider is the host's `profiles/node_modules` fallback mirror; the checkout-discovery fallback (`references/deepseek-harness-test-use` two levels up) returns null there by construction. Behavior is correct (normal-first + fail-closed), only the comment overstates what the fallback does for git installs. Suggest a comment fix in follow-up; no behavior change needed.
2. **`p6t1-parallel.test.ts` flake:** in my OUTER-location full run, 3 failures, all this file; isolated run 9/9 in 570 ms; green on first full run in the in-repo layout. Matches the documented known flake.
3. **t12a location-dependence (PRE-EXISTING, not in diff):** `t12a-live-bridge.mjs:42-48` computes `DSH_TEST_USE = <worktree>/../../references/…`, assuming the worktree sits at `<repo>/.worktrees/<x>`; from any other location the 7 t12a suites fail to load (2404→2362, 7 suite-load errors). Base commit fails identically at that location — not introduced by this task.
4. **Brief's diff list vs actual diff:** the brief mentioned `packages/client/package.json` and `eslint.config.mjs` — neither is in `git diff --name-only` (13 non-evidence files; the shipped client manifest is the generated `composition-shim/package.json`, and the root `package.json` carries `dsh.client`). No missing piece found.
5. **4-char cookie prefix** (`dsh-auth-t1v…`) visible in a boot log line; values themselves fully redacted — within R125 precedent (random session cookie prefix, not a credential).
6. **One-time allowBuilds step** is pnpm-≥10 host policy, unavoidable from the plugin side, explicitly in the task's own DoD §0, documented in INSTALL.md §2 with the exact error + key format, and the host CLI prints the same guidance (`apps/cli/src/plugin.ts:152-159`). Within the task's accepted scope.

## 5. Confirmations

- **Worktrees cleaned:** `git worktree remove --force` (manual dir purge + `worktree prune` for the two) — `review-gate1` and `.worktrees/gate1-inner` both gone; `git worktree list` back to the original 54-entry set (PBF task worktree untouched at `0a50242`).
- **Throwaway experiment dirs deleted:** `review-gate1-bare.git`, `review-gate1-consumer` removed (`Test-Path` = False).
- **Nothing modified outside my throwaway worktrees:** main repo `git status --porcelain` = empty (clean); two stray logs accidentally written to the main repo root during one mislocated command were deleted and re-verified.
- **Port 3180 untouched:** I started NO live instance; `Get-NetTCPConnection -LocalPort 3180 -State Listen` = 0 listeners. The D5 world's 3180 instance evidence is the implementer's (read-only by me).
- **`references/` untouched:** read-only throughout (test-use source + world-5 home inspected for verification, zero writes).
- **Frozen docs:** ROUTER_RULES.md + TEST_METHODS.md read in full; AGENTS.md read; frozen Architecture doc spot-checked for the governing constraint (CORE PATCH BUDGET = 0 — upheld: host source unmodified, everything rides public seams: profile bundle layer, cordis rows, client module system) and frozen UI doc's creation-panel/handoff UX (§32.3, source-session prefill) matches what the D5 gentry exercised on the installed form.

Methodology note: all verification performed in my own throwaway worktree + own git-dep consumer (bare clone of the int tip); no prior knowledge used; test-use host source and D5 world-5 artifacts were read strictly read-only.

---

## 主 Agent 分派注记（裁决后，R129 处理）

- **test 闸 8 文件失败的定性**：R1 外置 worktree 首跑 8 文件失败（7× t12a suite-load 环境性 + 3× p6t1 已知 flake）；R1 自行在仓内布局 `.worktrees/gate1-inner` 复跑 = 2404/2404 全绿（算术闭合 2353+9+42）；主 Agent 独立在 PBF 任务 worktree 复跑同 8 文件 = 51/51 全绿（`pbf-r1-failures-rerun.txt`）。定性：环境性 + 已知 flake，非实质性，不影响裁决；R1 本人亦判为非阻塞。
- **future-gate 规则（记入 R129 日志）**：reviewer worktree 必须建于 `<repo>/.worktrees/` 之下（t12a-live-bridge.mjs L42-48 放置假设）。TEST_METHODS.md 属用户裁决可改文档 —— 主 Agent 不单方编辑，仅在 R129 日志记录并向用户提议补注。
- **finding 4.1（upstream-resolver.mjs 头注释过述 fallback）**：非实质性，R129 仅记录于日志/风险账本；**不**在 R129 改产品文件（审查范围冻结 `2f3f61b..a7bee2e`）；留作后续 minor 任务。
- **findings 4.2–4.6**：p6t1 flake / t12a 位置依赖（预存，base 同位置同败）/ brief-diff 清单两文件不存在（无缺件）/ 4 字符 cookie 前缀（R125 先例内）/ allowBuilds 一次性步骤（DoD §0 范围内）—— 均记入 R129 日志，无动作。
- **裁决定性**：通过 = PASS 票（五闸独立复现全绿 + 独立消费者实验端到端复现 + 红线全净）。Gate round 1 现计：R1 通过 + R3 投机通过（= PASS），待 R2。
