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
 * @module @dsh-agent-team/runtime/plugin/live/a5sf-realm-row
 */
import { createGuardConsultFileSink } from '../../../team-services/src/guard-observability.js'
import { mountA5sfRealm } from '../../../team-services/src/mount.js'

/** The row-config key carrying the JSONL evidence path (JSON-safe string). */
export const A5SF_EVIDENCE_PATH_KEY = 'a5sfEvidencePath'

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
