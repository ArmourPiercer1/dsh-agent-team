# R-1a 来源对照表 — fixed at implementation commit `b1dcc262`

User review (读 `520a250d`, relayed 2026-10-16): "envelope 同 scope 有 bound 规则
命中" does NOT prove who wrote the deny — the Envelope answers WHO MAY APPROVE
WHAT RANGE, never WHO-WROTE-THE-DENY; an unrelated rule could launder the old
fail-open into a mis-pass. Required control: SAME policy deny, SAME envelope
coverage, only the SOURCE differs ⇒ distinguishable; a rung may approve only
denys belonging to authorities BELOW it. Proof allowed: trusted projection of
real authority state + source reference/version consistency. Forbidden:
copying a policy deny into the Envelope as "source" (forgery); touching the
two-plane no-match laws. Unwired ⇒ precise refusal, stated live, not deferred
behind DORMANT.

Implementation at `b1dcc262` (RED pinned one commit earlier at `e701d274`;
GREEN log `runs/green-tail-r1-round.log`, 9 suites 131/131; RED log
`runs/red-r1-tail.log`, 3 reds pre-fix). Mechanism: `PolicyDenySource`
(evidence-grade projection entry: `ownerAuthority`, `sourceRef`,
`sourceVersion`) + version equality against the call's authority generation +
case rung = `max(walk rung, rungAbove(ownerAuthority))` + reproof at issue.

## The table (pinned by the test `对照表 (user review 520a250d) … six source states`)

Policy deny: `write realm-a|data/b.txt ⇒ deny` (identical in every row).
Envelope: mutation envelope with `write@realm-a|data/b.txt ⇒ deny` rule
(identical in every row unless stated). Generation g1, beneficiary member.

| # | deny source state | outcome | rung where the case opens | mint? |
|---|---|---|---|---|
| a | owner = **leader** authority, `sourceVersion`=1 (matches) | **PASS** | `human-user` | Leader's own presentation REFUSED (`may not review`); Human-User's mints (1) |
| b | source **UNKNOWN** (projection unwired) | **REFUSE** `deny-source-unattributed` | — | 0 registrations |
| c | owner = **different Team authority** (human-user hard ceiling), same coverage | **PASS** | `human-admin` (floor from the SOURCE, not the envelope) | Human-User's own presentation REFUSED; Admin's mints (1) |
| d | owner = leader but `sourceVersion`=2 ≠ generation 1 | **REFUSE** `deny-source-version-drift` | — | 0 |
| e | owner = **human-admin** (top authority wrote it) | **REFUSE** `deny-owner-above-ladder` — no one-shot exists, only spec §8.2's permanent path | — | 0 |
| f | envelope carries only an unrelated **`ask`** rule at the scope + no source | **REFUSE** `deny-source-unattributed` — matching an unrelated rule launders nothing | — | 0 |

**Distinguishability (the review's exact demand): rows a / b / c share policy +
envelope byte-for-byte and produce three different, precise behaviors** —
(a) opens at human-user, (b) never opens, (c) opens one rung higher. Mint
consequence pinned: rows b/d/e/f leave `registrations === 0`; the mint path
re-runs the proof (`issueApprovedGrant` reproof leg) so a pre-forged
presentation cannot mint over an unproven deny either (the residual fail-open
the RED captured as "leader leg MINTS, registrations 1").

## Unwired state — stated, not deferred

`AdmissionKernelOptions.denySources` is OPTIONAL and the production assembly
does not yet wire it (the real projection source — blueprint §3.2 lanes +
GovernanceMutationService overlay §8.2 entries with stable refs/versions —
is PR3 wiring). Until wired, EVERY denied effect meets
`TOOL_BINDING_UNVERIFIED / deny-source-unattributed` with the message naming
the unwired state. This is deliberate fail-closed at the live door, NOT a
gap parked behind DORMANT.

## Anti-forgery

Copying a policy deny into `AuthorityEnvelopeDocuments` (hard or mutation)
does NOT satisfy the proof: rows b/f pin that envelope content is never
source evidence. `sourceCovers` needs exact/subtree-with-seam containment;
no seam ⇒ containment unanswerable ⇒ unattributed. The two-plane no-match
laws (A1-4 absence-is-not-denial; expansion-plane semantics) are untouched:
the source gate applies ONLY to indices the expansion plane already decided
as denied, and the ceiling walk itself is byte-identical behavior.

## Contract sentence (for INTERFACES-v1.md C-ADM — file not in this tree; lane carries it until the doc's owner lands it)

> A policy DENY may enter the ApprovalCase ladder only with a source
> projection entry (owning authority + sourceRef + version) trusted at the
> call's authority generation; the case sits strictly above the owning
> rung; unwired, drifted, or top-owned denys are precise refusals, and
> Envelope content is never source evidence.
