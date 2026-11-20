# UTE-2 — Execution Settlement S1：一次物理执行，一份规范事实

**日期**：2026-11-20（真实 UTC；读写时锚点）
**分支**：`task/ute2-settlement-20261120`（worktree `.worktrees/ute2-settlement-20261120`，base `origin/master 06de9751a`，已合入本分支）
**层次**：UTE G1 / 工作包 3（`docs/plans/memo/unified-tool-execution-dsh-022-20261114/07-SETTLEMENT-RECOVERY.md` §3–§6 与 `06-STATE-MACHINES.md` §3 的 S1 部分）
**证据**：`dev/agent-workflow/evidence/ute2-settlement-20261120/`（逐字 transcript + 变异记录）
**结论先行**：一个**加成式、未接线**的产品模块 `packages/runtime/settlement/execution-settlement.ts`（store）与其 UTE-1 合同适配器 `packages/runtime/settlement/writer-adapter.ts` 已落地并公开导出为 `@dsh-agent-team/runtime/settlement`；它把一次物理执行写成**恰好一条**规范事实，按 `ExecutionId` 幂等，重复相同事实是具名 `DUPLICATE_SETTLEMENT` no-op，不同事实是具名 `SETTLEMENT_CONFLICT` 拒绝（无 last-writer-wins），非法状态跃迁按**名字**拒绝（`ILLEGAL_TRANSITION`）；Stop 在效果前 / 中 / 后各自有正确的终态；**真实 SIGKILL 子进程**恢复为 `UNKNOWN`（不是 `COMPLETED`，不是 `REFUSED`），并点名缺失的证据；模块**没有**任何签发/否决/扩权路径（结构测试 + 变异负控）；记录以“临时文件 + fsync + 原子 rename + **父目录 fsync**”的**带校验和信封**发布，截断/篡改/半写永远不会被读成完整记录；`recordAdmission` 返回即代表准入事实已耐久（返回后立刻 SIGKILL 也不会丢、不会变成 COMPLETED）；每个 root 有**排他写者锁**（活着的异进程 = 具名 `SETTLEMENT_WRITER_CONFLICT`，可证明已死的 pid = 具名证据行后回收）。合同适配器实现 UTE-1 §3 的 `ExecutionSettlementWriter`（`record/read/listUnsettled/projectControlResult`），`projectControlResult` 只是既有 `ControlService.recordExecutionResult` 结果的**读兼容投影**，不写第二权威、不伪造 `requestId`。15 个变异负控全部把各自的控制打红（20/20 用例）。**它没有被接进任何生产路径**；S2（durable-before-Host-returns）明确**未**声明，且被显式记为 `CORE_SEAM_BLOCKER`。

## 1. 交付物与“未接线”声明

| 文件 | 性质 |
| --- | --- |
| `packages/runtime/settlement/execution-settlement.ts` | 新模块（记录器 + 原子持久化 + 状态机） |
| `packages/runtime/settlement/writer-adapter.ts` | UTE-1 §3 合同适配器（结构类型 + store 转移派生；**零运行时 import**） |
| `packages/runtime/settlement/index.ts` | 公开入口（store + adapter 的加成式 re-export） |
| `packages/runtime/package.json` | **加成式** `exports["./settlement"]`（不改任何既有子路径） |
| `packages/runtime/tsconfig{,.build}.json` | 仅把 `settlement` 加入 include（typecheck + build 覆盖；与 `review-wake` 同一先例） |
| `tests/ute2-settlement/settlement.test.mjs` | 主套件（20 个 `node:test` 用例，host-free；含 adapter / fsync / 锁 / durable-admission 崩溃窗） |
| `tests/ute2-settlement/lib/mutations.mjs` | 变异负控（15 个 mutant + 15 个公开面场景，含 `target:'adapter'`） |
| `packages/testkit/test/p4t6-bookings/ute2settlement.json` | p4t6 冻结扫描的 lane booking（3 个 paths，1519→1522） |
| `dev/agent-workflow/evidence/ute2-settlement-20261120/{CRASH-WINDOW,WRITER-LOCK,FSYNC-ORDERING,P4T6}.txt` | 本轮新增测量（真实子进程 SIGKILL / 锁冲突与回收 / fsync 顺序 / p4t6 20/20） |
| `.github/workflows/census-runtime.yml` + `dev/ci/eb3-ci-manifest.json` | 套件加入 census “next host lane” argv；两侧 argv 逐字一致（C-NH1 从 manifest 派生校验） |

**未接线在本 PR 中是事实，不是省略**：全仓没有任何生产文件 import `settlement`；
`packages/runtime/src/**`、`product-assembly.ts`、`install.ts`、`mount.ts`、`a5sf-realm-row.mjs`、
Authority 指针/快照、Member 生命周期文件**均未改动**（`git diff origin/master --stat` 只含上表）。
把它接进 `tools/execute` 的执行路径是**另一个**受审变更（G1-S3 的 adapter 半场），本 PR 不冒充完成。

## 2. 状态机（显式、按名拒绝）

```text
ADMITTED ──enterRunning──▶ RUNNING ──settle──▶ COMPLETED
   │                          │                FAILED
   │                          │                CANCELLED
   ├──settle(REFUSED)          └──settle──▶     UNKNOWN
   ├──settle(CANCELLED)
   └──settle(UNKNOWN)
```

| 迁移 | 允许来源 | 语义 |
| --- | --- | --- |
| `ADMITTED` | （初始，`recordAdmission`） | 记录一条**已由 ControlService 裁决**的准入引用；`dispatch = not-started`，零效果 |
| `RUNNING` | `ADMITTED` | 分发已进入（`DISPATCH_ENTERED ≠ body 已开始`）；`dispatch ≠ not-started` |
| `COMPLETED` | `RUNNING` | `bodyOutcome=completed`，`dispatch ∈ {started, quiesced}`，`effectEvidence ∈ {none-confirmed, observed}` |
| `FAILED` | `RUNNING` | `bodyOutcome=failed`；可携带 observed 效果（失败 ≠ 无副作用） |
| `CANCELLED` | `ADMITTED` / `RUNNING` | 必须有对应相位的 Stop 证据；`ADMITTED` 要求 `pre-dispatch`，`RUNNING` 要求 `in-flight` |
| `REFUSED` | `ADMITTED` | `dispatch=not-started`、零效果，且**引用的裁决记录必须是 `deny`** |
| `UNKNOWN` | `ADMITTED` / `RUNNING` | 结果不可证；必须给出非空的 `missingEvidence`，且不得声称 `none-confirmed` |

终态全部**不可再迁移**。`settle()` 只接受终态（`RUNNING` 交给 `enterRunning`）；
`assertLegalTransition(from, to)` 是唯一闸门，拒绝时 `code=ILLEGAL_TRANSITION`，`details` 带
`{from, to, allowed}`——记录**原样保留**，不会被“修正”到某个合法状态。
转换日志 `transitions[]` 的 `seq` 严格递增、`from` 必须接上一条的 `to`、`at` 非递减
（回退时间 `SETTLEMENT_TIMESTAMP_REGRESSION`），`state` 恒等于最后一条的 `to`，
`updatedAt` 恒等于最后一条的 `at`（Stop 是加成事件，不改 `updatedAt`）。
读回时 `validateRecordPayload` **重新校验**这条链；非法链 = `SETTLEMENT_CORRUPT`。

## 3. 不变量

1. **一份事实 / 一次物理执行**（UTE-15）。`ExecutionId` 是唯一归属键，`list()` 中同一 id 至多一条记录；
   `ExecutionId` 同时是文件名（字符集 `[A-Za-z0-9][A-Za-z0-9._:-]{0,199}`，杜绝路径注入）。
2. **没有第二个 Grant / 权威**（UTE-13，本模块最重要的一条）。模块**不 import** `packages/runtime/control`；
   不接受 policy / resolver / grant-table 构造参数；公开面没有任何 `admit/allow/deny/grant/authorize/approve/permit/revoke/decide`
   形状的函数；没有 `createAdmissionReference` 工厂。它只接受**已存在裁决的不可变引用**
   `{decisionId, decisionDigest(64-hex sha256), decision:'allow'|'deny', decisionKind, subjectExecutionId}`，
   拒绝缺少/伪造摘要的引用（`SETTLEMENT_ADMISSION_REFERENCE_INVALID`）。它与引用不一致时拒绝
   （`SETTLEMENT_ADMISSION_MISMATCH`）——这是**记录一致性**检查，不是重新裁决。
   **引用型准入**（`admissionKind: 'control-request-reference' | 'no-control-request'`）只为合同事实而存在：
   它只绑定 `requestIds`（或“本执行没有任何 control request”），**不携带 `decision`**，因此适配器
   不需要、也不被允许为它没观察到的裁决编一个 allow/deny。`REFUSED` 可以引用 deny，也可以引用
   引用型准入；它**永远不能**与记录为 `allow` 的准入共存（`SETTLEMENT_ADMISSION_MISMATCH`）。
3. **同一 ExecutionId 幂等**。相同事实重复写 → 同一条记录 + `DUPLICATE_SETTLEMENT`；
   不同事实 → `SETTLEMENT_CONFLICT`，原记录字节不变（测试比较写前/写后文件字节）。
4. **越权归属拒绝**。引用里的 `subjectExecutionId`、观察里的 `executionId` 必须等于本记录的
   `ExecutionId`，否则 `SETTLEMENT_CROSS_WIRED`；两笔结算互相串线（A 的观察写进 B）被拒绝。
   读回时也复验（篡改归属 → `SETTLEMENT_CORRUPT`）。
5. **效果与证据同轴**。`effectEvidence='observed'` **当且仅当**至少一条 `observedEffects`
   带非空 `evidenceId`；只声称“已观察”而没有观察 = `EFFECT_CLAIM_WITHOUT_OBSERVATION`；
   反之把观察列表藏在 `none-confirmed` 后面同样拒绝。Host `isError`、后端 exit/kill、物理效果
   是 `dispatch` / `bodyOutcome` / `effectEvidence` 三个独立轴（UTE-16）。
6. **Stop 只记录、不裁决**。`recordStop` 记录 `{stopId, at, phase}`；相位必须与当前状态匹配
   （`pre-dispatch`↔`ADMITTED`、`in-flight`↔`RUNNING`、`post-completion`↔`COMPLETED|FAILED`），
   错位 = `ILLEGAL_STOP_TIMING`。该模块不请求、不传播、不执行 Stop。
7. **记录自身崩溃安全**（见 §5）。
8. **读回不信任磁盘**。信封 schema、`sha256` 校验和、payload 结构、状态链、身份归属全部复验；
   任何一项失败 = `SETTLEMENT_CORRUPT`，绝不“当作不存在”或“当作完整”。
9. **合同写入面是适配器，不是第二权威**（`writer-adapter.ts`）。它只导出
   `createExecutionSettlementWriter(store, clock?)`，结构上实现 UTE-1 §3 的
   `record/read/listUnsettled/projectControlResult`；**零运行时 import**（类型 import 在运行时被擦除），
   因此既 import 不到 `packages/runtime/control`，也 import 不到 store 的裁决词汇。`record` 只做
   “事实 → store 转移”的派生；第二次终态是 `DUPLICATE_SETTLEMENT`（同核）或 `SETTLEMENT_CONFLICT`
   （不同核），跨 root/agent 是既有的 `SETTLEMENT_CROSS_WIRED`。`listUnsettled` 是 S1 完整性面
   （准入已耐久、尚无终态事实）。

## 4. 为什么 `UNKNOWN` 是一等终态

S1 的定义（UTE-Prep 裁决 2 / S1.2）是“进入执行阶段的调用最终必须落成一条可查询事实：终态**或**显式
`unknown`”，而 `unknown` 是**合法终态**、不是失败态。本模块把这条写成机器性质：

- `UNKNOWN` 只能由 `settle` 显式写入，且必须带非空 `missingEvidence` 与非空 `reason`；
  `missingEvidence` 为空 = `UNCONFIRMED_WITHOUT_UNCERTAINTY`（“没证据”不是“没发生”）。
- `UNKNOWN` 不得携带 `effectEvidence='none-confirmed'`——那是“证明无效果”，与“结果不可证”矛盾。
- `recoverUnsettled(at)` 只处理非终态记录：`ADMITTED` 缺 `dispatch-confirmation`，
  `RUNNING` 缺 `terminal-observation` / `host-result` / `backend-receipt`（必要时加 `effect-evidence`），
  统一写 `state=UNKNOWN`、`reason=PROCESS_TERMINATED_WITHOUT_OUTCOME`。
- 二次 recovery 找不到未结记录、返回空数组；`UNKNOWN` 记录字节不变（幂等）。
- **反假绿**：`fabricate-completed-on-recovery` 变异把恢复的三个常量改成 COMPLETED/completed/
  none-confirmed，并清空缺失证据——`recovery-unknown` 场景立刻变红（记录真的变成 `COMPLETED`，
  测试断言 `state !== 'UNKNOWN'`），证明该控制不是空的。这正是“fabricated COMPLETED”失败模式。

真实的 SIGKILL 测试不是模拟：父进程 `spawnSync(node --input-type=module -e …)` 起一个子进程，
子进程 `recordAdmission → enterRunning` 后 `process.kill(process.pid,'SIGKILL')`。
父进程断言 `signal='SIGKILL'`、`status=null`，然后**冷启动**一个 store 读回 `RUNNING`，
`recoverUnsettled` 得到 `UNKNOWN`，并断言 `terminalReason` 与 `missingEvidence`
（含 `host-result`/`terminal-observation`）、`effectEvidence='unknown'`、二次恢复幂等。
无 skip、无“环境不支持”分支。

## 5. 记录崩溃安全设计

每次写入：

1. `mkdir -p dir`；目标文件名 `<ExecutionId>.settlement.json`。
2. 构造信封 `{schema:'execution-settlement-envelope/1', checksum:'sha256:<hex>', payload:<record>}`，
   `checksum` 是对 **payload 的规范 JSON**（递归键排序）取 sha256——不是对最终文本取，避免
   序列化差异。
3. 写到**私有临时文件** `<target>.<pid>.<n>.tmp`（`O_EXCL`、0600），`write` → `fsync` → `close`。
4. `rename(temp, target)` 原子发布；失败时清理 temp 并抛 `SETTLEMENT_WRITE_FAILED`。
5. **父目录 fsync**：`fsync(dir)` 成功之后调用才返回。失败 = 具名
   `SETTLEMENT_DIRECTORY_FSYNC_FAILED`（记录可能已 rename，但绝不冒充“已耐久”）。
   这正是 `recordAdmission` 的耐久承诺：返回即意味着“冷读者一定能看到 ADMITTED”。
6. **排他写者锁**：`<dir>/.settlement-writer.lock`（JSON `{pid,bootId,host,acquiredAt}`，`O_EXCL`，
   fsync 文件 + 目录）。同 pid + 同 boot = 可重入（冷读者不是第二写者）；活着的异 pid = 
   `SETTLEMENT_WRITER_CONFLICT`；已死 pid（或不同 boot，防 pid 复用）= 回收，并在 stdout 打出
   `UTE2-WRITER-LOCK reclaimed previousPid=… previousBootId=… at=…`。每次写前重读锁；锁被外部移除
   或替换时写操作以 `SETTLEMENT_WRITER_CONFLICT` 停止，而不是与新主人赛跑。
7. 读侧只认 `<ExecutionId>.settlement.json`：`.tmp` 文件对 `read`/`list` **不可见**；
   截断 JSON、缺信封、校验和不符、结构/状态链/归属非法 → `SETTLEMENT_CORRUPT`（`list` 同样拒绝，
   不会静默跳过）。

因此“中断的写”只有两种可观察结果：**旧记录**（rename 前）或**新记录**（rename 后）。
测试覆盖：temp-only 半写被忽略；截断终文件 `SETTLEMENT_CORRUPT`；篡改 payload → `SETTLEMENT_CORRUPT`；
陈旧 temp 与有效记录并存不干扰读取。`accept-bad-checksum` 变异（跳过校验和）让篡改用例变红。

## 6. 负控表（每条都必须 RED-without / GREEN-with）

| # | 控制（公开面场景） | 没有该行为时 | 本模块行为（GREEN） | 变异（transcript id） | 变异后 |
| --- | --- | --- | --- | --- | --- |
| 1 | 同 id 冲突事实 | 最后写入者获胜 / 静默覆盖 | `SETTLEMENT_CONFLICT`，文件字节不变 | `conflict-becomes-last-writer-wins` | RED（accepted） |
| 2 | 终态后非法跃迁 | 终态可重入 RUNNING | `ILLEGAL_TRANSITION`，状态不变 | `illegal-transition-allowed` | RED（accepted；且磁盘记录链非法） |
| 3 | SIGKILL 后恢复 | 写 `COMPLETED`（伪造成功） | `UNKNOWN` + `PROCESS_TERMINATED_WITHOUT_OUTCOME` + 缺失证据 | `fabricate-completed-on-recovery` | RED（recovered=COMPLETED） |
| 4 | 声称效果但无观察 | 接受 `observed` + 空列表 | `EFFECT_CLAIM_WITHOUT_OBSERVATION` | `trust-effect-claim` | RED（accepted） |
| 5 | 两笔结算串线 | 接受别家执行的准入/观察 | `SETTLEMENT_CROSS_WIRED`，零写入 | `ignore-execution-identity` | RED（accepted） |
| 6 | 记录半写 / 篡改 | 读成完整记录 | `SETTLEMENT_CORRUPT` | `accept-bad-checksum` | RED（read as complete） |
| 7 | 模块面提供 grant | 暴露 `grantExecution` 一类函数 | 公开面无 grant 形状函数，无裁决构造器 | `expose-a-grant` | RED（grant-shaped export(s)） |
| 8 | 适配器重复终态 | 第二次写回 `recorded:true` | `DUPLICATE_SETTLEMENT`，字节不变 | `adapter-duplicate-recorded-true` | RED（second=true） |
| 9 | S1 完整性面 | `listUnsettled` 永远为空 | 准入未结算时列出该 ExecutionId | `adapter-list-unsettled-empty` | RED（unsettled=[]） |
| 10 | 投影不伪造 | 歧义三元组取第一个 `requestId` | `PROJECTION_AMBIGUOUS`，无 `requestId` | `adapter-fabricate-request-id` | RED（requestId=req-ute2-1） |
| 11 | 投影不撒谎 | 结果不一致仍返回 `recorded:true` | `PROJECTION_OUTCOME_MISMATCH` | `adapter-accept-outcome-mismatch` | RED（mismatched=true） |
| 12 | 适配器归属 | 接受异 root/agent 的事实 | `SETTLEMENT_CROSS_WIRED` | `adapter-ignore-identity` | RED（true/undefined） |
| 13 | 活写者排他 | 把活锁当陈旧并抢 root | 真实第二进程 `SETTLEMENT_WRITER_CONFLICT` | `accept-live-foreign-writer` | RED（子进程 LOCK=acquired） |
| 14 | 死写者回收 | 死 pid 也判冲突（重启不可用） | 回收并点名 `previousPid` | `never-reclaim-dead-writer` | RED（not reclaimed） |
| 15 | 父目录耐久 | rename 后不 fsync 就返回 | 目录 fsync 后才返回；失败具名 | `skip-directory-fsync` | RED（fsync calls=0） |

套件先跑**正半场**：15 个场景在真实模块上全 GREEN（防止“场景因无关原因失败”造成的假红）；
再逐个跑变异、断言 RED，并拒绝 byte-identical 的“变异”（`noop-mutation` 被 `assert.rejects` 拒绝，
证明变异器本身不是空的）。逐字 transcript 见
`dev/agent-workflow/evidence/ute2-settlement-20261120/SUITE.txt`。

## 7. 本机观察到的门（逐字见 evidence/GATES.txt）

| 门 | 结果 |
| --- | --- |
| 套件 `node --test --test-reporter=spec tests/ute2-settlement/settlement.test.mjs` | **20/20 pass**；`UTE2-MUTANTS total=15 red=15 scenarios=15` |
| p4t6 `./node_modules/.bin/vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | **20/20 pass**（booking lane `UTE2SETTLEMENT`，3 paths，1519→1522） |
| `node scripts/ute-retirement-gate.mjs --all` | `UTE-RETIREMENT-SUMMARY requested=1 allowed=0 refused=1`；family `fs` 的 `UTE_SEMANTIC_DIFFERENCES_UNRESOLVED`（本 PR 不请求退役，逐字见 GATES.txt） |
| `node scripts/check-artifacts-committed.mjs` | 同一提交集内 `verdict=ok`（见 GATES.txt 本轮条目） |
| `test-catalog --max-uncollected 41 --max-excluded 7` | `tests=881 … UNCOLLECTED 41 EXCLUDED 14 refused=0 findings=0` |
| `node --test scripts/test-catalog.test.mjs` | 28/28 |
| `dispatch-tests --check` | `PASS legs=18 bad=0` |
| `eb3-ci-required` | `pass workflows=10 findings=0` |
| `eb3-ci-negative-controls` | 33/33（含 C-NH1 从 manifest 派生 argv） |
| `docs-sync --check` | `docs=177 … plans=136 … findings=0 blocking=0` |
| `lint-identities --diff <baseline>` | `new 0, resolved 0` |
| `tsc --noEmit`（repo-wide `pnpm typecheck`） | 9/9 workspace projects Done |
| `git diff --check` | clean |
| `node scripts/check-artifacts-committed.mjs` | `verdict=ok compared=2096 glue=113`（dist 与 source 同一提交；`pnpm run build` 9/9 Done，`pnpm build:composition` 通过） |
| legacy 套件 | 未改动任何既有测试文件；`tests/world-factory/tinf-observer-closeout.test.mjs` 27/27（`origin/master` 上 848 个测试文件逐一 `cmp` 字节相同，0 changed） |

## 8. UNKNOWN（诚实清单）

1. **原型，未接线**。本模块不是 S1 的运行时实现：没有 adapter 把它接到 `tools/execute` /
   `ToolExecutionPipeline`，因此“每一次进入 dispatch 的调用都**真的**落了一条事实”在宿主上
   **尚未被证明**。本 PR 证明的是记录器的性质，不是生产链路的性质。
2. **真实 SIGKILL 的覆盖面**：本机以独立 `node` 子进程做了真实 SIGKILL（硬死亡、无 cleanup、
   `RUNNING` 已 fsync），但**没有**在“真实 DSH Host 正在执行原生工具、并且同时承受负载/并发”的
   条件下测过；也没有验证宿主自身（而非本模块）在 SIGKILL 后是否还会写第二条事实。
3. **S2 未声明 = `CORE_SEAM_BLOCKER`**。模块不保证“durable commit 早于 Host 把 tool/result 返回给模型”；
   S2 需要一个**公开可等待**的 Host seam（在耐久写之后）。今天可测的调用点都是 fire-and-forget
   （`tools/result` 是发射，不是耐久），因此 S2 的正确输出是 `CORE_SEAM_BLOCKER`，**不是** fork，
   **不是** 在 `tools/result` handler 里假装排序。
4. **进程内信任边界**。`decisionDigest` 的**内容真实性**由调用方/ControlService 保证：本模块只能校验
   它是 64-hex 并与同一引用一同复制；适配器路径只用**引用型**准入，因此它连“裁决摘要”都不声称。它不读取 ControlService 存储，也不验证该摘要对应哪条真实裁决——
   这是“不建第二权威”的代价，必须由 adapter 的可信来源补上。
5. **持久化介质**：原子 rename 依赖同一文件系统的 POSIX 语义（本机 WSL2 ext4 实测）；网络文件系统 /
   跨设备 rename / 真断电（而非进程 SIGKILL）的极端情形未测。父目录 fsync 已实现并由注入见证测试
   证明“rename 之后、返回之前”发生；但**硬件/内核缓存层**的真实断电保证不在本机能证明的范围。
   写者锁的“死亡”判定依赖 `kill(pid,0)` + `/proc/sys/kernel/random/boot_id`；非 Linux 或拿不到
   boot id 时退化为 `boot-id-unavailable`，此时**不**把异 boot 锁当作可回收，宁可拒绝。
6. **观测词汇的边界**：`EffectKind` 是 S1 的最小闭集（file-* / process-* / network-connect），
   与 `contract-oracle.ts` 的 effect kind 同向但尚未做逐字合并；`read` 的可观测性仍是 M7-C 的
   `CLAIM_NOT_OBSERVABLE`，本模块不声称能证明“没有读”。
7. **CI 覆盖**：套件只并入 census 的 “next host lane”（与 UTE-1 同一 lane），因此它只在
   `ci-census`（non-draft PR）运行；`ci-fast`/`ci-product` 不跑它。Hosted L2 的首次真实执行未在本机观察到。
8. **范围外**：本 PR 不修改 `tests/deepseek-harness-test-use` / `tests/deepseek-harness-next`
   （CORE PATCH BUDGET = 0），不引入第二套启动器/策略编译器，不触碰 Authority 指针与快照。
