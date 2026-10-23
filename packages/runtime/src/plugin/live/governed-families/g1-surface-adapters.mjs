/**
 * governed-families/g1-surface-adapters.mjs — A5-M2 module group G1 (root
 * 706fd FINAL RULING round + 89a9 P1 round, rev.6): the captured-native-
 * delegate adapter
 * rows for the 14 records of families B-CONTROL / B-HUMAN / B-PRESENT /
 * B-PLUGIN / B-INSPECT / B-SKILL / B-DEPENDENCY / B-DOMAIN
 * (frozen dispatch index M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json, records
 * 24, 25, 49–54, 83–85, 87, 88, 91; family law M0-B-FAMILY-TARGET-CONTRACTS.md
 * §3). NARROW REAL-TOOL UNITS (no generic whole-group wrapper loops); KEEP
 * the closed work (pre-abort refusal, optional face params, the retired fake
 * success, manager async contract, CURRENT-facts re-verify, inspect list
 * topology filter, present witness); UNWIRED by ruling. The 89a9 P1 unit:
 * the policy scope passes through EXACTLY as the host computes it (L5) —
 * the real Session is an OBJECT and rides BY REFERENCE; and the dependency
 * arm records its reused-path residual gaps instead of letting the
 * 'controlledInstall' name imply a closed family contract.
 *
 * ── NATIVE-FACE LEDGER (comment-side ONLY: a string literal IS an edge to
 * the audit, so these path facts never live in values) ─────────────────────
 * skill                        HOST pkg dsh-tool-skill, tool-skill/src/index.ts: register @:161 of defineTool @:81; body ctx.skills.list/get(lookup) + isModelInvocable gates :138/:145
 * load_workspace_dependencies  HOST pkg dsh-tool-workspace-dependencies, skill/tool-workspace-dependencies/src/index.ts: register @:249; the CONTROLLED install/verify path is the EXPORTED installPrimaryRuntime(source, root) @:204 (compatibleManifest platform/arch gate + staging copy + validatePayloadEntries + rename-commit + previous-slot restore) and the use-in-place sibling resolvePrimaryRuntime @:192 — NOT package-internal. The row's dependency arm therefore FAILS CLOSED (typed refusal, zero fs of its own, zero native entry) until that exported path is MOUNTED as the controlledInstall port, and when mounted it RUNS the real path instead of any double; the row never stages/hashes of its own and never labels an already-executed copy 'BLOCKED' post-hoc
 * ask_user_question            HOST pkg dsh-tool-ask-user, tool-ask-user/src/index.ts: register @:38; body ctx.userQuestions.ask({questions, agent, signal})
 * exit_plan_mode               HOST pkg dsh-plan-mode, plan-mode/src/index.ts: const EXIT_PLAN_MODE @:67, register @:278; body PlanModeController.loggedActive + ctx.get('userQuestions').ask(plan-review)
 * present                      HOST pkg dsh-tool-present, tool-present/src/index.ts: register @:38; body ctx.fs.lstat/resolve/stat + sessionProjections.stateOf(turnBoundary); PATH LEGALITY = the lane's resource grammar with its KINDS: relative locators ride 'workspace', OS-absolute locators (POSIX '/'-rooted, Windows drive) are LEGAL deliverables and ride 'absolute-path' (domain/tool-governance/src/resource.ts parseResourceRef :166; rules :107-123) — refusing all absolute paths would break a real working function; the governance is that out-of-workspace deliverables ride as GOVERNED absolute-path read+meta effects the effect-commit approval lane decides, never a silent allow; relative '..' stays refused; durable commit = the tools/result listener's session.append('deliverables/presented') — the SAME-EXEC append carrying the exec callId and the native result's OWN turn is the commit witness; an arbitrary integer is not
 * plugin_manager               HOST pkg dsh-boot-plugin-manager, plugin-manager/src/tools.ts: register @:19; THE HOST GATE CHAIN every action runs BEFORE any manager touch (:38-44): const policy = ctx.sandboxPolicy.resolve(exec.agent === undefined ? {} : { session: exec.agent.session }); await approveEscalation({ requestedMode:'danger-full-access', effectiveMode: policy.mode, subject:'plugin management operation', justification:'plugin_manager <json args>. Profile changes persist across sessions; installed Host code runs outside the workspace sandbox.' }, { approver: ctx.get('approval'), agent: exec.agent, callId: exec.callId, toolName:'plugin_manager', signal: exec.signal }); exec.signal.throwIfAborted(). approveEscalation is a PUBLIC export (packages/sandbox/sandbox: src/escalation.ts:171-205, lib export list index.js:289): effective-mode repeat returns without approval; non-strictly-wider targets, missing approver/agent, and every non-grant outcome THROW before execution. The row therefore mounts the REAL exported adjudicator plus the two tool-ctx ingredients it cannot reach itself (ctx.sandboxPolicy, ctx.get('approval')) — the precise seam list, not an invented requireApproval channel. Post-await the row re-checks the signal (the throwIfAborted mirror) and the CURRENT profile facts before ANY manager entry. Tool face params (tools.ts:22-31): action,target,enabled,runtimeVersion,acceptRisk,approvedBuilds,registry,offset,limit — offset/limit REAL on the list actions, validated @:66-69; entry-set/remove targets are package names — '@scope/pkg' is a LEGAL entry name (npm grammar); set_version_exemption targets must be manifest package-name@version (tools.ts:47-52 + face doc); install spec may be an npm name (incl. @scope/pkg) or a LOCAL PATH RELATIVE to the invocation dir (index.ts:458 doc); MANAGER ASYNC CONTRACT (src/index.ts, src/types.ts @ 639ed01539): installBundle(spec, InstallBundleOptions) @:462 with CALLER-supplied options.requestId (:463-466; types.ts:144), settled installs deleted @:566, waitForInstall @:570-576 ("null establishes neither success nor cancellation"), cancelInstall @:585-593 AWAITED to PluginInstallCancellation {status:'cancelled'|'too-late'|'not-running'} (types.ts:208-210). Settle is OBSERVED BY A LISTENER on the install promise — the row never reads a return it fabricated. GAP reported (tools.ts:80-85): the model tool path supplies no requestId — governed installs mount the manager face directly, gate FIRST.
 * cordis_inspect_list          HOST pkg dsh-tool-cordis, tool-cordis/src/index.ts: register @:22; body ctx.cordisInspect.list() — the REAL list enumerates ALL providers ({platform, id, purpose, methods[]} host-then-client, cordis-host-runner/src/inspect-registry.ts:101-105); this row CONSTRAINS that answer to the CURRENT authorized topology
 * cordis_inspect_query         same file register @:41; body ctx.cordisInspect.query(platform, provider, method, input, agent, signal) over cordis-host-runner/src/inspect-registry.ts
 * team_request_control         LANE face packages/tools/src/tools.ts requestControlSpec :958 — properties rootSessionId, requestToken, kind, targetInstanceId, actionName, toolName(OPTIONAL), summary(OPTIONAL); required EXACTLY the first five (:985)
 * team_resolve_control         same file resolveControlSpec :1015 — note OPTIONAL ('Optional decision note'), required rootSessionId, requestToken, requestId, decision (:1046)
 * team_list_pending_control    same file listPendingControlSpec :1118 — limit OPTIONAL (integer 1..100, default 50; :155-157), required rootSessionId, requestToken (:1130)
 * team_grant_permission        same → permissionSpec('grant'): Leader check, canonicalizeExecIntent/canonicalizeFile, mutatePermission
 * team_revoke_permission       same → permissionSpec('revoke'): reveal-as-expansion gated in the SAME mutation authority (no second ledger)
 * surface:domain_family        NOT a model tool by record design: the mounted Domain port {name, description, decide(request)} consulted AT the effect-commit boundary; the domain-ref effect kind it decides for is domain/tool-governance effects.ts:43,72-113; the kernel has NO public domain-authority registry — that gap is reported, never faked
 * ───────────────────────────────────────────────────────────────────────────
 *
 * ROOT LAWS (706fd ruling; module UNWIRED; the spec is NOT C2 — legs run on
 * the REAL exported host adjudicator/controlled path where they exist and on
 * doubles elsewhere):
 *  L1 REAL EFFECTS per family §3 — never a uniform tool-invoke shell.
 *  L2 TRUSTED TARGETS enter ONLY as the mount-time CONFIG face.
 *  L3 SAME-SOURCE RE-VERIFY AT THE CONSUMPTION EDGE (catalog/topology/
 *     domain-port registry/profile facts/install facts) — a move since
 *     classify refuses the plan typed, zero native entry.
 *  L4 domainAuthorityId is ONLY the mounted-port registry's CURRENT fact.
 *  L5 plugin install = THE REAL HOST GATE CHAIN (tools.ts:38-44): mounted
 *     sandboxPolicy.resolve with the scope computed EXACTLY as the host
 *     computes it — exec.agent === undefined ? {} : { session:
 *     exec.agent.session } — the real Session is an OBJECT and passes
 *     through BY REFERENCE (string-gating the scope silently drops the
 *     session override for every real session; a string-shaped fixture
 *     double masks exactly that defect and is forbidden), the EXPORTED
 *     approveEscalation adjudicator judging {requestedMode, effectiveMode,
 *     subject, justification} over {approver, agent, callId, toolName,
 *     signal} — no invented always-approved channel; a non-grant THROW is a
 *     refusal with zero manager entry; AFTER the await the row re-checks the
 *     signal (throwIfAborted mirror) and the CURRENT facts before the
 *     manager; a PRE-ABORTED signal refuses before the call is admitted;
 *     then the invocation-owned requestId minted before installBundle(spec,
 *     {requestId}), settle OBSERVED BY LISTENER, cancel AWAITED to the
 *     closed PluginInstallCancellation status, and an aborted install never
 *     claims the copying auto-stopped.
 *  L6 present: the SAME-EXEC session append carrying the exec callId AND the
 *     native result's OWN turn is the commit witness.
 *  L7 the delegate runs ONLY the plan its own classify produced, once, with
 *     the plan's frozen arguments.
 *  L8 the inspect pair's target is the CURRENT authorized topology; the list
 *     row CONSTRAINS the real all-providers answer to it.
 *  L9 dependency FAILS CLOSED: without the mounted controlledInstall port
 *     (the EXPORTED installPrimaryRuntime path) the arm refuses typed before
 *     any fs of its own and before native entry — no post-hoc 'BLOCKED'
 *     label over an executed copy; with it mounted the arm RUNS the real
 *     path. NAMING DISCIPLINE (89a9): the reused path copies via fs.cp with
 *     dereference, validates payload entry SHAPES (files/directories), and
 *     rename-commits — that is NOT ControlledFs enforcement, NOT a
 *     full-payload digest check (the manifest's payloadDigest stays
 *     optional), NOT owner-scoped single-flight and NOT cancellable; those
 *     family-contract dimensions stay OPEN and are reported on every result
 *     — the port name never downgrades or closes them.
 *  L10 plugin network spec + FS scope are REAL parse work: the install spec
 *     parses through the npm-name grammar (@scope/pkg[/@version]) or a
 *     relative local path (absolute/drive paths refuse); entry-set/remove
 *     targets are package names (@scope/pkg legal, paths refuse); registry
 *     claims parse through URL with https-only and compare CANONICAL href
 *     against the trusted allow-list envelope.
 *  L11 capture law: absent capture ⇒ typed refusal, zero native entry.
 *
 * Honest boundaries: NO C2 here; the real PA edge, the real append listener,
 * the real tool ctx (sandboxPolicy/approval channel), the real manager and
 * the real product fs are integrator-side — this thin row exposes exactly
 * those seams (exec signal, the hostEscalation port, the controlledInstall
 * port, the append witness, the manager face, the install facts). Windows
 * dimensions: NOT RUN on this Linux harness, never claimed.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g1-surface-adapters
 */
import { createHash, randomUUID } from 'node:crypto'
import { URL } from 'node:url'

import { parseResourceRef } from '../../../../../domain/tool-governance/src/index.js'

export const A5_G1_FAMILY_GROUP = 'G1'
export const A5_G1_ADAPTER_REVISION = 6

const CODES = {
  CAPTURE_ABSENT: 'P_G1_NATIVE_CAPTURE_ABSENT',
  CLASSIFY_INVALID_ARGUMENTS: 'P_G1_CLASSIFY_INVALID_ARGUMENTS',
  CLASSIFY_UNKNOWN_PARAMETER: 'P_G1_CLASSIFY_UNKNOWN_PARAMETER',
  CLASSIFY_MISSING_PARAMETER: 'P_G1_CLASSIFY_MISSING_PARAMETER',
  CLASSIFY_UNKNOWN_ACTION: 'P_G1_CLASSIFY_UNKNOWN_ACTION',
  DEFINITION_DRIFT: 'P_G1_DEFINITION_DRIFT',
  NOT_OWN_PLAN: 'P_G1_NOT_OWN_PLAN',
  ALREADY_DELEGATED: 'P_G1_ALREADY_DELEGATED',
  PRE_ABORTED: 'P_G1_PRE_ABORTED',
  ABORTED_AFTER_GATE: 'P_G1_ABORTED_AFTER_GATE',
  TRUSTED_CATALOG_ABSENT: 'P_G1_TRUSTED_CATALOG_ABSENT',
  SKILL_NAME_NOT_TRUSTED: 'P_G1_SKILL_NAME_NOT_TRUSTED',
  TOPOLOGY_ABSENT: 'P_G1_TRUSTED_TOPOLOGY_ABSENT',
  INSPECT_TARGET_NOT_AUTHORIZED: 'P_G1_INSPECT_TARGET_NOT_AUTHORIZED',
  INSPECT_RESULT_SHAPE_UNKNOWN: 'P_G1_INSPECT_RESULT_SHAPE_UNKNOWN',
  DOMAIN_REGISTRY_ABSENT: 'P_G1_DOMAIN_REGISTRY_ABSENT',
  DOMAIN_CLAIM_MISMATCH: 'P_G1_DOMAIN_CLAIM_MISMATCH',
  TRUSTED_FACTS_STALE: 'P_G1_TRUSTED_FACTS_STALE',
  PLUGIN_TARGETS_ABSENT: 'P_G1_PLUGIN_TARGETS_ABSENT',
  PLUGIN_REGISTRY_NOT_TRUSTED: 'P_G1_PLUGIN_REGISTRY_NOT_TRUSTED',
  PLUGIN_TARGET_NOT_ENVELOPED: 'P_G1_PLUGIN_TARGET_NOT_ENVELOPED',
  HOST_APPROVAL_GATE_ABSENT: 'P_G1_HOST_APPROVAL_GATE_ABSENT',
  HOST_APPROVAL_NOT_GRANTED: 'P_G1_HOST_APPROVAL_NOT_GRANTED',
  INSTALL_FACE_ABSENT: 'P_G1_INSTALL_FACE_ABSENT',
  DEPENDENCY_FACTS_ABSENT: 'P_G1_DEPENDENCY_FACTS_ABSENT',
  DEPENDENCY_ARM_CLOSED: 'P_G1_DEPENDENCY_ARM_CLOSED',
  PRESENT_COMMIT_WITNESS_MISMATCH: 'P_G1_PRESENT_COMMIT_WITNESS_MISMATCH',
}
export const A5_G1_TYPED_CODES = Object.freeze({ ...CODES })

function pluginActionsList() {
  return Object.freeze([
    'list_plugins', 'list_bundles', 'set_plugin', 'set_bundle',
    'install_bundle', 'remove_bundle', 'list_version_exemptions', 'set_version_exemption',
  ])
}
export const A5_G1_PLUGIN_ACTIONS = pluginActionsList()

const NO_PARAMS = Object.freeze({ type: 'object', properties: Object.freeze({}) })
/* Declared face parameters per record — mirroring the REAL faces (plugin:
 * tools.ts:22-31 incl. offset/limit and NO 'bundle'; team optionality per
 * the ledger). An undeclared key is not this record's face. */
function params(...names) {
  return Object.freeze({ type: 'object', properties: Object.freeze(Object.fromEntries(names.map((n) => [n, Object.freeze({})]))) })
}

const TOOL_NAME_BY_INDEX = Object.freeze({
  24: 'skill', 25: 'load_workspace_dependencies', 49: 'ask_user_question', 50: 'exit_plan_mode',
  51: 'present', 52: 'plugin_manager', 53: 'cordis_inspect_list', 54: 'cordis_inspect_query',
  83: 'team_request_control', 84: 'team_resolve_control', 85: 'team_list_pending_control',
  87: 'team_grant_permission', 88: 'team_revoke_permission',
})

const SPEC_TABLE = {
  skill: {
    recordIndex: 24, family: 'B-SKILL', scope: 'host-preset-on', ownerRole: 'SERVICE', capture: 'tool',
    requiredTopLevel: ['name'], parameters: params('name'), nativeFaceRef: 'ledger:skill',
    obligations: Object.freeze([
      Object.freeze({ target: 'skill-catalog-namespace', operation: 'read-load', right: 'read' }),
      Object.freeze({ target: 'current-session-prompt', operation: 'inject', right: 'write' }),
    ]),
    effectDeltaNotes: Object.freeze([
      'I: tool-invoke(skill); the TRUSTED catalog CURRENT facts gate classify AND are re-verified at the consumption edge; a captured snapshot can never justify a later get',
      'S: catalog namespace read/load; the skill content injects into the CURRENT session prompt (session-anchored write obligation)',
    ]),
  },
  load_workspace_dependencies: {
    recordIndex: 25, family: 'B-DEPENDENCY', scope: 'host-sdk-app-env-only', ownerRole: 'PLUGIN', capture: 'tool',
    requiredTopLevel: [], parameters: NO_PARAMS, nativeFaceRef: 'ledger:load_workspace_dependencies',
    effectDeltaNotes: Object.freeze([
      'F: the flow envelope over the trusted install facts: the CONTROLLED installPrimaryRuntime path enumerates the source, gates the manifest (compatibleManifest), stages under the parent, validates the payload entries and rename-commits the root (plus the .previous slot) — every one of these resources is enumerated here',
      'FAIL-CLOSED ARM: the delegate refuses P_G1_DEPENDENCY_ARM_CLOSED (zero fs of its own, zero native entry) until the EXPORTED controlled install/verify path (installPrimaryRuntime, the flow body itself) is mounted as the controlledInstall port; when mounted the REAL path runs — and REUSE ≠ CONTRACT (89a9): its fs.cp-dereference copy + validatePayloadEntries entry-shape checks are not ControlledFs enforcement, not a full-payload digest (payloadDigest optional), no owner single-flight, not cancellable — those dimensions ride every result as residualGap; the row never stages/hashes of its own and never labels an already-executed copy BLOCKED post-hoc',
    ]),
  },
  ask_user_question: {
    recordIndex: 49, family: 'B-HUMAN', scope: 'host-preset-on', ownerRole: 'SERVICE', capture: 'tool',
    requiredTopLevel: ['questions'], parameters: params('questions'), nativeFaceRef: 'ledger:ask_user_question',
    obligations: Object.freeze([Object.freeze({ target: 'owner-session', operation: 'deliver-question-collect-answer', right: 'write' })]),
    effectDeltaNotes: Object.freeze(['I: tool-invoke; S: the ask lands on the trusted session/member target (CONFIG face) and the answer re-enters that owner session']),
  },
  exit_plan_mode: {
    recordIndex: 50, family: 'B-HUMAN', scope: 'host-preset-on', ownerRole: 'SERVICE', capture: 'tool',
    requiredTopLevel: ['plan'], parameters: params('plan'), nativeFaceRef: 'ledger:exit_plan_mode',
    obligations: Object.freeze([
      Object.freeze({ target: 'owner-session', operation: 'deliver-plan-review-collect-answer', right: 'write' }),
      Object.freeze({ target: 'host-plan-mode-approval-channel', operation: 'read-review-outcome', right: 'read' }),
    ]),
    effectDeltaNotes: Object.freeze(['I: tool-invoke; S: the plan reaches the CURRENT session owner as the review/exit-plan obligation (write onto the owner session; the outcome reads back over the Host approval channel)']),
  },
  present: {
    recordIndex: 51, family: 'B-PRESENT', scope: 'host-preset-on', ownerRole: 'SERVICE', capture: 'tool',
    requiredTopLevel: ['files'], parameters: params('files'), nativeFaceRef: 'ledger:present', commitLaw: 'session-append',
    effectDeltaNotes: Object.freeze([
      'F: NOT read-only — reading/metadata is observed over each EXACT deliverable (path legality = the lane resource grammar WITH ITS KINDS: relative → workspace, OS-absolute → absolute-path as a GOVERNED effect the commit approval lane decides — neither an invented blanket-refuse nor a silent allow), and the row carries the expose WRITE obligation (artifact identity/version + visible audience)',
      'commit law: the native promise resolving is NOT the commit; the SAME-EXEC session append (deliverables/presented) carrying the exec callId AND the native result\'s own turn witnesses it; an arbitrary integer is no witness',
    ]),
  },
  plugin_manager: {
    recordIndex: 52, family: 'B-PLUGIN', scope: 'host-preset-conditional', ownerRole: 'PLUGIN', capture: 'tool',
    requiredTopLevel: ['action'],
    parameters: params('action', 'target', 'enabled', 'runtimeVersion', 'acceptRisk', 'approvedBuilds', 'registry', 'offset', 'limit'),
    nativeFaceRef: 'ledger:plugin_manager',
    effectDeltaNotes: Object.freeze([
      'PER-ACTION: each of the 8 actions carries its own closed effects+targets, mapped to the manager code paths under the SAME envelope (profile config path, install root, npm cache, exemptions file, registry allow-list); out-of-envelope targets refuse',
      'HOST GATE FIRST (tools.ts:38-44): the mounted hostEscalation port (the EXPORTED approveEscalation adjudicator + the tool-ctx sandboxPolicy + the ctx.get(\'approval\') channel — the exact seams a row cannot reach itself) judges {requestedMode danger-full-access, effectiveMode, subject, justification} over {approver, agent, callId, toolName, signal}; non-grant outcomes THROW and are refusals with zero manager entry; Team PA never replaces it; the approvedBuilds user-approval chain stays the Host business gate',
      'install: S (query) + F (N registry destinations = the request-or-allowed ones plus the configured fallbacks, connect, REAL URL parse + canonical-href envelope compare) + writes (npm cache, install root, profile package.json) + the script-process envelope + activation; settle observed by LISTENER',
      'install lifecycle: AFTER the awaited gate the signal is re-checked (throwIfAborted mirror) and the CURRENT facts re-verified before the manager; invocation-owned requestId minted BEFORE installBundle(spec, {requestId}); cancelInstall AWAITED to {status: cancelled|too-late|not-running}; PRE-ABORTED signal refuses before the row admits the call (zero startup)',
      'the version-exemption lane is a SEPARATE action+target with a manifest package-name@version target — never derivable from install',
    ]),
  },
  cordis_inspect_list: {
    recordIndex: 53, family: 'B-INSPECT', scope: 'host-preset-cordis-only', ownerRole: 'SERVICE', capture: 'tool',
    requiredTopLevel: [], parameters: NO_PARAMS, nativeFaceRef: 'ledger:cordis_inspect_list',
    obligations: Object.freeze([Object.freeze({ target: 'authorized-inspect-topology', operation: 'enumerate', right: 'read' })]),
    effectDeltaNotes: Object.freeze([
      'the REAL list enumerates ALL providers; this row CONSTRAINS that answer to the CURRENT authorized topology (providers AND per-provider methods filtered; unauthorized entries never appear), re-verified at the consumption edge',
    ]),
  },
  cordis_inspect_query: {
    recordIndex: 54, family: 'B-INSPECT', scope: 'host-preset-cordis-only', ownerRole: 'SERVICE', capture: 'tool',
    requiredTopLevel: ['platform', 'provider', 'method'], parameters: params('platform', 'provider', 'method', 'input'),
    nativeFaceRef: 'ledger:cordis_inspect_query',
    obligations: Object.freeze([Object.freeze({ target: 'authorized-inspect-topology', operation: 'read-one-method', right: 'read' })]),
    effectDeltaNotes: Object.freeze([
      'S: CURRENT authorized topology gates classify AND the consumption edge; claims outside the authorized triples refuse',
      'client queries ride the Client page roundtrip (pending-until-response; host-side cancellation is NOT a transport cancel — law string)',
    ]),
  },
  team_request_control: {
    recordIndex: 83, family: 'B-CONTROL', scope: 'own-layer', ownerRole: 'CONTROL', capture: 'tool',
    requiredTopLevel: ['rootSessionId', 'requestToken', 'kind', 'targetInstanceId', 'actionName'],
    parameters: params('rootSessionId', 'requestToken', 'kind', 'targetInstanceId', 'actionName', 'toolName', 'summary'),
    nativeFaceRef: 'ledger:team_request_control',
    obligations: Object.freeze([Object.freeze({ target: 'team-control-ledger', operation: 'request-control', right: 'write' })]),
    effectDeltaNotes: Object.freeze(['I + S(write) on the team-control ledger (the single authority; no second one exists); toolName/summary OPTIONAL exactly as the lane face declares']),
  },
  team_resolve_control: {
    recordIndex: 84, family: 'B-CONTROL', scope: 'own-layer', ownerRole: 'CONTROL', capture: 'tool',
    requiredTopLevel: ['rootSessionId', 'requestToken', 'requestId', 'decision'],
    parameters: params('rootSessionId', 'requestToken', 'requestId', 'decision', 'note'),
    nativeFaceRef: 'ledger:team_resolve_control',
    obligations: Object.freeze([Object.freeze({ target: 'team-control-ledger', operation: 'resolve-control-or-escalate-leg', right: 'write' })]),
    effectDeltaNotes: Object.freeze(['I + S(write) resolve (approval cases additionally ride the Host escalation leg); note OPTIONAL as the lane face declares']),
  },
  team_list_pending_control: {
    recordIndex: 85, family: 'B-CONTROL', scope: 'own-layer', ownerRole: 'CONTROL', capture: 'tool',
    requiredTopLevel: ['rootSessionId', 'requestToken'],
    parameters: params('rootSessionId', 'requestToken', 'limit'),
    nativeFaceRef: 'ledger:team_list_pending_control',
    obligations: Object.freeze([Object.freeze({ target: 'team-control-ledger', operation: 'read-pending', right: 'read' })]),
    effectDeltaNotes: Object.freeze(['I + S(read) on the same ledger (closed 5/5); limit OPTIONAL integer 1..100 default 50 as the lane face declares']),
  },
  team_grant_permission: {
    recordIndex: 87, family: 'B-CONTROL', scope: 'own-layer', ownerRole: 'CONTROL', capture: 'tool',
    requiredTopLevel: ['rootSessionId', 'requestToken', 'targetInstanceId', 'rules'],
    parameters: params('rootSessionId', 'requestToken', 'targetInstanceId', 'rules'),
    nativeFaceRef: 'ledger:team_grant_permission',
    obligations: Object.freeze([Object.freeze({ target: 'root-permission-authority', operation: 'grant', right: 'write' })]),
    effectDeltaNotes: Object.freeze(['I + S(write) on the root permission authority; rules canonicalize server-side (never pre-classify)']),
  },
  team_revoke_permission: {
    recordIndex: 88, family: 'B-CONTROL', scope: 'own-layer', ownerRole: 'CONTROL', capture: 'tool',
    requiredTopLevel: ['rootSessionId', 'requestToken', 'targetInstanceId', 'rules'],
    parameters: params('rootSessionId', 'requestToken', 'targetInstanceId', 'rules'),
    nativeFaceRef: 'ledger:team_revoke_permission',
    obligations: Object.freeze([Object.freeze({ target: 'root-permission-authority', operation: 'revoke', right: 'write' })]),
    effectDeltaNotes: Object.freeze(['I + S(write); revoked allows can reappear as narrower asks (reveal-as-expansion law)']),
  },
  'surface:domain_family': {
    recordIndex: 91, family: 'B-DOMAIN', scope: 'surface', ownerRole: 'CONNECTOR', capture: 'surface',
    requiredTopLevel: ['toolName', 'domainAuthorityId', 'targetDigest'],
    parameters: params('toolName', 'domainAuthorityId', 'targetDigest'),
    nativeFaceRef: 'ledger:surface:domain_family',
    obligations: Object.freeze([Object.freeze({ target: 'effect-boundary-ledger', operation: 'record-boundary-decision', right: 'write' })]),
    effectDeltaNotes: Object.freeze([
      'the domain-ref effect carries ONLY the TRUSTED domainAuthorityId from the mounted-port registry CURRENT facts (re-verified at the edge); model-supplied ids are claims and mismatch refuses',
    ]),
  },
}

function buildSpec(entry) {
  return Object.freeze({
    recordIndex: entry.recordIndex,
    family: entry.family,
    scope: entry.scope,
    ownerRole: entry.ownerRole,
    capture: entry.capture,
    parametersTopLevel: Object.freeze(entry.parameters.properties === undefined
      ? []
      : Object.keys(entry.parameters.properties)),
    requiredTopLevel: Object.freeze([...entry.requiredTopLevel]),
    parameters: entry.parameters,
    nativeFaceRef: entry.nativeFaceRef,
    ...(entry.commitLaw === undefined ? {} : { commitLaw: entry.commitLaw }),
    ...(entry.obligations === undefined ? {} : { obligations: entry.obligations }),
    effectDeltaNotes: entry.effectDeltaNotes,
  })
}

export const A5_G1_RECORD_SPECS = Object.freeze(
  Object.fromEntries(Object.entries(SPEC_TABLE).map(([name, entry]) => [name, buildSpec(entry)])),
)

export function g1SurfaceAdapterNames() {
  return Object.keys(A5_G1_RECORD_SPECS)
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const canonical = (value) => JSON.stringify(value, (_key, item) => (
  isRecord(item) ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item
))
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')
const jsonClone = (value) => JSON.parse(JSON.stringify(value))
const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}
const dirRes = (realmId, canonicalLocator, rights) => ({ realmId, kind: 'directory', canonicalLocator, rights })
const pathRes = (realmId, canonicalLocator, rights) => ({ realmId, kind: 'absolute-path', canonicalLocator, rights })
const TOOL_NAME_OBLIGATION = Object.freeze({ target: 'host-tool-dispatch', operation: 'invoke-captured-body', right: 'read' })
const SANDBOX_MODES = Object.freeze(['read-only', 'workspace-write', 'danger-full-access'])

function classifyRefuse(code, detail) {
  return Object.freeze({ ok: false, code, detail })
}

function closedRootCheck(spec, rawArgs, providerId) {
  if (rawArgs === undefined || rawArgs === null) return null
  if (!isRecord(rawArgs)) {
    return classifyRefuse(CODES.CLASSIFY_INVALID_ARGUMENTS, `${spec.recordIndex}·${spec.family}·${providerId}: model arguments must be one JSON object; nothing is consulted`)
  }
  const known = new Set(spec.parametersTopLevel)
  for (const key of Object.keys(rawArgs)) {
    if (!known.has(key)) {
      return classifyRefuse(CODES.CLASSIFY_UNKNOWN_PARAMETER, `${spec.recordIndex}·${spec.family}·${providerId}: '${key}' is not a declared face parameter of this record; trusted TARGETS are CONFIG facts the model cannot supply`)
    }
  }
  for (const required of spec.requiredTopLevel) {
    if (rawArgs[required] === undefined) {
      return classifyRefuse(CODES.CLASSIFY_MISSING_PARAMETER, `${spec.recordIndex}·${spec.family}·${providerId}: required parameter '${required}' is absent`)
    }
  }
  return null
}

/* L10 — REAL spec parse (the manager accepts an npm name incl. @scope/pkg,
 * or a local path RELATIVE to the invocation directory; never an absolute
 * or drive path). Returns null when the claim is outside the envelope. */
function parseInstallSpec(spec) {
  if (typeof spec !== 'string' || spec.length === 0) return null
  if (spec.startsWith('/') || spec.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(spec)) return null
  if (spec.split('/').includes('..') || spec.split('\\').includes('..')) return null
  const scopedPath = spec.startsWith('@')
  const nameEnd = scopedPath ? spec.indexOf('/', 1) : -1
  const splitPlain = (() => {
    if (scopedPath) {
      if (nameEnd === -1) return { name: spec, version: null }
      const rest = spec.slice(nameEnd + 1)
      const at = rest.lastIndexOf('@')
      if (at === -1) return { name: spec, version: null }
      return { name: spec.slice(0, nameEnd + 1 + at), version: rest.slice(at + 1) }
    }
    const at = spec.lastIndexOf('@')
    return at > 0 ? { name: spec.slice(0, at), version: spec.slice(at + 1) } : { name: spec, version: null }
  })()
  if (splitPlain.version !== null && (splitPlain.version === '' || /\s/.test(splitPlain.version))) return null
  const npmName = scopedPath
    ? /^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/.test(splitPlain.name)
    : /^[a-z0-9-~][a-z0-9-._~]*$/.test(splitPlain.name)
  if (npmName && !spec.includes('\\')) return { kind: 'npm-name', name: splitPlain.name, version: splitPlain.version }
  if (spec.includes('/')) {
    if (spec.startsWith('@')) return null
    if (spec.split('/').some((segment) => segment === '')) return null
    return { kind: 'relative-path', path: spec }
  }
  return null
}

/* L10 — REAL registry parse: URL grammar, https-only, canonical href. */
function parseRegistry(href) {
  if (typeof href !== 'string' || href.length === 0) return null
  try {
    const url = new URL(href)
    if (url.protocol !== 'https:') return null
    return { canonical: url.href.replace(/\/$/, '') }
  } catch {
    return null
  }
}

function currentPluginFacts(ports, spec, providerId) {
  const facts = typeof ports?.pluginFacts?.current === 'function' ? ports.pluginFacts.current() : undefined
  const ok = isRecord(facts)
    && typeof facts.profileConfigLocator === 'string' && facts.profileConfigLocator.length > 0
    && typeof facts.installRootLocator === 'string' && facts.installRootLocator.length > 0
    && typeof facts.cacheRootLocator === 'string' && facts.cacheRootLocator.length > 0
    && typeof facts.exemptionsLocator === 'string' && facts.exemptionsLocator.length > 0
    && Array.isArray(facts.allowedRegistries) && Array.isArray(facts.fallbackRegistries)
  if (!ok) {
    return { refusal: classifyRefuse(CODES.PLUGIN_TARGETS_ABSENT, `${spec.recordIndex}·B-PLUGIN·${providerId}: the trusted profile facts (profile config path, install root, npm cache, exemptions file, registry allow-list) are not mounted; plugin effects cannot be enumerated`) }
  }
  return { facts }
}

function currentDependencyFacts(ports, spec, providerId) {
  const facts = typeof ports?.dependencyFacts?.current === 'function' ? ports.dependencyFacts.current() : undefined
  const ok = isRecord(facts) && typeof facts.sourceLocator === 'string' && facts.sourceLocator.length > 0
    && typeof facts.rootLocator === 'string' && facts.rootLocator.length > 0
  if (!ok) {
    return { refusal: classifyRefuse(CODES.DEPENDENCY_FACTS_ABSENT, `${spec.recordIndex}·B-DEPENDENCY·${providerId}: the install facts (source payload directory, runtime root) are not mounted; the F-envelope cannot be enumerated`) }
  }
  return { facts }
}

function effectsFor(spec, rawArgs, realmId, ports, providerId, trusted) {
  const effects = spec.family === 'B-DOMAIN'
    ? []
    : [{ kind: 'tool-invoke', toolName: TOOL_NAME_BY_INDEX[spec.recordIndex] ?? spec.recordIndex, resource: null }]
  const built = { obligations: null, target: {} }
  switch (spec.family) {
    case 'B-PRESENT': {
      const files = Array.isArray(rawArgs.files) ? rawArgs.files : []
      const deliverables = []
      for (const file of files) {
        if (!isRecord(file) || typeof file.path !== 'string' || file.path.length === 0) {
          return { refusal: classifyRefuse(CODES.CLASSIFY_INVALID_ARGUMENTS, `${spec.recordIndex}·B-PRESENT·${providerId}: every presented file needs a non-empty path`) }
        }
        const isAbsolute = file.path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(file.path)
        const parsed = parseResourceRef({
          realmId,
          kind: isAbsolute ? 'absolute-path' : 'workspace',
          canonicalLocator: file.path,
          rights: ['read', 'meta'],
        })
        if (parsed.ok !== true) {
          const first = parsed.problems[0]
          return { refusal: classifyRefuse(CODES.CLASSIFY_INVALID_ARGUMENTS, `${spec.recordIndex}·B-PRESENT·${providerId}: path '${file.path}' is not a legal deliverable per the lane resource grammar (${first === undefined ? 'resource grammar refused' : first.detail})`) }
        }
        deliverables.push({ path: file.path, governedKind: parsed.value.kind, ...(typeof file.description === 'string' ? { description: file.description } : {}) })
        effects.push(
          { kind: 'read', resource: parsed.value },
          { kind: 'meta', resource: parsed.value },
        )
      }
      built.target = {
        deliverables,
        audience: { kind: 'current-session', sessionHeaderId: trusted.sessionHeaderId },
        artifactVersion: 'turn-scoped-at-result',
        readOnly: false,
        legalityLaw: 'path legality is the lane resource grammar with its kinds: relative → workspace (relative .. refused), OS-absolute → absolute-path — an ABSOLUTE deliverable is legal functionality riding as a GOVERNED read+meta effect the effect-commit approval lane decides (neither blanket-refuse nor silent allow)',
      }
      built.obligations = [{
        target: 'current-session-audience',
        operation: 'expose',
        right: 'write',
        note: 'present is NOT read-only: the expose obligation carries artifact identity/version + the visible audience; the commit witness is the SAME-EXEC session append (deliverables/presented) carrying the exec callId and the native result turn',
      }]
      break
    }
    case 'B-DEPENDENCY': {
      const { refusal, facts } = currentDependencyFacts(ports, spec, providerId)
      if (refusal !== undefined) return { refusal }
      const slash = facts.rootLocator.lastIndexOf('/')
      const parent = slash > 0 ? facts.rootLocator.slice(0, slash) : '/'
      effects.push(
        { kind: 'list', resource: dirRes(realmId, facts.sourceLocator, ['read', 'list']) },
        { kind: 'read', resource: pathRes(realmId, `${facts.sourceLocator}/runtime.json`, ['read']) },
        { kind: 'read', resource: pathRes(realmId, `${facts.rootLocator}/runtime.json`, ['read', 'meta']) },
        { kind: 'write', resource: dirRes(realmId, parent, ['write', 'list']) },
        { kind: 'write', resource: dirRes(realmId, facts.rootLocator, ['write', 'list']) },
        { kind: 'write', resource: pathRes(realmId, `${facts.rootLocator}.previous`, ['write', 'meta']) },
      )
      built.target = {
        installFacts: { sourceLocator: facts.sourceLocator, rootLocator: facts.rootLocator, parentLocator: parent },
        armLaw: 'the REUSED path is the EXPORTED installPrimaryRuntime(source, root): compatibleManifest gate, fs.cp-dereference staging copy under the parent, validatePayloadEntries entry-shape checks, previous-slot swap, rename-commit; the delegate runs that mounted path or FAILS CLOSED before any fs of its own and before native entry — it never stages/hashes of its own, never labels an executed copy BLOCKED, and reports the reused-path residual (no ControlledFs, no full-payload digest, no owner single-flight, no cancel) instead of letting the port name imply a closed contract',
      }
      break
    }
    case 'B-PLUGIN': {
      const { refusal, facts } = currentPluginFacts(ports, spec, providerId)
      if (refusal !== undefined) return { refusal }
      const action = rawArgs.action
      if (typeof action !== 'string' || !A5_G1_PLUGIN_ACTIONS.includes(action)) {
        return { refusal: classifyRefuse(CODES.CLASSIFY_UNKNOWN_ACTION, `${spec.recordIndex}·B-PLUGIN·${providerId}: action '${String(action)}' is outside the closed 8-action enum`) }
      }
      let claimedRegistry = null
      if (typeof rawArgs.registry === 'string' && rawArgs.registry.length > 0) {
        const parsed = parseRegistry(rawArgs.registry)
        const envelope = [...facts.allowedRegistries, ...facts.fallbackRegistries]
          .map((entry) => parseRegistry(entry)?.canonical ?? null)
          .filter((entry) => entry !== null)
        if (parsed === null || !envelope.includes(parsed.canonical)) {
          return { refusal: classifyRefuse(CODES.PLUGIN_REGISTRY_NOT_TRUSTED, `${spec.recordIndex}·B-PLUGIN·${providerId}: '${String(rawArgs.registry)}' is unparseable or outside the trusted profile's configured registry allow-list (REAL URL parse, https-only, canonical-href compare)`) }
        }
        claimedRegistry = parsed.canonical
      }
      if (['list_plugins', 'list_bundles'].includes(action)) {
        const offset = rawArgs.offset
        const limit = rawArgs.limit
        if ((offset !== undefined && (!Number.isInteger(offset) || offset < 0))
          || (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100))) {
          return { refusal: classifyRefuse(CODES.CLASSIFY_INVALID_ARGUMENTS, `${spec.recordIndex}·B-PLUGIN·${providerId}: offset must be a non-negative integer and limit an integer from 1 to 100 (the tool face's own constraint)`) }
        }
      }
      const targetClaim = typeof rawArgs.target === 'string' && rawArgs.target.length > 0 ? rawArgs.target : null
      if (['set_plugin', 'set_bundle', 'remove_bundle'].includes(action)) {
        const parsedEntry = targetClaim === null ? null : parseInstallSpec(targetClaim)
        if (parsedEntry === null || parsedEntry.kind !== 'npm-name' || parsedEntry.version !== null) {
          return { refusal: classifyRefuse(CODES.PLUGIN_TARGET_NOT_ENVELOPED, `${spec.recordIndex}·B-PLUGIN·${providerId}: '${action}' targets one installed entry's PACKAGE NAME (the '@scope/pkg' shape is legal); version-qualified and path-shaped targets ride outside the entry-name face`) }
        }
      }
      if (action === 'install_bundle') {
        const parsedSpec = parseInstallSpec(targetClaim)
        if (parsedSpec === null) {
          return { refusal: classifyRefuse(CODES.PLUGIN_TARGET_NOT_ENVELOPED, `${spec.recordIndex}·B-PLUGIN·${providerId}: install target must parse as an npm name (incl. @scope/pkg[@version]) or a path RELATIVE to the invocation directory; absolute and drive paths ride outside the manager envelope`) }
        }
        const destinations = claimedRegistry !== null
          ? [claimedRegistry, ...facts.fallbackRegistries.map((entry) => parseRegistry(entry)?.canonical ?? entry)]
          : [...facts.allowedRegistries, ...facts.fallbackRegistries].map((entry) => parseRegistry(entry)?.canonical ?? entry)
        for (const registry of destinations) {
          effects.push({ kind: 'connect', resource: { realmId, kind: 'network-destination', canonicalLocator: registry, rights: ['connect'] } })
        }
        effects.push(
          { kind: 'write', resource: pathRes(realmId, facts.cacheRootLocator, ['write', 'meta']) },
          { kind: 'write', resource: dirRes(realmId, facts.installRootLocator, ['write', 'list', 'meta']) },
          { kind: 'write', resource: pathRes(realmId, facts.profileConfigLocator, ['read', 'write', 'meta']) },
        )
        built.obligations = [
          TOOL_NAME_OBLIGATION,
          { target: 'host-approval-escalation-channel', operation: 'danger-full-access-approval', right: 'read', note: 'the REAL Host gate chain (sandboxPolicy.resolve + the EXPORTED approveEscalation adjudicator over {approver: ctx.get(\'approval\'), agent, callId, toolName, signal}, tools.ts:38-44) is a HARD PRECONDITION of the install entry: the row mounts those exact seams as hostEscalation and refuses when they are absent or the adjudicator does not grant; Team PA never stands in for it' },
          { target: 'profile-package-manager-channel', operation: 'pnpm-run-under-profile-env', right: 'write', note: 'the pnpm run executes as a child process under the profile package-manager env (the script-process envelope); the resolved build-scripts set is only known AFTER the run — targets beyond this envelope stale the plan, never ride silently' },
          { target: 'host-approvedBuilds-channel', operation: 'build-script-runner-permission', right: 'write', note: 'approvedBuilds is a PERSISTENT permission write into the profile pnpm settings gated by the user\'s explicit conversation approval of the pendingBuilds names — recorded, never re-decided here' },
          { target: 'trusted-profile', operation: 'configure-activation', right: 'write', note: 'install writes the profile config and may activate or restart the live profile (scopeImpact: every session of the profile)' },
        ]
        built.target = {
          action,
          specFacts: parsedSpec,
          installFacts: {
            profileConfigLocator: facts.profileConfigLocator,
            installRootLocator: facts.installRootLocator,
            cacheRootLocator: facts.cacheRootLocator,
          },
          registryPlan: { claimedRegistry, allowedRegistries: [...facts.allowedRegistries], fallbackRegistries: [...facts.fallbackRegistries] },
          versionExemptionDerived: false,
        }
        break
      }
      if (action === 'set_version_exemption') {
        const parsedTarget = targetClaim === null ? null : parseInstallSpec(targetClaim)
        if (parsedTarget === null || parsedTarget.kind !== 'npm-name' || parsedTarget.version === null) {
          return { refusal: classifyRefuse(CODES.CLASSIFY_INVALID_ARGUMENTS, `${spec.recordIndex}·B-PLUGIN·${providerId}: set_version_exemption needs the target as manifest package-name@version (the face doc + tools.ts:47-52 require the exact pair; aliases and ranges are refused)`) }
        }
        if (typeof rawArgs.runtimeVersion !== 'string' || rawArgs.runtimeVersion.length === 0) {
          return { refusal: classifyRefuse(CODES.CLASSIFY_MISSING_PARAMETER, `${spec.recordIndex}·B-PLUGIN·${providerId}: set_version_exemption needs runtimeVersion (the exact DSH version) with the target`) }
        }
        effects.push({ kind: 'write', resource: pathRes(realmId, facts.exemptionsLocator, ['read', 'write', 'meta']) })
        built.obligations = [
          TOOL_NAME_OBLIGATION,
          { target: 'trusted-profile', operation: 'set-version-exemption', right: 'write', note: 'exact (plugin, dshVersion) pair on the user\'s explicit informed decision; crash/data-loss risk is the accepted part; NEVER derivable from an install' },
        ]
        built.target = {
          action,
          exemptionLocator: facts.exemptionsLocator,
          exactPairClaim: { target: targetClaim, parsedName: parsedTarget.name, parsedVersion: parsedTarget.version, runtimeVersionClaim: rawArgs.runtimeVersion },
          acceptRiskClaim: rawArgs.acceptRisk === true,
          derivableFromInstall: false,
        }
        break
      }
      if (action === 'remove_bundle') {
        effects.push(
          { kind: 'write', resource: dirRes(realmId, facts.installRootLocator, ['write', 'list', 'meta']) },
          { kind: 'write', resource: pathRes(realmId, facts.profileConfigLocator, ['read', 'write', 'meta']) },
        )
        built.obligations = [
          TOOL_NAME_OBLIGATION,
          { target: 'trusted-profile', operation: 'remove-bundle', right: 'write', note: 'profile config + install-root writes; live removal additionally needs the topology reconcile-or-restart step (scopeImpact: every session)' },
        ]
        built.target = { action, targetClaim, installFacts: { profileConfigLocator: facts.profileConfigLocator, installRootLocator: facts.installRootLocator }, versionExemptionDerived: false }
        break
      }
      if (action === 'set_plugin' || action === 'set_bundle') {
        effects.push({ kind: 'write', resource: pathRes(realmId, facts.profileConfigLocator, ['read', 'write', 'meta']) })
        built.obligations = [
          TOOL_NAME_OBLIGATION,
          { target: 'trusted-profile', operation: action === 'set_plugin' ? 'set-plugin-enabled' : 'set-bundle-active', right: 'write', note: 'profile config write; live effect needs the topology reconcile-or-restart step (scopeImpact: every session of the profile)' },
        ]
        built.target = { action, targetClaim, enabledClaim: rawArgs.enabled, installFacts: { profileConfigLocator: facts.profileConfigLocator } }
        break
      }
      built.obligations = [{ target: 'trusted-profile', operation: action, right: 'read', note: 'read-only enumeration of the trusted profile state' }]
      built.target = { action, offsetClaim: rawArgs.offset ?? 0, limitClaim: rawArgs.limit ?? 25 }
      break
    }
    case 'B-SKILL': {
      const catalog = typeof ports?.trustedCatalog?.current === 'function' ? ports.trustedCatalog.current() : undefined
      if (!isRecord(catalog) || typeof catalog.catalogRevision !== 'number' || typeof catalog.catalogDigest !== 'string' || !Array.isArray(catalog.names)) {
        return { refusal: classifyRefuse(CODES.TRUSTED_CATALOG_ABSENT, `${spec.recordIndex}·B-SKILL·${providerId}: the TRUSTED catalog CURRENT facts are not mounted — a captured snapshot can never justify a later get`) }
      }
      if (!catalog.names.includes(rawArgs.name)) {
        return { refusal: classifyRefuse(CODES.SKILL_NAME_NOT_TRUSTED, `${spec.recordIndex}·B-SKILL·${providerId}: '${String(rawArgs.name)}' is not in the CURRENT trusted catalog`) }
      }
      built.target = { skillName: rawArgs.name, catalog: { catalogRevision: catalog.catalogRevision, catalogDigest: catalog.catalogDigest } }
      break
    }
    case 'B-INSPECT': {
      const topology = typeof ports?.trustedTopology?.current === 'function' ? ports.trustedTopology.current() : undefined
      if (!isRecord(topology) || typeof topology.topologyRevision !== 'number' || typeof topology.topologyDigest !== 'string' || !Array.isArray(topology.allowed)) {
        return { refusal: classifyRefuse(CODES.TOPOLOGY_ABSENT, `${spec.recordIndex}·B-INSPECT·${providerId}: the CURRENT authorized registry topology is not mounted`) }
      }
      /* A5-M2 (root 957 LIMITED ruling): the trusted/topology SCALAR flatten
       * is PASS and stays — topologyRevision/topologyDigest are flat leaves
       * (the trusted envelope is flattened in classify). The VARIANT facts
       * stay in their measured base form INSIDE the target (they ride the
       * approved question and its fingerprint — moving them out is frozen):
       * rec 53 the top-level `listLaw`, rec 54 the nested `queryClaim` triple
       * plus the client `clientRoundtrip` law. The root REFUSED the
       * `inspectTarget: 'obligations'` rule pairing (the generic obligations
       * kind cannot verify the triple — mint discipline is not the M0 §1
       * typed target grammar), so PA_FAMILY_TARGET_RULES ['B-INSPECT']
       * registers ONLY the scalar leaves and these variant facts fail closed
       * at the grammar gate until a variant-grammar contract delta is signed:
       * dev/agent-workflow/evidence/a5m2-family-rules/a5m2-inspect-variant-grammar-candidate.md */
      built.target = {
        topologyRevision: topology.topologyRevision,
        topologyDigest: topology.topologyDigest,
      }
      if (spec.recordIndex === 54) {
        const claim = { platform: rawArgs.platform, provider: rawArgs.provider, method: rawArgs.method }
        const authorized = topology.allowed.some((entry) => isRecord(entry)
          && entry.platform === claim.platform && entry.provider === claim.provider && entry.method === claim.method)
        if (!authorized) {
          return { refusal: classifyRefuse(CODES.INSPECT_TARGET_NOT_AUTHORIZED, `${spec.recordIndex}·B-INSPECT·${providerId}: ${String(claim.platform)}/${String(claim.provider)}/${String(claim.method)} is not in the CURRENT authorized topology; a captured manifest snapshot cannot authorize a query`) }
        }
        built.target.queryClaim = claim
        if (claim.platform === 'client') {
          built.target.clientRoundtrip = 'the query rides the Client page response (pending-until-response); host-side cancellation of the tool call is NOT a transport cancel'
        }
      } else {
        built.target.listLaw = 'the real list enumerates ALL providers; the row constrains that answer to the CURRENT authorized topology — unauthorized providers never appear'
      }
      break
    }
    case 'B-DOMAIN': {
      const registry = typeof ports?.domainPortRegistry?.current === 'function' ? ports.domainPortRegistry.current() : undefined
      if (!isRecord(registry) || typeof registry.domainAuthorityId !== 'string' || registry.domainAuthorityId.length === 0 || typeof registry.portRevision !== 'number') {
        return { refusal: classifyRefuse(CODES.DOMAIN_REGISTRY_ABSENT, `${spec.recordIndex}·B-DOMAIN·${providerId}: no TRUSTED mounted-port registry is available — the kernel has NO public domain-authority registry (gap reported, never faked) and a captured id is never authority`) }
      }
      if (rawArgs.domainAuthorityId !== registry.domainAuthorityId) {
        return { refusal: classifyRefuse(CODES.DOMAIN_CLAIM_MISMATCH, `${spec.recordIndex}·B-DOMAIN·${providerId}: the model-supplied domainAuthorityId '${String(rawArgs.domainAuthorityId)}' is only a CLAIM; authority is the mounted-port registry CURRENT fact`) }
      }
      effects.push({ kind: 'domain-ref', domainAuthorityId: registry.domainAuthorityId, resource: null })
      built.target = {
        toolNameClaim: rawArgs.toolName,
        trustedDomainAuthorityId: registry.domainAuthorityId,
        portRevision: registry.portRevision,
        targetDigestClaim: rawArgs.targetDigest,
        modelClaimWas: rawArgs.domainAuthorityId,
      }
      break
    }
    default:
      break
  }
  return { effects, obligations: built.obligations ?? null, target: built.target }
}

export function mountG1SurfaceAdapter(recordName, deps = {}) {
  const spec = A5_G1_RECORD_SPECS[recordName]
  if (spec === undefined) {
    throw new TypeError(`unknown G1 surface record '${String(recordName)}'; the 14 are frozen (${Object.keys(A5_G1_RECORD_SPECS).join(', ')})`)
  }
  const { native, providerId = 'plugin', definitionIdentity, trusted, bindingFacts, ports = {}, observe } = deps
  if (!isRecord(trusted) || typeof trusted.memberAgentId !== 'string' || trusted.memberAgentId.length === 0
    || typeof trusted.sessionHeaderId !== 'string' || trusted.sessionHeaderId.length === 0
    || typeof trusted.realmId !== 'string' || trusted.realmId.length === 0
    || typeof trusted.owner !== 'string' || trusted.owner.length === 0
    || typeof trusted.profileId !== 'string' || trusted.profileId.length === 0) {
    throw new TypeError(`G1 record ${spec.recordIndex}: the trusted TARGETS face (memberAgentId, sessionHeaderId, realmId, owner, profileId) is CONFIG that must be provided at mount`)
  }
  if (typeof bindingFacts !== 'function') {
    throw new TypeError(`G1 record ${spec.recordIndex}: bindingFacts() must be mounted — the adapter must answer the binding revision the PA edge consults`)
  }
  if (spec.capture === 'surface' && (native === undefined || native === null)) {
    throw new TypeError(`G1 record ${spec.recordIndex}: a surface row with no mounted port has nothing to govern; mount the captured port or drop the family`)
  }
  if (native !== undefined && native !== null) {
    if (typeof native !== 'object' || native.name !== recordName || typeof native.description !== 'string') {
      throw new TypeError(`G1 record ${spec.recordIndex}: the mounted capture must be the SAME native face (same name, description present); a mismatched or reconstructed face is a config defect, not a fallback`)
    }
    if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
      throw new TypeError(`G1 record ${spec.recordIndex}: a captured face must mount WITH its definitionIdentity (provider@commit@entry#params-hash)`)
    }
  }
  const captured = native !== undefined && native !== null
  const bindBody = captured ? (spec.capture === 'surface' ? native.decide : native.execute) : undefined
  const installFace = deps.installFace
  const bindInstall = installFace !== undefined && installFace !== null ? installFace.installBundle : undefined
  /* The host escalation seams the row cannot reach itself (tools.ts:38-44):
   *   approveEscalation — the EXPORTED adjudicator (sandbox package public
   *     export; non-grant outcomes THROW);
   *   sandboxPolicy      — ctx.sandboxPolicy.resolve(scope) at :39;
   *   approver           — ctx.get('approval') at :42.
   * Mounting all three is the precise integrator obligation; a missing
   * mount FAILS CLOSED before any manager entry. */
  const escalation = deps.hostEscalation
  const bindEscalate = escalation !== undefined && escalation !== null ? escalation.approveEscalation : undefined
  const controlledInstall = deps.controlledInstall
  const bindControlled = controlledInstall !== undefined && controlledInstall !== null ? controlledInstall.installPrimaryRuntime : undefined
  const realmId = trusted.realmId
  const plans = new WeakMap()

  const classify = (args, callId) => {
    if (!captured) return classifyRefuse(CODES.CAPTURE_ABSENT, `${spec.recordIndex}·${spec.family}·${providerId}: no native capture was mounted; this adapter refuses every call (typed, zero native entry, no re-resolution)`)
    if (typeof callId !== 'string' || callId.length === 0) {
      return classifyRefuse(CODES.CLASSIFY_INVALID_ARGUMENTS, `${spec.recordIndex}·${spec.family}·${providerId}: classify needs the call identity the PA edge and the commit witness both bind to`)
    }
    const root = closedRootCheck(spec, args, providerId)
    if (root !== null) return root
    const built = effectsFor(spec, args ?? {}, realmId, ports, providerId, trusted)
    if (built.refusal !== undefined) return built.refusal
    const facts = bindingFacts()
    const classifiedArgs = deepFreeze(jsonClone(args ?? {}))
    /* A5-M2 (root ruling): the two families whose PA target rule has LANDED
     * (PA_FAMILY_TARGET_RULES['B-CONTROL'] / ['B-INSPECT']) carry the trusted
     * TARGETS envelope as FLAT LEAVES — the same five CONFIG facts, one leaf
     * each, the pairing law's mint side. Every other family keeps the nested
     * `trusted` envelope BYTE-IDENTICAL (its rule has not landed; its claim
     * still fails closed at the table — no drift either way). */
    const flatTrustedLeaves = spec.family === 'B-CONTROL' || spec.family === 'B-INSPECT'
    const targetManifest = deepFreeze(flatTrustedLeaves
      ? {
          ...built.target,
          trustedMemberAgentId: trusted.memberAgentId,
          trustedSessionHeaderId: trusted.sessionHeaderId,
          trustedRealmId: trusted.realmId,
          trustedOwner: trusted.owner,
          trustedProfileId: trusted.profileId,
        }
      : {
          ...built.target,
          trusted: {
            memberAgentId: trusted.memberAgentId,
            sessionHeaderId: trusted.sessionHeaderId,
            realmId: trusted.realmId,
            owner: trusted.owner,
            profileId: trusted.profileId,
          },
        })
    const effects = deepFreeze(built.effects)
    const serviceObligations = deepFreeze(built.obligations ?? spec.obligations ?? [TOOL_NAME_OBLIGATION])
    const generations = deepFreeze({
      bindingId: facts?.bindingId ?? null,
      bindingRevision: facts?.bindingRevision ?? null,
      policyGeneration: facts?.policyGeneration ?? null,
      authorityGeneration: facts?.authorityGeneration ?? null,
      definitionIdentity: definitionIdentity ?? null,
      providerId,
    })
    const plan = deepFreeze({
      recordName,
      callId,
      correlation: `${trusted.sessionHeaderId}/${trusted.memberAgentId}`,
      classifiedArgs,
      effects,
      serviceObligations,
      targetManifest,
      reviewPayload: Object.freeze({ familyId: spec.family, adapterRevision: A5_G1_ADAPTER_REVISION, providerIdentity: providerId, definitionIdentity: definitionIdentity ?? null, targetManifest }),
      generations,
      parametersFingerprint: `sha256:${sha256(canonical(args ?? {}))}`,
    })
    plans.set(plan, { state: 'CLASSIFIED', facts: {} })
    if (typeof observe === 'function') observe({ event: 'classified', recordName, callId, parametersFingerprint: plan.parametersFingerprint })
    return {
      ok: true,
      plan,
      name: recordName,
      familyId: spec.family,
      recordIndex: spec.recordIndex,
      effects,
      serviceObligations,
      targetManifest,
      reviewPayload: plan.reviewPayload,
      generations,
      parametersFingerprint: plan.parametersFingerprint,
    }
  }

  const reVerifyAtEdge = (plan) => {
    const stored = plan.targetManifest
    const stale = (detail) => classifyRefuse(CODES.TRUSTED_FACTS_STALE, `${spec.recordIndex}·${spec.family}·${providerId}: trusted facts moved after classify — the plan is stale, not re-approvable: ${detail}`)
    switch (spec.family) {
      case 'B-SKILL': {
        const catalog = typeof ports?.trustedCatalog?.current === 'function' ? ports.trustedCatalog.current() : undefined
        if (!isRecord(catalog)) return stale('the catalog re-verification source is gone')
        if (canonical(stored.catalog) !== canonical({ catalogRevision: catalog.catalogRevision, catalogDigest: catalog.catalogDigest })) {
          return stale(`catalog now answers revision ${String(catalog.catalogRevision)} (${String(catalog.catalogDigest)})`)
        }
        if (!Array.isArray(catalog.names) || !catalog.names.includes(stored.skillName)) return stale('the name is no longer in the CURRENT catalog')
        return null
      }
      case 'B-INSPECT': {
        const topology = typeof ports?.trustedTopology?.current === 'function' ? ports.trustedTopology.current() : undefined
        if (!isRecord(topology) || !Array.isArray(topology.allowed)) return stale('the topology re-verification source is gone')
        // Root 957 LIMITED ruling: current-facts re-verification UNCHANGED in
        // source, verdicts and words. The topology check is the flat scalar
        // form of the SAME canonical({topologyRevision,topologyDigest}) fact
        // the nested target carried (the PASSed scalar flatten). The triple
        // re-verify reads the base nested `stored.queryClaim` - the refused
        // single-item-array/[0] read is gone (mint discipline is not the
        // grammar; see the variant-grammar candidate doc).
        if (stored.topologyRevision !== topology.topologyRevision || stored.topologyDigest !== topology.topologyDigest) {
          return stale(`topology now answers revision ${String(topology.topologyRevision)} (${String(topology.topologyDigest)})`)
        }
        if (stored.queryClaim !== undefined && !topology.allowed.some((entry) => isRecord(entry)
          && entry.platform === stored.queryClaim.platform && entry.provider === stored.queryClaim.provider && entry.method === stored.queryClaim.method)) {
          return stale('the query triple is no longer in the CURRENT authorized topology')
        }
        return null
      }
      case 'B-DOMAIN': {
        const registry = typeof ports?.domainPortRegistry?.current === 'function' ? ports.domainPortRegistry.current() : undefined
        if (!isRecord(registry)) return stale('the domain-port registry source is gone')
        if (registry.domainAuthorityId !== stored.trustedDomainAuthorityId || registry.portRevision !== stored.portRevision) {
          return stale(`the mounted-port registry now answers ${String(registry.domainAuthorityId)}@${String(registry.portRevision)}`)
        }
        return null
      }
      case 'B-PLUGIN': {
        const { refusal, facts } = currentPluginFacts(ports, spec, providerId)
        if (refusal !== undefined) return stale('the trusted profile facts source is gone')
        if (stored.installFacts !== undefined) {
          const now = { ...stored.installFacts }
          if (now.profileConfigLocator !== undefined && now.profileConfigLocator !== facts.profileConfigLocator) return stale('the profile config path moved after classify')
          if (now.installRootLocator !== undefined && now.installRootLocator !== facts.installRootLocator) return stale('the install root moved after classify')
          if (now.cacheRootLocator !== undefined && now.cacheRootLocator !== facts.cacheRootLocator) return stale('the npm cache moved after classify')
        }
        if (stored.exemptionLocator !== undefined && stored.exemptionLocator !== facts.exemptionsLocator) return stale('the exemptions file moved after classify')
        if (stored.registryPlan !== undefined
          && (canonical(stored.registryPlan.allowedRegistries) !== canonical(facts.allowedRegistries)
            || canonical(stored.registryPlan.fallbackRegistries) !== canonical(facts.fallbackRegistries))) {
          return stale('the registry allow-list moved after classify')
        }
        return null
      }
      case 'B-DEPENDENCY': {
        const facts = typeof ports?.dependencyFacts?.current === 'function' ? ports.dependencyFacts.current() : undefined
        if (!isRecord(facts)) return stale('the install facts source is gone')
        if (facts.sourceLocator !== stored.installFacts.sourceLocator || facts.rootLocator !== stored.installFacts.rootLocator) {
          return stale(`install facts now answer ${String(facts.sourceLocator)} → ${String(facts.rootLocator)}`)
        }
        return null
      }
      default:
        return null
    }
  }

  function commitWitness(plan, witness) {
    const entry = plans.get(plan)
    if (entry === undefined) {
      return classifyRefuse(CODES.NOT_OWN_PLAN, `${spec.recordIndex}·B-PRESENT·${providerId}: witness for a plan this classify never produced`)
    }
    if (entry.state === 'COMMITTED') {
      return classifyRefuse(CODES.ALREADY_DELEGATED, `${spec.recordIndex}·B-PRESENT·${providerId}: the append already witnessed this call once`)
    }
    if (entry.state !== 'RESULT_PENDING_SESSION_APPEND') {
      return classifyRefuse(CODES.PRESENT_COMMIT_WITNESS_MISMATCH, `${spec.recordIndex}·B-PRESENT·${providerId}: no delegated native result is pending the append (state ${entry.state})`)
    }
    const turn = entry.facts.nativeResultTurn
    if (!Number.isInteger(turn)) {
      return classifyRefuse(CODES.PRESENT_COMMIT_WITNESS_MISMATCH, `${spec.recordIndex}·B-PRESENT·${providerId}: the native result carried no integer turn; no witness can bind the commit — treat as FAILED-UNKNOWN`)
    }
    if (!isRecord(witness) || witness.callId !== entry.facts.planCallId || witness.turn !== turn
      || witness.sessionHeaderId !== entry.facts.sessionHeaderId) {
      return classifyRefuse(CODES.PRESENT_COMMIT_WITNESS_MISMATCH, `${spec.recordIndex}·B-PRESENT·${providerId}: the witness must be the SAME-EXEC append (deliverables/presented) carrying callId '${entry.facts.planCallId}', the native result's OWN turn '${String(turn)}', and the trusted sessionHeaderId — an arbitrary integer is no witness`)
    }
    entry.state = 'COMMITTED'
    return { ok: true, settled: 'COMMITTED', callId: plan.callId, turn }
  }

  const delegate = async (plan, ctx = {}) => {
    if (!captured) {
      return classifyRefuse(CODES.CAPTURE_ABSENT, `${spec.recordIndex}·${spec.family}·${providerId}: no native capture mounted; the delegate refuses (typed, zero native entry) — re-resolving a native face here would rebuild the second authority`)
    }
    const entry = plans.get(plan)
    if (entry === undefined) {
      return classifyRefuse(CODES.NOT_OWN_PLAN, `${spec.recordIndex}·${spec.family}·${providerId}: the delegate accepts ONLY a plan object this classify produced — never a rebuilt or replayed one; the arguments cannot be swapped after the PA edge`)
    }
    if (entry.state !== 'CLASSIFIED') {
      return classifyRefuse(CODES.ALREADY_DELEGATED, `${spec.recordIndex}·${spec.family}·${providerId}: this classified plan already ran (state ${entry.state}); no replay through the back side`)
    }
    const exec = ctx.exec ?? {}
    if (typeof exec.signal?.aborted === 'boolean' && exec.signal.aborted) {
      entry.state = 'REFUSED-PRE-ABORTED'
      return classifyRefuse(CODES.PRE_ABORTED, `${spec.recordIndex}·${spec.family}·${providerId}: the caller's signal was ALREADY aborted before this call was admitted — nothing started (no gate call, no native entry, no manager entry)`)
    }
    const bodyKey = spec.capture === 'surface' ? 'decide' : 'execute'
    if (typeof bindBody !== 'function' || native[bodyKey] !== bindBody) {
      entry.state = 'FAILED-UNKNOWN'
      return classifyRefuse(CODES.DEFINITION_DRIFT, `${spec.recordIndex}·${spec.family}·${providerId}: the captured definition moved after bind (identity ${String(definitionIdentity ?? 'unset')}); the stale plan is not re-run — reclassify against the new identity`)
    }
    const stale = reVerifyAtEdge(plan)
    if (stale !== null) return stale
    const args = plan.classifiedArgs
    entry.facts = {
      planCallId: plan.callId,
      execCallId: isRecord(exec) && typeof exec.callId === 'string' ? exec.callId : null,
      sessionHeaderId: trusted.sessionHeaderId,
    }
    if (entry.facts.execCallId !== null && entry.facts.execCallId !== plan.callId) {
      entry.state = 'FAILED-UNKNOWN'
      return classifyRefuse(CODES.NOT_OWN_PLAN, `${spec.recordIndex}·${spec.family}·${providerId}: the exec carries callId '${entry.facts.execCallId}' but the plan was classified for '${plan.callId}'; a swapped execution is refused before any entry`)
    }
    entry.state = 'DELEGATED'

    /* L9 — dependency: FAIL CLOSED unless the exported controlled install/
     * verify path is mounted; the arm refuses before any fs of its own and
     * before native entry, and when mounted RUNS the real path (its manifest
     * gate, entry-shape validation and rename-commit — while the reused-path
     * residual NO ControlledFs / NO full-payload digest / NO owner
     * single-flight / NO cancel rides every result; the row never self-hashes
     * and never labels an executed copy BLOCKED). */
    if (spec.recordIndex === 25) {
      if (!isRecord(controlledInstall) || typeof controlledInstall.installPrimaryRuntime !== 'function') {
        entry.state = 'REFUSED-ARM-CLOSED'
        return classifyRefuse(CODES.DEPENDENCY_ARM_CLOSED, `${spec.recordIndex}·B-DEPENDENCY·${providerId}: the controlled install/verify path is not mounted (the EXPORTED installPrimaryRuntime — compatibleManifest gate + staging copy + validatePayloadEntries + rename-commit); the arm FAILS CLOSED: zero fs of the row, zero native entry, no executed copy to relabel afterwards`)
      }
      if (controlledInstall.installPrimaryRuntime !== bindControlled) {
        entry.state = 'FAILED-UNKNOWN'
        return classifyRefuse(CODES.DEFINITION_DRIFT, `${spec.recordIndex}·B-DEPENDENCY·${providerId}: the mounted controlled path moved after bind; the stale plan is not re-run`)
      }
      const facts = plan.targetManifest.installFacts
      const paths = await controlledInstall.installPrimaryRuntime(facts.sourceLocator, facts.rootLocator)
      entry.state = 'CONTROLLED_RESOLVED'
      entry.facts.controlledPaths = paths
      return {
        ok: true,
        settled: 'CONTROLLED-INSTALL-RESOLVED',
        value: paths,
        verifiedBy: 'the mounted path itself (compatibleManifest gate, fs.cp-dereference staging copy, validatePayloadEntries entry-shape checks, rename-commit); the row reports its real return and hashes nothing of its own',
        residualGap: 'REUSED path ≠ family contract closed (89a9): fs.cp with dereference is not ControlledFs enforcement; validatePayloadEntries checks entry SHAPES, not a full-payload digest (manifest payloadDigest stays optional); no owner-scoped single-flight lock; the copy is not cancellable — these governance dimensions stay OPEN',
      }
    }

    /* L5 — plugin install: THE REAL HOST GATE CHAIN (tools.ts:38-44) FIRST:
     * sandboxPolicy.resolve scope → the EXPORTED approveEscalation
     * adjudicator judges the request over the approval ingredients; every
     * non-grant outcome THROWS (missing approver/agent, non-wider target,
     * rejected/cancelled/unavailable) and is a refusal with ZERO manager
     * entry. AFTER the await: signal re-check (throwIfAborted mirror @:44),
     * then the CURRENT-facts re-verify, then — and only then — the manager. */
    if (spec.recordIndex === 52 && args.action === 'install_bundle') {
      if (!isRecord(escalation) || typeof escalation.approveEscalation !== 'function'
        || typeof escalation.sandboxPolicy?.resolve !== 'function') {
        entry.state = 'REFUSED-NO-ESCALATION-PORT'
        return classifyRefuse(CODES.HOST_APPROVAL_GATE_ABSENT, `${spec.recordIndex}·B-PLUGIN·${providerId}: the Host gate chain (tools.ts:38-44: ctx.sandboxPolicy.resolve + the EXPORTED approveEscalation adjudicator over {approver: ctx.get('approval'), agent, callId, toolName, signal}) is a hard precondition of the install entry; the hostEscalation port is not mounted, so entering the manager would BYPASS the Host business gate — Team PA never stands in for it; zero manager entry happened`)
      }
      if (!isRecord(installFace) || typeof installFace.installBundle !== 'function'
        || typeof installFace.cancelInstall !== 'function' || typeof installFace.waitForInstall !== 'function') {
        entry.state = 'REFUSED-NO-INSTALL-FACE'
        return classifyRefuse(CODES.INSTALL_FACE_ABSENT, `${spec.recordIndex}·B-PLUGIN·${providerId}: install_bundle needs the manager face (installBundle/waitForInstall/cancelInstall) mounted; without it the row would have to FAKE the lifecycle — zero manager entry happened`)
      }
      if (installFace.installBundle !== bindInstall) {
        entry.state = 'FAILED-UNKNOWN'
        return classifyRefuse(CODES.DEFINITION_DRIFT, `${spec.recordIndex}·B-PLUGIN·${providerId}: the mounted manager face moved after bind; the stale plan is not re-run`)
      }
      if (escalation.approveEscalation !== bindEscalate) {
        entry.state = 'FAILED-UNKNOWN'
        return classifyRefuse(CODES.DEFINITION_DRIFT, `${spec.recordIndex}·B-PLUGIN·${providerId}: the mounted escalation adjudicator moved after bind; the stale plan is not re-run`)
      }
      const policyScope = exec.agent === undefined ? {} : { session: exec.agent.session }
      let effectiveMode
      try {
        effectiveMode = escalation.sandboxPolicy.resolve(policyScope)?.mode
      } catch (error) {
        entry.state = 'REFUSED-NO-ESCALATION-PORT'
        return classifyRefuse(CODES.HOST_APPROVAL_GATE_ABSENT, `${spec.recordIndex}·B-PLUGIN·${providerId}: the mounted sandboxPolicy failed to resolve the call's effective mode (${String(error)}); no manager entry`)
      }
      if (typeof effectiveMode !== 'string' || !SANDBOX_MODES.includes(effectiveMode)) {
        entry.state = 'REFUSED-NO-ESCALATION-PORT'
        return classifyRefuse(CODES.HOST_APPROVAL_GATE_ABSENT, `${spec.recordIndex}·B-PLUGIN·${providerId}: the mounted sandboxPolicy must answer one of the closed SandboxMode values (read-only|workspace-write|danger-full-access); got '${String(effectiveMode)}' — no manager entry`)
      }
      const escalationRequest = {
        requestedMode: 'danger-full-access',
        effectiveMode,
        subject: 'plugin management operation',
        justification: `plugin_manager ${canonical(args)}. Profile changes persist across sessions; installed Host code runs outside the workspace sandbox.`,
      }
      const escalationApproval = {
        approver: escalation.approver,
        agent: exec.agent,
        callId: plan.callId,
        toolName: 'plugin_manager',
        ...(exec.signal !== undefined ? { signal: exec.signal } : {}),
      }
      let grantedMode
      try {
        grantedMode = await escalation.approveEscalation(escalationRequest, escalationApproval)
      } catch (error) {
        entry.state = 'REFUSED-NO-HOST-APPROVAL'
        return classifyRefuse(CODES.HOST_APPROVAL_NOT_GRANTED, `${spec.recordIndex}·B-PLUGIN·${providerId}: the real escalation adjudicator did not grant (its own THROW passes through verbatim — missing approver/agent, non-wider target, rejected/cancelled/unavailable): ${String(error)} — zero manager entry happened`)
      }
      if (grantedMode !== 'danger-full-access') {
        entry.state = 'REFUSED-NO-HOST-APPROVAL'
        return classifyRefuse(CODES.HOST_APPROVAL_NOT_GRANTED, `${spec.recordIndex}·B-PLUGIN·${providerId}: the adjudicator granted '${String(grantedMode)}', not 'danger-full-access' — zero manager entry happened`)
      }
      /* throwIfAborted mirror (tools.ts:44) AFTER the await, then the
       * CURRENT-facts re-verify — and only then the manager. */
      if (typeof exec.signal?.aborted === 'boolean' && exec.signal.aborted) {
        entry.state = 'REFUSED-ABORTED-AFTER-GATE'
        return classifyRefuse(CODES.ABORTED_AFTER_GATE, `${spec.recordIndex}·B-PLUGIN·${providerId}: the signal aborted DURING the awaited gate (the throwIfAborted mirror at tools.ts:44); the granted escalation is consumed by nothing — zero manager entry happened`)
      }
      const postGateStale = reVerifyAtEdge(plan)
      if (postGateStale !== null) return postGateStale
      const requestId = `g1-install-${randomUUID()}`
      const options = {
        requestId,
        ...('enabled' in args ? { enabled: args.enabled } : {}),
        ...(Array.isArray(args.approvedBuilds) ? { approvedBuilds: args.approvedBuilds } : {}),
        ...(typeof args.registry === 'string' && args.registry.length > 0 ? { registry: args.registry } : {}),
      }
      entry.state = 'INSTALL_PENDING'
      entry.facts.requestId = requestId
      entry.facts.boundTo = { owner: trusted.owner, correlation: plan.correlation, callId: plan.callId }
      entry.facts.gateReceipt = { grantedMode, effectiveMode, subject: escalationRequest.subject, callId: plan.callId }
      const pending = installFace.installBundle(args.target, options)
      /* Settle is OBSERVED BY THE LISTENER below — the row never reads a
       * return value it fabricated; wait() only reports what this listener
       * recorded plus what the host's waitForInstall answered. */
      const settlement = { state: 'pending', changeResult: null, error: null }
      const settleNotice = Promise.resolve(pending).then(
        (value) => {
          settlement.state = 'settled'
          settlement.changeResult = value
          if (entry.state === 'INSTALL_PENDING') entry.state = 'INSTALL_SETTLED'
        },
        (error) => {
          settlement.state = 'failed'
          settlement.error = String(error)
          if (entry.state === 'INSTALL_PENDING') entry.state = 'FAILED-UNKNOWN'
        },
      )
      let cancelPromise = null
      const remember = (mapped) => {
        entry.facts.cancelAnswer = mapped
        return mapped
      }
      const mapCancelAnswer = (answer) => remember(isRecord(answer) && typeof answer.status === 'string'
        ? { status: answer.status, completionImplied: false }
        : { status: 'unknown-answer', completionImplied: false })
      const cancel = () => {
        if (cancelPromise === null) {
          cancelPromise = Promise.resolve(installFace.cancelInstall(requestId))
            .then(mapCancelAnswer, () => remember({ status: 'cancel-install-failed', completionImplied: false }))
        }
        return cancelPromise
      }
      if (typeof exec.signal?.addEventListener === 'function') {
        exec.signal.addEventListener('abort', () => {
          entry.facts.abortMappedToCancelInstall = true
          void cancel()
        }, { once: true })
      }
      const wait = async () => {
        await settleNotice
        let after = null
        try {
          after = await installFace.waitForInstall(requestId)
        } catch {
          after = null
        }
        if (settlement.state === 'settled') {
          return {
            outcome: 'SETTLED-OBSERVED',
            changeResult: settlement.changeResult,
            waitForInstallAnswer: after,
            ...(after === null ? { afterNote: 'Completed results are not retained; null establishes neither success nor cancellation' } : {}),
          }
        }
        return { outcome: 'FAILED-UNKNOWN', error: settlement.error, completionImplied: false }
      }
      return {
        ok: true,
        settled: 'INSTALL-PENDING',
        lifecycle: {
          requestId,
          boundTo: entry.facts.boundTo,
          gateReceipt: entry.facts.gateReceipt,
          cancel,
          wait,
          cancellation: () => entry.facts.cancelAnswer ?? null,
          get abortMappedToCancelInstall() { return entry.facts.abortMappedToCancelInstall === true },
          law: 'PluginInstallCancellation {status: cancelled|too-late|not-running} verbatim; cancelled confirms only after process exit and file restoration; too-late/not-running never imply completion; an aborted install never claims the copying auto-stopped; a null wait establishes neither success nor cancellation; settle is observed by the listener, never fabricated',
        },
      }
    }

    let value
    try {
      value = await bindBody.call(native, args, exec)
    } catch (error) {
      entry.state = 'FAILED-UNKNOWN'
      throw error
    }
    entry.state = 'NATIVE_RESOLVED'
    entry.facts.nativeResult = value

    if (spec.recordIndex === 51) {
      const turn = isRecord(value) && Number.isInteger(value.turn) ? value.turn : null
      entry.state = 'RESULT_PENDING_SESSION_APPEND'
      entry.facts.nativeResultTurn = turn
      return {
        ok: true,
        settled: 'RESULT-PENDING-SESSION-APPEND',
        value,
        commitWitness: (witness) => commitWitness(plan, witness),
        commitLaw: turn === null
          ? 'the native result carried no integer turn — the commit cannot be witnessed; treat as FAILED-UNKNOWN'
          : `the SAME-EXEC session append (deliverables/presented) carrying callId '${plan.callId}' and the native result's own turn '${String(turn)}' is the commit witness; the resolving promise alone is NOT`,
      }
    }

    if (spec.recordIndex === 53) {
      const topology = typeof ports?.trustedTopology?.current === 'function' ? ports.trustedTopology.current() : undefined
      if (!isRecord(value) || !Array.isArray(value.providers)) {
        entry.state = 'FAILED-UNKNOWN'
        return classifyRefuse(CODES.INSPECT_RESULT_SHAPE_UNKNOWN, `${spec.recordIndex}·B-INSPECT·${providerId}: the list answer is not the provider-list shape ({providers:[{platform, id, methods}]}); the authorized constraint cannot be applied and nothing unchecked passes through`)
      }
      const allowed = new Map()
      for (const item of topology.allowed) {
        if (!isRecord(item)) continue
        const key = `${item.platform}::${item.provider}`
        if (!allowed.has(key)) allowed.set(key, new Set())
        allowed.get(key).add(item.method)
      }
      const providers = []
      let excluded = 0
      for (const provider of value.providers) {
        const methods = isRecord(provider) ? allowed.get(`${provider.platform}::${provider.id}`) : undefined
        if (methods === undefined) {
          excluded += 1
          continue
        }
        providers.push({
          ...provider,
          methods: Array.isArray(provider.methods)
            ? provider.methods.filter((method) => isRecord(method) && methods.has(method.name))
            : [],
        })
      }
      return {
        ok: true,
        settled: 'NATIVE-RESOLVED-AUTHORIZED-CONSTRAINED',
        value: {
          providers,
          authorizedTopology: { topologyRevision: topology.topologyRevision, topologyDigest: topology.topologyDigest },
          excludedUnauthorizedProviders: excluded,
        },
      }
    }

    return { ok: true, settled: 'NATIVE-RESOLVED', value }
  }

  const row = {
    name: recordName,
    familyId: spec.family,
    recordIndex: spec.recordIndex,
    capturePresent: captured,
    descriptionFrom: captured ? 'native' : 'none',
    description: captured ? native.description : null,
    parameters: captured && spec.capture === 'tool' && 'parameters' in native ? native.parameters : null,
    nativeFaceRef: spec.nativeFaceRef,
    definitionIdentity: definitionIdentity ?? null,
    classify,
    delegate,
  }
  if (spec.commitLaw === 'session-append') row.commitWitness = commitWitness
  return Object.freeze(row)
}
