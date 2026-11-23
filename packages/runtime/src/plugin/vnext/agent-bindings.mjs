/**
 * P8-S5A — the live-agent binding substrate for the production
 * `dsh-agent-team` plugin.
 *
 * Verbatim port (zero behavior change) of the live-agent glue out of the
 * P6-T6 harness row (packages/tools/harness/plugin.mjs): the idempotent
 * child-session factory, the invariant-46 session-durability barrier, the
 * per-session durable-consumption state (row-owned ModelSelectionRef +
 * mini-MCP fiber + §18.3 applied-record set), the session-input and
 * work-delivery ports, the lifecycle ports (interrupt / drain / residency),
 * the caller map, and the row-owned tool execution budget.
 *
 * TCM-D4 (additive): every request boundary now resolves the session's
 * OWNING team root from the public durable repositories (a session with
 * its own TeamSession row is a team root of this row — it resolves under
 * ITSELF, not the boot root) and threads it through setup/preparation;
 * the caller map recognizes such a root as its own leader (inst-leader);
 * and the ROOT agent's scoped persona section carries a concise
 * machine-readable root Team context (canonical rootSessionId + leader
 * instanceId + the team_* call contract). Boot-root behavior is
 * unchanged; unknown sessions fail closed exactly as before.
 *
 * Plain JS ESM: node: builtins + prebuilt @deepseek-ai/* packages only (no
 * TypeScript, no loader hooks — the production host row runs as built
 * host.js under plain Node). The built production host dynamically imports
 * this module at apply() and passes the deps below; every mutable piece of
 * state (live agent handles, disposers, call counter, consumption state,
 * observations) lives in the closure — one bindings object per row
 * instance, per boot. No module-level mutable state.
 *
 * deps (all required; `now` is a documented parity field):
 *   agents             - the DSH agents service (create/resume; AgentHandle seam)
 *   sessionPersistence - the DSH sessionPersistence service (ensureMaterialized)
 *   domain             - the OPENED TeamDomain: repositories (memberInstances,
 *                        overrides) plus consumption { model:
 *                        {resolveDurableModelSelection}, capability:
 *                        {resolveDurableMcpFacet} } (the pure governance
 *                        admission authority is NOT part of it — the harness
 *                        row imports it from the built runtime dist itself)
 *   config             - the row config (run.mjs teamRowConfig): rootSessionId,
 *                        blueprintSource (T12-M2: the Team Blueprint document —
 *                        the closed-v1 frontmatter source whose leader/member
 *                        persona fields the persona resolver composes onto the
 *                        real DSH Agent prompt; the glue parses it lazily.
  *                        BP-F (issue #2 blueprint-loading, plan §11.2):
  *                        DOWNGRADED to the row's bootstrap/compatibility
  *                        anchor — the fallback bound blueprint when no
  *                        per-root resolver is injected (the factory-world /
  *                        pre-repair behavior). The production host ALWAYS
  *                        injects the per-root resolver below, so the
  *                        dynamic Team authority is the owning TeamSession's
  *                        bound snapshot, NEVER this row-global document),
 *                        mcpServers [{name, port}] 0..N (canonical —
 *                        multi-mcp C1; port null = configured-but-unmounted)
 *                        with the legacy single mcpServer {name, port} |
 *                        null still accepted during this alpha (C7; null =
 *                        no MCP server configured — T12-H1); every read
 *                        goes through configuredMcpServers (contract I1);
 *                        staticModel, deniedSelection,
 *                        externalPolicyFacts {hard, capabilityExists} (T12-B3:
 *                        the injected external hard facts; normalized —
 *                        never re-interpreted — into the resolvers),
 *                        presetSubstrate (T12-M2, OPTIONAL: {presetId,
 *                        personaKind} — the AgentPreset substrate fact the
 *                        persona resolver evaluates; absent = the S5A A11
 *                        decision {presetId: 'dsh-agent-team', personaKind:
 *                        'standard'})
 *   teamToolsRef       - the plain { current: <teamTools | undefined> } object
 *                        the production host fills AFTER root assembly; the
 *                        setup callback reads teamToolsRef.current when it
 *                        runs — never before (absent -> the registration
 *                        loop is skipped, as before)
 *   controlServiceRef (OPTIONAL) - the plain { current: <ControlService |
 *                        undefined> } object the production host fills
 *                        right after the root assembly constructs the
 *                        durable ControlService (the teamToolsRef pattern:
 *                        construction-time object, filled during root
 *                        construction, read LAZILY when the setup callback
 *                        runs). alpha.2 (plan §11): for every bound
 *                        template that declares `capabilities.permissions`,
 *                        the setup reads controlServiceRef.current and
 *                        installs the A5 tools/pre-execute enforcement
 *                        listener (installParameterPermissionListener) on
 *                        this agent's scope; the returned disposer rides
 *                        the shared toolDisposers drain (row stop + agent
 *                        disposal), so the listener's lifetime is exactly
 *                        the agent lifecycle (cold resume reinstalls).
 *                        ABSENT / UNFILLED at setup time on a
 *                        permissions-carrying template -> the setup fails
 *                        closed with the typed
 *                        alpha2-permission-control-unavailable error (a
 *                        permissions agent never runs unguarded).
 *                        Templates WITHOUT a permissions policy never
 *                        read the ref (alpha.1 / legacy: zero listeners).
 *   *   resolveBoundBlueprint (OPTIONAL) - BP-F (issue #2 blueprint-loading,
  *                        plan §11.1): the narrow per-Team resolver the
  *                        production host injects —
  *                        (teamRootSid) => the parsed TeamBlueprint bound to
  *                        that team root. Production chain (host): the
  *                        durable TeamSession row's bound snapshot ref ->
  *                        the live BlueprintAuthority.resolveSnapshot (the
  *                        frozen registry row's source text is replayed;
  *                        the hash equality is verified; a mutable source
  *                        is re-parsed fresh). SYNC contract, throws typed
  *                        on a broken chain (the setup rejection rolls the
  *                        unpublished agent back — fail closed, as every
  *                        other resolution failure here). ABSENT -> the
  *                        legacy row-global anchor resolution (the
  *                        factory-world fallback; the production host
  *                        always passes one).
  *   resolvePersonaSubstrate (OPTIONAL) - pre-alpha3 W2-A (review fix F4,
  *                        guide §5 B): the PRODUCTION persona-substrate
  *                        resolver — (rootSessionId) => Promise<{ presetId,
  *                        personaKind: 'standard' | 'complete' | 'absent' |
  *                        'unresolved', source?, reason? }>. The production
  *                        host builds it over the RuntimeSubstrateResolver
  *                        + the DSH public agentPresets seam, so the persona
  *                        slot reads the REAL observed effective composition
  *                        (never the shipped-state 'standard' guess). The
  *                        shared agent setup AWAITs it on the production
  *                        path (before any install — an `unresolved`
  *                        substrate throws there, fail closed; the slot is
  *                        cached per owning root ONLY on success, so a
  *                        failed bind re-probes). ABSENT (factory / test
  *                        worlds) -> the legacy seam (config.presetSubstrate
  *                        ?? the S5A A11 standard default), byte-for-byte.
  *   now                - parity field (the row's clock); unused by the ported
 *                        glue paths, which derive time from the services
 *   subagents (OPTIONAL) - the DSH subagents service (SubagentRuntime):
 *                        { drainContinuableDescendants, listDescendants }.
 *                        T12-M3: the recursive drain needs it; ABSENT -> the
 *                        drain fails closed with the typed
 *                        recursive-drain-unavailable error (the
 *                        archive/dispose procedure refuses). NOTE: host.ts
 *                        does not pass it yet — the integrator must add
 *                        `subagents: ctx.get('subagents')` to the glue deps
 *                        (additive; the glue reads deps.subagents
 *                        defensively).
 *   agentPresets (OPTIONAL) - the DSH agentPresets public service surface
 *                        { mount(agentCtx, id?), composedPreset?(agentCtx)
 *                        }: D1 (v2 -> v3) - the ordinary preset base-tool
 *                        substrate (file/shell) the MEMBER agents (v2) AND
 *                        the ROOT (leader) agents (v3) mount IN ADDITION to
 *                        the ten team tools. host.ts passes a LAZY accessor
 *                        that resolves the service per call (the
 *                        sessionPersistence wrapper pattern; a composition
 *                        without the service fails closed with the typed
 *                        TEAM_PLUGIN_SERVICE_MISSING). The shared agent
 *                        setup calls mount on the MEMBER bind paths
 *                        (fresh-member / cold-member) AND the ROOT bind
 *                        paths (fresh-root / cold-root - v3: a plugin-
 *                        created root otherwise has no base tools and the
 *                        leader file lanes are unreachable); an agent that
 *                        ALREADY joined a preset (the production
 *                        host-session root, composed by the web setup - the
 *                        roster's mount is the one bind and refuses a
 *                        second) is detected through the OPTIONAL
 *                        composedPreset(agentCtx) probe and keeps its
 *                        existing composition (observation, no mount).
 *                        config.memberPresetId (members) /
 *                        config.rootPresetId (root) absent (undefined) =
 *                        mount with the deployment default (the glue
 *                        passes no id). ABSENT OR UNUSABLE -> the setup
 *                        fails closed with the typed
 *                        member-base-tools-unavailable (member paths) or
 *                        root-base-tools-unavailable (root paths) error -
 *                        an agent must never silently run without its base
 *                        tools - the setup rejection rolls the unpublished
 *                        agent back, the AgentSetup contract).
 *
 *   fsBackend (OPTIONAL) - the per-agent DSH `fs` seam accessor
 *                        (agentCtx) => { resolve(path, { cwd? }), contains? }:
 *                        alpha.2 (A6 live fix V1-1) - the public
 *                        fs.resolve seam the permission adapter's
 *                        resolveTarget closure canonicalizes file targets
 *                        through (plan section 7.2 - the SAME seam the
 *                        upstream file tools use; the upstream
 *                        agent-instructions plugin uses the identical
 *                        lazy ctx.get('fs') + session.header.cwd pattern).
 *                        A2C-7 (plan section 9): the same accessor also
 *                        exposes the pinned public `FileSystem.contains`
 *                        containment seam (the ONLY legal authority for
 *                        the `subtree` permission kind - the containsTargets
 *                        closure below passes it to the adapter).
 *                        host.ts passes a closure that resolves the
 *                        service LAZILY per call via the row's strict
 *                        ctx.get('fs') (the global service store): the
 *                        property proxy agentCtx.fs is topology-sensitive
 *                        (the Cordis reflect walk) and the agent scope's
 *                        fiber tree never passes through this row's
 *                        fiber, so it can never resolve there (the V1
 *                        live matrix's "cannot get property 'fs' without
 *                        inject" - every file operation of a
 *                        permissions-carrying agent died at
 *                        canonicalization, even the allow lane). ABSENT
 *                        on a permissions-carrying template -> the setup
 *                        fails closed with the typed
 *                        alpha2-permission-fs-unavailable error (a
 *                        permissions agent never runs unguarded); a
 *                        service ABSENT AT CALL TIME (the accessor
 *                        throws TEAM_PLUGIN_SERVICE_MISSING) maps to the
 *                        A2 adapter's typed canonicalization denial
 *                        (fail-closed, never a pass-through). Templates
 *                        WITHOUT a permissions policy never call it
 *                        (alpha.1 / legacy: zero listeners).
 *   a5sfRealmProvider (OPTIONAL) - the Alpha.5 P2 compiled-realm provider,
 *                        a LAZY accessor `() => { compiledFor } | undefined`
 *                        (host.ts reads the optional `teamA5sfRealm` service;
 *                        a factory/test world omits it). `compiledFor(member)`
 *                        answers the compiled objects of ONE admitted Member
 *                        (`{ members, bindings?, providerClass? }`) or
 *                        `undefined` for "no compiled realm". ENABLED ONLY
 *                        together with `config.a5sfEvidencePath`; absent
 *                        either half = the legacy path byte-identical (no
 *                        provider call, no mount, no sink, no file write).
 *                        The compiled objects come from the row's composition
 *                        because compiling a ceiling/lane is the policy
 *                        compiler's authority, never this glue's.
 *   artifactAuthorityRef (OPTIONAL) - strict-read + core-spill (Phase
 *                        D/E, implementation guide §13): the plain
 *                        { current: <TeamArtifactAuthority | undefined> }
 *                        object the production host fills once its
 *                        bootstrap has constructed the artifact-read
 *                        authority of the production root (the
 *                        controlServiceRef pattern: construction-time
 *                        object, filled during bootstrap, read LAZILY
 *                        when the setup callback runs). For every
 *                        permissions-carrying template the setup ALSO
 *                        installs the tools/result observer
 *                        (installShellResultObserver) on this agent's
 *                        scope — it records the durable shell-foreground
 *                        artifact grants of this agent's spilled shell
 *                        output (successful foreground bash/pwsh only;
 *                        the structured canonical value only — rendered
 *                        text is never read) so the agent can READ BACK
 *                        its own spill artifact under a strict-read
 *                        policy through the Phase B grant lane. The
 *                        returned disposer rides the SAME toolDisposers
 *                        drain as the permission listener (row stop +
 *                        agent disposal; cold resume reinstalls).
 *                        ABSENT / UNFILLED at setup time -> NO observer
 *                        (the shell spill stays upstream-equivalent —
 *                        alpha.1 behavior; the permission lane itself
 *                        is unaffected and simply finds no grants).
 * Returned bindings (the harness observability surface first — the
 * production host exposes this WHOLE bundle as the teamRoot.live field):
 *   listLiveSessions()                  (sorted live session id strings)
 *   hasLive(sessionId)                  (boolean)
 *   isResuming(sessionId)               (boolean; the resuming marker, P8-S7 R2-5)
 *   ensureLiveAgent(sessionId)          (the live-agent-or-resume resolver)
 *   prepareAgentForRequest(sessionId)   (the request-boundary reconciliation)
 *   executeTool(sessionId, {name, args, callId})
 *   getConsumptionState(sessionId)      (the per-session state or undefined)
 *   resolveConsumptionViews(sessionId)  (the PURE consumption-view derivation)
 *   observations                        (string[]; noteworthy async observations)
 *   governanceAuthority(asSessionId)    (operator | member | undefined)
 *   dropResidency(sessionId)            (-> {dropped, disposeError?})
 *   close()                             (idempotent dispose of every owned side effect)
 * Provider-facing ports (verbatim port):
 *   childFactory.createChildSession(request) -> {childSessionId}
 *   sessionDurability.ensureDurable(childSessionId)
 *   surface                      (TeamAgentSetupSurface; no-op per SD-SURFACE)
 *   sessionInput.submitAttributedInput(input)
 *   workDelivery.deliver(args)
 *                                 (v2 D2 / task C2: submits the explicit
 *                                  prompt as a REAL model-visible input
 *                                  turn on the child, observes the turn
 *                                  to idle, materializes the durable log,
 *                                  then reads the delivered turn back
 *                                  through the public session seam and
 *                                  RETURNS the frozen WorkDeliveryResult
 *                                  (C1 contract: succeeded + member
 *                                  business body / failed + stable code /
 *                                  unavailable); a rejection = delivery
 *                                  failure — the admission fact is
 *                                  retained, the settlement commits
 *                                  'delivery-failed', R6)
 *   createRootAgent(rootSessionId)
 *                                 (T12-GLUE: the B6 handoff target Root
 *                                  Agent start — create-or-ensure on one
 *                                  team root of this row's domain; the
 *                                  effective workspace from the durable
 *                                  TeamSession row, the leader model
 *                                  resolution + persona through the shared
 *                                  setup; a durable session re-attaches via
 *                                  resume)
 *   deliverRootContext({rootSessionId, contextToken, text})
 *                                 (T12-GLUE: the frozen handoff context as
 *                                  a REAL model-visible input turn on the
 *                                  same path the delegate work uses;
 *                                  at-least-once — NO dedupe here, B6
 *                                  dedupes by contextToken durably)
 *   deliverRootWork({rootSessionId, requestToken, prompt, attachedContext?})
 *                                 (TCM-M3: one creation-time Root initial
 *                                  work as a REAL model-visible input turn
 *                                  — the token-leading `[team-root-work
 *                                  requestToken=<token>]` prefix carries
 *                                  the model-visible dedupe identity;
 *                                  at-least-once — NO dedupe here, the
 *                                  Root initial-work strategy's durable
 *                                  side owns replay/retry)
 *   deliverRootControlNotification({rootSessionId, requestId, text})
 *                                 (C1: one control-plane liveness
 *                                  notification — a newly-created durable
 *                                  leader-approval request — as a REAL
 *                                  model-visible input turn on the same
 *                                  root-input path; NON-AUTHORITY: no
 *                                  TeamDomain write, the durable row +
 *                                  team_resolve_control stay the
 *                                  authority; the control service fires
 *                                  it fire-and-forget AFTER the per-team
 *                                  lock is released, so a delivery
 *                                  failure is a liveness failure only)
 *   interrupt(target)            (agent.cancel({kind:'user'}))
 *   drainDescendants(childSessionId) -> {drained, quiescent}
 *                                 (T12-M3: the REAL recursive drain — whenIdle
 *                                  + subagents.drainContinuableDescendants +
 *                                  the honest listDescendants count; a drain
 *                                  failure reports {drained, quiescent:false};
 *                                  a drain that cannot establish quiescence
 *                                  rejects with code
 *                                  'recursive-drain-unavailable')
 *   residency {has, hasResidency, dropResidency} (sync boolean port)
 *   resolveCaller(sessionId)     (root -> leader, else bound member)
 * Additive surface (the production root bootstrap):
 *   boot()                           (idempotent full live-agent boot: create
 *                                     or resume the root + every bound member
 *                                     child, materializing each; the
 *                                     production root calls it exactly once,
 *                                     AFTER the tool stack is in teamToolsRef
 *                                     — construction itself never creates or
 *                                     resumes any agent)
 *   agentSetup(sessionId, [hints]) (the AgentSetup callback: create OR resume)
 *   rootSessionId                (config.rootSessionId)
 *   childSessionIdFor(rootSessionId, instanceId)
 *                                 (T12-B2: the deterministic (root, instance)
 *                                  -> child session id derivation, exposed for
 *                                  provider/cold-reconciliation verification)
 *   personaSurface                 (T12-M2: the REAL scoped-prompt persona
 *                                 surface — installScopedPersona(sessionId,
 *                                 identity) registers the composed identity as
 *                                 the agent-scoped 'deployment:persona'
 *                                 system-prompt section on that session's
 *                                 live agent ctx (a pre-setup install is
 *                                 queued and flushed by the setup, still
 *                                 before any work); restoreScopedPersona(
 *                                 sessionId) disposes exactly that scoped
 *                                 entry — the global prompt layer is never
 *                                 touched; idempotent)
 */
import { SessionId } from '@deepseek-ai/dsh-session'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
// A1 seam: the new centre's realm lane. It mounts the host's own native tool
// modules inside the per-agent provider realm; this assembly never authors a
// tool body and never owns dispatch.
// The delivered-turn reader lives on its own: it never touched this closure's state.
import { readDeliveredWorkTurn } from './work-turn-reader.mjs'
// Round 84: the review wake is delivered by the SAME governed delivery mechanism as `member.send`
// (durable intent + confirmation facts, correlation token, requirement verdict, machine attribution).
import { createReviewWakeDelivery } from './review-wake-delivery.mjs'
// The a5sf realm mount + its row helpers SURVIVE the cut (the realm is the
// provider installation the lane mounts into).
// `freshCreateHintAdmits` is imported, not copied: the rule that a bind-path hint may bridge ONLY the
// fresh-member window is a path predicate (it was duplicated here and in the realm row).
import {
  a5sfRealmConfigOf,
  attachA5sfNativeToolModules,
  compiledAnswerOfRealm,
  createA5sfRealmRowDisposer,
  mountMemberA5sfRealm,
} from '../live/a5sf-realm-row.mjs'
import { freshCreateHintAdmits } from './bind-path.mjs'
import { memberCentreUnwiredViolation } from './centre-config.js'
// C (2026-11-21): the ONE centre composition point + its durable sinks.
import { installMemberExecution } from './member-execution.mjs'
// SHAPE A (round 61): a governed member's native modules are mounted into its realm BY DEFAULT,
// derived from the ACTIVE preset's own rows. The lane is the ONE mount seam (realm-lane.mjs).
import { mountGovernedNativeToolModules, VnextRealmError } from './realm-lane.mjs'
// B (the ask path): the ONE grant binder the contract names lives in the product's
// `member-io-policy` lane, and the durable approval authority is the Control plane. Both are supplied
// together below; the centre refuses an ask that has only one of them.
import { createInvocationBinder } from '../../../member-io-policy/src/invocation.js'
import { createControlApprovalPort } from './admission-port.mjs'
// E3 (round 49): the durable overlay supplier for the centre's admission port. It can only REMOVE
// authority, and it reads the SAME `permissionOverlay` port the mutation lane appends through.
import { createOverlayDecisionProvider } from './overlay-decision.mjs'
// Who a session is, and whether it may be brought back - one component (plan S1).
import { createSessionIdentity } from './session-identity.mjs'
// WHICH template a session is, under WHICH bound snapshot - one component (plan M4).
import { createTemplateBinding } from './template-binding.mjs'
// Round 90 decomposition (behaviour-preserving): four cohesive spans of this closure now live in
// sibling modules and are imported back VERBATIM. Each module's header states what it owns and what
// deliberately stayed here (the two spans that read the row's `closing` primitive).
import { governedPresetModuleSpecifiers } from './governed-preset-modules.mjs'
import { createMcpWitnessLane } from './mcp-witness-lane.mjs'
import { createRootDelivery } from './root-delivery.mjs'
import { createStopDrainLane } from './stop-drain-lane.mjs'
// The PTC escalation row survives the A0 boundary; the host entry keeps
// building its router through this glue surface.
export { createPtcEscalationRouter } from '../live/ptc-escalation-row.mjs'
// A56-SEMANTICS: the ONE input-provenance law shared by the producers here
// (which source kind a delivery carries) and the Host's Alpha.6 Sticky Stop
// resume arbour (whether a claimed input is an explicit HUMAN interaction).
// See the module header for why `source.kind` alone cannot answer both.
import {
  TEAM_PRODUCER_SOURCE,
  createMachineInputLedger,
  isHumanInteractionClaim,
  isTeamMachineInput,
} from '../live/input-provenance.mjs'
// T12-M2: READ-ONLY reuse of the persona resolver (agent-setup/persona) and
// the blueprint parser (the domain facade) — the composition that puts the
// blueprint persona onto the real DSH Agent at create/setup.
import { parseBlueprint } from '../../../../domain/blueprint/src/index.js'
import { initialMcpGrantOf, staticCapabilitiesOf } from '../../../../domain/policy/src/index.js'
// Finding F (residual round — the requirement-aware final-input verdict):
// the SAME per-scope requirement extraction the admission gate uses (the
// team scope: the v1 flat list + the v2 teamRequirements; the target
// template scope: the v2 leader / members[i] requirements) — the verdict
// classifies a failed mcp server as REQUIRED/optional through the bound
// blueprint's in-scope requirements, never by a second copy of semantics.
import { scopeRequirementInputsOf } from '../../../requirements/scope-requirements.js'
import { scopeKey, templateScope, teamScope } from '../../../requirements/types.js'
import { initialTemplateModelGrantOf } from '../../../agent-setup/model/index.js'
import { createPersonaOverlaySlot } from '../../../agent-setup/persona/index.js'
// alpha.1 (plan §10): the capability wiring adapters — the team tool
// selector + built-in tool deny (T2) and the skill/MCP adapters + catalog
// (T3) — consumed VERBATIM by the live setup (no re-implemented selector
// or resolver in the glue; the static source is the T1 domain module).
import { applyBuiltInToolDeny, selectTeamTools } from '../../../../tools/src/index.js'
import {
  InMemorySkillCatalog,
  filterMcpServers,
  registerTeamSkills,
} from '../../../agent-setup/capability/index.js'
// multi-mcp (contract I1/I4): the SOLE canonical MCP-supply read path over
// the row config (0..N `mcpServers` with the legacy single `mcpServer`
// still accepted during this alpha — C1/C7). The glue consumes it
// VERBATIM: every configured-server read in this file goes through
// configuredMcpServers (no second normalization anywhere).
import { configuredMcpServers } from '../mcp-supply.js'
// pre-alpha3 PR-B (plan §B.2): the durable PolicyState read seam — the
// COMMIT-ORDER ledger rows the canonical consumption read consumes (the
// committed PolicyState participates in the live boundary resolution;
// the legacy step fields keep parse/display only).
import { listDurablePolicyStateTransitions } from '../durable-mutation-store.js'
// C1 (restart-recovery, guide §3.2): the ONE durable Team-ownership
// authority — the host-side activation fence and this glue's
// `teamRootOfSession` thin wrapper share the SAME algorithm (no second
// traversal of the durable repositories). The relative `.js` specifier
// resolves to the TypeScript source under the test runners (the .js ->
// .ts sibling rewrite) and to the compiled mirror in the production
// dist layout.
// A2C-2 (plan §7.2) + fix/alpha2-explicit-agent-setup-compat: the
// agent-scoped tool surface is read through `tools.schemas(runtimeAgent)`
// where `runtimeAgent` is the setup's CANONICAL runtime-Agent resolver
// (below): the explicit `AgentSetup` second argument (the DSH 0.1.5+
// contract — the factory calls `setup(agentCtx, agent)` and REMOVED the
// `agentCtx.agent` reverse association), falling back to the 0.1.2-era
// `agentCtx.agent`, then LAST to the scope tag (`scopeOf(agentCtx)` —
// which is unreadable across duplicate @deepseek-ai/dsh-scope module
// instances because the tag is a module-private Symbol, so it is the
// least reliable of the three and must never shadow the explicit Agent).
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'

/**
 * The canonical runtime-Agent identity of one AgentSetup invocation —
 * the SINGLE resolver every setup-time identity consumption uses (the
 * Permission Coverage Gate's `tools.schemas(agent)` surface read and the
 * permission resolver's lazy `session.header.cwd` basis).
 *
 * Precedence (deliberate — 0.1.5 style wins over every implicit seam):
 *   1. `explicitAgent` — the AgentSetup SECOND parameter (the DSH 0.1.5+
 *      formal contract: `setup(agentCtx, agent)`; the factory supplies the
 *      very Agent being composed — the authoritative identity);
 *   2. `agentCtx.agent` — the 0.1.2-era reverse association (retained so
 *      the plugin keeps working on the 0.1.2-era contract its pinned
 *      dependencies declare);
 *   3. `scopeOf(agentCtx)` — LAST legacy fallback only (the scope tag;
 *      the Agent IS the scope key upstream, but the tag is a
 *      module-private Symbol, so a plugin resolving a SECOND
 *      @deepseek-ai/dsh-scope package instance reads `undefined` even
 *      for a perfectly healthy Agent ctx — that is exactly the
 *      alpha.2 `alpha2-permission-coverage-surface-unavailable` blocker
 *      this fix removes).
 *
 * `undefined` when NO identity is reachable — the strict
 * (`capabilities.permissions`) setup must then fail closed; a
 * permissions agent never runs on a surface the gate cannot verify.
 * @param {object} agentCtx - the setup's agent ctx.
 * @param {object|undefined} explicitAgent - the explicit AgentSetup agent.
 * @returns {object|undefined} the canonical runtime Agent (or undefined).
 */
function resolveSetupAgent(agentCtx, explicitAgent) {
  if (explicitAgent !== null && explicitAgent !== undefined) return explicitAgent
  const legacyAgent =
    agentCtx !== null && typeof agentCtx === 'object' ? agentCtx.agent : undefined
  if (legacyAgent !== null && legacyAgent !== undefined) return legacyAgent
  return scopeOf(agentCtx)
}

/**
 * The leader instance id (packages/contracts LEADER_INSTANCE_ID). The
 * plain-JS substrate cannot import the TS contracts package (no loader in
 * the production host row), so the constant is mirrored here.
 */
const LEADER_INSTANCE_ID = 'inst-leader'

/** The per-tool-call execution budget (activation involves real agent work). */
const TOOL_EXEC_TIMEOUT_MS = 120_000

// ── v2 D2 (task C2): the minimal member-result normalization ──────────────────
//
// The frozen WorkDeliveryResult contract (task C1, packages/runtime/
// admission/types.ts) is normalized HERE at the delivery boundary: the
// delivered turn is read back from the member child's own Session through
// the public session seam (Session.ownEvents — the same live face class
// the glue already drives: followup / whenIdle / cancel / session), and
// mapped to the closed status vocabulary. Stable error codes (the set the
// C1 contract pins for this seam; the chain's WORK_DELIVERY_FAILED covers
// the throw path and WORK_REPLAYED is synthesized by the chain on replay):

/** The delivered turn completed but no readable non-empty assistant text exists. */
export function a5PlaneSubtreeContains(a, b) {
  const shaped = b === undefined && typeof a === 'object' && a !== null
  const root = shaped ? a.parent : a
  const child = shaped ? a.child : b
  if (typeof root !== 'string' || typeof child !== 'string') {
    throw new TypeError(`a5w-bindseam: subtree containment needs two path strings (the row face {parent, child} or positional root/child) — coverage is never guessed from ${shaped ? 'an object without string parent/child' : JSON.stringify([typeof root, typeof child])}`)
  }
  if (child === root) return true
  return child.startsWith(`${root.replace(/\/+$/, '')}/`)
}

// SHAPE A (round 61): the governed preset's row module specifiers + each row's declared config are
// one question with one owner - see `governed-preset-modules.mjs` (extracted verbatim).

/**
 * Create the bindings closure over one row instance's deps.
 * @param {object} deps - see the module header.
 * @returns {object} the bindings (see the module header).
 */
export function createAgentBindings(deps) {
  // D1 (v2): agentPresets is OPTIONAL (the host serves it as a lazy accessor;
  // a test world may omit it) — the member bind paths fail closed with the
  // typed member-base-tools-unavailable when it is absent or unusable.
  // C1 (restart-recovery, guide §4.3): activationFence is OPTIONAL — a
  // test/factory world may omit it, and the glue then falls back to the
  // DIRECT operations (runOwnedActivation runs the operation bare; the
  // ensureLiveAgent rollback / writer-conflict waits are skipped — the
  // pre-C1 behavior, so no pre-C1 test double breaks wholesale). The
  // production host ALWAYS passes the fence (guide §4.3: "生产 host 必须传").
  const { agents, sessionPersistence, domain, config, teamToolsRef, controlServiceRef, agentPresets, resolveBoundBlueprint, permissionOverlay, activationFence, policyReaderRef, resolvePersonaSubstrate, a5sfRealmProvider, resolveMemberMount, fsBackend, agentDefaultModel } = deps

  // ── B (the ask path): THE ONE grant binder + THE ONE durable approval authority ─────────────
  //
  // `ask` was a refusal because nothing could spend an approval: the centre's `grants` input was
  // never supplied by the product, so every ask became ADMISSION_ASK_UNWIRED. The binder is the
  // product's own (`member-io-policy` invocation binder — one per row, so an epoch bump or a revoke
  // is coherent for every member the row binds), and the approval authority is the durable Control
  // plane through the EXISTING wait bridge (`createControlApprovalPort` → `requestControl` →
  // `awaitControlDecision`).
  //
  // A row with no `controlServiceRef` (factory / unit worlds) supplies NEITHER: an ask there keeps
  // its own ASK_UNWIRED refusal instead of becoming a prompt nobody can answer. The ref is read
  // LAZILY per request — the host fills `.current` during root construction (the teamToolsRef
  // pattern), after this closure exists.
  const grantBinder = createInvocationBinder()
  const memberOfBinding = (binding) => {
    const teamId = typeof binding?.owner === 'string' ? binding.owner : ''
    const memberInstanceId = typeof binding?.instanceId === 'string' && binding.instanceId !== ''
      ? binding.instanceId
      : (typeof binding?.agentId === 'string' ? binding.agentId : '')
    const templateId = typeof binding?.templateId === 'string' ? binding.templateId : ''
    // NO PARTIAL IDENTITY. A binder validates every field; filling a missing one here would be this
    // assembly inventing the trusted identity the TeamDomain owns.
    if (teamId === '' || memberInstanceId === '' || templateId === '' || !Number.isInteger(binding?.instanceGeneration)) {
      return undefined
    }
    return { teamId, memberInstanceId, templateId, instanceGeneration: binding.instanceGeneration }
  }
  const grants = controlServiceRef === undefined ? undefined : { binder: grantBinder, memberOf: memberOfBinding }
  const approvals = controlServiceRef === undefined
    ? undefined
    : createControlApprovalPort({ controlOf: () => controlServiceRef.current })

  // ── A5-M1 (root ruling on the generation seam): THE ONE authority-generation
  // reader. Every consumer of the durable permission overlay's generation calls
  // THIS function — the Guard's install-time slot, the plane assembly's
  // `authorityFacts`, the published mount's generation readers, and the request
  // boundary's refresh — so Guard and PA cannot grow two explanations of the
  // same durable number.
  // Its law has exactly two shapes:
  //  · `0` ONLY for the legal no-row world (no overlay port wired, or the
  //    durable lane answering with NO row) — that is the real durable state of
  //    a team that never carried an overlay;
  //  · a THROW for anything else: a faulting read, or a row whose
  //    `metadata.generation` is not a finite non-negative number. It is never
  //    folded into 0 and never answered as `undefined`-meant-zero: callers
  //    either fail closed or refuse the unit of work, and none of them gets to
  //    admit or install on a generation nobody read.
  const readAuthorityGeneration = async (teamSessionId, memberInstanceId) => {
    if (typeof permissionOverlay?.latest !== 'function') return 0
    const latest = await permissionOverlay.latest({ teamSessionId, memberInstanceId })
    if (latest === undefined || latest === null) return 0
    const generation = Number(latest?.metadata?.generation)
    if (!Number.isFinite(generation) || generation < 0) {
      throw new Error(`agent-bindings: the durable permission overlay answered a non-generation (${JSON.stringify(latest?.metadata?.generation) ?? String(latest?.metadata?.generation)}) — never read as generation 0`)
    }
    return generation
  }

  // C1 (restart-recovery, guide §7.2): the bounded window of the SINGLE
  // writer-conflict recovery wait (ensureLiveAgent's recoverWriterConflict
  // call). Production default: 10 s (the ordinary-promotion rollback
  // settles in milliseconds — the window is a safety bound, not a sleep);
  // a test world may override it through deps (tiny window for the
  // G5/G6 determinism). A non-positive / non-number value falls back to
  // the default.
  const WRITER_HANDOFF_TIMEOUT_MS =
    typeof deps.writerHandoffTimeoutMs === 'number' && deps.writerHandoffTimeoutMs > 0
      ? deps.writerHandoffTimeoutMs
      : 10_000
  if (agents === undefined) throw new Error('agent-bindings: deps.agents is required')
  if (sessionPersistence === undefined) throw new Error('agent-bindings: deps.sessionPersistence is required')
  if (config === undefined || config === null) throw new Error('agent-bindings: deps.config is required')
  if (domain === undefined || domain === null) throw new Error('agent-bindings: deps.domain is required (the opened TeamDomain)')
  if (teamToolsRef === undefined || teamToolsRef === null || typeof teamToolsRef !== 'object') {
    throw new Error('agent-bindings: deps.teamToolsRef is required (a { current } object the production host fills after root assembly)')
  }
  // pre-alpha3 W2-A (review fix F4, guide §5 B): the production persona-
  // substrate resolver (OPTIONAL). The production host injects it so the
  // persona slot reads the REAL observed effective composition (the
  // RuntimeSubstrateResolver + the DSH public agentPresets seam) instead of
  // the shipped-state guess (config.presetSubstrate ?? the S5A 'standard'
  // default). Absent (factory / test worlds) = the legacy path, byte-for-
  // byte. When present it MUST be a function (rootSessionId ->
  // Promise<{ presetId, personaKind, source?, reason? }>).
  if (resolvePersonaSubstrate !== undefined && typeof resolvePersonaSubstrate !== 'function') {
    throw new Error('agent-bindings: deps.resolvePersonaSubstrate must be a function (rootSessionId -> Promise<{ presetId, personaKind, source?, reason? }>) when present')
  }
  // The durable-consumption resolvers ride on the opened domain.
  const consumption = domain.consumption
  if (consumption === undefined || consumption === null) {
    throw new Error('agent-bindings: domain.consumption is required ({ model, capability } durable resolvers)')
  }

  const rootSid = config.rootSessionId

  // ── closure state (one row instance per process = per boot) ───────────

  /** @type {Map<string, object>} live agent handles keyed by session id. */
  const liveAgents = new Map()
  /**
   * A56-SEMANTICS: the process-local ledger of model-visible inputs THIS row
   * delivered as MACHINE origin. Work delivery and root work keep the human
   * `kind: 'user'` attribution — upstream `create_goal` authority is decided
   * by exactly that (`hasDirectHumanInput`: a runtime root whose open turn
   * carries a `user/message` with `source.kind === 'user'`), so a machine
   * delivery that must authorize a goal cannot use the `plugin:` kind. The
   * consequence is that attribution alone cannot tell the Sticky Stop arbour
   * that the input was not a human interaction; this ledger is that signal for
   * the live process, and the durable envelope list in `input-provenance.mjs`
   * is the cold-start fallback.
   */
  const machineInputs = createMachineInputLedger()
  /**
   * @type {boolean} the row-stop (close) lifecycle gate — set at the VERY
   * START of close() (before any snapshot/dispose work) and never cleared.
   * The closing gate protects ensureLiveAgent and work-completion delivery
   * from resurrecting / waking a Leader during row teardown:
   * ensureLiveAgent enforces it at its entry AND after the resume await
   * (a late-resumed handle is disposed, never set), and the
   * work-completion wake-up delivery checks it before its async sends.
   * NOTE (scope): the other liveAgents write paths (boot, childFactory,
   * createRootAgent) are INDEPENDENT and NOT gated by this state — the
   * invariant covers the ensureLiveAgent + completion-delivery paths only.
   */
  let closing = false
  /** @type {Array<() => void>} tool-registration + model-selection disposers. */
  /** Alpha.5 realm disposers this row started (awaited by close). */
  const a5sfRealmDisposers = []
  /**
   * NATIVE MOUNT DISPOSERS (async). `mountHostModules` returns `{ dispose }` whose job is to release
   * the realm's definition AND install the MEMBER_CLOSED tombstone in its place. The first production
   * wiring discarded that handle, so on member teardown the retired member's confinement outlived the
   * member and its native tools kept executing for whoever still held the scope -
   * the exact regression SLICE-23 found, still live on the product path.
   */
  const nativeMountDisposers = []
  const toolDisposers = []
  /** @type {number} synthetic callId counter (the driver may omit callIds). */
  let callCounter = 0
  /** @type {string[]} noteworthy async observations (e.g. whenIdle quirks). */
  const observations = []
  /**
   * @type {Map<string, object>} per-session durable consumption state, keyed
   * by session id: `{ instanceId, ref, modelView, mcpViews (the
   * per-configured-server facet views — Record<serverName, view>; {} = no
   * MCP facet, T12-H1 generalized by multi-mcp C5), mcpFibers:
   * Map<serverName, fiber>, mcpActivationErrors: Map<serverName, string>,
   * appliedRecordIds: Set<string> }`. The `ref` is the
   * row-owned ModelSelectionRef installed on the public model-selection seam;
   * the views are the last APPLIED consumption views; `appliedRecordIds` is
   * the §18.3 boundary record set (which durable records this session has
   * already applied at its last request boundary).
   */
  const consumptionState = new Map()
  /**
   * @type {Promise<void> | undefined} the single boot() promise; boot() is
   * idempotent — a second call re-awaits the same promise.
   */
  let bootPromise = undefined
  /**
   * @type {Set<string>} Session ids with a live resume in flight (the
   * resuming marker, P8-S7 R2-5 / F12): written at the production resume
   * points (ensureLiveAgent + the boot resume phase) and cleared when the
   * resume settles (success or failure). The projection live-residency
   * overlay reads it through isResuming; it is ephemeral by design (the
   * frozen residency vocabulary is a non-durable overlay fact — UI §24).
   * The childFactory durable-child resume is deliberately UNMARKED: it
   * runs in the member-creation crash window, BEFORE the MemberInstance
   * row is committed, so no projection row exists to carry the fact.
   */
  const resumingSessions = new Set()
  // S1 (pr31_supplemental_fix_guide §2.2-A/§2.2-E, INV-2): the per-SID
  // Team activation SINGLE-FLIGHT coordinators. Two deliberately
  // SEPARATE maps (the guide's warning: avoid double single-flight that
  // waits on itself):
  //  - `activationInFlight` (LOW level, the ONE shared coordinator):
  //    every Team create/resume of a session — boot root create/resume,
  //    seed member create, boot member resume, childFactory create /
  //    durable resume, createRootAgent, ensureLiveAgent's resume —
  //    funnels through runOwnedActivation, so at most ONE in-flight
  //    Team create/resume per SID process-wide (INV-2: "ONE in-flight
  //    Team create/resume, ONE surviving AgentHandle"; concurrent
  //    callers await the SAME promise, they never each call
  //    agents.create/resume). Different SIDs stay concurrent (no
  //    global lock).
  //  - `ensureLiveAgentInFlight` (HIGH level): the WHOLE ensureLiveAgent
  //    body (the guide §2.2-B target shape) — the second concurrent
  //    caller of the same SID never re-enters the pre-resume flow
  //    (awaitRollback / foreignLive / durable / owning-root /
  //    rollback-epoch snapshot / resume / recovery / one retry); it
  //    awaits the first caller's promise.
  /** @type {Map<string, Promise<object>>} */
  const activationInFlight = new Map()
  /** @type {Map<string, Promise<object>>} */
  const ensureLiveAgentInFlight = new Map()

  /**
   * S1 (guide §2.2-A, verbatim shape): one in-flight operation per map
   * key — concurrent callers AWAIT THE SAME PROMISE (the identity check
   * in `finally` keeps an early-finished entry from deleting a later
   * caller's map entry — the guide's "同一个 Promise identity" note).
   * @param {Map<string, Promise<object>>} map
   * @param {string} sid
   * @param {() => Promise<object>} operation
   * @returns {Promise<object>}
   */
  async function singleFlightTeamActivation(map, sid, operation) {
    const existing = map.get(sid)
    if (existing !== undefined) return existing
    const promise = (async () => {
      return await operation()
    })()
    map.set(sid, promise)
    try {
      return await promise
    } finally {
      if (map.get(sid) === promise) {
        map.delete(sid)
      }
    }
  }
  // T12-M2: the persona surface state — the agent-scoped 'deployment:persona'
  // section disposers per session id, the identities installed before the
  // session's setup captured its agent ctx (queued until the setup flushes
  // them — still before any work on the session), the per-session live agent
  // ctx captured by the shared setup, and the lazy persona overlay slot.
  const personaDisposers = new Map()
  const personaPending = new Map()
  const liveAgentCtxs = new Map()
  let personaSlot
  // alpha.1 (plan §8.2): the row's TeamSkillCatalog — the NARROWEST
  // production input point (the row config's teamSkills list; absent =
  // the empty catalog: no Team-managed skills materialize, the legacy
  // behavior). Built once per binding (the list is a row constant; the
  // catalog is immutable after construction — no CRUD, no persistence).
  const teamSkillCatalog = new InMemorySkillCatalog(
    Array.isArray(config.teamSkills) ? [...config.teamSkills] : [],
  )

  // ── SESSION IDENTITY, DURABLE LIFECYCLE GATE AND ADMISSION CLOSE ──────────
  //
  // The whole block below this banner, plus the two maps it kept beside it
  // (the admission close and the boot-publish marker), used to live here. It
  // is now `session-identity.mjs`: nine functions answering questions about
  // ONE session - its child id, its instance, its owner, its durable
  // lifecycle, and whether new work is admitted - over the open domain and the
  // session-persistence seam, and the two maps are theirs because nothing else
  // may write them.
  const sessionIdentity = createSessionIdentity({
    domain,
    bootRootSessionId: rootSid,
    sessionPersistence,
    leaderInstanceId: LEADER_INSTANCE_ID,
  })
  const {
    childSessionIdFor,
    durableSessionExists,
    instanceIdForSession,
    teamRootOfSession,
    listMemberRows,
    memberResumeRefusal,
    admissionCloseRefusal,
    closeAdmission,
    reopenAdmission,
  } = sessionIdentity

  // ── C1 (restart-recovery, guide §6.1): the ownership-guarded activation wrappers ──
  // GOAL (guide §6.1/§6.2): no BARE agents.create / agents.resume calls
  // in the production body — every Team create/resume goes through these
  // wrappers so the fence's ownership guard (runOwned) + the awaited
  // agent/created veto (host-side) always see a Team activation as
  // Team-owned. When the fence dep is ABSENT (test/factory world —
  // guide §4.3), the wrappers fall back to the direct operation (the
  // pre-C1 behavior, so no pre-C1 test double breaks wholesale).
  // The wrappers themselves are the ONLY `agents.create` / `agents.resume`
  // call sites (a static assertion test pins the bare-call count at zero
  // everywhere else).

  /**
   * S1 (supplement guide §2.2-E): the claim wrapper — the Team glue's
   * EXACT generation claim (supplement INV-3). When the 0.1.7 lifecycle
   * invokes the setup with the real `setupAgent`, the wrapper claims
   * THAT object with the fence BEFORE delegating to the real setup:
   * the 0.1.7 createAgent flow is `createAgent → setupAndPublish →
   * initializeAgent → runMaintenance → publish → announce` (Commit-4
   * in-host verified), so the claim is established before the
   * AWAITED-serial `agent/created` announces the same object — the
   * fence's exact-match PASS is causal (the announced Agent object IS
   * the claimed one), not a time-window inference. Setup failure
   * RELEASES the claim (no leak — the create is rejected, the announce
   * never comes; supplement §2.2-C guarantees). Fence/claim API absent
   * (test/factory world without the fence, or a partial fence) → the
   * wrapper is a transparent passthrough.
   * @param {string} sessionId
   * @param {function} setup - the caller's composed agentSetup.
   * @returns {function} the wrapped AgentSetup.
   */
  function teamOwnedSetup(sessionId, setup) {
    const sid = String(sessionId)
    return async (agentCtx, setupAgent) => {
      const fence = activationFence
      if (fence !== undefined && typeof fence.claimOwnedGeneration === 'function') {
        // The claim is accepted only while the runOwned guard is held
        // (the fence's claim-acceptance gate — this wrapper always runs
        // inside runOwnedActivation's guarded operation).
        fence.claimOwnedGeneration(sid, setupAgent)
        try {
          return await setup(agentCtx, setupAgent)
        } catch (error) {
          if (typeof fence.releaseOwnedGeneration === 'function') {
            fence.releaseOwnedGeneration(sid, setupAgent)
          }
          throw error
        }
      }
      return await setup(agentCtx, setupAgent)
    }
  }

  /**
   * C1 (guide §6.1) + S1 (supplement guide §2.2-E): wrap one Team
   * activation in the fence's ownership guard (ref-counted `runOwned` —
   * nested activations of the same session compose; the guard is
   * released in `finally`, so a wrapper fault CLEARS the guard too —
   * test G3) AND in the LOW-LEVEL per-SID single-flight coordinator —
   * the ONE shared funnel for every Team create/resume entry (boot
   * root/seed/boot-member, childFactory create/durable-resume,
   * createRootAgent, ensureLiveAgent): concurrent activations of the
   * same SID await the SAME in-flight operation (INV-2), different SIDs
   * stay concurrent. Fence absent → run the operation direct (the
   * single-flight still applies — it is a glue property, not a fence
   * property).
   * @param {string} sessionId
   * @param {() => Promise<object>} operation
   * @returns {Promise<object>} the AgentHandle.
   */
  async function runOwnedActivation(sessionId, operation) {
    const sid = String(sessionId)
    return await singleFlightTeamActivation(activationInFlight, sid, async () => {
      if (activationFence !== undefined && typeof activationFence.runOwned === 'function') {
        return await activationFence.runOwned(sid, operation)
      }
      return await operation()
    })
  }

  /**
   * C1 (guide §6.1) + S1 (supplement guide §2.2-C): the guarded Team
   * RESUME (the one `agents.resume` call site). `setup` is the caller's
   * composed agentSetup (the shared REAL setup — the durable model
   * selection, the team tools, the persona, the MCP facet — unchanged by
   * the fence), wrapped in the exact-generation claim.
   * @param {{sessionId: string, setup: function}} args
   * @returns {Promise<object>} the AgentHandle.
   */
  /**
   * ROUND 78 (rc.5 acceptance): the deployment's default model selection as
   * AgentOptions. rc.5 reads `agent.model.current()` at the FIRST pre-step and
   * throws "has no provider/model" when neither AgentOptions nor a recorded
   * selection exists; the session-controller's rc.2 per-request default no
   * longer covers an Agent a plugin created directly. Passing the host's own
   * `agentDefaultModel` selection is the rc.5 creation contract (and rc.2
   * accepts the same options), so Team Agents keep the deployment route on
   * both generations. Getters, not a snapshot: the same live-config behaviour
   * the host's session-controller gives its own Agents.
   */
  function teamAgentOptions() {
    if (agentDefaultModel === undefined || agentDefaultModel === null
      || typeof agentDefaultModel.currentSelection !== 'function') return undefined
    return {
      get provider() { return agentDefaultModel.currentSelection().provider },
      get model() { return agentDefaultModel.currentSelection().model },
      get reasoningEffort() { return agentDefaultModel.currentSelection().reasoningEffort },
    }
  }

  async function resumeTeamAgent({ sessionId, setup }) {
    return await runOwnedActivation(sessionId, () =>
      agents.resume({
        resumeSessionId: SessionId(sessionId),
        agentOptions: teamAgentOptions(),
        setup: teamOwnedSetup(sessionId, setup),
      }),
    )
  }

  /**
   * C1 (guide §6.1) + S1 (supplement guide §2.2-C): the guarded Team
   * CREATE (the one `agents.create` call site). `meta` carries the
   * create-time session header (the effective workspace cwd — never
   * DSH_HOME); `setup` is wrapped in the exact-generation claim.
   * @param {{sessionId: string, meta: object, setup: function}} args
   * @returns {Promise<object>} the AgentHandle.
   */
  async function createTeamAgent({ sessionId, meta, setup }) {
    return await runOwnedActivation(sessionId, () =>
      agents.create({
        sessionId: SessionId(sessionId),
        agentOptions: teamAgentOptions(),
        meta,
        setup: teamOwnedSetup(sessionId, setup),
      }),
    )
  }

  /**
   * C1 (guide §7.1): the TYPED writer-held detection — the priority is
   * (1) `error.name === 'SessionAlreadyOwnedError'` (the 0.1.7 typed
   * error), (2) `error.code === 'session/writer-held'`, (3) the
   * compatibility MESSAGE `already owned by an active write handle` —
   * the message substring is a FALLBACK, never the sole authority
   * (guide §7.1: "不要把 message substring 作为唯一 authority").
   * @param {unknown} error
   * @returns {boolean}
   */
  function isSessionWriterHeld(error) {
    if (error === null || typeof error !== 'object') return false
    if (error.name === 'SessionAlreadyOwnedError') return true
    if (error.code === 'session/writer-held') return true
    if (typeof error.message === 'string' && error.message.includes('already owned by an active write handle')) return true
    return false
  }

  /**
   * Re-read the backend truth (the durable governance overrides) and resolve
   * the session's model + mcp consumption views. PURE — no live-agent side
   * effects — so boot setup, every request boundary, and the state route's
   * next-boundary projection all share the same derivation.
   * @param {string} sessionId
   * @param {string} [instanceIdHint] - the instance id the activation flow
   *   allocated for a FRESH child session: between the frozen flow's
   *   child-session creation (provider step 13) and the MemberInstance
   *   commit (step 15) the domain row does not exist yet, so the domain
   *   lookup would fail closed; the hint bridges exactly that window and
   *   carries the same value step 15 commits. The lookup stays
   *   authoritative for every other caller (boot, request boundary,
   *   projection).
   * @param {string} [teamRootSid] - the team root the session belongs to
   *   (T12-GLUE). PR #23 review fix (P1-A): when ABSENT the owning root is
   *   NEVER defaulted to this row's boot root — it is derived from (a) the
   *   already-persisted consumption state's `teamRootSessionId` (set by the
   *   session's own setup), then (b) the durable domain ownership
   *   ({@link teamRootOfSession}). A session with NO resolvable owning
   *   team root THROWS — the boot-root fallback is exactly what made the
   *   state route serve a dynamically created root's session under the
   *   boot root's blueprint / overrides (the state showed
   *   mounted=true/allowed=false/source=unspecified while the MCP was
   *   actually mounted).
   * @param {string} [templateIdHint] - the fresh-create window template id
   *   (the MCP initial-grant locate ONLY — the same hint gate as
   *   locateTemplate: used for the fresh-member window, never elsewhere).
   * @param {string} [bindPath] - the T1 bind path (gates the
   *   templateIdHint for the initial-grant locate, exactly like
   *   locateTemplate's P0-1 rule).
   * @returns {{instanceId: string, teamRoot: string, modelView: object, mcpViews: Record<string, object>}}
   *   `teamRoot` is the OWNING team root the resolution ran under (the
   *   normalized value every downstream read used — the setup persists it
   *   in the consumption state as `teamRootSessionId`). `mcpViews` is the
   *   per-configured-server facet views (the multi-mcp C5
   *   generalization of the single T12-H1 mcpView): the EMPTY object when
   *   no MCP server is configured (config.mcpServers = [] / legacy
   *   mcpServer = null): no MCP facet exists, so consumers treat {} as
   *   "no MCP" (never expect an entry).
   *
   *   MCP initial static grant (plan MCP_BLUEPRINT_INITIAL_GRANT §4.3):
   *   EVERY resolution here feeds the bound Blueprint template's
   *   `capabilities.mcp` (kind === 'allow') into the per-server facet as
   *   its INITIAL static governance layer — fresh root / fresh member /
   *   cold root / cold member setup AND every request boundary share this
   *   ONE derivation (no second grant path, no synthetic durable record).
   *   The derivation is the shared `initialMcpGrantOf(staticCapabilitiesOf(...))`
   *   (plan §5 — the same helper as team_inspect_config and the activation
   *   step-8 policy). PR #23 review fix (P1-B): a bound-blueprint or
   *   template RESOLUTION fault (the blueprint unavailable, the template
   *   not found, the identity unresolved) FAILS LOUD — the typed
   *   `capability-template-unresolved` rejection propagates; ONLY a
   *   successfully resolved template whose `capabilities.mcp` is not an
   *   explicit non-empty allow contributes no initial grant (the
   *   unspecified / fail-closed baseline). The static template filter
   *   (filterMcpServers) remains the second mount gate.
   */
  function resolveConsumptionViews(sessionId, instanceIdHint, teamRootSid, templateIdHint, bindPath) {
    const existing = consumptionState.get(sessionId)
    // T12-GLUE: the consumption cell is keyed by the TEAM ROOT the session
    // belongs to — the handoff target resolves under its own root's durable
    // truth (its own governance overrides, never the boot team's).
    // PR #23 review fix (P1-A): the owning root is NEVER defaulted to the
    // boot root when absent. Explicit callers (boot / fresh create / cold
    // resume / handoff / team tool) pass it; the state route and the fresh
    // create window omit it — there the root comes from the session's own
    // persisted state first (set at setup), then the durable domain
    // ownership. An unresolved owning root is a loud error: a session
    // that belongs to NO team must not be served from the boot root's
    // blueprint / overrides / template (that mismatch is the P1-A bug —
    // state showed mounted=true/allowed=false/source=unspecified while the
    // MCP was actually mounted, with the locate failure swallowed and only
    // its observation leaked).
    const explicitRoot = teamRootSid !== undefined ? String(teamRootSid) : undefined
    const teamRoot = explicitRoot ?? existing?.teamRootSessionId ?? teamRootOfSession(sessionId)
    if (teamRoot === undefined) {
      throw new Error(
        `p6t6 consumption: no owning team root for session '${sessionId}' (neither an explicit root, a persisted consumption state, nor a durable domain ownership resolved it)`,
      )
    }
    let instanceId
    if (existing !== undefined) instanceId = existing.instanceId
    else if (instanceIdHint !== undefined) instanceId = String(instanceIdHint)
    else instanceId = instanceIdForSession(sessionId, teamRoot)
    const overrides = domain.repositories.overrides.list(teamRoot)
    // T12-B3: the external hard facts come from the boot config (the host
    // injects them at plugin construction). This is schema normalization
    // ONLY — shallow copies so a mutation of the normalized object cannot
    // reach the config, and undefined-safe for a config that predates the
    // field. The POLICY semantics stay in the resolvers: an external hard
    // entry wins over every Team layer (including human overrides —
    // invariant 34), and a capabilityExists:false cell denies with
    // 'capabilityMissing'.
    const facts = config.externalPolicyFacts
    const external = {
      hard: { ...(facts?.hard ?? {}) },
      capabilityExists: { ...(facts?.capabilityExists ?? {}) },
    }
    const applied = existing !== undefined ? [...existing.appliedRecordIds] : []
    // MCP initial static grant (plan MCP_BLUEPRINT_INITIAL_GRANT §4.3):
    // the bound template's capabilities.mcp (kind === 'allow') is the
    // role's INITIAL governance grant for the mcp cell — re-derived from
    // the immutable bound snapshot HERE so fresh setup / cold resume /
    // every request boundary share one derivation.
    // PR #23 review fix (P1-B): the locate + bound-blueprint calls FAIL
    // LOUD — a resolution fault (blueprint unavailable / template not
    // found / identity unresolved) propagates its typed
    // `capability-template-unresolved` rejection instead of being swallowed
    // into "no initial grant" (the broad catch was exactly what let a
    // healthy dynamic root read its grant under the wrong root's blueprint
    // and serve an unspecified view with a leaked observation). Only a
    // SUCCESSFULLY resolved template whose capabilities carry no explicit
    // non-empty allow contributes no grant (the shared helper normalizes
    // the empty-allow and non-allow cases; plan §5).
    // PR #23 review fix (P1-A): BOTH the locate and the bound-blueprint
    // read run under the NORMALIZED owning teamRoot (never the raw
    // `teamRootSid`, which is `undefined` for the state route and the
    // fresh-create window and would silently resolve the boot root).
    //
    // model-preference routing fix (§4.6): the template locate runs BEFORE
    // the model resolution (the pre-fix order resolved the model cell
    // first, WITHOUT the template's static model value, so a declared
    // `modelPreference` degraded to the `unspecified` -> staticModel
    // baseline — the bug). The SAME bound template then drives BOTH
    // initial grants (model + mcp) — one locate, two derivations, no
    // second locate with a different fallback path anywhere in this setup.
    const boundTemplate = locateTemplate(sessionId, instanceId, templateIdHint, teamRoot, bindPath)
    const boundBlueprint = getBoundBlueprint(teamRoot)
    const initialTemplateModel = initialTemplateModelGrantOf(boundTemplate, config.staticModel)
    const initialTemplateMcp = initialMcpGrantOf(staticCapabilitiesOf(boundBlueprint, boundTemplate))
    // The generic template static values (model + mcp) — the SAME shape
    // `resolveActivationPolicy` (and the step-8 frozen policy) accepts;
    // an empty object never fakes template authority (the `unspecified`
    // contract stands when the template declares no static grants).
    const templateValues = {
      ...(initialTemplateModel !== undefined ? { model: initialTemplateModel } : {}),
      ...(initialTemplateMcp !== undefined ? { mcp: initialTemplateMcp } : {}),
    }
    // pre-alpha3 PR-B (plan §B.2): THE canonical consumption read — the
    // production PolicyReader (the lazy ref: the production host fills it
    // after the root is built — the bound-snapshot static authority) +
    // the durable PolicyState transitions (COMMIT order — the committed
    // state participates in the live boundary resolution; the legacy
    // step fields keep parse/display only). An ABSENT / unfilled ref is
    // the pre-PR-B LEGACY input (the config external facts + the
    // template-derived static grants + the implicit `default` state) —
    // the test worlds keep their bit-for-bit behavior.
    const canonicalPolicy = policyReaderRef?.current ?? undefined
    const canonical = canonicalPolicy !== undefined
    const policyStateTransitions = canonical
      ? listDurablePolicyStateTransitions(domain.repositories, teamRoot)
      : []
    const modelArgs = {
      rootSessionId: teamRoot,
      instanceId,
      overrides,
      baseline: { ...config.staticModel },
      ...(canonical
        ? { policy: canonicalPolicy, transitions: policyStateTransitions }
        : {
            external,
            ...(Object.keys(templateValues).length > 0 ? { templateValues } : {}),
          }),
    }
    if (applied.length > 0) {
      modelArgs.appliedRecordIds = applied
    }
    const { view: modelView } = consumption.model.resolveDurableModelSelection(modelArgs)
    // multi-mcp (contract I4; T12-H1 generalized to 0..N): the PER-SERVER
    // views — one resolveDurableMcpFacet call per CONFIGURED server (the
    // resolver is the unchanged C4 policy authority; the serverName
    // parameter is its existing per-server seam). Zero configured servers
    // -> {} (no MCP facet: no resolution, no reconcile attempt downstream).
    const mcpViews = {}
    for (const server of configuredMcpServers(config)) {
      mcpViews[server.name] = consumption.capability.resolveDurableMcpFacet({
        rootSessionId: teamRoot,
        instanceId,
        overrides,
        serverName: server.name,
        ...(applied.length > 0 ? { appliedRecordIds: applied } : {}),
        ...(canonical
          ? { policy: canonicalPolicy, transitions: policyStateTransitions }
          : {
              external,
              ...(initialTemplateMcp !== undefined ? { initialTemplateMcp } : {}),
            }),
      }).view
    }
    // PR #23 review fix (P1-A): the OWNING root the resolution ran under is
    // part of the contract — the setup persists it in the consumption
    // state (`teamRootSessionId`) so every later rootless re-resolution
    // (the state route) runs under the same root.
    // model-preference routing fix (§4.6): `boundTemplate` is the SAME
    // located template the model + mcp grants were derived from — the
    // setup reuses it for the static-capabilities / permissions / persona
    // projections (one bound snapshot, one template per setup).
    return { instanceId, teamRoot, modelView, mcpViews, boundTemplate }
  }

  /**
   * Mark every record the just-applied boundary consumed as applied (the
   * §18.3 `appliedRecordIds` set advances to "everything admitted for the
   * cells this boundary resolved").
   * @param {object} state
   * @param {object} modelView
   * @param {Record<string, object>} mcpViews (the per-server facet views;
   *   {} = no MCP facet — T12-H1 generalized by multi-mcp C5). The Set
   *   target dedupes naturally when one durable record appears in several
   *   servers' pending lists (a shared-scope override — legal, §18.3).
   */
  function applyBoundaryRecords(state, modelView, mcpViews) {
    const mcpPending = []
    for (const view of Object.values(mcpViews)) {
      mcpPending.push(...view.pendingNextBoundary)
    }
    for (const pending of [...modelView.pendingNextBoundary, ...mcpPending]) {
      state.appliedRecordIds.add(pending.recordId)
    }
  }

  // ── pre-alpha3 PR-C §C.6: the MCP per-server materialization ───────────
  //
  // The retry cooldown window: a `failed` materialization slot is not
  // re-attempted until this long after its last attempt (plan §C.6 boundary
  // retry + cooldown — no hot retry loop on a down server).
  const MCP_RETRY_COOLDOWN_MS = 30_000
  //
  // F15 (MCP live-loss zero-core, plan §5.1-A): the explicit SHORT
  // reconnect policy every production MCP mount carries (the upstream
  // `ReconnectConfig` — the public seam pinned by
  // tests/deepseek-harness-test-use/packages/mcp/mcp-client/lib/types/
  // connection.d.ts: `initialDelayMs` doubles per consecutive failed
  // attempt up to `maxDelayMs`; `maxAttempts` consecutive failed attempts
  // per outage exhausts the budget, and "Exhaustion unregisters the
  // server's tools and stops; disposal (including HMR) is the only way
  // back from that state"). Delays 500 → 1000 → 2000: a PURE BACKOFF
  // budget of 500 + 1000 + 2000 = 3.5 seconds (the 0.1.7 defaults
  // 500/30000/10 ≈ 151.5 s are deliberately NOT used — a permanently
  // lost server must not hold a stale-positive readiness for two and a
  // half minutes).
  //
  // THIS IS A TRANSIENT-FAILURE GRACE POLICY, NOT THE PLUGIN REMOUNT
  // COOLDOWN: the 30 s `MCP_RETRY_COOLDOWN_MS` above is a different
  // semantic layer (the plugin's own failed-slot retry gate) — the two
  // must never be conflated (plan §5.1-A). The 3.5 s budget is also NOT
  // a wall-clock detection upper bound (plan §8: the confirmed-loss
  // observation latency is measured empirically and recorded, never
  // promoted to a cross-transport contract).
  const MCP_UPSTREAM_RECONNECT_INITIAL_MS = 500
  const MCP_UPSTREAM_RECONNECT_MAX_MS = 2_000
  const MCP_UPSTREAM_RECONNECT_ATTEMPTS = 3
  const MCP_UPSTREAM_RECONNECT_POLICY = Object.freeze({
    enabled: true,
    initialDelayMs: MCP_UPSTREAM_RECONNECT_INITIAL_MS,
    maxDelayMs: MCP_UPSTREAM_RECONNECT_MAX_MS,
    maxAttempts: MCP_UPSTREAM_RECONNECT_ATTEMPTS,
  })
  // F15 (plan §6): the plugin-owned observation reason codes (the probe
  // port carries them as provenance; they are NOT disguised upstream
  // error codes).
  const MCP_REASON_PUBLIC_TOOL_SURFACE_WITHDRAWN = 'MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN'
  const MCP_REASON_LIVE_WITNESS_UNAVAILABLE = 'MCP_LIVE_WITNESS_UNAVAILABLE'
  // ── the MCP CAPABILITY WITNESS half of the lane ───────────────────────
  //
  // Telemetry, the public tool-surface readers and fiber retirement now live in
  // `mcp-witness-lane.mjs` (extracted verbatim). The mount transaction
  // (`reconcileMcpSet`) and the plugin-owned cooldown/reconnect constants STAY here: the §9.2
  // static witness reads THIS file and pins the ONE mount call site plus those literals.
  const mcpWitnessLane = createMcpWitnessLane({ deps, observations })
  const {
    emitMcpCapabilityEvent,
    readMcpServerToolSurface,
    recordMcpToolWitness,
    retireExhaustedMcpFiber,
  } = mcpWitnessLane

  /**
   * F15 (plan §5.1-C) — the confirmed-loss detector: observe one
   * server's CAPABILITY through its public tool surface on one live
   * session. This is a capability operational witness, NOT transport
   * socket state (plan §3.1). Classification (plan §5.1-C rules):
   *
   *   1. no live fiber here → defer `unknown` (the probe port folds the
   *      materialization slot — a `failed` slot stays unreachable
   *      through the legacy path);
   *   2. fiber + readable non-empty surface → `reachable` (a fresh
   *      generation re-synced — §9.4: a successful tool-generation
   *      swap is NOT a loss);
   *   3. fiber + empty surface + `everToolBearing` + NOT a
   *      plugin-initiated removal + still policy-targeted →
   *      CONFIRMED LOSS: retire the exhausted fiber (exactly once) and
   *      report `unreachable` + `confirmedLoss`;
   *   4. fiber + `everToolBearing === false` (a zero-tool server —
   *      L3) → `unknown` (observation unavailable — a zero-tool mount
   *      is NEVER a fabricated `unreachable`).
   *
   * A probe that CANNOT observe (the surface unreadable) fails soft to
   * `unknown` (plan §C.10 gate 3) — never a throw, never a fabricated
   * `unreachable`.
   * @param {object} state - the session's consumption state.
   * @param {string} serverName - the MCP server (the capability name).
   * @returns {Promise<{verdict: string, reason?: string, confirmedLoss?: boolean}>}
   */
  async function observeMcpOperationalWitness(state, serverName) {
    const fiber = state.mcpFibers.get(serverName)
    if (fiber === undefined) {
      return { verdict: 'unknown', reason: MCP_REASON_LIVE_WITNESS_UNAVAILABLE }
    }
    const names = readMcpServerToolSurface(state, serverName)
    if (names === null) {
      return { verdict: 'unknown', reason: MCP_REASON_LIVE_WITNESS_UNAVAILABLE }
    }
    recordMcpToolWitness(state, serverName, names)
    if (names.length > 0) {
      return { verdict: 'reachable' }
    }
    const record = state.mcpToolWitness.get(serverName)
    if (record === undefined || !record.everToolBearing) {
      // L3: a zero-tool server (or an unreadable first observation) —
      // NOT a loss; the live-loss observation degrades to unknown.
      return { verdict: 'unknown', reason: MCP_REASON_LIVE_WITNESS_UNAVAILABLE }
    }
    // Intentional-removal suppression (plan §5.2 / §3.4): a
    // plugin-initiated disposal (policy deny, residency drop, row
    // teardown/close) is NOT a runtime loss — no telemetry, no
    // retirement.
    if (state.mcpIntentionalRemoval.has(serverName)) {
      return { verdict: 'unknown', reason: MCP_REASON_LIVE_WITNESS_UNAVAILABLE }
    }
    if (state.mcpViews !== undefined && state.mcpViews[serverName]?.allowed !== true) {
      // The server is no longer in the current policy target set.
      return { verdict: 'unknown', reason: MCP_REASON_LIVE_WITNESS_UNAVAILABLE }
    }
    if (closing === true) {
      // Row teardown in flight — the disposal below is the row stop.
      return { verdict: 'unknown', reason: MCP_REASON_LIVE_WITNESS_UNAVAILABLE }
    }
    // CONFIRMED LOSS — the retirement runs in the SAME owned step (the
    // probe), so the requirement gate of the same boundary sees the
    // failed slot and BLOCKS (plan §5.3 ordering).
    await retireExhaustedMcpFiber(state, serverName, MCP_REASON_PUBLIC_TOOL_SURFACE_WITHDRAWN)
    return {
      verdict: 'unreachable',
      reason: MCP_REASON_PUBLIC_TOOL_SURFACE_WITHDRAWN,
      confirmedLoss: true,
    }
  }

  /**
   * Mount (or dispose) the live mini-MCP servers on one agent per the
   * per-server durable mcp facet views (multi-mcp C5/C6; contract I4).
   * The fiber is a thenable: awaiting it completes activation (connection
   * + tool discovery); `.dispose()` unregisters the tools.
   *
   * Deny-first ordering (plan §2.5): every mounted server OUTSIDE the
   * target set is disposed BEFORE any new mount, so a failed new mount can
   * never leave a denied server exposed.
   *
   * PER-SERVER MOUNT TRANSACTION (pre-alpha3 PR-C §C.6): the all-or-nothing
   * activation is REPLACED. Each target server is mounted independently: a
   * SUCCESS commits its fiber to the live set immediately (it never waits
   * for the others); a FAILURE lands in that server's per-server
   * materialization slot (`state.mcpMaterialization`) as `failed` (with the
   * attempt count + a retry cooldown) WITHOUT rolling back the healthy
   * fibers — one failed server must NOT strand the mounted ones (the C.10
   * gate: C down → A/B stay mounted). The denied disposals above are NOT
   * restored (they are the durable decision, not a side effect). A failed
   * server is isolated (a `failed` slot, retried at the next boundary after
   * the cooldown) — never half-mounted, never a setup/boundary failure: the
   * request runs on the healthy surface, and each transition is visible
   * through the per-server slot, the unified runtime status, and the durable
   * capability-runtime telemetry (a `mount-failed` / `mount-restored` event).
   * @param {object} state - the session's consumption state (holds the
   *   per-server fibers / activation errors / last-applied views /
   *   materialization slots) AND —
   *   PR #23 review fix (Finding 1, plan §6) — `mcpMountCtx`: the
   *   Agent-keyed scope context every serverName is registered under
   *   (the agent's own ctx when it already carries the agent's scope tag,
   *   else the per-agent bridge scope minted at setup). Mounting under
   *   this per-agent context keeps upstream mcp-client's
   *   `scopeOf(ctx) ?? ctx.root` serverName registry namespaced PER
   *   AGENT (two agents may mount the same serverName; the model-visible
   *   `mcp__<serverName>__<tool>` names stay unchanged).
   * @param {readonly string[]} targetServerNames - the exact server set
   *   this agent may mount NOW (the caller's template ∩ durable decision —
   *   contract I4 §2.3; an empty set = dispose everything, mount nothing).
   */
  async function reconcileMcpSet(state, targetServerNames) {
    const configured = configuredMcpServers(config)
    const byName = new Map(configured.map((s) => [s.name, s]))
    // (1) structural guard: the target is always computed FROM the
    //     configured names — an unconfigured name in the target is a
    //     caller bug; fail closed, never mount the unknown (C2 identity).
    for (const name of targetServerNames) {
      if (!byName.has(name)) {
        throw new Error(`p6t6: reconcile target names an unconfigured mcp server '${name}'`)
      }
    }
    // (2) DENY-FIRST: dispose every mounted server outside the target (a
    //     dispose failure is observed, never allowed to strand the
    //     remaining disposals). The last-applied VIEWS are kept (state
    //     semantics: the views are the last applied consumption views —
    //     a denied server's view records the denial).
    for (const name of [...state.mcpFibers.keys()]) {
      if (targetServerNames.includes(name)) continue
      const fiber = state.mcpFibers.get(name)
      // F15 (plan §5.2): this is a PLUGIN-INITIATED removal (the policy
      // deny — the durable decision unmounting the server): the exact
      // suppression sequence (add intentional-removal → dispose →
      // delete fiber → clean witness → remove intentional-removal).
      // A runtime-loss telemetry (capability-lost /
      // MCP_PUBLIC_TOOL_SURFACE_WITHDRAWN) must NEVER come from this
      // path — the witness honors the flag if a probe ever observes
      // the disposal window.
      state.mcpIntentionalRemoval.add(name)
      try {
        fiber.dispose()
      } catch (error) {
        observations.push(`p6t6: mcp fiber dispose failed [server ${name}]: ${error instanceof Error ? error.message : String(error)}`)
      }
      state.mcpFibers.delete(name)
      state.mcpActivationErrors.delete(name)
      state.mcpToolWitness.delete(name)
      state.mcpIntentionalRemoval.delete(name)
    }
    // (3) mounts = target − already mounted, in CONFIGURED order (the
    //     deterministic activation order; C2: the name is the identity).
    const mounts = configured.filter((s) => targetServerNames.includes(s.name) && !state.mcpFibers.has(s.name))
    if (mounts.length === 0) return
    // (4-5) PER-SERVER MOUNT TRANSACTION (plan §C.6): each target server is
    //       mounted independently. A success commits its fiber to the live
    //       set immediately (it never waits for the others); a failure lands
    //       in that server's materialization slot as `failed` WITHOUT
    //       rolling back the healthy fibers. The port check runs FIRST (a
    //       policy-allowed server without a port fails closed WITH the
    //       server named — plan §6.8 case 2 — but isolates: the other
    //       servers still mount); a server NOT in the target is never
    //       port-checked (an unselected port-null server cannot block the
    //       setup — case 1).
    const now = Date.now()
    for (const server of mounts) {
      const slot = state.mcpMaterialization.get(server.name)
      // Cooldown: a server in the retry cooldown window (a recent failed
      // attempt) is SKIPPED this round — it stays `failed` (a pending
      // retry) and is re-probed at the next boundary after the cooldown
      // elapses (plan §C.6 boundary retry + cooldown; no hot retry loop).
      if (
        slot !== undefined &&
        slot.status === 'failed' &&
        now - slot.lastAttemptAt < MCP_RETRY_COOLDOWN_MS
      ) {
        continue
      }
      let mounted = false
      let reason
      try {
        if (server.port === null) {
          throw new Error(`p6t6: the durable policy allows mcp server '${server.name}' but no mini-MCP port is configured (config.mcpServers port for '${server.name}')`)
        }
        // Finding 1 bridge (plan §6): mount under the Agent-keyed scope
        // context (state.mcpMountCtx) — NEVER the shared row ctx — so the
        // upstream serverName registry is per-Agent, not global.
        const fiber = state.mcpMountCtx.plugin(mcpClient, {
          transport: 'streamable-http',
          serverName: server.name,
          url: `http://127.0.0.1:${server.port}/mcp`,
          headers: {},
          toolCallTimeoutMs: 15_000,
          failOnStartupError: true,
          // F15 (plan §5.1-A): the explicit SHORT reconnect policy
          // (never the 0.1.7 defaults) — the 3.5 s pure-backoff grace
          // after which the upstream supervisor withdraws the server's
          // tools (the confirmed-loss signal this task classifies).
          reconnect: MCP_UPSTREAM_RECONNECT_POLICY,
        })
        await fiber
        state.mcpFibers.set(server.name, fiber)
        mounted = true
      } catch (error) {
        reason = error instanceof Error ? error.message : String(error)
      }
      // (6) PER-SERVER IMMEDIATE COMMIT: the success joins the live set NOW
      //     (no rollback of the healthy fibers); the failure records its
      //     slot (attempts + lastAttemptAt + reason) + the legacy error map
      //     (the harness state route reads it) + a telemetry event. A
      //     `failed` → `mounted` transition is a RESTORE (the C.10 gate: C
      //     recovers → next boundary auto-mount).
      const attempts = (slot !== undefined && typeof slot.attempts === 'number' ? slot.attempts : 0) + 1
      const wasFailed = slot !== undefined && slot.status === 'failed'
      state.mcpMaterialization.set(
        server.name,
        mounted
          ? { status: 'mounted', attempts, lastAttemptAt: now }
          : { status: 'failed', attempts, lastAttemptAt: now, reason },
      )
      if (mounted) {
        state.mcpActivationErrors.delete(server.name)
        // F15 (plan §5.1-B): seed the EPHEMERAL tool witness from the
        // LIVE public surface right after the successful activation —
        // a tool-bearing mount marks `everToolBearing`; a zero-tool
        // mount seeds the record with `everToolBearing: false` (the
        // L3 baseline: never a fabricated `unreachable`). A fresh
        // remount after a confirmed loss re-seeds the record (the
        // retirement cleared it).
        recordMcpToolWitness(state, server.name, readMcpServerToolSurface(state, server.name))
        if (wasFailed) {
          observations.push(`p6t6: mcp mount restored [server ${server.name}] (attempt ${attempts})`)
          await emitMcpCapabilityEvent(state, 'mount-restored', server.name, 'reachable', attempts, undefined)
        }
      } else {
        state.mcpActivationErrors.set(server.name, reason)
        observations.push(`p6t6: mcp activation failed [server ${server.name}]: ${reason}`)
        await emitMcpCapabilityEvent(state, 'mount-failed', server.name, 'unreachable', attempts, reason)
      }
    }
  }

  // ── the bound blueprint and the template a session embodies ──────────────
  //
  // The block below used to live here: the per-team-root bound-blueprint cache,
  // the fail-closed template locator and the static-capabilities projection.
  // They are now `template-binding.mjs`, because they own state (the cache) and
  // answer one question - WHICH template is this session, under WHICH bound
  // snapshot - that the permission install, the capability projection and the
  // persona sources all ask.
  const templateBinding = createTemplateBinding({
    domain,
    bootRootSessionId: rootSid,
    resolveBoundBlueprint,
    blueprintSource: config.blueprintSource,
    observe: (message) => observations.push(message),
    parseBlueprint,
    staticCapabilitiesOf,
  })
  const { getBoundBlueprint, locateTemplate, resolveStaticCapabilities } = templateBinding

  /**
   * The shared agent setup (create OR resume): resolve the durable model
   * selection + the mcp facet from the backend truth NOW, install the
   * row-owned ModelSelectionRef on the public model-selection seam, register
   * every team tool, and mount the live mini-MCP server when the durable
   * policy allows it. The disposers are collected for row-stop cleanup (the
   * agent-scope unwind covers them on disposal as well).
   * @param {string} sessionId - the session this agent embodies.
   * @param {string} [instanceIdHint] - the fresh-child instance id carried
   *   by the child factory (see resolveConsumptionViews); only that caller
   *   passes it.
   * @param {string} [templateIdHint] - the member template id the child
   *   factory request carries (T12-M2: the fresh-create window, before the
   *   MemberInstance row commits the same value).
   * @param {string} [bindPath] - one of the four T1 bind paths (the persona
   *   overlay step context carries it).
   *
   * T12-M2: the setup also installs the blueprint persona into the REAL DSH
   * Agent prompt — the agent-scoped 'deployment:persona' system-prompt
   * section — through the reused persona resolver (the resolver evaluates
   * the preset substrate and composes the scoped identity; this glue is the
   * last layer it installs onto). A pre-setup
   * personaSurface.installScopedPersona for the same session flushes here
   * too. Both installs precede any work on the session.
   *
   * D1 (v2): on the MEMBER bind paths (fresh-member / cold-member) the
   * setup also mounts the ordinary AgentPreset substrate (the file/shell
   * base tools) through the public agentPresets.mount seam, IN ADDITION
   * to the ten team tools — members-only v2 scope: the root bind paths
   * never mount. config.memberPresetId undefined = the deployment default
   * (no id passed). A missing/unusable agentPresets service on a member
   * path fails closed with the typed member-base-tools-unavailable error
   * (the setup rejection rolls the unpublished agent back — a member never
   * runs without its base tools).
   * @param {string} [teamRootSid] - the team root the session belongs to
   *   (T12-GLUE; absent = this row's boot root, as before).
   * @returns {function(object, object?): Promise<void>} the AgentSetup
   *   callback — `(agentCtx, setupAgent?)`: the DSH 0.1.5+ contract passes
   *   the composed Agent explicitly as the second argument; 0.1.2-era
   *   hosts call it with only `agentCtx` (the resolver then uses the
   *   legacy seams).
   */
  function agentSetup(sessionId, instanceIdHint, templateIdHint, bindPath, teamRootSid) {
    // fix/alpha2-explicit-agent-setup-compat: the DSH 0.1.5+ AgentSetup
    // contract is `setup(agentCtx, agent)` — the factory passes the very
    // Agent being composed as the SECOND parameter and no longer exposes
    // `agentCtx.agent` (the reverse association was removed upstream).
    // 0.1.2-era hosts still call `setup(agentCtx)` — `setupAgent` is then
    // `undefined` and the resolver falls back to the legacy seams.
    return async (agentCtx, setupAgent) => {
      // T12-M2: capture the agent ctx for the persona surface (the
      // production-facing installs and the overlay slot resolve through it).
      liveAgentCtxs.set(sessionId, agentCtx)
      // The CANONICAL runtime-Agent identity for this setup (the explicit
      // AgentSetup agent -> agentCtx.agent -> the scope tag; see
      // resolveSetupAgent): the single source for the Permission Coverage
      // Gate's `tools.schemas(agent)` surface read AND the permission
      // resolver's lazy `session.header.cwd` basis below — both consumed
      // through this one value (one Agent, one identity, one cwd basis).
      const runtimeAgent = resolveSetupAgent(agentCtx, setupAgent)
      // The initial-grant locate rides the setup's fresh-create window
      // hints (templateIdHint + bindPath) — the SAME gate locateTemplate
      // applies below (P0-1: the hint bridges ONLY the fresh-member
      // window; a cold path missing its durable row fails closed).
      // PR #23 review fix (P1-A): `teamRoot` is the OWNING root the
      // resolution ran under — persisted into the consumption state so the
      // rootless state-route re-resolution of the SAME session runs under
      // the same root (no boot-root default anywhere).
      const { modelView, mcpViews, instanceId, teamRoot, boundTemplate } = resolveConsumptionViews(
        sessionId,
        instanceIdHint,
        teamRootSid,
        templateIdHint,
        bindPath,
      )
      // alpha.1 (plan §10): the static template capabilities of this
      // session — the durable identity (row templateId / leader position /
      // fresh-create hint) -> the bound blueprint's per-template declaration.
      // LEGACY mode (the 0.1.0-rc.1 behavior) for every facet below when the
      // template declares no capabilities.
      //
      // alpha.2 (plan §11): ONE locate serves BOTH projections — the
      // alpha.1 static-capabilities projection AND the alpha.2
      // `capabilities.permissions` policy (the deep-frozen, A1-normalized
      // TemplatePermissionPolicy, read directly off the bound template —
      // FACT 3a: the projection deliberately does not carry it). ABSENT
      // policy = no permission listener at all (the alpha.1 / legacy path,
      // byte-for-byte unchanged — the absent-permissions test is the proof).
      // PR #23 review fix (P1-A): the setup's own bound-blueprint read runs
      // under the SAME normalized owning teamRoot the consumption resolution
      // used (never the raw hint — absent hint = the boot root, which is
      // WRONG for a session owned by another team root).
      // model-preference routing fix (§4.6): `boundTemplate` IS the
      // locateTemplate result the consumption resolution already derived
      // under the owning teamRoot with the fresh-create hint gate — the
      // setup reuses it (same owning root, same bound snapshot, same
      // template) instead of a second locate with a different fallback
      // path.
      const capabilities = staticCapabilitiesOf(getBoundBlueprint(teamRoot), boundTemplate)
      const ref = { current: modelView.selection === undefined ? { ...config.deniedSelection } : modelView.selection, assembled: undefined }
      const state = {
        instanceId,
        // PR #23 review fix (P1-A): the owning team root this session's
        // consumption resolution runs under (explicit hint / this setup's
        // domain derivation). Process-local bookkeeping like the fibers —
        // NOT part of the durable state; the domain row (teamSessions /
        // memberInstances) remains the durable authority.
        teamRootSessionId: teamRoot,
        ref,
        modelView,
        mcpViews,
        mcpFibers: new Map(),
        mcpActivationErrors: new Map(),
        // pre-alpha3 PR-C §C.6: the per-server MCP materialization slots —
        // { status: 'mounted'|'failed', attempts, lastAttemptAt, reason? }.
        // EPHEMERAL (rebuilt from the first post-restart reconcile; never a
        // persisted fabricated failure) — the durable authority is the
        // capability-runtime telemetry. A `mounted` slot = a live fiber; a
        // `failed` slot = an isolated failure (retried after the cooldown).
        mcpMaterialization: new Map(),
        // F15 (plan §5.1-B / §12): the EPHEMERAL per-server public
        // tool-surface witness — { everToolBearing, lastObservedNames }.
        // NEVER persisted (the durable record is the capability-runtime
        // telemetry); a zero-tool server stays `everToolBearing: false`
        // (its live-loss observation degrades to unknown, never a
        // fabricated unreachable).
        mcpToolWitness: new Map(),
        // F15 (plan §5.2 / §12): the EPHEMERAL set of server names in a
        // PLUGIN-INITIATED removal (policy deny / residency drop / row
        // teardown) — the confirmed-loss detector must not emit runtime
        // loss telemetry for these disposals.
        mcpIntentionalRemoval: new Set(),
        appliedRecordIds: new Set(),
        // PR #23 review fix (Finding 1, plan §6): the Agent-keyed MCP
        // scope bridge. `mcpMountCtx` is the context every mini-MCP
        // serverName is registered under; `mcpMountScope` is the
        // scope fiber it came from (undefined when the agent's own ctx
        // already carries the agent's scope tag — the common case,
        // zero overhead).
        mcpMountCtx: agentCtx,
        mcpMountScope: undefined,
      }
      // Finding 1 compatibility bridge (PR #23 review fix, plan §6.2):
      // upstream mcp-client registers its per-serverName registry under
      // `scopeOf(ctx) ?? ctx.root` with ITS OWN dsh-scope module instance.
      // When the agent's ctx carries no scope tag readable through that
      // instance (no tag at all, or a tag written by a DIFFERENT dsh-scope
      // module instance — the duplicate-package case the production host
      // hit: two roots mounting one serverName collided at the global
      // root), mount under a scope we mint HERE, keyed by the canonical
      // runtime Agent: a per-AGENT namespace that neither collides
      // cross-agent nor renames the model-visible `mcp__<serverName>__*`
      // tool names. Each Agent gets its own scope (NEVER a shared
      // cross-agent MCP registration scope); the scope fiber is a child of
      // the agent's ctx, so the agent's disposal unwinds every
      // scope-registered MCP fiber with it.
      if (
        runtimeAgent !== null &&
        runtimeAgent !== undefined &&
        scopeOf(agentCtx) !== runtimeAgent
      ) {
        const mcpMountScope = createScope(agentCtx, runtimeAgent)
        state.mcpMountScope = mcpMountScope
        state.mcpMountCtx = mcpMountScope.ctx
      }
      consumptionState.set(sessionId, state)
      // Alpha.5 realm + A1 realm lane. The realm installs the confined provider
      // (its own isolated scope); the lane then mounts the composition's HOST
      // native modules there and proves each declared name changed definition
      // identity. A refusal propagates out of setup untouched: a member never
      // runs on a realm whose host modules did not take effect.
      const a5sfRowConfig = a5sfRealmConfigOf(config)
      // SHAPE A (round 61). The finding: on a member scope the native `read` was served by the BASE
      // provider (zero guard consults) because only an explicitly configured native-module row
      // re-mounts the host module into the member's isolated scope. For a GOVERNED member the module
      // set is now derived from the ACTIVE preset's own rows and mounted AFTER the capability deny
      // lane (`governedDefaultRealm` is filled when the realm compiled, and the preset rows are read
      // once the preset is mounted/known). Rows without a centre never enter this path.
      let governedDefaultRealm
      let governedPresetModules
      // The mounted realm, hoisted so the POST-DENY native attach below can reach it. The attach may
      // not live inside this block: the deny lane runs later, and route-C N5 pins the order.
      let a5sfMountedRealm
      // A governed member without a realm is REFUSED, not left unmediated (round 35). The rule is narrow:
      // it fires only when the row asked for the centre (centreStatePath) and no realm was mounted, so a
      // row that never configured the centre is unchanged.
      if (sessionId !== teamRoot && !(a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined)) {
        const unwired = memberCentreUnwiredViolation(config, { instanceId, mountedRealm: false })
        if (unwired !== undefined) throw new Error(`agent-bindings: ${unwired}`)
      }
      if (a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined && sessionId !== teamRoot) {
        const a5sfRealm = await mountMemberA5sfRealm({
          root: agentCtx,
          a5sfConfig: a5sfRowConfig,
          provider: a5sfRealmProvider,
          member: {
            sessionId,
            instanceId,
            teamRootSessionId: teamRoot,
            templateId: boundTemplate?.templateId,
            bindPath,
          },
        })
        a5sfMountedRealm = a5sfRealm
        if (a5sfRealm !== undefined) {
          // SHAPE A: a compiled realm means this member is GOVERNED (a centre is installed below).
          // When the row declares no native module set, the default mount owns the confinement of
          // the preset's own native tools. A row that DOES declare a set keeps its configured mount
          // (the pre-shape-A behaviour) — the default never stacks a second mount on top.
          const compiled = compiledAnswerOfRealm(a5sfRealm)
          if (
            compiled !== undefined &&
            (a5sfRowConfig.nativeToolModules === undefined || a5sfRowConfig.nativeToolModules.length === 0)
          ) {
            governedDefaultRealm = a5sfRealm
          }
          const disposeRealm = createA5sfRealmRowDisposer(a5sfRealm, (error) => {
            observations.push(`a5sf: realm dispose failed: ${error instanceof Error ? error.message : String(error)}`)
          })
          // ONE registration. It used to be pushed here AND into toolDisposers, which started the
          // realm disposal in the tool-disposer pass - before the native-mount tombstone was awaited -
          // contradicting the ordering the comment in close() promises.
          a5sfRealmDisposers.push(disposeRealm)
          // THE DURABLE OVERLAY SUPPLIER (E3, round 49). The centre accepts an `overlayDecision` port
          // (ADM-45); the product supplies one over the SAME `permissionOverlay` the mutation lane
          // appends through. The port is synchronous, so the two async inputs (the durable row and the
          // call's canonical operation) are resolved by a `prepare` listener registered AHEAD of the
          // centre's own - never inside the port. A prepare fault is stored and surfaced by the port as
          // ADMISSION_OVERLAY_FAULT, so an unreadable overlay denies rather than disappears.
          const memberWorkspace = runtimeAgent?.session?.header?.cwd ?? config?.defaultWorkspace ?? process.cwd()
          let overlayDecision
          if (typeof permissionOverlay?.latest === 'function') {
            const overlaySupplier = createOverlayDecisionProvider({
              overlay: permissionOverlay,
              teamSessionId: teamRoot,
              memberInstanceId: instanceId,
              workspaceRoot: memberWorkspace,
              // The per-agent fs seam (host: the lazy strict `ctx.get('fs')`; a test world: its own
              // fake fs). It is the ONE canonicalization basis the operation and the overlay keys share.
              fsOf: () => (typeof fsBackend === 'function' ? fsBackend(agentCtx) : undefined),
            })
            const disposeOverlayPrepare = agentCtx.on('tools/pre-execute', async (exec, next) => {
              await overlaySupplier.prepare(exec)
              return next()
            })
            toolDisposers.push(disposeOverlayPrepare)
            overlayDecision = overlaySupplier.decide
          }
          // MEMBER EXECUTION COMPOSITION (centre + native mount + their lifecycle). The block below
          // used to live here: it is now one component with explicit inputs, so the entry assembles
          // and does not itself hold admission, facts, settlement or the mount's lifecycle.
          await installMemberExecution({
            agentCtx,
            realm: a5sfRealm,
            compiledAnswer: compiledAnswerOfRealm(a5sfRealm),
            resolveCompiledAnswer: () => compiledAnswerOfRealm(a5sfRealm),
            config,
            sessionId,
            instanceId,
            teamRoot,
            // The member's effective workspace: the same `session.header.cwd` basis the rest of this
            // glue reads, never a guess and never the host process's cwd by default.
            workspaceRoot: memberWorkspace,
            // The durable restriction consulted beside the lane verdict (can only REMOVE authority).
            ...(overlayDecision === undefined ? {} : { overlayDecision }),
            // The ask path (B): the one-shot grant binder and the durable Control approval authority,
            // supplied together or not at all.
            ...(grants === undefined ? {} : { grants }),
            ...(approvals === undefined ? {} : { approvals }),
            // The row's native modules are NOT mounted here: this composition runs BEFORE the deny
            // lane, and an own-scope registration outside `tools.restrict` must never exist before
            // it. They are attached below, after `applyBuiltInToolDeny` (route-C N5's law).
            scope: runtimeAgent ?? undefined,
            onDispose: (dispose) => toolDisposers.push(dispose),
            onNativeDispose: (entry) => nativeMountDisposers.push(entry),
            observe: (message) => observations.push(message),
          })
        }
      }
      toolDisposers.push(installModelSelection(agentCtx, ref))
      // D1 (v2 → v3): the ordinary base tools (the ordinary AgentPreset
      // substrate — file/shell) mount on the MEMBER bind paths (v2:
      // fresh-member / cold-member) AND the ROOT bind paths (v3:
      // fresh-root / cold-root), on the agent scope, IN ADDITION to the
      // ten team tools the loop below registers. The ordering mirrors the
      // upstream session-controller composition (model selection, then the
      // preset mount, then the Team's own registrations).
      //
      // v3 rationale (the V1 live matrix, plan §12.1/§12.3): the leader's
      // file lanes (allow read A executes; ask write C creates the
      // user-approval request) need the base tools on the leader agent. A
      // plugin-created root (team.create / the p6t6 worlds) otherwise
      // carries ONLY the ten team tools and every leader file op dies with
      // `unknown tool` — the user-approval lane is unreachable. The
      // production bound root (the host session's agent) already joined its
      // preset through the web setup: the already-joined guard below keeps
      // it on that composition (the roster's mount is the ONE bind and
      // refuses a second).
      //
      // config.rootPresetId / config.memberPresetId absent (undefined) =
      // the deployment DEFAULT preset: the glue passes no id and the
      // service resolves its own defaultId (the web bundle: standard)
      // — the glue never invents an id.
      //
      // FAIL CLOSED: a setup without the presets service (absent or
      // unusable) must never silently deliver a base-tool-less agent. The
      // typed rejection propagates out of the AgentSetup callback, which
      // rolls the unpublished agent back (the AgentSetup contract) — the
      // agent never runs.
      if (
        bindPath === 'fresh-member' ||
        bindPath === 'cold-member' ||
        bindPath === 'fresh-root' ||
        bindPath === 'cold-root'
      ) {
        const isRoot = bindPath === 'fresh-root' || bindPath === 'cold-root'
        const presets = agentPresets
        if (presets === undefined || presets === null || typeof presets.mount !== 'function') {
          const reason =
            'the agentPresets service is absent from the glue deps (or lacks a callable mount) — ' +
            (isRoot
              ? 'the leader (root) must never run without its ordinary base tools'
              : 'a member must never run without its ordinary base tools')
          throw isRoot
            ? rootBaseToolsUnavailable(sessionId, reason)
            : memberBaseToolsUnavailable(sessionId, reason)
        }
        // The already-joined guard (v3): an agent that already holds a
        // preset composition keeps it — the roster's mount is the ONE bind
        // and a second mount would throw (the production host-session root
        // is composed by the web setup before the team row adopts it).
        // The probe is OPTIONAL: a service without composedPreset reports
        // unjoined (the mount runs; the t12a doubles take this path). A
        // skip is an observation, never an error.
        if (typeof presets.composedPreset === 'function' && presets.composedPreset(agentCtx) !== undefined) {
          observations.push(
            `d1v3: base-tool preset mount skipped for '${sessionId}' (${bindPath}) — the agent is already joined to a preset`,
          )
        } else {
          // v3: the root mounts config.rootPresetId and the member mounts
          // config.memberPresetId — each ABSENT (undefined) selects the
          // deployment DEFAULT preset (the glue passes no id; the service
          // resolves its own defaultId, the web bundle: standard). The
          // glue never invents an id (the D1 v2 member semantics, extended
          // to the root per the ruling citing D1 v2 + plan §13-L4/§12.3).
          await presets.mount(agentCtx, isRoot ? config.rootPresetId : config.memberPresetId)
        }
        // SHAPE A: the module set is read from the preset that is ACTUALLY composed for this agent
        // (the already-joined case included). Done here, before the deny/mount below, so the
        // post-deny default mount has the product's own answer and never guesses a host package.
        if (governedDefaultRealm !== undefined) {
          governedPresetModules = await governedPresetModuleSpecifiers(presets, agentCtx, isRoot, config)
        }
      }
      // P0-3 (hardening §5): the built-in tool deny blacklist — applied
      // BEFORE the Team tool scoped registrations (the frozen ordering:
      // model selection -> agentPresets.mount -> builtinToolDeny -> Team
      // tools -> Team skills -> MCP). tools.restrict() masks the tools the
      // agent INHERITS from the parent/global scope (the preset base tools
      // mounted above); tools the agent registers in its OWN scope (the
      // team tools below) remain visible. So the deny masks the preset base
      // tools while the team tools stay independently governed by the
      // teamTools allowlist — the deny is NEVER a team-tool deny (it cannot
      // hide a team tool). Sibling-inert (agent-scoped restrict); a cold
      // resume re-applies it through this same setup. SELECTIVE mode only
      // (the field exists only there); an empty list is a no-op (zero
      // restrict calls).
      // P0-3 (hardening §5) + A5-PR1 STEP 2: the built-in tool deny blacklist —
      // applied AFTER the Guard is armed and BEFORE the Team tool scoped
      // registrations (the frozen ordering: model selection -> agentPresets.mount
      // -> [A5-PR1 Guard] -> builtinToolDeny -> Team tools -> Team skills -> MCP).
      // tools.restrict() masks the tools the agent INHERITS from the parent /
      // global scope (the preset base tools mounted above); tools the agent
      // registers in its OWN scope (the team tools below) remain visible — which
      // is precisely why a restrict() at setup cannot be the closed world
      // (design §4.1) and the Guard above is. Sibling-inert (agent-scoped
      // restrict); a cold resume re-applies it through this same setup.
      // SELECTIVE mode only; an empty list is a no-op (zero restrict calls).
      if (capabilities.mode === 'selective') {
        toolDisposers.push(applyBuiltInToolDeny(agentCtx, capabilities.builtinToolDeny))
      }
      // ROUTE C (2026-11-03, review fix) — the row's OWN native modules, attached AFTER the deny.
      //
      // F1 (review response 2026-11-03) — WHAT THE MOUNT DOES AND HOW IT IS CONSUMED. The realm mount
      // installs the confined Provider through the installer's `root.isolate('fs', …)`. Cordis
      // `isolate()` creates a SIBLING scope, so THIS agent ctx keeps the BASE provider — a fact about
      // the installer, not a bug in it. The native shadow is created by re-mounting the SAME native
      // module inside the isolated scope, which shadows the preset's descendant registration for THIS
      // agent only. An own-scope registration sits OUTSIDE the inherited `tools.restrict` filter, so
      // the shadow MUST be created after the deny lane: created first, it would survive the deny and
      // keep a denied tool visible and executable on the confined lane (measured). Only
      // deny-then-attach is safe, which is why this call sits HERE and not beside the realm mount.
      if (a5sfMountedRealm !== undefined && Array.isArray(a5sfRowConfig?.nativeToolModules) && a5sfRowConfig.nativeToolModules.length > 0) {
        await attachA5sfNativeToolModules(a5sfMountedRealm, agentCtx, a5sfRowConfig, runtimeAgent)
      }
      // SHAPE A (round 61) — THE GOVERNED MEMBER'S NATIVE TOOLS, ON ITS OWN PROVIDER, BY DEFAULT.
      //
      // ORDER IS LOAD-BEARING and this is why the mount lives HERE and not beside the realm mount:
      // an own-scope registration sits OUTSIDE the inherited `tools.restrict` filter, so a shadow
      // created BEFORE the deny lane would survive it and re-enable a denied tool. The default mount
      // therefore runs AFTER `applyBuiltInToolDeny` (the same law the route-C row documents).
      //
      // The set comes from the ACTIVE preset's rows (`governedPresetModules`); the lane proves each
      // declared name changed definition identity and that the model-visible surface is unchanged.
      // Any refusal (unimportable module, invalid module, an empty or conflicting frontier, an
      // unmountable realm) propagates: the member never runs on a realm whose native tools stayed on
      // the base provider. Ungoverned rows never reach this block (`governedDefaultRealm` is unset).
      if (governedDefaultRealm !== undefined) {
        const governedNative = await mountGovernedNativeToolModules({
          governed: true,
          realm: governedDefaultRealm,
          root: agentCtx,
          scope: runtimeAgent,
          presetModules: governedPresetModules ?? [],
        })
        if (governedNative !== undefined) {
          observations.push(
            `a5sf: governed native default mount on '${sessionId}' (${governedNative.modules.join(', ')})`
            + (governedNative.skipped.length === 0
              ? ''
              : `; skipped ${governedNative.skipped.map((entry) => `${entry.url} (${entry.reason})`).join('; ')}`),
          )
          nativeMountDisposers.push({ settled: () => governedNative.dispose() })
        }
      }
      // The host fills teamToolsRef.current AFTER root assembly; the setup
      // callback reads it when it runs — never before. Absent -> the
      // registration loop is skipped, as before.
      const teamTools = teamToolsRef.current
      // A2C-2 (plan §7.3-B): the EXACTLY selected+registered Team tool
      // names — the OTHER_MANAGED_TEAM_TOOL ownership fact for the
      // Coverage Gate (the `teamTools` capability + the Team runtime are
      // the authority owner). Empty on every legacy / alpha.1 setup.
      if (teamTools) {
        // alpha.1 (plan §10.5): the team tool selector — SELECTIVE mode
        // registers only the catalog tools the template's teamTools entry
        // allows (allow(items) = name membership, catalog order, dedup;
        // deny = zero team tools; unknown items never materialize).
        // LEGACY mode = the full catalog (the 0.1.0-rc.1 behavior).
        const catalog = Array.isArray(teamTools.tools) ? teamTools.tools : []
        const selected =
          capabilities.mode === 'selective' ? selectTeamTools(catalog, capabilities.teamTools) : [...catalog]
        for (const def of selected) {
          // F1: the Team tools are part of the Member's tool plane -> the
          // realm's isolated ctx (identical scope layer + disposer fiber for
          // every non-a5sf row, where toolPlaneCtx === agentCtx).
          toolDisposers.push(agentCtx.tools.register(def))
        }
      }
      // alpha.1 (plan §10.7): the Team-managed skills — the catalog
      // definitions the template's skills entry allows, registered in
      // this agent's scope (allow(items) = catalog lookup; deny = none;
      // unknown ids skip + diagnose, never crash the agent; no skills
      // seam on the ctx = the no-op disposer, legacy behavior).
      if (capabilities.mode === 'selective') {
        const skillDisposer = registerTeamSkills(agentCtx, teamSkillCatalog, capabilities.skills, {
          onSkip: (skillId, reason) => {
            observations.push(`alpha1: team skill '${skillId}' skipped (${reason})`)
          },
        })
        toolDisposers.push(skillDisposer)
      }
      // T12-M2: the persona boundary — the blueprint persona enters the REAL
      // DSH Agent prompt here (the agent-scoped 'deployment:persona'
      // section), after the tools and before the mcp mount: before ANY work
      // can run on this session. The reused resolver evaluates the preset
      // substrate first (complete -> FATAL, thrown before any install).
      // pre-alpha3 W2-A (review fix F4, guide §5 B): the production path
      // RESOLVES the real observed substrate first (the await) — an
      // `unresolved` substrate throws BEFORE any install (fail closed), and
      // the await keeps the install strictly before any work (the slot's
      // apply + the pending flush below both run after it).
      await installPersonaForSetup(sessionId, instanceId, templateIdHint, bindPath, teamRootSid)
      // A pre-setup personaSurface.installScopedPersona for this session
      // (the pending window) flushes here too — still before any work.
      const pendingIdentity = personaPending.get(sessionId)
      if (pendingIdentity !== undefined) {
        personaPending.delete(sessionId)
        registerPersonaSection(sessionId, agentCtx, pendingIdentity)
      }
      // The mcp facet's fail-closed baseline: no durable allow -> no mount.
      // At a fresh create no overrides exist yet (unspecified), so this is
      // the resume/restart path that re-applies the durable truth on boot.
      // alpha.1 (plan §10.8): the template's static mcp entry ADDITIONALLY
      // filters the configured servers (selective mode: allow must name a
      // configured server, deny = no mount — the T3 filter over the row's
      // configured server set, no second MCP resolver). LEGACY mode = the
      // durable decision alone (the 0.1.0-rc.1 behavior).
      // multi-mcp (contract I4 §2.3): the generalization is PER SERVER —
      // a server is in the mount target iff BOTH its template entry AND
      // its durable cell allow it (the per-server AND of the old
      // `mcpMountAllowed` boolean; filterMcpServers / the durable facet
      // resolver are the unchanged C3/C4 authorities). ONE reconcile
      // below covers the whole target set — and it stays BETWEEN the
      // pre-MCP snapshot and the coverage FINAL snapshot (A2C-2 §7.3-C:
      // the delta across this single reconcile is the proven MCP
      // ownership for ALL mounted servers at once).
      const configuredMcpNames = configuredMcpServers(config).map((s) => s.name)
      const mcpTemplateAllowedNames =
        capabilities.mode === 'selective'
          ? filterMcpServers(configuredMcpNames, capabilities.mcp)
          : [...configuredMcpNames]
      const mcpMountTarget = mcpTemplateAllowedNames.filter((name) => mcpViews[name]?.allowed === true)
      if (mcpMountTarget.length > 0) {
        await reconcileMcpSet(state, mcpMountTarget)
      }
      applyBoundaryRecords(state, modelView, mcpViews)
    }
  }

  // ── T12-M2: the persona boundary (the reused resolver + the REAL layer) ──
  //
  // The persona resolver (agent-setup/persona, READ-ONLY) is the S5A-frozen
  // authority: preset substrate fact + blueprint persona fields -> the scoped
  // identity (PASS) or a FATAL TeamPersonaOverlayError (a complete preset is
  // never downgraded — thrown before any install, so no Team work starts).
  // This glue provides the LAST layer the resolver installs onto: the real
  // DSH Agent prompt surface — the agent-scoped 'deployment:persona'
  // system-prompt section on the session's live agent ctx (ctx.systemPrompt
  // is the public DSH builtin the agent loop always injects). Restore disposes
  // exactly that scoped entry; the global prompt layer is never touched.
  const personaSubstrate = () => {
    // config.presetSubstrate is the OPTIONAL additive override the production
    // root can pass (absent today) — the S5A A11 decision for the
    // dsh-agent-team preset: a standard (non-complete) substrate.
    return config.presetSubstrate ?? { presetId: 'dsh-agent-team', personaKind: 'standard' }
  }

  /**
   * Register (or re-register) the agent-scoped 'deployment:persona' section
   * on one agent ctx — the real DSH prompt-surface installation. An empty
   * persona text is a no-op (nothing to scope); a ctx without the
   * systemPrompt builtin fails loud (the pinned DSH agent ctx ALWAYS has it —
   * a missing seam is a broken host, never a silent skip). Re-installing
   * disposes the previous scoped entry for the same session first, so
   * repeated installs converge to exactly one scoped section (a later
   * delegation by the production root cannot double-register).
   */
  function registerPersonaSection(sessionId, agentCtx, identity) {
    const text = String(identity.personaText ?? '')
    const previous = personaDisposers.get(sessionId)
    if (previous !== undefined) {
      personaDisposers.delete(sessionId)
      try { previous() } catch { /* the scope unwind covers it */ }
    }
    if (text === '') return
    const systemPrompt = agentCtx.systemPrompt
    if (systemPrompt === undefined || typeof systemPrompt !== 'object' || typeof systemPrompt.section !== 'function') {
      throw new Error(`agent-bindings: persona install for '${sessionId}': the agent ctx has no systemPrompt.section seam (broken host — the pinned DSH agent ctx always has it)`)
    }
    const dispose = systemPrompt.section({
      name: 'deployment:persona',
      order: 0,
      text,
    })
    personaDisposers.set(sessionId, () => {
      try { dispose() } catch { /* the scope unwind covers it */ }
    })
  }

  const personaSurface = {
    /**
     * The production-facing install seam (the slot the production root's
     * binder currently fills through its own in-memory map): register one
     * composed identity on the session's live agent ctx. When the session's
     * agent ctx is not captured yet (the pre-setup window), the identity is
     * queued and flushed by the shared setup the moment it runs — the install
     * still precedes any work on the session.
     */
    installScopedPersona(sessionId, identity) {
      const key = String(sessionId)
      const agentCtx = liveAgentCtxs.get(key)
      if (agentCtx === undefined) {
        personaPending.set(key, identity)
        return
      }
      registerPersonaSection(key, agentCtx, identity)
    },
    /**
     * Remove exactly the agent-scoped 'deployment:persona' entry for one
     * session — the global prompt layer (the harness:identity + the global
     * deployment:persona sections the DSH service registered) is never
     * touched. Idempotent: restoring an already-restored session is a no-op.
     */
    restoreScopedPersona(sessionId) {
      const key = String(sessionId)
      const dispose = personaDisposers.get(key)
      if (dispose === undefined) return
      personaDisposers.delete(key)
      try {
        dispose()
      } catch (error) {
        observations.push(`p6t6: persona restore for '${key}' failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
  }

  /**
   * The lazy persona overlay slot — built once, on first use, over the
   * per-root bound-blueprint resolution (BP-F, issue #2 blueprint-loading,
   * plan §11.2: the persona source reads the OWNING team root's
   * bound blueprint per call) and the preset substrate fact. Its apply() IS the reused persona
   * resolver: it evaluates the requirement against the substrate (complete ->
   * FATAL TeamPersonaOverlayError BEFORE any install), composes the scoped
   * identity from the blueprint persona fields (member: the template persona
   * — the templateId is REQUIRED, absent -> the resolver's loud TypeError),
   * and installs it through the prompt surface below.
   */
  // Build ONE persona overlay slot over the given preset seam. The
  // personaSource / promptSurface are SHARED by every slot of this row
  // (BP-F / TCM-D4 / D3 semantics are identical on the legacy and the
  // production path — only the seam's substrate fact differs).
  function buildPersonaSlot(presetSeam) {
    return createPersonaOverlaySlot({
      presetSeam,
      personaSource: {
        // BP-F (issue #2 blueprint-loading, plan §11.2): the persona source
        // resolves the OWNING team root's bound blueprint per call (the
        // adapter passes the target's rootSessionId for BOTH kinds) — a
        // root's persona is never the row-global anchor's once the
        // production host injects the per-root resolver. A root with NO
        // bound blueprint fails closed (loud error — installPersonaForSetup
        // already skips the empty-anchor world, so a null here means a
        // broken chain, never a persona-less agent).
        getLeaderPersona: (rootSessionId) => {
          const bp = getBoundBlueprint(String(rootSessionId))
          if (bp === null) {
            throw new Error(`agent-bindings: persona overlay: team root '${rootSessionId}' has no bound blueprint (fail closed)`)
          }
          return String(bp.leader.persona ?? '')
        },
        getMemberPersona: (rootSessionId, templateId) => {
          const bp = getBoundBlueprint(String(rootSessionId))
          if (bp === null) {
            throw new Error(`agent-bindings: persona overlay: team root '${rootSessionId}' has no bound blueprint (fail closed)`)
          }
          const member = bp.members.find((entry) => entry.templateId === String(templateId))
          if (member === undefined) {
            throw new Error(`agent-bindings: persona overlay: template '${templateId}' is not a member template of the team blueprint`)
          }
          return String(member.persona ?? '')
        },
      },
      promptSurface: {
        // The REAL installation: the agent-scoped section on the session's
        // live agent ctx (captured by the shared setup — the slot only ever
        // applies from inside a setup).
        installScopedPersona: (sessionId, identity) => {
          const agentCtx = liveAgentCtxs.get(String(sessionId))
          if (agentCtx === undefined) {
            throw new Error(`agent-bindings: persona overlay install for '${sessionId}': no live agent ctx (the overlay slot only installs at setup time)`)
          }
          // TCM-D4: the ROOT agent's scoped persona section ALSO carries
          // the concise machine-readable root Team context — the canonical
          // rootSessionId, the leader instanceId, and the team_* call
          // contract (every call includes rootSessionId + a requestToken) —
          // the three facts the model needs to address this team. It is
          // appended to the SAME single scoped section the blueprint
          // persona composed (the blueprint text stays verbatim ahead of
          // the block; the re-registration below converges to exactly one
          // entry). D3 (B2): the MEMBER branch appends the analogous
          // machine-readable member identity block (below).
          const sid = String(sessionId)
          if (identity.kind === 'root') {
            const base = String(identity.personaText ?? '')
            const combined = base === '' ? rootTeamContextBlock(sid) : `${base}\n\n${rootTeamContextBlock(sid)}`
            registerPersonaSection(sid, agentCtx, { ...identity, personaText: combined })
            return
          }
          // D3 (Team D1-D6 repair v2, B2): the MEMBER branch appends the
          // concise machine-readable Team identity context — the OWNING
          // durable root (identity.rootSessionId — NEVER the child session
          // id `sid`, which would silently break cross-root members) and
          // the member's own instanceId (both durable facts resolved by
          // installPersonaForSetup under the owning root: the committed
          // MemberInstance row, or the fresh-create instanceIdHint bridging
          // the pre-commit window) — to the SAME single scoped section the
          // blueprint persona composed (the blueprint text stays verbatim
          // ahead of the block; the spread copy keeps the frozen identity
          // intact; the re-registration converges to exactly one entry, as
          // for the root branch). The block is identical on fresh create
          // and cold resume (both flow through this one install seam).
          const memberBase = String(identity.personaText ?? '')
          const memberBlock = memberTeamContextBlock(String(identity.rootSessionId), String(identity.instanceId))
          registerPersonaSection(sid, agentCtx, {
            ...identity,
            personaText: memberBase === '' ? memberBlock : `${memberBase}\n\n${memberBlock}`,
          })
        },
      },
    })
  }

  function getPersonaSlot() {
    if (personaSlot !== undefined) return personaSlot
    const substrate = personaSubstrate()
    // The LEGACY (factory / test-world) path: config.presetSubstrate ?? the
    // S5A A11 standard substrate — zero behavior change. The seam is keyed
    // by the root session id ONLY (Architecture §13.1 — members inherit the
    // root substrate); one substrate for the team.
    personaSlot = buildPersonaSlot({
      getSubstrate: () => ({ presetId: substrate.presetId, personaKind: substrate.personaKind }),
    })
    return personaSlot
  }

  // pre-alpha3 W2-A (review fix F4, guide §5 B): the PRODUCTION persona
  // substrate — the REAL observed effective composition, resolved per
  // OWNING root on first bind and cached ONLY on success:
  //   - `unresolved` -> a typed throw (the bind fails closed — the setup
  //     rejection rolls the unpublished agent back; the slot is NOT
  //     cached, so a later bind RE-PROBES — never a shipped-state 'standard'
  //     guess, guide §5 B "不能继续 shipped-state guess");
  //   - a settled observation (standard / complete / absent) -> the slot is
  //     built over that substrate and cached for the root (complete still
  //     hits the adapter's §13.5 FATAL at apply — the conflict is caught
  //     before any work, as before).
  // The in-flight map dedupes concurrent first binds of the same root (the
  // setup callback is async; two agents of one root may race the first
  // observation).
  const productionPersonaSlots = new Map()
  const productionPersonaInflight = new Map()
  async function getProductionPersonaSlot(rootSessionId) {
    const key = String(rootSessionId)
    const cached = productionPersonaSlots.get(key)
    if (cached !== undefined) return cached
    const pending = productionPersonaInflight.get(key)
    if (pending !== undefined) return pending
    const build = (async () => {
      const substrate = await resolvePersonaSubstrate(key)
      if (substrate === undefined || substrate === null || typeof substrate !== 'object') {
        throw new Error(`agent-bindings: persona substrate for root '${key}': the resolver returned no substrate record (fail closed)`)
      }
      if (typeof substrate.presetId !== 'string' || substrate.presetId === '') {
        throw new Error(`agent-bindings: persona substrate for root '${key}': the resolver returned no presetId (fail closed)`)
      }
      if (substrate.personaKind === 'unresolved') {
        throw new Error(`agent-bindings: persona substrate for root '${key}' is UNRESOLVED (${substrate.reason !== undefined && substrate.reason !== '' ? String(substrate.reason) : 'the effective composition could not be observed'}) — the bind fails closed (a later bind re-probes; never a shipped-state guess)`)
      }
      const slot = buildPersonaSlot({
        // The seam is keyed by the root session id ONLY (Architecture
        // §13.1 — members inherit the root substrate); one observed
        // substrate for the team.
        getSubstrate: () => ({ presetId: substrate.presetId, personaKind: substrate.personaKind }),
      })
      productionPersonaSlots.set(key, slot)
      return slot
    })()
    productionPersonaInflight.set(key, build)
    try {
      return await build
    } finally {
      productionPersonaInflight.delete(key)
    }
  }

  /**
   * TCM-D4: the concise machine-readable root Team context appended to the
   * ROOT agent's scoped persona section: the canonical rootSessionId, the
   * leader instanceId, and the contract that every team_* call must carry
   * rootSessionId + a requestToken (the closed tool layer rejects a
   * missing rootSessionId / requestToken as bad arguments, and a caller
   * the map cannot resolve as TEAM_TOOL_CALLER_UNRESOLVED — the two
   * failures a root agent cannot self-correct without these facts).
   * @param {string} rootSessionId
   * @returns {string} the two-line context block
   */
  function rootTeamContextBlock(rootSessionId) {
    return (
      `[team-root-context rootSessionId=${rootSessionId} ` +
      `leaderInstanceId=${String(LEADER_INSTANCE_ID)}]\n` +
      `Every team_* tool call must include rootSessionId="${rootSessionId}" ` +
      `and a unique requestToken.`
    )
  }

  /**
   * D3 (Team D1-D6 repair v2, B2): the concise machine-readable Team
   * identity context appended to the MEMBER agent's scoped persona
   * section: the canonical OWNING rootSessionId (identity.rootSessionId —
   * the root the durable MemberInstance row / fresh-create request was
   * committed under, never the child session id), the member's own
   * instanceId, the member role, and the contract that every team_* call
   * must carry that rootSessionId + a FRESH UNIQUE requestToken (the
   * closed tool layer rejects a missing rootSessionId / requestToken as
   * bad arguments, an unknown root as TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND,
   * and a root the caller does not belong to as TEAM_RUNTIME_CALLER_NOT_
   * FOUND — the member needs these facts to address its own team).
   * @param {string} rootSessionId the OWNING team root
   * @param {string} instanceId the member's own instance id
   * @returns {string} the two-line context block
   */
  function memberTeamContextBlock(rootSessionId, instanceId) {
    return (
      `[team-member-context rootSessionId="${rootSessionId}" ` +
      `instanceId="${instanceId}" role="member"]\n` +
      `Every team_* tool call must include rootSessionId="${rootSessionId}" ` +
      `and a fresh unique requestToken; do not use another team's ` +
      `rootSessionId or another member's instanceId.`
    )
  }

  /**
   * The setup-time persona install for one session (agentSetup calls it AFTER
   * the team tools are registered and BEFORE the mcp reconcile — the persona
   * must be in the prompt before any work on the session):
   *  - an empty blueprintSource with NO resolver injected (the factory world)
   *    -> no persona authority exists, skip. A2 (RC2 repair, plan §5.3): in
   *    PRODUCTION the resolver IS injected and the bound snapshot is the
   *    persona authority — an empty row anchor never skips the install; a
   *    root without a durable TeamSession row fails closed through the
   *    resolver's typed throw (the setup rejection rolls the unpublished
   *    agent back), never a silent persona-less agent;
   *  - the root: the substrate target is the root identity; the durable
   *    teamSessions row (when the repository carries it) is the step record;
   *  - a member: the MemberInstance row looked up by childSessionId is the
   *    step record; in the fresh-create window the row is not committed yet,
   *    so the templateIdHint the child factory carries (exactly the value the
   *    flow commits moments later) stands in for the row — a member with
   *    neither a row nor a hint fails closed with a loud error (no silent
   *    persona-less member).
   */
  async function installPersonaForSetup(sessionId, instanceId, templateIdHint, bindPath, teamRootSid) {
    // A2 (RC2 repair, plan §5.3): the row-config skip is FACTORY-WORLD ONLY
    // (no resolver injected — there the empty anchor means no persona
    // authority at all). With the resolver injected (the production host
    // ALWAYS passes one) the bound snapshot is the authority: proceed to
    // slot.apply and let a missing row / unresolvable snapshot fail closed
    // through the resolver's typed throw — NEVER a silent skip, never a
    // row-anchor fallback.
    if (resolveBoundBlueprint === undefined && String(config.blueprintSource ?? '') === '') return
    // T12-GLUE: the session may be the root of its OWN team in this row's
    // domain (the handoff target) — it then embodies that team's leader
    // instance, exactly as the boot root does.
    const teamRoot = teamRootSid !== undefined
      ? String(teamRootSid)
      : (sessionId === rootSid ? rootSid : undefined)
    // pre-alpha3 W2-A (review fix F4, guide §5 B): the PRODUCTION host
    // injects resolvePersonaSubstrate — the persona substrate is the REAL
    // observed effective composition of the OWNING root (resolved once per
    // root, fail closed on `unresolved` — the setup rejection rolls the
    // unpublished agent back, and a later bind re-probes). A factory /
    // test world (dep absent) keeps the LEGACY seam (config.presetSubstrate
    // ?? the S5A 'standard' default) — zero behavior change.
    const slot =
      resolvePersonaSubstrate !== undefined && teamRoot !== undefined
        ? await getProductionPersonaSlot(teamRoot)
        : getPersonaSlot()
    let target
    let record
    if (teamRoot !== undefined && teamRoot === sessionId) {
      const row =
        domain.repositories.teamSessions !== undefined ? domain.repositories.teamSessions.get(teamRoot) : undefined
      target = { kind: 'root', sessionId: teamRoot, rootSessionId: teamRoot, instanceId: LEADER_INSTANCE_ID }
      record = row ?? {}
    } else {
      // TCM-D4: a member resolves its persona under the ROOT THAT OWNS IT
      // (the threaded owning root when present — a member of a non-boot
      // team root — the boot root when absent, as before).
      const membersRoot = teamRoot !== undefined ? teamRoot : rootSid
      const members = domain.repositories.memberInstances.list(membersRoot)
      const row = members.find((member) => String(member.childSessionId) === sessionId)
      if (row !== undefined) {
        target = { kind: 'member', sessionId, rootSessionId: membersRoot, instanceId: String(row.instanceId) }
        record = row
      } else if (freshCreateHintAdmits(bindPath) && templateIdHint !== undefined && templateIdHint !== '') {
        // The fresh-create window ONLY (the SAME gate locateTemplate applies):
        // the row commits AFTER this setup runs. On any other path the durable
        // row is the authority — a missing one fails closed here too, rather
        // than fabricating a persona from a hint a cold/state path also
        // carries (WINDOW-HUNT 2026-11-12: this arm used to accept the hint
        // ungated; the earlier locate made it unreachable, which is ordering,
        // not an invariant).
        target = { kind: 'member', sessionId, rootSessionId: membersRoot, instanceId }
        record = { childSessionId: sessionId, instanceId, templateId: templateIdHint }
      } else {
        throw new Error(`agent-bindings: persona install for member '${sessionId}': no committed MemberInstance row and no templateId hint (fail closed — no silent persona-less member)`)
      }
    }
    slot.apply({ target, record, path: bindPath })
  }

  /**
   * The live-agent-or-resume resolver for one session id (a not-live-but-
   * durable session is resumed first; a session that is neither live nor
   * durable has no agent to run on).
   *
   * C1 (restart-recovery, guide §7): the restart-safe algorithm —
   *   1. close gate; existing live handle returned;
   *   2. a DECLARED foreign rollback of this session (the fence's exact-
   *      generation barrier) must converge BEFORE the resume;
   *   3. an upstream registry Agent with no Team handle = explicit
   *      ordinary-mode or genuine foreign owner — fail closed as
   *      OUTSIDE_TEAM (the stable message the S6 mapper keys on);
   *   4. durable existence via the PUBLIC seam (guide §5.2);
   *   5. the owning Team root (guide §3.2 — fail closed when unowned);
   *   6. the guarded resume (guide §6.1) with the SINGLE bounded
   *      writer-conflict recovery (guide §7.2): a writer-held conflict
   *      retries EXACTLY ONCE, and only after the fence confirms the
   *      conflicting activation was a Team-managed foreign activation
   *      it intercepted AND the exact foreign generation is disposed.
   *      No while-retry, no sleep, no backoff, no lock deletion.
   * @param {string} sessionId
   * @returns {Promise<object>} the AgentHandle.
   */
  async function ensureLiveAgent(sessionId) {
    const sid = String(sessionId)
    // close lifecycle gate (entry): once close() has announced, no new
    // live handle may be created/resumed (a completion settling during
    // teardown must fail, not resurrect an agent behind the close).
    if (closing) {
      throw new Error(`agent-bindings: live bindings are closing — no new live handle for session '${sid}'`)
    }
    // ADMISSION CLOSE (row 6, the archive/dispose in-process half): while a
    // lifecycle quiesce is closing this member, NO dispatch may be admitted —
    // not even one that would hit the `liveAgents` fast path below. The durable
    // row still reads SETTLED inside the drop→commit window, so the durable
    // gate alone cannot refuse here (see the admission close in session-identity).
    const admissionRefusal = admissionCloseRefusal(sid)
    if (admissionRefusal !== null) throw admissionRefusal
    const existing = liveAgents.get(sid)
    if (existing !== undefined) return existing
    // S1 (supplement guide §2.2-B, verbatim target shape): the WHOLE
    // ensureLiveAgent body is per-SID single-flighted (the HIGH-level
    // coordinator) — the second concurrent caller of the same SID never
    // re-enters the pre-resume flow; it awaits the first caller's
    // promise (INV-2: "其余调用必须 await 同一个 Promise，而不是各自
    // 进入 ctx.agents.resume()" — test G7). The low-level coordinator
    // in runOwnedActivation additionally guarantees that this path's
    // resume cannot run concurrently with ANY other entry's (boot /
    // childFactory / createRootAgent) create/resume of the same SID.
    return await singleFlightTeamActivation(
      ensureLiveAgentInFlight,
      sid,
      () => ensureLiveAgentOnce(sid),
    )
  }

  /**
   * The single-flight BODY of ensureLiveAgent (S1, supplement guide
   * §2.2-B). Runs exactly once per in-flight wave of concurrent
   * same-SID callers; see the numbered steps in the wrapper's doc.
   * @param {string} sid
   * @returns {Promise<object>} the AgentHandle.
   */
  async function ensureLiveAgentOnce(sid) {
    // S1 (guide §2.2-B double-check): the first caller may have already
    // finished and populated liveAgents while this caller was queued
    // behind its single-flight promise — return the surviving handle
    // without re-entering the flow.
    const existing = liveAgents.get(sid)
    if (existing !== undefined) return existing
    // C1 (guide §7): a declared foreign rollback of this session must
    // converge first (the ordinary-promotion rollback is about to release
    // the session writer — resuming before it settles would re-hit the
    // writer conflict we are trying to avoid).
    if (activationFence !== undefined && typeof activationFence.awaitRollback === 'function') {
      await activationFence.awaitRollback(sid)
    }
    // C1 (guide §7/§8): if the upstream registry already holds a live
    // Agent for this session but the Team has no handle, this is an
    // explicit ordinary-mode owner or a genuine foreign live owner —
    // fail closed. NEVER adopt or forge a handle for a foreign live
    // Agent (INV-B): the stable message below is the S6 mapper's key for
    // the existing OUTSIDE_TEAM diagnostic (guide §11).
    const foreignLive = typeof agents.get === 'function' ? agents.get(SessionId(sid)) : undefined
    if (foreignLive !== undefined && !liveAgents.has(sid)) {
      throw new Error(`agent "${sid}" is already registered outside the Team glue`)
    }
    // C1 (guide §5.2): the cold-resume eligibility is the durable
    // existence through the PUBLIC session-persistence seam (never a
    // physical layout probe — the probe is deleted with this algorithm).
    if (!(await durableSessionExists(sid))) {
      throw new Error(`p6t6: session '${sid}' is neither live nor durable — no agent to execute a tool on`)
    }
    // TCM-D4 + C1 (guide §3.2): the cold resume re-applies the durable
    // truth under the session's OWNING root (a team root of this row's
    // domain re-attaches under ITSELF — the same identity the create
    // path installed; a member child under its root). The boot root is
    // only the default for sessions that belong to it, never a fallback
    // — an unowned session has no Team agent to resume (fail closed;
    // the pre-C1 code silently attached it as a member of undefined,
    // which the setup would have failed on anyway).
    const teamRoot = teamRootOfSession(sid)
    if (teamRoot === undefined) {
      throw new Error(`agent-bindings: session '${sid}' has no owning Team root — no Team agent to resume`)
    }
    // SEAM 1 of 2 — the DURABLE LIFECYCLE GATE (row 6): an ARCHIVED /
    // DISPOSED Member is inert until an explicit restore returns it to
    // SETTLED. Refuse here, BEFORE the resume closure is even built: the
    // archived session must not be re-materialized and its tools must not be
    // re-mounted (the typed code is the product vocabulary; `executeTool`
    // re-labels it NO_LIVE_AGENT at the route, the message keeps the cause).
    const refusal = memberResumeRefusal(sid, teamRoot)
    if (refusal !== null) throw refusal
    const resume = () =>
      resumeTeamAgent({
        sessionId: sid,
        setup: agentSetup(
          sid,
          undefined,
          undefined,
          teamRoot === sid ? 'cold-root' : 'cold-member',
          teamRoot,
        ),
      })
    // S1 (supplement guide §2.2-D, INV-5): the rollback EPOCH BASELINE,
    // snapshotted BEFORE the first resume — the recovery wait then
    // proves the handoff is FRESH for this attempt (`completedEpoch >
    // afterEpoch`), and a rollback that COMPLETED between the veto and
    // this catch still unlocks (the tombstone outlives the record
    // deletion — the TOCTOU fix, test A13/G10). A stale completed epoch
    // from BEFORE this attempt can never unlock a new conflict
    // (test A14). Fence API absent (test/factory world) → baseline 0
    // (the recovery is skipped below anyway — pre-C1 behavior).
    const rollbackBaseline =
      activationFence !== undefined && typeof activationFence.getRollbackEpoch === 'function'
        ? activationFence.getRollbackEpoch(sid)
        : 0
    resumingSessions.add(sid)
    try {
      let handle
      try {
        handle = await resume()
      } catch (error) {
        // C1 (guide §7.1/§7.2): the writer-held recovery — the ONE
        // permitted retry path. A writer-held conflict (the TYPED
        // SessionAlreadyOwnedError / session-writer-held code — guide
        // §7.1's priority, never a message-substring-only match) is
        // recoverable ONLY when the fence confirms the conflicting
        // activation was a Team-managed foreign activation it
        // intercepted AND the exact foreign generation is disposed
        // (the writer released). Any other outcome — no fence, no
        // qualifying rollback after the baseline, deadline, a
        // non-Team writer — propagates the ORIGINAL error: NO retry,
        // no while-retry, no sleep, no backoff, no lock deletion.
        if (!isSessionWriterHeld(error)) throw error
        const recoverable =
          activationFence !== undefined && typeof activationFence.recoverWriterConflict === 'function'
            ? await activationFence.recoverWriterConflict(sid, {
              afterEpoch: rollbackBaseline,
              // S1 (supplement INV-6): ONE absolute deadline — computed
              // NOW (the moment the conflict is observed), both of the
              // fence's stages consume only the remaining budget; the
              // wait can never stretch to two full windows (test A15).
              deadlineMs: Date.now() + WRITER_HANDOFF_TIMEOUT_MS,
            })
            : false
        if (recoverable !== true) throw error
        // the exact foreign generation must complete disposed / rollback
        // before the single retry (the same barrier as step 2 — a
        // defensive re-await; a settled barrier returns immediately).
        await activationFence.awaitRollback(sid)
        // EXACTLY ONE retry.
        handle = await resume()
      }
      // close lifecycle gate (post-resume re-check): close() may have
      // started while the resume was in flight. A late-resumed handle
      // must NEVER join liveAgents — it would outlive the close
      // snapshot (the row-stop backstop has already passed). Dispose it
      // best-effort and fail; the durable session stays on disk either
      // way (the resume is a cold attach, not a migration).
      if (closing) {
        try {
          await handle.dispose()
        } catch (error) {
          observations.push(
            `agent-bindings: resumed agent dispose failed during close for '${sid}': ${error instanceof Error ? error.message : String(error)}`,
          )
        }
        throw new Error(`agent-bindings: live bindings began closing while resuming agent for session '${sid}'`)
      }
      // SEAM 3 — the POST-RESUME DURABLE RE-READ (row 6, the archive race).
      // SEAM 1 read the row BEFORE the resume and saw SETTLED; the archive's
      // durable commit can land while the resume is in flight (its quiesce
      // dropped residency first, so nothing refused this resume). A handle
      // that joins `liveAgents` here would then be served by the fast path in
      // `ensureLiveAgent` forever after, without the gate ever being consulted
      // again — the measured defect. Dispose the just-resumed handle and throw
      // the same typed refusal.
      //
      // NO await between this read and `liveAgents.set` below: JS runs this
      // block to completion, so a commit cannot land between them. A commit
      // that lands AFTER the set is covered by the archive's own post-commit
      // residency re-drop (`archive.ts` / `dispose.ts`); the two halves meet
      // with no interval.
      const lateRefusal = memberResumeRefusal(sid, teamRoot)
      if (lateRefusal !== null) {
        try {
          await handle.dispose()
        } catch (error) {
          observations.push(
            `agent-bindings: resumed agent dispose failed after a durable lifecycle refusal for '${sid}': ${error instanceof Error ? error.message : String(error)}`,
          )
        }
        throw lateRefusal
      }
      liveAgents.set(sid, handle)
      return handle
    } finally {
      resumingSessions.delete(sid)
    }
  }

  /**
   * The requirement-aware FINAL-INPUT VERDICT of one session's FINAL
   * applicable mcp materialization truth (Finding F residual round — the
   * unified verdict that REPLACES the residual-1 attempt-clock-delta
   * judgment): the per-server slots read AFTER the full
   * ensure/resume/prepare sequence (the class-1 gap: the cold-resume
   * setup reconcile stamps the remount failure, the prepare's cooldown
   * SKIP leaves the attempt clock untouched, and a timestamp delta is
   * BLIND to the failure — the delivery then ran on the failed truth).
   * The target's scope set: the TEAM scope + the TARGET template scope —
   * the target template is the bound blueprint's ACTUAL leader template
   * id for the ROOT session (a legal blueprint slug, NOT a literal —
   * the consolidated-revision P1 fix: a legal blueprint may name the
   * leader template anything, and the admission gate keys on the same
   * `blueprint.leader.templateId`) and the member's durable row
   * template for a member session. Classification of each failed
   * APPLICABLE (target-set, policy-allowed) server is PER-SCOPE-
   * OCCURRENCE (the consolidated-revision P2b fix — a requirement
   * occurrence is a (scopeKey, subject) pair; the scope keys are the
   * canonical `'team'` / `template:<templateId>` strings the recovery
   * marker carries):
   *   - DEGRADED when the bound blueprint carries NO required
   *     occurrence for it (no in-scope `mcpServer` + `complete: true`
   *     naming — the engine's WARNING / empty-scope shape: it degrades,
   *     never blocks — the L4a/L4b anti-over-block shapes);
   *   - EXEMPT when the request carries the human-reviewed `recovery`
   *     marker and EVERY required occurrence of it is covered — the
   *     marker names BOTH the occurrence's scope (in `scopeKeys`) AND
   *     its subject (in `unavailableSubjects`) — (the reviewed re-run:
   *     the reviewed scope is allowed even while the remount keeps
   *     failing — the L4c anti-over-block shape); a marker covering
   *     only ONE of the scopes in which the subject is required does
   *     NOT exempt the other scope's occurrence;
   *   - BLOCKED otherwise (at least one required occurrence in the
   *     target's scopes — the SAME extraction the admission gate
   *     consumes — is not covered): the required materialization must
   *     succeed BEFORE actual input (the bootstrap contract's second
   *     half: BEFORE ACTUAL INPUT = the materialization SUCCESS is
   *     verified).
   * NEVER a blanket throw at prepare: the mount attempt itself stays
   * ALLOWED (the bootstrap contract's first half: PENDING = the mount
   * attempt is admissible — a fresh member that never mounted is
   * admissible, never a blanket block).
   * @param {object} state - the session's consumption state (the FINAL slots).
   * @param {string} sessionId
   * @param {string|undefined} teamRootSid
   * @param {string[]} target - the applicable (target-set, policy-allowed) names.
   * @param {{scopeKeys?: readonly string[], unavailableSubjects?: readonly string[]}|undefined} recovery
   *   - the human-reviewed recovery marker (the router's recovery
   *   dispatch — NEVER caller-forged; absent = no exemption).
   * @returns {{blocked: boolean, failedServers: string[], blockedServers: string[], degradedServers: string[], recoveryCoveredServers: string[]}}
   *   the verdict: `blocked` = at least one failed required server NOT
   *   covered by the reviewed scope.
   */
  function finalInputVerdictOf(state, sessionId, teamRootSid, target, recovery) {
    const slots = state.mcpMaterialization
    const failedServers = target.filter((name) => {
      const slot = slots?.get(name)
      return slot !== undefined && slot.status === 'failed'
    })
    if (failedServers.length === 0) {
      return { blocked: false, failedServers: [], blockedServers: [], degradedServers: [], recoveryCoveredServers: [] }
    }
    // The bound blueprint (the SAME extraction the admission gate uses —
    // no second copy of semantics). Read FIRST: the root's target
    // template below is the bound blueprint's ACTUAL leader slug.
    const rootSid = teamRootSid !== undefined ? String(teamRootSid) : undefined
    const blueprint = getBoundBlueprint(rootSid ?? String(sessionId))
    // The target template: the ROOT session IS the leader — the bound
    // blueprint's ACTUAL leader template id (a legal blueprint slug, NOT
    // a literal: a blueprint may name the leader template anything — the
    // consolidated-revision P1 fix; the admission gate keys on the same
    // `blueprint.leader.templateId`, so the verdict must too). For a v1
    // document (no leader template) this is `undefined` and the template
    // scope lookup below yields an empty set. A MEMBER session is its
    // durable row's template (the row read — the same authority the
    // setup's static capabilities use).
    let templateId
    if (rootSid !== undefined && String(sessionId) === rootSid) {
      templateId = blueprint.leader?.templateId
    } else {
      const members = domain.repositories.memberInstances.list(rootSid ?? String(sessionId))
      const row = members.find((member) => member.childSessionId === sessionId)
      if (row !== undefined && row.templateId !== undefined) templateId = String(row.templateId)
    }
    const inputs = scopeRequirementInputsOf(blueprint)
    // The human-reviewed recovery marker (the router's recovery dispatch
    // — NEVER caller-forged; absent = no exemption). BOTH halves are
    // read: the scope keys AND the unavailable subjects (the
    // consolidated-revision P2b fix — per-scope identity: a marker
    // covering the subject in ONE scope does not exempt the SAME
    // subject's required occurrence in ANOTHER scope).
    const recoveryScopeKeys = new Set(
      recovery !== undefined && Array.isArray(recovery.scopeKeys)
        ? recovery.scopeKeys.map(String)
        : [],
    )
    const recoverySubjects = new Set(
      recovery !== undefined && Array.isArray(recovery.unavailableSubjects)
        ? recovery.unavailableSubjects.map(String)
        : [],
    )
    // The in-scope REQUIRED occurrences of the bound blueprint:
    // per-scope (scopeKey) identity over the TEAM scope and the TARGET
    // template scope. An occurrence is REQUIRED when the blueprint names
    // the subject with type `mcpServer` and `complete: true` (the
    // `complete !== false` = required-or-unspecified convention, the same
    // as the admission gate). The scope keys are the SAME canonical
    // strings the recovery marker carries (`'team'` /
    // `template:<templateId>` — the requirements types' `scopeKey`).
    const requiredScopesByServer = new Map() // subject -> [scopeKey, ...]
    const addRequiredOccurrence = (subject, scopeKeyStr) => {
      const scopes = requiredScopesByServer.get(subject)
      if (scopes === undefined) {
        requiredScopesByServer.set(subject, [scopeKeyStr])
      } else {
        scopes.push(scopeKeyStr)
      }
    }
    for (const input of inputs.team) {
      if (input.type === 'mcpServer' && input.complete !== false) {
        for (const subject of input.subjects) addRequiredOccurrence(subject, scopeKey(teamScope()))
      }
    }
    if (templateId !== undefined && String(templateId).length > 0) {
      for (const input of inputs.templates[templateId] ?? []) {
        if (input.type === 'mcpServer' && input.complete !== false) {
          for (const subject of input.subjects) {
            addRequiredOccurrence(subject, scopeKey(templateScope(String(templateId))))
          }
        }
      }
    }
    const blockedServers = []
    const degradedServers = []
    const recoveryCoveredServers = []
    for (const name of failedServers) {
      const requiredScopes = requiredScopesByServer.get(name)
      if (requiredScopes === undefined || requiredScopes.length === 0) {
        degradedServers.push(name) // optional / no requirement — the degraded allow
        continue
      }
      // Per-scope identity: a required occurrence is covered ONLY when
      // the marker names BOTH its scope AND its subject. The server is
      // exempt only if EVERY one of its required occurrences is covered;
      // a single uncovered required occurrence BLOCKS (the L7 shape: the
      // same subject required in the team scope AND the target template
      // scope — a marker covering only the team scope leaves the
      // template-scope occurrence uncovered → block).
      const everyOccurrenceCovered = requiredScopes.every((scopeKeyStr) =>
        recoveryScopeKeys.has(scopeKeyStr) && recoverySubjects.has(name),
      )
      if (everyOccurrenceCovered) {
        recoveryCoveredServers.push(name) // all required occurrences reviewed — the exemption
      } else {
        blockedServers.push(name) // a required occurrence is uncovered — the block
      }
    }
    return { blocked: blockedServers.length > 0, failedServers, blockedServers, degradedServers, recoveryCoveredServers }
  }

  /**
   * The request-boundary reconciliation (P8-S4B §18.2): re-read the backend
   * truth and bring the live agent's model selection + mcp mount SET in line
   * with it BEFORE the next real request. Future-boundary semantics come from the
   * public seam itself: an in-flight turn keeps its own assembly snapshot
   * (`assembled`); only the NEXT assembly sees the new `current`.
   * @param {string} sessionId
   * @param {string} [teamRootSid] - the team root the session belongs to
   *   (T12-GLUE; absent = this row's boot root, as before).
   * @param {{scopeKeys?: readonly string[], unavailableSubjects?: readonly string[]}|undefined} [recovery]
   *   - the human-reviewed recovery marker of the delivering request (the
   *   router's recovery dispatch — NEVER caller-forged): a failed required
   *   server it names in `unavailableSubjects` is EXEMPT in the returned
   *   verdict (the reviewed scope is allowed — the L4c shape). Absent: no
   *   exemption. The observation-only callers (the completion wake,
   *   executeTool) pass nothing.
   * @returns {Promise<{verdict: {blocked: boolean, failedServers: string[], blockedServers: string[], degradedServers: string[], recoveryCoveredServers: string[]}>}
   *   the FINAL-INPUT VERDICT (Finding F residual round): the FINAL
   *   required-truth of the target's applicable mcp materialization AFTER
   *   the full ensure/resume/prepare sequence — the NORMAL-INPUT consumers
   *   (workDelivery.deliver / sessionInput.submitAttributedInput /
   *   deliverRootInput) MUST consult it before the first model-visible
   *   input (a `blocked` verdict = zero input; the fail-closed
   *   settlement / the typed delivery failure is their contract). The
   *   liveness paths (the completion wake, the control notification,
   *   executeTool) stay observation-only (they ignore the verdict — a
   *   liveness failure is a liveness failure).
   */
  // ── A5-M1 (root ruling on the generation seam): THE narrow authority-
  // generation refresh, published by the trusted assembly owner at the request
  // boundary. This is an ASSEMBLY WRITE, not a reader/verifier read: it is the
  // one place that advances this Agent's governed Bindings onto a generation
  // the durable overlay has already moved to, and it runs BEFORE the turn's
  // model-visible input (every `prepareAgentForRequest` call site is awaited
  // there), so a read/bash started in this turn captures its AdmissionRequest
  // on the refreshed binding.
  // The order is fixed by the ruling:
  //  1. read the generation through the ONE durable reader; a fault or a
  //     malformed row changes NOTHING (no revise, no counter move) and is
  //     observed — a failed read never advances or lowers an authority;
  //  2. unchanged number ⇒ zero action (idempotent: no revision churn);
  //  3. otherwise FIRST re-verify the real definitions/placement through the
  //     Guard's own revalidation (`revalidate()`: diagnoses and revises drifted
  //     or unreadable names DOWN — it can never raise `unverified` to
  //     `verified`), THEN publish the generation in ONE SYNCHRONOUS BATCH over
  //     `surface.names()` — every governed name of this scope, never just the
  //     one a caller happened to use, and with NO await inside the batch (a
  //     half-advanced scope is exactly the "read fresh, bash stays stale" bug);
  //  4. `revise` keeps the bindingId FAMILY, the providerId and the
  //     definitionIdentity, and only ever adds a revision — so a call holding
  //     an older binding/grant does not continue under the new identity: its
  //     execution edge compares the tuple it was admitted with against the
  //     standing one and refuses (GRANT_STALE / consumption refused), and the
  //     fresh edge stays read-only and never self-repairs.
  // TWO CALLERS, ONE IMPLEMENTATION: `prepareAgentForRequest` (the DELIVERY
  // boundary, which reads the generation itself) and the plane's NAMED
  // `authorityFacts.ensureAuthorityCurrent` leg (the CALL boundary, handed the
  // generation that admission just read) — so the 2nd..N-th LLM step of one
  // turn and every wake that reaches `paAdmit` without a delivery land on the
  // standing number BEFORE they capture an AdmissionRequest. Neither caller
  // reads twice, and neither one keeps a value.
  /** The publish HALF: it performs NO durable read, which is why the seam costs
   *  exactly ONE durable read per admission/request whichever caller reaches it
   *  (the no-cache/no-reuse evidence the ruling asks for).
   *  @param observationKey - what the observation line names this publish by. */
  function publishAuthorityGeneration(observationKey, teamRootSid, memberInstanceId, generation) {
    if (typeof generation !== 'number' || !Number.isFinite(generation) || generation < 0) {
      throw new Error(`agent-bindings: publishAuthorityGeneration was handed ${JSON.stringify(generation) ?? String(generation)} — a generation nobody read is never published`)
    }
    // THE MOUNT INDEX IS A SEAM, NOT A MODULE IMPORT. The old `pa-mount-registry.mjs` was retired with
    // the execution route; calling its function here left a ReferenceError on a LIVE path (the F15 MCP
    // legs found it). The centre now takes the resolution as an optional dep, and an unwired seam is an
    // EXPLICIT reason rather than a crash or a silent "nothing to refresh".
    if (typeof resolveMemberMount !== 'function') {
      observations.push(`a5m1-authority-refresh: ${observationKey} generation ${String(generation)} NOT published — no mount-resolution seam is wired (the authority-generation refresh cannot fire until the centre exposes live bindings)`)
      return { refreshed: false, reason: 'no-mount-seam' }
    }
    const mount = resolveMemberMount(String(teamRootSid), String(memberInstanceId))
    const guard = mount?.guard
    const dispatcher = guard?.dispatcher
    if (dispatcher === undefined || typeof dispatcher.revise !== 'function'
      || typeof dispatcher.authorityGeneration !== 'function'
      || typeof guard.revalidate !== 'function'
      || dispatcher.surface?.names === undefined) {
      return { refreshed: false, reason: 'no-guard-mount' }
    }
    const standing = dispatcher.authorityGeneration()
    // 2. unchanged number ⇒ ZERO action (no revision churn, no revalidation).
    if (standing === generation) return { refreshed: false, reason: 'unchanged' }
    // 3. re-verify the real definitions/placement FIRST ...
    const revalidation = guard.revalidate()
    const revised = []
    const refused = []
    // ... THEN publish, synchronously and scope-wide: one authority generation
    // for every governed name, no await inside the batch (a half-advanced scope
    // is exactly the "read refreshed, bash stayed stale" bug this pins).
    for (const name of dispatcher.surface.names()) {
      const entry = dispatcher.surface.entryOf(name)
      if (entry?.binding?.authorityGeneration === generation) continue
      const done = dispatcher.revise(name, { authorityGeneration: generation })
      if (done.ok === true) revised.push(name)
      else refused.push(`${name}(${done.error?.code ?? '?'})`)
    }
    observations.push(`a5m1-authority-refresh: ${observationKey} generation ${String(standing)} → ${generation} revised=[${revised.join(',')}]${refused.length > 0 ? ` refused=[${refused.join(',')}]` : ''} revalidated-unverified=${String((revalidation?.unverified ?? []).length)} drifted=${String((revalidation?.drifted ?? []).length)}`)
    return { refreshed: true, generation, revised, refused }
  }

  async function refreshAuthorityGeneration(sessionId, teamRootSid) {
    const state = consumptionState.get(sessionId)
    if (state === undefined) return { refreshed: false, reason: 'no-consumption-state' }
    let generation
    try {
      generation = await readAuthorityGeneration(String(teamRootSid), String(state.instanceId))
    } catch (error) {
      observations.push(`a5m1-authority-refresh: REFUSED for ${sessionId} (${String(error?.message ?? error).slice(0, 180)}) — no binding moves, the standing generation stays as it is`)
      return { refreshed: false, reason: 'read-failed' }
    }
    return publishAuthorityGeneration(sessionId, teamRootSid, state.instanceId, generation)
  }

  async function prepareAgentForRequest(sessionId, teamRootSid, recovery) {
    const state = consumptionState.get(sessionId)
    if (state === undefined) {
      // defensive: every row agent has consumption state
      return { verdict: { blocked: false, failedServers: [], blockedServers: [], degradedServers: [], recoveryCoveredServers: [] } }
    }
    // A5-M1: the request boundary refreshes this Agent's governed Bindings onto
    // the durable authority generation BEFORE the turn's input is delivered
    // (so no AdmissionRequest in this turn can be captured on a stale binding).
    // A failure here changes nothing (observed, no write) — it never blocks a
    // turn that the durable truth does not block; the guard's own typed refusal
    // stays the fail-closed answer for any call whose generation is unreadable.
    await refreshAuthorityGeneration(sessionId, teamRootSid)
    const { modelView, mcpViews } = resolveConsumptionViews(sessionId, undefined, teamRootSid)
    const selection = modelView.selection === undefined ? { ...config.deniedSelection } : modelView.selection
    if (state.ref.current.provider !== selection.provider || state.ref.current.model !== selection.model) {
      state.ref.current = selection
    }
    let verdict = { blocked: false, failedServers: [], blockedServers: [], degradedServers: [], recoveryCoveredServers: [] }
    const handle = liveAgents.get(sessionId)
    if (handle !== undefined && Object.keys(mcpViews).length > 0) {
      // alpha.1 (plan §10.8) + multi-mcp (contract I4 §2.3): the
      // request-boundary reconcile honors the template's static mcp entry
      // too (re-read from the durable identity — the same decision the
      // setup applied, so a durable tighten/deny AND a blueprint template
      // mcp deny converge on the same no-mount — per server). The target
      // set may be EMPTY: reconcileMcpSet then disposes every mounted
      // server (the durable-deny path) and mounts nothing.
      const caps = resolveStaticCapabilities(sessionId, state.instanceId, undefined, teamRootSid)
      const configuredMcpNames = configuredMcpServers(config).map((s) => s.name)
      const templateAllowedNames =
        caps.mode === 'selective'
          ? filterMcpServers(configuredMcpNames, caps.mcp)
          : [...configuredMcpNames]
      const target = templateAllowedNames.filter((name) => mcpViews[name]?.allowed === true)
      // The MOUNT ATTEMPT is ALLOWED (the bootstrap contract: PENDING =
      // the mount attempt is admissible — a fresh member that never
      // mounted is admissible, never a blanket block; the cooldown skip
      // is the retry discipline, not a verdict). The VERDICT reads the
      // FINAL slot truth AFTER this reconcile — never a pre/post attempt-
      // clock delta (the class-1 gap: the setup-stamped failure carries
      // the same clock the prepare sees, and the delta is blind to it).
      await reconcileMcpSet(state, target)
      verdict = finalInputVerdictOf(state, sessionId, teamRootSid, target, recovery)
    }
    applyBoundaryRecords(state, modelView, mcpViews)
    state.modelView = modelView
    state.mcpViews = mcpViews
    return { verdict }
  }

  // ── the activation ports (real external effects, minimal surface) ─────

  const childFactory = {
    async createChildSession(request) {
      // T12-B2: the derivation key is the (root, instance) pair. The request
      // carries the root (the provider passes it); the row's own root is the
      // contract fallback when the field is absent.
      const childRoot =
        typeof request.rootSessionId === 'string' && request.rootSessionId !== ''
          ? request.rootSessionId
          : rootSid
      const childSid = childSessionIdFor(childRoot, String(request.instanceId))
      // The fresh-child instance id, carried into the setup callback: the
      // frozen activation flow creates the child session BEFORE the
      // MemberInstance row is committed (crash-window semantics — the
      // child artifact is durable before the member record), so the setup's
      // consumption resolution cannot derive the id from the domain yet.
      // The hint is exactly the value the flow commits moments later.
      const instanceIdHint = String(request.instanceId)
      // T12-M2: the template id hint — the factory request carries the
      // member's static template identity (exactly the value the flow
      // commits into the MemberInstance row moments after this setup
      // runs); the persona resolver needs it in the fresh-create window.
      const templateIdHint =
        typeof request.templateId === 'string' && request.templateId !== ''
          ? request.templateId
          : undefined
      const live = liveAgents.get(childSid)
      if (live !== undefined) return { childSessionId: childSid }
      // C1 (guide §6.2/§5.2): the durable-child resume goes through the
      // ownership-guarded wrapper (the fence's runOwned) — never a bare
      // agents.resume. Durability is the public seam (no physical probe).
      if (await durableSessionExists(childSid)) {
        const handle = await resumeTeamAgent({
          sessionId: childSid,
          // TCM-D4: the child's consumption + persona resolve under the
          // OWNING root (the request's rootSessionId — the boot root only
          // when the field is absent, as before).
          setup: agentSetup(childSid, instanceIdHint, templateIdHint, 'cold-member', childRoot),
        })
        liveAgents.set(childSid, handle)
        return { childSessionId: childSid }
      }
      // T12-M1: the actual Agent cwd is the member's EFFECTIVE workspace —
      // the contract-explicit request.workspace, falling back to the team's
      // default workspace (config.defaultWorkspace). DSH_HOME is the
      // session store, never the working directory.
      const memberCwd =
        typeof request.workspace === 'string' && request.workspace !== ''
          ? request.workspace
          : config.defaultWorkspace
      const handle = await createTeamAgent({
        sessionId: childSid,
        meta: { cwd: memberCwd },
        // TCM-D4: the child's consumption + persona resolve under the
        // OWNING root (the request's rootSessionId — the boot root only
        // when the field is absent, as before).
        setup: agentSetup(childSid, instanceIdHint, templateIdHint, 'fresh-member', childRoot),
      })
      liveAgents.set(childSid, handle)
      return { childSessionId: childSid }
    },
  }

  const sessionDurability = {
    async ensureDurable(childSessionId) {
      const handle = liveAgents.get(String(childSessionId))
      if (handle === undefined) {
        throw new Error(`p6t6: no live agent for child session '${childSessionId}' — the invariant-46 durability barrier is impossible`)
      }
      await sessionPersistence.ensureMaterialized(handle.agent.session)
    },
  }

  /**
   * The full live-agent boot (the sequence the P6-T6 harness ran after the
   * tool stack existed; the production root calls it exactly once, after
   * filling teamToolsRef, because the setup callback registers tools INSIDE
   * create/resume). Idempotent: a second call re-awaits the same promise.
   *   create phase: create the root agent (deterministic root session id,
   *     the team's default-workspace cwd — T12-M1: never DSH_HOME) ->
   *     liveAgents -> ensureMaterialized -> then every
   *     seeded NON-leader member (config.seedMembers, leader excluded —
   *     the leader IS the root session): create the child agent on its
   *     config childSessionId -> liveAgents -> ensureMaterialized.
   *   resume phase: resume the root (same call shape), then re-bind every
   *     bound member child from the domain truth (dedupe by childSessionId,
   *     seen set starting {rootSid}): resume -> liveAgents ->
   *     ensureMaterialized.
   * @returns {Promise<void>}
   */
  function boot() {
    if (bootPromise !== undefined) return bootPromise
    bootPromise = (async () => {
      if (config.bootPhase !== 'create' && config.bootPhase !== 'resume') {
        throw new Error(`agent-bindings: config.bootPhase must be 'create' or 'resume' (got ${JSON.stringify(config.bootPhase)})`)
      }
      const rootResuming = config.bootPhase === 'resume'
      if (rootResuming) resumingSessions.add(rootSid)
      let rootHandle
      try {
        rootHandle = config.bootPhase === 'create'
          ? await createTeamAgent({
            sessionId: rootSid,
            // T12-M1: the root agent works in the team's effective default
            // workspace (config.defaultWorkspace) — never DSH_HOME.
            meta: { cwd: config.defaultWorkspace },
            // PR #23 review fix (P1-A): the boot root OWNS itself — the
            // caller asserts the owner explicitly (the resolver no longer
            // infers ownership from an absent argument).
            setup: agentSetup(rootSid, undefined, undefined, 'fresh-root', rootSid),
          })
          : await resumeTeamAgent({
            sessionId: rootSid,
            setup: agentSetup(rootSid, undefined, undefined, 'cold-root', rootSid),
          })
      } finally {
        if (rootResuming) resumingSessions.delete(rootSid)
      }
      liveAgents.set(rootSid, rootHandle)
      if (config.bootPhase === 'create') {
        await sessionPersistence.ensureMaterialized(rootHandle.agent.session)
        for (const seed of config.seedMembers) {
          // The leader instance IS the root session — never a child.
          if (String(seed.instanceId) === LEADER_INSTANCE_ID) continue
          const child = String(seed.childSessionId)
          const handle = await createTeamAgent({
            sessionId: child,
            // T12-M1: seeded members carry no per-member workspace in the
            // boot config — they work in the team's effective default
            // workspace (never DSH_HOME); the child factory path uses the
            // request-explicit workspace when one is passed.
            meta: { cwd: config.defaultWorkspace },
            // PR #23 review fix (P1-A): a boot seed member is a member of
            // THIS world's boot root BY DEFINITION (the loop iterates the
            // boot config's own seed list) — the caller asserts the owner
            // explicitly instead of relying on the resolver's durable
            // ownership read (a config-only seed may carry no durable
            // MemberInstance row at all).
            setup: agentSetup(child, String(seed.instanceId), seed.templateId, 'fresh-member', rootSid),
          })
          liveAgents.set(child, handle)
          await sessionPersistence.ensureMaterialized(handle.agent.session)
        }
      } else {
        // Resume phase: re-bind every bound member child (the leader's is
        // the root, already resumed; dedupe by child session id).
        const members = listMemberRows(rootSid)
        const seen = new Set([rootSid])
        for (const member of members) {
          // T12-V18 (parent final directive; literal form of the T12-V17/T12-V10
          // resume fix): mirror the create path's exclusion (the create loop
          // skips LEADER_INSTANCE_ID because the leader IS the root session,
          // resumed above) — explicit by instance id, plus the explicit keyless-row
          // guard before any stringification (String(undefined) produced
          // SessionId("undefined") and killed every resume boot: T12 vertical
          // runs #6-#10; T12-B2 repair family).
          if (String(member.instanceId) === LEADER_INSTANCE_ID) continue
          if (member.childSessionId === undefined || member.childSessionId === null) continue
          // T12-V10 structural guard (shape used by projection-source.ts /
          // s6-live-overlay.ts): second line of defense vs empty-string or
          // non-string values.
          const childRaw = member.childSessionId
          if (typeof childRaw !== 'string' || childRaw.length === 0) continue
          const child = childRaw
          if (seen.has(child)) continue
          seen.add(child)
          // SEAM 2 of 2 — the SAME durable-lifecycle gate: a restart must not
          // re-bind an ARCHIVED / DISPOSED member (the boot loop iterates
          // every durable row, so without this check a restart silently
          // makes the archived Member live again). Skip BEFORE
          // ensureMaterialized/resumeTeamAgent; the already-read `members`
          // list is reused (no second durable scan).
          const refusal = memberResumeRefusal(child, rootSid, members)
          if (refusal !== null) {
            observations.push(
              `agent-bindings: boot resume skipped ${String(refusal.code)} member '${child}' — the durable lifecycle forbids the re-bind (Architecture §41.6/§30.2/§29.4)`,
            )
            continue
          }
          resumingSessions.add(child)
          let handle
          try {
            handle = await resumeTeamAgent({
              sessionId: child,
              // PR #23 review fix (P1-A): this loop iterates
              // memberInstances.list(rootSid) — every child here is a
              // member of the boot root BY CONSTRUCTION; assert the owner
              // explicitly (no resolver inference).
              setup: agentSetup(child, undefined, undefined, 'cold-member', rootSid),
            })
          } finally {
            resumingSessions.delete(child)
          }
          // SEAM 5 — the POST-RESUME IN-MEMORY ADMISSION CHECK (the boot
          // interleaving). SEAM 2 read the durable row before the resume and
          // saw SETTLED; the archive's QUIESCE can start while the resume is
          // in flight and its step 5 releases residency while the durable row
          // is still SETTLED — no durable read can see that window (that is
          // why the durable sweep below cannot cover it). The admission close
          // is the in-process half of the boundary and costs no durable read;
          // a handle published here would be a resident Agent for a member
          // that is being archived in this very process. No await between this
          // check and `liveAgents.set`: a close can only land before or after
          // this block, never inside it.
          const midProcedureRefusal = admissionCloseRefusal(child)
          // SEAM 6 — the COMPLETED-procedure half (the boot publish window).
          // The admission close cannot see a procedure that has already
          // RETURNED: its `finally` reopened the map while the durable row is
          // terminal, so the check above passes and the resume would publish.
          // The marker makes that case payable with exactly ONE durable read —
          // and only for a member that actually went terminal in this process
          // at boot time. A restore (or an aborted procedure) cleared the
          // marker or fails the read, in which case the publish proceeds.
          let completedProcedureRefusal = null
          if (midProcedureRefusal === null && sessionIdentity.terminalMarkerOf(child) !== undefined) {
            const lateTerminal = memberResumeRefusal(child, rootSid)
            if (lateTerminal !== null) completedProcedureRefusal = lateTerminal
            else sessionIdentity.clearTerminalMarker(child)
          }
          const bootRefusal = midProcedureRefusal ?? completedProcedureRefusal
          if (bootRefusal !== null) {
            try {
              await handle.dispose()
            } catch (error) {
              observations.push(
                `agent-bindings: resumed agent dispose failed after a boot publish refusal for '${child}': ${error instanceof Error ? error.message : String(error)}`,
              )
            }
            observations.push(
              `agent-bindings: boot resume skipped ${String(bootRefusal.code)} member '${child}' — a lifecycle procedure in this process has made the member terminal (Architecture §41.6/§30.2/§29.4; the admission close, §30.1, covers the procedure still being open)`,
            )
            continue
          }
          liveAgents.set(child, handle)
          await sessionPersistence.ensureMaterialized(handle.agent.session)
        }
        // SEAM 4 — the POST-LOOP DURABLE SWEEP (the boot race). The loop read
        // the member set ONCE (that is the boot contract: one enumeration for
        // the whole set, never per member). A member whose resume was in
        // flight when the archive committed is still in `liveAgents` here, and
        // `ensureLiveAgent` would serve it from the fast path forever without
        // ever consulting the durable gate again. ONE extra enumeration of the
        // same set — independent of member count — finds those rows and drops
        // their handles through the same typed refusal path as SEAM 3.
        //
        // The eviction DECISIONS are all taken from that one snapshot with no
        // await in between, before any handle is disposed: a dispose await
        // would otherwise let a second member's commit land between the
        // decision and the act. A commit landing after this snapshot needs no
        // sweep — the archive's own post-commit residency re-drop
        // (`archive.ts`/`dispose.ts` fix (a)) removes a handle that was
        // published before the commit.
        const afterBoot = listMemberRows(rootSid)
        // BATCH ATOMICITY: take the whole eviction set and EVICT IT ALL before
        // the first `await` (a dispose). A per-member delete→await→delete loop
        // would leave the handles LATER in the set live between two disposals —
        // a dispatch could be served one the sweep has already decided to drop.
        const doomed = []
        for (const member of afterBoot) {
          const sweptChild = member?.childSessionId
          if (typeof sweptChild !== 'string' || sweptChild.length === 0) continue
          const sweptHandle = liveAgents.get(sweptChild)
          // A concurrent archive's post-commit re-drop may already have taken
          // it: nothing to evict, and `undefined` must NEVER reach `.dispose()`.
          if (sweptHandle === undefined) continue
          const sweptRefusal = memberResumeRefusal(sweptChild, rootSid, afterBoot)
          if (sweptRefusal === null) continue
          liveAgents.delete(sweptChild)
          doomed.push({ child: sweptChild, refusal: sweptRefusal, handle: sweptHandle })
        }
        for (const { child: sweptChild, refusal: sweptRefusal, handle: sweptHandle } of doomed) {
          try {
            await sweptHandle.dispose()
          } catch (error) {
            observations.push(
              `agent-bindings: resumed agent dispose failed after a durable lifecycle refusal for '${sweptChild}': ${error instanceof Error ? error.message : String(error)}`,
            )
          }
          observations.push(
            `agent-bindings: boot resume dropped ${String(sweptRefusal.code)} member '${sweptChild}' — the durable lifecycle forbids the re-bind (Architecture §41.6/§30.2/§29.4)`,
          )
        }
      }
    })()
    return bootPromise
  }

  // SD-SURFACE: the minimal no-op TeamAgentSetupSurface with the port's real
  // signatures (the harness needs no overlay slots; the post-commit binder
  // resolves the durable member record through the read handle).
  const surface = {
    getInstalledSlots(_sessionId) { return [] },
    installOverlay(_sessionId, _slot) {},
    restoreScope(_sessionId, _scope) {},
    recordSessionEvent(_sessionId, _event) {},
  }

  // The REAL SessionInputPort over the public Session input API. The
  // commit point is the followup INBOX ACCEPTANCE: `followup` returning
  // means the attributed input is durably in the recipient's session
  // inbox, and that IS the delivery success boundary. Messaging is an
  // input delivery primitive, NOT a work execution primitive — the
  // recipient's own model turn runs independently from here (it may call
  // tools, send messages, wait for approvals, or keep working), so this
  // port does NOT await `whenIdle` (the same frozen liveness principle
  // the work-completion wake-up uses: "Success boundary = acceptance, NO
  // whenIdle, NO ensureMaterialized"). Awaiting the recipient's whole
  // turn would hang the sender for its duration and — when the recipient
  // replies mid-turn — form a cross-Agent lifecycle wait cycle (Leader
  // waits Member idle ↔ Member waits Leader idle). Commit-or-throw is
  // unchanged: a `followup` REJECTION means the input was not delivered
  // (the coordinator keeps the intent pending for recovery); a later
  // failure of the recipient's own turn is that turn's concern, never a
  // delivery failure. (The sync `team_delegate` / `team_follow_up`
  // completion boundary stays work-completion: `workDelivery.deliver`
  // below still awaits `whenIdle` + materializes.)
  const sessionInput = {
    async submitAttributedInput(input) {
      const handle = await ensureLiveAgent(String(input.sessionId))
      // P8-S4B: request boundary — re-apply the durable truth first.
      // TCM-D4: under the session's OWNING root (the boot root only when
      // the session belongs to it; a member of another team root — or a
      // team root itself — resolves under its own root's truth).
      const prepared = await prepareAgentForRequest(String(input.sessionId), teamRootOfSession(input.sessionId))
      // Finding F residual round (the requirement-aware FINAL-INPUT
      // verdict): the attributed input IS ACTUAL input on the recipient
      // session (the relayed model-visible turn) — the recipient's FINAL
      // required-truth gates it exactly like the work delivery. A
      // `blocked` verdict (a failed REQUIRED server of the recipient's
      // applicable materialization, not covered by a reviewed recovery —
      // no such marker rides the wire today: the frozen member.send
      // contract carries none) throws BEFORE the inbox acceptance; the
      // coordinator maps the rejection to MESSAGING_DELIVERY_FAILED and
      // keeps the intent pending (R2/R3: the coordination is recoverable
      // — zero model-visible input, no confirmation fact). The optional /
      // no-requirement outage degrades (the relay delivers).
      if (prepared.verdict.blocked) {
        throw new Error(
          `messaging delivery blocked before input: the recipient's required mcp materialization is failed after this boundary [${prepared.verdict.blockedServers.join(', ')}] — the materialization must succeed before real work (Finding F residual round: the requirement-aware final-input verdict)`,
        )
      }
      const message = createUserMessage({
        content: [{ type: 'text', text: input.text }],
        // A56-SEMANTICS (P1-3, gated on the Alpha.6 opt-in): only a HUMAN
        // sender (the closed attribution's fromHumanId) is a human
        // interaction. A Leader/model relay carries the producer-owned
        // MACHINE kind ONLY while the Alpha.6 review plane is opted in — the
        // SAME `config.alpha6ReviewRouting === true` flag `root.ts` hands to
        // `createAlpha6RootWiring(true, thunk)`; then it can never clear a
        // human Sticky Stop on the recipient. With the opt-in absent/false no
        // Sticky Stop listener is registered at all, so this path restores the
        // base `{kind:'user'}` attribution and a relay-started Member turn
        // keeps the upstream direct-human goal authority (`hasDirectHumanInput`,
        // authority.ts) — the Alpha.5 behaviour is literally unchanged.
        source: config?.alpha6ReviewRouting === true
          && input.attribution.fromHumanId === undefined
          ? TEAM_PRODUCER_SOURCE
          : { kind: 'user' },
      })
      // Only a MACHINE relay is registered: a human `member.send` carries the
      // human attribution precisely so it may clear a human Sticky Stop, and
      // the ledger must not take that back.
      if (input.attribution.fromHumanId === undefined) {
        machineInputs.note(String(input.sessionId), message)
      }
      // Success boundary = inbox acceptance: NO whenIdle, NO
      // ensureMaterialized (the turn's durable log is materialized by the
      // recipient's own turn settlement, not by the sender).
      handle.agent.followup(message)
    },
  }

  /**
   * ROUND 84 — the ONE review-wake delivery port, built lazily over THIS row's own durable ledger and
   * the SAME `sessionInput` the messaging coordinator uses. Lazy on purpose: a factory/unit world that
   * never routes a review must not open or touch a ledger, and a world whose domain is a narrow double
   * keeps working (the port is only constructed when a wake is actually delivered).
   * @returns {ReturnType<typeof createReviewWakeDelivery>}
   */
  let reviewWakeDelivery
  function reviewWakePort() {
    if (reviewWakeDelivery === undefined) {
      reviewWakeDelivery = createReviewWakeDelivery({
        ledger: domain.repositories.ledger,
        memberOf: (rootSessionId, instanceId) =>
          domain.repositories.memberInstances.list(rootSessionId)
            .find((member) => String(member.instanceId) === String(instanceId)),
        sessionInput,
      })
    }
    return reviewWakeDelivery
  }

  // The work-delivery port (R1/R6): the ONLY model-visible delivery path —
  // the requestToken rides visibly so at-least-once deliveries stay
  // dedupe-able from the durable child log, and the turn is observed to
  // idle before the chain settles. A fault here throws: the chain settles
  // fail-closed, never a fake RUNNING success. v2 D2 (task C2): after the
  // turn settles durably, the delivered turn is read back through the
  // public session seam and the port RETURNS the frozen WorkDeliveryResult
  // (the C1 contract: succeeded + the member business body / failed + a
  // stable code / unavailable) — the throw contract above is unchanged.
  const workDelivery = {
    async deliver(args) {
      const handle = await ensureLiveAgent(String(args.childSessionId))
      // P8-S4B: request boundary — re-apply the durable truth first.
      // TCM-D4: under the child's OWNING root (the boot root only when the
      // child belongs to it — a member of another team root resolves
      // under its own root's truth).
      const prepared = await prepareAgentForRequest(
        String(args.childSessionId),
        teamRootOfSession(args.childSessionId),
        args.recovery,
      )
      // Finding F residual round (the requirement-aware FINAL-INPUT
      // verdict): BEFORE ACTUAL INPUT (the model-visible followup below).
      // The prepare above ran the target's own boundary reconcile (the
      // MOUNT ATTEMPT — ALLOWED: the bootstrap contract's PENDING = the
      // mount attempt is admissible; a fresh member that never mounted is
      // admissible, never a blanket block) and returned the FINAL
      // required-truth of the target's applicable mcp materialization
      // AFTER the full ensure/resume/prepare sequence. A `blocked`
      // verdict = a failed REQUIRED server (an in-scope bound-blueprint
      // requirement, `mcpServer` + `complete: true`) NOT covered by the
      // request's reviewed `recovery` marker — the contract (the
      // materialization SUCCESS is verified before actual input) forbids
      // THIS passage's delivery. The throw is the fail-closed signal: the
      // work chain settles delivery-failed (durable, N3 throw-after-
      // settle) and ZERO model-visible input reaches the member; the NEXT
      // passage is gated as `failed` at admission (the feed's failed ->
      // DOWN). The optional / no-requirement outage degrades (delivers);
      // the reviewed-scope outage is exempt (the human-reviewed re-run).
      if (prepared.verdict.blocked) {
        throw new Error(
          `team work delivery blocked before input: the target's required mcp materialization is failed after this boundary [${prepared.verdict.blockedServers.join(', ')}] — the materialization must succeed before real work (Finding F residual round: the requirement-aware final-input verdict)`,
        )
      }
      const text = args.attachedContext !== undefined && args.attachedContext.length > 0
        ? `${args.prompt}\n\n[attached-context]\n${args.attachedContext}`
        : args.prompt
      const message = createUserMessage({
        content: [{ type: 'text', text: `[team-work requestToken=${args.requestToken}] ${text}` }],
        // A56-SEMANTICS — resolution (a), the MEASURED half: work delivery is
        // the ONE Team delivery a governed Member must be able to start a goal
        // from, and upstream grants that authority only to a runtime ROOT whose
        // open turn carries `source.kind === 'user'` (authority.ts
        // `hasDirectHumanInput`). Alpha.6 had moved this line to the `plugin:`
        // kind to protect the Sticky Stop, which silently removed `create_goal`
        // from every Member (measured: GOAL_TOOL_AUTHORITY_REQUIRED, 0 rounds).
        // The two properties are kept apart instead: this turn keeps the human
        // attribution for AUTHORITY and is registered with the machine-input
        // ledger, so the Alpha.6 resume arbour still refuses to read it as an
        // explicit human interaction (host wiring: `isHumanInteractionClaim`).
        source: { kind: 'user' },
      })
      machineInputs.note(String(args.childSessionId), message)
      handle.agent.followup(message)
      const signal = args.signal
      if (
        signal !== null &&
        typeof signal === 'object' &&
        typeof signal.addEventListener === 'function' &&
        typeof signal.removeEventListener === 'function'
      ) {
        if (signal.aborted) {
          handle.agent.cancel({ kind: 'hook', reason: 'team-work-delivery-aborted' })
          throw signal.reason ?? new Error('team work delivery aborted')
        }
        let onAbort
        const aborted = new Promise((_, reject) => {
          onAbort = () => {
            handle.agent.cancel({ kind: 'hook', reason: 'team-work-delivery-aborted' })
            reject(signal.reason ?? new Error('team work delivery aborted'))
          }
          signal.addEventListener('abort', onAbort, { once: true })
        })
        try {
          await Promise.race([handle.agent.whenIdle(), aborted])
        } finally {
          signal.removeEventListener('abort', onAbort)
        }
      } else {
        await handle.agent.whenIdle()
      }
      // Materialize the durable log (the same public persistence seam the
      // activation barrier uses) so the delivered turn's model-visible
      // content is on disk before the chain settles. A contained upstream
      // turn failure does NOT reject whenIdle (errors are contained at the
      // driver boundary and reported, not propagated), so reaching here
      // means the model-visible message was submitted and the turn is over.
      await sessionPersistence.ensureMaterialized(handle.agent.session)
      // v2 D2 (task C2): the delivered turn is now read back through the
      // public session seam and normalized into the frozen
      // WorkDeliveryResult (the C1 contract) — the Leader sees the
      // member's business text or an explicit failure instead of only
      // settled=true. The fail-closed throw contract above is unchanged:
      // a fault of the delivery/observation itself still rejects (the
      // throw IS the signal; no result is formed on that path).
      return readDeliveredWorkTurn(handle.agent.session, String(args.requestToken))
    },
  }

  // ── T12-GLUE: the handoff Root Agent ports (B6's createAndStartTeam) ────
  //
  // The with-context handoff drives the ONE formal createAndStartTeam
  // primitive in the production root: after the canonical fresh-root binding
  // (durable TeamSession + team-root binding + leader mint), the target Root
  // Agent is started here (createRootAgent) and the frozen context is
  // delivered into it here (deliverRootContext) — through the SAME real
  // agent factory the boot path uses and the SAME real input path the
  // delegate work uses. At-least-once semantics are owned by B6's durable
  // side (the contextToken is the dedupe identity the target keeps); these
  // ports submit and propagate rejections — a rejected delivery maps to
  // creation-failed and the caller retries.
  //
  // The target is a team root of THIS row's domain (there is no second Team
  // runtime): it is not this row's boot root, so the shared setup resolves
  // its leader identity + consumption under its OWN root (the teamRootSid
  // threaded through) and its cwd comes from its own durable TeamSession
  // row.
  //
  /**
   * The effective workspace of one team root (T12-GLUE; never DSH_HOME,
   * T12-M1): the durable TeamSession row's defaultWorkspace — the value the
   * B6 bindFresh persisted for the handoff team — with the row config's
   * defaultWorkspace as the fallback (the boot root's M1 contract).
   * @param {string} rootSessionId
   * @returns {string}
   */
  function effectiveRootWorkspace(rootSessionId) {
    const row =
      domain.repositories.teamSessions !== undefined
        ? domain.repositories.teamSessions.get(rootSessionId)
        : undefined
    if (row !== undefined && typeof row.defaultWorkspace === 'string' && row.defaultWorkspace !== '') {
      return row.defaultWorkspace
    }
    return config.defaultWorkspace
  }

  /**
   * Start (or re-attach) the REAL DSH Agent for one team root of this row's
   * domain — the B6 handoff target (create-or-ensure, idempotent per root
   * session id). The freshly-minted handoff root has no DSH session
   * artifact yet (bindFresh writes the durable TEAM rows, not the session
   * log) — so the fresh path is agents.create on the root session id,
   * exactly the boot 'create' shape: meta.cwd = the root's effective
   * workspace (never DSH_HOME) and the shared setup — the leader's durable
   * model selection, the team tools, and the root's persona (M2) — all
   * installed before the first prompt assembly. A root whose session
   * artifact IS durable (a restart between a failed start and the B6
   * retry) re-attaches through agents.resume with the same setup. The
   * public persistence seam materializes the fresh session immediately (the
   * boot create does the same), so the started root is durable at once.
   * @param {string} rootSessionId
   * @returns {Promise<void>}
   */
  async function createRootAgent(rootSessionId) {
    const sid = String(rootSessionId)
    if (sid === '') {
      throw new Error('agent-bindings: createRootAgent requires a non-empty rootSessionId')
    }
    const live = liveAgents.get(sid)
    if (live !== undefined) return // create-or-ensure: the agent already runs
    let handle
    // C1 (guide §6.2/§5.2): both branches go through the ownership-guarded
    // wrappers (never bare agents.create/resume); durability is the public
    // seam (no physical probe).
    if (await durableSessionExists(sid)) {
      resumingSessions.add(sid)
      try {
        handle = await resumeTeamAgent({
          sessionId: sid,
          setup: agentSetup(sid, undefined, undefined, 'cold-root', sid),
        })
      } finally {
        resumingSessions.delete(sid)
      }
    } else {
      handle = await createTeamAgent({
        sessionId: sid,
        meta: { cwd: effectiveRootWorkspace(sid) },
        setup: agentSetup(sid, undefined, undefined, 'fresh-root', sid),
      })
    }
    liveAgents.set(sid, handle)
    await sessionPersistence.ensureMaterialized(handle.agent.session)
  }

  // The Root (Leader) input delivery ports now live in `root-delivery.mjs` (extracted verbatim):
  // the ONE shared real-input path plus the B6 context, the TCM-M3 initial work and the C1 control
  // notification callers. The completion notification stays in this closure (it reads `closing`).
  const {
    deliverRootInput,
    deliverRootContext,
    deliverRootWork,
    deliverRootControlNotification,
  } = createRootDelivery({ ensureLiveAgent, prepareAgentForRequest, sessionPersistence, machineInputs })

  /**
   * Work-completion wake-up (async work completion → Leader wakeup) —
   * deliver ONE best-effort completion notification to the Root (Leader)
   * Agent as a NEWLY-CREATED model-visible input turn. A DELIBERATELY
   * SEPARATE primitive from the C1 `deliverRootControlNotification` /
   * `deliverRootInput` path (plan §15/§16/§19):
   *
   *   - the C1/root-input path awaits `whenIdle` + materializes AFTER the
   *     delivery (its callers — work delivery, Root initial work, the
   *     control notifier — own the turn's completion as part of their
   *     own flow);
   *   - THIS path's success boundary is the followup/steer ACCEPTANCE
   *     only (plan §16): it does NOT await `whenIdle` and does NOT
   *     `ensureMaterialized` as a success condition (the inbox splice is
   *     itself durable — the upstream Agent records the normalized
   *     pending input in the session log; awaiting the turn here would
   *     block the observer behind the Leader's whole wake-up turn and
   *     re-introduce the liveness coupling this mechanism removes).
   *
   * Wake-up semantics are the DSH v0.1.5-rc.2 Agent's own (plan §17 —
   * no Team-side state machine, no extra lock): `status === 'idle'` →
   * `followup` (starts a new turn; the idle Leader is woken); otherwise
   * `steer` (joins the current turn at the next step boundary — the
   * WAKING send: if the turn is retiring/aborted-converging at that
   * moment, its waking semantics still wake an idle Leader rather than
   * leaving the notification stranded in the inbox; liveness over the
   * narrow abort window).
   *
   * Stop semantics (frozen for this Alpha): a user Stop terminates the
   * CURRENT Leader turn. A later asynchronous Team event may legitimately
   * activate the Leader again — every Team-originated activation carries
   * a stable model-visible provenance envelope (here: the
   * `[team-work-settled requestToken=<token>]` leading line; siblings:
   * `[team-control requestId=<id>]` for approvals, `[team-relay...]` for
   * member relay) so the Leader can tell WHY it resumed. This version
   * deliberately does NOT freeze strong/weak Stop-priority.
   *
   * The wake is an at-most-once best-effort ATTEMPT (no redelivery, no
   * ledger, no retry): the durable settlement fact + `team_collect` are
   * the authority and the recovery path when no wake arrives or it
   * arrives late.
   *
   * NON-AUTHORITY by construction: the glue writes no TeamDomain state
   * and carries no result — the text is pre-rendered (the
   * work-completion-notification module's deterministic
   * `[team-work-settled requestToken=<token>]`-leading metadata) and the
   * durable settlement fact + `team_collect` stay the authority. A
   * rejection PROPAGATES to the caller (the router observer swallows it
   * as a liveness failure — plan §13). close lifecycle: once close()
   * has announced, this delivery REJECTS at its send boundaries (entry
   * and post-resume) and never creates/resumes/wakes a Leader behind
   * the close (the resume path enforces the same gate, entry +
   * post-resume).
   * @param {{rootSessionId: string, text: string}} input
   * @returns {Promise<void>}
   */
  async function deliverRootWorkCompletionNotification(input) {
    const sid = String(input?.rootSessionId ?? '')
    const text = String(input?.text ?? '')
    if (sid === '') {
      throw new Error('agent-bindings: deliverRootWorkCompletionNotification requires a non-empty rootSessionId')
    }
    if (text === '') {
      throw new Error('agent-bindings: deliverRootWorkCompletionNotification requires a non-empty text (the token-leading notification)')
    }
    // close lifecycle gate (send boundary, entry): once close() has
    // started, no new model-visible input may be appended to a Leader
    // whose teardown is under way. The rejection PROPAGATES (the router
    // observer swallows it as a best-effort liveness failure) — the
    // durable settlement fact is untouched either way.
    if (closing) {
      throw new Error('agent-bindings: live bindings are closing — work-completion wake dropped (best-effort)')
    }
    // A not-live-but-durable Leader is resumed first (the same resolver
    // every other input path uses; it enforces the closing gate itself,
    // entry AND post-resume); a session that is neither live nor durable
    // has no agent to run on (typed throw, below).
    const handle = await ensureLiveAgent(sid)
    // The target root IS the team root of its own team — the request
    // boundary resolves under that root's durable truth (same rule as
    // the shared deliverRootInput).
    await prepareAgentForRequest(sid, sid)
    // close lifecycle gate (send boundary, post-await): ensureLiveAgent
    // and prepareAgentForRequest each cross an async boundary; if close()
    // began in that window the send is dropped (the handle itself is the
    // glue's concern — ensureLiveAgent already guards its lifecycle).
    if (closing) {
      throw new Error('agent-bindings: live bindings began closing before the work-completion wake — dropped (best-effort)')
    }
    // Plugin-attributed user-visible input carrying this plugin's OWN
    // producer kind (Session Format v4 / DSH 0.1.7 retires the shared
    // `kind: 'plugin'` wrapper — v4 admission rejects it with
    // 'format v4 message requires a producer-owned source kind').
    // `plugin:dsh-agent-team` is the exact kind the official v3→v4
    // migration maps the historical wrapper rows to, so legacy Session
    // history and newly-created wakes share one producer identity.
    // Distinct from the `kind: 'user'` human-input attribution the
    // delegate work path uses: this turn is a runtime event, not a
    // human message.
    const message = createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: 'plugin:dsh-agent-team' },
    })
    // DSH v0.1.5-rc.2 Agent semantics (plan §17): idle Leader →
    // `followup` (a NEW turn — the idle Leader is woken); busy Leader →
    // `steer` (the WAKING next-step send — `send(input, 'next-step',
    // true)`; if the turn is retiring at that moment it still wakes an
    // idle Leader rather than leaving the notification stranded in the
    // inbox — liveness over the narrow abort window; this version does
    // NOT freeze strong Stop-priority, and the leading
    // `[team-work-settled requestToken=...]` envelope tells the Leader
    // why it was activated).
    if (handle.agent.status === 'idle') {
      handle.agent.followup(message)
    } else {
      handle.agent.steer(message)
    }
    // Success boundary = acceptance (plan §16): NO whenIdle, NO
    // ensureMaterialized. The turn (if any) runs on its own.
  }

  /**
   * A6-PR4 — deliver ONE generic Review Wake to the review recipient's
   * session inbox (the PR4 delivery slice's real Host seam). The caller has
   * already resolved the recipient to a live/durable session (PR6 owns that
   * mapping: Leader root or Officer child). Semantics are the same as the
   * work-completion wake: idle -> followup, busy -> steer, success boundary
   * = inbox acceptance, NO whenIdle/ensureMaterialized. Non-authority: the
   * text is pre-rendered and the durable case ledger remains the authority.
   * A rejection PROPAGATES: the wake coordinator's `delivery-failed`
   * transition releases `queued`.
   * @param {{rootSessionId: string, targetSessionId: string, wakeId: string, text: string}} input
   * @returns {Promise<void>}
   */
  /**
   * Alpha.6 — the native-Inbox truth for ONE recipient session. `has` reads
   * the LIVE pending lists only (never materializes an agent), matching the
   * wakeId inside the rendered text; `remove` withdraws that exact message.
   * @param {string} targetSessionId
   * @returns {{ has: (wakeId: string) => boolean, remove: (wakeId: string) => boolean }}
   */
  function reviewWakeInbox(targetSessionId) {
    const sid = String(targetSessionId)
    const handle = async () => {
      const existing = liveAgents.get(sid)
      if (existing !== undefined) return existing
      try {
        // Boot recovery runs before the recipient handle exists; materialising
        // its durable session is what makes the native Inbox readable at all.
        return await ensureLiveAgent(sid)
      } catch {
        return undefined
      }
    }
    const pending = async () => {
      const live = await handle()
      if (live === undefined) return []
      return [...live.agent.inbox.nextTurn, ...live.agent.inbox.nextStep]
    }
    const matches = (message, wakeId) => {
      const content = Array.isArray(message?.content) ? message.content : []
      return content.some(
        (part) => part?.type === 'text' && typeof part.text === 'string' && part.text.includes(wakeId),
      )
    }
    return {
      async has(wakeId) {
        const live = await handle()
        if (live === undefined) {
          // An unreadable Inbox is NOT evidence of absence. Callers must keep
          // the queued row and retry rather than release + duplicate.
          throw new Error('the native Inbox is unreadable for this session')
        }
        const messages = [...live.agent.inbox.nextTurn, ...live.agent.inbox.nextStep]
        return messages.some((message) => matches(message, String(wakeId)))
      },
      async remove(wakeId) {
        const live = await handle()
        if (live === undefined) {
          // Same contract as `has`: unreadable is not evidence the message is
          // gone. Keep the intent instead of reporting a refusal that the
          // caller would mistake for an absent message.
          throw new Error('the native Inbox is unreadable for this session')
        }
        const message = (await pending()).find((entry) => matches(entry, String(wakeId)))
        if (message === undefined) return false
        return live.agent.inbox.remove(message.id)
      },
    }
  }

  /**
   * ROUND 84 — THE REVIEW WAKE IS A DELIVERY, NOT A BESPOKE followup/steer.
   *
   * The old body resolved the live agent itself and wrote a hand-built message, which meant the wake
   * skipped everything round 83 built for `member.send`: the durable delivery intent fact, the
   * correlation token, the requirement-aware final-input verdict (`prepareAgentForRequest`), the A56
   * machine-attribution ledger (a machine input must never clear a human Sticky Stop), and the
   * confirmation fact. A review wake is INPUT to the Officer's own session, so it is delivered by the
   * SAME mechanism — `createReviewWakeDelivery` over THIS row's own TeamDomain ledger and the P6-T3
   * `SessionInputPort`. The Officer's own turn then runs its own tools under its own binding.
   *
   * `targetSessionId` stays in the seam signature (it is the routed reviewer's session the notifier
   * resolved) and is checked against the durable Member row of `rootSessionId`: a wake is never
   * delivered to a session that is not that Member's bound child session.
   *
   * @param {{rootSessionId: string, targetSessionId: string, wakeId: string, text: string,
   *   recipientInstanceId?: string, requestId?: string, requesterInstanceId?: string}} input
   * @returns {Promise<void>}
   */
  async function deliverReviewWake(input) {
    const rootSessionId = String(input?.rootSessionId ?? '')
    const targetSessionId = String(input?.targetSessionId ?? '')
    const wakeId = String(input?.wakeId ?? '')
    const text = String(input?.text ?? '')
    if (rootSessionId === '') {
      throw new Error('agent-bindings: deliverReviewWake requires a non-empty rootSessionId')
    }
    if (targetSessionId === '') {
      throw new Error('agent-bindings: deliverReviewWake requires a non-empty targetSessionId')
    }
    if (wakeId === '') {
      throw new Error('agent-bindings: deliverReviewWake requires a non-empty wakeId (the token-leading hint)')
    }
    if (text === '') {
      throw new Error('agent-bindings: deliverReviewWake requires a non-empty text')
    }
    if (closing) {
      throw new Error('agent-bindings: live bindings are closing — review wake dropped (best-effort)')
    }
    const recipientInstanceId = String(input?.recipientInstanceId ?? '')
      || String(domain.repositories.memberInstances.list(rootSessionId)
        .find((member) => String(member.childSessionId ?? '') === targetSessionId)?.instanceId ?? '')
    if (recipientInstanceId === '') {
      throw new Error(
        `agent-bindings: deliverReviewWake has no Member row of '${rootSessionId}' bound to session '${targetSessionId}' — a review wake is never delivered to an invented recipient`,
      )
    }
    const delivered = await reviewWakePort().deliver({
      rootSessionId,
      wakeId,
      requestId: String(input?.requestId ?? wakeId),
      recipientInstanceId,
      text,
      ...(String(input?.requesterInstanceId ?? '') === '' ? {} : { requesterInstanceId: String(input.requesterInstanceId) }),
    })
    // The seam's contract is "the wake is accepted by the recipient session"; a duplicate (already
    // confirmed) is a successful no-op, exactly like a replayed `member.send`.
    if (delivered.duplicate === true) return
    if (delivered.targetSessionId !== targetSessionId) {
      throw new Error(
        `agent-bindings: deliverReviewWake delivered to '${delivered.targetSessionId}', not the routed session '${targetSessionId}'`,
      )
    }
    if (closing) {
      throw new Error('agent-bindings: live bindings began closing before the review wake — dropped (best-effort)')
    }
  }

  // The P7-T3 lifecycle bindings over the REAL production surfaces - interrupt (with the PD-29 goal
  // withdrawal), the recursive descendant drain, and the live-residency port - now live in
  // `stop-drain-lane.mjs` (extracted verbatim).
  const {
    interrupt,
    drainDescendants,
    residency,
  } = createStopDrainLane({ domain, rootSid, childSessionIdFor, liveAgents, observations, deps })

  // D1 (v2): the typed fail-closed error for a member setup that cannot
  // mount its ordinary preset substrate (the agentPresets service absent or
  // unusable). Carries code 'member-base-tools-unavailable'; the rejection
  // propagates out of the AgentSetup callback, which rolls the unpublished
  // agent back (the AgentSetup contract) — a member never runs without its
  // base tools (the D1 defect), and the production host's lazy accessor
  // fails with the same stability for a service-less composition (a
  // TeamPluginError surfaced through the same setup rejection).
  function memberBaseToolsUnavailable(sessionId, reason) {
    const error = new Error(`agent-bindings: member base tools unavailable for '${sessionId}': ${reason} (code: member-base-tools-unavailable)`)
    error.code = 'member-base-tools-unavailable'
    observations.push(`p6t6: member-base-tools-unavailable for ${sessionId}: ${reason}`)
    return error
  }

  // D1 (v3): the typed fail-closed error for a ROOT (leader) setup that
  // cannot mount its ordinary preset substrate (the agentPresets service
  // absent or unusable). Carries code 'root-base-tools-unavailable'; the
  // rejection propagates out of the AgentSetup callback, which rolls the
  // unpublished agent back (the AgentSetup contract) — the leader never
  // runs without its base tools (the D1 v3 extension: a plugin-created
  // root otherwise has no base tools and the leader file lanes are
  // unreachable — plan §13-L4 / §12.3; the ruling cites D1 v2 + plan
  // L4/§12.3). Zero partial state: the boot rejection lands at the FIRST
  // setup (the root), before any member is created.
  function rootBaseToolsUnavailable(sessionId, reason) {
    const error = new Error(`agent-bindings: root base tools unavailable for '${sessionId}': ${reason} (code: root-base-tools-unavailable)`)
    error.code = 'root-base-tools-unavailable'
    observations.push(`p6t6: root-base-tools-unavailable for ${sessionId}: ${reason}`)
    return error
  }

  // SD-CALLER: the tool layer only LOOKS UP the caller identity from the
  // durable domain; the runtime re-validates it on every call.
  //
  // P0 (caller-root binding): the lookup ALSO returns the session's
  // OWNING team root. The tool layer enforces owning-root == requested
  // root before any downstream effect: every Team's leader resolves to
  // the shared `inst-leader` identity, so without the root in this
  // answer a Leader of Team A addressing root B would be re-validated
  // against Team B's rows as Team B's leader (the pending-list +
  // resolve-control cross-team chain).
  const resolveCaller = async (sessionId) => {
    const sid = String(sessionId)
    // TCM-D4: the caller resolves under the session's OWNING team root from
    // the durable domain (never the boot root by default): a session that
    // is itself a team root of this row's domain (a freshly created
    // TeamSession / team-root binding) is that team's LEADER (inst-leader);
    // a member child resolves under the root whose member list carries it
    // (the boot root's members keep the pre-existing behavior). Unknown
    // sessions fail closed exactly as before.
    const teamRoot = teamRootOfSession(sid)
    if (teamRoot !== undefined && teamRoot === sid) {
      return {
        caller: { kind: 'instance', instanceId: String(LEADER_INSTANCE_ID) },
        rootSessionId: String(teamRoot),
      }
    }
    if (teamRoot !== undefined) {
      for (const member of domain.repositories.memberInstances.list(teamRoot)) {
        if (String(member.childSessionId) === sid) {
          return {
            caller: { kind: 'instance', instanceId: String(member.instanceId) },
            rootSessionId: String(teamRoot),
          }
        }
      }
    }
    throw new Error(`p6t6 caller map: no caller for session ${sessionId}`)
  }

  // ── the live-handle surface (harness routes + root bootstrap) ─────────

  /**
   * The governance authority for the principal session (verbatim from the
   * P6-T6 governance route): the root session is the host-known operator
   * (human overrides); a bound member child is a member (own-instance
   * autonomy overlays only); anything else has no authorized team principal.
   * @param {string} asSessionId
   * @returns {{kind: string, instanceId?: string} | undefined}
   */
  function governanceAuthority(asSessionId) {
    if (asSessionId === rootSid) return { kind: 'operator' }
    const member = domain.repositories.memberInstances
      .list(rootSid)
      .find((m) => String(m.childSessionId) === asSessionId)
    if (member === undefined) return undefined
    return { kind: 'member', instanceId: String(member.instanceId) }
  }

  /**
   * Forget + dispose one live handle with the route-facing result object:
   * absent -> {dropped:false}; present -> delete + await the teardown,
   * surfacing a dispose rejection as disposeError (and an observation).
   * Awaiting the teardown first guarantees no second live agent on the same
   * session when the next execution cold-resumes from the durable log (W7).
   * @param {string} sessionId
   * @returns {Promise<{dropped: boolean, disposeError?: string}>}
   */
  async function dropResidency(sessionId) {
    const sid = String(sessionId)
    const handle = liveAgents.get(sid)
    if (handle === undefined) return { dropped: false } // the handle may be absent: no-op by contract
    // F15 (plan §5.2): a residency drop is a PLUGIN-INITIATED removal —
    // mark every mounted fiber of the session intentional BEFORE the
    // disposal (the agent-scope unwind disposes each MCP fiber inside
    // `handle.dispose()`; the fiber RECORDS survive in the consumption
    // state until the next setup, so a probe racing the drop must not
    // classify the withdrawal as a runtime loss — no telemetry).
    const dropState = consumptionState.get(sid)
    if (dropState !== undefined && dropState !== null) {
      for (const name of dropState.mcpFibers.keys()) dropState.mcpIntentionalRemoval.add(name)
    }
    liveAgents.delete(sid)
    try {
      await handle.dispose()
      return { dropped: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      observations.push(`p6t6: residency dispose failed for '${sid}': ${message}`)
      return { dropped: true, disposeError: message }
    }
  }

  // ── the row-owned tool execution budget (the tool-route internals) ────

  /** A route-facing execution fault: `code` maps to the harness status. */
  function toolRouteError(code, message) {
    return Object.assign(new Error(message), { code })
  }

  /**
   * One registered-tool execution on the agent bound to `sessionId`
   * (ensure-live -> request boundary -> synthetic callId -> the public
   * tools.execute with the row-owned budget). Faults surface as an Error
   * with a `code`: NO_LIVE_AGENT (harness 422), CONSUMPTION_BOUNDARY
   * (harness 500), TOOLS_EXECUTE (harness 500).
   * @param {string} sessionId
   * @param {{name: string, args?: object, callId?: string}} request
   * @returns {Promise<object>} the tools.execute result ({isError, value, error}).
   */
  async function executeTool(sessionId, request) {
    const { name, args, callId } = request
    let handle
    try {
      handle = await ensureLiveAgent(String(sessionId))
    } catch (error) {
      throw toolRouteError('NO_LIVE_AGENT', error instanceof Error ? error.message : String(error))
    }
    // P8-S4B: request boundary — the next real request runs on the
    // durable truth (an in-flight turn on `sessionId` keeps its own snapshot).
    // TCM-D4: under the session's OWNING root (the boot root only when the
    // session belongs to it; a member of another team root — or a team root
    // itself — resolves under its own root's truth).
    try {
      await prepareAgentForRequest(String(sessionId), teamRootOfSession(sessionId))
    } catch (error) {
      throw toolRouteError('CONSUMPTION_BOUNDARY', error instanceof Error ? error.message : String(error))
    }
    callCounter += 1
    const resolvedCallId = ToolCallId(typeof callId === 'string' && callId.length > 0 ? callId : `p6t6-call-${callCounter}`)
    // ADMISSION CLOSE, last moment (row 6): a dispatch ADMITTED before the
    // close (ensureLiveAgent already returned, so the entry check could not
    // see it) must not execute a tool once the quiesce has closed the member —
    // including a dispatch whose own resume completed inside the drop→commit
    // window. `prepareAgentForRequest` above is an await point, so this is
    // checked as late as it can be without splitting tools.execute.
    const lateAdmissionRefusal = admissionCloseRefusal(String(sessionId))
    if (lateAdmissionRefusal !== null) {
      throw toolRouteError('NO_LIVE_AGENT', lateAdmissionRefusal.message)
    }
    try {
      return await handle.agent.ctx.tools.execute({
        callId: resolvedCallId,
        name,
        arguments: args ?? {},
        agent: handle.agent,
        signal: AbortSignal.timeout(TOOL_EXEC_TIMEOUT_MS),
      })
    } catch (error) {
      throw toolRouteError('TOOLS_EXECUTE', `tools.execute failed: ${error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ''}` : String(error)}`)
    }
  }

  // ── row-stop cleanup (idempotent) ──────────────────────────────────────

  /**
   * Dispose every owned side effect (idempotent — the row-stop backstop;
   * safe if the production root also calls it on its own stop): the live
   * agent handles, the tool-registration + model-selection disposers, every
   * mounted mini-MCP fiber (the agent-scope unwind covers each one on
   * disposal as well), and the per-session consumption state. The TeamDomain
   * close stays with the production root.
   * @returns {Promise<void>}
   */
  async function close() {
    // close lifecycle gate: mark closing BEFORE any snapshot/dispose
    // work — from this microtask on, ensureLiveAgent refuses new
    // handles (entry) and disposes late resumes (post-resume re-check),
    // and the completion wake-up delivery refuses to send. Idempotent:
    // a second call is a no-op (the maps are already drained).
    if (closing) return
    closing = true
    for (const [sid, handle] of [...liveAgents]) {
      liveAgents.delete(sid)
      try {
        await handle.dispose()
      } catch (error) {
        observations.push(`p6t6: close: agent dispose failed for '${sid}': ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    // alpha.1: the capability disposers are OBJECTS with a dispose() method
    // (SkillRegistrationDisposer / ToolRestrictionDisposer), while the model
    // selection and team-tool registration disposers are plain functions.
    // Invoke BOTH shapes: calling an object disposer as a function would throw
    // and be silently swallowed, leaving the Team-managed skill registrations
    // (and the deny scope) unwound-never on close.
    // NATIVE MOUNTS FIRST, and this order is the guarantee, not a preference. A mount's dispose()
    // asks the realm to release the native definition and installs the MEMBER_CLOSED tombstone in its
    // place; it needs a living realm, and it must land BEFORE the admission point is disposed and
    // before the realm itself goes away. Otherwise there is a window in which the inherited preset
    // definition resolves and no admission decision is consulted.
    for (const disposeMount of nativeMountDisposers.splice(0)) {
      try {
        await disposeMount.settled()
      } catch { /* the realm disposal below still unmounts the providers */ }
    }
    for (const d of toolDisposers.splice(0)) {
      try {
        if (typeof d === 'function') d()
        else if (d !== null && typeof d === 'object' && typeof d.dispose === 'function') d.dispose()
      } catch { /* the scope unwind covers it */ }
    }
    for (const disposeRealm of a5sfRealmDisposers.splice(0)) {
      await disposeRealm.settled()
    }
    // T12-M2: the persona scope — dispose every agent-scoped
    // 'deployment:persona' entry (exactly the scoped sections; the global
    // prompt layer is never touched) and clear the persona surface state.
    for (const dispose of [...personaDisposers.values()]) {
      try { dispose() } catch { /* the scope unwind covers it */ }
    }
    personaDisposers.clear()
    personaPending.clear()
    liveAgentCtxs.clear()
    for (const state of consumptionState.values()) {
      // multi-mcp (contract I4): every session may hold several mini-MCP
      // fibers (one per mounted server) — dispose ALL of them, in every
      // session's state, before the maps are cleared with the state.
      // F15 (plan §5.2): row teardown is a PLUGIN-INITIATED removal —
      // mark every mounted fiber intentional BEFORE the disposals (a
      // probe racing the close window must not emit runtime loss
      // telemetry for the row stop).
      for (const name of state.mcpFibers.keys()) state.mcpIntentionalRemoval.add(name)
      for (const fiber of [...state.mcpFibers.values()]) {
        try { fiber.dispose() } catch { /* the scope unwind covers it */ }
      }
      state.mcpFibers.clear()
      state.mcpActivationErrors.clear()
      // pre-alpha3 PR-C §C.6: the ephemeral materialization slots drop with
      // the state (a row-stop never persists a fabricated failure).
      state.mcpMaterialization.clear()
      // Finding 1 bridge (plan §6): the per-agent MCP scope fiber (a child
      // of the agent's ctx — the agent disposal already unwinds it, this
      // is the deterministic belt for a state outliving its agent).
      const mcpMountScope = state.mcpMountScope
      if (mcpMountScope !== undefined) {
        try { await mcpMountScope.dispose() } catch { /* the scope unwind covers it */ }
        state.mcpMountScope = undefined
      }
    }
    consumptionState.clear()
  }

  return {
    // the harness observability surface (the production host exposes this
    // whole bundle as the teamRoot.live field)
    listLiveSessions: () => [...liveAgents.keys()].sort(),
    hasLive: (sessionId) => liveAgents.has(String(sessionId)),
    isResuming: (sessionId) => resumingSessions.has(String(sessionId)),
    // alpha.3 PR5 (final splice + ROOT BLOCK-2 fix): the SYNCHRONOUS
    // permission-notice RECEIPT POINT the production root's awareness
    // emitter binds. READ-ONLY facts only — the closing fact + the CURRENT
    // owned live handle for the EXACT addressed (team, member) pair.
    // Nothing here can create, resume, materialize or adopt an Agent:
    // `ensureLiveAgent` is deliberately NOT referenced; a cold or absent
    // member reads `undefined` and STAYS COLD (awareness never wakes).
    // The pair→session key comes from the DURABLE rows: a member pair
    // through its OWN MemberInstance row (whose `childSessionId` is
    // verbatim the key the registrant used — boot seeds and re-binds both
    // key liveAgents by that durable/config value, never a re-derivation);
    // a LEADER pair through the durable TeamSession row (the root handle
    // is registered AT the team session id; the v2 leader record binds no
    // child). The returned identity is always derived FROM the durable
    // facts, never echoed from the request, and an ambiguous reverse
    // binding is refused outright.
    permissionNoticeReceipt: Object.freeze({
      closing: () => closing === true,
      liveHandle: (identity) => {
        const teamSessionId = identity?.teamSessionId
        const memberInstanceId = identity?.memberInstanceId
        if (typeof teamSessionId !== 'string' || typeof memberInstanceId !== 'string') {
          return undefined
        }
        // DURABLE lookup, never a re-derivation (ROOT BLOCK-2 fix law): a
        // pair with no durable row, a typed-absent child binding, or no
        // owned live entry reads `undefined` (fail closed — there is NO
        // derived-id fallback: a guess would be a bypass, not a fallback).
        const members = domain.repositories.memberInstances.list(teamSessionId)
        if (String(memberInstanceId) === String(LEADER_INSTANCE_ID)) {
          // LEADER pair (ROOT BLOCK-3 fix): the Leader IS the Root Session
          // (v2 record union — a leader row NEVER carries the child/life-
          // cycle keys, Architecture §9.2) and the boot path registers the
          // root handle AT the team session id itself. So the pair's key
          // IS the team session id — read back FROM the durable TeamSession
          // row (below), never from the request echo, and never through a
          // faked child/lifecycle key. Attribution is proven from the real
          // durable identity: the addressed TeamSession row must exist and
          // the durable leader row must be present in the same table. A
          // team without those facts, or a root handle that is not
          // currently registered, reads `undefined` — a cold root stays
          // exactly as cold as it was.
          const teamRow =
            domain.repositories.teamSessions !== undefined
              ? domain.repositories.teamSessions.get(teamSessionId)
              : undefined
          if (teamRow === undefined || teamRow === null) return undefined
          const leaderRows = members.filter(
            (m) => String(m.instanceId) === String(LEADER_INSTANCE_ID),
          )
          if (leaderRows.length !== 1) return undefined
          const leaderRow = leaderRows[0]
          const key = String(teamRow.rootSessionId)
          const rootHandle = liveAgents.get(key)
          if (rootHandle === undefined || rootHandle.agent === undefined) return undefined
          return Object.freeze({
            teamSessionId: String(teamRow.rootSessionId),
            memberInstanceId: String(leaderRow.instanceId),
            agent: rootHandle.agent,
          })
        }
        const targetRows = members.filter((m) => String(m.instanceId) === memberInstanceId)
        if (targetRows.length !== 1) return undefined
        const row = targetRows[0]
        const key = row.childSessionId
        if (typeof key !== 'string' || key.length === 0) return undefined
        const handle = liveAgents.get(key)
        if (handle === undefined || handle.agent === undefined) return undefined
        // Ownership proof derived FROM the durable facts: the TRUE owner of
        // the handle found is the row (the ONE row) whose childSessionId
        // BINDS this key (the reverse mapping — the same durable relation
        // the boot and persona paths trust). ROOT BLOCK-4 fix: a corrupted
        // table where MORE THAN ONE instance binds the same key is
        // ambiguous — it is REFUSED outright (never a first-match winner,
        // in either list order, even when the requesting pair is one of
        // the claimants: a corrupted binding is not a delivery target).
        // No provable single owner -> `undefined`.
        const ownerRows = members.filter((m) => String(m.childSessionId) === key)
        if (ownerRows.length !== 1) return undefined
        const ownerRow = ownerRows[0]
        return Object.freeze({
          teamSessionId: String(ownerRow.rootSessionId),
          memberInstanceId: String(ownerRow.instanceId),
          agent: handle.agent,
        })
      },
    }),
    ensureLiveAgent,
    prepareAgentForRequest,
    executeTool,
    getConsumptionState: (sessionId) => consumptionState.get(String(sessionId)),
    resolveConsumptionViews,
    // pre-alpha3 PR-C §C.6: the manual recheck seam — clears a session's
    // FAILED MCP materialization slots so the next boundary re-attempts those
    // servers (ignoring the retry cooldown). Non-authority: it only schedules
    // re-probes; the durable decision is the mcp facet. Mounted servers are
    // unaffected (they live in `mcpFibers`, not the materialization map).
    recheckMcpServers: (sessionId) => {
      const state = consumptionState.get(String(sessionId))
      if (state === undefined) return false
      for (const name of [...state.mcpMaterialization.keys()]) {
        const slot = state.mcpMaterialization.get(name)
        if (slot !== undefined && slot.status === 'failed') state.mcpMaterialization.delete(name)
      }
      return true
    },
    observations,
    governanceAuthority,
    dropResidency,
    close,
    // F15 (MCP live-loss, plan §5/§6/§7): the public operational
    // witness — the production readiness probe port's authority (the
    // boundary pull-probe over the public tool surface; `tools/change`
    // is never a classifier). Per session: reads the server's live
    // public tool surface, updates the ephemeral witness, and
    // classifies — a confirmed loss (fiber present + previously
    // tool-bearing + surface withdrawn + still policy-targeted)
    // retires the exhausted fiber exactly once (idempotent) and
    // reports `unreachable` + `confirmedLoss`; plugin-initiated
    // removals and zero-tool servers degrade to `unknown` (no
    // telemetry, no retirement). Unknown for an absent session.
    observeMcpOperationalWitness: (sessionId, serverName) => {
      const state = consumptionState.get(String(sessionId))
      if (state === undefined || state === null) {
        return Promise.resolve({ verdict: 'unknown', reason: MCP_REASON_LIVE_WITNESS_UNAVAILABLE })
      }
      return observeMcpOperationalWitness(state, String(serverName))
    },
    // the provider-facing ports (verbatim port)
    childFactory,
    sessionDurability,
    surface,
    sessionInput,
    workDelivery,
    interrupt,
    drainDescendants,
    residency,
    // The per-member admission close (the lifecycle `AdmissionClosePort`
    // production binding). `ensureLiveAgent` / `executeTool` consult it; the
    // lifecycle procedure reopens it on every exit.
    closeAdmission,
    reopenAdmission,
    resolveCaller,
    // additive: the production root bootstrap
    boot,
    agentSetup,
    rootSessionId: rootSid,
    // additive (T12-B2): the deterministic child-id derivation
    childSessionIdFor,
    // additive (T12-M2): the REAL scoped-prompt persona surface
    personaSurface,
    // additive (T12-GLUE): the handoff Root Agent ports (B6's
    // createAndStartTeam drives them; a bundle without them fails closed
    // with TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE before any durable effect)
    createRootAgent,
    deliverRootContext,
    // additive (TCM-M3): the creation-time Root initial work delivery
    // (the Root initial-work strategy's live adapter; the durable
    // replay/retry side is the strategy's own — the glue only submits)
    deliverRootWork,
    // additive (C1): the control-plane Leader liveness notification
    // delivery (non-authority — the durable control row +
    // team_resolve_control stay the authority; a delivery failure is a
    // liveness failure only, never a request-path failure)
    deliverRootControlNotification,
    // additive (work-completion wake-up): the async work-completion
    // notification delivery to the Leader root (idle → followup /
    // running → steer; success boundary = acceptance; non-authority —
    // the durable settlement fact + team_collect stay the authority; a
    // delivery failure is a liveness failure only, swallowed by the
    // router's completion observer)
    deliverRootWorkCompletionNotification,
    // additive (A6-PR4): the generic Review Wake inbox delivery. The caller
    // resolves the recipient session; idle -> followup, busy -> steer, and a
    // rejection releases the coordinator's queued latch.
    deliverReviewWake,
    reviewWakeInbox,
    // additive (A56-SEMANTICS): the input-provenance arbiter port. The Host's
    // Alpha.6 Sticky Stop resume arbour asks THIS (the producer) whether a
    // claimed inbox message was a Team delivery, because a work delivery
    // necessarily carries the human `kind: 'user'` attribution that the
    // upstream goal authority requires. Text-envelope fallback included, so a
    // message queued across a restart stays classified machine.
    isTeamMachineInput: (sessionId, message) =>
      isHumanInteractionClaim(message, machineInputs, String(sessionId)) === false,
    // additive (A56-SEMANTICS): the pure predicate, exported for the Host
    // wiring's own fallback when this row is absent (a host without the live
    // glue has no Team deliveries, so non-human attribution is the whole law).
    classification: { isTeamMachineInput, isHumanInteractionClaim },
    // additive (C1 restart-recovery, guide §10.1): the one-shot ordinary
    // activation permit passthrough — the production root's S6
    // `prepareOrdinaryOpen` handler arms it (process-local, single-use,
    // TTL-bounded, consumed at agent/created — NEVER at this call).
    // Absent when the world has no fence (the handler then fails closed
    // with the typed port-unavailable code).
    allowOrdinaryActivationOnce:
      activationFence !== undefined && typeof activationFence.permitOrdinaryOnce === 'function'
        ? (rootSessionId) => activationFence.permitOrdinaryOnce(String(rootSessionId))
        : undefined,
  }
}
