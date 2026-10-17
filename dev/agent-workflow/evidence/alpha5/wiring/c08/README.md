# wiring/c08 — C-08 gap-writer kit（M-05 read_image 缺腿装配；branch alpha5-gap-c08）

基线 = origin/master `aece4f21`；宿主 = `tests/deepseek-harness-test-use` @639ed01539（0.2.0-rc.2，只读复用，porcelain 0 前后）；port **3186**（自证空闲）；world `tests/homes/a5c08-*`（跑毕即删）；:3080 全程只读探针（401/401 不变）。

## 复现

```
node dev/agent-workflow/evidence/alpha5/wiring/c08/run-c08-live.mjs --mode ungated --port 3186   # RED-first（预期红且仅红门控腿）
node dev/agent-workflow/evidence/alpha5/wiring/c08/run-c08-live.mjs --mode gated   --port 3186   # 目标全绿
node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-05.mjs                                 # 行级裁决（exit 0=LIVE）
```

## 文件

| 文件 | 作用 |
| --- | --- |
| `a5c08-fixtures.mjs` | 装配面基件（复用 W-E2 kit 形制不重造：PR2 kernel fixture  harness、admitCall/execEdgeConsume、canonicalParamsFingerprint；新增：read 资源效应 effectsForRead、attach/thumb 世界构建（真 1×1 PNG + base64 附件）、`makeGatedFs`（PR3 `createAdmissionGatedControlledFs` 唯一正门 + UNBOUND 面对照）、PNG 解码器、`hostDirectRead`（仅 ungated RED 面） |
| `a5c08-image-row.mjs` | 装配 row（公开 profile-patch seam 挂载）：4 个 row-local fixture 工具（image_read/thumb_probe/unbound_read/binary_probe）；gated=PR1 guard install→bindOwnTools→publish→每调用 PR2 admit（tool-invoke + attach 目录 read 资源效应）→逐调用 admission-bound lane readText（exec-time recheck 回问 kernel=exec-edge ONE-SHOT）→base64/PNG 解码→呈报真实 transcript；负控走同一门面板：缩略图目标=效应外 open 前类型拒；未绑定面=law-1 具名拒；同调用二读=grant-consumed |
| `run-c08-live.mjs` | 真跑 runner（23 判据，RED-first 双模式，token 捕获即脱敏 `REDACTED-<sha8>`，世界即删，宿主 porcelain 前后亲验） |
| `runs/ungated-2026-10-17T04-40-41Z/` | RED 对照：**18/23，红=GUARD/CHAIN/ONESHOT/THUMB-DENY/UNBOUND-DENY——恰好且仅有门承载的 5 腿**；native read_image ungated 真实解码往返（治理 delta=0） |
| `runs/gated-2026-10-17T04-40-50Z/` | GREEN：**23/23**（chain-table/负控三条/二进制保真度事实/native 腿 delta=3 逐字在册） |
| `C08-RED-UNGATED.log` / `C08-GATED-GREEN.log` | 两轮 stdout 全录 |

## 结果（如实）

- **probe-M-05 真跑 exit=0 → VERDICT LIVE**（A1 链=admission-gated-controlled-fs；A2 缩略图旁路 typed-deny；A3 admission-unbound bytes_leaked=0；A4 任意树常量 runtime 实读 false；锚点 runner 亲验；evidence_refs 14 项逐项存在）。日志 `pr8/probes/runs/c08-post-M-05.log`。
- **M-05 行终态 = TRANSITIONED-LIVE**（提案值，终裁归 PR8 正式轮+独立 reviewer；机检矩阵 + 文档矩阵 status_now 已同步）。
- **runner 复跑**：`PASS=27 FAIL=0 NOT_RUN=0 LIVE=1 PROBE-GATED=4 TOTAL=32` exit 0（27 基线不动——M-05 从 PG 池升入 LIVE；本分支 M-13 仍 PROBE-GATED：W-E2 分支未合并，非退化）。
- 矩阵 diff 严格限于 M-05 行（`git diff` 无其它 row_id 触碰）。

## 披露（不隐藏）

1. **派工单行号错位**（已在回合早期上报 parent）：派工单称『Domain mock CAS/联锁/veto 三腿』——该三腿在册 **M-13**（Domain，W-E2 已装配，其 README 披露#4 同此）；**M-05=read_image**。本 kit 按派工单字面口径执行：只动 M-05 行、闭 M-05 三条在册缺腿，不碰 M-13 行矩阵、不碰 jobs 面。
2. row 工具（`a5c08_*`）= **row-local fixture 工具**（装配观测面），非生产 read_image 实现宣称；生产 read_image 治理实现仍=0（C-05 差距行在册）。宿主原生 read_image 两面实测=公开 seam 不可钉（gated=guard 调用边『unreadable at the public seam』逐字拒、delta=3；ungated=真实往返、delta=0——W-E2 事实复验）。
3. C-FS 文本读面对原始二进制 **utf8-fidelity=false**（lane_bytes=94 vs disk_bytes=70，实测入册）：附件链字节精确形态=base64 传输（decode 后 sha==磁盘 PNG 亲验）。
4. 未绑定负控口径如实二分：IF-6 原名 `admission-unbound` 于 recheck reason+诊断逐字在册；frozen cfReason 承载位=effect-outside-grant（不声称 frozen 码=该名）。缩略图负控在 **C-FS 层**观测（open 前类型拒），非 guard 层名。
5. kernel 信任输入 fixture 级（同 W5/W7/W8/W-E2）；policyArms=row 构造的授权事实；acceptance_scope=criterion-level-fixture，不构成行验收/整链/SUPPORTED。

## token / 清理

launch token 捕获即脱敏（`REDACTED-<sha8>`，raw instance log 脱敏后即删）；世界目录跑毕即删（`tests/homes/` 空）；IF-5 共享面（packages/、scripts/、vitest.config.ts）porcelain 空（前后亲验，判据 L-C08-IF5/IF5-POST）。
