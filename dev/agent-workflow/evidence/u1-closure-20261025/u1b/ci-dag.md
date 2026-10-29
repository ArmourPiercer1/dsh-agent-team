# U1-B — CI DAG (read from the tree at origin/master 4aaaa7b2, 2026-10-25)

Sources: `.github/workflows/{pr-gate,census-runtime,candidate-protection,characterization}.yml`,
`scripts/ci-pr-gate.mjs`. "Required" below is what the FILES declare/argue; no branch-protection
state is stored in the repo, so "actually marked required on GitHub" is NOT_VERIFIABLE from the
tree (pr-gate.yml itself says "watch one run report before you require it").

## Workflow inventory

| Workflow | Triggers | Job(s) | Role / required? |
|---|---|---|---|
| `pr-gate.yml` (`pr-gate`) | `pull_request: [master]`, `push: [master]`, `workflow_dispatch` | `gate` (ubuntu-latest, 90 min, concurrency cancel-in-progress **false**) | THE documented merge gate ("THIS FILE IS A SHELL" for `scripts/ci-pr-gate.mjs --full`). Intended required-check context = job name `pr-gate`; repo cannot verify it is enabled. |
| `census-runtime.yml` (`census-runtime`) | same three triggers | `census-runtime` (60 min, cancel-in-progress **true**) | The census actually ran against the pinned pristine host; `pr-gate` declares census refused, this one withholds the exemption. Its own comment: "acceptable ONLY while this check is informational" → **informational, not required** per the file. |
| `candidate-protection.yml` (`candidate-protection`) | same three triggers | `candidate-protection` (15 min) | Grades an EXTERNAL pinned evidence head (`090b87b5…`, branch a5-candidate-pkg): `test-human-protection.sh`, asserts `SUMMARY pass=9 fail=0` + `SKIP N6`. "Separate file, separate check name, no branch protection implication" → not required. |
| `characterization.yml` (`characterization`) | `workflow_dispatch` ONLY (manual since 2026-09-17 demotion) | `characterize` (30 min) | P2 characterization vs pinned upstream `fb2c4b9e69` (0.1.5-rc.2). Explicitly "archival/manual … NOT a merge gate". |

## pr-gate / census-runtime job legs (scripts/ci-pr-gate.mjs)

Leg order (normative, cheap-first): `graph-parse, state-freshness, install, blueprint-fence,
typecheck, lint-identities, artifacts-at-head, census` (8 legs; census opt-in by default, run by
`--full`; any SKIP under `--full` = failure; verdict channel `DSH-CI-LEG`/`DSH-CI-VERDICT`).

| Leg | What it runs | Notes |
|---|---|---|
| graph-parse | `python3` + PyYAML `yaml.safe_load` over `dev/agent-workflow/graph.yaml` | parser missing = FAIL (never skip; #195 incident) |
| state-freshness | git ancestry of `graph.yaml` state pointers + SESSION_ROUTER_LOG contiguity; folded-in `current_contract` grading (Q1–Q7) with conservative drift set (packages, scripts, tests/paths.mjs, package.json, pnpm-lock.yaml) | extends census of 2026-10-22 root ruling |
| install | `pnpm install --frozen-lockfile` | lockfile is an assertion, not a write |
| blueprint-fence | `scripts/verify-blueprint-version-clean.mjs` vs `blueprint-fence-baseline-606a0be7.txt` | NEW offending path = fail |
| typecheck | `pnpm typecheck` (= `pnpm -r run typecheck`) | only leg that sees bad `.test.ts` via tsc |
| lint-identities | `scripts/lint-identities.mjs --diff lint-identities-0237d487.txt` | identity diff, NOT the `pnpm lint` exit code (lint red-at-master by ruling) |
| artifacts-at-head | `scripts/check-artifacts-at-head.mjs` (space-separated `--store-dir`) | `DSH-ARTIFACT-VERDICT … verdict=ok drift=0` |
| census | `rm packages/testkit/test/.tmp-fault` then `pnpm exec vitest run` ×`--census-captures` (CI: 2, graded as UNION) with `--census-test-timeout` override (pr-gate: 20000; census-runtime: 90000); compares red IDENTITY SETS (never counts) against `nine-root-2b1099d7.md` (9 titled tolerated reds) | REFUSES (`refused`, reason `missing-test-use-checkout`) when `tests/deepseek-harness-test-use` is absent; refusal legal only via `--allow-refused census` |

Hosted command lines:
- pr-gate: `node scripts/ci-pr-gate.mjs --full --census-captures 2 --allow-refused census --census-test-timeout 20000 --store-dir … --transcript-dir …` then `--check-transcript` re-grade (`if: always()`).
- census-runtime: provisions the pinned pristine host (pin READ from `tests/paths.mjs` → 0.2.0-rc.2 @ `639ed01539…`, fetched `--depth 1` by SHA from public fork, drift = fail; host built via `pnpm install --ignore-scripts` + `DSH_CLIENT_COMMIT_HASH=… pnpm run build`), builds this repo (`pnpm run build && pnpm build:composition`), then `--full --only census --census-captures 2 --census-test-timeout 90000` with NO `--allow-refused`, + `--check-transcript` re-grade.

## DAG shape (dependency / meaning, as declared)

```
push/PR to master
  ├─ pr-gate          (static + build legs; census DECLARED-REFUSED on hosted runners)
  ├─ census-runtime   (same census, host provisioned, refusal = fail)  [informational]
  └─ candidate-protection (external pinned evidence spec)              [separate authority]
manual only: characterization (archival)
```
No `needs:` between workflows; independence is deliberate ("no amount of refusedlegs prose" —
pr-gate green ≠ census measured; census-runtime exists to make that pair honest).

## NOT_RUN in this work package (no host may boot; U1-B scope)

- T2/T3 and every real-host kit under `tests/kits/` that boots a DSH host (e.g.
  `rc2-real-host-smoke`, `pr-d-control-real-host`, `pr-c-mcp-isolation-smoke`,
  `f15-mcp-live-loss-smoke`, `exec-contract-live-smoke`, `alpha5-pr8-e2e`,
  `c1-leader-approval-smoke`, `mcp-initial-grant-smoke`, `model-preference-routing-smoke`,
  `pr-a-governance-smoke`, `pr-b-effective-policy-smoke`, `pr-e-requirement-recovery-smoke`,
  `pr-f-closure-smoke`, …): NOT_RUN — reason: package forbids starting any DSH host; these are
  kit scripts, not collected by the root vitest run anyway.
- `tests/characterization/run.mjs` suite: NOT_RUN — boots the pinned host; workflow is manual-only.
- Client lane (`packages/client` `*.client.spec.ts(x)`, own `vitest.config.ts`, 30 specs): NOT_RUN —
  outside the root include (s3 spike excluded; lane graded separately by
  `scripts/a4-client-lane-report.mjs` with its own disclosed baseline trio).
- census gate legs needing `tests/deepseek-harness-test-use`: the two `pnpm exec vitest run` passes
  DID run everything the root config collects (604 files); legs whose error text shows the absent
  pristine-host/checkout precondition are recorded `ENV-NOT_RUN` in `reds.json` (11 identities).
