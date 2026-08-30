# G3-REVIEW — Reviewer 1 of 3 (independent, blind)

- **Reviewer**: fresh subagent, no session inheritance, no prior program context; did not read
  `SESSION_ROUTER_LOG.md`, `graph.yaml`, or any `evidence/**` file except
  `dev/agent-workflow/evidence/provenance/file-manifest.json` (hash cross-check only).
- **Worktree**: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G3R1`
  (detached HEAD at integration SHA `7839f7a3db8c610c50975f2facc220df3ce80c62`, branch
  `int/P3-contracts-domain` contains HEAD). All reads/writes/git stayed inside this worktree
  plus the four frozen-doc reads by absolute path in the main worktree (mandated by the brief).
- **Gate**: G3 — Development Plan §16.4 (7 criteria); execution method TaskDoc §11.4 (G3 Gate 执行方法).
- **Scope reviewed**: Phase range `4bb1ca373b85cb228d8df139f22767f01160dc05..HEAD` (21 commits),
  P3-T1 contract freeze → P3-T2..T5 domain packages → P3-T6 integration/property suite.

---

## Step 0 — mandatory first reads (AGENTS.md prompt-injection rule)

1. Read `.worktrees/G3R1/docs/ROUTER_RULES.md` (156 lines): gate composition (3 independent
   fresh reviewers, four verdicts, 阻塞>补充内容>投机通过/通过 precedence, §3), task execution
   caps (§2), git discipline and red lines.
2. Read `.worktrees/G3R1/docs/TEST_METHODS.md` (68 lines): dedicated test instance only
   (port 3180, `references/deepseek-harness-test-use`), stable instance (:3080 /
   `D:\deepseek-harness\`) must not be affected. G3 re-runs are pure node/tsc chains inside the
   worktree; no live DSH instance is required or touched by this review.

## Step A — must-reads + frozen-doc hash cross-check

### A.1 Worktree state (verified)

```text
$ git rev-parse HEAD
7839f7a3db8c610c50975f2facc220df3ce80c62
$ git branch --show-current
(empty — detached HEAD, as expected)
$ git status --porcelain
(empty — clean before review writes)
```

### A.2 Embedded §16.4 verification

Read Development Plan `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md`
(main worktree, untracked; read directly by absolute path, single attempt, no retry needed),
§16.4 Gate G3 at lines 2196–2206:

```text
## 16.4 Gate G3

✓ domain has no live Agent dependency
✓ one template → N instances covered by property tests
✓ lifecycle transition matrix fixed
✓ policy precedence exhaustive tests
✓ complete:true compatibility fatal test
✓ Blueprint snapshot immutable tests
✓ fresh_per_delegation semantics encoded as new-instance policy
```

**Result: the 7-item list embedded in my brief matches section 16.4 exactly (verbatim, same order).**

Also verified in the frozen docs (all read by absolute path from the main worktree, single attempt each):

- TaskDoc §11.4 (`...Task_Decomposition_and_Review_Method_20260829.md`, lines 1066–1186):
  phase dependency graph `P3-T1 → {T2||T3||T4||T5} → T6 → G3`, task cards with owned paths
  (T1 `packages/contracts/**`; T2 `packages/domain/blueprint/**`; T3
  `packages/domain/member*;lifecycle*`; T4 `packages/domain/policy/**`;
  T5 `packages/domain/compatibility/**`; T6 `packages/testkit/domain;docs/contracts`),
  and the "G3 Gate 执行方法" 6-step text matching my brief verbatim.
- Architecture `...Detailed_Architecture_20260829.md` (3097 lines): §0.3 old-semantics
  replacement table (line 58: 禁止新增 Team-specific DSH SessionEvent vocabulary; line 60:
  `templateId` static / `instanceId` runtime identity; line 66: ARCHIVED→Restore→SETTLED),
  §8.2 (line 598: `TeamSessionId = RootSessionId`), §11.2/§11.3 (persistent default;
  fresh_per_delegation as instance-creation policy), §14.2 (why independent of DSH SessionEvent),
  §29 FSM + §29.5 DISPOSED terminal (lines 2030–2045), §42 invariants 1–67 (lines 2850–2920),
  incl. 9, 10, 17–20, 25, 33–37, 42, 47/48 (complete:true structural FATAL), 51–56, 65.
- UI Design doc read only as needed for cross-references (not load-bearing for G3).

### A.3 Frozen-doc SHA-256 hashes (computed by this reviewer)

```text
030DFB8EC55BAE30F35C2826C7E4E659C0E0B742D836018CE502F34017870C53  DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md
3EF3AB69ED2BD7879E4C15079A16C8DAE456B572690246A5C1F9CBB0C8C4981E  DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md
A05D237F8515FD6467373632849AFE0C6A1AE63BC0EC298DE63B9D124D881D0F  DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md
2B457CC033CA1B72AA781E072E0EF7FE55BC05D2F7EA25CC03C827D257E888A3  DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md
```

### A.4 Provenance manifest cross-check — NOT POSSIBLE as specified (discrepancy D-1)

Read `dev/agent-workflow/evidence/provenance/file-manifest.json` (4901 lines; the only evidence
file permitted to me). Findings:

- The manifest is the **legacy-fork diff manifest** (baseline upstream `cd5ef814…`, legacy
  `a3ab3199…`, 470 classified files, per-file status/classification/disposition + mixed-hunk
  routing). It is a P0 provenance artifact about the legacy fork, not a frozen-plan hash ledger.
- Grep for `20260829` → only 2 hits: line 6 (`legacy_ref` branch name) and line 1116
  (`docs/active-plans/DSH_Agent_Team_vNext_Unattended_Execution_Spec_20260829.md` — a legacy
  fork-side doc entry). Grep for `hash|sha|Digest` → only `upstream_sha`, `legacy_sha` and
  translation-pairing ledger "reason" strings. No `sha256` values, no entry for any of the four
  `docs/plans/active/*20260829.md` frozen docs.

**Therefore the brief's "cross-check the four frozen docs' hashes against
file-manifest.json" has no comparison target: the manifest contains no frozen-doc hashes.**
I computed the four hashes above and record them here for future cross-checks. This is an
evidence-infrastructure gap, not a Phase-3 code defect. Mitigating verification I did instead:
read all four docs directly from their sole authoritative location (main worktree), verified the
embedded gate list verbatim, and confirmed every in-tree code citation (invariant numbers,
§-references in module headers) is consistent with the text of the docs I read.

## Step B — canonical chain re-run (my independent positive + negative re-run)

All commands from worktree root `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G3R1`.
Node v24.20.0, pnpm 11.7.0.

### B.1 `pnpm install --ignore-scripts`

```text
Scope: all 10 workspace projects
Lockfile is up to date, resolution step is skipped
Lockfile passes supply-chain policies (175 entries in 1.9s)
Packages: +150
✓ … added 150 (all reused from warm store; no store-lock contention; no retry needed)
exit code: 0
```

### B.2 `node scripts/run-tests.mjs` (no argument = all 9 packages)

```text
run-tests (plain-node vitest-equivalent): 492 passed, 0 failed, 492 total, 352 ms
RESULT: PASS run-tests (0 failures)
exit code: 0
```

Per-file counts (full run; testkit subset re-run shown explicitly):

| Suite | Tests | Result |
| --- | --- | --- |
| packages/client | 3 | PASS |
| packages/contracts (8 files: contracts, errors, identity, ids, negative, remote-safe, serialization, types) | 87 | PASS |
| packages/domain (16 files: domain, t2×6, t3×6, t4×3, t5-bridge) | 334 | PASS |
| packages/remote | 2 | PASS |
| packages/runtime | 3 | PASS |
| packages/storage | 2 | PASS |
| packages/tools | 2 | PASS |
| packages/testkit (11 files: t6-1…t6-10, t6-helpers excluded, testkit) | 81 | PASS |
| **total** | **492** | **exit 0** |

Testkit detail (re-run `node scripts/run-tests.mjs testkit`):

```text
PASS packages\testkit\test\t6-1-no-agent-dependency.test.ts (6 tests)
PASS packages\testkit\test\t6-10-composition-pipeline.test.ts (5 tests)
PASS packages\testkit\test\t6-2-template-n-instances.test.ts (8 tests)
PASS packages\testkit\test\t6-3-lifecycle-matrix.test.ts (8 tests)
PASS packages\testkit\test\t6-4-policy-precedence.test.ts (11 tests)
PASS packages\testkit\test\t6-5-compat-complete-true.test.ts (6 tests)
PASS packages\testkit\test\t6-6-snapshot-immutability.test.ts (8 tests)
PASS packages\testkit\test\t6-7-fresh-per-delegation.test.ts (6 tests)
PASS packages\testkit\test\t6-8-serialization-roundtrip.test.ts (9 tests)
PASS packages\testkit\test\t6-9-negative-matrix.test.ts (12 tests)
PASS packages\testkit\test\testkit.test.ts (2 tests)
run-tests (plain-node vitest-equivalent): 81 passed, 0 failed, 81 total, 193 ms
```

### B.3–B.6 tsc (recorded exit codes)

```text
$ node node_modules/typescript/bin/tsc -p packages/testkit/tsconfig.json      → exit 0
$ node node_modules/typescript/bin/tsc -p packages/testkit/domain/tsconfig.json → exit 0
$ node node_modules/typescript/bin/tsc -p packages/domain/tsconfig.json       → exit 0
$ node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json    → exit 0
```

No diagnostic output from any tsc run. **tsc 4/4 exit 0.**

Forbidden tools were not used at any point (no `pnpm run`, no `pnpm exec`, no vitest CLI,
no tsx/esbuild/vite, no piped-stdio node child processes).

## Step C — zero-core / private-import / owned-boundary checks

### C.1 Zero-core (CORE PATCH BUDGET = 0)

Phase range verified: `git merge-base --is-ancestor 4bb1ca37… HEAD` → exit 0 (4bb1ca37 is an
ancestor; it is the R9 bookkeeping commit "G2-REVIEW PASSED … graph→P3", i.e. Phase start on
master after G2).

```text
$ git diff --name-only 4bb1ca373b85cb228d8df139f22767f01160dc05..HEAD
  (144 paths, grouped by top-level prefix)
  packages/domain         67
  dev/agent-workflow      30
  packages/contracts      28
  packages/testkit        16
  docs/contracts           2
  pnpm-lock.yaml           1
```

- **No path under `references/`, no upstream file, no path outside `packages/** | docs/** |
  dev/agent-workflow/** | pnpm-lock.yaml`.** PASS.
- `Test-Path …\patches` → `False` (no patch-package `patches/` dir). PASS.
- All 11 `package.json` files (root + 9 packages + `scripts/fixtures/zero-core`) scanned:
  no `postinstall`, no `patch-package`, no `pnpm patch`, no `prepare` script. PASS.
- `pnpm-lock.yaml` diff: sole new dependency is `yaml@2.9.0` (specifier `^2.9.0`) under
  `packages/domain`, plus the corresponding transitive peer-resolution strings
  (`vite@8.2.2(yaml@2.9.0)`, `@vitest/mocker@4.1.11(...)`, `vitest@4.1.11(...)`).
  `packages/domain/package.json` declares `"yaml": "^2.9.0"`. This is the single authorized
  writer exception (blueprint frontmatter parser, TaskDoc P3-T2 允许依赖 "standard
  YAML/markdown parser"). No other lock change. PASS.
- No vendored modified upstream copy: the Phase diff contains no copy of upstream tree
  content; all 9 root packages are the vNext skeleton. PASS.

### C.2 Private imports

Scan method: (a) ripgrep over all `packages/**/*.ts` for import/export-from specifiers that
are not relative; (b) targeted grep for `node:`, `require(`, dynamic `import(`.

Result:

- **Source code**: only relative imports plus exactly one bare dependency —
  `import yamlModule from 'yaml'` in `packages/domain/blueprint/src/parse.ts` (line 34).
  Matches the expected "single bare dependency yaml (blueprint frontmatter)".
- **Test files / vitest.config.ts**: bare `vitest` / `vitest/config` only — the canonical
  test harness (root devDependency; the sanctioned `scripts/run-tests.mjs` chain shims
  `vitest` via `scripts/test-vitest-shim.mjs`). Not an upstream DSH dependency.
- **No import of upstream DSH internals or private APIs. No workspace-external path. No
  `node:` builtin import anywhere in package sources** (all `node:` grep hits are doc
  comments explicitly stating purity, e.g. `blueprint/src/hash.ts` "no `node:` builtins",
  `compatibility/src/fingerprint.ts` "No hashing builtin (node:crypto) is used").
- Two dynamic `await import(...)` calls, both in test files resolving to workspace-relative
  TS sources (`t6-1` line 49, `t5-compatibility-bridge` line 37) — the runner's intended
  live-import mechanism, not an external dependency.

PASS.

### C.3 Owned-boundary (per-commit, TaskDoc §11.4 ownership)

Method: `git log --reverse --name-only` over `4bb1ca37..HEAD` (21 commits); every file of every
commit compared against that commit's task owned paths.

| # | Commit | Subject (abbrev.) | Touched paths | Verdict |
| --- | --- | --- | --- | --- |
| 1 | `73758a2` | chore(workflow) R10 kickoff | `dev/agent-workflow/{SESSION_ROUTER_LOG.md,graph.yaml}` | allowed (main-agent bookkeeping, dev/agent-workflow only) |
| 2 | `984bb3c` | P3-T1 freeze contract v1 | `packages/contracts/**` (CHANGELOG, package.json, 17 src, 8 test) | owned by P3-T1 |
| 3 | `af360cd` | P3-T1 canonical run evidence | `dev/agent-workflow/evidence/P3-T1/run-log.txt` | allowed (evidence) |
| 4 | `fba817c` | P3-T1 summary + attempt ledger | `dev/agent-workflow/evidence/P3-T1/{attempt-ledger.txt,summary.json}` | allowed (evidence) |
| 5 | `39a5d22` | chore R10 complete (T1 integrated) | `dev/agent-workflow/{log,graph}` | allowed (bookkeeping) |
| 6 | `2143a53` | chore R11 kickoff D1 parallel | `dev/agent-workflow/{log,graph}` | allowed (bookkeeping) |
| 7 | `d000212` | P3-T2 blueprint + yaml dep + t2 tests | `packages/domain/blueprint/**`, `packages/domain/test/t2-*`, `packages/domain/package.json` (yaml dep), `pnpm-lock.yaml` | owned + authorized yaml/lock exception |
| 8 | `5aef611` | P3-T2 run evidence | `dev/agent-workflow/evidence/P3-T2/run-log.txt` | allowed (evidence) |
| 9 | `7891c79` | P3-T2 summary + ledger | `dev/agent-workflow/evidence/P3-T2/{attempt-ledger.txt,summary.json}` | allowed (evidence) |
| 10 | `1ec17cc` | P3-T3 member/lifecycle + t3 tests | `packages/domain/lifecycle/**`, `packages/domain/member/**`, `packages/domain/test/t3-*` | owned by P3-T3 |
| 11 | `1b74dbd` | P3-T3 run evidence | `dev/agent-workflow/evidence/P3-T3/{attempt-ledger.txt,run-log.txt,summary.json}` | allowed (evidence) |
| 12 | `8950962` | P3-T4 policy resolver + t4 tests | `packages/domain/policy/**`, `packages/domain/test/t4-*` | owned by P3-T4 |
| 13 | `98e1e90` | P3-T4 run evidence | `dev/agent-workflow/evidence/P3-T4/{attempt-ledger.txt,run-log.txt,summary.json}` | allowed (evidence) |
| 14 | `ffa409b` | P3-T5 compatibility engine | `packages/domain/compatibility/{src,fixtures,tsconfig.json}` | owned by P3-T5 |
| 15 | `88c0008` | P3-T5 test suites + bridge | `packages/domain/compatibility/test/t5-*`, `packages/domain/test/t5-compatibility-bridge.test.ts` | owned (namespaced t5 tests + subpkg tests) |
| 16 | `4f857a8` | P3-T5 run evidence | `dev/agent-workflow/evidence/P3-T5/{attempt-ledger.txt,run-log.txt,summary.json}` | allowed (evidence) |
| 17 | `b660e90` | fix(domain) rootDir widening | `packages/domain/tsconfig.json` only (`"rootDir": "."` → `"../.."`, noEmit config) | allowed exception (main-agent post-integration fix; verified diff) |
| 18 | `ba293ec` | chore R11 results + R12 (D1 integrated) | `dev/agent-workflow/{log,graph}` | allowed (bookkeeping) |
| 19 | `a993a94` | chore R13 P3-T6 kickoff + T6 structure ruling | `dev/agent-workflow/{log,graph}` | allowed (bookkeeping) |
| 20 | `189414f` | P3-T6 property suite + G3 report + freeze confirmation | `docs/contracts/{freeze-confirmation.md,g3-report.md}`, `packages/testkit/domain/{src,index,scenario,import-graph}.ts` + `packages/testkit/domain/tsconfig.json`, `packages/testkit/test/t6-*` (10 tests + `t6-helpers.ts`), `packages/testkit/tsconfig.json` | owned by P3-T6 (incl. documented rootDir change; verified diff `rootDir "." → "../.."`) |
| 21 | `7839f7a` | P3-T6 canonical run evidence | `dev/agent-workflow/evidence/P3-T6/**` (run-log, can2-leg1…6, summary, attempt ledger, debug repro) | allowed (evidence) |

**No commit touched any file outside its task's owned paths or the three documented allowed
exceptions.** PASS.

## Step D — cross-task invariant combination review

For each invariant: frozen-doc location → tree source evidence → tree test evidence (all re-run
green in Step B).

| Invariant | Frozen doc location | Source evidence (tree) | Test evidence (tree, re-run green) |
| --- | --- | --- | --- |
| `TeamSessionId = RootSessionId` | Architecture §8.2 (line 598); §42 inv 9 (line 2862) | `contracts/src/ids/session-id.ts` — `TeamSessionId` type alias over `RootSessionId`; `teamSessionIdOf(root)` returns the same branded value; `contracts/src/identity.ts` header cites inv 9 | `t6-2` (identity.rootSessionId === teamSessionId; N-sweep), `t6-10` (teamSessionIdOf in pipeline), `contracts/test/identity.test.ts` (12), `contracts/test/ids.test.ts` (18) |
| runtime identity = `(rootSessionId, instanceId)`, templateId static | Architecture §42 inv 18/19 (lines 2871–2872); §0.3 line 60 | `contracts/src/identity.ts` — `MemberIdentity` exactly `{rootSessionId, instanceId}`; canonical key instanceId-first; label/templateId/groupId explicitly non-identities; `dto/member-instance-record.ts` stores both components | `t6-2` (N instances share templateId+label yet pairwise distinct identities), `t6-8` (canonical key round-trips; reordering/missing field → MALFORMED_DTO), `t6-4` (IDENTITY_SCOPE_MISMATCH), `t6-9` (legacy memberId → LEGACY_MEMBER_ID_REJECTED) |
| `MemberInstanceRecord` exactly 5 states | Architecture §42 inv 51 (line 2904); §29 FSM (lines 2030–2045); §8.6 (line 672) | `contracts/src/dto/member-instance-record.ts` — `MEMBER_LIFECYCLE_STATES` = CREATED/RUNNING/SETTLED/ARCHIVED/DISPOSED (exactly 5); `domain/lifecycle/src/operations.ts` — 9-edge matrix derived from 5 operations | `t6-3` (9 legal / 16 illegal of 25 pairs; 5×5 operation×state sweep; DISPOSED terminal; RESTORE→SETTLED only), `t6-9` (16 illegal pairs; malformed state value → MALFORMED_DTO), `t3-lifecycle-*` (18) |
| 20-code `TeamContractError` vocabulary closed | Development Plan §16.2 (Contracts: errors); contracts v1 freeze (CHANGELOG rule, quoted in `docs/contracts/freeze-confirmation.md`) | `contracts/src/errors.ts` — `TeamContractErrorCode` with exactly 20 members (INVALID_SESSION_ID, INVALID_ROOT_SESSION_ID, INVALID_CHILD_SESSION_ID, INVALID_INSTANCE_ID, INVALID_TEMPLATE_ID, INVALID_BLUEPRINT_ID, INVALID_BLUEPRINT_REVISION, INVALID_BLUEPRINT_CONTENT_HASH, IDENTITY_SCOPE_MISMATCH, DUPLICATE_INSTANCE_ID, DUPLICATE_TEAM_SESSION, SESSION_ALREADY_BOUND, MEMBER_NOT_FOUND, LEGACY_MEMBER_ID_REJECTED, LEGACY_TEAM_SESSION_EVENT_REJECTED, SCHEMA_VERSION_MISMATCH, SCHEMA_VERSION_UNSUPPORTED, MALFORMED_DTO, REMOTE_VALUE_NOT_JSON, TEAM_PERSONA_COMPLETE_PRESET_CONFLICT); `TEAM_CONTRACT_ERROR_CODE_VALUES` closed-set export | `t6-9` ("closed contracts vocabulary is exactly 20 codes" + every negative-case code is a member of the closed set), `contracts/test/errors.test.ts` (7) |
| legacy `MemberId` quarantined (rejected on all DTO surfaces) | Architecture §0.3 line 60; Development Plan §16.3 (禁止 `TeamMemberId runtime identity` as contract base); TaskDoc P3-T1 验收标准 (line 1092: contracts 不包含 legacy MemberId authority) | `contracts/src/legacy-vocabulary.ts` — `LEGACY_FORBIDDEN_FIELDS = ['memberId']`, `assertNoLegacyFields` → `LEGACY_MEMBER_ID_REJECTED`; called in **all four** DTO parsers: `team-session-record.ts:95`, `session-binding.ts:115`, `blueprint-snapshot.ts:65`, `member-instance-record.ts:161` | `t6-9` (MemberInstanceRecord / TeamSessionRecord / SessionBinding legacy memberId → LEGACY_MEMBER_ID_REJECTED), `contracts/test/negative.test.ts` (21) |
| vNext has no Team SessionEvents (5 legacy names detection-only) | Architecture §42 inv 42 (line 2895); §0.3 line 58; §14.2 (line 1026) | `contracts/src/legacy-vocabulary.ts` — `LEGACY_TEAM_SESSION_EVENT_NAMES` = exactly `['team/member-bound','team/progress','team/control-request','team/control-decision','team/message']`, documented DETECTION ONLY; `assertNotLegacyTeamSessionEvent` → `LEGACY_TEAM_SESSION_EVENT_REJECTED`; vNext defines no team event names of its own | `t6-9` (loop over all 5 names → LEGACY_TEAM_SESSION_EVENT_REJECTED), `contracts/test/negative.test.ts` |

All six cross-task invariants hold in the integrated tree with source + test evidence. PASS.

## Step E — criterion → evidence → PASS/FAIL (independent)

Method: for each §16.4 criterion I (1) located the covering test file(s), (2) READ the tests to
confirm they genuinely express the criterion, (3) relied on my own Step B re-run (492/492
green) which executes them. `docs/contracts/g3-report.md` was treated strictly as a claim;
where I cross-checked it against my mapping (result summary, criterion→file mapping, 81/492
counts, 88-case negative matrix, attempt-1/attempt-2 history) **no discrepancy was found** —
but no verdict below rests on it.

| # | Criterion (DevPlan §16.4) | Covering evidence (tests I read + my green re-run) | Verdict |
| --- | --- | --- | --- |
| 1 | domain has no live Agent dependency | `t6-1-no-agent-dependency.test.ts` (6 tests): closed import closure enumerated as data in `testkit/domain/src/import-graph.ts` (9 direct + 54 transitive = 63 distinct specifiers, asserted self-consistent); banned path segments `runtime/tools/remote/client/legacy/team` + banned bare workspace names; ONLY bare specifier in closure is `yaml`; all 9 direct deps live-import with marker exports; no export name contains "agent". My independent grep scan (Step C.2) corroborates: no upstream import, no node: builtin. | PASS |
| 2 | one template → N instances covered by property tests | `t6-2-template-n-instances.test.ts` (8 tests): N-sweep {1..8, 12} of the SAME template; N pairwise-distinct `(rootSessionId, instanceId)` identities; identities/records/session-bindings cross-checked at every N; label+templateId shared yet identities distinct (inv 19); identity-key round-trip. Supporting: `t3-member-n-instances.test.ts` (14). | PASS |
| 3 | lifecycle transition matrix fixed | `t6-3-lifecycle-matrix.test.ts` (8 tests): 5-operation literal; derived matrix equals the expected 9-edge literal (9 of 25 pairs legal); canTransition/legalTargets/assertTransitionLegal over ALL 25 pairs; 9 legal commits (new frozen record, activityVersion+1, input untouched); 16 typed rejections (LIFECYCLE_TERMINAL_STATE from DISPOSED, LIFECYCLE_ILLEGAL_TRANSITION else); full 5×5 operation×state sweep; RESTORE→SETTLED only (frozen 3A); DISPOSED terminal. Supporting: `t3-lifecycle-property` (4), `t3-lifecycle-transitions` (14), `t3-member-lifecycle` (7). | PASS |
| 4 | policy precedence exhaustive tests | `t6-4-policy-precedence.test.ts` (11 tests, 603 lines): solo winner per layer×capability; 15 ordered layer pairs × 5 capabilities (higher wins, lower recorded in `overriddenLower`); deny above; lawful relaxation (inv 34); full six-layer stack in ascending order; external stage un-bypassable (missing/hard-deny/hard-allow subset/disjoint/team-deny); fail-closed deny with `unspecified` provenance; determinism + explainability + deep freeze; IDENTITY_SCOPE_MISMATCH; mirror-vs-contracts identity equality. Supporting: `t4-policy-matrix` (14), `t4-policy-negative` (34), `t4-policy-explain` (15). | PASS |
| 5 | complete:true compatibility fatal test | `t6-5-compat-complete-true.test.ts` (6 tests): closed requirement-type × complete-mode × availability cube as one property with an expected-outcome oracle (complete:true ⇒ FATAL: `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` for persona, `COMPLETE_REQUIREMENT_NOT_MET` otherwise; teamStructure ⇒ structural FATAL; no downgrade / no Continue Anyway); `complete` absent ≡ explicit false (byte-identical canonical results); FATAL reason codes pinned against the frozen contracts-v1 closed vocabulary across the module boundary. Supporting: `t5-complete-true.test.ts` inside the 75-test t5 suite. | PASS |
| 6 | Blueprint snapshot immutable tests | `t6-6-snapshot-immutability.test.ts` (8 tests): parse pipeline returns deep-frozen snapshot; BOM+CRLF and shuffled key order → identical content hash; revision series → distinct hashes; `contentHash` derived (smuggled `NEG_CONTENT_HASH_IN_SOURCE` fixture fails with its typed code); snapshot ref bound into a TeamSession record stays frozen and addressable by `blueprintId@revision`. Supporting: `t2-blueprint-immutability` (10), `t2-blueprint-hash` (15). | PASS |
| 7 | fresh_per_delegation semantics encoded as new-instance policy | `t6-7-fresh-per-delegation.test.ts` (6 tests): fresh-policy template + new delegation ⇒ NEW MemberInstance with NEW child Session and independent context (not a context reset on an existing instance); explicitly addressed instance always continued under either policy; `persistent` default; contextPolicy frozen at creation (§21.6). Supporting: `t3-member-context-policy` (17, incl. resolveDelegationTarget semantics). | PASS |

Named P3-T6 must-tests (TaskDoc §11.4: cross-module property tests; serialization round-trip;
negative matrix) are additionally present and green: `t6-8-serialization-roundtrip` (9),
`t6-9-negative-matrix` (12 tests over the 88-case table — 36 literal `neg()` entries + 5
legacy-event loop entries + 16 illegal-lifecycle-pair loop entries + 31 blueprint negative
fixtures; I verified the 31 = `NEGATIVE_FIXTURES` array length in `blueprint/testdata/fixtures.ts`
lines 910–942 and the 88 arithmetic), `t6-10-composition-pipeline` (5).

**Criterion result: 7/7 PASS.**

## Discrepancy / observation notes

- **D-1 (minor, evidence infrastructure)**: `file-manifest.json` contains no hash ledger for
  the four 20260829 frozen docs (it is the legacy-fork diff manifest), so the brief-specified
  hash cross-check is not executable against it. I computed and recorded the four SHA-256
  values (Step A.3) and verified doc content directly (Step A.2). Not a Phase-3 defect;
  recommend the main agent add a frozen-doc hash ledger to provenance for future gates.
- **O-1 (minor, non-blocking)**: `packages/domain/policy/src/contracts-mirror.ts` re-declares a
  slice of the contracts-v1 surface locally instead of importing `contracts`. Its documented
  justification (TS6059 under `rootDir` = package dir) refers to the constraint that commit
  `b660e90` later widened to repo root, so the justification is stale (though harmless).
  Drift risk is mitigated by `t6-4`'s mirror-vs-contracts identity equality assertions and by
  the contracts v1 freeze rule (any change requires a new version + authority + approval, which
  would force consumer review). No action required for G3; flag for future contract-v2 work.
- **O-2 (informational)**: P3-T6 canonical attempt 1 failed at leg 3 with 15 type errors, all
  fixed test-side; attempt 2 (final state) is the one I re-ran and it is green. Consistent with
  the commit history and with `docs/contracts/g3-report.md`; no contract was modified
  (`packages/contracts/**` last touched by `984bb3c`/`fba817c` only — P3-T1).
- No discrepancies found between my independent mapping and the worker's `g3-report.md`
  (claim-only document; not used as evidence).

## Red-line check summary (AGENTS.md 红线)

| Red line | Status |
| --- | --- |
| No upstream source modification (CORE PATCH BUDGET = 0) | CLEAN — Phase diff touches no upstream path; no `patches/`, no postinstall/patch-package in any of 11 package.json files; sole lockfile delta is the authorized `yaml` dep |
| No import/use of upstream private/internal APIs | CLEAN — scan in C.2: relative + `yaml` + test-harness `vitest` only |
| No patch-package / pnpm patch / postinstall rewrite | CLEAN — as above |
| No Team patch applied to upstream/host tree; no vendored modified upstream copy | CLEAN — no upstream tree content in the diff |
| Legacy Team SessionEvent vocabulary not used as vNext authority | CLEAN — detection-only quarantine with rejection (Step D, row 6) |
| No legacy history rewrite; frozen branch untouched | CLEAN — no force/tag/push by this reviewer; range is linear cherry-picked int-branch history |
| No push / force / tags by reviewer | CLEAN — review performed read-only + local evidence commit only |
| Reversible impact, evidenced | CLEAN — only writes: this evidence file (and node_modules from `pnpm install --ignore-scripts`) |

## Final verdict

All 7 §16.4 criteria independently PASS (own green re-run: 492/492 tests + tsc 4/4 exit 0;
covering tests read and confirmed to express each criterion). Steps A–D clean except the
recorded evidence-infrastructure gap D-1 (frozen-doc hash cross-check not executable against
`file-manifest.json` as the manifest carries no such ledger) and minor observation O-1
(policy contracts-mirror with stale justification, test-mitigated). None of these blocks the
gate or invalidates any criterion; they do leave a small residual that "later problems cannot
be fully excluded" (doc-provenance not cryptographically anchored; mirror drift on a future
contract v2).

**Verdict: 投机通过**

- 7/7 criteria PASS on independent re-run.
- Minor non-blocking observations: D-1 (no frozen-doc hash ledger in provenance manifest;
  hashes now recorded in this report), O-1 (policy contracts-mirror duplication, stale
  TS6059 justification, mitigated by t6-4 identity-equality test + freeze rule), O-2
  (attempt-1 failure history, test-side only, final state independently green).

## Commands and exact outputs

All commands and their exact outputs are embedded inline in Steps A–E above
(hash table A.3; install B.1; 492/492 + per-suite counts B.2; tsc 4/4 B.3–B.6; diff groupings
C.1; tsconfig diffs and per-commit table C.3). This file was committed on the detached head of
worktree G3R1 as the reviewer-1 evidence record.
