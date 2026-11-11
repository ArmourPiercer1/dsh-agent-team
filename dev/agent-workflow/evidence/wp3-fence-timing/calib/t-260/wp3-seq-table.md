# t-260 — durable sequence table (CANDIDATE-C2, bb3c158eb1f76f8db429da01e9a4c5a0e118ca90)

verdict: **pre-fence**   planned resolve=+200ms stop=+260ms

| seq | fact | createdAt | note |
| --- | --- | --- | --- |
| 14 | control-decision-recorded (allow) | 2026-11-11T14:23:44.615Z | decider={"humanId":"session-c1-smoke-a6-2026-11-11T14-23-33","kind":"human"} |

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
 "anchorCreatedAt": "2026-11-11T14:23:44.380Z",
 "resolveSentAt": "2026-11-11T14:23:44.580Z",
 "resolveReturnedAt": "2026-11-11T14:23:44.627Z",
 "decisionCreatedAt": "2026-11-11T14:23:44.615Z",
 "stopSentAt": "2026-11-11T14:23:44.640Z",
 "stopReturnedAt": "2026-11-11T14:23:44.648Z",
 "stopAfterDecisionMs": 25,
 "stopAfterResolveSentMs": 60,
 "decisionAfterStopSentMs": -25,
 "abandonmentCreatedAt": null,
 "decisionToAbandonmentMs": null,
 "decisionToConsumptionMs": null
}

kit exit: 0   wall: 16664ms