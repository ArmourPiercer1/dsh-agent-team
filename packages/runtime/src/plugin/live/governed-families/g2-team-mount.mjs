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
import { createG2McpResourceAdapters, createG2BrowserAdapters } from './g2-connector-adapters.mjs'

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
  const { realmId, providerId, readNative, definitionIdentityOf, scopeFaces, mcpMount, browserMount } = input
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
          { toolName: row.toolName, operation: row.operation },
          async (resource) => await callResource(resource, BROWSER_METHODS[row.toolName], args, exec?.signal),
          exec?.signal,
          ),
        }),
      })),
      descriptions: Object.freeze(descs.descriptions),
    })
    ports.browser = port
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
  if (mcpResources === null || typeof mcpResources !== 'object' || typeof mcpResources.register !== 'function') {
    return refuse(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, 'the scope mcpResources face is REQUIRED — its real producer is the host mcp-resources scope layer (mcp-resources/src/index.ts @639ed01539); this producer names the gap, it never mints a stand-in face')
  }
  if (typeof makeTransport !== 'function') {
    return refuse(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, 'makeTransport is REQUIRED — the transport factory\'s real producer is the host mcp connection layer over the APPROVED config (stdio/http); minting one here would copy host transport internals into this lane')
  }
  const supply = { mcpResources, makeTransport, ...(entries.Client === undefined ? {} : { entries: { Client: entries.Client } }) }
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
