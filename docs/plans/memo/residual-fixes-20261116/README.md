# Residual fixes — five defects an independent review found, each with its negative control

**Dated:** 2026-11-18 (real UTC, `date -u`). **Branch:** `task/residual-fixes-20261116`.
**Worktree:** `.worktrees/residual-fixes-20261116`. **Base:** `origin/master` @ `b7276ffa7`
(B3 landed, `48` uncollected).
**Scope:** the five findings of the independent review of the B2/B3 collection rounds, and the
collection of the two suites those rounds had to hold back. **No new infrastructure, no gate
restructure, no unrelated "improvement", no upstream patch** (`CORE PATCH BUDGET = 0`).

**Conclusion first.** All five are repaired at their root, each with a before/after measurement
and a negative control. The two held-back suites are collected **on their own repairs**, not by
weakening an assertion: `dev/ci/uncollected-baseline.json` goes **48 → 46** (regenerated with
`--write-uncollected-baseline`, never hand-edited), and the `tinf-instruments` leg goes 48 → 50
suites. Gate table in §7.

## 1. `scripts/freeze-candidate.mjs` truncated its own report

`process.exit(main(...))` does not wait for the queued tail of a ~21 KB report on a stdout
**pipe**. `--check` writes 174 lines; past the stream's 16 KB high-water mark the writes are
asynchronous, so the last chunk — ending with the `DIGEST` / `CLEAN` / `DRIFT` line every
assertion reads — is dropped: **exit 1 with the verdict line missing**, which is exactly the
hosted red B2 recorded (`exit was 1 but the DIGEST line did not match`, byte-identical input).

- **Before (400 runs, concurrency 200):** `MISSING_DIGEST_LINE 267` / 400. The suite itself,
  120 runs at concurrency 20: **60 red**.
- **After:** `MISSING_DIGEST_LINE 0` / 400; suite **0 red** / 120.
- **Why not "empty stdout":** the first ~16–20 KB always reaches the pipe before the exit, so the
  honest statement is *"the tail is truncated"*. A truncated tail is sufficient and is what the
  suite hit. The dose–response (40 → 96/200, 100 → 174/300, 200 → 265–267/400) is in
  `dev/agent-workflow/evidence/residual-fixes-20261116/f1-*.txt`.
- **Change:** `scripts/freeze-candidate.mjs` — `process.exitCode = main(...)`, plus the closed-reader
  guard below. The test was not touched; the exit code is the value `main` computed.
- **Round 2 (review of #788): the drain traded a silent tail-drop for a false DRIFT code.**
  `--check | head -1` closes the pipe, the next write raises `EPIPE`, an unhandled stream error is an
  uncaught exception → **exit 1** (the documented DRIFT code) with a Node stack trace. Measured
  3/3 before, rc 0 3/3 after (the base commit is not the reference: it exits 0 only because it
  drops the write). `keepSemanticExitCodeOnClosedReader()` swallows `EPIPE`/`ECONNRESET` on stdout
  and stderr and rethrows everything else — a closed reader cannot change a verdict, and a real
  stream error stays fatal. The flush guarantee is intact: 100 pooled runs, 0 missing `CLEAN` and
  0 missing `DIGEST`; the suite 20/20 with a verdict line. See `P0-epipe.md`.

## 2. `PD34-PIN` failed open on absent history

`git cat-file -e <base>:<path>` exits non-zero for two different reasons: the path is absent at a
readable base (the pin), or the **base commit is not in this checkout** (depth-1 / single-branch).
The arm mapped both to `exists = false`.

- **Before (depth-1 clone):** `ℹ pass 8 fail 0` — the pin had proven nothing.
- **After (same clone):** `pass 7 fail 1`, `PD34-PIN INCOMPLETE: the lane base 3101ca08f is not
  readable in this checkout …` .
- **CI shape (depth 0):** `pass 8 fail 0` before and after — the absence assertion is unchanged.
- **Change:** `tests/world-factory/a5sf-pd34-member-stop.test.mjs:183-205` — resolve the base
  commit first (`assert.equal(status, 0)`), then require the path probe to be non-zero.

## 3. The host-refusal guard predicate was a single literal

`CI_HOST_REFUSAL_UNGUARDED` only looked for `A5SF_REQUIRE_PINNED_HOST`, so a `hostFree` leg that
listed `tests/world-factory/m7a-real-slice.test.mjs` (which consults `M7A_REQUIRE_PINNED_HOST`
and refuses identically) produced **no finding**.

- **Vocabulary, derived from the collected paths and listed explicitly** — TWO roles, because a
  host-free leg can be blind in two different ways (`tests/` only missed a switch planted in a
  collected `scripts/` suite; the suffix could not see a host-tree read):
  - `HOST_REFUSAL_REQUIRE_MARKERS` (`*_REQUIRE_PINNED_HOST`): `A5SF_REQUIRE_PINNED_HOST`,
    `M7A_REQUIRE_PINNED_HOST` — absence must be a red, so the leg must carry `env.<marker>="1"`.
  - `HOST_REFUSAL_HOST_TREE_SWITCHES` (`*_HOST_TREE`): `A5SF_PD24_HOST_TREE`,
    `A5SF_PD25_HOST_TREE`, `A5SF_PD31_HOST_TREE`, `M7A_HOST_TREE` — the suite resolves the pinned
    tree itself and silently falls back to it, so **no env value makes it host-free**: it belongs in
    a host-dependent leg, or it is a named exception.
  - Derivation scope = the paths the legs actually collect (`tests/` **and** `scripts/`
    `*.test.mjs`; `tinf-instruments` collects ten `scripts/` suites), through
    `deriveHostRefusalSwitches()`; C10e re-derives with its own scan and refuses a divergence in
    either direction (`CI_HOST_REFUSAL_MARKER_UNLISTED` / `_STALE`). Round 2 measured the two gaps:
    a novel spelling planted in `scripts/dispatch-tests.test.mjs` left C10e green (now
    `CI_HOST_REFUSAL_MARKER_UNLISTED`), and a real `A5SF_PD31_HOST_TREE` suite in a `hostFree` leg
    gave 0 findings (now 1, naming the switch). Controls **C10f** (scripts/ plant; collected-path
    derivation vs a tests/-only one) and **C10g** (host-tree switch; every require marker set still
    refuses; a per-suite waiver admits).
- **Before:** M7A plant → `findings=0`; **after:** `findings=1` naming the marker. A5SF plant:
  1 → 1.
- **Honest-tree fallout, resolved honestly:** the wider predicate named
  `m7a-real-slice-host-state.test.mjs`, which *names* the marker but is not refusal-capable (it
  creates its own empty host and spawns the live suite with an explicit child env to assert both
  sides of the marker). It is declared per-suite rather than weakening the predicate — the
  predicate must stay textual because a5sf suites reach their marker through `lib/`.
- **Change:** `scripts/eb3-ci-required.mjs` (`HOST_REFUSAL_MARKERS`,
  `checkHostRefusalGuard`), one per-suite declaration in `dev/ci/eb3-ci-manifest.json`,
  control **C10e**.

## 4. The exception waiver was leg-wide and never earned

`hostRefusal: "declared-not-run"` sat on the **leg**, so any suite appended to
`a5sf-fs-contract-layer-b` inherited it and `eb3-ci-required` said `pass` (only `test-catalog`
saw the new file).

- **Before:** planted `a5sf-pty-contract.test.mjs` (B3's measured `NOT_RUN` trap) in the excepted
  leg → `findings=0`.
- **After:** → `findings=1` (`CI_HOST_REFUSAL_UNGUARDED` on the planted suite); the legacy string
  → `CI_HOST_REFUSAL_WAIVER_UNSCOPED` **plus** both suites unguarded; the suite **named** in the
  waiver → `findings=0`.
- **Change:** `scripts/eb3-ci-required.mjs` (`hostRefusalWaiver`, `checkHostRefusalGuard`),
  `dev/ci/eb3-ci-manifest.json` (both exceptions rewritten to
  `{mode, suites[], why}`), control **C10d**. Controls 28/28 → 30/30; nothing renumbered.

## 5. `consumer-candidate.test.mjs` compared a live instrument

C10 compared `{view, findings, runtime, topLevel}`. `runtime.dirty_paths` is
`(git status --porcelain).length`, documented as live state that `renderView` does **not** render,
so a sibling suite staging any repo-root `.tmp-*` path between the two builds moves it.

- **Before (leg-shaped runs, 40×):** **10 red**, each `FAIL C10 structure_same=false
  bytes_same=true` — the structure differed only in the instrument the view does not render.
  Also reproduced on the first full-leg run: `tests/s2-authority/consumer-candidate.test.mjs` ✖.
- **After (40×):** **0 red**, `PASS C10 … rendered fields equal; rendered 1748 bytes byte-identical`.
- **Change:** `tests/s2-authority/consumer-candidate.test.mjs:167-190` — compare the rendered
  fields (`view`, `findings`, `topLevel`) and the rendered bytes. The product is untouched.

## 6. Collection — `48 → 46`, −2, both on their own repair

| suite | collected? | why |
| --- | --- | --- |
| `tests/s2-authority/freeze-candidate.test.mjs` | **yes** | host-free (no boot, no port, no DSH_HOME, no pinned tree; only `git` + the manifest) and green under the pool 120/120 after §1 |
| `tests/s2-authority/consumer-candidate.test.mjs` | **yes** | host-free (pure `node`, `git show` of a pinned blob) and green 40/40 leg-shaped after §5 |

Both ride the **existing** `tinf-instruments` leg (48 → 50 suites) — a new leg would be a
permanent `UNCONVERTED` under the M6 parity law (same reason as M7-A/B2/B3). The parity evidence
`dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt` was regenerated **before**
the test was touched: `problems=0`, `missing=none` on every row, `added=` names exactly 44 files,
union `25 → 69`. `dev/ci/uncollected-baseline.json` regenerated: **46**, both paths gone.

## 7. Gates (all measured on this tree)

| gate | result |
| --- | --- |
| `node scripts/test-catalog.mjs --max-uncollected 46` | `refused=0 findings=0`, `UNCOLLECTED 46` |
| `node --test scripts/test-catalog.test.mjs` | `26 pass / 0 fail` |
| `node scripts/dispatch-tests.mjs --check` | `PASS legs=18 bad=0` |
| `node scripts/dispatch-tests.mjs --parity --old-ref e5bf05670` | `DIFFERS steps=18 old_files=25 new_files=69 problems=0` (exit 1 by design) |
| `node scripts/eb3-ci-required.mjs` | `pass workflows=10 findings=0` |
| `node scripts/eb3-ci-negative-controls.mjs` | **32/32** (was 28/28; C10d, C10e, C10f, C10g added, none renumbered) |
| `node scripts/census-plan.test.mjs` | green |
| `node scripts/census-cutover.test.mjs` | green |
| `node scripts/docs-sync.mjs --check` | `findings=0 blocking=0` |
| `node scripts/lint-identities.mjs --diff …0237d487.txt` | `new 0, resolved 0` |
| `git diff --check b7276ffa...HEAD` | clean (commit range; a bare `git diff --check` on a clean tree proves nothing) |
| the collected leg, host ABSENT, 3 consecutive runs | green (telemetry in `dev/agent-workflow/evidence/residual-fixes-20261116/COLLECTION.md`) |

## 8. Explicitly not done / UNKNOWN

- **No** product change (`packages/**` untouched), no new leg, no new workflow, no new Required
  context, no `.github/workflows/` edit.
- **UNKNOWN — the fully-empty stdout variant.** The review described `exit 1` with *empty*
  stdout; I measured only *truncated* stdout (0 bytes never observed; the first 16–20 KB always
  flushed). The mechanism is the same and the suite's assertion fails either way, but the
  "empty" wording is not reproduced.
- **UNKNOWN — the original hosted red's exact head.** `freeze-candidate` failed on
  `49bb277f` and passed on `e0514df18` with a byte-identical dispatch set; the truncation is
  load-dependent, which explains the difference without a per-head claim.
- **Not fixed (out of scope):** the marker predicate is textual (a suite that reaches a marker
  through a `lib/` file is caught, a suite that merely *tests* the marker is a false positive
  requiring a per-suite declaration); `areas[]` legs are still not expanded by the guard.

## 9. Review round 2 (on #788 head `ce642dae2`)

| finding | before | after |
| --- | --- | --- |
| **P0** `| head -1` → EPIPE → exit 1 = false DRIFT + stack | 3/3 rc 1, 1203-byte trace | 3/3 rc 0, no trace; tampered 3/3 rc 1 no trace; 100 pooled runs 0 missing `CLEAN`/`DIGEST` |
| **MEDIUM** vocabulary scope (`tests/` only) and verbs (suffix only) | novel spelling planted in a collected `scripts/` suite: C10e **green**; real `A5SF_PD31_HOST_TREE` suite in a `hostFree` leg: **0 findings** | `CI_HOST_REFUSAL_MARKER_UNLISTED`; **1 finding** naming the switch; C10f + C10g |
| **LOW** the recorded gate was vacuous (clean-tree `git diff --check`) | exit 0 regardless; the range showed trailing whitespace at `f2-pd34-pin-depth1-after.txt:26,28` and a blank EOF line in `gates.txt` | whitespace stripped across the evidence dir; the gate is recorded as `git diff --check b7276ffa...HEAD` |

Evidence: `P0-epipe.md`, `R2-host-refusal-vocabulary.txt` (before/after transcripts, including the
planted-file run that shows the old derivation staying green).
