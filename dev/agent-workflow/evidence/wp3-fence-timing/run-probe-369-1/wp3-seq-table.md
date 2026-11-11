# run-probe-369-1 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+369ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:43:33.306Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-43-21","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:43:33.515Z | terminal mark |
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
 "anchorCreatedAt": "2026-11-11T14:43:33.135Z",
 "resolveSentAt": "2026-11-11T14:43:33.255Z",
 "resolveReturnedAt": "2026-11-11T14:43:33.320Z",
 "decisionCreatedAt": "2026-11-11T14:43:33.306Z",
 "stopSentAt": "2026-11-11T14:43:33.504Z",
 "stopReturnedAt": "2026-11-11T14:43:33.508Z",
 "stopAfterDecisionMs": 198,
 "stopAfterResolveSentMs": 249,
 "decisionAfterStopSentMs": -198,
 "abandonmentCreatedAt": "2026-11-11T14:43:33.515Z",
 "decisionToAbandonmentMs": 209,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 17114ms