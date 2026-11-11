# run-residual-s370 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+370ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:39:37.502Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-39-26","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:39:37.713Z | terminal mark |
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
 "anchorCreatedAt": "2026-11-11T14:39:37.331Z",
 "resolveSentAt": "2026-11-11T14:39:37.451Z",
 "resolveReturnedAt": "2026-11-11T14:39:37.516Z",
 "decisionCreatedAt": "2026-11-11T14:39:37.502Z",
 "stopSentAt": "2026-11-11T14:39:37.701Z",
 "stopReturnedAt": "2026-11-11T14:39:37.705Z",
 "stopAfterDecisionMs": 199,
 "stopAfterResolveSentMs": 250,
 "decisionAfterStopSentMs": -199,
 "abandonmentCreatedAt": "2026-11-11T14:39:37.713Z",
 "decisionToAbandonmentMs": 211,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 16825ms