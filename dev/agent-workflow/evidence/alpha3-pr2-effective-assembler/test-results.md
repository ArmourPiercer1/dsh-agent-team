# Alpha.3 PR2 — test results, disclosures, and what was NOT run

## The TDD sequence (raw outputs in this directory)

| Step | File | Result |
| --- | --- | --- |
| RED (specs written, module absent) | `red-run-1-raw.txt` | `Test Files 2 failed (2)`; `Tests 52 failed \| 1 passed (53)`; exit 1. The failure is `TypeError: assembleEffectivePermission is not a function` in every leg that calls the module. The ONE passing leg is the "PR2 wires NOTHING" witness — true before the implementation, which is exactly what it is for. |
| GREEN (module landed) | `green-run-1-raw.txt` | `Tests 53 passed (53)`; exit 0. |
| GREEN, final (after the two bugs the tests caught + the import-cycle fix + the 4th spec) | `green-run-final-raw.txt` | `Test Files 3 passed (3)`; `Tests 59 passed (59)`; exit 0. Same file records `tsc -p tsconfig.json` exit 0 and `eslint` exit 0 on all seven touched paths. |
| Mutation probes on the new logic | `mutation-probes-raw.txt` | 7 mutants, 7 killed. |
| Import-cycle regression | `import-cycle-regression-raw.txt` | the witness fails with the original `reading 'LEADER'` TypeError on the barrel-import shape, passes on the shipped leaf-import shape. |
| Shipped-dist smoke | `shipped-dist-smoke-raw.txt` | the BUILT `packages/runtime/dist/.../effective-policy/index.js` answers overlay-allow-over-template-ask / template-deny-on-no-overlay-match / lowest-layer-fallback, all outputs deeply frozen. |

## Exact counts delivered

| Spec file | Tests | Status |
| --- | --- | --- |
| `packages/runtime/test/a3p2-permission-assembler-precedence.test.ts` | 24 | passed |
| `packages/runtime/test/a3p2-permission-assembler-provenance.test.ts` | 29 | passed |
| `packages/runtime/test/a3p2-effective-policy-lane-import.test.ts` | 6 | passed |
| **PR2 total** | **59** | **passed** |

Neighbouring suites re-run as a regression check (no change to PR1 or Alpha.2):

| Suite | Tests | Status |
| --- | --- | --- |
| `packages/runtime/test/a3-permission-resolver.test.ts` | 28 | passed |
| `packages/runtime/test/permission-overlay-{append,validation,generation-conflict,latest-generation,history-immutability,port-surface,restart-persistence}.test.ts` | 69 | passed |
| `packages/testkit/test/a3p1-{seam-additive-tables,team-domain-tenth-store}.test.ts` | 18 | passed |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` (after the `924 → 929` pin increment) | 10 | passed |

## Whole-repo suite: identity diff against master

Both runs were executed **sequentially, one at a time** (an earlier attempt ran
them concurrently and produced resource-exhaustion collection failures in both;
that comparison was discarded, not reported).

- `full-suite-base.txt` — a `git archive` export of **master
  `9e2ac40d44a90c8283e6f7ca4bd7bfb54dcfe123`** (same `node_modules`, same
  command): `Test Files 10 failed | 417 passed (427)`,
  `Tests 21 failed | 4951 passed (4972)`.
- `full-suite-mine.txt` — this tree (PR2 on master):
  `Test Files 9 failed | 421 passed (430)`,
  `Tests 19 failed | 5012 passed (5031)`.
  (+3 test files and +59 tests = exactly the three PR2 specs.)
- `failure-identity-diff.txt` — the `comm` over the two sorted identity lists:
  **present in my tree and NOT on master: EMPTY.** Two legs
  (`team-skills` S2/S3) fail on the EXPORT and pass here: the export has no built
  `dist`, which is what those layout-candidate legs read. Reported as-is.

The pre-existing failures below appear in BOTH runs. Recorded by identity only —
no attribution, no fix attempt, outside this PR's scope:

```text
packages/domain/test/t1-capability-schema.test.ts            (9 legs: 1,2,3,7,8,9,10,11,11b)
packages/domain/test/t2-blueprint-hash.test.ts               (projects absent optional singles as explicit null)
packages/runtime/test/d3-member-identity-context.test.ts     (D3-4 FAIL CLOSED …)
packages/runtime/test/p6t3-mediation.test.ts                 (5 legs: 1,3,4,5,7)
packages/runtime/test/p6t3-restart.test.ts                   (2 legs: 2,5)
packages/runtime/test/p8s3b-result-effects.test.ts           (whole file, collection)
packages/runtime/test/t12a-b2-child-identity.test.ts         (whole file, collection)
packages/runtime/test/t12a-glue-handoff-ports.test.ts        (whole file, collection)
packages/tools/test/p6t6-actions.test.ts                     (messaging: worker -> leader …)
```

## Live / host items: NOT_RUN

No host, no browser, no network, no DSH_HOME world. Specifically NOT_RUN, by
name, because this environment has no host and no install surface consumer:

- live host boot of the plugin with the new lane exported — NOT_RUN
- `:3080` / `:3180` anything — NOT_RUN (never touched, per TEST_METHODS)
- git-install (`dsh plugin add github:...`) consumption of the rebuilt
  `packages/runtime/dist` — NOT_RUN (needs network + a host)
- any approval-UI / notification / GMS behaviour — NOT_RUN (PR2 wires nothing;
  the wiring witness leg proves there is no consumer to run)

## Environment provenance (honest)

`node_modules/` (root and `packages/{client,domain,runtime}/`) was **copied
read-only from `.worktrees/pr56-client-panel`**; there was no `pnpm install` and
none is possible offline. Nothing in this PR claims an install succeeded. The
`pnpm build` / `pnpm build:composition` runs used the toolchain inside that copied
tree (see `build-freshness.md`).
