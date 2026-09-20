# mcp-initial-grant — Blueprint 模板 static `mcp: allow` = 角色初始治理授权（修复证据）

> 任务：`docs/plans/active/MCP_BLUEPRINT_INITIAL_GRANT_FIX_PLAN.md`（main checkout，gitignored）
> 分支：`fix/mcp-blueprint-initial-grant`（base `9ec0d1f` = origin/master 前 tip）
> 核心承诺（plan §0/§11 冻结）：bound Blueprint 模板 `capabilities.mcp.kind === 'allow'`
> 是该角色的**初始治理授权**（静态层，provenance `template/static`，**无** synthetic
> durable 记录）；fresh setup / cold resume / 每个 request boundary **共用同一派生**；
> 仅 `kind === 'allow'` 授予；external hard deny 保留最终否决；overlay/human-override
> 优先级不变；CORE PATCH BUDGET = 0。

## 1. 修复（source + 同提交 dist）

| 文件 | 变更 |
| --- | --- |
| `packages/runtime/activation/checks.ts` | `resolveActivationPolicy` 增参 `templateValues?: { mcp?: PolicyEntry }`；`template: templateValues === undefined ? {} : { values: templateValues }` |
| `packages/runtime/agent-setup/capability/mcp-facet.ts` | `DurableMcpFacetArgs` 增 `initialTemplateMcp?`；`resolveDurableMcpFacet` 透传为 `templateValues` |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | ① `resolveConsumptionViews(sessionId, instanceIdHint, teamRootSid, templateIdHint, bindPath)` 经 `locateTemplate` + `staticCapabilitiesOf(getBoundBlueprint(teamRootSid), template)` 派生 `initialTemplateMcp`（guards：selective ∧ allow ∧ items.length>0；try/catch fail-closed 到修复前基线）→ 逐 server 传入 `resolveDurableMcpFacet`；② `agentSetup`/全部调用点透传 hints（cold-resume ensureLiveAgent、createRootAgent、child factory、prepareAgentForRequest）；③ **`sessionIsDurable` 接受版本化代际根**（`session.vN.jsonl.zstd`）— 0.1.5-rc.2 resume 发布版本化根，v0-only 匹配使所有重启后的 session 被判 ephemeral（real-host probe 实证，见 §4 run 5） |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | pin 719→720（+DEC-1 union 注记） |
| `dev/agent-workflow/evidence/multi-mcp/d-smoke/multi-mcp-real-host-smoke.mjs` | **去 seed**（plan §7）：删除初始 durable seed 块 → 换成 **zero-seed proof**（断言 `governance.overrides = []` + 写 `zero-seed-proof.json`，违例即 throw）；保留 C4 tighten（[A,B]→[A]）+ C5 restart 场景；**probe 改读 turn working surface = fullest-of-turn**（turn 内最大工具数请求 = 表面权威，规避 finding 4 的双向空面竞态）+ **mock 全量工具账本 dump**（`mock-requests-c1/c4/c5.json`，每请求 seq/model/toolCount/mcp/team/other）；header/summary 语义改写 |

## 2. 测试（tests/ 目录）

- `red-p8s4b.log` — 修复前 RED（stash 3 个源文件后重跑，真实红）：**5 failed | 15 passed (20)**。
- `red-glue.log` — 修复前 RED（同上，live bridge 走 SOURCE）：**11 failed | 7 passed (18)**（G3V/B1/B3/B5/C1 全红，deny/deny 对照绿）。
- `green-p8s4b.log` — A1–A8 resolver gate（含 A4 空 allow → `ACTIVATION_ERROR_CODES.POLICY_RESOLUTION_FAILED`）：20/20。
- `green-glue.log` — in-process 18 用例（G1/G2/G3/**G3V**/L/G4 世界；G3V = 版本化代际根 `session.v3.jsonl.zstd` 冷恢复仍派生 initial grant — sessionIsDurable 修复的 in-process 回归）。
- `green-p8s4b-glue.log` — stash-pop 恢复后 38/38 复核。
- `green-p4t6.log` — 扫描器 pin 720（10/10，union 记账）。
- `full-suite/post-fix.log` — 全量 `pnpm test`（**rebase 后合并构建**）= **20 failed | 3695 passed (3715)**：失败集 = 基线 10 文件**完全一致**（t1-capability-schema / t2-blueprint-hash / p7t6-teammates-adapter / d3-member-identity-context / p6t3-mediation / p6t3-restart / p8s3b-result-effects / t12a-b2-child-identity / t12a-glue-handoff-ports / p6t6-actions）；rebase 前一轮 = 20 failed | 3674 passed (3694)（基线 3647 @ PR#20 收束轮 + 本任务 27 新增通过）；rebase 后总增量 = PR#21 19 测试 + 本任务 27 + 其终审轮 2 = +29 全绿。

## 3. Gate D real-host kit（smoke/）

kit：`tests/kits/mcp-initial-grant-smoke/mcp-initial-grant-smoke.mjs`（~1300 行，自包含，
`--worktree/--testuse/--host-port/--keep`）。世界：pristine test-use @ `fb2c4b9e69`
真实 host + worktree 生产 dist 行（公开 profile-patch seam）+ p6t6 观测行 +
确定性 mock model（model-facing `tools` 数组 = 表面证据）+ 双 mini-MCP（3491/3492）。
行锚点 = **legacy 无 capabilities 蓝图**（D6 对照）；Team-1/Team-2 经
**`team.create` v2 fresh root** 创建（用户症状原场景：「每建一个新 Team，MCP 再次归零」）。
**全程零 override**（Z1 证明 `governance.overrides = []` + 初始 allow 挂载）。
服务器集不相交（T1→A / T2→B）= 上游 mcp-client per-scope serverName 注册表的
legal-side 规避（见 §5 finding 1）。

**判据**：Z1（零 seed 世界）/ D1（创建 T1）/ D2（T1 首轮 initial work 直接调 MCP A）/
D3（T1 有效集恰为 [A] + 表面恰含 A）/ D4（创建 T2）/ D5（T2 首轮直接调 MCP B，
有效集恰为 [B]，非 [A] 交叉泄漏，overrides 仍空）/ D6（legacy 锚点 boot root
零挂载 — 无静默授予）/ D7（创建后 durable `override.set mcp deny`（instance scope，
T1 leader）— 下一 boundary A 卸载，模型面无 mcp 工具，记录 durable 承认）/
D8（**cold resume**：重启后 created root 经产品路径（team-tool 执行 =
ensure-live resume（含共享 setup）+ boundary）重挂 — T2 从零 override 重新派生
[B] 且 `pong:b:rt2-b` 实执行；T1 LIVE 但零挂载 — durable DENY 跨重启存活并胜过
重派生的 [A]；有效集与重启前逐字节一致）/ H1/H2（:3080/:3180 零触碰 + 端口释放）。

**终判 run**（本 README 同目录）：`smoke/mgis-2026-09-20T10-08-49/`
**VERDICT PASS — passed [Z1, D1, D2, D3, D4, D5, D6, D7, D8, H1, H2] failed []**（全判据绿；
D8 四项全过：trigger 前 created root 非 live → trigger 后 live、T2 从零 override 重派生
[B] 且 `pong:b:rt2-b` 实执行、T1 durable deny 跨重启存活零挂载、有效集与重启前一致）。
**rebase 后复跑（合并构建 @ d63cb71）**：`smoke/mgis-2026-09-20T10-39-35/`
**VERDICT PASS — 11/11**（initial-grant 派生 × work-completion wake 活体桥共存实证）。

## 4. 诊断弧线（全部留档，run 顺序即发现顺序）

| run | 结果 | 价值 |
| --- | --- | --- |
| `mgis-2026-09-20T09-41-04` | FATAL（kit CLI 默认值 bug） | 失败弧线留档（host-port 默认 null→0） |
| `mgis-2026-09-20T09-41-15` | D4 失败 | **finding 1 证据**：两 root 同 serverName 撞上游注册表（`d4-team-create-t2.json` 错误原文） |
| `mgis-2026-09-20T09-46-17` | D7/D8 失败 | native prompt 不重挂 created root 的 characterization（当时 sessionIsDurable 尚未修） |
| `mgis-2026-09-20T09-56-07` | 仅 D8 失败 | team-tool 触发仍 `neither live nor durable` → 暴露 sessionIsDurable v0-only bug |
| `mgis-2026-09-20T09-58-57` | 仅 D8 失败 | **`d8-home-sessions-tree.json`**：三 session 均在盘上、文件名 = `session.v3.jsonl.zstd`（版本化代际根）→ 修 `sessionIsDurable` |
| `mgis-2026-09-20T10-01-42` | 仅 D8 失败 | trigger 响应 dump → `unknown tool "team_list_members"`（kit 蓝图 teamTools deny 的 by-design 退化，非产品缺陷） |
| `mgis-2026-09-20T10-02-49` | 仅 D8 check#1 失败 | **T2 冷恢复后 `pong:b:rt2-b` 实执行 + 有效集恢复** — 修复生效实证；`mock-requests.json` 表面账本；check#1 失败 = 误把 by-design 的 `unknown tool`（kit 蓝图 teamTools deny）当产品缺陷 |
| `mgis-2026-09-20T10-08-49` | **VERDICT PASS** | 终判：Gate D 全判据绿（零 seed + 双 fresh root 首轮 MCP + D7 动态优先级 + D8 cold resume 四项） |
| `mgis-2026-09-20T10-39-35` | **VERDICT PASS** | **rebase 后复跑**（合并构建 @ PR #21 merge d63cb71）— 双改动共存实证 |

## 5. 产品发现（入 PR body；CORE PATCH BUDGET = 0，记录不修）

1. **上游 mcp-client per-scope serverName 注册表**（test-use 0.1.5-rc.2，
   `packages/mcp/mcp-client/src/index.ts`）：同一行的两个 root 挂载同名 server 时，
   后启动的 root 以 `TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED` 包装的
   `mcp-client: serverName "…" is already in use by another mcp-client instance —
   pick a unique serverName in cordis.yml` 失败（原文见 run 2 `d4-team-create-t2.json`）。
   member 有 per-member scope 不冲突。kit 用不相交服务器集规避。
2. **cold-resume 重挂的产品路径**（本任务实证 + 插件侧修复后成立）：重启后
   created root 不由 `boot()` 重挂（boot 只重挂 boot root + 其 member children）；
   其第一次 **team 交互**（team-tool 执行 = executeTool 的 request boundary）经
   `ensureLiveAgent` → `agents.resume`（**重跑共享 setup** → initial grant 重派生 +
   挂载）完成重挂；**native prompt 作为重启后首次触碰不重挂**（DSH core 对顶层
   session 组成原生 agent — 无 row setup；run 3 characterization，上游既有
   布线，记录不修）；重挂后的 native prompt 跑在重挂 agent 上。
3. **session persistence 版本化代际根**：0.1.5-rc.2 的 session-persistence-jsonl
   在 resume 后发布 `session.vN.jsonl.zstd`（run 5 home 树：三 session 均为 v3）—
   任何按文件名判"持久存在"的插件侧代码须匹配全部代际根（本任务修
   `sessionIsDurable`；G3V 回归锁定）。
4. **fresh-create host 上 session 首个 turn 的 model 请求与行工具装配存在竞态 —
   该 turn 两个请求（marker 请求 + DSH core "Current runtime context" kick，
   C1 leader-approval live-found #1）任一可带空工具面**（characterized，不修 —
   CORE PATCH BUDGET = 0，upstream assembly 语义）：d-smoke 去 seed run
   `mm-smoke-20260920T10-21-37Z` 的 mock 全量工具账本（`mock-requests-c1.json`）
   实证 — fresh-create host 上每个 session 的**首个 turn**：请求 1（携带用户
   prompt）`tools=0`（leader 与两个 member 全中；前次 run
   `mm-smoke-20260920T10-12-42Z` 中 member 竞态胜出带全工具、leader 落败 — 即
   竞态、非确定），同 turn 的请求 2（kick）带完整面（seq 2/4/6，含全部 team/mcp
   工具）；**rebase 后 run `mm-smoke-20260920T10-40-11Z` 竞态双向化** — member-2
   的 marker 请求带全表面（28 工具）+ kick 请求 `tools=0`（`runs/
   mm-smoke-20260920T10-40-11Z/mock-requests-c1.json` seq 5/6；leader 与 m1 仍为
   marker 空 + kick 全）— 即**每 turn 恰一个全表面，两个槽位任一**。后续 turn 与
   **resume 世界**的 turn（`mock-requests-c4/c5.json`）在 marker 请求本身即带
   完整面。turn 仍然完成、模型在全表面请求上行动 — 不丢工作；但新 session 首
   turn 的两条模型响应中按竞态有一条是纯文本。d-smoke kit 的 probe 因此读取
   **turn 的 working surface = 该 turn 最大工具数请求**（fullest-of-turn，
   `probeAgent` settle 阶段）作为表面权威。

## 6. d-smoke 去 seed（plan §7）

kit：`dev/agent-workflow/evidence/multi-mcp/d-smoke/multi-mcp-real-host-smoke.mjs`
（旧 `runs/` 历史 run 不动；本任务 run = `runs/mm-smoke-20260920*`）。

**终判 run（rebase 后合并构建）**:
`dev/agent-workflow/evidence/multi-mcp/d-smoke/runs/mm-smoke-20260920T10-44-14Z/`
— **C1 16/16 · C2 3/3 · C3 4/4 · C4 3/3 · C5 4/4 · C6 1/1 · C7 3/3 · C8 4/4 —
全判据绿 exit 0**（`dsmoke/final-run.log` = 该 run 的完整控制台日志）。
rebase 前终判 = `runs/mm-smoke-20260920T10-28-24Z/`（同 37/37，base 9ec0d1f）。证据链：zero-seed-proof（`governance.overrides = []`，
`zero-seed-proof.json`）→ C1 per-agent 精确面（I5 state `source:
{layer: template, origin: static, recordId: null}` + turn working surface schema
双证明：leader `[mcp__mcp_signal__ping, mcp__mcp_designer__ping]` / m1
`[mcp__mcp_signal__ping]` / m2 `[mcp__mcp_designer__ping]`）→ C2 前缀隔离
（同底层 `ping`，leader 表面双名并存无碰撞）→ C4 durable tighten [A,B]→[A]
（唯一保留的 dynamic-governance override 场景，下一 boundary B 真卸载）→
C5 host restart（同 home resume）有效集逐字节一致 + 表面重建 → C6-C8
（端口释放 / test-use pristine / target-tree 扫描面不变）。
`mock-requests-c1/c4/c5.json` = 每请求全量工具账本（seq/model/toolCount/
mcp/team/other）— finding 4 的实证底账。

**去 seed 诊断弧线**（留档 `dev/agent-workflow/evidence/multi-mcp/d-smoke/runs/`，
顺序即发现顺序）：

| run | 结果 | 价值 |
| --- | --- | --- |
| `mm-smoke-20260920T10-09-56Z` | FATAL（cli 默认值） | 失败弧线留档 |
| `mm-smoke-20260920T10-12-42Z` | C1 14/16 · C2 2/3 | 首次去 seed run：C1 leader 表面空、member 表面正常 → finding 4 初现（竞态：member 胜、leader 败） |
| `mm-smoke-20260920T10-21-37Z` | C1 11/15 · C2 2/3 | **finding 4 定性底账**：`mock-requests-c1.json` 首次全量工具账本 — fresh-create 首 turn 请求 1 全部 `tools=0`（leader+members），请求 2（runtime-context kick）全表面 |
| `mm-smoke-20260920T10-26-21Z` | C1 10/16 · C2 2/3 | kit settle 切片时序 bug（kick 先于 marker 检测到达）→ 改"最后一个携带 marker 的请求" |
| `mm-smoke-20260920T10-28-24Z` | **全判据绿** | rebase 前终判（base 9ec0d1f） |
| `mm-smoke-20260920T10-40-11Z`（rebase 后） | C1 14/16 · C3 3/4 | **finding 4 双向化实证**：member-2 marker 全表面 + kick 空（账本 `mock-requests-c1.json` seq 5/6）→ settle 改 fullest-of-turn |
| `mm-smoke-20260920T10-43-19Z`（rebase 后） | 崩溃早退（C6-C8 仍绿） | kit settle reduce 初值 bug（`toolCountOf(undefined)`）— kit 侧修复，非产品问题 |
| `mm-smoke-20260920T10-44-14Z`（rebase 后） | **全判据绿 37/37 exit 0** | **rebase 后终判**（合并构建 @ d63cb71） |

## 6. 审查修复轮（PR23_MCP_INITIAL_GRANT_REVIEW_FIX_GUIDE.md，2026-09-20）

按 996 行审查指导执行的修复轮（同分支追加提交，base 不变）：

- **P1-A**：`resolveConsumptionViews` root ownership 统一解析（显式 root 参数 →
  持久化 consumption state 的 `teamRootSessionId` → durable domain ownership；
  解析不到 owner = typed 失败，**boot root 不再是任何未知 session 的 fallback**）；
  所有后续读取（overrides.list / instanceIdForSession / locateTemplate /
  getBoundBlueprint）用规范化 teamRoot。boot 序列调用点改为**显式断言 owner**
  （boot root=自己；boot seed member=本 world root；resume 重挂 member 来自
  `memberInstances.list(rootSid)` 构造即属于该 root）——语义零变化，ownership
  从"缺省推断"变"调用方断言"。
- **P1-B**：bound-template resolution fault 响亮失败（typed
  `capability-template-unresolved`；无 broad catch；仅"模板解析成功但不产生初始
  授权"落无授权）。
- **§2/§3/§4/§5 单一 helper**：`initialMcpGrantOf(staticCapabilitiesOf(...))`
  （`packages/domain/policy/src/static-capability-source.ts`）统一三个生产消费者
  （glue 消费视图 / `team_inspect_config` effects.ts INSPECT_CONFIG /
  activation provider step 8）——同一 resolver 不再有两套初始语义。
- **§6 Finding 1 兼容适配**：Agent-keyed MCP scope bridge（glue：
  `scopeOf(agentCtx) !== runtimeAgent` 时 `createScope(agentCtx, runtimeAgent)`
  铸造 per-Agent scope，MCP mount 经 `state.mcpMountCtx` 执行；公共路径零开销；
  bridge fiber 随 Agent 回收 + close() 确定性兜底；**serverName 与模型 namespace
  不变、无全局共享 fiber、不宣称 multi-live-Team 稳定**）。
- **§8.2 kit 验收强化**：Gate D 的 D3/D5/D8 现断言完整 state truth
  （mounted ∧ allowed ∧ source={layer:template, origin:static, recordId:null} ∧
  无 deniedBy）+ 健康动态 root observations **无 `capability-template-unresolved`**
  ——修复前矛盾（mounted=true/allowed=false/source=unspecified）现在会 FAIL。

**修复轮测试**：glue 18→**32**（+D×6 P1-A rootless 真值与跨 root deny 隔离、
+D2×3 P1-B 响亮失败、+S×4 same-serverName 双 Agent scope bridge probe、+S0×1
公共路径零开销）；p8s4b 20→**25**（+H1–H5 shared-helper 单元：非空 allow=授权 /
空 allow=无授权 / deny=无 / legacy=无 / legacy marker）；a2c3 inspect 11→**14**
（+T1 allow→`effective.mcp=allow[A]`、+T2×2 deny/legacy 不误授）。零新 test 文件
（p4t6 pin union 保持 **726**）。

**修复轮门禁**（全部修复轮构建上复测）：
- typecheck 8 包全绿（含 `t12a-live-bridge.d.mts` 声明同步：
  `resolveConsumptionViews` 返回型 +`teamRoot` + mcpViews source/deniedBy；
  `resolveBoundBlueprint` 选项允许 `null` = P1-B 故障形态）。
- `pnpm build` + `pnpm build:composition` + `check:artifacts` **OK 1132**
  （源→dist 同提交；drift 文件 = 本改动 4 源文件的产物 + 其 maps）。
- 全量 `pnpm test` = **20 failed | 3717 passed (3737)**（`full-suite/fix-round-post.log`；
  失败集 = 基线 10 文件**完全一致**；+22 全为本轮新增通过）。
- p4t6 扫描器 pin **726**（10/10）。
- Gate D kit **VERDICT PASS 11/11** @ `smoke/mgis-2026-09-20T12-16-25/`
  （§8.2 强化验收全绿：D3/D5 完整 state truth + 无 unresolved observation；
  D8 cold-resume 重推导带完整 truth；Team-2 实证 rootless state-route 再解析跑在
  创建 root 自己的 root 下 = P1-A 真值）。
- d-smoke 去 seed 复跑 **38/38 exit 0** @
  `dev/agent-workflow/evidence/multi-mcp/d-smoke/runs/mm-smoke-20260920T12-17-06Z/`
  （C8 自证 p4t6 扫描面 pre==post=726；finding 4 维持记录不修）。

**DoD（指南 §14）**：逐项达成；CORE PATCH BUDGET = 0（test-use porcelain 空
@ `fb2c4b9e69`，kit H1 每轮自证）；不宣称"multi-live-Team stability verified"。

**rebase PR#24 轮（2026-09-20，master 前进至 01fa598 = PR #24 merge → PR #23 CONFLICTING → 用户指令 rebase）**：
`git rebase 01fa598`（提交链 `336f6ab` + `db43b42`）。3 冲突全 union/ours（p4t6 pin **727** =
719+6+2；graph.yaml current_phase 取本任务侧 + 任务块双方保留；router log append-only union）；
`agent-bindings.mjs` 源+dist auto-merge 干净（本任务 P1-A/bridge 区域 × PR#24 sessionInput
inbox-acceptance 区域不交叠；dist 重建零漂移）。门禁全复测（合并构建 @ 01fa598）：
typecheck 8 包 / check:artifacts **OK 1132**（零漂移）/ focused 5 套件 **85/85**
（含 PR#24 send-message-liveness 4/4 = 双活共存实证）/ 全量 **20 failed | 3721 passed
(3741)**（`full-suite/rebase-pr24-post.log`；失败集 = 基线 10 文件完全一致；
3721 = 修复轮 3717 + PR#24 4）/ p4t6 **@727 10/10** / Gate D **11/11** @
`smoke/mgis-2026-09-20T12-40-25/` + d-smoke **38/38 exit 0** @
`dev/agent-workflow/evidence/multi-mcp/d-smoke/runs/mm-smoke-20260920T12-41-02Z/`
（C8 自证扫描面 pre==post=727）。force-with-lease 推送 → PR #23 MERGEABLE 恢复。
