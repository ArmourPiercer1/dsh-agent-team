# run-probe-369-3 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+369ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:44:10.345Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-43-59","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:44:10.518Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:44:10.174Z",
 "resolveSentAt": "2026-11-11T14:44:10.294Z",
 "resolveReturnedAt": "2026-11-11T14:44:10.364Z",
 "decisionCreatedAt": "2026-11-11T14:44:10.345Z",
 "stopSentAt": "2026-11-11T14:44:10.543Z",
 "stopReturnedAt": "2026-11-11T14:44:13.785Z",
 "stopAfterDecisionMs": 198,
 "stopAfterResolveSentMs": 249,
 "decisionAfterStopSentMs": -198,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 173
}

kit exit: 2   wall: 20167ms