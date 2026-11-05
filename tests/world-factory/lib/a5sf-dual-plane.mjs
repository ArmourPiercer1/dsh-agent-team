/**
 * a5sf-dual-plane.mjs — BL-33 / P4-05A: the DUAL-PLANE CASE SPACE, the legacy
 * (Alpha.4 / alpha.2) plane adapter, the named-exception registry and the
 * three-way comparator.
 *
 * WHAT PROBLEM THIS SOLVES. For ONE tool call, three answers must line up:
 *
 *   plane 1 — the PRE-Alpha.5 permission plane's static decision for the same
 *             authored call. This module calls the SHIPPED module
 *             `packages/runtime/operation-permission/permission-resolver.ts`
 *             (`resolveOperationPermission`) over the SHIPPED
 *             `canonicalizeOperation`, which is the only per-(tool, resource)
 *             allow/ask/deny decision that predates Alpha.5. It is NOT a
 *             re-implementation: only its documented A5 input normalization
 *             (canonical keys + the `containsOperation` boolean) is supplied
 *             here, exactly as that module's header says its adapter must.
 *   plane 2 — the decision the confined Provider REALLY made at admission,
 *             observed as an `a5sf-guard-consult/1` fact (`decidedBy`, the
 *             realm the lane came from, the locator, the method). The suite
 *             mounts the REAL product realm and calls the REAL Provider; this
 *             module does not produce that fact.
 *   plane 3 — an INDEPENDENT derivation from the declared ceilings /
 *             restrictions (`a5sf-dual-plane-oracle.mjs`), which imports
 *             neither plane.
 *
 * THE COMPARATOR's vocabulary is closed and deliberately loud:
 *
 *   AGREE      all three decisions are the same word.
 *   EXCEPTION  the three differ in EXACTLY the way a NAMED, CITED exception
 *              declares — and the case opted into that exception id. A triple
 *              that happens to match an exception the case did not declare is
 *              a DISAGREE, never an excuse.
 *   DISAGREE   anything else. The result names which two planes agree and which
 *              one is the outlier, so "two out of three" can never be read as
 *              "the comparison passed".
 *
 * WHY PLANE 1 IS FED THE TOOL-LEVEL LANE. The pre-Alpha.5 plane has no notion
 * of a Member ceiling and no notion of a realm: it decides one tool call against
 * the tool's authored rules. The Member ceiling is an Alpha.5 hard upper bound
 * enforced by the admission plane. Therefore plane 1 is given the authored
 * TOOL rule (the binding restriction when the product declares one for that
 * tool, else the ceiling), and the two places where that structural difference
 * shows up are the two named exceptions below — not silent mismatches.
 *
 * @module tests/world-factory/lib/a5sf-dual-plane
 */

import { realpathSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { canonicalizeOperation } from '../../../packages/runtime/operation-permission/canonical-operation.ts'
import { resolveOperationPermission } from '../../../packages/runtime/operation-permission/permission-resolver.ts'

/** Closed verdict vocabulary of {@link compareThreeWay}. */
export const THREE_WAY_VERDICTS = Object.freeze(['AGREE', 'EXCEPTION', 'DISAGREE'])

/**
 * THE NAMED EXCEPTIONS. Each one is a structural difference between the planes,
 * cites its authority, and declares the ONLY decision triple it may excuse.
 */
export const EXCEPTIONS = Object.freeze({
  'EX-1-CEILING-OUTRANKS-TOOL-ADMISSION': Object.freeze({
    id: 'EX-1-CEILING-OUTRANKS-TOOL-ADMISSION',
    summary:
      'The pre-Alpha.5 tool rule permits a locator the Member ceiling excludes; the ceiling refuses the call.',
    planes: Object.freeze({ plane1: 'allow', plane2: 'deny', plane3: 'deny' }),
    decidedBy: Object.freeze(['IO_READ_DENIED', 'IO_WRITE_DENIED']),
    axes: Object.freeze(['read', 'write']),
    realms: Object.freeze(['binding']),
    citation:
      'docs/plans/memo/alpha5-sandbox-first-20261101/ADR.md A5-GENERIC-02 ("工具调用审批不扩大这两个硬上界");'
      + ' ARCHITECTURE.md "最终 EffectiveIo(member,tool,call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member,tool)";'
      + ' packages/runtime/member-io-policy/src/compile.ts header ("nothing here can widen a ceiling");'
      + ' tests/world-factory/a5sf-product-assembly.test.mjs PA3 (the intersection, both directions).',
    reason:
      'Plane 1 answers "does the tool rule permit this operation"; the ceiling is an Alpha.5 hard upper bound enforced by'
      + ' the admission plane, so the legacy allow cannot become an effect. The case is listed as "restriction wider than'
      + ' ceiling": the product does NOT refuse such a restriction at assembly (it is intersected), and this is the call-time'
      + ' refusal that follows. The OTHER reading (a DECLARED ceiling wider than the bound blueprint) IS an assembly refusal'
      + ' — `REALM_DECLARATION_EXCEEDS_BLUEPRINT`, exercised separately by the C1 suite.',
  }),
  'EX-2-ADMISSION-READ-BEFORE-WRITE': Object.freeze({
    id: 'EX-2-ADMISSION-READ-BEFORE-WRITE',
    summary:
      'An existing-target write is refused because the SAME realm\'s read lane does not cover it, although the write lane does.',
    planes: Object.freeze({ plane1: 'allow', plane2: 'deny', plane3: 'deny' }),
    decidedBy: Object.freeze(['IO_WRITE_REQUIRES_READ']),
    axes: Object.freeze(['write']),
    realms: Object.freeze(['member']),
    citation:
      'packages/runtime/team-services/src/fs.ts header and guard body ("write ⇒ read, the native read-then-write contract",'
      + ' `IO_WRITE_REQUIRES_READ`); dev/agent-workflow/evidence/a5sf-preflight/README.md §12.8.2 and the 2026-11-04 RULING'
      + ' §12.8.3 ("write does not imply read; the native tool\'s own contract is what keeps a blind overwrite from landing"'
      + ' — kept, no algebra change).',
    reason:
      'The legacy permission plane has no read-before-write coupling: it decides the write tool against the write rule.'
      + ' The admission plane additionally enforces the native write/edit read prerequisite on an EXISTING target. The oracle'
      + ' models that admission step explicitly (its S4) because it is part of the admission contract the Provider documents,'
      + ' not a declared lane; the C1 suite mutates S4 away to prove the oracle step is load-bearing.',
  }),
  'EX-3-TOOL-ASK-DROPPED-BY-INTERSECTION': Object.freeze({
    id: 'EX-3-TOOL-ASK-DROPPED-BY-INTERSECTION',
    summary:
      'An ask locator the effective lane does not otherwise permit is DROPPED by the intersection, so the admission plane denies '
      + 'while the legacy tool rule asks.',
    planes: Object.freeze({ plane1: 'ask', plane2: 'deny', plane3: 'deny' }),
    decidedBy: Object.freeze(['IO_READ_DENIED', 'IO_WRITE_DENIED']),
    axes: Object.freeze(['read', 'write']),
    realms: Object.freeze(['binding']),
    citation:
      'packages/runtime/member-io-policy/src/path-rules.ts `intersectPathRuleSets` header ("ask is the STRICTER disposition: an ask '
      + 'survives if the OTHER lane permits that location, and it is never promoted to allow"); '
      + 'packages/runtime/member-io-policy/src/compile.ts "EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction".',
    reason:
      'The compiled effective lane is the intersection, and the intersection KEEPS an ask only where the permission side still allows '
      + 'it. Plane 1 is handed the authored tool rule alone and answers ask. This is the FAIL-CLOSED direction (deny, not allow): it '
      + 'cannot widen anything, but it does mean an author-declared ask for a location outside the allow subtree is never offered as an '
      + 'approval. The over-permit direction of the same gap (the ask INSIDE the allow) was the open A5-DUAL-PLANE-01 divergence; '
      + '2026-11-05 admission now refuses it with `IO_ASK_REQUIRES_APPROVAL`, so that direction is no longer an open DISAGREE. '
      + 'This exception is unchanged: the ask is GONE from the compiled lane here, so the refusal is the ordinary deny.',
  }),
})

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/** One lane in the internal (case-space) vocabulary. */
export function lane(allow = [], ask = [], deny = []) {
  return { mode: 'restricted', allow: [...allow], ask: [...ask], deny: [...deny] }
}

/** One `mode: all` lane (v4's all-form carries only a deny list). */
export function allLane(deny = []) {
  return { mode: 'all', allow: [], ask: [], deny: [...deny] }
}

/**
 * Project one internal lane into the v4 `memberIoCeilings[].io` lane grammar
 * the product declaration accepts: `all` keeps only `deny`; `restricted`
 * keeps all three lists. `$B` placeholders are substituted by the caller.
 */
export function laneToV4(value) {
  if (value.mode === 'all') return { mode: 'all', deny: [...value.deny] }
  return { mode: 'restricted', allow: [...value.allow], ask: [...value.ask], deny: [...value.deny] }
}

/** Replace the `$B` fixture-root placeholder everywhere inside one case. */
export function materializeCase(spec, base) {
  const sub = (value) => (typeof value === 'string' ? value.replaceAll('$B', base) : value)
  const subLane = (value) => ({
    mode: value.mode,
    allow: value.allow.map(sub),
    ask: value.ask.map(sub),
    deny: value.deny.map(sub),
  })
  const ceiling = { read: subLane(spec.ceiling.read), write: subLane(spec.ceiling.write) }
  const restriction = spec.restriction === undefined
    ? undefined
    : { tool: spec.restriction.tool, read: subLane(spec.restriction.read), write: subLane(spec.restriction.write) }
  const materialized = { ...spec, ceiling, target: sub(spec.target), ...(restriction === undefined ? {} : { restriction }) }
  if (realm(spec) === 'binding') {
    if (restriction === undefined || restriction.tool !== spec.axis) {
      throw new Error(`a5sf dual-plane case '${spec.id}': a binding realm needs a restriction for the CALLED tool '${spec.axis}'`)
    }
    if (!isPlainObject(restriction.read) || !isPlainObject(restriction.write)) {
      throw new Error(`a5sf dual-plane case '${spec.id}': the declared restriction needs both lanes`)
    }
  }
  // `any` = the whole tool. It is only meaningful where the authored TOOL rule is
  // a mode-all lane (the lane plane 1 is given); v4 itself forbids an ask list
  // under mode 'all', so there is no `any` + ask case by construction.
  const plane1Lane = restriction !== undefined && restriction.tool === spec.axis ? restriction[spec.axis] : ceiling[spec.axis]
  if (spec.resourceKind === 'any' && plane1Lane.mode !== 'all') {
    throw new Error(`a5sf dual-plane case '${spec.id}': resourceKind 'any' needs a mode-all TOOL lane (v4 cannot ask under all)`)
  }
  return materialized
}

const realm = (spec) => spec.realm

// ---------------------------------------------------------------------------
// Plane 1 — the SHIPPED pre-Alpha.5 permission plane (adapter half only)
// ---------------------------------------------------------------------------

/** Resolve one authored locator to the canonical key the legacy plane compares. */
function canonicalKeyOf(path, forWrite) {
  try {
    return realpathSync(path)
  } catch (error) {
    if (forWrite && error?.code === 'ENOENT') {
      return join(realpathSync(dirname(path)), basename(path))
    }
    throw error
  }
}

/**
 * Build the legacy `TemplatePermissionPolicy` for one case from the AUTHORED
 * tool rules. The call's tool is decided by its tool-level lane: the declared
 * binding restriction when one exists for that tool (the binding realm case),
 * otherwise the declared ceiling (the Member-realm case). The other tool's
 * rules are carried too, so the policy is a normal template policy and not a
 * one-rule fixture.
 *
 * `resourceKind` controls how ONE allow locator becomes a legacy rule:
 *   - `subtree` → `{kind:'subtree'}` (containment computed by the A5 seam);
 *   - `exact`   → `{kind:'exact'}` (canonical file key equality);
 *   - `any`     → one `{kind:'any'}` rule, i.e. the whole tool (a mode-all lane).
 * Ask/deny rules are always subtree rules (they are authored as path subtrees in
 * every case; v4 forbids an ask list under a mode-all lane).
 */
export function legacyPermissionPolicy(materialized) {
  const { ceiling, restriction, resourceKind } = materialized
  const toolLane = (tool) => (restriction !== undefined && restriction.tool === tool ? restriction[tool] : ceiling[tool])
  const policy = { default: 'deny', allow: [], ask: [], deny: [] }
  for (const tool of ['read', 'write']) {
    const declared = toolLane(tool)
    if (resourceKind === 'any' && tool === materialized.axis) {
      if (declared.mode !== 'all') throw new Error(`a5sf dual-plane: 'any' allow needs a mode-all lane for '${tool}'`)
      policy.allow.push({ tool, resource: { kind: 'any' } })
    } else {
      for (const path of declared.allow) policy.allow.push({ tool, resource: { kind: resourceKind, path } })
    }
    for (const path of declared.ask) policy.ask.push({ tool, resource: { kind: 'subtree', path } })
    for (const path of declared.deny) policy.deny.push({ tool, resource: { kind: 'subtree', path } })
  }
  return policy
}

/**
 * Canonicalize the legacy policy's rules for ONE decision, exactly as the A5
 * adapter documented by `permission-resolver.ts` must: an `exact` path becomes
 * its canonical key; a `subtree` rule carries its root key AND the
 * operation-relative containment boolean computed over the PUBLIC Provider
 * `contains` seam (not by this module).
 *
 * @param {object} input
 * @param {object} input.policy the `TemplatePermissionPolicy`
 * @param {string} input.tool the decided tool (`read` | `write`)
 * @param {string} input.operationKey the operation's canonical key
 * @param {(parent: string, child: string) => boolean} input.contains the Provider's containment seam
 * @param {'read'|'write'} input.axis the axis (write targets may not exist yet)
 */
function canonicalRulesOf({ policy, tool, operationKey, contains, axis }) {
  const convert = (rules) => rules
    .filter((rule) => rule.tool === tool)
    .map((rule) => {
      if (rule.resource.kind === 'any') return { tool: rule.tool, resource: { kind: 'any' } }
      const rootKey = canonicalKeyOf(rule.resource.path, axis === 'write')
      if (rule.resource.kind === 'exact') return { tool: rule.tool, resource: { kind: 'exact', key: rootKey } }
      return {
        tool: rule.tool,
        resource: { kind: 'subtree', rootKey, containsOperation: contains(rootKey, operationKey) === true },
      }
    })
  return { allow: convert(policy.allow), ask: convert(policy.ask), deny: convert(policy.deny) }
}

/**
 * Run the REAL pre-Alpha.5 plane for one case.
 *
 * @param {object} input
 * @param {object} input.materialized one materialized case
 * @param {(parent: string, child: string) => boolean} input.contains the base Provider's `contains` seam
 * @param {object} [input.policySource] TEST-ONLY mutation hook: build plane 1's
 *   POLICY from this case instead of `materialized` while the OPERATION stays the
 *   real call. One control uses it to drop a deny rule from plane 1 alone.
 * @returns {Promise<{decision: 'allow'|'ask'|'deny', provenance: object, operation: object|null, failClosed?: string}>}
 */
export async function decideLegacy({ materialized, contains, policySource = materialized }) {
  const { axis, target, resourceKind } = materialized
  const tool = axis === 'read' ? 'read' : 'write'
  const policy = legacyPermissionPolicy(policySource)

  // The A5 adapter fails closed on a canonicalization failure (the module header
  // says a rejection "means the resource cannot be resolved" and the adapter
  // maps that to deny). A dangling symlink is exactly that input.
  let operation
  try {
    operation = await canonicalizeOperation({
      name: tool,
      arguments: axis === 'write' ? { file_path: target, content: 'a5sf-bl33-plane1' } : { file_path: target },
      resolveTarget: async (path) => ({ key: canonicalKeyOf(path, axis === 'write'), display: path }),
    })
  } catch (error) {
    return {
      decision: 'deny',
      provenance: { source: 'adapter', effect: 'deny', reason: 'canonicalization-failed' },
      operation: null,
      failClosed: error instanceof Error ? error.message : String(error),
    }
  }
  const canonicalRules = canonicalRulesOf({ policy, tool, operationKey: operation.resource.key, contains, axis })
  const decision = resolveOperationPermission(policy, operation, canonicalRules)
  return { decision: decision.decision, provenance: decision.provenance, operation, resourceKind, policy }
}

// ---------------------------------------------------------------------------
// The comparator
// ---------------------------------------------------------------------------

/** Which plane is the outlier (only two of three agree by definition here). */
function outlierOf(decisions) {
  const { plane1, plane2, plane3 } = decisions
  if (plane1 === plane2 && plane2 === plane3) return null
  if (plane1 === plane2) return 'plane3'
  if (plane2 === plane3) return 'plane1'
  if (plane1 === plane3) return 'plane2'
  return 'all-three-differ'
}

function exceptionMatches(exception, decisions, consulted, { axis, realm: realmName }) {
  if (!exception.axes.includes(axis) || !exception.realms.includes(realmName)) return false
  if (decisions.plane1 !== exception.planes.plane1) return false
  if (decisions.plane2 !== exception.planes.plane2) return false
  if (decisions.plane3 !== exception.planes.plane3) return false
  if (exception.decidedBy !== undefined && !exception.decidedBy.includes(consulted.decidedBy)) return false
  return true
}

/**
 * Compare ONE call's three decisions.
 *
 * `exceptionIds` is the case's own declaration of which structural differences
 * it expects. A triple that matches an exception id the case did NOT declare is
 * a DISAGREE: the registry is not a blanket amnesty.
 *
 * @param {object} input
 * @param {{decision: string}} input.legacy plane 1
 * @param {{decision: string, decidedBy: string}} input.consulted plane 2 (the observed fact)
 * @param {{decision: string}} input.oracle plane 3
 * @param {readonly string[]} [input.exceptionIds] named exceptions this case declares
 * @param {'read'|'write'} input.axis
 * @param {'member'|'binding'} input.realm
 */
export function compareThreeWay({ legacy, consulted, oracle, exceptionIds = [], axis, realm }) {
  const decisions = { plane1: legacy.decision, plane2: consulted.decision, plane3: oracle.decision }
  if (decisions.plane1 === decisions.plane2 && decisions.plane2 === decisions.plane3) {
    return { verdict: 'AGREE', decisions, exception: null, mismatch: null }
  }
  for (const id of exceptionIds) {
    const exception = EXCEPTIONS[id]
    if (exception === undefined) throw new Error(`a5sf dual-plane: unknown exception id '${id}'`)
    if (exceptionMatches(exception, decisions, consulted, { axis, realm })) {
      return {
        verdict: 'EXCEPTION',
        decisions,
        exception: { id, citation: exception.citation, summary: exception.summary },
        mismatch: null,
      }
    }
  }
  return {
    verdict: 'DISAGREE',
    decisions,
    exception: null,
    mismatch: outlierOf(decisions),
    declaredExceptions: [...exceptionIds],
  }
}

/**
 * Summarize the whole run. `overall` is the answer to the P4-05A claim:
 *   ALIGNED_WITH_CITED_EXCEPTIONS  every case agreed, or diverged exactly as a
 *                                  cited exception declared (and every declared
 *                                  exception was observed at least once);
 *   REFUTED                        at least one DISAGREE — two planes may agree,
 *                                  but the claim "all three align" does not hold;
 *   INCOMPLETE                     no disagreement, but a declared exception was
 *                                  never exercised (the run proves less than it
 *                                  says it does).
 */
export function summarize(results) {
  const verdicts = { AGREE: 0, EXCEPTION: 0, DISAGREE: 0 }
  const byOutcome = { allow: 0, ask: 0, deny: 0 }
  const exceptionCounts = {}
  const declared = new Set()
  const disagreements = []
  const exceptions = []
  for (const result of results) {
    verdicts[result.comparison.verdict] += 1
    // Count by the ADMITTED outcome (plane 2). A case whose planes disagree is
    // still counted under what the product actually did.
    byOutcome[result.consulted.decision] += 1
    for (const id of result.exceptionIds) declared.add(id)
    if (result.comparison.verdict === 'EXCEPTION') {
      const id = result.comparison.exception.id
      exceptionCounts[id] = (exceptionCounts[id] ?? 0) + 1
      exceptions.push({ id: result.id, exception: id })
    }
    if (result.comparison.verdict === 'DISAGREE') {
      disagreements.push({
        id: result.id,
        decisions: result.comparison.decisions,
        mismatch: result.comparison.mismatch,
        decidedBy: result.consulted.decidedBy,
        realm: result.consulted.realm,
      })
    }
  }
  const unexercisedExceptions = [...declared].filter((id) => exceptionCounts[id] === undefined)
  const overall = verdicts.DISAGREE > 0
    ? 'REFUTED'
    : unexercisedExceptions.length > 0
      ? 'INCOMPLETE'
      : 'ALIGNED_WITH_CITED_EXCEPTIONS'
  return { total: results.length, verdicts, byOutcome, exceptionCounts, exceptions, disagreements, unexercisedExceptions, overall }
}

/** Render the evidence README's three-way table from a run summary. */
export function renderTable(summary) {
  const lines = [
    `| verdict | count |`,
    `| --- | --- |`,
    `| AGREE | ${summary.verdicts.AGREE} |`,
    `| EXCEPTION | ${summary.verdicts.EXCEPTION} |`,
    `| DISAGREE | ${summary.verdicts.DISAGREE} |`,
    `| **total** | **${summary.total}** |`,
    ``,
    `| admitted outcome (plane 2) | count |`,
    `| --- | --- |`,
    `| allow | ${summary.byOutcome.allow} |`,
    `| ask | ${summary.byOutcome.ask} |`,
    `| deny | ${summary.byOutcome.deny} |`,
  ]
  if (Object.keys(summary.exceptionCounts).length > 0) {
    lines.push('', '| exception | count |', '| --- | --- |')
    for (const [id, count] of Object.entries(summary.exceptionCounts)) lines.push(`| ${id} | ${count} |`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// THE CASE SPACE
// ---------------------------------------------------------------------------
//
// One case = one tool call. `$B` is the per-case fixture root. The call's realm
// decides which lanes the admission plane enforces; the case's `expect` is the
// reviewed expected triple, and the suite fails if the observed triple differs.

const rd = lane
const all = allLane
const inLane = '$B/lane'
const inside = '$B/lane/inside'
const outside = '$B/outside'

/** Shared ceiling for a member/binding READ case over `lane/` with explicit deny. */
const READ_CEILING = () => ({ read: rd([inLane], [], ['$B/lane/blocked']), write: rd([inLane]) })
const WRITE_CEILING = () => ({ read: rd([inLane]), write: rd([inLane]) })

/**
 * `@type {ReadonlyArray<object>}` — the case space. Every field is authored:
 * the Alpha.5 ceiling/restriction AND the expected triple.
 */
export const DUAL_PLANE_CASES = Object.freeze([
  // --- READ × binding realm (the tool restriction narrows the ceiling) ------
  {
    id: 'read-binding-subtree-allow-in-lane',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/lane/inside/ok.txt',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'inside ceiling and restriction; read through the binding realm',
  },
  {
    id: 'read-binding-subtree-deny-outside-restriction',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/lane/other/other.txt',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'inside the ceiling, outside the tool restriction — the restriction binds',
  },
  {
    id: 'read-binding-subtree-deny-outside-ceiling',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: { read: rd([inside]), write: all() },
    restriction: { tool: 'read', read: rd([inLane]), write: all() },
    target: '$B/lane/other/other.txt',
    expect: { plane1: 'allow', plane2: 'deny', plane3: 'deny', verdict: 'EXCEPTION', exception: 'EX-1-CEILING-OUTRANKS-TOOL-ADMISSION' },
    note: 'restriction wider than ceiling locally: the legacy tool rule allows, the ceiling refuses',
  },
  {
    id: 'read-binding-mode-all-deny-outside-ceiling',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'any',
    ceiling: { read: rd([inside]), write: all() },
    restriction: { tool: 'read', read: all(), write: all() },
    target: '$B/lane/other/other.txt',
    expect: { plane1: 'allow', plane2: 'deny', plane3: 'deny', verdict: 'EXCEPTION', exception: 'EX-1-CEILING-OUTRANKS-TOOL-ADMISSION' },
    note: '`any` (mode-all) tool restriction wider than the ceiling; the ceiling refuses',
  },
  {
    id: 'read-binding-subtree-deny-explicit',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inLane], [], ['$B/lane/blocked']), write: all() },
    target: '$B/lane/blocked/deny.txt',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'explicit deny subtree wins in both planes',
  },
  {
    id: 'read-binding-subtree-ask-under-allow',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: { read: rd([inLane], ['$B/lane/inside/ask.txt']), write: all() },
    restriction: { tool: 'read', read: rd([inLane], ['$B/lane/inside/ask.txt']), write: all() },
    target: '$B/lane/inside/ask.txt',
    // A5-DUAL-PLANE-01 (2026-11-05): was `ask/allow/ask` DISAGREE — the guarded
    // provider used to auto-approve this. Admission now refuses the ask with
    // IO_ASK_REQUIRES_APPROVAL, and the fact reports the ASK lane it decided on.
    expect: { plane1: 'ask', plane2: 'ask', plane3: 'ask', verdict: 'AGREE' },
    note: 'authored ask INSIDE an allow subtree: refused at admission (IO_ASK_REQUIRES_APPROVAL) because no approval consumer exists',
  },
  {
    id: 'read-binding-subtree-allow-symlink-into-ask',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: { read: rd([inLane], ['$B/lane/inside/ask.txt']), write: all() },
    restriction: { tool: 'read', read: rd([inLane], ['$B/lane/inside/ask.txt']), write: all() },
    target: '$B/lane/inside/link-ask',
    // A5-DUAL-PLANE-01: the alias is decided on the RESOLVED identity, so the
    // ask is seen even though the authored name is a plain allow.
    expect: { plane1: 'ask', plane2: 'ask', plane3: 'ask', verdict: 'AGREE' },
    note: 'the ask locator is reached through an in-lane SYMLINK: the resolved identity is ask-covered, so admission refuses the alias',
  },
  {
    id: 'read-binding-subtree-ask-narrower-subtree',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: { read: rd([inLane], ['$B/lane/inside/askdir']), write: all() },
    restriction: { tool: 'read', read: rd([inLane], ['$B/lane/inside/askdir']), write: all() },
    target: '$B/lane/inside/askdir/deep/ask.txt',
    // A5-DUAL-PLANE-01 shape: the ask is a SUBTREE narrower than the allow, not
    // one exact file, and the target is a DESCENDANT of it.
    expect: { plane1: 'ask', plane2: 'ask', plane3: 'ask', verdict: 'AGREE' },
    note: 'ask declared on a NARROWER subtree: a descendant target is ask-covered in all three planes and refused at admission',
  },
  {
    id: 'read-binding-subtree-ask-unrelated-locator',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: { read: rd([inLane], ['$B/lane/other/other.txt']), write: all() },
    restriction: { tool: 'read', read: rd([inLane], ['$B/lane/other/other.txt']), write: all() },
    target: '$B/lane/inside/ok.txt',
    // The ask survives the intersection (it is inside the allow subtree), yet it
    // does not COVER the called locator: it must therefore affect nothing.
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'an ask rule that covers NO part of the call: the lane keeps it, the call is still an ordinary allow',
  },
  {
    id: 'read-binding-subtree-ask-only',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: { read: rd([inside], ['$B/lane/other']), write: all() },
    restriction: { tool: 'read', read: rd([inside], ['$B/lane/other']), write: all() },
    target: '$B/lane/other/other.txt',
    expect: { plane1: 'ask', plane2: 'deny', plane3: 'deny', verdict: 'EXCEPTION', exception: 'EX-3-TOOL-ASK-DROPPED-BY-INTERSECTION' },
    note: 'ask-only locator outside the allow: the intersection drops the ask (fail-closed deny) while the legacy tool rule asks',
  },
  {
    id: 'read-binding-subtree-allow-symlink-inside',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/lane/inside/link-in',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'leaf symlink that resolves INSIDE the lane is allowed (realpath in-lane)',
  },
  {
    id: 'read-binding-subtree-deny-symlink-parent',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/lane/escape/secret.txt',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'symlinked PARENT directory: authored in-lane, resolves outside — denied',
  },
  {
    id: 'read-binding-subtree-deny-symlink-leaf',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/lane/inside/leaf-out',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'leaf symlink resolving outside: denied by resolved identity',
  },
  {
    id: 'read-binding-subtree-deny-dangling-symlink',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/lane/inside/dangling',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'dangling leaf symlink: plane 1 fails closed on canonicalization, the guard refuses the link',
  },
  {
    id: 'read-binding-subtree-allow-hardlink',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/lane/inside/alias.txt',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'in-lane NAME of an out-of-lane inode: path-based law allows it (ADR D5, disclosed)',
  },
  {
    id: 'read-binding-subtree-deny-hardlink-alias',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/outside/secret.txt',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'the OUT-OF-LANE name of the same inode is denied: the decision is on the path',
  },
  {
    id: 'read-binding-subtree-deny-dotdot',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/lane/inside/../../outside/secret.txt',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: '`..` escape: authored containment passes, resolved identity leaves the lane',
  },
  {
    id: 'read-binding-subtree-allow-dotdot-inside',
    axis: 'read',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/lane/inside/../other/../inside/ok.txt',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: '`..` that still resolves inside: allowed (not a blanket `..` refusal)',
  },

  // --- READ × member realm (no tool restriction mounted) --------------------
  {
    id: 'read-member-subtree-allow-in-lane',
    axis: 'read',
    realm: 'member',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    target: '$B/lane/inside/ok.txt',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'no restriction declared: the Member realm enforces the ceiling only',
  },
  {
    id: 'read-member-subtree-deny-outside',
    axis: 'read',
    realm: 'member',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    target: '$B/outside/secret.txt',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'outside the ceiling',
  },
  {
    id: 'read-member-subtree-deny-explicit',
    axis: 'read',
    realm: 'member',
    resourceKind: 'subtree',
    ceiling: READ_CEILING(),
    target: '$B/lane/blocked/deny.txt',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'explicit deny subtree',
  },
  {
    id: 'read-member-subtree-ask-under-allow',
    axis: 'read',
    realm: 'member',
    resourceKind: 'subtree',
    ceiling: { read: rd([inLane], ['$B/lane/inside/ask.txt']), write: all() },
    target: '$B/lane/inside/ask.txt',
    // A5-DUAL-PLANE-01 shape: the SAME ask must refuse in the Member realm too
    // (the ceiling realm compiles and admits through the SAME guard).
    expect: { plane1: 'ask', plane2: 'ask', plane3: 'ask', verdict: 'AGREE' },
    note: 'ask inside an allow subtree in the MEMBER realm (no tool restriction mounted): refused, same code as the binding realm',
  },
  {
    id: 'read-member-exact-allow',
    axis: 'read',
    realm: 'member',
    resourceKind: 'exact',
    ceiling: { read: rd(['$B/lane/inside/ok.txt']), write: all() },
    target: '$B/lane/inside/ok.txt',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: '`exact` legacy rule on the file itself; the Alpha.5 lane names the same file',
  },
  {
    id: 'read-member-exact-deny-sibling',
    axis: 'read',
    realm: 'member',
    resourceKind: 'exact',
    ceiling: { read: rd(['$B/lane/inside/ok.txt']), write: all() },
    target: '$B/lane/inside/ask.txt',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'exact addresses ONE file identity; a sibling is not covered by either plane',
  },
  {
    id: 'read-member-any-allow',
    axis: 'read',
    realm: 'member',
    resourceKind: 'any',
    ceiling: { read: all(), write: all() },
    target: '$B/outside/secret.txt',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: '`any` whole-tool allow (mode all)',
  },
  {
    id: 'read-member-any-deny',
    axis: 'read',
    realm: 'member',
    resourceKind: 'any',
    ceiling: { read: all(['$B/lane/blocked']), write: all() },
    target: '$B/lane/blocked/deny.txt',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: '`any` whole-tool allow with an explicit deny subtree: deny wins',
  },

  // --- WRITE × binding realm ------------------------------------------------
  {
    id: 'write-binding-subtree-allow-existing',
    axis: 'write',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: WRITE_CEILING(),
    restriction: { tool: 'write', read: all(), write: rd([inside]) },
    target: '$B/lane/inside/ok.txt',
    content: 'BL-33 write-binding allow\n',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'existing target: write lane allows and the read prerequisite passes',
  },
  {
    id: 'write-binding-subtree-deny-outside-restriction',
    axis: 'write',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: WRITE_CEILING(),
    restriction: { tool: 'write', read: all(), write: rd([inside]) },
    target: '$B/lane/other/other.txt',
    content: 'BL-33 write-binding deny\n',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'outside the write restriction, inside the ceiling',
  },
  {
    id: 'write-binding-subtree-allow-new-leaf',
    axis: 'write',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: WRITE_CEILING(),
    restriction: { tool: 'write', read: all(), write: rd([inside]) },
    target: '$B/lane/inside/new-leaf.txt',
    content: 'BL-33 new leaf\n',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'new leaf: no read-before-write prerequisite (nothing to read)',
  },
  {
    id: 'write-binding-mode-all-deny-outside-ceiling',
    axis: 'write',
    realm: 'binding',
    resourceKind: 'any',
    ceiling: { read: rd([inLane]), write: rd([inside]) },
    restriction: { tool: 'write', read: all(), write: all() },
    target: '$B/lane/other/other.txt',
    content: 'BL-33 write-binding ceiling deny\n',
    expect: { plane1: 'allow', plane2: 'deny', plane3: 'deny', verdict: 'EXCEPTION', exception: 'EX-1-CEILING-OUTRANKS-TOOL-ADMISSION' },
    note: '`any` write restriction wider than the ceiling; the ceiling refuses',
  },
  {
    id: 'write-binding-subtree-ask-under-allow',
    axis: 'write',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: { read: rd([inLane]), write: rd([inLane], ['$B/lane/inside/ask.txt']) },
    restriction: { tool: 'write', read: all(), write: rd([inLane], ['$B/lane/inside/ask.txt']) },
    target: '$B/lane/inside/ask.txt',
    content: 'BL-33 write ask under allow\n',
    // A5-DUAL-PLANE-01: was `ask/allow/ask` DISAGREE — the write used to land.
    // The refusal happens BEFORE the base Provider, so the disk keeps ASK\n.
    expect: { plane1: 'ask', plane2: 'ask', plane3: 'ask', verdict: 'AGREE' },
    note: 'authored ask inside an allow subtree on the write axis: refused at admission, zero writes, disk unchanged',
  },
  {
    id: 'write-binding-subtree-allow-symlink-into-ask',
    axis: 'write',
    realm: 'binding',
    resourceKind: 'subtree',
    ceiling: { read: rd([inLane]), write: rd([inLane], ['$B/lane/inside/ask.txt']) },
    restriction: { tool: 'write', read: all(), write: rd([inLane], ['$B/lane/inside/ask.txt']) },
    target: '$B/lane/inside/link-ask',
    content: 'BL-33 write ask via symlink\n',
    // A5-DUAL-PLANE-01: the WRITE axis reached through the in-lane symlink. The
    // authored name is a plain allow; the resolved identity is ask-covered, so
    // the refusal must be taken on the resolution, not on the authored string.
    expect: { plane1: 'ask', plane2: 'ask', plane3: 'ask', verdict: 'AGREE' },
    note: 'ask via an in-lane SYMLINK on the write axis: resolved identity is ask-covered, refusal before the write',
  },

  // --- WRITE × member realm -------------------------------------------------
  {
    id: 'write-member-subtree-allow-existing',
    axis: 'write',
    realm: 'member',
    resourceKind: 'subtree',
    ceiling: WRITE_CEILING(),
    target: '$B/lane/inside/ok.txt',
    content: 'BL-33 write-member allow\n',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'ceiling-only write with the read prerequisite satisfied by the ceiling read lane',
  },
  {
    id: 'write-member-subtree-ask-under-allow',
    axis: 'write',
    realm: 'member',
    resourceKind: 'subtree',
    // Both lanes allow the directory (so the read prerequisite, if it were
    // reached, would pass); only the WRITE lane asks for the target.
    ceiling: { read: rd([inLane]), write: rd([inLane], ['$B/lane/inside/ask.txt']) },
    target: '$B/lane/inside/ask.txt',
    content: 'BL-33 write-member ask\n',
    expect: { plane1: 'ask', plane2: 'ask', plane3: 'ask', verdict: 'AGREE' },
    note: 'ask inside an allow subtree on the write axis in the MEMBER realm: refused, zero writes, disk unchanged',
  },
  {
    id: 'write-member-subtree-deny-outside',
    axis: 'write',
    realm: 'member',
    resourceKind: 'subtree',
    ceiling: WRITE_CEILING(),
    target: '$B/outside/secret.txt',
    content: 'BL-33 write-member deny\n',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'outside the ceiling write lane',
  },
  {
    id: 'write-member-subtree-deny-read-prerequisite',
    axis: 'write',
    realm: 'member',
    resourceKind: 'subtree',
    ceiling: { read: rd([inside]), write: rd([inLane]) },
    target: '$B/lane/other/other.txt',
    content: 'BL-33 write-member read prerequisite\n',
    expect: { plane1: 'allow', plane2: 'deny', plane3: 'deny', verdict: 'EXCEPTION', exception: 'EX-2-ADMISSION-READ-BEFORE-WRITE' },
    note: 'inside the write lane, outside the SAME realm read lane: IO_WRITE_REQUIRES_READ',
  },
  {
    id: 'write-member-subtree-allow-while-binding-read-restricted',
    axis: 'write',
    realm: 'member',
    resourceKind: 'subtree',
    ceiling: WRITE_CEILING(),
    restriction: { tool: 'read', read: rd([inside]), write: all() },
    target: '$B/lane/other/other.txt',
    content: 'BL-33 ruling 2026-11-04\n',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'THE 2026-11-04 SHAPE: a read-only binding does not constrain a member-realm write (write bounded by the ceiling)',
  },
  {
    id: 'write-member-subtree-deny-symlink-parent',
    axis: 'write',
    realm: 'member',
    resourceKind: 'subtree',
    ceiling: WRITE_CEILING(),
    target: '$B/lane/escape/new-leaf.txt',
    content: 'BL-33 write through symlinked parent\n',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: 'new leaf under a symlinked parent that resolves outside: refused before create',
  },
  {
    id: 'write-member-subtree-allow-hardlink',
    axis: 'write',
    realm: 'member',
    resourceKind: 'subtree',
    ceiling: WRITE_CEILING(),
    target: '$B/lane/inside/alias.txt',
    content: 'BL-33 hardlink write\n',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'in-lane hardlink name: the write lands on the shared inode through the allowed name (disclosed)',
  },
  {
    id: 'write-member-exact-allow',
    axis: 'write',
    realm: 'member',
    resourceKind: 'exact',
    ceiling: { read: rd(['$B/lane/inside/ok.txt']), write: rd(['$B/lane/inside/ok.txt']) },
    target: '$B/lane/inside/ok.txt',
    content: 'BL-33 write exact\n',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: 'exact write rule on the file itself',
  },
  {
    id: 'write-member-any-allow',
    axis: 'write',
    realm: 'member',
    resourceKind: 'any',
    ceiling: { read: all(), write: all() },
    target: '$B/lane/other/other.txt',
    content: 'BL-33 write any\n',
    expect: { plane1: 'allow', plane2: 'allow', plane3: 'allow', verdict: 'AGREE' },
    note: '`any` whole-tool write allow (mode all)',
  },
  {
    id: 'write-member-any-deny',
    axis: 'write',
    realm: 'member',
    resourceKind: 'any',
    ceiling: { read: all(), write: all(['$B/lane/blocked']) },
    target: '$B/lane/blocked/deny.txt',
    content: 'BL-33 write any deny\n',
    expect: { plane1: 'deny', plane2: 'deny', plane3: 'deny', verdict: 'AGREE' },
    note: '`any` whole-tool write allow with an explicit deny subtree: deny wins',
  },
])

/** The exception ids each case declares (empty for ordinary cases). */
export function caseExceptionIds(spec) {
  return spec.expect.exception === undefined ? [] : [spec.expect.exception]
}
