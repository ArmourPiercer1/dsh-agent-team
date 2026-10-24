---
id: IDEA-EB-0001
status: idea
title: Change-impact graph selecting minimal document and test set per PR
---

# IDEA-EB-0001 — change-impact graph

Idea only. No execution authority; nothing below is promised or delivered.

## Sketch

Derive, per PR, the set of checks to run from four inputs that already exist as
machine-readable facts:

1. source dependency graph (import edges inside the nine packages, plus the
   public-interface symbols each package exports);
2. the `docs/contracts/engineering-baseline/ids.yaml` citation edges (which test
   or document cites which `REQ-*` / `INV-*` / `AC-*`);
3. the dynamic tool-source delta (Host pin, Team registration declarations,
   trusted profile/config, live MCP list);
4. declared document ownership (one fact, one owner document).

Output: `selected tests + selected doc checks + selected security negatives`,
with `UNKNOWN` when an edge is not resolvable (an unresolvable edge must widen
selection, never narrow it to an empty set).

## Why it might be worth it

The recorded cost in this repository is not writing tests but re-running the
whole world to gain confidence in one family, and the recorded risk is a
selector returning an empty set and reporting green.

## What must be true before anyone builds it

* `docs:probe` and `docs:sync` exist and agree with CI on one selection rule
  (otherwise the graph becomes a third parallel truth).
* Existing red sets keep their owner/classification, so the graph cannot be used
  to "optimise away" a known failure.
* A measured baseline exists for today's wall times, so improvement is a number
  rather than a feeling.
