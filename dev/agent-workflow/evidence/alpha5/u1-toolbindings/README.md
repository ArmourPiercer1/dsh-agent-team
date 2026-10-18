# U1 — v4 `toolBindings` 家族最小设计核验（根 02:21Z ②：先查既定设计，缺实现/缺字段≠上裁）

**性质：** 只读考证件（零生产面改动、零端口、零世界、零宿主）。
**分支：** `alpha5-u1-probe` @ base `alpha5-int-mnt`（`46e5649a`，含 GLUE-8 停针件 `8b1dbb5a`/`27e99745`）。
**方法：** 全部断言 = 本树 `git grep`/`grep` + `read` 亲验（行号=本树字节）；#249 面以仓内镜像件为据（PoC 指南 + `evidence/alpha5-adapter-p0/`），无 GitHub 网络查询。
**被核问题（根 02:21Z ②照抄）：** GLUE-8 停针披露「v4 面 toolBindings 家族 runtime 消费者=0，家族无 digest/def-anchor 字段，映射 def#N=新语义待裁」。

## 0. 结论速览

1. **承诺程度**：#249/S0/PR8 承诺的是（a）字段族在 vNext schema 的**存在与封闭形状**（已交付 #316/#324）、（b）**声明语义**（无隐式默认、声明零授权力、不新造第二套身份语言）、（c）家族进**内容哈希**；**没有任何一处**承诺本窗口内 runtime 消费 v4 家族，**没有任何一处**承诺 `def#N` 由家族推导。runtime 生效被**排期**给 effect-queue 行为轮（ADR §7 原文 + `docs/blueprint-authoring.md:168-172`「safe-but-dark」），PR8 总 Gate（矩阵+真拒）才收全量效应行为——**缺实现=在排期，缺字段=既定封闭形状，均非新裁**。
2. **复用差**：feed 通道（#313 入参面）条目 = `{definitionIdentity, realmId}` 平坦两键、身份=placement 时刻 WeakMap 指纹（不可作者、进程内、内容无关）；v4 家族条目 = `{owner, name, authorization, io, execution}` 声明五键——**除 `name` 外键集不相交**，家族侧无任何身份载体，feed 侧无任何策略载体，不能不改语义直接复用。
3. **定性**：**可映射**（选项 A=现状律即最小安全映射：家族=声明面，身份继续走 placement，效应接线归 effect-queue 轮——GLUE-8 assembled 20/20 已实证 v4 世界在家族全暗下真执行）；**选项 B**（def#N 自家族推导）**须新增一条确切身份语义**且撞 `不新造第二套身份语言`（CAND D-04）与 #313 三闸的 placement-only 权威法，才是真待裁。
4. **明确声明**：**不假定用户已被问过本件 §3.3 的问题**——该问题（作者面是否获得身份 mint 权）在本仓任何已登记待裁表（A-1..A-8、§6.1 U 表、DECISION-PACK）中**无先例条目**，属 GLUE-8（02:2xZ）首见披露。

---

## ① 承诺溯源（每一处相关原文；分类 A=字段存在/形状，B=runtime 消费行为，C=v4 生效，D=运行时绑定治理·非字段）

### 1.1 PR #249 线（Alpha.5 P0 PoC 案）

- **`toolBindings` 字样 = 零。** `docs/plans/memo/alpha5-tool-io-governance/P0-independent-adapter-poc-implementation-guide.md` 全文 grep `toolBindings` 无命中（本会话实测 exit=1）；PoC 证据目录 `dev/agent-workflow/evidence/alpha5-adapter-p0/` 全目录 grep `toolBindings` 亦零命中。
- 该案全部「绑定」句均为 **D 类（运行时工具绑定治理）**，与作者面字段无关。代表原文：
  - `P0-…guide.md:15`「一个 **GO** 必须同时证明：**身份与工具绑定** → 独占分发 → Team 准入 → 实际强制 I/O → 结果语义及生命周期」
  - `:48`（INV-1）「当前 Team Agent 实际可分发的工具集…均有 Team 管理**绑定**；被显式 deny 的工具不得通过 Adapter 重新显露可执行能力」
  - `:51`（INV-4）「授权**绑定** Member、Tool Binding、参数指纹、权限世代、资源/Realm 和一次分发」
  - `:196`（BND-05）「装配不部分发布，未知**绑定** fail-closed」
  - `:99/:112/:115/:142/:165-166/:184` 同族（可检测**绑定**漂移/再次**绑定**检查/Grant **绑定**真实隔离），皆 D 类。
- `S0-SELECTION-MATRIX.md:7` 只把 #249 钉为证据快照（『PoC 证据快照 = PR #249 线 `exp/alpha5-poc-20261016`（终态取证 HEAD `a2e741a0…`）』）；`:53` 出现的 "digest" = **证据重放 digest**（『R2 复核 digest 逐字节重放 VERIFIED』），**不是**家族字段承诺。

### 1.2 S0 计划（`alpha5-s0-pr0-pr8-implementation-plan.md`）

| 行 | 原文（摘引至足以定性） | 类 |
| --- | --- | --- |
| `:16` | 「当前 Blueprint **v3 closed**；新字段只是内部 TypeScript 契约，直到最后迁移门才进入受支持 vNext。」 | A（限定：vNext 才有字段面） |
| `:171`（§11 PR8） | 「PR8 再选择明确的 vNext 版本（建议 4，但须记录正式 Schema ADR）实现 `toolBindings`、Read/Write/Network I/O Policies、Provider/Execution Boundary Binding、Assurance 引导与诊断；…迁移必须显示拒绝/升级策略，不自动从缺省字段推断 unrestricted。」 | **A**（承诺字段族进 vNext schema）+「实现」二字的**语义未展开**——VNEXT-SCHEMA-ADR `:81` 已点名此为「文本真空」（A-1 选项 (c) 注：『S0§11:171 只说"实现"该字段族，未说必填——文本真空』） |
| `:173`（§11 测试） | 「严格 Schema 拒绝未知字段/错误版本；…动态 Binding 与新 Tool 不因迁移而成为隐式 allow…」 | B 的**负向**面（禁隐式 allow），非正向消费承诺 |
| `:175`（§11 矩阵） | 「所有 Supported 都能由独立 Reviewer 在固定 HEAD 上复跑，所有 Unsupported 在运行时**确实拒绝**。`P0 fixture 成功` 不能抵 PR8 Gate。」 | B+**C 仅在 PR8 总 Gate 收口时**（效应全量验收=PR8 Gate 本身，非翻档轮） |
| `:58`（§3 PR0） | 「在现有 `packages/runtime`/`packages/domain` 内建立内部 `ToolBinding`、`ResourceRef`…」 | D（内部契约；已落 `tool-governance/src/binding.ts`） |
| `:212` | 「PR8 最终形成 vNext Blueprint 与真实 Host 证据链。」 | A+C（排期在 PR8，非当前窗口） |

### 1.3 设计/架构件

- `post-poc-technical-design.md:222`：「**当前生产 Blueprint v3 是封闭 Schema。** 本文件新术语/`toolBindings`/`io`/`Assurance` 均不应被认为已可以直接写入 v3。先在 PR0 冻结内部类型及明确默认拒绝策略，PR8 再处理具备正式 ADR 的 schema vNext（**v4 只是候选版本号**）与迁移；任何版本变更不得静默扩权…」 → **A**（+反向警示：不得视作家已可写）。
- `post-poc-technical-design.md:169`：「`ToolBinding` 包含 Agent/Scope Key、可执行 Tool 名与 **Definition 身份**、Provider ID/Origin、executionBoundary、assuranceContract…」 → D（内部面定义身份字段存在，来源=装配事实，非文档字段）。
- `architecture.md:32/35-36`：「## 3. Proposed contract data shapes (non-executable examples)」+「# Proposed illustration; CURRENT Blueprint v3 DOES NOT ACCEPT this structure.」下即 `toolBindings:` YAML 样例 → **A（形状示例）+ 自带非生效声明**（示例中的 `execution.kind` 后被 CAND D-05 移除，见 `pr8-accept/migration-negative-cases.json` N-F03）。

### 1.4 PR8 行文（pr8-accept 候选集 + 正式 Schema ADR）

- `pr8-accept/README.md:3`：「**状态：CANDIDATE / DORMANT。**…负例集**未接任何运行器**」；`:21`「**启用时机**：PR8 正式 Schema ADR + 产品级总 Gate 轮」。
- `pr8-accept/ADR-CANDIDATE-blueprint-schema-vnext.md`：
  - `:45`（D-04）**最关键承诺原文**：「`toolBindings` 的作用域键对齐冻结对象模型…：绑定声明于 Blueprint 模板/域层，**解析后生效于 Member 作用域**…作者面绑定身份键 = `(realmId, memberScopeKey, owner, toolName)`，语义与 PR0 冻结契约 `ToolBinding`/`ResourceRef{…}` 一一对应，**不新造第二套身份语言**。」 → 承诺 A+方向性 B；**注意**「解析后生效」是**作用域挂点**承诺（挂 Member 作用域），其身份语言被钉为 PR0 契约同族——而 PR0 契约的 `definitionIdentity`（`tool-governance/src/binding.ts:62`，注释「identity of the registered ToolDefinition shape」）由装配侧 mint，**不是作者可书写字段**。
  - `:27`（D-02）封闭字段表/默认拒绝；`:36`（D-03）无隐式默认；`:54`（D-05）三轴取代 kind（生产落值仅 `implementationOrigin/executionBoundary`，assurance 未入生产字段表）；`:95`（D-10）「schema 声明本身零授权力」。全部 = A+语义律，**无 B/C 承诺**。
- 正式 ADR `ADR-vnext-blueprint-schema-v4.md`（v4-flip 轮转正件，#324 同笔）：
  - `:49-51`：「**v4**：= v3 全部核心面 **+ 可选 `toolBindings` effect-governance 家族**（…家族按 D-02/D-03/D-05 封闭词表拒绝式解析）。`toolBindings` 进入内容哈希的 v4 投影：**只有 `toolBindings` 不同的两篇 v4 文档必须哈希不同**（家族不落进哈希 = 身份洗白…）」 → **A + 哈希绑定承诺（已兑现）**。
  - `:101-102`（§7）：「文档面**接受**这些 token 属 **effect-queue 行为轮**（独立 PR、独立审查）：在那之前文档仍按名拒绝——先钉死的方向是『**parse-accept ⇒ runtime 可映射**』，本文件不制造反向裂缝。」 → **B/C 的既定排期条款**：行为接线另有其轮；本轮只要求「可映射」（映射表在场=满足，见 §2.4）。
  - `:109`：D-02…D-11「随本 ADR **采纳**（grammar 半已在 #316 在产，语义逐腿 = a5sr1…a5sr5 在册钉）」。
- 用户面披露 `docs/blueprint-authoring.md:168-172`：「**Production effect acceptance is still closed.** A v4 document's `toolBindings` is parsed, frozen and hash-bound — but the runtime effect plane does not yet EXECUTE those lanes… **wiring is the effect-queue round's.** Authoring a v4 document is therefore **safe-but-dark for effects**…」 → 发布轮自己声明「未生效」为既定态。
- 待裁登记面 `dev/agent-workflow/evidence/alpha5/prod/VNEXT-SCHEMA-ADR.md`：`:29`（B1 行）「内部对象已冻结：`tool-governance/src/binding.ts:56` `ToolBinding`…作者面→内部面映射引擎已落码且默认拒绝 = `…/field-mapping.ts`（…**DORMANT 待接**）」；`:81` A-1（必填性=文本真空→后按 (c) 可选落产）；`:110` 既定消费链草图「`toolBindings` → ToolBinding{agentScopeKey,toolName,policyGeneration,…}(binding.ts:56)」；`:90` 归位注「A-1..A-8 全部归 ADR Gate 常规转正流程…**是 ADR 问题不是逐条问用户的理由**」。**无任何条目把「家族→def#N」列为已裁/已问项。**

**①小结（承诺到什么程度）**：承诺到「**字段族存在、封闭形状、拒绝式解析、进哈希、方向上经映射表挂 PR0 契约、效应行为排期 effect-queue 轮**」；未承诺「本窗口 runtime 消费」，未承诺「v4 即生效」，更未出现「def-anchor/digest 家族字段」或「def#N 由家族推导」的任何承诺或登记——**GLUE-8 停针披露与既定设计一致，非缺口上裁，唯 def#N 推导问题为新语义（见 ③）**。

---

## ② 现状面（v4 家族定义/校验、v3 面同名家族消费者、feed 结构差）

### 2.1 v4 家族在 schema 中的位置与校验（#316 落 grammar，#324 翻档）

- **顶层位置：** `packages/domain/blueprint/src/blueprint-v4.ts:60` `BLUEPRINT_V4_TOOL_BINDING_FAMILY = 'toolBindings'`；`:63-66` 顶层闭集 = v3 表 + **仅此一家族**；`schema.ts:88` `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3, 4]`（#324 单点翻档；`:74-86` 注释 =「翻档 ≠ 退役」面）。
- **条目闭形状：** `blueprint-v4.ts:68` `BLUEPRINT_V4_TOOL_BINDING_FIELDS = ['owner','name','authorization','io','execution']`（**五键，无第六键**）；io 按 mode 的必/容键表 `:72-86`；execution 闭集 `:88-91` = `implementationOrigin × executionBoundary`（CAND D-05 三轴中 assurance **未入**生产 execution 表）；被移除字段按名拒 `:93-98`（`shadowExecute/kind/adapterId/runnerId`）。
- **类型面：** `V4ToolBindingAuthoring` = `blueprint-v4.ts:139-145`（GLUE-8 README 所引 `:139` 即此）；core 挂载 `:148-152`；`types.ts:499-509` doc-comment 钉「A v4-FACE fact, never a v3 fact…present-only hash discipline」。
- **校验分派：** `validate.ts:1333-1334` 第四支 dispatch → `validateBlueprintV4Document`；家族拒绝式解析 `blueprint-v4.ts:441-457`（unknown-field/removed-field/ambiguous-omission/unknown-enum/path-unresolvable，全路径回显）。
- **哈希绑定：** `validate.ts:1670-1687`（「two v4 documents differing only in `toolBindings` MUST hash differently」注释）+ `blueprint-v4.ts:463-468` `toHashableBlueprintV4`（present-only 投影）。
- **迁移报告：** `migration-report.ts`（M-4；`:11` 注释「v3 carries NO tool-governance fact」）——**生产消费者 = 0**（非测试触点仅 `blueprint/src/index.ts` re-export；p4t6 命中 = 文件名扫描非消费）。

### 2.2 v4 面 toolBindings 家族 runtime 消费者 = **0（独立复核成立）**

```
grep -rn "toolBindings" packages/runtime packages/tools packages/remote packages/client \
  --include="*.ts" --include="*.mjs" --include="*.js" | grep -v /dist/ | grep -v /test/   → 0 行
```

（本会话实测计数 = 0，与 GLUE-8 README `:40` 差③独立相符。）家族的全部生产触点止于 domain 解析/哈希/迁移；`agent-bindings.mjs` 装配面不读 BP 家族（装配输入 = host 行 config `teamToolPlane`，era-agnostic，无 schemaVersion 门）。

### 2.3 v3 面「同名家族」（绑定家族）的现在消费者（行号 = 本树）

**运行时身份代数（def#N）侧：**
- `packages/runtime/tool-dispatch/install.ts:95-107` — WeakMap `definitionIds`（`:95`）+ `definitionFingerprint`（`:97`；`def#N` mint 于 `:102`，与 glue8 README `:27` 所引一致；注释钉「content-free identity」、禁比函数 SOURCE、禁读时钟）；`:116-130` `definitionIdentityOf`（provider 面同一律）；`:133-141` `BindingFeedEntry {definitionIdentity, realmId}` + `BindingFeed`（**pb §6 = #313 入参面**）；`:263` 装配入参 `bindingFeed?`；bind 三闸：`:1077` realm 不符拒、`:1090-1098` 「feed 有名而 assembly 未 placed」拒（**:1098 原文：placement attribution is the only feed authority**）、`:1101-1112` placement→bind 漂移拒；过闸后 `:1120/:1135` 钉身份。
- `packages/runtime/tool-dispatch/scoped-dispatcher.ts:362-381` — 每调用 `noteCallEdgeDefinition`：现场解析指纹 vs `binding.definitionIdentity`，漂移即撤验证（`definition-drift`）。
- `packages/runtime/src/plugin/live/team-tool-plane.mjs:78` import `definitionIdentityOf`；`:483-486` `placementFeed`（对已放置对象 **lazy mint**）；`:507` 交出面。
- `packages/runtime/src/plugin/live/agent-bindings.mjs:2236` realm 常量；`:2309-2318` Guard 收 `realmId`+`bindingFeed`（读 plane placement map）；`:2417` plane 装配共用同一 realm；`:2575` `teamToolNames = selected + a5PlaneOwnNames`。
- 消费者名册（台账机检）= `scripts/audit-a5-tool-governance-imports.mjs:68-80` `PR1_CONSUMERS`：`tool-dispatch/`、`agent-bindings.mjs`、`team-tool-plane.mjs`、`tool-admission/`、`controlled-fs/src/`、`a5p5-tools/src/`。
- **PR0 `ToolBinding` 契约本体**（`packages/domain/tool-governance/src/binding.ts:56-73`，含 `definitionIdentity: string`，`:62` 注释「identity of the registered ToolDefinition shape」）= 生产 **DORMANT**（名册外零 import；`a5p0-layer-audit.test.ts` 钉）。

**#317（P-B-R2，`68deccaa`）生产 feed 消费的是什么：** = **placement/definition identity**（`BindingFeed = (name) => {definitionIdentity, realmId}`；`evidence/alpha5/pb-binding-feed/README.md:29-37` 三闸原文），来源 = 装配放置记录；**不是 v4 文档家族字段本体**。GLUE-8 C0 腿「placement-feed 行过 #313 同一 feed（realm a5g8-v4-realm）」（glue8 README `:77`）——v4 世界吃的仍是 placement 行。

### 2.4 #313/#317 feed 通道输入形状 vs v4 家族字段——**逐项结构差**

| # | 维度 | feed 通道（#313/#317 在产） | v4 家族（#316/#324 在产） | 差 |
| --- | --- | --- | --- | --- |
| 1 | 键集 | `{definitionIdentity, realmId}`（平坦两键，按工具名取） | `{owner, name, authorization, io, execution}` | **仅 `name` 语义重合**；余键不相交 |
| 2 | 身份载体 | `definitionIdentity` = **placement 时刻进程内 WeakMap 指纹**（不可作者书写、不可持久复用、内容无关、重启即换） | **无任何身份字段**（闭五键 + 闭子表，多一键即 `unknown-field` 拒；a5g8 U1 测试钉此形状：`packages/runtime/test/a5g8-v4feed-units.test.ts:9-16`「no digest, no def-anchor…mapping the two WOULD BE new semantics」） | 家族→feed 无源字段可流；**digest/def-anchor 在全部设计文中不存在为字段** |
| 3 | realm/作用域 | `realmId` 必配装配 realm（不符即拒） | 无 realmId 字段（CAND D-04 的 `(realmId, memberScopeKey,…)` 是**解析后作用域键**，realm/scope 由**装配侧**供给，非文档书写） | 同左 |
| 4 | 策略载荷 | 无（纯身份 + realm） | `authorization/io/execution` 全部策略语义 | feed→家族亦无字段可承策略 |
| 5 | 权威语义 | placement-only（三闸 `:1077/:1090-1112`；R5 self-pin 形状已被证伪并拒） | 声明式、默认拒绝、零授权力（D-03/D-10） | 权威来源不同：**放置事实 vs 作者声明**——直接复用 = 让声明冒充放置 |
| 6 | 既定桥 | 装配 → `mintToolBindingFromPlacement` → `parseToolBinding`（a5sr1 头注：「**no parallel binding system**」） | 作者面 → `v4-authoring-map.ts`（DEFAULT DENY 四律；映射目标仅 `authoringOwner/toolName/authorization/implementationOrigin/executionBoundary` + 资源声明候选；**无身份目标键**；DORMANT 待接） | 设计桥两侧都**不携带**文档→def#N 通道 |

**复用差一行：** 两形状除 `name` 外不相交——家族缺身份载体、feed 缺策略载体，「不改语义直接复用」在字段级不存在；设计给定的桥是 authoring-map → PR0 `ToolBinding`（身份仍由 placement mint），**不是**家族→feed。

---

## ③ 最小安全映射选项

### 3.1 选项 A（**可映射，零新语义**）= 现状律即最小方案

家族继续作**声明性效应治理面（含 allow-list 语义）**（parse+freeze+hash-bound，「safe-but-dark」）；dispatch 绑定身份继续由 placement 记录独家 mint（#313 三闸不动）；GLUE-8 assembled 20/20 已实证该组合在 v4 世界可跑真执行（read 真字节 / grep 真命中 / shell confined；家族在场而零消费，entry-comparison 表末行「toolBindings 家族…无运行时消费者…VERBATIM」）。**边界：** (a) 家族→效应执行（io lanes 强制、authorization 与 lane 决策一致性）= effect-queue 行为轮按正式 ADR `:101-102` 排期落，其正门 = authoring-map 接线 + coverage/kernel 镜像同笔（「parse-accept ⇒ runtime 可映射」律由映射表在场满足）；(b) PR8 总 Gate（机器可读矩阵 + Unsupported 真拒 + Leader/Human 限权腿）不收口前不得声称 v4 效应生效；(c) 装配侧若做「执行事实冲突即 refuse mount」的一致性读验，只读三轴事实、不 mint 身份（GLUE-8 README `:42-45` 已自钉此界）。**此路径无需用户新裁**（排期与语义均既定）。

### 3.2 选项 B（**须新语义**）= def#N 自 toolBindings 推导

必须新增的**确切语义恰一条**：

> 「作者面 `toolBindings` 条目（owner+name [+authorization/io/execution]）可**授予**某工具名一个经验证的绑定身份，使 Guard/feed 接受作者声明的 `definitionIdentity`（或由家族条目确定性推导的指纹）**替代** provider placement 时刻 mint 的 WeakMap 指纹作为验证输入。」

影响范围（既有件逐一受涉）：
1. `install.ts:95-141`（content-free / 非作者 / 进程内三条身份律全改）+ `:1077/:1090-1112` 三闸的「placement attribution is the only feed authority」法被倒置；
2. pb §6 契约与 #317 在产 feed 世界（a5pbr2 语义、`a5pbr2` 三闸回归面）；
3. `scoped-dispatcher.ts:362-381` 每调用比对（作者串 vs 运行时对象，比对失去反欺骗性——R5 self-pin 被证伪的正是「非放置来源的钉身份」）；
4. CAND **D-04「不新造第二套身份语言」**（正式 ADR `:109` 已采纳）被正面撞开 = ADR 修正案；
5. PR0 `ToolBinding.definitionIdentity`（`binding.ts:62`）来源律 + a5sr1 `mintToolBindingFromPlacement`「no parallel binding system」钉；
6. `v4-authoring-map.ts` 须新增身份目标键（破「作者面零身份」）+ 家族闭五键须加 digest/def-anchor 键 = schema 扩面，触 D-02 封闭表与 a5sr5 负例表；
7. `a5g8-v4feed-units.test.ts` U1 STOP-pin 翻案 + `run-v4-feed-live.mjs:953-957`（「asserting executed here would assert the wrong design」）所钉设计面改写。

### 3.3 一个可决策问题的精确措辞（只 U1；保守暂停范围 = U1）

> **U1 裁定问：** v4 `toolBindings` 家族的运行时消费，是否批准**选项 A = 既定律不变**——家族保持声明面（parse/冻结/进哈希），绑定验证身份继续只由 placement 记录 mint（def#N 代数不动），家族策略条目（authorization/io/execution）的效应接线按既定排期归 effect-queue 行为轮、本窗口不做任何消费接线？
> 若**不批准**、而要求家族条目参与/推导绑定身份（digest/def-anchor 或 def#N 映射），即须另批 §3.2 引文那**一条新身份语义**（作者面获得身份授予权，撞 D-04「不新造第二套身份语言」，需随附 ADR 修正案）。
> 未获裁定前，**保守暂停范围 = U1 仅此一项**（v4 面家族消费接线不做、不发明）；GLUE-8 已交付面、effect-queue 轮排期、其余 lane 不受该暂停影响。

## ④ 明确声明

1. **不假定用户已被问过任何问题**：§3.3 之问在本仓全部已登记待裁面（VNEXT-SCHEMA-ADR A-1..A-8 表 `:78-88` + 归位注 `:90`/`:139`、§6.1 U 表、DECISION-PACK-20261016、COORDINATION）中**均无既问问项**；A-1..A-8 按根 08:05Z 口径属 Gate 常规转正、非用户问卷，而「家族→身份」连 A-1..A-8 亦不在列——该映射问题是 GLUE-8 停针（SESSION_ROUTER_LOG `:6701-6702`）首次显式化为「待根裁」。
2. 本件为只读考证：零端口、零世界、零宿主、:3080 零触碰、`tests/` 零写入、生产树零改动（本分支唯一新增 = 本 evidence 目录一笔 docs）。
3. **ff push 状态（运行记录）：** 见下节。

## ⑤ 红线与运行记录

- CORE PATCH BUDGET = 0；本分支 = 纯 docs（`dev/agent-workflow/evidence/alpha5/u1-toolbindings/` 单文件）。
- 1 task = 1 branch = 1 worktree = 1 writer（`.worktrees/alpha5-u1-probe`，base `alpha5-int-mnt@46e5649a`）。
- ff push：`git push origin alpha5-u1-probe` 于本会话执行，结果如实记录于此 → **无凭据，未推**（https remote 无凭据，同 GLUE-7/runtime-base 先例）；branch 本地留存，head 以 `git rev-parse alpha5-u1-probe` 为准。

