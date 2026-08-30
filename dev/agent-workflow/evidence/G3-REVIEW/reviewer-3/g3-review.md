# G3 Review — Reviewer 3 of 3 (independent, blind)

## Identity

- **Role**: Gate G3 reviewer 3/3, fresh session, no inherited context. Leaf agent (no subagents spawned).
- **Worktree**: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G3R3`, detached HEAD at
  integration SHA `7839f7a3db8c610c50975f2facc220df3ce80c62` (branch `int/P3-contracts-domain`).
- **Mandatory first reads (AGENTS.md prompt-injection rule)**: completed before anything else —
  1. `.worktrees/G3R3/docs/ROUTER_RULES.md` (156 lines, read in full)
  2. `.worktrees/G3R3/docs/TEST_METHODS.md` (68 lines, read in full)
- **Blindness**: did not read `SESSION_ROUTER_LOG.md`, `graph.yaml`, or anything under
  `dev/agent-workflow/evidence/**` except `evidence/provenance/file-manifest.json` (the only
  permitted evidence file). `docs/contracts/g3-report.md` was read strictly as a CLAIM to
  compare against, never as evidence.
- **Phase scope reviewed**: `4bb1ca373b85cb228d8df139f22767f01160dc05` (Phase start on master) .. `HEAD`.

---

## Step A — must-reads + frozen-doc hash cross-check

### A.1 Worktree state

```
$ git rev-parse HEAD
7839f7a3db8c610c50975f2facc220df3ce80c62
$ git status --porcelain
(empty — clean at review start)
$ git log --oneline -3
7839f7a P3-T6: add canonical run evidence (492/492 + 4x tsc green, attempt 2/3) + attempt ledger + summary
189414f P3-T6: domain integration property suite — 79 tests encoding all 7 G3 criteria ...
a993a94 chore(workflow): R13 — P3-T6 kickoff ...
```

HEAD matches the mandated integration SHA; tree clean; detached HEAD (no branch name, as expected).

### A.2 Development Plan §16.4 (G3 gate items) — verbatim verification

Read from the main-worktree absolute path
`D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md`
(§16.4 at lines 2196–2206). The file's list:

```text
✓ domain has no live Agent dependency
✓ one template → N instances covered by property tests
✓ lifecycle transition matrix fixed
✓ policy precedence exhaustive tests
✓ complete:true compatibility fatal test
✓ Blueprint snapshot immutable tests
✓ fresh_per_delegation semantics encoded as new-instance policy
```

**Result: EXACT MATCH** with the 7 criteria embedded in the review brief (item-for-item, word-for-word).

### A.3 TaskDoc §11.4 (G3 gate execution method) — verbatim verification

Read from
`D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md`
(§11.4 at lines 1066–1186; the "### G3 Gate 执行方法" block at lines 1173–1186). The file's numbered
list (lines 1178–1184) is:

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

followed by "只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。"

**Result: EXACT MATCH** with the brief's embedded six steps (the brief's final line says "合入 master"
where the doc says "合入 `main`" — same intent, no semantic difference; all six numbered steps
verbatim). The task table and owned paths in §11.4 were also read and used for Step C
(P3-T1 `packages/contracts/**`; P3-T2 `packages/domain/blueprint/**`; P3-T3 `packages/domain/member*；lifecycle*`;
P3-T4 `packages/domain/policy/**`; P3-T5 `packages/domain/compatibility/**`; P3-T6 `packages/testkit/domain；docs/contracts`).

### A.4 Frozen-doc provenance

The four frozen 20260829 docs are **UNTRACKED** — `git ls-files 'docs/plans/active/'` returns empty
in the review worktree — and exist only in the main worktree, exactly as the brief states. All four
files are present there:

| File (main worktree `docs/plans/active/`) | Size (B) | SHA256 (computed by reviewer) |
|---|---|---|
| `DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md` | 73980 | `030DFB8EC55BAE30F35C2826C7E4E659C0E0B742D836018CE502F34017870C53` |
| `DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md` | 72945 | `A05D237F8515FD6467373632849AFE0C6A1AE63BC0EC298DE63B9D124D881D0F` |
| `DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md` | 59833 | `3EF3AB69ED2BD7879E4C15079A16C8DAE456B572690246A5C1F9CBB0C8C4981E` |
| `DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md` | 108677 | `2B457CC033CA1B72AA781E072E0EF7FE55BC05D2F7EA25CC03C827D257E888A3` |

(Filenames match exactly the four cited by `docs/ROUTER_RULES.md` lines 11–14, including the
TaskDoc name without the "Detailed_" infix, as the brief's note anticipated.)

**Manifest cross-check**: `dev/agent-workflow/evidence/provenance/file-manifest.json` (read in full,
the only permitted evidence file) has exactly two top-level keys — `baseline` and `files` (470
entries). It is the **legacy-fork diff manifest** (upstream `cd5ef814…` vs legacy `a3ab3199…`,
470 classified files). **It contains no hash section for the four frozen plan docs**, so the
brief's literal "hash cross-check of the four frozen docs against the manifest" cannot be
executed as worded. What the manifest DOES support was checked and passes:

- `baseline.upstream_sha = cd5ef8148158c3a752a658978873241fdf8e2bbc` — matches TEST_METHODS.md §1 baseline exactly.
- `baseline.legacy_sha = a3ab31992762c5d6560797eabc7e0885a9320ade` — matches AGENTS.md frozen-legacy HEAD lock exactly.

Reviewer's substitute provenance record: the SHA256 snapshot above (first independent hash record of
these files in this gate review) + verbatim verification that the gate-relevant sections I relied on
(§16.4, §11.4, Arch §42, migration-inventory G2) are internally consistent with the in-tree
implementation's own authority citations. See Discrepancy D1.

---

## Step B — canonical chain re-run (independent positive + negative re-run)

All commands from the worktree root. No forbidden tools used (no `pnpm run/exec`, no vitest CLI,
no tsx/esbuild/vite, no piped-stdio node child processes). `scripts/run-tests.mjs` was verified to
be the sanctioned plain-node runner: it executes the `.test.ts` sources under Node native TS
type-stripping with a resolution hook mapping `vitest` to the in-repo shim and spawns no child
processes (P1-T5 origin, commit `5bac15f`; 0 commits touching it in the Phase range).

### B.1 `pnpm install --ignore-scripts`

```
Packages: +150
✓ Lockfile passes supply-chain policies (175 entries in 2.1s)
Progress: resolved 150, reused 150, downloaded 0, added 150, done
devDependencies: + @eslint/js 9.39.5, eslint 9.39.5, globals 16.5.0, typescript 6.0.3,
  typescript-eslint 8.68.0, vitest 4.1.11
Done in 34.1s using pnpm v11.7.0
EXIT=0
```

(Warm store, single attempt — no store-lock contention, no retry needed.)

### B.2 `node scripts/run-tests.mjs` (no argument = all 9 packages)

Run 1 (full console): `run-tests (plain-node vitest-equivalent): 492 passed, 0 failed, 492 total, 4747 ms`
`RESULT: PASS run-tests (0 failures)` — **EXIT=0**.
Run 2 (captured to `run-tests-full.txt` in this evidence dir, to preserve the complete per-file
transcript): same result, 349 ms — **EXIT=0**.

Per-file transcript (43 lines, all PASS), counts per package:

| Package | Files (tests) | Subtotal |
|---|---|---|
| client | client.test.ts (3) | 3 |
| contracts | contracts (2), errors (7), identity (12), ids (18), negative (21), remote-safe (10), serialization (16), types (1) | 87 |
| domain | domain.test (2); t2: catalog (15), hash (15), immutability (10), parse (13), revision (8), validation (41) = 102; t3: lifecycle-property (4), lifecycle-transitions (14), member-context-policy (17), member-lifecycle (7), member-n-instances (14), member-workspace (14) = 70; t4: policy-explain (15), policy-matrix (14), policy-negative (34) = 63; t5: compatibility-bridge (75) | 312 |
| remote / runtime / storage | (2) / (3) / (2) | 7 |
| testkit | t6-1-no-agent-dependency (6), t6-2-template-n-instances (8), t6-3-lifecycle-matrix (8), t6-4-policy-precedence (11), t6-5-compat-complete-true (6), t6-6-snapshot-immutability (8), t6-7-fresh-per-delegation (6), t6-8-serialization-roundtrip (9), t6-9-negative-matrix (12), t6-10-composition-pipeline (5), testkit (2) | 81 |
| tools | tools.test.ts (2) | 2 |
| **Total** | | **492 passed, 0 failed** |

t6 subtotal = 79 (plus 2 testkit baseline = 81), i.e. 492 = 413 pre-T6 + 79 t6 — arithmetically
consistent with the worker report's decomposition.

### B.3–B.6 Typecheck (4× tsc, direct `node node_modules/typescript/bin/tsc`)

| Command | Exit | Output |
|---|---|---|
| `tsc -p packages/testkit/tsconfig.json` | 0 | (empty) |
| `tsc -p packages/testkit/domain/tsconfig.json` | 0 | (empty) |
| `tsc -p packages/domain/tsconfig.json` | 0 | (empty) |
| `tsc -p packages/contracts/tsconfig.json` | 0 | (empty) |

Logs captured as `tsc-*.log` (all 0 bytes). **tsc 4/4 exit 0.**

**Step B verdict: canonical chain fully green, re-run personally by this reviewer.**

---

## Step C — zero-core / private-import / owned-boundary

### C.1 Zero-core (CORE PATCH BUDGET = 0)

```
$ git diff --name-only 4bb1ca373b85cb228d8df139f22767f01160dc05..HEAD
total paths changed: 144
top-level distribution: packages 111, dev 30, docs 2, pnpm-lock.yaml 1
paths outside (packages|docs|dev/agent-workflow): pnpm-lock.yaml  (the only one)
```

- All 144 paths are under `packages/**`, `docs/**`, or `dev/agent-workflow/**` **except**
  `pnpm-lock.yaml`.
- The `pnpm-lock.yaml` exception was **verified as the authorized one**: its full phase diff is
  20 insertions / 8 deletions, all of which are (a) `packages/domain: dependencies: yaml ^2.9.0`,
  (b) the `yaml@2.9.0` package entry with its integrity hash, (c) mechanical re-labeling of the
  `vite@8.2.2` peer chain (`yaml@2.9.0`) caused by that one addition. No other dependency,
  specifier, or version changed anywhere in the lockfile.
- The companion `packages/domain/package.json` change (same commit `d000212`, P3-T2) is exactly:

```diff
+  "dependencies": {
+    "yaml": "^2.9.0"
+  },
```

- No `patches/` directory (`Test-Path patches` = False; `git ls-files 'patches/*'` = 0).
- No `postinstall`/`preinstall`/`install` scripts in any tracked `package.json` (root + 9 packages).
- No `patchedDependencies` in the root `package.json`; root scripts are build/typecheck/lint/test/test:node/smoke only.
- The only `.patch` files in the tree are
  `scripts/fixtures/zero-core/patches/@fixture+host-core@1.0.0.patch` and
  `scripts/fixtures/zero-core/patches/left-pad@1.0.0.patch` — **negative fixtures** consumed by the
  P1-T5 scanner `scripts/verify-zero-core.mjs` (which must detect and reject such artifacts); they are
  not applied to anything.
- `packages/` contains exactly the nine frozen skeleton packages (client, contracts, domain, legacy,
  remote, runtime, storage, testkit, tools); `git ls-files 'references/*'` = 0 — no vendored copy of
  upstream DSH anywhere in the tree.

**Zero-core: PASS.**

### C.2 Private imports

Method: regex enumeration of every import specifier (`from '…'`, `import(…)`, `import '…'`,
`require(…)`) in all tracked files under `packages/**` (script `scan-private-imports.ps1` in this
evidence dir; result `scan-imports.txt`), plus a literal marker scan over the same files
(`scan-markers.ps1`; result `scan-markers.txt`).

Result:

- **83 unique relative specifiers** — every one an in-workspace path
  (`contracts/src/…`, `domain/{blueprint,member,lifecycle,policy,compatibility}/src|testdata|fixtures/…`,
  `testkit/…`); zero escapes the workspace.
- **Bare specifiers: exactly 3** — `yaml` (×1, `packages/domain/blueprint/src/parse.ts:34`, the
  authorized blueprint-frontmatter dependency) and `vitest` (×47, test files) + `vitest/config` (×8,
  `vitest.config.ts` files) — the latter two are the root `devDependencies` test-runner surface,
  mapped by the sanctioned `run-tests.mjs` hook to the in-repo shim. No framework, no upstream DSH
  package, no `@dsh-agent-team/*` bare import in any package.
- **Absolute/path specifiers: 0. `node:` builtin specifiers: 0.**
- Marker scan: `deepseek-harness` ×2 (one doc-comment `@see` link to the upstream GitHub repo in
  `contracts/src/ids/session-id.ts:33`; one entry in the **banned-specifier list** in
  `testkit/domain/src/import-graph.ts:52`); all 8 `node:` literal hits are in comments stating that
  no node builtins are used; 0 hits for `references/`, `D:\`, `D:/`, `packages/host`, `packages/bundle`,
  `apps/cli`, `apps/web`, `@dsh/`, `internal/`.
- The two regex "other" hits (`${from}` in a template literal error message; "ran and settled" in a
  doc comment) are false positives, inspected line-by-line.

**Private imports: PASS** — the domain layer's only bare dependency is `yaml`, as expected; the
vitest bare imports exist solely in test files / test config (test infrastructure, not a domain
dependency — see Observation O2).

### C.3 Owned-boundary (per-commit)

`git log --reverse --name-only` over the Phase range → 21 commits; each file classified against the
task's owned paths (TaskDoc §11.4 as recorded in the brief) with the brief's known exceptions.
Full per-commit classification: `owned-boundary-report.txt` in this evidence dir.

| Commit | Class | Files outside owned path | Verdict |
|---|---|---|---|
| `73758a2` R10 kickoff | MAIN bookkeeping | `SESSION_ROUTER_LOG.md`, `graph.yaml` only | OK |
| `984bb3c` P3-T1 freeze | T1 | none (24 files, all `packages/contracts/**`) | OK |
| `af360cd` P3-T1 evidence | T1 | `evidence/P3-T1/run-log.txt` only | OK |
| `fba817c` P3-T1 evidence | T1 | `evidence/P3-T1/{attempt-ledger.txt,summary.json}` only | OK |
| `39a5d22` R10 complete | MAIN bookkeeping | log + graph only | OK |
| `2143a53` R11 kickoff | MAIN bookkeeping | log + graph only | OK |
| `d000212` P3-T2 blueprint | T2 | `packages/domain/package.json` (yaml dep — **authorized**, diff verified) + `pnpm-lock.yaml` (**authorized**) + `evidence/P3-T2/**` | OK |
| `5aef611` P3-T2 evidence | T2 | `evidence/P3-T2/**` only | OK |
| `7891c79` P3-T2 evidence | T2 | `evidence/P3-T2/**` only | OK |
| `1ec17cc` P3-T3 member/lifecycle | T3 | none (`packages/domain/member/**`, `packages/domain/lifecycle/**`, `packages/domain/test/t3-*`, subdir tsconfigs) | OK |
| `1b74dbd` P3-T3 evidence | T3 | `evidence/P3-T3/**` only | OK |
| `98e1e90` P3-T4 policy | T4 | none (`packages/domain/policy/**`, `packages/domain/test/t4-*`) | OK |
| `4f857a8` P3-T5 compatibility | T5 | none (`packages/domain/compatibility/**`, `packages/domain/test/t5-*`, `evidence/P3-T5/**`) | OK |
| `ba293ec` R11 results/R12 | MAIN bookkeeping | log + graph only | OK |
| `b660e90` post-integration fix | FIX (main agent) | `packages/domain/tsconfig.json` **only** — single line `"rootDir": "."` → `"../.."` in the noEmit typecheck config (extends `tsconfig.build.json`, which is untouched; no emit layout change) — **exactly the authorized exception** | OK |
| `a993a94` R13 kickoff | MAIN bookkeeping | log + graph only | OK |
| `189414f` P3-T6 suite | T6 | `packages/testkit/domain/**`, `packages/testkit/test/t6-*`, `packages/testkit/tsconfig.json` (rootDir `../..`, noEmit — the T6-owned config change), `docs/contracts/**`, `evidence/P3-T6/**` | OK |
| `7839f7a` P3-T6 evidence (HEAD) | T6 | `evidence/P3-T6/**` only | OK |

(13 of the 21 commits touch `dev/agent-workflow/**`; the map "commit → dev/agent-workflow dirs"
shows each task commit writing **only its own** `evidence/P3-Tn/` and each MAIN commit only the
log + graph. No cross-task evidence writes; no worker commit touches `graph.yaml` or
`SESSION_ROUTER_LOG.md`.)

The two docs paths in the Phase diff are exactly `docs/contracts/freeze-confirmation.md` and
`docs/contracts/g3-report.md` (P3-T6 owned).

**Owned-boundary: PASS — 0 violations** (the single classifier flag on
`packages/domain/package.json` is the brief's explicitly authorized yaml addition, verified as
single-writer `d000212` with a minimal diff).

---

## Step D — cross-task invariant combination review

Frozen doc: Architecture `…_Detailed_Architecture_20260829.md` (main-worktree absolute path; read
in full for §0.3, §42, and the relevant sections; no read flap, no retry needed). §42 lists 67
invariants; the six cross-task invariants under review, each with doc location + tree evidence:

| # | Invariant | Frozen-doc location | Tree evidence (source) | Tree evidence (tests, re-run green in Step B) |
|---|---|---|---|---|
| D1 | `TeamSessionId = RootSessionId` | Arch §42 inv. 9; §8.2 | `contracts/src/ids/session-id.ts` — `TeamSessionId` is a **type alias** of `RootSessionId`; `teamSessionIdOf(root)` returns the identical branded value; `CHANGELOG.md` L29 records the alias | `contracts/test/ids.test.ts` (18), `identity.test.ts` (12), `negative.test.ts` (21) — all green |
| D2 | runtime identity = `(rootSessionId, instanceId)`, templateId static | Arch §42 inv. 18/19; §10.2 | `contracts/src/identity.ts` — composite key of exactly two components, deep-frozen, `assertMemberIdentityInTeam` → `IDENTITY_SCOPE_MISMATCH`; templateId/label/groupId explicitly excluded ("template identity does not participate") | `identity.test.ts` (12, incl. "two members sharing a template are distinct", "same instanceId under different root sessions are different identities"), `t3-member-n-instances.test.ts` (14), `t6-2` (8) |
| D3 | `MemberInstanceRecord` exactly five states CREATED/RUNNING/SETTLED/ARCHIVED/DISPOSED | Arch §42 inv. 51 (+53 Restore=ARCHIVED→SETTLED, +56 DISPOSED terminal); §29 | `contracts/src/dto/member-instance-record.ts` — `MemberLifecycleState` enum object with exactly the 5 entries + `isMemberLifecycleState` type guard | `negative.test.ts` "exactly the five lifecycle states are recognized", `t3-lifecycle-transitions.test.ts` (14), `t3-lifecycle-property.test.ts` (4), `t6-3` (8) |
| D4 | 20-code `TeamContractError` vocabulary closed | DevPlan §9.1 (error codes live in contracts); TaskDoc P3-T1 (freeze core contracts/IDs/errors) | `contracts/src/errors.ts` — `TeamContractErrorCode` documented "CLOSED vocabulary as of contract v1"; **counted exactly 20 codes** (`INVALID_SESSION_ID, INVALID_ROOT_SESSION_ID, INVALID_CHILD_SESSION_ID, INVALID_INSTANCE_ID, INVALID_TEMPLATE_ID, INVALID_BLUEPRINT_ID, INVALID_BLUEPRINT_REVISION, INVALID_BLUEPRINT_CONTENT_HASH, IDENTITY_SCOPE_MISMATCH, DUPLICATE_INSTANCE_ID, DUPLICATE_TEAM_SESSION, SESSION_ALREADY_BOUND, MEMBER_NOT_FOUND, LEGACY_MEMBER_ID_REJECTED, LEGACY_TEAM_SESSION_EVENT_REJECTED, SCHEMA_VERSION_MISMATCH, SCHEMA_VERSION_UNSUPPORTED, MALFORMED_DTO, REMOTE_VALUE_NOT_JSON, TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`) | `errors.test.ts` (7) — hardcodes an **independent** sorted copy of the 20 spellings and asserts length 20 + equality, so a silent add/rename fails |
| D5 | legacy MemberId quarantined (rejected on all DTO surfaces) | DevPlan §16.3 (forbids "TeamMemberId runtime identity" as new-contract basis); TaskDoc P3-T1 验收标准 | `contracts/src/legacy-vocabulary.ts` — `LEGACY_FORBIDDEN_FIELDS = ['memberId']`; `assertNotLegacyMemberField` throws `LEGACY_MEMBER_ID_REJECTED`, invoked by every DTO parser | `negative.test.ts` — 4 dedicated tests, one per DTO surface (TeamSessionRecord, MemberInstanceRecord, SessionBinding, BlueprintSnapshotRef), all expect `LEGACY_MEMBER_ID_REJECTED` |
| D6 | vNext has no Team SessionEvents (5 legacy names detection-only) | Arch §42 inv. 42 ("禁止新增 Team-specific DSH SessionEvent vocabulary"); §0.3, §14.2 | `contracts/src/legacy-vocabulary.ts` — `LEGACY_TEAM_SESSION_EVENT_NAMES` = exactly `team/member-bound, team/progress, team/control-request, team/control-decision, team/message` (matches the G2 declaration list in `docs/migration/legacy-behavior-inventory.md`, sourced from legacy `packages/team/team/src/events.ts`); detection-only: `isLegacyTeamSessionEventName` + `assertNotLegacyTeamSessionEvent` → `LEGACY_TEAM_SESSION_EVENT_REJECTED`; the contract defines NO team event names of its own | `negative.test.ts` (3 tests: "lists exactly the five frozen legacy event names", "detects legacy names and nothing else", "assertNotLegacyTeamSessionEvent rejects legacy names, passes others") |

**Step D verdict: all six cross-task invariants hold in the integrated tree, each with both source
encoding and passing test evidence. No drift between frozen doc and implementation found.**

---

## Step E — criterion → evidence → PASS/FAIL (independent)

For each of the 7 G3 criteria (DevPlan §16.4, verified verbatim in A.2) the covering tests were
**read in full** by this reviewer and **re-run green** in Step B (492/492, exit 0).

| # | Criterion | Primary test file(s) (count) | What I verified in the test code | Supporting suites (re-run green) | Verdict |
|---|---|---|---|---|---|
| 1 | domain has no live Agent dependency | `testkit/test/t6-1-no-agent-dependency.test.ts` (6) | Closure of the t6 bundle enumerated as closed data in `testkit/domain/src/import-graph.ts` (9 direct + 54 transitive, asserted self-consistent); banned-segment scan (`runtime, tools, remote, client, legacy, team` + `@dsh-agent-team/*` + `deepseek-harness`); ONLY bare specifier in closure = `yaml`; every direct dep live-imported at runtime with marker-export check; no public export of any composed module is named `*agent*` | `contracts/remote-safe` (10) + `serialization` (16); my independent import scan (C.2) corroborates: 0 node builtins, 0 upstream refs | **PASS** |
| 2 | one template → N instances covered by property tests | `testkit/test/t6-2-template-n-instances.test.ts` (8) | Property over N ∈ {1..8, 12}: same templateId+label instantiated N times → N distinct `(rootSessionId, instanceId)` identities; identities/records/bindings cross-checked at every N; canonical-key round-trip | `domain/test/t3-member-n-instances.test.ts` (14: 50 instances of one template, no per-template cap; R1–R4 roster rules; DUPLICATE_INSTANCE_ID; SESSION_ALREADY_BOUND inv. 23; reserved `inst-leader`) | **PASS** |
| 3 | lifecycle transition matrix fixed | `testkit/test/t6-3-lifecycle-matrix.test.ts` (8) | Operation rules literal (5 operations, exact sources/targets); derived matrix = expected **9-edge** literal (9 of 25 pairs legal); `canTransition`/`legalTargets`/`assertTransitionLegal` agree over **all 25 ordered pairs**; 9 legal edges commit (frozen new record, `activityVersion+1`, input untouched); 16 illegal pairs reject with typed errors (`LIFECYCLE_TERMINAL_STATE` from DISPOSED, `LIFECYCLE_ILLEGAL_TRANSITION` else); full 5×5 op×state sweep; RESTORE lands in SETTLED only; DISPOSE terminal | `t3-lifecycle-transitions.test.ts` (14: matrix = exactly the 9 legal §29 edges; DISPOSED only terminal; all-25-pairs agreement), `t3-lifecycle-property.test.ts` (4) | **PASS** |
| 4 | policy precedence exhaustive tests | `testkit/test/t6-4-policy-precedence.test.ts` (11) | Solo winner every layer × every capability with provenance; origin/scope variants; **all 15 ordered layer pairs × 5 capabilities** (allow/allow, deny-above, lawful relaxation); full six-layer stack (humanOverride wins, five lower recorded ascending); external stage un-bypassable (missing capability, hard deny, hard-allow subset/disjoint); fail-closed on no candidates; determinism + deep freeze; identity scope + mirror-vs-contracts equality | `t4-policy-matrix.test.ts` (14: 6 layers × 5 capabilities; 15 pairs × 5 in each conflict mode; hard semantics; invariant 35), `t4-policy-negative.test.ts` (34), `t4-policy-explain.test.ts` (15) | **PASS** |
| 5 | complete:true compatibility fatal test | `testkit/test/t6-5-compat-complete-true.test.ts` (6) | Closed requirement-type × complete-mode × availability **cube as one property**; `complete` absent ≡ explicit false (byte-identical canonical results); unmet `complete:true` ⇒ mandatory FATAL, no downgrade/no Continue Anyway; FATAL reason codes checked against the frozen contracts-v1 vocabulary (`TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`); stable counts + serialization fingerprint. Authority cited: Arch §13.5/§27.1/§27.2/§28 | `t5-compatibility-bridge.test.ts` (75) | **PASS** |
| 6 | Blueprint snapshot immutable tests | `testkit/test/t6-6-snapshot-immutability.test.ts` (8) | `parseBlueprint` returns deep-frozen snapshot (mutation ⇒ TypeError); content hash identical across BOM/CRLF normalization and key shuffling; revision series ⇒ distinct hashes; `contentHash` derived (smuggled source field fails with typed code); snapshot ref bound into TeamSession record stays frozen and addressable by `blueprintId@revision` (inv. 10; Arch §5.6/§8.4) | `t2-blueprint-immutability.test.ts` (10: deep-freeze checks per surface, fresh parse objects), `t2-blueprint-hash.test.ts` (15), `t2-blueprint-revision.test.ts` (8) | **PASS** |
| 7 | fresh_per_delegation semantics encoded as new-instance policy | `testkit/test/t6-7-fresh-per-delegation.test.ts` (6) | Property: fresh_per_delegation template ALWAYS resolves `create/fresh_per_delegation` for any roster size/state mix (a new delegation ⇒ NEW MemberInstance + new child Session, NOT a context reset); explicit addressing always continues the addressed instance even under fresh policy; 3 sequential delegations ⇒ 3 distinct instances; `persistent` default continues the unique work-accepting instance; contextPolicy frozen at creation, survives transitions; DISPOSED never accepts new work (Arch §11.2/§11.3/§21.6/§24.1/§29.5, inv. 18/25) | `t3-member-context-policy.test.ts` (17) | **PASS** |

Cross-cutting must-tests of TaskDoc P3-T6 also re-run green: `t6-8-serialization-roundtrip` (9),
`t6-9-negative-matrix` (12), `t6-10-composition-pipeline` (5).

**Contracts v1 freeze (TaskDoc P3-T1/P3-T6 验收)**: `packages/contracts/CHANGELOG.md` line 6–8
("## [v1] — frozen 2026-08-29 (task P3-T1)" / "Status: FROZEN") verified in-tree; Step C proves
`packages/contracts/**` was touched **only** by the three P3-T1 commits in the Phase range — no
later task modified the frozen surface. `docs/contracts/freeze-confirmation.md`'s spot-check table
is consistent with what I verified independently.

### Comparison with `docs/contracts/g3-report.md` (claim, not evidence)

The worker report's criterion→file mapping (t6-1…t6-7, counts 6/8/8/11/6/8/6), its canonical-run
list, and its decomposition "492 = 413 baseline + 79 t6" all **match** my independent mapping and
my re-run. Its "Contract gaps" note (three expectation mismatches fixed test-side, no
CONTRACT_CHANGE_REQUEST, contracts unmodified) is consistent with Step C (contracts untouched
post-T1) and with the in-code comments I read. **No discrepancies found.**

---

## Discrepancy / observation notes

- **D1 (Step A, minor)**: `file-manifest.json` does not contain a hash section for the four frozen
  20260829 plan docs — it is exclusively the legacy-fork diff manifest (`baseline` + 470 classified
  `files`). The brief's literal "hash cross-check of the four frozen docs against the manifest" is
  therefore not executable as worded. Substitutes performed: SHA256 snapshot of all four docs
  (recorded in A.4 — the first hash record of these files in this gate review), manifest baseline
  SHAs cross-checked against TEST_METHODS.md §1 and AGENTS.md (both match), and verbatim
  verification of every frozen-doc section this review relies on. Non-blocking: the docs are
  untracked by design, identified by the exact filenames ROUTER_RULES cites, and every
  doc↔implementation cross-reference checked in this review is consistent.
- **O2 (minor)**: the brief's expectation "only relative imports plus the single bare dependency
  yaml" holds exactly for the **domain layer** (t6-1's closure assertion enforces this). The bare
  specifiers `vitest`/`vitest/config` appear only in test files and `vitest.config.ts` — the
  root-`devDependencies` test-runner surface, replaced by the in-repo shim under the sanctioned
  `run-tests.mjs` chain (no real vitest process is ever started). Not a private/upstream import;
  recorded for completeness.
- **O3 (informational)**: `scripts/fixtures/zero-core/patches/*.patch` exist as negative fixtures
  for the P1-T5 zero-core scanner (inputs it must detect and reject), not as patching artifacts.
- No blocker conditions observed; no `CORE_SEAM_BLOCKER`, `CONTRACT_CHANGE_REQUEST`,
  `SPEC_CONFLICT`, `DEPENDENCY_BLOCKER`, or `TEST_INFRA_BLOCKER` evidence in the reviewed tree.

---

## Red-line check summary

| Red line (AGENTS.md) | Check performed | Result |
|---|---|---|
| No upstream source modification (CORE PATCH BUDGET = 0) | Phase diff path audit (144 paths, all `packages/**`/`docs/**`/`dev/agent-workflow/**` + authorized `pnpm-lock.yaml`); no `patches/`, no postinstall scripts, no `patchedDependencies`, no vendored upstream (`git ls-files references/` = 0) | **CLEAN** |
| No import/use of upstream private/internal APIs | Full specifier enumeration + marker scan (C.2): only relative imports + `yaml`; 0 node builtins; 0 upstream refs | **CLEAN** |
| Legacy Team SessionEvent vocabulary not used as vNext authority | Arch inv. 42 encoded: 5 legacy names frozen detection-only, emit rejected (`LEGACY_TEAM_SESSION_EVENT_REJECTED`); vNext defines no team event names | **CLEAN** |
| No legacy history rewrite / frozen branch moved | No git history operations performed by this review; Phase history is additive cherry-pick chain on `int/P3-contracts-domain` (commit subjects/messages consistent; no rebasing traces in the reviewed range) | **CLEAN** |
| No push / force / tags | This review performed local read-only git queries + one local evidence commit on the detached head; no push, no force, no tags | **CLEAN** |
| Stable instance untouched | No DSH instance started/stopped/touched by this review; all runs were the sanctioned test chain inside the worktree | **CLEAN** |

---

## Final verdict

All 7 G3 criteria independently **PASS** (each covering test suite read in full and re-run green:
492/492 + tsc 4/4 exit 0). Steps A–D performed and clean, with one minor non-blocking observation
(D1: the provenance manifest carries no frozen-doc hash section, so the brief's literal hash
cross-check could not be executed as worded; substitutes performed and recorded) and two
informational notes (O2, O3). Per the four-verdict contract this is:

### 投机通过

All seven criteria PASS on my own re-runs; the residual observation (D1) concerns the completeness
of an orchestration artifact, not the development under review, and the substitutes performed
(SHA256 snapshot, baseline cross-check, verbatim gate-text verification) make the subsequent
development risk controllable.

**Verdict JSON**:
```json
{
  "verdict": "投机通过",
  "criteria": "7/7 PASS",
  "rerun_summary": "suite 492/492 + exit0 (2 runs), tsc 4/4 exit0",
  "findings": "- D1: file-manifest.json has no frozen-doc hash section (legacy-fork diff manifest only); SHA256 snapshot + baseline cross-check substituted (non-blocking)\n- O2: bare vitest/vitest-config imports exist only in test files/config (root devDep, shimmed by sanctioned runner); domain closure bare = yaml only\n- O3: scripts/fixtures/zero-core/*.patch are scanner negative fixtures, not artifacts\n- zero-core: 144 paths all in budget; pnpm-lock.yaml diff = authorized yaml ^2.9.0 only; no patches/postinstall/vendored upstream\n- private-imports: 83 relative specifiers, 0 node: builtins, 0 upstream refs\n- owned-boundary: 21/21 commits within owned paths (+ authorized exceptions verified: b660e90 tsconfig rootDir single line, d000212 yaml dep + lockfile)\n- invariants D1–D6 all hold with source + test evidence; 20-code error vocabulary counted and closure-tested with independent hardcoded list; 5 states / 5 legacy event names exact\n- g3-report.md (claim) matches my independent mapping; no discrepancies"
}
```

---

## Evidence files in this directory

- `run-tests-full.txt` — full Step B.2 transcript (43 lines, 492/492)
- `tsc-testkit.log`, `tsc-testkit-domain.log`, `tsc-domain.log`, `tsc-contracts.log` — 4× tsc outputs (all empty, exit 0)
- `phase-commits.txt` — `git log --name-only` over the Phase range (21 commits)
- `owned-boundary-report.txt` — per-commit owned-path classification
- `scan-imports.txt` — import-specifier classification (83 relative / 3 bare / 0 absolute / 0 node:)
- `scan-markers.txt` — upstream/private marker scan results
- `scan-private-imports.ps1`, `scan-markers.ps1`, `check-owned-boundary.ps1` — the scan/check scripts (reproducible)
- `contracts-test-names.txt`, `domain-testkit-test-names.txt` — test-name listings used for the Step E mapping
