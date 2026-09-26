# Architecture decision: C1 client closure = **NO-GO** (empirical)

PR #31 supplemental fix round, per guide `pr31_supplemental_fix_guide.md`
§3.4 / §10 — submitted because the S3 client characterization
(`supplement-client/verification.md`, spike
`packages/client/test/s3-client-generation-spike.test.ts`, run log
`spike-run-1.log`) empirically concluded that the 0.1.7-rc.1 public client
API cannot safely retire/reopen the same-SID failed generation. Per §3.4:
stop continuing C1 client workarounds; reassess A′ (startup ownership
protection) vs B+ (compatibility replacement). Per §8, B+ is NOT started in
this round — this decision is submitted to the lead reviewer for the call.

Upstream under characterization: `tests/deepseek-harness-test-use` pristine @
`46a7f68b0922371ce7144b668b90e377d8e799f4` (0.1.7-rc.1), zero edits.

## 1. The property in question

After a backend restart, the user opens the cold Team root in the published
0.1.7 client. The stock SessionController's ordinary auto-promotion is
vetoed by the C1 activation fence (correct, by design); the client enters its
sticky error state ("会话不可用" / Session unavailable, composer disabled).
The user clicks "以 Team 模式打开" (Open in Team mode) exactly once; the Team
takeover succeeds server-side (one-shot permit consumed, `ensureRootLive`
complete, leader live). **Desired**: the composer is immediately usable on
the same page — no reload, no switch-away-and-back (guide §5 hard gate).

**Observed** (authoritative browser evidence, run 20 keep-mode, published
client `0.1.7-rc.1-46a87f68`:
`phase0/run2026-09-26T07-03-12/legB/q2-browser/Q2-FINDING.md`): the takeover
succeeds server-side, but the composer **remains** `会话不可用` [disabled]
for the rest of the page load; only a full page reload (or any subsequent
open, which re-opens the session directly in Team mode) recovers. No data
loss, no corruption, no extra model traffic — purely a client state-machine
gap.

## 2. Why `refresh` / `openSession` (same id) are insufficient — empirically

The S3 spike (same bench as upstream's `reference-ownership.client.spec.ts`,
driving the published client's own `ClientSessions` + `UiWorkspaceService`
over `RemoteMock`) records, for the exact Q2 sequence:

1. **`sessions.refresh()`** (service.ts:353 — the current product step (c) in
   `team-mount-core.ts openTeamMode`, unchanged in this round) touches only
   the Host catalog. Generation binding identity unchanged; sticky
   `lastAgentError` unchanged. (S3.)
2. **`uiWorkspace.openSession(same id)`** (navigation.ts:200 →
   `replaceMain` at navigation.ts:380) = retain +1 then release −1:
   reference count goes 1 → **transiently 2** → back to 1 — **never 0**
   (captured via a `retainInfo` subscription bump). The failed generation
   survives with its sticky error. (S4.)
3. **`handleConnected()`** (manager.ts:736) rebuilds projections/list state;
   it does not touch scopes — binding identity, `lastAgentError`,
   `openState` all persist. (S5.)

The failed generation's state is **sticky per generation**:
`lastAgentError` (session.ts:590) and the failed-open terminal state
(`openState 'error'` + `openError` via `failEventStream`, session.ts:876 —
note `doOpen` at session.ts:616 swallows a RemoteFailure so
`SessionReference.ready` even RESOLVES for a failed open; the failure lands
as a terminal background failure after the open settles). The composer's
per-binding machine faces (conversation/input, `ui-conversation apply.ts`
244-257; materialization cached per binding object — per generation — at
`ui-session index.ts` 427-430) stay stuck on the failed generation. Only a
**fresh generation** re-materializes them.

## 3. The only path to a fresh generation — and why it is not usable

A generation is invalidated **only** by replacement: reference count → 0
(`retireScope` → `manager.drop`, manager.ts:184) → re-retain materializes a
new Session (`manager.get`, manager.ts:236). The S3 spike verified the
mechanism half works: release-to-0 → re-retain → **fresh generation**, clean
open, sticky state gone (S6→S7: G2 ≠ G1, new `session/follow` open,
`lastAgentError` null; S8: GF2 ≠ GF1 after a failed-open generation).

But for the **main** session the plugin cannot reach 0:

- The `mainView` reference is **privately owned** by the host-assembled
  `UiWorkspaceService` (`mainReference`; `clearMain` is TS-private,
  navigation.ts:372). The plugin's own `sessions.retain/release` moves only
  its own source — the count stays ≥ 1 while `mainView` pins it.
- The **only public call** that releases the mainView reference is
  `uiWorkspace.archiveSession(id)` (navigation.ts:243) — which performs the
  **host-archive side effect** (the session row is archived on the Host; the
  spike recorded the workspaces archive call), and the navigation policy
  then refuses to hold an archived session as main on every reconcile
  (`clearArchivedCurrent`, navigation.ts:364). The public repair is therefore
  the **archive → unarchive → reopen pair** — three side-effectful host
  calls. §3.4 explicitly forbids disguising an archive/navigation side
  effect as a same-page repair without a formal ADR.
- **Seam inventory (runtime-enumerated over both services):**
  `UiWorkspaceService` 22 public methods + `ClientSessions` 30 methods / 5
  properties — **no name matching `/reset|reopen|release|unstick|
  clearError|discard/`** on either surface. (S3-SPIKE-SEAMS.)
- **No provider-replacement slot:** the `UiWorkspaceService` instance is
  constructed inside the host package's own `apply()`
  (`ui-workspace/src/client/index.ts` 100-112). There is no public seam that
  substitutes or overrides the `uiWorkspace` service instance; a replacement
  would (a) require preventing the host-constructed instance from running —
  a core/app patch (CORE PATCH BUDGET = 0), or (b) re-implement the entire
  navigation policy (selection persistence, `restoreSelection`,
  `clearArchivedCurrent`, workspace/blank flows, pin/archive, directory-
  picker bridge) while **still not owning** the `mainView` reference that
  pins the failed generation. That is a navigation-policy fork, not a "small
  client replacement" — Q5 = NO.

**Conclusion (five questions, guide §3.2):** Q1 public reset/reopen seam =
**NO** · Q2 release-to-0 → re-retain builds a fresh generation = **YES** ·
Q3 the plugin can do this safely via public `ctx.sessions`/`ctx.uiWorkspace`
= **NO** · Q4 public navigation API to reopen the same generation without
switching sessions = **NO** · Q5 a small client-side navigation provider
replacement suffices = **NO** ⇒ **NO-GO-C1 (empirical)**.

## 4. Alternatives reassessed (per §3.4) — for the lead reviewer's call

### Rejected: GO-C1-client-extension (small client provider replacement)
Q5 above: no replacement seam; the swap forks the whole navigation policy and
still cannot retire the reference it does not own. Not viable within the
public API.

### Option A′ — startup ownership protection (host-side, within the C1
architecture, no core patch)
Make the Team-managed-ness of a durable session known **before** the client's
first ordinary promote attempt, so the cold open after a restart goes
straight to Team mode and the ordinary-mode veto (and its sticky client
error state) never occurs in the first place. Precedent: after a successful
takeover the published client already re-opens the session directly in Team
mode with no new promote (Q2-FINDING #3) — the missing piece is the
**first cold open** before any takeover has happened. Scope of change:
host-side ownership publication on the startup/catalog path (resolver
exposes managed-ness for durable Team sessions at boot, ahead of the first
promotion decision) + the client's existing Team-mode open path; the fence,
permit, and recovery paths are unchanged. Does **not** require touching the
published client's state machine. Risk surface: startup-window ownership
timing (the S1 ownershipReady barrier already holds Team activation in
PENDING until the resolver is bound — A′ extends the same idea to the
ordinary side).

### Option B+ — SessionController compatibility replacement (the pre-agreed
fallback, original restart-recovery guide §15)
Disable the stock `session-controller` row; insert the
`dsh-agent-team/session-controller` compatibility replacement; the single
allowed semantic delta is activation-owner selection at the
`ApiSessionAgentController.resolve/resume` decision point (managed →
`ensureLiveAgent`, unmanaged → stock ordinary resume). Everything else —
persistence, AgentLoop, follow/page wire, list/search, control, client
session implementation, remote shapes — stays upstream 0.1.7-rc.1 behavior.
Requires, before any build: a Typert descriptor spike proving the
replacement row can be disabled/inserted while the `session.*` strict
descriptors keep being served by the upstream generated contribution
(`@deepseek-ai/dsh-api-session-controller/typert`), per the PR #26
`team-spill-local` pattern. This is a substantially larger surface than A′
(a new runtime row + compatibility layer), but it also removes the whole
class of ordinary-vs-Team client error-state divergence permanently.
**Not started in this round** (§8: no B+ before the empirical NO-GO — the
NO-GO is now in hand; starting B+ is a separate, explicitly deferred
decision).

### Until the decision lands
The user-visible recovery for the cold-open-after-restart case is the **full
page reload** (proven, Q2). No behavior in this round changes that; the
current product step (c) `ctx.sessions.refresh()` stays as-is and is now
documented as proven-insufficient for this case (not removed — its removal
is part of whichever option is chosen).

## 5. Consequences for PR #31 (recorded in the PR body, §12 Q4)

- The §5 hard browser gate (single click → composer immediately usable, no
  reload / no switch) is **not passable** on the published 0.1.7 client
  without a core patch (budget 0) — the S5 real-host run records the gate's
  exact failure step as evidence; per §5 "如果这一 gate 无法通过，PR #31 仍不
  merge-ready", the same-page UX closure is **not merge-ready** and awaits
  the A′/B+ decision.
- Everything else in the supplemental round (single-flight, startup
  ownership window, epoch/tombstone handoff, absolute deadline, host/root
  contract, race matrix) is code + tests + real-host evidence as described
  in the PR body.
