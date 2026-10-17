# alpha5/schema-rev — VNEXT-SCHEMA 可逆半笔（reversible-half writer，不待裁）

Branch `alpha5-schema-rev` @ base `23002259`（origin/master tip，#301）。
裁决窗语境：**A-4 窗口时长未定只阻退役决策** —— 本轮全部落子满足「新字段缺省=
行为字节不变」；不可逆半笔（version-set 翻档、RETIRED 翻档、旧字段移除）**只备笔不执行**，
且本轮**未宣布任何旧版退役**。语义源 = `prod/VNEXT-SCHEMA-ADR.md`（M-1..M-7、三方表）+
`vnext-semantics/A234-VERIFICATION.md`（§1.1 机制族已在产）。

## M-x 处置表（条目 / 可逆性判据 / 做了什么）

| M-x | 判据（为何可逆/不可逆） | 本轮处置 |
| --- | --- | --- |
| M-1 v4 分支+翻档 | 语法本体=可逆（dormant，SUPPORTED 仍 `[3]`，任何在产路径不可达）；**翻档=不可逆**（新格式一旦写入即回不了头） | **可逆半笔落**：`blueprint/src/blueprint-v4.ts`（v4 授权语法=dormant 第四支，核心面委托冻结 v3 校验器本体，零 fork）；**翻档备笔**=`scripts/prepare-blueprint-v4-flip.mjs` 干跑（常量读源、真值表、零差普查），产出 `runs/v4-flip-PREP.md`，FLIP=NOT-APPLIED；门面对 `schemaVersion: 4` 文档在生产入口仍 `SCHEMA_VERSION_MISMATCH`（a5sr2 钉死） |
| M-2 映射表 | 纯函数+封闭表，缺省=不调用=零影响 ⇒ 可逆 | **落**：`vnext-field-mapping/src/v4-authoring-map.ts`（DEFAULT DENY/NO IMPLICIT DEFAULTS/NO COLLISIONS/PURE+FROZEN 四律机检，红→绿各一腿=a5sr3；ResourceRef 声明候选经冻结 `parseResourceRef` 复解析） |
| M-3 envelope 作用域扩展 | 半落会造 parse-accept/runtime-unmap 裂缝 ⇒ 必须与 coverage/kernel 镜像钉同笔原子落 | **显式缓落**（不静默跳过）：归 v4 发布轮 flip PR 原子包（见 `runs/v4-flip-PREP.md` 第 4 步） |
| M-4 migration report | 只读报告=可逆（E2 拒宽权语义先行钉死可逆） | **落**：`blueprint/src/migration-report.ts`（carried/rejected/requires-decision + `MIGRATION_PERMISSION_WIDENING`；绑定 envelope 逐字节不变腿；compat-default→wide=REJECT；静默删减=loud requires-decision） |
| M-5 NEG 接线 | 测试资产，零生产面 ⇒ 可逆 | **落**：33/33 案例全接 + 逐案 CANDIDATE→SHIPPED 映射行（含适配披露：N-C01/02/P02 的 lane-fragment 按 D-03 显式形补空列；N-E04/06 按实际 fragment 落点；候选词表 `proposed-not-shipped`→ shipped code 逐行注）=a5sr5；源文件 `_meta.status` 原文不动（vitest 接线在册于此） |
| M-6 runtime 边（post-flip） | 依赖翻档 ⇒ 不可逆半 | **备笔**：`v4-flip-PREP.md` 零差普查 = 版本常量消费者全集 + digit-carrier 检查 ⇒ 翻档是单点编辑，其它站点全部派生 |
| M-7 文档面 | 随 v4 发布同步才不失实 ⇒ 归发布轮 | **缓**（README 在册此判） |

ToolBinding 放置语义（R1，#308 GLUE-5 在产机制的**类型面**）：`tool-governance/src/placement.ts`
= `parsePlacedTeamDefinition` + `createPlacementComparator`（逐调用比对钩子：
`definition-not-placed` / `placement-identity-drift`，typed 不抛）+ `mintToolBindingFromPlacement`
（**委托冻结 `parseToolBinding`**，无平行系统；owner↔providerId 1:1 即 B2）。
生产 plane 重接线=行为改动=归 effect-queue 轮，本轮不碰。

## 可逆性自证（RED-first）

- 新字段/新面全部**缺省不可达**：SUPPORTED 集、v3 校验器、`schema.ts`/`validate.ts` 两文件**零改动**；
  barrel 只做加法导出。
- 回归 diff=空：domain lane 改前 `runs/domain-baseline-PRE.log`（680P/1F）vs 改后
  `runs/domain-lane-POST.log`（736P/1F）——唯一红恒等=已发布基线红
  `t2-blueprint-hash::projects absent optional singles as explicit null`；新增 56 腿全绿。
- root vitest 对已发布 9 恒等基线：改后首抓 `runs/root-vitest-POST.log` 的超额红全部归因——11 红=新 worktree 缺 host checkout（已按 TEST_METHODS 落位 @639ed01539 并克隆同代次构建面），2 红=台账记档笔（p4t6 Δ9 / a5p7 hygiene，均按机制补齐），3 红=未提交 surface 腿（提交后绿）；终抓 `runs/root-vitest-FINAL2.log` 恒等集=基线 9。
- `check:artifacts`：src 改动与 `packages/runtime/dist` 镜像 20 文件同笔提交，drift=0。
- RED 证据=`runs/a5sr-RED.log`（实现前 49/56 红；7 绿=行为不变钉腿）。

## v4 起草立场（draft stances，记录在案）

1. v4 = v3 超集 + 顶层可选 `toolBindings[]`；**absence = 未声明任何效果治理，永不是扩张**（A-1 可逆立场，未代裁）。
2. entry 封闭五键 `{owner,name,authorization,io,execution}`；`authorization∈{allow,ask,deny}`；
   io 三 lane 全必声明；RW variant `all:{mode,deny}` / `restricted:{mode,allow,ask,deny}`（显式空列；
   跨 variant 键=矛盾拒）；network variant `allow:{mode}` / `restricted:{+allow,ask,deny,default}` /
   `deny:{mode,default}`，`default∈{ask,deny}`（N-C03 `deny+default` 收）。
3. execution 面=三轴中的两轴 authoring 形（origin/boundary）；**author-side assurance 声明面归 A-6（未裁）**，
   故 entry 带 `assurance` 键=unknown-field 响拒（N-E05 按此映射，诚实注）。
4. 移除字段 `kind/adapterId/runnerId/shadowExecute`=BY NAME `removed-field` 拒（D-05）。
5. `..` 任意段拒（D-09），合法尾随空白逐字存活（NRM-1；N-P02 钉）；零归一化。
6. ResourceRef 三轴字段落点：schema 相发**声明候选**（lane/disposition/locator/inferredKind/rights），
   canonical 化归受信 provider（B5）；fs 候选经冻结 `parseResourceRef` 复解析钉（a5sr3）。
7. 版本双面纪律不改：非整数=`SCHEMA_VERSION_UNSUPPORTED`，well-formed≠4=`SCHEMA_VERSION_MISMATCH`；
   v4 入口自身钉死只收 4。

## 门禁记录

| 门 | 结果 |
| --- | --- |
| domain lane vitest 全量 | 736P/1F，唯一红=已发布 9 恒等之首（回归 diff=空） |
| lane 审计 `audit-a5-tool-governance-imports` | OK：13 lane files / 20 consumers（**零新增消费者**；blueprint 层不 import 该 lane，词汇同一性由测试钉） |
| `pnpm -r typecheck` | EXIT=0（`runs/typecheck-POST.log`） |
| 版本洁净 fence | OFFENDING/UNKNOWN 集合与基线**逐字节同**（diff=空）；见 `runs/fence-POST.log` |
| root vitest | 两抓：`runs/root-vitest-FINAL.log`（9 恒等 + a3p3 hygiene **5s 负载超时 1**，该 suite 单跑 21/21 绿、3.3s）与 `runs/root-vitest-FINAL2.log`（**恒等集=已发布 9，逐行对照零增减**）。首抓超时=负载 flake 披露在案，非本 stack 行为红 |
| build + `check:artifacts` | build EXIT=0；dist 镜像 20 文件与 src 同笔；提交后 `check:artifacts` verdict=ok compared=1742，**`check:artifacts:head` drift=0（HEAD carries its own build）** |
| 推送 | 无凭证（https 无交互式认证），**代推归父**；分支 `alpha5-schema-rev`（base `23002259`），head sha 以报告面/日志为准（文件内不自指 sha） |
| 翻档备笔 | `runs/v4-flip-PREP.md`（FLIP=NOT-APPLIED；未宣布退役；RETIRED 未翻） |

红线：CORE PATCH BUDGET=0（upstream 零触）；`:3080`/`:3180` 零触碰；A-1..A-7 均未代裁
（v4 字段族可选=可逆临时立场）；未借 v4 擅自裁历史 trim（additive only，ADR §6.0）。

## Rebase-integration 注（2026-10-17 merge master@68deccaa）

- master 推进两笔入链：G1 deny-lane 修复（#315，链 1168→1169）+ P-B-R2 binding feed（#317，链 1169→1170）。
- 本支 p4t6 Δ9 条款按"链在 master 侧，迟到者 re-tie"规则重钉于 **1170→1179**（合并树上实测：p4t6 coverage 精确断言 filesScanned，66/66 绿）。
- **历史钉保留**：原笔 `1177 - 1168`（base 23002259 上的本轮首落）不删除——本文与 commit message 均保留该历史值；merge 后的现行钉以 p4t6 测试体内注释为准（"Pre-merge this clause tied 1177 - 1168"）。
- router-log 并集：master 三条按 master 追加顺序在前，本支 17:4xZ 条整体保持原文在后；两侧均无删改（并集非改写）。
- 语义冲突：无（G1=runtime src 面、P-B-R2=install 面，与本支 dormant domain 面零交集）；a5sr 五套件、typecheck、dist 镜像（9 文件再生）均在合并树亲验。
