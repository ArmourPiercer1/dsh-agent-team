# C-12 L1 startup-self-prove — bounded PoC (启动自证, isolated synthetic world)

- 轮次 = `alpha5-c12-l1`；writer = qwen3.8-flash-next（liveness 首报）；branch `alpha5-c12-l1-poc` @ base `origin/master 148c3f49`（fetch 亲验），一次性 worktree `.worktrees/a5-l1`（创建前亲验不存在）。
- 议题 = `evidence/alpha5/C12-decision-brief.md` §2-L1 的**未在册前置问题**："合成 change 在 pinned Host（0.2.0-rc.2 @`639ed01539`）可否零副作用触发"。本 PoC 只回答这个问题 + 启动时点健康的外推性反例，**不改矩阵/产品代码/已验收语义**（G-a 裁决、G-6/G-7 判据、lint 禁则原样）。
- 环境：Host = 宿主升级轮记录的 **pinned pristine 0.2.0-rc.2 构建树**（`.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use` @`639ed01539`，porcelain 0，运行前后亲验；与 live 轮同法只读复用）。lane 工件 = 本 worktree **committed dist**（`packages/runtime/dist/packages/runtime/tool-dispatch/install.js`，经与生产 glue 相同的 public barrel）。端口 3182（启动前自证空闲）+ mock 3491；世界 `tests/homes/a5l1-<stamp>`（TEARDOWN 已删）；`:3080` 全程只读探测（401→401）。
- 纪律：一个已订阅静默通道场景、一条 run、RED-first 判据先落码；launch token capture 时脱敏（`REDACTED-<sha8>`），raw instance log 脱敏后删除，证据树 grep 无 token 残留。

## Files

| file | role |
| --- | --- |
| [`l1-selfproof-row.mjs`](./l1-selfproof-row.mjs) | plain plugin row，经 **public profile-patch seam**（`profiles/web/cordis.patch.yml`）挂载；在真实 session Agent 上装 PR1 guard（wrapped `on` = G-7 forwarder 形态，条目驻留 Host 真实 listener 表），驱动/观测三条 leg |
| [`run-l1-poc.mjs`](./run-l1-poc.mjs) | runner：boot :3182 → 真实 session（mock model）→ assemble → leg① 同名 no-op 重注册（公开 change face）→ leg② armed→proven 自证 → leg③ 启动后按 G-7 swallow 移法（forwarder 停转发，disposer 从不调用）制造后续丢失 → 判据全从 LIVE route 读计算 |
| `receipt.json` | 三判据 verdict 汇总（由最后一次 GREEN run 生成，机器写） |
| `runs/l1-2026-10-17T05-08-04Z/` | **RED-first 实录**：22/23——C33 当时按 G-7 五件套（shape A）预设，实测为 shape B（见下），RED 保留不掩 |
| `runs/l1-2026-10-17T05-10-31Z/` · `05-12-14Z` · `05-13-32Z` | 修正后 GREEN 复跑 ×3（23/23）；`05-13-32Z` = receipt 对应 run。每目录含 criteria.json / live-state.json（事件原文）/ live-journal.json / world-deltas.json / loud-shape.json / ports.json / instance.log（脱敏） |

## 三判据结果（final run 23/23，全部 LIVE 读数）

**① 同名 no-op 重注册（公开 change face）→ 真实 change 事件 + 零副作用 — PROVEN。**
公开面上的合法替换 = disposer + re-register（本 Host 同名同 scope 覆盖 THROWS，live 轮在册事实，本轮复核）。事件**真实发射**：guard-forwarded lane 与 row-owned control subscription 各收 2 条；**新测 Host 事实：`tools/change` 发射只有一个参数且值为 `undefined`（payload-less signal）**——"事件原文"即此（原文捕获，未加工）。零副作用：世界文件增量 0（对照窗口 = 等长无操作窗口先记噪声基线，projcache 落盘在对照窗出现、操作窗净 0）；执行侧台账增量 0（alarm/abort/cancel/drift/call 行 0、body 0 次、pendingCalls 0；admission 台账此臂 N/A，披露）；监听端口增量 0（对照窗亦 0）。

**② 启动自证 = 订阅在场 + 合成投递到达 — PROVEN。**
装配即 `subAttempted=true`（wrapped face 被 install 取用）且 `changeChannelStatus()`=`armed`；首条合成投递后 LIVE 读 `handle.changeChannelStatus()`=**`proven`**（= kit RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY 的 live 版）。receipt.json 机器记录。

**③ 反例：启动证明通过后按 G-7 swallow 移法制造后续丢失 → 启动时点健康不外推 — PROVEN。**
证明通过后 forwarder 停转发（条目仍在真实表、install 收到的 disposer 从不调用），再同名带漂移重注册：control `2→4`（registry 真实发射）、lane deliveries `2→2`（**后续投递丢失实测成立**，absorbed 0→2），而 `changeChannelStatus()` **仍读 `proven`（STALE）**；随后模型驱动调用该漂移名：**shape B**——door 以 `re-bind required` 拒绝（1 次、body 零执行、bindingRevised(verified=false) +1），abortIssued +0 / cancelledBeforeBody +0（定向取消对丢失通道全盲）。shape B 与 G-7 shape A（blind-from-start→body 实跑+五件套）的机制差异在册：①的交付让 door 的定义缓存保持新鲜，drift 因此在 door 被拒而非跑响后告警——**两次 GREEN 复跑均实测 shape B**，shape 由 loud-shape.json 记录、不预设。

## 一句「L1 可证到什么程度」

**L1 在 pinned Host 上可证到：同名 no-op 重注册零副作用地真实发射 change（前提成立、启动前可检子集非空）且合成投递能把 armed 翻成 proven——但该 proven 只是启动时点快照：证明之后通道被静默（disposer 不碰、真实表条目保留）时 proven 依旧亮、定向取消对后续漂移全盲，故 L1 只能作为"启动前可检子集确实可检"的门槛，不能兑换成任何"后续投递/取消生效"的持续保证。**

## 在册披露

1. RED-first：C33 初版预设 G-7 shape A，首 run 实测 shape B 记 RED（run 05-08-04Z 保留）；修正后的 C33 断言"反例核心（投递丢失+proof 过时+取消全盲）+ 后果形状记录不预设"。
2. 本 PoC 的 trusted 输入（row-owned names/identities）= fixture-grade（与 live 轮同限），证据等级上限 LIVE-CONFIRMED/ENFORCE-PARTIAL；不发放任何验收计分。
3. 宿主 checkout 留痕：共享 `tests/deepseek-harness-test-use` 曾被本 session 临时 detach 至 master pin（639ed01539，构建因 pnpm store 在沙箱外失败 [ERR_SQLITE_ERROR]，未成任何写入），**已复原至发现状态 46a7f68b09、porcelain 0**；本 PoC 实际使用的是升级轮既有构建树（只读复用，前后 HEAD/porcelain 亲验未动）。
4. 环境注记：`tests/paths.mjs` pin 与根 checkout 实际构建态在本环境存在代差（根 lib 构建于 0.1.7 时代）——非本轮引入，在册供环境维护参考。
5. 收口三件套：`a5l1-*` 世界 0 残留（含 --keep 试验世界的手工清扫留痕）· 3182/349x 端口释放 · `:3080` 仅只读 401 探测；token 无残留、raw log 0 个。

**裁决前口径不变**：本文件不构成 C-12 任何一选项的裁决，也不改变 G-g 行现行措辞；L1 是否升格为验收要求仍走 §3(b) 用户裁决（`C12-decision-brief.md`）。
