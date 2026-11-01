# D — CI gates & real-Host resource isolation (READ-ONLY audit)

- Clone: `/home/armourpiercer/projects/dsh-agent-team-lane-2` @ `12cc9843e840849e7f831d513fdcd83b0813a921` (branch `master`, remote `https://github.com/armourpiercer1/dsh-agent-team.git`)
- Audit date executed against HEAD 12cc9843e; all `gh api` calls were read-only GETs. No writes outside `.artifacts/` (gitignored).
- Sibling clone Lane 1 (`/home/armourpiercer/projects/dsh-agent-team`) was touched **read-only** exactly once: an existence `ls -d` of its `tests/deepseek-harness-test-use` (it exists there).

---

## D1. Workflows inventory (.github/workflows/)

9 files. `pull_request` triggers are evaluated by GitHub **against the PR's base branch** (documented Actions semantics), so `branches: [master]` below means *only PRs whose base is master*.

| File | workflow name | triggers | PR with non-master base? | jobs (check names reported) |
| --- | --- | --- |--- | --- |
| `pr-gate.yml` | `pr-gate` | `pull_request: branches:[master]`, `push: branches:[master]`, `workflow_dispatch` (pr-gate.yml:46-51) | **does NOT run** | `gate` → context **`pr-gate`**; `settlement` → context **`pr-settlement-gate`** (`if: pull_request` only) |
| `ci-required.yml` | `ci-required` | `pull_request: branches:[master]`, types `[opened, synchronize, reopened, labeled, unlabeled]` — **no push trigger** | **does NOT run** | `synthesize-merge-tree`, called layers `ci-fast`/`ci-integration`/`ci-security`/`ci-full`, grader → context **`ci-required`**; plus `ci-required-deferred` (only with label `ci-defer-full`, explicitly NOT required) |
| `ci-fast.yml` | `ci-fast` | **`workflow_call` ONLY** ("CALLED ONLY by ci-required") | does not run standalone | `ci-fast` |
| `ci-integration.yml` | `ci-integration` | **`workflow_call` ONLY** | does not run standalone | `ci-integration` — includes the **evidence-guard leg** `node scripts/eb3-evidence-guard.mjs --new-since "$CI_BASE"` (:150) |
| `ci-security.yml` | `ci-security` | **`workflow_call` ONLY** | does not run standalone | `ci-security` (`scripts/eb3-security-run.mjs --timeout 20000`, host-free) |
| `ci-full.yml` | `ci-full` | **`workflow_call` ONLY** | does not run standalone | `ci-full` — provisions the pinned pristine host from public `ArmourPiercer1/deepseek-harness` `stable-3-0.2.0-rc.2`, runs `eb3-security-run.mjs --layer ci-full --list-file tests/checks/eb3-host-security-suites.txt`, then `ci-pr-gate.mjs --full --census-captures 2 --census-test-timeout 90000` with **no `--allow-refused`** (refusal = red) (ci-full.yml:178-188) |
| `census-runtime.yml` | `census-runtime` | `pull_request: branches:[master]`, `push: branches:[master]`, `workflow_dispatch` | **does NOT run** | `census-runtime` (census with provisioned host, refusal not permitted) |
| `candidate-protection.yml` | `candidate-protection` | `pull_request: branches:[master]`, `push: branches:[master]`, `workflow_dispatch` | **does NOT run** | `candidate-protection` (grades pinned evidence head; header says "no branch protection implication") |
| `characterization.yml` | `characterization` | **`workflow_dispatch` only** (demoted 2026-09-17, archival/manual, "NOT a merge gate") | never | `P2-T1 characterization on pristine upstream` |

**Expected "required checks" (per ci-required.yml header + server truth D2):** `ci-required` is designed to be "the ONE Required context"; `pr-gate` and `pr-settlement-gate` were kept side-by-side (plan E3 exit). Server-side all three are required (D2).

**Bottom line for Alpha.6:** a PR whose base is an Alpha.6 integration branch triggers **zero** workflows — not `pr-gate`, not `ci-required`, not the four EB3 layers (workflow_call-only), not `census-runtime`, not `candidate-protection`. `workflow_dispatch` exists for `pr-gate`, `census-runtime`, `candidate-protection`, `characterization`, but a dispatched run grades the pushed/default context, not the PR. Live confirmation (listing runs for a past non-master PR) was not performed → runtime behavior marked UNVERIFIED, but the YAML + documented base-branch semantics are unambiguous.

---

## D2. GitHub server-side truth (gh api, 2 reads per endpoint, all 200 unless noted)

- **`master` protection EXISTS** (`repos/ArmourPiercer1/dsh-agent-team/branches/master/protection`, HTTP 200):
  - required_status_checks: `strict: true`, contexts = **`pr-gate`, `ci-required`, `pr-settlement-gate`** (all GitHub Actions, app_id 15368)
  - `enforce_admins.enabled: true`
  - required reviews: `required_approving_review_count: 0`, no CODEOWNERS, no last-push approval
  - required_signatures: disabled; linear history: not required; **force-push: blocked; deletion: blocked**; required_conversation_resolution: true
  - Default branch = `master`.
- **`stable`**: branch exists (`b0e5aeb482`) but `branches/stable/protection` → **404 "Branch not protected"** → **no server-side protection on stable**.
- The "list all protected branches" endpoint (`branches/protection`) is unusable on this API surface (404 "Branch not found" — route collides with a branch named `protection`); master+stable were probed individually instead. No other protected branch was enumerated → other-branch protection: **UNVERIFIED**.
- **Rulesets**: exactly one ruleset `default` (id 22936015, `target: branch`, include `~ALL`) with **`enforcement: "disabled"`** (rules `deletion` + `non_fast_forward` configured but not enforced). So rulesets add nothing on top of the classic protection. (SESSION_ROUTER_LOG confirms a ruleset POST that GitHub silently emptied; the classic branch-protection path is what is live.)

**Consequence:** required-check enforcement applies **only to PRs targeting master**. An Alpha.6 integration branch has no protection unless someone creates it → a non-master PR today has neither CI (D1) nor required checks (D2). Gates for Alpha.6 lanes are convention + local runs, machine-enforced only at the master leg.

---

## D3. Mechanical PR law (scripts/pr-settlement-gate.mjs, scripts/ci-pr-gate.mjs)

### pr-settlement-gate.mjs (369 lines; ROUTER_RULES §8.5 machine law, audit P1-1)
- **DO-NOT-MERGE marker law (§8.5.1)**: raw ASCII `DO-NOT-MERGE` (case-sensitive, U+002D, `MARKER_RE=/^DO-NOT-MERGE(?![0-9A-Za-z])/`) matched **only** as title prefix or first body line ⇒ verdict `BLOCKED-BY-MARKER`, exit 1. Mentions elsewhere, corner-bracketed, fullwidth, or lowercase are prose (the three #455 lessons; self-test fixtures lines 218-241).
- **Settlement law (§8.5.2)**: marker absent ⇒ need ≥1 *issue comment* whose **first line** matches `/^\s*\*{0,2}\[\s*dated(?:\s+label)?\s+settlement,\s*\d{4}-\d{2}-\d{2}[^\]]*\]\*{0,2}/i` **and** whose body contains a 40-hex sha (`/\b[0-9a-f]{40}\b/`) EQUAL to the head sha at check time. No such comment ⇒ `FAIL` exit 1. Any push retires older settlements (covered-sha equality). `--expected-head` mismatch ⇒ `HEAD_DRIFT` exit 2. Final line always `DSH-SETTLEMENT-VERDICT <verdict> marker=… matches=… candidates=…`.
- Exit codes: 0 PASS · 1 FAIL/BLOCKED-BY-MARKER · 2 ERROR(refusal, never a silent pass). CI runs `--self-test`, `node --test scripts/pr-settlement-gate.test.mjs`, then live `--pr "$PR_NUMBER" --repo "$GITHUB_REPOSITORY" --expected-head "$PR_HEAD_SHA"` (pr-gate.yml:318-333).
- NOT gated here: unresolved review threads (merge-agent's own gate, §8.5.3/§8.5.6).

### ci-pr-gate.mjs (2639 lines; the merge gate legs)
- `LEG_ORDER` (:116-126): `graph-parse`, `kit-home-guard`, `state-freshness`, `install`, `blueprint-fence`, `typecheck`, `lint-identities`, `artifacts-at-head`, `census` (census `OPTIONAL_BY_DEFAULT` — skipped unless `--full`/`--only`).
- Verdict channel: one `DSH-CI-LEG leg=… verdict=pass|fail|skip|refused …` line per leg + final `DSH-CI-VERDICT pass=… fail=… skip=… skipped=… legs=… refused=… refusedlegs=…`; `--check-transcript` re-grades a transcript (missing/duplicate token or lost leg line = fail). Under `--full`, **any skipped leg is a failure**; a `refused` leg is legal only if declared via `--allow-refused <leg>`.
- **Census** (:1608-1668): refuses before spawning vitest if `tests/deepseek-harness-test-use` is absent (`refuseReason=missing-test-use-checkout`). Otherwise runs `pnpm exec vitest run --reporter=default --reporter=json --outputFile.json=… [--testTimeout=…]` twice (`--census-captures 2`) and grades the **identity SET** of reds against `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md` (new red = fail; vanished red = escalation = fail).

### C1 / C2 / C3 in this repo = **evidence tiers** (not CI job names)
- **C1** = static/local/offline evidence — vitest suites, `node --test` unit tests, lint/drift checks; **the only tier CI runs** (`tests/world-factory/README.md`: "C1 is the ONLY tier CI runs"). `tests/world-factory/README.md` names the C1 adapter-local command: `node --test tests/world-factory/world-factory.test.mjs`. Claim-tier law (`scripts/gen-current-state.mjs:236-262`): a `verified_host` claim requires `verified_tier C2|C3` — "C1 static/local evidence cannot stand in for it"; released status needs C3.
- **C2** = real-Host runs against the pinned pristine host, **budget-leased, opt-in, human/agent-invoked — never run by CI**. The C2 runner is the **U5 canary runner**:
  - `node tests/world-factory/u5-canary-runner.mjs --suite <core|core-restart|negatives|u6-shadow|crash-victim|any suites/*.mjs name> --line <line> --evidence <dir> [--run-record <json>] [--budget-ledger <jsonl>] [--max-host-starts 15] [--keep-home]` (README + runner :26-31, :992 — refuses ALL cases if the ledger already holds ≥ `--max-host-starts` entries; every `startHost` is appended to the ledger BEFORE the spawn).
  - C3 (world-factory README sense) = parallel/crash orchestration: `node tests/world-factory/u5-parallel-supervisor.mjs --evidence <dir> [--mode parallel|crash-reclaim] …` (2–3 starts).
- **Exact C2-ish command lines CI actually uses** (none of these boots the WorldFactory canary):
  - pr-gate hosted: `node scripts/ci-pr-gate.mjs --full --census-captures 2 --allow-refused census --census-test-timeout 20000 --store-dir "$DSH_CI_STORE_DIR" --transcript-dir "$RUNNER_TEMP/gate-transcripts"` + `--check-transcript` (pr-gate.yml:232-252)
  - ci-full (host provisioned, refusal not permitted): same minus `--allow-refused`, `--census-test-timeout 90000` (ci-full.yml:183-188) + `node scripts/eb3-security-run.mjs --layer ci-full --list-file tests/checks/eb3-host-security-suites.txt --timeout 20000`
  - On a hosted runner the census legs that resolve the pristine host are exactly why pr-gate declares `--allow-refused census`; the census legs themselves are vitest tests, some of which *boot* hosts from the test-use tree on the sanctioned port bands when the tree is present.

---

## D4. Local gate reproduction

Environment measured: `node v24.21.0` ✓, `pnpm 11.7.0` ✓ (= packageManager), **`node_modules/` does NOT exist in this clone**, pnpm store = default `/home/armourpiercer/.local/share/pnpm/store/v11` **exists and is SHARED across both clones** (content-addressed; the shared store is what makes cross-clone installs cheap — `.npmrc` only sets `auto-install-peers=false`; `pnpm-workspace.yaml` comments describe the shared store as the offline resolution basis).

| what | command | notes |
| --- | --- | --- |
| install | `pnpm install --frozen-lockfile` | required first; heavy (9 packages); store is warm from Lane 1 |
| (a) typecheck | `pnpm typecheck` (= `pnpm -r run typecheck`) | ci-integration runs the same |
| build (needed by census/security legs) | `pnpm run build && pnpm build:composition` | pr-gate CI builds before grading; fresh checkout without build ⇒ census answers `refused` |
| (b) unit tests / C1 equivalent | `pnpm test` (= `vitest run`; vitest.config.ts includes `packages/*/test/**`, `packages/runtime/controlled-fs/test/**`, `packages/tools/a5p5-tools/test/**`) | plus `node --test tests/world-factory/world-factory.test.mjs` (C1 adapter-local), `node scripts/eb3-security-run.mjs --timeout 20000` (ci-security equivalent), `node --test scripts/pr-settlement-gate.test.mjs` |
| full local gate (static+build+census) | `node scripts/ci-pr-gate.mjs --full --census-captures 2 --census-test-timeout 20000` | **census REFUSES here** (`missing-test-use-checkout`) and under `--full` an undeclared refusal is red; either provision the host tree or declare `--allow-refused census` |
| settlement self-check | `node scripts/pr-settlement-gate.mjs --self-test`; live dry-run `--input <file.json>`; live `--pr N --repo ArmourPiercer1/dsh-agent-team` | no build needed |
| (c) C2 real-Host suite | `node tests/world-factory/u5-canary-runner.mjs --suite core --line <line> --evidence dev/agent-workflow/evidence/<task>/ --budget-ledger …/host-start-budget.jsonl [--max-host-starts N]` | requires provisioned `tests/deepseek-harness-test-use` (absent, D5) + BOOT-BUDGET pre-registration law |

Heavy commands were NOT run. `tests/deepseek-harness-test-use` absent ⇒ (b) census-bearing and (c) everything are non-runnable in this clone as-is.

---

## D5. Real-Host resource isolation (the collision analysis)

### Ports (tests/paths.mjs)
- `TEST_PORT_RANGES` (:107-111) = 3180-3199 / 3491-3500 / 13000-13099 (2026-10-26 user ruling).
- `HOST_PORT_BANDS` (:113-116) = 3181-3199 → 13000-13049 (3180 deliberately never leased to Worlds; it's the §2 hand-run default); `MOCK_PORT_BANDS` (:118-121) = 3491-3500 → 13050-13099. Band total is finite on purpose (fail-closed exhaustion).
- `STABLE_INSTANCE_PORT = 3080` (:123); `isSanctionedTestPort` (:143-146) rejects 3080 and anything outside the bands (lease throws `PORT_REFUSED`).
- Kernel ephemeral range 32768-60999 ⇒ no band collides with outgoing source ports (paths.mjs:90-91).

### The port LEASE lives INSIDE each clone — clones cannot exclude each other (verified)
- Lease state = on-disk slots `<leaseRoot>/<port>.lease/` (claim files + `seq` append log) — `tests/world-factory/lib/port-lease.mjs:6-13,130-131,620+`. Not /tmp, not OS-only.
- Default lease root — `tests/world-factory/lib/world-factory.mjs:237-239,289-293`:
  ```js
  // Default lease root: the MAIN checkout's .artifacts/tmp so Worlds
  // created from sibling worktrees contend on the SAME lease files.
  this.leaseRoot = resolve(leaseRoot ?? this.#defaultLeaseRoot())
  ...
  #defaultLeaseRoot() {
    const parent = dirname(this.repoRoot)
    const main = parent.endsWith('.worktrees') ? dirname(parent) : this.repoRoot
    return join(main, '.artifacts', 'tmp', 'port-leases')
  }
  ```
  This is **clone-local by construction**: sharing only happens for linked *worktrees under the same main checkout's* `.worktrees/`. Lane 1 (`/home/armourpiercer/projects/dsh-agent-team`) and Lane 2 (`…-lane-2`) are sibling clones; each resolves its own `<clone>/.artifacts/tmp/port-leases`. **Explicit verdict: the lease CANNOT exclude the other clone.** (`.artifacts/tmp/port-leases/` exists in neither clone's tree right now — created on first run.)
- Mitigating second guard (`port-lease.mjs:726-734`): after winning its own lease, `acquirePortLease` TCP-probes the port and throws `EXTERNAL_BIND` if a foreign listener answers ("no live lease holder, but the TCP port answers — a foreign listener, e.g. the concurrent G1-F lane"). This detects a lane that is *already bound*, but is TOCTOU: both clones can probe 3181 free, both "win" their private lease, and the later bind dies with EADDRINUSE. Both lanes start allocating at the band head (3181), so simultaneous first-World choice collides by design, not by bad luck.
- `lease-race.mjs` is only the cross-process reclaim-race harness for one leaseRoot (mkdtemp root, opt-in); it never spans clones.

### DSH_HOME worlds & locks — per-clone
- `TEST_HOME_ROOT_REL = 'tests/homes'` (paths.mjs:41); homes must stay inside the workspace (workspace-write sandbox, TEST_METHODS §5); `<home>.lock` files live **beside the home**, i.e. `tests/homes/<name>.lock` (paths.mjs:27; world-factory.mjs:361-362 refuses a world whose lock exists). All per-clone; `tests/homes/` is gitignored. `tests/homes/` does not exist in this clone yet.

### Host boot budget ledger — a git ledger, not a runtime lock
- Current authority: `dev/agent-workflow/gates/BOOT-BUDGET-20261031C.md` (B ledger `BOOT-BUDGET-20261029B.md` sealed at 12/24). C ledger: **36 starts total, 24 newly usable, pools C1=8 (Agent Control re-verification), C2=8 (family L3/L4 incl. State Home), C3=4 (candidate integration), C4=4 (机动)**. Controls: ① **pre-registration law** (exact source SHA + host bindings pushed as a PRE-REGISTRATION commit before any spawn; post-registration = violation), ② same-class-failure stop-line (RCA before retry), ③ no exploratory boots, ④ efficiency gate, ⑤ ENV_BLOCK/NOT_REACHED may never be laundered to PASS, ⑥ `:3080` and `~/.dsh` read-only invariant; worlds workspace-internal, 3180-family, torn down after.
- Enforcement is (a) the append-only markdown ledger + per-lane `host-start-budget.jsonl` receipts under `dev/agent-workflow/evidence/<task>/`, and (b) the runner's `--budget-ledger <jsonl> --max-host-starts <n>` (default 15) which refuses cases when that jsonl already holds n rows. All of these read **files in the invoking clone's own tree** — Lane 1's runtime never consults Lane 2's ledger or vice versa. Cross-lane accounting only happens later, when merges collide (see keep-BOTH).

### Listening ports right now (`ss -ltn`)
`127.0.0.1:3080` (stable dev instance — never touch), DNS on :53. **Every sanctioned test band (3181-3199, 3491-3500, 13000-13099) is currently FREE** — i.e. Lane 1 has no real-Host run holding ports at audit time.

### tests/deepseek-harness-test-use — absent here; provisioning is blocked on this machine
- Confirmed **does not exist** in this clone (as suspected). It DOES exist in Lane 1's clone (read-only existence check).
- TEST_METHODS §1 flow for a fresh tree: `git clone --local --no-hardlinks <只读 baseline 树> tests/deepseek-harness-test-use` + `git checkout --detach 639ed01539…` + porcelain-empty check, then §2 `pnpm install --ignore-scripts --frozen-lockfile` + `DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build`, then §9 `provision-host-sandbox.mjs` for the gitignored native sandbox assets.
- **`/srv/workspace` does not exist on this machine** (both `/srv/workspace` and `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` are missing). Alternatives: (i) clone from the public fork `https://github.com/ArmourPiercer1/deepseek-harness` branch `stable-3-0.2.0-rc.2` — the exact chain census-runtime.yml uses and calls provisionable; (ii) `git clone --local` from Lane 1's existing test-use tree (read-only source use; that would not modify Lane 1's files).
- Native-asset provisioning has a hard containment rule (TEST_METHODS §9): the asset source tree must resolve (realpath) inside allowed roots = the caller's Team repo root(s) + the `/srv` baseline. The `/srv` baseline is gone and Lane 1's tree is outside Lane 2's allowed roots ⇒ `DSH_TEAM_SANDBOX_ASSET_SOURCE` pointing there should be refused `SOURCE_TREE_OUTSIDE_ALLOWED_ROOTS` (fail-closed supply chain). Without baseline re-creation or an allowed in-root copy, the sandbox backend will be `unusable` (suites record ENV_BLOCK for native-confinement legs).
- `node tests/world-factory/provision-host-sandbox.mjs --check` executed (its own doc: "report only: never copy, never write"); captured output:
  ```
  runtime tree : …/dsh-agent-team-lane-2/tests/deepseek-harness-test-use
  baseline pin : 0.2.0-rc.2@639ed015397290b3745d163aafe02ffee4aa3f84
  FAIL-CLOSED ENTRY_MODULE_MISSING — no host sandbox entry module at …/tests/deepseek-harness-test-use/native/system/packages/entry/lib/index.js (is … a runtime checkout at the pinned baseline?)
  EXIT=2
  ```
  No writes occurred.

### Is there ANY cross-lane mutual-exclusion mechanism today? — **NO**
- Port lease: per-clone files (verified above). Homes + `<home>.lock`: per-clone. BOOT-BUDGET: git-tracked prose + per-evidence jsonl, consulted only by the local runner of the same tree. GitHub: ruleset enforcement `disabled`; concurrency groups only dedupe GitHub-side runs; there is no GitHub-based lease API in use. The only real cross-lane signal is the **OS port space itself**: `portInUse` EXTERNAL_BIND (fail-closed, detects an already-bound port) and the eventual EADDRINUSE at bind time. That is collision *detection after the fact*, not reservation.

**Verdict: CONDITIONAL — Lane 2 can run real-Host tests while Lane 1 runs, with no mechanism guaranteeing it.** Conditions: coordinate out-of-band or deliberately partition bands (e.g. Lane 2 overrides `leaseRoot` to its own tree anyway — which changes nothing across clones — so the practical lever is choosing disjoint ports, e.g. Lane 1 stays ≤3189, Lane 2 uses 13000+ via `--suite` runners that accept a preferred set / editing nothing but timing); accept the TOCTOU race at band heads; treat `EXTERNAL_BIND`/EADDRINUSE as a "pick next port" event, not corruption; keep DSH_HOME under `tests/homes/` (per-clone, safe); never touch :3080 / `~/.dsh` (both lanes' law anyway); remember the BOOT-BUDGET is a **shared git ledger** — boots burned by Lane 2 still count against the same 36-start ruling once merged, and the shared-append ledgers will conflict (D6). Today's `ss -ltn` shows all bands free, so an immediate single-lane run is currently uncontested — but that is a snapshot, not a guarantee.

---

## D6. Evidence conventions & shared-append files

- **Where evidence goes**: `dev/agent-workflow/evidence/<task>/` (tracked; ~195 task dirs at HEAD). TEST_METHODS §3.5: test logs/artifacts go there; test-use tree must stay porcelain-empty at baseline SHA afterwards. Offload rules v1 (`dev/agent-workflow/gates/EVIDENCE-OFFLOAD-RULES-20261031.md`) add an external-original + index-manifest layer on top; the CI guard below stays independently in force.
- **`scripts/eb3-evidence-guard.mjs` refuses** (runs in ci-integration `--new-since <base>`, added files under `dev/agent-workflow/evidence/` only):
  - `EVIDENCE_RAW_CAPTURE` — name grammar `census-<8digits>T<6digits>Z-<pid>-<n>.json` or `resample-*.json`; **no allowlist exemption for the name** (allowlist exempts size only);
  - `EVIDENCE_OVERSIZED` — added blob > `BOUND_BYTES = 1 MiB` not listed, with a non-empty reason, in `dev/ci/evidence-large-allowlist.json`;
  - `EVIDENCE_ALLOWLIST_INVALID` — allowlist unreadable/schema-wrong/unexplained.
  Exit 0 clean · 1 findings · 2 cannot grade. Modifications/renames/outside-root files are NOT graded.
- **Shared-append files every lane appends to (cross-lane conflict magnets)**:
  - `dev/agent-workflow/SESSION_ROUTER_LOG.md` (append-only execution log)
  - `dev/agent-workflow/gates/BOOT-BUDGET-20261031C.md` (current boot-budget authority; append-only used-rows; B ledger sealed)
  - `docs/plans/memo/unified-baseline-alpha5-20261025/gates/GATE-LEDGER.md` (verdict rows; found by filename search — it lives under the PR-#364 execution-plan memo dir, not `dev/agent-workflow/`)
  - (merge messages additionally list `ALPHA5-EFFECTIVE-BACKLOG.md` sections and regenerated `u7-0 PINNED` digests as conflict sites)
- **How recent PRs resolved these conflicts** — `git log --grep keep-BOTH`:
  - `73bbdec46` (post-#492): "2 shared-append conflicts (SESSION_ROUTER_LOG EOF, BOOT-BUDGET C-册 EOF) resolved keep-BOTH verbatim **in real-UTC order with zero deletions**"
  - `f3b84601a` (post-#491): 4 shared-append conflicts keep-BOTH in real-UTC order (BOOT-BUDGET used-rows vs pool-ledger; BACKLOG sections; GATE-LEDGER rows; PINNED digest = discard-both-and-regenerate per EF-05)
  - `00b4d9075` + superseding `9e5a0a26b`: a keep-both resolution one-liner died mid-chain and committed a marker-carrying file; the fix round landed the REAL keep-both (lesson: verify the resolution actually applied).
  - **Playbook for Alpha.6 lanes**: append at EOF, never edit another lane's rows, order sections by real UTC, coordinator `fmerge` keeps BOTH sides verbatim, regenerate derived digests after merging generator inputs.

---

## Blunt answers

1. **Does CI run on a PR targeting a non-master base?** **No.** Every `pull_request` trigger is `branches: [master]` (base filter); the four EB3 layers are `workflow_call`-only and are called solely by `ci-required`, which itself is master-base-only. (Runtime spot-check on a past non-master PR not performed — UNVERIFIED empirically; YAML + documented GitHub base-filter semantics are deterministic.)
2. **Is branch protection enforced server-side, with which checks?** **Yes, on master only**: required contexts `pr-gate`, `ci-required`, `pr-settlement-gate`, strict=true, enforce_admins=true, reviews=0, conversation-resolution required. `stable` unprotected (404). Single ruleset exists but `enforcement: disabled`. Non-master integration branches: no protection found (others than master/stable UNVERIFIED).
3. **Can Lane 2 run real-Host tests safely concurrently with Lane 1?** **CONDITIONAL-NO-GUARANTEE.** No shared lease/lock exists: the WorldFactory lease root is computed clone-locally (`world-factory.mjs:289-293` → `<main checkout>/.artifacts/tmp/port-leases`, sharing only across `.worktrees/` of ONE clone), homes+locks are per-clone `tests/homes/`, BOOT-BUDGET is a git ledger consulted only by the local runner. The only cross-lane mechanism is the OS bind: `EXTERNAL_BIND` TCP probe (port-lease.mjs:726-734) + eventual EADDRINUSE — collision detection, not reservation, and both lanes allocate from the same band head (3181). Bands are fully free at audit time; concurrency is workable only by out-of-band port partitioning or accepting race-and-retry, with shared pnpm store (safe, content-addressed) and the unchanged :3080/`~/.dsh` red lines.
