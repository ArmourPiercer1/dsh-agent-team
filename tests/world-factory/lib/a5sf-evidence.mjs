/**
 * a5sf-evidence.mjs — R3 (BL-11): the per-invocation EVIDENCE RECORDER and the
 * same-call ALIGNMENT CHECK for the Alpha.5 Sandbox-First lane.
 *
 * WHAT THIS IS. One recorder that writes, for ONE managed call, JSONL rows an
 * independent observer can line up across four links:
 *
 *   | link | fact                                                             | producer (existing) |
 *   | ---- | ---------------------------------------------------------------- | ------------------- |
 *   | 1    | the Alpha.4 decision + durable consumption (`ControlOperationScope`) | `packages/runtime/control/service.ts:3240` `guardOperation` → `control-allow-consumed` (`packages/runtime/control/types.ts:1735` `ControlConsumptionRecord`) |
 *   | 2    | the compiled `MemberPolicy` + the per-call `EffectiveIo`           | `packages/runtime/member-io-policy/src/compile.ts:100` / `:189` (`compileEffectiveIo` is the ONE computation) |
 *   | 3    | the Provider actually consulted                                   | `packages/runtime/team-services/src/install.ts:260` `installToolBindingRealm` → `ToolBindingRealm` (`:242` identity + policyRevision) |
 *   | 4    | the independently observed effect                                 | `tests/world-factory/lib/oracle.mjs:47` `createOracle` via `tests/world-factory/lib/a5sf-harness.mjs:423` `judgeEffect` |
 *
 * WHY IT EXISTS. `scripts/a5sf-diag.mjs` (R4/BL-12) already answers "was this
 * allow a bypass?" over `ceiling`/`call`/`approval` rows — but at this base NO
 * lane emits them (`evidence/a5sf-r4/README.md` §6.1/§7.3). This module is the
 * producer. It is deliberately NOT a second diagnostics tool, a second policy
 * compiler, a second approval store or a second oracle: link 2 is the object
 * `compileEffectiveIo` returned, link 1 is the row the durable control plane
 * wrote, link 3 is the shipped installer's result, link 4 is the shipped
 * oracle's verdict — this file copies them into rows and never recomputes any
 * of them.
 *
 * THE RECORDER IS PASSIVE (asserted by the C1 suite's source fence). It:
 *   - never calls `compileMemberPolicy` / `compileEffectiveIo` / `matchLocator`
 *     / `resolveAskClassCall` / `createMemberFsGuard` / `guardOperation`;
 *   - never decides allow/ask/deny: `disposition` and `lane` are the LANE's own
 *     reported values (`resolveAskClassCall` step 3 computes `disposition` with
 *     the P1 algebra; the guard's outcome is `lane`) and are copied verbatim;
 *   - never mints an approval: it records a `ControlConsumptionRecord` it is
 *     handed, verbatim, and refuses anything that is not shaped like one;
 *   - never observes the effect itself: it records `judgeEffect()`'s result.
 * One computation = `compileEffectiveIo`; this file only cites its output.
 *
 * ROW SCHEMA (the interface `scripts/a5sf-diag.mjs` validates — read, not
 * guessed; see `dev/agent-workflow/evidence/a5sf-r4/README.md` §2):
 *
 *   {"kind":"ceiling","member","templateId","instanceGeneration","policyRevision",
 *    "tools":[{"tool","binding","read":{mode,allow,ask,deny},
 *              "write":{mode,allow,ask,deny},"network":{"access"}}]}
 *
 *   {"kind":"approval","requestId","decisionSequence","consumedAt",
 *    "scope":{rootSessionId,targetInstanceId,actionName?,toolName,
 *             capabilityDomain?,correlation,operationFingerprint?,subject?}}
 *
 *   {"kind":"call","callId","member","tool","axis","locator","lane",
 *    "instanceGeneration","policyRevision","toolBindingIdentity","disposition",
 *    "approvalRequestId"?,"logicalOperationId"?,"operationFingerprint"?,
 *    "actionName"?,"capabilityDomain"?,"provider":{…},"effect":{…}}
 *
 * ADDITIVE FIELDS, AND THE NAMED SCHEMA GAP. `a5sf-diag.mjs` validates a `call`
 * row on `callId`/`member`/`tool`/`locator`/`lane` and IGNORES unknown fields;
 * `ceiling` on `member`+`tools[]`; `approval` on `requestId`+integer
 * `decisionSequence`+`consumedAt`+`scope`. Three facts this chain needs have
 * NO slot in that contract: the compiled `instanceGeneration` (and
 * `policyRevision`), the Provider-consulted record, and the oracle effect. The
 * recorder therefore adds them as fields on the rows the tool already accepts
 * (`ceiling.instanceGeneration`/`policyRevision`, `call.instanceGeneration`/
 * `policyRevision`/`toolBindingIdentity`/`disposition`/`provider`/`effect`);
 * `a5sf-diag.mjs` validates those rows unchanged and its report is unaffected
 * (proved by the round-trip leg, which also asserts `ignored === 0`). It does
 * NOT invent a new `kind` — an unknown `kind` is silently counted as `ignored`
 * by the tool and would be invisible evidence, i.e. exactly the parallel
 * schema this lane refuses. The gap is filed in
 * `dev/agent-workflow/evidence/a5sf-r3/README.md` §6.
 *
 * ALIGNMENT CHECK. `alignEvidenceChain(rows)` groups the recorded rows by call
 * and requires the four links to carry ONE identity: member instance id,
 * instance generation, invocation/call id and logical operation (or its
 * canonical `operationFingerprint`). Fail closed:
 *
 *   CHAIN_ALIGNED                     every link present and every key two
 *                                     links both carry agrees
 *   CHAIN_BROKEN(reason, link)        a link is present but contradicts the
 *   (`link` ∈ approval|policy|provider|effect|call)   chain identity
 *   UNDECIDABLE(reason, link)         a link (or a key only one side can carry)
 *                                     is missing: absence of evidence is never
 *                                     "aligned"
 *
 * The approval-binding LAW is imported (`scripts/a5sf-diag.mjs#bindApproval`),
 * not restated; row SELECTION (a named `approvalRequestId`, else the first row
 * that authorizes) mirrors the tool's own selection so both readers name the
 * same durable fact. The generation key cannot be carried by the durable scope
 * (ControlOperationScope has no generation field — R1 evidence README §6.5):
 * `CHAIN_ALIGNED` names the keys each link did NOT carry in `unbound[]` instead
 * of pretending the chain proves them.
 *
 * CORE PATCH BUDGET = 0: no upstream tree, no Host boot, no port, no DSH_HOME,
 * no network. The module reads/writes only the JSONL path it is given.
 *
 * @module tests/world-factory/lib/a5sf-evidence
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { bindApproval, approvalAuthorizes } from '../../../scripts/a5sf-diag.mjs'

/** The row kinds `scripts/a5sf-diag.mjs` validates (no new kind is invented here). */
export const EVIDENCE_ROW_KINDS = Object.freeze(['ceiling', 'approval', 'call'])

/** The closed verdict vocabulary of {@link alignEvidenceChain}. */
export const CHAIN_VERDICTS = Object.freeze(['CHAIN_ALIGNED', 'CHAIN_BROKEN', 'UNDECIDABLE'])

/** The four links (+ the call row that carries them) a verdict names. */
export const CHAIN_LINKS = Object.freeze(['approval', 'policy', 'provider', 'effect', 'call'])

/**
 * Closed TRANSPORT-refusal vocabulary of this recorder (missing/malformed
 * EVIDENCE, never a permission decision and never a failure classification —
 * the PR #394 table stays the only classification vocabulary, R2 §5).
 */
export const A5SF_EVIDENCE_CODES = Object.freeze([
  /** no usable output path */
  'EVIDENCE_PATH_REQUIRED',
  /** not a compiled P1 `MemberPolicy` */
  'POLICY_REQUIRED',
  /** a tools[] entry is not a `compileEffectiveIo` result for this policy */
  'EFFECTIVE_MISMATCH',
  /** a second ceiling row for one member would poison the diag (DUPLICATE_CEILING_MEMBER) */
  'DUPLICATE_CEILING_MEMBER',
  /** two tools[] entries share a tool name but disagree (the diag keys tools by NAME) */
  'TOOL_ENTRY_CONFLICT',
  /** a ceiling needs at least one compiled tool entry */
  'CEILING_TOOLS_REQUIRED',
  /** the call's tool was not compiled into this member's ceiling */
  'TOOL_NOT_IN_CEILING',
  /** not a `ControlConsumptionRecord`-shaped durable row */
  'APPROVAL_ROW_INVALID',
  /** a second row for the same requestId contradicts R1 exactly-once */
  'DUPLICATE_CONSUMPTION_ROW',
  /** a call identity field is blank/absent/ill-typed */
  'CALL_ROW_INVALID',
  /** `disposition` is not the closed allow|ask|deny vocabulary */
  'DISPOSITION_INVALID',
  /** `lane` is not the closed allow|ask|deny vocabulary */
  'LANE_INVALID',
  /** `effective.invocationId` does not name this call */
  'INVOCATION_ID_MISMATCH',
  /** not a `ToolBindingRealm`-shaped install result (or a normalized provider fact) */
  'PROVIDER_RESULT_INVALID',
  /** `consulted` was not handed in: the recorder does not instrument the Provider */
  'PROVIDER_CONSULTED_MISSING',
  /** not a `judgeEffect()`/oracle result */
  'EFFECT_RESULT_INVALID',
])

export class A5sfEvidenceError extends Error {
  /**
   * @param {string} code one of {@link A5SF_EVIDENCE_CODES}
   * @param {string} detail human readable, never string-matched by callers
   * @param {object} [extra] structured detail (e.g. `{ field }`)
   */
  constructor(code, detail, extra = {}) {
    super(`a5sf evidence ${code}: ${detail}`)
    this.name = 'A5sfEvidenceError'
    this.code = code
    this.detail = detail
    Object.assign(this, extra)
  }
}

const isNonBlank = (value) => typeof value === 'string' && value.trim() !== ''
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

/** True iff `value` is the P1 `PathRuleSet` shape the diag's `validLane()` accepts. */
function isPathRuleSet(value) {
  return isPlainObject(value) &&
    (value.mode === 'all' || value.mode === 'restricted') &&
    Array.isArray(value.allow) && Array.isArray(value.ask) && Array.isArray(value.deny)
}

/** Copy one P1 `PathRuleSet` into plain JSON (arrays are copied, nothing is normalized). */
function laneCopy(lane) {
  return { mode: lane.mode, allow: [...lane.allow], ask: [...lane.ask], deny: [...lane.deny] }
}

/** Normalise one `ToolBindingRealm`-shaped install result into a JSON provider fact. */
function providerFactOf(provider, consulted) {
  const identity = provider?.identity
  const shaped = isPlainObject(identity) &&
    isNonBlank(identity.teamId) &&
    isNonBlank(identity.memberInstanceId) &&
    isNonBlank(identity.templateId) &&
    Number.isInteger(identity.instanceGeneration) &&
    isNonBlank(provider.toolBindingIdentity) &&
    isNonBlank(provider.policyRevision)
  if (shaped) {
    if (typeof consulted !== 'boolean') {
      throw new A5sfEvidenceError(
        'PROVIDER_CONSULTED_MISSING',
        "the install result does not say whether the Provider was consulted; pass { consulted: true|false } from the lane (this recorder does not instrument the Provider)",
        { field: 'consulted' },
      )
    }
    return {
      consulted,
      teamId: identity.teamId,
      memberInstanceId: identity.memberInstanceId,
      templateId: identity.templateId,
      instanceGeneration: identity.instanceGeneration,
      toolBindingIdentity: provider.toolBindingIdentity,
      policyRevision: provider.policyRevision,
    }
  }
  // An already-normalised fact (the mutation legs pass this shape): it must carry
  // the same identity fields, and `consulted` is mandatory.
  const fact = provider
  const factShaped = isPlainObject(fact) &&
    typeof fact.consulted === 'boolean' &&
    isNonBlank(fact.memberInstanceId) &&
    Number.isInteger(fact.instanceGeneration) &&
    isNonBlank(fact.toolBindingIdentity) &&
    isNonBlank(fact.policyRevision)
  if (!factShaped) {
    throw new A5sfEvidenceError(
      'PROVIDER_RESULT_INVALID',
      'a provider link must be the shipped installer\'s ToolBindingRealm result (identity{teamId,memberInstanceId,templateId,instanceGeneration} + toolBindingIdentity + policyRevision) or that fact normalized, with an explicit boolean `consulted`',
      { field: 'provider' },
    )
  }
  return {
    consulted: fact.consulted,
    teamId: fact.teamId ?? null,
    memberInstanceId: fact.memberInstanceId,
    templateId: fact.templateId ?? null,
    instanceGeneration: fact.instanceGeneration,
    toolBindingIdentity: fact.toolBindingIdentity,
    policyRevision: fact.policyRevision,
  }
}

/** Normalise one `judgeEffect()` result (or the same fact) into a JSON effect fact. */
function effectFactOf(effect) {
  if (!isPlainObject(effect)) {
    throw new A5sfEvidenceError('EFFECT_RESULT_INVALID', 'an effect link must be the `judgeEffect()` result (oracleId/tag/effect/basis)', { field: 'effect' })
  }
  // `judgeEffect()` returns { oracleId, tag, effect, basis, verdict, observation }.
  const oracleId = effect.oracleId
  const tag = effect.tag
  const observed = effect.effect
  if (!isNonBlank(oracleId) || !isNonBlank(tag) || typeof observed !== 'boolean') {
    throw new A5sfEvidenceError(
      'EFFECT_RESULT_INVALID',
      'the effect link needs the oracle id, the observation tag and the boolean oracle verdict (judgeEffect() hands them back unchanged)',
      { field: 'effect' },
    )
  }
  const basis = Array.isArray(effect.basis) ? effect.basis.filter((item) => typeof item === 'string') : []
  const observedAt = isNonBlank(effect.observation?.observedAt) ? effect.observation.observedAt : null
  return { oracleId, tag, effect: observed, basis, observedAt }
}

/**
 * Create the passive JSONL recorder.
 *
 * @param {object} opts
 * @param {string} opts.path JSONL file to append to (created, parents included)
 * @param {string} [opts.suite] tag only, never read back
 * @param {string} [opts.runId] tag only, never read back
 */
export function createEvidenceRecorder(opts = {}) {
  const { path, suite = null, runId = null } = opts
  if (!isNonBlank(path)) {
    throw new A5sfEvidenceError('EVIDENCE_PATH_REQUIRED', 'createEvidenceRecorder needs the JSONL path the run will be graded on', { field: 'path' })
  }
  const outputPath = resolve(path)
  mkdirSync(dirname(outputPath), { recursive: true })

  /** member → { policyRevision, instanceGeneration, tools: Map<tool, {binding, lanes}> } */
  const ceilings = new Map()
  /** requestId → true (R1 consumes an allow exactly once) */
  const consumedRequestIds = new Set()
  const appended = []

  function append(row) {
    appendFileSync(outputPath, `${JSON.stringify(row)}\n`, 'utf8')
    appended.push(row)
    return row
  }

  const recorder = {
    path: outputPath,
    suite,
    runId,

    /**
     * LINK 2 — record the compiled ceiling of ONE member.
     *
     * `policy` is the object `compileMemberPolicy` (via
     * `a5sf-harness.mjs#compileCeiling`) returned; every `tools[]` entry is the
     * `EffectiveIoPolicy` object `compileEffectiveIo` (via
     * `a5sf-harness.mjs#compileInvocation`) returned for that tool binding. The
     * recorder verifies the two belong together (member + revision) and copies
     * their lanes; it never projects, intersects or matches anything.
     *
     * @param {object} input
     * @param {object} input.policy the compiled P1 `MemberPolicy`
     * @param {Array<{tool: string, effective: object}>} input.tools one per tool the lane compiled
     */
    ceiling({ policy, tools } = {}) {
      if (!isPlainObject(policy) || !isNonBlank(policy.memberIdentity) || !isNonBlank(policy.revision) || !Number.isInteger(policy.instanceGeneration)) {
        throw new A5sfEvidenceError('POLICY_REQUIRED', 'ceiling() needs the compiled P1 MemberPolicy (memberIdentity, revision, instanceGeneration)', { field: 'policy' })
      }
      if (!Array.isArray(tools) || tools.length === 0) {
        throw new A5sfEvidenceError('CEILING_TOOLS_REQUIRED', 'ceiling() needs at least one compiled tool entry; an empty ceiling cannot decide any call', { field: 'tools' })
      }
      if (ceilings.has(policy.memberIdentity)) {
        // a5sf-diag treats a second ceiling row for one member as
        // DUPLICATE_CEILING_MEMBER and calls that member's allows UNDECIDABLE.
        // Refusing here is the same fail-closed law one step earlier: the
        // record must not be able to poison its own diagnostic.
        throw new A5sfEvidenceError(
          'DUPLICATE_CEILING_MEMBER',
          `a ceiling row for member '${policy.memberIdentity}' was already recorded; the diagnostic keys ceilings by MEMBER, so a second row makes every allow of that member UNDECIDABLE (a generation bump in one run cannot be recorded in one file — see the README gap)`,
          { field: 'policy.memberIdentity', member: policy.memberIdentity },
        )
      }
      const byTool = new Map()
      for (const entry of tools) {
        if (!isPlainObject(entry) || !isNonBlank(entry.tool) || !isPlainObject(entry.effective)) {
          throw new A5sfEvidenceError('EFFECTIVE_MISMATCH', 'every tools[] entry needs { tool, effective } with the compiled EffectiveIoPolicy', { field: 'tools' })
        }
        const effective = entry.effective
        if (effective.memberIdentity !== policy.memberIdentity || effective.policyRevision !== policy.revision) {
          throw new A5sfEvidenceError(
            'EFFECTIVE_MISMATCH',
            `tool '${entry.tool}' was compiled for member '${String(effective.memberIdentity)}' at revision '${String(effective.policyRevision)}', not for '${policy.memberIdentity}' at '${policy.revision}'; the two links must be the SAME computation`,
            { field: 'tools.effective' },
          )
        }
        if (!isNonBlank(effective.toolBindingIdentity) || !isPathRuleSet(effective.read) || !isPathRuleSet(effective.write)) {
          throw new A5sfEvidenceError('EFFECTIVE_MISMATCH', `tool '${entry.tool}' is not a compiled EffectiveIoPolicy (binding identity + read/write rule sets)`, { field: 'tools.effective' })
        }
        const existing = byTool.get(entry.tool)
        if (existing !== undefined) {
          const same = existing.binding === effective.toolBindingIdentity &&
            JSON.stringify(existing.lanes) === JSON.stringify({ read: laneCopy(effective.read), write: laneCopy(effective.write) })
          if (!same) {
            throw new A5sfEvidenceError(
              'TOOL_ENTRY_CONFLICT',
              `tool '${entry.tool}' appears twice with a different binding or lane; the diagnostic looks a tool up by NAME, so one of the two would be silently ignored`,
              { field: 'tools.tool', tool: entry.tool },
            )
          }
          continue
        }
        byTool.set(entry.tool, {
          binding: effective.toolBindingIdentity,
          lanes: { read: laneCopy(effective.read), write: laneCopy(effective.write) },
          network: isPlainObject(effective.network) && (effective.network.access === 'allow' || effective.network.access === 'deny')
            ? { access: effective.network.access }
            : null,
        })
      }
      ceilings.set(policy.memberIdentity, { policyRevision: policy.revision, instanceGeneration: policy.instanceGeneration, tools: byTool })
      return append({
        kind: 'ceiling',
        member: policy.memberIdentity,
        templateId: policy.templateId ?? null,
        instanceGeneration: policy.instanceGeneration,
        policyRevision: policy.revision,
        tools: [...byTool.entries()].map(([tool, entry]) => ({
          tool,
          binding: entry.binding,
          read: entry.lanes.read,
          write: entry.lanes.write,
          network: entry.network,
        })),
      })
    },

    /**
     * LINK 1 — record ONE durable consumption row, verbatim.
     *
     * The input is the `ControlConsumptionRecord` the real control plane wrote
     * (`control-allow-consumed`). This method never creates one, never fills a
     * field and never decides whether the row authorizes anything; the
     * alignment check binds it with the tool's own law
     * (`scripts/a5sf-diag.mjs#bindApproval`).
     */
    approval(consumption) {
      const shaped = isPlainObject(consumption) &&
        isNonBlank(consumption.requestId) &&
        Number.isInteger(consumption.decisionSequence) &&
        isNonBlank(consumption.consumedAt) &&
        isPlainObject(consumption.scope)
      if (!shaped) {
        throw new A5sfEvidenceError(
          'APPROVAL_ROW_INVALID',
          'approval() takes the durable ControlConsumptionRecord shape ({ requestId, decisionSequence, consumedAt, scope }); a malformed fact is not a consumption and is never repaired here',
          { field: 'consumption' },
        )
      }
      if (consumedRequestIds.has(consumption.requestId)) {
        throw new A5sfEvidenceError(
          'DUPLICATE_CONSUMPTION_ROW',
          `requestId '${consumption.requestId}' was already recorded; R1's shipped law consumes one allow exactly once`,
          { field: 'requestId', requestId: consumption.requestId },
        )
      }
      consumedRequestIds.add(consumption.requestId)
      return append({
        kind: 'approval',
        requestId: consumption.requestId,
        decisionSequence: consumption.decisionSequence,
        consumedAt: consumption.consumedAt,
        scope: consumption.scope,
      })
    },

    /**
     * LINKS 3+4 and the call row — record ONE decided call.
     *
     * Everything is what the lane reported: `policy`/`effective` are the
     * compiler's output objects, `disposition` is `matchLocator`'s answer on
     * the compiled lane (allow|ask|deny), `lane` is the lane's decided outcome,
     * `provider` is the shipped installer's result, `effect` is the shipped
     * oracle's verdict. No value is re-derived.
     */
    call(input = {}) {
      const {
        policy, effective, disposition, lane,
        callId, tool, axis, locator,
        actionName, capabilityDomain, logicalOperationId, operationFingerprint, approvalRequestId,
        provider, effect,
      } = input
      if (!isPlainObject(policy) || !isNonBlank(policy.memberIdentity) || !isNonBlank(policy.revision) || !Number.isInteger(policy.instanceGeneration)) {
        throw new A5sfEvidenceError('POLICY_REQUIRED', 'call() needs the compiled P1 MemberPolicy it was decided against', { field: 'policy' })
      }
      if (disposition !== 'allow' && disposition !== 'ask' && disposition !== 'deny') {
        throw new A5sfEvidenceError('DISPOSITION_INVALID', "disposition is the lane's `matchLocator` result and must be 'allow' | 'ask' | 'deny'", { field: 'disposition' })
      }
      if (lane !== 'allow' && lane !== 'ask' && lane !== 'deny') {
        throw new A5sfEvidenceError('LANE_INVALID', "lane is the decided outcome and must be 'allow' | 'ask' | 'deny'", { field: 'lane' })
      }
      if (![callId, tool, locator].every(isNonBlank) || (axis !== 'read' && axis !== 'write')) {
        throw new A5sfEvidenceError('CALL_ROW_INVALID', 'a call needs a non-blank callId/tool/locator and axis read|write (the diag validates exactly these)', { field: 'call' })
      }
      if (!isPlainObject(effective) ||
        effective.memberIdentity !== policy.memberIdentity ||
        effective.policyRevision !== policy.revision ||
        !isNonBlank(effective.toolBindingIdentity) ||
        !isPathRuleSet(effective.read) || !isPathRuleSet(effective.write)) {
        throw new A5sfEvidenceError('EFFECTIVE_MISMATCH', 'the call needs the compiled EffectiveIoPolicy of THIS member at THIS policy revision (the one compileEffectiveIo returned for the call)', { field: 'effective' })
      }
      if (effective.invocationId !== callId) {
        throw new A5sfEvidenceError(
          'INVOCATION_ID_MISMATCH',
          `the compiled EffectiveIoPolicy belongs to invocation '${String(effective.invocationId)}', not to call '${callId}'; the invocation id is the per-call identity this chain aligns on`,
          { field: 'effective.invocationId' },
        )
      }
      const ceiling = ceilings.get(policy.memberIdentity)
      if (ceiling === undefined) {
        throw new A5sfEvidenceError('TOOL_NOT_IN_CEILING', `no ceiling row was recorded for member '${policy.memberIdentity}'; record the compiled ceiling first (one row per member, before its first call)`, { field: 'policy.memberIdentity' })
      }
      if (!ceiling.tools.has(tool)) {
        throw new A5sfEvidenceError('TOOL_NOT_IN_CEILING', `tool '${tool}' was not compiled into member '${policy.memberIdentity}'s ceiling; the call cannot be aligned to a compiled lane`, { field: 'tool' })
      }
      const providerFact = providerFactOf(provider, input.consulted)
      const effectFact = effectFactOf(effect)
      return append({
        kind: 'call',
        callId,
        member: policy.memberIdentity,
        instanceGeneration: policy.instanceGeneration,
        policyRevision: policy.revision,
        tool,
        toolBindingIdentity: effective.toolBindingIdentity,
        axis,
        locator,
        lane,
        disposition,
        ...(isNonBlank(approvalRequestId) ? { approvalRequestId } : {}),
        ...(isNonBlank(logicalOperationId) ? { logicalOperationId } : {}),
        ...(isNonBlank(operationFingerprint) ? { operationFingerprint } : {}),
        ...(isNonBlank(actionName) ? { actionName } : {}),
        ...(isNonBlank(capabilityDomain) ? { capabilityDomain } : {}),
        provider: providerFact,
        effect: effectFact,
      })
    },

    /** The rows this recorder appended (in order) — for an in-process assertion. */
    rows() {
      return [...appended]
    },

    /** The JSONL text as written (for a round-trip assertion). */
    text() {
      return appended.map((row) => JSON.stringify(row)).join('\n') + (appended.length === 0 ? '' : '\n')
    },
  }
  return Object.freeze(recorder)
}

// --- the alignment check -----------------------------------------------------

const CALL_KEYS = Object.freeze(['callId', 'member', 'instanceGeneration', 'policyRevision', 'tool', 'axis', 'locator', 'lane', 'disposition'])

const broken = (callId, link, reason, detail = null) => ({ verdict: 'CHAIN_BROKEN', callId, link, reason, detail })
const undecidable = (callId, link, reason, detail = null) => ({ verdict: 'UNDECIDABLE', callId, link, reason, detail })

/** Index the recorded rows the way the diagnostic does (ceilings by member, approvals by requestId). */
export function indexEvidenceRows(rows) {
  const ceilings = new Map()
  const ambiguousCeilings = new Set()
  const approvals = new Map()
  const ambiguousApprovals = new Set()
  const calls = []
  const invalid = []
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isPlainObject(row)) { invalid.push({ row, reason: 'not a JSON object' }); continue }
    if (row.kind === 'ceiling') {
      if (!isNonBlank(row.member) || !Array.isArray(row.tools)) { invalid.push({ row, reason: 'ceiling needs member + tools[]' }); continue }
      if (ceilings.has(row.member)) { ambiguousCeilings.add(row.member); continue }
      ceilings.set(row.member, row)
    } else if (row.kind === 'approval') {
      if (!isNonBlank(row.requestId) || !isPlainObject(row.scope) || !isNonBlank(row.consumedAt) || !Number.isInteger(row.decisionSequence)) {
        invalid.push({ row, reason: 'approval needs requestId + decisionSequence (integer) + consumedAt + scope' })
        continue
      }
      if (approvals.has(row.requestId)) { ambiguousApprovals.add(row.requestId); continue }
      approvals.set(row.requestId, row)
    } else if (row.kind === 'call') {
      // A malformed call row stays VISIBLE: `alignCall` fails it closed instead
      // of dropping it from the report (a dropped row would be a silent pass).
      calls.push(row)
    }
  }
  return { ceilings, ambiguousCeilings, approvals, ambiguousApprovals, calls, invalid }
}

/**
 * Select the durable row for one call exactly as `scripts/a5sf-diag.mjs` does:
 * a NAMED `approvalRequestId` wins; otherwise the first row that positively
 * binds the call. (Selection only — the binding LAW is the imported
 * `bindApproval()`.)
 */
function selectApproval(index, call) {
  if (isNonBlank(call.approvalRequestId)) {
    const named = index.approvals.get(call.approvalRequestId)
    return named === undefined ? { row: null, ambiguous: index.ambiguousApprovals.has(call.approvalRequestId) } : { row: named, ambiguous: false }
  }
  for (const row of index.approvals.values()) {
    if (approvalAuthorizes(row, call)) return { row, ambiguous: false }
  }
  return { row: null, ambiguous: false }
}

/**
 * Line up ONE call's four links. Exported for a caller that already holds the
 * facts; {@link alignEvidenceChain} is the row-file entry point.
 *
 * @param {object} input
 * @param {object} input.call the recorded `kind:"call"` row
 * @param {object|null} input.ceiling the member's recorded `kind:"ceiling"` row
 * @param {object|null} input.approval the durable row selected for this call
 * @param {boolean} [input.ambiguousCeiling]
 * @param {boolean} [input.ambiguousApproval]
 * @returns {{verdict:string, callId:string, link:string|null, reason:string, detail:object|null, identity?:object, unbound?:string[]}}
 */
export function alignCall({ call, ceiling, approval, ambiguousCeiling = false, ambiguousApproval = false }) {
  const callId = isNonBlank(call?.callId) ? call.callId : '(missing)'
  if (!isPlainObject(call)) return undecidable(callId, 'call', 'CALL_ROW_INVALID', { field: 'call' })
  for (const key of CALL_KEYS) {
    const value = call[key]
    const shaped = key === 'instanceGeneration' ? Number.isInteger(value) : isNonBlank(value)
    if (!shaped) return undecidable(callId, 'call', 'CALL_FIELD_MISSING', { field: key })
  }
  if (!['allow', 'ask', 'deny'].includes(call.disposition)) return undecidable(callId, 'call', 'CALL_FIELD_MISSING', { field: 'disposition' })
  if (!['allow', 'ask', 'deny'].includes(call.lane)) return undecidable(callId, 'call', 'CALL_FIELD_MISSING', { field: 'lane' })
  if (!isPlainObject(call.provider)) return undecidable(callId, 'provider', 'LINK_MISSING', { field: 'provider' })
  if (!isPlainObject(call.effect)) return undecidable(callId, 'effect', 'LINK_MISSING', { field: 'effect' })

  // --- link 2: the compiled policy -----------------------------------------
  if (ambiguousCeiling) return undecidable(callId, 'policy', 'AMBIGUOUS_CEILING', { member: call.member })
  if (ceiling === null || ceiling === undefined) return undecidable(callId, 'policy', 'CEILING_ROW_MISSING', { member: call.member })
  if (ceiling.member !== call.member) return broken(callId, 'policy', 'MEMBER_MISMATCH', { ceilingMember: ceiling.member, callMember: call.member })
  if (ceiling.instanceGeneration !== call.instanceGeneration) {
    return broken(callId, 'policy', 'GENERATION_MISMATCH', { ceiling: ceiling.instanceGeneration, call: call.instanceGeneration })
  }
  if (ceiling.policyRevision !== call.policyRevision) {
    return broken(callId, 'policy', 'POLICY_REVISION_MISMATCH', { ceiling: ceiling.policyRevision, call: call.policyRevision })
  }
  const toolEntry = Array.isArray(ceiling.tools) ? ceiling.tools.find((entry) => isPlainObject(entry) && entry.tool === call.tool) : undefined
  if (toolEntry === undefined) return broken(callId, 'policy', 'TOOL_NOT_IN_COMPILED_CEILING', { tool: call.tool })
  if (!isPathRuleSet(toolEntry[call.axis])) return undecidable(callId, 'policy', 'CEILING_AXIS_MISSING', { tool: call.tool, axis: call.axis })
  if (call.disposition === 'deny' && call.lane === 'allow') {
    // "Unexplained allow": the compiled lane forbids the locator, so no
    // approval could have made this allow lawful (an approval never widens a
    // hard ceiling, R1). The missing durable row is not the ambiguity here.
    return broken(callId, 'policy', 'ALLOW_OUTSIDE_COMPILED_CEILING', { disposition: call.disposition, lane: call.lane })
  }

  // --- link 1: the durable decision/consumption -----------------------------
  const narrowedAllow = call.disposition === 'ask' && call.lane === 'allow'
  if (ambiguousApproval) return undecidable(callId, 'approval', 'AMBIGUOUS_APPROVAL_ROW', { requestId: call.approvalRequestId })
  if (approval === null || approval === undefined) {
    if (narrowedAllow) {
      // The compiled lane REQUIRED a human decision. Its absence from the
      // recorded evidence is not proof of a bypass (the durable row may exist
      // outside this file) and not proof of a legitimate allow: fail closed.
      return undecidable(callId, 'approval', 'APPROVAL_ROW_MISSING', { compiled: 'ask', lane: 'allow' })
    }
    if (isNonBlank(call.approvalRequestId)) {
      // The call NAMES a durable row that is not in the record: a missing link,
      // even though a plain compiled `allow` would not have needed one.
      return undecidable(callId, 'approval', 'APPROVAL_ROW_MISSING', { requestId: call.approvalRequestId })
    }
    // A plain compiled `allow`/`deny` call needs no durable row; that absence
    // is normal, not a hole.
  } else {
    const binding = bindApproval(approval, call)
    if (binding.state === 'unbindable') return undecidable(callId, 'approval', 'APPROVAL_SCOPE_UNBINDABLE', { requestId: approval.requestId, why: binding.reason })
    if (binding.state === 'mismatch') return broken(callId, 'approval', 'APPROVAL_SCOPE_MISMATCH', { requestId: approval.requestId, why: binding.reason })
    // Fail closed on any state this reader does not know: an unrecognised
    // binding is never an authorization.
    if (binding.state !== 'authorized') return undecidable(callId, 'approval', 'APPROVAL_SCOPE_UNBINDABLE', { requestId: approval.requestId, why: String(binding.state) })
  }

  // --- link 3: the Provider actually consulted ------------------------------
  const provider = call.provider
  if (provider.memberInstanceId !== call.member) return broken(callId, 'provider', 'PROVIDER_MEMBER_MISMATCH', { provider: provider.memberInstanceId, call: call.member })
  if (provider.instanceGeneration !== call.instanceGeneration) return broken(callId, 'provider', 'PROVIDER_GENERATION_MISMATCH', { provider: provider.instanceGeneration, call: call.instanceGeneration })
  if (provider.policyRevision !== call.policyRevision) return broken(callId, 'provider', 'PROVIDER_POLICY_REVISION_MISMATCH', { provider: provider.policyRevision, call: call.policyRevision })
  if (provider.toolBindingIdentity !== call.toolBindingIdentity) return broken(callId, 'provider', 'PROVIDER_BINDING_MISMATCH', { provider: provider.toolBindingIdentity, call: call.toolBindingIdentity })
  if (call.lane === 'allow' && provider.consulted !== true) return broken(callId, 'provider', 'PROVIDER_NOT_CONSULTED', { lane: call.lane, consulted: provider.consulted })

  // --- link 4: the independently observed effect ----------------------------
  const effect = call.effect
  if (effect.oracleId !== 'sound') return broken(callId, 'effect', 'EFFECT_ORACLE_UNSOUND', { oracleId: effect.oracleId })
  if (effect.tag !== call.callId) return broken(callId, 'effect', 'EFFECT_TAG_MISMATCH', { tag: effect.tag, callId: call.callId })
  if (call.lane === 'allow' && effect.effect !== true) return broken(callId, 'effect', 'EFFECT_NOT_OBSERVED', { lane: call.lane, effect: effect.effect })
  if (call.lane !== 'allow' && effect.effect === true) return broken(callId, 'effect', 'EFFECT_DESPITE_REFUSAL', { lane: call.lane, effect: effect.effect })

  // The four links agree. Say which identity keys each link could NOT carry:
  // ControlOperationScope has no generation field (R1 §6.5), and the oracle
  // observation is a channel verdict, not an instance identity.
  const unbound = []
  if (!('instanceGeneration' in (approval?.scope ?? {}))) unbound.push('approval.instanceGeneration')
  unbound.push('effect.member', 'effect.instanceGeneration')
  return {
    verdict: 'CHAIN_ALIGNED',
    callId,
    link: null,
    reason: 'one member instance + generation + invocation id + operation identity across all four links',
    detail: null,
    identity: {
      member: call.member,
      instanceGeneration: call.instanceGeneration,
      invocation: call.callId,
      operation: isNonBlank(call.logicalOperationId) ? call.logicalOperationId : (isNonBlank(call.operationFingerprint) ? call.operationFingerprint : call.callId),
      operationKey: isNonBlank(call.logicalOperationId) ? 'logicalOperationId' : (isNonBlank(call.operationFingerprint) ? 'operationFingerprint' : 'callId'),
      provider: provider.toolBindingIdentity,
      oracle: effect.oracleId,
      boundBy: approval === null || approval === undefined ? null : bindApproval(approval, call).reason,
    },
    unbound,
  }
}

/**
 * Align every recorded call in `rows`.
 *
 * Fail-closed aggregation: ANY `CHAIN_BROKEN` makes the file `CHAIN_BROKEN`;
 * otherwise ANY `UNDECIDABLE` makes it `UNDECIDABLE`; only a file where every
 * call is `CHAIN_ALIGNED` (and at least one call exists) is `CHAIN_ALIGNED`.
 *
 * @param {Array<object>} rows recorded JSONL rows
 */
export function alignEvidenceChain(rows) {
  const index = indexEvidenceRows(rows)
  const chains = []
  const consumed = new Map() // requestId → callId (R1 exactly-once, per invocation)
  for (const call of index.calls) {
    const ambiguousApproval = isNonBlank(call.approvalRequestId) && index.ambiguousApprovals.has(call.approvalRequestId)
    const { row: approval } = selectApproval(index, call)
    const result = alignCall({
      call,
      ceiling: index.ceilings.get(call.member) ?? null,
      approval,
      ambiguousCeiling: index.ambiguousCeilings.has(call.member),
      ambiguousApproval,
    })
    if (result.verdict === 'CHAIN_ALIGNED' && approval !== null && approval !== undefined) {
      if (consumed.has(approval.requestId)) {
        chains.push(undecidable(call.callId, 'approval', 'DUPLICATE_CONSUMPTION', { requestId: approval.requestId, firstCallId: consumed.get(approval.requestId) }))
        continue
      }
      consumed.set(approval.requestId, call.callId)
    }
    chains.push(result)
  }
  const aligned = chains.filter((chain) => chain.verdict === 'CHAIN_ALIGNED').length
  const brokenCount = chains.filter((chain) => chain.verdict === 'CHAIN_BROKEN').length
  const undecidableCount = chains.filter((chain) => chain.verdict === 'UNDECIDABLE').length
  // Aggregation is fail-closed: a broken link outranks everything, a missing
  // link (or an unparseable row) still forbids "aligned", and an empty file is
  // never a clean one.
  const verdict = brokenCount > 0 ? 'CHAIN_BROKEN'
    : undecidableCount > 0 || index.invalid.length > 0 || chains.length === 0 ? 'UNDECIDABLE'
      : 'CHAIN_ALIGNED'
  return {
    chains,
    invalid: index.invalid,
    summary: {
      rows: Array.isArray(rows) ? rows.length : 0,
      calls: chains.length,
      aligned,
      broken: brokenCount,
      undecidable: undecidableCount,
      invalid: index.invalid.length,
      verdict,
    },
  }
}

/**
 * Read a recorded JSONL file and align it. A missing file, an unreadable line
 * or an empty file is a typed refusal (`{ error }`), never an aligned chain.
 */
export function alignEvidenceFile(path) {
  const inputPath = resolve(String(path ?? ''))
  if (!existsSync(inputPath)) return { error: `NO_SUCH_PATH ${String(path)}` }
  const rows = []
  const lines = readFileSync(inputPath, 'utf8').split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    if (line.trim() === '') continue
    try {
      rows.push(JSON.parse(line))
    } catch {
      return { error: `INVALID_JSON ${String(path)}:${String(index + 1)}` }
    }
  }
  if (rows.length === 0) return { error: `NO_ROWS ${String(path)}` }
  return alignEvidenceChain(rows)
}

/** Render the chain report (one token-grammar line per call + a summary). */
export function renderChainReport(result) {
  const out = [`A5SF-EVIDENCE-CHECK rows=${String(result.summary.rows)} calls=${String(result.summary.calls)}`]
  for (const chain of result.chains) {
    if (chain.verdict === 'CHAIN_ALIGNED') {
      out.push(`CHAIN_ALIGNED callId=${chain.callId} member=${chain.identity.member} generation=${String(chain.identity.instanceGeneration)} operation=${chain.identity.operationKey}:${chain.identity.operation} boundBy=${String(chain.identity.boundBy)} unbound=${chain.unbound.join(',') || '-'}`)
    } else {
      out.push(`${chain.verdict} callId=${String(chain.callId)} link=${String(chain.link)} reason=${chain.reason}${chain.detail === null ? '' : ` detail=${JSON.stringify(chain.detail)}`}`)
    }
  }
  out.push(`SUMMARY calls=${String(result.summary.calls)} aligned=${String(result.summary.aligned)} broken=${String(result.summary.broken)} undecidable=${String(result.summary.undecidable)} invalid=${String(result.summary.invalid)} verdict=${result.summary.verdict}`)
  return `${out.join('\n')}\n`
}

/** This file's own source bytes (the C1 fence asserts the passive claim). */
export function evidenceSourceText() {
  return readFileSync(fileURLToPath(import.meta.url), 'utf8')
}

function usage(message) {
  process.stdout.write(`REFUSED USAGE${message === undefined ? '' : `: ${message}`}\nusage: node tests/world-factory/lib/a5sf-evidence.mjs --check <recorded.jsonl>\n`)
  return 2
}

function runCli(argv) {
  let target = null
  for (const arg of argv) {
    if (arg === '--check') continue
    if (arg === '--help' || arg === '-h') { process.stdout.write('usage: node tests/world-factory/lib/a5sf-evidence.mjs --check <recorded.jsonl>\n'); return 0 }
    if (arg.startsWith('--')) return usage(`unknown option ${JSON.stringify(arg.slice(0, 40))}`)
    if (target !== null) return usage('exactly one input path')
    target = arg
  }
  if (target === null) return usage('one recorded JSONL path is required')
  const result = alignEvidenceFile(target)
  if (result.error !== undefined) {
    process.stdout.write(`REFUSED ${result.error}: an unreadable or empty record is not "aligned"\n`)
    return 2
  }
  process.stdout.write(renderChainReport(result))
  return result.summary.verdict === 'CHAIN_ALIGNED' ? 0 : 1
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) process.exitCode = runCli(process.argv.slice(2))
