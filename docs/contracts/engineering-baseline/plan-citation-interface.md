# Phase-plan citation interface (EB1-D, v0)

Status: **offered, not adopted**. Nothing in `docs/plans/` was edited to create this
file, and nothing here takes execution authority: the phase's live pointer remains
`dev/agent-workflow/graph.yaml#current_contract` (see
[../../../dev/engineering/README.md](../../../dev/engineering/README.md)).

## The problem this interface solves (measured, not assumed)

E0 found that documents which *point* at things rot faster than the things they point
at: 29 of 29 loose `docs/plans/active/<file>.md` references inside `graph.yaml` and 10
of 10 inside `docs/STATUS.md` no longer resolve, and four files cite the frozen 20260829
set under `docs/plans/paused/` when it lives in `docs/plans/finished/`
([inventory](../../../dev/agent-workflow/evidence/EB-E0-E1/baseline-inventory.md), EB0-1). Those
are prose citations: no machine ever checked them.

## Interface

A phase plan **may** carry one fenced block. A plan that carries no block is not a
finding — plans belong to the phase owner, and this line's standing instruction is that
existing plans stay as written.

````markdown
```yaml eb-plan
phase_id: alpha5-tool-io-governance
baseline: 9b2ee57bc5afd30e89855e09d1769d2e5ec83912
active_plan: docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md
backlog: docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md
matrix: docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md
evidence_root: dev/agent-workflow/evidence/alpha5/
```
````

## Rules a declared block must satisfy

| rule | verdict code | why it is enforced |
| --- | --- | --- |
| every cited path exists | `PLAN_CITATION_MISSING` | a dead citation is how a plan stops being checkable |
| `baseline` resolves as a commit in this repository | `PLAN_CITATION_UNKNOWN_COMMIT` | the EB0-1 pattern was a "current" SHA nobody could open |
| `phase_id` equals `graph.yaml#current_contract.phase_id` | `PLAN_CITATION_CONFLICT` | two editable "current" states is the drift this baseline removes (INV-EB-0012 mirror; the checker reads the mirror, it never writes the graph) |
| `phase_id` present | `PLAN_CITATION_INCOMPLETE` | a block that identifies no phase cannot be reconciled with anything |

`docs:sync --check` scans every non-historical `docs/plans/**` document and reports
`plans=<scanned>(<declaring> declaring)`; `docs:probe` checks only changed plans, and when
no plan declares a block it emits the advisory `PLAN_CITATION_ADOPTION` so that "nobody
adopted it yet" stays visible instead of looking like a pass.

## Deliberate boundaries

- The block is **descriptive**, not authoritative: it may not restate a `tested`,
  `released` or `current` verdict. Delivery claims belong to a note's `verified_by` and to
  the registry axes, which are the places that refuse missing artifacts.
- Historical plans (`finished/`, `paused/`, `issue-fix/`, `third-party/`) and the round log
  are never retro-flagged: they are preserved text.
- Adoption, and any edit to an existing plan, is a phase-owner decision.
