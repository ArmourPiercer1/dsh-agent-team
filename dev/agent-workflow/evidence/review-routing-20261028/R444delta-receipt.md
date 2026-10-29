# R444 adoption-delta receipt (main-agent machine run at 896b98976, criterion set by R444-D seat)

R444-D (qwen flash seat, verdict 通过) pre-declared its adoption checks. Main-agent run at head 896b98976 (detached worktree, no pipe masking):
- `--candidate-sha --json` => exit=2, stderr `usage error: --candidate-sha requires a non-empty SHA value (got "--json") — refusing to run unenforced` (previously SILENT unenforced)
- `EB3_CANDIDATE_SHA="  "` => exit=2 (blank env refused)
- fixtures: tests 12 / pass 12 / fail 0 (was 9; +3 = missing-failedScope, non-verbatim runOverall, invalid proof value — last one asserts already-correct ACCEPT_SCHEMA rejection per fixer, no rule change)
- plain gate => 0 findings pass; `--candidate-sha 5d0c8ff583…` => findings=56
Reviewers' verdicts on the PR: R444-B v4pro 通过(+A1/A2), R444-C 27b 通过(+3 advisories), R444-D flash 通过(nits adopted herein), R444-E flash 通过(data plane, programmatic 31×4 diff: only the 8 cells changed). All five advisories deferred as R-ACCEPT-RUN-2 (row updated in this round's sync PR). Merge additionally gated on CI at this head.
