# SETUP-NOTES — lane u7-g4r3-20261028 (setup-only: candidate freeze, ZERO host boots)

Governing brief: `.artifacts/briefs/G4R3-live-candidate-lane.md` (Hard preconditions + setup parts only).
Docs read first: `docs/ROUTER_RULES.md` §0, `docs/TEST_METHODS.md` §1/§2/§7/§9.

## Step 1 — lane creation
- `git fetch origin -q`; `git rev-parse --short origin/master` = **a23f11a3b** (as expected).
- `git worktree add -b task/u7-g4r3-live-20261028 .worktrees/u7-g4r3 origin/master` OK.
- Self-check in worktree: pwd = `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7-g4r3`,
  `git rev-parse HEAD` = `a23f11a3b0e4a6606364b2b9286404d52e6bb817`, `git status --short` = empty.

## Step 2 — runtime tree provisioning (in progress)
- Pin read from `tests/paths.mjs`: TEST_USE_BASELINE_SHA =
  `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2), CLIENT_COMMIT_HASH = `639ed01539`.
- DEVIATION (environment fact): the documented read-only baseline
  `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` is NOT a host source tree in this
  environment (contains only `snapshots/session`, `vendor/CLAUDE.md`). Precedent = PR #427 lane
  (`.worktrees/u7-g4r2/tests/deepseek-harness-test-use` origin = main checkout runtime tree):
  clone source used = `/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use`
  (HEAD == pinned SHA, porcelain EMPTY, verified before clone; never written).
- `git clone --local --no-hardlinks` OK (exit 0, `.tmp-setup-clone.log`);
  `checkout --detach 639ed015...` OK; porcelain = 0 lines.
- pnpm store: worktree-local `.tmp-pnpm-store/` (gitignored, .gitignore:87) hardlink-seeded from
  the completed u7-g4r2 store (same filesystem; `cp -al`, 1.3 s, content-addressed => immutable).
- install: `pnpm install --frozen-lockfile --store-dir ../../.tmp-pnpm-store` (from runtime tree;
  matches PR #427 record) -> `.tmp-setup-install.log`.
- Build: `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build` -> exit 0,
  "build: recorded 347 client artifact(s) with 2 public value(s)" (.tmp-setup-build.log).
- Post-build: runtime porcelain EMPTY, HEAD == 639ed015397290b3745d163aafe02ffee4aa3f84.

## Step 3 — sandbox provisioning + probe
- Fresh `node tests/world-factory/provision-host-sandbox.mjs` (from worktree): FAIL-CLOSED
  SOURCE_IS_DESTINATION exit 2 — because this worktree has its OWN runtime tree, the tool's default
  source (= main Team checkout via upward findTestRepoRoot) collapses onto the destination, and the
  trusted roots from a task worktree are [worktree root, shared baseline]; the documented shared
  baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` is NOT a runtime tree in this
  environment (snapshots/session + vendor/CLAUDE.md only). GAP recorded for reviewers (first live
  exercise of PR #429 path, as the brief anticipated).
- Compliant resolution (no rule bent): byte-identical HARDLINK copy (`cp -al`, same filesystem) of
  the main-checkout runtime tree (HEAD == pinned SHA, porcelain EMPTY, verified first) into the
  worktree's gitignored `.artifacts/tmp/g4r3-sbx-source`, used as DSH_TEAM_SANDBOX_ASSET_SOURCE.
  Hardlinks => zero byte drift possible; provisioner still does its own three-stage digest
  verification (source bytes / staged / published) against the tracked manifest before publishing.
- Result: `provisioned (38552 bytes)`, bin/landlock-run copied a752bc72f111... (== manifest pin),
  bin/glibc/system.node present 54a9c25c... (== manifest pin; materialized by pnpm install from the
  workspace-linked platform package, digest-verified by the provisioner), porcelain EMPTY, exit 0.
- TEST_METHODS §9 standalone probe: import(entry/lib/index.js).probe() => **"partial"**;
  launcherPath resolves INSIDE the worktree's own runtime tree. Verdict requirement (partial|full): MET.
  (Full output: .artifacts/tmp/provision-run1.txt, probe-standalone.txt)

## Step 4 — idempotency
- `--check` runs (exit 0): probe before=partial after=partial, action=present, wrote nothing;
  inode+mtime+mode of both asset files identical before/after (.artifacts/tmp/bin-stat-{before,after}.txt);
  runtime porcelain still 0 lines.

## Step 5 — :3080 pre-probe
- `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/` = **401** (read-only; never
  booted, never written). Noted: PR #427 template dir in merged tree is
  `dev/agent-workflow/evidence/u7-g4r-live-20261028/` (not u7-g4r2-live-...).

## Steps 5-8 results
- CANDIDATE.md + per-leg skeleton committed as the candidate freeze:
  candidate SHA = 5d0c8ff5830271b7e2ab3e7c855bb85fb2090bf3 (message:
  "docs(evidence): G4-R phase 3 candidate freeze (pre-boot)"; 6 files, explicit paths only).
- Gates (post-commit, vs origin/master): eb3-evidence-guard pass (added=6 findings=0);
  git diff --check CLEAN; docs-probe blocking=0 non_blocking=0 advisories=0.
- Host boots performed by this lane so far: ZERO. SETUP LANE COMPLETE.

## Raw build log disposition (Finish)
The raw build stdout (`setup-build.log`, 417505 bytes) is NOT committed: 656 lines of tsdown output
carry trailing whitespace and the repo receipt chain requires a whitespace-clean `git diff --check`
(phase-2 precedent: world logs committed, raw build logs not). The file stays in the lane worktree
untracked as `.tmp-setup-build.log.untracked` with integrity anchor sha256=`b6b49c961cdc0ab45811a75cd46e624a972e0cb6ea71baa43f8401109518a5f4`; nothing was edited.
