# P1-T5 — Zero-core machine-provable verification (G1 criteria 3/4/5)

- **Task:** P1-T5 (execution 1 of max 3), branch `task/P1-T5-zero-core`, worktree `.worktrees/P1-T5`
- **Program invariant under test:** CORE PATCH BUDGET = 0 — upstream DSH stays clean; every capability ships as external plugin rows over **public seams** only.
- **Scope per DevPlan §13.6 (G1):** criterion 3 (skeleton builds independently), criterion 4 (plugin composes with pristine upstream), criterion 5 (pristine upstream byte/source clean after test). Downstream-host no-patch check covered in the same scanner run set.
- **Environment:** node v24.20.0 (direct `node`), pnpm 11.7.0 (the pnpm store exe runs its own node v26.0.0), Windows, workspace-write sandbox.

## 1. Deliverable A — `scripts/verify-zero-core.mjs` (the scanner)

Plain-node ESM, zero dependencies, **no child processes** (git snapshots are captured at the
pwsh layer and fed via file args — the scanner never spawns, per the sandbox matrix
`node→child (piped stdio) = EPERM errno -4048`). Read-only over the host tree.

### Check codes

| Code | Check |
| --- | --- |
| C1a `patch-package-lifecycle` | any lifecycle script (preinstall/install/postinstall/prepare) references `patch-package` |
| C1b `patch-own-source` | a `patches/*.patch` file (patch-package naming) targets one of the **host tree's own** workspace packages |
| C2 `patchedDependencies-own` | `pnpm.patchedDependencies` (package.json) or top-level `patchedDependencies:` (pnpm-workspace.yaml) keys a host-owned package |
| C3 `writing-lifecycle-script` | lifecycle script contains in-tree modification markers (`pnpm patch`, `git apply/am`, in-place `sed`/`perl`, `patch -x`, Node fs write APIs) |
| C4a `private-relative-escape` | plugin relative import resolves outside the plugin root (and into the host tree) |
| C4b `private-subpath` | plugin bare import of a host-tree package whose subpath is not in that package's `exports` whitelist (whitelist built by reading every non-node_modules package.json of the host tree first) |
| C4c `unresolved-upstream-scope` | plugin `@deepseek-ai/*` import naming no host-tree package |
| C5 `git-snapshot-missing` / `dirty-git-<label>` | `--status-before/--status-after/--diff-before/--diff-after` files must exist and be trim-empty |

**Calibration fact (prevents false positives on pristine upstream):** upstream's *own*
third-party dependency patching is legitimate and reported as `INFO`, never a finding —
pristine upstream ships `patches/node-pty@1.2.0-beta.15.patch` plus
`pnpm-workspace.yaml: patchedDependencies: node-pty@1.2.0-beta.15:`. Only patches whose
target name is in the host tree's own workspace package set are violations (that is the
definition of "rewriting upstream source"). Upstream's exactly two lifecycle scripts
(`postinstall: node scripts/install-lefthook.mjs`, subprocess `postinstall:
node scripts/ensure-spawn-helper.mjs`) carry no write markers and pass C3.

### Fixture self-check (machine-provable detector sensitivity)

Fixture tree `scripts/fixtures/zero-core/` — one sample per violation type plus
third-party controls (left-pad patch + patchedDependency → INFO). Self-check command:

```
node scripts/verify-zero-core.mjs --host scripts/fixtures/zero-core \
  --plugin scripts/fixtures/zero-core/plugins/bad-plugin-a \
  --plugin scripts/fixtures/zero-core/plugins/bad-plugin-b \
  --plugin scripts/fixtures/zero-core/plugins/good-plugin
```

Result (see `A-scanner/fixture-selfcheck.txt`, `.json`): **exit 1, exactly 7 findings,
2 INFO** — `patch-package-lifecycle` (bad-plugin-a postinstall), `patch-own-source`
(`patches/@fixture+host-core@1.0.0.patch`), `patchedDependencies-own` ×2 (root
package.json `pnpm.patchedDependencies` + `pnpm-workspace.yaml` block),
`writing-lifecycle-script` (bad-plugin-b prepare `writeFileSync`),
`private-relative-escape` (bad-plugin-a `../../../packages/host-core/src/index.js`),
`private-subpath` (bad-plugin-b `@fixture/host-core/internal` vs exports
`{".", "./public"}`), `unresolved-upstream-scope` — not present by design (no
`@deepseek-ai` import in fixtures; the code path is exercised in the clean runs below).
`good-plugin` (node: builtin + `./public` subpath + intra-package relative) produces **no**
finding. C5 codes verified separately: empty snapshots pass; dirty `--status-after` /
`--diff-before` → `dirty-git-*`; absent file → `git-snapshot-missing`
(see `A-scanner/c5-codes.txt`).

### Clean runs (false-positive check)

| Host tree scanned | Result |
| --- | --- |
| `scripts/fixtures/zero-core` + good-plugin only + empty snapshots | 5 host-tree findings (the fixture's own intentional violations), 0 C4/C5 — detector fires only where planted |
| Team worktree root (`--exclude fixtures`) | **PASS, 0 findings, exit 0** (`A-scanner/team-worktree-clean.txt`) |
| Pristine test-use `references/deepseek-harness-test-use` (with 4 byte-empty git snapshots) | **PASS, 0 findings, exit 0**, 2 INFO node-pty (`B-pristine-smoke/scanner-pristine.txt`) |
| Downstream host `.worktrees/P1-int-downstream` (with 4 byte-empty git snapshots) | **PASS, 0 findings, exit 0** (`C-downstream-smoke/scanner-downstream.txt`) |

## 2. Deliverable D — skeleton independent build (G1 criterion 3)

Worktree: install → build → lint → smoke → test, all logged to `D-*.log`.

| Step | Command | Result | Log |
| --- | --- | --- | --- |
| Install | `pnpm install --ignore-scripts` | **exit 0** (11.8s, 149 packages, warm store, 0 downloads) | `D-01-pnpm-install.log` |
| Build (pnpm) | `pnpm build` (`pnpm -r run build`) | **spawn EPERM errno -4048** — pnpm's recursive runner spawns a child `pnpm` with piped stdio, which the sandbox denies (not a build failure: no package compiled yet) | `D-02-build.log` |
| Build (equivalent) | per-package `tsc -p tsconfig.build.json`, the exact command `pnpm build` runs, invoked directly from pwsh (no node-originated spawn) | **8/8 green** (client, contracts, domain, remote, runtime, storage, testkit, tools; `legacy` is a reference-only slot with no build script by design) | `D-02b-build-tsc-direct.log` |
| Lint | `pnpm lint` (`eslint .`) | first run **exit 1 — two real lint errors in the newly added scanner files** (unused imports), proving the gate has teeth; after fix, **exit 0** | `D-03-lint-pnpm.log`, `D-03-lint-pnpm-retry.log`, `D-03b-lint-eslint-direct.log` |
| Smoke | `pnpm smoke:composition` (`node scripts/composition-smoke.mjs`) | **exit 0** — both plugin halves (host `dsh-agent-team`, client `dsh-agent-team-client`) load, `apply` callable and side-effect-free | `D-04-smoke-pnpm.log`, `D-04b-smoke-direct.log` |
| Test (pnpm) | `pnpm test` (`vitest run`) | **vitest cannot start in this sandbox**: vite 8 `windowsSafeRealPathSync` `execFile()`s a child during config loading → `spawn EPERM errno -4048` (full trace in log). This is the sandbox-boundary failure the task card anticipated; the vite-8 in-process override fixes esbuild transforms but not this Windows realpath execFile | `D-05-test-pnpm.log` |
| Test (equivalent) | `node scripts/run-tests.mjs` (new `test:node` script) | **18/18 pass, exit 0** — runs the identical `.test.ts` sources under node's native TS type-stripping | `D-06-run-tests.log` |

**`scripts/run-tests.mjs` equivalence and non-vacuity.** The runner
(`scripts/run-tests.mjs` + `scripts/run-tests-hooks.mjs` + `scripts/test-vitest-shim.mjs`,
new `package.json` script `test:node`) executes the same test files `vitest run` would:
module resolution hooks map the bare `vitest` specifier to a zero-dependency shim
implementing exactly the audited matcher surface (`toBe`, `toEqual`,
`toBeGreaterThan`, `toThrow`, each with `.not`), and rewrite TS-style `.js` relative
specifiers to their `.ts` siblings; node's native type-stripping handles the erasable TS
syntax. No child processes are spawned anywhere in the chain (the `module.register` hook
worker is an in-process worker thread). **Negative control:** a temporary
`packages/_tmp-negative` suite (removed afterwards) with 5 deliberately failing tests
produced **5/5 FAIL, exit 1** with per-assertion stacks — the runner is not a vacuous
green (`D-07-run-tests-negative-control.txt`).

**Criterion 3 verdict: satisfied, machine-provably.** The 9-package skeleton installs and
compiles with no upstream dependency in either direction: the build is `tsc` over
`packages/*/src` only; `pnpm install` resolves exclusively the root devDependencies
(eslint/typescript/vitest line). The two pnpm failures recorded above are sandbox spawn
restrictions (traces in logs), not build failures; their equivalents ran green.

## 3. Deliverable B — pristine upstream smoke (G1 criteria 4 + 5)

Instance chain (pre-verified in this program, zero approvals): test-use tree at
`cd5ef8148158c3a752a658978873241fdf8e2bbc` already had `node_modules` + built `lib`
(build:lib green; build:web fail is known non-G1 — no frontend bundle is produced, so the
browser surface is outside what this sandbox can verify, documented in §6). DSH_HOME
`references/.dsh-test`, port 3180, `--no-open`.

### Mount seam (public, no upstream change)

`references/.dsh-test/profiles/web/cordis.patch.yml` — the profile's **user patch layer**,
applied after every bundle layer by the stock `profile-boot` (`boot(NAME, rootConfig,
allPatches)` with `rootConfig = <profile dir>/cordis.yml`; loader `ctx.baseUrl =
dirname(rootConfig)`, relative entry names resolve via `new URL(name, baseUrl)`):

```yaml
- insert:
    - id: dsh-agent-team
      name: '../../../../.worktrees/P1-T5/packages/runtime/dist/plugin/host.js'
    - id: dsh-agent-team-client
      name: '../../../../.worktrees/P1-T5/packages/client/dist/plugin/client.js'
```

**Why relative file rows (design rationale):** (a) the T4 package roots export only
`.` → `dist/index.js` (PACKAGE_ID) — the plugin modules are not on any public subpath,
so a bare package row cannot name them without upstream exports changes; (b) bare
`cordis.yml` rows require the package to be declared in the resolver manifest's
`dependencies` (verify-cordis-config) — dependency plumbing we must not add to upstream;
(c) app-boot/loader document relative names resolving beside the config file with no
native-helper requirement. Both halves mounted as host-side rows; the client half's
browser activation is a non-G1 limitation (no frontend bundle in sandbox).

### Evidence sequence

1. **Before snapshots** (pwsh-layer git, fed to scanner): `git status --porcelain` = 0 bytes,
   `git diff` = 0 bytes → test-use provably clean before any touch
   (`B-pristine-smoke/git-status-before.txt`, `git-diff-before.txt`, `head-before.txt` = cd5ef814…bbc).
2. **Baseline composition:** `node apps/cli/lib/bin.js --profile web --dump-config` (the
   same `composeEntries` boot uses) → **exit 0, 524 lines**, no `dsh-agent-team` rows
   (`dump-config-baseline.txt`).
3. **Mount written** (one file, user patch layer only).
4. **Composition after mount:** dump-config → **exit 0, 531 lines**; the patch layer
   section shows both rows resolved to
   `file:///D:/.../.worktrees/P1-T5/packages/runtime/dist/plugin/host.js` and
   `…/packages/client/dist/plugin/client.js` (`dump-config-after-mount.txt`) — static
   proof the public seam carries our rows into the composed entry list.
5. **Boot:** `node apps/cli/lib/bin.js web --port 3180 --no-open`
   (`DSH_HOME=references/.dsh-test`, `DSH_CLIENT_COMMIT_HASH=cd5ef814`) →
   `dsh web: http://127.0.0.1:3180/?token=…` (`boot.log`, `boot-positive.txt`).
   **Load proof:** `app-boot` `assertEntriesActivated` rejects startup when any entry
   fails import/activation — a successful boot line with our rows present in the
   composition (steps 4) is machine proof that both plugin modules imported and
   `apply()` ran (both are no-op skeletons: nothing else could have failed).
6. **Negative control (non-vacuity):** row pointed at
   `host-NOT-FOUND.js` → boot **failed loud, exit 1**:
   `ERR_MODULE_NOT_FOUND: Cannot find module '…host-NOT-FOUND.js' imported from
   D:\…\references\.dsh-test\profiles\web\` (`negative-control.log`) — the same signal
   that made step 5 non-vacuous, and the `imported from` path independently confirms the
   relative-name resolution base. Row restored; dump-config exit 0 with correct rows
   (`dump-config-final-restored.txt`).
7. **Stop:** background job killed; port 3180 verified freed.
8. **After snapshots:** `git status --porcelain` = 0 bytes, `git diff` = 0 bytes
   (`git-status-after.txt`, `git-diff-after.txt`, `head-after.txt` = same SHA) —
   **pristine upstream byte-clean after the full test** (criterion 5).
9. **Scanner:** exit 0, 0 findings, 2 INFO (node-pty, upstream's own dependency patch)
   (`scanner-pristine.txt`).

### Profile state policy

The mount rows are **left in** `references/.dsh-test/profiles/web/cordis.patch.yml`
(kept for G1-REVIEW reuse per TEST_METHODS §4). Exact final content is in
`B-pristine-smoke/profile-final.txt`; one-line revert: replace the `- insert:` block with
`[]` (baseline captured in `profile-cordis.patch.yml-before.txt`).

## 4. Deliverable C — downstream forward-replay host smoke (G1 criterion 4, host side)

Host tree: `.worktrees/P1-int-downstream` at `02f3094c59…` (host/downstream-int-20260829).
Independent DSH_HOME `references/.dsh-test-downstream` — **created empty by design**:
`loadProfile` auto-inits the missing `web` profile from `PROFILE_TEMPLATES` (stock
dsh-base + dsh-web-app, `patchReload: live`) and the launcher heals the module-fallback
links against this tree's own install, so no state is copied from the pristine side.
Port 3180 reused only after the pristine side was stopped.

| Step | Command | Result | Log |
| --- | --- | --- | --- |
| Install | `pnpm install --ignore-scripts` | **exit 0** (3m43s, 1035 packages, 1029 reused, warm store) | `C-01-pnpm-install.log` |
| Build | `node scripts/build.ts` (`DSH_CLIENT_COMMIT_HASH=02f3094c`) | **build:lib host+client green** (`tsc -b` + tsdown both faces; `apps/cli/lib/bin.js` + `packages/boot/app-boot/lib` emitted); **build:web failed `spawn EPERM`** in `@deepseek-ai/dsh-web-frontend` `vite build` — the known non-G1 sandbox limitation (no frontend bundle), recorded as expected | `C-02-build.log` |
| DSH_HOME | `references/.dsh-test-downstream` | **created empty on purpose** — `loadProfile` auto-inited `profiles/web` from `PROFILE_TEMPLATES` (stock bundles + `patchReload: live`); zero state copied from the pristine side; launcher heals module-fallback against this tree's install | `C-03-dump-config-baseline.txt` |
| Baseline composition | `--profile web --dump-config` | **exit 0, 526 lines** (524 + 2 forward-replay rows), no `dsh-agent-team` rows | `C-03-dump-config-baseline.txt` |
| Mount | `profiles/web/cordis.patch.yml` | same two relative rows as the pristine home (relative depth identical: `references/<home>/profiles/web` → 4 up to team root) | `profile-final.txt` |
| Composition after mount | `--profile web --dump-config` | **exit 0, 533 lines**; both rows present, resolved to `file:///…/.worktrees/P1-T5/packages/{runtime,client}/dist/plugin/{host,client}.js` | `C-04-dump-config-after-mount.txt` |
| Before snapshots | `git status --porcelain` / `git diff` on the downstream host tree | **0 bytes / 0 bytes** (HEAD `02f3094c59…`) | `git-status-before.txt`, `git-diff-before.txt`, `head-before.txt` |
| Boot | `node apps/cli/lib/bin.js web --port 3180 --no-open` (DSH_HOME = downstream home; port reused only after the pristine side was stopped) | `dsh web: http://127.0.0.1:3180/?token=mW_cuY-…` — **boot success with the rows present = machine proof the plugin loaded** (same `assertEntriesActivated` fail-loud semantics as §3) | `C-05-boot.log`, `boot-positive.txt` |
| Stop | job killed | port 3180 verified freed | — |
| After snapshots | `git status --porcelain` / `git diff` | **0 bytes / 0 bytes** — the downstream host tree is byte-clean after the full test; `node_modules/`, `lib/`, build outputs are gitignored (untracked-ignored ≠ dirty) and HEAD unchanged | `git-status-after.txt`, `git-diff-after.txt`, `head-after.txt` |
| Scanner | `verify-zero-core --host .worktrees/P1-int-downstream` + 4 snapshots | **PASS, 0 findings, exit 0**; 2 INFO (upstream's own `node-pty` patch + `patchedDependencies` entry) — the downstream forward-replay host carries **no Team-required core/api/client/bundle patch** | `scanner-downstream.txt` |

**Criterion 4 host-side verdict: satisfied** — the identical public-seam mount composes
and loads on both the pristine upstream and the downstream forward-replay host, and the
downstream host tree remains byte-clean with zero scanner findings.

## 5. G1 criteria verdicts (machine-provable pointers)

| Criterion | Verdict | Machine proof |
| --- | --- | --- |
| 3 — skeleton builds independently | **PASS** | §2 table: install exit 0; per-package tsc (the exact `pnpm build` command) 8/8 green; `legacy` no-build by design; lint exit 0; smoke exit 0; tests 18/18 via equivalent runner (vitest EPERM trace recorded) |
| 4 — plugin composes with pristine upstream | **PASS** | §3 steps 2–6: dump-config composition carries both rows; boot success under `assertEntriesActivated` fail-loud; negative control fails loud; downstream host same scan set in §4 |
| 5 — pristine upstream byte/source clean after test | **PASS** | §3 step 1 vs step 8: status/diff 0 bytes before and after, identical HEAD; scanner exit 0 with only upstream's own node-pty INFOs |

## 6. Limitations (non-G1, recorded for G1-REVIEW)

- `build:web` fails in this sandbox (known upstream limitation; no frontend bundle) →
  the **browser/client surface cannot be activated or observed** here. The client half is
  mounted as a host-side row and its `apply()` is verified side-effect-free; browser
  activation remains a review-time check.
- vitest cannot start (vite-8 Windows realpath `execFile` → sandbox EPERM); the
  `test:node` equivalent runs the identical sources (equivalence + negative control in §2).
- Git snapshots are captured at the pwsh layer and passed to the scanner as file args
  because the scanner must spawn nothing; the four snapshot files are the proof objects.

## 7. Final self-verification (post-commit)

Re-run after the code commit, from the worktree root. Full verbatim outputs:
`A-scanner/final-selfverify-pristine.txt` and `A-scanner/final-selfverify-fixtures.txt`
(paths below abbreviated to `…P1-T5\…`; exit codes measured).

**7.1 Pristine test-use host → exit 0 (expected: clean):**

```
$ node scripts/verify-zero-core.mjs --host …references\deepseek-harness-test-use ^
    --status-before …B-pristine-smoke\git-status-before.txt ^
    --status-after  …B-pristine-smoke\git-status-after.txt  ^
    --diff-before   …B-pristine-smoke\git-diff-before.txt   ^
    --diff-after    …B-pristine-smoke\git-diff-after.txt
INFO third-party patched dependency "node-pty" at …test-use\pnpm-workspace.yaml [patchedDependencies] (upstream's own dependency patching; not a Team rewrite)
INFO third-party patch file …test-use\patches\node-pty@1.2.0-beta.15.patch (upstream's own dependency patching; not a Team rewrite)
RESULT: PASS verify-zero-core (0 findings)          (exit 0)
```

**7.2 Negative fixtures → exit 1 with all 7 expected findings (non-vacuous signal):**

```
$ node scripts/verify-zero-core.mjs --host …scripts/fixtures/zero-core ^
    --plugin …plugins/bad-plugin-a --plugin …plugins/bad-plugin-b --plugin …plugins/good-plugin
INFO third-party patched dependency "left-pad" at …zero-core\pnpm-workspace.yaml [patchedDependencies] (control)
INFO third-party patch file …zero-core\patches\left-pad@1.0.0.patch (control)
FINDING patchedDependencies-own      @ …zero-core\package.json [pnpm.patchedDependencies]
FINDING writing-lifecycle-script     @ …bad-plugin-b\package.json [prepare]
FINDING patch-package-lifecycle      @ …bad-plugin-a\package.json [postinstall]
FINDING patchedDependencies-own      @ …zero-core\pnpm-workspace.yaml [patchedDependencies]
FINDING patch-own-source             @ …zero-core\patches\@fixture+host-core@1.0.0.patch
FINDING private-relative-escape      @ …bad-plugin-a\src\index.js:1 (relative import escapes plugin root; enters the host tree)
FINDING private-subpath              @ …bad-plugin-b\src\index.js:1 (subpath "/internal" not in exports surface; public: ., ./public)
RESULT: FAIL verify-zero-core (7 findings)          (exit 1)
```

The clean control plugin (`good-plugin`) produced zero findings, confirming the
scanner distinguishes public-seam usage from private import forms. Both expectations
met: pristine host stays PASS after the smoke test, and every seeded violation class
is detected exactly once — the verification is machine-provable in both directions.

## 8. Evidence index

```
dev/agent-workflow/evidence/P1-T5/
  verify-report.md                 this file
  A-scanner/                       fixture self-check (txt+json), C5 code checks, clean runs
  B-pristine-smoke/                before/after git snapshots + HEAD, profile before/final,
                                   dump-config baseline/after-mount/final-restored,
                                   boot.log + boot-positive.txt, negative-control.log,
                                   scanner-pristine.txt
  C-downstream-smoke/              install/build logs, profile, dump-config, boot log,
                                   snapshots, scanner-downstream.txt
  D-build/ (root D-*.log)          install, pnpm build EPERM, direct tsc, lint (3 logs),
                                   smoke (2 logs), vitest EPERM trace, run-tests,
                                   negative control
```
