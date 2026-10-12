# post-Alpha.4 欠债登记（Debt Register）

建立：2026-10-12（HEAD `424f971a`）。owner：协调者。性质：**待逐项对照处理的登记册**，不是当期计划。
Alpha.4 阶段收口（§7.7 人工验收 + 阶段关闭）之后再逐条裁决与执行。

标记约定：

- **[V]** 协调者亲自复现，可直接当事实使用。
- **[L]** 对抗子代理实测、协调者未复现。**引用时必须保留此标记**，不得升格为事实。
- **[裁]** 需要操作员裁决的语义问题，未经裁决不得改代码。
- 每条附出处与复现入口。探针与原始输出：`.tmp-coord/attack/<lane>/`（gitignored，随清理可能消失——**本文是长期记录**）。

---

# 1. 工具管理面（permission coverage 与工具归属）

背景：Alpha.2 A2C-2 的 Permission Coverage Gate（`packages/runtime/operation-permission/permission-coverage.ts`）。
设计理由见该计划 §7.1（"检查的不是工具名是否声明，而是每个工具有没有明确 authority owner"）、
§7.3-D（SAFE_UNMANAGED 必须经 source review **证明**不具备敏感 effect，"名字看起来安全不是证据"）、
§7.8（"任何 preset 更新新增工具：unknown by default → blocked under permissions，必须源码评审后显式分类；
这就是 A2C-2 的主要长期价值"）。实现落自 `8bf703df`（2026-09-12）。

| # | 问题 | 证据 | 分级 |
| --- | --- | --- | --- |
| TM-1 | **门与车道无关**：`capabilities.permissions` 一旦声明即启用（`permissionCoverageGateEnabled`，:413），分类器只查名字与注入的归属事实，**不读 allow/ask/deny**（:294-322），`ok = unmanagedTools.length === 0`。因此在车道里点名一个 unmanaged 工具不能使它过门 | [V] | 设计如此（§7.1） |
| TM-2 | **写不进车道**：`PermissionTool` 闭合 7 值 `read/read_image/write/edit/lsp/bash/pwsh`（`types.ts:52-60`）；`validate.ts:1066-1071` 拒其他名字。`allow: web_fetch` 属 MALFORMED_DTO | [V] | 设计如此 |
| TM-3 | **规则也确实管不住**：执法适配器对非权限工具 `unsupported tool name → abstain (undefined)`（`pre-execute-adapter.ts:78`；`types.ts:203`）。所以"车道算 owner"若不同时扩执法面，等于制度化治理幻觉 | [V] | 设计依据 |
| TM-4 | **宿主基础工具落进 FATAL**：SAFE 注册表只有 `todo_write`；KNOWN_SENSITIVE 含 `grep glob subagent subagent_fork ralph workflow web_fetch web_search job_* send_message interrupt_agent list_agents`（:130/:146/:180）。后果：**声明治理的蓝图在常规宿主 preset 上无法创建团队**（操作员实测 19 个工具被拒，leader 启动失败） | [V] 机制 / [L] 现场 | **缺陷（可用性）** |
| TM-5 | **错误不可行动**：typed detail 每条带 `reason` + `remediation`（:221-231 `SENSITIVE_REMEDIATION`/`UNKNOWN_REMEDIATION`），但消息只拼 `name (classification)`（`errors.ts:423-431`），UI 显示该句；且失败后仍提供"重试"，而重试必然复现 | [V] | **缺陷** |
| TM-6 | **`web_fetch`/`web_search` 没有任何归属设计**：它们在 KNOWN_SENSITIVE（category `network`，:211），但全仓无任何文档讨论"网络能力将来怎么被治理"。`grep`/`glob` 至少有 §11 的延期决策与候选设计；这两个**连决策都没有** | [V] | **缺口** |
| TM-7 | `ask_user_question`、`present`、`skill`、`create_goal`/`get_goal`/`update_goal`/`exit_plan_mode` 在 master 注册表里**均未分类**（grep 计数 0）→ 全部 UNKNOWN_UNMANAGED → FATAL，且用户侧唯一解法是 `builtinToolDeny`（等于必须放弃这些能力） | [V] | **缺口** |
| TM-8 | **`builtinToolDeny` 条目不 trim 不扫描**（`validate.ts:884/:935` 只查类型+长度）：`"bash "`、`"read\0"`、`"subagent_fork\n"` 原样入库 → **永不命中的 deny**。与 TM-4/TM-7 的唯一用户侧解法直接冲突（用户手写清单，复制粘贴即静默失效） | [V] | **缺陷（高实用危害）** |
| TM-9 | 分类器的 C1 控制字符盲区（见 WH-4）会让"带 8-bit CSI 的工具名"这类条目静默失配，与 TM-8 同根 | [L] | 缺陷 |

**post-Alpha.4 待办**：修 TM-5（可发现性）、TM-8（条目清洗/拒空转）；为 TM-6/TM-7 做**归属决策**
（做 adapter 需要 resource 语义；MCP 路线是 §7.3-C 认可的真 owner，可解网络类需求）；
TM-4 的处理取决于 [裁] TM-10。

- **[裁] TM-10**：是否重新裁决 §7.1 不变量，让"在 allow/ask/deny 里点名的工具"计入 authority owner。
  若采纳，必须**同时**把执法面扩到这些工具（否则 TM-3 的幻觉成立），并扩 `PermissionTool` 词汇表。

---

# 2. 对抗测试发现（2026-10-12，9 向量）

向量：A1 空白/控制字符、A2 上限与编码计量、A3 创建顺序与身份、B1 matcher 归一化、B2 权限车道叠加、
B3 YAML 结构与引用、C1 skill 歧义实测、C2 skill 指令字面执行、C3 skill 断言可证伪化 + 覆盖率计数。
**已回**：A1 A2 B1 B2 B3 C1 C2；**C3 部分交回**（未写报告，只有普查原始件，见 §2.7.1）。
**未回**：仅 A3（创建顺序与身份 TOCTOU）—— 交回后追加，不覆盖既有编号。

## 2.1 解析与身份

| # | 发现 | 证据 | 分级 |
| --- | --- | --- | --- |
| PRS-1 | **递归 YAML 文档 → 无类型 `RangeError`**：`metadata: &m {self: *m}` 解出真循环对象，`assertRemoteSafeJsonValue`/`deepFreeze`/`canonicalJsonStringify`/`deriveContentHash` 四阶段全栈溢出，`parseBlueprint` 抛 `RangeError`（docstring 承诺每种违规都是 closed-code `TeamContractError`）。**同一文件** `inspectBlueprintSource` 返回 `ok` + 合法身份 → 目录列出它、强解析必崩 | [V] `parseBlueprint {name:"RangeError", code:null, typed:false}`；`inspectSaysAboutSameFile:"ok"` | **high** |
| PRS-2 | **非 `YAMLError` 解码失败吞诊断**：别名超预算与未知锚点抛 `ReferenceError`，`parse.ts` 的 `instanceof YAMLError` 接不住 → 固定一句 `blueprint frontmatter could not be decoded`，无行号/原因/cause | [L] | medium |
| PRS-3 | **未知标签静默通过且对哈希不可见**：`!Foo`/`!!js/function`/`!!python/object` 仅 stderr 警告后退化为标量/映射被接受；带标签与不带标签同哈希 | [L] | low |
| PRS-4 | **同身份判定不一致**：`teamEnvelope.allow`、capability `items`、权限 lane 的重复条目被保留并改变哈希；而 requirements / memberEnvelopes / policyStates / authority rules 拒绝重复 | [L] | low |
| PRS-5 | 防御成立（负结果，记录以防重复劳动）：同层重复键解码期硬拒（非 last-wins）；别名共享对象不进产物（core 里 `===false` 且全层 frozen）；merge 注不进未知字段、提不了权；`memberId` 无法经别名/merge/容器夹带；展开预算约 100 单元，深度失败也被包成带行号的 MALFORMED_DTO | [L] | not-a-problem |

## 2.2 归一化与内容身份（**本轮最重要的类别发现**）

`contentHash` 是**归一后核心**的哈希，不是源文件身份。四条独立路径让它**该变时不变**，
一条让它**不该变时也变**。因此我们此前对"contentHash = 内容身份"的表述**过头了**；
与 `revision` 由作者自填叠加后，"钉 revision + 看哈希"这套审计话术两条腿都是软的。

| # | 归一化路径 | 证据 | 分级 |
| --- | --- | --- | --- |
| NRM-1 | **授权路径被 Unicode trim 改写，且运行时不归一 → deny 可被静默改址成 allow**：`path` 与 authority file matcher 用 `trim()`（`validate.ts:1176`/`:793`，注释自证"the trimmed value is the normalized path the A3 resolver matches against"），**而运行时 canonicalizer 保留首尾空格**（`resolve(" a ")` 两侧均保留，实测）。6 种源文件（干净 / NBSP / U+3000 / U+2028 / BOM / 空格）归一成 `credentials`，**contentHash 全同** `sha256:429341dc…`。**端到端后果已由 B1 复现（无需活宿主）**：POSIX 上同目录两个真实文件 `secrets.env` 与 `secrets.env␠`，作者声明 `deny exact:"secrets.env "` → **没有任何一道闸拒绝该声明**，规则被静默改址到 `secrets.env`，真实操作落进 `{"effect":"allow","source":"layer"}`；镜像方向（`allow exact:"x "` 把授权落在 `x` 上）同样成立 | [V] trim/hash/canonicalizer 保留空格；**[L→已复现]** deny→allow 全链（`.tmp-coord/attack/B1-matcher/p5-trim-basis-points.mjs` S13） | **high**（提权/失配双向成立） |
| NRM-2 | **配额静默归一**：`takePositiveInt` 只查 `Number.isInteger`（:288），无 `isSafeInteger` 无上界 → `9007199254740993→9007199254740992` 等不同源文档同哈希；同仓 `contracts/src/ids/common.ts:107` 的**同文案**闸另有 `Number.isSafeInteger` → **一字不差的错误消息对应两个不同接受集合** | [V] 代码；[L] 数值 | medium |
| NRM-3 | YAML 标签、`~`/`null`/缺失三态等归一细节 | [L] | low |
| NRM-4 | 重复条目改变身份（= PRS-4） | [L] | low |

## 2.3 控制字符与空白

| # | 发现 | 证据 | 分级 |
| --- | --- | --- | --- |
| WH-1 | **`metadata` 值不经任何控制字符扫描器**：只查 key 模式/类型/长度后 `trim()`（`validate.ts:1495-1519`）；同文档 `displayName` 会被拒的 NUL/ESC/BEL/VT/DEL 写进 `metadata` 全通过并进 core/hash；无测试钉此豁免 → 是漏不是设计。（当前 remote 侧无 metadata 投影，故未升 high） | [V] | **high 候选 / medium** |
| WH-2 | capability 条目不扫描不 trim（= TM-8） | [V] | medium |
| WH-3 | **"非空 persona"闸被隐形字符满足**：`"\u200b"`/`"\u2060"`/`"\u2066"`/孤立代理项通过"完整 LeaderTemplate"不变式，而 `"\u00a0"`/`"\n"` 被拒——空性判定只有 trim 一道 | [L] | medium |
| WH-4 | **全仓扫描器只封 C0+DEL，C1（U+0080–U+009F，含 NEL、8-bit CSI）畅通**；拒绝消息却写 "must not contain control characters"。runtime kernel 同样 `c<0x20||c===0x7f` → 系统性 | [L] | medium |
| WH-5 | 视觉同形 identity：ZWSP/RLO/NFC-vs-NFD 在 `blueprintId`/`revision`/`displayName` 全通过，`team\u200b.alpha@1` 与 `team.alpha@1` 在目录显示面不可区分而并存 | [L] | medium |
| WH-6 | `sha256Hex` 自称 UTF-8 实为 CES-8（孤立代理项发 `ED A0 80`）；**已实测排除**其对 published contentHash 的破坏（well-formed JSON 序列化先隔离），残余风险在裸字符串调用点 `permission-approval.ts:423` | [L] A1+A2 双方独立排除 | medium→low |
| WH-7 | 诊断不可行动：拒绝消息裸插隐形字符；长度消息报 UTF-16 code unit 但 **10 处**文案写 "chars/characters"（`persona` 侧 20000 emoji 报 `(40000)`） | [V] 计数 10；[L] 现象 | low |
| WH-8 | `metadata` 值 trim 成空串且不拒（唯一无"trim 后非空"校验的字段） | [L] | medium |

## 2.4 权限与治理

| # | 发现 | 证据 | 分级 |
| --- | --- | --- | --- |
| PM-1 | 成员 exec 的 `deny` 可被一条 overlay 规则翻成 `allow`（实测 `winningLayer:"overlay"`），而运行时 exec 双闸是 **leader-only**（`pre-execute-adapter.ts:1587`）；glue 的契约前提"a member's exec call cannot be ALLOW"只覆盖 blueprint schema，未覆盖 durable overlay；grant 侧亦不查 token-capability envelope。**升级前提（是否存在被授权路径写进成员 overlay）未证** | [L]（引文 [V] 核对） | medium（前提成立即 high） |
| PM-2 | 无命中时 fallback 取**最低层** default（位置规则），非取最严：`blueprint ask + template deny` 无命中 → `ask`。今日生产不可达，Alpha.4 接入 blueprint 基线层即成实 | [L] | medium |
| PM-3 | 严格 `capabilities` 但**省略 `permissions`** 的成员：参数级闸门与 Coverage Gate **双双不装**（`agent-bindings.mjs:2324-2332` / `:2270-2286`）→ "声明控制会收紧、省略控制会把两道闸一起撤掉"，与作者直觉相反；skill 未披露 | [L] | low（披露缺口） |
| PM-4 | 高层 allow 退役低层 deny、team 级 `capabilityPolicy` 不是 ceiling —— **冻结语义且代码/spec 披露充分**，仅 skill 未披露 | [L] | by-design |
| PM-5 | 负结果：顶层 `permissions:` 不可声明；`allow: []` ≠ 字段缺失；`default` 两面闭合 `ask|deny`（无 skill/代码漂移）；重复/嵌套/跨 lane 同资源恒 deny 胜；成员无法冒充 leader、成员不能声明 shell allow | [L] | not-a-problem |
| PM-6 | `selectiveToTemplatePolicyValues` 产 `{allow, items:[]}`，而 `resolveEffectivePolicy` 判其 malformed，仅靠 `root.ts:1923-1945` 一处归一化存活；`deriveTeamResolved` 无生产调用者，新消费者会撞 throw | [L] | low |

## 2.4.1 B1 结果（resource matcher 归一化）

**先记负结果（省后续力气，均为实测）**：

- **subtree 语义边界封闭**：`subtree:/home/user` 覆盖不到 `/home/userevil`、`/home/user2/x`、`/home/user.txt`、
  `/home/user/../userevil`；覆盖 `/home/user/x`。机制是 **separator-锚定的 `relative()`**
  （`host.ts:1916` → pinned upstream `LocalFileSystem.contains`），**不是 `startsWith`**；
  谓词缺失 ⇒ `undeterminable`，绝不当作"非匹配"。
- 路径形状（`a/../b`、`./a`、`a//b`、尾斜杠、`%2e%2e`、`a\b`、NUL、首尾空白）**全部在 canonicalizer 一处吸收**，
  规则侧与操作侧同一函数同一 seam；NUL ⇒ `ERR_INVALID_ARG_VALUE`，缺失段含 `..` ⇒ `FS_NOT_FOUND`（fail-closed）。
- NFC/NFD 在 Linux 是两个真实目录，`contains` decisive-false 正确；全角 `／`、`%41` 按普通字节文件名处理。
- carrier 前缀语法**单射且往返无损**（`exact:subtree:/x` 仍是 exact；冒号与 Windows 盘符无损），
  外来语法类型化拒绝、**绝不丢规则**。
- 类配对律生效：shell 只 fingerprint、file 只 exact/subtree，未知 `operationClass` 拒绝且"never silently inert"。
- shell 两侧共用 `canonicalizeShellOperation`（`omitted ≡ "." ≡ "" ≡ "  "` 同指纹）；
  command 逐字哈希的拼写锁定属 **ADR A1-22 已披露**（"no broad shell allow/deny exists"）→ by-design。
- B1 自认押注最高的向量**不成立**：`matcherCovers(exact:/a → subtree:/a) = false`，
  exact 根点规则无法在 region 分区里洗白 subtree rise。
- ask 与 consumption 共用 `operationApprovalCandidatePoints` + 持久 fingerprint ⇒ 点集不能分叉。

| # | 发现 | 证据 | 分级 |
| --- | --- | --- | --- |
| PM-7 | **carrier 读路径接受写路径拒绝的空 canonical identity**：`parsePermissionResourceText('subtree:') → {kind:'subtree',resource:''}`，而 `validateMatcher` 拒空（`matcher-resource-empty`）。空串进 `relative('', child)` ⇒ **按 `process.cwd()` 解析**，该 matcher 经真实决策 fold 判为覆盖宿主进程 cwd 下全部文件（`allow subtree:` vs 工作区真实文件 → `{"effect":"allow","source":"overlay"}`；vs `/etc/passwd` → deny/fallback）。**一行修**：读侧 resource 为空即返回 `undefined`（两个消费者已有 `OVERLAY_VIEW_UNDECODABLE` / `overlay-carrier-unparsable` 类型化拒绝） | [L] | low（可达面是外来/损坏/桥接耐久行，插件唯一写路径拒空） |
| PM-8 | NRM-1 的镜像表述（读侧 `parseAuthorityEnvelope` 接受 NUL/newline/DEL/C1/U+2028/4000 字符，界只在 `validateMatcher` + Blueprint 两道闸；**grep 全仓其生产消费者 = 0**）→ 属 by-design，但**任何新增旁路消费者都会立即变成 fail-open** | [L] | by-design（附警戒） |

**需活宿主的命题（B1 未主张任何未实测机制）**：

- **P-1（最高价值）exec 指纹基准等式**：授权期用成员**耐久 workspace**、执行期用 **live session cwd**；
  单元级已证同一 intent 两基准 → 两个指纹且 grant 指纹 `covers:false`（overlay exec 规则静默失效）。
  源码声明同基准，**但权限平面内没有强制该等式的代码**。待活宿主：grant 一条 exec 规则后在
  `session cwd ≠ 耐久 workspace` 形态下重放同命令，看是否仍落 ask。
- P-2 归一不敏感卷（macOS/APFS）下同文件双 key ⇒ deny 可能失配（需 macOS）。
- P-3 ask→consumption 之间 symlink 换置（本机已证身份是 realpath 物理身份，方向安全）。
- P-4 耐久表是否存在插件外写者（v1/v2 桥接、迁移、直接 DB 写）——决定 PM-7 的真实可达性。

**方法论披露（值得沿用）**：B1 报告 `packages/domain/blueprint/src/validate.ts` 比 `packages/runtime/dist` 新，
故凡涉该文件**一律以源码引用、不以 dist 为准**。本轮多次踩过分隔，应写进 lane brief 模板。

## 2.5 解析成本与预算

| # | 发现 | 证据 | 分级 |
| --- | --- | --- | --- |
| CST-1 | **单字段有上限、整篇文档无预算**，且 yaml 解码成本随 **mapping 条目数**超线性：2 万键 metadata（263 KB）单次解析 **11.0 s**（yaml 10963 ms / 域内校验 53 ms / 哈希 114 ms；同字节量单标量 2 ms）。`members` 数、`metadata` 条目数、saved source 字节均无上限（`blueprint-source-index.ts:190` 无 size 检查）；catalog 是每请求重扫 → 放大为 请求 × 文件 | [L]；[V] 代码侧无上限 | medium |
| CST-2 | 域内自研 `sha256Hex` 比 `node:crypto` 慢约 20×（256 KB：20 ms vs 1 ms，摘要相同） | [L] | low |

## 2.6 作者面（skill 与文档）

三条独立 lane（B2/C1/C2）交叉命中。**照 skill 字面执行必然失败 3 处**：

| 位置 | 现状 | 应为 |
| --- | --- | --- |
| BA §5.1 :327/:328/:334 | `resource: {kind, value}` | `{kind, path}`（照抄即 `unknown fields: value`）[V] |
| BA §6 :500 | 预检写 `schemaVersion: 1` | `3`（同文件 :101 说仅支持 3）[V] |
| BA §7 :533/:538 | 裸 `curl …/team-remote/…`，端口占位 `P` 不可粘贴 | 需先换 launch-token cookie，否则 401 且非 JSON [L] 401 行为（有 characterization 探针钉）；文本缺陷 [V] |

其余 skill 缺陷：`Top level (14)` vs v1=15/v2=16/v3=17（漏两个 v3 必填权威文档）[V 措辞/L 计数]；
revision 称"a positive integer"（实为字符串且强制加引号；**非数字 revision 按 catalog 序排在所有数字之上**，
`catalog.ts:64-68` 注释自证为有意规则，故手误/`wip` 会成为 latest）[V 机制/L 后果]；
`thirteen-tool catalog` vs 实际 15（姊妹 skill 写 fifteen，**两份互相矛盾**）[V]；
LO :268 `team_list_pending_approvals` 工具名不存在（真名 `team_list_pending_control`）[V]；
LO §6 status 闭包只列 8 项（实 10，漏 `permission-mutated`、`control-escalated`）[L]；
`teamTools.items` 名字不校验（`team_frobnicate` 被接受）[L]；
§4.1 推荐的 `minimal` preset 与 `persona: standard` 互斥（roster 把 minimal 观测为 `complete` → 不可降级 FATAL）[L]；
flat `requirements` 可填 preset id（skill 称解析期拒，实际只在探测期 FATAL）[L]；
未披露：省略 `permissions` 的后果、`capabilityPolicy` 不是 ceiling、`<<` 合并键两种写法行为不同、
`~`/`null` ≠ 缺失、`0777` 跨工具解释差；未说明强校验器住所（`packages/domain/dist` 是 P1 骨架占位，
真实在 `packages/runtime/dist/packages/domain/blueprint/src/index.js`）——**离线自证者会导错包并得到"什么都不校验"的假绿** [V 骨架事实/L 其余]。

## 2.7 元结论：为什么我们的验收没抓到这些

- **[V]** 全部可执行验收语料里的 `persona` 都是单物理行（折叠式 `>-` 相邻行会被折成空格）→ 换行从未进入校验器；
  "多行 persona 被拒"因此潜伏 41 天（`d0002128` 2026-08-30 生，`17d2b357` 修）。
- **[V]** 客户端测试引用 `modeSelectionEnabled` 16 次、**0** 次覆盖"字段缺失"这一支（stub 默认 `?? true`）
  → 三值字段被当二值，15 天（`730f83b0` 生，`424f971a` 修）。
- **[V]** 语料里 `builtinToolDeny`/`metadata`/capability items 从未出现带空白或控制字符的条目 → TM-8/WH-1/WH-2 零覆盖。
- 结论（沿用本轮既有表述）：**语料与 stub 编码的是作者的写作习惯，不是用户的真实形状**。
  补强方向：带段落空行的 persona 蓝图（`|` 与 `>-` 各一）、roster 含 bespoke preset 并断言下拉数量、
  任何 optional/三值字段的 stub 必含"缺失"一支、含空白/隐形字符的清单条目。

---

### 2.7.1 C3 普查的**部分**结果（该 lane 未交回报告，仅有原始普查）

`.tmp-coord/attack/C3-claims/census3-run1.txt`：对 27 条 skill 行为断言在
`packages/*/[test|testdata]/**/*.ts`（567 个文件）里普查覆盖面。

**方法论缺陷必须先声明（否则数字会被误用）**：普查用 grep 匹配文件/行数。
**"匹配到"不等于"有断言覆盖"**（U06 报 114 个文件含 metadata 空白相关文本，显然过松），
因此**非零一侧不可引用**；只有**零**是可用信号（该模式在整个测试语料里一次都没出现）。

- **[V] 27 条断言中 15 条零匹配**（候选未覆盖面）：envelope operation token 非法、
  capabilities 缺四必填之一、metadata **key** 语法、metadata **value** 长度上限、`displayName` 128 上限、
  `displayName` 内部空白行为、`contextPolicy` 语法/空白、requirement NAME slug 违规、
  配额非整数（2.5）、policyState 引用 `teamHardEnvelope`/`permissionMutationEnvelope`、
  `memberId` 深埋在 permissions/metadata 内、per-template/policyState 的 `description` 多行、
  saved-source traversal 围栏、`description` 整体缺失、配额按 members/team 分块生效。
- **[V] 唯一可用的非零数据点**：`multi-line persona` = **6 行 / 1 个文件**，
  且那 1 个文件就是今天修复时新加的 `t2-blueprint-validation.test.ts`
  → **41 天里对多行 persona 的测试覆盖恰好是 0**，这是 §2.7 结论的硬计数支撑。
- 后续（进 §5）：用**断言级**检测重跑普查（找 `expect(...).rejects`/`toThrow` + 错误码 + `path` 断言，
  而不是自由文本 grep），并把"零匹配"的 15 条逐条人工判定是"确实未覆盖"还是"模式写错"。

## 2.8 运行期与 UI（操作员 2026-10-12 现场报告）

### CTL-1 裁决落地后，投递给 Leader 的控制请求消息不被清除 → Leader 被反复唤醒

**现象（操作员现场）**：`team_request_control` 会生成一条投递给 Leader 的消息；Leader 用
`team_list_pending_control` 看到并通过 `team_resolve_control` 裁决之后，这些消息**不会自动清除**，
导致 Leader 被反复唤醒。需要设计必要的自动清除机制。

**我已核到的部分 [V]**：

- 工具→服务映射见 `packages/tools/src/tools.ts:21`/`:24`：`team_request_control` → control service
  `requestControl`；`team_resolve_control` → `resolveControl`（注释标注 **unguarded**）。
- **裁决路径里没有任何消息处置动作**：在 `packages/runtime/control/service.ts` 中 grep
  `resolve`+`control` 行里的 `message|archive|withdraw|clear|dismiss|retire` → **0 命中**。
- control 层与 `packages/runtime/src/plugin/*.ts` 里**不存在 withdraw / retire / dismiss 概念**
  （唯一 `RETIRED` 命中是 `RETIRED_BLUEPRINT_DOCUMENT_VERSIONS`，与本项无关）。

**尚未核实（不得当事实）**：反复唤醒的**投递侧机制**——是未 ack 的消息被重投、activity 流每次进入都重放、
还是唤醒条件只看"存在该实例的消息"而与其是否已被控制裁决满足无关。**必须先定位唤醒消费者**，
否则"自动清除"会加在错误的切面上。

**设计约束（供裁决）**：

1. 清除不得抹历史——本仓纪律是 append-only，只能是**新增一条"已满足/已作废"事件**，使该消息退出唤醒集合，
   而不是删除记录（与 W6 的 corrupt-record 处理同一取向）。
2. 必须幂等：同一控制请求被重复裁决（`resolveControl` 无 guard）不得产生多条终止事件。
3. 需要明确**谁有权终结**：裁决者、超时、还是请求方撤回；以及 Leader 重启/会话恢复后唤醒集合如何重建。
4. 与 §1 的工具管理面同族的教训：**"存在待办"与"存在未读消息"必须是两个不同状态**，
   否则人工裁决的产出被消息噪音淹没（这正是本项的用户可见后果）。

分级：**缺陷（高实用危害）**——反复唤醒既烧成本，又会把真正需要人工裁决的条目埋掉。

### UI-1 Team tab 无折叠：一次人工裁决要翻页约半分钟

截图证据：每条 ledger 行把 raw JSON payload 整段摊在正文里，例如
`{"at":"2026-10-11T20:06:10.229Z","caller":{"humanId":"team-root","kind":"human"},"payloadFingerprint":"sha256:9ba55f…"}`
与 `{"instanceId":"inst-0mqijide6ggz","label":"M1-Theory","rootSessionId":"session-4392dd47-…","templateId":"theory-ar…"}`。
无分组、无折叠、无"待我裁决"置顶、无详情抽屉 → 定位一个待裁决项需要长时间翻页。

待办（免裁决，属可用性修复）：待裁决项置顶并单独成区；raw payload 默认折叠为一行摘要（实例 label + 动作 + 时间），
完整 JSON 进只读详情面板；按成员/时间分组；同一事件的重复行合并。
参照物：客户端已有 `team-ui-snapshot.ts` 的 `corrupt-record` 之类的行分类机制，折叠应在快照层做，不要在组件里各写一套。

### UI-2 台账排版破损：行内容互不对齐，payload 被挤出容器裁断

**这是操作员 2026-10-12 指认的"神秘问题"。** 截图证据（1315×599，逐条对得上）：

1. **两套排版混用**：事件头部块（spinner / `04:08:37` / `成员创建` / `M1-Theory`）**居中**竖向堆叠；
   payload 行**左对齐**且起点贴着左边界 → 相邻行的水平原点不一致，**不构成任何列**。
2. **payload 单行不换行并溢出容器被裁断**：`…e8d65cfdd6`、`…templateId":"theory-ar`、
   `…"session-te`、`…"templateId":"valida` 全部断在半截 token 上——
   无换行、无省略号、无横向滚动、无展开入口，**信息不可读也不可获取**。
3. **payload 与所属事件没有共同行框**，中间夹大空白 → 归属关系视觉不明（看起来像独立的一行）。
4. **一个事件被竖排成 4 层**（图标 / 时间 / 类型 / 标签）再加 payload 行 → 单事件占 100+ px，
   这是 UI-1"翻半分钟"的主要成因之一（UI-1 与 UI-2 同源，应一起改）。

修复方向（免裁决，属可用性修复，与 UI-1 同批）：改成真正的**行栅格**（同一行内固定列：状态图标 / 时间 / 类型 /
主体 / 摘要），payload **默认一行摘要 + 可展开只读详情**，禁止未受限的单行长文本直接进布局
（`min-width: 0` + `overflow-wrap`/`text-overflow`，或截断后进详情面板），同一事件的所有字段共享一个行框。
取证与验证须在活实例上做（`:3080`/`:3082` 由操作员自管，不得触碰；另起走 `3180` 族），
并在窄宽度与移动端预设下复查（`browser_assist` 的 device 预设）。

**次要观察（未验证，不得当事实）**：`成员创建` / `活动开始` 等历史事件行也显示进行态 spinner，
且多行时间戳同为 `04:08:37`。可能取向：活动态未收口、快照把历史行标成 in-flight、渲染层恒定显示进行态、
或同一批事件 `at` 本就相同。**取证前不改。**

### UI-3 点击「刷新团队视图」时按钮**横向跳动**（pending 态引发布局位移）

操作员 2026-10-12 现场：点击后按钮**跳到右边去**，而不是原地变灰/原地显示进行态。
截图对得上：pending 时同一行左侧插入"正在更新…"文本，按钮被推到最右 →
**pending 指示是插入进同一 flex 行的兄弟节点，而不是原地替换/禁用**，因此宽度变化推动按钮位置。

修复取向（免裁决）：pending 态**原地**处理——按钮保持同一盒模型位置，内部换成 spinner + 文案，
或用固定宽度占位（`min-width` / grid 固定列 / `visibility` 预留），并置 `disabled` 防重复触发。
禁止用"插入/移除节点"表达 loading（同类位移在 UI-2 的行栅格里一并防）。

### UI-4 「刷新团队视图」有时**极慢**（长尾，未定位）

操作员现场："有时候需要等非常非常久"。截图佐证：`正在更新…` 与顶栏 `1 个后台任务运行中` 同时存在，
团队视图长时间停在 pending 而成员组已渲染 → 提示刷新路径存在**未被取消/未被合并的慢请求**。

候选成因（**全部未验证，取证前不得写进修复**）：
(a) 快照路径每次请求重扫目录（§2.5 CST-1：2 万键 metadata 单文件解析 11.0 s；catalog 每请求 readdir+read）；
(b) 台账/事件读取无 cap（§3.2 D-10 `intervention.list` 只有 `teamSessionId` 无 cap 属同族问题）；
(c) 排队消息与 backlog 面板的读放大；(d) 慢请求无超时/无并发合并，重复点击串行排队。
取证方式：活实例上开 `browser_inspect` 的 network 抓取，记录该按钮触发的请求集合、耗时分布与重复次数；
再决定是加 cap / 加超时 / 加去重合并。**不要用猜的改。**

### UI-5 团队视图内部状态互相矛盾 + 悬浮面板遮挡（待取证）

同屏可见：成员组里 `Member 1…4` 均为 `0 活跃 / 尚无实例`，
而台账截图（同日早前）显示 `M1-Theory`、`M2-Validation` **实例已创建**（带 `instanceId`/`rootSessionId`）；
`时间线` 为 `暂无委派记录`，而下方 `任务` 显示 `2 已完成 · 1 进行中 · 2 待处理`；
`Physics Integration Leader` 行显示 `运行中 暂无动作`。
另：**底部悬浮的「任务」面板压在成员组之上**，把 `Member 5` 那一行整个遮住（无滚动让位、无避让）。

这些是否同一根因未定（可能是快照分层读取时序、可能是不同读面用了不同源）。**记录为待取证不一致面**，
取证顺序：先确认每个面板的数据源与刷新时刻，再判断是"读面不同步"还是"读面取错"。遮挡问题是纯布局缺陷，可直接修。

---

## 2.9 创建时序与身份一致性（A3；全部 [L]，协调者未复现）

探针 `.tmp-coord/attack/A3-ordering/`（6 个脚本直接 import 生产 `.ts`，`scripts/run-tests-hooks.mjs`，零构建）。
各脚本 17/17、15/15、**23/25（2 条 FAIL 即缺陷本身）**、12/12、14/14、16/16。

| # | 发现 | 机制与实测 | 分级 |
| --- | --- | --- | --- |
| ID-1 | **同 `blueprintId@revision` 内容可被原地改写，身份表面逐字节看不出** | probe → 改写（id/rev 未动、换 persona）→ `team.create` **成功零错误**，`bindFresh` 收到改写后的 hash（`5f0649… ≠ 8249b8…`），随后 `freezeSnapshot` **把改写内容永久冻结**。无缓存可失效（每请求 readdir+readFileSync）；saved 身份 `BlueprintIdentity.contentHash` 为 `undefined`；`listIdentities`/`blueprintIds`/`listRevisions`/`blueprintSnapshotKey` 改写前后相同 | medium |
| ID-2 | **创建协议结构上无法携带内容钉** | v1 `team.create`、v2 `team.create`、`intent.probe` 三套闭合字段集**都不含哈希**（加 `blueprintContentHash` 一律 `malformed-params`）；probe 回复也无哈希（只有 `environmentFingerprint`，且只覆盖 requirements+facts）；`catalog.get` 是唯一带 contentHash 的，但客户端 `parseBlueprintDetail` **直接丢弃**（`grep -rn contentHash packages/client/src/` 为空）→ 人探测/勾选 ack 的字节与实际绑定的字节之间**无任何绑定**。围栏只保请求内 resolve→freeze。**缓解面**：`enforceCreationPreflight`（`host.ts:2743` 生产接线）在 create 内重新 resolve 并重评 **requirements**；**未重评的是 persona / 成员模板 / capabilities 三车道 / envelopes / quotas / policyStates** | medium |
| ID-3 | **爆炸半径**：目录里任意一对同身份文件（`TEAM_BLUEPRINT_REVISION_DUPLICATE`）或任意一个不可读文件（`TEAM_BLUEPRINT_FILE_UNREADABLE`）→ `catalog.list`、**已冻结/已绑定身份的 `resolve` 与 `resolveSnapshot`**、`intent.probe`、`team.create` **全部失败** | 根因 `resolveExact` 第一行 `scanIdentities()`，重复抛、I/O 错误不吞，注册表分支走不到。方向 fail-closed、无静默越权；已运行团队靠 `boundBlueprintFor` 进程内缓存继续服务 | medium |
| ID-4 | **修订号双身份空间**（wire `Number()` vs 文件 `String()`） | `"1"`/`"01"`/`"10"` 三文件 list 成 `[1,1,10]`（两个不同文件同一显示身份）；`"10"`+`"007"` list 成 `[10,7]`，而 host `resolveLatest` 选 `"007"`，按显示号 `get(id,7)` → `MALFORMED_DTO`（**目录自己给的号解析不出来**）；**一个 `revision: v2` 文件让整台主机 `catalog.list` 抛 `TEAM_REMOTE_CATALOG_REVISION_MALFORMED`**，健康蓝图一起消失——与 `docs/blueprint-authoring.md:36-40` 自述容忍律（"it must not take down the catalog"）**直接相悖** | medium |
| ID-5 | `*.draft.yaml` 改名即**静默撤稿**（resolve 转 MALFORMED_DTO，无告警）；保存副本被 bootstrap anchor / 冻结行遮蔽时静默（`sourceFile` undefined、目录不报冲突） | | low |
| ID-6 | wire `parseRemoteBlueprintId` 比 contracts 宽：接受 `@`（contracts 保留符）与 129–255 字符（上限 128）；当前由 domain 兜住，属**两解析器规则漂移风险** | | low |
| ID-7 | **身份字段被 YAML 类型强制 → 身份 `rejected` → 文件从目录静默消失、无诊断面**：`revision: 1`、`1e3`、`.inf`、`0x10`、`~`、`blueprintId: true` 全部静默不可见 | 而 wire 修订号是整数，**`revision: 1` 恰是最自然的写法**。与 §2.6"skill 称 revision 为 positive integer"同根，本条补的是机制与静默消失后果 | low（作者面危害高） |
| ID-8 | `blueprintId` 内零宽 U+200B 被接受 → 视觉同名、机器不同名两身份并存 | **与 WH-5 重复**，本轮是 inspect 层复现 | 并入 WH-5 |

**负结果（防御成立）**：F9 创建链**确实重读文件**（probe 与 create 各自独立 `resolveBlueprint`，无一层复用探测结果）；
F10 冻结后重写文件不影响已绑定团队（registry 行胜出）、同修订不同哈希再冻结被 `TEAM_BLUEPRINT_REVISION_FROZEN` 拒、
`resolveSnapshot(旧 ref)` fail-closed，且已在 `docs/blueprint-authoring.md`「What "frozen" means」向操作员披露；
F11 文件名与 `blueprintId` 无耦合（Architecture §5.2）、一个文件不可能裂成两身份、两文件同身份会**大声报错并点名两个文件**
（半径见 ID-3）、大小写不归一不塌缩、前后空白两层都拒、`@` 在 domain 层双向拒绝（`id@rev` 显示形无法伪造）。

**需活宿主**（A3 明确不作为事实断言）：`enforceCreationPreflight` 在真实宿主是否把"探测后改写且新增 FATAL/pending 需求"挡成
`COMPATIBILITY_BLOCKED`；只改非需求内容时真实世界是否真的无任何提示；坏文件出现后已启动团队的服务与重启后的确切 typed 码；
`blueprintDir` 出厂默认开关/指向/权限（决定 ID-1/ID-3 的现实攻击者能力，配置源 `host.ts:617`，相对路径按 `process.cwd()`）；
真实 `storageDomain` 的 freeze 重复语义；UI 链"刷新目录→不重新探测→ack 保留→创建绑新字节"的可观察表现；
非规范修订号在真实面板上的呈现（重复下拉项/React 重复 key）。

---

# 3. 历史欠债盘点（H1 / H2 均已交回并并入）

盘点标准：文档/编排/代码中**明确记载要实施但无实施证据**者，逐条带原文引用与验证方式。
两路盘点全文已入库：`dev/agent-workflow/evidence/post-alpha4-debt-sweep/H1.md`（文档层）、
`H2.md`（编排与代码层）。

## 3.1 已核实为"明确延期"的既有项（协调者先行核实）

| # | 项 | 出处与原文要点 | 状态 |
| --- | --- | --- | --- |
| D-1 | `grep`/`glob` 的 permission-aware search | alpha2 计划 §11：不能标 SAFE（返回内容/泄露存在性）、不应仓促建模成 `resource = search root`（输出 authority 跨大量文件）；§11.2 有候选设计与 8 条未解问题；"因此 A2C-6 **明确延期**" | 延期至今；Alpha.3 GO 时被列为"非阻塞"前置（`SESSION_ROUTER_LOG.md:2857`）后失去 owner；**Alpha.4 计划集对它 0 命中** |
| D-2 | `web_fetch`/`web_search` 归属设计 | 仅出现在 KNOWN_SENSITIVE 清单，**无任何延期决策** | 缺口，见 TM-6 |
| D-3 | 覆盖门对新工具的持续分类义务 | §7.8："unknown by default → blocked under permissions" | 义务存在，**无执行机制**（谁、何时分类；无 owner） |

## 3.2 文档层盘点结果（H1，`master @ 424f971a`）

盘点全表 33 行（D-01…D-33）与矛盾 9 行（X-1…X-9）逐条原文见
`dev/agent-workflow/evidence/post-alpha4-debt-sweep/H1.md`（59 KB，已随本册入库）。
**本节只保留结论行**；H1 全文须随本登记册一并归档到 `dev/agent-workflow/evidence/post-alpha4-debt-sweep/`，
原文已入库，不再依赖 scratch。

**命名消歧（重要）**：下表 **`SG-C2`** 是安全项"subagent 后代治理 / own-layer surface 收缩"，
与 §2 的攻击向量编号 **`C2`（skill 指令字面执行测试）毫无关系**。本登记册里凡 `A1…C3` 单写者，一律指攻击向量。

类别缩写：`延期`=显式延期（有理由）｜`排期`=已排期无完成证据｜`口头`=口头承诺无排期｜`纠正`=复核后确认已实现。

| # | 项 | 出处（逐字要点） | 类别 | 影响面 | owner / 触发判据 |
| --- | --- | --- | --- | --- | --- |
| D-01 | `grep`/`glob` permission-aware search（A2C-6） | alpha2 计划 `:1352/:1397`（§11 延期 + 8 条未解问题）；登记点另有 `:45/:48/:800/:1900-1906/:1946`；代码侧确认未实现：`permission-coverage.ts:138` "stay here until A2C-6 lands"、`:146-150` 仍在 KNOWN_SENSITIVE；`grep -rln "permission-aware" packages/**` = 0 | 延期→**已蒸发** | 用户可见（TM-4 的一半） | 协调者 / Alpha.5 立项前需设计评审 |
| D-02 | persona 需求填 preset id 的结构性 FATAL | `docs/issues/team-persona-requirement-preset-id-bug-report.md:8` `**状态**：诊断完成，待修复`；代码原样在树 `team-intent-model.ts:476` `?? row.id`、`:480` `available: observedKind === 'standard'`；`49727fcb docs(record): … holds real unmerged work -- preserve, do not merge`；README `PR #22 CLOSED as superseded`；最新 `4193503f`(#246) **只改 skill 19 行** | 排期 | 用户可见（阻塞 bespoke preset） | 协调者 / 需携带"实测 persona kind"的 seam（`CORE_SEAM_BLOCKER` 类） |
| D-03 | §7.7 与 Alpha.3 九步人工验收未跑 | `graph.yaml:920 s7_7_closure` 尾部 `BLOCKED-ON-HUMAN … 机器腿 8/8 不等价于该通过`，**同条自我推翻环境理由**：`the recorded environment blocker is no longer true … chromium-browser is present … executable today`；`evidence/alpha4-final/ALPHA3-HUMAN-ACCEPTANCE.md:3` `Status: BLOCKED / NOT_RUN` | 排期 | 用户可见（阶段关闭前置） | **操作员** / 立即可执行（阻塞理由已被同条记录推翻） |
| D-04 | INV-7 硬门与实测相反 | `docs/plans/finished/pr31_supplemental_fix_guide.md:259-277`（`→ 不 reload`、禁止拿 reload 当 acceptance path）↔ `SESSION_ROUTER_LOG.md:6140` `**只找到 INV-7 本身**——要么改判记录在本仓库之外，要么这道 gate 从未达成` | 矛盾 | 仅内部（但误导后续轮次） | 协调者 / 等操作员给改判记录，否则按"未达成"勘误 |
| SG-C2 | subagent 后代治理 + own-layer surface 收缩 | c1 计划 `:7/:671-676`、PR20 `:762`、pre-alpha3 设计 `:765`、rc2 `:36`；src 无实现，`own-layer` grep = 0；防线只剩 strict 模式 FATAL | 延期 | 用户可见（治理面缺口） | 协调者 / 与 §1 工具管理面同批裁决 |
| D-05 | **P10 加固阶段不存在**，但一堆债挂在其上 | P8-S `:854` `S2 = explicitly defer to P10`、`:9` 冻结拓扑；`grep -cE "^  P10" graph.yaml` = **0**；`STATUS.md:262` 仍挂 F-9/F-7/UI_BACKEND_GAP/360s 埋点 | 排期（悬空） | 仅内部 | 协调者 / 必须先给 P10 建节点或改挂真实阶段 |
| D-06 | A2C-8 只读治理面已交付、**编辑面为零** | `override.getPermissionAdministration` 在；`grep mutatePermission packages/client/src` = 0 | 排期 | 用户可见 | 协调者 / post-Alpha.4 |
| D-07 | Human Admin 单向门无生产者 | `permission-plane.ts:994` | 排期 | 用户可见 | 协调者 |
| D-08 | `truncated` 之上裁决入口复活 | `SESSION_ROUTER_LOG.md:6131` 声称已进 backlog，但登记面里 `truncat` 仅 1 次且指另一件事 | 口头 | 用户可见 | 协调者 |
| D-09 | 治理码裸渲染 | `TeamCreationPanel.tsx:227` | 口头 | 用户可见 | 协调者 / 与 UI-1/UI-2 同批 |
| D-10 | escalate 终态不呈现；`intervention.list` 只有 `teamSessionId` 无 cap；检查不可用提示无 GUI 触发；Leader 无 dispose 工具；宿主版本地板/死 fallback；compatibility 原子替换原语；无 case 损坏行；wake budget；MCP health loop/telemetry；后台 shell spill；通用 inbox/DAG/streaming result；人格层 fail-closed 无测试腿 | H1 主表（逐条带出处） | 口头/延期混合 | 混合 | 待逐条指派 |
| D-11 | `docs/STATUS.md` **同文档自相矛盾**，需勘误 | `:15` 仍写 `pendingControlCount 仍把 abandoned 请求计为 pending`，而该职责已在 A4-PR3 落地（`control-request-abandoned` 已进 `team-ledger-model.ts:127 INTERNAL_FACT_TYPES`）；`:7` 声明"CURRENT 指针不在本文维护"而 `:8-11` 继续发 CURRENT 指针块 | 矛盾 | 仅内部 | 协调者 / 随本 PR 勘误 |

**H1 计数**：33 条（用户可见 16 / 仅内部 17）；类别 延期 12 / 排期 5 / 口头 10 / 复核纠正 6；矛盾 9。

### 3.2.1 直接划账（复核确认**已实现**，post-Alpha.4 不得重复登记）

D-27 TEAM D1–D4（`d1-member-base-tools.test.ts` 在、`team_collect` 在面、D4-A 由 `team-mount-core.ts:868`
"one 3s tick" 轮询引擎替代）；D-28 session-resume 冷恢复（restart-recovery 轮 16/16）；
D-29 `evidence/a4-pr3/interface-freeze.md` 在盘（50826 B）；D-30 `pendingControlCount` 弃单感知
（`projection-source.ts:851 FIXED IN A4-PR3`）；D-31 Team-start 治理门（`root.ts:3600 requireBoundBlueprintStartable`）；
D-32 cold-member ownership（`team.getReadState` + locales P1-A 七键）。

### 3.2.2 采纳的登记规则（回应 H1 格式建议，与 §3.4 P-1 同族）

H1 报告的最强模式是**登记链断裂**：计划文档写"记账"，但唯一活的登记面 `graph.yaml post_alpha4_backlog`
（47 条，起 `:923`）里没有该条 → 就是 P-1 描述的"DEFERRED 无重拾机制"的实例。因此本登记册自本行起
**强制每条带 `owner` + `触发判据`**（见上表末列）；无 owner 的条目不得写"已记账"，只能写"口头承诺无排期"。

**H1 的诚实边界（须保留）**：未运行任何测试套件；未逐文件清点 0.1.2-era dead fallback；
未逐行读 `packages/storage/repositories/base.ts` 写链；未逐点验证 client agent/tool 面自动失效触发；
D-33 覆盖状态以登记自述为据。以上 5 项在 H1 表内均标"未验证"，无推断。

## 3.3 编排与代码层盘点结果（H2，`master @ 424f971a`）

全表 60 条逐条原文见 `dev/agent-workflow/evidence/post-alpha4-debt-sweep/H2.md`（48.9 KB / 319 行，已随本册入库）。

**计数**：显式延期（有理由/有裁定）**8** ｜ 已排期无完成证据 **26** ｜ 代码内自认未实现 **6** ｜
容忍中的已知红/跳过 **4** ｜ 未跑验收项（表内 3 行，展开为 **9 组事实**）｜ **已实现（复核纠正）13 条**
——最后这 13 条是**登记前必须先删掉的过期文本**，不是欠债。

**三条方法论级事实（比任何单条债都重要）**：

1. **全仓 `TODO|FIXME|XXX|HACK:` = 0 命中**。我们的债务只存在于**散文与注释措辞**里，
   因此任何"扫 TODO 看欠多少债"的做法都会得出**"零债"的错误结论**。
2. `post_alpha4_backlog` 实际 **47 条**（`graph.yaml:924-:971` 逐行数得），不是先前口头估计的 22/25。
3. **编排记录滞后**：graph `round: 58`、日志最后条目 round 58（2026-10-10），
   而其后有 **3 个已合入 PR**（#245/#246/#247，2026-10-12）**没有日志条目** →
   违反"只追加执行日志"纪律，**由协调者补记**（见 §5 末项）。

### 3.3.1 H2 实测到的具体债（非引用登记文本，均含验证方式）

| # | 项 | 实测证据 | owner / 触发判据 |
| --- | --- | --- | --- |
| E-1 | **9 条容差红在 HEAD 仍全红** | 单跑 4 个文件 → `Tests 9 failed \| 35 passed`，身份与 `nine-root-post-d3-4-split.ids.txt` 一致；抓到具体断言：`p6t3-mediation` 腿 1 期望 `session-child-p6t3-leader` 实得 `session-root-p6t1`（前提移动）；`t2-blueprint-hash` 投影多出 `capabilities: null` | 协调者 / Alpha.4 收口前逐条定性（真缺陷 vs 前提移动） |
| E-2 | **blueprint-version 围栏脏** | 只读跑 `scripts/verify-blueprint-version-clean.mjs --json` → `RESULT dirty(6 files, 15 sites)`，与 round 43/48 记录一致 | 协调者 |
| E-3 | **裸 `.toThrow()` 记录失真且债在增长** | 记录 17 files / 49 sites（`graph:942`），实测 **34 files / 85 sites** → 登记面低估一倍以上 | 协调者 / 先修登记再立项 |
| E-4 | **分支保护其实已存在**，但 census-runtime 不是必需检查 | 只读 `gh api`：`required_status_checks.contexts=["pr-gate"]`、`enforce_admins:true`、`required_approving_review_count:0` ⇒ 日志 `:5946`/`graph:883` 的 "404 Branch not protected" **已过期**；**而** `pr-gate.yml:191` 仍带 `--allow-refused census`，且 census-runtime 多次 run success ⇒ "第二个连续绿就提为必需检查"的前提**早已达成却从未推进** | 协调者 / 纯配置零代码，可立即做 |
| E-5 | `team_dispose_member` = **0 命中**（Leader 只能 archive）；`putIfAbsent`/`expectAbsent` = 0；`leaderEnvelopeCoverage` 定义 = 0（已删）；`g5-member-e2e.mjs:640 apiPage` 仅定义零调用；客户端 `authorityScope` = 0 命中 | 均为 grep 计数 | 逐条指派 |
| E-6 | **backlog 第 1 条客户端反向在 HEAD 仍复现** | H2 跑记录自带的证据仪器 `evidence/a4-pr7/corrupt-leg-guard/evidence-runner.config.mts` → `Tests 2 passed`，而该仪器断言的是**当前行为** ⇒ PR #241 只对齐了服务端 | 协调者 / 现成仪器，成本是导出一个已有谓词 |

### 3.3.2 人工验收未跑项（9 组事实；owner 全部是**人**）

`ALPHA3-HUMAN-ACCEPTANCE.md:3` 仍 `BLOCKED / NOT_RUN`、**9 步全 `- [ ]`、0 人签署**；
计划 §7.7 四项复选框未勾（`:881-884`，同区间还有 31 个未勾项）；ADDENDUM D 签署表 6 行全空；
GUI 腿 3/4/5 与 step 7 只有 `SIMULATED`；警告条的人类对应检查 3 条一条没跑，
且 `graph:961` 自述**没有 axe / aria-live 检查**（日志里 "axe" **0 次命中**）；
`RUN-20261010` 只实测完第 2 项且自陈"委派腿未覆盖，属世界限制"；
`RUN-20261009-3082.md:39` "**未验证**：屏幕上的警告条呈现仍未经人确认"；
§7.6 侧 `7-6-ACCEPTANCE-RECEIPTS-PARTIAL.md:33-36`（Remote 1–8 + real-host kits）记为 NOT_RUN/BLOCKED 而非通过；
另**一处与归档 hard gate 直接冲突等人类裁决**：实测重启后恢复会话**必须刷新页面**，
而 `docs/plans/finished/pr31_supplemental_fix_guide.md:259` 的 INV-7 写死"不 reload"，全仓找不到改判记录
（= §3.2 D-04，H2 独立复现）。

### 3.3.3 未审计面（含对我假设的证伪）

- **我给的前提被证伪**：`packages/legacy` 的 projection 副本存在未审 pending count —— **不成立**。
  该包只有 `session-reader/*` 与 `teammates-adapter*`，对 `pending|pendingControlCount|pendingControlByInstance|control`
  全域 **0 命中**。全仓 pending 读者只有两个生产者：服务端 `projection-source.ts:896-930`（A4-W6 已对齐严格规则）
  与客户端 `client/src/model/ledger-adapter.ts:827-839`。
- **真正一条 pin 都没有的是客户端那半**（H2 只读码、未跑反例，标未验证）：严格读者共 **5 类**拒收条件，
  只有 `authorityScope` 一种被仪器覆盖；`kind` 缺失 / `correlation` 缺失 / `requester` 不可解析 /
  A2-9 缺 `legOrdinal` 这 4 类配上合法 instance subject，按 fold 代码都会被成员徽标计入
  （`team-members-model.ts:95` → `TeamMembers.tsx:228`，**用户可见**），
  且 corrupt 集合**结构上进不了该 fold**（`team-ui-snapshot.ts:251-252` 自述 "the adapter does not see the corruption read"；
  `a4w6` spec fixture 是 `members: []`）；再叠加披露 13 的 `truncated` 超限行，
  同一行可**既不标"不可裁决"又被徽标计入**。→ 与本册 **CTL-1 / UI-5** 同族：徽标与面板数不一致的候选根因。
- 其他：census 的 `adjudicated(16 files,24 sites)` / `advisory(5,7)` 两层**不进任何容差身份表**（人读过就算数）；
  共享树读者只数了 held-by-7-6 家族；托管门墙钟从未测。

### 3.3.4 `CORE_SEAM_BLOCKER` 实况（全词逐条）

**活动只有 1 个 seam —— 条件化 CREATE，5 个站点**：`storage/repositories/compatibility.ts:111`、
`runtime/compatibility/probe.ts:73`、`runtime/test/a4-compat-coldstart-interleave.test.ts:74 / :570 / :958`
（leg C4 "pinned but cannot close"）+ `graph:970`（post-stable 跨进程 create-if-absent）+ `graph:951`
（上游提案，PATCH BUDGET 0 禁止应用）。插件侧绕法：热迁移走 `replaceIfGeneration` generation CAS、
activation step 6 串行化（PR #194）、残余用具名 leg pin 住不闭合；**其余调用方仍无保护**（`graph:927` 自述）。
命名但**不活动** 1 个：`fork-reconciliation/types.ts:26` 的 `FORK_LINEAGE_VISIBILITY`（同句虚拟语气，实际用公开 lineage）。
其余 10 处代码命中与 15+ 处日志命中均为**否定式**或 2026-09-07 历史 T6 记录；
`log:2128` 明确"人工验收跑不动"是 `TEST_INFRA_BLOCKER` 而非 CSB。

### 3.3.5 H2 建议的 post-Alpha.4 优先序（原样收录）

1. 把 §7.7 九步人腿**真跑一遍**（owner=人）——唯一"前置全齐、只差人"的条目。
2. 修 backlog 第 1 条客户端反向，并把仪器从 1 种形状扩到 **5 类拒收条件 + corrupt-marked 徽标**。
3. 把 census-runtime 提为 required check 并摘掉 `pr-gate.yml` 的 `--allow-refused census`（零代码）。
4. 闭合 `truncated` 上限的"标记与投影同源"（披露 13）——与第 2 条同根，一次修掉两条用户可见错判。
5. **先清 13 条记录失真再登记欠债**（含 §7.3 flip 文本、分支保护 404 文本、`leaderEnvelopeCoverage`、
   `LEDGER-STALE`、p6t1 flake、Phase 2 工厂耦合、F1 文案、日志落后 3 个 PR）——
   `ci-pr-gate.mjs` 把 baseline 文档当**机器接口**解析，配过期指针会让下一轮把已实现的再派一遍。

**H2 自报缺口（登记须知）**：未跑全量套件、census、smoke、GUI/浏览器、托管墙钟、突变实验、
`tests/homes/**` 频率普查（后者被其边界禁止，而 `graph:968` 恰好要求遍历它）；相关行均标未验证。

## 3.4 流程性欠债

| # | 项 | 说明 |
| --- | --- | --- |
| P-1 | **DEFERRED 无重拾机制** | 我们的编排只保证"已排期的事做完"，不保证"DEFERRED 的事被重新拾起"。D-1 即此机制的产物（被"非阻塞"三个字放行后蒸发）。建议 ROUTER_RULES 增条：**DEFERRED 项必须在下一期计划开头被显式处置**（继续延期需写明"这次仍不做的理由 + 用户可见后果"，否则不得进入 GO） |
| P-2 | lane 报告不得直接升格为事实 | 本轮三条 lane 各有一处需协调者修正：C2 把**未跟踪**的 `packages/{remote,contracts,tools}/dist` 陈旧当成产品缺陷（tracked 只有 `packages/runtime/dist`，1505 文件）；C1 把 catalog 的**有意** revision 排序规则说成"漏校验导致排序错乱"；A1 的 trim 后果需拆成 integrity 面（成立）与扩权面（无活体复现）。纪律照旧：**先复现再引用** |

---

# 4. 需要操作员裁决的语义问题（汇总，未经裁决不改代码）

| # | 裁决点 | 协调者建议 |
| --- | --- | --- |
| C-1 | 授权路径 Unicode trim：改"改变非 ASCII 空白即拒" vs "只 trim ASCII 空白" | 前者（把隐形字符变成显式报错），但会拒少量既有蓝图 |
| C-2 | 成员 exec：overlay 是否禁写 exec-class `allow` | 禁（不问 P1 直接收口） |
| C-3 | 无命中 fallback 是否改取各层最严 | 改 |
| C-4 | 文档级硬预算：条目数 / 源文件字节上限 | 设（CST-1 的 11 秒解析会被每请求放大） |
| C-5 | 覆盖门 §7.1 不变量是否重新裁决（TM-10） | **不重裁**；只修可发现性 + 网络能力走 MCP + 为 TM-6/TM-7 做归属决策 |
| C-6 | P-1 的 ROUTER_RULES 增条 | 加 |
| C-7 | CTL-1 的终结语义：谁有权终结（裁决者 / 超时 / 请求方撤回）、终止事件形态、重启后唤醒集合如何重建 | 裁决落地即投"已满足"事件并退出唤醒集；幂等；历史保留；超时与撤回另议 |
| C-8 | UI-1 折叠的默认形态（默认折叠 raw payload 还是默认折叠整组） | 默认折叠 raw payload 为一行摘要；待裁决项不折叠且置顶 |

# 5. 免裁决批次（一旦开工即从本表勾销）

1. PRS-1/PRS-2：递归与无法编码归 closed code；**inspector 与 parser 对同一文件必须给同一结论**。
2. 非 `YAMLError` 解码失败带原因，不再压成固定一句。
3. NRM-2：`takePositiveInt` 补 `Number.isSafeInteger` 并与 contracts 文案对齐。
4. WH-7：长度报错写明单位。
5. WH-1/WH-2：`metadata` 值与 capability items 接散文扫描器（会拒少量既有蓝图 → 需披露）。
6. TM-8/PM 相关：`builtinToolDeny` 条目 trim + 拒绝含空白/控制字符的条目。
7. §2.6 全表 skill 修订（两份 skill 同改）。
8. UI-1 Team tab 折叠与待裁决置顶（在 `team-ui-snapshot.ts` 快照层做行分类，不在组件里重复实现）。
9. UI-2 诊断任务：在 `3180` 族另起实例取证，先确定 spinner 恒亮的层次（数据 / 快照 / 渲染），**取证前不改**。
10. §2.7.1：以断言级检测重跑覆盖面普查，并把 15 条"零匹配"逐条人工判定（真未覆盖 / 模式写错）。
11. UI-3 刷新按钮原地 pending（固定盒位置 + `disabled`，禁止用节点插入表达 loading）；UI-5 悬浮「任务」面板遮挡成员行（纯布局缺陷）。
12. UI-4 与 UI-5 的**取证任务**：活实例（`3180` 族）用 network 抓取确定刷新路径的请求集合/耗时/重复次数，
    并确认团队视图各面板的数据源与刷新时刻；**取证前不改**。
13. **协调者欠记**：#245/#246/#247（2026-10-12 三个已合入 PR）**没有 `SESSION_ROUTER_LOG.md` 条目**，
    round 停在 58（2026-10-10）→ 补记只追加日志，属违反"只追加执行日志"纪律的自我修正，无条件要做。
14. **先清 13 条记录失真再登记新债**（H2 优先序第 5 条）：`ci-pr-gate.mjs` 把 baseline 文档当**机器接口**解析，
    配过期指针（分支保护 404 文本、`leaderEnvelopeCoverage`、`LEDGER-STALE` 等）会让下一轮把已实现的再派一遍。
    同时把 `post_alpha4_backlog` 的 47 条与本册对账，删除已实现项。
15. ~~归档本册的两份底稿~~ —— **已完成（2026-10-12）**：`H1.md`（59 KB）与 `H2.md`（48.9 KB）
    已入库 `dev/agent-workflow/evidence/post-alpha4-debt-sweep/`，scratch 副本清理不再造成原文丢失。
