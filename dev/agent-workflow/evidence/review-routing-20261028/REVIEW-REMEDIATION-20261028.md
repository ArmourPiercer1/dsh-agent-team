# Review remediation ledger — 2026-10-28（接管轮审查派生，未入当期 PR 范围）

登记规则：审查发现中不属于当期 PR 范围的整改项在此登记（来源审查报告同目录）。
"何时可做"列记录时序约束——**冻结候选 `5d0c8ff58`（phase-3 boot lane，PR #432）存续期间，
`tests/world-factory/**`、各 leg runner 与判据代码一律不动**（runner/World 执行模块变更会按
`u7-g4i-20261028/DEPENDENCY-EQUIVALENCE.md` 包络使在途记录失效，见 RULING-B-G4R-3 输入 3）。

| ID | 严重度 | 位置 | 问题 | 来源 | 何时可做 |
| --- | --- | --- | --- | --- | --- |
| F-1 | P2 | `dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs:137-154` | 未知/拼错的 CLI flag 被静默丢弃；`given===0` 时回落到 CLOSED lane 账本 + budget 7——即 `:160`/`:27` 声称不可能的路径。实测 `--bogus` 通过 argv 解析进入 `main()`；未知 argv 无测试覆盖。建议：拒绝未知 argv | R428-RETRO-og.md | phase-3 冻结解除后（改 runner 搅动候选） |
| F-2 | P2 | 同上 `:341-357, 617-620` | 预算耗尽异常发生在 world+mock 创建之后且 `main()` 无 teardown：泄漏 world 目录/mock、FATAL exit 1、无 record/verdict。建议：`declareBoot` 的拒绝前移到 `createWorld`/`startMock` 之前 + try/finally teardown | R428-RETRO-og.md | 同 F-1 |
| F-3 | P3 | 同上 `:98-106` | CLOSED-lane 守卫仅词法（无 `realpathSync`），仓内符号链接可穿过（缓解：closed 账本已满 7/7） | R428-RETRO-og.md | 同 F-1 |
| F-4 | P3 | 同上（文档面） | seam 三 flag 只在代码注释披露，无 prose 文档 | R428-RETRO-og.md | 随时（纯文档） |
| OG-1 | P2 | `tests/world-factory/lib/u5-suites/070-u7-f-web.mjs:309-338` | web 腿仍可在无 probe 记录、无 typed refusal 时判 ENV_BLOCK；全局口径的规则文本只在 native 腿强制（`nativeConfinementEnvBlock`）。建议：规则文本显式限定 native 腿，或 web 腿并入合取门 | R429-RETRO-og.md | 判据变更 ⇒ 单独 PR + ≥R2 审查，phase-3 冻结解除后 |
| OG-2 | P3 | `host-sandbox-assets.mjs` present 路径 | 即 NEW-1：`present` 只校验 digest 不校验钉住的 mode；digest 对而 mode 漂移（0600）的在盘启动器被静默接受（记 ENV_BLOCK 非 MODE 违规） | R429-RETRO-og.md；GATE-LEDGER NEW-1 | 同 F-1 |
| OG-3 | P3 | `u5-canary-runner.mjs:982/1051` | 持久化的 `bindings.sandboxPreflight` 依赖 `--run-record`（判定用活体对象，无判定风险；证据完整性问题） | R429-RETRO-og.md | 同 F-1 |
| OG-4 | P3 | `host-sandbox-assets.mjs:418` | `SOURCE_IS_DESTINATION` 在源树 import 校验之后才抛（有界，同树） | R429-RETRO-og.md | 同 F-1 |
| R-G4R-3 | G5 前置 | `scripts/eb3-tool-acceptance.mjs:331-333` | 只校验被引 case verdict、从不看 `record.overall`；95 PROVEN 单元引用 11 份记录恰 1 份 `overall: REFUSED`（`u7-f-agentA-20261026/c2/run-u7fa5.json`，其被引 case 本身 PASS），牵动 3 行。收紧 = RED-first + 新 typed code `ACCEPT_PROVEN_RECORD_NOT_PASS`；不把 3 行降为 NOT_VERIFIED、不改那份记录（REFUSED 是真事实） | GATE-LEDGER R-G4R-3；范围实测见接管轮记录 | G5 前置，单独 PR；`scripts/**` 判据文件 ⇒ 同样排在 phase-3 冻结解除后 |
| R-413-1 | P2 | `u7-agentstate-fs-store-c1.test.ts` 竞态腿 | 墙钟依赖 → 门控/假时钟 | PR #413 审查 | **必须排在 phase-3 冻结解除后**（触及 `packages/**` 搅动候选） |
| RV-406 | P3（处置待定）| `.artifacts/recovered/u7-406-review-r1-REVIEW-unlanded.md`（自 `rv-406` 未 push commit 抢救，109 行 PASS-WITH-FINDINGS） | 从未入库的 #406 安全审查：单独 evidence PR 落地，或显式标注被后续审查取代——不得静默丢弃 | 接管轮核验 | 随时（纯证据 PR） |
