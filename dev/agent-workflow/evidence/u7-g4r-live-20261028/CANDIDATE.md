# G4-R phase 2 — frozen candidate (recorded BEFORE any Host boot)

Lane: G4-R-phase2 (live candidate C2 for ARC-B / ARC-D / Jobs Bridge per
`docs/plans/memo/unified-baseline-alpha5-20261025/gates/G4-PROMOTION-REVIEW-R1.md` §"What closes it").
Single writer. Branch `task/u7-g4r-live-20261028`, worktree
`/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7-g4r2`.
CORE PATCH BUDGET = 0; no `packages/**` change; no judge/assembly/suite logic change
in this lane; the stable instance :3080 and its DSH_HOME are only probed READ-ONLY
(GET `/`, expects 401) before and after each run, never booted on, never written.

## Candidate definition

- Base: `origin/master` = `6457b9675ea2f1e940923f23ae344ad2587da798` (merge of PR #426,
  "persist World profile and per-suite oracle bindings"). It contains the binding-digest
  runners required by G4-R item 4.
- **The frozen candidate SHA is the commit that contains this exact `CANDIDATE.md`
  file.** This file is committed BEFORE any Host boots; every live RUN record written
  afterwards must bind `teamSha == git rev-parse HEAD` at launch, i.e. exactly this
  candidate commit (the runner reads HEAD live — self-reference is resolved by
  `git rev-parse HEAD` after this commit, recorded in the lane README).
- `git status --porcelain --untracked-files=no` at record time: **empty** (output
  below is the literal captured output — zero bytes). Generated evidence, the
  gitignored `tests/deepseek-harness-test-use` runtime clone, `tests/homes/` worlds
  and `.tmp-pnpm-store` are untracked/ignored, not executable tracked input.

```
$ git rev-parse HEAD           # before this commit (base master)
6457b9675ea2f1e940923f23ae344ad2587da798
$ git status --porcelain --untracked-files=no
(empty)
```

## Host

- `tests/deepseek-harness-test-use` in this worktree: `git clone --local --no-hardlinks`
  from the root checkout, then `git checkout --detach
  639ed015397290b3745d163aafe02ffee4aa3f84` (= 0.2.0-rc.2, `tests/paths.mjs` pin).
  `git status --porcelain` empty before build and re-verified empty after build.
- Install/build (no lifecycle scripts, workspace-local store, deterministic client pin):
  `pnpm install --ignore-scripts --frozen-lockfile --store-dir ../../.tmp-pnpm-store`
  then `DSH_CLIENT_COMMIT_HASH=639ed01539 pnpm run build` (per TEST_METHODS §2).

## Byte pins

| Input | SHA-256 |
|---|---|
| package.json | `a8aa65fa07775a0dbef479829de42624989627b2833ac9e06070bbfe3ebae5ed` |
| pnpm-lock.yaml | `432cfe5f1729b5cd32b656d8732cfd0850e9e1b3a2502be4b263c4ca87dba2ab` |

## Current authority (verbatim `node scripts/current-authority.mjs`)

```json
{"ok":true,"status":"POINTER","pointer_file":"dev/engineering/current-authority.json","snapshot_file":"dev/engineering/authority-snapshots/as20261026r1.json","snapshot_version":"as20261026r1","content_digest":"sha256:93692d7aeb3b097c3b3467e0a9207f1da5f05c2c1cb324c74d25168b1516a4d4","current_phase_statement":"ALPHA.5 TOOL-IO-GOVERNANCE PHASE - UNIFIED BASELINE IMPLEMENTATION AND PER-TOOL ACCEPTANCE (release blocked until whole-tool approval)","six":{"phase_id":"alpha5-tool-io-governance","active_plan":"docs/plans/active/unified-baseline-alpha5/current-implementation-plan.md","backlog":"docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md","matrix":"docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md","baseline":"9b2ee57bc5afd30e89855e09d1769d2e5ec83912","baseline_collected":"2026-10-22T07:20:56Z"},"two_current_findings":[]}
```

## Toolchain / environment

- Node `v24.21.0`; pnpm `11.7.0`. Team install: `pnpm install --frozen-lockfile --store-dir .tmp-pnpm-store`.
- `ss -ltn` before any boot (captured `ss-ltn-baseline.txt`): only system ports
  (22/53/139/445) and the stable instance `127.0.0.1:3080` listen; every test band
  (3181–3199, 3491–3500, 13000+) is empty.
- `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/` = **401** (read-only probe, before any boot).
- Host sandbox fact (main-agent verified; re-probed in `jobs/bwrap-probe.log`): this
  machine cannot create unprivileged user namespaces, so a native workspace-write bash
  leg fails closed with SANDBOX_UNAVAILABLE (ENV_BLOCK/FAIL by law — "ENV_BLOCK is never PASS").

## Live plan and budget (parent-ruling budget: 3 host starts; +1 only for an ENV failure)

| # | suite | command (from the named lane README / runner usage; no invented flags) | host boots |
|---|---|---|---|
| 1 | ARC-B governed bash | `node dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs` (README "Run:" line) | ≤1 |
| 2 | ARC-D | `node tests/world-factory/u5-canary-runner.mjs --suite u6-arc-d --line g4rd --evidence dev/agent-workflow/evidence/u7-g4r-live-20261028/arc-d --budget-ledger dev/agent-workflow/evidence/u7-g4r-live-20261028/arc-d/host-starts.jsonl --max-host-starts 1` | ≤1 |
| 3 | Jobs Bridge (main) | `node tests/world-factory/u7-4a-jobs-suite.mjs --run-id u7g4r-jobs-1 --line g4rj --evidence dev/agent-workflow/evidence/u7-g4r-live-20261028/jobs --budget-ledger dev/agent-workflow/evidence/u7-g4r-live-20261028/jobs/host-starts.jsonl --max-host-starts 1` | ≤1 |

One run at a time; `ss -ltn` before each; every start disclosed in the lane README;
after each run: World home cleaned + `ps -eo pid,cmd | grep -E 'apps/cli|canary-runner'`
shows no stray process. No commit of anything else until all boots finish.
