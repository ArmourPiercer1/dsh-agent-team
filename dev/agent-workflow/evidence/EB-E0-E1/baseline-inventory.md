# E0 read-only census — rollup (EB0-1 … EB0-5)

Engineering Baseline line, session `session-cbcf66f7-0fb9-469a-ba8b-0c0398b48254`,
worktree `.worktrees/eb-e0-e1`, branch `task/eb-e0-e1-doc-baseline-20261029`.
Authored 2026-10-23 (UTC). All five sub-censuses were **read-only**: no writes, no
installs, no test runs, no Host/port contact, no network except read-only GitHub API.

## Source labelling rule used in this file

E0 describes a **tree**, not "the project". Every fact carries the source it was
measured on:

| label | means |
| --- | --- |
| `@929` | tracked content of `master@929fc4af23725a1de4cda9206eb7abb149b1bf12` (this branch's base, = PR #361 base) |
| `PR361@b97ffda` | head `b97ffdafdceeb73d58a06fe5fb6563820d063d28`, read over the GitHub API (object not present locally) |
| `CI run <id>` | a hosted Actions run, identified by run id + `head_sha` |
| `live` | observed in this environment at 2026-10-23 (Host/profile/filesystem), not a repository fact |

Anything else is written as inference or `NOT_VERIFIED`.

## EB0-1 — authority entry points and the drift that matters

Four truth carriers, by their own text (`@929`):

* `dev/agent-workflow/graph.yaml:64` `current_phase` = Alpha.5 tool-IO governance;
  `:91-97` `current_contract` = `phase_id: alpha5-tool-io-governance`,
  `baseline: 9b2ee57bc5afd30e89855e09d1769d2e5ec83912`, `baseline_collected: 2026-10-22T07:20:56Z`;
  `:87-90`/`:99` demote `state_pointers` to HISTORICAL. `git merge-base --is-ancestor`
  confirms the baseline **is** an ancestor of HEAD.
* `dev/agent-workflow/SESSION_ROUTER_LOG.md` is append-only (2,166,679 B / 6,856 lines /
  318 `##` headings); **last entry is 2026-10-18** (`:6850`) while 17 commits (PR #340–#358,
  2026-10-20→23) landed after it. The log tail is a declared recovery authority and it lags.
* `docs/ROUTER_RULES.md` §0 (2026-10-07 user ruling, `:25-31`) **abolished** the §1
  model-route pin; §1 text (`:45`, `:53` "所有工作由 `qiyuan-self/qwen3.8-27b` 完成" /
  "不满足时停止执行") survives as marked history (`:43`). A session reading only §1 would
  stop itself for the wrong reason.
* `docs/STATUS.md` self-disclaims (`:3`) yet carries three different "nows"
  (`:8` 2026-10-19, `:77` 2026-10-01, `:25` "CURRENT 指针不在本文维护").

Key gaps (each verified by existence check, `@929`): `AGENTS.md:20,:35` +
`docs/ROUTER_RULES.md:11-14` + `README.md:34-35,:265` place the four frozen 20260829
documents in `docs/plans/paused/`; that directory holds four unrelated `0.1.1-alpha.1*`
files, and the frozen set physically lives in `docs/plans/finished/`. 29 of 29 loose
`docs/plans/active/<loose>.md` references inside `graph.yaml` are missing (relocated).
`dev/agent-workflow/locks.yaml` declares a LOCKED_SURFACE with `owners: {}`, untouched
since 2026-08-29. `docs/plans/active/alpha4-permission-governance/` is called historical
by `AGENTS.md:22` yet still sits under `active/`.

Environment divergence, not a repo fact (`live`): the copy of `AGENTS.md` injected into
sessions in the **outer** checkout is `6259cf4bc` (2026-10-02, one full phase behind);
it is 757 commits behind `origin/master` and predates ROUTER_RULES §0. This is why a
session started there can believe an abolished route is live.

## EB0-2 — script, test and CI surface (`@929`)

Root `package.json:34-46` = 12 scripts; **no general document-consistency check
existed** (this branch adds `docs:probe` / `docs:sync` / `docs:controls`, additive, not
wired into CI). Wording corrected 2026-10-23: the absence of a *general* docs check says
nothing about the *freshness* leg — `ci-pr-gate.mjs` has a state-freshness leg at `@929`,
and a `phase_status` checker exists on the in-progress `feat/a5m2-*` refs. "No docs check"
must not be read as "no freshness check".
`scripts/ci-pr-gate.mjs` = 8 legs (graph-parse, state-freshness, install, blueprint-fence,
typecheck, lint-identities, artifacts-at-head, census) with a verdict algebra of
pass/fail/skip/refused, missing-token⇒fail, and identity-set differencing
(`:733-869`, "compare identity sets, never totals").

Reuse decisions for this line (what exists / what it does not): `fail-set.mjs`
(exit 0/1/2 + set diff), `a4-artifact-provenance.mjs` (failed vs refused),
`composition-smoke-closure.mjs` (skip-is-fail), `check-artifacts-committed.mjs`
(committed-vs-generated freshness) are the models this line imitated; **nothing** in
the tree link-checked markdown, scanned current-state prose, or regenerated a derived
document view — that gap is confirmed, and EB1 fills the narrow part of it.

Test surface: root vitest collects ≈604 files (`vitest.config.ts:22-26`); client lane
`*.client.spec.ts(x)` (30) is collected only by `packages/client/vitest.config.ts`;
`packages/domain/compatibility/test` (7) is outside the root include. Red sets stay
separate and are **not** merged anywhere: the current machine tolerance is the 9 titled
census reds (`dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2b1099d7.md:49-57`),
the historical Alpha.4 root-suite collection is 22 identities / 9 files
(`dev/agent-workflow/evidence/a4-pr0/baseline-closure/failing-identities-pr0-run2.txt`),
the client-lane trio and the `p6t1-parallel` load family are separate records.
No per-item red owner is recorded in any file searched. Test counts here are call-site
approximations — `NOT_VERIFIED` as leg counts.

## EB0-3 — tool source attribution (`@929`)

93 records = 89 tool-source + 4 surface, 27 families, 90 unique `(name,scope)` keys
(`docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md:9`);
every record is `targetStatus=PROPOSED_NOT_IMPLEMENTED_NOT_ACCEPTED` with
`executionEvidence=NOT_RUN`, and `freezeEligible ≡ false`. Path correction: `m0-closure-v3/`
is under `docs/plans/active/…`, not `docs/plans/memo/`.

`registerA5GovernedFamily` **does not exist**. Real mechanisms: native-definition harvest
`packages/runtime/src/plugin/live/agent-bindings.mjs:2410-2428` (from the global
`tools.schemas()` only; `mcp__` never inherits native trust `:695-725`), inherited-binding
comparison `packages/runtime/tool-dispatch/closed-world-guard.ts:432-511`, single-ACTIVE-binding
rule `packages/runtime/src/plugin/live/pa-mount-registry.mjs:103-145`, governed definitions
`packages/tools/a5p5-tools/src/register.ts:151` (`decide` required), mount
`packages/runtime/src/plugin/live/team-tool-plane.mjs:1873-1881`, `bindAll`
`packages/runtime/tool-dispatch/install.ts:1066-1180`. The 93-record keyset is closed
**only** against the pinned matrix, which itself declares non-exhaustiveness
(`TOOL-CAPABILITY-MATRIX-9b2.md:16`, `:163`). No "C1 PASS" exists anywhere in the record set.

## EB0-4 — worktrees, assets, capacity (`live`, 2026-10-23)

46 worktrees, ~20 with commits today, one HEAD moved during the census; tracked evidence
21,097 files / 509.5 MiB. **Reference-protection gap:** 5.1 G `evidence/retired-trees-2026-10-23/`,
3.5 G `recovery/` and a 38 M incident are referenced by zero tracked files. 525 test worlds
(426 empty `a5w5-*`), 16 `a5m2` locks holding cross-namespace pids → in-use status
`NOT_VERIFIED`. Disk at census time 107 G total / 12 G avail (90 % used); capacity
clean-up belongs to the a356 line, not here — this line adds only small text and Node files.
The live master checkout being 757 behind means porcelain in that checkout would
misclassify ~10k trunk-committed files as untracked: never read dirt from it.

## Execution-hold timing, corrected 2026-10-23

The hold instruction was delivered at **19:49:23Z while the controls run was still in
flight**; that run finished at **19:49:42Z**. The accurate description is "the pause
arrived while the command was running", not "the run completed before the pause". That
run's own end-of-run sweep then removed its scratch directory — the fixed-path recursive
cleanup the independent review had just flagged as unsafe, which is why the runner now
creates a per-invocation `mkdtemp` root that it owns and deletes nothing else.

## EB0-5 — performance, with corrections

**Corrected claim.** An earlier EB0-5 draft said "the sole workflow is
`characterization.yml`, `workflow_dispatch` only, so CI runs no docs check". That is
wrong and is retracted: `git ls-tree master@929fc4af2 -- .github/workflows` yields four
workflows — `candidate-protection.yml`, `census-runtime.yml`, `characterization.yml`,
`pr-gate.yml` — three of which trigger on `pull_request`/`push` to master. `characterization.yml`
is the manual one only. Generalising from one file to the repository is the error the
round-46 lesson warns about; recorded here rather than quietly edited.

**Corrected claim 2.** "CI has no freshness check" is also wrong on the in-progress line:
`git grep -c phase_status <ref> -- scripts/ci-pr-gate.mjs` = **0 at `@929`** but **19 on
`feat/a5-m2-integration` / `feat/a5m2-subagent-fix` / `feat/a5m2-family-rules` (2026-10-23)**.
A real `phase_status` freshness checker (Q9) exists there. `docs:probe` therefore
complements the state-freshness leg and does not re-implement it (stated in the probe's
own LIMIT output).

**Real hosted CI measurements** (`CI run`, fetched 2026-10-23T19:2xZ, duration =
`updated_at − run_started_at`):

| head_sha | workflow | run id | conclusion | duration |
| --- | --- | --- | --- | --- |
| `b97ffdafd` (PR #361 head) | pr-gate #697 | 40004709868 | success | 127.0 s |
| `b97ffdafd` | census-runtime #661 | 40004709781 | success | 1048.0 s |
| `b97ffdafd` | candidate-protection #182 | 40004709743 | success | 16.0 s |
| `3e94abddb` | pr-gate #699 | 40005915888 | failure | 122.0 s |
| `3e94abddb` | census-runtime #663 | 40005915727 | failure | 934.0 s |
| `3e94abddb` | candidate-protection #184 | 40005915398 | success | 15.0 s |
| `5b2d67e4d` | pr-gate #700 | 40010515027 | failure | 124.0 s |
| `5b2d67e4d` | census-runtime #664 | 40010515149 | in progress | — |
| `5b2d67e4d` | candidate-protection #185 | 40010515009 | success | 23.0 s |

What this supports: a docs-only head (`b97ffdafd`) passes all three hosted legs, and the
census leg costs ~17 min hosted — an order of magnitude above the local 8-leg harness
(46.9 s PASS / 28.7 s FAIL, `@929`, self-timed). A docs-consistency leg therefore has room
to be added cheaply; it must not be placed inside the census leg.

What this does **not** support: the nine local samples recorded earlier have no per-run
SHA, so they are historical reference only. No p95 exists for anything (`NOT_MEASURED`);
the only n≥5 cohorts are the 4-file runtime selector (p50 2.12 s / p95 2.29 s, tree-drift
caveat) and the 120 s host-guard cohort. "C1→C2 wait" has no recorded definition. Per the
standing instruction, no Host run was started to fill these tables.

## What E0 does not prove

E0 is a census of records. It proves no behaviour: no C1/C2/C3, no security negative, no
release readiness. Every `executionEvidence=NOT_RUN` above stays `NOT_RUN`, and the
`verified_*` axes in `dev/engineering/registry.yaml` are only set where an artifact in this
branch actually exists.
