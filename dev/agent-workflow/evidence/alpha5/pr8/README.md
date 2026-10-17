# evidence/alpha5/pr8 — PR8 负例 runner 准备件（Lane: alpha5-pr8-runner writer）

> **状态：RUNNER_SKELETON_CANDIDATE / DORMANT。** 本目录把 PR8 验收矩阵从"文档行"推进到**可执行 runner 骨架**：
> 机检矩阵清单 + 负例 runner（三态 + REQUIRES-LIVE-WIRING）+ 自跑套件。
> 一切观测均为 **fixture/记录级**；本目录任何 PASS 都**不构成**行验收、整链验收或 SUPPORTED
> （INTERFACES-v1 集成规则；review-LaneG 投机通过条件①）。writer = qwen3.8-flash-next（模型/harness 分列）。

## 文件

| 文件 | 性质 |
| --- | --- |
| [matrix-machine.json](./matrix-machine.json) | 机检矩阵清单：32 行与 doc 矩阵（`docs/plans/memo/alpha5-tool-io-governance/pr8-accept/acceptance-matrix.json` @origin/master d69bfc4b）双向 1:1；每行 `id→criterion→evidence_level(E/D/UR/U)→automatable→hooks / live_gate_basis`；`final_declaration` 恒 null |
| [runner/lib.mjs](./runner/lib.mjs) | 挂钩实现：`fixture-surface`（既有断言网锚点观测）、`recorded-evidence`（在册 runs/records 解析）、`kit-rerun`（in-process 钉定 registry kit，前置不齐 ⇒ NOT_RUN 拒绝伪造）、`p4t6-readonly-scan`（只读查询）；结构 lint；措辞 lint（G-5 风格含引注 allowlist）；**final_declaration 双代码位**（`deriveFinalDeclaration` 台账非 ALL-CLOSED ⇒ 恒 null + `assertMachineFinalDeclarations` 矩阵内非空声明即红） |
| [runner/run-pr8-negative.mjs](./runner/run-pr8-negative.mjs) | CLI：逐行三态 PASS/FAIL/NOT_RUN + REQUIRES-LIVE-WIRING（引用 LIVE-GATED 依据原文）+ 分布 + 对照臂（ghost-anchor 必须被抓住，否则 RUNNER-BLIND 判红） |
| [runner/pr8-runner-self.test.mjs](./runner/pr8-runner-self.test.mjs) | 新套件自跑（`node --test --test-concurrency=1`，等价 --maxWorkers=1）：对应关系 lint、词汇封闭、G-a 17:52Z 引用/17:02 回填句式禁、G-g 分级引用+禁则、三态逻辑、final_declaration 代码位、分布反升格 |
| [runner/runs/](./runner/runs/) | RED-first 原文（self-RED-first.log=套件先于实现的红；RED-first-matrix-run.log/json=首轮真实红：措辞 lint 抓出自身引注误报，随后修复）、kit 首跑 FATAL 原文（kit-attempt-verbatim.log）、最终分布（final-matrix-run.log/.human.log/.json）、self-GREEN.log（16/16） |

## 判据语义与裁决引用（不回填、不代关）

- **G-a**：取消范围语义一律引 `dev/agent-workflow/PENDING-GATES.md:14`（origin/alpha5-pr1r-followup cc47fb18）用户裁决 **2026-10-16 17:52Z** 原文（要点入 `matrix-machine.json _meta.ga_ruling.quote`，含"不回填为 17:02 合并时已批准"边界）；`ga_semantics` 行由 lint 强制引 17:52Z 并禁 17:02 回填句式。
- **G-g**：静默已订阅通道相关行（M-06/M-12/M-14）判据引 `g-g-support-contract.md` §2.2 分级（@origin/alpha5-pr1r-followup 98ddbaa9；E1/D3/UR1/U4，硬缺口 P4/P6）；该配置恒 **UNSUPPORTED/待证**；措辞 lint 禁 `fail-closed 已证/proven`、"已验收/已合规"、"暴露恰为一次调用"（引注/禁则转述走 allowlist）。P9=UR 只读作"拒绝姿态有证"。
- **G-d**：各 lane 集成确认未开始 ⇒ 凡需 live 装配的行输出 **REQUIRES-LIVE-WIRING** + LIVE-GATED 依据（G-d 行 / doc 行 current_status / registry `run:null` / LIVE-WIRING-GATED=PR3 后），不产通过性结论。

## 本轮环境事实（NOT_RUN 的来源，如实）

- 一次性 worktree，无 `tests/deepseek-harness-test-use`（gitignored pristine 运行时，且需 0.2.0-rc.2 构建）⇒ kit-rerun / pinned 面 grep = NOT_RUN（原文 FATAL 在 runs/）；
- PENDING-GATES.md 正本在 origin/alpha5-pr1r-followup，不在本 ref 树 ⇒ 台账状态 = **ABSENT-AS-OPEN**（fail-closed），final_declaration 由此恒 null；
- 未复跑 CI（无 node_modules）⇒ 本 runner 观察上限 = **D**（E 只作他处分级引注，见 `_meta.evidence_level_vocabulary.observation_ceiling`）。

## 运行

```bash
node dev/agent-workflow/evidence/alpha5/pr8/runner/run-pr8-negative.mjs
node --test --test-concurrency=1 dev/agent-workflow/evidence/alpha5/pr8/runner/pr8-runner-self.test.mjs
```

零端口（3497 前缀预留未用）；零 DSH_HOME 世界（`tests/homes/a5p8r-*` 预留未创建，故无清理）；共用文件（根 registry/live glue/tsconfig/barrel/scanner/packages/tests/kits、p4t6 账本）零触碰——新增全部在本 evidence 目录内，p4t6 census 无增项（scanner 只扫 packages/**），无需向集成 owner 报 ledger；若 PR8 正式轮把套件挂入 packages/** 测试网，届时由集成 owner 处理 p4t6 pin。

## 与 PENDING-GATES 的联动（收口路径，不由本件执行）

矩阵行 final_declaration 解锁 = ①`dev/agent-workflow/PENDING-GATES.md` 进入仓内且全部行 closed（runner 解析）+ ②对应行在机检矩阵中由 PR8 writer/集成 owner 经 `pending_update_template` 预留字段显式登记候选值 + ③90-final-matrix-gate 复跑。三闸缺一 ⇒ 输出 null（代码位强制，不靠自觉）。
