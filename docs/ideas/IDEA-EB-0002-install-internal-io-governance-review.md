---
id: IDEA-EB-0002
status: idea
title: Reconsider whether install-internal IO should be governed, and what would justify the cost
---

# IDEA-EB-0002 — install-internal IO governance review

Idea only. **No execution authority**: nothing below is promised, scheduled, or approved, and no work
package is authorized by this file. It exists because the user asked, on **2026-10-24T09:04:45Z**, that
the Alpha.5 install-action boundary be recorded *as a follow-up discussion item* rather than as a
settled design: "这只是目前 Alpha.5 这么做，以后如果发现有问题可能还会进一步升级管控".

The decision it hangs off is `EB-ADR-0004` (`.agents/notes/proposed/EB-ADR-0004-plugin-manager-install-action-boundary.md`).
The authority for what Alpha.5 actually governs is main's contract and matrix
(`docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md` §B-PLUGIN,
`docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md`), not this file.

## The open question

The concession is narrow and stays narrow here: it concerns the **internal IO of one action,
`install_bundle`** — once the install is permitted, the `pnpm` file writes, network fetches and package
initialization code it performs are outside what Team promises to isolate. The other seven
`plugin_manager` actions are not part of this question, and the install action still owes its own
contract obligations (accurate target, real PA plus Host approval, end-point freshness, waitcancel),
which are neither delivered nor tested and are not made easier by anything below.

The open question is whether that narrow non-promise is the right steady state, or whether some observed
class of problem would make governing `install_bundle`'s internal IO worth its cost.

## Three things genuinely undecided

1. **Whether** to govern install-internal IO at all, and at which seam — the Team action layer, the
   Host installer path, or the Host `approveEscalation` step. These have very different blast radii; one
   is an authorization check, one reaches inside another component's execution.
2. **What would trigger** the discussion. A trigger has to be an observation, not a feeling. Candidates
   worth naming so a future reviewer can reject them individually: an install that a user did not intend
   succeeding with Team authorization intact; install-time file writes landing outside the package tree
   the action implies; a plugin's initialization performing network writes no gate saw; a discrepancy
   between what the matrix says a manager call does and what a receipt shows it did. Absent such an
   observation, "more control" is not a trigger.
3. **What it costs to maintain.** Any internal-IO governance has to survive plugin diversity, `pnpm`
   behaviour changes, and the Host's own script/version-exemption approvals; it risks duplicating a
   guarantee the Host already attempts, and duplicating a guarantee is how two authorities over one
   decision get created. The cost side has never been estimated here, and this file does not pretend to.

## What this idea explicitly is not

- Not an exemption beyond that one action. The boundary concerns `install_bundle`'s internal IO only:
  the other seven `plugin_manager` actions keep their obligations, no other tool's IO governance is
  relaxed, and this file extends the concession to nothing.
- Not a claim that anything is implemented, run, or tested. No status on any of the four axes is implied
  by this file.
- Not a follow-up task. Recording it does not schedule it; converting it into work requires a decision in
  `.agents/notes/`, an approval in `dev/engineering/registry.yaml`, and a durable id with real normative
  status in `docs/contracts/engineering-baseline/ids.yaml` — the maturation path in
  `docs/ideas/README.md`, none of which has happened.
- Not permanent. If the discussion concludes the boundary should tighten, `EB-ADR-0004` gets superseded
  by that decision rather than reinterpreted.
