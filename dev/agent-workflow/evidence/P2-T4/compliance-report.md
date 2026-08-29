# P2-T4 — Compliance Report (TaskDoc §11.3)

Task: **P2-T4 — Tool/admission/skill/MCP seams** (Team-mode vNext, CORE PATCH BUDGET = 0).
Branch/worktree: `task/P2-T4-capabilities` @ `.worktrees/P2-T4` (1 task = 1 branch = 1 worktree = 1 writer).
Host SHA (pinned test-use tree): `cd5ef8148158c3a752a658978873241fdf8e2bbc`.

## 1. Goal compliance (card acceptance → evidence)

| Acceptance criterion (card) | Met | Evidence |
| --- | --- | --- |
| 分别验证 pre-step、pre-execute、tool visibility、skills、MCP 的 Agent-scope 控制能力 | ✅ | `seam-report.md` — 5 rows, each row's cells cite its own mechanism + observations; no cross-row inference |
| skills/MCP 分开判定；不要由 tool seam 推断 | ✅ | skills row established via `agentCtx.get('skills')` + `skills.snapshot({scope})` (its own service, its own layer store); MCP row via the mcp-client plugin instance (namespace reservation, `mcp__*` tools). Neither cites the tool seam's result as its evidence; both carry independent negative controls |
| Per row: creation / cold resume / tighten / capability disappear | ✅ | 5 × 4 = 20 cells, each PASS with mechanism → positive evidence → negative control in `seam-report.md` |
| 每类 seam 有 PASS 或具体 blocker | ✅ | All 20 cells **PASS**; no `CORE_SEAM_BLOCKER` raised (none needed — every capability is reachable through public seams) |
| 禁止 private registry | ✅ | Payload imports only public exports (4 upstream packages, statically whitelist-checked by the harness + re-enforced at boot by the Node loader); no upstream private/internal API; registrations only through `ctx.on` / `tools.register` / `ctx.get('skills').register` / `ctx.plugin` from the profile-mounted row |
| Runnable probe group at `tests/characterization/probes/capabilities/` | ✅ | `index.mjs` (orchestrator) + `plugins/capability-scenario.js` (payload); auto-discovered by the P2-T1 harness, runs before smoke, leaves the instance stopped + patch layer restored |
| Canonical green run + observation JSONs + reports | ✅ | `dev/agent-workflow/evidence/P2-T4/run/` (exit 0, all sections green); boot1/boot2 observation JSONs + state JSON in `run/logs/`; this report + `seam-report.md` |
| Manual double-check: upstream byte-clean, ports freed, worktree clean | ✅ | §5 below |

## 2. Owned paths (all created by this task; nothing else modified)

| Path | Kind |
| --- | --- |
| `tests/characterization/probes/capabilities/index.mjs` | harness-side orchestrator (node: + relative imports only; scanned in harness mode) |
| `tests/characterization/probes/capabilities/plugins/capability-scenario.js` | probe payload (cordis profile row `p2t4-capabilities-probe`; imports: `@deepseek-ai/dsh-agent`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-mcp-client`, `@deepseek-ai/dsh-session`, `node:crypto`, `node:fs`, `node:path` — all whitelist-admitted) |
| `dev/agent-workflow/evidence/P2-T4/run/**` | canonical evidence (run-log.txt, summary.json, logs/*) |
| `dev/agent-workflow/evidence/P2-T4/debug-attempt1*/` | pre-green debug iterations (kept as audit trail) |
| `dev/agent-workflow/evidence/P2-T4/seam-report.md` | capability seam matrix |
| `dev/agent-workflow/evidence/P2-T4/compliance-report.md` | this report |

Not touched: P2-T1-owned files (`run.mjs`, `lib/**`, `fixtures/**`, `probes/smoke/**`,
`.github/workflows/characterization.yml`), upstream tree, frozen docs, other worktrees.

## 3. Dependency usage (reuse, not reinvention)

- **P2-T1 harness**: `tests/characterization/run.mjs` + `lib/` unmodified. Reused:
  `DshInstance` (start/stop/dumpConfig/mountRows/rowInDump), `ensureProfile`,
  public-surface whitelist (static scan of the payload before boot + runtime loader
  re-enforcement), section pipeline (preflight → surface → fixture → static →
  lifecycle → probes → byte-clean), port fallback 3383→3393, `--report-dir` logging.
- **Public seam for mounting**: `cordis.patch.yml` row insertion
  (`{id: p2t4-capabilities-probe, name: fileURL}`) — the same public seam the smoke
  group uses; the group captures the pre-group patch bytes and restores them exactly
  in `finally` (verified: pre-group bytes restored, instance stopped at group end).
- **Upstream public API surface used by the payload** (all verified against the pinned
  tree's public exports): `agents.create/resume/get`, `agent.ctx` (unpublished agent
  scope ctx in `setup()`), `agent.followup/session/status`, `handle.dispose()`,
  `installModelSelection` (`@deepseek-ai/dsh-agent`), `createUserMessage`
  (`@deepseek-ai/dsh-llm`), `tools.register/schemas/restrict/execute`,
  `skills.register/snapshot`, `sessions` store, `ctx.on` waterfalls
  (`agent/pre-step`, `tools/pre-execute`, `agent/error`), `ctx.plugin`
  (`@deepseek-ai/dsh-mcp-client` streamable-http config), `Fiber.dispose()`,
  `SessionId` (`@deepseek-ai/dsh-session`).
- **Auxiliary infrastructure (harness-owned, closed + verified in `finally`)**: mini
  MCP streamable-http JSON-RPC server on aux port 3491 (fallback 3492–3495); dead
  endpoint at 3999 for the startup-failure rollback cell.

## 4. Key technical findings (pin for later tasks)

1. **Cordis property proxy is topology-sensitive; `ctx.get` is not.** From an
   agent-scope ctx, `agentCtx.tools` resolves (tools impl on an ancestor fiber) but
   `agentCtx.skills` throws `cannot get property "skills" without inject` (skills impl
   off the ancestor chain in the web-profile composition). `ctx.get('skills')` always
   resolves (strict global store read) and — critically — returns a service wrapper
   **bound to the calling ctx**: the service's `register()` then targets the layer of
   the *caller's* scope (`scopeOf(callerCtx)`), so `agentCtx.get('skills').register()`
   lands in the agent scope layer. This matches the pinned upstream guidance
   (`packages/AGENTS.md`: "Optional services use `ctx.get(name)`. … the property proxy
   is topology-sensitive, while strict `ctx.get` reads the global service store").
2. **Scoped tool registration works via property access** (`agentCtx.tools.register`)
   — empirically: scoped tools hidden from the global view, inherited globals present,
   cross-agent isolation holds.
3. **`tools.restrict()` requires a scoped context** (throws for an unscoped ctx) and,
   from the agent scope, hides denied tools from the agent view only — no global leak.
4. **MCP namespace reservation is per-scope**: same `serverName` in the same scope is
   rejected; the same `serverName` in another agent scope is allowed; dispose releases
   it (remount succeeds); `failOnStartupError: true` rolls back the whole agent
   creation (no agent published, no session).
5. **Pre-step reject** ends the turn with `turn/end{reason: blocked}` and no
   `step/start`; **pre-execute `ask`** fails closed without an in-turn approval
   answerer (denial names the turn-enclosed approval requirement verbatim).

## 5. Manual double-check results

| Check | Result |
| --- | --- |
| Upstream `references/deepseek-harness-test-use` git status/diff | empty (pristine); HEAD unchanged `cd5ef8148158c3a752a658978873241fdf8e2bbc` — asserted by the harness at start **and** in the byte-clean section after the run, plus this manual re-check |
| Ports 3383 / 3393 / 3491 | all free after the run (Test-NetConnection: not listening) |
| Worktree `git status` | untracked: owned paths only (`tests/characterization/probes/capabilities/**`, `dev/agent-workflow/evidence/P2-T4/**`) after removing the regenerable harness scratch dir `tests/characterization/.run-logs/` (harness default scratch, content mirrored in the report-dir logs); no tracked-file modifications, no deletions |
| DSH_HOME | `references/.dsh-test-p2t4` (task-dedicated; profile initialized; channel files `p2t4-*.json/txt` removed by the group in `finally`) |
| Stable GUI (:3080) + `D:\deepseek-harness\` | untouched |

## 6. Attempt ledger (canonical executions, cap ≤3)

| # | Kind | Command (abridged) | Outcome |
| --- | --- | --- | --- |
| 1 | canonical full | `run.mjs --port 3383 --backup-port 3393 --dsh-home … --report-dir …/debug-attempt1` | RED at capabilities only (payload SyntaxError: duplicate `const agent` declaration; preflight/surface/fixture/static/lifecycle/byte-clean + smoke all PASS) |
| — | debug | `--only probes` (debug-attempt1b) | scenario fatal: `cannot get property "skills" without inject` (property-access path in createWorld) |
| — | debug | `--only probes` (debug-attempt2) | GREEN (probes): all capabilities + smoke checks pass; fixed payload in place |
| 2 | **canonical full** | `run.mjs --port 3383 --backup-port 3393 --dsh-home … --report-dir …/run` | **GREEN — exit 0, all sections green, byte-clean verified** |

## 7. Bugs found & fixed (this task's own code)

1. **Payload SyntaxError** — duplicate `const agent = handle.agent` left over from the
   boot-2 ordering edit (attempt 1). Fixed by removing the second declaration.
2. **Scoped skill registration via property access** — `agentCtx.skills.register(...)`
   throws from the agent scope ctx (topology-sensitive property proxy; see finding 1).
   Fixed by switching to the documented public path `agentCtx.get('skills').register()`
   and by recording the property-access throw as a standing negative-control evidence
   cell (`creation.skills.propAccess`).
3. **Fragile boot on single-capability failure** — createWorld threw on the first
   absent capability and lost the whole boot. Fixed by wrapping the skills write and
   the MCP mount in evidence-recording try/catch (synchronous failures recorded, not
   fatal; MCP activation rejections caught by the setup awaiters).

No upstream bugs found. The `ctx.skills` property-access gap is upstream *behavior*
documented in the topology-sensitivity postmortem, not a defect: the capability is
available through `ctx.get`, which the probe uses.

## 8. Known limitations (disclosed)

- **No model success in turns**: no `DEEPSEEK_API_KEY` in the launching environment
  (and none available in the workspace) → turn bodies fail with `LlmError …
  MISSING_CREDENTIAL`. Seam gates are evaluated before/around the step/execution, so
  all 20 cells are model-independent; the failure is recorded verbatim in the
  observation JSONs and named in the harness label. Re-running with a key upgrades
  turns to normal completion without probe changes.
- **MCP transport**: streamable-http only (stdio structurally denied in the confined
  sandbox: Node-originated piped stdio EPERM). Transport-independent behaviors
  (namespace, rollback, dispose) were the ones under test.
- **Aux port 3491** (mini MCP server) used transiently; closed + verified in `finally`;
  never on a reserved port (3383/3393 DSH-only; 3080/3180/3281/3291 forbidden).

## 9. Red-line compliance

- No upstream source modification (byte-clean asserted start + end; manual re-check).
- No private/internal API, no patch-package, no vendored modified upstream copy.
- No legacy SessionEvent vocabulary used as authority (event types read only as
  durable-log evidence for the pre-step/resume cells).
- No push; commits restricted to owned paths on `task/P2-T4-capabilities`.
- All instance/disk effects reversible: patch layer restored, channel files removed,
  aux server closed, instance stopped.
