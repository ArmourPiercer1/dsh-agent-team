# A5SF 五面 DEV-LIVE 侦察 · Face C — Shell / PTY / Managed Job 生命周期

RECON-SHELL

> 记录等级 **DEV-LIVE**（`eligible=false`，不进候选证据、不改 V@B）。
> 本文件只写**实测**；产品源码零改动（diff 仅本 evidence 目录）。
> 冻结候选 SHA `235e1af8bab954bbca4852d2f5a538de043b66e8`；宿主 baseline
> `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`；授权快照
> `as20261105r2`。同一命令跑两次（`--boots 2`），两 boot 的全部一致性行相同
> （[`agreement.txt`](./agreement.txt)）。

---

## 0. 三句话结论

1. **瞬态 `bash` 在这张受限终端面上被确认**：Member 的模型可见 `bash` 由 route-C
   native 模块重挂到 **confined terminals face**（不是 preset 继承的持久 PTY）。
   证据：8 次被准入的 spawn → 8 个 `kind:"confined-terminal"` 结果、7 个被观测到的
   `--confined-exec-stream` launcher（1 次短命令采样漏抓，见 E-1）；子进程自己的 `tty` = `not a tty`，其
   `/proc/<pid>/fd/0` = `socket:[…]`（0 个 `/dev/pts` fd）；`ptyHolders=0`；
   `baseBwrapWithMarkers=0`。
2. **持久 PTY / 受管 Job 在本 preset 上都是 `NOT_WIRED`（按设计，且已披露）**：
   43 个工具的表面里没有 `terminal_*` / persistent-shell / `dsh-terminal`；
   `job_kill`/`job_list`/`job_output` 三个名字在，但**没有任何生产者**能把命令交给
   job registry（`bash` 的封闭 schema 没有 `run_in_background`）。这不是"没测到"，
   是 preset 注释里写明的能力削减（`cordis.patch.yml:161-171`）。
3. **durable ARCHIVED 之后拿不到终端；但在"archive 请求发出 → durable commit"之间
   的 quiesce 窗口里还能拿到，入口就是该 Member 已挂载的 route-C `bash` 本身。**
   本次窗口实测 **8.56 s / 8.72 s**（两 boot）：Member B 在 archive 已发出、
   `collect` 已报 RUNNING 之后，第一条 8 s 命令正常跑完，并在其结果返回后 37 / 46 ms
   再发**第二条** `bash`，拿到一个全新的 confined terminal session（`exit 0`）；
   该调用发生在 Leader 观察到 archive 结果（即 durable SETTLE+ARCHIVE 提交完成）之前
   **约 290 / 427 ms**。durable ARCHIVED 之后：`team_follow_up` → `blocked /
   target-stale`；宿主 session API 直接 resume 该 child session → 被
   `TeamSessionActivationInterceptedError` 拒绝（`team-session-activation.ts:682`）；
   0 PTY、0 bash 结果。**没有任何"撤权后仍能拿到 PTY"的证据。**

> **不要**把历史 round 的 legacy-PTY 成功读成本轮 confined-PTY 成功：本轮
> `ptyHolders` 两 boot 均为 0，所有被观测到的 bash 子进程 fd0 都是 socket。
> 详见 §2.3 的六条独立反 PTY 判据。

---

## 1. 冻结输入与记录等级

| 项 | 值 | 来源 |
| --- | --- | --- |
| 候选（team）SHA | `235e1af8bab954bbca4852d2f5a538de043b66e8` | `runs/boot01/run-record.json#bindings.candidate.head` |
| 宿主 SHA / baseline | `639ed015397290b3745d163aafe02ffee4aa3f84` | 同上 `hostSha` / `baseline` |
| 授权快照 | `as20261105r2`，digest `sha256:d28bdf46…` | 同上 `bindings.authority` |
| 记录等级 | `DEV-LIVE`，`eligible=false` | 同上 `recordClass` |
| 授权 | `devlive-subprocess-1`，face `Subprocess`，world `u5a5sfsub1` | 同上 `bindings.grant` |
| preset | `preset-a5sf-governed-member`（= pinned `standard` 逐字减 `tool-pwsh`） | `driver/logs/…/composed-profile-*.patch.yml`、`runs/boot01/member-surface.json` |
| realm | `a5sfGovernedRealm: true`、blueprint schemaVersion 4、`memberIoCeilings` | `run-boot.mjs` 的 team.create profile override |
| world / 端口 | `tests/homes/u5u5a5sfsub1-20261107T16-45-04Z`（boot01）、`…16-48-20Z`（boot02）；3180 族 `3188`，mock `3496/3497` | `driver.log` |
| 机器并发 | 本 agent 自限 ≤2 boot；平台全局上限 6；`:3080` 未触碰 | `driver.log`、`host-tree-porcelain.txt` |
| 产品源码 | **0 改动**；宿主 pinned 树 porcelain 空 | `host-tree-porcelain.txt` = `empty` |

---

## 2. 七轴 × 工具表

### 2.1 表

三列 = 本 Face 的三个问题族：**瞬态 `bash`**、**持久终端工具**、**受管 Job**。
每格给"实测事实 → 判定"。判定词只用：`WIRED` / `NOT_WIRED` / `DENIED_AT_ADMISSION`
/ `DENIED_AT_OS` / `ABSENT`。

| 轴 | 瞬态 `bash`（route-C confined terminal） | 持久终端工具（`terminal_*` / persistent-shell / `dsh-terminal`） | 受管 Job（`job_*` + `run_in_background`） |
| --- | --- | --- | --- |
| **1. Surface**（模型可见定义） | `bash` 在 43 工具表面内；description 明说 "through this Member's confined terminal face … each call runs in a fresh confined shell"；schema 仅 `command`/`description`/`workdir`，`additionalProperties:false`；定义 digest `sha256:e6788cfd8d4f582430244733755f0ab83f041be628e4c13133a5ef5e033c44e6`（`member-surface.json` 规范化后计算）。**WIRED** | 表面中**不存在**任何 `terminal_*`、`terminal_send`、persistent-shell 名字；`tool-pwsh` 也被显式移除。**ABSENT** | `job_kill` / `job_list` / `job_output` 三个名字在表面；`bash` schema **没有** `run_in_background`。**名字在、生产面不在** |
| **2. Dispatch**（入口/挂载） | preset 的 `tool-bash` 行（`cordis.patch.yml:188-190`）先注册宿主工具，再由 realm row 的 `confinedTerminalSpecOf` 在隔离 scope 内**重挂**同名 native 模块（`a5sf-realm-row.mjs:1018,1077`）；PD-13 模块**取代** PD-12 的 subprocess shadow（`confined-terminal-tool.mjs:11-27`）。模型解析到的是这一份。**WIRED** | preset 上没有任何 persistent-shell 行；即使加，mount seam 也会以 `TERMINALS_LEGACY_PTY_REFUSED` 拒绝（`mount.ts:279,1462,1651`）——持久 PTY 会变成 `TERMINALS_DOUBLE_TERMINAL_REFUSED`（`cordis.patch.yml:168-171` 注释）。**NOT_WIRED（主动拒绝）** | `tool-jobs` 由宿主注册（`cordis.patch.yml:198-199`），但 preset 没有 `jobs-background-producer`/`jobs-family-bridge`（U7 lane 的模块，`jobs-background-producer.mjs:22` 只为 terminal 工具服务）；confined bash 不会把命令交给 registry。**NOT_WIRED（无生产者）** |
| **3. Provider**（真正执行面） | route-C 模块 → confined `terminals` face → confined `subprocess` face → `landlock-prelaunch`；两次 boot 各观测到 7 个 `--confined-exec-stream` launcher（预期 8，1 次采样漏抓）；`baseBwrapWithMarkers=0`；无 PTY。**WIRED 到受限执行面** | —（无调用） | `job_list` 真的被调用并回答 `(no background jobs)`；但**没有任何一次** spawn 走 job registry。**无 job 可被生产** |
| **4. Allow**（准入） | 21 条 guard fact：`spawn allow` 8、`spawn:write allow` 8、`shellRead allow` 4、`shellRead deny 1`；in-lane `cat` 返回 `A5SF_RECON_SHELL_IN_LANE_BYTES`（exit 0）。**WIRED** | — | `job_list` 调用被准入（宿主工具），返回空。**可用但空** |
| **5. Deny**（拒绝位置） | ① 字面 out-of-lane 读：`IO_READ_DENIED`，**0 字节**，发生在 spawn 之前（`shellRead deny` 1 条，seq 见 `guard-facts.json`）；② out-of-lane 写：**不是在准入层**——命令被准入并执行，内核返回 `Permission denied`，`spawn:writeDeny=0`，文件不存在；③ 动态读（`$P` / `$(…)`）：**不被词法归因**（无 shellRead fact），内核拒绝（`RC=1`、`Permission denied`、0 字节）。**读=准入层；写/动态=OS 层** | — | `run_in_background:true` 被**静默丢弃**：无 typed 拒绝、无 job id、无后台进程，命令以前台 confined child 跑完（`confined-pty-6`，exit 0）。**没有"拒绝"，只有"忽略"** |
| **6. Evidence**（证据字段） | 每次调用：`kind:"confined-terminal"`、`sessionId:"confined-pty-N"`、`exitCode`、`signal`、`timedOut/aborted/cancelled`、`stdout/stderr/scrollback`、`guard-facts`（`method/decision/decidedBy/sequence/observedAt/policyRevision`）、`policyRevision`（每 Member 不同）、进程事实。**证据充分（本报告 §4）** | — | `job_list` 的返回是**自由文本** `(no background jobs)`，不是结构化 `{jobs:[]}`；`run_in_background` 的丢弃**没有**任何 fact/字段记录（只能从"没有 job id"反推）。**证据偏弱** |
| **7. Lifecycle**（会话/撤权/残余） | 每次调用一个**新** confined child；命令结束即 close（`finally` kill）；无跨调用状态（`cd`/`export` 不保留）；每次 `sessionId` 自增。0 zombie、0 遗留 fd、0 PTY。**无驻留** | — | 0 job、0 后台进程、0 残余。**无驻留** |
| **撤权后** | durable ARCHIVED 之后：team 入口 `target-stale`；session 入口 `TeamSessionActivationInterceptedError`；无终端。**但 quiesce 窗口内可再开一个新 confined session（见 §4.2）** | — | 无 job 可撤 |

### 2.2 关键格的展开

- **Surface 轴不是"名字相同就等于同一工具"**：`bash` 这个名字在 preset 里先由
  `@deepseek-ai/dsh-tool-bash` 注册，随后被 realm 内的 route-C 模块替换；判据是
  description/schema 与 `confined-terminal` 结果形状，而不是名字。`member-surface.json`
  里 `bash.parameters.additionalProperties=false`，三参数，与宿主标准 bash 的
  （`run_in_background`/`timeoutMs`/`sandbox_permissions`）不同。
- **Dispatch 轴的"取代"是排他的**：`confinedTerminalSpecOf` 在看到已有的
  `confined-bash-tool.mjs` 或任何 `expectedTools:['bash']` 声明时**不**追加
  （`a5sf-realm-row.mjs:1018-1035`），所以同一 scope 内只有一个 `bash` owner。
- **Provider 轴测到的是 launcher，不是 base bwrap**：`baseBwrapWithMarkers=0`
  表示没有任何 base `bwrap` 携带 fixture 路径；执行由 `landlock-prelaunch` 完成。
  这与 legacy PTY 路径（`/dev/pts/N` + 宿主 terminal service）是两条不同的链。
- **Deny 轴的"位置"是本轮最重要的区分**：读的拒绝有准入事实（`IO_READ_DENIED`，
  零字节、零 spawn）；写和动态读没有准入事实，是 OS profile 的 `Permission denied`。
  把三者混成一句"都被拒了"会掩盖"写轴无准入判定"这一事实。
- **Job 轴不是"拒绝"而是"没有生产者"**：`job_list` 在、返回空；`run_in_background`
  被静默忽略。按验收语义这是 `NOT_WIRED`，不是 `DENIED`。

### 2.3 反 PTY 六条独立判据（防止把 legacy PTY 当 confined PTY）

| # | 判据 | 本轮实测 |
| --- | --- | --- |
| 1 | 子进程自己的 `tty` | A/B/C 三次 `A5SF_RC_TTY=not a tty`（`tty` 在 lane 内可执行） |
| 2 | 子进程 `/proc/<pid>/fd/0` | 4 条 shell-child 事实全部 `socket:[…]`；**0 条** `/dev/pts/*` |
| 3 | 全机 PTY holder | `ptyHolders=0`（两 boot，600+ 次 proc batch） |
| 4 | mountinfo 里的 devpts | 命名空间**有** `/dev/pts` mount，但没有任何被观测进程的 fd 指向它——**"有 devpts"不等于"用了 PTY"** |
| 5 | 代码 | `stdio.stdin:'ignore'`，stdout/stderr 是 pipe（`terminal.ts:535-541`）；模块头明说 "it is not a PTY"（`confined-terminal-tool.mjs:22-25`） |
| 6 | 会话语义 | 每次调用新 child，`cd`/`export` 不跨调用（无持久 shell 状态） |

> `sessionId` 字段叫 `confined-pty-N`（`terminal.ts:489` 的自增 label），**这是名字，
> 不是 PTY**。任何"看到 confined-pty 就认为有 PTY"的读法都是错的。

---

## 3. 探针序列

### 3.1 Leader 链（一次 boot，7 次 team 调用）

| # | 调用 | 结果 | 耗时 |
| --- | --- | --- | --- |
| 1 | `team_delegate` A（sync） | `member-activated`，`workSettled:true`，A 返回 A 套件结果 | ~6.2 s |
| 2 | `team_archive_member` A（SETTLED） | `executed`，`SETTLED→ARCHIVED`，sequence 7 | ~0.1 s |
| 3 | `team_follow_up` A | `blocked`，`reason:"target-stale"` | ~0.01 s |
| 4 | `team_delegate` B（**async**） | `member-activated`，立即返回（B 仍在跑） | ~0.18 s |
| 5 | `team_collect` B | `status:"running"` | ~0.02 s |
| 6 | `team_archive_member` B（**RUNNING**） | `executed`，`from:"RUNNING"`，`to:"ARCHIVED"`，sequence 11 | **~8.5 s** |
| 7 | `team_delegate` C（sync，新 Member） | `member-activated`，C 返回结果 | ~0.64 s |

原始：`runs/boot01/leader-events.json`、`revocation.json`、`leader-delegate.json`。

### 3.2 四个臂

| 臂 | Member | 目的 | 关键调用 |
| --- | --- | --- | --- |
| A | `inst-088uk8104uxo`（`a5sf1:a297948e…`） | 允许/字面拒读/拒写/动态读/后台尝试/job_list | 7 次 |
| B | `inst-0lui9he0atse`（`a5sf1:725d2680…`） | 中途 archive（8 s 长命令） | 2 次（第二条即窗口内终端） |
| C | `inst-14284nz189hs`（`a5sf1:c6579810…`） | 撤权后的新 Member 对照 | 1 次 |
| X | A 的 child session | durable ARCHIVED 后直接打宿主 session 入口 | 1 次 prompt（被拒） |

> 三个 Member 的 `policyRevision` 各不相同（内容寻址的编译策略），说明 lane 是
> per-Member 编译的，不是一份全局策略。`activityVersion`：A=4、B=4、C=3。

---

## 4. 原始证据

### 4.1 Member A（允许 / 拒绝 / 动态 / 写 / 后台）

**A_ALLOW**（`call-rc-a-allow`）：

```json
{"kind":"confined-terminal","sessionId":"confined-pty-1","exitCode":0,
 "stdout":"A5SF_RC_TTY=not a tty\nA5SF_RC_PS=S\nA5SF_RC_DEVNULL_RC=1\nA5SF_RECON_SHELL_IN_LANE_BYTES\n",
 "stderr":"/bin/bash: line 1: /dev/null: Permission denied\n"}
```

命令（逐字）：`printf 'A5SF_RC_TTY=%s\n' "$(tty 2>&1)"; printf 'A5SF_RC_PS=%s\n' "$(ps -o stat= -p $$)"; printf x >/dev/null; printf 'A5SF_RC_DEVNULL_RC=%s\n' "$?"; cat '<world>/workspace/in-lane.txt'; sleep 1.2`

- `tty` = `not a tty`；`ps` 子进程状态 = `S`（可中断睡眠，**不是 Z**）。
- **`/dev/null` 写入也被拒**（`RC=1`，`Permission denied`）：受限 profile 不因
  "设备节点"放行任何 lane 外写。实用后果：`2>/dev/null` 这类常见 shell 惯用法在
  这条 lane 里会失败——这是能力注记，不是缺陷（见 E-4）。
- in-lane 字节返回，exit 0。

**A_DENY_READ**（`call-rc-a-deny-read`）：`isError=true`，文本

```
Error: IO_READ_DENIED: authored locator '<world>/out-of-lane/secret-out-of-lane.txt'
is outside every allow subtree of the lane
```

无 spawn、无字节。guard fact：`method:"shellRead", decision:"deny",
decidedBy:"IO_READ_DENIED"`。

**A_DENY_WRITE**（`call-rc-a-deny-write`）：

```json
{"kind":"confined-terminal","sessionId":"confined-pty-3","exitCode":0,
 "stdout":"A5SF_RC_WRITE_RC=1\n",
 "stderr":"/bin/bash: line 1: <world>/out-of-lane/rc-write.txt: Permission denied\n"}
```

命令**被准入并执行**；OS 拒绝；文件不存在；`spawn:writeDeny=0`。

**A_DYN_VAR / A_DYN_SUBST**：

```json
{"kind":"confined-terminal","sessionId":"confined-pty-4","exitCode":0,
 "stdout":"A5SF_RC_DYN_VAR_RC=1\n",
 "stderr":"cat: <world>/out-of-lane/secret-out-of-lane.txt: Permission denied\n"}
```

- 两条都**被准入**（无 `shellRead` fact 指向 secret；唯一的 secret-naming deny 是
  前面故意做的字面读）。
- 内核拒绝；**0 字节**；exit 0 只是因为末尾 `printf RC=$?` 覆盖了 overall status，
  命令自己的 RC=1。

**A_BG**（`call-rc-a-bg`，带 `run_in_background:true`）：

```json
{"kind":"confined-terminal","sessionId":"confined-pty-6","exitCode":0,
 "stdout":"A5SF_RC_BG_MARK\n"}
```

进程证据（`shellChildCommandSightings`）：`pid 216 ppid 215`，
`cmdline = /bin/bash -c sleep 0.1; printf 'A5SF_RC_BG_MARK\n'`，`fd0=socket:[…]`。
**没有 job id、没有后台进程、没有 typed 参数拒绝**：extra key 被静默丢弃。

**A_JOBLIST**（`call-rc-a-joblist`）：`(no background jobs)`（自由文本，非 JSON）。

### 4.2 Member B：中途 archive 与 ordering

`call-rc-b-long`（8 s 长命令，内含 `sleep 8`）：

```json
{"kind":"confined-terminal","sessionId":"confined-pty-1","exitCode":0,
 "stdout":"A5SF_RC_B_START=1794070044\nA5SF_RC_B_TTY=not a tty\nA5SF_RECON_SHELL_IN_LANE_BYTES\n"}
```

`call-rc-b-second`（archive 已发出之后）：

```json
{"kind":"confined-terminal","sessionId":"confined-pty-2","exitCode":0,
 "stdout":"A5SF_RECON_SHELL_IN_LANE_BYTES\n"}
```

**ordering 证据**（`runs/boot01/ordering.json`，boot02 同形）：

```json
{"archiveBIssuedAt": 1794070044454,
 "archiveBResultObservedAt": 1794070053013,
 "archiveBCommitWindowMs": 8559,
 "bFirstCallAt": 1794070044432,
 "bFirstResultAt": 1794070052686,
 "bSecondCallAt": 1794070052723,
 "bSecondResultAt": 1794070052771,
 "bSecondAboutArchive": "INSIDE_COMMIT_WINDOW",
 "bSecondAfterArchiveCommit": false,
 "bSecondBeforeArchiveIssue": false}
```

读法（方法见 §7）：Leader 的 `archive-b` 请求在 `044454` 发出，Leader 下一次
看到 archive 结果在 `053013`（**durable commit 的上界**）。B 的第一条命令
`044432` 开始、`052686` 结束；第二条在 `052723`（**结果返回后 37 ms**，即
archive 发出后 **8.27 s**）开始，`052771` 结束——**落在 commit 窗口内，且在
commit 之前**。两 boot 的窗口分别 **8559 ms / 8716 ms**，判定均为
`INSIDE_COMMIT_WINDOW`；第二条距离 commit 上界分别 **290 ms / 427 ms**。

机制（代码，不是猜测）：
- `team_archive_member` 的 quiesce 顺序是 close-admission → **interrupt** →
  drain-descendants → wait-quiescence → release-residency（`quiesce.ts:1-20`）；
- 描述承诺 "its current work is interrupted"（`tools.ts:1199`）；
- 实测：正在跑的 turn **没有被中断**，它跑完了第一条命令，并且**又走了一步**；
  archive 的 8.4 s 花在等这个 turn 结束上；
- RUNNING→ARCHIVED 在服务层是 **SETTLE 然后 ARCHIVE 两次 durable write**
  （`archive.ts:1-30,127-145`）；surface 上只看到 net effect
  `from:"RUNNING", to:"ARCHIVED"`（sequence 11），两次 commit 不可区分（见 E-2）。

结论：**撤权不是原子的"立刻停"**；在 durable commit 之前，已经在跑的 turn 仍然
可以创建新的 confined terminal session。窗口长度 = 该 turn 剩余时长。若 turn 长时间
不结束，archive 会一直等（本轮无超时观测；see §8）。

### 4.3 Member C：新 Member 对照

`call-rc-c-one`：`confined-pty-1`，`A5SF_RC_C_TTY=not a tty`，in-lane 字节，exit 0。
说明 A 的 archive 只作用于 A 这个 instance；同一 root 下新建的 Member 仍能拿到
受限终端（generation-scoped，不是 team-wide 失效）。

### 4.4 Member X：durable ARCHIVED 后的 session 入口

对 A 的 child session（`session-team-child-3628753…`）直接
`POST /api/session/prompt`（宿主 session API，不是 team 工具）：

```json
{"status":200,
 "body":{"type":"server-response","result":{"ok":false,"error":{
   "code":"gateway/internal",
   "message":"resume failed for session \"session-team-child-3628753…\": TeamSessionActivationInterceptedError: dsh-agent-team: intercepted foreign Agent activation for Team-managed session \"session-team-child-3628753…\""}}}}
```

- HTTP 200 **不等于** turn 跑了：body 是 RPC error；mock 侧 `answered=false`，
  没有 model request、没有 `bash` 结果。
- 拒绝点：`TeamSessionActivationInterceptedError`（`team-session-activation.ts:682`）
  ——session 仍被分类为 Team-managed，普通宿主激活被 fence 拦下。
- team 入口：`team_follow_up` → `blocked / target-stale`（`revocation.json`）。

**所以 durable ARCHIVED 之后"哪一个入口都拿不到终端"**：team 入口 stale，宿主
session 入口被 activation fence 拒。唯一能拿到的是 §4.2 的 quiesce 窗口。

### 4.5 guard facts（21 条，两 boot 完全一致）

| method / decision | 次数 | 说明 |
| --- | --- | --- |
| `spawn / allow / ALLOW` | 8 | 5×A（allow、deny-write、dyn-var、dyn-subst、bg）+ 2×B + 1×C |
| `spawn:write / allow / ALLOW` | 8 | 同上，cwd 的声明写根 |
| `shellRead / allow / ALLOW` | 4 | A_ALLOW、B_LONG、B_SECOND、C_ONE 的 in-lane 读 |
| `shellRead / deny / IO_READ_DENIED` | 1 | A_DENY_READ 的字面 out-of-lane 读 |
| `spawn:write / deny` | 0 | **写轴没有准入拒绝**（OS 层拒） |

`guard-facts.json` 中每条都带 `realm:"member"`、`memberIdentity`、
`policyRevision`、`sequence`、`observedAt`。示例（A 的 spawn allow）：

```json
{"method":"spawn","locator":"<world>/workspace","decision":"allow",
 "decidedBy":"ALLOW","sequence":1,"observedAt":"2026-11-07T16:17:16.238Z",
 "policyRevision":"a5sf1:a297948e96e0a1f894c05ca475cc4c44","memberIdentity":"inst-088uk8104uxo"}
```

### 4.6 进程证据

两 boot：`confinedTurnLaunchers=7`（boot01/boot02），`preflightLaunchers=3/4`（attach
探针，环境性），`ptyHolders=0`，`baseBwrapWithMarkers=0`，`otherBwrapPids=1`，
`procBatches=315/319`。

`shellChildCommandSightings`（boot01，全部 4 条）：

| marker | pid | ppid | state | fd0 | cmdline（节选） |
| --- | --- | --- | --- | --- | --- |
| `shell-child` | 201 | 200 | S | `socket:[72083039]` | `/bin/bash -c printf 'A5SF_RC_TTY=…'; printf 'A5SF_RC_PS=…'; printf x >/dev/null; … cat '<world>/workspace/in-lane.txt'` |
| `shell-child` | 202 | 201 | S | `socket:[72083039]` | 同上（A_ALLOW 的 `$(…)` 命令替换子 shell；继承同一 socketpair） |
| `shell-child` | 216 | 215 | S | `socket:[72086684]` | `/bin/bash -c sleep 0.1; printf 'A5SF_RC_BG_MARK\n'` |
| `shell-child` | 265 | 264 | S | `socket:[72094189]` | `/bin/bash -c printf 'A5SF_RC_B_START=…'; sleep 8; … cat '<world>/workspace/in-lane.txt'` |

- ppid 是 `landlock-prelaunch` 的 launcher pid；launcher 的 argv 只有
  `--confined-exec-stream <plan>`，**命令正文在 bash 子进程的 argv 里**（见 D-1）。
- `ptyHolders` 的过滤条件是"fd 指向 `/dev/pts` 且 cmdline 含本 world 路径"，两 boot
  都是 0。
- mountinfo（shell child）：命名空间有 `/dev/pts` mount，但子进程 fd0 是 socket。
  再次强调：**mount 存在 ≠ 使用**。

### 4.7 双跑一致性

[`agreement.txt`](./agreement.txt)：17 行全部相同（`agreeing=true differing=[]`），
含 8 个 verdict、`shellReadAllow=4`、`shellReadDeny=1`、`ptyHolders=0`、
`baseBwrapWithMarkers=0`、`bashHasNoRunInBackground=true`、`jobListEmpty=true`、
`newGenerationTerminal=true`、`transcriptSourceCount=7`。

> 未进 agreement 的行（环境性）：`confinedTurnLaunchers`（7 vs 7 本轮相同，但历史
> dev boot 出现过 6/7/8）、`preflightLaunchers`（3 vs 4）、`shellChildPids`
> （4 vs 3，采样率问题，见 E-1）、耗时。

---

## 5. 六类清单

### 5.1 工具身份清单

| # | 身份 | 事实 |
| --- | --- | --- |
| 1 | 瞬态 `bash` | route-C native 模块 `a5sf-confined-terminal-bash`（`confined-terminal-tool.mjs:44`）；schema 3 参数；digest `sha256:e6788cfd…` |
| 2 | 持久终端工具 | 表面**无**；preset 无行；mount seam 主动拒绝 legacy PTY（`mount.ts:1462`） |
| 3 | 受管 Job 入口 | `job_kill`/`job_list`/`job_output` 在；无生产者；`bash` 无 `run_in_background` |

### 5.2 入口/挂载清单

| # | 入口 | 事实 |
| --- | --- | --- |
| 1 | preset `tool-bash` 行 | `cordis.patch.yml:188-190`，先注册宿主工具 |
| 2 | realm row 的 terminal shadow | `a5sf-realm-row.mjs:1018,1077`，在隔离 scope 内**取代** `bash` |
| 3 | 宿主 `tool-jobs` registry | `cordis.patch.yml:198-199`；registry 在，producer 不在 |
| 4 | 宿主 session API | `/api/session/prompt` 对 Team-managed session 被 activation fence 拒（`team-session-activation.ts:682`） |

### 5.3 执行面清单

| # | 面 | 事实 |
| --- | --- | --- |
| 1 | confined terminals face | `ctx.terminals`，每次 spawn 一个 confined session |
| 2 | confined subprocess face | `argv:[program,'-c',text]`、`stdio.stdin:'ignore'`、`shell:{reads:[cwd],writes:[cwd]}`（`terminal.ts:530-541`） |
| 3 | landlock prelaunch | 7 个 `--confined-exec-stream` launcher；`baseBwrapWithMarkers=0` |
| 4 | legacy PTY 面 | **未出现**：`ptyHolders=0`、无 `/dev/pts` fd；若强挂会被 `TERMINALS_LEGACY_PTY_REFUSED` |

### 5.4 准入判定清单

| # | 判定 | 次数 | 位置 |
| --- | --- | --- | --- |
| 1 | `spawn` allow | 8 | 准入层 |
| 2 | `spawn:write` allow | 8 | 准入层（声明的 cwd 写根） |
| 3 | `shellRead` allow | 4 | 准入层（词法 in-lane） |
| 4 | `shellRead` deny | 1 | 准入层（字面 out-of-lane，零 spawn） |
| 5 | `spawn:write` deny | 0 | **写轴无准入拒绝** |
| 6 | 动态读 | 0 fact | **不可归因**，OS 层拒 |

### 5.5 证据字段清单

每次 `confined-terminal` 结果都有：`kind/sessionId/exitCode/signal/timedOut/aborted/cancelled/stdout/stderr/scrollback`。
每条 guard fact 都有：`schema/realm/memberIdentity/policyRevision/method/locator/decision/decidedBy/sequence/observedAt`。
进程证据有：pid/ppid/state/fds/nspid/mntNs/mountinfo/cmdline。
**缺**：Member 的 generation（surface 未暴露，只能用 policyRevision + activityVersion
+ durable sequence 代替）；archive 的两次 commit（只暴露 net effect）；`run_in_background`
被丢弃的 fact（不存在）。

### 5.6 残余清单

| # | 残余 | 值 |
| --- | --- | --- |
| 1 | PTY 持有进程 | 0（两 boot） |
| 2 | zombie shell child | 0（`ps` 状态 S，非 Z） |
| 3 | 遗留 launcher/bash fd | 0（命令结束即 close，`finally` kill） |
| 4 | 后台 job | 0（`job_list` 空） |
| 5 | durable ARCHIVED 后仍可用的终端入口 | 0（team 入口 stale；session 入口被 fence 拒） |
| 6 | quiesce 窗口内新建终端的次数 | 1（B 的 second call，两 boot 复现） |

---

## 6. 问题分类 A / B / C / D / E（带 file:line）

> 定义（本报告显式给出，便于 parent 对齐）：
> **A** = 治理/越权空洞（必须先修）；**B** = 契约/语义偏差（实现与文档/承诺不一致）；
> **C** = 能力缺口/未接线（可能是设计选择，但必须进矩阵/披露）；
> **D** = 证据/文档漂移（文档或字段名与实测矛盾）；**E** = 仪器/可观测性缺陷
> （削弱证据本身，不是产品行为）。

### A — 治理/越权空洞

**无。** 本轮没有发现读越权、写越权、PTY 逃逸、或撤权后通过任何入口拿到终端。
限界声明见 §8。

### B — 契约/语义偏差

**B-1（中）archive 的 "interrupt" 不阻止 turn 再走一步，窗口 = turn 剩余时长。**
描述承诺 "quiesces the member first (its current work is interrupted …)"
（`packages/tools/src/tools.ts:1199`），quiesce 第二步是
"interrupt — cancel the member's current activity"（`packages/runtime/lifecycle/quiesce.ts:1-20`）；
实测（§4.2）第一条命令正常 exit 0，第二条 `bash` 在 archive 发出后 8.27 s 拿到新
confined session，durable commit 还要再等约 0.29–0.43 s。**不是越权**（新命令仍受
lane 约束），但"撤权即时性"的语义与承诺不符，且窗口随 turn 时长增长。
相关：`packages/runtime/lifecycle/archive.ts:127-145`（SETTLE+ARCHIVE 两次 commit
在 quiesce 之后）。

**B-2（低）`run_in_background` 被静默丢弃，而不是 typed 拒绝。**
`bash` 的 schema `additionalProperties:false`（`member-surface.json`），但
`call-rc-a-bg` 带 `run_in_background:true` 仍以前台执行、无拒绝、无 job id。
模型会以为后台 job 已启动。schema 的封闭性**没有**在工具调用路径上被执行
（宿主侧行为，本轮未定位到具体校验点；不作过度归因）。

### C — 能力缺口/未接线

**C-1（已披露）持久终端工具 `NOT_WIRED`。**
preset 无 persistent-shell/`dsh-terminal` 行（`cordis.patch.yml:161-171` 注释），
且 mount seam 会主动以 `TERMINALS_LEGACY_PTY_REFUSED` 拒绝
（`packages/runtime/team-services/src/mount.ts:279,1462,1651`）。
后果：无交互式 stdin、无跨调用状态、无法 `cd` 后继续。这是设计选择，需在
TOOL-ACCEPTANCE-MATRIX 的 shell 行标注"capability cost"，不是缺陷。

**C-2（已披露）受管 Job `NOT_WIRED`。**
`tool-jobs` 在（`cordis.patch.yml:198-199`），但没有 producer 把 confined bash 的
命令交给 registry；U7 的 `jobs-background-producer.mjs`（`packages/runtime/src/plugin/live/jobs-background-producer.mjs:22`）
只服务 terminal 工具，不在本 preset。宿主 `tool-bash` 的 `run_in_background`
是条件暴露（`tests/deepseek-harness-test-use/packages/shell/tool-bash/src/index.ts:67,271`），
被 confined 模块取代后不存在。**jobs 三工具是"空壳可用"**：`job_list` 能答，
但永远不会有 job。

**C-3（低）`job_list` 返回自由文本 `(no background jobs)`，不是结构化空列表。**
`package` 侧是宿主工具，不在本仓可改范围；对"可编程验收"不友好（解析要靠字符串）。

### D — 证据/文档漂移

**D-1（高，必须更正）旧结论"confined terminal 把命令写入 PTY，argv 里看不到 payload"是错的。**
`dev/agent-workflow/evidence/a5sf-live-member/README.md:224` 写：
"the confined terminal writes the command text to a PTY, so the command never appears
in any process's `argv` (a property of the face, measured)"，并据此把
`payloadInLaneSightings=0` 当作"不是 witness"。
实测与代码都相反：
- `terminal.ts:535` `argv: [program, '-c', text]`——命令正文**就在** bash 子进程
  argv 里；`stdio.stdin:'ignore'`（`terminal.ts:538`）——没有 stdin/PTY 可"写入"；
- 本轮 `payloadInLaneSightings=1`（boot02）/`2`（boot01），shell child 的
  `cmdline` 明确含 `<world>/workspace/in-lane.txt`（§4.6）。
  旧 round 的 0 更可能是**采样没抓到**（见 E-1），而不是"argv 里没有"。
  **更正**：`payloadInLaneSightings` 应当作 witness 使用（非零即证明 argv 可见），
  不能再用"写入 PTY"解释 0。

**D-2（中）`sessionId:"confined-pty-N"` 的命名暗示 PTY。**
`terminal.ts:489` 的自增 label 叫 `confined-pty-`，但本轮 0 PTY。任何把该字段当
PTY 证据的读法都会重演历史 false pass。建议后续改名为 `confined-term-N`（不改也行，
但文档必须点名这是 label）。

**D-3（低）旧 README 的"命令写入 PTY"与模块自述冲突。**
`confined-terminal-tool.mjs:22-25` 明说 "it is not a PTY … there is no interactive
stdin"；旧证据 README 却按 PTY 描述。以代码与本轮实测为准。

### E — 仪器/可观测性缺陷

**E-1（中）proc 采样漏抓了多数的 bash 子进程。**
`shellChildPids` 两 boot 为 4 / 3，而 `confinedTurnLaunchers=7`；A_ALLOW 的 1.2 s
子进程在 boot02 没被抓到。原因是扫描循环要读 mountinfo，有效间隔大于命令时长
（315 次 batch / ~75 s ≈ 240 ms，早期更慢）。**影响**：不能把"没抓到"当"没发生"；
本报告只用抓到的样本作正证据，负结论（0 PTY）由 `ptyHolders` 全量 fd 扫描支撑。

**E-2（低）archive 的两次 durable commit 在 surface 上不可区分。**
服务层 RUNNING 时 commit SETTLE 再 commit ARCHIVE（`archive.ts:127-145`），但
`team_archive_member` 结果只给 net effect `from:"RUNNING"`（sequence 11）。
**影响**：不能用"from RUNNING"反推"只有一次写"。

**E-3（低）Member 的 generation 未在 `/__p6t6/state` 暴露。**
state row 只有 `lifecycle/activityVersion`；本报告用 `policyRevision`（内容寻址）
+ durable sequence 代替"generation"。不影响结论，但验收字段不完整。

**E-4（低，能力注记）`/dev/null` 在 lane 内不可写。**
`printf x >/dev/null` → `RC=1`、`Permission denied`（§4.1）。常见 shell 惯用法
（`2>/dev/null`）会因此失败。是否属于预期 profile 需产品确认；本轮按"lane 外写
一律拒"记录，不判缺陷。

**E-5（已修，dev 迭代）`/dev/null` 重定向曾让 `ps` 探针返回空。**
第一版 A_ALLOW 用 `ps … 2>/dev/null`，因 E-4 直接失败，`A5SF_RC_PS=` 为空，
judge 把"空"误判成 zombie。最终版去掉重定向，`ps` 返回 `S`。记此以防后人复踩。

---

## 7. 复现

```bash
# 在 worktree 内（pinned host 树已备好，node_modules 指向主 checkout）
node dev/agent-workflow/evidence/a5sf-recon-shell/run-boot.mjs          # 两 boot + agreement
node dev/agent-workflow/evidence/a5sf-recon-shell/run-boot.mjs --boots 1 # 单 boot 开发迭代
```

- 每次 boot：`tests/homes/u5u5a5sfsub1-<ts>/`，3180 族端口，`mock` 3496/3497；
  结束即 teardown（home 删除，证据已复制到 `runs/bootNN/`）。
- 证据：`runs/boot0N/`（transcript、session、guard facts、counters、
  proc-observations、ordering、revoked-entry-probe、members、revocation、
  run-record、summary、teardown）、`agreement.{json,txt}`、`driver.log`、
  `run-ledger.jsonl`、`host-tree-porcelain.txt`。
- **ordering 方法**：mock provider 与 driver 同进程，`decideWithTimeline` 给每个
  model request 盖 `Date.now()`；archive 的 commit 上界 = Leader 下一次"看到
  archive 结果"的请求时间；B 的调用时刻取自 B session 事件的 `time` 字段。
  三者同源时钟（同机），不跨进程推断。

---

## 8. 边界与未测

- **未测**：runaway turn 是否会让 archive 无限等待（本轮 turn 8 s 内结束，无超时
  观测）；`team_restore` 之后终端是否恢复；并发多 Member 同时 archive；`tool-pwsh`
  移除后的第二 shell 路径（已由 preset 移除，未单独探针）；真实模型（本轮是
  scripted mock，工具调用路径真实，模型行为不代表生产模型）。
- **不声称**：没有测 OS profile 的全部写面（只测了 out-of-lane 文件 + `/dev/null`）；
  没有测 Landlock 规则的完整集合；没有测 `job_*` 在 U7 lane 的行为（本 preset 无 producer）。
- **记录等级**：DEV-LIVE，`eligible=false`；boot 证据不是 PR 合并证据，parent 需重测。
- **V@B**：未改矩阵/登记册/STATUS；本轮只新增本 evidence 目录。

---

## 9. 文件清单

| 路径 | 内容 |
| --- | --- |
| `run-boot.mjs` | 本侦察 driver（三 Member + archive 窗口 + 撤权 session 探针 + 八类 judge + 双跑 agreement） |
| `runs/boot01/`、`runs/boot02/` | 两 boot 的原始证据（transcript/session/guard/counters/proc/ordering/probe/record） |
| `agreement.txt` / `agreement.json` | 双跑一致性（17 行全同） |
| `driver.log`、`driver/logs/…` | boot 日志、composed profile |
| `run-ledger.jsonl`、`host-tree-porcelain.txt` | DEV-LIVE ledger、宿主树 porcelain（empty） |
| `dev/agent-workflow/evidence/a5sf-live-member/README.md:224` | 被本报告 D-1 更正的旧结论（不改动原文） |
