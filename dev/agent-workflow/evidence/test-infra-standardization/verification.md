# test-infra-standardization — 验证证据（2026-09-12，Linux / node v24.21.0 / pnpm 11.7.0 / git 2.53）

任务：`tests/` 路径标准化（test-use checkout 归位 `tests/deepseek-harness-test-use`、DSH_HOME 归位 `tests/homes/`、
路径唯一来源 `tests/paths.mjs`、home 命名/清理协议）+ 进一步规范化（kit 归位、vitest.config 潜在 bug 修复、
upstream-resolver 双候选、CI 路径更新）。分支 `task/test-infra-standardization`（自 `a99c213`）。

## 1. 静态验证

- `node --check`：全部 16 个改动/新增 `.mjs` 通过。
- 残留 grep（旧路径 `references/deepseek-harness-test-use`、旧 home `references/.dsh-test*`）：仅剩**刻意保留**命中
  （历史 evidence、`dev/agent-workflow/**` 历史块、upstream-resolver 的 legacy 回退候选、a2-realfs 的 legacy 回退探针、
  TEST_METHODS §6 裁决历史文本）。
- `pnpm install --ignore-scripts --store-dir .pnpm-store`（根工作区）：OK（465 packages；store 必须工作区本地，
  沙箱约束，TEST_METHODS §5）。
- `pnpm typecheck`：exit 0（8 packages Done；legacy 无 tsconfig，既有事实）。
- `pnpm build`：exit 0（9 packages Done）。

## 2. 安装面产物门（check-artifacts-committed）

- 首次 `pnpm build:composition` → **STALE**：`packages/client/composition-shim/client-bundle.js` 1 行内容漂移。
- 根因（已定位，非本任务源码改动引起）：committed bundle 内嵌的 `ui/NewTeamEntry.module.css` 文本为 CRLF 转义
  （`\r\n`）—— 系原 Windows 机（core.autocrlf=true 检出）构建产物；本仓库 HEAD 的 CSS 源为 LF（磁盘与 index 一致，
  `git diff` 干净），`.gitattributes` 已将 `packages/client/composition-shim/**` 钉 `eol=lf`（G-RMR round-1 F-2 先例）。
- 处置：验证新构建 bundle 内嵌文本 == 提交源文件的 LF 渲染（程序化比对 `embedded==src(LF): true`），
  **提交重建的 bundle**（LF = 与 canonical 源 + gitattributes 钉一致的正确产物）。`pnpm check:artifacts` →
  `OK: 1104 files; committed install-surface artifacts match the fresh build`。
- 已核实 `packages/runtime/src/plugin/upstream-resolver.mjs`（本任务改动）**不在 dist**（dist 无该文件）——
  经根 `files` 白名单从 src 直接 shipped，故无 dist 重建需求；`git status` 确认 `packages/runtime/dist` 零改动。
- **登记跨平台代差（known gap，不在本任务修）**：`core.autocrlf=true` 机器上 CSS 源检出为 CRLF → 重建 bundle
  内嵌 CRLF → 会触发 stale 门（与 .gitattributes 的 LF 钉冲突）。根治 = 对 CSS 源加 `eol=lf` gitattribute（跨机
  检出行为变更，超出本任务范围）；在 Linux/`autocrlf=false` 环境（含 CI）该门确定性通过。

## 3. 聚焦回归（vitest）

- `packages/testkit/test/p4t6-session-event-scan.test.ts` **10/10**（pin = **690** 未动：`tests/` 下新文件不被
  frozen scanner 扫描，既有文件内容编辑不移动 pin ✓）。
- `packages/remote/test/p8t3-negative.test.ts` 7/7、`p8t4-negative.test.ts` 7/7（R2 token 规则
  `specifier.includes('deepseek-harness-test-use')` 对新位置天然命中，无需功能改动 ✓）。

## 4. client 包套件（47 文件）

- 前置事实：`packages/client/vitest.config.ts` 的旧 4 层上溯 URL 在主检出（非 worktree）解析到仓库**之外**
  （`/home/user/dsh-plugins/references/...` 不存在）→ srcMap 为空、uSES alias 悬空 —— 主检出中该套件从未可运行；
  本任务改为 marker 上溯（`tests/deepseek-harness-test-use`，主检出 + worktree 双通）。
- 另：套件经 srcMap 将全部 `@deepseek-ai/*` 重定向到 test-use 检出**源码**，其第三方依赖必须能在 test-use 检出
  自身 pnpm 布局内解析 → 该检出需 `pnpm install`（`--frozen-lockfile --ignore-scripts --store-dir <repo>/.pnpm-store`，
  38.7s，exit 0；node_modules 为 test-use 仓自身 gitignore，检出保持 pristine）。
- 结果：**46/47 文件、640/641 测试通过**。
- **唯一失败 = 预先存在（pre-existing），非本任务引入**：`test/team-creation-panel.client.spec.tsx` →
  `create happy path (TCM M4 two-stage v2)`，`expect(admitMock).toHaveBeenCalledTimes(0)` 得 1 次。
  证据链：
  1. 该 spec 与其实现（`packages/client/src/model/team-create-flow.ts`）均为 HEAD 未改动文件（本任务零触碰）；
  2. `runTeamCreateFlow` 中 `openCreatedSession`（L131）与 `admitInitialWorkV2`（L157）**同一微任务级联、零
     macrotask 间隔**（L131 await 之后到 L157 之间无 await/定时）—— `vi.waitFor`（定时轮询）观察点只能落在
     两次调用之前或之后，L453 断言在任何调度器下都不可能成立（本机 3/3 连跑确定性失败）；
  3. 该 spec/实现由 `4c67da9`（TCM-M4）一次性写成；其 commit 消息 Gates 节明示：*"the jsdom .client.spec.tsx
     migrations are typechecked here and run on the real machine; the sandbox blocks the vitest spawn"* ——
     该 jsdom spec 在其任务环境**从未执行过**，属 TCM-M4 引入的潜伏 spec/实现失配；
  4. 对照实验：用 HEAD 版 vitest.config.ts 跑该 spec → 收集失败（`no tests`，旧 URL 在本环境不可解析），
     证明旧配置下该文件在本环境从未运行过。
  **裁决请求（用户）**：修复 = 独立小任务（二选一：spec 的 L453 零调用断言放宽为冻结 §4.3 契约所要求的"open
  先于 admit"顺序断言；或实现中 open→admit 间显式让出）。本任务不越界改 P9-G5 冻结面测试。

## 5. 新鲜世界启动冒烟（3180 族；TEST_METHODS §2 文档化链条）

环境：`tests/deepseek-harness-test-use`（新 canonical 位置，detached @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d`
= 0.1.2-rc.1 官方 release 提交；`git clone --local references/deepseek-harness` 后 detach）。

1. `pnpm install --frozen-lockfile --ignore-scripts --store-dir <repo>/.pnpm-store` → exit 0（38.7s）。
2. `DSH_CLIENT_COMMIT_HASH=a66e470204 ESBUILD_WORKER_THREADS=1 node scripts/build.ts` → exit 0
   （`build: recorded 220 client artifact(s) with 2 public value(s)`）。
3. 操作前基线：`:3080` → 401（稳定实例在跑、未触碰）；`:3180` → 502（无实例）。
4. `DSH_HOME=<repo>/tests/homes/smoke-20260912T11-59-54Z node apps/cli/lib/bin.js web --port 3180 --no-open`
   → 启动行 `dsh web: http://127.0.0.1:3180/?token=01CS179-...`（host boot 完成，plugin tree loaded）。
5. `GET /`（无 token）→ **401**（鉴权门生效 ✓）。
6. `GET /?token=<launch-token>` → **303** + `Set-Cookie: dsh-auth-*`（HttpOnly，token 消费为会话 cookie）→
   带 cookie `GET /` → **200**（前端 shell 完整交付，`window.__ModuleLoader__` bootstrap 可见）——
   比文档 §2 判据（200 需前端 bundle）更强：apps/web 已随 build 构建，token→cookie→200 全链成立。
7. 停止（受管 background job kill）后：`:3180` dead；`:3080` 仍 401（未受影响 ✓）。
8. 冒烟后 test-use 复检：`HEAD = a66e4702047846cdaa10c66c9d3df3951f5ea70d`、`git status --porcelain` = **0 条目**
   （pristine 保持；build/install 产物全部在该仓自身 gitignore 内）。

**证据保留**：临时世界 `tests/homes/smoke-20260912T11-59-54Z`（§7 命名：`<line>-<UTC 时间戳>`；含 launch token，
gitignored，**永不提交**）—— 依 §7"保留则必须登记"，本文件即为登记。

## 6. 结论

新 canonical 布局（`tests/deepseek-harness-test-use` + `tests/homes/` + `tests/paths.mjs` 唯一来源）在
安装/构建/启动/鉴权全链上成立；frozen scanner pin（690）、negative-scan R2、安装面门、typecheck、build 全绿；
client 套件首次在本环境完整可运行（46/47，唯一失败为 TCM-M4 潜伏失配，见 §4 裁决请求）。
