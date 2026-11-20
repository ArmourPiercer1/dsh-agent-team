# SEARCH retirement unit — member coverage (UTE-3 PR B1 old path, reproduced by B2 new path)

The Search family is ONE retirement unit of two model-visible members
(`grep`, `glob`), derived from
`dev/agent-workflow/ledgers/arc-a-family-census.json` (`dsh.search-family`,
`nativeNames: ["(bound-definition) grep", "(bound-definition) glob"]`). This
file maps each member to the baseline vectors that exercise it and to its own
negative control, so the coverage claim can be checked without reading the
corpus source.

Machine gate: `node scripts/ute-retirement-gate.mjs --all` parses the `id` and
`entry` columns of [`old-path.tsv`](./old-path.tsv) and greps the committed
control transcript for `NC-MEMBER <member>`.

Both members are reachable on the product route-C composition, so **every**
vector here is old-path evidence on the shipped composition — no member needs a
disclosed substitute composition (contrast `read_image` in the FS unit).

## Members

| member (`entry`) | baseline vectors (`old-path.tsv`) | negative control (committed transcript) |
|---|---|---|
| `grep` | `SR-G1-inlane-match`, `SR-G2-no-path-stdin`, `SR-G3-outside-denied`, `SR-G4-lane-bound`, `SR-G5-missing-target`, `SR-G6-invalid-pattern`, `SR-G7-cancel-before-dispatch`, `SR-G8-retention-limit`, `SR-G9-binary-file` | `NC-MEMBER grep` — widen ONLY the read lane around `SR-G3`; the same call then succeeds and returns the planted out-of-lane secret |
| `glob` | `SR-L1-inlane-known-set`, `SR-L2-outside-denied`, `SR-L3-lane-bound`, `SR-L4-missing-target`, `SR-L5-invalid-pattern`, `SR-L6-cancel-before-dispatch` | `NC-MEMBER glob` — widen ONLY the read lane around `SR-L2`; the same walk then succeeds and lists the out-of-lane path |

Each `NC-MEMBER` is paired with `NC-MEMBER-POSITIVE <member>`, which re-runs the
UNMODIFIED vector and shows it still reproduces its golden row. A control whose
mutant looks like the baseline goes RED; that is what makes the positive line
load-bearing rather than decorative.

Two further composition-level controls prove the routing itself is the
authority:

* `NC-SHADOW-LOAD-BEARING` — disposing the realm's own PD-16 search shadow makes
  the refused out-of-lane `grep` succeed with the secret (the inherited
  unconfined definition answers). Restored, it refuses again.
* `NC-STDIN-LOAD-BEARING` — the same disposal on `SR-G2` turns the path-less
  zero-match answer into real matches, proving that emptiness is the confined
  child's stdin, not the fixture.

Plus `NC-HARNESS-BITES` (a flipped golden digest must go RED) and
`NC-CATEGORY-TOTAL` (an unexplained refusal must raise
`REFUSAL_VOCABULARY_INCOMPLETE`; `unknown` unreachable).

Transcript: `dev/agent-workflow/evidence/ute3-search-b1-20261120/negative-controls.txt`
(and the same lines are re-run by `lane-suite.test.mjs`).

## Refusal classes seen per member

| member | classes used by its vectors |
|---|---|
| `grep` | `denied-by-lane` (2), `missing-path` (1), `invalid-argument` (1), `cancelled` (1) |
| `glob` | `denied-by-lane` (2), `missing-path` (1), `invalid-argument` (1), `cancelled` (1) |

`read-before-write`, `stale-version`, `unsupported-mode` and
`route-unresolved` are FS-shaped and are NOT produced by any Search vector; the
residual `unknown` is unreachable by construction. A member with zero captured
vectors would fail the lane suite's per-member minimum — that is the
non-vacuity gate for this table.
