# alpha5 / prod-lsp — P-LSP lane: R-1 streaming provider arm + R-2 per-(member × generation) LSP realm assembly (PRODUCTION)

Writer lane, user ruling 2026-10-17 07:53Z (wording below approved verbatim):
「新增独立流式启动方法，复用现有权限/租约/终止机制，旧接口行为不变；策略变化时
销毁并重建对应成员的 LSP 隔离实例。」Scope = this repo's public seam only; upstream
Core untouched; :3080 untouched; other pending items (C12/vNext/OpenAtPort/PTC-net)
unaffected.

- Branch `alpha5-prod-lsp` @ `.worktrees/a5-prod-lsp`, base = master `d714a941`
  PLUS two cherry-picks `-x` of the (not-yet-merged) P-B commits `45436f0f` +
  `3668da59` — REQUIRED because "reuse the P-B assembly parameter surface" and
  "a5p4 66/66" both presuppose P-B's `ProviderAssemblyConfig`. **Stacking is
  disclosed for GLUE-5 dedup: when P-B lands, these two commits drop out.**
- Commits: `7c8a90b8` RED (14 failed | 1 passed pre-impl) → `ab9ee76f` GREEN.
- Worlds: `tests/homes/a5lsp2-*` (self-removed by afterAll); port 3182 declared
  for this lane and **proven idle — never bound by anything in this lane**.

## What shipped (lane-only diff; shared runtime tsconfig already covered `sandbox-provider`)

1. **R-1 — `spawnStreaming()`** (`packages/runtime/sandbox-provider/provider.ts`,
   parallel-additive): prepare ladder unchanged; the launcher-integrity DOUBLE
   gate re-checks the sha byte-pin inside `executeStreaming` BEFORE plan
   consumption (gate refusal never burns the grant — pinned by test); one-shot
   plan law applies to both arms. The handle = `{lease, processIdentity, pid,
   stdin: Writable, stdout/stderr: Readers, exited, terminate()}`. Lease starts
   `active`; `requestCancellation` on a streaming lease moves it to
   `cancelling` and starts the signal sequence but NEVER settles it (frozen
   lease law); `terminate()` = signal (SIGTERM → SIGKILL at grace) + bounded
   await + `settleTermination(confirmed?)`; unconfirmable ⇒ `termination-unconfirmed`
   with `sideEffectUnknown`. `spawn`/`RunOutput`/old `requestCancellation`
   behavior is byte-untouched — the untouched a5p4 66/66 suite re-passes, and
   it CAUGHT a launcher fd-3 self-close regression during this lane (fixed:
   the reservation is computed before any fd allocation).
2. **Launcher stream mode** (`launcher/landlock-prelauncher.py`
   `--confined-exec-stream`): fd-3 launcher-owned handshake line
   `{"stream":true,"pid":N}` (or `{"abi_unavailable":true}` → typed refuse,
   no payload, no lease); the child closes fd 3 (and 0/1/2 per policy) before
   `restrict` → `execve`, so the provider's pipes go straight to the CONFINED
   payload; the parent closes 0/1/2, reaps, writes `exit.json`. No hot-handle
   residue, no file polling.
3. **R-2 — `createLspRealmAssembly()`** (`packages/runtime/sandbox-provider/lsp-assembly.ts`,
   new file INSIDE the lane dir so lane purity/dormancy tests stay untouched):
   one isolated instance per (member × generation) = own provider instance +
   own confined OS process. `ensure` = hot reuse (generation mismatch REFUSES —
   `policyChange` is the single discipline entry); `policyChange` = ① probe-gate
   the NEW realm FIRST (a byte-pin/ABI refusal never disposes the healthy old
   instance) ② dispose old (terminate + bounded OS-confirmed pid exit;
   unconfirmed ⇒ `EXECUTION_TERMINATION_UNCONFIRMED`, old stays registered)
   ③ `spawnStreaming` new + readiness ping over the live pipes; mid-change
   failure terminates the half-built instance BEFORE the refusal returns
   (zero residual handles/pids, proven by a `/proc`+cwd scan); journal kinds
   `policy-change-begin → realm-disposed{lastPid,disposeMs} → realm-assembled{pid}
   → policy-change-complete` (plus `assemble-failed`). Every realm reuses the
   SAME `ProviderAssemblyConfig` (launcher path + sha256 + ABI floor) — the
   double gate guards every realm.

## Criteria ledger (all GREEN on THIS host, real Landlock ABI v4 — no ENV_BLOCK leg)

| # | criterion | evidence |
|---|---|---|
| 1 | old API unchanged (ABSENT face) | a5p4 66/66 re-passed byte-untouched incl. REAL confined-exec leg; face keys = historical ∪ {spawnStreaming, executeStreaming} (smoke) |
| 2 | permission reuse | realm confusion / wrong sha / ABI floor ⇒ typed refusal, ZERO stream spawns; sha-swap re-gate refuses BEFORE consumption, restored pin still streams on the SAME plan |
| 3 | one-shot plan law on the stream arm | consumed plan second `executeStreaming` refused |
| 4 | lease/termination reuse | active→cancelling (request never self-settles) → settleTermination(false)=unconfirmed → (true)=terminated; terminate confirms [SIGTERM]; escalation [SIGTERM,SIGKILL]; unconfirmable ⇒ unconfirmed |
| 5 | streaming positive leg (REAL) | real LSP-protocol fixture (Content-Length framing) behind Landlock: init round-trip (serverInfo pid = handle pid), two hover round-trips, deny-path secret = EACCES inside the child, cwd = generation root |
| 6 | terminate REAL | SIGTERM → /proc pid gone → lease `terminated`; second leg on ping fixture |
| 7 | handshake negatives | `abi_unavailable` ⇒ refuse, no lease; silent handshake ⇒ bounded timeout refuse + launcher killed |
| 8 | cross-member isolation (REAL) | member A/B = two distinct pids, independent ping round-trips; A's policyChange never touches B (B still answers after A's rebuild) |
| 9 | policyChange = LSP-DR four requirements (REAL production version) | old pid exits bounded (OS-probe), new instance assembles + answers, sibling untouched, journal sequence exact; repeated g1→g2 shows dispose,create,dispose,create |
| 10 | failure cleanup (REAL) | (a) wrong pin refuses BEFORE disposing the healthy old instance; (b) mid-change readiness failure ⇒ old pid gone, half-built pid gone, `sampleLaneProcesses` residue == sibling only, member current = undefined |
| 11 | teardown | disposeAll ⇒ all pids /proc-gone, world scan empty, size 0 |
| 12 | build/smoke | lane strict self-typecheck (hygiene 8/8), `pnpm -r typecheck` clean, runtime tsc emit OK, INSTALLED-SMOKE over emitted dist 8/8 (`pl-lsp-smoke-dist.mjs`: ensure+ping+policyChange+pid-gone+disposeAll on COMPILED artifacts) |

## Honest disclosures (wording red lines per R-2 §3)

- The "LSP server" is a **fixture** implementing the real LSP stdio framing;
  this lane proves the PROVIDER/ASSEMBLY seam, not any product editor feature.
- Isolation claim = **realm-granularity**: per-(member × generation) own realm
  (provider instance) + own confined OS process; **policy-granularity eviction
  is NOT claimed** (upstream pool key stays a pure path; renaming it would
  masquerade as policy isolation — forbidden by the brief).
- Termination confirmation reads `/proc` inside this world's PID namespace
  (consistent host per TEST_METHODS; the harness bwrap namespace is uniform).
- Handshake timeout defaults to 15 s and is per-call; terminate windows default
  1.5 s grace / 8 s deadline, per-call override — unconfirmable is a REAL
  settle state, never a silent success.
- `abi_unavailable` stream refusal exists because the stream mode re-measures
  the ABI at exec time; NO-FALLBACK holds on both arms.
- **Stacking**: commits `45436f0f`+`3668da59` (P-B) sit under this branch by
  cherry-pick `-x`; GLUE-5 dedups when P-B lands. dist regeneration deferred
  to GLUE-5 by ruling (installed-smoke rebuilt dist locally, reverted, not
  committed — emitted artifacts verified via import, not shipped).
- Root-suite attribution (measured, not assumed): repo-wide vitest = 7021/7046.
  The 13 failing files were re-run on a base-commit worktree (`d714a941`, same
  host/install): **21 failures exist verbatim at BASE** (0.2.0-rc.2 baseline-pin
  env gap in testkit rc2/plugin-dsh-compat legs, p6t3 world timing, the known
  p6t6-actions debt, the a4p7 composition-smoke leg needing an unbuilt
  `packages/client/dist` in this environment). Exactly 3 stack-attributable
  failures remain, all BOOKKEEPING, none behavioral:
  ① `a5p0-layer-audit` consumer set gained `tools/a5p5-tools/src/register.ts`
  (P-B's register face, not yet in the reviewed set); ② `p4t6-session-event-scan`
  scan-count pin 1157→1166 (P-B + this lane's added files lack the ledger
  "recording the N increments" clause — GLUE-5 writes ONE combined clause for
  the landed stack to avoid double counting); ③ `a4p7` "commit carries its own
  build" leg (dist drift — regeneration is ruled INTO GLUE-5, so this leg is
  red-by-ruling until then). One 4th delta WAS mine and is already FIXED:
  a real `no-undef (Buffer)` lint identity in the LSP fixture — fixed by
  importing `node:buffer` (lane fix, lint leg now closes; fixture re-verified
  green). Nothing in provider/lsp-assembly behavior fails any existing suite.
