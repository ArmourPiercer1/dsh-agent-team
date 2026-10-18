# #337 步骤 B — R1 + rc-first 实施单（root 20:12Z 令）· 交付账

分支 `g6b-flake`，基线 `a5e885185d63be6fdd0fb9f3da43aa0871df…`（a5e88518，rev-parse 见回报）。一笔前进提交，不 push，porcelain 0。
launcher blob=master **零动**；cap 门（203cac85）零动；P8b 常量完成律零动；wire 零动；工具权限零动。

## ② record-capable 能力盘点（provider 全部执行形，逐行号）

| 执行形 | 出处 | exit.json? | recordCapable | 判据面 | 拒绝形测试 |
| --- | --- | --- | --- | --- | --- |
| stream arm `spawnStreaming`/`executeStreaming` | provider.ts:695（stream argv **无条件**带 `--out-dir`）；launcher stream 臂 :498 handshake → :500 关 0/1/2 → :501 waitpid → :502 waitstatus_to_exitcode → :503-507 写 `exit.json`（OSError 仅 pass）→ :509-513 默认律 exit 0 | **恒有**（写在前、死在后 ⇒ 死后读无竞态；O_TRUNC 单写者） | **true**（provider.ts:201 接口 + :773-786 组装） | rc-first 支（glob-backend.mjs:1031） | `alpha5-g6b-rc-first.test.ts` 全套 + `a5p4-provider.test.ts` R1 腿 |
| one-shot sync arm `spawn` | provider.ts:628 argv；launcher :419-420 `emit({"executed":true,"rc":rc,…})` 走 stdout 帧，**无 exit.json** | **合法无记录** | 缺席（receipt 形状 `{lease,processIdentity}` 零动） | 该形无行消费者（行全走 spawnStreaming：shell :477/:652、search :755、glob :850） | `a5p4-provider.test.ts` R1-boundary 腿：flat 无 `payloadExit/recordCapable`，receipt 键集零动 |
| 非-prelauncher payload 形 | **不存在**（naked-spawn 臂构造上被禁，provider.ts 无该形） | — | — | — | 盘点即证（git show 全文查） |
| 行层拿到无 `recordCapable` 的 handle（pre-R1 形/合法无记录形） | glob-backend.mjs fallback 支（:1077 起） | — | 缺席 ⇒ **显式走旧 SPEECH 律逐字** | wire-code 臂 + SPEECH 臂原样 | `alpha5-g6b-rc-first.test.ts`「LEGITIMATE NO-RECORD FORM」腿（三形：note⇒walker-error、静默⇒admit、wire code 3⇒walker-exit） |

"本应存在而缺失"=红：`recordCapable===true` 而记录 missing/损坏/错绑 ⇒ `walker-error`（RECORD-UNTRUSTED 观测行），**永不**回退流判出 success——与"模式无记录"分居两支、分腿测试。

## ③ rc-first 判据（glob-backend.mjs:1031-1075）

- `recorded` 且 rc=0 ⇒ admit（stdout 完整性 cap 门在本支**之上**先行，零动）；rc=1 ⇒ admit-空列表（合法空结果）。
- rc=2 ⇒ `walker-error`（**含空 stderr 形**——旧 SPEECH 臂结构性失明形）。
- rc∉{0,1,2}（负值=信号死 -signum、137、3、未来码）⇒ `walker-exit`（既有冻结表项，exit 数字上 wire）。
- 记录 `missing/unparsable(malformed|oversize|unreadable)/pid-mismatch` ⇒ `walker-error` fail-closed，无列表、无 spill、无 exit 猜测。
- 记录绑定三件：本次 spawn 唯一 `planId` 的 `out/<planId>/`（provider.ts:575-576 mkdir 在 spawn 前）；记录 `pid`===handshake pid（provider.ts:705-715）；读在 launcher **死后**（`proc.exit.then`，provider.ts:746-748；launcher 写律 :501-507 先于 :513/:528 ⇒ 死后读=写完读）。

## ④ SPEECH 降辅助 + 沙箱安全错误分流

- 流内 stderr 在 rc 支只作 **witness**：rc 0/1 + note ⇒ admit + `anchored-glob walker-note` 观测行 + debug 内面；wire 零字（`failure()` counts 只收有限整数，A8 面零动）。
- 沙箱/launcher 拒绝**从来不经流**：probe 失败⇒`denied/confined-unavailable`（:813-816）、handshake/ABI/argv 拒⇒`denied/confined-refused`（:856-860 区）——`ProviderResult` 拒绝形，先于任何 spawn；launcher 零 sys.stderr（blob=master 现场）；payload 权限形⇒rc=2（round-6 invivo 语料）。分流测试：注入文件「sandbox refusals keep their OWN channel」腿。
- **红线核查（旧安全拒绝今被接受？）**：翻转仅发生在 **rc∈{0,1} 且流有 note** 的形；该形的安全拒绝不存在——沙箱层拒绝不落流（上段），rg 对被锁子树实测 rc=2（round-6 语料 chmod-000⇒rc=2，非 rc=0+note）。注入形 rc=0+安全错误面为**合成形**：接受它的是 rc 律（payload 自证 0），且真实链路无此形（如实注：invivo 不可确定复现 rc0+speech/rc2+静默 ⇒ 注入，root 令认可）。

## ⑤ partial-results 回归钉

- 注入：rc=2（含带部分 stdout 记录 + 有/无 speech 两形）⇒ ok=false、无 outcome、sink 零写；500 连 silent-rc2 ⇒ 0 静默判、0 泄出。
- invivo：`g6b step B: three-point-in-a-line`（可读 .ts + chmod-000 子树 + `*.ts`）⇒ 记录 rc=2、verdict 拒、sink 零写。
- **如实报**：a5e88518 消息称"测试内断言已落"，其 `--stat` 仅两枚 evidence 文件、断言**从未在树中**（grep 无）。⑤ 由本单落地并如上双钉；a5e88518 不改写。

## ⑥ 负控全套（注入形 = probe4/5 实录 spawnStreaming 形状）

provider 级（`a5p4-provider.test.ts`，fake 把记录写进 argv 的 `--out-dir` token）：recorded{0,2,-9} 逐字节、missing、malformed、oversize、pid-mismatch、rc 非整数。
行级（`alpha5-g6b-rc-first.test.ts`，conformant handle：frozen {lease,processIdentity,pid,stdin,stdout,stderr,exited,terminate}+R1 字段，真 PassThrough）：rc 0/1/2/-9/-15/137/3、missing/malformed/oversize/pid-mismatch、rc2+空 stderr、rc2+部分记录、rc0+note、截断注入（end 永不到）、exited 先/流迟（late speech 不可翻转 admit）、stderr 永不关（DRAIN-INCOMPLETE 仅观测）、close/error 早收、fallback 三形、拒绝双通道、500 连。

## ⑦ SPEECH 翻转逐条对照表

| 形 | 旧判词（SPEECH 主判） | 新判词（rc-first） | 测试 |
| --- | --- | --- | --- |
| rc0·静默·stdout 收齐 | ok | **ok（不变）** | rc-first「rc=0 silent admits」 |
| rc0·流有 note | walker-error（24/51 误判类） | **ok + walker-note 内面** | 「FLIPS to admitted」+ invivo 语料 |
| rc1·静默 | ok-空 | **ok-空（不变）** | 「rc=1 legitimate EMPTY」 |
| rc1·note | walker-error | **ok-空** | 同腿二段 |
| rc2·有 note | walker-error（经 SPEECH） | **walker-error（经 rc，判词不变、载体换）** | 「rc=2 WITH speech」+ invivo |
| rc2·空 stderr | **ok+空列表（洞）** | **walker-error** | 「SILENT stderr」+500 连 |
| rc2·部分记录 | 静默时**泄列表（洞）** | **拒，列表永不呈，sink 零** | 「partial records」+in-vivo B1 形 |
| rc<0（信号死）/137/3 | 旧臂不可见⇒**误静默（洞）** | **walker-exit** | 「outside {0,1,2}」 |
| 记录缺失/损坏/错绑 | 无此概念 | **walker-error（fail-closed）** | provider R1 负控 + 行级 4 形 |
| exited 先/流迟（capture-1 竞态类） | 竞态判词（flake 源） | **rc 定判，speech 不可翻转** | 「late speech cannot flip」 |
| cap 门未收齐 | walk-too-large | **不变（rc 支之上先行）** | 「cap gate runs BEFORE rc」 |
| 无记录形（one-shot/pre-R1 handle） | SPEECH 律 | **SPEECH 律逐字** | 「LEGITIMATE NO-RECORD FORM」 |
| probe/spawn 拒绝 | denied×2 | **不变（自有通道）** | 「sandbox refusals own channel」 |
| timedOut | cancelled+空（P8b） | **不变（rc 支之前）** | 既有 P8b 腿全数复跑 |

## cap 取值依据（复述实测）

250ms（203cac85 落定）：round-4 `probe3_streamarm 400 20 bare` 5/400 漏读、`endwait` **0/400** 收口（Node 层 end 有效，双独立复现）；结构担保=launcher :500 于 waitpid 前关 0/1/2 ⇒ 死时写端零 holder。round-3 曲线（250ms→1176/6600、2000ms→373/6600 误拒）系收口点误插 terminate **前**之旧形态；203cac85 后未收齐⇒walk-too-large（判据换轨，误拒语义消亡）。cap 门复跑：glob 套件 cap-world 腿 + 注入「cap gate runs BEFORE rc」（253ms 实测）。

## ⑧ 回归与门

见本目录 `final-*.log`（每套件逐跑）+ `final-battery-summary.txt`：A8 全套 / glob 全组（含 500 连、cap 复跑、新三点一线腿）/ rc-first 14 / provider 12 / glue7 / search（P8b 不动证）/ a5b2（shell exitPassthrough 不动证 + glob/search 无码携带钉）/ p4t6（`p4t6-red.log` 1198≠1197 → 具名入账 → `p4t6-green.log` 10/10，现场实测，无抄数）。
typecheck（runtime/testkit）绿、eslint 绿、dist 已 place+drift 过。

## 如实账（本单顺手修复与未做）

- **基线既有红 1**：500 连腿无显式 timeout（vitest 默认 5s < 本机 500 次真走查时长），基线即红在计时器而非判词（红录 `baseline-glob.log`：`Test timed out in 5000ms`，断言从未触发）。本单补显式 180_000（同族长腿先例），循环数与断言零动。
- **基线既有 typecheck 红 1**：⑤ timers 腿直用 ambient `process.getActiveResourcesInfo`（node-min 面外），HEAD 即红。本单改 house globalThis 结构面（行为逐点同，注记在码内）。
- rg 直调语义表本环境 **NOT-MEASURED-here**（@vscode/ripgrep 1.18.0 bin 未下载）；行层 invivo 语义经套件真链路实测（round-6 语料 + 本单三点一线腿），不冒充直调数。
- 未做（如实）：真实 rc0+speech / rc2+静默两形在真链路不可确定性构造（launcher 自写记录 + 真 rg 语义），由注入形覆盖（root 令认可）；probe6b 原探针文件不在树（scratch 失），其功能面（截断形 500 连、K 形竞态）由 rc-first 注入 500 连腿 + 既有 cap 腿承接。

---

# 收口轮（双独审必办落地，正向笔于 178bea59）

## 在册：worktree 污染归属（审 A 必办 1）
本轮 porcelain 曾现 `reviewA-*`/`reviewB-*` 临时 spec 目录 = **并发 reviewer 会话的临时件，非产品面**（root 21:2xZ 核定）；不入本单提交，reviewer 自删。产品面与本单文件集从未含之（提交文件清单可逐笔对账）。

## 信任边界表（收口后全表，② 补充行）
| 边界 | 谁核 | 何时 |
| --- | --- | --- |
| 记录=本次 spawn 的（planId 唯一目录，mkdir 先于 spawn） | provider（:575-576） | 建计划时 |
| 记录 pid===handshake pid | provider（readExitRecord :705-715 面） | 读时 |
| **记录 pid===handle.pid（行层第二遍，审 B 必办 2）** | **行（RECORD-UNTRUSTED form=row-pid-mismatch）** | **消费时** |
| 记录按时到达（审 B 必办 3） | 行有界等待 fuse（form=timeout ⇒ walker-error） | 消费时 |
| 记录内容与 launcher 写律一致 | launcher 单写者 O_TRUNC + 写先于死 | 写时 |

## 有界等待取值依据（审 B 必办 3）
fuse=**250ms**（cap 同源常数 GLOB_STDERR_DRAIN_MS）：记录在 launcher 死前已写完、provider 在死亡观察同 tick 同步读 ⇒ 正常路径 `payloadExit` 是已解决 promise 的微任务；250ms 是**断言保险丝非等待策略**（取测量家族最紧界；1s 只把"接线坏"糊成"接线慢"）。超时=承诺破碎 ⇒ fail-CLOSED（walker-error），fail-SLOW（暂信流）不在菜单。测试钉=payloadExit 永不到形（实测 fuse 于预算内触发，<2s 上界钉）。

## 残留判据清单 + 方向注（审 B 必办 4，本笔只挂账不删）
| 残留 | 位置 | 状态 | 方向注 | 排期 |
| --- | --- | --- | --- | --- |
| 旧 glob 行 SPEECH/wire-code 律 | plane-effect-backends.mjs:516-524 | **dormant（glue7 消费中，删=另案）** | 偏**拒**非更弱（speech⇒拒整结果），无"接受面扩大" | 与 glue7 迁移到 rc-first 行同批移除；移除腿=另案红→绿 |
| 行层 fallback 支（recordCapable≠true） | glob-backend.mjs :1077+ | 活（one-shot/测试注入形消费） | 逐字旧律，钉在 rc-first 套件 | one-shot 形出现行消费者时再议 |
| rg 共存性依赖 | 治理 argv 表 | **已钉**（review-B 行为钉 + corpus 入账） | 升级回退=测试红 | rg 升级时按钉分诊 |

## 收口必办对账
①在册（本节首条）②共存性钉=glob 套件 `g6b closing (review-B)` 腿（版本注记入断言消息+corpus 双账；行为钉为准）③行层 pid 双保险=「closing review-B」腿 form=row-pid-mismatch ④有界等待=同腿 timeout 形+依据上表 ⑤scratch law=provider `scratchRootGate`（probe/prepare/execute/executeStreaming 四入口，a5p4 4 形红→绿）+glue7 夹具补键 ⑥上表（只挂账）⑦corpus 双 shape 入账（标 reviewer 实测非作者）。
