# Agent Notes — decision-reason record (Engineering Baseline EB1-A, v0)

Physical directory for **why** a decision was made. Not a schedule, not an
acceptance log, not current state.

Authority for this mechanism: `docs/plans/memo/engineering-baseline/architecture.md`
§3.2 item 5 and decision D7 (PR #361, design-only). This directory is a **new
entry point**; it takes over no existing authority. `dev/agent-workflow/graph.yaml`
`current_contract` remains the current execution pointer, and
`dev/agent-workflow/SESSION_ROUTER_LOG.md` remains the append-only round log.

## Layout

```
.agents/notes/proposed/     decided-or-pending ideas that are not delivered yet
.agents/notes/implemented/  delivered AND verified
.agents/notes/rejected/     not adopted, with the reason
.agents/notes/archived/     superseded; must cross-reference the successor
```

A note moves directory only on **delivery** or **rejection**. Approval is a
different axis and lives in `dev/engineering/registry.yaml`
(`decision_status`), so a note can be `accepted` while still sitting in
`proposed/`. Four axes are recorded separately and never imply each other:
`decision_status` / `implementation_status` / `verification_status` /
`release_status`.

## Format (machine-checked)

Frontmatter record, no markdown body outside the required sections:

```yaml
---
id: EB-ADR-0000            # EB-ADR-<4 digits>, unique across all directories
title: one line
status: proposed | implemented | rejected | archived   # MUST equal parent dir
decided: 2026-10-29        # required unless status is proposed
owners: [Contract Owner]   # roles, not persons
affects: [docs/..., packages/...]
references: [INV-EB-0001, docs/glossary.md]
verified_by: [dev/agent-workflow/evidence/<task>/<file>]  # required when status is implemented
supersedes: EB-ADR-....    # optional; required when status is archived
---
```

Required body sections, in order: `## Context`, `## Decision`, `## Consequences`.

## Rules the checker enforces

1. `status` must equal the parent directory name.
2. `id` grammar + global uniqueness.
3. `references` must resolve: repo paths exist; `REQ-*` / `INV-*` / `AC-*` ids
   exist in `docs/contracts/engineering-baseline/ids.yaml`.
4. `implemented` requires `verified_by` with at least one path that exists.
   A note claiming delivery without a resolvable artifact fails as
   `NOT_VERIFIED`. Claiming `C2` / "tested" from `C1`-only evidence is a
   semantic judgement for the Contract Owner, not a regex — the checker only
   proves the artifact exists.
5. `proposed` / `rejected` notes may describe future behaviour but may not
   carry `verified_by` (that would fake delivery), so they cannot assert
   delivery at all.

Run: `pnpm docs:probe` (fast, changed files only) or
`node scripts/verify-agent-notes.mjs` (full tree).
