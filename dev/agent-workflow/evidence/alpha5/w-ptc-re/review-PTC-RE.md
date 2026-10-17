# review-PTC-RE — W-PTC-RE（alpha5-ptc-recheck@0862dcb3）独立审查

reviewer = W-E2/W-PTC 合并独立 reviewer（qwen3.8-flash-next，独立会话；≠dd7bb571/≠8fe1fd77）。
受审 = `alpha5-ptc-recheck @ 0862dcb3`（base `aece4f21`，one-off worktree `.worktrees/alpha5-ptc-recheck`）。
审查方式 = 静态复核 + **三块独立复跑**（live ptc / live lsp / gap 探针），port 3184（起跑前亲验空闲），:3080 只读 401/401。

## 裁决：**通过（PASS）** —— 可转 4 腿成立、真缺 3 腿定性成立、danger-full-access 使用**可接受无需整改**（一条建议项）

## 1. 三 run 抽 4 判据复跑（M-08 A1/A4 + M-09 A1）

reviewer 自跑（`run-a5ptc-live.mjs --mode {ptc,lsp} --port 3184 --evidence-dir <reviewer scratch>`，世界 `tests/homes/a5ptc-{ptc,lsp}-*` teardown 自删）：

- **mode ptc = 11/11 PASS（exit 0）**，抽取判据逐条：
  1. **rootCallId 链（A1 内层复入同一管线）**：guard 见证 OUTER `run_code` + 两 inner（`a5ptc_echo`/`a5ptc_denied_probe`），`inner=true（exec.parent!==undefined）`、两 inner `rootCallId==外层 callId`、seq 有序、程序侧回读 `A5PTC-ECHO:inner-1`（stdio 控制管道往返语义）。reviewer 自跑复现。**成立**。
  2. **双侧 throw（A4 保留传输）**：4 侧普查全 throw+reservedName——root/scope `tools.register` ⇒ `tool name "run_code" is reserved …`；scope `restrict` deny/allow 两侧 ⇒ `tools.restrict() cannot name reserved PTC mode presentation transport …`。reviewer 自跑逐字复现。**成立**。
  3. **外层真实进程（A1 半）**：program 自报 pid=131 ≠ host pid=44（writer 终跑 101≠38），配合上条控制管道往返=进程间协议语义；**/proc 采样观察面如实弱**：writer 终跑空数组（如实记录不作依据），reviewer 外部 `ps` 采样也未逮到子进程（容器 pid 面/短生命周期），且 reviewer 采样器自身 cmdline 被 kit /proc 面自匹配收编（污染披露，判据 `||` 语义下两跑均由 program 侧承载）。该腿在**已披露 fixture 口径**内成立；OS 级父子观测留在 A2/W4 域（其 `not_observed` 点名在册）。
  4. guard typed 拒负控（装配级，非 A2 OS 面）：程序捕获含 run 标记的类型化拒绝、工具体未跑。**成立**。
- **mode lsp = 13/13 PASS（exit 0）**，抽取判据逐条：
  5. **pid 不等（M-09 A1）**：两 member 经真实模型路由 `execute("lsp")` 达各自常驻服务器，同 workspaceRoot 下 **pid 126 vs 183、各 opens=1**（writer 128/187）；realm 粒度隔离 + 热复用同 pid（opens=2）。fixture 服务器自报 pid 口径已在 README §4 披露；池/路由/spawn 为 host 自家 barrel 真代码。**成立**。
  6. **仅杀自身**：realm dispose → A pid 消失（OS `kill(pid,0)` 探活，非自报）、**B 存活且热复用原 pid 183**（sibling untouched）。reviewer 自跑复现。**成立**。
- 矩阵/探针卫生：分支 diff **纯 evidence 新增、矩阵一字未动**（reviewer 核）；pr8 探针对其 receipt 亲跑 PROBE-GATED 缺项点名（M-08 [A2,A3]、M-09 [A2,A3,A4]）与 README 三态总表一致；receipt 只 book 真跑观测、`not_observed` 点名 A2/A3 不冒领；合并路径（+W8 receipt ⇒ LIVE 提案值）表述留给协调者，未自行转态。**如实**。

## 2. danger-full-access 披露合规性 —— **判定：可接受（ACCEPTABLE），无需整改**

判据链（reviewer 亲验）：
- 使用面 = **公开 API**：`@deepseek-ai/dsh-sandbox-policy` barrel 导出 `setSandboxMode(session, 'danger-full-access')`（file-URL import host 自家 lib barrel，非私有面、无 patch，红线不涉）。
- **处方来源为 host 自身 typed 错误原文**：首跑真吃 `sandbox-unavailable` 错误被逐字保留在 `runs/ptc-2026-10-17T03-58-41Z/ptc-state.json`，其末句即『otherwise switch the consumer to danger-full-access』——非 writer 自造旁路。
- **无 OS 强制宣称**：行内 leg note、README §4、receipt `execution_note` 三处一致声明本腿只断言管线（outer process + 内层复入 + 双侧 throw），OS 强制面=A2/W4 域且 receipt `not_observed` 点名不 book；`PTC-GUARD-TYPED-DENIAL` 也只自称装配级。
- **影响面收口**：一次性测试世界（零生产行装载）、teardown 删除、:3080 前后 401/401 未动、宿主 porcelain=0。
⇒ 公开 API + host 自述处方 + 口径封顶 + 一次性世界 + 三处披露 = **可接受**；不构成整改项。
建议项（非阻塞）：override 事件本身目前只在代码路径+前后结果（首跑错→终跑成）中间接可证，未落为显式观测字段（`ptcView` 不含 legs）——建议后续轮把 `sandbox-mode-override` 记入 ledger/state 面，一行之劳。

## 3. 三真缺腿复现与定性（probe-gap-lsp-policy）

- **复跑 = 与 writer 记录 byte 相同**（除 timestamp；reviewer 跑毕恢复 tracked result.json，worktree porcelain 空）。
- **gap1（M-09 A2 策略代际逐出）确实咬**：`LspQueryRequest` 全字段=operation/filePath/position/workspaceRoot（reviewer 直读 interface 全文复核，无嵌套截断漏字段）⇒ 无策略输入；stdio `LspLocalServerConfig` 无策略输入；两 barrel 导出名集无 evict/generation/reload 钩子；池键=canonicalizeWorkspace(workspaceRoot)。⇒ **SEAM-GAP（上游）定性准确**；与 `pr6/SEAM-VERDICTS.md` B4（realm 内两策略标签共享同一 pid=HAZARD、realm=公开面最细粒度、严禁改名冒充隔离）运行时观测互指成立。
- **gap2（M-09 A3 服务器 OS 读中介）= 裁决项非缺陷，定性准确**：spawn 面=公开 `ctx.subprocess.spawn`（可 per-realm 重装 confined 实现 ⇒ 装配可及，非上游缺口）；但 Team 冻结 C-PROC 形态 `SpawnReceipt{lease,processIdentity}` 无 stdin Writable 臂、`RunOutput` one-shot，而 lsp-stdio 连接要求常驻 stdin/stdout 协议流（host 源错误串『dropped a piped protocol stream』在案）⇒ 卡的是『是否给 C-PROC 开 streaming-pipe arm』的**裁决**，两侧证据各自在册。既非上游 SEAM-GAP 亦非纯装配可跑亦非缺陷——三态定性精准。
- **gap3（M-09 A4 粒度映射）**：跨 realm 零复用已观测（SIBLING-UNTOUCHED），"跨策略"主张需 策略⇒realm 映射=Team 裁决；receipt 该字段如实缺席（NOT-EXECUTED）。与 A2 同根因，定性一致。

## 4. 保留观察（非阻塞）

- **N1**：README 记『9/9 PASS』而终跑 `criteria.json` 实为 **10/10**（P-STABLE-UNTOUCHED 行后补）；lsp 终跑文件 12 行无 P-STABLE-UNTOUCHED、committed runner 现输出该行（reviewer 复跑含之且 PASS）。方向为**少报非多报**的脚本-证据微漂移，记录在案即可，建议终报口径以 criteria.json 为准。
- **N2**：外层真实进程的 OS 级独立观测（ps/proc 逮到 bootstrap 子进程）在两跑中均未逮到（已在 writer 披露与 §1.3 复核）；PR8 正式轮若需更强 outer-process 腿，可用 pidfd/进程组钩子或延长 bootstrap 采样窗，属增强非阻塞。
- **N3**：reviewer 采样器自匹配污染 kit /proc 面一事（详见 review-WE2.md §5-N3）同样适用于本 kit 采样器，同建议排除 observer 自身。

## 5. 卫生复核（reviewer 亲验）

分支=纯 evidence 新增（矩阵零改动）；三套复现（live ptc / live lsp / gap 探针）reviewer 独立复跑全绿/byte 同；世界即删、homes 空、宿主 porcelain=0/HEAD 未动；token 扫描 reviewer 全部复跑证据面 0 命中（redact-at-capture 生效）；:3080 全程 401/401。

— reviewer 会话：本文件即裁决正本；writer 与 reviewer 无共享上下文。
