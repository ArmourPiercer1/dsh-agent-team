# G1–G9 + D1 file attribution

Full machine-readable name-status lists:
`attribution-g1.txt` … `attribution-g9.txt`, `attribution-d1.txt`.
These are generated from the exact commits, not hand-written.

| slice | commit | files | dominant areas |
|---|---|---:|---|
| G1 | `4bb14410a` | 18 | `packages/runtime/review-router`, `packages/domain/blueprint` v5 grammar, tests, `runtime/tsconfig.json` |
| G2 | `161426de4` | 6 | `packages/runtime/review-authority`, tests |
| G3 | `ee2059faf` | 35 | `packages/runtime/control` case chain/PA metadata, runtime tests |
| G4 | `919148529` | 15 | `packages/runtime/control` transfer + Human visibility, tests |
| G5 | `9ded0c2b5` | 7 | `packages/runtime/review-wake` coordinator, lane hygiene |
| G6 | `bfac1d5d2` | 10 | `review-wake/delivery`, live glue, testkit booking, `vitest.config.ts` |
| G7 | `61ce7b54c` | 20 | `packages/runtime/control` Officer gate, `packages/tools` surface, tests |
| G8 | `7554d047d` | 187 | `root.ts`/`host.ts`/`types.ts`/live bindings, `alpha6/*` composition/notifier, testkit/domain/client wiring, ARC ledger |
| G9 | `40b6b4b01` | 98 | owner/execution-result in control+root+live bindings, `a5p5` pipeline/register, Inbox/crash tests, c1 kit, ARC ledger |
| D1 | `bf2d693c8` | 418 | `dev/agent-workflow/evidence/**`, A6 docs under `docs/plans/**` |
| D1b | `6fcd82696` | 1 | removes `.drill/arc-test.log` local scratch |

Notes:
- G8 is the PR6 + integration-consolidation slice; it intentionally carries
  the final review-P0 refinements that touch earlier lanes. This is disclosed
  in the Stage 2 report.
- Tests, fixtures, scripts, CI manifests and ARC-A bookings are part of the
  slice that needs them; they were not filtered by `packages/**`.
- A5-only product files are not listed here; they come from the A5 base and
  remain in the combined tree.
