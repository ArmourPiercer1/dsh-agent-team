/**
 * A5-M2 G2 TEAM MOUNT (root 19:08 dispatch; reworked per the root 19:31
 * concentrated review of 5c597 — all five named defects closed IN THE GLUE;
 * the assembly component lifecycle is NOT reopened):
 *  1. the mount is ASYNC and every refusal AWAITS the cleanup of the ports
 *     this call already built, folding cleanup failures into the refusal
 *     message — "zero survivor" is an AWAITED fact, not a `void` promise;
 *  2. the MCP port's FIRST real generation is awaited (`port.reconnect()`)
 *     BEFORE any rowset exists, so the seam pins a REAL `gen-N` as the
 *     declared incarnation — never a mount-time `unobserved` that would
 *     silence the seam's generation law;
 *  3. the same-provider-generation tie is ENFORCED at the execution edge by
 *     the seam's own measured law (`the LIVE connection generation ...
 *     differs from the declared incarnation; zero forwarding` + the
 *     capture/re-verify pair, g2-provider-seams.mjs:545-561): the approved
 *     question carries gen-N, a rotation to gen-M fails closed at dispatch
 *     until the owning assembly RE-MOUNTS a rowset carrying the new gen — no
 *     second ledger, no new machinery;
 *  4. the BROWSER rows no longer actuate through a captured native that would
 *     re-enter the host plugin's own admission: each mounted row's invoke
 *     ROUTES THROUGH `browserPort.run(callFacts, work, signal)` — the SIGNED
 *     public-worker lease (consumeApproval the caller-supplied Team PA face,
 *     launchOwned, real cancel, close-drain). The stagehand method mapping is
 *     the caller's REQUIRED `callResource` closure — the mount never guesses
 *     which public face a `stagehand_<method>` row speaks;
 *  5. the MCP rows dispatch on the Team-scoped chain the assembly built:
 *     readNative captures the runtime trio the member scope answers, whose
 *     per-call provider re-selection (mcp-resources/src/index.ts:120-125
 *     @639ed01539, by SCOPE + serverName) resolves to the provider THIS mount
 *     registered into the PASSED mcpResources face — the Team scope layer
 *     holds ONLY the Team provider; nothing is registered globally.
 *
 * WEB stays unsupplied BY LAW: `webRouteGap` re-states A5_G2_WEB_ROUTE_GAP
 * verbatim (the public faces exist but their selection reads the
 * COMPOSITION-GLOBAL configured id; a per-realm selection seam at
 * 639ed01539 is the recorded CORE_SEAM_BLOCKER). Any all-G2-green claim that
 * counts WEB is false and this module keeps it visibly so.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g2-team-mount
 */
import { A5_G2_WEB_ROUTE_GAP, createG2TeamBrowserPort, createG2TeamMcpPort, A5_G2_ASSEMBLY_CODES, loadG2TeamAssemblyEntries } from './g2-team-assembly.mjs'
import { createG2McpResourceAdapters, createG2BrowserAdapters, createG2WebAdapters } from './g2-connector-adapters.mjs'

const refuse = (code, message) => Object.freeze({ ok: false, code, message })

// the closed mount-name spellings (the SAME lists the plane's G2 gate 0f
// enforces in team-tool-plane.mjs — literal here so a rowset name drift is
// caught at BOTH the mount and the plane, never silently shared).
const MCP_TOOL_NAMES = Object.freeze(['list_mcp_resource_templates', 'list_mcp_resources', 'read_mcp_resource'])
const BROWSER_TOOL_NAMES = Object.freeze(['stagehand_act', 'stagehand_extract', 'stagehand_navigate', 'stagehand_observe', 'stagehand_screenshot', 'stagehand_tabs'])
// the stagehand method behind each spelling — the lease callFacts stay
// jsonClone-safe strings; the ACTUAL dispatch is the caller's callResource.
const BROWSER_METHODS = Object.freeze({
  stagehand_act: 'act', stagehand_extract: 'extract', stagehand_navigate: 'navigate',
  stagehand_observe: 'observe', stagehand_screenshot: 'screenshot', stagehand_tabs: 'tabs',
})

/**
 * @param input {{
 *   realmId: string, providerId: string,
 *   readNative: (name: string) => { name: string; description: string; execute: Function } | undefined,
 *   definitionIdentityOf: Function,
 *   scopeFaces?: { mcpResources?: { register: Function } },
 *   mcpMount?: { declaredSurfaceConfig: object, resourceServerName: string,
 *                entries: { Client: Function }, makeTransport: Function,
 *                toolCallTimeoutMs: number },
 *   browserMount?: { mode: 'launch'|'attach', nativeConfig: object,
 *                    entries: { launchChromium: Function, openBrowserWorker: Function },
 *                    consumeApproval: Function, callResource: Function,
 *                    launchEnvelope?: object, declaredServiceFacts?: object },
 *   observe?: (event) => void
 * }}
 */
export async function createG2TeamMount(input = {}) {
  const { realmId, providerId, readNative, definitionIdentityOf, scopeFaces, mcpMount, browserMount, webMount } = input
  const observe = typeof input.observe === 'function' ? input.observe : () => {}
  if (typeof realmId !== 'string' || realmId.length === 0 || typeof providerId !== 'string' || providerId.length === 0) {
    return refuse(A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE, 'realmId/providerId are REQUIRED — the mount speaks for ONE realm under ONE provider identity')
  }
  if (typeof readNative !== 'function' || typeof definitionIdentityOf !== 'function') {
    return refuse(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, 'readNative (the scope tools.get capture seam) and definitionIdentityOf are REQUIRED — the mount captures the SAME native faces the plane places, it never substitutes its own')
  }
  /** every port THIS call constructed; a refusal closes them all, awaited. */
  const built = []
  const backends = {}
  const ports = {}

  /** Awaited complete cleanup: each port runs its REAL close law; failures
   * are RETURNED, never swallowed. */
  const disposeBuilt = async () => {
    const failures = []
    for (const { label, port } of built) {
      try {
        const outcome = await port.close()
        if (outcome?.ok === false) {
          const late = Array.isArray(outcome.failures) && outcome.failures.length > 0 ? outcome.failures : ['close reported not-ok without details']
          for (const f of late) failures.push(`${label}: ${String(f)}`)
        }
      } catch (error) {
        failures.push(`${label}: ${String(error?.message ?? error).slice(0, 200)}`)
      }
    }
    return failures
  }
  const withCleanup = (message, cleanup) => message + (cleanup.length > 0 ? ` — refusal cleanup FAILED: ${cleanup.join('; ')}` : '')
  const detail = (error) => String(error?.message ?? error).slice(0, 300)

  const descriptionsFrom = (names) => {
    const descriptions = {}
    for (const name of names) {
      const def = readNative(name)
      if (def === undefined || def === null || typeof def.description !== 'string' || def.description.length === 0) {
        return { refusal: refuse(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, `the scope answered no captured native definition for "${name}" — the mount refuses to place a row whose native description it did not capture (the plane re-checks the same law at placement)`) }
      }
      descriptions[name] = def.description
    }
    return { descriptions }
  }

  if (mcpMount !== undefined && mcpMount !== null) {
    let port
    try {
      port = createG2TeamMcpPort({ ...mcpMount, observe: (event) => { observe({ lane: 'mcp', ...event }) } })
    } catch (error) {
      // nothing built yet on this path — no cleanup to await
      return refuse(String(error?.code ?? A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE), `g2Mcp mount refused at port construction: ${detail(error)}`)
    }
    built.push({ label: `mcp:${mcpMount.resourceServerName}`, port })
    try {
      // the REAL Team-scoped register: the PASSED scope face, bound disposer —
      // never a global resolution, never server-name takeover.
      if (typeof scopeFaces?.mcpResources?.register !== 'function') {
        throw Object.assign(new TypeError(`${A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE}: the B-MCP mount ARM requires the scoped mcpResources face from the REAL member/Team scope ctx (bindings state.mcpMountCtx, createScope(agentCtx, runtimeAgent) — the mini-MCP mounting context, NEVER the shared row ctx); an apply-ctx or global-store face is NOT accepted, and a missing face never arms a global registration (root 21:30)`), { code: A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE })
      }
      port.register(scopeFaces?.mcpResources)
    } catch (error) {
      const cleanup = await disposeBuilt()
      return refuse(String(error?.code ?? A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE), withCleanup(`g2Mcp mount refused at scope-face registration: ${detail(error)}`, cleanup))
    }
    const descs = descriptionsFrom(MCP_TOOL_NAMES)
    if (descs.refusal !== undefined) {
      const cleanup = await disposeBuilt()
      return refuse(descs.refusal.code, withCleanup(descs.refusal.message, cleanup))
    }
    // THE generation law (root 19:31 item 3): the FIRST real generation is up
    // BEFORE any rowset exists, so the seam's declared incarnation is a real
    // gen-N. A rotation underneath this mount then fails closed at the edge
    // (seam SURFACE_DRIFT + capture/re-verify) until a RE-MOUNT carries the
    // new gen — never a silent ride on a rotated connection.
    try {
      await port.reconnect()
    } catch (error) {
      const cleanup = await disposeBuilt()
      return refuse(String(error?.code ?? A5_G2_ASSEMBLY_CODES.CONNECT_FAILED), withCleanup(`g2Mcp mount refused: the first real generation never came up (${detail(error)})`, cleanup))
    }
    const stats = port.stats()
    if (typeof stats.generation !== 'string' || stats.generation.length === 0) {
      const cleanup = await disposeBuilt()
      return refuse(A5_G2_ASSEMBLY_CODES.CONNECT_FAILED, withCleanup('g2Mcp mount refused: after connect the port answers no generation string', cleanup))
    }
    const approved = mcpMount.declaredSurfaceConfig ?? {}
    const approvedGeneration = stats.generation
    backends.g2Mcp = Object.freeze({
      createRowset: () => Object.values(createG2McpResourceAdapters({
        realmId, providerId, readNative, definitionIdentityOf, observe,
        declaredService: Object.freeze({
          present: true,
          serverName: approved.serverName,
          transport: approved.transport,
          ...(Array.isArray(approved.command) ? { command: approved.command } : {}),
          ...(typeof approved.endpointUrl === 'string' ? { endpointUrl: approved.endpointUrl } : {}),
          ...(typeof approved.cwd === 'string' ? { cwd: approved.cwd } : {}),
          ...(typeof approved.domainAuthorityId === 'string' ? { domainAuthorityId: approved.domainAuthorityId } : {}),
          // a REAL gen-N from the generation THIS mount brought up: the
          // approved question and the seam's declared incarnation carry the
          // SAME generation; live drift is refused at the edge, not guessed.
          connectionIncarnation: approvedGeneration,
        }),
        // ROOT 19:31 item 3/5 (ACTUATION): the row's body is TEAM-BOUND — it
        // dispatches on the port request leg (seam -> capture -> the ONE live
        // generation's client), not on a captured native that re-selects by
        // exec.agent scope + serverName at request time. Governance is
        // UNCHANGED (classify/effects/targetManifest remain the adapter's;
        // the plane's walk + digest ride them verbatim); only the door the
        // consumed call walks through moves. Raw args ride verbatim: the
        // manifest's null cursors NEVER reach the native leg.
      })).map((row) => Object.freeze({
        ...row,
        invoke: async (args, exec) => {
          const now = port.stats()
          if (now.generation !== approvedGeneration) {
            throw new Error(`P_G2_MOUNT_GENERATION_DRIFT: the approved question carries generation ${JSON.stringify(approvedGeneration)}, the live mount now answers ${JSON.stringify(now.generation)} — the owning assembly must RE-MOUNT (a new rowset, a new approval); a rotated connection is never ridden silently, zero forwarding`)
          }
          const request = { server: approved.serverName, method: row.operation }
          if (row.toolName === 'read_mcp_resource') request.uri = args?.uri
          else if (typeof args?.cursor === 'string') request.cursor = args.cursor
          // the row-body envelope the consumption edge answers with
          // {ok:true, value}: the port's answer rides as the VALUE.
          const answer = await port.request(request, exec)
          return Object.freeze({ ok: true, value: answer })
        },
      })),
      descriptions: Object.freeze(descs.descriptions),
    })
    ports.mcp = port
  }

  if (browserMount !== undefined && browserMount !== null) {
    if (typeof browserMount.callResource !== 'function') {
      const cleanup = await disposeBuilt()
      return refuse(A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE, withCleanup('g2Browser mount refused: callResource (the production stagehand method mapping — the caller\'s closure over the PUBLIC runtime face) is REQUIRED; the mount never guesses which face a stagehand_<method> row speaks', cleanup))
    }
    let port
    try {
      port = createG2TeamBrowserPort({ ...browserMount, observe: (event) => { observe({ lane: 'browser', ...event }) } })
    } catch (error) {
      const cleanup = await disposeBuilt()
      return refuse(String(error?.code ?? A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE), withCleanup(`g2Browser mount refused at port construction: ${detail(error)}`, cleanup))
    }
    built.push({ label: 'browser', port })
    const descs = descriptionsFrom(BROWSER_TOOL_NAMES)
    if (descs.refusal !== undefined) {
      const cleanup = await disposeBuilt()
      return refuse(descs.refusal.code, withCleanup(descs.refusal.message, cleanup))
    }
    const facts = browserMount.declaredServiceFacts ?? {}
    const { callResource } = browserMount
    backends.g2Browser = Object.freeze({
      createRowset: () => Object.values(createG2BrowserAdapters({
        realmId, providerId, readNative, definitionIdentityOf, observe,
        declaredService: Object.freeze({
          present: true,
          mode: browserMount.mode,
          ...(typeof facts.modelOrigin === 'string' ? { modelOrigin: facts.modelOrigin } : {}),
          ...(typeof facts.cdpEndpointOrigin === 'string' ? { cdpEndpointOrigin: facts.cdpEndpointOrigin } : {}),
          ...(typeof facts.domainAuthorityId === 'string' ? { domainAuthorityId: facts.domainAuthorityId } : {}),
          // root 22:39/22:44 supply path closed (MCP-style passthrough):
          // the generation facts the connection-owning assembly declares
          // via mount config REACH the mint verbatim; the mount never
          // mints or rotates them and never blocks the guarantee the
          // facts do not carry.
          ...(typeof facts.connectionIncarnation === 'string' && facts.connectionIncarnation.length > 0 ? { connectionIncarnation: facts.connectionIncarnation } : {}),
          ...(typeof facts.connectionIncarnationReason === 'string' && facts.connectionIncarnationReason.length > 0 ? { connectionIncarnationReason: facts.connectionIncarnationReason } : {}),
        }),
        // row actuation moved to the port lease BELOW (the map replaces
        // invoke); the adapters still own classify/effects/targetManifest.
      })).map((row) => Object.freeze({
        ...row,
        // ROOT 19:31 item 4: the row's ACTUATION routes through the SIGNED
        // port lease — public-worker acquisition with real cancel, one owner
        // + one lease, close-drain — never through a captured native that
        // would re-enter the host plugin\'s own SessionResources admission.
        invoke: async (args, exec) => Object.freeze({
          ok: true,
          value: await port.run(
          // the approval this call consumed, when the walk rode it (the ONE
          // pass-through fact, plane :3597 law): the lease's consumeApproval
          // facts carry approvedCallId for per-call confirmation.
          Object.assign({ toolName: row.toolName, operation: row.operation }, typeof exec?.g2ApprovedCallId === 'string' ? { approvedCallId: exec.g2ApprovedCallId } : {}, exec?.g2ConsumedProof !== null && typeof exec?.g2ConsumedProof === 'object' ? { consumedProof: exec.g2ConsumedProof } : {}),
          async (resource) => await callResource(resource, BROWSER_METHODS[row.toolName], args, exec?.signal),
          exec?.signal,
          ),
        }),
      })),
      descriptions: Object.freeze(descs.descriptions),
    })
    ports.browser = port
  }

  // ROOT Web wiring card: the g2Web backend rides the SAME backends face
  // the plane injects (backends literal at agent-bindings :3248+:3256).
  // Lanes arrive from the host supply (r44 out.webFixedLanes pass-through);
  // rows are the CLOSED createG2WebAdapters face; descriptions are the
  // REAL captured native bytes via readNative. A broken/missing piece
  // refuses the mount typed — the plane's fail-close law is never papered
  // with an empty rowset or placeholder bytes.
  if (webMount !== null && typeof webMount === 'object') {
    try {
      backends.g2Web = createG2WebBackend({
        webAdaptersMod: { createG2WebAdapters },
        realmId, providerId, readNative, definitionIdentityOf, observe,
        ...(typeof webMount.searchOrigin === 'string' && webMount.searchOrigin.length > 0 ? { searchOrigin: webMount.searchOrigin } : {}),
        ...(typeof webMount.readProviderFacts === 'function' ? { readProviderFacts: webMount.readProviderFacts } : {}),
        lanes: webMount.lanes,
        descriptions: Object.freeze({
          web_fetch: String(readNative('web_fetch')?.description ?? ''),
          web_search: String(readNative('web_search')?.description ?? ''),
        }),
      })
    } catch (error) {
      const cleanup = await disposeBuilt()
      return refuse(A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE, withCleanup(`g2Web backend refused at mount: ${String(error?.message ?? error)}`, cleanup))
    }
  }

  return Object.freeze({
    ok: true,
    backends: Object.freeze(backends),
    ports: Object.freeze(ports),
    // WEB: not suppliable here — the named gap, verbatim from the SIGNED
    // assembly module. The plane\'s WEB injection point stays fail-closed.
    webRouteGap: A5_G2_WEB_ROUTE_GAP,
    dispose: async () => {
      const failures = await disposeBuilt()
      return failures.length === 0 ? { ok: true, failures: [] } : { ok: false, failures }
    },
  })
}

/**
 * THE SUPPLY PRODUCER (root 20:04: 本族实际推进, 供给不全丢 CENTER):
 * builds the face the bindings' `deps.g2TeamAssembly()` accessor must
 * answer, from approved config ALONE. The pinned PUBLIC entry files load
 * through the SIGNED owner loader (loadG2TeamAssemblyEntries — real dynamic
 * imports, openNativeBrowser-direct stays REJECTED there; no second loader,
 * no re-implementation). The three faces this lane cannot mint stay
 * REQUIRED pass-throughs with typed refusals — the scope mcpResources face,
 * the transport factory (its real producer is the host mcp connection
 * layer), and the browser mapping/approval (the B-BROWSER rule map is its
 * own lane): the producer NAMES each gap it cannot fill instead of faking
 * one. The host row assembly hands the result to deps.g2TeamAssembly() —
 * that last wiring hop lives in the host deps construction (outside this
 * family region; obligation recorded, not silently CENTER-dumped).
 */
export async function createG2TeamAssemblySupply(input = {}) {
  const { entryPaths, mcpResources, makeTransport, consumeBrowserApproval, callResource } = input
  if (entryPaths === null || typeof entryPaths !== 'object') {
    return refuse(A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE, 'entryPaths {launchEntry, workerEntry, sdkClientEntry} are REQUIRED — the loader pins the PUBLIC entry files; paths are approved config, never guessed here')
  }
  let entries
  try {
    entries = await loadG2TeamAssemblyEntries(entryPaths)
  } catch (error) {
    return refuse(String(error?.code ?? A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE), `the SIGNED entry loader refused: ${String(error?.message ?? error).slice(0, 300)}`)
  }
  // ROOT 21:30: face-absent is a LEGITIMATE host-producer answer — the
  // scoped face is minted per member at the REAL scope (bindings
  // state.mcpMountCtx, createScope(agentCtx, runtimeAgent)) and augmented
  // pre-mount; a face from the apply-ctx or the global store is NOT
  // accepted at the arm (createG2TeamMount refuses there).
  if (typeof makeTransport !== 'function') {
    return refuse(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, 'makeTransport is REQUIRED — the transport factory\'s real producer is the host mcp connection layer over the APPROVED config (stdio/http); minting one here would copy host transport internals into this lane')
  }
  const supply = { ...(input?.webFixedLanes !== null && typeof input?.webFixedLanes === 'object' ? { webFixedLanes: input.webFixedLanes } : {}), ...(input?.webFixedTransport !== null && typeof input?.webFixedTransport === 'object' ? { webFixedTransport: input.webFixedTransport } : {}), ...(mcpResources !== null && typeof mcpResources === 'object' && typeof mcpResources.register === 'function' ? { mcpResources } : {}), makeTransport, ...(entries.Client === undefined ? {} : { entries: { Client: entries.Client } }) }
  // browser supply is ALL-OR-NOTHING (the loader always carries the two
  // public entry functions; arming them WITHOUT the Team PA approval face +
  // the stagehand method mapping would arm a row whose door nobody opened):
  // a half browser supply is refused, an absent one is a legitimate
  // MCP-only world exactly like the plane's own pairing law.
  const hasApproval = typeof consumeBrowserApproval === 'function'
  const hasMapping = typeof callResource === 'function'
  if (hasApproval !== hasMapping) {
    return refuse(A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE, 'browser supply is PARTIAL: consumeBrowserApproval (the Team PA face) and callResource (the stagehand method mapping) arrive together or not at all — the B-BROWSER target rule and its approval pairing are their own lane\'s landing; naming the gap, refusing the half-supply')
  }
  if (hasApproval && hasMapping) {
    supply.browserEntries = { launchChromium: entries.launchChromium, openBrowserWorker: entries.openBrowserWorker }
    supply.consumeBrowserApproval = consumeBrowserApproval
    supply.callResource = callResource
  }
  return Object.freeze({ ok: true, supply })
}

/**
 * THE consumed RELAY (root 21:24 law): the lease's consumeApproval answer
 * is a RELAY of the durable chain the plane walk ALREADY consumed in THIS
 * SAME CALL — the walk's correlation rides the lease facts
 * (approvedCallId, commit 1e03e30f4), the record is found by
 * listControlState().requests[].correlation, the terminal decision is read
 * through the EXISTING awaitControlDecision. It is NOT a PA proof, NOT a
 * second grant, NOT a new ledger: vocabulary only as the control package
 * defines it (status 'pending'|'decided'|'abandoned'; decision 'allow' |
 * 'deny' | 'stale-denied'). Anything that is not the SAME call's decided
 * allow answers 'refused' — fail-closed. Bounded wait (deadlineMs), no
 * unbounded loops.
 */
export function createG2ConsumedRelay ({ getService, rootSessionId, deadlineMs = 3000, pollMs = 50 } = {}) {
  if (typeof getService !== 'function' || typeof rootSessionId !== 'string' || rootSessionId.length === 0) {
    throw new TypeError('createG2ConsumedRelay: getService (lazy durable ControlService reader) and rootSessionId are REQUIRED')
  }
  return async (callFacts) => {
    const correlation = callFacts?.approvedCallId
    if (typeof correlation !== 'string' || correlation.length === 0) return 'refused'
    const deadline = Date.now() + Math.max(0, Number(deadlineMs) || 0)
    for (;;) {
      const service = getService()
      if (service === null || service === undefined || typeof service.listControlState !== 'function' || typeof service.awaitControlDecision !== 'function') return 'refused'
      let record
      try {
        const state = await service.listControlState(rootSessionId)
        record = (state?.requests ?? []).find((r) => String(r?.correlation ?? '') === correlation)
      } catch { return 'refused' }
      if (record !== undefined) {
        if (record.status === 'decided') {
          try {
            const decision = await service.awaitControlDecision({ rootSessionId, requestId: record.requestId })
            return String(decision?.decision) === 'allow' ? 'consumed' : 'refused'
          } catch { return 'refused' }
        }
        if (record.status !== 'pending') return 'refused'
      }
      if (Date.now() >= deadline) return 'refused'
      await new Promise((resolve) => globalThis.setTimeout(resolve, Math.max(1, Number(pollMs) || 50)))
    }
  }
}

/**
 * The PUBLIC worker mapping, family-home copy (worker-client.ts:70-71
 * execute(method,args,signal) on the lease-owned resource.value) — the
 * bindings may pair it with createG2ConsumedRelay when the host supply
 * carries browser entries but not the session pairing (all-or-nothing
 * still enforced at the producer; this only keeps the REAL mapping and
 * the REAL relay in ONE family module).
 */
export async function callResourceViaWorkerExecute (resource, method, args, signal) {
  const runtime = resource?.value
  if (typeof runtime?.execute !== 'function') {
    throw new Error('callResourceViaWorkerExecute: the lease-owned resource.value answers no execute(method, args, signal) (worker-client.ts:70-71) — refusing, no fallback, no runtime swap')
  }
  return await runtime.execute(method, args, signal)
}

/**
 * THE Browser approval boundary (root 21:34): the lease's consumeApproval
 * answers 'consumed' ONLY on the kernel's REAL final PA consumedProof of
 * THIS call — the one-shot consume witness the walk already earned
 * (team-tool-plane :3588 law: allow without its proof never runs the body;
 * the struct rides the exec unchanged, plane :3597 hunk). NOT the
 * correlation, NOT a Control-state read, NOT a self-attestation: the row
 * and this boundary both only RELAY the kernel's witness shape
 * ({ grant: { grantId: string }, ... } — verified identically at plane
 * :3067-3069). Missing/malformed proof answers 'refused' — fail-closed.
 */
export function createG2ConsumedProofApproval () {
  return async (callFacts) => {
    const proof = callFacts?.consumedProof
    if (proof === undefined || proof === null || typeof proof.grant !== 'object' || proof.grant === null || typeof proof.grant.grantId !== 'string' || proof.grant.grantId.length === 0) {
      return 'refused'
    }
    return 'consumed'
  }
}

/**
 * THE first real caller-supply piece (root 00:31 unlock): the Team-only
 * FIXED web provider LANES for the plane's B-WEB closed injection face.
 * The lane.provider MUST be a createG2WebProviderSeam product (brand
 * verified at team-tool-plane.mjs:3477); the seam pins the REAL provider
 * OBJECT (the host-constructed public HttpFetchProvider — id
 * LOCAL_FETCH_PROVIDER_ID rides from the provider itself, never a
 * string pin) with the declared mount envelope + the CURRENT reader.
 * No global/env provider flip, no per-realm WebRuntime, no composition:
 * this is the named slot the plane already fail-closes on, supplied
 * with the fixed face this root's config declared.
 */
export function createG2WebFixedLanes ({ fixedProvider, declared, readMountFacts, observe = () => {}, seamMod } = {}) {
  if (fixedProvider === null || typeof fixedProvider !== 'object') {
    throw new Error('G2_SUPPLY_ENTRY_INVALID: createG2WebFixedLanes needs the REAL fixed provider object (the public HttpFetchProvider instance); nothing pins around an absence')
  }
  if (typeof fixedProvider.id !== 'string' || fixedProvider.id.length === 0) {
    throw new Error('G2_SUPPLY_ENTRY_INVALID: the fixed provider carries no own id — the seam pins identity FROM the provider, never invents one')
  }
  // The reviewed seam product is { provider(brand-pinned), registrationLaw,
  // stats, pinnedMethod } — the lane rides ITS law/stats VERBATIM; nothing
  // is hand-assembled beside the reviewed seam.
  const wrapped = seamMod.createG2WebProviderSeam({
    kind: 'fetch',
    providerId: fixedProvider.id,
    getRealProvider: () => fixedProvider,
    declared,
    readMountFacts,
    observe,
  })
  return Object.freeze({
    web_fetch: Object.freeze({
      provider: wrapped.provider,
      registrationLaw: wrapped.registrationLaw,
      stats: wrapped.stats,
    }),
  })
}

/* ROOT card: the {name, execute} rowset drafted at 00:53 is REMOVED.
 * Verified against the real production faces: the family registration
 * loop and g2RowExecute read the STANDARD G2 row face
 * ({toolName, familyId, adapterRevision, providerId, mountCondition,
 * registrationSchema, classify, invoke, drain}) and the CLOSED web rows
 * in that face already exist in g2-connector-adapters.mjs
 * (createG2WebAdapters: web_fetch / web_search with classifyCall laws
 * that mint the real effects + targetManifest). The draft also broke
 * two laws the card names: it read raw.effects / composed a connect
 * effect from raw destinationOrigin (model fields never upgrade to
 * approved effects) and read exec.parametersFingerprint, which the
 * plane does not inject there (empty-reads and constants are both
 * forbidden). The lawful caller path: createG2WebAdapters rows ride
 * backends.g2Web through g2RowExecute's ONE final edge; after that
 * edge the call's ACTUAL approved effects / identity / original
 * fingerprint / proof travel to the provider through the internal
 * dispatch context, and the trio relays only that witness (r42). */

/**
 * THE standard g2Web backend face for the plane's backends injection
 * (verified shapes: createG2WebAdapters answers { web_fetch, web_search }
 * rows in the standard G2 face; the plane's row check reads
 * toolName/familyId/adapterRevision/providerId + classify/invoke/drain
 * functions + descriptions bytes; teamFixedWebProviderLanes must be the
 * seam-branded lanes from createG2WebFixedLanes). Synchronous, non-empty
 * contract: an honest inability to row is a THROW at build, never an
 * empty rowset.
 */
export function createG2WebBackend ({ webAdaptersMod, realmId, providerId, readNative, searchOrigin, readProviderFacts, definitionIdentityOf, observe, lanes, descriptions } = {}) {
  if (lanes === null || typeof lanes !== 'object' || lanes.web_fetch === undefined || lanes.web_fetch.provider === undefined) {
    throw new Error('G2_SUPPLY_ENTRY_INVALID: the g2Web backend requires the seam-branded fixed lanes (createG2WebFixedLanes product); without them the plane fail-closes by law, so nothing is injected here either')
  }
  const build = () => Object.values(webAdaptersMod.createG2WebAdapters({
    realmId, providerId, readNative,
    ...(typeof searchOrigin === 'string' && searchOrigin.length > 0 ? { searchOrigin } : {}),
    readProviderFacts, definitionIdentityOf, ...(typeof observe === 'function' ? { observe } : {}),
  }))
  const probe = build()
  if (probe.length === 0) throw new Error('G2_SUPPLY_ENTRY_INVALID: the web adapters answered an empty rowset — a contract breach, not an honest no-mount')
  if (descriptions === null || typeof descriptions !== 'object' || typeof descriptions.web_fetch !== 'string' || descriptions.web_fetch.length === 0) {
    throw new Error('G2_SUPPLY_ENTRY_INVALID: the plane law requires captured description BYTES for web_fetch; the owning assembly must supply the real captured text, never a placeholder')
  }
  return Object.freeze({
    createRowset: build,
    descriptions: Object.freeze({ ...descriptions }),
    teamFixedWebProviderLanes: Object.freeze({ ...lanes }),
  })
}
