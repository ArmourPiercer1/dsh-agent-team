# pd41-committed — durable sequence table (CANDIDATE-C2, 9ac471678d545e0e94745d2ad0d35ff85cac4a3e)

verdict: **residual-consumed**   planned resolve=+120ms stop=+373ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T17:39:59.736Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T17-39-48","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T17:39:59.909Z | CONSUMPTION |

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
| zeroSideEffect | false |
| lateAllowRefusedAbandoned | false |
| lateAllowRefusedDecided | true |

timings: {
 "anchorCreatedAt": "2026-11-11T17:39:59.552Z",
 "resolveSentAt": "2026-11-11T17:39:59.672Z",
 "resolveReturnedAt": "2026-11-11T17:39:59.762Z",
 "decisionCreatedAt": "2026-11-11T17:39:59.736Z",
 "stopSentAt": "2026-11-11T17:39:59.925Z",
 "stopReturnedAt": "2026-11-11T17:40:03.209Z",
 "stopAfterDecisionMs": 189,
 "stopAfterResolveSentMs": 253,
 "decisionAfterStopSentMs": -189,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 173
}

kit exit: 2   wall: 20699ms