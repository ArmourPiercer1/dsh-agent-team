# F9 G3 allow half — `f9-check consumed` FAIL diagnosis (live r2, boot#1 repair-r2-b1r)

## Result
`f9-check consumed --request-id ctrl-1utbsww1kjuqwl08yzyyu0ma` →
`FAIL consumed exactly-once ... expected exactly 1 control-allow-consumed fact ..., got 0`
(0 PASS, 1 FAIL, exit 1)

## Observed world state (durable)
- request ① (user-approval, actionName=write, correlation=dtest-v2-req-ua-1, target=inst-0fi1an617bjs) — recorded, seq 3
- decision ① allow, decider=human (UI Allow click, f9-g3-allow PASS) — decided PASS
- t41-exec leader turn (turn 2, 52.3s) → team_follow_up(W1, requestToken=dtest-v2-ua-exec) executed
- W1 member turn (turn 2) → base `write` tool call; W1 reported:
  - the relative path `tests/mock-outside/probe/v2-probe-1.txt` resolved against the SESSION WORKSPACE ROOT
    (`D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock`) → landed at
    `D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\tests\mock-outside\probe\v2-probe-1.txt`
  - content `V2-UA-CONTENT`, verified by read-back; write succeeded in default sandbox (path inside workspace after resolution)
- `control-allow-consumed` facts: **0** (consumed check FAIL)
- repo-level `tests/mock-outside/probe/v2-probe-1.txt`: does NOT exist

## Classification: NOT credentials / host / browser. Asset-expectation vs frozen product-semantics mismatch.

The product guard semantics (frozen, unchanged by the F9 repair) do not consume allows for base-tool writes:

1. `packages/tools/src/guard.ts` (SD-GUARD): the last-mile guard is consulted for the guarded TEAM
   work operations only. `no-request → proceed` is explicit (documented deviation): operations with no
   matching durable request fall through to the runtime facade.
2. `packages/tools/src/tools.ts` `executeGuarded` (L254-282): only `team_delegate` / `team_follow_up` /
   `team_send_message` / `team_report_progress` consult the guard; scope =
   `{root, targetInstanceId, actionName ∈ {delegate, follow-up, send-message, report-progress},
   toolName: <team tool>, correlation: <that call's requestToken>}`.
3. `packages/runtime/control/service.ts` `guardOperation` (L995+): match is by exact scope key
   `(root, target, actionName, toolName, correlation)`. Request ① is
   `(inst-0fi1an617bjs, write, <no toolName>, dtest-v2-req-ua-1)` — no team operation exists with
   actionName=`write`, and the t41-exec follow-up carries requestToken `dtest-v2-ua-exec`
   (≠ `dtest-v2-req-ua-1`). Therefore no consulted scope can ever match request ①; its allow can
   never be consumed by the tool pipeline.
4. V1 campaign precedent (pre-F9, same semantics): `tests/mock/evidence/NOTES.md` F10 (product
   architecture semantics: guard wraps only the four team work operations; base tools are gated by the
   host file sandbox as an independent pre-gate) and T4.3 OBS: "guard 未消费：域内
   control-allow-consumed = 0 —— 本次执行的物理路径是基础 write 走宿主沙箱升级放行，未走 team guard
   （F10: guard 只包裹 team 工作操作）；durable allow 保持未消费。guard 的消耗/恰一次路径由 T4.5 用受
   控 team 操作（follow-up + 同 correlation requestToken）实测"。
5. Frozen contract for this repair: L173 "first-decision-authoritative, exactly-once allow consumption,
   'decision ≠ execution' (last-mile guard) all unchanged"; L436 (F9-H) "exactly-once ... preserved".
   The F9 fix added the human ingress only; it did not (and per the frozen docs must not) change guard
   or consumption semantics.

## Consequence for the allow half
- The allow's practical effect DID occur (the member's write executed and verified read-back) — the
  "放行" part of the R-F9 row is demonstrated.
- The allow is durably unconsumed (exactly-once safe: a future operation with the matching scope could
  still consume it; no double-execution risk).
- The committed asset sequence `f9-check consumed --request-id <rid>` after a member base-write of a
  `write`-intent request is unsatisfiable under the frozen product semantics with the committed
  recipes (b4-requests + t41-exec). This is the same gap V1's T4.3 OBS documented; the F9 asset doc
  §4 G3-allow line encodes the R-F9 row text ("UI human allow → guarded write → consumed") literally
  without reconciling the F10 scope.
- No product source, upstream, plan, graph, or router log was modified; no fabricated state. The FAIL
  stands as recorded (exact exit code captured in 11-f9-consumed-allow.txt).
