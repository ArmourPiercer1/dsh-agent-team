# W-PTC-OUTER — 外层程序 I/O 旁路负控（PR #290 review comment 6230116007）

**问题（评审原话浓缩）**：PTC 程序不调用任何注册工具，直接用运行时允许的文件 / 子进程 / 网络 API
访问测试禁区，是否被**真实阻止**？若运行时本来不暴露这些能力，须以**实际允许的 API 清单 + 正反对照**
证明；并按 M-08 原计划的受控对象范围（引行号）判定，不得把「外层明确不保证」的披露与整行
LIVE/SUPPORTED 混为完整验收。

**本轮结论（三态裁决）＝ 分支③：PROBE-GATED ＋ 精确局部阻塞 + 最小复现。**
外层直接效果**在** M-08 原计划受控对象之内（不是范围澄清）；可观测姿态下文件写能被真实阻止，
但 **网络效果在任何可观测姿态下都直通**，且公开 seam 无法把 per-call Grant 注入外层 bootstrap。
详见 §5。

- 轮次：`runs/outer-2026-10-17T06-34-21Z/`（GREEN **27/27** 判据 + 8 条 INFO，`criteria.json`）
- 分支 / head：`alpha5-ptc-outer` @ 本 commit（基线 = `alpha5-ptc-chain` tip `c0333d8f`）
- 宿主：**本轮亲采 host 身份行**（§7）；`:3080` 零触碰（pre/post 同为 401）；port 3184 自证空闲并释放；世界跑毕删除

---

## 1. 为什么需要三层观测面

单一姿态回答不了这个问题：

| 面 | 是什么 | 能回答 | 不能回答 |
| --- | --- | --- | --- |
| **LIVE 默认姿态** | 真宿主（port 3184）＋ 部署默认 `workspace-write`，本行**从不**调 `setSandboxMode` | 用户/模型实际会遇到的答复是什么 | 本机没有可用沙箱后端时，"策略本来会怎么判" |
| **REALM/OS 面** | 宿主**自己编译出的** PTC 子入口（公开 `./process` 导出）经宿主**自己的**继承控制通道（fd 7 + `DSH_SUBPROCESS_CONTROL`）驱动；受控腿由在册 Landlock 预启动器 `execve` | 「若 OS 域在场，逐 API 是真阻止还是直通」＝ OS 强制口径 | 「经过 ToolRuntime/guard/宿主沙箱服务的端到端行为」 |
| **披露对照（LEG C）** | 测试世界内 per-session 公开开关（宿主 typed 拒绝原文亲笔处方的那条路），零 OS 强制口径 | 传输/程序体是否真的可达执行（排除"根本没跑"的假阴性） | 任何防护强度（明确**不**主张） |

REALM 面不是 ToolRuntime 端到端：它绕开了宿主沙箱服务，直接测**内核域对宿主自己那个 realm 的效果**。
这一点在 `realm-truth-table.json` 的 `caliber` 字段里同样写明。

## 2. 「运行时不暴露这些能力」分支＝不适用（实测清单）

在真实外层 realm 内部自省（`realm-truth-table.json → unconfined.realm`）：

```
node:fs ok(105)  node:child_process ok(10)  node:net ok(19)
node:worker_threads ok(22)  node:module ok(31)  node:http ok(22)
typeof: process=object console=object Buffer=function fetch=function WebAssembly=object
        require=undefined module=undefined exports=undefined tools=undefined Worker=undefined
globalThis 计数=135；process.env 键= []（宿主在程序运行前把环境清空）
```

动态 `import()` 六项全部成功 ⇒ 旁路**按设计可达**（运行时自己的说明书就写着 `await import`）。
因此「以正反对照证明能力未暴露」这条分支不启用；本轮改用**可达正控真跑**（§3 第一列）。

`process.env` 为空是本轮把 fixture 路径烘进程序源码的原因（不是策略，是宿主 scrub 行为，见
`packages/ptc-runtime/ptc-runtime-node/src/bootstrap.ts` 的 `STARTUP_ENVIRONMENT_NAMES` + `process.env = Object.create(null)`）。

## 3. 逐 API 真阻止 vs 直通（本轮实测真值表）

未注册任何被调用工具（世界里只有一个从不被引用的 witness 工具；程序体里 `tools.` 出现 0 次）。

### 3.1 REALM 面（同一子入口、同一程序体，两腿各自独立 fixture 子树 + 各自 decoy listener；受控腿先跑）

| API / 探针 | 无域（对照腿） | **真 Landlock 域（ABI v4）** | 独立普查 |
| --- | --- | --- | --- |
| fs READ 私有禁区 fixture | **直通**（内容读进程序结果） | **真阻止** `EACCES` | 文件字节未变 |
| fs WRITE 禁区 | **直通**（文件真创建） | **真阻止** `EACCES` | 目标文件不存在 |
| fs WRITE 禁区（经直接 spawn 的子进程） | **直通**（子进程真写） | **真阻止**（`/bin/sh: cannot create …: Permission denied`，rc=2） | 子进程目标文件不存在 ⇒ **域跨 fork/execve 继承** |
| `child_process.spawn` 本身 | 直通 | **直通**（execve  granted 路径不是被拒效果） | 子进程 `A5PTC3-SPAWN-RAN` + uid 回显 |
| fs READ 工作区外、姿态本就可读路径（`/etc/hostname`） | 直通 | **直通** | 与宿主姿态一致（`profiles.ts` `landlockProfileArgs` `readOnly ['/']`） |
| `net.connect` → 本轮 decoy listener | 直通（1 conn / 64B） | **直通**（1 conn / 62B，收到 `A5PTC3-OUTER-HELLO …-confined`） | **网络非文件效果，域完全不覆盖** |
| fs WRITE 工作区内 CONTROL | 直通 | 直通 | 域是**选择性**的，不是一刀切失败 |

受控腿的 grant 形状记录在 `realm-truth-table.json → grantShape` 与 `policy-*.json`：写只授予会话
工作区 + `/tmp` + `/dev`；读基座收窄到 node 自举所需（宿主自身 profile 在读侧是**宽松**的），
禁区**故意不在** grant 内。首腿曾因未授 `package.json` 读取而被域拒绝自举（真强制的副产品），
最终腿为「能跑起来 + 禁区不授」的形状。

### 3.2 LIVE 面（默认姿态，逐字答复）

LEG A（`workspace-write`，部署默认；公开读 `sandboxPolicy.resolve` 前后均为 `workspace-write`，本行写模式次数 = 0）：

```
Error: code run failed (sandbox-unavailable): sandbox mode "workspace-write" is requested but
no sandbox backend is usable on this host; refusing to run the command unconfined. Install
bubblewrap or run a Landlock-enforcing kernel (Linux), ensure sandbox-exec is usable (macOS),
or ensure the ACL restricted-token runner can start (Windows) — otherwise switch the consumer
to danger-full-access.
File sandbox: workspace-write.
```

配套普查：禁区写目标不存在、子进程目标不存在、decoy 连接数增量 = 0、密钥哈希未变；
**连工作区内的 CONTROL 写都没发生** ⇒ 拒绝是**整程序级 fail-closed（在 spawn 之前）**，不是逐 API 处置；
`/proc` 采样器（40 ms）在整个回合内**从未**采到外层 OS 子进程。guard 只看到外层 `run_code`
一条（`inner=false`，零内层复入，witness 工具零调用）。

### 3.3 公开加宽面（LEG B，独立默认姿态会话）

模型侧带 `sandbox_permissions:'danger-full-access' + justification` 调 `run_code`。宿主会话日志
（`session-logs/session-26a4d2b0*__session.v4.jsonl.zstd.redacted.txt` 末三事件）逐字：

```
tool/call      {name:"run_code", callId:"call-vi9ykl6j", arguments:{…sandbox_permissions:"danger-full-access"…}}
approval/asked {id:"c989cc65-…", toolName:"run_code", callId:"call-vi9ykl6j",
                reason:"escalate sandbox to danger-full-access: a5ptc3 negative control: …"}
```

**没有** `tool/result`：加宽请求变成人工审批请求后挂起；零写入、零外层 OS 子进程、该会话模式
始终 `workspace-write`。⇒ 公开加宽面**不会**在无人的情况下把外层文件域放大（它是审批门，不是通行证）。

### 3.4 披露对照（LEG C，零 OS 口径，自己的 `-legc` 目标路径）

per-session 公开开关后同一程序体**完整跑通**：读密钥 / 写禁区 / 子进程写 / 网络 全 直通，
外层 OS 子进程 1 个，decoy 收到字节；LEG A 的目标路径此后仍逐字节未变。
意义：LEG A 的沉默是**约束决定**，不是死传输。此腿**不主张**任何防护强度。

## 4. 判据能否真的判别（RED-first 反转，离线复算）

`invert-check.mjs` 用**应被违反的姿态**的数据重算每条负控（`runs/<stamp>/red-first-inversion.json`）：

- 判别成立（值随姿态翻转）：禁区写、经子进程的禁区写、默认姿态零效、默认姿态无 OS 子进程；
- **判别不成立（按设计如此，登记为缺口而非防护）**：`net.connect`（文件域无论如何在两姿态都放行）；
- 选择性 CONTROL 腿为「设计为同值」的对照，不参与判别。

## 5. M-08 原计划受控对象核对（引行号，不猜）＋ 三态裁决

**原计划范围（外层效果确在内）**

| 出处 | 行 | 原文关键片段 |
| --- | --- | --- |
| `docs/plans/memo/alpha5-tool-io-governance/S0-SELECTION-MATRIX.md` | **55** | 未测项列：「并发 Member 不同 one-shot、**外层直接 fs/net OS 级拒绝负控**、父取消/子调用排空 drain」；禁止路径列：「**以"内层 guard 通过"替代外层防护**」；默认处理列：「Strict `run_code` 禁用直至 PoC-6a 通过（或明示窄固定策略）；两案皆不成→禁用+记录 precise seam」 |
| 同目录 `post-poc-technical-design.md` | **123** | 「内层 `tools.*` … 必须逐调用 Admission/ClosedWorldGuard；**外层 Node 进程直接 `fs`/`net` 访问则由独立受限 PTC Runtime 负责**」 |
| 同上 | **125** | 「测试必须包含并发 Member、不同 one-shot scope、**outer code 直接 I/O**、inner deny、父取消/子调用排空」 |
| 同上 | **66** | D 类行：「外层 Node **需要**受限进程；内层按各工具自身路由」 |
| 同上 | **191** | 「PTC direct Node I/O ｜ 外层 NodePtcRuntime 真实进程 PoC ｜ **仍需每调用 Grant 注入/OS 拒绝负控**」 |
| 同上 | **214** | D5 行受控对象：「**per-Member/per-call OS 文件网络效果**与内层逐次 Guard」 |
| 同上 | **22** | 「**每调用真实策略注入仍需专项验证**」 |
| 同上 | **21** | 「**错误**。Landlock ABI4 不是任意网络通信全隔离；`network:deny` 必须有独立证明」 |
| `dev/agent-workflow/evidence/alpha5/pr8/matrix-machine.json` | **552 / 569 / 574 / 616** | M-08 行：`status_now=TRANSITIONED-LIVE`；`allowed_transitions=[LIVE, PROBE-GATED]`；`forbidden_outcomes=[PASS, SUPPORTED, REQUIRES-LIVE-WIRING-as-terminal]`；`acceptance_scope=criterion-level-fixture` |

⇒ 原计划受控对象**明确包含外层程序自身的 fs/net 效果**（含"OS 级拒绝负控"这一未测项），
所以本轮**不是**「不在原计划范围内」的范围澄清。

**实测到的范围（本轮证据边界）**

1. 默认姿态（本部署/本宿主）：外层效果被**整程序级 fail-closed** 拒于 spawn 之前——真实阻止，
   但阻止的形态是"不跑"，不是"跑起来后逐 API 拒绝"。
2. 真 Landlock 域（ABI v4，宿主自己的 realm 自举 + fd 7 控制通道存活）：**文件写效果被内核拒**
   （直接写 + 经子进程写，域跨 execve 继承），读侧在宿主 profile 形状下本就宽松。
3. **网络效果在任何可观测姿态下都直通**：Landlock 文件域不覆盖 socket；宿主 `bwrapProfileArgs`
   无 `--unshare-net`；设计文档 :21 自己已封掉「Landlock 成立即能 network deny」的说法。
4. **公开 seam 无法把精确 per-call Grant 注入外层 bootstrap**：`run_code` 在 root/scope 两个面
   register/restrict 四处均 typed throw（保留传输名，逐字见 `legA-state.json → throwCensus`）；
   `ctx.set('ptcRuntime', …)` 被 `cannot set property "ptcRuntime" in multiple fibers` 拒；
   外层 bootstrap 的 spawn 无公开挂点。⇒ 无法把「本次 Grant」变成外层进程的真实文件域。

**裁决**：分支 **③ PROBE-GATED ＋ 精确局部阻塞 + 最小复现**。

- 精确局部阻塞（一句话）：**外层进程的可信文件域只能整程序级（mode 粒度）给定，公开 seam
  不能注入 per-call Grant；网络效果无任何 OS 机制覆盖。**
- 不得由此推出的结论：不得把 C2 的 COMPOSED-LIVE 读作外层已受控（S0:55 禁止路径明列
  「以内层 guard 通过替代外层防护」）；不得因本轮的默认姿态 fail-closed 把 M-08 整行说成
  防护 LIVE；也不得因外层不保证而把内层逐调用边降级。
- 行级 `LIVE` 仍只是**提案值**，终裁归 PR8 正式轮 + 独立 reviewer；writer 不翻矩阵行。

## 6. 最小复现

```bash
cd .worktrees/alpha5-ptc-outer/dev/agent-workflow/evidence/alpha5/w-ptc-outer
# 只跑 REALM/OS 面（零端口、零宿主）：受控/无域两腿真值表
node run-a5ptc3-outer.mjs --realm-only
# 加跑 LIVE 面（真宿主 port 3184，自证空闲；世界 tests/homes/a5ptc3-outer-<stamp>，跑毕删除）
node run-a5ptc3-outer.mjs
# 判据判别性反转（离线，用已录数据复算）
node invert-check.mjs --run-dir runs/outer-<stamp>
```

复跑所需：pinned 宿主树（`tests/paths.mjs` 的 `TEST_USE_BASELINE_SHA`）、在册预启动器
`packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`、`python3`、Landlock ABI≥4 内核。

## 7. host 身份实测行（覆盖 TESTUSE-WINDOW-AUDIT 对 ptc-chain canonical 轮 05:08:09 的重测项）

本轮 runner 亲采、写进 `host-identity.json`（pre）与 `host-identity-post.json`（post，含
`identityUnchanged`）：

```
test-use HEAD  639ed015397290b3745d163aafe02ffee4aa3f84   porcelain 行数 0   pin 相符 true
launcher sha256      cee10ed55f12123f84716e57a5d46b3d0e9abe2394161dd061fb846a4ebfb458  (17587 B)
child entry sha256   1a5631d2a92980bfc86966921c16ff1ad345f4dc1d22328753dc60c281f58cfe
host bin.js sha256   1a03dee18683483ff6a1b27b2a1e650230da6bcca9a0f55f7d81b3308c3f307f
node v24.21.0 (/home/user/.nvm/versions/node/v24.21.0/bin/node)   kernel 6.8.0-142-generic
Landlock ABI --abi-probe → {"kind":"abi-available","abi_version":4}（rc=4）
runner branch alpha5-ptc-outer @ c0333d8f6e5acfd8acf2a0709dff72bca9a2e6d5（采点时刻）
```

⇒ 与 ptc-chain canonical 轮 05:08:09 同一构建身份的复测行：**同一 SHA、同一 porcelain=0、
同一 launcher sha256**（`P-HOST-IDENTITY` 判据 PASS，`criteria.json`）。

## 8. 未做 / 边界（如实）

- 未在真实部署里安装 bubblewrap 或换内核；本轮结论只属于本机宿主姿态 + 在册 Landlock 腿。
- 未主张网络防护（本轮实测=无机制覆盖）。
- 未改上游 Core、未扩权限、未部署活宿主；未使用私有 API（`internals`/`runnerCommand` 本轮未用）。
- 披露腿（LEG C）仅测试世界内 per-session 开关，零 OS 强制口径，且用独立 `-legc` 目标路径。
- 本轮未覆盖 M-08 其余未测项：并发 Member 不同 one-shot、父取消/子调用排空 drain。

## 9. 证据文件

| 文件 | 内容 |
| --- | --- |
| `criteria.json` | 27 判据 + 8 INFO，含 observed 原文 |
| `host-identity.json` / `host-identity-post.json` | §7 身份行（pre/post，含 identityUnchanged） |
| `realm-truth-table.json` | REALM 面两腿真值表 + caliber/grantShape/ABI + 各自 census |
| `realm-world/<arm>/…` | 两腿各自 fixture 子树（`--realm-only` 复跑时重建；canonical 轮保留于 run-dir） |
| `policy-*.json`, `launcher-out/` | 受控腿实际 grant 与预启动器回执 |
| `legA-state.json` | LEG A 逐字答复、census、guard 行、`/proc` 采样、seam throw 普查 |
| `legB-state.json`, `legB-requested-arguments.json` | 加宽面结果与「实际所求」（mock 侧线记录） |
| `legC-state.json`, `legC-mode-switch.json` | 披露对照：开关写路径、逐字程序结果、census |
| `session-logs/*` | 两会话原始 zstd + 全量解码脱敏文本 + 事件形状清单（LEG B `approval/asked` 机制证据） |
| `red-first-inversion.json` | §4 判别性反转 |
| `runner-console.log`, `instance.log` | 控制台原文与宿主日志（脱敏） |
