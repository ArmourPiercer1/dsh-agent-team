# T12 integration checkpoint checklist (main integrator, T+4.5 ≈ 24:20)

## Lane status (as of 21:37)
- C: COMPLETE. 7f1e0e7 H4 → aa9d856 B4 → eb7f891 M4. Final chain 1120/1120 (t12c-final-chain.log), tsc 0 (t12c-tsc.log), clean, pin folded 546. types.ts untouched.
- B: COMPLETE. 67942ac B1 → 7901b9d B2 → 0edd41c B5 → c4806b8 B6. Final chain 1026/1026 (t12b-final-chain.log), tsc 0 (t12b-tsc.log), clean, pin 545. Additive types.ts: fixtureWorld, TEAM_PLUGIN_CREATE_FAILED, TEAM_PLUGIN_RESUME_STATE_MISSING, TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE, TeamAgentBindings.createRootAgent?, TeamAgentBindings.deliverRootContext?.
- A: IN FLIGHT. Committed: e2c2597 B2, 6e27376 B3, 7dcf9b2 H1, a500a1f M1, 3a7d547 M3 (pin 550). Outstanding: M2 (wiring delivered 21:21), T12-GLUE handoff ports (assigned 21:37, after M2), final chain.
- Cherry-pick order A→B→C stands; B's B6 commit touches root.ts after B1/B2 — pick B's four in order. A's agent-bindings.mjs series must pick as one contiguous span (all in one file).

## Carried flags for the decision doc (non-blocking, from lane reports)
- A: run.mjs legacy child-id constants stale post-B2 (vertical-phase scope); host.ts needs subagents dep wiring (integrator commit, item 5); resolveConsumptionViews().mcpView null when mcpServer:null (consumers treat null = no MCP); seeded members get config.defaultWorkspace (no per-member workspace in boot config).
- B: p7t5-no-creation-scan import pin extended to allow ../../domain/blueprint/ (contracts has no hash primitive; flagged for reviewers); handoff op registry in-memory (pre-existing, §42 invariant 41: TeamDomain is the sole durable boundary); production with-context handoff requires A's T12-GLUE (else explicit pre-durable fail-closed TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE).
- C: frozen register.ts wraps DSH async disposer as sync (pre-existing P2-T6 semantics; row-stop swallows defensively); malformed-connection boot failure reuses TEAM_PLUGIN_SERVICE_MISSING (message disambiguates; types.ts additive list kept empty); facade.remote undefined until bootstrap reaches the mount step (documented).
- Merged p4t6 pin (finalized at integration): 543 + A(7 committed so far + M2/GLUE tests) + B(3) + C(3). B=545 lane-local, C=546 lane-local, A=550 lane-local — take the union of new files from the three diffs and set ONE final value.

Order of operations at T+4.5 (plan §9):
1. For each lane (A: task/T12-lane-a-live-boundary, B: task/T12-lane-b-root-handoff, C: task/T12-lane-c-remote-security):
   - `git log --oneline 7d07330..HEAD` + `git diff --stat 7d07330..HEAD` in `.worktrees/T12-{A,B,C}`.
   - Audit: owned-file scope ⊆ lane brief (A: live/agent-bindings.mjs + types.ts additive + tests; B: root.ts + handoff/service.ts + tests; C: s6-principal.ts + s6-remote.ts + host.ts + packages/remote/src/handlers/dispatch.ts + tests); NO changes under references/ (CORE PATCH BUDGET=0); NO P9P/P9P-UI reads; types.ts changes additive-only (no renamed/removed members).
   - Verify per-defect commits exist with T12-B*/T12-H*/T12-M* subjects.
   - Read lane final-chain logs (evidence/T12/t12*-final-chain.log) — runtime tests + tsc must be green at lane tip.
2. Cherry-pick -x each lane's series into int/T12-production-closure in `.worktrees/T12-int`, order A → B → C (B consumes A's child-id + types; C mostly independent).
3. Conflict resolution authority = main agent: types.ts additive merge; p4t6 pin = 543 + (total new files added by all three lanes, counted from their diffs under scanned dirs) — single final value, arithmetic check vs per-lane values.
4. Quick acceptance chain (sanctioned only):
   - `pnpm install --ignore-scripts` (only if lockfile changed)
   - `node scripts/run-tests.mjs runtime remote` (from repo root of T12-int)
   - `node node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.json`
   - `node node_modules/typescript/bin/tsc -p packages/remote/tsconfig.json`
   - Log to evidence/T12/t12-int-quick-chain.log (UTF-8, Out-File -Encoding utf8; NO `>` redirect to run.log inside report dirs).
5. INTEGRATOR COMMIT (cross-lane glue, main agent, after cherry-picks): host.ts glue deps must pass `subagents: ctx.get('subagents')` into the live binding deps — Lane A's M3 drain port reads deps.subagents; without it production drain is typed fail-closed (recursive-drain-unavailable). One-line (plus dep-type note) commit on T12-int, subject `T12-INT: host glue wires subagents port into live bindings (activates M3 drain in production)`. No lane owns this (host.ts = C's file, C done; live bindings = A's file, A done) — plan assigns shared-file glue to the main integrator.
6. Record T12-int tip SHA + gate note in SESSION_ROUTER_LOG.md (append only; check mtime first — other session may be writing) and graph.yaml t12 block (do NOT touch p9_prototype block).
6. Then dispatch vertical E2E builder (brief: evidence/T12/briefs/vertical-e2e.md, full text inline in prompt) on T12-int tip.

If a lane reported BLOCKER: record in decision skeleton, do NOT cherry-pick that defect's commit (its predecessor commits still may be cherry-pickable if clean and in-scope); vertical slice proceeds with remaining defects flagged; STOP-CANDIDATE risk if the blocker is architecture-critical (plan §15.3).

## §13 workspace validation (T+10.8) — sanctioned-chain equivalents
Plan §13 names `pnpm typecheck` / `pnpm build` / `pnpm smoke:composition` (+ optional `pnpm test`). Root package.json scripts are pure tsc passthroughs (verified 2026-09-02: every package build = `tsc -p tsconfig.build.json`, typecheck = `tsc -p tsconfig.json`; `test` = `vitest run` which is FORBIDDEN by the sanctioned chain). Run instead, all from `.worktrees/T12-int`, each step logged to evidence/T12/ with UTF-8:
1. `node scripts/run-tests.mjs` — full suite, once (the only large test run of the phase; run BEFORE writing the decision report).
2. tsc 8-set typecheck: `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` for client, contracts, domain, remote, runtime, storage, testkit, tools (legacy has no tsconfig).
3. tsc 8-set build: `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.build.json` for the same 8 (this is the "dist recipe" — no bundler involved).
4. `node scripts/composition-smoke.mjs`.
Full-suite failures get classified NEW REGRESSION / KNOWN BASELINE FAILURE / UNRELATED-FLAKY; only NEW REGRESSION blocks the verdict (plan §13). The known p6t1-parallel flake (~1/3) is UNRELATED-FLAKY by precedent — record, don't fix.

5. ZERO-CORE machine proof (GO condition 15): `node scripts/verify-zero-core.mjs` exists in-tree (493 ln; C1 patch-package traces, C2 pnpm.patchedDependencies, C3 file-writing lifecycle scripts, C4 plugin→upstream-private imports via public-exports whitelist, C5 git-snapshot consistency). Invocation for T12 (from `.worktrees/T12-int`):
   ```
   node scripts/verify-zero-core.mjs --host references/deepseek-harness-test-use --plugin packages/runtime --plugin packages/remote --status-before <file> --status-after <file> --diff-before <file> --diff-after <file> --json
   ```
   The four snapshot files are captured at the pwsh layer around the vertical run: `git -C references/deepseek-harness-test-use status --porcelain` (before/after) and `git -C references/deepseek-harness-test-use diff` (before/after), written UTF-8 under evidence/T12/. All must be empty + zero findings. Runs under plain Node (no child_process), so it works inside the sandbox.
