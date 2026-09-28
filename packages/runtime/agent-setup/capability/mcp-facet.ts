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
  PolicyEntry,
  SuppressedOverlayRecord,
} from '../../../domain/policy/src/index.js'
import type { GovernanceOverrideRecord } from '../../../storage/schema/index.js'
import {
  legacyPolicyReaderOf,
  readEffectivePolicy,
} from '../../effective-policy/index.js'
import type {
  PolicyReader,
  PolicyStateTransitionRecord,
} from '../../mutation/index.js'
import {
  cellProvenance,
  type CellDeniedBy,
  type CellProvenanceOptions,
  type CellSource,
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
  /** The MCP server name to test. */
  readonly serverName: string
  /** The record ids this session has already applied at its last boundary. */
  readonly appliedRecordIds?: readonly string[]
  /**
   * THE CANONICAL INPUT (pre-alpha3 PR-B) — the static policy authority
   * (the production PolicyReader: blueprint envelope + per-member template
   * policy + external hard facts, from the bound snapshot). When present,
   * it WINS over the legacy `external` / `initialTemplateMcp` pair and the
   * durable `transitions` (the committed PolicyState) participate.
   */
  readonly policy?: PolicyReader
  /**
   * THE CANONICAL INPUT (pre-alpha3 PR-B) — the durable PolicyState
   * transitions (commit order; the last entry is the committed state).
   * Absent = the implicit `default` state.
   */
  readonly transitions?: readonly PolicyStateTransitionRecord[]
  /**
   * LEGACY ARGS (pre-PR-B call shape; used when `policy` is absent) — the
   * external hard facts (host ceiling / capability presence).
   */
  readonly external?: ExternalPolicyFacts
  /**
   * LEGACY ARGS (pre-PR-B call shape; used when `policy` is absent) — the
   * bound Blueprint template's INITIAL STATIC grant for the `mcp` cell
   * (plan MCP_BLUEPRINT_INITIAL_GRANT §4.1): the template's
   * `capabilities.mcp` entry when `kind === 'allow'` — the role's initial
   * governance grant, available from team creation (fresh root, fresh
   * member, cold resume) without any governance record. It resolves at the
   * policy resolver's `template` value layer (provenance template/static):
   * record-backed layers (templateOverlay / instanceOverlay /
   * humanOverride) and the external hard facts keep their precedence over
   * it, and it is NOT persisted as a synthetic durable record. Absent
   * (legacy template / `kind !== 'allow'`) = the unchanged
   * unspecifiedFailClosed baseline — a deny or a future non-allow state is
   * NEVER converted into a grant here.
   */
  readonly initialTemplateMcp?: PolicyEntry
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
 * pre-alpha3 PR-B (plan §B.2): the resolution runs the ONE canonical read
 * (`readEffectivePolicy`) — the canonical inputs are `policy` (the static
 * policy authority) + `transitions` (the durable committed PolicyState);
 * the pre-PR-B legacy args (`external` + `initialTemplateMcp`) remain
 * supported and adapt to the SAME canonical read. The per-boundary view is
 * the frozen `mcpFacetView` over the canonical policy with the
 * MEMBER-SCOPED durable refs (team scope + this instance — another
 * member's instance records never enter this member's pending set).
 *
 * @param args - the boundary inputs.
 * @returns the frozen policy + the MCP facet view.
 * @throws {@link import('../../activation/index.js').ActivationError}
 *   `ACTIVATION_POLICY_RESOLUTION_FAILED` when the stored payload is
 *   malformed (fail closed).
 */
export function resolveDurableMcpFacet(args: DurableMcpFacetArgs): DurableMcpFacet {
  const { rootSessionId, instanceId, overrides, serverName, appliedRecordIds } = args
  const read = readEffectivePolicy(
    args.policy !== undefined
      ? {
          rootSessionId,
          instanceId,
          policy: args.policy,
          transitions: args.transitions ?? [],
          overrides,
        }
      : {
          rootSessionId,
          instanceId,
          policy: legacyPolicyReaderOf(
            args.external,
            args.initialTemplateMcp !== undefined ? { mcp: args.initialTemplateMcp } : undefined,
          ),
          transitions: [],
          overrides,
        },
  )
  const view = mcpFacetView(read.policy, serverName, {
    overrides: read.refs,
    ...(appliedRecordIds !== undefined ? { appliedRecordIds } : {}),
  })
  return { policy: read.policy, view }
}
