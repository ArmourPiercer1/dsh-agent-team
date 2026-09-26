# S5 BLOCKER — boot-1 fence veto of the glue's own bootstrap (S1 exact-claim regression)

Date: 2026-09-26T17:25Z (run stamp 2026-09-26T17-25-50)
Status: HARD BLOCKED — the S5 kit cannot run against the S1+S2 fix (worktree tip `833c6999`).
Every world (A–F) fails identically at boot 1 (CREATE phase) with a FATAL. Reported to the
parent (session-74b4235e) 2026-09-26T17:3xZ. Awaiting a product fix (S3 or later) or a
confirmed kit-setup delta before re-running.

## Symptom

```
[dsh-agent-team] bootstrap FAILED: TeamSessionActivationInterceptedError:
  dsh-agent-team: intercepted foreign Agent activation for Team-managed
  session "session-rst017s5-boot-<stamp>"
    at beforeAgentCreated (team-session-activation.js:439)
    at ctx.on.global (host.js:468) → agent announce → publish
```
The kit's row-readiness gate (p6t6 health `setupError`) detects this and dies (FATAL), so no
world reaches boot 2 / the World-A gate / F1–F3.

## Probe evidence (world-A/boot-1/probe-events/fence-probe-events.jsonl)

```
17:25:57.212 agent/created  sid=session-rst017s5-boot-…  source=startup  veto=false permitted=false
17:25:57.233 agent/disposed sid=session-rst017s5-boot-…
```
`veto=false` is the PASSIVE probe's own decision (`reject:false`); the PRODUCTION fence (registered
after the probe) is the one that rejects → the AgentLoop rolls the agent back (agent/disposed).

## Diagnosis (product, S1 58d30de)

1. S1 changed the production C1 fence to the "exact-generation claim" model. `beforeAgentCreated`
   (`team-session-activation.ts:606–670`) PASSES a Team-managed session's activation ONLY if:
   - (a) `owner === undefined` (not Team-managed), OR
   - (b) `claimMatches` — the EXACT claimed Agent object matches (`claim === input.agent`), OR
   - (c) a valid one-shot ordinary permit.
   Otherwise it mints an epoch and REJECTS as "foreign".
2. For the boot-1 boot-root bootstrap: the ownership resolver IS bound early in `bootstrap()`
   (`host.ts:1375`, `resolveOwningTeamRoot`) → the boot root classifies as Team-managed, so (a)
   is false. The claim does NOT match the announced Agent, so (b) is false. No permit, so (c) is
   false. → foreign VETO.
3. The glue DOES wrap the boot-root bootstrap in the claim path:
   - `createRootAgent` (`agent-bindings.mjs:3042–3072`) → both branches guarded:
     - durable exists → `resumeTeamAgent` (line 3056)
     - else → `createTeamAgent` (line 3064)
   - both → `runOwnedActivation` (line 979) → `teamOwnedSetup` (line 940) →
     `fence.claimOwnedGeneration(sid, setupAgent)` (line 948).
   - `claimOwnedGeneration` is gated on the runOwned ref-count
     (`ownedDepthBySession.get(sid) > 0`; `team-session-activation.ts:592`).
4. Upstream ordering (`deepseek-harness-test-use/packages/core/agent-loop/lib/index.js`):
   `setup?.(prepared.agent.ctx, prepared.agent)` runs BEFORE `prepared.publish(source)`, and the
   announced Agent is the SAME `prepared.agent` instance. So `setupAgent === input.agent` and the
   claim should be set before `beforeAgentCreated`.
5. ⇒ In this real host boot the claim is NOT matching at announce time. The narrow gap is one of:
   - the runOwned ref-count (`ownedDepthBySession`) is 0 when `claimOwnedGeneration` runs (the
     claim is silently not accepted, line 592 early-return), OR
   - the boot-1 bootstrap path does not actually hold the runOwned guard (e.g. the production
     root's `boot()` / first-root create is not wrapped in `runOwnedActivation` on this path), OR
   - the claimed Agent object identity diverges from the announced Agent on this path.
   Any of these means the glue's OWN boot-1 bootstrap is not recognized as the claimed
   generation, so the fence rejects it as foreign.

## Why this is a regression vs commit4

- commit4's kit ran against `f3d5a71b` (BEFORE S1 58d30de). The pre-S1 fence used the
  `ownedDepth` window (not the exact-claim), so the boot-root bootstrap passed.
- S1's exact-claim model is stricter and now rejects the boot-root bootstrap.
- S1's suite (A1–A15, G1–G10) validates fence+glue in factory worlds and does NOT exercise a real
  host boot-1 bootstrap, so this gap is not caught. (S1 verification.md "ZERO new failures" is
  against the pre-existing debt set, not a boot-1 real-host case.)

## Why it is HARD-BLOCKED (not workable around within the red lines)

- The fence's claim logic is internal to the dsh-agent-team plugin (product); red lines forbid
  product edits. I cannot make the fence accept the boot-root bootstrap.
- The kit patch layer (`writePatchFile`) is byte-identical to commit4's (passive fence-probe first,
  `dsh-agent-team/host` row, `p6t6-team-tools`, `team-spill-local`) — so this is NOT a kit-setup
  mismatch fixable in `supplement-s5/`. The passive probe (`reject:false`) is an observer only; it
  does not set/consume the claim and is not the cause.
- Every world fails identically at boot 1 → the entire S5 run is blocked.

## What is ready to re-run once the product gap is fixed

- `kit-s5.mjs` (2682 L, `node --check` OK) — full A–F kit: World A strict §5 browser gate
  (unconditional), Worlds B–E = commit4 verbatim, World F new (F1 two-ensure race ×20 / F2 member
  single-flight / F3 ordinary-first handoff), S0 preflight, per-world evidence, self-teardown.
- `browser-gate-driver-v2.mjs` (383 L, `node --check` OK) — strict §5 driver (no
  reload/blank/switch; role/text locators + a11y snapshots; observation-only evaluate; expected
  FAIL at step 10 per S3 NO-GO-C1 + Q2-FINDING).
- S0 preflight ALL GREEN (`preflight-s5.json`): test-use @ `46a7f68b09` pristine, worktree @
  `833c6999`, CLI 0.1.7-rc.1, artifacts 1196, ports 3492/3497 free.
- Environment clean; ports free; no leftover procs; World A home retained.

## Ask (sent to parent)

1. A product fix (S3 or later) so the boot-1 boot-root bootstrap is the claimed generation (or the
   row's own bootstrap bypasses the fence) — then re-run the full A–F immediately; OR
2. Confirmation that the S5 kit's row-config/patch-layer is expected to differ from commit4's for
   the S1+S2 fence — if so, the exact delta, and I'll update `supplement-s5/` and re-run.

## Evidence

- `supplement-s5/preflight-s5.json` (S0 all green)
- `supplement-s5/run-s5-all.log` (full run; FATAL at World A boot 1)
- `supplement-s5/checks.json`, `supplement-s5/post-stable-probe.json`
- `supplement-s5/world-A/setup-failure.json` (error + stack)
- `supplement-s5/world-A/boot-1/instance.log`, `boot-1/probe-events/fence-probe-events.jsonl`
- `tests/homes/rst017-s5-2026-09-26T17-25-50-A/` (retained)

## Red-line compliance

No product/test-use edits, no push, no tracked-file edits outside `supplement-s5/` +
`tests/homes/`, workspace-write only, :3080/:3180/:3491 untouched. Temp fragments
`_worldA-strict-fragment.mjs` / `_worldF-fragment.mjs` still present (delete on finalize).
