# vNext 实施 × legacy reuse 差距检查表（vnext-migration-gap-checklist）

- 轮次 = **W8 准备轮（alpha5-wire-pr8prep）**，基线 = master@`62cc2b87`；对照面 = `docs/migration/legacy-behavior-inventory.md` + `docs/migration/reuse-map.md`（只读）+ 20260829 冻结基线语义（AGENTS 红线/权威序）+ ALPHA5-ACCEPTANCE-STATUS.md §2 五 RLW 行缺项 + WIRING-PHASE-PLAN.md（a4f7f4fc）IF-1/IF-6。
- 口径：**差距（gap）≠ 缺陷（defect）**。本表每一行只陈述"当前实施相对 legacy reuse 决策/冻结基线语义缺什么、为何这是计划内状态而非缺陷"；证据引用一律 file/行/在册件，禁凭记忆。本表**零代码断言、零状态转换**；行级转态只走 matrix `pending_probe` + runner 双代码位（IF-7）。
- 复用四级定义 = inventory 头注（开发计划 §7：A 直接移植 / B 移植算法重写边界 / C 仅行为参考 / D 丢弃）；对象模型唯一权威 = Architecture 冻结文档（vNext 无 Team SessionEvents）。

## 1. 差距行（G-x 为检查表编号，非 PENDING-GATES 编号）

| # | 面 | legacy reuse 侧（docs/migration 决策） | 冻结基线/计划语义 | vNext 实施现状（master@62cc2b87） | 差距（≠缺陷的理由） | 证据引用 |
|---|---|---|---|---|---|---|
| C-01 | Team 协作工具族（delegate/send-message/control/progress/list） | reuse-map §1.5：五工具 schema/UX/诊断 = **B 级移植**（G3/G2 腿 D） | 目标传输=vNext TeamRuntime；禁 SessionEvent 权威（§3 红线2） | vNext 自有工具面已落（facade 映射 `packages/tools/src/tools.ts:10-14`），词表按 vNext 重定义（team_delegate 等），非旧词照抄 | 差距=行级验收未发（00-guard-dispatch `run:null`）；≠缺陷：B 级"重写边界"允许词表重定义，PR8 正式轮挂断言即可 | reuse-map.md:52-63,153-162；registry.mjs `00-guard-dispatch run:null`；pr8/README §N1 |
| C-02 | Team SessionEvent 词汇 | inventory §0 **G2 = 丢弃面**；reuse-map §3 红线2 禁作 durable 权威 | AGENTS 红线：vNext 无 Team SessionEvents | 零词表；p4t6 隔离区外零命中（runner `runP4t6ReadonlyScan` 常跑 PASS） | 无差距（有意丢弃+机检封禁，边界行入表防误报"缺口"） | legacy-behavior-inventory.md:10-22；reuse-map.md:153-162；pr8/runner/lib.mjs（QUARANTINE 集） |
| C-03 | 运行时身份 | inventory §0 **G1**（memberId 作 runtime identity=错误假设） | 对象模型冻结：instanceId/templateId/childSessionId 三分 | vNext 按三分身份实施（contracts/runtime）；jobs JobOwner=member scope（C-GW） | 无差距（D+重写完成）；≠缺陷 | legacy-behavior-inventory.md:16；INTERFACES-v1 C-GW/C-BIND |
| C-04 | **M-04 str_replace_editor** | **不在 legacy team reuse 范围**（fork 内为宿主内置工具，docs/migration 无行）→ vNext 无 B 级移植义务 | 计划=Alpha.5 治理候选行（S0 明言候选未测）；OpenAtPort 前禁发布任意树 | vNext 树实现面 0（`grep -rl str_replace_editor packages --include=*.ts` 非 dist=0 命中）；观测面缺=无装配；`ARBITRARY_TREE_PROFILE_PUBLISHED=false` 常量钉 | 差距=子命令 I/O 映射无任何可挂钩断言（矩阵行 criterion 原文）；≠缺陷：S0 候选态+OpenAtPort gate+计划归 PR0/1/2/3+PR8 阶段 | ALPHA5-ACCEPTANCE-STATUS.md §2-④:49；matrix M-04 行 live_gate_basis；controlled-fs/src/admission-binding.ts:146；probe-M-04 头注 |
| C-05 | **M-05 read_image** | 同上（宿主内置，非 team reuse 面） | 03-fs 未测清单**全链**携带；附件/渲染授权身份须保授权 | 名字仅存在于 contracts 封闭字段集（`packages/domain/blueprint/src/schema.ts`、`authority-envelope/src/authority-envelope.ts`），无治理消费实现 | 差距=全链观测面缺；≠缺陷：治理面=Alpha.5 装配阶段（W4/W5），registry 20 行 run=null 在册 | ALPHA5-ACCEPTANCE-STATUS.md §2-④:50；registry.mjs `20-controlled-fs run:null`；probe-M-05 头注 |
| C-06 | **M-08 run_code(PTC)** | 无 team reuse 行（宿主执行面） | design 无回退律；Strict Profile 启用需 OS 强制实证（D3/D5） | PR6 仅"窄固定 session-Realm 策略"分支（PoC-6a 分支二）；`HARD_PROFILE_ENABLED=false`；provider spawn 零 live 消费者 | 差距=per-call 策略注入的 OS 真实拒绝负控未做+OS 强制面=DORMANT；≠缺陷：S0 只批准窄分支，严格档禁装为登记态（非 UR，记 U 如实） | pr6/SEAM-VERDICTS.md:33；ALPHA5-ACCEPTANCE-STATUS.md §2-①:36-37、§2-④:51；probe-M-08 头注 |
| C-07 | **M-09 lsp** | 无 team reuse 行 | 池键 ⊇ Member+Realm+Provider+Workspace+PolicyGeneration；服务器 OS 读走 Confined | PR6 BOUNDED-DEFER；**公开面无策略输入通道**（池键逐出机制无机检面）；per-Member pid 主问=通过（PoC6b）不足以转 LIVE | 差距=policyGeneration 逐出/重建机制 + 服务器读中介未装配；≠缺陷：S0 不批准上游方案（D-1），HAZARD 有记录级证据在册（SUP-15/18），恢复判据在矩阵 note | pr6/SEAM-VERDICTS.md:59；ALPHA5-ACCEPTANCE-STATUS.md §2-④:52；probe-M-09 A2 注释 |
| C-08 | **M-13 Domain** | 无 team reuse 行（vNext 原生化面） | TeamPermit ∧ DomainPermit 互不覆盖；veto=0 side effects 判据 | jobs-gateway **DORMANT**（题注零生产消费者）；tsconfig/live 装配未落；Domain mock（CAS/联锁）待建；registry 60 行 run=null | 差距=整行结构未跑（s0-not-run-structural）；≠缺陷：S0 明示无 P0 实验腿，计划归 PR7 装配轮（W7）+PR8 | packages/runtime/jobs-gateway/README.md:1,9；WIRING-SURFACE.md:34；registry.mjs `60-web-jobs-mcp-domain run:null`；probe-M-13 头注 |
| C-09 | jobs pinned-host 面 | inventory/reuse-map 不覆盖 pinned host 工具面；语义源=design:72 不杜撰 `job_start` | pinned 事实=0.2.0-rc.2 仅 job_output/job_kill/job_list | absent-anchor `job_start` 全树零命中=机检行（M-11/SUP-08；无构建运行时树=NOT_RUN fail-closed 腿） | 差距=absent 不因 W7 改变（absent 仍如实）；≠缺陷：非缺件，pinned 版本本无此面 | ALPHA5-ACCEPTANCE-STATUS.md §2-③:44；matrix M-11/SUP-08 行 |
| C-10 | OS 强制/provider 装配（M-07/SUP-01..06） | inventory 不覆盖（Alpha.5 新面） | IF-1=plugin row+ctx.agents+dist barrels；CORE=0 | PoC4 六腿 ENFORCE-CONFIRMED=**fixture/子进程级**；spawn 路径零 live 消费者（agent-bindings 零 provider 引用，本轮亲验 grep=0） | 差距=OS 正负控的装配级证据缺；≠缺陷：W4 即此范围；ENFORCE 宣称天花板=ENFORCE-PARTIAL 三缺项在册 | WIRING-SURFACE.md:31；ALPHA5-ACCEPTANCE-STATUS.md §2-①:37、§2-⑤:58 |
| C-11 | search/shell（M-06/M-07） | inventory 不覆盖 | spill 六事件全前缀（IF-6 原名）；spill-id-in-use 复用拒 | Lane-D 三门 GREEN=lane 源级；不入 root vitest/emit/live registry（亲验：live fixtures 零 a5p5 引用） | 差距=真实调用观测（search 结果+spill 生命周期+parity 双腿）缺；≠缺陷：W5 即此范围；判定口径"对 fixture 验证，不宣称整链"在册 | ALPHA5-ACCEPTANCE-STATUS.md §2-②:40；WIRING-SURFACE.md:26-28,31 |
| C-12 | 取消/静默通道 | inventory §1.4 control 域（B 级移植）+ G5 丢弃面 | design §1.5 无回退律；plan:175 Unsupported 须运行时确实拒绝 | 协作式取消+响亮告警 LIVE-CONFIRMED（G-6 19/19×2 / G-7 18/18）；静默永不投递配置 Body 实跑 ⇒ 该配置 UNSUPPORTED 维持；in-process 非 OS 强制 | 差距=对"投递保证/取消保证/静默安全"类宣称 = 受限支持上限（ENFORCE-PARTIAL）；≠缺陷：G-g 证据门 CLOSED 且产品支持≠证据门的措辞已代码化（lint-g-g-wording） | ALPHA5-ACCEPTANCE-STATUS.md §2-⑤:56-59；g-g-probes/GATE-VERDICT.md:42,46-48 |
| C-13 | UI/投影/冷恢复等 P 系列域 | reuse-map §1.6-§1.9（B/C 级）+ client 行 | 冻结 UI 文档 | P 系列已落（本表不复审）；与 Alpha.5 治理面正交 | 无新差距；列示为完整性（W8 五行不依赖这些行的增量） | reuse-map.md:64-115；docs/migration 覆盖自检 §2 |

## 2. 五行 RLW × 差距行映射（W8 正式轮执行序引用）

| RLW 行 | 差距行 | probe（已挂 pending_probe） | 转态上限（无更多证据时） |
|---|---|---|---|
| M-04 | C-04（+C-10/C-11 装配腿） | probes/probe-M-04.mjs（W5 工具面 + W4 执行腿，IF-1/IF-6） | PROBE-GATED（receipt 无据时） |
| M-05 | C-05（+C-10） | probes/probe-M-05.mjs（W5 附件腿 + W4 受控读，IF-1/IF-6） | PROBE-GATED |
| M-08 | C-06（+C-10） | probes/probe-M-08.mjs（W4 OS 强制面，IF-1/IF-6） | PROBE-GATED |
| M-09 | C-07（+C-10） | probes/probe-M-09.mjs（W4 服务进程腿；A2 无公开面数据 ⇒ 恒 PROBE-GATED 直至策略输入通道落地） | PROBE-GATED |
| M-13 | C-08（+C-09） | probes/probe-M-13.mjs（W7 jobs-gateway 面 + Domain mock，IF-1/IF-6） | PROBE-GATED |

**结论**：五行当前全部停 `PREPARED-NOT-RUN-READY`（装配锚点=0，亲验 grep 于 agent-bindings.mjs）；转 LIVE 唯一通道 = W4/W5/W7 装配落地（锚点在场）+ live receipt（evidence_refs + assembly_anchors_verified）——`PASS` 在转态词表外，双代码位封死（矩阵 `_meta.probe_transition`）。差距行 C-04..C-08 的关闭信号即 probe preflight 表逐条转 present；C-06/C-07 额外受 SEAM-VERDICTS 两缺口约束（本表登记，不由准备轮关闭）。

— writer=alpha5-wire-pr8prep（qwen3.8-flash-next；模型/harness 分列）；本表只读对照+本目录新增，零共用文件触碰、零端口、零世界。
