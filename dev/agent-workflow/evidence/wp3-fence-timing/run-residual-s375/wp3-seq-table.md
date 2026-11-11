# run-residual-s375 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+375ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:40:48.785Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-40-37","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:40:48.983Z | CONSUMPTION |

counter at final read: 18

| requirement | value |
| --- | --- |
| decisionAllow | true |
| stopAfterDecision | true |
| resolveBeforeStop | true |
| zeroConsumption | false |
| exactlyOneAbandonment | false |
| fenceReason | false |
| burnedSequence | false |
| noExecutionFact | false |
| zeroSideEffect | true |
| lateAllowRefusedAbandoned | false |
| lateAllowRefusedDecided | true |

timings: {
 "anchorCreatedAt": "2026-11-11T14:40:48.619Z",
 "resolveSentAt": "2026-11-11T14:40:48.739Z",
 "resolveReturnedAt": "2026-11-11T14:40:48.804Z",
 "decisionCreatedAt": "2026-11-11T14:40:48.785Z",
 "stopSentAt": "2026-11-11T14:40:48.994Z",
 "stopReturnedAt": "2026-11-11T14:40:52.222Z",
 "stopAfterDecisionMs": 209,
 "stopAfterResolveSentMs": 255,
 "decisionAfterStopSentMs": -209,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 198
}

kit exit: 2   wall: 20689ms