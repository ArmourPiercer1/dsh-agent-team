# A4-PR7 W4 — W1 warning-surface UI fixes (external-review F1 + F2)

**Branch** `fix/a4-w4-corrupt-warning-ui` (worktree `.worktrees/w4-ui`, base `origin/master` = `5cb82d83`).
**Scope actually touched**: `packages/client/**` only (4 sources, 2 test files) + the rebuilt client
artifact + this evidence dir. `packages/runtime/**`, `packages/remote/**`, `packages/tools/**`,
`scripts/**`, `packages/testkit/**` and the frozen `packages/testkit/test/a4p7-merge-gate.test.ts`
were **not** edited. No execution semantics, no v9 DTO field, no governance isolation, no polling,
no recovery mechanism, no `:3080` contact. CORE PATCH BUDGET untouched (0 core patches).

---

## 1. What the two findings were, before and after

### F1 — a failed integrity read rendered nothing

**Before** (`packages/client/src/ui/TeamView.tsx` at `5cb82d83`): the state was

```tsx
const [corruption, setCorruption] = useState<{
  readonly view: ControlCorruptionView | null
  readonly error: { readonly code: string; readonly message: string } | null
}>({ view: null, error: null })
```

and every failure branch wrote `error` (`:760` typed refusal, `:768` malformed payload, `:780`
transport rejection) with the in-code comment *"the note is kept for diagnostics only"*. The JSX
(`:1431`) gated on `controlCorruptionVisible(corruption.view) && corruption.view !== null` and was
the **only** consumer of `corruption` — so `corruption.error` was written and never read. The
screen showed the identical nothing for "clean report", "host refused the v9 read", "payload was
malformed" and "the bridge was down".

**After** (same position in the team body, `TeamView.tsx:1449-1504`):

```tsx
{corruptionBar !== null ? ( /* the W1 bar, unchanged markup */ )
 : corruptionNotice !== null ? (
   <div className={styles.corruptionCheckNote}
        data-team-control-corruption-check-unavailable
        role="status">
     {t('view.corruption.checkUnavailable')}
     {` — ${corruptionNotice.code}`}
   </div>
 ) : null}
```

* one neutral notice, **non-dismissible, non-modal, no button, no action**, in the bar's own slot,
  above the timeline section — it never wraps or replaces the ledger surface below;
* `role="status"` (the bar keeps `role="alert"`), and `TeamView.module.css:280 .corruptionCheckNote`
  deliberately uses the **secondary label lane** (`--dsw-alias-label-secondary`) with no warn
  border/fill, so the bar (warn) and the notice (neutral) are distinguishable from each other and
  from an empty (clean) report — three visible states, not two;
* the typed `code` travels with it (`method-version-unsupported`, `malformed-response`,
  `native-error`, or the remote code) so a human can report *why* the check did not answer;
* locales `packages/client/src/ui/locales.ts` — the `TeamKey` union gains
  `'view.corruption.checkUnavailable'` at `:53`, zh at `:346`, en at `:630` (the same key in both,
  and `Record<TeamKey, string>` makes a missing side a compile error):
  * zh: `审批记录完整性检查暂不可用，无法确认是否存在损坏记录（仅提示，不改变执行语义）— 请刷新重试`
  * en: `The approval-record integrity check is unavailable: corrupt records can be neither
    confirmed nor ruled out (notice only — execution semantics are unchanged) — refresh to retry`
  * Wording law applied: it states the availability of **the check**, uses the same
    "不改变执行语义 / execution semantics are unchanged" parenthetical W1 already ships on the bar,
    and asserts nothing about a blocked, denied, refused or halted action (a test pins the absence
    of "blocked"/"denied" in the English string).

### F2 — a warning could be displayed for the wrong Team

**Before**: the state recorded no owner, `corruptionEpoch` (`:743/:753/:756/:779`) only ordered
interleaved reads, and the failure branch was literally `setCorruption(prev => ({ ...prev, error }))`
— i.e. team B's failed read **kept** team A's `view` in the state that team B's render consumed.
The read did re-fire on `corruptionTeamKey = snapshot?.teamSessionId` (`:749`, effect deps `:788-798`),
but nothing removed the old view while the new read was in flight, and the render gate never asked
which Team a state row belonged to.

**After**: the state is a **row owned by a Team** (`packages/client/src/model/control-corruption.ts`,
all pure, no React, same module W1 already owned):

| added at | symbol | role |
| --- | --- | --- |
| `:141` | `ControlCorruptionReadError` | the closed failure marker (`code` / `message`) |
| `:164` | `ControlCorruptionReadState` | `{ key, view, error }` — `key` = the `teamSessionId` the cells were read for |
| `:174` | `EMPTY_CONTROL_CORRUPTION_READ_STATE` | the empty row |
| `:190` | `corruptionStateForKey(prev, key)` | **key changed → drop the previous round immediately**; same key → identity |
| `:205` | `corruptionStateCleared(prev)` | no face / no resolved Team → empty row (identity when already empty) |
| `:219` | `corruptionReadSucceeded(prev, key, view)` | a settle may only write **its own** key |
| `:239` | `corruptionReadFailed(prev, key, error)` | same, and a same-key failure keeps the last good `view` |
| `:249/:267` | `ControlCorruptionRenderPlan` / `planControlCorruptionRender(state, currentKey)` | the single render decision |

`TeamView.tsx` wires it: the state is `useState<ControlCorruptionReadState>` (`:758`), the read
captures `const key = corruptionTeamKey` (`:768`) and every settle goes through the transitions, the
effect invalidates on a key change **before** issuing the read (`:813`), and the render reads only
`planControlCorruptionRender(corruption, corruptionTeamKey)` (`:819`, consumed at `:1449/:1486`).
`state.key !== corruptionTeamKey` renders **nothing** — no bar, no notice.

**Epoch semantics untouched**: `corruptionEpoch.current += 1`, the `!== epoch` guard on both the
`then` and the `catch`, and the `corruptionUnmounted` guard are byte-equivalent in behaviour; the
key ownership gate is layered on top, in the state updater. No cache, no store, no new layer.

**Why a same-key failure still shows only the bar (and no notice)** — recorded decision: W1's rule
"a read failure never removes a disclosure that was actually read for THIS Team" is preserved
verbatim, and the human is never misled by it: the visible state is "a disclosure exists", which is
not the confusion F1 names (F1 is "no bar means what?"). Showing both surfaces at once would put a
count from the last good read next to "cannot confirm anything" in the same slot. The mutually
exclusive `bar | notice | nothing` union is what the render test pins.

---

## 2. Test infrastructure — MEASURED, not assumed

Command and observation, on this branch's worktree:

* `packages/client/vitest.config.ts` — `test.environment: 'node'`, `test.pool: 'threads'`,
  `setupFiles: ['test/setup-jsdom.ts']`, and an `include` that covers `test/**/*.test.ts`,
  `test/**/*.client.spec.ts` and `test/**/*.client.spec.tsx`; it also builds a package→`src/`
  redirect map over `tests/deepseek-harness-test-use` (resolved by walking up, so it works from a
  worktree). `test/setup-jsdom.ts` stubs `ResizeObserver` for the 0.2.0 primitives.
* Per-file jsdom is opted in with a `// @vitest-environment jsdom` docblock: **25** files under
  `packages/client/test/` carry it, and **25** `*.client.spec.tsx` render specs exist. `jsdom ^30`
  and `@testing-library/react ^16.3.2` are declared devDependencies of `@dsh-agent-team/client`.
* **Render precedent against the component under change exists**: `test/team-view.client.spec.tsx`
  renders `<TeamView {...props} />` with a fixture projection mirror. Measured run:
  `✓ test/team-view.client.spec.tsx (30 tests) 519ms`.
* Root `vitest.config.ts` (`environment: 'node'`, include `packages/*/test/**/*.test.ts`) matches
  **zero** `*.client.spec.tsx` files — the client lane only runs from the package config. So the
  new render spec runs under `cd packages/client && ../../node_modules/.bin/vitest run` (the same
  invocation `pnpm --filter @dsh-agent-team/client run test` performs), and the extended model spec
  runs in BOTH lanes (it is a `.test.ts`).

**Consequence for this PR**: a jsdom/render precedent exists, so the mandated render-layer route was
taken. `packages/client/test/a4w4-corrupt-warning-ui.client.spec.tsx` (8 tests) asserts both
findings at the screen, and `control-corruption-model.test.ts` gained 5 pure-state cases (its W1
expectations are untouched — nothing was re-tuned). The pure transitions are exercised there
directly; they were NOT introduced as a substitute for the render tests.

### RED before the fix (captured `raw/w4-render-spec-RED.log`)

```
 × a typed read failure shows ONE neutral notice and never a corrupt-record bar 1025ms
 × a malformed payload and a transport loss take the same notice lane (every failure branch) 1004ms
 × a transport rejection takes the same notice lane 1003ms
 ✓ the notice is visually and textually distinct from a clean report (no bar, no notice) 58ms
 × the English locale carries the same key with the same neutrality (no blocked-action claim) 2ms
 × a Team switch invalidates the previous Team bar BEFORE the new read answers 58ms
 ✓ switching to a clean Team clears the previous Team bar (no stale attribution) 106ms
 ✓ a same-Team refresh failure KEEPS the last good bar (the W1 branch this fix does not touch) 58ms
 Test Files  1 failed (1)
      Tests  5 failed | 3 passed (8)
```

The F2 RED body is the defect itself: after `switchTeam(TEAM_B)` the container still held
`<div class="_corruptionBar_…" data-team-control-corruption="true" role="alert">` with
`记录 #1 #2 #3` — team A's disclosure on team B's page.
The three GREEN-at-base legs are the deliberately-unchanged branches (clean report; switch to a
clean Team; same-Team refresh failure keeps the bar) — they were already passing and still pass,
which is part of the equivalence argument below.

### GREEN after the fix (captured `raw/targeted-tests-GREEN.log`)

```
 ✓ test/control-corruption-model.test.ts (10 tests) 4ms
 ✓ test/a4w4-corrupt-warning-ui.client.spec.tsx (8 tests) 478ms
 Test Files  2 passed (2)
      Tests  18 passed (18)
```

---

## 3. Behaviour equivalence — which branches are identical to before

| branch | before | after | identical? |
| --- | --- | --- | --- |
| well-formed read, `corruptCount > 0`, same Team | bar with server's count/rows | bar with the same count/rows | **yes**, byte-equivalent markup |
| well-formed read, `corruptCount === 0` | no bar | no bar, no notice | **yes** |
| malformed payload / typed refusal / rejection, **no prior view** | nothing rendered | **neutral notice** (F1 fix) | changed **on purpose**, F1 |
| failure for the SAME Team **with** a prior good view | prior bar kept, `error` stored invisibly | prior bar kept, notice suppressed | **yes** for what is displayed; the stored `error` is now reachable but suppressed while a bar shows |
| success | `setCorruption({ view, error: null })` | `{ key, view, error: null }` | same display, plus the owner |
| no v9 face / no resolved Team / zero state | clear to `{null,null}` (identity when already empty) | clear to the empty row (identity when already empty) | **yes** |
| key change A→B, B's read **succeeds** | B's result replaced the state on settle | state invalidated at the switch, then B's result | same settled display; the in-flight window no longer shows A |
| key change A→B, B's read **fails** | **A's bar stayed** (F2 defect) | nothing from A; B's notice | changed **on purpose**, F2 |
| interleaved reads of one key | `corruptionEpoch` last-write-wins + unmount guard | unchanged | **yes** |
| manual refresh | re-issues the read via `runRefresh` (`:835` region) | unchanged call site | **yes** |
| ledger/timeline/members sections | rendered | rendered; tests assert they are present next to the notice | **yes** |

Deliberate non-changes: no change to the v9 wire, the parse (`parseControlCorruption` untouched),
the params builder, the mount seam, or the server's strict reader; `disclosesMember` wording law and
the Team-level-only rule untouched; the notice adds no new read and no new trigger.

---

## 4. Recorded limitation (no code change beyond one comment)

The read fires on **entry to the Team page, on a manual refresh, and on a Team-key change**. It is
**not a continuous watch**: a corrupt record that appears while the page sits open produces no
warning until the next read. Stated at the loader (`TeamView.tsx:754-757`, "KNOWN LIMITATION … No
polling is added") and here. Per the human ruling this PR adds **no polling, no subscription, no
recovery mechanism** — "make it live" was explicitly out of scope.

Second recorded limit (not changed): a host that predates v9 has **no `listCorruptControlLegs` face
at all**. That case renders neither surface (W1's conservative-hide posture for the legacy surface),
so on a pre-v9 host "no bar" is still not a claim about records — but no notice appears either,
because no check was ever attempted. Only an *attempted and failed* read produces the notice. The
`method-version-unsupported` refusal (a v9-capable client against a host that refuses the method)
DOES produce the notice, which is the case the review named.

---

## 5. p4t6 — NOT involved, with the measurement

The new test file is `packages/client/test/a4w4-corrupt-warning-ui.client.spec.tsx`. The p4t6
scanner's extension set is `.ts/.mts/.mjs`, so a `.tsx` spec is not inventory. No `SCANNED_PATHS_*`
list was added and the pin file `packages/testkit/test/p4t6-session-event-scan.test.ts` was **not**
edited (no reformatting, no reordering, no new constant). Measured, not asserted:

```
$ node_modules/.bin/vitest run packages/testkit/test/p4t6-session-event-scan.test.ts
 ✓ packages/testkit/test/p4t6-session-event-scan.test.ts (10 tests) 5ms      # GREEN with the new file on disk

$ node --input-type=module -e "…scanSessionEventVocabulary()…"   (raw/p4t6-scanner-direct-call-measurement.txt)
filesScanned = 1047
files.length = 1047
my tsx present in scan? false
edited model present? true        # control-corruption.ts is an already-counted path (W1 named it)
```

1047 is the reading of this tree, produced by running the scanner — no hand-written number appears
anywhere in this PR. Both files I edited under `packages/**` are `.ts` **edits** to already-counted
paths, and an edit is not an increment.

---

## 6. Suite results (all commands run in `.worktrees/w4-ui`)

| check | command | result |
| --- | --- | --- |
| targeted tests | `cd packages/client && ../../node_modules/.bin/vitest run test/a4w4-corrupt-warning-ui.client.spec.tsx test/control-corruption-model.test.ts` | **18 passed** (`raw/targeted-tests-GREEN.log`) |
| client lane full | `cd packages/client && ../../node_modules/.bin/vitest run` | **2 failed / 55 passed (57) files; 3 failed / 895 passed (898) tests** (`raw/client-suite-full.log`) |
| client lane BASE | same command with the client changes stashed | **2 failed / 54 passed (56) files; 3 failed / 882 passed (885) tests** (`raw/client-suite-BASE.log`) |
| root suite BASE | `node_modules/.bin/vitest run --reporter=json …` + `scripts/fail-set.mjs capture` | **9 identities** (`raw/root-failset-BASE.txt`) = the published tolerance set |
| root suite HEAD | same at the committed HEAD | **9 identities**, diff vs base = **`NEW=0 FIXED=0`** (`raw/root-failset-HEAD2.txt`, `raw/root-failset-DIFF-postcommit.txt`) |
| typecheck | `node scripts/ci-pr-gate.mjs … --only typecheck` (`pnpm -r run typecheck`, all packages incl. tests) and `cd packages/client && ../../node_modules/.bin/tsc -p tsconfig.json` | **pass / exit 0** (`raw/ci-pr-gate-legs.log`, `raw/tsc-client.log`). The one earlier failure in this worktree was my own spec's TS narrowing (`TS2349` on a closure-assigned deferred), fixed before the commit — no source expectation was touched to get there. |
| eslint | `node_modules/.bin/eslint <the 5 changed .ts/.tsx files>` | **exit 0, 0 errors** (`raw/eslint-changed-files.log`) |
| artifacts | `pnpm build && pnpm build:composition`, then `node scripts/check-artifacts-at-head.mjs` | **`DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=HEAD verdict=ok compared=1508 drift=0`** — HEAD carries its own build; `client-bundle.js` is committed in the same commit as the source (`raw/build.log`, `raw/build-composition.log`) |
| PR gate legs | `node scripts/ci-pr-gate.mjs --full --only graph-parse --only state-freshness --only install --only blueprint-fence --only typecheck --only lint-identities --only artifacts-at-head --store-dir /home/user/dsh-plugins/dsh-agent-team/.pnpm-store` | **`DSH-CI-VERDICT pass pass=7 fail=0 skip=0 skipped=none legs=7 refused=0`** (`raw/ci-pr-gate-legs.log`); `blueprint-fence` reports `no new offending path` against the 6-identity baseline. `census` is opt-in and was not run. |
| p4t6 | see §5 | green, pin untouched (`raw/p4t6-GREEN.log`) |

The three root `--reporter=json` reports were **deleted after capture** (≈3 MB each, not evidence
value beyond their identity sets); what is kept is the derived `root-failset-*.txt` identity files,
their diffs, and the stderr tails. This is stated so nobody looks for a JSON that is not there.

The 3 client-lane reds are the **published pre-existing three**, identical by name at base and at
head (`selecting a blueprint loads the detail block and fires the persona-fact probe`,
`switching the runtime preset re-runs the probe with the new persona fact`,
`an override reset targets the member instance (scope instance) and pulls once on success`) — see
`dev/agent-workflow/evidence/a4-client-baseline/README.md`. The client lane has no identity-diff
tool, so the before/after pair above is the evidence, captured in this worktree.

One intermediate root capture (`raw/root-failset-HEAD.txt`, before the artifact was committed)
showed `NEW=1` — `a4p7-merge-gate … "the committed install surface is fresh against the tree"`,
failing with `verdict=stale drift=1 … C content-drift (git add): packages/client/composition-shim/client-bundle.js`.
That was the uncommitted rebuild being correctly detected, not a code regression: after the
co-commit the same leg passes and the diff is `NEW=0`. Nothing in `a4p7-merge-gate.test.ts` was
edited, and no expectation in any existing test was changed anywhere in this PR.

---

## 7. Not verified / not claimed

* **No real-browser check.** Every UI assertion is jsdom + `@testing-library/react`. The visual
  result of `.corruptionCheckNote` (colour, size, position against the real DSH shell and theme
  tokens `--dsw-alias-label-secondary` / `--dsw-font-xxxs-11`) was **not** seen in a browser, and
  CSS-module class output is only asserted through the `data-*` hooks, not through computed style.
* **No live host / no end-to-end run.** No DSH instance was started (no `:3180`-family host, no
  `tests/homes/<world>` was created), no `team.listCorruptControlLegs` call crossed a real socket,
  and no genuinely corrupt ledger row was produced. The remote face in the render tests is a
  fixture; the v9 server behaviour is W1's and W8's, re-verified by nobody here.
* **No composition smoke / no `smoke:composition`**, no `pnpm install`-level host boot, and no
  census leg (`census` is opt-in and was not requested).
* **Accessibility semantics are asserted structurally only** (`role="status"`, no button inside the
  notice); no screen-reader or axe check was run.
* **`aria-live` behaviour on repeated failures** (does the notice re-announce on every failed
  refresh?) was not examined; the element is re-rendered in place, which is the common case for a
  `role="status"` region but was not measured.
* **Locale parity is asserted for the one new key only** (both dictionaries carry it, enforced by
  `Record<TeamKey, string>`); no full zh/en parity audit was run.
* **The pre-existing client-lane reds were not diagnosed**, only shown to be the same three names.
* **No claim of "the user will notice this"**: the notice is small grey text by design. Whether its
  prominence is right for humans is a product judgement this PR does not settle.
* The repo-wide `pnpm -r run typecheck` was first run **before** my spec's narrowing fix, where it
  failed on that file alone; the value claimed above (`exit 0`, all packages including tests) comes
  from the gate's `typecheck` leg re-run at the committed HEAD, and from the per-package `tsc` in
  `raw/tsc-client.log`. Both were run in this worktree; nothing was claimed from a run that did not
  happen.
