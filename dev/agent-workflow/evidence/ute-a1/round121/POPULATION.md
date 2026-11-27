# Round 121 — the host-importing vitest population, re-measured on BOTH hosts (44 files)

Same rule as round 118 (the population is unchanged): collected `vitest` catalog entries carrying a
**value** import of a bare `@deepseek-ai/*` specifier (type-only imports and type-only named specifiers
excluded). The file list is pinned beside this file as `population-files.txt` (44 lines).

Every run below printed `HOST-VERSION-GUARD ok host=… resolved=… pin=… tree=…` once per worker, so no
green can come from the other generation's modules. Raw logs: `vitest-runtime-{legacy,next}.log`,
`vitest-client-{legacy,next}.log` in this directory.

## The measured table

| population | rc.2 | rc.5 | delta vs round 118 |
| --- | --- | --- | --- |
| 26 client suites | 24 files / **343 of 346** | 24 files / **343 of 346** | unchanged on both hosts (the same 3 pre-existing, host-independent failures) |
| 18 runtime+testkit suites | **18 files / 189 of 189** | **18 files / 189 of 189** | rc.5 was 15 files / 162 of 173 → **+3 files, +27 tests** |
| **44 total** | **42 files / 532 of 535** | **42 files / 532 of 535** | rc.2 was 42/44, 529/532 (+3 tests, all green); rc.5 was 39/44, 505/519 |

The rc.2 test total rises 529 → 532 because BL-16 gained the three round-121 control arms (+3). The
rc.5 total rises 505 → 519 → **535**: the 14 tests that were invisible (issue2's 13 assertions behind a
suite-level load failure, and BL-16's one passing arm) are now collected and counted, plus the same
three controls.

## Per-suite change for the three suites that were red on rc.5

| # | file | round 118 rc.5 | round 121 rc.5 | round 121 rc.2 |
| ---: | --- | --- | --- | --- |
| 29 | `packages/runtime/test/a5sf-bl16-grep-realm.test.ts` | **FAIL (9 of 10)** | **PASS (13 of 13)** | **PASS (13 of 13)** |
| 33 | `packages/runtime/test/a5sf-subprocess-unconfined-realm.test.ts` | **FAIL (2 of 4)** | **PASS (4 of 4)** | **PASS (4 of 4)** |
| 37 | `packages/runtime/test/issue2-real-preset-restriction.test.ts` | **FAIL (suite-level, 0 collected)** | **PASS (13 of 13)** | **PASS (13 of 13)** |

The other 41 files are byte-for-byte the same suites as round 118 and are green/pass-unchanged on both
hosts, with the same three pre-existing client failures (see below).

## The three remaining reds are the round-118 pre-existing pair, unchanged

`team-creation-panel.client.spec.tsx` (2 tests: the persona-fact probe) and
`team-governance.client.spec.tsx` (1 test: the override reset) fail **identically on rc.2 and rc.5**, with
the round-118 evidence and no file of theirs touched this round. They are host-independent pre-existing
failures, not rc.5 findings.

## What was NOT done

No suite was skipped, no timeout widened, no retry added, no assertion weakened. The three repaired
suites assert the SAME governance properties they always asserted; what changed is the dispatch
mechanism they exercise (rc.5 requires a mounted executor) and, in two arms, the host's `workingDirectory`
inject being satisfied by the labelled double the other rc.5-adapted suites already use.

## Commands (one invocation per runner per host)

```
# runtime (18 files, root config)
TEAM_TEST_HOST=next   node node_modules/vitest/vitest.mjs run $(cat population-files.txt | grep -E '^packages/(runtime|testkit)' | tr '\n' ' ')
TEAM_TEST_HOST=legacy node node_modules/vitest/vitest.mjs run <same 18>
# client (26 files, package config, jsdom)
cd packages/client && TEAM_TEST_HOST=next   node ../../node_modules/vitest/vitest.mjs run <26 files>
cd packages/client && TEAM_TEST_HOST=legacy node ../../node_modules/vitest/vitest.mjs run <26 files>
```
