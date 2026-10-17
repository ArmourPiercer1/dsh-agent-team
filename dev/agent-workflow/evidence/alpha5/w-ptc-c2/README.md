# W-PTC-C2 — PTC→受限 provider 同一装配链整链验证（COMPOSED-LIVE ⇒ 06:53Z 口径收窄：仅内层 per-call 载荷执行边 LIVE-observed）

> **06:53Z 口径收窄注记（W-PTC-ROWFIX #290 入册，branch alpha5-ptc-rowfix）**：本文件全部 **COMPOSED-LIVE**
> 措辞收窄 =『**仅内层 per-call 载荷执行边 LIVE-observed**』（同链 guard 逐次断链 + Lane C 受限 provider
> 真 execve/OS 拒绝 + 启动前 typed 拒零 spawn + 同名双侧 throw）。历史正文按当时记录保留，但行级判定以
> W-PTC-OUTER 三态裁决为准：外层直接 fs/net OS 级拒绝负控在 M-08 原计划受控对象内（S0:55），三态裁决=
> PROBE-GATED + 精确局部阻塞（外层可信文件域只能整程序级给定，公开 seam 无法注入 per-call Grant；
> 网络效果无任何 OS 机制覆盖），独立 reviewer PASS 06c3b502 ⇒ 矩阵 M-08 行级 current_status=
> TRANSITIONED-PROBE-GATED，本文 §3/§6 的 TRANSITIONED-LIVE 提案值已撤回。正本=machine 矩阵 M-08
> transition_record + w-ptc-outer/（README/pr290-comment/runs）。

writer = W-PTC-C2（one-off worktree `.worktrees/alpha5-ptc-chain`，branch `alpha5-ptc-chain`，base `master@8eb93ddd`）。
liveness 首报（模型行原文）：`You are a coding agent powered by the qwen3.8-flash-next model.`
port = **3184**（跑前自证空闲 + 跑后自证释放）；世界 `tests/homes/a5ptc2-compose-*`（跑毕删除，现 `tests/homes/` 空）；宿主 = 共享只读 built 树 @`639ed01539`（0.2.0-rc.2，porcelain 0 前后）；:3080 稳定实例 pre=401/post=401 零触碰。

## 0. 任务口径（root 04:57Z 在册更正——先行落档）

04:57Z 口径：**W-PTC-RE 的 A1/A4（danger-full-access 测试世界、host 自带 PTC runtime、无 OS 强制）与 W8-W4 的 A2/A3（PTC 管线外的独立 provider 装配）不可拼 receipt 宣称整行 OS 强制**。
本轮裁决性执行：**『作者 receipt 的合并即全 SATISFIED ⇒ M-08 转 LIVE』之提案 = 不予采纳**（在册于 machine 矩阵 `M-08.pending_probe.transition_record.basis`）。替代路径 = 本 README 的**单一组合链**：同一会话、同一回合、同一 run_code 执行内，把 PTC 管线的内层执行边挂到 Lane C 受限 provider 上真跑。拼合提案作废不是因为它指控的漏洞不存在，而是因为它从未被同链观测过——现在被观测过了。

## 1. 组合链（COMPOSED-LIVE）

```
model turn ─▶ run_code（PTC 保留传输；host 自带 NodePtcRuntime；
              外层=真实独立 OS 进程：/proc 亲采 ptc-runtime-node 子 pid=110, ppid=host 39）   [W-PTC-RE 面]
      ─▶ stdio 控制管道 ─▶ 内层工具调用复入同一 ToolRuntime 管线
              （guard 行 seq2..5：3×a5ptc2_confined_exec + 1×a5ptc2_probe_spawn，
                全部 exec.parent 在场、rootCallId==外层 callId、逐次有序）                    [W-PTC-RE 面]
      ─▶ 内层执行边 = 受限 spawn：dist 公开 barrel ─▶ createConfinedProcessProvider
              ─▶ 公开 deps 计账 spy ─▶ 在册 landlock-prelauncher.py（sha256 cee10ed5…，
                由 runner 钉记）─▶ 真 Landlock ABI v4 ─▶ 真 execve /usr/bin/cat              [W4 面]
```

公开面清单（全部为两轮既有 kit 已亲验面，零新发明、零 lane 改动、IF-5 零改共享实现文件）：
`presentAs('ptc')` / `agent.ctx.tools.register` / `guard` / `ctx.on('tools/execute')` around-seam /
`setSandboxMode`（测试世界会话级开关）/ sandbox-provider **dist 公开 barrel 动态 import** +
`createConfinedProcessProvider`/`createLauncherDeps`/`runAvailabilityPreflight`/`runAbiProbe`/`runEnforcementLeg` +
`ProviderOptions.deps` 冻结注入点 + `ctx.webServer.register` 装配路由（profile-patch 装载）。

## 2. 三腿 + 两证 每腿实况（同一 run `runs/compose-2026-10-17T05-07-10Z/`，22/22 PASS）

| 腿 | 判据 | 实况（原文摘录见 criteria.json / composed-state.json / GREEN-console.log） |
| --- | --- | --- |
| (a) 正常路径 | 受支持 profile 在 PTC 内层边**真 spawn+回执** | `c2pos: ok=true rc=0 pid=118 lease=terminated stdoutMatch=true spyDelta=1 ceDelta=1`；回执 `pid:118:plan-mvbxq0p6-megxht` 经控制管道飞回程序结果（C2-CHAIN-POS-RECEIPT-FLIGHT） |
| (a2) OS 拒绝负控 | **同链** per-call 策略注入 OS 真实拒绝 | `c2deny: ok=true rc=1 eacces=true leaked=false ceDelta=1`（同策略 cat 私有 fixture；`/usr/bin/cat: … Permission denied`）；同轮 abi v4、selective/denyall=ENFORCE-CONFIRMED、badhandled=DEMO-CONFIRMED（假阴性判别器在场）、hardDimensions ['content-read','write'] 全程 verifyHardProfileEvidence |
| (b) 不可用 profile | **启动前** `IO_POLICY_UNSUPPORTED` + 零 spawn（spy delta=0） | `c2uns: ok=false code=IO_POLICY_UNSUPPORTED stage=provider-refused spyDelta=0 ceDelta=0 paths=[]`；消息原文：`network profile 'deny' is not offered in realm … no provider in this lane demonstrates full network deny (PoC-4b)` |
| (c) guard 拒绝腿 | 探针体不执行 | `sawDeny=true caught=true`，deny 原文 `<run>-C2-GUARD-DENY composed-chain probe denied by the team guard before its body`；marker `C2-PROBE-SPAWN-RAN` 在 state/tool-results/transcript/ledger **全缺席**；全回合 confined-exec 恒=2（仅 pos+deny），guard 侧 ceSnapshot@probe=2 |
| A1 外层真实进程 | 非 stub | outerChildren=`{pid:110,ppid:39,cmd=…/ptc-runtime-node/lib/process.js}`（/proc 50ms 采样，同 W-PTC-RE 证据类） |
| A4 双侧 throw | 保留传输不可覆盖 | 4 侧 throw 原文在册（root/scope register + scope restrict deny/allow，均 naming `run_code` reserved） |

## 3. 探针/矩阵/runner 在册动作

- 组合链 receipt（全 clause 从同一链）：`w-ptc-c2-receipt-M-08.json`；同时**替换官方路径** `pr8/probes/receipts/M-08.receipt.json`（W8-W4 原 receipt 逐字节保存为 `M-08.receipt.w8-w4-legacy.json`，只追加原则不破）。
- `probe-M-08.mjs`（一字未改，官方默认路径）→ **VERDICT LIVE exit=0**，日志 `pr8/probes/runs/w-ptc-c2-probe-M-08.log`（A1/A2/A3/A4 全 SATISFIED + evidence_refs 逐项亲验 + 装配锚点行形 grep 亲验在场）。
- 矩阵转态：machine M-08 `pending_probe.status_now → TRANSITIONED-LIVE` + 完整 transition_record（basis 含 04:57Z 在册更正）；doc 矩阵 M-08 同步 `TRANSITIONED-LIVE`（lint `F-1/F-4 防漂移` 测试亲证通过）。
- pr8 runner 复跑（一字未改）：`PASS=24 FAIL=0 NOT_RUN=3 LIVE=2(M-08,M-13) PROBE-GATED=3(M-04,M-05,M-09) TOTAL=32`，M-08 行 `probe-transition: LIVE`（runner 亲验位）——`pr8/runner/runs/matrix-run-2026-10-17T05-08-09-793Z.{json,log}`。
- runner 自测套件复跑：**35 pass / 0 fail**（`pr8/runner/runs/w-ptc-c2-selftest.log`；W8 时为 27，其后轮次新增套件在册）。

## 4. RED-first 与失败留痕（如实）

- `runs/compose-2026-10-17T05-05-53Z/`（RED-first）：链在 LIVE 进程内已全程走通（ledger：abi=4、ENFORCE-CONFIRMED、c2pos rc=0 pid=118、c2deny rc=1、c2uns 启动前拒），但本 writer runner 的 state 捕获行有 TypeError（`Object.values` 误用）——**harness 缺陷留痕**（`RED-first-console.log`），修一行。
- `runs/compose-2026-10-17T05-06-27Z/`：判据串缺陷轮（`ENFORCE` 大小写对不上行级 `enforced`）⇒ C2-PROVIDER-PROBE 记 FAIL；修判据（对齐 W4 的 ENFORCE-CONFIRMED 腿判据形，不放宽）。
- `runs/compose-2026-10-17T05-06-39Z/`：22/22（console 只留部分捕获，criteria.json 完整）。
- `runs/compose-2026-10-17T05-07-10Z/`：**canonical GREEN 22/22**（完整 `GREEN-console.log`；receipt/矩阵/探针均引用此轮）。

## 5. 披露（口径不升格）

- **PTC runtime 自身 sandbox mode = danger-full-access**：测试世界公开 `setSandboxMode` 会话级开关（host typed 错误自述处方；pre=workspace-write→post=danger-full-access，部署默认逐轮恒 workspace-write；mode-scope-evidence.json 在册），**不承担 OS 强制口径**。本链 OS 强制 = provider 的 Landlock 腿（abi v4 + ENFORCE-CONFIRMED 腿 + 域内 EACCES 实证），二者分离且分别在册。
- 外层真实进程证据 = /proc 采样 + 控制管道往返（同 W-PTC-RE 证据类）；模型路由 = mock 脚本；queue-mode prompt 响应体只回 ack——内层回执经公开 around-seam 捕获在册（如实）。
- provider 观察 1（RunOutput 无 rc 面）继续成立：rc/pid 走公开 deps 计账 spy（W4 披露的 GLUE 后补项，非 lane 改动）。
- 本行 LIVE = 矩阵词表内的**行级转态提案值**（终裁归 PR8 正式轮 + 独立 reviewer）；`current_status=s0-strict-disabled-pending-poc` 与本行验收 scope（criterion-level）不因本轮改动；Strict Profile 启用与 G-d/OpenAtPort 门禁不受本行 LIVE 影响（G-6/G-7 计分别行在册）。
- M-08 组合链达成的是**「PTC 调用路径上挂受限 spawn」**；宿主 PTC runtime 自身 bootstrap 子进程的 spawn 仍由 host 内部执行（无公开挂点，本轮亦不主张——矩阵判据语义 = per-call 载荷执行边，W4 两轮先例同此口径）。
- :3080 前后 401 一致零触碰；test-use porcelain=0、HEAD=pin 前后一致；世界跑毕删除、端口释放自证；IF-5 共享实现文件零改动（本轮全部新文件在 `dev/agent-workflow/evidence/` 与矩阵/日志/收据在册文件内）。

## 6. 整链判定

**COMPOSED-LIVE（06:53Z 口径收窄：仅内层 per-call 载荷执行边 LIVE-observed）**（LEG-SPLIT 不再维持——
同一链四 clause〔A1–A4，内层边〕全部 LIVE 观测在册）。
真缺腿清零仅于内层边断言集；矩阵 M-08 当时的 **TRANSITIONED-LIVE** 提案值已于 #290 按 06:53Z root 口径
**撤回** ⇒ 行级 current_status=TRANSITIONED-PROBE-GATED（外层边=精确局部阻塞在册；见文首收窄注记）。

## 7. 文件清单

| 文件 | 角色 |
| --- | --- |
| `a5ptc2-compose-row.mjs` | 组合链装配 row（PTC 管线 + Lane C provider 单一装配） |
| `run-a5ptc2-compose.mjs` | LIVE runner（预检+判据+收口；端口/世界/宿主钉记） |
| `runs/compose-2026-10-17T05-05-53Z/` | RED-first 轮（含 RED-first-console.log） |
| `runs/compose-2026-10-17T05-06-27Z/` `05-06-39Z` | 修复迭代轮（判据串缺陷轮 FAIL 判据保留如实） |
| `runs/compose-2026-10-17T05-07-10Z/` | **canonical GREEN**（criteria/composed-state/ledger/console/mode-scope/mock-decisions） |
| `w-ptc-c2-receipt-M-08.json` | 组合链 receipt（官方路径同步替换，legacy 保存） |
