---
id: EB-ADR-0003
status: implemented
decided: 2026-10-23
title: Document-consistency gates, phase-plan citation interface and the state bridge are implemented in this branch
references:
  - docs/contracts/engineering-baseline/README.md
  - docs/contracts/engineering-baseline/plan-citation-interface.md
  - docs/contracts/engineering-baseline/promotion-rules.md
  - INV-EB-0009
  - C-EB-0013
verified_by:
  - dev/agent-workflow/evidence/EB-E0-E1/controls-run-1.log
  - dev/agent-workflow/evidence/EB-E0-E1/mutation-control-1.log
  - dev/agent-workflow/evidence/EB-E0-E1/probe-run-1.log
---

## Context

`EB-ADR-0001` proposed the gates and `EB-ADR-0002` rejected a frozen tool whitelist. E0
then measured what the absence of any document check costs: dead citations in
`graph.yaml` (29/29 loose plan references) and in `docs/STATUS.md` (10/10), four files
pointing at the frozen 20260829 set in the wrong directory, and a governance record set
whose every row is `executionEvidence=NOT_RUN` while prose elsewhere reads as finished work.
EB1-A/B/C/D/E/F were built to close the narrow, mechanically checkable part of that.

## Decision

Implemented in `task/eb-e0-e1-doc-baseline-20261029` (this branch, **not merged**):

- note lifecycle validation where `status` must equal the parent directory and
  `implemented` requires an artifact that exists;
- a stable-id index plus a ratification rule: an id leaves `proposed-not-ratified` only by
  naming a note that exists — a status may not be advanced by editing the file that
  records the status;
- the state bridge, which refuses `verified_*` without a resolvable artifact
  (`FAKE_VERIFICATION`) and mirrors `graph.yaml#current_contract` read-only;
- an optional `eb-plan` citation block for phase plans, where **absence is not a finding**
  and presence is checked;
- `docs:probe` (change-scoped, T0), `docs:sync` (full check; `--write` touches only the
  generated view) and 27 positive/negative controls.

## Consequences

The claim in this note is bounded to what the artifacts show: static checks pass and every
rule has been shown capable of failing, including under mutation
(`checkIdUniqueness` disabled → NEG-5 turns red). It asserts **no** C1/C2/C3, no runtime
behaviour, and no release readiness. Nothing is wired into CI; `EB1-D` adoption by real
phase plans is still the phase owner's decision; the ids remain unratified, so this note
delivers a mechanism that currently judges nothing as law.
