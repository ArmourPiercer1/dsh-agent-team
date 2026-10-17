# review-W5 — W5 tools-wiring LIVE round（独立 reviewer 裁决）

- **Reviewer**：W5 独立 reviewer（qwen3.8-flash-next；≠ writer 会话）
- **受审**：`alpha5-wire-pr5 @ 826790a2`（base `62cc2b87`），一次性 worktree `.worktrees/a5w5`（ff、审中只读）
- **裁决：通过（PASS）**，附 2 条 MINOR 记录性注记（文档措辞级，不阻塞、不构成补充内容）

## 0. 零生产面（亲验）

`git diff --name-status 62cc2b87..826790a2` = **48 文件、全部 `A`、全部位于 `dev/agent-workflow/evidence/alpha5/wiring/w5/`**；packages/、scripts/、根 vitest.config、宿主树零触（IF-5）。每 run 自带 L-W5-IF5/L-W5-PIN 判据，本审复跑中再次为真（宿主 `@639ed01539` porcelain=0，HEAD 未动）。

## ① 34 判据真钉 — 成立

- runner 判据全部由 LIVE route 读回 + runner 亲读盘 + mock 侧真实 HTTP 流量计算（`run-w5-live.mjs:349-444`）；缺腿即 FAIL、无回填；`check()` 仅记录不合成。
- **RED(ungated) 25/34**：9 条红腿 = {GUARD, E2E-SEARCH, E2E-BASH, SPILL-POINTER, ONESHOT, OVERPRIV, DENY-ZERO, UNBOUND, PARITY-SEARCH}，恰为门控承载腿；lane-law 腿（spill 生命周期、六事件、shell parity、pristine）在 RED 下照样绿——门承载拒绝的对照结构成立。**本审独立复跑 ungated：25/34，红腿集合与提交版逐条相同。**
- **GREEN 非同义反复**：LIFE/事件族确由 row 内 lane 真模块图驱动（spill 落真盘、拒绝带 master 原文 typed code）；E2E/TRANSCRIPT 证据面来自 host→model 真实请求里的 tool_result 与 runner 直读 spill 文件字节，非 row 自报闭环。
- **本审独立复跑（环境=宿主 `@639ed01539` pinned + `build-lane-esm.mjs`（1.1s 重建）+ README usage；端口 3183/3493 先 `ss` 自证空闲）——8+ 条重点全复现**：
  - 全量 gated 复跑 **GREEN 34/34**：GUARD{channelAtPublish=armed, channel=proven}、ONESHOT（grant `4f84b009…` 首耗 ok、重放 typed `APPROVAL_STALE/grant-consumed`、consumed=1/1）、SPILL-POINTER（disk=18893=pointer.bytes）、LIFE-IDINUSE（typed `spill-id-in-use`、writePortDelta=0）、EVENTS6-STREAM（begin=7/end=5/refused=2、settlement-six=0、guard-denial=2）、DENY-ZERO(0/0)、UNBOUND(probeBodyCount=0)、PARITY-SEARCH(297/297)。
  - **微驱动 20 断言（不 import row/fixtures，直接 compiled lane + committed dist）**：spill open/ACTIVE-write/read-deny 零读增量/write-after-close/**id-in-use 重放（先拒后端口、payload+meta 逐字节不变）**/fresh-handle residue（law 3）；六名逐名 accepted + 退役短形 `spill-settlement-event-unknown`；**grant-consumed 全程直驱 PR2 kernel**：admit→admitted→consume ok→重放拒 `grant-consumed`→ledger consumed=1。20/20。
  - 附带发现（reviewer 侧，供后续 ENFORCE 线参考，不构成缺陷）：若 fs port 的 `exists` 说谎，id-in-use 判定随 trusted-input 失真——与 README 已披露的 fixture-grade 口径一致（ENFORCE 属 W4）。

## ② parity 表可信 — 成立

`parity.json` 存 **完整 64-hex sha（len 71 含前缀）**，判据为全串等值比较（runner:430/432），README 表格截断仅展示。grep 腿三源一致：runner 直读 spill 盘上字节 sha == raw 腿 stdout sha == backend 自报 sha（297B）。denied 腿链条完整：`stage=requires-approval` + grant=null + presented=null + **exec delta=0**（OVERPRIV 判据）+ **spillFilesDelta=0**（readdir 前后计数）+ payloadBytes=0；RED 对照 154B 被呈现，证明该 0 是测出来的非默认值。

## ③ 模型驱动真经 dispatch — 成立

mock 十请求序列（两次复跑一致）：text×2 → search → bash×3 → search(outside) → probe×2 → DONE；tool_result 由宿主回灌进真实 `/api/session/prompt` 请求体（seenUnion 取自真实入站请求）。对账：census `guard-denial=2`（scoped-dispatcher.ts:438 发射）≡ `dispatcher-call-refused=2` ≡ 两次 probe 调用边拒绝 ≡ mock 两次 probe tool-call ≡ transcript 含 closed-world 拒文（与 closed-world-guard.ts:197 逐字一致）≡ `probeBodyCount=0`。begin=7/end=5/refused=2 与 7 次调用账目自洽。

## ④ LIVE-CONFIRMED / ENFORCE / G-g 措辞 — 守线

Level statement 明确 **ENFORCE-CONFIRMED 未达**（三缺项如实，同 PR3 live 轮口径，`live/README.md:60-67` 先例逐条对齐 ALPHA5-ACCEPTANCE-STATUS §⑤）；G-g 行仅验事件名合法性、**对结算通道投递零宣称**。GUARD 的 channel `proven` 是 PR1 tools/change 注册变更通道（非 G-g 结算通道），且 `proven` 语义按 install.ts:397-403 = 本 Host 实际投递过——与 PR3 G-6 已 LIVE-CONFIRMED 的同型观测一致，引用关系已在 README 声明。

## ⑤ 首 gated 32/34 自纠两判据 = 收紧非放松 — 成立（引 master 原文核对）

- **channel 判据**：旧钉法只要求事后 `channel==='armed'`（旧 run observed 实测 `proven` 而 FAIL）；新钉法 = `channelAtPublish==='armed'`（新增发布时刻钉）且事后 ∈{armed,proven}——`proven` 是 master 定义的**更强**投递事实（install.ts:153/397-403/959），钉的事实更多、宇宙更准。
- **census 宇宙**：旧判据"dispatcher-call-* ⊆ 六结算名"对 master 发射面为**假**（scoped-dispatcher.ts:528 begin / 535+559 end / 545 refused；行号在 `452a04c0`（cited pin，已验为 base 祖先）与 base `62cc2b87` 双点核对一致）；`grep` 全 packages/runtime 的 `dispatcher-call-*` 字面量恰为 6+3=9 名，新宇宙=精确发射面。退役短形禁现判据（`/^call-/` 命中=0）与六名逐名计数**保留**，并新增 guard-denial/refused 对账。两判据修正均为纠正误钉 + 加钉，非放松。

## MINOR（记录性，不阻塞）

1. **README:66 "证据树内 0 raw token" 字面过宽**：发射/启动 token 确已全程脱敏（instance.log `REDACTED-<sha8>`，树内无 raw 启动 token）；但 fixture canary `A5W5TOK-<hex12>`（非凭证，世界文件内容）逐字存在于 3 个 run 的 transcript/live-state/mock-capture。建议措辞改指"启动 token"。
2. **L-W5-DENY-ZERO 标签漂移**：README:38 把 exec 增量=0 归入 DENY-ZERO，实测该事实钉在 OVERPRIV 判据（DENY-ZERO 只含 payloadBytes/spillDelta）；事实本身全部成立，仅归属措辞。

## 复跑分布（本审）

- 全量 gated 复跑：34/34 GREEN（新世界、新 token、grant id 独立）；全量 ungated 复跑：25/34，红腿集合与提交版恒等。
- 定向独立复跑 ≥8：GUARD / ONESHOT(grant-consumed) / LIFE-IDINUSE / LIFE-RECHECK / LIFE-CLOSE / EVENTS6-SETTLE / DENY-ZERO / UNBOUND / PARITY-SEARCH / SPILL-POINTER，其中 id-in-use 与 grant-consumed 另经零共享微驱动（20/20）。
- 审毕收口：复跑证据世界/构建目录随一次性 worktree 回收清除；`:3080` 全程仅 401 只读探测；提交仅新增本文件（ff push 同分支）。
