# Engineering Baseline semantic contract index (EB1-B, v0)

Purpose: one place holding the **stable ids** (`REQ-*`, `INV-*`, `AC-*`) that
plans, notes, tests and CI may cite, so that a plan can *reference* a contract
instead of copying it.

## What this directory is not

* It is **not** ratified law. Every entry in `ids.yaml` carries
  `normative_status: proposed-not-ratified`. Text inside the repository does not
  promote itself; ratification is a recorded approval in
  `dev/engineering/registry.yaml` plus Contract Owner review.
* It is **not** the Alpha.5 permission contract. The Alpha.5 M0 contracts
  (`docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/`) remain the
  authoritative source for tool-IO governance; the invariants here are an index
  and a citation surface pointing at them, not a re-drafting.
* It is **not** the frozen contracts record. `docs/contracts/freeze-confirmation.md`
  and `docs/contracts/g3-report.md` keep their own status untouched.

## Relations

```
docs/glossary.md            concept meaning (one concept, one id)
docs/terminology.md         zh/en writing form + deprecated synonyms
docs/contracts/engineering-baseline/ids.yaml   stable REQ / INV / AC ids
.agents/notes/              why a decision was made (proposed/implemented/rejected/archived)
dev/engineering/registry.yaml  the four status axes, hand-maintained decisions
docs/plans/active/          current tasks, owners, exit gates (unchanged authority)
```

Lifecycle: `Idea (docs/ideas) -> Decision (.agents/notes + registry approval) ->
REQ/INV here -> AC -> owning TEST/PROFILE -> real RUN -> gate decision`.
A plan may be archived; a still-valid REQ/INV and its tests do not retire with it.

## Rules

1. One id, one statement. Renaming a statement requires a new id or an explicit
   supersession note; ids are never recycled.
2. `source_anchor` must be a path that exists in this repository. Where the
   authoritative source lives outside the tree (for example the pinned DSH Host
   revision), the anchor points at the in-repo file that carries the pin.
3. Promotion of an entry to a ratified status is a registry change, and the
   probe/sync checks treat it as such.
