# 7.8 — the committed install surface was stale: attribution, and why nothing saw it

Base for this lane: `origin/master` = `f0485b15f5be2a3afc8834c4f148bf951dce20aa` (fetched,
verified with `git rev-parse origin/master` before any work). Worktree
`.worktrees/a4-dist-rebase`, branch `feat/a4-dist-rebase`. No push.

## 1. The measurement, before any commit

`pnpm build` (exit 0, 6.07 s warm) then `git status --porcelain`: **exactly 20 tracked
files drift, all under `packages/runtime/dist`.** A second build produced byte-identical
output (`git hash-object` equal on all 20), so the drift set and the bytes are both
deterministic. `pnpm build:composition`'s two writing steps (`place-dist-glue.mjs` 0.04 s,
`build-client-composition.mjs` 0.08 s) changed **nothing**: the composed
`packages/client/composition-shim/` is byte-identical at this commit. So the stale surface
is exactly these 20 files, and nothing else in either install surface.

Deriving the emitting source from the dist path (`dist/packages/<pkg>/…/<mod>.{js,d.ts,map}`
→ `<…>/<mod>.ts`) groups the 20 into **two** groups, each produced by exactly one merged
commit:

| group | dist files (count) | emitting source files | dist last built | source last changed | merged as | dist in that commit |
| --- | --- | --- | --- | --- | --- | --- |
| A — §E.2 grammar version-agnostic | 15 = 5 × (`.js`, `.js.map`, `.d.ts.map`) | `packages/runtime/activation/provider.ts`, `packages/runtime/admission/requirement-gate.ts`, `packages/runtime/compatibility/blueprint.ts`, `packages/runtime/requirements/creation-preflight.ts`, `packages/runtime/requirements/scope-requirements.ts` | `4f07e2da` 2026-09-29 (`compatibility/blueprint`), `2b0aef87` / `e28dfef3` / `60b6b16a` / `26994b97` 2026-10-01 (the other four) | `3b253775` 2026-10-08 | PR **#161**, merge `e80a00da` 2026-10-08 08:48 | **0 files** |
| B — the version bridge closed | 5 = `schema.js`, `schema.js.map`, `schema.d.ts.map`, `types.d.ts`, `types.d.ts.map` | `packages/domain/blueprint/src/schema.ts`, `packages/domain/blueprint/src/types.ts` | `81fc680d` 2026-10-07 (`schema.*`), `b3c6e849` 2026-10-07 (`types.*`) | `8f2ce74f` 2026-10-08 | PR **#172**, merge `f0485b15` 2026-10-08 10:49 (= this lane's base) | **0 files** |

Attribution method, so this is verification and not a guess: for each drifted dist file,
`git log -1 --format=%h -- <dist>` vs `git log -1 --format=%h -- <emitting .ts>`, then
`git merge-base --is-ancestor` — all 20 say *source newer than dist*. Then
`git show --name-only <commit> | grep -c packages/runtime/dist` = **0** for both commits
(`grep -c` exits 1 on a true zero; the zero is the finding, not a command failure). The
rebuilt content matches the two source diffs one-for-one — no third cause exists, because a
pure build reproduces the surface exactly and produced no other change.

Group B is the §7.3 flip lane's own 5 files (`8f2ce74f` is the content commit under this
base's merge); group A is **not** its fault. `#161` landed 10 days of dist staleness
two hours before the flip merged, and the flip's rebuild therefore drifted 20 files of
which only 5 were its own — which is what it reported, and why it reverted `dist` rather
than sweep another lane's unbuilt work into its PR.

## 2. What the stale surface actually said after the flip

The flip narrowed the accepted document versions. The shipped artifact did not follow:

```
committed dist  packages/domain/blueprint/src/schema.js  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [1, 2, 3]
HEAD source     packages/domain/blueprint/src/schema.ts  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]

committed dist  packages/domain/blueprint/src/types.d.ts  readonly schemaVersion: 1 | 2 | 3
HEAD source     packages/domain/blueprint/src/types.ts    readonly schemaVersion: 3
```

and the requirements plane shipped still gated on the retired digit — five sites, one per
module, all absent from source and all absent after the rebuild:

```
git grep -n "blueprint.schemaVersion === 2" HEAD -- packages/runtime/dist
  .../activation/provider.js:623
  .../admission/requirement-gate.js:240
  .../compatibility/blueprint.js:72
  .../requirements/creation-preflight.js:118
  .../requirements/scope-requirements.js:77
grep -rn "blueprint.schemaVersion === 2" packages/runtime/dist/   (after rebuild)   -> 0 hits
git grep -n "blueprint.schemaVersion === 2" HEAD -- '*.ts'        -> only test comments
```

Semantics of the combination, stated because it is the reason this is not cosmetics: a
git-install consumer (`pnpm dsh plugin add github:…`, which runs no build at install time —
the whole reason these artifacts are committed) received a **v3-only validator wired to a
v2-gated §E.2 requirements plane**. A v3 blueprint parses, and every per-template
requirement scope is silently skipped, because `scopeRequirementInputsOf`,
`evaluateAllScopes`, `evaluateCreationScopes` and the activation provider only enter the
template scopes under `schemaVersion === 2`, and `compatibilityRequirementsOf` only reads
`teamRequirements` under it. Zero requirement failures is the failure. Nothing in the test
suite can see this: see §4.

## 3. Why no check saw it — three instruments, each innocent, each blind

* **`pnpm check:artifacts`** (`scripts/check-artifacts-committed.mjs`) compares the working
  tree against the **git index** (`git ls-files -s` + `git hash-object`). A checkout whose
  `dist` was never rebuilt has working == index, so it cannot distinguish "fresh and
  committed" from "never built". Measured at base, tree clean:
  `[check-artifacts-committed] OK: 1508 files; committed install-surface artifacts match
  the fresh build (incl. 1 glue placement(s))`, **exit 0** — a sentence no build supported.
  (`logs/base-check-artifacts-on-stale-tree.txt`.) Its arms A/B/C/D and its non-emptiness
  guard are all correct for the job it does: catching a rebuild that was not `git add`ed.
  Run *after* a rebuild it is sharp — measured in the drifted-but-unstaged state: exit 1,
  20 `C content-drift` lines.
* **`a4p7-merge-gate.test.ts`** spawns that same script, so it inherits the blindness:
  **26/26 green at base**, its install-surface leg reporting `passed` with `why:
  OK: 1508 files`. That leg is not weak; it is answering "did you build and stage", and the
  answer was yes-to-nothing.
* **The v3 fence** (`verify-blueprint-version-clean.mjs`) **excludes `dist/`** from its scan
  scope by design (build output). Measured: 0 occurrences of `packages/runtime/dist` in its
  whole output, at base and after. It cannot see the shipped surface at all.
* **ESLint** ignores it too — the gate's own census line says so:
  `1320 are hidden by an ignore pattern (… packages/runtime/dist/ 753 …)`.

So the property "HEAD's install surface is HEAD's build" was asserted by nothing that could
observe it. This is the gap the mechanism commit (`e75e1821`) closes.

## 4. Is any suite passing against an artifact that lied? Measured: no suite — and that is the finding

The 416 files under `packages/{runtime,domain,legacy,storage,contracts}/test` import from
`src`, not from `dist`. The five drifted modules are reachable from the suite only as
source. Rebuilding the surface changed **zero** test outcomes: base and after are identical
at 5043 registered legs, with the same 18 titled failures in 5 files and the same 3
collection-error files, `RESOLVED 0`; the only movement in either direction was the already
-disclosed `p6t1-parallel` load-flake group (details in `BATTERY.md`).

Read that as a measurement and not as reassurance: **20 files of the shipped product could
be two merged commits behind source, changing the behaviour of the requirement gates, and
not one test in the repository changed colour.** The suites that do read the built surface
(`persona-kind-shipped-dist-smoke`, `p8s5a-host-loadability`, `team-skills`,
`pbf-default-artifact-urls`, `a3p5/a4p3 lane-hygiene`, `a4-artifacts-nonempty`,
`a4p7-shipped-composition-blueprint`) read `src/plugin/host.js`, the lane *layout*, or
`cordis.patch.yml` — none of them reads any of the five drifted modules. Nothing was
"fixed" here and no suite was touched; the gap is structural, and the leg added in
`e75e1821` is the response.

## 5. Reproduce

```
git worktree add .worktrees/a4-dist-rebase -b feat/a4-dist-rebase origin/master
pnpm install --store-dir <repo>/.pnpm-store          # un-piped; default store is read-only here
pnpm build && git status --porcelain                # 20 M under packages/runtime/dist
node scripts/check-artifacts-committed.mjs          # OK: 1508 files   exit 0   <- the lie
node scripts/check-artifacts-at-head.mjs --rev f0485b15   # exit 1, 20 paths  <- the same fact, caught
```
