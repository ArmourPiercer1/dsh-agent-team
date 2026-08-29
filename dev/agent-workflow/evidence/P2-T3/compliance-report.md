# P2-T3 Compliance Report — Preset / Persona / Model Seams

Task: **P2-T3** (TaskDoc §11.3). Worker: sole writer leaf, worktree `.worktrees/P2-T3`, branch `task/P2-T3-preset-persona-model`, base `45a8f38a6381cfd7a548ab85728f76b5ab453f87`.
Program constraints: CORE PATCH BUDGET = 0, ≤3 harness executions, no subagents, owned paths only.

## Result

**SELF_VERIFIED.** All six seams PASS (see `seam-report.md`). Canonical green run: Run B (attempt 2/3) — `run/run-log.txt` line 141 `RESULT: PASS characterization self-test (all sections green)`, `run/summary.json` → `ok: true, "failures": []`, all 7 sections (`preflight, surface, fixture, static, lifecycle, probes, byte-clean`).

## Attempt ledger (harness executions, cap 3)

| Attempt | Run | Outcome | Detail |
|---|---|---|---|
| 1 | `run-a-attempt1/` (preserved) | FAILED (one line) | Both DSH boots completed (all 12 observation files written, both payloads `completed:true`-equivalent for boot 1); the group then threw at my `instance.resetPatchLayer([...])` call — a **latent P2-T1 harness defect** (`tests/characterization/lib/instance.mjs:193` passes an Array to `writeFileSync`, which requires string/Buffer/TypedArray). Failure shape: `probe group preset-persona-model threw: The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView. Received an instance of Array`. |
| — | (offline diagnosis, no harness run) | 2 latent failures caught before attempt 2 | (a) **Loader apply-order race**: boot 2's resume payload would have bailed early (`"missing required service(s)"`, `sessionQuery:false`) because a row's `apply` can run before other rows' services register; fixed by named-export `inject` on both payloads (robust upstream-documented pattern; `vendor/cordis/src/registry.ts:330` honors `plugin.inject`). (b) **Post-dispose assertion misnomer**: asserted deep-equality against a baseline measured *after* install with selection A active; fixed to assert `provider: null && model: null` (the actual post-dispose state). |
| 2 | `run/` (canonical) | **GREEN** | Zero failures across all sections, including my group (~35 checks) and the P2-T1 smoke group. Byte-clean section PASSED (see below). |

Attempt 3 was not needed.

## Owned paths (committed)

| Path | Content |
|---|---|
| `tests/characterization/probes/preset-persona-model/index.mjs` | Group orchestrator: static whitelist checks, user-preset authoring, two-boot lifecycle (main → stop → resume), done-file polling, patch-layer reset, ~35 machine checks. |
| `tests/characterization/probes/preset-persona-model/plugins/main.js` | Boot-1 payload: roster/resolve/mount, persona+scope assemblies, complete:true detection (negative-complete) + block (negative-override marker), ModelSelection step sequence A→B→C_EFFORT→C_PLAIN + dispose, preset switch lock (4 cases), resume-seed (persist `model/selection`, dispose). |
| `tests/characterization/probes/preset-persona-model/plugins/resume.js` | Boot-2 payload: cold-resume verification via `sessionQuery.observeSession` + `agents.resume` (app-faithful setup order), post-resume assembly boundary check, composition-identity check. |
| `dev/agent-workflow/evidence/P2-T3/run/**` | Canonical Run B: `run-log.txt` (141 lines, node-side UTF-8 via `--report-dir`), `summary.json`, `observations/*.json` (12 files), `logs/`. |
| `dev/agent-workflow/evidence/P2-T3/run-a-attempt1/**` | Full attempt-1 artifact backup (22 files) — failure evidence. |
| `dev/agent-workflow/evidence/P2-T3/seam-report.md` | Per-seam report with verbatim frozen-Architecture quotes. |
| `dev/agent-workflow/evidence/P2-T3/compliance-report.md` | This file. |

No file outside `tests/characterization/probes/preset-persona-model/**` and `dev/agent-workflow/evidence/P2-T3/**` was created or modified by this worker. **P2-T1-owned files untouched** (`run.mjs`, `lib/**`, `fixtures/**`, `probes/smoke/**`).

## Red-line compliance

| Red line | Status |
|---|---|
| No upstream source modification | PASS — byte-clean section (run-log L137-139): `git status --porcelain` empty, `git diff` empty, HEAD unchanged `cd5ef8148158c3a752a658978873241fdf8e2bbc` start=end, on the pinned read-only tree `references/deepseek-harness-test-use`. |
| No private/internal API import | PASS — every probe import is a public export of one of the 6 farm-linked packages (`dsh-agent`, `dsh-agent-presets`, `dsh-system-prompt`, `dsh-scope`, `dsh-session`, `dsh-util-crypto`) + node builtins; the P2-T1 static gate re-verified all probe imports against the live public surface (static section green in both runs). |
| No patch-package / pnpm patch / postinstall rewrite / git apply onto upstream / vendored modified copy | PASS — none used. |
| No legacy Team SessionEvent vocabulary as vNext authority | PASS — session events used only as *observed evidence* of upstream `@deepseek-ai/dsh-session` vocabulary (`model/selection`, `agent-preset/selected`, `turn/start`); no legacy Team event model referenced. |
| No push; 1 task = 1 branch = 1 worktree = 1 writer | PASS — local commits only on `task/P2-T3-preset-persona-model` in `.worktrees/P2-T3`; no other worktrees touched; no subagents. |
| Zero core patches / no CORE_SEAM_BLOCKER | PASS — all seams characterized on the public surface; blocker list empty. |
| Ports restricted to 3382/3392 | PASS — harness ran with `--port 3382 --backup-port 3392`; run-log records port-free verification after every boot/stop (L50, L53, L128, L132, L135). |
| Stable dev instance untouched (:3080, `D:\deepseek-harness\`) | PASS — all boots used the pinned test tree + dedicated DSH_HOME `references/.dsh-test-p2t3`. |

## Public-surface usage (imports by payload)

- `main.js`: `@deepseek-ai/dsh-agent` (`agentEvents`, `installModelSelection`), `@deepseek-ai/dsh-agent-presets` (`PresetLockedError`, `UnknownPresetError` — class reference for `instanceof` diagnostics only), `@deepseek-ai/dsh-system-prompt` (`PERSONA_SECTION`), `@deepseek-ai/dsh-scope` (`scopeOf`), `@deepseek-ai/dsh-session` (`SessionId`), `node:fs/path/url`, plus `inject: ['agentPresets','agents','systemPrompt','sessionProjections']`.
- `resume.js`: same package set + `inject: ['agentPresets','agents','systemPrompt','sessionProjections','sessionQuery']`.

## Known limitations & residual state (documented per red line: 影响面必须可逆 / 留痕)

1. **Durable session data persists** in the dedicated DSH_HOME `references/.dsh-test-p2t3` (sqlite): 4 probe sessions (`p2t3-standard-*`, `p2t3-minimal-*` ×2, plus the switch session) remain in the store. Reversible: the whole home is disposable test state; nothing outside it was written.
2. **Leftover user preset** `p2t3-scope` remains under `references/.dsh-test-p2t3/.agent-presets/` (authored by the probe group before boot 1). Reversible: delete the directory; no shared state involved.
3. **Patch layer end state**: `references/.dsh-test-p2t3/profiles/web/cordis.patch.yml` ends as a reset comment + `[]` (instance neutral). Reversible/neutral by construction.
4. **P2-T1 latent defect found & worked around (not fixed — not my path)**: `tests/characterization/lib/instance.mjs:193` (`resetPatchLayer` passes an array to `writeFileSync`). Worked around in `index.mjs` by writing the reset file directly. **Recommend the P2-T1 owner fix it** (any future group calling `resetPatchLayer` with the documented array API will hit the same single-line failure, exactly as Run A did).
5. **Loader apply-order race (harness/Loader behavior, documented)**: rows' `apply` may interleave ahead of other rows' service registration; synchronous `ctx.get` at apply time is unsafe for late-registering services. Mitigation used: named-export `inject` (defers `apply` until injections resolve). See `seam-report.md` §“Cross-seam mechanics”.
6. **Instance log overwrite limitation**: `DshInstance` uses a deterministic log name `instance-port<port>.log`, so boot 2's log file overwrote boot 1's in `run/logs/`. Boot proof for both boots is preserved as the printed marker lines in `run/run-log.txt` (L48, L51); per-boot instance logs were never needed for any assertion.
7. **Observation schema note**: `resume-verify.json` field `header` holds the *request-epoch fold* (`Session.requestHeader()` → `EpochHeader`), which structurally lacks `agentPreset` (hence `null`). The authoritative preset read is the `agentPreset` projection (used and verified). See `seam-report.md` Seam 6.
8. **Frontend bundle build out of scope** for this task (per P2-T1 harness contract); boot proof = printed `dsh web:` marker line with token.

## Evidence index

- Canonical run: `dev/agent-workflow/evidence/P2-T3/run/run-log.txt`, `run/summary.json`, `run/observations/{roster,persona,scope,negative-complete,negative-override,model,switch,resume-seed,coord,resume-verify,done-main,done-resume}.json`, `run/logs/`.
- Attempt 1: `dev/agent-workflow/evidence/P2-T3/run-a-attempt1/` (22 files incl. its `run-log.txt` showing the single failure).
- Seam analysis + verbatim frozen-doc quotes: `dev/agent-workflow/evidence/P2-T3/seam-report.md`.
