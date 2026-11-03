/**
 * Alpha.5 P2 WIRING — the PRODUCT-ROW call site of the a5sf realm mount.
 *
 * WHY THIS MODULE EXISTS: PR #548 shipped the mechanism — `mountA5sfRealm`
 * (`packages/runtime/team-services/src/mount.ts`) plus the guard-consultation
 * transport (`guard-observability.ts`) — but nothing in the product row called
 * it, and the emit did not carry the lane. The live glue
 * (`agent-bindings.mjs`, plain JS, never emitted by tsc) is the ONE place a
 * booted row assembles a Member, so this module is the thin, EXPORTED helper
 * that call site uses. It is deliberately NOT a second mount path: it builds a
 * file sink, hands the sink's `record` to `mountA5sfRealm` as
 * `onGuardConsult`, and returns the mounted realm untouched. Every decision,
 * every refusal and every rollback stays in the seam that owns it.
 *
 * DEFAULT-PRESERVING (the law this module adds):
 *   ENABLED  IFF the row config carries a non-blank `a5sfEvidencePath` AND
 *            the row's composition supplies `a5sfRealmProvider`.
 *   Otherwise this module returns `undefined` WITHOUT creating a sink, calling
 *   the provider, touching the filesystem or mounting anything — the legacy
 *   path is byte-identical (no observer, no mount, no file writes).
 *
 * The evidence path ALWAYS comes from row configuration (the run/evidence
 * config the caller boots with); it is never derived here and never hardcoded.
 *
 * WHAT THE PROVIDER IS, AND WHY IT IS INJECTED: the compiled objects
 * (`CompileResult<MemberPolicy>` ceilings + `EffectiveIoPolicy` binding lanes)
 * are policy compilation output. This glue must never compile or re-evaluate a
 * lane (that would be a second compiler and a second authority decision), so
 * the row's composition supplies them through a plain provider:
 *
 *   a5sfRealmProvider = () => ({
 *     compiledFor({ sessionId, instanceId, teamRootSessionId, templateId, bindPath })
 *       => { members, bindings?, providerClass? } | undefined | Promise<…>
 *   })
 *
 * (a LAZY accessor — it is never called while the row is unconfigured).
 *
 * `undefined` from `compiledFor` = this Member has no compiled realm (no mount).
 * A malformed provider answer throws (a declared wiring that cannot mount is a
 * configuration fault, never a silent no-op).
 *
 * FAIL-CLOSED TRANSPORT: the sink is the seam's own
 * `createGuardConsultFileSink`; a write failure rejects, `observeGuard` turns
 * that into `GUARD_OBSERVATION_FAILED`, and the consulted call is REFUSED
 * before the base Provider runs. This module adds no catch and no downgrade.
 *
 * F1 (effective half, dated 2026-11-03) — WHAT IS BOUND AND WHAT IS NOT.
 * The realm's isolated Provider lives on `installation.members[i].ctx`
 * (`install.ts:182`); the Context handed to the mount keeps the BASE provider.
 * `a5sfToolPlaneOf` below is the ONE naming of the scope the product row's TOOL
 * PLANE is placed on: the live Member setup mounts its tool registrations and
 * the governed tool plane through `toolPlane.ctx`, and routes the permission
 * adapter's per-call fs seam through `toolPlane.fs` — so a TOOL-SHAPED
 * definition (one whose body resolves the fs provider from the ctx it runs on,
 * as the shipped tool packages do) is consulted by the confined guard and
 * writes one `a5sf-guard-consult/1` fact, while the agent ctx itself keeps the
 * base provider (a LEADER or a non-tool consumer is untouched). This is NOT a
 * claim about the native preset tools — see STILL OPEN below.
 *
 * STILL OPEN, stated so it cannot be read as done: the upstream agent-preset
 * registry EAGERLY activates a preset at registration and mounts every preset
 * plugin under its OWN `createScope(registryCtx, generationKey)` fiber
 * (`@deepseek-ai/dsh-agent-preset-registry` activate()/mountPreset()), i.e.
 * BEFORE any agent ctx exists and never below it. No Context handed to
 * `agentPresets.mount()` can therefore change which `fs` a preset tool body
 * resolves — the native `read`/`write`/`edit` rows stay on the base provider
 * until the P3 native takeover (BL-22) places them on this plane. Measured:
 * `dev/agent-workflow/evidence/a5sf-f1-ctx/` (§3 topology measurement) and the
 * BEFORE/AFTER probe `probe-f1-tool-plane.mjs` over the committed dist.
 *
 * @module @dsh-agent-team/runtime/plugin/live/a5sf-realm-row
 */
import { createGuardConsultFileSink } from '../../../team-services/src/guard-observability.js'
import { mountA5sfRealm } from '../../../team-services/src/mount.js'

/** The row-config key carrying the JSONL evidence path (JSON-safe string). */
export const A5SF_EVIDENCE_PATH_KEY = 'a5sfEvidencePath'

/**
 * Name the MEMBER TOOL PLANE scope of one mounted realm.
 *
 * WHY: the mount installs the confined Provider into `root.isolate('fs', …)`,
 * so the Context passed in keeps the base provider and only the returned
 * `installation.members[i].ctx` resolves the confined one. The product row
 * therefore needs ONE place that says "this is the ctx the Member's tools run
 * on, and this is the fs instance its calls must resolve". This function is
 * that place — it adds no mount, no policy decision and no second registry; it
 * only validates and names the scope the caller already mounted.
 *
 * The `fs` member is the INSTALLED confined provider instance, captured once
 * (never a per-call `ctx.get('fs')`): after the realm is disposed the isolated
 * provider fiber unregisters and a ctx LOOKUP on the scope answers `undefined`
 * (measured, suite arm F1-6 — it does not fall back to the base provider, but
 * it also cannot serve a late call). Capturing the instance keeps a late or
 * racing consumer on the confined lane, where it still gets the guard's own
 * refusal instead of a service-resolution fault.
 *
 * @param {object|undefined|null} realm - the object `mountMemberA5sfRealm`
 *   returned (`undefined` = this row mounted no realm: the legacy path).
 * @returns {{ ctx: object, fs: object } | undefined} the frozen tool-plane
 *   scope, or `undefined` when the row is not a5sf-wired.
 */
export function a5sfToolPlaneOf(realm) {
  if (realm === undefined || realm === null) return undefined
  const members = realm.installation?.members
  const member = Array.isArray(members) ? members[0] : undefined
  if (member === undefined || member === null) {
    throw new TypeError('agent-bindings: a mounted a5sf realm must carry at least one Member installation (the tool plane needs its isolated ctx + confined fs)')
  }
  if (member.ctx === undefined || member.ctx === null || typeof member.ctx.get !== 'function') {
    throw new TypeError('agent-bindings: the a5sf Member installation carries no usable isolated ctx')
  }
  if (member.fs === undefined || member.fs === null || typeof member.fs.readText !== 'function') {
    throw new TypeError('agent-bindings: the a5sf Member installation carries no confined fs provider surface')
  }
  return Object.freeze({ ctx: member.ctx, fs: member.fs })
}

/**
 * Read the row's a5sf wiring out of its config.
 *
 * ABSENT (`undefined`/`null` key) = the row is not a5sf-wired at all: returns
 * `undefined`, the legacy path. PRESENT but not a non-blank string = a
 * configuration fault (fail loudly at row assembly, never a silently disabled
 * sandbox lane).
 *
 * @param {object|undefined|null} config - the row config.
 * @returns {{ evidencePath: string } | undefined} the frozen wiring block.
 */
export function a5sfRealmConfigOf(config) {
  const raw = config === undefined || config === null ? undefined : config[A5SF_EVIDENCE_PATH_KEY]
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new TypeError(
      `agent-bindings: config.${A5SF_EVIDENCE_PATH_KEY} must be a non-blank string when present (the a5sf guard-consult evidence path)`,
    )
  }
  return Object.freeze({ evidencePath: raw })
}

/**
 * Mount one admitted Member's compiled a5sf realm, wired to a row-configured
 * file sink — the exact call the live Member setup performs.
 *
 * The ENABLEMENT LAW above lives here, in one place: either half of the wiring
 * absent => `undefined`, and nothing happens.
 *
 * @param {object} input
 * @param {object} input.root - the Cordis Context the realm installs into (the
 *   agent scope the live setup received).
 * @param {{ evidencePath: string } | undefined} input.a5sfConfig - the block
 *   `a5sfRealmConfigOf` returned.
 * @param {Function | undefined} input.provider - the row's LAZY provider
 *   accessor (`() => { compiledFor } | undefined`, the glue's
 *   `deps.a5sfRealmProvider`). It is NEVER called while the row is
 *   unconfigured.
 * @param {object} input.member - the admitted member descriptor forwarded to
 *   `provider.compiledFor`.
 * @returns {Promise<object | undefined>} the mounted realm (`dispose()` must be
 *   kept on the row), or `undefined` when not configured / nothing compiled.
 */
export async function mountMemberA5sfRealm({ root, a5sfConfig, provider, member }) {
  if (a5sfConfig === undefined || a5sfConfig === null) return undefined
  if (typeof provider !== 'function') return undefined
  const resolved = provider()
  if (resolved === undefined || resolved === null) return undefined
  if (typeof resolved.compiledFor !== 'function') {
    throw new TypeError('agent-bindings: deps.a5sfRealmProvider must answer a { compiledFor } object when the row is a5sf-wired')
  }
  if (root === undefined || root === null) {
    throw new TypeError('agent-bindings: mountMemberA5sfRealm needs the agent Context the realm installs into')
  }

  const compiled = await resolved.compiledFor(Object.freeze({ ...member }))
  if (compiled === undefined || compiled === null) return undefined
  if (!Array.isArray(compiled.members) || compiled.members.length === 0) {
    throw new TypeError('agent-bindings: a5sfRealmProvider.compiledFor must answer { members: [...] } with at least one compiled Member ceiling')
  }
  if (compiled.bindings !== undefined && !Array.isArray(compiled.bindings)) {
    throw new TypeError('agent-bindings: a5sfRealmProvider.compiledFor answered a non-array `bindings`')
  }

  // The row's configured path, never a derived or hardcoded one. The sink owns
  // no counter/ledger: one fact per consultation, in call order.
  const sink = createGuardConsultFileSink({ path: a5sfConfig.evidencePath })
  return await mountA5sfRealm({
    root,
    members: compiled.members,
    ...(compiled.bindings === undefined ? {} : { bindings: compiled.bindings }),
    ...(compiled.providerClass === undefined ? {} : { providerClass: compiled.providerClass }),
    onGuardConsult: (fact) => sink.record(fact),
  })
}

/**
 * Wrap a mounted realm's async `dispose()` as a SAFE SYNC row disposer.
 *
 * WHY: the row drain (`agent-bindings.mjs` close) invokes every disposer
 * SYNCHRONOUSLY (`d()`) and only catches synchronous throws — an `async`
 * disposer returned un-awaited would be fire-and-forget, and a rejection would
 * surface as an unhandled rejection instead of a reported teardown fault. This
 * wrapper starts the unmount on the same tick (the drain has already decided to
 * tear down), never throws, reports a rejection to `onError` instead of
 * swallowing it, and exposes `settled()` so the row can AWAIT the disposals it
 * started before it returns from `close()`.
 *
 * Idempotency is the realm's own (`MountedA5sfRealm.dispose` is idempotent);
 * this wrapper does not add a second flag — calling it twice starts two awaits
 * whose second resolves immediately. The agent-scope unwind remains the
 * backstop if the row never reaches its drain.
 *
 * @param {{ dispose(): Promise<void> }} realm - the mount helper's return value.
 * @param {(error: unknown) => void} [onError] - reports a rejected unmount
 *   (the row pushes an observation; it is never silent).
 * @returns {(() => void) & { settled(): Promise<void> }} the sync disposer.
 */
export function createA5sfRealmRowDisposer(realm, onError) {
  if (realm === undefined || realm === null || typeof realm.dispose !== 'function') {
    throw new TypeError('agent-bindings: createA5sfRealmRowDisposer needs a mounted realm with an async dispose()')
  }
  /** @type {Set<Promise<void>>} the unmounts this wrapper started. */
  const pending = new Set()
  const dispose = () => {
    const disposal = Promise.resolve()
      .then(() => realm.dispose())
      .catch((error) => {
        try {
          onError?.(error)
        } catch {
          // A faulting reporter must never re-break the teardown path.
        }
      })
      .finally(() => {
        pending.delete(disposal)
      })
    pending.add(disposal)
  }
  Object.defineProperty(dispose, 'settled', {
    value: async () => {
      // Loop: an onError report may itself trigger no new disposal, but a
      // concurrent second call can add one while we await; converge.
      while (pending.size > 0) await Promise.allSettled([...pending])
    },
  })
  return dispose
}

