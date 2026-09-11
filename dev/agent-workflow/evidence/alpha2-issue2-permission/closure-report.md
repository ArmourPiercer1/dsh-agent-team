# I2 Closure Report — alpha.2 Issue #2 Permission Repair (line B)

Branch: `fix/alpha2-issue2-permission` (base `6a2f3e1e906479ce8d0b07f9bcc6fef4e737f925` = origin/master, includes integrated H1/H2/H3 hardening)
Plan: `docs/plans/issue-fix/issue#2/dsh-agent-team-alpha2-issue2-permission-repair-plan.md`
CORE PATCH BUDGET = 0 (upstream `references/deepseek-harness-test-use` untouched, porcelain-clean at `a66e470204`)

## 1. Verdict

**I2-P0 (B2 production defect) VERDICT: GREEN on BOTH legs — no product change required.**
Per the plan's P0 ruling, the deliverable is the permanent test suite + evidence + gates, NOT a source fix. The `builtinToolDeny` capability restriction works correctly per-team-member on the current source, through the real production seam (real preset composition + real ToolRuntime + real restrict seam).

- Live leg: `kit/issue2-b2-live-2026-07-17T00-00-00.json` — **I2-CHECK-PASS (17/18 blocking + 1 environmental)**, exit 0.
- Cold leg: `kit/issue2-b2-cold-2026-07-17T00-00-00.json` — **I2-CHECK-PASS (15/16 blocking + 1 environmental)**, exit 0.
- Phase-C evidence: `kit/issue2-phase-c-2026-07-17T00-00-00-{live,cold}.json`.
- Boot/instance evidence: `kit/issue2-boot*.log`, `kit/instances/*`, `kit/dump-config-issue2-*`, `kit/issue2state-2026-07-17T00-00-00.json`, `kit/catalog-list-issue2-*`.
- World (kept as evidence): `references/.dsh-test-i2-2026-07-17T00-00-00/` (installed artifact 0.1.1-alpha.2 from the pinned source; workspace sentinels `issue2-a.txt`/`issue2-b.txt` present, no `issue2-r.txt` — the denied write never happened).

## 2. What the live world proved (B2 surface)

Blueprint: expert template `memberPresetId: standard`, `builtinToolDeny: []`; researcher template `memberPresetId: standard`, `builtinToolDeny: [pwsh]`; root = plugin-created session on `rootPresetId: standard`.

| Probe | Result |
| --- | --- |
| Surface (L1-L3) | researcher surface = expert surface − EXACTLY `{pwsh}` (symmetric diff; L3b); both join the preset (L8: zero "published without joining an agent preset" warnings) |
| Dispatch (L4a) | expert `pwsh` passes ALL product layers and reaches the pwsh executor (the executor-side ACL artifact, see §5, is environment-only) |
| Dispatch (L5/L5b) | researcher `pwsh` → `unknown tool "pwsh"` (200 + ok:false), zero side effect (`issue2-r.txt` never created), zero control requests |
| Dispatch (L4d/L6) | expert `read` / researcher `read` on their sentinel files EXECUTE and return the file content (the mask is precise: only the denied tool is masked) |
| Precedence (L7) | zero control requests across the whole battery (no policy installed in the B2 world — see §6) |
| Parity (L4c) | the LEADER (deny `[]`) pwsh full-execution fails IDENTICALLY at the executor's own Windows sandbox setup → the executor-side failure is environmental, never the deny mechanism |

## 3. Production-failure attribution (why the user's alpha.2 build broke)

The B2 defect (`tools.restrict() names unknown global tool "pwsh"` → member bootstrap FAILED → GUI 405) does NOT reproduce from the current source (`6a2f3e1`, artifact pinned) in a real installed world, live and cold. The production failure is attributed to, in decreasing order of likelihood:

- **D2 — stale installed build**: the failing deployment ran an artifact that did not match any committed dist (the I2-P6 premise itself: "installed artifact != any committed dist"). A build from before the restrict-seam semantics settled (the P0-2 hardening, which made the adapter capture the exact upstream disposer and propagate seam rejections) would surface this exact error class.
- **D3 — composition race**: the restrict call racing the preset's standing-scope contribution (the tool not yet visible to the agent scope when `restrict({deny:['pwsh']})` ran) produces the same typed error; the current source's install order (mount → deny → permission listener) plus the real-seam S2 fail-closed pin makes a silent race impossible — a failed restrict now FAILS THE AGENT CREATION (rolled back) instead of corrupting a half-restricted surface.

Either way: **no defect in the current source**. The permanent defenses landed in this PR: the real-seam S2 (unrestrictable deny → creation rejects + rollback) and the P4 precedence lanes.

## 4. Permanent test suite (this PR)

| File | Plan ref | Tests | Seam |
| --- | --- | --- | --- |
| `packages/runtime/test/issue2-real-preset-restriction.test.ts` | I2-P1 (§10), P5 (§14), P2-failclosed (§11), P3 (§12) | 13 (S1-S9) | REAL: cordis Context + Loader + real fixture preset `i2-standard` (roster `roots` + `trust: user`) + real ToolRuntime (`ctx.tools.schemas(agent)` surface) + real `applyBuiltInToolDeny` |
| `packages/runtime/test/issue2-capability-permission-precedence.test.ts` | I2-P4 (§13) | 12 (P4-A/B/C/D) | REAL: real ToolRuntime pipeline (`ctx.tools.execute`) + real mask (glue install order) + real `installParameterPermissionListener` + real control service over a real P6-T4 world (durable rows) |
| `packages/tools/test/issue2-builtin-deny-focused.test.ts` | I2-P2 (§11) | 8 | adapter contract on the seam (fake agentCtx): no-op empty deny, dedupe/order, exact disposer (identity), idempotent dispose, fail-closed propagation, message integrity, no silent continuation |

Real-seam scenario matrix (file 1): S1 fresh member mount+deny (exact symmetric diff `{fixture-shell}`), S2 fail-closed unrestrictable deny (creation rejects, names the tool, rolled back), S3 sibling inertness, S4 cold member resume (restriction rebuilt, sibling stable, disposed agent gone), S5 already-joined adopted root (guard skips second mount; deny applies to inherited preset tools — §12.1/§12.3), S6 double-mount rejection (the guard's documented rationale), S7 registry-level dispatch mask (denied tool → `unknown tool`; expert dispatch executes), S8 fresh ROOT on its own preset id + its own deny subject (`fixture-base` hidden, `fixture-shell` visible — per-role independence), S9 cold ROOT rebuild (expert untouched across the root lifecycle).

P4 lanes (file 2): A hidden read + static allow(any) → surface-absent, dispatch rejected (`unknown tool`), body 0, control rows 0/0/0; B hidden write + ask(any) → the ask request IS created and the leader APPROVES it, yet the dispatch still fails `unknown tool` with body 0 and the last-mile guard consumption exactly once — **the mask is the final authority even when every permission layer says allow**; C visible read + allow → allow lane intact (body once, rows 0/0/0, decision-allow observed); D visible write + ask → ask lane intact end-to-end (leader-approval request → leader allow → decision row → exact guardOperation check-and-reserve → body once).

## 5. Environmental artifact (L4b, non-blocking)

The expert pwsh full-execution (the marker leg L4b) fails in this session because the TEST HOST itself (the DSH instance running the kit) executes under the session file sandbox and its pwsh executor cannot grant workspace ACLs: `SetNamedSecurityInfoW failed (Win32 5): grantWrite(<workspace-issue2>)`. Proven environmental: the LEADER (deny `[]`, L4c parity probe) fails identically. L4b is classified `ENV` in the kit verdict (non-blocking; passes on an unsandboxed host/CI). No escalation was used for the boot or any test run (policy-compliant).

## 6. Recorded design deviations

1. **B2 world design** (I2-P0): `mcpServer: null` (the 58 `mcp__rc-*` globals are orthogonal to preset-layer visibility); the `permissions` facet was absent from the B2 world (the I2-P3/precedence world is the P4 test's own control world); the root is a plugin-created session on `rootPresetId: standard` (not an adopted web session).
2. **§10.3 in-repo leg**: the shipped `standard` preset references the full production tool-package closure (shell executors, sandbox, jobs, skills, compaction, workflow) which is not part of this repository's dependency surface; the permanent in-repo seam regression uses the hermetic fixture preset (plan §10.2) and the Windows live leg (real standard preset + real `pwsh`, safe command `Write-Output ISSUE2-EXPERT-OK`) is covered by the recorded live-world evidence above (both legs GREEN at the pinned artifact).
3. **P4-A "zero authorization marker" and P4-B "no ask request" (plan §13)**: the upstream pipeline order is `tools/pre-execute` waterfall → monotonic guards → dispatch/resolution (`dsh-tools` `prepareExecution` runs the gate BEFORE `dispatchToolBody`'s `resolveExecution`), so the permission listener DOES run for a hidden tool: P4-A's static allow resolves + marks (observed; the marker is inert — the body never runs), and P4-B's ask lane creates the durable leader-approval request (even a leader-approved ask cannot execute a denied tool). The plan's mask-first ordering is not achievable with CORE PATCH BUDGET = 0 (pipeline order is upstream). The enforcement invariant the plan exists to protect — **a denied tool body can NEVER run** — holds and is pinned in both lanes (the mask is enforced in the operation that performs it, per the upstream enforcement rule). Pinned verbatim in the test header + the `(recorded deviation)` assertions.

## 7. Gate actuals (plan §22.4)

| Gate | Result |
| --- | --- |
| runtime full suite | pre-existing parity (see §8); my files green under the shim runner (13/13, 12/12) |
| domain full suite | untouched (no domain changes) |
| testkit | p4t6 pin 668 → 671 (plan §23.2 local pin update; scanner re-run truth: 671 files, zero denylist hits in the three new files, frozen quarantine set unchanged at 15) — p4t6 10/10 PASS |
| typecheck | 0 errors — all TS packages (runtime, tools, contracts, domain, storage, remote, client, testkit); `legacy` has no tsconfig (base state) |
| build | 9/9 `tsc -p tsconfig.build.json` OK |
| build:composition | place-dist-glue (1 placement, byte-identical) + build-client-composition OK + **check-artifacts-committed OK: 1080 files — committed install-surface artifacts match the fresh build** (dist byte-identical: zero dist delta from this PR) |
| check-artifacts-committed | OK (one sanctioned sandbox escalation for the script's internal `git` calls; no product action) |
| references/deepseek-harness-test-use | porcelain-clean (read-only use this session) |
| lint | 19 pre-existing errors (baseline), **0 new** — none in the three new files |
| test:node (plain-node shim) | tools: 64 passed / 8 failed (all 8 pre-existing, §8); runtime: identical to baseline (d5 module-level shim crash, §8 — stash-comparison proof recorded in the session log) |

NO new deterministic regression. CORE PATCH BUDGET = 0.

## 8. Pre-existing baseline debt (NOT introduced by this PR)

- `packages/runtime/test/d5-instance-contract.test.ts` — module-level `toHaveLength` (outside any `it`) crashes the plain-node shim runner (process exit) before alphabetically-later files run; pre-existing, proven on the stashed base in-session. Files after `d5` (including the new `issue2-*` runtime tests) therefore only run package-wide under a future shim fix; they are verified per-file under the identical shim mechanics (`kit/shim-one.mjs`) and are shim-clean by construction (sync `it`, module-level async, shim matcher set only).
- `packages/tools/test/h3-hostile-seam.test.ts` — 6/10 under the shim (async `it` bodies unsupported by the shim; vitest-validated in the H3 closure), `p6t6-actions.test.ts` 1/14, `p6t6-bypass-scan.test.ts` 1/10 (static scan expects 5 tool-layer .ts files, tree has 7 — pre-existing on the base).
- `a5a-pre-execute.test.ts` import error under the shim (`team_domain` committed-fixture open failure) — pre-existing on the stashed base; leftover scratch residue `packages/testkit/test/.tmp-fault/a5a-w4` + `f3a-t5a` from earlier killed runs (gitignored scratch; not created by this PR).
- vitest itself cannot launch in this sandbox (vite 8 `windowsSafeRealPathSync` execFile EPERM) — the documented reason the plain-node shim runner exists; the CI/unsandboxed surface runs vitest.
- Kept debt (pre-existing at base, recorded in the hardening closure): hostile-seam removal before first RC; vitest silent-hang V2 backlog item.

## 9. PR scope (exact diff vs base)

```text
packages/tools/test/issue2-builtin-deny-focused.test.ts            (new, 8 tests)
packages/runtime/test/issue2-real-preset-restriction.test.ts       (new, 13 tests)
packages/runtime/test/issue2-capability-permission-precedence.test.ts (new, 12 tests)
packages/runtime/test/issue2-fixtures/**                           (new: fixture plugin i2-contribute.js + preset i2-standard/agent.cordis.yml)
packages/runtime/package.json                                      (devDependencies: the real upstream composition — cordis, cordis-plugin-loader/include/group, dsh-llm, dsh-session, dsh-system-prompt, dsh-tools, dsh-agent, dsh-agent-loop, dsh-agent-presets, dsh-session-projection, dsh-scope)
pnpm-lock.yaml                                                     (+62 lines — the above devDependencies only)
packages/testkit/test/p4t6-session-event-scan.test.ts              (pin 668 → 671 + (i2) history entry — plan §23.2)
dev/agent-workflow/evidence/alpha2-issue2-permission/**            (new: kit + B2/Phase-C evidence + this report)
```

No `packages/*/src/**` changes. No `agent-bindings.mjs` changes (the only-if-RED hunk was never needed — B2 GREEN). No operation-permission/**, no a*/h1a* test changes (read-only pattern sources), no blueprint/**, no storage/schema, no root/host/s6-remote/types/TeamCreationPanel.

Fence note (recorded for review): `packages/runtime/package.json` + `pnpm-lock.yaml` + the p4t6 pin go beyond the §4.3 primary file list; both are mandated by the plan itself — the §10.1 real-seam test cannot exist without the upstream composition devDependencies, and §23.2 assigns the temporary p4t6 pin update to this PR.

## 10. Merge plan (parallel lines)

Line A (blueprint loading) and line C merge first → this PR rebases onto the new master (`git fetch && git rebase origin/master`). Expected conflicts per plan §16: `agent-bindings.mjs` (three-way function-level check §16.1 — this PR touches NO hunk of that file), generated runtime dist (this PR has NO dist delta → re-run `build` + `build:composition` after rebase if the merged source changed), testkit pin (re-run the scanner, use the scanner truth). No cross-cherry-picks; no master merges mid-development; line A's unpushed commits stay unpushed until their own Gate.

## 11. Reproduction

```text
node dev/agent-workflow/evidence/alpha2-issue2-permission/kit/issue2-setup.mjs     # build+install world (needs unsandboxed git)
node dev/agent-workflow/evidence/alpha2-issue2-permission/kit/issue2-boot.mjs      # boot host :3181 + mock :3493
node dev/agent-workflow/evidence/alpha2-issue2-permission/kit/issue2-check.mjs live   # → I2-CHECK-PASS
node dev/agent-workflow/evidence/alpha2-issue2-permission/kit/issue2-check.mjs cold   # restart world, re-check
node scripts/run-tests.mjs tools                                                    # shim: my 8/8 green (+ 8 pre-existing fails)
node dev/agent-workflow/evidence/alpha2-issue2-permission/kit/shim-one.mjs packages/runtime/test/issue2-real-preset-restriction.test.ts
node dev/agent-workflow/evidence/alpha2-issue2-permission/kit/shim-one.mjs packages/runtime/test/issue2-capability-permission-precedence.test.ts
```
