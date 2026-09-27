# Startup failure isolation — minimal supplement (PR #31 branch)

**Date**: 2026-09-27 · **Branch**: `task/team-restart-017rc1` · **Base**: PR #31 head
(`bd69ff5`, the S6 push-record commit) · **Scope**: ONE product change
(`packages/runtime/src/plugin/host.ts`) + tests
(`packages/runtime/test/team-session-startup-fence.test.ts`) + rebuilt dist
mirror. ZERO upstream / ZERO Remote-contract / ZERO C1 exact-generation ·
single-flight · rollback-epoch changes. The accepted "restart 后 same-page
composer 需刷新" (NO-GO-C1) is untouched.

## Problem

`apply()` registers the Team activation fence's `agent/created` listener at
the VERY FRONT (process-wide, `{ global: true }`), but the fence's
`ownershipResolver` binds only AFTER the domain open inside `bootstrap()`.
If the bootstrap rejects at or before the domain open, `ownershipReady`
never settles. The row keeps running (a failed boot is terminal — no
automatic retry — but the route stays registered and the row stops only on
its own teardown), so the row-stop backstop's `close()` never runs. Every
LATER ordinary `agent/created` in the process — the listener is
process-wide — would await `ownershipReady` forever (classification PENDING
that can never settle): ordinary non-Team sessions of an unrelated row hang
on this dead Team row.

## Fix (host.ts, one site)

In the existing `ready.catch` handler (which already surfaces the
`bootstrap FAILED` console error), after the console error:

```text
bootstrap reject
→ activationFence.close()        (try/catch-swallowed, same style as the
                                   row-stop backstop's close)
→ ownershipReady / rollback barriers / writer-conflict record waiters
  settle immediately             (fence close semantics, S1 — unchanged)
→ every subsequent activation passes through (the fence keeps no state
  past a failed row)
```

`activationFence.close()` already had the required semantics (S1 fence
module, `team-session-activation.ts`): idempotent (`if (closed) return`),
settles `ownershipReady` + every rollback barrier + every record waiter +
the close gate, and `beforeAgentCreated` after close is a no-op
pass-through. The supplement adds NO fence-logic change — only the missing
host call site.

Preserved semantics (verified by the S-worlds):
- `ready` rejection: unchanged — the rejection still propagates to the
  facade's `ready` promise (S1 asserts the rejection carries the injected
  bootstrap error).
- console error: unchanged — `bootstrap FAILED: …` still surfaces
  (visible in the test run's stderr).
- row-stop cleanup: unchanged — the backstop keeps its own `close()` as the
  teardown path; after the bootstrap-failure close the row-stop close is an
  idempotent no-op (S5).
- normal successful bootstrap: the `ready.catch` handler never runs — the
  fence stays armed until the row stop (S4 re-asserts the successful world:
  foreign Team activation still VETOED, ordinary still PASSES).

## Tests (team-session-startup-fence.test.ts — extended, same file)

New world: a production `create-or-open` RESTART (phase-1 `create` seeds
the same medium) whose storage-seam `open` awaits a gate that REJECTS on
release — the bootstrap fails BEFORE the `bindOwnershipResolver` right
after the open. The host context captures the effect disposers so the row
stop is driven for real (S5). The existing H1/H2 worlds are untouched
(their frozen results now double as the S4 normal-path proof).

| # | Scenario | Assertion |
| --- | --- | --- |
| S1 | listener registered at `apply` top, resolver unbound, bootstrap rejects before the domain open settles | `createdListeners.length === 1`; `ready` rejected with the injected domain-open error |
| S2 | an ordinary `agent/created` suspended in the window settles after the failure (no permanent hang) | suspended pre-release (`settles(…,150) === false`) → settled post-failure, outcome `pass` |
| S3 | a NEW ordinary activation after the failure passes through immediately | settled + `pass` |
| S4 | normal successful bootstrap unchanged | H1 `veto` + H2 `pass` (fence armed, not closed) |
| S5 | row-stop backstop `close()` after the bootstrap-failure close is exception-free (idempotent double close) | disposer call no-throw + backstop async body clean (no unhandled rejection in the flush window) |

Harness additions (test-only): `makeFailingSeam` (the release-rejects seam
sibling of `makeGatedSeam`); `makeListenerWorld` now captures the effect
disposers (previously discarded — additive, worlds 1/2 behavior unchanged).
The p4-T6 scan is unaffected: no NEW scannable file (tests added to the
existing file; the module carries zero denylist vocabulary).

## Verification (at the commit)

- focused runtime suites (the S6 four): `team-session-activation` 16 +
  `team-session-activation-glue` 18 + `team-session-startup-fence` 9 (4 H +
  5 S) + `d2-s6-ensure-root-live` 20 = **4 files / 63 tests PASS**
  (`focused-runtime.log`)
- `pnpm typecheck` = 0 (`typecheck.log`)
- `pnpm build` = 0 + `pnpm build:composition` = 0 (`build.log`,
  `build-composition.log`) — the dist mirror is rebuilt in the SAME commit
  (the S5a lesson: the committed dist must equal a fresh build)
- artifact freshness gate (`scripts/check-artifacts-committed.mjs`):
  re-run at the final tip (`check-artifacts-final.log`)

## Red lines

CORE PATCH BUDGET = 0 (no upstream import/patch — the fix is inside the
plugin's own host entry) · Remote contract untouched · C1 exact-generation /
single-flight / rollback-epoch logic untouched (fence module unmodified) ·
same-page composer/session-generation (NO-GO-C1) untouched · push = this
branch only, FF, zero force-push, master zero-touch.
