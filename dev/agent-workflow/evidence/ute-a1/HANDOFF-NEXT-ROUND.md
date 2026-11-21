# HANDOFF — resume here (written round 44, HEAD `0b997aa90`)

Worktree: `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, draft PR #822 (never auto-merge).
Read first: this file, then `MIGRATED-SUITE-STATUS.md` (last three sections), then
`ESCALATION-realmless-admission.md`, then `CAPABILITY-MATRIX-C.md` (the two RED/ESCALATED blocks).

## The single open blocker: E3 — the durable overlay has no decision-side effect

Plumbing is DONE and tested; only the provider is missing.

| What | Where | State |
| --- | --- | --- |
| the admission port accepts `overlayDecision` | `admission-port.mjs` (`installAdmissionPoint`) | done, ADM-45 (45/45) |
| the centre forwards it | `centre-install.mjs` (`installMemberCentre`) | done |
| the member install forwards it | `member-execution.mjs` (`installMemberExecution`) | done (`0b997aa90`) |
| **the product supplies one** | `root.ts` → the bindings deps → the member install | **MISSING — this is the task** |

### The four steps, no exploration needed

1. `root.ts` already builds `permissionPlane` (mutation lane + `append`/`latest`/`history`; absent ⇒
   `PERMISSION_MUTATION_NOT_CONFIGURED`, zero write). Build a synchronous reader over the SAME
   `latest()` keyed by the binding's `policyGeneration` (any mutation bumps it, so the cache cannot go
   stale by construction).
2. Close `overlayDecision` over `canonicalizeOperation` + `resolveOperationPermission` — BOTH modules
   SURVIVE the cut (`packages/runtime/operation-permission/`). Reuse the decision CORE, never the retired
   listener shape.
3. Pass it through `root.ts` → the bindings deps (`permissionOverlay` is already threaded at
   `agent-bindings.mjs:2435`) → `installMemberExecution({ overlayDecision })`.
4. Run `a3p4-pr4-production-entry-regression` (E3). It must go green WITHOUT editing its expectation.

### Then, in this order

5. `node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000`
   must read `verdict=PASS suites=15 files=15 passed=238`.
6. Bind the leg: manifest `cmd` = `["node","scripts/eb3-security-run.mjs"]`, `check` = the four argv
   tokens (`--layer ci-integration --list-file <list> --timeout 30000`), leg placed in the
   **ci-integration** layer, plus one workflow step in `.github/workflows/ci-integration.yml` with the
   identical command line. Verify with `node scripts/eb3-ci-required.mjs` (must stay `findings=0`).
   I built and measured this binding once; both gates (`CI_LAYER_LEG_UNPROVEN`,
   `CI_LAYER_LEG_ARGUMENT_MISSING`) fired and cleared, then I reverted it rather than ship a red leg.
7. G8 (`team-session-activation-glue`) failed ONCE under parallel load, passed in three later full runs
   and in isolation. Make it deterministic (no wait-blindly); do not mark it green by narration.

## Standing facts (do not re-derive)

- Migrated suite: **237/238** — the one red is E3. vitest must be run from the MAIN worktree's install
  (`node /home/armourpiercer/projects/dsh-agent-team/node_modules/.pnpm/vitest@*/node_modules/vitest/vitest.mjs`)
  because this worktree's `node_modules/vitest` link is dangling; a local symlink was created for the
  token runner and is gitignored.
- Gates that must stay green: `dispatch-tests --run --leg ute-vnext-a1` (6 suites, exit 0),
  `test-catalog --max-uncollected 41 --max-excluded 7`, `ute-cut-closure --check`,
  `ute-p0-assets --check`, `eb3-ci-required`, `docs-sync --check`, `place-dist-glue` (26 placements).
- Open escalations (owner): `CONTRACT-CHANGE-REQUEST-settlement-recheck.md`,
  `CONTRACT-CHANGE-REQUEST-process-lane.md`, `ESCALATION-realmless-admission.md`,
  `eb3-family-definitions` 541 legacy items, `ute-cut-closure distCounterpartsOf`.
- No row in `CAPABILITY-MATRIX-C.md` is PRODUCT-PROVEN. Nothing may be upgraded by narration.
