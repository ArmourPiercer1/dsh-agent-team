/**
 * probe-verdicts.mjs — prints the VERBATIM verdict objects the TINF observer
 * closeout memo quotes. Every number in the memo is this script's output.
 *
 *   node dev/agent-workflow/evidence/tinf-observer-20261119/probe-verdicts.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { register } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The repo root: walk up until a directory has both `package.json` and `.git`. */
function repoRoot() {
  let dir = resolve(new URL('.', import.meta.url).pathname)
  for (;;) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, '.git'))) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) throw new Error('no repo root above this script')
    dir = parent
  }
}
const REPO_ROOT = repoRoot()
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
const { createFsWitness } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'testkit', 'src', 'effect-witness.ts')).href)
const { judgeContract } = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'testkit', 'src', 'contract-oracle.ts')).href)
const { TestWorld, TestWorldFactory } = await import(pathToFileURL(join(REPO_ROOT, 'tests', 'world-factory', 'lib', 'world-factory.mjs')).href)
const { isFactoryWorld } = await import(pathToFileURL(join(REPO_ROOT, 'tests', 'world-factory', 'lib', 'world-identity.mjs')).href)
const m7b1 = await import(pathToFileURL(join(REPO_ROOT, 'tests', 'world-factory', 'lib', 'm7b1-observation-contract.mjs')).href)

const TMP = join(REPO_ROOT, '.artifacts', 'tmp', 'probe-verdicts')
mkdirSync(TMP, { recursive: true })
const scratch = (name) => mkdtempSync(join(TMP, `${name}-`))
const show = (label, value) => console.log(`${label}\n${JSON.stringify(value, null, 2)}\n`)

const pair = (executionId, { denied = false, seq = 1, decision = 'decision-allow' } = {}) => [
  { schema: 'agent-execution-event/1', event_seq: seq, event_type: 'tool/call', actor_id: 'member', execution_id: executionId, authority_ref: decision, outcome: 'DISPATCHED' },
  { schema: 'agent-execution-event/1', event_seq: seq + 1, event_type: 'tool/result', actor_id: 'member', authority_actor_id: 'member', execution_id: executionId, authority_ref: decision, outcome: denied ? 'DENIED' : 'COMPLETED', effect_id: null },
]

// ── F-07: the real instrument at the boundary ────────────────────────────────
console.log('===== F-07: a REAL filesystem witness over 500 vs 501 created files =====')
for (const population of [500, 501]) {
  const root = scratch(`cap-${population}`)
  const watched = join(root, 'watched')
  mkdirSync(watched, { recursive: true })
  const witness = createFsWitness({ root: watched, watch: [watched] })
  for (let index = 0; index < population; index += 1) writeFileSync(join(watched, `f${String(index).padStart(3, '0')}.txt`), String(index))
  const rows = await witness.observe()
  const filesystem = rows.find((row) => row.domain === 'filesystem')
  const judgement = judgeContract({
    contractId: `CAP-${population}`,
    events: pair('exec-cap', { denied: true }),
    witness: rows,
    blindDomains: ['process', 'network'],
    requiredEffectDomains: ['filesystem'],
    requiredEffectScope: [watched],
    authorizedEffectPaths: [watched],
    requiredExecutionId: 'exec-cap',
    witnessProvenance: 'witnessed',
  })
  console.log(`changed paths: ${population}`)
  show('  filesystem row (counts + kind declaration)', {
    observedPaths: filesystem.observedPaths.length,
    observedPathsDropped: filesystem.observedPathsDropped,
    evidence: filesystem.evidence.length,
    evidenceDropped: filesystem.evidenceDropped,
    truncated: filesystem.truncated,
    observableEffects: filesystem.observableEffects,
    unobservableEffects: filesystem.unobservableEffects,
  })
  show('  verdict', judgement)
  rmSync(root, { recursive: true, force: true })
}

// ── F-08: who was denied ────────────────────────────────────────────────────
console.log('===== F-08: a DENIED is evidence about ONE execution =====')
{
  const root = scratch('deny')
  const watched = join(root, 'watched')
  mkdirSync(watched, { recursive: true })
  const rows = await createFsWitness({ root: watched, watch: [watched] }).observe()
  const grade = (label, events, extra = {}) => show(label, judgeContract({
    contractId: 'DENY',
    events,
    witness: rows,
    blindDomains: ['process', 'network'],
    requiredEffectDomains: ['filesystem'],
    requiredEffectScope: [watched],
    witnessProvenance: 'witnessed',
    requiredExecutionId: 'exec-graded',
    ...extra,
  }))
  grade('call A DENIED, graded call B has no denial (requiredExecutionId=exec-graded)', [...pair('exec-foreign', { denied: true, seq: 1 }), ...pair('exec-graded', { seq: 3 })])
  grade('the graded call’s OWN denial', [...pair('exec-graded', { denied: true, seq: 1 }), ...pair('exec-foreign', { seq: 3 })])
  grade('a foreign DENIED that carries an effect_id (rule 3a, unchanged)', [
    ...pair('exec-graded', { seq: 1 }),
    { schema: 'agent-execution-event/1', event_seq: 3, event_type: 'tool/result', execution_id: 'exec-foreign', outcome: 'DENIED', effect_id: 'effect-9' },
  ])
  show('two denials, no requiredExecutionId (ambiguous)', judgeContract({
    contractId: 'DENY-AMBIGUOUS',
    events: [...pair('exec-one', { denied: true, seq: 1 }), ...pair('exec-two', { denied: true, seq: 3 })],
    witness: rows,
    blindDomains: ['process', 'network'],
    requiredEffectDomains: ['filesystem'],
    requiredEffectScope: [watched],
    witnessProvenance: 'witnessed',
  }))
  rmSync(root, { recursive: true, force: true })
}

// ── F-09: World provenance ──────────────────────────────────────────────────
console.log('===== F-09: the World identity is a receipt =====')
{
  const root = scratch('world')
  const home = join(root, 'home')
  const watched = join(home, 'watched')
  mkdirSync(watched, { recursive: true })
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: join(TMP, 'evidence'), hostTree: join(TMP, 'no-host') })
  const world = new TestWorld(factory, { id: 'probe-world', name: 'probe-world', home, workspaceDir: join(home, 'workspace'), visible: false })
  const identity = { agentId: 'a', executionId: 'e', scope: [watched] }
  const attempt = (label, candidate) => {
    try {
      const contract = m7b1.declareObservationContract({ world: candidate, ...identity })
      console.log(`${label}: ACCEPTED contract_id=${contract.contract_id} world_identity=${JSON.stringify(contract.world_identity)}`)
    } catch (error) {
      console.log(`${label}: REFUSED code=${error.code}\n  detail=${error.detail}`)
    }
  }
  attempt('the REAL TestWorld                 ', world)
  attempt('a hand-written {id, home}          ', { id: 'probe-world', home })
  attempt('a spread copy                     ', { ...world })
  attempt('a structuredClone                 ', structuredClone({ id: world.id, home: world.home, workspaceDir: world.workspaceDir }))
  const derived = Object.create(world); derived.id = world.id; derived.home = world.home
  attempt('a prototype-inheriting copy       ', derived)
  attempt('a receipt-SHAPED forgery          ', { ...world, world_identity: { schema: 'dsh-world-identity/1', world_id: world.id, home } })
  console.log(`isFactoryWorld(world)=${isFactoryWorld(world)} isFactoryWorld({...world})=${isFactoryWorld({ ...world })}`)
  const contract = m7b1.declareObservationContract({ world, ...identity })
  show('contractWorldIdentity(declared contract)', m7b1.contractWorldIdentity(contract))
  show('contractWorldIdentity({...contract})', m7b1.contractWorldIdentity({ ...contract }))
  for (const [label, options] of [
    ['createFsWitness world without a guard', { root: watched, watch: [watched], world: { id: 'x', home: watched } }],
    ['createFsWitness world + guard=false', { root: watched, watch: [watched], world: { id: 'x', home: watched }, worldGuard: () => false }],
    ['createFsWitness REAL world + isFactoryWorld', { root: watched, watch: [watched], world, worldGuard: isFactoryWorld }],
  ]) {
    try {
      const witness = createFsWitness(options)
      const rows = await witness.observe()
      console.log(`${label}: ACCEPTED (sealed rows: ${rows.length})`)
    } catch (error) {
      console.log(`${label}: REFUSED ${error.name}: ${error.message}`)
    }
  }
  try { m7b1.declareObservationContract({ world, agentId: 'a', executionId: 'e', scope: [watched], claim: m7b1.READ_NON_OCCURRENCE_CLAIM }) }
  catch (error) { console.log(`read claim at declare time: REFUSED code=${error.code}\n  detail=${error.detail}`) }
  rmSync(root, { recursive: true, force: true })
}

// ── M7-C: the read boundary at the oracle ───────────────────────────────────
console.log('===== M7-C: a quiet snapshot cannot grade a read =====')
{
  const root = scratch('read')
  const watched = join(root, 'watched')
  mkdirSync(watched, { recursive: true })
  writeFileSync(join(watched, 'secret.txt'), 'read me\n')
  const rows = await createFsWitness({ root: watched, watch: [watched] }).observe()
  for (const kinds of [['read'], ['create'], undefined]) {
    const judgement = judgeContract({
      contractId: `KINDS-${kinds?.join('+') ?? 'none'}`,
      events: pair('exec-read', { denied: true }),
      witness: rows,
      blindDomains: ['process', 'network'],
      requiredEffectDomains: ['filesystem'],
      requiredEffectScope: [watched],
      requiredExecutionId: 'exec-read',
      ...(kinds === undefined ? {} : { requiredEffectKinds: kinds }),
      witnessProvenance: 'witnessed',
    })
    show(`requiredEffectKinds=${JSON.stringify(kinds ?? null)}`, judgement)
  }
  rmSync(root, { recursive: true, force: true })
}
