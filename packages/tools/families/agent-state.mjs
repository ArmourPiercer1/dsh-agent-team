/**
 * FamilyAssembly descriptor — the AGENT-STATE family (U7-F B).
 *
 * The five per-agent durable-state members (`todo_write`, `create_goal`,
 * `get_goal`, `update_goal`, `exit_plan_mode`) mount at FIXED native
 * spellings — the fs/jobs precedent: never the configurable `names` map,
 * no Gate 0b surface. The same-name same-meaning claim this mount records
 * is ASSEMBLED: the lane's governed bodies over the pinned state law
 * (`../agent-state-family/src/agent-state-law.mjs`, derived line-by-line
 * from the host pin 639ed01539) walking the plane's own decide/PA edges;
 * persistence arrives ONLY through the injected state-store port
 * (`injected.agentState` — the kit/test `input.backends` face the plane
 * already honours). An ENABLED family whose port is not mounted REFUSES THE
 * WHOLE MOUNT (`PLANE_AGENT_STATE_STORE_MISSING`) — fail closed at the
 * mount, never a row that could only ever refuse at call time, and never a
 * native fallback.
 *
 * The enablement is the closed boolean consumption key `agentStateEnabled`
 * (the jobs/glob zero-flip precedent): ABSENT = FALSE — no rows, kernel
 * owns nothing, the native hosts ride exactly as today (shipped worlds
 * byte-identical).
 *
 * @module tools/families/agent-state
 */
import {
  AGENT_STATE_NAMES,
  buildAgentStateRowDefinitions,
  buildAgentStateContribution,
  validateStatePort,
} from '../agent-state-family/src/index.mjs'

export const familyAssembly = Object.freeze({
  schema: 'u7-family-assembly/1',
  familyId: 'dsh.agent-state-family',
  order: 40,
  placement: 40,
  config: Object.freeze({ agentStateEnabled: 'boolean' }),
  claims: () => [...AGENT_STATE_NAMES],
  enabled: (cap) => cap.planeConfig.agentStateEnabled === true,
  disabledOwned: () => [],
  build(cap) {
    const port = cap.injected.agentState
    const checked = validateStatePort(port)
    if (checked.ok !== true) {
      // Fail closed at the MOUNT: an enabled agent-state family without a
      // durable store has no honest effect face — the assembly refuses
      // rather than placing rows that could only ever refuse at call time.
      return {
        refused: {
          code: 'PLANE_AGENT_STATE_STORE_MISSING',
          message: `the dsh.agent-state-family is enabled but its state-store port is not mounted (${checked.detail}) — an enabled family with no durable store never mounts (fail closed)`,
        },
      }
    }
    const rowDefs = buildAgentStateRowDefinitions({
      realmId: cap.realmId,
      policy: cap.permissionPolicy,
      decide: cap.decide,
      pa: cap.pa,
      store: port,
      observe: cap.logBackend('a5-agent-state'),
    })
    const contribution = buildAgentStateContribution({ rowDefinitions: rowDefs })
    return {
      definitions: rowDefs.map((def) => Object.freeze({ ...def, output: cap.presentationFace })),
      contribution,
      diagnostics: { agentStateStore: port },
    }
  },
  refusalCode: 'PLANE_AGENT_STATE_REGISTRATION_REFUSED',
})
