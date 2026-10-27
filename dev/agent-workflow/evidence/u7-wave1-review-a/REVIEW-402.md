# Independent adversarial review — PR #402

**Verdict: BLOCKED. Merge recommendation: DO NOT MERGE.**

Reviewed head `905bc71b35d8a692bf921ad850c72b5db0748f87`, base `origin/master` `0ea67bee8`. Reviewer did not implement this PR. Reviewed first, before #404. Fetched origin; detached review worktree `.worktrees/rv-402`; reports branch created off origin/master in `.worktrees/rv-wave1-a`. Read ROUTER_RULES §0, AGENTS, execution-plan U7/S5, TEST_METHODS and u7-w0b DESIGN before examination. No Host boot, no :3080 access, no ~/.dsh access.

## Findings

1. **HIGH / blocker — declared process-spawn is absent from the pwsh PA request.** [Contribution:179–187](<https://github.com/ArmourPiercer1/dsh-agent-team/blob/905bc71b35d8a692bf921ad850c72b5db0748f87/packages/tools/process-family/src/bash-contribution.mjs#L179-L187>) declares `kinds: ['tool-invoke', 'process-spawn']`; [executor:97–99](<https://github.com/ArmourPiercer1/dsh-agent-team/blob/905bc71b35d8a692bf921ad850c72b5db0748f87/packages/tools/process-family/src/pwsh-executor.mjs#L97-L99>) constructs only `{ kind:'tool-invoke', toolName:'pwsh', resource:null }`. This fails the explicitly required declared=requested law, regardless of opaque shell-command semantics or whether this declaration was inherited from bash. The suite even separately pins those inconsistent expectations. Reconcile the contribution/request grammar and enforce coverage against the real contribution per row.
2. **HIGH / delivery blocker — positive live PowerShell execution is not delivered.** `command -v pwsh` returned exit 1. The committed third-run evidence records `refused-denied pwsh-executable-not-found`, not PowerShell execution. Current PR prose honestly discloses this, but the quoted `overall=PASS cases=6 PASS:6` cannot be read as six delivered product arms. Moreover, the committed C2 JSONs are custom evidence payloads, not the required finished run records: none has `overall`, `finishedAt`, or `bindings.authority`. Commit the actual authoritative run record and retain a DISCLOSED/ENV_BLOCK positive cell; obtain lawful real-positive evidence before claiming product delivery.
3. **MEDIUM — purported mutation controls are green mutant-behavior demonstrations, not red runs.** Test M1 expects wrong argv, M2 expects `false`, M3 expects acceptance. I independently planted M1 into the real module and the actual golden vector did go RED, so the golden is sensitive; however the PR's green M-controls alone are not RED receipts.
4. **LOW — unrelated observer timeout repair is mislabeled.** [Sanitizer test:224–244](<https://github.com/ArmourPiercer1/dsh-agent-team/blob/905bc71b35d8a692bf921ad850c72b5db0748f87/packages/testkit/test/rc2-sanitize-evidence.test.ts#L224-L244>) says the parent is raised to the child's 60s bound, but changes it to 120s. This is not a booking and affects this test for everyone. Assertions remain intact; not a security relaxation, but separate it or correct the justification.

## Universal checks — commands and verbatim tails

### 1. Zero plane / zero protected center — VERIFIED

`git diff --name-only origin/master...HEAD`; Node intersection with all `files[].path` in the protected-center ledger and the three seam files:

```text
402 protected=33 hits=0
FILES 49
[]
```

No plane, assembly, binder or protected path changed. Generated dist mirrors are outside the narrow lane but not protected center changes.

### 2. Declared=requested — FALSE

Direct source comparison above is decisive. Mutation: replace executor's sole requested invoke arm with `[]`; run `pnpm exec vitest run packages/runtime/test/u7f-pwsh-row-c1.test.ts`:

```text
Test Files  1 failed (1)
Tests  14 failed | 35 passed (49)
AssertionError: expected 'refused' to be 'ok'
[exit code: 1]
```

This does prove sensitivity to removing the only existing requested arm (empty-set schema refusal), **not** coverage of the already missing process-spawn arm. Restored immediately.

### 3. Typed default-deny / zero refusal effect — VERIFIED for tested offline arms; complete delivery claim FALSE

`pnpm exec vitest run packages/runtime/test/u7f-pwsh-row-c1.test.ts packages/domain/test/a5p0-layer-audit.test.ts`:

```text
✓ packages/domain/test/a5p0-layer-audit.test.ts (4 tests)
✓ packages/runtime/test/u7f-pwsh-row-c1.test.ts (49 tests)
Test Files  2 passed (2)
Tests  53 passed (53)
```

Inspected assertions: lane denial, pwsh deny/default-deny belt, bash-only allow, invalid params, absent PA, PA deny, cancelled/replayed token, missing executable, escaping cwd, probe refusal and missing Landlock ABI test typed outcomes with untouched PA/backend/provider counters where applicable. A provider spawn refusal is not itself proof that a spawn was never attempted: the early missing-ABI and cwd cases provide that proof. Config false builds no real backend, wins over kit injection and answers the shut face. The suite tests descriptor config shape; full mounted false/wrong-type integration is not independently exercised here.

### 4. No authority reach — VERIFIED (static seam + tested guard)

Inspected descriptor `build(cap)`/`backends(cap)` and searched new code for `kernel|registry|approval|grant`. Matches are explanatory prose, declared data and provider request identifiers, not kernel/registry/approval/grant handles. Shared seam returns `Object.freeze(out)` and rejects forbidden capability keys. No alternate authority object added. Domain-layer audit 4/4 above. `node scripts/eb3-family-boundaries.mjs`:

```text
EB3-FAMILY-BOUNDARIES pass files=37 findings=0
```

### 5. Real planted-bug control — VERIFIED independently

Replaced argv preamble concatenation with command alone; ran `pnpm exec vitest run packages/runtime/test/u7f-pwsh-row-c1.test.ts -t 'request builder'`:

```text
FAIL ... the request builder: closed key set, exit-passthrough ON, and EVERY command rides -Command verbatim
Expected: "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false); Get-ChildItem"
Received: "Get-ChildItem"
Tests  1 failed | 48 skipped (49)
[exit code: 1]
```

Restored. Full 49/49 GREEN again. `git status --porcelain` returned empty.

### 6. All out-of-lane edits — VERIFIED classification, no global guard relaxation found

Complete inventory outside the user-permitted lane/drop-ins/evidence (relative to PR root):

```text
dev/agent-workflow/ledgers/arc-a-family-census.json
packages/domain/test/a5p0-layer-audit.test.ts
packages/runtime/dist/packages/tools/families/manifest.json
packages/runtime/dist/packages/tools/families/process.mjs
packages/runtime/dist/packages/tools/process-family/src/bash-contribution.mjs
packages/runtime/dist/packages/tools/process-family/src/index.mjs
packages/runtime/dist/packages/tools/process-family/src/pwsh-confined.mjs
packages/runtime/dist/packages/tools/process-family/src/pwsh-executor.mjs
packages/runtime/dist/packages/tools/process-family/src/pwsh-mechanics.mjs
packages/runtime/dist/packages/tools/process-family/src/pwsh-row.mjs
packages/runtime/test/a5-m1-unsupported-c1.test.ts
packages/runtime/test/a5g6-install-face-render.test.ts
packages/runtime/test/a5p4-lane-hygiene.test.ts
packages/runtime/test/alpha5-g1-deny-lane.test.ts
packages/runtime/test/u6-pr3-kernel-flow.test.ts
packages/runtime/test/u7f-pwsh-row-c1.test.ts
packages/testkit/test/rc2-sanitize-evidence.test.ts
scripts/audit-a5-tool-governance-imports.mjs
scripts/eb3-family-boundaries.mjs
tests/world-factory/lib/u7-pwsh-assembly.mjs
tests/world-factory/registries.test.mjs
```

Census: existing process-family row/native-name booking only. Import audit + domain audit: one exact executor-file consumer booking, no global exemption. EB3: adds process lane domain-governance edge only; existing sibling edge remains exactly fs-family public `src/index.mjs`, not wildcard sibling internals. Runtime tests: exact expected mounted-name updates, one precise named-provider mount booking, two-row contribution fixtures; all retain closed-list assertions. New C1 test is coverage. Dist files are feature mirrors. World assembly is lane-specific test support. World registries extend exact lists and replace newly shipped negative names with ghost names, retaining negative assertions. Sanitizer is the unrelated test timeout extension in finding 4, not a booking.

### 7. C2 honesty — FALSE / incomplete evidence

`gh pr view 402 --json title,body,url` and read committed third-run JSON, then parsed all committed C2 JSONs for the three required fields. Verbatim relevant evidence:

```text
"text": "refused-denied pwsh-executable-not-found — no pwsh executable exists at /usr/bin/pwsh, /usr/local/bin/pwsh, /opt/microsoft/powershell/7/pwsh — refused before probe and before spawn (the row never fabricates an unavailable shell)"
PWSH_LOOKUP_EXIT=1
```

Each custom run evidence object has all three required fields **absent**. PR body now explicitly says `DISCLOSED — NOT DELIVERABLE on this Linux host`; credit the honesty, not the positive delivery. ENV reason above is quoted verbatim. No non-PASS treated as delivered in this review.

### 8. Hosted current-head checks — pending final observation

`gh pr view 402 --json headRefOid,statusCheckRollup` after bounded sleep-based wait (2026-10-27T06:50:48Z):

```text
head: 905bc71b35d8a692bf921ad850c72b5db0748f87
candidate-protection COMPLETED SUCCESS
census-runtime COMPLETED SUCCESS
synthesize-merge-tree COMPLETED SUCCESS
pr-gate COMPLETED SUCCESS
ci-fast / ci-fast COMPLETED SUCCESS
ci-integration / ci-integration COMPLETED SUCCESS
ci-security / ci-security COMPLETED SUCCESS
ci-full / ci-full COMPLETED SUCCESS
ci-required COMPLETED SUCCESS
```

**VERIFIED hosted green on reviewed current head.** This does not override the security/delivery blockers.

## Pwsh-specific judgment

- **Confined law VERIFIED offline:** backend imports the existing `createConfinedProcessProvider` and shared `raceShellSettle`, `shellCancelled`, `drainShellStdio`; does not reimplement Landlock/byte-pin/lease/terminate. It does have a separate pwsh orchestration backend; shared provider/mechanics are genuinely reused. Cwd/ABI refusals occur before fake spawn and counters prove it.
- **Config law VERIFIED statically/unit-level:** closed boolean `pwshEnabled`; absent => true; false => typed shut backend, no real backend creation. Full mount false/invalid-type proof remains a verification limit noted above.
- **Golden fidelity VERIFIED recording, not live comparison:** 20 vectors compare implementation to digest-pinned copied constants; test does not read host source. Independently read pinned host pwsh-local source at 639ed015397290b3745d163aafe02ffee4aa3f84: argv flags and preamble match. Host ENV_OVERRIDES has NO_COLOR/PAGER/GIT_PAGER; lane additionally closes PATH, a disclosed deviation. This is more than a table derived from its own exports, but not an automatic host-drift gate.
- **Exit fidelity VERIFIED offline only:** request has exitPassthrough true; scripted real-provider pipeline preserves nonzero code and timeout/abort not-observed null. No actual PowerShell exit measured.

## COULD-NOT-VERIFY

No live re-execution authorized (never booted Host). Real PowerShell positive unavailable. Required authoritative finished C2 run record not committed. No complete full-suite rerun performed; focused security suite, audit and boundary checks only. A hosted green would not close the declared/requested or delivery findings.
