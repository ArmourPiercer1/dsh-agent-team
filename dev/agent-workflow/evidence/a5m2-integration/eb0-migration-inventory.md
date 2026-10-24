# EB0 有界协调清单（中心，root-01:54 令"沿 handover 在现树安排有界工作"；零新树/零 Host/零 checker）

依据正本（只读引用，不复制）：`.worktrees/eb-e0-e1/dev/agent-workflow/evidence/EB-E0-E1/handover-final-20261023.md`（7,954 B @10-23）+ 同目录 `baseline-inventory.md`、`ci-prgate-f44e-to-ff1f58.log`、controls/contracts 等运行日志。

## 1) 唯一消费入口迁移清单（一处 owner/path switch）
| 项 | 内容 |
|---|---|
| 旧唯一消费入口 | `dev/agent-workflow/graph.yaml#current_contract`（现状仍为唯一入口，未动） |
| 目标 | 将唯一消费入口移至生成视图 `current-state.json`（生成后**只读**；生成器 `scripts/doc-checks.mjs` 含 specificity-based owner map，`doc-ownership.yaml` 为源） |
| 切换条文 | PR #361 execution-plan :56；**切换 commit 必须引用其候选 SHA** |
| owner/窗口 | 共享消费入口=**root 协调窗口专属**（root 已承诺不打扰 Alpha.5 的窗口）+ Workflow/Doc owner 对"切什么"的决定；中心**只备清单不抢跑** |
| 前置（可观测） | **未验证（root 01:56 纠正，撤销此前"已证等价"表述）**：handover 实测原文=并行相 `not_started_requires_coordination`；其"两态不可能观测性分歧"论据的根据是"生成视图**按设计无消费者**"（handover :86）——这是**非消费性论证，不是对账运行**；无 sourceSHA/run/比较结果类工件可引。Plan :53 要求并行相先行且以"旧/current 对账"为验收——**对账未做，清单不据以允许切换**；本清单只备方案。图 `current_contract` 仍为唯一权威、生成视图语义边界（derived view 只读镜像）按 handover 原文核。 |

## 2) EB0 实际基线（仅用已有日志，unknowns 显式）
- CI 基线：PR362 `9d8e24f9` 官方三 workflow 全 success；census **40048544434**（root 01:52 实报）。
- 本地电池基线：13F/5927P @ a23ad83e3 快照（记录性，非前置）；lane 993/993 @ G3A 候选树（cf8 实测）。
- 容量基线：见 lane-status-matrix 01:2x–01:5x 账（两次 allocated 汇总+df；来源未知口径维持）。
- unknowns（不粉饰）：EB0 完整"实际基线"清单仍以 eb-e0-e1 侧 `baseline-inventory.md` 为源；其 owner 仍在树内（CI 修复等待+迁移 handover），中心不代跑。

## 3) Freeze 条件（照 handover，不软化）
切换前 graph.yaml 保持唯一消费；切换后生成视图只读；任何"per-checkout AGENTS.md 差异"=基线事实不覆盖；合流照常比对。

## 4) 本批收据（root 01:54 指定项，随此证据批，非状态单推）
- int tip 完整 SHA：**`d266aeef0f37176a9b19767a702c018d8ca1ed29`**
- G5 臂实际新增源（非 6002 表，臂独立候核）：lane **`6aa445d2306a52b35c4919ca5e21f19de85de3b7`**（feat/a5m2-wire-g5-arm；原 feat/a5m2-wire-g5 历史不 FF 未 force，新分支承载）；int pick=**`509dbc982`**。范围=bindings G5 块五处+host.ts 懒访问器+新 spec 10 腿；**6002 表（ced9e7dbb）已窄签，臂未签需独立核**。
- "全绿"对应的具体定向 RC（全部本窗实测，NOT_RUN 不洗绿）：
  - wire+supply **38/38 RC0** @d266aeef0；union-c1+g5-arm+assembly **25/25 RC0**；去重批 union+g5+g3-wiring **31/31 RC0**；glue 36 placements+bindings/supply 镜像 cmp 等值；node --check 0。
  - **未跑/未绿如实**：全包 tsc 未跑（lane owner 报"我方文件 0、全包 79–86=他人既有基线"，中心不转绿）；full battery、build 漂移门 D、一切 live/Host 腿、e78 g2Web 真实 enabled 执行腿（NOT_RUN）、e78 (b) B-WEB 表+纵切（下一刀）——均悬账。
- 8722 环境披露入账：g5 树 test-use 曾缺（迁移缺口），owner 以 clone --shared+offline install 恢复（表观 2.4G）——违 01:01 零复制令之事实如实呈根，候裁。
