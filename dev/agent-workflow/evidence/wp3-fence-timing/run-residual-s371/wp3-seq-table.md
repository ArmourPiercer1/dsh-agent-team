# run-residual-s371 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+371ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:39:54.352Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-39-43","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:39:54.555Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:39:54.185Z",
 "resolveSentAt": "2026-11-11T14:39:54.305Z",
 "resolveReturnedAt": "2026-11-11T14:39:54.366Z",
 "decisionCreatedAt": "2026-11-11T14:39:54.352Z",
 "stopSentAt": "2026-11-11T14:39:54.556Z",
 "stopReturnedAt": "2026-11-11T14:39:54.560Z",
 "stopAfterDecisionMs": 204,
 "stopAfterResolveSentMs": 251,
 "decisionAfterStopSentMs": -204,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 203
}

kit exit: 2   wall: 16856ms