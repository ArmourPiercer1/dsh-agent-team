# W5 six-event live table (gated run 2026-10-17T02-15-32Z)

| event name (full prefix, master@452a04c0 face) | live lease settle | live stream count |
|---|---|---|
| dispatcher-call-cancelled-before-body | accepted | 0 |
| dispatcher-call-terminated-after-body-start | accepted | 0 |
| dispatcher-call-completed-after-abort | accepted | 0 |
| dispatcher-call-outcome-unreadable | accepted | 0 |
| dispatcher-call-cancelled-by-others | accepted | 0 |
| dispatcher-call-executed-unvalidated | accepted | 0 |
| `call-cancelled-before-body` (retired v1.0 short form) | REFUSED `spill-settlement-event-unknown` | 0 (never emitted) |

live stream dispatcher-call-* lifecycle names (master emitters scoped-dispatcher.ts:528/535/545/559):
- dispatcher-call-begin = 7
- dispatcher-call-end = 5
- dispatcher-call-refused = 2

guard-denial = 2 (the two unbound-probe calls refused at the call edge); dispatcher-call-refused = 2
