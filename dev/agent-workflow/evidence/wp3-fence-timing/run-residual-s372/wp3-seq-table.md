# run-residual-s372 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **residual-consumed**   planned resolve=+120ms stop=+372ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:40:11.154Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-40-00","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T14:40:11.350Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T14:40:10.981Z",
 "resolveSentAt": "2026-11-11T14:40:11.101Z",
 "resolveReturnedAt": "2026-11-11T14:40:11.169Z",
 "decisionCreatedAt": "2026-11-11T14:40:11.154Z",
 "stopSentAt": "2026-11-11T14:40:11.353Z",
 "stopReturnedAt": "2026-11-11T14:40:11.357Z",
 "stopAfterDecisionMs": 199,
 "stopAfterResolveSentMs": 252,
 "decisionAfterStopSentMs": -199,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 196
}

kit exit: 2   wall: 16794ms