# UTE G1-S1 (FS) — non-invasive prototype + golden vectors (2026-11-19)

**Dated:** 2026-11-19 (session calendar). **PR:** #792 (draft, base `master`). **Branch:** `task/ute-g1-fs-20261119`
(worktree `.worktrees/ute-g1-fs-20261119`, base `origin/master`
`00429852cc9c9284fd6817da57503bac9501bc9d`).
**Design input:** the UTE memo on PR #765 draft head `c97420fd…`
(`docs/plans/memo/ute-prep-20261116/`, slices G1-S1…S5 + scope fence).
**Owner ruling applied:** G1 may start; new public API / binding / executor
prototypes are allowed **only** as additive, isolated, coexisting paths. Replacing
the governed production execution path, deleting ToolPlane / Family Body, changing
product Authority, or enabling a fork remain out of scope.
**CORE PATCH BUDGET = 0.** No upstream file was modified in either host tree; no
private path was imported; no `CORE_SEAM_BLOCKER` arose (one upstream sharp edge is
recorded in §6, and the prototype routes around it without patching).

**Deliverable:** one additive PR — `tests/ute-g1-fs/**` plus this memo and
`dev/agent-workflow/evidence/ute-g1-fs-20261119/**`. `git diff --stat
origin/master` touches **nothing else**.

---

## 1. What G1-S1 now has (measured)

| claim | evidence |
|---|---|
| A new native FS binding runs **on the pinned next host** (`0.2.2-rc.5 @ 9c2670d3…`) through the host's own executor+pipeline | `new-path-run.txt` — 10/10 vectors; `PROTOTYPE-HOST … version=0.2.2-rc.5`; dispatch is `executeModelToolFixture` = `ToolsService.execute` |
| It reaches a **real confined FS effect** (real files, real modes, real bytes) through the host's `LocalFileSystem`, not a mock of the seam | same file: `inside/created.txt|present|14|f5c770…|0o600`, edited/overwritten sha256s, `0o600` preservation |
| The **old path** produces comparable (request → effect) pairs | `old-path-capture.txt` + `tests/ute-g1-fs/golden/old-path.tsv` — 10 vectors captured on legacy `0.2.0-rc.2 @ 639ed01539` through the **product** route-C seam (`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`) |
| The **comparison harness** grades the new adapter against those pairs and bites | `new-path-run.txt` `PROTOTYPE-VERDICT GREEN vectors=10 failed=0`; NC-2 mutates one golden cell → RED |
| **One honest negative control per claim** | `negative-controls.txt` — NC-1 lane bites (deny fact + target absent), NC-2 harness bites (mutated sha → RED), NC-3 no fallback (typed `NextHostMissingError`, never names the legacy tree), NC-4 lane is load-bearing (same call, widened lane → 5-byte file appears) |
| **Isolation** | `isolation.txt` — the only changes outside `tests/ute-g1-fs/**` are the `ci-census` next-host lane wiring (one workflow `run:` line + its mirrored manifest leg, which **adds** this suite to a step that already provisions and boots rc.5), one memo and one evidence directory; legacy pin block / `packages/**` / `scripts/**` untouched; census still **712 files / 12 roots**; legacy FS suite verdicts identical on pristine `origin/master` and on the branch; testkit suite has the **same 13 pre-existing** failures on both |
| Next-host lane still green with the prototype present | `next-lane.txt` — 6/6, boot on port 13000, pinned native assets verified |

### Prototype surface (new files + exported symbols)

```
tests/ute-g1-fs/lib/prototype-provider.mjs
  makeConfinedFileSystemClass(Base, { lane, FsError, record, label }) -> class
  PROTOTYPE_GUARD_TABLE
  REFUSAL_AXES
tests/ute-g1-fs/lib/binding.mjs
  installNativeFsBinding({ ctx, lane, host, cwd, record })
    -> { iso, provider, providerClass, fibers }
tests/ute-g1-fs/lib/host.mjs
  treeResolve(tree, spec) / treeImport(tree, spec) / loadHostSurface() / hostIdentity()
tests/ute-g1-fs/lib/lane.mjs
  normalizeRoots / declaredLane / withinRoot / withinAny / REFUSAL
tests/ute-g1-fs/lib/effect-oracle.mjs
  codesOf / classifyRefusal / snapshotPath / snapshotAll / effectsCell /
  parseEffectsCell / findLeaks
tests/ute-g1-fs/lib/scenario.mjs
  worldPath / resolveLane / makeWorldDirs / applySetup / materializeArgs /
  runSteps / makeRecord / recordToRow / rowToRecord / ROW_HEADER
tests/ute-g1-fs/lib/compare.mjs
  COMPARED_FIELDS / fieldValue / compareRecord / compareAll /
  serializeGolden / parseGolden / checkDesignClaim
tests/ute-g1-fs/lib/corpus.mjs
  CORPUS (10 vectors) / SECRET_TOKEN / UNREAD_TOKEN
tests/ute-g1-fs/lib/old-path.mjs
  OLD_PATH_IDENTITY / captureVector / captureCorpus
tests/ute-g1-fs/lib/new-path.mjs
  SCRATCH_ROOT / runVector / runCorpus
tests/ute-g1-fs/{capture-old-path,run-prototype,negative-controls,lane-suite}.mjs
```

The prototype imports **only public entries** of the pinned next host:
`@deepseek-ai/cordis`, `dsh-agent-loop-testkit`, `dsh-tool-testkit`,
`dsh-fs`, `dsh-fs-local`, `dsh-fs-observation-policy`, `dsh-tool-fs`,
`dsh-session`. It subclasses the host's exported `LocalFileSystem` and is mounted
on a `ctx.isolate('fs')` scope.

## 2. What G1-S1 still lacks

1. **A live booted run of the prototype.** Both sides of the comparison are C1
   host-free runs (deliberate — see §4). The next-host lane boots the host, but
   not with the prototype mounted as a real agent composition.
2. **Read-confinement proof.** The oracle records effects, not reads. `FS-R1`
   pins a refusal + no secret token in result text + unchanged bytes, and that is
   the strongest honest claim available from effects. See §5.
3. **Delete / move equivalence.** The model-facing FS family exposes no
   delete/move tool, and the legacy governed provider does not override
   `deleteFile`/`moveFile` (measured). The prototype guards both, but there is no
   old-path vector to grade them against — so they are **not** claimed equivalent.
4. **Streaming / byte-range / `read_image`.** Not exercised.
5. **The G1-S2 (shell) and later slices.** Untouched.
6. **A production wiring decision.** Nothing here decides where a future binding
   mounts in the real composition, nor whether the prototype provider should
   become an `fs-sandbox`-shaped backend (§6).

## 3. Gate table (all re-run on the rebased head; verbatim in `evidence/gates.txt`)

| gate | result |
|---|---|
| `node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7` | `tests=877 DISCOVERED_AND_COLLECTED 822 EXCLUDED_WITH_REASON 14 UNCOLLECTED 41`, `refused=0 findings=0` |
| `node --test scripts/test-catalog.test.mjs` | 28 pass / 0 fail |
| `node scripts/dispatch-tests.mjs --check` | `PASS legs=18 bad=0` |
| `node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670` | `DIFFERS steps=18 old_files=25 new_files=69 problems=0` — the union changed (Task B's three rc.5 suites + this one); no argv problem |
| `node scripts/eb3-ci-required.mjs` | `pass workflows=10 findings=0` — its leg-argument rules accept the 4-file lane argv because they compare against the manifest, not a literal |
| `node scripts/eb3-ci-negative-controls.mjs` | `33/33 control(s) behaved as required` — including the redesigned C-NH1 (derives the expected argv from the manifest leg; workflow-drop / manifest-drop / reorder RED, honest GREEN, derivation vacuity RED) |
| `node scripts/docs-sync.mjs --check` | `findings=0 blocking=0 contracts=20` |
| `node scripts/lint-identities.mjs --diff <a4 baseline>` | 76 distinct, `new 0 resolved 0` |
| `git diff --check` | clean |
| `node tests/ute-g1-fs/capture-old-path.mjs` | 10 vectors, fixture identical, 0 claim mismatches |
| `node tests/ute-g1-fs/run-prototype.mjs` | `GREEN vectors=10 failed=0` + two `SEMANTIC-DIFF` lines |
| `node tests/ute-g1-fs/negative-controls.mjs` | `GREEN controls=4 failed=0` |
| `node tests/ute-g1-fs/lane-suite.test.mjs` | 3/3 pass (corpus + semantic-difference shape + negative controls) |
| the CI step itself, verbatim (`node --test --test-force-exit --test-timeout=1500000 --test-reporter=spec tests/next-host/{boot,native-api,provisioning-controls}.test.mjs tests/ute-g1-fs/lane-suite.test.mjs`) | **22/22 pass** (real rc.5 boot on 13000, A1–A6, provisioning controls, this suite) |
| legacy FS suites (`a5sf-fs-contract`, `a5sf-pd17-fs-read-axis`) | before = after: 34 pass / 1 skip, identical verdicts |
| `packages/testkit` vitest suite | 13 failed / 499 passed — **identical failure set** on pristine `origin/master` (pre-existing environment red, not caused by this branch) |

**Collection wiring (the reviewer's condition).** `lane-suite.test.mjs` is a real
`*.test.mjs` appended to the `ci-census` "next host lane" step — the job that
already materializes the rc.5 tree, installs the pinned assets and boots the host
(Task B, `4fc703d0a`). The workflow `run:` line and the mirrored
`dev/ci/eb3-ci-manifest.json` leg carry the byte-identical argv
(`dispatch-tests --check` enforces it), the catalog classifies the suite
`DISCOVERED_AND_COLLECTED`, and a missing/drifted tree makes the step red
(module-load throw). No `excluded-baseline.json` entry and no
uncollected-ratchet change was needed (`UNCOLLECTED` stays 41).

## 4. Design decisions (and why)

* **Old path = the product route-C seam, captured host-free.** The governed
  production path for FS is `mountMemberA5sfRealm` + `attachA5sfNativeToolModules`
  on the legacy host; that is what the golden vectors measure. Capturing it
  host-free (C1) makes the baseline cheap and deterministic, and the vector is an
  effect record — a boot would add transport, not evidence. It is **not** a claim
  that a live boot was run (§2.1).
* **New path = prototype provider + the host's real executor.** The prototype
  subclasses the host's exported `LocalFileSystem` and is mounted on an isolated
  `fs` scope; the native `tool-fs` module is mounted on top; the invocation goes
  through `executeModelToolFixture`, i.e. `ToolsService.execute` with executor
  selection and the real pipeline stages. Nothing about the host's dispatch is
  re-implemented.
* **Refusal CLASSES, not codes.** The legacy route-C path refuses with prose; the
  next host with typed `FsError` codes. The closed class vocabulary
  (`lane-deny`, `write-requires-read`, `stale-version`, `other`) is the strongest
  common contract; codes are recorded verbatim in every record but never a pass
  condition. Lane-axis classes collapse to `lane-deny` because *which* guard fires
  first may legitimately differ between host generations.
* **Tree-anchored resolution.** The first bring-up silently resolved
  `@deepseek-ai/dsh-tool-fs` to the **legacy** package through a Team
  `node_modules` link. `lib/host.mjs` now resolves from the pinned tree with
  `createRequire`, then asserts the resolved file is inside that tree. NC-3 pins
  the fail-loud behaviour.
* **Effects normalized to world-relative tokens.** No absolute paths, mtimes or
  pids in a record, so the fixture is reviewable and machine-independent.

## 5. What the golden vectors do NOT cover

Mirrored in `tests/ute-g1-fs/README.md` §7 and `golden/old-path.meta.txt`:

* **Read confinement is unprovable from an effect snapshot.** A refusal is
  observable; "no unauthorized `read()` happened" is not. The corpus therefore
  covers write/create/edit/mode effects and one read *refusal* with an explicit
  content-leak check — not a certified read boundary.
* Delete/move (no model-facing tool, no legacy guard to measure), streaming,
  byte-range, `read_image`.
* A live boot of the prototype.
* The production execution path, product Authority, ToolPlane / Family Body, and
  every non-FS family (shell, network, MCP, sub-agents).

## 6. Findings the owner should see

1. **rc.5 `tool-fs` assumes `FS_SANDBOX_DENIED` ⇒ an `fs-sandbox` backend with a
   resolved policy.** `packages/fs/tool-fs/src/sandbox.ts:139-143`
   (`mapError`) dereferences `policy.mode` whenever an `FsError` with that code
   escapes. A lane-only provider that raises it crashes the write tool with
   `Cannot read properties of undefined (reading 'mode')` (measured). The
   prototype therefore raises `FS_PERMISSION_DENIED` for lane refusals. This is a
   real design constraint on any future "lane provider" that is not the
   `fs-sandbox` backend: either speak its protocol (declare `sandboxMode`, mount
   `sandbox-policy`) or use a non-sandbox code. It is **recorded as a
   retirement-blocking limitation, not memo prose**: `tests/ute-g1-fs/golden/
   SEMANTIC-DIFFERENCES.md` (KNOWN-SEMANTIC-DIFFERENCE 1–2), the machine list in
   `lib/semantic-differences.mjs`, a `SEMANTIC-DIFF class=refusal-code
   old=FS_SANDBOX_DENIED new=FS_PERMISSION_DENIED cause=upstream-deref
   reason=not-a-patch blocking=yes` line printed by `run-prototype.mjs` on every
   run, and an assertion in `lane-suite.test.mjs` that the lines exist and keep
   their shape. A difference the harness cannot print is not recorded.
2. **The FS family needs no ToolPlane / Family Body machinery at this seam.** The
   prototype reaches a governed, confined effect entirely through the public
   `ToolsService` + a provider subclass + the observation policy. That is
   evidence for the UTE thesis that a native binding can sit *beside* the
   governed path — and it is also the reason this PR stays additive: promoting it
   would be the separate, owner-ruled step.
3. **`write` is not observation-only on either path**: an unobserved overwrite is
   refused *before* the provider (`write-requires-read`), and a stale edit is
   refused by the tool/observation contract, not by `FS_STALE_VERSION` on the
   legacy side. The old and new paths agree on the *effect*; they disagree on the
   *typed reason*. Any future equivalence oracle must compare classes, exactly as
   this harness does.
4. **Mode is a real part of the contract**: created files are `0o600` on both
   paths, preserved file modes survive overwrite. A future provider that drops
   the create-temp-inode dance would diverge here.
5. **#790's C-NH1 guard was a second copy of the truth, and this branch had to
   fix the copy, not the teeth.** It pinned the three next-host `run:` lines as
   literals; appending this suite to the lane made the literal stale and the
   hosted run refused (correctly — workflow and manifest had diverged from the
   guard's copy). The redesign in `scripts/eb3-ci-negative-controls.mjs` derives
   the expected argv from the `ci-census` leg's `cmd[] + check[]` and compares it
   to the workflow's `run:` line as one byte-identical string, so a future suite
   joining the lane needs no edit here. Teeth are kept and extended: workflow
   drops a file → RED naming it; manifest `check[]` drops a file → RED naming it;
   argv reordered → RED ("same tokens in a DIFFERENT order"); honest state →
   GREEN; nonexistent leg → the derivation itself RED (vacuity arm). Evidence:
   `guard-c-nh1.txt`.

## 7. UNKNOWNs

* Whether a live booted prototype (mounted in a real agent composition) behaves
  identically — untested.
* Whether `deleteFile` / `moveFile` behave equivalently — no old-path vector.
* Whether the prototype's `resolve()`-unguarded choice matches production
  expectations for non-existent targets — `resolve()` is unguarded by design
  (the lane check happens on the resolved path), and the corpus covers the
  effects but not every path shape.
* Whether the rc.5 `mapError` assumption is fixed in a later host generation.
* Whether the owner wants the prototype provider to adopt `sandboxMode` +
  `sandbox-policy` and speak the `[sandbox: …]` protocol — this is the
  retirement-blocking decision recorded as `KNOWN-SEMANTIC-DIFFERENCE 1`.
* Whether a future equivalence oracle will compare refusal codes directly; the
  corpus compares classes by design (`KNOWN-SEMANTIC-DIFFERENCE 2`), and the
  harness now prints both differences on every run so the decision cannot be
  made by memory.

## 8. Reproduction

`tests/ute-g1-fs/README.md` §4 is the runbook (host provisioning, capture,
prototype run, controls, lane suite). Every command in §3 above is echoed in
`dev/agent-workflow/evidence/ute-g1-fs-20261119/gates.txt` with its verbatim
output.
