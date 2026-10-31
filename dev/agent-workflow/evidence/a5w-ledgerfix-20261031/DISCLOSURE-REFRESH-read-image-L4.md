# read_image L4-positive — dated disclosure refresh（本文件 = 台账行 `source` 的披露正本）

**Dated**: 2026-10-31T09:18:53Z（书写时刻 `date -u`，R-CLOCK-1；本 commit 的 dated 锚点以 commit 时刻为准，同日同轮）
**Ledger row**: `dev/agent-workflow/ledgers/u7-tool-acceptance.json` → `read_image` / `L4-positive`（`status: DISCLOSED` 与 `pr: "#390"` 均未动）
**为什么本文件可以是 source**：checker（`scripts/eb3-tool-acceptance.mjs`，`ACCEPT_DISCLOSED_UNSOURCED`）对 DISCLOSED 格的唯一机器约束是 reason 必须逐字（whitespace 归一后）存在于 source 文件内；仓内先例 = `subagent` 家族行 source=`evidence/u7-ac1-subagents-port-20261027/README.md`、`web_search` 行 source=`evidence/u7-f-web-20261026/pr-body.md` —— DISCLOSED 的 source 本就是披露 prose。旧 2026-10-26 run-record 一字未动（见文末 witness 条）。

## 缘由（为什么旧 reason 必须刷新、而 DISCLOSED 仍是正确机器分类）

1. **#390-era 前置已被波次事实推翻**。旧 reason 的因果链是 R1-rung 论：closed admission grammar 对 `domain-ref(attachment-store)` 无 grantable rung → 内核必拒整个 fingerprinted effect set → 该行不提交任何东西。boot 波次 a5w-bootwave（真实 UTC 2026-10-30/31）在真实 Host 上两次独立复现推翻了该前置：批准的正向调用真实执行，attachment 对象真实入仓。
2. **RUN_PROVEN 被诚实规则拒绝**：bw9/bw10 两条记录 `overall=NOT_REACHED`（唯一非绿格 = `ui:live-root-law`，L2-as-is 披露格，非 read_image 义务格），验收规则对 overall 非 PASS 的记录拒绝 RUN 证明（`ACCEPT_PROVEN_NOT_PASS_OVERALL`）。
3. **CASE 证明在 L4 一律被拒**（`ACCEPT_CASE_PROVEN_ON_L4`）。
4. 因此 **DISCLOSED 是正确机器分类**；未尝试任何逃逸（不改绑、不编辑记录、不改规则）。工具能力读数 = 真实 Host 上证据完备；机器分类 = DISCLOSED，等待未来一份 overall 全 PASS 的记录。

## reason 逐字正本

以下 fenced 块 = 台账 `read_image.L4-positive.reason` 的逐字正本（checker 的包含判定对两侧做 whitespace 归一，块外文字不参与）：

```
dated 2026-10-31 refresh: the stale R1-rung cause of the #390 disclosure — the closed admission grammar has NO grantable rung for domain-ref(attachment-store), so the Kernel MUST refuse the fingerprinted effect set and the row commits NOTHING — is overtaken by the boot-wave facts: the live positive arms are proven on a real Host (grant-audit lines observable; exactly one self-named attachment object at 69 B; envelope + image delivered as two blocks; the kernel-admission arm denies with zero effect), so the refusal narrative no longer says why this level is not PROVEN; the machine keeps DISCLOSED because the honest ruleset refuses RUN_PROVEN on a non-PASS-overall record (both boot-wave runs carry overall=NOT_REACHED solely on the ui:live-root-law cell) and refuses CASE proof on L4-positive — no escape is attempted; tool-capability reading = evidence-complete on the real host, machine classification = DISCLOSED pending a future all-PASS overall record
```

## 指针（全部对 record 本体复核过）

- `dev/agent-workflow/evidence/a5w-bootwave-20261030/c2/run-bw9.json` — runId `u5-u7r3-bootwave-bw9-2026-10-31T05-38-21-670Z`，overall `NOT_REACHED`，teamSha `65f54157a07c91320bfc27981b7957d2245ca155`，hostSha `639ed015397290b3745d163aafe02ffee4aa3f84`；六格 `ri:*` 全 PASS，唯一非绿 `ui:live-root-law` = NOT_REACHED。
- `dev/agent-workflow/evidence/a5w-bootwave-20261030/c2/run-bw10.json` — runId `u5-u7r3-bootwave-bw10-2026-10-31T05-39-04-663Z`，overall `NOT_REACHED`，teamSha `95812295b9d178edf8dead7e651a5dddb7ebab0d`，hostSha `639ed015397290b3745d163aafe02ffee4aa3f84`；同一格位结果独立复现（不同 world/run-id/approval-ids）。
- 收据：`dev/agent-workflow/evidence/a5w-bootwave-20261030/c2/L4-RECEIPT-read-image.md`（六格事实表 + 预算授权链 + 边界披露）。
- 工具能力账本翻转：`dev/agent-workflow/gates/U7-R3-GAP-MATRIX-20261029.md` 的 dated 条目「Dated 台账更新（2026-10-31T05:39Z，boot 波次 a5w-bootwave 收束条目；主 Agent 落笔）」（read_image L3/L4 PROVEN = 工具能力读数；机器台账行按本文缘由保持 DISCLOSED）。
- 旧 witness（一字未动）：`dev/agent-workflow/evidence/u7-w0b-20261026/c2/fs-mut/run-record.json` — 其 case `fsm:image-lane-honest` 的 disclosure 字段仍逐字保有着 #390-era 的旧 reason 文本，作为当时 admitted-state 论证的历史见证存续；本刷新为追加，不改史。
