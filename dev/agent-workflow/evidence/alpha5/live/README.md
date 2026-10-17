# Alpha.5 live round — PR3 live-assembly slice (Scope-4)

Baseline: `origin/alpha5-int-wiring @ 2c955133` (fixed SHA, branch `alpha5-live-pr3`).
Host: `tests/deepseek-harness-test-use` pinned pristine @ `639ed01539` (0.2.0-rc.2), reused built.
Port 3186 · mock model 3499 · worlds `tests/homes/a5live-*` (created and deleted per run).
Stable `:3080` probed read-only (401) before/after every run; host tree porcelain = 0 at every check.

## Files

| file | role |
| --- | --- |
| [`a5live-fixtures.mjs`](./a5live-fixtures.mjs) | plain-ESM port of the PR1/PR2/PR3 lane builders, importing THIS worktree's built dist through public barrels only (`controlled-fs/src/index.js`, `tool-admission/index.js`, `tool-dispatch/install.js`, `domain/tool-governance`) |
| [`a5live-assembly-row.mjs`](./a5live-assembly-row.mjs) | the test-side LIVE assembly, a plain plugin row mounted through the public profile-patch seam; resolves the real session Agent via the public `ctx.agents` seam; routes `/__a5live/{health,journal,state,agents,assemble}` |
| [`run-live-assembly.mjs`](./run-live-assembly.mjs) | runner: boot → create → setup turn → assemble → scripted tool turns → LIVE route reads → kit-form criteria → teardown; token redacted at capture (`REDACTED-<sha8>`), raw instance log deleted after redaction |
| `runs/s1s2-2026-10-16T22-05-46Z/` | Phase 1 GREEN 18/18 (criteria.json, live-state.json, live-journal.json, mock-capture.json, instance.log) |
| `runs/g6-2026-10-16T22-06-50Z/` | Phase 2 (G-6) GREEN 19/19 |
| `runs/g7-2026-10-16T22-06-58Z/` | Phase 3 (G-7) GREEN 18/18 |

## Results

**Phase 1 — live assembly minimal slice: GREEN.**
The admission-binding gated face (`createAdmissionGatedControlledFs`,
packages/runtime/controlled-fs/src/admission-binding.ts) assembled INTO a real session Agent
through public seams only. Unbound state = typed refusal live
(`TOOL_BINDING_UNVERIFIED` / `denied` / `effect-outside-grant`, message names `admission-unbound`,
while the raw file is verifiably readable), and the full PR2 flow
bind → grant → ONE controlled FS read ran in-session (content match, exec-time port saw the
BOUND fingerprint, ledger consumed = 1, one-shot refusal on second exec). Both legs ALSO ran
E2E through a model-driven tool call in the real dispatch path (transcript evidence in
`runs/s1s2-2026-10-16T22-05-46Z/mock-capture.json`).

**Phase 2 — G-6 live proven observation: GREEN.**
Guard installed on the real Agent scope, `changeChannelStatus()` === 'armed' pre-change;
after ONE legal registry change (own-tool dispose + re-register — this Host forbids same-scope
overwrite) DELIVERED on the live subscription, the test face live-reads 'proven'
(runner criterion L-G6-PROVEN, `runs/g6-…/criteria.json`). The delivered arm also shows the
targeted cancellation live: `dispatcher-change-abort-issued` = 1 (event originals in
`live-state.json abortIssuedRows`), `dispatcher-call-cancelled-before-body` = 1, body zero-ran,
no unvalidated alarm; trusted rebind restores execution (same arm).

**Phase 3 — G-7 live silent posture: GREEN (injection was feasible; no NOT_RUN needed).**
Same install; the row's wrapped `on` swallows the lane's `tools/change` subscription (kit G-4
form: proxy accepted into the real listener table, forwards nothing; real disposer never called).
Row-owned control subscription proves the registry emitted (control = 2, proxy = 2). The
five-piece loud posture on the LIVE observation stream (runner criterion L-G7-LOUND-PIECE):
`dispatcher-call-executed-unvalidated` ≥ 1, severity=alarm rows ≥ 1,
`dispatcher-definition-change-at-call-edge(reason=definition-drift)` ≥ 1,
`dispatcher-binding-revised(verified=false)` ≥ 1, abort-issued = 0, cancelled-before-body = 0;
channel stays 'armed' end of run; a call edge shows the drifted name unverified; the MOVED body
did run (un-cancellable — that is why the loud report exists).

G-6 pairing honesty: the kit pairs proven/armed inside one process; here the 'armed'
never-delivered read comes from the g7 world (separate run). Cross-run pairing is disclosed;
each individual value is a live read from its own live process.

## Level statement (measurement ≠ acceptance)

- Phase 1 slice, G-6, G-7 as delivered here: **LIVE-CONFIRMED** — observed on the pinned
  production-configuration Host process, real session, real dispatch path, live reads.
- **ENFORCE-CONFIRMED: not reached — ENFORCE-PARTIAL.** Missing items, all recorded:
  1. no OS enforcement plane in this configuration (the guard and the gated lane are
     in-process constructs; a same-privilege bypass is not OS-blocked here — landlock/sandbox
     enforcement dimension untested);
  2. trusted inputs (trustedIdentities, nativeNames) are read live but from fixture-grade
     assembly assumptions (row-owned names), not an OS-anchored identity;
  3. the swallow injection is by construction test-instance-only — the loud posture proves
     DETECTION + REPORT, and cancellation remains cooperative (dispatcher-internal).
- G-g matrix rows stay 未收口 per g-g-support-contract.md (cc47fb18): this round supplies the
  live-wiring EVIDENCE the contract gated on; closure is a Gate (three-reviewer) action, not a
  writer action. Kit-only criteria remain unable to reach ENFORCE level (review bbaf45de P4/P6
  logic unchanged); live criteria inherit the same ceiling.

## Measured Host facts (disclosed, first-time observations of this round)

- A plain profile-patch row's `agent/created` subscription receives NOTHING on this Host in a
  plain-session world; the PUBLIC `ctx.agents.get(sessionId)` (core-plugin pattern,
  file-reference-local `packages/context/file-reference-local/lib/index.js:375`) works — the row
  resolves the Agent there instead (`agent-created-event` never logged; `surface-probe` did).
- `session/prompt` on an unknown id fails `session/not-found` — public `session/create` first
  (matches team-projection-recovery-smoke kit comment).
- Tool registration requires `output { schema, render }` (host core
  `packages/core/tools/lib/index.js:2881`); same-scope re-register THROWS
  (`already registered in this scope`) — the legal Definition replacement is disposer + register.
- Mock-wire truth: tool results ride as Anthropic `tool_result` blocks inside USER messages, and
  successive model requests can show only the newest round — scripts must be monotonic over a
  union (a chain fuse caps any loop; storm was never reachable past 12 scripted requests).
- Earlier failed-run directories under `runs/` are kept (each documents one measured Host fact
  above; their instance logs are redacted, worlds deleted, ports released).

## Closeout (this round)

Three GREEN runs: `s1s2` 18/18 · `g6` 19/19 · `g7` 18/18 (levels above). Sweep verified:
0 `tests/homes/a5live-*` worlds remain · ports 3186/3499 released · host tree porcelain = 0
at `639ed01539` · all instance logs redacted at/after capture (12 killed-run raws swept to
`REDACTED-<sha8>` and the raws deleted) · no raw launch token exists in this evidence tree ·
stable `:3080` untouched (read-only 401 probe only). Runner limitation disclosed: a hard kill
of the runner between boot and finalize leaves `instance.raw.log` for the closeout sweep
(pattern recorded in `tests/homes` §7 cleanup practice).
