# Alpha.6 PR-I1a 设计（2026-10-31）：`ReviewAssignment` 的唯一受治理持久化 Writer

依据：用户 2026-10-31 裁决（正本 `rulings-20261031-timed-wake-and-pr-i1.md` §2.2，PR #513）。
写路径普查：`.artifacts/alpha6-s0/pri1a-write-path-inventory`（研究子代理 c3870124，逐条 file:line；**该路径是工作区
scratch、未跟踪，reviewer 手上没有**——所以结论已在本文件 §1 以同等 file:line 完整复述，本行只作来源标注）。基线：`alpha6/lane2-pr2-assignment-20261031` @ `7b906b432`（PR2′ 内核）。

## 0. 一句话

PR2′ 交付了"归属事实"的**词汇、编码、折叠与 CAS 前置**，但没有写入者——`types.ts` A-8 明写"Durable writes go
through a port that PR-I1 wires (`allocateSequence()` + `put`, precedent `ArtifactLedgerPort.appendGranted`);
no writer exists in this PR"。PR-I1a 就是那个写入者：它把 PR2′ 的四条纯函数接到**既有 TeamDomain ledger 的唯一
耐久写入序列**上，不新建第二套账本，不进入受保护中心，不接 `allow`，默认无任何生产调用者。

## 1. 复用哪条写入路径（逐条引用，普查已 verified）

```
command → withTeamLock(root)                        // 与 control 同一把锁族：action-router/effects.ts:316
        → port.list() → foldReviewAssignmentRows    // 锁内新折叠，等价 loadControlState（control/service.ts:1766）
        → checkAssignmentMutation(state, ...)       // PR2′ 已有：epoch CAS 前置（facts.ts:574）
        → encodeAssignmentFact(kind, a, prev)       // PR2′ 已有：封闭载荷 + 授权字段拒绝（facts.ts:134）
        → port.allocateSequence()                   // storage/repositories/ledger.ts:89（宿主单链原子自增）
        → port.put(row)                             // ledger.ts:139 → putEntry :167（RECORD_DUPLICATE/no-op）
        → 读回比对                                   // 先例 control/service.ts:4628-4641 writeLegRowLocked
        → release lock
```

不新建：domain/table（`team_domain` sidecar，`schema/stores.ts:98/141` + `root-binding/harness/seam.mjs:31`）、
序列计数器（`ledger.ts:89-124` 的 `__ledger_sequence_counter`）、generation 戳（`ledger.ts:204-206` 写后同链
+1）、factType→category 图（host `projection-source.ts:300-318/363-367` 与 client `ledger-adapter.ts:97-106`
**三个 factType 双侧均已入账**，本 PR 无需改这两张图，只需新增一条腿把这条共提交法律钉住）。

## 2. 十条设计决定（reviewer 按此核对）

**D-1 唯一写入者法律（本 PR 的核心承诺）。** 本 lane 之外不得存在 `review-assignment-*` 的第二个写入者。
本 PR 用一条 hygiene 腿扫全树：除本模块外，任何生产文件出现这三个 factType 的写入即失败。

**D-2 与 ControlService 的锁不是同一把 map，为什么仍然 sound。** control 的 `teamLocks` 是服务私有闭包
（`control/service.ts:1656`），外部拿不到；进入 `control/**` 是受保护中心改动 ⇒ 属 PR-I1b 的具名接口 PR，裁决
明令不得混入 I1a。因此本 Writer 自带一把 per-root 锁。**soundness 论证（不是"应该没问题"）**：CAS 的域是本
family 的 `assignmentEpoch`，而按 D-1 只有本 Writer 会追加这三个 factType；ControlService 并发追加的是别的
family 的行，它会改变 `sequence`（单调，宿主单链原子分配，永不撕裂、永不重号）但不会改变 `assignmentEpoch`，
也不会改变本 family 折叠出的 `epochApplied`。⇒ 两把锁保护的是**不相交的可变状态**。
**该论证给 PR-I1b 留下一个硬前置条件**（写进本文件与代码 doc）：将来若把 assignment 写入接进 control 路径，
必须**路由到本 Writer**，不得在中心内重写一遍；否则两条锁保护同一状态 = CAS 失效。

**D-3 CAS 两层。** 载荷里携带 `expectedPreviousEpoch`（A-2），写前由 `checkAssignmentMutation` 判，写后由
`foldReviewAssignmentRows` 复核（不匹配 ⇒ diagnostic + `unreconciled`）；两者之间是同一把锁内的一次读写。

**D-4 幂等 = 锁内 epoch 短路，不是靠字节相同。** `createdAt` 由调用方提供（见 D-6），因此同一条命令的两次重放
不会字节相同，宿主的 byte-identical no-op 规则（`ledger.ts:162-208`）只是兜底。真正的幂等是：折叠后若该 case
已处于目标 epoch 且载荷与本次将要写入的**逐字段相等**，返回 `applied: 'already'` + 既有行，不再分配序列。
（先例：`requestControl` 的 deterministic requestId + 既有行短路 `control/service.ts:2403-2430`。）
**实现期补一句被测量改写的措辞（见 §2b R-8）**：幂等的身份就是**载荷本身**（epoch 作用域下逐字段相等）。
因此「把当前已经是目标的那个 target 再指派一次」会得到 `applied:'already'` + 原行序列号，而**不是**
`TARGET_UNCHANGED` —— 因为除 reason 外没有任何事实能区分两者；把 reason 换掉，它立刻变成一条新决定，
被 kernel 拒为 `TARGET_UNCHANGED`。两条腿分别钉住这两种诚实答案。

**D-5 无回滚，只有 roll-forward。** 全仓没有 rollback 原语（普查 §1）；失败一律 typed refusal，写失败 ⇒
`REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED` 且未追加任何行；读回与提交不一致 ⇒ `REVIEW_ASSIGNMENT_READBACK_MISMATCH`
（行仍在账本里——诚实报告，不假装撤回）。重试补全半成品是既有模型（`closeZeroReviewCaseTransactionally`
`service.ts:5288-5390`），本 Writer 的每个命令都可安全重试（D-4）。

**D-6 Writer 不读时钟、不做 I/O（A-8 延伸）；时钟是注入端口。** 时间戳、序列号、行写入全部经端口：
`ReviewAssignmentStoreDeps.now(): string`（先例 = `governance/proposal-store.ts` 的 `GovernanceProposalStoreDeps`，
本仓已有的「耐久 store 由调用方给时间」形状）。因此 Writer 的测试是确定性的，重启测试靠 close+re-open 而不是靠等时间。
**本节原稿写的校验方式已被本 PR 自己的 hygiene 腿推翻并替换**（见 §2b R-2）：原稿要求
`!Number.isFinite(Date.parse(createdAt))`，而 `Date.parse` 正是 `a6-pr2-lane-hygiene` 的 clock needle 之一 ——
即「用被禁的时钟去校验别人的时钟」。现改为两层纯字符串/算术判断：形状 = 抄自 contracts 的
`ISO_8601_TIMESTAMP_PATTERN`（`contracts/src/dto/common.ts:25`；该 barrel **不** re-export 它，且本 lane 的 import
allow-list 不含 deep path，故采取「复制 + 一条腿读回 contracts 源码要求两者字面相同」，而不是拓宽 allow-list 或改冻结 barrel），
外加一层日历范围（月 1..12、按月的日上限、闰年规则、时分秒上限）。范围层的理由是被测出来的：结构模式接受
`2026-13-45T99:99:99Z`，而真实账本会拒收它 —— 于是坏时钟的表现变成「序列号已花掉、行写失败」，
而诚实的答案是「你的时钟读不懂，且我什么都没分配」。

**D-7 所有权与隔离用既有权威，不自造。** `rootSessionId` 是 Team key；写入前校验：命令的 root、账本行的
root、以及既有 assignment 行载荷里的 root（**round-1 更正措辞**：命令 root 对行 root 是**过滤**——别队的行被排除出
本次折叠，这正是隔离机制本身；真正**拒绝**写入的是载荷 root 与所在行 root 不一致，即一条挂错队伍的行。代码注释
写对了，是这句话此前把它压缩成了「三者一致」：不一致 ⇒ `REVIEW_ASSIGNMENT_WRITE_CROSS_TEAM_ROW`，
并在 detail 里点名那条 `factType@sequence`；**原稿这里写的是一个不存在的代码名 `REVIEW_ASSIGNMENT_TEAM_MISMATCH`，
已按实现更正**）；跨 Case 写入 ⇒（同一队两 case 的隔离由 kernel 三态负责，见下）
`checkAssignmentMutation` 的 `LEG_MISMATCH` / `ALREADY_ACTIVE` / `NO_ACTIVE_ASSIGNMENT` 三态拒绝；corrupt 行 ⇒
折叠 diagnostics + `ROW_UNPARSEABLE` **拒绝写入**，绝不"当没有这行"继续。
**明确拒绝复制的既有缺陷**：control 折叠对已知类型的 decision/abandon/escalation 载荷损坏是**静默丢弃**
（`service.ts:1801-1812`，普查标为不对称），本 lane 采 A-7"读不懂的行是诊断，不是干净白板"。

**D-8 不加第四种 factType。** PR2′ 的 `REVIEW_ROUTER_REASON_CODES` 里有 `LEADER_LEG_MOVED` /
`LEADER_ASSIGNMENT_RETIRED`，因为没有任何一种行可以指派"新 leg"（`facts.ts` 附近注释明写：若 PR-I1 需要跨 leg
指派，必须**公开新增行种类**）。本 PR 选择**不新增**：跨 leg 场景照旧由 Leader 承接（= Alpha.6 之前的行为），
限制显式写在代码 doc 与本文件；将来若要，动作是"同时改 host+client 两张 category 图 + 增 factType + 增折叠分支"
的公开变更，不是偷偷多写一个字段。

**D-9 授权字段防线在编码处，Writer 不放宽。** `facts.ts` 的 denylist（授权键出现 ⇒
`REVIEW_ASSIGNMENT_AUTHORITY_FIELD_PRESENT`，`facts.ts:66-89/216-240`）保持不变；Writer 在写回后解码自己写入的
行（`decodeAssignmentPayload`）再比对，等于把"我写的确实是封闭载荷"再证一次。A-1 的机器形态由此覆盖到耐久面：
账本里的 assignment 行**结构上不可能**携带授权语义。

**D-10 本轮 dormancy 与证据边界（不许夸大）。** 本 PR 交付 Writer + 端口 + 测试；**零生产调用者**（PR2′ 的
dormancy 扫描继续成立，`ALLOWED_CONSUMERS=[]` 不变；lane 模块集合按规范新增一项 `writer.ts` 到
`EXTRA_MODULES_ALLOWED` 并写明理由——该常数是设计好的修订点，spec 自己提到"a 6th lane module"）。
证据等级：C1 = 用 `packages/storage/test/p4-helpers.ts` 里**与公开 StorageDomain 合同逐条同形**的 seam fake
（含 per-domain 写链、`setCrashAfterWrites` 崩溃模拟、close+re-open 持久态）驱动**真实的
`LedgerRepository`**；不是手写假对象。C2（真 Host 世界写读回）仍 ENV_BLOCK，不记 PASS。
**本 PR 不声称**：真实 Host 上的并发对账、跨代重启后的投影呈现、以及与 control 路径在同一把锁下的 interleaving
——这些需要 PR-I1b 的接线与单所有者 C2 运行。

## 2b. 实现期修订（R-1..R-8 实现期，R-9..R-13 round-1 独立复核后：每条给证据）

裁决要求「不允许静默重定义」，因此每条都写明：原状态、被什么推翻、现在的法律、钉住它的腿。

**R-1 `kind` 是 factType 表的**键**，不是它的**值**。** 第一版 Writer 的门禁写成
`Object.values(REVIEW_ASSIGNMENT_FACT_TYPES).includes(command.kind)`，于是**每一条合法命令都被拒为 malformed**
（`created` 是键，`review-assignment-created` 是值）。失败的**方向**是安全的（写不出来的写入者比写错的好），
但这正是调用方会犯的混淆，所以 `a6-pri1a-writer.test.ts` 增加一条腿：把**值**当 `kind` 传进来，必须被拒，
且 detail 说明要的是三个键。测试第一次跑红的原因就是这条，写在 `writer.ts` 的注释里而不是藏起来。

**R-2 时钟校验换成「形状 + 日历范围」两层**：见 D-6。钉住它的腿喂 8 种坏形状（含月 13、45 日、2026-02-30、
second=60），并要求 `writeCount` 纹丝不动 —— 即「分配之前就把坏时钟挡掉」是可测的，不是承诺。

**R-3 折叠不可调和的 refusal detail 必须点名行。** 原稿只列诊断**代码**；是一条关于锁的腿（R-6）在断言
「detail 里要有 sequence」时把它抓出来的。现在 detail 里带前 8 个 `factType@sequence` 句柄，其余以 `+N more` 计数，
并有一条腿用 10 条坏行钉住「列 8 条 + 计 2 条 + 整串 < 1200 字符」：refusal 不是日志倾倒。

**R-4 退休在当前行词汇里是该 Case 的**终点**。** 本意写「退休后再写一条 created」，Writer 拒了，于是去读 kernel
而不是改代码：`checkAssignmentMutation` 只在**从未产生过 assignment** 时接受 `created`，只在 assignment **live** 时
接受 `transferred`/`retired`。⇒ 同一 case 退休后三种行**都**写不进去（`ALREADY_ACTIVE` / `NO_ACTIVE_ASSIGNMENT`），
这是 PR2′ kernel 的可见限制，不是本 Writer 的缺陷，也**不在本 PR 里靠加第四种行种类糊过去**（那要走 D-8 的公开变更）。
腿同时钉住「终点性是按 case、不是按 team」：同队另一个 case 完全不受影响。
**后果写清楚，别让 reviewer 猜**：跨 leg / 退休之后的案子照 D-8 由 Leader 承接，行为与 Alpha.6 之前一致；
本 Writer 不新增能力，只是**不假装**它有这个能力。

**R-5 Writer 证明的是「这串 id 是个 id」，永远不是「这支队伍存在」。** `session/../../etc` 能通过契约的 root 解析
（`assertSessionIdValue` 只查：是字符串、无空白/控制字符、有长度上限），但被本 lane 自己的 id 语法
（`facts.ts:41`，不含 `/`）拒为 `INPUT_MALFORMED`。三层屏幕（契约解析 → lane 载荷语法 → 耐久层）各自点名自己那层，
不合并成一个代码。**由此给 PR-I1b 留一条硬前置**：确认 root 是「宿主真的开过的那支 Team」只能在 admission 层做
（只有它见过 TeamSession）；写入者若自造这项检查，就是在发明事实。

**R-6 注入锁是承重的，本 PR 用一条腿把不承重的后果写进耐久字节。** 该腿交一个只记录调用、不串行的 `withLock`，
两条并发 transfer 于是都写下 `assignmentEpoch: 2, previousEpoch: 1`（两行同 epoch），下一次折叠以
`REVIEW_ASSIGNMENT_EPOCH_CONFLICT` 拒绝成状态。这不是 Writer 的 bug —— 插件层无法把 append-only 账本变原子 ——
而是 D-2 的**证据**，也是「PR-I1b 必须路由到本 Writer、不得在中心里重写序列号」的实证理由。

**R-7 epoch 唯一性依赖调用方的锁，而不依赖 Writer 的读后写。** 同一把 per-root FIFO 锁下，两条并发 mutation 得到
epoch 2 与 3（腿钉住 `[2,3]` 与 sequence 互不相同）；换掉锁就退化成 R-6。因此 `ReviewAssignmentLockPort` 是合同的一部分，
不是可选优化；注入点必须在与 control 相同的那支 Team 的锁上（D-2 不相交状态论证的前提）。

**R-8 幂等身份 = 载荷**：见 D-4 的补充。两条腿分别钉 `already`（同决定重发）与 `TARGET_UNCHANGED`（换 reason）。

### round-1 独立复核（#517，head `1a60b9e26`）之后的修订

**R-9 三种答案的第三种必须有生产者。** 模块顶上的法律写着每条失败路径都要说清三件事之一：什么都没分配 /
分配了但没写进去 / **有一行是耐久的，它的 sequence 在此**。round-1 用一个「合法 root 但不存在 TeamSession 行」
的世界把它打通：`LedgerRepository.putEntry` 先落账本行、**再**推进 session generation
（`storage/repositories/ledger.ts:201`/`:214`，缺行时 `team-sessions.ts:119` 抛 `missing-key`），
于是 put 抛出**之后**行已经耐久，而 catch 无条件说「该 sequence 上不存在 assignment 行」，重试又回答 `already`
—— 同一条命令给出两个互斥断言。修法不是改措辞而是**先看再说**：catch 里重读 ledger，命中 ⇒ 新代码
`REVIEW_ASSIGNMENT_ROW_DURABLE` + detail 点名 `factType@sequence`；未命中 ⇒ 保留原句子，但加上「已重读」。
钉住它的腿是 `says the truth about what is durable when the append lands and the stamp fails`，它同时断言旧句子
**不出现**、耐久行集合 == [1]、重试 `already` 且 sequence 1；harness 新增 `seedSession:false` 才第一次能表达这个
状态（此前唯一的无队伍腿用 `session/../../etc`，在本 lane 的 id 语法上就死了，永远到不了 put）。
复核者的 A3-LIE / A3b 两条攻击在本头现在**失败**（断言旧谎言），这是修复生效的可复现证据。

**R-10 「扫描全仓库找任何写入者」在动词表上漏掉了本仓库自己的漏斗。** 探测器的动词集合原本只有
`.put(` / `.putEntry(` / `allocateSequence(`，而 `action-router/effects.ts:1306` 的
`commitDurableFact(repositories, root, now, factType, payload)` **内部**就会分配 sequence 并 put：一个用位置参数
传族名、自己不写 `.put(` 的模块能造出本族的耐久行而 28 条 hygiene 腿全绿。现在 `commitDurableFact\s*\(` 是第四个
动词，且探测器重写成纯函数 `convicts(path, text, inLane)`，仓库扫描与 plant 走**同一段代码**；每个 alternative
一个 plant，plant 的键集合用 `toEqual` 钉在 alternative 表上（少一个 alternative 或多一个 plant 都红），另有两条
负控制（合法读取者、以及在注释里**提到**被禁调用的法律文字）。披露残余：这是文本扫描，跨多跳别名的族名、以及它
不读的文件（测试源、未跟踪文件）在它视野之外 —— 所以这条腿真正支持的说法是「除 Writer 外没有任何被跟踪的生产源
同时含有族名与通往账本的路径」，PR 正文按这句话写。

**R-11 closed-set 的「封闭」曾经只封闭一种拼写。** 派生只认 `factType: '<字面量>'`（单引号），既不认双引号也不认
`'a' + 'b'`；后者是编译期完全确定的值，却被丢进 unresolved 名单里无人阅读 —— 于是未注册的拼法可以一路绿过去。
现在两种拼法都解析（`stringLiteralText` / `resolvedLiteralText`），拼出来的值直接进入 closed-set 判定（C2 会要求它
有 host category）；真正静态不可解的（例如两个常量相加）仍然**点名**进 unresolved，由 C5 钉住。分类集合也加宽到
任何引号与计算式标签 —— 在本树实测**不新增任何文件**，即加宽不带来新的噪声。新增 `C1d` 腿把五种 plant 直接喂给
上述真函数：四种写入形状都被分类、族名都能被派生、`sneaky-fact-x` 成为**值**且 `HOST.has(...)` 为假（即 C2 会在
真实树上判它红），只有常量拼接留在 unresolved。为什么在这里跑 plant 而不是往复制树里丢文件：本 guard 读
`git ls-files`， planted 文件可不可见是 checkout 的性质，不是探测器的性质。

**R-12 折叠诚实的前提是 reader 诚实，这一点现在是合同文字并被测量。** 文档写「折叠取自账本」，但端口是注入的：
round-1 用一层过滤 wrapper 藏掉 sequence 1 的那一行，第二次 `created` 被接受，家族最终有**两条活行同处 epoch 1**
（CAS 并非失败，而是无可冲突）。Writer 在自己的座位上无法检测「看不见的那一行」，所以这条不是可关闭的缺陷而是
适配器的义务：`ReviewAssignmentLedgerReaderPort` 的文档明确「未过滤、不截断、不陈旧的读属于端口合同，本模块无法
检测遗漏」，并由 `cannot see a reader that hides a row...` 一条腿测量后果（两行、epoch 集合 [1]、同命令在诚实读下
被拒），同时用 readFileSync 钉住那句文档**存在** —— 没人跑的文档句就是没人负责的文档句。

**R-13 一条静态恒真的断言被换成手写名单。** census 腿里原本写着 `expect([...SET].sort()).toEqual([...SET].sort())`：
自我比较，任何取值都为真，是这 38 条里唯一装饰性的一条（同一腿的其余断言在 M2/M3/M6/M7 变异下会红）。现在改为
手写八个代码的期望列表 + 唯一性 + 前缀约定；也正因为它，本 PR 的自有代码从 7 个变成 8 个（R-9 的新代码），census
依然要求「声明的都被产生过」。

**R-14 R-9 的修复自己引入了一个新的异常出口，是本人在写结案说明时自己发现并先写腿再修的。** R-9 让 catch
去重读账本，但 `deps.ledger.list()` 同样是注入端口：一个第二次读就抛的 reader 会让「我这行落了吗」这个问题
以异常形式逃出模块 —— 恰是本模块开头唯一那条法律（refusal 是回答，异常不是回答）禁止的事。现在重读被自己的
try 包住，读不动时给第三种诚实答案：`REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED` + detail 明说**既可能耐久也可能
不存在**，并说明重发同一命令会如何把问题答出来（在 ⇒ `already`，不在 ⇒ 下一个 sequence 落账）。
钉住它的腿是 `answers with a refusal rather than an exception when even the re-read fails`（先跑红，确认
异常确实从 `writer.ts` 的重读处逃出，再加保护）。法律不是"修完就完"：**修完的东西是新的攻击面**，这条就是。

方法条目（进 SESSION_ROUTER_LOG）：**写结案说明本身就是自查手段** —— 这条不是复核者找到的，是把 F1 的修法
逐句写成文字、问到自己修法新增的每一次调用时会怎样失败之后找到的。

## 3. 覆盖映射（用户裁决六条 → 测试腿）

| 裁决要求 | 实现位置 | 实际钉住它的腿（`a6-pri1a-writer.test.ts`，38 条，全部走**真实** `LedgerRepository`） |
| --- | --- | --- |
| 创建/转交/退休写入 + 恢复 | `writer.ts` 三个命令 + 折叠 | ①三行按 epoch 1/2/3 与 sequence 顺序落账（读回 ledger 字节，不看返回值）；②`team_sessions.generation` +1（S1-A hook A：证明它是「一条账本行」而不只是一个 ok）；③close+re-open 后折叠重建同一状态，新 Writer 追加 epoch 3；④重启后重放 ⇒ `already` + 原 sequence；⑤分配后写失败 ⇒ 点名花掉的 sequence，清障后重试在**可见的洞**上前进（行 [1,3]，epoch 2，diagnostics 空）；㉝落账成功但盖章失败 ⇒ `ROW_DURABLE` + 点名 `review-assignment-created@1` + 旧谎言**不出现** + 重试 `already`@1（R-9） |
| Epoch/CAS、幂等、并发冲突、写失败 | D-3/D-4/D-5 + R-7/R-8 | ⑥同命令立即重放：`already` 且 `writeCount` 不变、行数不变；⑦换 reason ⇒ 不是重放（`ALREADY_ACTIVE`），行数不变；⑧两条并发同命令 ⇒ 一写一 already、同一 sequence、只一行；⑨两条并发 mutation ⇒ epoch [2,3]、sequence 互不相同、对「已当前」的 target 重发是 `already`、换 reason 是 `TARGET_UNCHANGED`；⑩四种非法 sequence（0/-1/1.5/MAX+1）各自拒且零行；⑪分配失败腿 detail 含 allocate；⑫坏 root/坏命令 ⇒ `writeCount` 不变 |
| Ledger 所有权校验、跨 Case/Team 隔离、损坏诊断 | D-7 + R-3/R-5 | ⑬两支队伍共用同一 caseId 各自独立折叠与独立 epoch；⑭挂本 root 但载荷指向他队的行 ⇒ `WRITE_CROSS_TEAM_ROW` + 点名 `factType@sequence`，坏行**留在原地**不隐藏；⑮未知字段/授权键行 ⇒ `WRITE_FOLD_UNRECONCILED` 且 detail 点名诊断码（与 `control/service.ts:1801-1812` 的静默丢弃**正相反**，有专门一条腿钉这点）；⑯10 条坏行 ⇒ 列 8 个句柄 + `+2 more` + detail < 1200 字符；⑰同队两 case 独立 epoch 链；⑱契约解析拒绝的 4 种 root ⇒ 先对**解析器本身**断言抛错，再要求 `WRITE_ROOT_UNMINTABLE` 且零锁零写；⑲`session/../../etc` 能 mint、被 lane 语法拒（R-5 的披露） |
| host/client factType-category 一致 + 重启后 Projection 重建 | §1 的双侧图 + 本 PR 的耐久半边 | ⑳写入的字符串与 `projection-source.ts` 里那三个字面量逐字节相同（腿直接读该文件要求三个字面量都在）；㉑`createdAt` 与 contracts 的 `ISO_8601_TIMESTAMP_PATTERN` **字面同源**（读回 contracts 源码比对）。**category 两侧各自的钉法不在本文件重复**：host 侧 = `a6-pr2-assignment-kernel.test.ts` 的 mirror pin（沿 factType 字面量走到 `FACT_TYPE_CATEGORY` 条目并要求 `team`），client 侧 = `packages/client/test/ledger-adapter.test.ts` 的行为腿（三行进 `team`、badge 不亮）；本 PR 补的正是此前不存在的那一半 —— **耐久行里真的是这三个字符串**。**真实宿主投影的重启呈现仍是 C2/ENV_BLOCK，不记 PASS** |
| Assignment 非授权凭据 | D-9 | ㉒耐久载荷键集合 == `REVIEW_ASSIGNMENT_PAYLOAD_FIELDS`（最强形式：封闭集之外无键），且其中无 authorit/permission/grant/credential/token/allowed 命中；㉓绕过 Writer、在编码之后往 `put` 载荷里塞 `authority` ⇒ 被**读回**抓为 `READBACK_MISMATCH`（不是被接受） |
| 无法证明即退回 Leader，禁止由空/缺失记录推导允许 | D-8 + `checkAssignmentMutation` + R-4 | ㉔空 case 上 `transferred` ⇒ `NO_ACTIVE_ASSIGNMENT` 且零行（不会顺手创建 assignment）；㉕空状态对三种 caller × 三个 epoch 一律不允（`maySubmitFor` 全拒）；㉖退休后三种命令全拒且零新行，同队另一 case 不受影响（R-4） |
| （额外）锁纪律与拒绝词表 census | D-2/D-10 + R-6/R-7 | ㉗每命令恰好一次 `withLock`、key 是 minted root、绝不重入（peak depth 1）；㉘两根并发 ⇒ peak depth 2（**这正是**「不是全局锁」的证据）；㉙声明的 8 个自有代码**全部被产生过**（期望列表手写，见 R-13）、产生的每个 passthrough 代码都属于 kernel 词表、两个词表不相交；㉚9 种敌意命令形状一律 typed refusal 不抛异常；㉛账本谎报一行 ⇒ `ROW_UNPARSEABLE` 在 detail 里；㉜R-6 的不承重锁腿；㉞reader 藏行 ⇒ 两条活行同 epoch 的后果被测量 + 端口合同的文档句被钉住（R-12） |

**未在本 PR 测量（不假装）**：真实宿主世界上的并发对账与重启后的客户端呈现（C2 = ENV_BLOCK）；与 control 路径共享
同一把锁时的 interleaving（需 PR-I1b 接线）；投影在真实客户端 store 里跨代的重建（PR-I1a 只承诺写进去的字节与两侧图一致）。

## 4. 已知不可从本树决定（留给后续，不假装解决）

- **teamLock 共享的治理选择**：把 Writer 接进生产路径时，是用注入的共享锁 map（需宿主侧注入）还是保持两把锁
  （D-2 的论证成立但前提是 D-1）；普查明确"树能定价选项，不替我们选"。本 PR 把两把锁方案连同论证一起交付，
  并把"唯一写入者"钉成可扫的法律。
- **`basedOnCaseVersion` 没有版本代数**（`facts.ts:145-146` 只要求 hygienic id）：Writer 只能等值比较，不能判
  新旧；将来若需要"版本必须前进"，那是一个新法律，需要新裁决。
- **真实 Host 的并发/重启形态**：需 PR-I1b 接线后单所有者 C2。
- **退休后的 case 无法再获得 assignment（R-4）**：树能证明的是 `checkAssignmentMutation` 的三条规则与由此产生的终点性；
  要不要给「重新指派一条新 leg」一个公开的行种类，是 D-8 那条公开变更的决策，需要新裁决 + host/client 两张 category
  图同步，本 PR 不替它选。
- **目标可以是 Leader 实例，而路由面拒绝它**（round-1 A4a）：`checkAssignmentMutation` 不校验
  `target.instanceId` 是否等于 `LEADER_INSTANCE_ID`，于是 Writer 会把「把某条 leg 指派给 Leader 自己」写成耐久行，
  而 `router.ts:1795` 的 `TARGET_IS_LEADER_INSTANCE` 在路由面拒绝同一形状；`maySubmitFor` 之后还会承认一个
  **自称**该实例、`isLeaderInstance:false` 的 caller。A-1 未被破坏（行不授予任何权限），但「受治理的耐久路径比
  未接线的路由面更宽」是反向的。决定：**不在本 PR 偷偷加第四条校验**（那会改变 kernel 语义，属新法律），
  而是把「admission 必须拒绝 Leader 实例作为 assignment 目标，或明确解释为何允许」写成 PR-I1b 的具名义务。
- **确认「这支队伍真的存在」不在本层**（R-5）：树能定价的是三幕屏幕各挡什么、`session/../../etc` 停在哪一幕；
  把存在性检查放到哪里属 PR-I1b 的 admission 设计。
