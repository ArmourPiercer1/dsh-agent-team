# Review-S0 — S0 统一选型矩阵独立审查（Alpha.5 · S0 · 单轮定向）

> **Reviewer**：Alpha.5 S0 独立 Reviewer（≠实现者，独立会话，未参与 S0/PoC 实现）。
> **模型逐字自报（powered-by）**：`You are a coding agent powered by the qwen3.8-flash-next model.`（模型名 `qwen3.8-flash-next`）。
> **受审对象**：branch `alpha5-s0-selection-matrix` @ `5f97b05bd25737a3abb6ed5ac88c03f4c7e58648`（PR #251，base master `b6c99de2fa5c9b5bd8ba0cdfa698a2fbc0d510f0`；delta = 单文件新增 157 行 `docs/plans/memo/alpha5-tool-io-governance/S0-SELECTION-MATRIX.md`，已实测 `git show --stat`）。
> **审查方式**：只读 `git fetch origin` + worktree 亲读被引证据文件 + `git cat-file/rev-parse/rev-list` 对合 SHA；不 checkout、不改动、不重开 PoC 实验、不新增泛化评审。
> **裁决口径**：PASS / FAIL / CONDITIONAL + findings（BLOCKER/MAJOR/MINOR）。

## 总判定：**PASS**（0 BLOCKER · 0 MAJOR · 5 MINOR，均不阻断）

S0 矩阵对计划 §2 完整、对既有证据忠实（≥8 处引用逐条原文对读，无一处语义加强/弱化）、五类重大冲突并存呈现且取代时序与证据时间序一致、边界声明在位且无一行把 PoC PASS 写成产品支持、35/35 相对链接可达、被引计数全部与源文件对合。

---

## 1. 完整性（对计划 §2 逐项）

| 计划 §2 工作项 | 矩阵落点 | 判定 |
|---|---|---|
| supersession 表（旧记录原文保留、不篡改历史） | §1 表 SUP-01..18，18 行；`decision.md`/`env-capability-matrix.md`/`P0-SELECTION-REPORT` 原文均实测仍在位（`decision.md` §2 bash 行"ENV_BLOCK…全部实测不可行"、web/jobs/MCP 行"NOT RUN（本轮无网络授权）"逐字保留；env-matrix B0/B1 复核行"未从内部定论根因"（:71）、结论 1（:119）、结论 2（:120）逐字保留） | ✅（唯 SUP-16 指针瑕疵见 MINOR-1） |
| 逐工具绑定{source anchor、公开接口确证、证据等级、未测项、默认处理、实施 PR、Fork 债务} | §2 表 M-01..M-14：owner PR/验收证据（含 fixture\|OS\|host 层级标注，§2 前言冻结定义）/未测项/默认处理 14 行全列；source anchor 与公开接口确证以行内嵌入（如 SUP-08 `src/index.ts:311/352/372`、SUP-11 `index.ts:1578`、M-06 包根 7 helper 实名、M-08 `EXISTS-PUBLIC`、SUP-15 `host.ts:91`/`LspQueryRequest` 无策略字段）；Fork 债务经 D-5 + tool-fork-debt 全局承载（形态注记 MINOR-4） | ✅ |
| 二义词规范化 | §3 表 6 行：R1=Scope Binding / R2/R3=实现选择 / R4=Fork / executionBoundary 三值 / Assurance 由有效 Policy 推导，语义与设计 §2/§2.1/§1.4 对读一致，含禁止旧用法 | ✅ |
| 性能测量方法冻结、不设阈值 | §4：引计划原句逐字（"冻结性能测量方法（延迟 p50/p95，内存/CPU/进程数，按小/大用例），不是根据猜测设置一刀切阈值。"对 `alpha5-s0-pr0-pr8-implementation-plan.md` §2 对合逐字等）；方法/环境/用例矩阵/指标冻结，全文无任何阈值数字 | ✅ |
| 两条差异登记原句 | §5 D-1/D-2 引计划 §2 原句"S0 不批准 LSP 上游方案，也不将 `strict read metadata` 修改为 content-only。"逐字等 | ✅ |
| 自检（12 NEG、SHA、10/10、18/18、链接、不 GO） | §6 七项，逐项实测复核（见 §4/§5 节） | ✅ |

**14 行 ↔ 设计 §3 八类 A–H 逐类点数**：A（read/read_image/write/edit/str_replace_editor，5 工具）→ M-01/05/02/03/04 **5/5**；B（glob/grep）→ M-06 ✅；C（bash/pwsh）→ M-07 ✅（pwsh/Windows 明示"未证明，显式 OS Unsupported"）；D（run_code/PTC）→ M-08 ✅；E（lsp）→ M-09 ✅；F（web_fetch/web_search/job_output/list/kill）→ M-10+M-11 ✅（依 pinned 面仅三工具、不杜撰 `job_start`，与设计 §3 范围条款及 SUP-08 grep 实证一致）；G（MCP stdio/HTTP + Domain HPC/RPC/研究状态/设备）→ M-12+M-13 ✅；H（Team 管理/委托/todo_write）→ M-14 ✅。**5+1+1+1+1+2+2+1=14，无缺族。**

## 2. 忠实性（抽查 14 处引用，原文语义逐条对读）

1. **SUP-01 landlock 修正**：旧记录 `decision.md` §2 bash 行 ENV_BLOCK 原文在位；根因 `04-process/landlock-diagnosis.md:14` 原文 "`3 = 0x3 = EXECUTE|WRITE_FILE`，而 `READ_FILE|READ_DIR = 4|8 = 12 = 0xC`——注释正确、常量错误" 与矩阵逐字合；`corrections-addendum.md:7` "handled=0x7FFF 后负控 EACCES…（ext4+tmpfs 双fs，OVERALL rc=0 ENFORCE-WORKS）"；新结论 **OS_ENFORCED** 用词 = `10-landlock-lanes/notes.md` 判定表本词（L1 13/13 等），且 lanes notes:6 自带层级措辞"fixture/子进程级 OS_ENFORCED（规则由测试代码编译）"——矩阵 §2 前言层级定义与 M-07 行 **OS 层** 标注保留了该限定，未升格为宿主/产品级。**未加强** ✅。bwrap/netns/uid_map 三行"维持各自 ENV_BLOCK"与 lanes notes:5 逐字合 ✅。
2. **SUP-09 dynRan**：`07-integration/03-stage2b/notes.md:183-186`（续-7 披露 1）"register ok=true and BODY RAN（hc-dyn-observation.dynCallResult='H6_DYN_RAN'…hc-dyn-observation.json is the authoritative record）"；`run-h6-2026-10-15T23-15-50/hc-dyn-observation.json` 实测含 `dynRan: true, dynCallResult: "H6_DYN_RAN"` ✅；`h6-result.json` 内 `dynToolRow`/`dynMarkerExists:false` 与 notes 解释（marker 在已删 world）一致；"运行时 Guard 对 unmanaged 名**弃权**、fail-closed 线在 setup Coverage Gate（UNKNOWN_UNMANAGED FATAL）"为原文语义 ✅。
3. **NEG-11**：`negative-cases.md:20` 与 `03-fs/notes.md` 关键发现 2（"realpath(别名)=别名（POSIX 硬链接无正本）"、ALIAS_DENIED、open=0）逐字合；SUP-10 "编译期快照"收紧注记 = `decision.md` §3 硬约束 4"边界注记（收紧）"原文（①登记后新建硬链接 ②unlink+重建 ③TOCTOU 三分项逐点对合），且含"不得宣称完全闭合" ✅。
4. **SUP-15 LSP 共享池**：`06-lsp/notes.md` P05-LSP-3（同 pid、opens=2）、L-4（服务器侧 OS 读禁读文件成功，虚构数据；`host.ts:91` containment 只护宿主预读）、L-7（`keyA===keyB`）、L-0（池键=`targetKey` 仅路径身份、`LspQueryRequest` 无 agent/policy 字段）全部对合；"§6.1 素材，非宣告"语义在 `P0-SELECTION-REPORT.md:28` 原文在位（出处注记 MINOR-2）；矩阵维持"不宣告上游方案、不自动 Fork" ✅。
5. **R1 @ `c46ffb76`**：`08-review/p07-review-R1.md` 文首 HEAD = 全 SHA `c46ffb76e33c8ce097a84963c72a60d88a9d263e`；§4 总体裁决 **PASS** 且自限"本 PASS 仅指证据诚实且可复现，不构成 P0 GO"——矩阵引用未升格 ✅。
6. **R2 @ `9e422ff5`**：文首起点 `afc5e039`、HEAD 漂移如实记录、delta `c46ffb76..9e422ff5` = **8 提交**（`git rev-list --count` 实测 8）；§5 总体裁决 PASS（delta 面，fixture 级口径）✅。
7. **REG1 @ `79d6aea7`**：文首锁定 SHA `79d6aea72313619d1e167f647133cdb3c114384c`、`REG1 = PASS`；§2a（H-A `wireContentHits=0`/`wirePathEchoes=61` 分层两字段）、§2b（每请求恰一 consumed、无 standing grant）、§3（run_code typed 拒绝逐字对合）与矩阵 M-01/M-03/M-08/M-14 引用逐点合；`wireContentHits` 实测存在于 `h6-result.json`（基线件 1 处）✅。
8. **SUP-16 exit134**：`EXECUTION-LOG.md` 续-6 与 `03-stage2b/notes.md` run 22-32-37 原文："kit 进程 V8 堆耗尽（2GB heap 存语料，node abort）；exit134 单独不能断言内核 OOM killer；内核层未验证（dmesg EPERM）；1747 次重放（ORACLE 非模型驱动）；已修 oracle+storm fuse>300" 全部逐点对合；矩阵未把层级结论判死（内核层保持未验证）✅（旧记录指针见 MINOR-1）。
9. **SUP-07 web/jobs/MCP**：`09-web-jobs-mcp/notes.md:16` 标题即"三族判定（fixture 级 → 最多 INCONCLUSIVE(方向性)，无 GO）"；web 10/10、jobs 12/12、mcp 8/8 = **30/30**、幂等×3（:41）；"拒绝在 fetch 调用点之前（invoker+0/access-log+0/tripwire 尝试 0、零 socket/零 DNS）"原文合；**INCONCLUSIVE(方向性) 未漂成 SUPPORTED**——矩阵 SUP-07 与 M-10/11/12 全部保持"×3，无 GO" ✅。
10. **fixture≠OS≠host 层级**：§2 前言冻结三档定义；抽查 M-01（fixture+host 分列）、M-06（fixture/host 分列）、M-07（**OS 层** 标注 + "本环境该族现态 UNSUPPORTED（环境）"+ host bash 体宿主 fail-closed 原文披露）、M-10（"回环结果不扩张产品保证"）无跨级冒充 ✅。
11. **SUP-17**：R1 §3-F2（P0-0 4/4→5/5，低报方向）与 R2 §1#12（已回填 5/5）实存 ✅（链接标签见 MINOR-3）。
12. **SUP-18**：R2 §4-N2（"LSP 10 腿"实为 11 腿 P05-LSP-0..10，少计/低报）与 N3（fiber PENDING 注释精确 140-146、147-156=enum 本体）原文在位；`06-lsp/notes.md` 实测 11 条 P05-LSP- 腿 ✅。
13. **SUP-11**：`negative-cases.md` NEG-1 行（`index.ts:1578` 晚期重解析、原体 native=1、安全序 native=0）+ R1 复跑记录"L3 双竞态腿 7 连跑稳定"合 ✅。
14. **SUP-13/SUP-14**：lanes notes"listdir(~/.ssh) 仍 OK（READ_DIR 合并 search+enumerate）"原文在位；`05-ptc/ptc-outer-result.json` `parentPresent:true` 实测在位（字段名注记 MINOR-5）；REG1 §3 逐字节对合 ✅。

## 3. 冲突登记（五类重大反转）与取代时序

五条重大冲突 = ①landlock ENV_BLOCK→OS_ENFORCED（SUP-01..05）②"嵌套结构性不可能"撤回→分层拦截点（SUP-06）③web/jobs/MCP NOT_RUN→30/30 INCONCLUSIVE(方向性)（SUP-07/08）④H6 dynRan 发现（SUP-09）⑤exit134 内核 OOM 疑云→V8 堆证据层级（SUP-16）。**并存呈现**：每行"旧记录（原文位置）/旧结论/最新事实/根因/证据"五列并置，旧原文实测均在被引文件保留（见 §1）；**未擅自裁决**：SUP-06 "不确证其为唯一因，不外推"、SUP-16 不判死内核层、SUP-15 素材"非宣告"、SUP-12 R4=NOT-ELIGIBLE 不 Fork、D-1 不批准上游方案——全部把裁量留给后续轮 ✅。**时间序对合**：旧记录载体 `decision.md`@`9e422ff5`(21:51) 早于全部修正证据 `da67ed8e`(22:10 corrections)/`43c8e8c8`(22:16 09 路)/`56a2091d`(22:26 lanes)/`79d6aea7`(23:16 h6/REG1)；矩阵只引用不改史（`git log --all -S` 未见对旧结论的删改提交）✅。

## 4. 边界检查

- 顶栏 L3"**总状态：P0 NOT CLOSED；本矩阵是实施选型权威，不是产品 GO**"在位；§1 末"不可上升为已完成产品的事实"与 §6"GO 仍未产生，任何族不得写成 GO"在位。✅
- 全 14 行无任何 PoC PASS→产品支持升格写法；未测/UNSUPPORTED/BOUNDED-DEFER 如实（M-05 NOT_VERIFIED、M-07 环境 UNSUPPORTED、M-09 Bounded Defer、M-13 NOT_RUN 明示）。✅
- "S0 不批准 LSP 上游方案"（M-09 默认处理列 + D-1）与"strict read metadata 不改 content-only"（D-2）原句在位且引计划 §2 逐字。✅
- Fork 债务 = 0：`tool-fork-debt.md` Ledger A5-FORK-001 = **CONDITIONAL — no fork incurred**，与矩阵 D-5"未产生；grep/glob NOT-ELIGIBLE"及 P0-SELECTION-REPORT:53"不新增 fork"一致。✅

## 5. 链接可达与数字一致性

- **链接**：脚本解析全文相对链接 35 条，`os.path.exists` 35/35 可达，0 broken（含 `EV/` 展开路径与 `../../active/alpha4-permission-governance/…`）。✅
- **SHA 对合**（`git cat-file`/`rev-parse` 全部可解析）：`c46ffb76`→`…263e`（R1 PASS）、`9e422ff5`→`…7400`（R2 delta PASS；起点 `afc5e039` 漂移如实；delta=8 提交实测）、`79d6aea7`→`…384c`（REG1 PASS）；`a2e741a0`（PoC 终态 HEAD）、`da67ed8e`/`56a2091d`/`43c8e8c8`/`2b61441a`/`aaf327a8`/`eaec6c55` 全部解析且时间序单调。✅
- **计数**：stage2b **10/10**（`run-2026-10-15T22-44-01/summary.json` verdict=PASS、10 criteria 全 ok + REG1 同 SHA 重跑零翻转）；h6 **18/18**（`h6-result.json` criteria 实测 18 条全 ok、`h6-KIT_EXIT`=0、基线 `run-h6-2026-10-15T23-15-50`）；**30/30**=10+12+8（09 notes 幂等×3）；**11/11** P0-3 腿（R2 复跑×2，22 条子判定=11 腿双通道）；**12/12** SRCH-03（真 rg 15.0.0）；**13/13** L1（另 L1FD 6/6、L2 7/7、L3 8/8、L4 5/5、TOCTOU 2/2+2/2）；**5/5** P0-0（R1-F2 低报已回填）；LSP **11** 腿；PTC **8** 腿（7 绿+1 NOT_RUN→续轮）；NEG **12** 条 ↔ §2.1 表 12 行全映射。全部与源文件对合，无一漂移。✅

## 6. Findings（全部 MINOR，不阻断）

| # | 级别 | 位置 | 内容 |
|---|---|---|---|
| MINOR-1 | MINOR | `S0-SELECTION-MATRIX.md` §1 SUP-16"旧记录"列 | 旧结论"exit 134 → 疑似内核 OOM killer"的**原句**不在被引 `EXECUTION-LOG.md` 续-6（该行为修正后措辞）且 `git log --all -S"疑似内核"` 无任何 tracked 版本含此句——疑为会话内传播的定性候选，未入库。修正本体（V8 堆/1747/ORACLE 驱动/内核层未验证/dmesg EPERM）逐字实存且方向保守（降格而非升格），无夸大风险；建议下轮把该格改指 notes run-22-32-37 标题行"KIT OOM (exit 134)"并明示原定性候选未提交。 |
| MINOR-2 | MINOR | §5 D-1"依据"列 / §1 SUP-15 | 引文"素材，非宣告"逐字出处 = `P0-SELECTION-REPORT.md:28`（对 06-lsp L10 的汇总行）；`06-lsp/notes.md` L10 本身裁决词为 "RECORDED"。实体（§6.1 十一字段素材已录、不宣告 blocker）全部成立，仅出处标注偏移一行。 |
| MINOR-3 | MINOR | §1 SUP-17"证据"列 | 链接标签写"p07-review-R1 §3-F2 / R2 §1#12"但链接仅指 `p07-review-R2.md`；R1 §3-F2 内容实存于另一文件 `p07-review-R1.md`（两文件均可达、主张可验）。补一条 R1 链接即可。 |
| MINOR-4 | MINOR | §2 表形态（对计划 §2"逐工具…未来 Fork 债务"） | "Fork 债务"未做成 14 行逐行单元格，而是 D-5 + tool-fork-debt 台账全局承载（A5-FORK-001 CONDITIONAL/未产生，grep/glob 行内 NOT-ELIGIBLE、M-09 禁自动 Fork）。语义等价且与台账零债务一致；如求逐行可勾稽可下轮加列。 |
| MINOR-5 | MINOR | §1 SUP-14 / §2 M-08 | 引 `exec.parent=true`，工件字段实名 = `ptc-outer-result.json` `"parentPresent": true`。语义等（外层真实进程存在性），字段名引用不精确。 |

## 7. 结论

**PASS。** S0 矩阵可作为 Alpha.5 实施选型唯一权威继续下行（P0 仍 NOT CLOSED，GO 仍未产生，PR0–PR8 各门照常）；五条 MINOR 均为文档精度问题，建议在 PR8 前的任一轮文档对齐中顺手修正，不构成补充内容级门槛。
