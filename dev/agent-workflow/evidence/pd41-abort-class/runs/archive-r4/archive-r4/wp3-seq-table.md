# archive-r4 — durable sequence table (CANDIDATE-C2, 8c178680e4c21f930843015a8e0aea36e185781d)

verdict: **residual-consumed**   planned resolve=+240ms stop=+1400ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T20:13:05.154Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T20-12-54","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T20:13:05.266Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T20:13:04.878Z",
 "resolveSentAt": "2026-11-11T20:13:05.118Z",
 "resolveReturnedAt": "2026-11-11T20:13:05.167Z",
 "decisionCreatedAt": "2026-11-11T20:13:05.154Z",
 "stopSentAt": "2026-11-11T20:13:06.278Z",
 "stopReturnedAt": "2026-11-11T20:13:08.622Z",
 "stopAfterDecisionMs": 1124,
 "stopAfterResolveSentMs": 1160,
 "decisionAfterStopSentMs": -1124,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 112
}

kit exit: 2   wall: 20150ms