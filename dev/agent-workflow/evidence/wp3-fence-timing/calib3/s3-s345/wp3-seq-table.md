# s3-s345 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+345ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:28:47.839Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-28-36","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:28:48.045Z | terminal mark |
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
 "anchorCreatedAt": "2026-11-11T14:28:47.665Z",
 "resolveSentAt": "2026-11-11T14:28:47.785Z",
 "resolveReturnedAt": "2026-11-11T14:28:47.854Z",
 "decisionCreatedAt": "2026-11-11T14:28:47.839Z",
 "stopSentAt": "2026-11-11T14:28:48.010Z",
 "stopReturnedAt": "2026-11-11T14:28:48.035Z",
 "stopAfterDecisionMs": 171,
 "stopAfterResolveSentMs": 225,
 "decisionAfterStopSentMs": -171,
 "abandonmentCreatedAt": "2026-11-11T14:28:48.045Z",
 "decisionToAbandonmentMs": 206,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 17141ms