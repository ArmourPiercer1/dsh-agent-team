# Evidence — ALPHA.3 PR3: Governance Mutation Integration (GMS permission mutation path)

Branch `task/alpha3-pr3-permission-mutation`, base `8525b9519ea1d690066666c4ab7bcd2cc63432de` (= `origin/master` at start, verified by `git rev-parse origin/master`).
Worktree `.worktrees/pr3-gms-permission-mutation`; node_modules copied read-only from `.worktrees/pr2-effective-assembler` (root + packages/{client,domain,runtime}); NO pnpm install was run. Offline only (vitest/node; no host, no network, no chrome). Frozen lease paths (`.worktrees/int-alpha3-stage2`, `.worktrees/.scratch-logs/s2o-runner/`, stage2-live evidence) were NEVER touched.

## Raw logs (chronological)

| File | Command | Result |
| --- | --- | --- |
| `baseline-runtime-suite.log` | `npx vitest run` (packages/runtime) @ base | rc=1 — 8 failed / 3079 passed (6 files). PRE-EXISTING at the base commit (live-seam dependent: `sessionPersistence.exists`, p6t3 mediation/restart, t12a collect failures). Baseline for the no-regression bar. |
| `red-raw-module-absent.log` | `npx vitest run test/a3p3-permission-mutation-authority.test.ts test/a3p3-governance-lane-hygiene.test.ts` BEFORE any production code | rc=1 — 20 failed (2 files), raw `Cannot find module '../governance/permission-mutation.js'` = honest RED. |
| `green-first-run.log` | same two specs after implementation | rc=0 — 28 passed / 28. |
| `typecheck-runtime.log` | `npx tsc -p tsconfig.json` (packages/runtime) | rc=0. |
| `mutation-probe-1-envelope-skip.log` | mutant: `if (false && actor === 'leader' && plan.expansions.length > 0)` in `governance/service.ts` (envelope check bypassed) | rc=1 — 8 tests die (every envelope-refusal leg incl. exec exactness and Human-recovery). Mutant KILLED. |
| `mutation-probe-2-cas-bypass.log` | mutant: `if (false && mutation.expectedGeneration !== undefined && ...)` (CAS bypassed) | rc=1 — the CAS test dies. Mutant KILLED. Both mutants reverted; `grep "if (false"` afterwards returned zero hits; specs re-run green afterwards. |
| `full-runtime-suite-green.log` | `npx vitest run` (packages/runtime) final | rc=1 — 8 failed / 3107 passed. Failure set byte-IDENTICAL to baseline (`diff` of sorted FAIL lines = empty → "FAILURE-SET-IDENTICAL"). Delta vs baseline: +28 tests, all new, all pass. |
| `p4t6-scanner-pin-green.log` | `npx vitest run test/p4t6-session-event-scan.test.ts` (packages/testkit) | rc=0 — 10 passed. Scanner count on this tree = 932 (authoritative run, +3 scannable files: kernel + 2 specs); quarantine hit set unchanged at 15. |
| `build.log` | `pnpm build` (root) | rc=0. |
| `build-composition-gate.log` | `pnpm build:composition` (root) | first run rc=1 (uncommitted-dist drift listing = the gate doing its job); after staging the drifted dist paths: rc=0, OK-line `[check-artifacts-committed] OK: 1392 files; committed install-surface artifacts match the fresh build (incl. 1 glue placement(s))`. |
| `build-composition-gate-post-commit.log` | `pnpm build:composition` AFTER the commit | rc=0, same OK-line; work tree clean afterwards. |

Staged-diff secret scan (`git diff --cached | grep -icE 'api[_-]?key|secret|passwd|password|ghp_|AKIA|-----BEGIN'`): 0 matches.

## What the PR is (one paragraph)

`mutatePermission` is added ONTO the existing `GovernanceMutationService`
(coordinator D1 — no second authority class; legacy methods byte-unchanged,
surface pinned to exactly the 3 legacy methods + the additive 4th). The path:
authenticate authority (leader / operator via the same derived `MutationAuthority`
vocabulary) → validate the unified `PermissionMutation` (grant_instance /
update_permission / revoke_permission as ONE shape, design §3.4) and the §6
envelope (`{operationClass, matcher, maximumEffect}`, design §4 — the ONE
Alpha.3 canonical permission-change envelope; the legacy blueprint
`MutationEnvelope {allow,deny}` op-token CAPABILITY concept at
`packages/domain/blueprint/src/types.ts:270` + `admission/envelope.ts:100-131`
intersection is NOT touched, not read, not renamed — zero boundary
transformations were needed) → serialize on the SAME shared per-team chain with
the `expectedGeneration` CAS → commit ONE new FULL `PermissionOverlaySnapshot`
THROUGH the PR1 persistence-only port → provenance (actor/mutationId/
timestamp/reason; `actor` never interpreted: Human ≠ priority is structural,
authority is by generation). Exec matchers are EXACT canonical fingerprint
only (design §5). Leader expansions (deny→ask/deny→allow/ask→allow, absence
counted as deny, fail-closed) need a covering envelope rule with the
maximum-effect ceiling; tightenings (allow→ask/allow→deny/ask→deny) need none —
both directions pinned. Zero production wiring: the no-consumers walk leg
asserts it, and the lane stays dormant (`NOT_CONFIGURED`) until a later PR
injects `permissionLane` deps.

## Files

Production (all in `packages/runtime/governance/`): `permission-mutation.ts` (new kernel),
`service.ts` / `types.ts` / `index.ts` (additive). Tests: `packages/runtime/test/a3p3-permission-mutation-authority.test.ts` (20), `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` (8, incl. init-cycle canary, zero-consumer walk, persistence-only consumer pin, legacy-surface pin). Pin edit: `packages/testkit/test/p4t6-session-event-scan.test.ts` (929→932). Rebuilt dist shipped in the same commit (governance dist files + new `governance/permission-mutation.*` and newly-emitted `permission-governance/port.*` artifacts).
