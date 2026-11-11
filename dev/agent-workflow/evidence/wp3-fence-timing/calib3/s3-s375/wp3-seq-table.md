# s3-s375 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+375ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:29:20.491Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-29-10","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:29:20.699Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:29:20.324Z",
 "resolveSentAt": "2026-11-11T14:29:20.444Z",
 "resolveReturnedAt": "2026-11-11T14:29:20.509Z",
 "decisionCreatedAt": "2026-11-11T14:29:20.491Z",
 "stopSentAt": "2026-11-11T14:29:20.699Z",
 "stopReturnedAt": "2026-11-11T14:29:20.704Z",
 "stopAfterDecisionMs": 208,
 "stopAfterResolveSentMs": 255,
 "decisionAfterStopSentMs": -208,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 208
}

kit exit: 2   wall: 15506ms