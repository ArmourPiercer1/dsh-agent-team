# P6-T6 G6 Report — Team tools + orchestration E2E

Task: register the model-facing team tools (list/create/delegate/followup/message/progress/control/lifecycle-inspect), **all delegating to the TeamRuntime**, and prove the G6 seven criteria on a REAL headless DSH instance driven exclusively through the registered tool handlers.

Branch: `task/P6-T6-team-tools-e2e` (base `760e7369650fe7e7e082772368f67569730cd80912` = P6-T5 evidence-close commit, verified via `git rev-parse HEAD` pre-commit).

## 1. TaskDoc G6 execution method — six steps

| # | Step (TaskDoc verbatim) | Execution |
|---|---|---|
| 1 | checkout Phase integration SHA | Worker side: all work committed on `task/P6-T6-team-tools-e2e` at a single reported HEAD; the G6-REVIEW reviewer checkouts the Phase integration SHA after cherry-pick — the report block carries `head=` for that checkout. |
| 2 | 读取上位文档中对应 Gate 条目 | Executed against brief §6g (E1–E7 mapping of DevPlan §19.7 G6) and the frozen TaskDoc/DevPlan gate text quoted in the brief. |
| 3 | 重跑关键 positive + negative tests | Canonical chain ×2 consecutive full-green (see §5): 1214 tests, 0 failed, twice in a row; E2/E6/E5b are the negative paths (live-rejected addressing, quota over-limit rejections, consumed-allow retry block). |
| 4 | 执行 zero-core/private-import/owned-boundary 检查 | Executed, self-declared PASS — see §3 and §4. |
| 5 | 对 cross-task invariants 做组合审查 | Executed in §6: T1 activation (quota/admit-once), T2 admission/action vocabulary, T3 SessionInputPort, T4 control guard, T5 activity projection, P5 harness precedent — combined in one live world. |
| 6 | 输出 criterion -> evidence -> PASS/FAIL | Executed in §2 below. |

## 2. G6 seven criteria — criterion → evidence → verdict

Evidence files: `harness-output/summary.json` (machine-verifiable, `pass=true`, `failures=[]`), per-scenario JSON (`E1.json`…`E6.json`, `E7.json`, `E5-boot1-writes.json`, `E5-boot2-restart.json`), boot logs under `harness-output/logs/boot{1,2}/`, dump-config row-mount proof, git pristine evidence (summary `pristine.before/after`), stable-instance :3080 probes before/after (200/200).

- **E1 / criterion 1 (same-template concurrent creates all admitted, distinct ids)** — `E1.json`: 3 concurrent `team_create_member` (worker template) all `executed` with `member-activated` effects, 3 distinct new instanceIds disjoint from the seeded set, each carrying a fresh childSessionId; state read-back: 6 members, 4 worker-template members. **PASS**
- **E2 / criterion 2 (instance-addressed actions; label/template addressing live-rejected)** — `E2.json`: follow-up on a member LABEL, follow-up on a TEMPLATE id, and send-message on a member LABEL all returned `rejected` with `TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED` from the live runtime; member count unchanged (no side effect). **PASS**
- **E3 / criterion 3 (persistent follow-up keeps the same Session)** — `E3.json`: two follow-ups on the E1 worker both `executed`/`work-admitted` on the SAME instanceId with monotonically advancing admission sequences (4→5, the root admission-ledger counter continued from E1's activations); bound childSessionId unchanged across both follow-ups; no new instance. **PASS**
- **E4 / criterion 4 (fresh_per_delegation mints a new instance each time)** — `E4.json`: 2 `team_delegate` (scout template, fresh_per_delegation) both `executed`/`member-activated` with 2 distinct NEW instanceIds (≠ seed scout) and 2 distinct new child sessions; scout count 3. **PASS**
- **E5 / criterion 5 (message/control/progress survive restart)** — `E5-boot1-writes.json` + `E5-boot2-restart.json`: boot 1 (port 3180) wrote a team message worker→leader (delivered to the root-bound session, durable fact + delivered sequences), two progress reports (per-subject sequences 1, 2), and a `leader-approval` control request (durable, pending). Boot 1 process then STOPPED; boot 2 (port 3181, same DSH_HOME) resumed all 9 live sessions (`liveSessions=9`) and read back: 9 members with the UNCHANGED id set, the control request still `pending` with the same requestId, both progress rows intact, zero skipped pending deliveries. Then: leader `resolve_control allow`, the guarded follow-up with the SAME correlation token `executed` (persisted allow consumed exactly once), retry with the same token `blocked` (`allow-consumed`), fresh token `executed` (no-request deviation), post-restart message delivered with a NEW higher deliveredSequence, third progress report continuing the sequence (3), request row now `decided`. **PASS**
- **E6 / criterion 6 (quota race: ==limit admitted, count+1>limit rejected, never over-create)** — `E6.json`: with 3 scout members (limit 4), 3 concurrent `team_create_member` (scout) → EXACTLY 1 admitted (`member-activated`), 2 rejected with `TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES`; state read-back: 4 scout members (== limit, never over-created), 9 total (team limit 12 untouched). **PASS**
- **E7 / criterion 7 (bypass scan PASS + structural review)** — `E7.json` (in-run re-execution of the committed static scanner over `packages/tools/src/`: 5 files, 0 violations) + committed unit test `packages/tools/test/p6t6-bypass-scan.test.ts` (10 tests, GREEN in both chain runs). The scanner statically proves: no direct TeamDomain/durable-repository writes, no `agents.create`/session-creation in tool sources, no legacy Team SessionEvent vocabulary (5 legacy event strings + 5 payload symbols + declaration-merge pattern, all zero hits; positive/negative sample self-tests included). Structural review (driver path: driver → HTTP `/__p6t6/tool` → registered handler via `agent.ctx.tools.execute` → runtime/guard/messaging/activity; no Runtime API call from the driver) is recorded in §6. **PASS**

**G6 verdict: 7/7 PASS.**

## 3. Zero-core self-declaration: PASS

No upstream DSH source modified: `references/deepseek-harness-test-use` git status + diff empty BEFORE and AFTER the harness run (captured in `summary.json` `pristine.before/after`, HEAD `cd5ef814…` unchanged). No private/internal API imports: the tools sources import only the public package surfaces of the vNext packages (contracts/domain/storage/runtime public exports) — the E7 scanner enforces the forbidden surfaces over `packages/tools/src/`. No patch-package/pnpm-patch/postinstall, no vendored upstream copies, no git apply of any team patch onto the host tree. The harness reuses the P5 precedent modules (`tests/characterization/lib/*`, `packages/runtime/root-binding/harness/{mini-mcp,ts-loader}.mjs`) READ-ONLY by file URL, byte-untouched.

## 4. Owned-boundary self-declaration: PASS

Changed paths (worktree `git status`): `packages/tools/src/{index.ts (M), tokens.ts, guard.ts, tools.ts, types.ts}`, `packages/tools/tsconfig.json (M)`, `packages/tools/test/{p6t6-helpers.ts, p6t6-actions.test.ts, p6t6-guard.test.ts, p6t6-bypass-scan.test.ts, p6t6-bypass-scan.mjs, p6t6-bypass-scan.d.mts}`, `packages/tools/harness/{plugin.mjs, run.mjs}`, `packages/testkit/test/p4t6-session-event-scan.test.ts (M — count maintenance only: it-title 318→330, enumeration comment +12 files, assertion 318→330; scanner `.mjs` byte-unchanged)`, plus evidence under `dev/agent-workflow/evidence/P6-T6/` (sanctioned by brief §7). Nothing else touched: no docs/, no graph.yaml, no SESSION_ROUTER_LOG.md, no scripts/, no other packages, no references/ content (only the task-specific `references/.dsh-test-p6t6` DSH_HOME, recreated fresh per run and gitignored).

## 5. Canonical chain ×2 consecutive full-green

Attempt ledger (see `attempt-ledger.txt`):

- attempt 1 (baseline, pre-change): 1181 passed / 0 failed + tsc×5 exit 0 — full green (recorded before any P6-T6 change).
- attempt 2 (post-change, first): 1214 passed / 0 failed (leg2) + leg1 install exit 0 + tsc×5 exit 0 — full green.
- attempt 3 (post-change, second consecutive): 1214 passed / 0 failed + leg1 exit 0 + tsc×5 exit 0 — full green.

Test delta: +33 new tests (14 actions + 9 guard + 10 bypass-scan; the 2 pre-existing skeleton tools tests remain). p4t6 denylist scan recount: 318 → **330** files scanned (12 new `packages/tools/**` files: 4 src .ts + 6 test files + 2 harness .mjs), verified by the REAL scanner run, not mental math; hit counts unchanged (new files are vocabulary-clean by construction).

## 6. Cross-task invariant composition (step 5)

One live world combined: T1 ActivationProvider (only creation path; admit-once identity `(root, source, requestToken)`; step-7 quota team-then-template) × T2 admission/action vocabulary (12 action names, instance-targeted addressing, `work-admitted`/`member-activated` effects) × T3 `SessionInputPort` landed on the REAL public Session input API (`agent.followup` inbox-acceptance commit point + `whenIdle` quiescence, fail-closed) × T4 `guardOperation` as the tool-layer last-mile guard (exact scope match incl. toolName + correlation; exactly-once allow consumption; hard policy above allow) × T5 activity ledger (two-phase, strict head+1 per (instance, subject)) × P5 harness precedent (profile-patch row mount, dump-config verification, FILE-FD stdio instance, junction probe farm, mini-MCP). E6 demonstrates T1 quota under concurrency; E5 demonstrates T4 durability + T3/T5 survival across a process restart; E2/E4 demonstrate T2 addressing/template policy; E3 demonstrates persistent-template session stability.

## 7. Scoping decisions (recorded per brief)

- **SD-GUARD**: guarded set = follow-up, send-message, report-progress, delegate-with-existing-instance (the instance-targeted mutations). The guard is consulted IMMEDIATELY before execution, per call, no caching. Verdict handling: `allowed` → proceed (the allow is consumed exactly once by the guard); `no-request` → PROCEED (documented deviation: unrequested operations are not implicitly gated — the control plane is opt-in per scope, the runtime's own envelope/role checks remain authoritative); every other reason (`target-stale`, `no-request` absent, `request-pending`, `decision-deny`, `allow-consumed`, etc.) → BLOCKED, the runtime is never called. External hard policy is applied by the control service inside `guardOperation` and cannot be overridden by any allow.
- **SD-GUARD-NS**: the guard scope key is the instance-identity namespace. Well-formed instance ids (matching `inst-` + 1..32 lowercase alnum) ALWAYS consult the guard and the verdict is final (including `target-stale` for missing/archived/disposed targets); out-of-namespace tokens (labels, template ids) are routed straight to the runtime, which live-rejects them with `ACTION_ADDRESSING_REJECTED`. This keeps `CONTROL_GUARD_MALFORMED` from leaking out of the tool layer and makes G6 criterion 2 a live-runtime property.
- **SD-CREATE**: template-addressed creations (`create-member`, `delegate` with a template) are unguarded — their authority IS the ActivationProvider (quotas, envelopes, gates, admit-once); gating them at the tool layer would double-authorize creation.
- **SD-CALLER**: the tool layer receives an injected `resolveCaller(sessionId)` port (harness maps root session → leader instance caller, member child sessions → member callers via durable domain lookup, unknown → `CALLER_UNRESOLVED` rejection). The runtime re-validates identity/role from the durable domain on every call — the tool-layer lookup is only the execution binding.
- **SD-DEPS**: "TeamRuntime public surface" = the `createTeamRuntime` facade plus the sanctioned satellites `createControlService`, `createMessagingCoordinator`, `createActivityLedger`. The tool layer performs NO durable writes of its own; every state change is a runtime/control/activity operation.
- **SD-SURFACE**: the harness installs a minimal no-op real `TeamAgentSetupSurface` (no overlay slots needed; the post-commit binder resolves durable member records through the real read handle).
- **SD-TOKEN**: `requestToken` is REQUIRED on all 10 tools (≤128 chars, model/driver-supplied). It is the admit-once operation identity and the control-plane correlation: boot 2 MUST reuse boot 1's token to consume the persisted allow (E5), which pins the retry semantics.

## 8. E2E wiring (brief §6c)

- Real instance: FILE-FD stdio spawn of `node apps/cli/lib/bin.js web --port <p> --no-open` with cwd = the pristine host tree (`references/deepseek-harness-test-use`, HEAD `cd5ef814…`), env `DSH_HOME` + `DSH_CLIENT_COMMIT_HASH=cd5ef814`.
- DSH_HOME: `references/.dsh-test-p6t6` — NEW task-specific home, removed+recreated fresh per run (`.dsh-test-p5t6` never touched).
- Ports: boot 3180 then 3181, serial; mini-MCP fixed 3491–3495 (allocated 3491, released post-flight); stable instance :3080 probed 200 before AND after; host tree git-clean asserted before/after.
- Row mount: the plugin row is mounted ONLY through the public profile-patch seam and verified present via dump-config on BOTH boots (`rowMounted` = true ×2).
- Driver discipline: every team action travels driver → `POST /__p6t6/tool` → the plugin's registered handler via the public `agent.ctx.tools.execute` seam → TeamRuntime/guard/messaging/activity. The driver never calls the TeamRuntime API. No real LLM calls: the row installs a static model reference unknown to any provider in the fresh DSH_HOME, so followup turns fail contained at the driver boundary while inbox acceptance (the commit point) and quiescence remain real.

## 9. Risks / deviations

- `no-request` → proceed (SD-GUARD) is a deliberate deviation from a strict fail-closed gate; it is pinned by tests (p6t6-guard suite, E5b fresh-token case) and documented here.
- E3's work-admitted sequences continue the ROOT admission-ledger counter (4, 5 after E1's three activations); the criterion is monotonic advance + same session, which is what E3 asserts.
- Model-less turns: the static-model reference means followup model turns fail contained (verified in upstream source: `kick()` contains reported failures at the driver boundary; `whenIdle()` resolves). Delivery durability is asserted independently of model behavior.
- The p4t6 count change (318→330) is the DEC-1 sanctioned exception (counts only; scanner bytes untouched).
