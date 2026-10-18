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
