# GLUE-8 — v4 执行 feed 集成准备（alpha5-glue8-v4feed）

## 0. 范围定性（根口径照抄，不改写）

#324 的 14/14 是 **v4 文档/创建链**；dispatch 仍 **binding fail-closed**；
**不是 v4 工具执行终验**。v4 feed/归因装配缺 = 当前实现缺口。本单 = **准备
集成**，不是宣布 v4 可用。glob 行保持 typed-shut 待其集成轮（本单只用
read/search/shell 三腿）。

基 = 本地合并树 `alpha5-v4-flip@a7a1cfd2`（#324 内容）+ `master@0e59140b`
（runtime_base narrowing bug fix）合并 = merge commit `4aff3071`。
不碰 #322/#321 面与 a5glb 文件；一次性 worktree `.worktrees/a5g8-v4feed`。

## 1. 缺口盘点：v4 dispatch fail-closed 的确切位置（①）

v4-flip 轮自带 live-host leg 14/14（`../v4-flip/run-v4-live-leg.mjs`，
final run `23-27-09`）已把 fail-closed 打到**精确落点**：

* A0–A3：v4 saved source 过 catalog（schemaVersion 4/current）、v4 team
  create 过 production parse-once→validate→snapshot（第四 parser 真跑）；
* A4.0–A4.3：v4 team 上 leader `create_member`+`team_delegate` 真跑、member
  ask 开 DURABLE leader-approval、human allow 落 ledger 且被消费；
* **A4.4：allow 消费后，member 的 bash dispatch 走到 Tool Binding
  verification gate**——这就是 fail-closed 落点（拒路 =
  `packages/runtime/tool-dispatch/install.ts`：Guard per-call 要求 scoped
  公开读解析到 provider 在 placement 时刻记录的 `definitionIdentity`
  （`def#N` = install.ts:102 进程内 WeakMap 指纹），feed 无条目 =
  `TOOL_BINDING_UNVERIFIED`）；
* **A5.0：未验证 binding 执行了 NOTHING**（无 marker 文件落盘；closed
  world，无 native body 回退）——fail-closed 行为本身正确。

### 装配行级差（v3 #313/#315/#321 面 vs v4 面）

| 装配行 | v3（#313 feed / #315 backends / #321 plane） | v4（a7a1cfd2） | 差 |
| --- | --- | --- | --- |
| 文档解析/验证/hash | v3 闭集 ✓ | 第四 parser + `toolBindings` 验证 + present-only hash ✓ | 无差（domain 面全绿） |
| host 行 config `teamToolPlane` → `createTeamToolPlaneAssembly`（agent-bindings.mjs:2412，**era-agnostic**，无 schemaVersion 门） | 有 config 的世界真装配（glue7 kit H 系列） | v4-flip 14/14 世界行 config **不带** `teamToolPlane` | **差①：v4 世界无 plane placement** |
| placement feed（`a5PlanePlacementFeed`）+ lazy `bindingFeed`（def#N 在 seam install 时 mint） | 齐（GLUE-7 live handle） | 无（无装配即无 feed） | **差②（与差①同源）** |
| Guard per-call identity 比对 | 绿（正控真执行 + RED 原文拒路都有钉） | 到 gate 即 `TOOL_BINDING_UNVERIFIED`，NOTHING 执行 | 行为正确；缺的只是 feed |
| v4 文档 `toolBindings` authoring family（owner/name + authorization + io lanes + execution facts，`blueprint-v4.ts:139`） | ——（v3 无此面） | **runtime 消费者 = 0**（packages/runtime+tools grep，非 dist/test 零命中） | **差③：authoring 语义未映射进 dispatch/feed 面** |

结论：v4 执行 feed 的装配缺口是**接线级**（差①②），不是架构级——plane 面
本就 era-agnostic；差③（authoring family 消费）是本轮的诚实申报点：Guard
binding identity = **placement 时刻的运行时对象指纹**，文档 family 是声明面，
本轮在装配侧做**一致性读验**（执行事实冲突即 refuse mount），不新造身份代数。

## 2. live 轮真实抓到并钉下的装配/披露面（GREEN 迭代全录）

* **placement 行属于 team-tool 家族**（agent-bindings:2575 `teamToolNames =
  selected + a5PlaneOwnNames`）：v4 BP member `teamTools: {kind: deny}` 会
  **显式拒掉治理行**（GLUE-7 世界的 member 面是 allow-空集——原生 team_* 目录
  靠缺席关闭，plane 行走自身治理）。v4-flip 14/14 的 RED 世界用 kind deny
  无碍（无 plane 行），fed 世界必须 allow-空集。preassembly RED 保留逐字形。
* **permissions lane 家族闭集 = read|read_image|write|edit|lsp|bash|pwsh**
  （create MALFORMED_DTO 实测）：grep/glob **不在** lane 词汇——搜索族不归
  permission lane 管（#321 同面）。**实测披露面**：lane 的 `bash` 家族匹配
  **不覆盖 placement 名 team_bash**——fed 世界 placement-row dispatch 的治理
  = plane 自身（Guard binding identity + confined provider + 行 schema），
  durable leader-approval 面**不为其开请求**（A4.1/A4.3 按此事实钉，
  ledger 空=一致而非旁路）。此面如实上线，是否扩 lane 归根裁。
* **shell 行闭集 schema = {command}**：多余 `timeoutMs` 落行自身
  `refused-schema code=unknown-field`（行内治理在工作，非缺陷）。
* **mock 面的 rc.2 wire 教训**（kit 自身，非产品）：tool 结果以 user-message
  tool_result 形回（lastUser 判据在 turn2+ 失效——用 trigger-消息判据）；
  toolCall 包装是 2 参（3 参错位产 MALFORMED_RESPONSE 被宿主拒）。

## 3. 正控终态（assembled 面）

C0 placement-feed 行过 #313 同一 feed（realm a5g8-v4-realm）· C1 **read 真
字节**（A5G8-V4-REAL-BYTES-42 上线）· C2 **grep 真命中**（真 rg/grep over
governed root）· C3 **glob 诚实 shut**（IO_POLICY 上线，无名单）·
C4 **team_bash confined 真执行**（exit=0 + TOK + sentinel 真写入 governed
root）。RED 面对照（preassembly）：A4.4 fail-closed 原文 + A5.0 零执行，
14/14 逐字重跑绿。
