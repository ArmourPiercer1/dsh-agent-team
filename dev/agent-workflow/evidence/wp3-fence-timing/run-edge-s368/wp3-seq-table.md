# run-edge-s368 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+368ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:36:20.132Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-36-08","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:36:20.352Z | terminal mark |
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
 "anchorCreatedAt": "2026-11-11T14:36:19.965Z",
 "resolveSentAt": "2026-11-11T14:36:20.085Z",
 "resolveReturnedAt": "2026-11-11T14:36:20.154Z",
 "decisionCreatedAt": "2026-11-11T14:36:20.132Z",
 "stopSentAt": "2026-11-11T14:36:20.333Z",
 "stopReturnedAt": "2026-11-11T14:36:20.343Z",
 "stopAfterDecisionMs": 201,
 "stopAfterResolveSentMs": 248,
 "decisionAfterStopSentMs": -201,
 "abandonmentCreatedAt": "2026-11-11T14:36:20.352Z",
 "decisionToAbandonmentMs": 220,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 16945ms