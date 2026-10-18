# ② 未验收 / 禁用项清单（对 `dev/agent-workflow/evidence/alpha5/COORDINATION.md` 台账读出；逐条状态如实）

> 读出基准 = 台账至 19:4xZ 条目；**20:3xZ 现场更新**：`ls-remote master` 已推进 = `5885e46e`（**#340 已合**）。凡"未闭/待裁"均以台账+现场 log 为准，不外推；失效行标 SUPERSEDED 保留原文。

## A. 整合中 / 未合（今日安装面上**不可得**或**语义未激活**）

1. **#340（B3 取消腿）= 已合 `5885e46ec2bcbfa7bfa58882d835801ec8b79e1f`（=现 master，现场 ls-remote+log）**。〔原文 SUPERSEDED：「整合中，未合。PR 本体 914b834b + f1df7cb3 + 10c5dbb0；merge-sync（master→分支正向 merge，预期 p4t6 撞=union+scanner 亲数重锚）……」——sync 完成，合入即本头。〕**剩余=装面验收**：取消腿（user/parent cancel→`cancelled:true`+优先律 exited>timedOut>aborted）在真安装世界未驱动=a5ie-r5 范围（r5 smoke 仅证无取消路径渲染 `cancelled:false` 语义正确）。
2. ~~`cancelled` 语义在装上 = 恒 false 渲染~~ **SUPERSEDED by #340**：`cancelled:true` 自 `5885e46e` 起可达（仅 user/parent 成因；`backend-contract.ts` `ToolCancelSignal` 四成员结构视图）。〔原文保留：「master b6d7c48a 的 shell 行 outcome 硬编码 cancelled:false（plane-effect-backends.mjs:693），bash · cancelled 文本（render.ts:182-184）合前不可达……不可达=无害现状，不是错误渲染」——该段描述的是 ≤b6d7c48a 事实面，r3 receipts 为其当时的正确钉证。〕超时形显形（`exit=not-observed · timed-out`）不变。
3. **模型侧 PTC 提示词工程未接入**。审批/一次性 grant 全在**宿主侧强制**（waterfall 监听 + 内核优先序 + 耐久审批梯），插件不向模型声明/教学 PTC 流程；**真源=宿主侧强制**，模型不配合≠可绕过。试用者若期望"模型会主动申请提权"的体验=未交付。
4. **#337（G6b glob flake/收口修）= 方向已根准（R1+rc-first，20:12Z）；三线各态（#341 三次补修对齐，非"候裁"）**：① **rc-first 判据线**=步骤 B `178bea59411b2d257cadc0582603b361aec7f96c`（对象实存）——**双独审已回**：A=`e593709f` **GO**（八件亲核+抽跑全绿）、B=`d3cad43b` **投机通过**（必办五项在册：rg 语义共存钉/行层 pid 双保险/payloadExit 超时/空 scratchRoot refuse/dormant 旧行挂账）→**收口单已派（七收口项+merge-sync+整合树必跑），merge-sync 收口进行中**；② **stdout 完整性门已落 `203cac85f00dcadc71df98405f87eca01a477b06`**（"#337 round-8——批准窄范围：stderr 判定零动，cap 250ms，未收口 fail-closed 到既有 walk-too-large"）；③ **glob 独立关断键=交付候门**：`a5-globoff-key`@**`27f70457`**（闭包新头：缺省不变/显式 false 走既有 typed-shut/无绕过/RED-first；feat `6b4680f2`；RED 5/7→GREEN 7/7、K1 常绿=默认零变直证、K7 四工具真 Landlock、五 hunk 全 assembly 体、p4t6 1200→1201、11 失败 base A/B 全预存）。三线**均未入 master 头**（merge-base 实证）。**双注（可核性）**：COORD 尾所引 `11c246f2`（writer 头）与 `da98c039`（收口派单记录）**现场 cat-file 无此对象**——只按台账行引用，勿作 commit 坐标。（关联在案洞试用口径不变：glob/search live 行"非空 stderr=错误"**代理判据**洞**未闭合至上述线入头+复验绿**，试用 glob 按"typed walker-error 属预期面"理解。）
5. **PTC 网络半臂 = 真本地阻塞**：上游 `SandboxMode` 词表无 `net`，非本仓待办；**已登记 upstream 需求**（台账 10:4xZ）。fs 半臂（本次已合）=唯一可用半臂。
6. **v4 = 仅文档面**：`SUPPORTED=[3,4]`（`ee49c4c0`/#324）只保证 v4 文档能解析/冻结/哈希绑定运行；其 `toolBindings` lanes **不执行**——dispatch 在 Tool Binding 验证门 fail-closed，同拍 M-3 envelope Scope 表=GRAMMAR-not-ACCEPTANCE（零 rung），verified-effect feed=后续路线。**T-1（v3 退役窗口）= 唯一待用户裁决项**（P-D2 盘点，08:1xZ）。

## B. 已裁语义边界（不是缺陷；试用面必须如实理解）

7. **`team_bash` 无 ask 层**：team_* 为 lane 不可寻址 placement 行（冻结教义 `types.ts:203`+coverage+闭集 schema），ask/durable-approval 机器只在权限工具面；要审批效果对 `team_bash` 只能 **deny 或摘能力**。"给 plane 行加 durable ask"=新语义，归根不采（02:1xZ）。durable grant 只作用 native bash 行；"审批后执行"落点=宿主内部 tool adapter（无公开 seam）=已登记 upstream 需求，现状=非 team 无审批、team 世界 durable grant+PTC 一次性（10:1xZ/03:0xZ 缺口行；**#341-④ 精确化三形状矩阵+r6b 实测 verbatim=REWORK §④**）。
8. **信号腿（128+signum）未端到端驱动**：钉在 #336 合成 spec 腿（`A3 … 143`）；r4-b2 按触发令未重跑——范围声明非缺口。且数值撞车=用户口径钉死：**任何数字面不得声称区分死因**（payload exit 143 ≡ SIGTERM；#338 已清 launcher 注释旧口径）。
9. **C10(a)**：dispatcher 环取消不得误标 cancelled——"静默跳过"的 Gate 记录前提=与 #340 同批在册（13:1xZ），未单独成立验收。

## C. 在册待办 / 环境项（不阻塞今日试用，但如实报）

10. **`a5ie-r4-b2` 真装面 B2 复跑证据未入仓**：冻结 tag `a5ie-r4-b2-evidence`=`b071b4f5`（本地），候新 master 重放呈小 PR（台账 14:0xZ）。装面 A7 翻形 `exit=1` 的官方收据今天仍以该 tag 存在。
11. **`a5ie-r5` = 真安装全量验收已跑：40/41+3 booked，唯一红 C1（#341 补修收账，判据未降）**：入账 `a5ie-r5`@`c44f51e4`（runs `2026-10-18T20-36-13Z`）；**C1=取消腿装面端到端未达**——cancel RPC 命中成员 sleep-90 lane（E1 判别器 ≤5s 触发、http=200）仍落死亡形（`exit=not-observed cancelled=false`+模型见 `Error: tool call aborted`），`bash · cancelled`/`"cancelled":true` 未在装面 team lane 端到端出现 ⇒ **#340"已合"≠装面端到端已通**（红在册未闭，归取消链路线；早先"真跑进行中"行由本行收账取代）。本轮 ④ = 最小 smoke（+M9 见证腿），不等价于 r5。
12. **census 工件上传强化脚本**（capture log 作 artifact 上传）=待根批准，独立小 PR（06:2xZ；即任务单所称"re-grade 上传封"在册项）。CI 自身零改动=根裁（06:3xZ：#326 后禁再动 CI）。
13. **外部 CI 事件丢失未闭**：GitHub Actions 对 PR 事件约半数被丢（opened/synchronize 皆丢，check-runs=0 实证；master push 事件仍全门跑通）。唯一主动通道=已合的 `workflow_dispatch`（#326）。**合并门不得以本地实跑+独审替代**；PR head 上 check-runs=0 必须复核不得猜绿（台账 05:5xZ/03:3xZ + `.ci-outage-evidence/`）。
14. **测试宿主窗口纪律**：test-use 树任何 SHA 切换须广播+窗口外复验（#330 重钉 639ed01539 轮教训）；本轮 smoke 全程未动 test-use（porcelain 0 前后=腿 `H1`/`C2`）。
15. **`team_delegate` 实例形也必填 `label`（本轮 20:0xZ 现场发现，docs 精确化待入册）**：工具 schema 对创建式/按实例式都要求 `label`（缺→具形拒 `TEAM_TOOL_BAD_ARGUMENTS: required argument 'label' is missing`，产品行为正确），而随发布面的 `.agents/skills/team-leader-operations/SKILL.md` 行文把 `label` 标注为"（create form）"易误读=**文档 vs schema 语义差**，试用者会踩；wire 原文=本目录 `runs/2026-10-18T20-01-51Z/wire-digests.jsonl` seq7。修=SKILL 行文一行，docs-only 小件，未擅改（禁改产品面纪律），候协调者入册。
16. **宿主词表 13 名未钉名（已裁；两段落毕+预防钉轮进行中，#341 推前拦截修正）**：`PLANE_RESERVED_NATIVE`（`team-tool-plane.mjs:241-259`）未覆盖宿主 rc.2 shipped catalog 的 `run_code / plugin_manager / schedule_×4 / workflow / stagehand_×6`——`verifyPlaneNames`（:280）只查钉名表 ⇒ plane 行 mount 名撞这 13 名**不会被拒**（放行面）；另有反向漂移 `subagent_fork`。**三段实况**：①已落=原始 13 名钉+双向漂移机检 **`c8ad9c4a`**（现场可核；**stagehand×6 本在此 13 名内**）；②证据笔=**`b7deacbc`**（c8ad9c4a 之上纯证据一笔：同形对抗扫+失败清单，catalog 口径裂缝如实呈）；③**预防钉轮进行中**（subagent_codex/subagent_claude_code 预防保留+启用/禁用翻转漂移测试；依据=根 21:15Z 会话原文逐字引"仅默认 disabled 不能成为允许冒名理由……新增名都须真实注册来源，不能猜名扩表"；**该逐字尚未入 COORD=父转呈**，落毕以现场新头替换"进行中"）；subagent_fork 保留/退役理由约束不变。**作废注**：前版"现装∪shipped 并集口径（根 21:05Z）补钉轮含 stagehand×6"=**已撤回虚构令的残留**（COORD:200 撤回行在案，SUPERSEDED），作废；前引 `68e8d70f` 现场无对象双注保留。逐名三层表=REWORK §⑤。

## D. 禁用项（红线，非"未验收"）

- `:3080` 稳定实例：只读探针，禁启动/写入；3180 族以外端口禁用；push 禁；冻结锚点禁移动；`docs/plans/active/` 用户产物禁改。
- 宽 glob 清理**禁用**（本轮清世界=具名清单 `sweep-list.json`，台账"禁宽 glob 清理"通令执行）。
