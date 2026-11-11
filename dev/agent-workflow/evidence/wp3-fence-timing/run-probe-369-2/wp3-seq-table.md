# run-probe-369-2 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+369ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:43:50.202Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-43-39","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:43:50.374Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:43:50.033Z",
 "resolveSentAt": "2026-11-11T14:43:50.153Z",
 "resolveReturnedAt": "2026-11-11T14:43:50.222Z",
 "decisionCreatedAt": "2026-11-11T14:43:50.202Z",
 "stopSentAt": "2026-11-11T14:43:50.402Z",
 "stopReturnedAt": "2026-11-11T14:43:53.619Z",
 "stopAfterDecisionMs": 200,
 "stopAfterResolveSentMs": 249,
 "decisionAfterStopSentMs": -200,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 172
}

kit exit: 2   wall: 20108ms