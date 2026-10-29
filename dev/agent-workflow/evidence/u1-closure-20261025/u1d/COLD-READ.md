# COLD-READ (U1-D) — entry-points audit of origin/master @ `4aaaa7b2af87f80a0fae62d9c8d9cf03d5a6fd84`

Scope: read-only cold read of README.md, AGENTS.md, docs/ROUTER_RULES.md, docs/TEST_METHODS.md,
docs/glossary.md, docs/contracts/**, dev/engineering/**, .agents/notes/**, nine package READMEs,
and `--help` of scripts/docs-probe.mjs / docs-sync.mjs. Per work-package rules I did **not** open
dev/agent-workflow/** contents (graph.yaml, logs, evidence bodies — existence checked by `ls` only)
nor docs/plans/{paused,finished} beyond file names. Citations are file:line in the worktree.

## Q1 — Current phase and single execution authority

- Phase = `alpha5-tool-io-governance`; baseline `9b2ee57b…`. Sole authority =
  `dev/agent-workflow/graph.yaml#current_contract` (README.md:193-198; AGENTS.md:2,22;
  registry.yaml:8; .agents/notes/README.md:8-10; dev/engineering/README.md:32-33;
  current-state.json:366-369 `legacy_execution_authority`). Values were taken from the read-only
  mirror current-state.json:34-46 and README.md:197; I could not open graph.yaml (scope ban), so
  mirror-vs-source equality = UNKNOWN.
- **Second places claiming "current":**
  1. README.md:74-75 "Current RC baseline / Current master (alpha) … master @ `2b86ee42`
     (2026-10-07 verified = origin/master)" — stale copy; origin/master = `4aaaa7b2` (git rev-parse).
  2. README.md:228 bold "**origin/master = `427219e4…`**" — stale current-style pointer
     (PR #51, 2026-10-01) surviving inside a history bullet.
  3. current-state.json `legacy_authority` — a second carrier of "current" values, but declared
     read-only mirror, never an authority (current-state.json:45; REQ-EB-0003, ids.yaml:105-110);
     glossary C-EB-0012 (glossary.md:22) explicitly rules that only `current_contract` commands.
  4. docs/STATUS.md — declared "living snapshot, non-authoritative" (AGENTS.md:37); not read (not
     in entry set).
- Conflicts: (1)+(2) contradict the declared authority's baseline; README.md:213-221 vs
  README.md:216-218 vs AGENTS.md:35 contradict each other about `docs/plans/paused/` (see Q7);
  registry.yaml:4 "nothing in this set is merged to master" is read *from* master, where the
  EB-line content arrived via PR #362 at `4aaaa7b2` (git log) — the axis never updated.

## Q2 — Baseline SHA and Host pin

- Execution baseline `9b2ee57bc5afd30e89855e09d1769d2e5ec83912` (`baseline_collected
  2026-10-22T07:20:56Z`): defined in `graph.yaml#current_contract.baseline` (declared sole source,
  AGENTS.md:2); mirrored current-state.json:41-42; cited README.md:197-200. Verified by me:
  ancestor of HEAD (`git merge-base --is-ancestor` → true). README.md:199-200 and README.md:84-88
  state per-round pointers are maintained only in graph.yaml + SESSION_ROUTER_LOG.md.
- Host pin `@deepseek-ai/dsh@0.2.0-rc.2`: declared in root package.json peerDependencies
  (package.json:51-55); README.md:81-82. Test-runtime baseline pin (same generation):
  `tests/paths.mjs:68-70` (`DSH_BASELINE_VERSION='0.2.0-rc.2'`, `TEST_USE_BASELINE_SHA=
  639ed015397290b3745d163aafe02ffee4aa3f84`, `CLIENT_COMMIT_HASH='639ed01539'`), named canonical by
  TEST_METHODS.md:12, AGENTS.md:14, README.md:182-187. All four agree — no stale test-pin copy in
  the entry docs.
- Stale copies found: README.md:75 ("master @ `2b86ee42`", 2026-10-07) and README.md:228
  ("origin/master = `427219e4…`"). Correctly current: README.md:74 origin/stable `b0e5aeb4`
  (matches `git rev-parse origin/stable`); the intentionally deferred characterization pin
  0.1.5-rc.2 @ `fb2c4b9e` (README.md:188-189) matches tests/characterization/fixtures/
  host-version.json:3. AGENTS.md:2 deliberately keeps no SHA copy.

## Q3 — Change boundary (what may change now / what needs approval)

Without separate approval — inside the current plan's assignment (ROUTER_RULES.md:29 makes the
phase plan the top execution protocol; it defines lanes and file ownership): files of one's own
lane on `task/*` in a dedicated worktree (ROUTER_RULES.md:179 one task=one branch=one worktree=one
writer); append-only evidence under dev/agent-workflow/evidence/<task>/ (TEST_METHODS.md:57,65);
new `.agents/notes/` decision notes (.agents/notes/README.md:12-26); for the EB line, exactly the
narrow grants in dev/engineering/work-package-authorization.md:31-39 (two generated files via
generated-write, README prose of its own tooling — doc-ownership.yaml:41-73 `enforce: true`).
Requires approval / higher authority:
- Push at all, and master/stable pushes: one-shot user authorization per round (AGENTS.md:51;
  ROUTER_RULES.md:36); merge = Gate-pass + per-HEAD user instruction (README.md:106-110 pattern).
- contracts semantics: frozen v1; change = new version + explicit authority + main-agent approval
  (CHANGELOG freeze rule quoted at freeze-confirmation.md:12-19).
- LOCKED_SURFACE: owner task only; others file `CONTRACT_CHANGE_REQUEST` (ROUTER_RULES.md:179).
- docs/plans/active/**: worker edit forbidden (AGENTS.md:30); graph.yaml, AGENTS.md, STATUS.md,
  Alpha.5 entries are outside the EB line (work-package-authorization.md:23-27); ids.yaml
  ratification only via registry decision + Contract Owner review (ids.yaml:12-14,
  promotion-rules.md:20-34).
- Never allowed: upstream patches (CORE PATCH BUDGET=0, README.md:5-9, AGENTS.md:6,48), moving the
  frozen branch/tag (AGENTS.md:50), legacy `packages/team` copies (AGENTS.md:44), touching :3080
  or using the frozen fork as test runtime (TEST_METHODS.md:51-55).
- **Gap:** every package README says "No owner is recorded" (e.g. contracts:80-87, domain:102-109)
  and dev/engineering/README.md:198-203 admits no roster exists — "ask the owner" has no target.

## Q4 — Test tiers and the C1≠C2 statement

- **C1/C2/C3** (acceptance levels) are defined in glossary.md:19 (C-EB-0009) and
  dev/engineering/README.md:140-162 (C1 = Adapter-local; C2 = real-Host integration at a fixed
  SHA; C3 = fixed-candidate full verification). The canonical source is PLAN-B-20261022.md:157-159
  in **open, unmerged PR #355** — "not in this tree", fetch instructions given
  (dev/engineering/README.md:144-151); glossary instead names the matrix (TOOL-CAPABILITY-MATRIX-
  9b2.md) as anchor, but the matrix *uses* C2/C3 without defining them.
- **T0–T4:** NOT defined anywhere in the entry docs. T0 appears once as a label for the
  document-check scope ("existence and static facts (T0)", dev/engineering/README.md:8;
  EB-ADR-0001 rule 4: "A T0 document probe never substitutes for C1/C2/C3"). T1–T4 = UNKNOWN
  (plausibly in PLAN-B, which is unfetchable locally). The matrix has its own ⑧ closed verdict
  enum (DONE/LIVE-CONFIRMED/ENFORCE-PARTIAL/NOT_VERIFIED/…, matrix:14) and ci-pr-gate has
  NOT_VERIFIED/REFUSED/ENV_BLOCK/SKIP (glossary.md:23) — neither is "T0–T4".
- Is C1-local-green ≠ real-host-C2 stated? **Yes, repeatedly:** glossary.md:19 "C1 never implies
  C2, and branch-local C2 never implies merged-head C2"; dev/engineering/README.md:156 ("a
  branch-local real-Host run is C2, not C3"), :160-168 ("The levels are not machines… CI can sit
  at C1"; a `verified_ci`+C1 record is only as good as a real CI run), and machine refusals
  `CLAIM_TIER_MISMATCH`/`CLAIM_TIER_MISSING` (:76-82, registry.yaml:98,135,152).
- Statements that conflate / invite conflation: (a) ROUTER_RULES.md:179 "Release Compliance Gates
  **C1–C7** (Development Plan §33)" — a second, unrelated C-numbered namespace with no reconciliation
  note against C1/C2/C3; (b) g3-report.md:8-11 "Verdict: **G3 PASS**" resting solely on the local
  `run-tests.mjs` + `tsc` table (:13-24) with no tier label — legal history, but a gate PASS whose
  evidence is all C1-class, written under no tier vocabulary; (c) .agents/notes/README.md:55-58
  admits the checker cannot catch a "C2 from C1 evidence" claim at all (semantic judgement).

## Q5 — The nine packages

All nine have README.md. "Owner" column: every README except legacy's states **"No owner is
recorded"**; legacy's README has no Owner section at all.

| pkg | purpose (own words) | README | README fails to explain |
|---|---|---|---|
| contracts | frozen serializable contract vocabulary, closed error/DTO vocabularies (:11-33) | yes | who the "Contract Owner" is that must approve a change (:85-87 admits unknown); pairing count math (21 pairings vs "20 equality + 2 subset" vs "20 of 34", :68-71 vs registry.yaml:146) |
| domain | closed deterministic rules, 8 lanes, blueprint/policy/lifecycle (:10-31) | yes | how the three competing consumer counts (:37-41) are kept in sync day-to-day; no change-approval path for a lane |
| storage | TeamDomain durable sidecar, "sole persistent control-plane authority" (:12-15) | yes | how version-policy levels L1–L3 differ (:18-19 names only); journal recovery "read, not exercised" (:53-54) |
| runtime | host-half plugin + 34 lanes, dist committed (:13-67) | yes | which lanes are live vs dormant ("not established", :49-52); table still says "30 lanes" (:76) after its own 34-correction (:22,26) |
| tools | the closed thirteen `team_*` tools, delegation-only (:10-28) | yes | where/how the 13 tools are registered into a running host beyond naming "the P2-T4 seam"; relation to matrix UNKNOWN status |
| remote | closed remote method catalog + handlers, never writes state (:10-30) | yes | which of the v1…v9 rungs are live vs historical (:18-20); "promise never rejects" read-not-run (:52-53) |
| client | browser half, 12 panels, composition-shim committed (:12-62) | yes | the workflow that refreshes the committed `composition-shim` before merge (build:composition has no CI wiring) |
| legacy | frozen read-only session-reader, sole legacy code (:1-24) | yes (28 lines, no Owner section) | what tests exist for the reader; what "D-level stays in Git history" binds anyone to do |
| testkit | shared test fixtures/scanners; tests-only (:7-29) | yes | network-freeness left explicitly unresolved (:56-58); rulings "R22/R24" (:15,16) are cited without any pointer to their source |

## Q6 — docs:probe / docs:sync

- `pnpm docs:probe` (package.json:47) = change-scoped document probe (REQ-EB-0001, ids.yaml:91-96):
  resolves committed+staged+unstaged changes against a verified base, maps paths to owner docs
  (doc-ownership.yaml:9-34), refuses `verified_*` without existing artifacts, checks enforce-rule
  owner coverage, contracts shape, plan `eb-plan` blocks. **Modes:** `--base <verified-ref>` or
  `--worktree-only`; anything else refuses — `--help` itself yields `REFUSED BASE_REQUIRED …`
  exit 2 (recorded; there is no probe help text).
- `pnpm docs:sync` (package.json:48) = `--check` (read-only full-tree verification, the review gate;
  dev/engineering/README.md:69-72) or `--write [--root <dir>]` (usage string from its own `--help`,
  exit 2) which regenerates only the two generated files via generated-write.mjs
  (dev/engineering/README.md:84-96).
- **They do NOT check:** runtime behaviour (T0 existence/static only, dev/engineering/README.md:8);
  prose citations — only declared `eb-plan` blocks are machine-checked, which is why the four dead
  ROUTER_RULES.md:11-14 links survive (plan-citation-interface.md:14-15 admits "no machine ever
  checked them"); whether a real CI run produced bound evidence (:164-168); contract types/minItems/
  lengths/uniqueness/cross-field rules (names only, :100-110; 20 equality + 2 subset pairs);
  semantic equivalence of "touched" owner docs (:98, doc-ownership.yaml:21-27); `--write` does not
  run the contracts comparison and cannot repair its findings (:109-110; work-package-
  authorization.md:38); baseline mirrors are copied, not resolved (:36-39); **nothing is wired in
  CI** (verified: no docs job in .github/workflows/; dev/engineering/README.md:70-72,
  doc-ownership.yaml:28-30 — EB3-B open); ratification/approval status is never advanced.

## Q7 — Errors found (full list in defects.json, 25 items)

Broken links / non-existent paths: ROUTER_RULES.md:11-14 cite the four frozen 20260829 docs under
`docs/plans/paused/` — none exists there (ls: paused/ holds 4 alpha.1-era files); the four are in
`docs/plans/finished/` (git ls-files). AGENTS.md:20,35 repeats the wrong directory.
`docs/plans/memo/engineering-baseline/{architecture,execution-plan}.md` (cited by
.agents/notes/README.md:6-7 and work-package-authorization.md:18-20) do not exist (PR #361
unmerged). `docs/plans/active/alpha5-convergence/PLAN-B-20261022.md` (dev/engineering/README.md:144)
does not exist (PR #355 open; disclosed). Evidence paths cited by the registry/notes all exist
(`ls`-verified).
Stale / self-contradicting: README.md:213-221 and dev/engineering/README.md:49-66 claim the frozen
four "were not found in the commit history visible from this checkout / git log … lists only
alpha.1-era files" — false: all four are tracked in `docs/plans/finished/` since `b5c8d1dab`
(2026-10-07). README.md:34,294 call `docs/plans/paused/` "local, gitignored" while README.md:216
says it is tracked — and it is. README.md:75,228 carry stale "current master/origin/master" SHAs.
work-package-authorization.md:44-50 counts "18 + 1 idea = 19" and quotes an ids.yaml header wording
that ids.yaml:5-8 has since corrected — the catalog now holds 20 ids / 2 ideas (INDEX.md:5,43).
dev/engineering/README.md:261 says "the single idea-no-execution-authority entry" — there are two.
runtime README:76 "30 lanes" vs :22 "34". TEST_METHODS.md:72 pins the workspace to
`/home/user/dsh-plugins/dsh-agent-team` (stale environment). freeze-confirmation.md:12 cites
CHANGELOG "lines 94–106" for the Freeze rule — it now sits at line 151.
Verified/merged/released conflation: registry.yaml:4 + entries `implemented_in_branch` claim
"nothing in this set is merged to master" while being read from master after the PR #362 merge
(`4aaaa7b2`); EB-ADR-0003:29 likewise says "not merged"; README.md:209-210 keeps "PR #361 open and
delivered unmerged until E1 completes" while E1 itself is declared not exited
(dev/engineering/README.md:236-262) and its content landed via #362 — the #361/#362 relation is
explained nowhere in the entry docs. Naming conflation C1–C7 (gates) vs C1/C2/C3 (levels) at
ROUTER_RULES.md:179. Ids cited (REQ-EB-0001…4, INV-EB-0001…10, AC-EB-0001…4, IDEA-EB-0001/2) all
exist in ids.yaml — no invented ids found; glossary anchors C-EB-0009/C-EB-0010 point at files that
do not contain the definitions they vouch for (glossary.md:19-20).

## Verdict

A new agent can answer from the entry points **PARTIAL**:
- Phase: YES (AGENTS.md:22 + README.md:193-198 + current-state.json:37, with SHA verifiable only
  against the out-of-scope graph.yaml or its mirror).
- Test tiers: PARTIAL — C1/C2/C3 defined twice in-tree and consistently; the cited canonical
  definition file is not in the tree; T0–T4 undefined anywhere.
- Boundary: PARTIAL — red lines, push/merge and plan-ownership rules are clear, but the concrete
  "what is mine to touch right now" answer lives in docs/plans/active/ lane ownership (outside the
  entry set), and no owner/approver roster exists for any package.
- Approval: PARTIAL — push/merge/contracts/LOCKED_SURFACE paths are named, but "Contract Owner"
  and friends are roles with no rostered holder and E1's merge status is self-contradicting.
