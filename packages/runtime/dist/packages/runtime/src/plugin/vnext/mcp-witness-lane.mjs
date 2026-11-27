/**
 * mcp-witness-lane.mjs — the MCP CAPABILITY WITNESS half of the per-session MCP lane: the
 * capability-runtime telemetry emitter, the public tool-surface readers, and fiber retirement.
 *
 * EXTRACTED VERBATIM FROM agent-bindings.mjs (2026-11-23, behaviour-preserving decomposition round;
 * no byte of the moved text changed). One factory per row instance.
 *
 * WHAT IT OWNS:
 *  - `emitMcpCapabilityEvent` — the best-effort capability-runtime telemetry of a mount transition
 *    (a write failure is observed, never propagated);
 *  - `readMcpServerToolSurface` / `recordMcpToolWitness` — the F15 capability observation (the
 *    server's live PUBLIC tool surface, never transport socket state);
 *  - `retireExhaustedMcpFiber` — the exactly-once retirement of an exhausted fiber (the failed
 *    materialization slot is stamped in the SAME owned step, so the requirement gate of the same
 *    boundary blocks).
 *
 * DELIBERATELY LEFT IN agent-bindings.mjs, with the reason:
 *  - `reconcileMcpSet` (the mount/dispose transaction) and the plugin-owned cooldown + reconnect
 *    constants. `f15-mcp-live-loss.test.ts` §9.2 is a STATIC call-site witness that reads
 *    agent-bindings.mjs and pins exactly ONE `state.mcpMountCtx.plugin(mcpClient,` site together with
 *    the literal policy constants. Moving the transaction would have forced a test edit, which this
 *    round refuses; the witness keeps reading the file that owns the mount.
 *  - `observeMcpOperationalWitness` (the classifier), which reads the row's `closing` primitive — a
 *    primitive cannot be passed by reference, so moving it would have required editing the moved
 *    condition. It consumes the readers above through the factory's return value.
 *
 * @module packages/runtime/src/plugin/vnext/mcp-witness-lane
 */

import { scopeOf } from '@deepseek-ai/dsh-scope'

/**
 * Create the MCP capability witness over one row instance.
 * @param {object} input
 * @param {object} input.deps - the row deps (only `capabilityTelemetry` is read).
 * @param {string[]} input.observations - the row's observation log (pushed to, never replaced).
 * @returns {object} the witness readers the classifier and the mount transaction consume.
 */
export function createMcpWitnessLane ({ deps, observations }) {
  // The optional telemetry hook (the production wiring fills it; a test
  // world without the durable telemetry omits it → emit is a no-op).
  const capabilityTelemetry =
    typeof deps.capabilityTelemetry === 'function' ? deps.capabilityTelemetry : undefined

  /**
   * Emit one capability-runtime telemetry event for an MCP mount transition
   * (plan §C.6/§C.7). BEST-EFFORT: a telemetry write failure is observed,
   * never propagated (it must NOT fail the member's MCP reconciliation). A
   * no-op when the production wiring passed no `capabilityTelemetry` hook
   * (a test world without the durable telemetry).
   * @param {object} state - the session's consumption state (carries the
   *   owning team root the event is stamped with).
   * @param {string} kind - the closed event kind (e.g. `mount-failed`,
   *   `mount-restored`).
   * @param {string} serverName - the MCP server (the capability name).
   * @param {string} verdict - the 3-state readiness verdict.
   * @param {number} attempt - the attempt count for this server.
   * @param {string|undefined} reason - the failure diagnostic (failed slots).
   * @param {string} [source] - the observation source provenance
   *   (default `mcp-fiber` — every pre-F15 call site; the F15
   *   confirmed-loss path passes `mcp-public-tool-surface`, plan §11).
   */
  async function emitMcpCapabilityEvent(state, kind, serverName, verdict, attempt, reason, source) {
    if (typeof capabilityTelemetry !== 'function') return
    const event = {
      kind,
      capabilityType: 'mcpServer',
      capabilityName: serverName,
      verdict,
      source: source === undefined ? 'mcp-fiber' : source,
      observedAt: new Date().toISOString(),
      attempt,
    }
    if (reason !== undefined) event.reason = reason
    try {
      await capabilityTelemetry(state.teamRootSessionId, event)
    } catch (error) {
      observations.push(`p6t6: capability telemetry write failed [server ${serverName}]: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // ── F15 (MCP live-loss zero-core, plan §5.1-B/C/§5.3): the public ────────
  // ── tool-surface witness + the idempotent exhausted-fiber retirement ────
  //
  // The upstream connection supervisor (0.1.7-rc.1, connection.d.ts)
  // WITHDRAWS the server's tools when the reconnect budget exhausts —
  // the fiber/handle stays live ("disposal … is the only way back").
  // The plugin therefore observes the CAPABILITY through its PUBLIC
  // TOOL SURFACE (`mcp__<serverName>__*` on the agent scope, read via
  // the public `ctx.tools.schemas(scope)` seam — the same seam the
  // A2C-2 permission coverage gate reads): fiber presence alone is NOT
  // reachability. No private map is read, no mcp-client internal is
  // touched, no monkey-patch (CORE PATCH BUDGET = 0).

  /**
   * Read the server's public tool names off the MCP mount ctx (the
   * agent-scoped surface — the model-visible `mcp__<serverName>__*`
   * set). Returns `null` when the surface CANNOT be read (the mount ctx
   * is absent or has no `tools.schemas` seam) — the caller fails soft
   * (`unknown`, never a fabricated `unreachable`).
   * @param {object} state - the session's consumption state (carries
   *   `mcpMountCtx`, the Agent-keyed scope context every serverName is
   *   registered under).
   * @param {string} serverName - the MCP server (the capability name).
   * @returns {string[]|null} the server-qualified public tool names
   *   (empty array = a readable-but-empty surface), or `null`
   *   (unreadable).
   */
  function readMcpServerToolSurface(state, serverName) {
    const ctx = state.mcpMountCtx
    if (ctx === undefined || ctx === null || typeof ctx.tools?.schemas !== 'function') return null
    // The mount ctx is ALWAYS scope-tagged (the agent's own tag — the
    // common case — or the Finding-1 bridge scope minted keyed by the
    // runtime Agent), so `scopeOf` names the registration layer; the
    // `ctx.root` fallback mirrors the upstream registry key
    // (`scopeOf(ctx) ?? ctx.root`).
    const scope = scopeOf(ctx) ?? ctx.root
    let schemas
    try {
      schemas = ctx.tools.schemas(scope)
    } catch {
      return null
    }
    if (!Array.isArray(schemas)) return null
    const prefix = `mcp__${serverName}__`
    return schemas
      .map((t) => (t !== null && typeof t === 'object' && typeof t.name === 'string' ? t.name : undefined))
      .filter((n) => n !== undefined && n.startsWith(prefix))
  }

  /**
   * Record one surface observation in the session's EPHEMERAL tool
   * witness (plan §5.1-B: `everToolBearing` + `lastObservedNames`).
   * A zero-tool observation NEVER clears `everToolBearing` (a server
   * that once bore tools does not become a zero-tool server by
   * fluke — only a fresh mount re-seeds the record). `null` (an
   * unreadable surface) leaves the record untouched.
   * @param {object} state - the session's consumption state.
   * @param {string} serverName - the MCP server.
   * @param {string[]|null} names - the observed server-qualified names
   *   (`null` = unreadable surface — the record is left alone).
   */
  function recordMcpToolWitness(state, serverName, names) {
    if (names === null) return
    const record = state.mcpToolWitness.get(serverName) ?? { everToolBearing: false, lastObservedNames: [] }
    record.lastObservedNames = [...names]
    if (names.length > 0) record.everToolBearing = true
    state.mcpToolWitness.set(serverName, record)
  }

  /**
   * F15 (plan §5.3) — the IDEMPOTENT exhausted-fiber retirement. After
   * a confirmed loss the upstream supervisor has stopped reconnecting;
   * unless the plugin retires the exhausted fiber, the server is a
   * PERMANENT DEAD SLOT (upstream never retries + the plugin's
   * `!mcpFibers.has(name)` mount guard never re-mounts). Retirement:
   * the materialization slot is written `failed` with
   * `lastAttemptAt = now` (the existing 30 s retry cooldown then blocks
   * a same-boundary remount — the failure is NOT "washed away" by an
   * immediate fresh mount, plan §5.3), the fiber is disposed + deleted,
   * the witness record is cleared (a fresh remount re-seeds it), and
   * EXACTLY ONE `capability-lost` telemetry is written
   * (`mcp-public-tool-surface` provenance, plan §11).
   *
   * IDEMPOTENCE (plan L6 / §5.3): a repeat call finds no fiber and is
   * a total no-op — NO double dispose, NO second `capability-lost`, NO
   * attempt advance, NO slot rewrite.
   * @param {object} state - the session's consumption state.
   * @param {string} serverName - the MCP server.
   * @param {string} reason - the plugin-owned reason code (provenance).
   * @returns {Promise<{retired: boolean}>} whether THIS call performed
   *   the retirement (a repeat call reports `retired: false`).
   */
  async function retireExhaustedMcpFiber(state, serverName, reason) {
    const fiber = state.mcpFibers.get(serverName)
    if (fiber === undefined) {
      // Already retired (or never mounted) — the idempotent no-op.
      return { retired: false }
    }
    const slot = state.mcpMaterialization.get(serverName)
    const attempts = slot !== undefined && typeof slot.attempts === 'number' ? slot.attempts : 0
    state.mcpMaterialization.set(
      serverName,
      { status: 'failed', attempts, lastAttemptAt: Date.now(), reason },
    )
    state.mcpFibers.delete(serverName)
    state.mcpActivationErrors.delete(serverName)
    state.mcpToolWitness.delete(serverName)
    try {
      fiber.dispose()
    } catch (error) {
      observations.push(`p6t6: mcp fiber retire dispose failed [server ${serverName}]: ${error instanceof Error ? error.message : String(error)}`)
    }
    observations.push(`p6t6: mcp fiber retired [server ${serverName}] (confirmed loss: ${reason})`)
    await emitMcpCapabilityEvent(state, 'capability-lost', serverName, 'unreachable', attempts, reason, 'mcp-public-tool-surface')
    return { retired: true }
  }

  return {
    emitMcpCapabilityEvent,
    readMcpServerToolSurface,
    recordMcpToolWitness,
    retireExhaustedMcpFiber,
  }
}
