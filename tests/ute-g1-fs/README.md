# ute-g1-fs — a non-invasive UTE G1 prototype (FS tool family)

This directory is the **prototype + golden vectors** deliverable of UTE G1, slice
G1-S1 (FS). It exists to answer one question with measured evidence:

> Can a new native binding confine FS mutations **on the next host**, through the
> host's own executor and pipeline, without patching upstream and without
> touching the legacy governed path?

It answers **yes for the measured FS effects**, and it says exactly which claims
it does *not* prove (§7).

Nothing in this directory is imported by product code. Nothing here runs in CI.
The legacy pinned host, the legacy census population and the governed route-C
path are untouched; see §6.

---

## 1. Two paths, one corpus

| | old path (the golden baseline) | new path (the prototype) |
|---|---|---|
| host | `tests/deepseek-harness-test-use` — **0.2.0-rc.2 @ `639ed01539`** (pinned legacy) | `tests/deepseek-harness-next` — **0.2.2-rc.5 @ `9c2670d3…`** (pinned next) |
| governance | the **product** route-C seam: `mountMemberA5sfRealm` + `attachA5sfNativeToolModules` (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`), i.e. the P1 `EffectiveIo` ceiling + the confined provider subclass (`packages/runtime/team-services/src/fs.ts`) | `tests/ute-g1-fs/lib/prototype-provider.mjs`: a subclass of the next host's own `LocalFileSystem` that admits paths by a declared lane |
| dispatch | `ctx.tools.execute({'calls':[…]})` on the legacy registry | `executeModelToolFixture` = the next host's own `ToolsService.execute` batch (executor selection + pipeline stages) |
| isolation | host-free world in `mkdtemp` (C1) | fresh `Context` per vector, own scratch dir under `.artifacts/tmp/ute-g1-fs/` |

Both paths are driven by **the same corpus** (`lib/corpus.mjs`) and recorded by
**the same oracle** (`lib/effect-oracle.mjs`), so the two records are comparable
field for field.

The old path is captured **host-free (C1: no boot, no DSH_HOME, no port)**. That
is a deliberate, disclosed trade: the vector is an *effect* record, and a boot
adds transport, not evidence. It is not a claim that a live boot was run.

## 2. Layout

```
capture-old-path.mjs      # (re)capture the golden fixture from the legacy governed path
run-prototype.mjs         # run the corpus on the prototype and grade it against the fixture
negative-controls.mjs     # NC-1..NC-4 family-level + NC-MEMBER <m> per member (see §5)
lane-suite.test.mjs            # node:test wrapper: corpus-vs-golden + the four controls
golden/old-path.tsv       # the reviewed fixture (17 vectors)
golden/old-path.meta.txt  # fixture identity: pins, seam, capture command, limits
golden/COVERAGE.md        # member -> vector ids / NC line map, read_image composition disclosure
lib/corpus.mjs            # the 17 vectors: entry, declared lanes, steps, expected effects
lib/old-path.mjs          # capture on the legacy route-C world
lib/new-path.mjs          # run on the pinned next host
lib/prototype-provider.mjs# the confined FS provider prototype (public base class only)
lib/binding.mjs           # mounts the prototype + native tool-fs on an isolated `fs` scope
lib/host.mjs              # tree-anchored module resolution for the next host (fail-loud)
lib/effect-oracle.mjs     # effect snapshot (existence/bytes/sha256/mode), refusal classes, leak scan
lib/compare.mjs           # the grading rule (what is compared, what is not)
lib/scenario.mjs          # fixture setup + step dispatch + record serialization
lib/lane.mjs              # lane model shared by the provider and the vector checks
```

## 3. The vectors

Normalized record per vector: `id`, `entry` (the native tool name), the declared
`read`/`write` lane tokens (world-relative, never absolute), `outcome`
(`allow`/`deny`), the refusal **class**, the observed **effect** per path
(`present|absent`, bytes, sha256, mode), and the **leak** list.

| id | entry | claim |
|---|---|---|
| `FS-W1-create` | `write` | create inside the write lane → created; the listed mode is the old path's mode, not an invented one |
| `FS-W2-overwrite-read` | `write` | read, then overwrite → new bytes; the read-before-write contract is satisfied |
| `FS-W3-unobserved-overwrite` | `write` | overwrite an existing file that was never read → refused, original bytes intact |
| `FS-W4-outside-write` | `write` | write outside every declared root → refused, no file appears |
| `FS-E1-edit-read` | `edit` | read, then `edit` → edited bytes |
| `FS-E2-stale-edit` | `edit` | read, external rewrite, then `edit` → refused as stale, external bytes intact |
| `FS-W5-write-axis` | `write` | the write lane is narrower than the read lane → a path readable but not writable is refused |
| `FS-S1-symlink-escape` | `write` | a symlink inside the lane pointing outside → refused, target untouched |
| `FS-R1-outside-read-leak` | `read` | read outside the lane → refused, and the secret token never appears in result text |
| `FS-M1-mode-preserved` | `write` | overwriting a `0o600` file keeps the mode |
| `FS-I0-route-c-gap` | `read_image` | the PRODUCT route-C composition cannot reach `read_image` at all (PD-5): refused before any image work, zero attachment bytes |
| `FS-I1-inlane-image` | `read_image` | an in-lane image read commits exactly one attachment; the recorded digest is over the committed bytes and the result shape is one text + one image block |
| `FS-I2-outside-image-denied` | `read_image` | an out-of-lane image is refused; the out-of-lane file is unchanged and zero attachment bytes appear |
| `FS-I3-lane-bound-image` | `read_image` | the read lane is a bound subtree: a path outside every declared read root is refused before bytes or attachment work |
| `FS-I4-missing-image` | `read_image` | a missing target is a typed refusal, not an empty image |
| `FS-I5-route-unresolved` | `read_image` | the image-capability route gate refuses a text-only model before any fs read or attachment write |
| `FS-I6-cancel-before-dispatch` | `read_image` | cancellation is expressible only before dispatch on this path; the image is unchanged and no attachment is created |

Modes are *measured*, not assumed: the old path creates files `0o600`
(atomic-create temp inode) and preserves an existing file's mode on overwrite.

`FS-R1` is a **refusal + no-leak** check, not a read-confinement proof — see §7.

The `read_image` rows carry a synthetic `@result:…` effect entry (marked with
`@`): the committed attachment's byte length + sha256 observed at the store seam
and the model-facing block shape. The six allow/lane/route/cancel image vectors
run under the world factory's `post-gap-1` composition because the product
route-C composition cannot reach `read_image` today (PD-5); `FS-I0-route-c-gap`
pins that product fact. The per-member map and the full disclosure are in
[`golden/COVERAGE.md`](./golden/COVERAGE.md).

## 4. Running it

```bash
# 1. materialize the pinned next host tree (gitignored; fail-loud when absent)
git clone --branch dsh-v0.2.2-rc.5 --depth 1 \
  https://github.com/deepseek-ai/deepseek-harness.git tests/deepseek-harness-next
# install/build per docs/TEST_METHODS.md §11.2 (pnpm@11.28.5, --ignore-scripts), then:
node scripts/provision-host-assets.mjs --from-package --host next \
  --runtime-tree tests/deepseek-harness-next

# 2. the legacy host tree must be present (pinned 0.2.0-rc.2)
ls tests/deepseek-harness-test-use           # gitignored; created by the documented test-runtime setup

# 3. capture / verify the golden fixture on the OLD path
node tests/ute-g1-fs/capture-old-path.mjs            # verify (exit 1 on drift or claim mismatch)
node tests/ute-g1-fs/capture-old-path.mjs --write    # (re)write golden/old-path.tsv

# 4. run the NEW path and grade it
node tests/ute-g1-fs/run-prototype.mjs               # exit 1 on any divergence

# 5. negative controls, one per claim
node tests/ute-g1-fs/negative-controls.mjs

# 6. the lane suite (node:test, no boot, no ports, no DSH_HOME)
node tests/ute-g1-fs/lane-suite.test.mjs
```

Every command prints machine-greppable lines: `OLD-PATH-VECTOR …`,
`NEW-PATH-VECTOR … PASS|FAIL`, `NEW-PATH-DIFF …`, `PROTOTYPE-VERDICT GREEN|RED`,
`NC …`, `NC-VERDICT …`.

Neither host tree is vendored or patched. If the next-host tree is missing or at
a different commit, `assertNextHostTree` throws `NextHostMissingError` naming the
pin and the provisioning step — there is **no legacy fallback by construction**
(control NC-3).

## 5. What the comparison grades — and the four negative controls

Compared (`lib/compare.mjs` `COMPARED_FIELDS`): declared lanes, `outcome`,
refusal **class**, `effects` (existence/bytes/sha256/mode), `leaks`.

**Not** compared: the refusal *code*. The legacy governed path refuses with prose
(`"authored locator '…' is outside every allow subtree of the lane"`,
`"file has not been read — read the file, then retry"`), the next host with typed
`FsError` codes; the closed class vocabulary (`lane-deny`,
`write-requires-read`, `stale-version`, `other`) is what both can satisfy. Codes
are still recorded verbatim in each record.

One measured host difference is worth naming: the prototype refuses lane
violations with `FS_PERMISSION_DENIED`, **not** `FS_SANDBOX_DENIED`, because
rc.5's `tool-fs` assumes `FS_SANDBOX_DENIED` can only come from an `fs-sandbox`
backend with a resolved sandbox policy and dereferences `policy.mode` when it
sees one (`packages/fs/tool-fs/src/sandbox.ts:139-143`; measured crash
`Cannot read properties of undefined (reading 'mode')`). Claiming to be that
backend would be a false capability claim, so this lane provider does not.

**Known semantic differences are printed, not remembered.** `run-prototype.mjs`
prints one `SEMANTIC-DIFF class=… old=… new=… cause=… reason=… blocking=… id=…`
line for each entry in `lib/semantic-differences.mjs` (spec:
`golden/SEMANTIC-DIFFERENCES.md`). The lane suite asserts the lines exist and
match the pinned shape, so a future equivalence run reads the difference instead
of rediscovering it. Today there are two, both retirement-blocking: the lane
refusal code (`FS_SANDBOX_DENIED` → `FS_PERMISSION_DENIED`, caused by the rc.5
`tool-fs` `policy.mode` dereference) and the refusal observation shape (legacy
prose vs typed `FsError` codes).

Negative controls (`negative-controls.mjs`), one per claim:

| id | control | passes when |
|---|---|---|
| `NC-1-lane-bites` | the out-of-lane write is refused for the lane reason | a provider deny fact exists, the target is absent, outcome is `deny`/`lane-deny` |
| `NC-2-harness-bites` | mutate ONE golden cell (created file's sha256) in memory | the comparison goes RED on `effects`; the fixture on disk is unchanged; the unmutated run is GREEN |
| `NC-3-no-fallback` | point the host resolver at a nonexistent tree | `NextHostMissingError` naming `dsh-v0.2.2-rc.5` + `tests/deepseek-harness-next`, never the legacy tree |
| `NC-4-lane-load-bearing` | re-run the SAME refused vector with the refused token added to the write lane | the call succeeds and the file appears (5 bytes) — otherwise NC-1 would not be evidence about the lane |
| `NC-MEMBER read` | widen ONLY the read lane on `FS-R1` | the refusal becomes a result-text leak of the planted secret (the read lane is load-bearing) |
| `NC-MEMBER write` | widen ONLY the write lane on `FS-W4` | the refused out-of-lane file appears (5 bytes) |
| `NC-MEMBER edit` | drop ONLY the edit version guard on a stale-edit vector | the stale edit applies and the external bytes change |
| `NC-MEMBER read_image` | widen ONLY the image read lane on `FS-I2` | the refused out-of-lane image materialises a 70-byte attachment |

Each `NC-MEMBER` is paired with `NC-MEMBER-POSITIVE <member>`, which re-runs the
unmodified vector and proves it still reproduces its golden row (the control is
not vacuous).

## 6. Isolation

* Both host trees live under `tests/` and are gitignored; the prototype reads the
  next tree **through tree-anchored resolution** and asserts the resolved file is
  inside that tree (`lib/host.mjs`), so a Team `node_modules` substitution cannot
  silently hand it the legacy package (a real failure mode found during bring-up).
* The prototype runs in fresh `Context`s with its own scratch directories, no
  boot, no port, no `DSH_HOME`, no shared mutable state with the legacy host.
* `packages/**` and `tests/paths.mjs` are unchanged. Outside
  `tests/ute-g1-fs/**` this PR touches: the `ci-census` "next host lane" wiring
  (one workflow `run:` line + its mirrored manifest leg — the argv edit only
  **adds** this suite to a step that already provisions, boots and runs), the
  `C-NH1` guard in `scripts/eb3-ci-negative-controls.mjs` (its expected argv is
  now derived from the manifest leg instead of a hand-typed copy, so the next
  suite to join the lane needs no edit there), one memo and one evidence
  directory.
* The legacy census population still plans **712 files / 12 roots**
  (`node scripts/census-plan.mjs --plan`); the legacy FS suites produce the same
  result before and after (evidence: identical normative output on a pristine
  `origin/master` worktree and on this branch).
* **The lane suite is collected in the job that already has the host.**
  `lane-suite.test.mjs` is appended to the `ci-census` "next host lane" step
  (`tests/next-host/{boot,native-api,provisioning-controls}.test.mjs` + this
  suite), whose argv is mirrored byte-for-byte in the `ci-census` manifest leg
  (`dev/ci/eb3-ci-manifest.json`). It therefore runs in CI, is counted as
  `DISCOVERED_AND_COLLECTED`, and needs no `excluded-baseline.json` entry and no
  uncollected-ratchet change. A missing/drifted next-host tree makes the whole
  step red (the suite throws at module load), which is the same no-skip law the
  rc.5 lane already follows.

## 7. What this does NOT prove (honest non-coverage)

1. **Read confinement.** The effect oracle records what changed, not what was
   read. A refusal is observable; "no unauthorized `read()` happened" is not.
   `FS-R1` therefore asserts *refused + no token in the model-facing text + file
   bytes unchanged*, and nothing stronger. The golden vectors cover
   write/create/edit/mode effects plus one read *refusal*; they do not certify a
   read boundary.
2. **Delete / move.** The model-facing FS family exposes no delete/move tool, and
   the legacy governed provider does not override `deleteFile`/`moveFile`
   (measured). The prototype guards them, but there is **no old-path vector to
   compare against**, so they are not in the corpus and no equivalence is
   claimed.
3. **Streaming / byte-range / most attachment behaviour.** `read_image` is now
   exercised on the old path (see `golden/COVERAGE.md`), but NOT on the product
   route-C composition in any allow shape (it is dead there: PD-5), and several
   image arms are explicitly not claimed (JPEG/WebP/GIF, downscale, byte cap,
   content sniffing, mid-read cancellation, store failure). `streamText` and
   `readByteRange` are not exercised. The new path (`NEW-PATH-VECTOR` for
   `FS-I*`) is PR B2's scope.
4. **A live boot.** Both paths are host-free C1 runs (see §1).
5. **The production execution path.** This is a prototype. No production traffic
   goes through it, no ToolPlane/Family Body was removed, no product Authority
   changed, and no fork was enabled.
6. **Non-FS families.** Nothing here speaks to shell, network, MCP or sub-agent
   confinement.
