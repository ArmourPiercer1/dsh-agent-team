/**
 * FamilyAssembly descriptor — the INSPECT family (governed read-only
 * introspection: the skill loader row + the cordis_inspect list/query rows).
 *
 * U7-F: the FIRST ordinary family added through the u7-w0b seam alone —
 * lane + this descriptor + the reviewed manifest entry + dist placements +
 * bookings. ZERO lines in `team-tool-plane.mjs` / `family-assembly.mjs` /
 * the binder: the plane drives this descriptor through its generic phases
 * and never names this family (F1 law), and the mount spellings are the
 * family's OWN alias literals (row-names.mjs states the natexe law that
 * rules out a reserved-native claim from a zero-plane-edit lane).
 *
 * MOUNT GATE (config law, closed booleans): `planeCfg.inspectFamilyEnabled`
 * absent or false = the family mounts NOTHING (byte-identical existing
 * worlds — the zero-flip law); true = all three rows mount, and the skill
 * loader's READ authority comes solely from `planeCfg.skillRoots` (trusted
 * host composition config, never model input): no sanctioned root = the
 * skill row mounts SHUT and reads nothing per call; a malformed root list
 * is a config defect and the WHOLE family refuses — the closed world
 * mounts half a law never.
 *
 * @module tools/families/inspect
 */
import { validateSkillRoots } from '../inspect-family/src/skill-mechanics.mjs'
import { createGovernedSkillExecutor } from '../inspect-family/src/skill-executor.mjs'
import { buildSkillRowDefinition } from '../inspect-family/src/skill-row.mjs'
import { createGovernedInspectListExecutor, createGovernedInspectQueryExecutor } from '../inspect-family/src/inspect-executor.mjs'
import { buildInspectRowDefinitions } from '../inspect-family/src/inspect-rows.mjs'
import { buildInspectFamilyContribution } from '../inspect-family/src/inspect-family-contribution.mjs'
import { SKILL_ROW_NAME, INSPECT_LIST_ROW_NAME, INSPECT_QUERY_ROW_NAME } from '../inspect-family/src/row-names.mjs'

export const familyAssembly = Object.freeze({
  schema: 'u7-family-assembly/1',
  familyId: 'dsh.inspect-family',
  order: 40,
  placement: 5,
  config: Object.freeze({ inspectFamilyEnabled: 'boolean' }),
  // The three alias spellings, ALWAYS the same set (row-names.mjs states
  // the natexe law this choice obeys). The skill row rides in EVERY
  // enabled world — with no sanctioned root its executor is a typed SHUT
  // face (the glob-shut precedent): the kernel always owns the name, and
  // a world that configured no root hears `skill-roots-unmounted` per
  // call rather than meeting a name the mount never declared.
  claims: () => [SKILL_ROW_NAME, INSPECT_LIST_ROW_NAME, INSPECT_QUERY_ROW_NAME],
  enabled: (cap) => cap.planeConfig.inspectFamilyEnabled === true,
  disabledOwned: () => [],
  build(cap) {
    const { realmId, permissionPolicy, decide, pa, hostService, injected } = cap
    const roots = validateSkillRoots(cap.planeConfig.skillRoots)
    if (roots.ok !== true) {
      return {
        refused: {
          code: 'PLANE_INSPECT_ROOTS_INVALID',
          message: `planeCfg.skillRoots is malformed (${roots.detail}) — a config defect refuses the whole inspect mount rather than mounting half a law`,
        },
      }
    }
    // The skill body: the family's OWN anchored loader over the sanctioned
    // roots (the fs anchor law by reference). A kit face may stand in for
    // the loader in tests. With no sanctioned root the row still mounts,
    // riding a typed SHUT executor (the glob-shut precedent): every call
    // answers `skill-roots-unmounted` and reads NOTHING — the closed world
    // never invents a root, and the kernel always owns the name.
    const skillExecutor = typeof injected?.skill === 'function'
      ? injected.skill
      : roots.roots.length > 0
        ? createGovernedSkillExecutor({
          realmId,
          skillRoots: roots.roots,
          policy: permissionPolicy,
          decide,
          pa,
          observe: cap.logBackend('a7f-skill'),
        })
        : async () => ({
          kind: 'refused',
          text: 'refused-admission skill-roots-unmounted — this mount sanctions no skill root (planeCfg.skillRoots is absent or empty), so no skill file can be read from anywhere',
        })
    // The inspect body: the host PUBLIC registry face, resolved LAZILY per
    // call through the mount's agent ctx (the attachments/llm seam law) —
    // absent seam = the typed unmounted refusal, never a bypass.
    const inspectFace = injected?.inspect ?? (() => hostService('cordisInspect'))
    const skillDefinition = buildSkillRowDefinition({ skillExecutor })
    const [listDefinition, queryDefinition] = buildInspectRowDefinitions({
      inspectListExecutor: createGovernedInspectListExecutor({
        realmId,
        policy: permissionPolicy,
        decide,
        pa,
        inspectFace,
        observe: cap.logBackend('a7f-ilist'),
      }),
      inspectQueryExecutor: createGovernedInspectQueryExecutor({
        realmId,
        policy: permissionPolicy,
        decide,
        pa,
        inspectFace,
        observe: cap.logBackend('a7f-iquery'),
      }),
    })
    const definitions = [skillDefinition, listDefinition, queryDefinition]
    const contribution = buildInspectFamilyContribution({
      skillDefinition,
      listDefinition,
      queryDefinition,
      cancelBoundary: 'the query row runs ONE bounded settle race (the shared cancel leg raceConfinedSettle: tie law exited > timedOut > aborted, fixed by registration order, never re-decided); timeout and abort answer their OWN typed refusals and abort the downstream registry signal — the host registry settles its pending Client query as cancelled on that signal — and a value that lands after either answer is NEVER published (the no-late-result law); the skill loader rides the host exec signal at the PA edge, where a cancelled walk settles with zero bytes read',
    })
    return { definitions, contribution }
  },
  refusalCode: 'PLANE_INSPECT_REGISTRATION_REFUSED',
})
