/**
 * P3-T6 — team composition builder + canonical composition serializer.
 *
 * One shared, deterministic composition used across the t6 cross-module
 * test bundle: parse a Blueprint, bind its immutable snapshot to a
 * TeamSession record, and materialize N MemberInstances of one template
 * (Architecture §10.2, invariant 18: runtime identity =
 * `(rootSessionId, instanceId)`; invariant 9: TeamSessionId =
 * RootSessionId).
 *
 * `serializeComposition` / `parseComposition` give the G3 serialization
 * round-trip surface: the durable sidecar projection (TeamSession record +
 * member records + session bindings) as canonical JSON text, re-validated
 * by the contracts v1 parsers on the way back.
 *
 * Pure module: no I/O, no live Agent, no Node builtins.
 * @module @dsh-agent-team/testkit/domain/scenario
 */

import {
  parseBlueprint,
  toBlueprintSnapshotRef,
} from '../../../domain/blueprint/src/index.js'
import type { TeamBlueprint } from '../../../domain/blueprint/src/index.js'
import { createMemberInstance } from '../../../domain/member/src/index.js'
import type { MemberInstance } from '../../../domain/member/src/index.js'
import {
  blueprintSnapshotKey,
  canonicalJsonStringify,
  createMemberIdentity,
  createTeamSessionRecord,
  deepFreeze,
  parseChildSessionId,
  parseInstanceId,
  parseMemberInstanceRecord,
  parseRootSessionId,
  parseSessionBinding,
  parseTeamSessionRecord,
  parseTemplateId,
  teamSessionIdOf,
} from '../../../contracts/src/index.js'
import type {
  BlueprintSnapshotRef,
  MemberIdentity,
  MemberInstanceRecordDto,
  RootSessionId,
  SessionBindingDto,
  TeamSessionId,
  TeamSessionRecordDto,
  TemplateId,
} from '../../../contracts/src/index.js'

/** The TeamSession root session id used by every t6 composition. */
export const T6_ROOT_SESSION_ID: RootSessionId = parseRootSessionId('session-team-root-1')

/** The fixed creation timestamp (ISO-8601) of every t6 record. */
export const T6_CREATED_AT = '2026-08-29T12:00:00Z'

/** The single member template the t6 compositions instantiate. */
export const T6_DEFAULT_TEMPLATE_ID: TemplateId = parseTemplateId('researcher')

/** The shared human-facing label (NOT a runtime identity, invariant 19). */
export const T6_DEFAULT_LABEL = 'Fourier'

/** Two-digit zero padding for deterministic member addressing. */
export function t6Pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** The instance id of the i-th member (1-based): `inst-m01`, `inst-m02`, … */
export function t6InstanceIdAt(i: number): string {
  return `inst-m${t6Pad2(i)}`
}

/** The child session id bound to the i-th member (invariant 23). */
export function t6ChildSessionIdAt(i: number): string {
  return `session-child-1-${t6Pad2(i)}`
}

/** Options for {@link buildTeamComposition}. */
export interface TeamCompositionOptions {
  /** The blueprint source document (frontmatter YAML, empty body). */
  readonly blueprintSource: string
  /** How many members to materialize (0 allowed). */
  readonly memberCount: number
  /** Member template id. Default: `researcher`. */
  readonly templateId?: TemplateId
  /** Member label. Default: `Fourier`. */
  readonly label?: string
  /** Team default workspace (inherited by members, §21.2). */
  readonly defaultWorkspace?: string
  /**
   * The contextPolicy to freeze at member creation (§21.6). Default:
   * the member package's default (`persistent`).
   */
  readonly contextPolicy?: string
}

/** One fully built, deeply-frozen team composition. */
export interface TeamComposition {
  /** The validated blueprint (deeply frozen). */
  readonly blueprint: TeamBlueprint
  /** The immutable snapshot ref bound to the TeamSession (invariant 10). */
  readonly snapshotRef: BlueprintSnapshotRef
  /** `<blueprintId>@<revision>` key of the snapshot. */
  readonly snapshotKey: string
  /** The root DSH session id of the TeamSession. */
  readonly rootSessionId: RootSessionId
  /** The TeamSessionId — identical to the root session id (invariant 9). */
  readonly teamSessionId: TeamSessionId
  /** The TeamDomain record of the TeamSession (v1 identity core). */
  readonly teamSession: TeamSessionRecordDto
  /** The live MemberInstance objects (record + frozen policy + residency). */
  readonly members: readonly MemberInstance[]
  /** The member records in creation order. */
  readonly memberRecords: readonly MemberInstanceRecordDto[]
  /** The member runtime identities `(rootSessionId, instanceId)`. */
  readonly identities: readonly MemberIdentity[]
  /** Session bindings: one team-root + one team-member per member. */
  readonly bindings: readonly SessionBindingDto[]
  /** The fixed creation timestamp. */
  readonly createdAt: string
}

/**
 * Build one deterministic team composition from a blueprint source:
 * parse the blueprint, bind its snapshot to a new TeamSession record, and
 * materialize `memberCount` members of one template.
 *
 * Every input is validated from scratch against contracts v1 (the member
 * domain parses all fields from unknown); the result is deeply frozen.
 */
export function buildTeamComposition(options: TeamCompositionOptions): TeamComposition {
  const rootSessionId = T6_ROOT_SESSION_ID
  const teamSessionId = teamSessionIdOf(rootSessionId)
  const blueprint = parseBlueprint(options.blueprintSource)
  const snapshotRef = toBlueprintSnapshotRef(blueprint)
  const snapshotKey = blueprintSnapshotKey(snapshotRef)
  const createdAt = T6_CREATED_AT

  const teamSession = createTeamSessionRecord({
    rootSessionId,
    blueprint: snapshotRef,
    ...(options.defaultWorkspace === undefined ? {} : { defaultWorkspace: options.defaultWorkspace }),
    createdAt,
    generation: 1,
  })

  const templateId = options.templateId ?? T6_DEFAULT_TEMPLATE_ID
  const label = options.label ?? T6_DEFAULT_LABEL

  const members: MemberInstance[] = []
  let existing: readonly MemberInstanceRecordDto[] = []
  for (let i = 1; i <= options.memberCount; i++) {
    const member = createMemberInstance(
      {
        rootSessionId,
        instanceId: parseInstanceId(t6InstanceIdAt(i)),
        templateId,
        label,
        childSessionId: parseChildSessionId(t6ChildSessionIdAt(i)),
        ...(options.contextPolicy === undefined ? {} : { contextPolicy: options.contextPolicy }),
        createdAt,
      },
      existing,
    )
    members.push(member)
    existing = [...existing, member.record]
  }

  const memberRecords = members.map((member) => member.record)
  const identities = members.map((member) =>
    createMemberIdentity(rootSessionId, member.record.instanceId),
  )
  const bindings: SessionBindingDto[] = [
    parseSessionBinding({
      schemaVersion: 1,
      kind: 'team-root',
      sessionId: teamSessionId,
    }),
    ...members.map((member) =>
      parseSessionBinding({
        schemaVersion: 1,
        kind: 'team-member',
        sessionId: member.record.childSessionId,
        rootSessionId,
        instanceId: member.record.instanceId,
      }),
    ),
  ]

  return deepFreeze({
    blueprint,
    snapshotRef,
    snapshotKey,
    rootSessionId,
    teamSessionId,
    teamSession,
    members,
    memberRecords,
    identities,
    bindings,
    createdAt,
  })
}

/** The durable sidecar projection of a composition (what is serialized). */
export interface ParsedComposition {
  readonly rootSessionId: RootSessionId
  readonly teamSessionId: TeamSessionId
  readonly snapshotRef: BlueprintSnapshotRef
  readonly snapshotKey: string
  readonly teamSession: TeamSessionRecordDto
  readonly memberRecords: readonly MemberInstanceRecordDto[]
  readonly bindings: readonly SessionBindingDto[]
}

/**
 * Serialize the durable projection of a composition as canonical JSON
 * (sorted keys, byte-stable across key insertion order).
 */
export function serializeComposition(composition: TeamComposition): string {
  return canonicalJsonStringify({
    rootSessionId: composition.rootSessionId,
    teamSession: composition.teamSession,
    members: composition.memberRecords,
    bindings: composition.bindings,
  })
}

function asJsonObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`parsed composition field '${field}' must be an object`)
  }
  return value as Record<string, unknown>
}

function asJsonArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`parsed composition field '${field}' must be an array`)
  }
  return value
}

/**
 * Re-parse and re-validate a serialized composition (the round-trip half of
 * `serializeComposition`): each part is validated from the decoded JSON by
 * the contracts v1 parsers (untrusted-value boundary), then re-assembled
 * into a deeply-frozen composition view.
 */
export function parseComposition(json: string): ParsedComposition {
  const outer = asJsonObject(JSON.parse(json), '$')
  const rootSessionId = parseRootSessionId(outer['rootSessionId'])
  const teamSession = parseTeamSessionRecord(outer['teamSession'])
  const memberRecords = asJsonArray(outer['members'], 'members').map((entry) =>
    parseMemberInstanceRecord(entry),
  )
  const bindings = asJsonArray(outer['bindings'], 'bindings').map((entry) =>
    parseSessionBinding(entry),
  )
  const snapshotRef = teamSession.blueprint
  return deepFreeze({
    rootSessionId,
    teamSessionId: teamSessionIdOf(rootSessionId),
    snapshotRef,
    snapshotKey: blueprintSnapshotKey(snapshotRef),
    teamSession,
    memberRecords,
    bindings,
  })
}
