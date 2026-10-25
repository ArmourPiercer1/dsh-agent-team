/**
 * `governance-center/host-adapter` — the HostSurfaceAdapter skeleton (U6 PR1;
 * center-assembly-architecture §3 component 1: "仅封装 DSH 公开
 * 注册/Scope/Definition/执行 token/生命周期输入…不得自行决定用户权限").
 *
 * THE EDGE THIS FILE IS (§10.2: "所有 Host API 差异只出现在
 * HostSurfaceAdapter"): the ONLY place in the lane that touches a Host tool
 * surface shape. It wraps PUBLIC seams of the pinned Host pin
 * (`tests/paths.mjs`) — the scoped `tools.get`, the global `tools.schemas`,
 * the plugin-context event `on` channel — and hands the rest of the center
 * OBSERVATIONS (a definition, its identity, a surface name list, a dispose
 * handle), never verdicts. It has no method that answers allow/deny: a test
 * pins the closed surface so a permission decision can never be born here
 * (§10.2 "Kernel/Registry/Bridge 不直接修改 Host 内部 Map、listener 或全局
 * 工具").
 *
 * IDENTITY LAW (CI-04): the adapter never invents an identity. The identity
 * mint is INJECTED (`identityOf`) — in production the trusted assembly point
 * passes the same function object the proven guard uses to fingerprint a
 * Definition; here it is an opaque `(target) => string | null`.
 *
 * The adapter is deliberately structural-typed: no upstream imports (CORE
 * PATCH BUDGET 0 and the layer law — this lane holds no direct dependency
 * on Host internals, only on the shapes the seams pass).
 *
 * @module governance-center/host-adapter
 */

/** The minimal public `ctx.tools` face this adapter wraps (structural). */
export type HostToolsSurface = {
  readonly get: (name: string, scope?: unknown) => unknown
  readonly schemas?: (filter?: unknown) => readonly { readonly name?: string }[]
  readonly register?: (definition: unknown) => unknown
}

export type HostAdapterRefusalCode =
  | 'SEAM_ABSENT'
  | 'DEFINITION_UNREADABLE'
  | 'IDENTITY_UNMINTABLE'

export type DefinitionRead =
  | { readonly ok: true; readonly definition: unknown; readonly identity: string }
  | { readonly ok: false; readonly code: HostAdapterRefusalCode; readonly detail: string }

export type HostSurfaceAdapter = {
  /** Read what the Host WILL resolve for this name (same view the dispatch
   *  resolve uses), plus the injected identity of that very object. */
  readonly readDefinition: (name: string, scope?: unknown) => DefinitionRead
  /** The visible surface NAME LIST for census only (never an approval set). */
  readonly surfaceNames: () => readonly string[]
  /** Pass-through registration; returns the disposer the Host handed out. */
  readonly register: (definition: unknown) => { readonly ok: true; readonly dispose: unknown }
    | { readonly ok: false; readonly code: HostAdapterRefusalCode; readonly detail: string }
  /** Pass-through subscription on the public event channel. */
  readonly on: (event: string, listener: (...args: readonly unknown[]) => void) => { readonly unsubscribe: () => void }
}

export function createHostSurfaceAdapter(deps: {
  readonly tools: HostToolsSurface | undefined
  readonly on?: (event: string, listener: (...args: never[]) => unknown) => () => void
  readonly identityOf: (target: unknown) => string | null
}): HostSurfaceAdapter {
  const { tools, on } = deps

  return {
    readDefinition(name: string, scope?: unknown): DefinitionRead {
      if (tools === undefined || typeof tools.get !== 'function') {
        return { ok: false, code: 'SEAM_ABSENT', detail: 'no tools.get seam on this surface' }
      }
      let definition: unknown
      try {
        definition = scope === undefined ? tools.get(name) : tools.get(name, scope)
      } catch (error) {
        return { ok: false, code: 'DEFINITION_UNREADABLE', detail: `tools.get('${name}') threw: ${String((error as Error)?.message ?? error).slice(0, 160)}` }
      }
      if (definition === undefined || definition === null) {
        return { ok: false, code: 'DEFINITION_UNREADABLE', detail: `no definition resolves for '${name}'` }
      }
      const identity = deps.identityOf(definition)
      if (identity === null) {
        return { ok: false, code: 'IDENTITY_UNMINTABLE', detail: `the injected identity mint refused the object resolved for '${name}'` }
      }
      return { ok: true, definition, identity }
    },

    surfaceNames(): readonly string[] {
      if (tools === undefined || typeof tools.schemas !== 'function') return []
      try {
        const listed = tools.schemas()
        if (!Array.isArray(listed)) return []
        return Object.freeze(listed.map((entry) => String((entry as { name?: unknown })?.name ?? '')).filter((name) => name.length > 0))
      } catch {
        // Census is fail-quiet: an unreadable surface reports empty, and
        // whoever consumes census must treat empty as "nothing observed",
        // never as "nothing exists" — the same asymmetry the Guard's
        // unreadable-global-list law encodes.
        return Object.freeze([])
      }
    },

    register(definition: unknown) {
      if (tools === undefined || typeof tools.register !== 'function') {
        return { ok: false, code: 'SEAM_ABSENT', detail: 'no tools.register seam on this surface' }
      }
      return { ok: true, dispose: tools.register(definition) }
    },

    on(event: string, listener: (...args: readonly unknown[]) => void) {
      if (on === undefined) {
        return { unsubscribe: () => undefined }
      }
      const unsubscribe = on(event, listener as (...args: never[]) => unknown)
      return {
        unsubscribe: () => {
          try {
            unsubscribe()
          } catch {
            // a disposer that dies is recorded where the row mounts it; the
            // adapter never rethrows across an edge it does not own.
          }
        },
      }
    },
  }
}
