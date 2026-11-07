/**
 * confined-fs-tool.mjs — the model-visible `read`/`write`/`edit`/`read_image`
 * tools, served by the Member's CONFINED `fs` face.
 *
 * WHY THIS EXISTS (PD-17, 2026-11-13). The measured hole (recon
 * `a5sf-recon-fs`, PR #657; independently confirmed on a two-Member boot by
 * `a5sf-recon-review`, PR #662): the governed preset mounts the pinned host
 * `@deepseek-ai/dsh-tool-fs` row on the PRESET scope, which is created by
 * `@deepseek-ai/dsh-agent-preset-registry` ABOVE any agent context. That row
 * injects `fs` — and on the preset scope `fs` resolves the INHERITED base
 * `fs-sandbox` service, not the Member realm's confined provider. The realm
 * row shadowed `bash` (PD-12), the terminal (PD-13) and search (PD-16) but
 * never the filesystem tools, so:
 *   - the four FS tools wrote ZERO `a5sf-guard-consult/1` facts — the lane was
 *     never consulted (the reviewed boot: 12 locators, 0 facts);
 *   - `read` returned the bytes of any host path, including `/etc/hostname` and
 *     a SIBLING MEMBER's lane (`a5sf-recon-review` §3: A read B's lane);
 *   - `write`/`edit` touched any workspace path — the only fence left was the
 *     host sandbox (workspace-write), whose name contains no ceiling;
 *   - `read_image` returned the image bytes of an out-of-lane file.
 * The root cause of the READ half is that `fs-sandbox` has no read fence at
 * all ("Reads pass through untouched: every mode permits reading",
 * `packages/fs/fs-sandbox/src/index.ts:7-8`). The realm's confined provider
 * DOES have one: every target-bearing method consults the compiled lane first
 * and throws a typed `TeamIoDenial` before the base Provider runs
 * (`team-services/src/fs.ts`, `createMemberFsGuard`). So the fix is to place
 * the SAME host tool definitions on a context whose `fs` IS that provider —
 * the admission layer refuses before any byte is read, exactly like PD-16's
 * confined search face.
 *
 * HOW IT IS SERVED. This module is a NATIVE tool module in the route-C sense,
 * exactly like `confined-bash-tool.mjs` (PD-12) and `confined-search-tool.mjs`
 * (PD-16): the realm row re-mounts it INSIDE the Member's isolated scope,
 * AFTER the capability deny lane, so the `fs` this module resolves is the
 * confined Provider mounted on that scope. The tools themselves are the pinned
 * host package's OWN definitions (delegated through its public `apply`), so
 * tool names, parameter schemas, read windows, atomic write/replace behaviour,
 * `edit`'s read-match-write critical section and the `read_image` attachment
 * path are byte-identical to what the preset served — this module contributes
 * a CONTEXT, not a tool implementation.
 *
 * SUBSET, NOT A SECOND POLICY (why the delegation is narrowed). The route-C
 * attach may only place the names the agent can already SEE: a scoped
 * registration sits outside the inherited `tools.restrict` filter, so
 * registering a name the Member's `builtinToolDeny` lane removed would
 * silently re-enable it (and the attach's surface gate would refuse the whole
 * mount). The host package registers all four names from one `apply`, so this
 * module forwards the registrations of `config.tools` ONLY — the visible
 * subset the ROW derived from the post-deny surface. The narrowing is a name
 * list, never a rule: no lane, no ceiling, no vocabulary is held or evaluated
 * here.
 *
 * `read_image` is COMPOSITION-CONDITIONAL in the host package: it registers
 * from a deferred `ctx.inject(['attachments'])` child. The narrowing view
 * forwards that `inject` to the real (routed) context, so the deferred child
 * keeps its own declared dependency, registers through the same router, and is
 * attributed to the same fiber. A deployment with no attachment store never
 * registered the tool in the first place, so it is never on the visible
 * surface and never expected here.
 *
 * WHAT THIS DOES NOT DO (stated so the fix cannot be read as more):
 *   - it does not add a second policy source. The lane is the compiled
 *     `MemberPolicy` the realm already mounted; this module holds no rule,
 *     reads no blueprint and evaluates nothing.
 *   - it does not change the tools' schemas, caps, result formatting or error
 *     vocabulary. `read` still windows, `write` still publishes atomically,
 *     `edit` still refuses a stale/mismatched `old_string`.
 *   - it does not weaken the escalation-argument surface: the host package
 *     derives those fields from `ctx.fs.sandboxMode`, and the confined
 *     provider inherits the live base class, so the shadow advertises the same
 *     fields as the preset row. The confined provider deliberately DROPS the
 *     per-call `policy` argument (`team-services/src/fs.ts`), so an approved
 *     wider retry cannot bypass the lane — that behaviour is unchanged by this
 *     module.
 *
 * CORE PATCH BUDGET = 0: no upstream source is touched. This is our package's
 * module, mounted through the existing public route-C seam.
 *
 * @module @dsh-agent-team/runtime/plugin/live/confined-fs-tool
 */
import {
  Config as HOST_TOOL_FS_CONFIG,
  apply as applyHostToolFs,
} from '@deepseek-ai/dsh-tool-fs'

export const name = 'a5sf-confined-fs'

/**
 * `fs` is the CONFINED face the realm mounts on the isolated scope. The mount
 * seam has no refusal for it because the face is TOTAL by type
 * (`RealmServiceFaces.fs: 'confined'` — every installed realm shadows `fs`),
 * so a realm that carries the other faces always carries this one.
 * `systemPrompt` is injected because the host's per-tool faces register their
 * own `tool:read` / `tool:write` / `tool:edit` prompt sections.
 */
export const inject = ['tools', 'fs', 'systemPrompt']

/** The filesystem tool names this module can place (the shipped spellings). */
export const A5SF_CONFINED_FS_TOOLS = Object.freeze(['read', 'write', 'edit', 'read_image'])

/**
 * Which of the four tools this mount places.
 *
 * The ROW passes the subset of names the Member can already SEE, because the
 * route-C attach is surface-neutral: a module that registers a name the agent
 * cannot see would ADD a tool (a governance change) and is refused by the
 * attach. Absent config = all four shipped names (the direct-seam default),
 * which is only correct when the composition really exposes all four.
 */
export function fsToolsOf(config) {
  const configured = config?.tools
  if (configured === undefined || configured === null) return A5SF_CONFINED_FS_TOOLS
  if (!Array.isArray(configured)) {
    throw new TypeError('a5sf-confined-fs: config.tools must be an array of filesystem tool names when present')
  }
  const unknown = configured.filter((tool) => !A5SF_CONFINED_FS_TOOLS.includes(tool))
  if (unknown.length > 0) {
    throw new TypeError(`a5sf-confined-fs: config.tools names unknown filesystem tool(s) ${JSON.stringify(unknown)} (the shipped spellings are ${JSON.stringify(A5SF_CONFINED_FS_TOOLS)})`)
  }
  return Object.freeze([...new Set(configured)])
}

/**
 * Resolve the host caps the delegated `apply` consumes.
 *
 * The defaults are the HOST's own exported schema (so a composition that
 * configures nothing gets the shipped numbers rather than a second, quietly
 * different set). Only the four read-window knobs are forwarded; the caps are
 * retention/window budgets, never policy.
 */
export function fsToolCapsOf(config) {
  const requested = {
    ...(config?.readLimit === undefined ? {} : { readLimit: config.readLimit }),
    ...(config?.readMaxLineLength === undefined ? {} : { readMaxLineLength: config.readMaxLineLength }),
    ...(config?.readMaxBytes === undefined ? {} : { readMaxBytes: config.readMaxBytes }),
    ...(config?.readStreamMinSize === undefined ? {} : { readStreamMinSize: config.readStreamMinSize }),
  }
  return HOST_TOOL_FS_CONFIG(requested)
}

/**
 * A view of `at` whose `tools.register` / `systemPrompt.section` calls are
 * forwarded ONLY for the selected names; every other member (the `fs` service,
 * `get`, `emit`, `waterfall`, `inject`, …) is the real context's, so the tool
 * bodies execute against the confined Provider and observe into the real
 * runtime.
 *
 * The view is a Proxy (rather than a hand-written object) so a host revision
 * that touches another context member cannot be silently dropped: unknown
 * members fall through to the real context instead of reading `undefined`.
 *
 * @param {object} at - the Cordis context to view (module ctx, or a deferred child).
 * @param {ReadonlySet<string>} selection - the tool names this mount may place.
 */
function narrowingView(at, selection) {
  const narrowService = (service, allowed) => {
    if (service === undefined || service === null) return service
    return new Proxy(service, {
      get(target, prop) {
        if (typeof prop === 'symbol') return Reflect.get(target, prop)
        if (allowed.has(prop)) {
          return (...args) => {
            if (!selection.has(allowed.get(prop)(...args))) return undefined
            return target[prop](...args)
          }
        }
        const value = Reflect.get(target, prop, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  }
  const tools = narrowService(at.tools, new Map([
    ['register', (definition) => definition?.name],
  ]))
  const systemPrompt = narrowService(at.systemPrompt, new Map([
    ['section', (section) => {
      const sectionName = typeof section?.name === 'string' ? section.name : undefined
      return sectionName !== undefined && sectionName.startsWith('tool:')
        ? sectionName.slice('tool:'.length)
        : undefined
    }],
  ]))
  return new Proxy(at, {
    get(target, prop) {
      if (prop === 'tools') return tools
      if (prop === 'systemPrompt') return systemPrompt
      if (prop === 'inject') {
        // The deferred `read_image` registration keeps its OWN declared
        // dependency (`attachments`) and its own fiber: the callback only gets
        // a narrowed VIEW of the child, so it still registers through the
        // router this mount owns.
        //
        // `fs` is declared for the child as well. The host package's deferred
        // body is the `read_image` EXECUTOR, which reads `ctx.fs.readBytes`;
        // on the preset scope that access needed no declaration because `fs`
        // was not isolated, while the Member realm isolates it
        // (`root.isolate('fs', …)`), and Cordis refuses an undeclared access to
        // an ISOLATED service ("cannot get property fs without inject"). This
        // module's whole contract is that its tools execute ON the confined
        // face, so its own `fs` dependency is declared for every continuation
        // of it — the same service set the parent plugin already holds.
        return (names, callback) => {
          const inherited = Array.isArray(names)
            ? [...names, 'fs']
            : { ...(names ?? {}), fs: (names ?? {}).fs ?? null }
          return target.inject(inherited, (child) => callback(narrowingView(child, selection)))
        }
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export function apply(ctx, config) {
  const tools = fsToolsOf(config)
  if (tools.length === 0) return
  applyHostToolFs(narrowingView(ctx, new Set(tools)), fsToolCapsOf(config))
}
