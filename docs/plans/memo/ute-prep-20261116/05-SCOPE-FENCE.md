# 05 — 范围围栏：G1 的前置与非前置

**[updated 2026-11-16 UTE-Prep]** #765 §十 §1 把"PR #758 合并 + v0.1.6 冻结"写成整条 Gate 的前置，于是外围每件事都被当成阻塞。本文逐项裁定：哪些**不是** G1 的前置条件（做不做都不挡第一刀），哪些**是**（缺了就真的不能开工）。判据只有一条：**它是否改变 G1 纵切的可执行性或证据有效性。**

## 1. 不是 G1 的前置（明确写下，避免"顺手先做"）

| 项 | 现状（master 实测） | 为什么不是前置 | 什么时候做 |
|---|---|---|---|
| **B5–B9 归档** | 未收编在 #786 之后是 **41**（48 → 46 → 41；B4 的五个 host-dependent 套件已进 `ci-census`）。B5–B9 本身仍未收 | 收集是 **CI 卫生**（避免同类套件被静默漏跑），不是 rc.5 上的执行能力。门禁只要求"未收编数不增长"（`test-catalog --max-uncollected 48`，现测 41），不要求归零；排除通道另由 `excluded-baseline.json`(9)+`--max-excluded` 卡住 | 与 G1 并行，谁有空谁做；不得为了让数字变好看而改口径 |
| **host build cache identity 修复** | hosted runner 自建 `bin/glibc/system.node` = `dfa6d586…` ≠ pin `54a9c25c…`；已用"发布包运输"绕开（receipt `u7-sbx-host-asset-receipt/1`，`M7A-STEP verdict=VERIFIED arms=5` run `43804251634-1`） | 结论已经落地：**固定发布产物是标准，runner 的构建不是**。pin 不信任 runner 构建，所以"让 runner 构建可复现"不改变任何判定 | 不影响 G1；若将来要从源码重建资产，另开 |
| **进一步的 census 调优** | hosted census leg **761 s**（rank-1 后，`DSH-CI-LEG leg=census verdict=pass seconds=761`；24 任务 / 12 roots / 712 文件；workers=4 单一来源 `scripts/census-invocation.mjs`） | 761 s 已足够让 L2 在预算内跑完；perf 的 60 s 判据是**给 perf PR 用的**，不是 G1 的门 | 需要时再开 perf 切片；**不得**为了省时间而缩 census 覆盖面 |
| **L3 evals** | 本仓没有 L3 eval 层参与任何 Required 门 | G1 的验收是 C1 契约 + C2 真实效果负控，eval 分数不能替代负面控制 | 与 G1 无关 |
| **v0.1.6 正式冻结宣告** | #758 已合并；v0.1.6 的"受限内部试用版冻结"是否有具名裁决，本 memo **未能核实**（UNKNOWN） | G1 的所有纵切对产品与 Authority **只读**（不写共享装配、不动 `current-authority.json`）；DEV-LIVE 自授权已允许在隔离 World 内反复起停 | **Authority Migration（把 UTE 变成合同）**必须等它；G1 工程切片不等 |
| **alpha5 阶段的 B1–B7 具名阻塞**（`ALPHA5-SANDBOX-BACKLOG.md` §0.3.2） | 仍有效 | 它们描述的是**当前产品面**的缺口（PTY face、network-deny 后端、shipped 受限声明），换成 rc.5 不会自动修好，也不是 rc.5 集成的输入 | 保持原状；不要用 UTE 的 Gate 去"顺带清"它们 |

**一句反规则**：以上任何一项都**不得**被写成 G1 的"前置条件"来推迟开工；也**不得**被写成"已达成"来提前宣布 G1 通过。两者都是把围栏挪走。

## 2. 是 G1 的前置（缺了就真的不能开工）

| 项 | 定义（可判定） | 缺了会怎样 | 归属 |
|---|---|---|---|
| **P1. 新宿主可复现运行** ✅ **已落地**（#787，证据 `dev/agent-workflow/evidence/host-next-20261116/`） | 在一棵**登记过的**第二棵树上，用登记的 SHA/detached HEAD 起一个 rc.5 world；`git status --porcelain` 空；两次启动得到同一 host 身份；证据带 tag+commit。**实测**：`tests/next-host/boot.test.mjs` 在 13000–13049 带内真实 boot，`native-api.test.mjs` 六条原生 API 断言 | 所有"rc.5 上如何"的结论都只是源码阅读，G1 变成纸面 | G0-S1 + G0-S2 |
| **P2. M7-B1 最小可信 FS 窗口** ✅ **已落地**（#786 `f46bcdd29`） | World Factory **拥有**观测窗口：窗口带 world/pid/lease 身份，provenance 能在序列化后存活（不只是进程内 Symbol 封印），且窗口起止与"被观测调用"绑定到**同一个** execution scope | "没看到越界"只是 oracle 的自述，不是证据；G1-S1 的第 2 条负控（"没有发生 open"）无法成立 | M7-B 的第一项（见 §4） |
| **P3. 旧路径可运行回归基线** | 每个将被替换的旧工具族有一个**能跑**的场景集，落 `verdict` 到 `.tsv`；基线自身有"故意改语义必须变红"的负控 | 没有基线就没有"等价"的定义，[04](./04-FIRST-SLICES-G0-G1.md) R-S3.1 的退役禁令无法执行 | G1-S4（必须先于任何退役） |

**P2 落地后的形态**：窗口归 World Factory 所有（`tests/world-factory/lib/m7b1-observation-contract.mjs`），hosted 判据是 `M7B1-ARM inside-authorized verdict=SATISFIED`，伪造的窗口/见证/身份分别以 `WITNESS_NOT_SEALED`/`WINDOW_NOT_CLOSED`/`IDENTITY_MISMATCH` 被拒——即"窗口里没有出现 X"现在是**可被判否**的陈述，而不是 oracle 自述。仍未覆盖：process/PTY/network 三个域（`instrumented:false` 仍在），所以 P2 只解 FS 这一格。

**为什么 P2 是前置而不是"以后补"**：UTE-20（Evidence-Bounded Release Claims）要求"允许 + 禁止的真实效果"，而"禁止"侧的证明形态就是"我拥有一个可信观测窗口，窗口里没有出现 X"。当前 M7-A 的证据已经点明这条边界：五臂覆盖的是**文件效果与 bash 可达性**，process/PTY/network 仍 `instrumented:false`；provenance 封印是否能跨 JSON 重放**未验证**（`SESSION_ROUTER_LOG:8928/9000`）。在 FS 域上把窗口做成可信的，是"最小"的那一刀。

## 3. 退役顺序（与 [04](./04-FIRST-SLICES-G0-G1.md) R-S3.1 同一条规则，这里写全）

1. 旧族在 G1-S4 有基线（P3）。
2. 新路径在该族上有等价证据，或语义变化**已记录 + 已批准**。
3. 真实负控在位（不是"返回文案对"，是"效果真的没发生 / 真的被拒"）。
4. 退役 PR 必须展示：基线**退役前 vs 退役后**逐行相同（除已批准的变化行）。
5. FS 的通过**不外推**到 Bash/PTC/PTY：四个效果域各自有一条独立的第 2 步。

**反向禁令**：不得为"让新路径看起来等价"而删旧场景、放宽负控、或把"未观测到"写成"未发生"。

## 4. M7-B1 的准确定义与命名说明

本 memo 用 **M7-B1** 指 M7-B 里**第一个可独立验收的子项**：

> **最小可信 FS 窗口**：World Factory 自己拥有观测窗口（不是被测套件自建），窗口在**启动前**建立、在**终止后**关闭，携带 `world`/`pid`/`lease` 身份，其 provenance 能跨序列化（JSON）存活并可被第三方复核；窗口记录与某次 `ExecutionId` 的 dispatch/settle 绑定。

**命名披露（2026-11-18 更新）**：本 memo 写初稿时，`M7-B1` 这个编号**不是**仓库现有标识符——仓库里只有 "M7-B"（process/PTY/network 观测面）与两条候选条目；本文把"可信观测窗口"定名为 M7-B1、把"per-call decision 引用 / execution 级 oracle 规则"定名为 M7-B2。**该编号此后被采纳并落地**：#786 `f46bcdd29` 的文件名就是 `tests/world-factory/lib/m7b1-observation-contract.mjs` 与 `tests/world-factory/m7b1-observation-window.test.mjs`。也就是说本节的命名不再只是提案，**编号已进入代码**；定义仍以本节为准。
来源：`SESSION_ROUTER_LOG.md:8928`（provenance 封印不证明窗口身份，列为 M7-B 候选）、`:8930`（oracle 决策是 contract 级而非 call 级，M7-B 两条出路）、`:9000`（三域仍 `instrumented:false`）；落地形态与 hosted 判据见 `docs/plans/memo/m7b1-b4-20261116/README.md`。

## 5. 一张"能不能开工"的判断表

| 问题 | 答案 |
|---|---|
| B5–B9 没收完，能开 G1-S1 吗？ | **能**。收集数与 rc.5 执行能力无关；只要 `--max-uncollected 48` 不增长。 |
| host build cache 没修，能开 G0-S2 吗？ | **能**。pin 不信任 runner 构建；证据靠发布包运输 + receipt。 |
| census 还是 761 s，能开 G1-S3 吗？ | **能**。761 s 是预算内基线，不是 G1 的门。 |
| L3 eval 没有，能宣布 FS 受限吗？ | **不能**——但不是因为 eval，而是因为 P2（可信窗口）与逐域负控。 |
| v0.1.6 冻结没核实，能开 G1 吗？ | **能开工程切片**；**不能**做 Authority Migration（把 UTE 写成合同）。 |
| 旧族"看起来没人用了"，能先退役吗？ | **不能**。P3 基线 + 等价或已批准语义变化，二者缺一不可。 |
| FS 负控全绿，能说 Bash 也受限吗？ | **不能**。四个效果域分开证；rc.5 目前只有 filesystem 域被观测。 |

---

**文档导航**：[本目录索引](./README.md) · [01 基线刷新](./01-BASELINE-REFRESH.md) · [02 接口差量](./02-INTERFACE-DELTA-RC3-RC5.md) · [03 三条裁决](./03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md) · [04 首批纵切](./04-FIRST-SLICES-G0-G1.md) · [05 范围围栏](./05-SCOPE-FENCE.md) · [06 待主 Agent 执行的补丁](./06-PROPOSED-ACTIVE-PLAN-PATCH.md)
