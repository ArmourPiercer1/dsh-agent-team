# s2-s520 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+520ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:25:05.309Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-24-54","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:25:05.517Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:25:05.136Z",
 "resolveSentAt": "2026-11-11T14:25:05.256Z",
 "resolveReturnedAt": "2026-11-11T14:25:05.324Z",
 "decisionCreatedAt": "2026-11-11T14:25:05.309Z",
 "stopSentAt": "2026-11-11T14:25:05.656Z",
 "stopReturnedAt": "2026-11-11T14:25:08.751Z",
 "stopAfterDecisionMs": 347,
 "stopAfterResolveSentMs": 400,
 "decisionAfterStopSentMs": -347,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 208
}

kit exit: 2   wall: 20035ms