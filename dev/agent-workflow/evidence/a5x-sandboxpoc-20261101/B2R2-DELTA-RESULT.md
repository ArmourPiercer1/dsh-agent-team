# DELTA-POC-AFTER-B2R 执行结果（PoC banner，可处置）

> 规格：PR #531 @ `dbc11f912` → `docs/plans/memo/alpha5-sandbox-first-20261101/DELTA-POC-AFTER-B2R.md`。
> 执行纪律：PoC 定位、零 Core 改动、零新工具执行器；证据 = 文件副作用 + consulted trace，不靠散文。
> 主运行 = **run4**（`a5x-pocB2R2-20261102T155747`）；run3（`…T155404`）承载 MA 建窗栅栏与中间态；run1/run2 为中间失败（溯源：Uint32Array/Atomics、lane marker 子串碰撞，均已在 kit 修复并留痕）。

## 0. 公共字段

| 字段 | 值 |
| --- | --- |
| hostSha | `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2，pristine porcelain 空，运行前后复核） |
| teamSha | `6205df337`（task 分支本地 tip；本轮新增文件未提交前 = 工作树） |
| wrapperSourceSha | `263ac0a8f…`（a5x-fork-capped-v2.mjs，zero-copy wrap，精确 session-id 键 + fail-closed + gen 代际） |
| probeSourceSha | `ac5eb0411…`（a5x-probe-b2r2.mjs，宿主内调用原生 `setSandboxMode()` 写路径） |
| kitSha | `2af23f2a2…`（a5x-b2r2-kit.mjs） |
| toolDefinitionIdentity | 原生 `terminal-bash`（wrapper 仅代 `apply`；参数面 = `{command}` 唯一——v1 danger 腿据此作废） |
| policy 载体 | 部署方 caps 表（env `A5X_B2R2_CAPS` 指向 JSON；键 = 宿主发行 session id；值 = `{gen, mode, workspaceRoot}`）——**PoC 对 TeamDomain 绑定的替身，非 TeamDomain 实体** |
| backendId | bwrap（`/usr/bin/bwrap`；workspace-write = `--ro-bind / /` + `--bind root` rw + `--tmpfs /tmp`） |
| teardown | host SIGTERM + mock close；stable :3080 probe 前后均 401（未触碰）；DSH_HOME = 工作区内 `tests/homes/a5x-pocB2R2-<stamp>` |
| consulted trace | host.log `[b2r2] resolve/CAP` 行（见 `b2r2.json.consulted`） |

## 1. D-BIND-01 — 两成员、同一原生 bash、不同上界；精确身份绑定；缺映射 fail-closed

**verdict: CONDITIONAL**（机制全通；条件 = 身份绑定是部署方表而非 TeamDomain 实体）

| leg | oracle | 结果 |
| --- | --- | --- |
| MA 写 rootA（己域） | `rootA/ma-inside.txt` == "ok" | PASS |
| MA 写 rootB（他域） | 文件不存在 + tail `Read-only file system` | REFUSED（EROFS） |
| MA 写 secret | secret 字节不变 + tail EROFS | REFUSED |
| MB 写 rootB（己域） | `rootB/mb-inside.txt` == "ok" | PASS |
| MB 写 rootA（他域） | 文件不存在 + tail EROFS | REFUSED |
| CTL（无映射） | 文件不存在 + tail `b2r2: no member ceiling registered … refusing to spawn (fail-closed)` | REFUSED（spawn 拒绝） |
| consulted | host.log 逐 session `resolve … mapped=genN` + `CAP applied` | 每 PTY spawn 一行（含 CTL `mapped=NONE` 后 throw） |

- 同一 preset、同一原生 `terminal-bash` 定义，仅 caps 表不同 → 双成员差异上界成立；**无 includes/子串键**（精确 id），**无回退**（无映射 = 拒绝，CTL 负控实测）。
- 条件/限制：身份表由部署方按宿主发行 session id 维护（PoC 替身）；宿主无 TeamDomain 实体，真实 TeamDomain→wrapper 绑定 = P1 装配（本 PoC 不虚构）；无引用完整性、无逐调用 ledger（consult 行是 spawn 级，非 call 级——见 D-PTY-04）。

## 2. D-FS-02 — 独立读写上界（A 读不可写 / B 写不可读）

**verdict: UNSUPPORTED**（宿主策略词汇不可表达；活体 RED ×2 佐证）

| leg | oracle | 结果 |
| --- | --- | --- |
| MA 读 rootB/needle.txt（MA 的写域外） | tail 含 `B2R2NEEDLE-7741`、exit 0 | **READ 成功（RED）** |
| MB 读 rootA/ma-inside.txt（MB 的写域外） | tail 含 `ok`、exit 0 | **READ 成功（RED）** |
| 写根可读性 | bwrap `--bind` = rw；landlock `readWrite:[root]`；seatbelt per-root 含读 | 结构事实：写根必然可读（无 write-only 绑定） |
| 单文件规则 / 逐路径读白名单 | profiles.ts 三 profile 词汇 = `{mode, workspaceRoot}` 单根 | **词汇内不可表达** |
| 原生 edit 隐式读（write-only 目标） | 依赖 write-only 根 | NOT_TESTED（词汇缺口；P1-07 兼容性注记） |

结论：宿主 `SandboxPolicy` 词汇（三态 mode × 单 workspaceRoot）在 bwrap/landlock/seatbelt 三 runner 均**无独立读写轴、无逐路径读白名单、无 write-only 根**。wrapper 只能钳制 mode/root，造不出新 mode → 双轴（MemberIoCeiling 的 read/write PathRuleSet）**必须扩展宿主策略词汇**，单独立项（三 profile + resolve 词汇 + 投影）。这是本轮对 P1 排序最重的新增输入。

## 3. D-BASH-03 — 真实 session 提权入口；上界永不被 mode 升级打破

**verdict: PASS（活体 clamp 成立）**，附两条原生行为发现

| leg | oracle | 结果 |
| --- | --- | --- |
| 原生入口存在性 | `setSandboxMode(session, mode)`（session-mode.ts 自述 "THE write path"）；probe 宿主内调用 | 可用（非伪造工具参数） |
| MA（活跃 PTY）中途提权 | probe .done = `ERROR cannot change sandbox mode from "workspace-write" to "danger-full-access" while persistent terminal sessions are open or being created; wait for creation to settle and close them first` | **原生栅栏拒绝**（terminal-bash lib `ensureSandboxModeFence`：drain-first） |
| MA2（首 spawn 前提权） | .done = `applied requested=danger-full-access overrideOf=danger-full-access` | override 生效并折叠进 resolve |
| clamp 活体 | consulted：`resolve sid=…MA2… base.mode=danger-full-access … mapped=gen2` → `CAP applied … gen=2 mode=workspace-write root=…/rootA2`；tail：写 rootA = `Read-only file system`；写 rootA2 = exit 0 | **danger 基线被上界压回**（上界永不破） |

- 两条发现：(a) 原生对"活跃 PTY 期间改 session mode"自带栅栏（throw，drain-first）——这是宿主对 stale-domain 的原生守卫之一；(b) run3 实测该栅栏覆盖**建窗期**（agent boot 中改 mode 亦被拒："…or being created"）——干净的预 spawn 提权窗口窄且时序相关（run4 一次成功，ma2FenceAttempts=0）。
- 限制：approved `request.mode` 覆盖（优先级高于 session override 的原生路径）未活体驱动（无 headless 授权 RPC）；结构上上界在 `resolve` 返回后钳制，对任何 base（含 approved 覆盖）同等生效。

## 4. D-PTY-04 — 持久 PTY + 上界代际变更：stale 域、收敛路径

**verdict: CONDITIONAL（危害实锤；收敛 = 会话/PTY 再生）**

| leg | oracle | 结果 |
| --- | --- | --- |
| 中途代际变更 | MA caps gen1/rootA → gen2/rootA2（mutation.json 落时间戳），MA 持久 PTY 不动 | 变更仅入表 |
| stale 域写旧根 | `rootA/ma-stale.txt` 存在（gen2 上界下仍成功） | **RED：stale 域保留旧（更宽）根** |
| stale 域缺新根 | `rootA2/ma-old-domain.txt` 不存在（EROFS） | 旧域未绑新根 |
| consulted 代际 | MA 全程仅 spawn 时一行 `gen=1`；**无 gen=2 复询**（sawGen2=false） | **策略只在 spawn 时询一次；运行中 PTY 永不复询**（域 = spawn 时刻冻结） |
| 新会话收敛 | MA2（新 PTY）按 gen2/rootA2 生效（拒 rootA、许 rootA2） | 收敛于会话边界 |
| 原生对照 | D-BASH-03 栅栏：活跃 PTY 期间 session mode 变更被拒 | 原生对 mode 轴有 drain-first 守卫；**对部署方 caps 表代际变更无任何原生守卫**（wrapper 自管域） |

- 结论：stale-domain 危害在"上界代际变更"轴上真实存在且**无原生守卫**（原生守卫只覆盖 session mode 事件轴）。缓解 = 变更即终止/再生 PTY，或变更时拒绝（P2-04 持久 PTY 代际检查的落点）；consulted 记录必须含**域代际**（spawn 时 gen）而非仅"最近 policy"，否则审计上"已询新策略"会掩盖旧域仍在。

## 5. 复用证据（不重跑，按规格"已有证据有效的部分"）

- **D-OS-05**：hardlink/别名/符号链接//proc/self/fd — 复用 A1（`a5x-sandboxpoc-20261101` m1HardlinkLeaked：in-policy 域内泄漏，用户裁决维持）+ B1（ro-bind+mask 域）；NOT_RE-RUN。
- **D-NET-06**：网络布尔化 — 复用 A2（web_fetch 布尔门）+ v1 对表；restricted 语义维持 `IO_POLICY_UNSUPPORTED` + 显式迁移（撤回我方默认降级建议）。NOT_RE-RUN。
- **D-PLANE-07**：Alpha.4 allow/ask/deny × 上界（approval-allow + IO-deny）— 复用 A4 审批面 + 本轮 D-BASH-03 clamp（approval 不能打开上界外写域，负控 = CTL fail-closed 与 MA2 clamp）。NOT_RE-RUN。
- **D-UP-08**：宿主升级重放 — G5，NOT_TESTED（本轮不涉）。

## 6. 新增发现（本轮独有）

1. **投影/执行域分叉**：MA2 的模型运行时上下文注入显示 `Current DSH file policy: danger-full-access`（session 事件投影如实），而 OS 执行域被 wrapper 钳在 workspace-write/rootA2——**模型自知的策略 ≠ 实际执行域**。跨面一致性（强化 P4-05A 门禁）必须覆盖"投影读取的事件源 vs 执行层实际 clamp"这一对。
2. **策略咨询粒度 = spawn 级**（非 call 级）：持久 PTY 上同域多命令不重复 resolve → consulted trace 与"最近策略"脱钩（D-PTY-04 的审计后果）。
3. **原生建窗期栅栏**：session mode 变更在 agent boot 窗口内亦被拒（run3 实证；run4 一次通过 = 窗口窄/时序相关）。
4. v1 两项过强表述按规格撤回（"无损投影"、"MemberPolicy = UI 糖"、"restricted→deny 默认"）——修正见 `A5SF-P1-01-PROJECTION-V2.md`（四格对表 + 引用闭包/编译器 = 加法式工作、非新 schema 世代）。

## 7. 对 B2 门槛的净结论

- **B2 维持 CONDITIONAL**，写边界垂直切片结论不变（本轮全部腿无逃逸：所有越界写 = EROFS 或 spawn 拒绝；唯一"逃逸"是读侧，词汇层 UNSUPPORTED，非 wrapper 缺陷）。
- wrapper-first 阶梯再获一层证据：公开 seam（caps 表 + 零复制 wrap）可承载 身份键/代际/fail-closed/clamp 四项；**承载不了**的 = 独立读写轴（宿主词汇）、TeamDomain 实体绑定（P1 装配）、PTU 代际再生守卫（P2-04）。
- 三门禁建议（对方 PR 文档修订，我方仅经评论转述）：P4-05A 增"投影 vs 执行域一致性"（发现 1）；P2-04 持久 PTY 代际检查按 D-PTY-04 表落地（发现 2）；P5-02 升级演练含 wrapper 公开接口兼容（caps 表 schema + wrap 导出面）不变。
