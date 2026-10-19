# FIX-QUEUE — C 路修复队列单（只列单不动码；writer 由协调者派发）

树=d5de7497。R-C-05/06 按 parent 注②转 D 的 OPEN-ITEMS 口径登记；「可做不可需」项已标注。

| id | 项 | 面/文件 | 类型 | 最小步 | 风险 | 处置建议 |
|---|---|---|---|---|---|---|
| R-C-05 | GitHub 标题卫生：#257 以 "DO NOT MERGE" 标题被 squash 合并、标题保留至合并后；#347 同类标题在候批 | GitHub 元数据（非仓内） | 流程卫生 | 无仓内步；后续 PR 合入前标题去 DO-NOT-MERGE 或合并动作本身即授权披露 | ≈0 | **转 D OPEN-ITEMS**（parent 注②） |
| R-C-06 | 授权链双载体记载：squash 消息把中间 BLOCKED 裁决与终局 PASS 同筐（grep "BLOCKED" 误导） | 后续 PR 消息纪律（docs 类） | 文档纪律 | 含历史裁决演进的 squash 消息在中间裁决段加 "SUPERSEDED @<sha>" 标 | ≈0 | **转 D OPEN-ITEMS**（parent 注②） |
| R-C-07 | guard MINOR：`install.ts:989/:999` 两条 post-arm 拒发路径不显式 settle pending-calls 台账（settle 唯一点 :806；实测 leak-free，不变量依赖 result 边必发） | `packages/runtime/tool-dispatch/install.ts` | 1 行硬化 | arm 后 throw 前显式 drop/settle + 既有腿复跑 | 低（但触 dispatcher 主链文件） | **入队列不即动**（parent 注②已裁）；若要动=新 writer 单；**可做不可需** |
| R-C-08 | #347 候批：p4t6×a4p7 census 竞态修复（OPEN，双审 PASS 必办 0，双 CI 绿，head 已 merge-sync onto d5de7497 零冲突） | PR #347 head `8f9099966bfc06fa66994f3f7aa2958e025edb57` | 合并动作 | 根 per-SHA 确认 → `gh pr merge 347 --squash --match-head-commit <全SHA>` | ≈0（p4t6 面零改动） | 报根队列（技术步=0） |
| R-C-09 | p7t6 legacy .md 版本轴 dirty-class 裁决行（DEFERRALS 名册唯一待裁决行；owner=fence owner+§7.3 emitter 在案） | `evidence/a4-pr7/7-3-flip/intentional-retired.md` 体系 | 纯文档裁决 | owner 出裁决行 + 名册等式机检复核 | 低 | 派 owner（文档 writer 即可） |
| R-C-10 | shape-N/A 18 腿补跑（14 off + 4 rename；权威 off 账在 22-07-01Z 旧面，H1b 钉条件红按根裁先例保留） | `glob-off-install/code/a5glob-off-kit.mjs`（已参数化 @01082b35） | 测试跑 | 钉 CANDIDATE_SHA（勿钉移动中的 master）驱 off 形 1 跑 + rename 形 1 跑 + 落账（na:true 账纪律沿用，重跑判据零删） | 低（红须如实保留） | 派测试 writer（不触代码） |
| R-C-11 | stagehand 口径裂缝 → **已裁销案**（根 21:15Z ③「'现装才钉'撤回后无冲突悬案，维持已钉不动」`pindir/README.md:110`；原"待裁"语境 COORD:199 已被 :200 作废行更正），事实核对=根 07:46Z 令已收口于 `FACT-CHECK-browser.md` | C-16 钉表口径（`team-tool-plane.mjs:318` 六名已钉） | **已闭** | 无 | — | 无待办（真 browser 工具名=宿主发布面事件位，非本仓待办；R-C-11 就此关闭） |
| R-C-12 | F3b gen2 纯度复驱（2 KIT_DONE+1 HARVEST 定档已满足判据；此项=纯度改善非验收缺口） | `a5c1fix-b` kit | 可选测试跑 | 1 次复驱：harvest-on-death+即时脱敏+错峰（rv2b 教训） | 中（K12 未证消失） | 可选；判词不因复驱改变（DISTRIBUTION 原文） |
| R-C-13 | U1/v4 执行面=闭合条件制（根 07:30Z 令）：不复活不排实施；前置=effect-queue 轮立项+映射接线位+（若走 def#N 推导）新语义裁决；最小验收形=真拒矩阵+迁移四律负控+可映射不裂缝 | `docs/plans/memo/alpha5-tool-io-governance/*` + `vnext-field-mapping` | 闭合条件登记 | **无**（前提在场，见 DEFERRALS U-1） | — | 仅供根排期参考；前提消失才上报 |
