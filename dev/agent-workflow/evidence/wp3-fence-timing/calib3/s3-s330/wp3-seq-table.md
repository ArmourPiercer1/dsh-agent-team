# s3-s330 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+330ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:28:30.684Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-28-19","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:28:30.906Z | terminal mark |
| 15 | *(no row)* | — | BURNED by the fence (gap) |

counter at final read: 18

| requirement | value |
| --- | --- |
| decisionAllow | true |
| stopAfterDecision | true |
| resolveBeforeStop | true |
| zeroConsumption | true |
| exactlyOneAbandonment | true |
| fenceReason | true |
| burnedSequence | true |
| noExecutionFact | true |
| zeroSideEffect | true |
| lateAllowRefusedAbandoned | true |
| lateAllowRefusedDecided | false |

timings: {
 "anchorCreatedAt": "2026-11-11T14:28:30.511Z",
 "resolveSentAt": "2026-11-11T14:28:30.631Z",
 "resolveReturnedAt": "2026-11-11T14:28:30.703Z",
 "decisionCreatedAt": "2026-11-11T14:28:30.684Z",
 "stopSentAt": "2026-11-11T14:28:30.841Z",
 "stopReturnedAt": "2026-11-11T14:28:30.895Z",
 "stopAfterDecisionMs": 157,
 "stopAfterResolveSentMs": 210,
 "decisionAfterStopSentMs": -157,
 "abandonmentCreatedAt": "2026-11-11T14:28:30.906Z",
 "decisionToAbandonmentMs": 222,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 17409ms