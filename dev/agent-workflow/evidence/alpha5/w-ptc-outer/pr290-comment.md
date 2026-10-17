## 外层程序 I/O 旁路负控已补（回应 comment 6230116007）— 裁决＝**分支③ PROBE-GATED + 精确局部阻塞**

证据轮 `dev/agent-workflow/evidence/alpha5/w-ptc-outer/`（canonical `runs/outer-2026-10-17T06-34-21Z/`，
**27/27 判据 + 8 INFO，exit 0**），分支 `alpha5-ptc-outer`，证据 commit `348f9989863cc838098288ead621cb0fc05dd751`
（基线 = 本 PR tip `c0333d8f`；本文所在评论文件本身随后续 commit 落库，不改动上述证据 commit）。零上游改、零私有 API、零权限扩、未部署活宿主、`:3080` 零触碰（pre/post 401）。

### 1. 直接旁路负控（PTC 程序不调用任何注册工具）

世界里只注册一个**从不被引用**的 witness 工具（程序体里 `tools.` 出现 0 次；guard 普查：只见外层
`run_code` 一条，`inner=false`，witness 零调用）。程序体在 `run_code` 内直接
`node:fs` 读写、`node:child_process.spawn`、`net.connect`，无一处注册工具调用。

**LIVE 默认姿态（部署默认 `workspace-write`，本行写模式次数=0，模式前后经公开读 `sandboxPolicy.resolve` 测得）逐字答复**：

```
Error: code run failed (sandbox-unavailable): sandbox mode "workspace-write" is requested but
no sandbox backend is usable on this host; refusing to run the command unconfined. Install
bubblewrap or run a Landlock-enforcing kernel (Linux), ensure sandbox-exec is usable (macOS),
or ensure the ACL restricted-token runner can start (Windows) — otherwise switch the consumer
to danger-full-access.
File sandbox: workspace-write.
```

独立普查：禁区写目标不存在、子进程目标不存在、decoy 连接增量 0、密钥哈希未变，**连工作区内 CONTROL 写都未发生**
⇒ 拒绝是**整程序级 fail-closed（在 spawn 之前）**，不是逐 API 处置；40 ms `/proc` 采样全程**零外层 OS 子进程**。

**公开加宽面（`sandbox_permissions`+`justification`，独立默认姿态会话）**＝审批门而非通行证：会话日志末三事件

```
tool/call      {name:"run_code", callId:"call-vi9ykl6j", arguments:{…sandbox_permissions:"danger-full-access"…}}
approval/asked {toolName:"run_code", callId:"call-vi9ykl6j",
                reason:"escalate sandbox to danger-full-access: a5ptc3 negative control: …"}
（无 tool/result）
```

零写入、零外层 OS 子进程、该会话模式恒 `workspace-write`。

### 2. 逐 API 真阻止 vs 直通（OS 强制口径 = 真 Landlock 域）

REALM/OS 面：宿主**自己 build 出的** PTC 子入口（公开 `./process`）经宿主**自己的**继承控制通道
（fd 7 + `DSH_SUBPROCESS_CONTROL`）驱动；受控腿由在册 `landlock-prelauncher.py --confined-exec` 真
`execve`（本机 `--abi-probe` → `{"kind":"abi-available","abi_version":4}`）。两腿各自独立 fixture 子树
与独立 listener，**受控腿先跑**以免普查互相污染。

| API | 无域对照腿 | 真 Landlock 域（ABI v4） | 独立普查 |
| --- | --- | --- | --- |
| fs READ 禁区私有 fixture | 直通（内容读入程序结果） | **真阻止** `EACCES` | 文件字节未变 |
| fs WRITE 禁区 | 直通（文件真创建） | **真阻止** `EACCES` | 目标文件不存在 |
| fs WRITE 禁区（经直接 spawn 的子进程） | 直通（子进程真写） | **真阻止**（`/bin/sh: cannot create …: Permission denied`，rc=2） | 子目标不存在 ⇒ **域跨 fork/execve 继承** |
| `child_process.spawn` 本身 | 直通 | 直通（execve granted 路径非被拒效果） | 子进程回显 `A5PTC3-SPAWN-RAN`+uid |
| fs READ 工作区外、姿态本就可读路径 | 直通 | 直通 | 与宿主 profile `readOnly ['/']` 形状一致 |
| **`net.connect` → 本轮 listener** | 直通（1 conn/64B） | **直通（1 conn/62B，listener 实收程序写入字节）** | **网络非文件效果，域完全不覆盖** |
| fs WRITE 工作区内 CONTROL | 直通 | 直通 | 域为**选择性**，非一刀切失败 |

`invert-check.mjs` 用「应被违反的姿态」的数据反转复算每条负控：文件写族判据**判别成立**；
`net.connect` 判据**判别不成立** ⇒ 登记为缺口，**绝不记为防护**。

### 3. 「运行时本来不暴露」分支＝不适用（实测允许面）

真实 realm 内自省：`node:fs ok(105)`、`node:child_process ok(10)`、`node:net ok(19)`、
`worker_threads ok(22)`、`module ok(31)`、`http ok(22)`；`require/module/exports/tools=undefined`；
globalThis 计数 135；`process.env` 键=**空**（宿主 bootstrap 清空环境）。旁路**按设计可达**，
故改用**可达正控真跑**（上表第一列）而非「能力未暴露」的对照证明。

### 4. M-08 原计划受控对象核对（行号，非猜测）

- `docs/plans/memo/alpha5-tool-io-governance/S0-SELECTION-MATRIX.md:55` — 未测项列含
  「**外层直接 fs/net OS 级拒绝负控**」；禁止路径列含「**以"内层 guard 通过"替代外层防护**」；
  默认处理列「Strict `run_code` 禁用直至 PoC-6a 通过（或明示窄固定策略）；两案皆不成→禁用+记录 precise seam」。
- `post-poc-technical-design.md:123`「**外层 Node 进程直接 `fs`/`net` 访问则由独立受限 PTC Runtime 负责**」；
  `:125`「测试必须包含 … **outer code 直接 I/O** …」；`:66`「外层 Node **需要**受限进程」；
  `:191`「仍需每调用 Grant 注入/**OS 拒绝负控**」；`:214` D5 受控对象「**per-Member/per-call OS 文件网络效果**与内层逐次 Guard」；
  `:22`「每调用真实策略注入仍需专项验证」；`:21`「**错误**。Landlock ABI4 不是任意网络通信全隔离；`network:deny` 必须有独立证明」。
- `dev/agent-workflow/evidence/alpha5/pr8/matrix-machine.json:552/569/574/616` — M-08
  `allowed_transitions=[LIVE, PROBE-GATED]`、`forbidden_outcomes` 含 `PASS`/`SUPPORTED`、`acceptance_scope=criterion-level-fixture`。

⇒ 外层程序自身 fs/net 效果**在原计划受控对象之内**，故本轮**不是**「不在范围内」的范围澄清。

### 5. 三态裁决＝**③ PROBE-GATED + 精确局部阻塞 + 最小复现**

精确局部阻塞（一句）：**外层进程的可信文件域只能整程序级（mode 粒度）给定，公开 seam 无法把
per-call Grant 注入外层 bootstrap；网络效果无任何 OS 机制覆盖。**
公开 seam 普查（逐字在 `legA-state.json → throwCensus`）：`run_code` 在 root/scope 两侧
register/restrict 共四处 typed throw（保留传输名）；`ctx.set('ptcRuntime', …)` 被
`cannot set property "ptcRuntime" in multiple fibers` 拒；外层 bootstrap 的 spawn 无公开挂点。

同时明确**不得**由此推出、也**不得**反向混同的两件事：

1. C2 的 COMPOSED-LIVE 只覆盖**内层 per-call 载荷执行边**（同一装配链 guard 逐次断链 + Lane C 受限
   provider 真 execve/OS 拒绝），它**不是**外层防护的证据 —— S0:55 禁止路径正列着「以内层 guard
   通过替代外层防护」。
2. 「外层明确不保证」的披露与 M-08 整行 LIVE/SUPPORTED **不是**同一件事：本轮既未把披露当验收，
   也未因默认姿态 fail-closed 而主张整行防护 LIVE。行级 LIVE 仍为**提案值**，终裁归 PR8 正式轮 +
   独立 reviewer；writer 不翻矩阵行。若公开 seam 确实不足，本轮按您的要求**保留精确局部阻塞而不降低支持标准**。

最小复现：

```bash
cd .worktrees/alpha5-ptc-outer/dev/agent-workflow/evidence/alpha5/w-ptc-outer
node run-a5ptc3-outer.mjs --realm-only     # 零端口/零宿主：两腿真值表（OS 强制口径）
node run-a5ptc3-outer.mjs                  # 加跑 LIVE 面（真宿主 :3184 自证空闲，世界跑毕删除）
node invert-check.mjs --run-dir runs/outer-2026-10-17T06-34-21Z   # 判据判别性反转（离线复算）
```

### 6. host 身份实测行（同构建身份复测，覆盖 TESTUSE-WINDOW-AUDIT 对 05:08:09 canonical 轮的缺行项）

runner 于本轮内亲采并写入 `host-identity.json` / `host-identity-post.json` + `criteria.json`（`P-HOST-IDENTITY` PASS）：

```
test-use HEAD 639ed015397290b3745d163aafe02ffee4aa3f84  porcelain 行数 0  pin 相符 true
launcher sha256     cee10ed55f12123f84716e57a5d46b3d0e9abe2394161dd061fb846a4ebfb458 (17587 B)
PTC 子入口 sha256   1a5631d2a92980bfc86966921c16ff1ad345f4dc1d22328753dc60c281f58cfe
host/bin.js sha256  1a03dee18683483ff6a1b27b2a1e650230da6bcca9a0f55f7d81b3308c3f307f
node v24.21.0   kernel 6.8.0-142-generic   Landlock --abi-probe rc=4 → abi_version 4
```

### 7. 本轮未覆盖（如实）

M-08 其余未测项：并发 Member 不同 one-shot、父取消/子调用排空 drain；未安装 bubblewrap / 未换内核，
故「有 bwrap 后端时的逐 API 处置」不在本轮证据内；披露腿（per-session 公开开关）零 OS 强制口径且只用
独立 `-legc` 目标路径，LEG A 目标路径此后逐字节未变。
