# run-edge-s374 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+374ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:36:37.133Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-36-25","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:36:37.335Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:36:36.962Z",
 "resolveSentAt": "2026-11-11T14:36:37.082Z",
 "resolveReturnedAt": "2026-11-11T14:36:37.148Z",
 "decisionCreatedAt": "2026-11-11T14:36:37.133Z",
 "stopSentAt": "2026-11-11T14:36:37.336Z",
 "stopReturnedAt": "2026-11-11T14:36:37.340Z",
 "stopAfterDecisionMs": 203,
 "stopAfterResolveSentMs": 254,
 "decisionAfterStopSentMs": -203,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 202
}

kit exit: 2   wall: 16999ms