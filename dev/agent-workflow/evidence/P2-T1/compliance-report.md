# P2-T1 合规报告 — pristine characterization harness

- **任务卡**：TaskDoc §11.3 `P2-T1`（`docs/plans/active/DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md` L959-972）
- **分支 / worktree**：`task/P2-T1-char-harness` @ `.worktrees/P2-T1`（base `cc6199b`，int/P2-seam-characterization）
- **执行轮次**：1 / ≤3
- **结论**：**SELF_VERIFIED** — 本地全命令全绿；zero-core 自检 exit 0；upstream 树前后 byte-clean。CI 未在本环境执行（见 §7）。

---

## 1. 逐项对照任务卡

### 1.1 目标 — 建立只通过 public exports 启动 pinned upstream 的 probe/test harness

**合规。** harness 以 pinned pristine upstream（`deepseek-ai/deepseek-harness` @
`cd5ef8148158c3a752a658978873241fdf8e2bbc`，v0.1.2-alpha.1，272 packages）为唯一运行时源码，
通过公开 seam（`$DSH_HOME/profiles/web/cordis.patch.yml` 顶层 `- insert:` 行，`name` = file URL）
挂载 probe 插件并以 `node apps/cli/lib/bin.js web --port <n> --no-open` 启动（TEST_METHODS §2 链）。
probe 载荷的 bare import 仅解析到 pinned 树（junction farm 提供解析位置），且只有 exports 表面
声明过的 subpath 能通过 —— 这一点被运行时负例端到端证明（§1.7）。harness 本体不 import 任何
bare specifier（C4，§4）。

### 1.2 拥有的文件/包 — `tests/characterization/**`；CI job

**合规。** 只新增/修改 owned-path（§2 清单）。CI job = `.github/workflows/characterization.yml`
（声明 `node tests/characterization/run.mjs` 为唯一测试命令；checkout team repo + pinned upstream
@ fixture SHA → `pnpm install --ignore-scripts` → TEST_METHODS §2 构建链 → 单命令自测 → evidence 工件）。
根 `package.json` / `tsconfig*` / `vitest.config*` 未触碰；harness 自带 plain-node 入口，
不依赖仓库脚本或第三方运行时。

### 1.3 前置依赖 — P1-T5

**合规。** P1-T5 交付的 `scripts/verify-zero-core.mjs`（C1a/C1b/C2/C3/C4/C5）被本任务作为
外部自检工具复用（§4），其 4 条 specifier 模式被 harness 内置 scanner（C4-equivalent）逐条对齐
（`lib/private-import.mjs`），保证"运行时挂载强制"与"静态扫描"用同一白名单语义。

### 1.4 允许依赖 — published/public DSH exports only

**合规。**

- harness 源码（`run.mjs`、`spawn-probe.mjs`、`lib/*.mjs`、`probes/*/index.mjs`）：
  **零第三方运行时依赖**，仅 `node:*` 内建 + 相对 import（C4 静态扫描 0 findings；外部
  verify-zero-core 对 `lib/` exit 0，§4）。
- probe 载荷：good probe 仅 import `@deepseek-ai/dsh-util-crypto` 根（exports 公开面，
  具名导出 `randomUUID()` 用作正控）；bad probe 故意 import 未声明 subpath
  `@deepseek-ai/dsh-util-crypto/internal/random` —— 它只存在于负例路径，永不被通过路径加载。
- 无 fork-only 包：全部断言只依赖 pristine upstream 自带包与团队自己的 `scripts/*`。

### 1.5 禁止项 — 全局 forbidden block

**合规。** 未修改 upstream 源码（tree 前后 `git status --porcelain` 与 `git diff` 均空，
HEAD 不变 `cd5ef814…`，evidence `logs/git-state-after.json`）；未 import upstream 私有 API
（负例证明未声明 subpath 在运行时即被 `ERR_PACKAGE_PATH_NOT_EXPORTED` 拒绝，且静态 C4 扫描
将其检出）；未使用 patch-package / pnpm patch / postinstall（安装用 `--ignore-scripts`，
harness 无 lifecycle 脚本）；未 push；未触碰 `:3080` 稳定实例与 `D:\deepseek-harness\`
（测试实例专用 DSH_HOME `references/.dsh-test-p2t1` + 专用端口 3281/3291，远离 3080/3180 段）；
`docs/plans/active/` 只读（仅读取任务卡原文）；`graph.yaml` / `SESSION_ROUTER_LOG.md` 未改
（编排状态由主 Agent 在任务完成后更新）。

### 1.6 实现要点 — 所有 seam probe 共用；不写产品 runtime

**合规。** 共享核心（`lib/`）+ 探针组框架（`probes/<group>/index.mjs` 约定 + 自动发现）：
P2-T2..T5 各加一个目录即可，不动核心（README「Adding a probe group」给出 ctx 契约：
`config / harnessRoot / probesRoot / surface / instance / log / pluginUrl / check`）。
harness 不实现任何产品 runtime 行为，只挂载、启动、dump、断言、恢复。

### 1.7 必须测试 — harness self-test；private-import negative test

**合规，两条都有且为机器判据：**

1. **harness self-test** = `node tests/characterization/run.mjs`（单命令，7 段全绿，exit 0）：
   preflight（含**起点 pristine** 证明）→ surface（白名单可建、正/负 subpath 准入抽查）→
   fixture（pin-drift 防护）→ static（§下）→ lifecycle（启动 marker / dump-config 含挂载行 /
   停止且端口释放）→ probes（smoke 全链）→ byte-clean（**终点** porcelain 空 + diff 空 +
   HEAD 不变，in-process file-fd git 子进程执行，无 shell）。
   规范运行：2026-08-29T17:07:22Z→17:07:47Z（~25 s），`summary.json` `ok:true`，
   `RESULT: PASS characterization self-test (all sections green)`（`run-all.log`）。
2. **private-import negative test** = 双层：
   - **静态（C4-equivalent）**：`lib/private-import.mjs` 用与 verify-zero-core 相同的 4 条模式扫
     harness 源码（harness 模式：0 bare import）与 probe 载荷（probe 模式：good 全准入、
     bad 全拒绝）；合成正控（`fixtures/scanner-controls.json`，JSON 不被扫描故与源码隔离）
     保证 scanner 非空转（回归护轨）。
   - **运行时**：smoke 组把 bad 行挂载进真实 composition seam 并真启动 —— 启动**必须失败**，
     失败日志含 `ERR_PACKAGE_PATH_NOT_EXPORTED` **且**点名挂载行 id
     `p2t1-smoke-probe-bad`（归因，而非泛化失败）；失败日志留证
     （`logs/instance-port3281-negative.log`，7423 B）。随后恢复 good 行并复启动成功（恢复链）。

### 1.8 验收标准 — 能在 pristine upstream、无 fork-only packages 下运行

**合规。** 规范运行的 host tree 即 pristine upstream @ 锁定 SHA（preflight 先证明其 clean，
byte-clean 段末再证明其 clean）；全程未引入任何 fork-only 包（§1.4）。host-version fixture
（schema `p2t1-host-version/1`：upstreamSha + 272 包 × {version, form, exportsKeys, rootTarget}）
把"pristine + 未漂移"固化成可执行断言。

### 1.9 输出物 — probe harness；host version fixture

**合规。** `tests/characterization/`（harness 本体，15 个 tracked 文件）+
`tests/characterization/fixtures/host-version.json`（已生成并提交）。

### 1.10 审查重点（给 Reviewer 的取证索引）

| Reviewer 必核项 | 证据位置 |
|---|---|
| owned-path | §2 清单 + 本分支 diff 只含 owned-path |
| frozen semantics | harness 只观察/挂载，不改 composition 顺序语义（bundles → cordis.patch.yml → --patch）；revert = `[]`；seam 行格式 `{id, name}` 与 G1 基线一致 |
| negative tests | §1.7 双层负例 + `logs/instance-port3281-negative.log` + fulltree 自检唯一 finding |
| zero-core 约束 | §4 三组调用与 exit code |

## 2. Owned-path 清单（本分支全部改动）

```
tests/characterization/
  run.mjs
  spawn-probe.mjs
  README.md
  lib/harness-core.mjs  lib/instance.mjs  lib/public-surface.mjs
  lib/private-import.mjs  lib/fixture.mjs  lib/tree-clean.mjs  lib/util.mjs
  fixtures/host-version.json  fixtures/scanner-controls.json
  probes/smoke/index.mjs
  probes/smoke/plugins/good-host.js
  probes/smoke/plugins/negative-fixtures/bad-host.js
.github/workflows/characterization.yml
dev/agent-workflow/evidence/P2-T1/**（evidence，只增不改）
```

运行期管道（gitignored，不入库）：`tests/characterization/probes/node_modules/@deepseek-ai/
dsh-util-crypto` junction → pinned 树（harness 每次运行幂等重建）。
未触碰：根 package.json / tsconfig / vitest.config / docs/plans/active / graph.yaml /
SESSION_ROUTER_LOG.md / references/ 任何 tracked 内容。

## 3. 规范运行事实（本地等价命令）

- 命令：`node tests/characterization/run.mjs --report-dir dev/agent-workflow/evidence/P2-T1`
  （worktree 根执行）；**EXIT=0**；~25 s；node v24.20.0；端口 3281（backup 3291 未用）。
- 7 段全 PASS：preflight / surface / fixture / static / lifecycle / probes / byte-clean。
- surface：272 包白名单；`@deepseek-ai/dsh-util-crypto` 根准入、`/internal/random` 不准入。
- lifecycle：boot marker `dsh web: http://127.0.0.1:3281/?token=…`（plugin tree 加载完成的
  机器级证明）；`--profile web --dump-config` 含挂载行；停止后端口释放。
- smoke 链：good 挂载→dump→启动→停 → bad 挂载→启动失败（`ERR_PACKAGE_PATH_NOT_EXPORTED`
  + 行 id 归因）→ 停 → good 恢复→复启动→停；终态 = good 行挂载（与 G1 基线同策）。
- byte-clean：起点/终点 `git status --porcelain` 空、`git diff` 空、HEAD 前后均为
  `cd5ef8148158c3a752a658978873241fdf8e2bbc`（`logs/git-state-after.json`，headSource=git）。
- 运行后环境：端口释放；upstream 树 byte-clean；DSH_HOME 保留（§6）。

## 4. Zero-core 自检（外部自证，exit code 留证）

`scripts/verify-zero-core.mjs`（P1-T5）三组调用（`--host` = pinned 树；从 worktree 根执行）：

| # | 调用 | 结果 | 证据 |
|---|---|---|---|
| 1 | `--host <pinned>` | **PASS (0 findings), EXIT 0** — pristine upstream 本身 zero-core 干净（node-pty 自补丁 = INFO，非 finding） | `zero-core-selfcheck-host.log` |
| 2 | `--host <pinned> --plugin tests/characterization/lib` | **PASS (0 findings), EXIT 0** — **harness 源码通过 C4** | `zero-core-selfcheck-lib.log` |
| 3 | `--host <pinned> --plugin tests/characterization` | FAIL (1 finding), EXIT 1 — **唯一 finding = 故意负例** `probes/smoke/plugins/negative-fixtures/bad-host.js:22`（`private-subpath`：`/internal/random` 不在 `@deepseek-ai/dsh-util-crypto` 公开面 `., ./invariant, ./src/*, ./package.json`） | `zero-core-selfcheck-fulltree.log` |

第 3 组是正控：C4 scanner 检出了故意植入的违规，且对树内**其余所有文件**（含 `run.mjs` 入口、
`spawn-probe.mjs`、smoke index、good probe）零 finding —— 覆盖是逐文件完整的
（verify-zero-core 恒跳过 `node_modules`，junction farm 不被扫；`.json` 不在 SOURCE_EXTENSIONS，
`scanner-controls.json` 对内外两个 scanner 均惰性）。

## 5. Evidence 清单（`dev/agent-workflow/evidence/P2-T1/`）

| 文件 | 内容 |
|---|---|
| `run-all.log` / `run-log.txt` | 规范运行全量日志（UTF-8，node 自写），59 行，`RESULT: PASS` |
| `summary.json` | `ok:true`，7 段，port 3281，finishedAt 2026-08-29T17:07:47.019Z |
| `zero-core-selfcheck-{host,lib,fulltree}.log` | §4 三组自检输出 |
| `logs/instance-port3281-negative.log` | bad 行启动失败全日志（含 `ERR_PACKAGE_PATH_NOT_EXPORTED` + 行 id 归因） |
| `logs/instance-port3281.log` | 恢复启动日志 |
| `logs/dump-config-lifecycle.txt` / `dump-config-port3281.log` | lifecycle 段 dump-config 全文（含挂载行） |
| `logs/git-{head,status,diff}.log` + `git-state-after.json` | byte-clean 捕获（status/diff 0 B = 空） |
| `fixture-write/{run-log.txt,summary.json,logs/git-*.log}` + `fixture-write.log` | fixture 再生成（仅 clean 树）留证 |
| `spawn-probe.log` + `spawn-probe-2026-08-29T*/` | 启动机制探针 P1–P4（§6.1） |
| `dryrun/` | 压缩前手工干跑日志（boot/dump 历史轨迹） |
| `compliance-report.md` | 本报告 |

## 6. 运行期环境

### 6.1 启动机制结论（spawn-mechanism probe）

workspace-write 沙箱内 node 子进程 spawn 矩阵（`spawn-probe.mjs`，`VERDICT:
P1-piped-node=denied P2-filefd-node=ok P3-inherit-node=ok P4-filefd-git=ok`）：

| 探针 | 机制 | 结论 |
|---|---|---|
| P1 | piped stdio（`stdio:'pipe'`） | **DENIED**：spawn 同步抛 `EPERM`（confined 模式禁止命名管道） |
| P2 | **file-fd stdio**（`fs.openSync` fd 作 stdio 项） | **OK**（node 子进程） |
| P3 | `stdio:'inherit'` | OK 但输出不可回收 |
| P4 | file-fd stdio | **OK**（git 子进程） |

**选型：file-fd stdio。** 因此单条 `node run.mjs` 即可驱动完整实例生命周期**并**在进程内执行
精确的 byte-clean git 命令（无 shell、无引号问题、输出可读回）；pwsh 层 spawn 不受限，仅作
手工兜底文档。

### 6.2 DSH_HOME 保留状态（`.dsh-test-p2t1`，保留不删）

```
profiles/   storages/   .anonymous-user-id   .credentials.yaml
profiles/web/cordis.patch.yml = good probe 行（id p2t1-smoke-probe，file URL → worktree 内 good-host.js）
```

与 G1 基线同策：测试后保留实例 home，composition 层停在 good 行，下次运行从已知挂载态开始。
共享 `references/.dsh-test` 与稳定实例（:3080 / `D:\deepseek-harness\`）全程未触碰。

## 7. CI

`.github/workflows/characterization.yml`：ubuntu-latest；checkout team repo +
`deepseek-ai/deepseek-harness` @ `cd5ef814…`（`fetch-depth: 0`，bare SHA）→ Node 24 + pnpm 11.7.0 →
`pnpm install --ignore-scripts` → TEST_METHODS §2 构建链（`DSH_CLIENT_COMMIT_HASH=cd5ef814`、
`ESBUILD_WORKER_THREADS=1`、`node scripts/build.ts`）→ **`node tests/characterization/run.mjs
--report-dir dev/agent-workflow/evidence/P2-T1`** → evidence 工件上传。
触发：pull_request + workflow_dispatch。

> **CI 未在本环境执行，本地等价命令已全绿**（§3；本环境无 CI runner 且禁止 push，无法触发
> 远端执行）。CI 与本地唯一实质差异：无沙箱 → 前端 bundle 可构建、`GET /?token=` 返回 200
> （本地为已知 404 非判据，TEST_METHODS §2.2）；junction farm 在 POSIX 下落为目录 symlink
> （`lib/instance.mjs` 平台分支已覆盖）。

## 8. 已知限制（显式状态，G2 口径）

1. **前端 bundle 404（沙箱内）**：vite→esbuild spawn 被沙箱拒绝 → `apps/web/dist` 不可构建 →
   `GET /?token=` 404。**已知非判据**：机器级启动证明是 `dsh web: http://…` marker（plugin tree
   全量加载完成），harness 只断言 marker + dump-config + 生命周期，不断言 GUI 渲染。CI 内正常 200。
2. **CI 未在本地环境执行**（§7），其绿色为待 CI 首次运行确认；本地等价命令已全绿。
3. **fixture 再生成仅在 byte-clean 树上允许**（`--fixture-write` 否则拒跑）—— 防止漂移被
   静默固化。
4. 端口策略：3281/3291；3080/3180 段与稳定实例隔离为硬红线。

## 9. 附录 — 开发中发现并修复的缺陷（过程留痕）

| # | 缺陷 | 修复 |
|---|---|---|
| 1 | `util.spawnToLog`：失败 spawn 同时触发 `error`+`close` → `closeSync` 二次关闭 EBADF | 幂等 `closeFds()`（fd 关闭标志 + try/catch），三处路径共用 |
| 2 | worktree 布局下默认 team root 错算到 worktree（`references/` gitignored，worktree 内不存在） | `findTeamRoot()`：自 harness 向上 ≤3 层找含 `references/deepseek-harness-test-use` 的祖先 |
| 3 | `walk()` 的 `skipNames` 类型不匹配（Set vs array）→ `has is not a function` | 调用端防御性归一（Set 化） |
| 4 | boot marker 正则漏了 port 与 query 之间的 `/`（`(\d+)\?token=` vs 实际 `3281/?token=`）→ 真实启动成功但 marker 永不命中 | 修正为 `(\d+)\/\?token=`；经 hexdump + 正则二分确认日志本身干净 |
| 5 | 静态扫描空转：扩展名比较 off-by-one（带点 `'.js'` vs 不带点 `'js'`）→ 所有文件被滤掉、一切扫描返回 0 findings | 修正 `ext` 取点前切片；**并加合成正控**（`fixtures/scanner-controls.json`，harness 模式 bare + probe 模式 private subpath 必须各被检出 1 次）作回归护轨 |
| 6 | scanner 自匹配：正控字符串若内嵌 harness 源码会被自身模式命中（2 个虚假 finding） | 正控移入 `.json` fixture（内外两 scanner 均不扫 JSON） |
| 7 | `discoverProbeGroups` 对裸 Windows 路径 `import()` → `ERR_UNSUPPORTED_ESM_URL_SCHEME` | `import(pathToFileURL(index).href)` |
| 8 | pwsh 5.1 `Tee-Object` 写 UTF-16LE → 证据日志被读端判"binary"；`cmd /c` 重定向路径解析失败 | 改由 node 自写 UTF-8 运行日志（每次截断后追加）；pwsh 仅负责调用与 ASCII 落盘 |
| 9 | smoke 归因只看 12 行 logTail → 行 id 行在更前，归因断言失败 | 归因文本 = 失败 detail + 完整失败启动日志（`readFileSync(instance.logPath)`），并持久化为 `-negative.log` 证据 |

## 10. 给 T2–T5 的交接

- 加组：`probes/<group>/index.mjs` 默认导出 `{ name, description, async run(ctx) }`；
  ctx 契约与规则见 README「Adding a probe group」。组内插件放 `probes/<group>/plugins/`，
  负例放 `plugins/negative-fixtures/`（永不被通过路径加载）。
- 组必须以「停止实例 + 恢复 composition 层」收尾（smoke 即模板：负例后恢复 good 行）。
- 需要新上游包的解析时：harness 的 `ensureProbeResolution` 已按 probe 源码实际 import 的包名
  自动建 junction farm，无需手改。
- 断言语义基准：启动 = boot marker；composition = `--profile web --dump-config` 文本；
  白名单 = `ctx.surface`（与 verify-zero-core 同语义）。
- 任何"需要改 upstream 源码 / import 私有 API / 加 fork-only 包"才能通过的 probe →
  记 `CORE_SEAM_BLOCKER:<seam>` 并停，不要绕过。
