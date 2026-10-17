# review-WE2 — W-E2（alpha5-wire-tools2@a9bbeb1c）独立审查

reviewer = W-E2/W-PTC 合并独立 reviewer（qwen3.8-flash-next，独立会话；≠dd7bb571/≠8fe1fd77）。
受审 = `alpha5-wire-tools2 @ a9bbeb1c`（base `aece4f21`，one-off worktree `.worktrees/alpha5-wire-tools2`）。
审查方式 = 全量静态复核 + **独立真跑复跑**（本 reviewer 自己的世界与进程面）。

## 裁决：**通过（PASS）** —— M-13 行级转态提案值 **TRANSITIONED-LIVE 予以确认**（口径限定见 §4）

## 1. 核心：M-13 证据强度（28/28 中抽 6 条复跑）

复跑环境（reviewer 自跑）：`node run-we2-live.mjs --mode gated --port 3183 --world-prefix a5e2-rev --keep`
→ **GREEN 28/28，exit=0**（stamp 2026-10-17T04-17-49Z；port 3183 起跑前 kit 自证空闲；世界 `tests/homes/a5e2-rev-gated-2026-10-17T04-17-49Z`，审查毕已删除留痕）；宿主 pinned pristine @`639ed01539` porcelain 前后=0；:3080 只读探测 401/401。

抽取 6 判据逐条（reviewer 独立验证，非仅复述 runner）：

1. **veto⇒0 副作用（字节级）**：mid-capture（模型链后、探针前）`device-actions.jsonl` 磁盘上恰 **1 行=acted 腿**；aux `version=0, lease=None`、belt `version=0` 磁盘实读复核。最终态台账 2 行=acted + `interlock-owner-b`（在册授权探针行，可完整解释）。**成立**。
2. **CAS stale 拒**：main v999 → typed `DOMAIN_DENIED detail=cas-version-stale expected=999 actual=1`，delta 0，原文进真实 transcript。**成立**。
3. **Team拒/Domain可允对照**：aux 腿 = 真实 PR2 kernel 自有词汇 `requires-approval` 拒（grantId=null、kernel 决策 verbatim 在册），且 mid-capture 磁盘 aux 态 `lease=None/version=0` ⇒ 按 mock 在册确定性规则（decide= lease 匹配 ∧ CAS 相等）Domain 侧必允 ⇒ 对照成立。注：veto 矩阵该腿 `domain_permit:true` 为**确定性解析推导**（基于在册规则+盘面态），非独立 dry-run 探针——见 §5-N1。
4. **fail-closed 未确定引用**：ghost 在铸 grant **前**拒（`stage=domain-reference-unresolved, grantId=null`，negative_controls 在册 `typed-deny`），不猜绑定。**成立**。
5. **事件 census 17 名机检**：reviewer 独立脚本对 `packages/runtime/tool-dispatch/{install.ts,scoped-dispatcher.ts,closed-world-guard.ts}` + `pending-calls.js` 做逐名带引号原文比对：**17/17 verbatim 命中、0 退役短名**（判据的 prefix-escape 分支实际未被需要）。**成立**。
6. **job_start absent 复测**：reviewer 亲自 grep（同 include 集）pin 宿主全树 = **0 hits**；活 roster 无机检形名。**成立**。

RED 对照面（writer 实录 `WE2-RED-UNGATED.log`）静态复核：22/28，6 红腿=GUARD/ACTED/TEAM-DENY/DOMAIN-DENY/VETO-ZERO/UNBOUND，**恰为依赖 guard/kernel 的 Team 门控面**；Domain 独立面（INTERLOCK/CAS/UNRESOLVED）在 RED 面照常拒绝（ungated transcript 三条 DOMAIN_DENIED 原文在册）⇒ "拒是门承载的、不是死设备/不是散文" 的对照真实（ungated 破缺方式=aux 真被写 ledger=2、unbound body 跑 1 次）。

## 2. "row-local MOCK 不升格" + kernel fixture 级披露

措辞逐处核对：README 诚实披露 1–6、fixtures 头 FIXTURE-GRADE 段、receipt `caliber`、machine 矩阵 `transition_record.basis`、doc 矩阵 note——全部满足：MOCK 全程标注（界面/词表/台账）、不作真实设备宣称；kernel 信任输入 fixture 级（同 W5/W7/W8 口径）、instanceId=row-local（durable-MemberInstance 腿归 W7 在册，不借）；`TRANSITIONED-LIVE` 明文=**行级转态提案值，终裁归 PR8 正式轮+独立 reviewer**（本审查即该 reviewer 环节）；doc 矩阵 `current_status/known_partial/final_declaration` 未动，runner `final_declaration` 全 null + 反升格声明。**无不升格违例**。

## 3. editor/read_image PROBE-GATED = 诚实二分（非偷懒）

- **gated 面**逐字复验（reviewer 亲跑同型 + writer transcript）：宿主原生 `read/edit/read_image` 在调用边被活 guard typed 拒——『the trusted global definition of "edit" is unreadable at the public seam … refusing rather than crediting a name nobody could pin』+ unbound 探针『no Team Tool Binding』原文在 transcript；治理流可见（edit 腿 delta=6 / img 腿 delta=3），**文件字节 0 变化（sha 前后逐字相同，reviewer 复核 writer+自跑）**。
- **ungated 对照面**：`read→edit` 真实文件编辑往返（sha `d98a…`→`22bc…`）、真实 70B PNG 解码呈报，两腿治理观测增量=**0**——真实编辑/图像字节完全在 Team 治理面外流动。
- Team 任何包无 editor/read_image 实现（census 复验 `str_replace_editor=false`）；按任务书"不发明生产代码"路线，M-04/M-05 保持 PROBE-GATED、判据腿 NOT-EXECUTED 精确点名（缺哪个 receipt 字段点哪个），M-05 A4 经装配 runtime 实读闭环（`cf_arb_tree=false`）。**这是精确差距事实而非偷懒**：缺的是 Definition 公共 seam 钉不住宿主原生实现（W7 已披露缺口的 editor/image 侧现测），造一个 Team editor 反而违 IF-7/不发明路线。
- 探针 pre/post 实录：M-13 PROBE-GATED(exit=4)→LIVE(exit=0)；M-04/M-05 post 仍 PROBE-GATED(exit=4)。转态不对称与证据不对称一致。

## 4. 矩阵/runner 卫生

- 机检矩阵 diff **只动 M-13 行**（status_now + transition_record；`missing_legs` 清空有逐项 live_legs 支撑；evidence_refs 全部实存，reviewer 逐项核）+ EOF 换行；doc 矩阵同步只动 M-13 行 note；gap-checklist 为 append-only §3 附录。
- runner 复跑（reviewer 亲跑一次）：**PASS=27 FAIL=0 NOT_RUN=0 LIVE=1 PROBE-GATED=4 TOTAL=32，exit=0**，与在册完全一致（基线 27/0/0/LIVE=0/PG=5 对照在册）。

## 5. 保留观察（非阻塞）

- **N1**：Team-deny 腿的 `domain_permit:true` 是解析推导（已验成立）；建议 PR8 正式轮给 aux 加一条显式 mock dry-run decide 探针，把对照也变成独立观测腿。
- **N2**：doc 矩阵 M-13 `untested_carried_over` 仍列『Domain mock 联锁、veto=0 side effects 证明』——提案值若被 PR8 正式轮接受，该行应同轮更新（现保持不动与"行不升格"自洽，记为后续项）。
- **N3**：reviewer 的外部 `ps` 采样器进程曾因 cmdline 含匹配串被 kit 的 /proc 采样面自匹配收编（观察面污染，判据仍由 program 侧 pid≠host pid 承载，未影响结论）；建议后续 kit 采样器排除 observer 自身 cmdline——属采样观察面普适教训，记此留痕。
- **N4**：任务书 ② 的『M-05 mock 腿』实册于 M-13 一事已在 README §披露4 与 gap-checklist §3 双点明，未挪册未借类别——按在册行执行正确。

## 6. 卫生复核（reviewer 亲验）

IF-5 共享面 porcelain 全程空（判据自带 + reviewer 复核）；宿主树 porcelain=0/HEAD 未动；世界（writer 的与 reviewer 的）均已删除；launch token 捕获即脱敏（instance.log 仅 REDACTED-<sha8>，raw log 已删，reviewer 证据面 token 扫描 0 命中）；:3080 全程 401/401 只读。

— reviewer 会话：本文件即裁决正本；writer 与 reviewer 无共享上下文。
