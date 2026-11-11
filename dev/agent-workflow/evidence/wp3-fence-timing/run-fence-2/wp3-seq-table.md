# run-fence-2 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+345ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:33:41.885Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-33-30","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:33:42.101Z | terminal mark |
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
 "anchorCreatedAt": "2026-11-11T14:33:41.718Z",
 "resolveSentAt": "2026-11-11T14:33:41.838Z",
 "resolveReturnedAt": "2026-11-11T14:33:41.898Z",
 "decisionCreatedAt": "2026-11-11T14:33:41.885Z",
 "stopSentAt": "2026-11-11T14:33:42.063Z",
 "stopReturnedAt": "2026-11-11T14:33:42.088Z",
 "stopAfterDecisionMs": 178,
 "stopAfterResolveSentMs": 225,
 "decisionAfterStopSentMs": -178,
 "abandonmentCreatedAt": "2026-11-11T14:33:42.101Z",
 "decisionToAbandonmentMs": 216,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 16802ms