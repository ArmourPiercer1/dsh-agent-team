# `runtime/tool-admission` — Alpha.5 PR2 lane

Unified **Operation Admission** + the multi-effect Ask on the **one logical
Alpha.4 `ApprovalCase`** + the **single-use `OperationGrant`** (plan §5,
design §4.2/§4.3/§5). Depends only on: the PR0 frozen lane
(`domain/tool-governance`), the Alpha.4 shared grammar
(`domain/authority-envelope`) and Alpha.4's ceiling/ladder
(`runtime/governance/authority-ceiling`, `runtime/governance/runtime-authority`
— imported, never restated). No `node:*`, no I/O, no clock, no persistence.

## Per-call order (pinned by `a5p2-admission-kernel`)

```
finite-clock gate (H1) → identity/realm/binding legality
→ assurance runtime verification (H2, before any hard-profile use)
→ expansion plane over the WHOLE effect set
     deny / undetermined effect      ⇒ denied (unapprovable as a whole)
     every effect decided allow      ⇒ mint single-use grant → `admitted`
     else                            ⇒ the ONE ApprovalCase plan → `requires-approval`
→ (host opens/collects the Alpha.4 case)
→ issueApprovedGrant: per-effect re-check (rung + envelope coverage, all-or-nothing)
  → re-run expansion (deny may have arrived while waiting) → mint
→ consumeForExecution: finite clock → validateGrantForCall (PR0 precedence)
  → mark consumed (ONE synchronous step = the one-shot law) → optional lease
```

Any denial is typed (§5 vocabulary), before any body, with zero ledger/mint
effects (`body = 0`). Stale is a refusal — never an auto-trim, never a retry
(design §4.3).

## H1 — the finite-clock law (clock.ts)

The clock is an **input**, hostile like a model argument: `NaN` never satisfies
PR0's strict `>` (an expired grant would pass the expiry leg), `−Infinity`
passes everything. Admission therefore verifies every injected clock
(`requireFiniteClock`) **before** any authorization/expiry use, at BOTH the
admission door and the consumption edge; non-finite (and any non-number) is
`APPROVAL_STALE`, fail-closed, zero side effects. PR0's strict `>` expiry
semantics are unchanged and still pinned by `a5p0-grant-replay`; PR0's
non-finite tests remain what they always were — recorded operator facts and
the precondition for this law, not a recommended contract.

## H2 — assurance runtime verification (assurance-runtime.ts)

A `level` never redeems a capability by itself. Every demanded dimension must
carry a REAL `mechanism`/`trustRoot`/`evidence` and a real `realmId`, and they
must MATCH what the probe observed, before any hard-profile consumption:

* level below the demand (`partial`/`unsupported`/`untested`, or
  `author-trusted` against `hard`) → `IO_POLICY_UNSUPPORTED` (honest
  capability shortfall);
* level claims enough but the record is null/blank, the probe cannot observe,
  or any field contradicts the probe (including `realmId`) →
  `TOOL_BINDING_UNVERIFIED`. `enforced` + `null` mechanism = **refusal**.

### Stub probe semantics (until PR4 replaces the port)

`createStubAssuranceProbe(observed)` is a **test/assembly placeholder**, and
the seam is the point: `AssuranceProbe` is the exact port PR4's real provider
probe (backend/OS/permission detection, policy compilability, per-call setup
before the untrusted body, design §5) will be injected into. Semantics, pinned
by `a5p2-assurance-probe`:

1. a dimension present in `observed` answers with EXACTLY those four real
   strings — the stub records, it never embellishes;
2. a dimension NOT in `observed` answers `{ ok: false, detail: … }` — **no
   observation**, which refuses a demanded dimension. The stub is fail-closed
   by construction: guessing "probably enforced" is unrepresentable;
3. the stub reads no environment and asserts no OS fact: PR1's
   `untestedAssurance` discipline holds until PR4's probe produces real
   Landlock/FD/network evidence rows into the same fields.

## One ApprovalCase, many effects (approval-case.ts)

The case opens at the highest per-effect required rung (Alpha.4's
all-or-nothing batching, mirroring `planPermissionMutationApproval`), but its
**legality is checked per effect** at execution: `mayReview(reviewer,
beneficiary, rung(effect))` AND the reviewer's `grantCeiling` on THAT effect's
realm-qualified scope reaches `allow` — the ADR A3-2 equation applied to every
effect independently. A max-rank shortcut, a partial-coverage run, a case
containing a policy-`deny` or `undetermined` effect, a reviewer whose rung the
escalated ladder outgrew, and a cross-generation replay are each refused as a
WHOLE-set failure. Case identity = (member, effect-set fingerprint, authority
generation) — never a callId; the GRANT stays per-call.

## Error-code rulings (see the PR body's pre-freeze list)

* `effect-set unapprovable` (policy `deny`/`undetermined`) → `IO_POLICY_UNSUPPORTED`
  with `details.refusal = 'effect-set-unapprovable'`. The frozen §5 set has no
  dedicated Team-policy-deny code; a dedicated `TEAM_POLICY_DENY` is proposed
  for the §5 erratum (PR8 / user discretion — 可裁).
* `effect-outside-grant` keeps PR0's frozen mapping → `TOOL_BINDING_UNVERIFIED`
  (the call exceeds the grant it carries = a call/binding mismatch, the same
  fact class PR1's Guard surfaces under this code; 可裁).
* non-finite clock → `APPROVAL_STALE` (the clock feeds only freshness legs;
  an un-evaluable freshness leg has not passed).

## Grant one-shot (grant-mint.ts)

`grantIdForCall` is deterministic (same call → same grantId → a double mint is
a refused re-register, no replay surface). `ledger.consume` validates
(PR0 precedence) then marks in ONE synchronous step — JS run-to-completion is
the atomicity; tests interleave async consumers to pin exactly one winner.
The ledger stores only the consumption fact: no second authorization ledger.
