# P-AUTH — Case-scoped Officer approval seam (executed 2026-11-02, real UTC)

**Verdict: PASS with a named qualification (seam exists; it is a protected-
center change).** Base probe 2/2; prototype probe 5/5.

## Current law (base run, no patch)

`npx vitest run … P-AUTH/pauth.test.ts` → 2 passed, 3 skipped.

- A Member caller is refused at `service.ts:2622-2635` with
  `CONTROL_RESOLVER_NOT_AUTHORIZED` (`allowed: [leader, human]`), **even
  though** the P6-T4 worker template's envelope already carries the
  `resolve-control` op. The refusal is role closure, not envelope.
- The Leader resolves the same durable request; the decision is written with
  the Leader instance as decider.

This confirms the PR #536 §5.1 fact against the real durable ControlService
and the real TeamDomain world (`p6t4-helpers`), not a fake closure.

## Prototype (throwaway, never merged)

`run-prototype.sh` applies `prototype.patch`, runs with
`A6_PAUTH_PROTOTYPE=1`, and reverts the tree in a trap. The patch adds ONE
predicate at the SAME role-closure gate:

```ts
const caseScopedOfficer =
  request.payload.kind === 'leader-approval' &&
  caller.role === 'member' &&
  caller.callerMember?.instanceId === 'inst-p6t4seedw02'
if (!allowedRoles.includes(caller.role) && !caseScopedOfficer) { … }
```

Result: 5/5.

- the designated non-Leader resolves the current `leader-approval` leg;
- the durable decision records **that instance** as decider;
- the EXISTING guard consumes the allow exactly once
  (`control-allow-consumed` = 1);
- a non-designated Member is still refused (the seam is principal-scoped, not
  a role widening);
- a second decision on the same request still fails
  `CONTROL_REQUEST_DECIDED`.

## Qualification — what this does and does not authorize

- **It is a protected-center change.** `packages/runtime/control/**` is pinned
  by the ARC-A ledger. The production seam needs a named Center-Interface PR +
  ledger override + user authorization; this probe is not that authorization.
- **The predicate is hardcoded** so the probe can run without inventing the
  configuration seam. Production must resolve the designated Officer from the
  frozen Blueprint + the current leg; hardcoding is proof-only.
- **The other three entrances** (`appendTerminalOutcome`,
  `escalateApprovalLeg`, the zero-review close) reuse the same closed role
  table. Production must apply the SAME case-scoped predicate at all four, or
  the seam is a bypass with extra steps.
- **Real caller/session binding is not exercised here.** The probe passes
  `ActionCaller` directly; the live derivation from session binding is the
  existing `resolveCaller` path and is scheduled for the host leg (P-INBOX /
  implementation), not claimed green by this file.
- The correct negative is preserved by construction: widening
  `CONTROL_RESOLVER_ROLES['leader-approval']` to include `member` would let
  EVERY member resolve; it is explicitly not the proposal.
