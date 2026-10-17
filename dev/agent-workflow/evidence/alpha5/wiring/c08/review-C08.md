# review-C08 — 独立 reviewer 对 alpha5-gap-c08 @ ce1085ed（矩阵行 M-05 read_image）

- reviewer = C-08（qwen3.8-flash-next，独立一次性会话，≠ 实现会话 74e449db）
- 受审 = 分支 `alpha5-gap-c08` @ `ce1085ed06b2e1d689bffa18d92789dbd38eff17`（base = origin/master `aece4f21`）
- 复跑环境 = reviewer 一次性 worktree（`.worktrees/a5c08-rev-c08` @ ce1085ed）；port **3186** 自证空闲（node net bind 亲验 + `ss` 交叉）；世界 `tests/homes/a5c08-rev-*`（跑毕即删，tests/homes 现空）；宿主 = 共享 pristine `tests/deepseek-harness-test-use` @639ed01539（porcelain 0，只读复用）；:3080 仅只读探针（401/401 不变，复跑前后 curl 亲验）
- 裁决 = **通过**

## ① M-05 TRANSITIONED-LIVE 证据强度 — 5 判据抽验复跑（全部独立复现）

reviewer 亲自跑 kit（非引用在册日志）：

1. **PNG base64 解码 sha==磁盘**：reviewer gated 复跑 `gated-2026-10-17T04-48-41Z` → `decoded_sha_matches_disk=true`、decode 1×1；且 reviewer 独立从 kit 内 base64 常量重算 sha256 == run 亲测磁盘 attach/shot.png sha（`c414cd0e204…`）——判据非同义反复；呈报串（`decoded_sha=sha256:c414cd0e204…`）进真实 transcript 在册。
2. **缩略图旁路 open 前拒**：`negative_controls[thumbnail-read-bypass]` = typed-deny、`cf_reason=effect-outside-grant`、`deny_stage=before-open (readViaRef/admit: effectCovers)`、`bytes_leaked=0`、lane 台账 `refused:` 行在册（c08-thumb-2）、thumb 盘上 sha 全程未动。
3. **admission-unbound 逐字 bytes=0**：`negative_controls[unbound-image-read]` = `recheck_reason=admission-unbound` 逐字（并如实二分：frozen cfReason 承载位=effect-outside-grant，不声称 frozen 码=该名）、`bytes_leaked=0`、台账拒行（c08-unbound-3）、逐字进 transcript（`A5C08-REFUSED … admission-unbound`）。
4. **grant-consumed 二读拒**：同调用第二次 readText `{ok:false, code:'grant-consumed'}`、`ledger_consumed=1`、acted 调用 lane 台账 `fd-closed` 行=1（恰一）。
5. **RED 18/23 且红腿恰=5 门控腿**：reviewer ungated 复跑 `ungated-2026-10-17T04-48-28Z` RED 18/23 exit=2，FAIL 集恰 = {GUARD, CHAIN, ONESHOT, THUMB-DENY, UNBOUND-DENY}（与在册逐条同）；ungated native read_image 真实解码往返（『1x1 px, 70 bytes』进 transcript）且治理观测 delta=0——红由门承载、非文字。
- 附带复验：census gated=15 全前缀名/ungated={}；IF-5 前后 porcelain 空；宿主 pristine 前后 porcelain 0；世界即删；token 捕获即脱敏（instance.log 仅 `REDACTED-<sha8>`，raw log 不在册，无 ≥16 位裸 token）。

## ② LIVE 宣称与『生产 read_image 治理实现仍=0』并存 — 措辞诚实，三处无升格

- **矩阵行**（机检 `matrix-machine.json` M-05）：`transition_record.basis` 显式含『row 工具为 row-local fixture（生产 read_image 治理实现仍=0，C-05 差距行在册不隐藏）』+『LIVE=转态提案值，终裁归 PR8 正式轮+独立 reviewer』；`acceptance_scope=criterion-level-fixture` 不变；文档矩阵行仅 `status_now` 一词改，`current_status=s0-candidate-impl-pending`/`known_partial`/`final_declaration=null` 全不动。
- **receipt**：caliber=『LIVE-kit 观测 only』；`not_observed[0]`=生产 read_image 治理实现=0 明文；`plan_vs_repo_lines.repo`=『治理消费实现 0（C-05 在册）——本回合闭的是观测面，不是生产 read_image』；宿主原生两面实测（gated 调用边『unreadable at the public seam』逐字拒 delta=3【reviewer 复跑 transcript 亲见】/ungated delta=0）如实入册、不冒充替换。
- **README**：披露#2 明文『生产 read_image 治理实现仍=0（C-05 不隐藏）』；#5 criterion-level-fixture 不构成行验收/整链/SUPPORTED。
- runner 尾部反升格声明在册。三处一致=LIVE 语义严格限定为 kit 装配面 chain，未见任何『上架/生产实现/整链验收』升格词。

## ③ utf8-fidelity=false 披露与 base64 形态一致性 — 一致

- receipt `attachment_form_note`：utf8-fidelity=false、lane_bytes=94 vs disk_bytes=70；reviewer 复跑 binary-probe 实测同值（94/70/false）。70B PNG→96 字符 base64（数学一致；ungated 缩略图直读 96 字节相符）。
- 链腿走 `.b64` 附件形态（base64 文本面字节精确存活，decode 后 sha==磁盘 PNG 亲验），binary 腿用原始 PNG 实测文本面失真——两腿形态与披露互洽，无『原始二进制冒充字节精确』。

## ④ 矩阵只动 M-05 行 — 亲验 diff 通过

- 机检矩阵：两 hunk 均在 M-05 行内（上 hunk `status_now`，下 hunk `transition_record`+`note`，止于 `"row_id": "M-06"` 前）；无其它 row_id 触碰。
- 文档矩阵：恰好一行（M-05 `status_now` TRANSITIONED-PROBE-GATED→TRANSITIONED-LIVE）。
- M-04/M-08/M-09/M-13 保持 PROBE-GATED（runner 复跑 PG=4 印证，无隐性升格）。

## ⑤ runner 复跑 — 27/0/0/LIVE=1/PG=4 复现

- reviewer worktree 首跑 = 24/0/3（M-06/M-11/SUP-08 环境钩缺 `tests/deepseek-harness-test-use` 构建态 ⇒ 按设计 fail-closed NOT_RUN，拒伪造 PASS——该行为本身是诚实性证据）；按 TEST_METHODS §2 供给共享 @639ed01539 pristine 运行时（porcelain 0）后复跑 = **PASS=27 FAIL=0 NOT_RUN=0 LIVE=1 PROBE-GATED=4 TOTAL=32 exit 0**，与在册一致；结构 lint OK；对照臂 ghost-anchor FAIL 如实捕获。
- probe-M-05 复跑 exit=0 VERDICT LIVE（装配面行形 grep 亲验 + 14 项 evidence_refs 逐项存在性亲验）。

## 发现（均不阻断）

- **F-1（证据卫生/披露，minor）**：commit 在册三跑目录，其中 `runs/ungated-2026-10-17T04-40-17Z/`（未被 README/receipt 引用）含第 6 条红腿 `L-C08-BYTES-INTACT`，且其 `criteria.json`（pass=false）与同目录 `world-files.json`（三 sha 全等期望）互斥——committed 代码不可能产生该矛盾 ⇒ 该目录系中途版本 kit 代码的陈旧产物，随轮入库未加注记。方向保守（多一条红），不构成升格或证据粉饰；建议 PR8 正式轮删除或加一行注记，防后续读者误读。
- **F-2（快照文档漂移，minor）**：文档矩阵 M-05 `pending_probe.note` 仍留 W8-prep 旧句『当前无装配运行即 NOT-RUN-READY』、`vnext-migration-gap-checklist.md` M-05 行仍记 TRANSITIONED-PROBE-GATED——均为低报方向（非升格），权威机检矩阵为准；PR8 正式轮顺手对齐。
- **F-3（复现口径注记）**：runner 三行环境钩要求运行 worktree 内有构建态 test-use 运行时；全新 worktree 未供给时 24/0/3 为设计语义。后续 reviewer 请按 §2 链供给后复跑（reviewer 已实证 27/0/0）。

## 裁决

**通过**。M-05 行级 `TRANSITIONED-LIVE` 作为提案值证据充分：五条抽验判据全部在 reviewer 独立一次性 worktree 真跑复现（含红腿恒等），负控为 lane 自身词汇的实测拒行而非文字，措辞三处一致无升格，矩阵触碰面恰=M-05 行，runner/probe 复跑逐项一致。终裁归 PR8 正式轮（本裁决不代替之）；F-1/F-2 建议随 PR8 正式轮处置。
