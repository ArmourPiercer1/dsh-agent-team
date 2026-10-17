# review-LiveRound — live 装配轮独立审查（Scope-4 live round）

- 对象：`origin/alpha5-live-pr3 @ 688b6045`（父 `2c955133`，rev-parse 亲验）· writer 03b28f7c（独立会话）
- reviewer：live 装配轮独立 reviewer（qwen3.8-flash-next，一次性 worktree `.worktrees/a5livrev-688b6045` @688b6045，端口 3187）
- 判定：**证据可采信（ACCEPT）** — 无阻塞条件；附非阻塞观察 4 条。

## ① diff 文件集 — PASS
104 files, `git diff --name-only 2c955133..688b6045` 全部位于 `dev/agent-workflow/evidence/alpha5/live/`（4 脚本/README + 100 runs 文件）；`git diff -- packages/ tsconfig.json '**/tsconfig*.json'` = 空（barrel/tsconfig 含在内，packages 生产面零改动亲验）。fixtures 仅经公开 barrel 动态 import dist（a5live-fixtures.mjs:28-36 四路 import）；row 经公开 profile-patch seam 挂载（cordis.patch.yml，runner L159-167）。

## ② 三 run 原文抽核 — PASS
- **L-S1**（s1s2-…22-05-46Z/live-state.json）：`TOOL_BINDING_UNVERIFIED`/`denied`/`effect-outside-grant`，message 含 `admission-unbound`，**反事实对照 `readRawWouldSucceed=true` 为同刻真读**（fixtures safeRead=readFileSync，a5live-fixtures.mjs:213/217-219）。
- **L-S2**：`stage=flow-complete`、firstOk/matches=true、fpBound=true、**`ledgerConsumedCount=1`**（`ledger.consumedCount()`）、secondOk=false 且 secondRefusal 同 typed 三元组（one-shot 在 kernel `consumeForExecution` 活体边）。E2E 双腿同时见于模型 transcript（mock-req-sample：`A5LIVE-UNBOUND refused=true …`、`A5LIVE-BOUND … consumed=1`）。
- **G-6**（g6-…22-06-50Z）：`changeChannelStatus='proven'` 为**活体读取非 JSON 回放**——row `guardView()` 在 `GET /__a5live/state` 每次请求内现场执行 `asm.handle.changeChannelStatus()`（a5live-assembly-row.mjs:98，route :148-161）；observations 由 `onObserve` 实时推入（:351）后现场计数（:92-108）。live-state.json 是该活体读的**输出**。abort-issued=1 / cancelled-before-body=1（事件原文在 `abortIssuedRows`，含 pinned `def#1` 与 callId）、`executedUnvalidated=0`、**bodyCounts.v1=0**（journal drift-body 仅 v2/v3，body 零执行）、rebind ok、19/19 GREEN。armed-never-delivered 读跨 run 取自 g7 世界——README 已披露，诚实。
- **G-7**（g7-…22-06-58Z）：真实发射 **control=2 / proxy=2**（row-owned 控制订阅在 wrapper 外挂载 :371；proxy 入真实表不转发 :334-340；一次合法 dispose+register=2 次发射，两路各自计数一致）；五件套逐项：unvalidated=1 ≥1、alarm(severity=alarm)=1 ≥1、call-edge-drift(reason=definition-drift)=1 ≥1、binding-revised(verified=false)=1 ≥1、issued=0、cancelled=0；终读 channel='armed' + verifiedFalseObserved=true；**被移 body 实跑**（journal `drift-body version=2` ×2）。18/18 GREEN。

## ③ 复现 — PASS（独立复跑）
本审查 worktree 以 `--phase g6 --port 3187`（dist 自 writer worktree 同 HEAD@688b6045 原样拷入，宿主复用 `.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use @639ed01539` porcelain=0，未重建）：**GREEN 19/19，EXIT=0**；criteria ids/pass 与已提交 run 全等，guard 值逐项相同（proven/1/1/0/v1=0/v2=1/v3=1/rebind ok）。全链自清：世界删除、3187/3499 释放、raw log 删除仅留脱敏 instance.log。复跑证据：`runs/g6-2026-10-16T22-38-51Z/`（本 worktree 本地，未提交）。

## ④ 等级措辞 — PASS
README「LIVE-CONFIRMED（观察级）/ **ENFORCE-CONFIRMED: not reached — ENFORCE-PARTIAL**（三项缺项逐列）」使用准确；全文无「fail-closed 已证 / G-g 已闭合」类措辞（正则扫 `.md` 无命中）；G-g 行明示 **stay 未收口，closure 是 Gate（三 reviewer）动作而非 writer 动作**；kit 天花板（P4/P6 逻辑）继承声明在位。

## ⑤ 脱敏与收口 — PASS
- REDACTED-<sha8> 抽 2 处：s1s2 GREEN 日志 `<REDACTED-c9fdea01>`、g6 GREEN 日志 `<REDACTED-381698cb>`，格式一致且一 run 一 token（跨文件无重复 id，符合每 run 新 token）；机制功能性验证：本次审查复跑捕获 token→sha256[:8]=0f213038 与替换值一致（hex8 实现 = sha256 前 8 hex，runner L73）。
- 复扫：`a5live-*` 世界残留 0（主仓+两 worktree）；3186/3499/3187 全释放；宿主 porcelain=0（复验）+ 三 run L-PRISTINE 记录；:3080 仅 401 只读探针（本审查独立探针=401，三 run L-STABLE before/after=401）。
- token 扫描：提交树内 `token=<raw>`、`Bearer <raw>`、`dsh-auth-<raw>`、api-key 形态全部 0 命中；通用 `=<REDACTED>` 模式在已提交物中未触发（无匹配秘密，非缺陷）。

## 非阻塞观察
1. runner 世界命名硬编码 `a5live-<phase>-<stamp>`（审查 brief 期望 `a5livrev-*`）；审查方未改脚本，复跑世界按脚本命名且已随 teardown 删除，零残留。
2. 首次复跑因 harness 作业回收被中途杀（README「runner limitation」场景实例）；审查方按脚本披露的收口纪律手工脱敏+删除 raw 后重跑成功。
3. 12+ 早期失败 run 目录保留并各自记录一条 Measured Host fact，与 README 披露一致；其日志均已脱敏。
4. G-7 `verifiedNow=true`（run 末 rebind 已恢复 verified）与判据所用 `verifiedFalseObserved`（call-edge 时刻）语义有别，代码/判据未混用——阅读时注意。

## 结论
三 run 证据原文与活体读取机制一致、可复现、措辞合规、脱敏收口干净：**证据可采信**。G-g 行收口与 ENFORCE 等级提升仍属 Gate 动作，不在本审查裁决内。
