# Alpha.6 PR-I1b 设计（2026-10-31）：`ReviewAssignment` 决策的入口准入（admission），不是第二个决议权威

- **日期**：2026-10-31
- **作者**：Alpha.6 Lane 2（独立 integrator），本会话
- **状态**：**设计正本（design-first）**。本 memo 不实现任何东西、不挂载任何东西、不解除任何阻塞；实现随下一 commit 落。
- **裁决依据**：用户 2026-10-31 **裁决二**（PR-I1 公开拆分 = PR-I1a 唯一受治理持久化 writer + PR-I1b ControlService 侧准入；
  正本在记录 PR **#513** 分支 `docs/plans/memo/alpha6-review-separation/rulings-20261031-timed-wake-and-pr-i1.md`，
  **该路径在本分支 base `a2bc18d78` 上不存在**，故按 PR 号引用）。预告与继承义务登记在 Issue **#502**：预告
  `6540179594`、加补编 2 `6540701475`、更正 `6540893952`、**加补编 3 `6541556958`**（本轮 7 条义务逐条对应见 §6）。
- **基线**：`alpha6/lane2-pri1a-writer-20261031` @ `a2bc18d78`（PR-I1a 三轮复核后）。**本 memo 的每条 file:line 都是本会话
  在该树实测**，不是转述。

## 0. 一句话

PR-I1a 交出了"谁能写"（唯一 writer + 消费方闭集），PR-I1b 交出的是"**谁能让它写**"：一个默认关闭、纯读、不写账本、
把角色判定交给既有 `CONTROL_RESOLVER_ROLES`、把耐久化全部交给 `applyReviewAssignment` 的入口准入层。它**不是**第二个
决议权威，也**不进入**受保护中心（ARC-A `control/` 一行都不改）。

## 1. 边界（先划，再设计）

1. **不改 `packages/runtime/control/**`**：它是 ARC-A 受保护中心，也是"控制请求/决议的耐久权威"（其 `index.ts:20-33`
   自述：每条请求/决议/allow 消费/放弃都是 TeamDomain 追加行；"it is NOT a second authority path"）。PR-I1b 与它的
   关系是**借用其角色闭集**，不是改写它，也不是在它旁边再造一套。
2. **PR-I1b 自己不写任何耐久行**：准入是纯读 + 委派。任何"顺手记一条准入日志"的冲动都会造出第二扇门（§3 D-5）。
3. **默认关闭**：未启用的 Team 一个字节都不变（§3 D-8），且这条要用字节差分证明，不是用"应该没走到"。
4. **不接 `allow`、不动 BL-01、不碰 :3080、CORE PATCH BUDGET 仍为 0**。

## 2. 实测的既有权威面（本会话读到的，逐条 file:line）

| 事实 | 位置 |
| --- | --- |
| 角色闭集：`'leader-approval' → ['leader','human']`，`'user-approval' → ['human']`，`'envelope-mutation' → ['leader','human']`（类型即 `Record<ControlRequestKind, readonly string[]>`，**新增 kind 会编译失败**） | `packages/runtime/control/types.ts:193-197` |
| 角色闭合校验发生在 **envelope 之前**，不匹配 ⇒ `CONTROL_RESOLVER_NOT_AUTHORIZED`，消息里带 role、kind 与 allowed 列表 | `packages/runtime/control/service.ts:2619-2634`（resolve 路径） |
| 同一规则在升级路径上再写一遍（两处独立实现 ⇒ 借用语义时必须**导入常量**而不是抄表） | `packages/runtime/control/service.ts:4852-4864` |
| 调用者形状：`{kind:'human',humanId}` \| `{kind:'instance',instanceId}`，由 `isActionCaller` 校验；**没有 role 字段** | `packages/runtime/control/service.ts:1033-1042` |
| 角色是**解析出来的**：instance 一侧的 `ResolvedCaller` 带 `role: 'leader' \| 'member'`（封闭二值），不是入参 | `packages/runtime/control/types.ts:1567` |
| 关案的权限不对称：close 只可能写 `deny`，所以错判的代价是拒绝而不是放行 | `packages/runtime/control/types.ts:2580-2589` |
| 主体身份带 kind 前缀（`instance:` / `template:` / `team:`），三种主体在幂等键上互不相交 | `packages/runtime/control/service.ts:1044-1060` |
| 写端口的合同把 **adapter 的作者点名成 PR-I1b**：必须交**全量、未截断、不陈旧**的 ledger，"lie by omission" 是 adapter 的缺陷且 writer 无法自救 | `packages/runtime/review-assignment/writer.ts:170-201` |
| 写端口另一半：`allocateSequence()` 然后 `put`，顺序固定 | `writer.ts:164-168` |
| 唯一写入口 | `writer.ts:320 applyReviewAssignment(deps, command)`；依赖形状 `writer.ts:214 ReviewAssignmentStoreDeps` |
| 消费方闭集由测试把守：`ALLOWED_CONSUMERS = []`、`EXTRA_MODULES_ALLOWED`、全包 dormancy walk（`sourceEntersLane` 同一函数既跑真实树又跑对抗样本）+ **集合相等**，并有防空转地板（每包文件数非空） | `packages/runtime/test/a6-pr2-lane-hygiene.test.ts:48`、`:53-61`、`:443-456` |
| 准入要复用的既有纯规则（**不许重新发明**）：`maySubmitFor`、`checkAssignmentMutation`、`foldReviewAssignmentRows`、`isReviewAssignmentFactType` | `packages/runtime/review-assignment/facts.ts:515`、`:574`、`:372`、`:333` |
| 角色闭集**经公开出口可导入**：`CONTROL_REQUEST_KINDS`（:140）与 `CONTROL_RESOLVER_ROLES`（:141）都在 `export {` 块内（非 `export type`） | `packages/runtime/control/index.ts:140-141` |
| remote 层另有一套**请求参数侧**的 actor 词表 `['human','leader','member']`，由闭集校验器解析；**参数里的 kind 是声明，不是权威** | `packages/remote/src/contracts/params.ts:111`、`:998-1036` |
| 既有耐久角色推导的形状先例：`requirementFactScopeRoleOf(leaderTemplateId, templateId)` ⇒ leader 当且仅当 templateId 等于 blueprint 的 leader templateId | `packages/runtime/requirement-facts/types.ts:128-135` |

## 3. 设计决定（决定 / 理由 / 失败模式 / 怎么钉住）

**D-1 准入层放在 lane 内（`review-assignment/admission.ts`），同时把 lane 外那个真正接线文件写进 `ALLOWED_CONSUMERS`。**
理由：lane 自己的话"an `import` is not a boundary"——把准入放在旁目录，它照样能手搓 payload 并满足所有腿。放 lane 内即被
本 lane 的导出普查与 dormancy walk 同时管。**钉**：`EXTRA_MODULES_ALLOWED` 增行 + `ALLOWED_CONSUMERS` 由 `[]` 变为
**恰好**那一个接线文件（集合相等 ⇒ 多一个消费者就红）。

**D-2 角色判定只借用 `CONTROL_RESOLVER_ROLES`，PR-I1b 不新增角色、不新增 kind、不写第二张表。**
决定：ReviewAssignment 决策映射到既有 kind `'leader-approval'` ⇒ 允许 `['leader','human']`；**导入常量**而非抄表
（`service.ts` 两处独立抄表正是反面教材）。映射不到的输入 ⇒ `ADMISSION_KIND_UNSUPPORTED`，**绝不默认放行**。
**钉**：一条腿用 `Object.keys(CONTROL_RESOLVER_ROLES)` 与本地映射表做双向集合相等，kind 集合一旦漂移立刻红；再加一条
"member 角色 ⇒ 拒绝且 `allocateSequence` 从未被调用"。

**D-3 核心一句：请求里带来的 kind/role 是**声明（claim）**，耐久世界里的 Leader 身份才是**权威**；两者不一致一律拒，且拒要说清它比的是哪两个东西。**
实测根据：`ActionCaller` 只有 `{kind:'human',humanId}` / `{kind:'instance',instanceId}`，本身不带 role（`service.ts:1033-1042`）；
而 remote 参数层却接受 `['human','leader','member']` 这一套 actor kind（`params.ts:111`、`:998-1036`）——那是**调用方写的**。
所以准入必须：(a) 输入 schema 里**不得出现** `role`/`resolverRole` 键（模型给的角色不是角色）；(b) 声明为 leader 的实例，必须与
TeamDomain 里该案真正的 Leader 实例**逐字段比**过才算（比不上的 `kind:'leader'` 是谎，不是权限）；(c) human 一侧走既有 humanId
解析，不接受自报身份。**钉**：入参键名普查（closed field set）+ 一条把
`role:'leader'` 塞进 params 的对抗腿必须被拒或被告知"此字段不接受"；instance→role 的解析复用宿主既有推导（见 §5 V-1，
若宿主未导出可复用推导，则本层必须自己从 TeamDomain 成员记录解析并把推导表钉成数据）。

**D-4 Team 存在性在准入时判，但句子只写它真的能保证的东西。**
决定：准入先查 root 是否存在 ⇒ 不存在即 `ADMISSION_TEAM_UNKNOWN`，**在任何序号分配之前**（可测：`allocateSequence`
未被调用）。但准入在锁外、writer 在锁内重读 ⇒ 准入通过不保证执行时仍存在。所以文档句写成"存在性预检给的是精确代码与
免做的功，**不是**存在性保证；存在性的权威仍是 writer 在锁内的折叠与外来 root 预检"。**反面**：写成"准入保证 Team 存在"
就是 F-R3-2 那一类越 claim。

**D-5 不加第二把锁，也不写第二条耐久记录。**
准入不写 ⇒ 不需要锁；写只在 `applyReviewAssignment` 的 `withLock(mintedRoot)` 临界区内发生。若将来要记准入拒绝，它必须
走同一条锁 + 同一 writer，否则 PR-I1a 的全部耐久断言作废。**钉**：admission 模块的导入普查里不得出现 ledger/repository
写句柄（dormancy walk 之外再加一条 lane 内腿）。

**D-6 adapter 交**全量** ledger。**
`list()` 返回整条账本，按 sequence 序，**不过滤、不截断、不给缓存视图**；行级过滤是 writer 的职责。理由与后果都在
`writer.ts:170-201`：藏中间行会被 epoch CAS 判出，藏**最新行**会让该案从此永久不可写。**钉**：一条真 adapter 腿在混合
factType 的账本上驱动，断言 writer 折叠时**看得见**外来行（并因此给出跨案拒绝），而不是"看起来更干净"的空列表。

**D-7 generation 不是新鲜度证明，谁都不许这么用。**
PR-I1a 的 R-19/R-20 实测"没有东西按 generation 读账本"。决定：PR-I1b **不推进** `team_sessions.generation`，也不把它
当准入依据；并发控制只有 writer 的 epoch CAS。若任何部分非用不可，三选一：在同一事务内推进 / 直接拒绝 / 交出证明。
**钉**：一条腿把 generation 人为改脏，断言准入答案**不变**（从而"我按 generation 校验过"这种句子永远无法被写成真话）。

**D-8 默认关闭，且"未启用零改动"要用字节差分证明。**
启用开关是 Team 侧的封闭配置（值集封闭、未知值 ⇒ 拒绝装配）。未启用 ⇒ 准入对象**根本不被构造**（不是"构造了但短路"）。
**钉**：复用 lane 既有字节差分手法在非启用世界上跑出与基线**逐字节相同**的 ledger/projection；外加一条"未知开关值 ⇒
装配失败"的腿，防止把拼写错误读成关闭。

**D-9 执行时重新校验，且入口答案不是凭证。**
准入给出的"可以"只是让调用方省一次功；命令真正执行时同一谓词在**新折叠状态**上再跑一遍（队列跨越状态变化是常态）。
**钉**：S-6 那条腿——先准入通过，然后把归属退休/转交改掉，再执行 ⇒ 执行拒绝，且拒绝代码是谓词本来的代码，**不被重贴
标签**（PR-I1a R-24/F-R3-6 同一条律：内部各分支已经各自回答，外层不得重贴）。

**D-10 拒绝词表封闭，且每个代码都要有"换掉它就红"的腿。**
自有代码（草案，实现时以这一张表为准）：`ADMISSION_DISABLED_FOR_TEAM`（装配期即拒，不应在运行期出现）、
`ADMISSION_CALLER_UNRESOLVED`、`ADMISSION_ROLE_NOT_RESOLVER`、`ADMISSION_KIND_UNSUPPORTED`、`ADMISSION_TEAM_UNKNOWN`、
`ADMISSION_STALE_INTENT`。writer 的代码**原样透传**，不包装、不改名（`writer.ts:130-137` 已定这条律）。
**钉**：#502 加补编 3 第 2 条——逐个代码做"把它换成邻居代码"的变异，全绿即缺陷；这条律正是本轮 F-R3-2 教出来的。

## 4. 安全负面测试计划（先红后绿，逐条命名）

| id | 攻击 | 期望 |
| --- | --- | --- |
| S-1 | member 角色提交归属决策 | `ADMISSION_ROLE_NOT_RESOLVER`（消息带 role + allowed），`allocateSequence` 未被调用，行数不变 |
| S-2 | 入参里塞 `role:'leader'` / `resolverRole` | 入参闭集不含该键 ⇒ 拒绝；键名普查腿独立钉 schema |
| S-3 | 映射表之外的 kind | `ADMISSION_KIND_UNSUPPORTED`，**不是**默认放行；双向集合相等腿同时红 |
| S-4 | B 队实例对 A 队 root 行使 | 准入层与 writer 外来 root 预检两道都拒；断言 writer 代码**未被重贴** |
| S-5 | 未知 Team | `ADMISSION_TEAM_UNKNOWN`，且发生在任何序号分配之前 |
| S-6 | 准入通过后状态被改（退休/转交）再执行 | 执行期重校验拒绝；准入答案不构成权限；代码不被外层改名 |
| S-7 | 未启用 Team 上装配 | 逐字节零改动；未知开关值 ⇒ 装配失败 |
| S-8 | 混合 factType 真账本走真 adapter | writer 折叠**看得见**外来行（证明 adapter 没有"好心地"过滤） |
| S-9 | 把准入的判定机制删掉 / 把 `ALLOWED_CONSUMERS` 忘记更新 | 两者都必须红（加补编 3 第 1、5 条：机制要有腿，闭集要相等） |
| S-10 | 逐个拒绝代码换成邻居代码 | 每个代码至少一条腿红（加补编 3 第 2 条） |

## 5. 未验证项（实现前必须先测，跑什么写清楚；未测即不得在正文里写成事实）

- **V-1 instance → role 的推导点仍未定位**（本会话已把范围收窄，未定位到本体）：已测到的三处相关事实是
  `ResolvedCaller` instance 臂带封闭二值 `role`（`control/types.ts:1567`）、`ActionCaller` 不带 role
  （`service.ts:1033-1042`）、`service.ts:1987` 处只是把**已有**的 `caller.role` 塞进 caller-ref；plugin 侧只找到一处 human caller
  构造（`packages/runtime/src/plugin/root.ts:2196`），**没有**找到 instance caller 的 role 是在哪里、依据什么写上的。
  实现前必须先定位；找不到可复用的公开推导，就按 D-3(b) 从 TeamDomain 成员记录自行推导，并把推导表钉成数据
  （形状参照 `requirementFactScopeRoleOf`，`requirement-facts/types.ts:128-135`）。
- ~~V-2 是否公开可导出~~ **已结案**：`CONTROL_RESOLVER_ROLES` 与 `CONTROL_REQUEST_KINDS` 都在
  `packages/runtime/control/index.ts:140-141` 的值导出块里 ⇒ D-2 是**导入权威**，不是镜像抄表，无需降级披露。
- **V-3 Team root 存在性的读句柄**：writer 用 `team_sessions` 仓库；准入侧要一个只读存在性判据，确认其语义（缺失 vs
  已归档 vs 损坏）三态是否可区分，不可区分就写"合并态"，不得假装能区分。
- **V-4 装配点候选已收窄**：今天 lane 之外对 `review-assignment` 的全部引用都是**注释**
  （`packages/runtime/src/plugin/projection-source.ts:213-302`，PR2′ 的休眠登记说明），尚无真实导入者。因此
  `ALLOWED_CONSUMERS` 将从 `[]` 变成**恰好一个**新接线文件；实现时必须确认它是哪个，并核 dormancy walk 对它的计数
  （它既要是唯一消费者，又不能成为第二个入口）。
- **V-5 字节差分的基线世界**：复用 PR0 Tier-A 的做法（minimal 世界 + 逐字节比对），确认本轮可复用的脚本与世界名。

## 6. 对 #502 加补编 3（`6541556958`）七条义务的对应

1 读的可Walk性 ⇒ D-6（adapter 交全量且失败被当答案，不是崩溃）；2 代码要有腿 ⇒ D-10/S-10；3 预留已花费 ⇒ 本层不分配
序号（D-5），透传 writer 的措辞；4 加宽要行为化并披露空转 ⇒ D-8 的开关值集与字节差分；5 分类了就要说话 ⇒ D-1/S-9；
6 临界区内的拒绝不重贴 ⇒ D-9/S-6；7 环境律 ⇒ 本 PR 的验证表按同一写法：linked worktree 里 `a4p7-merge-gate` 的 closure
腿只能算拒绝，不算通过。

## 7. 门禁预告（实现轮实测，不预填数字）

生产改动 ⇒ build + place-dist-glue + build-client-composition **同批提交** ⇒ `check-artifacts-at-head` 必须
`drift=0`；family（现 17 文件 / 477 条）+ 新准入规格 + `a6-pr2-lane-hygiene` 的两处闭集更新一起跑；`ci-pr-gate --full`
census 腿预期"undeclared refusal"（不得 `--allow-refused`、不得记为通过）；真实宿主端到端仍是 `ENV_BLOCK`，不是 PASS。

## 8. 权威

开发授权，仅此：不是合并授权、不是启用授权、不是门禁放宽。本 memo 所属 PR 以 draft + `DO-NOT-MERGE` 标题存在，
settlement gate 的 `BLOCKED-BY-MARKER` 是它应有的样子。

## 9. dated 2026-10-31（同夜稍后）：V-1 定位成功，而它**推翻**了 D-3 的写法与 §5 的退路

实现前的最后一次定位成功了：`resolveCaller` 的本体在 **`packages/runtime/admission/resolve.ts`**（控制面在
`packages/runtime/control/service.ts:2333` 与 `:2578` 调它）。Leader 分支实测（`resolve.ts:240-268`）：

- 注释先把最直觉的做法当场堵死："The Leader caller resolves from the durable Root/Team identity (P8-S2,
  Architecture §9.2, invariants 14/15): **NOT from a member row**"；成员行只是 best-effort
  （"its lifecycle never governs the Leader — the Leader's liveness follows the Root Session"）；
- 判据是**三件套**：哨兵 `instanceId === LEADER_INSTANCE_ID`（`:247`）+ root 上存在 TeamSession 记录
  （`:248-256`，缺 ⇒ `CALLER_NOT_FOUND`）+ root 上存在 `kind === 'team-root'` 的 sessionBinding
  （`:257-264`，缺 ⇒ `CALLER_NOT_FOUND`）；
- 成员行缺失**照常**返回 `{ role: 'leader' }`（`:265-268`，有行才附 `callerMember`）。

本 memo 有两处因此算错，按只追加规矩就地更正，并点名被更正的原句：

1. **D-3 的"逐字段比对耐久 Leader"形状作废。** 耐久世界里没有一个权威的"Leader 行"可比——那一行可以合法不存在。
   正确形状是比对那三件套。准入侧要问的不是"这个 instance 的档案像不像 Leader"，而是"这个 root 的耐久绑定是否
   把它指为 Leader"。
2. **§5 的 V-1 退路撤回，不是收窄。** 原句"找不到可复用的公开推导，就按 D-3(b) 从 TeamDomain 成员记录自行推导"
   会造出**第二套 Leader 判据**——正是本 lane 四轮审查一直在别人身上处置的那种缺陷；而且它会在单元测试里全绿：
   成员行存在时两套推导答案相同，只在"行不存在"这个真实故障模式下分道。新退路只有一条：
   **复用 `resolveCaller` 或其等价公开面；接不上就拒绝接线并点名原因。** PR-I1b 不落地是可接受的结局，
   系统里出现两个互相矛盾的"谁算 Leader"不是。

**D-1 的模块名一并更正**：原计划在本 lane 加 `admission.ts`。runtime 树里已有 `packages/runtime/admission/`
（就是这次的耐久 caller 解析）与受保护的 `packages/runtime/tool-admission/`
（`packages/runtime/test/a6-pr2-lane-hygiene.test.ts:63-68` 的 `PROTECTED_PREFIXES` 含 `tool-admission/`）。
一棵树里三个 "admission" 是送给未来 reviewer 的误会，故模块名定为 **`assignment-admission.ts`**
（`EXTRA_MODULES_ALLOWED` 里也写这个名字）。同时记一条事实免得日后误判：`admission/` **不在**
`PROTECTED_PREFIXES` 里（受保护的是 `tool-admission/`），所以"我 import 得到它"绝不等于"我可以绕过它"——
上面那条"复用或拒绝接线"的纪律就是为这个缺口写的。

## 10. dated 2026-10-31（同夜更晚）：真实宿主实测落地——S-7 的"启用"臂**没有宿主表面**，A/B 按实测撤回，只有 disabled 臂可写

仪器是 `tests/kits/pr-i1b-real-host/pr-i1b-real-host.mjs`，随 `a45ed19ea`（父 `b56eed25f`）落在本分支。捕获全部
tracked：`dev/agent-workflow/evidence/alpha6-pr-i1b-real-host/a6pri1b-2026-10-31T12-46-43Z/` 下的 `verdict.json`、
`MEASURED-LINES.txt`、`host.log`，同目录另存一份逐字节的 `capture.json`。判决 token：
`VERDICT kit=pr-i1b-real-host run=a6pri1b-2026-10-31T12-46-43Z checks=22 failed=0`（宿主 = 钉住的
`639ed01539…`，porcelain 前后都 = 0；row 只经公开 profile-patch seam 挂载，CORE PATCH BUDGET = 0）。本轮复跑：
四个本 lane 撰写文件 `179 passed`（58+32+69+20），a6 runtime 家族 `449 passed`。以下只写捕获量到的东西。

**1）本节退役的验收（引原句，原句不删不改）。** §4 表里 S-7 整行：

```text
| S-7 | 未启用 Team 上装配 | 逐字节零改动；未知开关值 ⇒ 装配失败 |
```

以及正文里同一声明的两句更早的话——§1.3「**默认关闭**：未启用的 Team 一个字节都不变（§3 D-8），且这条要用字节差分
证明，不是用"应该没走到"。」；§3 D-8「启用开关是 Team 侧的封闭配置（值集封闭、未知值 ⇒ 拒绝装配）。」。

**2）量到了什么。** 仪器把钉住的宿主起了两个世界。第二个世界把 `feature:'on'` 与 `assignmentFeature:'on'` 写进行
配置，捕获（check `enable-surface-is-not-a-switch`）逐字：「row config with feature:'on' + assignmentFeature:'on' ->
row ready=true, durable write accepted=true, census=[control-request-recorded] — nothing was refused and no admission
behaviour appeared」。且捕获的 `rowConfigFields`（row 实际读到的 14 个字段：`rootSessionId`…`seamUrl`）里没有属于
本门的任何字段。⇒ **宿主侧不存在一个能把这个门打开的字段**。"启用"不是宿主可观测状态，S-7 的 A/B 因此缺了 enabled
臂：§1.3 的"要用字节差分证明"作为 disabled-vs-enabled 的真实宿主对照，**写不出被测对象**。

**3）存量的（还活着的，逐条点名仪器）。**
- **disabled 臂可表达，且在满账本上量过**：第一个世界 6 条控制请求 + 3 条 human 决议落耐久后，`getLedgerPage` 给
  `entries=9`、`factTypes=[control-decision-recorded, control-request-recorded]`，review-assignment 行数为零
  （`durable-ledger-census-nonempty`）。这是耐久世界里的普查，不是空仓库的沉默。
- **S-7 的"未知开关值 ⇒ 装配失败"腿原样存活，但它测的是本模块自己的配置**：值集 `['off','on']` 封闭，未知值 ⇒
  `ADMISSION_FEATURE_VALUE_UNKNOWN`，`'off'` ⇒ `ADMISSION_DISABLED_FOR_TEAM`，字段缺失同样拒（无默认方向）——
  `a6-pr-i1b-admission.test.ts` §S-7 三条腿钉着。D-8 的"默认关闭"自此只描述**本模块的配置态**，不描述宿主可切换的
  状态；这句话是说给将来真的接线的人的。
- "一个字节都不变"的绑定仪器 = DORMANCY 论证（`ALLOWED_CONSUMERS==[]` + 全树 importer 普查）加上面那条满账本普查，
  不是宿主 A/B。

**4）不存量（退役的）。** 把 S-7 读成"同一宿主上 disabled 与 enabled 逐字节相同"的 A/B 验收：enabled 臂在宿主上没有
对照物，该比较**不能按原文执行**。§1.3 与 §3 D-8 中依赖"Team 侧存在启用开关"的部分按第 2 点退役。

**5）哪些当初是推断。** §1.3 的"要用字节差分证明"、D-8 的"启用开关是 Team 侧的封闭配置"、§4 S-7 的期望列——都是
设计意图的外推，当时无一实测（§2 那张表才是实测，其中没有 enable 开关这一行）。§7 的「真实宿主端到端仍是
`ENV_BLOCK`，不是 PASS。」是设计定稿当日的预测，已被本节落地替代：真实宿主跑起来了（`checks=22 failed=0`），剩余的
拒绝改为逐路径测量并按名点名（见 spec 文件头）。

**6）两个没被洗白的格子与一格缺席。** `leader-approval|leader` 与 `envelope-mutation|leader` 没有到达闭包——信封门
先答（`TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS`），捕获里记 `reachedClosure:false`（`closure=not-refused-by-closure`），
spec 拒绝把这两格当闭包一致的证据。member 角色无公开 ingress，记名 `member-role-has-no-ingress`（/team-remote 不
带身份；每个 `team_*` 工具都需要 live member agent，本机无模型）。闭包的**拒绝**只在 `user-approval|leader` 一格上
被活宿主量到（`CONTROL_RESOLVER_NOT_AUTHORIZED`，消息自带 allowed 列表）；human 臂三种 kind 全部由宿主答
`CONTROL_RESOLVED`。其余格子是镜像，不是实测。

**7）更正句现在各写在哪里（登记，不改代码）。** "没有宿主字段"这句更正已逐字落在
`packages/runtime/test/a6-pr-i1b-admission.test.ts` 的文件头（"there is no host field that turns this gate on, so
the enabled arm S-7 asks about has no host surface to be measured on, and the dormancy legs are the binding
evidence for it"）。实现模块头 `packages/runtime/review-assignment/assignment-admission.ts` 携带的是另外两句——
"The byte-identity of non-enabling teams is bound by DORMANCY"（§1 处，round 1 F-I1b1-2 的更正）与 ships dark =
"the correct default-off"（BLOCKED-WIRING 处）；它**没有**逐字写"宿主无启用字段"。两句加一起语义完整，改不改代码
归实现轮裁决，本 memo 只登记位置。
