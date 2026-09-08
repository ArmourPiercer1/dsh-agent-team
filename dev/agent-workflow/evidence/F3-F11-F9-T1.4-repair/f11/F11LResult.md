# F11-L — F11 ledger completeness (count-based) — implementation result

- task: F11-L (F3/F11/F9/T1.4 repair round r1; frozen contract §8.1)
- model_route: qiyuan-self/qwen3.8-27b (worker session runtime declaration)
- base_sha: 9b582a1c4e7195c0078b8f228565713efb85cdd8 (the review baseline)
- branch: task/repair-r1-f11-ledger
- worktree: .worktrees/repair-r1-f11 (provisioned by this worker via `git worktree add -b task/repair-r1-f11-ledger .worktrees/repair-r1-f11 9b582a1`)
- execution count: 1 of 3
- verdict: COMPLETE (implementation + persistent tests; client suite + typecheck green modulo the documented pre-existing baseline failure)
- push: NONE (not authorized for the worker; no push performed)

## Scope (exactly the frozen contract §8.1 work list — all files under packages/client)

1. `src/state/team-ledger-store.ts` — `continuePaging = tailReached === false && !(total !== null && entriesBySequence.size >= total)` (the count-domain rule; `completeThrough` keeps publishing as the highest loaded sequence — its documented meaning unchanged). Header item 5 + the tail comment rewritten to INV-9.2 count semantics.
2. `src/model/ledger-adapter.ts` — `ledgerModelFromStoreState`: `complete = state.total !== null && state.orderedSequences.length >= state.total`; `adaptTeamLedger` `complete`-param doc + the function doc updated to count semantics.
3. `src/model/team-ledger-model.ts` — `deriveTeamLedgerSection`: `remainingCount = total === null ? 0 : Math.max(0, total - ledger.entries.length)`; header + field docs updated; the `completeThrough` input field stays in the interface (callers keep passing it) but is no longer read (documented).
4. Docs: `src/model/team-ui-snapshot.ts` (the `TeamUiLedgerModel` completeness-marker doc) + `src/ui/TeamLedger.tsx` header → count semantics (INV-9.2 adoption).
5. Companion (included by default): `src/ui/TeamLedger.tsx` zero-rows branch now renders the loud error note + retry when `error !== undefined` instead of swallowing it in the plain empty/loading note (NOTES L208 OBS(1)). Strictly local (one component, existing dictionary keys `view.ledger.loadFailed` / `view.ledger.retry`, existing CSS classes) and covered by a new spec.

## Persistent tests added (all in packages/client/test)

- `team-ledger-store.test.ts` (13 → 24 tests):
  - F11-T1 shifted base — dtestp6 shape (seq 69–136, total 68, limit 50): exactly 2 `getLedgerPage` calls (`after` 0 then 118), 68 loaded, `completeThrough 136`, `loading false`, `error undefined` — RED pre-fix.
  - F11-T2 small shifted base (7–11, total 5, limit 2): 3 calls (7-8 | 9-10 | 11), all 5 loaded — RED pre-fix.
  - F11-T6 nine-case matrix (store paging axis): base 1 / base 69 / base 10000 / total < first sequence (no early completion) / multi-page (5 pages) / overlapping page replay (stable re-read, dedupe absorbs) / duplicate-sequence append on refresh (unique count = map size) / cursor-null tail (clean 50/50 + lying 3-of-7 stays partial) / total known-vs-null (unbound boundary; the verdict-rule half lives in the adapter spec). Key assertion everywhere: `loadedUniqueEntryCount == server total`, never `frontier >= total`.
  - The existing lying-total verdict assertion re-expressed in the count domain (scenario + behavior unchanged; F11-T3: `catchUpScenario` and `refreshAppendScenario` byte-unchanged and green).
- `ledger-adapter.test.ts` (24 → 27 tests):
  - F11-T4: 50 of 68 (frontier 118) → `completeness 'partial'` + `pendingControlByInstance {}`; all 68 → `'complete'` + the seq-130 tail request badges `{ 'i-tail': 1 }` — RED pre-fix.
  - F11-T4 gate flip: 67/68 (request loaded, ledger short) still partial/`{}`; 68/68 opens the gate — the §7.3 gate flips exactly at full load.
  - F11-T6 case 9: `total === null` never claims complete (even with a high frontier); known total counts loaded entries, not the frontier (3-of-5 partial although frontier 71 ≥ 5) — RED pre-fix.
- `team-ledger-model.client.spec.ts` (20 → 21):
  - F11-T5: total 68, 50 loaded (frontier 118) → `complete === false && remainingCount === 18` — RED pre-fix (was 0); full 68 → complete, 0 remaining.
  - The pre-existing remainder test re-pinned to the count domain (1 of 100 loaded → 99, not 40 = total − frontier).
- `team-ledger.client.spec.tsx` (19 → 20):
  - F11 companion: zero-rows + typed error (transport-loss and RPC-error flavors) renders `data-ledger-error` + `data-ledger-retry` (retry fires `onRetry`); the empty note is NOT rendered over the error — RED pre-fix.

## Verification (all commands in the worktree; see run-recipe.md for the sandbox note)

| Gate | Command | Result |
|---|---|---|
| RED (pre-fix) | stubbed vitest, the 4 F11 files | 12 failed / 80 passed (all 12 = the F11 tests, as designed) — `red-f11-focused.txt` |
| GREEN (focused) | stubbed vitest, the 4 F11 files | 92/92 — `green-f11-focused.txt` |
| GREEN (full client suite) | stubbed `vitest run --root packages/client` | **593/594** — `green-client-vitest-stubbed.txt` (baseline 577/578 `baseline-client-vitest-stubbed.txt`; the 1 failure = pre-existing `team-creation-panel.client.spec.tsx` create-happy-path, byte-identical to `team-d1-d6-repair-v2/G3/full-client.txt`, untouched by this diff) |
| typecheck | `pnpm typecheck` in packages/client (`tsc -p tsconfig.json`) | **green** (exit 0) — `typecheck-green.txt` |
| shim surface (cross-check) | `node scripts/run-tests.mjs client` | 301 passed / 10 failed — all 10 pre-existing out-of-audit matcher usage (`toContain`/`toBeNull`/…) in 3 files NOT touched by this diff (`d1-team-remote-v3`, `d2-open-team-mode`, `d3-open-ordinary-mode`); both modified `.test.ts` files PASS (24 + 27) — `green-run-tests-client.txt` |

## Boundary + forbidden-surface check

- `git diff --stat 9b582a1` (worktree): 9 files, **all under `packages/client`** (5 src + 4 test), +572/−35 — `diff-boundary.txt` (incl. `git status --porcelain`; the only untracked path is the scratch `.f11-vitest-netuse-stub.mjs`, NOT committed).
- Untouched: `packages/remote` (incl. the frozen tracker `push/ledger-page.ts`), server handlers, wire schema, tracker shape/correlation checks, branded types, `docs/plans/active/`, `dev/agent-workflow/graph.yaml`, `SESSION_ROUTER_LOG.md`, upstream/`references/`.
- No push.

## Not done here (by contract ownership)

- F11-T7 (◌ optional pre-push mock-world repro, NOTES L235–240 dtestp6 shape) — a validation-node (main agent) item, not part of this leaf's implementation scope.
- F11-R (mock-world regression rows in G) — deferred to the mock campaign (contract §7 note).

## Commit

Single commit on `task/repair-r1-f11-ledger` (implementation + tests together; evidence lives in the main workspace `dev/agent-workflow/evidence/F3-F11-F9-T1.4-repair/f11/` per the campaign's evidence pattern, kept OUT of the branch so the branch diff stays confined to packages/client).
