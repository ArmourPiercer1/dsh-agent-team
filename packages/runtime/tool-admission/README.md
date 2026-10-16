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

F-5 bookkeeping (review round 1): the kernel harness's default
`requiredAssurance` reader returns NO dimensions, so a test written without one
vacuously passes the assurance gate (zero demanded = nothing to verify). That
is a harness property, NOT the law: PR3's live assembly must pin the
reader-derivation law (which dimensions a binding's demanded level actually
pulls in) in its own tests — an empty reader must never reach the wiring
unttested. No domain law changes here.

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

## Policy-deny routing — 来源分流 contract (user ruling 2026-10-16; supersedes this lane's earlier blanket-deny arm)

The ruling, verbatim in effect: ① a DENY must keep its **source and owning
authority**: an upgradable ordinary Team deny enters the existing
ApprovalCase/rung ladder — Human Admin is the top rung the environment
supports and may LEGALLY approve once, without being forced to commit a
permanent policy change first; ② `externalHard` answers only **capability
facts**, the Domain gate is independent, and no Team approval changes a fact
(an unsupported environment ⇒ refusal with zero side effects, probe-pinned);
③ a deny whose source is **unknown or unwired** is refused with an accurate
diagnosis — never dressed up as an authorized final Team deny.

**Where the policy document comes from (no second authorization database).**
The frozen PR0 `ToolPolicyDocument` carries no provenance field (its grammar
is `{realmId, effectKind, matcher, maximumEffect}`). The assembler's
`policyDocument()` reader is therefore a READ-TIME PROJECTION of the existing
authority stores and nothing else: the blueprint's permission lanes
(spec §3.2 required fields) plus the `GovernanceMutationService` overlay
(spec §8.2 — direct commit vs proposal; permanent changes keep walking that
path). The same underlying rules ALSO project into the
`AuthorityEnvelopeDocuments` the kernel already identity-checks. The lane
stores nothing; approvals never write policy (the single-use grant is an
ApprovalCase answer, not a mutation).

**The in-lane classifier is the envelope walk, not an assembler label.** The
lane must not accept a trusted `source:` tag from the assembly to decide what
is upgradable — that would skip the proof. Instead, for every DENIED effect
the approval plane runs `evaluateAuthorityCeiling` over the SAME
realm-qualified scope with the SAME documents/binding the identity leg just
verified, and the walk's answer IS the owning-authority answer:

* a rung can sign (leader/human-user by positional binding, human-admin via
  its identity ceiling — the top inside envelope support) ⇒ **upgradable**:
  the effect joins `needsApproval` and rides the ONE whole-set case at the
  MAX required rung of the set (共同权威: the reviewer covers all effects or
  none). A one-shot admin approval there is legal and mutates nothing;
* NO rung can sign (beneficiary is already at the top) ⇒ typed refusal, no
  case (there is no rung above to ask — the escalation ladder's own edge);
* the walk is **undetermined / a bound document is unreadable** ⇒ ③: refusal
  with a deny-source-unattributed diagnosis naming the index and the failed
  leg, and explicitly NOT a "settled Team deny" message;
* `undetermined` on the EXPANSION plane still poisons the whole set (plan §5
  fail-closed leg unchanged — ruling ① is about decided denies, not about
  undetermined anything).

**Terminal sources are not policy rules at all.** externalHard capability
facts and Domain-gate answers never enter the policy document; they gate
behind H2 (assurance before any hard-profile use) and the Domain leg, and the
issue path re-runs the same gates before mint — an approval can never mint
over a fact that says no (probe + zero side effects stay pinned).

**Deny that ARRIVES between case-open and issue:** the old case does not
mint. The grant answers the case as planned; a policy plane that moved to
deny re-opens admission at the escalated rung (live assembly bumps the
authority generation on mutation, spec §8.2; the lane's generation leg turns
the stale presentation into `APPROVAL_STALE` — stale is a refusal, not a
retry).

## Error-code rulings (see the PR body's pre-freeze list)

* `effect-set unapprovable` now means **undetermined-only** (a decided deny is
  routed, not refused — see the routing contract): `IO_POLICY_UNSUPPORTED` with
  `details.refusal = 'effect-set-undetermined'`. The earlier
  `TEAM_POLICY_DENY` §5-erratum proposal is **已裁 withdrawn** (user ruling
  2026-10-16): an upgradable Team deny surfaces as `requires-approval`, not as
  an error; no frozen-code addition is needed.
* a DENY whose owning authority cannot be established (unreadable bound
  document / undeterminable containment) → `TOOL_BINDING_UNVERIFIED` with
  `details.refusal = 'deny-source-unattributed'` — ③: accurate diagnosis, never
  presented as a settled Team deny.
* policy plane moved to deny after the case opened → `APPROVAL_STALE` with
  `details.refusal = 'policy-deny-at-issue'` (the case is stale, the request is
  not; re-admission plans the escalated rung).
* `effect-outside-grant` keeps PR0's frozen mapping → `TOOL_BINDING_UNVERIFIED`
  (the call exceeds the grant it carries = a call/binding mismatch, the same
  fact class PR1's Guard surfaces under this code; 可裁).
* non-finite clock → `APPROVAL_STALE` (the clock feeds only freshness legs;
  an un-evaluable freshness leg has not passed).

Presentation trust (review F-1, closed): `issueApprovedGrant` does NOT trust a
presented `approvalCaseId` — it recomputes the case identity from the
request's own member + effect-set fingerprint at the claimed generation and
refuses a mismatch (`approval-case-identity-mismatch`) before any legality
algebra or mint. The case identity is enforced on all three of its legs
(member / fingerprint / generation) at the execution boundary, the way the
clock is treated as hostile rather than believed.

Wiring instruction for PR3/PR4 (delta review D-3): the frozen PR0
`requires-approval` decision arm carries only `kind / requestedEffects /
reason` — the canonical case id is NOT on the arm. The live installer must
take it from `kernel.planApproval()` (or the `admission-requires-approval`
observe event) and present exactly that id back through
`issueApprovedGrant`; never self-compose one. Since F-1 any other presentation
is refused CLOSED (`approval-case-identity-mismatch`, with the expected id in
`details`), which is the intended failure mode, not a retry hook.

## Grant one-shot (grant-mint.ts)

`grantIdForCall` is deterministic (same call → same grantId → a double mint is
a refused re-register, no replay surface). `ledger.consume` validates
(PR0 precedence) then marks in ONE synchronous step — JS run-to-completion is
the atomicity; tests interleave async consumers to pin exactly one winner.
The ledger stores only the consumption fact: no second authorization ledger.

## NOT FROZEN — the PR1r residual-boundaries dependency (coordination 2026-10-16 08:2xZ)

This lane consumes the FACT of trusted provenance, never its derivation: an
`AdmissionRequest` carries a parsed `ToolBinding` and a `parametersFingerprint`,
and "which Body the tool name will resolve to at execution" is established
UPSTREAM by PR1's Guard. That upstream law is exactly what
`alpha5-pr1r-residual-boundaries` (based on master `db5cb5f7`) is closing:

* **R-a** — the global `tools.schemas()` view is NOT a trusted source: a
  same-name-different-Body call requires a `tools.get` identity comparison, and
  without an explicit bind the answer is refuse / "declaration unsupported";
* **R-b** — the window between validation and late resolution gets its
  deterministic negative control and seam record.

Until that closure lands, the runtime-release semantics of `approval-case.ts`
and `grant-mint.ts` are **not frozen**: what exactly enters
`parametersFingerprint` / call identity (a definition-identity leg joins or
tightens it), and which seam record proves the resolution window, may take
their final shape there. The algebra in this lane (dual-plane expansion, the
per-effect A3-2 equation, the one-shot edge, the clock gate) is
provenance-agnostic and stands; the PR2 delivery is pure preparation
(contracts + tests + docs) until PR1r closes. The §5 erratum items above
stay 可裁 untouched, awaiting the user.
