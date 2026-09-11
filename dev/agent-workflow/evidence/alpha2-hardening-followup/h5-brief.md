# H5 BRIEF — alpha.2 hardening follow-up, P1-B: bash fingerprint must bind execution effect

You are the sole writer for task `task/alpha2hf-h5-bash-effect` in worktree
`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\alpha2hf-h5` (base = the int tip AFTER
H4 integration — it contains the H4 cache deletion). Read `docs/ROUTER_RULES.md` and
`docs/TEST_METHODS.md` in this worktree first. The parent-verified upstream references live
in the MAIN worktree `D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use`
(pinned 0.1.2-rc.1 @ `a66e470204`) — READ-ONLY, never write there.

## Mission

Close P1-B of the follow-up repair plan (`docs/plans/active/dsh-agent-team-alpha2-hardening-followup-repair-plan.md`
in the main worktree, gitignored — not in your worktree): the bash operation fingerprint
currently binds ONLY `commandHash`. Pinned-upstream `BashToolArgs` has four more
security-relevant fields that change the execution effect: `workdir` (WHERE the shell runs),
`run_in_background` (detached job vs foreground), explicit `timeoutMs`, and
`sandbox_permissions` (requested sandbox mode). A durable approval for `bash -c X in /A`
must not authorize `bash -c X in /B`, nor a background start, nor a different timeout, nor a
sandbox escalation. Extend the projection — WITHOUT shell parsing, WITHOUT a ControlService
change, WITHOUT touching the P0 end-cap.

## Parent-verified upstream facts (do not re-litigate)

`packages/shell/tool-bash/src/index.ts` @ a66e470204 (main worktree):
- L44–52 `BashToolArgs`: `command: string` (required), `description: string` (required),
  `timeoutMs?: number`, `workdir?: string`, `run_in_background?: boolean`,
  `sandbox_permissions?: string`, `justification?: string`.
- L54–67 `validateBashArgs` (command/description non-empty after trim; `timeoutMs` present
  ⇒ finite and > 0; escalation pairing via `validateEscalationArgs`): runs INSIDE
  `execute` (L330) — i.e. AFTER the pre-execute waterfall.
- L143–155 `resolveWorkdir`: `sessionCwd = policyWorkspaceRoot ?? canonicalPath(headerCwd)`;
  omitted ⇒ sessionCwd; relative ⇒ `resolvePath(sessionCwd, rel)`; absolute ⇒ as-is.
  (In the current Team composition no sandbox executor is mounted, so
  `policyWorkspaceRoot` is undefined and the basis is the session cwd — verify this in the
  live world during H6; record it in `upstream-contract.md`.)
- L255–256: `run_in_background` boolean param; L348–378: `true` ⇒ `jobs.start` (detached,
  no timeout applies); else foreground `ctx.shell.run`.
- L258–268: `sandbox_permissions`/`justification` advertised only when a sandboxing
  executor is mounted; L332–338 escalation approval via `ctx.approval` before execution.

Reachability (settled by the parent — this is WHY the fail-closed validation below is
REQUIRED, not defense-in-depth): `packages/core/tools/src/index.ts` @ a66e470204
L1402–1407 materializes arguments (lossless JSON only) → L1466–1469 runs the
`tools/pre-execute` waterfall → L1523–1540 dispatches to `tool.execute`. NO parameter-schema
validation happens before the waterfall ⇒ malformed effect-field types (non-string workdir,
non-boolean run_in_background, invalid timeoutMs, non-string sandbox_permissions) DO reach
the Team listener.

Resolver seam (your worktree): `packages/runtime/src/plugin/live/agent-bindings.mjs`
L1233–1248 — `resolveTarget(path)` reads `agentCtx.agent?.session?.header?.cwd` LAZILY and
wraps `fsBackend(agentCtx).resolve(path, { cwd })` → `{ key: String(target.targetKey),
display: String(target.displayPath) }`. Upstream `fs-local` `resolveLocalTarget`
(`packages/fs/fs-local/src/fsio.ts` L146–194 @ a66e470204) is realpath-derived AND
existence-tolerant: missing paths resolve via the nearest-existing-ancestor realpath +
missing suffix (so a not-yet-created workdir dir gets a stable key; only an empty path or a
through-file segment fails).

Current code (your worktree, post-H4):
- `packages/runtime/operation-permission/canonical-operation.ts`: L411–427 the tool-level
  (bash) branch — resource `{ kind: 'tool', key: 'bash', display: 'bash' }`, projection
  `{ tool: 'bash', commandHash: hashString(command) }`, resolver never called;
  L492–522 `resolveResource` (the validated resolver wrapper — REUSE it);
  L315–329 `extractBashCommand` (the fail-closed extraction pattern to mirror).
- `packages/runtime/operation-permission/errors.ts`: the closed
  `CanonicalizationFailureReason` set (append to it — see below).
- `packages/runtime/operation-permission/types.ts`: `CanonicalOperation` (optional
  presentation fields allowed — see below).
- `packages/runtime/operation-permission/pre-execute-adapter.ts`: the bash summary/preview
  builder (H2: 120-char whitespace-flattened non-authority preview; grep `bash` + the
  preview/cap) — extend per the UX ruling below.
- `packages/runtime/test/a2-canonical-operation.test.ts`: the projection tests (update the
  bash legs to the new projection; keep the file-tool legs untouched).

## Design (parent ruling — implement exactly this)

**Projection** (fingerprint input — `canonicalJson` key-sorted, no display strings):
```
{ tool: 'bash', commandHash, workdir, runInBackground, timeoutMs, sandboxPermissions }
```
- `commandHash` — UNCHANGED (raw command, no normalization — H2 ruling).
- `workdir` — the CANONICAL KEY via the EXISTING seam:
  `const t = await resolveResource('bash', workdirInput, resolveTarget)` and
  `workdir: t.key`. This is the plan's "canonical/effective authority representation" and
  gives the ideal property (same effective workdir ⇒ same key ⇒ same fingerprint;
  different ⇒ different): the seam's cwd basis IS the session cwd (lazily read per call —
  the same basis the operation and the rules use), and fs-local's realpath identity makes
  omitted-workdir (`'.'`) ≡ explicit-workdir-equal-to-session-cwd (plan B2) hold naturally,
  and symlinked/junctioned workdirs bind their REAL identity. The RESOURCE stays
  `{ kind: 'tool', key: 'bash', display: 'bash' }` (plan §3.2 — tool-level only; the
  workdir key enters the FINGERPRINT, not the resource).
- `runInBackground: args.run_in_background ?? false`.
- `timeoutMs: args.timeoutMs ?? null` — the EXPLICIT value only; never substitute a
  deployment default or the executor cap (plan §4.4).
- `sandboxPermissions: args.sandbox_permissions ?? null` — the requested mode string only;
  do NOT re-validate mode legality at the Team layer (upstream is the authority at
  execution).

**Workdir input normalization** (mirror the tool's own defaulting — the established
module pattern for read/edit fields):
- `undefined` → `'.'` (omitted = session cwd — `'.'` resolves against the seam's cwd
  basis to the session cwd itself).
- a string that is empty/whitespace-only → `'.'` (upstream `resolvePath(cwd, '')` = cwd —
  an empty-string workdir is EFFECTIVELY the session cwd; recording this ruling).
- a non-string → fail closed `bash-workdir-not-a-string`.
- `'.'` (or the explicit path) then goes through `resolveResource` (the existing validated
  wrapper) — its rejection/malformed/empty-key results fail closed with the EXISTING
  closed reasons (`resolver-threw` / `resolver-result-malformed` / `resolver-key-empty`) —
  do NOT mint new reasons for resolution failures.

**Effect-field extraction** (new `extractBashEffects` next to `extractBashCommand`;
each malformed shape fails closed BEFORE the resolver call, zero backend round-trips):
- `run_in_background`: `undefined` → `false`; present and not a boolean →
  `bash-run-in-background-not-boolean`.
- `timeoutMs`: `undefined` → `null`; present and not (finite number > 0) →
  `bash-timeout-ms-invalid`. (Mirrors upstream `validateBashArgs` L61–63.)
- `sandbox_permissions`: `undefined` → `null`; present and not a string →
  `bash-sandbox-permissions-not-a-string` (any string, including `''`, is its own value —
  upstream rejects illegal values at execution; the Team layer does not mint authority for
  anything that will never execute).
- `description` / `justification`: EXCLUDED from the projection (display/explanation
  metadata — plan §4.2/§4.5). No validation of them at all (upstream's job).

New closed reasons (errors.ts): exactly four — `bash-workdir-not-a-string`,
`bash-run-in-background-not-boolean`, `bash-timeout-ms-invalid`,
`bash-sandbox-permissions-not-a-string`. (The `justification`-only and
`sandbox_permissions`-pairing checks stay upstream — do NOT add pairing validation.)

**`CanonicalOperation` addition** (types.ts): one optional presentation field,
`workdirDisplay?: string` — set ONLY for bash, to the resolved workdir target's `display`
string (JSDoc: presentation-only, NEVER part of the fingerprint/scope/authority — the
fingerprint carries the opaque key; the display exists solely for the approval summary).
The module doc of canonical-operation.ts: the bash section's "the resolver is never called"
statement becomes "the resolver is consulted exactly once — for the workdir authority key
(the resource stays tool-level; plan §3.2)".

**Approval summary UX** (pre-execute-adapter.ts, the H2 bash preview builder): extend from
`bash <preview>` to
```
bash [cwd=<workdirDisplay>] [background] [sandbox=<mode>] [timeout=<n>ms] <command preview>
```
— all four bracketed tokens conditional (only when present/non-default: `cwd` when
`workdirDisplay` differs from the plain omitted case is NOT the test — always show `cwd=`
for bash since the workdir is always effective; `background` when `runInBackground` is
true; `sandbox=<mode>` when `sandboxPermissions` is non-null; `timeout=<n>ms` when
`timeoutMs` is non-null), command preview keeps the existing 120-char cap and
whitespace-flattening. STILL non-authority: the summary is never in the fingerprint/scope;
add a unit leg proving it (two long commands sharing the 120-char prefix but differing
after ⇒ DIFFERENT fingerprints via commandHash ⇒ the preview is not the authority).

**Untouched**: the A3 matcher, the P0 end-cap (H1), H4's fresh rule canonicalization,
ControlService, remote protocol, the glue (NO new seam — the existing `resolveTarget` is
used), shell parsing (forbidden), `description`/`justification` authority.

## RED probes (commit 1 — NO product changes)

New file `packages/runtime/test/h5-bash-effects.test.ts` (a5a-style env; a fake resolver
mapping `.` / `/A` / `/B` / relative paths to distinct stable keys — model: session cwd
`/A`, so `'.' → keyA`, `'/A' → keyA`, `'sub' → keyA-sub`, `'/B' → keyB`). Legs (greppable
names `H5-B1`…`H5-B8`, `H5-C1`, `H5-C2`, `H5-S1`):

- **H5-B1** same command, workdir `/A` vs `/B` ⇒ fingerprints DIFFER (pre-fix: identical ⇒ RED).
- **H5-B2** workdir omitted vs explicit `/A` (same effective cwd) ⇒ fingerprints SAME
  (effective-canonical ruling; pre-fix they are "same" trivially — make the probe assert
  via the NEW projection semantics so it is meaningful post-fix: assert same fingerprint AND
  that both use keyA — i.e. the probe is a GREEN guard for the ruling, document it as such).
- **H5-B3** `run_in_background` omitted/false vs `true` ⇒ DIFFER (pre-fix same ⇒ RED).
- **H5-B4** `timeoutMs` omitted vs `10000` ⇒ DIFFER; `10000` vs `20000` ⇒ DIFFER
  (pre-fix same ⇒ RED).
- **H5-B5** `sandbox_permissions` absent vs `'workspace-write'` ⇒ DIFFER;
  `'workspace-write'` vs `'danger-full-access'` ⇒ DIFFER (use only modes the pinned
  upstream constructs — dsh-sandbox `ESCALATION_TARGETS`; pre-fix same ⇒ RED).
- **H5-B6** `description` A vs B ⇒ SAME; `justification` A vs B (same
  `sandbox_permissions`) ⇒ SAME (GREEN guard — excluded fields; also assert post-fix).
- **H5-B7** `echo x` vs `echo  x` (raw differs) ⇒ DIFFER (GREEN guard — H2 behavior).
- **H5-B8** malformed effect fields ⇒ fail-closed DENY, ZERO durable request, ZERO body,
  `onObserve` canonicalization row with the closed reason: (a) `workdir: 42`;
  (b) `run_in_background: 'yes'`; (c) `timeoutMs: -1`; (d) `timeoutMs: '10000'`;
  (e) `timeoutMs: Infinity`; (f) `sandbox_permissions: 42`. (Pre-fix: the fields are
  silently ignored and the call proceeds normally — with an ask policy a request is minted
  ⇒ the deny/no-request assertions are RED.)
- **H5-C1** same authority args + NEW callId (new correlation) ⇒ SAME fingerprint, NEW
  request (pre-fix the "same fingerprint" half is trivially true — the leg's value is
  post-fix: the workdir key is in it).
- **H5-C2** an approval minted for fingerprint F (workdir /A) is NOT consumed by a
  different-fingerprint operation (same command, workdir /B, same correlation) ⇒ new
  request (scope exactness under the new projection).
- **H5-S1** summary: the request `summary` for a bash call with workdir `sub`,
  `run_in_background: true`, `timeoutMs: 5000` matches the exact expected string
  `bash [cwd=<display>] [background] [timeout=5000ms] <preview>` (per the ruling; pre-fix
  the summary lacks the tokens ⇒ RED) + the preview-cap non-authority leg (120-char
  shared prefix, different tails ⇒ different fingerprints).

Commit 1 evidence: console with B1/B3/B4/B5/B8/S1 RED, B2/B6/B7/C1/C2 green-or-documented.
If a "RED" leg does not go red: STOP + deviation record (plan §16), conservative choice.

## Fix (commit 2 — GREEN)

Implement the design. h5 suite fully GREEN. Re-run focused suites (must stay green —
especially `a2` bash legs UPDATED to the new projection, `a5a`, `a6a`, `h1a` 40/40, and
`packages/tools` `h3-hostile-seam` 10/10 — the bash summary change flows into live
summaries, unit-level only here):

```
pnpm --filter @dsh-agent-team/runtime exec vitest run test/h5-bash-effects.test.ts test/a2-canonical-operation.test.ts test/a3-permission-resolver.test.ts test/a4a-control-exact-scope.test.ts test/a5a-pre-execute.test.ts test/a6a-production-wiring.test.ts test/h1a-pre-execute-endcap.test.ts
pnpm --filter @dsh-agent-team/domain exec vitest run test/a1-permission-policy.test.ts
pnpm --filter @dsh-agent-team/tools exec vitest run test/h3-hostile-seam.test.ts
```
(Actual file names in this tree: `a4a-control-exact-scope.test.ts`; `a1-permission-policy.test.ts` lives in the **domain** package — run it with the domain filter, as H4 did.)

## Gates before you finish (record actuals)

1. Focused suites above: all green, actual counts.
2. **p4t6 pin**: new scannable file moves the pin 669 → 670 (H4 took 668→669) — add the
   DEC-1 `(h5)` entry naming `h5-bash-effects.test.ts`; verify with the pin scanner as
   H4 did (see its evidence in `dev/agent-workflow/evidence/alpha2-hardening-followup/`
   once present, or `alpha2-hardening/h1|h3` for the command).
3. `pnpm --filter @dsh-agent-team/runtime run typecheck` → 0 (and `tools` if it has a
   typecheck script).
4. `pnpm --filter @dsh-agent-team/runtime run build` → 0; `pnpm run build:composition`
   (root script — there is no per-package script; H4 note)
   → OK; then the autocrlf=true CRLF re-pollution restore + re-verify (known platform
   behavior; restore the committed LF dist-glue form).
5. **CORE PATCH BUDGET 0**: references porcelain EMPTY @ `a66e470204`; never write there.
6. Worktree porcelain-clean, scratch deleted, **NO push**.

## Evidence (commit with your code, in THIS worktree)

`dev/agent-workflow/evidence/alpha2-hardening-followup/h5-bash-effect/`:
- `red-console.log`, `green-console.log` (full vitest consoles)
- `upstream-contract.md` — path + pin (@ a66e470204) + key behavior for EACH of: the
  Bash DTO (tool-bash L44–52), `validateBashArgs` (L54–67) and its INSIDE-execute position
  (L330), `resolveWorkdir` (L143–155, incl. the policyWorkspaceRoot precedence + the
  current-composition basis = session cwd), background execution (L348–378 `jobs.start`),
  sandbox escalation path (L258–268 advertised only with a sandboxing executor, L332–338
  approval), fs-local `resolveLocalTarget` (fsio.ts L146–194, realpath + ancestor-walk
  existence tolerance), AND the dsh-tools `prepareExecution` ordering (core/tools
  index.ts L1402–1407 / L1466–1469 / L1523–1540) proving the waterfall precedes any
  argument validation (the B8 reachability proof).
- `projection-ruling.md` — the final projection, the workdir seam ruling (why
  `resolveTarget(args.workdir ?? '.')` satisfies the ideal property in the current
  composition; the empty-string = omitted ruling; the policyWorkspaceRoot note as a V2
  consideration if a sandbox-mounted composition ever appears), the four new closed
  reasons, the excluded fields, the summary format + non-authority proof, the
  CanonicalOperation `workdirDisplay` presentation field.

## Deviation protocol

Any contradiction with the verified facts, any RED not reproducing, any gate failure:
STOP, `deviation.md` with evidence + the conservative choice. Never weaken the security
contract to make a test pass.

## Commit structure (exactly 2 commits)

1. `H5 alpha.2 follow-up — commit (a): RED probes for the bash effect fingerprint (h5-bash-effects.test.ts: B1 workdir A/B, B3 background, B4 timeout, B5 sandbox mode, B8 malformed effect fields fail-closed, S1 summary tokens — RED on the command-only projection; B2/B6/B7/C1/C2 guards; evidence red-console.log + upstream-contract.md)`
2. `H5 alpha.2 follow-up — commit (b): bash projection binds the execution effect — {tool, commandHash, workdirKey via the existing resolveTarget seam (args.workdir ?? '.'), runInBackground ?? false, timeoutMs ?? null explicit-only, sandboxPermissions ?? null}, four new closed fail-closed reasons, description/justification excluded, CanonicalOperation.workdirDisplay presentation field, summary 'bash [cwd=..] [background] [sandbox=..] [timeout=..ms] <preview>' non-authority; h5 all-green + focused suites green (a2 bash legs updated, h1a 40/40, h3 seam 10/10); pin 669->670 (DEC-1 (h5)); evidence green-console.log + projection-ruling.md`

Final message: the two commit SHAs, focused-suite actuals, pin verification line, gate
actuals, the upstream-contract.md reference list, any deviations, worktree
porcelain-clean, no push.
