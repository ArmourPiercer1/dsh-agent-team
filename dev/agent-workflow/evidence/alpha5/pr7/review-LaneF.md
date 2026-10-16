# review-LaneF.md — Alpha.5 PR7 (jobs-gateway 适配) 独立 review（Lane F reviewer，≠writer；qwen3.8-flash-next）

对象 = `origin/alpha5-pr7-adapters` @ **a919a4a3**（base `db5cb5f7`，DORMANT）。
一次性 worktree `.worktrees/a5p7-rev-f`；hostless 单元套件（无 DSH 实例；未占 3184/无 world；**:3080 全程未触碰**）。
裁决：**通过（投机通过余量趋近通过）→ G-d 集成会话 可**，条件见文末。

## ① 取消分型消费面 vs merged 权威（master@452a04c0）— PASS

六事件名逐字比对：消费面封闭集 `packages/runtime/jobs-gateway/types.ts:56-68`
≡ 权威 `packages/runtime/tool-dispatch/install.ts` @452a04c0（`:651` outcome-unreadable、
`:662` terminated-after-body-start、`:673` cancelled-before-body / cancelled-by-others、
`:686` completed-after-abort、`:763` executed-unvalidated）。
lane 内 `dispatcher-call-*` 全集恰为这六个，**零自造名**（grep 穷举验证）。
lane 引用的 stack `bd6310ca` 的 `classifyOutcome` 与 merged 452a04c0 **字节一致**（diff 空）。
两不 claim 处保真：unreadable→`unresolved` 两不 claim（cancellation-boundary.ts:75-84）；
terminated→硬编码 `sideEffectPossible:true`、kind 恒非 not-started（cancellation-boundary.ts:56-66，
对抗注入伪造 `sideEffectPossible:false` 被覆写为 true ✓）。`not-started` 仅可从 before-dispatch 面得出。
G-a 纪律：全 lane 无"已开始被传播终止标未开始"措辞、无"G-a 冻结保证已成立"宣称；
README/evidence 明示 "Verified against that stack/fixture, not a whole-chain claim"。
备注（非 FAIL）：`dispatcher-call-executed-unvalidated`（PR1r 中 Body 确已执行的完整性 alarm）
被并入 `unresolved`——方向保守（不谎称未开始、evidence[] 保原始事件），但 splice 后若该 alarm
后到，会把同一 call 先前的 known outcome 覆写为 unresolved；集成时按"alarm 与 outcome 分轨"处理为宜。

## ② LeaseWindow 状态机 — PASS（对抗注入 8/8 绿）

DRAINING 后 `settled` 拒收+token 留账：lease-window.ts:101-113（注入：drain 后 settle→
`late-settle-across-boundary`，GIVEN_UP 后再 settle 亦拒）；giveUp 后 release **永久拒**
（lease-window.ts:136-143，giveUpReason 首查；注入：以 `refused` 面清空全部 token 后 release
仍 `drain-given-up`，二次调仍拒，且不能再 drain/acquire）；跨边界 outcome 不洗白 lease settle
（jobs-gateway.ts:160-177：outcome 照记、lease 计数不消、release 失败；注入证实）。
自造事件名注入不能虚构 outcome（classify 返回 undefined，ignored-loudly）。
文档化信任点：`end(callId,'refused')` 可在任意 live 态清 token（by design，gateway 自身从不发）
——**集成条件 3**。

## ③ JobOwner — PASS

ownerKey 以值拷贝钉死于 admission（jobs-gateway.ts:122-125；注入：事后改 caller 对象无效）；
live jobId 换 owner 再入 = `owner-mismatch` alarm（jobs-gateway.ts:111-115）；
跨 scope 投影拒且 detail 为静态文案、不携 owner 身份（web-projection.ts:66-71；注入：连共享
instanceId 都不泄漏；同 instanceId 异 TeamSession = 不同 owner，拒）；canonical key 固定字段序
+ JSON 转义，注入型 id 不产生键碰撞（types.ts:42-48）。

## ④ MCP 重绑链 — PASS（6 例复跑 6/6 绿）

"逐 job 自身 (scope,name) 重读"：onRegistryChange 逐记录 `reader(record.scopeKey, record.toolName)`
（jobs-gateway.ts:184-194），邻名/异 scope 同名不误伤；unreadable=moved；无 reader ⇒ 全动。
"归属钉执行时 definition"：pinnedIdentity 锚（链例 4：change 被吞仍可归 v1；新 admission 才钉 v2）。

## ⑤ G-d 已知项（p4t6 +14）— PASS（带一处文档勘误）

14 个 scannable 文件列表**逐字钉死**于 `packages/runtime/test/a5p7-lane-hygiene.test.ts:52-73`
（sorted 精确集 + count=14，且该测试即断言"与 diff 一致"），README.md:55-63 复述；与实际
diff 完全吻合（README.md 本体非 scannable）。本环境复跑 p4t6：仅计数腿红
**1087 vs pin 1073 = 恰 +14**，其余 9 腿绿。**勘误**：README.md:61-62 的 "979 → 993" 为陈旧数字，
base@db5cb5f7 实际 pin 1073 → 1087（baseline-delta.md 记录正确）；集成 owner 加 pin 以
hygiene 测试列表为准、勿用 README 旧数。

## ⑥ NEW=0 / token / porcelain / :3080 — PASS

本环境 base 对照（lane 文件移出）：4857 tests，**11 failed**（t2-blueprint-hash 1 /
p6t3-mediation 5 / p6t3-restart 2 / rc2-persona-probe 3）；with-lane：4889 tests，同 11 failed
+ 32 新绿 ⇒ **only_in_after = 0**。writer 侧 19 红含 8 例环境态红（a4p7-shipped-composition 3 /
team-skills 2 / team-spill-local-composition 3，本环境两态皆绿，属 base-same-fail 族）。
token：evidence 日志 grep 无 token 值；collect-time 脱敏有测试（job-owner 测试 :68-90）。
porcelain：HEAD 干净（仅本次评审注入件）。:3080 LISTEN 未动；未启动任何服务/世界。

## 判定

**G-d 集成会话可**。条件：
1. scanner pin +14 以 `a5p7-lane-hygiene.test.ts:52-73` 列表为唯一依据加入（README 979/993 旧数作废，建议 writer 顺修，纯文档性）；
2. tsconfig include 落地（README checklist #1）后必须补跑 tsc——lane 从未进过 tsc；
3. 装配时 `lease` 句柄不外露给 Web/Jobs 消费面（`end(...,'refused')` 信任面，见②）；
4. splice 换 `contracts/identity` 冻结导入时重验 hygiene 测试 2（importer 扫描）。
