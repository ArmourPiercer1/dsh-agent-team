Fix-forward for two defects that are on `master` now. One writer, branch off `origin/master` @ `fde550fa2` (the #405 merge point).

---

## Defect A — HIGH (security): read paths accepted a hardlink alias to an outside inode

**Finding.** Post-merge review of PR #405, finding **F-405-R2-1** (`dev/agent-workflow/evidence/u7-405-review-r2/REVIEW.md` @ `origin/task/u7-405-review-r2-20261027`): a hardlink whose **second** name sits inside the governed root and whose **first** name is an outside file was accepted and presented. The reviewer's scratch vitest reproduction returned `kind: 'ok'` and invoked the publication port.

**Root cause.** The shared opened-handle law `verifyOpenedHandle` (`packages/runtime/controlled-fs/src/open-at-exec.ts`) proved exactly two things: `/proc/self/fd` containment, and `fstat`-vs-snapshot identity. A hardlink defeats both — `/proc/self/fd/<n>` reports the **path the fd was opened through** (the in-root name), and the in-root name's `fstat` is the very same inode as the outside name. The `nlink === 1` refusal existed **only** on the write/create path (`post-consume-create.ts:41,384-387`). No read path checked link count, so every caller of the law was exposed: fs read / `read_image`, inspect `skill`, ui `present`, search grep file targets, and the post-consume write/edit closures.

**Protected center: checked, not assumed.** `packages/runtime/controlled-fs/**` is **not** in `dev/agent-workflow/ledgers/arc-a-protected-center.json` — re-confirmed on this tree (33 booked paths, none under `packages/runtime/controlled-fs` or `packages/tools/*`). No center-interface need; edited in place.

### The one-place fix

The refusal was added **inside `verifyOpenedHandle`** — not per family, and not as a read-specific wrapper:

- new `ExecTimeVerdict` member `{ verdict: 'hardlink-alias', nlink, detail }` and `hardlinkAliasVerdict(nlink)`, which states the law *and its why* in one message (168 chars, so it survives every caller's `slice(0, 200)` verbatim — the model is told the reason and the remedy, not just "refused");
- the check runs **after** escape and drift (`stats.isFile() && stats.nlink !== 1`), so every existing symlink/race/escape leg keeps its exact answer;
- new closed-set reason `hardlink-alias` in `cf-errors.ts`: class `denied`, §5 code `TOOL_BINDING_UNVERIFIED` — the same family as `symlink-alias`, no lane-invented code.

**Why the shared law rather than a read wrapper:** nine call sites reach the primitive directly (fs read, read_image, skill, present, search grep file targets, post-consume write/edit/create, and the lane's own `safeOpen`). A wrapper would leave every direct importer on the old law — which is precisely the defect class being fixed. In the primitive, a **new** caller inherits it by construction.

Per-caller wiring was needed only where a generic fall-through would *lose the reason*:

| caller | wiring |
|---|---|
| `controlled-fs.ts` `safeOpen` | non-destructive `hardlink-alias` → `denied`; a **destructive** open keeps its honest `write-side-effect-unconfirmed` |
| `present-executor.mjs` | mapped to `ANCHOR-ESCAPE` carrying the link-count reason, instead of the generic `FILE_UNREADABLE` that hid it |
| post-consume `write` / `edit` | explicit denial **before** truncation / before the read half (zero side effect) |
| post-consume `create` | its own `nlink !== 1` clause kept as belt-and-braces (now redundant, and documented as such so the create law never rests on a shared default alone) |

### RED → GREEN, per caller

New suite `packages/runtime/test/u7-fixfwd-hardlink-alias.test.ts` — 14 legs. Every fixture asserts its own premise first (`nlink === 2`, `ino` equal to the outside canary), so a leg cannot pass by failing to build its hardlink.

| leg | RED before the fix | GREEN after |
|---|---|---|
| H-0 shared law | `confirmed` | `hardlink-alias`, `nlink=2` |
| H-read | `kind:'ok'` + outside bytes | `exec-time-hardlink-alias`, `execCount 0` |
| H-image | `kind:'ok'`, store written | refused, port `ok:false`, store 0 |
| H-skill | `kind:'ok'`, outside content loaded | refused, `governed-skill RAN` absent |
| **H-present** (the F-405-R2-1 repro) | `kind:'ok'`, path published to the port | `ANCHOR-ESCAPE`, port calls **0** |
| H-grep | searched the outside inode | `exec-time-hardlink-alias`, zero bytes to sink |
| H-write | (readable through alias) | refused pre-truncate, canary **byte-identical** |
| H-edit | (readable through alias) | refused pre-read, canary byte-identical, zero bytes disclosed |
| P-0 / P-read / P-image / P-skill / P-present / P-grep | — | **positive controls**: `nlink=1` files still read/present/load/commit/search |

**Mutation** (`evidence .../C-mutation-nlink-removed.log`): replacing the clause with `if (false && stats.nlink !== 1)` makes **8/8 hardlink legs RED** while the 6 positive controls stay green — the check is load-bearing, not decorative. Line restored afterwards.

**Existing suites, unchanged-green** (no test edited to accommodate the fix): fs-family + golden vectors + `a5-m1-read-c1c2` + `a5-read-slice-window` → 100 passed; `u7f-inspect-family-c1` (**34/34**) + `u7-f-ui-c1` (**41/41**) → 75 passed; search/glob suites → 159 passed; controlled-fs lane → 42 passed.

### `nlink > 1` measurement and the trade-off

| population | files | `nlink > 1` |
|---|---|---|
| tracked files (`git ls-files`, this worktree) | 5878 | **0** |
| worktree minus `node_modules` / `.git` / pnpm store | 5882 | **0** |
| persisted `tests/homes/**` worlds minus `node_modules` | 31124 | **0** |
| main checkout, tracked | 5878 | **0** |
| `node_modules/**` (pnpm content-addressed hardlink store) | 37455 | 36815 |

So the refusal costs **nothing legitimate** in this repo's governed roots, and the families' test worlds (created under `tests/homes/`, torn down per TEST_METHODS §7) contain zero multi-link files. `git` does not hardlink tracked files (measured 0). The one real multi-link population is the pnpm store under `node_modules/`, which no governed root anchors to; a governed root pointed *at* `node_modules` would now refuse its hardlinked package files — that is the correct fail-closed direction, disclosed here as the deliberate trade-off rather than an oversight. Files created *within* a governed root by the governed tools are always `nlink === 1` (the create path already enforced it), so in-root authoring is unaffected — proven by the six positive controls and by the existing suites staying green untouched.

Directories are exempt **by construction**: a directory's `nlink` counts subdirectory entries, never file aliases, and no read path takes directory bytes.

---

## Defect B — master-red check that no CI layer runs

`node --test tests/checks/dist-placements.test.mjs` was **4 pass / 5 fail on a CLEAN `origin/master`** (reproduced first, before any edit on this branch).

**Cause.** It pinned the #397 snapshot as literals — `PLACEMENTS.length === 38`, per-file `[8,3,15,5,7]`, and `37`/`39` in the mutation cases — while the real ledger is now **82 placements in 9 files**. Its mirror-parity filter `/\.(mjs|py)$/` also ignored `.json`, so the legitimately placed `packages/runtime/dist/packages/tools/families/manifest.json` read as "untracked".

**Fix (test only — the loader was correct).**
- `PER_FILE` / `N` are **read from disk at run time**; `PLACEMENTS.length` is compared to the measured sum and to a fresh `loadPlacements()`;
- mutation cases assert **DELTAS** — `N - 1` (removed placement), `N + 1` (gap file, new-family file) — never a literal total;
- the new-family case derives the next free prefix (`max(prefixes) + 10`) instead of the literal `060`, which u7-w0b had already taken;
- the gap case derives its insertion index from `PER_FILE[0]` instead of the literal `now[8]`;
- the mirror filter is the **measured shipped-extension set** (`mjs`, `py`, `json`), with a structural assertion that json is covered while a placement ships one and that no tsc output extension (`.js`/`.ts`/`.map`) is ever treated as a placement.

Every real law is kept: glue first, prefix order, duplicate prefix/src refused, gaps allowed **and** ordered, stray entries refused by name, schema / empty-list / empty-directory refused, mirror parity exact. **Non-vacuity check:** tampering one `dist` in the real `010` ledger to a wrong path gives **0 pass / 1 fail** (the loader's mirror law fires); restored afterwards.

**Into a CI layer, so it cannot drift silently again.** Declared a new `ci-integration` leg `tests/checks node:test suites` in `dev/ci/eb3-ci-manifest.json` with **both** file paths as required `check` tokens, plus a matching step in `.github/workflows/ci-integration.yml`. Dropping either path is `CI_LAYER_LEG_WEAKENED`. Checked first for an existing `node --test` leg covering `tests/checks/`: the only one runs `tests/u7-3-devex/` and `tests/diag-call-chain/` — so a new leg was needed, and the sibling `tests/checks/eslint-node-globals.test.mjs` (un-gated for the same reason) rides it. `node scripts/eb3-ci-required.mjs` → **0 findings**.

### Other `node:test` suites that NO CI layer runs

15 suites; all currently **PASS**, so none is red today — but none is protected against silent drift. Listed, not fixed (out of scope):

| suite | pass/fail on this tree |
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

---

## Gates (final staged/committed tree)

- `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store` → **pass 7 / fail 0 / skip 1** (census = named opt-in skip), 47.1 s
- `eb3-ci-required` → **0 findings** (workflows=9)
- `eb3-ci-negative-controls` → **21/21** controls behaved as required
- `eb3-evidence-guard --new-since origin/master` → pass, 0 findings
- `eb3-family-boundaries` → 0 · `eb3-family-definitions` → 0 · `gen-family-index --check` → OK
- `lint-identities` → new **0**, resolved 0
- `docs:sync --check` → blocking **0** · `docs:probe` → blocking **0**
- `pnpm typecheck` → clean (all 8 packages)
- `check-artifacts-committed` → OK, 1865 files, 82 glue placements; `check-artifacts-at-head` → HEAD carries its own build (drift 0)

Note for reviewers: editing the `.ts` law means the **shipped dist mirror** must be rebuilt in the same commit — `tsc -p packages/runtime/tsconfig.build.json` **and** `node scripts/place-dist-glue.mjs` — otherwise the installed face ships the pre-fix law. Both are included, and the at-head check proves the commit carries its own build.

Evidence: `dev/agent-workflow/evidence/u7-fixfwd-20261027/` (RED log, GREEN log, mutation log, dist-placements log, README).

---

## Update: a THIRD master-red, found by the new leg on its FIRST hosted run

The first hosted `ci-integration` run (run **40513024797**, job **122219502568**) went red on **step 17 — the very leg this PR adds**. It was not a defect in the new leg: it was the second un-gated suite in `tests/checks/` doing exactly what it was put there for.

- `tests/checks/eslint-node-globals.test.mjs` (the sibling suite the new leg also gates) was **red on clean `origin/master`** — 5 pass / 1 fail, reproduced on a detached `origin/master` worktree.
- **Cause.** Its expected set was a hardcoded lane list: `const ADDED_BY_LANES = [...ADDED_BY_U7W0, 'packages/tools/inspect-family/src/*.mjs']` — i.e. precisely the per-family edit that the u7-w0 collection law exists to abolish. U7-F web (PR #403, `a0d708c59`) shipped `scripts/eslint-node-globals/030-web-family-node-modules.json` and never edited that line; no CI layer ran the suite, so master sat red unnoticed.
- **Fix — derived, NOT a new literal booking.** The expected lane-added set is now read from the collected documents ON DISK (raw JSON, independently of the collector), so a new node-side lane ships one file and edits nothing:
  - `PRE_U7W0_ENTRIES` stays a **frozen historical literal** — that is history, not a lane roster, and it is what keeps the assertion meaningful;
  - the parity law keeps four separate arms: a **lost frozen entry** (`missingFrozen`), a pattern **declared twice** inline+collected (`duplicates`), a collector that **invents** an entry (`notOnDisk`), and a document entry the collector **fails to surface** (`notCollected` — a lane's node globals silently off);
  - a separate law pins that **inline adds nothing beyond the frozen nine**, so a new lane cannot bypass the collection by editing `eslint.config.mjs`;
  - a new-lane control plants a `040-brand-new-family.json` in a temp dir and asserts the derivation, the collector **and** the parity law all pick it up with **zero edits to the test**;
  - a drift control hands the law the pre-ship collector output and asserts the unsurfaced entry is named **by drift, not by a lane name**.
- **Non-vacuity — three tamper checks, each restored:** an inline lane addition → 3 legs RED; a duplicated collected entry → 2 legs RED; a stale pattern matching no tracked file → 1 leg RED.

Also merged current `master` (`11ec229e4`, #407) into this branch, then re-verified: fs-law suite **14/14**, affected family suites **334 passed / 14 files**, `check-artifacts-at-head` drift 0 (1881 files, 98 glue placements), `eb3-ci-required` 0 findings, `ci-pr-gate` **pass 7 / fail 0 / skip 1**.

**Three** previously-unmetered master states are now cleared and gated: `dist-placements` (4 pass / 5 fail), `eslint-node-globals` (5 pass / 1 fail) — and the second one then caught the third un-gated red on the new leg's first run. That is the argument for the leg, made by the leg.

> Sequencing note: PR #410 adds `scripts/eb3-tool-acceptance.mjs` as another `ci-integration` leg. If it lands first, the rebase must **keep both legs** in `dev/ci/eb3-ci-manifest.json` and `.github/workflows/ci-integration.yml`.

Not merged by this lane.


