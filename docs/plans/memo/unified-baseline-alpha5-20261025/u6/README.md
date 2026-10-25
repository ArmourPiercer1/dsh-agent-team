# u6/ — center-assembly design sources for PR #364's U6 lane (versioned by FIX-D, 2026-10-26)

Audit finding D2: the `governance-center` lane (PR #369 / U6 PR1) cited design documents that existed only
on the unmerged PR #363 branch or in local evidence. This directory versions them.

| file | what it is | status |
| --- | --- | --- |
| [center-assembly-architecture.md](./center-assembly-architecture.md) | target architecture (three components, boundaries, failure law) | **adopted as normative design source**; body byte-verbatim from PR #363 @ `1310b959` (see its provenance header). Design text only — its five-stage PLAN is not adopted. |
| [U6-SLICE-PLAN.md](./U6-SLICE-PLAN.md) | reviewed U6 construction slicing (≤6 PRs) | adopted as the lane slicing, **plus amendment A-1** (K1–K5 kernel safety fixes required before ANY enforcement flip). |
| [conditions.md](./conditions.md) | the ten center-enforceable conditions (G1-F supplement-A §5) | adopted as the kernel invariant set (risk R-G1F-3). |
| [five-stage-implementation-plan.md](./five-stage-implementation-plan.md) | non-adoption stub | PR #363's five-stage plan — NOT adopted (#364 supersedes). |
| [phase-1-freeze-inventory-feasibility.md](./phase-1-freeze-inventory-feasibility.md) | non-adoption stub | PR #363's stage-1 plan — NOT adopted (#364 supersedes). |

## Citation mapping (code paths → canonical files)

| cited by | cited path | resolves to |
| --- | --- | --- |
| `packages/runtime/governance-center/index.ts`, `README.md` | `docs/plans/memo/alpha5-reset-20261025/center-assembly-architecture.md` | redirect stub at that exact path → this directory's byte-verbatim copy |

The code-side path stays as-is because `packages/runtime/governance-center/**` is owned by the FIX-K writer
(this package must not touch `packages/**`); the stub makes the citation resolve and points here. A later
FIX-K/center PR may re-point the comments directly at this directory.

## Enforcement posture

Per amendment A-1 and [../gates/GATE-LEDGER.md](../gates/GATE-LEDGER.md): the kernel is INERT/SHADOW only.
No enforcement flip before K1–K5 (FIX-K) land and pass review, and G3's live crash-reclaim SKIP (R-G3-1)
stays open until FIX-T's live run.
