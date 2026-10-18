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

## Production-entry live-kit (parent order: 复跑 battery + recipe 全链真宿主正反控)

### Stack head values (measured three-source; NO unverified SHA anywhere below)

- master = `104b499173687daa0f5c537bc37ae7600089576c` (#333 MERGED — the glob-line
  production flip is REAL inside the stack from here; transcribed verbatim from the
  parent's `git rev-parse origin/master`, re-verified on this side by
  `git fetch origin master` + `git rev-parse origin/master`). Its predecessor
  `0fa2cd76de2b48ef287ca3bf82ac6b03b30e3ab8` (the #332 merge head; three-source verified
  when it WAS master: ls-remote == origin/master == stack ancestor) is an ancestor of
  `104b4991` (merge-base check). The parent-transcribed `7118b798` was a spliced
  non-existent SHA — 作废, never used, never recorded as a value anywhere.
- int-r3 = `da29aedc4e94cfe624725e43ecb66e1c42b4d2b3` (round-13 ④闭环 head) — MERGED into
  the stack (via the 12ceac85 merge lineage; the int-r3 files ride zero-conflict).
- PTC impl = `5a4a25e7e457f9709405e9b3d8fe3fda333ba1c2` (U-1b follow-up head: ask-time
  routability gains the DURABLE admissibility oracle — an ARCHIVED/DISPOSED member never
  routes, not even through a cold re-mount that re-establishes residency; RED-first
  `c33940d4` upgraded L-U1b to the production archive-procedure form; dual-source verified
  `git ls-remote origin refs/heads/alpha5-ptc-pr` == `git rev-parse origin/alpha5-ptc-pr`;
  ancestor chain `45717a9f → b3e99a14 → 5a4a25e7` merge-base-checked).
- stack tip (#334 merge) = `83ab021eda7fd129767ca6b8d21c13881798777f` = `126bcd90` ⊕
  `5a4a25e7`, ZERO conflicts (the lifecycle-fix README union rode clean).
- #333-round stack tip (now ancestor) = `535881a00fde0ac1d356c48cb47278b34c622625` = merge of `0a225e64` (itself
  `12ceac85` ⊕ `0fa2cd76`, zero conflicts) ⊕ `104b4991`. Conflicts: team-tool-plane
  (src + dist mirror) and glue7 = COMMENT-ONLY (both sides already carry the flipped
  anchored-rg glob row in code) — master side taken verbatim per the round-14 ruling;
  p4t6 = the normalized union tie (HEAD side already contained both sides' pins + the PTC
  booking); int-r3 README = master side (lane-owned file). `check-artifacts-at-head`:
  drift=0 over 1748 compared files.

### Replay declaration

On the merged tip `535881a0` the FIVE rehearsal batteries plus the scanner and the flipped
glob line's own suite re-ran EXIT=0: a5ptc-escalation-row 7/7 · a5p7-lane-hygiene 5/5 ·
alpha5-search-backend 42/42 · a5natexe-native-takeover 12/12 · a5int-r3-mount-integration
6/6 · p4t6-session-event-scan 10/10 (the merged tree's re-anchor is the scanner RUN itself —
the tie passes only when the measured total equals the union chain sum; no arithmetic
import) · alpha5-glue7-plane-backends 12/12 (vitest logs live under
`.scratch-logs/a5ptc-stack-104b/` — workspace-local, not committed).

On the #334 merged tip `126bcd90` (PTC `b3e99a14` lifecycle fix inside) the battery re-ran
EXIT=0 with the a5ptc spec now at its POST-fix count: a5ptc-escalation-row **10/10** (the
L-U1/L-U1b/L-U2 legs included) · a5p7-lane-hygiene 5/5 · p4t6-session-event-scan 10/10 ·
alpha5-glue7-plane-backends 12/12 · alpha5-search-backend 42/42 · a5natexe-native-takeover
12/12 · a5int-r3-mount-integration 6/6 (logs: `.scratch-logs/a5ptc-stack-b3e9/`).

### The kit

`a5ptc-production-kit.mjs` (+ `a5ptc-production-emitter.mjs`) — production-entry live run
of `production-run-recipe.md` §0–§5 on the pristine pinned host (0.2.0-rc.2 @
`639ed01539…`, HEAD==baseline and porcelain 0 verified BEFORE and AFTER — legs H0/Z-0).
Disclosed drive class (fixed by the recon round and accepted by the parent): the escalation
asks on the drive legs are emitted IN-HOST by the kit emitter row, which drives the host's
OWN public `approveEscalation` (file-URL import of the pinned host byte) through the
production `ctx.waterfall('approval/request')` → the shipped PTC row adjudicates → durable
control request → the kit resolves over the production wire (`team.resolveControl`). The
emitter writes the token file as the EFFECT stand-in (the ONLY emulated piece; the positive
control's 禁区真落盘 is a real disk write inside the world home). E-1 measures the NATIVE
emitter reality separately (member bash + sanctioned retry pair) and reports which arm
landed, verbatim. Ports 3181/3182/3183 + mocks 3491–3495; `:3080` read-only status probe
only (401→401 both sides); DSH_HOMES `tests/homes/a5ptc-*` swept at teardown; every receipt
token-sanitized (`token=REDACTED-<sha8>`). Baseline world (B) boots the PRE-ROUND row from
`git archive 1962f879` of the committed dist mirror — with its OWN-generation seam
(`cfg.seamUrl` pinned into the extract; a current seam over a baseline host closes the
TeamDomain mid-bootstrap — measured, disclosed).

### Kit results (final clean run `runs/live-2026-10-18T12-55-53/`; KIT_EXIT=2 = three FAILs, all reported verbatim below)

| leg | verdict | measured |
| --- | --- | --- |
| H0 | PASS | :3080 `401` (read-only probe, before==after), :3180 unreachable both sides; 3181–3183 free; crash-residue homes reclaimed at boot (disclosed, `reclaimed=[]` in the final run) |
| OS-0 | PASS | official `landlock-run --probe` answers; strict-widening witness: read-only-posture write DENIED (EXIT=2), widened-posture same write EXIT=0 — the floor is real, escalation to workspace-write is never a no-op here |
| BD-0 | PASS | pre-round baseline extractable at 1962f879, PTC-FREE (`host=true gluePtc=false`) |
| T-0 | PASS | governed boot surface = 20 tools, deny=0 |
| T-2a | PASS | production `team.create` fresh-root status=200 |
| T-1 | PASS | census-boot line with the pinned real Landlock confinedProvider (`landlock-launcher pinned`), CONFIG-DECLARED runner/enforcement (never an OS-probe claim) |
| T-2 | PASS | wa member + row census recorded `member-registered` observations (2 registrations) |
| P-1 | **PASS — POSITIVE CONTROL LANDED** | durable `leader-approval` (actionName `parameter-permission`) → wire ALLOW → `allowed-once` → REAL forbidden-zone write ONCE (`ptc-positive.txt`, 24B, hashed); ledger request→decision aligned; consumption fact recorded VERBATIM: final run `consFacts=1` (an early run read 0 through the row's post-allowed-once flush — a flush race, disclosed) |
| R-1 | PASS | same (member,callId) replay → host fail-closed sentence VERBATIM (`the user rejected escalating this command to "…"; it stays denied…`), NO second durable request, artifact hash unchanged |
| M-1 | PASS | mode drift to danger-full-access refused on the fingerprint, never a re-approval, zero bytes |
| O-1 | PASS | T2 member meets T2's OWN closed-world row (fresh request under root2, never a second life of T's grant); leader DENY-before-use → rejected; T2 mints NOTHING; T grant still intact |
| E-1 | PASS — arm A | native member bash + sanctioned retry pair lands arm A: dispatch refusal VERBATIM `team tool guard: the Tool Binding for "bash" cannot be verified at dispatch time (no fallback to the native body)` + ZERO escalation rows + zero bytes — the GLUE-8 law; arm B (full native chain) stays closed on this host by that law, which is exactly why the drive legs ride the disclosed emitter row |
| X-1 | PASS | past the frozen 60s production ttl, same callId REFUSED, no second durable request, zero extra bytes (the stacked consumed+expired grades EXPIRED — reason-word pinned by the synthetic leg) |
| U-1 | **FAIL (REAL RED, verbatim)** | drop face: `dropped={"sessionId":"session-team-child-dc06…","dropped":true} seenByRow=true` — after `dropResidency` the row STILL ROUTES the torn-down member (new ask reaches the row; the drive then times out unresolved). Root cause measured: the mount's `ptcUnregister` disposer rides the ROW-level `toolDisposers` drain, which runs only at row STOP; residency drop/archive do not drain it |
| U-2 | **FAIL (REAL RED, verbatim)** | re-mount: cold-resume face answers 422 `no live agent for 'session-team-child-dc06…': ptc-escalation-row: member '…' is already registered (one face per session)` — the mount gate THROWS on re-registration (the same never-drained registration), so the production entry cannot recover a torn-down governed member; corroborating: the drive on the stale registration still landed allowed-once and wrote `ptc-remount.txt` |
| U-1b | **FAIL (REAL RED, verbatim)** | archive face: leader `team_archive_member` SUCCEEDED (`archived=true`, instance `inst-1ez8xku1os7x`) — and the row STILL routes an ask against the archived member (`seenByRow=true`). Same root cause as U-1/U-2: teardown faces never drain the mount's unregister disposer. (cosmetic receipt loss in THIS run: the archive tool-result quote stringified to `[object Object]` — kit receipt bug, fixed after the run; the substantive facts `archived=true` + `seenByRow=true` are unaffected) |
| N-1 | PASS | non-team world: zero durable rows, zero a5ptc observations, zero bytes; the drive lands fail-closed on the pre-round host chain (`no approval channel is available`) |
| B-1 | PASS | CURRENT row vs PRE-ROUND baseline row, same plain flow + same escalation-shaped drive: normalized session-event streams BYTE-IDENTICAL (volatiles replaced per the disclosed normalization) and identical drive outcome |
| Z-0 | PASS | :3080 `401 -> 401` unchanged (probe only); test-use pristine AFTER (HEAD==baseline, porcelain 0); every `^a5ptc-` home swept |

The three U-leg FAILs are the round's honest product findings (not kit artifacts — reproduced
identically across four independent measurements, runs 4–8; the kit criteria were NOT bent;
the kit-usage defects found en route — baseline seam generation, boot-retry/orphan-kill,
crash-residue sweep, archive-receipt dispatch, consumption-fact flush race — were all fixed
IN THE KIT and are disclosed above). Unload symmetry therefore stands UNSATISFIED on both
production teardown faces for the PTC mount: the recipe face (`toolDisposers drained`) only
holds at row stop. Reported for the parent's judgment; no stack code changed this round.

> **[SUPERSEDED 结论指向，终轮追加]** 本段中 U-1b 的"archive 面"定性后被文末
> 《测量缺陷披露》更正（kit marker 假红：archive 从未合法执行，行路由未归档成员合法）；
> U-1/U-2 当时的红是真产品红（b3e99a14 修复后本 kit 复测转绿）。表内原文一字未动。

Run hygiene: rounds 1–7 (`kit-run1..7.stdout.log`, their `runs/live-*` dirs) were
intermediate kit-development rounds (crashes/usage bugs listed above) — swept locally;
their per-leg outputs are quoted in the parent report. The committed receipts are the
final run + this README + the two kit files; inside the final run dir,
`baseline-dist.tar` + the extracted `baseline-pre-round/` (≈28 MB) are NOT committed —
they are re-derivable byte-for-byte by `git archive 1962f879... packages/runtime/dist`
(BD-0 re-derives them every run).

### #334 re-run on the lifecycle-fix head `b3e99a14` (final `runs/live-2026-10-18T13-51-55/`; KIT_EXIT=2 — ONE honest red)

> **[SUPERSEDED 结论指向，终轮追加]** 本节 U-1b 的"archive 面真红"定性后被文末
> 《测量缺陷披露》更正为 kit 测量缺陷（archive 从未合法执行；行路由未归档成员合法）。
> 本节所有测量现场原文一字未动，如实保留。

Merged as `126bcd90` (single conflict = this README, union-resolved). Battery 7/7 EXIT=0
(a5ptc spec now 10/10 with the L-U1/L-U1b/L-U2 legs). The lifecycle fix moved the member
registry to ride RESIDENCY (`onAgentDisposed` = drop entry + revoke); the live kit then
measured:

- **U-1 PASS** (was red): drop now UNREGISTERS — `seenByRow=false`; the re-driven ask never
  reaches the row, never mints a durable request, and lands fail-closed on the pre-round
  host chain VERBATIM `sandbox escalation to "workspace-write" requires approval, but no
  approval channel is available` (outcome `threw`, zero writes). The drop's own observation
  `a5ptc: member-revoked` IS the recipe's "the mount unregistered" witness — the kit's
  observation filter was updated to classify lifecycle events (registered/revoked/…) as
  mount products rather than ask-sightings (probe vocabulary fix, disclosed; the ask-
  sighting authority remains the callId-scoped DURABLE REQUEST + landing + zero-write).
- **U-2 PASS** (was red): cold re-mount re-registers cleanly (`resume=200`, registrations
  5→6, no duplicate-face throw) and the NEW callId lands allowed-once writing its own
  artifact (the resume probe's glob call itself correctly answers the closed-world guard).
- **U-1b FAIL — REAL RED, reproduced independently (runs 9 AND 10, post-fix)**: after the
  leader's `team_archive_member` settles (`archived=true`, instance `inst-0umqwqq1e7su`),
  a re-driven escalation ask on the archived member is STILL ROUTED by the row: a durable
  control request opens against the archived member's instance (receipt
  `drive-U1B-a5ptc-call-archived.json` + `human-arc-ctrl-*.json` subject
  `{"kind":"instance","instanceId":"inst-0umqwqq1e7su"}`) and the drive hangs awaiting the
  leader (`drive-timeout`, zero writes). No `member-revoked` observation fires for the
  archived member — the row's revoke (which works on the drop face) never triggers through
  the production ARCHIVE procedure. The fix's vitest L-U1b leg drives dispose+drain
  directly and is green; on the production face the archive path does not reach the row's
  revoke. Criteria untouched; reported as measured — for the fix lane: the recipe's
  archive face remains UNSATISFIED at `b3e99a14`.

Kit usage fixes this round (disclosed): bootWorld orphan-proofing (handle registered
before the wait; SIGTERM→3s→SIGKILL; one port-offset boot retry), crash-run home reclaim
at boot (§7 lineage), archive-quote receipt fixes. Intermediate rounds 9 and
`kit-run8/9.stdout.log` swept locally; committed receipts = the two final runs
(`live-2026-10-18T12-55-53` pre-fix 3-red + `live-2026-10-18T13-51-55` post-fix 1-red).

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

## U-1b 续修轮（parent 续修单 2026-10-18；基点 `b3e99a14`；live-kit 18/19，U-1b 两次独立复红 `live-2026-10-18T13-4*` + `T13-51-55`）

### 取证（只读，a5ptc-stack 侧 live 收据 + 本树读码行号）

live 现象：archive 轮后 drive e1 的 ask 仍被行接走（`seenByRow=true`、开出
`human-arc-ctrl-*.json` 耐久请求 subject=instance），`obsDelta=[]` 且无
member-revoked。事实链：

1. **工具层硬校验**（tools.ts `makeDefinition().execute` :446-452）：
   `rootSessionId` + `requestToken` 在一切 `spec.run` 之前强制。kit 的 mock
   archive 轮（a5ptc-production-kit.mjs :399-411）tool call 只带
   `{instanceId}` → 在公共入口即 typed 参数拒绝，`ARCHIVE_MEMBER` 从未到达
   performAction / effects.ts:568。kit 的 `archived=true` 是 **marker 级测量**
   （轮只看 `A5PTC_T_ARCHIVED` marker 不验 result；其 quote 引的是旧 delegate
   回执）——该 live run **不能证成 e1 被提交 ARCHIVED**，e1 未归档、仍
   resident+SETTLED，行路由它在法律上是对的（drive-U1B receipt
   requestSeen:null + human-arc-ctrl allow 收据均与此一致）。
2. **quiesce 硬序论证**（排除"提交成功但 residency 仍真"的一切机制）：
   archiveMember（effects.ts:899 → lifecycle/archive.ts）先跑 quiesceMember
   （quiesce.ts），**step5 :143 `dropResidency`（sync boolean 端口，glue
   :4962 = liveAgents.delete + fire-and-forget dispose）先于 durable
   COMMIT_ARCHIVE**；handle 不在场则 step3 drainDescendants（glue :4919）抛
   `recursive-drain-unavailable` 中止（零写、residency 不动）。故**真提交过
   archive 的现场，ask-time residency 门必先假**。
3. **但 durable 法律缺口真实且可达**：b3e99a14 的行 ask-time routability 只查
   `live ∧ residency`（volatile live-handle 面），durable ARCHIVED/DISPOSED
   从不被咨询。真成功的 archive 之后，durable session 可被任何后续执行
   **冷启 re-mount**（U-2 替换语义使此路必通）：residency 翻回真 + 新 Agent
   替换注册 → 行为归档成员再开**第二条耐久审批**。合成腿第一版只翻
   `resident` 布尔、从未模拟这一面——这就是 vitest 绿而 live 红的结构性根源
   （合成腿弱于生产程序形，不是运气差）。

### 修法（公开面，core budget 0；跟随 durable 真源）

- row `registerMember` 增注入式 **durable admissibility oracle** `isAdmissible`
  （与 isResident 同款注入形态）；`isRoutable = live ∧ admissible ∧ resident`
  ——durable 真源排在 residency 之前（ptc-escalation-row.mjs，registerMember
  JSDoc + isRoutable）。
- glue 注入 durable 读（agent-bindings.mjs registerMember 块 :2554 后）：每
  ask 读 `domain.repositories.memberInstances.list(teamRoot)`（interrupt 端口
  :941-943 族同一条公开耐久面，零新 lane import），`ARCHIVED/DISPOSED ⇒`
  拒；无行 ⇒ fail-closed 拒；leader 无 member 行且 archive/dispose 不指它 ⇒
  不注入（undefined=恒可）。
- restore（durable 回 SETTLED）自动恢复路由 = 状态派生门，非永久锁出；
  residency 门保留（U-1 drop 面不动）。

### RED→绿实录（`runs/u1b-followup-2026-10-18/`）

- **RED-first 对现头**（c33940d4，src 未动）：升级后的 L-U1b 走**生产程序形**
  ——真 `createLifecycleWorld`（真 P4 耐久域）+ 真 `service.archiveMember`
  （五步 quiesce：close-admission→interrupt→drain→wait→**RELEASE-RESIDENCY**，
  再 CAS 提交 ARCHIVED）→ 冷启 re-mount（markResident 复活 + 新 Agent 替换
  注册）→ drive：`expected 'passthrough' received 'allowed-once'`
  （`1 failed | 9 passed`，RED-vitest-a5ptc.log）= live 症状逐字。
- dist 镜像见证（出货 API，stash 回 b3e99a14 src+dist 字节复跑）：
  `archived re-mount drive (U-1b) -> allowed-once (newDurableRequests=1)`
  （RED-witness.log）→ 修复后 `PASSTHROUGH (newDurableRequests=0)`
  （GREEN-witness.log）。
- GREEN：spec `10 passed (10)`（含 FACE1 drop 面 / FACE2 冷启 re-mount 拒 +
  迟到 disposed 身份守卫 / FACE3 真 restore 恢复 allowed-once 且重放仍拒）。

### 修后腿清单（本树实测，`runs/u1b-followup-2026-10-18/`）

| 腿 | 结果 |
| --- | --- |
| a5ptc-escalation-row.test.ts（升级 L-U1b 生产程序形） | `10 passed (10)`（GREEN-vitest-a5ptc.log） |
| p7t3 五 suite（archive/drain/dispose-race/fact/restore——程序与 helper 完整性） | `31 passed (31)` |
| a5p0 消费者集（domain 六 suite） | `104 passed (104)`——lane 集不动：row 边不变，glue durable 读走既有 `domain` 依赖（无新 import） |
| p4t6-session-event-scan + a5p7-lane-hygiene + a5p7-vnext-field-mapping | `21 passed (21)`——文件集不变（零新文件，腿全进既有 spec） |
| typecheck（pnpm -r） | EXIT=0 全包 Done（GREEN-typecheck.log；中途一次 TS2345=测试内 `string \| undefined` 索引访问，已 fail-closed 守卫修复后复跑） |
| eslint（改动三文件定向） | 0 问题（GREEN-eslint.log；host.ts 本轮未动） |
| drift | 见提交后 check-artifacts-at-head 复跑 |

### 披露（不代上游圆场）

- live U-1b 两红 run 的最自洽解释是 **archive 从未完成**（工具参数形：mock
  只发 `{instanceId}`，缺 `rootSessionId/requestToken`，且参数字段名应为
  `targetInstanceId`）——该 run 里行的路由行为合法；kit 侧应以 **tool result**
  （而非 marker）测 archive 成败，kit 修复属 stack 侧，不在本 worktree 权限内，
  如实上报 parent。
- 本修不依赖上述 kit 判断成立：它钉的是生产语义下可复现的**法律违反面**
  （真归档成功 + 冷启 re-mount → 第二条耐久审批），RED 由真归档程序形现场
  复现，与 live 症状同形。criteria 不弯：归档成员（durable ARCHIVED/DISPOSED）
  的 ask 永不被行看见，落原样 `next()` 委派，零耐久状态零观测。

## #334-follow 终轮：U-1b 修复头 `5a4a25e7` 全链 **19/19 全绿**（`runs/live-2026-10-18T15-01-38/`，**KIT_EXIT=0**）

### 测量缺陷披露（旧轮 receipts 一字未动，旧原文不改写）

parent #334-follow 令坐实：**run4/run8/run9/run10 四轮 U-1b 的 `archived=true` 是 kit 的
marker 级测量假红**。kit 的 mock archive 轮 tool call 只发 `{instanceId}`——公共入口
（packages/tools/src/tools.ts `makeDefinition().execute` ~:446-452 + `archiveMemberSpec`）
硬验 `rootSessionId + requestToken + targetInstanceId`，缺形即在入口 typed 拒，
`ARCHIVE_MEMBER` 从未到达 performAction——被"归档"的成员从未归档、仍 resident+SETTLED，
**行路由它在法律上是对的**。旧轮 `seenByRow=true` 测量本身为真（行确实路由），但对象是
未归档成员，故"archive 面真红"的定性不成立（当时如实报的现场原文全部保留原位，不改写）。
同时如实记：修复方 RED-first（`c33940d4`，生产程序形）证明的 **durable 法律缺口真实存
在**（真归档成功 + 冷启 re-mount → 旧代码开出第二条耐久审批），`5a4a25e7` 的 durable
admissibility oracle 已闭合之——本 kit 的 FACE2 腿在生产面独立复验。

kit 侧三处修复（全部属 kit，非判据）：① archive tool call 补齐合法公共入口参数
（rootSessionId + opaque requestToken + targetInstanceId），成败改以 **tool result** 判
（verdict 取自最后一条 tool_result 的展平 JSON，executed/rejected/errored/unknown，
raw 全文入账 `archive-turn.json`）；② U-1b 判据三件（行不见新 ask/零耐久请求/零写）不动，
新增 **FACE2**：归档后冷启 re-mount（生产 executeTool 面复活 residency）再 drive——
durable 法高于 residency，仍不可路由（restore 恢复面=派生面，本面无生产 restore 入口，
由修复 lane vitest FACE3 覆盖，披露）；③ kit 蓝图 leader `teamEnvelope` 补 `archive-member`
op（run11 首跑 `toolVerdict=rejected`，run12 以新捕获坐实原因
`TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS`（inBounds 六 op 无 archive-member）——信封法 fail-closed
正确，kit 蓝图漏授；补入后 run13 全绿。中间轮 run11/run12 为 kit 修复轮，run.log 留本地未提交
（本节即其结论），提交 receipts = 三个终轮 + kit + README。

### 终轮逐腿（19/19）

H0 · OS-0 · BD-0 · T-0(surface=20 deny=0) · T-2a · T-1 · T-2 · **P-1**（正控真落盘+consFacts=1）
· R-1 · M-1 · O-1 · E-1(arm A 原文) · X-1 · **U-1**（drop 面注销，宿主链 fail-closed 原文）
· **U-2**（冷启干净再注册 5→6，allowed-once 真写） · **U-1b 全绿**（下） · N-1 · B-1（逐字节
零差） · Z-0（401→401/pristine/homes 空）—— 全 PASS，**KIT_EXIT=0**。

U-1b 终轮原文（关键段）：`archived=true toolVerdict=executed e1=session-team-child-47cc…
instance=inst-0j124a200jai seenByRow=false outcome={"…ok":false,"error":"sandbox escalation
to \"workspace-write\" requires approval, but no approval channel is available",
"outcome":"threw"} obsDelta=["a5ptc: member-revoked root=…"]`（真归档触发 dispose→行注销
见证）+ `FACE2 remount=200/{"…glob…no Team Tool Binding…"} rmSeenByRow=false
rmOutcome={"…ok":false…}`（residency 翻回真后 durable oracle 仍拒路由，零耐久请求零写）。
