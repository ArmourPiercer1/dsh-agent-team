/**
 * P2-T6 probe plugin — `p2t6-host-probe` (host row, B1+B2 boots).
 *
 * Characterizes the external-Remote + client-module seams through PUBLIC
 * APIs only:
 *
 *   - `webServer`      exact GET route /__p2t6/graph exposing the composed
 *                      client boot graph (leaf fields only, owned data)
 *   - `clientModules`  the dsh.client discovery/composition service
 *                      (graph() — the boot graph served as window.__DSH_BOOT__)
 *   - `connection`     the Host Connection service (rpc.handle — the generic
 *                      public RPC channel registry; registrations are
 *                      caller-fiber effects and reversible)
 *
 * Setup-ordering contract (mirrors P2-T2): this row is a patch overlay and
 * the Loader may activate it while base-bundle rows are still becoming
 * active, so all three services are declared in `inject` — the Loader
 * defers apply until every injected service is available, and every
 * scenario after activation runs on a fully set-up instance.
 *
 * The RPC handler characterizes all three result classes of the public
 * channel contract: ok result, error result, and thrown handler (HTTP 500).
 */
import { writeFileSync } from 'node:fs'

export const name = 'p2t6-host-probe'

export const inject = ['webServer', 'clientModules', 'connection']

const PROBE = 'p2t6-host-probe'
const GRAPH_ROUTE = '/__p2t6/graph'
const RPC_CHANNEL = '/p2t6rpc'

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  const clientModules = ctx.get('clientModules')
  const connection = ctx.get('connection')
  for (const [svcName, svc] of [
    ['webServer', webServer],
    ['clientModules', clientModules],
    ['connection', connection],
  ]) {
    if (svc === undefined) {
      throw new Error(`${PROBE}: required service '${svcName}' is missing; the probe row cannot activate`)
    }
  }

  const obsDir = process.env.P2T6_OBS_DIR
  if (typeof obsDir !== 'string' || obsDir.length === 0) {
    throw new Error(`${PROBE}: P2T6_OBS_DIR is not set; the probe group must export it before boot`)
  }

  // The boot graph reduced to leaf string fields (no live Host references
  // cross the wire): id / url / rev per entry, plus the entry ids so the
  // harness can attribute baseline rows.
  function graphSnapshot() {
    const graph = clientModules.graph()
    return {
      rev: typeof graph.rev === 'string' ? graph.rev : null,
      entries: (Array.isArray(graph.entries) ? graph.entries : []).map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id : null,
        url: typeof entry.url === 'string' ? entry.url : null,
        rev: typeof entry.rev === 'string' ? entry.rev : null,
      })),
      entryIds: (Array.isArray(graph.entries) ? graph.entries : []).map((entry) => (typeof entry.id === 'string' ? entry.id : null)),
    }
  }

  // Loader-entry diagnostics (debug aid while characterizing B1): which
  // entries the client-module scan sees, whether each has a fiber, and the
  // resolution base URL of its owning tree. Leaf fields only.
  function entriesDebug() {
    const out = []
    try {
      const loader = ctx.loader
      if (loader === undefined || loader.entries === undefined) {
        out.push({ loader: 'absent' })
        return out
      }
      for (const entry of loader.entries()) {
        out.push({
          name: typeof entry.options?.name === 'string' ? entry.options.name : null,
          id: typeof entry.options?.id === 'string' ? entry.options.id : null,
          fiber: entry.fiber !== undefined,
          disabled: entry.disabled === true,
          baseUrl: entry.parent?.tree?.ctx?.baseUrl ?? null,
        })
      }
    } catch (error) {
      out.push({ error: String(error) })
    }
    return out
  }

  // internal/plugin event capture (control for the cross-tree event question):
  // record whether each observed fiber carries a loader entry, and its name/id.
  // Leaf data only; capped so a long-lived instance cannot grow unbounded.
  const pluginEvents = []
  ctx.on('internal/plugin', (fiber) => {
    let entrySet = false
    let name = null
    let id = null
    try {
      const entry = fiber?.entry
      if (entry !== undefined && entry !== null) {
        entrySet = true
        if (entry.options) {
          if (typeof entry.options.name === 'string') name = entry.options.name
          if (typeof entry.options.id === 'string') id = entry.options.id
        }
      }
    } catch {
      entrySet = false
    }
    if (pluginEvents.length < 2000) pluginEvents.push({ entrySet, name, id })
  })

  const isP2t6 = (text) => /p2[-_]?t6/i.test(String(text ?? ''))

  function eventsDebug() {
    return {
      total: pluginEvents.length,
      p2t6: pluginEvents.filter((e) => isP2t6(e.name) || isP2t6(e.id)),
      entrySetCounts: {
        withEntry: pluginEvents.filter((e) => e.entrySet).length,
        withoutEntry: pluginEvents.filter((e) => !e.entrySet).length,
      },
      sample: pluginEvents.slice(0, 40).map((e) => ({ entrySet: e.entrySet, id: e.id, nameTail: e.name ? e.name.slice(-60) : null })),
    }
  }

  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path: GRAPH_ROUTE,
        handler: (req, res) => {
          let payload
          try {
            payload = { ...graphSnapshot(), entriesDebug: entriesDebug(), eventsDebug: eventsDebug() }
          } catch (error) {
            payload = { fatal: String(error) }
          }
          const body = JSON.stringify({ probe: PROBE, ...payload })
          res.writeHead(payload.fatal !== undefined ? 500 : 200, { 'content-type': 'application/json' })
          res.end(body)
        },
      }),
    `${PROBE}: graph route`,
  )

  // Diagnostic route (debug aid while characterizing B1): compare this root-tree
  // plugin's loader view against the clientModules service's construction ctx
  // loader view, and replay the registry's own dirty/flush path for the
  // client-probe row to see whether reconcile succeeds when driven directly.
  // Leaf data out only; the mutation stays inside the debug instance.
  ctx.effect(
    () =>
      webServer.register({
        kind: 'exact',
        path: '/__p2t6/diag',
        handler: (req, res) => {
          const out = { probe: PROBE }
          const send = (status) => {
            res.writeHead(status, { 'content-type': 'application/json' })
            res.end(JSON.stringify(out))
          }
          try {
            const myLoader = ctx.loader
            out.loaderSameAccess = ctx.loader === myLoader
            const cmCtx = clientModules.ctx
            out.cmCtxDefined = cmCtx !== undefined && cmCtx !== null
            let cmLoader = undefined
            if (out.cmCtxDefined) {
              try {
                cmLoader = cmCtx.loader
              } catch (error) {
                out.cmLoaderReadError = String(error)
              }
            }
            out.loaderSameObject = cmLoader === myLoader
            out.cmLoaderSameAccess = out.cmCtxDefined ? cmCtx.loader === cmLoader : null
            const describeLoader = (l) => {
              const d = { ctor: l?.constructor?.name ?? null }
              try {
                d.proxy = typeof Proxy !== 'undefined' && Proxy.isProxy(l)
              } catch {
                d.proxy = null
              }
              try {
                d.storeKeys = Object.keys(l?.store ?? {}).length
              } catch (error) {
                d.storeError = String(error)
              }
              try {
                d.rootDataLen = Array.isArray(l?.root?.data) ? l.root.data.length : null
              } catch {
                d.rootDataLen = null
              }
              return d
            }
            out.myLoaderInfo = describeLoader(myLoader)
            out.cmLoaderInfo = cmLoader !== undefined ? describeLoader(cmLoader) : null
            const collect = (loader) => {
              const entries = []
              for (const entry of loader.entries()) {
                const name = entry?.options?.name
                const id = entry?.options?.id
                entries.push({
                  name: typeof name === 'string' ? name : null,
                  id: typeof id === 'string' ? id : null,
                  fiber: entry?.fiber !== undefined,
                  disabled: entry?.disabled === true,
                })
              }
              return entries
            }
            const p2t6Only = (entries) => entries.filter((e) => isP2t6(e.name) || isP2t6(e.id))
            const myEntries = collect(myLoader)
            out.myLoaderTotal = myEntries.length
            out.myLoaderP2t6 = p2t6Only(myEntries)
            if (cmLoader !== undefined) {
              const cmEntries = collect(cmLoader)
              out.cmLoaderTotal = cmEntries.length
              out.cmLoaderP2t6 = p2t6Only(cmEntries)
            }
            out.dirty = [...(clientModules.dirty ?? [])]
            out.tableKeys = [...(clientModules.table?.keys?.() ?? [])]
            out.composedRevBefore = clientModules.graph()?.rev ?? null
            const target =
              out.myLoaderP2t6.find((e) => e.id === 'p2t6-client-probe') ??
              out.myLoaderP2t6.find((e) => /p2t6-client-probe/.test(String(e.name ?? '')))
            out.targetName = target?.name ?? null
            if (target?.name !== null && target.name !== undefined) {
              // Entry instance identity between the two loader views.
              try {
                let myEntry = null
                for (const entry of myLoader.entries()) {
                  if (entry?.options?.name === target.name) myEntry = entry
                }
                let cmEntry = null
                if (cmLoader !== undefined) {
                  for (const entry of cmLoader.entries()) {
                    if (entry?.options?.name === target.name) cmEntry = entry
                  }
                }
                out.entryIdentity = {
                  myEntryFound: myEntry !== null,
                  cmEntryFound: cmEntry !== null,
                  sameInstance: myEntry === cmEntry,
                  cmEntryFiber: cmEntry === null ? null : cmEntry.fiber !== undefined,
                  cmEntryDisabled: cmEntry === null ? null : cmEntry.disabled === true,
                }
                const treeCtxBaseUrl =
                  cmEntry !== null && cmEntry.parent?.tree?.ctx?.baseUrl !== undefined
                    ? cmEntry.parent.tree.ctx.baseUrl
                    : myEntry?.parent?.tree?.ctx?.baseUrl ?? null
                // Direct registry internals: locate + resolve, bypassing the gate.
                try {
                  const located = cmLoader !== undefined ? clientModules.locatePkgJson(target.name, treeCtxBaseUrl) : null
                  out.locatePkgJson = located === undefined ? undefined : { path: located.path, packageName: located.packageName }
                } catch (error) {
                  out.locatePkgJsonThrew = String(error)
                }
                try {
                  const meta = cmLoader !== undefined ? clientModules.resolveMeta(target.name, treeCtxBaseUrl) : null
                  out.resolveMeta = meta === null ? null : { packageName: meta.packageName, clientPath: meta.meta?.clientPath ?? null }
                } catch (error) {
                  out.resolveMetaThrew = String(error)
                }
              } catch (error) {
                out.entryIdentityError = String(error)
              }
              const errors = []
              try {
                clientModules.dirty.add(target.name)
                clientModules.flush((e) => errors.push(String(e)))
              } catch (error) {
                out.flushThrew = String(error)
              }
              out.flushErrors = errors
              const graphIds = (clientModules.graph()?.entries ?? []).map((e) => e.id)
              out.graphHasClientProbe = graphIds.includes('p2t6-client-probe')
              out.composedRevAfter = clientModules.graph()?.rev ?? null
              out.tableKeysAfter = [...(clientModules.table?.keys?.() ?? [])]
            }
            send(200)
          } catch (error) {
            out.fatal = String(error)
            send(500)
          }
        },
      }),
    `${PROBE}: diag route`,
  )

  // Public RPC channel: one owner, three endpoint behaviors.
  ctx.effect(
    () =>
      connection.rpc.handle(RPC_CHANNEL, async (endpoint, payload) => {
        if (endpoint === 'echo') {
          return { ok: true, value: { echo: payload, endpoint, marker: 'p2t6-rpc-echo' } }
        }
        if (endpoint === 'err') {
          return {
            ok: false,
            error: { code: 'p2t6-probe-error', message: 'deliberate error result', details: { phase: 'err-endpoint' } },
          }
        }
        throw new Error(`p2t6: unknown rpc endpoint ${String(endpoint)}`)
      }),
    `${PROBE}: rpc channel`,
  )

  // Activation fact: services present at apply time (inject deferral worked).
  try {
    writeFileSync(
      `${obsDir}/host-probe-activated.json`,
      JSON.stringify(
        {
          probe: PROBE,
          activatedAt: new Date().toISOString(),
          servicesPresent: { webServer: true, clientModules: true, connection: true },
          graphRoute: GRAPH_ROUTE,
          rpcChannel: RPC_CHANNEL,
          done: true,
        },
        null,
        2,
      ),
    )
  } catch {
    /* obs write failure is surfaced by the harness poll; never kill activation */
  }
}
