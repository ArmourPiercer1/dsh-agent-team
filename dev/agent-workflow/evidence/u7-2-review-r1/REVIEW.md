# U7-2 adversarial review (PR #395)

## Verdict

**BLOCKED**

The required-job checker is not an executable-leg checker. It accepts comments, step names, and arbitrary shell text as proof that a mandatory CI leg runs. A required CI leg can therefore be removed or replaced with a no-op while `eb3-ci-required` still returns PASS. This directly permits the merge gate to hide a regression and fails the U7 EB3-A/B/C/D requirement.

## Findings

### F-1 — BLOCKER — `scripts/eb3-ci-required.mjs:132-136`

`mandatoryLegs` are validated with `stepsText(job).includes(leg)`. `stepsText` concatenates `run`, `with`, and `env` fields, and the check does not distinguish executable shell commands from comments, step names, or arbitrary values. The current workflow itself contains the required token in comments and the step name. Reproduced on the review checkout:

```text
node --input-type=module ...replace actual `node scripts/docs-sync.mjs --check` with `echo docs:sync --check`...
[]
```

The mutated workflow was accepted with zero findings. Thus a mandatory leg can be replaced by a no-op while the shape checker reports PASS. The same weakness applies to the other string-only mandatory legs (`EB3_MERGE_TREE`, `eb3-impact`, `census`, and governance command names). This is not merely a diagnostic weakness: the check is itself a required layer and is advertised as protection against a removed required job/leg.

**Required fix:** parse and validate the actual command invocation (or use explicit, machine-readable step IDs/outputs) and add a negative control that replaces a command with a no-op while retaining the token in comments/name; the enforcement must fail for the right reason.

### F-2 — HIGH — hosted synthetic merge/real runner path is unproven

The local synthetic-tree function is genuinely based on `git merge-tree --write-tree` and `commit-tree`, and the five workflow jobs contain tree equality assertions. However, no hosted GitHub run exists in the evidence; reusable-workflow checkout semantics, the event merge ref, and the real `ci-full` host provisioning remain unverified. The PR honestly discloses this, so this is a release-quality finding rather than the primary blocker.

## VERIFIED

- `node scripts/eb3-ci-negative-controls.mjs`

  ```text
  PASS C1 required-ci-job-removal ... CI_REQUIRED_JOB_ABSENT
  PASS C2 unknown-mcp-tool-injection ... MCP_TOOL_UNKNOWN
  PASS C3 execution-definition-replaced ... 3a detected ... 3b detected ... 3c detected ... 3d detected
  PASS C4 cross-family-influence ... 4a detected, 4b detected, 4c detected
  PASS C5 required-context-nongreen-states ... absent, skip, cancel, failure, ENV_BLOCK, refused, SKIP-token, verdict-missing, unrecognised-result, empty-needs => fail
  PASS P1 ... pinned BY ASSERTION, not by title
  PASS P2 ... zero BY NAMED RETIREMENT ... predecessor's full set of 9
  10/10 control(s) behaved as required
  ```

- Enforcement scripts:

  ```text
  EB3-CI-REQUIRED pass workflows=9 findings=0
  EB3-TRUSTED-SOURCES pass files=1740 findings=0
  EB3-FAMILY-DEFINITIONS pass files=7 findings=0
  EB3-FAMILY-BOUNDARIES pass files=23 findings=0
  EB3-RUN-MANIFEST pass records=40 strict=0 incomplete=11 findings=0
  ```

- Fail-closed grader: synthetic `success` without `verdict` returned `verdict-missing` and exit 1; all-green with `success + verdict=PASS` returned pass. The negative-control suite also exercised absent, skipped, cancelled, failure, ENV_BLOCK, refused, SKIP, missing verdict, neutral, and empty needs.

- Merge-tree synthesis:

  ```text
  EB3-MERGE-TREE tree=b89b513d30c180f3b9c6ce0d707220157a785a79 commit=cde03d8e7ef58bafc25451fb460695136660850c base=94890f090272a336de8a4339b8abf06ecc9f351f head=e95a86ab473d91e744e68110f6910276b603dc37
  ```

  `scripts/eb3-merge-tree.mjs:120-141` invokes `git merge-tree --write-tree` and `git commit-tree`; each layer workflow has `git rev-parse HEAD^{tree}` equality checks (for example `ci-fast.yml:70-84`, similarly integration/security/full). A deliberately divergent checkout was not executable in this local, non-hosted review; the assertion is visibly present in all four layer workflows and the summary synthesis job.

- `pr-gate.yml:237` on the base contains `--allow-refused census`; `.github/workflows/ci-full.yml:162-181` invokes `ci-pr-gate.mjs --full` with no `--allow-refused`.

- No product source changed:

  ```text
  git diff --name-only origin/master...HEAD -- 'packages/**/src/**'  # empty
  ```

- Current regex files contain no non-whitespace control bytes. The C4 control output records `3d detected`, demonstrating the mangled digest-binding regex is now live.

- The 11 incomplete RUN Manifest records are explicitly disclosed as `NOT-A-RESULT` and do not count as green; this is honest but remains a CI evidence-quality gap.

- The PR evidence explicitly discloses that `ci-required` is not yet branch protection and that four stale `dev/engineering/` lines remain outside scope.

## COULD-NOT-VERIFY

- No hosted GitHub Actions run was available, so reusable workflow invocation, actual merge-ref checkout, `ci-full` pristine-host provisioning, and branch-protection enforcement could not be observed.
- No host was booted (per task prohibition).
- The local negative controls do not test replacement of a mandatory command with a no-op while retaining the token in a comment/step name; that missing negative is the source of F-1.

## Recommendation

Do not merge until F-1 is fixed and its own adversarial no-op mutation is RED. Afterward, rerun the complete C4 matrix and obtain at least one hosted `ci-required` run before requiring the context in branch protection.
