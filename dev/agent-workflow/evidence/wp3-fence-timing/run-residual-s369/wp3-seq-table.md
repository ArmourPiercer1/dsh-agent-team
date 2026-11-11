# run-residual-s369 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+369ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:39:20.675Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-39-09","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:39:20.879Z | CONSUMPTION |

counter at final read: 17

| requirement | value |
| --- | --- |
| decisionAllow | true |
| stopAfterDecision | true |
| resolveBeforeStop | true |
| zeroConsumption | false |
| exactlyOneAbandonment | false |
| fenceReason | false |
| burnedSequence | false |
| noExecutionFact | true |
| zeroSideEffect | true |
| lateAllowRefusedAbandoned | false |
| lateAllowRefusedDecided | true |

timings: {
 "anchorCreatedAt": "2026-11-11T14:39:20.510Z",
 "resolveSentAt": "2026-11-11T14:39:20.630Z",
 "resolveReturnedAt": "2026-11-11T14:39:20.690Z",
 "decisionCreatedAt": "2026-11-11T14:39:20.675Z",
 "stopSentAt": "2026-11-11T14:39:20.879Z",
 "stopReturnedAt": "2026-11-11T14:39:20.884Z",
 "stopAfterDecisionMs": 204,
 "stopAfterResolveSentMs": 249,
 "decisionAfterStopSentMs": -204,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 204
}

kit exit: 2   wall: 16844ms