# A5M2-B-TEAM C2 — standard-fixture preparation receipt (root GO, non-Host; single owner: this lane)

Executed 2026-10-24. **No boot, no Host, no pack, no re-pack, no repo-lock write, no recursive chmod, no
deletion.** Every RC below is the tool's own RC (immediate capture; the two pipelined captures use
`${PIPESTATUS[0]}`, never a tail command's code). Stops are listed as they happened, with nothing backfilled.

## Target and seed (BEAT A)

* NEW face (created): `tests/homes/a5m2-sched-c2-dry-2026-10-23T22-56-05-203ZZ/install-c8dd3f07b`
  (name = first 9 hex of the candidate product tgz sha256, per the existing convention).
* Seed = **only** the old fixture's two small config files copied: `package.json` (900 B, sha `07b44477…`)
  and `pnpm-lock.yaml` (611,385 B, sha `7faee42f…`). No `node_modules`, no Host/runtime tree, nothing copied
  upward. `mkdir_RC=0`, `cp_pkg_RC=0`, `cp_lock_RC=0`.
* Manifest rewritten from the **699cc real packed manifest face** (read via `gzip -dc | tar -xO package/package.json`):
  12 `@deepseek-ai/*` peers @ `0.2.0-rc.2` — **including both new SDKs** `dsh-launch-environment`,
  `dsh-tool-web — plus `yaml 2.9.0`, `zod 4.4.3`, plus our
  `dsh-agent-team → file:/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/out-699cc4fb7a27941b19c1550c42d45d45520535da-20261024T043040Z/dsh-agent-team-0.1.1-alpha.2.tgz`.
  `write_RC=0`; new `package.json` sha256 `470d16102de38beb027404d730b62cd1121b80e55ab5ef97ad9e73a4350cfa71`.
  **Recorded manifest delta:** the 699cc direct face carries **no** `@deepseek-ai/cordis`, `@deepseek-ai/dsh-spill`,
  `@deepseek-ai/dsh-system-prompt` (the old fixture listed them directly). Followed the manifest, not the old number.
  **And the transitive question is now proven, not guessed:** `@deepseek-ai/cordis@4.0.4` rides as resolved
  peer-context of the installed DSH packages (visible in `.pnpm/@deepseek-ai+dsh-llm@0.2.0-rc.2_@deepseek-ai+cordis@4.0.4/…`
  and the `dsh-scope` / `dsh-session` / `dsh-spill-local` / `dsh-storage-domain` / `dsh-tool-web` paths).
* Store: **existing** project store `/srv/workspace/dsh-plugins/dsh-agent-team/.pnpm-store` (v11), never a new/copied one.
  pnpm: `tests/deepseek-harness-test-use/node_modules/.bin/pnpm` → `11.7.0` (`--version` RC=0).

## Stops that happened first (each: RC + cause, reported at the time)

1. Manifest write attempt → **RC=1** `PermissionError [Errno 13]`: the seed copies inherited the standard
   surface's frozen `-r--r--r--` mode (`tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs:9`, `:1222`). Stopped; ruled on.
   Scoped single-path `chmod u+w` on exactly the two seed files: `chmod1_RC=0`, `chmod2_RC=0`; both verified
   `regular file`, **`nlink=1`** (copies own their inodes). **No recursive chmod was ever executed in this arc**
   (root's question answered `none`), and after the retraction no chmod at all was run.
2. First `(b1)` with the relative store flag → **RC=254** `[ENOENT] mkdir '/.pnpm-store'`, and pnpm printed
   `Scope: all 10 workspace projects` (repo-root `pnpm-workspace.yaml` absorbs the fixture). Created nothing;
   store unchanged. Ruled on: absolute store + `--ignore-workspace`.
3. `(b1)` with abs store + `--ignore-workspace` → **RC=1** `[ERR_PNPM_NO_OFFLINE_META] Failed to resolve
   @deepseek-ai/dsh-agent@0.2.0-rc.2 in package mirror
   /home/user/.cache/pnpm/v11/metadata/registry.npmjs.org/@deepseek-ai/dsh-agent.jsonl`
   (that cache face is outside the workspace; my sandbox cannot write it: `touch` → `Read-only file system`).
   This is the verbatim pre-established trigger, so the single metadata-only exception was applied.

## BEAT B — the runs (each with its own RC)

| # | command (run inside the NEW dir only) | RC |
|---|---|---|
| b1-a | `pnpm install --lockfile-only --offline --ignore-scripts --store-dir ../../../../.pnpm-store` | **254** |
| b1-b | `pnpm install --lockfile-only --offline --ignore-scripts --ignore-workspace --store-dir <abs store>` | **1** (`ERR_PNPM_NO_OFFLINE_META`) |
| b1-exc | `pnpm install --lockfile-only --ignore-scripts --ignore-workspace --store-dir <abs store>` (exception: only `--offline` dropped, one run) | **0** (`Done in 5.3s`) |
| b2 | `pnpm install --frozen-lockfile --ignore-scripts --offline --ignore-workspace --store-dir <abs store>` | **0** (`Packages: +532`, `reused 532, downloaded 0`, `Done in 3.3s`) |

Supply-chain-policy leg: `Verifying lockfile against supply-chain policies (602 entries)` → `✓ passes` in both
the exception run and b2, with its ~50 `registry.npmjs.org` metadata requests (`Request took ~27.8–28.5s` each)
observed **during the `--offline` b1-b attempt too**. Project-standard behaviour driven by root `pnpm-workspace.yaml`
(`allowBuilds`, `minimumReleaseAgeExclude`); no suppression flag exists in the project and none was invented.
Network fact recorded as a fact: those registry requests happened. `Scope:` line was **not printed** once
`--ignore-workspace` was in force — **not claimed** as "1 project"; the operational proof is the delta placement:
the lock delta landed **only** in the NEW dir and `git status --porcelain -uno` in the repo = **0 lines**.

## b3 — resolved face, final lock, bytes, modes

* Final lock (NEW dir only): `pnpm-lock.yaml` sha256
  **`dad670ae749c2da364b42d19aa3eacc0ec0f01b60d1c1009bff5ef37fb35217a`**
* Direct deps as resolved (version → realpath under `node_modules/.pnpm/`), all real:
  `@deepseek-ai/dsh 0.2.0-rc.2 → +dsh@0.2.0-rc.2_7a58f4496…`; `dsh-agent …_29054241a…`;
  **`dsh-launch-environment 0.2.0-rc.2 → …_@deepseek-ai+cordis@4.0.4`**; `dsh-llm …_@deepseek-ai+cordis@4.0.4`;
  `dsh-mcp-client …_d097ce8e5…`; `dsh-schedule …_820f27980…`; `dsh-scope …_cordis@4.0.4_…dsh-invariants_0d6b1918…`;
  `dsh-session …_cordis@4.0.4_…dsh-scope@0._c9dee8deb…`; `dsh-spill-local …_cordis@4.0.4_…dsh-spil_a4430d18…`;
  `dsh-storage-domain …_cordis@4.0.4_…dsh-i_a9d0a33f…`; `dsh-tool-fs-search …_d9a775c1a…`;
  **`dsh-tool-web 0.2.0-rc.2 → …_cordis@4.0.4_…dsh-llm@0.2_b874e8301…`**;
  `yaml 2.9.0 → yaml@2.9.0`; `zod 4.4.3 → zod@4.4.3`;
  `dsh-agent-team 0.1.1-alpha.2 → .pnpm/dsh-agent-team@file+..+..+..+..+.worktrees+pack-int+out-699cc4fb7a27941b19c1550c42d45d4_3cfcbe1f7…`
  (i.e. the candidate tgz itself, not any source tree).
* Mounted product check inside the installed package: `A5_B_TEAM_ADAPTER_REVISION = 2` count **1** (`grep_RC=0`);
  `live/governed-families/` holds **28** files (the new g1/g2/g3/g5/subagent mirrors are present).
* Bytes. Store: `3,584,189,186 → 3,587,556,091` (**+3,366,905**, all attributable to the earlier `file:` import of
  our tgz: `.pnpm-store/v11/file+…+out-699cc4fb7a27941b19c1550c42d45d45520535da-20261_94f75b98…`; the exception run
  and b2 grew it **zero**). NEW dir nominal `du -sb`: `612,289 → 450,547,174`. Actual disk delta from `df`:
  arc start `8,949,215,232` → now **`8,867,430,400`** = **81,784,832 B (~78 MiB)**, the difference vs the nominal
  figure being pnpm hardlinks into the existing store (verified: one installed file has `nlink=2`).
  Headroom `≥ 6 GiB` holds (**8.867 GB**). Cap accounting flagged, not decided here: **actual** new bytes ~78 MiB
  (under the 256 MiB total-new cap), **nominal** dir `du` 450 MB (over it) — center books which counts.
* As-left modes (**no chmod from here**): `node_modules` and `node_modules/.pnpm` = `drwxr-xr-x`; installed files
  are the writable pnpm standard state (that is the expected state, not papered over). No re-freeze executed.

## b4 — old face and repo untouched

* `install-eda06b4a7/pnpm-lock.yaml`: sha256 **`7faee42f88306edb43888cbd3d822a45596d6a05d0641e32457cbcd553568cfe`**
  unchanged; mode/nlink/mtime `-r--r--r-- nlink=1 2026-10-23T22:56:10.716273941Z` (pre/post identical).
* `install-eda06b4a7/package.json`: `-r--r--r-- nlink=1 2026-10-23T22:56:05.209274036Z`, sha `07b44477…` unchanged.
* Repo: `git status --porcelain -uno` = 0 lines; repo root lock/manifest untouched; no store/Host/old-face mode changes.

## Status

A prepared, pinned, offline-installable fixture face for the 699cc candidate, **not** a booted or verified run:
no Host, no boot, no fixture world writes beyond this single new subpath, tier of the B-TEAM family stays
**接线未测**. The candidate pack remains a SOURCE candidate (CI RED-AT-HEAD; the search `MAXRESULTS` deployment
cap obligation stays open, external search stays untested/NOT-READY).

## ADDENDUM (root scope-check) — ordered RC list, network facts, per-path untouched proof, complete lock delta

**(0) Every real RC in this arc, in order** (each the tool's own code; nothing backfilled):

| order | step | RC |
|---|---|---|
| 1 | `stat`/`sha256sum` pre-reads of the old face | 0 |
| 2 | `mkdir -p …/install-c8dd3f07b` | **0** |
| 3 | `cp …/install-eda06b4a7/package.json` | **0** |
| 4 | `cp …/install-eda06b4a7/pnpm-lock.yaml` | **0** |
| 5 | python manifest rewrite (1st attempt, before the ruling) | **1** `PermissionError [Errno 13]` → stopped |
| 6 | probe `python3 -c "open(…,'w')"` (same cause, confirmation only) | **1** |
| 7 | `chmod u+w …/install-c8dd3f07b/package.json` | **0** |
| 8 | `chmod u+w …/install-c8dd3f07b/pnpm-lock.yaml` | **0** |
| 9 | python manifest rewrite (after ruling) | **0** |
| 10 | `pnpm --version` (pre-b1) | **0** |
| 11 | b1 #1 relative `--store-dir ../../../../.pnpm-store` | **254** `ENOENT mkdir '/.pnpm-store'` → stopped |
| 12 | b1 #2 abs store + `--ignore-workspace`, `--offline` | **1** `ERR_PNPM_NO_OFFLINE_META` → stopped |
| 13 | b1 exception (only `--offline` dropped, once) | **0** |
| 14 | b2 `--frozen-lockfile --ignore-scripts --offline --ignore-workspace` | **0** |
| 15 | b3/b4 read-backs (sha256/readlink/stat/grep/find/diff) | 0 each (the `diff -u` exit **1** = "differences found", expected) |

**(1) Network facts, verbatim as printed.** The ~50 slow registry lines came from **step 12** (the RC=1
`--offline` attempt), e.g. `[WARN] Request took 27844ms: https://registry.npmjs.org/@deepseek-ai%2Fdsh-system-prompt`
— package names `dsh-session-persistence … dsh-permission-presets`, 48–50 of them, each ~27.8–28.5 s — plus
`? Verifying lockfile against supply-chain policies (602 entries)...` and
`✓ Lockfile passes supply-chain policies (602 entries in 2.5s)`.
Step 13 (online exception) printed the policy leg plus `✓ Lockfile passes supply-chain policies (602 entries in 2.6s)`,
`resolved 602`, `Downloaded: 0`, one deprecation warning, `Done in 5.3s`, and an update banner `11.7.0 → 12.15.0`.
Step 14 printed `Lockfile is up to date, resolution step is skipped`, `Packages: +532`,
`reused 532, downloaded 0`, `✓ … policies (602 entries in 2.8s)`, `Done in 3.3s`.
Limitation stated, not backfilled: pnpm prints no per-line timestamps, so the request window is given as the
session interval of step 12 (04:36–04:37 UTC) rather than as per-request stamps.

**(2) The two failed b1 attempts changed nothing outside the new dir — per-path evidence** (threshold
`2026-10-24 04:34:00 UTC`, i.e. before the first b1; read-only `find -maxdepth 1 -newermt`, raw line counts):

| path | newer lines | dir mtime (unchanged, pre-threshold) |
|---|---|---|
| repo tracked set (`git status --porcelain -uno`) | **0** | covers root `pnpm-lock.yaml` + every tracked importer manifest |
| `node_modules` | **0** | `2026-10-19T09:41:53.508Z` |
| `packages/runtime/node_modules` | **0** | `2026-10-15T19:23:41.792Z` |
| `packages/client/node_modules` | **0** | `2026-10-03T15:50:30.412Z` |
| `tests/deepseek-harness-test-use/node_modules` | **0** | `2026-10-17T20:36:19.461Z` |

Faces I verified as untouched, explicitly: the repo tracked set; those four `node_modules` faces; the old fixture
(`pnpm-lock.yaml` sha `7faee42f…`, `-r--r--r-- nlink=1`, mtime `2026-10-23T22:56:10.716Z`; `package.json`
`07b44477…`, mtime `2026-10-23T22:56:05.209Z`); every other `out-*`/`snap-*`/`consumer-*`/`install-*`/`logs-*` pack
surface (never opened for write); the product/int tree. Not verified by me (stated as such): other lanes' activity
elsewhere on the shared volume — the volume `df` moved from other writers, which is why the attribution above is
per-path and not df-based.

**(3) Complete lock delta of MY dir's lock vs the seed** — full unified diff kept in
`fixture-prep-lock-diff-699cc.txt` (35,525 B, 21 hunks, **+42 / −41** lines). Enumerated content:
* added importer deps: `@deepseek-ai/dsh-launch-environment: 0.2.0-rc.2`, `@deepseek-ai/dsh-tool-web: 0.2.0-rc.2`;
* removed importer deps: `@deepseek-ai/cordis` (with `version: 4.0.4(@deepseek-ai/cordis-plugin-include@1.0.9)(@deepseek-ai/cordis-plugin-loader@1.0.5)…`),
  `@deepseek-ai/dsh-spill`, `@deepseek-ai/dsh-system-prompt` — i.e. the three old-only direct entries;
* added snapshot keys with peer contexts:
  `@deepseek-ai/dsh-launch-environment: 0.2.0-rc.2(@deepseek-ai/cordis@4.0.4)` and
  `@deepseek-ai/dsh-tool-web: 0.2.0-rc.2(@deepseek-ai/cordis@4.0.4)(@deepseek-ai/dsh-llm@0.2.0-rc.2(…`
  ⇒ **`@deepseek-ai/cordis@4.0.4` rides transitively**, proven from the lock/realpath, not guessed-deleted;
* the `file:` entry repinned: specifier/version `…out-874f3ae0d-20261023T213601Z/…` → `…out-699cc4fb7a27941b19c1550c42d45d45520535da-20261024T043040Z/…`,
  entry hash suffix `02df8aa8b9d94c2dcc66626cd4d50f17` → `b86b7a2707a60e624baa81a1b8928c88`,
  `resolution.integrity` `sha512-sB9gxVwRGVGYC4nwml/aSBsB1XLbfSx8AIeEAxeJpELZzROLAmXywA+WNKGX7xuoB4KMLDWD1RIzKiqlq8U/9Q==`
  → `sha512-Te3Wu7CmzPMYPA0a9V287uYV37WJ/S8wgFBTk2UWsk8xLOAiuPLbkNjtAxekmnCYSLGpct557unOIQlBByL3wg==`;
* the remaining hunks are peer-context string rewrites of snapshots that reference our package, caused by that
  peer-set change — no other package version moved, and `resolution` entries for all peers are byte-identical.

## ADDENDUM 2 — registry-call facts (root: the count is not a new blocker)

From the log lines I hold, nothing added:
* **Registry**: `https://registry.npmjs.org` only. **Call type**: package **metadata** requests issued by pnpm
  11.7.0's supply-chain-policy verification leg, printed as
  `[WARN] Request took <27,8xx–28,5xx>ms: https://registry.npmjs.org/@deepseek-ai%2F<package>` — 48–50 distinct
  `@deepseek-ai/dsh-*` package names (`dsh-session-persistence … dsh-permission-presets`), all inside step 12.
* **No package bodies fetched**: the exception run printed `reused 1, downloaded 0`; b2 printed
  `Packages: +532 … reused 532, downloaded 0`. Everything materialised came from the local store via hardlinks.
* **No outbound secrets**: the held lines carry only host + package name + duration. The repo `.npmrc` face is
  `auto-install-peers=false` and nothing else (no auth/registry-token keys measured), and no token, cookie or
  integrity value appears in any captured output line.
* **No writes elsewhere**: per-path table in ADDENDUM §(2) (repo tracked 0; root / both package / test-use
  `node_modules` 0 newer files); the only store growth is our own `file:` import of the candidate tgz
  (+3,366,905 B); the pnpm metadata cache under `$HOME` is not writable from my sandbox (`touch` →
  `Read-only file system`), so nothing there came from my side.

---

## CORRECTION (root, folded in per root instruction - no doc round)

The deployment-cap-obligation-open wording above predates 699cc: as of product 699cc4fb7a the lane cap IS supplied explicitly (Config.searchMaxResults with exported default 8 at the lane face). Corrected standing: supplied-but-not-auto-inherited - deployments must mirror teamToolPlane.g2Mount.webSearchFixed.searchMaxResults per deployment; the lane does not read other plugins configs and does not silently inherit. External search acceptance remains separate.
