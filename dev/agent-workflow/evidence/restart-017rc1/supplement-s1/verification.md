# Supplement S1 — verification (2026-09-26)

Scope: guide `docs/plans/active/pr31_supplemental_fix_guide.md` S1 (activation core).
Baseline: PR #31 head `449e1fc` (= branch HEAD at round start; base master @ `7c23610`).

## Suites (worktree `.worktrees/team-restart-017rc1`)

| Check | Result |
| --- | --- |
| `team-session-activation.test.ts` (A1–A15 + complement) | 16/16 PASS |
| `team-session-activation-glue.test.ts` (G1–G10 + 3 static pins) | 16/16 PASS |
| `t12a-m2-persona.test.ts` | 8/8 PASS |
| `multi-mcp-wiring.test.ts` | 47/47 PASS |
| runtime FULL suite, clean `.tmp-fault` | 6 failed files / 191 passed (197); **8 failed tests / 2206 passed (2214)** |
| `pnpm --filter @dsh-agent-team/runtime typecheck` | 0 errors |
| `pnpm --filter @dsh-agent-team/runtime build` | exit 0 (dist mirror rebuilt + committed) |

## Full-suite triage — ZERO new failures

The 8 failed tests + 3 file-level failures are the EXACT pre-existing debt set
(pre-supplement round baseline, measured on the same tree lineage):

- `p6t3-mediation.test.ts` — 5 test failures (debt, unchanged)
- `p6t3-restart.test.ts` — 2 test failures (debt, unchanged)
- `d3-member-identity-context.test.ts` D3-4 — 1 test failure (debt, unchanged)
- `p8s3b-result-effects.test.ts` — file-level (debt; `sessionPersistence.exists`
  seam absent in the test world; `createRootAgent`'s `durableSessionExists`
  call site verified identical to 449e1fc via `git show`)
- `t12a-b2-child-identity.test.ts` — file-level (debt; capability template
  unresolved in consumption view — unrelated to S1 surface)
- `t12a-glue-handoff-ports.test.ts` — file-level (debt; blueprint frontmatter
  parse — unrelated to S1 surface)

Four baseline debt files now PASS (bridge restructure side effect, recorded
here as debt reduction): `t1-capability-schema`, `t2-blueprint-hash`,
`p7t6-teammates-adapter`, `p6t6-actions`.

### The "6 new file-level failures" red herring (triage record)

An earlier full-suite run (log retained in this session's workspace, not
committed) showed 13 failed files / 9 failed tests. Triage:

1. Six of the new file-level failures (`c1-production-wiring`,
   `d1-member-base-tools`, `multi-mcp-wiring`, `t12a-team-tools-registration`,
   `t4a-capability-wiring`, `tcm-d4-root-context`) were
   `TeamDomainError: team_domain already exists (schema_meta holds 9 stamp
   row(s))` at `createP6T1World` — caused by LEFTOVER `.tmp-fault/<basename>`
   scratch dirs (fixed per-basename paths under
   `packages/testkit/test/.tmp-fault/`, destroyed in test `finally`) from a
   crashed/killed prior run. ALL SIX PASS on a clean tree. Not code regressions.
   (`rmrcoo-boot` leftover is by-design residue: destroyed at the START of its
   test, not the end.)
2. One new test failure: `t12a-m2-persona` M2-6 + (masked by the contamination
   in the first run, surfaced second) `multi-mcp-wiring` W6/W7b — genuine
   bridge-restructure behavior change: `handles` now publishes ONLY
   post-announce (faithful 0.1.7 ordering; G1 invariant: a vetoed or
   setup-failed create publishes no handle). The pre-setup partial-state
   reads moved to the exact-generation identity object (`agentIdentities`,
   minted BEFORE setup) — the faithful observation surface. Updated
   M2-6 + W6 + W7b accordingly (assertions unchanged in intent).
3. The 4 debt files that turned green are recorded above.

## Red-line compliance (guide §8)

No session.lock deletion / no sleep-backoff / no while-retry / no
substring-only writer authority / no silent adopt / `ownedDepth` is NOT the
PASS authority (the exact claim is) / no physical DSH_HOME scan / no upstream
modification / no v6 bump. `WRITER_HANDOFF_TIMEOUT_MS` remains a bounded
event-driven wait budget (deadline consumed per stage), never a sleep.
