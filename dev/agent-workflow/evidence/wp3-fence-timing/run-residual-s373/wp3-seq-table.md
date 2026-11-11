# run-residual-s373 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+373ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:40:28.073Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-40-16","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:40:28.250Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:40:27.887Z",
 "resolveSentAt": "2026-11-11T14:40:28.007Z",
 "resolveReturnedAt": "2026-11-11T14:40:28.095Z",
 "decisionCreatedAt": "2026-11-11T14:40:28.073Z",
 "stopSentAt": "2026-11-11T14:40:28.260Z",
 "stopReturnedAt": "2026-11-11T14:40:31.531Z",
 "stopAfterDecisionMs": 187,
 "stopAfterResolveSentMs": 253,
 "decisionAfterStopSentMs": -187,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 177
}

kit exit: 2   wall: 20175ms