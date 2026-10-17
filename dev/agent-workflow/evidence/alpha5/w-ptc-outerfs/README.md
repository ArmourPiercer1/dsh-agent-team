# W-PTC-OUTERFS — 外层 fs 半臂 per-call 治理装配尝试（RED-first 真跑）

writer = W-PTC-OUTERFS（one-off worktree `.worktrees/a5-ptc-outerfs`，branch `alpha5-ptc-outerfs`，
base = `alpha5-bind-diag@9c72769f`〔含 SEAM-RECHECK-OUTER.md 施工图〕）。
liveness 首报（模型行原文）：`You are a coding agent powered by the qwen3.8-flash-next model.`
宿主 = pinned `tests/deepseek-harness-test-use` @ `639ed01539`（0.2.0-rc.2，复用 `dsh-020rc2-upgrade`
已建树，只读，porcelain 前后=0）；端口 **3184**（自证空闲，跑毕释放）；世界 `tests/homes/a5ptc4-<mode>-<stamp>/`
（+ `-forb` 禁区目录），跑毕删除。

## 判定（三分之①）：**外层 fs per-call 治理装配成功**

- **fs 半臂可装配可证**：草案 §2 的「更贴原计划那条」= host 原生 per-callId escalation 链
  （run_code 的 `sandbox_permissions`+`justification` → 宿主自家 `approveEscalation` → `ApprovalService`
  → `ctx.waterfall('approval/request')` per-callId 面）+ Team resolver 充当批准方，**已装配进真实结构并真跑**。
  策略来自 resolver 的 per-call Grant 面（按 ask 时刻的 per-call token/理由裁决），全程 **零 setSandboxMode /
  零 setApprovalPolicy / 零整程序 mode 改动**（会话 mode 六腿恒 `workspace-write`，公开读亲验）。
  → **M-08 行 fs 半臂转态提案（给 pr8 矩阵 + 协调者台账；本件未动矩阵行，ROWFIX lane 正在改 M-08，防撞）**：
  note「per-call 策略注入未证」的 **fs 半臂已证**——receipt 可入账
  `per_call_policy_denials.os_level_observed = true`（EACCES 级 OS 真拒 + 每跑 `sandbox{mode,denied,enforcement}` 回读），
  `execution.outer_real_process` 复证（pid/ppid 真实分离进程）。**net 半臂维持局部阻塞**（F6 词表不存在，本件
  未做且禁做一切网络姿态改动；出路仍=上游词表扩展登记，非本仓待办）。
- 环境 vs 缝：任务③ OS 级负控 **非 ENV_BLOCK**——Landlock 后端在场（本环境真跑），见 §OS。

## 三腿（+两条控制腿）真跑实况（权威轮 `runs/a5ptc4-green-2026-10-17T07-48-43Z/`，15/15）

| 腿 | 内容 | 实况 | 证据 |
| --- | --- | --- | --- |
| LEG1 | 正常写允许域成功 | 外层真实进程（pid=112, ppid=47≠pid≠host pid）`ws/leg1-ok.txt` 字节落盘；内层 witness echo 走同一管线；结果文本带 `File sandbox enforcement is partial`（每跑回读） | `criteria.json` LEG1 + `run-leg1.json` |
| LEG2 | 写禁区 = typed 拒于 open 前 | 程序体真跑（echo canary + ws 控制文件在场）；禁区 create/append 双双 `EACCES`（open 抛出，未成行）；禁区目录仍只有 `secret.txt`、密钥 sha 不变 = **零字节落盘**；`selectedRunner=landlock` | LEG2 + `sandbox-census.json` + `run-leg2.json` |
| LEG3 | 拒绝审批腿 = fail-closed 原文 | resolver 答 `rejected` → 结果原文逐字 `the user rejected escalating this program to "danger-full-access"`；程序未 spawn（无 body canary、零新文件）；per-callId 台账行在册 | LEG3 + `approvals-ledger.json` |
| LEG3b | resolver 不回 = fail-closed 原文 | 以宿主自述规范化姿态表达（“a missing or throwing answerer yields 'unavailable' (fail closed)”）→ 原文 `sandbox escalation to "danger-full-access" requires approval, but no approval channel is available`；同零副作用 | LEG3B + 台账 |
| LEG4 | （正控）allowed-once 单次加宽真生效 | 同一加宽面 + resolver 答 `allowed-once` → 该一次调用禁区目标真写入（body canary 在文件里） | LEG4 + `p4` 目标回读 |
| LEG5 | （负控）加宽不粘着 | 无 grant 的下一个同款调用再次 EACCES、零落盘；会话 mode 前后 `workspace-write`；台账 3 行 3 个不同 callId | LEG5 + `approvals-ledger-final.json` |

RED 轮（同一 kit、装配件关：`--red`）：`runs/a5ptc4-red-*/criteria.json` **10/10**——未部署后端时默认姿态
= 逐字 `sandbox-unavailable` **整程序 fail-closed 于 spawn 前**（无 per-API 腿可言）、无 resolver 时
escalation ask 挂起且零台账行 ⇒ 判据可判别，GREEN 的增益确由本装配件承载。

## OS 级负控腿（任务③：W4 同款 Landlock 后端家族，非 ENV_BLOCK）

- `P-OS-PREFLIGHT`（boot 前直跑）：同一 launcher `landlock-run --probe` exit=0（`landlock: partially
  enforced (older ABI)`）；以宿主自家 grant 形状（`--ro /` + `--rw /dev/null --rw /tmp --rw <ws>`）真跑：
  ws 写成功、禁区 create/append 双 `EACCES`、零落盘、密钥不变。**launcher 身份** =
  `sha256 a752bc72f111fcc5…`（用户 2026-10-01 装的官方 prebuilt `@deepseek-ai/node-addon-system-linux-x64`
  二进制，位于主树 `tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/`；与 pin 树
  `native/system`(0.1.2) 同一 CLI 契约家族）。与 W4 的关系 = **同款后端（Landlock launcher）**；W4 的
  lane-C `landlock-prelauncher.py` 是另一 CLI 契约，本件按任务口径用宿主链自家契约的同类后端。
- 管线内 OS 腿：LEG2 的 EACCES 即真域内程序体的 OS 拒绝（`enforcement=partial` 如实入账——**ABI 子集，
  不宣称 full ENFORCE**；写拒绝方向在本 ABI 实测有效）。

## 装配件账（全部公开面；零 Core 改、零矩阵改）

1. **profile-patch 行**（公开语法，`$DSH_HOME/profiles/web/cordis.patch.yml`，file-URL 行）。
2. **OS 后端部署** = `ctx.sandbox.internals.landlockLauncher = <launcher>`：宿主 provider 自家公开
   test-hook 属性（源码注：“Test hook (mirrors the bash execers' internals)”），首次 confine 前写入；
   之后探针、grant 编译（`landlockProfileArgs`）、runner argv、enforcement 回读全部是宿主自家代码逐调用干活。
   生产形态 = 装好平台包后 `launcherPath()` 自然命中，本钩子只是装配侧指路（pin 树 bin/ 缺二进制）。
3. **Team resolver = approval waterfall 回答方**：`ctx.on('approval/request', h, { global: true, prepend: true })`
   （cordis 公开监听选项；ACP 用同一 seam 的普通形态）。per-call Grant 台账（token→decision）由 runner 在
   call 前喂入；每 ask 按 callId 入账。
4. **见证面**：`presentAs('ptc')`、scoped echo 工具、guard（外层+内层 callId/rootCallId）、around-seam
   捕获外层结果 + /proc 采样。

## 缝事实与披露（实测非推测）

- **approval/request 链上存在一个先行外部监听（boot 时=1 个，非 global 非 prepend，绑定闭包无法署名，
  候选=remote 桥/ACP 形）**，且它会**吊住** waterfall：RED 轮（无 resolver）ask 永久挂起（`approval/asked`
  入会话日志、无 result）——与 W-PTC-OUTER LEG B「挂起无 tool/result」同族；GREEN 轮 resolver 以
  `prepend` 置于最外层（文档语义：outermost-first，返回不调 next() 即否决后续链）后三 ask 全部即时裁决。
  ⇒ 「公开面能装配」成立，但**生产部署的监听顺序编排是装配方决定**（若 GUI 桥在场，抢序会截胡 GUI——
  真实 Team 部署里 ask-lane 裁决人本就该是唯一回答方，此点供裁决）。
- 「resolver 不回」用 **throw 姿态**表达（宿主文档化归一化 → `'unavailable'` → 原文）；用 `next()` 透传
  则会落进上述外部监听的吊起态——两种 fail-closed 语义都零授予、零副作用，如实分列。
- `sandbox/mode` 会话事件 seq=1 = **宿主 session-init 写**（值=部署默认 workspace-write），非本 kit 写
  （本 kit 写模式次数=0；C-NO-SESSION-MODE-WRITE 判据在册）。
- enforcement=partial（older Landlock ABI）如实入账；`/proc` 外层子进程采样在部分轮为 0（宿主嵌套 pid-ns
  采样窗口），真实进程证据改用程序自报 pid/ppid + 落盘副作用 + 宿主 pid 对照（三条独立可读）。
- mock 模型路由；queue-mode prompt 只 ack，结果全部经 around-seam 现场捕获；无 GUI 客户端。

## 文件

| 文件 | 角色 |
| --- | --- |
| `a5ptc4-row.mjs` | 装配行（RED/GREEN 同码，`A5PTC4_ASSEMBLE` 开关）|
| `run-a5ptc4-outerfs.mjs` | 真跑 runner（`--red`/`--green`；预检→装配→六腿→判据→世界删除+端口收口）|
| `runs/<red-stamp>/` | RED 轮（10/10 = 判别证明）|
| `runs/a5ptc4-green-2026-10-17T07-48-43Z/` | **权威 GREEN 轮（15/15）**：criteria / approvals-ledger(-final) / sandbox-census / approval-hook-census / run-leg*.json / os-preflight.json / assembly-ledger.jsonl / instance.log(脱敏) / session-logs(脱敏) |
| `runs/*-2026-10-17T07-1x/07-2x/07-3xZ` | 迭代轮（v1-v4，含首个 15-判据版 GREEN 与 resolver 触达诊断轮，保留为过程证据）|

## 复跑

```bash
node run-a5ptc4-outerfs.mjs --red
node run-a5ptc4-outerfs.mjs --green
```

## 红线守纪

CORE PATCH BUDGET = 0（`vendor/cordis` 与 host 树只读亲验 porcelain=0 前后）；矩阵行零改动（M-08 原样，
转态只报协调者走 probe 词表/台账）；:3080 前后 401 token 门未动；测试实例只绑 3184；世界+禁区目录跑毕
删除（teardown 留痕于 criteria）；test-use 树零写入；密钥为合成串、launch token 脱敏。
