# review-GLUE1 — independent review of alpha5-glue-jobs @ 7451f34e

- **Reviewer**: GLUE-1 independent reviewer (qwen3.8-flash-next, session ≠ writer e72e4110; reviewer session id not disclosed here per ROUTER §3.1 independence — recorded in coordinator log)
- **Reviewed**: `7451f34e05d1b5dab209160ef3092d3fffac14bc` (`build(glue): land jobs-gateway on the production compile face`), base `2ff24c5a` (master)
- **Method**: one-off detached worktree at the fixed SHA; independent re-runs below; deltas read directly (`git diff 2ff24c5a 7451f34e` = 24 added `packages/runtime/dist/**` files + 3 non-dist files: census txt, a5p7-lane-hygiene.test.ts (+10), tsconfig.build.json (+1)).
- **Verdict**: **PASS** (two non-blocking advisories, §4).

## ① a5p7 hygiene — does the dist/ skip weaken the audit invariant?

**Predicate.** The added skip (`packages/runtime/test/a5p7-lane-hygiene.test.ts:127`) is
`if (/(^|\/)dist\//.test(rel)) continue` with `rel` = packages/-relative posix path — i.e. any
directory segment named exactly `dist`, at any depth. The frozen shared scanner
(`packages/testkit/fault-injection/session-event-scan.mjs:239`) skips directory segments named
exactly `node_modules` / `dist` / `.tmp-fault`. The two predicates are shape-equivalent.
**The scanner skip predates this commit**: `git show 2ff24c5a:…session-event-scan.mjs` carries the
identical line 239, and `git diff 2ff24c5a 7451f34e` over the scanner `.mjs` + the p4t6 ledger test
= **0 lines**. The commit aligns the a5p7 consumer leg with the frozen census universe (which
already recorded "dist is outside the scan"); it does not move the census.

**Adversarial injections (live, in this worktree; probes removed after).**
| Probe | Placement | Scanner universe | a5p7 suite | Runner |
|---|---|---|---|---|
| A | real test source disguised as `packages/runtime/dist/probe-a-disguised.test.ts`, containing `import … 'jobs-gateway/types.js'` + quoted denylist token `'team/message'` | **escaped** — universe stayed 1157, hits stayed 15 | **escaped** — 4/4 GREEN | never executed (vitest `exclude: '**/dist/**'`) |
| B | same source at `packages/runtime/jobs-gateway/dist/probe-b-lane-dist.ts` (dist shape *inside* the lane) | escaped (same frozen segment skip) | **CAUGHT ×2** — exact-set leg `15 ≠ 14` + vocabulary leg (leg 1/leg 4 carry **no** dist skip) | — |
| C | true source at `packages/runtime/probe-c-real-source.ts` (non-dist) | **CAUGHT** — universe 1157→**1158**, hits 15→**16** | **CAUGHT** — consumer leg flags `runtime/probe-c-real-source.ts` | — |

**Answers.** Can a true source disguised as a dist/ path escape the scan? **Yes** (probe A) — for
both the frozen p4t6 census and, newly, the a5p7 consumer leg. What predicate decides dist/?
*segment named exactly `dist`*, path-shape only, no provenance check. Are true sources still in the
scan universe? **Yes** (probe C; all 14 lane sources present in `scanResult.files`, verified by
path). Is exact-set semantics untouched? **Yes** — leg 1 has no dist skip (probe B proves it still
bites inside the lane), the pinned 14-file set is unchanged by the diff, and the commit adds zero
files matching the lane prefixes (all 24 land under `runtime/dist/…`, outside every leg-1 prefix;
`.d.ts` under `runtime/dist/` fails the `runtime/jobs-gateway/` prefix test).

**Severity.** A smuggled dist file is non-executable in the runner, ships as a dead blob, and can
only become a *production consumer* through an import edge in a tsc-regenerated file — those are
byte-verified against a fresh build by `check:artifacts` (categories A–D,
`scripts/check-artifacts-committed.mjs`), and the source side of every such edge is scanned (probe
C). The residual additive-file case is exactly the documented, accepted "stale leftover" narrow gap
in the same script's header — pre-existing, not created here. The commit's claim "the invariant
moves by nothing" holds for the enforced source-import semantics; the narrowing removes only the
false-positive the lane's own emitted `.d.ts` mirrors started causing.

## ② tsconfig.build +jobs-gateway — pure additive compile face

- Diff = exactly `+    "jobs-gateway",` in the `include` array; compilerOptions, base config, all
  other entries untouched.
- Independent rebuild: `tsc -p packages/runtime/tsconfig.build.json --outDir <fresh>` → **exit 0**;
  `diff -r fresh vs packages/runtime/dist` → **zero differing bytes anywhere**, zero
  fresh-only files; committed-only extras (`packages/legacy`, `policy-adapter.*`, `src/plugin/live`)
  are emitted by other faces and are byte-untouched by this commit. The 24 added files reproduce
  byte-identically.
- Artifact-vs-source spot checks (2): `jobs-gateway.ts` → `jobs-gateway.js` (value imports 1:1 at
  lines 33–44, type-only imports elided as expected, exports preserved) and
  `cancellation-boundary.ts` → `cancellation-boundary.d.ts` (exported `classifyDispatchEvent`
  signature mirrored verbatim, types imported from `./types.js`).
- Zero semantic change to any pre-existing emit; the lane now compiles on the build face (the W7
  review's condition 2).

## ③ p4t6 "no tie" — personally verified

- Direct scanner call at 7451f34e: `scanSessionEventVocabulary()` → `filesScanned = files.length =
  **1157**`, hits `total = 15` (quarantine-only), zero dist paths in universe.
- The commit cannot enter the universe: all 24 added files sit under a `dist` segment (frozen skip);
  the census txt is not scannable, tsconfig.build.json is `.json`, and the hygiene test was already
  a counted file. Zero new files under `packages/*/test` (git diff confirms). Parent 2ff24c5a
  ledger pin is likewise 1157 (`SCANNED_PATHS_GGPROBES = 1157 − 1155`). Coverage leg GREEN at the
  pinned total at both ends: **no tie owed, none created**.

## Suite + lint runs (clean tree, probes removed)

- `vitest run` a5p7 ×5 (job-owner 5, mcp-rebind-chain 6, lease-cancellation 12,
  vnext-field-mapping 6, lane-hygiene 4) + p4t6 → **6 files / 43 tests passed**, 0 failed.
  (Advisory A-2: writer's message cites "p4t6 37/37"; the suite file here counts 10 `it`s —
  counting-base difference recorded as-is, suite is green at its pins either way.)
- `eslint packages/runtime/test/a5p7-lane-hygiene.test.ts` → exit 0. `node scripts/lint-identities.mjs`
  → 0 violations, 1244 files.
- Tree restored after probes: `git status --porcelain` clean apart from reviewer-only node_modules
  symlinks.

## 4. Advisories (non-blocking)

- **A-1 (pre-existing, census-level)**: the dist-path disguise (probe A) escapes both frozen
  universes because the skip is path-shape-only; enforceability of "dist is a pure function of
  source" for *additive* smuggled files rests on `check:artifacts` + review, same as the documented
  stale-leftover gap. If the team ever wants belt-and-braces, a cheap extra leg is
  `git ls-files 'packages/**/dist/**/*.ts' ∩ committed-before-build` diffed against a fresh-build
  manifest — out of scope for this glue commit, belongs to the mirror-trim minor task.
- **A-2 (bookkeeping)**: p4t6 test-count base ("37/37" vs 10) — align in the next ledger touch.

## 5. Reproduction

```bash
# ③ scanner direct call
node --input-type=module -e "import { scanSessionEventVocabulary as s } from './packages/testkit/fault-injection/session-event-scan.mjs'; const r=s(); console.log(r.filesScanned, r.summary.total)"
# ② fresh build face byte-compare
node_modules/.bin/tsc -p packages/runtime/tsconfig.build.json --outDir /tmp/x && diff -r /tmp/x packages/runtime/dist   # only cross-face 'Only in dist' entries
# ① suites + probes: re-create the three probe files from §① table and rerun
node_modules/.bin/vitest run packages/runtime/test/a5p7-*.test.ts packages/domain/test/a5p7-vnext-field-mapping.test.ts packages/testkit/test/p4t6-session-event-scan.test.ts
```
