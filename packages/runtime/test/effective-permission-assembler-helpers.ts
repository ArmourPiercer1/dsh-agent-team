/**
 * effective-permission-assembler-helpers — shared fixtures for the Alpha.3
 * PR2 (`EffectivePermissionAssembler`) specs.
 *
 * FIXTURE DATA ONLY — no production logic. Not a test file (no `.test.ts`
 * suffix); it is type-checked with the package.
 *
 * What the fixtures model, and what they deliberately do NOT model:
 *
 * - A canonical operation and canonical rules are LITERALS (opaque keys),
 *   exactly as in the A3 resolver spec: nothing here resolves a path, touches
 *   the filesystem or calls `canonicalizeOperation`. Canonicalization is the
 *   A5 adapter's job, and the assembler inherits that contract — it receives
 *   canonical rules and matches them.
 * - The overlay snapshots are built by the PR1 builder
 *   ({@link createPermissionOverlaySnapshot}), so every fixture snapshot is a
 *   REAL PR1 record (identity grammars, derived `snapshotId`, provenance
 *   sections all validated by PR1's own gate). No store, no seam, no durable
 *   world: the assembler is pure in-memory and its specs stay storage-free.
 * - The overlay rule CARRIER is `{ operation, resource, effect }` text. The
 *   exact/subtree/exec-fingerprint GRAMMAR of that text is PR3
 *   (`GovernanceMutationService` + `MutationEnvelope`); these fixtures stand in
 *   for it with the smallest possible interpretation
 *   ({@link defaultOverlayRuleView}). The assembler never interprets it —
 *   which is precisely why the view is supplied from the test side.
 *
 * @module @dsh-agent-team/runtime/test/effective-permission-assembler-helpers
 */

import { PERMISSION_TOOL_VALUES } from '../operation-permission/index.js'
import type {
  CanonicalOperation,
  CanonicalRule,
  CanonicalRules,
  PermissionLane,
  PermissionTool,
} from '../operation-permission/index.js'
import type { PermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import type {
  PermissionOverlayEffect,
  PermissionOverlayRule,
  PermissionOverlaySnapshot,
} from '../permission-governance/index.js'
import type { PermissionRule, TemplatePermissionPolicy } from '../../domain/blueprint/src/index.js'
import { createPermissionOverlaySnapshot } from '../../storage/schema/permission-overlay.js'
import type {
  EffectivePermissionOverlayLayer,
  EffectivePermissionOverlayRuleView,
  EffectivePermissionStaticLayer,
} from '../effective-policy/index.js'

// ---------------------------------------------------------------------------
// Identities
// ---------------------------------------------------------------------------

/** The fixture TeamSession (root session) id. */
export const TEAM_SESSION = 'session-root-1'

/** The fixture MemberInstance the overlay belongs to. */
export const INSTANCE_A = 'inst-alpha'

/** A second MemberInstance of the SAME TeamSession — isolation leg. */
export const INSTANCE_B = 'inst-beta'

/** A second TeamSession — cross-session isolation leg. */
export const OTHER_TEAM_SESSION = 'session-root-2'

// ---------------------------------------------------------------------------
// Canonical operations / rules (opaque keys, never paths)
// ---------------------------------------------------------------------------

/** The fixture operation fingerprint (opaque to the resolver). */
export const FINGERPRINT = `sha256:${'0'.repeat(64)}`

/** One file-tool canonical operation over an opaque resource key. */
export function fileOp(tool: PermissionTool, key: string): CanonicalOperation {
  return { tool, resource: { kind: 'file', key, display: `display:${key}` }, fingerprint: FINGERPRINT }
}

/** One shell-class canonical operation (tool-level resource). */
export function shellOp(tool: 'bash' | 'pwsh'): CanonicalOperation {
  return {
    tool,
    resource: { kind: 'tool', key: `tool:${tool}`, display: tool },
    fingerprint: FINGERPRINT,
  }
}

/** An `exact` canonical rule (the key is the opaque authority identity). */
export function exactRule(tool: PermissionTool, key: string): CanonicalRule {
  return { tool, resource: { kind: 'exact', key } }
}

/** An `any` canonical rule (the whole tool). */
export function anyRule(tool: PermissionTool): CanonicalRule {
  return { tool, resource: { kind: 'any' } }
}

/**
 * A `subtree` canonical rule. `containsOperation` is the OPERATION-RELATIVE
 * verdict the A5 seam computes (`FileSystem.contains`); the matcher consumes
 * the boolean and never compares `rootKey`.
 */
export function subtreeRule(tool: PermissionTool, rootKey: string, containsOperation: boolean): CanonicalRule {
  return { tool, resource: { kind: 'subtree', rootKey, containsOperation } }
}

/** The three lanes of one static layer (declaration order preserved). */
export function lanes(rules: {
  readonly allow?: readonly CanonicalRule[]
  readonly ask?: readonly CanonicalRule[]
  readonly deny?: readonly CanonicalRule[]
}): CanonicalRules {
  return { allow: rules.allow ?? [], ask: rules.ask ?? [], deny: rules.deny ?? [] }
}

/**
 * One static permission layer (a blueprint baseline or a template static
 * policy) in the canonicalized shape the Alpha.2 resolver consumes.
 */
export function staticLayer(input: {
  readonly default: 'ask' | 'deny'
  readonly label?: string
  readonly allow?: readonly CanonicalRule[]
  readonly ask?: readonly CanonicalRule[]
  readonly deny?: readonly CanonicalRule[]
}): EffectivePermissionStaticLayer {
  const labelPart = input.label === undefined ? {} : { label: input.label }
  return {
    ...labelPart,
    default: input.default,
    rules: lanes({ allow: input.allow, ask: input.ask, deny: input.deny }),
  }
}

// ---------------------------------------------------------------------------
// PR1 overlay snapshots
// ---------------------------------------------------------------------------

/** One overlay rule carrier literal (`operation` = tool name in these fixtures). */
export function overlayRule(
  operation: string,
  resource: string,
  effect: PermissionOverlayEffect,
): PermissionOverlayRule {
  return { operation, resource, effect }
}

/**
 * Build one REAL PR1 snapshot (the PR1 builder validates the ADR §2 sections
 * and derives the `snapshotId`).
 * @param generation - the metadata generation.
 * @param rules - the overlay rule set of this FULL snapshot.
 * @param overrides - identity / provenance overrides for the isolation legs.
 */
export function snapshot(
  generation: number,
  rules: readonly PermissionOverlayRule[],
  overrides: {
    readonly teamSessionId?: string
    readonly memberInstanceId?: string
    readonly actor?: string
    readonly mutationId?: string
    readonly reason?: string
    readonly timestamp?: string
  } = {},
): PermissionOverlaySnapshot {
  const teamSessionId = overrides.teamSessionId ?? TEAM_SESSION
  const memberInstanceId = overrides.memberInstanceId ?? INSTANCE_A
  return createPermissionOverlaySnapshot({
    identity: { teamSessionId, memberInstanceId },
    state: { rules },
    metadata: {
      generation,
      previousSnapshotId:
        generation === 1
          ? null
          : `${teamSessionId}#${memberInstanceId}#${String(generation - 1)}`,
    },
    provenance: {
      actor: overrides.actor ?? 'leader:inst-root',
      mutationId: overrides.mutationId ?? `mut-g${String(generation)}`,
      timestamp: overrides.timestamp ?? '2026-10-01T12:00:00.000Z',
      reason: overrides.reason ?? `fixture overlay generation ${String(generation)}`,
    },
  })
}

/**
 * The smallest overlay-rule interpretation, standing in for the PR3 grammar:
 * `resource: 'any'` addresses the whole tool, anything else is one exact
 * canonical key. The EFFECT is never interpreted here — it is carried by the
 * snapshot rule itself, and the assembler refuses a view that misstates it.
 */
export function defaultOverlayRuleView(rule: PermissionOverlayRule, ruleIndex: number): EffectivePermissionOverlayRuleView {
  return {
    ruleIndex,
    lane: rule.effect,
    rule: rule.resource === 'any' ? anyRule(asPermissionTool(rule.operation)) : exactRule(asPermissionTool(rule.operation), rule.resource),
  }
}

/** The overlay layer input: a snapshot + the canonical view of its rules. */
export function overlayLayer(
  snap: PermissionOverlaySnapshot,
  options: {
    readonly view?: (rule: PermissionOverlayRule, ruleIndex: number) => EffectivePermissionOverlayRuleView
    readonly rules?: readonly EffectivePermissionOverlayRuleView[]
  } = {},
): EffectivePermissionOverlayLayer {
  const view = options.view ?? defaultOverlayRuleView
  return {
    snapshot: snap,
    rules: options.rules ?? snap.state.rules.map((rule, index) => view(rule, index)),
  }
}

/**
 * An in-memory stub of the PR1 persistence port, typed as
 * {@link PermissionOverlayRepositoryPort}: it proves the assembler consumes
 * the PORT's output shape (`latest`) rather than a bespoke fixture shape,
 * without binding any storage. `append` is unreachable by construction (the
 * assembler has no write path to reach it through).
 */
export function stubOverlayPort(snapshots: readonly PermissionOverlaySnapshot[]): PermissionOverlayRepositoryPort {
  return {
    append: async () => {
      throw new Error('the assembler must never append (PR1 port is persistence-only, PR2 has no write path)')
    },
    latest: async (identity) =>
      snapshots
        .filter(
          (row) =>
            row.identity.teamSessionId === identity.teamSessionId &&
            row.identity.memberInstanceId === identity.memberInstanceId,
        )
        .reduce<PermissionOverlaySnapshot | undefined>(
          (best, row) => (best === undefined || row.metadata.generation > best.metadata.generation ? row : best),
          undefined,
        ),
    history: async (identity) =>
      snapshots
        .filter(
          (row) =>
            row.identity.teamSessionId === identity.teamSessionId &&
            row.identity.memberInstanceId === identity.memberInstanceId,
        )
        .slice()
        .sort((left, right) => left.metadata.generation - right.metadata.generation),
  }
}

/**
 * The A1-form policy argument of `resolveOperationPermission`, derived from the
 * canonical lanes (the resolver reads only `default` from it; the A3 spec
 * derives the same projection "to keep the policy argument honest"). Used by
 * the reuse pin so the comparison is against the resolver's real call shape.
 */
export function a1PolicyOf(layers: {
  readonly default: 'ask' | 'deny'
  readonly allow?: readonly CanonicalRule[]
  readonly ask?: readonly CanonicalRule[]
  readonly deny?: readonly CanonicalRule[]
}): TemplatePermissionPolicy {
  const toA1 = (rule: CanonicalRule): PermissionRule =>
    rule.resource.kind === 'any'
      ? { tool: rule.tool, resource: { kind: 'any' } }
      : rule.resource.kind === 'subtree'
        ? { tool: rule.tool, resource: { kind: 'subtree', path: rule.resource.rootKey } }
        : { tool: rule.tool, resource: { kind: 'exact', path: rule.resource.key } }
  return {
    default: layers.default,
    allow: (layers.allow ?? []).map(toA1),
    ask: (layers.ask ?? []).map(toA1),
    deny: (layers.deny ?? []).map(toA1),
  }
}

/** The closed `PermissionTool` check the overlay carrier text must satisfy. */
export function asPermissionTool(name: string): PermissionTool {
  const found = PERMISSION_TOOL_VALUES.find((tool) => tool === name)
  if (found === undefined) {
    throw new Error(`fixture overlay operation '${name}' is not a permission tool`)
  }
  return found
}

/** The lane of one permission lane value (identity; documents intent at call sites). */
export function lane(value: PermissionLane): PermissionLane {
  return value
}

/** Deep clone (the purity legs compare an input before and after assembly). */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Is this value deeply frozen (the assembler's output must be)? */
export function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return true
  }
  if (!Object.isFrozen(value)) {
    return false
  }
  return Object.values(value).every((child) => isDeepFrozen(child))
}

/** The `code` of a thrown assembly error (duck-typed). */
export function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code)
  }
  return undefined
}

/** The `details.problem` tag of a thrown assembly error (duck-typed). */
export function errorProblem(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'details' in error) {
    const details = (error as { details?: unknown }).details
    if (typeof details === 'object' && details !== null && 'problem' in details) {
      return String((details as Record<string, unknown>)['problem'])
    }
  }
  return undefined
}

/** Run `fn`, returning its result or the error it threw. */
/** One `details` member of a thrown assembly error (the typed refusal context). */
export function errorDetail(error: unknown, key: string): unknown {
  if (typeof error === 'object' && error !== null && 'details' in error) {
    const details = (error as { details?: unknown }).details
    if (typeof details === 'object' && details !== null) {
      return (details as Record<string, unknown>)[key]
    }
  }
  return undefined
}

export function capture<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    return { ok: false, error }
  }
}
