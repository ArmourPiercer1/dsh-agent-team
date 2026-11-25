# Round 118 — P0: `.env` control, D4 correction, and the vitest population on rc.5

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, base `0b96a1fa8`. Sole writer; no history
rewrite, no merge, no non-topic push. PR **#822 stays DRAFT**. `:3080` and its `DSH_HOME` were never
touched. **CORE PATCH BUDGET = 0**: both pinned hosts are read-only; no upstream source was patched.

## A. Credential hygiene (the owner key is never a file in the tree)

- Committed the already-staged `.gitignore` lines (`# test credentials…`, `.env`, `.env.*`).
- Added a **collected negative-control test** in `tests/checks/dist-placements.test.mjs` (existing suite, so
  **zero catalog delta from this control**): (a) `.env` and `.env.*` are ignored by the tracked `.gitignore`
  with a positive control proving `git check-ignore` is not vacuous (`README.md` is NOT ignored, exit 1);
  (b) no tracked path ends in `.env`; (c) `git ls-files` carries no `.env`-like credential file and `.env`
  itself is untracked-in-index. The owner key lives in the repo-root `../../.env` (mode 600, outside this
  worktree); it was never read, printed, copied, or referenced by path in any committed file.
- Suite: `tests/checks/dist-placements.test.mjs` 13/13 pass.

## B. D4 README measurement head (stale digest → red Hosted `ci-integration`)

`node --test tests/checks/d4-evidence-consistency.test.mjs` reproduced the red: the README banner bound
`41d5791195d199190c8d808d321aaa8e4dbca030` while the probe digest binds
`5cb5c606203eaf07dd78a2a5c67b442899db2377`. Fixed by **transcribing the digest** with a dated
`## CORRECTION — 2026-11-25 (P0 round, review 20261125-2258)` note that explains the re-bind and keeps the old
head as history; the check was not relaxed. Re-run: **5/5 pass** (`gate-d4-evidence.log`).

## C. Shared-resolution Vite adapter — one authority, two adapters

The round-116 blocker was that Vite resolves bare specifiers before Node's ESM loader, and a Vite-side alias
derived from the selector would have been a **second host-selection mechanism**. This round splits selection
from transport instead:

| layer | file | role |
| --- | --- | --- |
| authority (only holder of pin/tree/specifier mapping) | `tests/next-host/host-select.mjs` | `testHostMode`, `selectedHostPin`, `selectedHostTree`, `selectedHostResolveRoot`, `createHostResolver` (built + source paths), containment, typed refusals, host-internal decline |
| Node adapter | `scripts/run-tests-hooks.mjs` | ESM `resolve` hook; asks the authority per `@deepseek-ai/*`; caches per selected generation; consults the selector on every call |
| Vite adapter | `tests/next-host/host-vite-adapter.mjs` | `resolveId` plugin (`enforce: 'pre'`); calls the SAME exported resolver; holds **no pin, no tree path, no specifier table** |
| configs | root `vitest.config.ts`, `packages/client/vitest.config.ts` | install the plugin (client: `source: true` + jsdom setup + the host-tree inline rule) |
| false-green guard | `tests/next-host/host-version-guard.mjs` | per-worker `setupFiles`: resolves `@deepseek-ai/dsh-tools/package.json` through the adapter and asserts `version === selectedHostPin().version`; throws before any test otherwise |

Refusals are typed and mode-shaped: `HOST_SELECTOR_UNKNOWN` (unknown `TEAM_TEST_HOST`), `HOST_MODULE_UNRESOLVED`
(next: a specifier that does not resolve inside the selected tree), `HOST_RESOLUTION_ESCAPED` (containment).
Under `legacy` a *miss* is declined so the runner's own resolution (the same rc.2 install) answers; it is never
silently redirected to rc.2 **under `next`**. Importers already inside either pinned host tree are declined so
a host module resolves its own dependencies from its own generation. No second mapping table exists — red
line 8 was not triggered.

Mechanical consistency test: `tests/next-host/host-resolution-consistency.test.mjs` — **12/12 green**
(`host-resolution-consistency.log`), measuring the real Node hook and a real Vite server per selector:
same file for package/subpath/`package.json`; file inside the selected root; measured version == pin
(`legacy` ⇒ `0.2.0-rc.2`, `next` ⇒ `0.2.2-rc.5`); loaded module inside the tree; unexported subpath refused
on both paths; source-preference path inside the same tree; host-internal importer declined; bogus selector
a typed refusal on both adapters; the two selectors pin different trees. It is collected and rides the
`ute-vnext-a1` leg (which is why the catalog moves by exactly one suite).

## D. The vitest population on rc.5 — measured, not counted

Population rule and every file: `POPULATION.md`. **44** collected vitest files carry a value `@deepseek-ai/*`
import (26 client + 18 runtime/testkit); the round-110 "40" was a classification count and is superseded.
**All 44 were run on both hosts**, one invocation per runner per host, with a `HOST-VERSION-GUARD` line per
worker.

| population | rc.2 | rc.5 |
| --- | --- | --- |
| 26 client suites | 24 files / 343 of 346 tests | 24 files / **343 of 346** |
| 18 runtime+testkit suites | 18 files / **186 of 186** | 15 files / **162 of 173** |
| total | 42 files / 529 of 532 | 39 files / **505 of 519** |

Classification of every rc.5 failure (no skip, no widened timeout, no weakened assertion):
one **rc.2-shaped test** (`team-timeline` tooltip: rc.2 `Tooltip` listens to mouse enter/leave, rc.5 to pointer
enter/leave — the test now fires both families; assertions unchanged, green on both hosts), three
**pre-existing host-independent** client failures (reproduced identically on rc.2 with the UNMODIFIED HEAD
config), and **11 tests in 3 runtime suites that are a real rc.5 product gap**: rc.5
`ToolsService.selectExecutor` throws `ToolExecutorUnavailableError` when the composition has no executor
(`tests/deepseek-harness-next/packages/core/tools/lib/index.js:632`), and the managed attach forwards `[]`,
which the Team assembly refuses by name (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs:1312`,
`A5SF_EXPECTED_TOOLS_UNSHADOWED`). BL-16/issue2/BL-17 file lines are in `RC5-TEST-MATRIX.md` §11.4. This is a
product-migration item, **not an adapter defect**; it is recorded as open.

Docs updated: `RC5-TEST-MATRIX.md` §11 (supersedes §4.3 row 5 / §6 item 2 / §10), plus the
`CANDIDATE-ACCEPTED` vs `PRODUCT-PROVEN` vocabulary in `OWNER-DECISIONS.md` §ROUND 118 and the status docs.
**No row is PRODUCT-PROVEN**; no row is claimed CANDIDATE-ACCEPTED by this round.

## Evidence index

| file | content |
| --- | --- |
| `gate-dispatch-ute-vnext-a1.log` | `ute-vnext-a1` 8 suites, exit 0 |
| `gate-test-catalog.log` | tests 788 / collected 736 / excluded 14 / uncollected 38; digest `sha256:15451525…` |
| `gate-ute-cut-closure.log` | `cut(0/148)` |
| `gate-ute-p0-assets.log` | `modules=37 files=180 lines=69512 cut(148/148)` |
| `gate-docs-sync.log` | docs=193 findings=0 blocking=0 |
| `gate-place-dist-glue.log` | 35 placements, byte-identical |
| `gate-eb3-ci-required.log` | `pass workflows=11 findings=0` |
| `gate-bound-vitest.log` | `ci-integration` PASS 15 suites / 238 passed / 0 failed |
| `gate-ute-g1-argv.log` | the census G1 argv, 89 tests |
| `gate-eb3-run-manifest.log` | records=634 findings=0 |
| `gate-ci-pr-gate.log` | `ci-pr-gate --full --census-captures 2` |
| `gate-d4-evidence.log` | D4 5/5 |
| `host-resolution-consistency.log` | 12/12 |
| `vitest-{client,runtime}-{legacy,next}.log` | the four population runs + guard lines |
| `POPULATION.md` | the 44-file population and per-file status |
