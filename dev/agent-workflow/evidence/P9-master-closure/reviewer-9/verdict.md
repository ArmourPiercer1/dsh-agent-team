# Reviewer-9 Verdict — P9 master product closure → master

- **Reviewer**: reviewer-9（facet：fresh-machine 可安装性 与 红线）
- **Gate**: P9 master product closure → master（int tip `39fe1df` fast-forward master `2c1c200`；merge `232316d` = master + `task/upstream-rc1-compat` tip `bd38827`；int commits `8cf9fcb` `071080d` `2359d31` `ad0a869` `39fe1df`）
- **Review tree**: `.worktrees/R3MC-3`（detached @ `39fe1df`）；所有确认性命令均在本 worktree 或等价树中由本人执行（读日志不算确认）。
- **路由核验**: 本会话模型路由为 qiyuan-self/qwen3.8-27b，继承自主会话。
- **独立性声明**: 未读取 reviewer-4/5/6 的 verdict/摘要；本裁决不依赖任何其他 reviewer 的意见。

## VERDICT: 补充内容

**Nature**: 审计区间内存在一处明确、简单的文档缺陷 —— `docs/INSTALL.md` §3 挂载模板中 `blueprintSource` 的 `|` 文本块（L67–L99）**缺少 `---` frontmatter 定界符**。逐字照抄该模板时，`validateTeamPluginConfig` 通过（只要求非空字符串）且 boot 链正常，但首次 `team.create` 会在 `parseBlueprint → splitFrontmatter` 处以 `MALFORMED_DTO`（reason `frontmatter-missing`）失败。产品代码、构建链、composition 工件、fresh-machine 可安装性、smoke 与全部红线均已独立验证为绿色。修复为 2 行文档改动，不改产品代码，无需重跑完整流水线（解析路径已在 R122 verified world、boot kit 自带 blueprint 与本人独立复跑中按正确形态验证过）。

---

## 1. 检查表（command → expected → actual → PASS/FAIL）

### 1.1 文档审计（docs/INSTALL.md）

| # | 检查 | 命令/方法 | 期望 | 实际 | 结果 |
|---|------|-----------|------|------|------|
| D1 | §2 构建链命令存在性 | 读 `package.json` scripts + 存在性检查 `scripts/place-dist-glue.mjs`、`scripts/build-client-composition.mjs` | `pnpm install --ignore-scripts` / `pnpm run build`(=`pnpm -r run build`) / `pnpm run build:composition`(=place-dist-glue && build-client-composition) 全部存在且与脚本文件一致 | 全部存在，两脚本均 fail-closed（glue 源缺失即抛错；composition 校验 manifest + `./client` export） | PASS |
| D2 | §3 模板字段级 vs 宿主配置校验器 | 逐字段对照 `packages/runtime/src/plugin/host.ts` L205 `validateTeamPluginConfig`（bootPhase/rootSessionId/blueprintSource/generation/defaultWorkspace/seedMembers/staticModel/deniedSelection/mcpServer/environmentFacts/externalPolicyFacts/glueUrl/seamUrl） | 模板覆盖全部必填字段；`deniedSelection` 必须显式给 `null`（undefined FAILS）；`mcpServer` 必须显式给（`{name,port}` 或 `null`，undefined FAILS） | 模板字段与校验器一一对应，含显式 `deniedSelection: null` 与 `mcpServer: {name,port}`；glueUrl/seamUrl 指向 dist 内实际存在的文件（本人 S3/S8 验证过存在性与可 import） | PASS |
| D3 | §3 模板 `blueprintSource` 形态 vs 解析契约 | 模板 L67–99 `|` 块 vs `packages/domain/blueprint/src/parse.ts` L61–110 `splitFrontmatter` | 首行必须为 `---`（否则 `frontmatter-missing`）；必须有闭合 `---`（否则 `frontmatter-unclosed`）；闭合后 body 必须为空（否则 `markdown-body-not-allowed`） | **模板块首行直接是 YAML 字段，无首 `---`、无闭合 `---`** → 逐字照抄必抛 `MALFORMED_DTO`(reason `frontmatter-missing`)。对照证据：boot kit 自带 blueprint（`s8-boot-r125.mjs` L162–208）使用 `---` 定界且本人独立复跑中成功进入 catalog；R122 verified world 行（`references/.dsh-test-s8-2026-09-04T12-26-59/profiles/web/cordis.patch.yml`）同样带 `---`；冻结语义依据 = DevPlan §4.3（YAML frontmatter 机制，MIGRATE 自旧 parser）+ Architecture §5.5（强校验 fail-closed） | **FAIL** |
| D4 | client 行形态 vs R122 world | 模板 `name: "../../team-client-row/index.js"` vs R122 verified 行 `name: "../../s8-client-row/index.js"` | 相对行名形态一致（相对 DSH_HOME 可解析） | 形态一致；本人 fresh-world 复跑中 client 行以绝对 home 行名成功进入组合图（index 注入 `@dsh-agent-team/client/client.js`，combo serve 200），证明行名解析机制对两种写法均工作 | PASS |

### 1.2 真实 clean-clone-equivalent install + build（S0–S8，git archive 39fe1df 全树）

模拟树：`references/.fresh-clone-r3-9-39fe1df`（`git archive` 导出，非 worktree 拷贝）。日志：`reviewer-9/r9-sim-39fe1df.log`，探针 `r9-fresh-clone-sim.ps1` + `r9-s7s8-retry.mjs`（留在 worktree 供审计）。

| # | 检查 | 命令 | 期望 | 实际 | 结果 |
|---|------|------|------|------|------|
| S1 | 干净安装 | `pnpm install --ignore-scripts` | 10 projects 成功；**0 个 @deepseek-ai farm/external junction**（fresh-machine = 只装声明依赖） | 10 projects；`.pnpm` 内 `@deepseek-ai*` 全部为 registry tarball 实体，0 junction 指向本机其他 DSH 树 | PASS |
| S2 | per-package 类型/构建 | 逐包 `pnpm -F <pkg> run build`（tsc） | 9/9 包 0 错误 | 9/9 通过（contracts/domain/storage/runtime/tools/remote/client/legacy/testkit） | PASS |
| S3 | dist glue 就位 | `node scripts/place-dist-glue.mjs` | `dist/packages/runtime/src/plugin/live/agent-bindings.mjs` 与源字节一致 | 字节一致（tsc 不产 `.mjs`，glue 为唯一 `.mjs` 落 dist 路径，row `glueUrl` 目标无 fallback） | PASS |
| S4 | client composition | `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` | 产出 `client-bundle.js` + `index.js` + `package.json`（含 `dsh.client` manifest + `./client` export） | 三件齐备，manifest 字段完整 | PASS |
| S5 | 4 个 install-surface 工件 vs R122 world | 与 `references/.dsh-test-s8-2026-09-04T12-26-59/` 及 `byte-compare.md` 记录值 SHA-256 比对 | 全部一致 | `client-bundle.js` = **2097CE5E570B187F4F163DD09C8FBEE9BF2E04298120B7EA221229423CB86997**（845581 B，与 2097CE5E 前缀及 R122 参考一致）；`index.js` = D385C065…；`package.json` = B4509233…；`host.js` = D50D3B3F…（4/4 与前值一致） | PASS |
| S6 | fresh build 产物自洽 | 重新计算 sim 树 4 工件 SHA-256 | 与 S5 相同 | 相同（构建可复现到字节） | PASS |
| S7 | hermetic 依赖解析 | 对 `packages/client` 与 `packages/runtime` 的全部 `@deepseek-ai/*` + `zod` specifier 做 `import.meta.resolve`/fs 上溯解析 | 全部解析到 sim 树内 `node_modules`（**0 逃逸**到全局 store/其他 DSH 树/本机绝对路径） | 全部树内解析；`packages/runtime/node_modules` 上溯即命中 5×@deepseek-ai/*@0.1.2-rc.1 | PASS |
| S8 | 依赖面 runtime import smoke | `node --input-type=module` 动态 import dist `agent-bindings.mjs` + source `seam.mjs`（`pathToFileURL`） | 零 missing specifier、零 load 错误 | 两者均 import 成功，全部传递依赖加载无异常 | PASS |

### 1.3 lockfile 审计（pnpm-lock.yaml，v9）

| # | 检查 | 命令 | 期望 | 实际 | 结果 |
|---|------|------|------|------|------|
| L1 | registry provenance | 全量扫描 `importers` + `packages` 段（`r9-lockfile-audit.ps1`） | 所有 `@deepseek-ai/*` 条目有 `resolution.integrity`(sha512)；0 个 `link:`/`file:` 安装来源 | 13/13 基础条目带 sha512 integrity；0 个 link:/file:；59 个无 integrity 的 `@deepseek-ai` 条目逐类核实为 v9 标准 peer-variant 空体条目（引用基础条目），非异常 | PASS |
| L2 | 抽查 3 项 | 人工核对 `zod@4.4.3`（L2466）、任一 `@deepseek-ai/dsh-*@0.1.2-rc.1` 基础条目、`cosmokit@1.8.3: {}` | integrity 存在且格式正确 | 均确认（`cosmokit: {}` 为标准 peer-snapshot 占位） | PASS |
| L3 | workspace 链接面 | 扫描全部 `workspace:` 引用 | 仅 client→`contracts`/`remote` 两条 `link:` | 确认为仅有的两条 | PASS |

### 1.4 smoke 证据核验 + 独立复跑

**（a）记录在案的 R125 证据自洽性**（`s8-boot.log` / `state.json` / `dump-config-s8.txt` / `catalog-list-s8.json` / `r125-gentry.log` / `browser/gentry-report.json`，world `references/.dsh-test-s8-2026-09-04T17-16-50`，closure 树 071080d）：

| 交叉点 | 核验 | 结果 |
|--------|------|------|
| boot 行/时间 | log L10 `dsh web: http://127.0.0.1:3180/?token=…`（17:16:55）↔ state.json `startedAt 17:16:56.788Z`、cookie `issuedAt 1788542215556`(=17:16:55.556Z, authority `127.0.0.1:3180`, 30d) | 一致 |
| pid/端口 | log L11 pid 58420 = state.json `instancePid`；port 3180/mock 3493 两处一致；stop 后 `ports free — 3180:true 3493:true` | 一致 |
| bundle sha | state.json `shim.bundleSha256 2097ce5e…`(845581 B) = 本人 S5/S6 fresh build 值 = R122 参考 | 一致（三源） |
| 401 闸 | log L14 unauthenticated `catalog.list` → HTTP 401（kit 语义 = 未认证必须 401/403） | 一致 |
| 3 行 dump | log L15 + `dump-config-s8.txt` L530/L609/L612：`dsh-agent-team`(host 绝对 URL)/`dsh-agent-team-client`(home 行)/`p6t6-team-tools` 均存在 | 一致 |
| serve | state.json `serveCheck` combo 200, 4627226 B, sha `a1db11fe…`, `bundleBytesContained:true`（combo 模式 gate 条件） | 一致 |
| catalog.list | log L17 rpcId `s8v-1a06d6c6a4357802` = `catalog-list-s8.json` rpcId；blueprints `s8v-bp-1` rev[1] | 一致 |
| gentry | `r125-gentry.log` 全 PASS、`failures: none`；`team.create` rpcId `dc4f412c…` = report g3 `rootSessionId session-ea2ca293…`；workspace `e8899ba6…`、summary `S8-M4 ok (deepseek-v4-flash).` 三文件互证；`consoleErrors:[] pageErrors:[]` | 一致 |

**（b）非浏览器部分独立复跑（brief 强制项）**——本人探针 `reviewer-9/r9-s8-boot.mjs`（从 kit 逐字节复制，唯一 delta：3 条 import → RC1 绝对 `file://` 路径；PORT 3180→**3181**、MOCK_PORT 3493→**3494**，原因：复跑当时并行 reviewer-8 的 smoke 占用 3180/3493（`Win32_Process` 命令行证实：`r8-logs\s8\s8-boot-r8.mjs boot` + 其实例 `apps/cli/lib/bin.js web --port 3180`）；TEST_METHODS §4 允许第二实例避让 3180 并已留痕）：

| # | gate | 期望 | 实际（world `references/.dsh-test-s8-r9-20260905b`，S8_WT=sim 树，farm 禁用=fresh-machine 模式） | 结果 |
|---|------|------|------|------|
| B1 | 行健康 | `ok:true boot:1 ready:true rootSessionId:s8v-root liveSessions:[s8v-root] toolCount:10` | 完全一致（18:06:48Z 内） | PASS |
| B2 | 401 闸 | unauthenticated `catalog.list` → 401/403 | HTTP 401 | PASS |
| B3 | dump-config | 3 行齐 | 3 行齐（host/client/p6t6） | PASS |
| B4 | bundle serve | combo 200 且 bundle 字节包含 | combo 200, 4627226 B, sha256 **`a1db11fea2e92dbe7c05fa01126eef4944acff8a93b5fa4430e7efcfd0c885f6` —— 与记录在案的 combo sha 逐字节相同**（fresh 树 vs 071080d 树组合输出一致，强交叉验证） | PASS |
| B5 | live catalog.list | cookie 200, `s8v-bp-1` rev[1] | 200, rpcId `s8v-1a06d9a139fc5274`, blueprints 一致 | PASS |
| B6 | 组合图含 team client | index 注入含 `@dsh-agent-team/client/client.js` | 存在（24493 B index，与记录 run 同尺寸） | PASS |
| B7 | 停机与端口 | stop 后 3181/3494 释放 | 实例 pid 34972 终止；`Test-NetConnection 3181/3494` = False/False | PASS |

**（c）结论**: 非浏览器 smoke 在 fresh-clone-equivalent 树上由本人独立复跑全绿（S8-READY）；浏览器垂直以记录在案证据自洽性核验（非本人 facet 强制复跑项）。

### 1.5 红线

| # | 红线 | 命令 | 期望 | 实际 | 结果 |
|---|------|------|------|------|------|
| R1 | 审计区间 references/ 零变更 | `git diff --name-status 2c1c200 39fe1df` 过滤 `references/` | 0 条 | 0 条（1267 文件区间 diff 中无任何 references/ 路径；references/ 本身 gitignored，其变更不入 git 历史，故以工作树状态核验补足） | PASS |
| R2 | fork 冻结分支/tag + clean 树 | `git rev-parse feat/team-vnext-integration-20260829 'legacy-agent-team-pre-vnext^{commit}'` + `status --porcelain`（复核两次：运行前/运行后） | 分支=tag=`a3ab319927…`；porcelain 0 | 分支与 tag 均 `a3ab31992762c5d6560797eabc7e0885a9320ade`；两次 porcelain 均 0 行（worktree HEAD `cd5ef814…` 为 alpha.1 基线对比检出，属 R122 留痕，未移动） | PASS |
| R3 | test-use pristine @ 76fda72979 | `git rev-parse HEAD` + `status --porcelain` + `diff --exit-code`（运行前/运行后各一次，含本人两次 boot 复跑之后） | HEAD=`76fda729799fe9b3848dbe2c211d4b231032b81e`；0 行；exit 0；0/0 vs origin/master | 全部满足（我的 smoke 只写 `references/.dsh-test-s8-r9-20260905b`，未触碰源码树） | PASS |
| R4 | 无 upstream patch 痕迹 | 10 个 `package.json`（root+9 包）扫描 `patch-package/patchedDependencies/postinstall/preinstall/prepare`；区间 diff 过滤 `*.patch`/`patches/`；lockfile `link:`/`file:` 计数 | 全 0 | 10/10 clean；0 patch 文件；0 link:/file: | PASS |
| R5 | gated 历史无 force-push | `git merge-base --is-ancestor 2c1c200 39fe1df` | exit 0（ff 可行 = 区间为纯前向追加） | exit 0 | PASS |
| R6 | 产品面身份 vs bd38827 | `git diff --name-only bd38827 39fe1df -- packages/ scripts/ apps/`（+docs 侧核） | 恰为 8 个 int 增量产品文件；39fe1df 仅 AGENTS.md + dev/ | 8 个产品文件与 merge-audit.md 声明一致；`39fe1df` 仅 AGENTS.md + dev/（产品面 = ad0a869 re-verify 树）；README/AGENTS 差异 = a733e9f R123 文档记账经 merge 进入 | PASS |
| R7 | 未触碰 D:\deepseek-harness\ 与 :3080 | 全程无写操作；`Win32_Process` 确认稳定实例 `node --import tsx/esm apps/cli/src/bin.ts web`（pid 76664）持续存活未受影响 | 无写入；稳定实例不受影响 | 满足 | PASS |

## 2. Findings

1. **[F1 / 唯一 FAIL] `docs/INSTALL.md` §3 模板 `blueprintSource` 缺 `---` frontmatter 定界符**（模板 L67–99 `|` 块）。`splitFrontmatter`（`packages/domain/blueprint/src/parse.ts` L61–110）要求：首行 `---`（L76，否则 `MALFORMED_DTO/frontmatter-missing`）、闭合 `---`（L86–96，否则 `frontmatter-unclosed`）、闭合后 body 为空（L101–107，否则 `markdown-body-not-allowed`；L72 已做 CRLF 归一，换行风格不是问题）。模板首行即 YAML 字段 → 逐字照抄的机器在 `validateTeamPluginConfig` 通过、boot/serve/catalog 全部正常的前提下，首次 `team.create` 必失败于 `MALFORMED_DTO`。
   - **修复规格（2 行文档改动，不改代码）**: 在模板 `blueprintSource: |` 块内容首行插入 `---`；在最后一个 frontmatter 字段之后插入闭合 `---`（其后不得再有 markdown body）。与冻结语义一致（DevPlan §4.3 frontmatter 机制、Architecture §5.5 强校验 fail-closed），与 R122 verified world 行及 boot kit blueprint 形态一致。
   - **严重度**: 低（纯文档；不影响已验证的构建/安装/boot 链；修复后无需重跑流水线——正确形态的解析已在三处独立验证：R122 world、kit blueprint、本人 B1–B5 复跑）。
2. **[F2 / 观察] 组合 bundle serve 为 unauthenticated 200**（静态 `/plugins/??…` 资源）：401 闸只覆盖 `/team-remote` RPC 通道（本人复跑 B2 确认 401 生效）。与 kit 设计与记录 run 一致，非缺陷，仅留痕。
3. **[F3 / 观察] 并行 reviewer 端口冲突**: 复跑时 3180/3493 被 reviewer-8 的 smoke 占用；按 TEST_METHODS §4 避让至 3181/3494 并已登记（探针头注释 + 本表 B 节）。gate 语义与端口号无关（BOOT_MARKER/health/401/dump/serve/catalog 均以相对端口参数化）。

## 3. Rationale（为何是「补充内容」而非「通过」/「阻塞」）

- 非「阻塞」：产品面（代码/构建/安装/组合/smoke/红线）全部独立验证为绿色；无 `CORE_SEAM_BLOCKER`、无红线违反、无 force-push、无 upstream 变更；缺陷仅存在于安装文档的模板文本，架构与语义无损害。
- 非「通过」：按 ROUTER_RULES §3.2，master 收口意味着 INSTALL.md 成为 master 上的权威安装文档；其中模板逐字不可用（首次建团必 `MALFORMED_DTO`），属于「有明确、简单的缺陷，不损害架构，可立即修复且无需重跑完整流水线」——正是「补充内容」的定义。修复为 2 行文档改动，主 Agent 可随 gate 处置一并落地后收口。
- fresh-machine 可安装性本身（本 facet 主体）**成立**：git-archive 全树 + `pnpm install --ignore-scripts` + 9/9 构建 + glue + composition + 4 工件 SHA-256 对齐 R122 + hermetic 解析零逃逸 + 依赖面 import 零缺失 + fresh-world S8-READY 独立复跑全绿。

## 4. 独立复跑清单（本人执行，可重放）

1. S1–S8 fresh-clone sim：`& <wt>\r9-fresh-clone-sim.ps1`（+`r9-s7s8-retry.mjs` 补 S7/S8），日志 `reviewer-9/r9-sim-39fe1df.log`。
2. lockfile：`& <wt>\r9-lockfile-audit.ps1` / `r9-lockfile-base.ps1`。
3. smoke 复跑：`$env:S8_WT=<sim 树>; $env:S8_SHIM=<sim>\packages\client\composition-shim; $env:S8_STAMP=r9-<unique>; node <evidence>\P9-master-closure\reviewer-9\r9-s8-boot.mjs boot`（探针 = kit 逐字节复制 + 3 条 import 绝对化 + PORT/MOCK_PORT 3181/3494；结束前 job kill，确认 3181/3494 释放——已确认）。证据：`reviewer-9/s8-boot.log`、`reviewer-9/state.json`、`reviewer-9/dump-config-s8.txt`、`reviewer-9/catalog-list-s8.json`、`reviewer-9/index-s8.html`。
4. 红线命令（R1–R5 表内逐条）+ test-use/fork 前后双复核。

## 5. 红线自查（reviewer-9 自身合规）

- 未执行任何 git commit/push/branch/tag；所有 git 命令为只读。
- 未修改 references/ 既有内容；新建的隔离目录 `references/.fresh-clone-r3-9-39fe1df`、`references/.dsh-test-s8-r9-20260905b` 均为 gitignored 测试隔离区（与主 Agent 的 `.fresh-clone-r125-*` / `.dsh-test-s8-*` 同型）。
- 未触碰 `D:\deepseek-harness\` 与 :3080（稳定实例 pid 76664 全程存活未受影响）。
- 测试实例已 stop，3181/3494 端口确认释放（3180/3493 由 reviewer-8 自行管理，非本人实例）。
- 临时探针/脚本全部留在本人 worktree（`.worktrees/R3MC-3` 根 + `reviewer-9/` 目录）供审计，未污染产品面；`git status` 仅显示 `??` 未跟踪条目（无已跟踪文件改动）。
- 未读取其他 reviewer 的 verdict/摘要。
