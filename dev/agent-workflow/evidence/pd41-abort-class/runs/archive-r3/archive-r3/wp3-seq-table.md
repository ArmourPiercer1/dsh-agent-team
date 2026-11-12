# archive-r3 — durable sequence table (CANDIDATE-C2, 8c178680e4c21f930843015a8e0aea36e185781d)

verdict: **residual-consumed**   planned resolve=+240ms stop=+600ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T20:12:26.395Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T20-12-15","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T20:12:26.522Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T20:12:26.121Z",
 "resolveSentAt": "2026-11-11T20:12:26.361Z",
 "resolveReturnedAt": "2026-11-11T20:12:26.408Z",
 "decisionCreatedAt": "2026-11-11T20:12:26.395Z",
 "stopSentAt": "2026-11-11T20:12:26.721Z",
 "stopReturnedAt": "2026-11-11T20:12:29.873Z",
 "stopAfterDecisionMs": 326,
 "stopAfterResolveSentMs": 360,
 "decisionAfterStopSentMs": -326,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 127
}

kit exit: 2   wall: 20112ms