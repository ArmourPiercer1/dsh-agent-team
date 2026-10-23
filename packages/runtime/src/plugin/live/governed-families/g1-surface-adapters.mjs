/**
 * governed-families/g1-surface-adapters.mjs — A5-M2 module group G1 (root
 * concentrated-fix round): the captured-native-delegate adapter rows for the
 * 14 records of families B-CONTROL / B-HUMAN / B-PRESENT / B-PLUGIN /
 * B-INSPECT / B-SKILL / B-DEPENDENCY / B-DOMAIN
 * (frozen dispatch index M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json, records
 * 24, 25, 49–54, 83–85, 87, 88, 91; family law M0-B-FAMILY-TARGET-CONTRACTS.md
 * §3 — every effect/target below answers that section's REAL contract
 * effects; a generic tool-invoke shell with prose notes is rejected law).
 *
 * ── NATIVE-FACE LEDGER (comment-side ONLY: a string literal IS an edge to
 * the audit, so these path facts never live in values) ─────────────────────
 * skill                        HOST pkg dsh-tool-skill, tool-skill/src/index.ts: register @:161 of defineTool @:81; body ctx.skills.list/get(lookup) + isModelInvocable gates :138/:145
 * load_workspace_dependencies  HOST pkg dsh-tool-workspace-dependencies, tool-workspace-dependencies/src/index.ts: register @:249; body memoized installPrimaryRuntime(source, root) @:204-229 (mkdir/cp/rename/rm; no PATH change)
 * ask_user_question            HOST pkg dsh-tool-ask-user, tool-ask-user/src/index.ts: register @:38; body ctx.userQuestions.ask({questions, agent, signal})
 * exit_plan_mode               HOST pkg dsh-plan-mode, plan-mode/src/index.ts: const EXIT_PLAN_MODE @:67, register @:278; body PlanModeController.loggedActive + ctx.get('userQuestions').ask(plan-review)
 * present                      HOST pkg dsh-tool-present, tool-present/src/index.ts: register @:38; body ctx.fs.lstat/resolve/stat + sessionProjections.stateOf(turnBoundary); durable commit = the tools/result listener's session.append('deliverables/presented')
 * plugin_manager               HOST pkg dsh-boot-plugin-manager, plugin-manager/src/tools.ts: register @:19 (closed 8-action enum); body approveEscalation @:38 then ctx.pluginManager.{listPlugins|listBundles|setPluginEnabled|setBundleEnabled|installBundle|removeBundle|listVersionExemptions|setVersionExemption} @:47-94; host lifecycle in plugin-manager/src/index.ts: waitForInstall @:577, cancelInstall @:588 (too-late / not-running law)
 * cordis_inspect_list          HOST pkg dsh-tool-cordis, tool-cordis/src/index.ts: register @:22; body ctx.cordisInspect.list()
 * cordis_inspect_query         same file register @:41; body ctx.cordisInspect.query(platform, provider, method, input, agent, signal) over cordis-host-runner/src/inspect-registry.ts
 * team_request_control         TEAM own layer: createTeamTools → requestControlSpec → controlService.requestControl
 * team_resolve_control         same → controlService.escalateApprovalLeg / controlService.resolveControl
 * team_list_pending_control    same → controlService.listControlState + listOpenApprovalCases (Leader-only before any read)
 * team_grant_permission        same → permissionSpec('grant'): Leader check, canonicalizeExecIntent/canonicalizeFile, mutatePermission
 * team_revoke_permission       same → permissionSpec('revoke'): reveal-as-expansion gated in the SAME mutation authority (no second ledger)
 * surface:domain_family        NOT a model tool by record design: the mounted Domain port {name, description, decide(request)} consulted AT the effect-commit boundary; the domain-ref effect kind it decides for is domain/tool-governance effects.ts:43,72-113
 * ───────────────────────────────────────────────────────────────────────────
 *
 * ROOT LAWS IMPLEMENTED (concentrated-fix card; the module stays UNWIRED —
 * wiring is CENTER's after root review — and this lane's own spec proves the
 * laws over NATIVE DOUBLES: no leg here is, or claims, C2):
 *  1. REAL EFFECTS per record (§3), closed effect grammar (effects.ts):
 *     present ⇒ read+meta per exact deliverable + the expose WRITE business
 *     obligation with artifact identity/audience (presentation is NOT
 *     read-only); load_workspace_dependencies ⇒ the real mkdir/cp/rename/rm
 *     F-envelope item-by-item + the post-resolution actual-hash check
 *     surface; plugin_manager ⇒ PER-ACTION I+S — install carries connect(N)
 *     for registry+fallbacks, directory writes for cache/install roots, the
 *     profile-config write (approvedBuilds persistent permission +
 *     activation), the script-process envelope as the host-channel
 *     obligation, and the exemption lane NEVER derivable from install (and
 *     vice versa). S(op,target,right) rides serviceObligations — §1.1: it is
 *     manifest semantics, never an invented PA Effect kind.
 *  2. TRUSTED TARGETS: every plan target carries the mount-time trusted facts
 *     {memberAgentId, sessionHeaderId, realmId, owner, profileId} — a CONFIG
 *     face the model can never name (closed-root refusal) — plus the binding
 *     generations, at the todo reviewPayload position. Model keys alone are
 *     claims, never targets.
 *  3. skill: classify consults the TRUSTED CATALOG port's CURRENT facts
 *     (catalogRevision/catalogDigest/names) and refuses names outside it;
 *     the plan carries the catalog facts the later native get must answer to
 *     — a captured snapshot never justifies the get.
 *  4. domainAuthorityId: verified against the mounted-port registry's
 *     CURRENT facts; a model-supplied id that mismatches refuses typed and
 *     the domain-ref effect carries the TRUSTED id only.
 *  5. plugin install lifecycle: the native tool binds no requestId/signal —
 *     the host manager face does. delegate binds the returned requestId to
 *     the owner + this A invocation, maps exec.signal → cancelInstall(requestId),
 *     preserves too-late / not-running / unknown answers verbatim, and never
 *     claims an abort auto-stopped copying.
 *  6. present commit law: the native promise resolving is NOT the backend
 *     commit — the durable witness is the same-exec tools/result listener's
 *     session append. delegate answers RESULT-PENDING-SESSION-APPEND; COMMITTED
 *     is reachable ONLY through commitWitness(plan, {callId, turn}) answering
 *     the SAME call.
 *  7. delegate placement: a plan delegates at most ONCE; the plan (never the
 *     caller) supplies the arguments, so swapped args are unrepresentable;
 *     M1 A owns the ONE PA edge — this row exposes everything that edge
 *     binds (effects, serviceObligations, trusted target, generations,
 *     full-value parametersFingerprint) and consumes no approval itself.
 *  8. inspect pair: the trusted CURRENT authorized-topology port answers the
 *     target (revision/digest for list; platform/provider/method triple
 *     membership for query).
 *
 * CAPTURE LAW unchanged: no name-based re-resolution, no lazy registry;
 * capture absent ⇒ every entry answers P_G1_NATIVE_CAPTURE_ABSENT; a
 * present-but-wrong capture throws at assembly (config defect, never silent).
 *
 * @module runtime/plugin/live/governed-families/g1-surface-adapters
 */
import { createHash } from 'node:crypto'

export const A5_G1_FAMILY_GROUP = 'G1'
export const A5_G1_ADAPTER_REVISION = 2

export const A5_G1_TYPED_CODES = Object.freeze({
  CAPTURE_ABSENT: 'P_G1_NATIVE_CAPTURE_ABSENT',
  CLASSIFY_INVALID_ARGUMENTS: 'P_G1_CLASSIFY_INVALID_ARGUMENTS',
  CLASSIFY_UNKNOWN_PARAMETER: 'P_G1_CLASSIFY_UNKNOWN_PARAMETER',
  CLASSIFY_MISSING_PARAMETER: 'P_G1_CLASSIFY_MISSING_PARAMETER',
  CLASSIFY_UNKNOWN_ACTION: 'P_G1_CLASSIFY_UNKNOWN_ACTION',
  DEFINITION_DRIFT: 'P_G1_DEFINITION_DRIFT',
  NOT_OWN_PLAN: 'P_G1_NOT_OWN_PLAN',
  ALREADY_DELEGATED: 'P_G1_ALREADY_DELEGATED',
  TRUSTED_CATALOG_ABSENT: 'P_G1_TRUSTED_CATALOG_ABSENT',
  SKILL_NAME_NOT_TRUSTED: 'P_G1_SKILL_NAME_NOT_TRUSTED',
  TOPOLOGY_ABSENT: 'P_G1_TRUSTED_TOPOLOGY_ABSENT',
  INSPECT_TARGET_NOT_AUTHORIZED: 'P_G1_INSPECT_TARGET_NOT_AUTHORIZED',
  DOMAIN_REGISTRY_ABSENT: 'P_G1_DOMAIN_REGISTRY_ABSENT',
  DOMAIN_CLAIM_MISMATCH: 'P_G1_DOMAIN_CLAIM_MISMATCH',
  PLUGIN_TARGETS_ABSENT: 'P_G1_PLUGIN_TARGETS_ABSENT',
  PLUGIN_REGISTRY_NOT_TRUSTED: 'P_G1_PLUGIN_REGISTRY_NOT_TRUSTED',
  INSTALL_LIFECYCLE_ABSENT: 'P_G1_INSTALL_LIFECYCLE_ABSENT',
  DEPENDENCY_FACTS_ABSENT: 'P_G1_DEPENDENCY_FACTS_ABSENT',
  PRESENT_COMMIT_WITNESS_MISMATCH: 'P_G1_PRESENT_COMMIT_WITNESS_MISMATCH',
})
const CODES = A5_G1_TYPED_CODES

const refuse = (code, detail) => ({ ok: false, code, detail })

const canonicalJson = (value) => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
))

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** Model arguments are JSON data (the host parses and validates JSON before
 * any body runs); the plan's snapshot is its own JSON clone. */
const jsonClone = (value) => JSON.parse(JSON.stringify(value))

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner)
    Object.freeze(value)
  }
  return value
}

/** Closed-grammar helpers (effects.ts law: a resource effect carries ONLY
 * {kind, resource}; everything else lives in the targetManifest). */
const resourceRef = (realmId, kind, canonicalLocator, rights) => ({ realmId, kind, canonicalLocator, rights })
const toolInvoke = (toolName) => ({ kind: 'tool-invoke', toolName, resource: null })
const effectRead = (ref) => ({ kind: 'read', resource: ref })
const effectMeta = (ref) => ({ kind: 'meta', resource: ref })
const effectWrite = (ref) => ({ kind: 'write', resource: ref })
const effectConnect = (ref) => ({ kind: 'connect', resource: ref })
const effectDomainRef = (domainAuthorityId) => ({ kind: 'domain-ref', domainAuthorityId, resource: null })

/** The 8-action closed enum of the captured plugin registration face. */
export const A5_G1_PLUGIN_ACTIONS = PLUGIN_ACTIONS_LIST()
function PLUGIN_ACTIONS_LIST() {
  // Closed set recorded comment-side in the ledger; spelled once, here.
  return Object.freeze(['list_plugins', 'list_bundles', 'set_plugin', 'set_bundle', 'install_bundle', 'remove_bundle', 'list_version_exemptions', 'set_version_exemption'])
}

/**
 * THE FROZEN RECORD MAP. recordIndex/family/scope/ownerRole mirror the frozen
 * dispatch index one-for-one; `nativeFaceRef` points into the comment-side
 * NATIVE-FACE LEDGER; `obligations` = the family §3 S-notation business
 * operations the row records into the plan's serviceObligations (plugin
 * answers per-ACTION inside effectsFor instead).
 */
export const A5_G1_RECORD_SPECS = Object.freeze({
  skill: Object.freeze({
    recordIndex: 24, family: 'B-SKILL', scope: 'host-preset-on', ownerRole: 'SERVICE',
    capture: 'tool-definition', operation: 'load-skill-instructions',
    parametersTopLevel: Object.freeze(['name']), requiredTopLevel: Object.freeze(['name']),
    nativeFaceRef: 'ledger:skill',
    obligations: Object.freeze([
      Object.freeze({ target: 'skill-catalog-namespace', operation: 'read-load', right: 'read' }),
      Object.freeze({ target: 'current-session-prompt', operation: 'inject', right: 'write' }),
    ]),
    effectDeltaNotes: Object.freeze(['prompt-injection-surface', 'catalog-publish']),
  }),
  load_workspace_dependencies: Object.freeze({
    recordIndex: 25, family: 'B-DEPENDENCY', scope: 'host-sdk-app-env-only', ownerRole: 'PLUGIN',
    capture: 'tool-definition', operation: 'query-and-first-execution-install',
    parametersTopLevel: Object.freeze([]), requiredTopLevel: Object.freeze([]),
    nativeFaceRef: 'ledger:load_workspace_dependencies',
    obligations: Object.freeze([
      Object.freeze({ target: 'workspace-runtime-install-namespace', operation: 'install', right: 'write' }),
    ]),
    effectDeltaNotes: Object.freeze(['runtime-payload-install-mkdir-cp-rename-rm']),
  }),
  ask_user_question: Object.freeze({
    recordIndex: 49, family: 'B-HUMAN', scope: 'host-preset-on', ownerRole: 'SERVICE',
    capture: 'tool-definition', operation: 'ask-current-session',
    parametersTopLevel: Object.freeze(['questions']), requiredTopLevel: Object.freeze(['questions']),
    nativeFaceRef: 'ledger:ask_user_question',
    obligations: Object.freeze([
      Object.freeze({ target: 'owner-session', operation: 'ask', right: 'write' }),
    ]),
    effectDeltaNotes: Object.freeze(['human-input-channel']),
  }),
  exit_plan_mode: Object.freeze({
    recordIndex: 50, family: 'B-HUMAN', scope: 'host-preset-on', ownerRole: 'SERVICE',
    capture: 'tool-definition', operation: 'exit-plan-mode-via-host-approval',
    parametersTopLevel: Object.freeze(['plan']), requiredTopLevel: Object.freeze(['plan']),
    nativeFaceRef: 'ledger:exit_plan_mode',
    obligations: Object.freeze([
      Object.freeze({ target: 'owner-session', operation: 'exit-plan', right: 'write' }),
      Object.freeze({ target: 'host-user-questions-channel', operation: 'plan-review-approval', right: 'read' }),
    ]),
    effectDeltaNotes: Object.freeze(['session-mode-transition-approval-gate']),
  }),
  present: Object.freeze({
    recordIndex: 51, family: 'B-PRESENT', scope: 'host-preset-on', ownerRole: 'SERVICE',
    capture: 'tool-definition', operation: 'expose-deliverables-no-copy',
    parametersTopLevel: Object.freeze(['files']), requiredTopLevel: Object.freeze(['files']),
    commitLaw: 'session-append',
    nativeFaceRef: 'ledger:present',
    obligations: Object.freeze([
      Object.freeze({ target: 'current-session-audience', operation: 'expose', right: 'write' }),
    ]),
    effectDeltaNotes: Object.freeze(['file-expose-deliverable-card']),
  }),
  plugin_manager: Object.freeze({
    recordIndex: 52, family: 'B-PLUGIN', scope: 'host-preset-conditional', ownerRole: 'PLUGIN',
    capture: 'tool-definition', operation: 'profile-management-action',
    parametersTopLevel: Object.freeze(['action', 'target', 'enabled', 'runtimeVersion', 'acceptRisk', 'approvedBuilds', 'registry', 'offset', 'limit']),
    requiredTopLevel: Object.freeze(['action']),
    nativeFaceRef: 'ledger:plugin_manager',
    effectDeltaNotes: Object.freeze(['profile-config-write-persist-all-sessions', 'npm-install-build-script-exec', 'peer-dep-exemption']),
  }),
  cordis_inspect_list: Object.freeze({
    recordIndex: 53, family: 'B-INSPECT', scope: 'host-preset-cordis-only', ownerRole: 'SERVICE',
    capture: 'tool-definition', operation: 'list-inspect-providers',
    parametersTopLevel: Object.freeze([]), requiredTopLevel: Object.freeze([]),
    nativeFaceRef: 'ledger:cordis_inspect_list',
    obligations: Object.freeze([
      Object.freeze({ target: 'authorized-inspect-registry-topology', operation: 'read', right: 'read' }),
    ]),
    effectDeltaNotes: Object.freeze(['runtime-topology-disclosure']),
  }),
  cordis_inspect_query: Object.freeze({
    recordIndex: 54, family: 'B-INSPECT', scope: 'host-preset-cordis-only', ownerRole: 'SERVICE',
    capture: 'tool-definition', operation: 'query-inspect-provider',
    parametersTopLevel: Object.freeze(['platform', 'provider', 'method', 'input']),
    requiredTopLevel: Object.freeze(['platform', 'provider', 'method']),
    nativeFaceRef: 'ledger:cordis_inspect_query',
    obligations: Object.freeze([
      Object.freeze({ target: 'authorized-inspect-registry-topology', operation: 'read-query', right: 'read' }),
      Object.freeze({ target: 'client-browser-page', operation: 'roundtrip', right: 'read' }),
    ]),
    effectDeltaNotes: Object.freeze(['runtime-topology-disclosure', 'client-browser-roundtrip']),
  }),
  team_request_control: Object.freeze({
    recordIndex: 83, family: 'B-CONTROL', scope: 'own-layer', ownerRole: 'CONTROL',
    capture: 'tool-definition', operation: 'request-control',
    parametersTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'kind', 'targetInstanceId', 'actionName', 'toolName', 'summary']),
    requiredTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'kind', 'targetInstanceId', 'actionName']),
    nativeFaceRef: 'ledger:team_request_control',
    obligations: Object.freeze([
      Object.freeze({ target: 'control-service-single-ledger', operation: 'request-control', right: 'write' }),
    ]),
    effectDeltaNotes: Object.freeze(['approval-durable-write-via-ControlService']),
  }),
  team_resolve_control: Object.freeze({
    recordIndex: 84, family: 'B-CONTROL', scope: 'own-layer', ownerRole: 'CONTROL',
    capture: 'tool-definition', operation: 'resolve-control',
    parametersTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'requestId', 'decision', 'note']),
    requiredTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'requestId', 'decision']),
    nativeFaceRef: 'ledger:team_resolve_control',
    obligations: Object.freeze([
      Object.freeze({ target: 'control-service-single-ledger', operation: 'resolve-control-or-escalate-leg', right: 'write' }),
    ]),
    effectDeltaNotes: Object.freeze(['approval-durable-write-via-ControlService']),
  }),
  team_list_pending_control: Object.freeze({
    recordIndex: 85, family: 'B-CONTROL', scope: 'own-layer', ownerRole: 'CONTROL',
    capture: 'tool-definition', operation: 'list-pending-control',
    parametersTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'limit']),
    requiredTopLevel: Object.freeze(['rootSessionId', 'requestToken']),
    nativeFaceRef: 'ledger:team_list_pending_control',
    obligations: Object.freeze([
      Object.freeze({ target: 'control-service-single-ledger', operation: 'read-pending', right: 'read' }),
    ]),
    effectDeltaNotes: Object.freeze(['approval-durable-read']),
  }),
  team_grant_permission: Object.freeze({
    recordIndex: 87, family: 'B-CONTROL', scope: 'own-layer', ownerRole: 'CONTROL',
    capture: 'tool-definition', operation: 'grant-permission',
    parametersTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'targetInstanceId', 'rules']),
    requiredTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'targetInstanceId', 'rules']),
    nativeFaceRef: 'ledger:team_grant_permission',
    obligations: Object.freeze([
      Object.freeze({ target: 'permission-overlay-single-mutation-authority', operation: 'grant', right: 'write' }),
    ]),
    effectDeltaNotes: Object.freeze(['permission-overlay-durable-write']),
  }),
  team_revoke_permission: Object.freeze({
    recordIndex: 88, family: 'B-CONTROL', scope: 'own-layer', ownerRole: 'CONTROL',
    capture: 'tool-definition', operation: 'revoke-permission',
    parametersTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'targetInstanceId', 'rules']),
    requiredTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'targetInstanceId', 'rules']),
    nativeFaceRef: 'ledger:team_revoke_permission',
    obligations: Object.freeze([
      Object.freeze({ target: 'permission-overlay-single-mutation-authority', operation: 'revoke-reveal-as-expansion-gated', right: 'write' }),
    ]),
    effectDeltaNotes: Object.freeze(['permission-overlay-durable-write']),
  }),
  'surface:domain_family': Object.freeze({
    recordIndex: 91, family: 'B-DOMAIN', scope: 'surface', ownerRole: 'CONNECTOR',
    capture: 'domain-surface', operation: 'domain-decision-at-effect-boundary',
    parametersTopLevel: Object.freeze(['toolName', 'domainAuthorityId', 'targetDigest']),
    requiredTopLevel: Object.freeze(['toolName', 'domainAuthorityId']),
    nativeFaceRef: 'ledger:surface:domain_family',
    obligations: Object.freeze([
      Object.freeze({ target: 'mounted-domain-port-registry', operation: 'decide-at-effect-commit', right: 'read' }),
    ]),
    effectDeltaNotes: Object.freeze(['domain-business-effect-at-plugin-boundary-family-level']),
  }),
})

export function g1SurfaceAdapterNames() {
  return Object.keys(A5_G1_RECORD_SPECS)
    .sort((a, b) => A5_G1_RECORD_SPECS[a].recordIndex - A5_G1_RECORD_SPECS[b].recordIndex)
}

/** Pure parse of one present-file item → closed ResourceRef (relative =
 * workspace, absolute = absolute-path; traversal/empty refuse). The exact
 * file law ALSO lives in the native body — this only makes the EFFECT target
 * well-formed and realm-anchored. */
function presentFileRef(realmId, rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.includes('\0')) return null
  if (rawPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(rawPath)) {
    return resourceRef(realmId, 'absolute-path', rawPath, ['read', 'meta'])
  }
  if (rawPath.split(/[/\\]/).some((s) => s === '..')) return null
  return resourceRef(realmId, 'workspace', rawPath, ['read', 'meta'])
}

/**
 * Per-record REAL effects + record facts, exactly the family §3 targets
 * (closed effect grammar; S-notation business operations ride separately as
 * serviceObligations — §1.1: manifest semantics, never invented PA kinds).
 * Returns { effects, obligations?, targetFacts } or a typed refusal.
 */
function effectsFor(recordName, args, trusted, ports) {
  const realm = trusted.realmId
  switch (recordName) {
    case 'present': {
      if (!Array.isArray(args.files) || args.files.length === 0) {
        return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'present: files must be a non-empty array')
      }
      const effects = [toolInvoke(recordName)]
      const deliverables = []
      for (const file of args.files) {
        if (file === null || typeof file !== 'object' || Array.isArray(file)) {
          return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'present: every files[] item must be { path, description? }')
        }
        const unknown = Object.keys(file).filter((k) => k !== 'path' && k !== 'description')
        if (unknown.length > 0) return refuse(CODES.CLASSIFY_UNKNOWN_PARAMETER, `present: files[].${unknown.join(', ')} not declared`)
        const ref = presentFileRef(realm, file.path)
        if (ref === null) return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, 'present: files[].path is not a well-formed workspace-relative or absolute deliverable path')
        // F on the EXACT deliverable: read + metadata (contract B-PRESENT).
        effects.push(effectRead(ref), effectMeta(ref))
        deliverables.push({ canonicalLocator: ref.canonicalLocator, resourceKind: ref.kind, declaredDescription: typeof file.description === 'string' ? file.description : null })
      }
      return {
        effects,
        targetFacts: {
          deliverables,
          audience: { kind: 'current-session', sessionHeaderId: trusted.sessionHeaderId },
          // Artifact identity = the exact realm-anchored locators; VERSION is
          // turn-scoped and exists only once the native result lands — the
          // commit witness (law 6) is what pins it.
          artifactVersion: 'turn-scoped-at-result',
          readOnly: false,
        },
      }
    }
    case 'load_workspace_dependencies': {
      const facts = ports.dependencyFacts
      if (facts === undefined || typeof facts.sourceLocator !== 'string' || typeof facts.rootLocator !== 'string') {
        return refuse(CODES.DEPENDENCY_FACTS_ABSENT, 'load_workspace_dependencies: the trusted install facts (source/root locators — a CONFIG face) are not mounted; the F envelope has no well-formed target and this row refuses rather than letting a model name paths it cannot be trusted with')
      }
      const root = facts.rootLocator
      const parent = root.replace(/[\\/][^\\/]+[\\/]?$/, '') || root
      // The REAL mkdir/cp/rename/rm flow of the memoized first-execution
      // install, item by item (never one blanket "install" line):
      const effects = [
        toolInvoke(recordName),
        effectWrite(resourceRef(realm, 'directory', parent, ['write', 'list'])), // mkdir(parents) + mkdtemp staging class
        effectWrite(resourceRef(realm, 'directory', `${parent}/.primary-runtime-<mkdtemp>`, ['write', 'list'])), // cp payload → staging
        effectWrite(resourceRef(realm, 'absolute-path', `${root}.previous`, ['write', 'meta'])), // rm previous / rename staging↔previous
        effectWrite(resourceRef(realm, 'directory', root, ['write', 'list', 'meta'])), // rename(staging → root): the payload commit edge
        effectMeta(resourceRef(realm, 'absolute-path', `${root}/runtime.json`, ['meta'])), // compatibleManifest / validatePayloadEntries
      ]
      return {
        effects,
        targetFacts: {
          installNamespace: { sourceLocator: facts.sourceLocator, rootLocator: root },
          // POST-RESOLUTION ACTUAL-HASH CHECK SURFACE: the grant approves the
          // envelope; success is only reportable when the installed bytes
          // answered the resolved payload manifest. The memo never bypasses A.
          hashCheck: { required: 'post-resolution-actual-hash', against: 'resolved payload manifest', memoBypass: 'never' },
          envelopeConditional: 'entries ride only the first-execution / version-drift install; an already-valid memo performs no FS move',
          pathChange: 'none — the native body never touches PATH or package-manager settings',
        },
      }
    }
    case 'plugin_manager': {
      const facts = ports.pluginFacts
      if (facts === undefined || typeof facts.profileConfigLocator !== 'string'
        || typeof facts.installRootLocator !== 'string' || typeof facts.cacheRootLocator !== 'string'
        || typeof facts.exemptionsLocator !== 'string' || !Array.isArray(facts.allowedRegistries) || !Array.isArray(facts.fallbackRegistries)) {
        return refuse(CODES.PLUGIN_TARGETS_ABSENT, 'plugin_manager: the trusted profile/install/cache/exemption locators and the registry allow-list are a CONFIG face; unmounted ⇒ no well-formed per-action target exists')
      }
      if (typeof args.action !== 'string' || !A5_G1_PLUGIN_ACTIONS.includes(args.action)) {
        return refuse(CODES.CLASSIFY_UNKNOWN_ACTION, 'plugin_manager: the action is outside the closed 8-action enum of the captured registration face')
      }
      const action = args.action
      const profileConfig = resourceRef(realm, 'absolute-path', facts.profileConfigLocator, ['write', 'meta'])
      const installRoot = resourceRef(realm, 'directory', facts.installRootLocator, ['write', 'list'])
      const cacheRoot = resourceRef(realm, 'directory', facts.cacheRootLocator, ['write', 'list'])
      const exemptions = resourceRef(realm, 'absolute-path', facts.exemptionsLocator, ['write', 'meta'])
      const effects = [toolInvoke(recordName)]
      const obligations = []
      const targetFacts = { action, profileId: trusted.profileId, targetClaim: typeof args.target === 'string' ? args.target : null }
      switch (action) {
        case 'list_plugins':
        case 'list_bundles':
        case 'list_version_exemptions':
          obligations.push({ target: 'trusted-profile', operation: action, right: 'read' })
          break
        case 'set_plugin':
        case 'set_bundle':
          // profile-config durable write; the topology change affects ALL sessions
          effects.push(effectWrite(profileConfig))
          obligations.push({ target: 'trusted-profile', operation: 'enable-disable-persist', right: 'write' })
          obligations.push({ target: 'profile-runtime-topology', operation: 'reconcile-or-restart', right: 'write' })
          targetFacts.scopeImpact = 'every session in this profile'
          break
        case 'install_bundle': {
          const requested = args.registry === undefined ? null : args.registry
          if (requested !== null && !(typeof requested === 'string'
            && [...facts.allowedRegistries, ...facts.fallbackRegistries].includes(requested))) {
            return refuse(CODES.PLUGIN_REGISTRY_NOT_TRUSTED, 'plugin_manager install_bundle: a model-named registry outside the trusted allow-list is a claim, never a connect target')
          }
          const destinations = [...new Set([
            ...(requested !== null ? [requested] : [...facts.allowedRegistries]),
            ...facts.fallbackRegistries,
          ])]
          for (const url of destinations) effects.push(effectConnect(resourceRef(realm, 'network-destination', url, ['connect'])))
          effects.push(effectWrite(cacheRoot), effectWrite(installRoot), effectWrite(profileConfig))
          obligations.push({ target: 'trusted-profile', operation: 'install-resolve-download', right: 'write' })
          obligations.push({ target: 'build-script-runner', operation: 'host-approvedBuilds-channel', right: 'write', envelope: 'host manager channel (no Team constraint engine is invented here)' })
          obligations.push({ target: 'trusted-profile', operation: 'approvedBuilds-persistent-permission-write', right: 'write' })
          obligations.push({ target: 'profile-runtime-topology', operation: 'configure-activation', right: 'write' })
          targetFacts.versionExemptionDerived = false // the exemption lane is its OWN action
          targetFacts.buildScriptsClaim = args.approvedBuilds === undefined ? [] : args.approvedBuilds
          targetFacts.scriptProcessEnvelope = 'resolved-package build scripts execute ONLY through the host approvedBuilds channel; the resolved set is unknown until after A — post-resolution targets beyond THIS envelope stale the plan, they never ride it silently'
          targetFacts.lifecycle = 'installBundle answers a requestId; waitForInstall/cancelInstall own the settlement (cancel confirmable ONLY while installing; applying ⇒ too-late; not-running never implies completion)'
          break
        }
        case 'remove_bundle':
          effects.push(effectWrite(installRoot), effectWrite(profileConfig))
          obligations.push({ target: 'trusted-profile', operation: 'remove-exact-installed-target', right: 'write' })
          break
        case 'set_version_exemption':
          // The exemption lane is NEVER derivable from a plain install.
          effects.push(effectWrite(exemptions))
          obligations.push({ target: 'trusted-profile', operation: 'version-exemption-grant-or-revoke', right: 'write' })
          targetFacts.exactPairClaim = {
            target: typeof args.target === 'string' ? args.target : null,
            runtimeVersion: typeof args.runtimeVersion === 'string' ? args.runtimeVersion : null,
            acceptRiskClaim: args.acceptRisk === true,
          }
          targetFacts.derivableFromInstall = false
          break
      }
      return { effects, obligations, targetFacts }
    }
    case 'skill': {
      const catalog = ports.trustedCatalog?.current?.()
      if (catalog === undefined || catalog === null || typeof catalog.catalogRevision !== 'number'
        || typeof catalog.catalogDigest !== 'string' || !Array.isArray(catalog.names)) {
        return refuse(CODES.TRUSTED_CATALOG_ABSENT, 'skill: the trusted catalog identity port is not mounted — the plan must carry CURRENT catalog facts (a captured snapshot cannot justify a later native get)')
      }
      if (!catalog.names.includes(args.name)) {
        return refuse(CODES.SKILL_NAME_NOT_TRUSTED, 'skill: the claimed name is not in the trusted catalog CURRENT names — a model claim with no catalog fact behind it')
      }
      return {
        effects: [toolInvoke(recordName)],
        targetFacts: {
          skillName: args.name,
          catalog: { catalogRevision: catalog.catalogRevision, catalogDigest: catalog.catalogDigest },
          contentTrust: 'loaded content is DATA, never authority; follow-up tools ride their own rows',
        },
      }
    }
    case 'cordis_inspect_list':
    case 'cordis_inspect_query': {
      const topology = ports.trustedTopology?.current?.()
      if (topology === undefined || topology === null || typeof topology.topologyRevision !== 'number'
        || typeof topology.topologyDigest !== 'string' || !Array.isArray(topology.allowed)) {
        return refuse(CODES.TOPOLOGY_ABSENT, 'inspect: the trusted authorized-topology port is not mounted — the target must be CURRENT authorized facts, never model keys')
      }
      const targetFacts = { topology: { topologyRevision: topology.topologyRevision, topologyDigest: topology.topologyDigest } }
      if (recordName === 'cordis_inspect_list') return { effects: [toolInvoke(recordName)], targetFacts }
      const claim = { platform: args.platform, provider: args.provider, method: args.method }
      const hit = topology.allowed.some((row) => row !== null && typeof row === 'object'
        && row.platform === claim.platform && row.provider === claim.provider && row.method === claim.method)
      if (!hit) {
        return refuse(CODES.INSPECT_TARGET_NOT_AUTHORIZED, 'inspect: the platform/provider/method claim is not inside the CURRENT authorized topology — a model key is a claim, not a target')
      }
      targetFacts.claim = claim
      if (args.platform === 'client') targetFacts.clientRoundtrip = 'the browser page answers within the configured timeout; the roundtrip is part of the envelope'
      return { effects: [toolInvoke(recordName)], targetFacts }
    }
    case 'surface:domain_family': {
      const port = ports.domainPortRegistry?.current?.()
      if (port === undefined || port === null || typeof port.domainAuthorityId !== 'string' || typeof port.portRevision !== 'number') {
        return refuse(CODES.DOMAIN_REGISTRY_ABSENT, 'domain surface: the mounted-port registry CURRENT facts are unreadable — no decision target exists; fail closed (a Team allow never substitutes for a Domain fact)')
      }
      if (args.domainAuthorityId !== port.domainAuthorityId) {
        return refuse(CODES.DOMAIN_CLAIM_MISMATCH, 'domain surface: the model-supplied domainAuthorityId is a CLAIM that does not answer the mounted port CURRENT authority')
      }
      return {
        effects: [effectDomainRef(port.domainAuthorityId)],
        targetFacts: {
          trustedDomainAuthorityId: port.domainAuthorityId,
          portRevision: port.portRevision,
          gatedToolClaim: args.toolName,
          targetDigestClaim: typeof args.targetDigest === 'string' ? args.targetDigest : null,
          modelClaimWas: args.domainAuthorityId,
        },
      }
    }
    default: {
      // B-HUMAN + B-CONTROL: the contract target is I + the S obligation on
      // the owning session/ledger (serviceObligations below); the effect set
      // is the accurate tool's tool-invoke arm (§1.1).
      const targetFacts = { arguments: { ...args } }
      if (recordName === 'team_grant_permission' || recordName === 'team_revoke_permission') {
        targetFacts.ruleCountClaim = Array.isArray(args.rules) ? args.rules.length : null
        targetFacts.canonicalization = 'server-side at the addressed target (never pre-classify: the real FS reads live there)'
      }
      return { effects: [toolInvoke(recordName)], targetFacts }
    }
  }
}

function extractRequestId(value) {
  const parse = (raw) => {
    if (raw !== null && typeof raw === 'object') return raw
    if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return null } }
    return null
  }
  const id = parse(value)?.requestId
  return typeof id === 'string' && id.length > 0 ? id : null
}

/**
 * Mount ONE G1 row for a frozen record name (the glue captures the native
 * face at bind time and passes it here; wiring stays CENTER).
 *
 * @param {string} recordName - one of `g1SurfaceAdapterNames()`.
 * @param {object} deps
 * @param {object|undefined} deps.native - the captured face (ToolDefinition
 *   from the public tools.get seam, or the mounted Domain port). `undefined`
 *   ⇒ governed-but-refusing.
 * @param {string} deps.providerId - placing assembly identity.
 * @param {string} [deps.definitionIdentity] - REQUIRED with a capture (the
 *   I arm binds through it).
 * @param {object} deps.trusted - CONFIG/glue facts, never model arguments:
 *   { memberAgentId, sessionHeaderId, realmId, owner, profileId }.
 * @param {() => {bindingId: string, bindingRevision: number, policyGeneration: number, authorityGeneration: number}} deps.bindingFacts
 * @param {object} [deps.ports] - CURRENT-fact ports (family-specific):
 *   { trustedCatalog: {current()}, trustedTopology: {current()},
 *   domainPortRegistry: {current()}, installLifecycle: {waitForInstall,
 *   cancelInstall}, pluginFacts, dependencyFacts }.
 * @param {(row: {event: string, name: string, detail?: string}) => void} [deps.observe]
 */
export function mountG1SurfaceAdapter(recordName, {
  native,
  providerId = 'unknown-placer',
  definitionIdentity = null,
  trusted,
  bindingFacts,
  ports = {},
  observe = () => {},
} = {}) {
  const spec = Object.hasOwn(A5_G1_RECORD_SPECS, recordName) ? A5_G1_RECORD_SPECS[recordName] : null
  if (spec === null) {
    throw new TypeError(`governed-families/g1-surface-adapters: "${String(recordName)}" is not a frozen G1 record (the record set is closed)`)
  }
  if (trusted === null || typeof trusted !== 'object'
    || typeof trusted.memberAgentId !== 'string' || trusted.memberAgentId.length === 0
    || typeof trusted.sessionHeaderId !== 'string' || trusted.sessionHeaderId.length === 0
    || typeof trusted.realmId !== 'string' || trusted.realmId.length === 0
    || typeof trusted.owner !== 'string' || trusted.owner.length === 0
    || typeof trusted.profileId !== 'string' || trusted.profileId.length === 0) {
    throw new TypeError(`g1-surface-adapters(${recordName}): trusted {memberAgentId, sessionHeaderId, realmId, owner, profileId} is the CONFIG face every plan target must carry — the model can never name it, so mounting without it is a config defect`)
  }
  if (typeof bindingFacts !== 'function') {
    throw new TypeError(`g1-surface-adapters(${recordName}): bindingFacts (the M1/Guard generation reader) must be injected; the row mints no generations of its own`)
  }
  const bodyKey = spec.capture === 'domain-surface' ? 'decide' : 'execute'
  const captured = native !== undefined && native !== null
  if (captured) {
    if (typeof native !== 'object' || native.name !== recordName) {
      throw new TypeError(`g1-surface-adapters(${recordName}): the captured face must be the bind-time object whose name === record name (a mismatch is a same-name shadow / wiring defect)`)
    }
    if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
      throw new TypeError(`g1-surface-adapters(${recordName}): definitionIdentity is required with a capture (the I arm binds through it)`)
    }
    if (typeof native.description !== 'string' || native.description.length === 0) {
      throw new TypeError(`g1-surface-adapters(${recordName}): the captured face carries no native description (descriptionFrom native-captured has no otherwise)`)
    }
    if (typeof native[bodyKey] !== 'function') {
      throw new TypeError(`g1-surface-adapters(${recordName}): the captured face has no ${bodyKey} function — capture the real face, not a stub`)
    }
    if (spec.capture === 'tool-definition' && (native.parameters === null || typeof native.parameters !== 'object')) {
      throw new TypeError(`g1-surface-adapters(${recordName}): the captured ToolDefinition carries no parameters registration face`)
    }
  }

  const bindBody = captured ? native[bodyKey] : null
  const bindDefinition = captured ? native : null
  const plans = new WeakMap()
  let correlationSeq = 0

  /** classify(args, callId) → the immutable plan the delegate is BOUND to
   * (law 7: only this plan reaches the body, and it rides at most once). */
  function classify(args, callId) {
    if (!captured) {
      return refuse(CODES.CAPTURE_ABSENT, `${recordName}: mounted WITHOUT a captured native face; every entry refuses typed. There is no name-based re-resolution behind a G1 row.`)
    }
    if (typeof callId !== 'string' || callId.length === 0) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, `${recordName}: the A invocation correlation (callId) is required at classify time`)
    }
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, `${recordName}: arguments must be an object`)
    }
    const unknownTop = Object.keys(args).filter((k) => !spec.parametersTopLevel.includes(k))
    if (unknownTop.length > 0) {
      return refuse(CODES.CLASSIFY_UNKNOWN_PARAMETER, `${recordName}: undeclared top-level parameter(s): ${unknownTop.join(', ')} — the governed root is closed (trusted facts such as memberAgentId are CONFIG faces this channel can never receive)`)
    }
    const missingTop = spec.requiredTopLevel.filter((k) => !Object.hasOwn(args, k))
    if (missingTop.length > 0) {
      return refuse(CODES.CLASSIFY_MISSING_PARAMETER, `${recordName}: required parameter(s) missing: ${missingTop.join(', ')}`)
    }
    const built = effectsFor(recordName, args, trusted, ports)
    if (built.ok === false) return built
    const facts = bindingFacts()
    const generations = {
      definitionIdentity,
      providerId,
      bindingId: facts.bindingId,
      bindingRevision: facts.bindingRevision,
      policyGeneration: facts.policyGeneration,
      authorityGeneration: facts.authorityGeneration,
    }
    const targetManifest = deepFreeze({
      operation: spec.operation === 'profile-management-action' && typeof args.action === 'string'
        ? `plugin_manager:${args.action}`
        : spec.operation,
      trusted: {
        memberAgentId: trusted.memberAgentId,
        sessionHeaderId: trusted.sessionHeaderId,
        realmId: trusted.realmId,
        owner: trusted.owner,
        profileId: trusted.profileId,
      },
      ...built.targetFacts,
    })
    const reviewPayload = deepFreeze({
      familyId: spec.family,
      adapterRevision: A5_G1_ADAPTER_REVISION,
      providerIdentity: providerId,
      definitionIdentity,
      targetManifest,
    })
    const serviceObligations = deepFreeze(built.obligations ?? spec.obligations ?? [])
    correlationSeq += 1
    const correlation = `g1.r${A5_G1_ADAPTER_REVISION}.${correlationSeq}.${callId}`
    const classifiedArgs = deepFreeze(jsonClone(args))
    const parametersFingerprint = `sha256:${sha256(canonicalJson({
      recordName,
      adapterRevision: A5_G1_ADAPTER_REVISION,
      callId,
      generations,
      effects: built.effects,
      serviceObligations,
      reviewPayload,
      args,
    }))}`
    const plan = deepFreeze({
      recordName,
      familyId: spec.family,
      adapterRevision: A5_G1_ADAPTER_REVISION,
      callId,
      correlation,
      classifiedArgs,
      effects: built.effects,
      serviceObligations,
      targetManifest,
      reviewPayload,
      generations,
      parametersFingerprint,
    })
    plans.set(plan, { state: 'CLASSIFIED', correlation })
    observe({ event: 'classify', name: recordName, detail: parametersFingerprint })
    return {
      ok: true,
      plan,
      name: recordName,
      familyId: spec.family,
      adapterRevision: A5_G1_ADAPTER_REVISION,
      effects: plan.effects,
      serviceObligations: plan.serviceObligations,
      targetManifest: plan.targetManifest,
      reviewPayload: plan.reviewPayload,
      generations: plan.generations,
      parametersFingerprint: plan.parametersFingerprint,
    }
  }

  /** Map one cancelInstall answer VERBATIM-honestly (law 5): too-late stays
   * too-late, not-running never implies completion, unknown stays unknown. */
  function mapCancelAnswer(answer) {
    if (answer === null || typeof answer !== 'object') return { state: 'unknown-answer', completionImplied: false, answer }
    const raw = answer.state ?? (answer.tooLate === true ? 'too-late' : answer.cancelled === true ? 'cancelled' : undefined)
    switch (raw) {
      case 'too-late':
        return { state: 'too-late', completionImplied: false, detail: 'applying already: cancellation is too late; the outcome stays unsettled by this row — never a rollback claim, never a completion claim', answer }
      case 'not-running':
        return { state: 'not-running', completionImplied: false, detail: 'not-running CANNOT be read as completion — the settlement is simply unknown to this face', answer }
      case 'cancelled':
        return { state: 'cancelled-confirmed', completionImplied: false, detail: 'confirmed only while installing; "copying stopped" is never claimed from this answer', answer }
      default:
        return { state: 'unknown-answer', completionImplied: false, answer }
    }
  }

  /** The present durable witness (law 6): ONLY the SAME call's listener
   * append settles the commit; anything else refuses typed. */
  function commitWitness(plan, witness) {
    const entry = plans.get(plan)
    if (entry === undefined) return refuse(CODES.NOT_OWN_PLAN, `${recordName}: commitWitness answers only to a plan this row classified`)
    if (entry.state === 'COMMITTED') return refuse(CODES.ALREADY_DELEGATED, 'the commit was already witnessed once')
    if (entry.state !== 'RESULT_PENDING_SESSION_APPEND') {
      return refuse(CODES.PRESENT_COMMIT_WITNESS_MISMATCH, `plan is ${entry.state}; there is no pending append to witness`)
    }
    if (witness === null || typeof witness !== 'object' || witness.callId !== plan.callId || !Number.isInteger(witness.turn)) {
      return refuse(CODES.PRESENT_COMMIT_WITNESS_MISMATCH, 'the durable witness must answer THIS call (callId) and carry the native turn number — a same-exec listener append, never an unrelated word')
    }
    entry.state = 'COMMITTED'
    entry.commitTurn = witness.turn
    observe({ event: 'backend-commit', name: recordName, detail: `${plan.correlation}|turn:${witness.turn}` })
    return { ok: true, settled: 'COMMITTED', turn: witness.turn }
  }

  /**
   * The ONE delegate edge: only plans this row classified, only ONCE, and
   * only the plan's own frozen arguments (the caller cannot swap anything);
   * M1 A owns the real PA edge — this row consumes no approval itself.
   * commitLaw rows answer PENDING until the durable witness arrives.
   */
  function delegate(plan, ctx = {}) {
    if (!captured) {
      return Promise.resolve(refuse(CODES.CAPTURE_ABSENT, `${recordName}: no captured native face — zero native entry, and this refusal never converts into a native lookup`))
    }
    const entry = plans.get(plan)
    if (entry === undefined) return Promise.resolve(refuse(CODES.NOT_OWN_PLAN, `${recordName}: delegate answers only to a plan this row classified (the plan, not the caller, owns the arguments)`))
    if (entry.state !== 'CLASSIFIED') return Promise.resolve(refuse(CODES.ALREADY_DELEGATED, `${recordName}: this plan already delegated (state ${entry.state}); no replay, ever`))
    if (bindDefinition[bodyKey] !== bindBody) {
      return Promise.resolve(refuse(CODES.DEFINITION_DRIFT, `${recordName}: the captured face's ${bodyKey} function moved since bind time — there is no replacement-body path`))
    }
    if (recordName === 'plugin_manager' && plan.targetManifest.action === 'install_bundle' && ports.installLifecycle === undefined) {
      return Promise.resolve(refuse(CODES.INSTALL_LIFECYCLE_ABSENT, 'plugin_manager install_bundle: the host lifecycle face (waitForInstall/cancelInstall) is not mounted — an install nobody can wait for or cancel is ungovernable; refused BEFORE any native entry (zero fetch)'))
    }
    entry.state = 'DELEGATED'
    observe({ event: 'backend-start', name: recordName, detail: plan.correlation })
    // THE native call: plan-owned arguments, captured function VALUE,
    // captured receiver; the real exec (incl. its signal) rides unchanged.
    return Promise.resolve(bindBody.call(bindDefinition, plan.classifiedArgs, ctx.exec)).then(
      (value) => {
        if (spec.commitLaw === 'session-append') {
          entry.state = 'RESULT_PENDING_SESSION_APPEND'
          observe({ event: 'backend-result', name: recordName, detail: 'pending-session-append' })
          return {
            ok: true,
            value,
            settled: 'RESULT-PENDING-SESSION-APPEND',
            commitLaw: 'the durable commit witness is the same-exec tools/result listener session.append; this promise resolving is NOT the backend commit',
            commitWitness: (witness) => commitWitness(plan, witness),
          }
        }
        if (recordName === 'plugin_manager' && plan.targetManifest.action === 'install_bundle') {
          const requestId = extractRequestId(value)
          if (requestId === null) {
            entry.state = 'NATIVE_RESOLVED_INSTALL_UNBOUND'
            return { ok: true, value, settled: 'INSTALL-REQUEST-ID-UNBOUND', detail: 'the native result carried no requestId — nothing can be waited on or cancelled; honestly reported, never assumed' }
          }
          entry.state = 'INSTALL_REQUESTED'
          const lifecycle = {
            requestId,
            boundTo: { owner: trusted.owner, correlation: plan.correlation, callId: plan.callId },
            cancelNow: () => mapCancelAnswer(ports.installLifecycle.cancelInstall(requestId)),
            waitFor: () => Promise.resolve(ports.installLifecycle.waitForInstall(requestId)),
            law: 'cancel confirmable ONLY while installing; applying ⇒ too-late preserved; not-running never implies completion; an abort does NOT claim copying auto-stopped',
          }
          const signal = ctx.exec?.signal
          if (signal !== undefined && signal !== null && typeof signal.addEventListener === 'function') {
            if (signal.aborted === true) lifecycle.abortCancelAnswer = lifecycle.cancelNow()
            else signal.addEventListener('abort', () => { lifecycle.abortCancelAnswer = lifecycle.cancelNow() }, { once: true })
            lifecycle.abortMappedToCancelInstall = true
          }
          observe({ event: 'install-request-bound', name: recordName, detail: requestId })
          return { ok: true, value, settled: 'INSTALL-REQUESTED', lifecycle }
        }
        entry.state = 'NATIVE_RESOLVED'
        observe({ event: 'backend-commit', name: recordName, detail: plan.correlation })
        return { ok: true, value, settled: 'NATIVE-RESOLVED' }
      },
      (error) => {
        entry.state = 'FAILED-UNKNOWN'
        observe({ event: 'backend-end', name: recordName, detail: 'error' })
        throw error
      },
    )
  }

  // Shallow freeze: the row is immutable, but the PASSED-THROUGH native
  // registration face stays exactly as captured (this row never freezes —
  // let alone rewrites — a face it does not own).
  return Object.freeze({
    name: recordName,
    familyId: spec.family,
    recordIndex: spec.recordIndex,
    scope: spec.scope,
    ownerRole: spec.ownerRole,
    adapterRevision: A5_G1_ADAPTER_REVISION,
    nativeFaceRef: spec.nativeFaceRef,
    effectDeltaNotes: spec.effectDeltaNotes,
    capturePresent: captured,
    providerId,
    definitionIdentity: captured ? definitionIdentity : null,
    descriptionFrom: 'native-captured',
    description: captured ? bindDefinition.description : null,
    parameters: captured && spec.capture === 'tool-definition' ? bindDefinition.parameters : null,
    classify,
    delegate,
    commitWitness: spec.commitLaw === 'session-append' ? commitWitness : undefined,
  })
}
