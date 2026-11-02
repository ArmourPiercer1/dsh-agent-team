# D-FS-02 独立读写轴 PoC — 结果报告（内核层 + 薄 DSH 接缝）

- 日期：2026-11-02T16:50Z（UTC）
- 分支：`task/a5x-envpoc-20261031`（本地 tip `f75eacf05`；origin tip `18e3823e3`；本轮 commit 未推送——等待一次性授权）
- 宿主：0.2.0-rc.2 pristine @ `639ed01539`（run 前 `git rev-parse HEAD` 校验，porcelain-empty 不变量）
- 用户指令（本轮唯一核心问题，逐字意图）：能否为**真实 Linux 子进程**构造**独立的 read/write 访问规则**，并通过**现有或最小扩展的 DSH 基础设施接缝**提供给**原生工具**？
  - 验收样例：读权限只允许读 A（读 A 成功 / 读 B 被拒）；写权限只允许写 B（写 B 成功 / 写 A 被拒）
  - 附加：文件与目录规则粒度、执行环境必要依赖、≥1 原生 Bash/subprocess 接入点、原生 ToolDefinition 不修改、拒绝 = 真实 OS 效果
  - 排序裁决：第一步完全脱离 Team，直接用 Linux OS 机制验证；内核层成立后再做非常薄的 DSH 接口接入

## 结论（先行）

**YES（本宿主、bwrap 机制、目录粒度 + 单文件暴露粒度）**：
1. 内核层（STEP1，19/19 PASS）：bwrap 0.11 可构造「A 只读 + B 掩码（读轴）」与「B 精确可写 + A 只读（写轴）」两类真实子进程域；执行环境依赖由原生基线（`--ro-bind / /` + `/dev /proc /tmp`）自动满足；拒绝 = EROFS/ENOENT 真实 OS 效果；host 负控证明域内效果非环境噪音。
2. 接缝层（STEP2，12/12 绿）：原生 `spawnArgv` 消费的两个**公开服务面**（`sandboxPolicy.resolve` 策略载体 + `ctx.get("sandbox").confine` argv 构造器）在**零核心改动、ToolDefinition 不变**的前提下，可携带附加 `io` 规则字段（最小加性词汇扩展）并把双轴 bwrap 域交付给原生 bash 工具；PTY 输出 + 宿主 FS 侧效应双重证明拒绝为真实 OS 效果。
3. 边界（如实披露）：bwrap 无「只写不可读」目录（rw bind ⇒ 可读，dialect）；读拒绝 = ENOENT（掩码）而非 EACCES；单文件**原地掩码**不可行（挂载点必须为目录，实测 ENOTDIR），文件级规则 = 「掩码父目录 + 单文件 ro-bind 暴露到指定路径」的暴露式；landlock（可给 EACCES/只写/真 allowlist）**本 WSL2 宿主 ENV_BLOCK**（add_rule EBADF，见 §4）。
4. 生产路径定位：原生 `bwrapProfileArgs` 词汇（`{mode, workspaceRoot}` 单根）**仍不表达**双轴（上轮 D-FS-02 UNSUPPORTED 结论对**原生词汇**维持不变）；生产化 = 扩展 `SandboxPolicy` 词汇 + `bwrapProfileArgs`（upstream source 变更 = CORE PATCH BUDGET 0 下为 **CORE_SEAM_BLOCKER**）；本轮 wrapper 路径 = 接缝充分性 + 机制可表达性的 PoC 级证明。

## 1. STEP1 — 内核层（纯 Linux OS，无 Team/DSH）

脚本 `tests/kits/a5x-envpoc/a5x-dfs02-step1.sh`；主证据 `a5x-dfs02step1-20261102T164041Z/`（19/19 PASS）；provenance：`...T162609Z`（`--tmpfs /` 从零建根失败，exec ENOENT）、`...T163244Z`（R/W 绿 + Rf 文件掩码 ENOTDIR 首捕获）、`...T164009Z`（18/19，仅 W4 判定式笔误）。

### 1.1 域构造（bwrap 0.11 实测，负控 T6–T19 记录于脚本头注释）

- **基线**（与 DSH `bwrapProfileArgs` 同构）：`--ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent --tmpfs /tmp` —— 系统全 ro ⇒ 执行环境依赖（/usr、/lib64→usr/lib64、/bin→usr/bin、/etc、动态链接器）自动满足。
- **写轴**：`--bind <祖先> <祖先>`（rw 祖先，bwrap 0.11 在 ro 父链上放挂载点会 mkdir-EROFS，T9/T10 实测）→ `--bind <写根> <写根>` → `--remount-ro <祖先>`（非递归，子挂载保持 rw）⇒ **写作用域 = 精确写根**（兄弟目录创建 EROFS 实测）。
- **读轴（掩码）**：`--bind <祖先> <祖先>` → `--tmpfs <被掩码路径>`（目录或单文件暴露之替代）→ `--remount-ro <祖先>` ⇒ 被掩码路径 = 空 tmpfs（ENOENT/列表为空）。
- **文件级暴露**：`--ro-bind <单文件> <命名空间内新路径>`（T18/T19b 实测可行；文件 ro ⇒ 写 EROFS）。
- **实测不可行点（边界，非缺陷假设）**：
  - `--tmpfs /` 从零建根 + 后随 bind：bwrap 0.11 下系统路径无法复活（exec ENOENT，T7/T8）⇒ 弃用。
  - ro 父链上直接 `--tmpfs`/`--bind` 于深层路径：`Can't mkdir parents ... Read-only file system`（T9/T10）⇒ rw 祖先技术解决。
  - 单文件**原地掩码**（`--tmpfs <existing-file>`）：`Can't mkdir <file>: Not a directory` ⇒ bwrap 挂载点必须为目录；文件级规则只能暴露式。

### 1.2 验收矩阵（真实 OS 效果，逐格）

| 腿 | 域/规则 | 命令 | 期望 | 实测（exit / 效果） |
| --- | --- | --- | --- | --- |
| R1 | R（读轴，目录规则）：A 可读，B 掩码 | `cat A/one-file.txt` | 成功 | 0 / `ALPHA-CONTENT-7741` |
| R2 | R | `cat B/b-file.txt` | 被拒 | 1 / `No such file or directory`（掩码=ENOENT，非 EACCES——bwrap 无读拒绝绑定） |
| R2b | R | `ls -A B` | 空 | 0 / 空列表 |
| R3 | R | `echo x > A/r3.txt` | 被拒 | 2 / `Read-only file system`（EROFS） |
| R3b | R | `mkdir baseB/sib`（写作用域外溢探测） | 被拒 | 1 / EROFS |
| R4 | R（执行环境依赖） | `echo $((21*2)); ls /usr/bin` | 成功 | 0 / `sum=42` + 目录列表 |
| R5 | R（执行环境依赖） | `/etc/hostname`、`/proc/self/status`、`/dev/null`、`/tmp` 写读 | 成功 | 0 / hostname + `Name:` + `devnull-ok` + `tmpok` |
| W1 | W（写轴，目录规则）：B 精确 rw，A ro | `echo w-content > B/w-new.txt && cat` | 成功 | 0 / `w-content` |
| W2 | W | `echo x > A/w2.txt` | 被拒 | 2 / `Read-only file system` |
| W2b | W | `mkdir baseB/sib` | 被拒 | 1 / EROFS（精确写作用域成立） |
| W3 | W（dialect 记录） | `cat A/one-file.txt` | 可读（ro / 语义） | 0 / `ALPHA-CONTENT-7741`（bwrap rw/ro 均可读——无只写目录） |
| W4 | W（执行环境依赖） | `which cat; id -u` | 成功 | 0 / `/usr/bin/cat` + uid |
| Rf1 | Rf（**文件规则**·暴露式）：掩码 A 目录 + 单文件 ro-bind 暴露 | `cat /tmp/whitelist-x.txt` | 成功 | 0 / `ALPHA-CONTENT-7741` |
| Rf2 | Rf | `ls -A A` | 空（父目录被掩码） | 0 / 空 |
| Rf3 | Rf | `cat A/one-file.txt`（原路径） | 被拒 | 1 / ENOENT |
| Rf4 | Rf | `echo x >> /tmp/whitelist-x.txt` | 被拒 | 2 / EROFS（暴露为 ro） |
| Rf5 | Rf | `cat B/b-file.txt` | 被拒 | 1 / ENOENT |
| 边界 | bwrap 文件级原地掩码 | `--tmpfs A/dir-other.txt` | — | 失败 / `Can't mkdir ...: Not a directory`（记录为机制边界） |
| 负控 | 域外宿主直跑 | `cat B/b-file.txt`、`cat A/dir-other.txt` | 成功（证明域内效果非环境噪音） | 0 / 两文件内容原样 |

### 1.3 landlock 环境探测（STEP1 内置 env-probe）

- kernel `6.18.33.2-microsoft-standard-WSL2`，`CONFIG_SECURITY_LANDLOCK=y`。
- 实测：`landlock_create_ruleset` OK（带 handled bits）/ ENOTTY（空 ruleset）；`landlock_add_rule`（path-beneath）对**所有 fd 变体**（O_RDONLY|O_DIRECTORY、O_PATH、ext4 workspace 目录、/ 根）= **EBADF `File descriptor in bad state`**；`/sys/kernel/security` 为空（无 lsm 文件）。
- 判定：**landlock 规则集在本宿主不可填充（ENV_BLOCK）**——WSL2 内核虽编译 landlock，但规则添加被拒（lsm 链未暴露 landlock）。landlock 可表达的更强语义（EACCES 读拒绝、只写不可读、真 allowlist）**待 landlock 活跃的内核上另测**；本宿主 DSH 亦实测走 bwrap（与历轮宿主行为一致）。

## 2. STEP2 — 薄 DSH 接缝（内核层成立后的接入验证）

Kit `tests/kits/a5x-envpoc/a5x-ioaxis-kit.mjs` + wrapper `tests/kits/a5x-envpoc/a5x-fork-ioaxis-v3.mjs`；主证据 `a5x-pocIOAXIS-20261102T164902/`（run2，12/12 绿）；provenance `...T164631`（run1：FS 侧效应全对、判定索引 off-by-one 捕获）。

### 2.1 接缝解剖（代码事实，非推断）

原生 `terminal-bash` `spawnArgv`（`packages/terminal/terminal-bash/lib/index.js` L963–974，0.2.0-rc.2 @ `639ed01539`）：

```js
const argv = [config.shellPath, ...config.shellArgs];
if (policy.mode === "danger-full-access") return argv;          // danger = 裸 argv
const sandbox = ctx.get("sandbox");
return (await sandbox.confine(argv, { ...policy, mode: policy.mode }, signal)).argv;
```

两个**公开服务面**（均为 cordis 服务契约，非私有 API）：
1. `ctx.sandboxPolicy.resolve({session}) → {mode, workspaceRoot}` —— 策略载体（`@deepseek-ai/dsh-sandbox-policy` 公开服务；v2 wrapper 已证明可按 session 封顶）。
2. `ctx.get("sandbox").confine(argv, policy, signal) → ConfinedArgv` —— argv 构造器（`SandboxProvider` 抽象服务，`super(ctx, 'sandbox')`，公开抽象方法；实现 `LocalSandboxProvider`）。

**最小加性扩展** = 解析出的 policy 上附加 `io: { writeRoots[], maskPaths[], exposeFiles{} }`（原生代码对这些字段惰性——它只读 `{mode, workspaceRoot}`）+ `confine` 的影子实现（Proxy 于**真实** provider：`io` 在场 → 构造双轴 argv；`io` 缺席 → **委托真实 confine**（passthrough，其他消费者零影响））。零核心字节改动，零 ToolDefinition 改动（kit 静态断言 `name`/`inject` 与原生导出恒等：`terminal-bash` / `["terminals","sandboxPolicy","sessionProjections","subprocess"]`，记录于 `ioaxis.json.nativeToolDefinitionIdentity`）。

### 2.2 两条 lane（同一原生 bash 工具，不同 member caps；PTY 输出 = 原生工具真实输出）

caps（deployer 文件，PoC stand-in for TeamDomain 绑定；exact session-id 键、fail-closed，v2 规则沿用）：

| lane | caps | 域（双轴 argv 由 confine 影子构造） |
| --- | --- | --- |
| IO-R | `{mode: workspace-write, workspaceRoot: rootA, io: {maskPaths: [rootB]}}` | ro / 基线 + 掩码 rootB（读轴域） |
| IO-W | `{mode: workspace-write, workspaceRoot: rootB, io: {writeRoots: [rootB]}}` | ro / 基线 + 精确 rw rootB（写轴域） |

判定（run2，工具输出 + 宿主 FS 侧效应 + consulted 轨迹，不靠散文）：

| 腿 | oracle | 实测 |
| --- | --- | --- |
| IO-R 读 A | 工具输出含 `ALPHA-CONTENT-7741`，exit 0 | ✅ |
| IO-R 读 B 被拒 | 工具输出 `No such file or directory`，无 `BETA-CONTENT-3356` | ✅ |
| IO-R 写 A 被拒 | 工具输出 `Read-only file system`，exit 1 | ✅ |
| IO-R FS 侧 | `rootA/r-write.txt` 不存在 | ✅ |
| IO-W 写 B | 工具输出 `w-content` exit 0 | ✅ |
| IO-W FS 侧 | `rootB/w-new.txt` 存在且内容 = `w-content` | ✅ |
| IO-W 写 A 被拒 | 工具输出 `Read-only file system` | ✅ |
| IO-W FS 侧 | `rootA/w-write.txt` 不存在 | ✅ |
| IO-W 读 A（dialect） | 工具输出 `ALPHA-CONTENT-7741`（写轴域内 A 可读——bwrap 语义，如实记录） | ✅ |
| SEAM resolve 被咨询（两会话） | `[ioaxis] resolve sid=… base.mode=workspace-write mapped=gen1` | ✅ |
| SEAM cap 生效（io=yes ×2） | `[ioaxis] CAP applied … io=yes` | ✅ |
| SEAM 双轴 confine（R/W） | `[ioaxis] confine sid=… maskPaths=["…rootB"]` / `writeRoots=["…rootB"]` + argv 前缀 `/usr/bin/bwrap --ro-bind / / …` | ✅ |
| ToolDefinition 恒等 | `name`/`inject` 与原生导出 JSON 恒等 | ✅ |
| 稳定实例无扰 | :3080 探测 401 → 401 | ✅ |

### 2.3 本轮新发现（接缝层）

- **F-1（投影一致性附带证据）**：两条 lane 的首条用户消息投影均显示 `Current DSH file policy: workspace-write`，而 OS 域实际为封顶后的双轴 workspace-write——本轮无 divergence（对比 B2R2 轮 `danger-full-access` 投影 vs 钳制域的 divergence：本 PoC 的 cap 保持 mode 字符串不变、只加 io，投影与域 mode 一致；**divergence 风险只存在于 mode 被钳制的场景**，P4-05A 覆盖建议维持）。
- **F-2（policy 对象是天然的规则载体）**：原生 `spawnArgv` 把解析出的 policy 整体透传给 `confine`（`{...policy, mode}`）——加性字段无需任何原生配合即可到达 argv 构造点。这是「最小扩展」成立的结构性原因。
- **F-3（consult 粒度沿袭 spawn 级）**：双轴 argv 在 PTY spawn 时一次性构造（与 B2R2 D-PTY-04 的 stale-domain 发现同粒度）：会话中途变更 caps 的 io 字段不重入已存 PTY（P2-04 覆盖建议维持）。

## 3. 对上轮 D-FS-02 判定的精化（不推翻，分层）

上轮：D-FS-02 **UNSUPPORTED @ 现有政策接缝**（`{mode, workspaceRoot}` 单根词汇，跨成员读双向 RED×2）。本轮分层结论：

| 层 | 判定 | 依据 |
| --- | --- | --- |
| 原生词汇（`SandboxPolicy` + `bwrapProfileArgs`） | **UNSUPPORTED（维持）** | 未改动、不可改动（budget 0）；词汇无 per-path 读轴 |
| 内核机制（bwrap 0.11，本宿主） | **EXPRESSION-FEASIBLE（本轮新证据）** | 目录级双轴 + 单文件暴露式，§1 全矩阵 |
| 内核机制（landlock，本宿主） | **ENV_BLOCK（本轮新证据）** | §1.3；待活跃内核另测 |
| 接缝充分性（公开服务面 + 加性 io + confine 影子） | **SUFFICIENT（wrapper 证明，PoC 级）** | §2 全矩阵；生产化 = CORE_SEAM_BLOCKER 直到预算 |

## 4. 限制与如实披露

1. **bwrap dialect**：rw bind ⇒ 可读（无只写目录）；读拒绝 = ENOENT（掩码）而非 EACCES；「只允许读 A」在 bwrap 语义下 = 「A 可见 + B 掩码 + 其余 ro 可见」（deny-by-mask，非 read-allowlist）。landlock 可给严格语义但本宿主不可用。
2. **文件级规则 = 暴露式**（掩码父目录 + 单文件 ro-bind 到指定路径；原路径不可见）。原地单文件掩码不可行（§1.1 边界）。
3. **shadow confine 替换了原生 argv 构造**（对 io 在场的会话）：双轴 argv 由 wrapper 构造，未复用 `bwrapProfileArgs`（它不表达双轴——正是 UNSUPPORTED 点）。passthrough 保证 io 缺席时 100% 原生路径。
4. **生产路径**：`SandboxPolicy` 词汇扩展 + `bwrapProfileArgs` 双轴化 = upstream source patch = **CORE_SEAM_BLOCKER**（budget 0）；wrapper 路径证明「接缝可承载 + 机制可表达」，不替代生产化裁决。
5. wrapper 为 PoC disposable（caps 文件 = deployer stand-in；无 referential integrity、无 ledger）；沿用 v2 的 exact-id / fail-closed / gen / consulted-trace 纪律。

## 5. 工件清单

- `tests/kits/a5x-envpoc/a5x-dfs02-step1.sh` — STEP1 内核层脚本（域构造 + 19 腿判定 + landlock env-probe + 边界探针）
- `tests/kits/a5x-envpoc/a5x-fork-ioaxis-v3.mjs` — v3 zero-copy wrapper（v2 caps 纪律 + 加性 io + sandbox-confine 影子）
- `tests/kits/a5x-envpoc/a5x-ioaxis-kit.mjs` — STEP2 runner（host boot 3186、mock、2 lane、12 项判定）
- 证据：`a5x-dfs02step1-20261102T164041Z/`（主）+ 3 provenance；`a5x-pocIOAXIS-20261102T164902/`（主）+ `...T164631/`（provenance）
- 未跟踪（不提交，沿先例）：`poc-*.log`、`b2r2-run*.log`
