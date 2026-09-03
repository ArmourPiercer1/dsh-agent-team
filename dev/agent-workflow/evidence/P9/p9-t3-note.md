# P9-T3 — client: add frozen-remote transport and generation-safe projection store

Phase S2 (T3 of the P9 plan, commit table L2131). All work on
`task/P9-ui-legacy-reuse` in the P9 worktree; single writer; no push.

## Deliverables

| File | LOC | Role |
| --- | --- | --- |
| `packages/client/src/transport/host-seams.ts` | 76 | Carrier-neutral structural mirror of the DSH public unary RPC contract (Seam 5, verdict SAME) |
| `packages/client/src/transport/team-remote-client.ts` | 231 | REIMPLEMENT of the legacy TeamMirror transport (plan §6.1, budget ~150–250 LOC — in budget) |
| `packages/client/src/state/team-projection-store.ts` | 375 | Pull-only, generation-safe projection store (plan §6.2) |
| `packages/client/test/team-remote-client.test.ts` | — | 11 specs |
| `packages/client/test/team-projection-store.test.ts` | — | 14 specs |
| `packages/client/tsconfig.json` | — | `rootDir "." -> "../.."` (full face) |
| `packages/client/tsconfig.build.json` | — | `rootDir "src" -> "../.."` (build face) |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | — | coverage pin 572 -> 577 (+5 T3 files) |

## Design decisions

### (a) Structural seam mirror instead of `link:` import

`host-seams.ts` declares `TeamRpcCarrier.call(channel, endpoint,
payload, signal?): Promise<TeamRpcResult>` with
`TeamRpcResult = {ok:true; value:unknown} | {ok:false; error:
TeamRpcFailure}` — structurally identical to the test-use web app's
`ClientConnectionRpc.call` / `ConnectionRpcResult`. The host
dispatcher's `RemoteResponse` is structurally identical to
`ConnectionRpcResult` (no double wrapping; `rpcId` bidirectional;
channel regex `/^\/[A-Za-z0-9._~-]+$/`).

Why not `import` `@deepseek-ai/dsh-client-connection` (a `link:`
package) directly:

1. The vNext feature-plugin import ban on values keeps the link:
   surface at the six audited packages (T2 audit). A type-only import
   would be legal, but it pins the client package to an upstream
   module identity that the frozen plan does not name.
2. The seam contract (channel, envelope shape, typed error) is frozen
   by the `@dsh-agent-team/remote` package anyway; the mirror is the
   minimal declaration the carrier must satisfy.
3. Seam 5 verdict from the T2 host-seam-map: **SAME** — the served
   web app already exposes exactly this carrier; no new upstream
   surface is requested, so CORE PATCH BUDGET stays 0.

Production wiring (T9) binds the real carrier from `ctx.connection`;
tests inject a fake carrier that records
`{channel, endpoint, payload}`.

### (b) Cross-package import style + both rootDir changes

Relative source imports (`../../../remote/src/index.js`) per the
existing vNext convention (packages/runtime and packages/domain do
the same; run-tests hooks rewrite `.js` -> `.ts`; no dist builds in
between).

Consequence: remote/src files enter the client program and
`rootDir` containment must hold. **Finding (verified empirically):**
TS6059 "file not under rootDir" IS reported under `noEmit` here,
because `tsconfig.base.json` sets `declaration: true`, which forces
rootDir validation even without emit. The first full-face T3 run
(`t3-typecheck-1.log`) produced 27× TS6059 for this reason. Fix:
`rootDir: "../.."` (repo root) in BOTH tsconfig faces — the build
face needed it already (emitted-path mirroring, runtime precedent);
the full face needed it for validation. Build-face output shape
(dist rooted at the repo root, gitignored, removed after the check)
is unchanged from T2.

### (c) `@dsh-agent-team/remote` devDependency retained

Unused at runtime under the relative imports, but the frozen package
is the contract authority the specs import from (buildRemoteSuccess /
buildRemoteError / assessProjectionSync fixtures) and its `test`
scripts run in-repo. Disposition of the devDep is a T9 integration
decision (recorded, not dropped).

### (d) Store retry ownership

The store owns the reconnect retry loop through an injected
`TeamProjectionScheduler` (`{schedule, cancel}`), default
setTimeout-backed. `markConnectionLost` / `markConnectionRestored`
implement the frozen P8 reconnect state machine
(`stateOnLoss` / `stateOnConnect` / `isStateChange` from
`@dsh-agent-team/remote`). Production wiring (T9) additionally drives
invalidation pulls from `ctx.connection.generation` (observable):
physical reconnect = observable invalidation trigger per Seam 5; the
store's loss path is the client-local degradation when the carrier
itself reports fetch-level failure.

### (e) State fields beyond the plan minimum

`TeamProjectionState` = `{status, teamSessionId, appliedGeneration,
frame, lastError?, lastAssessment, retryAttempt, nextRetryDelayMs}`.
The plan says the store's published state contains at minimum the
frame + generation + status ("最少包含"); `lastAssessment` (the frozen
`ProjectionSyncAssessment` of the last-processed response),
`retryAttempt`, and `nextRetryDelayMs` are additions that make the
reconnect episode observable for the T6+ UI (reconnecting banner with
next-retry countdown) without any new authority source.

### (f) `lastError` type

`lastError: RemoteErrorResult['error'] | undefined` — the frozen
INNER error block (`code` / `message` / `details` with full
`RemoteErrorDetails`), not the `{ok:false; error}` envelope. The
envelope's `ok:false` is already encoded in `status: 'error'`; the
block is what the UI renders (G8 feed error line).

### (g) `call` param typing — `object` + single boundary cast

Frozen param interfaces are typed `interface` and several carry
`readonly` variance (e.g. `RemoteIntentProbeParams.environmentFacts:
readonly RemoteSafeRecord[]`; `RemotePolicyStateSetParams.target:
RemotePolicyStateViewValue`). Spreading such a param into
`RemoteSafeRecord` (mutable index signature) fails typecheck:
readonly arrays are not assignable to mutable `RemoteSafeJsonValue[]`,
and nominal interfaces lack implicit index signatures. The FIRST red
run recorded exactly 3× TS2345 (intentProbe / policyState.set /
override.set) for this.

Fix: the public wrapper signatures keep the frozen param interfaces
(ergonomics + contract visibility); the generic `call` is typed
`call(method: string, params: object)` and the SINGLE cast
`params as RemoteSafeRecord` happens at the one envelope-assembly
point, documented there. Justification: the wire value is identical
(readonly modifiers and nominal interface identity are type-level
only); the host's per-field validation remains authoritative (unknown
fields rejected there). No per-wrapper casts, no `as any`.

Companion fix from the same red run: 1× TS2352 in
`isRemoteResponse` — the guard cast the declared `TeamRpcFailure`
block to `Record<string, unknown>` (TS2352: neither direction
assignable). Restructured: the guard now takes `result: unknown` —
carrier values are not type-trusted end-to-end, so the guard IS the
validation; the `object`-narrowed `as Record<string, unknown>` casts
are legal downcasts.

## Loss-state machine rules (implemented + tested)

Catch path of a pull (only rejection kind:
`PushTransportLossError`):

1. `channel === 'connected'` at catch time and the failure is a
   stale report from an already-superseded in-flight pull ->
   ignored (a later successful pull owns the state).
2. `pendingRetry !== null` (a loss was already reported for this
   episode) -> no-op (concurrent loss reports do not restart the
   episode).
3. else -> `scheduleRetry`: first loss OR a failed retry pull -> the
   episode continues, `retryAttempt` grows, delay =
   `pickBackoffDelayMs(backoffCapMs(attempt, cfg))`.

`markConnectionLost`: no-op if no session bound or channel already
`'reconnecting'` (idempotent).
`markConnectionRestored`: cancels pending retry, channel
`'connected'`, publishes `retryAttempt: 0` +
`nextRetryDelayMs: null` (frozen P8 `markConnected` semantics — the
P8 test client resets `attempt = 0` on connect), then fires the
invalidation pull.

Verdict -> status transitions (G2 gate):

| assessment.status | frame before | status after | note |
| --- | --- | --- | --- |
| apply | any | `ready` | frame replaced, `lastError` cleared, attempt 0 |
| duplicate | non-null | `ready` | no-op, same frame reference |
| duplicate | null | `error` | no frame to show |
| stale | any | `ready` if frame else `error` | stale NEVER overwrites |
| foreign | any | `error` | foreign NEVER overwrites; frame kept, not discarded |
| inconsistent | any | `error` | provenance/generation mismatch: same rationale as foreign |
| rpc-error | any | `error` | `lastError` = frozen inner block, intact |
| (transport loss) | any | `reconnecting` | retry scheduled; frame untouched |

Hard invariant (plan §6.2): **no response writes to the store before
the generation check** — `assessProjectionSync(appliedIdentity,
response)` runs first; only `status === 'apply'` reaches
`extractPushFrame` + publish.

Backoff: `DEFAULT_TEAM_PROJECTION_BACKOFF = {baseMs: 1000, factor:
2, maxMs: 30000}` — CLIENT_LOCAL constant (the plan forbids the
authority source from setting polling cadence; Seam 4). Delays:
500 / 1000 / 2000 / ... ms via `defaultDelayPicker(capMs) =
max(1, floor(capMs/2))`, validated by `pickBackoffDelayMs`.

## Helper reuse map (frozen `@dsh-agent-team/remote`)

`assessProjectionSync`, `extractPushFrame`, `backoffCapMs`,
`pickBackoffDelayMs`, `stateOnLoss`, `stateOnConnect`,
`isStateChange`, `PushTransportLossError`, `REMOTE_CONTRACT_VERSION`,
`REMOTE_RPC_CHANNEL`, `buildRemoteSuccess` / `buildRemoteError`
(test fixtures), `RemoteResponse` / `RemoteSafeRecord` / all
`Remote*Params` types. No verdict/page-tracker logic is duplicated in
the client (G2: verdict logic exclusively in the remote package).

## In-sandbox test mechanics (shim constraints observed)

- `scripts/run-tests.mjs` discovers only `packages/*/test/*.test.ts`
  (these two specs use `.test.ts`; the migrated legacy vitest specs
  stay `.spec.tsx` / `.spec.ts` and run out-of-sandbox + S8).
- The shim's `it()` is SYNCHRONOUS only — async scenarios run at
  module level via top-level await; `it()` bodies assert on captured
  scenario state (P8-T3 pattern).
- Matcher surface is exactly `toBe / toEqual / toBeGreaterThan /
  toThrow` (+ `.not`): no `toContain`, no `.rejects`, no
  `toHaveLength` — message equality uses full-string `toBe` (note the
  em dash `—` in transport-loss messages).
- Deadlock trap (hit and fixed): awaiting a pull whose scripted
  response is an unresolved gate promise hangs the module-level top
  level await — fire without awaiting, resolve the gate, then await.
- Indexed access follows the repo convention `arr[0]!`
  (noUncheckedIndexedAccess).

## p4t6 coverage pin

`p4t6-session-event-scan.test.ts` filesScanned pin 572 -> 577 (+5 T3
files: 3 src + 2 test). Denylist scan over the 5 new files: zero
legacy SessionEvent vocabulary hits (the new files use only frozen
vNext vocabulary — `generation`, `projection`, `ledger`, `member`,
`teamSession`).

## Gate results (this commit)

| Gate | Result |
| --- | --- |
| `node scripts/run-tests.mjs client` | 28/28 PASS (3 pre-existing + 11 transport + 14 store) |
| `node scripts/run-tests.mjs` (full repo) | 2195/2195 PASS (baseline 2170 + 25 new) |
| full-face `tsc -p packages/client/tsconfig.json` | exactly 35 errors — IDENTICAL (normalized diff) to the T2 staged-red baseline: 23× TS2307 class A + 12× class B (9× TS7006, 2× TS7053, 1× TS2366). Zero new error class. `t3-typecheck-2.log` |
| build-face `tsc -p packages/client/tsconfig.build.json` | exactly 23 errors — IDENTICAL (normalized diff) to the T2 staged-red build baseline, src only. `t3-build-1.log`; emitted dist/ (172 files) removed after |

Staged-red expectation holds: the client tsc red is ONLY on the class
A `@deepseek-ai/dsh-client-runtime/client` imports (replaced in T4)
and their class B derivatives. T4 will clear all 35 / 23.

## Red intermediate (kept as evidence)

`t3-typecheck-1.log` — first full-face run after T3 sources landed:
35 staged-red + 30 new errors in two classes — 27× TS6059 (rootDir
containment under `declaration: true` + noEmit, see (b)) and
4× TS2345/TS2352 (3× spread/index-signature assignability in wrapper
spreads + 1× TeamRpcFailure->Record cast, see (g)). Both classes
fixed by the tsconfig rootDir change and the `object` + single-cast
`call` typing; the clean re-runs above confirm the return to exactly
35 / 23.

## Pre-existing orphan evidence

`g1-audit-client-tsc.log` (client tsc audit output, staged-red
baseline capture from the S0 pre-implementation audit) was left
untracked; committed with this task's evidence for completeness.

## Next

T4 (plan L2132): "client: add ledger cursor store and vNext UI
adapters" — `team-ledger-store.ts` (reuse
createLedgerPageTracker / verifyLedgerPageAnchor; sequence dedupe;
forward page merge; completeness; G2 ledger invariants),
`team-session-resolution.ts`, `team-ui-snapshot.ts` +
`projection-adapter.ts` (S3-A) + `ledger-adapter.ts` (S3-B), and the
replacement of ALL `@deepseek-ai/dsh-client-runtime/client` imports
(types + value `resolveTeamView`) so the client tsc goes fully green.
