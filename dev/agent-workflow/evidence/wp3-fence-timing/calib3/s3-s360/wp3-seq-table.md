# s3-s360 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+360ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:29:05.003Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-28-53","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:29:05.206Z | terminal mark |
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
 "anchorCreatedAt": "2026-11-11T14:29:04.828Z",
 "resolveSentAt": "2026-11-11T14:29:04.948Z",
 "resolveReturnedAt": "2026-11-11T14:29:05.019Z",
 "decisionCreatedAt": "2026-11-11T14:29:05.003Z",
 "stopSentAt": "2026-11-11T14:29:05.188Z",
 "stopReturnedAt": "2026-11-11T14:29:05.196Z",
 "stopAfterDecisionMs": 185,
 "stopAfterResolveSentMs": 240,
 "decisionAfterStopSentMs": -185,
 "abandonmentCreatedAt": "2026-11-11T14:29:05.206Z",
 "decisionToAbandonmentMs": 203,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 17162ms