/**
 * governed-families/g2-connector-adapters.mjs — A5-M2 group G2 (CONNECTOR):
 * the THIN captured-native-delegate rows for the real web / MCP / browser
 * interfaces (13 frozen records of
 * `docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json`:
 * B-WEB 22 web_fetch, 23 web_search; B-MCP 55 list_mcp_resource_templates,
 * 56 list_mcp_resources, 57 read_mcp_resource, 89 surface:mcp_stdio,
 * 90 surface:mcp_http_dynamic; B-BROWSER 58–63 stagehand_act/extract/
 * navigate/observe/screenshot/tabs).
 *
 * PATTERN (dispatch law): capture → classify → delegate.
 *  - CAPTURE: the native definition is read ONCE at bind time through the
 *    injected `readNative(name)` seam (the production assembly builds it as
 *    `name => ctx.tools.get(name, scope)` — host core/tools index.ts:1230
 *    `get(name, scope?)` @639ed01539) and its `execute` FUNCTION VALUE is
 *    snapshotted; at the delegate edge the arm re-verifies the definition's
 *    execute is still that exact function (`P_G2_DEFINITION_DRIFT`), so a
 *    later property replacement never redirects the call. The row NEVER
 *    re-resolves the body by name at execution time.
 *  - CLASSIFY: pure parse over the frozen model argument (zero disk, zero
 *    network, zero service probe — §1). Every emitting path answers the
 *    CLOSED-set effect array (§1.1: I = tool-invoke; N = connect over a
 *    `network-destination` origin) and the arm fail-closes its own output
 *    through the very `parseRequestedEffectSet` the Guard uses. Everything
 *    that is S(service,target,operation) semantics stays MANIFEST NOTATION
 *    with the real native entry quoted — never an invented PA kind.
 *  - DELEGATE: the captured execute, verbatim args, the caller's own exec —
 *    保留原生. A native throw re-raises (honesty; no swallow, no second
 *    protocol). No approval logic lives here: A (the M1 admission edge) owns
 *    admission; these rows are the pre-takeover arms the center wires, the
 *    same seat todo.mjs/image.mjs hold for their families.
 *
 * MOUNT CONDITIONS (route-records-v3c, frozen):
 *  - web_fetch / web_search — `mountCondition: always`: the rows always
 *    EXIST; if the captured native face is absent the row refuses TYPED
 *    (`P_G2_NATIVE_FACE_ABSENT`) with zero delegation — it never silently
 *    substitutes a fetch/search of its own (the fixed-URL-fake class the web
 *    lane already outlawed at web-gateway-assembly.mjs).
 *  - MCP trio + stagehand six — `mountCondition: declared_mount`: the rows
 *    mount ONLY when the placement assembly presents the TRUSTED declared
 *    service proof (`declaredService.present === true` + the closed surface
 *    facts). Without the proof the factory returns honest INACTIVE rows
 *    (`P_G2_DECLARED_MOUNT_ABSENT`): nothing mounts, nothing substitutes.
 *  - the two MCP surfaces — `mountCondition: surface_invariant`: classifying
 *    a mounted MCP server's transport is mandatory; the host discriminator is
 *    `Config.transport ∈ {'stdio','streamable-http'}` (packages/mcp/mcp-client
 *    /src/index.ts:51-103 @639ed01539) and an unknown transport is a typed
 *    ASSEMBLY throw, never a silent guess.
 *
 * REAL NATIVE FACES (pinned @639ed01539, re-read this round):
 *  - web_fetch  packages/web/tool-web/src/fetch.ts:456-516 → ctx.web.fetch
 *    (packages/web/web/src/index.ts `fetch(request, signal?)` :155-164)
 *  - web_search packages/web/tool-web/src/search.ts:325-380 → ctx.web.search
 *    (`search(request, signal?)` :137-146; provider selection is the seam's
 *    own call-time law resolveProvider :167+, WEB_PROVIDER_UNAVAILABLE class)
 *  - MCP trio   packages/mcp/mcp-resources/src/tools.ts:27-63
 *    registerResourceTools(ctx, request): names list_mcp_resources /
 *    list_mcp_resource_templates / read_mcp_resource; the wrapper point is
 *    request(server, {method, cursor?|uri}, exec); the scope resolve BEFORE
 *    any network sits at mcp-resources/src/index.ts:120-125
 *    (`MCP resource server "<name>" is unavailable in this agent's scope`).
 *  - surfaces   packages/mcp/mcp-client/src/index.ts:51-103 — StdioConfig
 *    (transport:'stdio', command/args/env/cwd) vs StreamableHttpConfig
 *    (transport:'streamable-http', url/headers); stdio is a LOCAL SPAWN with
 *    remote business legs, HTTP is a network endpoint — the envelopes differ
 *    and this file keeps them apart.
 *  - stagehand  packages/experimental/browser-use-stagehand-native/src/
 *    index.ts:166-200 — six `stagehand_<method>` definitions registered via
 *    createMcpToolDefinition (packages/mcp/mcp-client/src/tools.ts:225+);
 *    the body is resources.get(agent) → resource.native.execute(method,
 *    args, operationSignal); the closed method set + args law is native.ts
 *    :56-66 browserInputs; the six operations execute at native.ts:94-158
 *    (act is the SINGLE-instruction API — kept, per contract §3/B-BROWSER).
 *
 * NAMED BLOCKERS (root fix card ruling 2/4 — stated exactly, per family;
 * exported as {@link A5_G2_NAMED_BLOCKERS} and referenced from every
 * affected manifest): each family has a trusted CURRENT-facts source that is
 * NOT reachable through a public seam at this layer; the rows freeze the
 * classify-time snapshot the owning assembly injects and NEVER claim the
 * execute-time identity, destination selection, or launch ordering.
 *
 * PROVIDER/AUTHORITY LAW (fix card 2): the native bodies re-resolve their
 * provider/connection EVERY call (web: resolveProvider per call,
 * web/src/index.ts:137-164; MCP: scope+server selection at request time,
 * mcp-resources/src/index.ts:120-125). WRAPPER IDENTITY IS NOT the
 * destination/connection incarnation — plans carry the assembly-injected
 * CURRENT config-or-binding facts at classify time (`readProviderFacts` /
 * `connectionIncarnation`), and where no public seam can supply them the
 * manifest says so with the named blocker instead of an invented origin.
 *
 * STAGEHAND PRE-EFFECT LAW (fix card 4): `resources.run` can LAUNCH/ATTACH
 * the browser BEFORE `next()` reaches the captured body — a captured body
 * cannot guarantee Ask-pending zero-launch; the attach-CDP origin is itself
 * a connect effect (carried); drain only forbids NEW invokes and does not
 * clear in-flight ones. The row face states this boundary (`preEffect-
 * Disclosure`, `drainSemantics`) and the §5.5 owned
 * `browser-use/governed-native-provider.ts` stays the named close.
 *
 * REGISTRATION FACES: every tool row publishes a CANONICAL JSON Schema
 * (`type/properties/required/items/enum/additionalProperties/description`
 * subset — parent-level `required` arrays; the per-property `required:true`
 * form is the host defineTool INPUT DSL (core/tools/src/json-schema.ts
 * CONSTRAINT_KEYWORDS :76-86 @639ed01539) and NEVER a registration face).
 * The lane spec validates each face against the REAL host validator
 * (assertSupportedJsonSchema + validateJsonSchemaValue, the r9 idiom);
 * the lane paths in this header are comment-side audit edges only.
 *
 * STATUS (root fix card): this module is UNWIRED and Host use is
 * FOREVER-BANNED-FOR-THIS-LANE until the named real boundaries close. The
 * lane legs are NATIVE DOUBLES, NOT C2; `final_declaration` stays null.
 *
 * @module runtime/plugin/live/governed-families/g2-connector-adapters
 */
import { createHash } from 'node:crypto'
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'

/** Adapter identity (§1 reviewPayload P-additions: familyId + adapterRevision). */
export const A5_G2_ADAPTER_REVISION = 2
export const A5_G2_FAMILY = Object.freeze({ web: 'B-WEB', mcp: 'B-MCP', browser: 'B-BROWSER' })

/** Typed refusal codes (the STRINGS are pinned by the lane fixture
 *  packages/runtime/test/a5m2-g2-connector-adapters.test.ts). */
export const A5_G2_TYPED_CODES = Object.freeze({
  UNKNOWN_PARAMETER: 'P_G2_CLASSIFY_UNKNOWN_PARAMETER',
  INVALID_ARGUMENTS: 'P_G2_CLASSIFY_INVALID_ARGUMENTS',
  NATIVE_FACE_ABSENT: 'P_G2_NATIVE_FACE_ABSENT',
  DECLARED_MOUNT_ABSENT: 'P_G2_DECLARED_MOUNT_ABSENT',
  SURFACE_TRANSPORT_UNKNOWN: 'P_G2_SURFACE_TRANSPORT_UNKNOWN',
  SURFACE_FACTS_INCOMPLETE: 'P_G2_SURFACE_FACTS_INCOMPLETE',
  NO_DECLARED_DESTINATION: 'P_G2_NO_DECLARED_DESTINATION',
  DESTINATION_UNSUPPORTED_SCHEME: 'P_G2_DESTINATION_UNSUPPORTED_SCHEME',
  DEFINITION_DRIFT: 'P_G2_DEFINITION_DRIFT',
  DRAINING: 'P_G2_DRAINING',
  INTERNAL_EFFECTS_INVALID: 'P_G2_INTERNAL_EFFECTS_INVALID',
})

const CODES = A5_G2_TYPED_CODES

/**
 * NAMED BLOCKERS (fix card rulings 2/4) — exported so manifests, the lane
 * spec and the integrator quote the SAME words. These are real-interface
 * gaps at THIS layer: no Core patch, no parallel authorization, no invented
 * seams. Each names the exact missing seam.
 */
export const A5_G2_NAMED_BLOCKERS = Object.freeze({
  WEB: 'NAMED BLOCKER (B-WEB): no PUBLIC ctx.web seam answers which provider is CURRENTLY selected — the selection law `resolveProvider` is module-internal and the WebRuntime provider maps are private (web/src/index.ts:137-164 @639ed01539), and the captured native execute RE-RUNS the selection every call. Until an owned seam (the web-gateway-assembly row or a host face) supplies a trusted current-provider reader, production placement can only inject what it itself owns; the row freezes that CLASSIFY-TIME snapshot (readProviderFacts) and never claims the execute-time identity.',
  MCP: 'NAMED BLOCKER (B-MCP): McpResourceRuntime re-selects the server provider at REQUEST time from the live exec.agent scope + serverName (mcp-resources/src/index.ts:120-125 @639ed01539) and the public surface exposes NO connection-incarnation identity (McpResourceProvider carries no generation token). The row therefore freezes ONLY the placement facts the connection-owning assembly injects (serverName/transport/endpoint/connectionIncarnation); without an injected current `connectionIncarnation` the manifest states `connectionIncarnation: "unobserved"` — a reconnect rotating the incarnation stale-proofs an approval only if the owner injects the fact.',
  BROWSER: 'NAMED BLOCKER (B-BROWSER): the native pre-effect resource hook (browser-use-stagehand-native index.ts:197-215 @639ed01539) can LAUNCH or ATTACH the browser BEFORE next() reaches the captured body, so a captured-definition wrapper CANNOT guarantee Ask-pending zero-launch; the attach-CDP endpoint is itself a network connect (carried as a connect effect); the live SessionResources incarnation is not publicly observable and an attached browser may be changed by its user. Close: the §5.5 owned browser-use/governed-native-provider (own BrowserResource lease + incarnation pin). This row makes NO zero-launch claim.',
})

/** The honest drain boundary this row actually controls (fix card 4). */
export const A5_G2_DRAIN_SEMANTICS = 'drain forbids NEW classify/invoke entries from this point on; already-entered native bodies are NOT rewound, NOT cleared and NOT killable from this row (cancellation of a live body rides the caller exec signal the native owns; an attached browser belongs to its user)'

const refuse = (code, detail, extra) => ({ ok: false, code, detail, ...(extra ?? {}) })

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function canonicalJson(value) {
  return JSON.stringify(value, (_k, v) => (
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v
  ))
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner)
    Object.freeze(value)
  }
  return value
}

/** Parse a http(s) URL and answer the CLOSED-SET network locator
 *  `scheme://host[:port]` (resource.ts:56-62 law: a network destination
 *  wears no path). Any other scheme is a typed refusal, never a guess.
 *  NEVER treats an MCP opaque URI or a filesystem path as a URL (record 57). */
function httpOrigin(raw, what) {
  let parsed
  try {
    parsed = new globalThis['URL'](raw)
  } catch {
    return refuse(CODES.INVALID_ARGUMENTS, `${what} is not a parseable URL (${JSON.stringify(String(raw).slice(0, 200))})`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return refuse(CODES.DESTINATION_UNSUPPORTED_SCHEME, `${what} wears ${JSON.stringify(parsed.protocol)}; the governed connector rows admit http(s) destinations only — file:/data:/gopher:/unix-sockets never ride a connect effect here`)
  }
  return { ok: true, origin: `${parsed.protocol}//${parsed.host}` }
}

const invokeEffect = (toolName) => ({ kind: 'tool-invoke', toolName, resource: null })
const connectEffect = (realmId, origin) => ({
  kind: 'connect',
  resource: { realmId, kind: 'network-destination', canonicalLocator: origin, rights: ['connect'] },
})
const domainRefEffect = (domainAuthorityId) => ({ kind: 'domain-ref', domainAuthorityId, resource: null })

/** The exact non-empty-string / array-of-non-empty-strings parses. */
function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    return refuse(CODES.INVALID_ARGUMENTS, `"${name}" must be a non-empty string`)
  }
  return { ok: true, value }
}

function unknownTopLevel(args, allowed) {
  const extra = Object.keys(args).filter((k) => !allowed.includes(k))
  return extra.length === 0
    ? null
    : refuse(CODES.UNKNOWN_PARAMETER, `undeclared top-level parameter(s): ${extra.join(', ')} — the governed root is closed (the defineTool DSL does not refuse these; this row does)`)
}

/** ─────────────────────────────────────────────────────────────────────────
 *  REGISTRATION FACES — canonical JSON Schema per record (the SAME name,
 *  description and meaning as the captured native face; closed root; parent-
 *  level `required` arrays only).
 *  ──────────────────────────────────────────────────────────────────────── */
export const A5_G2_REGISTRATION_SCHEMAS = deepFreeze({
  web_fetch: {
    type: 'object',
    additionalProperties: false,
    properties: {
      url: { type: 'string', description: 'The HTTP(S) URL to fetch.' },
    },
    required: ['url'],
  },
  web_search: {
    type: 'object',
    additionalProperties: false,
    properties: {
      queries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Non-empty search queries; their results are merged. (The host keyword subset carries no minItems — the row enforces the non-empty law in classify.)',
      },
    },
    required: ['queries'],
  },
  list_mcp_resources: {
    type: 'object',
    additionalProperties: false,
    properties: {
      server: { type: 'string', description: 'Configured MCP server name.' },
      cursor: { type: 'string', description: 'Continuation cursor returned by this server.' },
    },
    required: ['server'],
  },
  list_mcp_resource_templates: {
    type: 'object',
    additionalProperties: false,
    properties: {
      server: { type: 'string', description: 'Configured MCP server name.' },
      cursor: { type: 'string', description: 'Continuation cursor returned by this server.' },
    },
    required: ['server'],
  },
  read_mcp_resource: {
    type: 'object',
    additionalProperties: false,
    properties: {
      server: { type: 'string', description: 'Configured MCP server name.' },
      uri: { type: 'string', description: 'Resource URI to read (opaque MCP URI — never interpreted as a path or a URL).' },
    },
    required: ['server', 'uri'],
  },
  stagehand_navigate: {
    type: 'object',
    additionalProperties: false,
    properties: {
      url: { type: 'string', description: 'Target URL for the navigation.' },
      pageId: { type: 'string', description: 'Tab id to navigate; the active tab is used when omitted.' },
    },
    required: ['url'],
  },
  stagehand_tabs: {
    type: 'object',
    additionalProperties: false,
    properties: {
      action: { type: 'string', enum: ['list', 'new', 'select', 'close'], description: 'Tab operation branch.' },
      url: { type: 'string', description: 'URL for action "new" (optional).' },
      pageId: { type: 'string', description: 'Tab id required by actions "select" and "close".' },
    },
    required: ['action'],
  },
  stagehand_screenshot: {
    type: 'object',
    additionalProperties: false,
    properties: {
      pageId: { type: 'string', description: 'Tab to capture; the active tab is used when omitted.' },
      fullPage: { type: 'boolean', description: 'Capture the full scrollable page.' },
    },
    required: [],
  },
  stagehand_act: {
    type: 'object',
    additionalProperties: false,
    properties: {
      instruction: { type: 'string', description: 'One natural-language action instruction (the native single-instruction API).' },
      pageId: { type: 'string', description: 'Tab to act on; the active tab is used when omitted.' },
    },
    required: ['instruction'],
  },
  stagehand_observe: {
    type: 'object',
    additionalProperties: false,
    properties: {
      instruction: { type: 'string', description: 'Instruction whose matching actions are observed (page content rides the Stagehand model).' },
      pageId: { type: 'string', description: 'Tab to observe; the active tab is used when omitted.' },
    },
    required: ['instruction'],
  },
  stagehand_extract: {
    type: 'object',
    additionalProperties: false,
    properties: {
      instruction: { type: 'string', description: 'Extraction instruction (page content rides the Stagehand model).' },
      pageId: { type: 'string', description: 'Tab to extract from; the active tab is used when omitted.' },
      schema: { type: 'object', description: 'Optional JSON Schema for the extracted shape.' },
    },
    required: ['instruction'],
  },
})

/** ─────────────────────────────────────────────────────────────────────────
 *  MCP SURFACE CLASSIFIERS (records 89 / 90 — surface_invariant).
 *  The host discriminator is the trusted server Config, never a display
 *  name (§3/B-MCP: any name prefix is non-authoritative).
 *  ──────────────────────────────────────────────────────────────────────── */
export const A5_G2_MCP_TRANSPORTS = Object.freeze(['stdio', 'streamable-http'])

/**
 * Classify ONE mounted MCP server into its surface envelope.
 * @param config - the TRUSTED placement config: { serverName, transport,
 *   command?, args?, cwd?, endpointUrl?, headersPresent?,
 *   domainAuthorityId? }. Facts arrive from the assembly that OWNS the
 *   connection; nothing here re-reads profile files.
 * @returns {ok:true, surface} with the closed facts, or an assembly-defect
 *   throw for an unknown transport / missing transport-critical facts
 *   (surface_invariant: a mounted server MUST classify).
 */
export function classifyG2McpSurface(config) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError(`${CODES.SURFACE_FACTS_INCOMPLETE}: classifyG2McpSurface needs the trusted server config object`)
  }
  const serverName = typeof config.serverName === 'string' && config.serverName.length > 0 ? config.serverName : null
  if (serverName === null) {
    throw new TypeError(`${CODES.SURFACE_FACTS_INCOMPLETE}: the surface config carries no serverName`)
  }
  if (!A5_G2_MCP_TRANSPORTS.includes(config.transport)) {
    throw new TypeError(`${CODES.SURFACE_TRANSPORT_UNKNOWN}: transport ${JSON.stringify(config.transport ?? null)} is outside {'stdio','streamable-http'} (mcp-client Config union @639ed01539) — a mounted server whose surface cannot classify is an assembly defect, never a silent guess`)
  }
  if (config.transport === 'stdio') {
    if (!Array.isArray(config.command) || config.command.length === 0 || typeof config.command[0] !== 'string' || config.command[0].length === 0) {
      throw new TypeError(`${CODES.SURFACE_FACTS_INCOMPLETE}: a stdio surface requires the spawn command (StdioConfig.command @639ed01539) — argv[0] at least`)
    }
    return deepFreeze({
      record: 'surface:mcp_stdio',
      familyId: A5_G2_FAMILY.mcp,
      serverName,
      transport: 'stdio',
      // Connection-incarnation fact (fix card 2): only the connection-OWNING
      // assembly can inject the current incarnation; "unobserved" is the
      // honest state and the named blocker, never a wrapper-identity guess.
      connectionIncarnation: typeof config.connectionIncarnation === 'string' && config.connectionIncarnation.length > 0 ? config.connectionIncarnation : 'unobserved',
      // The LOCAL SPAWN envelope (contract §3/B-MCP: stdio is a local
      // process that may still carry remote business legs — neither
      // "all remote" nor "just a spawn"). argv0 only: full env values are
      // secrets territory and never ride an approval manifest.
      spawn: Object.freeze({ argv0: config.command[0], argCount: config.command.length - 1, cwd: typeof config.cwd === 'string' ? config.cwd : '' }),
      // The roundtrip is a server call; the closed effect set carries NO
      // local-process kind, so the spawn envelope stays MANIFEST NOTATION
      // (S-semantics) beside the I leg — quoted with its real entry point.
      obligation: Object.freeze({ service: `mcp-server(stdio:${serverName})`, action: 'roundtrip', right: 'connect', entry: 'captured native resource-tool execute -> McpResourceRuntime.request -> provider.request (mcp-resources tools.ts:27-63 + index.ts:120-125 @639ed01539); the child-process spawn/FS/process envelope is the connection plugin\'s provider-side obligation' }),
      ...(typeof config.domainAuthorityId === 'string' && config.domainAuthorityId.length > 0 ? { domainAuthorityId: config.domainAuthorityId } : {}),
    })
  }
  const endpoint = httpOrigin(config.endpointUrl, `streamable-http endpointUrl of server "${serverName}"`)
  if (endpoint.ok === false) {
    throw new TypeError(`${CODES.SURFACE_FACTS_INCOMPLETE}: ${endpoint.detail}`)
  }
  return deepFreeze({
    record: 'surface:mcp_http_dynamic',
    familyId: A5_G2_FAMILY.mcp,
    serverName,
    transport: 'streamable-http',
    endpointOrigin: endpoint.origin,
    connectionIncarnation: typeof config.connectionIncarnation === 'string' && config.connectionIncarnation.length > 0 ? config.connectionIncarnation : 'unobserved',
    // Header VALUES never ride the manifest; their presence is a count fact.
    headerCount: config.headersPresent === true ? Number(config.headerCount ?? 1) : 0,
    obligation: Object.freeze({ service: `mcp-server(streamable-http:${serverName})`, action: 'roundtrip', right: 'connect', entry: 'captured native resource-tool execute -> McpResourceRuntime.request -> provider.request (mcp-resources tools.ts:27-63 + index.ts:120-125 @639ed01539); redirects/endpoint hops are the transport plugin\'s provider-side obligation' }),
    ...(typeof config.domainAuthorityId === 'string' && config.domainAuthorityId.length > 0 ? { domainAuthorityId: config.domainAuthorityId } : {}),
  })
}

/** ─────────────────────────────────────────────────────────────────────────
 *  THE THIN ROW BUILDER (capture → classify → delegate).
 * ──────────────────────────────────────────────────────────────────────── */
function buildG2Row({ familyId, toolName, operation, mountCondition, realmId, providerId, readNative, definitionIdentityOf, declared, classifyCall, observe, preEffectDisclosure }) {
  let capture = null
  if (readNative !== null && typeof readNative === 'function') {
    const definition = readNative(toolName)
    if (definition !== null && definition !== undefined && typeof definition.execute === 'function') {
      capture = Object.freeze({
        definition,
        bindExecute: definition.execute,
        definitionIdentity: typeof definitionIdentityOf === 'function' ? String(definitionIdentityOf(definition) ?? '') || null : null,
      })
    }
  }
  let draining = false
  let seq = 0

  const row = {
    active: true,
    familyId,
    adapterRevision: A5_G2_ADAPTER_REVISION,
    toolName,
    operation,
    mountCondition,
    realmId,
    providerId,
    registrationSchema: A5_G2_REGISTRATION_SCHEMAS[toolName],
    captured: () => capture !== null,
    definitionIdentity: capture === null ? null : capture.definitionIdentity,
    /** PURE classify + closed-set effect projection + review payload (§1). */
    classify(args) {
      if (draining) return refuse(CODES.DRAINING, 'the row is DRAINING: no call reaches any body and nothing falls back to native')
      if (!declared.active) return refuse(CODES.DECLARED_MOUNT_ABSENT, declared.detail)
      if (capture === null) {
        return refuse(CODES.NATIVE_FACE_ABSENT, `the native "${toolName}" definition was not visible on the bind-time capture seam (tools.get(name, scope) law): the row refuses typed and NEVER substitutes a body of its own (mountCondition ${JSON.stringify(mountCondition)})`)
      }
      if (args === null || typeof args !== 'object' || Array.isArray(args)) {
        return refuse(CODES.INVALID_ARGUMENTS, 'arguments must be an object')
      }
      const plan = classifyCall(args)
      if (plan.ok !== true) return plan
      const parsed = parseRequestedEffectSet(plan.effects)
      if (!parsed.ok) {
        return refuse(CODES.INTERNAL_EFFECTS_INVALID, `the row built effects its own closed schema rejects: ${parsed.problems.map((p) => `${p.path}:${p.code}`).join('; ')} — nothing delegates on an unvalidatable effect set`)
      }
      // FULL-VALUES SNAPSHOT of the COMPLETE ACTUAL arguments (fix card 3):
      // read ONCE into a frozen copy; the native body receives the caller's
      // argument object verbatim, so the fingerprint must cover EXACTLY
      // those values (whitespace, order, extra detail included) — a trimmed
      // SUMMARY may ride alongside, never replace.
      const actualArgs = deepFreeze(JSON.parse(JSON.stringify(args)))
      seq += 1
      const correlation = `g2.${familyId}.${toolName}.r${A5_G2_ADAPTER_REVISION}.${String(seq)}`
      const reviewPayload = deepFreeze({
        familyId,
        adapterRevision: A5_G2_ADAPTER_REVISION,
        providerIdentity: providerId,
        definitionIdentity: capture.definitionIdentity,
        targetManifest: plan.targetManifest,
      })
      // Payload fingerprint over the COMPLETE ACTUAL argument values plus the
      // review payload (载荷法 FULL VALUES; the operationFingerprint remains
      // the PA center's — never computed here).
      const parametersFingerprint = `sha256:${sha256(canonicalJson({ realmId, providerId, toolName, reviewPayload, actualArgs }))}`
      return deepFreeze({ ok: true, correlation, effects: plan.effects, targetManifest: plan.targetManifest, reviewPayload, parametersFingerprint, actualArgs })
    },
    /** The delegate edge: classify → drift re-check → the CAPTURED execute,
     *  verbatim args, the caller's own exec (the caller's signal rides the
     *  exec — cancellation belongs to the native body). */
    async invoke(args, exec) {
      const plan = row.classify(args)
      if (plan.ok !== true) return plan
      if (capture.definition.execute !== capture.bindExecute) {
        return refuse(CODES.DEFINITION_DRIFT, `the captured "${toolName}" definition's execute moved since bind time: the governed call refuses; there is no replacement-body path and no native fallback`)
      }
      observe({ event: 'backend-start', correlation: plan.correlation, toolName, detail: plan.parametersFingerprint })
      try {
        const value = await capture.bindExecute.call(capture.definition, args, exec)
        observe({ event: 'backend-commit', correlation: plan.correlation, toolName, detail: 'ok' })
        return { ok: true, value, plan }
      } catch (error) {
        // Honesty (card ② family): the native throw boundary is inside the
        // body; the row re-raises verbatim — never a swallowed fake result.
        observe({ event: 'backend-error', correlation: plan.correlation, toolName, detail: String(error?.message ?? error).slice(0, 200) })
        throw error
      }
    },
    /** DRAINING (fix card 4): this forbids NEW classify/invoke entries from
     *  this point on; already-entered native bodies are NOT rewound, NOT
     *  cleared, NOT killable from this row — the honest boundary is: */
    drainSemantics: A5_G2_DRAIN_SEMANTICS,
    drain() {
      draining = true
    },
    draining: () => draining,
  }
  if (preEffectDisclosure !== undefined) row.preEffectDisclosure = preEffectDisclosure
  return row
}

/** Honest UNMOUNTED row (declared_mount absent): the record exists for the
 *  center's census but every call refuses typed — zero substitution. */
function inactiveG2Row({ familyId, toolName, operation, mountCondition, code, detail, realmId, providerId }) {
  const say = () => refuse(code, `${toolName}: ${detail}`)
  return {
    familyId,
    adapterRevision: A5_G2_ADAPTER_REVISION,
    toolName,
    operation,
    mountCondition,
    realmId,
    providerId,
    registrationSchema: A5_G2_REGISTRATION_SCHEMAS[toolName] ?? null,
    active: false,
    captured: () => false,
    definitionIdentity: null,
    classify: async () => say(),
    invoke: async () => say(),
    drainSemantics: A5_G2_DRAIN_SEMANTICS,
    drain: () => {},
    draining: () => false,
  }
}

function assertAssembly(name, value, cond, detail) {
  if (!cond) throw new TypeError(`g2-connector-adapters/${name}: ${detail}`)
}

/** ─────────────────────────────────────────────────────────────────────────
 *  B-WEB (records 22/23) — mountCondition ALWAYS.
 *  ──────────────────────────────────────────────────────────────────────── */
/**
 * @param deps - validated hard; a config defect throws at assembly.
 * @param {string} deps.realmId - the realm the connect effects answer in.
 * @param {string} deps.providerId - the trusted placing assembly identity.
 * @param {(name: string) => object | undefined} deps.readNative - the
 *        capture seam (production: `name => ctx.tools.get(name, scope)`).
 * @param {string} [deps.searchOrigin] - the TRUSTED DECLARED search-provider
 *        origin placed by the owning assembly (the same config-bound fact
 *        family as web-gateway-assembly.boundSearchOriginSource — a
 *        placement fact, never an origin this file invents). REQUIRED for a
 *        web_search call to project its N leg; absent ⇒ typed refusal —
 *        the row never hides the egress or fixed-URL-fakes a destination.
 * @param {() => {fetchProviderId?: string, searchProviderId?: string,
 *        searchOrigin?: string} | undefined} [deps.readProviderFacts] - the
 *        trusted CURRENT-facts reader the OWNING assembly injects (fix card 2): an IN-MEMORY read
 *        of the mounted web-config slot, evaluated at classify time and
 *        FROZEN into the manifest. The captured native execute re-runs
 *        resolveProvider every call — this snapshot is the CLASSIFY-TIME
 *        identity, never a claim about which provider served the body (see
 *        A5_G2_NAMED_BLOCKERS.WEB). An assembly injecting no reader gets the
 *        manifest's honest `observed:false` + the named blocker.
 * @param {number} [deps.maxQueries] - the mounted search config's cap
 *        (host tool-web search.ts parseSearchArgs carries one; default 4).
 * @param {(row: object) => void} [deps.observe] - §1.2 minimal backend log.
 */
export function createG2WebAdapters({ realmId, providerId, readNative, searchOrigin, readProviderFacts, maxQueries = 4, definitionIdentityOf, observe = () => {} } = {}) {
  assertAssembly('web', realmId, typeof realmId === 'string' && realmId.length > 0, 'realmId is required (connect effects answer in a realm)')
  assertAssembly('web', providerId, typeof providerId === 'string' && providerId.length > 0, 'providerId is required (the placing assembly identifies itself)')
  assertAssembly('web', readNative, typeof readNative === 'function', 'readNative is required — the tools.get(name, scope) capture seam; a row that cannot capture refuses typed AT CALL TIME (mountCondition always), it never mounts a body of its own')
  assertAssembly('web', maxQueries, Number.isInteger(maxQueries) && maxQueries >= 1, 'maxQueries must be a positive integer (the mounted search cap)')
  // CURRENT provider facts (fix card 2): ONE in-memory read of the trusted
  // injected snapshot PER CLASSIFY, frozen into the manifest. Wrapper
  // identity is not the provider — the native re-resolves per call; what
  // this row may lawfully carry is the classify-time snapshot the OWNING
  // assembly read, or the honest `observed:false` + named blocker.
  const providerFactsAtClassify = () => {
    if (typeof readProviderFacts !== 'function') {
      return deepFreeze({ observed: false, reason: A5_G2_NAMED_BLOCKERS.WEB })
    }
    const snap = readProviderFacts()
    if (snap === null || typeof snap !== 'object') {
      return deepFreeze({ observed: false, reason: A5_G2_NAMED_BLOCKERS.WEB })
    }
    return deepFreeze({
      observed: true,
      fetchProviderId: typeof snap.fetchProviderId === 'string' ? snap.fetchProviderId : null,
      searchProviderId: typeof snap.searchProviderId === 'string' ? snap.searchProviderId : null,
      ...(typeof snap.searchOrigin === 'string' && snap.searchOrigin.length > 0 ? { searchOrigin: snap.searchOrigin } : {}),
      selectionLaw: 'the captured native execute re-runs resolveProvider EVERY call (web/src/index.ts:137-164 @639ed01539); this is the CLASSIFY-TIME snapshot only — wrapper identity is not the provider',
    })
  }
  const shared = { familyId: A5_G2_FAMILY.web, mountCondition: 'always', realmId, providerId, readNative, definitionIdentityOf, observe, declared: { active: true, detail: '' } }

  const web_fetch = buildG2Row({
    ...shared,
    toolName: 'web_fetch',
    operation: 'fetch-exact-url',
    classifyCall(args) {
      const extra = unknownTopLevel(args, ['url'])
      if (extra !== null) return extra
      const url = requireString(args.url, 'url')
      if (url.ok !== true) return url
      const origin = httpOrigin(url.value, 'the fetch URL')
      if (origin.ok !== false) {
        // record-effect-delta: external-net-egress-fetch — the exact URL
        // rides the manifest; per-hop redirect/DNS law is the gateway row's
        // (web-gateway-assembly) and the Gateway's final DNS/IP judgement.
        return {
          ok: true,
          effects: [invokeEffect('web_fetch'), connectEffect(realmId, origin.origin)],
          canonical: { url: url.value },
          targetManifest: {
            operation: 'fetch-exact-url',
            url: url.value,
            destinationOrigin: origin.origin,
            // CURRENT provider fact (fix card 2): the fetch destination is
            // THIS call's URL (from the arguments), while the provider that
            // actually serves it is re-resolved per call by the native seam.
            providerIdentityAtClassify: providerFactsAtClassify(),
            businessObligations: [{
              service: 'web-runtime', action: 'fetch', right: 'connect',
              entry: 'captured native web_fetch execute -> ctx.web.fetch(request, exec.signal) (tool-web fetch.ts:499-510; web/src/index.ts:155-164 @639ed01539); redirect-per-hop and loopback/linklocal checks are the ProviderGateway row\'s law',
            }],
          },
        }
      }
      return origin
    },
  })

  const web_search = buildG2Row({
    ...shared,
    toolName: 'web_search',
    operation: 'search-queries',
    classifyCall(args) {
      const extra = unknownTopLevel(args, ['queries'])
      if (extra !== null) return extra
      if (!Array.isArray(args.queries) || args.queries.length === 0 || args.queries.length > maxQueries) {
        return refuse(CODES.INVALID_ARGUMENTS, `"queries" must be an array of 1–${String(maxQueries)} queries (the non-empty law lives HERE: the host registration keyword subset carries no minItems)`)
      }
      for (const [i, q] of args.queries.entries()) {
        if (typeof q !== 'string' || q.trim().length === 0) {
          return refuse(CODES.INVALID_ARGUMENTS, `queries[${String(i)}] must be a non-empty string`)
        }
      }
        // CURRENT provider facts (fix card 2): the SELECTED provider identity
        // and, when the reader carries it, the CURRENT search endpoint are
        // read ONCE per classify from the assembly-owned trusted reader and
        // FROZEN into the manifest. Destination precedence: reader's current
        // origin ⇒ else the assembly's bind-time declared origin ⇒ else typed
        // refusal — the row never invents an origin and never fixed-URL-fakes.
        const facts = providerFactsAtClassify()
        const originRaw = facts.observed === true && typeof facts.searchOrigin === 'string' && facts.searchOrigin.length > 0
          ? facts.searchOrigin
          : (typeof searchOrigin === 'string' && searchOrigin.length > 0 ? searchOrigin : null)
        if (originRaw === null) {
          return refuse(CODES.NO_DECLARED_DESTINATION, 'no trusted search destination at this layer (neither a readProviderFacts current origin nor a bind-time declared searchOrigin): projecting external-net-egress-search onto an undeclared destination, or a fixed-URL fake, is structurally impossible here — typed refusal, zero delegation')
        }
        const origin = httpOrigin(originRaw, 'the search-provider origin (trusted reader or assembly-declared placement fact)')
        if (origin.ok !== true) return origin
        return {
          ok: true,
          effects: [invokeEffect('web_search'), connectEffect(realmId, origin.origin)],
          // SUMMARY ONLY — the fingerprint is computed over `actualArgs` (the
          // COMPLETE ACTUAL arguments) in buildG2Row; a trimmed query summary
          // may ride alongside, it never replaces the full values.
          canonical: { queriesSummary: args.queries.map((q) => q.trim()) },
          targetManifest: {
            operation: 'search-queries',
            queriesSummary: args.queries.map((q) => q.trim()),
            queryCount: args.queries.length,
            destinationOrigin: origin.origin,
            providerIdentityAtClassify: facts,
            providerOriginSource: originRaw === searchOrigin && !(facts.observed === true && typeof facts.searchOrigin === 'string' && facts.searchOrigin.length > 0)
              ? 'bind-time assembly-declared searchOrigin (trusted placement fact; no CURRENT reader supplied — see providerIdentityAtClassify for the observed/named-blocker state)'
              : 'readProviderFacts() CURRENT origin — read once per classify and frozen here (the config-bound family of web-gateway-assembly.boundSearchOriginSource). Provider selection stays the seam\'s call-time law (web/src/index.ts resolveProvider :167+ @639ed01539), never mirrored or invented here.',
          businessObligations: [{
            service: 'web-runtime', action: 'search', right: 'connect',
            entry: 'captured native web_search execute -> runSearchQueries -> ctx.web.search(request, exec.signal) (tool-web search.ts:325-380; web/src/index.ts:137-146 @639ed01539) — a REAL search provider, never a fetch-of-a-fixed-URL stand-in',
          }],
        },
      }
    },
  })

  return { web_fetch, web_search }
}

/** ─────────────────────────────────────────────────────────────────────────
 *  B-MCP resource trio (records 55/56/57) — mountCondition DECLARED_MOUNT.
 *  ──────────────────────────────────────────────────────────────────────── */
const MCP_METHODS = Object.freeze({
  list_mcp_resources: 'resources/list',
  list_mcp_resource_templates: 'resources/templates/list',
  read_mcp_resource: 'resources/read',
})

/**
 * @param deps.realmId / providerId / readNative / definitionIdentityOf /
 *        observe - as in createG2WebAdapters.
 * @param deps.declaredService - the TRUSTED proof the declared MCP server is
 *        present: { present: true, serverName, transport, command?,
 *        endpointUrl?, cwd?, domainAuthorityId? }. `present !== true` ⇒ the
 *        trio returns honest INACTIVE rows (declared_mount: no proof, no
 *        mount, no substitution). The transport facts classify through
 *        classifyG2McpSurface (surface records 89/90 ride every manifest).
 */
export function createG2McpResourceAdapters({ realmId, providerId, readNative, declaredService, definitionIdentityOf, observe = () => {} } = {}) {
  assertAssembly('mcp', realmId, typeof realmId === 'string' && realmId.length > 0, 'realmId is required')
  assertAssembly('mcp', providerId, typeof providerId === 'string' && providerId.length > 0, 'providerId is required')
  assertAssembly('mcp', readNative, typeof readNative === 'function', 'readNative is required — the tools.get(name, scope) capture seam')
  const proofValid = declaredService !== null && typeof declaredService === 'object' && !Array.isArray(declaredService) && declaredService.present === true
  if (!proofValid) {
    const detail = `declared_mount is unproven (${declaredService?.present === undefined ? 'no present flag' : 'present !== true'}): the MCP server this trio would speak for is not declared present by the owning assembly — nothing mounts and nothing is substituted`
    return Object.fromEntries(Object.entries(MCP_METHODS).map(([toolName, method]) => [toolName, inactiveG2Row({
      familyId: A5_G2_FAMILY.mcp, toolName, operation: method, mountCondition: 'declared_mount',
      code: CODES.DECLARED_MOUNT_ABSENT, detail, realmId, providerId,
    })]))
  }
  const surface = classifyG2McpSurface(declaredService)
  const shared = { familyId: A5_G2_FAMILY.mcp, mountCondition: 'declared_mount', realmId, providerId, readNative, definitionIdentityOf, observe, declared: { active: true, detail: '' } }

  const makeRow = (toolName) => buildG2Row({
    ...shared,
    toolName,
    operation: MCP_METHODS[toolName],
    classifyCall(args) {
      const allowed = toolName === 'read_mcp_resource' ? ['server', 'uri'] : ['server', 'cursor']
      const extra = unknownTopLevel(args, allowed)
      if (extra !== null) return extra
      const server = requireString(args.server, 'server')
      if (server.ok !== true) return server
      // IDENTITY LAW (§3/B-MCP): the server argument must equal the DECLARED
      // server of this mount — a display-name swap routes nothing.
      if (server.value !== surface.serverName) {
        return refuse(CODES.INVALID_ARGUMENTS, `the server argument ${JSON.stringify(server.value)} is not the declared server of this mount (${JSON.stringify(surface.serverName)}): tool identity is trusted-config server ID + connection incarnation, never a name the caller picks`)
      }
      const effects = [invokeEffect(toolName)]
      if (surface.transport === 'streamable-http') effects.push(connectEffect(realmId, surface.endpointOrigin))
      if (surface.domainAuthorityId !== undefined) effects.push(domainRefEffect(surface.domainAuthorityId))
      const canonical = { server: server.value }
      // B-MCP REV-2 MINT (root-routed deltas D1-D3 from the LANDED rule map,
      // f1e0c92ec cherry-pick): the table types SIX closed groups over one
      // mint-synthesized discriminant; the mint answers in the measured flat
      // key names the closed law requires.
      //  D1 (flatten): the nested `surface` object projects LOSSLESSLY to its
      //    measured inner key names at top level (record/transport/
      //    connectionIncarnation/endpointOrigin + spawn -> spawnArgv0/
      //    spawnArgCount/spawnCwd) — the signed Schedule lane's flat-
      //    projection precedent; no signed kind types a nested object.
      //  D3 (synthesize): ONE discriminant over transport x lane, derivable
      //    from measured facts only (the signed B-INSPECT inspectVariant
      //    pattern). `transport` itself keeps the MEASURED spelling
      //    ('streamable-http' stays); the axis label 'http' is the variant's,
      //    never a rewrite of the fact.
      const transportAxis = surface.transport === 'stdio' ? 'stdio' : 'http'
      const laneAxis = toolName === 'read_mcp_resource' ? 'read' : toolName === 'list_mcp_resource_templates' ? 'templates' : 'list'
      const manifest = {
        mcpVariant: `${transportAxis}:${laneAxis}`,
        operation: MCP_METHODS[toolName],
        server: server.value,
        record: surface.record,
        transport: surface.transport,
        connectionIncarnation: surface.connectionIncarnation,
        ...(surface.spawn === undefined
          ? { endpointOrigin: surface.endpointOrigin }
          : { spawnArgv0: surface.spawn.argv0, spawnArgCount: surface.spawn.argCount, spawnCwd: surface.spawn.cwd }),
        // CURRENT-FACTS law (fix card 2): the provider is RE-SELECTED at
        // request time by scope+serverName (mcp-resources/src/index.ts:120-125
        // @639ed01539); this manifest freezes the classify-time placement
        // facts — wrapper identity is not the connection incarnation.
        providerReSelectionLaw: 'the request leg re-selects the provider from the live exec.agent scope + serverName at REQUEST time (mcp-resources/src/index.ts:120-125 @639ed01539); a stale/unmounted server fails there — this manifest freezes classify-time placement facts only',
        //  D2 (always-emit null): applicability-conditional leaves ride the
        //    signed nullableString law — null is MEASURED ABSENCE, a missing
        //    key is a DRIFT DENIAL (the 18:07 key-omission law stays the G6
        //    row's law).
        connectionIncarnationReason: surface.connectionIncarnation === 'unobserved' ? A5_G2_NAMED_BLOCKERS.MCP : null,
        domainAuthorityId: surface.domainAuthorityId === undefined ? null : surface.domainAuthorityId,
        businessObligations: [surface.obligation],
      }
      if (toolName === 'read_mcp_resource') {
        const uri = requireString(args.uri, 'uri')
        if (uri.ok !== true) return uri
        if (args.cursor !== undefined) {
          return refuse(CODES.UNKNOWN_PARAMETER, 'read_mcp_resource declares no cursor')
        }
        // OPAQUE URI law (record 57, connection.ts verbatim-uri): the URI is
        // carried verbatim; it is NEVER parsed as a filesystem path or
        // treated as a trusted URL here.
        canonical.uri = uri.value
        manifest.uriVerbatim = uri.value
        manifest.uriOpacity = 'opaque MCP URI — carried verbatim (mcp-client connection.ts verbatim pass-through @639ed01539); no path/URL interpretation at this edge'
      } else {
        // D2 on the four list groups: cursor ALWAYS rides — null when no
        // cursor was passed (the signed taskId-null precedent). The read
        // groups carry NO cursor key (not in their adds): 'read declares no
        // cursor' is STRUCTURAL at the grammar edge.
        if (args.cursor !== undefined) {
          const cursor = requireString(args.cursor, 'cursor')
          if (cursor.ok !== true) return cursor
          canonical.cursor = cursor.value
          manifest.cursor = cursor.value
        } else {
          manifest.cursor = null
        }
      }
      return { ok: true, effects, canonical, targetManifest: manifest }
    },
  })

  return Object.fromEntries(Object.keys(MCP_METHODS).map((toolName) => [toolName, makeRow(toolName)]))
}

/** ─────────────────────────────────────────────────────────────────────────
 *  B-BROWSER stagehand six (records 58–63) — mountCondition DECLARED_MOUNT.
 *  ──────────────────────────────────────────────────────────────────────── */
/**
 * @param deps.declaredService - the TRUSTED proof the experimental stagehand
 *        provider is mounted: { present: true, mode: 'launch'|'attach',
 *        modelOrigin?, cdpEndpointOrigin?, domainAuthorityId? }. The bundle
 *        is OFF by default (scope host-experimental-bundle-off): no proof ⇒
 *        six honest INACTIVE rows, never a substitute browser.
 *        mode laws (index.ts:91-103 @639ed01539): attach carries
 *        cdpEndpointOrigin; launch owns its Chromium. modelOrigin is the
 *        configured Stagehand model provider origin — REQUIRED for
 *        act/observe/extract (page content rides that model; the N leg is
 *        never hidden).
 * @param deps.readNative - capture seam; production captures the six
 *        `stagehand_<method>` definitions the same way any ToolDefinition is
 *        captured (ctx.tools.get). PRE-EFFECT LAW (fix card 4): the native
 *        `tools/execute` hook can LAUNCH/ATTACH the browser before the
 *        captured body runs — every browser row carries
 *        `preEffectDisclosure` (A5_G2_NAMED_BLOCKERS.BROWSER) and makes NO
 *        zero-launch claim; attach mounts carry the cdp-origin connect.
 */
export function createG2BrowserAdapters({ realmId, providerId, readNative, declaredService, definitionIdentityOf, observe = () => {} } = {}) {
  assertAssembly('browser', realmId, typeof realmId === 'string' && realmId.length > 0, 'realmId is required')
  assertAssembly('browser', providerId, typeof providerId === 'string' && providerId.length > 0, 'providerId is required')
  assertAssembly('browser', readNative, typeof readNative === 'function', 'readNative is required — the tools.get(name, scope) capture seam')
  const proof = declaredService
  const proofValid = proof !== null && typeof proof === 'object' && !Array.isArray(proof) && proof.present === true
  if (!proofValid) {
    const detail = 'declared_mount is unproven (the experimental stagehand provider is not declared present by the owning assembly; the bundle is off by default): the six rows stay unmounted and substitute nothing'
    return Object.fromEntries(['act', 'extract', 'navigate', 'observe', 'screenshot', 'tabs'].map((method) => [`stagehand_${method}`, inactiveG2Row({
      familyId: A5_G2_FAMILY.browser, toolName: `stagehand_${method}`, operation: `browser-${method}`, mountCondition: 'declared_mount',
      code: CODES.DECLARED_MOUNT_ABSENT, detail, realmId, providerId,
    })]))
  }
  if (proof.mode !== 'launch' && proof.mode !== 'attach') {
    throw new TypeError(`g2-connector-adapters/browser: ${CODES.SURFACE_FACTS_INCOMPLETE}: mode ${JSON.stringify(proof.mode ?? null)} is outside {'launch','attach'} (stagehand Config.mode @639ed01539)`)
  }
  if (proof.mode === 'attach' && (typeof proof.cdpEndpointOrigin !== 'string' || proof.cdpEndpointOrigin.length === 0)) {
    throw new TypeError(`g2-connector-adapters/browser: ${CODES.SURFACE_FACTS_INCOMPLETE}: attach mode must declare its cdpEndpointOrigin (the attach endpoint is a real network target — index.ts:99-103 requires cdpEndpoint @639ed01539)`)
  }
  const modelOrigin = typeof proof.modelOrigin === 'string' && proof.modelOrigin.length > 0 ? httpOrigin(proof.modelOrigin, 'the declared Stagehand model origin') : null
  if (modelOrigin !== null && modelOrigin.ok === false) {
    throw new TypeError(`g2-connector-adapters/browser: ${CODES.SURFACE_FACTS_INCOMPLETE}: ${modelOrigin.detail}`)
  }
  const cdpOrigin = proof.mode === 'attach' ? httpOrigin(proof.cdpEndpointOrigin, 'the declared cdpEndpointOrigin') : null
  if (proof.mode === 'attach' && cdpOrigin.ok === false) {
    throw new TypeError(`g2-connector-adapters/browser: ${CODES.SURFACE_FACTS_INCOMPLETE}: ${cdpOrigin.detail}`)
  }
  // The attach-CDP endpoint is ITSELF a network connect (fix card 4): every
  // operation on an attach mount rides that transport leg, so the closed-set
  // effect projection carries it on every browser row of this mount.
  const attachEffects = proof.mode === 'attach' ? [connectEffect(realmId, cdpOrigin.origin)] : []
  const shared = { familyId: A5_G2_FAMILY.browser, mountCondition: 'declared_mount', realmId, providerId, readNative, definitionIdentityOf, observe, declared: { active: true, detail: '' }, preEffectDisclosure: A5_G2_NAMED_BLOCKERS.BROWSER }

  // root 22:26 pairing: the flat table leaves ride the SAME manifest the
  // approval fingerprint and final edge read — real variant/record, REAL
  // injected incarnation facts ('unobserved' only per the signed B-MCP
  // absence law; no self-attesting constant), explicit nulls for absent
  // pageId/domainAuthorityId. Every existing value stays verbatim: no
  // field moved out, none deleted, no hash standing in for a target.
  const g2BrowserIncarnation = typeof proof.connectionIncarnation === 'string' && proof.connectionIncarnation.length > 0 ? proof.connectionIncarnation : 'unobserved'
  const baseManifest = (method, pageId) => ({
    browserVariant: `${proof.mode}:${method}`,
    record: 'surface:browser_owned',
    operation: `browser-${method}`,
    mode: proof.mode,
    connectionIncarnation: g2BrowserIncarnation,
    providerReSelectionLaw: 'the mount generation owns the Stagehand provider for this Team realm; a captured native handle re-selecting or replacing the provider is gone. Incarnation rotation stale-proofs an approval ONLY IF the connection-owning assembly injects the real fact via declaredService.connectionIncarnation — while the fact reads unobserved the rotation is UNPROVEN, never a claimed guarantee (B-BROWSER re-selection law mirroring the signed B-MCP absence wording @639ed01539)',
    connectionIncarnationReason: typeof proof.connectionIncarnationReason === 'string' && proof.connectionIncarnationReason.length > 0 ? proof.connectionIncarnationReason : null,
    pageId: pageId === undefined ? null : pageId,
    ...(proof.mode === 'attach' ? { attachEndpointOrigin: cdpOrigin.origin, attachNote: 'attached browser may also be changed by its user (native GUIDANCE); incarnation re-check belongs to the owned provider (§5.5)' } : {}),
    domainAuthorityId: typeof proof.domainAuthorityId === 'string' && proof.domainAuthorityId.length > 0 ? proof.domainAuthorityId : null,
  })
  const domainEffects = typeof proof.domainAuthorityId === 'string' && proof.domainAuthorityId.length > 0
    ? () => [domainRefEffect(proof.domainAuthorityId)]
    : () => []

  const instructionRow = (method, entryNote) => buildG2Row({
    ...shared,
    toolName: `stagehand_${method}`,
    operation: `browser-${method}`,
    classifyCall(args) {
      const allowed = method === 'extract' ? ['instruction', 'pageId', 'schema'] : ['instruction', 'pageId']
      const extra = unknownTopLevel(args, allowed)
      if (extra !== null) return extra
      const instruction = requireString(args.instruction, 'instruction')
      if (instruction.ok !== true) return instruction
      let pageId
      if (args.pageId !== undefined) {
        const p = requireString(args.pageId, 'pageId')
        if (p.ok !== true) return p
        pageId = p.value
      }
      if (method === 'extract' && args.schema !== undefined && (args.schema === null || typeof args.schema !== 'object' || Array.isArray(args.schema))) {
        return refuse(CODES.INVALID_ARGUMENTS, '"schema" must be an object when present')
      }
      if (modelOrigin === null || modelOrigin.ok === false) {
        return refuse(CODES.NO_DECLARED_DESTINATION, `no declared Stagehand model origin rides this mount: stagehand_${method} sends page content to the configured external model (contract §3/B-BROWSER — the name does not replace the outbound effect); the N leg must not be hidden and never gets a fake destination`)
      }
      const manifest = baseManifest(method, pageId)
      manifest.modelDestinationOrigin = modelOrigin.origin
      manifest.instructionDigest = sha256(instruction.value)
      manifest.businessObligations = [{
        service: 'stagehand-model', action: method, right: 'connect',
        entry: entryNote,
      }]
      return {
        ok: true,
        effects: [invokeEffect(`stagehand_${method}`), connectEffect(realmId, modelOrigin.origin), ...attachEffects, ...domainEffects()],
        canonical: { instruction: instruction.value, ...(pageId === undefined ? {} : { pageId }), ...(method === 'extract' && args.schema !== undefined ? { schemaDigest: sha256(canonicalJson(args.schema)) } : {}) },
        targetManifest: manifest,
      }
    },
  })

  const rows = {
    stagehand_navigate: buildG2Row({
      ...shared,
      toolName: 'stagehand_navigate',
      operation: 'browser-navigate',
      classifyCall(args) {
        const extra = unknownTopLevel(args, ['url', 'pageId'])
        if (extra !== null) return extra
        const url = requireString(args.url, 'url')
        if (url.ok !== true) return url
        let pageId
        if (args.pageId !== undefined) {
          const p = requireString(args.pageId, 'pageId')
          if (p.ok !== true) return p
          pageId = p.value
        }
        // STRICTER than native z.url() (native.ts:57): http(s) only — a
        // javascript:/file:/data: navigation never rides a connect effect.
        const origin = httpOrigin(url.value, 'the navigation URL')
        if (origin.ok !== true) return origin
        const manifest = baseManifest('navigate', pageId)
        manifest.url = url.value
        manifest.destinationOrigin = origin.origin
        manifest.businessObligations = [{
          service: 'browser', action: 'navigate', right: 'connect',
          entry: 'captured native stagehand_navigate execute -> resources.get(agent) -> native.execute("navigate", …) -> page.goto (index.ts:166-200; native.ts:106-112 @639ed01539); redirects are the owned provider\'s target-boundary law (§5.5)',
        }]
        return {
          ok: true,
          effects: [invokeEffect('stagehand_navigate'), connectEffect(realmId, origin.origin), ...attachEffects, ...domainEffects()],
          canonical: { url: url.value, ...(pageId === undefined ? {} : { pageId }) },
          targetManifest: manifest,
        }
      },
    }),
    stagehand_tabs: buildG2Row({
      ...shared,
      toolName: 'stagehand_tabs',
      operation: 'browser-tabs',
      classifyCall(args) {
        const extra = unknownTopLevel(args, ['action', 'url', 'pageId'])
        if (extra !== null) return extra
        if (!['list', 'new', 'select', 'close'].includes(args.action)) {
          return refuse(CODES.INVALID_ARGUMENTS, '"action" must be one of list|new|select|close (native discriminated union, native.ts:58-62 @639ed01539)')
        }
        let pageId
        if (args.pageId !== undefined) {
          const p = requireString(args.pageId, 'pageId')
          if (p.ok !== true) return p
          pageId = p.value
        }
        if ((args.action === 'select' || args.action === 'close') && pageId === undefined) {
          return refuse(CODES.INVALID_ARGUMENTS, `action ${JSON.stringify(args.action)} requires pageId (native law, native.ts:61)`)
        }
        let url
        let urlOrigin
        if (args.url !== undefined) {
          if (args.action !== 'new') return refuse(CODES.INVALID_ARGUMENTS, 'url is only declared on action "new" (native.ts:60)')
          const u = httpOrigin(args.url, 'the new-tab URL')
          if (u.ok !== true) return u
          url = args.url
          urlOrigin = u.origin
        }
        const manifest = baseManifest('tabs', pageId)
        manifest.branch = args.action
        // explicit-null device (pageId precedent): the REAL url rides
        // verbatim when declared; absence is an explicit null, never a
        // silently missing target field (root 22:44 tabs variant).
        manifest.url = url === undefined ? null : url
        manifest.destinationOrigin = urlOrigin === undefined ? null : urlOrigin
        manifest.businessObligations = [{
          service: 'browser', action: `tab-${args.action}`, right: 'write',
          entry: url === undefined
            ? 'captured native stagehand_tabs execute -> native.execute("tabs", …) (native.ts:113-123 @639ed01539)'
            : 'captured native stagehand_tabs execute -> native.execute("tabs", …) -> context.newPage(url) (native.ts:113-116 @639ed01539): REAL net connect + page creation — the connect effect to the tab URL is CARRIED, never underreported',
        }]
        return {
          ok: true,
          // FIX CARD RULING 1: tabs(new,url) REALLY does `newPage(url)` — a
          // net connect plus page creation — so the closed-set projection
          // MUST carry the connect to the tab URL (the previous I-only
          // answer was a固化漏报, now pinned by the spec leg).
          effects: [invokeEffect('stagehand_tabs'), ...(urlOrigin === undefined ? [] : [connectEffect(realmId, urlOrigin)]), ...attachEffects],
          canonical: { action: args.action, ...(pageId === undefined ? {} : { pageId }), ...(url === undefined ? {} : { url }) },
          targetManifest: manifest,
        }
      },
    }),
    stagehand_screenshot: buildG2Row({
      ...shared,
      toolName: 'stagehand_screenshot',
      operation: 'browser-screenshot',
      classifyCall(args) {
        const extra = unknownTopLevel(args, ['pageId', 'fullPage'])
        if (extra !== null) return extra
        let pageId
        if (args.pageId !== undefined) {
          const p = requireString(args.pageId, 'pageId')
          if (p.ok !== true) return p
          pageId = p.value
        }
        if (args.fullPage !== undefined && typeof args.fullPage !== 'boolean') {
          return refuse(CODES.INVALID_ARGUMENTS, '"fullPage" must be a boolean')
        }
        const manifest = baseManifest('screenshot', pageId)
        manifest.fullPage = args.fullPage === true
        manifest.businessObligations = [{
          service: 'browser', action: 'screenshot', right: 'read',
          entry: 'captured native stagehand_screenshot execute -> native.execute("screenshot", …) returns the base64 frame (native.ts:124-132 @639ed01539); the durable attachment leg belongs to the current owner\'s attachment namespace upstream (B-IMAGE lane law) — this row writes nothing',
        }]
        return {
          ok: true,
          effects: [invokeEffect('stagehand_screenshot'), ...attachEffects],
          canonical: { ...(pageId === undefined ? {} : { pageId }), fullPage: args.fullPage === true },
          targetManifest: manifest,
        }
      },
    }),
    stagehand_act: instructionRow('act', 'captured native stagehand_act execute -> native.execute("act", …) -> stagehand.act(instruction, {page, timeout}) — THE SINGLE-instruction API kept per contract (native.ts:132-135 @639ed01539); form submits included, so no approval label may be read as consent to every business commit (§3/B-BROWSER)'),
    stagehand_observe: instructionRow('observe', 'captured native stagehand_observe execute -> native.execute("observe", …) -> stagehand.observe(instruction, {page, timeout}) (native.ts:140-145 @639ed01539) — page content travels to the Stagehand model'),
    stagehand_extract: instructionRow('extract', 'captured native stagehand_extract execute -> native.execute("extract", …) -> stagehand.extract(instruction, [schema,] {page, timeout}) (native.ts:146-156 @639ed01539) — page content travels to the Stagehand model'),
  }
  return rows
}
