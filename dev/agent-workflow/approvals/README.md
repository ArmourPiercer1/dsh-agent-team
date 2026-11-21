# Approvals — one committed record per family/difference

**Machine gate:** [`scripts/ute-retirement-gate.mjs`](../../../scripts/ute-retirement-gate.mjs)
**Frozen contract:** [`docs/plans/memo/ute-g1-20261120/RETIREMENT.md`](../../../docs/plans/memo/ute-g1-20261120/RETIREMENT.md) §3

A UTE retirement row may only treat a retirement-blocking semantic difference as
resolved when the owner has **signed** it. Before 2026-11-21 the gate accepted
"a committed file whose text contains the approver's name" plus "a 40-hex that is
an ancestor of HEAD"; the independent adversarial review (`B2`) reproduced an
ALLOW with a fabricated approval whose `record` was a release-request document
and whose `reference` was the **root commit**. This directory closes that hole by
making the approval a document, not a substring.

## Layout

```
dev/agent-workflow/approvals/
  README.md                                  ← this file
  <family>/<difference-id>.json              ← one owner-signed record
  _selftest/synthetic-difference.json        ← the gate's self-test record (see below)
```

- `<family>` is the ledger row's `family` value (e.g. `fs`, `search`, `web`).
- `<difference-id>` is the ledger's `differences[].id` (e.g. `lane-refusal-code`).
- The filename does **not** carry authority: the gate parses the file and
  requires `family` and `difference` **inside** it to match the row. A record in
  the right directory naming the wrong family or difference is refused.

## Record schema (`ute-approval/1`)

```json
{
  "schema": "ute-approval/1",
  "family": "fs",
  "difference": "lane-refusal-code",
  "decision": "approved",
  "by": "owner",
  "on": "2026-11-21",
  "reference": "PR #<n> @ <40-hex non-root ancestor of HEAD>",
  "rationale": "Which compatibility interface is adopted, and which branches are not covered."
}
```

| field | required | checked |
| --- | --- | --- |
| `schema` | yes | literally `ute-approval/1` |
| `family` | yes | equals the graded ledger row's `family` |
| `difference` | yes | equals the blocking difference's `id` |
| `decision` | yes | one of `approved` / `rejected` / `deferred`; only `approved` resolves |
| `by` | yes | non-empty; must equal the ledger's `approval.by` |
| `on` | yes | `YYYY-MM-DD`; must equal the ledger's `approval.on` |
| `reference` | yes | `^PR #\d+ @ [0-9a-f]{40}$`; the 40-hex must exist, be an **ancestor of HEAD**, and **not be a root commit** (a commit with no parent); must equal the ledger's `approval.reference` |
| `rationale` | yes | non-empty; records the adopted interface and uncovered branches |

Extra keys are allowed (for example `interface` or `branches-not-covered`); the
table above is the closed set that is *checked*.

## What the gate refuses

The ledger's blocking difference still carries a pointer:

```json
"approval": {
  "by": "owner",
  "on": "2026-11-21",
  "record": "dev/agent-workflow/approvals/fs/lane-refusal-code.json",
  "reference": "PR #<n> @ <40-hex>"
}
```

For every `blocking === true` difference the gate emits:

- `UTE_DIFFERENCE_SCHEMA_INVALID` — `blocking` is not literally the boolean
  `true`/`false` (a string `"yes"`, the number `1`, or a missing key is a schema
  error, never "non-blocking").
- `UTE_APPROVAL_RECORD_INVALID` — `record` is not inside this directory, is not
  tracked by git, is not a JSON `ute-approval/1` document, names another
  family/difference, is `deferred`/`rejected`, or disagrees with the ledger's
  `by`/`on`/`reference`.
- `UTE_APPROVAL_UNREFERENCED` — `reference` has the wrong shape, does not exist,
  is not an ancestor of HEAD, or is the root commit.
- `UTE_SEMANTIC_DIFFERENCES_UNRESOLVED` — no approval object at all.

`differences: []` is refused as `UTE_DIFFERENCES_UNDECLARED` unless the row's
`semanticDifferencesResolved.evidence` names a committed file containing the
exact token `SD-VERDICT differences=0`. An empty list means "nobody said what the
comparison found", not "we compared and there are none".

## This directory is empty for every real family, and that is the point

There are **zero** approval records for the eight production families. The
production ledger's blocking differences therefore all remain refused. The only
committed record is:

```
_selftest/synthetic-difference.json
```

It exists so `scripts/fixtures/ute-retirement-selftest/ledger.json` can prove
that `UTE-RETIREMENT-ALLOW` is still reachable through a genuinely approved set
(the gate is not a refuse-everything machine). It cannot licence a real family:

1. its `family` is `synthetic-selftest`, which appears only in that fixture
   ledger and in no production row;
2. the fixture ledger is loaded explicitly with `--ledger`, never from
   `dev/agent-workflow/ledgers/ute-retirement.json`;
3. `scripts/ute-retirement-gate.test.mjs` asserts that this directory contains no
   record for any of the eight production families.

The underscore prefix keeps the fixture-scoped record visibly out of the
`<family>/<difference-id>.json` namespace a reviewer scans.

## Honest limit

The gate proves that an approval is a **committed, family-and-difference-specific
document whose reference is an ancestor commit that is not the root, and that the
ledger pointer and the document agree**. It does **not** prove that the person
named in `by` is entitled to approve; that remains enforced by the protected
branch, PR review and the CI record the `reference` points at. A determined human
can still write an approval file by hand and sign a commit — that is exactly the
point, and exactly what the gate cannot distinguish from a real owner ruling.
