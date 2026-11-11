# run-probe-370-1 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+370ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:44:29.084Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-44-19","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:44:29.253Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:44:28.908Z",
 "resolveSentAt": "2026-11-11T14:44:29.028Z",
 "resolveReturnedAt": "2026-11-11T14:44:29.103Z",
 "decisionCreatedAt": "2026-11-11T14:44:29.084Z",
 "stopSentAt": "2026-11-11T14:44:29.278Z",
 "stopReturnedAt": "2026-11-11T14:44:32.504Z",
 "stopAfterDecisionMs": 194,
 "stopAfterResolveSentMs": 250,
 "decisionAfterStopSentMs": -194,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 169
}

kit exit: 2   wall: 18678ms