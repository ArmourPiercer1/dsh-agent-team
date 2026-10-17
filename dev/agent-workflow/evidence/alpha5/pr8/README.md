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

---

## Scope-3a（正式轮第一轮，2026-10-16 夜）增补

**N1（final_declaration 缺键不放行）**：机检矩阵行缺键 ⇒ `assertMachineFinalDeclarations` 显式判红（undefined≠null 声明）；doc 候选矩阵 SUP-01..18 无该键 ⇒ runner **逐行显式点名**（`DOC-MISSING-KEY`×18，见 final-matrix-run.log），不判红但**不再按 undefined 静默放行**——doc 侧补键属上游/集成 owner 转交项（Lane G 候选文档，本 lane 不代改）；doc 行显式非 null 声明 ⇒ 红。**N2**：M-13 依据串已改 registry 真实 id `60-web-jobs-mcp-domain`，并新增自跑判据（矩阵内 `suite NN-…` 引用必须唯一命中 registry.mjs 真实 id）。**N4**：红/绿分提交——RED 提交 `ecc5b6f1`（推送前因承接 reviewer 直推的审查件 31f71b96 做本地 rebase，SHA 由 a82f474d 重编；四条新判据先行红，runs/scope3a-RED-self.log 18/22）与修复提交分离。

**矩阵实例化第一轮**：本机按 TEST_METHODS §2 链构建 pristine 0.2.0-rc.2 运行时（clone --local --no-hardlinks 自只读 baseline + `pnpm install --ignore-scripts --frozen-lockfile --store-dir <workspace store>` + `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build`；test-use porcelain=0 @639ed01539；构建在 gitignored 运行时世界，仓库跟踪树零影响）⇒ 三条 NOT_RUN 全部升级：**M-06** kit a5p1r 重跑 **13/13 PASS exit 0**（master 13 判据版；18 判据 probe 版在 origin/alpha5-g-g-probes 未合 master，本腿跑 master 版如实注明；原文 runs/kit-rerun-built/）；**M-11/SUP-08** pinned Job 面 grep 实挂：`job_output`/`job_kill`（tool-bash 面）+ `job_list`（api/job-controller 面）+ `absent_anchors: job_start`（全树零命中机检）。三态新分布 **PASS=27 / FAIL=0 / NOT_RUN=0 / REQUIRES-LIVE-WIRING=5**。kit 重跑=手动重跑型 D 观察（fixture/记录级），非行验收。

**G-g 分级引用升级**（矩阵 M-06/M-12/M-14 三行 + `_meta.g_g_contract`）：基线快照 98ddbaa9 §2.2（E1/D3/UR1/U4）保留，另引 `review-G-g-probes.md` @origin/alpha5-g-g-probes `bbaf45de` 后状态——**P4/P6 达 D**（kit check() 级判据；unit 腿 E 形状：P2/P3/P6 完整谓词入常跑网）、kit-only 判据上限 D（ENFORCE 级对其不可达，§2.1 明文）、P9=UR 不变、**G-6/G-7 仍 LIVE-GATED=PR3 后维持 U**、G-g 行按 P8 保持开放至落文 owner；probe 件未合 master ⇒ 本 ref 观测面以 master 为准。自跑套件强制三行含 `review-G-g-probes.md` 引注且保持禁则（fail-closed 已证等仍红）。

**skills 候选**：[skills-candidate-D2.md](./skills-candidate-D2.md) —— D-2 六要素（17:52Z 原文边界/触发与影响集合/取消≠终止/无回滚/插件卸载三区别/D-1 延期与恢复条件）的 `team-leader-operations` SKILL 增补段落候选 + 九条验收清单；**只写本 evidence 文件，不触碰 `.agents/**`**；收尾轮执行=4d990c89、独立核验=4dac3d04（PENDING-GATES.md:24 17:54Z 指派）。

**Scope-3a 门禁实录**：token 扫描 0 真实凭据；porcelain 净（新增全在本 evidence 目录 + gitignored 运行时世界）；零端口零世界不变（kit in-process）；共用文件零触碰不变；p4t6 只读查询零隔离区外命中不变（M-14 腿在 27 PASS 内）。

## Fold 轮（alpha5-fold-ins，2026-10-17）：N1 doc 侧补键转交项落地

- 用户指令把 N1 转交项落地到 doc 候选矩阵：`acceptance-matrix.json` SUP-01..18 各行行尾补 **`"final_declaration": null`**（与机检矩阵逐行对齐；全 32 行显式 null，无任何非空声明——解锁三闸语义不变，见上节）。
- 自跑判据同步 RED-first：N1 doc 键测试改为"真实 doc 矩阵缺键点名=0 + 机制对照臂（剥 SUP 行键 ⇒ 点名恰回 18 条，仪器非空转）+ doc 行显式非 null 仍判红"；RED=`runs/fold-doc-matrix-RED-self.log`（22 tests / 21 pass / 1 fail，红在补齐断言），GREEN=`runs/fold-doc-matrix-GREEN-self.log`（22/22）。
- 对应 lint 证明（`run-pr8-negative.mjs`，EXIT=0）：`runs/fold-doc-matrix-negative-run.log` — **结构 lint OK，DOC-MISSING-KEY 缺键=0 行**（折叠前同段 =18，final-matrix-run.log），final_declaration 全 null。分布 PASS=24 / FAIL=0 / NOT_RUN=3 / RLW=5：三条 NOT_RUN（M-06/M-11/SUP-08）是本 worktree 缺 gitignored test-use 运行时的既有 fail-closed 腿（钩内原文自证"全新 worktree 缺运行时 ⇒ NOT_RUN 拒伪造 PASS"；27/0 旧分布出自带构建运行时的正式轮 worktree），与本次补键无关——补键只作用于 doc 侧点名段，逐行三态观测未触碰。
- 触碰面：doc 矩阵（docs/plans/memo/…/pr8-accept/，N1 转交项指定文件）+ 本目录测试件与 runs/ 三份 fold 日志；tsconfig/barrel/registry/scanner 零触碰；p4t6 无新 packages/**/test 文件 ⇒ 账本无入账。

## W8 准备轮（alpha5-wire-pr8prep，基线 master@62cc2b87）：probe 骨架 + pending_probe 挂接 + 转态自锁

IF-7 适用（WIRING-PHASE-PLAN @origin/alpha5-decision-pack-20261016 a4f7f4fc）：REQUIRES-LIVE 禁为 W8 阶段终态——要么 LIVE 要么 PROBE-GATED+最小复现。**本轮=准备层，不执行 live**（正式 W8 stacked 于 W4/W5/W7 合并后 master）。

- **① probe 骨架**：[probes/](./probes/) 五个可执行脚本（M-04/05/08/09/13），对 W4/W5/W7 冻结装配面（IF-1 plugin row+ctx.agents+barrels / IF-6 事件错误名）编码断言；每行依赖声明=哪个 lane 的哪个观测面（`DEPEND` 输出+矩阵 `pending_probe.depends_on`）。VERDICT 词表封闭 LIVE/PROBE-GATED/NOT-RUN-READY/FAIL（**无 PASS 值**）；当前装配锚点=0 ⇒ 运行即 `NOT-RUN-READY exit 3` + `MISSING-ASSEMBLY` 逐条缺装配原因（原文 runs：`probes/runs/w8prep-M-0x-NOT-RUN-READY.log`）。锚点契约=probe-lib `ASSEMBLY_ANCHORS`（agent-bindings 出现 ConfinedProcessProvider/a5p5/jobs-gateway + registry 套件 run≠null；lane 别名暴露须回报协调者）。LIVE 只能在装配锚点在场 + live receipt（`probes/receipts/<row>.receipt.json`，正式轮产出）全断言 SATISFIED + `assembly_anchors_verified=true` + evidence_refs 非空时得出。
- **② runner 挂接预配**：matrix-machine.json 5 行 + `_meta.probe_transition`（词表 [LIVE, PROBE-GATED]+双代码位规则）；doc 矩阵 5 行同步 `pending_probe` 指针（lintCorrespondence 现强制 doc 同步，未同步=红）。lint 绿=runs/w8prep-negative-run.log（EXIT=0，分布 PASS=24/FAIL=0/NOT_RUN=3/RLW=5 与 fold 轮恒等，无漂移）。
- **④ 转态自锁**：pending_probe 行 runner 输出只能取 LIVE/PROBE-GATED，**PASS 无证据路径不存在**——代码位一 `assertProbeRegistrations`（提交时：automatable=false+无 hooks+词表+禁 PASS 声明+lane 闭集+doc 同步，违例=lint 红）；代码位二 `deriveProbeTransition`/`evaluateRow`（运行期：attempt PASS/越词表=VIOLATION⇒FAIL 判红；LIVE 缺证据⇒降级 PROBE-GATED；NOT-RUN-READY/FAIL⇒PROBE-GATED+repro）。分布 LIVE/PROBE-GATED 与 PASS 分桶。违例自测=套件 prep 节 6 判据 + runs/w8prep-violation-selftest-fixture.json 实跑 runs/w8prep-violation-selftest-full.log（伪造 PASS 尝试⇒FAIL+exit 2；伪造无证据 LIVE⇒PROBE-GATED；带证据 LIVE⇒LIVE 但 PASS 计数不动）。
- **③ 差距检查表**：[vnext-migration-gap-checklist.md](./vnext-migration-gap-checklist.md)——对照 docs/migration（只读）+ 冻结基线语义 + ACCEPTANCE §2 五 RLW 缺项，C-01..C-13 差距行（差距≠缺陷，逐行证据引用）+ 五行×差距映射与转态上限。
- **门禁**：RED-first（runs/w8prep-RED-self.log 23P/5F=自锁判据先红）→ GREEN（runs/w8prep-GREEN-self.log **28/28**，EXIT=0）；负例 runner EXIT=0；token 0；porcelain 净；零端口零世界（probe/自测=纯只读+子进程只读）；IF-5 全共享文件零触碰（新增全在本目录 + doc 矩阵 pending_probe 同步=N1 先例的指定转交面）。kit-rerun/p4t6 腿语义不变。
