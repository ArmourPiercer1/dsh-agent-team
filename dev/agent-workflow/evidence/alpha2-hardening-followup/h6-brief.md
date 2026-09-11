# H6 BRIEF — alpha.2 hardening follow-up: closure (gates + live smoke L1–L4 + report)

You are the sole writer for task `task/alpha2hf-h6-closure` in worktree
`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\alpha2hf-h6` (base = the int tip AFTER
H4+H5 integration — it contains: H4's per-decision fresh rule canonicalization, H5's bash
effect projection `{tool, commandHash, workdir, runInBackground, timeoutMs,
sandboxPermissions}` + the four new closed reasons + the extended bash summary).
Read `docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md` in this worktree first.
**Before starting, re-read the ACTUAL state at the int tip** (the H4/H5 code + their
evidence dirs `dev/agent-workflow/evidence/alpha2-hardening-followup/h4-rule-identity/`
and `h5-bash-effect/` — especially `projection-ruling.md` and `upstream-contract.md`) and
align every assertion below to the landed implementation.

## Mission (plan §7–§14)

Prove the follow-up wave is closed: P0 end-cap unregressed, production wiring correct
(incl. the bash workdir basis), the live minimal smoke L1–L4 passes on a real host, full
parity has NO new deterministic failure, all gates green, and write the closure report.
This is verification + gates ONLY — no product changes (if a gate fails, stop, evidence,
deviation report — do not "fix" product code here; that goes back to the parent).

## Part 1 — Focused suites (plan §10.1)

Run and record actuals (all must be green — file/package names are EXACT, verified at the
H5 tip; do not guess variants):
```
pnpm --filter @dsh-agent-team/runtime exec vitest run test/a2-canonical-operation.test.ts test/a3-permission-resolver.test.ts test/a4a-control-exact-scope.test.ts test/a5a-pre-execute.test.ts test/a6a-production-wiring.test.ts test/h1a-pre-execute-endcap.test.ts test/h4-rule-identity.test.ts test/h5-bash-effects.test.ts
pnpm --filter @dsh-agent-team/domain exec vitest run test/a1-permission-policy.test.ts
pnpm --filter @dsh-agent-team/tools exec vitest run test/h3-hostile-seam.test.ts
```
(Cross-check: the parent re-gated the int tip (post-H5) at **264/264 across the 8 runtime
suites above** = a2 31 + a3 28 + a4a 28 + a5a 50 + a6a 52 + h1a 40 + h4 10 + h5 25. Record
the ACTUAL per-file counts from your run, do not assume.)

## Part 2 — P0 end-cap properties (plan §7)

The 10 properties (static-deny+hostile, default-ask+hostile zero-request, static-allow
once, ask→allow once, unsupported abstain, sibling non-leak, cold-reinstall, disposer
drain, PTC nested, hostile-not-re-bypassed-by-the-bash-seam-changes) are covered by the
h1a + h3 seam suites (Part 1) — record the actuals as the proof. Add ONE explicit new
leg if not already covered: a hostile prepend-allow + a bash call with workdir/effects
args ⇒ end-cap DENY with the exact stable reason (the bash projection change must not
open a guard gap) — unit level in the h3 seam suite pattern or a small dedicated file
(ONLY if a new file: it moves the pin — prefer extending an existing suite file to avoid
a pin move; if you must add a file, bump the pin + DEC-1 (h6) entry like H4/H5 did).

## Part 3 — Production wiring check (plan §8)

a6a already proves the four bind paths (fresh root / fresh member / cold root / cold
member): exactly one listener + one guard each, disposers drain, no-permissions installs
nothing. Verify + record: the bash workdir authority resolver uses the PER-AGENT session
workspace basis (the same lazy `agentCtx.agent?.session?.header?.cwd` closure the file
rules and operations use — `agent-bindings.mjs` L1233–1248). Unit-level: a6a's cwd-lazy
leg (FACT 3b) + the H5 fake-resolver legs; live-level: L2 below (each agent's bash
workdir resolves against ITS session cwd). No global `process.cwd()` anywhere in the
permission path (grep assertion in the report).

## Part 4 — Live smoke (plan §9) — world home + kit

Derive the kit from the H3 kit (`dev/agent-workflow/evidence/alpha2-hardening/h3/kit/
a2permh3-{setup,boot,check,legacy}.mjs` + its closure-report.md + the raw audit trail
showing the readout mechanics) into `a2permhf-{setup,boot,check}.mjs` under
`dev/agent-workflow/evidence/alpha2-hardening-followup/h6-closure/kit/`. Changes:
- NEW world home `references/.dsh-test-a2permhf-<UTC ts>` (ephemeral, gitignored, never
  committed — like the H3 worlds). Host port **3181**, mock port **3493** (verified free;
  **3180 = user tsx, NEVER touch; 3080 = main instance, ZERO-TOUCH**). The boot script's
  dump-config P6T6_URL check must point at the H6 WORKTREE's plugin.mjs (the H3 first-
  world bug — see h3 evidence `setup-failure.json` + deviation D1).
- World policy: extend the H3 world with (a) an exact DENY rule whose path runs THROUGH
  a junction (L1), (b) bash on an ASK lane (L2) — e.g. worker-a policy `default: ask`
  (bash not in any lane) or an explicit ask lane; keep the H3 lanes so the L3 hostile
  legs work unchanged.
- **L1 — exact-rule topology retarget (node fs, NOT PowerShell — non-interactive
  Remove-Item prompts/fails on junctions; the parent pre-validated the node mechanics on
  this host 2026-09-11: `fs.symlinkSync(target, alias, 'junction')` no-admin,
  `fs.rmdirSync(alias)` unlinks the link only, `fs.realpathSync` follows it):**
  - T0: `<workspace>/alias` junction → `<workspace>/dirA`; files `dirA/secret.txt`
    ("A-payload") + `dirB/secret.txt` ("B-payload"); policy exact DENY on
    `alias/secret.txt`; agent reads `alias/secret.txt` ⇒ static DENY, zero requests,
    body 0.
  - retarget: `rmdirSync(alias)` + `symlinkSync(dirB, alias, 'junction')`.
  - T1: agent reads `alias/secret.txt` again ⇒ STILL static DENY, zero requests, body 0
    (fresh rule resolution — with the pre-H4 cache this leg would have downgraded to
    ASK: the rule key cached at the dirA identity vs the operation's dirB identity).
  - Also record the realpath flip (dirA→dirB) in the evidence (the topology actually
    changed — no fake).
- **L2 — bash scope distinction:** with bash on the ASK lane, drive (via the mock
  script) three foreground bash calls, same command (e.g. `echo a2hf-scope-probe`):
  (i) `workdir: 'dirA'`; (ii) `workdir: 'dirB'`; (iii) same authority args as (i)
  (`workdir: 'dirA'`) with a NEW callId/correlation. Assert from the durable ledger:
  req(i) vs req(ii): `operationFingerprint` DIFFERS, `requestId` DIFFERS, summaries
  distinguishable (the cwd tokens differ); req(i) vs req(iii): `operationFingerprint`
  SAME, `requestId` NEW (different correlation ⇒ new request, no consumption).
- **L3 — hostile regression:** the existing env-gated seam
  (`POST /__hardening/hostile-prepend {agent}` with `DSH_HARDENING_PROBE=1` — verify the
  route still exists at the int tip; it is a REMOVAL CANDIDATE before RC, still present
  now): hostile prepend-allow on a policy-ALLOWED read ⇒ byte-exact end-cap reason, zero
  body effect, zero control requests (reuse the H3 hostile legs).
- **L4 — cold resume:** the H3 cold battery on the same world: after cold-resume,
  listener+guard rebuilt (one each), exact-rule fresh canonicalization still holds
  (re-run the L1 T1 decision pattern post-resume), bash fingerprint projection
  consistent (same args ⇒ same fingerprint on the cold ctx).
- Check outputs: `h6-live-<ts>.json` (fresh) + `h6-cold-<ts>.json` + the raw audit trail
  (setup/boot logs, mock log, dump-config, instance logs, state, live counts) — the H3
  pattern; verdicts in the style of the H3 closure report.

## Part 5 — Full parity + gates (plan §10.2/§10.3)

- Runtime FULL suite + domain FULL suite + testkit suite: record pass/fail counts.
  **No-new-deterministic-failure rule**: the baseline failing set is the H3 closure's
  (runtime 1517 passed / 9 failed = the H1 baseline 8 + 2 concurrent-load flakes
  `rmr-remote-mount-race` + `p6t1-parallel`; domain 378/10 same 10 pre-existing —
  `dev/agent-workflow/evidence/alpha2-hardening/h3/closure-report.md` +
  `h3-parity-flake-rerun.txt`). Your tip adds the h4/h5 test files (new passes) — the
  FAILING set must be a SUBSET of that baseline (+ any flake that reproduces only
  under concurrent load: re-run it in ISOLATION, record green, document like H3 did).
  List baseline vs tip failing set + the diff explicitly.
- typecheck all 9 packages → 0; build all → 0; `pnpm -r run build:composition` → OK +
  the committed-artifact check (the H1 D7/H3 pattern: artifacts 1080, dist delta
  expected ONLY for the runtime package — verify and record the delta files).
- **EOL platform behavior (autocrlf=true machine)**: a fresh build:composition
  re-pollutes the LF-pinned dist glue with CRLF — restore the committed LF form
  (`git checkout -- <glue paths>` after the build) and re-verify (H2/H3 pattern:
  0 CRLF in the glue; record the actuals).
- **CORE PATCH BUDGET 0**: `git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use
  status --porcelain` EMPTY + HEAD `a66e470204`.
- p4t6 pin: verify the scanner at the final pin (670 if H4/H5 each added one file and
  you added none; 671 if you added a file — record which).
- Tear down the world cleanly (stop host + mock; 3181/3493 free again; the world home
  under references/ stays ephemeral — record that it is NOT committed).

## Part 6 — Closure report + commit

`dev/agent-workflow/evidence/alpha2-hardening-followup/h6-closure/`:
- `matrix.md` — plan §13 closure matrix R1–R5, B1–B7, C1–C2, P0-1..3, L1–L3, each row →
  unit evidence (suite + test name) AND live evidence (check id in h6-live/h6-cold
  JSONs) where applicable; A5/A11-style rulings where a leg is covered by unit-only.
- `runtime-parity.txt` (full consoles), `live.json`, `cold.json` (the verdict JSONs),
  `closure-report.md`: baseline (int tip pre-H6 = post-H5) → this tip; P1-A + P1-B closed
  with the RED/GREEN proof chain (H4/H5 consoles); the matrix condensed; the P0
  10-property table; wiring table; live L1–L4 table with the realpath flip + fingerprint
  diffs + requestIds; parity failing-set diff; gate actuals (focused, typecheck, build,
  composition, EOL, pin, references); the plan §14 DoD checklist with per-item evidence
  pointers; the kept-debt list (plan §15: READ_LIMIT drift, PF-1, PF-2, hostile-seam
  removal before RC, baseline failures, alpha.3 — plus the H5 projection-ruling's
  policyWorkspaceRoot note); VERDICT: alpha.2 permission baseline FROZEN (again) or the
  exact gap.

ONE commit: `H6 alpha.2 follow-up closure — ...` (evidence + kit + any unit leg).
Worktree porcelain-clean, scratch deleted, NO push.

Final message: commit SHA, all gate actuals (numbers), the L1–L4 verdicts, the parity
failing-set diff, pin line, references line, deviations, worktree clean, no push.

## Deviation protocol

Gate failure / RED that doesn't reproduce / live leg that can't run: STOP, `deviation.md`
with evidence + the conservative position (e.g. "L1 blocked: junction creation denied"
→ record + unit-only coverage stands + parent decides). Never weaken a security contract,
never skip a plan §14 DoD item silently — an unmet DoD item makes the VERDICT "GAP: ...".
