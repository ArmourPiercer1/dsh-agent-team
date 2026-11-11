# archive-r2 — durable sequence table (CANDIDATE-C2, b5df94c3f064cae5a930085dbbee117e385d446f)

verdict: **residual-consumed**   planned resolve=+240ms stop=+420ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T20:10:18.930Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T20-10-07","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T20:10:19.036Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T20:10:18.656Z",
 "resolveSentAt": "2026-11-11T20:10:18.896Z",
 "resolveReturnedAt": "2026-11-11T20:10:18.943Z",
 "decisionCreatedAt": "2026-11-11T20:10:18.930Z",
 "stopSentAt": "2026-11-11T20:10:19.076Z",
 "stopReturnedAt": "2026-11-11T20:10:22.378Z",
 "stopAfterDecisionMs": 146,
 "stopAfterResolveSentMs": 180,
 "decisionAfterStopSentMs": -146,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 106
}

kit exit: 2   wall: 20244ms