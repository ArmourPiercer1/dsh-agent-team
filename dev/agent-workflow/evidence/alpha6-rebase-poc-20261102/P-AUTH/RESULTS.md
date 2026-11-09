# P-AUTH — Control seam + FULL PA tool-approval chain (executed 2026-11-02, re-rated after review)

**Final verdict (supersedes the first pass):**

| Layer | Verdict | Evidence |
| --- | --- | --- |
| Simple Control decision seam | **PASS** | `pauth.test.ts` base 2/2; prototype 5/5 |
| Full PA tool-approval chain under a real `member` Officer | **FAIL under base law** | `pa-chain.test.ts` role-only mode: durable DENY `pa-authority-drift`, zero grant, zero consumption |
| Case-scoped delegation prototype | **PASS (proves the insertion point only)** | `pa-chain.test.ts` delegation mode: same member decider completes the chain; grant minted + guard consumed exactly once |
| Production delegation contract | **DECIDED by ADR-A6-1 (2026-11-03); implementation not started** | §3; `docs/plans/memo/alpha6-review-separation/ADR-alpha6-review-capability-20261103.md` |

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

## 3. Production contract — decided by ADR-A6-1 (2026-11-03)

The user chose “ADR first”, and authorized a systematic review-authority
extension. The contract is now fixed in
[`ADR-alpha6-review-capability-20261103.md`](../../../../../docs/plans/memo/alpha6-review-separation/ADR-alpha6-review-capability-20261103.md):

1. the durable `decider` stays the real Principal (`member` for the Officer);
2. a case/leg/scope-scoped `ReviewCapability` is evaluated by ONE pure
   evaluator from the frozen Blueprint + current leg + real instance — never
   from model/client input;
3. the durable decision carries the capability snapshot (additive; legacy
   rows absent = old behaviour);
4. PA presenter, verifier, `issueApprovedGrant` and guard read that same
   snapshot; no per-entry Officer→Leader hardcode;
5. no per-case Mandate ledger; the only new fact is a minimal current-leg
   Handoff record;
6. Human, Leader-only governance/persistent-permission changes, self-review
   and the non-delegated semantics stay untouched.

Implementation is **not started**. Per the execution plan it is sliced into
A6-PR2a (pure evaluator), A6-PR2b (Control + PA unified contract, protected
center), A6-PR2c (Handoff + wiring), A6-PR5 (Officer access). The three-mode
PoC above is now a regression baseline, not a design question.

## 4. Protected-center note

`packages/runtime/control/**` is ARC-A pinned. PR2b also touches the PA bridge
and verifier, and PR2c touches the durable leg fact. Each requires a named
Center-Interface PR + ledger override + security review. This PoC is not that
authorization; the ADR is design authorization only.
