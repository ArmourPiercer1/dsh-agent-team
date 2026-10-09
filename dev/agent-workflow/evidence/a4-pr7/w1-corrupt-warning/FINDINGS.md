# A4-PR7 W1 FINDINGS — corrupt-leg facts to the human read plane (fixed warning bar)

Lane A of Alpha.4 PR7, branch `feat/a4-w1-corrupt-warning` (worktree `.worktrees/w1-warning`,
base `origin/master @ ea417956`). RULING 5-B (warning-first): visibility ONLY; execution
semantics unchanged; no governance isolation state machine; the client never re-implements a
strict reader.

## 1. Channel judgment — projection-DTO ownership, and why there is NO `CORE_SEAM_BLOCKER`

The lane's route question was: does the human read plane need a HOST-owned projection DTO
(which could justify a core-seam conversation), or is the wire shape plugin-owned?

**Answer: plugin-owned. No host surface is touched; CORE PATCH BUDGET stays 0; no
`CORE_SEAM_BLOCKER` was raised and none is needed.** Evidence:

- The remote wire DTOs are frozen contracts of THIS repo, not the host:
  `packages/remote/src/contracts/types.ts` (this lane's family added at
  `packages/remote/src/contracts/types.ts:537` — `REMOTE_CORRUPT_CONTROL_LEGS_CAP = 20` —
  beside `RemoteCorruptControlLegWire` / `RemoteCorruptControlLegsWire` and their closed field
  lists). The repo's own ownership statement for that seam:
  `packages/remote/src/handlers/ports.ts:251-252` — *"Re-exported so handler/test authors
  import wire DTOs from the seam they already import (the frozen home stays
  `contracts/types.ts`)"* (base text, verbatim on `origin/master`).
- The host contributes exactly one opaque thing: the `/team-remote` RPC channel the plugin
  registers through the public host seam (`REMOTE_RPC_CHANNEL`,
  `packages/remote/src/handlers/register.js`; the T12-M4 mount spec owns the wiring). The new
  read rides that channel as a closed method; nothing host-side changes.

**`corruptLegs` had ZERO production exits to the read plane before this lane.** Measured on the
base tree:

```
$ git grep -n "\.corruptLegs\b" origin/master -- 'packages/*/src' | grep -v "packages/runtime/control/"
(none)
```

The producer/definition lives in the control module itself
(`packages/runtime/control/service.ts:496`, `ControlState.corruptLegs`), and on
`origin/master` nothing outside `packages/runtime/control/**` read the property in
production source. This lane adds the FIRST production exit:
`packages/runtime/src/plugin/root.ts:3673` (closure `corruptControlLegs: (rootSessionId) =>`
`control.listControlState(...).then(state => state.corruptLegs)`) →
`packages/runtime/src/plugin/s6-remote.ts` (production port + dispatcher case :4238) →
remote contract v9 → client transport → the Team-page bar. `packages/runtime/control/**` was
not touched at all.

## 2. The wire (contract v9), and the ONE-law discipline

- `REMOTE_CONTRACT_VERSION_V9 = 9` — `packages/remote/src/contracts/version.ts:160`;
  availability ladder extended (`isRemoteMethodAvailable(9, m)` true for all; `m` false only
  for the v9-only set; v<9 refuses v9-only methods typed).
- `REMOTE_V9_ONLY_METHODS = ['team.listCorruptControlLegs']` —
  `packages/remote/src/contracts/catalog.ts:277`; catalog entry TEAM category —
  `packages/remote/src/contracts/catalog.ts:92`; closed params (only `teamSessionId`) —
  `packages/remote/src/contracts/params.ts:2381` (unknown field → `malformed-params` +
  `details.reason: 'unknown-field'`; the port is never invoked).
- ONE law shared by BOTH dispatchers: `corruptControlLegsValue` —
  `packages/remote/src/handlers/team.ts:704` (exported), consumed by the remote handler case
  (`handlers/team.ts:925`/`:948`) AND the production s6 dispatcher
  (`packages/runtime/src/plugin/s6-remote.ts:136` import-by-path, case at `:4238`). Same cap
  (20), same closed row validation, same ordering law (SERVICE order — never re-sorted) on
  both sides. The client re-parses defensively but never re-derives.
- Response cell `{ corruption: { teamSessionId, corruptCount, truncated, legs[] } }`:
  `corruptCount` is EXACT (the cap bounds only the LIST), each row carries the SERVICE's own
  `disclosesMember` flag, and `requestId` / `approvalCaseId` are echoed ONLY when the damaged
  row still discloses one — the report never invents an identity it did not read.
- s6 port guardrail order: `assertBoundRoot` FIRST (foreign root →
  `TEAM_REMOTE_FOREIGN_TEAM` before any control read), unwired seam → typed `internal-error`
  + `details.reason: 'port-unwired'` (never a silent empty "nothing is corrupt"), malformed
  port output → typed `internal-error` + `details.reason: 'port-contract'`.
- The v9 read is NOT in `REMOTE_GOVERNANCE_WRITING_METHODS` (pure read), and RULING 5-B holds
  execution untouched: the acceptance spec proves a guarded call proceeds in the SAME world
  where the warning data is served (verdict `no-request`, tool `executed`, zero allow
  consumptions), and `disclosesMember: false` rows count but never block.

## 3. Pin moves — mechanical consequences of the contract bump (precedent `5757bdec`)

Precedent: `git log --oneline -1 5757bdec` → `A4-PR6 6.B: Remote contract v8 — the
intervention plane on both dispatchers` — the established pattern where a contract-version
bump commit moves the mechanical cross-lane pins itself, with every move documented. This
lane moved, each by the pin file's OWN formula/assertion (none hand-written):

| file | move |
| --- | --- |
| `packages/remote/test/p8t3-version.test.ts` | supported set +9; unsupported sentinel `version9`→`version10` (fixture+RT key+title) |
| `packages/remote/test/tcm-m1-remote-v2.test.ts` | 35→36 methods; NEW assertions: v9-only closed set `['team.listCorruptControlLegs']`, available @9 true / @8 false |
| `packages/remote/test/a4p6-remote-v8.test.ts` | supported set +9, count 36 (pin-move comment) |
| `packages/remote/test/d1-remote-v3.test.ts` | count 36 with `- REMOTE_V9_ONLY_METHODS.length` formula; supported set +9 |
| `packages/remote/test/f9-remote-v4.test.ts` | count 36 with −V9-only formula |
| `packages/runtime/test/p8s7r4-bc23-24-no-mutation.test.ts` | method count :281 → 36 (A4-PR7 W1 comment) |
| `packages/runtime/test/t12m4-remote-mount.test.ts` | unsupported-version negative 9→10 (versions 1–9 legal), ladder comment + v9 line |

The t12m4 move was NOT known up front — the full-suite run went RED on it (`expected true to
be false`, `raw/root-vitest-full.log`), i.e. the pin caught the bump exactly as designed, and
the negative was moved with the file's own ladder comment.

## 4. p4t6 census — totals MEASURED, never hand-written

Per the coordinator's ruling ("总数必须由测量得出"), the two verbatim lines from this
session's runs:

**改动前实测总数** (my 4 new files on disk, list entry absent — RED):

```
AssertionError: expected 1046 to be 1042 // Object.is equality
```

(capture `dev/agent-workflow/evidence/a4-pr7/w1-corrupt-warning/raw/p4t6-pre-extend-RED.log`)

**改动后实测总数** (entry + tie added — GREEN):

```
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

(capture `dev/agent-workflow/evidence/a4-pr7/w1-corrupt-warning/raw/p4t6-post-extend-GREEN.log`;
the derived sum now evaluates to the same 1046 the scanner reports — a mismatch would fail
the `toBe` with a fresh `expected/toBe` pair)

**How the count was derived:** `1042` is the value the pre-existing list-sum expression
computed on this branch (the run's `to be 1042`); `1046` is what `scanResult.filesScanned`
actually counted with the four new files present (the run's `expected 1046`). Δ = 4 = exactly
the four paths `SCANNED_PATHS_A4W1` names:
`packages/remote/test/a4w1-corrupt-legs.test.ts`,
`packages/runtime/test/a4w1-corrupt-warning.test.ts`,
`packages/client/test/control-corruption-model.test.ts`,
`packages/client/src/model/control-corruption.ts` — each additionally asserted present
BY PATH in the loop, and each individually confirmed in the scan set by a one-shot probe run.
Discipline kept: ONLY the new constant + the lane's own tie
(`expect(SCANNED_PATHS_A4W1.length).toBe(1046 - 1042)`) + the mechanical sum/spread terms;
no other lane's list was reordered, reformatted, merged, or "cleaned".

## 5. Tests added (all green in this session)

- `packages/remote/test/a4w1-corrupt-legs.test.ts` — 7/7. Serves the closed cell verbatim;
  cap law (CAP+5 rows → `corruptCount 25`, 20 legs, `truncated true`, head sequence kept);
  well-formed zero report; v1–v8 refuse typed BEFORE the port; param smuggle →
  `malformed-params` + `unknown-field`, port untouched; unwired → `port-unwired`; malformed
  port output (5 row shapes + non-array) → `internal-error` + `port-contract`.
- `packages/runtime/test/a4w1-corrupt-warning.test.ts` — 8/8. The brief's acceptance over a
  real P6T6 world: (a) the PRODUCTION surface (`createS6RemotePorts` + `createS6RemoteDispatcher`
  with the `corruptControlLegs` closure over the real `ControlService.listControlState()` —
  the `root.ts` wiring shape) serves at v9, for ONE UNATTRIBUTABLE damaged row
  (the W13-i shape): `corruptCount 1`, the row's LEDGER SEQUENCE, `disclosesMember false`;
  (b) EXECUTION UNCHANGED in the same world: verdict `no-request`, tool `team_follow_up`
  `executed`, facade reached 1, zero consumptions; (c) v8 → `method-version-unsupported`,
  smuggle → `malformed-params`; (d) REBUILD SURVIVAL: a second control service over the same
  durable world serves the byte-identical cell (the fact lives in the ledger — Member
  destroy/rebuild cannot clear the bar); a principal-derivation tripwire never fires;
  (e) foreign `teamSessionId` → `TEAM_REMOTE_FOREIGN_TEAM` BEFORE any read; unwired seam →
  typed refusal; and a member-DISCLOSING damaged row serves `disclosesMember true` while a
  call it does not name still proceeds.
  Placement note: this spec imports BOTH `../src/plugin/s6-remote.js` and
  `../../tools/test/p6t6-helpers.js` — the cross-import shape `packages/runtime/test/
  d1-member-base-tools.test.ts` already owns; keeping it in `packages/tools/test` instead
  would have pulled `runtime/permission-notification/binding.ts` into the `tools` tsc
  program without the plugin's declaration-merging `.d.ts` (latent type error, not mine).
- `packages/client/test/control-corruption-model.test.ts` — 5/5. Closed params keys;
  verbatim parse (order/count/flags/echoes preserved — no client-side re-sorting); count-0 →
  no bar; 15 malformed wire shapes → `null` (fail-safe, never a partial guess); visibility
  rule.

## 6. The UI law (fixed bar, Team-level wording)

`packages/client/src/ui/TeamView.tsx`: a fixed bar (`role="alert"`,
`data-team-control-corruption`) rendered in the view-status region — never a modal, never
dismissible, no close affordance. Per row:
`data-team-control-corruption-attributable="yes|no"` — the wording is Team-level ("无法归因到任一调用"
/ unattributable), and Member-adjacent cells render ONLY when the row itself discloses
(`· request …` / `· case …`), so the bar never claims an identity the ledger did not disclose.
The bar's data is ledger-derived (fetched via the v9 read on every snapshot/team change), so
it survives Member destroy/rebuild by construction. A typed refusal conservatively HIDES the
bar (the read is unavailable, the claim is not "clean"); a malformed payload shows an inline
error note, never a fake all-clear. Wording keys `view.corruption.*` exist in BOTH locales
(`packages/client/src/ui/locales.ts`, zh + en). The model layer (`packages/client/src/model/
control-corruption.ts`) is pure and parses fail-safe to `null` — the client holds NO reader
logic about WHY a row is corrupt (RULING 5-B; sole authority stays `runtime/control`).

## 7. Cross-lane hazard found (measured, disclosed)

`scripts/build-client-composition.mjs` (NOT touched) fails its emitted-bundle syntax gate if a
`//` comment INSIDE an `export { ... } from '...'` list contains the substring `export`
(its naive export transform emitted `Object.defineProperty(exports, "exported so\n// …")` —
an unterminated string; the gate caught it: `Unexpected identifier 'so'`). The base tree
never trips it; base comments inside export lists avoid the word. Lane fix: the comment moved
ABOVE the statement as a JSDoc (the base `ports.ts:251` `/** Re-exported so … */`-before-export
shape is NOT affected). Other lanes adding in-brace comments containing "export*" will hit
the same wall — worth a line in the lane notes.

## 8. Pre-existing client reds (proven NOT this lane)

The same three titled reds fail on the LANE WORKTREE and on the CLEAN MAIN REPO
(`92e14fc2`), both runs this session:

- worktree (`raw/client-suite-worktree.log`): `Test Files 2 failed | 54 passed (56)` /
  `Tests 3 failed | 882 passed (885)` —
  `team-creation-panel.client.spec.tsx > … persona-fact probe (S5-A, UI §6/§7)`,
  `team-creation-panel.client.spec.tsx > … switching the runtime preset …`,
  `team-governance.client.spec.tsx > … override reset … pulls once on success`.
- clean main repo (`raw/client-suite-clean-main-repo.log`): `Tests 3 failed | 876 passed (879)`
  — the IDENTICAL three identities (plus, on the clean tree ONLY, a file-level collection
  failure of `test/s3-client-generation-spike.test.ts` — present at clean HEAD, green in the
  worktree; also not this lane).

## 9. Full-suite state (root vitest, this tree)

`raw/root-vitest-full.log`: `Test Files 6 failed | 505 passed (511)` /
`Tests 12 failed | 6405 passed (6417)` — identity-checked against
`dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md` (the published
9 tolerated titled reds: t2-blueprint-hash ×1, p6t3-mediation ×5, p6t3-restart ×2,
p6t6-actions ×1 — ALL nine present and NONE outside them), PLUS exactly two lane-attributed
reds at capture time, both since resolved:

- `t12m4-remote-mount > rejects an unsupported contract version` — the v9 negative pin, moved
  (§3), now `Tests 9 passed (9)`.
- `a4p7-merge-gate` ×2 — STALE DIST (the composition-smoke leg ran the committed bundles from
  before this lane; the static leg reported `check:artifacts … verdict=stale drift=33`):
  after `pnpm build && pnpm build:composition` the smoke leg is green and the remaining single
  failure IS the artifacts-check leg waiting for the dist co-commit (this commit resolves it).

Post-fix package sweeps: remote `239 passed (239)`; tools
`1 failed | 161 passed (162)` (the 1 = the tolerated
`p6t6-actions > messaging: worker -> leader …` titled red); p4t6 `10 passed (10)`;
t12m4 `9 passed (9)`; client model specs green; typecheck exit 0 for remote, runtime,
client, tools, testkit (each `tsc -p tsconfig.json`, tests included).

## 10. Commands actually run (this session; env `CI=true XDG_CACHE_HOME=<repo>/.tmp-xdg/cache`)

From the worktree root unless stated:

- `node_modules/.bin/vitest run packages/tools/test/a4w1-corrupt-warning.test.ts` (pre-move path `packages/tools/test/…`) → 8 passed; re-run post-move at `packages/runtime/test/…` → `Tests 8 passed (8)`.
- `node_modules/.bin/vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` → RED `expected 1046 to be 1042` (pre-extend), GREEN `10 passed` (post-extend).
- `node_modules/.bin/vitest run packages/runtime/test/t12m4-remote-mount.test.ts` → `Tests 9 passed (9)`.
- `node_modules/.bin/vitest run packages/remote` → `Tests 239 passed (239)`.
- `node_modules/.bin/vitest run packages/tools` → `1 failed | 161 passed` (tolerated identity).
- `node_modules/.bin/vitest run --root packages/client` (worktree) and `(cd packages/client && ../../node_modules/.bin/vitest run)` (main repo) → §8.
- `node_modules/.bin/vitest run packages/testkit/test/a4p7-merge-gate.test.ts` → after rebuild: `1 failed | 34 passed` (single remaining failure = `check:artifacts drift=33`, resolved by the dist co-commit in this branch).
- `node_modules/.bin/vitest run` (full root) → §9.
- `pnpm build && pnpm build:composition` → bundles emitted (`build-client-composition: wrote … client-bundle.js (1287720 B)`); `check-artifacts-committed` then lists the 33 drift paths THIS commit adds.
- `(cd packages/<p> && ../../node_modules/.bin/tsc -p tsconfig.json)` for remote/runtime/client/tools/testkit → exit 0 each.
- the `git grep` / `git log` evidence lines of §1/§3.

## 11. Not verified (explicit, honest)

- **No jsdom `.client.spec.tsx` renders the TeamView warning bar end-to-end.** The pure model,
  the closed wire, the transport face and the mount wiring are tested; the JSX bar itself has
  no new render spec (attributes/selectors are pinned in `data-*` for one to be added later).
- **No real-browser (:3180-family world) check** of the bar's visual placement/warning tokens.
- **No end-to-end over a live host `/team-remote` channel** beyond the unit-level production
  dispatcher (the acceptance uses the production port/dispatcher constructors, not a booted
  host).
- The pr-gate itself runs on the PR, not in this session; a4p7-merge-gate's full green (post
  dist commit) is asserted by the gate run, and §9 records the pre-commit state.
- RULING 5-A/5-B boundary re-verification of `runtime/control`'s own classification (the
  `disclosesMember` semantics) is INHERITED from the control module and its `a4-corrupt-leg-
  guard.test.ts` W8-b/W12-c/W13-g pins — this lane re-serves that flag, and the acceptance
  spec asserts the flag's PROJECTION, not its derivation.

## 12. Review round (coordinator): wording honesty fix + merge with master (MEASURED)

**12a. Wording fix (behavior unchanged, honesty only).** The disclosure
predicate's MEASURED truth (`packages/runtime/control/service.ts`): any of
the four scalar operation members returns true (:1210-1215), a parseable
`subject` ALONE returns true (**:1218**), a non-empty legacy
`targetInstanceId` ALONE returns true (**:1221**) — so a row naming ONLY an
operation, with no member identity anywhere, is `disclosesMember: true`
(W2 lane's four-shape matrix `disclosure-predicate-probe.log` confirms).
The old positive label claimed a Member attribution such rows do not carry.
Changed: zh `'该记录自带归属线索（行内披露，未必指明是哪个成员）'`, en
`'the record carries its own attribution clue (disclosed in-row; it may not
name which member)'`; the NEGATIVE label is byte-identical (it was honest);
the model doc (`control-corruption.ts`) now states the measured semantics
and says explicitly the flag is NOT a conclusion that "that member caused
the corruption"; the TeamView bar comment aligned. **No assertion moved**:
no spec in the tree asserted the old UI strings (verified by grep
before/after — the model spec asserts the boolean, not locale text). No DTO
field added; `packages/runtime/control/**` untouched. Commit `46ed4b68`.

**12b. Merge with master (`ed9b0552`, carries W2).** `git merge
origin/master` (no rebase, no force-push — gated history). The single
conflict was p4t6, five hunks, resolved keeping BOTH lists:
`SCANNED_PATHS_A4W1` and `SCANNED_PATHS_A4W2` each with their own constant,
presence spread, and their own `+ …length` term on both derived sums; the
two ties coexist verbatim (`W1: toBe(1046 - 1042)`, `W2: toBe(1043 - 1042)`
— each lane's own Δ, never summed). W2's constant and tie were NOT touched
by a single character.

**12c. MEASURED after the merge (no arithmetic derivation of the total):**

- scanner actual total (direct `scanSessionEventVocabulary()` call, probe
  outside `packages/**` so nothing self-counted):
  `filesScanned = 1047`
- this lane's own Δ: 1042 → 1046 (`SCANNED_PATHS_A4W1.length = 4`, the
  RED capture `expected 1046 to be 1042`, unchanged)
- list memberships: `SCANNED_PATHS_A4W1` = **4**
  (`remote/test/a4w1-corrupt-legs.test.ts`,
  `runtime/test/a4w1-corrupt-warning.test.ts`,
  `client/test/control-corruption-model.test.ts`,
  `client/src/model/control-corruption.ts`);
  `SCANNED_PATHS_A4W2` = **1**
  (`runtime/test/a4-w2-rebuild-guarantees.test.ts`)

**12d. Post-merge runs (the agreement is the test, not arithmetic):**

- `packages/testkit/test/p4t6-session-event-scan.test.ts` →
  `Test Files 1 passed (1)` / `Tests 10 passed (10)`
  (raw/p4t6-post-merge-GREEN.log) — the derived sums (with BOTH terms)
  equal the scanner's actual reading: had the merged total disagreed with
  the lists, `filesScanned`'s `toBe` would be RED. No discrepancy to
  report: no file was counted outside the named lists.
- `packages/client/test/control-corruption-model.test.ts` →
  `Tests 5 passed (5)` (with the reworded locale/model present)
- `packages/runtime/test/a4w1-corrupt-warning.test.ts` →
  `Tests 8 passed (8)` (raw/acceptance-post-merge.log)
