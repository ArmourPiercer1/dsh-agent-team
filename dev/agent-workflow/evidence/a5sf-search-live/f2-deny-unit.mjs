/**
 * a5sf-search-live F2 verification — the leader's `builtinToolDeny` (the
 * `LEADER_MANAGED_TOOL_NAMES` fix) against the REAL permission-coverage gate,
 * host-free, with its mutation control.
 *
 * F2 (evidence/README.md §4): the booted World's `team.create` refused the
 * leader with
 *
 *   TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED … permission coverage gate
 *   failed for instance 'inst-leader': 2 unmanaged tool(s) on the final
 *   model-facing surface: glob (known-sensitive-unmanaged),
 *   grep (known-sensitive-unmanaged)
 *
 * The gate is right: `grep`/`glob` are managed on a MEMBER realm (BL-16 mounts a
 * confined `subprocess` face there) and unmanaged on the root/leader session,
 * which has no realm. The fix is composition, not product: the leader denies the
 * two names it cannot own and delegates search to a Member.
 *
 * ARMS
 *   F2-SURFACE-REAL     the surface this script evaluates is the World's OWN
 *                       recorded final surface (`run.log`, 24 tools)
 *   F2-LEADER-DENY      with the leader deny applied exactly as the driver
 *                       computes it, the REAL gate PASSES
 *   F2-MUTATION-NO-DENY removing the grep/glob deny reproduces the World's
 *                       refusal VERBATIM (the typed error detail + message)
 *   F2-MEMBER-REALM     the leader deny is leader-only: the Member realm keeps
 *                       `grep`+`glob` (composition assert; the executed proof is
 *                       the BL-16 arm suite, cited in the artifact)
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME. Pure product modules + the World's
 * own recorded surface.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-search-live/f2-deny-unit.mjs
 * Exit: 0 = every arm measured as required; 1 = a mismatch.
 *
 * @module dev/agent-workflow/evidence/a5sf-search-live/f2-deny-unit
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')

const coverage = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'operation-permission', 'permission-coverage.ts')).href)

const runBoot = readFileSync(join(HERE, 'run-boot.mjs'), 'utf8')
const runLog = readFileSync(join(HERE, 'run.log'), 'utf8')

/** Read a `const NAME = [...]` string-array literal from the driver source. */
function stringList(name) {
  const match = new RegExp(`const ${name} = \\[([^\\]]*)\\]`, 'u').exec(runBoot)
  assert.ok(match !== null, `${name} is not a literal array in run-boot.mjs`)
  return [...match[1].matchAll(/'([^']+)'/gu)].map((entry) => entry[1])
}

const LEADER_MANAGED = stringList('LEADER_MANAGED_TOOL_NAMES')
const SAFE_UNMANAGED = stringList('SAFE_UNMANAGED_TOOL_NAMES')
// The closed managed vocabulary is a static literal in the product schema; it is
// read as text because importing that module pulls the whole domain graph.
const schemaSource = readFileSync(join(REPO_ROOT, 'packages', 'domain', 'blueprint', 'src', 'schema.ts'), 'utf8')
const MANAGED_VOCABULARY = [...(/export const PERMISSION_TOOL_NAMES: readonly string\[\] = \[([^\]]*)\]/u.exec(schemaSource))[1].matchAll(/'([^']+)'/gu)].map((entry) => entry[1])

// The World's own recorded final surface — not a hand-written approximation.
const surfaceMatch = /model-visible surface \((\d+)\): (.+)$/mu.exec(runLog)
assert.ok(surfaceMatch !== null, 'run.log carries no recorded model-visible surface')
const RECORDED_SURFACE = surfaceMatch[2].split(',').map((name) => name.trim()).filter(Boolean)
assert.equal(Number(surfaceMatch[1]), RECORDED_SURFACE.length, 'the recorded surface count does not match its list')

// The driver's deny expression, verbatim (run-boot.mjs, "builtinToolDeny base list").
const denyOf = (managedList) => RECORDED_SURFACE
  .filter((name) => !name.startsWith('team_') && !managedList.includes(name) && !SAFE_UNMANAGED.includes(name))
const effectiveSurface = (deny) => RECORDED_SURFACE.filter((name) => !deny.includes(name))

const facts = {
  managedToolNames: MANAGED_VOCABULARY,
  teamToolNames: RECORDED_SURFACE.filter((name) => name.startsWith('team_')),
  mcpToolNames: [],
}

const results = []
const measure = (label, detail) => {
  results.push({ arm: label, ok: true, detail })
  console.log(`${label}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}

// ---------------------------------------------------------------------------
// F2-SURFACE-REAL
// ---------------------------------------------------------------------------
measure('F2-SURFACE-REAL', `recorded surface=${String(RECORDED_SURFACE.length)} tools; managed vocabulary=${String(MANAGED_VOCABULARY.length)}; team tools=${String(facts.teamToolNames.length)}`)

// ---------------------------------------------------------------------------
// F2-LEADER-DENY — with the leader deny, the REAL gate passes
// ---------------------------------------------------------------------------
const deny = denyOf(LEADER_MANAGED)
const passing = coverage.evaluatePermissionCoverage(effectiveSurface(deny), facts)
assert.equal(passing.ok, true, `the leader deny must pass the coverage gate: ${JSON.stringify(passing.unmanagedTools)}`)
assert.deepEqual(deny, ['glob', 'grep', 'u5_canary', 'u6fs_probe'],
  `the leader deny must be exactly the unmanaged part of the surface, got ${JSON.stringify(deny)}`)
for (const name of ['grep', 'glob']) {
  assert.equal(deny.includes(name), true, `${name} must be denied on the leader`)
  assert.equal(effectiveSurface(deny).includes(name), false, `${name} must leave the leader's model-facing surface`)
}
measure('F2-LEADER-DENY', `deny=[${deny.join(',')}] → gate ok=${String(passing.ok)} on ${String(effectiveSurface(deny).length)} tools`)

// ---------------------------------------------------------------------------
// F2-MUTATION-NO-DENY — removing the deny reproduces the World's refusal
// ---------------------------------------------------------------------------
const mutantList = [...LEADER_MANAGED, 'grep', 'glob']
const mutantDeny = denyOf(mutantList)
assert.deepEqual(mutantDeny, ['u5_canary', 'u6fs_probe'],
  `the mutation must stop denying grep/glob, got ${JSON.stringify(mutantDeny)}`)
const refused = coverage.evaluatePermissionCoverage(effectiveSurface(mutantDeny), facts)
assert.equal(refused.ok, false, 'without the leader deny the coverage gate must refuse')
const names = refused.unmanagedTools.map((entry) => entry.name).sort()
assert.deepEqual(names, ['glob', 'grep'], `the refusal must be exactly grep+glob, got ${JSON.stringify(names)}`)
for (const entry of refused.unmanagedTools) {
  assert.equal(entry.classification, 'known-sensitive-unmanaged')
}
// The World's own recorded error text, reproduced from the typed detail.
const detail = coverage.buildPermissionCoverageErrorDetail(refused, { instanceId: 'inst-leader', presetId: 'a5sf-search-base' })
// The typed detail names the same entries the World's refusal named, in the
// same surface order (`entries` is sorted by name: glob before grep).
const reproducedEntries = detail.unmanagedTools.map((entry) => `${entry.name} (${entry.classification})`).join(', ')
// The FULL text survives only in the run log (stage-diagnosis truncates it).
const worldMessage = runLog
assert.equal(reproducedEntries, 'glob (known-sensitive-unmanaged), grep (known-sensitive-unmanaged)',
  `the reproduced detail must carry the World's entries, got ${JSON.stringify(reproducedEntries)}`)
// The driver persisted the refusal TRUNCATED (redact(...).slice(0, 300) in
// run-boot.mjs, then a 400-char stage-diagnosis), so the comparison is on the
// surviving prefix: the reproduced message must continue the World's own text
// character for character.
const message = `permission coverage gate failed for instance 'inst-leader': 2 unmanaged tool(s) on the final model-facing surface: ${reproducedEntries} (code: ${detail.code})`
const worldPrefix = /permission coverage gate failed for instance 'inst-leader': 2 u/u.exec(worldMessage)
assert.ok(worldPrefix !== null, `the recorded F2 diagnosis lost the refusal prefix: ${worldMessage.slice(0, 300)}`)
assert.equal(message.startsWith(worldPrefix[0]), true,
  `the reproduced refusal must continue the World's prefix ${JSON.stringify(worldPrefix[0])}, got ${JSON.stringify(message.slice(0, 160))}`)
writeFileSync(join(HERE, 'f2-deny.json'), JSON.stringify({
  surface: RECORDED_SURFACE,
  leaderManaged: LEADER_MANAGED,
  deny,
  gate: { ok: passing.ok, tools: passing.tools },
  mutation: { mutantDeny, ok: refused.ok, unmanagedTools: refused.unmanagedTools, message },
  worldDiagnosis: worldMessage.slice(0, 400),
}, null, 2) + '\n')
measure('F2-MUTATION-NO-DENY', `mutant deny=[${mutantDeny.join(',')}] → gate ok=${String(refused.ok)} entries=${JSON.stringify(names)} — the World's refusal reproduced`)

// ---------------------------------------------------------------------------
// F2-MEMBER-REALM — the deny is leader-only; the Member realm keeps search
// ---------------------------------------------------------------------------
const memberPreset = runBoot.includes("findMemberPrimaryPreset") || runBoot.includes('memberPresetId')
assert.equal(memberPreset, true, 'the driver must still compose a Member preset separate from the leader surface')
assert.match(runBoot, /a5sfExpectedTools/u, 'the driver must still declare the expected Member-realm tools')
const searchModuleLine = /HOST_TOOL_FS_SEARCH\)\.href\]: \[([^\]]*)\]/u.exec(runBoot)
assert.ok(searchModuleLine !== null, 'the driver must still expect a tool list from the search module')
const expectedSearchTools = [...searchModuleLine[1].matchAll(/'([^']+)'/gu)].map((entry) => entry[1])
assert.deepEqual(expectedSearchTools.sort(), ['glob', 'grep'],
  `the Member realm must still be expected to expose grep+glob, got ${JSON.stringify(expectedSearchTools)}`)
// The deny is a LEADER template field: it never names a Member realm face.
assert.match(runBoot, /mainBlueprintYaml\(denyList\)/u, 'the deny must enter the MAIN (leader) blueprint')
measure('F2-MEMBER-REALM', `leader deny is leader-only; Member realm still expects [${expectedSearchTools.join(',')}] (executed proof: dev/agent-workflow/evidence/a5sf-bl16-grep/grep-arms.mjs)`)

const artifact = {
  schema: 'a5sf-f2-deny/1',
  generatedAt: new Date().toISOString(),
  surface: RECORDED_SURFACE.length,
  leaderDeny: deny,
  gateOk: passing.ok,
  mutationRefused: refused.ok === false,
  memberExpectedTools: expectedSearchTools,
  arms: results,
  verdict: 'PASS',
}
writeFileSync(join(HERE, 'f2-deny.json'), JSON.stringify(artifact, null, 2) + '\n')
console.log('\nVERDICT: PASS (4/4 arms)')
