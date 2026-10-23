/**
 * governed-families/g1-surface-adapters.mjs — A5-M2 module group G1: the THIN
 * captured-native-delegate adapter definitions for the 14 records of families
 * B-CONTROL / B-HUMAN / B-PRESENT / B-PLUGIN / B-INSPECT / B-SKILL /
 * B-DEPENDENCY / B-DOMAIN
 * (docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/
 *  M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json, records 24, 25, 49–54, 83–85,
 *  87, 88, 91; family law M0-B-FAMILY-TARGET-CONTRACTS.md §3).
 *
 * SHAPE (house pattern = governed-families/todo.mjs, thinned to this round's
 * obligation): the glue CAPTURES the native face once at bind time — the
 * registered Host ToolDefinition read through the public
 * `tools.get(name, scope)` seam (core/tools/src/index.ts:1230 @639ed01539),
 * or, for the five B-CONTROL rows, the Team definition produced by
 * `packages/tools/src/tools.ts:createTeamTools` — and mounts ONE row via
 * `mountG1SurfaceAdapter(name, { native })`. The row:
 *   - `descriptionFrom: 'native-captured'` — the description is the CAPTURED
 *     definition's own words, never authored here;
 *   - `parameters` — the captured registration face passed through BY
 *     REFERENCE. The registration face is canonical JSON Schema (parent-level
 *     `required` arrays); the per-property `required: true` spelling is the
 *     host defineTool INPUT DSL (core/tools/src/schema.ts:97 @639ed01539),
 *     translated by `parameterSchemaSpecToJsonSchema` BEFORE registration, so
 *     it never reaches this layer and nothing here re-writes the face;
 *   - `classify(args)` — PURE effect summary: closed top-level parameter
 *     check, the single `tool-invoke` effect (M0-B §1.1: this accurate
 *     trusted tool's execution licence IS the tool-invoke arm), a minimal
 *     target summary, the record's effect-delta NOTES from the frozen index
 *     (notes are review vocabulary, not invented PA Effect kinds), and a
 *     full-VALUES `parametersFingerprint` (`sha256:<hex64>`, todo law).
 *     Zero disk, zero network, zero service calls;
 *   - `delegate({ args, exec })` — the ONLY path to the native body: the
 *     bind-time captured FUNCTION VALUE (`native.execute` / `native.decide`)
 *     called against the captured object, after a definition-drift re-check.
 *     Results and rejections pass through honestly — the row beautifies
 *     nothing and swallows nothing.
 *
 * CAPTURE LAW: `mountG1SurfaceAdapter` never looks a tool up by name and has
 * no lazy-registry fallback (M0-B §1: 实际body是同一owned adapter闭包，不在
 * 批准后按名字重新找Host原生body). When the glue could not capture the face
 * it mounts with `native: undefined` and EVERY entry answers the typed
 * refusal `P_G1_NATIVE_CAPTURE_ABSENT` — a known, governed, refusing row,
 * never a silent hole and never a native re-resolution. A present-but-wrong
 * capture (name mismatch, no execute/decide function) is a CONFIG DEFECT and
 * throws at assembly (the jobsEnabled-law family: never silently defaults).
 *
 * WHAT THIS FILE IS NOT: it is not an admission kernel (M1 A owns Control/PA
 * consumption; the integrator wraps these rows in the same plane the todo row
 * rides), not a permission layer (no new Effect kinds, no new ledger, no
 * invented approval: the gate is config law, the native owner/leader/ceiling
 * checks stay in the captured native bodies), not a re-implementation of any
 * host validation (defineTool validates args against the SAME passed-through
 * face inside the captured execute; this classify only refuses UNDECLARED
 * top-level parameters, the todo closed-root law).
 *
 * @module runtime/plugin/live/governed-families/g1-surface-adapters
 */
import { createHash } from 'node:crypto'

/** Module-group identity: this is the G1 surface lane, one revision. */
export const A5_G1_FAMILY_GROUP = 'G1'
export const A5_G1_ADAPTER_REVISION = 1

/**
 * Typed refusal codes for the G1 rows. Naming belongs to the governance
 * error family (AUTH/CENTER pin the final vocabulary); the STRINGS are the
 * contract this lane's spec pins.
 */
export const A5_G1_TYPED_CODES = Object.freeze({
  /** The glue mounted the row without a captured native face: the row
   * refuses every call typed. There is NO name-based fallback to fall back
   * to — capture absent is governed absence, not a re-resolution request. */
  CAPTURE_ABSENT: 'P_G1_NATIVE_CAPTURE_ABSENT',
  CLASSIFY_INVALID_ARGUMENTS: 'P_G1_CLASSIFY_INVALID_ARGUMENTS',
  CLASSIFY_UNKNOWN_PARAMETER: 'P_G1_CLASSIFY_UNKNOWN_PARAMETER',
  CLASSIFY_MISSING_PARAMETER: 'P_G1_CLASSIFY_MISSING_PARAMETER',
  /** The captured face's execute/decide function value moved after bind
   * time: the governed call refuses; there is no replacement-body path. */
  DEFINITION_DRIFT: 'P_G1_DEFINITION_DRIFT',
})
const CODES = A5_G1_TYPED_CODES

const refuse = (code, detail) => ({ ok: false, code, detail })

const canonicalJson = (value) => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
))

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner)
    Object.freeze(value)
  }
  return value
}

/**
 * THE FROZEN RECORD MAP. `recordIndex`/`family`/`scope`/`ownerRole` mirror the
 * frozen dispatch index one-for-one (the G1 spec cross-checks them against
 * M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json directly); `nativeFace` records the
 * REAL execution entry the thin row delegates to (host fixed source
 * 639ed01539; Team own-layer source beside it) — read at the pinned tree, so
 * the integrator never re-hunts it; `effectDeltaNotes` are the index's
 * `recordEffectDeltaFromInventory` words, carried as review NOTES (they are
 * the record's obligation vocabulary, not invented effect kinds).
 *
 * `parametersTopLevel` is the closed top-level parameter set of the CAPTURED
 * registration face (read from the fixed source); `null` is never used — a
 * row whose native face declares no parameters carries `[]`.
 */
export const A5_G1_RECORD_SPECS = Object.freeze({
  skill: Object.freeze({
    recordIndex: 24,
    family: 'B-SKILL',
    scope: 'host-preset-on',
    ownerRole: 'SERVICE',
    capture: 'tool-definition',
    operation: 'load-skill-instructions',
    parametersTopLevel: Object.freeze(['name']),
    requiredTopLevel: Object.freeze(['name']),
    targetKeys: Object.freeze(['name']),
    nativeFace: 'HOST @deepseek-ai/dsh-tool-skill packages/skill/tool-skill/src/index.ts: ctx.tools.register(defineTool({name:\'skill\'})) @:81/:161; native body = ctx.skills.list(lookup) + ctx.skills.get(name, lookup) with the isModelInvocable double-gate @:138/:145',
    effectDeltaNotes: Object.freeze(['prompt-injection-surface', 'catalog-publish']),
  }),
  load_workspace_dependencies: Object.freeze({
    recordIndex: 25,
    family: 'B-DEPENDENCY',
    scope: 'host-sdk-app-env-only',
    ownerRole: 'PLUGIN',
    capture: 'tool-definition',
    operation: 'query-and-first-execution-install',
    parametersTopLevel: Object.freeze([]),
    requiredTopLevel: Object.freeze([]),
    targetKeys: Object.freeze([]),
    nativeFace: 'HOST @deepseek-ai/dsh-tool-workspace-dependencies packages/skill/tool-workspace-dependencies/src/index.ts: ctx.tools.register(defineTool({name:\'load_workspace_dependencies\'})) @:249; native body = memoized first-execution installPrimaryRuntime(source, root) @:204-235 (mkdir/cp/rename/rm, no PATH change)',
    effectDeltaNotes: Object.freeze(['runtime-payload-install-mkdir-cp-rename-rm']),
  }),
  ask_user_question: Object.freeze({
    recordIndex: 49,
    family: 'B-HUMAN',
    scope: 'host-preset-on',
    ownerRole: 'SERVICE',
    capture: 'tool-definition',
    operation: 'ask-current-session',
    parametersTopLevel: Object.freeze(['questions']),
    requiredTopLevel: Object.freeze(['questions']),
    targetKeys: Object.freeze([]),
    nativeFace: 'HOST @deepseek-ai/dsh-tool-ask-user packages/interaction/tool-ask-user/src/index.ts: ctx.tools.register(defineTool({name:\'ask_user_question\'})) @:42; native body = ctx.userQuestions.ask({ questions, agent, signal }) (blocking question-answer)',
    effectDeltaNotes: Object.freeze(['human-input-channel']),
  }),
  exit_plan_mode: Object.freeze({
    recordIndex: 50,
    family: 'B-HUMAN',
    scope: 'host-preset-on',
    ownerRole: 'SERVICE',
    capture: 'tool-definition',
    operation: 'exit-plan-mode-via-host-approval',
    parametersTopLevel: Object.freeze(['plan']),
    requiredTopLevel: Object.freeze(['plan']),
    targetKeys: Object.freeze([]),
    nativeFace: 'HOST dsh-plan-mode packages/plan/plan-mode/src/index.ts: ctx.tools.register(defineTool({name:EXIT_PLAN_MODE})) @:278 (const EXIT_PLAN_MODE @:67); native body = PlanModeController.loggedActive + ctx.get(\'userQuestions\').ask(plan-review) — the mode switch only on the Host approval answer',
    effectDeltaNotes: Object.freeze(['session-mode-transition-approval-gate']),
  }),
  present: Object.freeze({
    recordIndex: 51,
    family: 'B-PRESENT',
    scope: 'host-preset-on',
    ownerRole: 'SERVICE',
    capture: 'tool-definition',
    operation: 'expose-deliverables-no-copy',
    parametersTopLevel: Object.freeze(['files']),
    requiredTopLevel: Object.freeze(['files']),
    targetKeys: Object.freeze([]),
    nativeFace: 'HOST @deepseek-ai/dsh-tool-present packages/deliverables/tool-present/src/index.ts: ctx.tools.register(defineTool({name:\'present\'})) @:38; native body = ctx.fs.lstat/resolve/stat checks + ctx.sessionProjections.stateOf(session,\'turnBoundary\') + session.append(\'deliverables/presented\') on tools/result',
    effectDeltaNotes: Object.freeze(['file-expose-deliverable-card']),
  }),
  plugin_manager: Object.freeze({
    recordIndex: 52,
    family: 'B-PLUGIN',
    scope: 'host-preset-conditional',
    ownerRole: 'PLUGIN',
    capture: 'tool-definition',
    operation: 'profile-management-action',
    parametersTopLevel: Object.freeze(['action', 'target', 'enabled', 'runtimeVersion', 'acceptRisk', 'approvedBuilds', 'registry', 'offset', 'limit']),
    requiredTopLevel: Object.freeze(['action']),
    targetKeys: Object.freeze(['action', 'target']),
    nativeFace: 'HOST @deepseek-ai/dsh-boot-plugin-manager packages/boot/plugin-manager/src/tools.ts: ctx.tools.register(defineTool({name:\'plugin_manager\'})) @:19 (closed 8-action enum @:24); native body = approveEscalation(danger-full-access) @:38 then ctx.pluginManager.{listPlugins|listBundles|setPluginEnabled|setBundleEnabled|installBundle|removeBundle|listVersionExemptions|setVersionExemption} @:47-94',
    effectDeltaNotes: Object.freeze(['profile-config-write-persist-all-sessions', 'npm-install-build-script-exec', 'peer-dep-exemption']),
  }),
  cordis_inspect_list: Object.freeze({
    recordIndex: 53,
    family: 'B-INSPECT',
    scope: 'host-preset-cordis-only',
    ownerRole: 'SERVICE',
    capture: 'tool-definition',
    operation: 'list-inspect-providers',
    parametersTopLevel: Object.freeze([]),
    requiredTopLevel: Object.freeze([]),
    targetKeys: Object.freeze([]),
    nativeFace: 'HOST @deepseek-ai/dsh-tool-cordis packages/extensions/tool-cordis/src/index.ts: ctx.tools.register(defineTool({name:\'cordis_inspect_list\'})) @:22; native body = ctx.cordisInspect.list() (closed-registry read-only)',
    effectDeltaNotes: Object.freeze(['runtime-topology-disclosure']),
  }),
  cordis_inspect_query: Object.freeze({
    recordIndex: 54,
    family: 'B-INSPECT',
    scope: 'host-preset-cordis-only',
    ownerRole: 'SERVICE',
    capture: 'tool-definition',
    operation: 'query-inspect-provider',
    parametersTopLevel: Object.freeze(['platform', 'provider', 'method', 'input']),
    requiredTopLevel: Object.freeze(['platform', 'provider', 'method']),
    targetKeys: Object.freeze(['platform', 'provider', 'method']),
    nativeFace: 'HOST @deepseek-ai/dsh-tool-cordis packages/extensions/tool-cordis/src/index.ts: ctx.tools.register(defineTool({name:\'cordis_inspect_query\'})) @:41; native body = ctx.cordisInspect.query(platform, provider, method, input, agent, signal) over the registry packages/extensions/cordis-host-runner/src/inspect-registry.ts (client queries wait the browser page)',
    effectDeltaNotes: Object.freeze(['runtime-topology-disclosure', 'client-browser-roundtrip']),
  }),
  team_request_control: Object.freeze({
    recordIndex: 83,
    family: 'B-CONTROL',
    scope: 'own-layer',
    ownerRole: 'CONTROL',
    capture: 'tool-definition',
    operation: 'request-control',
    parametersTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'kind', 'targetInstanceId', 'actionName', 'toolName', 'summary']),
    requiredTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'kind', 'targetInstanceId', 'actionName']),
    targetKeys: Object.freeze(['kind', 'targetInstanceId', 'actionName']),
    nativeFace: 'TEAM packages/tools/src/tools.ts: createTeamTools -> requestControlSpec @:958 -> options.controlService.requestControl @:1000 (the ONE Control ledger; caller/root check in makeDefinition @:430+)',
    effectDeltaNotes: Object.freeze(['approval-durable-write-via-ControlService']),
  }),
  team_resolve_control: Object.freeze({
    recordIndex: 84,
    family: 'B-CONTROL',
    scope: 'own-layer',
    ownerRole: 'CONTROL',
    capture: 'tool-definition',
    operation: 'resolve-control',
    parametersTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'requestId', 'decision', 'note']),
    requiredTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'requestId', 'decision']),
    targetKeys: Object.freeze(['requestId', 'decision']),
    nativeFace: 'TEAM packages/tools/src/tools.ts: createTeamTools -> resolveControlSpec @:1015 -> controlService.escalateApprovalLeg @:1065 (decision=escalate) or controlService.resolveControl @:1073; resolver roles are service-side law',
    effectDeltaNotes: Object.freeze(['approval-durable-write-via-ControlService']),
  }),
  team_list_pending_control: Object.freeze({
    recordIndex: 85,
    family: 'B-CONTROL',
    scope: 'own-layer',
    ownerRole: 'CONTROL',
    capture: 'tool-definition',
    operation: 'list-pending-control',
    parametersTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'limit']),
    requiredTopLevel: Object.freeze(['rootSessionId', 'requestToken']),
    targetKeys: Object.freeze([]),
    nativeFace: 'TEAM packages/tools/src/tools.ts: createTeamTools -> listPendingControlSpec -> controlService.listControlState @:1163 + controlService.listOpenApprovalCases @:1164 (Leader-only BEFORE any read; creates nothing, grants nothing)',
    effectDeltaNotes: Object.freeze(['approval-durable-read']),
  }),
  team_grant_permission: Object.freeze({
    recordIndex: 87,
    family: 'B-CONTROL',
    scope: 'own-layer',
    ownerRole: 'CONTROL',
    capture: 'tool-definition',
    operation: 'grant-permission',
    parametersTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'targetInstanceId', 'rules']),
    requiredTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'targetInstanceId', 'rules']),
    targetKeys: Object.freeze(['targetInstanceId']),
    nativeFace: 'TEAM packages/tools/src/tools.ts: createTeamTools -> permissionSpec(\'grant\') @:1370 -> Leader-only check, permission.canonicalizeExecIntent @:1427 / canonicalizeFile @:1445, then permission.mutatePermission @:1479 (carrier coverage + dual ceilings service-side)',
    effectDeltaNotes: Object.freeze(['permission-overlay-durable-write']),
  }),
  team_revoke_permission: Object.freeze({
    recordIndex: 88,
    family: 'B-CONTROL',
    scope: 'own-layer',
    ownerRole: 'CONTROL',
    capture: 'tool-definition',
    operation: 'revoke-permission',
    parametersTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'targetInstanceId', 'rules']),
    requiredTopLevel: Object.freeze(['rootSessionId', 'requestToken', 'targetInstanceId', 'rules']),
    targetKeys: Object.freeze(['targetInstanceId']),
    nativeFace: 'TEAM packages/tools/src/tools.ts: createTeamTools -> permissionSpec(\'revoke\') @:1370 -> same face with kind revoke_permission; reveal-as-expansion stays gated in the SAME mutation authority (no second ledger)',
    effectDeltaNotes: Object.freeze(['permission-overlay-durable-write']),
  }),
  'surface:domain_family': Object.freeze({
    recordIndex: 91,
    family: 'B-DOMAIN',
    scope: 'surface',
    ownerRole: 'CONNECTOR',
    capture: 'domain-surface',
    operation: 'domain-decision-at-effect-boundary',
    parametersTopLevel: Object.freeze(['toolName', 'domainAuthorityId', 'targetDigest']),
    requiredTopLevel: Object.freeze(['toolName', 'domainAuthorityId']),
    targetKeys: Object.freeze(['toolName', 'domainAuthorityId']),
    // Provenance (comment-side by law: the governance-lane import audit
    // counts string literals as edges): the domain-ref effect kind this
    // surface decides for lives at packages/domain/tool-governance/src/
    // effects.ts:43,72-113 (@ the int HEAD).
    nativeFace: 'NOT a model tool (surface record): the independent Domain Authority consulted AT the effect-commit boundary (M0-B §3 B-DOMAIN; ADR L72/L75). The captured face is the mounted connector port { name:\'surface:domain_family\', description, decide(request) }; its effect kind is the lane\'s frozen domain-ref (see the provenance comment above). No host tool exists to capture and none is invented.',
    effectDeltaNotes: Object.freeze(['domain-business-effect-at-plugin-boundary-family-level']),
  }),
})

/** The 14 record names, in frozen-index order. */
export function g1SurfaceAdapterNames() {
  return Object.keys(A5_G1_RECORD_SPECS)
    .sort((a, b) => A5_G1_RECORD_SPECS[a].recordIndex - A5_G1_RECORD_SPECS[b].recordIndex)
    .slice()
}

/**
 * The minimal pure target summary (classify is 纯解析: no service may be
 * consulted to "discover" the target — a lookup-requiring fact is its own
 * governed call, M0-B §1).
 */
function summarizeTarget(spec, args) {
  const target = {}
  for (const key of spec.targetKeys) {
    if (Object.hasOwn(args, key)) target[key] = args[key]
  }
  return target
}

function operationFor(spec, args) {
  if (spec.operation === 'profile-management-action') {
    return typeof args.action === 'string' ? `plugin_manager:${args.action}` : spec.operation
  }
  return spec.operation
}

/**
 * Mount ONE thin G1 row for a frozen record name.
 *
 * @param {string} recordName - one of `g1SurfaceAdapterNames()`; any other
 *   word is a wiring bug and throws.
 * @param {object} deps
 * @param {object|undefined} deps.native - the face CAPTURED by the glue at
 *   bind time (`tools.get(name, scope)` for the 13 tool rows; the mounted
 *   Domain port for `surface:domain_family`). `undefined` = capture failed:
 *   the row mounts governed-but-refusing (typed on every entry).
 * @param {string} [deps.providerId] - the trusted assembly placing the row.
 * @param {(row: {event: string, name: string, detail?: string}) => void} [deps.observe]
 *   - the §1.2 minimal observation.
 */
export function mountG1SurfaceAdapter(recordName, { native, providerId = 'unknown-placer', observe = () => {} } = {}) {
  const spec = Object.hasOwn(A5_G1_RECORD_SPECS, recordName) ? A5_G1_RECORD_SPECS[recordName] : null
  if (spec === null) {
    throw new TypeError(`governed-families/g1-surface-adapters: "${String(recordName)}" is not a frozen G1 record (the record set is closed: ${g1SurfaceAdapterNames().join(', ')})`)
  }
  const bodyKey = spec.capture === 'domain-surface' ? 'decide' : 'execute'
  if (native !== undefined && native !== null) {
    // A present-but-wrong capture is a CONFIG DEFECT (never silently
    // accepted, never a lazy retry): refuse at assembly.
    if (typeof native !== 'object' || native.name !== recordName) {
      throw new TypeError(`g1-surface-adapters(${recordName}): the captured face must be the object bound AT bind time whose name === record name (a name mismatch is a same-name shadow / wiring defect)`)
    }
    if (typeof native.description !== 'string' || native.description.length === 0) {
      throw new TypeError(`g1-surface-adapters(${recordName}): the captured face carries no native description (descriptionFrom:'native-captured' has no otherwise)`)
    }
    if (typeof native[bodyKey] !== 'function') {
      throw new TypeError(`g1-surface-adapters(${recordName}): the captured face has no ${bodyKey} function — capture the real definition/port, not a stub`)
    }
    if (spec.capture === 'tool-definition' && (native.parameters === null || typeof native.parameters !== 'object')) {
      throw new TypeError(`g1-surface-adapters(${recordName}): the captured ToolDefinition carries no parameters registration face`)
    }
  }

  const captured = native !== undefined && native !== null
  // BIND-TIME FUNCTION-VALUE SNAPSHOT (todo root card ③): a later property
  // replacement on the live object can neither redirect nor smuggle a body.
  const bindBody = captured ? native[bodyKey] : null
  const bindDefinition = captured ? native : null

  function classify(args) {
    if (!captured) {
      return refuse(CODES.CAPTURE_ABSENT, `${recordName}: the glue mounted this row WITHOUT a captured native face; the governed call refuses typed. There is no name-based re-resolution and no native fallback behind a G1 row.`)
    }
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      return refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, `${recordName}: arguments must be an object`)
    }
    const unknownTop = Object.keys(args).filter((k) => !spec.parametersTopLevel.includes(k))
    if (unknownTop.length > 0) {
      return refuse(CODES.CLASSIFY_UNKNOWN_PARAMETER, `${recordName}: undeclared top-level parameter(s): ${unknownTop.join(', ')} — the governed root is closed (the todo closed-root law; the native schema never sees them)`)
    }
    const missingTop = spec.requiredTopLevel.filter((k) => !Object.hasOwn(args, k))
    if (missingTop.length > 0) {
      return refuse(CODES.CLASSIFY_MISSING_PARAMETER, `${recordName}: required parameter(s) missing: ${missingTop.join(', ')}`)
    }
    // M0-B §1.1: the accurate trusted tool's execution licence is THE
    // tool-invoke effect; the B-DOMAIN surface row answers for the
    // domain-ref arm it gates (the Domain Authority is its own identity,
    // effects.ts:106-113 — this row never presumes its answer).
    const effects = spec.capture === 'domain-surface'
      ? [{ kind: 'domain-ref', domainAuthorityId: args.domainAuthorityId, resource: null }]
      : [{ kind: 'tool-invoke', toolName: recordName, resource: null }]
    const targetManifest = deepFreeze({
      operation: operationFor(spec, args),
      ...summarizeTarget(spec, args),
    })
    const parametersFingerprint = `sha256:${sha256(canonicalJson({
      recordName,
      adapterRevision: A5_G1_ADAPTER_REVISION,
      args,
    }))}`
    observe({ event: 'classify', name: recordName, detail: parametersFingerprint })
    return deepFreeze({
      ok: true,
      name: recordName,
      familyId: spec.family,
      adapterRevision: A5_G1_ADAPTER_REVISION,
      effects,
      effectDeltaNotes: spec.effectDeltaNotes,
      targetManifest,
      parametersFingerprint,
    })
  }

  /**
   * The thin delegate edge: the glue calls this only for a plan its own
   * admission answered for (M1 A owns admission; this row owns NOTHING
   * there). `ctx = { args, exec }` — the classified arguments and the REAL
   * host exec the plane dispatched with; the captured native body decides
   * everything else (owner/root/leader/ceiling/host gates included).
   */
  function delegate(ctx) {
    if (!captured) {
      return Promise.resolve(refuse(CODES.CAPTURE_ABSENT, `${recordName}: no captured native face — the body never runs (zero native entry), and this refusal never converts into a native lookup`))
    }
    if (bindDefinition[bodyKey] !== bindBody) {
      return Promise.resolve(refuse(CODES.DEFINITION_DRIFT, `${recordName}: the captured face's ${bodyKey} function moved since bind time — the governed call refuses; there is no replacement-body path`))
    }
    if (ctx === null || typeof ctx !== 'object' || ctx.args === undefined) {
      return Promise.resolve(refuse(CODES.CLASSIFY_INVALID_ARGUMENTS, `${recordName}: delegate takes { args, exec } — the classified arguments ride to the native body unchanged`))
    }
    observe({ event: 'backend-start', name: recordName, detail: 'captured-native' })
    // THE native call: captured function VALUE, captured receiver, arguments
    // unchanged. Result and rejection pass through — honesty over polish.
    return Promise.resolve(bindBody.call(bindDefinition, ctx.args, ctx.exec))
      .then(
        (value) => {
          observe({ event: 'backend-commit', name: recordName, detail: 'ok' })
          return value
        },
        (error) => {
          observe({ event: 'backend-end', name: recordName, detail: 'error' })
          throw error
        },
      )
  }

  // Shallow freeze: the row itself is immutable, but the PASSED-THROUGH
  // native registration face is left exactly as captured (this row never
  // freezes — let alone rewrites — a face it does not own).
  return Object.freeze({
    name: recordName,
    familyId: spec.family,
    recordIndex: spec.recordIndex,
    scope: spec.scope,
    ownerRole: spec.ownerRole,
    adapterRevision: A5_G1_ADAPTER_REVISION,
    nativeFace: spec.nativeFace,
    capturePresent: captured,
    providerId,
    descriptionFrom: 'native-captured',
    description: captured ? bindDefinition.description : null,
    // REGISTRATION-FACE PASSTHROUGH (by reference — canonical face in,
    // canonical face out; no rewrite, no property-level markers here).
    parameters: captured && spec.capture === 'tool-definition' ? bindDefinition.parameters : null,
    classify,
    delegate,
  })
}
