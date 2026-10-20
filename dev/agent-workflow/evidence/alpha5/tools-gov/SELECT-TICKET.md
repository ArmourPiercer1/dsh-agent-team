# SELECT-TICKET.md — 原生文件工具 I/O 执行中介选型单（**实现选择候根阅**，PR#249 既定授权范围自决表述）

提出：A 路（tools-gov）@2026-10-19T09:4xZ（终版补注 @2026-10-20T06:3xZ）｜ 依据=根 07:46Z 三层令 + 08:4xZ 减负令（选型单自决直提，勿升级用户裁决）｜ 基线=产品 `d5de7497` + 修复 `095204a6`（subtree 注入腿）+ `5e8db4ac`/`bc97ad0c`（seam 三调用形归一：平面串形 `team-tool-plane.mjs:400`、governed-effect-backend 单对象形 `{realmId,parent,child}` `plane-effect-backends.mjs:826`、防御性 matcher 资源对象形；三形同键=一裁决）

证据态披露（不冒称）：三形态活体收据=既有跑（wide 07-59-11Z、lanes 08-58-04Z+10-08-28Z 复跑、ask 09-43-04Z 15/15、unmanaged 10-04-58Z U1/U2 实锤）；**四世界 @bc97ad0c 全绿终轮（机器 criteria.json 完整档+wa2 正控 U3 活体 GREEN）因 ENOSPC+G4 空间审计候重型令解除后重跑**——seam 形制的端到端正收据在彼轮落档，本单终判**不依赖**该轮（三形态证据已齐），只补机器档完整性。

## 1. 终判（层3，行为级+静态双证）

**原生文件工具 write/edit/read_image（连同 opt-in 的 str_replace_editor）在 Team 治理面上不存在 I/O 执行中介**，两形态均有真装活体收据（证据全在 `runs/`，定性见 TOOLS.md §2.8/§4/§4b）：

- **宽形（legacy 成员，无 permissions）**：X9 越界 read 由宿主原生 body 返回内容、X10 越界 write **落盘成功**（wideOutsideWrite 实文）⇒ 无任何 Team 中介（语义归属：无治理对照世界之对照成立正证）。
- **治理形（strict 成员）**：deny 道有效（L2/L3/L5：车道拒+**零落盘/零副作用/零泄漏**，L8/L9 symlink 跟链拒）；**allow 道被闭世界 Guard 拒执行**（L1/L4 `BINDING_UNVERIFIED`，`closed-world-guard.ts:199`；绑定铸造只覆盖 plane 行名 `agent-bindings:2327`）⇒ **governed 成员对 write/edit/read_image 没有合法可执行路径**。
- **ask 形（批准后仍不可执行，第三形态）**：车道/裁决/消费全通（run 09-43-04Z 15/15），**一次性 grant 在 guard 被消费后**原生写仍吃 `BINDING_UNVERIFIED`（TOOLS.md §4c/R-6）——**授权一次性烧掉而操作未跑**（语义空洞面）；"批准≠可执行"在本构建里是可复现常态而非边角。
- **静态钉**：四件 body 全骑宿主原生 fs-local（write.ts:108→fs-local writeText:202 realpath-targetKey→writeFileAtomic）；`PLANE_SUPPORTED_NATIVE_TAKEOVERS={bash,read}` 闭集（team-tool-plane.mjs:321-326）无文件类接管形；检查→执行=两次独立 resolve 无对象传递（fd 级固定缺失；决定论 symlink 形已被 realpath 键挡住——A7/A8 实证——活体竞速形仍是静态敞口）。

## 2. 选项对比（PR#249 路线：adapter 优先 → 工具级 bounded fork）

### A) adapter 语义扩展 —— **判定达不到 I/O 中介（不推荐，作穷尽记录）**
pre-execute adapter 的权威边界=决策点（`ctx.on('tools/pre-execute')` 在 body 之前；`next()` 之后控制即交回宿主 body，body 自带二次 resolve+落盘）。适配器**无法**把"已验证的对象"递给 body（宿主工具参数=字符串路径，无 handle 通道），只能继续做门。A 案的全部可得形态=今天的层1-2（车道+检查），已由 lanes 实证其有效性与**固有上限**（检查≠执行）。⇒ "adapter 优先"路线在本缺口上被证据穷尽，非未尝试。

### B) 工具级 bounded fork（**推荐**；fork 定义权在我方，挂现成 open-at-exec 法）
> **放行状态（根正式放行令 @2026-10-20）**：现放行=**仅 bounded READ 试点**（实现+测试，isolated，不改生产装配现行为；branch `a5-read-pilot`）；write/edit/read_image 阶段**未放行**（另 gate）。设计+测试计划=`B-READ-PILOT-DESIGN.md`。

在我方层以同名注册的**受限复刻件**（同 schema、同输出信封形状；试点=read 一件），body 走 `controlled-fs` 的 **open-at-exec 现成件**（`packages/runtime/controlled-fs/src/open-at-exec.ts`；glob-backend 同款法 `glob-backend.mjs:16-17/:150`）：realm 根下 `open(→O_NOFOLLOW 族)→fstat 校验→fd 读写`——**检查与执行同一 fd 对象**。
**纠正注（根 07:0xZ，事实性）**：初版"TOCTOU/alias/symlink 竞速面在 fd 级全部关闭"**过宽，撤回**——单点 O_NOFOLLOW+fstat 只闭合 final-component 面；ancestor traversal/parent retarget/hardlink/rename 需 trusted-dirfd 链、openat2 resolve，或诚实的 restricted trusted-tree profile；**任何情况下 validation 前禁 O_TRUNC**。逐项机制与未覆盖诚实披露见 `B-READ-PILOT-DESIGN.md`。

**R2/R3 blocker 精确 host（记名可复现；host=0.2.0-rc.2 @`639ed01539`）——为何原生面无 I/O 中介、既定两路线达不到**：
- 原生 read 体两截式字符串路径律：check 截 `packages/fs/tool-fs/src/read-target.ts:24-25`（`ctx.fs.resolve(path)`→`ctx.fs.stat`），exec 截 `packages/fs/tool-fs/src/read.ts:146-147`（`ctx.fs.streamText/readText(target)` **二次 resolve 后自行 open**）——两截间无 handle/fd 通道（`ctx.fs` 公开契约=路径字符串）；write/edit/read_image 同律（`write.ts:108→fs-local writeText:202 realpath-targetKey→writeFileAtomic`）。
- **R3（公开 helper 组合）不可达**：search 族有公开组合面（`parseGrepArgs/buildGrepCommand/…` plan §8），**read/write 族零公开 helper 面可注入受控 open**（body 直调 `ctx.fs`，tool-fs/src 导出面核对无注入点）。
- **R2（isolate 原生体重装）不构成中介**：isolate 只分离 realm；重装 body 仍跑同一两截式 resolve 律——隔离≠执行时对象绑定；闭集 `PLANE_SUPPORTED_NATIVE_TAKEOVERS={bash,read}`（`team-tool-plane.mjs:321-326`）的 read 接管属 **fs-instance 控制面**（governed-read executor；四世界收口 U3 活体 GREEN 证其在册），不中介工具 wire 面原生体。
- ⇒ "检查与执行同一 fd 对象"只能=独立注册 ToolDefinition 复刻件（原契约保真）——即 `tool-fork-debt.md` A5-FORK-001 步骤 3→4（具名 reproducible blocker 在先；fork 为预批默认，同 scope/原契约无需二次架构选择）。

**受控边界复用声明**：试点**复用已证 controlledFS syscall 边界**（不新造机制）：`packages/runtime/controlled-fs/` wiring 轮已落地面——`verifyOpenedHandle`（`/proc/self/fd` escape+fstat drift 复核）、`bindAdmissionRecheck`/`createAdmissionGatedControlledFs`（逐调用 PR1 指纹重审：binding/gen/args/grant/abort 运行时逐项校验入口）、`ARBITRARY_TREE_PROFILE_PUBLISHED=false`（任意可变树=显式 fail-closed，PoC3 第三臂先例，不 pass 化）、`OpenAtPort`（openat2 端口留真未接，残差不冒称）。残差窗口径按该包 README 继承并逐项列账。

- **与 Guard 的咬合**：同名注册由我方层持有定义 ⇒ Guard 验证走"装配面定义"比较（NATIVE_SHADOWED 法反用：我们**就是**那个 shadow，且它是被绑定/可验证的 def#N）；bindingFeed 增列我方 fork 名即可铸绑。**无需**动 Guard/kernel（三面零冲突确认：不触 team-tool-plane/backends/agent-bindings:2470 邻域——注册点在我方 tools 装配段）。
- **改动面**：新 `packages/tools/src/governed-fs/`（fork 体+形状钉 spec）+ agent-bindings 装配段挂载行（既有序列内，strict 成员才挂）+ 形状对拍 spec（wire 结果与宿主信封逐字段对）；p4t6 续链按实测。
- **风险与对策**：①fs-observation-policy 瀑布（fs/write-intent 读后写律）不过 fork ⇒ fork 体内自接同款意图法或 typed 披露拒（先做读后写律复刻，形状对拍含 FS_NOT_OBSERVED 腿）；②sandbox_permissions 升级字段 fork 不支持 ⇒ schema 广告面按 confining fs 关闭（与宿主 sandbox.ts 行为一致形）+typed 拒文；③read_image 的模型模态门保留（复用 assertImageCapableRoute 语义=经公开 ctx.get('llm')）；④str_replace_editor 维持独立 opt-in 包原样（不 fork，治理口径=strict 须 deny+builtinToolDeny 唯一关断腿，根令口径）。
- **与钉表机检相容**：受管名恒等集不变（7 件名逐字同），census identity 集不动。

### C) 现状+披露（**次选**）：保持车道治理+闭世界 Guard 宁拒不放，正式披露"治理成员无文件写执行道"为已知限制。仅在根裁定活体竞速敞口不可接受 B 的实现成本时取；**不取为默认**（功能面=治理团队不能写文件）。

## 3. 建议与序

**B**（bounded fork on open-at-exec；复用声明见上）。**已放行段=仅 read 试点**：设计/测试计划（`B-READ-PILOT-DESIGN.md`）→ 实现+单元 → pinnedHost 活体三形态（allow/deny/ask→实际 bytes+FD witness；**原生 body 调用计数=0**；schema/output/errors/cancel 四 parity 对拍；每条机器档含精确头）→ 独审 → 根 gate 后才谈下一阶段。**竞速腿裁定形（根令，取代初版"fork 下仍写原 fd"表述）**：retarget 发生=**typed reject**——pin 连续性**不得**绕过撤销 lease/current policy/identity mismatch（"retarget 后总写原 fd"作为验收形**作废**）；undefined 情形先 reject；write 阶段一切语义候其专属 gate（validation 前零 O_TRUNC、read-for-edit、write-only 无旧数据泄漏、禁 pathname reopen）。
