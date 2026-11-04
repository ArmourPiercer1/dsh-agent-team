/**
 * Alpha.5 PRODUCT ASSEMBLY — the product-visible declaration that gives a
 * Member its compiled realm.
 *
 * THE GAP THIS CLOSES (external Alpha.5 review, 2026-11-05): the confined
 * Member realm (`installMemberIoProviders` / `mountA5sfRealm` /
 * `installToolBindingRealm`) was exercised by EVIDENCE ROWS and test presets,
 * but a product-configured Member never got it. The only enablement the
 * product row understood was `config.a5sfEvidencePath` (an evidence SINK) plus
 * a `teamA5sfRealm` service that no product code provided, so a World composed
 * from the acceptance preset alone gave no agent a confined face. This module
 * is the missing product half: a DECLARATION in the product row config that a
 * Member's configuration declares a Member ceiling and/or ToolBindings, and
 * the SAME seams the evidence row uses are driven from it.
 *
 * WHAT IS A DECLARATION, AND WHAT IS NOT.
 *   - It is authored in the CLOSED v4 vocabulary already in the product:
 *     `memberIoCeilings[].io` (the Member ceiling) and a `toolBindings[]`
 *     entry's `io` + `execution` block (the ToolRestriction). No new grammar,
 *     no new lane shape, no second validator: the declaration is turned into a
 *     v4 Blueprint SOURCE and parsed by the ONE shipped parser
 *     (`parseBlueprintV4`), then compiled by the ONE shipped compiler
 *     (`compileMemberPolicy` / `projectToolIoRestriction` /
 *     `compileEffectiveIo`).
 *   - It is NOT an approval authority and NOT a grant. `authority` is the
 *     composition's REFERENCE to the Alpha.4 effective authority already
 *     computed by the ONE approval authority (ControlService): this module
 *     never evaluates an approval, never mints a case and never widens a lane.
 *     `approvedOnce` is passed as `false` at binding compile time — approval is
 *     irrelevant to a hard ceiling.
 *   - It is NOT a hidden switch. A Member is managed iff its TEMPLATE has a
 *     declaration here; a template without one answers `undefined` from
 *     `compiledFor` and the product row mounts nothing (byte-identical legacy
 *     path — no provider mount, no fact, no tool-plane change).
 *
 * FAIL CLOSED — the faces this realm does NOT own refuse at composition time
 * with the SAME `TeamServiceInstallError` idiom the seams already use:
 *   - a ToolBinding whose `execution.executionBoundary` is
 *     `confined-subprocess` asks for a binding-scoped PROCESS face; the
 *     binding realm owns `fs` only (measured `UNSUPPORTED` by the search live
 *     round) -> `SUBPROCESS_UNCONFINED_REALM` (BL-17's code, reused verbatim);
 *   - `delegated-remote` asks for a remote face this realm does not own ->
 *     `NETWORK_UNCONFINED_REALM`;
 *   - a ceiling or restriction that NARROWS the network axis (`deny`) cannot be
 *     enforced because no web face is installed on the realm -> the same
 *     `NETWORK_UNCONFINED_REALM`; `network: restricted` is refused by the
 *     compiler (`IO_POLICY_UNSUPPORTED`) and surfaces as
 *     `MEMBER_POLICY_UNAVAILABLE` with the compiler's own code in the detail;
 *   - a malformed/ambiguous declaration -> `REALM_DECLARATION_INVALID`.
 * A declaration that cannot be expressed is REFUSED, never silently mounted
 * as a narrower answer.
 *
 * WHAT IS DELIBERATELY NOT REACHABLE FROM PRODUCT CONFIG (stated, not faked):
 * the confined `subprocess` face needs a `ConfinedProcessProvider` built by
 * the composition that owns the P1-07 launcher pin. Product CONFIG cannot name
 * a launcher/binary assembly, so the product declaration cannot request a
 * process face — that half stays evidence-only until a product composition
 * ships the provider. `REALM_DECLARATION_INVALID`/`SUBPROCESS_UNCONFINED_REALM`
 * name the absence instead of pretending.
 *
 * @module @dsh-agent-team/runtime/team-services/product-assembly
 */

import {
  parseBlueprintV4,
  type TeamBlueprintV4,
  type V4MemberIoCeilingAuthoring,
  type V4ToolBindingAuthoring,
} from '../../../domain/blueprint/src/index.js'
import {
  compileEffectiveIo,
  compileMemberPolicy,
  projectToolIoRestriction,
} from '../../member-io-policy/src/index.js'
import type {
  EffectiveIoPolicy,
  MemberPolicy,
  ToolIoRestriction,
  TrustedMemberIdentity,
} from '../../member-io-policy/src/types.js'
import type { A5sfRealmBinding, A5sfRealmMember } from './mount.js'
import { TeamServiceInstallError } from './types.js'

/**
 * The row-config key that carries the product declaration.
 *
 * KEPT IN THIS MODULE (not only in the plain-JS row) so the product type
 * surface, the parser and the tests all name the SAME token: a key that only
 * lived in an `.mjs` row would be re-typed by every reader.
 */
export const A5SF_MEMBER_POLICIES_KEY = 'a5sfMemberPolicies'

/** The declaration schema token, versioned like every other seam in this lane. */
export const A5SF_PRODUCT_REALM_SCHEMA = 'a5sf-product-member-policies/1' as const

/**
 * ONE product-declared Member template.
 *
 * `ceiling` is the EXACT v4 `memberIoCeilings[].io` block (read/write/network
 * lanes, same closed shape) and `toolRestrictions` entries are the EXACT v4
 * `toolBindings[]` entry shape. Nothing here is a Team-Team-local dialect.
 */
export interface A5sfProductMemberDeclaration {
  /** The template this declaration manages (the MemberInstance's template). */
  readonly templateId: string
  /** The monotonic instance generation this ceiling is compiled for. */
  readonly instanceGeneration: number
  /** The Member ceiling, in the v4 `memberIoCeilings[].io` shape. */
  readonly ceiling: V4MemberIoCeilingAuthoring['io']
  /**
   * Zero or more per-tool restrictions (the RIGHT factor of the invariant),
   * in the v4 `toolBindings[]` entry shape — INCLUDING `execution`, whose
   * `executionBoundary` tells this assembler which face must serve the tool.
   */
  readonly toolRestrictions?: readonly V4ToolBindingAuthoring[]
}

/**
 * The product declaration a composition puts in the Team row config:
 *
 * ```yaml
 * a5sfMemberPolicies:
 *   schema: a5sf-product-member-policies/1
 *   teamId: team.a5sf.product
 *   blueprintRevision: '1'
 *   authority: { revision: 'a4:42', admitted: true }
 *   members:
 *     - templateId: worker
 *       instanceGeneration: 1
 *       ceiling:
 *         read:  { mode: restricted, allow: ['/work'], ask: [], deny: [] }
 *         write: { mode: restricted, allow: ['/work'], ask: [], deny: [] }
 *         network: { mode: allow }
 *       toolRestrictions:
 *         - owner: dsh.fs
 *           name: read
 *           authorization: ask
 *           io:
 *             read:  { mode: restricted, allow: ['/work/docs'], ask: [], deny: [] }
 *             write: { mode: all, deny: [] }
 *             network: { mode: allow }
 *           execution: { implementationOrigin: dsh-native, executionBoundary: trusted-host }
 * ```
 *
 * A template absent from `members` is UNMANAGED: no realm, no facts, no tool
 * surface change.
 */
export interface A5sfProductRealmDeclaration {
  readonly schema: typeof A5SF_PRODUCT_REALM_SCHEMA
  readonly teamId: string
  /** The human revision stamped into the synthetic v4 document's identity. */
  readonly blueprintRevision: string
  /**
   * The composition's REFERENCE to the Alpha.4 effective authority. Consumed
   * verbatim as the compiler's `effectiveAuthority`; this module never
   * evaluates an approval and cannot widen a ceiling from it.
   */
  readonly authority: Readonly<{
    readonly revision: string
    readonly admitted: boolean
  }>
  readonly members: readonly A5sfProductMemberDeclaration[]
}

/** One managed template, already validated and projected by the ONE lane. */
export interface A5sfProductManagedMember {
  readonly templateId: string
  readonly instanceGeneration: number
  /** Already projected by `projectToolIoRestriction` (never re-derived here). */
  readonly restrictions: readonly ToolIoRestriction[]
}

/**
 * The VALIDATED composition plan: a real v4 blueprint (ceiling family included)
 * plus the projected restrictions. Produced once by
 * {@link parseProductRealmDeclaration} at row-assembly time, so a malformed or
 * unexpressible declaration refuses BEFORE any Member is set up.
 */
export interface A5sfProductRealmPlan {
  readonly schema: typeof A5SF_PRODUCT_REALM_SCHEMA
  readonly teamId: string
  readonly authority: Readonly<{ readonly revision: string; readonly admitted: boolean }>
  readonly blueprint: TeamBlueprintV4
  readonly members: readonly A5sfProductManagedMember[]
}

/** The lazy provider answer the product row consumes (`compiledFor`). */
export interface A5sfProductRealmProvider {
  compiledFor(member: unknown): A5sfProductCompiledAnswer | undefined
}

export interface A5sfProductCompiledAnswer {
  readonly members: readonly A5sfRealmMember[]
  readonly bindings?: readonly A5sfRealmBinding[]
  readonly providerClass?: unknown
}

/** The reserved scaffold leader template id (never a declared Member template). */
const SCAFFOLD_LEADER_TEMPLATE = 'a5sf-product-scaffold-leader'

const DECLARATION_KEYS = ['schema', 'teamId', 'blueprintRevision', 'authority', 'members'] as const
const AUTHORITY_KEYS = ['revision', 'admitted'] as const
const MEMBER_KEYS = ['templateId', 'instanceGeneration', 'ceiling', 'toolRestrictions'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function refuse(code: ConstructorParameters<typeof TeamServiceInstallError>[0], detail: string, path: string): never {
  throw new TeamServiceInstallError(code, detail, path)
}

/** Unknown-key / missing-key gate for the closed declaration shapes. */
function closedRecord(
  raw: unknown,
  allowed: readonly string[],
  where: string,
  required: readonly string[] = allowed,
): Record<string, unknown> {
  if (!isRecord(raw)) refuse('REALM_DECLARATION_INVALID', `${where} must be a record`, where)
  const unknown = Object.keys(raw).filter((key) => !allowed.includes(key))
  if (unknown.length > 0) {
    refuse(
      'REALM_DECLARATION_INVALID',
      `${where} carries field(s) ${JSON.stringify(unknown)} outside the closed shape ${JSON.stringify(allowed)}; a typo must never silently declare nothing`,
      where,
    )
  }
  const missing = required.filter((key) => !Object.hasOwn(raw, key))
  if (missing.length > 0) {
    refuse('REALM_DECLARATION_INVALID', `${where} is missing required field(s) ${JSON.stringify(missing)}`, where)
  }
  return raw
}

/**
 * The synthetic v4 document SOURCE the ONE parser accepts.
 *
 * WHY SYNTHETIC: the declaration is a per-Member SUBSET of a Team blueprint
 * (identity + the ceiling family). The compiler consumes a real
 * `TeamBlueprintV4`, and the lane's law is "never a second validator", so the
 * declaration is expanded into a minimal, VALID v4 document — one scaffold
 * leader template plus one Member template per declaration — and handed to
 * `parseBlueprintV4`. Every lane/grammar problem is therefore found by the
 * SHIPPED v4 validator at its own path, and the resulting `contentHash` is the
 * real content identity of exactly the declared ceilings.
 *
 * The scaffold leader is NOT a managed Member: the row never mounts a realm for
 * the leader session (`sessionId !== teamRoot`), and a declaration may not use
 * the reserved id.
 */
function blueprintSourceOf(declaration: A5sfProductRealmDeclaration): string {
  const document = {
    schemaVersion: 4,
    blueprintId: declaration.teamId,
    revision: declaration.blueprintRevision,
    leader: { templateId: SCAFFOLD_LEADER_TEMPLATE, persona: 'Product assembly scaffold (not a managed Member).' },
    members: declaration.members.map((member) => ({
      templateId: member.templateId,
      persona: `Product-declared managed Member template '${member.templateId}'.`,
    })),
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: declaration.members.map((member) => ({
      templateId: member.templateId,
      io: member.ceiling,
    })),
  }
  // JSON is valid YAML: the frontmatter pipeline stays the ONE parse path.
  return `---\n${JSON.stringify(document, null, 2)}\n---\n`
}

/**
 * Validate ONE ToolBinding declaration and refuse the faces this realm does not
 * own BEFORE projecting any lane.
 *
 * ORDER IS LOAD-BEARING: the face check runs first, so a
 * `confined-subprocess` binding refuses with the BL-17 code instead of first
 * failing (or worse, succeeding) a lane projection and looking like a generic
 * policy problem.
 */
function projectedRestrictionOf(
  raw: unknown,
  where: string,
): ToolIoRestriction {
  const binding = closedRecord(raw, ['owner', 'name', 'authorization', 'io', 'execution'], where)
  const execution = closedRecord(binding['execution'], ['implementationOrigin', 'executionBoundary'], `${where}.execution`)
  const boundary = execution['executionBoundary']
  if (boundary === 'confined-subprocess') {
    refuse(
      'SUBPROCESS_UNCONFINED_REALM',
      `${where} declares a binding-scoped PROCESS face (executionBoundary=confined-subprocess);`
      + ' a tool-binding realm owns a confined `fs` and NO confined `subprocess` face, so the search/CLI'
      + ' two-axis restriction is UNSUPPORTED — the declaration is refused instead of mounting a narrower answer',
      where,
    )
  }
  if (boundary === 'delegated-remote') {
    refuse(
      'NETWORK_UNCONFINED_REALM',
      `${where} declares a delegated-remote execution boundary; the Member realm owns no remote/web face,`
      + ' so the restriction cannot be enforced locally',
      where,
    )
  }
  if (boundary !== 'trusted-host') {
    refuse(
      'REALM_DECLARATION_INVALID',
      `${where}.execution.executionBoundary=${JSON.stringify(boundary)} has no realm face in this lane`,
      where,
    )
  }
  const projected = projectToolIoRestriction(binding as unknown as Parameters<typeof projectToolIoRestriction>[0])
  if (!projected.ok) {
    refuse(
      'MEMBER_POLICY_UNAVAILABLE',
      `${where} could not be projected (${projected.code}: ${projected.detail}); a restriction that cannot compile never mounts`,
      where,
    )
  }
  const restriction = projected.value
  if (restriction.network !== 'allow') {
    refuse(
      'NETWORK_UNCONFINED_REALM',
      `${where} narrows the network axis (${restriction.network}); the Member realm installs no web face,`
      + ' so a network narrowing would be a claim with no enforcement',
      `${where}.io.network`,
    )
  }
  return restriction
}

/**
 * Parse + validate a product declaration into a composition plan.
 *
 * REFUSES (typed, before any Member is set up):
 *   - a non-record / wrong schema / unknown or missing field;
 *   - a blank team id or blueprint revision, a bad authority reference;
 *   - an empty Member list, a duplicate template, the reserved scaffold id;
 *   - any ceiling the shipped v4 validator refuses;
 *   - any ToolBinding whose face this realm does not own
 *     (`SUBPROCESS_UNCONFINED_REALM` / `NETWORK_UNCONFINED_REALM`) or whose
 *     lanes cannot project (`MEMBER_POLICY_UNAVAILABLE`).
 */
export function parseProductRealmDeclaration(raw: unknown): A5sfProductRealmPlan {
  const declaration = closedRecord(raw, DECLARATION_KEYS, `${A5SF_MEMBER_POLICIES_KEY}`)
  if (declaration['schema'] !== A5SF_PRODUCT_REALM_SCHEMA) {
    refuse(
      'REALM_DECLARATION_INVALID',
      `${A5SF_MEMBER_POLICIES_KEY}.schema must be ${JSON.stringify(A5SF_PRODUCT_REALM_SCHEMA)}`,
      `${A5SF_MEMBER_POLICIES_KEY}.schema`,
    )
  }
  const teamId = declaration['teamId']
  if (typeof teamId !== 'string' || teamId.trim() === '') {
    refuse('REALM_DECLARATION_INVALID', `${A5SF_MEMBER_POLICIES_KEY}.teamId must be a non-blank string`, `${A5SF_MEMBER_POLICIES_KEY}.teamId`)
  }
  const blueprintRevision = declaration['blueprintRevision']
  if (typeof blueprintRevision !== 'string' || blueprintRevision.trim() === '') {
    refuse(
      'REALM_DECLARATION_INVALID',
      `${A5SF_MEMBER_POLICIES_KEY}.blueprintRevision must be a non-blank string`,
      `${A5SF_MEMBER_POLICIES_KEY}.blueprintRevision`,
    )
  }
  const authorityRaw = closedRecord(declaration['authority'], AUTHORITY_KEYS, `${A5SF_MEMBER_POLICIES_KEY}.authority`)
  if (typeof authorityRaw['revision'] !== 'string' || authorityRaw['revision'].trim() === '') {
    refuse(
      'REALM_DECLARATION_INVALID',
      `${A5SF_MEMBER_POLICIES_KEY}.authority.revision must be a non-blank string: the Alpha.4 authority reference is consumed verbatim and is never invented here`,
      `${A5SF_MEMBER_POLICIES_KEY}.authority.revision`,
    )
  }
  if (typeof authorityRaw['admitted'] !== 'boolean') {
    refuse(
      'REALM_DECLARATION_INVALID',
      `${A5SF_MEMBER_POLICIES_KEY}.authority.admitted must be a boolean (the Alpha.4 admission fact, referenced not decided)`,
      `${A5SF_MEMBER_POLICIES_KEY}.authority.admitted`,
    )
  }
  const membersRaw = declaration['members']
  if (!Array.isArray(membersRaw) || membersRaw.length === 0) {
    refuse(
      'REALM_DECLARATION_INVALID',
      `${A5SF_MEMBER_POLICIES_KEY}.members must be a non-empty array (an empty declaration declares no managed Member and must be omitted, never present-and-empty)`,
      `${A5SF_MEMBER_POLICIES_KEY}.members`,
    )
  }
  const seen = new Set<string>()
  const members: A5sfProductManagedMember[] = []
  const normalised: A5sfProductMemberDeclaration[] = []
  membersRaw.forEach((entry, index) => {
    const where = `${A5SF_MEMBER_POLICIES_KEY}.members[${String(index)}]`
    const member = closedRecord(entry, MEMBER_KEYS, where, ['templateId', 'instanceGeneration', 'ceiling'])
    const templateId = member['templateId']
    if (typeof templateId !== 'string' || templateId.trim() === '') {
      refuse('REALM_DECLARATION_INVALID', `${where}.templateId must be a non-blank template id`, `${where}.templateId`)
    }
    if (templateId === SCAFFOLD_LEADER_TEMPLATE) {
      refuse(
        'REALM_DECLARATION_INVALID',
        `${where}.templateId ${JSON.stringify(templateId)} is the assembler's RESERVED scaffold identity and can never name a managed Member`,
        `${where}.templateId`,
      )
    }
    if (seen.has(templateId)) {
      refuse(
        'REALM_DECLARATION_INVALID',
        `${where}.templateId ${JSON.stringify(templateId)} is declared twice; two ceilings for one Member have no single meaning`,
        `${where}.templateId`,
      )
    }
    seen.add(templateId)
    const instanceGeneration = member['instanceGeneration']
    if (typeof instanceGeneration !== 'number' || !Number.isInteger(instanceGeneration) || instanceGeneration < 0) {
      refuse(
        'REALM_DECLARATION_INVALID',
        `${where}.instanceGeneration must be a non-negative integer`,
        `${where}.instanceGeneration`,
      )
    }
    if (!isRecord(member['ceiling'])) {
      refuse('REALM_DECLARATION_INVALID', `${where}.ceiling must be the v4 io block`, `${where}.ceiling`)
    }
    // The NETWORK axis is refused HERE, before the v4 parse: this realm installs
    // no web face, so a narrowed network lane is a claim with no enforcement.
    // Refusing early keeps the answer specific (`NETWORK_UNCONFINED_REALM`)
    // instead of letting the compiler report a generic unsupported projection.
    const networkLane = (member['ceiling'] as Record<string, unknown>)['network']
    if (isRecord(networkLane) && networkLane['mode'] !== 'allow') {
      refuse(
        'NETWORK_UNCONFINED_REALM',
        `${where}.ceiling.network narrows the network axis (mode=${JSON.stringify(networkLane['mode'])});`
        + ' the Member realm installs no web face, so the narrowing could not be enforced',
        `${where}.ceiling.network`,
      )
    }
    const restrictionsRaw = member['toolRestrictions']
    if (restrictionsRaw !== undefined && !Array.isArray(restrictionsRaw)) {
      refuse(
        'REALM_DECLARATION_INVALID',
        `${where}.toolRestrictions must be an array of v4 toolBindings entries when present`,
        `${where}.toolRestrictions`,
      )
    }
    const restrictions = (restrictionsRaw ?? []).map((restriction, restrictionIndex) => projectedRestrictionOf(
      restriction,
      `${where}.toolRestrictions[${String(restrictionIndex)}]`,
    ))
    const identities = new Set<string>()
    for (const restriction of restrictions) {
      if (identities.has(restriction.bindingIdentity)) {
        refuse(
          'REALM_DECLARATION_INVALID',
          `${where} declares ToolBinding ${JSON.stringify(restriction.bindingIdentity)} twice; one Member x one tool has one restriction`,
          `${where}.toolRestrictions`,
        )
      }
      identities.add(restriction.bindingIdentity)
    }
    normalised.push({
      templateId,
      instanceGeneration,
      ceiling: member['ceiling'] as V4MemberIoCeilingAuthoring['io'],
      ...(restrictionsRaw === undefined ? {} : { toolRestrictions: restrictionsRaw as readonly V4ToolBindingAuthoring[] }),
    })
    members.push(Object.freeze({ templateId, instanceGeneration, restrictions: Object.freeze(restrictions) }))
  })

  // ONE parse of the synthetic v4 document: the shipped validator owns every
  // lane check and the content hash, so this module adds no grammar.
  let blueprint: TeamBlueprintV4
  try {
    blueprint = parseBlueprintV4(blueprintSourceOf({
      schema: A5SF_PRODUCT_REALM_SCHEMA,
      teamId,
      blueprintRevision,
      authority: { revision: authorityRaw['revision'], admitted: authorityRaw['admitted'] },
      members: normalised,
    }))
  } catch (error) {
    throw new TeamServiceInstallError(
      'REALM_DECLARATION_INVALID',
      `${A5SF_MEMBER_POLICIES_KEY}: the v4 validator refused the declared ceiling family: ${error instanceof Error ? error.message : String(error)}`,
      A5SF_MEMBER_POLICIES_KEY,
    )
  }

  return Object.freeze({
    schema: A5SF_PRODUCT_REALM_SCHEMA,
    teamId,
    authority: Object.freeze({ revision: authorityRaw['revision'] as string, admitted: authorityRaw['admitted'] as boolean }),
    blueprint,
    members: Object.freeze(members),
  })
}

/** The Member descriptor the product row hands `compiledFor` (defensively read). */
interface MemberDescriptor {
  readonly instanceId: string
  readonly templateId: string
}

function descriptorOf(raw: unknown): MemberDescriptor {
  if (!isRecord(raw)) {
    refuse(
      'MEMBER_IDENTITY_INVALID',
      'the row handed compiledFor a non-record Member descriptor; a ceiling cannot bind an unknown identity',
      'member',
    )
  }
  const instanceId = raw['instanceId']
  const templateId = raw['templateId']
  if (typeof instanceId !== 'string' || instanceId.trim() === '') {
    refuse(
      'MEMBER_IDENTITY_INVALID',
      'the row handed compiledFor a Member descriptor with no instanceId; a ceiling cannot bind an unknown identity',
      'member.instanceId',
    )
  }
  if (typeof templateId !== 'string' || templateId.trim() === '') {
    refuse(
      'MEMBER_IDENTITY_INVALID',
      `Member '${instanceId}' has no templateId; a declared ceiling is a TEMPLATE fact and cannot be guessed from argv/cwd/UI`,
      'member.templateId',
    )
  }
  return { instanceId, templateId }
}

/**
 * Build the lazy `{ compiledFor }` provider from a validated plan.
 *
 * The provider is the SAME shape the evidence row supplies to
 * `teamA5sfRealm`; the only difference is its SOURCE (product config instead of
 * a fixture). Every returned object is compiled by the ONE compiler; nothing
 * here decides a lane.
 *
 * A template with no declaration answers `undefined` — that Member is
 * UNMANAGED and the row mounts nothing (requirement: unmanaged Members stay
 * byte-identical).
 */
export function createProductRealmProvider(plan: A5sfProductRealmPlan): A5sfProductRealmProvider {
  const byTemplate = new Map(plan.members.map((member) => [member.templateId, member]))
  return Object.freeze({
    compiledFor(rawMember: unknown): A5sfProductCompiledAnswer | undefined {
      const descriptor = descriptorOf(rawMember)
      const managed = byTemplate.get(descriptor.templateId)
      if (managed === undefined) return undefined

      const identity: TrustedMemberIdentity = Object.freeze({
        teamId: plan.teamId,
        memberInstanceId: descriptor.instanceId,
        templateId: descriptor.templateId,
        instanceGeneration: managed.instanceGeneration,
      })
      const policy = compileMemberPolicy({
        trustedMember: identity,
        boundBlueprint: { teamId: plan.teamId, blueprint: plan.blueprint },
        effectiveAuthority: {
          revision: plan.authority.revision,
          memberInstanceId: descriptor.instanceId,
          instanceGeneration: managed.instanceGeneration,
          admitted: plan.authority.admitted,
        },
      })
      if (!policy.ok) {
        refuse(
          'MEMBER_POLICY_UNAVAILABLE',
          `Member '${descriptor.instanceId}' (template '${descriptor.templateId}') could not compile its ceiling`
          + ` (${policy.code}: ${policy.detail}); a declared realm never mounts on an uncompiled policy`,
          policy.path,
        )
      }
      const compiledPolicy: MemberPolicy = policy.value
      const bindings: A5sfRealmBinding[] = managed.restrictions.map((restriction) => {
        const effective = compileEffectiveIo(compiledPolicy, restriction, {
          memberIdentity: identity.memberInstanceId,
          callId: `a5sf-product-realm:${identity.memberInstanceId}:${restriction.bindingIdentity}`,
          policyRevision: compiledPolicy.revision,
          toolBindingIdentity: restriction.bindingIdentity,
          // Approval never widens a hard ceiling, so the realm compiles the
          // intersection with the UN-approved input. The approval authority is
          // Alpha.4, at call time, and stays there.
          approvedOnce: false,
        })
        if (!effective.ok) {
          refuse(
            'MEMBER_POLICY_UNAVAILABLE',
            `ToolBinding '${restriction.bindingIdentity}' of Member '${identity.memberInstanceId}' could not compile`
            + ` its effective lane (${effective.code}: ${effective.detail})`,
            effective.path,
          )
        }
        return Object.freeze({
          identity,
          toolBindingIdentity: restriction.bindingIdentity,
          effective: effective.value as EffectiveIoPolicy,
        })
      })
      return Object.freeze({
        members: Object.freeze([{ identity, policy }]),
        ...(managed.restrictions.length === 0 ? {} : { bindings: Object.freeze(bindings) }),
      })
    },
  })
}
