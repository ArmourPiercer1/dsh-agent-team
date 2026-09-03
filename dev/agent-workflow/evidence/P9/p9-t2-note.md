# P9-T2 — wire client TSX build and mechanical imports (evidence note)

Branch `task/P9-ui-legacy-reuse`, on top of 9357a5b (P9-T1 copy-only).
Scope per plan §12.3: path/import, package deps, JSX/types, module location,
test-harness import only. **No behavior change.**

## 1. What this commit does

- 13 src files: mechanical import rewrites only (`./team-*-model.ts` →
  `../model/team-*.js`, `./locales.ts` → `./locales.js`,
  `./Team{Timeline,Members,Tasks,Feed}.tsx` → `.js`). 28/28 rewrite rows
  asserted exactly-once by `p9-t2-rewrite.ps1` (28 OK / 0 fail).
- 10 test files: `../src/client/X` → `../src/ui/X.js`,
  `../src/client/team-*-model.ts` → `../src/model/team-*.js`,
  `../src/client/locales.ts` → `../src/ui/locales.js`. Two multi-line import
  edges (team-feed-model spec, team-timeline-model spec) were missed by the
  single-line rewrite pass and fixed by targeted edit before the first green
  classification.
- `packages/client/package.json`: `@dsh-agent-team/remote: workspace:*` +
  6 `link:` devDeps + react stack + `@types/node`.
- `tsconfig.json` / `tsconfig.build.json`: `"jsx": "react-jsx"` +
  `"lib": ["ES2022","DOM","DOM.Iterable"]` (build face); tsconfig.json
  excludes the 4 deferred specs (2 × S7-ADAPT-until-T7, 2 × S7-DROP-at-T10).
- `src/css-modules.d.ts` (NEW): verbatim 6-line DSH standard module
  declaration for `*.module.css` / `*.css`.
- `src/plugin/client.ts`: moved-verbatim `LocaleNamespaceMap.team`
  declaration merge (provenance: legacy `src/client/index.ts:47-52`, which
  plan §12.1 does not carry — only the merge is needed for
  `PropsLocale<'team'>` typing; type-only, no JS output change).
- `vitest.config.ts` (REWRITTEN): preserveSymlinks + explicit react/react-dom
  dedupe aliases (single React identity across the workspace symlink boundary);
  include = 12 retained specs; exclude = the 4 deferred specs.
- `test/team-view.client.spec.tsx`: fixture extended with 6 no-op stubs for
  the current-DSH slot-contract delta (see §5). Component unchanged.
- `pnpm-lock.yaml`: updated by `pnpm install --ignore-scripts
  --no-frozen-lockfile` (CI=1 otherwise forces frozen-lockfile and fails on
  the new deps).
- `packages/testkit/test/p4t6-session-event-scan.test.ts`: repo-gate
  restoration (see §7).

## 2. Dependency strategy (link: 4-level paths)

`references/` is gitignored and therefore **not materialized inside the
worktree**; `link:` paths from `.worktrees/P9/packages/client/package.json`
need FOUR levels up to reach the main checkout:
`../../../../references/deepseek-harness-test-use/{vendor/cordis,
packages/client/locale, packages/client/ui-conversation,
packages/client/ui-primitives, packages/client/ui-slots,
packages/test-support/client-runtime}`. All six targets verified to resolve,
and all six (plus client-runtime deps) carry **built gitignored `lib/`**
in the pristine test-use checkout — so both tsc (lib/types) and vitest
(lib ESM) work **without building or modifying test-use**. Zero writes into
`references/` in this task (byte-clean obligation preserved).

Resolved versions (test-use store parity): react 18.3.1, react-dom 18.3.1,
@types/react 18.3.31, @types/react-dom 18.3.7, @testing-library/react
**16.3.3** (test-use pins 16.3.2; +0.0.1 minor drift, recorded, harmless),
@types/node ^22.20.0 (added: vitest.config.ts `import.meta` + `node:module`
require surfaced TS2591 otherwise — no other vNext package imports node
builtins).

## 3. TS lib decision

`lib` kept at the vNext ES2022 base (DSH upstream uses ES2024); the client
package's legacy sources compile cleanly under ES2022 + DOM. Recorded here so
the choice is auditable; no source edit was needed for it.

## 4. Staged-red expectation (T2 → T4)

Client tsc is red ONLY on:
- **Class A** — TS2307 `Cannot find module
  '@deepseek-ai/dsh-client-runtime/client'` (23 × full typecheck: 12 errors
  over 10 src files — 4 model .ts, TeamDock.tsx ×2 (type + value import),
  TeamFeed/TeamMembers/TeamTasks/TeamTimeline.tsx, TeamView.tsx ×2 — plus
  11 errors over 10 retained specs; 12 × build face: the 10 src files only).
  Every hit is the legacy
  runtime import that the T3+ data layer replaces (types: TeamView,
  TeamMessageView, RpcResult, RpcError, TeamMessagePage, SessionId, TeamMirror,
  MessageAnchor; values: `resolveTeamView`).
- **Class B** — derivatives of A: 9 × TS7006 implicit-any params, 2 × TS7053
  any-indexing into locale const maps (TeamFeed.tsx:123, TeamTasks.tsx:79),
  1 × TS2366 non-exhaustive switch (TeamTasks.tsx:38 — `TaskStatus` is class-A
  `any`, so TS cannot see the switch is exhaustive). All resolve when the
  real types land in T3/T4.

Full typecheck: 35 errors (t2-typecheck-3.log). Build face: 23 errors
(t2-build-1.log). No other error classes exist; verified by histogram +
per-module group. tsc emits `dist/` despite errors (noEmitOnError unset) —
`dist/` is gitignored and was removed after the build probe.

## 5. Current-DSH slot-contract delta (fixture stubs)

Legacy fixtures predate the current `PropsRuntime<'conversation.view'>`
composition (four shares over the linked contract packages). The
team-view spec fixture needed six additions, all no-op stubs (the component
never reads them in these specs; Seam 4 keeps jump degraded/hidden):

| prop | source merge | stub |
| --- | --- | --- |
| `viewRequest` | ConvViewOwnerProps (ui-conversation) | `null` |
| `openView` | ConvViewOwnerProps | `() => {}` |
| `completeViewRequest` | ConvViewOwnerProps | `() => {}` |
| `useConversation` | SessionStandardProps ← ui-conversation | cast no-op |
| `useChat` | SessionStandardProps ← ui-chat (pulled in via test-runtime types) | cast no-op |
| `useSessionPendingInteraction` | GlobalStandardProps ← ui-session | cast no-op |

Mechanical test-harness adaptation to the current-DSH contract; **no
component change**. `SessionStandardProps`/`GlobalStandardProps` are
merge-extensible (base empty in ui-slots; members merged by
ui-conversation/ui-chat/ui-session) — the full merged set was enumerated
from the pristine test-use sources before stubbing (no whack-a-mole).

## 6. Harness-environment finding (vitest cannot start in this sandbox)

Real vitest cannot start under this sandbox class: vite 8.2.2
`optimizeSafeRealPathSync()` calls `exec("net use")` on first
`windowsSafeRealPathSync` → synchronous `spawn EPERM` throw (persistent per
P1-T5 evidence: node→child piped stdio = EPERM). No env opt-out exists.
Consequences:
- In-sandbox repo gates = `node scripts/run-tests.mjs` (flat
  `test/*.test.ts` only, native TS type-stripping, shim matchers) + per-package
  tsc. **2170/2170 green** post-fix (this commit).
- The 12 retained legacy vitest/jsdom/@testing-library specs (10 runnable at
  T2 + team-plugin/client-bundle from T7) execute via the out-of-sandbox gate
  runs and the S8 vertical instance (port 3180). Plan S7/T10 + DoD15 do not
  require in-sandbox vitest execution; the T0 baseline acceptance set the
  in-sandbox gate precedent.
- T2-runnable suite definition: the 10 specs whose imports close over
  packages that exist at T2 (6 mechanical-adapt specs + feed-model, feed,
  tasks, view). team-dock + team-view also import `resolveTeamView` (value,
  class A) — dock red until T4; view red until T4 as well (its spec passes
  `resolveTeamView` through the fixture). team-plugin/client-bundle = T7;
  the 2 marker specs = DROP at T10 (excluded from vitest.config include and
  tsconfig now so the deferred state is explicit).

## 7. Repo-gate restoration: p4t6 denylist scan (T1 debt, fixed in T2)

The P4-T6 frozen-vocabulary scan (`packages/testkit/fault-injection/
session-event-scan.mjs` + its pinning test) was **already red at 9357a5b**:
- P9-T1 added 11 scanner-visible files (4 model .ts + ui/locales.ts + 6
  spec .ts; .tsx/.css are outside the frozen extension set) → count pin
  560 → 571, and the T1 commit carried no update to the pinning test
  (plan §12.2 allows T1 to "暂时不 compile", but the repo test gate still
  broke silently).
- The verbatim copy of `team-marker-definition.client.spec.ts` carries 6
  legacy event-string fixture tokens (team/progress, team/control-request,
  team/control-decision, team/message, 2× team/member-bound) — an inherent
  property of the frozen-DROP marker vocabulary; the spec is excluded from
  the vNext build anyway (its imports point at marker source files that
  §12.1 routes to review scratch, not into the package).

T2 restores the gate (evidence: t2-testkit-fail.log pre-fix, 3 failures):
1. Coverage pin 560 → 572 (= 560 + 11 T1 + 1 T2 css-modules.d.ts) with the
   running per-batch enumeration appended (the test's own convention since
   P4).
2. `QUARANTINE_FILES` gains the one token-carrying file with a recorded
   adjudication: temporary until **P9-T10 removes the spec AND this entry**,
   restoring the original two-file frozen set. The `.tsx` marker spec is
   outside the scanner's extension set (no entry needed).
3. The pinned-hit manifest extended 15 → 21 (six lines, file-sorted), summary
   assertions 15 → 21.

Result: `node scripts/run-tests.mjs` = **2170/2170 PASS**; testkit tsc clean.
`scan-dump.mjs` (next to this note) reproduces the hit dump.

## 8. Gate state at T2 commit

| gate | state |
| --- | --- |
| `node scripts/run-tests.mjs` (full repo) | 2170/2170 PASS |
| testkit tsc | clean |
| client tsc (tsconfig.json) | 35 errors — class A/B only (staged red by design until T4) |
| client tsc (tsconfig.build.json) | 23 errors — same classes, src only |
| client vitest (in-sandbox) | not runnable (harness limitation, §6) |
| test-use checkout | untouched (byte-clean) |

## 9. Log index

- t2-typecheck-1.log — run #2 (57 errors, pre-namespace-fix; superseded)
- t2-typecheck-2.log — run #3 (37 errors, pre-fixture-stubs; superseded)
- t2-typecheck-3.log — final full typecheck (35 errors, class A/B)
- t2-build-1.log — build-face typecheck (23 errors)
- t2-testkit-fail.log — p4t6 pre-fix failures (evidence for §7)
- scan-dump.mjs — scanner dump helper (reproduces the §7 hit list)
