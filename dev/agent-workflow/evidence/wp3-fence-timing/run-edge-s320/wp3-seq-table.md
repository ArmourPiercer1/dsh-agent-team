# run-edge-s320 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+320ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:35:46.352Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-35-35","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:35:46.569Z | terminal mark |
| 15 | *(no row)* | — | BURNED by the fence (gap) |

counter at final read: 18

| requirement | value |
| --- | --- |
| decisionAllow | true |
| stopAfterDecision | true |
| resolveBeforeStop | true |
| zeroConsumption | true |
| exactlyOneAbandonment | true |
| fenceReason | true |
| burnedSequence | true |
| noExecutionFact | true |
| zeroSideEffect | true |
| lateAllowRefusedAbandoned | true |
| lateAllowRefusedDecided | false |

timings: {
 "anchorCreatedAt": "2026-11-11T14:35:46.181Z",
 "resolveSentAt": "2026-11-11T14:35:46.301Z",
 "resolveReturnedAt": "2026-11-11T14:35:46.374Z",
 "decisionCreatedAt": "2026-11-11T14:35:46.352Z",
 "stopSentAt": "2026-11-11T14:35:46.501Z",
 "stopReturnedAt": "2026-11-11T14:35:46.559Z",
 "stopAfterDecisionMs": 149,
 "stopAfterResolveSentMs": 200,
 "decisionAfterStopSentMs": -149,
 "abandonmentCreatedAt": "2026-11-11T14:35:46.569Z",
 "decisionToAbandonmentMs": 217,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 16862ms