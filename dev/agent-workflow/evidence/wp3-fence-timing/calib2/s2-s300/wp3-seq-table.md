# s2-s300 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **pre-fence**   planned resolve=+120ms stop=+300ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:24:28.586Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-24-17","kind":"human"} |

counter at final read: 16

| requirement | value |
| --- | --- |
| decisionAllow | true |
| stopAfterDecision | true |
| resolveBeforeStop | true |
| zeroConsumption | true |
| exactlyOneAbandonment | false |
| fenceReason | false |
| burnedSequence | false |
| noExecutionFact | true |
| zeroSideEffect | true |
| lateAllowRefusedAbandoned | false |
| lateAllowRefusedDecided | true |

timings: {
 "anchorCreatedAt": "2026-11-11T14:24:28.419Z",
 "resolveSentAt": "2026-11-11T14:24:28.539Z",
 "resolveReturnedAt": "2026-11-11T14:24:28.601Z",
 "decisionCreatedAt": "2026-11-11T14:24:28.586Z",
 "stopSentAt": "2026-11-11T14:24:28.719Z",
 "stopReturnedAt": "2026-11-11T14:24:28.727Z",
 "stopAfterDecisionMs": 133,
 "stopAfterResolveSentMs": 180,
 "decisionAfterStopSentMs": -133,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 16296ms