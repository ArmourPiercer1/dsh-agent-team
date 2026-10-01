# PR #56 — client control subject/payload/display fix — evidence summary

Task branch: `task/pre-alpha3-pr56-client-panel` (base `1385f1ee060830bb0f550860d4bd81901c319063`).
All commands run in `.worktrees/pr56-client-panel`.

## TDD (RED → GREEN)

- RED (model layer, adapter spec, before implementation): 24 tests → 21 failed / 3 passed
  (the 3 passing controls: golden digest pairing, broken-identity skip, instance-abandon
  pre-ruling byte-stability). RED (render layer, panel spec, before UI implementation):
  14 tests → 13 failed / 1 passed. Captured and reported to the coordinator at the time
  (raw texts not retained across the session checkpoint; the final GREEN runs + the
  stock-master defect RED below are this record's durable evidence).
- Stock-master base-defect RED (rule B.1, uniform abandon): `02-red-stock-instance-abandon.txt`
  — the same spec run with all PR#56 source changes STASHED (tree = stock 1385f1ee):
  7 failed / 1 passed (the 1 passing is the deliberate durable-fact-only negative).
- Source proof (rule B.1a): `01-source-proof-abandon-at-1385f1ee.txt` —
  `git grep -n -i abandon 1385f1ee -- packages/client/src` → zero hits (exit 1).

## Full client suite (packages/client: `npx vitest run`)

- STOCK baseline @1385f1ee (changes stashed): `04-baseline-stock-full-suite.txt` —
  51 files / 780 tests → 777 passed / 3 failed. The 3 failures (pre-existing, out of scope):
  1. `test/team-creation-panel.client.spec.tsx > TeamCreationPanel > selecting a blueprint loads the detail block and fires the persona-fact probe (S5-A, UI §6/§7)`
  2. `test/team-creation-panel.client.spec.tsx > TeamCreationPanel > switching the runtime preset re-runs the probe with the new persona fact (UI §7.3)`
  3. `test/team-governance.client.spec.tsx > TeamGovernance > an override reset targets the member instance (scope instance) and pulls once on success`
- WITH PR#56 changes: `03-full-suite-with-changes.txt` —
  53 files / 830 tests → 825 passed / 3 failed / 2 skipped. ZERO NEW FAILURES
  (identical 3 test ids; the 2 skips are the DECLARED-UNKNOWN-#1 PENDING USER DECISION
  (options A/B) tests in `pr56-control-subject-payload.test.ts` and
  `pr56-control-panel-payload.client.spec.tsx`).
- New specs: `pr56-control-subject-payload.test.ts` 31 passed / 1 skipped;
  `pr56-control-panel-payload.client.spec.tsx` 17 passed / 1 skipped.

## Golden pairing (test-only, no product-side hash)

`pr56-control-subject-payload.test.ts` pairs the hand-modeled non-sensitive S9 review
payload against the FROZEN WIRE digest
`sha256:6b3a9145e46f1b2a2cfa7b195256536eccc9514b38fbfec21b6f567d02d32d41`
using `canonicalJsonStringify` imported from `packages/contracts/src/remote-safe.ts`
+ node:crypto `createHash` in the TEST only. The evidence JSON file itself was read via
`git show` and hand-modeled; it was never staged/committed.

## Build / dist coherence

- `pnpm build` → exit 0 (`05-build-composition.txt`).
- `pnpm build:composition` → regenerates `packages/client/composition-shim/client-bundle.js`
  (1170251 B, 91 modules); `check-artifacts-committed` reports the regenerated bundle as
  content-drift to be staged — the regenerated bundle IS committed in the same commit as
  the source (the commit-then-check passes).
- `pnpm smoke:composition` → FAILS IDENTICALLY ON STOCK 1385f1ee (pre-existing, not caused
  by this PR): `06-smoke-composition.txt`.
- Typecheck `packages/client` (`tsc -p tsconfig.json`) → exit 0. ESLint on all changed
  files → exit 0.

## Live things NOT run (task law: no host/browser/live anything)

- No `:3080` / `:3180` interaction; no `tests/deepseek-harness-test-use` host boot; no
  DSH_HOME world; no real browser UI acceptance (stage-2 pending).
- No push to master; no force-push; single forward push of this task branch (authorized).

## ADDENDUM — coordinator-frozen external batch (three items, this commit)

Scope: exactly three externally-verified defects + the Option-A wording
resolution; all other source accepted; NOTHING ELSE touched; option B
NOT implemented (deferred to Alpha3, no protocol fields).

1. LEGAL `reviewPayload: null` CRASHED the whole TeamView —
   `typeof null === 'object'` passed the classifier guard and the schema
   leaf read indexed into null (`TypeError: Cannot read properties of
   null (reading 'schema')` — captured in `07-batch-red.txt`). FIX:
   null-guard in the schemaId classifier. GREEN pins: null/scalar/array
   payloads survive the FULL adapter→DOM pipeline as inert safe text,
   never classified recovery-v1, Allow unaffected (model + render).
2. STRICT subject-leaf validation (parseSubject mirror, service.ts
   L436-462) + legacy-leaf rule (L610-616): the kind's own id leaf must
   be present AND the other two kind leaves ABSENT; a non-instance
   subject carrying `targetInstanceId` fails closed; an orphan decision
   with an EXPLICIT malformed `scope.subject` becomes an
   unsupported-subject chain with NO legacy fallback (ABSENT subject +
   targetInstanceId stays the byte-stable legacy flow — regression
   guard included). This is the malformed-input fail-closed promise this
   PR made — the server rejects these shapes at WRITE time; NOT an
   authorization bypass; no protocol fields.
3. DIGEST TRUNCATION CSS: `.controlField dd` (0,1,1, ellipsis trio)
   out-specified the lone `.controlDigestValue` (0,1,0) — full wire
   digest could render TRUNCATED in narrow panels. FIX: selector raised
   to `.controlField dd.controlDigestValue` (0,1,2) with the beating
   declarations; nothing else restyled. Test honesty: jsdom does NOT
   apply the CSS-module cascade, so the test asserts class application
   through the real pipeline + the STATIC stylesheet specificity
   (labelled in the test name); the narrow-panel wrap check lands in the
   real-UI acceptance round.

Wording resolution (user decision, same batch): DECLARED UNKNOWN #1 →
ACCEPTED LIMITATION — USER OPTION A (payload+digest-absent rows are not
protocol-identifiable; plain subject mode, disclosed); the two
`PENDING USER DECISION (options A/B)` skipped tests converted to GREEN
pins of the accepted behavior (suite now has ZERO skips). UNKNOWN #2
relabeled deferred; NOT implemented.

RED→GREEN (both specs): `07-batch-red.txt` 9 failed | 60 passed →
`08-batch-green.txt` 69 passed | 0 failed.
FULL suite (`09-full-suite-batch.txt`): 846 passed | 3 failed | 0 skipped
(849) — failure set IDENTICAL to the three pre-existing out-of-scope
failures (`team-creation-panel` persona-probe ×2, `team-governance`
override-reset); zero new failures. tsc -r exit 0 (`10`); eslint exit 0
(`11`); composition regen + freshness gate (`12`+`13`).

## ADDENDUM 2 — run5 380px geometry FAIL: minimal CSS width-budget fix (FORMAL GO)

Read-only diagnosis first (four observer PNGs + geometry JSON): at 380px
the host auto-collapses the sidebar to the 56px rail (columns.ts
SIDEBAR_AUTO_COLLAPSE=1024 / SIDEBAR_COLLAPSED=56 — designed behavior;
center 324px, allowed down to zero when the right track is absent) and
the plugin panel box measures 201px. Inside, `.resolveBar` (one
non-wrapping flex line) let the flex:none Allow/Deny buttons + gaps
(~128px) squeeze `.controlDetail` (flex:1 1 auto, min-width:0) to ~60px;
the non-shrinking `.controlField dt` labels (digest label ~160px) then
left <=0 for the min-width:0 values — with the digest's deliberate
break-all the value min-content is ONE character (clientWidth 0,
scrollHeight 980 = one char per line; payload pre floor 12px). The
frozen-batch #3 (0,1,2) override was verified LIVE in the bundle and
orthogonal (computed white-space normal; the observer's clip pins pass —
this is a width budget, not truncation).

FIX (CSS only, TeamLedger.module.css; no JSX/protocol; host untouched):
① `.resolveBar{ flex-wrap: wrap }`; ② `.controlDetail{ flex: 1 1
min(100%, 20rem) }` (basis floor — at a 181px bar the dl basis resolves
to 181 and fills line 1, buttons wrap to line 2; at >= ~452px content
basis 20rem keeps buttons right-beside, so the 1440/675 layout is
preserved by construction — the parent's flex-wrap-alone warning is
addressed by the basis, not the declaration count); ③ `.controlField{
flex-wrap: wrap }` (dt+dd share a line only while BOTH flex bases fit;
the value then gets the full list width on its own line — RID 62+6+147
stacks below 215px and renders fully at 181; digest stacks and wraps at
~27ch/line instead of 1); ④ `.row{ flex-wrap: wrap }` (chips/badges drop
to their own line instead of clipping under `.rows`).

RED->GREEN: four STATIC stylesheet pins (jsdom performs no layout — same
honesty discipline as the batch #3 pin) `14-layout-red.txt` 4 failed |
27 passed -> `15-layout-green.txt` 73 passed (both PR56 specs).
FULL suite `16-full-suite-layout.txt`: 850 passed | 3 failed | 0 skipped
(853) — fail list BYTE-IDENTICAL to the baseline trio
(`diff 16-baseline-faillist.txt 16-faillist.txt` empty). tsc -r 0
(`17`); eslint 0 (`18`); composition bundle regenerated in THIS commit
(`19`/`20`). Real-UI 380/1440 oracle re-run stays with the stage2-live
observer (no new acceptance system added here).
