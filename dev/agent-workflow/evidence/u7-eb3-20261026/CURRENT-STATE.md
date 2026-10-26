# EB3 Current-State Audit (C1) — 2026-10-26

**Branch:** task/u7-2-ci-tiers-20261026 off origin/master (496a3980f)
**Purpose:** reproduce and classify the current CI posture before adding
enforcement.  No changes are made in this commit.

---

## 1. Workflows present

| file | name | trigger | Required? | cancel-in-progress |
|---|---|---|---|---|
| `.github/workflows/pr-gate.yml:44` | `pr-gate` | pull_request→master, push→master, workflow_dispatch | **YES** — branch protection `contexts=["pr-gate"]` | false |
| `.github/workflows/census-runtime.yml:48` | `census-runtime` | pull_request→master, push→master, workflow_dispatch | no | true |
| `.github/workflows/candidate-protection.yml:37` | `candidate-protection` | pull_request→master, push→master, workflow_dispatch | no | false |
| `.github/workflows/characterization.yml:24` | `characterization` | workflow_dispatch only | no (manual) | true |

Branch protection API (`required_status_checks.contexts`): `["pr-gate"]` only.
`enforce_admins: true`, `allow_force_pushes: false`.

---

## 2. pr-gate internal structure

The entire gate is ONE job (`gate`/ name=`pr-gate`) calling
`scripts/ci-pr-gate.mjs --full`.

**Legs** (declared in `scripts/ci-pr-gate.mjs:116–132`, `LEG_ORDER`):

| leg | default | notes |
|---|---|---|
| `graph-parse` | required | |
| `state-freshness` | required | includes Q1–Q8 current-contract checks |
| `install` | required | |
| `blueprint-fence` | required | |
| `typecheck` | required | |
| `lint-identities` | required | identity-diff, not exit-code |
| `artifacts-at-head` | required | |
| `census` | **opt-in** (`OPTIONAL_BY_DEFAULT`) | pr-gate allows `--allow-refused census`; census-runtime.yml runs it without `--allow-refused` |

docs:sync --check and docs:probe ride as **steps** inside the same single job
(`.github/workflows/pr-gate.yml:169`).

---

## 3. What EB3-A/B/C/D requires vs what exists

### EB3-A — Change-impact graph
**Required:** from source paths, symbols, owning docs, contracts, dynamic
sources → select `tests/profiles/docs checks`; unknown impact → non-zero selection.

**Current state:** ABSENT.  `scripts/ci-pr-gate.mjs` runs `--full` unconditionally;
there is no path-to-job selection graph.  `dev/engineering/doc-ownership.yaml` maps
source to owner-docs for `docs:probe` advisory (not for test/CI selection).

### EB3-B — Four-tier CI: ci-fast / ci-integration / ci-security / ci-full
**Required:** `ci-fast` mandatory `docs:probe`; source/doc-dependency hit triggers
`docs:sync --check`; separate `ci-integration`, `ci-security`, `ci-full` tiers.

**Current state:** SINGLE tier only.  All legs run under one job.  `docs:probe`
and `docs:sync --check` are steps in that same single job, not a separate
fast tier.  No `ci-integration`, `ci-security`, or `ci-full` tiers exist.

### EB3-C — Synthetic merge-tree Required check
**Required:** PR merge-tree synthetic check; `always()` job summary; absence,
skip, ENV_BLOCK, cancel, refused must NOT green; configured as Required.

**Current state:** ABSENT.  There is no merge-tree summary job.  The single
`pr-gate` job itself is Required, but:
- if the job is **cancelled**, GitHub reports `cancelled` — not green, not red —
  leaving the PR in a permanently blocked/inconclusive state.
- if a leg inside the job is **refused** and the run still emits a `DSH-CI-VERDICT pass`
  token (e.g. census with `--allow-refused census`), the transcript re-grader step
  (`.github/workflows/pr-gate.yml:248–253`) can still produce exit 0 for the job.
- **No explicit merge-tree commit is checked.**  The `--full` flag prevents silent
  skip inside the gate, but there is no outer required summary job that aggregates
  all inner jobs with `if: always()`.

**GAP — how a green run hides a missing/skipped/refused job:**
1. `census-runtime` is **not Required**.  Any PR can merge with census never run
   (or with it cancelled).  Its skip is a disclosure, not a block.
2. The only Required check is `pr-gate`; it declares `--allow-refused census`.
   A run where census refuses (because `tests/deepseek-harness-test-use` is absent)
   can still produce a `pass` token.  The re-grader (`--check-transcript`) would
   fail only if the refusal is undeclared (see `scripts/ci-pr-gate.mjs:635`
   `applyRefusalPolicy`); but the declaration is in the workflow's `argv`,
   so a refused census is accepted as long as the refusal matches the declared name.
3. `census-runtime.yml:70 cancel-in-progress: true` means a push while the census
   runs cancels it — producing a `cancelled` status that, being non-Required, does
   not block merge.

### EB3-D — RUN Manifest validation (sources + evidence)
**Required:** RUN schema/hash; CI emits candidate + Host/TrustedSources digest;
alter/wrong-digest/mixed-generation must refuse.

**Current state:** PARTIAL.  `tests/world-factory/lib/run-record.mjs` provides
`u5-run-record/1` schema with `bindings` (Team/Host/config digests), `overall`
verdict, `VERDICTS` set.  The world-factory canary runner
(`tests/world-factory/u5-canary-runner.mjs`) uses this schema locally.
**However:** no CI step validates RUN records, no `scripts/` entry point checks
an existing RUN manifest for digest correctness, and no workflow uploads or
validates a RUN manifest as a CI artifact.

---

## 4. docs:probe / docs:sync baseline

Running on the clean tree:
```
docs:probe blocking=0 non_blocking=0 advisories=0 contracts=20 pairs compared
docs:sync --check: docs=77 notes=4 plans=47(0 declaring) findings=0 blocking=0
```
Both exit 0.

---

## 5. Where a green CI run can currently hide a problem

| scenario | current outcome | EB3 requirement |
|---|---|---|
| Required CI job removed from `.github/workflows/pr-gate.yml` | next PR passes (no Required check fails) | MUST be detected |
| Unknown MCP tool injected into a Family contribution | `arc-a-fitness` catches it in census; census is `--allow-refused`-exempted on hosted PR runs; non-Required `census-runtime` would catch it | MUST be detected before merge |
| Execution Definition replaced (e.g. `family-body` → computed) | `arc-a-fitness` L4 closedness would catch `dynamic` nativeNames; not enforced as Required gate on hosted runner (census refused) | MUST be detected before merge |
| Family A imports Family B internals (cross-family influence) | lane-law is stated in READMEs; no CI script walks import edges and fails | MUST be detected |
| ENV_BLOCK reported by a leg | `applyRefusalPolicy` turns undeclared refusal to fail; declared `--allow-refused` turns it to `refused` verdict (pass token possible) | Must not green |
| `census-runtime` cancelled by push | non-Required cancelled check — PR merges | Must not green if Required |

---

## 6. Preserved positives (must stay green after EB3 enforcement)

1. **Non-Team native positive control** — `packages/runtime/test/u6-pr3-bl01-ask-door.test.ts:161`
   ("CI03-b control: WITHOUT a plane the native bash rides on, unchanged", asserting
   `toBe(1)` at :177) and `packages/runtime/test/u6-pr2-review-r1.test.ts:299`
   ("non-Team native read rides on, unchanged", asserting `toBe(1)`). CORRECTION to an
   earlier draft of this file: these are **green tests**, not census legs in the
   known-old-red set — they assert that an ordinary (non-Team) install is never
   narrowed. They must stay green, and the assertion (not the title) is what is pinned.
2. **Complete known-old-red identity set** — the baseline the gate reads
   (`BASELINES.census` in `scripts/ci-pr-gate.mjs`) held **9** tolerated identities at
   `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2b1099d7.md:49-57`
   (t2-blueprint-hash ×1, p6t3-mediation ×5, p6t3-restart ×2, p6t6-actions ×1). The
   "22 disclosed failing identities" figure repeated in earlier drafts is OLDER history
   (`scripts/ci-pr-gate.mjs:61`), not this baseline. The enforcement must not drop any
   identity from whatever the pointer names — and as of PR #393 the pointer moved to
   `nine-root-u7-1-old-reds.md`, which retires all nine with a per-identity table rather
   than deleting them.
3. **docs:probe/docs:sync clean baseline** — currently exits 0; must remain 0
   after new scripts land.
4. **ci-pr-gate self-test** — `node scripts/ci-pr-gate.mjs --self-test` exits 0
   (77 assertions when this audit was written; 94 after PR #393 added the
   RETIRED-TO-EMPTY cases); must remain passing.

---

## 7. Evidence of current state: local commands run

```
node scripts/docs-probe.mjs --worktree-only   # EXIT=0, blocking=0
node scripts/docs-sync.mjs --check            # EXIT=0, blocking=0
node scripts/ci-pr-gate.mjs --only graph-parse --only state-freshness
# EXIT=0, DSH-CI-VERDICT pass pass=2 fail=0 skip=0
node scripts/ci-pr-gate.mjs --self-test
# EXIT=0, DSH-CI-SELFTEST pass 77 assertions
```

Run on worktree HEAD = 496a3980f (origin/master tip).
