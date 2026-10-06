# DSH 宿主升级轮 0.1.7-rc.1 → 0.2.0-rc.2 — 执行计划（U0–U9）

轮次：`task/dsh-020rc2-upgrade-20261003`（worktree `.worktrees/dsh-020rc2-upgrade`，base = `origin/master` @ `6b2f401bbc2f82e1eb3e561f71069d5aad2350fc`）。
用户授权（2026-10-03）：两个插件的 DSH 0.2.0-rc.2 版本维护（新 baseline、reference/test 更新、插件适配、测试、推送 GitHub）；**本 agent 只负责 team**；交付到 **独立可审查 draft PR 为止，不 merge**。

## 0. 硬约束（全程）

- CORE PATCH BUDGET = 0：宿主树零改动；`tests/deepseek-harness-test-use` 必须 porcelain 空且 HEAD == baseline。
- 冻结锚点不动：`references/deepseek-harness`（旧根，`feat/team-vnext-integration-20260829` / tag `legacy-agent-team-pre-vnext`）零触碰；共享新 baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` 只读。
- 旧根 `/srv/workspace/dsh-plugins/dsh-agent-team`（dirty 14 行：`SESSION_ROUTER_LOG` modified + 旧证据 untracked）**保留原样**：不 stash / reset / clean / 切分支 / 编辑；所有编辑只发生在本 worktree。
- :3080 稳定实例零触碰；测试端口 = 3180 族内空闲口；DSH_HOME 只在本 worktree `tests/homes/<world>`；只清理自己启动的进程。
- 有界 timeout、一次一个重型 build；不部署/重启当前 DSH；不改 security/network/model/provider 配置；不读取/输出 token 私钥。
- 旧 characterization fixture（`tests/characterization/fixtures/host-version.json` @ `fb2c4b9e`）与 `.github/workflows/characterization.yml` = **archived/manual 基线**：本轮不重标为本版 green、不重录、不跑。
- 历史证据（`dev/agent-workflow/evidence/**`、`SESSION_ROUTER_LOG.md` 既有条目、STATUS 历史行、TEST_METHODS §4/§6 历史）不改写。

## U0 baseline 核验与落位（read-only + 新 worktree 内）

- 远端 master 逐字核验 + `git fetch --prune`；worktree/branch 冲突检查；新 worktree 从准确 `origin/master` 创建。
- 共享 0.2.0-rc.2 baseline 核验（branch/HEAD/clean/version/remote + 远端同名分支 ls-remote）。
- 本 worktree 内建立 **独立 pristine 0.2.0-rc.2 checkout**（`tests/deepseek-harness-test-use`），记录 path/remote/branch/HEAD/clean；`pnpm install --ignore-scripts --frozen-lockfile`。
- 产出：`01-baseline-record.md`。

## U1 canonical pin 更新（单一来源）

- `tests/paths.mjs`：`TEST_USE_BASELINE_SHA` / `CLIENT_COMMIT_HASH` → `639ed01539…` / `639ed01539`；新增 `DSH_BASELINE_VERSION = '0.2.0-rc.2'`（版本字符串的单一来源），`paths.d.mts` 同步声明；基线历史行**追加**（旧行保留）。
- 消费方一律从 `paths.mjs` 取（不得散落硬编码）。

## U2 依赖 pin

- 根 `package.json` peer `@deepseek-ai/dsh` → exact `0.2.0-rc.2`（无 range、无 `*`）。
- `packages/runtime/package.json`（7 deps + 7 devDeps）、`packages/client/package.json`（6 devDeps）→ `0.2.0-rc.2`；cordis 系保持核验值。
- `pnpm-workspace.yaml` `minimumReleaseAgeExclude` → 由 regenerated lock 派生的完整 0.2.0-rc.2 集合（含 `@deepseek-ai/dsh` 本体），附派生方法注释。
- `pnpm-lock.yaml` 重生成 + `--frozen-lockfile` 干净安装复证。

## U3 RED-first：compat 门与失败面

- 先跑**未适配**的 `packages/testkit/test/plugin-dsh-compat.test.ts`（旧 0.1.7 期望）对 REAL 0.2 evaluator → 记录 RED（证明门真的在求值，不是字符串比对）。
- 再适配该测试到 0.2：runtime 自报 `0.2.0-rc.2`、exact-RC 正例、旧版本（`0.1.7-rc.1`）与后续版本反例被拒、无 exemption grant、peerless vacuous-pass 语义记录；随后补一个 manifest-mutation 反证（临时把 peer 改回旧值 → 必 RED → 复原）。

## U4 全量 unit 失败面分类

- `pnpm test`（根 vitest 全量）在 0.2 runtime 下跑一次，产出失败清单；逐条分类 = 0.2 真实不兼容 / 测试期望漂移 / 既有债务 / 环境。
- 既有债务基线（0.1.7 轮记录）= 19F + 3 collection（可比口径见 `docs/STATUS.md` 2026-10-01 行）；本轮**不为了绿灯弱化任何断言**，只修真实 0.2 不兼容与因 pin 漂移而必然失败的期望。

## U5 静态闸

- `pnpm build` → `pnpm build:composition` → `pnpm check:artifacts`（dist 同步提交）→ `pnpm typecheck` → `pnpm lint`（零新增指纹）→ p4t6（pin 按真实新增文件调整）→ zero-core（`--host tests/deepseek-harness-test-use` 0 findings）。

## U6 实宿主 smoke（本 worktree pristine 0.2 world）

- `tests/kits/rc2-real-host-smoke`（仓库活跃门禁）：fresh home（本 worktree `tests/homes/`）+ 空闲 3180 族端口 + pristine 0.2.0-rc.2 test-use 树；记录 VERDICT/EXIT/断言计数/日志路径；确认无 `compatibility.json` exemption grant。
- 前置：宿主 build 完成（`apps/cli/lib/bin.js` + `packages/boot/app-boot/lib/index.js`）。

## U7 文档 / 簿记（仅 current 指针，历史保留）

- `AGENTS.md` 基线行、`docs/TEST_METHODS.md` §1/§2 + §6 追加裁决条、`docs/STATUS.md` 顶部 current 行、`docs/INSTALL.md`、`docs/BRANCHING.md`、`README.md` release-status（视需要）。
- `dev/agent-workflow/graph.yaml` 新块 + `SESSION_ROUTER_LOG.md` 追加条目（本 worktree 副本）。

## U8 收口

- 精确记录：base/head SHA、diff 摘要、每条 gate 的命令/exit/passed/failed/未跑、upstream clean 证明、已知债务、未跑 gate。
- commit → 普通 push 新分支 → **draft PR → `ArmourPiercer1/dsh-agent-team` master**；**不 merge**（合并只在外部独立 review 后由用户裁决）。

## 未跑 / 明确排除（预告，终稿复述）

- characterization fixture/CI（archived/manual，0.1.5-rc.2 pin）；真浏览器 UI 维度；其他 real-host kits（c1/exec-contract/f15/pr-a…pr-f 等专项线）除非 U4/U6 失败指向它们；PIC/streak/research-control 两条并行迁移线（不触碰）；宿主 core 与 :3080 实例。
