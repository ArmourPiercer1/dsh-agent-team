# run-fence-1 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+345ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:33:25.068Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-33-14","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:33:25.297Z | terminal mark |
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
 "anchorCreatedAt": "2026-11-11T14:33:24.900Z",
 "resolveSentAt": "2026-11-11T14:33:25.020Z",
 "resolveReturnedAt": "2026-11-11T14:33:25.082Z",
 "decisionCreatedAt": "2026-11-11T14:33:25.068Z",
 "stopSentAt": "2026-11-11T14:33:25.245Z",
 "stopReturnedAt": "2026-11-11T14:33:25.286Z",
 "stopAfterDecisionMs": 177,
 "stopAfterResolveSentMs": 225,
 "decisionAfterStopSentMs": -177,
 "abandonmentCreatedAt": "2026-11-11T14:33:25.297Z",
 "decisionToAbandonmentMs": 229,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 16802ms