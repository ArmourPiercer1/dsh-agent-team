# u7-sbx — host sandbox assets: provisioning + pre-flight + verdict fidelity (2026-10-28)

Branch `task/u7-sbx-provision-20261028` · base `origin/master` @ `6457b9675ea2f1e940923f23ae344ad2587da798` ·
lane: test-infrastructure (no product source, no host source touched). **Host boots this lane: 0. Network: none.**

## 1. The defect, measured

The pinned host runtime (`tests/deepseek-harness-test-use`, `0.2.0-rc.2` @ `639ed01539`) resolves its
Linux sandbox launcher through its **own** code: `native/system/packages/entry/lib/index.js` →
`launcherPath()` = the platform package's `bin/landlock-run`, and `probe()` runs that binary with
`--probe`, answering `full` / `partial` / `unusable`.

Those binaries are **gitignored**: `native/system/.gitignore` line 4 is `packages/*/bin/` (and line 5
`packages/*/lib/`), proven on a real clone by `git check-ignore -v` (§5). So the fresh-worktree
procedure documented in `docs/TEST_METHODS.md` §1 — `git clone --local --no-hardlinks` +
`checkout --detach` — **can never carry the native sandbox assets**. On this host `bwrap` cannot run
(no unprivileged user namespaces), so Landlock is the only backend, and a worktree without the
launcher answers `unusable`. The host then fails closed, and the C2 run records a product FAIL:

- observed host refusal (verbatim, from `dev/agent-workflow/evidence/u7-g4i-20261028/CANDIDATE.md:31`):
  `sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host`
- the same leg passed on 2026-10-26 on a provisioned tree, recorded as
  `landlock-run: partial enforcement (older Landlock ABI)`
  (`dev/agent-workflow/evidence/u7-4a-jobs-producer-20261026/logs/u5u74a-20261026T11-57-55Z/u74a-main-4.u74a-evidence.json`)

| probe of the pinned runtime tree | answer |
| --- | --- |
| main Team checkout (installed+built) | `partial` |
| fresh task worktree, e.g. `.worktrees/u7-g4r2` (built, assets never delivered) | **`unusable`** |

So a supply/environment gap was being written into a gate record as a product defect. The fix has
three parts: **provision** the pinned bytes locally, **measure** the backend before the first host
start, and **judge** the native-confinement legs from that measurement instead of from the symptom.

## 2. What changed

| file | change |
| --- | --- |
| `tests/world-factory/lib/host-sandbox-assets.mjs` | NEW. Resolver (via the host's own `launcherPath()`), pinned-manifest verification, local copy-only provisioning, `probeHostSandboxBackend()`, `preflightHostSandbox()`, `sandboxUnavailableSignal()`, `nativeConfinementEnvBlock()`. No network module, no child process except the host's own `--probe`. |
| `tests/world-factory/lib/host-sandbox-assets-manifest.json` | NEW (tracked). Pin = `DSH_BASELINE_VERSION@TEST_USE_BASELINE_SHA`, platform `linux-x64`, libc `glibc`, both digests + sizes + mode, provenance, verify + rollback commands. |
| `tests/world-factory/provision-host-sandbox.mjs` | NEW. Operator CLI (`--check`, `--manifest`); exit 0 usable · 1 still unusable (environment) · 2 fail-closed (supply chain). |
| `tests/world-factory/lib/world-factory.mjs` | Pre-flight **before the first Host start**, once per factory: `preflightHostSandbox()` + `bindRunRecord()`; fatal pre-flight errors surface as `HostBaseError` (the owned-home guard still runs first). |
| `tests/world-factory/lib/run-record.mjs` | `bindSandboxPreflight()` writes `bindings.sandboxPreflight` / `nativeConfinementBackend` / `nativeConfinementDisclosure`; `formatSummary` appends ` nativeBackend=unusable` (or `=unknown`) — visible in the one-line summary. Verdict severities untouched. |
| `tests/world-factory/lib/u74a-jobs-assembly.mjs` | `judgeU74a(d, hostAlive, { sandboxPreflight })`: `u74a:native-ctl-unaffected` → ENV_BLOCK **only** on probe-`unusable` ∧ typed refusal; otherwise unchanged. |
| `tests/world-factory/lib/u6-arc-d-assembly.mjs` | Same conjunction for `arcd:ci03-native-parity`, gated behind "the native lane could not run at all" — an effect file that exists with the wrong bytes is still FAIL. |
| `tests/world-factory/suites/050-u6-arc-d.mjs` | Scans tool results for the typed refusal, passes `nativeLaneSignal` + `sandboxPreflight` to the judge, records both in the digest. |
| `u5-canary-runner.mjs`, `u7-4a-jobs-suite.mjs`, `u7-0-census-runner.mjs`, `u5-parallel-supervisor.mjs` | One `factory.bindRunRecord(record)` each (plus the judge arg in the u74a runner) so every live RUN record carries the backend verdict. |
| `docs/TEST_METHODS.md` | New dated §9 (the gitignored gap, the provisioning command, pinned digests + provenance + rollback, the verdict law) + a §1 cross-reference. |
| `tests/world-factory/host-sandbox-assets.test.mjs` | NEW. 17 C1 legs (T1–T17). |

Zero changes under `packages/**` and `scripts/**`. Zero changes to the runtime checkout, to any other
worktree, or to `:3080` / `~/.dsh`.

## 3. Reproduce

```bash
cd .worktrees/u7-sbx && pnpm install --frozen-lockfile --store-dir .tmp-pnpm-store
node --test tests/world-factory/host-sandbox-assets.test.mjs          # 17 pass
node --test tests/world-factory/world-factory.test.mjs                # 43 pass
node tests/world-factory/provision-host-sandbox.mjs --check           # backend verdict, no write
node dev/agent-workflow/evidence/u7-sbx-20261028/mutation-proof.mjs    # 4 mutations, all killed
node dev/agent-workflow/evidence/u7-sbx-20261028/real-clone-proof.mjs <runtime-tree>
```

## 4. RED → GREEN → mutations

- **RED A** (`red-A-module-absent.log`): the C1 file written first, against no implementation —
  `ERR_MODULE_NOT_FOUND … lib/host-sandbox-assets.mjs`.
- **RED B** (`red-B-judges-missing.log`): provisioning + pre-flight implemented, judge behaviour
  still missing — `tests 17 / pass 15 / fail 2`, and the two failures are exactly the legs that name
  the missing behaviour: T15 and T16, both `actual: 'FAIL', expected: 'ENV_BLOCK'`.
- **GREEN** (`green-all-17.log`): `tests 17 / pass 17 / fail 0`. Whole `tests/world-factory` sweep
  after wiring: 95 pass / 0 fail (`binding-digests` 6, `host-sandbox-assets` 17, `registries` 12,
  `u6-arc-d` 8, `u7-tbash` 8, `u7-tbash-offline-drive` 1, `world-factory` 43).
- **Mutations** (`mutation-proof.log`, runner kept as `mutation-proof.mjs`):

| mutation | legs it killed | after revert |
| --- | --- | --- |
| a — skip the hash verification (source/staged/published) | T4, T13 | 17/0 |
| b — missing binary treated as success instead of provisioning | T3, T4, T7, T8, T9, T11, T12, T13 | 17/0 |
| c — u74a native leg FAIL even when the probe says unusable | T15 | 17/0 |
| d — ARC-D native-parity leg FAIL even when the probe says unusable | T16 | 17/0 |

Each mutation was applied to the implementation only (never to the test), and every run restored the
file from a byte-copy backup; the suite re-ran clean after every revert, and the tree was checked for
mutation residue (`if (false)`, `preflight: null`) before commit.

## 5. Real-world proof on a real clone (no fixture)

`real-clone-proof.log` / `real-clone-proof.mjs`: a runtime checkout created by the documented
procedure (`git clone --local --no-hardlinks`, `checkout --detach 639ed01539`, 18.6 s), with only the
built entry lib + the pnpm workspace symlink added (what `pnpm install --ignore-scripts` + build
produce), then driven through **the same `TestWorldFactory.preflightHostSandbox()` a C2 runner uses**:

- `git check-ignore -v` attributes both assets to `native/system/.gitignore:4 packages/*/bin/`;
- before: `bin/` exists containing only `glibc/`, launcher absent, probe `unusable`;
- `before-provision=unusable -> after-provision=partial`, 55912 bytes, digests equal to the manifest,
  source = `MAIN/tests/deepseek-harness-test-use` at `639ed01539` (`headMatchesPinnedBaseline: true`);
- the launcher then answers `landlock: partially enforced (older ABI)` — the same wording the 2026-10-26
  PASS record carries;
- `git status --porcelain` of the runtime checkout: **empty before and after**, HEAD unmoved;
- a second pre-flight rewrites nothing;
- the RUN record gained `bindings.nativeConfinementBackend`, `bindings.sandboxPreflight`, and the
  disclosure line.

Main checkout and the other lanes' worktrees were used read-only: the main runtime tree is still
`639ed01539` with empty porcelain and unchanged digests, `.worktrees/u7-g4r2` still answers `unusable`
(never written to).

## 6. Gate receipts (final tree)

| gate | result |
| --- | --- |
| `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store` | `DSH-CI-VERDICT pass pass=7 fail=0 skip=1 skipped=census legs=8 refused=0 refusedlegs=none` — run before (`ci-pr-gate.log`, 57.4 s) and after the commit (`ci-pr-gate-postcommit.log`) |
| `node scripts/eb3-run-manifest.mjs --new-since origin/master` | `EB3-RUN-MANIFEST pass records=99 strict=0 incomplete=11 findings=0` (the 11 disclosed unfinalised records are pre-existing, not this lane's) |
| `node scripts/eb3-evidence-guard.mjs --new-since origin/master` | `EB3-EVIDENCE-GUARD pass added=14 bound=1048576 exempted=0 findings=0` — every file this lane adds grades clean (no raw capture, none over the bound) |
| `git diff --check origin/master...HEAD` | clean (`gates-postcommit.log`) |
| `pnpm typecheck` | exit 0 (`gate-typecheck.log`) |
| `node --test tests/world-factory/*.test.mjs` | 7 files, **95 tests / 95 pass / 0 fail** (`tests-sweep.log`) |
| p4t6 scan booking | `pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` → 20/20 pass, **zero new bookings** (`p4t6.log`): the frozen scanner scans `packages/**` only, and every file this lane adds lives under `tests/world-factory/` or `dev/agent-workflow/evidence/` (both outside its roots) — measured, not assumed. |


## 7. Deliberately not done / judgement calls

- **No live C2 run.** 0 Host boots: this lane's contract is the offline supply + verdict law; the
  next Jobs Bridge run gets the pre-flight for free. The u74a/ARC-D legs were exercised through their
  real judges with saturated digests, not through a booted host.
- **Destination mismatch is fail-closed without deleting.** A launcher already present but hashing
  against nothing pinned raises `DESTINATION_DIGEST_MISMATCH` and leaves the bytes for a human —
  deleting a binary we did not write is not ours to do. (A source-side mismatch *is* cleaned up.)
- **Source HEAD is provenance, not authority.** The digests gate the copy; `headMatchesPinnedBaseline`
  is recorded so an un-upgraded main checkout is visible without breaking a pinned lane.
- **Auto-provision on `unusable`** (off: `DSH_TEAM_SANDBOX_ASSET_PROVISION=0`); source override:
  `DSH_TEAM_SANDBOX_ASSET_SOURCE`. Copy only — no `pnpm pack`/`fetch`/`tar` path exists in the module,
  and T10 greps the module's own code for those and fails if they appear.
- **Fixtures copy two upstream files** (compiled `entry/lib/index.js`, `linux-x64/package.json`) into
  gitignored `.artifacts/tmp/` scratch so the tests exercise the host's real resolution formula rather
  than a re-implemented one.
- **ARC-D keeps its own disk law.** The conjunction can only reclassify "could not run at all";
  `present: true, contentMatches: false` remains FAIL (T16 pins that).
- **`overallVerdict` severity ordering untouched**; SKIP/REFUSED/ENV_BLOCK still never PASS, and
  ENV_BLOCK still exits 1 (T17).
- **Incident, disclosed**: while pointing a proof script's `evidenceRoot` I created
  `.worktrees/.artifacts/` (gitignored scratch, one stale dir dated 2026-10-26 from an earlier lane's
  equivalent path bug) and then removed it. Nothing tracked lives under `.worktrees/`, and
  `docs/TEST_METHODS.md` §8 forbids scratch there — but it was not mine to delete, and the shared
  lease root `.artifacts/tmp/port-leases` in the main checkout was never touched.

## 8. Rollback

1. `git revert <this commit>` (or drop the PR) — the pre-flight, provisioning CLI, manifest and docs
   disappear with it; nothing in the product or host tree depends on them.
2. Delete the provisioned assets in any runtime checkout to return it to the un-provisioned state:
   `rm -f tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run
   tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/glibc/system.node`
   (both gitignored; `git status --porcelain` stays empty either way).
