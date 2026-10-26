# EB3 RED-first (C2) — negative controls fail on the current tree, for the right reason

Captured at worktree HEAD `131364952` (= origin/master `496a3980f` + the C1 audit doc).
No enforcement exists yet; these files are the verbatim RED.

## A. Does the EXISTING gate detect the four mutations?

Runner: `bash tests/checks/eb3-red-baseline.sh <out>` — applies each mutation to the
worktree, runs `docs:sync --check`, `docs:probe --worktree-only`, `ci-pr-gate.mjs --only
graph-parse --only state-freshness`, and the ARC-A fitness suite, then reverts with
`git checkout --` (refuses to start on a dirty tracked tree; tracked tree verified clean
after). Verbatim output: [RED-existing-gate.txt](RED-existing-gate.txt).

| mutation | existing gate | why |
|---|---|---|
| baseline (none) | all exit 0 | precondition met |
| M1 required CI job `census-runtime` deleted | **RED — not detected** | nothing reads `.github/workflows/**` for required-job presence |
| M2 `mcp__injected_server__exfiltrate_everything` planted in product source | **RED — not detected** | no trusted-sources ledger for MCP spellings exists |
| M3a `execution.via` family-body → named-bridge | **RED — not detected** | ARC-A L4 checks names, not the execution arm |
| M3c `nativeNames` made non-literal | detected by `arc-a-fitness` (exit 1) | see the reachability note below |
| M4 search-family imports fs-family **internals** | **RED — not detected** | lane law exists only as README prose |

**Reachability note on M3c (honest disclosure, not a pass).** ARC-A L4 catches it, but
that suite is reached only through the root census. On hosted runners `pr-gate` — the
only Required context — runs the census with `--allow-refused census`
(`.github/workflows/pr-gate.yml:237`), because the pristine host is absent there;
`census-runtime` grades it for real but is **not Required** and is
`cancel-in-progress: true` (`.github/workflows/census-runtime.yml:70`). So today M3c's
detection does not reach the merge decision. Counted as RED for EB3 purposes.

## B. The EB3 control runner on the current tree

Runner: `node scripts/eb3-ci-negative-controls.mjs`. Verbatim output:
[RED-negative-controls.txt](RED-negative-controls.txt). Exit 1.

| control | result | reason |
|---|---|---|
| C1 required-ci-job-removal | FAIL | `scripts/eb3-ci-required.mjs` absent — no enforcement |
| C2 unknown-mcp-tool-injection | FAIL | `scripts/eb3-trusted-sources.mjs` absent |
| C3 execution-definition-replaced | FAIL | `scripts/eb3-family-definitions.mjs` absent |
| C4 cross-family-influence | FAIL | `scripts/eb3-family-boundaries.mjs` absent |
| P1 non-Team native positive preserved | PASS | both assertions present |
| P2 known-old-red identity set complete | PASS | 9 identities + 2 load families parsed; algebra grades identical=pass, +1 red=fail |

Each C-control has two halves that must both hold once enforcement lands: the honest
tree must PASS the enforcement, and the in-memory mutation must FAIL it with the named
code. A scanner that always fails, or always passes, cannot satisfy both.

## Defects in the control itself, found while going RED (kept, not hidden)

1. P2 first planted a red in the markdown display form (`file > name`) instead of the
   gate's identity form (`TEST file::name`); `compareCensus` correctly filed it under
   `added` but not `newReds`, and the control blamed the algebra. Fixed in the control.
2. `--only <typo>` selected zero controls and exited 0 ("0/0 behaved") — absence
   reading as green inside the tool meant to forbid it. Now exit 1.
