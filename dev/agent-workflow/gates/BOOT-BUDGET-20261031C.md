# BOOT BUDGET LEDGER — USER-RULING-20261031（C 册：总额 **36 starts**，从零另计；B 册 24 的已用 12 不迁入本册，B 册封卷保留全部历史收据）

裁决来源：USER-RULING-20261031 §1（外部审查意见经用户背书，2026-10-31 下达）。基准 master=`89d96a13d`。

## 分池（新可用 24 starts）
| 池 | 用途 | 额度 | 已用 | 明细 |
| --- | --- | --- | --- | --- |
| C1 | Agent Control 真实 Host 复证 | 8 | 0/8 | — |
| C2 | 其他 Family 的 L3/L4 验收（含 State Home） | 8 | 2/8 | u7r3-shomev2：2026-10-30T12:22:33Z / 12:26:11Z 两次 spawn（写臂 + 重启臂），预登记=215362c844（push 确认 11:20Z，分支 task/u7r3-shomev2-reg-20261030），收据 dev/agent-workflow/evidence/u7r3-shomev2-20261030/（host-start-budget.jsonl 恰 2 行） |
| C3 | 固定候选的跨 Family 集成和回归 | 4 | 0/4 | 候选冻结前不得动用（G5 域，用户单独放行） |
| C4 | 机动与故障归因 | 4 | 0/4 | — |

"不是要求使用完 24 次，而是提供不需要频繁请示的执行空间。正式 G5 PRODUCT-GATE 的放行仍然另行裁决。"

## 控制（全池强制，沿承 + 新增）
1. **预登记律**（沿用）：每次启动前登记确切源码 SHA 与 Host 绑定（PRE-REGISTRATION commit push 确认后方可 spawn；事后登记=违规）。
2. **同类失败停线律**（沿用）：同类失败必须先 RCA 后重试。
3. **禁探索律**（裁决原文列于"三项控制"保留项内；本册首次成文落档）：接口尚未证明存在的工具不得靠反复 boot 探索。
4. **效率门**（新增）：连续数次 boot 未推进任何验收格 → 停耗预算，先优化 World/Oracle/测试编排，回报协调者复核后再续。
5. ENV_BLOCK/NOT_REACHED 不得洗为 PASS；合成注入必须标注合成，不得冒充自然真实 Host C2（USER-RULING-20261031 §3）。
6. :3080 与 ~/.dsh 只读不变式继续全局有效；boot 世界全部工作区内 homes、3180 族端口、用毕拆除。

## 封卷注记
B 册（`BOOT-BUDGET-20261029B.md`，24 starts）于此封卷：已用 12/24（pilot 4、#446 boot 4、crash 复验 2、State Store 生产路径 2）全部收据保留于 B 册原文不改写；本 C 册为自 2026-10-31 起唯一预算权威。

## 已用登记（只追加）
- **2026-10-30T12:27Z（真实 UTC，R-CLOCK-1）lane=u7r3-shomev2 池 C2：2 starts 已用（2/2，登记额度精确用尽；C2 累计 2/8）。** 被测对象=origin/master tip `1d884efdb`（#483 后生产 Home 法）；Host=pristine test-use @ `639ed01539`。start#1 12:22:33Z（写臂：DSH_HOME unset + HOME=<workspace 内 operator home> + testHomeGuard 键缺省 → agent-state 落 <home>/team-state/agent-state/<realmId>/，member todo_write / leader goal 写腿 typed-OK，真实 ~/.dsh 零沾染）；start#2 12:26:11Z（重启臂：/proc 证 DSH_HOME 缺失持久化、boot-1 realm 逐字节读回 IDENTICAL、新 store 实例读回、STATE_APPLY_REPLAY 拒绝 + 零写、0 ALIAS）。裁决 PASS；披露：boot-1 驱动在工件捕获后 ReferenceError 崩溃（非产品类，未重 spawn，run-shv2-1.json 离线重建 recover-boot1.mjs，其 /proc-only 两格记 NOT_CAPTURED_PERSISTED_JOINT_WITNESS 未洗白）；boot-1 宿主由沙箱 PID-namespace 收尾回收（端口释放已验）；p6t6 观察行因自身拒 DSH_HOME 缺省而不出席（改 boot-marker+/team-remote 就绪）。收据：`dev/agent-workflow/evidence/u7r3-shomev2-20261030/`（host-start-budget.jsonl 恰 2 行、run-shv2-{1,2}.json、logs token 已脱敏）。
<!-- dated 2026-10-30T17:3xZ coordinator conflict resolution: master side (V2 used-rows 12:27Z) kept BEFORE branch side (f4 pre-reg 12:35Z block) per real-UTC order; zero deletions; both sections verbatim -->
## 预登记（registeredAt 2026-10-30T12:35Z，真实 UTC）— lane=u7r3-uif4，池 C2 申请 3 starts（计划 1 + 装配漂移备用 1 + ENV 备用 1）

- 目标：ask_user_question **L4 正向 live**（UI 阻断验证类格的正臂；ledger :647 DISCLOSED 格的闭合材料）：经公开面闭环 = default:ask 模板 → 耐久 Control 行 → 只读探针行 → team.resolveControl v4（/team-remote）落授 → **公开应答面**（WS $events waterfall→POST /api/$events/result；续答走 /api/userQuestions/answer，LEG-0 已钉形）→ 恰一 RAN + 盘上 user-question-reply 见证 + 拒批臂零副作用 + consume-once 重放拒。cells：ui:ask-approved-ran / approval-chain / replay-refused / answer-wire / live-root-law（NOT_RUN-safe，L2 不烧预算）/ present-env-truth（UI_PRESENT_PORT_ABSENT 环境真值随行）/ leak-check。
- 被测对象 = 合并 #489 夹具后的 master（或登记时的 origin/master tip，lane 记录写实际 sha）；World=DSH_HOME 纪律照常（本腿与生产 Home 无关）；chromium 不在关键路径（LEG-0 降级）。
- 控制：ENV/同类失败 RCA 停线；3 starts 上限硬约束（预算 jsonl 逐 spawn 记账）；每 start 必出 RUN Record 或点名 blocker。

### 实耗回执（real UTC 2026-10-30T13:16Z）— lane=u7r3-uif4，池 C2：**2/3 starts 已用，第 3 次未动用**

| start | 时刻(UTC) | world | port | 结果 | 归因 |
| --- | --- | --- | --- | --- | --- |
| p1 | 12:47:29 起 | u5p1-20261030T12-47-29Z | 3191 | 无 RUN Record，被 run-control hard watchdog 中止（本 lane 自杀其进程组收尾） | **lane-kit**：应答客户端 `waitReady` 的 `nextFrame()` 无期限 await，`$events` 空闲即永久停摆（RCA：`evidence/u7r3-uif4-20261030/c2/RCA-start1-abort.md`） |
| p2 | 13:11:09 起 | u5p2-20261030T13-11-09Z | 3192 | 完整 drive，7 格全部落判：**PASS 5 / FAIL 2 / NOT_REACHED 1**（overall FAIL） | 一次装配漂移修复重试（同类失败 RCA 后重试，符合控制 2） |
| p3 | — | — | — | **未动用** | 两次失败同类（lane-kit），按"同类失败停线律"+ 本腿预留（第 3 次仅限 ENV）停耗并回报 |

- 记账账本（逐 spawn）：`dev/agent-workflow/evidence/u7r3-uif4-20261030/host-start-budget.jsonl` = 2 行（硬上限 3）。
- 收据：`dev/agent-workflow/evidence/u7r3-uif4-20261030/c2/`（run-uif4-p2-reconstructed.json / LEAK-AUDIT-manual.md / RCA-start1-abort.md / 两次 redacted host log / p1 world 残骸见证）。
- **点名 blocker（合规控制"每 start 必出 RUN Record 或点名 blocker"）**：两次启动均未传 `--run-record`，故无 runner 生成的 RUN Record；已用 `run-uif4-p2-reconstructed.json`（逐字段标注来源的 lane 重建，非 runner 记录）+ stdout RUN-SUMMARY 代位，并已在套件头部写入调用律。此为纪律缺口，责任在本 lane。
- C2 池级"已用"表行由协调者统一记（本 lane 不知同池兄弟 lane 实耗，不代改共享行）：本 lane 应计入 **C2 +2**。
- 环境不变式复核：:3080 只读 401 未变；~/.dsh mtime 2026-10-28 未变；host 树 tracked porcelain 两次启动前后均 0；本 lane World homes 已全部拆除。
<!-- dated 2026-10-30T19:45Z coordinator conflict resolution (sync14 fmerge master): master side (used-rows 12:27Z→receipt 13:16Z) kept BEFORE branch side (coordinator pool ledger 13:27Z) per real-UTC order; zero deletions; both sections verbatim -->
## 池总账（dated 2026-10-30T13:27Z，真实 UTC，协调者合并账；各行原文照留）

- **C2 = 4/8**：u7r3-shomev2 2（#487，12:22:33Z/12:26:11Z）+ u7r3-uif4 2（#491，12:48:29Z/13:12:09Z；预登记 fa756733d，p3 未耗）。两 lane 收据各自在册，无双计。

<!-- dated 2026-10-30T20:14Z coordinator conflict resolution (xval fmerge master@12cc9843e incl #492): both sides kept verbatim, real-UTC order (master sections 10:0-10:4xZ wave / 12:27-13:27Z before xval sections 14:21-15:5xZ); zero deletions -->
## 预登记（registeredAt 2026-10-30T14:21Z，真实 UTC）— lane=u7r3-xval（受控并行验证试验，用户直接指令 2026-10-30），池 **C1（环境验证池）** 申请 3 starts

- **目的**（用户指令原文要点）：核验 TestWorldFactory 双 worktree 真并发（共享租约根/独立 HOME/独立 Workspace/独立日志/固定 Host SHA/原生沙箱预检），C1 串行vs并行对照，及一组「真实 Host 启动 + 轻量 C1」共转试验；产资源效率对照报告。
- **池归类声明**：本试验按 USER-RULING §一 池按**用途**归类——所购全部为「非验收验证（装配/环境）」= C1 池；**不得为任何 Family 记验收格**（分支 C2 不冒充合并后候选 C2；World 启动 RUN Record 来源绑定试验 lane，证据目录独立）。
- 三 start 用途：x1/x2 = P0 双 worktree 双 World 同转（各 1）；x3 = P2 真实 Host 与轻量 C1 共转。P0/P2 各自出 RUN Record 或点名 blocker；沙箱预检必须落 Record；同类失败 RCA 停线；:3080/真实 ~/.dsh 红线与全套既有纪律不变。

## 已用追加（append-only used-count）
- **C1 +3**（记 3/8；lane=u7r3-xval 受控并行验证试验，真实 2026-10-30，用户直接指令，零验收格）：账本 `dev/agent-workflow/evidence/u7r3-xval-20261030/host-start-budget.jsonl` 恰 3 行——line1 token x1 14:56:53Z（真实启动后被 lane 探针脚本缺陷崩溃消耗，RCA=探针 TypeError，孤儿 World 经 reclaimWorld 回收留痕，同类失败律先 RCA 后重试）；line2 token x1 15:02:45Z 与 line3 token x2 15:04:23Z = P0 双 worktree 双 World 同转（:3189/:3190，RUN Record 各 17/17 PASS）。注册用途 x3 **未动用**（预算上限 ≤3 行下的 P2 共转测量折叠进 P0 重叠窗口，见 XVAL-REPORT.md 披露）。:3080/真实 ~/.dsh 只读不变式全程 byte-witness 未动。

## 更正（dated 2026-10-30T15:47Z 真实 UTC，append-only，原文照留）— lane=u7r3-xval 池归类勘误
本 lane 预登记与本册已用登记行将 3 starts 记入 **C1**，但本册 C1 用途=「Agent Control 真实 Host 复证」，本试验（并行基础设施验证）用途应为 **C4「机动与故障归因」**（含探针崩溃 RCA 的归因属性）。**勘误：3 starts 由 C1 划转 C4，C4 计 3/4，C1 回到 0/8。** 本更正不改变任何收据（budget jsonl 三行原样、RUN Records 原样、零验收格不变），只更正池归属；协调者裁决依据=池表用途列原文。

## 预登记（registeredAt 2026-10-30T21:34Z，真实 UTC，协调者并入草稿）— lane=a5w-bootwave，池 **C2** 申请 3 starts（bw1 主跑 / bw2 同类修复重试 / bw3 ENV 备用）

- 目标 = 单 World 双腿一次 boot：read_image 治理行正腿（ask-approve→typed grant→RAN→恰一附件对象）+ 两条拒绝臂（answered-deny 零副作用；store 像素法零 commit）+ UI f4 公开应答面复跑（#489 waitReady 修复后）+ leak-check；套件 tests/world-factory/suites/140-u7r3-bootwave.mjs（9 格）。
- 绑定律 = 套件内置自拒：BOOTWAVE_PRE_REG_SHA 必须 == 运行 HEAD，spawn 前校验（SOURCE_SHA_MISMATCH 全格 FAIL）；产品树 = 本分支 HEAD（fmerge master@3e7fd25e0b 后，产品码与 master 恒等，diff 零产品文件）；宿主 = tests/deepseek-harness-test-use @ 639ed015397290b3745d163aafe02ffee4aa3f84（porcelain 0，主树只读回退）。
- 停线律 = 同类失败 ×2 停线进入 RCA（rcaClass 逐格落记录），禁 boot 探索未证接口；效率门 = 每 start ≥1 有效格，否则记 WASTED 并停止续耗。
- 全量腿清单/判定律/审批序 = dev/agent-workflow/evidence/a5w-bootwave-20261030/PRE-REGISTRATION-DRAFT.md + PRE-REGISTRATION.json（同 commit 在册）。本 lane boot 前实耗 = 0（dry-run + 预算门拒启收据在案）。

## C2 池使用回执（lane=a5w-bootwave，dated 2026-10-30T23:54Z）
- bw1/bw2：ENV 类（旧探针误判），spawn 前死，真实启动 0，池计数不动（RCA-1）。
- bw3 +1（5/8）：真实启动 1，首绿 placement/ui:f4/leak（RCA-2）。
- bw4 +1（6/8）：真实启动 1，trace 定根因主链（RCA-3）。
- bw5 +1（7/8）：真实启动 1，捕获 fault 全文，裁决=产品装配缺口（RCA-4）。
- 预登记池 3/3 耗尽；复跑需新预登记。

## 用户裁决增补（dated 2026-10-31T00:06Z，原文入账，协调者逐字转录）
「现行 C 册各用途池及其已发生实耗不变。允许在完成新 WSL 环境离线预检、且具名故障归因证明现有 C4 余额不足时，额外启用最多 2 次 C4 机动 Host starts。每次仍须预登记、计数、RCA 和收据绑定。不得挪用 C3 G5 预算，不得以新增额度代替测试脚本修复。其他用途暂不增额；C2 用至 6/8 时，结合明确待验收任务报告下一批需求。」
- 生效解释（协调者记录，不改语义）：现有实耗定格 C1 0/8、C2 7/8、C3 0/4（FROZEN，G5 专用不可挪用）、C4 3/4。C4 机动额度=条件性 +2：前置①新 WSL 环境离线预检完成（--dry 全链 + 探针/租约离线复测，零 boot）；前置②具名故障归因证明 C4 现有余额 1 不足（引用具体失败格与 RCA，不得预防性套额度）。每格仍走预登记/计数/RCA/收据绑定四件套。「以新增额度代替测试脚本修复」= 禁止——套件/装配缺陷一律先修复再烧格。
- 下一批 C2 需求：C2 已过 6/8 线（现 7/8），按裁决随下一次预登记捆绑报告：待验收任务=read_image L3/L4 六格（ri:ask-approved-ran / ri:attachment-commit-one / ri:tool-output-two-blocks / ri:answered-deny-zero-effect / ri:store-law-zero-commit + deny 零副作用）与 present/ask 补充腿，依赖 bindseam 装配修复入 master。

## bw6 预登记（lane=a5w-bootwave，dated 2026-10-31T01:31Z，协调者=唯一 Integrator）
- 格：C2 第 8/8 格（本 lane 池最后一格）。max-host-starts=1。
- boot head（预登记 sha）：task/a5w-bootwave-20261030 本条目 commit 后 HEAD；前向合并条款适用（boot head=分支 HEAD，含 master@e93a546325 = PR #508 SubtreeContains seam 装配修复）。
- 任务（具名）：bw3/bw4 失败根因（成员子会话 mount 被拒→target-stale）已由 #508 修复入 master 并在本 boot head 上；bw6=完整链复跑——ri:ask-approved-ran / ri:attachment-commit-one / ri:tool-output-two-blocks / ri:answered-deny-zero-effect / ri:store-law-zero-commit 五格 + ri:placement 维持 + ui 全腿。判绿即台账翻 L4。
- 离线预检（用户裁决前置，已完成，零 boot）：registries 12/12；140-suite --dry PASS；port-probe 5/5（#504 修复探针）；bindseam C1 7/7（在 fmerge 后 boot head 亲跑）；test-use pristine@639ed01539 porcelain=0；dist tracked 且 drift=0（#508 CI 门亲验）。
- C4 机动 +2：**本波不动用**（无具名失败证明 C4 余额不足；若 bw6 出现新具名失败且归因证明余额 1 不足，另行逐格启用）。
- 有效格判据：五目标格任一绿=有效；全红但产生具名新故障+trace=有效 RCA 格；无新信息重跑=自 bw6 起停线并升级用户。
- 同类×2 停线状态：装配缺口类已由 #508 闭合（产品 PR 全门合入），bw6 属修复后首轮，不构成同类第三跑。

## 协调者失误披露 + bw6 重发射更正（dated 2026-10-31T01:31Z）
- 事实①：bw6 首跑 REFUSED（--max-host-starts 1 与账本总行数 3 的计数器语义冲突）= **零启动，账本无行，成本 0**。
- 事实②：bw6x 探针=协调者误操作（用 --line bw6x + /tmp 账本想快读 REFUSED 文本；head -6 SIGPIPE 杀死 runner，但主机已真实 spawn）。**未入账真实 Host start +1**；world 残留已手工回收（rm -rf tests/homes/u5bw6x-…，与 §7 先例同法）。**记销：本 start 计 C2 第 8/8 格（有效格=否，WASTED，责任=协调者，非 ENV 非产品）**。C2 池 8/8 耗尽。不 launder、不隐藏。
- 事实③：bw6 正式重发射=更正参数（max-host-starts 4 ≥ 账本 4 行）消耗 **C4 第 4/4 格**（用户 2026-10-31 裁决现行余额，预登记四件套照走）。C4 机动 +2 仍未动用（无具名失败证明其必要；bw6 若成且无新具名失败=不需要）。
- 下一批需求（捆绑报告，per 用户 6/8 触发条款）：C2 已尽。bw7（若 bw6 出修复后可再验）需用户批新 C2 格（建议 2）；C4 余额用尽后若 read_image L4 五格仍未闭合且具名归因成立，届时申请启用机动 +2。

## bw7 机动预登记（lane=a5w-bootwave，dated 2026-10-31T01:34Z；C4 机动 1/2，用户 2026-10-31 裁决启用）
- 前置①离线预检完成（boot head 全套，本 commit 后复跑 --dry+registries 在册）；前置②=RCA-6 具名归因（套件双行决策缺陷，C4 余额 0 证不足）。
- boot head=本 commit 后 HEAD（含 RCA-6 修复）；max-host-starts=5（账本现 4 行，计数器语义=总行数上限）。
- 有效格判据：五目标格任一绿=有效；全红但新具名失败+trace=有效 RCA 格；无新信息=停线升级。
- 收据：run-bw7.json + oracle + host-starts.jsonl 行 + 本册回执，缺一即违规。
- 机动格回执 1/2（dated 2026-10-31T01:35Z）：bw7 真实启动 1（账本第 5 行），有效格=是（RCA-6 修正证实 + B 行 deny 新具名失败+判别子）。机动 2/2 **冻结中**：待 LEG-SEMANTICS 调查定甲/乙后按需启用（甲=套件契约修正后再烧；乙=产品缺口立项，不烧）。

## bw8 机动预登记（lane=a5w-bootwave，dated 2026-10-31T04:18Z；C4 机动 2/2=最后一格，用户 2026-10-31 裁决）
- 前置①离线预检：本 head 全套 PASS（140 --dry exit0；registries 12/12；test-use pristine @639ed01539 porcelain=0；#510 已入 master 并被本 head forward-merge 携带=修复在 boot 树内）。
- 前置②具名归因：RCA-7+LEG-SEMANTICS-INVESTIGATION=乙级产品缺陷定案（pa-control-bridge 三处纯核调用不传 seam → B 行 allow 被记 deny）；该修复只能真机验证（C1 已绿但 L4 判据=真实 Host 正向效果读回），C4 常规余额 0/4、机动 1/2 已烧，证明确有本格之需。
- boot head=968ecc895f 系（本预登记 commit 后 HEAD）；max-host-starts=6（账本 5 行+本格）。
- 有效格判据：ri:ask-approved-ran/ri:attachment-commit-one/ri:tool-output-two-blocks/ri:store-law-zero-commit 任一绿=有效；全红但新具名失败+trace=有效 RCA 格；无新信息=**停线升级用户**（机动池见底，不再自行动格）。
- 收据：run-bw8.json + oracle + logs + host-starts.jsonl 行 + 本册回执，缺一即违规。

## 机动格回执 2/2 + 池见底停线（lane=a5w-bootwave，dated 2026-10-31T04:21Z）
- bw8 真实启动 1（账本第 6 行）=机动 2/2。**有效格=是**：首绿×2（ri:attachment-commit-one、ri:store-law-zero-commit），RAN 实例日志首现（#510 修复真机证实），objects=1 真对象入仓。
- 残根三件全部离线可修（vobs 装配席在途 + 套件两修正已提交，见 RCA-8），**下一次真实启动（bw9，判据=read_image L4 三格收口）需用户新批预算**——机动池 2/2 用尽，预登记硬停线条款生效：不自行动格，升级用户裁决（具名验收任务=read_image L4 收口跑，预计 1 格，另含 L4 收据独立复现 1 格=共 2 格，见协调报告 J-4）。
- 收据齐：run-bw8.json + oracle + bootwave-evidence + logs + host-starts.jsonl 第 6 行 + 本回执。

## 用户裁决入账（dated 2026-10-31T04:45Z，直接指令）
1. **C2 新批 ×2 批准**：具名用途=（a）bw9 read_image L4 三格收口跑（grantAudit 接线修复合并后；判据=ask-approved-ran/two-blocks/deny 臂三格+既有五格保持）；（b）L4 收据独立复现跑（翻台账前的独立复现格）。逐格仍需预登记+RCA+收据；机动池 2/2 已尽不复活。
2. **web_search 接受「可信服务 assurance 边界」**：Host/可信 Provider 能保证的行为按其真实边界登记 assurance；逐目的地强制不可证部分不得声称等价，维持 fail-closed 或登记边界——具体格位由 PR-C PoC 决策表落字。此项为产品范围+安全主张裁决，非验收判据放宽。

## bw9 预登记（用户新批 C2 批 1/2，dated 2026-10-31T05:28Z）
- 授权来源：用户 2026-10-31 直接指令「批准 C2 boot 预算 x2」，具名用途 (a)=read_image L4 三格收口跑（本条）；(b)=L4 收据独立复现（待 bw9 结果，另条预登记）。
- boot tree=task/a5w-bootwave-20261030 @ PRE_REG_SHA=e8b17eb183ea（含 origin/master@4229bd5605=#511 vobs 观测接线 fmerge；离线预检 dry+registries 绿）。
- 判据目标：grantAudit 行首现（a5-admission 白名单行）→ ri:ask-approved-ran 收口；ri:tool-output-two-blocks（套件 RCA-8 修正后）；ri:answered-deny-zero-effect（kernel-admission 臂）；既有六格保持+leak+stable-instance。
- 预算账：host-starts.jsonl 现有 6 行 → --max-host-starts 7；失败=具名 RCA 后决定是否用 (b) 额度，不自动追加。

## bw10 预登记（用户新批 C2 批 2/2，dated 2026-10-31T05:38Z）
- 授权来源：同上批 (b)=read_image L4 收据独立复现跑（bw9 已九绿：u5-u7r3-bootwave-bw9-2026-10-31T05-38-21-670Z；本跑=独立复现格，收据翻台账前置）。
- boot tree=同 bw9（task/a5w-bootwave-20261030 当前 head，含 bw9 证据 commit；套件与产品码零变）。判据=九绿复现（允许 ui:live-root-law NOT_REACHED）；任何 FAIL=具名 RCA，不自动追加。
- 预算账：账本现 7 行 → --max-host-starts 8。本批 2/2 用尽后池=0，再启动需用户新裁。

## bw9/bw10 回执（批 2/2 用尽，dated 2026-10-31T05:39Z）
- bw9=1 start（账本行 7）：九绿，L4 三格收口首跑。bw10=1 start（行 8）：九绿精确复现（同对象 sha，异 world/ids）。批 2/2 用尽，**池=0**；L4 收据=c2/L4-RECEIPT-read-image.md。
- 两跑零 FAIL 零 RCA 追加；泄漏检查双绿。再启动（含任何复验）需用户新裁。
