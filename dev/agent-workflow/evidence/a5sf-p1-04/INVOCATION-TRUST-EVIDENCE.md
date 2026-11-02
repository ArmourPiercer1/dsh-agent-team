# P1-04 · Invocation Binder + Trust Registry

- **Task**: P1-04 (Gate **G1.4**) of `docs/plans/memo/alpha5-sandbox-first-20261101/IMPLEMENTATION-PLAN.md`.
- **Branch/worktree**: `task/a5sf-p1-01-20261102` @ `.worktrees/a5sf-p1-01`.
- **Lane**: `packages/runtime/member-io-policy/src/{invocation.ts,trust-registry.ts}` (+ append-only
  types in `types.ts`).
- **Tests**: `a5sf-invocation.test.ts` 18 + `a5sf-trust-registry.test.ts` 10, plus the plan-named
  Alpha.4 regressions `a4p3-approval-case` / `a5p2-grant-oneshot` — **68/68**
  (`green-tests.log`), `tsc` rc=0.

## 1. Invocation binder laws

| Law | Mechanism / test |
|---|---|
| non-transferable call capability | the minted object is branded in a module-private `WeakSet`, per-capability state in a `WeakMap` keyed by the exact object; a spread/JSON clone is `CAPABILITY_UNKNOWN`; the capability is frozen |
| tuple binding | `memberIdentity / callId / policyRevision / toolBindingIdentity` are re-checked on every consume, each with its own typed code; a refused transfer does not burn the legitimate call |
| single use | one-bit `{consumed, owner}` state; `consume` is fully synchronous, so check-and-mark has no await window — `Promise.all` of two consumes yields exactly one winner |
| no cross-binder honour | a capability minted by binder A is `CAPABILITY_UNKNOWN` to binder B (the "two binders in one process" hole found during the lane's own RED) |
| revocation | `revoke(member)` bumps that member's epoch only; outstanding capabilities become `CAPABILITY_MEMBER_REVOKED`; other members are unaffected; binding after revoke mints under the new epoch |
| cold start | binder-wide `bumpEpoch()` invalidates earlier capabilities (`CAPABILITY_EPOCH_STALE`) |
| lease | no library-side clock: the caller supplies `now`; a lease without a clock is refused (`CAPABILITY_LEASE_UNVERIFIED`), never silently skipped; boundary `now > expiresAt` |
| audit projection | `toInvocationAuthority(capability)` projects the tuple into P1-02's `InvocationAuthority` input without consuming and without granting |

**It is NOT a second GrantLedger**: the module owns in-memory per-call binding state and
consumes Alpha.4's `approvedOnce` as an external input; no approval store is created or
mutated, and `tool-admission` internals are not imported.

## 2. Trust registry laws

| Law | Test |
|---|---|
| explicit registration only | unknown tool/scope ⇒ `TRUST_BINDING_UNKNOWN` (never trust by default) |
| loader-supplied digests compared, not recomputed | package / dependency digest mismatch ⇒ typed mismatch codes; no `node:fs`, no `node:crypto` (source-shape test pins it) |
| HMR / Definition replacement | caller `definitionGeneration` older than the registered generation ⇒ `TRUST_GENERATION_STALE` **even with identical tool name and old digests** |
| scope is identity | key = `scope\0toolName`; same tool name in another scope shares no trust |
| no downgrade / no same-generation redefinition | lower generation refused; same generation + different digests ⇒ `TRUST_REGISTRATION_CONFLICT`; identical re-registration idempotent |

**It is NOT a sandbox**: the module doc and a source-shape test state that a trusted digest
represents a deployment choice, not an ability to stop malicious same-realm JS.

## 3. Deviations accepted by the integrator (documented, not law weakening)

1. `bindInvocation` requires `toolBindingIdentity` (the plan's one-line signature omitted it):
   the capability must pin the tool binding, so the extension is required by the laws.
2. Lease calls must pass a clock whenever an expiry exists — stricter and fail-closed.
3. `revoke` uses a per-member epoch (carried on every capability) instead of bumping the
   binder-wide epoch; cold start remains the separate binder-wide bump.

## 4. Residual gaps

- No production wiring/exports yet: the barrel `member-io-policy/src/index.ts` exports the
  lane, but nothing mounts the binder into the live tool path (P1-05/P1-07).
- Trust digests are only as good as the loader that supplies them; the loader-side digest
  production is P1-06 inventory/integration work.

## 5. Reproduce

```bash
cd .worktrees/a5sf-p1-01
node_modules/.bin/vitest run packages/runtime/test/a5sf-invocation.test.ts \
  packages/runtime/test/a5sf-trust-registry.test.ts
```
