/**
 * ActivationProvider — the SOLE entry point for every new MemberInstance
 * creation (Architecture invariant 26) and the full admission/provisioning
 * order (DevPlan 19.2): resolve TeamSession → resolve immutable Blueprint →
 * resolve template → caller authority → admission → compatibility → quota →
 * policy → overlay bounds → workspace+context fields → allocate instanceId
 * (INSIDE the stable operation identity, per the journal protocol) → journal
 * prepare → create child Agent+Session → bind TeamDomain → commit
 * MemberInstance → publish projection.
 *
 * Human, leader-explicit, and leader-delegate requests all funnel through the
 * same provider; there is no separate per-source creation path.
 *
 * Crash model (Architecture §18, DevPlan §17.3): the provider's admission is
 * ONCE per logical activation. The stable operation identity
 * `(rootSessionId, source, requestToken) → (instanceId, operationId,
 * idempotencyKey)` makes retries converge:
 *   - no durable operation row  → the full admission+provisioning order runs
 *   - PREPARED operation        → roll-forward through the provisioning
 *     coordinator (idempotent effects, no re-admission)
 *   - COMMITTED operation       → durable result is replayed (idempotent no-op
 *     at the journal; binder + projection re-applied, `replayed: true`)
 *   - FAILED operation          → ABANDONED (the journal protocol never
 *     roll-forwards a FAILED row): the provider fails loudly with
 *     OPERATION_FAILED; a retry must use a new logical operation (new
 *     requestToken).
 *
 * Admit-once consequence: quota and policy re-checks run ONLY on the new
 * path. A retry of an already-admitted activation never re-runs admission —
 * the durable admitted content (the journal intent payload) is authoritative.
 *
 * `activate(request)` and `recoverActivation(request)` share one entry:
 * `recoverActivation` documents the intent (recover a crashed/abandoned
 * activation) but executes the same converge-or-create order, so a recovery
 * request whose token has no durable operation row simply performs the fresh
 * activation.
 *
 * The `now` port is reserved for future projection timestamping; the v1
 * provider does not consume it (durable timestamps come from the TeamDomain
 * records themselves).
 */

import {
  LEADER_INSTANCE_ID,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import {
  DEFAULT_CONTEXT_POLICY,
  isContextPolicy,
  resolveDelegationTarget,
  resolveEffectiveWorkspace,
} from '../../domain/member/src/index.js'
import type {
  ContextPolicy,
  DelegationTarget,
} from '../../domain/member/src/index.js'
import type { CompatibilityStatus } from '../../domain/compatibility/src/index.js'
import {
  createProvisioningCoordinator,
} from '../../storage/provisioning/index.js'
import type {
  ProvisioningCoordinator,
  ProvisionRequest,
} from '../../storage/provisioning/index.js'
import {
  OPERATION_PHASES,
  isTeamDomainError,
} from '../../storage/schema/index.js'
import type { OperationRecord } from '../../storage/schema/index.js'
import {
  TeamAgentBinder,
  createTeamDomainReadHandle,
} from '../agent-setup/binder/index.js'
import type { TeamAgentBindResult } from '../agent-setup/binder/index.js'
import { createActivationChildAdapter } from './adapter.js'
import {
  allocateCheckedInstanceId,
  admitSource,
  checkCallerAuthority,
  checkQuota,
  computeOverlayBounds,
  countTeamQuota,
  evaluateActivationCompatibility,
  resolveActivationPolicy,
  resolveBoundBlueprint,
  resolveCreationFields,
  resolveTeamSession,
  resolveTemplate,
} from './checks.js'
import { ACTIVATION_ERROR_CODES, ActivationError, isActivationError } from './errors.js'
import { activationOperationIdentity } from './identity.js'
import type {
  ActivationAdmissionState,
  ActivationPorts,
  ActivationProjectionEvent,
  ActivationProjectionState,
  ActivationProvider,
  ActivationResult,
  MemberActivationRequest,
} from './types.js'
import {
  ACTIVATION_SOURCES,
  ACTIVATION_SOURCE_VALUES,
} from './types.js'
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js'
import type { BlueprintTemplate } from '../../domain/blueprint/src/index.js'

/** The stable operation identity handed to the journal protocol. */
interface ActivationOperationIdentity {
  readonly instanceId: string
  readonly operationId: string
  readonly idempotencyKey: string
}

/**
 * Create an ActivationProvider over the given ports.
 *
 * The provider is bound to the given `teamDomain` instance for its lifetime:
 * after a domain restart the caller rebuilds the provider with the reopened
 * domain (the per-team coordinator cache references the domain).
 *
 * All durable writes for one team are serialized behind a per-team promise
 * chain so that concurrent activations of the same team see each other's
 * in-flight reservations in the quota and instance-id collision checks.
 */
export function createActivationProvider(ports: ActivationPorts): ActivationProvider {
  const repositories = ports.teamDomain.repositories
  /** Lazily created, one coordinator per (domain, root). */
  const coordinators = new Map<string, ProvisioningCoordinator>()
  /** Per-team promise chain (the activation lock). */
  const teamLocks = new Map<string, Promise<unknown>>()

  function getCoordinator(rootSessionId: string): ProvisioningCoordinator {
    let coordinator = coordinators.get(rootSessionId)
    if (coordinator === undefined) {
      coordinator = createProvisioningCoordinator({
        domain: ports.teamDomain,
        rootSessionId,
        adapter: createActivationChildAdapter(ports.childSessionFactory, ports.sessionDurability),
      })
      coordinators.set(rootSessionId, coordinator)
    }
    return coordinator
  }

  function withTeamLock<T>(rootSessionId: string, work: () => Promise<T>): Promise<T> {
    const previous = teamLocks.get(rootSessionId) ?? Promise.resolve(undefined as unknown)
    const run = previous.then(work)
    const tail: Promise<unknown> = run.then(
      () => undefined,
      () => undefined,
    )
    teamLocks.set(rootSessionId, tail)
    return run
  }

  /**
   * Step 0: closed-grammar validation of the request.
   * Every malformed shape fails with REQUEST_MALFORMED before any
   * repository access.
   */
  function validateRequest(request: MemberActivationRequest): void {
    const fail = (reason: string): never => {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.REQUEST_MALFORMED,
        `activation: malformed request: ${reason}`,
        {},
      )
    }
    if (typeof request.rootSessionId !== 'string' || request.rootSessionId.length === 0) {
      fail('rootSessionId must be a non-empty string')
    }
    try {
      parseRootSessionId(request.rootSessionId)
    } catch (error) {
      fail(`rootSessionId is not a valid session id: ${String(error)}`)
    }
    if (typeof request.source !== 'string' || !ACTIVATION_SOURCE_VALUES.includes(request.source)) {
      fail('source is outside the closed activation source vocabulary')
    }
    if (typeof request.label !== 'string' || request.label.length === 0) {
      fail('label must be a non-empty string')
    }
    if (typeof request.requestToken !== 'string' || request.requestToken.length === 0) {
      fail('requestToken must be a non-empty string')
    }
    if (request.groupId !== undefined && (typeof request.groupId !== 'string' || request.groupId.length === 0)) {
      fail('groupId must be a non-empty string when present')
    }
    if (request.workspace !== undefined && (typeof request.workspace !== 'string' || request.workspace.length === 0)) {
      fail('workspace must be a non-empty string when present')
    }
    if (request.callerId !== undefined && (typeof request.callerId !== 'string' || request.callerId.length === 0)) {
      fail('callerId must be a non-empty string when present')
    }

    const hasTemplate = request.templateId !== undefined
    const hasDelegation = request.delegation !== undefined
    if (request.source === ACTIVATION_SOURCES.LEADER_DELEGATE) {
      if (!hasDelegation) fail('leader-delegate requires delegation addressing')
      if (hasTemplate) fail('leader-delegate must not carry a top-level templateId (the template is the delegation address)')
      const delegation = request.delegation as { explicitInstanceId?: unknown; templateId?: unknown }
      const hasExplicit = delegation.explicitInstanceId !== undefined
      const hasDelegatedTemplate = delegation.templateId !== undefined
      if (hasExplicit === hasDelegatedTemplate) {
        fail('delegation addressing must be EITHER explicitInstanceId OR templateId (exactly one)')
      }
      if (hasExplicit) {
        try {
          parseInstanceId(String(delegation.explicitInstanceId))
        } catch (error) {
          fail(`delegation.explicitInstanceId is not a valid instance id: ${String(error)}`)
        }
      }
      if (hasDelegatedTemplate) {
        try {
          parseTemplateId(String(delegation.templateId))
        } catch (error) {
          fail(`delegation.templateId is not a valid template id: ${String(error)}`)
        }
      }
    } else {
      if (!hasTemplate) fail('explicit activations require a top-level templateId')
      if (hasDelegation) fail('explicit activations must not carry delegation addressing')
      try {
        parseTemplateId(String(request.templateId))
      } catch (error) {
        fail(`templateId is not a valid template id: ${String(error)}`)
      }
    }
  }

  /**
   * The template a request ADDRESSES (the loud conflict check on re-drive):
   * leader-explicit / human-ui carry it at the top level; a template-level
   * delegation carries it in the delegation; an explicit-instance delegation
   * carries no template address (the identity IS the instance).
   */
  function requestedTemplateAddress(request: MemberActivationRequest): string | undefined {
    if (request.source === ACTIVATION_SOURCES.LEADER_DELEGATE && request.delegation !== undefined) {
      const templateId = request.delegation.templateId
      return templateId === undefined ? undefined : String(templateId)
    }
    return request.templateId === undefined ? undefined : String(request.templateId)
  }

  /** Template context policy, guarded (invariant 29). */
  function templateContextPolicy(template: BlueprintTemplate): ContextPolicy {
    const policy = template.contextPolicy ?? DEFAULT_CONTEXT_POLICY
    if (!isContextPolicy(policy)) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.TEMPLATE_CONTEXT_POLICY_UNKNOWN,
        `activation: template '${String(template.templateId)}' carries an unknown contextPolicy '${String(policy)}'`,
        { templateId: String(template.templateId), contextPolicy: String(policy) },
      )
    }
    return policy
  }

  /**
   * The template for an explicit-instance delegation address. The member must
   * already exist — an explicit address never creates (invariant 18: the
   * identity is addressed, not allocated here).
   */
  function templateForAddressedMember(
    blueprint: TeamBlueprint,
    rootSessionId: string,
    instanceId: string,
  ): BlueprintTemplate {
    const member = repositories.memberInstances.get(rootSessionId, instanceId)
    if (member === undefined) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.DELEGATION_TARGET_UNRESOLVED,
        `activation: the addressed member '${instanceId}' does not exist in team '${rootSessionId}'`,
        { rootSessionId, instanceId, code: 'MEMBER_NOT_FOUND' },
      )
    }
    return resolveTemplate(blueprint, String(member.templateId))
  }

  /** Map domain delegation-resolution failures to the provider vocabulary. */
  function mapDelegationTargetError(error: unknown, rootSessionId: string): never {
    if (isActivationError(error)) throw error
    const record = (error ?? {}) as { code?: unknown }
    const code = typeof record.code === 'string' ? record.code : 'UNCLASSIFIED'
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.DELEGATION_TARGET_UNRESOLVED,
      `activation: the delegation target cannot be resolved: ${error instanceof Error ? error.message : String(error)}`,
      { rootSessionId, code },
    )
  }

  /**
   * Post-commit binder install (the work gate, in the surface layer).
   * Runs AFTER the terminal commit: the binder needs the team-member binding
   * and member record that the coordinator created. A post-commit bind that
   * resolves no team-member target is a provisioning defect (the durable
   * binding MUST exist after the terminal commit) and fails loudly.
   */
  function bindPostCommit(childSessionId: string): TeamAgentBindResult {
    const binder = new TeamAgentBinder({
      surface: ports.surface,
      teamDomain: createTeamDomainReadHandle(repositories),
      ...(ports.slots !== undefined ? { slots: ports.slots } : {}),
      ...(ports.admissionGuard !== undefined ? { admissionGuard: ports.admissionGuard } : {}),
    })
    let bind: TeamAgentBindResult
    try {
      bind = binder.bindFreshMember(childSessionId)
    } catch (error) {
      if (isActivationError(error)) throw error
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.BINDER_FAILED,
        `activation: post-commit binder install failed for child session '${childSessionId}': ${error instanceof Error ? error.message : String(error)}`,
        { childSessionId },
      )
    }
    if (!bind.bound) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.BINDER_FAILED,
        `activation: post-commit bind resolved no team-member target for child session '${childSessionId}' (the durable binding must exist after the terminal commit — provisioning defect)`,
        { childSessionId, noopReason: bind.noopReason ?? null },
      )
    }
    return bind
  }

  /**
   * Step 16: projection publication. Non-fatal by design (the durable state
   * is already terminal); a missing publisher records `published: false` and
   * a throwing publisher records the error.
   */
  function publishProjection(event: ActivationProjectionEvent): ActivationProjectionState {
    const publisher = ports.projectionPublisher
    if (publisher === undefined) return { published: false }
    try {
      publisher(event)
    } catch (error) {
      return { published: false, error: error instanceof Error ? error.message : String(error) }
    }
    return { published: true }
  }

  /**
   * Shared post-commit tail: binder (work gate) + projection + the
   * `activated` result shape.
   */
  function activatedResult(
    request: MemberActivationRequest,
    member: MemberInstanceRecordDto,
    identity: ActivationOperationIdentity,
    childSessionId: string,
    replayed: boolean,
    contextPolicy: ContextPolicy,
    workspace: string | undefined,
    compatibilityStatus: CompatibilityStatus | undefined,
    policyStateId: string | undefined,
    ledgerSequence: number | undefined,
  ): ActivationResult {
    const bind = bindPostCommit(childSessionId)
    const admission: ActivationAdmissionState = {
      admitted: bind.admitted ?? false,
      ...(bind.admissionCode !== undefined ? { code: bind.admissionCode } : {}),
    }
    const projectionEvent: ActivationProjectionEvent = {
      source: request.source,
      rootSessionId: String(member.rootSessionId),
      templateId: String(member.templateId),
      instanceId: String(member.instanceId),
      childSessionId,
      operationId: identity.operationId,
      ...(ledgerSequence !== undefined ? { ledgerSequence } : {}),
      replayed,
      admitted: admission.admitted,
      ...(admission.code !== undefined ? { admissionCode: admission.code } : {}),
      contextPolicy,
      ...(workspace !== undefined ? { workspace } : {}),
      createdAt: member.createdAt,
    }
    const projection = publishProjection(projectionEvent)
    return {
      kind: 'activated',
      source: request.source,
      requestToken: request.requestToken,
      templateId: String(member.templateId),
      member,
      instanceId: String(member.instanceId),
      childSessionId,
      operationId: identity.operationId,
      ...(ledgerSequence !== undefined ? { ledgerSequence } : {}),
      replayed,
      contextPolicy,
      ...(workspace !== undefined ? { workspace } : {}),
      ...(compatibilityStatus !== undefined ? { compatibilityStatus } : {}),
      ...(policyStateId !== undefined ? { policyStateId } : {}),
      admission,
      projection,
      createdAt: member.createdAt,
    }
  }

  /**
   * The read-only `continued` result for a delegation that resolved to an
   * existing work-accepting member (invariant 24: follow-up keeps the same
   * child Session). No lock, no writes, no projection.
   */
  function continuedResult(
    request: MemberActivationRequest,
    rootSessionId: string,
    member: MemberInstanceRecordDto,
    blueprint: TeamBlueprint,
  ): ActivationResult {
    const template = resolveTemplate(blueprint, String(member.templateId))
    const contextPolicy = templateContextPolicy(template)
    const teamSession = repositories.teamSessions.get(rootSessionId)
    if (teamSession === undefined) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
        `activation: team session '${rootSessionId}' vanished after the delegation resolved (durable state anomaly)`,
        { rootSessionId },
      )
    }
    const workspace = resolveEffectiveWorkspace(member, teamSession)
    return {
      kind: 'continued',
      source: request.source,
      requestToken: request.requestToken,
      templateId: String(member.templateId),
      instanceId: String(member.instanceId),
      member,
      childSessionId: String(member.childSessionId),
      contextPolicy,
      ...(workspace !== undefined ? { workspace } : {}),
      createdAt: member.createdAt,
    }
  }

  /**
   * Re-drive an already-admitted durable operation (admit-once). Runs under
   * the team lock. The provision request is RECONSTRUCTED FROM THE DURABLE
   * INTENT PAYLOAD — the admitted content is authoritative. The only loud
   * conflict: the replay addresses a DIFFERENT template than the admitted one
   * (invariant 19: label/groupId/workspace drift on token replay is benign
   * convergence — the identity is `(rootSessionId, instanceId)`, not the
   * descriptive fields).
   */
  async function reDriveActivation(
    request: MemberActivationRequest,
    rootSessionId: string,
    blueprint: TeamBlueprint,
    identity: ActivationOperationIdentity,
    existingOp: OperationRecord,
  ): Promise<ActivationResult> {
    if (existingOp.phase === OPERATION_PHASES.FAILED) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.OPERATION_FAILED,
        `activation: the durable operation '${identity.operationId}' for this logical activation is terminally FAILED (abandoned — the journal protocol never roll-forwards a FAILED row); start a new logical operation with a new requestToken`,
        {
          operationId: identity.operationId,
          failureDiagnostic: existingOp.failureDiagnostic ?? null,
        },
      )
    }
    const replayed = existingOp.phase === OPERATION_PHASES.COMMITTED
    return withTeamLock(rootSessionId, async () => {
      const payload = existingOp.intent.payload
      const templateId = String(payload['templateId'])
      const requestedTemplate = requestedTemplateAddress(request)
      if (requestedTemplate !== undefined && requestedTemplate !== templateId) {
        throw new ActivationError(
          ACTIVATION_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          `activation: request token '${request.requestToken}' was already admitted for template '${templateId}' but this replay addresses '${requestedTemplate}' (the stable operation identity forbids re-admission under a different template)`,
          {
            operationId: identity.operationId,
            storedTemplateId: templateId,
            requestedTemplateId: requestedTemplate,
          },
        )
      }
      const coordinator = getCoordinator(rootSessionId)
      const provisionRequest: ProvisionRequest = {
        instanceId: String(payload['instanceId']),
        templateId,
        label: String(payload['label']),
        ...(payload['groupId'] !== undefined ? { groupId: String(payload['groupId']) } : {}),
        ...(payload['workspace'] !== undefined ? { workspace: String(payload['workspace']) } : {}),
        allocationToken: request.requestToken,
      }
      // Roll-forward through the provisioning coordinator: idempotent effects,
      // self-ensuring stages, terminal convergence to COMMITTED.
      const committed = await coordinator.recover(provisionRequest)
      if (committed.committed !== true || committed.childSessionId === undefined) {
        throw new ActivationError(
          ACTIVATION_ERROR_CODES.OPERATION_FAILED,
          `activation: the re-drive of operation '${identity.operationId}' did not converge to COMMITTED (durable state anomaly)`,
          { operationId: identity.operationId, stage: committed.stage },
        )
      }
      const childSessionId = String(committed.childSessionId)
      const template = resolveTemplate(blueprint, templateId)
      const contextPolicy = templateContextPolicy(template)
      const workspace = payload['workspace'] !== undefined ? String(payload['workspace']) : undefined
      return activatedResult(
        request,
        committed.member,
        identity,
        childSessionId,
        replayed,
        contextPolicy,
        workspace,
        undefined,
        undefined,
        committed.ledgerSequence,
      )
    })
  }

  /**
   * The full admission + provisioning order (DevPlan 19.2) for a NEW
   * activation, plus the admit-once convergence for an already-durable
   * operation.
   */
  async function activate(request: MemberActivationRequest): Promise<ActivationResult> {
    // step 0: closed grammar
    validateRequest(request)

    // step 1: resolve the durable TeamSession
    const teamSession = resolveTeamSession(repositories, request.rootSessionId)
    const rootSessionId = String(teamSession.rootSessionId)

    // step 2: resolve the bound immutable Blueprint (content-hash checked)
    const resolvedBlueprint = resolveBoundBlueprint(ports.blueprintCatalog, teamSession)
    const blueprint = resolvedBlueprint.blueprint

    // Admit-once (the convergence rule): the stable operation identity
    // (Architecture §18.2) is derived from (rootSessionId, source,
    // requestToken) BEFORE any per-source resolution. An EXISTING durable
    // operation for this logical activation converges immediately —
    // PREPARED/COMMITTED re-drive (roll-forward: no re-admission, no
    // re-quota, no re-compatibility); FAILED fails loudly. A retry never
    // re-runs admission: the durable admitted content is authoritative.
    // This also covers the delegate crash window where the member record
    // exists but the terminal commit was not yet driven: the admitted
    // operation is re-driven to COMMITTED instead of being shadowed by the
    // delegation mapping's 'continue' resolution.
    const identity: ActivationOperationIdentity = activationOperationIdentity(
      rootSessionId,
      request.source,
      request.requestToken,
    )
    const existingOp = repositories.operations.get(identity.operationId)
    if (existingOp !== undefined) {
      return await reDriveActivation(request, rootSessionId, blueprint, identity, existingOp)
    }

    // steps 3-5 (+ delegation target resolution): the create address
    const createTemplateAddress = requestedTemplateAddress(request)
    let createTemplateId: string
    if (request.source === ACTIVATION_SOURCES.LEADER_DELEGATE) {
      const delegation = request.delegation as { explicitInstanceId?: unknown; templateId?: unknown }
      if (delegation.explicitInstanceId !== undefined) {
        // Explicit address: template read from the addressed member; the
        // delegation target resolution below then ALWAYS continues.
        createTemplateId = String(
          templateForAddressedMember(blueprint, rootSessionId, String(delegation.explicitInstanceId)).templateId,
        )
      } else {
        createTemplateId = String(delegation.templateId)
      }
    } else {
      createTemplateId = String(request.templateId)
    }
    const template = resolveTemplate(blueprint, createTemplateId)

    // step 4: caller authority
    checkCallerAuthority(request.source, request.callerId)
    // step 5: source admission (closed vocabulary)
    admitSource(request.source)

    // Delegation target resolution (read-only; 'continue' short-circuits).
    if (request.source === ACTIVATION_SOURCES.LEADER_DELEGATE) {
      const delegation = request.delegation as { explicitInstanceId?: unknown; templateId?: unknown }
      const members = repositories.memberInstances.list(rootSessionId)
      const contextPolicy = templateContextPolicy(template)
      let target: DelegationTarget
      try {
        target = resolveDelegationTarget(
          parseRootSessionId(rootSessionId),
          contextPolicy,
          {
            ...(delegation.explicitInstanceId !== undefined
              ? { explicitInstanceId: parseInstanceId(String(delegation.explicitInstanceId)) }
              : {}),
            ...(delegation.templateId !== undefined
              ? { templateId: parseTemplateId(String(delegation.templateId)) }
              : {}),
          },
          members,
        )
      } catch (error) {
        throw mapDelegationTargetError(error, rootSessionId)
      }
      if (target.kind === 'continue') {
        const member = repositories.memberInstances.get(rootSessionId, String(target.instanceId))
        if (member === undefined) {
          throw new ActivationError(
            ACTIVATION_ERROR_CODES.DELEGATION_TARGET_UNRESOLVED,
            `activation: the resolved member '${String(target.instanceId)}' vanished before the continue read (durable state anomaly)`,
            { rootSessionId, instanceId: String(target.instanceId) },
          )
        }
        return continuedResult(request, rootSessionId, member, blueprint)
      }
      // 'create' (fresh_per_delegation / no_active_instance) falls through to
      // the full provisioning order below.
    }

    // step 6: compatibility (the new-work admission gate, invariant 50)
    const environmentFacts = await ports.environmentFacts()
    const compatibility = evaluateActivationCompatibility(
      blueprint,
      environmentFacts,
      request.acknowledgements,
    )

    // steps 7-15 under the team lock (all durable writes for this team are
    // serialized; the views below are fresh under the lock).
    return withTeamLock(rootSessionId, async () => {
      const members = repositories.memberInstances.list(rootSessionId)
      const operations = repositories.operations.list()
      const view = { members, operations }

      // step 7: quota
      const counts = countTeamQuota(view, rootSessionId, createTemplateId)
      checkQuota(blueprint.quotas, counts, createTemplateId)

      // step 8: policy (frozen at creation, invariant 29)
      const external = await ports.externalPolicyFacts()
      const policy = resolveActivationPolicy({
        rootSessionId,
        instanceId: identity.instanceId,
        overrides: repositories.overrides.list(rootSessionId),
        external,
      })

      // step 9: overlay bounds (the operation-level intersection)
      computeOverlayBounds(blueprint, createTemplateId)

      // step 10: workspace + context fields
      const fields = resolveCreationFields(teamSession, request, template)

      // step 11: instanceId allocation (collision-checked under the lock)
      const instanceId = allocateCheckedInstanceId(request, view)
      if (instanceId !== identity.instanceId) {
        // Unreachable (both derive from the same input) — fail loudly.
        throw new ActivationError(
          ACTIVATION_ERROR_CODES.INSTANCE_ID_CONFLICT,
          `activation: the allocated instance id '${instanceId}' diverges from the stable operation identity instance id '${identity.instanceId}' (internal derivation defect)`,
          { allocated: instanceId, identity: identity.instanceId },
        )
      }

      // step 12: journal prepare (the durable reservation)
      const coordinator = getCoordinator(rootSessionId)
      const provisionRequest: ProvisionRequest = {
        instanceId,
        templateId: createTemplateId,
        label: fields.label,
        ...(fields.groupId !== undefined ? { groupId: fields.groupId } : {}),
        ...(fields.workspace !== undefined ? { workspace: fields.workspace } : {}),
        allocationToken: request.requestToken,
      }
      await coordinator.allocate(provisionRequest)

      // step 13: child Agent+Session (external effect + unconditional barrier)
      await coordinator.createChildSession(provisionRequest)
      const status = coordinator.status({ instanceId })
      if (status.childSessionId === undefined) {
        throw new ActivationError(
          ACTIVATION_ERROR_CODES.CHILD_SESSION_CREATION_FAILED,
          `activation: the child session was not recorded after creation for instance '${instanceId}' (durable state anomaly)`,
          { instanceId, stage: status.stage },
        )
      }
      const childSessionId = String(status.childSessionId)

      // step 14: TeamDomain binding
      await coordinator.bindChildSession(provisionRequest)

      // step 15: commit the MemberInstance (the terminal durable fact)
      const committed = await coordinator.commitInstance(provisionRequest)

      // steps 14/16 tail: binder (work gate) + projection
      return activatedResult(
        request,
        committed.member,
        identity,
        childSessionId,
        false,
        fields.contextPolicy,
        fields.workspace,
        compatibility.status,
        policy.policyStateId,
        committed.ledgerSequence,
      )
    })
  }

  /**
   * Recovery entry: converge a crashed/abandoned activation. Same entry as
   * `activate` — a token with no durable operation row performs the fresh
   * activation (the full order); a durable row converges (re-drive) or fails
   * loudly (FAILED).
   */
  async function recoverActivation(request: MemberActivationRequest): Promise<ActivationResult> {
    return activate(request)
  }

  return { activate, recoverActivation }
}

/**
 * Re-exported here for provider consumers that need the TeamDomain type when
 * assembling ports (type-only; the provider itself only needs
 * `teamDomain.repositories` + the coordinator's `domain` port).
 */
export type { TeamDomain as ActivationTeamDomain } from '../../storage/repositories/index.js'

/**
 * TeamDomainError re-throw guard: durable protocol problems surface as
 * ActivationError with the matching provider code; anything else is
 * re-thrown UNWRAPPED (the caller sees the exact downstream fault).
 *
 * Exported for the test surface (and future provider siblings) that assemble
 * errors around the coordinator.
 */
export function mapActivationDurableError(error: unknown, context: Record<string, unknown>): unknown {
  if (isActivationError(error)) throw error
  if (isTeamDomainError(error)) {
    const details = (error.details ?? {}) as { problem?: unknown }
    const problem = typeof details.problem === 'string' ? details.problem : undefined
    if (problem === 'idempotency-conflict') {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        `activation: durable idempotency conflict: ${error.message}`,
        { ...context, code: error.code },
      )
    }
    if (problem === 'child-session-conflict') {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.CHILD_SESSION_CONFLICT,
        `activation: durable child session conflict: ${error.message}`,
        { ...context, code: error.code },
      )
    }
  }
  throw error
}

/** The leader instance id (re-exported for request construction). */
export { LEADER_INSTANCE_ID }

/** The closed activation source vocabulary (re-exported for callers). */
export { ACTIVATION_SOURCES, ACTIVATION_SOURCE_VALUES }
