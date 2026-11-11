# run-fence-3 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+345ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:33:58.671Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-33-47","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:33:58.895Z | terminal mark |
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
 "anchorCreatedAt": "2026-11-11T14:33:58.505Z",
 "resolveSentAt": "2026-11-11T14:33:58.625Z",
 "resolveReturnedAt": "2026-11-11T14:33:58.685Z",
 "decisionCreatedAt": "2026-11-11T14:33:58.671Z",
 "stopSentAt": "2026-11-11T14:33:58.850Z",
 "stopReturnedAt": "2026-11-11T14:33:58.886Z",
 "stopAfterDecisionMs": 179,
 "stopAfterResolveSentMs": 225,
 "decisionAfterStopSentMs": -179,
 "abandonmentCreatedAt": "2026-11-11T14:33:58.895Z",
 "decisionToAbandonmentMs": 224,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 16798ms