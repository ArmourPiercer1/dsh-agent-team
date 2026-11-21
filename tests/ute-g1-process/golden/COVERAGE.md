# PROCESS retirement unit — member coverage (UTE-3 PR B1, old path only)

The Process family is ONE retirement unit of two model-visible members
(`bash`, `pwsh`), derived from
`dev/agent-workflow/ledgers/arc-a-family-census.json` (`dsh.process-family`,
`nativeNames: ["(bound-definition) bash", "(bound-definition) pwsh"]`). This
file maps each member to the baseline vectors that exercise it and to its own
negative control — and states, for `pwsh`, WHY it has neither.

Machine gate: `node scripts/ute-retirement-gate.mjs --all` parses the `id` and
`entry` columns of [`old-path.tsv`](./old-path.tsv) and greps the committed
control transcript for `NC-MEMBER <member>`. At B1 that gate prints
`unit=0/2`: `bash` has a baseline and its own control but NO new-path vector,
`pwsh` has nothing — and neither is a retired member.

## Members

| member (`entry`) | baseline vectors (`old-path.tsv`) | negative control (committed transcript) |
|---|---|---|
| `bash` | `PB-B1-inlane-stdout`, `PB-B2-exit-code`, `PB-B3-stderr`, `PB-B4-stdout-cap`, `PB-B5-timeout`, `PB-B6-abort-before-dispatch`, `PB-B7-outside-workdir`, `PB-B8-outside-read-os`, `PB-B9-outside-write-os`, `PB-B10-env-scrub`, `PB-B11-stdin-ignored`, `PB-B12-missing-workdir`, `PB-B13-invalid-command`, `PB-B14-bound-workdir` | `NC-MEMBER bash` — widen ONLY the read lane around `PB-B8`; the same call then succeeds and returns the planted out-of-lane secret |
| `pwsh` | **none — DECLARED EXCLUSION** (see below) | **none** — a control without a member to mutate would be vacuous, and a vacuous control is not a control |

Each `NC-MEMBER` is paired with `NC-MEMBER bash-POSITIVE`, which re-runs the
UNMODIFIED vector and shows it still reproduces its golden row. A control whose
mutant looks like the baseline goes RED; that is what makes the positive line
load-bearing rather than decorative.

Two further composition-level controls prove the routing itself is the
authority:

* `NC-SHADOW-LOAD-BEARING` — disposing the realm's own PD-12 bash shadow makes
  the refused out-of-lane WORKDIR call SUCCEED through the inherited preset
  definition (base service called, confined provider never called).
* `NC-CONFINEMENT-WITNESS` — the same disposal on `PB-B8` makes the inherited
  (unconfined) shell read the planted secret, so the confined-vs-inherited
  witness demonstrably bites.

Plus `NC-HARNESS-BITES` (a flipped golden digest/exit status must go RED),
`NC-CATEGORY-TOTAL` (an unexplained refusal must raise
`REFUSAL_VOCABULARY_INCOMPLETE`; `unknown` unreachable), and three
declaration-level controls: `NC-TIMEOUT-LOAD-BEARING` (a 30 s caller timeout
lets the payload finish and write its marker), `NC-ENV-SCRUB-LOAD-BEARING` (the
secret opted in through the install spec DOES reach the child), and
`NC-CAP-LOAD-BEARING` (the inherited definition answers a different cap, so the
recorded 262144 is the shadow's declaration).

Transcript: `dev/agent-workflow/evidence/ute3-process-b1-20261120/negative-controls.txt`
(and the same lines are re-run by `lane-suite.test.mjs`).

## Why `pwsh` has no vector (`unit=1/2`, declared)

The exclusion is MEASURED in
`dev/agent-workflow/evidence/ute3-process-b1-20261120/composition-probe.txt`:

The exclusion is derived from the **shipped wiring**, never from the host
(`lib/pwsh-exclusion.mjs`; `PROC-8`; `NC-PWSH-EXCLUSION-CONDITIONAL`).

| fact | kind | measured |
|---|---|---|
| route-C shadow | **WIRING (decisive)** | `PROBE-PWSH route-c-shadow=ABSENT` |
| shipped governed preset row | **WIRING (decisive)** | `PROBE-PWSH preset-row=REMOVED-by-the-shipped-governed-preset` |
| post-attach Member scope | **WIRING (decisive)** | `PROBE-ROUTE-UNREACHABLE member=pwsh reason=no definition is registered for this name on the post-attach Member scope` |
| legacy plane name ledger | **WIRING (decisive)** | `PLANE_NAMES_INVALID` — the plane's name map is closed to grep/glob/bash, so `pwsh` cannot even be expressed |
| `pwsh` binary | OBSERVATION (host) | `PROBE-PWSH binary=…` — printed and recorded, **never asserted**: hosted run 44843401144 red exactly because a runner ships PowerShell and the first revision had pinned `binary=ABSENT` |
| host package | OBSERVATION (host tree) | `PROBE-PWSH ... host-package=present` (the pinned host tree ships the package; nothing serves it) |

Rule: while the wiring serves no `pwsh` the exclusion is legal; the moment any
wiring fact starts serving it, the corpus is OBLIGED to carry a `pwsh` vector
and the run REFUSES the exclusion (`PWSH-EXCLUSION-UNJUSTIFIED`). A `pwsh`
vector could therefore only be captured on a hand-built composition that no
shipped wiring produces; capturing that would be a substitute path, so it is NOT
done. The member keeps its census slot; the unit stays short and every artifact
says so.

## Refusal classes seen per member

| member | classes used by its vectors |
|---|---|
| `bash` | `denied-by-lane` (2: PB-B7, PB-B14), `missing-path` (1: PB-B12), `invalid-argument` (1: PB-B13), `cancelled` (1: PB-B6) |
| `pwsh` | none (unreachable) |

`read-before-write`, `stale-version`, `unsupported-mode` and
`route-unresolved` are FS/Search-shaped and are NOT produced by any Process
vector; the residual `unknown` is unreachable by construction. A member with
zero captured vectors would fail the lane suite's per-member minimum — that is
the non-vacuity gate for this table, and it is exactly why `pwsh` is recorded as
an EXCLUDED member rather than as a member with zero rows.
