# G2 路总结票 — #351（MCP native-trust-filter）装机面真 dispatch 收据

**票面性质**：installed-host dispatch 收据（**决策层 + 效果边界具体形**）。**因果纪律节凌驾本票其余表述**：
live 拒语非本补丁独有，对照差值=零如实写零，补丁价值以源审+账面+可达形定性，不冒称活体因果。
**不是**「普遍 MCP 隔离」、**不是**「MCP 治理已覆盖」——二形全文禁用；效果边界继续挂 **PR7 延期行在册**。
独审（源审）全文 = 根侧随票附件（审账 **abf7fabf @ 648996ed**；台账条目见
`/srv/workspace/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/alpha5/COORDINATION.md` 12:5xZ 行），
本票仅引用其结论 PASS 与其必办三件，不复制正文。

- 世界命名=`tests/homes/g2mcp-<mode>-<UTC>`（一世界一目录，收尾删除）；端口族=318x（实测 host **3181** /
  mock **3182** / HTTP fixture **3183**，仅世界期占用）。

---

## ① 逐腿 exact installed SHA（被安装面身份，含 build 后 dist/glue 放置核对）

| 腿 | 世界 run 目录（本目录 `runs/`） | 被安装面 commit（逐字） | 装载行内容指纹（sha256 前 16） | 装机核对 |
| --- | --- | --- | --- | --- |
| NEG-UNBOUND (a) setup 层 | `g2mcp-hostglobal-2026-10-20T06-47-08Z` | **`648996ed41a08c28cce0146ffcde9cef8b5fb0d3`** | row `host.js`=`312e61c6fe22ad82` · **glue `agent-bindings.mjs`=`6fb025d42ee917e5`** · harness `seam.mjs`=`e0349eb82d79bebd` | `place-dist-glue done (9 placement(s))` 全 byte-identical；`check-artifacts-committed verdict=ok compared=1748 glue=9`；`packages/runtime/dist`=**1745 文件**，路径归一化指纹 `3d3e2c7e9ee078b7` |
| POS-BOUND | `g2mcp-mounted-2026-10-20T06-45-33Z` | 同上（**逐字同值** `648996ed…`） | 同上三值（`312e61c6…` / **`6fb025d4…`** / `e0349eb8…`） | 同一装机面一次构建一次放置，三腿共用；**腿间零重建** |
| NEG-UNBOUND (b) per-call | `g2mcp-late-2026-10-20T06-55-02Z` | 同上（**逐字同值** `648996ed…`） | 同上三值 | 同上 |
| 对照 mounted | `g2mcp-mounted-2026-10-20T06-56-14Z`（对照树面 `.worktrees/a5mcpb-g2ctl/…/runs/`） | **`cad5cf03ef9bea80fd9093087e4be597eebaf11b`**（integration base） | row=`312e61c6fe22ad82`（同） · **glue=`076f7eff52ca6eae`（差）** · seam=`e0349eb82d79bebd`（同） | 同套脚本；dist 归一化指纹 `daef4f09649afad8`（差值只来自 glue） |
| 对照 hostglobal | `g2mcp-hostglobal-2026-10-20T06-57-03Z`（对照树面） | `cad5cf03…` | 同上 | 同上 |
| 对照 late | `g2mcp-late-2026-10-20T07-02-09Z`（对照树面） | `cad5cf03…` | 同上 | 同上 |

- 装机面载体=`.worktrees/a5mcpb-g2live`（**detached @ 648996ed**；node_modules 软链主检出；
  `packages/{client,domain,runtime}/node_modules` 复用既有农场；`root-binding/harness/node_modules` junction
  农场=gitignored 复用件，按 `run.mjs` 同源逻辑重建）。
- 装机自证逐条：`pnpm -C packages/runtime build` EXIT=0（**构建后 porcelain 仍 0** ⇒ 提交态 dist 镜像可由 src 再现）；
  `node scripts/place-dist-glue.mjs` = 9 placements byte-identical；
  `node scripts/build-client-composition.mjs packages/client packages/client/composition-shim` = bundle 产出；
  `node scripts/check-artifacts-committed.mjs` = `verdict=ok compared=1748 glue=9`。
  **腿后复核**（本轮再跑）：`place-dist-glue` 再次全 byte-identical +
  `DSH-ARTIFACT-VERDICT script=check-artifacts-committed … verdict=ok compared=1748 glue=9`
  ⇒ 三腿与腿后同一装机面，未被改动。
- 环境面注记（如实）：`pnpm -C packages/client build` 在本 worktree **红**（复用农场内宿主 client 类型链代次差 ⇒
  `TeamView.tsx` 隐式 any 一片）；非本树源码缺陷、dispatch 腿不挂 client 行 ⇒ 不影响本票，登记为环境形。
- 宿主面（三腿共用，逐腿判据实测）：主检出 `tests/deepseek-harness-test-use` @
  **`639ed015397290b3745d163aafe02ffee4aa3f84`**，`E-PIN`/`E-PRISTINE` 每腿前后 **porcelain=0**。

## ② fixture 调用证明（服务端计数 + log 逐字，含 mask 实况）

世界内 MCP server 一律=本目录合成 fixture（`a5probe-mcp-http-fixture.mjs` / `a5probe-mcp-stdio-fixture.mjs`，
单工具 `echo`；每次 `tools/call` 追写一行并计数=服务端执行见证）。

| 腿 | 计数 before → after（Δ） | `mcp-fixture-calls.log` 逐字 |
| --- | --- | --- |
| POS-BOUND（mounted） | `0 → 1`（**Δ=+1**） | `# http fixture started 2026-10-20T06:45:33.587Z on port 3183`<br>`2026-10-20T06:45:48.029Z call#1 args={"msg":"G2M-MOUNTED"}` |
| NEG-UNBOUND (a)（hostglobal） | `0 → 0`（**Δ=0**，永未触达） | `# stdio fixture (host mcp-client row), gate=(none)` —— **无 call 行** |
| NEG-UNBOUND (b)（late） | `0 → 0`（**Δ=0**，永未触达） | `# stdio fixture (host mcp-client row), gate=<WS-ROOT>/…/runs/g2mcp-late-2026-10-20T06-55-02Z/fixture-gate` —— **无 call 行** |
| 对照三腿（cad5cf03） | mounted **Δ=+1** / hostglobal **Δ=0** / late **Δ=0** | 与 PR 树逐字同形 |

**mask 实况（不夸大）**：launch token 全量脱敏——`instance.log` 内 `token=<…>` → `token=REDACTED-<sha256[:8]>`
（实测样本 `token=REDACTED-aa81a8a6`），`criteria.json`/`run-receipt.md` 的 observed 串同过 `redact()`。
世界内**绝对路径未脱敏**（`<WS-ROOT>/tests/homes/g2mcp-*/ws/…`）：工作区内世界路径、无用户数据，保留以保证可复算；
本票正文引用处以 `<WS-ROOT>` 归一。

## ③ 三腿判据与逐字（决策层 + 效果边界）

### NEG-UNBOUND — 未绑 `mcp__a5probe__echo`：两形皆拒，server 计数=0

> **因果归属标注（根令）**：以下两形在 pre-PR 对照树逐字同现（实测在档）⇒ **非 #351 补丁的因果证据**，
> 只作「未绑 `mcp__` 名在本基线的可达形 + 效果边界（server 计数=0）」记录。

**(a) setup 层拦（永不到 per-call）** — `runs/g2mcp-hostglobal-2026-10-20T06-47-08Z`（16/20）
宿主自己的 MCP manager（profile-patch 行 `@deepseek-ai/dsh-mcp-client` 构建产物 file-URL，stdio transport，
合成 fixture）boot 即把该名放上**全局**注册层（`HG-GLOBAL-MOUNT` PASS：boot-root 活体面含该名）；Team 行
`mcpServers: []` ⇒ 装配面从不绑它。strict leader `team.create` 当场拒（`team-create.json` 逐字）：

> `team.create: starting the root (leader) agent for 'session-g2mcp-hostglobal-main' failed: permission coverage
> gate failed for instance 'inst-leader': 1 unmanaged tool(s) on the final model-facing surface:
> mcp__a5probe__echo (unknown-unmanaged) (code: alpha2-permission-coverage-unmanaged-tools)`

连带 4 条红（`E-TURN` / `P-NONMCP-LANE-ALIVE` / `P-NONMCP-DENY` / `P-NONMCP-ALLOW-LANE`）= 该成员会话从未发布
⇒ 无 per-call 可发、无 wire 可读；**原样入账不销案**。`HG-GUARD-FAMILY-READ` 记录 guardRows=35（会话确有治理行，
只是该成员面未发布 ⇒ mcp 名专属行 0）。

**(b) per-call 拒（发布后迟到注册）** — `runs/g2mcp-late-2026-10-20T06-55-02Z`（**23/23**）
同宿主级行但 fixture boot 时不可挂（stdio 子进程见 gate 文件缺失即 exit 3；客户端 reconnect 策略重试）⇒ strict
成员先装配+发布（`L-PUBLISHED-BEFORE-ARRIVAL`），gate 开后迟到注册成功（`L-ARRIVAL`：模型面出现该名）。
治理行（**guard 族**逐字，`governance-rows.json`）：

```
a5p1-guard: tools-change-unbound-names agent=session-g2mcp-late-main denied=["mcp__a5probe__echo"]
a5p1-guard: guard-denial agent=session-g2mcp-late-main tool=mcp__a5probe__echo
a5p1-guard: dispatcher-call-refused agent=session-g2mcp-late-main tool=mcp__a5probe__echo
```

wire 逐字（`leader-tool-results.json`）：

> `Error: team tool guard: "mcp__a5probe__echo" has no Team Tool Binding on this Agent (closed world: an
> un-governed tool never executes; declare it or bind it)`

**分形如实（禁改标签）**：票面预期的 **BINDING_UNVERIFIED** 逐字（`the Tool Binding for "…" cannot be verified at
dispatch time (no fallback to the native body)`）在 per-call 层**未**落到 mcp 名上；落的是 **UNGOVERNED** 形
（判据 `L-BINDING-UNVERIFIED-VARIANT` 记 `bindingUnverified=false ungoverned=true`）。原因=公开缝可达性：迟到名走
`revalidateSurface`（`scoped-dispatcher.ts:632-660`，added 名**永不绑**）⇒ 在 closed world 之外 ⇒ UNGOVERNED；
BINDING_UNVERIFIED 形要求「publish 清扫时已在面上但未获可信绑」，strict 成员这条路被 alpha.2 Coverage Gate 先拦
（=上面 (a)）。同一 **BINDING_UNVERIFIED** 逐字并非缺席——它在非 mcp 名 `read` 上活体出现（见 POS-NONMCP）。

### POS-BOUND — 显式可信 Tool Binding 绑到 `mcp__` 名：abstain 放行且**真达 server**

`runs/g2mcp-mounted-2026-10-20T06-45-33Z`（**20/20**）。装配面自带 mount（Team 行 `mcpServers:[a5probe]` +
蓝图 `mcp: allow[a5probe]`）⇒ STEP-5 `bindMcpTools`（glue `:2780-2795`；`install.ts:1249`
`bindAll(names,'team-mcp')`）先于 publish 清扫落**显式 Tool Binding**。同一棵树上滤除子在场
（`M-EXCL-LIVE-WITNESS`：被装载的 dist glue 载有 `guardNativeTrustExcludedMcpName`）。

- wire：`echo:G2M-MOUNTED#call1` · 服务端 Δ=**+1**
- 决策层在路径上：`a5p1-guard: dispatcher-call-begin agent=session-g2mcp-mounted-main tool=mcp__a5probe__echo`
  + `… dispatcher-call-end …`（`M-GUARD-SAW-THE-CALL`）
- 零拒语：`guard-denial`=0 · `dispatcher-call-refused`=0（**abstain**，非 allow——Guard 无 allow 形）

⇒ 排除面不误伤绑定道（决策层 + 效果边界具体形）。

### POS-NONMCP — 非 mcp 名受管路径零扰动（mounted 与 late 两世界同绿）

- `P-NONMCP-LANE-ALIVE`：`alpha2-perm:` 行活着（mounted 世界 6 行 / 其中 read 4 行；首行含
  `{"stage":"canonicalized","callId":"call-mounted-1-…","tool":"read","resourceKind":"file",…}`）
- `P-NONMCP-DENY`：deny 道 typed deny 逐字
  > `Error: permission denied: read[<WS-ROOT>/…/ws/runtime/secret.txt]: effective deny; decided by
  > template(leader) deny[lane index 0, source 0]; layers (highest first): template=matched; overridden lower: none`
- `P-NONMCP-ALLOW-LANE`：allow 道**过权限道**、落 guard 拒语（哨兵未达）
  > `Error: team tool guard: the Tool Binding for "read" cannot be verified at dispatch time (no fallback to the native body)`

  ——这是**本装配形的既有世界性质**（对照树逐字相同，与 #351 无关）：可信原生采集在该形未产出任何 verified-native
  绑（`published-surface-unverified` 在位、`published-surface-shadowed`/`native-unreadable` 零行 ⇒ unverified 因由
  =`unattributed`；`native-list-unavailable` 零行 ⇒ 全局视图确有返回数组）。判据把「过权限道」与「guard 落点」分开记，
  不合并成 pass。

### UNSUPPORTED ≠ PASS（纪律腿，三世界全绿）

`U-UNSUPPORTED-NOT-PASS`：per-call 权限道对 `mcp__` 名**零行**（`governance-rows.json.alpha2ForMcp=[]`）
= `classifyPermissionTool` 闭 7 面外 ⇒ unsupported ⇒ `await next()`（pre-adapter 直通）。本票一律记 **UNSUPPORTED**：
POS 的 pass 只由「guard abstain + 显式 Binding + server 计数增」三件共同记；NEG 的拒只由「guard 族行 + wire 逐字 +
计数 0」记；「权限道对 mcp 无行」在任何腿都不被引用为治理通过。

**判据读法改正（abf7fabf 必办③）**：mcp__ 判据全部改读 `a5p1-guard: …` 族（glue `:2376` `onObserve` sink，
over `GET /__p6t6/state` → `teamRoot.live.observations`）；`alpha2-perm:` 只用于非 mcp 道。旧 leg3 只数
`alpha2-perm:` ⇒ 在 mcp__ 上必得「治理行零」⇒ 误报 branch=B。本 runner 已在册该读法，并以 `E-TRACE-STDOUT`
保留「宿主 stdout 非治理通道」负对照。

## ④ 证据编辑是否动 head（属种如实标注）

- **纯 untracked 证据，未动 head**：两个面的 `git status --porcelain` 均只有
  `?? dev/agent-workflow/evidence/alpha5/mcp-live/`（本票 + runner + fixture + run 目录；live 面 119 文件 / 6 run 目录，
  对照面 3 run 目录）。
- 分支 head 未变：`git rev-parse a5-mcp-binding` = `648996ed41a08c28cce0146ffcde9cef8b5fb0d3`（= 审账 SHA；
  本路零 commit / 零 push / 零 merge）；我的两面均为 **detached HEAD** 检出，非分支工作树。
- 他面零触：`.worktrees/a5-legs-runner`（分支 `a5-legs-runner` @ `fbcee244`）porcelain **空**——判据改读只落在我自己
  面的 runner 内，未进 F 路分支树。
- ⇒ **本路无需因证据重跑 CI**（不属「证据编辑动了 head」形）。
- abf7fabf 必办① 只读核对（未动他面）：分支面 `.worktrees/a5-mcp-binding` porcelain = `?? a5-mcp-binding.patch`，
  实测 **206286 bytes / sha256 前 12 = `5370a548a8d0`**（与审账所记一致）；**我的装机面
  `.worktrees/a5mcpb-g2live` 不含任何 `.patch` 件**（`ls *.patch` = 0）⇒ 本票收据采集自不带该 untracked 件的干净
  装机面。必办②（合并树 p4t6 并集重钉 1208）= 合并窗口协调侧动作，本路零链编辑。

## ⑤ integration base 契约 + scanner 实测

- **base 契约**：对照树 = integration base **`cad5cf03`**（#351 的 off-master 基点）。装机面合同差值实测（两树
  `packages/runtime` 下全部 `.js/.mjs/.json/.css/.d.ts` 逐文件 sha256 对比）：
  **比较 913 文件 · 新增 0 · 删除 0 · 差值 2**：

  ```
  packages/runtime/src/plugin/live/agent-bindings.mjs         base 076f7eff52ca6eae → pr 6fb025d42ee917e5
  packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs   （同：dist 镜像同字节）
  ```

  即**装机面差值 = 一个程序文件（源 + 其提交态 dist 镜像）**，其余 911 件逐字节相同 ⇒ 对照腿的任何差值只可归因于
  该文件的 mcp__ 采集点滤除子，别无可归因面。
- **差值腿实测结论**：三形（装配面自带 mount / 宿主级全局注册 / 发布后迟到）在 base 与 PR 树**逐字同形**
  （mounted 三处 wire 与行数全等：`echo:G2M-MOUNTED#call1` + 计数 +1 + 零拒语 + guardRows 41 / alpha2 6 / read 4；
  hostglobal 同为 `unknown-unmanaged` typed setup 拒；late 同为 UNGOVERNED per-call 拒 + 计数 0）。唯一差值=
  `M-EXCL-LIVE-WITNESS`（滤除子在场与否）= 对照本意。⇒ **本基线本装配形下，滤除子不产生可观察 per-call 差值**（=因果纪律 §2 的「零」）。
- **scanner 实测（本路亲跑，两面对照）**：
  - PR 树 `648996ed`：`vitest run test/p4t6-session-event-scan.test.ts`（`packages/testkit`）= **10/10 EXIT=0**；
    链上 #351 记账句在位并钉 **1207**（`… taking the scanned total on THIS tree to 1207`；其 RED 未记账档
    `dev/agent-workflow/evidence/alpha5/mcp-binding/p4t6-RED-unbooked.log` = `expected 1207 to be 1206`）。
  - base 树 `cad5cf03`：同套 **10/10 EXIT=0**，且 `grep -c a5mcp-native-trust-filter` = **0**（#351 那条 spec 在 base
    未记账）⇒ 链差值 = #351 新增的 **1 个 spec**；本路零链编辑。
  - 同面另跑 #351 自带单元：`vitest run --root packages/runtime test/a5mcp-native-trust-filter.test.ts` =
    **7/7 EXIT=0**（在装机面上跑，非仅源码）。
  - forward-merge 前瞻：先合定值、后合重锚（协调律）——本票只交「**1207 对 648996ed 正确**」，合并树并集值
    （审账记 1208）由合并窗口重测。

## 因果纪律（根 07:0xZ 令，凌驾本票其余表述）

1. **live 拒绝形非本补丁独有**：对照树 `cad5cf03`（pre-PR，滤除子不在场）三腿与 PR 树**逐字同形**——
   hostglobal 同为 `unknown-unmanaged` typed setup 拒（同串、同 code、同 4 连带红）、late 同为 UNGOVERNED per-call
   拒（同串 + 计数 0）、mounted 同为放行执行（同 `echo:G2M-MOUNTED#call1` + 计数 +1 + 零拒语 + 行数全等）。
   ⇒ **本票中任何 live 拒语（setup 层与 per-call 层）一律不得读作 #351 的因果证据**，它们是本基线的既有世界形，
   本票只把它们记作「未绑 `mcp__` 名的可达形 + 效果边界（server 计数=0）」的记录。
2. **对照差值如实写：零**。live per-call 层的补丁差值 = **0**（两面逐字同形；唯一差值=`M-EXCL-LIVE-WITNESS`
   =滤除子在场与否的**静态在场**核对，非行为差值）。本票不以任何方式把这零写成「已验行为变化」。
3. **补丁价值据此定性，不冒称活体因果**：#351 的价值面 = ①源审 **abf7fabf @ 648996ed PASS**（采集点契约 /
   导出谓词 / 作用面锁 / drift 1748-0 亲跑）②账面与装机面单测（`a5mcp-native-trust-filter.test.ts` **7/7** 在装机面
   EXIT=0；p4t6 **10/10** 两面实测、#351 记账钉 **1207**）③**可达形表述**：滤除子只在「publish 清扫时可信原生列表
   带 `mcp__` 名」这一位置被咨询，而该位置在本装机面的三种公开可达形里都未被构造出来（见下节）——
   即 **live 世界拿不到 per-call 差异**，补丁作用面属决策层契约面，非本基线可观察行为面。
4. **POS-BOUND 腿的正确读法**：它证明的是**零扰动**（显式 Tool Binding 的绑定道在排除面在场时仍放行并真达
   server：计数 +1、零拒语、guard 决策行在位），**不是**「补丁造成放行」。其与对照树的对拍=零扰动对拍（两面同形）。

## 决策层读法（为何本基线三形里滤除子无活体差值）

strict Team 成员上 `mcp__` 名只有三种可达位置：(1) 装配面自带挂载 ⇒ STEP-5 显式 Binding 先行 ⇒ abstain 执行；
(2) setup 时已在面上而未被绑 ⇒ alpha.2 Coverage Gate `unknown-unmanaged` typed setup 拒，成员不发布；
(3) 发布后到达 ⇒ `revalidateSurface` 永不绑 ⇒ `TEAM_TOOL_UNGOVERNED` per-call 拒。
`nativeNames` 的 mcp__ 滤除作用于**第 4 位置**（publish 清扫时可信原生列表里带 `mcp__` 名），而 (1)(2)(3) 均不经过它。
且本装配形的可信原生采集实际未产出任何 verified-native 绑（见 POS-NONMCP），第 4 位置在本装机面上未被构造出来。

**附带正名**：F leg3 当年「mcp 执行 / `read` 被拒」的组合，与「mcp 走显式 team-mcp Binding、inherited 走
unverified」一致（本票 guard 族行 + 两面同形即其装机面版本）。这不改 #351 机制正确性（采集点契约 / 谓词 / 作用面锁
已在 abf7fabf PASS），改的是「F leg3 现状红 = 未绑 mcp 继承 native 信任」这一归因。本票只交装机面事实，不改 PR 文案。

**效果边界继续挂 PR7 延期行在册（M31 关联）**；本票不声明任何 MCP 治理覆盖面。

## 环境完整性（票终检）

- 端口：本路实测占用 3181 / 3182 / 3183；票终检 `ss -ltn | grep :318[0-9]` = 仅 **3187**，**非本路端口**
  （本路候选池 3181-3186，零监听残留）。
- `:3080` 只读探针 **401 → 401** 未触（每世界判据 + 票终检各一次）；`:3180` `unreachable → unreachable`。
- 世界 teardown：`tests/homes/ | grep g2mcp` = **0**（票终检）。唯一例外处置=删除 orphan 世界
  `tests/homes/g2mcp-hostglobal-2026-10-20T06-56-43Z`（64K；来自被 job_kill 的首次对照启动，收尾未跑）——属根令
  「仅可清理自有 g2mcp-* homes」范围；其余零新增删除（其空 run 目录保留为 orphan 痕迹，未删）。
- 宿主 pristine：HEAD=`639ed01539…`、porcelain=`''`（票终检）。
- df avail：前 `55075700736` B → 后 **`51724722176` B**（同机他路活动 + 本路两 worktree 检出共同所致；如实记数）。

## 判据矩阵（速查）

| 世界 | 树 | run | 判据 | server Δ |
| --- | --- | --- | --- | --- |
| mounted（POS-BOUND） | 648996ed | `g2mcp-mounted-2026-10-20T06-45-33Z` | **20/20** | +1 |
| hostglobal（NEG setup 层） | 648996ed | `g2mcp-hostglobal-2026-10-20T06-47-08Z` | 16/20（4 连带红，不销案） | 0 |
| late（NEG per-call） | 648996ed | `g2mcp-late-2026-10-20T06-55-02Z` | **23/23** | 0 |
| late 早期两次（判据自身缺陷，红不销案） | 648996ed | `g2mcp-late-2026-10-20T06-53-07Z` / `…06-53-46Z` | 21/22 · 20/23（红项=runner 判据自身的计数器/引号匹配缺陷，修后同界 23/23） | 0 |
| 对照 mounted | cad5cf03 | `g2mcp-mounted-2026-10-20T06-56-14Z` | 19/20（唯一红 `M-EXCL-LIVE-WITNESS`=对照本意） | +1 |
| 对照 hostglobal | cad5cf03 | `g2mcp-hostglobal-2026-10-20T06-57-03Z` | 16/20（与 PR 树同 4 连带红） | 0 |
| 对照 late | cad5cf03 | `g2mcp-late-2026-10-20T07-02-09Z` | **23/23**（与 PR 树逐字同形） | 0 |

每 run 目录固定含：`criteria.json` · `run-receipt.md` · `p6t6-observations.json` ·
`governance-rows.json`（guard 族行逐字 + alpha2-perm 计数 + mcp 名专属行 + native-list-unavailable）·
`leader-tool-results.json` / `leader-transcript.json`（wire 逐字）· `mcp-fixture-calls.log` +
`fixture-counter.json` · `cordis.patch.yml` · `bp-main-authoring.yaml` / `bp-main-inspection.json` ·
`live-surface.json` · `instance.log`（token 已脱敏）· `env-before.json` / `env-after.json`。

## 未竟 / 不归本票

- 要在 live 上构造第 4 位置（可信原生列表带 `mcp__` 名）需非 harness 生产 composition（native 采集真出名）；
  那是**装面缺口**，不是 #351 判据缺口，本路未越界补。
- 成员面（wa）与别名行：本票 strict 主体=leader（同 F leg3 形）；成员面缺口 F 路已记 E 级，不重开。
- server 侧其它效应面：不在本票，挂 PR7 延期行。
