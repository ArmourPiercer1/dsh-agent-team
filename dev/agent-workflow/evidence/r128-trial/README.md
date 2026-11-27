# R128 — TRIAL CANDIDATE evidence (`v0.3.0-trial.1`)

**Round 128, 2026-11-27.** This directory is the measured evidence for the owner-facing trial candidate:
manifest/tag shape, the in-isolation install (local spec and tag), the governed-profile boot, the rollback,
and every gate that was re-run for it. The owner-facing document is `docs/TRIAL-GUIDE.md`; the release
status surfaces are `dev/agent-workflow/evidence/ute-a1/CANDIDATE-REPORT.md` (trial ≠ release) and
`OWNER-DECISIONS.md` (round-128 ruling).

**What this evidence is NOT.** It is not candidate acceptance, not `PRODUCT-PROVEN`, not a release record.
No grade, `V@B` or matrix row moved. A trial run proves "installable, bootable, rollback-able on the
measured host with an isolated home"; the release protection rule (frozen candidate SHA + version gate
Required and green + `version-gate-receipt.json`) is untouched.

## Environment (fixed for every run below)

| item | value |
| --- | --- |
| worktree | `.worktrees/vnext-a1-cut` (branch `vnext/a1-cut`), sole writer |
| trial `DSH_HOME` | `.artifacts/trial-home` (**inside** the workspace; wiped and re-created between phases) |
| rc.5 host | `tests/deepseek-harness-next` — `0.2.2-rc.5` (CLI via `apps/cli/lib/bin.js`) |
| rc.2 host | `tests/deepseek-harness-test-use` — `0.2.0-rc.2` (`DSH_BASELINE_VERSION`) |
| pnpm | 11.7.0, with an in-workspace store/cache (`pnpm_config_store_dir`, `pnpm_config_cache_dir`) because `HOME` is read-only here |
| port | 3180 (never 3080; never `~/.dsh`) |
| node | v24.21.0 |

## Files

| file | what it measures |
| --- | --- |
| `01-local-spec-install.log` | `pnpm dsh plugin --profile web add file:$PWD` exit 0 (phase A: local spec) |
| `02a-profile-state-local-spec.txt` | profile `package.json` (`file:` dep + `dsh.profile.bundles`), lock importer/snapshot (`engines.dsh`), profile `node_modules/@deepseek-ai` = only `dsh-web-search-exa` (+ its transport deps) |
| `02-local-dump-config.yml` / `.err` | `pnpm dsh --profile web --dump-config` after the local install: both bundle rows composed; stderr empty |
| `03-compat-truth-table.txt` | the REAL evaluators of both hosts × runtimes `0.1.7-rc.1 / 0.2.0-rc.2 / 0.2.0 / 0.2.2-rc.5 / 0.2.3-alpha.2` × shipped manifest and an exact-pin control: shipped ACCEPTs exactly the two measured hosts on both evaluators; the control accepts only rc.2 (the relaxation is load-bearing) |
| `04-pack-inventory.txt` | `npm pack --dry-run --json` at the trial version: entry count, tarball/unpacked bytes, presence of every required install-face target, `exports` targets present = 0 missing |
| `05-check-install-manifest.txt` | `check-install-manifest` on the trial manifest: 11 issues **all** pre-existing computed-specifier rejections (`lock leg: PASS`), base-equal (same 11 against the pre-change manifest), plus six negative controls (comparator peer, engine subset, engine extra, engine comparator, peer drift, no-engine) |
| `06-gates.log` | `place-dist-glue` 36 byte-identical placements; `ute-cut-closure --check` pass; `ute-p0-assets --check` pass; `docs-sync --check` findings=0 blocking=0; `test-catalog --max-uncollected 41 --max-excluded 7` findings=0 (tests=790, uncollected=38, excluded=14); `eb3-ci-required` pass; `eb3-run-manifest` pass records=765 findings=0 |
| `07-dispatch-ute-vnext-a1.log` | `dispatch-tests --leg ute-vnext-a1 --run`: suites=8 files=8, tests=268, pass=267 fail=0 skipped=1, exit 0 |
| `08-vitest-plugin-dsh-compat.log` | bound vitest leg `packages/testkit/test/plugin-dsh-compat.test.ts`: 14/14 pass |
| `09-ute-g1-argv.log` | the exact CI argv of the UTE G1 job (nine files): 89 checks pass, exit 0 |
| `10-ci-pr-gate-full.log` | **`ci-pr-gate --full --census-captures 2` PASS 10/10** (`DSH-CI-VERDICT pass … legs=10 refused=0`), census captured twice with identical identity sets; run with `CI=true` and the tree's own pnpm store (see disclosure 5) |
| `10a-ci-pr-gate-full-readonly-store-fail.log` | FIRST `--full` attempt: the `install` leg failed because the spawned `pnpm install --frozen-lockfile` inherited the read-only `HOME` store (`[ERR_SQLITE_ERROR] unable to open database file`). Kept so the environment failure is attributable |
| `10b-ci-pr-gate-full-altstore-purge-fail.log` | SECOND attempt, still red: pointing pnpm at a DIFFERENT writable store made it want to purge `node_modules` (the tree is bound to `…/dsh-agent-team/.pnpm-store`), and with no TTY pnpm aborts (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). Fixed by using that same store — no purge, install leg 0.4 s |
| `boot-local/` | phase A boot smoke (ungoverned): boot line on 3180, `/` 401, skill registration, `/team-remote` MOUNTED, SIGTERM → exit 0, process gone |
| `boot-governed/` | phase A boot with the governed profile layer + v4 blueprint: no error/refusal in the log, `catalog.list` (cookie-authenticated) returns `my-team-bp-1` (v3) and `trial-team` (v4, `migrationState: current`), SIGTERM → exit 0 |
| `11-tag-install.log` | **phase C** — profile wiped, then `pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team#v0.3.0-trial.1`: exit 0 (22.6 s), dependency written, bundle registered |
| `12-tag-install-verification.txt` | profile `package.json`, installed package identity (`0.3.0-trial.1`, `engines.dsh`, one distinct peer requirement, `dsh.bundle`/`dsh.client`), lock resolution, `--dump-config` rows |
| `boot-tag/` | boot smoke of the TAG install (ungoverned): boot line on 3180, `/` 401, skill registered, `/team-remote` MOUNTED, SIGTERM → exit 0, process gone |
| `13-rollback.txt` | `plugin remove dsh-agent-team`: dependency gone, `dsh.profile.bundles` back to the two host bundles, `node_modules/dsh-agent-team` GONE, 0 bundle rows in `--dump-config`, **and the host still boots** (401 on `/`, `/team-remote` 405, no skill registration, SIGTERM → exit 0) |

## Tag phase (phase C) — the owner's exact command, from the pushed tag

- `git rev-parse v0.3.0-trial.1^{commit}` = **`c11ac09a3c74a8e9452ca6a9adf817511c5d07e9`** (annotated tag object
  `51da2a892428de1cef823a20d8b67416fadef449`; remote `ls-remote` peel agrees).
- The lock resolves the dependency to
  `https://codeload.github.com/ArmourPiercer1/dsh-agent-team/tar.gz/c11ac09a3c74a8e9452ca6a9adf817511c5d07e9`
  — **lock-resolved commit == tag peeled commit** (`12-…` prints `match=yes`).
- Everything below `profiles/web` was wiped before the install, so the profile was created by the tag install
  itself; the rollback then returned it to `["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app"]` and the host
  booted with **no** team surface at all.

## Manifest / tag shape (the claim this evidence supports)

- `version` = `0.3.0-trial.1`.
- `engines.dsh` = `0.2.0-rc.2 || 0.2.2-rc.5`; all 18 `@deepseek-ai/dsh*` peers carry the **byte-identical**
  requirement (an explicit enumeration of the only two MEASURED hosts). No comparator, no wildcard, no
  `allow-version` exemption, no peer left on an exact pin.
- The 18 exact `0.2.0-rc.2` host pins moved from `peerDependencies` to `devDependencies`: they are the
  checkout's build/test host selection, not a compatibility claim. `pnpm-lock.yaml` resolves all 18 to
  `0.2.0-rc.2` (0 occurrences of `0.2.2-rc.5`), so the repo's own lane does not silently float.
- `@deepseek-ai/dsh-web-search-exa` stays an exact `0.2.0-rc.2` **regular** dependency (host-absent by
  design; it must be installed into the profile) — PD-37 still holds: it is the only `@deepseek-ai/*`
  regular dependency, and the profile's `node_modules/@deepseek-ai` contains nothing else but its
  transport deps.

## Disclosures (read these before quoting any number)

1. **`check-install-manifest` is RED at 11 and was RED at 11 before this round.** All 11 are
   computed-specifier rejections in committed `packages/runtime/dist/**` (they predate this round and are
   the known install-surface debt); the lock leg PASSes. `05-…` shows the base-equal measurement and the
   negative controls. Do not report this gate as green.
2. **One boot attempt briefly used the inherited `DSH_HOME=$HOME/.dsh`.** A helper script defaulted to
   `${DSH_HOME:-…}` and the tool environment exports `DSH_HOME=/home/armourpiercer/.dsh`. The host aborted
   at `prepareProfile` with `EROFS: read-only file system, open '/home/armourpiercer/.dsh/profiles/web/cordis.yml'`
   — i.e. it **read** the stable home and its first **write** was refused by the read-only mount; no file in
   `~/.dsh` changed, no process stayed up, `:3080` was never contacted (no listener on the trial port).
   The script now refuses any `DSH_HOME` under `$HOME/.dsh` **before** starting the host, and the successful
   runs above all used `.artifacts/trial-home`.
3. **Counts moved, identity set did not.** `ci-pr-gate` census: 601 files / 7447 lines across 2 captures vs
   the baseline document's 626 / 7936; both captures have IDENTICAL identity sets and the gate reports the
   set as identical to the published baseline (the counts are context, the set is the verdict).
5. **The `ci-pr-gate` install leg needed the environment, not a code change.** This sandbox has a read-only
   `HOME`, so the default pnpm store is unusable; `10a`/`10b` are the two failed attempts and their exact
   errors. The green run used `CI=true` plus `pnpm_config_store_dir=/…/dsh-agent-team/.pnpm-store` (the store
   this worktree is already bound to; `pnpm install --frozen-lockfile` = "Already up to date", 3.3 s, no
   purge). No gate flag was changed and no leg was skipped: the verdict line is `pass=10 fail=0 skip=0`.
6. **Not measured**: a full Member turn with a real model credential; MCP servers end-to-end; subagent
   end-to-end; macOS/Windows governed tier. `docs/TRIAL-GUIDE.md` §11 says the same to the owner.
