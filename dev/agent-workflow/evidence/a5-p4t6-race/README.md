# a5-p4t6-race — census concurrency file-shape race: p4t6 scan × a4p7 lint controls

Branch `a5-p4t6-race` @ worktree `.worktrees/a5-p4t6-race`, base = master
`708fb3fed6555ad664d9817cea64db06150eeff1` (dual-source: `git ls-remote origin master`
and local `origin/master` agreed at fetch time). Not pushed.

## The race (background account)

Attributed at close by the g6b-flake round (evidence `alpha5/g6b-flake/step-b/README.md`
attribution section + `merge7-p4t6-red-measure.log` / `merge7-p4t6-green.log`, on the
g6b-flake base where the pin read 1203):

- the a4p7 merge-gate lint-scratch isolation leg
  (`packages/testkit/test/a4p7-merge-gate.test.ts`) plants TWO transient control
  probes `lint-scratch-control-a.mts` / `-b.mts` in `packages/testkit/test/` (the
  non-vacuity control for "the scratch does not enter the lint universe"), removing
  them in `finally`;
- the p4t6 session-event scanner (`packages/testkit/fault-injection/session-event-scan.mjs`,
  walked once at module load by `p4t6-session-event-scan.test.ts`) enumerates every
  `.ts` / `.mts` / `.mjs` under `packages` and skips only the `node_modules`, `dist`
  and `.tmp-fault` directory segments — a planted control file IS counted;
- under full-census parallelism, when the p4t6 module load lands inside the planting
  window, the scanner counts the transient controls: **1 red in 10 captures,
  `expected 1206 to be 1204`** on the merge-round-3 master tree (both controls seen;
  the g6b capture saw one: `1204 to be 1203`). Same-window bonus collision, class
  already noted by `dev/agent-workflow/evidence/a4-pr7/g1-missing-member/FINDINGS.md`
  (lint reading a control that vanished): the planted path is ALSO inside the
  testkit tsconfig `include: ["test"]` typecheck surface.

## Minimal reproduction (pre-fix, this tree)

`repro-window.mjs` plants the controls exactly as the leg did (same path, same
names, same probe bytes) and runs the p4t6 spec inside the window — no scheduler
luck needed. Runner chain: `run-one.mjs` = the plain-node `scripts/run-tests.mjs`
chain (hooks + vitest-equivalent shim) for one file, identical module-load scan
semantics.

- clean tree: `run-one.mjs packages/testkit/test/p4t6-session-event-scan.test.ts`
  → PASS 10/10 (pin 1204) — and `vitest run` same file → 10 passed.
- planted window: `repro-window.mjs … run-one.mjs …` → **FAIL 9/10,
  `expectation failed: actual toBe 1204 — actual: 1206`**
  (`repro-RED-1206.log`) — the census red shape, re-earned on this tree.

## The fix (implementation-side only)

`a4p7-merge-gate.test.ts`: the control probes move from `packages/testkit/test/`
to the **repo root**. Nothing else changes — same names, same bytes, same
plant/finally lifecycle, same assertions.

Why the root keeps every property the control exists for:

- lint-visible (non-vacuous): the root is not under an eslint-ignored prefix;
  measured on this tree with the new placement planted: universe `1292` clean →
  `1294` planted — exactly the +2 the leg asserts (case (d) in
  `eslint.config.mjs` already proved root-level scratch files are linted and
  named on the `universe:` line);
- census-blind: outside `packages`, the p4t6 scanner never walks it (verified:
  `verify-window.mjs ./node_modules/.bin/vitest run p4t6…` → 10/10 green with
  both controls planted at the root); outside every tsconfig `include` (no root
  tsconfig exists; per-package includes are package dirs), so the same-window
  typecheck collision class is gone too;
- not gitignored (`git check-ignore` exit 1 on the names), so `withScratch` /
  porcelain semantics of the leg are untouched.

No judgement-threshold, baseline, or census-serialization changes; the p4t6
scanner and its 1204 pin are byte-identical (scanned surface unchanged → no
re-anchor required by the booking rule).

## Regression battery (post-fix, this worktree)

Prerequisite: the fresh worktree needed `pnpm build` + `pnpm run build:composition`
for the composition-smoke leg to run at all (that leg is RED BY DESIGN in a
never-built checkout — the same account as the a4-pr7 FINDINGS control-worktree
case). Built from the untouched committed sources; the tracked
`packages/runtime/dist` mirror came back byte-identical to the index
(`check-artifacts-committed` `verdict=ok compared=1748 glue=9`, `build.log`).

| leg | command | verdict |
| --- | --- | --- |
| p4t6 solo (canonical vitest) | `vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | 10 passed, pin 1204 — scanned surface unchanged, no re-anchor owed |
| p4t6 (plain-node chain) | `run-one.mjs` same file | 10/10 PASS |
| p4t6 in NEW-window | `verify-window.mjs vitest run p4t6…` (both controls planted at root) | 10/10 green — window is census-blind |
| census-shape round | 10 live `vitest` p4t6 captures while the full a4p7 suite ran | 10/10 green each; **capture-9 observed `root-controls-present=2` — a real in-window capture, still 1204** (`regression-census-shape-10captures.log`) |
| a4p7 suite | `vitest run packages/testkit/test/a4p7-merge-gate.test.ts` | **35/35 passed** (`regression-a4p7-suite.log`), incl. the scratch-isolation leg (38.4 s) measuring the root placement's before/+2 control itself |
| a4p7 siblings | `a4p7-blueprint-version-clean` + `a4p75-composition-smoke-classification` | 114/114 passed |
| typecheck | `pnpm -r run typecheck` | exit 0 (`regression-typecheck.log`) |
| eslint (repo) | `pnpm lint` | exit 1 = the disclosed baseline state (76 distinct identities); identity gate below |
| identity set, no-new check | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | **new 0, resolved 0**, universe 1292 (`regression-lint-identity-diff.log`) — the same gate also runs inside the a4p7 suite |
| red-shape honesty | pre-fix `repro-window.mjs` against the OLD location after the fix | still `1206` (the reproduction instrument is untouched; the leg no longer writes there) |

## Files

- `repro-window.mjs` — pre-fix deterministic window injection (plants at the OLD
  location; kept as the reproduction instrument).
- `run-one.mjs` — single-file plain-node runner (same chain as `run-tests.mjs`).
- `verify-window.mjs` — post-fix isolation check (plants at the NEW location).
- `repro-RED-1206.log` — the recorded 1 red capture.
- `regression-*.log`, `build.log` — post-fix regression battery (see table).
