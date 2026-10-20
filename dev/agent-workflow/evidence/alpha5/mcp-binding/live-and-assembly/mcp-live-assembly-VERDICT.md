# 任务 B — 装配面 harvest 收据：判定 + 六项记录

一条 bounded assembly regression（**无新安装**）：真实 glue 的 `nativeNames` harvest + 真实 `installScopedToolGuard`
安装，走 t12a 桥的真 composition 路径；惰性 MCP fixture 在 guard installation **之前**已进无 scope 的全局面。
同一套 doubles、同一份 world 构造，**唯一变量 = 被装载的 glue 字节**。

- patched = `648996ed` committed dist glue（sha256 前 16 `6fb025d42ee917e5`）
- baseline = `cad5cf03` committed dist glue 的 git 对象库字节（blob `c4feb972f879953d6d7ba0a1fe69dcc53c1c36ec`，
  sha256 前 16 `076f7eff52ca6eae`；mirror 落盘后 `git hash-object` 回核 = 同一 blob，恒等）
- **零复制 filter/regex 冒充动态**：baseline 侧装载的是 pre-PR 提交态的**真文件**（`git show` 字节）。
  guard/dispatcher 代码两面同一份：`git diff --stat cad5cf03 648996ed -- packages/runtime/tool-dispatch` = 空（实测）。
- doubles = 该面 committed 测试件 `t12a-live-bridge.mjs` 的**字节副本** `t12a-live-bridge.g2b.mjs`，
  仅 6 行改写（4 条 import/dynamic-import 改绝对 URL + `TEST_DIR` 常量 + glue 装载行改为 `import(process.env.G2B_GLUE_URL)`）；
  **不含任何判定逻辑**。

## 判定（一句）

**在已安装宿主形状的真装配路径上，#351 的 harvest 差值不可到达任何可观察的绑定/派发层——两面的全部可观察记录逐字节相同
（11 行 glue 观察行 + 逐字拒语 + surface + 身份读，diff = 空）。** 该差值是**决策层/纵深防御**（source review + 已装面单测 7/7 已证其形），
**不是**新可达的 live 拒绝；这与 live 六世界的结论同向，且本次给出了**结构闭合理由**（下"为何不可达"）。
效果边界仍在 PR7 deferred 线上；不写"普遍 MCP 隔离"，不写"已覆盖"。

## 六项记录（逐字见 `assembly-record-patched.json` / `assembly-record-base.json`，两面除 glue 身份外 diff = 空）

1. **actual guard install 的 no-scope schemas 是否含名 = 是（两面同）**。
   序列证据（`sequenced`，`atOpLogLength` = doubles 自身 `opLog` 长度 ⇒ 交叉顺序可证）：
   `opLog[0..2]` = register `read`/`bash`/`mcp__a5probe__echo` → **无 scope `schemas()` 读**返回
   `['bash','mcp__a5probe__echo','read']`（含名）→ 紧接 `tools.guard` 注册（`opLog[3]`）= guard 安装。
   且 `native-list-unavailable` 行**零条** ⇒ harvest 拿到的是可用非空列表。**⇒ host 前提（安装时全局面带 mcp 名）
   在真装配路径上可构造**，滤除子确有可作用的输入。
2. **published surface = 不存在（两面同）**。setup 在 publish 之前被 coverage gate 拒：
   逐字 `permission coverage gate failed for instance 'inst-leader': 1 unmanaged tool(s) on the final model-facing surface:
   mcp__a5probe__echo (unknown-unmanaged) (code: alpha2-permission-coverage-unmanaged-tools)`。
   该面最后可读的 scoped surface = `['bash','mcp__a5probe__echo','read','team_delegate','team_list_members']`（两面同）。
3. **global vs runtimeAgent scoped 的 execute identity**：doubles 的 `tools.get(name, scope)` **忽略 scope**
   （桥 `t12a-live-bridge.mjs:622-630`：两种读法解析同一注册对象）⇒ 在 doubles 上二者恒同一，**分层 registry 不被建模**；
   并且两面 `globalGetCount = 0`、`bothViewsReadForName = {globalRead:false, scopedRead:true}` ⇒
   **install.ts:396-443 的 R-a 双侧比较（`readTrustedDefinition` vs `readDefinition`）在本次两条 run 里根本没有执行**
   （它属 publish/inherited 清扫相，而 publish 不可达）。此点如实记为**测得"未发生"**，不得当作"已验证一致"。
4. **无 explicit binding 形**：fixture 名从未获得任何 Binding（无 publish）；可达的最早拒绝 = 上面 2 的 **setup 层 typed 拒**。
   Guard 门（`ctx.toolGuards` 实注册门，两面各 1 条）对所有名（含 `read`、`team_list_members`）逐字返回
   `team tool guard: "<name>" is refused because this Agent's Tool Dispatcher is not ACTIVE (assembly-in-progress,
   draining or tombstoned: new calls are refused; the mask stays)` = PREPARING 全拒（**与 patch 无关**），
   对应观察行 `a5p1-guard: guard-denial agent=session-g2b-root tool=<name>`（4 条，两面同）。
5. **entry origin / verified / unverifiedReason = 真装配路径下不可达**：guard handle 留在 glue setup 闭包内
   （`agent-bindings.mjs:2250` 声明、`:2380` 赋值，仅 `bindOwnTools`/`bindMcpTools`/`publish` 于 setup 内使用；
   binding 只暴露 `observations`，`observations` 里两面均为
   `dispatcher-preparing / guard-installed / dispatcher-seam-armed ×5 / guard-denial ×4`）。
   本目录另有一条 **明确标为非证据** 的 introspection leg（用**我自己**从 registry seam 读的列表重装真 guard）：
   两面 entry **完全相同**（`origin=inherited-native, verified=true, unverifiedReason=null, implementationOrigin=dsh-native`），
   ⇒ 恰好证明该 leg **不携带任何面信息**（它喂的不是 glue 滤后的 nativeNames）。
   `record.introspection.evidentiaryWeight = "NONE — hand-fed input, not the glue harvest output"`；
   其中 `bodyExecutions` 里 `mcp__a5probe__echo:1 / read:1` **只来自该非证据 leg 的驱动**，
   真 glue 门的驱动一律 `bodyExecuted:false`（`glueDoorDrives`）。
6. **最终 denial code**：两面同为 **`alpha2-permission-coverage-unmanaged-tools`（setup 层）**；
   派发层可见的最后 code 是 PREPARING 全拒（无 code，逐字见 4）。
   `TEAM_TOOL_BINDING_UNVERIFIED` / `TEAM_TOOL_UNGOVERNED` 在本次装配形状下**均未出现**（两面同）。

## 为何不可达（结构闭合，不是"没测到"）

- harvest 的**输入**两面相同（第 1 项实测），其**输出**（滤后 `nativeNames`）不经任何公开 seam 暴露（第 5 项）；
- 要让该输出变成可观察，必须走到 publish/inherited 清扫；而 strict Agent 上"全局面带未绑定 mcp 名"这一形
  **必然**先被 coverage gate 拒（第 2 项，两面逐字同，且与两条 live hostglobal 世界同结论）；
- 唯一能带 mcp 名过 gate 的形 = 本行自己 mount（进 `mcpIntroducedToolNames`），而 STEP 5 对它
  `bindMcpTools(names,'team-mcp')`（`install.ts:1249` 路径）**显式绑定 = verified**，两面同样放行（live mounted 世界 POS-BOUND 已证）；
- 非 strict 模板 = `permissionPolicy === undefined` ⇒ guard 根本不装（`agent-bindings.mjs:2281` 的 `if`），无可观察对象。
⇒ 三条路全闭：#351 的 harvest 差值在已安装宿主形状上**没有可达的动态观察面**。

## 已知修正条件（照录，且本次未越线）

`closed-world-guard.ts:432-453`（四例代数：`claimsNative = nativeNames.has(name)` ⇒ 不声称即 `unattributed`）与
`install.ts:396-443`（R-a：全局读 vs scoped 读指纹一致才算 native）。**晚注册天然错过快照 ⇒ 不能因果证明**；
本次 fixture 是"安装前已 global"形（非晚注册形），但因 publish 不可达，同样**不得**用于因果主张。
两面 doubles 同一文件、同一 `sequenced`/`opLog`，无"配置放松"：`permissionPolicy` 严格、`builtinToolDeny: []`、
`mcp: {kind: allow, items: []}`、控制服务 allow-spy（与 `alpha2-explicit-agent-setup.test.ts` 同款）。

## 复现

```
cd /srv/workspace/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/alpha5/mcp-live/assembly
node g2b-assembly-harvest.mjs --face=patched   # → assembly-record-patched.json, run-patched.log
node g2b-assembly-harvest.mjs --face=base      # → assembly-record-base.json,   run-base.log
```
mirror 两面各 = `cp -as` 符号链接树（指向该面 committed dist）+ 单文件真实字节（glue），
文件级 sha 见 `SHA256MANIFEST-ASSEMBLY.txt`。全程零 boot、零端口、零 token、零安装；产物全保留。

> 记法纪律（根 08:0xZ 指令）：**今后复制一律 `cp -a` 真实字节，禁 symlink 捷径**。本目录的 mirror 建于该指令之前，
> 已按"真实文件哈希 + 指针目标登记"留证（A/B 两段）；若需换成真实字节副本，零删除做法是在
> `mirror2-{patched,base}/` 直接 `cp -a`（旧目录原样保留），此动作等根一句话，未自行执行。

## mirror / mirror2 两形并存（根 08:2xZ 批准零删除形）

- **mirror = symlink 指针已登记**：`mirror-patched/` + `mirror-base/` 共 3488 条指针（原样保留，未删），
  清单 = `SHA256MANIFEST-ASSEMBLY.txt`（A 段真实文件哈希 / B 段指针登记 / C 段两面 glue 身份）。
- **mirror2 = 真实字节 durable 形（HOLD 合规零删除）**：`cp -aL` 解引用复制出 `mirror2-patched/` + `mirror2-base/`
  （各 1745 个真实文件、零符号链接），重跑哈希出 `SHA256MANIFEST-ASSEMBLY2.txt`。
- **文件级单变量证明**（写进 manifest2 A 段）：两面文件集恒等、**1744 个文件 sha256 全等，唯一不同 = 1 个 =
  `packages/runtime/src/plugin/live/agent-bindings.mjs`** ⇒ 面间任何差值只可归于该单文件（glue 本体），
  与 `git diff --stat cad5cf03 648996ed -- packages/runtime/tool-dispatch` = 空相互独立地再证一次。
- **同判定复算**：`node g2b-assembly-harvest.mjs --face=<patched|base> --mirror=mirror2-<face>` →
  `assembly-record-{patched,base}-mirror2-<face>.json`；与指针形逐键 diff **仅 `mirrorRoot` / `glueUrl` 两项**；
  跨面（mirror2 形）diff 仍为 **空**，`glueGuardRows` 与 `sequenced` 逐等。判定不变：无可达动态观察面 = defense-in-depth。
