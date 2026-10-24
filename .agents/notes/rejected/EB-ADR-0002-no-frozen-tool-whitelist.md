---
id: EB-ADR-0002
title: Do not freeze the 93 M0 source records as a closed tool whitelist
status: rejected
decided: 2026-10-23
owners: [Contract/Security Owner, Tool Inventory Owner]
affects: [docs/contracts/engineering-baseline/ids.yaml]
references: [REQ-EB-0004, C-EB-0009, docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md]
---

## Context

M0 produced 93 source records across 27 families, and it is tempting to turn
that table into the authoritative tool list: it is complete for one design
截面, it is already reviewed, and a static whitelist is trivial to check.

Two things break it. DSH adds, renames and rescopes tools on its own schedule,
including tools that arrive through dynamic MCP servers in a running profile, so
a frozen table drifts silently and every upstream addition becomes a false
alarm or a silent miss. And a name list cannot express identity at all: two
same-named tools in different scopes, or a same-named tool behind a new Provider
generation, are different execution bodies (C-EB-0002), which is exactly the
distinction the governance work exists to make.

## Decision

Rejected. The 93 records stay what they are — a historical design seed and an
import mapping into long-term `INV-*` / `REQ-*` references — and the expected
tool baseline is instead derived from authoritative sources: the approved Host
pin, reviewed Team registration declarations, trusted profile/config, and
observed runtime inventory. A source change regenerates the expectation and
produces a diff; a newly discovered tool enters as `UNKNOWN` and must be
classified, wired and tested.

Two concepts are kept deliberately separate: an **evolving catalog baseline**
(what should exist) and a **frozen verification 截面** (what one RUN proves).
The second never retroactively promotes an untested tool when the first moves.

## Consequences

* The census needs source identity (Host pin digest, profile/config digest,
  runtime inventory digest) rather than a checked-in table, so more machinery is
  required than a diff against a list.
* Authorization never follows automatically from discovery: appearing in the
  catalog creates an obligation, not a permission or a pass.
* Existing M0 acceptance records remain valid history and are not re-labelled
  when the expected set changes.
