/**
 * template-binding.mjs — WHICH template a session embodies, under WHICH bound snapshot.
 *
 * EXTRACTED FROM agent-bindings.mjs (2026-11-22, external architecture review, plan M4). Three things
 * live here because they are one decision and one piece of state:
 *
 *  - the per-TEAM-ROOT bound-blueprint cache (one row carries MANY team roots, each bound to its OWN
 *    snapshot - the row-global parse was the BP-F defect);
 *  - the FAIL-CLOSED template locator: leader by position, member by its durable row, the templateId
 *    hint bridging ONLY the fresh-member window, and every resolution failure throwing the typed
 *    `capability-template-unresolved` rather than degrading to the legacy catalog;
 *  - the static-capabilities projection, which rides the same locate.
 *
 * The cache is the reason this is a component and not three helpers: whoever resolves a template also
 * decides what a root's bound snapshot IS, and a second cache somewhere else is how two callers come
 * to disagree about the same team root.
 *
 * @module packages/runtime/src/plugin/vnext/template-binding
 */

// NO domain imports: the parser and the projection are INJECTED. Two reasons, one of each kind.
// Practical: this module must be unit-testable under plain node:test, and the domain packages are
// TypeScript that only the build/hook resolves. Architectural: locating a template is policy, and which
// parser and which projection implement it is the composition's decision, not this module's.
import { freshCreateHintAdmits } from './bind-path.mjs'

/**
 * @param {object} input
 * @param {object} input.domain - the open domain (a member's template id comes from its durable row).
 * @param {string} input.bootRootSessionId - this row's boot root (the default owner).
 * @param {Function|undefined} input.resolveBoundBlueprint - the injected resolver (production host);
 *   absent = the legacy row-global `blueprintSource` anchor.
 * @param {string|undefined} input.blueprintSource - the legacy anchor source.
 * @param {(message: string) => void} input.observe - the row's observation sink (a refusal is recorded
 *   where every other refusal is).
 * @param {(source: string) => object} input.parseBlueprint - the blueprint parser (injected).
 * @param {(blueprint: object, template: object) => object} input.staticCapabilitiesOf - the static
 *   capability projection (injected).
 * @returns {{getBoundBlueprint: Function, locateTemplate: Function, resolveStaticCapabilities: Function}}
 */
export function createTemplateBinding ({
  domain,
  bootRootSessionId,
  resolveBoundBlueprint,
  blueprintSource,
  observe,
  parseBlueprint,
  staticCapabilitiesOf,
}) {
  if (domain === null || typeof domain !== 'object' || typeof domain.repositories?.memberInstances?.list !== 'function') {
    throw new TypeError('template-binding: the open domain must expose repositories.memberInstances.list')
  }
  if (typeof observe !== 'function') throw new TypeError('template-binding: observe must be a function (a template refusal with nowhere to go is a silent failure)')
  if (typeof parseBlueprint !== 'function') throw new TypeError('template-binding: parseBlueprint must be injected (the legacy blueprint anchor needs a parser)')
  if (typeof staticCapabilitiesOf !== 'function') throw new TypeError('template-binding: staticCapabilitiesOf must be injected (the projection is the composition\'s)')
  const rootSid = bootRootSessionId
  const config = { blueprintSource }



  // ── alpha.1 (plan §10): the static template capabilities ───────────────
  //
  // The BOUND BLUEPRINT is each team root's capability authority (the same
  // document the persona slot composes from — the owning TeamSession's
  // bound snapshot, resolved once per root and cached: parsing is pure, a
  // bound snapshot is stable for the root's lifetime — a FROZEN
  // revision is immutable by construction, and a mutable snapshot was
  // frozen at its TeamSession's mint through the BP6 barrier. The
  // MEMBER TEMPLATE is resolved from the durable
  // backend truth — the committed MemberInstance row's templateId,
  // re-read on EVERY setup (so both create and cold resume re-derive the
  // capabilities from the durable identity, plan §10.9 — never from a
  // process-local ephemeral selection); in the fresh-create window (the
  // row commits AFTER the setup runs) the templateIdHint the child factory
  // carries stands in (exactly the value the flow commits moments later —
  // the same bridge the persona install uses). The LEADER resolves by
  // position (the LeaderTemplate).
  //
  // P0-1 (hardening §3): a session the domain cannot RESOLVE to a template
  // (blueprint unavailable, no row + no fresh-member hint, or the row's
  // templateId names no template of the bound blueprint) FAILS CLOSED — the
  // setup throws 'capability-template-unresolved' and the unpublished agent
  // rolls back. Legacy mode is reserved for a SUCCESSFULLY located template
  // whose `capabilities` field is absent (the 0.1.0-rc.1 behavior — the
  // legacy Blueprint does not regress); an identity/template resolution
  // failure must never degrade to the full legacy tool catalog (fail-open).

  /**
   * BP-F (issue #2 blueprint-loading, plan §11.2): the per-TEAM-ROOT bound
   * blueprint cache (the row-global single parse is the defect this repair
   * removes — one row carries MANY team roots, each bound to its OWN
   * snapshot). Keyed by the owning team root session id; each root's
   * document is resolved ONCE per binding and cached (parsing is pure; a
   * bound snapshot is stable for its root's lifetime — see the
   * block comment above).
   * @type {Map<string, object|null>}
   */
  const boundBlueprintByRoot = new Map()
  /**
   * The bound blueprint of ONE team root (BP-F, plan §11.2):
   *  - an INJECTED `resolveBoundBlueprint` resolver (the production host,
   *    plan §11.1) decides the root's bound snapshot — the durable
   *    TeamSession row's ref through the live authority (frozen registry
   *    replay / fresh mutable parse, hash equality verified); a resolver
   *    failure THROWS (the setup rejection rolls the unpublished agent
   *    back — the same fail-closed semantics the row-global parse had for
   *    an unparseable anchor);
   *  - ABSENT resolver -> the LEGACY row-global anchor
   *    (config.blueprintSource, parsed once per root as before — the
   *    factory-world / pre-repair fallback; empty source -> null, exactly
   *    the pre-repair null contract).
   * @param {string} [teamRootSid] - the owning team root (absent = the boot root).
   * @returns {object|null} the parsed TeamBlueprint of the root's bound snapshot, or null.
   */
  function getBoundBlueprint(teamRootSid) {
    const root = teamRootSid !== undefined ? String(teamRootSid) : rootSid
    const cached = boundBlueprintByRoot.get(root)
    if (cached !== undefined) return cached
    let blueprint
    if (typeof resolveBoundBlueprint === 'function') {
      blueprint = resolveBoundBlueprint(root)
    } else {
      const src = String(config.blueprintSource ?? '')
      blueprint = src === '' ? null : parseBlueprint(src)
    }
    boundBlueprintByRoot.set(root, blueprint)
    return blueprint
  }

  /**
   * Locate the bound blueprint template of one session (alpha.1 core,
   * extracted verbatim for alpha.2, plan §11 — the permission install
   * needs the TEMPLATE itself, not just the static-capabilities
   * projection, to read `capabilities.permissions` off it).
   *
   * P0-1 (hardening §3): resolution FAILS CLOSED. A resolution failure
   * (blueprint unavailable, leader template missing, templateId missing,
   * template not found) THROWS the typed 'capability-template-unresolved'
   * error (the setup rejection rolls the unpublished agent back) — it never
   * degrades to legacy. Legacy is reserved for a SUCCESSFUL template
   * location whose `capabilities` field is absent (`staticCapabilitiesOf`
   * returns { mode: 'legacy' } for that exact case). The `templateIdHint`
   * bridges ONLY the fresh-create window (bindPath === 'fresh-member'); a
   * cold resume / request boundary missing its durable row fails closed.
   * @param {string} sessionId - the session the agent embodies.
   * @param {string} [instanceId] - the resolved instance id (leader or member).
   * @param {string} [templateIdHint] - the fresh-create window hint (used
   *   ONLY when bindPath === 'fresh-member').
   * @param {string} [teamRootSid] - the owning team root (absent = the boot root).
   * @param {string} [bindPath] - the T1 bind path (fresh-member / cold-member
   *   / fresh-root / cold-root); gates the hint (P0-1 §3.4).
   * @returns {object} the bound blueprint template object (the deep-frozen
   *   LeaderTemplate / MemberTemplate of the bound snapshot).
   * @throws {Error} 'capability-template-unresolved' on a resolution failure.
   */
  function locateTemplate(sessionId, instanceId, templateIdHint, teamRootSid, bindPath) {
    // BP-F (issue #2 blueprint-loading, plan §11.2): the owning team root
    // is determined FIRST, then that TeamSession's bound blueprint is
    // resolved (the row-global anchor is only the no-resolver fallback).
    const teamRoot = teamRootSid !== undefined ? String(teamRootSid) : rootSid
    const blueprint = getBoundBlueprint(teamRoot)
    // P0-1 (hardening §3): an unavailable blueprint is a RESOLUTION failure,
    // not a legacy template — fail closed (the legacy 0.1.0-rc.1 behavior is
    // reserved for a SUCCESSFUL template location whose `capabilities` field
    // is absent; an identity/template resolution failure must never degrade
    // to the full legacy tool catalog).
    if (blueprint === null) {
      throw unresolved(sessionId, {
        reason: 'blueprint-unavailable',
        ...(instanceId !== undefined ? { instanceId } : {}),
      })
    }
    if (sessionId === teamRoot) {
      // The LEADER is the LeaderTemplate (Architecture §5.3/§6.1). A valid
      // blueprint always carries a leader template; a missing leader is a
      // broken blueprint (fail closed, not legacy).
      const leader = blueprint.leader
      if (leader === undefined) {
        throw unresolved(sessionId, {
          reason: 'template-not-found',
          ...(instanceId !== undefined ? { instanceId } : {}),
        })
      }
      return leader
    }
    // A MEMBER resolves through its DURABLE row (the backend truth).
    const members = domain.repositories.memberInstances.list(teamRoot)
    const row = members.find((member) => String(member.childSessionId) === sessionId)
    let templateId
    if (row !== undefined) {
      templateId = String(row.templateId)
    } else if (freshCreateHintAdmits(bindPath) && templateIdHint !== undefined && templateIdHint !== '') {
      // The fresh-create window ONLY: the row commits AFTER this setup runs.
      // P0-1 §3.4: the hint is NOT an authorization fallback for a cold
      // resume or a request boundary — the durable identity must exist there
      // (a cold-member / request-boundary missing its row fails closed).
      templateId = String(templateIdHint)
    } else if (instanceId !== undefined) {
      const byId = members.find((member) => String(member.instanceId) === instanceId)
      if (byId !== undefined) templateId = String(byId.templateId)
    }
    if (templateId === undefined) {
      throw unresolved(sessionId, {
        reason: 'template-id-missing',
        ...(instanceId !== undefined ? { instanceId } : {}),
      })
    }
    const template = blueprint.members.find((entry) => String(entry.templateId) === templateId)
    if (template === undefined) {
      throw unresolved(sessionId, {
        reason: 'template-not-found',
        ...(instanceId !== undefined ? { instanceId } : {}),
        templateId,
      })
    }
    return template
  }

  /**
   * The static template capabilities of one session (alpha.1) — the thin
   * projection of {@link locateTemplate} through `staticCapabilitiesOf`.
   * The projection deliberately does NOT surface `capabilities.permissions`
   * (FACT 3a: alpha.1 pins its exact shape — t1/t2/t3); alpha.2 reads the
   * permission policy directly off the located template in the shared
   * setup (one locate, both projections).
   */
  function resolveStaticCapabilities(sessionId, instanceId, templateIdHint, teamRootSid, bindPath) {
    // BP-F (issue #2 blueprint-loading, plan §11.2): the static-capabilities
    // projection rides the SAME per-root bound blueprint locateTemplate just
    // resolved (the per-root cache returns the identical parsed snapshot).
    const blueprint = getBoundBlueprint(teamRootSid !== undefined ? String(teamRootSid) : rootSid)
    return staticCapabilitiesOf(
      blueprint,
      locateTemplate(sessionId, instanceId, templateIdHint, teamRootSid, bindPath),
    )
  }


  /**
   * The typed fail-closed refusal. It is local to this module on purpose: the code
   * (`capability-template-unresolved`) is read by the setup's rollback, so it must not be reconstructed
   * anywhere else with a slightly different shape.
   */
  function unresolved(sessionId, details) {
    const reason = String(details.reason)
    const parts = [`reason=${reason}`]
    if (details.instanceId !== undefined) parts.push(`instanceId=${details.instanceId}`)
    if (details.templateId !== undefined) parts.push(`templateId=${details.templateId}`)
    const error = new Error(`template-binding: capability template unresolved for '${sessionId}' (${parts.join(' ')}) (code: capability-template-unresolved)`)
    error.code = 'capability-template-unresolved'
    error.reason = reason
    if (details.instanceId !== undefined) error.instanceId = String(details.instanceId)
    if (details.templateId !== undefined) error.templateId = String(details.templateId)
    observe(`p6t6: capability-template-unresolved for ${sessionId}: ${reason}`)
    return error
  }


  return { getBoundBlueprint, locateTemplate, resolveStaticCapabilities }
}
