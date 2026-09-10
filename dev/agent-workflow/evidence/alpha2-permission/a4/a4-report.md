# A4 (alpha.2) — control exact-fingerprint scope + synchronous `awaitControlDecision` wait bridge

- **Task**: A4 of the alpha.2 permission wave (plan §9): extend the EXISTING durable control plane
  with exact-fingerprint scope and a synchronous wait bridge. No approval-backend rebuild
  (ControlRequest / ControlDecision / guardOperation / exactly-once consumption / Leader+Human
  resolver roles / durable rows all reused unchanged).
- **Branch / worktree**: `task/alpha2-a4-control-exact-scope` @ `.worktrees/alpha2-a4`
- **Base**: `3aa6838` (alpha.1 hardening closure, freeze 0.1.1-alpha.1)
- **Code commit**: `bf3c7d5` — "A4 alpha.2: control exact-fingerprint scope + synchronous awaitControlDecision wait bridge"
  (28 files: sources + tests + rebuilt committed dist + client bundle; evidence is this follow-up commit)
- **Red lines honored**: edits confined to `packages/runtime/control/**`, `packages/remote/**`
  (projection extension), `packages/runtime/test/**`, `packages/testkit/test/p4t6-session-event-scan.test.ts`
  (pin only), rebuilt `packages/runtime/dist` + `packages/client/composition-shim`; no operation
  resolver (A3) or root/live glue changes; no push.

## 1. What changed (source)

| File | Change |
| --- | --- |
| `packages/runtime/control/types.ts` | `ControlOperationScope.operationFingerprint?: string` (optional, after `correlation`); same field on `ControlRequestRecord`; `requestControl` args +`operationFingerprint?: string`; `ControlServiceOptions.waitPollIntervalMs?: number` (default 250, non-finite/non-positive → default); **new** `ControlWaitSignal` minimal structural signal interface; **new** `ControlService.awaitControlDecision(input): Promise<ControlDecisionRecord>`; module doc updated |
| `packages/runtime/control/errors.ts` | **New** closed codes `CONTROL_WAIT_ABORTED`, `CONTROL_WAIT_CLOSED` in `CONTROL_ERROR_CODES` (JSDoc'd: abort = liveness cancellation, zero side effects; closed = durable plane closed, `NOT_OPEN` detected on the durable read, fail closed) |
| `packages/runtime/control/service.ts` | fingerprint through `parseScope`/`parseRequestPayload` (present-but-malformed → ABSENT, fail-closed), 6-segment `scopeKey` (fingerprint segment `?? ''`), `scopeSnapshotMatches` (fingerprint inequality incl. present/absent), request/decision/consumption payloads, request + guard validation (reuses `CONTROL_REQUEST_MALFORMED` stage `request` / `CONTROL_GUARD_MALFORMED` stage `guard`, field `operationFingerprint`), `malformed(...)` gains stage `'wait'`, **`awaitControlDecision`** (250 ms polling, injectable) |
| `packages/runtime/control/index.ts` | public-surface docs + `ControlWaitSignal` re-export (export list: types already re-exported) |
| `packages/remote/src/handlers/team.ts` | `normalizeTeamResolveControlValue`: `scope.operationFingerprint` passthrough validation (non-empty string when present, else `portContractError` → internal-error, details `{ field, reason: 'port-contract' }`) — see §5 |
| `packages/remote/test/f9-remote-v4.test.ts` | +3 tests (verbatim pass-through; empty string → INTERNAL_ERROR; non-string → INTERNAL_ERROR) → 39 tests; `F9_CONTROL_BACKING_CODES` unchanged (7 — the waiter codes are not reachable from `resolveControl`) |
| `packages/runtime/test/a4a-control-exact-scope.test.ts` | **new**, 28 tests (see §6) |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | pin only: `filesScanned`/`files.length` 642 → 653 + comment (see §7, deviation D1) |
| `packages/runtime/dist/**`, `packages/client/composition-shim/client-bundle.js` | rebuilt (committed artifacts; `check-artifacts-committed.mjs` → OK, 1056 files) |

## 2. Design decisions

### 2.1 `operationFingerprint` scope semantics (§9.1–§9.3)
- **Optional** on `ControlOperationScope` / `ControlRequestRecord` / `requestControl` args.
  Absent → exactly the old behavior (proven by C2, including an old-shape durable row round-trip).
- **Identity**: `scopeKey` is the 6-segment NUL-join `(rootSessionId, targetInstanceId, actionName,
  toolName ?? '', correlation, operationFingerprint ?? '')` — the fingerprint participates in scope
  identity AND in the request idempotency key (the requestId is a deterministic token of this key).
  Legacy rows (fingerprint absent) recompute the same key they always had for their own retries →
  old rows stay idempotent; an absent-fingerprint key can never collide with a present-fingerprint
  key (different 6th segment: `''` vs a non-empty string).
- **Correlation vs fingerprint** (§9.3): correlation is the logical-invocation id (same operation
  retried); the fingerprint is the resource + payload impact identity. The fingerprint does NOT
  substitute for correlation: same correlation + different fingerprint = two distinct logical
  requests (C3: three distinct requestIds under one correlation — fp-a, fp-b, none).
- **Snapshot match**: `scopeSnapshotMatches` adds `recorded.operationFingerprint !==
  guarded.operationFingerprint → false`. `undefined !== undefined` is false (both absent = old
  behavior); present-on-one-side is `!== 'x'` true → MISMATCH in both directions (C1).
- **Malformed fingerprint**: at the INPUT boundaries (`requestControl`, `guardOperation`)
  present-but-(non-string | empty) → typed `CONTROL_REQUEST_MALFORMED` (stage `request`) /
  `CONTROL_GUARD_MALFORMED` (stage `guard`), field `operationFingerprint`. In DURABLE rows,
  present-but-malformed parses to ABSENT (fail-closed: `parseScope`/`parseRequestPayload` return
  `undefined`) → the guard finds no matching request (C2: raw rows with `''` and `42` → `no-request`).

### 2.2 Wait bridge — polling interval choice (§9.4)
**250 ms** default (`DEFAULT_WAIT_POLL_INTERVAL_MS`), injectable via
`ControlServiceOptions.waitPollIntervalMs` (non-finite/non-positive → default). Rationale
(also documented in `service.ts` / `types.ts` / `index.ts`): the waiter is **liveness-only** —
the authority is ALWAYS the durable control rows (the waiter writes no rows; it only solves
"who is still waiting"). Each poll is a cheap in-process durable ledger scan
(`loadControlState` → `repositories.ledger.list()`), so the low end of the plan's 250–500 ms
band minimizes decision latency at negligible cost; a longer cadence would add latency with no
robustness benefit (nothing about waiting longer makes the read more likely to succeed).

### 2.3 `awaitControlDecision` implementation contract
- `async function` — every validation failure is a REJECTION (not a synchronous throw),
  matching the rest of the service's async surface (deviation D2 records the fix).
- First poll is **synchronous** (fast path): if the decision is already durable, the promise
  resolves without ever scheduling a timer (W4a: exactly one `ledger.list()` read, no timer
  activity, no leak).
- Resolution: resolve with the durable `ControlDecisionRecord` (scope incl. fingerprint when
  present). Rejection: `CONTROL_WAIT_ABORTED` on signal abort (pre-abort checked up front;
  one-shot `abort` listener); `CONTROL_WAIT_CLOSED` when the durable read surfaces the storage
  layer's typed closure signal (`TeamDomainError` code `NOT_OPEN` — the existing closure
  signaling, no new mechanism); any other typed storage error (e.g. `TEAM_SESSION_NOT_FOUND`)
  propagates unchanged.
- **Zero side effects**: the waiter consumes no facts, decides nothing (cancellation never
  decides — a later resolve after an aborted wait still works, W2), and clears its timer +
  abort listener on settle (W4b: read count frozen after settle — no timers kept alive).
- No durable waiter scheduler, no cross-process continuation, no new event-emitter infra.

### 2.4 `ControlWaitSignal` (deviation D3)
The plan's literal `signal?: AbortSignal` named the platform global. This codebase builds its
committed dist against `lib: ["ES2022"]` with NO ambient DOM/Node globals (`tsconfig.base.json`;
at the 3aa6838 baseline no built `.ts` source referenced `AbortSignal`/`setTimeout` — only
test files (via the vitest type chain) and `.mjs` scripts). The first build including the waiter
failed with `TS2339 Cannot find name 'AbortSignal' / 'setTimeout'`. Fix: the public signature
uses a new minimal structural interface

```ts
export interface ControlWaitSignal {
  readonly aborted: boolean
  addEventListener(type: 'abort', listener: () => void, options?: { readonly once?: boolean }): void
  removeEventListener(type: 'abort', listener: () => void): void
}
```

A real platform `AbortSignal` (Node/DOM) is structurally assignable to it (method-parameter
bivariance), so `controller.signal` passes through unchanged in A5's node-typed context; the
implementation reaches the platform timers through one narrow structural cast of `globalThis`
(`platformTimers`). No new dependency, no tsconfig change, no ambient-declaration merge risk.

## 3. Persistence round-trip proof (injected TeamDomain repositories)

All scenarios run over a REAL `TeamDomain` (append-only TeamDomain ledger via
`FileStorageSeam` scratch) with the service re-instantiated over the same store — no in-memory
shortcuts. C5 is the explicit round-trip: pending (fingerprint `fp-c5-a`) and decided+consumed
(`fp-c5-b`) rows written through service #1, then `restartP6T1World(world)` (close old domain,
new `FileStorageSeam` over the same scratch dir, re-open, fresh provider) and a FRESH
`createControlService` over the re-opened domain. Assertions on the fresh instance:
`listControlState` sees both requests (pending / decided) with fingerprints, the decision scope
carries the fingerprint, the consumption scope carries it; `guardOperation` on the pending scope
→ `request-pending`; on the consumed scope → `allow-consumed`. The fingerprint therefore survives
the full durable round-trip through the injected repositories, in the request payload, the
decision payload, and the consumption payload. (C1 additionally proves fingerprint-boundary
round-trips through RAW durable rows written without the service.)

## 4. Exactly-once with fingerprint (§9.1, C4)

allow (fingerprint `fp-a4-c4`) → first `guardOperation` on the exact scope consumes
(`allowed: true`, 1 `control-allow-consumed` fact) → second identical `guardOperation` →
`allow-consumed`. The consumption fact's scope carries the fingerprint.

## 5. Remote / projection finding (settled)

The scope IS publicly exposed across the remote seam: the v4 `team.resolveControl` success value
is `{ decision: <ControlDecisionRecord> }` whose `scope` was normalized `isPlainRecord`-only, and
`team.getLedgerPage` passes raw entries through; the client `ledger-adapter.ts` reads a subset of
the scope. The additive optional field therefore needs a minimal projection extension:
`normalizeTeamResolveControlValue` now validates `scope.operationFingerprint` as
non-empty-string-when-present (fingerprint is opaque to remote — pass-through, D-4). The WAITER
error codes are NOT reachable through `resolveControl` (they only occur inside
`awaitControlDecision`), so `F9_CONTROL_BACKING_CODES` (7 codes) is unchanged. 3 new
`f9-remote-v4` cases cover verbatim pass-through + both malformed shapes.

## 6. Test evidence

Environment: node v24.20.0, pnpm 11.7.0, Windows PowerShell, worktree
`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\alpha2-a4`.

Commands and results (final, on commit `bf3c7d5`):

| Command | Result |
| --- | --- |
| `pnpm --filter @dsh-agent-team/runtime run typecheck` | exit 0 |
| `pnpm --filter @dsh-agent-team/remote run typecheck` | exit 0 |
| `pnpm --filter @dsh-agent-team/client run typecheck` | exit 0 |
| `pnpm build` | exit 0 (all packages) |
| `pnpm build:composition` (after `git add` of rebuilt artifacts) | exit 0 |
| `node scripts/check-artifacts-committed.mjs` | `OK: 1056 files; committed install-surface artifacts match the fresh build` (exit 0) |
| `node scripts/run-tests.mjs` (canonical) | matches 3aa6838 baseline file-for-file EXCEPT the intended deltas: `f9-remote-v4` 36→39 PASS and new `a4a-control-exact-scope` 28 PASS. (The canonical runner crashes at the PRE-EXISTING `d5-instance-contract.test.ts:109` `toHaveLength` shim gap at the baseline too — pre-existing, untouched.) |
| per-file runner over all 184 test files (runtime+storage+testkit+tools) | **1782 passed, 36 failed, 1818 total** vs baseline **1753 passed, 37 failed, 1790 total** — delta exactly: `a4a-control-exact-scope` +28 PASS and `p4t6-session-event-scan` FAIL(1/10)→PASS(10/10). All 14 other failing files are byte-identical to the baseline failing set (same files, same per-file counts, same import-error shapes). |

New suite `packages/runtime/test/a4a-control-exact-scope.test.ts` (28/28 PASS):
C1 fingerprint-bound exact scope (allow matches only the exact fingerprint; different fingerprint
→ `no-request`; raw-row cross-mismatches → `scope-mismatch`/`no-request` both directions);
C2 old-shape compatibility (full old cycle green; raw old-shape row idempotent + ABSENT; raw
rows with `''`/`42` fingerprint → `no-request`); C3 same correlation + different fingerprint →
3 distinct requestIds (no reuse), retry-stable per fingerprint; C4 exactly-once consumption WITH
fingerprint (1 consumption fact, scopes carry the fingerprint); C5 restart survival (fresh
domain + fresh service); ROUTE §9.5 design-level (member leader-approval resolvable by leader,
member user-approval leader-resolve → `CONTROL_RESOLVER_NOT_AUTHORIZED` with
`details.role: 'leader'`, `allowedRoles: ['human']`, then human resolves — both kinds carry the
fingerprint scope end-to-end); MALFORMED input battery (request fp `''`/`42` → stage `request`;
guard fp `''`/`42` → stage `guard`; wait rootSessionId with space / empty requestId /
pre-aborted signal / `signal: {}` → stage `wait` with fields `rootSessionId`/`requestId`/`signal`;
pre-abort → `CONTROL_WAIT_ABORTED`; zero rows written by malformed inputs); W1 waiter resolves
when the durable decision appears (injected 5 ms poll, RESOLVER on a different service
instance); W2 abort → `CONTROL_WAIT_ABORTED` with request identity, request stays durable and
the LATER resolve is unaffected; W3 `domain.close()` mid-wait → `CONTROL_WAIT_CLOSED` with
request identity; W4 no leak (fast path = exactly 1 read, no timer; aborted wait freezes the
read count after settle).

`packages/remote/test/f9-remote-v4.test.ts`: 39/39 PASS (was 36/36 at baseline).

## 7. Deviations

- **D1 — p4t6 pin 642 → 653 (sanctioned pin-only change; scanner `.mjs` byte-unchanged).**
  The pin was ALREADY stale at the 3aa6838 baseline: the scan found 652 files vs the pin's 642
  (pre-existing FAIL 1/10). The 10 unrecorded increments are the alpha.1 capability-wiring files
  merged into master after the last pin bump (`5bcb4b6`): `packages/domain/policy/src/static-capability-source.ts`,
  `packages/domain/test/t1-capability-schema.test.ts`,
  `packages/runtime/agent-setup/capability/{mcp-adapter,skill-adapter,skill-catalog}.ts`,
  `packages/runtime/test/{t3-skills-mcp-adapter,t4a-capability-wiring}.test.ts`,
  `packages/tools/src/{builtin-deny,tool-selector}.ts`,
  `packages/tools/test/t2-tool-selector-deny.test.ts` — all denylist-free (verified: the scan
  reports 0 violations). The A4 increment is the one new `a4a-control-exact-scope.test.ts`
  (also denylist-free: dot-form vocabulary only, no `team/...` slash strings, no
  `SessionEventMap`/`Team*Data` symbols). Both asserts (`filesScanned`, `files.length`) updated
  with an explanatory comment. Net effect: p4t6 goes RED(1/10) → GREEN(10/10) — an improvement,
  not a regression.
- **D2 — `awaitControlDecision` is `async`** (first debug iteration used a plain function; its
  synchronous validation throws propagated outside the Promise and broke the test harness's
  rejection capture — all service methods are `async`; the interface was always
  `Promise<...>`).
- **D3 — `ControlWaitSignal` structural interface** instead of the literal `AbortSignal` global
  (build-contract constraint, §2.4). Publicly exported from `packages/runtime/control/index.js`
  so A5 can name the type if it wishes; passing `controller.signal` requires no cast in
  node-typed code.
- **D4 — baseline canonical runner crash** (pre-existing at 3aa6838, `toHaveLength` shim gap in
  `d5-instance-contract.test.ts:109` kills the process): full-suite comparison therefore uses
  BOTH the canonical run (identical up to the crash) and a per-file runner over all 184 files;
  both compared file-for-file against their baseline equivalents. Not "fixed" (shim-matcher
  failures must remain matching the baseline).

## 8. Exact export surface (what A5 consumes)

Module: `@dsh-agent-team/runtime` → `packages/runtime/control/index.js` (dist:
`packages/runtime/dist/packages/runtime/control/index.js`):

```ts
createControlService(options: ControlServiceOptions): ControlService
// ControlServiceOptions = {
//   teamDomain: TeamDomain                      // injected, re-open on restart
//   blueprintCatalog: ...
//   externalPolicyFacts: ...
//   now: () => string
//   waitPollIntervalMs?: number                 // NEW — default 250; non-finite/non-positive → 250
// }

ControlService = {
  requestControl(args: {
    rootSessionId: string
    kind: 'leader-approval' | 'user-approval'   // CONTROL_REQUEST_KINDS
    requester: ControlCallerRef
    scope: ControlOperationScope & { operationFingerprint?: string }  // fingerprint OPTIONAL
    summary?: string
    // ... (unchanged fields)
  }): Promise<ControlRequestRecord>             // record now carries operationFingerprint when given

  resolveControl(args /* unchanged; resolver roles unchanged */): Promise<ControlDecisionRecord>

  listControlState(rootSessionId: string): Promise<ControlState>      // requests/decisions/consumptions carry the fingerprint when present

  guardOperation(scope: ControlOperationScope & { operationFingerprint?: string }):
    Promise<ControlGuardVerdict>               // exactly-once; fingerprint-bound approvals match only exact-fingerprint attempts

  awaitControlDecision(input: {                 // NEW (alpha.2 §9.4)
    rootSessionId: string
    requestId: string
    signal?: ControlWaitSignal                  // a real AbortSignal is structurally compatible
  }): Promise<ControlDecisionRecord>            // resolves the DURABLE decision record
}

ControlOperationScope = {
  rootSessionId: string
  targetInstanceId: string
  actionName: string
  toolName?: string
  capabilityDomain?: string
  correlation: string
  operationFingerprint?: string                 // NEW — optional; participates in scope identity + idempotency key when present
}

CONTROL_ERROR_CODES: // closed set, additions:
  ... existing 10 codes ...,
  CONTROL_WAIT_ABORTED: 'CONTROL_WAIT_ABORTED', // wait cancelled by signal — zero side effects
  CONTROL_WAIT_CLOSED: 'CONTROL_WAIT_CLOSED'    // durable plane closed (NOT_OPEN) — fail closed

ControlWaitSignal // NEW structural interface (see §2.4)
```

## 9. Notes for A5 / A6

- **Constructing a fingerprint-scoped request**: pass `operationFingerprint` in the
  `requestControl` scope arg (non-empty string; present-but-`''`/non-string is rejected with
  `CONTROL_REQUEST_MALFORMED`, field `operationFingerprint`). Use a stable identity of
  resource + payload impact (e.g. a deterministic hash of tool + target + relevant payload) —
  the service treats it as opaque. Keep `correlation` as the logical-invocation id (same
  operation retried = same correlation; the fingerprint never substitutes for it).
- **Guarding with a fingerprint**: pass the same `operationFingerprint` in the `guardOperation`
  scope. A fingerprint-bound allow matches ONLY exact-fingerprint attempts; an old
  (fingerprint-less) allow matches only fingerprint-less attempts.
- **Waiter semantics**: `awaitControlDecision` polls the durable rows (250 ms default — inject
  `waitPollIntervalMs` only in tests) and resolves with the durable `ControlDecisionRecord`.
  It writes nothing and decides nothing: aborting (`signal`) rejects
  `CONTROL_WAIT_ABORTED` and leaves the request pending (a later resolve still lands); plane
  close rejects `CONTROL_WAIT_CLOSED`; other typed storage errors propagate unchanged. The
  first poll is synchronous (already-decided → resolves with no timer). A service re-opened
  over the same store can serve waits for pre-existing pending requests.
- **Remote projection**: `team.resolveControl` v4 success values now carry
  `scope.operationFingerprint` verbatim (validated non-empty-string-when-present); raw ledger
  pages already pass through; no client-side change needed for the additive field.
