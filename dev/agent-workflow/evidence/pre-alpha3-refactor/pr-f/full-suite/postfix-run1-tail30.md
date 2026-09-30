CMD: pnpm test
WORKTREE: .worktrees/pre-alpha3-prf-closure
HEAD: b3e932b87e4fc70985b7d9a1a02da8f0c533a3a0
UTC START: 2026-09-30T07:01:06Z (NOTE: tail-30 ONLY — the raw log was lost to the capture-regex defect; the original run is recorded in the bookkeeping entry)
---
 ❯ packages/runtime/test/p6t3-restart.test.ts:404:18
    402|
    403|     const input = rt.inputMed
    404|     expect(input.sessionId).toBe(P6T3_SEEDS.leader.childSessionId)
       |                  ^
    405|     expect(input.attribution).toEqual({
    406|       kind: 'team-relay',

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[23/24]⎯

 FAIL  packages/runtime/test/p6t3-restart.test.ts > P6-T3 restart durability + pending-delivery recovery > 5. recovery aborts on the first hard failure (R5): earlier confirmations stay durable; the clean retry recovers ONLY the remainder
Error: assertMessagingCode: expected MessagingError 'MESSAGING_DELIVERY_FAILED', got undefined
 ❯ assertMessagingCode packages/runtime/test/p6t3-helpers.ts:360:11
    358| ): { readonly code: string; readonly details?: Record<string, unknown>…
    359|   if (!isMessagingError(error)) {
    360|     throw new Error(
       |           ^
    361|       `assertMessagingCode: expected MessagingError '${code}', got ${d…
    362|     )
 ❯ packages/runtime/test/p6t3-restart.test.ts:451:21

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[24/24]⎯


 Test Files  10 failed | 397 passed (407)
      Tests  21 failed | 4698 passed (4719)
   Start at  15:01:06
   Duration  16.69s (transform 50.80s, setup 0ms, import 228.80s, tests 6.73s, environment 45ms)

[ELIFECYCLE] Test failed. See above for more details.
