---
id: EB-ADR-0001
title: Documentation consistency gates are required infrastructure, not optional polish
status: proposed
owners: [Doc/Tooling Owner, Doc/Contract Owner]
affects: [docs/glossary.md, docs/terminology.md, docs/contracts/engineering-baseline/ids.yaml, .agents/notes/, dev/engineering/, scripts/docs-probe.mjs, scripts/docs-sync.mjs]
references: [REQ-EB-0001, REQ-EB-0002, AC-EB-0001, AC-EB-0004, docs/glossary.md]
---

## Context

Two failure modes are recorded in this repository's own history. The first is a
document describing current behaviour that the source no longer matches — the
stale `AGENTS.md` per-round pointers and the `ROUTER_RULES.md` §1 model-route pin
that §0 had already abolished while §1's body still demanded "stop if the route
does not match" are live examples on the current trunk. The second is the
opposite error: a check that demands runtime evidence from a document which is
only proposing something, which trains people to disable the check.

Today no CI job runs any documentation check at all, so neither error can be
caught before merge. The engineering-baseline design (PR #361) states the
position that these gates are mandatory work, not optional enhancement.

## Decision

Proposed (not yet ratified as a merge gate):

1. `pnpm docs:probe --base <verified-base>` runs on every PR as a required check
   and locally before commit; it resolves committed, staged and unstaged changes
   against a base it has verified, and refuses rather than defaulting to a remote
   HEAD it cannot check.
2. `pnpm docs:sync --check` (read-only) is selected when the change touches
   public declarations, configuration, generated derivatives or contracts; CI
   never runs `--write`.
3. Ideas and Proposals pass without runtime evidence. Already-implemented or
   currently-supported claims must point at an artifact that exists, otherwise
   they fail as `NOT_VERIFIED`.
4. A T0 document probe never substitutes for C1/C2/C3, security negatives or the
   permission core; the check's own scope is declared in its output so a green
   probe cannot be read as "behaviour verified".

## Consequences

* Documents acquire owners, so a stale statement names a responsible party
  instead of being discovered by whoever happens to read it.
* Some PRs that are currently mergeable will fail until their documents are
  aligned; that is the intended cost, and it is bounded by rule 3.
* The checks are only as good as their negative controls: a rule without a
  scenario that proves it can fail is treated as not delivered.
* Ratification as a required status check is a separate decision from this note
  (it touches branch protection and CI, outside this document's scope).
