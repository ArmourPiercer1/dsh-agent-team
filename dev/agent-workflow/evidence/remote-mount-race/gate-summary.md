# Five gates — remote-mount-race (worktree `.worktrees/remote-mount-race`, branch `task/remote-mount-race`, base `5adc8b9`)

All gates run in this session's sandbox, which is SPAWN-RESTRICTED: any node
child-process spawn is EPERM (errno -4048) — `pnpm -r run`, `execFileSync`
from node, and vitest (vite's windowsSafeRealPathSync execFile) are all
denied. The repo's documented spawn-restricted equivalents were used and are
recorded here (environment class, NOT product drift — the P1-T5 D-05
precedent documents this exact failure class):

1. TYPECHECK — `node node_modules/typescript/lib/tsc.js -p packages/<pkg>/tsconfig.json` for all 9 packages (direct tsc, no pnpm -r spawn):
   contracts/domain/storage/remote/tools/client/legacy/testkit/runtime = 9/9 exit 0.
2. BUILD — same, `tsconfig.build.json`: 9/9 exit 0. Install-surface artifacts rebuilt:
   11 changed files under `packages/runtime/dist` (host.js/.d.ts/.map, types.d.ts/.map, team-domain.js/.d.ts/.map — types.js content-unchanged: the new fields are type-level), composition-shim byte-identical (client-bundle.js 845690 B = committed baseline; zero client changes).
3. BUILD:COMPOSITION — `place-dist-glue.mjs` (1 placement, byte-identical) + `build-client-composition.mjs` (85 modules, 11 css, client-bundle.js 845690 B) both exit 0. Artifact freshness gate (check-artifacts-committed.mjs) cannot spawn git in this sandbox (execFileSync EPERM) — pwsh-side EQUIVALENT (git via PowerShell, which the sandbox permits): after `git add -A`, `git status --porcelain -- packages/runtime/dist packages/client/composition-shim` = 11 entries, ALL staged-clean (`M ` worktree==index), 0 untracked, 0 worktree-drift → gate PASS semantics (A/B/C all clean vs the index).
4. TEST — the official runner (`pnpm test` = vitest) cannot start in this sandbox (vite execFile EPERM). The repo's documented spawn-restricted equivalent `test:node` (`scripts/run-tests.mjs`, plain-node runner over the identical .test.ts sources, D-05 precedent):
   - FULL SUITE: 2448 passed, 4 failed, 2452 total.
   - The 4 failures are PRE-EXISTING test:node shim-surface gaps (the audited shim carries only toBe/toEqual/toBeGreaterThan/toThrow — no toBeNull/toHaveLength/toBeUndefined), in files this task does NOT touch: client-plugin-mount.test.ts (1/26, toBeNull) + pbf-default-artifact-urls.test.ts (3/9, toHaveLength/toBeUndefined). PROVEN pre-existing: a temporary worktree at base `5adc8b9` (this task's exact base) fails the identical 4 assertions, identical TypeErrors, identical lines (baseline run additionally showed a fresh-worktree tmp ENOTEMPTY flake in p5t4-intersection that does not occur in the task worktree — environmental, unrelated). Under the official vitest runner these matchers exist (the R132 PBA session ran the full suite green under real vitest); the 4 are not regressions of this change.
   - New tests all green: rmr-create-or-open.test.ts (5), rmr-remote-mount-race.test.ts (6), rmr-create-or-open-boot.test.ts (3); existing semantics worlds unchanged: t12b2-resume-separation (5, W4 strict-resume fail-closed intact), t12m4-remote-mount (9), p8s5a-production-assembly (7, T1.7 single-effect invariant), p4t6-session-event-scan (10, pin 606).
5. LINT — `node node_modules/eslint/bin/eslint.js .` (eslint 9.39.5, in-process, no spawn): exit 0.
6. SMOKE — `node scripts/composition-smoke.mjs`: exit 0 (both plugins fail loud on the degenerate context — and the smoke's own negative boot now prints the NEW `[dsh-agent-team] bootstrap FAILED: ...` console line: the root-cause-C observability fix demonstrated inside the gate).

## D5-equivalent vertical (live, real DSH host, port 3180)

- FRESH world (`.dsh-test-rmr-fresh-20260905-181607`, no domain): boot → MOUNTED, no bootstrap failure; domain INITIALIZED (all 8 stores stamped by the first boot); `POST /team-remote/catalog.list` → **200** + shipped blueprint my-team-bp-1 (fresh-probe.txt, fresh-boot.log).
- SCRATCH user world (`.dsh-diag-405-2026-09-05T16-35-38`, STAMPED domain = the user's returning-home state): boot on the fixed install → MOUNTED, no bootstrap failure (the stamped domain ADOPTED; the pre-fix bundle threw the swallowed TEAM_DOMAIN_EXISTS here); the user's exact failing request `POST /team-remote/catalog.list` → **200** (was 405 pre-fix; after-probe-scratch.txt, after-boot-scratch.log).
- Browser gentry G0–G4 (Playwright): BLOCKED in this session's sandbox (browser process spawn = the same EPERM class). The gentry's wire-level core (catalog.list 200 + team-remote RPC dispatch over the frozen envelope) is proven live above; the mount/dispatch logic is regression-covered by rmr-remote-mount-race.test.ts (late dispatcher serves the frozen `team.getProjection` envelope, origin provenance `team-remote`); the client bundle is byte-identical to the PBA R132 world that passed the full browser gentry in three fresh reviewer worlds — zero client-side surface changed by this task.
- Teardown: both servers stopped; 3180 probe = connection refused (000); no process of this task holds 3180.
