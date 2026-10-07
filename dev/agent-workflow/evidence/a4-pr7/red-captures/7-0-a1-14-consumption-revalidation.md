# 7.0 RED capture — A1-14 consumption revalidation is unenforced

Command (worktree `.worktrees/a4-pr7`, base `c7537872`, before any production change):

    npx vitest run packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts

Result: `Test Files 1 failed (1)` / `Tests 5 failed (5)`.

The decisive line is A1: after the fresh ceiling says the reviewing authority is
no longer sufficient, `guardOperation` returns `allowed: true` and writes the
`control-allow-consumed` row. `CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_RISEN` /
`AUTHORITY_UNDETERMINED` do not exist yet (`reason: undefined` in the diff),
because nothing in `control/service.ts` consults an authority port. A4 shows the
write side accepting an operation-case leg with no `authorityScope` at all, and
A5/A6 shows the recheck port never being called (`callsAfterFirst: 0`).

## raw output

```

 RUN  v4.1.11 /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-pr7

 ❯ packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts (5 tests | 5 failed) 9ms
     × A1: an authority rise after the allow refuses with ZERO consumption, and the unspent allow still authorizes once 5ms
     × A2: an undetermined fresh ceiling refuses and consumes nothing 1ms
     × A3: the persisted authority point is the authorized point 1ms
     × A4: a v3 operation case with no persisted authorityScope is corrupt, not unsampled 1ms
     × A5/A6: a re-confirmed allow runs the recheck once and consumes exactly once 0ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts > A1-14 — the consumption point re-runs the ceiling for the persisted scope > A1: an authority rise after the allow refuses with ZERO consumption, and the unspent allow still authorizes once
AssertionError: expected { allowed: true, …(2) } to deeply equal { allowed: false, …(2) }

- Expected
+ Received

  {
-   "allowed": false,
-   "reason": undefined,
+   "allowed": true,
+   "decisionSequence": 2,
    "requestId": "ctrl-14xs5530jy3wew1ei9ncd1hv",
  }

 ❯ packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts:407:24
    405| describe('A1-14 — the consumption point re-runs the ceiling for the pe…
    406|   it('A1: an authority rise after the allow refuses with ZERO consumpt…
    407|     expect(a1.refused).toEqual({
       |                        ^
    408|       allowed: false,
    409|       reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_RISEN,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts > A1-14 — the consumption point re-runs the ceiling for the persisted scope > A2: an undetermined fresh ceiling refuses and consumes nothing
AssertionError: expected { allowed: true, …(2) } to match object { allowed: false, reason: undefined }
(2 matching properties omitted from actual)

- Expected
+ Received

  {
-   "allowed": false,
-   "reason": undefined,
+   "allowed": true,
  }

 ❯ packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts:443:24
    441|
    442|   it('A2: an undetermined fresh ceiling refuses and consumes nothing',…
    443|     expect(a2.refused).toMatchObject({
       |                        ^
    444|       allowed: false,
    445|       reason: CONTROL_GUARD_BLOCK_REASONS.AUTHORITY_UNDETERMINED,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts > A1-14 — the consumption point re-runs the ceiling for the persisted scope > A3: the persisted authority point is the authorized point
AssertionError: expected { allowed: true, …(2) } to match object { allowed: false, …(1) }
(2 matching properties omitted from actual)

- Expected
+ Received

  {
-   "allowed": false,
-   "reason": "scope-mismatch",
+   "allowed": true,
  }

 ❯ packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts:451:30
    449|
    450|   it('A3: the persisted authority point is the authorized point', () =…
    451|     expect(a3.otherResource).toMatchObject({
       |                              ^
    452|       allowed: false,
    453|       reason: CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts > A1-14 — the consumption point re-runs the ceiling for the persisted scope > A4: a v3 operation case with no persisted authorityScope is corrupt, not unsampled
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts:467:24
    465|
    466|   it('A4: a v3 operation case with no persisted authorityScope is corr…
    467|     expect(a4.written).toBe(false)
       |                        ^
    468|     expect(a4.refused).toBeNull()
    469|     expect(a4.rows).toBe(0)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts > A1-14 — the consumption point re-runs the ceiling for the persisted scope > A5/A6: a re-confirmed allow runs the recheck once and consumes exactly once
AssertionError: expected +0 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 0

 ❯ packages/runtime/test/a4p7-a1-14-consumption-revalidation.test.ts:476:32
    474|     expect(a5.callsAfterAllow).toBe(0)
    475|     expect(a5.first.allowed).toBe(true)
    476|     expect(a5.callsAfterFirst).toBe(1)
       |                                ^
    477|     expect(a5.second).toMatchObject({ allowed: false, reason: CONTROL_…
    478|     expect(a5.rows).toBe(1)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯


 Test Files  1 failed (1)
      Tests  5 failed (5)
   Start at  18:07:48
   Duration  837ms (transform 549ms, setup 0ms, import 737ms, tests 9ms, environment 0ms)





```
