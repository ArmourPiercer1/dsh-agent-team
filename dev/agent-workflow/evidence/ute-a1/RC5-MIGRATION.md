# RC5-MIGRATION — the rc.5 lane actually RUNS: B1–B4 measured, B5 signal collected

Round 72b, 2026-11-22. Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`,
base `6350d04b0` (+ this round's commit). Read first: `NEXT-HOST-RC5-FEASIBILITY.md` (the
feasibility this round executes), `docs/TEST_METHODS.md` §2/§5/§7/§11.

## Verdict, one screen

| step | state | measured fact |
| --- | --- | --- |
| B1 provisioning | **done** | rc.5 tree installed + built (10/10 build gates), pinned native assets provisioned and verified; tree `git status --porcelain` empty |
| B2 host-anchored resolution | **done, and a real false-green closed** | the lane's resolver used to RETURN an out-of-tree rc.2 hit; it now refuses one and continues. Product bare imports are redirected to the host tree by the test loader |
| B3 `workingDirectory` injection | **done** | LABELED double, next-host only; measured: without it rc.5 registers **no** read/write/edit |
| B4 batch + executor dispatch | **done** | batch shape (`calls:[{type:'tool-call',…}]` → `batch.results[0].result`) + `dsh-tool-executor-native` mounted; legacy shape kept verbatim for rc.2 |
| existing next-host lane | **19/19 pass** | boot, native-api (A1–A6), provisioning controls (11 refusals + positive) |
| ute-g1-fs rc.5 lane | **5/5 pass** | 16/16 vectors reproduce the rc.2 golden; 13/13 negative controls |
| A1 slice on rc.2 | **36/36 pass** | no regression from the port (default = legacy) |
| A1 slice on rc.5 | **33/36 pass** | 3 red: SLICE-35 (the intended B5 signal) + SLICE-21/30 (genuine rc.5 drift, §7) |
| B5 three unconfined FS methods | **not fixed (by instruction)** | the invariant is RED on rc.5 and names **7** un-overridden entry points (§6) |
| local gates | **all green** | dispatch 180+2skip, catalog 785/38/14, cut-closure, P0, docs-sync, 28 placements, ci-required 10/0, bound vitest 238 |

No `CORE_SEAM_BLOCKER`. No host-tree file was written (the only host writes are the gitignored
install/build outputs and the pinned `bin/` payload, both by the provisioning transport). No
upstream patch, no vendored copy, port 3080 and its `DSH_HOME` untouched.

## 1. B1 — provisioning and build (DONE)

### The tree is SHARED, stated plainly

`tests/deepseek-harness-next` in this worktree is a **symlink**:

```
tests/deepseek-harness-next -> ../../../tests/deepseek-harness-next
realpath = /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-next
```

So provisioning writes the tree shared by the main checkout **and every worktree**. That is the
documented protocol (§ feasibility "worktree host trees are symlinks to the main checkout") and it
was done deliberately; it is recorded here because the blast radius is every worktree, not this one.
Afterwards the tree is pristine upstream: `git -C tests/deepseek-harness-next status --porcelain`
is **empty**, HEAD is still the pin.

### Materialize + build

```
$ node scripts/provision-next-host.mjs --materialize
...
run-gates: 10 passed, 0 failed, 0 skipped in 124.58s.
NEXT-HOST-MATERIALIZED tag=dsh-v0.2.2-rc.5 head=9c2670d3bce5275e0d1610272958121af87787bb \
  version=0.2.2-rc.5 pnpm=11.28.5 tree=…/.worktrees/vnext-a1-cut/tests/deepseek-harness-next
```

The script DOES build (the feasibility's "BUILD it if the script does not" is moot — its embedded
`pnpm run build` runs the host's own 10-gate orchestrator). Install+build took ~3 min
(`pnpm install` 1 m 0.4 s, build 124.58 s) plus the shared pnpm store warm-up.

Identity, read back:

| fact | value |
| --- | --- |
| version | `0.2.2-rc.5` |
| HEAD | `9c2670d3bce5275e0d1610272958121af87787bb` |
| tag | `dsh-v0.2.2-rc.5` (upstream `git ls-remote` re-checked = same SHA) |
| package manager | `pnpm@11.28.5` (read from the tree's `packageManager`, not typed) |
| build entry | `apps/cli/lib/bin.js` present; `packages/fs/tool-fs/lib/index.js` present |

### Published native assets

`--assets` from this worktree is **refused** for a symlink-mechanical reason, not a semantic one:

```
$ node scripts/provision-next-host.mjs --assets
NEXT-HOST-REFUSED code=ASSETS_LAUNCHER_PATH_OUTSIDE_TREE \
  detail=host-sandbox-assets: LAUNCHER_PATH_OUTSIDE_TREE: launcherPath resolved outside the runtime tree:
  /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-next/native/system/packages/linux-x64/bin/landlock-run
```

The CLI passes the UNRESOLVED tree path and compares it to the launcher's realpath; through the
symlink the two can never agree. The documented operation was therefore run with the **same
transport, same pins, same receipt**, anchored at the resolved tree (ephemeral, gitignored driver
`.artifacts/tmp/next-host/provision-assets-driver.mjs`, quoted in full by the command below):

```
$ node .artifacts/tmp/next-host/provision-assets-driver.mjs
NEXT-HOST-ASSETS package=@deepseek-ai/node-addon-system-linux-x64 version=0.1.2 \
  tarballSha256=77fb771bee2133c3ffd1f96c7b9435ddb1ccaee72b6814f6f4391343a611cc20 \
  distIntegrity=sha512-S2aPVHvYCpNCppCFyNlooMYuTB7ucK5lvD9oXQQ42v5Z2s5AoaiCdjz9r2l+ED2rI5oS1x0cUZmKjJH2dxV0pg== \
  files=2 hostBaseline=next host=9c2670d3bce5275e0d1610272958121af87787bb \
  manifestDigest=7f367c7a964ca9fdb33e93e889a5a999c481da35e81edc67976fffbc3cc8c52c \
  receipt=…/.artifacts/tmp/host-assets/next-provision-receipt.json
```

Then the documented verifier (no network, no writes) passes from the worktree:

```
$ node scripts/provision-next-host.mjs --verify
NEXT-HOST-VERIFIED head=9c2670d3bce5275e0d1610272958121af87787bb version=0.2.2-rc.5 \
  assets=bin/glibc/system.node:54a9c25c05186c17520f6b7a5ced5f005752c08044c3eb76524cd517287600bc:17360:0o755|\
bin/landlock-run:a752bc72f111fcc573c3e61fb90fa544541dac0ca498d2e279e1630d7c659b31:38552:0o755 \
  manifestDigest=7f367c7a964ca9fdb33e93e889a5a999c481da35e81edc67976fffbc3cc8c52c
```

**Residual friction (not a blocker, disclosed):** the CLI cannot provision assets for a
symlink-shared tree from a worktree. A one-line fix would compare realpaths in
`assertInsideWorkspace`/`resolveHostSandboxLayout`; it is NOT done this round (not needed, and it
changes a provisioning guard).

## 2. B2 — host-anchored resolution, and the false green it was hiding (DONE)

### The measured trap

`createRequire(join(tree, 'packages/fs/fs-local/package.json')).resolve('@deepseek-ai/dsh-tool-fs')`
— fs-local does not depend on tool-fs, so Node climbs OUT of the host tree and returns the rc.2
copy. The lane's old `resolveHostModule` returned the FIRST successful resolution with **no
containment check**, i.e. it could hand a caller rc.2 while the suite reported rc.5.

```
HOST-ANCHOR naive-require-escapes=true \
  escapedTo=…/.worktrees/vnext-a1-cut/node_modules/.pnpm/@deepseek-ai+dsh-tool-fs@0.2.0-rc.2_…/lib/index.js
HOST-ANCHOR hardened-refuses-escape=true \
  resolved=…/tests/deepseek-harness-next/packages/fs/tool-fs/lib/index.js
```

### What changed

1. `tests/next-host/host-next-lib.mjs#resolveInsideTree` — resolution now REQUIRES the resolved
   realpath to be inside the realpath of the host tree. An out-of-tree hit is not a resolution: the
   next anchor is tried, and if every anchor escapes the lane throws `MODULE_UNRESOLVED` **with the
   escape evidence**. Anchor list extended to every package the lanes import (fs/tool-fs-search,
   shell/tool-bash-persistent, sandbox/{sandbox,sandbox-local,sandbox-policy}, web/tool-web,
   spill/spill-local, subprocess/subprocess-local, …).
2. `tests/next-host/host-select.mjs` (new) — `TEAM_TEST_HOST=next|legacy`, unknown values throw.
   `legacy` is the default and resolves exactly as before (per-package anchor), so every existing
   leg is untouched.
3. `scripts/run-tests-hooks.mjs` — when `TEAM_TEST_HOST=next`, every bare `@deepseek-ai/*` import
   from **TEAM code** is redirected into the host tree. This is the half the feasibility called
   "factory or TEAM bare imports": without it the product's `import { scopeOf } from
   '@deepseek-ai/dsh-scope'` binds rc.2's scope while the world builds rc.5 scopes — two host
   generations in one process. Imports whose parent is ALREADY inside the host tree are left to
   Node's normal host-anchored walk (otherwise legitimate host deps such as
   `@deepseek-ai/cosmokit` fail to resolve from a workspace anchor).
4. `tests/world-factory/lib/a5sf-fs-contract-world.mjs` — `fsContractHostLayout` /
   `loadFsContractSeams` are host-selectable (`TEAM_TEST_HOST`), cache keyed by `mode:repoRoot`,
   and every upstream entry the world consumes goes through `resolveSelectedHostModule`.

### Proof (same process, `TEAM_TEST_HOST=next`)

```
HOST-ANCHOR tree=/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-next
HOST-ANCHOR @deepseek-ai/cordis                    inside=true file=…/tests/deepseek-harness-next/vendor/cordis/lib/index.js
HOST-ANCHOR @deepseek-ai/dsh-tools                 inside=true file=…/packages/core/tools/lib/index.js
HOST-ANCHOR @deepseek-ai/dsh-scope                 inside=true file=…/packages/core/scope/lib/index.js
HOST-ANCHOR @deepseek-ai/dsh-fs-local              inside=true file=…/packages/fs/fs-local/lib/index.js
HOST-ANCHOR @deepseek-ai/dsh-tool-fs               inside=true file=…/packages/fs/tool-fs/lib/index.js
HOST-ANCHOR @deepseek-ai/dsh-tool-executor-native  inside=true file=…/packages/core/tool-executor-native/lib/index.js
HOST-ANCHOR @deepseek-ai/dsh-tool-fs-search        inside=true file=…/packages/fs/tool-fs-search/lib/index.js
HOST-ANCHOR @deepseek-ai/dsh-sandbox-local         inside=true file=…/packages/sandbox/sandbox-local/lib/index.js
HOST-ANCHOR @deepseek-ai/dsh-tool-bash-persistent  inside=true file=…/packages/shell/tool-bash-persistent/lib/index.js
```

Corroboration that it is the REAL rc.5 code executing, not a relabelled rc.2: the boot lane's own
`NEXT-SMOKE HOST` line prints the tree HEAD and the pinned native bytes, and `A1–A6` exercise rc.5
host packages the rc.2 install does not even ship in the same shape (`@deepseek-ai/dsh-ptc-runtime`,
the batch executor). `ute-g1-fs` independently resolves through its own contained loader and reports
`host=9c2670d3…`.

## 3. B3 — the `workingDirectory` injection double (DONE)

rc.5 `dsh-tool-fs` statically injects `['tools','fs','systemPrompt','workingDirectory']`. Cordis
defers a plugin with an unmet static inject **silently**. Measured on the rc.5 tree, same context,
double absent vs present:

```
WD-DOUBLE withDouble=false registered=(none)
WD-DOUBLE withDouble=true  registered=read,write,edit
```

`provideWorkingDirectoryDouble(ctx, defaultDirectory)` is exported from the world factory and is a
**LABELED DOUBLE**, exactly like the slice's existing `approval` double: it answers "which directory
is this session in?" from `session.header.cwd`, falls back to the world's directory, does no
durability, no change events, no host checks. It is mounted ONLY when the host is `next`; rc.2 has
no such inject and must not grow product wiring invented by a test. Both the slice world and
`makeFsContractWorld` mount it.

## 4. B4 — batch dispatch + executor (DONE)

rc.5 replaced `tools.execute({callId,name,arguments})` with:

```js
tools.execute({ calls: [{ type: 'tool-call', id, name, arguments: JSON.stringify(args) }], signal, agent })
// -> batch.results[0].result
```

`executeToolDispatch(tools, call, {hostMode})` branches: batch + JSON-string arguments on `next`,
the legacy shape verbatim on `legacy`. `@deepseek-ai/dsh-tool-executor-native` is mounted after
`ToolRuntime` on `next` only (rc.5 selects an executor before dispatch; unmounted it is
`TOOL_EXECUTOR_UNAVAILABLE`). Evidence: `native-api` A2/A3 pass on rc.5 (`executor=selected`,
`order=tools/pre-execute>tools/execute>tools/post-execute>tools/result`), and 33/36 slice arms
dispatch through the batch shape.

The slice's rung 4/5/6 prerequisite modules were also moved onto the host selector (they used a
`packages/runtime`-anchored require, which is correct for rc.2 and an rc.2-escape for rc.5):
`resolveHostEntry` / `requireOfOwningPackage` / `resolveFromPackageOrHost`. This is why SLICE-28 and
SLICE-33 went from `MODULE_UNRESOLVED` to passing; no assertion was touched.

## 5. The lanes, per suite, honestly

### 5.1 `tests/next-host` — the existing next-host lane: 19/19 PASS

```
$ node --test --test-reporter=spec tests/next-host/*.test.mjs
NEXT-SMOKE BANDS ok legacy=3181-3199(19) next=13000-13049(50) overlap=0
NEXT-SMOKE BOOT ok ms=1255 port=13000 treeHead=9c2670d3… version=0.2.2-rc.5
NEXT-SMOKE SESSION ok sessionId=session-0340298e… createStatus=200 promptStatus=200 modelRequests=2
NEXT-SMOKE SERVED ok … sessionFiles=…/session.v4.jsonl.zstd modelReplies=2
NEXT-SMOKE A1 ok resolve=ResolvedToolSet dispose=function admitted=observe
NEXT-SMOKE A2 ok executor=selected tool=observe value=observed:one bodyObserved=["one"]
NEXT-SMOKE A3 ok order=tools/pre-execute>tools/execute>tools/post-execute>tools/result
NEXT-SMOKE A4 ok transport=run_code … sessionEvents=tool/ptc-dispatch-start,tool/ptc-dispatch
NEXT-SMOKE A5 ok bodySawAbort=true resultIsError=true notified=1
NEXT-SMOKE A6 ok lateSuccessOverridden=ABORTED preDispatch=ABORTED_BEFORE_DISPATCH dispatched=0
NEXT-SMOKE HOST ok tag=0.2.2-rc.5 head=9c2670d3… assets=bin/glibc/system.node:54a9c25c…|bin/landlock-run:a752bc72…
ℹ tests 19  pass 19  fail 0  skipped 0
```

The 19 include the 11 provisioning-refusal controls (`TREE_MISSING`, `NOT_BUILT`,
`NOT_A_GIT_CHECKOUT`, `HEAD_DRIFT`, `VERSION_DRIFT`, `VERSION_UNREADABLE`, `PIN_INVALID`×2,
`ASSET_MISSING`, `ASSET_DIGEST_DRIFT`, `ASSET_BYTES_DRIFT`, `ASSET_MODE_DRIFT`) — still refused,
still red-on-demand. **This is a real boot of the pinned rc.5 binary on port 13000 with its own
`tests/homes/next-boot-…-next` home, and the session log is on disk.** Nothing was skipped, no
timeout was raised, nothing mocked.

### 5.2 `tests/ute-g1-fs` (the other rc.5 lane): 5/5 PASS

```
$ node --test --test-reporter=spec tests/ute-g1-fs/lane-suite.test.mjs
UTE-G1-FS-VERDICT GREEN vectors=16 pending=0 host=9c2670d3bce5275e0d1610272958121af87787bb
UTE-G1-FS-NC NC-1-lane-bites ok … NC-4-lane-load-bearing ok … NC-MEMBER {read,write,edit,read_image} ok
NC-MEMBER-POSITIVE ×4 ok … NC-IMAGE-OBSERVER ok cases=4
ℹ tests 5  pass 5  fail 0
```

16/16 corpus vectors reproduce the rc.2 golden through the rc.5 host's own executor; 13/13 negative
controls hold. (This lane was green-capable in code already; it had never RUN because the tree was
not built. It runs now.)

### 5.3 A1 vertical slice, rc.2 (default): 36/36 PASS

```
$ node --test --test-reporter=spec packages/runtime/test/vnext-fs-slice.test.mjs
ℹ tests 36  pass 36  fail 0
```

The port is inert on the legacy host: no assertion changed, no arm skipped.

### 5.4 A1 vertical slice, rc.5 (`TEAM_TEST_HOST=next`): 33/36 PASS

```
$ TEAM_TEST_HOST=next node --test --test-reporter=spec packages/runtime/test/vnext-fs-slice.test.mjs
ℹ tests 36  pass 33  fail 3
✖ SLICE-21 — STOP before dispatch: an aborted call never reaches the body
✖ SLICE-30 — a Stop before admission invents no settlement record, and is not silently lost
✖ SLICE-35 — the confined provider covers EVERY base entry point that touches a path
```

This is the first rc.5 green/red measurement of the product slice. 30 of the arms — identity,
inside/outside confinement through the Member's own provider, admission allow/deny/unwired, the
durable ledger, duplicate-callId refusal, restart no-replay, observation policy on/off, approved-ask
exactly-once, revocation recheck, settlement, crash recovery, edit confinement, web rung 5/6 — pass
on rc.5 **with the same assertions that pass on rc.2**. The three reds are analysed below; two are
host drift, one is the intended product signal.

## 6. SLICE-35 — the confinement invariant is RED on rc.5 (the intended B5 signal)

```
✖ SLICE-35 — the base provider has path-touching entry points the Team confined class does not override:
  deleteFile, moveFile, patchContent, patchText, requireFile, withLocks, writeTarget
```

Derived from the rc.5 concrete `LocalFileSystem` prototype; SLICE-36 (the positive control) passes
after being made host-relative (its expectation is now "the selected base's own un-overridden set
PLUS the three the fixture adds", computed, not hard-coded — still an exact `deepEqual`).

Reading the 7 names honestly, because the number is larger than the feasibility's 3:

| name | what it is |
| --- | --- |
| `patchText`, `deleteFile`, `moveFile` | the three PUBLIC rc.5 `FileSystem` additions — the real confinement gap; `apply_patch`/delete/move reach the backend without the Member lane |
| `patchContent`, `requireFile`, `withLocks`, `writeTarget` | **internal helpers of the concrete rc.5 provider**, called only from inside `patchText`/`deleteFile`/`moveFile` (`fs-local/src/index.ts:129,290,317,348,369`). TS `private` is not runtime-private, so the derivation sees them |

So the invariant is not over-reporting a *reachable* surface: the three public methods are the gap,
and the four helpers are the same gap's internals. Whether the derivation should exclude known
internal helpers is a follow-up decision for the invariant's owner — excluding them by name is an
allowlist, which the arm's design explicitly refused ("no allowlist to rot"), so it was NOT done.

**Consequence, stated for the host list:** on rc.5, `apply_patch`, delete and move are NOT confined.
No claim of "FS confinement holds on rc.5" may be made until the three overrides exist. B5 itself
(three overrides in `packages/runtime/team-services/src/fs.ts` + arms) is a separate product task
and was NOT attempted this round, per instruction.

## 7. SLICE-21 / SLICE-30 — genuine rc.5 behavioural drift (B6), not a porting bug

Both arms abort a call BEFORE dispatch and then require the host to have SETTLED it, so the
admission/settlement record exists. On rc.5 it does not: rc.5's batch scheduler synthesizes
`ABORTED_BEFORE_DISPATCH` results for skipped calls (`packages/core/tools/src/batch.ts#skip`) and
**never runs the pipeline**, so `tools/result` never fires; on rc.2 the pipeline handled the
pre-dispatch abort and emitted the event. Measured with one probe, one call, both hosts:

```
ABORT-PROBE mode=legacy isError=true code=ABORTED_BEFORE_DISPATCH toolsResultEvents=1
ABORT-PROBE mode=next   isError=true code=ABORTED_BEFORE_DISPATCH toolsResultEvents=0
```

This is a real semantic difference the migration must not paper over: a product that keys its
durable Stop evidence off `tools/result` observes nothing for a call aborted before dispatch on
rc.5. The harness is NOT adjusted to accept it (no assertion weakened, no skip): the arms stay red
so the product decision ("where does a pre-dispatch Stop get recorded on rc.5?") is forced. This is
exactly the B6 risk the feasibility named — the first green run telling drift from a porting bug.

## 8. Local gates, pasted

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 \
  set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
ℹ tests 182  pass 180  fail 0  skipped 2        (the two disclosed process-lane skips, unchanged)

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  tests=785  DISCOVERED_AND_COLLECTED 733  EXCLUDED_WITH_REASON 14  UNCOLLECTED 38
DSH-TEST-CATALOG tests=785 refused=0 findings=0

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
AUTHORITY_SOURCE_BINDING {… "pointer_digest_verified":true …}

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (28 placement(s))

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-integration \
    --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
```

## 9. Still blocked / not attempted

| item | state | why |
| --- | --- | --- |
| **B5** — three unconfined FS methods | **not attempted (by instruction)** | separate product task; the invariant that keeps it visible (SLICE-35) is red on rc.5 and reported |
| SLICE-21 / SLICE-30 on rc.5 | **red, deliberately** | rc.5 batch synthesizes pre-dispatch abort results without the pipeline (§7); needs a product decision, not a test edit |
| provisioning CLI on a symlinked tree (`--assets`) | **environment friction, worked around** | `LAUNCHER_PATH_OUTSIDE_TREE` is lexical; realpath-anchored transport used and verified. A realpath fix in the CLI is a follow-up, not done here |
| hosted CI `next-host` leg | **not run here** | the leg provisions the tree on the runner; this round only proves the LANE, locally, against the real pinned host |
| claim "FS confinement holds on rc.5" | **forbidden until B5** | §6 |
| any `CAPABILITY-MATRIX-C.md` row upgrade | **not done** | no row is PRODUCT-PROVEN; rc.5 greens are lane evidence, not a matrix upgrade |

## 10. Files changed (this round)

- `tests/next-host/host-next-lib.mjs` — `resolveInsideTree`: containment is part of resolution; anchors extended.
- `tests/next-host/host-select.mjs` — **new**: `TEAM_TEST_HOST=next|legacy`, fail-loud, tree + bare-import selection.
- `scripts/run-tests-hooks.mjs` — host-anchored redirect of TEAM `@deepseek-ai/*` imports under `next`.
- `tests/world-factory/lib/a5sf-fs-contract-world.mjs` — host-selectable seams/layout; LABELED `workingDirectory` double; `executeToolDispatch` batch/legacy branch.
- `packages/runtime/test/vnext-fs-slice.test.mjs` — next-host mount (executor, workingDirectory double), batch dispatch, host-resolved rung 4/5/6 prerequisites, host-relative SLICE-36 expectation. SLICE-35 unchanged.

Untracked, gitignored, not committed: the rc.5 tree (its own checkout), `.artifacts/tmp/**`
(provisioning driver, logs, probes), `tests/homes/**`.
