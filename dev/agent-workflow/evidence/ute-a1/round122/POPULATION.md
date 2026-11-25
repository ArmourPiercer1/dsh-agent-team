# ROUND 122 — POPULATION: the 44-file host-coupled vitest population, re-measured on BOTH hosts

Round 122 (2026-11-26). Branch `vnext/a1-cut`, start head `08e0201cc`. Scope of the round: the
`executeTool` dispatch-shape residue named as open by round 121 (§J.1), and the three client test reds.

The population is **unchanged in SIZE (44 files) and unchanged in MEMBERSHIP** — this round added no
product module and no host-importing suite (the new suite `packages/runtime/test/vnext-tool-dispatch-shape.test.ts`
is host-free: relative specifiers + `vitest` only, so it belongs to the ordinary nine-root census, not to
this population). It is measured again here because the round changed the product's ONE tool-dispatch
entry, and every row below could have moved.

Population declaration: `population-files.txt` (44 lines, carried verbatim from round 121; the list is
derived from the host-signal classification in `RC5-TEST-MATRIX.md` §1).

## 1. Commands (copy-pasteable; run from the worktree root)

```bash
# runtime + testkit half (18 files)
TEAM_TEST_HOST=legacy node node_modules/vitest/vitest.mjs run $(grep -E '^packages/(runtime|testkit)' population-files.txt | tr '\n' ' ')
TEAM_TEST_HOST=next   node node_modules/vitest/vitest.mjs run $(grep -E '^packages/(runtime|testkit)' population-files.txt | tr '\n' ' ')

# client half (26 files), from packages/client
cd packages/client
TEAM_TEST_HOST=legacy node ../../node_modules/vitest/vitest.mjs run $(grep '^packages/client' ../../dev/agent-workflow/evidence/ute-a1/round122/population-files.txt | sed 's|^packages/client/||' | tr '\n' ' ')
TEAM_TEST_HOST=next   node ../../node_modules/vitest/vitest.mjs run $(grep '^packages/client' ../../dev/agent-workflow/evidence/ute-a1/round122/population-files.txt | sed 's|^packages/client/||' | tr '\n' ' ')
```

Logs: `vitest-runtime-{legacy,next}.log`, `vitest-client-{legacy,next}.log`. Every log carries the guard
line `HOST-VERSION-GUARD ok host=… resolved=0.2.0-rc.2|0.2.2-rc.5 pin=… tree=…` (rc.2 tree
`tests/deepseek-harness-test-use`; rc.5 tree `tests/deepseek-harness-next`), so "which host ran" is
proven by the loaded tree, not by the flag.

## 2. Totals

| half | legacy (rc.2) | next (rc.5) | delta vs round 121 |
| --- | --- | --- | --- |
| runtime+testkit (18 files) | **18/18 files, 190/190 tests** | **18/18 files, 190/190 tests** | +1 test per host (`a5sf-bl16-grep-realm` C5) |
| client (26 files) | 24/26 files, 343 passed / **3 failed** | 24/26 files, 343 passed / **3 failed** | unchanged (pre-existing — see §4) |
| **population** | **42/44 files, 533 passed / 3 failed** | **42/44 files, 533 passed / 3 failed** | +1 test per host |

The rc.5 and rc.2 columns are **identical in every row** except the host the modules came from: same
failures, same counts. That is the point of the selector.

## 3. Per-file table (both hosts; `N` = tests in the file)

### 3.1 runtime + testkit (18)

| file | legacy | next |
| --- | ---: | ---: |
| `packages/runtime/test/a3p5-permission-delivery-binding.test.ts` | 18 | 18 |
| `packages/runtime/test/a3p5-permission-notification-lane-hygiene.test.ts` | 9 | 9 |
| `packages/runtime/test/a5sf-bl16-grep-realm.test.ts` | **14** | **14** |
| `packages/runtime/test/a5sf-pd17-fs-policy.test.ts` | 5 | 5 |
| `packages/runtime/test/a5sf-provider-composition.test.ts` | 9 | 9 |
| `packages/runtime/test/a5sf-service-install.test.ts` | 20 | 20 |
| `packages/runtime/test/a5sf-subprocess-unconfined-realm.test.ts` | 4 | 4 |
| `packages/runtime/test/f1-webserver-shim-isolation.test.ts` | 3 | 3 |
| `packages/runtime/test/f15-mcp-live-loss-characterization.test.ts` | 2 | 2 |
| `packages/runtime/test/f15-mcp-live-loss.test.ts` | 10 | 10 |
| `packages/runtime/test/issue2-real-preset-restriction.test.ts` | 13 | 13 |
| `packages/runtime/test/mcp-blueprint-initial-grant.test.ts` | 32 | 32 |
| `packages/runtime/test/rc2-persona-probe.test.ts` | 13 | 13 |
| `packages/runtime/test/team-skills.test.ts` | 9 | 9 |
| `packages/runtime/test/team-spill-local-composition.test.ts` | 3 | 3 |
| `packages/runtime/test/team-spill-local.test.ts` | 10 | 10 |
| `packages/runtime/test/u6-mcp-017-regression.test.ts` | 5 | 5 |
| `packages/testkit/test/m2-scripted-model.test.ts` | 11 | 11 |

`a5sf-bl16-grep-realm` grew by exactly one test (13 → 14): the new **C5** arm, which drives the real
host's tools service with a BATCH through the one-call seam and requires the typed refusal. It is green on
both hosts, and it is the only row whose count moved.

### 3.2 client (26)

| file | legacy | next |
| --- | ---: | ---: |
| `packages/client/test/a4p6-interventions.client.spec.tsx` | 11 | 11 |
| `packages/client/test/a4p6-permission-administration.client.spec.tsx` | 4 | 4 |
| `packages/client/test/a4w4-corrupt-warning-ui.client.spec.tsx` | 8 | 8 |
| `packages/client/test/a4w6-corrupt-entry.client.spec.tsx` | 7 | 7 |
| `packages/client/test/d2-team-mode-entry.client.spec.tsx` | 7 | 7 |
| `packages/client/test/d3-ordinary-mode-entry.client.spec.tsx` | 12 | 12 |
| `packages/client/test/f9-resolve-control-ui.client.spec.tsx` | 9 | 9 |
| `packages/client/test/f9u-control-panel.client.spec.tsx` | 15 | 15 |
| `packages/client/test/f9u-control-surface-probe.client.spec.tsx` | 6 | 6 |
| `packages/client/test/new-team-entry.client.spec.tsx` | 8 | 8 |
| `packages/client/test/pr56-control-panel-payload.client.spec.tsx` | 32 | 32 |
| `packages/client/test/team-activity.client.spec.tsx` | 7 | 7 |
| `packages/client/test/team-creation-handoff.client.spec.tsx` | 15 | 15 |
| `packages/client/test/team-creation-panel-refresh.client.spec.tsx` | 1 | 1 |
| `packages/client/test/team-creation-panel.client.spec.tsx` | 19 (**2 red**) | 19 (**2 red**) |
| `packages/client/test/team-d4-a1-ui-pull.client.spec.tsx` | 14 | 14 |
| `packages/client/test/team-dock.client.spec.tsx` | 12 | 12 |
| `packages/client/test/team-governance.client.spec.tsx` | 30 (**1 red**) | 30 (**1 red**) |
| `packages/client/test/team-ledger.client.spec.tsx` | 20 | 20 |
| `packages/client/test/team-legacy.client.spec.tsx` | 8 | 8 |
| `packages/client/test/team-member-stop.client.spec.tsx` | 8 | 8 |
| `packages/client/test/team-members-actions.client.spec.tsx` | 19 | 19 |
| `packages/client/test/team-members.client.spec.tsx` | 12 | 12 |
| `packages/client/test/team-roots-zero-state.client.spec.tsx` | 11 | 11 |
| `packages/client/test/team-timeline.client.spec.tsx` | 18 | 18 |
| `packages/client/test/team-view.client.spec.tsx` | 33 | 33 |

## 4. The three client reds — pre-existing, attributed to exact commits (not caused by this branch)

The three failures are the same three on both hosts, with identical identity strings:

1. `team-creation-panel.client.spec.tsx` — `selecting a blueprint … persona-fact probe`
2. `team-creation-panel.client.spec.tsx` — `switching the runtime preset …`
3. `team-governance.client.spec.tsx` — `override reset … pulls once on success`

**Measurement (A. base vs head, same three suites):**

| tree | selector | result |
| --- | --- | --- |
| A0 `a19d1df01` | `TEAM_TEST_HOST=legacy` (the only host A0's client config can load — A0 predates the client-side host adapter, so `TEAM_TEST_HOST=next` is inert there; `git show a19d1df01:packages/client/vitest.config.ts` has no selector) | `Test Files 2 failed (2)`, `Tests 3 failed | 46 passed (49)` |
| HEAD `08e0201cc` | `TEAM_TEST_HOST=legacy` (guard: rc.2) | `Test Files 2 failed (2)`, `Tests 3 failed | 46 passed (49)` |
| HEAD `08e0201cc` | `TEAM_TEST_HOST=next` (guard: `0.2.2-rc.5`, tree `tests/deepseek-harness-next`) | `Test Files 2 failed (2)`, `Tests 3 failed | 46 passed (49)` |

The failing test-id sets at A0 and at HEAD are **identical** (`diff` of the sorted id lines is empty).
Logs: `a0-client-legacy.log`, `a0-client-next.log` (the inert-selector duplicate, kept for honesty),
`head-client-legacy.log`, `head-client-next.log`.

**Attribution by in-place bisect** (detached checkouts in this same worktree, no second worktree):

| commit | subject | measured |
| --- | --- | --- |
| `aa8391ac1` = `dcf661468^` | — | 47 passed / 0 failed |
| **`dcf661468`** | W1 fix-A F10 | governance arm red: `override reset … pulls once on success` — `TeamGovernance.tsx` reads `(response.value.data)['removed']` while the fixture `okResponse(null, 'override.reset')` is `null`, so it throws before `pullProjection` runs (0 calls) |
| **`4f07e2da9`** | pre-alpha3 PR-E | two panel arms red (`selecting a blueprint … persona-fact probe`, `switching the runtime preset …`) — `intentEnvironmentFacts` changed `available: true` → `observedKind === 'standard'` (roster `standard/ptc/cordis/minimal`), so `team`/`solo` become `available:false` |
| A0 `a19d1df01` | ancestor of both | 3 failed / 46 passed — the published baseline |

Both red commits are **ancestors of A0**, i.e. the reds exist on `origin/master` before this branch's
work: this is not a branch regression. `git diff --name-status a19d1df01..HEAD` for the two spec files
prints nothing, and no product file behind them (`client/src/model/team-intent-model.ts`,
`client/src/ui/TeamCreationPanel.tsx`, `client/src/ui/TeamGovernance.tsx`, …) changed since A0 either.
Logs: `origin-aa8391ac1.log`, `origin-dcf661468.log`, `origin-4f07e2da9.log`.

**Disposition: out-of-scope, disclosed, NOT skipped and NOT deleted.** The three arms remain collected
and red; they are added to the known-red disclosure in `CANDIDATE-REPORT.md` §8 and
`RC5-TEST-MATRIX.md` §11.7. Fixing them is a client-UX task owned by the panel/governance lane, not by
the dispatch-shape round; deleting or skipping them would be the failure mode the round forbids.

## 5. What did NOT run (stated, not implied)

- The three tracked *archived evidence* arms that call `binding.executeTool`
  (`dev/agent-workflow/evidence/a5sf-archived-gate/{row6-rejudge,archive-race-arms}.test.mjs`,
  `.../a5sf-boot-seam/boot-seam-arms.test.mjs`) are not in any CI leg and do not execute in this
  environment: they import the t12a bridge's `.ts`-sourced `.js` specifiers and the repo's test loader
  hooks do not resolve them from a bare `node --test` invocation
  (`ERR_MODULE_NOT_FOUND packages/domain/blueprint/src/index.js`). Pre-existing environment limitation,
  unrelated to this round; they were NOT edited. Their host-free dispatch path is superseded by the new
  `vnext-tool-dispatch-shape.test.ts`, and the t12a double they share now declares its rc.2 dispatch
  contract (`defaultMode: 'native'`), which is what the seam requires from a dispatching service.
- `packages/runtime/test/vnext-fs-slice.test.mjs` still routes through
  `tests/world-factory/lib/a5sf-fs-contract-world.mjs#executeToolDispatch` (`{hostMode}`), a separate
  version-keyed helper. Out of scope here; named in `HANDOFF`/§8 limits.
