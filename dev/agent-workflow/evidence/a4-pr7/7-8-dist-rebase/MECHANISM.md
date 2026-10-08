# 7.8 — the freshness mechanism: three shapes priced, one implemented

## The gap, as a property

`scripts/check-artifacts-committed.mjs` compares **working tree vs git index**. Therefore:

* a tree that never rebuilt → working == index → **green** (measured: `OK: 1508 files`,
  exit 0 at `f0485b15`, over 20 stale files);
* a tree that rebuilt and staged → green; a tree that rebuilt and did not stage → red.

So the instrument fires on *the act of building in this working tree*, i.e. it is a check on
someone's memory, and the merge gate's install-surface leg inherits exactly that scope
(it spawns the same script and greps its `OK: N files` line). The property that actually
matters to a `pnpm dsh plugin add github:…` consumer is different: **HEAD's committed
surface is HEAD's build.** No instrument in the tree could observe it — and the two
instruments that could plausibly have caught a symptom are out of scope by design: the v3
fence excludes `dist/` (0 mentions of it in its output), ESLint ignores it (753 of 2428
tracked lintable files hidden under `packages/runtime/dist/`).

## The three candidate shapes, priced

Prices are measured on this box (warm pnpm store, two other agents sharing the machine).

### 1. Rebuild into a scratch directory and compare there — **IMPLEMENTED** (`e75e1821`)

`scripts/check-artifacts-at-head.mjs [--rev <git-rev>] [--store-dir <path>] [--keep]`:
`git worktree add --detach <repo>/.tmp-artifact-at-head-<pid>-<ts> <rev>` → `pnpm install
--frozen-lockfile` → `pnpm build` → `place-dist-glue.mjs` → `build-client-composition.mjs` →
`check-artifacts-committed.mjs`, run *inside the scratch*, its exit code and text relayed.
`--rev` defaults to `HEAD`, so inside the suite it reviews the commit under review.

Priced **twice at each commit**, so the machine load is visible instead of averaged
away (`logs/pricing-*.txt`); the two runs of one column are the same command minutes apart
on a box with two other lanes building on it.

| step | `f0485b15` run 1 | `f0485b15` run 2 | rebuild commit run 1 | rebuild commit run 2 |
| --- | --- | --- | --- | --- |
| `git worktree add` | 1.05 | 1.90 | 0.97 | 1.74 |
| `pnpm install --frozen-lockfile` | 3.72 | 5.73 | 4.16 | 5.49 |
| `pnpm build` | 7.94 | 11.46 | 7.38 | 11.16 |
| glue + client composition | 0.20 | 0.44 | 0.31 | 0.35 |
| the check itself | 0.11 | 0.20 | 0.13 | 0.21 |
| **total** | **13.0 s** | **19.7 s** | **12.95 s** | **18.9 s** |
| verdict | **exit 1**, names all 20 paths | **exit 1**, 20 paths | **exit 0**, `OK: 1508 files` | **exit 0**, `OK: 1508 files` |

Provenance of the four columns, stated because two of them have no artifact file: run 2's
timings and check output are in `logs/pricing-*-run2-*.txt`; run 1's numbers were read from
the same commands' stdout in-session (the run-1 scratch was deleted by the runner, which
cleans up by design). Run 2 was measured precisely so that no figure in this table rests
only on a transcript.

The price to quote a reviewer is therefore **"install + build, once more"**: 13 s on a quiet
box, ~19 s with three lanes on it, and the invariant part is exactly one lockfile install
plus one `pnpm build`. Inside the suite the leg measured 12.1 s and 12.3 s
(`a4p7-merge-gate` 26 → 27 legs); whole-gate wall time is not quotable on this box at all —
three comparable runs of that file measured 41.6 s, 70.0 s and 62.2 s.

Two design constraints fell out of measurement, not taste:

* **Why a worktree under the repo root and not `/tmp`:** tsc bakes the outDir→rootDir
  relationship into every `.js.map` / `.d.ts.map`. Built at a different relative path the
  maps differ byte-wise and the check reports drift that is the harness's own artifact. In a
  worktree at the same relative depth the layout matches, `git` and ESLint ignore it, and the
  byte comparison is valid. Two independent builds were byte-identical (all 20 blob hashes
  equal), which is what licenses comparing bytes at all.
* **Why the store is discovered and probed:** this harness's default pnpm store is read-only;
  the script reads the store actually used from `node_modules/.modules.yaml`, checks it for
  `W_OK`, and prints `NOT-RUN` naming it rather than a pnpm stack trace. Measured exit 3.

**What it can still miss:** uncommitted local work (by design — the subject is a commit); a
committed `dist` file that a build no longer emits and `tsc` left on disk (the existing
check's own documented "known narrow gap" — dead weight, not drift); a published tarball that
diverges from the repo it came from; the eight non-shipping packages (only
`packages/runtime/dist` and `packages/client/composition-shim` ship, and those are the two
surfaces `INSTALL_SURFACES` names); and any future emitter that makes output non-deterministic
today's byte-identity would then break, loudly rather than silently.

### 2. Compare a content hash of source-derived output instead of the tree — **priced, rejected**

To compare "the output the source implies" you must produce the output: `tsc` is the only
thing that knows what `packages/runtime/tsconfig.build.json` emits (its `include` list plus
transitive emission — which is precisely why `packages/domain/blueprint/src/schema.js` lives
in the runtime surface at all). So a "hash of source-derived output" is either (a) the build
again, in which case it is option 1 with an extra manifest to keep honest, or (b) a hash of
the *inputs* recorded in the repo — and that recorded hash is itself an artifact that must be
co-committed with every build, i.e. **the same failure mode one level down**, with nothing
checking it. A manifest nothing rebuilds rots exactly like a `dist` nothing rebuilds: 20 files
behind, printed as `OK`. Wall time if implemented as (a): identical to option 1 plus the
manifest update; as (b): ~0 s, and it cannot close the hole. Rejected on those grounds, not
on effort.

### 3. A CI ordering rule ("build, then check, before anything else runs") — **unavailable at this price**

The idea costs nothing to state and is the textbook fix: in CI, `pnpm install && pnpm build &&
pnpm build:composition && pnpm check:artifacts` with index == HEAD makes the existing check
suddenly sound, because working tree = a real build and index = the commit. Measured
obstacle: **this repository has no CI for this surface.** The only workflow is
`.github/workflows/characterization.yml`, and its steps are checkout, install *upstream*,
`pnpm run build` **in the upstream test-use tree**, and `node tests/characterization/run.mjs`.
It never builds this repo's install surface and never invokes `check:artifacts`. Adding a
workflow is not "one commit you can defend in this lane" (it is a new enforcement surface
with its own runner assumptions), and Alpha.4's chosen enforcement point is the suite —
which is exactly why `7-6-merge-gate` exists and why it cites `verify-zero-core.mjs`. A CI
rule also has the same residual as option 1's list above, and the same store precondition.

### 4. The honest fallback the question offers — and why it is not the answer here

"If this cannot be cheaply automated and the real control is a release-time rebuild, say
that." The cheap automation *is* available: 13.0 s, the reviewed instrument, no new
comparison semantics. A release-time-only rule was therefore not chosen as the primary
control. It remains **necessary and not sufficient**: a git-install consumer installs a
*commit*, so a pre-publish `pnpm setup && pnpm run check:artifacts` at the tag catches only
what option 1 already catches earlier and for free, plus the tarball-vs-repo case option 1
explicitly cannot see. The recommendation is both: the leg in the suite, and a release-time
rebuild recorded in the release receipt.

## Why the leg is wired and not merely shipped

The gate's own file states the rule this obeys: `verify-zero-core.mjs` is the named precedent
of "a script that exists and is invoked by nothing". So `check-artifacts-at-head.mjs` is
reachable as `pnpm check:artifacts:head` and spawned by a `runLeg(` in
`a4p7-merge-gate.test.ts`, and it is registered in that gate's `instruments` list — the list
its wiring leg asserts against. The leg keeps the gate's three-state doctrine: it never keys
on an exit code, it distinguishes `failed` (the commit owes its own rebuild) from `refused`
(no scratch, install or build failed) against captured text, and green comes only from stdout.

## Teeth, measured end to end — not asserted

A throwaway branch reproduced the exact shape `#161` landed: a **comment-only change to
`packages/runtime/requirements/scope-requirements.ts`, committed with no rebuilt `dist`**
(`8b16500b`, since deleted; the lane branch never carried it and `git status` is clean).
Running both install-surface legs against it:

```
 ✓ the committed install surface is fresh against the tree, and a missing surface is refused  108ms
 × the commit carries its own build, judged in a scratch worktree — the question the working tree cannot ask  12279ms
 AssertionError: check:artifacts:head did not pass. why: the commit does not carry its own
 build; the rebuild it owes: … HEAD does NOT carry its own build — the 3 listed path(s) …
   C content-drift (git add): packages/runtime/dist/packages/runtime/requirements/scope-requirements.d.ts.map
   C content-drift (git add): packages/runtime/dist/packages/runtime/requirements/scope-requirements.js
   C content-drift (git add): packages/runtime/dist/packages/runtime/requirements/scope-requirements.js.map
 Tests  1 failed | 1 passed | 25 skipped (27)
```

The pre-existing leg passed on the very commit the new leg refused — the two questions,
distinguished in one run, on the same tree. Full capture: `logs/teeth-probe.txt`.
