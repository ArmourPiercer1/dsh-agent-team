# closure full-suite run 1 — TAIL-25 ONLY (raw log disclosure)

- CMD: pnpm test (full root suite, series closure run 1 on merged master)
- WORKTREE: main checkout (/home/user/dsh-plugins/dsh-agent-team, branch master)
- HEAD: 533dfcbb849116db86dac2f901e2de9d7df79289
- UTC START: ~2026-09-30T07:29:21Z (vitest "Start at" 15:29:21 local = UTC+8 → 07:29:21Z)
- **DISCLOSURE**: run 1 的 raw log 仅捕获 tail-25（background job 的 stdout 经 `| tail -25` 管道, 全量 raw 未落盘 — 与 PR-F postfix-run1 同类 capture 缺陷; 自披露, 不重跑）。tail-25 逐字在案 = 下方。
- **结果（tail-25 可核验）**: Test Files 10 failed | 397 passed (407) / Tests 21 failed | 4698 passed (4719) = 精确基线 9F|19F + p6t1-parallel P1 同族 1F|2T（run 2 全量 raw 逐测试名核验 = 同构失败集, 见 run2.log + 本目录 summary）。

## tail-25 (verbatim)

    405|     expect(input.attribution).toEqual({
    406|       kind: 'team-relay',

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[23/24]⎯

 FAIL  packages/runtime/test/p6t3-restart.test.ts > P6-T3 restart durability + pending-delivery recovery > 5. recovery aborts on the first hard failure (R5): earlier confirmations stay durable; the clean retry recovers ONLY the remainder
Error: assertMessagingCode: expected MessagingError 'MESSAGING_DELIVERY_FAILED', got undefined
 ❯ assertMessagingCode packages/runtime/test/p6t3-helpers.ts:360:11
    358| ): { readonly code: string; readonly details?: Record<string, unknown>…
    359|   if (!isMessagingError(error)) {
    360|     throw new Error(
       |     ^
    361|       `assertMessagingCode: expected MessagingError '${code}', got ${d…
    362|     }
 ❯ packages/runtime/test/p6t3-restart.test.ts:451:21

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[24/24]⎯


 Test Files  10 failed | 397 passed (407)
      Tests  21 failed | 4698 passed (4719)
   Start at  15:29:21
   Duration  15.80s (transform 51.80s, setup 0ms, import 236.60s, tests 6.85s, environment 46ms)

[ELIFECYCLE] Test failed. See above for more details.
