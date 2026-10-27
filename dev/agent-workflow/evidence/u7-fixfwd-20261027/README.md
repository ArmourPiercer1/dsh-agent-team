# u7-fixfwd-20261027 — fix-forward for two master defects

Branch `task/u7-fixfwd-20261027` off `origin/master` (`fde550fa2`, the #405 merge).
Worktree `.worktrees/u7-fixfwd`. One writer. Not merged by this lane.

## Defect A — HIGH: read paths accepted a hardlink alias to an outside inode

**Finding.** Post-merge review of PR #405, finding `F-405-R2-1`
(`git show origin/task/u7-405-review-r2-20261027:dev/agent-workflow/evidence/u7-405-review-r2/REVIEW.md`):
a hardlink whose SECOND name sits inside the governed root and whose FIRST name is an
outside file was accepted and presented. The review's scratch vitest reproduction
returned `kind: 'ok'` and invoked the publication port.

**Root cause (measured, not assumed).** The shared opened-handle law
`verifyOpenedHandle` (`packages/runtime/controlled-fs/src/open-at-exec.ts`) proved two
things: `/proc/self/fd` containment and `fstat`-vs-snapshot identity. A hardlink
defeats both — `/proc/self/fd/<n>` reports the PATH the fd was opened through (the
IN-ROOT name), and the in-root name's `fstat` is the very same inode as the outside
name. The `nlink === 1` refusal existed ONLY on the write/create path
(`post-consume-create.ts:41,384-387`); no read path checked link count.

**Protected-center check.** `packages/runtime/controlled-fs/**` does NOT appear in
`dev/agent-workflow/ledgers/arc-a-protected-center.json` (0 hits; re-confirmed on this
tree, ledger has 33 booked paths, none under `packages/runtime/controlled-fs` or
`packages/tools/*`). No center-interface need; edited in place.

**The one-place fix.** The refusal was added INSIDE `verifyOpenedHandle`, not as a
per-family rule and not as a wrapper:
- new verdict member `{ verdict: 'hardlink-alias', nlink, detail }` on `ExecTimeVerdict`;
- `hardlinkAliasVerdict(nlink)` states the law and its WHY in one message (168 chars, so
  it survives every caller's `slice(0, 200)` verbatim — the model is told why);
- the check runs AFTER escape and AFTER drift (`stats.isFile() && stats.nlink !== 1`),
  so every existing symlink/race leg keeps its exact answer;
- new closed-set reason `hardlink-alias` in `cf-errors.ts` (class `denied`, §5 code
  `TOOL_BINDING_UNVERIFIED` — the same family as `symlink-alias`).

Why the shared law and not a read-specific wrapper: nine call sites reach
`verifyOpenedHandle` (fs read, read_image, skill, present, search grep file targets,
post-consume write/edit/create, the controlled-fs lane's own `safeOpen`). A wrapper
would leave every caller that imports the primitive directly — a5 lane, search
mechanics, all three post-consume closures — on the old law, i.e. the same class of
gap that caused this defect. Putting it in the primitive means a NEW caller inherits
it by construction.

Per-caller wiring needed only the two things a generic fall-through would lose:
- `controlled-fs.ts` `safeOpen`: a `hardlink-alias` non-destructive branch → `denied`
  (a `destructive` open keeps its `write-side-effect-unconfirmed` honesty);
- `present-executor.mjs`: the new code mapped to `ANCHOR-ESCAPE` with the link-count
  reason, instead of the generic `FILE_UNREADABLE` (which hid the reason);
- post-consume write/edit: an explicit `hardlink-alias` denial BEFORE truncation /
  before the read half (zero side effect);
- post-consume create: its own `nlink !== 1` clause kept, now redundant, documented
  as belt-and-braces so the create law does not rest on the shared default alone.

**RED → GREEN, per caller** (`A-red-before-fix.log`, `B-green-after-fix.log`):
`node --test`-style legs in `packages/runtime/test/u7-fixfwd-hardlink-alias.test.ts`
(14 legs). Every fixture asserts its own premise first (`nlink === 2`, `ino` equality
with the outside canary).

| leg | RED before | GREEN after |
|---|---|---|
| H-0 shared law | `confirmed` | `hardlink-alias`, `nlink=2` |
| H-read | `kind: 'ok'` with outside bytes | `exec-time-hardlink-alias`, `execCount 0` |
| H-image | `kind: 'ok'`, store written | refused, port `ok:false`, store 0 |
| H-skill | `kind: 'ok'`, outside content loaded | refused, `governed-skill RAN` absent |
| H-present (the F-405-R2-1 repro) | `kind: 'ok'`, path published to the port | `ANCHOR-ESCAPE`, port calls 0 |
| H-grep | searched the outside inode | `exec-time-hardlink-alias`, zero bytes to sink |
| H-write | — | refused pre-truncate, canary byte-identical |
| H-edit | — | refused pre-read, canary byte-identical, no bytes disclosed |
| P-0/P-read/P-image/P-skill/P-present/P-grep | positive controls | nlink=1 files still flow |

**Mutation** (`C-mutation-nlink-removed.log`): replacing the clause with
`if (false && stats.nlink !== 1)` makes 8/8 hardlink legs RED (6 positive controls stay
green), then the line is restored — the check is load-bearing, not decorative.

**nlink > 1 measurement and trade-off.** Counted regular files with `nlink > 1`:

| population | files | nlink > 1 |
|---|---|---|
| tracked files in this repo (`git ls-files`, worktree) | 5878 | **0** |
| whole worktree minus `node_modules`/`.git`/pnpm store | 5882 | **0** |
| persisted `tests/homes/**` worlds minus `node_modules` | 31124 | **0** |
| main checkout tracked files | 5878 | **0** |
| `node_modules/**` (pnpm content-addressed hardlink store) | 37455 | 36815 |

So the refusal costs NOTHING legitimate in this repo's governed roots, and the families'
test worlds (which are created under `tests/homes/` and torn down) contain zero
multi-link files. The one real population is the pnpm store under `node_modules/`,
which no governed root anchors to; a governed root pointed AT `node_modules` would now
refuse hardlinked package files — that is the correct failure direction (fail closed),
and it is the stated trade-off rather than an oversight. `git` does not use hardlinks
for tracked files (measured: 0), and package managers' hardlinked stores are the only
population this changes. Files created WITHIN a governed root by the governed tools
themselves are always `nlink === 1` (the create path already enforced it), so the
in-root authoring loop is unaffected — proven by the six positive controls and by the
existing suites staying green unchanged.

Directories are exempt by construction: a directory's `nlink` counts subdirectory
entries, never file aliases, and no read path takes directory bytes.

**Existing suites, unchanged-green** (no test file edited to accommodate the fix):
fs-family incl. golden vectors + `a5-m1-read-c1c2` + `a5-read-slice-window`
(100 passed), inspect C1 34/34 among (`u7f-inspect-family-c1` + `u7-f-ui-c1` = 75
passed), ui C1 41/41, search/glob suites (159 passed), controlled-fs lane 42 passed.

## Defect B — master-red check outside CI

`node --test tests/checks/dist-placements.test.mjs` was **4 pass / 5 fail on a CLEAN
origin/master** (reproduced first thing on this branch, before any edit).

Cause: it pinned the #397 snapshot as literals — `PLACEMENTS.length === 38`, per-file
`[8,3,15,5,7]`, and 37/39 in the mutation cases — while the real ledger is now
**82 placements in 9 files**. Its mirror-parity filter `/\.(mjs|py)$/` also ignored the
`.json` extension, so the legitimately placed
`packages/runtime/dist/packages/tools/families/manifest.json` read as "untracked".

Fix (test only; the loader was correct):
- `PER_FILE` / `N` are **read from disk at run time**; `PLACEMENTS.length` is compared
  to the measured sum, and to a fresh `loadPlacements()`;
- mutation cases assert **DELTAS** — `N - 1` for the removed placement, `N + 1` for the
  015 gap file and for the new-family file — never a literal total;
- the new-family case derives the next free prefix (`max(prefixes) + 10`) instead of
  the literal `060`, which u7-w0b had already taken;
- the gap case derives its insertion index from `PER_FILE[0]` (the measured size of the
  010 file) instead of the literal `now[8]`;
- the mirror filter is the **measured shipped-extension set** (`mjs`, `py`, `json`),
  with a structural assertion that json is covered while a placement ships one and that
  no tsc output extension (`.js`/`.ts`/`.map`) is treated as a placement.

Every real law is kept: glue first, prefix order, duplicate prefix/src refused, gaps
allowed and ordered, stray entries refused by name, schema and empty-list refused, empty
directory refused, mirror parity exact.

Not vacuous — tamper check: editing one `dist` in the real `010` ledger to a wrong path
gives **0 pass / 1 fail** (the loader's mirror law fires), then restored.

**CI layer.** Declared a new `ci-integration` leg `tests/checks node:test suites` in
`dev/ci/eb3-ci-manifest.json` with BOTH file paths as required `check` tokens
(`tests/checks/dist-placements.test.mjs`, `tests/checks/eslint-node-globals.test.mjs`),
and a matching step in `.github/workflows/ci-integration.yml`. Dropping either path is
`CI_LAYER_LEG_WEAKENED`. I checked for an existing `node --test` leg running
`tests/checks/` first: the only pre-existing `node --test` leg runs
`tests/u7-3-devex/` and `tests/diag-call-chain/`, not `tests/checks/` — so a new leg was
needed, and the sibling `tests/checks/eslint-node-globals.test.mjs` (un-gated for the
same reason) rides it. `node scripts/eb3-ci-required.mjs` → 0 findings.

## Other node:test suites that NO CI layer runs (measured on this tree)

15 un-gated suites; all currently PASS, so none is red today, but none of them is
protected against silent drift. Listed, not fixed (out of scope):

| suite | pass/fail |
|---|---|
| `scripts/sanitize-evidence.regression.test.mjs` | 25/25 pass |
| `tests/evidence-store/evidence-store.test.mjs` | 10/10 pass |
| `tests/world-factory/world-factory.test.mjs` | 40/40 pass |
| `tests/world-factory/u6-arc-d.test.mjs` | 7/7 pass |
| `tests/world-factory/registries.test.mjs` | 12/12 pass |
| `tests/kits/pr-e-requirement-recovery-smoke/stage2-observer.test.mjs` | 100/100 pass |
| `tests/kits/pr-e-requirement-recovery-smoke/ui-observe.test.mjs` | 51/51 pass |
| `tests/kits/rc2-real-host-smoke/run-control.regression.test.mjs` | 6/6 pass |
| `tests/kits/rc2-real-host-smoke/runner-wiring.regression.test.mjs` | 51/51 pass |
| `tests/kits/team-view-sync-complete-e2e/carrier-import-preflight.test.mjs` | 6/6 pass |
| `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.test.mjs` | 82/82 pass |
| `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-orchestration.test.mjs` | 49/49 pass |
| `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-ownership.test.mjs` | 12/12 pass |
| `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-dom.test.mjs` | 17/17 pass |
| `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-identity.test.mjs` | 22/22 pass |

(`tests/checks/*`, `tests/u7-3-devex/*`, `tests/diag-call-chain/*` are gated and were
excluded from this list.)

## Gates run on the final staged tree

- `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store` → **pass 7 fail 0 skip 1**
  (census is the named opt-in skip), 47.1 s
- `eb3-ci-required` → 0 findings (workflows=9)
- `eb3-ci-negative-controls` → 21/21 controls behaved as required
- `eb3-evidence-guard --new-since origin/master` → pass, 0 findings
- `eb3-family-boundaries` → 0 findings (files=66)
- `eb3-family-definitions` → 0 findings (files=25)
- `gen-family-index --check` → OK (6 reviewed families)
- `lint-identities` → new 0, resolved 0
- `docs:sync --check` → blocking 0 · `docs:probe` → blocking 0
- `pnpm typecheck` → clean, all 8 packages
- `check-artifacts-committed` → OK, 1865 files, 82 glue placements (after
  `tsc -p tsconfig.build.json` + `node scripts/place-dist-glue.mjs`)

Note: `pnpm install --store-dir .tmp-pnpm-store` was run once at the start (24.6 s).
