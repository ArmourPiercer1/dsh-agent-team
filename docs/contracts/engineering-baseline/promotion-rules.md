# Idea → Contract promotion rules (EB1-D, v0)

Machine-checked half of the ladder summarised in
[README.md](README.md). Written 2026-10-23. No id in
[`ids.yaml`](ids.yaml) is ratified today: every one carries
`normative_status: proposed-not-ratified`, and that is the honest state, not a placeholder
waiting to be flipped.

## The ladder

| step | lives in | required to enter the next step | who may perform it |
| --- | --- | --- | --- |
| **Idea** | `docs/ideas/IDEA-EB-<n>.md` | a question worth testing; **no evidence required, and no check may fail it for lacking evidence** (AC-EB-0001 positive case) | anyone |
| **Decision** | `.agents/notes/proposed/EB-ADR-<n>.md` → `implemented/` or `rejected/` | `status` equals the directory; `decided:` once it leaves `proposed`; `implemented` requires `verified_by:` naming an artifact that exists | Contract Owner |
| **REQ / INV** | `ids.yaml` | `owners`, `source_anchor` that resolves, and a `references:` link from the deciding note | Contract Owner |
| **AC** | `ids.yaml` (`AC-EB-*`) | each acceptance criterion names the observation that would satisfy it, **at a named level C1/C2/C3** | Contract Owner |
| **TEST** | a test or check path | the check exists and can be shown to fail when the law is violated | Test Maintainer |
| **RUN** | an artifact under `dev/agent-workflow/evidence/` | the artifact exists; only then may a registry entry say `verified_*` | whoever ran it |

## Ratification rule (enforced)

An id may leave `proposed-not-ratified` **only** by naming a decision that exists:

```yaml
  - id: INV-EB-0009
    normative_status: ratified
    ratified_by: EB-ADR-0003
```

| violation | verdict code |
| --- | --- |
| `ratified` / `retired` with no `ratified_by` | `ID_RATIFIED_WITHOUT_DECISION` |
| `ratified_by` naming no note in any lifecycle directory | `ID_RATIFIED_BY_UNKNOWN_NOTE` |
| missing or unknown `normative_status` | `ID_STATUS_MISSING` / `ID_STATUS_UNKNOWN` |

Refusing here is the same discipline as `FAKE_VERIFICATION` in the state bridge: a
**status** may not be advanced by editing the file that records the status. The artifact
that justifies the advance has to be somewhere else, and it has to exist.

## What remains human

Whether a decision is *correct*, whether an acceptance criterion actually captures the
risk, and whether a retired contract should be superseded rather than deleted stay with
the Contract Owner. The checker only refuses statuses that cite nothing.
