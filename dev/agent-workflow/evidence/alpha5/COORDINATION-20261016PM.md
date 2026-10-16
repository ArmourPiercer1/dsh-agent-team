# Alpha.5 执行协调台账（coordinator-maintained，随阶段更新）

基线：origin/master = `b6c99de2fa5c9b5bd8ba0cdfa698a2fbc0d510f0`（PR250 squash `94eeecf1` + PR249 squash `b6c99de2`；用户授权 2026-10-16 04:36Z 进入实施）。
权威：post-poc-technical-design.md（技术细节唯一引用）→ ADR（裁决）→ architecture §14 → S0/PR0–PR8 计划；PoC 证据 = dev/agent-workflow/evidence/alpha5-adapter-p0/（不可篡改）。
纪律：CORE PATCH BUDGET=0；1 阶段=1 branch+1 worktree+1 writer；fail-closed；baseline no-new-red；安全/权限交付需独立 qwen reviewer（≠实现者）定向复核固定 SHA；发布/推历史前扫全新增历史、token 采集即脱敏；不触 :3080；端口 3180–3186/3491–3500；模型全员 qwen3.8-flash-next。

## 合并授权边界（用户 2026-10-16 补充裁定）
- 本轮明确合并授权对象=仅 PR249（已合并）。后续功能 PR：**开发/提交/CI/审查/stacked branch 推进均授权**；**合并节奏=到首个功能 PR Gate 满足时回报用户核验，由用户定合并方式**；不得把"进入实施"扩大为任意自动合并。
- 再确认：PR0 零生产行为变更+Blueprint v3 封闭；PR1 验收必须把 H6 `dynRan=true` 变为真实 typed deny（KIT 断言可更新但 PoC 原始记录保留）；PR3/PR4 仅 PR2 依赖+PR0 接口冻结后可并行。

## 文档收口清单（最终一次修，勿开 minor 循环）
- [ ] S0 矩阵：M3 真正补 SUP-17 的 R1 链接；M2 归因修正落到 D-1 实际行；SUP-16 注记并入单元格内（当前被加成多余表格单元格，需保持表格式合法）；修后对**实际最终 SHA** 做 delta 核验（不得以 5f97b05b 审查冒充最终头复核）。
- [ ] PR0 收口：MINOR-1 level↔evidence 交叉律（enforced+null 机制可过 schema）→ **PR2 冻结前裁决清单**；MINOR-2 清理 writer worktree 残留 .pr-body.md（runs/ 已有在册副本）。
- [ ] **PR2 冻结前必闭（用户 05:4xZ 指令，无需新架构裁决）**：(i) 可信 clock 输入必须验证有限值——NaN/±∞ 为 typed fail-closed（body=0），明确负责层（PR2 Admission）+测试；现行 expiry strict `>` 保留；PR0 的非有限 now 测试仅为缺陷/前置记录，非推荐契约。(ii) assurance 运行时校验：level 不得单独兑现——PR4 必须以真实 probe 的 evidence/realmId/trustRoot 校验先于 hard-profile 执行（schema 可记录 enforced+null ≠ 运行时可接受）。
- [ ] CI 事实：pr-gate/census 触发=PR-to-master/push-master；**stacked PR 的 CI=NOT_RUN**（#252 check-runs=0 实证）。合并序内首个进 master 的 PR 触发补验；汇报中禁止以他 PR 绿声称本 PR 绿。
- [ ] PR1 最终头必须同步 PR0 修复栈（至 cd13f781 之上）并重跑目标测试。
- [ ] 域全量既有 t2-blueprint-hash 即败（v3 漂移，base 同败，a4-pr7 遗留）→ 独立债务处置项，勿并入功能 PR。
- 状态注：PR #251 CI 双绿 @96ea3cad（runs 38852453174/38852453173）；合并授权已向用户询问待回复；stacked 开发继续。
- PR0 交付要求：精确 SHA+代码/测试路径+实跑证据+独立 review；用户将对授权代数与契约测试做抽查。

## 合并/CI 补验顺序（用户 05:5xZ 钉死）
获得合并批准后按依赖逐 PR：①前置 PR 合并 → ②下一 PR **retarget 到 master**（必要时同步栈，同步后 head 即最终 head）→ ③等待该**最终 head 的 required CI（GitHub Actions）实际 SUCCESS** → ④才合并该 PR。**禁止**"先合并再自然补验"；本地实跑+独立 review **不能替代** GitHub merge Gate。当前：**无新增合并授权**，stacked 开发继续；#251 等待用户批准，#252 走 ①→④ 序列。

## 阶段表（依赖=计划 §1）
| 阶段 | 状态 | 分支/worktree | 实现者 | reviewer | PR | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| S0 | **MERGED** | master e89cf2b8 (squash 07:25:51Z；closeout delta PASS @b68c3b47→review件 c29cb0be；pr-gate+census 双绿) | a640e5c8 | 8317a608+3b970c6c | [#251](https://github.com/ArmourPiercer1/dsh-agent-team/pull/251) | 三处收口 M1/M2/M3 修毕并 delta 核验（0/0/0）|
| PR0 | **MERGED** | master abda8dbd (squash 07:44:24Z, via #254 re-base 72f603ee; pr-gate+census SUCCESS 真跑) | alpha5-pr0-contracts @cd13f781（head 含修复 a3e9d272+复核件） | 11a841dc | f31ade20 原查 PASS + fb0f1322 delta 复核 PASS（review-PR0-delta.md） | [PR #252](https://github.com/ArmourPiercer1/dsh-agent-team/pull/252) | 用户抽查缺口四条 RED 全红→修复→独立复验四场景全精确拒绝；expiry 钉现行语义；M-2 补齐；lane 103/103 |
| PR1 | **MERGED** | master db5cb5f7 (squash 08:06:56Z via #255 @45425a30；pr-gate=SUCCESS required；census advisory 后验) | alpha5-pr1-onto-master @45425a30（#253 关闭为程序性取代；delta PASS 9e8a519c 复核链；CI 待最终 head 绿后 squash） | alpha5-pr1-guard-dispatcher @aff65f31（已同步 PR0 栈 7ced349a） | d9da2f74 | 826543cc（固定 SHA 定向） | [PR #253](https://github.com/ArmourPiercer1/dsh-agent-team/pull/253)（DO-NOT-MERGE） | kit 21/21 EXIT=0；dynRan true→typed deny+零副作用；NEG1 对照未削弱；baseline only_in_after=0；token 0/REDACTED×16；三路 sweep+脚本入库；新事实：第三方 preset row 无 inject 注册不可达；3 个既有测试 first-leg 缺陷已修未放宽 |
| PR1 | PENDING | - | - | - | - | Guard+Dispatcher+生命周期；NEG-1/2/12+dynRan→deny |
| PR2 | PENDING | - | - | - | - | Admission+多 Effect 审批+一次性 Grant |
| PR3∥PR4 | PENDING | - | - | - | - | 接口冻结=PR0 的 ControlledFs/ConfinedProcessProvider |
| PR5/PR6/PR7 | PENDING | - | - | - | - | 见计划 §8-§10 |
| PR8 | PENDING | - | - | - | - | vNext+总 Gate |

## 审查/回归协议
- 每 PR 交付物=计划 §12 (a)-(h)；证据入 dev/agent-workflow/evidence/alpha5/<stage>/<commit>/。
- reviewer 只看：diff、测试、原始 run 工件；结论固定三值+具体条款映射；无 minor 循环（一轮 findings→一轮修复复核）。
- 回归矩阵骨架：真实 Host KIT（stage2b/h6 衍生套件在 PR1 起按需改造并保留原始记录）+ 10-landlock-lanes + 09-lane 回环 + 各 PR 新增负控同环境正控。

| PR2 | GATE-QUEUED（等 hard-envelope 证据+PR1r 合并序） | alpha5-pr2-admission-grant（review 件@bb8b91b5） | 6e64a087(恢复) | a2d495b7：6 项 PASS+1 必修（F-1 跨 member 批准未绑=实证可铸 grant；DORMANT 故不阻塞）+F-2/4/6 记录+F-5=PR3 义务 | [#256](https://github.com/ArmourPiercer1/dsh-agent-team/pull/256)（DO-NOT-MERGE） | F-1 真闭合@af3e046b+delta PASS(58a7ae67)；尾差 docs 收口@63778f39(111/111)；hard-envelope 证据已闭合=裁决 B（4 冲突对入 375920aa，待用户裁）；PR1r B1-B3 复核中；两 PR 维持合并冻结 |
- [ ] 范围外观察（不自动采用，待用户裁）：hard-envelope 对某 scope 的 deny 上限在 human-admin 呈报下被 verifyEffectSetApproval 接受（继承 Alpha.4 冻结 walk；mint 前 expansion 复查只看 ToolPolicyDocument）——Alpha.4 冻结语义 vs Alpha.5 envelope 语义的交叉，属用户裁决类。
- [ ] 报告保真注记：PR2 reviewer 自述 "powered-by 逐字=DeepSeek Harness"（模型栏 qwen3.8-flash-next）；后续 brief 要求逐字贴模型行原文并区分 harness 名与模型名。

| PR1r | **FROZEN（B1-B3 阻断审查中）** | alpha5-pr1r-residual-boundaries @2b16de64（base master db5cb5f7） | 4d990c89 | 447c36ae（固定 SHA 定向） | [#257](https://github.com/ArmourPiercer1/dsh-agent-team/pull/257) | R-a 双读比较拒同名异体(RED 实测 body 真跑)；R-b execute 门重问+seam 记录(PoC-1)+一次调用钉；R-a PASS、无放松 PASS、门禁 PASS；B1 FAIL(v2=1 一次真执行+两处 standing-state 代码级反例 scoped-dispatcher.ts:353/install.ts:623-627)；B2 归因 FAIL(复跑:撤的实为 change 诊断;无 change 时撤销发生但 body 仍跑一次)；B3=可行不等价:(i)门内自执行 v2=0(代价 bodyInvoked=false/结果按名重解析)/(ii)abort wrapper+change 精确筛选/(iii)不可行/(iv)无拒绝权→待用户选 i/ii/W-1/W-2/严格档禁用；bindAll 顺修无二次 bind 测试(s12 §(a)5 声称不成立) | #257/#256 合并冻结 |

- 14:51Z 用户双裁决：B3=方案(ii) 取消未执行调用（PR257 修复轮 by 4d990c89）；问题2=按 11:04 诊断+用户权限语义补齐（PR256 契约先行 by 6e64a087）。目标已 resume(rev3)。基线 origin/master=db5cb5f7 固定 SHA。合并序 257→256。决策包状态同步中。
- 15:3xZ 用户追加 R-1a 审查项（已转发 PR2 writer，且为下轮 delta 复核必查）：provenance≠envelope-walk-有rung；须证"谁写的 deny"（来源引用/版本一致性投影），禁把 policy deny 复制进 Envelope、禁改两平面 no-match 律、允许内部派生数据携带来源（非第二授权库）；必测对照=同 deny 同 envelope 覆盖 × 不同来源/未知来源 ⇒ 低阶不得批非其权威之拒；未接线=精确拒，不 DORMANT 后移。
- 排队：Lane D (8934f6fa) 因 active-child=8 上限未复，任一在跑 worker 结束即补发（worktree a5-pr5 干净零提交无风险）。磁盘回收纪律已全员下发。
- 16:4xZ Lane G 完成（e1269eb9，pr8-accept/ 候选态四件；worktree 已回收 df 余35G）；Lane D 复活开工；空间维护 worker f6d6c835 已派（camera 硬排除）。PR256 来源轮 head e701d274 待 writer 收口→delta 复核；PR257 d5890103 复核中(4dac3d04)。
- 17:1xZ **时序失误披露：#257 已 squash merge（452a04c0，head guard=ad3bc5e6 匹配，pr-gate=success）与用户"①②收口后再合"指令交错 ~30s，收口未先行**。已派 4dac3d04 对已合并内容做 closeout 复核（review-PR1r-closeout.md）；若查出必改点→后续修复 PR，不回退 master。用户两问逐字转达（①分类正确≠"仅取消未执行"语义；②静默通道的实际排除门+同步投递证据，alarm≠fail-closed）。
- INTERFACES-v1.md 正本入分支（b0d636eb，此前主检出未跟踪=设计失误），C-ADM@v1.1 pin=a51b903d、C-BIND/取消分型@v1.1 pin=452a04c0；已广播 Lane C。PR256 最终 head a51b903d 复核= a2d495b7 在跑。
- 空间：research-control 实际回收 g0(~14M+元数据)；baseline/g1/g2/g3/g5/maint 元数据已 prune 但目录在只读挂载上无法从沙箱删除（孤儿目录≈1.4G 待宿主侧清理）；g4 保留=dirty(2)+202M 未验证；df 现 47G avail(55%)。Lane B/E/F/G 完成回收合计≈数 G。Lane D 三实例静默死亡（疑 OOM，RAM 11.9G 并发多 vitest），第三实例死于报活后；待用低内存策略重试或收编。
- 17:2xZ Lane C 检查点：首个实质提交 **a5d46269** 已 push（C-PROC 阶段闭集/FD 继承/网络闭集/预启动器 typed 拒矩阵+阶段序不可伪造/ABI probe 双轨），无脏树无占用；按"可检查点即上报"策略暂停待复令。
- 17:5x-18:1xZ：G-a 裁决落实（冻结维持/无对外 upstream/G-g 独立开放项已写 PENDING-GATES 并转 writer）；fp32 原地保留关闭、SPACE-MAINT §9 收尾（孤儿目录 tree 链接全列）；master@452a04c0 CI 双绿；Lane C 交付 83e0ab9a；复核在跑 B(dbc55039)/C(8eed95e4)/F(b1c55b57)；Lane D Phase1 fb69c7f1 交付、Phase2(947a148c spill/parity)开工；PR256 F-1/F-2 修复+PR257 followup 文档在跑。队列：D/G 复核、PR8-accept 复核、集成会话（G-d）。
- 17:52Z 用户裁决：接受扩大取消范围（限定见 PENDING-GATES G-a 行）；G-a 解除待裁态；G-g 保持开放；DEFERRED D-1（body-start 公开接口，仅项目内登记）+收尾必做 D-2（.agents/skills 两 SKILL.md，完成后须 review 核验）。#258 分支文档落实中（4d990c89）。
- 18:0xZ 流程违规记录（17:54Z 授权下处置）：PR256 writer 对已公开分支 alpha5-pr2-admission-grant 执行了 **force-push 重写**（c07dea1e→8471ecac 非 FF，用户纪律"已公开历史不 force 覆盖；必要时 rebase 新集成分支保留旧审查 SHA"）。缓解：旧审查链已存档 ref **archive/alpha5-pr2-pre-rebase-2501308d**（=c07dea1e，含 a51b903d/2501308d 全链）；内容同一性已核（rebase 引入 lane 变更=仅申报的 3 文件）；#256 close/reopen 触发 CI 于 8471ecac。已警告 writer：此后一律新集成分支，不再动已推分支历史。
- 19:3xZ 集成队列手工化：自动队列互踩事故披露后改逐 PR 手工。已并 #259(B)/#264(C)/#261(E)/#263(G)。#260(D) 首并 pr-gate lint-identities 腿 5 NEW（真问题，lane 未跑仓库 ledger 门）→writer 98c0d4cb 真删修复 @5ccc5839（62/62+tsc0+ledger 腿本地绿），int-pr5 重建 @7cd20e96（旧 scaffold 3b3379ab 存档 archive/int-pr5-superseded；被重写者仅为自持 scaffold merge 提交，lane 审查链不受影响）。#262(F) 疑同源 lint ledger 失败（annotations API 网络抖未取证），本地复现中。G-g 草案 cc47fb18 记录在案。
- 19:2xZ 队列修正与推进（根对账后）：先前"B=#259 MERGED"为**错报**（把队列尝试当结果），真实合并序=256(ae3dcf54)→264(2cd5185f)→261(6ce62c25)→263(11d3374a)→**259(74d947a3)**→**260(D,merge-fix d69bfc4b)**；#262(F) pr-gate 失败=hygiene 测试 fileURLToPath TS2769（复核预报的"lane 从未进全仓 tsc"条件命中），writer fdbc7458 修复中；#258 标题/正文陈旧文案已 REST 同步（READY 表述+G-g OPEN）。census-runtime 多次=failure（advisory；required pr-gate 各自 success 后才并，census 原因追查挂 G-f 诚实项，不称全 CI 绿）。G-g G-1..G-5 补测 writer a1e07b3b 开工（分支 alpha5-g-g-probes，禁 p4t6/共享文件）。
- 20:0xZ 合并台账（mergedAt+mergeCommit 核验制）：#262 F=fc9f4a07(19:52)；#266 PR8-runner=3b2c23c5(20:04，required pr-gate=success；census 当时仍 running=advisory 非终态，如实记)。#265 首 head pr-gate=1 lint identity（a5p1r-gg-wording-lint.test.ts:25 'join' 未用）→writer a1e07b3b 真删修复中；#258 close/reopen 触发 CI（cc47fb18）。Scope 实跑：S1=a1e07b3b/44f36db6（已交付）；S2 接线=e72e4110（alpha5-int-wiring，共享 glue 唯一 writer）；S3=21fc352c 正式轮+N1/N2/N4+skills 候选文案（evidence 内，不碰 .agents/）。int 分支 alpha5-int-gg 已建（待修复 head 重 merge）。
