# a5-mcp-binding — MCP 选项 B（G2 路）patch-ready 证据

任务=根 09:5xZ ②（COORDINATION 10:0xZ 条 **G2=b8fe9b21 MCP 选项 B**）：Team guard 装配面 `nativeNames` 采集处滤 `mcp__` 前缀 →
mcp__ 名不继承 `dsh-native` 信任，在 Guard 代数里落 UNVERIFIED 道（拒语机制=既有件，非本补丁新增）；可信显式 Tool
Binding 放行路径零扰动 = PLAN:70 已批语义在**决策层**的兑现。
**口径（根裁 2026-10-20，详见下「口径修正轮」）= 决策层/纵深防御**：装配面 harvest 排除；live 面三形各有**先行把关者**，
本装配形**无可达动态观察面**，supported seams 上**无 demonstrated live fix**。
`dev/agent-workflow/evidence/alpha5/inventory/gap-legs/MCP-WIRING-PROPOSAL.md` **选项 B**（选项 C/A 不做）。零宿主改动（CORE=0）。

**表述律（全程遵守）**：本改动=「装配面 harvest 把 `mcp__` 族从可信 native 表剔除（决策层/纵深防御）」；
效应边界=「PR7 延期行在册（M31 关联）」。任何本目录/commit 文案不写「MCP 治理已覆盖」形；
**自 2026-10-20 起同禁**：「live escape 被本补丁阻止/修掉」「本补丁修复了 live 无治理执行」「F leg3 的 read 由本补丁翻正」
「本补丁在 live 面被 demonstrated 修好」（live 面实测=有界负结果，见「口径修正轮」）。

## 状态 = PATCH-READY（未应用共享面）

- 工作树=`.worktrees/a5-mcp-binding`，分支=`a5-mcp-binding`，基线=`cad5cf03`（G1/F 同基线；glue src/dist blob
  `c4feb972` 与 F 运行树 `c099ddc0` 全等）。
- **共享文件窗纪律**：`agent-bindings.mjs` 是 A 路 writer 面。改动全部先落在本分支本地（不 push、不入共享树）；
  母代理确认 A 落完后开一次性窗口，届时按「窗口应用清单」（见下）在合并树上重锚并成**单 commit 最小 diff**（src+镜像同提交）。
- patch 档=`a5-mcp-binding.patch`（`git format-patch` 自本分支预备 commit；SHA 见本文件末「回报面」）。

## 改动面（4 文件，1 预备 commit）

| 文件 | 形 |
| --- | --- |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | ①模块级导出 `GUARD_NATIVE_TRUST_EXCLUDED_MCP_PREFIX='mcp__'` + `guardNativeTrustExcludedMcpName(name)`（紧邻 `createAgentBindings` 前，含语义注释：MCP manager 经全局层挂载→原始全局列表携带 mcp__ 名→不加滤即 verified-native=无治理执行通道；同前缀契约=glue `mcp__${serverName}__` 挂载跟踪 + plane `PLANE_RESERVED_NATIVE_PREFIXES`）②`nativeNames` 采集 filter 链追加 `&& !guardNativeTrustExcludedMcpName(name)`（采集点唯一，源码见证腿 pin）+ 采集注释块补正段 |
| `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs` | dist 镜像，`node scripts/place-dist-glue.mjs` 生成 byte-identical（**同 commit**，artifacts 门语义） |
| `packages/runtime/test/a5mcp-native-trust-filter.test.ts` | 新单测（7 腿，见测试面） |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | p4t6 续链记账 `SCANNED_PATHS_A5MCPB`（实测见门禁面；**窗口时按合并树重锚**） |

零宿主/零 tool-dispatch/零 plane/零 schema 触面；非 Team 宿主会话不受 touch（PR1 不变量原文，装配点仅存在于
Team strict-policy agent scope 的 guard 安装路径）。

## 机制链现场核（cad5cf03 逐字）

> **行锚纪律（abf7fabf 必办④）**：本节与全 README 出现的 glue 行号一律 = **base 树 `cad5cf03`** 行号，**不是**打补丁后的行号。
> 补丁在 `:688` 前插入 26 行 ⇒ 补丁后同内容 = base 行号 +26。例：`glue :1467`（挂载跟踪
> `const prefix = "mcp__" + serverName + "__"`）在补丁后树上为 **`:1493`**（实测）；采集点 base `:2298-2310`
> 在补丁后树上为 **`:2324-2336`**。窗口重锚一律以**文本锚**为准，不以行号锚为准。

1. 采集=`agent-bindings.mjs:2298-2310`（`tools.schemas()` 无 scope 全局视图→`nativeNames`）→ `installScopedToolGuard({nativeNames})`。
2. `nativeNames`→`createGovernedSurface`（`packages/runtime/tool-dispatch/closed-world-guard.ts:363`）；
   `bindInheritedSurface` 四案判定 `:445-453`：`claimsNative=false` ⇒ `unbound-observed:*` 绑定 + `verified:false`（`:483-502`），
   注释明文含 "an MCP registration ... is bound UNVERIFIED"（`:302-306`）。
3. `guardDecision`：`!entry.verified` ⇒ deny `TOOL_BINDING_UNVERIFIED` + `BINDING_UNVERIFIED` 道
   （`:577-592`），消息=「`team tool guard: the Tool Binding for "<name>" cannot be verified at dispatch time
   (no fallback to the native body)`」（`:199`）=F leg3 read 落点 verbatim 同源。
   **限定**：本链 3-5 步=**代码路径事实 + 单测 fixture 内驱动事实**；在已安装宿主形状上 `mcp__` 族**无可达动态观察面**
   （三形各有先行把关者，见「口径修正轮」），故本链**不得**读作「live 上由本补丁拦住」。
4. 显式绑定放行腿=`install.ts` bindingFeed/team-own 路（`:1092-1164`，bind verified:true 先于 inherited sweep；
   `bindInheritedSurface` 对已绑名 `entries.has(name) continue` 跳过，`:438`）——本改动零触。
5. 拒道观察行进 row-handle：`install.ts` `onObserve`→glue `:2341` `observations` sink（F-1 纠归因后唯一有效读法通道）。

## 测试面（新单测 7 腿 + RED 先档）

RED 先档（旧 glue，stash 对照）：**3 采集腿红**（predicate 缺失/源码见证缺/采集形含 mcp__），**4 机制腿绿**
（UNVERIFIED 拒道+verbatim+显式绑定放行+非 mcp 不扰=机制现成、B 复用=绿为预期形态）。
打补丁后 7/7 绿（`vitest run a5mcp-native-trust-filter`）。

腿集：
- 采集形：动态 import **真实 glue 模块** 断言 predicate（exclusion=near-miss 拼写/非字符串全不误伤）；
  源码见证 pin 采集 filter 链含 `!guardNativeTrustExcludedMcpName(name)` 且采集点全文唯一；混合全局面采集结果零 mcp__ 名。
- 拒道：滤后列表下 mcp__ 名绑 `unbound-observed` UNVERIFIED（治理在场）；dispatch deny `TOOL_BINDING_UNVERIFIED`，
  消息逐字=F leg3 录形。
- 显式绑定：team-own 显式 Binding 先绑→inherited sweep 跳过不降级→abstain（放行路径不扰）。
- 非 mcp 不扰：同列表 bash 绑 verified native，dispatch abstain `governed-and-verified`。

正负控与 **baseline 限制**（明写，勿删）：
- 正控=显式 Binding 腿（先绑→sweep 跳过→abstain 放行）+ 非 mcp native 腿（`bash` verified native）；
  负控=`mcp__` 名在滤后列表下绑 `unbound-observed` UNVERIFIED（治理在场、Coverage diff 可见）。
- **baseline 限制**：4 条机制腿在**未打补丁**的旧 glue 上同样绿（机制现成，RED 先档已录该形态）⇒ 它们**不是**本补丁的
  因果证据；可作本补丁因果证据的只有 3 条采集腿（predicate / 源码见证 / 采集形），且采集腿驱动的是**真 glue 模块的采集形**，
  **不是** live 派发路径。装配面复算另证：两面全部可观察记录 diff = 空（引文见「口径修正轮」）。

## 门禁面（本树实测；窗口时在合并树全数重跑）

- 既有 guard/binding/MCP/hygiene 套（worktree 实跑，log=`gate-guard-binding-mcp-hygiene.wt.log` +
  `gate-mcp-extra-wt.log`）：a5p1-closed-world-guard 27✓ / a5p1-guard-install 23✓ / a5p1-scoped-dispatcher 16✓ /
  a5p1r-change-abort 18✓ / a5p1r-gg-probes 2✓ / a5p2-composition 12✓ / a5pbr2-binding-feed 10✓ /
  a5natexe-native-takeover 12✓ / a5r-cause-relay 9✓ / a5mcp-native-trust-filter 7✓ / a3p5-glue-permission-receipt 11✓ /
  lane-hygiene a3p3 21✓ a4p3 9✓ a5p4 8✓ a5p7 5✓ a3p5-notification 9✓ / **mcp 全滤 16 文件 231✓**（multi-mcp-wiring 49、
  f15×2 12、mcp-blueprint-initial-grant 32、mcp-target-materialization×2 21、u6-mcp-017、mcp-supply-config、
  p8s4b-mcp-facet、t12a-h1-nullable-mcp、t3-skills-mcp-adapter、optional/required-mcp-live-outage、
  mcp-live-readiness-to-requirement-fact）/ alpha2-explicit-agent-setup 5✓ / a3p4-pr4-decision-routing 13✓ /
  rc2a1-fs-containment 6✓。零失败。
- p4t6 续链实测：未记账跑=**`expected 1207 to be 1206`**（RED，log=`p4t6-RED-unbooked.log`；链基=本树实测 1206，
  与 COORDINATION 09:1xZ「master 现 pin=1206」一致）；记账后 10/10 绿（log=`p4t6-GREEN-booked.log`）。
  **续链注**：本 booking 以 `cad5cf03`+本文件 为测量树；窗口时若 A（tools-gov 注入腿，其树自测 1207）或 B(#349，1208)
  先落，按合并后树**重测重钉**（先合者定值，后合者续链实测，勿直接叠）。
- typecheck：`pnpm -r run typecheck` 全 Done（log=`typecheck.log`）。
- eslint：三改动文件 0 错。
- artifacts：预备 commit 后 `check:artifacts`=OK + `check:artifacts:head`=verdict ok drift=0（
  `check-artifacts-at-head.log`/`check-artifacts-at-head-full.log`；预备态首跑的 dist drift 提示=未提交态预期门语义，同
  commit 后已消）。窗口 commit 后须再各跑一次。

## 活体面实测（G2 路，2026-10-20；原「活体主收据=F leg3 目标态翻正」设计已撤）

**撤除理由**：原设计把「F leg3 套件目标态翻正」当本补丁的活体主收据。G2 路 installed-host 六世界实测
（3 世界 @ PR 面 `648996ed` + 3 世界 @ control 面 `cad5cf03`；同一安装面 913 可比文件中仅 glue 与其 dist 镜像
共 2 文件不同）给出**有界负结果**：pre-PR 面在同一通道上拒得一模一样 ⇒ **任何 live 拒语都不是本补丁的因果证据**。
live 面三形各有**先行把关者**（均在本补丁之前把关）：

| live 形 | 先行把关者 | 实测（逐字/码） |
| --- | --- | --- |
| 装配 mount（本行自己的 MCP 被 mount） | STEP-5 `bindMcpTools(names,'team-mcp')` 显式 Binding ⇒ verified，两面同放行 | fixture 服务端计数 `0→1`（正控形态，非负控） |
| host 全局层携带未绑定 `mcp__` 名 | Permission Coverage Gate 在 **setup** 层拒（publish 之前） | `…1 unmanaged tool(s) on the final model-facing surface: mcp__a5probe__echo (unknown-unmanaged)…`；code=`alpha2-permission-coverage-unmanaged-tools`（两面逐字同） |
| 晚注册名 | `revalidateSurface` 对 added 名**永不绑**（`scoped-dispatcher.ts:632-660`） | per-call `TEAM_TOOL_UNGOVERNED`：`has no Team Tool Binding on this Agent (closed world…`（两面同） |

⇒ 本补丁在 live 面**无 demonstrated fix**（supported seams 内），其价值=**决策层/纵深防御**：把「若某形先到 dispatch
且无显式 Binding」时的默认方向从 verified-native 改为 UNVERIFIED，并使该族对 Coverage diff 可见；
F leg3 的 pre-patch read（治理行零、执行照跑）在 pre-PR 面同样成立，**不得**再作「由本补丁翻正」的收据引用。

**证据副本随本 commit 入库**（`live-and-assembly/`；原始记录在主检出 untracked 同路径，含六世界 run 目录与 183 项
sha256 manifest，不入本 commit）：
- `live-and-assembly/mcp-live-RESULTS.md` — 六世界逐世界收据 + 因果纪律条
  （原件 `dev/agent-workflow/evidence/alpha5/mcp-live/RESULTS.md`）；
- `live-and-assembly/mcp-live-assembly-VERDICT.md` — 装配面复算（真 harvest + 真 guard 安装、惰性 fixture 先于
  installation 入全局面、六项记录、**两面全部可观察记录 diff = 空**）
  （原件 `dev/agent-workflow/evidence/alpha5/mcp-live/assembly/VERDICT.md`）。

## 口径修正轮（根裁 2026-10-20；本 commit 只改文档与注释，产品字节零语义改动）

**裁定**：#351 = **决策层 / 纵深防御**；supported seams 上**无 demonstrated live fix**。据此，本目录 README、
glue 两处注释、新单测标题/头注释中原有的「→ dispatch 拒」「every call is refused」「live flip = F leg3 翻正」
一类读起来像「live escape 被本补丁阻止/修掉」的表述，一律改为下面这个准口径：

> **决策层/纵深防御：装配面 harvest 把 `mcp__` 族从可信 native 表排除；live 面三形各有先行把关者
> （STEP-5 显式 Binding / coverage setup 拒 / `revalidateSurface` 对 added 名永不绑），本装配形无可达动态观察面。**

装配面复算的结构闭合（详 `live-and-assembly/mcp-live-assembly-VERDICT.md`）：harvest 的**输入**两面相同
（无 scope 全局视图确含 `mcp__a5probe__echo`，顺序可证）；其**输出**（滤后 `nativeNames`）不经任何公开 seam 暴露
（guard handle 留在 setup 闭包，binding 只暴露 `observations`）；要让输出可观察必须走到 publish，而 strict Agent 上
「全局面带未绑定 `mcp__` 名」必被 Coverage Gate 先拒 ⇒ 无可达观察面。两面全部可观察记录 diff = 空。

不发明因果 RED：本轮**不**新增任何「打了补丁才红」的 live 型断言；既有 4 条机制腿的 baseline 同绿形态已在「测试面」
明写为非因果证据。产品字节侧本轮只动注释文本（src+dist 镜像同 commit，`node scripts/place-dist-glue.mjs` 重生成），
判定逻辑一字节未改。
## 窗口应用清单（母代理开窗时执行序）

1. 在 A（及先合者）落完后的合并树 worktree 上：`git checkout a5-mcp-binding` 内容以 patch 应用
   （`git apply a5-mcp-binding.patch` 或 cherry-pick 预备 commit）；glue 邻域若有行漂移按本 README「机制链」采集点文本锚定。
2. `node scripts/place-dist-glue.mjs` 重生成镜像（保证 byte-identical 于当时 src）。
3. p4t6 重锚：先跑 `npx vitest run p4t6-session-event-scan` 读实测数，把 `SCANNED_PATHS_A5MCPB` 的 tie 表达式
   `toBe(1207 - 1206)` 与标题链句中的锚值改为「合并树实测 前值 → 前值+1」（RED 档存 `alpha5/mcp-binding/`）。
4. 单 commit 收口：src+dist+新测试+p4t6 记账；随后 `node scripts/check-artifacts-committed.mjs` 复跑=OK。
5. 复跑：新单测 + guard/binding/MCP/hygiene 套 + typecheck；log 归本目录。
6. 表述律复查：commit 消息只写「unbound mcp__ per-call refusal (decision layer); effect boundary = PR7
   deferred line booked」形。

## 回报面

- 预备分支=`a5-mcp-binding` @ 本 worktree（本地，**未 push**）；预备 commit=见本目录所在分支 tip
  （回报消息携带 SHA）；patch 档=`.worktrees/a5-mcp-binding/a5-mcp-binding.patch`（`git format-patch -1` 产物，未入库）。
- artifacts：commit 后复跑=OK（`check-artifacts-at-head.log`）+ `check:artifacts:head` verdict=ok drift=0
  （`check-artifacts-at-head-full.log`）。
- 交母代理：patch-ready 通知 + 改动面 + 测试面（本 README 即附件）。

## 开窗轮执行记录（协调开窗令 ①–⑥，本 commit 即收口 commit）

- ① 应用核=免应用：分支单 commit 直接落在 master（`git ls-remote origin master` 实测=`cad5cf03`，未前移）；树态 clean。
- ② 镜像重生成核=`place-dist-glue.mjs` 复跑 byte-identical（dist git status 空）。
- ③ p4t6 重锚=master 未前移 → 1207 钉值**沿用本树实测**（forward-merge 前瞻注已在记账条款内）；开窗轮复跑 p4t6 10/10 绿。
- ⑤ 全套复跑=`window-rerun-battery.log`（21 pattern 全绿零 FAILED-PATTERN）+ MCP 全滤 16 文件含内。
  **如实注**：首轮 `pnpm -r typecheck` 曾假绿 Done；开窗轮抓到本测试文件两处**类型面**错误（`fileURLToPath(URL对象)`
  的 DOM-lib/node URL 声明冲突→改传 `.href`；`some()` 上无 narrowing→改显式 typeof 守卫），修复仅触测试文件、
  产品文件零改；修后直接 `tsc -p tsconfig.json --noEmit` 净 + 全量 `pnpm -r run typecheck` EXIT=0 零 error +
  单测 7/7（`window-rerun-typecheck.log`）。
- ④ 收口 commit=本 commit（含开窗轮修复与窗日志）；`check:artifacts`=OK 1748/glue=9
  （`window-rerun-check-artifacts.log`）。**`check:artifacts:head`=ENOSPC 未跑**：根分区 100%（余 129M），
  该脚本需临时 worktree-add，属**全局环境阻塞**（影响一切路线，已报母代理）。适用性注：收口 commit 相对首
  commit 仅增 `packages/runtime/test/*.test.ts` 修正与窗日志——**不在安装面（file[]/dist 镜像/glue placements）**，
  且首 commit 的 `check:artifacts:head` verdict=ok drift=0 在档；磁盘清理后 push 前补跑一次为最终收口。
- ⑥ 表述律复查：commit 消息+全部入库文件=禁形（「MCP 治理已覆盖」类）零命中（仅存否定式规则引用）；
  允许形「decision layer / PR7 deferred line booked」在位。
