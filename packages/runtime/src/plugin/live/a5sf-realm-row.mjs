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
 *   ENABLED  IFF the row config carries a non-blank `a5sfEvidencePath`
 *            (evidence round) OR a product declaration `a5sfMemberPolicies`
 *            (2026-11-05 — the PRODUCT path; see `product-assembly.ts`).
 *   Otherwise this module returns `undefined` WITHOUT creating a sink, calling
 *   the provider, touching the filesystem or mounting anything — the legacy
 *   path is byte-identical (no observer, no mount, no file writes).
 *
 *   With a product declaration, `a5sfEvidencePath` is an OPTIONAL observation
 *   sink only: the declaration itself makes the realm REQUIRED. That is the
 *   correction the external review asked for — an evidence file path must
 *   never be the only switch that turns a security face on.
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
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { createGuardConsultFileSink } from '../../../team-services/src/guard-observability.js'
import { NATIVE_REGISTRATION_ROUTING, mountA5sfRealm } from '../../../team-services/src/mount.js'
import {
  A5SF_MEMBER_AUTHORITY_KEY,
  A5SF_MEMBER_POLICIES_KEY,
  createProductRealmProvider,
  deriveProductRealmPlan,
  parseProductRealmDeclaration,
} from '../../../team-services/src/product-assembly.js'
import { TeamServiceInstallError } from '../../../team-services/src/types.js'

/** The row-config key carrying the JSONL evidence path (JSON-safe string). */
export const A5SF_EVIDENCE_PATH_KEY = 'a5sfEvidencePath'

/**
 * The row-config key carrying the PRODUCT declaration that gives declared
 * Members their compiled realm (2026-11-05).
 *
 * RE-EXPORTED from `team-services/src/product-assembly.ts` (one token, one
 * parser, one compiler): this plain-JS row only forwards it. See that module
 * for the declaration shape, the refusal vocabulary and the faces the seam
 * does not own.
 *
 * ENABLEMENT LAW: the realm is enabled by `a5sfEvidencePath` (evidence round,
 * an observation SINK), by this PRODUCT declaration, or by the DERIVED path's
 * `a5sfMemberAuthority` (see below). A declaration also accepts
 * `a5sfEvidencePath` as an optional sink, but the sink is never what turns
 * enforcement on.
 *
 * POLICY-SOURCE FIX (2026-11-05): a declaration is now the EXCEPTION path and
 * REQUIRES `config.blueprintSource`; a row that omits the declaration and sets
 * `a5sfMemberAuthority` derives the Member ceilings from that same blueprint.
 */
export { A5SF_MEMBER_POLICIES_KEY, A5SF_MEMBER_AUTHORITY_KEY }

/**
 * The row-config key carrying the NATIVE tool modules to re-mount inside each
 * Member's isolated `fs` scope (route C, 2026-11-03).
 *
 * Each entry is either a module specifier string or `{ url, config? }`:
 *   - `file:` URL, or an absolute filesystem path (converted with
 *     `pathToFileURL`), or any specifier `import()` resolves FROM THIS MODULE.
 *   - The ROW COMPOSITION owns resolution (the same discipline as
 *     `a5sfRealmProvider`): the host knows where its own `@deepseek-ai/dsh-tool-fs`
 *     lives; this glue must not guess a host install path.
 */
export const A5SF_NATIVE_TOOL_MODULES_KEY = 'a5sfNativeToolModules'

/**
 * OPTIONAL top-level declaration map, the SECOND way to declare
 * `expectedTools` (2026-11-03 review, condition C2/C6).
 *
 * WHY it exists: the per-entry form lives on the OBJECT entry
 * (`{ url, config?, expectedTools? }`), so a STRING entry — the form most
 * fixtures and the shortest honest composition use — could not declare at all.
 * A mitigation reachable only on a form nobody uses is not a mitigation.
 *
 * Shape: `{ "<module specifier>": ["tool", ...] }`, keyed by the SAME specifier
 * the entry uses (`entry.url` after validation). Same semantics as the
 * per-entry key: it declares, it does not authorize; the declared names must be
 * forwarded by that module's settled fibers or the attach is refused. When both
 * forms are present the union is required (a composition may split a list).
 * Unknown keys are a configuration fault: a typo that silently declares nothing
 * would recreate the hole.
 */
export const A5SF_EXPECTED_TOOLS_KEY = 'a5sfExpectedTools'

/**
 * BL-18 LIVE-HALF UNBLOCK (2026-11-06) — the row-config key that CARRIES the
 * confined `web` face when the compiled provider answer does not.
 *
 * WHY IT EXISTS. §8 of `evidence/a5sf-web/README.md` marked five of eight live
 * steps `BLOCKED` on one fact: `a5sf-realm-row.mjs` forwarded
 * `compiled.subprocess` but not `compiled.web`, and no row config key carried a
 * confined web provider — so no product-shaped composition could hang a
 * deny-lane measurement on anything. This key is the CONFIG half of the
 * unblock; the compiled-answer half (`compiled.web`) mirrors `subprocess`.
 *
 * SHAPE: a module specifier string, or `{ url, config? }` — the SAME forms
 * `a5sfNativeToolModules` accepts, for the same reason: the row is plain JS and
 * must not guess where the composition's transport lives. The module must
 * export `createConfinedWebFace` (or a default function) answering the SAME
 * `{ effective, provider }` object the compiled answer carries
 * (`provider.fetch` required, `provider.search` optional, plus the optional
 * `realmId`/`memberScope`/`providerClass`). The factory receives
 * `{ member, members, config }` and is an ordinary caller of the ONE two-axis
 * compiler (P1-02) — the row never intersects a lane, never reads a blueprint
 * and never evaluates the network axis.
 *
 * ONE SOURCE PER REALM: a compiled answer that ALSO carries `web` is a fork and
 * refuses (`REALM_DECLARATION_INVALID`), the same ambiguity law the
 * declaration-vs-service pair already obeys. A configured factory that answers
 * no face refuses with the typed `NETWORK_UNCONFINED_REALM`, never a silent
 * omission that would leave `web_fetch` on the inherited host service.
 */
export const A5SF_WEB_FACE_KEY = 'a5sfWebFace'

/**
 * Typed refusal of the native ASSEMBLY path (assembly gaps 1 and 2, 2026-11-03).
 *
 * A `TypeError` subclass with a stable `code`, so a caller can tell these
 * fail-closed assembly refusals apart from configuration faults without string
 * matching the message:
 *   - `A5SF_COVERAGE_UNDEFINED` — the composition declared managed native
 *     modules but the tools row cannot answer definition identity (`get`), so
 *     coverage would be silently skipped.
 *   - `A5SF_BINDING_OWNER_UNRESOLVED` — a mounted ToolBinding names a tool that
 *     NO configured native module registers.
 *   - `A5SF_BINDING_OWNER_AMBIGUOUS` — MORE than one configured module registers
 *     that tool, so assigning the binding would be a guess.
 *   - `A5SF_MODULE_OBSERVATION_UNREPRODUCED` — the REAL mount did not reproduce
 *     what that module's ownership probe observed (a one-shot `apply` consumed
 *     by the probe, or a conditional registration that vanished), so a tool
 *     would stay on the unguarded preset definition while the name set matched.
 *   - `A5SF_EXPECTED_TOOLS_UNSHADOWED` — a module entry DECLARED `expectedTools`
 *     and the settled attach did not forward one or more of them (the provider
 *     was absent, or the composition's two planes disagree), so the declared
 *     managed names would fall back to whatever preset definition is visible.
 *     Opt-in: an entry WITHOUT `expectedTools` keeps the pre-declaration
 *     behaviour exactly. ONE narrow exception (E8, 2026-11-03): an entry that
 *     ALSO carries `allowEmpty: true` and forwarded NOTHING may declare names —
 *     the empty frontier is acknowledged explicitly and those names are
 *     recorded as ACKNOWLEDGED (`NativeAttachRecord.acknowledgedNames`), never
 *     as verified. A partial frontier is still refused.
 *   - `A5SF_MANAGED_FRONTIER_EMPTY` — a module entry that CARRIES a `config`
 *     (i.e. the composition configured a conditional module: a provider, a
 *     feature switch) forwarded NOTHING at the settle boundary and did not
 *     declare `expectedTools`. The row cannot see the preset plane's module
 *     config, so it cannot tell "the provider is absent everywhere"
 *     (availability only, harmless) from "the preset plane serves this name on
 *     its own provider" (unguarded preset execution). Measured in
 *     `dev/agent-workflow/evidence/a5sf-event-driven/README.md` §7: the two
 *     worlds differ ONLY in the preset plane's config, which is not an input of
 *     this function — so the decidable unit is the entry's own shape. A
 *     composition that knows the frontier may legitimately stay empty opts in
 *     with `allowEmpty: true` on that entry (see the README for the risk it
 *     accepts and why the default is fail-closed).
 */
export class A5sfNativeAssemblyError extends TypeError {
  /**
   * @param {'A5SF_COVERAGE_UNDEFINED' | 'A5SF_BINDING_OWNER_UNRESOLVED' | 'A5SF_BINDING_OWNER_AMBIGUOUS' | 'A5SF_MODULE_OBSERVATION_UNREPRODUCED' | 'A5SF_EXPECTED_TOOLS_UNSHADOWED'} code
   * @param {string} detail
   */
  constructor(code, detail) {
    super(`agent-bindings: ${detail}`)
    this.name = 'A5sfNativeAssemblyError'
    this.code = code
  }
}

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
 * ENABLEMENT: at least one ENABLING key present — `a5sfEvidencePath` (the
 * evidence sink), `a5sfMemberPolicies` (the DECLARED exception) OR
 * `a5sfMemberAuthority` (the DERIVED product path). ABSENT all three
 * (`undefined`/`null`) = the row is not a5sf-wired at all: returns `undefined`,
 * the legacy path. PRESENT but not a non-blank string (evidence path) = a
 * configuration fault (fail loudly at row assembly, never a silently disabled
 * sandbox lane).
 *
 * DERIVATION IS THE PRODUCT PATH (policy-source fix, 2026-11-05): with
 * `a5sfMemberAuthority` and NO `a5sfMemberPolicies`, the Member ceilings are
 * read from `config.blueprintSource`'s `memberIoCeilings` family by
 * `deriveProductRealmPlan`, so the product config omits the declaration
 * entirely and there is exactly ONE editable statement of the permission facts.
 *
 * DECLARATION IS THE EXCEPTION: when `a5sfMemberPolicies` is present the ONE
 * product parser is called with `config.blueprintSource`, which is now REQUIRED
 * to resolve to the same team/revision. A declaration with no resolvable
 * blueprint refuses `MEMBER_POLICY_WITHOUT_BLUEPRINT`; one that exceeds the
 * DERIVED ceiling refuses `REALM_DECLARATION_EXCEEDS_BLUEPRINT`; a strictly
 * narrower one assembles with the typed residual
 * `declaration-narrows-bound-blueprint`. Supplying both `a5sfMemberPolicies` and
 * `a5sfMemberAuthority` is allowed: the declaration is checked against the
 * derived policy, and the two authority references must agree (a disagreement is
 * `REALM_DECLARATION_INVALID`).
 *
 * `a5sfNativeToolModules`, when present, is validated here too (route C): a
 * non-array, an empty array entry, or an entry that is neither a non-blank
 * string nor `{ url: <non-blank string>, config?: object }` is a configuration
 * fault. The key stays OMITTED from the returned block when absent, so the
 * pre-route-C block is byte-identical (its readers and their pinned tests are
 * unaffected).
 *
 * `a5sfWebFace` (BL-18 live-half unblock) is validated the same way and rides
 * the block as `webFace` when present. It is NOT an enabling key: alone, with
 * no realm to mount, it is a configuration fault (see above).
 *
 * @param {object|undefined|null} config - the row config.
 * @returns {{
 *   evidencePath?: string,
 *   memberPolicies?: object,
 *   nativeToolModules?: readonly object[],
 *   webFace?: { url: string, config?: object },
 * } | undefined} the frozen wiring block: `evidencePath` only when an evidence
 *   sink is configured, `memberPolicies` only when the product declaration (or
 *   the derived path) is present (the parsed plan), `nativeToolModules` only
 *   when route C declares modules, `webFace` only when the row config carries
 *   a confined web face factory. Keys are omitted, never `undefined`-valued.
 */
export function a5sfRealmConfigOf(config) {
  const settings = config === undefined || config === null ? undefined : config
  const rawEvidence = settings === undefined ? undefined : settings[A5SF_EVIDENCE_PATH_KEY]
  const rawPolicies = settings === undefined ? undefined : settings[A5SF_MEMBER_POLICIES_KEY]
  const rawAuthority = settings === undefined ? undefined : settings[A5SF_MEMBER_AUTHORITY_KEY]
  const rawWebFace = settings === undefined ? undefined : settings[A5SF_WEB_FACE_KEY]
  const hasEvidence = rawEvidence !== undefined && rawEvidence !== null
  const hasPolicies = rawPolicies !== undefined && rawPolicies !== null
  const hasAuthority = rawAuthority !== undefined && rawAuthority !== null
  const hasWebFace = rawWebFace !== undefined && rawWebFace !== null
  if (!hasEvidence && !hasPolicies && !hasAuthority) {
    // FAIL CLOSED ON A LONE PROVIDER: a web face configured for a row that is
    // not a5sf-wired would be silently ignored — and "silently ignored
    // confinement" is the exact class this lane refuses. It is a config fault,
    // not an ordinary unconfigured row.
    if (hasWebFace) {
      throw new TypeError(
        `agent-bindings: config.${A5SF_WEB_FACE_KEY} is present but the row is not a5sf-wired`
        + ` (needs config.${A5SF_EVIDENCE_PATH_KEY}, config.${A5SF_MEMBER_POLICIES_KEY} or`
        + ` config.${A5SF_MEMBER_AUTHORITY_KEY}); a configured web face without a realm would never mount`,
      )
    }
    return undefined
  }

  let evidencePath
  if (hasEvidence) {
    if (typeof rawEvidence !== 'string' || rawEvidence.trim() === '') {
      throw new TypeError(
        `agent-bindings: config.${A5SF_EVIDENCE_PATH_KEY} must be a non-blank string when present (the a5sf guard-consult evidence path)`,
      )
    }
    evidencePath = rawEvidence
  }
  const blueprintSource = settings === undefined ? undefined : settings.blueprintSource

  // DECLARED EXCEPTION: the ONE product-assembly parser (typed
  // `TeamServiceInstallError` refusals), never this row. The blueprint source is
  // REQUIRED and is reconciled by the parser; omitting it is a typed refusal,
  // never "no constraints".
  let memberPolicies = hasPolicies
    ? parseProductRealmDeclaration(rawPolicies, { blueprintSource })
    : undefined

  // DERIVED PRODUCT PATH: `a5sfMemberAuthority` asks the assembly to read the
  // ceilings out of the bound blueprint itself. With BOTH keys present, the
  // declaration was already checked against the derived ceilings; their
  // authority references must agree too, or one of them is editing a fact the
  // other cannot see.
  if (hasAuthority) {
    const derivedPlan = deriveProductRealmPlan({
      blueprintSource,
      authority: rawAuthority,
    })
    if (memberPolicies !== undefined) {
      const declared = memberPolicies.authority
      const derived = derivedPlan.authority
      if (declared.revision !== derived.revision || declared.admitted !== derived.admitted) {
        throw new TeamServiceInstallError(
          'REALM_DECLARATION_INVALID',
          `${A5SF_MEMBER_POLICIES_KEY}.authority `
          + `{ revision: ${JSON.stringify(declared.revision)}, admitted: ${String(declared.admitted)} } disagrees with `
          + `config.${A5SF_MEMBER_AUTHORITY_KEY} { revision: ${JSON.stringify(derived.revision)}, `
          + `admitted: ${String(derived.admitted)} }; the declared and derived policies must reference the SAME `
          + 'Alpha.4 authority, so one of them is not the fact it claims to be',
          `${A5SF_MEMBER_POLICIES_KEY}.authority`,
        )
      }
    } else {
      memberPolicies = derivedPlan
    }
  }

  const declarations = expectedToolsDeclarationsOf(settings[A5SF_EXPECTED_TOOLS_KEY])
  const modules = nativeToolModulesOf(settings[A5SF_NATIVE_TOOL_MODULES_KEY], declarations)
  const webFace = webFaceSpecOf(rawWebFace)
  if (declarations !== undefined) {
    // A declaration keyed by a specifier NO entry names is a typo that would
    // silently declare nothing — the exact hole this map exists to close.
    const named = new Set((modules ?? []).map((module) => module.url))
    const orphans = [...declarations.keys()].filter((specifier) => !named.has(specifier))
    if (orphans.length > 0) {
      throw new TypeError(
        `agent-bindings: config.${A5SF_EXPECTED_TOOLS_KEY} names ${JSON.stringify(orphans)} but no`
        + ` ${A5SF_NATIVE_TOOL_MODULES_KEY} entry uses that specifier`,
      )
    }
  }
  return Object.freeze({
    ...(evidencePath === undefined ? {} : { evidencePath }),
    ...(memberPolicies === undefined ? {} : { memberPolicies }),
    ...(modules === undefined ? {} : { nativeToolModules: modules }),
    ...(webFace === undefined ? {} : { webFace }),
  })
}

/**
 * Validate one entry's OPTIONAL `expectedTools` declaration.
 *
 * `undefined` = undeclared (pre-declaration behaviour). Anything else must be a
 * non-empty array of non-blank, unique strings: an empty declaration would read
 * as "this module provides nothing", which is a contradiction, not an opt-out.
 *
 * @param {unknown} raw
 * @param {string} where - the config path, for the fault message.
 * @returns {readonly string[] | undefined}
 */
function expectedToolsOf(raw, where, label = 'expectedTools') {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) {
    throw new TypeError(`agent-bindings: ${where}.${label} must be an array of non-blank tool names when present`)
  }
  if (raw.length === 0) {
    throw new TypeError(`agent-bindings: ${where}.${label} must not be empty (omit the key to declare nothing)`)
  }
  const seen = new Set()
  for (const name of raw) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new TypeError(`agent-bindings: ${where}.${label} must contain only non-blank tool-name strings`)
    }
    if (seen.has(name)) {
      throw new TypeError(`agent-bindings: ${where}.${label} lists ${JSON.stringify(name)} more than once`)
    }
    seen.add(name)
  }
  return Object.freeze([...raw])
}

/**
 * Validate the OPTIONAL top-level `a5sfExpectedTools` map (C2/C6).
 *
 * @param {unknown} raw - the config value.
 * @returns {ReadonlyMap<string, readonly string[]> | undefined} specifier → names.
 */
function expectedToolsDeclarationsOf(raw) {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError(`agent-bindings: config.${A5SF_EXPECTED_TOOLS_KEY} must be an object mapping a module specifier to an array of tool names when present`)
  }
  const entries = Object.entries(raw)
  if (entries.length === 0) {
    throw new TypeError(`agent-bindings: config.${A5SF_EXPECTED_TOOLS_KEY} must name at least one module specifier when present`)
  }
  const declarations = new Map()
  for (const [specifier, names] of entries) {
    if (specifier.trim() === '') {
      throw new TypeError(`agent-bindings: config.${A5SF_EXPECTED_TOOLS_KEY} carries a blank module specifier`)
    }
    declarations.set(specifier, expectedToolsOf(names, `config.${A5SF_EXPECTED_TOOLS_KEY}[${JSON.stringify(specifier)}]`, 'entry'))
  }
  return declarations
}

/**
 * Union two declarations of the same module's expected tools (a composition may
 * split one list across the entry and the top-level map).
 *
 * @param {readonly string[] | undefined} perEntry
 * @param {readonly string[] | undefined} bySpecifier
 * @returns {readonly string[] | undefined}
 */
function mergeExpectedTools(perEntry, bySpecifier) {
  if (perEntry === undefined) return bySpecifier
  if (bySpecifier === undefined) return perEntry
  const merged = [...perEntry]
  for (const name of bySpecifier) if (!merged.includes(name)) merged.push(name)
  return Object.freeze(merged)
}

/**
 * Validate the native-tool-module list (route C). `undefined`/`null` = the
 * module is not requested at all: the pre-route-C mount, byte-identical.
 *
 * @param {unknown} raw - the config value.
 * @param {ReadonlyMap<string, readonly string[]>} [declarations] - the
 *   top-level `a5sfExpectedTools` map (string-entry declarations).
 * @returns {readonly {url: string, config?: object, expectedTools?: string[], allowEmpty?: boolean}[] | undefined} frozen specs.
 */
function nativeToolModulesOf(raw, declarations) {
  if (raw === undefined || raw === null) return undefined
  if (!Array.isArray(raw)) {
    throw new TypeError(`agent-bindings: config.${A5SF_NATIVE_TOOL_MODULES_KEY} must be an array when present (one entry per native tool module)`)
  }
  if (raw.length === 0) return Object.freeze([])
  return Object.freeze(raw.map((entry, index) => {
    const where = `config.${A5SF_NATIVE_TOOL_MODULES_KEY}[${index}]`
    if (typeof entry === 'string') {
      if (entry.trim() === '') throw new TypeError(`agent-bindings: ${where} must be a non-blank module specifier`)
      const declared = declarations?.get(entry)
      return Object.freeze({
        url: entry,
        ...(declared === undefined ? {} : { expectedTools: declared }),
      })
    }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`agent-bindings: ${where} must be a module specifier string or { url, config? }`)
    }
    const url = entry.url
    if (typeof url !== 'string' || url.trim() === '') {
      throw new TypeError(`agent-bindings: ${where}.url must be a non-blank module specifier`)
    }
    const pluginConfig = entry.config
    if (pluginConfig !== undefined && (pluginConfig === null || typeof pluginConfig !== 'object' || Array.isArray(pluginConfig))) {
      throw new TypeError(`agent-bindings: ${where}.config must be a plain object when present`)
    }
    // OPT-IN DECLARATION (event-driven shape, 2026-11-03). `expectedTools` states
    // which tools the composition BELIEVES this module provides. It grants
    // nothing and authorizes nothing: its only power is to make a module that
    // forwards NONE of the declared names fail closed at assembly time
    // instead of leaving the name on an unguarded preset definition. Absent =
    // the pre-declaration behaviour, byte-identical.
    const expectedTools = expectedToolsOf(entry.expectedTools, where)
    const declaredBySpecifier = declarations?.get(url)
    const mergedExpected = mergeExpectedTools(expectedTools, declaredBySpecifier)
    // `allowEmpty` is the EXPLICIT opt-out of the empty-frontier refusal below.
    // It is not a safety feature: it says "this composition accepts that the
    // module may shadow nothing", which is exactly the state that, when the
    // preset plane serves the name, executes the preset definition unguarded.
    if (entry.allowEmpty !== undefined && typeof entry.allowEmpty !== 'boolean') {
      throw new TypeError(`agent-bindings: ${where}.allowEmpty must be a boolean when present`)
    }
    return Object.freeze({
      url,
      ...(pluginConfig === undefined ? {} : { config: pluginConfig }),
      ...(mergedExpected === undefined ? {} : { expectedTools: mergedExpected }),
      ...(entry.allowEmpty === undefined ? {} : { allowEmpty: entry.allowEmpty }),
    })
  }))
}

/**
 * Validate the OPTIONAL `a5sfWebFace` module spec (BL-18 live-half unblock).
 *
 * Same forms as a `a5sfNativeToolModules` entry, for the same discipline: the
 * ROW COMPOSITION names a module the host can load, and this glue never guesses
 * a provider path. `undefined`/`null` = the key is absent (the compiled answer
 * is then the only web-face source, byte-identical to the pre-unblock row).
 *
 * @param {unknown} raw - the config value.
 * @returns {{ url: string, config?: object } | undefined} a frozen spec.
 */
function webFaceSpecOf(raw) {
  if (raw === undefined || raw === null) return undefined
  const where = `config.${A5SF_WEB_FACE_KEY}`
  if (typeof raw === 'string') {
    if (raw.trim() === '') throw new TypeError(`agent-bindings: ${where} must be a non-blank module specifier`)
    return Object.freeze({ url: raw })
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError(`agent-bindings: ${where} must be a module specifier string or { url, config? }`)
  }
  const url = raw.url
  if (typeof url !== 'string' || url.trim() === '') {
    throw new TypeError(`agent-bindings: ${where}.url must be a non-blank module specifier`)
  }
  const pluginConfig = raw.config
  if (pluginConfig !== undefined && (pluginConfig === null || typeof pluginConfig !== 'object' || Array.isArray(pluginConfig))) {
    throw new TypeError(`agent-bindings: ${where}.config must be a plain object when present`)
  }
  return Object.freeze({
    url,
    ...(pluginConfig === undefined ? {} : { config: pluginConfig }),
  })
}

/**
 * THE composition-time presence check of a confined web face (fail closed).
 *
 * A declared web face that cannot mount must REFUSE, never be dropped: a
 * dropped face leaves the native `web_fetch`/`web_search` row on the INHERITED
 * host `ctx.web` — the real HTTP provider and the process-wide proxy dispatch —
 * with zero guard facts. That silent fallback is precisely what makes
 * "affected but ungoverned" invisible, so it is a typed refusal here.
 *
 * The shape is the SAME `{ effective, provider }` object the subprocess face
 * carries (`provider.fetch` required, `provider.search` optional). The
 * `effective.network.access` check is a TOTAL-SHAPE check, not a second
 * decision: the guard in `web.ts` reads that field, and an object without it
 * would silently read as "not deny" — that is the fail-open shape this rejects.
 *
 * @param {unknown} web - the declared face.
 * @param {string} where - the diagnostic path of the declaration.
 * @returns {object} the same face, narrowed.
 */
function assertConfinedWebFace(web, where) {
  const effective = web?.effective
  const provider = web?.provider
  const access = effective?.network?.access
  const shapeOk = typeof web === 'object' && web !== null
    && typeof effective === 'object' && effective !== null
    && (access === 'allow' || access === 'deny')
    && typeof provider === 'object' && provider !== null
    && typeof provider.fetch === 'function'
  if (!shapeOk) {
    throw new TeamServiceInstallError(
      'NETWORK_UNCONFINED_REALM',
      `${where} carries no mountable confined web face (needs { effective.network.access, provider.fetch });`
      + ' a declared web face that cannot mount must refuse rather than leave the native web_fetch/web_search row on'
      + ' the inherited, unconfined host web service',
      where,
    )
  }
  return web
}

/**
 * Build the confined web face from the row config's factory (BL-18).
 *
 * ONE SOURCE PER REALM: the caller refuses when the compiled answer already
 * carries `web`. The factory is a COMPOSITION module — it owns the transport
 * and calls the ONE two-axis compiler for the effective lane it answers. This function only imports, calls and validates; it never combines
 * lanes, never reads a blueprint and never decides a permission.
 *
 * @param {{ url: string, config?: object }} spec - the validated `a5sfWebFace`.
 * @param {{ members: readonly object[] }} compiled - the compiled realm answer.
 * @returns {Promise<object>} the face to forward to `mountA5sfRealm`.
 */
async function webFaceFromConfig(spec, compiled) {
  const where = `config.${A5SF_WEB_FACE_KEY} (${spec.url})`
  let imported
  try {
    imported = await import(moduleSpecifierOf(spec.url))
  } catch (error) {
    throw new TypeError(
      `agent-bindings: cannot load ${A5SF_WEB_FACE_KEY} entry ${JSON.stringify(spec.url)}: `
      + `${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const factory = typeof imported?.createConfinedWebFace === 'function'
    ? imported.createConfinedWebFace
    : typeof imported?.default === 'function' ? imported.default : undefined
  if (factory === undefined) {
    throw new TypeError(
      `agent-bindings: ${A5SF_WEB_FACE_KEY} entry ${JSON.stringify(spec.url)} must export a`
      + ' `createConfinedWebFace({ member, members, config })` function (or a default function)',
    )
  }
  const face = await factory(Object.freeze({
    member: compiled.members[0],
    members: compiled.members,
    ...(spec.config === undefined ? {} : { config: spec.config }),
  }))
  if (face === undefined || face === null) {
    throw new TeamServiceInstallError(
      'NETWORK_UNCONFINED_REALM',
      `${where} answered no confined web face; a configured web face that cannot mount must refuse rather than`
      + ' leave the native web_fetch/web_search row on the inherited, unconfined host web service',
      where,
    )
  }
  return assertConfinedWebFace(face, where)
}

/**
 * The Member AGENT's model-visible tool names, read from the ONE registry.
 *
 * WHY a separate reader: the route-C re-mount must be SURFACE-NEUTRAL. A
 * registration made from the agent's own scope is outside the inherited
 * `tools.restrict` filter (`ToolRuntime.view`: own registrations are applied
 * last, outside the filter), so re-mounting a module whose tool the Member's
 * `builtinToolDeny` lane denied would SILENTLY RE-ENABLE it. Comparing the
 * agent's visible set before/after the mount makes that a measured refusal
 * instead of a governance hole.
 *
 * @param {object} root - the agent Context the realm installs into.
 * @param {object|undefined} [runtimeAgent] - the CANONICAL runtime Agent (the
 *   Agent IS the scope key upstream). It takes precedence over the context tag
 *   because `scopeOf()` is blind across duplicate `@deepseek-ai/dsh-scope`
 *   module instances: the tag is a module-private Symbol, and the live Host
 *   measured a healthy Host-tagged ctx reading `undefined` through the Team
 *   plugin's `.pnpm` copy (evidence
 *   `dev/agent-workflow/evidence/a5sf-live-native/scope-duplicate-instances.log`).
 *   The tag stays the LAST-RESORT fallback for a host that carries no explicit
 *   Agent; when NEITHER yields a key the refusal below still fails closed.
 * @returns {Set<string>} the visible tool names.
 */
export function a5sfAgentToolSurface(root, runtimeAgent) {
  const scope = runtimeAgent ?? scopeOf(root)
  if (scope === undefined) {
    throw new TypeError('agent-bindings: the a5sf native tool re-mount needs a SCOPED agent Context (the tool plane is per-agent)')
  }
  const tools = root.get('tools')
  if (tools === undefined || tools === null || typeof tools.schemas !== 'function') {
    throw new TypeError('agent-bindings: the a5sf native tool re-mount needs the tools service on the agent Context')
  }
  return new Set(tools.schemas(scope).map((schema) => schema.name))
}

/**
 * Mount one admitted Member's compiled a5sf realm — the exact call the live
 * Member setup performs.
 *
 * TWO PROVIDER SOURCES, ONE MOUNT:
 *   - the row's product declaration (`a5sfConfig.memberPolicies`, 2026-11-05):
 *     `createProductRealmProvider` compiles it with the ONE compiler, so a
 *     product-configured Member gets the SAME realm an evidence row gets;
 *   - the composition's lazy `teamA5sfRealm` accessor (the evidence rounds).
 * Exactly ONE may answer: two compiled-realm sources for one Member is a fork
 * and refuses. An absent/`undefined` answer from both => `undefined`, nothing
 * happens (the legacy path).
 *
 * The row-config sink is OPTIONAL: with a product declaration but no
 * `a5sfEvidencePath`, no observer is installed at all (the installer's
 * default-preserving path).
 *
 * BL-18 LIVE-HALF UNBLOCK (2026-11-06) — the confined `web` face has the SAME
 * two carriers as the process face: the COMPILED answer
 * (`compiledFor` -> `compiled.web = { effective, provider.fetch/search }`,
 * mirroring `compiled.subprocess`) and, when the compiled answer does not carry
 * one, the row-config factory `a5sfWebFace` (see A5SF_WEB_FACE_KEY). Exactly
 * ONE may answer; a declared face that cannot mount refuses with the typed
 * `NETWORK_UNCONFINED_REALM` before any scope exists.
 *
 * @param {object} input
 * @param {object} input.root - the Cordis Context the realm installs into (the
 *   agent scope the live setup received).
 * @param {{ evidencePath?: string, memberPolicies?: object, webFace?: { url: string, config?: object } } | undefined} input.a5sfConfig
 *   - the block `a5sfRealmConfigOf` returned.
 * @param {Function | undefined} input.provider - the row's LAZY provider
 *   accessor (`() => { compiledFor } | undefined`, the glue's
 *   `deps.a5sfRealmProvider`). It is NEVER called while the row is
 *   unconfigured.
 * @param {object} input.member - the admitted member descriptor forwarded to
 *   `compiledFor`.
 * @returns {Promise<object | undefined>} the mounted realm (`dispose()` must be
 *   kept on the row), or `undefined` when not configured / nothing compiled.
 */
export async function mountMemberA5sfRealm({ root, a5sfConfig, provider, member }) {
  if (a5sfConfig === undefined || a5sfConfig === null) return undefined
  // PRODUCT ASSEMBLY (2026-11-05): the declaration is a COMPLETE provider —
  // `createProductRealmProvider` wraps the ONE compiler over the declaration
  // the row already parsed. A composition that carries BOTH a declaration and
  // a `teamA5sfRealm` service would have two compiled-realm authorities for the
  // same Member, which is exactly the fork this lane forbids, so it refuses.
  const fromDeclaration = a5sfConfig.memberPolicies === undefined
    ? undefined
    : createProductRealmProvider(a5sfConfig.memberPolicies)
  const fromService = typeof provider === 'function' ? provider() : undefined
  if (fromDeclaration !== undefined && fromService !== undefined && fromService !== null) {
    throw new TypeError(
      'agent-bindings: the row config declares `a5sfMemberPolicies` AND the composition provides the `teamA5sfRealm` service;'
      + ' two compiled-realm sources for one Member is ambiguous — keep exactly one',
    )
  }
  const resolved = fromDeclaration ?? fromService
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
  // BL-16: the OPTIONAL confined `subprocess` face. It is forwarded verbatim to
  // the realm mount, which mounts it on the SAME isolated Member scope the
  // native modules are re-mounted into. Only its SHAPE is checked here: the
  // policy is compiled by the provider and the OS provider is P1-07's, so this
  // glue never evaluates a lane or builds a launcher.
  if (compiled.subprocess !== undefined) {
    const subprocess = compiled.subprocess
    const shapeOk = typeof subprocess === 'object' && subprocess !== null
      && typeof subprocess.effective === 'object' && subprocess.effective !== null
      && typeof subprocess.provider === 'object' && subprocess.provider !== null
      && typeof subprocess.provider.spawnStreaming === 'function'
    if (!shapeOk) {
      throw new TypeError(
        'agent-bindings: a5sfRealmProvider.compiledFor answered a `subprocess` face without { effective, provider.spawnStreaming };'
        + ' a declared confined subprocess face that cannot mount must refuse rather than silently leave grep/glob on the host service',
      )
    }
  }

  // BL-18 (2026-11-06, live-half unblock): the OPTIONAL confined `web` face.
  // The CONFIG half may carry it (`a5sfConfig.webFace`, a composition factory —
  // see A5SF_WEB_FACE_KEY); the COMPILED half carries it exactly as
  // `subprocess` does (`compiled.web = { effective, provider.fetch/search }`).
  // ONE source per realm: both present is a fork, not a preference.
  let web = compiled.web
  if (web !== undefined) assertConfinedWebFace(web, 'a5sfRealmProvider.compiledFor answered a `web` face')
  if (a5sfConfig.webFace !== undefined) {
    if (web !== undefined) {
      throw new TeamServiceInstallError(
        'REALM_DECLARATION_INVALID',
        `the compiled realm answer carries a \`web\` face AND config.${A5SF_WEB_FACE_KEY} configures one;`
        + ' two web-face sources for one Member realm is a fork — keep exactly one',
        A5SF_WEB_FACE_KEY,
      )
    }
    web = await webFaceFromConfig(a5sfConfig.webFace, compiled)
  }

  // The row's configured path, never a derived or hardcoded one. The sink owns
  // no counter/ledger: one fact per consultation, in call order. PRODUCT MODE
  // without a sink is the DEFAULT-PRESERVING install path: `onGuardConsult` is
  // omitted entirely (no wrapper, no extra call), exactly as
  // `installMemberIoProviders` documents for an unobserved realm.
  const sink = a5sfConfig.evidencePath === undefined
    ? undefined
    : createGuardConsultFileSink({ path: a5sfConfig.evidencePath })
  const mountInput = {
    root,
    members: compiled.members,
    ...(compiled.bindings === undefined ? {} : { bindings: compiled.bindings }),
    ...(compiled.providerClass === undefined ? {} : { providerClass: compiled.providerClass }),
    ...(compiled.subprocess === undefined ? {} : { subprocess: compiled.subprocess }),
    ...(web === undefined ? {} : { web }),
    ...(sink === undefined ? {} : { onGuardConsult: (fact) => sink.record(fact) }),
  }
  // The realm mount is UNCHANGED and does NOT create the native shadow. ROUTE C
  // attaches the shadow LATER, through `attachA5sfNativeToolModules`, called by
  // the glue AFTER its capability deny lane: a shadow created first would sit
  // OUTSIDE the `tools.restrict` filter and survive the deny (measured).
  return await mountA5sfRealm(mountInput)
}

/**
 * The confined `bash` native module (PD-12), resolved from THIS file's own
 * location: the row rides the dist mirror beside it, so source and installed
 * faces use the same relative specifier. Never a host path, never a guess.
 */
const A5SF_CONFINED_BASH_TOOL = new URL('./confined-bash-tool.mjs', import.meta.url).href

/**
 * PD-12 — decide whether THIS realm's `bash` must be shadowed onto the
 * confined `subprocess` face, and answer the module spec to append.
 *
 * The three conditions are each a refusal to guess:
 *   1. the agent can SEE `bash` (the attach is surface-neutral: it may replace
 *      the preset definition, never add or remove a name);
 *   2. the realm OWNS a confined `subprocess` face (`faces.subprocess` is not
 *      null). Without it the mount seam would refuse a subprocess-consuming
 *      module — and there would be no confined face to route the call to;
 *   3. the composition has not already configured a `bash` owner (the same
 *      module, or an entry that declares `expectedTools: ['bash']`). Auto-adding
 *      beside a declared owner would register the name twice, so the declared
 *      composition wins and this seam stays silent.
 *
 * @param {object} realm - the mounted realm (`installation.members[].faces`).
 * @param {readonly object[]} nativeSpecs - the configured module specs.
 * @param {ReadonlySet<string>} surface - the POST-DENY tool names.
 * @returns {{url: string, expectedTools: readonly string[]} | undefined}
 */
function confinedBashSpecOf(realm, nativeSpecs, surface) {
  if (!surface.has('bash')) return undefined
  const faces = realm?.installation?.members?.[0]?.faces
  if (faces === undefined || faces === null || faces.subprocess === undefined || faces.subprocess === null) return undefined
  for (const spec of nativeSpecs) {
    if (spec?.url === A5SF_CONFINED_BASH_TOOL) return undefined
    if (Array.isArray(spec?.expectedTools) && spec.expectedTools.includes('bash')) return undefined
  }
  return Object.freeze({ url: A5SF_CONFINED_BASH_TOOL, expectedTools: Object.freeze(['bash']) })
}

/**
 * ROUTE C — create the NATIVE tool shadow on an ALREADY-MOUNTED realm, after
 * the Member capability deny lane, and refuse if it changes the surface.
 *
 * WHY A SECOND CALL AND NOT PART OF THE MOUNT (review fix, 2026-11-03): the
 * production glue mounts the realm early (its tool plane feeds the Team tools
 * and the governed plane) but applies `builtinToolDeny` LATER in the same
 * setup. An OWN-scope registration is outside the inherited `tools.restrict`
 * filter, so the deny order decides the outcome:
 *
 *   deny  -> shadow : `read` is hidden first; the surface check then REFUSES the
 *                     shadow (it would ADD a name) — fail closed.
 *   shadow -> deny  : the deny hides the inherited preset row and the shadow
 *                     takes its place — the denied tool stays visible AND
 *                     executable on the confined lane.
 *
 * Only the first order is safe, so this function must be called after the deny
 * (the glue's order is pinned by the suite).
 *
 * @param {object} realm - the object `mountMemberA5sfRealm` returned.
 * @param {object} root - the agent Context the realm was mounted on.
 * @param {object|undefined} a5sfConfig - the block from `a5sfRealmConfigOf`.
 * @param {object|undefined} [runtimeAgent] - the setup's CANONICAL runtime
 *   Agent (the Agent IS the scope key). Forwarded to `a5sfAgentToolSurface` so
 *   the POST-DENY surface read does not depend on a `scopeOf()` that is blind
 *   across duplicate `@deepseek-ai/dsh-scope` module instances; absent = the
 *   context tag is the last-resort fallback (and a keyless ctx still refuses).
 * @returns {Promise<readonly object[]|undefined>} the created fibers, or
 *   `undefined` when the row does not configure native modules.
 */
export async function attachA5sfNativeToolModules(realm, root, a5sfConfig, runtimeAgent) {
  const nativeSpecs = a5sfConfig?.nativeToolModules ?? []
  if (realm === undefined || realm === null || typeof realm.mountNativeToolModules !== 'function') {
    throw new TypeError('agent-bindings: the a5sf native tool attach needs a mounted realm carrying mountNativeToolModules (the pre-route-C realm cannot re-mount native tools)')
  }
  // The POST-DENY surface: this is the baseline the shadow must not change.
  const before = a5sfAgentToolSurface(root, runtimeAgent)
  // PD-12 (2026-11-10): the model-visible `bash` must ride the confined
  // `subprocess` face the ceiling term is compiled for. A realm that owns that
  // face, and whose agent can already see `bash`, gets the surface-neutral
  // shadow appended here (see `confinedBashSpecOf`). A realm WITHOUT the face,
  // or an agent without `bash`, is left byte-identically alone: adding a name
  // would be a governance change this wiring must not make, and there is no
  // confined face to route the call to anyway.
  const bashSpec = confinedBashSpecOf(realm, nativeSpecs, before)
  const specs = bashSpec === undefined ? nativeSpecs : [...nativeSpecs, bashSpec]
  if (specs.length === 0) return undefined
  // The baseline DEFINITIONS, by name: the coverage check below needs identity,
  // not just the name set (a module that registers nothing, or registers late,
  // leaves the preset definition in place — same name, ZERO guard facts).
  const coverageScope = runtimeAgent ?? scopeOf(root)
  const toolsService = root.get('tools')
  // Identity coverage needs the scoped reader. ASSEMBLY GAP 2 (2026-11-03): on
  // the product path a missing `get()` must NOT silently degrade to the
  // name-set gate. The composition DECLARED managed native modules, so the only
  // honest options are "verify by definition identity" or "refuse" — a
  // name-set-only double is fine for tests, never for a live Member.
  const canReadDefinitions = toolsService !== undefined && toolsService !== null && typeof toolsService.get === 'function'
  if (!canReadDefinitions) {
    throw new A5sfNativeAssemblyError(
      'A5SF_COVERAGE_UNDEFINED',
      `the configured ${A5SF_NATIVE_TOOL_MODULES_KEY} need a tools service that can answer definition identity`
      + ' (tools.get); refusing the native mount instead of degrading to a name-set-only check that cannot prove the router'
      + ' shadowed each forwarded tool',
    )
  }
  const beforeDefinitions = new Map([...before].map((name) => [name, toolsService.get(name, coverageScope)]))
  const nativeToolModules = await Promise.all(specs.map(async (spec) => {
    // Imported by the ROW COMPOSITION's specifier; the mount seam forwards it.
    // WRAPPED: a resolution failure must name the configured entry, not surface
    // as a bare ERR_MODULE_NOT_FOUND from the middle of agent setup.
    let imported
    try {
      imported = await import(moduleSpecifierOf(spec.url))
    } catch (error) {
      throw new TypeError(
        `agent-bindings: cannot load ${A5SF_NATIVE_TOOL_MODULES_KEY} entry ${JSON.stringify(spec.url)}: `
        + `${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (imported === null || (typeof imported !== 'object' && typeof imported !== 'function')) {
      throw new TypeError(`agent-bindings: ${A5SF_NATIVE_TOOL_MODULES_KEY} entry ${JSON.stringify(spec.url)} did not evaluate to a Cordis plugin module`)
    }
    return Object.freeze({
      module: imported,
      specifier: spec.url,
      ...(spec.config === undefined ? {} : { config: spec.config }),
      ...(spec.expectedTools === undefined ? {} : { expectedTools: spec.expectedTools }),
      ...(spec.allowEmpty === undefined ? {} : { allowEmpty: spec.allowEmpty }),
    })
  }))
  const expansion = await nativeToolMountsOf(nativeToolModules, realm)
  const fibers = await realm.mountNativeToolModules(
    expansion.mounts,
    // The RESOLVED agent scope key: the realm's post-settle re-verification
    // needs it to ask `tools.get(name, scope)` which definition the agent now
    // resolves. This function already resolved it for the surface reads.
    { scope: coverageScope },
  )
  const coverage = uncoveredShadowedTools(root, coverageScope, fibers, beforeDefinitions)
  // The caller's OWN refusal abandons the attach: release every router fiber
  // through the realm (which also detaches its post-settle verification) rather
  // than disposing fibers one by one. That keeps the refusal from being recorded
  // as a LATE-CHANGE invalidation and leaves a corrected composition able to
  // attach later.
  const releaseAttach = async () => {
    if (typeof realm.disposeNativeToolModules === 'function') {
      try {
        await realm.disposeNativeToolModules()
        return
      } catch {
        // Fall through to the individual disposals below.
      }
    }
    for (const fiber of [...fibers].reverse()) {
      try {
        await fiber.dispose()
      } catch {
        // The refusal is the failure that must be reported.
      }
    }
  }
  // C1 (2026-11-03 review): reconcile the REAL forwarding against the
  // ownership probe. A module that registers only on its FIRST `apply` is
  // consumed by the probe: the real mount forwards NOTHING, the model-visible
  // name set still matches the preset, and without this check the attach is
  // ACCEPTED with the tool left on the unguarded preset definition (measured
  // fail-open; the binding mount's own "must forward my tool" refusal catches
  // only binding-owned tools). Per module, the real fibers' `observed` (which
  // already includes what they forwarded) must be a SUPERSET of what the probe
  // observed. Extra real names are the surface gate's business; a MISSING
  // observed name is a lost shadow and refuses the whole attach.
  const unreproduced = unreproducedObservations(expansion, fibers)
  if (unreproduced.length > 0) {
    await releaseAttach()
    throw new A5sfNativeAssemblyError(
      'A5SF_MODULE_OBSERVATION_UNREPRODUCED',
      `the native ownership probe observed registrations that the REAL mount did not reproduce`
      + ` (${unreproduced.map((entry) => `${entry.moduleName} observed ${JSON.stringify(entry.missing)}`).join('; ')});`
      + ' a one-shot/conditional `apply` consumed by the probe would leave those tools on the unguarded preset definition'
      + ' while the surface name set stayed equal — refusing the attach (fail closed)',
    )
  }
  // OPT-IN DECLARATION (event-driven shape, 2026-11-03): an entry that names its
  // `expectedTools` must actually SHADOW every declared name by the settle
  // boundary. A module that registers nothing (provider absent, or an
  // event-driven registration that never fired) is accepted by the seam — it
  // reports no evidence — so without this the declared name silently falls back
  // to whatever PRESET definition the composition mounted for it, with zero guard
  // facts. The declaration GRANTS NOTHING: it declares what the composition
  // believes and turns a mismatch into a typed refusal. Undeclared entries keep
  // the old behaviour exactly (the merged C1/C3/A7 contracts).
  const unshadowedExpected = unshadowedExpectedTools(nativeToolModules, expansion, fibers)
  if (unshadowedExpected.length > 0) {
    await releaseAttach()
    throw new A5sfNativeAssemblyError(
      'A5SF_EXPECTED_TOOLS_UNSHADOWED',
      `the configured ${A5SF_NATIVE_TOOL_MODULES_KEY} declared expectedTools that the settled attach did not shadow`
      + ` (${unshadowedExpected.map((entry) => `${entry.moduleName} expected ${JSON.stringify(entry.expected)} but the attach forwarded ${JSON.stringify(entry.forwarded)}`).join('; ')});`
      + ' a declared managed name that no routed fiber forwards executes on whatever PRESET definition is visible, with zero'
      + ' guard facts — refusing the attach (fail closed)',
    )
  }
  // EMPTY-FRONTIER REFUSAL (2026-11-03 review C2): a module entry that carries a
  // `config` is a CONDITIONAL module — the composition configured the thing its
  // registration depends on. If such a module forwards nothing at the settle
  // boundary, the row cannot distinguish "the condition is absent everywhere, so
  // the name exists for nobody" from "the preset plane serves the name on its own
  // provider". Measured: the two worlds have IDENTICAL inputs to this function
  // (same entry, same config, same empty frontier) and differ only in the preset
  // plane's config, which this seam cannot read; the model-visible surface looks
  // the same to it in the harmful case as a normal subset in the harmless one.
  // So the decidable unit is the entry's own shape, and the default is fail
  // closed; `allowEmpty: true` is the explicit, documented opt-out. E8
  // (2026-11-03): an accepted empty frontier is RECORDED on the attach record
  // (`realm.nativeAttachRecord.emptyFrontierAcknowledged`) as a DECLARED
  // HAZARD, never as a verification.
  const emptyFrontiers = emptyManagedFrontiers(nativeToolModules, expansion, fibers)
  if (emptyFrontiers.length > 0) {
    await releaseAttach()
    throw new A5sfNativeAssemblyError(
      'A5SF_MANAGED_FRONTIER_EMPTY',
      `the configured ${A5SF_NATIVE_TOOL_MODULES_KEY} left a CONFIGURED module with an empty routed frontier`
      + ` (${emptyFrontiers.map((entry) => `${entry.moduleName} forwards nothing`).join('; ')});`
      + ' a configured module that shadows nothing cannot be verified against the preset plane (the row cannot read'
      + ' that plane\'s module config), and the name it was meant to own may execute on the PRESET definition with zero'
      + ' guard facts — declare expectedTools, or pass allowEmpty: true if the empty frontier is intended',
    )
  }
  if (coverage.length > 0) {
    // FAIL CLOSED on COVERAGE, not just on the name set. A tool a router reports
    // as forwarded MUST be the definition the agent now resolves; if the preset
    // definition is still the one visible, the tool executes on the BASE provider
    // with zero guard facts while every surface name stayed equal — the hole a
    // name-only check cannot see.
    await releaseAttach()
    throw new TypeError(
      `agent-bindings: the configured ${A5SF_NATIVE_TOOL_MODULES_KEY} left ${JSON.stringify(coverage)} on the unshadowed baseline`
      + ' (the router forwarded the name but the preset definition is still the one the agent resolves); refusing the mount —'
      + ' those tools would execute on the BASE provider with zero guard facts',
    )
  }
  const after = a5sfAgentToolSurface(root, runtimeAgent)
  const added = [...after].filter((name) => !before.has(name))
  const removed = [...before].filter((name) => !after.has(name))
  if (added.length > 0 || removed.length > 0) {
    // FAIL CLOSED. A re-mount may only place the SAME native surface on the
    // confined lane; a name that appears (a denied tool re-enabled, an extra
    // tool package) or disappears is a governance change this wiring must not
    // make silently. The shadow is removed and the refusal propagates; the
    // realm itself stays mounted (it is still the Member's confined provider).
    await releaseAttach()
    throw new TypeError(
      `agent-bindings: the configured ${A5SF_NATIVE_TOOL_MODULES_KEY} would CHANGE the Member's model-visible tool surface`
      + ` (added: ${JSON.stringify(added)}; removed: ${JSON.stringify(removed)}); refusing to mount the native shadow — a scoped`
      + ' registration is outside the inherited tools.restrict filter, so a re-mounted tool could re-enable a builtinToolDeny lane',
    )
  }
  return fibers
}

/**
 * The names a router reported as FORWARDED whose definition is still the
 * pre-attach (preset) one, or whose definition is gone.
 *
 * WHY identity: `a5sfAgentToolSurface` compares NAMES. A tool that a module
 * registers asynchronously — or registers nowhere while the preset still
 * provides it — keeps the same name and the same preset DEFINITION object, so
 * the name set is unchanged and the tool executes on the BASE provider with no
 * guard consultation at all. Diffing definition identity per forwarded name
 * turns that into a measured refusal.
 *
 * @param {object} root - the agent Context.
 * @param {object|undefined} scope - the RESOLVED agent scope key (`runtimeAgent ?? scopeOf(root)`).
 * @param {readonly object[]} fibers - the router fibers the mount created.
 * @param {Map<string, unknown>} beforeDefinitions - name -> pre-attach definition.
 * @returns {string[]} forwarded names that are not shadowed by this attach.
 */
function uncoveredShadowedTools(root, scope, fibers, beforeDefinitions) {
  const tools = root.get('tools')
  const forwarded = new Set()
  for (const fiber of fibers) {
    const routing = fiber?.[NATIVE_REGISTRATION_ROUTING]
    if (routing === undefined || routing === null) continue
    for (const name of routing.forwarded) forwarded.add(name)
  }
  const uncovered = []
  for (const name of forwarded) {
    const definition = tools.get(name, scope)
    if (definition === undefined || definition === beforeDefinitions.get(name)) uncovered.push(name)
  }
  return uncovered
}

/**
 * Expand the configured native modules into the PER-FIBER mounts S-1 requires.
 *
 * A native tool PACKAGE registers its whole suite from one `apply`, so a single
 * mount can only ever execute on ONE realm. The mount seam's registration
 * router (see `mount.ts`) partitions the suite by tool name; this function is
 * the row-side half of that partition:
 *
 *   - ONE ceiling mount per module (no `toolBindingIdentity`), which forwards
 *     every tool that has NO mounted binding (today's behaviour), and
 *   - ONE binding mount ONLY for the module that OWNS the binding's tool
 *     (`dsh.fs/read` -> `read`), mounted on that binding's
 *     already-compiled/confined provider.
 *
 * ASSEMBLY GAP 1 (2026-11-03) — WHY THIS IS NOT A CARTESIAN PRODUCT. A binding
 * realm can only register the tool its identity names, so demanding that EVERY
 * configured module's binding fiber register it refuses the whole attach as soon
 * as a second module does not own that tool (measured: `read` belongs to one
 * package; a companion module has no `read`, and the cartesian mount refused
 * multi-module assembly). Ownership is therefore OBSERVED, never guessed from a
 * table or a module specifier: each module is mounted once in the CEILING
 * partition behind an observe-only router that registers NOTHING and reports
 * the names its `apply` would have registered. Those fibers are disposed before
 * the real mounts, so the observation leaves no registry effect. A binding with
 * NO owner (or with MORE THAN ONE) is a typed refusal — fail closed, never a
 * silent widening onto the ceiling.
 *
 * The UNION of the fibers is the module's surface, exactly once: the existing
 * surface-neutrality check below stays the gate, and `EffectiveIo` is never
 * recomputed — the selected realm's guard already holds the compiled
 * intersection.
 *
 * BL-17 (2026-11-04) — NO PROCESS CONSUMER ON AN UNCONFINED REALM. This
 * expansion may produce a binding mount, and a binding realm installs a
 * confined `fs` but no `subprocess` face. `mountNativeToolModules` therefore
 * REFUSES a module that injects `subprocess` on any realm whose required
 * `faces.subprocess` answer is `null` (typed `SUBPROCESS_UNCONFINED_REALM`,
 * before any fiber exists). This row adds no second check and no fallback: a
 * future binding-scoped process lane must install its confined face on that
 * realm and report it, or stay refused.
 *
 * @param {readonly object[]} nativeToolModules - imported module specs.
 * @param {object} realm - the mounted realm (its `bindings` are the routing table).
 * @returns {Promise<readonly object[]>} the mounts to hand to `mountNativeToolModules`.
 */
async function nativeToolMountsOf(nativeToolModules, realm) {
  const bindings = Array.isArray(realm?.bindings) ? realm.bindings : []
  const identities = []
  for (const binding of bindings) {
    const identity = binding?.toolBindingIdentity
    if (typeof identity !== 'string' || identity.trim() === '') {
      throw new TypeError('agent-bindings: every mounted a5sf ToolBinding realm must carry a non-blank toolBindingIdentity (the native routing table)')
    }
    identities.push(identity)
  }
  // No mounted binding: every module keeps today's single ceiling mount, and
  // there is no ownership question to answer (no observation mount needed).
  if (identities.length === 0) {
    return Object.freeze({
      mounts: Object.freeze([...nativeToolModules]),
      observedByModule: null,
      mountCounts: Uint32Array.from(nativeToolModules.map(() => 1)),
    })
  }
  // OBSERVE what each module actually registers. `observed` is the router's
  // receipt of every registration the module attempted; observe-only forwards
  // none of them, so the live registry is untouched.
  const observations = await observeNativeToolOwnership(nativeToolModules, realm)
  /** @type {Map<number, string[]>} module index -> binding identities it owns. */
  const assignments = new Map()
  for (const identity of identities) {
    const toolName = toolNameOfBindingIdentity(identity)
    if (toolName === '') {
      throw new TypeError(`agent-bindings: ToolBinding identity ${JSON.stringify(identity)} addresses no tool name (expected '<owner>/<tool>')`)
    }
    const owners = []
    for (const [index, names] of observations.entries()) {
      if (names.has(toolName)) owners.push(index)
    }
    if (owners.length === 0) {
      throw new A5sfNativeAssemblyError(
        'A5SF_BINDING_OWNER_UNRESOLVED',
        `no configured ${A5SF_NATIVE_TOOL_MODULES_KEY} entry registers tool '${toolName}' named by mounted ToolBinding '${identity}';`
        + ' a binding realm can only route a tool its own module registers (fail closed — refusing rather than falling back'
        + ' onto the ceiling lane)',
      )
    }
    if (owners.length > 1) {
      throw new A5sfNativeAssemblyError(
        'A5SF_BINDING_OWNER_AMBIGUOUS',
        `mounted ToolBinding '${identity}' names tool '${toolName}', which ${String(owners.length)} configured native modules register`
        + ` (${owners.map((index) => nativeToolModules[index]?.module?.name ?? `#${String(index)}`).join(', ')});`
        + ' assigning the binding to one of them would be a guess (fail closed)',
      )
    }
    const owner = owners[0]
    const owned = assignments.get(owner)
    if (owned === undefined) assignments.set(owner, [identity])
    else owned.push(identity)
  }
  const mounts = []
  const mountCounts = []
  for (const [index, module] of nativeToolModules.entries()) {
    const owned = assignments.get(index) ?? []
    mounts.push(module)
    for (const toolBindingIdentity of owned) mounts.push({ ...module, toolBindingIdentity })
    mountCounts.push(1 + owned.length)
  }
  return Object.freeze({
    mounts: Object.freeze(mounts),
    observedByModule: observations,
    mountCounts: Uint32Array.from(mountCounts),
  })
}

/**
 * Per-module C1 reconciliation: which probe-observed names the REAL mount did
 * not reproduce.
 *
 * @param {{ mounts: readonly object[], observedByModule: readonly Set<string>[]|null, mountCounts: Uint32Array }} expansion
 * @param {readonly object[]} fibers - the fibers the real mount returned, in mount order.
 * @returns {{ moduleName: string, missing: string[] }[]}
 */
function unreproducedObservations(expansion, fibers) {
  if (expansion.observedByModule === null) return []
  const unreproduced = []
  let cursor = 0
  for (const [index, observed] of expansion.observedByModule.entries()) {
    const count = expansion.mountCounts[index]
    const moduleFibers = fibers.slice(cursor, cursor + count)
    cursor += count
    const real = new Set()
    for (const fiber of moduleFibers) {
      const routing = fiber?.[NATIVE_REGISTRATION_ROUTING]
      for (const name of routing?.observed ?? []) real.add(name)
      for (const name of routing?.forwarded ?? []) real.add(name)
    }
    const missing = [...observed].filter((name) => !real.has(name))
    if (missing.length > 0) {
      const moduleName = expansion.mounts[index]?.module?.name ?? `#${String(index)}`
      unreproduced.push({ moduleName, missing })
    }
  }
  return unreproduced
}

/**
 * Per-module OPT-IN declaration check: which declared `expectedTools` the
 * settled attach did not SHADOW (forwarded by one of that module's fibers).
 *
 * `expectedTools` is a declaration of what the composition believes the module
 * provides — not an allowlist and not a second authority. Its only effect is to
 * make "the module forwarded nothing / something else" a typed refusal instead
 * of a silently accepted zero-shadow attach.
 *
 * @param {readonly {module?: {name?: string}, expectedTools?: readonly string[]}[]} nativeToolModules
 * @param {{ mountCounts: Uint32Array }} expansion
 * @param {readonly object[]} fibers - the fibers the real mount returned, in mount order.
 * @returns {{ moduleName: string, expected: string[], forwarded: string[] }[]}
 */
function unshadowedExpectedTools(nativeToolModules, expansion, fibers) {
  const failures = []
  let cursor = 0
  for (const [index, module] of nativeToolModules.entries()) {
    const count = expansion.mountCounts[index]
    const moduleFibers = fibers.slice(cursor, cursor + count)
    cursor += count
    const declared = module.expectedTools
    if (declared === undefined) continue
    const forwarded = new Set()
    for (const fiber of moduleFibers) {
      const routing = fiber?.[NATIVE_REGISTRATION_ROUTING]
      for (const name of routing?.forwarded ?? []) forwarded.add(name)
    }
    const missing = declared.filter((name) => !forwarded.has(name))
    if (missing.length > 0) {
      // E8 / allowEmpty (2026-11-03): an entry that EXPLICITLY acknowledged an
      // EMPTY frontier (`allowEmpty: true`, forwarded.size === 0) may also have
      // declared the names it expected: the acknowledgement says "I know this
      // frontier is empty", so the declaration is recorded as ACKNOWLEDGED on
      // the attach record instead of being refused. This is NOT a verification
      // and it is narrow: a PARTIAL frontier (some names forwarded, some not) is
      // still refused even with allowEmpty — only an EMPTY frontier can be
      // acknowledged. Without allowEmpty this branch is unchanged (EXPECT-2 /
      // C2-d refusals stay exactly as merged).
      if (module.allowEmpty === true && forwarded.size === 0) continue
      failures.push({
        moduleName: module.module?.name ?? `#${String(index)}`,
        expected: [...declared],
        forwarded: [...forwarded],
      })
    }
  }
  return failures
}

/**
 * CONFIGURED modules whose routed frontier is empty and which did not opt out.
 *
 * "Configured" = the entry carried a `config` object (the composition configured
 * a provider/feature switch). Entries without a config keep the merged
 * behaviour: fixtures and the product's same-config shape are unaffected by
 * default only when they are unconditional, and a conditional one must either
 * declare `expectedTools` or `allowEmpty: true`.
 *
 * @param {readonly {module?: {name?: string}, config?: object, expectedTools?: readonly string[], allowEmpty?: boolean}[]} nativeToolModules
 * @param {{ mountCounts: Uint32Array }} expansion
 * @param {readonly object[]} fibers
 * @returns {{ moduleName: string }[]}
 */
function emptyManagedFrontiers(nativeToolModules, expansion, fibers) {
  const failures = []
  let cursor = 0
  for (const [index, module] of nativeToolModules.entries()) {
    const count = expansion.mountCounts[index]
    const moduleFibers = fibers.slice(cursor, cursor + count)
    cursor += count
    if (module.config === undefined || module.expectedTools !== undefined || module.allowEmpty === true) continue
    let forwarded = 0
    for (const fiber of moduleFibers) {
      forwarded += fiber?.[NATIVE_REGISTRATION_ROUTING]?.forwarded?.length ?? 0
    }
    if (forwarded === 0) failures.push({ moduleName: module.module?.name ?? `#${String(index)}` })
  }
  return failures
}

/**
 * Mount every module ONCE in the ceiling partition as an OBSERVE-ONLY probe and
 * return its own registration answer. The probe fibers are disposed before the
 * caller registers anything real; no tool or prompt section is registered by an
 * observe-only mount (`mount.ts` forwards nothing), so this is a read of the
 * module's behaviour, not a mutation of the Member's surface.
 *
 * @param {readonly object[]} nativeToolModules - imported module specs.
 * @param {object} realm - the mounted realm.
 * @returns {Promise<readonly Set<string>[]>} observed tool names, by module index.
 */
async function observeNativeToolOwnership(nativeToolModules, realm) {
  const probes = await realm.mountNativeToolModules(
    nativeToolModules.map((module) => ({ ...module, observeOnly: true })),
    {},
  )
  try {
    if (!Array.isArray(probes) || probes.length !== nativeToolModules.length) {
      throw new TypeError(
        `agent-bindings: the native ownership observation must answer one receipt per configured module`
        + ` (got ${Array.isArray(probes) ? String(probes.length) : typeof probes} for ${String(nativeToolModules.length)})`,
      )
    }
    return Object.freeze(probes.map((fiber) => {
      const routing = fiber?.[NATIVE_REGISTRATION_ROUTING]
      // A pre-gap-1 double may only publish `forwarded`; accepting it keeps the
      // observation seam backward compatible without inventing names.
      const names = routing?.observed ?? routing?.forwarded ?? []
      return new Set(names)
    }))
  } finally {
    for (const fiber of (Array.isArray(probes) ? [...probes].reverse() : [])) {
      try {
        await fiber.dispose()
      } catch {
        // Disposal of a probe that registered nothing: the mount's own refusal
        // (if any) is the failure that matters.
      }
    }
  }
}

/** The tool name a ToolBinding identity addresses: the last `/` segment of `<owner>/<tool>`. */
function toolNameOfBindingIdentity(toolBindingIdentity) {
  const at = toolBindingIdentity.lastIndexOf('/')
  const name = at === -1 ? toolBindingIdentity : toolBindingIdentity.slice(at + 1)
  return name.trim()
}

/**
 * Turn one configured module specifier into something `import()` accepts.
 *
 * `file:` URLs pass through; absolute paths become file URLs; anything else is
 * treated as a bare specifier resolved from THIS module (the host install that
 * carries the plugin). The row composition is responsible for naming a module
 * the host can actually load.
 *
 * @param {string} specifier - the configured specifier.
 * @returns {string} the import specifier.
 */
function moduleSpecifierOf(specifier) {
  if (specifier.startsWith('file:')) return specifier
  if (isAbsolute(specifier)) return pathToFileURL(specifier).href
  return specifier
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

