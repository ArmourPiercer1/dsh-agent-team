# s2-s400 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+400ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:24:45.261Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-24-34","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:24:45.482Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:24:45.094Z",
 "resolveSentAt": "2026-11-11T14:24:45.214Z",
 "resolveReturnedAt": "2026-11-11T14:24:45.277Z",
 "decisionCreatedAt": "2026-11-11T14:24:45.261Z",
 "stopSentAt": "2026-11-11T14:24:45.494Z",
 "stopReturnedAt": "2026-11-11T14:24:48.715Z",
 "stopAfterDecisionMs": 233,
 "stopAfterResolveSentMs": 280,
 "decisionAfterStopSentMs": -233,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 221
}

kit exit: 2   wall: 19989ms