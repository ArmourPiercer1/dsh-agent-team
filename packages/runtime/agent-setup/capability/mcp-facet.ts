/**
 * P8-S4B — the Team-durable CONSUMPTION of the MCP facet: the bridge from
 * the durable governance overrides (backend truth) to the actual MCP
 * mount decision of one live Agent (DevPlan P8-S §18.1/§18.2: the
 * capability must-close — "allowed -> durable tighten/deny -> next actual
 * operation blocked/absent; restart remains effective").
 *
 * This module owns the `mcp` capability cell's consumer rule (the facet
 * chosen by the S4B ruling — G2-characterized over the public DSH
 * `agentCtx.plugin` MCP seam, streamable-http):
 *
 * - the MCP server is mounted for an agent ONLY when the frozen effective
 *   policy's `mcp` cell is `allow` AND the allow-list names the server
 *   (or `*` for all servers);
 * - EVERY other outcome — `unspecified` (Team never granted the cell),
 *   explicit `deny` (any layer), external capability absence / hard deny /
 *   removed-all — is fail-closed: NO mount, and the deny is surfaced via
 *   the §18.3 provenance, never silently allowed;
 * - the decision re-reads the durable overrides at every boundary, so a
 *   durable tighten/deny takes effect at the NEXT operation and survives
 *   a host restart (same durable truth -> same decision).
 *
 * Pure module: no I/O, no live Agent, no ambient state.
 *
 * @module @dsh-agent-team/runtime/agent-setup/capability/mcp-facet
 */

import type {
  EffectivePolicy,
  ExternalPolicyFacts,
  SuppressedOverlayRecord,
} from '../../../domain/policy/src/index.js'
import type { GovernanceOverrideRecord } from '../../../storage/schema/index.js'
import { resolveActivationPolicy } from '../../activation/index.js'
import {
  cellProvenance,
  type CellDeniedBy,
  type CellProvenanceOptions,
  type CellSource,
  type DurableOverrideRef,
  type PendingBoundaryRecord,
} from '../../mutation/cell-provenance.js'

/** The allow-list wildcard naming every MCP server. */
export const MCP_FACET_WILDCARD = '*'

/** The MCP facet consumption view of one member's durable policy. */
export interface McpFacetView {
  /** The addressed MCP server name (the facet's item vocabulary). */
  readonly serverName: string
  /**
   * Whether the server MAY be mounted for this agent at this boundary:
   * the `mcp` cell is `allow` and its items name the server (or `*`).
   * Every other outcome is fail-closed `false`.
   */
  readonly allowed: boolean
  /** The winning Team layer's provenance (the §18.3 `source` field). */
  readonly source: CellSource
  /** The stored-but-suppressed autonomy overlays of the cell. */
  readonly suppressed: readonly SuppressedOverlayRecord[]
  /** True when the capability is absent from the substrate. */
  readonly unavailable: boolean
  /** Who/what denied the cell (absent when the cell is effectively granted). */
  readonly deniedBy: CellDeniedBy | undefined
  /** Durable records that admit an mcp value but were not yet applied. */
  readonly pendingNextBoundary: readonly PendingBoundaryRecord[]
  /** The frozen resolver's per-cell explanation. */
  readonly explanation: string
}

/**
 * Decide the MCP mount for one server from the frozen effective policy.
 * Pure and deterministic; fail-closed (never mounts without an explicit
 * Team allow naming the server or `*`).
 * @param policy - the frozen effective policy of the member.
 * @param serverName - the MCP server name to test.
 * @param options - the durable records + the session's applied record ids.
 * @returns the facet view (lossless-JSON).
 */
export function mcpFacetView(
  policy: EffectivePolicy,
  serverName: string,
  options: CellProvenanceOptions = {},
): McpFacetView {
  const provenance = cellProvenance(policy, 'mcp', options)
  let allowed = false
  if (provenance.effective.kind === 'allow' && !provenance.unavailable && serverName.length > 0) {
    const items = provenance.effective.items
    allowed = items.includes(MCP_FACET_WILDCARD) || items.includes(serverName)
  }
  return {
    serverName,
    allowed,
    source: provenance.source,
    suppressed: provenance.suppressed,
    unavailable: provenance.unavailable,
    deniedBy: provenance.deniedBy,
    pendingNextBoundary: provenance.pendingNextBoundary,
    explanation: provenance.explanation,
  }
}

/** The durable MCP facet resolution inputs (re-read at every boundary). */
export interface DurableMcpFacetArgs {
  /** The owning TeamSession. */
  readonly rootSessionId: string
  /** The addressed MemberInstance (required by the frozen resolver). */
  readonly instanceId: string
  /** Every durable governance override of the TeamSession (backend truth). */
  readonly overrides: readonly GovernanceOverrideRecord[]
  /** The external hard facts (host ceiling / capability presence). */
  readonly external: ExternalPolicyFacts
  /** The MCP server name to test. */
  readonly serverName: string
  /** The record ids this session has already applied at its last boundary. */
  readonly appliedRecordIds?: readonly string[]
}

/** The resolved durable MCP facet decision + its provenance. */
export interface DurableMcpFacet {
  /** The frozen effective policy (the backend truth every view derives from). */
  readonly policy: EffectivePolicy
  /** The MCP facet consumption view (allowed + §18.3 provenance). */
  readonly view: McpFacetView
}

/**
 * Re-read the durable overrides and re-decide the MCP mount at one
 * boundary. This is the durable-mutation -> actual-Agent-behavior edge
 * for the capability facet: a durable allow/deny takes effect on the next
 * actual operation and survives a host restart.
 *
 * @param args - the boundary inputs.
 * @returns the frozen policy + the MCP facet view.
 * @throws {@link import('../../activation/index.js').ActivationError}
 *   `ACTIVATION_POLICY_RESOLUTION_FAILED` when the stored payload is
 *   malformed (fail closed).
 */
export function resolveDurableMcpFacet(args: DurableMcpFacetArgs): DurableMcpFacet {
  const { rootSessionId, instanceId, overrides, external, serverName, appliedRecordIds } = args
  const policy = resolveActivationPolicy({ rootSessionId, instanceId, overrides, external })
  const refs: DurableOverrideRef[] = overrides.map((record) => ({
    recordId: record.recordId,
    kind: record.kind,
    scope: record.scope,
    generation: record.generation,
    updatedAt: record.updatedAt,
    values: record.values,
  }))
  const view = mcpFacetView(policy, serverName, {
    overrides: refs,
    ...(appliedRecordIds !== undefined ? { appliedRecordIds } : {}),
  })
  return { policy, view }
}
