# Alpha.6 closing round — 2026-11-07 (Draft, DO-NOT-MERGE)

Product HEAD: `54f39e09d` (Draft branch `alpha6/int-20261103`).
Scheme A remains frozen: an invalidated call is never replayed, a Grant is never
re-consumed, a tool is never re-executed, and an approval decision is never
rewritten by an execution/lifecycle failure.

## What is implemented and verified

1. **Strict Root ownership at boot settlement.** Control requests are stamped
   with `ownerRootSessionId` at mount time; settlement only touches rows whose
   owner exactly equals the boot root. Absent owner = unowned and never settled
   (fail-closed, never abandoned).
   - Unit: `packages/runtime/test/a5-m1-auth-bridge.test.ts` — two services
     mounted as Root A / Root B over one domain; abandoning A leaves B's Allow,
     `decided` status, zero consumption and execution state untouched.
   - Real-host reboot: `a6-crash-allow-r5` A6-15 PASS (allow intact, zero
     consumption/execution, abandon `invocation-abandoned`, not revived).

2. **Minimal durable execution-result fact.**
   `control-execution-result` (`succeeded` / `failed` / `unknown`) is projected
   into the `control` category and mirrored on the client map. It is audit-only:
   it never authorizes or replays anything.
   - `recordExecutionResult` is exactly-once and matches the durable PA request
     by `callId`; a second outcome records nothing.
   - Body-started-but-result-not-durable: `a6-crash-body-r6` A6-16b PASS —
     `execution-outcome-unknown`, zero replay, consumption stays 1, no file.
     Durable ledger confirms one `control-execution-result` with
     `outcome:"unknown"` before the abandonment.
   - **Open gap:** the post-backend success/failure hook is wired through the
     governed tool pipeline, but the normal A6 lane (`a6-normal-r10..r16`) did
     not produce a `succeeded` fact. No claim of automatic success-fact
     coverage is made for that lane.

3. **Flag-on / flag-off A6 regression.** The same undetermined ALLOW with the
   flag OFF writes the durable `deny authority-undetermined` (existing test);
   with `a6AbandonUndeterminedAllow` ON it writes **no decision**, abandons the
   invocation (`invocation-abandoned`) and consumes nothing. The original
   approval history is retained and is not rewritten.

4. **Accepted-but-never-claimed Inbox crash.** **Not injected in this round.**
   The existing `a6-inbox-r17` proves the CLAIMED case (exactly one additional
   wake turn start, message retained). The ACCEPTED-not-CLAIMED adopt /
   re-plan / retain-Intent matrix remains an explicit open acceptance item.

## Gate

- `CI=true node scripts/ci-pr-gate.mjs --full` at `54f39e09d`:
  **8 of 9 legs PASS** — graph-parse, kit-home-guard, state-freshness, install,
  blueprint-fence, typecheck, lint-identities, artifacts-at-head.
- Census is **blocked by an environmental listener**: an orphan mini-MCP server
  holds `127.0.0.1:3983` outside this sandbox's PID namespace, so
  `u6-mcp-017-regression` cannot bind its fixed port. The same test passed at
  the previous gate `36167927f`; this is not a product-code regression. The
  census file set/line counts are otherwise the expected movement
  (677 files / 8835 lines; +1 test in an existing file).
- Hosted CI: **not run** for `54f39e09d`.

## Disposition

- Keep Draft / DO-NOT-MERGE; no push, no master merge, no production enable,
  no release. Master / production / release remain **NO-GO**.
- Restricted, isolated, opt-in internal trial only for the covered claims
  (owner-scoped settlement, flag-on abandonment, unknown-outcome crash). Do not
  claim success-fact coverage or ACCEPTED-not-CLAIMED Inbox coverage.
