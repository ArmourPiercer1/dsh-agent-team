# F3 — the host-refusal guard predicate was a single literal

**Dated:** 2026-11-18 (real UTC, `date -u`). **Branch:** `task/residual-fixes-20261116`.
**Files:** `scripts/eb3-ci-required.mjs` (`HOST_REFUSAL_MARKERS`, `checkHostRefusalGuard`),
`dev/ci/eb3-ci-manifest.json` (one new per-suite declaration, no env change),
`scripts/eb3-ci-negative-controls.mjs` (C10e).

**Defect in one sentence.** `CI_HOST_REFUSAL_UNGUARDED` only looked for
`A5SF_REQUIRE_PINNED_HOST`, so a `hostFree` leg that listed
`tests/world-factory/m7a-real-slice.test.mjs` — which consults `M7A_REQUIRE_PINNED_HOST` and
refuses an absent pinned host exactly the same way — produced **no finding**.

## 1. The marker set, derived from the repo

```
$ git grep -hoE '[A-Z][A-Z0-9_]*REQUIRE_PINNED_HOST' -- tests | sort | uniq -c
     22 A5SF_REQUIRE_PINNED_HOST
     11 M7A_REQUIRE_PINNED_HOST
```

| marker | suites / libs that consult it |
| --- | --- |
| `A5SF_REQUIRE_PINNED_HOST` | `a5sf-fs-contract`, `a5sf-pty-contract`, `a5sf-sub-contract`, `a5sf-web-contract` (through `lib/a5sf-pty-contract-world.mjs`, `lib/a5sf-web-contract-world.mjs`) |
| `M7A_REQUIRE_PINNED_HOST` | `m7a-real-slice`, `m7a-real-slice-host-state` (exercises the marker), `lib/m7a-step-verdict.mjs` |

That is the whole set; it is listed explicitly in `HOST_REFUSAL_MARKERS`, and **C10e derives
it again** and refuses a divergence in either direction
(`CI_HOST_REFUSAL_MARKER_UNLISTED` for a new spelling, `CI_HOST_REFUSAL_MARKER_STALE` for an
entry nothing consults). The predicate is per-suite **per marker**: every marker a suite names
must be set to `1` on that leg (or the suite must be named in the per-suite waiver), so one
flag cannot buy another.

## 2. Before / after (`f3-markers-before.txt` / `f3-markers-after.txt`)

Probe (`.artifacts/tmp/probe-markers.mjs`): add the suite to `a5sf-product-assembly` — a
`hostFree` leg that declares no `env` and no `hostRefusal` — and ask the real guard.

```
# BEFORE  (single literal)
markers exported: "A5SF_REQUIRE_PINNED_HOST"
planted m7a-real-slice.test.mjs (M7A marker):      findings=0 []      <-- THE DEFECT
planted a5sf-pty-contract.test.mjs (A5SF marker):  findings=1 ["CI_HOST_REFUSAL_UNGUARDED"]

# AFTER   (HOST_REFUSAL_MARKERS)
markers exported: ["A5SF_REQUIRE_PINNED_HOST","M7A_REQUIRE_PINNED_HOST"]
planted m7a-real-slice.test.mjs (M7A marker):      findings=1 ["CI_HOST_REFUSAL_UNGUARDED"]
planted a5sf-pty-contract.test.mjs (A5SF marker):  findings=1 ["CI_HOST_REFUSAL_UNGUARDED"]
```

## 3. The honest tree after the generalisation — one new finding, resolved by a declaration

The wider predicate immediately named a real suite:
`tests/world-factory/m7a-real-slice-host-state.test.mjs`, in the `tinf-instruments` leg.

```
$ node scripts/eb3-ci-required.mjs      # before the declaration
  CI_HOST_REFUSAL_UNGUARDED layer ci-integration is hostFree but leg "test catalog + TINF instruments …"
  lists tests/world-factory/m7a-real-slice-host-state.test.mjs … (it consults M7A_REQUIRE_PINNED_HOST)
EB3-CI-REQUIRED fail workflows=10 findings=1
```

That suite **names** the marker but is **not refusal-capable**: it always runs its own body
(it creates its own empty host directory and spawns the live M7-A suite twice with an
*explicit* child env, asserting refusal at `M7A_REQUIRE_PINNED_HOST=''` and
`M7A-REAL-SLICE-HOST-INCOMPLETE` at `'1'`). It cannot turn an absent host into its own
`verdict=NOT_RUN`, so no env can guard it, and setting `M7A_REQUIRE_PINNED_HOST=1` on that leg
would be a false claim about a suite that provisions nothing. The honest resolution is the
per-suite declaration F4 introduced (the predicate must stay a *text* predicate — a5sf suites
reach their marker through `lib/`, not through their own source):

```json
"hostRefusal": { "mode": "declared-not-run",
                 "suites": ["tests/world-factory/m7a-real-slice-host-state.test.mjs"],
                 "why": "… names the marker as the thing under test; it never refuses …" }
```

After it: `EB3-CI-REQUIRED pass workflows=10 findings=0` (`f3-honest-tree.txt`), and the
controls `30/30`.

## 4. Negative control

**C10e** (`scripts/eb3-ci-negative-controls.mjs`, existing controls untouched, none
renumbered): the derived-set equality, each marker planted in a hostFree leg with no env,
"every *other* marker set ⇒ still refused", "that marker set ⇒ admitted", and the real
`m7a-real-slice.test.mjs` plant naming `M7A_REQUIRE_PINNED_HOST`. Controls `29/29` → `30/30`.
The B3 `declared-not-run` exception keeps working: C10c and C10d still pass unchanged.
