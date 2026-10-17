# W-PTC-OUTERFS — 独立安全审查（OUTERFS independent SECURITY review）

- 受审件：`alpha5-ptc-outerfs @ 903c062f`（`a5ptc4-row.mjs` + `run-a5ptc4-outerfs.mjs`，本分支对二者 **byte-identical 复跑**，`git diff 903c062f` 空 + `cmp` 通过）
- 审查者：OUTERFS 独立安全审查（qwen3.8-flash-next；≠7a41c901 writer 会话；独立一次性 worktree `.worktrees/a5ptc4-rev-sec`，分支 `alpha5-ptc-outerfs-rev-sec`）
- 环境：pinned host `639ed01539`（0.2.0-rc.2，porcelain 前/后=0）；端口 **3184**（自证空闲）；世界 `tests/homes/a5ptc4-rev-2026-10-17T08-{21,22,35,41}-*Z`（跑毕删除）；:3080 前/后 401 未动
- 方法：静态裁决性阅读（resolver + 宿主 `sandbox/escalation.ts`、`user-approval`、`acp`、`api/remotes`、`vendor/cordis` waterfall 语义）+ **三轮真跑**（v1 `08-22-55Z`、v2 `08-35-25Z`、v3 `08-41-17Z`=权威轮；v1 另存 kit 拓扑教训）。审查探针 = `rev-probe-pkg/rev-sec-probe.mjs`（公开 `ctx.on`/`webServer.register`，只观察，不改受审件）；runner `run-a5ptc4-rev.mjs`；判据 `runs/<rev>/criteria.json`。
- 模型路由声明（原文）：`You are a coding agent powered by the qwen3.8-flash-next model.`

## 0. 结论（先行）

**判定：`alpha5-ptc-outerfs@903c062f` = 「公开 per-call 审批能力演示（装配层）」成立；「fs per-call 治理」不成立。**
resolver **没有任何归属/Grant 校验**——按"ask 的 `reason` 文本（=模型自家 `justification`）里正则出的 token 字符串 ∈ GRANTS 白名单"就批。按 08:04Z 根口径，此形态**只能限定为公开 per-call 审批能力演示，不得称 fs 治理已交付**；M-08 行 fs 半臂转态提案**挂起**，入账词须降格（见 §6）。
生产授权强度 = **L1（装配演示级）**。到 L2 的最小补齐 = §7 T-1…T-5（全部可由公开面完成，无新 core seam，非 CORE_SEAM_BLOCKER）。
委托完整性、并发隔离、fail-closed 词表、原权限不降、net 与 fs 分离：**审查通过**（§3/§4）。
三项负控不通过（重放 / 撤销 / 跨会话归属）= F-2/F-3/F-1，均真跑实证。

## 1. 任务① 归属限定 —— **不成立（F-1，Critical，governance-blocking）**

静态（裁决性，无需推测）：

- `a5ptc4-row.mjs:126-128`：`token = /A5PTC4-TOKEN:(…)/.exec(request.reason)`；`request.reason` 由宿主拼装修饰自 **模型可控**的 `justification`（`packages/sandbox/sandbox/src/escalation.ts` `approveEscalation`：`reason: 'escalate sandbox to ' + mode + ': ' + justification`；`validateEscalationArgs` 只要求非空句子）。
- `a5ptc4-row.mjs:148-151`：`decision = GRANTS.get(token)`；`allow→'allowed-once' / reject→'rejected'`。**裁决输入只有这个字符串**。
- 宿主在 request 上提供了可验证的归属字段——`agent`（工具层闭包注入）、`callId`、`toolName`——resolver 在 `:133-135` **只记账不使用**。对照宿主自家桥的正确姿势：ACP 桥 `packages/acp/acp/src/index.ts:155-157` 先 `ownedRecord(request.agent)` 验归属，非己方 `next()` 放行。
- GRANTS 来源 = 世界内**无鉴权 HTTP 面** `POST /__a5ptc4/grant`（`:233-238`），任意 token 字符串→decision；**不存在任何 Grant 记录结构**（无签发者、无绑定对象、无消费状态）。

真跑（v3 权威轮）：R6 = 会话 B 呈现已授权给会话 A 用途的 `t-x` → resolver `seq6 decision=allow outcome=allowed-once`（agent 字段明书 `session-c5e9…`=B），会话日志 `approval/asked→decided allowed-once`，该调用 `sandbox.mode=danger-full-access, denied:false`，禁区目标**真实写入**（独立 OS 进程 pid/ppid 可辨）。**跨 Team/member 呈报同一形状 token 即获批** —— 归属校验缺失的活证。

推论（必须写入部署判定）：token 泄漏/被模型从上下文复述即可**自助加宽**（模型可控文本 × 无归属 × 全局前置监听）。当前世界唯一挡住的点是"测试装配里没人把 token 泄给模型"——这是演示安全，不是治理安全。

## 2. 任务③ 负控五件（逐件裁决，全真跑）

| # | 负控 | 要求 | 实况（v3） | 判定 |
|---|---|---|---|---|
| 1 | 错误 callId/未知 token（`t-nope`） | 拒 + 下游可见 | resolver `seq2 decision=unknown outcome=pass-through`，我方**零授予**；ask 逐字到 lane（`approval/asked` 同 callId+reason）、无 `approval/decided`、无 tool_result、零写入 | **PASS**（零授予+下游可见；"拒原文"需人桥应答，见 F-7 披露） |
| 2 | 重放同一 callId/已消费 grant | 必须拒 | `seq4 decision=duplicate → allowed-once`（ANSWERED 缓存 `:144-147` 无消费失效），第二次禁区写入 `rev-replay-target.txt` 落盘 | **FAIL（F-2）** |
| 3 | 过期条目 | 必须拒 | 结构缺失：GRANTS 无 TTL/过期码路径（`:87,:148`）；过期条目**不存在**，等价于永久有效 | **FAIL（F-4，结构性）** |
| 4 | 其他 team 同形 callId（会话 B 呈报 A 的 token） | 必须拒 | `seq6 allow → allowed-once`，加宽真生效，目标写入 | **FAIL（F-1 活证）** |
| 5 | 策略变化后的旧 callId（`t-r` 翻为 reject 再呈报） | 必须拒 | `seq5 decision=duplicate → allowed-once`——缓存先于 GRANTS，**撤销不可达**；第三次禁区写入落盘 | **FAIL（F-3）** |

## 3. 任务② 委托完整性 —— **通过**

复跑形态 = 我方 resolver（受审件原样 `{global,prepend}`）+ 下游探针（`rev-probe`，公开 `ctx.on` 非前置，装于我方独立包）同时在场，外加世界内已挂接的审批 lane（`api/remotes` waterfall 桥 / ACP 桥在位 = GUI 桥在位场景模拟）：

- 外来 callId（RF/RG，`token=''`）：resolver `decision=foreign outcome=pass-through`（`a5ptc4-row.mjs:139-142` 原样 `next()`），**我方零应答**（approvals/台账无 outcome 行）；会话日志 `approval/asked` 携带**逐字 reason+callId** 到达 lane，`decided=False`、无 tool_result、零写入 ⇒ 未抢答、未吞并，交下游审批器裁决（lane 无人应答时按宿主姿态 pending——fail-closed 语义在宿主 `decide()`： rogue 返回/throw 归一 `'unavailable'`，`'never'` 先于 dispatch 短路）。
- 未知 token（RU）：`decision=unknown → pass-through` 同路径。
- 探针侧观测：后置探针在 lane 挂接时收不到（被 lane 持住）——这与「GUI 桥在位时桥先持住 ask」一致，属宿主既有顺序，不是 resolver 吞并；受审件的前置抢序风险（tokenized ask 截胡 GUI 桥）README 已如实披露，其实质危害即 F-1（无归属的截胡）。
- 委托语义核对（`vendor/cordis` `waterfall`：listener `return next()` 即原样下传、返回不调 next 即否决链）：实现与声明一致。

## 4. 任务④ 安装/卸载对称 + 并发隔离

- **并发隔离 = PASS**：两会话并行（tA allow / tB reject），各 ask 只被自己的 grant 裁决（`seq7/seq8`，agent 字段各归其主，callId 不同；A 目标写入、B 拒绝原文零写入）。但注意：隔离只建立在**token 保密**上——R6 证明跨会话呈报可穿透（归 F-1）。
- **安装/卸载对称 = FAIL（F-5）**：`:174/:180` 两个插件级 `ctx.on`（含 `{global,prepend}` 面）**丢弃 disposer**，监听器进程生命周期常驻，kit 无卸载面；agent-ctx 面（`:311`）有 disposer。探针行演示了对称公开形状（`ctx.on` 返回值 dispose → hook census `7→6`）。
- 台账注记（F-6，低）：`decision=foreign` 行只进装配台账（`record`），不进 `/approvals` 公共 census（`:165` 仅在 token 非空时 push）——对外审批账本**漏记委托行**，审计需读全量 journal。

## 5. 根验收「原权限不降」——**通过**

- 两会话 per-session `sandboxMode=workspace-write` 与 `approval/policy='ask'`（宿主 session-init 写）**全程不变**（前后 census 等值）；kit 零 `setSandboxMode`/`setApprovalPolicy`（静态 + 判据在册）；secret sha256 不变；禁区目录只含判据控制文件。
- 宿主 `user-approval.decide` 的 `'never'` 策略先于 dispatch 短路——前置 resolver **无法**为 'never' 会话开洞（宿主源码注自证）。
- 未绕原审批：所有加宽都走宿主自家 `approveEscalation → ApprovalService → ctx.waterfall('approval/request')` 公开链，无 setMode 旁路；RED 判别性（writer 轮）+ 本审 v1 轮（关装配件时 ask 挂起/零台账）复核成立。
- **:3080 稳定实例前后 401、pinned 宿主树 porcelain=0 前后**；测试世界跑毕删除。
- **net 不由 fs 推导**：本审未做任何网络面改动，README 亦维持 net 半臂局部阻塞——符合。

## 6. 任务⑤ 生产路径判定 + 限定声明

**未接真实一次性 Grant。** 当前 grant 源 = 世界内无鉴权测试 HTTP 面；README 自称"test-world shape of the ask-lane resolver input… production = Team ask-lane leader/human resolvers"方向正确，但件上尚无归属绑定/消费/TTL/撤销，**该件在生产形态下等价于"模型文本可触达的全局 per-call 加宽原语"**。

限定声明文字（入账必须携带）：
> W-PTC-outerfs@903c062f 证明的是「Team resolver 可经公开 `{global,prepend}` 监听面在 per-callId 审批 waterfall 上即时裁决，且委托/失败闭合词表可用」——**公开 per-call 审批能力演示**；不含归属限定、单次消费、撤销与过期，**不构成 fs per-call 治理交付**。

M-08 转态词建议（交 ROWFIX/协调者）：`per_call_policy_denials.os_level_observed=true` 可入账（OS EACCES 真拒证据不受本审发现污染），但**注脚必须挂本审查限定声明**；「per-call 策略注入已证（fs 半臂）」的表述降级为「装配已证，治理语义 L1（待 L2）」。

## 7. 生产授权强度阶梯 + 需补清单

- **L0** 静态姿态（整程序 mode / 策略表），无 per-call。
- **L1（本件）** 装配演示级：公开面可装、链上即时裁决、fail-closed 词表、per-callId 台账、OS 级拒绝在场。**缺全部治理语义。**
- **L2** 归属+消费级（转"半臂已证"的最低线）：
  - **T-1 归属绑定**：裁决输入 = 宿主字段 `(agent/session, callId, toolName, requestedMode)` 必须命中 Team 侧登记的 Grant 记录；`justification` 文本**永不**作为裁决输入；非本域 ask 一律 `next()` 委托（ACP `ownedRecord` 姿势）。
  - **T-2 单次消费**：`allowed-once` 应答即原子消费；同 callId/同 Grant 再呈报 = fail-closed（修 F-2）。
  - **T-3 撤销优先**：任何缓存/去重表必须后置于撤销检查；撤销不可达即不存在（修 F-3）。
  - **T-4 过期**：Grant 带 TTL，过期条目拒（修 F-4）。
  - **T-5 卸载对称**：保留并暴露 disposer；全局前置监听不得常驻无退（修 F-5）。
- **L3** 语义收窄+审计：Grant 绑定资源/路径 scope 与工具族；委托行入公共 approvals 账本（修 F-6）；顺序编排序列化（GUI 桥在位时非本域零截胡，含并发多 Team 隔离 suite）。
- **L4** 生产接线：Team ask-lane leader/human resolver 作真实 Grant 源（替换 `/grant` 测试面）；net 半臂另案（上游词表缺口，维持阻塞，**不由 fs 推导**）。

## 8. 文件与复现

| 文件 | 角色 |
| --- | --- |
| `run-a5ptc4-rev.mjs` | 审查 runner（判据 = 根口径要求，非实现口径；FAIL=发现） |
| `rev-probe-pkg/` | 观察探针行（独立包身份；公开面注册；含 probeA/probeB/uninstall 对称演示） |
| `runs/a5ptc4-rev-2026-10-17T08-22-55Z/` | v1：发现 kit 拓扑约束（挂起腿必须独占会话——挂起的 ask 会序列化饿死同会话后续腿）+ F-1 首证 |
| `runs/a5ptc4-rev-2026-10-17T08-35-25Z/` | v2：R3/R7/R9/R10 定型 + F-2/F-3/F-1 三发现 live 复现（ledger `duplicate→allowed-once`×2 + 二次/三次禁区写入落盘） |
| `runs/a5ptc4-rev-2026-10-17T08-41-17Z/` | v3 权威轮：9 ask 全台账（seq1-9）；F 会话 finalize 日志离线核验 `asked=verbatim & decided=False & no tool_result`（委托 pending 证明）；criteria 11/17（FAIL=R4/R5/R6 发现 + R1/R2/R8 的**运行时日志刷写时机**限制，已由 finalize 副本离线核验补足，判据文字在 v3 runner 中已修正） |

```bash
node run-a5ptc4-rev.mjs        # 判据 FAIL = 发现，EXIT=2 是审查产物
```

## 9. 红线自查

CORE PATCH BUDGET=0（宿主树只读，porcelain 前/后=0）；探针与 runner 全部公开面（cordis 文档化选项 + webServer.register）；零矩阵行改动；:3080 只读探测；世界跑毕删除；launch token 脱敏（instance.log/session-logs 红acted）；无凭据入库。
