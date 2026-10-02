# `permission-notification` — Alpha.3 PR5 (notification + read projection): DRAFT, UNWIRED BY DESIGN

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

## WIRED vs PENDING (exact state in this PR)

| Piece | State in this PR |
| --- | --- |
| `permissionChangeNotificationFromSnapshot` (pure builder, generation tag, no rule payload) | implemented + unit-tested (library code; NO production caller yet) |
| `renderPermissionChangeNotification` (deterministic, token-leading `[team-perm-changed …]`, stale/unknown marking) | implemented + unit-tested (library code; NO production caller yet) |
| `createPermissionChangeNotifier` (advisory liveness gate, at-most-once delivery, never-throws outcome) | implemented + unit-tested against fakes + the REAL durable overlay port (library code; NO production emission point yet) |
| `createPermissionReadProjection` (`latest`/`history` frozen views) | implemented + unit-tested over the REAL durable store (library code; NO production read surface exposes it yet) |
| `createPermissionDeliveryBinding` + `createPermissionDeliveryAdapter` (INJECT-ONLY receipt gate: closing / exact owned live handle / identity / lifecycle / running-status, one sync inject, closed drop vocabulary) | implemented + unit-tested incl. the active→idle race and the landmine-pinned inject-only surface (library code; NO production receipt point yet) |
| `detachPermissionNotice` (fire-and-forget off the ack; never throws, never awaited) | implemented + unit-tested (slow / never-settling / faulting delivery leave ack content + order byte-identical) |
| post-commit notification EMISSION inside the permission-lane mutation path (`changed: true` branch only) | PENDING — small splice after PR60 stabilizes; compose `detachPermissionNotice(() => notifyPermissionCommit(result.snapshot))`, outcome never joined into the ack |
| production binding of the three SYNCHRONOUS binding facts (glue `closing`, the live-handle map read for the EXACT pair, the member lifecycle fact) + the liveness advisory read + the durable overlay port | PENDING — binds EXISTING runtime surfaces only (read-only map/fact reads; nothing that creates, resumes, or adopts), no new authority surface |
| integration test (post-commit emission + production read-projection wiring over a live world) | PENDING — lands with the splice, coordinated via parent |

Nothing in this directory is constructed by `src/plugin/root.ts`, no dist
artifact ships it yet (same build treatment as the PR1 unwired foundation:
the module is type-checked and tested from source, not part of the tsc
install-surface build), and no runtime behavior of the product changes
when this PR lands. The zero-production-consumer walk leg in the hygiene
spec pins exactly this claim — when the wiring splice lands it must update
that leg deliberately. PENDING NOTE (recorded per parent review): because
the lane has NO production dist reference today, no build/dist change can
accompany it; once the final splice wires this module into the production
root, a REGULAR build + dist co-commit (and `check-artifacts-committed`
verification of the new surface) WILL be required in that splice commit.

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
| `../test/a3p5-permission-notification-lane-hygiene.test.ts` | structural pins: closed exports, pinned import graph (TYPE-only repo edges + the two PUBLIC upstream edges), no decision/mutation-input path, zero production consumers |
