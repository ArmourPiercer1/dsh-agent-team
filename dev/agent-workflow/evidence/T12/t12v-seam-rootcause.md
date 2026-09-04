# T12-V5 — seam-import blocker: full root cause + the 7-junction packages-level bridge

Date: 2026-09-03 (post run #7; commit `5a2bbe1` T12-V5)
Status: bridge applied per integrator directive; smoke + full 8-phase run re-verifying.

## 1. The claimed failure

`Cannot find package '@deepseek-ai/dsh-storage-domain' from seam.mjs` — a fresh-world
module-resolution failure of the team row's dynamic seam, reported as a blocker for the
T12 vertical slice.

## 2. Root cause (mechanism)

The row's production code is loaded in the DSH host process as **dynamic modules**
(`seamUrl` + production `glueUrl`, plain `.mjs`, no bundler). Every bare specifier
(`@deepseek-ai/*`, `zod`) inside them is resolved by the standard Node upward `node_modules`
walk from the **importing file's own location** — unless the DSH upstream-resolver hook
(`module.register`) intercepts the specifier first.

Two facts make a fresh world fail:

1. **The hook covers a fixed, narrow set.** Its discovery only redirects packages linked
   under `apps/cli/node_modules` of the *host tree* (parent `apps/cli/lib` activation).
   `dsh-storage-domain` and `zod` are **not** in that set, and — measured in this repo with
   an instrumented hook — in a fresh test world the discovery itself computes **null**
   (double-candidate off-by-one), so the hook is a silent pass-through no-op. There is no
   interception to save the walk.

2. **The worktree has no `node_modules` to walk to.** In a fresh worktree/clone there is
   no `node_modules` anywhere under the worktree, so the upward walk from
   `packages/runtime/root-binding/harness/seam.mjs` and
   `packages/runtime/src/plugin/live/agent-bindings.mjs` resolves `@deepseek-ai/*` and
   `zod` to **nothing** → `ERR_MODULE_NOT_FOUND` (`Cannot find package '@deepseek-ai/dsh-storage-domain'`).

Why it was never visible before T12: P8-era worktrees carried **stale**
`packages/runtime/node_modules` symlinks from the old layout, which happened to satisfy the
walk. The legacy `run.mjs` inherited that accident. A fresh worktree has none.

## 3. Machine verification: the T12 state never had this failure

Before applying the directive's fix, I verified the T12 state exhaustively:

- The runner's env setup already creates an **idempotent 5-junction bridge**
  (`packages/runtime/node_modules/@deepseek-ai/{dsh-agent,dsh-llm,dsh-mcp-client,dsh-session,dsh-storage-domain}`
  + `zod`) pointing into the test-use pnpm hoist
  (`references/deepseek-harness-test-use/node_modules/.pnpm/node_modules/...`), verified at
  the start of every run (log line `runtime node_modules links verified`).
- **Zero** occurrences of `Cannot find package` / `ERR_MODULE_NOT_FOUND` / any
  `@deepseek-ai/*` resolution error in **all 7** T12 run logs.
- All 7 runs: every world booted `row ready — toolCount=10` with
  `rowMounted={"dsh-agent-team":true,"p6t6-team-tools":true}`.

So the seam-import error was **not reproducible in the T12-V state** at the time of the
blocker message; the runtime-level bridge already neutralized it. (If the error was observed
elsewhere — a fresh clone *without* the runner's link step, or the P9P context — that context
is outside T12-V.)

## 4. What was applied (T12-V5, commit `5a2bbe1`)

Per the integrator directive, the runner now **also** creates, idempotently during env
setup, the **packages-level 7-junction bridge** at
`.worktrees/T12-V/packages/node_modules/@deepseek-ai/`:

| link | target (test-use pnpm hoist) |
| --- | --- |
| dsh-agent | `.../node_modules/.pnpm/node_modules/@deepseek-ai/dsh-agent` |
| dsh-llm | `.../@deepseek-ai/dsh-llm` |
| dsh-mcp-client | `.../@deepseek-ai/dsh-mcp-client` |
| dsh-session | `.../@deepseek-ai/dsh-session` |
| dsh-storage-domain | `.../@deepseek-ai/dsh-storage-domain` |
| dsh-scope | `.../@deepseek-ai/dsh-scope` |
| dsh-system-prompt | `.../@deepseek-ai/dsh-system-prompt` |

- All 7 targets verified present in the store before linking (0.1.2-alpha.1 each); all 7
  junctions verified resolving via their `package.json`.
- The junction logic was refactored into a shared idempotent helper `ensureJunctions()`
  (keep-if-realpath-matches, re-link stale/dangling, refuse non-junction occupants); the
  runtime-level 5+1 bridge now runs on the same helper with unchanged behavior.
- Node's upward walk from `packages/runtime/**` hits `packages/runtime/node_modules`
  **first**, so the runtime-level bridge remains the effective one for seam/glue; the
  packages-level bridge is belt-and-braces for anything imported from the rest of the
  worktree scope, and mirrors the placement P9P used (its R91 green runs relied on the same
  7-junction packages-level bridge — the mechanism precedent).
- Both bridges are gitignored worktree-only artifacts (host tree untouched; CORE PATCH
  BUDGET = 0 holds). `git diff --name-only 62c7c81..HEAD` still contains only the
  sanctioned files.

## 5. Disposition (for the decision doc / P10)

- This is a **fresh-world test-environment defect**, not a repository code defect: the
  junction bridges are environment artifacts of the same class as the mock-model stand-in.
- Proper fixes (P10 entries): (a) fix the upstream-resolver hook discovery off-by-one so
  the hook actually intercepts in fresh worlds; (b) give the row's glue a regular
  resolution story for its relative TS-source imports (the glue imports TS sources with
  `.js` specifiers while all repo tsconfigs are `noEmit:true` — a fresh worktree has no
  in-source `.js`; the runner's dist-mirror copy is the compensating artifact).
- The T12 runner keeps both bridges defensively until one of those lands.

## 6. BLOCKER #3 (integrator follow-up) — source-tree glue imports

The integrator's 00:02 smoke fatal: `Cannot find module 'D:\...\T12-V\packages\domain\blueprint\src\index.js'`
— the GLUE loaded from the **source tree** (legacy source-URL design) under plain Node. Root cause
(integrator-diagnosed, implemented as instructed, zero re-diagnosis): the glue
(`packages/runtime/src/plugin/live/agent-bindings.mjs`, a source `.mjs`) carries two relative
tsc-style `.js`-specifier imports into the TS source tree:

- L145: `../../../../domain/blueprint/src/index.js` → `<wt>\packages\domain\blueprint\src\index.js`
- L146: `../../../agent-setup/persona/index.js` → `<wt>\packages\runtime\agent-setup\persona\index.js`

A fresh worktree has only `.ts` there and EVERY tsconfig in the repo is `noEmit:true`, so no
sanctioned tsc run emits these files. T12-int and P9P only booted because they carried
untracked in-source `.js` artifacts.

**Fix (T12-V6, commit `25a7e39`; environment prep only)**: `buildProductionRuntime` now runs,
after the dist build and before any boot, an idempotent dist-mirror → source copy: every `*.js`
under `packages/runtime/dist/packages/` (254 files) is copied to its repo path preserving the
mirror layout (mirror root `dist/packages/` maps to repo `packages/`), skipping `.d.ts`,
creating target dirs, overwriting in place. The dist mirror is a replica of the source layout
(tsc `rootDir` = repo root since P8-S5A), so the glue's relative imports keep resolving after
the copy and bare imports resolve from each package's own node_modules (junctions cover
`@deepseek-ai/*`, pnpm the rest). Both glue placements — the dist mirror (this runner's
`glueUrl`) and the source tree (legacy design) — now resolve identically. The copied files are
untracked build output (never committed; `git diff` vs base unaffected). Zero source edits,
zero core edits. Note: this runner's own boots always used the dist-mirror `glueUrl` (glue
placed into the dist tree by T12-V2), which is why all T12 boots before T12-V6 were already
green; the 00:02 fatal came from a source-URL glue load, which the copy now covers.
