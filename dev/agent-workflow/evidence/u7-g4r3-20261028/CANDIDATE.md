# G4-R phase 3 — frozen candidate (recorded BEFORE any Host boot)

Lane: `u7-g4r3-20261028` (live candidate C2 for ARC-A / ARC-B / ARC-D / Jobs Bridge / crash
survivor per `docs/plans/memo/unified-baseline-alpha5-20261025/gates/G4-PROMOTION-REVIEW-R1.md`
§"What closes it" + `.artifacts/briefs/G4R3-live-candidate-lane.md`). Single writer.
Branch `task/u7-g4r3-live-20261028`, worktree
`/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7-g4r3`.
**This file and its commit are setup-only: ZERO Host boots have been made by this record's
tree so far, and none will be made before this commit exists.**
CORE PATCH BUDGET = 0; no `packages/**` change; no judge/assembly/suite logic change in this
lane; the stable instance :3080 and its DSH_HOME are only probed READ-ONLY (GET `/`, expects
401) before and after runs, never booted on, never written; `~/.dsh` untouched.

## Candidate definition

- Base: `origin/master` = `a23f11a3b0e4a6606364b2b9286404d52e6bb817` (merge of PR #429,
  "host-sandbox asset provisioning", the provisioner this lane first exercises live).
- **The frozen candidate SHA is the commit that contains this exact `CANDIDATE.md` file.**
  This file is committed BEFORE any Host boot; every live RUN record written afterwards must
  bind `teamSha == git rev-parse HEAD` at launch, i.e. exactly this candidate commit (the
  runner reads HEAD live — self-reference is resolved by `git rev-parse HEAD` after this
  commit, recorded in the lane README; same resolution as PR #427 / `u7-g4r-live-20261028`).
- `git status --porcelain --untracked-files=no` at record time: **empty** (output below is
  the literal captured output — zero bytes). Generated evidence, the gitignored
  `tests/deepseek-harness-test-use` runtime clone, `tests/homes/` worlds, `.artifacts/` and
  `.tmp-pnpm-store` are untracked/ignored, not executable tracked input.

```
$ git rev-parse HEAD           # before this commit (base master)
a23f11a3b0e4a6606364b2b9286404d52e6bb817
$ git status --porcelain --untracked-files=no
(empty)
```

## Host runtime tree (this worktree provisions its own — no silent sharing)

- `tests/deepseek-harness-test-use` in this worktree: `git clone --local --no-hardlinks`
  then `git checkout --detach 639ed015397290b3745d163aafe02ffee4aa3f84` (= 0.2.0-rc.2,
  `tests/paths.mjs` pin). Clone source: `/srv/workspace/dsh-plugins/dsh-agent-team/tests/
  deepseek-harness-test-use` — the main checkout's runtime tree at the SAME pinned SHA with
  `git status --porcelain` empty (verified before cloning; never written).
  ENVIRONMENT DEVIATION, disclosed: the baseline path named by TEST_METHODS §1
  (`/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`) is NOT a host source tree in
  this environment (contains only `snapshots/session`, `vendor/CLAUDE.md`); the same
  substitute was used by the PR #427 lane (`.worktrees/u7-g4r2/tests/deepseek-harness-test-use`
  origin records the main-checkout runtime tree).
- Post-clone / post-install / post-build verification: `git -C tests/deepseek-harness-test-use
  status --porcelain` EMPTY at all three points; `rev-parse HEAD` =
  `639ed015397290b3745d163aafe02ffee4aa3f84` throughout.
- Install/build (no network, workspace-local store, deterministic client pin):
  `pnpm install --frozen-lockfile --store-dir ../../.tmp-pnpm-store` then
  `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build` (per
  TEST_METHODS §2) — exit 0, "recorded 347 client artifact(s) with 2 public value(s)".

## Native sandbox backend (TEST_METHODS §9, first live exercise of PR #429 provisioning)

- Fresh unprovisioned clone probed `unusable` (the documented §9 gap: gitignored
  `native/system` platform `bin/` assets never enter git).
- `node tests/world-factory/provision-host-sandbox.mjs` from this worktree first failed closed
  (`SOURCE_IS_DESTINATION`, exit 2): with a worktree-local runtime tree the tool's default
  source collapses onto the destination, and trusted roots from a task worktree are
  [worktree root, shared baseline] — the baseline not being a runtime tree here (above).
  Resolved WITHIN the rules: a byte-identical HARDLINK copy (`cp -al`, same filesystem, no
  byte drift possible) of the main-checkout runtime tree was placed at gitignored
  `.artifacts/tmp/g4r3-sbx-source` and named via `DSH_TEAM_SANDBOX_ASSET_SOURCE`; the
  provisioner then performed its own manifest digest verification (source bytes, staged file,
  published file) before publishing. Full outputs kept at `.artifacts/tmp/provision-run1.txt`.
- Provision result: `provisioned (38552 bytes)`; **probe: `unusable -> partial`**;
  backend `partial` (usable: true); launcher **present, sha256
  `a752bc72f111fcc573c3e61fb90fa544541dac0ca498d2e279e1630d7c659b31`** (== tracked manifest
  pin); `bin/glibc/system.node` sha256 `54a9c25c05186c17520f6b7a5ced5f005752c08044c3eb76524cd517287600bc`
  (== tracked manifest pin).
- Standalone §9 probe re-run after provisioning: `probe()` => **`partial`**;
  `launcherPath()` resolves inside this worktree's OWN runtime tree (no shared host tree).
- `--check` idempotency: second + third runs wrote nothing (inode+mtime+mode identical
  before/after), exit 0, runtime porcelain still empty.
- **Probe verdict for the lane: `partial`.** Not `unusable` ⇒ legs may boot (per §9 verdict
  law, a native leg may be judged ENV_BLOCK only on `unusable` + typed refusal — neither is
  available here, so `u74a:native-ctl-unaffected` must run under Landlock).

## Byte pins

| Input | SHA-256 |
|---|---|
| package.json | `a8aa65fa07775a0dbef479829de42624989627b2833ac9e06070bbfe3ebae5ed` |
| pnpm-lock.yaml | `432cfe5f1729b5cd32b656d8732cfd0850e9e1b3a2502be4b263c4ca87dba2ab` |

## Current authority (verbatim `node scripts/current-authority.mjs`)

```json
{"ok":true,"status":"POINTER","pointer_file":"dev/engineering/current-authority.json","snapshot_file":"dev/engineering/authority-snapshots/as20261026r1.json","snapshot_version":"as20261026r1","content_digest":"sha256:93692d7aeb3b097c3b3467e0a9207f1da5f05c2c1cb324c74d25168b1516a4d4","current_phase_statement":"ALPHA.5 TOOL-IO-GOVERNANCE PHASE - UNIFIED BASELINE IMPLEMENTATION AND PER-TOOL ACCEPTANCE (release blocked until whole-tool approval)","six":{"phase_id":"alpha5-tool-io-governance","active_plan":"docs/plans/active/unified-baseline-alpha5/current-implementation-plan.md","backlog":"docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md","matrix":"docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md","baseline":"9b2ee57bc5afd30e89855e09d1769d2e5ec83912","baseline_collected":"2026-10-22T07:20:56Z"},"two_current_findings":[]}
```

## Toolchain / stable-instance probe

- Node `v24.21.0`; pnpm `11.7.0`. Runtime store: worktree-local gitignored `.tmp-pnpm-store`
  (hardlink-seeded from the completed u7-g4r2 store, content-addressed and immutable).
- `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/` = **401** (read-only probe,
  before any boot; recorded `.artifacts/tmp/stable-3080-preprobe.txt`). The stable instance
  was not booted, written, or killed by this setup.

## Live plan (boots happen AFTER this freeze, in the follow-up boot lane; budget 6, ceiling 8)

| # | leg | runner | boots |
|---|-----|--------|-------|
| 1 | ARC-A | `tests/world-factory/u5-canary-runner.mjs --suite u6-arc-a` | 1 |
| 2 | ARC-B | `dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs` (documented seam; never write into `u7-tbash-l4-20261027/`) | 1 |
| 3 | ARC-D | `tests/world-factory/u5-canary-runner.mjs --suite u6-arc-d` | 1 |
| 4 | Jobs Bridge | `tests/world-factory/u7-4a-jobs-suite.mjs` | 1 |
| 5 | crash survivor | `tests/world-factory/u5-parallel-supervisor.mjs --mode crash-reclaim --survivor-suite core --max-host-starts 2` | 2 |

Every boot is declared in its own per-leg ledger under
`dev/agent-workflow/evidence/u7-g4r3-20261028/<leg>/` BEFORE the spawn; every record passes
`--run-record`. Per-leg directories with zero-entry ledgers are created by this commit;
no ledger ENTRY exists yet because no boot exists yet.

## No gate verdict claimed

This lane commits the candidate freeze only. **No gate verdict (G4/G4-R promotion or
otherwise) is claimed by this commit or its PR**; verdicts belong to the live legs that
follow and to the reviewing main agent.
