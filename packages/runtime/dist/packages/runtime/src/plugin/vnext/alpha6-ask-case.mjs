/**
 * alpha6-ask-case.mjs — R1 (owner ruling, review `20261124-0151` §1): one ordinary
 * admission `ask` becomes a REAL Alpha.6 approval CASE, so the EXISTING router can
 * select the Officer and the round-84 governed wake can be delivered.
 *
 * WHAT WAS MISSING, MEASURED (rounds 84/87/92): the centre's ask path records the ask
 * through `ControlService.requestControl`, which mints a durable `leader-approval` row
 * with `executionCoupling: 'inline'` and NO leg. `alpha6/root-router.ts` returns `null`
 * for a row without `approvalCaseId` + `legOrdinal`, so no Alpha.6 route (and therefore
 * no Officer wake) can exist for it. The only live case-leg producer was the
 * `envelope-mutation` governance lane, which `isDelegableOrdinaryToolAsk` excludes by
 * KIND. The ordinary-operation ask lane that minted leader-approval LEGS was deleted by
 * the A1 cut; its pure survivors are `routeOperationApproval` +
 * `createOperationApprovalFactsReader`, and this module is the production caller the
 * R1 ruling asks for — nothing else.
 *
 * WHAT THIS MODULE IS — and is not:
 *
 *  - it is a QUALIFICATION + IDENTITY ASSEMBLER. It decides whether THIS ask is one the
 *    authored policy makes reviewable, freezes the case identity from TRUSTED execution
 *    facts, and hands the ONE existing leg writer (`requestApprovalLeg`) its arguments;
 *  - it is NOT a new ask producer (the ask is still the centre's own lane verdict), NOT a
 *    new UTE I/O axis (nothing here executes: no body, no locator provider), NOT a second
 *    authority (the case's rung comes from the ONE `routeOperationApproval` walk, the
 *    delegation answer from the ONE shared `isDelegableOrdinaryToolAsk` predicate), and
 *    NOT a fallback (it never turns a missing fact into a default; see below);
 *  - it delivers nothing. The wake is round-84's governed delivery, driven by the
 *    notifier/router once the durable row carries the case.
 *
 * THE CLOSED QUALIFICATION RULE `ALPHA6-ORDINARY-CASE-Q` (stated in full and shipped as
 * `ALPHA6_ORDINARY_CASE_RULE` below; the durability/arms document quotes it verbatim):
 *
 *   Enabled + Q1 + Q2 + Q3 + Q4  ⇒  a case is opened through `requestApprovalLeg`.
 *
 *   ENABLED  `config.alpha6ReviewRouting === true` (the row already refused at boot if
 *            its Alpha.6 composition is incoherent, so a live row is a coherent one).
 *   Q1       DECLARED TOOL BINDING. The executing tool has a compiled `toolBindings[]`
 *            entry on THIS Member — the trusted authoring coordinate `owner/name` and its
 *            `definitionIdentity` — i.e. the Blueprint AUTHOR declared this tool a
 *            governed operation for this Member. An ask on a tool with no declaration is
 *            NOT a case (there is no trusted ToolDefinition identity to freeze, and
 *            inventing one is exactly what the ruling forbids).
 *   Q2       CANONICAL OPERATION IDENTITY. `canonicalizeOperation` (the A2 operation
 *            permission core, the ONE canonicalizer) produces the opaque resource key and
 *            the exact `sha256:` impact fingerprint from the call's own arguments through
 *            the Member's own fs seam. A tool outside that closed vocabulary does not
 *            qualify — the case vocabulary cannot express it, so the lawful Leader/Human
 *            path stands unchanged.
 *   Q3       LEADER RUNG. `routeOperationApproval` over the Team's authority walk answers
 *            `approval-required` with `requiredAuthority: 'leader'`. On a Team that is not
 *            on the v3 authority documents that is the FROZEN legacy routing
 *            (`isLeader ? user-approval : leader-approval`), i.e. `leader` for a Member
 *            operation; any other arm (`direct`, `authority-undetermined`, or a rung above
 *            the Leader) does NOT qualify. This is the clause that keeps Alpha.6 from
 *            silently WIDENING Officer authority: an operation the documents reserve to a
 *            Human never becomes an Officer case.
 *   Q4       THE SHARED PREDICATE. `isDelegableOrdinaryToolAsk` (the ONE
 *            `BlueprintReviewPolicy` predicate the router and the ReviewCapability
 *            evaluator both read) accepts the frozen facts: an operation case (no
 *            mutation fingerprint), not a fixed Leader/Human category, and per-effect
 *            required authorities inside `{member, leader}`.
 *
 * A QUALIFICATION FAILURE IS NEVER A REFUSAL: the ask keeps the plain `requestControl`
 * path it has today (a case-less `leader-approval` row the Leader notifies on). THE
 * DISTINCT CASE — an ask that HAS qualified but whose required identity cannot be
 * sourced — is a TYPED REFUSAL that names the missing field
 * (`ADMISSION_ALPHA6_CASE_IDENTITY_INCOMPLETE`). That distinction is the ruling's
 * "reject/refuse if any required field cannot be sourced — never default", and it is why
 * this module has no `??`/`||` fallback on any identity member.
 *
 * THE FROZEN IDENTITY (every member from a trusted fact; the list is the ruling's):
 *
 *   | member                     | trusted source                                          |
 *   | -------------------------- | ------------------------------------------------------- |
 *   | `operationFingerprint`     | `canonicalizeOperation` (args + Member fs seam)          |
 *   | `authorityScope`           | the canonical resource key / shell fingerprint           |
 *   | `requestedEffect`          | `allow` — the only effect that means "may this run"     |
 *   | `operationToolOwner/Name`  | the compiled `toolBindings[]` coordinate                 |
 *   | ToolDefinition identity    | the SAME compiled binding's `definitionIdentity`         |
 *   | blueprint content hash     | the durable TeamSession's frozen Blueprint               |
 *   | policy generation          | the compiled Member binding                              |
 *   | requesting Member identity | the compiled Member binding (instance + template + gen)  |
 *   | call correlation id        | the admission call's own correlation                     |
 *
 * @module packages/runtime/src/plugin/vnext/alpha6-ask-case
 */

import { canonicalizeOperation, classifyPermissionTool, routeOperationApproval } from '../../../operation-permission/index.js'
import { isDelegableOrdinaryToolAsk } from '../../../review-authority/index.js'

/** The closed rule, as a machine-readable declaration (docs quote it by these ids). */
export const ALPHA6_ORDINARY_CASE_RULE = Object.freeze({
  id: 'ALPHA6-ORDINARY-CASE-Q',
  enabled: 'config.alpha6ReviewRouting === true',
  q1: 'declared-tool-binding',
  q2: 'canonical-operation-identity',
  q3: 'leader-rung',
  q4: 'shared-delegable-predicate',
})

/**
 * The TWO refusal codes this module can raise. Both are TYPED and both are refusals of
 * an ask that had already QUALIFIED — a non-qualifying ask is never refused here.
 */
export const ALPHA6_ASK_CASE_REFUSAL_CODES = Object.freeze({
  /**
   * A required identity member could not be sourced from a trusted fact. The refusal
   * names the member (`field`); the ask is NOT written as a case and NOT written as a
   * plain row either (a half-identified case is not a lawful Leader ask).
   */
  IDENTITY_INCOMPLETE: 'ADMISSION_ALPHA6_CASE_IDENTITY_INCOMPLETE',
  /** The ONE leg writer refused to open the leg (typed outcome, not a throw). */
  LEG_REFUSED: 'ADMISSION_ALPHA6_CASE_LEG_REFUSED',
})

/** Why a qualification check said "not a case" — recorded, never a refusal. */
export const ALPHA6_ASK_PLAIN_REASONS = Object.freeze({
  DISABLED: 'alpha6-review-routing-not-enabled',
  NO_DECLARED_TOOL_BINDING: 'no-declared-tool-binding-for-this-member-tool',
  OPERATION_NOT_CANONICALIZABLE: 'operation-outside-the-closed-permission-vocabulary',
  RUNG_NOT_LEADER: 'authority-walk-does-not-name-the-leader-rung',
  PREDICATE_REFUSED: 'shared-delegable-predicate-refused-the-frozen-facts',
})

/** The bound per-call facts a disqualifying check may name (never authority). */
function plain(reason, detail) {
  return { kind: 'plain', reason, ...(detail === undefined ? {} : { detail }) }
}

function refused(field, detail) {
  return {
    kind: 'refused',
    code: ALPHA6_ASK_CASE_REFUSAL_CODES.IDENTITY_INCOMPLETE,
    field,
    reason:
      `${ALPHA6_ASK_CASE_REFUSAL_CODES.IDENTITY_INCOMPLETE}: the ask qualified for Alpha.6 review, but the `
      + `trusted '${field}' could not be sourced (${detail}); no case is opened and no default is invented`,
  }
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * The `owner/name` coordinate of a compiled ToolBinding, split on the LAST slash.
 *
 * The format is the compiler's (`member-io-policy/src/compile.ts`:
 * `bindingIdentity: \`${owner}/${name}\``) and the split is the SAME one the product's
 * own approval-takeover lane already performs (`toolNameOf`), so this is a read of a
 * frozen format, not policy parsing. The two halves are kept together on the leg as the
 * ruling requires: `operationToolOwner` + `operationToolName` + the identity string.
 */
function toolCoordinateOf(bindingIdentity, toolName) {
  const index = bindingIdentity.lastIndexOf('/')
  const owner = index > 0 ? bindingIdentity.slice(0, index) : ''
  const name = index >= 0 ? bindingIdentity.slice(index + 1) : ''
  if (!nonEmpty(owner) || !nonEmpty(name)) return undefined
  // The coordinate must name the tool that is actually executing; a binding whose
  // trailing name disagrees is not this call's binding.
  if (name !== toolName) return undefined
  return { owner, name }
}

/**
 * Build the R1 case producer.
 *
 * @param {object} input
 * @param {boolean} input.enabled - `config.alpha6ReviewRouting === true` on this row.
 * @param {(teamRoot: string) => {contentHash?: string, revision?: string}|undefined|null} input.blueprintOf
 *   the durable TeamSession's frozen Blueprint identity (`contentHash` + `revision`).
 * @param {(identity: {teamSessionId: string, memberInstanceId: string}) => Promise<number>} input.authorityGenerationOf
 *   the ONE authority-generation reader (the durable permission overlay's generation).
 * @param {(teamSessionId: string, memberInstanceId: string) => Promise<object|undefined>} [input.ceilingOf]
 *   the v3 authority-ceiling context reader (`{beneficiaryAuthority, documents, subtreeContains?}`),
 *   or undefined when this composition has none (=> the FROZEN legacy rung, see Q3).
 * @param {() => {resolve: Function}|undefined} input.fsOf - the Member's own fs seam (the A2
 *   canonicalization basis, read lazily per call).
 * @param {(rootSessionId: string) => Promise<object>} [input.readControlState] - not used here;
 *   the leg writer is the caller's. Kept out deliberately so this module holds no service handle.
 * @returns {{caseFor: (input: object) => Promise<object>}}
 */
export function createAlpha6AskCasePort (input) {
  if (typeof input !== 'object' || input === null) throw new TypeError('alpha6-ask-case: a port needs its trusted readers')
  if (typeof input.blueprintOf !== 'function') throw new TypeError('alpha6-ask-case: blueprintOf is required — a case identity carries the frozen Blueprint, it never guesses one')
  if (typeof input.authorityGenerationOf !== 'function') throw new TypeError('alpha6-ask-case: authorityGenerationOf is required — a case freezes a generation that was READ')
  if (typeof input.fsOf !== 'function') throw new TypeError('alpha6-ask-case: fsOf is required — the canonical operation identity needs the Member\'s own resolution seam')

  const enabled = input.enabled === true

  /** The A2 resolver seam over the Member's own fs (the same shape `overlay-decision.mjs` uses). */
  const resolveTarget = (fs, cwd) => async (path) => {
    const resolved = await fs.resolve(path, typeof cwd === 'string' && cwd !== '' ? { cwd } : {})
    const key = typeof resolved === 'string' ? resolved : resolved?.targetKey
    if (typeof key !== 'string' || key === '') {
      throw new Error(`alpha6-ask-case: the fs seam resolved ${JSON.stringify(path)} to no canonical key`)
    }
    const display = typeof resolved === 'string' ? path : (resolved?.displayPath ?? path)
    return { key, display }
  }

  /**
   * Assemble ONE ask's case identity, or say why it is not a case.
   *
   * @param {object} ask
   * @param {object} ask.binding - the compiled centre Binding the call was admitted under.
   * @param {string} ask.callId - the host call id.
   * @param {string} ask.toolName - the executing tool name.
   * @param {unknown} ask.arguments - the call's own arguments.
   * @param {string} ask.correlation - the admission correlation (one per call).
   * @param {string} ask.actionName - the durable action name the plain path uses.
   * @param {string} [ask.summary] - the durable summary the plain path uses.
   * @returns {Promise<object>} `{kind:'plain', reason}` | `{kind:'refused', code, field, reason}` |
   *   `{kind:'case', leg}` (the `requestApprovalLeg` arguments, identity frozen).
   */
  async function caseFor (ask) {
    if (!enabled) return plain(ALPHA6_ASK_PLAIN_REASONS.DISABLED)
    const binding = ask?.binding
    if (typeof binding !== 'object' || binding === null) return plain(ALPHA6_ASK_PLAIN_REASONS.NO_DECLARED_TOOL_BINDING, 'no compiled binding on this call')

    // Q1 — the AUTHOR declared this (Member, tool) an operation. No declaration, no
    // trusted ToolDefinition identity, and therefore no case.
    const declared = binding.perTool?.[ask.toolName]
    const toolBindingIdentity = declared?.toolBindingIdentity
    if (!nonEmpty(toolBindingIdentity)) return plain(ALPHA6_ASK_PLAIN_REASONS.NO_DECLARED_TOOL_BINDING, `perTool[${JSON.stringify(ask.toolName)}] carries no toolBindings coordinate`)

    // Q2 — the ONE canonicalizer. Outside the closed vocabulary there is no operation
    // identity to freeze, so the ask is not a case (the plain path stands).
    let operation
    try {
      let fs
      try {
        fs = input.fsOf()
      } catch {
        fs = undefined
      }
      operation = await canonicalizeOperation({
        name: ask.toolName,
        arguments: ask.arguments,
        resolveTarget: resolveTarget(fs ?? {}, binding.workspaceRoot),
      })
    } catch (error) {
      return plain(ALPHA6_ASK_PLAIN_REASONS.OPERATION_NOT_CANONICALIZABLE, String(error?.message ?? error).slice(0, 240))
    }
    const shellClass = classifyPermissionTool(ask.toolName).kind === 'tool-level'

    // ---- from here on the ask is CASE-SHAPED: every identity member must be sourced ----
    const coordinate = toolCoordinateOf(toolBindingIdentity, ask.toolName)
    if (coordinate === undefined) return refused('operation-tool-coordinate', `the compiled bindingIdentity ${JSON.stringify(toolBindingIdentity)} does not name the executing tool ${JSON.stringify(ask.toolName)} as owner/name`)

    const teamRoot = binding.owner
    if (!nonEmpty(teamRoot)) return refused('requesting-member-identity', 'the binding names no owning team root')
    const instanceId = binding.instanceId
    if (!nonEmpty(instanceId)) return refused('requesting-member-identity', 'the binding names no Member instance')
    const templateId = binding.templateId
    if (!nonEmpty(templateId)) return refused('requesting-member-identity', 'the binding names no Member template')
    const instanceGeneration = binding.instanceGeneration
    if (!Number.isInteger(instanceGeneration) || instanceGeneration < 0) return refused('requesting-member-identity', 'the binding names no instance generation')
    if (!nonEmpty(binding.policyGeneration)) return refused('policy-generation', 'the compiled binding names no policy generation')

    const blueprint = input.blueprintOf(teamRoot)
    if (blueprint === undefined || blueprint === null) return refused('blueprint-content-hash', 'no frozen Blueprint could be read for the requesting team root')
    if (!nonEmpty(blueprint.contentHash)) return refused('blueprint-content-hash', 'the TeamSession Blueprint carries no content hash')
    if (!nonEmpty(blueprint.revision)) return refused('blueprint-revision', 'the TeamSession Blueprint carries no revision')

    let authorityGeneration
    try {
      authorityGeneration = await input.authorityGenerationOf({ teamSessionId: teamRoot, memberInstanceId: instanceId })
    } catch (error) {
      return refused('authority-generation', `the durable overlay generation could not be read (${String(error?.message ?? error).slice(0, 160)})`)
    }
    if (!Number.isInteger(authorityGeneration) || authorityGeneration < 0) return refused('authority-generation', 'the durable overlay answered no generation')

    // Q3 — the ONE authority walk. A Team that is not on the v3 documents answers
    // `legacy`, whose frozen routing is `leader-approval` for a Member operation.
    let ceilingFacts
    if (typeof input.ceilingOf === 'function') {
      try {
        ceilingFacts = await input.ceilingOf(teamRoot, instanceId)
      } catch (error) {
        return plain(ALPHA6_ASK_PLAIN_REASONS.RUNG_NOT_LEADER, `the authority ceiling could not be read (${String(error?.message ?? error).slice(0, 200)}); the lawful Leader/Human path stands`)
      }
    }
    let routing
    try {
      routing = routeOperationApproval({
        operationClass: operation.tool,
        resourceKey: operation.resource.kind === 'tool' ? operation.tool : operation.resource.key,
        initiatorAuthority: 'member',
        facts: ceilingFacts,
        ...(shellClass ? { commandFingerprint: operation.fingerprint } : {}),
      })
    } catch (error) {
      return plain(ALPHA6_ASK_PLAIN_REASONS.RUNG_NOT_LEADER, `the authority walk faulted (${String(error?.message ?? error).slice(0, 200)})`)
    }
    const requiredAuthority = routing.kind === 'approval-required'
      ? routing.requiredAuthority
      : routing.kind === 'legacy'
        ? 'leader'
        : undefined
    if (requiredAuthority !== 'leader') {
      return plain(ALPHA6_ASK_PLAIN_REASONS.RUNG_NOT_LEADER, `${routing.kind}${routing.reason === undefined ? '' : `/${String(routing.reason)}`}`)
    }
    const beneficiaryAuthority = routing.kind === 'approval-required' ? routing.beneficiaryAuthority : 'member'

    // The AUTHORITY POINT this case covers. A file-class operation is an exact canonical
    // resource; a shell-class operation can only be narrowed by its command fingerprint
    // (RULING 4), which is what the walk was given above.
    const authorityScope = shellClass
      ? { operationClass: operation.tool, matcher: { kind: 'fingerprint', resource: operation.fingerprint } }
      : { operationClass: operation.tool, matcher: { kind: 'exact', resource: operation.resource.key } }

    const requestedEffect = 'allow'
    // The case's frozen per-effect rung. It is the WALK's answer (or the frozen legacy
    // `leader` routing) — never a default: the two values below are the same answer Q3
    // just read, carried onto the identity the ReviewCapability evaluator consumes.
    const perEffectRequiredAuthorities = Object.freeze([requiredAuthority])

    // Q4 — the ONE shared predicate. Everything above is its input; a predicate refusal
    // is a plain path, not a refusal (the ask simply is not the closed ordinary case).
    const ordinaryFacts = {
      kind: 'leader-approval',
      reviewAuthority: 'leader',
      requestedEffect,
      operationFingerprint: operation.fingerprint,
      mutationProposalFingerprint: null,
      authorityScope,
      operationTool: { owner: coordinate.owner, name: coordinate.name },
      perEffectRequiredAuthorities,
      // An admission TOOL ask is not one of the control plane's fixed
      // Leader-management / Human-only request categories; the category question is
      // asked of control requests, and this is an operation.
      fixedLeaderOrHumanCategory: false,
    }
    if (!isDelegableOrdinaryToolAsk(ordinaryFacts)) {
      return plain(ALPHA6_ASK_PLAIN_REASONS.PREDICATE_REFUSED)
    }

    return {
      kind: 'case',
      leg: {
        kind: 'leader-approval',
        reviewAuthority: 'leader',
        requiredAuthorityAtCreation: requiredAuthority,
        identity: {
          subject: { kind: 'instance', instanceId },
          beneficiaryAuthority,
          requestedEffect,
          operationFingerprint: operation.fingerprint,
          authorityScope,
          correlation: ask.correlation,
        },
        actionName: ask.actionName,
        toolName: ask.toolName,
        ...(ask.summary === undefined ? {} : { summary: ask.summary }),
        // THE SCOPE SLOT THE ROUTER ALREADY READS. `alpha6/root-router.ts:69-74` takes the case's
        // authority scope from `reviewPayload.authorityScope` (the slot the deleted PA bridge wrote),
        // and the strict PA-manifest parser only accepts a payload carrying its own `schema`, so this
        // minimal payload is NEVER mistaken for a PA manifest (`paManifestPresent` stays false and the
        // per-effect rungs stay the frozen array below). This is a payload convention the existing
        // reader already owns — not a new axis, not a second identity source.
        reviewPayload: { authorityScope },
        // The leg is the CURRENT WAIT's row: `awaitControlDecision` polls this id, so the
        // coupling stays `inline` exactly as the plain path's row is (R2 is refused; R3
        // is the round that makes a granted call executable — this round does not).
        executionCoupling: 'inline',
        operationOwnerTemplateId: templateId,
        operationToolDefinitionIdentity: toolBindingIdentity,
        operationToolOwner: coordinate.owner,
        operationToolName: coordinate.name,
        authorityGeneration,
        blueprintContentHash: blueprint.contentHash,
        blueprintRevision: blueprint.revision,
        perEffectRequiredAuthorities,
      },
    }
  }

  return { caseFor }
}
