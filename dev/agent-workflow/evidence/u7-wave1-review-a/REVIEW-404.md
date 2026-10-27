# Independent adversarial review — PR #404

**Verdict: BLOCKED. Merge recommendation: DO NOT MERGE.**

Reviewed after #402, initially `2079dc487355a4118928dc628f4d1a38b6f6b604`; refreshed through `e125ddac8293ac16d90d06692758806f5f2306a0` to current head `292558f700c3d4ccdde7b0c4c8d31ad17ac5eac7`. First increment is comment-only plus its dist mirror; reran 25 C1 tests there. Final increment is three evidence/docs files only (gate runs 6/7 and PR body); read incremental diff, no product changes. Base `origin/master` `0ea67bee8`. Detached worktree `.worktrees/rv-404`. Reviewer did not implement this PR. Read required repository instructions, U7/S5 and FamilyAssembly design. No Host boot; never touched :3080 or ~/.dsh.

## Findings

1. **HIGH / blocker — skill loader can read outside sanctioned roots through a check/use symlink swap.** [Skill executor:182–189](<https://github.com/ArmourPiercer1/dsh-agent-team/blob/e125ddac8293ac16d90d06692758806f5f2306a0/packages/tools/inspect-family/src/skill-executor.mjs#L182-L189>) resolves a pathname, awaits `lstat`, then opens that pathname through `readFile`. There is no fd-pinned open, O_NOFOLLOW or equivalent identity/containment proof at use time. Deterministically reproduced by replacing SKILL.md with a symlink to an outside instruction file immediately after `lstat` obtains the original stat. Real executor returned `kind:'ok'`, `content:'OUTSIDE-SECRET'`. This is an actual root escape, not merely a missing test. Read from an identity-pinned bounded fd and handle parent-directory replacement too; regression must refuse with zero outside bytes read.
2. **HIGH / blocker — requested-effect completeness is untested, and the declared=requested law fails per row.** [Contribution:110–118](<https://github.com/ArmourPiercer1/dsh-agent-team/blob/e125ddac8293ac16d90d06692758806f5f2306a0/packages/tools/inspect-family/src/inspect-family-contribution.mjs#L110-L118>) declares read+meta for the family. Skill requests read but no meta; list/query request meta but no read. All three additionally request tool-invoke, absent from declaration. Under the explicit review law a family-wide union cannot silently substitute for row-level effect contracts. More concretely, I removed the query's method-specific meta effect while retaining the directory meta arm: **all 25 C1 tests stayed GREEN**. An approval would then fail to bind the selected method resource. Add exact per-row effect-set assertions tied to contribution contracts and RED controls for every meaningful arm, not just an allowed-kind whitelist.
3. **HIGH / delivery blocker — current-head positive live/approval paths remain unproven.** The committed C2 record contains FAIL for skill-load, inspect-list and approval-leg. PR prose correctly discloses the failures and subsequent alias/correlation fixes, but does not rerun live after them. The committed record also lacks `overall`, `finishedAt`, `bindings.authority`, so even its PASS cells do not meet the requested authoritative-run-record standard. Do not count DISCLOSED as product delivery.
4. **MEDIUM — schema validator claims fail-closed but silently ignores constraints.** [Validator:69–116](<https://github.com/ArmourPiercer1/dsh-agent-team/blob/e125ddac8293ac16d90d06692758806f5f2306a0/packages/tools/inspect-family/src/inspect-mechanics.mjs#L69-L116>) never rejects unsupported keyword names. `validateInputSubset({type:'string',pattern:'^safe$'}, 'evil')` and `validateInputSubset({oneOf:[{const:'safe'}]}, 'evil')` both return `[]`. Several branches return before checking sibling constraints. Query also skips validation entirely when input is omitted. The host may independently reject, but the PR's claimed pre-dispatch rejection of unverifiable/invalid input is false. No evidence this grants mutation authority; it is an admission/contract correctness gap.
5. **MEDIUM — zero-effect refusal claims overstate the measurement.** Skill tests S2/S3/S4/S8 mostly check error text or PA counts, not actual read counters. Inspect query calls `svc.list()` before default-deny/PA ([executor:163–184](<https://github.com/ArmourPiercer1/dsh-agent-team/blob/e125ddac8293ac16d90d06692758806f5f2306a0/packages/tools/inspect-family/src/inspect-executor.mjs#L163-L184>)); unknown-provider refusal therefore performs a registry metadata read. Calling that zero *query dispatch* is fair, zero *effect* including declared meta is not. Skill frontmatter/name/model-invocation refusals necessarily read first. Explicitly distinguish pre-effect refusal from post-read refusal and instrument the fake port/file read surface.

## Universal checks — evidence

### 1. Zero plane / zero center — VERIFIED

Fetched origin and used `git diff origin/master...HEAD`. Intersected changed paths with every protected ledger entry plus the plane, assembly and binder:

```text
404 protected=33 hits=0
```

No protected or seam source changed. Refreshed head adds only comment changes in inspect executor and its mirror.

### 2. Declared=requested and mutation sensitivity — FALSE

Source sets detailed in finding 2. Mutation: remove exactly the method meta arm in inspect query, then run `pnpm exec vitest run packages/runtime/test/u7f-inspect-family-c1.test.ts`:

```text
✓ packages/runtime/test/u7f-inspect-family-c1.test.ts (25 tests) 1825ms
Test Files  1 passed (1)
Tests  25 passed (25)
```

Restored exactly; review worktree status clean. The remaining directory arm kept a nonempty valid requested set, so this is not the trivial empty-set rejection control. I9 only whitelists kinds and I10 checks mounted invoke spellings; neither detects the omitted resource.

### 3. Default-deny / typed refusal / zero effect — FALSE as a universal proof

Baseline and refreshed-head command `pnpm exec vitest run packages/runtime/test/u7f-inspect-family-c1.test.ts`:

```text
✓ packages/runtime/test/u7f-inspect-family-c1.test.ts (25 tests) 2822ms
Test Files  1 passed (1)
Tests  25 passed (25)
```

Typed grammar/unknown/provider/method/schema/unmounted/cancel/timeout refusal assertions do execute. Unknown provider/method lists actual alternatives and measures zero query dispatch. No default-deny fixture exists in this suite, despite implementation default-deny branches. Filesystem read counters are absent. Static symlink escape test checks withheld secret text, not zero reads. Finding 1 proves a dynamic escape. Therefore do not infer the universal requested proof from the 25 green cases.

### 4. No authority reach — VERIFIED within inspected seam

Searched lane for `kernel|registry|approval|grant`; matches are comments, contribution data and the public cordisInspect service, not governance authority handles. Descriptor gets `cap`, destructures injected `pa`/`decide`/hostService, and never receives a kernel, approval table or grant mutator. Shared capability constructor freezes its closed object and rejects forbidden keys.

`pnpm exec vitest run packages/runtime/test/u7-w0b-family-seam.test.ts packages/domain/test/a5p0-layer-audit.test.ts`:

```text
✓ packages/domain/test/a5p0-layer-audit.test.ts (4 tests)
✓ packages/runtime/test/u7-w0b-family-seam.test.ts (9 tests)
Test Files  2 passed (2)
Tests  13 passed (13)
```

`node scripts/eb3-family-boundaries.mjs`:

```text
EB3-FAMILY-BOUNDARIES pass files=42 findings=0
```

### 5. Real planted-bug control — VERIFIED independently, but effect omission control FALSE

PR X1/X2 test mutant behavior with success assertions (not failing child test receipts). I planted its X2 late-await change into the real executor and reran the actual I5 timeout vector:

```text
FAIL ... I5 timeout leg: typed refusal at the bound, and the LATE value is NEVER delivered
Error: Test timed out in 5000ms.
Tests  1 failed | 24 skipped (25)
[exit code: 1]
```

The vector releases its fake only after receiving the final refusal; the mutant waits for that fake and thus hangs, correctly RED. Restored. I6 independently drives pending fake query, aborts caller signal, checks typed `call-aborted`, downstream aborted, then resolves `{LATE:true}` and observes no late value. This pending-cancel/no-late-result check is genuinely executed, not prose.

### 6. Every edit outside lane/drop-ins/evidence — VERIFIED classification

Complete inventory:

```text
dev/agent-workflow/ledgers/arc-a-family-census.json
packages/domain/test/a5p0-layer-audit.test.ts
packages/runtime/dist/packages/tools/families/index.mjs
packages/runtime/dist/packages/tools/families/inspect.mjs
packages/runtime/dist/packages/tools/families/manifest.json
packages/runtime/dist/packages/tools/inspect-family/src/index.mjs
packages/runtime/dist/packages/tools/inspect-family/src/inspect-executor.mjs
packages/runtime/dist/packages/tools/inspect-family/src/inspect-family-contribution.mjs
packages/runtime/dist/packages/tools/inspect-family/src/inspect-mechanics.mjs
packages/runtime/dist/packages/tools/inspect-family/src/inspect-rows.mjs
packages/runtime/dist/packages/tools/inspect-family/src/row-names.mjs
packages/runtime/dist/packages/tools/inspect-family/src/skill-executor.mjs
packages/runtime/dist/packages/tools/inspect-family/src/skill-mechanics.mjs
packages/runtime/dist/packages/tools/inspect-family/src/skill-row.mjs
packages/runtime/test/u7-w0b-family-seam.test.ts
packages/runtime/test/u7f-inspect-family-c1.test.ts
scripts/audit-a5-tool-governance-imports.mjs
scripts/eb3-family-boundaries.mjs
tests/checks/eslint-node-globals.test.mjs
```

Census books exactly this family; import-audit/domain-audit book two exact executor files, retain the existing scanner; seam test count 3→4 reflects reviewed manifest (does not bypass verification); globals parity adds one lane glob and keeps removed-entry negative controls. Dist files are mirrors. New C1 test is added coverage. EB3 books this lane and only exact fs/search sibling public `src/index.mjs` faces; **no wildcard into sibling internals**. Domain-governance/contracts wildcard faces follow the existing domain convention, not sibling-family internals. No global guard relaxation found. World registry test is unchanged in this PR.

### 7. C2 honesty — FALSE for required run-record completeness; disclosures honestly remain non-delivery

Read PR body and committed C2 verdict record. Verbatim committed cells:

```text
"id": "u7f:skill-load",
"verdict": "FAIL",
"transcriptHasSkillContent": false
"[dsh-agent-team] a7f-skill: governed-skill pa-refused code=TOOL_BINDING_UNVERIFIED"
"id": "u7f:inspect-list",
"verdict": "FAIL",
"transcriptHasProviders": false
"id": "u7f:approval-leg",
"verdict": "FAIL",
"resolveIssues": 0,
"pendingSeenNonEmpty": 0
```

PR's DISCLOSED reason (verbatim excerpt): `identity-gap=no-answer-object … entry-cause=no-placement-name — no admission, no grant, and no Control row is opened on an identity that was never read`. Actual committed error text is in the corpus; custom verdict cells themselves omit full refusal witness. The `c2-verdicts.json` top-level keys are `round, at, boots, verdicts, notes, teardown, mockDigest` — no `overall`, `finishedAt` or `bindings.authority`. PR correctly says a confirming fourth boot was not taken; reviewer did not take it either. Three PASS custom cells are mount, pre-PA unknown-provider/no-query-dispatch, secret not exposed; none establishes successful positive query or skill execution.

### 8. Hosted current-head checks — VERIFIED state, full-green claim FALSE at deadline

Initially queried `2079dc487`; tracked `e125ddac8` (comment/mirror only, C1 rerun) and `292558f70` (evidence-only). Bounded sleep-based monitoring ran from 06:45:50Z through 07:10:45Z (approximately 25 minutes total; a transient GraphQL EOF required resuming the wait). Final `gh pr view 404 --json headRefOid,statusCheckRollup` at 2026-10-27T07:10:45Z:

```text
head: 292558f700c3d4ccdde7b0c4c8d31ad17ac5eac7
candidate-protection COMPLETED SUCCESS
census-runtime COMPLETED SUCCESS
synthesize-merge-tree COMPLETED SUCCESS
pr-gate COMPLETED SUCCESS
ci-fast / ci-fast COMPLETED SUCCESS
ci-integration / ci-integration COMPLETED SUCCESS
ci-security / ci-security COMPLETED SUCCESS
ci-full / ci-full IN_PROGRESS (conclusion empty)
```

Required full workflow [run 40463495314](<https://github.com/ArmourPiercer1/dsh-agent-team/actions/runs/40463495314>) still running. No current-head ci-required aggregator success reported yet. Never substitute previous-head checks or local green for this pending hosted state. Review blockers remain independent of its eventual outcome.

## Inspect-specific judgments

- **READ-ONLY request kinds — VERIFIED:** captured requests for all three rows contain only tool-invoke(null), read(read rights) or meta(meta rights). No mutation kind constructed. This does **not** repair missing effect completeness.
- **Sanctioned roots, traversal, absolute and static symlink refusals — partially VERIFIED; race law FALSE:** grammar prevents path components; static resolver blocks outside symlink. Dynamic check/use escape reproduced below. Existing S2 does not include a literal absolute path, and S3 measures non-disclosure rather than zero-read counter.
- **Bounded query / cancel / no-late result — VERIFIED offline** by I5/I6 and independent X2 mutation RED. Query timeout uses shared public cancel-leg, no new center state machine.
- **Unknown provider/method — VERIFIED:** typed codes include available provider/method names; fake query count zero. Pre-PA listing is nevertheless a metadata read.
- **Mounted-name + exec.tokenKey fixes — no static widening found; live admission unproven:** exact constants `team_skill`, `team_cordis_inspect_list`, `team_cordis_inspect_query`, not wildcard/prefix matching. Correlation is forwarded only from host `exec.tokenKey`, fallback synthetic ID remains fail-closed by host facts. Neither modifies the PA matcher or center admission. Actual successful current-head binding/approval must still be measured; C1 fake PA accepts everything and cannot establish it.
- **New-family placement justification — sound:** sanctioned host skill roots are separate trust input from realm FS anchor, inspect methods are metadata resources with bounded async query/cancel semantics. Public fs anchor/search settle mechanics reused. No reason to force this into fs family; this architectural choice does not excuse the implementation findings.

## Additional schema-validation reproduction

`node --input-type=module` importing the real `validateInputSubset` and invoking the two cases in finding 4 returned verbatim:

```text
UNSUPPORTED_SCHEMA []
ONEOF_SCHEMA []
```

An empty problems array means the lane accepts both unverifiable contracts, contrary to its own fail-closed comment. This observation does not assume the downstream host lacks its own validation.

## Deterministic root-escape reproduction

Created temporary `packages/runtime/test/rv-security.test.ts` in the review worktree, executed once, removed afterward. Vitest mocked only lstat timing, not resolver or readFile. Setup: safe regular `skills/demo/SKILL.md`, outside file declaring same skill name and content OUTSIDE-SECRET. Mock performs real lstat, then swaps path to outside symlink before returning its already obtained stat. This deterministically schedules an ordinary external filesystem race:

```ts
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>()
  return { ...fs, lstat: async (...args: Parameters<typeof fs.lstat>) => {
    const s = await fs.lstat(...args)
    if (String(args[0]) === state.target) {
      rmSync(state.target)
      symlinkSync(state.outside, state.target)
    }
    return s
  } }
})
// real createGovernedSkillExecutor, real roots, decide allow, pa allow:
const out = await run({name:'demo'}, {})
expect(JSON.stringify(out)).not.toContain('OUTSIDE-SECRET')
```

`pnpm exec vitest run packages/runtime/test/rv-security.test.ts` verbatim tail:

```text
RACE-OUTCOME {"kind":"ok","value":{"name":"demo","provider":"filesystem","resourceBase":{"kind":"directory","path":"/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/rv-404/tests/homes/rv-toctou/skills/demo"},"content":"OUTSIDE-SECRET"}}
FAIL ... review: swapping skill after lstat must not read outside sanctioned root
AssertionError: expected '{"kind":"ok","value":{"name":"demo","…' not to contain 'OUTSIDE-SECRET'
Tests  1 failed (1)
[exit code: 1]
```

World deleted in finally. Temporary test removed, every source mutation restored; `git status --porcelain` empty in both PR review worktrees.

## COULD-NOT-VERIFY

Live positives/approval on current head (not authorized to boot); required authoritative finished C2 record absent. No full exhaustive suite rerun. No proof that host schema-validation defense rescues every invalid-input case; the lane validator's fail-closed claim is already false. Additional standalone Node/tsx attempts to drive the TS-dependent query module failed with `ERR_MODULE_NOT_FOUND` / `MODULE_NOT_FOUND` for its source-plane `.js` domain import (Vitest supplies repository resolution); these failures are not counted as behavioral evidence. No measured fd-pinning defense exists in skill loader, and the demonstrated escape is a merge blocker independent of hosted CI.
