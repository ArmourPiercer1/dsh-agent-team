/**
 * A5-M2 G2 TEAM MOUNT (root 19:08 continuation): the OWNING-ASSEMBLY glue
 * between the SIGNED Team assembly ports (g2-team-assembly.mjs rev4 — cherry-
 * picked original bytes, owner feat/a5m2-g2fix: real Team-scoped transport
 * generation/timeout, real transport+handle ownership per generation, close
 * that SYNCHRONOUSLY cuts admission then drains; browser port over the PUBLIC
 * launchChromium/openBrowserWorker faces with launchOwned + cancel + close-
 * drain) and the production plane's G2 injection points (team-tool-plane.mjs
 * `backends.g2Mcp`/`backends.g2Browser`, the placement-moment rowset law, the
 * ONE shared PA walk).
 *
 * What this module owns (and ONLY this):
 *  - it constructs the SIGNED ports from APPROVED CONFIG passed in by the
 *    mount-caller (the production host row / agent-bindings hop): the
 *    declared surface config, the Team-only server name, the REAL public
 *    entries, the transport factory, the approved tool-call timeout. It never
 *    invents an endpoint, never defaults a timeout, never reads or writes a
 *    global, never resolves a face through a global lookup — the MCP scope
 *    face is the one PASSED to it (`scopeFaces.mcpResources`, the
 *    ctx.inject(['mcpResources']) face OF THAT SCOPE), and the port binds its
 *    register/disposer to exactly that face instance (Team-only isolation is
 *    the face binding, never server-name matching).
 *  - it supplies the rowset face the plane places: the B-MCP trio / B-BROWSER
 *    six over `g2-connector-adapters.mjs`, with the declaredService proof the
 *    adapters require DERIVED ONLY from the approved config plus the LIVE
 *    port stats (a real `connectionIncarnation: gen-N` once a generation is
 *    up; the honest `unobserved` + named blocker until then — never a fake
 *    incarnation).
 *  - it owns the close-drain hop: `dispose()` closes each constructed port
 *    with its REAL close law (MCP: synchronous cutoff + bound-face unregister
 *    + serial drain of every pending/retained generation; BROWSER: cancel the
 *    mid-ready acquisition for real, then drain the lease). Failures are
 *    REPORTED, never swallowed.
 *  - WEB stays exactly where the root ruling put it: this mount NEVER
 *    supplies a `g2Web` backend. `webRouteGap` re-states A5_G2_WEB_ROUTE_GAP
 *    verbatim — the public faces exist but selection reads a COMPOSITION-
 *    GLOBAL configured id, so until a per-realm provider-selection seam
 *    lands upstream (CORE_SEAM_BLOCKER, recorded not requested), the
 *    Team-only fixed provider lanes stay unsupplied and the plane's WEB
 *    injection point stays fail-closed. No global/env route rides through.
 *
 * Refusals are returned as values ({ ok:false, code, message }) — the
 * mount-caller decides; a half-built world never returns: any refusal
 * disposes whatever ports THIS call already constructed (zero surviving
 * transports, zero surviving registrations).
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g2-team-mount
 */
import { A5_G2_WEB_ROUTE_GAP, createG2TeamBrowserPort, createG2TeamMcpPort, A5_G2_ASSEMBLY_CODES } from './g2-team-assembly.mjs'
import { createG2McpResourceAdapters, createG2BrowserAdapters } from './g2-connector-adapters.mjs'

const refuse = (code, message) => Object.freeze({ ok: false, code, message })

// the closed mount-name spellings (the SAME lists the plane's G2 gate 0f
// enforces in team-tool-plane.mjs — kept literal here so a rowset name drift
// is caught at BOTH the mount and the plane, not silently shared).
const MCP_TOOL_NAMES = Object.freeze(['list_mcp_resource_templates', 'list_mcp_resources', 'read_mcp_resource'])
const BROWSER_TOOL_NAMES = Object.freeze(['stagehand_act', 'stagehand_extract', 'stagehand_navigate', 'stagehand_observe', 'stagehand_screenshot', 'stagehand_tabs'])

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
 *                    consumeApproval: Function, launchEnvelope?: object,
 *                    declaredServiceFacts?: object },
 *   observe?: (event) => void
 * }}
 * @returns {{ ok: true, backends: Record<string, { createRowset: Function, descriptions: Record<string,string> }>,
 *             ports: Record<string, { close: Function, stats: Function }>,
 *             webRouteGap: object, dispose: () => Promise<{ ok: boolean, failures: string[] }> }
 *           | { ok: false, code: string, message: string }}
 */
export function createG2TeamMount(input = {}) {
  const { realmId, providerId, readNative, definitionIdentityOf, scopeFaces, mcpMount, browserMount } = input
  const observe = typeof input.observe === 'function' ? input.observe : () => {}
  if (typeof realmId !== 'string' || realmId.length === 0 || typeof providerId !== 'string' || providerId.length === 0) {
    return refuse(A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE, 'realmId/providerId are REQUIRED — the mount speaks for ONE realm under ONE provider identity')
  }
  if (typeof readNative !== 'function' || typeof definitionIdentityOf !== 'function') {
    return refuse(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, 'readNative (the scope tools.get capture seam) and definitionIdentityOf are REQUIRED — the mount captures the SAME native faces the plane places, it never substitutes its own')
  }
  /** ports constructed SO FAR — a later refusal disposes them (no half-world). */
  const built = []
  const backends = {}

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

  const disposeBuilt = async () => {
    const failures = []
    for (const { label, port } of built) {
      try {
        await port.close()
      } catch (error) {
        failures.push(`${label}: ${String(error?.message ?? error).slice(0, 200)}`)
      }
    }
    return failures.length === 0 ? { ok: true, failures: [] } : { ok: false, failures }
  }

  if (mcpMount !== undefined && mcpMount !== null) {
    let port
    try {
      port = createG2TeamMcpPort({ ...mcpMount, observe: (event) => { observe({ lane: 'mcp', ...event }) } })
    } catch (error) {
      return refuse(String(error?.code ?? A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE), `backends g2Mcp mount refused at port construction: ${String(error?.message ?? error)}`)
    }
    built.push({ label: `mcp:${mcpMount.resourceServerName}`, port })
    try {
      // the REAL Team-scoped register: the PASSED scope face, bound disposer —
      // never a global resolution, never server-name takeover.
      port.register(scopeFaces?.mcpResources)
    } catch (error) {
      void disposeBuilt() // a half-built world never survives: whatever this call constructed is really closed
      return refuse(String(error?.code ?? A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE), `backends g2Mcp mount refused at scope-face registration: ${String(error?.message ?? error)}`)
    }
    const descs = descriptionsFrom(MCP_TOOL_NAMES)
    if (descs.refusal !== undefined) {
      void disposeBuilt()
      return descs.refusal
    }
    const approved = mcpMount.declaredSurfaceConfig ?? {}
    backends.g2Mcp = Object.freeze({
      createRowset: () => {
        // the declared proof the adapters require, DERIVED here: approved
        // config facts + the port's CURRENT generation as the connection
        // incarnation (a real gen-N once a generation is up; absent ⇒ the
        // adapters keep their honest 'unobserved' + named blocker).
        const stats = port.stats()
        return Object.values(createG2McpResourceAdapters({
          realmId, providerId, readNative, definitionIdentityOf, observe,
          declaredService: Object.freeze({
            present: true,
            serverName: approved.serverName,
            transport: approved.transport,
            ...(typeof approved.command === 'object' && approved.command !== null ? { command: approved.command } : {}),
            ...(typeof approved.endpointUrl === 'string' ? { endpointUrl: approved.endpointUrl } : {}),
            ...(typeof approved.cwd === 'string' ? { cwd: approved.cwd } : {}),
            ...(typeof approved.domainAuthorityId === 'string' ? { domainAuthorityId: approved.domainAuthorityId } : {}),
            ...(typeof stats.generation === 'string' ? { connectionIncarnation: stats.generation } : {}),
          }),
        })).map((row) => Object.freeze({
          ...row,
          // the Team-owned connection facts ride EVERY row the mount places:
          // the approved timeout is the port's, the generation is the port's
          // CURRENT one at row-build time.
          teamConnectionFacts: Object.freeze({ server: stats.server, generation: stats.generation, toolCallTimeoutMs: mcpMount.toolCallTimeoutMs }),
        }))
      },
      descriptions: Object.freeze(descs.descriptions),
    })
  }

  if (browserMount !== undefined && browserMount !== null) {
    let port
    try {
      port = createG2TeamBrowserPort({ ...browserMount, observe: (event) => { observe({ lane: 'browser', ...event }) } })
    } catch (error) {
      return refuse(String(error?.code ?? A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE), `backends g2Browser mount refused at port construction: ${String(error?.message ?? error)}`)
    }
    built.push({ label: 'browser', port })
    const descs = descriptionsFrom(BROWSER_TOOL_NAMES)
    if (descs.refusal !== undefined) {
      void disposeBuilt()
      return descs.refusal
    }
    const facts = browserMount.declaredServiceFacts ?? {}
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
      })),
      descriptions: Object.freeze(descs.descriptions),
    })
  }

  return Object.freeze({
    ok: true,
    backends: Object.freeze(backends),
    ports: Object.freeze({
      ...(backends.g2Mcp !== undefined ? { mcp: built.find((b) => b.label.startsWith('mcp:'))?.port } : {}),
      ...(backends.g2Browser !== undefined ? { browser: built.find((b) => b.label === 'browser')?.port } : {}),
    }),
    // WEB: not suppliable here — the named gap, verbatim from the SIGNED
    // assembly module. The plane's WEB injection point stays fail-closed.
    webRouteGap: A5_G2_WEB_ROUTE_GAP,
    dispose: disposeBuilt,
  })
}
