# pd41-s373 — durable sequence table (CANDIDATE-C2, 1dfc6d37c9d1c4b054826d9d9b1e2a874580a9ed)

verdict: **residual-consumed**   planned resolve=+120ms stop=+373ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T17:31:09.898Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T17-30-58","kind":"human"} |
| 15 | control-allow-consumed | 2026-11-11T17:31:10.063Z | CONSUMPTION |

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
 "anchorCreatedAt": "2026-11-11T17:31:09.731Z",
 "resolveSentAt": "2026-11-11T17:31:09.851Z",
 "resolveReturnedAt": "2026-11-11T17:31:09.911Z",
 "decisionCreatedAt": "2026-11-11T17:31:09.898Z",
 "stopSentAt": "2026-11-11T17:31:10.104Z",
 "stopReturnedAt": "2026-11-11T17:31:13.301Z",
 "stopAfterDecisionMs": 206,
 "stopAfterResolveSentMs": 253,
 "decisionAfterStopSentMs": -206,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": 165
}

kit exit: 2   wall: 20259ms