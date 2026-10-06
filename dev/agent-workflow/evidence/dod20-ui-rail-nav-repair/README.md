# dod20-ui rail navigation repair — source + offline-test evidence (2026-10-05)

Scope: **source/test only**. No host, no Chrome, no wrapper, no acceptance run, no
access-mode change, no retry. The one approved real-Chrome run (job `bash-2336`,
stamp `2026-10-05T18-50-45Z`, outer exit 2) stays the terminal live authority; its
evidence under `/srv/workspace/dsh-plugins/dsh-agent-team/.rt-vrme5k5c/` was read
read-only and is unchanged. Branch `task/dsh-020rc2-upgrade-20261003`, base commit
`ed9e2c09b02ca0e04f4f5cdb03c51abf42d9bb29`. Pinned test-use
`639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2): porcelain **0** before and
after this work.

## 1. What the live run actually proved (and what it did not)

Raw `.rt-vrme5k5c/out/dod20-driver-out.json`: `E2 PASS`; `E1` and `E3E5`
`NOT_RUN / fail-closed: locate-not_found` with `diag {hits: 0, railRowCount: 0}`;
`E4 NOT_RUN` (frozen record). No `fatal`.

PROVEN (from pinned source + the built bundle + the retained world):

| # | Fact | Evidence |
| --- | --- | --- |
| P1 | `ROW_CLUE = 'W0d-vW_title'` matches nothing the pinned product can render | 0 hits tree-wide in `tests/deepseek-harness-test-use` (incl. the built `packages/client/ui-workspace/lib/client.js`); `.title` ships as `_6kVdha_title`. Prefix comes from `tsdown.client.ts` → lightningcss `cssModules:{pattern:'[hash]_[local]'}`, hashed from the **file path** (two byte-identical `.module.css` files compile to different prefixes), so it rotates with generation and checkout path. |
| P2 | With no clue leaf, `groupCollapsed()` returned `false`, so the expand click was **never issued** while `steps` still recorded `expand-ungrouped-group` | old driver `:163-171` + `:668-676` (unconditional `steps.push` before the predicate). |
| P3 | Group state is only representable as `aria-expanded`; a collapsed group legitimately renders zero session rows | `Rows.tsx:245-247`, `WorkspaceBrowser.tsx:423`, `expandedGroups :331-337`, `COLLAPSED_SESSION_LIMIT = 5` (`:54`). |
| P4 | The acceptance targets sit in the **Ungrouped** bucket (`data-row-key="workspace:"`, `UNGROUPED_KEY = ''` at `tree.ts:19`), 9 titled rows, none archived/pinned; the one foreign-workspace row (`ws`) is a sibling group | `tests/homes/tvs-smoke-2026-10-05T18-50-48/storages/workspace.json` (one workspace `40d5679e…` title `ws`, 1 session) + `storages/session_projcache/sessions/*.json` (11 rows, 9 `ack:*` mpr titles, all unique, boot row `title:null/blank:true`). |
| P5 | The live rail state at failure was **English UI, `ws` expanded, `Ungrouped` collapsed with zero rows** | the run's own `.rt-vrme5k5c/out/shot-E2-ordinary.png` (read as an image this round): folder rows `ws` (1 child) and `Ungrouped` (no children). |
| P6 | Titles were never the problem: the searched strings equal `rows.title.val` byte-for-byte | `dod20-driver-out.json` diag titles vs the projcache records. |

NOT PROVEN (do not upgrade these into claims):

* Which single cause fired *first* on the live page — the failed leg captured no
  rail DOM and no screenshot (only `shot-E2-created/ordinary.png`).
* The live compiled class string, live locale, and live sidebar geometry — no DOM
  dump exists. P1 proves the clue *cannot* match; it does not prove the tree looked
  any particular other way.
* `railRowCount: 0` cannot distinguish "class changed" from "no rows rendered": the
  old counter measured clue-matching leaves. The new counter counts distinct
  `data-row-key="session:*"` rows.
* Whether the 280-tuple→18-tuple proxy observation was app traffic at all
  (unchanged caveat from the v4 report).

Secondary latent defects found while reproducing (each now covered by a test): the
fixed rail bound (`railMaxX 260` + 8) cannot classify rows because the product
allows 264/280/420 (`ui-layout/src/client/columns.ts:13-17`); the overflow detector
was English-only (`/^Show \d+ more sessions$/` vs `展开其余 {n} 个会话`,
`locales.ts:32/:151`); `locateTitle` matched any rail leaf by text, so a hover-card
duplicate could turn a valid locate AMBIGUOUS.

## 2. The repair (driver only)

`tests/kits/team-view-sync-complete-e2e/dod20-ui-driver.mjs`:

* collector (`railCollectorSource`) now also emits, per leaf, the owning row's
  `data-row-key` (`key`), `aria-expanded` (`expanded`), `aria-selected`
  (`selected`) and `role`; a leaf inside a `session:`/`workspace:`/`overflow:` row
  is rail-scoped **by that key**, so no fixed x decides row identity.
* new structural helpers `railRows`, `rowExpanded`, `collapsedGroupRows`,
  `locateSessionRow`, `railDiagnostic`; `groupHeaderLeaf` / `groupCollapsed` /
  `overflowPending` / `locateTitle` re-defined on the same semantics (class,
  English label, region and row-count inference removed from the decision path).
* `navigate()`: opens only rows that report `aria-expanded="false"`, one row per
  pass, re-reading the attribute after each real click (a click that does not flip
  it fails closed as `group-still-collapsed-after-click:<group>`); overflow clicked
  by `data-row-key^="overflow:"` + `aria-expanded="false"`, bounded at 3; target =
  exact `data-row-key="session:<canonical id>"` **and** exact canonical title,
  unique, else `locate-not_found` / `locate-ambiguous`.
* first locate failure now writes bounded, scrubbed **structural** rail
  diagnostics (`out.legs.<leg>.locateFailure`) plus `shot-<leg>-locate-<status>.png`.
  The snapshot is row keys + aria state + ≤12 texts clipped to 48 chars through the
  existing `redactOut`/`scrubEvidence` path — no HTML, no class hashes, no URLs.

Unchanged on purpose: `verifySelection` (header leaf must equal the raw session id
**and** a fresh `team.getReadState` request bound by `reqSeq` to a 2xx response with
equal `rpcId` and the expected `relation`/`memberInstanceId`), Team-tab attachment
preconditions, every E1/E2/E3/E5 oracle and threshold/tick/request/window rule, the
E4 frozen `NOT_RUN`, the live `--confirm-live` gate, browser ownership/teardown, the
wrapper 860 s + 30 s envelope, both wrapper scripts, every retained world, carrier
and prior evidence file.

## 3. Tests — RED first, then GREEN (all offline, no browser executable)

New file `tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-dom.test.mjs`
(17 tests) runs **the same seam the live lane uses**: the exported
`railCollectorSource()` string is executed verbatim (same
"exported-source-string under the repo's own jsdom" pattern as
`DIALOG_STATE_SOURCE`/`probeMarkup`) over markup transcribed from the pinned
`Rows.tsx`/`WorkspaceBrowser.tsx`, with a fake layout engine giving real
`getBoundingClientRect()` geometry (incl. `display:none` subtrees), and the
exported `navigate()` clicking **by coordinates** that bubble to real listeners.
There is no second navigation model: delete the structural navigation and these
tests redden.

RED (driver untouched, `navigate` merely exported for the seam):
`node --test tests/kits/team-view-sync-complete-e2e/dod20-ui-driver-rail-dom.test.mjs`
→ exit 1, `tests 16 / pass 3 / fail 13`, log
`RED-rail-dom-20261005T193125Z.log`. The headline failure reproduces the live
signature: `FailClosed: locate-not_found` at the same driver line, with
`railRowCount: 0` once the fixture's class prefix is rotated (and 2 — two group
titles — when the stale clue happens to be present, which is exactly why the old
counter was uninformative). One earlier capture is kept for the record and is
NOT the RED statement — `RED-rail-dom-20261005T192935Z.log` failed inside the new
harness itself (`WeakMap.clear`, plus an invalid identifier in the first unlogged
attempt), so it never reached the driver.

GREEN battery (final run, `GREEN-final-20261005T193807Z-*.log`, every log this
directory):

| command | exit | tests |
| --- | --- | --- |
| `node --test …/dod20-ui-driver.test.mjs` | 0 | 82 pass / 0 fail |
| `node --test …/dod20-ui-driver-orchestration.test.mjs` | 0 | 49 / 0 |
| `node --test …/dod20-ui-driver-rail-dom.test.mjs` | 0 | 17 / 0 |
| `node --test …/dod20-ui-driver-ownership.test.mjs` | 0 | 12 / 0 (source locks intact) |
| `node --test …/carrier-import-preflight.test.mjs` | 0 | 6 / 0 |
| `node …/live-token-redaction-check.mjs` | 0 | all assertions green |
| `npx vitest run packages/testkit/test/rc2-kit-pin-hygiene.test.ts` | 0 | 7 / 0 |
| `npx vitest run` (whole repo, `…-root-vitest.log`) | 1 | 5396 pass / 22 fail (456 files) — **pre-existing, unrelated**, see below |

166 kit tests total. An earlier intermediate battery (`GREEN-20261005T193735Z-*`)
is kept; it predates the diagnostic-redaction test (81 vs 82 in the pure core).
Baseline runs of the untouched suites before any edit: `baseline-*.log`, all exit 0.

Root-suite attribution: the 22 failures sit in
`packages/{domain,runtime,tools,client,testkit}` (t1-capability-schema,
p6t3-mediation/restart, p4t6-session-event-scan, …). Vitest does not collect
`tests/kits/**` at all (`vitest.config.ts` include is `packages/*/test/**/*.test.ts`),
and none of those files imports anything from this kit — the 7 testkit/runtime
tests that DO read `tests/kits` (rc2-kit-pin-hygiene / -fixture-invariants /
-wire-shape / -fault-injection / -preset-seam, mcp-blueprint-initial-grant,
rc2-team-deny-least-privilege) are all in the passing set, and pin-hygiene was
also run standalone (7/0). Against the same branch's earlier full-suite logs
(`../dsh-020rc2-upgrade/logs/root-vitest-current-e89063c8-plus.log`: 13 failing
files; `root-vitest-head-4e2d7976.log`: 9), this run's failing set is those same 13
files plus `p6t1-parallel` and `rc2-persona-probe`. Neither of those two reads
`tests/kits` (`grep -c tests/kits` → 0) and both are intermittent on their own: four
isolated re-runs of just those files gave 21/22, 20/22, 22/22, 21/22 passing, the
same two `p6t1-parallel` "distinct child Sessions" assertions coming and going
(`…-delta-isolation.log`). They are recorded as pre-existing `packages/runtime`
flakiness under load — NOT attributed to this commit, and equally NOT claimed as
"the root suite is green", because it is not. `p4t6-session-event-scan` scans
`packages/**` only, so a new `tests/kits` file cannot move its pin — and its
failure here is the same stale-pin drift recorded at the branch's earlier HEADs
(`expected 964 to be 958` at `e89063c8+`, now `expected 971 to be 968`): this commit
adds nothing under `packages/**`.

Coverage added for the required cases: fresh-context collapsed group; rotated class
prefix (`aB3xYz`/`qZ9tT2`/`W0d-vW` all navigate identically); sidebar 264/280/420;
zh and en group + overflow labels; collapsed vs already-expanded Ungrouped (never
toggled shut); an expanded group with zero rows (aria-expanded, not row count);
a target in another workspace; bounded overflow reveal; no-op/still-collapsed
click; missing target (+diagnostics and screenshot assertions); duplicate same-key
rows AMBIGUOUS; duplicate title in a hover card NOT ambiguous; `display:none`
duplicate ignored; same-id row with a changed title NOT_FOUND; and a row that
renders/selecteds without any `getReadState` round → `selection-unverified`.

Fixtures (`dod20-ui-driver-fixtures.mjs`) were rebuilt to the product's semantics
(`role=treeitem`, `data-row-key`, `aria-expanded/selected`) with an **invented**
class prefix and the canonical title→id map from the retained world, and the
orchestration fake page now emits the same leaf record shape the collector emits —
the offline rail fiction is gone rather than paralleled.

NOT RUN (stated rather than implied): no Chromium/Playwright execution, no real
acceptance rerun, no host/provisioner run, and E4 stays `NOT_RUN` (unit/E2E-layer
frozen record; no new browser run). `pnpm lint` / `pnpm typecheck` /
`pnpm check:artifacts` were NOT re-run: `eslint.config.mjs` ignores `tests/**`
(so `tests/kits/**` is outside the lint project by configuration), `typecheck`
covers `packages/*` only, and no `packages/*/dist` or composition artifact changed.
The whole-repo `npx vitest run` WAS run and is included above with attribution.

## 4. Follow-ups recorded, not acted on

* `tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs:183-185`
  and `pr-a-governance-smoke.mjs:107`, `team-projection-recovery-smoke.mjs:97`,
  `pr-b-effective-policy-smoke.mjs:198` still hardcode the retired
  `mpr-2026-09-27T08-35-52` seed ids — outside this repair's scope, worth its own
  task.
* A per-HEAD review (3 reviewers per ROUTER_RULES §3.1) and any push remain
  unauthorized actions for this round; commit only, no merge, no push.

Post-commit confirmation at `8c99142e` (`COMMITTED-8c99142e-194148Z-*.log`):
82 + 49 + 17 + 12 + 6 = **166 tests, 0 failures, every suite exit 0**; worktree
porcelain clean apart from these logs, `tests/deepseek-harness-test-use` at
`639ed015397290b3745d163aafe02ffee4aa3f84` with porcelain 0.
