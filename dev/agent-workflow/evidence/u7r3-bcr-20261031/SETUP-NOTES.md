# SETUP-NOTES — lane u7r3-bcr-20261031 (setup-only: ZERO host boots in this commit)

Docs read first this session: `AGENTS.md`, `docs/ROUTER_RULES.md` §0 + §8.5 (incl. §8.5.6 machine
enforcement, §8.5.7 evidence-binding: forward-merge only, never rebase after a RUN record lands),
`docs/TEST_METHODS.md` (§1/§2/§5/§7/§9), `dev/agent-workflow/gates/BOOT-BUDGET-20261029B.md`,
`dev/agent-workflow/evidence/u7-g4r3-20261028/` (crash README + RCA + records),
`review-routing-20261028/R448-fl.md` (the #448 handshake review), `GATE-LEDGER.md` rows R-G3-1 /
R-REM-1 / B-G4R-6 / R2 promotion, `REVIEW-REMEDIATION-20261028.md` row R-CRASH-1.

## Lane
- `git fetch origin`; branch `task/u7r3-bcr-20261031` @ `0be20e0f56cf6c9571c68ece19a805d991f25a71`
  (origin/master head at fetch time; satisfies the "0be20e0f5 or newer" seat brief).
- Sole writer, worktree `.worktrees/u7r3-bcr`.

## Runtime provisioning (no boots; precedent = u7-g4r3 SETUP-NOTES + PR #427 lane)
- Source runtime tree verified first: main-checkout `tests/deepseek-harness-test-use`
  HEAD == `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain EMPTY (never written).
- `git clone --local --no-hardlinks` into the worktree; `checkout --detach` pin; porcelain 0.
  (Disclosed env fact, same as g4r3: the documented shared baseline path is not a runtime tree
  here; source = main-checkout runtime tree, read-only.)
- `pnpm install --frozen-lockfile --ignore-scripts --store-dir ../../.tmp-pnpm-store` (root store,
  same fs; Done in 10.3s) -> exit 0.
- `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build` -> exit 0,
  "build: recorded 347 client artifact(s) with 2 public value(s)". Raw logs stay gitignored
  (`.artifacts/tmp/bcr-{install,build}.log`); porcelain of runtime tree EMPTY after build.
- Root workspace `pnpm install --frozen-lockfile --ignore-scripts` (lane team-root deps;
  the g4r3 attempt-1 ENV failure class).
- Native sandbox assets: `provision-host-sandbox.mjs` with
  `DSH_TEAM_SANDBOX_ASSET_SOURCE=.artifacts/tmp/bcr-sbx-source` (gitignored `cp -al` hardlink copy
  of the verified main runtime tree's `native/`; g4r3-compliant resolution of the worktree
  SOURCE_IS_DESTINATION collapse). Result exit 0: `landlock-run copied a752bc72f111…(==pin) 0o755`,
  `system.node present 54a9c25c0518…(==pin) 0o755`, porcelain empty.
- Pre-boot probe: `--check` exit 0, backend `partial` usable=true (launcherPath resolves inside
  this worktree's runtime tree). Offline C1 suite `node --test tests/world-factory/world-factory.test.mjs`
  = 45/45 PASS at this head (the #448 handshake law incl. knob-never-authorizes cases), ZERO boots.
- :3080 read-only probe = 401 before boot (and after, recorded in crash/pre-boot-probes.txt);
  `~/.dsh` never touched; test-port bands empty at registration.

## Pre-registration
`PRE-REGISTRATION.json` (same commit as this note) registers cell / pool draw / source-sha rule /
pass criteria / max boots BEFORE any spawn, per USER-RULING-20261029B item 1 and the #458 F-1
correction (registration commit pushed and confirmed on origin BEFORE the supervisor starts).
