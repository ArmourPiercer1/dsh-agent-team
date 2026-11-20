# ute0-contract-20261120 — UTE-0 evidence

**Task:** UTE-0, "freeze the implementation contract" — work package 1 of the
UTE G1 "Native Execution Consolidation" round.
**Branch:** `task/ute0-contract-20261120`. One branch, one writer.
**Base:** `origin/master` = `ef7e3af0088bf3af8fc765ce27951f9dbad92892`.
**Contract:** [`docs/plans/memo/ute-g1-20261120/`](../../../../docs/plans/memo/ute-g1-20261120/README.md).

Every transcript here is captured with the command echoed and its exit code
(`EXIT=…`). A gate not run is listed in §3 as `NOT RUN`; nothing is reported
green that was not observed.

## 1. Transcripts (verbatim)

| file | command | observed |
|---|---|---|
| `suite.txt` | `node --test scripts/ute-retirement-gate.test.mjs` | 14 tests, 14 pass, 0 fail, `EXIT=0`; 13 `UTE-MUTATION` transcript lines (P1, NC-1…NC-10, REAL, CLI-ALLOW) |
| `gate-refusal.txt` | `node scripts/ute-retirement-gate.mjs --family fs` and `… --json` | `UTE-RETIREMENT-REFUSED family=fs codes=UTE_SEMANTIC_DIFFERENCES_UNRESOLVED state=NOT_RETIREABLE`, `EXIT=1` in both modes |
| `gate-allow-synthetic.txt` | `node scripts/ute-retirement-gate.mjs --family synthetic-selftest --ledger scripts/fixtures/ute-retirement-selftest/ledger.json` | `UTE-RETIREMENT-ALLOW family=synthetic-selftest terms=4/4 state=RETIREABLE`, `EXIT=0` |
| `gate-unknown-and-all.txt` | `… --all` and `… --family pty` | `--all` refuses `fs` (`EXIT=1`); unknown `pty` → `UTE_LEDGER_UNKNOWN_FAMILY` (`EXIT=1`) |
| `repo-gates.txt` | the eight collection gates (catalog, catalog test, dispatch, ci-required, negative controls, docs-sync, lint-identities, `git diff --check`) | all `EXIT=0`; details below |
| `isolation.txt` | `git diff origin/master --stat` / `--name-status` | only the files in §2 |

Observed values worth quoting (full text in `repo-gates.txt`):

```
DSH-TEST-CATALOG tests=879 digest=sha256:ee07c3bd… refused=0 findings=0  (UNCOLLECTED 41, EXCLUDED 14)
test-catalog.test.mjs: pass 28, fail 0
DSH-TEST-DISPATCH-CHECK mode=inspect PASS legs=18 bad=0
EB3-CI-REQUIRED pass workflows=10 findings=0
33/33 control(s) behaved as required          (incl. C-NH1, the next-host lane argv law)
docs:sync --check: docs=175 plans=134 findings=0 blocking=0
lint-identities: baseline 76 distinct; new 0, resolved 0
git diff --check: EXIT=0
```

## 2. What the change set contains

New:

- `docs/plans/memo/ute-g1-20261120/{README.md,CONTRACT.md,RETIREMENT.md}` — the frozen contract.
- `scripts/ute-retirement-gate.mjs` — the gate (named refusals, `--json`, exit 1 on refusal).
- `scripts/ute-retirement-gate.test.mjs` — 14 tests: positive control, one negative control per refusal code, a fabricated-approval control, the real seeded row, and two CLI controls.
- `scripts/fixtures/ute-retirement-selftest/**` — a committed synthetic family used only by the CLI allow control; explicitly labelled "not a retirement row".
- `dev/agent-workflow/ledgers/ute-retirement.json` — production ledger, seeded with `fs` = `NOT_RETIREABLE`.
- `dev/agent-workflow/evidence/ute0-contract-20261120/**` — this directory.

Additive edits (census lane must execute the suite; the mirrored manifest leg
must byte-match, C-NH1):

- `.github/workflows/census-runtime.yml` — `scripts/ute-retirement-gate.test.mjs`
  appended to the existing next-host-lane `run:` argv.
- `dev/ci/eb3-ci-manifest.json` — the same token appended to the mirrored
  `ci-census` leg `check[]`, plus one sentence in that leg's `why`.

**Not touched:** `AGENTS.md`, `docs/ROUTER_RULES.md`, `docs/TEST_METHODS.md`, any
governance document, any active plan, `dev/engineering/**`, `packages/**`,
`tests/paths.mjs`, dispatch legs, parity evidence, `scripts/test-catalog.test.mjs`,
PR #765's branch. No upstream file was modified (`CORE PATCH BUDGET = 0`); no
private API was imported.

## 3. Honest limits (UNKNOWNs)

1. **`ci-integration` / hosted L2** — the census next-host lane only runs on the
   hosted census job; this machine cannot execute it (no rc.5 provisioning run in
   this worktree). The suite itself is host-free and was observed locally, but
   *this PR's CI has not run when this file was written*. `[UNKNOWN]` until the
   first hosted run.
2. **`ci-product` / `pr-gate` legs** — not run locally (they need the composed
   host). The eight collection gates above are the local proxies named in the
   task; no claim is made about the product legs.
3. **The contract's proposals are not decisions.** `CONTRACT.md` §3 (settlement
   writer interface) is a proposed interface for UTE-2; it is not implemented,
   and no fact has been written through it. The gate does not grade it.
4. **`SemanticDifferencesResolved` stays false for `fs`.** This evidence does not
   close either blocking difference; the compatibility-interface choice (A/B for
   the refusal code, C/D for prose-vs-typed) remains the owner's.
5. **`--max-uncollected 41` is a ratchet, not a compliment.** The new suite is
   collected (catalog `tests=879`, `UNCOLLECTED 41` unchanged); nothing about the
   41 pre-existing uncollected suites was fixed or hidden.
