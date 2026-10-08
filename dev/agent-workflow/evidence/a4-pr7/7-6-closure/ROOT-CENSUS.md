# §7.6 baseline-diff leg — root census on the final tree + root-command equivalence

**Lane:** A4-PR7 §7.6 evidence (`7-6-closure`) · **tree:** `.worktrees/a4-76-closure`,
`feat/a4-76-closure` · **base:** `master @ 0e7004b6` · **census HEAD:** `9df5535f` (evidence-only
commit atop the base; the source tree is byte-identical to the base — this branch adds only files
under `dev/agent-workflow/evidence/`).

Established form = the nine-root census published at
[`dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md`](../population-baseline/nine-root-2162f6a7.md)
(re-confirmed there at `2f06bb44`): **502 files / 6277 legs / 19 titled reds / 3 collection files**,
and comparisons are drawn as **identity sets**, never as counts.

## 1. The final-tree census, captured twice

Plan A1.2.1 requires the census to be captured twice before any baseline diff is drawn. Both captures
are one root `vitest run` each (root `vitest.config.ts`), taken **sequentially** — an earlier pair on
this lane overlapped and had to be quarantined
([`transcripts/root-census-attempt-overlapped-DISCARD.txt`](transcripts/root-census-attempt-overlapped-DISCARD.txt)).
Driver: [`scratch/final-census.sh`](scratch/final-census.sh).

| capture | start (Z) | files | legs | titled red | failed files | ids (`scripts/fail-set.mjs capture`) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 06:48:59 | 502 | 6277 | 19 | 9 | **22** (19 tests + 3 collection) |
| 2 | 06:50:37 | 502 | 6277 | 20 | 10 | **23** (20 tests + 3 collection) |

Per-root shape (capture 1; `scratch/root-census-after-1.json`):

| root | files | legs | titled red |
| --- | --- | --- | --- |
| runtime | 350 | 4002 | 8 |
| client | 27 | 482 | 0 |
| testkit | 29 | 372 | 0 |
| storage | 23 | 287 | 0 |
| domain | 26 | 523 | 10 |
| contracts | 13 | 150 | 0 |
| remote | 15 | 232 | 0 |
| legacy | 7 | 100 | 0 |
| tools | 12 | 129 | 1 |
| **total** | **502** | **6277** | **19** |

## 2. The diff, drawn as identity sets

```
$ diff <(sort scratch/baseline-2162f6a7.ids.txt) <(sort scratch/root-ids-after-1.txt)
IDENTICAL to the published nine-root baseline
```

**NEW 0 / FIXED 0.** The final tree's failing-identity set is exactly the published set:

```
FILE packages/runtime/test/p8s3b-result-effects.test.ts::COLLECTION-OR-UNHANDLED
FILE packages/runtime/test/t12a-b2-child-identity.test.ts::COLLECTION-OR-UNHANDLED
FILE packages/runtime/test/t12a-glue-handoff-ports.test.ts::COLLECTION-OR-UNHANDLED
TEST packages/domain/test/t1-capability-schema.test.ts::… (9 legs: 1, 2, 3, 7, 8, 9, 10, 11, 11b)
TEST packages/domain/test/t2-blueprint-hash.test.ts::t2 hash: hashable projection projects absent optional singles as explicit null
TEST packages/runtime/test/d3-member-identity-context.test.ts::D3 … D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected …
TEST packages/runtime/test/p6t3-mediation.test.ts::… (5 legs: 1, 3, 4, 5, 7)
TEST packages/runtime/test/p6t3-restart.test.ts::… (2 legs: 2, 5)
TEST packages/tools/test/p6t6-actions.test.ts::P6-T6 tool set — delegated actions (unit level) messaging: worker -> leader is delivered direct …
```

(full 22 lines, verbatim: [`scratch/root-ids-after-1.txt`](scratch/root-ids-after-1.txt))

**Escalation check (a red that turns into a collection error is an escalation, not a fix):** the three
`FILE …::COLLECTION-OR-UNHANDLED` identities in the final capture are the same three files the baseline
names, and every titled red is still titled. No red moved between the two categories in either
direction. Nothing escalated.

## 3. The load flake, in the second capture only

Capture 2 carries one extra identity:

```
TEST packages/runtime/test/p6t1-parallel.test.ts::P6-T1 P2: N=5 same-template parallel activations all succeed
       (raised quotas) five activated results, five COMMITTED operations, five members, five child Sessions
```

`p6t1-parallel.test.ts` **as a whole group** is the flake the plan's A1.2 allowance names. It was
re-run solo twice on this lane — at base ([`transcripts/p6t1-parallel-solo.txt`](transcripts/p6t1-parallel-solo.txt):
9/9 green in 812 ms) and again on the final tree at 06:52:46 Z (9/9 green) — so it is a load
flake, recorded and not counted as a regression. It is also **not** subtracted from capture 2: both
captures are published as they ran.

## 4. The merge-gate composition smoke leg (build state, disclosed)

At base, in a freshly created worktree, this root census reported 20 titled reds — the 19 baseline
reds plus:

```
TEST packages/testkit/test/a4p7-merge-gate.test.ts::A4-PR7 §7.6 … the composition smoke leg … is green …
```

refusing with `refused`, because `packages/client/dist` is gitignored and absent in a fresh worktree,
and the leg shells out to the built composition. After `pnpm build` + `pnpm build:composition` (both
exit 0, working tree stayed porcelain-clean and byte-stable —
[`transcripts/build-for-census.txt`](transcripts/build-for-census.txt)) the leg is green, and the
census then reports the 19-red baseline shape. **This is build state, not an Alpha.4 regression**: a
§7.6 gate run must be preceded by `pnpm setup`; the lane that authored that leg should know the
census is build-state-dependent (recorded as a finding for the merge-gate owner, no fix attempted —
the test file is off-limits to this lane).

## 5. Root-command equivalence — what each command actually loads

§7.6's merge gate names two different populations, and they are not the same files:

| command | config | `include` | what it loads | legs |
| --- | --- | --- | --- | --- |
| `pnpm test` (root) = `vitest run` | root [`vitest.config.ts`](../../../../../vitest.config.ts) | `packages/*/test/**/*.test.ts`, `environment: node`, `pool: threads`; **excludes** `packages/client/test/s3-client-generation-spike.test.ts` | **502 files** across the nine roots — including only the client package's `.test.ts` files (**27**) | 6277 |
| `pnpm --filter @dsh-agent-team/client run test` = `vitest run` in `packages/client` | [`packages/client/vitest.config.ts`](../../../../../packages/client/vitest.config.ts) | `test/**/*.test.ts` **plus** `test/**/*.client.spec.ts` and `…tsx`; excludes 4 named files (2 of them no longer exist) | **55 files** = 28 `.test.ts` (the s3 spike included here, excluded at root) + 23 `.client.spec.tsx` + 4 `.client.spec.ts` | 880 |
| `pnpm -r run test` | each package's config | — | every package lane in turn; the union is a **superset** of the root run, and its per-package results are not comparable to a single root census | — |
| `pnpm test:node` = `node scripts/run-tests.mjs` | — | — | a different (plain-node) runner; not the §7.6 gate population | — |

Consequences, stated plainly:

1. **A green root census says nothing about 880 client-lane legs.** The root config's include pattern
   cannot see `*.client.spec.*`, so the entire governance UI lane (including the three named baseline
   client failures) is invisible to `pnpm test`. §7.6 therefore needs **both** runs; this lane captured
   both ([`transcripts/client-before-after-diff.txt`](transcripts/client-before-after-diff.txt)).
2. Two tracked client specs are excluded by name from the client config and were **not** run by either
   command: `test/client-bundle.client.spec.ts`, `test/team-plugin.client.spec.tsx`. The two
   `team-marker*` exclusions in the config name files that no longer exist (retired with evidence in
   T10), so the exclude list is stale but harmless.
3. The s3 spike is location-dependent: included by the client config, excluded at root, and (per
   [`dev/agent-workflow/evidence/a4-client-baseline/README.md`](../a4-client-baseline/README.md)) it
   collects in a worktree and fails collection in the main checkout. In this lane's client captures it
   **loaded and passed** (worktree location). It is not "fixed" or "broken" here — it is a disclosed
   location dependence.
4. The client config resolves the pristine upstream runtime `tests/deepseek-harness-test-use` by
   **walking up** until the marker exists. The worktree has no `tests/` copy, so both client captures
   resolved to the main workspace's pristine checkout (`0.2.0-rc.2 @ 639ed01539`, porcelain clean).
   A reader reproducing these captures from a worktree whose parent has no such checkout will get a
   different (empty) `srcMap`, not a different test set.

## 6. What a reader should take to the merge decision

- The final tree is **population-identical** to the published nine-root baseline: same 22 failing
  identities, same 502/6277 shape, zero new reds, zero fixes, zero escalations.
- The client lane is **name-set-identical** before and after, with exactly the three named baseline
  failures ([`SCENARIOS.md` §3](SCENARIOS.md) explains why the client comparison is a name-set diff:
  `scripts/fail-set.mjs` has no client mode).
- The §7.6 scenarios themselves are traced leg-by-leg in [`SCENARIOS.md`](SCENARIOS.md): 16 COVERED /
  3 PARTIAL / 0 ABSENT, and the named "targeted acceptance suite" holds only a third of them.
