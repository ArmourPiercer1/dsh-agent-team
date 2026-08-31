# G7 Blind-Review Brief (shared by reviewers 1–3; per-reviewer id = N)

> Round R49. Gate G7-REVIEW for phase P7 (int/P7-advanced-semantics @ `298d6364d2ebcb03eff0073c352e2174b0fd433f`).
> Three fresh independent blind reviewers, each dispatched as a workflow leaf (provider `qiyuan-self`, model `qwen3.8-27b`).
> A reviewer sees ONLY this brief (with their N substituted). No main-agent findings, no worker reports, no prior-round context.

## §0 MANDATORY FIRST STEP

Read in YOUR worktree: `docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md` (complete; both). Protocol docs are allowed reading. Anything else in `dev/agent-workflow/` is FORBIDDEN to read (see §1).

## §1 BLINDNESS RULE (strict)

You are a blind gate reviewer. Your information sources are EXACTLY:

- the frozen docs in `docs/plans/active/` (verify their sha256, §3);
- `docs/ROUTER_RULES.md`, `docs/TEST_METHODS.md`;
- the implementation + tests at the integration SHA (the code under `packages/`);
- `docs/migration/` (legacy inventory/reference);
- `references/deepseek-harness/` (frozen legacy fork, READ-ONLY) if you need to check legacy on-disk formats;
- your own test runs, harness runs, and scans (your evidence).

FORBIDDEN to open or grep: anything under `dev/agent-workflow/` (worker evidence incl. any g7-report.md / design-note.md, briefs, SESSION_ROUTER_LOG.md, graph.yaml — they contain worker self-reports and main-agent context). The ONLY exception: WRITING your own report into `dev/agent-workflow/evidence/G7-REVIEW/reviewer-N/` in your own worktree.

## §2 Your identity & environment

- You are reviewer **N** of gate G7 (N ∈ {1,2,3}).
- Repo: `D:\AgentDev\dsh-plugins\dsh-agent-team`. The main worktree (on `master`) is NOT yours — never write there.
- Create your review worktree (DETACHED, no branch):

  ```
  git -C D:\AgentDev\dsh-plugins\dsh-agent-team worktree add --detach .worktrees/G7-RN 298d6364d2ebcb03eff0073c352e2174b0fd433f
  ```

  (replace RN with your N, e.g. `G7-R1`).
- Verify: `git rev-parse HEAD` == `298d6364d2ebcb03eff0073c352e2174b0fd433f`. If not, STOP and report.
- You are the only writer on your worktree. NEVER modify any tracked file anywhere. Your only writes: your worktree (including node_modules via install) + your own evidence dir `dev/agent-workflow/evidence/G7-REVIEW/reviewer-N/`.
- NO push. NO force-push. Never touch other worktrees, `master`, `int/P7-advanced-semantics`, `references/deepseek-harness` (read-only), the stable deployment `D:\deepseek-harness\`, or the :3080 instance.

## §3 Frozen documents (verify hashes before relying on them)

- Architecture `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53`
- UI `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e`
- Development Plan `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f`
- Task Decomposition `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3`

Gate entry to read (method step 2): Development Plan §20.7 "Gate G7" (the nine criteria) and Task Decomposition §11.8 (P7 task cards T1–T7 + "G7 Gate 执行方法").

## §4 Review method (TaskDoc 11.8 six steps — execute all)

1. **Checkout** — done at worktree creation (§2); re-verify HEAD.
2. **Read the gate entry** — §3 above; hash-verify the frozen docs.
3. **Rerun key positive + negative tests** (in YOUR worktree, serial, with proof headers `git rev-parse --show-toplevel` + `git rev-parse HEAD` in every log):
   - `pnpm install --ignore-scripts`
   - `node scripts/run-tests.mjs` (all 9 packages) — record the exact totals; expect 0 failures.
   - tsc ×5 with SEPARATE args: `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` for contracts, domain, storage, runtime, testkit.
   - Pay particular attention to the P7 suites: `p7t1-*`, `p7t2-*`, `p7t3-*`, `p7t4-*`, `p7t5-*`, `p7t6-*`, `p7t7-*` (positive AND negative tests) and the p4t6 scanner suite.
   - Log → your evidence dir `chain-rerun.log`.
4. **Zero-core / private-import / owned-boundary checks** (log → your evidence dir `boundary-checks.log`):
   - **zero-core**: no `node:` builtin imports in any `.ts` under `packages/` (`.mjs`/`.cjs` harness scripts excluded by rule); no `patch-package`/`pnpm patch`/postinstall mutation of upstream (check package.json scripts + lockfile diff vs `673260198e2f90474678087fa7518bdd241403b8`); no import of anything under `references/deepseek-harness-test-use` (upstream) from `packages/*` (private/internal API ban).
   - **private-import**: grep `packages/**/*.ts` for imports referencing upstream internals or the frozen legacy fork; expect none.
   - **owned-boundary**: `git diff --name-only 673260198e2f90474678087fa7518bdd241403b8..HEAD -- packages/` — every added/modified file must fall inside a P7 task's owned glob (TaskDoc §11.8 cards): T1 `packages/runtime/compatibility/**`; T2 `packages/runtime/mutation*` + policy adapters; T3 `packages/runtime/lifecycle*`; T4 `packages/runtime/fork*` + persistence reconciliation; T5 `packages/runtime/handoff*`; T6 `packages/legacy/teammates-adapter*`; T7 `packages/legacy/session-reader*` (incl. its TEST-ONLY e2e/). Plus the DEC-1 standing exception: `packages/testkit/test/p4t6-session-event-scan.test.ts` (count maintenance). Any file outside → record it as an owned-boundary violation (→ 阻塞).
5. **Cross-task invariant combination review** (log your findings into the report): read the P7 module sources (compatibility, mutation, lifecycle, fork-reconciliation, handoff, policy-adapter, session-reader) as a SYSTEM and verify the nine criteria hold in combination, not just per module. At minimum examine:
   - admission (compatibility) consumes the effective-configuration/provenance that mutation produces — override precedence visible at the admission boundary;
   - lifecycle quiescence + admission interaction (close admission → drain → quiesce → commit; new work blocked while drift warning unacked);
   - fork-reconciliation and handoff do not bypass policy/admission;
   - session-reader is read-only BY CONSTRUCTION (inspect its port interface and every call site: no write surface exists; the e2e/ harness is test-only and writes only under DSH_HOME).
6. **Criterion → evidence → PASS/FAIL** for all nine §3 criteria, each with YOUR disk evidence (your chain log lines, your scan results, file+scenario references you verified yourself).

## §5 Real-instance E2E rerun (harness, SERIALIZED via lockfile)

After §4.3 is green, rerun the P7-T7 e2e harness (it exercises G7 criterion 9 end-to-end on a real pristine test-use DSH boot):

- **Lockfile protocol (MANDATORY — three reviewers share one DSH_HOME)**: the harness hardcodes `DSH_HOME = <main repo>/references/.dsh-test-p7t7` and a boot port; mini-MCP auto-selects the first free of 3491–3495. To prevent cross-reviewer stomping, wrap YOUR harness run with a lock:

  ```powershell
  $lock = 'D:\AgentDev\dsh-plugins\dsh-agent-team\references\.dsh-test-p7t7.lock'
  for ($i = 0; $i -lt 75; $i++) {
    if (-not (Test-Path $lock)) { break }
    $age = (Get-Date) - (Get-Item $lock).LastWriteTime
    if ($age.TotalMinutes -ge 10) { Remove-Item $lock -Force; break }
    Start-Sleep -Seconds 20
  }
  "G7-RN " + (Get-Date).ToString('o') | Set-Content -Path $lock -Encoding ASCII
  ```

  (75 × 20 s = 25 min budget, including one extra 10-min cycle; RN = your id. If you still cannot acquire after the loop: do NOT force-remove a fresh lock — record `e2e: NOT-RUN(LOCK-TIMEOUT)`, skip §5, and continue with in-process evidence; the main agent adjudicates.)

- **Run** (from YOUR worktree root, after `pnpm install`):

  ```
  node packages/legacy/session-reader/e2e/run.mjs --report-dir dev/agent-workflow/evidence/G7-REVIEW/reviewer-N/harness-output --port 318<N>
  ```

  (reviewer 1 → `--port 3180`, reviewer 2 → `--port 3181`, reviewer 3 → `--port 3182`. The harness itself does :3080 health + test-use pristine checks before/after; still independently re-verify test-use pristine afterwards: HEAD `cd5ef8148158c3a752a658978873241fdf8e2bbc`, `git status --porcelain` empty.)

- **Finally** (always): if the lock file content starts with your id, delete it:

  ```powershell
  if ((Get-Content $lock -ErrorAction SilentlyContinue) -like 'G7-RN*') { Remove-Item $lock -Force }
  ```

- Expect scenarios L1/L2/L3 PASS (record the summary.json). A harness FAILURE is a finding (criterion 9 → not PASS); a harness that cannot run (env) is recorded as NOT-RUN with the reason — judge criterion 9 on your in-process evidence (p7t7-legacy-read + p7t7-mutation-reject suites) and state in your verdict whether the missing e2e rerun affects your confidence (that is the difference between 通过 and 投机通过).

## §6 Verdict (exactly one of the four)

- **通过** — all nine criteria PASS on your own disk evidence; no blocking concerns.
- **投机通过** — all nine criteria PASS, but with documented minor non-blocking concerns (e.g., a judgment call you accept after independent analysis, or an e2e rerun you could not complete for environmental reasons with in-process evidence covering the criterion).
- **补充内容** — at least one criterion lacks sufficient evidence or has a defect fixable without new design; state EXACTLY what must be added/fixed.
- **阻塞** — frozen-spec violation, zero-core/private-import violation, owned-boundary violation, or failing test you observed; state the blocker in the fixed format `BLOCKER:<TYPE>:<detail>`.

## §7 Deliverables

- Your evidence dir (in YOUR worktree): `dev/agent-workflow/evidence/G7-REVIEW/reviewer-N/` containing: `report.md` (full reasoning: per-criterion evidence tables, boundary-check results, cross-task invariant analysis, concerns), `chain-rerun.log`, `boundary-checks.log`, `harness-output/` (if e2e ran).
- Your LAST message must be exactly:

  ```
  G7RN_VERDICT
  verdict: 通过 | 投机通过 | 补充内容 | 阻塞
  chain: <passed>/<total> (failures <n>) | tsc: contracts=<x> domain=<x> storage=<x> runtime=<x> testkit=<x>
  e2e: PASS | FAIL | NOT-RUN(<reason>) — scenarios <L1/L2/L3 results>
  criterion-1 warning/fatal admission: PASS|FAIL — <one-line evidence>
  criterion-2 ack fingerprint invalidation: PASS|FAIL — <one-line evidence>
  criterion-3 human override precedence: PASS|FAIL — <one-line evidence>
  criterion-4 lifecycle quiescence: PASS|FAIL — <one-line evidence>
  criterion-5 restore no agent: PASS|FAIL — <one-line evidence>
  criterion-6 root fork: PASS|FAIL — <one-line evidence>
  criterion-7 member fork: PASS|FAIL — <one-line evidence>
  criterion-8 handoff one-shot: PASS|FAIL — <one-line evidence>
  criterion-9 legacy no mutate/resume: PASS|FAIL — <one-line evidence>
  zero-core: PASS|FAIL | private-import: PASS|FAIL | owned-boundary: PASS|FAIL
  concerns: <none | list>
  blocker: <none | BLOCKER:TYPE:detail>
  ```

- Do not leave the harness running; delete your lock only if you own it; ports must be released (the harness does this in its own finally — verify).
