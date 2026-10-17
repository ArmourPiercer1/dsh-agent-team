# JOPS-CAPABILITY-RECHECK — Jobs 能力 = 公开路径核查，非名称核查（W-JOBS-RE）

- writer：W-JOBS-RE（liveness 首报；qwen3.8-flash-next，模型/harness 分列）；基 = `master@aece4f21`，分支 `alpha5-jobs-recheck`，一次性 worktree `.worktrees/a5-jobs-re`。
- 性质：**只读分析 + 本 evidence 文件 + 一份 probe 现场 transcript**；零端口、零 DSH_HOME 世界、`:3080` 未触碰；host `tests/deepseek-harness-test-use` 与共享 baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` 均只读（porcelain 空，前后一致）。
- 触发：用户指正——`job_start` **名称不存在 ≠ Jobs 能力无公开实现路径**；原计划允许 Team Job Gateway（我方 `packages/runtime/jobs-gateway` lane 即计划内实现），且要求先核 host 公开 jobs 服务与既有 bash 后台创建路径。
- 本件不改写任何既有转态：absent-anchor（`job_start`=0 hits）事实**不因本件移动**；M-13 行级转态词表与 PASS 封禁权威仍在机检矩阵 `_meta.probe_transition`（IF-7），本件只给归属判定与装配方案，不实施。

---

## ① 三层区分表

### (a) Host pinned@`639ed01539`（0.2.0-rc.2）公开面 —— jobs 类能力盘点（grep 面全列，逐条 file:行）

**锚点名事实（先声明不动）**：`job_start` 全树 **0 hits**（复现：`grep -rn "job_start" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" <host> | grep -v node_modules | wc -l` → `0`；与 W7 `anchor-host-grep-pre/post.json` hits=0 一致）。**这只是名称缺席，不是能力缺席**——下表 1–7 为同一能力的公开面。

| # | 公开面 | 证据（file:行，host 树内） |
| --- | --- | --- |
| 1 | **能力 seam**：抽象后台任务注册表 `JobRegistry`，cordis 服务位 `ctx.jobs` | `packages/jobs/jobs/src/index.ts:85`（`export abstract class JobRegistry extends Service`）；`:41-45`（`declare module '@deepseek-ai/cordis' { interface Context { jobs: JobRegistry } }`） |
| 2 | **进程内 provider** | `packages/jobs/jobs-local/src/index.ts:128`（`LocalJobRegistry extends JobRegistry`）；`:222`（owner 桶并发上限，引导 `job_kill`） |
| 3 | **模型工具面（名称不同）**：`job_output` / `job_list` / `job_kill` | `packages/jobs/tool-jobs/src/index.ts:311 / :352 / :372`；工具目录机检含此三名：`packages/core/tools/tests/gen-tool-catalog.spec.ts:32`；目录文档：`scripts/gen-tool-catalog.ts:289,301`（bash `requires: [... 'ctx.jobs for run_in_background' ...]`、"collected/stopped through the `job_*` tools"） |
| 4 | **后台创建路径（bash 后台化类，per 生产者工具）** —— 创建动作挂 `run_in_background` 参数，**不是**独立 create 工具 | bash：`packages/shell/tool-bash/src/index.ts:393`（schema）+ `:499-502`（执行/禁用拒）；pwsh：`packages/shell/tool-pwsh/src/index.ts:404,516`；`terminal_send`：`packages/terminal/tool-terminal/src/index.ts:207,251`；workflow：`packages/workflow/tool-workflow/src/index.ts:369,414`；subagent：`packages/subagent/tool-subagent/src/index.ts:421,526` |
| 5 | **公开 jobs 服务（Remote/RPC 面，web-app shipped）**：`ctx.remote.job` 命名空间 = roster 流 + 单 job 输出跟随流 + 人工 kill | `packages/api/job-controller/src/index.ts:59`（`super(ctx,'jobController',{ namespace:'job' })`）、`:75`（list stream）、`:90`（follow/output stream）、`:109`（kill）；装配：`packages/bundle/web-app/cordis.patch.yml:126-127` |
| 6 | **shipped 装配 + 端到端实证** | 装配：`packages/bundle/base/cordis.patch.yml:88-89`（`dsh-jobs-local`）、`:275-276`（`dsh-tool-jobs`）；e2e：`apps/web/tests/shipped-composition.e2e.ts:485-487`（默认目录含 job_*）、`:672`（`it('lets a preset producer reach the background-job registry')`）、`:692,706,720`（真实 `run_in_background`→`job_list`→`job_output` 全链）；`apps/web/tests/background-job-list.e2e.ts`、`apps/web/tests/live-job-stream.e2e.ts`；`apps/cli/tests/web-agent-presets.e2e.ts:266,610` |
| 7 | **相邻 task/schedule 公开面**（jobs 类比面，一并列全） | schedule 四工具：`packages/schedule/schedule/src/tools.ts:417/452/470/493`（`schedule_create/list/delete/update`；Remote 客户端接入 `packages/api/remotes/src/client/index.ts:13`；web profile e2e `apps/cli/tests/profiles/web/tests/schedule-timing.expected.e2e.ts`）；host 原生 experimental 团队工具：`packages/experimental/tool-agent-team/src/index.ts:176/243/290/314/346/361`（`spawn_teammate/wait_agent/team_task_*`，opt-in） |
| 8 | **REST 形态核对** | 无独立 `/api/jobs` HTTP 路由（grep `api/jobs|/jobs` 于 `apps/web/src`、`packages/remote*/src`、`packages/host/src` 非测试 = 0）——host 的 jobs 公开服务形态 = **Remote `job` 命名空间（#5）+ 工具面（#3/#4）+ session 事件投影**，不是 REST 资源。缺 REST ≠ 缺服务 |

**(a) 层结论**：host 公开面存在**完整的 Jobs 能力路径**——seam（#1）→ provider（#2）→ 模型工具（#3）→ 五工具后台创建参数（#4）→ 公开 Remote 服务（#5）→ 默认装配 +  shipped e2e（#6）。唯一缺席的是 `job_start` 这个**名字**；创建语义由 `run_in_background` 承担。**"Jobs 能力无公开路径"在 (a) 层即不成立。**

### (b) 我方 jobs-gateway（计划内 Team Job Gateway）公开装配面现状

| 事实 | 证据 |
| --- | --- |
| lane 在场 + **PUBLIC BARREL**：`createJobsGateway` / `createLeaseWindow` / `classifyDispatchEvent` / `projectJobForViewer` 等导出 | `packages/runtime/jobs-gateway/index.ts`（barrel）；lane README 自述 `DORMANT BY DESIGN` = **默认未接线，非不可接线** |
| **编译面已入仓**：build include 在册（GLUE build-include `@2ff24c5a` 落地），dist 已提交 | `packages/runtime/tsconfig.build.json:22`（`"jobs-gateway"`）；`packages/runtime/dist/packages/runtime/jobs-gateway/*`（tracked）。W7 note 时点的 "lane 不在 tsconfig" GLUE 队列项**已闭合**；kit `tsconfig.lane.json` 退役与 noEmit 全量 typecheck tsconfig.json 增行 = kit-owner/GLUE 残余队列项（不影响装配） |
| **公开装配已证**（W7，已并入 master）：profile-patch seam 挂 plugin row（`inject=['webServer','teamRoot']`，exact routes 经公开 `webServer.register`），row 只经 PUBLIC BARREL 消费 lane，零 lane-source 编辑 | `tests/kits/a5-w7-jobs-wiring/{README.md,a5w7-jobs-plugin.mjs}`；`dev/agent-workflow/evidence/alpha5/wiring/w7/W7-WIRING-NOTE.md`（run-GREEN **22/22** exit 0：两 member 同宿主互不可见 / lease 互斥 `owner-mismatch`+alarm / revocation 邻域安全+身份钉住，LIVE host 真跑）；`review-W7.md` 在册 |
| probe 装配锚点（绑定形 grep）runner **亲验在场** | 本件 ③ 现场 probe 输出：`CHECK face:W7 present (binding-shape grep)`（锚点表 `probe-lib.mjs ASSEMBLY_FACES.W7` = kit plugin row 调用形 + 动态 import 形 + 编译面形） |
| 消费面现状 | lane 自测（`packages/runtime/test/a5p7-*.test.ts`）+ W7 kit；生产消费者仍零（DORMANT，计划内）。**"可装"已由 W7 升级为"装起来能真跑"。** |

### (c) pr8 M-13 各腿（A1..A5）到底要求哪一层

M-13 行 = S0/机检矩阵 `Domain 工具（HPC/RPC/研究状态/设备）`；判据 = `TeamPermit ∧ DomainPermit` 任一方拒不可被另一方覆盖、veto⇒0 side effects、未确定引用 fail-closed、absent-anchor 不制造。A1..A5 = `dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-13.mjs` 编码断言；观测载体 = `probes/receipts/M-13.receipt.json`（缺字段 ⇒ NOT-EXECUTED ⇒ 行保持 PROBE-GATED）。

**本件现场亲跑**（`node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-13.mjs`，transcript 见本目录 `JOPS-CAPABILITY-RECHECK-probe-live.log`）：`VERDICT PROBE-GATED exit=4`；A5 SATISFIED，A1–A4 NOT-EXECUTED。逐腿归属：

| 腿 | 要求语义 | 归属判定 |
| --- | --- | --- |
| **A1** team 拒×domain 允⇒终拒 | Team 拒与 Domain 允的**裁决对合观测**；TeamPermit 源 = gateway admit/admission 拒面（(b) 已有 typed refusal 法，W7 实证 `owner-mismatch`/`duplicate-job`/`gateway-not-active` 形态）；DomainPermit 源 = row-local Domain mock | **可由 (b) 满足**——真缺的不是 seam，是 (b) 之上的 **Domain mock 观测腿**（S0 M-13 行"测试要求"列在册：*Domain mock 联锁（CAS 状态/模拟设备，PR7 测试要求）*）。无 host 面被要求 |
| **A2** domain 拒×team 允⇒终拒（`DOMAIN_DENIED`） | 同上 + 观测错误名用矩阵 `reject_error_candidates` **在册名**（IF-6 不新增名） | **可由 (b) 满足**（同 A1；错误名零新增，走已登记 `DOMAIN_DENIED`） |
| **A3** veto ⇒ 0 side effects | effect-commit 处联锁计数（assembly-ledger），非宣称 | **可由 (b)+mock 满足；(a) 可实化增强**：以 host 公开面为 effect 致动器与零观测面——veto ⇒ 该次执行**从不注册** `ctx.jobs` ⇒ 经公开 `job_list`（#3/#5）亲验零注册；允许对照腿真起 `bash run_in_background` job 再 `job_output` 收，使"0/非0"跨真实进程边界可观测 |
| **A4** 未确定 Domain reference ⇒ typed fail-closed | gateway admit 对 Definition 缺位/漂移 typed 拒（不猜绑定）。W7 已 LIVE 实证同族法：Definition withdrawn ⇒ 邻域安全 cancel-requested、`gateway-not-active` 即时拒新 admit | **可由 (b) 满足**——补的是 mock 引用表观测腿。**非 seam 缺**；host-registry 形 mid-session rebind 面维持 fixture-level PROBE-GATED（W7 disclosure），且 **M-13 不要求该面** |
| **A5** `job_start` 仍 absent | (a) 层事实 + grep 可复现 | **已满足**：现场 probe `ASSERT A5 SATISFIED`（receipt `pinned_host.job_start_present=false`，三条 evidence_refs 经 runner F-1 亲验在册） |

**真缺公开 seam 的腿 = 0 条。** A1–A4 的 NOT-EXECUTED 全部是"观测腿数据源（Domain mock）未建"，属我方 kit 层计划内增量（IF-5 零 shared-file 可容纳）；A5 已在册。最小复现 = 现场重跑 probe（`MINIMAL-REPRO` 行已打印）。

---

## ② M-13 转 LIVE 装配方案（设计，不实施——writer 后续）

**(b) 路径满足 M-13 语义**（其判据本就是 gateway 法 + Domain 联锁，host 无对应物也无需对应物）。具体方案：

1. **载体**：新增兄弟 kit `tests/kits/a5-w7m-m13-domain-veto/`（不动 W7 kit 已审 22/22 基线，保 W8 `w8-w7-green` 复跑面稳定）。直接 load `packages/runtime/dist/.../jobs-gateway`（build include 已在，可免 kit-local 编译）；plugin row 复用 W7 形（`inject=['webServer','teamRoot']` + `webServer.register` exact routes）。
2. **加腿**（对应 probe 断言字段，probe/runner/机检矩阵**零改动**——断言已编码）：
   - row-local **Domain mock**：CAS 版本状态 + 模拟设备联锁 + allow/deny 许可位（确定性输入）；
   - **veto 矩阵四格**：每格 (TeamPermit,DomainPermit) → gateway admit（Team 腿）× mock effect-commit（Domain 腿）→ 记 `veto_matrix[]`（A1/A2 期望行含 `error:"DOMAIN_DENIED"`）；
   - **联锁计数** → `veto_side_effects`（A3；建议同时接 (a) 增强：veto 格亲验 host `job_list` 零注册）；
   - **负控**：未确定引用（Definition 未注册/已撤）→ typed 拒 → `negative_controls[]`（A4）；
   - **anchor grep** 复用（A5 保持亲验）；
   - **receipt emitter**：写 `probes/receipts/M-13.receipt.json` 候选字段 + `evidence_refs`（repo_root 内真实记录，F-1 可亲验）。
3. **量级**：plugin row ~200–260 行 + emitter ~80–120 行 + runner 改编（W7 runner 抄改，端口 3187 族自证空闲，世界 `a5w7m-*`）~120 行 ≈ **0.5–1 writer-日**；`packages/**` 零改动；probe/runner/机检矩阵零改动。
4. **转态链**：kit 全绿 → receipt 字段闭环 → 复跑 probe（全 ASSERT SATISFIED + refs 亲验 ⇒ `LIVE exit=0`）→ 行级 **TRANSITIONED-LIVE 提案**由 W8/集成 owner 按 `_meta.probe_transition` 词表执行（本件不转态）。
5. **(a) bash 后台路径可覆盖的腿**：A3（veto⇒host 公开 jobs 面零注册 + 允许腿真起真收）为最直接；A2 的"team 允"对照腿亦可用 `bash run_in_background`→`job_output` 作真实执行对照。A1/A2 裁决本体与 A4 不依赖 (a)。

---

## ③ 一句话结论

**Jobs 能力 = 「名称不同 + 计划内路径在场 + 个别观测腿待建」，不是「完全无路径」**：host 公开面有完整 jobs 能力（`ctx.jobs` seam + `job_output/job_list/job_kill` 工具 + 五工具 `run_in_background` 后台创建 + web-app `ctx.remote.job` 公开服务，逐条 file:行在上），`job_start` 之名确不存在（absent-anchor 仍如实）；pr8 M-13 五腿 A1–A4 均可由计划内 (b) jobs-gateway 公开装配面（W7 已证可装且 22/22 真跑）加 row-local Domain mock 观测腿满足、A5 已满足，**"真缺 host 公开 seam"的腿 = 0**。

## 声称口径（不拉伸）

本件为**盘点+归属判定+方案设计**：不构成 M-13 行验收、不构成 (b) 面新观测（W7 既有观测按原口径引）；probe 现场跑仅证"当前态=PROBE-GATED、A5 已闭环、装配锚点在场"；host 树 porcelain 空前后一致（只读）；共用文件零触碰（新增仅本目录 2 文件）。

## 复现

```bash
# ③ 现场 verdict（零端口、纯只读）
node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-13.mjs        # → PROBE-GATED exit 4
# (a) 名缺席复现（HOST = 本 worktree 的 tests/deepseek-harness-test-use 克隆，或只读
# 共享 baseline /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness，同 @639ed01539）
grep -rn "job_start" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" \
  "$HOST" | grep -v node_modules | wc -l                                   # → 0
# (a) 公开面在场复现（抽三条）
sed -n '311p;352p;372p'  "$HOST/packages/jobs/tool-jobs/src/index.ts"
sed -n '59p;75p;109p'    "$HOST/packages/api/job-controller/src/index.ts"
sed -n '88,89p;275,276p' "$HOST/packages/bundle/base/cordis.patch.yml"
```
