/**
 * A5M2-B-TEAM Host-C2 kit — SOURCE-LEVEL PREPARATION ONLY (root 04:0x).
 *
 * NOT a window run: this file never boots, installs, spawns or touches a world.
 * It states the C2 row config, the acceptance surface and the criteria legs in
 * the proven live-assembly shape (`record({ leg, ok, … })` traces, see
 * `a5live-assembly-row.mjs` beside it), so the matrix owner can register the
 * row and root can rule on package/scope/budget before any window executes.
 * Product files (mount/adapter/bridge) are NOT edited here: the Team source is
 * signed at `15485936a` and the tier stays 接线未测 until a Host round runs.
 *
 * Nothing here invents a baseline: the host generation and ports come from
 * `tests/paths.mjs` (the single source), and the family facts are read from the
 * PRODUCTION read path the Host itself loads (the built dist mirror).
 */

import {
  DSH_BASELINE_VERSION,
  TEST_USE_BASELINE_SHA,
  TEST_PORT_RANGES,
  STABLE_INSTANCE_PORT,
  TEST_HOME_ROOT_REL,
} from '../../../../../tests/paths.mjs'
import {
  A5_B_TEAM_FAMILY_ID,
  A5_B_TEAM_ADAPTER_REVISION,
  A5_B_TEAM_TOOL_NAMES,
} from '../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/team-adapters.mjs'

/** The proven reuse-install shape: the lock value is the CENTER matrix's, so it
 *  is carried here as a reference slot (never copied from a stale local guess). */
export const REUSE_INSTALL = Object.freeze({
  mode: 'reuse-install',
  lock: '7faee42f8830… (center-matrix value; the window reads it from the matrix row, not from a copy)',
  baselineVersion: DSH_BASELINE_VERSION,
  baselineSha: TEST_USE_BASELINE_SHA,
  installsNewRuntime: false,
  createsNewWorld: false,
})


/**
 * The acceptance surface, each id a leg the window will trace. Every item is
 * pinned to signed source, and the two disclosures root asked to keep visible
 * are part of the list, not footnotes.
 */
export const CRITERIA = Object.freeze([
  Object.freeze({ id: 'C-READINESS', surface: 'team.listRoots v3 read-only probe answers before any C leg runs; a failing barrier ends the run with zero C legs traced.' }),
  Object.freeze({ id: 'C-SET', surface: `the closed governed set is exactly the adapter's own ${String(A5_B_TEAM_TOOL_NAMES.length)} records (tools 74-82 + 86) and each row reads ACTIVE; the three leader-facing team tools outside this family stay native and are NOT claimed here.` }),
  Object.freeze({ id: 'C-LEAF', surface: 'team_list_members mints a 12-leaf target manifest including rosterMemberIds (the roster rows\' OWN instanceIds) and rosterFingerprint (a digest of that id set — supplementary, never a count posing as identity).' }),
  Object.freeze({ id: 'C-REV', surface: `the production read path answers adapterRevision ${String(A5_B_TEAM_ADAPTER_REVISION)}; the minted PA claim and the published familyRegistration entry carry that SAME constant; a rev-${String(A5_B_TEAM_ADAPTER_REVISION - 1)} plan or approval fails the existing version comparison — no translation forward.` }),
  Object.freeze({ id: 'C-DUR-1', surface: 'THE DURABLE-CONSUMPTION LEG: with a real current-revision approval established and consumed once (positive baseline must truly pass), replay the same call against a durable approval/plan composed under the PREVIOUS revision and require refusal at the version comparison, zero lane entry, no new ledger write. This is the ONLY leg that closes "67/67 lane-level evidence does NOT replace consuming an old durable approval"; until it passes the tier stays 接线未测. A both-refuse mock is not accepted.' }),
  Object.freeze({ id: 'C-ADDRESS', surface: 'an unaddressable member answers with the native VALUE (null leaves / the native refusal); a read error or an absent fact is never manufactured into an empty leaf and then minted as an approval target.' }),
  Object.freeze({ id: 'C-VALUE', surface: 'a caller/root refusal reaches the caller as the RETURNED typed rejected VALUE through the adapter execute settled channel (asserted on the return object, never by catching), with zero durable read, zero PA entry, zero port entry.' }),
  Object.freeze({ id: 'C-ONCE', surface: 'one consumption per plan: a replay at the edge refuses, the durable consumed-proof plus the lane requestToken idempotency being the proof.' }),
])

export const CRITERIA_IDS = Object.freeze(CRITERIA.map((c) => c.id))

/**
 * Row config, 13 semantic keys (names follow the center matrix registration
 * form at landing; `null` means "matrix owner fills the name/value", never a
 * placeholder presented as fact).
 */
export const ROW_CONFIG = Object.freeze({
  familyId: A5_B_TEAM_FAMILY_ID,
  adapterRevision: A5_B_TEAM_ADAPTER_REVISION,
  productionReadPath: 'packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/team-adapters.mjs',
  providerIdentity: null,
  reuseInstall: REUSE_INSTALL,
  world: `${TEST_HOME_ROOT_REL}/a5m2-team-c2`,
  port: null,
  portDiscipline: Object.freeze({ family: TEST_PORT_RANGES, neverTouch: STABLE_INSTANCE_PORT }),
  readiness: Object.freeze({ probe: 'team.listRoots', version: 'v3', access: 'read-only', gatesAllLegs: true }),
  criteria: CRITERIA_IDS,
  durableConsumptionLeg: 'C-DUR-1',
  evidenceDir: 'dev/agent-workflow/evidence/a5m2-team-c2/runs',
  budget: Object.freeze({ sharedWorldShapeGb: 10, newInstalls: 0, newClones: 0, newHosts: 0, deletes: 0 }),
  matrixFields: null,
})

/** Pure source-level self-check — no Host, no world, no boot. */
export function validateRow (row = ROW_CONFIG) {
  const problems = []
  if (row.familyId !== 'B-TEAM') problems.push('familyId is not the signed B-TEAM family')
  if (row.adapterRevision !== 2) problems.push(`adapterRevision must be the migrated 2, found ${String(row.adapterRevision)}`)
  if (row.criteria[0] !== 'C-READINESS') problems.push('the readiness barrier must be the first traced leg')
  if (!row.criteria.includes('C-DUR-1')) problems.push('C-DUR-1 is the leg that closes durable-approval consumption; a kit without it cannot claim that closure')
  if (!row.world.startsWith(`${TEST_HOME_ROOT_REL}/`)) problems.push('the world must live under tests/homes (workspace-write sandbox discipline)')
  if (row.port === STABLE_INSTANCE_PORT) problems.push(`the stable development instance on port ${String(STABLE_INSTANCE_PORT)} is never in scope`)
  if (row.budget.newInstalls !== 0 || row.budget.deletes !== 0) problems.push('no new installs and no deletes are authorized in this preparation')
  return Object.freeze({ ok: problems.length === 0, problems, criteria: CRITERIA_IDS.length })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = validateRow()
  console.log(JSON.stringify({ source: 'a5m2-team-c2-kit', boot: false, installed: false, ...check }, null, 2))
  process.exitCode = check.ok ? 0 : 1
}
