# 运行记录 2 — 把损坏行注入**操作者自己创建的团队**，并在真实浏览器里看到警告条

**时间**：2026-10-09T15:10Z · **执行者**：协调者 · **世界**：`tests/homes/a4-w5-corrupt-acceptance` · **服务端口**：3082（操作者指定）
上一份记录：`RUN-20261009-3082.md`。

## 结论先说

1. **警告条在真实 Chromium 里确实渲染**（首次）：`role=alert`，逐字
   `控制账本存在无法解析的损坏记录（仅提示，不改变执行语义）: 1` + `记录 #18 — 无法归属到具体成员（团队级提示） · request req-a4w5-human-acceptance-damage-b`。
2. **同屏暴露一个新的、可复现的读面不一致**：该被拒收的行在服务端**投影**里被算作**待裁决**（`pendingControlCount: 1`），UI 因此列出"控制请求 · 等待裁决"并给出**可点击的"拒绝"**；而 `ControlService.listControlState()` 对同一团队报 `requests=0 / corruptCount=1`。见下 §D。

## A. 先纠正我自己造成的故障（已回滚并验证）

为了"让预置团队出现在 GUI 里"，我把 `session-a4-accept-boot` 及其 4 个 child 会话目录从源 slug **复制**进本世界活动 workspace slug。宿主随即拒绝启动工作区服务：

```
workspace (@deepseek-ai/dsh-workspace): Error: corrupt session log
  ".../sessions/--…-a4-w5-corrupt-acceptance--/session-a4-accept-boot/session.v4.jsonl.zstd"
```

机制（量出来的，不是猜的）：会话日志第一行自带 `cwd`（该会话为 `/home/…/a4-accept-20261007T16-57-26Z/workspace`），
**目录 slug 不是标签而是身份的一部分**；不一致时宿主判"日志损坏"，连带 `sessionController` 不可用，侧栏永远"暂无会话"。
只有复制后的那次 boot 有此错误（`grep -c` 逐日志核对）。**已删除 5 个复制目录并重启验证**：活动 slug 只剩操作者的 2 个会话，源 slug 5 个完整，新日志 `corrupt session log = 0`，侧栏恢复。
⇒ W5 FINDINGS 那句"改写是脆弱语义手术"得到机制级证实：**跨 workspace 搬会话不可能，只能对目标团队本身注入。**

删除运行期标记时我**删错了文件**：守卫读的是 `.accept-host.json`，我删的是 `.accept-launch.json`（live-check 用，boot 会重写，无害）。
没有伪造端口：改为**先在族内端口 3182 起一次再停**，让 `.accept-host.json` 自己变诚实（recorded port=3182），守卫随后自行探测并放行。

## B. 工具改动（同一目录，evidence-only）

多团队世界是**常态**（人在 GUI 里建团队 = 第二行 `team_sessions`），原配方假设全世界一个团队。新增：

- `--request-id <id>`：幂等哨兵按 requestId 判定，而**一个世界的 ledger 表是跨团队共享的**，所以第二个损坏行必须换 id。
- `world-seam.mjs` 的 `damagedControlRow(rootSessionId, requestId?)` / `findDamagedRowSequence(entries, requestId?)` 参数化，默认值不变（旧命令行为完全不变）。
- 注入器与验证器在世界有多于一个 `team_sessions` 行时**拒绝猜测**并提示 `--root`（既有设计，实测触发）。

实测：`--root session-f68de491… --request-id req-a4w5-human-acceptance-damage-b` → `appended row : sequence 18`；复跑 `already injected … NOTHING WRITTEN`。

## C. 两条读路（生产读面，无 GUI）

```
TEAM (root)  : session-f68de491-ee36-4341-8673-9b20f5d3ea36
READ A  corruptCount = 1
        corruptLegs = [{ sequence: 18, requestId: "req-a4w5-human-acceptance-damage-b",
                         approvalCaseId: null, disclosesMember: false }]
READ B  v9 team.listCorruptControlLegs → teamSessionId 同上, corruptCount 1
```

**顺带量到一条有用事实**：全世界 `control-request-recorded` 共 2 行（预置团队 15 + 本团队 18），
但本团队两条读路都只报 **1** ⇒ **损坏腿列表按 TeamSession 隔离，不跨团队串味。**

## D. 新发现的读面不一致（未修，待人裁决）

| 观察者 | 对同一行的说法 |
| --- | --- |
| `ControlService.listControlState()` | `requests=0`，`corruptCount=1`（严格读者拒收，守卫无从治理） |
| **服务端投影** `team.getProjection` | **`pendingControlCount: 1`** |
| 客户端 UI | 列出"控制请求 · 等待裁决"，`渲染模式 unsupported-subject`，**"允许"禁用、"拒绝"可点**，团队角标"1 待裁决" |

客户端侧的策略是既有的、有意的（[ledger-adapter.ts:421-423](../../../../packages/client/src/model/ledger-adapter.ts)，PR #56："unknown subject stays visible as `unsupported-subject`"），
**本轮没有改它**；此前不可见只是因为世界上从未存在过被拒收的行。
要紧的是投影那一侧：把一行永远不会被治理的记录计入"待裁决"，等于邀请人去裁决一个幽灵。

**我没有点"拒绝"**（那会发出一次针对 `req-a4w5-human-acceptance-damage-b` 的 resolve；控制服务对未知 requestId 的既有实测语义是 `no-request` 拒收，见 W2 Case 2b）。
**没有验证**：点击后的真实后果；该计数是否还影响别处（只读了 `pendingControlCount` 一个字段）。

## E. 运维事实（本次实测，均已进日志）

- **杀 supervisor 不带走宿主**：`kill` 掉 supervisor 后 3182 仍在监听；宿主随其**沙箱父进程退出**才被 `--die-with-parent` 收走。
- **跨 bash 调用无法互杀进程**：每次调用 `--unshare-pid`，`pgrep/pkill` 只看得到自己的命名空间（`pkill -f <world>` 匹配到本沙箱 pid 1 = bwrap，把自己打成 143）。这就是 `boot.mjs --stop` 跨调用失效的机制解释。
- 全程只 `:3080` / `:3081` 在听时才算"无宿主"；`boot.mjs` 每次 boot 会只读探测 `:3080`（401），稳定实例 `DSH_HOME` 未被触碰。
- 每次 boot 铸新 token，**旧 URL 立刻失效**。
