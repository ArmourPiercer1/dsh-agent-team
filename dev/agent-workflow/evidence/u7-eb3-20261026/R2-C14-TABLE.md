# C14 — R2 F-2: the leg reader as an ALLOWLIST (before vs after)

Each row calls `gradeLeg` on a synthetic step for the leg `node scripts/docs-sync.mjs --check`.
"before" = the reader at 3af623b2e (the head R2 reviewed: a denylist). "after" = the allowlist.
Derived by evaluating the case lists from the C14 control's own source, so this table IS the control.

**Before: 28 of 46 negatives SATISFIED the leg (leaks). After: 0. Allowed shapes refused after: 0. Every real layer satisfies every leg.**

| # | case | before (3af623b2e, denylist) | after (allowlist) | code after |
|---|---|---|---|---|
| N1 | r2-1 if false; then …; fi | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N2 | r2-1 if false, leg on its own line | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N3 | false && leg (errexit ignores non-final && members) | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N4 | leg && true (leg failure swallowed as non-final) | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N5 | trap EXIT after (overrides exit status) | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N6 | function shadowing node | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N7 | PATH redirected before | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N8 | cd before (relative script path moves) | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N9 | source before | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N10 | step working-directory | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N11 | step env PATH | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N12 | r2-2 background & | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N13 | r2-3 \|\| exit 0 | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N14 | set +e before | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N15 | set +o errexit before | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N16 | trap … ERR before | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N17 | bash -c '…' | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N18 | sh -c "…" | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N19 | inside $( ) | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N20 | inside backticks | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N21 | case arm | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N22 | case arm, own line | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N23 | { …; } \|\| true | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N24 | ( … ) | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N25 | ; true after | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N26 | \| cat without pipefail | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N27 | \| cat WITH pipefail (only `\| tee <file>` is allowed) | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N28 | leg LAST in a pipe, even with pipefail (deliberately narrowed) | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N29 | \| tee WITHOUT pipefail | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N30 | \| tee then \|\| true | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N31 | for loop body | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N32 | while loop body | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N33 | function body | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N34 | eval | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N35 | xargs | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N36 | heredoc fed to bash | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N37 | step if: false | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N38 | step if: ${{ false }} | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N39 | step if: github.event_name == push | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N40 | shell: bash {0} \|\| true | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N41 | shell: python | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N42 | step continue-on-error | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N43 | && chain with a non-simple head | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| N44 | ! negation | unsatisfied | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| P1 | plain line | satisfied | satisfied | - |
| P2 | after set -euo pipefail | satisfied | satisfied | - |
| P3 | env assignment prefix | satisfied | satisfied | - |
| P4 | line continuation | satisfied | satisfied | - |
| P5 | pipefail + leg FIRST, into tee (the census shape) | satisfied | satisfied | - |
| P6 | if: always() | satisfied | satisfied | - |
| P7 | shell: bash | satisfied | satisfied | - |

## D12 addendum (main-agent verification at 6c1aeda17)

| # | case | before (6c1aeda17) | after (D12) | code after |
|---|---|---|---|---|
| D1 | NODE_OPTIONS prefix | **SATISFIED — leak** (exploit proven: exit 3 → 0) | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| D2 | BASH_ENV prefix | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| D3 | LD_PRELOAD prefix | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| D4 | PATH prefix | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| D5 | unknown FOO=1 prefix | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| D6 | NO_COLOR=1 then NODE_OPTIONS prefix | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| D7 | NODE_OPTIONS prelude line | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| D8 | unknown FOO=1 prelude line | **SATISFIED — leak** | unsatisfied | CI_LAYER_LEG_UNPROVEN |
| DP1 | NO_COLOR=1 prefix (allowlisted) | — | satisfied | - |
| DP2 | TZ=UTC LC_ALL=C prefixes (allowlisted) | — | satisfied | - |
| DP3 | CI=true prelude line (allowlisted) | — | satisfied | - |

(The base table's former positive "env assignment prefix `FOO=1`" is now negative D5:
FOO is not on the allowlist. That positive was wrong, and D12 is what made it visible.)
