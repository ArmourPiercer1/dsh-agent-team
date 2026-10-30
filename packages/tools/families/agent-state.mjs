/**
 * FamilyAssembly descriptor — the AGENT-STATE family (U7-F B).
 *
 * The five per-agent durable-state members (`todo_write`, `create_goal`,
 * `get_goal`, `update_goal`, `exit_plan_mode`) mount at FIXED native
 * spellings — the fs/jobs precedent: never the configurable `names` map,
 * no Gate 0b surface. The same-name same-meaning claim this mount records
 * is ASSEMBLED: the lane's governed bodies over the pinned state law
 * (`../agent-state-family/src/agent-state-law.mjs`, derived line-by-line
 * from the host pin 639ed01539) walking the plane's own decide/PA edges.
 *
 * PERSISTENCE (U7 store port): the store is chosen in THIS order, in
 * `build`, through the descriptor's existing capability only (zero center
 * lines):
 *   1. an INJECTED port (`injected.agentState` — the kit/test
 *      `input.backends` face the plane already honours) wins; it is
 *      validated against the closed port method list;
 *   2. otherwise the PRODUCTION durable store
 *      (`../agent-state-family/src/fs-state-store.mjs`) under the resolved
 *      harness home, `<DSH_HOME>/team-state/agent-state/<realmId>/`, with its
 *      execution-origin arm resolved lazily from the mount's public host
 *      services (`cap.hostService`);
 *   3. when NO home is resolvable, or the realm id is not a path-safe
 *      segment, the WHOLE MOUNT refuses with the existing
 *      `PLANE_AGENT_STATE_STORE_MISSING` — fail closed at the mount, never a
 *      row that could only ever refuse at call time, never an invented
 *      default location, and never a native fallback. WHICH shapes are
 *      resolvable is the two-arm home law
 *      (`agent-state-family/src/fs-state-store.mjs`, `resolveAgentStateHome`):
 *      the PRODUCTION arm (DEFAULT, mount key `testHomeGuard` ABSENT) answers
 *      the host's own home through the PUBLIC upstream
 *      `@deepseek-ai/dsh-home-paths` `resolveDshHome()`; the TEST arm
 *      (`testHomeGuard: true`, set by every test World at its row-config
 *      choke point) keeps the shipped refusals byte-for-byte (USER-RULING-
 *      20261031 §2 via PRODUCTION-HOME-DESIGN (c)). The discriminator is
 *      trusted mount config — never an environment variable.
 *
 * The enablement is the closed boolean consumption key `agentStateEnabled`
 * (the jobs/glob zero-flip precedent): ABSENT = FALSE — no rows, kernel
 * owns nothing, the native hosts ride exactly as today (shipped worlds
 * byte-identical). The home-mode is the second closed boolean key
 * `testHomeGuard`: ABSENT = production (guard off), TRUE = the shipped
 * test-safety home law. Both keys go through the SAME closed-world
 * `checkFamilyConfig` law (a present key of the wrong type refuses the
 * mount, never coerced).
 *
 * @module tools/families/agent-state
 */
import {
  AGENT_STATE_NAMES,
  buildAgentStateRowDefinitions,
  buildAgentStateContribution,
  createFsStateStore,
  createHostArmProvider,
  resolveAgentStateHome,
  storeRootFor,
  validateStatePort,
} from '../agent-state-family/src/index.mjs'

const storeMissing = (detail) => ({
  refused: {
    code: 'PLANE_AGENT_STATE_STORE_MISSING',
    message: `the dsh.agent-state-family is enabled but its state-store port is not mounted (${detail}) — an enabled family with no durable store never mounts (fail closed)`,
  },
})

/** The production store, or the typed reason there is none. The home-mode
 *  arrives through the trusted mount config (`cap.planeConfig.testHomeGuard`
 *  — the same layer `enabled` reads `agentStateEnabled`); ABSENT means
 *  production, TRUE the shipped test-safety law. */
function productionStore(cap) {
  const home = resolveAgentStateHome({ testHomeGuard: cap.planeConfig.testHomeGuard === true })
  if (home.ok !== true) return { ok: false, detail: `${home.code}: ${home.detail}` }
  const root = storeRootFor(home.home, cap.realmId)
  if (root.ok !== true) return { ok: false, detail: `${root.code}: ${root.detail}` }
  return {
    ok: true,
    port: createFsStateStore({
      rootDir: root.rootDir,
      anchorDir: home.home,
      realmId: cap.realmId,
      armProvider: createHostArmProvider({ hostService: (name) => cap.hostService(name) }),
    }),
  }
}

export const familyAssembly = Object.freeze({
  schema: 'u7-family-assembly/1',
  familyId: 'dsh.agent-state-family',
  order: 40,
  placement: 40,
  config: Object.freeze({ agentStateEnabled: 'boolean', testHomeGuard: 'boolean' }),
  claims: () => [...AGENT_STATE_NAMES],
  enabled: (cap) => cap.planeConfig.agentStateEnabled === true,
  disabledOwned: () => [],
  build(cap) {
    let port = cap.injected.agentState
    if (port === undefined || port === null) {
      const production = productionStore(cap)
      if (production.ok !== true) return storeMissing(`no injected port and no durable home: ${production.detail}`)
      port = production.port
    }
    const checked = validateStatePort(port)
    if (checked.ok !== true) return storeMissing(checked.detail)
    const observe = cap.logBackend('a5-agent-state')
    if (port.name === 'agent-state:fs') observe(`agent-state store=fs realm=${cap.realmId} (durable root under DSH_HOME/team-state/agent-state)`)
    const rowDefs = buildAgentStateRowDefinitions({
      realmId: cap.realmId,
      policy: cap.permissionPolicy,
      decide: cap.decide,
      pa: cap.pa,
      store: port,
      observe,
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
