# run-edge-s362 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **fence-reached**   planned resolve=+120ms stop=+362ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:36:03.204Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-35-52","kind":"human"} |
| 16 | control-request-abandoned (invocation-cancelled-before-consumption) | 2026-11-11T14:36:03.406Z | terminal mark |
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
 "anchorCreatedAt": "2026-11-11T14:36:03.033Z",
 "resolveSentAt": "2026-11-11T14:36:03.153Z",
 "resolveReturnedAt": "2026-11-11T14:36:03.228Z",
 "decisionCreatedAt": "2026-11-11T14:36:03.204Z",
 "stopSentAt": "2026-11-11T14:36:03.395Z",
 "stopReturnedAt": "2026-11-11T14:36:03.399Z",
 "stopAfterDecisionMs": 191,
 "stopAfterResolveSentMs": 242,
 "decisionAfterStopSentMs": -191,
 "abandonmentCreatedAt": "2026-11-11T14:36:03.406Z",
 "decisionToAbandonmentMs": 202,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 16840ms