# GLUE-7 · glob 范围考证 + 普通实现预研（只读考证笔，不改 #321 面）

日期 2026-10-18 · 作者 GLUE-7 writer · 性质 = 证据文档（本目录唯一产物；生产面零改动）

## ① 支持承诺原句（docs 树 · 文件:行）

承诺存在且具体——glob 是 **PR5 的明示范围**，路线 = R3（公开包根 helper + 真 rg 进程），非可选项：

| 文件:行 | 原句（逐字摘录） |
| --- | --- |
| `docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md:33` | `| **PR5** | \`grep/glob\` R3 + Bash/Pwsh Tool Adapter + 原生等价层 | PR3 + PR4 | …` |
| 同文件 `:128` | `**搜索**首选 R1+R3：公开包根 \`parseGrepArgs/buildGrepCommand/parseGrepMatches/parseGlobArgs/buildGlobCommand/resolveRgPath/toWorkdirRelative\`，Team Own \`async execute\` …启动真 rg…` |
| 同文件 `:132` | `**测试：** \`grep/glob\` 真实固定 rg 版行为回归（原生 vs Team 的结构化 value、meta/render、错误、binary、ignore/hidden/VCS、路径、溢出 Spill、…）` |
| 同文件 `:136` | `**PoC-5（只在 R3 不满足功能契约时）：** R2 以 \`ctx.isolate('subprocess')\` + 真实 Provider + 原生 \`applyGrepTool/applyGlobTool\` …` |
| `architecture.md:234` | ``| \`glob\`, \`grep\` | packaged \`ripgrep\` via plain \`ctx.subprocess.spawn\` | Confined Spawn around the **actual rg process**. Preserve upstream parser/result semantics; no post-filter as substitute for read isolation. |`` |
| `architecture.md:112` | ``| \`glob\`, \`grep\` | Isolated/search provider, not post-filtered unrestricted ripgrep; …`` |
| `S0-SELECTION-MATRIX.md:53 (M-06)` | ``grep/glob（B 外部搜索进程）= **R1 + R3**：包根公开 7 helper（…parseGlobArgs/buildGlobCommand/resolveRgPath/toWorkdirRelative）`` |
| `S0-SELECTION-MATRIX.md:128 (D-5)` | `Tool Fork **A5-FORK-001 = CONDITIONAL/未产生**；当前无任何族取得 Fork 资格（grep/glob 明文 NOT-ELIGIBLE）` |
| `post-poc-technical-design.md:18` | ``grep/glob：包根公开辅助函数的 R3 路线已有真实 ripgrep 对照；R2 仅缺服务前置实验，**暂无 Fork 资格**`` |

结论：GLUE-7 把 `team_glob` 落在 typed-shut 是**范围诚实**（无实现不假装配），但**不是承诺的终点**——计划承诺的是 R3-rg 路线的交付，缺口在"装配/接线"，不在"必须新架构"。

## ② 可复用 glob 实现盘点（路径:行 · 权限面 · 可锚性）

1. **宿主公开包根（计划指名的 R3 物项，test-use @639ed01539 = 0.2.0-rc.2）**
   `tests/deepseek-harness-test-use/packages/fs/tool-fs-search/`
   - 公共入口：`src/index.ts:36`（`GLOB_MAX_RESULTS, GLOB_VCS_EXCLUDES, applyGlobTool, buildGlobCommand, formatGlobOutput, parseGlobArgs, presentGlobCall, …`）、`:59 resolveRgPath`、`:61 toWorkdirRelative`；package.json `exports["."]` = `lib/index.js`，`publishConfig.access=public` → **公开包根，合法 import 面**（红线只禁私有/内部路径）。
   - `src/glob.ts:71 parseGlobArgs`（纯校验）、`:89 buildGlobCommand` = **纯 argv 构造器**：`rg --files --glob=<P> --sort=modified --no-ignore --hidden` + 每 VCS 名两条否定 glob + 搜索根走 `--` 之后（防 flag 注入）。**无 I/O、无宿主上下文，可直接复用。**
   - `src/search-core.ts resolveRgPath()` → `import('@vscode/ripgrep').rgPath`（same-module `runRipgrep` 亦然）（宿主依赖 `@vscode/ripgrep ^1.18.0`；本仓工作区 store 实测已有 `@vscode+ripgrep@1.18.0` + `ripgrep-linux-x64@1.18.0`）。
   - `runRipgrep`（search-core.ts）绑宿主 exec/signal/spill 上下文——**不复用**；其执行体本仓已有等价物（下条 3）。
   - 权限面：宿主原生 glob 以 session cwd 为根 plain spawn（architecture.md:112 点名此为不足）→ 复用其 **argv/格式**，锚定与隔离用我们自己的 lane 体（超越原生，正合 `architecture.md:234` 的 "Confined Spawn around the actual rg process"）。
2. **本仓 a5p5 lane（入参面已就绪，缺的只是 backend）**
   `packages/tools/a5p5-tools/src/args.ts:176-185 parseGlobArgs`（严格 close `{pattern,path}` + `parseTarget` locator 律，产出 `{tool:'glob',pattern,target}`）；`effects-schema.ts:88` glob 效应已冻结声明 = `[invoke, walk]`；`register.ts:118` `globBackend ?? searchBackend` 回退律（kit-compat；GLUE-7 生产行故意不走，见 `team-tool-plane.mjs:398-405` 注释与 G6 钉 `alpha5-glue7-plane-backends.test.ts:199`）。
3. **GLUE-7 已落的生产体（复用主体，全在 `plane-effect-backends.mjs`）**
   `resolveAnchored:67`（realpath+isBeneath 锚定）、`createAnchoredSearchBackend:132`（W5 血统 spawnSync 体；`:143` 起对非 grep kind 显式 `wrong-tool-for-backend` 拒——glob 后端**不得**蹭此体，须另起同构小行）、`createConfinedShellBackend:204`（Landlock confine + argv 直发 + io.sink/timeout 结算 = runRipgrep 的本仓等价执行体，且隔离更强）。
4. **Node stdlib**：本机 node v24.21.0 实测 `fs.globSync`/`path.matchesGlob` = function（零依赖候选；语义=Web-glob，≠ rg glob）。
5. 其他：本仓 store 有 `minimatch@10.2.6/3.1.5`（未声明依赖，不可 import）；W5 fixtures 只有 grep argv（`w5/a5w5-fixtures.mjs:294` 为 grep `--include`），无 glob 实现；legacy `references/` 非 vNext 权威，不列。

## ③ 最小普通实现草图（纯胶水，无新架构）

**可行，且不需要任何新架构**——所有件已存在，新代码 ≈ 一个与 `createAnchoredSearchBackend` 同构的 ~50 行小行：

```
createAnchoredGlobBackend({ realmId, rootDir, confineProvider, observe })
  backendId: 'a5g7-confined-rg-glob'
  executor(parsed /* lane 已产 {tool:'glob',pattern,target} */):
    1. parsed.tool !== 'glob' → wrong-tool-for-backend（同 search 体律）
    2. 锚定复用 resolveAnchored(rootDir, target)；越界/'..'/绝对路径 → refused-*（lane parseTarget 已先拦一半）
    3. argv = buildGlobCommand({ pattern, path: anchoredRel })   // ②.1 宿主公开包根纯函数
       rgPath = resolveRgPath()（或注入的部署输入路径，launcher 同批披露）
    4. 执行 = createConfinedShellBackend 同款体：confine provider spawn argv，
       allowPaths=[rootReal]，timeout→terminate，输出走 io.sink —— rg 在沙箱内跑，
       越界读由内核拒（L4 已证该面真实）
    5. 结果 = formatGlobOutput/toWorkdirRelative（②.1）或映射到与 team_grep 同一
       PLANE_PRESENTATION_FACE；cap = GLOB_MAX_RESULTS
  plane 侧一行：productionBackends.glob = realGlob ?? shut（其余字节不动；G6 的
  shut 钉改读为"未配置 fsInstance 时仍 shut"，配置后正控=新 live 腿）
```

依赖代价与开放问题（留给 parent 裁决，非技术阻塞）：`packages/runtime` 新增声明依赖 `@deepseek-ai/dsh-tool-fs-search@0.2.0-rc.2`（公开包根；计划 :128 指名复用即此物）→ 传递 `@vscode/ripgrep`（平台二进制 optional，kit BFS 的 OPTIONAL_ONLY 律已能处理）；dist 镜像不变（镜像只装本仓行），STRICT 面闭包机制现成。**替代路线 B**（`fs.globSync` 零依赖 in-process）技术上更省但语义 ≠ rg 原生，直接违反 :132"原生等价回归"与 :234"no post-filter as substitute"精神——不作主案。

本笔只考证不装配；若 parent 放行，上图为一条独立胶水笔（1 文件后端行 + plane 一行 + G6 语义重钉 + live 正控腿），仍属"只做胶水"范围。
