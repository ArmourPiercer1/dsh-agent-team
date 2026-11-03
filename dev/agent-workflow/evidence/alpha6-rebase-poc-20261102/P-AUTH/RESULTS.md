# P-AUTH — Control seam + FULL PA tool-approval chain (executed 2026-11-02, re-rated after review)

**Final verdict (supersedes the first pass):**

| Layer | Verdict | Evidence |
| --- | --- | --- |
| Simple Control decision seam | **PASS** | `pauth.test.ts` base 2/2; prototype 5/5 |
| Full PA tool-approval chain under a real `member` Officer | **FAIL under base law** | `pa-chain.test.ts` role-only mode: durable DENY `pa-authority-drift`, zero grant, zero consumption |
| Case-scoped delegation prototype | **PASS (proves the insertion point only)** | `pa-chain.test.ts` delegation mode: same member decider completes the chain; grant minted + guard consumed exactly once |
| Production delegation contract | **OPEN — needs architecture ruling** | §“What production must decide” |

The first pass was **too strong**: it proved only that a Member can be admitted
past the Control role closure, not that the resulting allow is redeemable for
a real tool execution. The review correctly identified the missing cross-layer
check; this file now records it.

## 1. Simple Control seam (unchanged)

`pauth.test.ts` — real ControlService + real TeamDomain (`p6t4-helpers`).

- base: Member refused with `CONTROL_RESOLVER_NOT_AUTHORIZED`
  (`allowed: [leader, human]`); Leader accepted.
- throwaway `prototype.patch`: one case-scoped predicate at the SAME role
  closure gate admits the designated Member; the durable decision records that
  instance; the existing guard consumes the allow exactly once; non-designated
  Member and second decision still refused. 5/5.

This remains true, and remains only the **entry** question.

## 2. Full PA chain (new, the review's P0)

`pa-chain.test.ts` — real strict PA manifest, real `createPaEffectsVerifier`
injected into the real `ControlService`, real `createPaControlLeg` landing
edge (mint + guard). Three modes:

```
base        no patch
role-only   prototype.patch (role seam only)
delegation  prototype.patch + delegation.patch
```

Driver: `run-pa-chain.sh` (trap restores both files; logs:
`logs/pa-chain-all-modes.log`).

### base

- `leader` decision → **approve**, grant minted, durable allow consumed
  exactly once.
- Officer → refused by role closure before any PA evaluation. This baseline is
  NOT evidence about PA.

### role-only (the blocker)

With the role seam, the Officer reaches the PA verifier. The durable decision
is **DENY with reason `pa-authority-drift`**; the leg returns `deny`; there is
no grant and no consumption.

Why (source-verified):

- `deciderAuthority()` (`operation-permission/pa-control-bridge.ts:274`)
  maps `{kind:'instance', role:'member'}` to the `member` rung;
- `mayReview(member, member, leader)` is false by construction
  (`governance/authority-ceiling.ts:512-521`: reviewer rank must be strictly
  above beneficiary and at least the required rung);
- `verifyEffectSetApproval()` (`tool-admission/approval-case.ts:446`) applies
  that check per effect; `issueApprovedGrant()` and the guard gate apply the
  same conclusion.

So the review's跨层 diagnosis is confirmed with real objects: **a Member
Officer cannot complete a leader-level PA approval under current law, no
matter which Control entrance admits it.**

### delegation (insertion-point proof, not a proposal)

`delegation.patch` adds a hardcoded mapping in `deciderAuthority()` for the
designated Officer instance → `leader`. With it, the SAME durable decider
(`{kind:'instance', instanceId:'inst-p6t4seedw02', role:'member'}`) completes:

- the durable decision is `allow` and still records `role: 'member'`;
- the PA verifier covers the effect;
- `issueApprovedGrant()` mints;
- the guard consumes exactly once;
- the leg returns `approve`.

This proves the **only missing link is the reviewer-authority derivation**, and
that the chain can work if a trusted case-scoped delegation is recognized by
both the presenter and the verifier. It does NOT prove a production contract:
the mapping is hardcoded and would be a privilege bypass if merged.

## 3. What production must decide (architecture ruling)

A deployable version needs a durable, case-scoped delegation fact that:

1. keeps the real Officer identity (`member`) in the decision row;
2. is derived from the frozen Blueprint + current leg + real instance, never
   from model/client input;
3. binds case id, effect scope, authority generation and lifetime;
4. is honored by `deciderAuthority()` / `verifyEffectSetApproval()` /
   `issueApprovedGrant()` / guard **only inside that case/scope**;
5. does not apply to Officer self-review, governance, Human-only, or
   persistent permission changes;
6. never widens `CONTROL_RESOLVER_ROLES` globally and never writes a fake
   leader identity.

If (4) can be done without changing the rung ladder / `mayReview` / grant law,
it is a minimal approval-layer extension. If it requires a new reviewer
position or a different `mayReview` law, it is a base-law change and needs the
user's explicit architecture ruling **before PR2 is implemented**. That is the
only remaining user-decision item.

## 4. Protected-center note

`packages/runtime/control/**` is ARC-A pinned. PR2 also touches the PA bridge
and verifier, and PR2b touches the durable leg fact. Each requires a named
Center-Interface PR + ledger override + security review. This PoC is not that
authorization.
