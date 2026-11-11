# s2-s700 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+700ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:25:25.484Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-25-14","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:25:25.664Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:25:25.293Z",
 "resolveSentAt": "2026-11-11T14:25:25.413Z",
 "resolveReturnedAt": "2026-11-11T14:25:25.506Z",
 "decisionCreatedAt": "2026-11-11T14:25:25.484Z",
 "stopSentAt": "2026-11-11T14:25:25.993Z",
 "stopReturnedAt": "2026-11-11T14:25:28.918Z",
 "stopAfterDecisionMs": 509,
 "stopAfterResolveSentMs": 580,
 "decisionAfterStopSentMs": -509,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 180
}

kit exit: 2   wall: 20168ms