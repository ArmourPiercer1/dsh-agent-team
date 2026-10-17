# INTERFACES-v1.1 勘正便条（C-BIND 事件名全前缀）— 供集成 owner 并入 INTERFACES-v1.md

日期：2026-10-17 · 来源：G-d 接线轮（branch `alpha5-int-wiring`，Scope-2 共享 glue writer）· 权威依据：master@fc9f4a07 发射面

INTERFACES-v1.md 的 C-BIND (v1.1) 行目前混写全称与短名（`dispatcher-call-cancelled-before-body`
全称 + `terminated-after-body-start`/`completed-after-abort`/`outcome-unreadable`/
`cancelled-by-others`/`executed-unvalidated` 短名）。**发射面权威 = master
`packages/runtime/tool-dispatch/install.ts`（:651/:662/:673/:686/:763）：六个取消/结算事件名
全部携带 `dispatcher-call-` 前缀**：

- `dispatcher-call-cancelled-before-body`
- `dispatcher-call-terminated-after-body-start`
- `dispatcher-call-completed-after-abort`
- `dispatcher-call-outcome-unreadable`
- `dispatcher-call-cancelled-by-others`
- `dispatcher-call-executed-unvalidated`

已按此权威完成的本轮落地（RED-first，证据 `dev/agent-workflow/evidence/alpha5/wiring/`）：

1. `packages/tools/a5p5-tools/src/spill.ts` `SETTLEMENT_EVENTS` 封闭集六个全前缀名（头部注释
   改引发射面行号）；越集事件改由新增 typed 码 `spill-settlement-event-unknown` 拒（code 与
   语义对齐，Lane D review 附注）；`backend-contract.ts` `UNREADABLE_SETTLEMENT` 同步全名。
2. lane 测试（spill/parity/render-injection）同步全名 + 新增 openSink 复用拒
   （`spill-id-in-use`）与 render outputMode 闭集拒（B3）legs——64/64 GREEN。
3. 语义边界不变：lane 只在 settlement 给定处验名；对该词汇所在通道的投递行为**零宣称**
   （PENDING-GATES G-g 仍 OPEN，本轮不关闭、不引用为已证）。

注：INTERFACES-v1.md 本体在主 checkout（coordinator 持有，非本分支跟踪文件）——本便条即
勘正内容，owner 并入后此便条可归档。
