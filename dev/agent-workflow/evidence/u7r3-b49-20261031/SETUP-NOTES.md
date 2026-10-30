# SETUP-NOTES — lane u7r3-b49-20261031 (setup-only: ZERO host boots in this commit)

Docs read first this session: `AGENTS.md`, `docs/ROUTER_RULES.md` §0 + §8.5 (incl. §8.5.6 machine
enforcement, §8.5.7 evidence-binding: after a RUN record lands — forward-merge only, NEVER rebase),
`docs/TEST_METHODS.md` (§1/§2/§3/§5/§7/§9), `dev/agent-workflow/gates/BOOT-BUDGET-20261029B.md`
(row "#449 受影响生产路径 (≤2) 0/2" = this lane's pool), PR #449 body (the scoped production
paths: the four `nowMs()` sites in `fs-state-store.mjs`; stale-break path timestamp-free),
PRs #460/#461 bodies (O_EXCL consume-before-commit; generation-checked break), the C1 suites
`u7-agentstate-fs-store-c1.test.ts` / `u7-agentstate-fs-store-audit.test.ts` (u7as:* lineage),
`tests/world-factory/README.md` + `lib/u7astore-assembly.mjs` + `suites/120-u7-astore.mjs`
(world shape + lane patterns), GATE-LEDGER R-413-1/#458 rows, `ledgers/u7-tool-acceptance.json`
(five agent-state rows; their L3 NOT_VERIFIED arms are live AUTHORITY refusals — not what this
boot drives; statuses stay unchanged, disclosed).

## Lane
- `git fetch origin`; branch `task/u7r3-b49-20261031` @ `ee3bd279e7e441bb89083ea0dda78467d589ff17`
  (origin/master head at fetch time; satisfies "ee3bd279e or newer"). Sole writer, worktree
  `.worktrees/u7r3-b49`.

## Runtime provisioning (no boots)
- The lane worktree carries NO gitignored runtime clone. `u5-canary-runner.mjs` documents the
  resolution law (its own comment at the `findTestRepoRoot` call): the pristine host tree lives at
  the nearest team-repo root that HAS one — the MAIN CHECKOUT's
  `tests/deepseek-harness-test-use`, used READ-ONLY (base assert + spawn only).
  Verified at registration: `HEAD == 639ed015397290b3745d163aafe02ffee4aa3f84`, `status
  --porcelain` EMPTY (0 lines), native sandbox assets `--check` exit 0 (`partial`, usable=true,
  launcher digest `a752bc72f111…` == pin). No install/build was needed (the tree is the
  already-built pristine runtime); the main checkout's tree is never written by this lane
  (porcelain re-checked after boot, PASS-criteria item).
- The Team checkout itself needs no install for this lane: the runner is plain Node ESM; the
  production row + family store load from the committed `packages/runtime/dist` mirror and
  `packages/tools/agent-state-family/src` (pre-registered sha), module resolution for any peer
  rides the parent-directory chain to the main checkout's node_modules (the exact pattern every
  prior worktree C2 lane used).
- Worlds live under THIS worktree's `tests/homes/` (inside the session workspace, TEST_METHODS §1/§7).

## Offline receipts at this head (zero boots)
- `node --test tests/world-factory/registries.test.mjs` = **12/12 PASS**. Disclosed repair: the
  pin at registries.test.mjs was already RED on origin/master `ee3bd279e` before this lane
  (u6-jobs 100→130 and u6-arc-a 90→110 drifted at merged `69d514a62` without a pin sync; verified
  by removing this lane's suite and re-running: same single failure). The pin is restated to the
  merged modules plus this lane's `130-u7r3-b49-lockseam.mjs` (enumeration law: "a lane joining
  extends the derived list"). No other lane's files touched.
- `node --test tests/world-factory/world-factory.test.mjs` = **45/45 PASS**.
- **Zero-boot dry run** of every runner-side leg over a scratch realm (same store module, same
  head): apply/marker-contents/ledgers ✓; STATE_APPLY_REPLAY at same + different scope ✓;
  GOAL_STALE_REVISION + marker refund + re-drive commits ✓; **break-after-REAL-process-death**:
  plant by a child that exits (pid proven ESRCH) → production breaker revalidate + verify-after →
  commit, elapsed **1032 ms** (>= the real observation window), zero residue ✓; live-holder
  refusal `AGENT_STATE_STORE_LOCK_TIMEOUT` at lockTimeoutMs=1500 → **1526 ms**, live lock
  untouched ✓. (A dry-script bug first produced a MALFORMED plant (missing `boot` string) → the
  store refused to break it and timed out — the unprovable-records law working; the lane child
  plants a COMPLETE record, re-verified green.)
- Zero-boot loader smoke with an exhausted budget ledger: all 9 cases **REFUSED** (budget law),
  `worlds=none`, no spawn — the suite loads, dispatches and refuses honestly.
- :3080 read-only probe = **401** before boot (and after, recorded in c2/pre-boot-probes.txt);
  `~/.dsh` never touched; test-port bands empty at registration; stable instance never signalled.

## Pre-registration
`PRE-REGISTRATION.json` (same commit) registers cell / pool draw (#449 ≤2 starts; boot#1 = 1
start; boot#2 reserved for an ENV_BLOCK-class NOT_REACHED ONLY) / source-sha rule / pass criteria
(incl. "ENV_BLOCK never PASS" and the anti-vacuity timestamp conjunctions) / max starts BEFORE any
spawn, per USER-RULING-20261029B item 1 and the #458 F-1 correction (registration commit pushed
and CONFIRMED on origin before the runner starts).
