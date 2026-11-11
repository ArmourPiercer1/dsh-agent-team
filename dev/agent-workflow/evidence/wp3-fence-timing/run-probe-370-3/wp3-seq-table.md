# run-probe-370-3 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+370ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:45:03.211Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-44-53","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:45:03.391Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:45:03.027Z",
 "resolveSentAt": "2026-11-11T14:45:03.147Z",
 "resolveReturnedAt": "2026-11-11T14:45:03.231Z",
 "decisionCreatedAt": "2026-11-11T14:45:03.211Z",
 "stopSentAt": "2026-11-11T14:45:03.397Z",
 "stopReturnedAt": "2026-11-11T14:45:03.402Z",
 "stopAfterDecisionMs": 186,
 "stopAfterResolveSentMs": 250,
 "decisionAfterStopSentMs": -186,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 180
}

kit exit: 2   wall: 15451ms