# A4-PR7 Task 7.6 — machine-acceptance receipts as of `55482e4d` (partial leg)

Writer: the A4-PR7 subagent. Branch `feat/a4-pr7-v3-cutover`. All receipts are raw
files under `.scratch/gates/` (git-ignored) and are to be promoted to
`dev/agent-workflow/evidence/a4-pr7/` by whoever closes the lane; the summaries here
quote them.

## Legs run, with results

| leg | command | result |
| --- | --- | --- |
| repo typecheck (attempt 1) | `pnpm -r run typecheck` | 4 of 8 packages Done, `packages/testkit` Failed — 3 errors, all in the fence wrapper test (a `.mjs` import with no type surface). Fixed in `55482e4d` by adding `scripts/verify-blueprint-version-clean.d.mts`. |
| repo typecheck (re-run, post-fix) | `pnpm -r run typecheck` | **8 of 8 packages `typecheck: Done`, 0 lines matching `error TS`, exit 0** (`.scratch/gates/7-6-typecheck-2.txt`). This is the leg, met. |
| `pnpm lint` identity diff | `node scripts/lint-identities.mjs --out … --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | **PASS: `new 0, resolved 0`, 160 identity lines / 76 distinct, baseline 76 distinct** (`.scratch/gates/7-6-lint-diff-2.txt`). The FIRST run of this leg found **2 new identities authored by this lane** — see the finding below — which is the whole argument for having the tool instead of the README recipe. |
| whole-repo tests | `npx vitest run` (from the repo root, after `rm -rf packages/testkit/test/.tmp-fault .tmp-t12a-b2-home`) | `Test Files 10 failed \| 476 passed (486)`, `Tests 19 failed \| 5955 passed (5974)`. Receipt `.scratch/gates/7-6-full-test.txt`. |
| baseline for that leg | `base-run1.txt` (same command, same tree base) | `Test Files 9 failed \| 474 passed (483)`, `Tests 19 failed \| 5897 passed (5916)`. |
| **failed-test identity** | diff of the two `× ` sets | **IDENTICAL — 19 = 19, same six files, same per-file counts**: `packages/domain/test/t1-capability-schema.test.ts` (9), `packages/domain/test/t2-blueprint-hash.test.ts` (1), `packages/runtime/test/d3-member-identity-context.test.ts` (1), `packages/runtime/test/p6t3-mediation.test.ts` (5), `packages/runtime/test/p6t3-restart.test.ts` (2), `packages/tools/test/p6t6-actions.test.ts` (1). |
| **file-level (0-test) delta** | diff of the `(0 test)` sets | baseline 3 (`p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports`) → now 4: **`packages/tools/test/c1-list-pending-control.test.ts` is new.** See the finding below. |
| runtime package suite | `npx vitest run packages/runtime` | 6 failed files / 8 failed tests — **identity-identical to the runtime baseline set** (`.scratch/gates/7-2-final-runtime.txt` vs `7-2-runtime-full.txt`). |
| the 7.2 lane | `npx vitest run packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts` | 54 passed (54). |
| the 7.5 fence | `npx vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | 9 passed (9). |
| the p4t6 pin | `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | 10 passed (10). |
| the fence scan itself | `node scripts/verify-blueprint-version-clean.mjs` | exit 1, `RESULT dirty(20 files, 49 sites)`, 114 files in scope. |
| new files' lint | `node scripts/lint-identities.mjs --target <each new file>` | 0 identities each (and eslint does cover `scripts/*.mjs` — verified, so the zero is not an ignore). |

## Legs NOT run (and why — none of them may be inferred from the legs above)

- ~~Full `pnpm -r run typecheck` after the fix~~ **done: 8/8 Done, 0 `error TS`.**
- **Root `pnpm test` twice** (the plan's leg; only the single root `npx vitest run` was done).
- **Client lane** (baseline 3 failed test-name sets) — untouched by this lane, not re-measured.
- ~~the `pnpm lint` identity diff~~ **done: `new 0, resolved 0`.**
- **`pnpm build`, `build:composition`, `check:artifacts`, `pnpm smoke:composition`** — not run; `smoke:composition` is blocked here by the `clsx` dependency that cannot be installed in this sandbox (see `7-3-BLAST-RADIUS-AND-UNEXECUTED-FLIP.md` §7.4).
- **Remote 1–8 regressions, Remote/real-host kits** — NOT_RUN: this environment has no
  `tests/deepseek-harness-test-use/packages/cli/dist`, `tests/homes/.playwright-browsers`
  is empty, and there is no `/opt/google/chrome/chrome`. Recorded as
  NOT_RUN/BLOCKED with the reason, not as passing.

## The two lint identities this lane introduced, and what the tool caught

The first full-repo run of `scripts/lint-identities.mjs --diff` reported
`new 2`: `@typescript-eslint/no-unused-vars` in `packages/runtime/src/plugin/root.ts`
and in `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts`. Both were real
damage from Task 7.2, invisible to every other leg that had passed:

- `root.ts:89` still imported `parseBlueprint` after Task 7.2 moved the parse behind
  `requireAnchor` — a dead import in the file whose whole change is about *not*
  parsing at construction, which is the kind of leftover that quietly re-legitimises
  the old shape for the next reader.
- the test file carried a `dCode` alias nobody called, and — more usefully — a
  `team.create` wire call over the OPEN bound document whose assertions had been
  deleted along with the accidental-green ordering test it belonged to.

The second was not fixed by deletion. A refused `team.create` answering `ok:false`
means little unless the *identical call shape* (endpoint, param names, blueprint
identity) is shown to succeed against a bound document this build runs, so the dead
call became that positive control (one more test; the lane is 55/55). Re-running the
whole-repo diff returns `new 0, resolved 0`. Mutes were not used and are not available.

## The one new failing suite, stated as a finding

`packages/tools/test/c1-list-pending-control.test.ts` fails at module load:

```
TeamDomainError: team_domain already exists (schema_meta holds 10 stamp row(s)); use openTeamDomain
  at createTeamDomain (packages/storage/repositories/team-domain.ts:280)
  at createP6T1World (packages/runtime/test/p6t1-helpers.ts:359)
  at createC1ToolWorld (packages/tools/test/c1-list-pending-control.test.ts:95)
  at packages/tools/test/c1-list-pending-control.test.ts:164:15
```

What is known: it reproduces in isolation (`npx vitest run
packages/tools/test/c1-list-pending-control.test.ts`) **after** deleting
`packages/testkit/test/.tmp-fault` and `.tmp-t12a-b2-home`; the file and its helper
chain (`p6t1-helpers.ts`, `p6t4-helpers.ts`, `packages/testkit/fault-injection/file-seam.mjs`)
were last touched by `3dd7de20` (A4-PR5) and `a1b2431b` (A4-PR4) — no A4-PR7 commit
modifies any of them; the file creates two worlds with distinct basenames
(`c1-list-pending`, `c1-escalate-arm`), so there is no intra-file collision; and the
diagnostic "10 stamp row(s)" does not match the nine stores this tree stamps.
What is NOT claimed: a cause. This is the shape of the documented stale-`.tmp-fault`
residue flake class (recorded at `4ac3bd8e`: "the transient … import error in one full
run was the known stale .tmp-fault partial-medium flake") — but the residue theory
does not explain a clean-dir reproduction, and the nine-versus-ten stamp discrepancy
points at a medium written by a different schema generation than this tree's. The next
writer should resolve it before any stage-closure claim; it is not silently accepted
here, and it is the only delta between the baseline and this run.
