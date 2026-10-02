# `permission-notification` — Alpha.3 PR5 (notification + read projection): emitter WIRED at the governance-mutation completion point

The awareness layer over the merged Alpha.3 permission durable surface
(PR1 overlay store + port, PR3 `mutatePermission`). It implements the two
PR5 deliverables and NOTHING ELSE (ADR §9):

1. **best-effort, generation-tagged notification** of committed permission
   mutations to the addressed Agent — ACTIVE Agents only; idle Agents are
   never awakened; a superseded notification only MARKS its generation and
   the superseding generation, it can never alter permissions; delivery
   failure is a liveness failure only — the notifier never throws, and the
   detached dispatcher keeps every notice OFF the ack path, so no delivery
   can affect or roll back a mutation or change the mutation success ack;
2. **the read projection** — frozen read views over the durable overlay
   snapshots (`readAuthority`) and their audit history
   (`readHistoryAudit`), reached through the EXISTING access boundaries
   only (the PR1 port's `latest` / `history`; the injected port type
   narrows `append` away and a Proxy leg pins it at runtime).

The delivery binding implements the parent GO ruling (pinned to pristine
upstream 0.1.7-rc.1): the ONLY input member used is the PUBLIC
`Agent.inject` — "queue … WITHOUT WAKING the driver"
(`@deepseek-ai/dsh-agent` runtime-types.ts:233-241; implementation
`send(input, 'next-step', /* wake */ false)` in `agent-loop`
agent.ts:153-171, whose sole wake call at :159 is not reached and which
latches no wake in any phase). `steer` / `followup` are FORBIDDEN here:
both pass wake=true and an idle target starts a turn
(runtime-types.ts:225-231). The binding's agent type is a structural
`Pick<Agent, 'status' | 'inject'>` — a wake-capable member is not even
nameable. The receipt gate (closing → owned live handle for the EXACT
pair → identity → lifecycle → `status === 'running'` → one inject) is a
FULLY SYNCHRONOUS function: no await exists between the final check and
the send, so no interleaving point exists; an active→idle race during any
earlier async read simply drops at the gate. Host durable-inbox parking
semantics are the upstream's own and are used AS-IS (a notice may wait
for a future natural wake); this layer owns NO queue, NO pending state,
NO retry path.

Producer provenance (PR61 review BLOCK fix): the inject message CARRIER is
`createUserMessage` (role 'user' — the host's only model-visible input
carrier), but the SOURCE is the plugin's OWN v4 producer kind
`plugin:dsh-agent-team` — the pinned glue attribution
(agent-bindings.mjs:4078-4081), admitted by v4 (only the retired shared
`kind: 'plugin'` wrapper is rejected, session-format-v3-to-v4
src/message-sources.ts:8-11) and registered via the plugin's declaration
merging (`src/plugin/live/message-sources.d.ts`). Human `kind: 'user'`
attribution is FORBIDDEN for notices: the upstream consecutive-wake budget
refills exactly on USER-sourced claims (tool-jobs src/index.ts:211-215,
spent :295-305), so a plugin notice wearing it would trigger the Human
pathway; the spec pins the exact predicate negation.

Notification and projection output is **awareness, never authorization
evidence**: the lane exports no path to any decision/mutation input
(no authorize/resolve/assemble/mutate/grant/revoke/envelope member — the
closed export vocabulary and the import graph are pinned structurally by
`test/a3p5-permission-notification-lane-hygiene.test.ts`). Cross-lane
edges: TYPE-ONLY to the stable PR1 vocabulary
(`../permission-governance/*`) plus EXACTLY the two PUBLIC upstream
packages of the binding ruling (`@deepseek-ai/dsh-agent` TYPE-only,
`@deepseek-ai/dsh-llm` with the single `createUserMessage` value import);
this directory imports NOTHING from governance internals, the resolver,
the effective-policy lane, plugin WIP files (`host.ts`, permission-plane,
blueprint schema) — which also keeps this PR zero-conflict against PR60's
in-flight rewrites.

## WIRED vs PENDING (exact state after the final splice)

| Piece | State |
| --- | --- |
| `permissionChangeNotificationFromSnapshot` (pure builder, generation tag, no rule payload) | WIRED through the emitter (composition below); unit-tested |
| `renderPermissionChangeNotification` (deterministic, token-leading `[team-perm-changed …]`, stale/unknown marking) | WIRED through the emitter; unit-tested |
| `createPermissionChangeNotifier` (advisory liveness gate, at-most-once delivery, never-throws outcome) | WIRED — constructed by `src/plugin/root.ts` over the REAL durable overlay port (`latest` only); unit-tested |
| `createPermissionReadProjection` (`latest`/`history` frozen views) | **WIRED (ROOT BLOCK-1)** — `src/plugin/root.ts` composes it over the SAME shared durable overlay port behind the append-NARROWED seam and serves it as the v7-only remote read method `override.getPermission` (current authority + ascending audit history for the exact addressed pair; AD-1 wire-seam access gate: operator / Leader / member-self, cross-member refused typed; ghost identity = TYPED `PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN`, never an empty-view masquerade; ARCHIVED/DISPOSED history stays audit-visible — lifecycle gates execution, never the durable audit read; zero writes, zero decision-plane references) |
| `createPermissionDeliveryBinding` + `createPermissionDeliveryAdapter` (INJECT-ONLY receipt gate: closing / exact owned live handle / identity / lifecycle / running-status, one sync inject, closed drop vocabulary) | WIRED — the three synchronous facts bind the live glue's `permissionNoticeReceipt` (closing + owned live-handle map read for the EXACT pair) and the shared lifecycle reader, all READ-ONLY; unit-tested incl. the active→idle race and the landmine-pinned inject-only surface |
| `detachPermissionNotice` (fire-and-forget off the ack; never throws, never awaited) | WIRED at the emission point; unit-tested (slow / never-settling / faulting delivery leave ack content + order byte-identical) |
| post-commit notification EMISSION at the governance-mutation completion point (`changed: true` branch only) | WIRED in `src/plugin/root.ts` — the completion-point decoration wraps the ONE governance mutation authority BEFORE the plane/remote/tools consumers bind it, so every committing entry (entry grant/revoke, remote `override.mutatePermission`, the tool adapter, a rule change at restore time) emits exactly one detached notice per committed snapshot; outcome never joined into the ack |
| production binding of the SYNCHRONOUS receipt facts | WIRED — glue `permissionNoticeReceipt` (`closing()` + `liveHandle(pair)` resolving the liveAgents key through the DURABLE MemberInstance row of the EXACT pair — the row's `childSessionId` is verbatim the key boot seeds and restore re-bindings register (never a re-derivation, no derived fallback); the returned identity is derived FROM the durable reverse mapping (the row that BINDS the key), never echoed from the request; zero wake/capacity members) + `createMemberLifecycleReader.readLifecycle` (CREATED/RUNNING/SETTLED eligible; ARCHIVED/DISPOSED/unknown never receive); the durable overlay port through the `latest`-narrowed authority seam |
| integration test | `test/a3p5-permission-splice.test.ts` — root-assembled (real root, real governance service, real durable overlay, real gate): commit→one inject (plugin producer), no-change→nothing, idle→nothing, closing→nothing, no-seam→zero delivery + byte-identical durable commit, RESTORE regressions (pure restore: zero overlay writes + zero emissions; genuine rule change at restore: exactly ONE snapshot through the ONE decorated completion point), glue/root source pins. The live AGENT itself is a labeled boundary double (a real running Agent needs the host runtime; host/kit-dimension acceptance is the recorded remaining step). |
| real-glue receipt test | `test/a3p5-glue-permission-receipt.test.ts` — the ACTUAL `agent-bindings.mjs` receipt module over the t12a live bridge (hostless fakes, real code path): non-derived seed child receives, restored durable child receives, leader durable row, ANTI-ECHO collision returns the TRUE owner and the real gate drops `identity-mismatch`, stale re-pointed row reads undefined (old handle never receives, new key stays cold), ghost reads undefined, derived-id regression; create/resume/steer/followup counters pinned on every leg. |
| read-wiring test | `test/a3p5-permission-read-wiring.test.ts` — Group A on the ROOT-ASSEMBLED `remoteDispatcher`: current authority + ascending audit, ghost typed absence, foreign-team refusal, v6 version-gate refusal, ARCHIVED audit-visible, fresh-instance declared-none (no inheritance), whole-battery byte-identical durable state (zero writes), decision-lane input stable; Group B on the real s6-remote port: member-self pass, cross-member typed refusal with the seam never invoked, Leader + operator pass, unwired seam refuses typed. |

The lane is now consumed by exactly ONE production file — `src/plugin/root.ts`
(the emitter) — and it ships in the dist install surface TRANSITIVELY through
that import chain (like `permission-governance` / `permission-lifecycle` /
`governance` before it), so the splice commit co-commits the built dist and
`check-artifacts-committed` verifies the new surface. The exact-consumer walk
leg in the hygiene spec pins the single-consumer set — a second consumer must
update that leg deliberately. With the splice, permission-change notices
become a real runtime behavior for ACTIVE addressed Agents (inject-only,
never a wake); no decision, ack, gate or read path consumes a notification —
awareness, never authorization evidence (ADR §9).

## Files

| File | Role |
| --- | --- |
| `types.ts` | closed vocabulary: liveness (READ-ONLY port), delivery port, generation-tagged notification record, staleness/skip/outcome unions, projection views |
| `notification.ts` | pure builder + deterministic renderer + active-only never-throwing notifier factory |
| `projection.ts` | the two read views over `latest`/`history`, deep-frozen copies |
| `binding.ts` | the INJECT-ONLY synchronous receipt gate + delivery-port adapter + detached dispatcher (parent GO ruling, upstream-source-pinned) |
| `index.ts` | closed public surface (pinned by the hygiene spec) |
| `../test/a3p5-permission-notification.test.ts` | the four required classes: active delivered / idle never awakened / stale marked, permissions untouched / failed delivery, mutation result & ack untouched |
| `../test/a3p5-permission-read-projection.test.ts` | projection legs over the REAL durable store (authority = highest generation, history audit-only, append unreachable) |
| `../test/a3p5-permission-delivery-binding.test.ts` | the GO's (a)-(e): running receives (plugin-producer SOURCE pinned, never human 'user'); idle/cold/closing/lifecycle/mismatch drop with zero writes; active→idle race drops at the gate; inject-only surface (wake landmines untouched); detached ack independence |
| `../test/a3p5-permission-notification-lane-hygiene.test.ts` | structural pins: closed exports, pinned import graph (TYPE-only repo edges + the two PUBLIC upstream edges), no decision/mutation-input path, the EXACT single-production-consumer set (root.ts) |
| `../test/a3p5-permission-splice.test.ts` | the final splice, root-assembled: commit→one inject (plugin producer), no-change/idle/closing→nothing, no-seam→zero delivery + byte-identical durable commit, real-glue receipt block read-only + root single-emission-site pins |
