# scoped visibility 三选项评估材料（根 21:15Z 点名件：**呈根评估，不是呈用户**）

**源**=GLUE-4 #302=`79f82441`，`E/wiring/glue4-prodentry/README.md`（master `5885e46e` 现场 `git show` 逐字）。README 该节标题原文自带状态：**「Adjudication questions (root) — RESOLVED 2026-10-17: Q4 APPROVED … Q2 REJECTED (R5), Q1 DEMOTED, Q3 REJECTED — all stand」**。本文件不重开裁决：把三选项的**正文原文/语义/影响面/与已生效裁决关系**整理成评估面，供根在需要复审或处置 Q1（唯一仍开的 optional upstream ask）时即用。〔更正我方台账旧口径："三选项裁决单已呈待用户"为**过时/不精确**——该单是 root 单且 10-17 已 RESOLVED；本轮起以本文件为准。〕

**缺失 seam 一句话（README 原文逐字，选项共同背景）**：
> A public assembly surface that lets a DEPLOYMENT register tool definitions into the GLOBAL trusted face **with visibility scoped by agent preset / policy** — e.g. a row-level visibility gate on the profile-patch schema, or a public global-plane `register(definition, { visibility: presetOrPolicy })` — such that `tools.schemas()` (no scope) shows the definition (Guard fact-3 verifiable) while `view(scope)` for non-qualifying scopes does NOT inherit it (least privilege). Today `view()` has exactly one non-inherited layer (a scope's own registrations, `index.ts:1180-1183` "Chain-blind on purpose") and `restrict()` is scoped-only (law 4): there is no third shape.

## 选项一（Q1）：host word——全局面注册 + preset/policy 门控可见性

- **正文原文（逐字）**：「Q1 (demoted, optional upstream ask): the host word described above (global-plane registration with preset/policy-gated visibility) remains a legitimate future ask (also for a "verified dsh-native" audit label), no longer a blocker.」
- **语义**：向宿主请求一个公开 seam：全局受信面注册时按 agent preset/策略限定可见性（`tools.schemas()` 可证 Guard fact-3，非合格 scope 的 `view()` 不继承）。
- **影响面**：CORE PATCH BUDGET=0 下唯一合法形态=**upstream 公开接口请求**（仅项目内登记，不自动对外发请求）；若存在，可支撑"verified dsh-native"审计标签一类未来诉求。**现产品路径不依赖它**（governed team 面已走 Q4 placement，不需要 host word——README AMENDMENT 节逐字：「no host word is required for the governed-team tool plane」）。
- **与已生效裁决关系**：已 **DEMOTED**（非阻塞）；与 Q4 落地后现状**并存无冲突**。处置选项=保持休眠 / 正式登记为 upstream ask 文本（后者是根可做的动作，本材料不代做）。

## 选项二（Q2）：discovery-style 比较侧换绑（scoped self-pin whatever resolves）

- **正文原文（逐字）**：「Q2 (REJECTED on RA-REVIEW R5): a discovery-style comparison-side swap (scoped self-pin of whatever resolves) stamps the SHADOWING body `verified:true` — the exact R-a attack; rejected with counter-proof, R-a is not revised.」
- **语义**：把绑定核验的比较对象改为"该 scope 解析到的对象"自我钉住。
- **影响面**：**把遮蔽体（shadowing body）盖真**=R-a 攻击面直通；RA-REVIEW 以反证实测否决（R5；`ra-review@4ba92b77` 两 tier GREEN 11/11+10/10，R-a 语义字节不动）。
- **与已生效裁决关系**：**REJECTED（带反证）**，复选=重开已证伪攻击面，无评估价值；列此仅为正文完备。

## 选项三（Q3）：全局面挂载 + 豁免负控

- **正文原文（逐字）**：「Q3 (REJECTED): global mount + waived negative control is not taken; the measured `minimal`-preset expansion (G7) and the process-wide trusted-face flip (G8) stand as the standing evidence that the production entry must not mount the tool plane globally.」
- **语义**：以全局挂载换取 Guard 可读，同时放弃"最小 preset 不得扩权"负控。
- **影响面**：**双世界实测已证其害**（glue4 runs `2026-10-17T07-38-38Z` 双 world 记录+observer row 工装）：`minimal` preset 扩权（G7）+ 进程级受信面翻转（G8）⇒ 最小权限模型整体失效。
- **与已生效裁决关系**：**REJECTED**，且与 BIND-DIAG 后"公开路径=host-plane 形状"的既有装配路线互补不冲突（不需要全局挂载）。附**已录入未走的路**（README「Not pursued (recorded)」逐字要点）：disable+reinsert `preset-minimal` 挂 mask-plugin 行=公开语法但侵占操作者 preset、对 Web-editor 新建 preset fail-open、仍违字面负控（globalNames 进程级翻转）。

## 基线（非选项）：Q4=已批准的实现完成路

「Q4 (approved as implementation completion within the original authorization semantics — … not a new user adjudication)」：governed team 工具走冻结设计的 **R1 placement lane**（`post-poc-technical-design.md:42`+`install.ts:987-1029/1106/1062-1063`+`agent-bindings.mjs:2460-2471`；R-a 继承侧逐字节不动）。**现状生效链**：GLUE-7/#321 backends（plane 生产行）→ #317/#313 feed → #329 接管形准入=均在 master（`5885e46e` 祖先链），即 Q4 语义已产品化。

## 呈根评估的三行总结

1. Q2/Q3=已带反证/实测否决，**无需再审**；
2. Q1=唯一仍开的合法休眠诉求（optional upstream ask），可处置动作只有"休眠/正式登记 upstream 文本"二态——**要根一句话定态**，不需用户；
3. governed-team 面经 Q4 已不依赖任何未决选项；本文件=材料完备化，**不是待裁请求**。
