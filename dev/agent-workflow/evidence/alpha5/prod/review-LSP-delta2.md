# review-LSP-delta2 — P-LSP delta `1e76cd2c → 7962022e`（第二轮独立 delta 审）

- **审者** = qwen3.8-flash-next（≠ 644633ea / 2437a167；与 writer 与首轮 reviewer 会话独立）
- **受审 delta** = `alpha5-prod-lsp` `1e76cd2c → 7962022e`，四件：`ac773974` + `c6ee85b0`（census 腿）、**`c1fe4bdd`（主笔：fd-3 typed 拒 / 有界 settled-lease 账 / README 两更正 / LSP 验收行）**、`7962022e`（纯证据，`packages/` 树与 `c1fe4bdd` **逐字节相同**，实测 `git diff c1fe4bdd..7962022e -- packages/` 空）
- **方法** = 按 ROUTER_RULES §3.1.3，裁决只落在代码与测试：一次性 worktree `.worktrees/a5lsp3-rev-wt` @ `7962022e`（detached）；世界前缀 `tests/homes/a5lsp3-rev-*`（afterAll 自清，收口时两处 `tests/homes` 零残留）；端口 3182 亲证空闲（`ss -tln` 无监听，本审从未 bind）；`:3080` 仅做过一次 TCP 连通探测确认其在听（未发任何 HTTP 请求、零操作）。全部复跑在本宿主（node v24.21.0 / kernel 6.8.0-142-generic / Python 3.12.3）。
- **reviewer 自备探针 kit** = `dev/agent-workflow/evidence/alpha5/prod/review-LSP-delta2-kit/`（`a5lsp3-rev-delta2-probe.test.ts` 9 腿 + 从 **base `1e76cd2c` 原样提取**的 `__revbase-*.ts` 两件套用于 PRE 复现 + `probe-run.transcript.txt`；跑法 = 三件拷回 `packages/runtime/test|sandbox-provider`，`pnpm exec vitest run test/a5lsp3-rev-delta2-probe.test.ts`）。裁决基于代码、测试、冻结契约（`domain/tool-governance/src/lease.ts` + `interfaces.ts`），未采信任何叙述性口径。

## 判定总表

| # | 主审项 | 裁决 |
|---|---|---|
| ① | FIFO cap1024 后对外语义（horizon 外旧 lease） | **PASS（契约允许）**，证据+注记 |
| ② | 重复 terminate（settled 在册 / 已退役各一次） | **PASS** |
| ③ | 活句柄遗漏 / 退役只删活映射 / cap 触顶最老必已 terminal | **PASS（直接 FAIL 判据未触发）** |
| ④ | fd-3 typed 拒 PRE/POST 亲跑 | **PASS** |
| ⑤ | README 两失实更正属实 + ACCEPTANCE-STATUS LSP 行无升格 | **PASS** |
| ⑥ | lane 抽 20 复跑 + a5p4 66/66 + bookkeeping() 长跑复跑 | **PASS**（含一条口径注记） |

**总判定 = PASS**（无 FAIL 级发现；两条非阻塞注记见文末）。

---

## ① horizon 外旧 lease：逐 API 亲测 + 契约裁定

**API 面清点（代码亲查）**：provider 返回对象 = `probe/prepare/execute/spawn/spawnStreaming/executeStreaming/requestCancellation/settleTermination/bookkeeping`。**不存在任何按 leaseId 查询 lease 的 get/inspect/status API**——horizon 外"查询类调用"实际只有三个 lease-consuming 面：`requestCancellation(lease)`、`settleTermination(lease,?)`、以及流式句柄闭包 `handle.terminate()`；`bookkeeping()` 只回四计数（键集合亲测 = `liveLeases/settledLedger/settledLedgerCap/streamRuns`，无按-id 查询面渗漏）。

**逐 API 实测**（kit rev①/rev②，cap=1/2/8/128 各档）：

| API | horizon 内（账在册） | horizon 外（已退役） |
|---|---|---|
| `requestCancellation` | ok:true，冻结记录**逐字节相同**（JSON.stringify 全等断言） | `ok:false` `IO_POLICY_UNSUPPORTED`，message = `lease '<id>' is not one of this provider's leases` |
| `settleTermination` | 同上（幂等，status 恒 `terminated`） | 同上拒；计数零移动（账/活映射一字不动） |
| `handle.terminate()` | 单飞 memo：同一冻结 terminated 字节 | **memo 仍在**：返回该句柄当年 settle 的冻结字节（历史答复，非 provider 记忆）；绝不 ok-真→活、绝不复活 |

**是否"以 horizon 内幂等为名悄悄把已知句柄降级为未知"**：**否，实测三点**——(1) 降级方向是 fail-closed（ok→typed 拒，绝不反向）；(2) 被退役记录与从未见过的 ghost lease 的拒答**同码同模板逐字同构**（kit 断言 message 全等），即 horizon 外走的是**既有闭世界法**，不是新发明的降级通道；(3) 该拒答文案在 **base `1e76cd2c` 已逐字存在**（provider.ts base 行 593/636/664，对非本 provider 的 lease）——闭世界拒答是既有法，本 delta 只是把「已被诚实退役的记录」归入该既有法域。

**契约裁定（分级条款）**：冻结契约 = PR0 `interfaces.ts`（`ConfinedProcessProvider`：仅 probe/spawn/requestCancellation/settleTermination；无 lease 查询面、无"永久召回"条款）+ `lease.ts` 租约法（`terminated` absorbing 约束的是**状态转换**——永不重开；不是记忆义务；`termination-unconfirmed` 的 sideEffectUnknown 诚实另有专面）。契约**没有**任何条款要求 provider 无限期保有序列化句柄的幂等答复；而 ③ 证明**被遗忘集合 ⊆ 已确认 terminated**（reap 已确认），故 horizon 外拒答**不可能吞掉任何未确认副作用事实**。结论：**契约允许 closed-world 拒答（即既有法）→ PASS 附证据**，FAIL 停报条款不触发。

## ② 重复 terminate

- **对已 settle（账在册）**：`settleTermination`/`requestCancellation`/`handle.terminate` 三连重发，答复全部 ok:true 且与原 settle 字节全等；`settledLedger` 不增位、不重入 FIFO（Map.set 早期返回路径，无 recency 刷新）——加测：cap=3 下对最老 A 反复 request 后再 settle D，被逐出的仍是 A（审计序 = settle 时刻序， Talk 不救活账）。
- **对已退役（horizon 外）**：provider 两面按名拒（文案亲测含 leaseId），句柄面 memo 历史答复；**零复活**（status 不可能离开 terminated）、**零误报活**（liveLeases/streamRuns 计数不动）、**零吞新句柄**（退役后立即 spawnStreaming 新句柄，leaseId 异、terminate 正常落 terminated；leaseId 含时间戳+随机段，与旧 id 无碰撞面）。

## ③ 退役只删活映射；账留完整冻结记录；cap 触顶最老必已 terminal（FAIL 判据）

- **代码亲查**：`auditSettledLease` 仅三个写入点——`execute`（born-terminated，直入账）、`requestCancellation` 同步支（构造 `status:'terminated'` 后入账）、`settleTermination`（**`next.status === 'terminated'` 守卫内**才 delete 两张活映射 + 入账；else 支只 `leases.set` 保持活）。`termination-unconfirmed` 无任何路径入账。
- **行为亲验（FAIL 判据正面打）**：cap=1 + 混合状态压力（S1 terminated → S2 unconfirmed 保持活 → S3 terminated 挤掉 S1 → one-shot s4 挤掉 S3）：**unconfirmed 全程未逐出**（liveLeases=1、streamRuns=1、答复恒 `termination-unconfirmed`），历次被逐者（S1、S3、s4）**全部在逐出时刻已 terminal**（事前都是确认 terminated 的答复亲证）；随后 S2 升级 settle(true) → 双活映射归零、入账、再幂等。**非 terminal 条目不可被退役 = 亲验成立，不触发直接 FAIL。**
- 退役语义 = 活映射 delete（含**流式进程句柄 streamRuns delete**，`bookkeeping().streamRuns` 亲归 0）+ 账留**完整冻结记录**（重放答复字节全等，非仅 id）。

## ④ fd-3 typed 拒：PRE/POST 亲跑（自备 base 模块）

- **PRE（base `1e76cd2c` 两文件原样提取）**：`compileFdPlan(fd=3).ok === true`（声明面收下），且 base `prepare()` 产出 plan、policy JSON `fd_plan.declared` **携带 fd 3** 抵达 launcher 载荷 = 静默关通道时代的实证（与 `ci-304/l3d-repro/l3d-acceptance-face.before-after.txt` 独立同构）。
- **POST**：`compileFdPlan` 拒（`fd-launcher-owned` @ `$.declared[0].fd`）；provider `spawn`/`spawnStreaming` **两臂同拒于 prepare**（`IO_POLICY_UNSUPPORTED` 含 `fd-launcher-owned`），计数 fake 亲证**零进程、零流 spawn**；**不烧 grant**（紧接同一 provider 的合法请求 ok:true 真跑）；**fd2/fd4/fd5 无扰**（compile+真跑+policy 载荷亲证）；POST 世界里**任何 policy 文件都不可能携带 fd 3**（全目录扫描断言）；"3 = launcher-owned; **declaring is not using**" 注释亲验在位（`fd-inheritance.ts` 头 + `provider.ts` SpawnRequest 文档 + 拒答 detail 文内三处）。

## ⑤ README 两更正 + 验收行

- **更正一（dist 镜像已提交且逐字节可复现）**：`93b728a3` 存在且 same-commit 再生 dist 面属实；**本审在最终 HEAD `7962022e` 上亲跑 `pnpm run check:artifacts:head` = `compared=1684 drift=0`**（EXIT=0）→ 失实更正属实且在最终 head 成立。
- **更正二（a4p7 commit-carries-build 实测关闭非裁决红）**：本审**亲跑** `a4p7-merge-gate.test.ts` **35/35 EXIT=0**（client lane 先 `pnpm build` 的既有前提见注记-2），与证据 `ci-304/a4p7-merge-gate-RERUN-GREEN.log` 相互独立吻合 → 属实。
- **ACCEPTANCE-STATUS**：新增行 = **PENDING-ACCEPTANCE**，措辞自带反升格（"payload 是 fixture，只证 seam"、"真实语言服务器最小交互 = 未做"、"本行未闭合前 LSP 面禁族级 GO 宣称"）；§4 分布 21→22 行亲点行数属实（§1 数据行实测 22）；`final_declaration MUST REMAIN NULL` 段未动；diff 未触碰任何其它行。**无升格。**

## ⑥ 套件复跑（全部亲跑 @ `7962022e`）

- **lane 复跑**：runtime `a5p4-*`+`a5lsp2-*` 11 文件 **92/92**（含 REAL confined-exec 真 Landlock 腿）；
- **抽 20 复跑**：具名 `-t` 抽取 19 腿（跨 6 文件，含 ledger 两腿/fd-3 两腿/REAL 判据/policyChange 四要件腿/失败清理腿/自 typecheck 腿等）全绿 + `confines the untrusted argv under a scratch policy`（REAL）第 20 腿单跑绿 = **20/20**。
- **a5p4 66/66**：`a5p4-*` 9 文件现共 **70/70**（= 旧面 66 + 本轮新增 4 腿：fd-3 纯面 1 + provider 3；diff 亲验为**纯新增测试**、66 旧腿一字未动）。
- **bookkeeping() 长跑断言复跑**：lane 内 24-cycle cap-8 测试随套件绿；**外加**本审 2000-cycle 默认 cap 长跑（kit rev⑥）：`settledLedger` 峰值恒 =1024 封顶、`liveLeases`/`streamRuns` 恒 0、horizon 外按名拒、horizon 内幂等字节全等。
- **在册账腿**：`a5p0-layer-audit` **4/4**、`a5p5-dormant-audit` **5/5**、`p4t6` **10/10**、`a4p7` **35/35**（干净树 + client 已 build 后复跑）。

---

## 非阻塞注记

1. **句柄 memo 与 provider 面的答复不对称（设计如此，建议 README 一句定死）**：lease 退役后 `handle.terminate()` 重发返回 memo 的冻结 terminated 字节（该句柄历史的诚实答复），provider 两面则闭世界拒。两答皆真、皆 fail-safe；但调用方若把句柄 memo 当"provider 仍认识此 lease"的信号会误读。属语义定文范畴，非缺陷。
2. **口径注记（"lane 164/164" 集合恒等未能从在册工件复算）**：本审可复算并全绿的并集 = 92+4+10+35+5 = **146/146**（runtime lane + a5p0 + p4t6 + a4p7 + a5p5-dormant），另 a4p7 的 composition-smoke 腿在**未 `pnpm build`（client dist 缺）的新 worktree 必红**——这是 base 起已披露的环境腿（"run `pnpm build` and re-run"），非本 stack 行为。建议后续轮把 "lane=164" 的文件清单入册，免得每轮重考古。本审首轮 testkit 3 红（p4t6 1169≠1166 / lint +1 identity / composition-smoke）中前两条为**本审自带 untracked 探针文件污染**（移除后 1166/1166 复原，自证归因），第三条如上——均已闭合，无产品含义。

## 复现指引

```bash
cd .worktrees/a5lsp3-rev-wt        # git worktree add --detach .worktrees/a5lsp3-rev-wt 7962022e
pnpm install --store-dir /srv/workspace/dsh-plugins/dsh-agent-team/.pnpm-store-wt   # 默认 store 不可写时显式指共享 store
pnpm -C packages/runtime exec vitest run test/a5p4-*.test.ts test/a5lsp2-assembly.test.ts test/a5lsp2-streaming.test.ts   # 92/92
# kit：拷 review-LSP-delta2-kit/{probe→test/, __revbase-*→sandbox-provider/} 后单跑该文件（9/9），跑毕移除
pnpm run check:artifacts:head       # drift=0 compared=1684
```

**判定 = PASS**：四件主笔的对外语义全部落在冻结契约允许域内（horizon 外 = 既有 closed-world 法、逐 API typed 按名拒、零降级应答、零活句柄退役），fd-3 冲突已收口到声明面拒绝且实证 PRE→POST 行为迁移，文档更正经独立复跑属实，验收行无升格。

— reviewer = qwen3.8-flash-next（一次性 worktree `a5lsp3-rev-wt` @ `7962022e`；世界 `a5lsp3-rev-*` 已自清；3182 从未 bind；:3080 零请求）
