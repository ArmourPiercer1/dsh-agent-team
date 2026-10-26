# PR #397 adversarial review r1

- Branch: `task/u7-w0-review-20261026`
- Head: `c635f9f30`
- Base: `origin/master` (`88107ad71`)
- Verdict: **BLOCKED**

## Findings

### F-1 — HIGH — p4t6 booking enumeration silently ignores non-JSON and nested files

- File: `packages/testkit/test/p4t6-bookings/load-bookings.mjs:57`
- Command:
  `node --input-type=module ... loadBookings(tempdir)` with `hidden.txt` containing a booking and `sub/x.json` containing malformed JSON.
- Verbatim tail:
  ```text
  { bookings: [], violations: [] }
  ```
- The loader enumerates only immediate `*.json` (`readdirSync(dir).filter((n) => n.endsWith('.json'))`). A booking in a non-`.json` file or a subdirectory is neither loaded nor reported. Therefore it can hide a booking from exact-total/placement accounting. The requested fail-closed behavior is not met. This is a gate-level risk because future lanes can accidentally (or intentionally) place a booking where the collector does not see it.

### F-2 — HIGH — PLACEMENTS numeric-prefix gaps are accepted, not fail-closed

- File: `scripts/place-dist-glue.mjs:68-78`
- Command: temporary directory with `010-a.json` and `030-c.json`, then `loadPlacements(dir)`.
- Verbatim tail:
  ```text
  gap 2
  ```
- Duplicate prefixes are rejected, but no contiguous-prefix/gap check exists. The user explicitly requested that a gap be handled fail-closed; this implementation accepts it and silently changes ordering topology. Add an explicit gap invariant (or document an intentionally non-contiguous reviewed order if that is the contract; current code does neither).

## Per-item verification

### 1. p4t6 exact total — **FALSE (F-1)**

- Migrated list multiset command compared all `SCANNED_PATHS_*` arrays at merge base to committed booking JSON.
- Verbatim tail:
  ```text
  { old: 336, new: 338,
    add: [ [ 'packages/testkit/test/p4t6-bookings/load-bookings.mjs', 1 ],
           [ 'packages/testkit/test/p4t6-bookings/load-bookings.d.mts', 1 ] ],
    rem: [] }
  ```
  This is the expected PR +2, with no old-path loss.
- Suite command: `pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts --reporter=dot`
- Verbatim tail:
  ```text
  Test Files  1 passed (1)
  Tests  19 passed (19)
  ```
- RED-first mutation tests in the suite passed for extra scanned file, dropped entry, duplicate path, malformed JSON, missing path, retired path, and skewed tie. However, F-1 remains a silent enumeration hole: non-JSON and nested booking files are ignored.
- Retargeted suites were included in the PR-local reported battery; source inspection confirms they consume booking data, but full battery was not independently reproduced here.

### 2. PLACEMENTS — **FALSE (F-2)**

- `node --test tests/checks/dist-placements.test.mjs` passed 7/7, including deterministic ordering, duplicate-prefix and malformed-file negatives.
- `node scripts/check-artifacts-committed.mjs` tail:
  ```text
  DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=1821 glue=38
  ```
- Content/order migration is correct, but a numeric-prefix gap is accepted (F-2). The check-mode placement command itself was not independently run because the script is a direct placer rather than a check-mode CLI.

### 3. eslint node-globals — **VERIFIED (local; hosted census pending)**

- `node --test tests/checks/eslint-node-globals.test.mjs` passed 5/5.
- The check covers parity, stale-entry removal, malformed/empty docs, and deterministic ordering. PR evidence claims `new 0 / resolved 0 / universe 1421`; I did not independently complete two full origin/head ESLint censuses in this review.

### 4. world-factory — **VERIFIED with stated test-infra trust model**

- `node --test tests/world-factory/registries.test.mjs tests/world-factory/world-factory.test.mjs` passed all relevant registry/world tests (60 total when combined with placement/eslint checks).
- The equivalence evidence is a byte comparison of produced patch-layer bytes, env, and mounted files for 9/9 shapes; suite evidence compares case lists. Unknown options are refused.
- Registration is pure directory enumeration: the tests explicitly prove “adding one file registers a new kind.” This is acceptable for test infrastructure (not product authority), but it is not a reviewed/closed allowlist; arbitrary files matching the filename/descriptor contract can register a world kind. That is a residual test-infra trust risk, not a product authority escalation.

### 5. Ports — **VERIFIED locally**

- `tests/paths.mjs` has `[3180,3199]`, `[3491,3500]`, `[13000,13099]`; host bands exclude 3180 and use 3181–3199 then 13000–13049; mock uses 3491–3500 then 13050–13099.
- Predicate probe tail:
  ```text
  { '3079': false, '3080': false, '3081': false, '3199': true,
    '3200': false, '13000': true, '13099': true, '13100': false }
  ```
- World-factory port tests passed, including simulated fall-through to 13000 with claim files and no real binds. `EXTERNAL_BIND` remains fail-closed. Legacy 3506/3516 defaults are documented as pre-existing out-of-policy findings.

### 6. CI — **COULD-NOT-VERIFY fully**

- `gh pr checks 397` at review time:
  ```text
  ci-fast pass
  ci-security pass
  ci-integration pass
  synthesize-merge-tree pass
  candidate-protection pass
  pr-gate pass
  ci-full pending
  census-runtime pending
  ```
- Requested `scripts/eb3-ci-required.mjs` and eb3 family/trusted-source scripts are absent on this base/tree (`MISSING ...` for each requested path), so they could not be run. This must not be treated as green evidence. PR evidence also says none exist on master, but that does not satisfy the requested merged-tree verification.

### 7. Scope — **VERIFIED**

- Diff inspection found no `packages/**/src/**` changes, no protected-center change, and `team-tool-plane.mjs` is untouched. No Host was booted and no test bind was made by this review.

## COULD-NOT-VERIFY

- Hosted `ci-full` and `census-runtime` were still pending at review time.
- Full independent origin/master versus head ESLint census and identity capture were not completed; relied on PR evidence plus the 5/5 negative-check suite.
- A true `place-dist-glue.mjs` check-mode invocation is not exposed by the script; artifact parity check passed.
- The requested merged-tree EB3 scripts are absent, so family-boundary/trusted-source checks could not run.

## Merge recommendation

Do **not** merge. Fix F-1 by making the bookings collector fail closed on any unexpected immediate entry and recursively discovered/nested booking candidate (or otherwise enforce that all booking-like files are accounted for), and fix F-2 by enforcing the required numeric-prefix gap invariant. Then rerun the complete CI/EB3 verification and obtain independent census results.
