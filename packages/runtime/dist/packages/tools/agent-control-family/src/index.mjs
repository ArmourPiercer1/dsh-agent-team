/**
 * `packages/tools/agent-control-family` — the AGENT-CONTROL Family lane
 * (U7-F; center-assembly-architecture §4 "six boundaries" owned by a
 * Family; the FamilyAssembly mount per the u7-w0b seam).
 *
 * WHAT LIVES HERE: the seven governed agent-control rows' FAMILY-owned
 * halves —
 *   - `agent-control-mechanics.mjs`  the pure law: closed argument grammar,
 *                                    the enumeration/mutation effect split,
 *                                    the owner fence, the no-amplification
 *                                    law, the fork-context boundary;
 *   - `agent-runtime-port.mjs`       the injected port contract + the
 *                                    host-service resolver (legs resolve
 *                                    lazily through the mount's public
 *                                    `hostService` face; unresolved = typed
 *                                    refusal, never a fake);
 *   - `agent-control-executor.mjs`   the effect bodies (parse → effects →
 *                                    lane decide → default-deny re-check →
 *                                    FAMILY FENCES → the injected one-shot
 *                                    PA edge → the port leg);
 *   - `*-row.mjs`                    the seven row Definitions the trusted
 *                                    assembly places at the fixed native
 *                                    spellings (§ CI-04);
 *   - `agent-control-contribution.mjs` the §4/§10.3 contribution descriptor
 *                                    (admission/grantMint/grantConsume
 *                                    declared `kernel` — § CI-06).
 *
 * OWNER ROLE: the Family owns the Definition, the argument contract, the
 * effect BODY and the result SHAPE. It owns NO authority: it never admits,
 * mints, consumes or decides. Authority forces (lane decide, the PA edge,
 * the scope roster, the caller authority snapshot, the agent-runtime port)
 * arrive INJECTED at the trusted assembly; nothing under this directory may
 * import the plane, the Kernel lane, or Host internals — the outward edges
 * are the frozen tool-governance vocabulary and the contracts canonical-JSON
 * face only.
 *
 * THE THREE U7-F LAWS, ONE HOME EACH:
 *  (a) enumeration ⊄ mutation — `deriveAgentControlEffects` (C1 proves it
 *      from the actual PA requested-effect sets);
 *  (b)/(c) no amplification, workflows included — `authorityBounded` +
 *      `workflowEffectWorld`, enforced on EVERY spawn leg including the
 *      workflow driver's delegates;
 *  (d) owner fence — `classifyTargetScope` + `scopeMembership`, foreign
 *      targets refuse with ZERO port reach (the jobs owner-fence mirror);
 *  (e) context is data — `scanContextAuthority` on the fork's context
 *      source: a forked child inherits transcript data, never grants.
 *
 * DIST MIRROR: every file here is a plain .mjs tracked as a BYTE COPY under
 * `packages/runtime/dist/packages/tools/agent-control-family/src/` via
 * `scripts/dist-placements/070-agent-control-family.json` (tsc never emits
 * .mjs). The relative import depths resolve identically from src and the
 * mirror.
 *
 * @module agent-control-family
 */
export {
  AGENT_CONTROL_ENUMERATION_NAMES,
  AGENT_CONTROL_MUTATION_NAMES,
  AGENT_CONTROL_NAMES,
  AGENT_ROSTER_VIEW,
  AGENT_RUNTIME_DOMAIN_AUTHORITY,
  ARG_GRAMMAR,
  CONVERSATION_CONTEXT_VIEW,
  MODEL_ROUTES_VIEW,
  authorityBounded,
  classifyTargetScope,
  deriveAgentControlEffects,
  parseAgentControlArgs,
  scanContextAuthority,
  scopeMembership,
  workflowEffectWorld,
} from './agent-control-mechanics.mjs'
export { LEG_UNWIRED, PORT_LEGS, createHostAgentRuntimePort, normalizePort, resolveLeg } from './agent-runtime-port.mjs'
export { createAgentControlExecutors } from './agent-control-executor.mjs'
export { buildSpawnRowDefinition } from './spawn-row.mjs'
export { buildForkRowDefinition } from './fork-row.mjs'
export { buildSteerRowDefinition } from './steer-row.mjs'
export { buildInterruptRowDefinition } from './interrupt-row.mjs'
export { buildListAgentsRowDefinition } from './list-agents-row.mjs'
export { buildListModelsRowDefinition } from './list-models-row.mjs'
export { buildWorkflowRowDefinition } from './workflow-row.mjs'
export { buildAgentControlContribution } from './agent-control-contribution.mjs'
