# GAP-TABLE — oracle-coverage entries lacking pin / 判据 (R-ORACLE-1 MEASURE leg)

<!-- lane: R-ORACLE-1 (offline, ZERO boots/starts) · seat: qiyuan-self/qwen3.8-flash-next · measured real UTC 2026-10-30T17:26Z (date -u; ROUTER_RULES §8.5.8) -->
<!-- head measured: origin/master f7d5b3e75 (= #490 R-G4R-1a merge). Reproduce: `node dev/agent-workflow/evidence/u7r3-oracle1-20261030/measure-oracle-coverage.mjs` (static file scan; no World, no boot, no host). -->

## 0. What was measured and why

The card's pointer `scripts/host-sandbox-assets.mjs:223` is the G4-R2 review citation spelling
(`G4-PROMOTION-REVIEW-R2.md:58`, remediation row R-ORACLE-1). The real home is
`tests/world-factory/lib/host-sandbox-assets.mjs`; the dynamic-import edge cited at `:223`
(candidate `5d0c8ff58`) sits at `:228` per the merged design doc
(`dev/agent-workflow/gates/R-G4R-1a-DIGEST-SURFACE.md` §2) and at **`:231`** on today's tip —
the same single statement `const mod = await import(pathToFileURL(entryModulePath).href)`
inside `resolveHostSandboxLayout`. `complete=false` is emitted by
`tests/world-factory/lib/binding-digests.mjs:301` (`complete = unresolvedDynamicImports.length
=== 0 && missingSources.length === 0`); `literalReadsComplete` is the separate, NON-voiding
disclosure axis (`:302`).

Two measurement layers, both offline and reproducible:

1. **HEAD-tip closure census** — every suite module the plane currently exposes through the two
   oracle-emitting runners (`tests/world-factory/u5-canary-runner.mjs` + collected
   `tests/world-factory/suites/*.mjs`, plus the standalone `tests/world-factory/u7-4a-jobs-suite.mjs`)
   run through the REAL `captureOracleBinding`. Raw rows: `measure-run.json` (this dir); the
   base64 source-copy artifacts land in a scratch dir outside the tree (1 MiB-capped by design).
2. **Tracked-record census** — every `bindings.worldOracle` cell in tracked evidence (27 records,
   enumerated via `grep -rl '"worldOracle"' dev/agent-workflow/evidence`), plus the digest-drift
   recompute against §1's tip values.

## 1. Suite-unit census at tip (19 units / 13 distinct closures)

5 core-shaped suites (core, core-restart, negatives, crash-victim, u6-shadow) share the runner
module as their oracle entry, hence share one digest. `complete=false` UNITS: **3 suites
(u6-arc-d, u7r3-b49-lockseam, u7-4a-jobs)**; the G4-R2 era count was 2 (ARC-D, Jobs) —
`suites/130-u7r3-b49-lockseam.mjs` (merged via the b49 lane) carries FOUR unresolved edges the
10-29 reserved rows never enumerated. `literalReadsComplete=false` units (non-voiding): the 5
core-shaped units, u7-astore, u7r3-b49-lockseam, u7-4a-jobs.

| suite (oracle entry) | complete | literalReadsComplete | sources | tip digest |
|---|---|---|---|---|
| core / core-restart / negatives / crash-victim / u6-shadow (`u5-canary-runner.mjs`) | true | **false** | 10 | `b66c027e90d0c474…` |
| u6-fs | true | true | 3 | `4defbfa019b24a8b…` |
| u6-proc | true | true | 4 | `a79c8311c2b6f0d2…` |
| u6-jobs | true | true | 4 | `3c41381605e5a9cd…` |
| u6-arc-a | true | true | 5 | `3cb6a15fee2b8977…` |
| **u6-arc-d** | **false** | true | 6 | `f65d5598063c0ef4…` |
| u7-fs-mut | true | true | 4 | `a15222bc950c24a6…` |
| u7-f-web | true | true | 6 | `505884282f612ff9…` |
| u7-pwsh | true | true | 4 | `77f1281a6142fa34…` |
| u7-agent-control | true | true | 4 | `c7d04c7cdc2cc2ad…` |
| u7-f-ui | true | true | 4 | `e02b7dcc58806c05…` |
| u7-fagentb | true | true | 5 | `a0a6726ec1e6b208…` |
| u7-astore | true | **false** | 5 | `93e199f801401c2b…` |
| **u7r3-b49-lockseam** | **false** | **false** | 4 | `d445c18d6cc8b27c…` |
| **u7-4a-jobs** | **false** | **false** | 11 | `509a6e399a001858…` |

Tracked-record census (all `bindings.worldOracle` cells in evidence): complete=false records = 4 —
`u7-g4r3-20261028/arc-d/run-record.json` (dyn `:223`), `u7-g4r3-20261028/jobs/u7g4r3-jobs-1.u74a-run-record.json`
(dyn `:223` + lit `run-record.mjs:196`), `u7r3-pilot-c2-20261029/c2-r2/jobs/u7r3c2j2.u74a-run-record.json`
(same shape), `u7r3-b49-20261031/c2/RUN-RECORD.json` (3 dyn + 2 lit, incl. `u7astore-assembly.mjs:235`
which has since drifted to `:239`). The pre-edge phase-1 records (`u7-g4r-live-20261028` arc-d/jobs)
are `complete=true` — historical layering matches the reviewer finding F2 ("Phase-2 arc-d was
complete=true with no unresolved imports" refers to the earlier closure state before the asset
re-home entered the arc-d/jobs closure).

## 2. Asset-by-asset gap table

Columns per the card. **pin?** = is the ENTRY'S OWN BYTES pinned by tracked plane code.
**verdict-source?** = does this asset define expected answers the suite judges against (判据), vs.
being machinery/state the verdict merely traverses. **gap class** codes: `G1` unresolved dynamic
import — target OUTSIDE repo root, structurally un-followable by the closure law; `G2` unresolved
dynamic import — target INSIDE the repo with a statically-known-but-computed path (walker lacks
constant folding); `G3` unresolved literal read — runtime World/state input (disclosure axis,
non-voiding); `G4` tracked runtime input read with its own pinning cell; `G5` unfollowed absolute
path to host-kernel state (non-voiding).

| asset | role | pin? | verdict-source? | gap class · edge sites |
|---|---|---|---|---|
| Host runtime **entry module** `native/system/packages/entry/lib/index.js` (gitignored pristine runtime tree `tests/deepseek-harness-test-use`) — target of `host-sandbox-assets.mjs:231` (`:223`@candidate, `:228`@#490 tip) | host launcher-path resolution: the entry module answers `launcherPath()`/`probe()`; `resolveHostSandboxLayout` execs its verdict | **NO file-level pin.** Tree-level only: `tests/paths.mjs` baseline pin `0.2.0-rc.2 @ 639ed01539…` + per-record `hostSha`/`hostTreeSha` bindings. The native assets it LOCATES are content-pinned (`host-sandbox-assets-manifest.json`: `bin/landlock-run` + `bin/glibc/system.node`, sha256+mode); the entry module's own bytes are not. | no — launcher mechanics, defines no expected answer, but sits ON the provisioning verdict path | **G1** · dyn `host-sandbox-assets.mjs:231` → u6-arc-d, u7-4a-jobs (voiding) |
| Production **fs-state-store** `packages/tools/agent-state-family/src/fs-state-store.mjs` — target of `130-u7r3-b49-lockseam.mjs:102/384/435` (path constant at `:177`, `join(REPO_ROOT, …)`) | the PRODUCTION MODULE UNDER TEST — lockseam verdicts (lock seam, apply serialization) are judged about its behavior | **no oracle pin.** It is a tracked product file (eb3 family-boundary/dist-mirror rules cover placement, not digest); the closure's own rule would bind it (repo-internal literal) but the scanner sees only a variable argument | it is the verdict SUBJECT, not the 判据; expected answers live in the suite module | **G2** · dyn `:102`, `:384`, `:435` → u7r3-b49-lockseam (voiding ×3) |
| **Authority pointer pair** `dev/engineering/current-authority.json` + `authority-snapshots/<version>.json` — literal reads at `run-record.mjs:200` (`:196`@record) inside `readAuthorityBinding` | binds the live authority generation into every RUN record | **YES — dedicated pin:** per-record `bindings.authority` (`pointerSha256`, `snapshotDigest`), read law fail-closed via `scripts/current-authority.mjs`; by R-G4R-1a §2 kept OUT of the trusted-sources union deliberately ("each ledger row keeps one home") | yes in the contract sense (which matrix/backlog bytes are current) — but it is its OWN cell, not oracle closure content | **G4** · lit `run-record.mjs:200` → u7-4a-jobs, core-shaped (non-voiding; `literalReadsComplete=false`) |
| **World home store state** — `u7astore-assembly.mjs:239` (`:235`@b49 record) scope/ledger reads; `130-u7r3-b49-lockseam.mjs:417` raw leader-scope file | runtime World output the verdict measures (committed records, ledger lines) | no — by design: World bytes are the OBSERVED side, never bound into the oracle (binding them would bind the answer to the run) | no — observed state, not expected answers | **G3** · lit `u7astore-assembly.mjs:239`, `lockseam:417` → u7-astore, u7r3-b49-lockseam (non-voiding) |
| **Port-lease slot state** — `port-lease.mjs:163` `seq` reads | lease bookkeeping state during a run | no — World state (leases are ephemeral under the home) | no | **G3** · lit `port-lease.mjs:163` → core-shaped (non-voiding) |
| **Materialized launch profile** — `u5-canary-runner.mjs:374` reads `<profileDir>/cordis.patch.yml` | the composed profile a World actually launched (recorded into boot1Evidence) | **YES — dedicated pin:** `composedProfileDigest` F3 cell (pre-spawn hash + post-spawn re-hash; mismatch throws `composedProfileDigestMismatch`) | no — launched input; the profile bytes ARE pinned, just by their own cell | **G4** · lit `u5-canary-runner.mjs:374` → core-shaped (non-voiding) |
| **Host boot id** `/proc/sys/kernel/random/boot_id` — absolute read at `lockseam:66`, classified through `fileDir` → resolves outside repo root → `unfollowedPaths` | boot-instance discriminator for lock-age reasoning | no — host kernel state, un-pinnable by nature (it changes every boot; pinning it would make the suite boot-locked) | no | **G5** · unfollowed path → u7-astore (via assembly), u7r3-b49-lockseam (non-voiding, disclosed) |

### 2.1 Gap count by class

| class | voids `complete`? | distinct entries | edge sites | suites |
|---|---|---|---|---|
| G1 host entry-module dyn import | **yes** | 1 | 1 (`host-sandbox-assets.mjs:231`) | u6-arc-d, u7-4a-jobs |
| G2 fs-state-store dyn import (in-repo, computed path) | **yes** | 1 | 3 (`lockseam:102/384/435`) | u7r3-b49-lockseam |
| G3 World-state literal reads | no (disclosed) | 3 | 4 (`u7astore-assembly.mjs:239`, `lockseam:417`, `port-lease.mjs:163`, +b49-era `:235` line drift) | u7-astore, lockseam, core-shaped |
| G4 tracked runtime inputs with own cells | no (disclosed) | 2 | 2 (`run-record.mjs:200`, `u5-canary-runner.mjs:374`) | u7-4a-jobs, core-shaped |
| G5 host-kernel path unfollowed | no (disclosed) | 1 | 1 (`lockseam:66`) | lockseam (+u7-astore via assembly import chain) |

**Voiding total: 2 distinct assets / 4 edge sites / 3 suites.** Non-voiding disclosed: 6 entries
(each already has either a dedicated digest cell — G4 — or is World/host state that must NOT be
bound — G3/G5).

## 3. Digest drift since the bound records (measured, not assumed)

BL-22's own clause ("任何后续 commit 触该文件则两腿不可变性论证须重推") is ALREADY triggered:
commits `38a348c44` (R-MODEBITS) + `3e5e3f74a` (R-ASSET-MODE-1) touched
`host-sandbox-assets.mjs`, and `71fa5cfab` (R-ENVBLOCK-1) touched `run-record.mjs`, all AFTER
candidate `5d0c8ff58`. The lockseam leg has its own trigger: `9a6ffab05` (R-STATE-HOME-1 route
R1/V1) touched `u7astore-assembly.mjs` after that record's binding head `604f9d585d`. The closure source SET is unchanged, the bound BYTES are not — recompute at
tip vs. recorded:

| suite | recorded digest | tip digest | match |
|---|---|---|---|
| u6-arc-d | `0b365975820a3126…` | `f65d5598063c0ef4…` | **no** |
| u7-4a-jobs (10-28) | `32d2b9409244f44a…` | `509a6e399a001858…` | **no** |
| u7-4a-jobs (pilot-c2-r2, 10-29) | `c1b6ce9972854a18…` | `509a6e399a001858…` | **no** |
| u7r3-b49-lockseam (10-30 boot) | `404553f445f1ad97…` | `d445c18d6cc8b27c…` | **no** |

Historical records bind their own `teamSha` — that is law, not decay — but the R2-era mitigation
"covered by candidate..HEAD judge diff empty" is VOID for both legs today; PRECONDITIONS.md P-5
registers the re-derivation the remediation law demands.

## 4. Feeding R-G4R-1a's world-oracle TrustedSources family

`captureTrustedSourcesBinding`'s `world-oracle` entry (design doc §4: `role='world-oracle'`,
`sha256 = worldOracleDigest`, wired at `u5-canary-runner.mjs:921-923` and
`u7-4a-jobs-suite.mjs:148-152`) digests the closure cell **as disclosed**. For the three
complete=false suites the union digest therefore binds a KNOWN-INCOMPLETE closure: the entry is
honest (the cell carries `complete:false` verbatim beside it) but it is not a completeness claim.
No TrustedSources code change is needed to close that — completeness is decided by the closure
law, upstream of the entry. That boundary is exactly where this lane stops and PRECONDITIONS.md
begins.
