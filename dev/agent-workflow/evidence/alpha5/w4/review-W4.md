# review-W4 — alpha5-wire-pr4 @ 3aef2d2e（base 62cc2b87）

**判定：PASS（通过）**
Reviewer = W4 独立 reviewer（qwen3.8-flash-next，≠writer 7ae9baff）；一次性 worktree detached @ 3aef2d2e；复跑世界 `tests/homes/a5w4-rev-*`（跑毕已删）；宿主 :3080 全程只读 GET 探针（before/after=401，operated=false）。

## 0. 范围亲验

`git diff --name-only 62cc2b87..3aef2d2e` = 38 文件、5221 行、全部为**新增**且全部位于 `dev/agent-workflow/evidence/alpha5/w4/`；w4/ 外零改动 → 零生产改动、零 IF-5 共享文件（tsconfig/barrels/vitest.config/registry/agent-bindings/scripts 均未触碰）。dist barrel（`packages/runtime/dist/.../sandbox-provider/index.js`，tracked）与 launcher（tracked 源）均系基线在场文件、本 diff 未改。dist 内 `.py` 计数 = 0（披露 2 属实：provider 自解析 argv[0] 路径在 dist 中确实不存在）。

## 1. 逐条裁决

### ① ENFORCE-CONFIRMED 定级证据链 — PASS

- **真 Landlock spawn**：launcher 为 tracked 参考件（fork→子内 landlock 规则装载 restrict_self→execve，父 waitpid 取 rc；答案 JSON `{rc,pid,out_ref,err_ref}` 出自内核 waitpid/fork，非自报字符串）。
- **spy 非自报循环**：row 的 spyRun 是**直通**包装——计数+记账后调用 `real.run`（真 `createLauncherDeps`，spawnSync 真进程）；rc/pid 数据流 = 真 launcher stdout → 真 spawnSync → provider 与 spy 各自独立解析同一 stdout。journal 计账与结构痕迹交叉对账成立：pos run-spy=10（main 4 + revoked 4 probe legs + 2 confined-exec）、exec-answer=2（rc 0/1）；nega ceSpyRows=0 且 exec-answer=0 且 scratch 无 plans/out 路径、fixture manifest 字节不变。
- **pid 时序/进程树对账**：复跑 pos 时 /proc 轮询独立观测到 host(pid 68)→prelauncher(pid 85)→`cat private/secret.txt` 子(pid 87, ppid 85) 的真实父子链——与 spy 所报 spawn 时序一致。
- **rows "enforced v4" 观测面**：行由 `probeToCapabilities` 双证据律现场计算（GET_VERSION + selective&denyall 双 ENFORCE-CONFIRMED 才 enforced；badhandled DEMO = 假阴性判别器在场，`legIsClean` 只容 badhandled 的 DEMO）；EACCES 为**实测**：deny 腿 spill `err` 文件（177B）实文 `/usr/bin/cat: .../private/secret.txt: Permission denied`，`out`=37B 控制内容——我在保留世界内直接目视该文件，并以 provider 编译的两份 plan policy 经 tracked launcher **离线重放**：deny 腿 rc=1/EACCES、allow 腿 rc=0/内容匹配，独立于 runner 复现。
- **verifyHardProfileEvidence 未被绕**：`prepare()` 在 `hardDimensions.length>0` 时无条件调用（provider.ts:202-205）；row 的每个实例构造均带 `hardDimensions:['content-read','write']`（a5w4-provider-row.mjs:245）；verifier 全链（realm 非空+相等、每腿 clean、hard 维必须有行/enforced/realm 匹配/mechanism 非空/trustRoot 具名/evidence 解析到在册腿行）逐条读码核实；证据由 `recordLegEvidence` 单厂从真 probe 事实生成，row 无手写证据通道。抽查 `hardDimensions` 配置：pos live rows `evidence://a5p4/probe/<realm>/<stamp>` 与在册腿 refs 一致。

### ② 负控 A「进程存在前」 — PASS

- 机制：`prepare()` 序 = argv 校验 → realm 校验 → `evaluateNetworkRequirement`（纯函数、零 I/O）**先于** `probe()` 与一切 spawn → 三类网络请求（deny/restricted/forged 'unconfined' 闭集外）在任何进程性为 0 时 typed 拒。spy delta=0 与 prepare 代码序一致（非仅计账声明）。
- 盲区核查（如实）：缺件腿的 `runAvailabilityPreflight` 走 `spawnSync python3 --version`/`test -f`，不经 deps.run——README 披露 5 已如实登记为**前置条件探针**（零 confined-exec 判据 `ceDelta=0` + 结构性零痕迹仍成立）；组装期 `/__a5w4/state` 对 main/revoked 实例的 probe legs 有 8 条 spy 行在册、未被隐藏。
- argv[0] 双身份：provider 交出的 dist 路径（磁盘不存在，`.py` 计数 0）被 spy 改写为 trustRoot 以 sha256 指名的 tracked launcher，**两种身份均入 journal**（offered/rewritten 行核实：pos 同时含 dist 路径 rewritten=True 与 tracked 路径 rewritten=False 两族）；argv 尾部（--policy/--out-dir）保持 provider 编译原样。指名链亲验：tracked blob@3aef2d2e `sha256 = cee10ed55f12123f…` = 收据/trustRoot 所载 `cee10ed5…`（工作树文件同 hash）。残余信任说明（不构成缺陷）：trustRoot 标签由 run-w4 运行内计算，「运行内文件字节==git blob」由本 reviewer 以上述 blob 比对闭合；装配决定"跑哪份可信字节"正是公开 deps seam 的职责（IF-1），无未披露信任缺口。

### ③ NegB：prctl(PR_SET_SECCOMP) 同机制声明 + E2BIG 记录 — PASS

包装器自带经典 cBPF 过滤器（444/445/446 → SECCOMP_RET_ERRNO|EACCES），先 `PR_SET_NO_NEW_PRIVS` 后 `prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER)` 装入再 execve /usr/bin/python3——与 seccomp(2) 装入的是同一内核 BPF 过滤器（同一强制面，仅入口号不同），「同一内核机制」声明属实；本环境 seccomp(321) 直返 E2BIG（嵌套 bwrap）已记录于包装器 docstring 与 README（"measured 2026-10-17"）。我独立复现自测：bare probe `abi-available v4`，经包装器 `abi-unavailable rc=-1 errno=EACCES`（内核 errno 词，非用户态 mock）；fail-closed exit 4（装不上绝不裸 exec）读码核实；revoked 实例 counters `{runs:4(probe legs), confinedExec:0}`、腿 verdicts 全 ABI-UNAVAILABLE、prepare 于 abiVersion===null 处 typed 拒且裸 spawn 臂结构上不存在。**记录为非阻塞观察**：过滤器未校验 seccomp_data.arch（理论跨 ABI 旁路类）——对"向被测进程撤销 Landlock"这一负控目的无影响。

### ④ 措辞边界（不得升格 realm/trustRoot）— PASS

定级串原文 = `ENFORCE-CONFIRMED (fixture/subprocess-grade OS_ENFORCED: … real Landlock domain, real execve; realm/trust-root fixture-grade by the lane wording — not an OS-anchored identity)`——OS 强制仅主张于 rules 编译+domain+execve 面，realm/trustRoot 被显式降格为 fixture 级身份（读码属实：trustRoot 是装配传入的字符串标签，无 OS 锚定，未冒充）。README「级别声明」同样如实：per-process 内核撤销 ≠ 系统级撤销（sysctl/启动参数不可达记为环境约束）；chan 腿"无任何方向通道闭合断言、G-g 口径不变仍 OPEN"；IF-6 全 kit 仅用 IO_POLICY_UNSUPPORTED/SANDBOX_UNAVAILABLE 两码（grep 计数核实，零新增）；IF-7 无 REQUIRES-LIVE。

### ⑤ RED-first 腿真实 — PASS

`runs/pos-2026-10-17T02-16-17Z/`（row 未落盘先跑）：环境预检 5 项绿、W4-BOOT scored FAIL（host-log-tail 实录宿主 parsePatchList 拒载）、全部下游腿记 scored FAIL「not attempted」、status RED、世界删除+端口收口在册——无回填。中间轮 `pos-…02-22-06Z`（1 FAIL= W4-TURN）亦如实保留在 runs/ 历史中。本轮复跑另给出一条活证：reviewer 首跑遇环境性 prompt 401，runner 把 5 条下游判据全部如实判红（13/22，exit 2）而非回填。

## 2. 复跑（抽取 ≥6 判据腿 + 全相复跑；新世界 a5w4-rev-*；跑毕清理）

| 相 | 结果 | 关键腿（reviewer 亲跑） |
| --- | --- | --- |
| pos（首跑，带 /proc 轮询） | 13/22 RED·exit 2 | 环境性 prompt 401 被如实判红（无回填=RED 纪律活证）；probe legs 全绿、行= enforced/v4 |
| pos（复跑） | **22/22 GREEN** | W4-PORTS 3182 空闲自证；POS-SPAWN rc=0/pid 真/lease=terminated/ceΔ=1；POS-SPILL out=37B 匹配；**DOMAIN-DENY EACCES rc=1 零泄漏**；RC-SURFACE 0/1；ENFORCE-LIVE abi=v4 + 三腿 verdicts；HARD-REALM；CHAN-OBS 1→3 |
| nega | **19/19 GREEN** | NEG-NET 三类（**含 net-forged**）typed IO_POLICY_UNSUPPORTED·spyΔ=0；PTY wiring-boundary；缺件 SANDBOX_UNAVAILABLE·ceΔ=0；ZEROSPAWN 结构零痕迹 |
| negb | **18/18 GREEN** | NEGB-REFUSE abi=null/EACCES 在册/ceΔ=0；FILTER-EVIDENCE 内核 errno 原文；ZEROWRITE；CONTRAST（引用本轮 pos 收据） |

附加独立件：① bare/wrapper ABI 直测（abi-available v4 vs EACCES abi-unavailable）；② 保留世界内 spill 文件目视（out 37B / err 177B EACCES）；③ plan policy 离线重放（rc=1 EACCES / rc=0 匹配）；④ /proc 父子链对账（68→85→87）。清理：`a5w4-rev-*` 世界×3 已删、端口收口、pinned 树 porcelain=true 前后一致、`/tmp/a5w4-rev-replay` 与 reviewer scratch 回收。token 扫描：writer+reviewer 全部 runs/ 中 `token=` 出现均系 `REDACTED-<sha8>` 形态，raw-token 命中 = 0。

## 3. 非阻塞观察（记录，不影响裁决）

1. `residual prelauncher processes` 探针 `pgrep -af` 自匹配其自身 `bash -c` 行（cosmetic；语义=无残留）。
2. `/__a5w4/state` 的 `hardDimensionsConfigured` 为 row 常量回显而非 provider 实例读回；实际约束力在 `buildInstance` 构造 + `prepare()` 的 verifier 门（读码已核），建议下轮换读回以消自报面。
3. `W4-NEGB-CONTRAST` 校验 pos 收据**存在性**而非内容哈希绑定；对照本身是结构性的（同工厂同请求形状），kit 级可接受。
4. 环境观察：同会话连续第二次 prompt 偶发 401（本 reviewer 4 次跑中 1 次；重试即 GREEN）——建议 runner 对 prompt 非 2xx 附鉴权上下文或重试。
5. 撤销包装器 BPF 无 arch 校验（见 ③）。

## 4. 结论

W4 交付物（row/包装器/runner/三相证据）与代码、内核观测、结构痕迹三方互证一致；级别声明诚实、无越界；IF-1..IF-7 逐项满足；RED 纪律双向（writer 首轮 + reviewer 偶发）活证。**判定：通过（PASS）**，无补充要求。
