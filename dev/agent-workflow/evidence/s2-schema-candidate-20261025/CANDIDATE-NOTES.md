# CANDIDATE-NOTES — S2 快照 Schema 与发布口候选（round log）

## 轮次与模式

- utc_start: `2026-10-25T02:22:58Z`（date -u 实录，下同）；utc_end: 见 manifest.json `utc_end`。
- 有界 20 分钟；计入现有累计预算（16 Owner-h / 2026-10-25T13:00:00Z 绝对上限不变、未重置）。
- 默认路由 qiyuan-self/qwen3.8-flash-next，创造模式。mode: host 0 / paid 0 / subagents 0 / clone 0 / install 0 / CI或Host运行 0 / checkout|reset|worktree 0 / merge 0 / push 0 / permission_escalation 0 / authority_switch 0 / router|graph|plans|AGENTS 写 0。
- 唯一写入面：`dev/agent-workflow/evidence/s2-schema-candidate-20261025/`（本轮新建）。交付 hash 前目录内迭代允许；最终 hash 入 manifest 后本版本冻结，再改另立版本目录。

## 亲读输入（先读后写）

1. `s2-authority-map-20261025/`：AUTHORITY-MIGRATION-MAP.json（全文）+ MACHINE-CONSUMERS.json（全文）+ ERRATA-20261025.json（唯一 ERRATA，全文）。ERRATA 效力已吸收：E1（GENERATED_FILES 扩展非预授权；docs:sync 只写派生物）、E2（REQ-EB-0003 proposed-not-ratified ≠ 迁移无权；G2/G3 为 observation 非 defect）、E3（物理母仓 `6259cf4b…` ≠ git target，工作树不作当前权威）。
2. `s1-f0-issued-20261025/`：F0-ISSUED-20261025.json + G1-GATE-DECISION.json 全文。inputSnapshotDigest 本轮独立复算：按 F0 canonical 规则对纯 inputs 对象得 4285B、零 0x0A、`sha256:ed3c2cfb50e444622c36a0bc6f508aeb9e8e6202ce65cb569b16f838b92319a4` —— 与 F0/Gate 内嵌声明逐字节一致。G1 裁决读得：G1-I PASS / G1-F NOT_PASSED / overall PARTIAL；解锁范围 = S2 文档与工程治理工作（无未证安全依赖）。
3. 固定 ref（仅 git show/grep/cat-file，全部解析成功且为 commit）：`4aaaa7b2…`（origin/master）、`1310b959…`（PR363）、`b97ffdaf…`（PR361）。§7.4 原文取自 PR363 固定 blob `66a540b9…` :141-147；PR361 memo grep 无 publisher/snapshot 字样（发布口形态来自本轮工程默认选择，非 PR361 既有文本）。
4. step-2 工程面固定 ref 亲读：`dev/engineering/registry.yaml`（legacy_execution_authority / migration_of_legacy_consumers 头 9 行 + 条目形态）、`dev/engineering/registry.schema.json`（含 x-generated-view-mirror 注记）、`scripts/generated-write.mjs`（全文）、`scripts/docs-sync.mjs`（:1-60、:135-160）、`scripts/gen-current-state.mjs`（:49 LEGACY_MIRROR_KEYS、:289-310 readLegacyAuthority、:321-350 checkLegacyMirror）、`dev/agent-workflow/graph.yaml`（:58-100：current_phase :64 / current_contract :91 / 六字段 :92-97）、`scripts/ci-pr-gate.mjs`（:283-345 checkCurrentContract 头部至 Q1 全句）。

## current_phase vs phase_id（独立实测，与 Map 一致并补充到表达式级）

`pm = /^alpha(\d+)/i.exec(phase_id)` 后仅要求 current_phase 句中出现 `ALPHA\.?<N>`（ci-pr-gate.mjs:343-345）——位数一致检查，非字符串相等；另受 Alpha.4 禁用（:343）与 revision/PR-census 禁用（:186-195）约束；Q3 要求顶层恰一处（:318）。schema 因此把 current_phase_statement 设为可选、禁式入 schema、位数一致归 publisher 侧。

## 交付物与校验

| 文件 | 内容 | 校验（本轮实际执行） |
|---|---|---|
| AUTHORITY-SNAPSHOT.schema.json | 唯一最小候选：版本链 + authored_from + 唯一 publisher + 六字段原语义 + content_digest；外部现实检核全部显式声明为 publisher/CI 职责 | draft-07；本地既有 ajv@8.20.0（pnpm store，零安装）编译通过 |
| snapshot-example.json | 唯一正例：六值 = 固定 master graph.yaml:92-97 记录值；content_digest 按 F0 canonical 规则计算 | ajv 正例 valid=true；落盘后 digest 独立复算一致；三条 current_phase 禁式 0 命中；位数一致真 |
| PUBLISHER-CONTRACT.md | 短契约：工程默认选择 / 唯一 source·作者·输入输出 / docs:sync 派生物边界 / 双读诊断清单 / 切换·回退前置（逐条可核） / 不做的事 | 引用行号全部出自本轮固定 ref 亲读 |
| manifest.json | sha256+bytes+起止时间 | 生成时计算 |

负控预演（本地内存 fixture，非新测试文件、未入 CI）：缺 matrix、坏 phase_id、第 7 字段、坏 snapshot_version → 4/4 被拒。真实 CI 负控属 §7.4 step 5，须待 schema 冻结与 fixture 扩到 6/6 后做，本轮不做。

## 具名缺口（本轮明确不闭，交 root 审查裁决）

1. 当前指针载体二选一（registry.yaml 标量 vs 单行指针文件）未定——step-2 冻结时定。
2. `GENERATED_FILES` 是否为 snapshot 落位扩展未定（ERRATA E1：非预授权）。
3. schema 的 draft-07 引擎校验仅本地一次性；仓库无通用 JSON-Schema CI 依赖，冻结后是否需要引入执行器属实现决定（本轮 0 install）。
4. current_phase 退役/改写/保留仍开放（Map adjacent_live_statement 原样成立）。
5. 双读所需的 info.contract 4/6 露出与 fixture 3/6 表达力（Map G2/G3，ERRATA 定性 observation）在切换负控前必须处置，归 step 5 工作包。
6. snapshot 与 registry.yaml `current_authority_snapshot` 若成对出现，checkSchemaAgreement/registry 校验器需同步认识新键，属实现轮。

## 不变声明

候选 ≠ 冻结；18 IDs 仍 proposed（0 ratified）；93 seeds 状态不变；未写 router/三计划/AGENTS/graph/current/旧 Map/F0/其他包；未切入口；未改 CI/product/Host；G2 不宣称、任何 Gate 不宣称。
