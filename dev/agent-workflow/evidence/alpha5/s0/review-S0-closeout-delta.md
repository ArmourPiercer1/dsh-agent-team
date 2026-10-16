# review-S0-closeout-delta — S0 文档收口 MINOR（M1/M2/M3）补核验（独立 reviewer）

- **角色**：Alpha.5 S0 文档收口 delta 独立 reviewer（未参与实现；非 review-S0 原班之外的冒充——本件针对**实际最终 SHA** 补核验，不以 `5f97b05b`/`eb81bee6` 审查冒充）。
- **模型名逐字回报**：系统提示 powered-by 原文 = `You are a coding agent powered by the qwen3.8-flash-next model.`（模型名 `qwen3.8-flash-next`）。
- **对象**：PR #251 head `b68c3b476e016f03b42ab1583bbb72b94d5e7cc9`；diff 区间 `96ea3cada94646ad2a544b5de06d248d49d3c676..b68c3b47`（区间内仅 1 提交 `b68c3b47`）。
- **受审文件**：`docs/plans/memo/alpha5-tool-io-governance/S0-SELECTION-MATRIX.md`（下文行号均指该文件 @ `b68c3b47` 版本）。
- **取证方式**：`git fetch origin refs/pull/251/head` + `git show b68c3b47:<path>` / `git ls-tree` / `git cat-file -e` / awk 管道计数逐行实测；主目录只读，不 merge 不 push 分支历史（本件自身 commit+push 至 `alpha5-s0-selection-matrix` 为任务授权动作）。
- **日期**：2026-10-16（UTC）。

## 总判定

**PASS — 0 BLOCKER · 0 MAJOR · 0 MINOR**（既存 INFO ×1 + 记录性 INFO ×1，均非本轮 finding）。M1/M2/M3 三处修正在最终 SHA `b68c3b47` 上全部真实落地，diff 面纪律干净，横幅与计数未破坏。

---

## 逐项核验（每项 行号 + 三值）

### 1. M3 — SUP-17 证据列 R1/R2 双链接（文件 L35）

| 值 | 结果 | 实测 |
|---|---|---|
| 链接结构 | PASS | L35 证据列现为两个独立链接：`[p07-review-R1 §3-F2](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/08-review/p07-review-R1.md)`、`[R2 §1#12](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/08-review/p07-review-R2.md)`——R1 主张指 R1 文件、R2 主张指 R2 文件，旧"标签含 R1 而链接仅 R2"缺陷消除 |
| 文件实存 | PASS | `git cat-file -e b68c3b47:…/08-review/p07-review-R1.md` 与 `…/p07-review-R2.md` 均 OK（`git ls-tree -r b68c3b47` 该目录另含 p07-review-REG1.md） |
| 路径深度 | PASS | 相对深度逐层核：`docs/plans/memo/alpha5-tool-io-governance/` →`..`=memo→`../..`=plans→`../../..`=docs→`../../../..`=repo 根，其后 `dev/agent-workflow/evidence/alpha5-adapter-p0/08-review/…` 与树内实际 blob 路径逐字合 |

语义附核：R1 §3（"Findings"，R1 文件 L44）F2 行（L47）实载"P0-0 行仍写 4/4，HEAD 上 runner 实为 5/5……低报方向"；R2 §1 #12（R2 文件 L35）实载"F2 P0-0 行已回填 **5/5**"。SUP-17 行主张（5/5 回填、R1-F2 低报方向 staleness 已处置）与两链接指向内容一一对合。

### 2. M2 — D-1"素材，非宣告"归因（文件 L124；关联 SUP-15 L33）

| 值 | 结果 | 实测 |
|---|---|---|
| 归因改正 | PASS | L124 依据列现为 `06-lsp notes L10（"素材，非宣告"字样逐字出处=P0-SELECTION-REPORT.md:28）`——归因显式钉到 P0-SELECTION-REPORT.md:28，06-lsp 降为保留语境素材 |
| 出处实存 | PASS | `dev/agent-workflow/evidence/alpha5-adapter-p0/P0-SELECTION-REPORT.md`（b68c3b47 树内）**第 28 行**（P0-5 PTC/LSP 行）实载逐字"§6.1 十一字段 CORE 素材已录（素材，非宣告）" |
| SUP-15 一致性 | PASS | SUP-15（L33，本 delta 未触碰）既有归因 `[06-lsp（"素材，非宣告"字样出自 P0-SELECTION-REPORT.md:28） notes](…/06-lsp/notes.md)` 与 D-1 新表述同出处、同"06-lsp=语境、report:28=逐字出处"结构，**零矛盾** |

**INFO（记录性，非 finding）**：`06-lsp/notes.md` 的字面第 10 行是 TEST DOUBLE/FICTION 声明；"L10"在本证据树既有语义 = **P05-LSP-10 素材腿**（notes L38 `P05-LSP-10 … **RECORDED**`），review-S0 MINOR-2 原文即以"06-lsp L10 的汇总行"定义该指针（裁决词 RECORDED），report:28 正是该腿的汇总行——故 D-1 现表述与 review-S0 出处口径同构；双读歧义由 D-1 括注（"逐字出处=P0-SELECTION-REPORT.md:28"）完全消解，不构成新缺陷。

### 3. M1 — SUP-16 行表格合法性（文件 L34）+ 整表扫描

| 值 | 结果 | 实测 |
|---|---|---|
| 行合法性 | PASS | L34 首字符 `|`、末字符 `|`；**未转义管道恰 7**（awk gsub 实测；转义管道 `\|` = 0；反引号代码段内含管道 = 0）→ 恰 6 列，与表头（L17：`# / 旧记录 / 旧结论 / 最新事实 / 根因·修正依据 / 证据`）列数一致 |
| 注记并入 | PASS | 引用注记"（引用注记：旧句"疑似内核 OOM killer"未入任何 tracked 版本，修正本体逐字实存——见 review-S0.md §6 MINOR-1）"并入**第 6 列（证据列）内部**（`wire-capture.json` 之后、行尾管道之前）；语义未损：三要点（旧句未入库 / 修正本体逐字实存 / 指回 review-S0 §6 MINOR-1）齐备，且所指均实存——review-S0.md §6 标题 L62、MINOR-1 行 L66；`03-stage2b/notes.md` L46 标题行"run 2026-10-15T22-32-37 — … KIT OOM (exit 134)"与链接标签"stage2b notes run 22-32-37"对合 |
| 整表扫描 | PASS | `^\| SUP-` 全 18 行（L19–L36）列数：17 行 = 6 列；SUP-16（L34，双空格填充）= 6 列；SUP-01（L19）字面 8 列（见下 INFO，既存）。M-xx 矩阵行全 14 行（L48–L61）未转义管道均 **11** = 10 列，与 L46 表头/L47 分隔行 10 列全一致，14 行零漂移 |

**INFO（既存渲染怪癖，非本轮 finding）**：SUP-01（L19）因证据/根因列内反引号代码段 `EXECUTE|WRITE_FILE`、`READ_FILE|READ_DIR` 含 2 个字面管道（全行 9 个未转义管道 → GFM 渲染切为 8 段）属既存渲染怪癖；本 delta 该行与 `96ea3cad` **逐字节一致**（sed 抽取 diff 为空），未被恶化；review-S0 未列其 MINOR，本轮同样不作 finding，如实记录。

### 4. diff 面纪律

| 值 | 结果 | 实测 |
|---|---|---|
| 文件面 | PASS | `git diff --stat 96ea3cad..b68c3b47` = 仅 `docs/plans/memo/alpha5-tool-io-governance/S0-SELECTION-MATRIX.md`，`3 insertions(+), 3 deletions(-)`；区间内仅 1 提交 |
| 行面 | PASS | 全文 diff 的改动集恰为 SUP-16（旧 L34）/SUP-17（旧 L35）/D-1（L124）三行，即 M1/M2/M3 三处修正本体；无第四处语义变化 |
| 逐字一致 | PASS | 三处以外内容由 diff 完备性保证与 `96ea3cad` 逐字一致；对最易受牵连的 SUP-01（L19）另抽行比对——逐字节相同 |

### 5. 顶部横幅与计数完整性

| 值 | 结果 | 实测 |
|---|---|---|
| 横幅 | PASS | L3 原文在位且逐字未动：`> **总状态：P0 NOT CLOSED；本矩阵是实施选型权威，不是产品 GO。**` |
| 14 行矩阵 | PASS | §2 表 M-01…M-14 共 14 行（L48–L61）全在，每行 10 列（见第 3 项扫描） |
| 18 SUP 计数 | PASS | §1 表 SUP-01…SUP-18 共 18 行（L19–L36）全在；§2.1 NEG-1..12（12 行）、§5 D-1..D-7、§3 术语 6 行均未受 diff 波及（改动行号集 {34,35,124} 不触碰任何计数区） |

---

## 结论

**PASS（0 BLOCKER · 0 MAJOR · 0 MINOR）**。`b68c3b47` 对 review-S0 三条 MINOR（M1=SUP-16 行形、M2=D-1 出处、M3=SUP-17 双链接）的最终落地全部经实文件/实树/实锚点独立复现成立；S0 矩阵维持"实施选型权威、P0 NOT CLOSED、非产品 GO"地位不变。本件为对精确最终 SHA 的补核验，不替代亦不冒充此前任何轮次审查；本 reviewer 未 merge、未改分支历史。
