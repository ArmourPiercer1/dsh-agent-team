# Alpha.4 root-suite baseline — honest + reproducible record

Scope of this file: the **root vitest suite** (`vitest run` at the repo root, `vitest.config.ts`,
include `packages/*/test/**/*.test.ts`, node environment, threads pool) captured in this working
tree, its reconciliation against PR #62's recorded debt, the classification of every difference,
and the exact cleanup + proof commands. Nothing here changes any tracked file except files inside
`dev/agent-workflow/evidence/alpha4/baseline/`.

All timestamps UTC. All runs on **Linux 6.18.33.2-microsoft-standard-WSL2 x86_64, node v24.21.0,
npx 11.19.0, vitest 4.1.11, 32 cores** (the harness reports `host=` lines inside every log below).

---

## 1. Commits, commands, artifacts

| capture | HEAD | base-under-test | report | command |
| --- | --- | --- | --- | --- |
| as recorded (this dir, `root-vitest.json`) | `838e7711698441bf401bab178d5f09b6d5aee46e` | `2b86ee423ac23e51b87216d399c5ca93a137c12d` (`root-vitest-head.txt`) | `root-vitest.json` (run start `2026-10-06T19:12:52.486Z`, written 19:13:07.58) | `vitest run --reporter=json --outputFile=dev/agent-workflow/evidence/alpha4/baseline/root-vitest.json` |
| re-captures by this task (5 ×, post-cleanup) | `cb19e0db66bc66000a42b95c344177811ea3a060` | same tree (`2b86ee42` — the delta `2b86ee42..cb19e0db` is docs + `.gitignore` + `AGENTS.md`; the delta `838e7711..cb19e0db` is 3 docs files: `README.md`, `dev/agent-workflow/SESSION_ROUTER_LOG.md`, `docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md` — **no test or source path differs**, so the before/after comparison is code-apples-to-apples) | `root-vitest-postcleanup-1..5.json` | `npx vitest run --reporter=json --outputFile=dev/agent-workflow/evidence/alpha4/baseline/root-vitest-postcleanup-<i>.json` |
| PR #62 recorded debt (comparison baseline, other host) | `4e2d7976` | — | `dev/agent-workflow/evidence/dsh-020rc2-upgrade/logs/root-vitest-head-4e2d7976.log` | captured at `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade` — **also Linux**, not Windows (relevant to group 3 below) |

> HEAD moved during this task (`838e7711` → `cb19e0db`, another writer on the same branch; that
> writer also holds working-tree edits to `dev/agent-workflow/graph.yaml`, the three
> `docs/plans/active/alpha4-permission-governance/*.md` files and
> `dev/agent-workflow/evidence/alpha4-governance-review/REVIEW-ROUND-1.md`). This task made **no**
> tracked-file change and no commit (`git status --porcelain | grep -v '^??'` shows only the other
> writer's files). Docs-only deltas, so the numbers below stay comparable.

Counts (from the JSON reports, `testResults.length` / `numTotalTests` / `numPassedTests` / `numFailedTests`):

| capture | files | failed files | suites | tests | passed | failed | pending |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PR #62 record @ `4e2d7976` | 455 | 9 | — | 5399 | 5380 | **19** | — |
| as recorded @ `838e7711` | 456 | 13 | 1724 | 5383 | 5355 | **28** | 0 |
| **final (post-cleanup, modal of 5 runs)** | **456** | **10** | **1732** | **5418** | **5398** | **20** | 0 |

Reconciliation of the test-count movement:

* `455 → 456` files and `5399 → 5418` tests since PR #62's head: the corpus grew
  (`git diff --name-status 4e2d7976 HEAD -- 'packages/*/test/*'` → **added**
  `packages/runtime/test/rc2-persona-probe.test.ts`, modified `p4t6-session-event-scan`,
  `rc2-kit-fault-injection`, `rc2-kit-preset-seam`, `rc2-sanitize-evidence`, `p6t6-helpers`,
  `rc2-team-deny-least-privilege`).
* `5383 → 5418` between the recorded capture and the final one = **+15 + 20**: exactly the
  `p6t1-delegate` (15 tests) and `p8s6-principal` (20 tests) files that were failing *at collection*
  and therefore contributed zero tests. `a2c7-subtree-matcher` (31) already contributed in both.

---

## 2. Final state (this is what `failing-identities-2b86ee42.txt` now contains)

23 identities = **20 `TEST` + 3 `FILE`** over **10 files**
(= 7 files with named failures + 3 collection-failing files):

```
  9    packages/domain/test/t1-capability-schema.test.ts
  1    packages/domain/test/t2-blueprint-hash.test.ts
  1    packages/runtime/test/d3-member-identity-context.test.ts
  5    packages/runtime/test/p6t3-mediation.test.ts
  2    packages/runtime/test/p6t3-restart.test.ts
  1    packages/testkit/test/rc2-kit-pin-hygiene.test.ts        <- H2, see §4 group 1
  1    packages/tools/test/p6t6-actions.test.ts
  0  COLLECTION-OR-UNHANDLED  packages/runtime/test/p8s3b-result-effects.test.ts
  0  COLLECTION-OR-UNHANDLED  packages/runtime/test/t12a-b2-child-identity.test.ts
  0  COLLECTION-OR-UNHANDLED  packages/runtime/test/t12a-glue-handoff-ports.test.ts
```

Identity diff recorded → final: **10 identities removed, 0 added**
(`diff failing-identities-2b86ee42.as-recorded-838e7711.txt failing-identities-2b86ee42.txt`).

**Against PR #62's own recorded debt (19 tests / 6 files + 3 collection-failing files) the final
state is identical except one identity**: `rc2-kit-pin-hygiene H2`, classified in §4 group 1.
The 19 named failures and the 3 collection errors are byte-identical identities:

```
$ npx vitest run packages/runtime/test/p8s3b-result-effects.test.ts \
    packages/runtime/test/t12a-b2-child-identity.test.ts \
    packages/runtime/test/t12a-glue-handoff-ports.test.ts
 FAIL packages/runtime/test/p8s3b-result-effects.test.ts
   Error: agent-bindings: sessionPersistence.exists public seam is unavailable   (agent-bindings.mjs:888 ← :3859 ← p8s3b-result-effects.test.ts:604)
 FAIL packages/runtime/test/t12a-b2-child-identity.test.ts
   Error: agent-bindings: capability template unresolved for
     'session-team-child-0921004bd8be78e1e76cb9359d5805b4' (reason=template-id-missing
     instanceId=inst-t12ab2member) (code: capability-template-unresolved)        (agent-bindings.mjs:4261 ← … ← t12a-live-bridge.mjs:870)
 FAIL packages/runtime/test/t12a-glue-handoff-ports.test.ts
   TeamContractError: blueprint document must start with a --- frontmatter delimiter line
                                                                                  (domain/blueprint/src/parse.ts:77 ← t12a-live-bridge.mjs:1454)
 Test Files  3 failed (3)      Tests  no tests
```

(full text: `rerun-groups-1-2-known.log` §[3] and `rerun-postcleanup-perfile.log` §[5])

---

## 3. Root cause shared by all three unexplained groups

`packages/testkit/fault-injection/file-seam.mjs:89` defines the per-test scratch base as a
**workspace-internal, gitignored, deterministic** directory:

```
const TEST_TMP_BASE = join(HERE, '..', 'test', '.tmp-fault')   # packages/testkit/test/.tmp-fault/  (.gitignore:51)
export function scratchDir(basename) { ... return join(TEST_TMP_BASE, basename) }   # :455-460
```

Because the basename is fixed (not per-run unique), a stamped world left behind by a **killed or
crashed** vitest process poisons the *next* run at the same path: `createTeamDomain` fails closed
with `TEAM_DOMAIN_EXISTS`
(`packages/storage/repositories/team-domain.ts:276-284`, thrown at `:280`, "schema_meta holds 10
stamp row(s); use openTeamDomain"). The repo documents this hazard and its own remedy in two
suites:

```
packages/runtime/test/rmr-create-or-open-boot.test.ts:217-220
  // Pre-cleanup: the scratch basename is DETERMINISTIC (the testkit
  // contract) — a crashed run would leave a stamped team_domain behind and
  // poison the next run's S1. Destroy the medium BEFORE the first boot.
  destroyDir(scratchDir('rmrcoo-boot'))
packages/runtime/test/f15-mcp-live-loss.test.ts:113-115
  // Pre-create cleanup: a leftover world dir (a crashed previous run) would
  // break createTeamDomain with TEAM_DOMAIN_EXISTS (the p7t7 pattern).
```

The three affected suites do **not** pre-destroy (`p6t1-helpers.ts:357-359` calls
`scratchDir(basename)` then `createTeamDomain(seam)` with no `destroyDir`; `p8s6-principal.test.ts:288`;
`a2c7-subtree-matcher.test.ts:895` via `createP6T4World`) — out of mandate to fix (no tracked-file
modification allowed), so the protocol-compliant action is the cleanup in §5.

**Where the residue came from.** The two leftover worlds were *born before the recorded run
started*:

```
packages/testkit/test/.tmp-fault/p6t1x-d1  birth 2026-10-07 03:12:42.827 +0800 (= 19:12:42.827Z)
    team_domain/schema_meta.json  10 stamp rows, stampedAt 2026-10-06T19:12:42.837Z, all tables EMPTY
packages/testkit/test/.tmp-fault/a2c7-g13  birth 2026-10-07 03:12:42.838 +0800
    10 stamp rows 19:12:42.840Z, team_sessions 1 row, member_instances seeded
recorded vitest startTime                2026-10-06T19:12:52.486Z   (10 s LATER)
```

So they are the remains of an **earlier, interrupted vitest invocation** (killed at ≈19:12:42Z,
10 s before the capture's own run start at 19:12:52Z, `root-vitest-head.txt` "capture started
19:12:32Z" = the wrapper start), not committed state and not a shared default path. It is not
committed state: `.gitignore:51 packages/testkit/test/.tmp-fault/`; committed fixture stores live in
a different, never-written place (`file-seam.mjs:91 FIXTURES_BASE = packages/testkit/fault-injection/fixtures`).
It *is* a **shared default** in the weaker sense that the path is the same on every run of every
worktree of this tree, which is exactly why leftovers carry across runs.

**Controlled reproduction (causal, not correlational)** — `reproduce-residue-cause.log`:
copy a stamped-but-unrelated world (`a3p1-tenth-idempotent`, 10 stamp rows) onto the deterministic
path, run, then remove:

```
R1 plant at .tmp-fault/p6t1x-d1  → FAIL p6t1-delegate [collection]
   TeamDomainError: team_domain already exists (schema_meta holds 10 stamp row(s)); use openTeamDomain
   ❯ createTeamDomain packages/storage/repositories/team-domain.ts:280
   ❯ createP6T1World  packages/runtime/test/p6t1-helpers.ts:359
   ❯ packages/runtime/test/p6t1-delegate.test.ts:67          Tests  no tests
R2 plant at .tmp-fault/a2c7-g13  → Tests 8 failed | 23 passed (31), all
   "TypeError: Cannot read properties of undefined (reading 'decisionKind')"
   → identities byte-identical to the recorded ones:
     diff scratch-cleanup/recorded-a2c7-identities.txt scratch-cleanup/r2-reproduced-identities.txt  → no output
R3 remove both planted dirs      → ✓ p6t1-delegate (15) ✓ a2c7-subtree-matcher (31)  Tests 46 passed (46)
```

R2 also shows the self-perpetuating step: `# residue after the poisoned run: a2c7-g13` — every
failing run re-creates the residue that fails the next run.

---

## 4. Per-group verdict

### Group 1 — `packages/testkit/test/rc2-kit-pin-hygiene.test.ts` (1 failure, H2): **environment-residue, NOT fixed by the `.probe-coldstore` removal; cannot be made green in this tree without a code change**

*Premise check.* The ENOENT that the removal of `tests/dsh-homes/.probe-coldstore` was meant to
clear is gone, but H2 still fails. It now fails in **two distinct modes**, both caused by
`sourcesUnder` (`rc2-kit-pin-hygiene.test.ts:29-38`) walking **gitignored trees** with
`statSync` and no gitignore awareness (its skip list is `node_modules`, `dist`,
`.tmp-faultscratch` — note: the real scratch base is `.tmp-fault`, so it does not match).

Mode A — the scan completes and the assertion fires (deterministic, 3/3 isolated runs):

```
$ npx vitest run packages/testkit/test/rc2-kit-pin-hygiene.test.ts     # 3× isolated, post-cleanup
 × only tests/paths.mjs assigns the baseline constants 3730ms / 3700ms / 3635ms
   AssertionError: expected [ …(954) ] to deeply equal []
 Tests  1 failed | 6 passed (7)
```

Proof of the 954 (`rerun-postcleanup-perfile.log` §[1]; the scan re-implemented read-only in
node): `scanned files=21306 offenders=954`, **all 954 under `tests/homes/`**, from
**53 distinct worlds × 18 `.mjs` files**, e.g.
`tests/homes/rs-017rc1-2026-09-25T14-01-31/.xdg/pnpm/store/v11/tmp/_tmp_49_…/dev/agent-workflow/evidence/G8-REVIEW/reviewer-1/harness/boot-g8.mjs`.
Those are historical **snapshots of this repo's own tree** carried inside old spill worlds from the
0.1.7-rc.1 era, and their evidence harnesses predate the single-declaration-site rule. 0 offenders
outside `tests/homes/` (`offenders NOT under tests/homes: []`).
`tests/homes/` is gitignored (`.gitignore:15`). PR #62's log was captured in
`.worktrees/dsh-020rc2-upgrade`, whose `tests/homes/` was empty — which is exactly why
`✓ packages/testkit/test/rc2-kit-pin-hygiene.test.ts (7 tests)` there and not here.
⇒ Verdict: **environment-residue** (worlds retained as evidence) + a scanner-scope defect.

Mode B — `statSync` hits an entry that vanished mid-walk (ENOENT). Two sub-causes, both cleaned or
characterised here:
 * 53 **dead symlinks** inside those same worlds (`…/upstream-resolver.mjs →
   /home/user/dsh-plugins/dsh-agent-team/.worktrees/a2c-1/…`, a worktree that no longer exists) —
   deleted in this task (§5 A); `find tests packages … -xtype l | wc -l` is now **0**.
 * live scratch churn: in a full-suite run other workers create/destroy `.tmp-fault/<x>` while this
   scanner walks `packages/` → ENOENT in **3 of 5** full runs (`p8s7r2-msb/team_domain/ledger.json.undefined.20.tmp`,
   `p8s5b-r5c-10-0`, `p5t4-cold`). The same defect in the sibling scanner
   `rc2-kit-preset-seam.test.ts:73-82` (`walkSources`, same skip list, called at `:264` over
   `packages/`) produced a *new* identity in 2 of 5 runs (§6).

*Why not just delete the worlds:* `tests/homes/rs-017rc1-2026-09-25T14-01-31` and
`rs-017rc1-2026-09-25T14-07-04` **are referenced by tracked evidence** (`git grep -l` →
`dev/agent-workflow/evidence/dsh-017rc1-upgrade/review-supplement/real-host-smoke.md`,
`…/smoke-run4.log`, `dev/agent-workflow/evidence/restart-017rc1/commit4/world-A-run6/boot-2/browser-driver/01c-dialog-stuck.txt`),
and TEST_METHODS §7 allows a temp world to survive teardown precisely when it is registered as
evidence. So they fail the task's "prove it is unreferenced" precondition, and deleting them would
destroy retained evidence. The minimal *compliant* fix is therefore a **code** change (scope the
two scanners to tracked sources, or skip `tests/homes`, `.tmp-fault` and unreadable/dangling
entries with `lstat`/`try`), which this task is not allowed to make. Practical workaround for a
clean baseline: run the suite in a **fresh worktree** where `tests/homes/` is empty.

### Group 2 — `p6t1-delegate.test.ts`, `p8s6-principal.test.ts` (collection-time `TEAM_DOMAIN_EXISTS`): **environment-residue → fixed-by-cleanup**

* **Which path they stamp into.** Both go through the testkit file seam at a fixed basename under
  `packages/testkit/test/.tmp-fault/`:
  `p6t1-delegate.test.ts:67` → `createP6T1World('p6t1x-d1')` →
  `p6t1-helpers.ts:357-359` `scratchDir(basename)` + `createTeamDomain(seam)`;
  `p8s6-principal.test.ts:288` `scratchDir('p8s6-principal')` → `applyWorld(...)` → the production
  create path (its catch at `:530-533` prefixes the message with `C3 principal world failing:`).
  Neither pre-destroys. Traced via the imported helper, since neither file names a path.
* **What kind of state.** gitignored residue from an interrupted earlier run — **not** committed
  state (`git check-ignore -v` → `.gitignore:51 packages/testkit/test/.tmp-fault/`), **not** a
  committed fixture (those live under `packages/testkit/fault-injection/fixtures`, untouched), and
  it is a *deterministic shared* path, i.e. the hazard this repo documents at
  `rmr-create-or-open-boot.test.ts:217-220`. Birth times + `stampedAt 19:12:42Z` predate the
  recorded run's `startTime 19:12:52Z` (§3).
* **Minimal, protocol-compliant cleanup.** §7 governs `tests/homes/**` DSH_HOME worlds; the same
  discipline applies to the testkit scratch base (`file-seam.mjs:88` "cleaned by the tests' finally
  blocks", §7's "delete at teardown; if retained, register in evidence"). Deleting **exactly the
  two implicated scratch dirs** (nothing else) is the minimal action; it is impact-traceable in
  `scratch-cleanup/tmp-fault-before.txt` (content + stamp times) and
  `scratch-cleanup/cleanup-log.txt` §B (ignore status + removal). No other `.tmp-fault` leftovers
  were touched: the remaining 34 (`a3p1-*`, `mtm-*`, `f15-*`, `rmrcoo-boot`) belong to suites that
  `destroyDir` before first boot, so they self-heal — that asymmetry is *why only these two files
  failed*.
* **Re-run proof.** `rerun-postcleanup-perfile.log` §[2]:
  `✓ p6t1-delegate.test.ts (15 tests)  ✓ p8s6-principal.test.ts (20 tests)  Test Files 2 passed (2)  Tests 35 passed (35)`
  and both files stay green in all 5 full runs (`failing-identities-postcleanup-*.txt` contain no
  line for either).
* Why `p8s6-principal`'s dir was already gone when investigated: its error path deletes the scratch
  dir it just failed on (`p8s6-principal.test.ts:530-533`), i.e. it consumed its own residue during
  the recorded run; that is also why it passed in the pre-cleanup run `rerun-groups-1-2-known.log`
  §[2a] while `p6t1-delegate` still failed.

### Group 3 — `packages/runtime/test/a2c7-subtree-matcher.test.ts` (8 failures incl. `TypeError … 'decisionKind'` at `:1610`): **environment-residue / fixed-by-cleanup — not (a) pre-existing code, not (b) POSIX-vs-Windows**

* **Determinism first (pre-cleanup).** Two independent runs, same result:
  `rerun-a2c7-determinism.log` — RUN 1 `Tests 8 failed | 23 passed (31)` (19:17:37→19:17:45Z),
  RUN 2 `Tests 8 failed | 23 passed (31)` (19:17:45→19:17:53Z); identical 8 identities, matching the
  recorded ones.
* **Mechanism.** The whole fake-backend capture section is wrapped in a swallowing catch
  (`a2c7-subtree-matcher.test.ts:1019-1021`: `} catch (error) { fake.error = … }`), and `fake.error`
  is **never asserted**. The first scratch-poisoned call
  (`:895` `fakeEnv('a2c7-g13', …)` → `createP6T4World` → `createTeamDomain` → `TEAM_DOMAIN_EXISTS`)
  aborts every later capture, so `FLOWS.g13DenyWins` and all `g15*` / `g16*` keys are `undefined` —
  which surfaces as 8 secondary `TypeError: Cannot read properties of undefined (reading
  'decisionKind')` at `:1610`, `:1656`, `:1669`, `:1680`, `:1669/1690` etc., never as the root cause.
* **Refutes (b) environment-dependence.** The comparison record came from **Linux** too
  (`RUN v4.1.11 /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade`,
  `✓ packages/runtime/test/a2c7-subtree-matcher.test.ts (31 tests) 10ms`), so no OS hypothesis is
  needed. Independently, the OS-sensitive lanes in this very file — G7 `..` traversal, G8 the
  case-variant lane (the file documents "Linux host: the case-SENSITIVE local backend is the
  backend-semantic equivalent"), G9 symlink-alias identity, G10 junction retarget, and the real
  pinned `FileSystem.contains()` section — are all in the **23 passing** on this Linux host, before
  and after cleanup. Nothing in the failure set is separator/case/canonicalisation-dependent; the
  8 failures are the *absence of captured data*.
* **Refutes (a) pre-existing code failure and confirms (c) caused by this tree.** Controlled
  reproduction R2/R3 (§3): planting a stamped world at `.tmp-fault/a2c7-g13` reproduces the 8
  identities byte-for-byte; deleting it gives `31 passed`, twice isolated
  (`rerun-postcleanup-perfile.log` §[3]) and in all 5 full runs.
* **Nothing was fixed here** — only the gitignored scratch was removed (the same minimal cleanup as
  group 2, which is what the task authorised for residue).

---

## 5. The exact cleanup performed (all gitignored; all impact-traced)

`scratch-cleanup/cleanup-log.txt` is the authoritative log; `scratch-cleanup/tmp-fault-before.txt`
snapshots the deleted worlds' contents.

A. **53 dead symlinks** under `tests/homes/**` (each named `upstream-resolver.mjs`, all targets
   `…/.worktrees/a2c-1/packages/runtime/src/plugin/upstream-resolver.mjs`, target worktree absent).
   Proven unreferenced: no tracked file mentions `pnpm/store/v11/tmp` or the `_tmp_49_…` dirs
   (`git grep` empty); the worlds themselves were **kept** (some are evidence-registered), only the
   dead links were removed.

   ```
   git check-ignore -v tests/homes            → .gitignore:15:tests/homes/
   find tests packages -name node_modules -prune -o -name dist -prune -o \
        -name .tmp-faultscratch -prune -o -xtype l -print | wc -l   → 53 before, 0 after
   while read -r l; do rm -f "$l"; done < scratch-cleanup/dangling-symlinks-before.txt   → deleted=53
   ```
   (list + targets archived: `scratch-cleanup/dangling-symlinks-before.txt`,
   `scratch-cleanup/dangling-symlinks-targets.txt`)

B. **2 poisoned deterministic scratch worlds** (the group-2 / group-3 residue):

   ```
   git check-ignore -v packages/testkit/test/.tmp-fault/p6t1x-d1  → .gitignore:51
   git check-ignore -v packages/testkit/test/.tmp-fault/a2c7-g13  → .gitignore:51
   rm -rf packages/testkit/test/.tmp-fault/p6t1x-d1 packages/testkit/test/.tmp-fault/a2c7-g13
   ```

C. **Dirs planted by my own controlled reproduction** (`§3` R1/R2) — created and removed inside this
   task; `reproduce-residue-cause.log` shows `residue after R3: (none)` and `none after clean`.

Not deleted: the 34 self-healing `.tmp-fault` leftovers; the `tests/homes` worlds (evidence-
registered / out of mandate); anything under `references/` (absent in this environment anyway) or
`tests/deepseek-harness-test-use` (untouched — the suite only reads its prebuilt libs);
`tests/dsh-homes/.probe-coldstore` was already removed by the parent before this task started.

---

## 6. Reproducibility: the identity set is *not* fully deterministic (measured)

Five consecutive full root-suite runs at the same tree (`rerun-postcleanup-root-suite.log`,
`failing-identities-postcleanup-1..5.txt`), post-cleanup:

| run | start (UTC) | failed tests | failed files | identity md5 | extra identities beyond the modal set |
| --- | --- | --- | --- | --- | --- |
| 1 | 19:23:12 | 21 | 11 | `9392a83d…` | `rc2-kit-preset-seam P6` (ENOENT `.tmp-fault/f1-t3`) |
| 2 | 19:23:29 | **20** | **10** | `3958f763…` | — (**modal**, recorded as final state) |
| 3 | 19:24:23 | 22 | 11 | `3f266d71…` | `p6t1-parallel P1` ×2 (`expected 1 to be +0` at `p6t1-parallel.test.ts:154`, `expected 1 to be 2` at `:167`) |
| 4 | 19:24:46 | 21 | 11 | `9392a83d…` | `rc2-kit-preset-seam P6` (ENOENT `.tmp-fault/a3p4-2w04eq`) |
| 5 | 19:25:08 | **20** | **10** | `3958f763…` | — |

Two unstable classes, both **additive** (they never mask a stable identity):

1. **Scratch-walk ENOENT race** in the two whole-tree hygiene scanners (`rc2-kit-pin-hygiene`
   `sourcesUnder`, `rc2-kit-preset-seam:73-82` `walkSources`) against concurrent scratch churn —
   3/5 runs for H2 (masking its 954-offender assertion, see group 1 Mode B) and 2/5 for P6.
2. **`packages/runtime/test/p6t1-parallel.test.ts` P1** (2 tests) — a real flake: it also failed
   1 of 3 **isolated** runs (`rerun-postcleanup-perfile.log` §[4]: pass, pass, `2 failed | 7 passed`),
   so it is not load-induced. Not root-caused here (out of mandate).

Good news measured in the same logs: **a completed run leaves no new scratch residue**
(`ls .tmp-fault` after runs 1 and 2 identical to the post-cleanup listing — no `p6t1x-*` /
`a2c7-*`), so the recorded poisoning cannot recur from a *completed* run; only an interrupted one
re-creates it.

**Recommended pre-run protocol** (documented here rather than enforced): before a root-suite
baseline capture, `rm -rf packages/testkit/test/.tmp-fault/` and capture the identity set **twice**;
treat an identity as debt only if it appears in both, or run from a fresh worktree with an empty
`tests/homes/`.

---

## 7. Is "no new failing identity" mechanically checkable from these files? Yes — with one caveat

Checkable now, mechanically, with no judgement calls:

```
# 1. normalise a report into the identity list (repo root as cwd, or pass it explicitly)
node dev/agent-workflow/evidence/alpha4/baseline/fail-set-normalize.mjs <report.json> > got.txt
# 2. compare against the pinned set
diff -u dev/agent-workflow/evidence/alpha4/baseline/failing-identities-2b86ee42.txt got.txt
# exit 0 → identical; lines starting '>' → NEW identities (regression); '<' → retired identities
```

`fail-set-normalize.mjs` is checked in **inside this evidence dir** (not `scripts/`, which is tracked)
and it is *proved* compatible with the pinned format: `node fail-set-normalize.mjs root-vitest.json
--check failing-identities-2b86ee42.as-recorded-838e7711.txt` →
`MATCH: normalizer output is byte-identical … (33 identities)`, i.e. it regenerates the parent's
recorded file from `root-vitest.json` byte-for-byte.

**Caveat (must be stated wherever the check is used):** because of §6, a *single* run can add an
identity that is not a code regression (2 of 5 runs here). So "no new failing identity" is only
mechanically meaningful for a run whose identity set is compared against a set derived the same way,
either (i) as an intersection/allowlist of two consecutive runs, or (ii) after the §6 pre-run
protocol. The check never *hides* a stable debt: the two flake classes are additive-only.

### What a future `scripts/fail-set.mjs` must reproduce to stay compatible

1. **Line format** — exactly two shapes, no padding, no counts on the identity lines:
   `TEST <relpath>::<vitest fullName>` and `FILE <relpath>::COLLECTION-OR-UNHANDLED`.
2. **`<relpath>`** — report `name` (absolute) minus the repo-root prefix, POSIX separators
   (convert `\` → `/` so a Windows-captured report compares equal to a Linux one). Repo root =
   explicit arg, else cwd when every `name` lives under it, else longest common prefix. **Do not**
   use "longest common prefix" as the first choice: with all 456 files under `packages/` it strips
   `packages/` and silently breaks the comparison (this task's normalizer hit exactly that).
3. **`<vitest fullName>`** — copy `assertionResults[].fullName` **verbatim** (= `ancestorTitles`
   joined with one space + `' '` + `title`). Never re-derive it: `fullName` is already
   `"T1: Blueprint Capability Schema 1. Legacy fixture …"`, and a describe/test rename must show up
   as a *changed identity*, which is what makes the set meaningful.
4. **FILE rule** — emit a FILE line when the file-level `message` is non-empty **or** the file has
   zero `assertionResults` while `status !== 'passed'`; a file may emit FILE *and* TEST lines; a
   file with passing tests and console noise must **not** emit one (vitest leaves `message` empty
   there).
5. **Ordering / dedupe** — unique lines, byte-sorted over the whole line (`FILE ` < `TEST `; digit
   titles sort lexicographically: `1.` < `10.` < `11b.` < `2.`). Pin with `LC_ALL=C` semantics.
6. **Single input, no judgement** — derived only from the JSON report: no re-runs, no timestamps, no
   host/OS field, no counts inside the identity file (counts belong to
   `<…>.summary.txt`, which this normalizer emits as its stderr summary — see
   `failing-identities-2b86ee42.summary.txt` for the expected shape, header lines prefixed `#`).
7. **Known-flaky allowance (new, required)** — support an allowlist of *unstable* identities
   (§6: the two hygiene-scanner ENOENT races and `p6t1-parallel` P1) reported separately from the
   debt set, so the gate is "no new identity outside the allowlist, and every allowlisted identity
   must have been seen in ≥2 of N runs before it is promoted to debt".
8. **Compatibility test** — keep a `--check` mode that reproduces a pinned identity file
   byte-for-byte. Note the evidence hygiene rule `.gitignore:65
   dev/agent-workflow/evidence/**/root-vitest*.json`: **the JSON reports in this directory are
   gitignored and will not survive a fresh clone**, so the check-in test must either ship a small
   synthetic report fixture (a few `testResults` covering a passing file, a file with named
   failures, a collection-only file, and a file with console noise but passing tests) or read the
   pinned identity list only. In this working tree the two real fixtures
   (`root-vitest.json` → the 33-line recorded set, `root-vitest-postcleanup-2.json` → the 23-line
   final set) both reproduce byte-identically today:
   `node fail-set-normalize.mjs <report> --check <pinned>` → `MATCH … (33 identities)` /
   `MATCH … (23 identities)`.

---

## 8. Files in this directory

| file | role |
| --- | --- |
| `BASELINE.md` | this record |
| `root-vitest.json`, `root-vitest.log`, `root-vitest-head.txt` | as-recorded capture (unchanged) |
| `failing-identities-2b86ee42.txt` | **updated** final identity set (23 identities; modal of runs 2 & 5) |
| `failing-identities-2b86ee42.summary.txt` | per-file counts + suite totals for the final set |
| `failing-identities-2b86ee42.as-recorded-838e7711.txt` (+ `.summary.txt`) | the parent's recorded set, archived verbatim before the update |
| `fail-set-normalize.mjs` | the normalizer (rules §7; byte-identical reproduction of both pinned sets) |
| `root-vitest-postcleanup-1..5.json`, `failing-identities-postcleanup-1..5.txt` | the five post-cleanup full runs (§6) |
| `rerun-groups-1-2-known.log` | pre-cleanup per-file proofs: group 1 still red, group 2 reproduction, 3 known collection errors verbatim |
| `rerun-a2c7-determinism.log` | group 3 determinism (2 runs, 8 failed / 23 passed both) |
| `rerun-postcleanup-root-suite.log`, `rerun-postcleanup-perfile.log` | post-cleanup full runs and isolated per-file proofs |
| `reproduce-residue-cause.log` | controlled causal reproduction (plant → exact recorded failure → remove → green) |
| `scratch-cleanup/` | cleanup evidence: dangling-link lists, `.tmp-fault` before-state, cleanup log, R2 full output + identity comparison |

Committability: `.gitignore:65 dev/agent-workflow/evidence/**/root-vitest*.json` keeps the five
multi-MB JSON reports (and the recorded one) **out of git by design**; every `.md`/`.txt`/`.mjs`/
`.log` artifact above is not ignored (`git check-ignore -v` verified per class), so the identity
lists, summaries, logs, normalizer and this record are what a commit can carry.

## 9. Not determined / out of mandate

1. **Which process left the 19:12:42Z residue.** Only birth times survive (`19:12:42.827/.838`) and
   the killed invocation left no log in this dir; `root-vitest-head.txt` shows the wrapper started at
   19:12:32Z, so the interrupted run is almost certainly the first attempt of the same capture — but
   no artifact proves who signalled it.
2. **Root cause of the `p6t1-parallel` P1 flake** (2 tests, 1/3 isolated runs) — observed,
   measured, not diagnosed (diagnosis/fix out of mandate for this task).
3. **Group 1 cannot be made green by cleanup alone.** Its 954 offenders are inside retained
   evidence worlds; the fix is a code-level scoping change in two scanners, which this task was not
   allowed to make. Until then H2 is expected red in this tree (assertion) or red with ENOENT in a
   full run.
4. **The 19 named debt failures and the 3 collection errors** were confirmed to be the *same*
   identities as PR #62's record (and the same error text for the collection trio) but were not
   root-caused here — they are the accepted PR #62 debt, not part of this task's question.
5. **Whether other suites carry the same pre-destroy gap.** The audit here covers the observed
   residue set; a full sweep of every `scratchDir(...)`/`createP6T*World` call site for a missing
   `destroyDir` (grep shows ~140 fixed-basename call sites) was not performed.
