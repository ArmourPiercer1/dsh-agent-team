# PTC fs half-arm — production implementation round (work order 10:04Z, owner 1ef62fcd)

Branch `alpha5-ptc-pr` off master `1962f8791381d94899c63af0f9736839a753674f` (ls-remote
verified at fork time). Contract-frozen scope honored: `packages/runtime/src/plugin/host.ts`
(install line + structural overload + glue surface), `packages/runtime/src/plugin/live/
agent-bindings.mjs` (the :2412 gate registration/census/disposers + router re-export), NEW
`packages/runtime/src/plugin/live/ptc-escalation-row.mjs`, NEW synthetic-leg spec
`packages/runtime/test/a5ptc-escalation-row.test.ts`, p4t6 booking in
`packages/testkit/test/p4t6-session-event-scan.test.ts`. ZERO edits to team-tool-plane.mjs /
plane-effect-backends.mjs / search|glob files / grant.ts / grant-mint.ts (int-r3 domain +
frozen kernel).

## Six legs → code (measured anchors)

| leg | where | note |
| --- | --- | --- |
| S1 | host.ts install block before `glue.createAgentBindings` — `ctx.on('approval/request', …, { global: true, prepend: true })`, the activation-fence :1115 precedent; router `route()` returns `next()` untouched for non-owned asks | waterfall contract cited at the pinned host api-catalog :3921 (`Scoped<Agent>`, outcome-to-claim / next-to-delegate) |
| S2 | `parseEscalationReason` + `fingerprintOf` in the row | reason format VERBATIM `escalate sandbox to <mode>: <justification>` — measured at `packages/sandbox/sandbox/lib/index.js:109` of the pinned host (`escalation.js:122` in the work order = the same site at a different source offset; cited as measured). Mode ∈ the closed `SandboxMode` trio (index.d.ts:19). Mode binds into the parametersFingerprint |
| S3 | `adjudicate` fresh-ask path — `requestControl` with the EXACT production shape (pre-execute-adapter.ts:1822-1868), kind `user-approval` (leader) / `leader-approval` (member), `actionName 'parameter-permission'` (:685), `awaitControlDecision` liveness bridge, `decision === 'allow'` the only mint trigger, `CONTROL_WAIT_ABORTED` → `cancelled` | durable rows are the authority; the bridge is liveness only |
| S4 | per-root assembly + `setBootCensus` booked in the gate (observations + console line `a5ptc: census-boot root=… selectedRunner=… enforcement=…`) | HONESTY: selectedRunner/enforcement are CONFIG-DECLARED (the confinedProvider trio: launcherPath + sha pin), NOT an OS runtime probe — the plugin has no public OS-probe face and the row does not fake one |
| S5 | in-process roster; `registerAgent` disposer + `revoke` pushed into `toolDisposers` (the existing drain); unregistered member ⇒ unconsumed grants marked `revoked-before-use`, ledger keeps its one durable fact | the kit's 0600 IPC channel + HTTP faces DISAPPEAR entirely |
| S6 | registration lives INSIDE the `:2412` gate (`permissionPolicy !== undefined && config.teamToolPlane != null`); non-Team installs leave the router map empty → the ONE global listener is a pure `next()` pass-through | zero expansion by construction, not a runtime branch |

## Grant discipline (zero domain edits)

`mintOperationGrant` / `createGrantLedger` (tool-admission/grant-mint.ts:74/:111) imported
verbatim; effects canonicalized through the domain's OWN `parseRequestedEffectSet` RAW-ARRAY
arm (the claimed-object arm requires a pre-carried fingerprint — measured). One-shot: the
approval in hand is consumed by its own ask; the consumed fact STAYS in `byKey` as the
replay-detection face (replays meet the kernel's CONSUMED mark — no second durable request;
the observability mirror never downgrades a consumed fact). `grantsState` is a mirror, the
ledger is the one durable fact. Kernel precedence untouched: identity→realm→generation→
revision→fingerprint→expiry→consumption-LAST — all five negative controls grade there.

## Synthetic leg (RED-first)

`packages/runtime/test/a5ptc-escalation-row.test.ts` — committed BEFORE the module existed
(RED log: `Cannot find module …ptc-escalation-row.mjs`, 7 failed; the OS-floor lesson kept).
GREEN: 7/7 — NC-1 replay (one approval = one call, replay refused, NO second control
request), NC-2 expiry precedes consumption, NC-3 per-root closed-world ledgers +
member-scoped ask keys, NC-4 deny/abort mint NOTHING, NC-5 mode drift refused on the
fingerprint, S1 pass-through zero-state, S4 census + boot row + S5 disposer symmetry +
fail-closed `unavailable` with no control service + the ladder kinds.

## Production-entry 真跑配方 (live leg — recipe lands now, run may wait for the int-r3 merged face)

See `production-run-recipe.md` in this directory. Positive/negative controls:
leader/member resolve → `allowed-once` → 禁区真落盘 exactly once; replay/过期/他队 zero
extra writes; non-team world byte-zero; unload symmetry.

## Disclosed baseline (clean HEAD, same commands, this tree)

Pre-existing RED on master 1962f879 — NOT caused by this round (identical failures with my
diff stashed): `packages/runtime/test/p6t3-mediation.test.ts` (5), `p6t3-restart.test.ts`
(2/3), `rc2-persona-probe.test.ts` (1), `a4pr0a-fact-type-closed-set.test.ts` (suite
collection: FACT_TYPE_CATEGORY block not found). `host.ts` eslint carries 2 pre-existing
errors (:112 unused, :3228 empty block) — identical on clean HEAD; this round adds ZERO
new lint violations and ZERO new denylist vocabulary (the row header deliberately names no
lane words; the a5p7 hygiene exception list stays UNWIDENED).

## 独审登记（通过轮，必办=空；三项非阻塞，如实入账，代码零语义改动）

① **同 callId 并发双发**：两个 in-flight ask 同 (member, callId) 会各自开一条独立耐久
审批、各自成组一次性铸权——后果是**重复提示**（人会被问两次），不存在未授权放行（两条
都必须各自拿到 allow 才各自放行，grant 逐条独立且各消费一次）。in-flight 去重（second-asker
挂到 first-fact）= 未来轮，非本轮语义。
② **consumed+expired 叠加**：两事实同时成立时内核判 `expired`（frozen precedence：
fingerprint→expiry→consumption-LAST，expiry 在 consumption 之前——内核冻结正确；工单
措辞把两者次序说反）。本腿的两个负控各走单因腿（NC-1 未过期+已消费、NC-2 未消费+已过期），
各自独立正确、各自绿。
③ **api-catalog 锚点**：S1 监听契约的实测行号 = pinned-host `api-catalog.ts:3921`（工单
记 :3852 为文件条目字段偏移）；本 README 原先已按实测披露，本轮把行头注释一并改为实测值
（纯注释，dist 镜像随动重放，无行为变化）。

## Scanner re-anchor

p4t6 measured ON THIS TREE (pre-booking run): `expected 1196 to be 1194` → booked
1194 → 1196, five pieces (named array / both chains / spread / tie `toBe(1196 - 1194)` /
title clause). No chain value copied.

## 生命周期修复轮（lifecycle-fix round，parent 工单 2026-10-18；分支头基点 `45717a9f`）

### 三红原文引用（live-kit run `live-2026-10-18T12-55-53`，不改写；receipts 在
### `.worktrees/a5ptc-stack/dev/agent-workflow/evidence/alpha5/ptc-fs-impl/runs/live-2026-10-18T12-55-53/`，KIT_EXIT=2）

- **U-1**：`FAIL [T] U-1: UNLOAD SYMMETRY (close/drop face): after dropResidency the row NEVER sees a new ask (no observation delta, no durable request — the mount unregistered); the ask rides the pre-round host chain and lands fail-closed as measured — dropped={"sessionId":"session-team-child-dc0683b406c60ff31e8dac06d19dd73b","dropped":true} seenByRow=true outcome={"ok":false,"error":"timeout waiting for: U1: emitter result 6","outcome":"drive-timeout"} obsDelta=[]`
- **U-1b**：`FAIL [T] U-1b: UNLOAD SYMMETRY (archive face): after the LEADER archives the member (the production LifecycleService procedure, quiesce + archive + live effects), re-driving an escalation ask — the row NEVER sees it; the ask rides the pre-round host chain and lands fail-closed as measured — archived=true e1=session-team-child-f5920664a92f21dbc107ccabe972a7d9 instance=inst-1ez8xku1os7x seenByRow=true outcome={"ok":false,"error":"timeout waiting for: U1B: emitter result 8","outcome":"drive-timeout"} quote="[object Object]" obsDelta=[]`
- **U-2**：`FAIL [T] U-2: RE-MOUNT: the cold-resumed member re-registers cleanly through the mount gate (one face per session — no duplicate-face throw, the router resolves the NEW agent) and a NEW callId lands allowed-once writing its OWN artifact — resume=422/{"error":"no live agent for 'session-team-child-dc0683b406c60ff31e8dac06d19dd73b': ptc-escalation-row: member 'session-team-child-dc0683b406 regs=5->5 result={"seq":7,"callId":"a5ptc-call-r2","ok":true,"mode":"workspace-write","wrote":{"path":"…forbidden r2="A5PTC-REMOUNT-ARTIFACT\n"}`

**四度复现声明**：三红在 rounds 4–8 四次独立测量中逐字同形复现（上一节已入账），
判据未弯；本轮修复由这四度复现驱动，不在合成世界里重设判据。

### 根因（读码行号，`45717a9f` 树）

- 登记：`live/agent-bindings.mjs` `agentSetup` 的 PTC 门（:2489 区，S6 门 =
  `permissionPolicy !== undefined && config?.teamToolPlane != null` :2423）内
  `ptcRow.registerMember(...)`（:2538）+ `ptcRouter.registerAgent(runtimeAgent,
  ptcMember.memberKey, ptcRow)`（:2558）；摘除只有 `toolDisposers.push(...)`
  （:2562-2565），而 `toolDisposers` 是 createAgentBindings 的 **row 级**数组
  （:763），唯一 drain 点在 row stop（:5140）→ 驻留生命周期事件（dropResidency/
  archive/冷启）不触任何 drain ⇒
  **U-1/U-1b**：router 的 `byAgent`/`byAgentId` 与 assembly `members` 图项永存，
  旧 Agent 对象仍被 `route()` 命中并开耐久审批（`seenByRow=true`）。
- 冷启 re-mount：`registerMember` 对同 `(root, session)` 键直接
  `throw new Error("…already registered (one face per session)")`（旧 :182）→
  resume 面 422。**U-2**。
- 驻留/归档路径的处置事实：sync 驻留端口 `residency.dropResidency` 先
  `liveAgents.delete(sid)` 再 fire-and-forget `handle.dispose()`
  （agent-bindings :4949-4963）；async 面 `dropResidency` await dispose（:5032-5052）；
  archive/dispose 程序的 release-residency 走 **sync boolean 端口**
  （`packages/runtime/lifecycle/quiesce.ts:143`，不 await dispose）。宿主公开
  `agent/disposed` 事件在每次已发布 Agent 的 registry detach 时发出
  （pinned-host `packages/core/agent/src/index.ts` `detachEntered→emitDisposed`；
  api-catalog :3793 "An agent left the registry"；`agent.id === agent.session.id`
  同文件 :460-463 强验），activation fence 已以此面为治理挂点先例
  （本仓 `plugin/host.ts` :1153-1169 的 global `agent/created`/`agent/disposed` 监听）。

### 修法（跟随成员驻留生命周期；挂点选择=公开 `agent/disposed` + ask-time 驻留门）

1. **router 镜像 `agent/disposed`**（`ptc-escalation-row.mjs` `onAgentDisposed`；
   host.ts PTC 安装块内 `ctx.on('agent/disposed', …, { global: true })`，fence
   :1164 先例）：被 dispose 的 Agent 对象的路由图项**同步**摘除并 `revoke()` 成员面
   ——幂等（entry 身份守卫：迟到事件只摘自己的旧项，绝不碰 re-mount 后的新图项/新成员），
   永不外抛。row 级 drain 保留为 row-stop 兜底。
2. **ask-time 驻留门**（修 U-1/U-1b 的竞态半）：sync 端口 drop 是
   `liveAgents.delete` 同步 + dispose 异步，`agent/disposed` 可能晚于下一次 ask——
   所以 `route()` 在裁决前查询成员 handle 的 `isRoutable()`（live + 注入的
   `isResident` 谓词；glue 传 `() => residency.has(sessionId)`，读的就是 drop
   同步删掉的那张 `liveAgents` 表）。不可路由 = **不 OWN**：原样 `next()` 委托，
   零观测、零耐久请求、零 adjudication 计数——正是红里量到的"骑 pre-round 宿主链
   fail-closed"落点。挂点选择理由：这是宿主公开面 + 驻留端口同步事实，不依赖宿主
   内部事件次序；disposed 监听是状态清理面，不是行权依赖。
3. **re-mount 替换语义**（修 U-2）：同 `(root, session)` 再入先 `previous.revoke()`
   （旧面死亡、其未消费 grant 记 `revoked-before-use`、观测 `member-replaced`）再登记
   新面——"one face per session" 不变式保留其本意=**任一时刻一活面**，不是永不可恢复。
   router 改以**成员 handle**（registerMember 返回物）为身份载体（不再是共享 memberKey），
   旧 Agent 对象在替换后、其 dispose 事件抵达前也永不路由进新世代；revoke 身份加固
   （`members.get(key)===member` 才删、facts 按 `memberGeneration` 身份清算），
   迟到的旧 revoke/旧 drain/旧 dispose 三连都不会误杀新面。
   一次性语义跨 re-mount 保持：consumed fact 留在 `byKey`（同 instanceId+callId 的
   旧 callId 重放仍撞 CONSUMED 标、绝不开新审批）。

### RED→绿实录（合成腿进 a5ptc-escalation-row.test.ts：L-U1/L-U1b/L-U2）

- RED（腿先于修，对 `45717a9f` 现树）：`RED-vitest-a5ptc.log` = `Tests 3 failed | 7
  passed (10)`（生命周期契约不存在，`route()` 对不可解析登记 fail-closed
  `unavailable`）；`RED-semantics.mjs`/`RED-semantics.log` = 用**出货 API** 在
  **dist 镜像**（生产安装加载面）上重演生产症状本身：
  `post-drop drive (U-1/1b) -> allowed-once (controls=2) seenByRow=true`；
  `re-mount (U-2) -> THREW: ptc-escalation-row: member 's-u1' is already registered
  (one face per session)`（与 422 面逐字同源）。
- 绿：`GREEN-vitest-a5ptc.log` = `Tests 10 passed (10)`；`GREEN-semantics.log` =
  `disposed mirror -> onAgentDisposed=true liveCount=0 seenByRow=false` +
  `re-mount (U-2) -> registered (no throw); membersLive=1`。
- 腿清单：L-U1（drop 后 drive→原样 next() 零状态；disposed 面幂等摘除+revoke；
  重复 disposed/迟到 drain 零抛零观测）；L-U1b（archive 同路径：leader 型、
  归档后 drive 不再开第二条耐久审批、teardown 三面任意序幂等）；L-U2（冷启
  re-mount 替换不抛、新 Agent 恢复 allowed-once 且仍一次性、旧 callId 重放仍拒、
  旧 Agent 对象永不漏进新世代、迟到 dispose/revoke 不伤新面）。

### 修后腿清单（本树实测，`runs/lifecycle-fix-2026-10-18/`）

| 腿 | 结果 |
| --- | --- |
| a5ptc-escalation-row.test.ts（含 L-U1/L-U1b/L-U2） | `10 passed (10)` GREEN（GREEN-vitest-a5ptc.log；RED 腿先对 45717a9f 现树 `3 failed \| 7 passed`） |
| 语义见证（dist 镜像、出货 API） | RED `seenByRow=true` + `already registered` 逐字 → GREEN `onAgentDisposed=true liveCount=0 seenByRow=false` + `registered (no throw)` |
| a5p0 消费者集（domain 六 suite） | `104 passed (104)`——**集不动**：本轮零新增 lane import（row 仍只 :65 grant-mint + :66 parseRequestedEffectSet 两条已入账边） |
| p4t6-session-event-scan + a5p7-lane-hygiene | `15 passed (15)`——**文件集不变**（三腿进既有 spec，零新文件），booking 的总数由 scanner 本跑亲验通过（未抄链值）；hygiene 例外表未加宽 |
| drift（check-artifacts-committed，含提交后 :head 复跑） | `verdict=ok compared=1748 glue=9`（GREEN-check-artifacts.log） |
| typecheck（pnpm -r） | EXIT=0 全包 Done |
| eslint | 四改动文件定向 = 仅 host.ts 已披露 2 错（:112 unused、空块 :3228→**位移 :3251**，同 site 非新增）；row/glue/test 三文件 0；全仓 `161 problems (129 errors, 32 warnings)`（eslint-full-repo.log），把修复 stash 回出货字节复跑 = **同样 161 problems、逐规则分布 diff 相同**（eslint-base-stashed.log），本轮新增 **0** |
| 全库 battery（runtime+domain+tools+testkit，6062 tests） | `18 failed \| 6044 passed`——**18 红与本修复无关**：把修复 stash 回出货字节重跑同 7 文件集，失败测试名集合 `diff` **完全相同**（IDENTICAL-FAIL-SETS，full-run/base 两份 log 入账）。既有红集 = p6t3-mediation×5 / p6t3-restart×2 / rc2-persona-probe×3 / plugin-dsh-compat×5 / a4p7-merge-gate×1 / t2-blueprint-hash×1 / p6t6-actions×1（相对上轮 README 披露行有漂移——rc2-persona-probe 1→3、plugin-dsh-compat 等 4 文件新入红——但**均已在 45717a9f 出货面复现**，属分支/环境既有态，非本轮引入；如实入账不代上游圆场） |
