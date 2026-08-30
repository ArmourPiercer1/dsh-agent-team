# G3-REVIEW — Reviewer 2 of 3 (independent, blind)

- **Gate**: G3 — Phase P3 (contracts v1 freeze + domain packages + domain integration/property suite)
- **Integration SHA**: `7839f7a3db8c610c50975f2facc220df3ce80c62` (branch `int/P3-contracts-domain`)
- **Phase range**: `4bb1ca373b85cb228d8df139f22767f01160dc05` (Phase start on master) .. HEAD
- **Reviewer worktree**: `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G3R2` (detached HEAD)
- **Blindness honored**: did not read `dev/agent-workflow/SESSION_ROUTER_LOG.md`, `graph.yaml`, or anything under `dev/agent-workflow/evidence/**` except `evidence/provenance/file-manifest.json` (hash cross-check only). `docs/contracts/g3-report.md` and `freeze-confirmation.md` treated strictly as worker CLAIMS, verified independently, never used as evidence.
- **Toolchain**: node v24.20.0, pnpm 11.7.0, typescript 6.0.3 (workspace devDep). No forbidden tools used (no `pnpm run`/`pnpm exec`/vitest CLI/tsx/esbuild/vite; no piped-stdio child processes).

---

## Identity

Reviewer 2 of 3 fresh, fully independent BLIND gate reviewers. All judgments below derive only from (a) the worktree at the integration SHA, (b) the four frozen 20260829 docs read by absolute path from the main worktree, (c) `docs/ROUTER_RULES.md` + `docs/TEST_METHODS.md` inside the worktree (mandatory first step, read in full), and (d) my own re-runs recorded verbatim in this file.

## Step 0 — mandatory first reads (done first, before anything else)

1. `docs/ROUTER_RULES.md` (worktree copy, 156 lines, read fully) — gate protocol: 3 independent reviewers, four verdicts, 通过/投机通过 both advance the gate only when all three reviewers give one of the two; reviewer must actually re-run key verifications.
2. `docs/TEST_METHODS.md` (worktree copy, 68 lines, read fully) — test-instance constraints (port 3180, `references/deepseek-harness-test-use`, stable instance :3080 off-limits). G3 is a package-level gate (no live DSH instance required), so the test instance was not started; nothing touched :3080 or `D:\deepseek-harness\`.

Worktree state at start:

```
$ git -C .worktrees\G3R2 rev-parse HEAD
7839f7a3db8c610c50975f2facc220df3ce80c62
$ git -C .worktrees\G3R2 status --porcelain
(empty — clean tree)
$ git -C .worktrees\G3R2 branch --show-current
(empty — detached HEAD, as required)
$ git -C .worktrees\G3R2 log --oneline -1
7839f7a P3-T6: add canonical run evidence (492/492 + 4x tsc green, attempt 2/3) + attempt ledger + summary
```

## Step A — must-reads + frozen-doc verification

### A.1 Gate criteria list vs frozen Development Plan §16.4 — MATCH (verbatim)

Read `D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md` (absolute path, single read, no retry needed), lines 2196–2206:

```
## 16.4 Gate G3

```text
✓ domain has no live Agent dependency
✓ one template → N instances covered by property tests
✓ lifecycle transition matrix fixed
✓ policy precedence exhaustive tests
✓ complete:true compatibility fatal test
✓ Blueprint snapshot immutable tests
✓ fresh_per_delegation semantics encoded as new-instance policy
```text
```

The embedded 7-item list in my brief matches this section **exactly, item for item, wording for wording**.

### A.2 G3 Gate 执行方法 vs frozen TaskDoc §11.4 — MATCH (verbatim)

TaskDoc (actual file name `DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md`, as noted in the brief), lines 1173–1186:

```
### G3 Gate 执行方法
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 main。
```

Matches the brief's verbatim quote exactly. Phase-scope task cards P3-T1..P3-T6 (lines 1066–1171) also read; the per-task owned paths used in Step C are exactly those cards' "拥有的文件/包" fields.

### A.3 Frozen-doc hash cross-check vs provenance manifest — DISCREPANCY (data gap, not a mismatch)

Read the only permitted evidence file: `dev/agent-workflow/evidence/provenance/file-manifest.json` (main worktree).

Structure (parsed): top-level keys = `baseline`, `files`. `baseline` = legacy-fork diff baseline (upstream_sha `cd5ef8148158c3a752a658978873241fdf8e2bbc`, legacy_sha `a3ab31992762c5d6560797eabc7e0885a9320ade`, file_count 470, status_counts M=160/A=310/D=0/R=0). `files` = 470 entries, each `{path, status, classification, disposition, reason, mixed_hunks}`. **The manifest contains NO hash field and NO entries for the four frozen 20260829 docs** (verified by parsing all 470 paths: none under `docs/plans/active/`; a search for `20260829` matches only the `legacy_ref` string and one unrelated 20260827-era fork doc path). It is a legacy-fork diff classification, not a frozen-doc hash manifest.

Consequence: the hash cross-check as literally specified in the brief cannot be executed against this manifest — there is nothing in it to compare against. I did NOT read any other evidence file to compensate (blindness rule). Instead I recorded observed integrity data:

Observed SHA-256 of the four frozen docs (main worktree, `Get-FileHash`, read-only):

| Doc (main-worktree path) | SHA-256 | bytes |
| --- | --- | --- |
| `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md` | `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53` | 73980 |
| `docs/plans/active/DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md` | `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e` | 59833 |
| `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md` | `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f` | 72945 |
| `docs/plans/active/DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md` | `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3` | 108677 |

Corroboration that the docs are the authoritative ones the program used: (a) both verbatim sections my gate depends on (§16.4 criteria, G3 gate method) match the brief exactly; (b) the tree's own sources and CHANGELOG cite these exact sections (§8.2, §29, §13.5, §27.1/27.2, §42 invariant numbers) and their semantics agree with the tree's behavior in every spot-check I performed; (c) `git ls-files docs/plans/active` from my worktree is empty and the directory does not exist in my worktree — consistent with the brief's statement that the frozen docs are UNTRACKED and live only in the main worktree.

## Step B — canonical chain re-run (independent positive + negative re-run)

All commands from the worktree root `D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G3R2`.

### B.1 `pnpm install --ignore-scripts`

```
Scope: all 10 workspace projects
? Verifying lockfile against supply-chain policies (175 entries)...
Lockfile is up to date, resolution step is skipped
Packages: +150
devDependencies:
+ @eslint/js 9.39.5
+ eslint 9.39.5
+ globals 16.5.0
+ typescript 6.0.3
+ typescript-eslint 8.68.0
+ vitest 4.1.11
Done in 21.5s using pnpm v11.7.0
EXIT=0
```

Warm store (reused 150, downloaded 0). No store-lock contention; no retry needed. Exit 0.

### B.2 `node scripts/run-tests.mjs` (no argument = all 9 packages)

```
run-tests (plain-node vitest-equivalent): 492 passed, 0 failed, 492 total, 347 ms
RESULT: PASS run-tests (0 failures)
EXIT=0
```

All 34 test files PASS. Per-file counts (from the run log; criterion-relevant ones bolded):

| File | Tests |
| --- | --- |
| packages/client/test/client.test.ts | 3 |
| packages/contracts/test/contracts.test.ts | 2 |
| packages/contracts/test/errors.test.ts | 7 |
| packages/contracts/test/identity.test.ts | 12 |
| packages/contracts/test/ids.test.ts | 18 |
| packages/contracts/test/negative.test.ts | 21 |
| packages/contracts/test/remote-safe.test.ts | 10 |
| packages/contracts/test/serialization.test.ts | 16 |
| packages/contracts/test/types.test.ts | 1 |
| packages/domain/test/domain.test.ts | 2 |
| packages/domain/test/t2-blueprint-catalog.test.ts | 15 |
| packages/domain/test/t2-blueprint-hash.test.ts | 15 |
| **packages/domain/test/t2-blueprint-immutability.test.ts** | **10** |
| packages/domain/test/t2-blueprint-parse.test.ts | 13 |
| packages/domain/test/t2-blueprint-revision.test.ts | 8 |
| packages/domain/test/t2-blueprint-validation.test.ts | 41 |
| packages/domain/test/t3-lifecycle-property.test.ts | 4 |
| packages/domain/test/t3-lifecycle-transitions.test.ts | 14 |
| **packages/domain/test/t3-member-context-policy.test.ts** | **17** |
| packages/domain/test/t3-member-lifecycle.test.ts | 7 |
| **packages/domain/test/t3-member-n-instances.test.ts** | **14** |
| packages/domain/test/t3-member-workspace.test.ts | 14 |
| packages/domain/test/t4-policy-explain.test.ts | 15 |
| packages/domain/test/t4-policy-matrix.test.ts | 14 |
| packages/domain/test/t4-policy-negative.test.ts | 34 |
| **packages/domain/test/t5-compatibility-bridge.test.ts** (re-executes all 7 t5 suites, incl. t5-complete-true) | **75** |
| packages/remote/test/remote.test.ts | 2 |
| packages/runtime/test/runtime.test.ts | 3 |
| packages/storage/test/storage.test.ts | 2 |
| **packages/testkit/test/t6-1-no-agent-dependency.test.ts** | **6** |
| **packages/testkit/test/t6-2-template-n-instances.test.ts** | **8** |
| **packages/testkit/test/t6-3-lifecycle-matrix.test.ts** | **8** |
| **packages/testkit/test/t6-4-policy-precedence.test.ts** | **11** |
| **packages/testkit/test/t6-5-compat-complete-true.test.ts** | **6** |
| **packages/testkit/test/t6-6-snapshot-immutability.test.ts** | **8** |
| **packages/testkit/test/t6-7-fresh-per-delegation.test.ts** | **6** |
| packages/testkit/test/t6-8-serialization-roundtrip.test.ts | 9 |
| packages/testkit/test/t6-9-negative-matrix.test.ts | 12 |
| packages/testkit/test/t6-10-composition-pipeline.test.ts | 5 |
| packages/testkit/test/testkit.test.ts | 2 |
| packages/tools/test/tools.test.ts | 2 |

Total = 492 passed, 0 failed, exit 0. Matches the worker's claimed 492/492 (413 baseline + 79 t6), independently reproduced.

### B.3–B.6 typechecks

```
$ node node_modules/typescript/bin/tsc -p packages/testkit/tsconfig.json
TSC-1 testkit EXIT=0
$ node node_modules/typescript/bin/tsc -p packages/testkit/domain/tsconfig.json
TSC-2 testkit/domain EXIT=0
$ node node_modules/typescript/bin/tsc -p packages/domain/tsconfig.json
TSC-3 domain EXIT=0
$ node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json
TSC-4 contracts EXIT=0
```

tsc 4/4 exit 0.

## Step C — zero-core / private-import / owned-boundary

### C.1 Zero-core (CORE PATCH BUDGET = 0)

Path scope: `git diff --name-only 4bb1ca373b85cb228d8df139f22767f01160dc05..HEAD` → **144 files**. Filtered for paths NOT under `packages/**`, `docs/**`, or `dev/agent-workflow/**`:

```
OUT-OF-SCOPE: pnpm-lock.yaml     (the only one)
```

No path under `references/` or any upstream file. `4bb1ca37` verified as the Phase-start commit on `master` (`git merge-base --is-ancestor 4bb1ca37 master` → exit 0; branch list contains master and all int/task P3 branches).

The single out-of-scope file is the known allowed exception — verified:
- `git log --oneline 4bb1ca37..HEAD -- pnpm-lock.yaml` → exactly one commit: `d000212 P3-T2: implement blueprint domain package (parse/validate/hash/snapshot/catalog) + yaml dep + t2 test suite`.
- Same commit's diff of `packages/domain/package.json` adds exactly:
  ```json
  "dependencies": { "yaml": "^2.9.0" }
  ```
  i.e. pnpm-lock.yaml accompanies the authorized single bare dependency (blueprint frontmatter parsing). Single authorized writer. ✓

Patch/postinstall/vendored artifacts:
- No `postinstall` script in the root `package.json` or any `packages/*/package.json` (checked all 9).
- No `patch-package` / `pnpm patch` dependency anywhere (`Select-String` over all package.json files: no matches).
- No repo-root `patches/` dir. The only `patches` directory in the tree is `scripts/fixtures/zero-core/patches/` containing two SYNTHETIC fixture patches (`left-pad@1.0.0.patch`, `@fixture+host-core@1.0.0.patch`, the latter literally injecting a `'patched-by-team-rewrite'` string) used as INPUTS to the P1-era zero-core verifier fixture (`scripts/fixtures/zero-core/package.json` declares them under `pnpm.patchedDependencies` for a private fixture workspace only). `git log 4bb1ca37..HEAD -- scripts/` → empty: **untouched in the Phase range**. Not a rewrite of upstream; no vendored modified upstream copy exists.

**Zero-core: PASS.**

### C.2 Private imports

Method: scanned all 125 `.ts/.js/.mjs/.cjs` files under `packages/**` (excluding `node_modules`/`dist`) for import specifiers (`from '...'`, `import('...')`, `require('...')`), classified as relative / absolute / bare, and resolved every relative specifier against the worktree root.

Result:
- **461 relative imports, 0 escaping the worktree root; 0 absolute paths.**
- **Bare specifiers (complete list)**:
  - `yaml` — exactly 1 file: `packages/domain/blueprint/src/parse.ts` (the single authorized dependency; declared in `packages/domain/package.json`).
  - `vitest` — 47 files, all under `packages/*/test/**` (test framework, dev tooling).
  - `vitest/config` — 8 files, all `packages/*/vitest.config.ts`.
  - No other bare specifier. Three odd regex captures (`${from}`, `probed at * generation 0`, `ran and settled`) were verified as comment/template-literal false positives (transitions.ts:116, fingerprint.ts:37, workspace.ts:32).
- **No `node:` builtin imports anywhere in `packages/**`** (only two comment mentions, t2/t3-helpers.ts docstrings).
- No import of any upstream DSH internal/private API; no import of any path outside the workspace.
- Declared dependencies: only `domain` has a runtime dep (`yaml`); all 8 other packages have none.

**Private imports: PASS.**

### C.3 Owned-boundary (per TaskDoc §11.4 task cards)

`git log --name-only 4bb1ca37..HEAD` → **21 commits**. Per-commit check: every file of each commit must lie in that task's owned paths, `dev/agent-workflow/**` (bookkeeping/evidence), or one of the three known allowed exceptions. Result: **0 violations**.

| commit | subject (abbrev) | files | verdict |
| --- | --- | --- | --- |
| 73758a2 | chore(workflow): R10 kickoff | 2 (dev/agent-workflow only) | bookkeeping ✓ |
| 984bb3c | P3-T1: freeze shared contract v1 | 28 — all `packages/contracts/**` (src, dto, ids, test, package.json, CHANGELOG) | owned ✓ |
| af360cd / fba817c | P3-T1: canonical evidence + summary | 3 (dev/agent-workflow/evidence/P3-T1 only) | bookkeeping ✓ |
| d000212 | P3-T2: implement blueprint domain package | 15 — `packages/domain/blueprint/**`, `packages/domain/test/t2-*` (5 suites + helpers), `packages/domain/test/tsconfig.json`, `packages/domain/package.json`, `pnpm-lock.yaml` | owned + authorized yaml dep ✓ |
| 5aef611 / 7891c79 | P3-T2: canonical evidence + summary | 3 (dev/agent-workflow only) | bookkeeping ✓ |
| 1ec17cc | P3-T3: member/lifecycle pure domain | 19 — `packages/domain/member/**`, `packages/domain/lifecycle/**`, `packages/domain/test/t3-*` (5 suites + 2 helpers) + subdir tsconfigs | owned ✓ |
| 1b74dbd | P3-T3: canonical evidence | 3 (dev/agent-workflow only) | bookkeeping ✓ |
| 8950962 | P3-T4: pure Team policy resolver | 10 — `packages/domain/policy/**`, `packages/domain/test/t4-*` (3 suites + helpers) + subdir tsconfig | owned ✓ |
| 98e1e90 | P3-T4: canonical evidence | 3 (dev/agent-workflow only) | bookkeeping ✓ |
| ffa409b | P3-T5: compatibility engine | 11 — `packages/domain/compatibility/**` (src, fixtures, test, tsconfig) | owned ✓ |
| 88c0008 | P3-T5: test suites + canonical-chain bridge | 8 — `packages/domain/compatibility/test/t5-*` (7) + `packages/domain/test/t5-compatibility-bridge.test.ts` | owned ✓ |
| 4f857a8 | P3-T5: canonical evidence | 3 (dev/agent-workflow only) | bookkeeping ✓ |
| ba293ec | chore(workflow): R11 results + R12 | 2 (dev/agent-workflow only) | bookkeeping ✓ |
| b660e90 | fix(domain): widen typecheck rootDir | 1 — `packages/domain/tsconfig.json` only | **known allowed exception**, verified: diff is config-only `"rootDir": "."` → `"rootDir": "../.."` (noEmit typecheck config; `tsconfig.build.json` untouched; commit message explains TS6059 seam + verification) ✓ |
| a993a94 | chore(workflow): R13 P3-T6 kickoff | 2 (dev/agent-workflow only) | bookkeeping ✓ |
| 189414f | P3-T6: domain integration property suite | 18 — `docs/contracts/{freeze-confirmation.md,g3-report.md}`, `packages/testkit/domain/src/{import-graph,index,scenario}.ts`, `packages/testkit/domain/tsconfig.json`, `packages/testkit/test/t6-{1,2,3,4,5,6,7,8,9,10}*.test.ts` + `t6-helpers.ts`, `packages/testkit/tsconfig.json` | owned ✓ — the `packages/testkit/tsconfig.json` change verified as the brief's described "rootDir noEmit-config change": diff is exactly `"rootDir": "."` → `"rootDir": "../.."` with `noEmit: true` retained |
| 7839f7a | P3-T6: canonical run evidence | 13 (dev/agent-workflow/evidence/P3-T6 only) | bookkeeping ✓ |

**Owned-boundary: PASS** (21 commits, 0 violations; all three known exceptions verified rather than assumed).

## Step D — cross-task invariant combination review

Frozen doc location → tree evidence (source + tests), all verified by me:

### D.1 TeamSessionId = RootSessionId
- **Frozen**: Architecture §8.2 (lines 593–599: "不建立额外 TeamSession UUID: TeamSessionId = RootSessionId") + §42 invariant 9 (line 2862).
- **Tree**: `packages/contracts/src/ids/session-id.ts:54` `export type TeamSessionId = RootSessionId` (type-level alias, documented FROZEN/invariant 9); `parseTeamSessionId` = identity over `parseRootSessionId`; `teamSessionIdOf()` returns the same value; `errors.ts` code `INVALID_ROOT_SESSION_ID` documented as "which is the TeamSessionId, Architecture invariant 9"; `CHANGELOG.md` v1 records the alias. Tests: `contracts/test/identity.test.ts` (12), `ids.test.ts` (18), `t6-2` (asserts `identity.rootSessionId === comp.teamSessionId`), all green in my re-run.

### D.2 runtime identity = (rootSessionId, instanceId), templateId static
- **Frozen**: Architecture §42 invariants 18 & 19 (lines 2871–2872: identity is the composite; "label/templateId/groupId 都不是运行时 identity").
- **Tree**: `contracts/src/identity.ts:38–43` `MemberIdentity { rootSessionId; instanceId }` — exactly two components; `memberIdentityKey` = canonical JSON of the two; `MEMBER_NOT_FOUND`/`IDENTITY_SCOPE_MISMATCH` codes enforce scope; `member-instance-record.ts` stores `templateId` as static metadata (never part of identity); leader participates via reserved `LEADER_INSTANCE_ID = 'inst-leader'` (§9.2). Tests: `identity.test.ts` (12), `t6-2` (N distinct composites for identical templateId+label), `t6-4` item 10 (IDENTITY_SCOPE_MISMATCH + mirror-vs-contracts equality). Green in my re-run.

### D.3 MemberInstanceRecord exactly five states (CREATED/RUNNING/SETTLED/ARCHIVED/DISPOSED)
- **Frozen**: Architecture §29 (lines 2024–2047 FSM) + §42 invariant 51 (line 2904) + §8.6 (line 672: these five are the MemberInstance lifecycle; `PROVISIONING_FAILED` explicitly NOT a user-visible lifecycle).
- **Tree**: `contracts/src/dto/member-instance-record.ts:58–69` `MEMBER_LIFECYCLE_STATES` — exactly the five values, `as const`; the DTO `lifecycle` field is typed against exactly this union; `domain/lifecycle/src/operations.ts` `LIFECYCLE_OPERATION_RULES` (ADMIT_WORK: CREATED|SETTLED→RUNNING; SETTLE: RUNNING→SETTLED; ARCHIVE: SETTLED→ARCHIVED; RESTORE: ARCHIVED→SETTLED; DISPOSE: all four non-terminal→DISPOSED) derives the 9-edge frozen matrix (DISPOSED terminal, no outgoing edges) — matches §29 edge-for-edge and §30.1/30.2 (no RUNNING→ARCHIVED; Restore only to SETTLED). Tests: `t6-3` (all 25 ordered pairs checked: 9 legal commits, 16 typed rejections; 5×5 operation sweep), `t3-lifecycle-transitions` (14), `t3-lifecycle-property` (4). Green in my re-run.

### D.4 20-code TeamContractError vocabulary closed
- **Frozen**: Development Plan §16.2 (contracts own "errors") + Architecture §42 invariant set; TaskDoc P3-T1 card ("冻结 core contracts/IDs/errors"). The closed 20-code set is the contracts-v1 realization (name `TeamContractError` is the v1 contracts naming; the frozen docs mandate the section, the v1 freeze pins the enumeration).
- **Tree**: `contracts/src/errors.ts` — `TeamContractErrorCode` with **exactly 20** codes (counted programmatically: INVALID_SESSION_ID, INVALID_ROOT_SESSION_ID, INVALID_CHILD_SESSION_ID, INVALID_INSTANCE_ID, INVALID_TEMPLATE_ID, INVALID_BLUEPRINT_ID, INVALID_BLUEPRINT_REVISION, INVALID_BLUEPRINT_CONTENT_HASH, IDENTITY_SCOPE_MISMATCH, DUPLICATE_INSTANCE_ID, DUPLICATE_TEAM_SESSION, SESSION_ALREADY_BOUND, MEMBER_NOT_FOUND, LEGACY_MEMBER_ID_REJECTED, LEGACY_TEAM_SESSION_EVENT_REJECTED, SCHEMA_VERSION_MISMATCH, SCHEMA_VERSION_UNSUPPORTED, MALFORMED_DTO, REMOTE_VALUE_NOT_JSON, TEAM_PERSONA_COMPLETE_PRESET_CONFLICT); `TEAM_CONTRACT_ERROR_CODE_VALUES = Object.values(...)` (closed by construction); `isTeamContractError` guard; header: "CLOSED vocabulary as of contract v1… never a silent v1 edit"; `CHANGELOG.md` freeze rule (lines 94–106): no task may modify v1 semantics; changes require new version + authority + main-agent approval. Tests: `contracts/test/errors.test.ts` (7), `negative.test.ts` (21). Green in my re-run. No Phase commit modified `packages/contracts/**` after the P3-T1 freeze commit (verified in C.3).

### D.5 legacy MemberId quarantined (rejected on all DTO surfaces)
- **Frozen**: TaskDoc P3-T1 验收标准 ("contracts 不包含 legacy MemberId authority 或 live Agent"); Architecture invariant 18/19 (anti-pattern: memberId as definition+runtime identity); Dev Plan §16.3 prohibition ("禁止把旧 TeamMemberDefinition/TeamMemberBoundData/TeamMemberId runtime identity 作为新 contract 基础", lines 2184–2192).
- **Tree**: `contracts/src/legacy-vocabulary.ts:41` `LEGACY_FORBIDDEN_FIELDS = ['memberId']`; `assertNoLegacyFields` throws `LEGACY_MEMBER_ID_REJECTED`; called by **all four** DTO parsers — `dto/blueprint-snapshot.ts:65` (BlueprintSnapshotRef), `dto/team-session-record.ts:95` (TeamSessionRecord), `dto/member-instance-record.ts:161` (MemberInstanceRecord), `dto/session-binding.ts:115` (SessionBinding). Tests: `contracts/test/negative.test.ts` (21, incl. legacy-field rejections), `t6-9-negative-matrix` (12). Green in my re-run.

### D.6 vNext has no Team SessionEvents (5 legacy names detection-only)
- **Frozen**: Architecture §42 invariant 42 (line 2895: "禁止新增 Team-specific DSH SessionEvent vocabulary") + §14.2 (lines 1026–1031) + line 58; legacy names documented in `docs/migration/legacy-behavior-inventory.md` G2 entry (line 17): `team/member-bound`, `team/progress`, `team/control-request`, `team/control-decision`, `team/message`.
- **Tree**: `contracts/src/legacy-vocabulary.ts:50–56` `LEGACY_TEAM_SESSION_EVENT_NAMES` = **exactly those 5 names**, documented "DETECTION ONLY… vNext defines NO team session event names in this contract"; `isLegacyTeamSessionEventName` + `assertNotLegacyTeamSessionEventName` (throws `LEGACY_TEAM_SESSION_EVENT_REJECTED`) so any attempt to emit a legacy name through a vNext surface fails. Tests: `contracts/test/negative.test.ts` (21), `t6-9` (12). Green in my re-run.

## Step E — criterion → evidence → PASS/FAIL

Each criterion independently mapped to tree tests, tests read (not just claimed), and re-run green in my Step B full-suite run (492/492, exit 0).

| # | Criterion (DevPlan §16.4) | Evidence (test files, counts) | Re-run | Verdict |
| --- | --- | --- | --- | --- |
| 1 | domain has no live Agent dependency | `t6-1-no-agent-dependency.test.ts` (6): import-closure enumeration (9 direct + 54 transitive, 63 distinct) asserted self-consistent; banned-segment scan (`runtime/tools/remote/client/legacy/team` + bare workspace names) over the whole closure; ONLY bare specifier in closure = `yaml`; live-import of every direct dependency with marker-export check; no public export named after a live Agent. Corroborated by my independent C.2 scan (domain src imports only contracts + sibling domain modules; 0 banned targets). | 6/6 green in 492/492 run | **PASS** |
| 2 | one template → N instances covered by property tests | `t6-2-template-n-instances.test.ts` (8): N ∈ {1..8,12}, same templateId+label → N distinct `(rootSessionId, instanceId)` composites (invariants 18/19), identity-key round-trips, records/bindings cross-checked at every N. Plus `t3-member-n-instances.test.ts` (14) at the domain level. | 8/8 + 14/14 green | **PASS** |
| 3 | lifecycle transition matrix fixed | `t6-3-lifecycle-matrix.test.ts` (8): operation-rules literal pinned (5 ops, exact sources/targets); derived matrix == 9-edge literal (9 of 25 pairs); `canTransition`/`legalTargets`/`assertTransitionLegal` agree over ALL 25 ordered pairs; all 9 legal edges commit a NEW frozen record with `activityVersion+1` and leave the input untouched; all 16 illegal pairs reject with typed errors (TERMINAL_STATE from DISPOSED, ILLEGAL_TRANSITION otherwise); full 5×5 op×state sweep; RESTORE lands in SETTLED only (§30.2 3A); DISPOSED terminal. Plus `t3-lifecycle-transitions` (14) + `t3-lifecycle-property` (4). Matrix matches Architecture §29 edge-for-edge (verified in D.3). | 8/8 + 14/14 + 4/4 green | **PASS** |
| 4 | policy precedence exhaustive tests | `t6-4-policy-precedence.test.ts` (11): solo-winner for every layer × every capability; 15 ordered layer pairs × 5 capabilities pairwise (higher wins, lower recorded with provenance); higher-deny beats lower-allow; lawful relaxation (invariant 34); full six-layer stack (humanOverride wins, five lower recorded ascending); external stage un-bypassable (invariant 35: missing capability, hard deny, hard-allow subset/disjoint, team deny); fail-closed (no candidates ⇒ deny `unspecified`); determinism + deep freeze; identity-scope errors. Plus `t4-policy-matrix` (14) + `t4-policy-explain` (15) + `t4-policy-negative` (34). | 11/11 + 14/14 + 15/15 + 34/34 green | **PASS** |
| 5 | complete:true compatibility fatal test | `t6-5-compat-complete-true.test.ts` (6): closed requirement-type × complete-mode × availability cube pinned as one property; `complete` key optional-default (absent ≡ explicit false, byte-identical canonical results); FATAL reason codes checked against frozen contracts-v1 vocabulary across module boundaries. Plus `t5-complete-true.test.ts` (inside the 75-test `t5-compatibility-bridge` run): complete:true persona ⇒ status `BLOCKED_FATAL`, outcome `FATAL`, exact code `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` (Architecture §13.5/§27.2); **an ack cannot downgrade the FATAL** (no Continue Anyway) for both persona and ordinary requirements; positive controls (ordinary warning ⇒ `DEGRADED_ACKNOWLEDGED`; all-satisfied ⇒ `OPEN`/`PASS`). | 6/6 + 75/75 green | **PASS** |
| 6 | Blueprint snapshot immutable tests | `t6-6-snapshot-immutability.test.ts` (8): `parseBlueprint` returns deep-frozen blueprint (every mutation attempt ⇒ TypeError); snapshot ref frozen, keyed `blueprintId@revision`, round-trips through contracts key parser; BOM+CRLF normalization and top-level key-order shuffling yield IDENTICAL content hash; revision series ⇒ distinct hashes; `contentHash` is derived — a smuggled source `contentHash` field is rejected with its typed code; composition binds a deep-frozen snapshot ref into the TeamSession record (invariant 10). Plus `t2-blueprint-immutability` (10) + `t2-blueprint-hash` (15). | 8/8 + 10/10 + 15/15 green | **PASS** |
| 7 | fresh_per_delegation semantics encoded as new-instance policy | `t6-7-fresh-per-delegation.test.ts` (6): fresh_per_delegation template ALWAYS resolves `create/fresh_per_delegation` (new MemberInstance + new child Session, Architecture §11.3/§41.4) for any roster size/state mix; contrast with `persistent` default (continues the unique work-accepting instance, creates when none, refuses when several); explicit addressing always continues the addressed instance even under fresh policy (ARCHIVED resolves to itself); 3 sequential delegations ⇒ 3 distinct instances carrying the frozen policy; `contextPolicy` frozen at creation (§21.6) and survives every lifecycle transition; DISPOSED never accepts new work (§29.5). Plus `t3-member-context-policy` (17). | 6/6 + 17/17 green | **PASS** |

**7/7 criteria independently PASS.**

Comparison with the worker's claim (`docs/contracts/g3-report.md`, treated as claim only): my mapping agrees with the report's criterion→file mapping on all 7 criteria and with its counts (79 t6 tests; 492 total). No discrepancy in coverage. (See discrepancy notes for two observations about the report's process narrative.)

## Discrepancy / observation notes

1. **Provenance manifest data gap (Step A.3)** — `dev/agent-workflow/evidence/provenance/file-manifest.json` contains no hash entries for the four frozen 20260829 docs (it is a 470-file legacy-fork diff classification with `baseline` + `files[path,status,classification,disposition,reason,mixed_hunks]` only). The brief's specified hash cross-check therefore could not be executed against this manifest; observed SHA-256 values of the four docs are recorded in A.3 for later cross-checking. Corroboration (verbatim §16.4 + G3 gate-method match, in-tree citations consistent, untracked-only-in-main-worktree state) makes tampering implausible, but I cannot fully attest doc integrity against the original snapshot. **Non-blocking; minor.**
2. **Worker's canonical attempt 1 failed (disclosed in g3-report.md)** — attempt 1 failed at leg 3 with 15 type errors, all fixed test-side (no `packages/contracts/**` modification, no CONTRACT_CHANGE_REQUEST); attempt 2 (final state) passed all six legs. My independent re-run of the final state is green (492/492 + tsc 4/4). **Non-blocking; noted for the record.**
3. **Style note on "property tests"** — the t6 "property" suites are deterministic exhaustive sweeps / closed-cube checks (N-sweep {1..8,12}, all-25-pairs matrix, 5×5 op×state sweep, type×mode×availability cube) with PRNG-seeded helpers in places, not a randomized property-based testing library. This satisfies the frozen TaskDoc must-tests ("cross-module property tests; serialization round-trip; negative matrix") and the §16.4 wording as encoded; noting only for the record. **Non-blocking.**
4. Minor: g3-report.md says the t6-9 header count was corrected "29" → "31" post-fix — a docstring-only correction, consistent with the final green run (t6-9: 12 tests pass). **Non-blocking.**

## Red-line check summary (AGENTS.md 红线)

| Red line | Check | Result |
| --- | --- | --- |
| No upstream source modification / private-API use / patch-package / postinstall rewrite / git-apply patch / vendored modified upstream | C.1: 144-file Phase diff scoped to packages/docs/dev-agent-workflow + authorized pnpm-lock.yaml; no postinstall anywhere; no patch-package dep; only `patches` dir is the P1 synthetic verifier fixture (untouched in Phase range); no references/ paths; C.2: zero private/builtin/out-of-workspace imports | **CLEAR** |
| No legacy Team SessionEvent vocabulary as vNext authority | D.6: exactly the 5 legacy names exist as detection-only constants with a rejecting assert; vNext defines no team session event names; invariant 42 honored | **CLEAR** |
| No legacy history rewrite / frozen branch movement | Phase range is linear on `int/P3-contracts-domain` from a master SHA; no rewrites observed in the 21-commit range (cherry-pick `-x` footers present on integrated task commits); `feat/team-vnext-integration-20260829` not touched | **CLEAR** |
| No push / force / tags by reviewer | I performed no push, no force, no tags; only a single evidence commit on my detached head | **CLEAR** |
| No impact on stable instance (:3080, D:\deepseek-harness\) | No DSH instance started/stopped by me; all commands ran inside the worktree; nothing touched :3080 or the stable deployment | **CLEAR** |
| No sandbox escalation | No `sandbox_permissions` used; every command ran in the default workspace-write sandbox | **CLEAR** |
| Reviewer writes confined to evidence dir (+ node_modules) | My only source-tree writes: this file under `dev/agent-workflow/evidence/G3-REVIEW/reviewer-2/` (plus transient root scratch files, removed before commit) and `node_modules` from the sanctioned install | **CLEAR** |

## Final verdict

All 7 criteria of Development Plan §16.4 independently PASS (each covered by tests I read and re-ran green: 492/492, exit 0; tsc 4/4, exit 0). Steps A–D clean, with one data gap in the provenance manifest (no frozen-doc hash entries to cross-check against — observed hashes recorded instead) and three further minor, non-blocking observations (worker's disclosed test-side fix after attempt 1; property-suite style note; docstring count correction). No red-line, zero-core, private-import, or owned-boundary violation found.

Per the four-verdict contract: all 7 criteria PASS, but I carry a minor non-blocking observation that I could not complete the specified frozen-doc hash cross-check against the provenance manifest as written (integrity of the frozen docs is corroborated but not hash-attested against the original snapshot).

**Verdict: 投机通过**
